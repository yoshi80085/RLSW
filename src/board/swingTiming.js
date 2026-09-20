import { ARENA_DICE_READ_AT } from './arenaDiceSequence.js';

export const SWING_TIMING=Object.freeze({attacker:1.6,dice:3.2,read:3.2+ARENA_DICE_READ_AT,
  charge:3.2+ARENA_DICE_READ_AT+2,clash:3.2+ARENA_DICE_READ_AT+4,
  result:3.2+ARENA_DICE_READ_AT+6.75,close:3.2+ARENA_DICE_READ_AT+7.35});
export const SWING_BEATS=[[SWING_TIMING.attacker,'swing_rival'],[SWING_TIMING.dice,'swing_roll'],
  [SWING_TIMING.read,'swing_read'],[SWING_TIMING.charge,'swing_charge'],
  [SWING_TIMING.clash,'swing_clash'],[SWING_TIMING.result,'result']];
