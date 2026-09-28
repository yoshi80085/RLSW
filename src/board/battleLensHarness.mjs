// ─── battleLensHarness — TEST-ONLY. A bout, played headless, frame by frame ────
// (2026-09-28, the third "zooms into nothing" report.) The real arena GLB, the
// real crowd, arenaVisuals + battleDirector + sonicCamera, driven on a VIRTUAL
// clock (performance.now is replaced — never import this from the game) through
// the client's own bout timeline: the 1.6 s intro, the Rival's / attacker's
// ROLL presses, the gate, the barrage or the strike. Every frame reports where
// the lens is and what it can see: each standee's projected size and position,
// and how much of it is hidden by arena furniture or by the other standee.
// Used by `battleLensCheck.mjs`; the ad-hoc sweeps that found the bug are in
// `.scratch/battle-lens/` (`sweep.mjs`).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
let vnow = 1000; performance.now = () => vnow;
const { createArenaVisuals, arenaPoint } = await import('./arenaVisuals.js');
const { arenaFrame } = await import('./arenaFrame.js');
const { createSonicCamera } = await import('./sonicCamera.js');
const { HEX_BY_NUM, ALL_HEXES } = await import('./hexMap.js');
const { angleTo, getFlatTopNeighborSlots, neighborInDirection } = await import('./hexGeometry.js');
const { resolveSonicBarrage } = await import('../engine/systems/sonicBarrage.js');
const { scheduleSonicBarrage } = await import('./sonicPresentation.js');
const { SONIC_GATE, SONIC_DICE, BARRAGE_LAUNCH, barrageContact } = await import('./sonicBarrageTiming.js');
const { SWING_GATE, SWING_BEATS, SWING_TIMING } = await import('./swingTiming.js');
const { BATTLE_INTRO } = await import('./battleRollGate.js');
const { grandstandPlacement } = await import('./cosmicFans.js');
const { createArenaCrowd } = await import('./arenaCrowd.js');
const { HEX_BY_QR } = await import('./hexMap.js');

const bytes = readFileSync(new URL('../../public/cosmic-arena/cosmic-arena.glb', import.meta.url));
const baseModel = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;

const colors = { blue:'#62dbff', red:'#ff5a6e', yellow:'#ffd54a', purple:'#b98bff' };
export function simulate({ tiers = 5, kind = 'sonic', a, b, ca, cb, fa, fb, viewer = 'attacker', rivalWait = 0, atkWait = 0, aspect = 1.95, secs = 18, step = 1 / 30, prevCam = null }) {
  vnow = 1000;
  const model = baseModel.clone(true); model.scale.z = -1;
  const oldStands = model.getObjectByName('Stands'); if (oldStands) oldStands.visible = false; // as arenaRenderer does
  const scene = new THREE.Scene(); scene.add(model);
  const fg = new THREE.Scene();
  const visuals = createArenaVisuals(scene, { foregroundScene:fg }); visuals.attachModel(model);
  model.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(43, aspect, .1, 500);
  const controls = { target:new THREE.Vector3(1, -2.8, 0), enabled:true, enableDamping:true, update() {} };
  camera.position.set(27, 20.8, 37).add(controls.target);
  if (prevCam) { camera.position.copy(prevCam.pos); controls.target.copy(prevCam.tgt); }
  camera.lookAt(controls.target);
  const sonicCamera = createSonicCamera({ camera, controls, pointFor:arenaPoint });
  const face = (x, y) => angleTo(HEX_BY_NUM[x], HEX_BY_NUM[y]);
  const spirits = [
    { id:'a', num:a, corner:ca, color:colors[ca], facing:fa ?? face(a, b), vibe:10, maxVibe:10 },
    { id:'b', num:b, corner:cb, color:colors[cb], facing:fb ?? face(b, a), vibe:10, maxVibe:10 },
  ];
  const stack = n => ['C','E','G','B','D','F'].slice(0, n);
  const noteStates = Object.fromEntries(spirits.map(s => [s.id, { driveStack:stack(tiers), sustainStack:stack(tiers), diehards:8, casuals:12 }]));
  const crowd = createArenaCrowd(scene);
  visuals.setOccluders([crowd.group, model.getObjectByName('Lighting')]);
  let battle = null, lastFrame = {};
  const push = () => { lastFrame = arenaFrame({ spirits, noteStates, actingId:'a', turn:3, battle }); visuals.update(lastFrame); crowd.update(lastFrame.crowds); };
  push();
  const jobs = []; const T = (fn, ms) => jobs.push({ due:vnow + ms, fn });
  const mark = f => { battle = { ...battle, ...f }; push(); };
  // settle pawns
  for (let i = 0; i < 30; i++) { vnow += 33; visuals.tick(vnow / 1000, false, camera); }
  const t0 = vnow;
  if (kind === 'sonic') {
    const drive = [6, 5, 4, 3], ledger = resolveSonicBarrage(drive, 9);
    const verdict = { attackerId:'a', defenderId:'b', sonicAttack:true, sonicVersion:2, dicePool:drive.map(() => 6), diceVals:drive,
      diceHits:ledger.shots.map(s => s.through > 0), shieldValue:9, sustainPool:[6,6], sustainRolls:[5,4], hitCount:2, damage:2,
      sonicChordNotes:[0,4,7], sustainChordNotes:[0,3,7], ...ledger };
    battle = { ...verdict, sonicId:'s1', phase:'sonic_armed_rival', viewer, shots:verdict.shots.map(s => ({ ...s, at:BARRAGE_LAUNCH + barrageContact(s.index) })) };
    push();
    T(() => T(() => {
      const now = performance.now();
      mark({ sonicShieldRollAt:now, sonicRollStartedAt:now, phase:'sonic_rival_roll' });
      T(() => mark({ phase:'sonic_shield' }), SONIC_DICE.landedAt[1] * 1000);
      T(() => { mark({ phase:'sonic_armed' });
        T(() => { mark({ sonicDriveRollAt:performance.now(), phase:'sonic_roll' });
          scheduleSonicBarrage({ battle, schedule:T, phase:p => mark({ phase:p }), offset:0,
            launch:() => mark({ sonicStartedAt:performance.now() }), close:() => { mark({ phase:'sonic_aftermath' }); T(() => { battle = null; push(); }, 1500); } });
        }, atkWait);
      }, SONIC_GATE * 1000);
    }, rivalWait), BATTLE_INTRO * 1000);
  } else {
    const verdict = { attackerId:'a', defenderId:'b', swingClash:true, diceVals:[5,4,3], defenderDiceVals:[4,2,2], dicePool:[6,6,6], defenderDicePool:[6,6,6],
      atkTotal:12, defTotal:8, damage:2, tied:false, attackerWon:true };
    battle = { ...verdict, phase:'swing_attacker', swingKey:'w1', swingStartedAt:performance.now(), viewer };
    push();
    const split = SWING_BEATS.findIndex(([, n]) => n === 'swing_rival');
    T(() => {
      mark({ swingRollAt:performance.now() });
      for (const [s, v] of SWING_BEATS.slice(0, split)) T(() => mark({ phase:v }), s * 1000);
      T(() => { mark({ phase:'swing_rival' });
        T(() => { mark({ swingRivalRollAt:performance.now() });
          for (const [s, v] of SWING_BEATS.slice(split + 1)) T(() => mark({ phase:v }), (s - SWING_GATE) * 1000);
          T(() => { battle = null; push(); }, (SWING_TIMING.close - SWING_GATE) * 1000);
        }, rivalWait);
      }, SWING_GATE * 1000);
    }, BATTLE_INTRO * 1000 + atkWait);
  }
  const frames = [];
  const ray = new THREE.Raycaster();
  const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const occluders = () => { const out = []; scene.updateMatrixWorld(true);
    for (const root of [model, crowd.group]) root.traverse(o => { if (o.isMesh && shown(o) && !/Island|Stage/.test(o.parent?.name ?? '') && !/Island|Stage/.test(o.name)) out.push(o); });
    return out; };
  let occ = null;
  const stands = ['blue','red','yellow','purple'].map(c => grandstandPlacement(c).position);
  for (let t = 0; t < secs; t += step) {
    vnow += step * 1000;
    for (let i = 0; i < jobs.length;) { if (jobs[i].due <= vnow) { const [j] = jobs.splice(i, 1); j.fn(); } else i++; }
    const w0 = process.hrtime.bigint(); visuals.tick(vnow / 1000, false, camera); const tickMs = Number(process.hrtime.bigint() - w0) / 1e6;
    const shot = visuals.battleShot();
    sonicCamera.update(lastFrame, model, Math.min(step, .05), false, shot);
    camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    const pawnPos = ['a','b'].map(id => visuals.pawnFor(id)?.position.clone());
    const proj = pawnPos.map(p => p && [p.clone().setY(.2), p.clone().setY(3.0), p.clone().setY(1.5)].map(v => v.clone().project(camera)));
    const camH = new THREE.Vector3(camera.position.x, 0, camera.position.z);
    const near = pawnPos.map(p => p ? Math.hypot(p.x - camera.position.x, p.z - camera.position.z) : 99);
    // Occlusion: ray from lens to each standee's chest, against the opaque arena
    occ ??= occluders();
    // 9 sample points up each standee; a ray to each from the lens. Blocked by
    // arena furniture (amps incl. stacked tiers, grandstands, truss) or by the
    // OTHER standee (a vertical slab ~1.3 wide round its pawn).
    const occl = pawnPos.map((p, i) => {
      if (!p) return null; let blocked = 0, by = null;
      for (const y of [.4, 1.0, 1.6, 2.2, 2.8]) for (const dx of [-.5, -.25, 0, .25, .5]) {
        const side = new THREE.Vector3(-(camera.position.z - p.z), 0, camera.position.x - p.x).normalize().multiplyScalar(dx);
        const c = p.clone().setY(y).add(side), d = c.clone().sub(camera.position), L = d.length();
        ray.set(camera.position, d.clone().normalize()); ray.far = L - .2;
        const hit = ray.intersectObjects(occ, false)[0];
        let who = hit ? (hit.object.parent?.name || hit.object.name) : null;
        if (!who) { const o = pawnPos[1 - i]; if (o) { // other standee as a slab
          const t = o.clone().sub(camera.position).dot(d) / (L * L);
          if (t > 0 && t < 1) { const q2 = camera.position.clone().addScaledVector(d, t);
            if (Math.hypot(q2.x - o.x, q2.z - o.z) < .65 && q2.y > .1 && q2.y < 3.0) who = 'OTHER-STANDEE'; } } }
        if (who) { blocked++; by = who; }
      }
      return { frac:blocked / 25, by };
    });
    const standNear = Math.min(...stands.map(s => camera.position.distanceTo(s)));
    frames.push({ tickMs, t:+t.toFixed(3), key:shot?.key ?? null, kind:shot?.kind ?? null, phase:battle?.phase ?? null, active:sonicCamera.active,
      pos:camera.position.clone(), tgt:controls.target.clone(), fov:camera.fov, proj, near, occl, standNear, camH });
  }
  visuals.dispose();
  return frames;
}
export { HEX_BY_NUM, ALL_HEXES, getFlatTopNeighborSlots, neighborInDirection, HEX_BY_QR, angleTo };

export function makeCfgs(kind, N, seed0) {
  let seed = seed0; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const corners = ['blue','red','yellow','purple'];
  const cfgs = [];
  while (cfgs.length < N) {
    const A = ALL_HEXES[Math.floor(rnd() * ALL_HEXES.length)], dir = Math.floor(rnd() * 6) * Math.PI / 3 + Math.PI / 6 * (rnd() < .5 ? 1 : 0);
    const first = neighborInDirection(A, dir); if (!first) continue;
    const dq = first.q - A.q, dr = first.r - A.r, depth = kind === 'swing' ? 1 : 1 + Math.floor(rnd() * 3);
    const B = HEX_BY_QR[`${A.q + dq * depth},${A.r + dr * depth}`]; if (!B) continue;
    const ca = corners[Math.floor(rnd() * 4)]; let cb; do cb = corners[Math.floor(rnd() * 4)]; while (cb === ca);
    const fb = kind === 'swing' ? undefined : rnd() * Math.PI * 2 - Math.PI;
    cfgs.push({ a:A.num, b:B.num, ca, cb, fb, viewer: rnd() < .5 ? 'attacker' : 'rival', tiers: 3 + Math.floor(rnd() * 4) });
  }
  return cfgs;
}
