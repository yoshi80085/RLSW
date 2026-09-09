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
});

export const SPIRIT_MELODY_MODES = Object.freeze({
  cosmic_ronin:       'lydian',
  Metalness_Monster:  'phrygian',
  intergalactic_0:    'dorian',
});

// Beginner is the only live difficulty. Unknown/unsettled seats use its Lydian
// fallback so save fixtures and Glamarchy remain playable without pretending
// that their final character palette has been decided.
export const BEGINNER_FALLBACK_MODE = 'lydian';

export function melodyModeFor(spiritId) {
  return SPIRIT_MELODY_MODES[spiritId] ?? BEGINNER_FALLBACK_MODE;
}

export function modeIntervals(mode) {
  return MODE_INTERVALS[mode] ?? MODE_INTERVALS[BEGINNER_FALLBACK_MODE];
}

export function modeFamily(mode) {
  return ['dorian', 'phrygian', 'aeolian', 'locrian', 'minor'].includes(mode)
    ? 'minor'
    : 'major';
}

