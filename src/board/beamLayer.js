import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/* 🔊 THE BEAM LAYER — the Sonic's rings draw over EVERYTHING, bar one Spirit.
   (Alex, 2026-09-30: *"the sound form rings should be in a layer in front of
   everything (well... there is a moment when the attack 'circles' the attacking
   Spirit - it should go 'behind' it at this point) - but it seems like it loses
   out to some assets and gets cut out sometimes"*.)

   ⚠️ WHY IT WAS CUT OUT. The arena is three layers stacked in the page (see
   solidLayer.js): the WebGL arena (z 0), the board's SVG on a CSS3D plane (z 1)
   and the foreground canvas (z 2), which re-draws the amps, fans, dice and crowd
   (the solid layer) and then draws the standees. The beam lived in the ARENA
   scene, so everything on the two layers above it painted over it however near
   the lens the beam was — an amp, a fan stand, a die, BOTH Spirits (the beam
   never once crossed in front of either) — and the board's hex tints over all
   of it. Its `depthTest:false` and renderOrder 137–145 only ever won inside the
   arena canvas. `.scratch/beam-layer/` has the before/after frames.

   ⭐ THE FIX — the move the spotlight cones made on 2026-09-25. The beam is its
   own scene, drawn LAST on the foreground canvas, after the solids and the
   standees, so nothing on screen can cover it.

   🌀 THE ONE EXCEPTION: THE ATTACKER. The beam leaves the Drive amp and loops
   round the attacking Spirit before it heads for the Rival (`buildSonicPath`,
   radius `clearance`); on the far side of that loop it must pass BEHIND the
   print. So the depth buffer is cleared and the attacker's print alone is
   written back into it, depth only, and the beam is depth-TESTED against that
   and nothing else. Near side of the loop: in front. Far side: behind the
   print, exactly where the print is. The Rival, the amps, the fans and the board
   get no vote. 📌 A consequence, not a rule: a stretch of beam that really is
   behind the attacker from the lens (the first leg out of an amp standing
   behind them, say) passes behind the print too — the same geometry as the loop.

   ✨ THE GLOW COMES WITH IT. Moving the beam off the arena canvas takes it away
   from that canvas's bloom — and the white-hot flash, the burst and the shards
   were HARD WHITE SHAPES without it (the first after-render). The rings'
   signed-off look had bloom on (the Sonic Volley Rework preview's default). So
   the ADDITIVE parts render into their own HDR target, get the arena's own
   bloom (same strength, radius and threshold — off in Lite, like the arena's),
   and are tone-mapped with the arena's ACES and exposure, then SCREENED onto
   the canvas (🎚️ below says why not added), which stays see-through wherever
   there is no beam. What that cannot carry — a dark label plate added is no plate at all —
   is drawn in a second, plain pass: every NON-additive part (today only the
   shield's HP plate) goes on `BEAM_FLAT_LAYER` and draws straight onto the
   canvas, as it did in the arena.
   ⚠️ Not identical to before, and cannot be: the arena tone-maps beam + arena
   together, this tone-maps them apart and adds. And the arena's depth of field
   no longer blurs the beam — it is sharp during a focus shot, as the solids are.
   Seen in cloud Chromium (SwiftShader); NOT yet on Alex's GPU.

   📌 Only meshes whose material WRITES depth occlude — the print (alpha-tested,
   so the cut outline, not the sheet's rectangle) and its lit edge. The clear
   acrylic sheet never writes depth (standee.js), so the beam still shows
   through the sheet around the character, as it should. */
export const BEAM_OCCLUDER_LAYER = 4;
export const BEAM_FLAT_LAYER = 5;

const writesDepth = m => m && !Array.isArray(m) && m.visible !== false && m.depthWrite !== false && m.colorWrite !== false;
const additive = o => [o.material].flat().some(m => m?.blending === THREE.AdditiveBlending);

/**
 * @param foreground the transparent canvas above the board's SVG
 * @param bloom the arena's bloom settings `{strength, radius, threshold}`
 */
export function createBeamLayer({ foreground, bloom: look = { strength: .54, radius: .65, threshold: 1.05 } }) {
  const scene = new THREE.Scene(); scene.name = 'Sonic beam layer';
  // One depth-only stand-in per occluder material, kept for the material's life.
  // Unlit MeshBasic, so it needs none of the room's lights; it keeps the alpha
  // cut (map + alphaTest) and the side, which are all that decide coverage.
  const depthCopies = new WeakMap(), made = [];
  const depthFor = m => {
    let d = depthCopies.get(m);
    if (!d) {
      d = new THREE.MeshBasicMaterial({ colorWrite: false, side: m.side,
        map: m.alphaTest > 0 ? m.map ?? null : null, alphaTest: m.alphaTest ?? 0 });
      depthCopies.set(m, d); made.push(d);
    }
    return d;
  };
  // ⚠️ EVERY MATERIAL IN THE LAYER DEPTH-TESTS, and none writes depth. The beam
  // modules set `depthTest:false` for the ARENA pass, where it meant "over the
  // board"; here the only depth there is is the attacker's, so testing is what
  // lets the far side of the loop go behind them — and since no ring writes
  // depth, one ring never hides another. Enforced here, the first frame a part
  // is seen, not by the caller: the legacy one-beam-at-a-time sequence
  // (sonicSequenceVisuals.js) builds its beams mid-flight.
  const joined = new WeakSet();
  const join = o => {
    if (joined.has(o)) return;
    joined.add(o);
    if (!o.material) return;
    for (const m of [o.material].flat()) if (m) { m.depthTest = true; m.depthWrite = false; }
    if (!additive(o)) o.layers.set(BEAM_FLAT_LAYER);
  };

  // The glow pass: linear HDR, cleared to OPAQUE black so the bloom reads the
  // same coverage the arena's does (it weighs its glow by the source's alpha).
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const glow = new UnrealBloomPass(new THREE.Vector2(1, 1), look.strength, look.radius, look.threshold);
  // 🎚️ THE COMPOSITE: the arena's ACES and exposure (three's own chunks, from
  // the renderer), then a SCREEN, not an add. ⚠️ Adding a tone-mapped beam onto
  // a tone-mapped arena blows out to white wherever both are bright — the first
  // bloomed after-render whited out the whole shield break — because the arena
  // used to tone-map the SUM, which rolls off instead of clipping. A screen
  // (below × (1 − beam)) rolls off the same way. Written as premultiplied colour
  // with alpha = its brightest channel, so the page's own compositor finishes
  // the screen over the arena canvas too, and every pixel is valid premultiplied
  // (no channel above its alpha) — no reliance on the browser tolerating
  // super-luminous pixels.
  const composite = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { tBeam: { value: null } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `uniform sampler2D tBeam;varying vec2 vUv;
      void main(){
        gl_FragColor=vec4(texture2D(tBeam,vUv).rgb,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.rgb=clamp(gl_FragColor.rgb,0.,1.);
        gl_FragColor.a=max(gl_FragColor.r,max(gl_FragColor.g,gl_FragColor.b));
      }`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  }));
  const size = new THREE.Vector2(), clearColor = new THREE.Color();
  const drawable = () => { let any = false; scene.traverseVisible(o => { join(o); if (o.isMesh || o.isSprite || o.isLine || o.isPoints) any = true; }); return any; };

  function writeOccluders(camera, occluderScene, occluders) {
    if (!occluderScene || !occluders.length) return;
    const swapped = [], mask = camera.layers.mask, auto = occluderScene.matrixWorldAutoUpdate;
    for (const root of occluders) root?.traverse(o => {
      if (!o.isMesh || o.isSprite || !writesDepth(o.material)) return;
      swapped.push([o, o.material]); o.material = depthFor(o.material); o.layers.enable(BEAM_OCCLUDER_LAYER);
    });
    // The foreground pass has just updated every world matrix; don't walk them twice.
    occluderScene.matrixWorldAutoUpdate = false; camera.layers.set(BEAM_OCCLUDER_LAYER);
    try { if (swapped.length) foreground.render(occluderScene, camera); }
    finally {
      for (const [o, m] of swapped) { o.material = m; o.layers.disable(BEAM_OCCLUDER_LAYER); }
      camera.layers.mask = mask; occluderScene.matrixWorldAutoUpdate = auto;
    }
  }

  return {
    scene,
    /** Is anything on screen? (The clash group is up for the whole bout; its parts are not.) */
    busy: () => drawable(),
    /**
     * Draw the beam over whatever the foreground canvas already holds.
     * @param occluderScene the scene the occluders live in (their world matrices already current)
     * @param occluders Object3Ds (the attacking Spirit's standee) the beam may pass behind
     * @param bloom false in Lite, as the arena's is
     */
    render(camera, { occluderScene = null, occluders = [], bloom = true } = {}) {
      // ⚡ Nothing lit, nothing drawn — not even a depth clear. The clash group
      // stays up for the whole bout (dice, gate and all), but its parts only
      // show from the shield build on; the glow pass is a full-screen bloom on
      // the low-power context, so it runs only while something is there.
      if (!drawable()) return false;
      const mask = camera.layers.mask, alpha = foreground.getClearAlpha();
      foreground.getClearColor(clearColor);
      foreground.getDrawingBufferSize(size);
      if (target.width !== size.x || target.height !== size.y) { target.setSize(size.x, size.y); glow.setSize(size.x, size.y); }
      try {
        // ① the light: additive parts → HDR target → bloom → tone-mapped, screened on.
        foreground.setRenderTarget(target);
        foreground.setClearColor(0x000000, 1); foreground.clear();
        writeOccluders(camera, occluderScene, occluders);
        camera.layers.set(0); foreground.render(scene, camera);
        if (bloom) glow.render(foreground, null, target, 0, false);
        foreground.setRenderTarget(null);
        composite.material.uniforms.tBeam.value = target.texture; composite.render(foreground);
        // ② the flat parts, straight onto the canvas, against the attacker too.
        foreground.clearDepth();
        camera.layers.mask = mask;
        writeOccluders(camera, occluderScene, occluders);
        camera.layers.set(BEAM_FLAT_LAYER); foreground.render(scene, camera);
      } finally {
        foreground.setRenderTarget(null); foreground.setClearColor(clearColor, alpha);
        camera.layers.mask = mask;
      }
      return true;
    },
    dispose() {
      for (const m of made) m.dispose(); made.length = 0;
      target.dispose(); glow.dispose(); composite.material.dispose(); composite.dispose(); scene.clear();
    },
  };
}
