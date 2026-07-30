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

// ⚠️ FLAT_ROOTS was REMOVED, not deprecated. It drove the old key-signature
// speller — one global sharp-or-flat pool per root — which is exactly the model
// `getSpelledPool` no longer uses. Deleting the export rather than leaving it
// behind means any archived code that revives it fails to import, loudly, instead
// of quietly re-introducing the mis-spellings. (Same treatment STACK_CAP got.)

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

// ─── SPELLING BY SCALE DEGREE ────────────────────────────────────────────────
// A note's name comes from WHICH DEGREE it is, not from a key signature. The ♭7
// of C is B♭ because it's a lowered seventh — a seventh is some kind of B, and
// this one is flat. That's true in C major and C minor alike, which is why this
// needs no mode.
//
// ⚠️ This replaces a key-signature lookup that chose ONE global sharp-or-flat
// pool per root and named all twelve notes from it. That approach mis-spelled 14
// of the borrowed degrees players actually see — most visibly the blues ♭7 in C,
// the default root, which displayed as "A♯" instead of B♭. It also made spelling
// depend on mode for exactly 3 of 12 roots (C, D, G) and nowhere else, which was
// never enough to justify the coupling.
//
// Degree number for each interval above the root. Note 6 → 4, i.e. the tritone is
// always a ♯4 and never a ♭5: RLSW already committed to that rock bias ("Always
// F# — never Gb"), this just applies it consistently from every root.
const DEGREE_OF_INTERVAL = [1, 2, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// Only single accidentals are readable on a note chip. Anything needing a double
// flat/sharp — or the B♯/E♭♭ end of the spectrum — falls back to a plain name.
const ACCIDENTAL = { '-1': 'b', '0': '', '1': '#' };
const PLAIN_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const PLAIN_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Returns the correctly spelled 12-note chromatic pool for a given root.
// Indexed by absolute pitch class, so `pool[(rootIdx + n) % 12]` still returns the
// note n semitones above the root — every existing caller is unchanged.
//
// `mode` is retained only to canonicalise split roots (G♯/A♭, C♯/D♭); it no longer
// influences how any other note is spelled.
export function getSpelledPool(rootNote, mode) {
  const root   = canonicalRoot(rootNote, mode);
  const rootPc = pitchIndex(root);
  if (rootPc < 0) return [...PLAIN_SHARP];
  const rootLetterIdx = LETTERS.indexOf(root[0]);
  if (rootLetterIdx < 0) return [...PLAIN_SHARP];

  const pool = new Array(12);
  for (let iv = 0; iv < 12; iv++) {
    const pc     = (rootPc + iv) % 12;
    const letter = LETTERS[(rootLetterIdx + DEGREE_OF_INTERVAL[iv] - 1) % 7];
    // How far this pitch sits from the natural letter, as a signed semitone count.
    let delta = ((pc - LETTER_PC[letter]) % 12 + 12) % 12;
    if (delta > 6) delta -= 12;
    const acc = ACCIDENTAL[String(delta)];
    // Two readability escapes, both hit only on the exotic roots:
    //   1. A WHITE KEY never takes an accidental name. Strict degree spelling wants
    //      F♭ for the ♭3 of D♭ and B♯ for the ♯4 of F♯; a player reading a note chip
    //      wants E and C. Same pitch, and no guitarist writes the other one.
    //   2. Double accidentals (E♭♭, B♭♭) aren't spellable on a chip at all — fall
    //      back to the plain enharmonic name, flats for lowered degrees and sharps
    //      for the ♯4, matching what a guitarist would actually write.
    const isWhiteKey = PLAIN_SHARP[pc].length === 1;
    pool[pc] = isWhiteKey       ? PLAIN_SHARP[pc]
             : acc === undefined ? (iv === 6 ? PLAIN_SHARP[pc] : PLAIN_FLAT[pc])
             : letter + acc;
  }
  return pool;
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
// (theory_sus = ending flair. theory_chromatic adds no scale tones at all — it is
//  the Approach Notes pardon tier plus B6's chromatic-run payout, both of which live
//  in music/context.js and are applied at commit, not in the playable pool.)
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
