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
