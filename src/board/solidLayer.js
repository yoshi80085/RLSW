import * as THREE from 'three';

/* 🧱 THE SOLID LAYER — amps, fans and dice sit ABOVE the board, always.
   (Alex, 2026-09-24: "Make sure amps, fans, and dice are a separate and solid
   layer of their own — some of the spaces seem to 'shine' through them".)

   ⚠️ WHY THE SPACES SHONE THROUGH. The arena is three layers stacked in the
   page, not one picture: the WebGL arena (z 0), the board's SVG on a CSS3D
   plane (z 1 — the real click surface, with every hex tint, target cone and
   slime road on it) and the standees' foreground canvas (z 2). A DOM layer has
   no depth, so the SVG drew OVER every pixel of the arena it covered — and an
   amp, a stand of fans or a die standing on the board covers the hexes behind
   it on screen. Those hexes were painted on top of them. Magenta-filled hexes
   make it obvious (`.scratch/solid-layer/`, before/after renders).

   ⭐ THE FIX IS A RE-DRAW WITH THE REAL MATERIALS (2026-09-25). The camera
   never goes below the board (maxPolarAngle 0.43π) and the SVG is a flat plane
   at board height, so ANYTHING standing on the board is in front of it on every
   pixel they share. So the foreground canvas, above the SVG, draws those objects
   AGAIN — their own materials, textures, the arena's own lights and environment,
   the same tone mapping and exposure — first as depth only (so a transparent
   fan body still hides a standee behind it), then in colour.

   🪦 IT USED TO BE A PIXEL COPY, AND ON ALEX'S MACHINE IT DREW BLACK GLASS.
   2026-09-24 painted the silhouettes with the arena canvas's own finished pixel
   (a `CanvasTexture` of the other WebGL canvas, read at `gl_FragCoord`). It was
   verified in cloud Chromium, which renders on the CPU. On a real GPU the amps
   and fans came out "totally black and reflect the whole arena like … black
   glass" (Alex, 2026-09-25). Cross-context canvas uploads take a GPU fast path
   whose orientation and freshness a CPU renderer never exercises, so each
   silhouette sampled the wrong part of the arena. ⚠️ Do not bring the copy back
   without testing it on real hardware. A re-draw cannot sample the wrong place,
   because it samples nothing.
   ⚠️ What the re-draw gives up: the arena's post effects happen on the canvas
   underneath, so a solid on top is not bloomed or depth-of-field blurred. Its
   glow still spills out around it from below. It is sharp during a Sonic
   focus shot.

   📌 What counts as solid is decided per mesh, every frame (so a die created
   mid-battle or a fan added to a stand joins at once): Meshes only — never
   Sprites, glows (additive) or faint things (opacity < 0.5), and never a
   texture card with a clear background (a dice label), whose whole rectangle
   would otherwise hide the hexes around its letters. */
export const SOLID_LAYER = 1;

/* 🪨 THE GROUND IS AN OCCLUDER (Alex, 2026-09-25: *"below that is what looks
   like a 'foundation' … looks like they are kind of sitting on top of the board
   in a strange way"*). Every amp in `cosmic-arena.glb` is modelled from
   y = −0.42 up, and the Stage's top is y = 0.08: HALF A UNIT OF EVERY CABINET IS
   BURIED IN THE STAGE. In the arena pass the Stage hides it. The re-draw here
   used to know nothing about the Stage, so the buried base was painted on top
   of the board, on every amp, as a dark plinth under the bottom rim. It came in
   with this layer (2026-09-24) — the model and the stacking have not changed
   since 2026-09-08. The Stage and the Island now write DEPTH ONLY in the first
   pass, so anything they hide in the arena stays hidden here. They never draw
   colour: the board's SVG and the arena still show through where they are. */
export const OCCLUDER_LAYER = 2;

/** Mark the ground (Stage, Island) as depth-only occluders for the re-draw. */
export function markOccluders(roots) {
  let count = 0;
  for (const root of roots) root?.traverse(o => { if (o.isMesh) { o.layers.enable(OCCLUDER_LAYER); count++; } });
  return count;
}

/** Is this object something a hex should never be seen through? */
export function isSolidMesh(object) {
  if (!object?.isMesh || object.isSprite) return false;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  return materials.some(m => m && m.visible !== false && m.blending !== THREE.AdditiveBlending
    && (m.opacity ?? 1) >= .5 && !(m.transparent && m.map));
}

/** Put every solid mesh under these roots on the solid layer (and keep it on layer 0 too). */
export function markSolid(roots) {
  let count = 0;
  for (const root of roots) root?.traverse(o => {
    if (isSolidMesh(o)) { o.layers.enable(SOLID_LAYER); count++; } else o.layers.disable(SOLID_LAYER);
  });
  return count;
}

/**
 * @param renderer the arena's WebGL renderer (its tone mapping and exposure are copied)
 * @param foreground the transparent canvas above the SVG
 */
export function createSolidLayer({ renderer, foreground }) {
  // Depth only: writes the solids' depth, draws no colour. ⚠️ Pushed back a hair
  // (polygonOffset): the colour pass is a DIFFERENT shader on the same triangles,
  // and GPUs do not promise the two land on bit-identical depths. Without the
  // push, a GPU that rounds the other way fails the colour pass's depth test
  // and draws nothing — the hexes would shine through again.
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const lit = [];
  return {
    depthOnly,
    /** Draw the solids onto the (already cleared) foreground canvas. */
    render(scene, camera) {
      // 💡 Lights obey camera layers too: a light that is not on the solid layer
      // is not in the room when the foreground draws it. Unlit PBR plus the
      // environment's reflections is the black-glass look again.
      lit.length = 0;
      scene.traverse(o => { if (o.isLight && !o.layers.isEnabled(SOLID_LAYER)) { o.layers.enable(SOLID_LAYER); lit.push(o); } });
      foreground.toneMapping = renderer.toneMapping;
      foreground.toneMappingExposure = renderer.toneMappingExposure;
      const { background, overrideMaterial, matrixWorldAutoUpdate } = scene, mask = camera.layers.mask;
      // The arena pass has just updated every world matrix; don't walk them twice.
      scene.background = null; scene.matrixWorldAutoUpdate = false;
      camera.layers.set(SOLID_LAYER);
      try {
        // Depth: the solids AND the ground (🪨 above). Colour: the solids only.
        camera.layers.enable(OCCLUDER_LAYER);
        scene.overrideMaterial = depthOnly; foreground.render(scene, camera);
        camera.layers.set(SOLID_LAYER);
        scene.overrideMaterial = overrideMaterial; foreground.render(scene, camera);
      } finally {
        scene.background = background; scene.overrideMaterial = overrideMaterial;
        scene.matrixWorldAutoUpdate = matrixWorldAutoUpdate;
        camera.layers.mask = mask;
        for (const o of lit) o.layers.disable(SOLID_LAYER);
      }
    },
    dispose() { depthOnly.dispose(); },
  };
}
