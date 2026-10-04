import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DEFAULTS, surface } from './sustainShield.js';
import { createSonicClashVisuals } from './sonicClashVisuals.js';
import { buildSonicPath } from './sonicVolleyVisuals.js';
import { resolveSonicBarrage } from '../engine/systems/sonicBarrage.js';
import { barrageContact, barrageSimulationTime, barrageTime } from './sonicBarrageTiming.js';

let checks = 0;
const check = (name, run) => { run(); checks++; console.log(`PASS ${name}`); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const makeBattle = (drive = [2, 5, 8, 3], hp = 12) => ({ diceVals: drive, dicePool: drive.map(() => 6),
  shieldValue: hp, sustainRolls: [6, 6], sustainPool: [6, 6], ...resolveSonicBarrage(drive, hp) });
const options = { attackerPosition: V(-5, 1, 0), defenderPosition: V(5, 1, 0),
  ampOrigins: [V(-8, 1.7, 2)], sustainOrigin: V(8, 1.7, -2), shieldRadius: 2.4,
  buildStart: -3, buildEnd: -.5 };
const create = (battle, extra = {}) => createSonicClashVisuals({ ...options, battle, ...extra });
const debrisSnapshot = visual => {
  const p = visual.sustain.debris.particles;
  return { count: p.geometry.drawRange.count, time: p.material.uniforms.time.value,
    positions: Array.from(p.geometry.attributes.position.array.slice(0, p.geometry.drawRange.count * 3)) };
};
check('the complete supplied Sustain settings are the production default', () => {
  assert.deepEqual(DEFAULTS, { width: 2.9, height: 3.6, hexness: .83, rounding: .72, dome: .13,
    rim: .026, rings: 8, ringLight: .6, field: .21, coils: 3.3, turns: .5, strands: 3, spread: .115,
    density: 2600, size: 2.2, brightness: .8, twinkle: .85, iridescence: 1, filament: .14,
    spin: .14, flow: 0, breath: .025, pulse: .32, strength: .8, hue: 280 });
});
check('actual unequal HP losses drive weakening; a held shield never falsely breaks', () => {
  const battle = makeBattle([2, 5], 12), visual = create(battle);
  visual.update(-4); assert.equal(visual.sustain.group.visible, false);
  visual.update(-1.5); assert.ok(visual.group.getObjectByName('Sustain amp glitter feed').visible);
  visual.update(0); const full = visual.sustain.face.material.uniforms.opacity.value;
  visual.update(barrageContact(0) + .25); const first = visual.sustain.face.material.uniforms.opacity.value;
  visual.group.traverse(o => { if (o.name === 'Sustain surface ripple') assert.equal(o.visible, false); });
  assert.equal(visual.state(barrageContact(0)).health, 10 / 12);
  assert.ok(debrisSnapshot(visual).count > 0);
  visual.update(barrageContact(1) + .25); const second = visual.sustain.face.material.uniforms.opacity.value;
  assert.equal(visual.state(barrageContact(1)).health, 5 / 12);
  assert.ok(full > first && first > second);
  visual.update(20); assert.ok(visual.sustain.shell.visible); assert.equal(debrisSnapshot(visual).count, 0);
  visual.dispose();
});
check('the new face still meets the real beam endpoint in every direction and at short range', () => {
  for (const to of [V(5, 1, 0), V(-5, 1, 0), V(0, 1, 5), V(3, 1.7, -4), V(.9, 1, .7)]) {
    const from = V(0, to.y, 0), gap = from.distanceTo(to), standoff = Math.min(2.4, gap * .45);
    const visual = create(makeBattle([2]), { attackerPosition: from, defenderPosition: to });
    visual.update(0); visual.group.updateMatrixWorld(true);
    const path = buildSonicPath({ origin: V(-3, 1.7, 2), attackerPosition: from, defenderPosition: to, shieldRadius: standoff, passed: false });
    const endpoint = visual.sustain.group.worldToLocal(path.getPoint(1));
    const expected = surface(endpoint.y >= 0 ? 1 / 24 : 13 / 24, Math.abs(endpoint.y) / (DEFAULTS.height / 2), DEFAULTS);
    assert.ok(endpoint.distanceTo(expected) < 1e-6);
    assert.ok(visual.sustain.group.position.y - DEFAULTS.height / 2 >= .119);
    visual.dispose();
  }
});
check('break glitter and ring fragments replace the shell; later Spirit hits do not emit shield debris', () => {
  const battle = makeBattle(), visual = create(battle);
  const control = create({ ...battle, shots: battle.shots.slice(0, 3) });
  visual.update(barrageContact(2) + .3);
  assert.equal(visual.sustain.shell.visible, false);
  assert.ok(debrisSnapshot(visual).count > 1000);
  assert.ok(visual.sustain.debris.shards.some(s => s.visible));
  const time = barrageContact(3) + .2;
  visual.update(time); control.update(time);
  assert.deepEqual(debrisSnapshot(visual), debrisSnapshot(control));
  visual.update(30); assert.equal(debrisSnapshot(visual).count, 0);
  assert.ok(visual.sustain.debris.shards.every(s => !s.visible));
  visual.dispose(); control.dispose();
});
check('hit-stop freezes shed glitter, rewinding restores it, and reduced motion hides debris', () => {
  const battle = makeBattle(), visual = create(battle), at = barrageTime(battle, barrageContact(0));
  visual.update(barrageSimulationTime(battle, at + .1)); const freeze = debrisSnapshot(visual);
  visual.update(barrageSimulationTime(battle, at + .4)); assert.deepEqual(debrisSnapshot(visual), freeze);
  const time = barrageContact(1) + .3;
  visual.update(time); const sample = debrisSnapshot(visual);
  visual.update(15); visual.update(time); assert.deepEqual(debrisSnapshot(visual), sample);
  visual.update(barrageContact(2) + .3, { reduced: true });
  assert.equal(visual.sustain.shell.visible, false); assert.equal(visual.sustain.debris.group.visible, false);
  visual.dispose(); visual.dispose(); assert.equal(visual.group.children.length, 0);
});
check('long volleys, absent shields and the Bushido-only shield remain valid', () => {
  const long = create(makeBattle(Array(20).fill(1), 40), { beams: false });
  long.update(barrageContact(19) + .4);
  assert.equal(long.sustain.face.material.uniforms.woundCount.value, 16);
  long.group.traverse(o => { if (o.geometry?.attributes.position) assert.ok(o.geometry.attributes.position.array.every(Number.isFinite)); });
  long.dispose();
  const absent = create(makeBattle([5], 0)); absent.update(3); assert.equal(absent.sustain.group.visible, false); absent.dispose();
});
console.log(`${checks} production Sustain shield checks passed.`);
