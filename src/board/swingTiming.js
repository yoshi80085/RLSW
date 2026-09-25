import { arenaDiceSchedule, diceBeat, ARENA_DICE_TIMING } from './arenaDiceSequence.js';
import { ROLL_GATE } from './battleRollGate.js';

// ⭐ THE SWING IS NOW TWO THROWS, NOT ONE. The ATTACKER rolls, raises their
// instrument (Figure 1) and their own Drive cabinet fires to fuel it; then the
// RIVAL does the same; then the totals are read and the two strike (Figure 2).
//
// 📌 Seconds below are on the Swing's own clock, which starts at the ATTACKER's
// ROLL. The Rival's throw is nominally at `gate`; the clock holds there until
// their ROLL arrives (`battleRollGate.js`), so every number after it is
// relative to the resumed clock, not to wall time.
export const SWING_GATE = ROLL_GATE.swing;
export const SWING_RAISE = .55;   // a pool lands → its Spirit raises
export const SWING_AMP = .5;      // the raise → that Spirit's amp fires into it
export const SWING_CLASH = 1.6;   // both totals read → the strike
export const SWING_RESULT = 2.75; // the strike → the verdict
// ⚠️ 1.0, was .6 (2026-09-24): the standees turn back to the board after the
// verdict (`swingStandee.js`: backAfter .4 + turnTime .5) and the overlay must
// not close — dropping the stick figures — before they have finished turning.
export const SWING_CLOSE = 1;     // the verdict → the overlay closes

/**
 * The whole Swing clock, from one set of beats.
 *
 * 📌 Parameterised so the dial-in preview drives THIS function rather than its
 * own copy of the arithmetic — and so porting Alex's numbers is an edit to the
 * six defaults above, not a hunt through a table of derived literals.
 */
export function swingTimingFor({ gate=SWING_GATE, raise=SWING_RAISE, amp=SWING_AMP,
  clash=SWING_CLASH, result=SWING_RESULT, close=SWING_CLOSE, timing=ARENA_DICE_TIMING } = {}) {
  const dice = arenaDiceSchedule([0, gate], timing);   // [attacker Drive, rival Drive]
  const DICE = Object.freeze({
    gate, poolStart: dice.poolStart, landedAt: dice.landedAt,
    raiseAt: dice.landedAt.map(t => diceBeat(t + raise)),
    ampAt: dice.landedAt.map(t => diceBeat(t + raise + amp)),
    gatherAt: dice.gatherAt, readAt: dice.readAt, timing: dice.timing,
  });
  // ⚠️ THE SHARED CHARGE BEAT IS GONE ON PURPOSE. It used to be one moment
  // where both cabinets lit at once, because both pools had rolled together.
  // Each amp now fires with its OWN Spirit's roll, so a single `charge` phase
  // would light the Rival's cabinet before the Rival had thrown anything.
  const TIMING = Object.freeze({
    roll: 0,                            // the attacker's dice leave the hand
    attackerRead: DICE.landedAt[0],
    attackerRaise: DICE.raiseAt[0],
    attackerAmp: DICE.ampAt[0],
    rival: gate,                        // the Rival's dice leave the hand
    rivalRead: DICE.landedAt[1],
    rivalRaise: DICE.raiseAt[1],
    rivalAmp: DICE.ampAt[1],
    read: DICE.readAt,                  // both totals on the floor
    clash: diceBeat(DICE.readAt + clash),
    result: diceBeat(DICE.readAt + clash + result),
    close: diceBeat(DICE.readAt + clash + result + close),
  });
  // 📌 `swing_rival` is a GATE, not merely a camera cue: the clock stops on it
  // until the Rival's ROLL. Anything scheduled after it on wall time would fire
  // during the wait — the client schedules from the resumed clock instead.
  const BEATS = [
    [TIMING.attackerRaise, 'swing_attacker_raise'],
    [TIMING.attackerAmp, 'swing_attacker_charge'],
    [TIMING.rival, 'swing_rival'],
    [TIMING.rivalRaise, 'swing_rival_raise'],
    [TIMING.rivalAmp, 'swing_rival_charge'],
    [TIMING.read, 'swing_read'],
    [TIMING.clash, 'swing_clash'],
    [TIMING.result, 'result'],
  ];
  return { TIMING, DICE, BEATS };
}

const base = swingTimingFor();
export const SWING_TIMING = base.TIMING;
export const SWING_DICE = base.DICE;
export const SWING_BEATS = base.BEATS;

// Every phase in which dice are on the floor — from the attacker's throw to
// the strike that clears them.
export const SWING_DICE_PHASES = Object.freeze(['swing_roll',
  ...SWING_BEATS.map(([, name]) => name).filter(name => name !== 'result')]);

// ⚠️ The phases in which a given side's Drive cabinet is energised. A cabinet
// is lit only once its OWN Spirit has rolled, so these two lists are different
// lengths on purpose — the attacker is charged for the whole of the Rival's
// turn to throw, and the Rival is charged for none of the attacker's.
export const SWING_CHARGED = Object.freeze({
  attacker: ['swing_attacker_charge', 'swing_rival', 'swing_rival_raise', 'swing_rival_charge', 'swing_read', 'swing_clash'],
  rival: ['swing_rival_charge', 'swing_read', 'swing_clash'],
});
