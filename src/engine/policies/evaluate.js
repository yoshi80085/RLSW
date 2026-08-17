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
  FAN_MULT_CAP, FAN_DIEHARD_START, SONIC_BEAM_REACH, LIMELIGHT_HEX,
} from "../../data/gameConstants.js";
import { SPIRIT_DEFS } from "../../data/spirits.js";
import { CORNERS } from "../../data/corners.js";
import { HEX_BY_NUM, ALL_HEXES, EDGE_HEX_NUMS } from "../../board/hexMap.js";
import { axialDist } from "../../board/hexGeometry.js";
import { crowdMultiplier, hexRingFromCenter } from "../../board/boardHelpers.js";
import { sonicRig } from "../systems/sonicRig.js";
import { usedHas } from "../systems/economy.js";
import { rigFor } from "../systems/attackParams.js";
import { SKILL_BY_ID } from "../../data/skillTree.js";
// 🔊 The beam geometry, BORROWED FROM THE GENERATOR RATHER THAN RE-DERIVED. A
// second copy of "which hexes does a Sonic reach" is a second thing to retune,
// and the whole point of the `beamSetup` term is that it agrees with the action
// `legalActions` will or will not offer.
import { sonicBeam, facingOptions } from "./legalActions.js";

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
export function beamOpportunity(state, self, ns, rivals, posing = {}) {
  const here = HEX_BY_NUM[self?.num];
  if (!here || !rivals.length) return 0;
  if (!rigFor(self, ns).inRange) return 0;

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
        && rigFor(r, rns).inRange;
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
//   🎤 THE MIDDLE IS OUTSIDE EVERYBODY'S RIG. `RIG_RADIUS_BY_TIER` is 4 at tier
//   zero and the Limelight sits ~6 from a home corner, so a Spirit who walks to
//   centre stage is stranded (§3.1's "worst square on the board"): a bare d4
//   defence, NO Sonic, and no riff-off at all. Overpaying the centre therefore
//   switched OFF the two Fame engines the whole session was built to switch on.
//   Measured on the bench's own fixture, Ronin vs Metalness over 14 matches:
//   at 1.3-1.7 the pair ran 326 turns, decided 3, and fought 1 duel; at ~0.7-0.9
//   they ran ~220, decided 7, and fought 10.
//
// 📌 THE GAME ALREADY HAS THE ANSWER AND IT IS A PURCHASE. Range I takes the
// radius to 5 and Range II to 7 — the whole board — so "work the middle" is
// something a Spirit EARNS rather than something the evaluator should assume.
// The right long-term fix is probably to make `centreStage` conditional on
// having the range to shoot from there, which is a term that reads two things at
// once and wants the bench, not a guess.

export const DEFAULT_WEIGHTS = {
  survival: 1.0, fame: 2.0, fanMult: 1.0, perfCliff: 1.0,
  drive: 0.6, sustain: 0.5, apBanked: 1.0, inRig: 1.0,
  charge: 1.2, refillDenied: 1.0, edgeSafety: 1.0,
  dbHorizon: 1.0, rivalPose: 1.0, targetUpside: 1.0, kit: 1.6, pressure: 2.5,
  centreStage: 0.8, chargeSeek: 0.6, stock: 1.0, beamSetup: 2.2,
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
    centreStage: 0.95, chargeSeek: 0.5, stock: 1.3, beamSetup: 2.2,
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
    centreStage: 0.7, chargeSeek: 1.6, stock: 0.9, beamSetup: 2.8,
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
    centreStage: 0.75, chargeSeek: 0.5, stock: 1.0, beamSetup: 1.6,
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
  const { posing = {}, limelightScores = {}, weightOverrides = null } = view;
  const weights = weightsFor(spiritId, weightOverrides);

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
        const reach = rh
          ? reachWeight(axialDist(here.q, here.r, rh.q, rh.r))
          : PRESSURE_REACH_FLOOR;
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
  terms.beamSetup = beamOpportunity(state, self, ns, rivals, posing);

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
