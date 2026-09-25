// 🔦 The four corner spotlights — `systems/spotlights.js` (Alex, 2026-09-25).
// node --import ./src/engine/testAssetStub.mjs src/engine/spotlightCheck.mjs
//
// ⚠️ Every assertion here goes through `applyAction` — the same door the client
// and the headless harness use — except the pure helpers in §1. A rule proved
// only against its helper is §B2's trap: green, and not the game.
import assert from 'node:assert/strict';
import { makeInitialState } from './state.js';
import { applyAction } from './reduce.js';
import { makeRng } from './rng.js';
import { turnStarted, turnEnded, posed, spiritWarped, attackRolled, knockdownResolved } from './actions.js';
import {
  SPOTLIGHT_POOLS, SPOTLIGHT_ORDER, makeSpotlights, stepSpotlights, spotlightHealFor,
  poseSpotFor, homeSpotlightDrive, spotlightRelation,
} from './systems/spotlights.js';
import { attackParams, rigFor } from './systems/attackParams.js';
import { startTurnNotes } from './systems/turnFlow.js';
import { HEX_BY_NUM } from '../board/hexMap.js';
import { axialDist } from '../board/hexGeometry.js';
import {
  LIMELIGHT_HEX, SPOTLIGHT_STEAL_CASUALS, POSE_SUSTAIN_PENALTY, FAN_TOTAL_CAP,
} from '../data/gameConstants.js';

let checks = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const ok = (c, m) => { assert.ok(c, m); checks++; };
const dist = (a, b) => axialDist(HEX_BY_NUM[a].q, HEX_BY_NUM[a].r, HEX_BY_NUM[b].q, HEX_BY_NUM[b].r);

const RONIN = 'cosmic_ronin', ZERO = 'intergalactic_0', METAL = 'Metalness_Monster';
function fresh(seed = 4242, { three = true } = {}) {
  const spirits = [
    { id: RONIN, name: 'Ronin', corner: 'blue',   num: 7,   vibe: 15, maxVibe: 15, facing: 0 },
    { id: ZERO,  name: 'Zero',  corner: 'purple', num: 12,  vibe: 12, maxVibe: 12, facing: 0 },
    ...(three ? [{ id: METAL, name: 'Metal', corner: 'yellow', num: 100, vibe: 15, maxVibe: 15, facing: 0 }] : []),
  ];
  return makeInitialState({ mode: 'ffa', startingLives: 3, spirits }, seed);
}
const rng = makeRng(1);
const act = (s, a) => applyAction(s, a, rng);
const put = (s, id, num) => act(s, spiritWarped(id, num, 0));
const sp  = (s, id) => s.spirits.find(x => x.id === id);
const ns  = (s, id, patch) => ({ ...s, noteStates: { ...s.noteStates, [id]: { ...s.noteStates[id], ...patch } } });
const withVibe = (s, id, vibe) => ({ ...s, spirits: s.spirits.map(x => x.id === id ? { ...x, vibe } : x) });
const lights = s => s.board.spotlights;
// Pin a light to a hex, so a test can stand someone under it deterministically.
const pin = (s, owner, num) => ({ ...s, board: { ...s.board, spotlights: { ...s.board.spotlights, [owner]: num } } });

// ── §1. The pools are the old sweep, and disjoint ──────────────────────────
{
  const all = SPOTLIGHT_ORDER.flatMap(c => SPOTLIGHT_POOLS[c]);
  eq(new Set(all).size, all.length, 'no hex belongs to two lights, so two lights can never share one');
  for (const c of SPOTLIGHT_ORDER) {
    ok(SPOTLIGHT_POOLS[c].length >= 4, `${c}'s light has room to wander (${SPOTLIGHT_POOLS[c].length} hexes)`);
    ok(!SPOTLIGHT_POOLS[c].includes(LIMELIGHT_HEX), `${c}'s light never lands on the Limelight`);
    ok(SPOTLIGHT_POOLS[c].every(n => !HEX_BY_NUM[n].edge), `${c}'s light stays off the edge`);
    ok(SPOTLIGHT_POOLS[c].every(n => SPOTLIGHT_POOLS[c].some(m => m !== n && dist(m, n) === 1)),
      `${c}: every hex in the pool has a neighbour to step to`);
  }
  eq(makeSpotlights(99), makeSpotlights(99), 'opening positions are seeded');
  eq([spotlightHealFor(14), spotlightHealFor(10), spotlightHealFor(9), spotlightHealFor(5), spotlightHealFor(4), spotlightHealFor(1)],
    [1, 1, 2, 2, 3, 3], "Alex's heal ladder: 10–14 → 1, 5–9 → 2, 1–4 → 3");
}

// ── §2. A new match has four lights, each in its own pool ───────────────────
{
  const s = fresh();
  for (const c of SPOTLIGHT_ORDER) ok(SPOTLIGHT_POOLS[c].includes(lights(s)[c]), `${c} opens inside its pool`);
  eq(fresh(7).board.spotlights, fresh(7).board.spotlights, 'same seed, same opening lights');
}

// ── §3. They step exactly once per round, one hex, always moving ────────────
{
  let s = fresh();
  const seen = [lights(s)];
  let turns = 0;
  for (let r = 0; r < 12; r++) {
    // a round is three turn ends in a three-seat game
    for (let t = 0; t < 3; t++) {
      const before = lights(s);
      s = act(s, turnEnded()); turns++;
      const closed = s.turn.lastReport.roundCompleted;
      if (!closed) eq(lights(s), before, 'lights hold still mid-round');
      else {
        for (const c of SPOTLIGHT_ORDER) {
          ok(lights(s)[c] !== before[c], `${c} moved at the round's end`);
          eq(dist(lights(s)[c], before[c]), 1, `${c} moved to a NEIGHBOURING hex`);
          ok(SPOTLIGHT_POOLS[c].includes(lights(s)[c]), `${c} stayed in its own quarter`);
        }
        eq(s.board.lastSpotlightsMoved.round, s.turn.round, 'the move report names the new round');
        seen.push(lights(s));
      }
    }
  }
  eq(seen.length, 13, 'twelve rounds, twelve moves');
  // Replaying reaches the same hexes — and moving them drew nothing from the main stream.
  let a = fresh(), b = fresh();
  for (let i = 0; i < 9; i++) { a = act(a, turnEnded()); b = applyAction(b, turnEnded()); }
  eq(lights(a), lights(b), 'replay lands every light on the same hex');
  eq(stepSpotlights(fresh(), 5).board.spotlights, stepSpotlights(fresh(), 5).board.spotlights, 'the step is a pure function of seed + round');
  const c0 = fresh(); const c1 = applyAction(c0, turnEnded());
  eq(c1.rng.cursor, c0.rng.cursor, 'moving the lights draws nothing from the main rng stream');
}

// ── §4. Who a light belongs to ───────────────────────────────────────────────
{
  let s = fresh(4242, { three: false });         // no yellow, no red seat
  s = pin(pin(pin(s, 'blue', 36), 'purple', 38), 'yellow', 74);
  eq(spotlightRelation(s, RONIN, 36), 'home', 'your own corner is home');
  eq(spotlightRelation(s, RONIN, 38), 'rival', "a living rival's corner is theirs to rob");
  eq(spotlightRelation(s, RONIN, 74), null, 'an empty seat\'s light is scenery');
  const team = { ...s, config: { ...s.config, mode: 'team', teams: { a: ['blue', 'purple'], b: ['yellow', 'red'] } } };
  eq(spotlightRelation(team, RONIN, 38), null, "a teammate's light is scenery too");
  eq(poseSpotFor(put(s, RONIN, 74), RONIN), null, 'no pose under an empty seat\'s light');
  eq(poseSpotFor(put(s, RONIN, 56), RONIN), 'limelight', 'the Limelight is still a pose spot');
  eq(poseSpotFor(put(s, RONIN, 37), RONIN), null, 'an unlit hex is not');
}

// ── §5. +1 Drive, only from under YOUR light, only when attacking ───────────
{
  let s = pin(pin(fresh(), 'blue', 36), 'purple', 38);
  s = ns(s, RONIN, { driveStack: ['C', 'E', 'G'] });
  s = { ...s, acting: RONIN };
  const off = rigFor(sp(s, RONIN), s.noteStates[RONIN], s).pool.length;
  s = put(s, RONIN, 36);
  eq(homeSpotlightDrive(s, RONIN), 1, 'standing in your own light is worth one Drive');
  eq(rigFor(sp(s, RONIN), s.noteStates[RONIN], s).pool.length, off + 1, 'the Sonic rig throws one more die');
  const sw = attackParams(s, RONIN, ZERO, 'swing');
  eq(sw.dicePool.length, off + 1, 'the Swing throws one more die too');
  const rival = put(s, RONIN, 38);
  eq(homeSpotlightDrive(rival, RONIN), 0, "a rival's light gives no Drive");
  const notMyTurn = { ...s, acting: ZERO };
  eq(rigFor(sp(notMyTurn, RONIN), notMyTurn.noteStates[RONIN], notMyTurn).pool.length, off,
    'off-turn (defending) the light adds nothing — it is an attack bonus');
  const swingRoll = act({ ...s, battle: null }, attackRolled('swing', RONIN, ZERO, { swingVersion: 2 }));
  eq(swingRoll.battle.dicePool.length, off + 1, 'the Swing REDUCER rolls the extra die, not just the preview');
}

// ── §6. A pose defends at Sustain −1, not at nothing ────────────────────────
{
  let s = fresh();
  s = ns(s, ZERO, { sustainStack: ['C', 'E', 'G'] });
  const base = attackParams(s, RONIN, ZERO, 'sonic').defStat;
  s = put(s, ZERO, LIMELIGHT_HEX);
  s = act(s, posed(ZERO, true));
  const p = attackParams(s, RONIN, ZERO, 'sonic');
  eq(p.defStat, Math.max(0, base - POSE_SUSTAIN_PENALTY), 'a Limelight poser defends at Sustain −1');
  eq(p.posing, false, 'the reducer is never told to zero the shield any more');
  ok(p._derived.defenderPosing, 'the HUD can still tell they are posing');
  const rolled = act({ ...s, acting: RONIN }, attackRolled('sonic', RONIN, ZERO, { ...p, _derived: undefined, dicePool: [6] }));
  eq(rolled.battle.sustainRolls.length, p.defStat, 'the defender actually throws Sustain dice while posing');
  const thin = ns(s, ZERO, { sustainStack: [] });
  ok(attackParams(thin, RONIN, ZERO, 'sonic').defStat >= 0, 'the −1 never goes below zero');
}

// ── §7. Striking a spotlight pose: bills one Sustain note, pays no Fame ──────
{
  let s = pin(fresh(), 'blue', 36);
  s = ns(s, RONIN, { sustainStack: ['C', 'E', 'G'], fame: 0 });
  s = put(s, RONIN, 36);
  s = act(s, posed(RONIN, true));
  eq(s.noteStates[RONIN].sustainStack, ['C', 'E'], 'the pose costs one Sustain note, at once');
  eq(s.limelight.spotPoses[RONIN], { owner: 'blue', hex: 36, kind: 'home' }, 'the light is remembered');
  eq(s.limelight.lastSpotPoseStruck.shed, ['G'], 'the client is told which note went');
  s = act(s, posed(RONIN, true));
  eq(s.noteStates[RONIN].sustainStack, ['C', 'E'], 're-raising an up pose does not bill twice');
  const empty = act(put(ns(pin(fresh(), 'blue', 36), RONIN, { sustainStack: [] }), RONIN, 36), posed(RONIN, true));
  ok(empty.limelight.spotPoses[RONIN], 'an empty stack may still pose, on nerve');
  const lime = act(put(ns(fresh(), RONIN, { sustainStack: ['C', 'E'] }), RONIN, LIMELIGHT_HEX), posed(RONIN, true));
  eq(lime.noteStates[RONIN].sustainStack, ['C', 'E'], 'the Limelight pose keeps its own per-round toll, not this one');
  eq(lime.limelight.spotPoses?.[RONIN], undefined, 'a Limelight pose is not a spotlight pose');
}

// ── §8. Home pose: survive to your next turn → heal by the ladder ───────────
for (const [vibe, want] of [[14, 1], [9, 2], [3, 3], [15, 0]]) {
  let s = pin(fresh(), 'blue', 36);
  s = withVibe(put(s, RONIN, 36), RONIN, vibe);
  s = act(s, posed(RONIN, true));
  s = act(s, turnStarted(RONIN));
  eq(sp(s, RONIN).vibe, Math.min(15, vibe + want), `home pose at ${vibe} Vibe heals ${want}`);
  ok(s.limelight.lastSpotPose.ok, 'the report says it landed');
  ok(!s.limelight.posing[RONIN] && !s.limelight.spotPoses[RONIN], 'and the pose is over — the light has moved on');
}

// ── §9. Rival pose: steal Casuals, never Diehards, never invent any ─────────
{
  const setup = (victimCas, thiefCas = 0, thiefDie = 2) => {
    let s = pin(fresh(), 'purple', 38);
    s = ns(ns(s, ZERO, { casuals: victimCas, diehards: 3 }), RONIN, { casuals: thiefCas, diehards: thiefDie });
    s = act(put(s, RONIN, 38), posed(RONIN, true));
    return act(s, turnStarted(RONIN));
  };
  let s = setup(5);
  eq([s.noteStates[ZERO].casuals, s.noteStates[RONIN].casuals], [5 - SPOTLIGHT_STEAL_CASUALS, SPOTLIGHT_STEAL_CASUALS],
    `a surviving rival pose takes ${SPOTLIGHT_STEAL_CASUALS} Casuals`);
  eq(s.noteStates[ZERO].diehards, 3, 'Diehards never change sides');
  eq(s.limelight.lastSpotPose.victimId, ZERO, 'the report names who was robbed');
  s = setup(1);
  eq([s.noteStates[ZERO].casuals, s.noteStates[RONIN].casuals], [0, 1], 'you cannot take more than they have');
  s = setup(5, FAN_TOTAL_CAP - 2 - 1, 2);
  eq(s.noteStates[RONIN].casuals + s.noteStates[ZERO].casuals, FAN_TOTAL_CAP - 3 + 5, 'a full house takes only what fits — nothing is created or lost');
}

// ── §10. A broken pose pays nothing, and ends the moment the body moves ─────
{
  let s = pin(fresh(), 'blue', 36);
  s = withVibe(put(s, RONIN, 36), RONIN, 3);
  s = act(s, posed(RONIN, true));
  s = put(s, RONIN, 37);                          // shoved, pulled, warped — anything
  ok(!s.limelight.posing[RONIN], 'leaving the hex drops the pose at once — guard back up');
  ok(!s.limelight.spotPoses[RONIN], 'and forgets the light');
  eq(s.limelight.lastSpotPoseBroken?.[0]?.spiritId, RONIN, 'the client is told it broke');
  s = act(s, turnStarted(RONIN));
  eq(sp(s, RONIN).vibe, 3, 'a broken pose heals nothing');
  let k = act(put(pin(fresh(), 'blue', 36), RONIN, 36), posed(RONIN, true));
  k = act(k, knockdownResolved(RONIN));
  ok(!k.limelight.spotPoses[RONIN], 'a knockdown ends it too');
  let d = act(put(pin(fresh(), 'blue', 36), RONIN, 36), posed(RONIN, true));
  d = act(d, posed(RONIN, false));
  ok(!d.limelight.spotPoses[RONIN], 'dropping the pose yourself ends it');
  eq(d.limelight.lastSpotPoseBroken ?? null, null, 'and is not reported as broken');
}

// ── §11. The verdict is "still on your hex", even though the light moved ────
{
  let s = pin(fresh(), 'blue', 36);
  s = withVibe(put(s, RONIN, 36), RONIN, 8);
  s = { ...s, acting: RONIN, turnQueue: [RONIN, ZERO, METAL] };
  s = act(s, posed(RONIN, true));
  s = act(s, turnEnded()); s = act(s, turnEnded()); s = act(s, turnEnded());
  ok(s.turn.lastReport.roundCompleted, 'a full round went by');
  ok(lights(s).blue !== 36, 'so the light has moved on');
  s = act(s, turnStarted(RONIN));
  eq(sp(s, RONIN).vibe, 10, 'and the pose still lands — judged on the hex, not the light');
}

// ── §12. 🪦 No natural Sustain decay (Alex, 2026-09-25) ─────────────────────
{
  const st = fresh().noteStates[RONIN];
  const quiet = startTurnNotes({ ...st, sustainStack: ['C', 'E', 'G', 'B'], pendingSonicAttacks: 0 }, { spiritId: RONIN });
  eq(quiet.patch.sustainStack, ['C', 'E', 'G', 'B'], 'a quiet turn start costs no Sustain');
}

console.log(`Spotlights: ${checks} checks passed.`);
