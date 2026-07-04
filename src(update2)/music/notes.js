// =============================================================================
// music/notes.js  —  NOTE SYSTEM + interval helpers (pure music theory)
// Extracted from the main file. No external dependencies.
// =============================================================================

// ─── NOTE SYSTEM ──────────────────────────────────────────────────────────────
// Chromatic pool — 12 pitch classes. Sharp-side default; contextual spelling
// applied at render time based on the active Root Note + mode.
export const NOTE_POOL = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Pitch class index lookup — works for both sharp and flat spellings
export const PITCH_INDEX = {
  'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'Fb':4,'F':5,'E#':5,
  'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11,'Cb':11,'B#':0,
};

// Roots that prefer flat spellings for their note pool, keyed by mode.
// Major flat keys: F, Bb, Eb, Ab, Db
// Minor flat keys: D, G, C, F, Bb, Eb, Ab (relative majors are all flat keys)
export const FLAT_ROOTS = {
  major: new Set(['F','Bb','Eb','Ab','Db']),
  minor: new Set(['D','G','C','F','Bb','Eb','Ab']),
};

// Split roots — canonical spelling depends on mode chosen
// e.g. G# → Ab major, G# minor
export const SPLIT_ROOT_SPELLING = {
  'G#': { major:'Ab', minor:'G#' },
  'Ab': { major:'Ab', minor:'G#' },
  'C#': { major:'Db', minor:'C#' },
  'Db': { major:'Db', minor:'C#' },
};

// Enharmonic respell map — applied when a raw note becomes a new Root Note
// before mode is known (split roots resolved after pivot choice)
export const ENHARMONIC_RESPELL = {
  'A#':'Bb', 'D#':'Eb', 'E#':'F', 'B#':'C', 'Cb':'B', 'Fb':'E', 'Gb':'F#',
  // G# and C# are intentionally NOT here — they resolve via SPLIT_ROOT_SPELLING
};

// Returns the canonical Root Note spelling given raw note + mode
export function canonicalRoot(rawNote, mode) {
  if (SPLIT_ROOT_SPELLING[rawNote]) return SPLIT_ROOT_SPELLING[rawNote][mode];
  if (ENHARMONIC_RESPELL[rawNote])  return ENHARMONIC_RESPELL[rawNote];
  return rawNote;
}

// Returns the correctly spelled 12-note chromatic pool for a given root + mode.
// The root context determines sharp vs flat naming for ALL notes.
export function getSpelledPool(rootNote, mode) {
  const root = canonicalRoot(rootNote, mode);
  const flatSet = FLAT_ROOTS[mode] ?? FLAT_ROOTS.major;
  const useFlats = flatSet.has(root);
  return [
    'C',
    useFlats ? 'Db' : 'C#',
    'D',
    useFlats ? 'Eb' : 'D#',
    'E',
    'F',
    'F#',   // Always F# in RLSW — never Gb (rock bias)
    'G',
    useFlats ? 'Ab' : 'G#',
    'A',
    useFlats ? 'Bb' : 'A#',
    'B',
  ];
}

// Converts a note name to pitch-class index (0–11), robust to either spelling
export function pitchIndex(note) {
  return PITCH_INDEX[note] ?? NOTE_POOL.indexOf(note);
}

// Returns note N semitones above root, spelled correctly for the current context
export function semitonesUpSpelled(root, mode, n) {
  const pool = getSpelledPool(root, mode);
  const rootIdx = pitchIndex(root);
  if (rootIdx === -1) return null;
  return pool[(rootIdx + n) % 12];
}

// Build scale notes from root + mode using interval formula, correctly spelled
export function buildScale(rootNote, mode) {
  const intervals = mode === 'major'
    ? [0,2,4,5,7,9,11]   // W W H W W W H
    : [0,2,3,5,7,8,10];  // W H W W H W W (natural minor)
  const pool = getSpelledPool(rootNote, mode);
  const rootIdx = pitchIndex(rootNote);
  if (rootIdx === -1) return [];
  return intervals.map(n => pool[(rootIdx + n) % 12]);
}

// All 12 major and minor scales — generated programmatically from buildScale.
// F# major uses F as its maj7 (E# displayed as F — single enharmonic exception).
export const MAJOR_SCALES = Object.fromEntries(
  ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B']
    .map(r => [r, buildScale(r,'major')])
);
export const MINOR_SCALES = Object.fromEntries(
  ['C','C#','D','Eb','E','F','F#','G','G#','A','Bb','B']
    .map(r => [r, buildScale(r,'minor')])
);

// Every root now has both a major and minor scale — all roots are pivot candidates.
// The original A/E/B set is kept for backward compat but pivot logic is now universal.
export const PIVOT_NOTES = new Set([
  'C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B',
  'C#','G#',  // split roots
]);

export function semitonesUp(root, n) {
  const idx = pitchIndex(root);
  if (idx === -1) return null;
  return NOTE_POOL[(idx + n) % 12];
}
// Interval helpers — contextually spelled for current root + mode
// 4th=5, 5th=7, tritone=6, major3rd=4, minorSeventh=10
export function getIntervalNotes(root, mode = 'major') {
  return {
    fourth:       semitonesUpSpelled(root, mode, 5),
    fifth:        semitonesUpSpelled(root, mode, 7),
    tritone:      semitonesUpSpelled(root, mode, 6),
    majorThird:   semitonesUpSpelled(root, mode, 4),
    minorSeventh: semitonesUpSpelled(root, mode, 10),
  };
}
// Keep getFourthFifth as a convenience alias
export function getFourthFifth(root, mode = 'major') {
  const i = getIntervalNotes(root, mode);
  return { fourth: i.fourth, fifth: i.fifth };
}

// ─── PLAYABLE SCALE (Theory unlocks) ─────────────────────────────────────────
// The set of notes a spirit can use WITHOUT a Discord penalty, given which Theory
// skills they've unlocked. Everyone starts on the MAJOR PENTATONIC; the rest of
// the palette is earned. `unlocks` is the spirit's unlockedSkills (array or Set).
//   theory_major  → completes the Major scale (adds the 4th & 7th)
//   theory_minor  → unlocks the Minor scale + the Major/Minor pivot
//   theory_dom7   → the ♭7 (dominant / blues color)
//   theory_modes  → modal color tones: Lydian ♯4 + Mixolydian ♭7 (Dorian 6 in minor)
// (theory_sus = ending flair, theory_chromatic = halved discord — handled in Game.)
export function playableScale(rootNote, mode, unlocks = []) {
  const u = unlocks instanceof Set ? unlocks : new Set(unlocks || []);
  const pool = getSpelledPool(rootNote, mode);
  const rootIdx = pitchIndex(rootNote);
  if (rootIdx < 0) return [];
  let degs;
  if (mode === 'minor' && u.has('theory_minor')) {
    degs = [0, 2, 3, 5, 7, 8, 10];               // natural minor
    if (u.has('theory_modes')) degs = degs.concat(9);   // Dorian color (natural 6)
  } else {
    degs = [0, 2, 4, 7, 9];                      // MAJOR PENTATONIC — the starting palette
    if (u.has('theory_major')) degs = [0, 2, 4, 5, 7, 9, 11]; // full Major (adds 4th & 7th)
    if (u.has('theory_dom7'))  degs = degs.concat(10);        // dominant / blues ♭7
    if (u.has('theory_modes')) degs = degs.concat([6, 10]);   // Lydian ♯4 + Mixolydian ♭7
  }
  const uniq = [...new Set(degs)].sort((a, b) => a - b);
  return uniq.map(n => pool[(rootIdx + n) % 12]);
}
