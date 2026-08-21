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
// ✅ THE `view` ARGUMENT NO LONGER CARRIES ANY GAME STATE (2026-08-17, §6.6.8).
// It existed for exactly two React-owned slices:
//   · `posing`          { [spiritId]: bool }  — who is currently Striking a Pose
//   · `limelightScores` { [spiritId]: rounds } — cumulative pose rounds banked
// Both are engine state now (`systems/limelight.js`), so they are read off
// `state` like every other term — and `terms.rivalPose`, which in a headless
// match could only ever read 0, is finally live.
//
// ⚠️ THE ARGUMENT SURVIVES FOR ONE NON-RULE REASON: `weightOverrides`, the
// bench's `--weights='{...}'` hook for isolating a single term at fixed seeds.
// That is an instrument, not a slice of the game. If a third thing ever wants
// to ride along, ask first whether it is a RULE — if it is, it belongs on the
// state, and this argument is what made it easy not to notice for a whole
// phase.
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
  FAN_MULT_CAP, FAN_DIEHARD_START, SONIC_BEAM_REACH, LIMELIGHT_HEX,
  RIG_POOL_FLOOR, RIG_TIER_MAX,
} from "../../data/gameConstants.js";
import { SPIRIT_DEFS } from "../../data/spirits.js";
import { CORNERS } from "../../data/corners.js";
import { HEX_BY_NUM, ALL_HEXES, EDGE_HEX_NUMS } from "../../board/hexMap.js";
import { axialDist } from "../../board/hexGeometry.js";
import { crowdMultiplier, hexRingFromCenter } from "../../board/boardHelpers.js";
import { usedHas } from "../systems/economy.js";
import { rigFor } from "../systems/attackParams.js";
import { rigSpendable, rigTiers } from "../systems/sonicRig.js";
import { posePayout, posingMap, poseRounds, isPosing } from "../systems/limelight.js";
import { SKILL_BY_ID } from "../../data/skillTree.js";
// 🔊 The beam geometry, BORROWED FROM THE GENERATOR RATHER THAN RE-DERIVED. A
// second copy of "which hexes does a Sonic reach" is a second thing to retune,
// and the whole point of the `beamSetup` term is that it agrees with the action
// `legalActions` will or will not offer.
import { sonicBeam, facingOptions } from "./legalActions.js";
// 🔪 The rear wedge, BORROWED rather than re-derived, for the same reason the
// beam geometry above is. `isRearHit` is the rule the DICE read (`chordFrayAmount`
// strips REAR_FRAY_BONUS extra notes on a blow from behind); `CONE_HALF_ARC` and
// `REAR_INTEREST_DIST` are `botHexScore`'s, so the ranker and the evaluator agree
// about what a flank is instead of drifting apart.
import { isRearHit } from "../systems/combat.js";
import { angleTo, angleDiff } from "../../board/hexGeometry.js";
import { CONE_HALF_ARC, REAR_INTEREST_DIST } from "./bot.js";

// ── Small shared clamps ─────────────────────────────────────────────────────
// Hoisted above the tunables because the board helpers below use them; every
// TERM VALUE is clamped to [-1, 1] so no single row can swamp the sum, and the
// weight column stays the only place tuning happens.
const clamp01  = (n) => Math.max(0, Math.min(1, n));
const clampSig = (n) => Math.max(-1, Math.min(1, n));

// ── Tunables that are eval-local, not game rules ────────────────────────────

// 🎭 The Ronin's cliff (§4.1). Performance Score ≥5 roughly doubles his fan
// intake and sheds fans below it — a STEP, not a slope, so it is scored as one.
// Lives here rather than in gameConstants because the cliff is a property of
// his innate, and gameConstants holds no per-Spirit innate numbers yet.
export const PERF_CLIFF = 5;

// 🔪 THE REAR-WEDGE TRADE, in `botHexScore`'s own 9:11 proportion, rescaled so
// one adjacent rival roughly fills the term's [-1, 1] range on its own.
// ⚠️ DEFENCE OUTWEIGHS OFFENCE, and the asymmetry is deliberate and inherited:
// you choose when to take a flank and never when one is taken from you.
export const REAR_OFFENCE = 0.45;
export const REAR_DEFENCE = 0.55;

// Longest distance any hex sits from the board edge — the denominator for the
// edge-safety term. Derived once from the map so a board redraw retunes it
// automatically instead of silently skewing the term.
const EDGE_HEXES = ALL_HEXES.filter(h => EDGE_HEX_NUMS.has(h.num));
export const MAX_EDGE_DIST = ALL_HEXES.reduce((mx, h) => {
  const d = EDGE_HEXES.reduce(
    (m, e) => Math.min(m, axialDist(h.q, h.r, e.q, e.r)), Infinity);
  return Number.isFinite(d) ? Math.max(mx, d) : mx;
}, 0) || 1;

// 🎓 The starting kit — what a Spirit is BORN with, which must not be scored as
// investment or the Ronin looks richer than everybody else from turn one.
//
// 📌 `amp_1` left this set on 2026-08-20 with the rig branch. It is not that the
// free rig went away — every Spirit still opens at `RIG_POOL_FLOOR`, 2d6 in
// range — it is that the floor is not a SKILL any more, so there is no id here
// to exclude. What remains is the Ronin's `theory_minor`.
export const STARTING_SKILLS = new Set(['theory_minor']);

// 🎓 How much Db invested in the kit counts as "fully equipped". Not a rule —
// a normaliser, chosen as roughly two mid-tier unlocks, which is what a Spirit
// can realistically land inside one match at the Db rates in §2.
export const KIT_DB_HORIZON = 20;

// 💢 HOW MUCH OF A WOUND SURVIVES BEING OUT OF REACH.
//
// ⚠️ IT IS A FLOOR, NOT A CUTOFF, AND THAT IS THE WHOLE DESIGN. Decay chip
// damage to ZERO at distance and a rival bleeding across the board contributes
// nothing — so the score is flat everywhere outside reach, there is no gradient
// pointing at the wounded one, and the bot has no reason to walk over and finish
// them. A floor keeps the wound worth something wherever they stand (it is a
// real fact about the match) while making it worth MORE when you can act on it,
// which is the gradient that produces an approach.
//
// 0.35 is a starting point, not a measurement — §5's standing warning.
export const PRESSURE_REACH_FLOOR = 0.35;

// 💢 HOW MUCH OF THE CHIP-VIBE CREDIT THE REACH GRADIENT IS ALLOWED TO MOVE.
//
// ⚠️ WITHOUT THIS BOUND, A BLOW THAT LANDS CAN SCORE WORSE THAN NOT THROWING
// IT — the §6.6.10 inversion. Chip Vibe was multiplied by `reachWeight` at full
// strength, and every attack in this game KNOCKS THE RIVAL BACK 1–2 hexes. So a
// hit adds one point of damage and simultaneously demotes ALL the damage already
// done to a lower reach band: a rival taken from 2 Vibe to 1 scored −0.02 (−0.05
// weighted) for the Ronin, measured over 390 landed swings. The bot was being
// told, in the term whose entire job is "hitting people is good", that hitting
// people is bad. It is the same failure that retired `adjWounded` (term 11) —
// scoring the OPPORTUNITY so that taking it destroys the payment — surviving in
// the term that replaced it.
//
// 🎯 THE INEQUALITY, IN THE §6.6.10 FORM: a term that scores GETTING READY must
// be capped below what DOING it pays. Here the reach gradient is the getting-
// ready half and one point of chip damage is the doing half, so the worst reach
// demotion a single hit can cause must cost less than that hit earns.
//
// The worst case is the tightest ratio available: a 1-point hit on a rival one
// point above going down (Vibe 2 → 1, the smallest proportional gain that is not
// a life) knocked the full 2 hexes, from melee reach to the floor. Requiring
//
//     (M-2)/(M-1)  ≤  1 - MIX · (1 - PRESSURE_REACH_FLOOR)
//
// for the largest Vibe pool on the roster (M) rearranges to the bound below.
// ⚠️ DERIVED FROM THE ROSTER, NOT PINNED AT A NUMBER, for the same reason
// `dbHorizon` divides by the skill you are saving for rather than a flat 4: a
// Spirit with a deeper Vibe pool makes the ratio tighter, and a hard-coded 0.35
// would silently go back to paying the bot for missing. `evalCheck` §16 sweeps
// the whole roster against the property itself, so this cannot drift quietly.
// 📌 The 0.9 is headroom, so the guarantee is strict rather than an equality one
// floating-point ulp could tip.
const MAX_VIBE_POOL = Math.max(...Object.values(SPIRIT_DEFS).map(d => d.maxVibe ?? 5));
export const PRESSURE_CHIP_REACH_MIX =
  0.9 / ((MAX_VIBE_POOL - 1) * (1 - PRESSURE_REACH_FLOOR));

/**
 * 💢 The reach multiplier actually applied to chip Vibe — `reachWeight` mixed
 * back toward 1 by `PRESSURE_CHIP_REACH_MIX`. Still strictly decreasing in
 * distance (the wound is worth more when you can act on it), but no longer
 * steep enough for a landed blow to lose more to the knockback than it gains.
 */
export function chipReachWeight(dist) {
  return 1 - PRESSURE_CHIP_REACH_MIX * (1 - reachWeight(dist));
}

/**
 * 💢 How much of a rival's chip damage counts, given how far away they are.
 *
 * Full value inside melee reach, decaying linearly to `PRESSURE_REACH_FLOOR` at
 * `SONIC_BEAM_REACH` — the longest reach any attack in this game has — and flat
 * at the floor beyond it. Monotone non-increasing by construction, which is the
 * property `evalCheck` pins: a term that could rise as a rival retreats would
 * pay the bot for letting them go.
 *
 * ⚠️ DISTANCE, NOT THE ATTACK CONE. Facing is deliberately ignored. Turning to
 * face costs 1 AP and `face` is not gated on the Action Token (§6a), so a rival
 * you are standing next to but not pointing at is one cheap action from being a
 * target — scoring them as unreachable would make the bot walk away from fights
 * it is already in.
 */
export function reachWeight(dist) {
  if (!Number.isFinite(dist)) return PRESSURE_REACH_FLOOR;
  if (dist <= 1) return 1;
  if (dist >= SONIC_BEAM_REACH) return PRESSURE_REACH_FLOOR;
  const t = (SONIC_BEAM_REACH - dist) / (SONIC_BEAM_REACH - 1);
  return PRESSURE_REACH_FLOOR + (1 - PRESSURE_REACH_FLOOR) * t;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 THE BOARD — §6.6.6's missing family
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ UNTIL 2026-08-17 THIS FILE HAD SIXTEEN TERMS AND NOT ONE OF THEM NAMED A
// PLACE. Grep it for `LIMELIGHT`, `chargeZone` or `hexRingFromCenter` and the
// count was zero; `edgeSafety` was the only term that read the board at all, and
// all it says is "not the edge". Asked how they actually play, Alex described a
// game about contesting the middle:
//
//   "Most action takes place in the middle. The Limelight spot is there, Charge
//    up spots tend to be in the middle, with upgrades available, I would try and
//    work it to get a good Sonic attack off. I couldn't say 'how close I am to
//    Rivals' honestly."
//
// 🧭 AND IT EXPLAINS THE CLUMPING. `botHexScore` — the MOVE planner — has always
// known which hex is better once a move is happening. But `evaluate` decides
// whether to move AT ALL, and there `apBanked` charged for the step while
// nothing credited the destination. The bots were never choosing melee range;
// they were declining to travel, drifting until they touched and staying there
// for 83% of all turns.
//
// ⚠️ WHY THERE IS NO "WALK TO THE LOST CHORD" TERM, WHICH IS THE FIRST THING
// SOMEBODY WILL TRY TO ADD. A token is CONSUMED on arrival, so a
// distance-to-token term necessarily FALLS at the moment it is collected — the
// nearest token becomes the next-nearest, further away — which is the exact
// shape of the `adjWounded` inversion cut on the same day: a term that pays for
// standing near an opportunity and destroys the payment when you take it. The
// split that avoids it:
//   · WHICH hex to walk to is `botHexScore`'s question, and it already carries a
//     `token` weight of 22 plus a distance gradient (§6.3: the scorer picks
//     which, the evaluator picks whether).
//   · WHAT THE PICKUP WAS WORTH is banked by `stock`, which is new below and is
//     the mirror the reservoir never had.
// So the two objectives that do get gradients here are the two that CANNOT
// invert: the Limelight, which is never consumed, and the Charge Zone, whose
// value hands straight off to the `charge` term the moment it is tapped.

/** Longest distance from the Limelight to any hex — the centre gradient's scale. */
const HUB = HEX_BY_NUM[LIMELIGHT_HEX];
export const MAX_CENTRE_DIST = ALL_HEXES.reduce(
  (mx, h) => (HUB ? Math.max(mx, axialDist(h.q, h.r, HUB.q, HUB.r)) : mx), 0) || 1;

/**
 * 🎤 What each centre ring is worth to stand in.
 *
 * Shaped on `FAN_GAIN_BY_RING` (main 2 / pit 1 / floor 1 / back 0) rather than
 * invented, because that table is what a commit in each ring actually pays —
 * but the Limelight is pulled clear of the Pit because it is also the Pose hex
 * and the one square the whole table wants (§3.3, §3.6). Back is 0, not
 * negative: `edgeSafety` already prices the danger of the rim, and paying twice
 * for it would make a Spirit knocked to the edge score its own recovery as a
 * second loss.
 */
export const CENTRE_RING_PAY = { main: 1, pit: 0.8, floor: 0.45, back: 0 };

/**
 * How much of the centre term is the SHELF (which ring you reached) and how much
 * is the RAMP (how far you still are).
 *
 * ⚠️ THE RAMP IS THE HALF THAT MATTERS AND IT IS EASY TO DELETE BY ACCIDENT.
 * Ring alone is a step function, so it is perfectly flat across the whole
 * Backstage — a Spirit out at the rim sees the same score whether it walks
 * inward or stands still, which is precisely the "scores the result, never the
 * act of going and getting it" failure this family exists to fix. The ramp is
 * what makes a single hex of travel move the number.
 */
export const CENTRE_SHELF = 0.6, CENTRE_RAMP = 0.4;

/** How far a Charge Zone still pulls. Beyond this the walk is somebody else's plan. */
export const CHARGE_SEEK_REACH = 6;

/**
 * 🎪 How far a MARQUEE pulls — and this row exists because the rig came off
 * the skill tree (MARQUEE_QUIZ_DESIGN.md §4).
 *
 * ⚠️ WITHOUT IT THE WORKOUT IS INVISIBLE TO EVERY BOT. Measured on 30 bench
 * matches the day the engine learned to draw a trivia question: 0.20 marquee
 * visits PER MATCH across ~36 turns, and 60 of 60 seats finished at the rig
 * floor. `botHexScore` has had an events term for months, but that is an action
 * PRIOR — the searcher plans on `evaluate`, and `evaluate` had no opinion about
 * the middle of the board lighting up. While pool and power were a Db purchase
 * that was a missed opportunity; now it is the difference between a bench
 * Spirit having a rig and not having one.
 *
 * 📌 The value is scaled by HEADROOM: a Spirit at 3/3 has nothing left to
 * train, and for them the card pays only fans.
 */
export const MARQUEE_SEEK_REACH = 6;
export const MARQUEE_MAXED_VALUE = 0.4;

// ── 🔊 The Sonic setup ──────────────────────────────────────────────────────
//
// ⚠️ THE BOT HAS NEVER FIRED A SONIC. Measured, not assumed: it is offered on
// 1.4% of action-phase decision points and chosen ZERO times across every bench
// run on record — while `sonicFame(margin)` is `max(1, ceil(margin/2))`, i.e.
// the only attack in the game whose Fame scales with the advantage you built,
// and the gate the riff-off rides on. Alex's direction, 2026-08-17: "Sonic
// should be the main way to gain Fame. And Riff Offs even more so."
//
// 🧭 IT IS NOT A WEIGHT PROBLEM, IT IS A GEOMETRY PROBLEM. The beam is a
// STRAIGHT LINE OF THREE and the Spirits stand at distance 1 for 83% of turns,
// jammed together where the Swing cone is easy and the beam needs alignment.
// Nothing valued standing off ON an axis, so the shot never existed to be taken.
// This term is the "devise ways to reach these awards" half, and it belongs in
// the evaluator rather than the scorer because it is a property of a POSITION.

// ⚠️ 2026-08-18 — THIS TERM'S WEIGHT WAS WHAT STOPPED THE BOTS PLAYING, and the
// bug was not in the bands below. They are fine; the COLUMN was priced against
// nothing. At `beamSetup: 2.2`, giving up a live duel line cost the Ronin 1.96
// points of position, while the 8 Fame the duel pays — a THIRD of a 24-point
// race — scored +0.73. So the best move in a stalled board was `endTurn`, and
// two Spirits stood nose to nose for 400 turns composing melodies: 2,178 melody
// notes, 400 confirms, 5 swings, 0 duels, 4 Fame between them (§6.6.10).
//
// 🎯 THE RULE THIS BROKE IS ALREADY WRITTEN DOWN, one term up: `chargeSeek` must
// be worth strictly less than `charge`, because a term that scores the APPROACH
// to an objective and does not hand off to a term that scores HAVING TAKEN IT
// teaches the bot to loiter beside it forever. `beamSetup` had no such partner
// and no such inequality — firing the beam DESTROYS the alignment it scores, and
// the Fame it earns is normalised against the whole match. Scaled ×0.32 so the
// roster's ordering (Zero > Ronin > Metalness — it is character, see each
// column) survives: inconclusive matches fell from 65% to 2%.
//
// ⚠️ THE GENERAL LESSON IS THE INEQUALITY, NOT THE NUMBER. Any future term that
// scores getting ready to do something must be capped below what doing it pays,
// or the bot will get ready forever.

/** A shot that is live right now. */
export const BEAM_READY = 0.8;
/** A shot one `face` away — 1 AP, and `face` is not gated on the Action Token. */
export const BEAM_ALIGNED = 0.55;
/** 🎤 A RIFF-OFF is live: mutual beams, both rigs up. The biggest Fame play there is. */
export const BEAM_DUEL = 1;

/**
 * 🔊 How close this Spirit is to a beam shot, and how good a shot it is.
 *
 * Four bands rather than a smooth function, because the underlying thing is not
 * smooth: a Sonic is either legal or it is not, and the cost of making it legal
 * is either nothing, or one AP, or a walk.
 *
 * ⚠️ IT DOES NOT READ THE ACTION TOKEN, and that is deliberate. Facing persists
 * across turns, so alignment held after the token is spent is alignment you open
 * next turn with. Gating it on `!tokenSpent` would have the bot abandon a shot
 * it has already set up, every single turn, one action too early.
 *
 * ⚠️ IT DOES READ THE RIG, through `rigFor` and not `sonicRig`, for the same
 * reason `legalActions` does: a BLOWN rig (🔊 Goes to 11) reads as offline
 * wherever the Spirit stands. A term that promised a shot the generator would
 * refuse to emit is worse than no term.
 */
/**
 * 🔪 WHICH WAY IS HE LOOKING — the term that did not exist until 2026-08-20.
 *
 * The game prices facing on DEFENCE: `chordFrayAmount` strips `REAR_FRAY_BONUS`
 * extra Sustain notes when a blow lands in your rear arc, and `legalActions`'
 * `face` case says out loud that this is why turning is not gated on the action
 * token. 🗡️ It prices it on OFFENCE too, hardest for the Ronin: Psycho Bushido
 * dashes along the facing line, so his signature ability is aimed by this and
 * nothing else.
 *
 * ⚠️ IT LIVED IN THE RANKER AND NOWHERE ELSE, WHICH IS WHY NOBODY NOTICED.
 * `botHexScore`'s rear block has modelled this trade since long before the
 * searcher, and `actionScore`'s `case 'face'` delegates to it — so the beam
 * always ordered the facings correctly and then handed `evaluate` five options
 * it could not tell apart, because no term in this file read `.facing` at all.
 * Measured before the fix: every facing priced to the SAME NUMBER to four
 * decimals, `face` took 41.7% of the Ronin's entire AP budget, and 100% of
 * multi-face runs were a two-facing oscillation that span until the AP ran out —
 * `endTurn` legal on every step of every one of them.
 *
 * 🎯 §6.6.14's shape, mirrored. There the evaluator wanted a branch the search
 * could not reach. Here the search offered a branch the evaluator could not
 * distinguish — and an option nobody can tell apart is not a choice, it is a
 * coin the bot flips with its own AP.
 *
 * SIGNED, like `posePlay`, because facing is a TRADE and not a bonus: the turn
 * that puts one rival in your cone can put your back to another.
 *
 * ⚠️ AND CAPPED BELOW WHAT HITTING PAYS — §6.6.10's rule, now derived a fourth
 * time. This scores BEING AIMED, never landing the blow. `pressure` (2.5) has to
 * stay the bigger number or the bot lines up shots it never takes, which is
 * precisely the failure this file has already had three times.
 */
export function facingTrade(self, rivals) {
  const here = HEX_BY_NUM[self?.num];
  if (!here || !rivals?.length) return 0;
  const myFacing = self.facing ?? 0;
  let score = 0;
  for (const r of rivals) {
    const rh = HEX_BY_NUM[r.num];
    if (!rh) continue;
    const d = axialDist(here.q, here.r, rh.q, rh.r);
    if (d < 1 || d > REAR_INTEREST_DIST) continue;
    // A rival three hexes off is a hypothesis; one at arm's length is a blow
    // already on its way. Same ramp `botHexScore` uses, so the two agree.
    const prox = (REAR_INTEREST_DIST + 1 - d) / REAR_INTEREST_DIST;
    // OFFENCE — behind them AND pointing at them. ⚠️ BOTH HALVES REQUIRED:
    // standing behind somebody while facing away is worth nothing, because you
    // cannot swing or beam through the back of your own head. Dropping the
    // second half rewards blowing straight PAST a rival, which lands you behind
    // them, facing the wrong way, with your own back offered up.
    const behindThem = isRearHit(r.facing ?? 0, angleTo(rh, here), angleDiff);
    const facingThem = angleDiff(angleTo(here, rh), myFacing) <= CONE_HALF_ARC;
    if (behindThem && facingThem) score += REAR_OFFENCE * prox;
    // DEFENCE — is MY back turned to them?
    if (isRearHit(myFacing, angleTo(here, rh), angleDiff)) score -= REAR_DEFENCE * prox;
  }
  return clampSig(score);
}

export function beamOpportunity(state, self, ns, rivals) {
  const posing = posingMap(state);
  const here = HEX_BY_NUM[self?.num];
  if (!here || !rivals.length) return 0;
  if (!rigFor(self, ns, state).inRange) return 0;

  const liveBeam = sonicBeam(self);
  const axes = facingOptions(self).map(f => sonicBeam({ num: self.num, facing: f }));

  let best = 0;
  for (const r of rivals) {
    const rh = HEX_BY_NUM[r.num];
    if (!rh) continue;
    const onLiveBeam = liveBeam.has(r.num);
    const onAnyAxis  = onLiveBeam || axes.some(b => b.has(r.num));

    if (onLiveBeam || onAnyAxis) {
      // 🎤 THE DUEL GATE, mirroring `legalActions` exactly: they must be able to
      // answer. Beam-to-beam, their rig live, and not already posing.
      const rns = state?.noteStates?.[r.id] ?? {};
      const answers = !posing[r.id]
        && sonicBeam(r).has(self.num)
        && rigFor(r, rns, state).inRange;
      if (onLiveBeam && answers) { best = Math.max(best, BEAM_DUEL); continue; }
      best = Math.max(best, onLiveBeam ? BEAM_READY : BEAM_ALIGNED);
      continue;
    }

    // Off every axis: a ramp, so WALKING ONTO A LINE pays. Distance to the
    // nearest hex of any axis, normalised against the beam's own reach — one
    // hex off the line at range is a much better place to be standing than four.
    let off = Infinity;
    for (const b of axes) {
      for (const num of b) {
        const bh = HEX_BY_NUM[num];
        if (bh) off = Math.min(off, axialDist(rh.q, rh.r, bh.q, bh.r));
      }
    }
    if (!Number.isFinite(off)) continue;
    best = Math.max(best, BEAM_ALIGNED * clamp01(1 - off / SONIC_BEAM_REACH) * 0.6);
  }
  return clamp01(best);
}

// ── §5 weights ──────────────────────────────────────────────────────────────
//
// ⚠️ STARTING POINTS, NOT MEASUREMENTS. Every number below is a design
// intention transcribed from §5 and must be replaced by whatever the §6.6
// harness says actually wins. Do not cite these as balance data.
//
// ⚠️ Metalness is knowingly untunable until his innate lands (§4.3). His column
// is present so the searcher runs, not because it is right.

// ⚠️ FOUR NEW ROWS, 2026-08-17 — `centreStage`, `chargeSeek`, `stock`,
// `beamSetup`. Like `kit` and `pressure` before them these correct BLIND SPOTS
// rather than adjust sight, which §5 flags as the class of change most likely to
// move an observed win rate. They are starting points like every other number
// here; the difference is that the bench can finally settle them.
//
// ⚠️ ONE INEQUALITY IN THIS TABLE IS STRUCTURAL AND NOT A TASTE: for every
// Spirit, `charge` > `chargeSeek`. The seek term gates off the instant a charge
// is held, so if seeking ever paid more than holding, tapping the zone would
// score as a loss and the bot would circle it forever. Retune the pair together.

// ⚠️ RETUNED 2026-08-17, AND IT IS A CORRECTION RATHER THAN A PREFERENCE.
//
// 🎯 THE FINDING: **taking a rival's LIFE scored less than the two Drive notes
// it cost.** Measured, on the shipped column — a Ronin Swing that lands is
// `drive` −0.73 against `pressure` +0.16 and `fame` +0.08, and even the killing
// blow (`pressure` +0.60) came out behind the ammunition. So the searcher was
// offered an attack at **773 decision points in one 250-turn duel and took 2**.
// Neither the beam nor the search depth was the cause; both were exonerated by
// probe before the weights were touched.
//
// ⚠️ IT IS THE SAME STRUCTURAL SHAPE AS §6.6.1's `kit`, ONE POOL FURTHER ON.
// `dbHorizon` scored Db in one state only — banked — so spending was a pure loss
// and the bot refused every purchase in the game. `drive`/`sustain` scored the
// stacks in one state only, so ATTACKING was a pure loss and the bot refused
// every fight. The difference is that Db got a second term (`kit`) and the
// stacks already have theirs: what a stack converts into is damage, and damage
// is `pressure`. The stacks were simply priced above what they buy.
//
// 📌 AND IT WAS INVISIBLE UNTIL THE DAY BEFORE. Attacks were FREE in the headless
// path until §6.6.2 — the Swing's 2 Drive notes were never applied — so the ratio
// between "what you hold" and "what you spend it on" could not be wrong, because
// nothing was ever spent. Fixing the cost bug is what made the mis-weighting
// measurable, which is the pattern worth keeping: a bug fix is a measuring
// instrument switching on.
//
// Four rows move, and the CHARACTER in each column is preserved as a ratio —
// Metalness still values damage most and Intergalactic 0 least, the Ronin still
// holds the softest body and the highest survival:
//   · `drive` / `sustain` ≈ halved. Notes refill at 6 a turn; a stack is
//     READINESS, and readiness never spent is worth nothing.
//   · `pressure` ≈ doubled. It is the win condition that is not Fame.
//   · `fame` ≈ doubled. It is the win condition that IS.
//   · `beamSetup` ≈ doubled to 2-ish. ⚠️ SWEPT, AND IT IS NOT MONOTONE: at 2.5
//     matches decide 9/10 in ~50 turns with duels happening; at 4.0 the Spirits
//     stand off admiring their alignment and the stall rate goes back to 50%.
//     A term that pays for SETTING UP a shot will, if overpaid, buy the setup
//     instead of the shot.
//
// ⚠️ STILL STARTING POINTS. These were swept over 10-match samples on one pair
// of Spirits — enough to find a factor-of-two error, nowhere near enough to
// settle a 0.2. §5's standing warning applies with full force.

// ⚠️ AND `centreStage` WAS CUT ROUGHLY IN HALF AGAIN AFTER A SECOND MEASUREMENT,
// which found a tension the term created and nobody predicted:
//
//   🎤 THE MIDDLE WAS OUTSIDE EVERYBODY'S RIG. The radius was a flat 4 at tier
//   zero and the Limelight sits ~6 from a home corner, so a Spirit who walked to
//   centre stage was stranded (§3.1's "worst square on the board"): a bare d4
//   defence, NO Sonic, and no riff-off at all. Overpaying the centre therefore
//   switched OFF the two Fame engines the whole session was built to switch on.
//   Measured on the bench's own fixture, Ronin vs Metalness over 14 matches:
//   at 1.3-1.7 the pair ran 326 turns, decided 3, and fought 1 duel; at ~0.7-0.9
//   they ran ~220, decided 7, and fought 10.
//
// 🫁 AND THAT TENSION IS NOW RETIRED BY THE BREATHING RADIUS (§5.H⁶, shipped
// 2026-08-20). The standing item here — "make `centreStage` conditional on
// having the range to shoot from there" — was written when reach was a rung on
// the skill tree, i.e. a purchase the evaluator had to check for. It is not a
// purchase any more: radius is `RIG_RADIUS_FLOOR + stack length`, so a Spirit
// with a four-note Drive stack reaches 7 and CAN work the middle, and the same
// Spirit emptied out cannot. The read the term wanted is therefore already
// inside `terms.inRig`, live, every turn.
//
// ⚠️ WHICH MEANS THIS WEIGHT IS DUE A RE-SWEEP, NOT A REWRITE. The measurement
// above was taken against a board where the centre was unreachable for most of
// a match; it is now conditionally reachable, and nobody has re-run it. Treat
// 0.7-0.9 as inherited, not confirmed.

// ✨ ONE NEW ROW, 2026-08-17 (§6.6.8) — `posePlay`, on a mechanic that has never
// been exercised headlessly before today, so there is no prior bench reading for
// it to agree with.
//
// ⚠️ IT IS SMALL, AND THE SMALLNESS IS THE MEASUREMENT RATHER THAN CAUTION.
// Swept at 0 / 0.2 / 0.4 / 0.8 / 1.2 over 44 matches at fixed seeds, two pairings:
//
//     weight   poses   rounds BANKED   turns   decided   FP/turn
//     0         47          44          139     32/44     0.096
//     0.4       48          43          139     32/44     0.103
//     1.2       39          21          154     30/44     0.089
//
// 🎯 THE COLUMN THAT MATTERS IS "ROUNDS BANKED", NOT "POSES". A pose struck is
// not a pose paid — `limelightHeld` needs BOTH ends of a turn on hex 56 — and at
// 1.2 the bot posed nearly as often and collected HALF as much, because the
// weight walked it into the middle in company, where it was knocked straight
// off again. Paying a term more bought less of the thing the term is for.
//
// 📌 0 and 0.4 are indistinguishable on every gate, and 0.4 is shipped anyway,
// deliberately: at 0 the bot still poses — by TIE-BREAK, because `pose` costs 0
// AP and scores identically to not posing — which is the same behaviour arrived
// at by accident, and it would evaporate the day somebody reorders
// `legalActions`. A weight is a decision; a tie-break is a coincidence with good
// manners. ⚠️ The 18-match version of this sweep said 0 beat 0.4 clearly on
// three separate rows. It was noise, exactly as §5.E′ warns; 44 matches erased
// it. Do not settle a 0.2 on this table either.

export const DEFAULT_WEIGHTS = {
  survival: 1.0, fame: 2.0, fanMult: 1.0, perfCliff: 1.0,
  drive: 0.6, sustain: 0.5, apBanked: 1.0, inRig: 1.0,
  charge: 1.2, refillDenied: 1.0, edgeSafety: 1.0,
  dbHorizon: 1.0, rivalPose: 1.0, targetUpside: 1.0, kit: 1.6, pressure: 2.5,
  centreStage: 0.8, chargeSeek: 0.6, stock: 1.0, beamSetup: 0.7, marqueeSeek: 0.7, loud: 3.0,
  posePlay: 0.4, facing: 1.0,
};

export const EVAL_WEIGHTS = {
  // 🗡️ The fragile virtuoso. Vibe and the fan multiplier his innate compounds;
  // the Performance cliff is the single highest-leverage number in his kit.
  // 🎤 Centre is worth MORE to him than to anybody: the ring pays the casuals
  // his ≥5 innate then doubles, so the middle is where his whole economy lives.
  cosmic_ronin: {
    survival: 1.4, fame: 2.2, fanMult: 1.3, perfCliff: 2.0,
    drive: 0.6, sustain: 0.4, apBanked: 0.9, inRig: 1.0,
    charge: 0.9, refillDenied: 0.3, edgeSafety: 1.3,
    dbHorizon: 1.0, rivalPose: 1.0, targetUpside: 1.0, kit: 1.6, pressure: 2.5,
    // 🎵 `stock` runs high for him alone — an 11-slot reservoir and a Lost Chord
    // innate that finds a second note make notes the currency he is richest in,
    // and a long track is what the Performance cliff is bought with.
    // ✨ THE ROSTER'S HIGHEST POSE, and it is the same claim `centreStage: 0.95`
    // makes, one step further on. The ring pays the casuals his ≥5 innate then
    // doubles, so Fame earned IN the middle compounds for him in a way it does
    // for nobody else — and `fame: 2.2` is already his second-highest row.
    // ⚠️ Still a SMALL number in absolute terms; see the sweep above.
    centreStage: 0.95, chargeSeek: 0.5, stock: 1.3, beamSetup: 0.7, marqueeSeek: 0.7, loud: 3.0,
    posePlay: 0.5,
    // 🔪 THE ROSTER'S HIGHEST, and the only row on this table justified by an
    // ABILITY rather than a stat. 🗡️ Psycho Bushido dashes along the facing line —
    // his signature move is aimed by this term and by nothing else — and at
    // `survival: 1.0` with the roster's thinnest Vibe, a blow in the rear wedge
    // (`REAR_FRAY_BONUS` extra Sustain notes) costs him more than anyone.
    facing: 1.3,
  },
  // 📻 The cosmic controller. The Boom Box makes "hold a charge" a near-
  // permanent objective, and denial is his win path, not damage.
  intergalactic_0: {
    survival: 1.0, fame: 1.9, fanMult: 0.7, perfCliff: 0.4,
    drive: 0.35, sustain: 0.65, apBanked: 0.5, inRig: 1.6,
    charge: 2.2, refillDenied: 1.5, edgeSafety: 0.9,
    // 💢 1.3 → 2.0. ⚠️ RAISED AGAINST HIS OWN CHARACTER, ON PURPOSE, AND THE
    // DISCIPLINE HERE IS THE INTERESTING PART. §4.2 is right that denial is his
    // win path rather than damage — and a duel between him and the Ronin at 1.3
    // ran 120 turns and left 3 in 12 unfinishable, because the Ronin cannot
    // close a match on his own and Intergalactic 0 would not help. A character
    // trait that makes the game unable to END is a bug wearing a trait's
    // clothes. He is still the roster's LOWEST by a distance (Ronin 2.5,
    // Metalness 3.6), which is where the trait actually lives.
    // 📌 A 12-match probe preferred 2.5 (94 turns, 10/12). Twelve matches cannot
    // settle a 0.5, and 2.5 would erase the ordering that IS his character, so
    // this takes the smaller step and leaves the question for the bench.
    dbHorizon: 1.0, rivalPose: 1.0, targetUpside: 1.0, kit: 1.6, pressure: 2.0,
    // ⚡ HIS HIGHEST SEEK BY A DISTANCE, and it is the same claim `charge: 2.2`
    // makes, finally expressed as a plan instead of a state. Charged, he goes
    // from stranded 2d6 to portable 2d8+2d6 anywhere on the board and defends on
    // d6 instead of d4. ⚠️ Until the pickup was modelled in `transition.js` on
    // 2026-08-17 he could not hold a charge headlessly AT ALL, so his 2.2 has
    // never once fired in a bench match. 🔊 And `beamSetup` is his too: the
    // Blaster runs down the same line as the Sonic.
    // ✨ His lowest, and it is `inRig: 1.6` talking. The pose is four rounds of
    // standing in a spot that is OUTSIDE a tier-0 rig (§6.6.7's centre/rig
    // tension) with the defence die switched off — for the Spirit whose whole
    // game is a live rig and a held charge, that is the worst trade on the board.
    centreStage: 0.7, chargeSeek: 1.6, stock: 0.9, beamSetup: 0.9, marqueeSeek: 0.7, loud: 3.0,
    posePlay: 0.25,
    // 🔪 THE ROSTER'S LOWEST, and `inRig: 1.6` is talking again. He fights down a
    // BEAM at range, and `beamSetup: 0.9` already prices the alignment half of
    // facing for him; what is left here is the rear wedge, which matters least to
    // the Spirit whose plan is to never be adjacent to anybody.
    facing: 0.7,
  },
  // 🟢 The bruiser. Attrition that snowballs — he wants to be standing next to
  // something already bleeding.
  Metalness_Monster: {
    survival: 0.7, fame: 2.0, fanMult: 0.6, perfCliff: 0.3,
    drive: 0.7, sustain: 0.55, apBanked: 0.5, inRig: 0.8,
    charge: 0.8, refillDenied: 0.4, edgeSafety: 0.6,
    dbHorizon: 1.0, rivalPose: 1.0, targetUpside: 1.0, kit: 1.6, pressure: 3.6,
    // 🔊 His lowest beam weight, and the reason is his kit rather than his
    // temperament: the Tentacle and the Slam are melee, the trail is his
    // approach, and a Spirit who wants to be in contact has less use for a
    // three-hex line than the two who want the range.
    // ✨ Middling, and for a reason that cuts both ways: `survival: 0.7` is the
    // roster's lowest, so giving up a defence die costs him least — but a bruiser
    // who wants to be in CONTACT is standing where the term goes negative. He
    // should pose when the board has cleared around him and not otherwise.
    centreStage: 0.75, chargeSeek: 0.5, stock: 1.0, beamSetup: 0.5, marqueeSeek: 0.7, loud: 3.0,
    posePlay: 0.35,
    // 🔪 Middling, and it is the mirror of his `posePlay` note. A bruiser who
    // wants CONTACT spends his whole game inside `REAR_INTEREST_DIST` of somebody,
    // so this term is live for him almost every turn — but `survival: 0.7` is the
    // roster's lowest, so each individual back he turns costs him the least.
    // 🐙 ⚠️ The Tentacle cuts the other way and is NOT priced here: it strikes
    // from a trail hex, so `isHitFromBehind` reads the line from the ORIGIN, and
    // his reach can find a back that his own facing says he is nowhere near.
    facing: 0.9,
  },
};

/** Weight column for a Spirit, falling back to the flat default. */
export function weightsFor(spiritId, overrides = null) {
  const base = EVAL_WEIGHTS[spiritId] ?? DEFAULT_WEIGHTS;
  if (!overrides) return base;
  // 🔬 EXPERIMENT SUPPORT, and it is deliberately an ARGUMENT rather than a
  // module-level setter. This file's contract is "same inputs ⇒ same number";
  // a mutable global that silently re-tuned every future call would break that
  // for `evalCheck`, for the searcher and for anything replaying a match, and it
  // would break it invisibly. Threading it through `view` keeps a weight table
  // part of the question being asked.
  //
  // ⚠️ MERGED, NOT REPLACED — and the merge is what makes a single-term A/B
  // honest. `{ pressure: 0 }` must mean "this run is identical except that one
  // row", not "this run has exactly one weight and fifteen zeroes".
  //
  // 📌 A per-Spirit table (`{ cosmic_ronin: { pressure: 0 } }`) beats a flat one
  // when the question is about one character; a flat one applies to everybody.
  //
  // 🐛 FIXED 2026-08-17 — `overrides[spiritId] ?? overrides` SILENTLY POISONED
  // EVERY OTHER SEAT. Handed `{ intergalactic_0: { pressure: 2.5 } }`, the
  // Ronin's lookup missed and fell back to the WHOLE object, so his weight table
  // gained a row called `intergalactic_0` whose value was an object. The sum
  // then multiplies that object by an undefined term, every score in the match
  // becomes NaN, every comparison against NaN is false, and the searcher takes
  // the first action on the list forever. Measured: 0 attacks and 0 Fame across
  // 12 matches, all 400 turns long — an experiment that looked like a dramatic
  // finding about one weight and was reading a broken evaluator.
  //
  // ⚠️ AND IT IS EXACTLY THE FLAG'S DOCUMENTED USE that triggered it (§'s note
  // below recommends a per-Spirit table for a per-character question), which is
  // the worst combination: a tool whose recommended mode is the broken one.
  //
  // The shape is decided by the VALUES, not by the keys: a weight table maps to
  // numbers, a per-Spirit table maps to objects. Nothing else can be confused
  // for either.
  const perSpirit = Object.values(overrides).some(v => v && typeof v === 'object');
  const flat = perSpirit ? (overrides[spiritId] ?? {}) : overrides;
  return { ...base, ...flat };
}

// ── Small shared readers ────────────────────────────────────────────────────

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

// ✨ HOW FAR A RIVAL HAS TO BE BEFORE A POSE IS WORTH IT.
//
// Transcribed from the shipped client bot's `POSE_BOT_SAFE_DIST = 3` so the two
// judgements agree: a rival three hexes out can close and swing in one turn, and
// a posing Spirit rolls NO defence die at all. Below this the term goes NEGATIVE
// rather than merely small — posing next to somebody is not a weak play, it is
// a donation.
export const POSE_SAFE_DIST = 3;

// ✨ HOW FAR UP THE LADDER THE TERM LOOKS — and this one is not a taste, it is a
// correction for a property of the searcher.
//
// ⚠️ THE POSE IS A BACK-LOADED STAIRCASE AND A GREEDY SEARCH CANNOT CLIMB ONE.
// Round one pays 1 FP; round four pays 4. Held from a standing start the whole
// flight is 1+2+3+4 = 10 FP, which is more than two lives are worth — but the
// FIRST rung is priced at a quarter of the cap, against a board where `pressure`
// is 2.5 and a fight is available now. So a per-action search correctly declines
// the first step of a staircase whose value is entirely in the last, every time,
// and the mechanic reads as dead. Measured 2026-08-17 before this constant
// existed: 18 poses struck across 18 matches, SIX rounds ever banked.
//
// Scoring the rung the pose is HEADING FOR rather than the one it is standing on
// is the smallest honest fix — the risk half of the term (`safety` below)
// already discounts a pose that will be interrupted, which is exactly the thing
// a lookahead would otherwise over-claim. 2 is a starting point; the bench gets
// to move it.
export const POSE_LOOKAHEAD = 2;

// 💀 WHAT THE DROPPED GUARD COSTS, AND WHY IT IS A FLAT NUMBER.
//
// ⚠️ THE FIRST DRAFT SCALED THE RISK WITH THE PRIZE (`payoff × (2·safety − 1)`)
// and it was backwards in a way worth keeping written down: raising the pose's
// value made the bot pose LESS, because the same factor amplified the penalty
// for posing in company, and in a two-handed duel a rival is nearly always in
// company. Measured: lifting the payoff from 0.25 to 0.75 took poses from 18 to
// 13. A term where paying more buys less is not mistuned, it is mis-shaped.
//
// The prize grows with the ladder. The danger does not: a rival next to you gets
// one free clean hit whether this is your first pose round or your fourth.
export const POSE_RISK = 0.5;

/**
 * ✨ What MY pose is worth from where I am standing, in [-1, 1].
 *
 * Zero unless the flag is actually up, which is the whole point: this term has
 * to be able to tell the state AFTER `pose` from the state before it, or the
 * searcher has no gradient to follow and the action is invisible to it.
 *
 * ⚠️ AND IT KNOWS THE VERDICT NEEDS BOTH ENDS OF THE TURN. `limelightHeld` is
 * "started AND ended the turn on hex 56", so a pose struck on the turn you
 * ARRIVE cannot pay until the turn after — you eat a whole round with your guard
 * down for nothing. That case is halved rather than zeroed: the pose is still
 * live and still on its way to paying, it is simply a turn further off.
 */
export function selfPoseValue(state, self, rivals) {
  if (!self || !isPosing(state, self.id)) return 0;
  const here = HEX_BY_NUM[self.num];
  if (!here) return 0;

  // The rung this pose is HEADING FOR, not the one under its feet — see
  // POSE_LOOKAHEAD for why that is a fix rather than an inflation.
  const payoff = clamp01(
    posePayout(poseRounds(state, self.id) + POSE_LOOKAHEAD) / POSE_FP_MAX);

  // Nearest live rival, in hexes. Nobody on the board ⇒ nothing can punish it.
  let reach = Infinity;
  for (const r of rivals) {
    const rh = HEX_BY_NUM[r.num];
    if (rh) reach = Math.min(reach, axialDist(here.q, here.r, rh.q, rh.r));
  }

  // 0 in contact → 1 at the safe distance and beyond.
  const safety = Number.isFinite(reach)
    ? clamp01((reach - 1) / Math.max(1, POSE_SAFE_DIST - 1))
    : 1;
  const deferred = state?.turn?.startedOnLimelight?.[self.id] ? 1 : 0.5;

  // Prize × how much of it is collectable, minus a FLAT exposure cost — see
  // POSE_RISK. The two halves are deliberately on different scales.
  return clampSig(payoff * deferred * safety - POSE_RISK * (1 - safety));
}

// 🌟 FP a posing Spirit banks on their NEXT surviving round (§3.3).
//
// ⚠️ RE-EXPORTED, NOT RE-IMPLEMENTED. This was a third transcription of the
// ladder, alongside the monolith's `poseTierFor` and the payout the turn clock
// actually billed. They agreed, which is why it was easy to leave — and why it
// was dangerous: an evaluator scoring a pose at one rate while the game paid
// another is a bot that is confidently wrong rather than blind, and every suite
// would still be green. The ladder lives in `systems/limelight.js` now.
export { posePayout };

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
 * @param {object} [view]    `{ weightOverrides }` only — the bench's term
 *   isolator. No game state rides in here any more; see the header.
 * @returns {{ score:number, terms:Record<string,number>, weights:object }}
 *
 * `terms` is returned for a reason: a single number tells you the bot preferred
 * a line but never WHY, and a mis-signed term looks exactly like a good bot
 * until it loses 2000 matches. Log the breakdown, don't trust the total.
 */
export function evaluate(state, spiritId, view = {}) {
  const { weightOverrides = null } = view;
  const weights = weightsFor(spiritId, weightOverrides);
  const posing  = posingMap(state);

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
  // ⚠️ THROUGH `rigFor`, NOT `sonicRig` DIRECTLY. This line called the raw
  //    function for months and was the ONE place that would not follow the rig
  //    rules — it could not see a blown amp (§3.1's "worst square on the board"
  //    scored as if the rig were fine) and, from 2026-08-20, it could not see
  //    whose turn it is either, which is now half the radius rule. Both fixes
  //    are the same one-word change. 📌 Logged as drift in §5.H⁶ before it bit.
  terms.inRig = rigFor(self, ns, state).inRange ? 1 : 0;

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

  // 11. 🪦 CUT 2026-08-17 — `adjWounded`, "adjacency to a wounded rival".
  //
  //     It was `max` over adjacent rivals of `1 - vibe/maxVibe`. Term 16
  //     (`pressure`) computes that same quantity as its Vibe half, reach-weighted
  //     instead of hard-gated at distance 1 — so keeping both PRICED CHIP DAMAGE
  //     TWICE, and the duplicate was the copy that pointed the wrong way.
  //
  //     ⚠️ IT PAID THE BOT FOR NOT FINISHING ANYONE, which is why it had to go
  //     rather than shrink. It scored the OPPORTUNITY (standing next to someone
  //     bleeding), so taking the opportunity destroyed the payment: a rival on
  //     1/4 Vibe next to the Ronin was worth +0.600, and the blow that took their
  //     life dropped it to 0, because they respawn at home across the board.
  //     Measured on the killing blow — `pressure` correctly paid +0.150 for the
  //     life taken and the term still nets −0.571. A bot maximising this score
  //     keeps a victim alive and bleeding forever, and Metalness, who held the
  //     highest weight at 1.5, was the MOST reluctant to close.
  //
  //     📌 The bruiser's character is not lost, it moved to where it belongs:
  //     his `pressure` weight is the roster's highest (1.8). "Attrition that
  //     snowballs" is a statement about valuing damage, and it now reads as one
  //     — as an achievement that survives the respawn rather than a position
  //     that evaporates when you act on it.
  //
  //     ⚠️ `here` STAYS — terms 15 and 16 both need it.
  const here = HEX_BY_NUM[self.num];

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
    posing[r.id] ? Math.max(worst, posePayout(poseRounds(state, r.id)) / POSE_FP_MAX) : worst
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

  // 16. 💢 PRESSURE — HOW CLOSE THE RIVALS ARE TO BEING FINISHED. The mirror of
  //     `survival`, and until 2026-08-17 the table did not have one.
  //
  //     ⚠️ WITHOUT IT NOTHING IN THIS FILE SAYS THAT HITTING SOMEBODY IS GOOD.
  //     Twelve of the sixteen terms describe your OWN position; the four that
  //     look outward all required a condition that a healthy rival does not meet
  //     — `adjWounded` (now cut, see 11) needed them hurt ALREADY, `targetUpside`
  //     needs a Fame deficit, `refillDenied` needs Gravity Control, `rivalPose`
  //     needs a threat to fear. So a bot maximising this score saw every cost of an
  //     attack and none of the point of one, shuffled and re-faced until its AP
  //     ran out, and two healthy Spirits had no reason to ever fight. That is
  //     where the bench's 37% inconclusive rate came from (§6.6.0).
  //
  //     ⚠️ LIVES ARE NOT REACH-WEIGHTED AND CHIP VIBE IS, and mixing them is the
  //     trap. They are different KINDS of progress:
  //
  //       · A LIFE TAKEN IS BANKED. It survives the respawn, it cannot be walked
  //         away from, and it is permanent progress toward removing that Spirit.
  //         Decaying it by distance would mean finishing a rival SCORES WORSE
  //         than leaving them bleeding next to you — they respawn at home, far
  //         away, and the term would collapse at the exact moment it should pay.
  //       · CHIP VIBE IS PROVISIONAL. It heals, it resets on respawn, and it is
  //         only worth anything if you are close enough to convert it. A rival on
  //         2 Vibe across the board is a plan, not a position — the discipline
  //         the cut `adjWounded` stated, kept, with a floor instead of a cliff.
  //
  //     ⚠️ AND THE REACH GRADIENT IS BOUNDED — `chipReachWeight`, not
  //     `reachWeight`. Fixed 2026-08-18 (§6.6.11). The distinction above is
  //     right and the arithmetic under it was not: attacks knock the target
  //     BACK, so at full strength the curve demoted every point of damage
  //     already banked into a weaker reach band the instant you added one more.
  //     A rival taken from 2 Vibe to 1 scored the Ronin −0.05 weighted. The
  //     provisional/banked distinction survives; what does not is the idea that
  //     it may be worth more than the damage itself.
  //
  //     📌 A knocked-out rival is a flat 1: maximum pressure, permanently, and
  //     no reach term. Scoring them through the formula would push past 1 (no
  //     lives AND no Vibe) and, worse, they leave `rivals` entirely — so an
  //     average taken over the survivors would DROP on the winning blow. An
  //     evaluator that scores victory as a loss is not a tuning problem.
  //
  //     ⚠️ AVERAGED, NOT MAXED — and this is where it parts company with the
  //     `adjWounded` it replaces. Max would mean that once one
  //     rival is badly hurt, opening damage on a SECOND rival registers as
  //     exactly zero — the bot would fixate on one victim and read every blow
  //     struck elsewhere as wasted. The average is also the honest mirror of
  //     `survival`, which measures one Spirit's whole pool.
  const allLivesForRivals = allLives;
  const pressureRivals = spirits.filter(s => s.id !== spiritId);
  terms.pressure = pressureRivals.length
    ? pressureRivals.reduce((sum, r) => {
        if (r.knockedOut) return sum + 1;
        const rMax   = r.maxVibe ?? SPIRIT_DEFS[r.id]?.maxVibe ?? 5;
        const rLives = r.lives ?? allLivesForRivals;
        const livesTaken = clamp01(Math.max(0, allLivesForRivals - rLives) / allLivesForRivals);
        const vibeMissing = clamp01(1 - clamp01((r.vibe ?? rMax) / rMax)) / allLivesForRivals;
        const rh = here && HEX_BY_NUM[r.num];
        // ⚠️ `chipReachWeight`, NOT `reachWeight` — the bounded mix. Every attack
        // knocks the target back, so the raw curve let a landed blow demote more
        // old damage than the new damage was worth (§6.6.11). The gradient is
        // kept; its authority over the damage credit is not.
        const reach = rh
          ? chipReachWeight(axialDist(here.q, here.r, rh.q, rh.r))
          : chipReachWeight(Infinity);
        return sum + clamp01(livesTaken + vibeMissing * reach);
      }, 0) / pressureRivals.length
    : 0;

  // ══════════════════════════════════════════════════════════════════════
  // 🎯 THE BOARD (17–20) — §6.6.6's family. Read the block above the weight
  // table for why these four and not the obvious fifth.
  // ══════════════════════════════════════════════════════════════════════

  // 17. 🎤 CENTRE STAGE — the middle is where the game is, and it is the only
  //     objective on the board that is never consumed, so it is the one that can
  //     carry a travel gradient without inverting. A SHELF (which ring you
  //     reached, shaped on `FAN_GAIN_BY_RING`) plus a RAMP (how far you still
  //     are), because the shelf alone is flat across the whole Backstage.
  //
  //     ⚠️ NOT MULTIPLIED BY THE HORIZON, unlike `fanMult` and `dbHorizon`.
  //     §3.6's decay argument is about the fan MULTIPLIER being an investment
  //     that needs payouts left to multiply. Board control is not an investment:
  //     the Limelight is the Pose hex and the contested square right up to the
  //     last turn of the match, and a leader who abandons the middle at 14/16 is
  //     handing it to whoever is chasing them.
  {
    const ringPay = CENTRE_RING_PAY[hexRingFromCenter(self.num)] ?? 0;
    const ramp = HUB && here
      ? clamp01(1 - axialDist(here.q, here.r, HUB.q, HUB.r) / MAX_CENTRE_DIST)
      : 0;
    terms.centreStage = clamp01(CENTRE_SHELF * ringPay + CENTRE_RAMP * ramp);
  }

  // 18. ⚡ CHARGE SEEK — going to GET a charge, as opposed to term 9 which scores
  //     HOLDING one. §6.6.6's tell was that every near-miss in this table scored
  //     the aftermath of an objective and never the objective.
  //
  //     ⚠️ IT GATES OFF THE MOMENT YOU HOLD A CHARGE, and that gate is what stops
  //     this becoming an `adjWounded`. Without it the term would fall when the
  //     zone is tapped — you are now standing on a spent zone and the next live
  //     one is further away — and the bot would learn to loiter beside a Charge
  //     Zone forever rather than step on it. With it, the value HANDS OFF: seek
  //     goes to zero and `charge` goes to one, and every weight column below is
  //     written so `charge` is worth strictly more than `chargeSeek`. If those
  //     two are ever retuned, retune them together and keep that inequality.
  //
  //     📌 §3.5's real verdict — never pick up a charge and open a fight in the
  //     same turn, because the charge dies on any battle and the walk cost AP —
  //     is a WITHIN-TURN ordering rule, not a property of a position, so it is
  //     not expressible here. It belongs to the searcher's line, and it is worth
  //     writing down that its absence is known rather than overlooked.
  {
    const holding = terms.charge > 0;
    const zones = (state?.board?.chargeZones ?? []).filter(z => (z.cooldown ?? 0) <= 0);
    if (holding || !zones.length || !here) {
      terms.chargeSeek = 0;
    } else {
      const d = zones.reduce((m, z) => {
        const zh = HEX_BY_NUM[z.num];
        return zh ? Math.min(m, axialDist(here.q, here.r, zh.q, zh.r)) : m;
      }, Infinity);
      terms.chargeSeek = Number.isFinite(d) ? clamp01(1 - d / CHARGE_SEEK_REACH) : 0;
    }
  }

  // 18b. 🎪 MARQUEE SEEK — the walk to the quiz, which since the rig came off
  //      the tree is the walk to a LOUDER AMP. Same shape as `chargeSeek` above
  //      and for the same reason: a term that scored only "am I standing on it"
  //      would be worth nothing, because stepping on a marquee CONSUMES it in
  //      the same action (`collectPickups`). The value has to live in the
  //      approach or it does not exist at all.
  //
  //      ⚠️ SCALED BY HEADROOM, WHICH IS WHAT KEEPS IT HONEST. A Spirit at
  //      3 pool / 3 power cannot train any further, so for them the RIG lane is
  //      dead and the card is worth only its fans. A flat term would have the
  //      loudest Spirit on the board sprinting for a prize it cannot collect.
  //
  //      📌 AND IT DOES NOT MODEL THE ATROPHY CLOCK. "I am one turn from
  //      shedding a tier" should pull harder than "I trained this turn", and
  //      that is probably the better term — but it is a second dimension nobody
  //      has benched, and §5's warning about settling numbers on small samples
  //      applies. Written down rather than guessed at.
  // 18c. LOUD — how much rig this Spirit has actually TRAINED.
  //
  //      WARNING: this is SEQUENCING.md 5.E6 item 6, and it stopped being a
  //      nice-to-have the day the rig came off the tree. The evaluator has never
  //      had an opinion about volume: `inRig` asks only "am I inside my own
  //      radius", a yes/no, and nothing anywhere read the SIZE of the pool.
  //      While pool and power were bought with Db that was merely a blind spot.
  //      Once they are won at the marquee it is an INVERSION — measured, on the
  //      first bench run after the quiz went headless: bots sat at distance 1
  //      from a live marquee on 54 decision points of a 43-turn match and
  //      stepped on it ONCE. Taking a marquee CONSUMES it, so `marqueeSeek`
  //      falls when you collect the prize; with no term rising to meet that,
  //      the best-scoring move was always to hover beside it and never touch it.
  //
  //      SO THE PAIR IS THE POINT, and it is the pairing this file already uses
  //      for charges: `chargeSeek` pays the walk, `charge` pays the holding, and
  //      the note there says in as many words that `charge` must be worth
  //      strictly more than `chargeSeek` or the bot walks to a zone it never
  //      taps. Same inequality, same reason.
  //
  //      Scale is EARNED tiers over the maximum earnable — the floor every
  //      Spirit starts with is not an achievement and must not score as one.
  //
  //      THE WEIGHTS WERE PICKED FROM A SWEEP, and the sweep found a pathology
  //      in the OTHER row rather than in this one. 24 matches, two pairings,
  //      fixed seeds, `.scratch/marqsweep.mjs`:
  //
  //        seek  loud | turns/match  marquees/match  seats above floor  decided
  //        0.7   1.6  |     18.0          0.33            3/48          24/24
  //        0.7   3.0  |     17.4          0.50            6/48          24/24
  //        1.5   3.0  |     65.3          0.33            1/48          21/24
  //        1.5   5.0  |     50.4          0.54            1/48          22/24
  //        3.0   6.0  |     77.7          0.96            4/48          21/24
  //
  //      WARNING: PAYING MORE FOR THE WALK MAKES IT WORSE, and it is the exact
  //      shape of the facing spin in 5.C6 — a term whose value sits on the
  //      APPROACH funds orbiting rather than arriving. At seek 1.5 the match
  //      length triples, matches stop being decided, and FEWER Spirits end up
  //      with a rig than at 0.7. Raise `loud` when you want more training, never
  //      `marqueeSeek`.
  //
  //      And 24 matches is nowhere near 6.6's bar of ~2000. Even the best arm
  //      leaves 42 of 48 seats finishing at the floor, so no bench reading taken
  //      today is a reading of a game where anybody's rig grew.
  {
    const { pool, power } = rigTiers(ns);
    const earned = (pool - RIG_POOL_FLOOR) + power;
    const most   = (RIG_TIER_MAX - RIG_POOL_FLOOR) + RIG_TIER_MAX;
    terms.loud = clamp01(earned / most);
  }

  {
    const evs = (state?.board?.eventHexes ?? []).map(n => HEX_BY_NUM[n]).filter(Boolean);
    if (!evs.length || !here) {
      terms.marqueeSeek = 0;
    } else {
      const can = rigSpendable(ns);
      const headroom = (can.pool || can.power) ? 1 : MARQUEE_MAXED_VALUE;
      const d = evs.reduce((m, eh) => Math.min(m, axialDist(here.q, here.r, eh.q, eh.r)), Infinity);
      terms.marqueeSeek = Number.isFinite(d)
        ? clamp01(1 - d / MARQUEE_SEEK_REACH) * headroom
        : 0;
    }
  }

  // 19. 🎵 STOCK — unspent notes in the reservoir. §1 calls notes "the spine of
  //     the game" and this table did not score them at all.
  //
  //     ⚠️ IT IS THE BANKED HALF OF EVERY LOST CHORD, and that is why it is here
  //     rather than as a fifth board term. A pickup is consumed on arrival, so
  //     anything scoring the DISTANCE to one necessarily falls when it is taken;
  //     the value has to land somewhere that survives being acted on. It lands
  //     here. `botHexScore` routes the walk (§6.3 — the scorer picks which hex),
  //     and this records what the walk was worth.
  //
  //     ⚠️ UNUSED SLOTS, NOT ARRAY LENGTH. `noteStock` keeps spent slots in place
  //     and marks them in `usedStockIdx`; counting the array would score a Spirit
  //     who has spent everything exactly as rich as one who has spent nothing.
  {
    const stockArr = ns.noteStock ?? [];
    const unused = stockArr.filter((_, i) => !usedHas(ns.usedStockIdx, i)).length;
    terms.stock = clamp01(unused / Math.max(1, stockArr.length || 10));
  }

  // 20. 🔊 BEAM SETUP — how close this position is to a Sonic, and to the
  //     riff-off that rides on one. See `beamOpportunity` for the four bands and
  //     for why this is a position question rather than an action question.
  terms.beamSetup = beamOpportunity(state, self, ns, rivals);

  // 20b. 🔪 WHICH WAY HE IS LOOKING. See `facingTrade` for why this arrived so
  //      late and what it cost to be missing.
  terms.facing = facingTrade(self, rivals);

  // 21. ✨ THE POSE, FROM THE INSIDE — the mirror `rivalPose` never had, and
  //     without it the whole §6.6.8 pass would have paid for nothing.
  //
  //     ⚠️ THIS IS THE TERM THAT MAKES POSING REACHABLE AT ALL, and the reason
  //     is a property of the searcher rather than of the pose. `pose` costs 0 AP
  //     and moves ONE flag; the FP it earns does not land until `endTurn`
  //     resolves the Limelight verdict. So to a per-action search, posing scores
  //     EXACTLY the same as not posing — a coin flip — while quietly giving up
  //     the defence die. §5.A one more time: the game rewards something, no term
  //     names the act of going and getting it, and nothing errors.
  //
  //     SIGNED, because the pose is a bet rather than a bonus. A Spirit alone in
  //     the middle is collecting; a Spirit posing with a rival at arm's length
  //     has handed over a free clean hit. The ramp between the two is the
  //     continuous version of the shipped client bot's own rule
  //     (`POSE_BOT_SAFE_DIST = 3`, "a rival 3 hexes out can close and swing in
  //     one turn"), and it is deliberately generous for the same reason that one
  //     is: the bots are here to demo the tempo of the Limelight, not to squeeze
  //     the last point out of it.
  terms.posePlay = selfPoseValue(state, self, rivals);

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
