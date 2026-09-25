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

   ⭐ THE FIX IS A COPY, NOT A RE-DRAW. The camera never goes below the board
   (maxPolarAngle 0.43π), and the SVG is a flat plane at board height, so
   ANYTHING standing on the board is in front of it on every pixel they share.
   So, on the foreground canvas above the SVG, those objects are drawn again as
   silhouettes that paint the arena canvas's OWN finished pixel at that spot
   (`gl_FragCoord` → the arena canvas as a texture). Lighting, bloom, depth of
   field and tone mapping are already in that pixel — nothing is lit twice, so
   the copy cannot drift from the original. The silhouettes also write depth,
   so a standee behind an amp is now hidden by it (it used to draw over it).

   📌 What counts as solid is decided per mesh, every frame (so a die created
   mid-battle or a fan added to a stand joins at once): Meshes only — never
   Sprites, glows (additive) or faint things (opacity < 0.5), and never a
   texture card with a clear background (a dice label), whose whole rectangle
   would otherwise hide the hexes around its letters. */
export const SOLID_LAYER = 1;

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
 * @param renderer the arena's WebGL renderer (its canvas is the source pixel)
 * @param foreground the transparent canvas above the SVG
 */
export function createSolidLayer({ renderer, foreground }) {
  const source = new THREE.CanvasTexture(renderer.domElement);
  // ⚠️ The pixel is already display-ready (sRGB, tone mapped): no decode on the
  // way in, no encode on the way out, no filtering — a 1:1 copy.
  source.colorSpace = THREE.NoColorSpace;
  source.minFilter = source.magFilter = THREE.NearestFilter;
  source.generateMipmaps = false;
  const uniforms = { uSolidSource: { value: source }, uSolidSize: { value: new THREE.Vector2(1, 1) } };
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = 'uniform sampler2D uSolidSource;\nuniform vec2 uSolidSize;\n' + shader.fragmentShader
      .replace('#include <dithering_fragment>', 'gl_FragColor = vec4(texture2D(uSolidSource, gl_FragCoord.xy / uSolidSize).rgb, 1.0);');
  };
  material.customProgramCacheKey = () => 'rlsw-solid-layer';
  return {
    material,
    /** Draw the silhouettes onto the (already cleared) foreground canvas. */
    render(scene, camera) {
      const canvas = renderer.domElement;
      if (!canvas.width || !canvas.height) return;
      uniforms.uSolidSize.value.set(canvas.width, canvas.height);
      source.needsUpdate = true;
      const { background, environment, overrideMaterial, matrixWorldAutoUpdate } = scene, mask = camera.layers.mask;
      // The arena pass has just updated every world matrix; don't walk them twice.
      scene.background = null; scene.environment = null; scene.overrideMaterial = material; scene.matrixWorldAutoUpdate = false;
      camera.layers.set(SOLID_LAYER);
      try { foreground.render(scene, camera); }
      finally {
        scene.background = background; scene.environment = environment; scene.overrideMaterial = overrideMaterial;
        scene.matrixWorldAutoUpdate = matrixWorldAutoUpdate;
        camera.layers.mask = mask;
      }
    },
    dispose() { source.dispose(); material.dispose(); },
  };
}
