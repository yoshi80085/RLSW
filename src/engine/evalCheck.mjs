// ─── EVAL CHECK ──────────────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/evalCheck.mjs
//
// Coverage for BOT_STRATEGY_HANDOFF §5's evaluator — the persona replacement.
//
// An evaluator is the one part of a bot that CANNOT be tested by watching it
// play: a mis-signed term looks exactly like a good bot right up until it has
// lost two thousand matches, and the §6.6 harness will report the loss without
// ever naming the cause. So this file tests DIRECTION and BOUNDS, not values:
//   · every term moves the right way when the thing it measures changes
//   · every term stays inside [-1, 1] so no single row can swamp the sum
//   · the weights actually differentiate the three Spirits from each other
//   · `targetMultiplier` agrees with `underdogBonus`, the real rule
//   · it is PURE — same state twice, same number, and the state is untouched
//
// The tuned VALUES are deliberately not asserted. They are §5 starting points
// and the harness is what gets to change them; pinning them here would make
// every future tuning pass look like a regression.

import assert from "node:assert";
import { makeInitialState } from "./state.js";
import {
  evaluate, evalScore, weightsFor, targetMultiplier, posePayout,
  distFromEdge, distFromHome, boomBoxLit, fameToWin, reachWeight,
  EVAL_WEIGHTS, DEFAULT_WEIGHTS, PERF_CLIFF, MAX_EDGE_DIST, PRESSURE_REACH_FLOOR,
} from "./policies/evaluate.js";
import { underdogBonus } from "./systems/combat.js";
import {
  UNDERDOG_MIN_DEFICIT, UNDERDOG_MAX_MULT, POSE_FP_MAX, POSE_FP_STEP,
  STOCK_REFILL_RATE, DB_UPGRADE_THRESHOLD, FAN_MULT_CAP,
} from "../data/gameConstants.js";
import { EDGE_HEX_NUMS, HEX_BY_NUM } from "../board/hexMap.js";
import { CORNERS } from "../data/corners.js";

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.equal(a, b, m); checks++; };

// ── Fixture ──────────────────────────────────────────────────────────────────
// Three Spirits, one per corner, seeded. Deliberately the three IN-SCOPE
// Spirits of §0.5 — Glamarchy has no kit and no weight column by design.

const RONIN = 'cosmic_ronin', ZERO = 'intergalactic_0', METAL = 'Metalness_Monster';

const CONFIG = {
  mode: 'ffa',
  startingLives: 3,
  spirits: [
    { id: RONIN, name: 'Shredding Ronin',  corner: 'blue',   num: CORNERS.blue.homeNum,   vibe: 5, maxVibe: 5, knockedOut: false, speed: 5 },
    { id: ZERO,  name: 'Intergalactic 0',  corner: 'purple', num: CORNERS.purple.homeNum, vibe: 4, maxVibe: 4, knockedOut: false, speed: 4 },
    { id: METAL, name: 'Metalness Monster',corner: 'yellow', num: CORNERS.yellow.homeNum, vibe: 5, maxVibe: 5, knockedOut: false, speed: 4 },
  ],
};

const baseState = () => makeInitialState(structuredClone(CONFIG), 4242);

/** State with one Spirit's note sheet patched. */
const withNs = (st, id, patch) => ({
  ...st, noteStates: { ...st.noteStates, [id]: { ...st.noteStates[id], ...patch } },
});

/** State with one Spirit's board record patched. */
const withSpirit = (st, id, patch) => ({
  ...st, spirits: st.spirits.map(s => s.id === id ? { ...s, ...patch } : s),
});

/** Score one term in isolation: how much did THIS row move? */
const term = (st, id, key, view) => evaluate(st, id, view).terms[key];

// ═════════════════════════════════════════════════════════════════════════════
// 1. PURITY — the property the searcher leans on hardest.
//    It will call this thousands of times per turn over shared state; one
//    accidental mutation and every later branch is scored against a board that
//    never existed.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = baseState();
  const before = JSON.stringify(st);
  const a = evalScore(st, RONIN);
  const b = evalScore(st, RONIN);
  eq(a, b, 'same state twice → identical score');
  eq(JSON.stringify(st), before, 'evaluate does not mutate the state it is handed');

  // The view is optional and its absence must not throw or poison the sum —
  // it only blinds §3.3 (see the header note on React-owned slices).
  ok(Number.isFinite(evalScore(st, RONIN)), 'scores fine with no view');
  eq(term(st, RONIN, 'rivalPose'), 0, 'no view → pose threat reads 0, not NaN');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. BOUNDS — no row may swamp the sum.
//    Weights are the only place tuning happens; if a term can reach 40 then the
//    weight column stops meaning anything and the §6.6 harness tunes noise.
// ═════════════════════════════════════════════════════════════════════════════
{
  // Deliberately absurd inputs on every axis at once.
  let st = baseState();
  st = withNs(st, RONIN, {
    fame: 9999, perfScore: 99, dbPoints: 9999, diehards: 999, casuals: 999,
    driveStack: Array(50).fill('A'), sustainStack: Array(50).fill('A'),
    chargeFloorTurns: 99, chargeCeilTurns: 99,
  });
  st = withNs(st, ZERO,  { refillDrain: 999 });
  st = withNs(st, METAL, { refillDrain: 999 });
  st = { ...st, turn: { ...st.turn, moveStepsLeft: 999 } };

  const { terms } = evaluate(st, RONIN, {
    posing: { [ZERO]: true }, limelightScores: { [ZERO]: 99 },
  });
  for (const [k, v] of Object.entries(terms)) {
    ok(v >= -1 && v <= 1, `term ${k} (${v}) stays inside [-1, 1] under absurd input`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. A DEAD SEAT IS NOT "A BAD POSITION".
//    -Infinity, not a large negative: a search must never find a rounding error
//    elsewhere worth more than its own life.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = withSpirit(baseState(), RONIN, { knockedOut: true });
  eq(evalScore(st, RONIN), -Infinity, 'a knocked-out Spirit scores -Infinity');
  eq(evalScore(baseState(), 'nobody'), -Infinity, 'an unknown id scores -Infinity, it does not throw');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. SURVIVAL — lives are the coarse grain, Vibe the fine, and losing a life
//    must always outrank losing Vibe.
// ═════════════════════════════════════════════════════════════════════════════
{
  const full    = baseState();
  const hurt    = withSpirit(full, RONIN, { vibe: 1 });
  const oneLess = withSpirit(full, RONIN, { lives: 2 });

  ok(term(hurt, RONIN, 'survival') < term(full, RONIN, 'survival'), 'losing Vibe lowers survival');
  ok(term(oneLess, RONIN, 'survival') < term(hurt, RONIN, 'survival'),
     'losing a whole life outranks being chipped to 1 Vibe');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. FAME + THE INVESTMENT HORIZON (§3.6).
//    Compounding terms must DECAY as the finish line approaches. A fan
//    multiplier bought at 20/24 has almost nothing left to multiply.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = baseState();
  const win = fameToWin(st);
  eq(win, 3 * 7, 'fameToWin = startingLives × fpPerLife(3 players) = 3 × 7');

  const early = withNs(st, RONIN, { fame: 0,       casuals: 8 });
  const late  = withNs(st, RONIN, { fame: win - 1, casuals: 8 });

  ok(term(late, RONIN, 'fame') > term(early, RONIN, 'fame'), 'more FP scores higher');
  ok(term(late, RONIN, 'fanMult') < term(early, RONIN, 'fanMult'),
     'the same crowd is worth LESS late — fans are an investment, not a trophy');

  const dbEarly = withNs(st, RONIN, { fame: 0,       dbPoints: DB_UPGRADE_THRESHOLD });
  const dbLate  = withNs(st, RONIN, { fame: win - 1, dbPoints: DB_UPGRADE_THRESHOLD });
  ok(term(dbLate, RONIN, 'dbHorizon') < term(dbEarly, RONIN, 'dbHorizon'),
     '§3.2 — banked Db is worth less with no match left to fire it in');

  // Fans still have to POINT the right way at a fixed horizon.
  const few  = withNs(st, RONIN, { fame: 0, casuals: 0 });
  const many = withNs(st, RONIN, { fame: 0, casuals: 10 });
  ok(term(many, RONIN, 'fanMult') > term(few, RONIN, 'fanMult'), 'more fans → higher multiplier term');
  ok(term(many, RONIN, 'fanMult') <= 1, `the ×${FAN_MULT_CAP} cap normalises to ≤ 1`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. THE PERFORMANCE CLIFF (§4.1) — a STEP, not a slope.
//    Scored as a slope, the Ronin learns to drift toward 4 and collect nothing.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = baseState();
  const below = withNs(st, RONIN, { perfScore: PERF_CLIFF - 1 });
  const at    = withNs(st, RONIN, { perfScore: PERF_CLIFF });
  const way   = withNs(st, RONIN, { perfScore: PERF_CLIFF + 10 });

  eq(term(below, RONIN, 'perfCliff'), 0, 'one short of the cliff pays nothing');
  eq(term(at,    RONIN, 'perfCliff'), 1, 'landing on the cliff pays in full');
  eq(term(way,   RONIN, 'perfCliff'), 1, 'overshooting pays no more — it is a step');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. STACK QUALITY IS MEASURED AGAINST THE EARNED CAP (§1's resolved drift).
//    Against a flat cap of 5 the Theory route's slot rungs would read as free,
//    and the bot would systematically under-buy the ladder that pays for them.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st    = baseState();
  const stack = ['A', 'C', 'E'];
  const small = withNs(st, RONIN, { driveStack: stack, unlockedSkills: ['amp_1'] });
  const big   = withNs(st, RONIN, { driveStack: stack, unlockedSkills: ['amp_1', 'theory_dom7', 'theory_modes'] });

  eq(term(small, RONIN, 'drive'), 1, 'a full 3-slot stack at base cap reads as full');
  ok(term(big, RONIN, 'drive') < 1,
     'the SAME three notes read as unfinished once the cap is earned up — slots are the point');
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. THE RIG RADIUS (§3.1's worst square) and 📻 THE BOOM BOX (§4.2).
//    Stranded outside your own radius is a bare d4 and no riff-off at all.
// ═════════════════════════════════════════════════════════════════════════════
{
  // A hex far from the blue corner's Main Amp — the far corner's home.
  const far = CORNERS.red.homeNum;
  const home = baseState();
  const away = withSpirit(home, RONIN, { num: far });

  eq(term(home, RONIN, 'inRig'), 1, 'sitting on the Main Amp is inside the radius');
  ok(distFromHome(away.spirits.find(s => s.id === RONIN), {}) > 0, 'the far corner really is far');

  // 📻 Boom Box: Intergalactic 0 alone reads distance 0 while charged.
  const zeroAway     = withSpirit(baseState(), ZERO, { num: CORNERS.red.homeNum });
  const zeroCharged  = withNs(zeroAway, ZERO, { chargeFloorTurns: 2 });
  const roninCharged = withNs(withSpirit(baseState(), RONIN, { num: far }), RONIN, { chargeFloorTurns: 2 });

  ok(boomBoxLit(ZERO,  { chargeFloorTurns: 1 }), 'a charge lights the Boom Box');
  ok(!boomBoxLit(RONIN,{ chargeFloorTurns: 1 }), 'nobody else gets a Boom Box');
  eq(distFromHome(zeroCharged.spirits.find(s => s.id === ZERO), zeroCharged.noteStates[ZERO]), 0,
     '📻 charged, Intergalactic 0 is never stranded');
  eq(term(zeroCharged, ZERO, 'inRig'), 1, 'the Boom Box keeps the rig live across the board');
  eq(term(roninCharged, RONIN, 'inRig'), 0,
     'a charge alone does not carry anyone else\'s rig — only the Boom Box does');
  eq(term(away, RONIN, 'inRig'), 0,
     'stranded at the far corner is §3.1\'s worst square: outside the radius');

  // The charge term itself fires for everyone — it is the WEIGHT that differs.
  eq(term(withNs(baseState(), METAL, { chargeCeilTurns: 1 }), METAL, 'charge'), 1,
     'holding a charge registers for every Spirit');
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. EDGE SAFETY — knockback is 1–2 hexes and the rim is a knockout.
// ═════════════════════════════════════════════════════════════════════════════
{
  const rim = [...EDGE_HEX_NUMS][0];
  eq(distFromEdge(rim), 0, 'an edge hex is zero from the edge');
  ok(MAX_EDGE_DIST > 0, 'the edge-distance denominator was derived from the map');

  const onRim = withSpirit(baseState(), RONIN, { num: rim });
  const deepest = Object.values(HEX_BY_NUM).find(h => distFromEdge(h.num) === MAX_EDGE_DIST);
  ok(deepest, 'the map has at least one hex at the maximum edge distance');
  const inner = withSpirit(baseState(), RONIN, { num: deepest.num });
  eq(term(onRim, RONIN, 'edgeSafety'), 0, 'standing on the rim scores no safety');
  eq(term(inner, RONIN, 'edgeSafety'), 1, 'the deepest hex on the board is maximum standing room');
  ok(term(inner, RONIN, 'edgeSafety') > term(onRim, RONIN, 'edgeSafety'),
     'standing room is strictly worth more than the rim');
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. DENIAL (§4.2) — tempo, not damage. Scored on the RIVALS' sheets, which is
//     the whole reason Gravity Control is invisible to a damage-only evaluator.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st      = baseState();
  const drained = withNs(withNs(st, ZERO, { refillDrain: 2 }), METAL, { refillDrain: 2 });

  eq(term(st, RONIN, 'refillDenied'), 0, 'nobody drained → nothing denied');
  ok(term(drained, RONIN, 'refillDenied') > 0, 'draining rivals scores, even with no damage dealt');
  eq(term(withNs(withNs(st, ZERO, { refillDrain: STOCK_REFILL_RATE }), METAL, { refillDrain: STOCK_REFILL_RATE }), RONIN, 'refillDenied'), 1,
     'the whole table stripped of a full refill is the ceiling');

  // Denial must be read from the DENIER's seat, not the victim's.
  ok(term(drained, ZERO, 'refillDenied') < term(drained, RONIN, 'refillDenied'),
     'being drained yourself is not credit for denial');
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. 💢 PRESSURE — the mirror of `survival`, and the replacement for the cut
//     `adjWounded`. Four properties, and three of them are guards against a
//     specific way this term can invert.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st   = baseState();
  const home = HEX_BY_NUM[CORNERS.blue.homeNum];
  // Put Metalness on a neighbour of the Ronin's hex.
  const neighbour = Object.values(HEX_BY_NUM).find(h =>
    Math.max(Math.abs(h.q - home.q), Math.abs(h.r - home.r), Math.abs((h.q + h.r) - (home.q + home.r))) === 1);

  const farHurt  = withSpirit(st, METAL, { vibe: 1 });
  const nearFull = withSpirit(st, METAL, { num: neighbour.num });
  const nearHurt = withSpirit(nearFull, METAL, { vibe: 1 });

  // 🪦 The cut term is GONE, not zeroed. A term left in the table at weight 0 is
  // a trap: it reads as a considered weighting rather than a deleted rule.
  eq(evaluate(st, RONIN).terms.adjWounded, undefined, '🪦 adjWounded is gone from the terms');
  eq(evaluate(st, RONIN).weights.adjWounded, undefined, '🪦 ...and gone from the weights');

  // A healthy field is zero pressure; hurting anyone is strictly positive.
  eq(term(st, RONIN, 'pressure'), 0, 'a full-health field scores no pressure');
  ok(term(nearHurt, RONIN, 'pressure') > 0, 'an adjacent bleeding rival scores');

  // ⚠️ THE FLOOR, NOT A CLIFF. `adjWounded` scored a distant wound at exactly 0,
  // which left the board flat outside melee and gave the bot no gradient to walk
  // down. A wound must still be worth something at range — just less.
  ok(term(farHurt, RONIN, 'pressure') > 0,
     '💢 a bleeding rival across the board is worth SOMETHING (the floor)');
  ok(term(nearHurt, RONIN, 'pressure') > term(farHurt, RONIN, 'pressure'),
     '💢 ...and worth more when you can reach them — that gradient is the approach');
  eq(term(nearFull, RONIN, 'pressure'), 0, 'an adjacent rival at FULL Vibe scores nothing');

  // ⚠️ MONOTONE IN DISTANCE. A term that could RISE as a rival retreats would pay
  // the bot for letting them go.
  for (let d = 1; d <= 6; d++) {
    ok(reachWeight(d) <= reachWeight(d - 1) + 1e-12,
       `💢 reach weight never rises as distance grows (${d - 1} → ${d})`);
  }
  eq(reachWeight(0), 1, 'a rival on top of you is full reach');
  eq(reachWeight(1), 1, 'melee reach is full value');
  eq(reachWeight(99), PRESSURE_REACH_FLOOR, 'past the beam it is flat at the floor');

  // ⚠️ THE INVERSION THAT KILLED `adjWounded`. Taking a life must never score
  // WORSE than leaving the rival bleeding — they respawn at home, far away and
  // at full Vibe, so any term that reach-weights the LIFE collapses on the exact
  // blow it should reward. This is the assertion that pins the lives/Vibe split.
  const onTheRopes = withSpirit(nearFull, METAL, { vibe: 1, lives: 3 });
  const lifeTaken  = withSpirit(st, METAL,
    { vibe: 5, lives: 2, num: CORNERS.yellow.homeNum });   // respawned, full, far
  ok(term(lifeTaken, RONIN, 'pressure') > term(onTheRopes, RONIN, 'pressure'),
     '💢 TAKING A LIFE beats leaving them bleeding next to you — the respawn must not undo it');

  // 📌 A knocked-out rival is banked at the maximum and cannot decay.
  const koed = withSpirit(st, METAL, { knockedOut: true, lives: 0, vibe: 0 });
  ok(term(koed, RONIN, 'pressure') > term(lifeTaken, RONIN, 'pressure'),
     '💢 a knocked-out rival is the most pressure there is');

  // 🟢 The bruiser values damage most; 📻 the controller least. That ordering IS
  // the character, now that it lives here instead of in `adjWounded`.
  //
  // ⚠️ EACH SPIRIT IS ASKED ABOUT A VICTIM STANDING NEXT TO *THEM*. Scoring one
  // shared board from three corners would compare weights times three different
  // reach factors, and the geometry — not the weight column — would decide who
  // "cares more". The victim moves so that only the weight differs.
  const victimOf = (id) => {
    const me = HEX_BY_NUM[st.spirits.find(x => x.id === id).num];
    const nb = Object.values(HEX_BY_NUM).find(h =>
      Math.max(Math.abs(h.q - me.q), Math.abs(h.r - me.r),
               Math.abs((h.q + h.r) - (me.q + me.r))) === 1
      && !st.spirits.some(x => x.num === h.num));
    return nb;
  };
  const values = (id) => {
    const victim = st.spirits.find(x => x.id !== id);           // anyone but them
    const nb = victimOf(id);
    const full = withSpirit(st, victim.id, { num: nb.num });
    const hurt = withSpirit(full, victim.id, { vibe: 1 });
    return evalScore(hurt, id) - evalScore(full, id);
  };
  ok(values(METAL) > values(RONIN), '🟢 hurting a rival is worth more to Metalness than to the Ronin');
  ok(values(RONIN) > values(ZERO),  '📻 ...and least of all to Intergalactic 0, whose win path is denial');
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. RIVAL POSE THREAT (§3.3) — a NEW term with no equivalent in botHexScore.
//     Signed negative in the VALUE (see the module header's sign convention).
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = baseState();
  eq(posePayout(0), POSE_FP_STEP, 'a fresh pose pays one step');
  eq(posePayout(99), POSE_FP_MAX, 'the payout is capped');

  const open   = { posing: { [ZERO]: true }, limelightScores: { [ZERO]: 0 } };
  const maxed  = { posing: { [ZERO]: true }, limelightScores: { [ZERO]: POSE_FP_MAX } };
  const stood  = { posing: { [ZERO]: false }, limelightScores: { [ZERO]: POSE_FP_MAX } };

  ok(term(st, RONIN, 'rivalPose', open) < 0, 'a rival mid-pose is a NEGATIVE, not a bonus');
  ok(term(st, RONIN, 'rivalPose', maxed) < term(st, RONIN, 'rivalPose', open),
     'the escalating payout makes a maxed poser the whole table\'s problem');
  eq(term(st, RONIN, 'rivalPose', stood), 0, 'banked rounds with nobody posing are not a live threat');
  eq(term(st, ZERO, 'rivalPose', maxed), 0, 'your OWN pose is not a threat to you');
  eq(evaluate(st, RONIN, maxed).weights.rivalPose > 0, true,
     'the weight stays a positive magnitude — the sign lives in the term');
}

// ═════════════════════════════════════════════════════════════════════════════
// 13. TARGET UPSIDE (§3.7) — and the correction the handoff needed.
//     §3.7 said "beating the last-place Spirit pays THEM; prefer second place."
//     `combat.js` says the opposite: deficit = loserFame − winnerFame, so the
//     multiplier goes to the WINNER when the winner is behind. Punch UP.
//     This block is the guard that keeps the two from drifting apart again.
// ═════════════════════════════════════════════════════════════════════════════
{
  // Agreement with the real rule, across the whole ramp.
  for (const [mine, theirs] of [[0,0],[10,0],[0,5],[0,6],[0,12],[0,30],[4,20]]) {
    const { mult } = underdogBonus(mine, theirs, 2);
    eq(targetMultiplier(mine, theirs), mult,
       `targetMultiplier(${mine},${theirs}) agrees with underdogBonus`);
  }
  eq(targetMultiplier(0, UNDERDOG_MIN_DEFICIT - 1), 1, 'below the floor there is no bonus at all');
  ok(targetMultiplier(0, 999) <= UNDERDOG_MAX_MULT, 'the ramp respects its ceiling');

  // And the term reads it off the board correctly.
  const st   = baseState();
  const home = HEX_BY_NUM[CORNERS.blue.homeNum];
  const neighbour = Object.values(HEX_BY_NUM).find(h =>
    Math.max(Math.abs(h.q - home.q), Math.abs(h.r - home.r), Math.abs((h.q + h.r) - (home.q + home.r))) === 1);

  const adjacent = withSpirit(st, METAL, { num: neighbour.num });
  const leader   = withNs(adjacent, METAL, { fame: 20 });
  const trailer  = withNs(withNs(adjacent, METAL, { fame: 0 }), RONIN, { fame: 20 });

  ok(term(leader, RONIN, 'targetUpside') > 0, 'a reachable rival far AHEAD of me is worth extra FP');
  eq(term(trailer, RONIN, 'targetUpside'), 0, 'punching DOWN carries no bonus — and no penalty either');
  eq(term(withNs(st, METAL, { fame: 20 }), RONIN, 'targetUpside'), 0,
     'an out-of-reach leader is a plan, not a position');
}

// ═════════════════════════════════════════════════════════════════════════════
// 14. THE WEIGHTS ACTUALLY DIFFERENTIATE (§0.1 — the whole point).
//     If every column scored the same board the same way, we would have
//     replaced four generic personas with three generic Spirits.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = baseState();
  ok(weightsFor('Glamarchy') === DEFAULT_WEIGHTS, 'an unweighted Spirit falls back to the flat default');
  for (const id of [RONIN, ZERO, METAL]) {
    ok(EVAL_WEIGHTS[id], `${id} has its own column`);
    eq(Object.keys(EVAL_WEIGHTS[id]).length, Object.keys(DEFAULT_WEIGHTS).length,
       `${id}'s column covers every term — a missing row would silently score 0`);
  }

  // ⚡ The charge is a boost for two of them and an IDENTITY for one (§4.2).
  const charged = (id) => {
    const lit = withNs(st, id, { chargeFloorTurns: 2 });
    return evalScore(lit, id) - evalScore(st, id);
  };
  ok(charged(ZERO) > charged(RONIN), '📻 a charge is worth more to Intergalactic 0 than to the Ronin');
  ok(charged(ZERO) > charged(METAL), '📻 ...and more than to Metalness');

  // 🎭 The Performance cliff is the Ronin's, and nobody else's.
  const cliffed = (id) => {
    const hit = withNs(st, id, { perfScore: PERF_CLIFF });
    return evalScore(hit, id) - evalScore(st, id);
  };
  ok(cliffed(RONIN) > cliffed(ZERO) && cliffed(RONIN) > cliffed(METAL),
     '🎭 the Performance cliff is worth most to the virtuoso');
}

console.log(`✅ evalCheck — ${checks} assertions passed`);
