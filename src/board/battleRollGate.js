// ⭐ TWO PRESSES, ONE CLOCK.
//
// Both battle types now stage their dice: one Spirit throws, the table reads
// what landed, then the other Spirit throws. The second throw happens when a
// PERSON clicks, which is unknowable at the moment the dice are built — so the
// sequence is built with a NOMINAL gap (`gate`) and the clock HOLDS there until
// the second press lands, then runs on from the gate.
//
// ⚠️ IT HOLDS, IT DOES NOT SKIP, AND THAT IS THE WHOLE DESIGN. The obvious
// alternative — rebuild the dice with the real gap once the press arrives —
// disposes and restarts the FIRST Spirit's dice, which is exactly what the
// table is looking at while it waits. The clock stalling is invisible; the
// first Spirit's roll re-throwing itself is not.
//
// ⚠️ AND IT NEVER RUNS BACKWARDS. An early press (a bot, a replay, a click that
// beat the prompt) resumes from the gate rather than jumping the clock to it,
// so the held pool can never be seen to stutter or snap.
//
// 📌 PRESENTATION ONLY. Neither press draws from the seeded stream or reaches
// the engine — both verdicts are frozen before this clock exists. A press
// decides WHEN the table sees a roll, never what it is.

import { ARENA_DICE_TIMING } from './arenaDiceSequence.js';

/**
 * ⭐ THE RIVAL'S SHIELD GETS ITS OWN SHOT (Alex, 2026-09-24: "the Rival's
 * shield gets a very very quick glance at the fans/amps before cutting - give
 * that at least a second or 2 to hold, see how the shield comes up"). The
 * Sonic gate used to be 4.75 — 0.9 s after the Sustain pool landed, which is
 * all the shield's charge shot had. It is now DERIVED: the Sustain pool's
 * landing plus this hold, so a retimed tumble cannot quietly eat the shot.
 */
export const SONIC_SHIELD_HOLD = 2.4;

/**
 * 🎯 THE OPENING (Alex, 2026-09-24): "the beginning *should* zoom in - but it
 * should zoom into the 2 Spirits - make lines come in from the outside". Before
 * the first player is asked to throw, the battle director's two-shot pushes in
 * on the pair with speed lines (battleDirector `twoShot('intro')`). The client
 * waits this long before the first ROLL prompt — a bot would otherwise throw on
 * the very first frame and the opening would never be on screen.
 * 📌 Presentation only: nothing is drawn from the seeded stream, and the verdict
 * is frozen before this clock starts.
 */
export const BATTLE_INTRO = 1.6;
const SUSTAIN_LANDED = ARENA_DICE_TIMING.roll + ARENA_DICE_TIMING.landedHold;
export const ROLL_GATE = Object.freeze({
  sonic: Math.round((SUSTAIN_LANDED + SONIC_SHIELD_HOLD) * 1000) / 1000,
  swing: 5.9,
});

/**
 * Seconds into the staged sequence, given wall-clock marks for the two presses.
 *
 * @param now        performance.now() for this frame
 * @param firstAt    when the first Spirit threw (ms). null → the clock is 0.
 * @param secondAt   when the second Spirit threw (ms). null → hold at the gate.
 * @param gate       the nominal second throw, in sequence seconds.
 */
export function gatedSequenceTime({ now, firstAt, secondAt, gate = ROLL_GATE.sonic }) {
  if (firstAt == null) return 0;
  const before = (now - firstAt) / 1000;
  if (secondAt == null) return Math.min(before, gate);
  const resume = Math.max(secondAt, firstAt + gate * 1000);
  return gate + Math.max(0, (now - resume) / 1000);
}

/** Is the sequence sitting at the gate, waiting for the second Spirit? */
export function waitingAtGate({ now, firstAt, secondAt, gate = ROLL_GATE.sonic }) {
  return firstAt != null && secondAt == null && (now - firstAt) / 1000 >= gate;
}
