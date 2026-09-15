// Stage-1 cel zigzag: power ramp, no verdict leak, deterministic, clean dispose.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSonicZigzagVisuals, sonicShotIntensity, sonicFlightCurve, sonicFlightInverse } from './sonicZigzagVisuals.js';

// Power is a pure function of resolved values — same in, same out, always.
const m = (value, shieldValue, sides = 6) => sonicShotIntensity({ value, shieldValue, sides, mode: 'margin' });
assert.ok(m(1, 4) < m(4, 4) && m(4, 4) < m(6, 4), 'a bigger roll hits harder');
assert.ok(m(6, 2) > m(6, 5), 'a high shield visibly dims the same roll');
assert.ok(m(12, 4, 12) > m(6, 4, 6), 'an upgraded die can out-punch a d6');
assert.equal(m(1, 4), m(1, 4), 'intensity is deterministic');
const f = (v, s = 6) => sonicShotIntensity({ value: v, sides: s, shieldValue: 99, mode: 'face' });
assert.equal(f(6), 1, 'face mode ignores the shield entirely');
assert.equal(f(1), 0, 'the lowest face is the floor');

// ── the cadence ──────────────────────────────────────────────────────────────
// The head snaps leg to leg and crawls the final approach, but the curve must
// stay well behaved or the contact cue lands in the wrong place on replay.
for (const corners of [1, 3, 6, 9, 14]) {
  const samples = Array.from({ length: 600 }, (_, i) => sonicFlightCurve(i / 599, corners));
  assert.ok(samples.every((v, i, a) => i === 0 || v >= a[i - 1] - 1e-9), `corners=${corners}: monotonic, never reverses`);
  assert.equal(sonicFlightCurve(0, corners), 0, `corners=${corners}: starts at the cabinet`);
  assert.equal(sonicFlightCurve(1, corners), 1, `corners=${corners}: always actually arrives`);
  assert.ok(samples.every(v => v >= 0 && v <= 1), `corners=${corners}: stays on the path`);
  assert.equal(sonicFlightCurve(0.5, corners), sonicFlightCurve(0.5, corners), `corners=${corners}: deterministic`);
}
{
  const n = 6, speed = (a, b) => (sonicFlightCurve(b, n) - sonicFlightCurve(a, n)) / (b - a);
  assert.ok(speed(0, 0.05) > speed(0.75, 1) * 4, 'the shot snaps out fast and crawls the approach');
  assert.ok(speed(0.75, 1) > 0.05, 'the approach is slow motion, not a freeze short of the shield');
  // The final leg is a steady glide: its far corner IS the contact point, so
  // easing to a halt there would strand the shot in front of the Rival.
  const last = 1 - 1 / n, a = sonicFlightInverse(last, n);
  const glide = [0.25, 0.5, 0.75].map(f => speed(a + (1 - a) * (f - 0.2), a + (1 - a) * (f + 0.2)));
  assert.ok(Math.max(...glide) / Math.min(...glide) < 1.35, 'the final leg holds a steady speed');
  assert.ok(sonicFlightInverse(last, n) < 0.75, 'most of the flight time is spent on the last legs');
  assert.ok(Math.abs(sonicFlightCurve(sonicFlightInverse(0.61, n), n) - 0.61) < 1e-3, 'the inverse round-trips');
}

const attacker = new THREE.Vector3(-4, 1, 0), defender = new THREE.Vector3(5, 1, 0);
const origins = [new THREE.Vector3(-9, 2, -3), new THREE.Vector3(-9, 3, 3)];
const input = {
  ampOrigins: origins, attackerPosition: attacker, defenderPosition: defender, shieldValue: 4,
  dice: [{ value: 6, passed: true, sides: 6 }, { value: 1, passed: false, sides: 6 }, { value: 11, passed: true, sides: 12 }],
  chordPitches: [0, 4, 7], launchDelay: 0.4,
};
const before = JSON.stringify(input);
const scene = new THREE.Scene(), v = createSonicZigzagVisuals(input);
scene.add(v.group);
const shots = v.group.children.filter(o => o.name.startsWith('Sonic die'));
assert.equal(shots.length, 3, 'one stroke group per die');
assert.deepEqual(shots.map(o => o.userData.wrapSide), [1, -1, 1], 'shots alternate sides of the attacker');
assert.ok(shots[0].userData.power > shots[1].userData.power, 'the 6 outguns the 1');

v.update(-1); assert.ok(shots.every(o => !o.visible), 'nothing fires before the dice are revealed');
v.update(0.3); assert.ok(shots.every(o => !o.visible), 'the launch delay is honoured');
v.update(0.45); assert.ok(shots[0].visible, 'the first stroke leaves on time');

// Absolute time in, so replay and seeking land on identical frames.
const frame = () => shots.map(o => [...o.children].map(c => [c.visible, c.material?.opacity ?? null,
  Array.from(c.geometry?.attributes?.instanceStart?.array ?? c.geometry?.attributes?.position?.array ?? []).slice(0, 9)]));
v.update(1.1); const a = JSON.stringify(frame());
v.update(1.9); v.update(1.1);
assert.equal(JSON.stringify(frame()), a, 'seeking back reproduces the frame exactly');

// Reduced motion keeps the shot but stops it thrashing, and sheds no sparks.
v.update(1.1, { reduced: true });
// Shards are un-indexed triangle soup; the cel bands are indexed strips.
const shards = shots.flatMap(o => o.children.filter(c => c.name === 'Harmonic wave ribbon' && !c.geometry.index));
assert.equal(shards.length, 3, 'each shot owns one chevron shard field');
assert.ok(shards.every(s => !s.visible), 'reduced motion sheds no shards');

// ── the camera hand-off ──────────────────────────────────────────────────────
// REGRESSION: the camera must never lurch backwards mid-volley. Focusing on
// "whichever shot is furthest along, ignoring ones that have landed" retires the
// leader every stagger-step and snaps the focus back to a shot behind it — the
// camera pulls out and re-zooms once per die. Both the focus point and the
// push-in amount have to be monotonic for the whole volley, at any die count.
{
  const early = v.getFocus(0.5), late = v.getFocus(0.45 + 1.7);
  assert.ok(early && late, 'a launched shot always offers the camera a focus');
  assert.ok(late.closeness > early.closeness, 'the push-in tightens as the shot closes');
  assert.ok(early.closeness >= 0 && late.closeness <= 1, 'closeness stays normalised');
  assert.equal(v.getFocus(0.5, { reduced: true }), null, 'reduced motion never drives the camera');
  assert.equal(v.getFocus(-1), null, 'nothing has launched yet, so nothing to look at');
}
for (const count of [1, 2, 5, 11]) {
  const many = createSonicZigzagVisuals({
    ...input, launchDelay: 0.2,
    dice: Array.from({ length: count }, (_, i) => ({ value: (i % 6) + 1, passed: i % 2 === 0, sides: 6 })),
  });
  let lastProgress = -1, lastCloseness = -1, lastPoint = null, regressions = 0, drift = 0;
  for (let i = 0; i <= 1200; i++) {
    const focus = many.getFocus((i / 1200) * many.duration);
    if (!focus) continue;
    if (focus.progress < lastProgress - 1e-9) regressions++;
    if (focus.closeness < lastCloseness - 1e-9) regressions++;
    // The focus must be a pure function of progress along ONE path. If the
    // point can move while progress stands still, it has hopped to a different
    // shot — which is the teleport that made the camera stutter. (Testing raw
    // per-sample distance instead would be a false positive: the snap out of
    // the cabinet legitimately covers a lot of ground between two samples.)
    if (lastPoint && Math.abs(focus.progress - lastProgress) < 1e-12
      && focus.point.distanceTo(lastPoint) > 1e-9) drift++;
    lastProgress = focus.progress; lastCloseness = focus.closeness; lastPoint = focus.point.clone();
  }
  assert.equal(regressions, 0, `${count} dice: the camera never pulls back out mid-volley`);
  assert.equal(drift, 0, `${count} dice: the focus never hops to a different shot`);
  assert.ok(many.getFocus(many.duration).closeness > 0.999, `${count} dice: the push-in stays in on the contact`);
  many.dispose();
}

// ── the stroke geometry ──────────────────────────────────────────────────────
// Hand-built mitred ribbons, because a line primitive draws round caps and
// joins and therefore cannot hold a sharp corner or come to a point.
v.update(1.0);
{
  const bands = shots[0].children.filter(c => c.name === 'Harmonic wave ribbon' && c.geometry.index);
  assert.ok(bands.length >= 3, 'three cel bands per shot');
  assert.ok(bands.some(b => b.material.blending === THREE.NormalBlending),
    'the cel bands are opaque — stacking three additive strokes washes the tint to white');
  assert.ok(bands.some(b => b.material.blending === THREE.AdditiveBlending),
    'one hot core still blooms');
  for (const band of bands) {
    const a = band.geometry.attributes.position.array;
    assert.ok(a.every(Number.isFinite), 'no NaN leaks out of the mitre solve');
    const widthAt = i => Math.hypot(a[i * 6] - a[i * 6 + 3], a[i * 6 + 1] - a[i * 6 + 4], a[i * 6 + 2] - a[i * 6 + 5]);
    const head = a.length / 6 - 1;
    assert.ok(widthAt(head) < 1e-6, 'the leading end converges to a spear point');
    assert.ok(widthAt(0) < widthAt(Math.floor(head * 0.8)), 'the stroke is thin at the tail and broad at the shoulders');
    // A hairpin must not fire a mitre spike across the arena.
    let widest = 0;
    for (let i = 0; i <= head; i++) widest = Math.max(widest, widthAt(i));
    assert.ok(widest < 1.2, 'mitre extension stays clamped');
  }
}
v.setResolution(1280, 720); // no-op now; kept so existing call sites stay valid

v.update(v.duration); assert.equal(v.group.visible, false, 'the timeline expires');
assert.equal(JSON.stringify(input), before, 'caller data is read-only');

const res = new Map();
v.group.traverse(o => { if (o.geometry) res.set(o.geometry, 0); if (o.material) res.set(o.material, 0); });
for (const r of res.keys()) r.addEventListener('dispose', () => res.set(r, res.get(r) + 1));
v.dispose(); v.dispose(); v.update(0);
assert.ok([...res.values()].every(n => n === 1), 'every geometry/material disposed exactly once');
assert.equal(scene.children.length, 0);

const noRig = createSonicZigzagVisuals({ ...input, ampOrigins: [] });
assert.equal(noRig.group.visible, false, 'no physical rig means no invented shots');
noRig.dispose();
console.log('PASS: flight cadence, power ramp, launch gating, determinism, camera focus, reduced motion, cel banding and cleanup');
