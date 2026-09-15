// Seconds from the first launch. Leave a full shove/settle beat between shots.
export const SONIC_SEQUENCE = Object.freeze({ flight:2.4, settle:.8, impact:.12 });
export const sonicShotStart = index => Math.max(0,index)*(SONIC_SEQUENCE.flight+SONIC_SEQUENCE.settle);
export const sonicContactTime = index => sonicShotStart(index)+SONIC_SEQUENCE.flight;
export const sonicSequenceDuration = count => count>0 ? sonicContactTime(count-1)+SONIC_SEQUENCE.settle : 0;
