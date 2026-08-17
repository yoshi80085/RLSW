// ─── BOT EVALUATION ─────────────────────────────────────────────────────────
// `evaluate(state, spiritId, view) -> { score, terms }` — BOT_STRATEGY_HANDOFF §5.
//
// THE PERSONA REPLACEMENT. `BOT_PERSONALITIES` weights a *hex*; this weights a
// *position*, and it is keyed by SPIRIT rather than by an invented personality.
// Character comes from the weight column, difficulty comes from search depth,
// and the two stop being the same dial (§0.1).
//
// PURE. No React, no refs, no rng, no mutation. Same inputs ⇒ same number,
// which is what lets the searcher call it a few thousand times a turn and what
// lets `evalCheck.mjs` pin it down.
//
// ⚠️ WHY THERE IS A `view` ARGUMENT. Two things this has to score are still
// React-owned and are NOT on the engine state (see `state.js` — the null
// slices):
//   · `posing`          { [spiritId]: bool }  — who is currently Striking a Pose
//   · `limelightScores` { [spiritId]: rounds } — cumulative pose rounds banked
// Rather than pretend they are readable, they come in through `view` and
// default to empty. An eval with no view still scores every other term
// correctly; it is simply blind to §3.3, and `terms.rivalPose` will read 0.
// When those slices move into the engine, delete the argument and read them
// off `state` — nothing else here changes.
//
// SIGN CONVENTION (resolves an ambiguity in the §5 table). Every WEIGHT here is
// a positive magnitude. Every TERM VALUE is a signed number in [-1, 1] where
// positive means "good for me". The two rows §5 prints as threats/penalties —
// `rivalPose` and `targetUpside` — therefore carry their sign in the VALUE, not
// in the weight. §5 printing the underdog row as −1.0 while printing the pose
// row as +1.0 was not a considered distinction, it was drift.

import {
  STOCK_REFILL_RATE, DB_UPGRADE_THRESHOLD, stackCapFor,
  fpPerLife, POSE_FP_STEP, POSE_FP_MAX,
  UNDERDOG_MIN_DEFICIT, UNDERDOG_DEFICIT_PER_STEP, UNDERDOG_MAX_MULT,
  FAN_MULT_CAP, FAN_DIEHARD_START,
} from "../../data/gameConstants.js";
import { SPIRIT_DEFS } from "../../data/spirits.js";
import { CORNERS } from "../../data/corners.js";
import { HEX_BY_NUM, ALL_HEXES, EDGE_HEX_NUMS } from "../../board/hexMap.js";
import { axialDist } from "../../board/hexGeometry.js";
import { crowdMultiplier } from "../../board/boardHelpers.js";
import { sonicRig } from "../systems/sonicRig.js";
import { SKILL_BY_ID } from "../../data/skillTree.js";

// ── Tunables that are eval-local, not game rules ────────────────────────────

// 🎭 The Ronin's cliff (§4.1). Performance Score ≥5 roughly doubles his fan
// intake and sheds fans below it — a STEP, not a slope, so it is scored as one.
// Lives here rather than in gameConstants because the cliff is a property of
// his innate, and gameConstants holds no per-Spirit innate numbers yet.
export const PERF_CLIFF = 5;

// Longest distance any hex sits from the board edge — the denominator for the
// edge-safety term. Derived once from the map so a board redraw retunes it
// automatically instead of silently skewing the term.
const EDGE_HEXES = ALL_HEXES.filter(h => EDGE_HEX_NUMS.has(h.num));
export const MAX_EDGE_DIST = ALL_HEXES.reduce((mx, h) => {
  const d = EDGE_HEXES.reduce(
    (m, e) => Math.min(m, axialDist(h.q, h.r, e.q, e.r)), Infinity);
  return Number.isFinite(d) ? Math.max(mx, d) : mx;
}, 0) || 1;

// 🎓 The starting kit. `economy.js` wires every Spirit in with `amp_1` (and the
// Ronin with `theory_minor`), so those are not PURCHASES and must not be scored
// as investment — otherwise the Ronin is born looking richer than everybody else.
export const STARTING_SKILLS = new Set(['amp_1', 'theory_minor']);

// 🎓 How much Db invested in the kit counts as "fully equipped". Not a rule —
// a normaliser, chosen as roughly two mid-tier unlocks, which is what a Spirit
// can realistically land inside one match at the Db rates in §2.
export const KIT_DB_HORIZON = 20;

// ── §5 weights ──────────────────────────────────────────────────────────────
//
// ⚠️ STARTING POINTS, NOT MEASUREMENTS. Every number below is a design
// intention transcribed from §5 and must be replaced by whatever the §6.6
// harness says actually wins. Do not cite these as balance data.
//
// ⚠️ Metalness is knowingly untunable until his innate lands (§4.3). His column
// is present so the searcher runs, not because it is right.

export const DEFAULT_WEIGHTS = {
  survival: 1.0, fame: 1.0, fanMult: 1.0, perfCliff: 1.0,
  drive: 1.0, sustain: 1.0, apBanked: 1.0, inRig: 1.0,
  charge: 1.0, refillDenied: 1.0, adjWounded: 1.0, edgeSafety: 1.0,
  dbHorizon: 1.0, rivalPose: 1.0, targetUpside: 1.0, kit: 1.6,
};

export const EVAL_WEIGHTS = {
  // 🗡️ The fragile virtuoso. Vibe and the fan multiplier his innate compounds;
  // the Performance cliff is the single highest-leverage number in his kit.
  cosmic_ronin: {
    survival: 1.4, fame: 1.2, fanMult: 1.3, perfCliff: 2.0,
    drive: 1.1, sustain: 0.7, apBanked: 0.9, inRig: 1.0,
    charge: 0.5, refillDenied: 0.3, adjWounded: 0.8, edgeSafety: 1.3,
    dbHorizon: 1.0, rivalPose: 1.0, targetUpside: 1.0, kit: 1.6,
  },
  // 📻 The cosmic controller. The Boom Box makes "hold a charge" a near-
  // permanent objective, and denial is his win path, not damage.
  intergalactic_0: {
    survival: 1.0, fame: 1.0, fanMult: 0.7, perfCliff: 0.4,
    drive: 0.6, sustain: 1.2, apBanked: 0.5, inRig: 1.6,
    charge: 2.2, refillDenied: 1.5, adjWounded: 0.4, edgeSafety: 0.9,
    dbHorizon: 1.0, rivalPose: 1.0, targetUpside: 1.0, kit: 1.6,
  },
  // 🟢 The bruiser. Attrition that snowballs — he wants to be standing next to
  // something already bleeding.
  Metalness_Monster: {
    survival: 0.7, fame: 1.1, fanMult: 0.6, perfCliff: 0.3,
    drive: 1.3, sustain: 1.0, apBanked: 0.5, inRig: 0.8,
    charge: 0.5, refillDenied: 0.4, adjWounded: 1.5, edgeSafety: 0.6,
    dbHorizon: 1.0, rivalPose: 1.0, targetUpside: 1.0, kit: 1.6,
  },
};

/** Weight column for a Spirit, falling back to the flat default. */
export function weightsFor(spiritId) {
  return EVAL_WEIGHTS[spiritId] ?? DEFAULT_WEIGHTS;
}

// ── Small shared readers ────────────────────────────────────────────────────

const clamp01  = (n) => Math.max(0, Math.min(1, n));
const clampSig = (n) => Math.max(-1, Math.min(1, n));

/** Fame required to win THIS match — lives × the player-count curve (§2). */
export function fameToWin(state) {
  const lives  = state?.config?.startingLives ?? 3;
  const count  = (state?.spirits ?? []).length || 1;
  return lives * fpPerLife(count);
}

/**
 * 📻 Boom Box (§4.2) — Intergalactic 0's distance from home reads ZERO while he
 * holds any charge. Mirrors `boomBoxLit` in the client. If that innate is ever
 * given to a second Spirit, widen the id check in BOTH places.
 */
export function boomBoxLit(spiritId, ns = {}) {
  if (spiritId !== 'intergalactic_0') return false;
  return (ns.chargeFloorTurns ?? 0) > 0 || (ns.chargeCeilTurns ?? 0) > 0;
}

/** Axial distance from a Spirit to their own corner's Main Amp. */
export function distFromHome(spirit, ns = {}) {
  if (boomBoxLit(spirit?.id, ns)) return 0;
  const home = HEX_BY_NUM[CORNERS[spirit?.corner]?.homeNum];
  const here = HEX_BY_NUM[spirit?.num];
  if (!home || !here) return 0;
  return axialDist(home.q, home.r, here.q, here.r);
}

/** Hexes from this hex to the nearest board edge. Bigger = safer from knockback. */
export function distFromEdge(hexNum) {
  const here = HEX_BY_NUM[hexNum];
  if (!here) return 0;
  if (EDGE_HEX_NUMS.has(hexNum)) return 0;
  return EDGE_HEXES.reduce((m, e) => Math.min(m, axialDist(here.q, here.r, e.q, e.r)), MAX_EDGE_DIST);
}

/** FP a posing Spirit banks on their NEXT surviving round (§3.3). */
export function posePayout(rounds = 0) {
  return Math.min((rounds + 1) * POSE_FP_STEP, POSE_FP_MAX);
}

/**
 * The comeback multiplier a hit on `loserId` would pay `spiritId` (§3.7).
 *
 * ⚠️ CORRECTED AGAINST SOURCE. §3.7 reads "beating up the last-place Spirit
 * pays them ... prefer second place." That is backwards. `combat.js`:
 *   underdogBonus(winnerFame, loserFame) → deficit = loserFame - winnerFame
 * The bonus goes to the WINNER when the winner is the one behind. So the money
 * is in punching UP: a trailing bot should hunt the fame LEADER, and a leading
 * bot gains no multiplier from anyone. Nobody is ever "paid" for being hit.
 * Mirrors underdogBonus's ramp exactly — if that changes, change this with it.
 */
export function targetMultiplier(myFame, theirFame) {
  const deficit = theirFame - myFame;
  if (deficit < UNDERDOG_MIN_DEFICIT) return 1;
  return Math.min(UNDERDOG_MAX_MULT, 1 + (deficit / UNDERDOG_DEFICIT_PER_STEP) * 0.5);
}

// ── The evaluator ───────────────────────────────────────────────────────────

/**
 * Score a whole position from one Spirit's seat.
 *
 * @param {object} state     engine GameState (spirits, noteStates, turn, config)
 * @param {string} spiritId  whose seat we are scoring from
 * @param {object} [view]    React-owned slices: { posing, limelightScores }
 * @returns {{ score:number, terms:Record<string,number>, weights:object }}
 *
 * `terms` is returned for a reason: a single number tells you the bot preferred
 * a line but never WHY, and a mis-signed term looks exactly like a good bot
 * until it loses 2000 matches. Log the breakdown, don't trust the total.
 */
export function evaluate(state, spiritId, view = {}) {
  const { posing = {}, limelightScores = {} } = view;
  const weights = weightsFor(spiritId);

  const spirits = state?.spirits ?? [];
  const self    = spirits.find(s => s.id === spiritId);
  const ns      = state?.noteStates?.[spiritId] ?? {};
  const def     = SPIRIT_DEFS[spiritId] ?? {};

  // A dead seat is worth nothing and must never look merely bad — otherwise a
  // search can trade its own life for a rounding error somewhere else.
  if (!self || self.knockedOut) {
    const zeroed = Object.fromEntries(Object.keys(weights).map(k => [k, 0]));
    return { score: -Infinity, terms: { ...zeroed, survival: -1 }, weights };
  }

  const rivals = spirits.filter(s => s.id !== spiritId && !s.knockedOut);
  const target = fameToWin(state);
  const myFame = ns.fame ?? 0;
  const fameFrac = clamp01(myFame / target);

  // ── §3.6 investment horizon. Compounding terms (fans, banked Db) are worth
  // more the further the finish line is: a fan multiplier bought at 20/24 has
  // almost no payouts left to multiply. Decays linearly to nothing at the win.
  const horizon = 1 - fameFrac;

  const terms = {};

  // 1. SURVIVAL — lives are the coarse grain, Vibe the fine. Folded into one
  //    fraction so losing a life always outranks losing Vibe.
  const maxVibe   = self.maxVibe ?? def.maxVibe ?? 5;
  const lives     = self.lives ?? state?.config?.startingLives ?? 3;
  const allLives  = state?.config?.startingLives ?? 3;
  terms.survival = clamp01((Math.max(0, lives - 1) + clamp01((self.vibe ?? maxVibe) / maxVibe)) / allLives);

  // 2. FAME — the only win condition that isn't "everyone else is dead".
  terms.fame = fameFrac;

  // 3. FAN MULTIPLIER — multiplies every FP payout, so it is an INVESTMENT.
  const mult = crowdMultiplier(ns.diehards ?? FAN_DIEHARD_START, ns.casuals ?? 0, ns.assignedDiehards ?? 0);
  terms.fanMult = clamp01((mult - 1) / (FAN_MULT_CAP - 1)) * horizon;

  // 4. PERFORMANCE CLIFF — deliberately a step function (§4.1). Scoring this as
  //    a slope teaches the Ronin to drift toward 4 and collect nothing.
  terms.perfCliff = (ns.perfScore ?? 0) >= PERF_CLIFF ? 1 : 0;

  // 5/6. STACK QUALITY — measured against the EARNED cap (`stackCapFor`), never
  //    a flat 5. The stale flat cap is exactly what would over-rate the Theory
  //    route's early rungs (§1's resolved doc drift).
  const cap = Math.max(1, stackCapFor(ns.unlockedSkills ?? []));
  terms.drive   = clamp01((ns.driveStack   ?? []).length / cap);
  terms.sustain = clamp01((ns.sustainStack ?? []).length / cap);

  // 7. AP BANKED — only the acting Spirit has a live pool. For everyone else
  //    this is unknowable, not zero, so it is neutralised rather than guessed.
  const acting = state?.acting === spiritId;
  const speed  = def.speed ?? 5;
  terms.apBanked = acting ? clamp01((state?.turn?.moveStepsLeft ?? 0) / speed) : 0;

  // 8. INSIDE OWN RIG RADIUS — §3.1's worst square on the board is being
  //    stranded outside it: a bare d4 defence and no riff-off at all.
  const chargeBoost = (ns.chargeCeilTurns ?? 0) > 0 ? 1 : 0;
  terms.inRig = sonicRig(ns.unlockedSkills ?? [], distFromHome(self, ns), chargeBoost).inRange ? 1 : 0;

  // 9. HOLDING A CHARGE — a boost for everyone, an identity for Intergalactic 0.
  terms.charge = ((ns.chargeFloorTurns ?? 0) > 0 || (ns.chargeCeilTurns ?? 0) > 0) ? 1 : 0;

  // 10. RIVAL REFILL DENIED — Gravity Control's 2 notes is a third of a rival's
  //     turn income. Scored as TEMPO, not damage, or it never gets cast (§4.2).
  terms.refillDenied = rivals.length
    ? clamp01(rivals.reduce((sum, r) => {
        const rns = state?.noteStates?.[r.id] ?? {};
        return sum + clamp01((rns.refillDrain ?? 0) / STOCK_REFILL_RATE);
      }, 0) / rivals.length)
    : 0;

  // 11. ADJACENCY TO A WOUNDED RIVAL — the bruiser's whole shape. Only counts
  //     rivals actually in melee reach; a wounded Spirit across the board is a
  //     plan, not a position.
  const here = HEX_BY_NUM[self.num];
  terms.adjWounded = here
    ? rivals.reduce((best, r) => {
        const rh = HEX_BY_NUM[r.num];
        if (!rh || axialDist(here.q, here.r, rh.q, rh.r) > 1) return best;
        const rMax = r.maxVibe ?? SPIRIT_DEFS[r.id]?.maxVibe ?? 5;
        return Math.max(best, clamp01(1 - (r.vibe ?? rMax) / rMax));
      }, 0)
    : 0;

  // 12. EDGE SAFETY — knockback is 1–2 hexes and the edge is a knockout, so
  //     standing room is defensive value the hex scorers already priced.
  terms.edgeSafety = clamp01(distFromEdge(self.num) / MAX_EDGE_DIST);

  // 13. Db BANKED vs. MATCH REMAINING (§3.2) — the sharpest tension in the game
  //     and the one the current bot has no concept of. Banked Db is only worth
  //     something if there is enough match left to fire what it buys; a 14–16 Db
  //     capstone bought at 20/24 never pays for itself.
  //     ⚠️ DIVIDED BY WHAT YOU ARE SAVING FOR, NOT BY A FLAT CONSTANT. This read
  //     `/ DB_UPGRADE_THRESHOLD` until 2026-08-16, which is the FALLBACK cost
  //     used when no skill is targeted (4) — not a ceiling on banking. Skills
  //     cost 6–16, so the term saturated at 4 and scored 4 Db and 16 Db as
  //     identically good, which is precisely the "saving toward a capstone"
  //     tension §3.2 calls the sharpest in the game, flattened away. §5 already
  //     states this discipline for the stacks — "divide by `stackCapFor()`,
  //     never a flat 5" — and it applies here for the same reason.
  //     `melodyCommit.js` and the client both derive the target cost this exact
  //     way, so this is now one rule with three consumers rather than two
  //     different readings of one pool.
  const targetCost = SKILL_BY_ID[ns.targetSkillId]?.dbCost ?? DB_UPGRADE_THRESHOLD;
  terms.dbHorizon = clamp01((ns.dbPoints ?? 0) / targetCost) * horizon;

  // 13b. 🎓 KIT — Db that has been CONVERTED INTO CAPABILITY. The other half of
  //     §3.2, and it was missing.
  //
  //     ⚠️ WITHOUT THIS THE BOT CAN NEVER BUY ANYTHING, and the failure is
  //     structural rather than a tuning miss. `dbHorizon` scores Db BANKED, so
  //     an unlock is a pure loss to it — the Db leaves the bank and nothing in
  //     the table records what arrived in its place. A greedy searcher therefore
  //     refuses every purchase in the game, forever. Found 2026-08-16, the first
  //     time the §6.6 bench was handed a real SKILL_TREE: across 60 turns of a
  //     three-handed match, not one skill was bought by anybody.
  //
  //     📌 It is measured in Db INVESTED rather than skills COUNTED, which makes
  //     it the exact mirror of `dbHorizon` — one pool, two states — and means a
  //     12 Db capstone is not scored the same as a 6 Db rung. Starting kit is
  //     excluded; being wired in is not an investment.
  //
  //     ⚠️ AND IT IS MULTIPLIED BY THE HORIZON, which is §3.2's actual verdict:
  //     "a capstone bought at fame 20/24 never pays for itself." Late in a match
  //     an unlock is worth less because there is less match left to fire it.
  const invested = (ns.unlockedSkills ?? [])
    .filter(id => !STARTING_SKILLS.has(id))
    .reduce((sum, id) => sum + (SKILL_BY_ID[id]?.dbCost ?? 0), 0);
  terms.kit = clamp01(invested / KIT_DB_HORIZON) * horizon;

  // 14. RIVAL POSE THREAT (NEW — no equivalent in `botHexScore`). A maxed poser
  //     earns a full turn's FP ceiling standing still, which makes them the
  //     table's problem, not just their neighbour's. NEGATIVE by definition.
  terms.rivalPose = -clamp01(rivals.reduce((worst, r) => (
    posing[r.id] ? Math.max(worst, posePayout(limelightScores[r.id] ?? 0) / POSE_FP_MAX) : worst
  ), 0));

  // 15. TARGET UPSIDE (NEW — replaces §3.7's "underdog-target penalty", which
  //     was inverted; see `targetMultiplier`). Positive: the comeback
  //     multiplier waiting on the best rival currently in reach. Punching UP
  //     pays; there is no penalty for punching down, just no bonus.
  terms.targetUpside = here
    ? clamp01(rivals.reduce((best, r) => {
        const rh = HEX_BY_NUM[r.num];
        if (!rh || axialDist(here.q, here.r, rh.q, rh.r) > 1) return best;
        const m = targetMultiplier(myFame, state?.noteStates?.[r.id]?.fame ?? 0);
        return Math.max(best, (m - 1) / (UNDERDOG_MAX_MULT - 1));
      }, 0))
    : 0;

  let score = 0;
  for (const key of Object.keys(weights)) {
    terms[key] = clampSig(terms[key] ?? 0);
    score += weights[key] * terms[key];
  }

  return { score, terms, weights };
}

/** Convenience for callers that only want the number. */
export function evalScore(state, spiritId, view) {
  return evaluate(state, spiritId, view).score;
}
