// =============================================================================
// riff/guitarMap.js — 🎸 FULL-NECK GUITAR MAP — position-anchored riff voicing
// -----------------------------------------------------------------------------
// The Rocksmith-style neck model for the riff-off's guitar view: all 6 strings,
// standard tuning, frets 0–12, riffs voiced in HAND POSITIONS (4–5 fret anchor
// windows) that slide along the neck the way a real player's hand does.
//
// Why: melodyToRiff octave-unwraps degrees to preserve melodic contour
// (G→A = +1 step, not −6). This module puts that octave information back on
// the neck — a climbing melody physically climbs the fretboard. Pitch space is
// aligned with audio/riffSfx.js `riffDegreeFreq`: degree 0 = open A string
// (A2, 110 Hz). What you see voiced is what the amp plays.
//
// PURE MODULE — no React, no audio, no app state. Deterministic: no RNG
// anywhere; the same riff always voices identically for both duelists.
//
// Main entry: voiceRiff(degrees, sharps, rhythm?) →
//   { positions: [ [string, fret], … ],       // per note; string 0 = low E
//     anchors:   [ { start, end, fret }, … ], // phrase windows (fret..fret+WINDOW)
//     octaveShift,                            // global fold applied (semitones/12)
//     overflow:  [ noteIdx, … ] }             // notes voiced outside their window
//                                             //   (correct pitch class, folded octave
//                                             //    or out-of-window fret — should be
//                                             //    empty for all generated riffs)
// =============================================================================

// ── The neck ─────────────────────────────────────────────────────────────────
// Pitch space: semitones above open low E (E2 = 0). Standard tuning EADGBe.
export const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
export const STRING_OPENS = [0, 5, 10, 15, 19, 24];
export const MAX_FRET = 12;   // playable neck: frets 0–12
export const WINDOW   = 4;    // anchor window spans fret A..A+4 (5 frets — one per finger + stretch)
export const NECK_MAX_PITCH = STRING_OPENS[5] + MAX_FRET; // 36 (E5)

// ── Degrees → pitch ──────────────────────────────────────────────────────────
// Mirrors riffGeneration.js (RIFF_NATURALS/RIFF_SHARPABLE) and riffSfx.js
// (riffDegreeFreq): degree 0 = a, natural-scale semis from a, sharps only on
// letters that have them (no E♯/B♯). Anchor: degree 0 = A2 = open A = pitch 5.
const NAT_SEMIS = [0, 2, 3, 5, 7, 8, 10];           // a b c d e f g
const NATURALS  = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const SHARPABLE = new Set(['a', 'c', 'd', 'f', 'g']);
const DEGREE0_PITCH = 5;                            // open A string

export function degreePitch(degree, sharp) {
  const idx = ((degree % 7) + 7) % 7;
  const oct = Math.floor(degree / 7);
  const s   = sharp && SHARPABLE.has(NATURALS[idx]) ? 1 : 0;
  return DEGREE0_PITCH + oct * 12 + NAT_SEMIS[idx] + s;
}

// Pitch class (0–11 above A) → note key in riff format (lowercase natural,
// UPPERCASE sharp — same convention as riffDegreesToNotes / riffPressKey).
const PC_KEYS = ['a', 'A', 'b', 'c', 'C', 'd', 'D', 'e', 'f', 'F', 'g', 'G'];
export function pitchKey(pitch) {
  return PC_KEYS[(((pitch - DEGREE0_PITCH) % 12) + 12) % 12];
}

// Note key for a neck cell — what a tap on (string, fret) means. Inverse
// contract of voiceRiff: cellKey(...voiceRiff(...).positions[i]) === the
// note's key letter.
export function cellKey(string, fret) {
  return pitchKey(STRING_OPENS[string] + fret);
}

// Nearest neck position sounding `key`'s pitch class, closest to a reference
// position — for notes that exist only as a key letter (E-Rush ghost gems,
// mid-run glitch swaps) and need a home near their sibling gem.
export function nearestPositionForKey(key, ref = [2, 2]) {
  const pcIdx = PC_KEYS.indexOf(key);
  if (pcIdx < 0) return null;
  let best = null, bestCost = Infinity;
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= MAX_FRET; f++) {
      if ((((STRING_OPENS[s] + f - DEGREE0_PITCH - pcIdx) % 12) + 12) % 12 !== 0) continue;
      const c = Math.abs(s - ref[0]) + Math.abs(f - ref[1]) * 0.5;
      if (c < bestCost - 1e-9) { bestCost = c; best = [s, f]; }
    }
  }
  return best;
}

// ── Positions for a pitch ────────────────────────────────────────────────────
// All (string, fret) cells sounding `pitch`, fret 0..MAX_FRET. Ordered low
// string → high string (deterministic).
export function positionsForPitch(pitch) {
  const out = [];
  for (let s = 0; s < 6; s++) {
    const f = pitch - STRING_OPENS[s];
    if (f >= 0 && f <= MAX_FRET) out.push([s, f]);
  }
  return out;
}

// ── Global octave fold ───────────────────────────────────────────────────────
// Raw pitches can fall off the neck (deep inversions, high modulations).
// Shift the WHOLE riff by k octaves — contour is preserved exactly — choosing
// the k that (1) keeps the most notes on the neck, (2) centers the riff low
// (metal lives below the 7th fret), (3) is smallest in magnitude.
const CENTER_TARGET = 10; // preferred median pitch (≈ open D / A str fret 5)

function bestOctaveShift(pitches) {
  let best = 0, bestScore = -Infinity;
  for (let k = -3; k <= 3; k++) {
    const shifted = pitches.map(p => p + k * 12);
    const onNeck  = shifted.filter(p => p >= 0 && p <= NECK_MAX_PITCH).length;
    const sorted  = [...shifted].sort((a, b) => a - b);
    const median  = sorted[Math.floor(sorted.length / 2)];
    const score   = onNeck * 1000 - Math.abs(median - CENTER_TARGET) * 10 - Math.abs(k);
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return best;
}

// ── Phrase segmentation ──────────────────────────────────────────────────────
// A note whose rhythm feel is 'rest' takes a breath first — that's a phrase
// boundary, and the only moment the hand (and the UI camera) may shift.
function phraseRanges(len, rhythm) {
  const starts = [0];
  for (let i = 1; i < len; i++) {
    if (rhythm?.[i]?.feel === 'rest') starts.push(i);
  }
  return starts.map((s, i) => ({ start: s, end: (starts[i + 1] ?? len) - 1 }));
}

// ── Anchor selection (DP across phrases) ─────────────────────────────────────
// A pitch is coverable at anchor A if some position for it is an open string
// or lands inside A..A+WINDOW. Choose one anchor per phrase minimizing
// (hand travel between phrases) + (a mild preference for low positions).
function coverableAt(pitch, A) {
  return positionsForPitch(pitch).some(([, f]) => f === 0 || (f >= A && f <= A + WINDOW));
}

// Ideal anchor for a phrase: put its median pitch mid-window on the middle
// strings (D/G region), so high phrases are PLAYED high on the neck — the
// hand travels with the register instead of hopping strings in home position.
function idealAnchor(notes) {
  const sorted = [...notes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return Math.max(0, Math.min(MAX_FRET - WINDOW, median - 13));
}

function chooseAnchors(phrases, pitches) {
  const MAX_A = MAX_FRET - WINDOW; // 8
  // Candidate anchors per phrase: full coverage if possible, else best-effort.
  const cands = phrases.map(ph => {
    const notes = pitches.slice(ph.start, ph.end + 1);
    let full = [];
    for (let A = 0; A <= MAX_A; A++) {
      if (notes.every(p => coverableAt(p, A))) full.push(A);
    }
    if (full.length) return { anchors: full, partial: false };
    // Best effort: anchors covering the most notes (ties → all kept for DP).
    let bestCov = -1, list = [];
    for (let A = 0; A <= MAX_A; A++) {
      const cov = notes.filter(p => coverableAt(p, A)).length;
      if (cov > bestCov) { bestCov = cov; list = [A]; }
      else if (cov === bestCov) list.push(A);
    }
    return { anchors: list, partial: true };
  });

  // DP: cost = register fit (window near the phrase's median pitch) + hand
  // travel between phrases. Fit outweighs travel so the neck actually moves
  // when the music does; travel keeps the moves economical.
  const ideals = phrases.map(ph => idealAnchor(pitches.slice(ph.start, ph.end + 1)));
  const n = phrases.length;
  const cost = cands.map((c, i) => c.anchors.map(A => Math.abs(A - ideals[i]) * 0.4));
  const prev = cands.map(c => c.anchors.map(() => -1));
  for (let i = 1; i < n; i++) {
    cands[i].anchors.forEach((A, j) => {
      let best = Infinity, bp = -1;
      cands[i - 1].anchors.forEach((pA, pj) => {
        const c = cost[i - 1][pj] + Math.abs(A - pA) * 0.25;
        if (c < best - 1e-9) { best = c; bp = pj; }
      });
      cost[i][j] += best;
      prev[i][j] = bp;
    });
  }
  // Walk back from the cheapest final anchor (ties → lower anchor index,
  // which is the lower fret — deterministic).
  let j = 0;
  cost[n - 1].forEach((c, jj) => { if (c < cost[n - 1][j] - 1e-9) j = jj; });
  const picks = new Array(n);
  for (let i = n - 1; i >= 0; i--) { picks[i] = cands[i].anchors[j]; j = prev[i][j]; }
  return picks.map((A, i) => ({ ...phrases[i], fret: A, partial: cands[i].partial }));
}

// ── Per-note voicing inside a phrase ─────────────────────────────────────────
// Among a pitch's positions in the window (or open strings), pick the one
// closest to where the hand already is. handRef tracks the last fretted fret
// (open strings don't move the hand). Deterministic tie-break: lower string.
function pickPosition(pitch, A, prevString, handRef, idx, overflow) {
  const all  = positionsForPitch(pitch);
  let cands  = all.filter(([, f]) => f === 0 || (f >= A && f <= A + WINDOW));
  if (!cands.length) {
    // Out of window (partial-coverage phrase): nearest fret to the hand.
    cands = all;
    overflow.push(idx);
  }
  let best = null, bestCost = Infinity;
  for (const [s, f] of cands) {
    const c = Math.abs(s - prevString) * 0.6 + (f === 0 ? 0.4 : Math.abs(f - handRef) * 0.3);
    if (c < bestCost - 1e-9) { bestCost = c; best = [s, f]; }
  }
  return best;
}

// ── voiceRiff — the main entry ───────────────────────────────────────────────
/**
 * @param {number[]}  degrees  Continuous (octave-unwrapped) riff degrees.
 * @param {boolean[]} sharps   Per-note accidental flags.
 * @param {object[]=} rhythm   Riff rhythm (phrase boundaries from feel==='rest').
 * @returns {{ positions: number[][], anchors: object[], octaveShift: number,
 *             overflow: number[] }}
 */
export function voiceRiff(degrees, sharps, rhythm) {
  if (!degrees?.length) return { positions: [], anchors: [], octaveShift: 0, overflow: [] };

  // 1. Degrees → raw pitches → global octave fold onto the neck.
  const raw   = degrees.map((d, i) => degreePitch(d, sharps?.[i]));
  const shift = bestOctaveShift(raw);
  const overflow = [];
  const pitches = raw.map((p, i) => {
    let q = p + shift * 12;
    // Last-resort per-note fold (contour dent — flag it).
    while (q < 0) { q += 12; }
    while (q > NECK_MAX_PITCH) { q -= 12; }
    if (q !== p + shift * 12) overflow.push(i);
    return q;
  });

  // 2. Phrases → anchors.
  const phrases = phraseRanges(degrees.length, rhythm);
  const anchors = chooseAnchors(phrases, pitches);

  // 3. Voice each note inside its phrase window.
  const positions = new Array(degrees.length);
  let prevString = 2.5;                 // start neutral (middle of the neck)
  for (const ph of anchors) {
    let handRef = ph.fret + 2;          // hand starts mid-window each phrase
    for (let i = ph.start; i <= ph.end; i++) {
      const pos = pickPosition(pitches[i], ph.fret, prevString, handRef, i, overflow);
      positions[i] = pos;
      prevString = pos[0];
      if (pos[1] > 0) handRef = pos[1]; // opens don't move the hand
    }
  }

  return {
    positions,
    anchors: anchors.map(({ start, end, fret }) => ({ start, end, fret })),
    octaveShift: shift,
    overflow: [...new Set(overflow)].sort((a, b) => a - b),
  };
}
