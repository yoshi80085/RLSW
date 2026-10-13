// 🔮 LOST CHORD ENERGY BALLS — the board's notes as balls of energy, not crystals.
//
// Alex, 2026-10-10: *"lets change the way the 'lost notes' are represented on the
// board. Instead of being 'crystals', I think it'd be more fitting if there were
// more like balls of energy - for example the riff off energy ball, also the
// glitter helix - I think they could be drawn out more in this direction. Can you
// make up a preview so we can make necessary edits?"*
//
// 📌 THE RECIPE IS THE RIFF-OFF BALL'S (`riffWaveforms.js`, "Converging Soundform
// ball"), shrunk to fit a hex:
//   · HOOPS — thin two-band rings (a soft band and a hot core band), each on its
//     own tilted axis, direction and speed. Uneven spin is what makes the riff
//     ball read as a churning ball rather than a gyroscope.
//   · HAZE — a rim-lit shell, brightest at its silhouette (fresnel), so the ball
//     has an edge even where no hoop crosses it.
//   · GLITTER HELIX — Sonic's soundform glitter (`createSpiralGlitter`, Alex's
//     2026-10-03 dial-in) wound inside a sphere, exactly as the riff ball's
//     "core spiral glitter" does.
//   · HEART — a hot soft centre, so the ball reads as ONE glowing thing from
//     the arena camera, where it is only ~25 px across.
//   · ENERGY FEED (new) — a thin glitter helix climbing out of a glowing pool in
//     the stone up into the ball, the way the amps' ring streams feed the riff
//     ball. It replaces the crystal's crack as the thing that roots the note in
//     the stage ("Lost Chords crystallise from the harmonic interference" →
//     the stage's own energy is pooling into a ball).
//
// ⏳ PREVIEW ONLY (2026-10-10). The ball is a third token STYLE beside 'crystal'
// and 'today' (`createLostChords(...).place(num, note, claim, 'orb')`). The game's
// layer still asks for crystals, so nothing in a match changes until Alex dials
// this in on `.scratch/lost-chord-orb-preview.html` and the port flips the style.
//
// ⚠️ THE GLITTER IS DEPTH-TESTED HERE. `createSpiralGlitter` ships with
// depthTest:false (the riff ball and Sonic float in open air), but a Lost Chord
// sits among the standees: a ball behind the Ronin must be hidden by him.
import * as THREE from 'three';
import { SONIC_GLITTER, createSpiralGlitter, createHelixStations, writeHelixStations } from './sonicGlitter.js';

/** Every taste call is a lever on `.scratch/lost-chord-orb-preview.html`.
 *  ⭐ ALEX'S DIAL-IN, 2026-10-10 (14 of 63 levers, from the Balanced preset, viewed
 *  at arena camera, High/bloom): the lines marked ✎ are his; the rest he saw and
 *  kept. ⏳ Saved, NOT ported: he asked to keep the settings and build it out later. The note, colours, light, motes,
 *  hunt hex, moments and sound are shared with the crystal (`LOST_CHORD_LOOK`). */
export const LOST_CHORD_ORB = Object.freeze({
  // ── the ball ──
  orbSize:0.67,            // diameter (world units; a hex is ~1.9 across)   ✎ Alex
  orbHover:0.95,          // the ball's centre over y 0 (the stone's top is .2)
  hazeGlow:0.9,           // the shell's colour strength
  hazeRim:0.15,            // how bright its silhouette is   ✎ Alex
  hazeFill:0.1,           // how much the middle of the shell glows (0 = a clear bubble)
  heart:0.55,             // the hot centre, × the ball (0 = off)
  heartGlow:1.5,
  // ── the hoops (the riff ball's rings) ──
  hoops:3,                // the riff ball has 14; at hex size 6 still reads as a ball   ✎ Alex
  hoopWidth:0.015,        // the soft band's thickness (× the ball)   ✎ Alex
  hoopGlow:1.0,           // ⚠️ past ~1.2 six additive hoops stack to WHITE and cyan / blue stop reading (headless 10-10)
  hoopOpacity:0.7,
  hotBand:0.6,            // the thin hot band inside each hoop (0 = soft band only)
  hoopSpin:1.6,           // × the riff ball's spin rates
  // ── the glitter helix inside ──
  glitter:690,            // particles (Sonic's soundform uses 2000 on a beam)   ✎ Alex
  glitterSize:1.8,   // ✎ Alex
  glitterGlow:0.75,   // ✎ Alex
  glitterTurns:4.5,       // Sonic's dial-in
  glitterStrands:3,       // Sonic's dial-in
  glitterSpin:0.19,       // turns a second (Sonic's dial-in)
  glitterFlow:0.06,       // how fast the glitter runs along the helix (Sonic's dial-in)
  iridescence:0.35,       // 0 = the note's colour · 1 = full prism (Sonic is .8; less here so red/blue hunt colours survive)
  twinkle:0.85,
  filament:0.05,          // the faint helix spine
  // ── the energy feed: a helix from the stone into the ball ──
  feed:0.9,               // brightness (0 = off)
  feedWidth:0.5,         // the helix's radius   ✎ Alex
  feedDensity:200,   // ✎ Alex
  feedTurns:0.5,   // ✎ Alex
  feedFlow:-0.03,          // + climbs into the ball · − pours out of it   ✎ Alex
  // ── the floor ──
  orbFloor:'pool',        // 'pool' a soft glow in the stone · 'crack' the crystal's lit crack · 'none'
  pool:0.65,               // the pool's size (× the hex)   ✎ Alex
  poolGlow:0.55,   // ✎ Alex
  ripple:0.5,            // a slow ring spreading out over the stone, like sound off a speaker (0 = off)   ✎ Alex
  rippleS:2.4,            // seconds per ring
  // ── the moments ──
  orbSparks:22,
  // 🌫️ Alex 2026-10-10: "instead of the notes 'drifting' from hex to hex - they should
  // 'dissipate' and rise up from the stage as it shows in the beginning". 'rise' = the
  // old ball dissipates upward, then the new one rises out of the stage like a spawn.
  // 'stream' = the crystal's drift (motes stream low across the floor). Balls only.
  driftStyle:'rise',           // the pickup bursts into sparks, not shards
});

const TAU = Math.PI * 2;
const WHITE = new THREE.Color('#ffffff');
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const span = (u, a, b) => clamp01((u - a) / Math.max(1e-6, b - a));
const easeOutBack = (x, s = 1.9) => { x = clamp01(x) - 1; return 1 + (s + 1) * x * x * x + s * x * x; };
const fract = x => x - Math.floor(x);
const additive = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent:true, opacity,
  depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide });

/** The shell: brightest at the silhouette. Additive, so `alpha` is its whole strength. */
function hazeMaterial(color, rim, fill) {
  return new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false,
    uniforms:{ color:{ value:color }, rim:{ value:rim }, fill:{ value:fill }, alpha:{ value:1 } },
    vertexShader:`varying vec3 vN; varying vec3 vE;
      void main(){ vec4 p = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vE = normalize(-p.xyz); gl_Position = projectionMatrix * p; }`,
    fragmentShader:`uniform vec3 color; uniform float rim, fill, alpha; varying vec3 vN; varying vec3 vE;
      void main(){ float f = 1. - abs(dot(normalize(vN), normalize(vE)));
        float a = (fill + rim * pow(f, 2.4)) * alpha; if (a < .003) discard; gl_FragColor = vec4(color, a); }`,
  });
}

/** The glitter, depth-tested (see the header). */
function glitterFor(capacity, tint, order) {
  const g = createSpiralGlitter(null, { capacity, tint });
  g.points.material.depthTest = true;
  for (const s of g.spines) s.material.depthTest = true;
  // ⚠️ UNDER THE NOTE. The shared glitter draws at renderOrder 148, AFTER the note
  // sprite (70), and additively — top-down it washed the letter out (headless 10-10).
  g.points.renderOrder = order; for (const s of g.spines) s.renderOrder = order - 1;
  return g;
}

/**
 * The parts of an energy ball, built and animated for `createLostChords`.
 * @param moteTex the soft round dot the crystal's motes use (also the heart and the pool)
 */
export function createOrbKit({ moteTex }) {
  const geos = {};
  // A unit-diameter sphere of helix stations: the riff ball's `coreStations`, halved.
  const ballStations = createHelixStations(40);
  ballStations.forEach((s, i) => {
    const y = -0.46 + 0.92 * i / (ballStations.length - 1);
    s.center.set(0, y, 0); s.across.set(1, 0, 0); s.up.set(0, 0, 1);
    s.radius = Math.sqrt(Math.max(0, 0.47 * 0.47 - y * y));
  });
  const from = new THREE.Vector3(), to = new THREE.Vector3();

  const kit = {
    /** (Re)build the shared geometry. `hoopWidth` is the only lever that needs it. */
    build(L) {
      kit.disposeGeos();
      geos.haze = new THREE.SphereGeometry(0.47, 32, 20);
      geos.hoop = new THREE.TorusGeometry(0.5, Math.max(0.002, L.hoopWidth), 6, 72);
      geos.hot = new THREE.TorusGeometry(0.5, Math.max(0.0015, L.hoopWidth * 0.3), 4, 72);
      geos.pool = new THREE.CircleGeometry(0.95, 48).rotateX(-Math.PI / 2);
      geos.ripple = new THREE.RingGeometry(0.86, 0.95, 64).rotateX(-Math.PI / 2);
      geos.spark = new THREE.OctahedronGeometry(0.055, 0).scale(0.7, 1.7, 0.7);
      geos.burst = new THREE.SphereGeometry(0.5, 20, 12);
    },
    shared() { return Object.values(geos); },
    /** The pickup's flash: a rim-lit shell that blows outward. ⚠️ Not a filled sphere —
     *  that read as a flat salmon disc over his head (headless 10-10). */
    burstMaterial(col) { return hazeMaterial(col.clone().multiplyScalar(1.8), 1.5, 0.03); },
    get sparkGeo() { return geos.spark; },
    get burstGeo() { return geos.burst; },
    disposeGeos() { for (const g of Object.values(geos)) g?.dispose(); },

    /** Build one ball's parts into the token's groups. */
    dress(t, P, col, L) {
      const O = P.orb = { hoops:[] };
      // ── floor ──
      if (L.orbFloor === 'pool') {
        O.pool = new THREE.Mesh(geos.pool, new THREE.MeshBasicMaterial({ map:moteTex, color:col.clone().multiplyScalar(L.poolGlow), transparent:true,
          depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false, polygonOffset:true, polygonOffsetFactor:-2 }));
        O.pool.position.y = L.floorY + 0.006; O.pool.renderOrder = 58; t.floor.add(O.pool);
      }
      if (L.orbFloor !== 'none' && L.ripple > 0) {
        O.ripple = new THREE.Mesh(geos.ripple, additive(col.clone().multiplyScalar(1.5), 0));
        O.ripple.position.y = L.floorY + 0.008; O.ripple.renderOrder = 58; t.floor.add(O.ripple);
      }
      // ── the ball (in t.spin, which is scaled to `orbSize`) ──
      O.haze = new THREE.Mesh(geos.haze, hazeMaterial(col.clone().multiplyScalar(L.hazeGlow), L.hazeRim, L.hazeFill));
      O.haze.renderOrder = 60; t.spin.add(O.haze);
      const hotCol = col.clone().lerp(WHITE, 0.35).multiplyScalar(L.hoopGlow * 1.3);
      for (let i = 0; i < L.hoops; i++) {
        const pivot = new THREE.Group();
        const soft = new THREE.Mesh(geos.hoop, additive(col.clone().multiplyScalar(L.hoopGlow), L.hoopOpacity));
        soft.renderOrder = 63; pivot.add(soft);
        if (L.hotBand > 0) { const hot = new THREE.Mesh(geos.hot, additive(hotCol, L.hoopOpacity * L.hotBand)); hot.renderOrder = 64; pivot.add(hot); }
        pivot.userData.k = 0.77 + (i % 4) * 0.075;   // the riff ball's nesting
        t.spin.add(pivot); O.hoops.push(pivot);
      }
      if (L.heart > 0) {
        O.heart = new THREE.Sprite(new THREE.SpriteMaterial({ map:moteTex, color:col.clone().lerp(WHITE, 0.25).multiplyScalar(L.heartGlow),
          transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
        O.heart.renderOrder = 62; t.spin.add(O.heart);
      }
      const tint = col.clone().lerp(WHITE, 0.15);
      O.glitter = glitterFor(1400, tint, 61); O.glitter.group.name = 'Lost Chord ball glitter'; t.spin.add(O.glitter.group);
      // ── the feed (in t.top: world-up and unscaled, so it can reach the floor) ──
      if (L.feed > 0) {
        O.feed = glitterFor(1000, tint, 59); O.feed.group.name = 'Lost Chord energy feed'; t.top.add(O.feed.group);
        O.feedStations = createHelixStations(24);
      }
    },

    /** Take a ball's parts down (before the generic strip, which handles the meshes). */
    strip(P) {
      const O = P?.orb; if (!O) return;
      O.glitter?.dispose(); O.feed?.dispose(); P.orb = null;
    },

    /**
     * One frame of a ball.
     * @param s { tSec, glow, scale, crack, feed, vis, reduced, spawnU, y, hum }
     */
    frame(t, P, L, s) {
      const O = P.orb; if (!O) return;
      const motion = s.reduced ? 0 : s.tSec, live = s.vis && s.scale > 0.02;
      O.haze.material.uniforms.alpha.value = Math.min(1.6, s.glow);
      O.hoops.forEach((p, i) => {
        const sign = i % 2 ? 1 : -1, rate = (0.16 + (i % 5) * 0.087) * L.hoopSpin;
        // Independent tilted axes, directions and speeds — the riff ball's own formula.
        p.rotation.set(i * 0.71 + motion * rate * sign, i * 1.17 + motion * rate * 0.63, i * 0.43 + motion * rate * 0.37 * sign);
        // ⚡ On spawn the hoops snap on one after another, so the ball WINDS UP.
        const k = s.spawnU < 1 ? Math.max(0.0001, easeOutBack(span(s.spawnU, 0.34 + i * 0.05, 0.7 + i * 0.05))) : 1;
        p.scale.setScalar(p.userData.k * k);
        for (const m of p.children) m.material.opacity = (m.renderOrder === 64 ? L.hotBand : 1) * L.hoopOpacity * Math.min(1.4, 0.75 + 0.25 * s.glow);
      });
      if (O.heart) { O.heart.scale.setScalar(L.heart * (0.85 + 0.15 * s.glow)); O.heart.material.opacity = Math.min(1, 0.8 * s.glow); }
      O.glitter.update(motion, { ...SONIC_GLITTER, turns:L.glitterTurns, strands:L.glitterStrands, density:L.glitter, size:L.glitterSize,
        brightness:L.glitterGlow * Math.min(1.4, s.glow), twinkle:L.twinkle, spin:L.glitterSpin, flow:L.glitterFlow, filament:L.filament, iridescence:L.iridescence },
        { stations:ballStations, reduced:s.reduced, enabled:live && L.glitterGlow > 0, opacity:1 });
      if (O.feed) {
        // From the pool at the hex's centre up to the ball's underside. ⚠️ In t.top's
        // space: the float can be off-centre mid-scatter, so it uses the float's x/z.
        const fx = t.float.position.x, fz = t.float.position.z;
        from.set(fx, L.floorY + 0.02, fz);
        const top = s.y - L.orbSize * Math.max(0, s.scale) * 0.38;
        to.set(fx, from.y + Math.max(0, top - from.y) * clamp01(s.feed), fz);
        const on = s.vis && s.feed > 0.01 && to.y - from.y > 0.06;
        if (on) writeHelixStations(O.feedStations, from, to, L.feedWidth, 0.45);
        O.feed.update(motion, { ...SONIC_GLITTER, turns:L.feedTurns, strands:2, radius:0.7, spread:0.12, density:L.feedDensity, size:L.glitterSize * 0.85,
          brightness:Math.min(1.5, L.feed * clamp01(s.feed) * Math.min(1.3, s.glow)), twinkle:L.twinkle, spin:0.3, flow:L.feedFlow, filament:0.06, iridescence:L.iridescence },
          { stations:O.feedStations, reduced:s.reduced, enabled:on, opacity:1 });
      }
      if (O.pool) { O.pool.material.opacity = Math.min(1, s.crack * (0.7 + 0.3 * s.glow)); O.pool.scale.setScalar(L.pool * Math.max(0.0001, 0.35 + 0.65 * s.crack)); }
      if (O.ripple) {
        if (s.reduced) { O.ripple.material.opacity = 0; }
        else {
          // A slow ring off the pool, like sound off a speaker; a hum sends a quicker, brighter one.
          const k = fract(s.tSec / Math.max(0.3, L.rippleS) + t.num * 0.37);
          O.ripple.scale.setScalar(L.pool * (0.3 + k * 1.1));
          O.ripple.material.opacity = L.ripple * (1 + s.hum * 1.5) * s.crack * Math.min(1, k * 6) * (1 - k) ** 1.5;
        }
      }
    },

    dispose() { kit.disposeGeos(); },
  };
  return kit;
}
