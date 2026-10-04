import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createArenaEnvironment, polishArenaModel } from '../../src/board/arenaEnvironment.js';
import { createRivenWorld } from '../../src/board/rivenWorld/index.js';
import { disposeObject } from '../../src/board/rivenWorld/formation.js';
import { createArenaCrowd } from '../../src/board/arenaCrowd.js';
import { createStandee, STANDEE, standeeYaw } from '../../src/board/standee.js';
import { grandstandPlacement } from '../../src/board/cosmicFans.js';
import { HEX_BY_NUM } from '../../src/board/hexMap.js';
import { CORNERS, playerColor } from '../../src/data/corners.js';
import { SPIRIT_DEFS } from '../../src/data/spirits.js';
import { cornersForCount, seatSpirit } from '../../src/data/matchSetup.js';
import { seatId } from '../../src/data/spiritIdentity.js';
import { CHARACTERS, clamp, smooth, introEnd, seatState, entranceDuration, turnStart } from './timeline.js';
import { createBardbarian } from './bardbarian.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true,
  opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });

export function createIntroScene(host, { onReady, onError }) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#030511');
  const camera = new THREE.PerspectiveCamera(43, 1, .15, 500);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .65, .7, .9);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  const environment = createArenaEnvironment(scene, { classicScenery: false });
  const world = createRivenWorld(scene, camera), crowd = createArenaCrowd(scene);
  const actors = [], pads = [], effects = new THREE.Group(); scene.add(effects);
  const actorLight = new THREE.DirectionalLight('#c7d9ff', 2.4); actorLight.position.set(0, 15, 20); scene.add(actorLight);
  let disposed = false, model = null, emissives = [], count = 0, crowdKey = '', assetsReady = false;
  const manager = new THREE.LoadingManager();
  manager.onLoad = () => { if (!disposed) { assetsReady = true; onReady?.(); } };
  manager.onError = url => { if (!disposed) onError?.(`Could not load ${url.split('/').pop()}. Reload to retry.`); };
  const loader = new THREE.TextureLoader(manager);
  const god = createBardbarian(loader); scene.add(god.group);
  const texture = url => { const t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const resize = () => {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); composer.setSize(w, h);
  };
  const observer = new ResizeObserver(resize); observer.observe(host); resize();
  const lost = e => { e.preventDefault(); onError?.('The graphics context was lost. Reload to restart the scene.'); };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  new GLTFLoader(manager).load(`${import.meta.env.BASE_URL}cosmic-arena/cosmic-arena.glb`, gltf => {
    if (disposed) { disposeObject(gltf.scene); return; }
    model = gltf.scene; model.scale.z = -1; emissives = polishArenaModel(model);
    world.attachModel(model); const oldStands = model.getObjectByName('Stands'); if (oldStands) oldStands.visible = false;
    scene.add(model);
  }, undefined, () => onError?.('The arena could not load. Reload to retry.'));

  function clearSeats() {
    for (const a of actors) { a.standee.group.removeFromParent(); a.standee.dispose(); }
    actors.length = 0;
    for (const p of pads) { p.removeFromParent(); disposeObject(p); } pads.length = 0;
    // disposeObject removes its root: dispose children, keeping the reusable
    // effects group attached when the player-count control rebuilds the seats.
    for (const child of [...effects.children]) disposeObject(child);
    crowdKey = '';
  }
  function setSeats(n) {
    if (n === count) return; count = n; clearSeats();
    cornersForCount(n).forEach((corner, i) => {
      const id = CHARACTERS[i], def = SPIRIT_DEFS[id], sp = seatSpirit(def, corner);
      const h = HEX_BY_NUM[CORNERS[corner].homeNum], home = v((h.px - 3255) / 200, .2, (h.py - 2415) / 200);
      const stand = grandstandPlacement(corner).position;
      const waiting = home.clone().lerp(stand, .47).setY(.22);
      const standee = createStandee({ ...sp, id: seatId(id, corner) }, { loader: texture, T: { ...STANDEE, bob: .015 } });
      scene.add(standee.group);
      const pad = new THREE.Group(); pad.position.copy(waiting); scene.add(pad); pads.push(pad);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(.87, 1.03, .16, 6), new THREE.MeshStandardMaterial({
        color: '#131a32', metalness: .65, roughness: .36, emissive: sp.color, emissiveIntensity: .16 }));
      plate.position.y = -.09; pad.add(plate);
      const edge = new THREE.Mesh(new THREE.TorusGeometry(.89, .018, 5, 6), glow(sp.color, .8));
      edge.rotation.x = Math.PI / 2; pad.add(edge);
      const homeRing = new THREE.Mesh(new THREE.RingGeometry(.73, .81, 6).rotateX(-Math.PI / 2), glow(sp.color, .48));
      homeRing.position.copy(home).add(v(0, .015, 0)); effects.add(homeRing);
      const impactRings = Array.from({ length: 3 }, () => {
        const ring = new THREE.Mesh(new THREE.RingGeometry(.7, .75, 64).rotateX(-Math.PI / 2), glow(sp.color, 0));
        ring.position.copy(waiting).add(v(0, .06, 0)); effects.add(ring); return ring;
      });
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.055, .62, 1, 12, 1, true), glow(sp.color, 0));
      effects.add(shaft);
      const particles = new Float32Array(70 * 3), geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
      const shards = new THREE.Points(geometry, new THREE.PointsMaterial({ color: sp.color, size: .08, transparent: true,
        opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      effects.add(shards);
      actors.push({ standee, home, waiting, sp, pad, edge, impactRings, shaft, shards, homeRing });
    });
  }
  setSeats(4);

  return {
    setSeats,
    frame(t, s) {
      if (disposed) return [];
      setSeats(s.players);
      const end = introEnd(s), reduced = s.reduced;
      environment.update(t, { lite: true, reduced }); world.update(t, { reduced });
      const bolts = scene.getObjectByName('Transient branching lightning'); if (bolts) bolts.visible = false;
      god.update(t, s, end);
      const states = actors.map((a, i) => seatState(i, t, s));
      const key = states.map(st => st.fans).join('/');
      if (key !== crowdKey) {
        crowdKey = key;
        crowd.update(actors.map((a, i) => ({ id: a.sp.id, corner: a.sp.corner, color: a.sp.color, diehards: states[i].fans, casuals: 0 })));
      }
      crowd.tick(t, { reduced });
      let shake = 0;
      actors.forEach((a, i) => {
        const st = states[i], age = st.impactAge, landing = age >= 0 && age < 1;
        const group = a.standee.group;
        group.visible = st.visible;
        group.position.copy(a.waiting).lerp(a.home, st.progress);
        const bounce = reduced ? 0 : landing ? Math.sin(clamp(age / .6) * Math.PI) * .28 * Math.exp(-age * 4) : 0;
        const hop = reduced ? 0 : Math.sin(st.progress * Math.PI) * .48;
        group.position.y += st.fall + bounce + hop;
        // Real game facing on arrival. During the riff, turn to present the print.
        const finalYaw = standeeYaw(a.sp.facing), performYaw = Math.atan2(camera.position.x - a.waiting.x, camera.position.z - a.waiting.z);
        const turn = smooth((t - st.start) / .55) * (1 - st.progress);
        group.rotation.y = finalYaw + Math.atan2(Math.sin(performYaw - finalYaw), Math.cos(performYaw - finalYaw)) * turn;
        group.rotation.z = reduced ? 0 : landing ? Math.sin(age * 24) * .075 * Math.exp(-age * 5) : 0;
        if (!reduced && t >= st.start && t < st.stepStart) group.rotation.z = Math.sin((t - st.start) * 9) * .025;
        const squash = reduced || !landing ? 0 : Math.exp(-age * 18) * .17;
        group.scale.set(1 + squash, 1 - squash, 1 + squash);
        a.standee.frame(t, { reduced, cameraPos: camera.position, acting: t >= st.start && !st.entered, lift: st.fall + hop });
        a.edge.material.opacity = st.entered ? .12 : .65;
        a.homeRing.material.opacity = st.entered ? .12 : t >= st.start ? .8 : .25;
        a.impactRings.forEach((ring, k) => {
          const u = age - k * .1; ring.visible = !reduced && u >= 0 && u < 1;
          ring.scale.setScalar(1 + Math.max(0, u) * (3.3 + k * .8) * s.impact);
          ring.material.opacity = clamp(1 - u) * (.55 - k * .12);
        });
        a.shaft.visible = !reduced && age > -.8 && age < .15;
        a.shaft.position.copy(a.waiting).add(v(0, 8 + Math.max(0, st.fall) / 2, 0));
        a.shaft.scale.y = 16 + st.fall;
        a.shaft.material.opacity = Math.max(0, .25 * (1 - Math.abs(age + .25) / .55));
        a.shards.visible = !reduced && age >= 0 && age < 1.5;
        a.shards.material.opacity = clamp(1 - age / 1.5);
        if (a.shards.visible) {
          const pos = a.shards.geometry.attributes.position;
          for (let j = 0; j < pos.count; j++) {
            const angle = j * 2.39996, speed = (.4 + (j % 11) * .21) * s.impact;
            pos.setXYZ(j, a.waiting.x + Math.cos(angle) * age * speed,
              a.waiting.y + Math.max(0, age * (1.1 + j % 7 * .24) - age * age * 2),
              a.waiting.z + Math.sin(angle) * age * speed);
          }
          pos.needsUpdate = true;
        }
        if (landing) shake += Math.exp(-age * 7) * s.shake;
      });
      emissives.forEach(e => { e.material.emissiveIntensity = e.base * .72; });
      // Wide establishing shot, then gently meet each player's first turn.
      const boardBlend = s.camera === 'board' ? 1 : s.camera === 'wide' || reduced ? 0 : smooth((t - end + 1.2) / 3);
      const aspectPad = Math.max(1, 1.6 / camera.aspect);
      const wide = v(0, 22, 57).multiplyScalar(aspectPad), close = v(0, 23, 29).multiplyScalar(aspectPad);
      camera.position.copy(wide).lerp(close, boardBlend);
      const target = v(0, 8.5, -3).lerp(v(0, .5, 0), boardBlend);
      if (s.camera === 'cinematic' && !reduced && t >= end) {
        for (let i = 0; i < count; i++) {
          const start = turnStart(i, s), hold = entranceDuration(CHARACTERS[i]);
          const focus = smooth((t - start) / 1.1) * (1 - smooth((t - start - hold + .3) / 1.2));
          camera.position.addScaledVector(actors[i].waiting, focus * .28);
          target.addScaledVector(actors[i].waiting, focus * .25);
        }
      }
      if (!reduced) { camera.position.x += Math.sin(t * 61) * shake * .24; camera.position.y += Math.sin(t * 53) * shake * .13; }
      camera.lookAt(target);
      bloom.strength = s.bloom; renderer.toneMappingExposure = s.exposure;
      composer.render();
      return states.map((st, i) => {
        const p = actors[i].standee.group.position.clone().add(v(0, 3.3, 0)).project(camera);
        return { ...st, name: actors[i].sp.name, color: playerColor(actors[i].sp.corner),
          x: (p.x + 1) * host.clientWidth / 2, y: (1 - p.y) * host.clientHeight / 2 };
      });
    },
    diagnostics() { return { model: !!model, assetsReady, actors: actors.length, fans: crowd.count, calls: renderer.info.render.calls }; },
    dispose() {
      if (disposed) return; disposed = true; observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      clearSeats(); god.dispose(); crowd.dispose(); world.dispose(); environment.dispose(); disposeObject(scene);
      composer.passes.forEach(p => p.dispose?.()); composer.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
