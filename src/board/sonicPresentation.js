import { BARRAGE_LAUNCH, SONIC_GATE, SONIC_DICE, barrageLanded } from './sonicBarrageTiming.js';
import { sonicSequenceDuration } from './sonicSequence.js';

// Seconds, shared by the dice, camera, audio and client presentation clock.
// The engine verdict is already frozen before this clock starts.
export const SONIC_PRESENTATION = Object.freeze({ roll:1.4, reveal:1.05, charge:.18, hold:.5, return:.65 });

export function scheduleSonicVolley({ count, schedule, phase, charge, launch, close, offset=0 }) {
  const revealAt=offset+SONIC_PRESENTATION.roll*1000;
  const chargeAt=revealAt+SONIC_PRESENTATION.reveal*1000;
  const launchAt=chargeAt+SONIC_PRESENTATION.charge*1000;
  const resultAt=launchAt+sonicSequenceDuration(count)*1000;
  schedule(()=>phase('sonic_reveal'),revealAt);
  schedule(()=>{phase('sonic_charge');charge?.();},chargeAt);
  schedule(()=>{phase('sonic_volley');launch?.();},launchAt);
  schedule(()=>phase('result'),resultAt);
  schedule(close,resultAt+SONIC_PRESENTATION.hold*1000);
}

// ⭐ THE BARRAGE IS SCHEDULED IN TWO HALVES, BECAUSE THE CLOCK STOPS IN THE
// MIDDLE OF IT. Everything up to the gate is scheduled from the RIVAL's ROLL;
// everything after it from the ATTACKER's. One `setTimeout` run across both
// would fire the reveal while the table was still waiting for the second press.

/** Rival's ROLL → their Sustain pool lands → the attacker is asked to throw. */
export function scheduleSonicShieldRoll({ schedule, phase, offset=0 }) {
  schedule(()=>phase('sonic_shield'),offset+SONIC_DICE.landedAt[1]*1000);
  schedule(()=>phase('sonic_armed'),offset+SONIC_GATE*1000);
}

/** Attacker's ROLL → their Drive lands → both totals → the amps → the volley. */
export function scheduleSonicBarrage({battle, reduced=false, schedule, phase, launch, close, offset=0}) {
  // ⚠️ Sequence seconds are measured from the RIVAL's throw, but these timers
  // run from the ATTACKER's, so every one of them is shifted back by the gate.
  const from=t=>offset+(t-SONIC_GATE)*1000;
  schedule(()=>phase('sonic_reveal'),from(SONIC_DICE.readAt));
  schedule(()=>{phase('sonic_volley');launch?.();},from(BARRAGE_LAUNCH));
  const end=from(BARRAGE_LAUNCH)+(barrageLanded(battle,reduced)+1.25)*1000;
  schedule(()=>phase('result'),end);
  schedule(close,end+2000);
}
