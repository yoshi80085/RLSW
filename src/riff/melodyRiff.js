// =============================================================================
// riff/melodyRiff.js — MELODY → RIFF — the Rhythm Creation Device (Phase R1)
// -----------------------------------------------------------------------------
// Converts a committed melody line (NOTE_POOL format: 'C','C#','Db',…) into a
// riff-off riff ({degrees, sharps, contour, rhythm}) — the same shape
// generateAttackerRiff returns, so the rest of the pipeline (defender answer,
// engine verdict, highway UI) works unchanged.
//
// The game's thesis: "the melody you build is your combat." A player who builds
// a chromatic melody fields a riff full of sharps; a pentatonic player gets a
// simpler one. The attacker rehearsed this riff all turn — the defender
// sight-reads it. Complexity is a weapon paid for in preparation.
//
// PURE MODULE — no React, no audio, no app state.
// =============================================================================

import { generateRiffRhythm, generateAttackerRiff } from "./riffGeneration.js";

// ── NOTE_POOL → riff degree/sharp mapping ───────────────────────────────────
// Riff system: degree 0–6 maps to a–g; sharps[i] flags the accidental.
// NOTE_POOL chromatic pitch classes (sharp-side + flat aliases) → (degree, sharp).
//
//   C → c(2)   C#/Db → C(2)♯   D → d(3)   D#/Eb → D(3)♯   E → e(4)
//   F → f(5)   F#/Gb → F(5)♯   G → g(6)   G#/Ab → G(6)♯   A → a(0)
//   A#/Bb → A(0)♯               B → b(1)

const PITCH_TO_RIFF = {
  'C': { deg: 2, sharp: false }, 'C#': { deg: 2, sharp: true },
  'Db': { deg: 2, sharp: true },
  'D': { deg: 3, sharp: false }, 'D#': { deg: 3, sharp: true },
  'Eb': { deg: 3, sharp: true },
  'E': { deg: 4, sharp: false },
  'F': { deg: 5, sharp: false }, 'F#': { deg: 5, sharp: true },
  'Gb': { deg: 5, sharp: true },
  'G': { deg: 6, sharp: false }, 'G#': { deg: 6, sharp: true },
  'Ab': { deg: 6, sharp: true },
  'A': { deg: 0, sharp: false }, 'A#': { deg: 0, sharp: true },
  'Bb': { deg: 0, sharp: true },
  'B': { deg: 1, sharp: false },
};

// Inverse of the contour-detection in generateAttackerRiff: label the shape
// of a degree sequence so the defender-answer labels make sense.
function detectContour(degrees) {
  if (degrees.length < 2) return "climb";
  const mid = Math.floor(degrees.length / 2);
  let rising = 0, falling = 0, zigzags = 0;
  for (let i = 1; i < degrees.length; i++) {
    const d = degrees[i] - degrees[i - 1];
    if (d > 0) rising++;
    else if (d < 0) falling++;
    if (i >= 2) {
      const prev = degrees[i - 1] - degrees[i - 2];
      if ((prev > 0 && d < 0) || (prev < 0 && d > 0)) zigzags++;
    }
  }
  // Zigzag: alternation dominates
  if (zigzags >= Math.floor(degrees.length / 2)) return "zigzag";
  // Arch: rising first half, falling second
  const firstHalfRise = degrees.slice(1, mid + 1).every((d, i) => d >= degrees[i]);
  const secondHalfFall = degrees.slice(mid + 1).every((d, i) => d <= degrees[mid + i]);
  if (firstHalfRise && secondHalfFall && rising > 0 && falling > 0) return "arch";
  // Valley: falling first half, rising second
  const firstHalfFall = degrees.slice(1, mid + 1).every((d, i) => d <= degrees[i]);
  const secondHalfRise = degrees.slice(mid + 1).every((d, i) => d >= degrees[mid + i]);
  if (firstHalfFall && secondHalfRise && falling > 0 && rising > 0) return "valley";
  // Dominant direction
  if (rising > falling) return "climb";
  if (falling > rising) return "descent";
  return "climb";
}

// ── Passing-tone padding ────────────────────────────────────────────────────
// When the melody is shorter than targetLen, insert passing tones between
// existing pitches to fill out the riff. Passing tones step ±1 degree between
// neighbors — your notes, padded rhythm.
function padWithPassingTones(degrees, sharps, targetLen, rand) {
  if (degrees.length >= targetLen) return { degrees, sharps };
  const out = [degrees[0]];
  const outS = [sharps[0]];
  let budget = targetLen - degrees.length;

  for (let i = 1; i < degrees.length && budget > 0; i++) {
    // Insert one passing tone between neighbors that are >1 step apart
    const gap = degrees[i] - degrees[i - 1];
    if (Math.abs(gap) >= 2 && budget > 0) {
      const passDeg = degrees[i - 1] + Math.sign(gap);
      out.push(passDeg);
      outS.push(false); // passing tones are natural
      budget--;
    }
    out.push(degrees[i]);
    outS.push(sharps[i]);
  }

  // If we still need more, repeat the tail with slight chromatic approach tones
  while (out.length < targetLen) {
    const last = out[out.length - 1];
    const dir = rand() < 0.5 ? 1 : -1;
    out.push(last + dir);
    outS.push(rand() < 0.3); // occasional sharp for color
  }

  return { degrees: out, sharps: outS };
}

/**
 * melodyToRiff — convert a committed melody line into a riff-off riff.
 *
 * @param {string[]} melodyLine  Array of NOTE_POOL-format notes ('C','C#','Db',…)
 * @param {object}   opts
 * @param {function} opts.rand     0..1 RNG (default Math.random)
 * @param {number}   opts.targetLen  Target riff length (default 6)
 * @returns {{ degrees: number[], sharps: boolean[], contour: string, rhythm: object[], fromMelody: true }}
 *          Same shape as generateAttackerRiff's return + `fromMelody` flag.
 *          Returns null if minimum-material rule fails (caller falls back to
 *          generateAttackerRiff at reduced pot).
 */
export function melodyToRiff(melodyLine, { rand = Math.random, targetLen = 6 } = {}) {
  if (!melodyLine || melodyLine.length < 4) return null; // minimum-material rule

  // Map NOTE_POOL notes → riff degrees + sharps
  const rawDeg = [];
  const rawSharp = [];
  for (const note of melodyLine) {
    const entry = PITCH_TO_RIFF[note];
    if (!entry) continue; // skip unrecognized notes
    rawDeg.push(entry.deg);
    rawSharp.push(entry.sharp);
  }

  if (rawDeg.length < 4) return null; // not enough mapped notes

  // ── Octave-unwrap: the riff system uses continuous degrees (can go above 6
  // or below 0) to represent melodic contour. Raw degrees are mod-7 pitch
  // classes; we unwrap them so the contour tracks the player's melody shape.
  // Walk the sequence and whenever the shortest path wraps (e.g. 6→0 = +1
  // step, not -6), adjust to keep the line continuous.
  const unwrapped = [rawDeg[0]];
  for (let i = 1; i < rawDeg.length; i++) {
    const prev = unwrapped[i - 1];
    const curr = rawDeg[i];
    // Find the equivalent of curr closest to prev (within ±3 steps)
    let best = curr, bestDist = Infinity;
    for (let offset = -1; offset <= 1; offset++) {
      const candidate = curr + offset * 7;
      const dist = Math.abs(candidate - prev);
      if (dist < bestDist) { best = candidate; bestDist = dist; }
    }
    unwrapped.push(best);
  }

  // Trim or pad to targetLen
  let degrees, sharps;
  if (unwrapped.length > targetLen) {
    // Take the first targetLen notes (the riff is your opening statement)
    degrees = unwrapped.slice(0, targetLen);
    sharps = rawSharp.slice(0, targetLen);
  } else {
    ({ degrees, sharps } = padWithPassingTones(unwrapped, rawSharp, targetLen, rand));
  }

  const contour = detectContour(degrees);
  const rhythm = generateRiffRhythm(rand, degrees.length);

  return { degrees, sharps, contour, rhythm, fromMelody: true };
}
