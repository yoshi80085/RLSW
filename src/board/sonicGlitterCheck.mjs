import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SONIC_GLITTER, SONIC_WAVE } from './sonicGlitter.js';
import { createSonicZigzagVisuals, RING_TUNING, FLIGHT_SECONDS } from './sonicZigzagVisuals.js';
import { createSonicClashVisuals } from './sonicClashVisuals.js';
import { barrageSimulationTime } from './sonicBarrageTiming.js';
import { createDuelWaveforms } from './riffWaveforms.js';
import { createSwingClashVisuals } from './swingClashVisuals.js';
import { SWING_TIMING } from './swingTiming.js';

let count = 0;
const check = (name, run) => { run(); count++; console.log(`PASS ${name}`); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const options = { ampOrigins: [V(-8, 1.7, 0)], attackerPosition: V(-5, 1.7, 0),
  defenderPosition: V(6, 1.7, 0), dice: [{ value: 6, sides: 6, passed: false }],
  shieldValue: 4, shieldRadius: 1.3, strokeStyle: 'rings', intensityMode: 'face' };
const pointsOf = group => {
  const points = []; group.traverse(o => { if (o.isPoints) points.push(o); }); return points;
};
const positions = object => Array.from(object.geometry.attributes.position.array);
check('the approved JSON is the production default, including ring spacing and radius', () => {
  assert.deepEqual(SONIC_GLITTER, { turns: 4.5, strands: 3, radius: .63, spread: .23,
    density: 2000, size: 3, brightness: .8, twinkle: .85, spin: .19, flow: .06,
    filament: .025, iridescence: .8, ringOpacity: 1, coreOpacity: 1 });
  assert.deepEqual(SONIC_WAVE, { ringGap: .59, beamRadius: .66 });
  assert.equal(RING_TUNING.ringGap, SONIC_WAVE.ringGap);
  assert.equal(RING_TUNING.beamRadius, SONIC_WAVE.beamRadius);
});

for (const passed of [false, true]) {
  const sonic = createSonicZigzagVisuals({ ...options, dice: [{ value: 6, sides: 6, passed }] });
  const glitter = sonic.group.getObjectByName('Sonic inner spiral glitter');
  const particles = pointsOf(glitter)[0];
  check(`${passed ? 'Spirit' : 'shield'} contact keeps glitter through compression and release`, () => {
    sonic.update(.95);
    assert.ok(glitter.visible);
    assert.equal(particles.geometry.drawRange.count, 2000);
    assert.equal(particles.material.uniforms.twinkle.value, .85);
    assert.equal(particles.material.uniforms.size.value, 3);
    for (const age of [FLIGHT_SECONDS, FLIGHT_SECONDS + .07, FLIGHT_SECONDS + .22, FLIGHT_SECONDS + .44]) {
      sonic.update(age);
      assert.equal(sonic.group.children.find(o => o.name.startsWith('Sonic die')).visible, false);
      assert.ok(glitter.visible, `glitter missing at ${age}`);
      assert.ok(positions(particles).every(Number.isFinite));
    }
    sonic.update(sonic.duration);
    assert.equal(glitter.visible, false);
  });
  check(`${passed ? 'Spirit' : 'shield'} impact seeking needs no previous flight frames`, () => {
    sonic.update(1.88); const expected = positions(particles);
    sonic.update(.8); sonic.update(1.88);
    assert.deepEqual(positions(particles), expected);
    sonic.update(-1); assert.equal(particles.geometry.drawRange.count, 0);
    sonic.update(1.88); assert.deepEqual(positions(particles), expected);
  });
  sonic.dispose();
}

check('the live Sonic clash freezes glitter at contact on the same clock as the shield', () => {
  const battle = { diceVals: [4], dicePool: [6], sustainRolls: [5, 5], sustainPool: [6, 6],
    shieldValue: 10, breakIndex: -1, shots: [{ index: 0, strength: 4, before: 10, after: 6, absorbed: 4, through: 0 }] };
  const clash = createSonicClashVisuals({ ...options, battle });
  const particles = pointsOf(clash.group)[0];
  clash.update(barrageSimulationTime(battle, 2.45));
  const frozen = positions(particles), shaderTime = particles.material.uniforms.time.value;
  clash.update(barrageSimulationTime(battle, 2.8));
  assert.deepEqual(positions(particles), frozen);
  assert.equal(particles.material.uniforms.time.value, shaderTime);
  clash.update(barrageSimulationTime(battle, 3.2));
  assert.notDeepEqual(positions(particles), frozen);
  clash.dispose();
});

check('Riff Off streams and core use the approved helix, aim inward and keep fixed spacing', () => {
  const parent = new THREE.Group(), riff = createDuelWaveforms(parent, ['#43dfff', '#ff9955']);
  riff.setOrigins([V(-10, 1.85, 0), V(10, 1.85, 0)]);
  riff.update({ time: 0, energy: [4, 4] });
  // Also cross a pool wrap, where slot order is no longer spatial order.
  for (const time of [1000, 12000]) {
    riff.update({ time, energy: [4, 4] });
    riff.waves.forEach((wave, side) => {
      assert.equal(wave.glitter.geometry.drawRange.count, 2000);
      assert.equal(wave.glitter.material.uniforms.amount.value, .8);
      assert.ok(positions(wave.glitter).every(Number.isFinite));
      const p = wave.glitter.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) assert.ok(side ? p.getX(i) >= 0 && p.getX(i) <= 10 : p.getX(i) <= 0 && p.getX(i) >= -10);
      const distances = wave.stations.map(s => s.distance).sort((a, b) => a - b);
      for (let i = 1; i < distances.length; i++) assert.ok(Math.abs(distances[i] - distances[i - 1] - .59) < 1e-6);
    });
  }
  const core = riff.ball.getObjectByName('Riff core spiral glitter');
  assert.ok(core.visible); assert.equal(pointsOf(core)[0].geometry.drawRange.count, 2000);
  riff.reset(); assert.ok(!core.visible && riff.waves.every(w => !w.spiral.group.visible));
  riff.dispose(); assert.equal(parent.children.length, 0);
});

check('Thrash has no rings or solid beam, and targets each Spirit through the approach and strike', () => {
  const battle = { diceVals: [6, 5], defenderDiceVals: [2, 3], dicePool: [6, 6], defenderDicePool: [6, 6],
    atkTotal: 11, defTotal: 5, damage: 6, tied: false, attackerWon: true };
  const thrash = createSwingClashVisuals({ battle, attacker: { num: 0, color: '#ff6644' },
    defender: { num: 1, color: '#44aaff' }, pointFor: n => V(n ? 2 : -2, .2, 0),
    ampOrigins: [V(-8, 1, -4), V(8, 1, -4)] });
  thrash.update(SWING_TIMING.attackerAmp - .01);
  assert.ok(thrash.figures.every(f => !f.beam.visible));
  for (const time of [SWING_TIMING.rivalAmp, SWING_TIMING.read, SWING_TIMING.clash]) {
    thrash.update(time);
    for (const [i, f] of thrash.figures.entries()) {
      const meshes = []; f.beam.traverse(o => { if (o.isMesh) meshes.push(o); });
      assert.equal(meshes.length, 0);
      assert.equal(f.spiral.points.geometry.drawRange.count, 2000);
      assert.ok(f.beam.localToWorld(V(0, -.5, 0)).distanceTo(f.origin) < 1e-6);
      const target = f.carrier.position.clone().add(V(time >= SWING_TIMING.clash ? (i ? -.9 : .9) : 0,
        time >= SWING_TIMING.clash ? 1.65 : 2.65, 0));
      assert.ok(f.beam.localToWorld(V(0, .5, 0)).distanceTo(target) < 1e-6);
    }
    assert.ok(thrash.figures[0].beam.scale.x > thrash.figures[1].beam.scale.x);
  }
  thrash.update(SWING_TIMING.result); assert.ok(thrash.figures.every(f => !f.beam.visible));
  thrash.dispose(); thrash.dispose();
});
console.log(`${count} production soundform checks passed.`);
