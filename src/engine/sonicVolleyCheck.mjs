// Projectile combat rules and their turn-start/knockback integration.
// node --import ./src/engine/testAssetStub.mjs src/engine/sonicVolleyCheck.mjs
import assert from 'node:assert/strict';
import { makeInitialState } from './state.js';
import { makeRng } from './rng.js';
import { applyAction } from './reduce.js';
import { attackRolled, attackRerolled, damageApplied, knockdownResolved } from './actions.js';
import { applyAttackRolled, applyAttackRerolled, sonicVolleyFame } from './systems/combat.js';
import { startTurnNotes } from './systems/turnFlow.js';
import { battleConsequences, knockback, runBattleFlow } from './systems/battleFlow.js';
import { ALL_HEXES, HEX_BY_NUM } from '../board/hexMap.js';
import { straightNeighborInDirection, angleTo, axialNeighbors } from '../board/hexGeometry.js';
import { COL_SPACING, ROW_SPACING } from '../board/constants.js';

const ATTACKER = 'cosmic_ronin';
const DEFENDER = 'Metalness_Monster';
let checks = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const ok = (condition, message) => { assert.ok(condition, message); checks++; };
const sustain = ['C', 'E', 'G', 'B', 'D'];

function lineAcrossBoard() {
  for (const origin of ALL_HEXES) {
    for (let face = 0; face < 6; face++) {
      const angle = face * Math.PI / 3;
      const line = [origin];
      let next = straightNeighborInDirection(origin, angle);
      while (next && !line.includes(next)) {
        line.push(next);
        next = straightNeighborInDirection(next, angle);
      }
      if (line.length >= 7) return line;
    }
  }
  throw new Error('Need a board lane with enough room to exercise knockback');
}
const lane = lineAcrossBoard();
function fresh({ elimination = 'on', edge = false, lives = 3 } = {}) {
  const state = makeInitialState({
    mode: 'ffa', startingLives: lives, elimination,
    spirits: [
      { id: ATTACKER, name: 'Ronin', num: lane[edge ? lane.length - 2 : 0].num,
        corner: 'blue', facing: angleTo(lane[0],lane[1]), vibe: 12, maxVibe: 12 },
      { id: DEFENDER, name: 'Metalness', num: lane[edge ? lane.length - 1 : 1].num,
        corner: 'purple', facing: 0, vibe: 12, maxVibe: 12 },
    ],
  }, 777);
  state.noteStates[ATTACKER] = { ...state.noteStates[ATTACKER], driveStack: ['C', 'E', 'G'], fame: 0, diehards: 0, casuals: 0 };
  state.noteStates[DEFENDER] = { ...state.noteStates[DEFENDER], sustainStack: [...sustain], fame: 0 };
  return state;
}
const target = state => state.spirits.find(s => s.id === DEFENDER);
const shot = (over = {}) => ({ kind: 'sonic', attackerId: ATTACKER, defenderId: DEFENDER,
  atkStat: 5, defStat: 4, dicePool: [6, 6, 6, 6, 6], ...over });
function draws(values) {
  let cursor = 0;
  return {
    int(sides) {
      const value = values[cursor++];
      assert.ok(value >= 1 && value <= sides, 'exactly the requested die is drawn');
      return value - 1;
    },
    cursor: () => cursor,
  };
}
function play(state, { hooks = {}, fx = [] } = {}) {
  const rng = makeRng(91);
  return runBattleFlow(battleConsequences({
    state, battle: state.battle, chordOf: (_id, notes) => ({ name: notes.join(' '), sustain: notes.length }),
  }), state, {
    applyAction: (s, action) => applyAction(s, action, rng),
    onFx: effect => fx.push(effect),
    hooks: { knockOut: (s, effect) => applyAction(s, knockdownResolved(effect.spiritId), rng), ...hooks },
  });
}

// The spec's worked example: ties absorb, every die remains visible, no defence draw.
{
  const before = fresh();
  const rng = draws([6, 6, 5, 1, 4]);
  const state = applyAttackRolled(before, shot(), rng);
  eq(rng.cursor(), 5, 'a five-wave volley draws five values, with no defence die');
  eq(state.battle.diceVals, [6, 6, 5, 1, 4], 'every rolled face is retained for presentation');
  eq(state.battle.diceHits, [true, true, true, false, false], 'ties are absorbed');
  eq(state.battle.hitCount, 3, 'three dice beat Sustain four');
  eq(state.battle.shieldValue, 4, 'the shield is one fixed value');
  eq(state.battle.damage, 1, 'three hits cause only one Vibe chip');
  eq(state.noteStates[DEFENDER].sustainStack, sustain, 'the held chord is untouched');
  eq(state.noteStates[DEFENDER].pendingSonicAttacks, 1, 'one volley charges one deferred note');
  eq(before.noteStates[DEFENDER].pendingSonicAttacks ?? 0, 0, 'the input state remains unchanged');
  const rerolled = applyAttackRerolled(state, {}, draws([1, 2, 3, 4, 4]));
  eq(rerolled.battle.hitCount, 0, 'Code Injection recomputes all projectile outcomes');
  eq(rerolled.battle.damage, 0, 'a fully absorbed volley deals zero Vibe');
  eq(rerolled.battle.shieldValue, 4, 'reroll preserves the same Sustain shield');
  eq(rerolled.noteStates[DEFENDER].pendingSonicAttacks, 1, 'a reroll never bills a second attack');
}

// Seeded replay uses exactly the same draws and snapshot on both runs.
{
  const run = () => {
    const rng = makeRng(12345);
    const state = applyAction(fresh(), attackRolled('sonic', ATTACKER, DEFENDER,
      { atkStat: 5, defStat: 4, dicePool: [6, 6, 6, 6, 6] }), rng);
    eq(rng.state().cursor, 5, 'initial Sonic draw cursor excludes defence');
    return applyAction(state, attackRerolled(), rng);
  };
  const a = run();
  eq(a, run(), 'seeded attack and reroll replay byte-for-byte');
  eq(a.rng.cursor, 10, 'reroll uses only another five projectile draws');
}

// Posing is an explicitly dropped shield, and a ceiling/floor boost stays on every die.
{
  const state = applyAttackRolled(fresh(), shot({ posing: true, atkFloor: 2 }), draws([1, 1, 1, 1, 1]));
  eq(state.battle.shieldValue, 0, 'a pose explicitly gives up Sustain protection');
  eq(state.battle.diceVals, [3, 3, 3, 3, 3], 'a charged floor affects all projectiles');
  eq(state.battle.hitCount, 5, 'all projectiles beat the dropped shield');
  eq(state.battle.damage, 2, 'five hits reach the small Vibe cap');
  const empty = applyAttackRolled(fresh(), shot({ atkStat: 0, dicePool: [] }), draws([]));
  eq(empty.battle.hitCount, 0, 'an explicit empty charge never invents a fallback die');
  eq(sonicVolleyFame(0), 0, 'no hit grants no base Fame');
}

// Shield wear counts declarations, not hits, then settles once at the owner's turn.
{
  let state = fresh();
  for (let i = 0; i < 3; i++) state = applyAttackRolled(state, shot(), draws([1, 1, 1, 1, 1]));
  eq(state.noteStates[DEFENDER].pendingSonicAttacks, 3, 'even three blocked volleys accrue three declarations');
  eq(state.noteStates[DEFENDER].sustainStack, sustain, 'all rivals face the same held chord');
  const tick = startTurnNotes(state.noteStates[DEFENDER], { spiritId: DEFENDER });
  eq(tick.patch.sustainStack, ['C', 'E', 'G'], 'upkeep removes at most two tail notes');
  eq(tick.report.sustainFray.lostNotes, ['B', 'D'], 'presentation gets the exact lost notes');
  eq(tick.report.sustainFray.pendingAttacks, 3, 'the report explains the accrued attacks');
  eq(tick.patch.pendingSonicAttacks, 0, 'upkeep clears the old attack tally');
  const quiet = startTurnNotes({ ...state.noteStates[DEFENDER], ...tick.patch }, { spiritId: DEFENDER });
  eq(quiet.patch.sustainStack, ['C', 'E'], 'an unpressured next turn pays only natural decay');
  for (const notes of [[], ['C'], ['C', 'E']]) {
    const floor = startTurnNotes({ ...state.noteStates[DEFENDER], sustainStack: notes, pendingSonicAttacks: 99 });
    eq(floor.patch.sustainStack, notes.length ? ['C'] : [], 'the root survives even overwhelming upkeep');
  }
}

// A absorbed volley has no retaliation; a connecting volley shoves once per hit.
{
  const before = fresh();
  const miss = play(applyAttackRolled(before, shot(), draws([1, 1, 2, 3, 4]))).state;
  eq(miss.spirits, before.spirits, 'all-blocked Sonic neither hurts nor reverse-shoves either Spirit');
  eq(miss.noteStates[ATTACKER].fame, 0, 'no attacking Fame on an absorbed volley');
  eq(miss.noteStates[DEFENDER].fame, 0, 'no counterattack Fame for defending');
  const hit = play(applyAttackRolled(before, shot(), draws([6, 6, 5, 1, 4]))).state;
  eq(target(hit).num, lane[4].num, 'three beams through shove exactly three hexes');
  eq(target(hit).vibe, 11, 'the volley chips once after its shove');
  eq(hit.noteStates[DEFENDER].sustainStack, sustain, 'consequences cannot immediately fray Sustain');
  ok(hit.noteStates[ATTACKER].fame >= 3, 'hit-count Fame passes through the shared reward pipeline');
}

// Sonic can ring out; other attacks keep the existing hard board edge.
for (const elimination of ['on', 'off']) {
  const fx = [];
  const state = play(applyAttackRolled(fresh({ edge: true, elimination }), shot(), draws([6, 6, 5, 1, 4])), { fx }).state;
  eq(target(state).lives, elimination === 'on' ? 2 : 3, 'ring-outs respect the elimination mode');
  eq(target(state).num, 12, 'ring-out uses the normal home respawn');
  eq(target(state).vibe, 12, 'the fresh respawn never takes the old volley chip');
  ok(fx.some(effect => effect.name === 'ringOut'), 'the edge crossing emits its own presentation cue');
  ok(state.noteStates[ATTACKER].fame > 0, 'the connecting volley still earns Fame after ring-out');
}
{
  const state = fresh({ edge: true });
  const rng = makeRng(6);
  const stop = runBattleFlow(knockback({ state, fromId: ATTACKER, targetId: DEFENDER, spaces: 3 }), state,
    { applyAction: (s, action) => applyAction(s, action, rng) });
  eq(target(stop.state), target(state), 'ordinary knockback still stops at the stage edge');
  const out = play(applyAttackRolled(fresh({ edge: true, lives: 1 }), shot(), draws([6, 6, 5, 1, 4]))).state;
  eq(target(out).knockedOut, true, 'last-life ring-out follows normal elimination');
}

// Hazards interrupt the shove even when no-elimination respawns at the same hex.
{
  const state = fresh({ elimination: 'off' });
  state.spirits = state.spirits.map(s => s.id === DEFENDER ? { ...s, corner: null } : s);
  let hazardEntries = 0;
  const rng = makeRng(44);
  const result = play(applyAttackRolled(state, shot(), draws([6, 6, 5, 1, 4])), { hooks: {
    hexHazards: (live, effect) => {
      hazardEntries++;
      const victim = target(live);
      const hurt = applyAction(live, damageApplied(effect.spiritId, victim.vibe), rng);
      return applyAction(hurt, knockdownResolved(effect.spiritId), rng);
    },
  } }).state;
  eq(hazardEntries, 1, 'a lethal first hazard stops all remaining knockback steps');
  eq(target(result).num, lane[2].num, 'same-hex respawn cannot be dragged along the old path');
  eq(target(result).vibe, 12, 'hazard respawn takes no follow-up Sonic chip');
  eq(target(result).knockdownCount, 1, 'knockdown generation identifies same-position recovery');
}

ok(HEX_BY_NUM[target(fresh()).num], 'fixtures keep Spirits on actual board hexes');
// Facing is frozen at declaration, independent of later turns or target bearing.
for(const {q,r} of axialNeighbors(0,0)){
  const angle=Math.atan2((r+q/2)*ROW_SPACING,q*COL_SPACING);
  const before=fresh();
  before.spirits=before.spirits.map(s=>({...s,num:s.id===ATTACKER?55:56,facing:angle}));
  const rolled=applyAttackRolled(before,shot({dicePool:[6],sonicChordNotes:['C','E','G']}),draws([6]));
  eq(rolled.battle.sonicFacing,angle,'the attacking facing is frozen');
  rolled.spirits=rolled.spirits.map(s=>s.id===ATTACKER?{...s,facing:angle+Math.PI}:s);
  // Put the attacker outside the shove destination without changing its snapshot.
  rolled.spirits[0]={...rolled.spirits[0],num:7};
  const events=[];
  const after=play(rolled,{fx:events}).state;
  eq(target(after).num,straightNeighborInDirection(HEX_BY_NUM[56],angle).num,'one hit moves one hex along original facing');
  eq(events.filter(e=>e.name==='sonicContact').map(e=>e.shotIndex),[0],'contact boundary precedes the shove');
}
console.log(`Sonic volley: ${checks} checks passed.`);
