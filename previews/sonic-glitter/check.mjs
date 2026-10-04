import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSonicZigzagVisuals } from '../../src/board/sonicZigzagVisuals.js';
import { DEFAULTS, LIMITS, PRESETS, normalizeSettings, readRingStations, createSpiralGlitter } from './spiral.js';

let checks = 0;
const check = (name, fn) => { fn(); checks++; console.log(`PASS ${name}`); };
const source = createSonicZigzagVisuals({
  ampOrigins: [new THREE.Vector3(-8, 1.7, 0)], attackerPosition: new THREE.Vector3(-5, 1.7, 0),
  defenderPosition: new THREE.Vector3(6, 1.7, 0),
  dice: [{ value: 6, sides: 6, passed: false }], chordPitches: [0],
  shieldValue: 4, shieldRadius: 1.3, strokeStyle: 'rings', intensityMode: 'face',
});
const shot = source.group.children.find(o => o.name.startsWith('Sonic die'));
const ring = shot.children.find(o => o.name === 'Harmonic wave rings');
const glitter = createSpiralGlitter(ring);
shot.add(glitter.group);
source.update(.95);
const original = Array.from(ring.geometry.attributes.position.array);
check('samples the actual curved ring mesh with orthogonal local frames', () => {
  const stations = readRingStations(ring);
  assert.ok(stations.length > 8);
  for (const s of stations) {
    assert.ok(s.radius > 0 && Number.isFinite(s.radius));
    assert.ok(Math.abs(s.across.dot(s.up)) < .0001);
    assert.ok(Math.abs(s.across.length() - 1) < .0001);
    assert.ok(Math.abs(s.up.length() - 1) < .0001);
  }
});
for (const [name, preset] of Object.entries(PRESETS)) check(`${name} produces finite geometry with the requested particle count`, () => {
  glitter.update(2, preset);
  assert.equal(glitter.points.geometry.drawRange.count, preset.density);
  assert.ok(glitter.points.geometry.attributes.position.array.every(Number.isFinite));
});
check('glitter never modifies the underlying waveform geometry', () => {
  assert.deepEqual(Array.from(ring.geometry.attributes.position.array), original);
});
check('seeking reproduces the same glitter frame', () => {
  glitter.update(3, DEFAULTS);
  const before = Array.from(glitter.points.geometry.attributes.position.array);
  glitter.update(13, DEFAULTS); glitter.update(3, DEFAULTS);
  assert.deepEqual(Array.from(glitter.points.geometry.attributes.position.array), before);
});
check('reduced motion freezes the spiral and disables twinkle', () => {
  glitter.update(2, DEFAULTS, { reduced: true });
  const before = Array.from(glitter.points.geometry.attributes.position.array);
  glitter.update(8, DEFAULTS, { reduced: true });
  assert.deepEqual(Array.from(glitter.points.geometry.attributes.position.array), before);
  assert.equal(glitter.points.material.uniforms.twinkle.value, 0);
});
check('visibility follows the actual flight and clears the draw range', () => {
  for (const time of [-1, 0, 1.8, 3]) {
    source.update(time); glitter.update(time, DEFAULTS);
    assert.equal(glitter.group.visible, false);
    assert.equal(glitter.points.geometry.drawRange.count, 0);
  }
  source.update(.95); glitter.update(1, DEFAULTS, { enabled: false });
  assert.equal(glitter.group.visible, false);
  glitter.update(1, DEFAULTS); assert.equal(glitter.group.visible, true);
});
check('bad saved values cannot exceed geometry capacity', () => {
  const values = normalizeSettings({ density: 1e9, radius: Infinity, spin: NaN, strands: -5 });
  assert.equal(values.density, LIMITS.density[1]);
  assert.equal(values.radius, DEFAULTS.radius);
  assert.equal(values.spin, DEFAULTS.spin);
  assert.equal(values.strands, 1);
});

// A separate straight, tapered aperture fixture lets us verify containment in
// world coordinates independently of the curved production path solver.
const geometry = new THREE.BufferGeometry(), vertices = [], indices = [];
for (let slot = 0; slot < 9; slot++) {
  const radius = .2 + slot * .09;
  for (let i = 0; i <= 24; i++) for (const edge of [0, .1]) {
    const angle = i / 24 * Math.PI * 2;
    vertices.push(slot, Math.cos(angle) * (radius + edge), Math.sin(angle) * (radius + edge));
  }
  for (let i = 0; i < 24; i++) { const k = slot * 50 + i * 2; indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
}
geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices);
const fixture = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ opacity: .3 }));
const parent = new THREE.Group(); parent.add(fixture);
const bounded = createSpiralGlitter(fixture); parent.add(bounded.group);
check('maximum radial spread remains inside every interpolated ring aperture', () => {
  bounded.update(4, { ...DEFAULTS, radius: .94, spread: .24, strands: 4, density: 7000 });
  const p = bounded.points.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), radius = Math.hypot(p.getY(i), p.getZ(i));
    assert.ok(x >= 0 && x <= 8);
    assert.ok(radius <= (.2 + x * .09) * .96001, `particle ${i} escapes its aperture`);
  }
});
check('reverse rotation and flow still produce finite, repeatable frames', () => {
  bounded.update(-11, { ...DEFAULTS, spin: -.6, flow: -.5 });
  assert.ok(bounded.points.geometry.attributes.position.array.every(Number.isFinite));
});
check('resources are released exactly once without disposing the source mesh', () => {
  const resources = new Map();
  glitter.group.traverse(o => { if (o.geometry) resources.set(o.geometry, 0); if (o.material) resources.set(o.material, 0); });
  for (const r of resources.keys()) r.addEventListener('dispose', () => resources.set(r, resources.get(r) + 1));
  glitter.dispose(); glitter.dispose();
  assert.ok([...resources.values()].every(n => n === 1));
  assert.equal(glitter.group.parent, null);
  assert.equal(ring.parent, shot);
});
source.dispose(); bounded.dispose(); geometry.dispose(); fixture.material.dispose();
console.log(`${checks} spiral preview checks passed.`);
