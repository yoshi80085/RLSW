// ─── ENGINE SYSTEM: THE LIMELIGHT ────────────────────────────────────────────
// §3.3's Strike a Pose — the pose flag and the cumulative round count, lifted
// out of React (`useState` for `posing` and `limelightScores`) into engine state.
//
// WHY THIS MOVED, AND WHY IT IS NOT TIDYING. BOT_STRATEGY_HANDOFF §6.6.7 closed
// with three Fame engines still switched off headlessly, and this was the
// largest of them: `HARNESS_GAPS.pose` said the pose "flips a flag and pays
// nothing", so a bench Spirit could stand in the middle for forty turns and earn
// exactly zero. That is §5.A's pattern for the seventh time — the game rewards
// something, the evaluator has no way to reach the reward, nothing errors, every
// suite stays green. A pose that survives four rounds is 4 FP, which is the
// FULL per-turn Fame cap earned standing still, so the term the searcher was
// blind to was not a rounding error; it was the biggest single-turn payout on
// the board that does not require rolling a die.
//
// ⚠️ THE LADDER LIVES HERE AND NOWHERE ELSE. `poseTierFor` in the monolith,
// `posePayout` in `evaluate.js` and the payout the turn clock actually billed
// were three transcriptions of one rule. They agreed, which is exactly why the
// duplication was safe to keep and dangerous to leave: the day someone retunes
// POSE_FP_STEP, two of the three follow and the third quietly prices a bluff.
// Everything now asks this function.
//
// Rules for this file: plain JSON, no rng, no React. The ORDERED consequence of
// a surviving pose (the FP grant and the Sustain toll) is not here — it is a
// consequence sequence and lives with the others in `battleFlow.js`.

import { POSE_FP_STEP, POSE_FP_MAX } from "../../data/gameConstants.js";

/** The empty slice, so `state.js` and any migration agree on the shape. */
export function makeLimelightState() {
  return { posing: {}, scores: {} };
}

/**
 * FP the NEXT surviving pose round pays this Spirit, before the crowd
 * multiplier (§3.3).
 *
 * `rounds` is how many pose rounds they have ALREADY survived, and it never
 * resets: a Spirit shoved out of the middle keeps their standing and resumes at
 * the same rate when they fight their way back. You lose the tempo, not the
 * reputation.
 */
export function posePayout(rounds = 0) {
  return Math.min((rounds + 1) * POSE_FP_STEP, POSE_FP_MAX);
}

/** Is this Spirit mid-pose right now? */
export function isPosing(state, spiritId) {
  return !!state?.limelight?.posing?.[spiritId];
}

/** Pose rounds this Spirit has banked (cumulative, never reset). */
export function poseRounds(state, spiritId) {
  return state?.limelight?.scores?.[spiritId] ?? 0;
}

/** The whole posing map, for the readers that want to scan the field at once. */
export function posingMap(state) {
  return state?.limelight?.posing ?? {};
}

/**
 * POSE_SET — raise or drop the pose.
 *
 * ⚠️ DROPPING IS AS LOAD-BEARING AS RAISING, and it has three callers rather
 * than one: the player's toggle, walking out of the Limelight (`movement.js`)
 * and hitting the floor (`combat.js`). A pose left standing is not a cosmetic
 * leftover — a posing Spirit rolls NO defence die at all, so a stale flag hands
 * every rival a free clean hit for the rest of the match.
 */
export function applyPoseSet(state, { spiritId, on = true }) {
  const posing = { ...(state.limelight?.posing ?? {}) };
  if (on) posing[spiritId] = true; else delete posing[spiritId];
  return {
    ...state,
    limelight: { ...(state.limelight ?? makeLimelightState()), posing },
  };
}

/**
 * POSE_ROUND_BANKED — one more round survived in the middle.
 *
 * Separate from the FP grant on purpose. The count is what makes the NEXT round
 * worth more, so it has to be state the searcher can read and reason about a
 * turn ahead; the Fame it pays is a battleFlow consequence like any other.
 */
export function applyPoseRoundBanked(state, { spiritId }) {
  const scores = { ...(state.limelight?.scores ?? {}) };
  scores[spiritId] = (scores[spiritId] ?? 0) + 1;
  return {
    ...state,
    limelight: { ...(state.limelight ?? makeLimelightState()), scores },
  };
}
