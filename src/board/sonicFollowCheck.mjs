// 🌊 test:sonicfx — THE TAIL FOLLOWS THE HEAD (RING_FOLLOW, Alex 2026-10-08).
// What this pins, and the failure it prevents:
//   1. the defaults ARE Alex's dial-in (a "tidy" of the numbers fails here first);
//   2. the first half of the flight is BYTE-identical to the old beam — he said
//      it "has it exactly right", so the follow may only touch the last stretch;
//   3. the tail is no longer stuck: its back ring travels toward the target on
//      the last stretch, where the old beam's back ring stands still;
//   4. it has caught the head by contact (compress 0) — every ring at the impact;
//   5. it follows THROUGH: the beam stays drawn for the drain after contact
//      instead of blinking out, and is gone after it;
//   6. deterministic under seeking, and reduced motion keeps the old beam.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSonicZigzagVisuals, RING_FOLLOW, FLIGHT_SECONDS, sonicFlightInverse, RING_TUNING, SONIC_TUNING } from './sonicZigzagVisuals.js';
import { buildSonicPath } from './sonicVolleyVisuals.js';
import { readRingStations } from './sonicGlitter.js';

let passed = 0;
const pass = msg => { passed++; console.log(`PASS ${msg}`); };

// 1 ── the dial-in
assert.deepEqual({ ...RING_FOLLOW }, { follow: true, compress: 0, approach: 1, ease: 3, replay: 1, drain: 0.8,
  slim: 0.4, swell: 0.6, calm: 1, ram: 0 });
assert.ok(Object.isFrozen(RING_FOLLOW));
pass("RING_FOLLOW is Alex's 2026-10-08 dial-in (6 of 9 levers moved), frozen");

const amp = new THREE.Vector3(-11, 1.6, -7), attacker = new THREE.Vector3(-2.5, 1, 0.6), defender = new THREE.Vector3(2.4, 1, -0.4);
const shieldRadius = 2.4, gap = defender.clone().sub(attacker).setY(0).length(), standoff = Math.min(shieldRadius, gap * 0.45);
const lane = defender.clone().sub(attacker).setY(0).normalize();
const make = (tuning = {}) => createSonicZigzagVisuals({ ampOrigins: [amp], attackerPosition: attacker, defenderPosition: defender,
  dice: [{ value: 5, sides: 6, passed: false }], strokeStyle: 'rings', shieldValue: 4, shieldRadius, glitter: false, tuning });
const cam = new THREE.PerspectiveCamera(); cam.position.set(-1, 7, 13);
const meshes = v => { const out = []; v.group.traverse(o => o.isMesh && out.push(o)); return out; };
const ringsOf = v => meshes(v).find(m => m.name === 'Harmonic wave rings');
const snapshot = v => meshes(v).map(m => Array.from(m.geometry.attributes.position.array));
const same = (a, b) => a.every((arr, i) => arr.every((x, k) => x === b[i][k]));

// When the head enters the last `approach` units: the follow may not act before it.
const path = buildSonicPath({ origin: amp, attackerPosition: attacker, defenderPosition: defender, side: 1, clearance: 1.05, shieldRadius: standoff });
const corners = Math.min(14, Math.max(3, Math.round(path.length / SONIC_TUNING.legLength)));
const T = { ...SONIC_TUNING, ...RING_TUNING, smooth: true };
const catchUp = FLIGHT_SECONDS * sonicFlightInverse(1 - RING_FOLLOW.approach / path.length, corners, T);
assert.ok(catchUp > FLIGHT_SECONDS * 0.5 && catchUp < FLIGHT_SECONDS, `catch-up starts late in the flight (${catchUp.toFixed(3)} s)`);

// 2 ── the first half is the old beam, byte for byte
{
  const now = make(), old = make({ follow: false });
  let frames = 0;
  for (let t = 0; t < catchUp - 0.01; t += 0.023) {
    now.update(t, { camera: cam }); old.update(t, { camera: cam });
    assert.ok(same(snapshot(now), snapshot(old)), `identical to the old beam at ${t.toFixed(3)} s`);
    frames++;
  }
  now.update(FLIGHT_SECONDS - 0.05, { camera: cam }); old.update(FLIGHT_SECONDS - 0.05, { camera: cam });
  assert.ok(!same(snapshot(now), snapshot(old)), 'and the follow does change the last stretch');
  pass(`the flight up to the catch-up (${frames} frames, ${catchUp.toFixed(2)} s) is byte-identical to the old beam`);
}

// 3 ── the tail is not stuck  ·  4 ── caught up by contact
{
  // The back of the beam against its front, along the lane. The old beam's back
  // ring holds its station (only the 160 ms contact squeeze drags it a little);
  // with the follow it RUNS the head's track and arrives with the front.
  const spread = v => { const st = readRingStations(ringsOf(v)); return st.at(-1).center.dot(lane) - st[0].center.dot(lane); };
  const now = make(), old = make({ follow: false });
  now.update(catchUp, { camera: cam }); old.update(catchUp, { camera: cam });
  const n0 = spread(now), o0 = spread(old);
  const late = FLIGHT_SECONDS - 0.005;
  now.update(late, { camera: cam }); old.update(late, { camera: cam });
  const n1 = spread(now), o1 = spread(old);
  assert.ok(o1 > 1.5, `the OLD tail is still strung out behind the head at contact (${o1.toFixed(2)})`);
  assert.ok(n1 < 0.3 && n0 - n1 > 3, `the tail closes up on the head (${n0.toFixed(2)} → ${n1.toFixed(2)})`);
  pass(`the tail is no longer stuck: back-to-front ${n0.toFixed(2)} → ${n1.toFixed(2)} units by contact (old: ${o0.toFixed(2)} → ${o1.toFixed(2)})`);

  now.update(FLIGHT_SECONDS - 0.005, { camera: cam });
  const contact = path.shieldPoint;
  const far = Math.max(...readRingStations(ringsOf(now)).map(s => s.center.clone().setY(contact.y).distanceTo(contact)));
  assert.ok(far < 0.2, `every ring is at the impact by contact (furthest ${far.toFixed(2)})`);
  pass(`compress 0: the whole tail has caught the head at contact (furthest ring ${far.toFixed(2)} units off)`);
}

// 5 ── it follows through instead of blinking out
{
  const now = make(), old = make({ follow: false });
  const during = FLIGHT_SECONDS + RING_FOLLOW.drain * 0.5, after = FLIGHT_SECONDS + RING_FOLLOW.drain + 0.05;
  now.update(during, { camera: cam }); old.update(during, { camera: cam });
  assert.equal(ringsOf(old).visible && ringsOf(old).parent.visible, false, 'the old beam is gone at contact');
  assert.equal(ringsOf(now).visible && ringsOf(now).parent.visible, true, 'the follow is still drawn during the drain');
  now.update(after, { camera: cam });
  assert.equal(ringsOf(now).parent.visible, false, 'and gone once the drain is over');
  pass(`the beam follows through for the ${RING_FOLLOW.drain} s drain after contact, then clears`);
}

// 6 ── deterministic under seeking; reduced motion keeps the old beam
{
  // Scoped to what the follow draws: the rings, their hot core and the thread.
  // 📌 The spark ribbon is NOT seek-stable in ring mode — on the shipped beam
  // too, before any of this (its stale buffer depends on the previous frame).
  const ours = v => meshes(v).filter(m => /^Harmonic wave (rings|thread)$/.test(m.name)).map(m => Array.from(m.geometry.attributes.position.array));
  const v = make(), times = [1.2, 1.7, FLIGHT_SECONDS + 0.2, 0.4, 1.7, FLIGHT_SECONDS + 0.2];
  const shots = times.map(t => { v.update(t, { camera: cam }); return ours(v); });
  assert.ok(same(shots[1], shots[4]) && same(shots[2], shots[5]), 'seeking back lands on the same frame');
  const now = make(), old = make({ follow: false });
  for (let t = 0; t < FLIGHT_SECONDS + 1; t += 0.05) {
    now.update(t, { camera: cam, reduced: true }); old.update(t, { camera: cam, reduced: true });
    assert.ok(same(snapshot(now), snapshot(old)), `reduced motion is the old beam at ${t.toFixed(2)} s`);
  }
  pass('deterministic under seeking; reduced motion draws the old beam exactly');
}

console.log(`${passed} tail-follow checks passed.`);
