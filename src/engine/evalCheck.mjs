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
  beamOpportunity, CENTRE_RING_PAY, MAX_CENTRE_DIST, CHARGE_SEEK_REACH,
  chipReachWeight, PRESSURE_CHIP_REACH_MIX,
  BEAM_READY, BEAM_ALIGNED, BEAM_DUEL,
} from "./policies/evaluate.js";
import { underdogBonus } from "./systems/combat.js";
import {
  UNDERDOG_MIN_DEFICIT, UNDERDOG_MAX_MULT, POSE_FP_MAX, POSE_FP_STEP,
  STOCK_REFILL_RATE, DB_UPGRADE_THRESHOLD, FAN_MULT_CAP,
} from "../data/gameConstants.js";
import { EDGE_HEX_NUMS, HEX_BY_NUM, HEX_BY_QR } from "../board/hexMap.js";
import { LIMELIGHT_HEX } from "../data/gameConstants.js";
import { hexRingFromCenter } from "../board/boardHelpers.js";
import { sonicBeam, facingOptions } from "./policies/legalActions.js";
import { CORNERS } from "../data/corners.js";
import { SPIRIT_DEFS } from "../data/spirits.js";

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

/**
 * ✨ State with the Limelight slice set — the pose flag and the banked rounds.
 *
 * ⚠️ THIS USED TO BE A `view` OBJECT, and the difference is the whole of §6.6.8.
 * `posing` and `limelightScores` were React state handed to `evaluate` from
 * outside, so a test could show the evaluator a pose the ENGINE had never heard
 * of — which is how a mechanic that pays nothing headlessly stays green for
 * months. They are engine state now: a test that wants a pose has to put one on
 * the board.
 */
const withPose = (st, id, { on = true, rounds = 0 } = {}) => ({
  ...st,
  limelight: {
    posing: { ...(st.limelight?.posing ?? {}), ...(on ? { [id]: true } : {}) },
    scores: { ...(st.limelight?.scores ?? {}), [id]: rounds },
  },
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

  // The view is optional and its absence must not throw or poison the sum. It
  // carries no game state any more (§6.6.8) — only the bench's weight override.
  ok(Number.isFinite(evalScore(st, RONIN)), 'scores fine with no view');
  eq(term(st, RONIN, 'rivalPose'), 0, 'nobody posing → pose threat reads 0, not NaN');
  eq(term(st, RONIN, 'posePlay'), 0, 'not posing → own-pose value reads 0, not NaN');
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

  st = withPose(st, ZERO,  { rounds: 99 });
  st = withPose(st, RONIN, { rounds: 99 });

  const { terms } = evaluate(st, RONIN);
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
// 7. STACK QUALITY IS MEASURED AGAINST THE FOUND CAP, PER STACK.
//    Against a flat cap of 5 a found seat would read as free, and the bot would
//    systematically under-value the Lost Chords that open them.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st    = baseState();
  const stack = ['A', 'C', 'E'];
  const small = withNs(st, RONIN, { driveStack: stack });
  const big   = withNs(st, RONIN, { driveStack: stack, driveSlots: 2 });

  eq(term(small, RONIN, 'drive'), 1, 'a full 3-seat stack at base cap reads as full');
  ok(term(big, RONIN, 'drive') < 1,
     'the SAME three notes read as unfinished once two seats are found — seats are the point');

  // 🎯 AND THE TWO STACKS ARE DIVIDED SEPARATELY. One shared divisor would report
  // the stack that found seats as roomy and the one that did not as roomy too —
  // the Spirit would look like they had capacity they never walked to.
  const lopsided = withNs(st, RONIN, {
    driveStack: stack, sustainStack: stack, driveSlots: 3, sustainSlots: 0,
  });
  eq(term(lopsided, RONIN, 'sustain'), 1, 'Sustain found nothing — 3 of 3 is full');
  ok(term(lopsided, RONIN, 'drive') < term(lopsided, RONIN, 'sustain'),
     '...while Drive, at 3 of 6, is visibly unfinished on the same three notes');
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

  // ⚠️ THE KNOCKBACK INVERSION (§6.6.11) — THE PROPERTY, SWEPT, NOT ONE CASE.
  //
  // Every attack in this game shoves the target 1–2 hexes. Chip Vibe is reach-
  // weighted, so a landed blow adds one point of damage and at the same time
  // demotes every point already banked into a weaker band. At full strength the
  // second effect won: a rival taken from 2 Vibe to 1 scored the Ronin −0.05
  // weighted, and the term whose whole job is "hitting people is good" was
  // telling the bot the opposite. Same shape as the inversion above, one row
  // down — that one was about LIVES, this one is about the Vibe underneath them.
  //
  // 📌 SWEPT OVER THE ROSTER'S VIBE POOLS because the ratio tightens as the pool
  // deepens: one point out of eight is a smaller share of the credit than one
  // out of four, so a Spirit with a deeper pool is exactly how this silently
  // comes back. `PRESSURE_CHIP_REACH_MIX` is derived from the roster for that
  // reason, and this sweep reads the roster too — add a 7-Vibe Spirit and the
  // constant and the assertion move together instead of drifting apart.
  const distFrom = h => Math.max(
    Math.abs(h.q - home.q), Math.abs(h.r - home.r), Math.abs((h.q + h.r) - (home.q + home.r)));
  const hexAt = d => Object.values(HEX_BY_NUM).find(h => distFrom(h) === d);
  const POOLS = [...new Set(Object.values(SPIRIT_DEFS).map(d => d.maxVibe ?? 5))];
  for (const pool of POOLS) {
    for (let v = pool; v >= 2; v--) {
      for (const knock of [1, 2]) {
        const before = withSpirit(st, METAL,
          { num: hexAt(1).num, maxVibe: pool, vibe: v });
        const after  = withSpirit(st, METAL,
          { num: hexAt(1 + knock).num, maxVibe: pool, vibe: v - 1 });
        ok(term(after, RONIN, 'pressure') >= term(before, RONIN, 'pressure') - 1e-12,
           `💢 a landed blow never scores worse than not landing it (pool ${pool}, ${v}→${v - 1} Vibe, knocked ${knock})`);
      }
    }
  }

  // 📌 AND THE GRADIENT SURVIVED THE BOUND. If the mix flattened `chipReachWeight`
  // to a constant the sweep above would pass trivially and the bot would lose
  // every reason to walk toward a wounded rival — the failure that made the floor
  // a floor rather than a cutoff in the first place.
  ok(chipReachWeight(1) > chipReachWeight(3),
     '💢 chip reach still strictly rewards being closer — the bound is not a flattening');
  eq(chipReachWeight(1), 1, '💢 ...and melee reach is still the full credit');
  ok(PRESSURE_CHIP_REACH_MIX > 0 && PRESSURE_CHIP_REACH_MIX < 1,
     '💢 the mix is a real blend, not a switch');

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

  const open   = withPose(st, ZERO, { rounds: 0 });
  const maxed  = withPose(st, ZERO, { rounds: POSE_FP_MAX });
  const stood  = withPose(st, ZERO, { on: false, rounds: POSE_FP_MAX });

  ok(term(open, RONIN, 'rivalPose') < 0, 'a rival mid-pose is a NEGATIVE, not a bonus');
  ok(term(maxed, RONIN, 'rivalPose') < term(open, RONIN, 'rivalPose'),
     'the escalating payout makes a maxed poser the whole table\'s problem');
  eq(term(stood, RONIN, 'rivalPose'), 0, 'banked rounds with nobody posing are not a live threat');
  eq(term(maxed, ZERO, 'rivalPose'), 0, 'your OWN pose is not a threat to you');
  eq(evaluate(maxed, RONIN).weights.rivalPose > 0, true,
     'the weight stays a positive magnitude — the sign lives in the term');
}

// ═════════════════════════════════════════════════════════════════════════════
// 12b. ✨ THE POSE FROM THE INSIDE (§6.6.8) — `posePlay`, the mirror `rivalPose`
//      never had.
//
//      ⚠️ THIS ROW IS WHAT MAKES POSING REACHABLE AT ALL. `pose` costs 0 AP and
//      moves one flag; the FP lands at `endTurn`. Without a term that can tell
//      the state AFTER a pose from the state before it, the searcher sees two
//      identical scores and picks between them by tie-break — while quietly
//      giving up the defence die. So the FIRST assertion here is the one that
//      matters: posing has to score differently from not posing.
// ═════════════════════════════════════════════════════════════════════════════
{
  const base = withSpirit(baseState(), RONIN, { num: LIMELIGHT_HEX });
  // Everyone else shoved to their home corners, i.e. far away.
  const lone = { ...base, turn: { ...base.turn, startedOnLimelight: { [RONIN]: true } } };

  const still  = lone;
  const posing = withPose(lone, RONIN, { rounds: 0 });
  const veteran = withPose(lone, RONIN, { rounds: POSE_FP_MAX });

  eq(term(still, RONIN, 'posePlay'), 0, 'standing in the middle without posing pays nothing');
  ok(term(posing, RONIN, 'posePlay') > 0,
     '✨ a pose nobody can reach is worth taking — the term the searcher follows');
  ok(term(veteran, RONIN, 'posePlay') >= term(posing, RONIN, 'posePlay'),
     'a longer streak is worth more, exactly as the ladder pays more');

  // 💀 THE BET GOES THE OTHER WAY IN CONTACT. Posing next to a rival hands over
  // a free clean hit — that is not a small bonus, it is a donation.
  const neighbour = Object.values(HEX_BY_NUM).find(h => {
    const c = HEX_BY_NUM[LIMELIGHT_HEX];
    return h.num !== LIMELIGHT_HEX && Math.max(
      Math.abs(h.q - c.q), Math.abs(h.r - c.r), Math.abs((h.q + h.r) - (c.q + c.r))) === 1;
  });
  ok(neighbour, 'the fixture found a hex adjacent to the Limelight');
  const crowded = withPose(withSpirit(lone, ZERO, { num: neighbour.num }), RONIN, { rounds: 0 });
  ok(term(crowded, RONIN, 'posePlay') < 0,
     '💀 posing with a rival at arm\'s length is NEGATIVE — the defence die is gone');

  // 🕒 A pose struck on the turn you ARRIVE cannot pay until the turn after:
  // `limelightHeld` needs both ends of the turn. Discounted, not zeroed.
  const arrived = { ...posing, turn: { ...posing.turn, startedOnLimelight: {} } };
  ok(term(arrived, RONIN, 'posePlay') < term(posing, RONIN, 'posePlay'),
     '🕒 a pose that cannot pay until next turn is worth less than one that pays now');
  ok(term(arrived, RONIN, 'posePlay') > 0, '...but still worth something — it is on its way');

  eq(evaluate(posing, RONIN).weights.posePlay > 0, true,
     'the weight is a positive magnitude; the bet\'s sign lives in the term');
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

// ═════════════════════════════════════════════════════════════════════════════
// 17. 🎯 THE BOARD — §6.6.6's family, and the two inversions it must not become.
// ═════════════════════════════════════════════════════════════════════════════
//
// ⚠️ THE FIRST TWO ASSERTIONS ARE THE ONES THAT MATTER, and neither is about a
// magnitude. A term that pays for BEING NEAR an objective and stops paying the
// moment you take it is the `adjWounded` bug — cut on 2026-08-17 for exactly
// this — and it is invisible in play: nothing errors, the bot simply circles.
{
  const st = baseState();

  // ── 🎤 The centre is a RAMP, not just a shelf. A step inward from the far
  //    Backstage must move the number, or the term is flat where it is needed
  //    most and the bot has no reason to start walking.
  const ringOf = (n) => hexRingFromCenter(n);
  const backHex = st.spirits.find(x => x.id === RONIN).num;
  ok(ringOf(backHex) === 'back', 'fixture: the Ronin starts Backstage');
  const centreAt = (n) => term(withSpirit(st, RONIN, { num: n }), RONIN, 'centreStage');
  ok(centreAt(LIMELIGHT_HEX) === 1, '🎤 the Limelight is the maximum');
  ok(centreAt(LIMELIGHT_HEX) > centreAt(backHex), '…and Backstage is the minimum');
  {
    // Walk in one hex from home and the term must RISE, even while still in the
    // same ring — that is the whole difference between a shelf and a ramp.
    const home = HEX_BY_NUM[backHex];
    const inward = Object.values(HEX_BY_NUM)
      .filter(h => Math.abs(h.q - home.q) + Math.abs(h.r - home.r) <= 2 && h.num !== backHex)
      .map(h => ({ h, c: centreAt(h.num) }))
      .sort((a, b) => b.c - a.c)[0];
    ok(inward && inward.c > centreAt(backHex),
       '🎤 one hex toward the middle scores more — the ramp is live');
  }

  // ── ⚡ THE HAND-OFF. Seeking a charge must be worth STRICTLY LESS than
  //    holding one, for every Spirit, or tapping the zone reads as a loss and
  //    the bot loiters beside it forever.
  for (const id of [RONIN, ZERO, METAL]) {
    const w = weightsFor(id);
    ok(w.charge > w.chargeSeek,
       `⚡ ${id}: holding a charge outweighs seeking one — the hand-off cannot invert`);
  }
  {
    const zone = st.board.chargeZones[0];
    ok(zone, 'fixture: the board has a Charge Zone');
    const onZone  = withSpirit(st, ZERO, { num: zone.num });
    const seeking = term(onZone, ZERO, 'chargeSeek');
    ok(seeking === 1, '⚡ standing on a lit zone is maximum seek');
    const holding = term(withNs(onZone, ZERO, { chargeFloorTurns: 2 }), ZERO, 'chargeSeek');
    eq(holding, 0, '⚡ …and it gates OFF once the charge is held — `charge` has it now');
    // The net of the hand-off, weighted, must be positive.
    const before = evalScore(onZone, ZERO);
    const after  = evalScore(withNs(onZone, ZERO, { chargeFloorTurns: 2 }), ZERO);
    ok(after > before, '⚡ tapping the zone is a GAIN, not a loss — no `adjWounded` here');
  }

  // ── 🎵 STOCK is the banked half of a Lost Chord, and it must count UNUSED
  //    slots. Counting the array would score a spent reservoir as a full one.
  {
    const full  = withNs(st, RONIN, { noteStock: ['C','D','E','F'], usedStockIdx: [] });
    const spent = withNs(st, RONIN, { noteStock: ['C','D','E','F'], usedStockIdx: [0,1,2] });
    ok(term(full, RONIN, 'stock') > term(spent, RONIN, 'stock'),
       '🎵 a reservoir you have spent is not a reservoir you have');
  }

  // ── 🔊 BEAM SETUP — the four bands, in order, and the rig gate.
  {
    const shooter = st.spirits.find(x => x.id === RONIN);
    const here = HEX_BY_NUM[shooter.num];
    const facing = facingOptions(shooter)[0];
    const aimed = { ...shooter, facing };
    const inBeam = [...sonicBeam(aimed)][0];
    ok(inBeam != null, 'fixture: the beam reaches somewhere');

    const posed = withSpirit(withSpirit(st, RONIN, { facing }), ZERO, { num: inBeam, facing });
    const rivalsOf = (state) => state.spirits.filter(x => x.id !== RONIN && !x.knockedOut);
    const self = posed.spirits.find(x => x.id === RONIN);
    const nsSelf = posed.noteStates[RONIN];
    const live = beamOpportunity(posed, self, nsSelf, rivalsOf(posed), {});
    ok(live >= BEAM_READY, '🔊 a rival standing in the live beam is at least a ready shot');

    // Off every axis entirely: strictly less than one `face` away.
    const offAxis = Object.values(HEX_BY_NUM).find(h =>
      ![...facingOptions(self)].some(f => sonicBeam({ num: self.num, facing: f }).has(h.num))
      && h.num !== self.num);
    if (offAxis) {
      const away = withSpirit(posed, ZERO, { num: offAxis.num });
      const v = beamOpportunity(away, self, nsSelf, rivalsOf(away));
      ok(v < BEAM_ALIGNED, '🔊 a rival on no axis at all scores below "one face away"');
    }
    ok(BEAM_DUEL > BEAM_READY && BEAM_READY > BEAM_ALIGNED,
       '🔊 the bands are ordered: a duel beats a shot beats an alignment');

    // 🎤 A rival who cannot answer is not a duel — they are just a target.
    const withPoser = withPose(posed, ZERO, { rounds: 0 });
    const posingRival = beamOpportunity(withPoser, self, nsSelf, rivalsOf(withPoser));
    ok(posingRival <= BEAM_READY, '🎤 a POSING rival cannot riff back, so it is no duel');
  }
}

console.log(`✅ evalCheck — ${checks} assertions passed`);
