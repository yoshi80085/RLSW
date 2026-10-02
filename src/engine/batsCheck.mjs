import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeInitialState } from './state.js';
import { applyAction } from './reduce.js';
import { stageFxActivated, stageFxRoundTicked, moveStep, spiritWarped, spiritPatched,
  batsTicked, batTurnTimed, turnEnded } from './actions.js';
import { snapshot, restore, replay, assertJsonSafe } from './serialize.js';
import { ALL_HEXES, HEX_BY_NUM } from '../board/hexMap.js';
import { axialDist, axialNeighbors } from '../board/hexGeometry.js';
import { batTarget, batStep } from '../board/batRules.js';
import { createBatStage } from '../board/batStage.js';
import { arenaFrame } from '../board/arenaFrame.js';
import { BAT_COUNT, BAT_STEP_MS, BAT_FAN_GAIN, BAT_DAMAGE, STAGE_FX_IDS } from '../data/stageEffects.js';

let n = 0;
const eq = (a, b, label) => { assert.deepEqual(a, b, label); n++; };
const ok = (value, label) => { assert.ok(value, label); n++; };
const base = seed => makeInitialState({ spirits: [
  { id: 'wildaxe', num: 7, corner: 'blue', vibe: 10, maxVibe: 10 },
  { id: 'vera', num: 105, corner: 'red', vibe: 10, maxVibe: 10 },
], mode: 'ffa', winCondition: 'rounds', roundLimit: 15 }, seed);
const start = seed => applyAction(base(seed), stageFxActivated('bats', [7, 105, 40], 3));
const tick = (st, ms = BAT_STEP_MS) => batsTicked(st.stageFx.bats.tick, st.acting, st.turn.count, 90000, ms);
const positions = st => st.stageFx.bats.bats.map(b => b.num);
ok(STAGE_FX_IDS.includes('bats'), 'bats join the scheduled deck');
for (let seed = 0; seed < 30; seed++) {
  const st = start(seed);
  eq(positions(st).length, BAT_COUNT, 'four bats spawn');
  eq(new Set(positions(st)).size, BAT_COUNT, 'distinct starting hexes');
  ok(positions(st).every(n => ![7, 105, 40].includes(n)), 'no occupied spawns');
  eq(snapshot(start(seed)), snapshot(st), 'seeded activation');
}
const near = ALL_HEXES.find(h => h.num !== 56 && axialDist(h.q, h.r, HEX_BY_NUM[56].q, HEX_BY_NUM[56].r) === 1).num;
const far = ALL_HEXES.reduce((best, h) => axialDist(h.q, h.r, HEX_BY_NUM[56].q, HEX_BY_NUM[56].r) > axialDist(best.q, best.r, HEX_BY_NUM[56].q, HEX_BY_NUM[56].r) ? h : best).num;
const targets = [{ id: 'near', num: near, vibe: 10 }, { id: 'far', num: far, vibe: 10 }];
eq(batTarget(56, targets, { near: { fame: 4 }, far: { fame: 5 } },
  { near: { turns: 1, totalMs: 1e12 } }).id, 'far', 'one FP outweighs any slowness and distance');
eq(batTarget(56, targets, {}, { far: { turns: 1, totalMs: 2000 }, near: { turns: 1, totalMs: 1999 } }).id,
  'far', 'slower turn outweighs distance');
eq(batTarget(56, targets).id, 'near', 'distance breaks equal FP and timing');
eq(batTarget(56, targets, {}, {}, { spiritId: 'far', ms: 30000 }).id, 'far', 'unfinished decision time counts');
eq(batTarget(56, [{ ...targets[1], knockedOut: true }, targets[0]], { far: { fame: 100 } }).id, 'near', 'KO spirits excluded');
eq(batTarget(56, [{ ...targets[1], vibe: 0 }, targets[0]], { far: { fame: 100 } }).id, 'near', 'pending knockdowns excluded');
const oneStep = batStep(56, { num: far }, [], () => 0);
eq(axialDist(HEX_BY_NUM[56].q, HEX_BY_NUM[56].r, HEX_BY_NUM[oneStep].q, HEX_BY_NUM[oneStep].r), 1, 'one adjacent hex per beat');
const neighbors = axialNeighbors(HEX_BY_NUM[56].q, HEX_BY_NUM[56].r)
  .map(p => ALL_HEXES.find(h => h.q === p.q && h.r === p.r)?.num).filter(Boolean);
eq(batStep(56, { num: far }, neighbors, () => 0), 56, 'blocked bat waits');

let st = start(5150);
const before = snapshot(st);
let waiting = applyAction(st, tick(st, BAT_STEP_MS - 1));
eq(positions(waiting), positions(st), 'no move before 30 seconds');
eq(waiting.rng, st.rng, 'waiting consumes no RNG');
const firstTick = tick(waiting, 1);
const flown = applyAction(waiting, firstTick);
ok(flown.stageFx.lastBats.moves.length === 4, 'all four move at 30 seconds');
eq(flown.stageFx.bats.elapsedMs, 0, 'clock resets at the beat');
eq(snapshot(applyAction(flown, firstTick)), snapshot(flown), 'duplicate tick cannot move or damage twice');
eq(snapshot(st), before, 'reducers never mutate inputs');
const half = applyAction(st, tick(st, 15000));
const nextTurn = applyAction(half, turnEnded());
eq(applyAction(nextTurn, tick(nextTurn, 15000)).stageFx.lastBats.moves.length, 4, 'clock carries across turns');
const timedAction = batTurnTimed(st.acting, st.turn.count, 42000);
const timed = applyAction(st, timedAction);
eq(timed.stageFx.turnTiming[st.acting].totalMs, 42000, 'completed timing stored');
eq(snapshot(applyAction(timed, timedAction)), snapshot(timed), 'timing counted once per turn');
eq(snapshot(applyAction(st, batTurnTimed('wrong', st.turn.count, 1000))), snapshot(st), 'stale actor timing ignored');

for (const action of [moveStep, spiritWarped, (id, num) => spiritPatched(id, { num })]) {
  const bat = st.stageFx.bats.bats[0], id = st.acting;
  const eaten = applyAction(st, action(id, bat.num));
  eq(eaten.noteStates[id].casuals, st.noteStates[id].casuals + BAT_FAN_GAIN, 'entering bat grants fans');
  eq(eaten.spirits.find(s => s.id === id).vibe, 10, 'eating costs no Vibe');
  eq(eaten.stageFx.lastBats.eaten[0].spiritId, id, 'correct eater report');
  eq(positions(eaten).length, 4, 'eaten bat respawns');
  ok(!positions(eaten).includes(bat.num), 'respawn away from eater');
  const sameHex = applyAction(eaten, action(id, bat.num));
  eq(sameHex.noteStates[id].casuals, eaten.noteStates[id].casuals, 'standing still cannot eat twice');
  eq(sameHex.rng, eaten.rng, 'standing still never respawns a bat');
}
// A bat actually reaches the Spirit; merely being adjacent deals nothing.
const attackState = { ...st, spirits: st.spirits.map((s, i) => ({ ...s, num: i === 0 ? near : far })),
  noteStates: { ...st.noteStates, [st.acting]: { ...st.noteStates[st.acting], fame: 100 } },
  stageFx: { ...st.stageFx, bats: { ...st.stageFx.bats, obstacles: [],
    bats: [{ key: 'hunter', num: 56, flight: 0, targetId: null }] } } };
const attacked = applyAction(attackState, tick(attackState));
eq(attacked.spirits[0].vibe, 10 - BAT_DAMAGE, 'bat arrival loses Vibe');
eq(attacked.damageLedger[st.acting].taken, BAT_DAMAGE, 'damage ledger credited');
eq(attacked.noteStates[st.acting].casuals, attackState.noteStates[st.acting].casuals, 'bat arrival gives no fans');
eq(attacked.stageFx.lastBats.hits[0].hexNum, near, 'hit only at occupied destination');
ok(!attacked.spirits.some(s => positions(attacked).includes(s.num)), 'attacker respawns clear');
let ended = st;
for (let i = 0; i < 3; i++) ended = applyAction(ended, stageFxRoundTicked());
eq(ended.stageFx.bats, null, 'effect expires with scheduled show');
const log = [stageFxActivated('bats', [7, 105, 40], 3), timedAction];
let live = base(5150);
for (const a of log) live = applyAction(live, a);
for (let i = 0; i < 12; i++) { const a = tick(live); log.push(a); live = applyAction(live, a); }
eq(snapshot(replay(restore(snapshot(base(5150))), log)), snapshot(live), 'bat actions replay byte identically');
ok(assertJsonSafe(live), 'bat state is plain JSON');

const scene = new THREE.Scene();
let disposed = 0;
const props = createBatStage(scene, { pointFor: (num, height) => new THREE.Vector3(HEX_BY_NUM[num].q, height, HEX_BY_NUM[num].r),
  release: o => { o.traverse(n => { n.geometry?.dispose(); n.material?.dispose(); }); disposed++; } });
const frame = arenaFrame({ spirits: [], bats: st.stageFx.bats.bats });
props.update(frame.bats); props.tick(1);
eq(props.count, 4, '3D arena renders four bats');
const first = scene.getObjectByName(st.stageFx.bats.bats[0].key);
const wing = first.children.find(c => c.type === 'Group');
const angle = wing.rotation.y; props.tick(1.1);
ok(angle !== wing.rotation.y, 'wings flap');
props.update(frame.bats.map((b, i) => i ? b : { ...b, num: 56, flight: b.flight + 1 }));
props.tick(3, { reduced: true });
eq(first.position.x, HEX_BY_NUM[56].q, '3D bat reaches its engine hex');
props.update([]); eq(props.count, 0, 'expired bat visuals cleared'); eq(disposed, 4, 'bat resources released');
props.dispose(); eq(scene.children.length, 0, 'bat layer removed on disposal');
console.log(`✅ batsCheck: ${n} assertions passed`);
