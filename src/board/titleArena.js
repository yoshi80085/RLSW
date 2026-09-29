import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createArenaEnvironment, polishArenaModel } from './arenaEnvironment.js';
import { createRivenWorld } from './rivenWorld/index.js';
import { disposeObject } from './rivenWorld/formation.js';
import { createArenaCrowd } from './arenaCrowd.js';
import { playerColor } from '../data/corners.js';

// ─── 🌌 THE TITLE-SCREEN ARENA ──────────────────────────────────────────────
// Alex, 2026-09-29: *"have the screen show the 3D Cosmic arena from afar —
// slowly rotating off in the distance"*. The SAME arena the match renders —
// the real GLB, the Riven World formation, nebula and lightning, the four
// corner spotlights on their decorative sweep — seen through a long lens on
// a slow orbit, pushed to the right of the frame so the menu column on the
// left has open sky to sit on.
//
// 🎛️ DIALLED IN by Alex on `.scratch/title-arena-preview.html` (published as the
// "Title Arena Dial-in" artifact), 2026-09-29 08:03. Changed from the preview's
// defaults: distance 105→84, fov 26→33, elevation 15→13, targetY −3.5→−4,
// bloom .54→.5, exposure 1→1.45. Every other value below he saw and left.
// 📌 The preview imports THIS file — tune there first, then copy the numbers here.
//
// ⚠️ PRESENTATION ONLY. No engine import, no match state, no RNG: the crowd
// is a fixed decorative seating, and every seed below is local.
//
// 🎯 Why a lens shift and not an off-centre target: `setViewOffset` slides the
// picture sideways WITHOUT turning the camera, so the arena keeps its
// straight-on, centred perspective while it sits at 70% of the screen width.
// Aiming the camera off-centre instead makes the arena swing across the frame
// as it orbits — the one thing a slow title turntable must not do.

export const TITLE_ARENA = Object.freeze({
  distance: 84,      // world units from the arena's centre — "from afar"
  fov: 33,           // a long lens flattens it: far away, not just small
  elevation: 13,     // degrees above the deck
  targetY: -4,       // aim point height; the formation hangs ~13 below the deck
  spin: 2.4,         // degrees per second — one lap every 2½ minutes
  direction: 1,      // 1 = counter-clockwise from above, -1 = clockwise
  startAngle: 35,    // degrees; where the turn begins on each visit
  bob: 0.6,          // world units of slow vertical drift (the old island's float)
  shiftX: 0.2,       // lens shift, fraction of width (+ = arena right of centre)
  shiftY: 0.02,      // lens shift, fraction of height (+ = arena higher)
  bloom: 0.5,        // a touch under the match's RIVEN_WORLD.bloom (.54)
  exposure: 1.45,    // brighter than a match: the arena is small on screen and far off
  fans: 14,          // diehards per corner stand, lit in the four player colours
  lightning: true,
  spotlights: true,
  fadeInMs: 1800,    // the canvas fades up once the model is on screen
  fps: 60,           // cap; 30 halves the cost but a slow turn can judder
});

const FAN_CORNERS = ['blue', 'purple', 'yellow', 'red'];

/**
 * Mount the turntable into `host` (absolutely filled). Returns
 * `{ set(look), dispose(), diagnostics() }`.
 * `modelUrl` defaults to the match's own GLB under Vite's BASE_URL. `modelData`
 * (an ArrayBuffer of the same file) wins when given; the previews use it.
 */
export function mountTitleArena(host, { modelUrl = null, modelData = null, look = TITLE_ARENA, onReady, onError } = {}) {
  const cleanups = [];
  let disposed = false, failed = false, raf = 0, model = null, emissives = [];
  let settings = { ...TITLE_ARENA, ...look };
  const dispose = () => {
    if (disposed) return; disposed = true; cancelAnimationFrame(raf);
    for (const c of cleanups.reverse()) { try { c(); } catch { /* keep tearing down */ } }
  };
  try {
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#030611');
    const camera = new THREE.PerspectiveCamera(settings.fov, 1, .5, 600);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
    Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%',
      opacity: '0', transition: `opacity ${settings.fadeInMs}ms ease-out`, pointerEvents: 'none' });
    renderer.domElement.dataset.titleArena = 'loading';
    host.appendChild(renderer.domElement);
    cleanups.push(() => { disposeObject(scene); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); });

    const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), settings.bloom, .65, 1.05);
    const output = new OutputPass(); composer.addPass(bloom); composer.addPass(output);
    cleanups.push(() => { bloom.dispose(); output.dispose(); composer.dispose(); });

    // classicScenery:false — the Riven World owns the sky and the debris, as in a match.
    const environment = createArenaEnvironment(scene, { classicScenery: false }); cleanups.push(() => environment.dispose());
    const rivenWorld = createRivenWorld(scene, camera); cleanups.push(() => rivenWorld.dispose());
    const crowd = createArenaCrowd(scene); crowd.group.visible = false; cleanups.push(() => crowd.dispose());
    const lightningGroup = () => scene.getObjectByName('Transient branching lightning');
    const spotRoot = scene.getObjectByName('Cosmic environment');
    const spotParts = spotRoot ? spotRoot.children.filter(o => o.isSpotLight || (o.isMesh && o.geometry?.type === 'CircleGeometry')
      || (o.isMesh && o.geometry?.type === 'ConeGeometry')) : [];

    let fansKey = '';
    function applyFans() {
      const n = Math.max(0, Math.round(settings.fans));
      const key = String(n); if (key === fansKey) return; fansKey = key;
      // 📌 Decorative seating: no ids, so no stand ever "belongs" to a Spirit.
      crowd.update(n ? FAN_CORNERS.map(corner => ({ corner, color: playerColor(corner), diehards: n, casuals: Math.round(n / 2) })) : []);
    }

    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reduced = !!media?.matches;
    const motion = () => { reduced = !!media?.matches; };
    media?.addEventListener?.('change', motion); cleanups.push(() => media?.removeEventListener?.('change', motion));

    let width = 1, height = 1;
    function frameLens() {
      camera.fov = settings.fov; camera.aspect = width / height;
      // ⚠️ The SIGN: a positive view offset moves the window right, which moves
      // the picture LEFT. Negate so + means "arena to the right".
      camera.setViewOffset(width, height, -settings.shiftX * width, settings.shiftY * height, width, height);
      camera.updateProjectionMatrix();
    }
    function resize() {
      const r = host.getBoundingClientRect(); if (!r.width || !r.height) return;
      width = r.width; height = r.height;
      renderer.setSize(width, height, false); composer.setSize(width, height); frameLens();
    }
    const observer = new ResizeObserver(resize); observer.observe(host); cleanups.push(() => observer.disconnect());
    resize();

    let angle = settings.startAngle * Math.PI / 180, elapsed = 0, lastDraw = performance.now(), frames = 0, shown = false;
    const target = new THREE.Vector3();
    function place() {
      const el = settings.elevation * Math.PI / 180, bob = reduced ? 0 : Math.sin(elapsed * (2 * Math.PI / 11)) * settings.bob;
      target.set(0, settings.targetY, 0);
      camera.position.set(Math.cos(el) * Math.cos(angle), Math.sin(el), Math.cos(el) * Math.sin(angle))
        .multiplyScalar(settings.distance).add(target); camera.position.y += bob;
      camera.lookAt(target);
    }
    function render(now) {
      if (disposed || failed) return;
      raf = requestAnimationFrame(render);
      if (document.hidden) return;
      if (now - lastDraw < 1000 / settings.fps - 1) return;
      const step = (now - lastDraw) / 1000; lastDraw = now;
      if (!reduced) { elapsed += Math.min(.1, step); angle += settings.direction * settings.spin * Math.PI / 180 * Math.min(.1, step); }
      try {
        place();
        environment.update(elapsed, { reduced });
        rivenWorld.update(elapsed, { reduced });
        // ⚠️ Lightning off HIDES the bolts rather than passing `reduced`, which
        // would also freeze the nebula's drift and breathing.
        const bolt = lightningGroup(); if (bolt && !settings.lightning) bolt.visible = false;
        for (const o of spotParts) o.visible = settings.spotlights;
        crowd.tick(elapsed, { reduced });
        for (const e of emissives) if (e.crack) e.material.emissiveIntensity = e.base * (reduced ? 1 : 1 + .08 * Math.sin(elapsed * .75));
        bloom.strength = settings.bloom; renderer.toneMappingExposure = settings.exposure;
        composer.render(); frames++;
        if (model && !shown && frames > 2) { shown = true; renderer.domElement.style.opacity = '1'; renderer.domElement.dataset.titleArena = 'ready'; onReady?.(); }
      } catch (error) { failed = true; cancelAnimationFrame(raf); console.error('Title arena stopped', error); onError?.(error); }
    }
    const lost = e => { e.preventDefault(); failed = true; cancelAnimationFrame(raf); onError?.(new Error('WebGL context lost')); };
    renderer.domElement.addEventListener('webglcontextlost', lost);
    cleanups.push(() => renderer.domElement.removeEventListener('webglcontextlost', lost));

    const onModel = gltf => {
      if (disposed) { disposeObject(gltf.scene); return; }
      try {
        model = gltf.scene; model.scale.z = -1; emissives = polishArenaModel(model);
        rivenWorld.attachModel(model);
        // Same as the match: the fan grandstands own the seats.
        const oldStands = model.getObjectByName('Stands'); if (oldStands) oldStands.visible = false;
        scene.add(model); crowd.group.visible = true; applyFans();
      } catch (error) { failed = true; console.error('Title arena model setup failed', error); onError?.(error); }
    };
    const onModelError = error => { if (!disposed) { failed = true; console.error('Title arena model failed to load', error); onError?.(error); } };
    // ⚠️ `modelData` (the GLB's bytes) is for pages that may not fetch() at all —
    // a published Artifact's CSP blocks fetch even of a data: URL, so the preview
    // hands the bytes over and they are parsed in place. The game passes `modelUrl`.
    if (modelData) new GLTFLoader().parse(modelData, '', onModel, onModelError);
    else new GLTFLoader().load(modelUrl ?? `${import.meta.env?.BASE_URL ?? '/'}cosmic-arena/cosmic-arena.glb`, onModel, undefined, onModelError);
    raf = requestAnimationFrame(render);

    return {
      set(next) {
        const fadeChanged = next.fadeInMs != null && next.fadeInMs !== settings.fadeInMs;
        // ⚠️ Only a CHANGED start angle re-seats the turn: the preview hands the
        // whole look over on every lever and every resize, and re-seating then
        // would snap the arena back to its start each time anything moved.
        const restart = next.startAngle != null && next.startAngle !== settings.startAngle;
        settings = { ...settings, ...next };
        if (restart) angle = settings.startAngle * Math.PI / 180;
        if (fadeChanged) renderer.domElement.style.transition = `opacity ${settings.fadeInMs}ms ease-out`;
        frameLens(); if (model) applyFans();
      },
      /** Replays the entrance: hides the canvas and fades it back up. */
      replayFade() { renderer.domElement.style.transition = 'none'; renderer.domElement.style.opacity = '0';
        void renderer.domElement.offsetWidth; renderer.domElement.style.transition = `opacity ${settings.fadeInMs}ms ease-out`;
        renderer.domElement.style.opacity = shown ? '1' : '0'; },
      diagnostics() { return { loaded: !!model, shown, fans: crowd.count, angle: angle * 180 / Math.PI, calls: renderer.info.render.calls }; },
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
