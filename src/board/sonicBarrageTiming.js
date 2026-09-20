// Shared seconds for floor dice, overlapping rings, sound and consequences.
export const BARRAGE_LAUNCH = 8.25;
export const BARRAGE_FLIGHT = 2.05;
export const BARRAGE_SPACING = .22;
export const BARRAGE_CARRY = .16;
export const barrageContact = i => BARRAGE_FLIGHT + i * BARRAGE_SPACING;
export function barrageTime(battle, time, reduced = false) {
  const at = battle.breakIndex >= 0 ? barrageContact(battle.breakIndex) : Infinity;
  return reduced ? time : time + Math.min(.18, Math.max(0, time - at)) * (1/.3 - 1);
}
export function barrageSimulationTime(battle, time, reduced = false) {
  const at = battle.breakIndex >= 0 ? barrageContact(battle.breakIndex) : Infinity;
  if (reduced || time <= at) return time;
  return time < at + .6 ? at + (time-at)*.3 : time-.42;
}
export const barrageLanded = (battle, reduced = false) => barrageTime(battle,
  barrageContact(Math.max(0, battle.diceVals.length-1)) + BARRAGE_CARRY + .15, reduced);
