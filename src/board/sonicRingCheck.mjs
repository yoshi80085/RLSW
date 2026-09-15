// ── THE RING BEAM ────────────────────────────────────────────────────────────
// The shipped Sonic projectile (PROJECTILE_COMBAT_DESIGN.md §12.1c). This suite
// guards four things: that ALEX'S APPROVED DIAL-IN actually reaches the geometry,
// that the fluid cadence is well behaved AT HIS OWN slow-motion value rather than
// at the library default (§B2), that the beam keeps its nose/body/tail profile,
// and that seeking and teardown stay clean.
//
// 📌 `sonicZigzagCheck.mjs` is the other half and must keep passing UNMODIFIED —
// it covers the machinery this treatment shares with the other two.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSonicZigzagVisuals, sonicFlightCurve, sonicFlightInverse, SONIC_TUNING, RING_TUNING } from './sonicZigzagVisuals.js';

// ── the fluid cadence ────────────────────────────────────────────────────────
for (const corners of [1, 3, 6, 9, 14]) {
  const o = { smooth: true };
  const s = Array.from({ length: 600 }, (_, i) => sonicFlightCurve(i / 599, corners, o));
  assert.ok(s.every((v, i, a) => i === 0 || v >= a[i - 1] - 1e-9), `smooth corners=${corners}: monotonic`);
  assert.equal(sonicFlightCurve(0, corners, o), 0, `smooth corners=${corners}: starts at the cabinet`);
  assert.equal(sonicFlightCurve(1, corners, o), 1, `smooth corners=${corners}: always arrives`);
  assert.ok(s.every(v => v >= 0 && v <= 1), `smooth corners=${corners}: stays on the path`);
  assert.ok(Math.abs(sonicFlightCurve(sonicFlightInverse(0.61, corners, o), corners, o) - 0.61) < 1e-3,
    `smooth corners=${corners}: the inverse round-trips`);
}
{
  const n = 6, o = { smooth: true };
  const speed = (a, b) => (sonicFlightCurve(b, n, o) - sonicFlightCurve(a, n, o)) / (b - a);
  // The slow-motion approach must SURVIVE the change — only the per-leg dash goes.
  assert.ok(speed(0, 0.05) > speed(0.9, 1) * 4, 'smooth: still snaps out and crawls the approach');
  assert.ok(speed(0.75, 1) > 0.05, 'smooth: the approach is slow motion, not a freeze');
  // And the ticking must actually be gone: sample speed across one mid-flight leg
  // and check it never dips the way a dash-and-ease leg does.
  const at = x => speed(x, x + 0.004);
  const mid = Array.from({ length: 40 }, (_, i) => at(0.30 + i * 0.004));
  const zig = Array.from({ length: 40 }, (_, i) => {
    const a = 0.30 + i * 0.004;
    return (sonicFlightCurve(a + 0.004, n) - sonicFlightCurve(a, n)) / 0.004;
  });
  const spread = xs => Math.max(...xs) / Math.max(1e-9, Math.min(...xs));
  assert.ok(spread(mid) < 1.2, `smooth: speed holds through a leg (spread ${spread(mid).toFixed(2)})`);
  assert.ok(spread(zig) > spread(mid) * 2, 'the zigzag cadence really is the staccato one');
}

// ── ⭐ Alex's dial-in is the SHIPPED look, so it is what gets asserted ────────
// ⚠️ §B2: a curve tested at the library default is not evidence about the curve
// the game runs. These re-run the cadence at RING_TUNING's own slowmo.
{
  const R = { ...SONIC_TUNING, ...RING_TUNING, smooth: true };
  assert.equal(RING_TUNING.slowmo, 52, 'the approved slow-motion value');
  assert.equal(RING_TUNING.beamRadius, 0.64, 'the approved beam calibre');
  assert.equal(RING_TUNING.burst, 3.1, 'the approved detonation size');
  for (const corners of [3, 6, 14]) {
    const s = Array.from({ length: 600 }, (_, i) => sonicFlightCurve(i / 599, corners, R));
    assert.ok(s.every((v, i, a) => i === 0 || v >= a[i - 1] - 1e-9), `ring cadence corners=${corners}: monotonic`);
    assert.equal(sonicFlightCurve(1, corners, R), 1, `ring cadence corners=${corners}: still arrives`);
  }
  const n = 6, speed = (a, b) => (sonicFlightCurve(b, n, R) - sonicFlightCurve(a, n, R)) / (b - a);
  assert.ok(speed(0, 0.05) > speed(0.9, 1) * 6, 'at slowmo 52 the contrast is bigger, not broken');
  // 🎯 The one that matters at this setting: a harder slowdown must not become a
  // stall that strands the beam in front of the shield.
  assert.ok(speed(0.85, 1) > 0.02, 'the crawl is still motion, not a freeze short of the barrier');
}

// ⚠️ AND THE DEFAULTS MUST ACTUALLY REACH THE GEOMETRY. If RING_TUNING is ever
// unhooked — or "tidied" into SONIC_TUNING and lost — a ring volley built with no
// tuning would quietly fall back to the cel baseline and nobody would see a
// failure. Build one of each and compare the bytes.
{
  const seed = {
    ampOrigins: [new THREE.Vector3(-9, 2, -3), new THREE.Vector3(-9, 3, 3)],
    attackerPosition: new THREE.Vector3(-4, 1, 0), defenderPosition: new THREE.Vector3(5, 1, 0),
    shieldValue: 4, chordPitches: [0, 4, 7], shieldRadius: 2.4,
    dice: [{ value: 6, passed: true, sides: 6 }], strokeStyle: 'rings',
  };
  const geom = v => { v.update(1.1); return JSON.stringify(v.group.children
    .filter(o => o.name.startsWith('Sonic die'))
    .map(o => o.children.map(c => Array.from(c.geometry?.attributes?.position?.array ?? []).slice(0, 60)))); };
  const bare = createSonicZigzagVisuals({ ...seed });
  const explicit = createSonicZigzagVisuals({ ...seed, tuning: { ...RING_TUNING } });
  const baseline = createSonicZigzagVisuals({ ...seed, tuning: { ...SONIC_TUNING } });
  const a = geom(bare), b = geom(explicit), c = geom(baseline);
  assert.equal(a, b, 'a ring volley with no tuning IS the approved dial-in');
  assert.notEqual(a, c, 'and it is NOT the cel baseline — the overlay really applies');
  for (const v of [bare, explicit, baseline]) v.dispose();
}

const input = {
  ampOrigins: [new THREE.Vector3(-9, 2, -3), new THREE.Vector3(-9, 3, 3)],
  attackerPosition: new THREE.Vector3(-4, 1, 0), defenderPosition: new THREE.Vector3(5, 1, 0),
  shieldValue: 4, chordPitches: [0, 4, 7], launchDelay: 0.4, shieldRadius: 2.4,
  dice: [{ value: 6, passed: true, sides: 6 }, { value: 1, passed: false, sides: 6 }, { value: 11, passed: true, sides: 12 }],
};
const before = JSON.stringify(input);
const scene = new THREE.Scene();
const v = createSonicZigzagVisuals({ ...input, strokeStyle: 'rings' });
scene.add(v.group);
const shots = v.group.children.filter(o => o.name.startsWith('Sonic die'));
assert.equal(shots.length, 3, 'one beam group per die');

// Ring mode replaces the cel bands rather than drawing over them.
const bandsOf = s => s.children.filter(c => c.name === 'Harmonic wave ribbon' && c.geometry.index);
assert.ok(bandsOf(shots[0]).every(b => !b.visible), 'the cel ribbon is off in ring mode');
const ringsOf = s => s.children.filter(c => c.name === 'Harmonic wave rings');
assert.equal(ringsOf(shots[0]).length, 2, 'two ring bands per beam: the stack and its hot core');

v.update(-1); assert.ok(shots.every(o => !o.visible), 'nothing fires before the dice are revealed');
v.update(0.3); assert.ok(shots.every(o => !o.visible), 'the launch delay is honoured');
v.update(0.45); assert.ok(shots[0].visible, 'the first beam leaves on time');

const camera = new THREE.PerspectiveCamera(45, 1.6, 0.1, 300);
camera.position.set(-6, 11, 20); camera.updateMatrixWorld();

// ── the beam profile ─────────────────────────────────────────────────────────
// Tight nose, full body, tapering tail — and every ring square to the beam.
v.update(1.2, { camera });
{
  const stack = ringsOf(shots[0])[0];
  const a = stack.geometry.attributes.position.array;
  const perRing = a.length / 3 / 64;          // MAX_RINGS
  assert.ok(a.every(Number.isFinite), 'no NaN leaks out of the wave solve');
  const radii = [];
  for (let c = 0; c < 64; c++) {
    const base = c * perRing * 3;
    // A ring's own extent: the span of its outer vertices.
    let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], live = false;
    for (let s = 0; s < perRing; s += 2) {
      const k = base + (s + 1) * 3;
      if (a[k] || a[k + 1] || a[k + 2]) live = true;
      for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], a[k + j]); hi[j] = Math.max(hi[j], a[k + j]); }
    }
    if (live) radii.push({ c, size: Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2 });
  }
  assert.ok(radii.length > 6, `the beam is a stack, not a single hoop (${radii.length} rings lit)`);
  const head = radii[radii.length - 1], tail = radii[0];
  const widest = radii.reduce((m, r) => r.size > m.size ? r : m, radii[0]);
  assert.ok(widest.c > tail.c && widest.c < head.c, 'the beam is widest between its nose and its tail');
  assert.ok(head.size < widest.size * 0.9, 'the nose is tighter than the body');
  assert.ok(tail.size < widest.size * 0.9, 'the tail tapers away');
  assert.ok(widest.size < 3, 'the beam stays a beam and does not balloon');
}

// Absolute time in, so replay and seeking land on identical frames.
const frame = () => shots.map(o => [...o.children].map(c => [c.visible, c.material?.opacity ?? null,
  Array.from(c.geometry?.attributes?.position?.array ?? []).slice(0, 24)]));
v.update(1.1, { camera }); const a1 = JSON.stringify(frame());
v.update(1.9, { camera }); v.update(1.1, { camera });
assert.equal(JSON.stringify(frame()), a1, 'seeking back reproduces the frame exactly');

// The camera hand-off is unchanged by the fluid cadence.
{
  let last = -1, regressions = 0;
  for (let i = 0; i <= 900; i++) {
    const f = v.getFocus((i / 900) * v.duration);
    if (!f) continue;
    if (f.progress < last - 1e-9) regressions++;
    last = f.progress;
  }
  assert.equal(regressions, 0, 'the camera never pulls back out mid-volley');
  assert.ok(v.getFocus(v.duration).closeness > 0.999, 'the push-in stays in on the contact');
}

v.update(v.duration); assert.equal(v.group.visible, false, 'the timeline expires');
assert.equal(JSON.stringify(input), before, 'caller data is read-only');

const res = new Map();
v.group.traverse(o => { if (o.geometry) res.set(o.geometry, 0); if (o.material) res.set(o.material, 0); });
for (const r of res.keys()) r.addEventListener('dispose', () => res.set(r, res.get(r) + 1));
v.dispose(); v.dispose(); v.update(0);
assert.ok([...res.values()].every(n => n === 1), 'every geometry/material disposed exactly once');
assert.equal(scene.children.length, 0);

// Reduced motion keeps the beam but stops it breathing.
const rm = createSonicZigzagVisuals({ ...input, strokeStyle: 'rings' });
rm.update(1.2, { reduced: true, camera });
assert.equal(rm.getFocus(1.2, { reduced: true }), null, 'reduced motion never drives the camera');
rm.dispose();

console.log('PASS: the approved dial-in reaches the geometry, fluid cadence at its own slowmo, beam profile, ring banding, determinism, camera focus and cleanup');
