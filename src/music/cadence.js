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

// Stagger duration from chromatic run length
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

// ── HC SCORING ───────────────────────────────────────────────────────────────
// Layer 1 (HC points — feeds upgrade counter):
//   Step A: floor(totalNotes / 2)  — all notes including last
//   Step B: ending bonus — 4th=+4, 5th=+5, Octave=+2
// Layer 2 (Drive/Sustain patterns) runs in confirmNoteTrack and is untouched.
export function scoreTrackHC(track, fourthNote, fifthNote) {
  if (!track || track.length === 0) return { points: 0, breakdown: [] };
  const breakdown = [];
  let points = 0;

  // Step A — placement points
  const placementPts = Math.floor(track.length / 2);
  if (placementPts > 0) {
    breakdown.push(`${track.length} notes → +${placementPts}`);
    points += placementPts;
  }

  // Step B — ending bonus (clean tracks only — caller guards this)
  const last = track[track.length - 1];
  const first = track[0];
  const isOctave = track.length >= 2 && first === last;
  if (last === fifthNote)       { breakdown.push(`5th end +5`);    points += 5; }
  else if (last === fourthNote) { breakdown.push(`4th end +4`);    points += 4; }
  else if (isOctave)            { breakdown.push(`octave end +2`); points += 2; }

  return { points, breakdown };
}

// analyseTrack still exists for Drive/Sustain pattern detection display in log
// (diatonic run scoring and repeat pattern scoring feed tempDrive/tempSustain only,
//  they no longer produce HC points directly — overflow from non-stacking still does)
export function analyseTrack(track, currentScale, fourthNote, fifthNote) {
  // Kept for log/breakdown compatibility — returns 0 pts, patterns noted
  if (!track || track.length === 0) return { points: 0, breakdown: [] };
  return { points: 0, breakdown: [] };
}

export function randomNote(rootNote, mode) {
  const pool = rootNote ? getSpelledPool(rootNote, mode) : NOTE_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}
export function refillStock(rootNote, mode, size = 8) {
  return Array.from({length: size}, () => randomNote(rootNote, mode));
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
