// =============================================================================
// music/cadence.js  —  CADENCE objectives + note-track scoring (pure logic)
// =============================================================================
import { NOTE_POOL, getSpelledPool, pitchIndex } from "./notes.js";
import { PC_PLAY_NAMES } from "./riffLibrary.js";

export const CADENCE_OBJECTIVES = [
  { id:'amen', name:'AMEN CADENCE', formula:'I → IV → I', degrees:[0,5,0], fp:2, icon:'🙏',
    desc:'End three consecutive turns on the root, the 4th, then home again. The gospel resolve.' },
  { id:'deceptive', name:'DECEPTIVE CADENCE', formula:'I → V → vi', degrees:[0,7,9], fp:3, icon:'🎭',
    desc:'Promise a resolution... then swerve to the relative minor. The audience gasps.' },
  { id:'authentic', name:'THE FULL RESOLVE', formula:'I → IV → V → I', degrees:[0,5,7,0], fp:4, icon:'👑',
    desc:'The king of cadences: root, 4th, 5th, and triumphantly home. Four turns of destiny.' },
  { id:'circle', name:'CIRCLE OF RESOLUTION', formula:'I → vi → ii → V → I', degrees:[0,9,2,7,0], fp:6, icon:'🌀',
    desc:'The grand tour — five turns of jazz-approved voice leading. Maximum sophistication.' },
];
export const CADENCE_BY_ID = Object.fromEntries(CADENCE_OBJECTIVES.map(c => [c.id, c]));

export function cadenceHints(trail, cooldowns = {}) {
  if (!trail || trail.length === 0) return [];
  const hints = [];
  for (const obj of CADENCE_OBJECTIVES) {
    if ((cooldowns[obj.id] ?? 0) > 0) continue;
    const d = obj.degrees;
    let matched = 0;
    for (let k = Math.min(d.length - 1, trail.length); k >= 1; k--) {
      const start = trail.length - k;
      const root = trail[start];
      let ok = true;
      for (let i = 1; i < k; i++) {
        if (((root + d[i]) % 12) !== trail[start + i]) { ok = false; break; }
      }
      if (ok) { matched = k; break; } // longest partial match wins
    }
    if (matched >= 1) {
      const root   = trail[trail.length - matched];
      const nextPc = (root + d[matched]) % 12;
      hints.push({
        cadence:  obj,
        matched,                       // finals already in place
        total:    d.length,
        nextPc,                        // pitch class to end on next turn
        nextNote: PC_PLAY_NAMES[nextPc],
        rootNote: PC_PLAY_NAMES[root],
        resolves: matched === d.length - 1, // next final completes it!
      });
    }
  }
  // Most-progressed first, then biggest Fame payout
  hints.sort((a, b) => (b.matched / b.total) - (a.matched / a.total) || b.cadence.fp - a.cadence.fp);
  return hints;
}

export function detectCadence(trail, cooldowns = {}) {
  if (!trail || trail.length < 3) return null;
  let best = null;
  for (const obj of CADENCE_OBJECTIVES) {
    if ((cooldowns[obj.id] ?? 0) > 0) continue;
    const d = obj.degrees;
    if (d.length > trail.length) continue;
    const tail = trail.slice(trail.length - d.length);
    const root = tail[0];
    let ok = true;
    for (let i = 1; i < d.length; i++) {
      if (((root + d[i]) % 12) !== tail[i]) { ok = false; break; }
    }
    if (ok && (!best || d.length > best.degrees.length)) best = obj;
  }
  return best;
}

export function detectChromaticRun(track) {
  if (!track || track.length < 3) return 0;
  let maxRun = 0;
  let i = 0;
  while (i < track.length) {
    let runLen = 1;
    let dir = 0; // +1 ascending, -1 descending
    while (i + runLen < track.length) {
      const a = pitchIndex(track[i + runLen - 1]);
      const b = pitchIndex(track[i + runLen]);
      if (a === -1 || b === -1) break;
      // Wrap-around chromatic distance
      let step = b - a;
      if (step > 6) step -= 12;
      if (step < -6) step += 12;
      if (Math.abs(step) !== 1) break;
      if (dir === 0) dir = step;
      else if (step !== dir) break;
      runLen++;
    }
    if (runLen >= 3) maxRun = Math.max(maxRun, runLen);
    i += Math.max(1, runLen);
  }
  return maxRun;
}

// Stagger duration from chromatic run length.
// ⚠️ UNUSED as of B1 — the chromatic-run → Stagger trigger was removed. Kept
// because B6 rescores the chromatic run as a Db payout on the same length
// thresholds (3/4/5+), so this curve is the obvious starting point. Delete it
// if B6 lands on a different shape.
export function staggerDuration(runLen) {
  if (runLen >= 5) return 3;
  if (runLen === 4) return 2;
  if (runLen === 3) return 1;
  return 0;
}

// ── DRIVE BOOST: diatonic step runs ──────────────────────────────────────────
// Returns the longest run of consecutive ascending OR descending diatonic steps
// (adjacent indices in currentScale) found in the track.
// Only notes IN the scale count — out-of-scale notes break the run.
export function detectDiatonicRun(track, currentScale) {
  if (!track || track.length < 3) return 0;
  let maxRun = 0;
  let i = 0;
  while (i < track.length) {
    let runLen = 1;
    let dir = 0; // +1 ascending, -1 descending
    while (i + runLen < track.length) {
      const a = currentScale.indexOf(track[i + runLen - 1]);
      const b = currentScale.indexOf(track[i + runLen]);
      if (a === -1 || b === -1) break;
      const step = b - a;
      if (Math.abs(step) !== 1) break;
      if (dir === 0) dir = step;
      else if (step !== dir) break;
      runLen++;
    }
    if (runLen >= 3) maxRun = Math.max(maxRun, runLen);
    i += Math.max(1, runLen);
  }
  return maxRun;
}

export function driveBoostFromRun(runLen) {
  if (runLen >= 5) return 3;
  if (runLen === 4) return 2;
  if (runLen >= 3) return 1;
  return 0;
}

// ── SKIP CLIMB DETECTION (Riff Slayer) ───────────────────────────────────────
// A "skip climb" leaps by THIRDS instead of stepping: consecutive notes whose
// scale-degree indices change by exactly +2 or -2, all in the SAME direction.
// e.g. C-E-G-B (up) or B-G-E-C (down). Out-of-scale notes break the run.
// Returns the length of the longest such run (min 3 to count).
export function detectSkipClimb(track, currentScale) {
  if (!track || track.length < 3) return 0;
  let maxRun = 0;
  let i = 0;
  while (i < track.length) {
    let runLen = 1;
    let dir = 0; // +2 ascending skips, -2 descending skips
    while (i + runLen < track.length) {
      const a = currentScale.indexOf(track[i + runLen - 1]);
      const b = currentScale.indexOf(track[i + runLen]);
      if (a === -1 || b === -1) break;
      const step = b - a;
      if (Math.abs(step) !== 2) break;
      if (dir === 0) dir = step;
      else if (step !== dir) break;
      runLen++;
    }
    if (runLen >= 3) maxRun = Math.max(maxRun, runLen);
    i += Math.max(1, runLen);
  }
  return maxRun;
}

// ── FEEDBACK BOOST: repeat patterns ───────────────────────────────────────────
// A) Same note consecutive: C-C-C (min 3, both notes must be in scale)
// B) Alternating pair A-B-A-B (min 4 notes, both notes in scale)
// Returns the longest qualifying run length found.
export function detectRepeatPattern(track, currentScale) {
  if (!track || track.length < 3) return 0;
  let maxRun = 0;

  // A) Consecutive repeats
  let i = 0;
  while (i < track.length) {
    if (!currentScale.includes(track[i])) { i++; continue; }
    let runLen = 1;
    while (i + runLen < track.length && track[i + runLen] === track[i]) runLen++;
    if (runLen >= 3) maxRun = Math.max(maxRun, runLen);
    i += Math.max(1, runLen);
  }

  // B) Alternating pair A-B-A-B
  let k = 0;
  while (k < track.length - 3) {
    const a = track[k], b = track[k + 1];
    if (a === b || !currentScale.includes(a) || !currentScale.includes(b)) { k++; continue; }
    let patLen = 2;
    while (k + patLen < track.length) {
      const expected = patLen % 2 === 0 ? a : b;
      if (track[k + patLen] !== expected) break;
      patLen++;
    }
    if (patLen >= 4) maxRun = Math.max(maxRun, patLen);
    k += Math.max(1, patLen);
  }

  return maxRun;
}

export function sustainBoostFromPattern(patLen) {
  if (patLen >= 5) return 3;
  if (patLen === 4) return 2;
  if (patLen >= 3) return 1;
  return 0;
}

// ── DB SCORING ───────────────────────────────────────────────────────────────
// Layer 1 (DB points — feeds upgrade counter):
//   Step A: max(0, floor(totalNotes / 2) - 1)  — all notes including last
//   Step B: ending bonus — 4th=+2, 5th=+3, Octave=+1
// Layer 2 (Drive/Sustain patterns) runs in confirmNoteTrack and is untouched.
//
// PENDING_CHANGES B2 — base melody income roughly halved. Step A now yields
// 0/1/1/2/2/3 across lengths 3–8, so length stays a real slope but stops being
// free money. (floor(len/3) was considered and rejected: it scores a 6-note and
// an 8-note track identically, flattening length out of the Db game entirely.)
//
// The ending ladder is deliberately *cadential* — it asks where the line came to
// rest, which is why there is no 7th/9th ending bonus. A ♭7 doesn't resolve, it
// hangs; paying a premium for the least-resolved note would invert the lesson the
// rest of the system teaches. Color is paid in the body of the track instead
// (B4: pardoned notes feed Drive/Sustain, not Db).
//
// B5 (Harmonic Lock) stacks an additional rank-scaled bonus on top of Step B when
// the final note is a chord tone of a stack holding a recognized chord. That lives
// at the commit site, not here — this function stays pure and stack-unaware.
// ⚠️ `endingBonus` / `endingKind` are part of the contract as of B5. Harmonic Lock
// escalates the ENDING bonus, so it must know one was actually earned — and it has
// to know without string-matching `breakdown`, which is display copy and will
// change. `endingBonus` is 0 when the line didn't come to rest on the 5th, 4th or
// its own first note; `endingKind` is null in that case, else 'fifth'|'fourth'|'octave'.
export function scoreTrackDB(track, fourthNote, fifthNote) {
  if (!track || track.length === 0) {
    return { points: 0, breakdown: [], endingBonus: 0, endingKind: null };
  }
  const breakdown = [];
  let points = 0;

  // Step A — placement points
  const placementPts = Math.max(0, Math.floor(track.length / 2) - 1);
  if (placementPts > 0) {
    breakdown.push(`${track.length} notes → +${placementPts}`);
    points += placementPts;
  }

  // Step B — ending bonus (clean tracks only — caller guards this)
  const last = track[track.length - 1];
  const first = track[0];
  const isOctave = track.length >= 2 && first === last;
  let endingBonus = 0;
  let endingKind  = null;
  if (last === fifthNote)       { breakdown.push(`5th end +3`);    endingBonus = 3; endingKind = 'fifth';  }
  else if (last === fourthNote) { breakdown.push(`4th end +2`);    endingBonus = 2; endingKind = 'fourth'; }
  else if (isOctave)            { breakdown.push(`octave end +1`); endingBonus = 1; endingKind = 'octave'; }
  points += endingBonus;

  return { points, breakdown, endingBonus, endingKind };
}

// analyseTrack still exists for Drive/Sustain pattern detection display in log
// (diatonic run scoring and repeat pattern scoring feed tempDrive/tempSustain only,
//  they no longer produce DB points directly — overflow from non-stacking still does)
export function analyseTrack(track, currentScale, fourthNote, fifthNote) {
  // Kept for log/breakdown compatibility — returns 0 pts, patterns noted
  if (!track || track.length === 0) return { points: 0, breakdown: [] };
  return { points: 0, breakdown: [] };
}

// `rand` is an optional injectable PRNG (a 0..1 function) — Phase 5a prep for the
// seeded engine. Defaults to Math.random so every existing caller is unchanged;
// the Phase-5c flip will pass the engine rng so note stock is replay-deterministic
// (same treatment as riff/riffGeneration.js's optional `rand` param in Phase 4).
export function randomNote(rootNote, mode, rand = Math.random) {
  const pool = rootNote ? getSpelledPool(rootNote, mode) : NOTE_POOL;
  return pool[Math.floor(rand() * pool.length)];
}
export function refillStock(rootNote, mode, size = 8, rand = Math.random) {
  return Array.from({length: size}, () => randomNote(rootNote, mode, rand));
}


// ── STYLE SYSTEM DETECTORS (STYLE_SYSTEM_HANDOFF.md §4) ─────────────────────
// Pure, Style-only detectors — additive alongside detectDiatonicRun /
// detectSkipClimb / detectRepeatPattern above, which are untouched and still
// feed the Drive/Sustain boosts.

// ── SHRED: style run ─────────────────────────────────────────────────────────
// Generalizes detectDiatonicRun (interval 1) and detectSkipClimb (interval 2)
// into one detector: the longest run of consecutive notes moving through the
// scale in ONE consistent direction by ONE consistent interval class (1 =
// step, 2 = 3rd, 3 = 4th, by default). Out-of-scale notes break the run. Min
// length 3 to count.
export function detectStyleRun(track, currentScale, intervals = [1, 2, 3]) {
  if (!track || track.length < 3) return 0;
  let maxRun = 0;
  let i = 0;
  while (i < track.length) {
    let runLen = 1;
    let dir = 0; // signed step (magnitude = interval class, sign = direction)
    while (i + runLen < track.length) {
      const a = currentScale.indexOf(track[i + runLen - 1]);
      const b = currentScale.indexOf(track[i + runLen]);
      if (a === -1 || b === -1) break;
      const step = b - a;
      if (!intervals.includes(Math.abs(step))) break;
      if (dir === 0) dir = step;
      else if (step !== dir) break;
      runLen++;
    }
    if (runLen >= 3) maxRun = Math.max(maxRun, runLen);
    i += Math.max(1, runLen);
  }
  return maxRun;
}

// ── SHRED signature: contour turn ────────────────────────────────────────────
// True if the track contains two qualifying runs (≥3 notes, one consistent
// direction + interval class each) in OPPOSITE directions — the "up the neck
// and back down" shred phrase. They may share a pivot note (the run ending at
// index i and a new run starting at index i are both examined, so a shared
// peak/valley note is naturally covered).
export function detectContourTurn(track, currentScale, intervals = [1, 2, 3]) {
  if (!track || track.length < 3) return false;
  let hasUp = false, hasDown = false;
  for (let i = 0; i < track.length - 1; i++) {
    let runLen = 1;
    let dir = 0;
    for (let j = i + 1; j < track.length; j++) {
      const a = currentScale.indexOf(track[j - 1]);
      const b = currentScale.indexOf(track[j]);
      if (a === -1 || b === -1) break;
      const step = b - a;
      if (!intervals.includes(Math.abs(step))) break;
      if (dir === 0) dir = step;
      else if (step !== dir) break;
      runLen++;
    }
    if (runLen >= 3) {
      if (dir > 0) hasUp = true;
      else if (dir < 0) hasDown = true;
    }
    if (hasUp && hasDown) return true;
  }
  return false;
}

// ── GROOVE: repeated cell ────────────────────────────────────────────────────
// Longest span covered by a 2-to-4-note cell repeated 2+ times consecutively
// (e.g. C-E-G-C-E-G is a 3-note cell repeated twice — covers 6 notes). All
// notes in the covered span must be in scale. Returns the total note count
// covered by the strongest such repetition found anywhere in the track, or 0.
export function detectCellRepeat(track, currentScale) {
  if (!track || track.length < 4) return 0;
  const n = track.length;
  let best = 0;
  for (let p = 2; p <= 4; p++) {
    for (let s = 0; s + 2 * p <= n; s++) {
      let cellInScale = true;
      for (let k = s; k < s + p; k++) {
        if (!currentScale.includes(track[k])) { cellInScale = false; break; }
      }
      if (!cellInScale) continue;
      let reps = 1, k = s + p;
      while (k + p <= n) {
        let same = true;
        for (let j = 0; j < p; j++) {
          if (track[k + j] !== track[s + j] || !currentScale.includes(track[k + j])) { same = false; break; }
        }
        if (!same) break;
        reps++; k += p;
      }
      if (reps >= 2) best = Math.max(best, reps * p);
    }
  }
  return best;
}

// ── FLAIR: resolved discords ─────────────────────────────────────────────────
// A "resolved discord" is an out-of-scale note immediately followed by an
// in-scale note. A discord as the FINAL note of a commit doesn't count (no
// next note to resolve into). `chromatic` is true if any resolution moves by
// exactly 1 semitone (wrap-aware) — the classic chromatic passing/leading tone.
export function detectResolvedDiscords(track, currentScale) {
  if (!track || track.length < 2) return { count: 0, chromatic: false };
  let count = 0;
  let chromatic = false;
  for (let i = 0; i < track.length - 1; i++) {
    const note = track[i];
    const next = track[i + 1];
    if (currentScale.includes(note)) continue;   // must be out of scale
    if (!currentScale.includes(next)) continue;  // must resolve INTO the scale
    count++;
    const a = pitchIndex(note), b = pitchIndex(next);
    if (a >= 0 && b >= 0) {
      const raw = Math.abs(a - b);
      const wrapped = Math.min(raw, 12 - raw);
      if (wrapped === 1) chromatic = true;
    }
  }
  return { count, chromatic };
}

// ─── REPEATED MOTIF (flair) ──────────────────────────────────────────────────
// Longest immediately-repeated motif: a block of `period` notes (period >= 2)
// played and then repeated back-to-back at least twice — e.g. C-E-G-C-E-G is
// period 3, reps 2. Returns { period, reps } of the strongest motif (longest
// period preferred, then most reps), or { period: 0, reps: 0 } if none. Pure.
export function detectMotifRepeat(track) {
  if (!track || track.length < 4) return { period: 0, reps: 0 };
  const n = track.length;
  let best = { period: 0, reps: 0 };
  for (let p = Math.floor(n / 2); p >= 2; p--) {
    for (let s = 0; s + 2 * p <= n; s++) {
      let reps = 1, k = s + p;
      while (k + p <= n) {
        let same = true;
        for (let j = 0; j < p; j++) { if (track[k + j] !== track[s + j]) { same = false; break; } }
        if (!same) break;
        reps++; k += p;
      }
      if (reps >= 2 && (p > best.period || (p === best.period && reps > best.reps))) best = { period: p, reps };
    }
    if (best.period === p) break; // longest possible period found
  }
  return best;
}
