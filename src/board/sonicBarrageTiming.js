import { arenaDiceSchedule, diceBeat } from './arenaDiceSequence.js';
import { ROLL_GATE } from './battleRollGate.js';

// Shared seconds for floor dice, overlapping rings, sound and consequences.
//
// ⭐ THE RIVAL THROWS FIRST. Their Sustain pool is what the shield is MADE of,
// so the table watches the shield's strength land before the attacker picks up
// a single Drive die. The attacker then throws at `SONIC_GATE`; the clock holds
// there until their ROLL (`battleRollGate.js`).
export const SONIC_GATE = ROLL_GATE.sonic;
export const BARRAGE_HOLD = 2.4;   // both totals read → the amps fire

/**
 * The Sonic clock from one set of beats — parameterised for the same reason
 * `swingTimingFor` is: the dial-in preview drives this, not a copy of it.
 */
export function sonicScheduleFor({ gate = SONIC_GATE, hold = BARRAGE_HOLD, timing } = {}) {
  // [drive, sustain] — the attacker is pool 0 and throws SECOND here.
  const dice = arenaDiceSchedule([gate, 0], timing);
  return { gate, dice, launch: diceBeat(dice.readAt + hold) };
}

const base = sonicScheduleFor();
export const SONIC_DICE = base.dice;
// ⚠️ DERIVED, NOT A LITERAL — and it used to be `8.25`. That number was the
// simultaneous read (5.85) plus this two-second hold, written out by hand; the
// day the dice were staged it became a launch that fires while the attacker's
// dice are still in the air, with nothing in the file to say it had drifted.
export const BARRAGE_LAUNCH = base.launch;
/* 🔊 THE SONIC'S VOLLEY CLOCK — Alex's beat list, 2026-09-24.
   *"Blasts collide with shield. Each blast that connects - make the action
   'briefly' stop (half a second or so) - shield cracks (or the blast just
   explodes on it - or both …) - if the shield bursts (slow motion), the next
   blasts then connect to the player (again, stopping briefly) on each hit."*

   TWO CLOCKS, ONE MAPPING, and it is the only place either is defined:
     · SIMULATION seconds — where the beams are. Contact `i` is at
       `barrageContact(i)`; nothing in the volley's picture knows about stops.
     · PRESENTATION seconds — the wall clock the table lives on. Every contact
       FREEZES it for `hitstop`; the contact that breaks the shield then runs
       `breakSlowFor` sim-seconds at `breakRate` (the slow-motion burst).
   `barrageTime` is sim → presentation and `barrageSimulationTime` is its exact
   inverse. ⭐ The chord clashes, the shield crack, the Rival's push and the
   result beat are all scheduled through `barrageTime` (sonicBarrageAudio,
   sonicPresentation, the client), so a freeze in the picture is a freeze in
   the sound and in the rules' timers — with no second schedule to agree with.
   📌 Reduced motion keeps NO stops and no slow motion: identity both ways.
   ⌗ So does a bout that started under the TOP-DOWN view (Alex, 2026-09-24:
   *"let the battle play out as it normally would (no slow motion or
   anything) but each action still plays out"*). The client stamps
   `battle.realtime` once, at the start of the presentation, so the picture,
   the chords and the rules' timers all read the same flag off the same object
   — switching views mid-bout never splits the clocks.

   The beams are the signed-off RING BEAM at full `RING_TUNING` (restored the
   same day — the 2026-09-19 barrage had cut it down to fit a 0.22 s cadence).
   Its approach crawls (slow-mo 52), so `flight` stays the ring beam's own 2.4;
   `spacing` is the gap between launches, so several rings are in the air. */
export const SONIC_BEATS = Object.freeze({
  flight: 2.4,      // launch → first contact (the ring beam's own flight)
  spacing: 1.25,    // between one beam's launch and the next
  hitstop: .5,      // "briefly stop (half a second or so)" — every contact
  breakRate: .3,    // the shield's burst plays at 30% speed…
  breakSlowFor: .5, // …for this many sim-seconds after its freeze
});
export const BARRAGE_FLIGHT = SONIC_BEATS.flight;
export const BARRAGE_SPACING = SONIC_BEATS.spacing;
export const BARRAGE_CARRY = .16;
export const barrageContact = i => BARRAGE_FLIGHT + i * BARRAGE_SPACING;

/** The stops, in sim order: one per contact, the break carrying its slow-mo. */
function volleyStops(battle, B = SONIC_BEATS) {
  const count = battle?.shots?.length ?? battle?.diceVals?.length ?? 0;
  return Array.from({ length: count }, (_, i) => ({
    at: barrageContact(i), stop: B.hitstop,
    slow: i === battle?.breakIndex ? B.breakSlowFor : 0,
  }));
}
/** No freezes, no slow burst: reduced motion, or a bout played from the top-down view. */
export const barrageRealtime = (battle, reduced = false) => !!reduced || !!battle?.realtime;
/** Sim seconds → presentation seconds (both measured from the launch). */
export function barrageTime(battle, time, reduced = false, B = SONIC_BEATS) {
  if (barrageRealtime(battle, reduced) || !(time > 0)) return time;
  let sim = 0, pres = 0;
  for (const e of volleyStops(battle, B)) {
    if (time <= e.at) return pres + (time - sim);
    pres += e.at - sim; sim = e.at; pres += e.stop;
    if (e.slow) {
      if (time <= sim + e.slow) return pres + (time - sim) / B.breakRate;
      pres += e.slow / B.breakRate; sim += e.slow;
    }
  }
  return pres + (time - sim);
}
/** Presentation seconds → sim seconds: where the beams are at this wall second. */
export function barrageSimulationTime(battle, time, reduced = false, B = SONIC_BEATS) {
  if (barrageRealtime(battle, reduced) || !(time > 0)) return time;
  let sim = 0, pres = 0;
  for (const e of volleyStops(battle, B)) {
    if (time <= pres + (e.at - sim)) return sim + (time - pres);
    pres += e.at - sim; sim = e.at;
    if (time <= pres + e.stop) return sim;           // ⏸ frozen on the hit
    pres += e.stop;
    if (e.slow) {
      if (time <= pres + e.slow / B.breakRate) return sim + (time - pres) * B.breakRate;
      pres += e.slow / B.breakRate; sim += e.slow;
    }
  }
  return sim + (time - pres);
}
/** Is the volley frozen on a hit right now? → { index, age } or null (for the shake). */
export function barrageHitstop(battle, time, reduced = false, B = SONIC_BEATS) {
  if (barrageRealtime(battle, reduced) || !(time > 0)) return null;
  const stops = volleyStops(battle, B);
  for (let index = 0; index < stops.length; index++) {
    const start = barrageTime(battle, stops[index].at, false, B);
    if (time >= start && time < start + stops[index].stop) return { index, age: time - start };
  }
  return null;
}
export const barrageLanded = (battle, reduced = false) => barrageTime(battle,
  barrageContact(Math.max(0, battle.diceVals.length-1)) + BARRAGE_CARRY + .15, reduced);
