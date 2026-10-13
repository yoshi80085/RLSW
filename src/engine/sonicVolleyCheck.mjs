// Projectile combat rules and their turn-start/knockback integration.
// node --import ./src/engine/testAssetStub.mjs src/engine/sonicVolleyCheck.mjs
import assert from 'node:assert/strict';
import { makeInitialState } from './state.js';
import { makeRng } from './rng.js';
import { applyAction } from './reduce.js';
import { attackRolled, attackRerolled, damageApplied, knockdownResolved, turnStarted } from './actions.js';
import { isWaiting, isRingedOut, isEntranceHex } from './systems/entrance.js';
import { RING_OUT_FP, SONIC_VIBE_CAP, SONIC_FAME_CAP, SHIELD_HELD_FP, FAN_DIEHARD_START } from '../data/gameConstants.js';
import { crowdMultiplier } from '../board/boardHelpers.js';
import { applyAttackRolled, applyAttackRerolled, sonicVolleyFame, sonicVibe, sonicStrengthFame, sonicDamage, thrashFame } from './systems/combat.js';
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
const shot = (over = {}) => ({ kind: 'sonic', sonicVersion:2, attackerId: ATTACKER, defenderId: DEFENDER,
  atkStat: 5, defStat: 3, dicePool: [6, 6, 6, 6, 6], ...over });
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

// The spec's worked example: ties absorb, every die remains visible, rolled defence HP.
{
  const before = fresh();
  const rng = draws([6, 6, 5, 1, 4, 5, 4, 3]);
  const state = applyAttackRolled(before, shot(), rng);
  eq(rng.cursor(), 8, 'a five-wave volley draws five values, plus three defence dice');
  eq(state.battle.diceVals, [6, 6, 5, 1, 4], 'every rolled face is retained for presentation');
  eq(state.battle.diceHits, [false, false, true, true, true], 'exact shield break has no spillover');
  eq(state.battle.hitCount, 3, 'three projectiles penetrate the HP shield');
  eq(state.battle.shieldValue, 12, 'Sustain faces sum into shield HP');
  eq(state.battle.strengthThrough, 10, '5 + 1 + 4 = 10 points get past the 12 shield');
  eq(state.battle.damage, 3, '🔊 10 points through deal 3 Vibe (1 per 4, cap 3) — dice-through paid 1 here (2026-10-13)');
  eq(state.noteStates[DEFENDER].sustainStack, sustain, 'the held chord is untouched');
  eq(state.noteStates[DEFENDER].pendingSonicAttacks, 1, 'one volley charges one deferred note');
  eq(before.noteStates[DEFENDER].pendingSonicAttacks ?? 0, 0, 'the input state remains unchanged');
  const rerolled = applyAttackRerolled(state, {}, draws([1, 2, 3, 2, 4]));
  eq(rerolled.battle.hitCount, 0, 'Code Injection recomputes all projectile outcomes');
  eq(rerolled.battle.damage, 0, 'a fully absorbed volley deals zero Vibe');
  eq(rerolled.battle.shieldValue, 12, 'reroll preserves the same Sustain shield');
  eq(rerolled.noteStates[DEFENDER].pendingSonicAttacks, 1, 'a reroll never bills a second attack');
}

// Seeded replay uses exactly the same draws and snapshot on both runs.
{
  const run = () => {
    const rng = makeRng(12345);
    const state = applyAction(fresh(), attackRolled('sonic', ATTACKER, DEFENDER,
      { atkStat: 5, defStat: 3, dicePool: [6, 6, 6, 6, 6] }), rng);
    eq(rng.state().cursor, 8, 'initial Sonic draws both pools');
    return applyAction(state, attackRerolled(), rng);
  };
  const a = run();
  eq(a, run(), 'seeded attack and reroll replay byte-for-byte');
  eq(a.rng.cursor, 13, 'reroll uses only another five projectile draws');
}

// Posing is an explicitly dropped shield, and a ceiling/floor boost stays on every die.
{
  const state = applyAttackRolled(fresh(), shot({ posing: true, atkFloor: 2 }), draws([1, 1, 1, 1, 1, 5, 4, 3]));
  eq(state.battle.shieldValue, 0, 'a pose explicitly gives up Sustain protection');
  eq(state.battle.diceVals, [3, 3, 3, 3, 3], 'a charged floor affects all projectiles');
  eq(state.battle.hitCount, 5, 'all projectiles beat the dropped shield');
  eq(state.battle.damage, SONIC_VIBE_CAP, '🔊 15 points through hit the Vibe cap of 3');
  const empty = applyAttackRolled(fresh(), shot({ atkStat: 0, dicePool: [] }), draws([5,4,3]));
  eq(empty.battle.hitCount, 0, 'an explicit empty charge never invents a fallback die');
  eq(sonicVolleyFame(0), 0, 'no hit grants no base Fame');
}

// Shield wear counts declarations, not hits, then settles once at the owner's turn.
{
  let state = fresh();
  for (let i = 0; i < 3; i++) state = applyAttackRolled(state, shot(), draws([1, 1, 1, 1, 1, 5, 4, 3]));
  eq(state.noteStates[DEFENDER].pendingSonicAttacks, 3, 'even three blocked volleys accrue three declarations');
  eq(state.noteStates[DEFENDER].sustainStack, sustain, 'all rivals face the same held chord');
  const tick = startTurnNotes(state.noteStates[DEFENDER], { spiritId: DEFENDER });
  eq(tick.patch.sustainStack, ['C', 'E', 'G'], 'upkeep removes at most two tail notes');
  eq(tick.report.sustainFray.lostNotes, ['B', 'D'], 'presentation gets the exact lost notes');
  eq(tick.report.sustainFray.pendingAttacks, 3, 'the report explains the accrued attacks');
  eq(tick.patch.pendingSonicAttacks, 0, 'upkeep clears the old attack tally');
  const quiet = startTurnNotes({ ...state.noteStates[DEFENDER], ...tick.patch }, { spiritId: DEFENDER });
  eq(quiet.patch.sustainStack, ['C', 'E', 'G'], '🪦 no natural decay: an unpressured turn keeps every Sustain note (Alex, 2026-09-25)');
  eq(quiet.report.sustainFray.frayed, 0, 'a quiet turn reports nothing lost, so the client logs nothing');
  const oneShot = startTurnNotes({ ...state.noteStates[DEFENDER], sustainStack: ['C', 'E', 'G'], pendingSonicAttacks: 1 });
  eq(oneShot.patch.sustainStack, ['C', 'E'], 'one volley taken still bills one note');
  for (const notes of [[], ['C'], ['C', 'E']]) {
    const floor = startTurnNotes({ ...state.noteStates[DEFENDER], sustainStack: notes, pendingSonicAttacks: 99 });
    eq(floor.patch.sustainStack, notes.length ? ['C'] : [], 'the root survives even overwhelming upkeep');
  }
}

// A absorbed volley has no retaliation; a connecting volley shoves a hex per 2
// strength through (Alex, 2026-10-07 — it was once per hit).
{
  const before = fresh();
  const miss = play(applyAttackRolled(before, shot(), draws([1, 1, 2, 3, 4, 5, 4, 3]))).state;
  eq(miss.spirits, before.spirits, 'all-blocked Sonic neither hurts nor reverse-shoves either Spirit');
  eq(miss.noteStates[ATTACKER].fame, 0, 'no attacking Fame on an absorbed volley');
  // 🛡️ 2026-10-13: a shield that lets nothing through pays its owner 1 FP × crowd.
  const crowd0 = crowdMultiplier(miss.noteStates[DEFENDER].diehards ?? FAN_DIEHARD_START, miss.noteStates[DEFENDER].casuals ?? 0, 0);
  eq(miss.noteStates[DEFENDER].fame, Math.max(SHIELD_HELD_FP, Math.round(SHIELD_HELD_FP * crowd0)),
    '🛡️ a held shield pays the defender 1 FP times their crowd');
  const hit = play(applyAttackRolled(before, shot(), draws([6, 6, 5, 1, 4, 5, 4, 3]))).state;
  // 6,6 soak the 12 shield (5+4+3); 5, 1 and 4 get through: 10 strength on three beams.
  eq(hit.battle?.strengthThrough ?? 10, 10, 'ten strength gets through on three beams');
  eq(target(hit).num, lane[6].num, 'ten strength through shoves five hexes (one per 2), not three (one per beam)');
  eq(target(hit).vibe, 9, '🔊 the volley chips 3 Vibe (10 through) after its shove');
  eq(hit.noteStates[DEFENDER].sustainStack, sustain, 'consequences cannot immediately fray Sustain');
  eq(hit.noteStates[ATTACKER].fame, 5, '🔊 10 through pays the capped base of 5 (no crowd on this fixture)');
  eq(hit.noteStates[DEFENDER].fame, 0, '🛡️ a broken shield pays its owner nothing');
}

// Sonic can ring out; other attacks keep the existing hard board edge.
// 🔊 RING-OUT (Alex, 2026-10-07): back to the pad, beamed on at his next turn;
// "A Ring out is the same as a Knock Out" — a life, 1 FP, Vibe back, no notes,
// no fans — and the Spirit who did it is paid extra.
for (const elimination of ['on', 'off']) {
  const fx = [];
  const start = fresh({ edge: true, elimination });
  start.noteStates[DEFENDER] = { ...start.noteStates[DEFENDER], fame: 5, diehards: 3 };
  const state = play(applyAttackRolled(start, shot(), draws([6, 6, 5, 1, 4, 5, 4, 3])), { fx }).state;
  const t = target(state);
  eq(t.lives, elimination === 'on' ? 2 : 3, `🔊 [${elimination}] a ring-out costs a life, like a knockdown (when lives are spent)`);
  eq([t.num, isWaiting(t), isRingedOut(t)], [null, true, true], '🔊 …he is off the board, waiting on his pad');
  ok(isEntranceHex(state, 12), '🔊 …and his home hex is reserved for his return');
  eq(t.vibe, t.maxVibe, '🔊 …Vibe restored (the volley chip never lands on a Spirit who left)');
  eq(t.knockdownCount ?? 0, 1, '🔊 …and it counts as a knockdown');
  eq(state.noteStates[DEFENDER].fame, 4, '💸 the slight FP drain: −1');
  eq(state.noteStates[DEFENDER].recoveryNotesOwed ?? 0, 0, '🎸 no notes owed to get up');
  eq(state.noteStates[DEFENDER].diehards, 3, '🎪 his crowd stays put');
  ok(fx.some(effect => effect.name === 'ringOut'), 'the edge crossing emits its own presentation cue');
  ok(state.noteStates[ATTACKER].fame >= RING_OUT_FP, `⭐ the Spirit who rang him out is paid (≥ ${RING_OUT_FP} FP)`);
  // His own next turn: beamed back on, exactly the way he first came in — minus the opening gift.
  const back = applyAction({ ...state, acting: DEFENDER }, turnStarted(DEFENDER), makeRng(3));
  const b = target(back);
  eq([b.num, isWaiting(b)], [12, false], '🔊 his next turn starts with him back on his home hex');
  eq(back.noteStates[DEFENDER].diehards, 3, '🎪 …with the crowd he had (no second +2)');
  eq([back.turn.lastEntrance?.spiritId, back.turn.lastEntrance?.fans, back.turn.lastEntrance?.ringOut], [DEFENDER, 0, 1],
    '🎬 …reported as a ring-out return for the client\'s beam-down and hop');
}
// 🔊 Someone standing on his home hex when he comes back: the nearest free hex, never a shove.
{
  const start = fresh({ edge: true });
  const state = play(applyAttackRolled(start, shot(), draws([6, 6, 5, 1, 4, 5, 4, 3]))).state;
  const squat = { ...state, spirits: state.spirits.map(s => s.id === ATTACKER ? { ...s, num: 12 } : s) };
  const back = applyAction({ ...squat, acting: DEFENDER }, turnStarted(DEFENDER), makeRng(3));
  const b = target(back);
  ok(b.num != null && b.num !== 12, `🔊 home hex taken → he lands beside it (#${b.num})`);
  eq(back.turn.lastEntrance?.contested, undefined, '🔊 …uncontested');
  eq(back.spirits.find(s => s.id === ATTACKER).num, 12, '🔊 …and the squatter is not moved');
}
{
  const state = fresh({ edge: true });
  const rng = makeRng(6);
  const stop = runBattleFlow(knockback({ state, fromId: ATTACKER, targetId: DEFENDER, spaces: 3 }), state,
    { applyAction: (s, action) => applyAction(s, action, rng) });
  eq(target(stop.state), target(state), 'ordinary knockback still stops at the stage edge');
  const out = play(applyAttackRolled(fresh({ edge: true, lives: 1 }), shot(), draws([6, 6, 5, 1, 4, 5, 4, 3]))).state;
  eq(target(out).knockedOut, true, '🔊 a last-life ring-out is a knockout, like any knockdown');
}

// Hazards interrupt the shove even when no-elimination respawns at the same hex.
{
  const state = fresh({ elimination: 'off' });
  state.spirits = state.spirits.map(s => s.id === DEFENDER ? { ...s, corner: null } : s);
  let hazardEntries = 0;
  const rng = makeRng(44);
  const result = play(applyAttackRolled(state, shot(), draws([6, 6, 5, 1, 4, 5, 4, 3])), { hooks: {
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
  const rolled=applyAttackRolled(before,shot({dicePool:[6],defStat:0,sonicChordNotes:['C','E','G']}),draws([2]));  // 2 through → one hex
  eq(rolled.battle.sonicFacing,angle,'the attacking facing is frozen');
  rolled.spirits=rolled.spirits.map(s=>s.id===ATTACKER?{...s,facing:angle+Math.PI}:s);
  // Put the attacker outside the shove destination without changing its snapshot.
  rolled.spirits[0]={...rolled.spirits[0],num:7};
  const events=[];
  const after=play(rolled,{fx:events}).state;
  eq(target(after).num,straightNeighborInDirection(HEX_BY_NUM[56],angle).num,'2 strength through moves one hex along original facing');
  eq(events.filter(e=>e.name==='sonicBarrageLanded').map(e=>e.spiritId),[DEFENDER],'contact boundary precedes the shove');
}

// Historical action logs have no version marker and must keep their draw cursor.
{
  const legacy=shot({sonicVersion:undefined,defStat:4});delete legacy.sonicVersion;
  const rng=draws([6,6,5,1,4]);
  const old=applyAttackRolled(fresh(),legacy,rng);
  eq(old.battle.diceHits,[true,true,true,false,false],'legacy replay uses its fixed shield');
  eq(rng.cursor(),5,'legacy replay draws no Sustain dice');
  const reroll=applyAttackRerolled(old,{},draws([1,2,3,4,4]));
  eq(reroll.battle.hitCount,0,'legacy reroll retains fixed-shield semantics');
}


// ═══ 🔊 THE SONIC REWORK — points through, not dice (2026-10-13) ═══════════════
// `claude/sonic-vibe-fame-rework-spec.md`. Every number below is Alex's table.
{
  // §R1 Vibe: 1 per 4 points through, cap 3.
  for (const [t, v] of [[0,0],[-3,0],[1,1],[4,1],[5,2],[8,2],[9,3],[12,3],[13,3],[40,3]])
    eq(sonicVibe(t), v, `§R1 ${t} through → ${v} Vibe`);
  // §R2 Fame base: 1 + 1 per 3 through, cap 5 per attack.
  for (const [t, f] of [[0,0],[1,2],[3,2],[4,3],[6,3],[7,4],[9,4],[10,5],[20,5],[99,5]])
    eq(sonicStrengthFame(t), f, `§R2 ${t} through → ${f} base Fame`);
  eq(SONIC_FAME_CAP, 5, '§R2 the per-attack base cap is 5 (Alex, 2026-10-13: "maybe thats a good idea afterall")');
  for (let t = 1; t <= 30; t++) ok(sonicStrengthFame(t) > thrashFame(), `§R2 a Sonic landing ${t} through out-earns a Thrash win`);
  // §R3 The legacy v1 table did not move (old replays re-score identically).
  eq([0,1,4,5,9].map(sonicDamage), [0,1,1,2,2], '§R3 legacy sonicDamage keeps 1–2');
  eq([0,2,5].map(sonicVolleyFame), [0,2,5], '§R3 legacy dice-through Fame unchanged');
}
// §R4 Two dice putting 9 through vs five dice scraping 3 — the exact case the rework is for.
{
  const two = applyAttackRolled(fresh(), shot({ dicePool: [6, 6] }), draws([6, 6, 1, 1, 1]));   // shield 3, 12 thrown → 9 through
  eq([two.battle.hitCount, two.battle.strengthThrough, two.battle.damage], [2, 9, 3], '§R4 two dice, 9 through → 3 Vibe (dice-through paid 1)');
  const five = applyAttackRolled(fresh(), shot(), draws([2, 2, 2, 2, 2, 3, 2, 2]));           // shield 7, 10 thrown → 3 through
  eq([five.battle.hitCount, five.battle.strengthThrough, five.battle.damage], [2, 3, 1], '§R4 scraping 3 through → 1 Vibe');
  eq(play(two).state.noteStates[ATTACKER].fame, 4, '§R4 9 through pays 4 base Fame');
  eq(play(five).state.noteStates[ATTACKER].fame, 2, '§R4 a 3-point scrape still pays 2 — more than a Thrash');
}
// §R5 The crowd rides on top of the cap: the cap is on the BASE, not the payout.
{
  const start = fresh();
  start.noteStates[ATTACKER] = { ...start.noteStates[ATTACKER], diehards: 5 };
  const won = play(applyAttackRolled(start, shot(), draws([6, 6, 5, 1, 4, 5, 4, 3]))).state;
  const mult = crowdMultiplier(5, 0, 0);
  ok(mult > 1, '§R5 fixture has a real crowd');
  eq(won.noteStates[ATTACKER].fame, Math.max(5, Math.round(5 * mult)), '§R5 base 5 × crowd — the cap does not clip the crowd');
  ok(won.noteStates[ATTACKER].fame > SONIC_FAME_CAP, '§R5 so a big Sonic in front of a big crowd pays past 5');
}
// §R6 Held shield: 1 × the DEFENDER's crowd, no other riders; exact-break pays; legacy v1 never does.
{
  const start = fresh();
  start.noteStates[DEFENDER] = { ...start.noteStates[DEFENDER], diehards: 4 };
  start.headliner = DEFENDER;                                         // 👑 must NOT ride the block
  const held = play(applyAttackRolled(start, shot(), draws([1, 1, 2, 3, 4, 5, 4, 3]))).state;  // 11 vs 12
  eq(held.noteStates[DEFENDER].fame, Math.max(1, Math.round(1 * crowdMultiplier(4, 0, 0))), '§R6 1 FP × crowd, and no Headliner rider');
  eq(held.noteStates[ATTACKER].fame, 0, '§R6 the attacker earns nothing for a held shield');
  const exact = play(applyAttackRolled(fresh(), shot(), draws([6, 6, 1, 1, 1, 5, 4, 6]))).state; // 15 vs 15: breaks on its last point
  eq(exact.battle?.strengthThrough ?? 0, 0, '§R6 exact break: nothing through');
  ok(exact.noteStates[DEFENDER].fame > 0, '§R6 an exact break still pays — nothing reached the Spirit');
  const legacy = shot({ defStat: 9 }); delete legacy.sonicVersion;
  const old = play(applyAttackRolled(fresh(), legacy, draws([1, 2, 3, 4, 5]))).state;
  eq(old.noteStates[DEFENDER].fame, 0, '§R6 the legacy v1 volley never pays a block');
}
// §R7 Psycho Bushido: held shield pays the same; a landed burst keeps its own Vibe (all through) but Sonic Fame.
{
  const base = fresh();
  const bushido = (over) => ({ ...base, battle: { kind: 'attack', attackKind: 'bushido', sonicAttack: true, sonicVersion: 2,
    bushido: true, attackerId: ATTACKER, defenderId: DEFENDER, margin: 0, shieldValue: 8, ...over } });
  const held = play(bushido({ hitCount: 0, attackerWon: false, strengthThrough: 0, damage: 0, shieldRemaining: 2 })).state;
  ok(held.noteStates[DEFENDER].fame > 0, '§R7 a shield that holds a Bushido draw pays its owner');
  const hit = play(bushido({ hitCount: 1, attackerWon: true, strengthThrough: 7, damage: 7, shieldRemaining: 0, diceHits: [true] })).state;
  eq(hit.noteStates[ATTACKER].fame, 4, '§R7 a Bushido burst is paid Sonic Fame from points (7 through → 4)');
}
// §R8 Code Injection and the marquee card re-throw recompute Vibe from points.
{
  const first = applyAttackRolled(fresh(), shot(), draws([1, 1, 2, 3, 4, 5, 4, 3]));          // 0 through
  const re = applyAttackRerolled(first, {}, draws([6, 6, 6, 6, 6]));                          // 30 vs 12 → 18 through
  eq([re.battle.strengthThrough, re.battle.damage], [18, 3], '§R8 a reroll recomputes Vibe from points through');
}

// §R9 🎤 THE CROWD REACHES EVERY FAME GAIN (Alex, 2026-10-13: "fan bonus should
// basically exist in all facets of FP gain"). Read the SOURCE, both halves (§B2):
// every positive grant goes through `grantFame` with `amplify` on; the one
// exception is the developer test button. Add a payout that skips the crowd and
// this fails — make it amplify, or bring it to Alex.
{
  const fs = await import('node:fs');
  const read = rel => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
  const engineSrc = ['./systems/battleFlow.js', './policies/transition.js', './systems/economy.js'].map(read).join('\n');
  eq((engineSrc.match(/amplify\s*:\s*false/g) ?? []).length, 0, '§R9 no engine Fame grant opts out of the crowd');
  const client = read('../rlsw-simulator-v3_8_1.jsx');
  const optOuts = [...client.matchAll(/grantFame\([^)]*,\s*false\s*[,)]/g)].map(m => m[0]);
  eq(optOuts.length, 1, '§R9 the client has exactly one un-amplified grant…');
  ok(/test grant/.test(optOuts[0] ?? ''), '§R9 …and it is the 🧪 developer test button');
  const direct = [...client.matchAll(/dispatch\(fameChanged\([^,]+,\s*([^)]+)\)/g)].map(m => m[1].trim());
  ok(direct.every(a => a === 'finalFp' || /^-/.test(a)), `§R9 every direct Fame write is the grant's own or a loss (${direct.join(', ')})`);
}

console.log(`Sonic barrage: ${checks} checks passed.`);
