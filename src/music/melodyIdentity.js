// A Spirit owns its clean palette. The chord stacks may create a separate
// red/blue carrot, but they never choose or widen this palette.

export const MELODY_DIFFICULTY = Object.freeze({
  BEGINNER: 'beginner',
  UNASSISTED: 'unassisted',
});

export const MODE_INTERVALS = Object.freeze({
  ionian:     Object.freeze([0, 2, 4, 5, 7, 9, 11]),
  dorian:     Object.freeze([0, 2, 3, 5, 7, 9, 10]),
  phrygian:   Object.freeze([0, 1, 3, 5, 7, 8, 10]),
  lydian:     Object.freeze([0, 2, 4, 6, 7, 9, 11]),
  mixolydian: Object.freeze([0, 2, 4, 5, 7, 9, 10]),
  aeolian:    Object.freeze([0, 2, 3, 5, 7, 8, 10]),
  locrian:    Object.freeze([0, 1, 3, 5, 6, 8, 10]),
  // 🗡️ HIRAJOSHI + THE PERFECT FOURTH — the Ronin's palette (Alex, 2026-09-16).
  // Hirajoshi as guitarists play it is five notes, 1 2 ♭3 5 ♭6 (C D E♭ G A♭);
  // Alex adds the perfect 4th, so six clean notes: C D E♭ F G A♭.
  // ⚠️ SIX, NOT SEVEN, AND THE ORDER IS LOAD-BEARING. `melodyCommit.js` reads the
  // resolving 4th and 5th as `harmonicScale[3]` and `[4]` — scale DEGREES, not
  // semitones. With the 4th in, index 3 is F and index 4 is G. Bare five-note
  // Hirajoshi would make index 3 the fifth and index 4 the ♭6, silently moving
  // both endings. `roninToneCheck` §1 is the tripwire.
  hirajoshi:  Object.freeze([0, 2, 3, 5, 7, 8]),
});

export const SPIRIT_MELODY_MODES = Object.freeze({
  cosmic_ronin:       'hirajoshi',   // was 'lydian' until 2026-09-16
  Metalness_Monster:  'phrygian',
  intergalactic_0:    'dorian',
});

// Beginner is the only live difficulty. Unknown/unsettled seats use its Lydian
// fallback so save fixtures and Glamarchy remain playable without pretending
// that their final character palette has been decided.
// (Lydian was also the Ronin's own mode until 2026-09-16; the fallback did not move.)
export const BEGINNER_FALLBACK_MODE = 'lydian';

export function melodyModeFor(spiritId) {
  return SPIRIT_MELODY_MODES[spiritId] ?? BEGINNER_FALLBACK_MODE;
}

export function modeIntervals(mode) {
  return MODE_INTERVALS[mode] ?? MODE_INTERVALS[BEGINNER_FALLBACK_MODE];
}

export function modeFamily(mode) {
  return ['dorian', 'phrygian', 'aeolian', 'locrian', 'hirajoshi', 'minor'].includes(mode)
    ? 'minor'
    : 'major';
}

