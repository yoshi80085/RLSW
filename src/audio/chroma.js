// =============================================================================
// audio/chroma.js — POLYPHONIC CHROMA — what notes are sounding RIGHT NOW
// -----------------------------------------------------------------------------
// The companion to `audio/micPitch.js`, and deliberately NOT a replacement.
//
//   micPitch.js  →  ONE note.  YIN autocorrelation. "Which string did you pluck?"
//   chroma.js    →  ALL notes. Spectral peaks → pitch classes. "What's ringing?"
//
// ⚠️ WHY A SECOND MODULE INSTEAD OF EXTENDING THE FIRST. YIN finds the single
// best periodicity in a buffer. That is the right algorithm for Fretboard Recon
// (one prompt, one pluck, one answer) and the wrong algorithm for a strummed
// chord — fed a G major it returns G, or B, or the second harmonic of D,
// flickering frame to frame. Polyphony is not a tuning problem; it is a
// different algorithm class. micPitch.js is untouched and keeps its consumers.
//
// WHAT THIS PRODUCES: a 12-element **chroma vector** (a.k.a. pitch class
// profile), index 0 = C, matching `music/chords.js` PC_NAMES and micPitch's
// `pcAbsolute`. Each element is 0..1 relative strength. Octave is folded away —
// chord identity is a pitch-class fact.
//
// ...AND, alongside it, `notes`: the same detections WITH their octave intact,
// as MIDI numbers. The octave was never unknown — the peaks carry real
// frequencies — it was simply discarded on the last step. Keeping it is what
// lets `music/neckPlacement.js` put a heard note on an actual fret instead of
// lighting all seven places that pitch class lives.
//
// PURE MODULE — no React, no app state, no game imports. The DSP half runs in
// Node (see `chromaSelftest.mjs`); only `startChromaListening` touches the DOM.
//
// Usage (browser):
//   const listener = await startChromaListening(({ chroma, bass, db }) => {
//     // chroma: Float32Array(12), 0..1, index 0 = C
//     // bass:   Float32Array(12), same but only sub-200 Hz content (root hints)
//   });
//   listener.stop();
//
// Usage (offline / Node):
//   const { chroma } = chromaFromSamples(float32Pcm, 44100);
// =============================================================================

// ── Tunables ────────────────────────────────────────────────────────────────
// These are the knobs that decide whether a room full of a friend playing gets
// read as music or as mush. Documented rather than inlined because they WILL
// need re-tuning against real rooms, the same way MIC_DEFAULTS did.
export const CHROMA_DEFAULTS = {
  // Analysis band. Below ~73 Hz is floor rumble and mic proximity thump; above
  // ~2100 Hz a guitar is all overtone and no fundamental, so peaks up there
  // mostly restate notes already counted lower down.
  minHz: 73.4,        // D2 — a half-step under standard low E, leaves drop-D room
  maxHz: 2093,        // C7
  bassMaxHz: 200,     // the "which note is on the bottom" band (E2–G3)

  // A peak must clear this fraction of the loudest peak in the band to count.
  // Too low and the noise floor votes; too high and a quiet third vanishes —
  // which is exactly how a major triad gets misread as a power chord.
  peakFloorRatio: 0.06,
  maxPeaks: 40,       // hard cap; distortion can produce dozens of real peaks

  // Harmonic suppression. A guitar's 2nd/3rd/4th partials are often LOUDER than
  // its fundamental, and distortion manufactures more. Untreated, the 3rd
  // harmonic of C (≈ G) stuffs the G bin and every C chord reads as C5 or Csus.
  harmonicTolerance: 0.035,  // ±3.5% of the ideal ratio ≈ ±half a semitone
  harmonicDiscount: 0.25,    // partial credit, NOT deletion — see note below
  maxHarmonic: 8,            // ⚠️ must reach 7 — see THE 7TH PARTIAL note below

  // Frame gating. Below this the chroma is noise and callers should be told so
  // rather than handed a confident-looking vector built from room tone.
  gateDb: -55,

  // Register output. A detected note must reach this fraction of the strongest
  // note to be reported in `notes` — the octave-aware list. Higher than the
  // chroma floor on purpose: a phantom in the chroma costs a slightly wrong
  // bar height, a phantom in `notes` lights a wrong dot on the fretboard.
  //
  // ⚠️ THIS IS WHY EXACT OCTAVE DOUBLES COLLAPSE, AND THAT IS NOT FIXABLE.
  // E4 is the 4th harmonic of E2, so "E2 played brightly" and "E2 and E4 played
  // together" are the same spectrum. No microphone-based method can separate
  // them; it can only pick one. We keep the lower note and let the octave show
  // up as a dim echo in the neck view. Lowering this floor to "recover" the
  // upper octave does not recover information that was never there — it just
  // prints a phantom octave above every single note you play.
  noteFloor: 0.30,

  // Exponential smoothing half-life. Chords last far longer than the ~46 ms of
  // one FFT frame, so averaging is nearly free accuracy. Too long and fast
  // changes smear into each other.
  smoothHalfLifeMs: 250,

  fftSize: 8192,      // ~5.4 Hz bins at 44.1k — needed to resolve low-string thirds
};

// ⚠️ HARMONIC SUPPRESSION IS A DISCOUNT, NOT A DELETE. A peak that looks like a
// harmonic of a stronger lower peak might genuinely be a note somebody played
// (an octave double, or the 5th in a power chord, which IS the 3rd partial's
// pitch class). Zeroing those was tried first and it ate real fifths. Partial
// credit keeps a truly-played note in contention while stopping an overtone
// series from out-voting the notes that produced it.
//
// ⚠️ THE 7TH PARTIAL IS WHY `maxHarmonic` IS 8 AND NOT 6. Harmonic 7 of any
// note is a flat seventh of it — the natural, slightly-flat one, but close
// enough to land in the ♭7 chroma bin. Stopping the sweep at 6 left that
// partial at full weight, and every bright or overdriven MAJOR TRIAD read as a
// dominant 7th (measured: ~7% of triads on clean synthetic input, worse with
// detuning). Extending the check to 8 fixed it outright. The cost is that a
// genuinely played ♭7 also gets discounted — acceptable, because it is a
// discount and not a delete, and because a real ♭7 is usually the loudest thing
// in its own region rather than a partial riding on a stronger root.



// ── Minimal real FFT ────────────────────────────────────────────────────────
// In the browser AnalyserNode hands us a spectrum for free, so this exists for
// two other reasons: offline analysis of a recorded buffer, and making the
// whole detection chain testable in Node with no DOM and no dependencies.
// Iterative radix-2 Cooley-Tukey, Hann-windowed. Input is truncated to the
// largest power of two it contains.

/**
 * @param {Float32Array|number[]} samples  time-domain PCM, roughly -1..1
 * @returns {Float32Array} magnitude spectrum, length N/2 (bin i = i*sr/N Hz)
 */
export function fftMagnitudes(samples) {
  const n = 1 << Math.floor(Math.log2(samples.length));
  if (n < 4) return new Float32Array(0);

  const re = new Float64Array(n);
  const im = new Float64Array(n);
  // Hann window — without it, chopping the signal mid-cycle smears every peak
  // across neighbouring bins and peak-picking finds ridges instead of notes.
  for (let i = 0; i < n; i++) {
    re[i] = samples[i] * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cwr = 1;
      let cwi = 0;
      for (let j = 0; j < half; j++) {
        const ur = re[i + j];
        const ui = im[i + j];
        const xr = re[i + j + half];
        const xi = im[i + j + half];
        const vr = xr * cwr - xi * cwi;
        const vi = xr * cwi + xi * cwr;
        re[i + j] = ur + vr;
        im[i + j] = ui + vi;
        re[i + j + half] = ur - vr;
        im[i + j + half] = ui - vi;
        const nwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr;
        cwr = nwr;
      }
    }
  }

  const out = new Float32Array(n >> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / (n >> 1);
  }
  return out;
}

// ── Peak picking ────────────────────────────────────────────────────────────
// Local maxima with parabolic interpolation. Interpolation matters more than it
// looks: at an 8192-point FFT the bins are ~5.4 Hz apart, which near the low E
// string is most of a semitone. Without sub-bin refinement, low notes land in
// the wrong chroma bin often enough to break bass-root detection.

/**
 * @returns {{freq:number, mag:number}[]} sorted by magnitude, loudest first
 */
export function pickPeaks(mags, sampleRate, fftSize, opts = {}) {
  const o = { ...CHROMA_DEFAULTS, ...opts };
  const binHz = sampleRate / fftSize;
  const lo = Math.max(1, Math.floor(o.minHz / binHz));
  const hi = Math.min(mags.length - 2, Math.ceil(o.maxHz / binHz));
  if (hi <= lo) return [];

  let maxMag = 0;
  for (let i = lo; i <= hi; i++) if (mags[i] > maxMag) maxMag = mags[i];
  if (maxMag <= 0) return [];

  const floor = maxMag * o.peakFloorRatio;
  const peaks = [];
  for (let i = lo; i <= hi; i++) {
    const b = mags[i];
    if (b < floor) continue;
    const a = mags[i - 1];
    const c = mags[i + 1];
    if (b <= a || b < c) continue;                  // not a local maximum

    const denom = a - 2 * b + c;
    const delta = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
    if (Math.abs(delta) > 1) continue;              // degenerate fit, skip
    const freq = (i + delta) * binHz;
    const mag = b - 0.25 * (a - c) * delta;
    if (freq >= o.minHz && freq <= o.maxHz && mag > 0) peaks.push({ freq, mag });
  }

  peaks.sort((x, y) => y.mag - x.mag);
  return peaks.slice(0, o.maxPeaks);
}

// ── Peaks → chroma ──────────────────────────────────────────────────────────

/** Continuous MIDI number for a frequency. A440. */
export function freqToMidiFloat(freq) {
  return 69 + 12 * Math.log2(freq / 440);
}

/**
 * Fold spectral peaks into a 12-bin pitch class profile.
 *
 * Peaks arrive loudest-first, and each is checked against the peaks already
 * accepted BELOW it: if it sits at ~2x..6x a stronger lower peak's frequency it
 * is probably that peak's overtone and is discounted (see the note above).
 *
 * Magnitudes are square-rooted on the way in. Chord recognition cares about
 * which notes are PRESENT, not which is loudest; raw magnitudes let one hard-
 * picked bass note drown out three quieter voices that carry the chord quality.
 *
 * ⚠️ ALSO RETURNS `notes`, WHICH KEEPS THE OCTAVE. Chroma folds everything mod
 * 12, and for chord identity that is correct — but the octave was never
 * unknown, it was thrown away on the last step. The peaks carry real
 * frequencies. Keeping the absolute MIDI note alongside the pitch class costs
 * nothing and is the difference between "there is a C somewhere" and "that C,
 * on the A string at the third fret" — i.e. between a chord readout and a
 * fretboard. Pitch-class consumers are unaffected; this is additive, exactly as
 * micPitch.js did when it started reporting register.
 *
 * @returns {{ chroma, bass, notes, energy }}
 *   chroma / bass — Float32Array(12), normalized so the strongest bin is 1
 *   notes  — [{ midi, pc, strength }] above `noteFloor`, strongest first
 *   energy — raw pre-normalization sum; a "was there anything here" scalar
 */
export function chromaFromPeaks(peaks, opts = {}) {
  const o = { ...CHROMA_DEFAULTS, ...opts };
  const chroma = new Float32Array(12);
  const bass = new Float32Array(12);
  const byMidi = new Map();
  const accepted = [];
  let energy = 0;

  for (const p of peaks) {
    let weight = 1;
    for (const q of accepted) {
      if (q.freq >= p.freq) continue;               // only lower peaks can parent
      const ratio = p.freq / q.freq;
      const nearest = Math.round(ratio);
      if (nearest < 2 || nearest > o.maxHarmonic) continue;
      if (Math.abs(ratio - nearest) < o.harmonicTolerance * nearest) {
        weight = Math.min(weight, o.harmonicDiscount);
      }
    }
    accepted.push(p);

    const w = Math.sqrt(p.mag) * weight;
    const midi = Math.round(freqToMidiFloat(p.freq));
    const pc = ((midi % 12) + 12) % 12;
    chroma[pc] += w;
    if (p.freq <= o.bassMaxHz) bass[pc] += w;
    byMidi.set(midi, (byMidi.get(midi) || 0) + w);
    energy += w;
  }

  // Register list, normalized against the strongest note and thresholded.
  let maxNote = 0;
  for (const w of byMidi.values()) if (w > maxNote) maxNote = w;
  const notes = maxNote > 0
    ? [...byMidi.entries()]
        .map(([midi, w]) => ({ midi, pc: ((midi % 12) + 12) % 12, strength: w / maxNote }))
        .filter(n => n.strength >= o.noteFloor)
        .sort((a, b) => b.strength - a.strength)
    : [];

  return { chroma: normalize(chroma), bass: normalize(bass), notes, energy };
}

/** Scale a vector so its largest element is 1. All-zero vectors pass through. */
export function normalize(vec) {
  let max = 0;
  for (let i = 0; i < vec.length; i++) if (vec[i] > max) max = vec[i];
  if (max <= 0) return vec;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / max;
  return out;
}

/** Spectrum → chroma, in one call. */
export function chromaFromSpectrum(mags, sampleRate, fftSize, opts = {}) {
  return chromaFromPeaks(pickPeaks(mags, sampleRate, fftSize, opts), opts);
}

/** Time-domain PCM → chroma, in one call. Offline / Node entry point. */
export function chromaFromSamples(samples, sampleRate, opts = {}) {
  const mags = fftMagnitudes(samples);
  const n = mags.length * 2;
  return chromaFromSpectrum(mags, sampleRate, n, opts);
}

// ── Smoothing ───────────────────────────────────────────────────────────────

/**
 * Exponential moving average over chroma frames, with a half-life in ms so the
 * behaviour is frame-rate independent (a 60 fps laptop and a 30 fps phone
 * smooth by the same amount of TIME, not the same number of frames).
 *
 * @returns {{ push(chroma, dtMs): Float32Array, value(): Float32Array, reset(): void }}
 */
export function makeChromaSmoother(opts = {}) {
  const halfLife = opts.halfLifeMs ?? CHROMA_DEFAULTS.smoothHalfLifeMs;
  let acc = new Float32Array(12);
  let seeded = false;

  return {
    push(chroma, dtMs = 16.7) {
      if (!seeded) {
        acc = Float32Array.from(chroma);
        seeded = true;
        return normalize(acc);
      }
      const alpha = 1 - Math.pow(0.5, Math.max(0, dtMs) / halfLife);
      for (let i = 0; i < 12; i++) acc[i] += alpha * (chroma[i] - acc[i]);
      return normalize(acc);
    },
    value() { return normalize(acc); },
    reset() { acc = new Float32Array(12); seeded = false; },
  };
}

// ── Musical-frame gating ────────────────────────────────────────────────────
// ⚠️ THE LESSON micPitch.js ALREADY LEARNED. Its header says the first pass
// "answered footsteps, speech and room tone" because every threshold was wide
// open, and the fix was to require FOUR independent filters to agree before a
// note counted. This module shipped with exactly one filter — a fixed dB gate —
// and reproduced the same symptom: a chord read, confidently, off a chair
// scrape. What follows is the same remedy adapted to polyphony.
//
// A chord is pitched, sustained and stable. Non-music fails at least one of
// those, so each gate below targets a different failure:
//
//   1. NOISE FLOOR   — is it above THIS room, not an absolute number? A fixed
//      gateDb is wrong in both directions: deaf in a quiet room with a hot
//      interface, wide open in a loud one. The floor adapts to the room.
//   2. FLATNESS      — is the spectrum peaky (notes) or smooth (noise)? This is
//      the single most effective non-music rejector. Fans, traffic, hiss,
//      applause, consonants and clatter are all broadband and die here.
//   3. ENTROPY       — do a FEW pitch classes dominate? A chord lights 2–6 bins.
//      Twelve roughly equal bins is not a twelve-note chord, it's mush.
//   4. STABILITY     — does this frame resemble the last one? A held chord does.
//      Speech, which is pitched enough to survive flatness, moves constantly
//      and dies here. So do transients: a slam is different every frame.
//   5. STABLE FRAMES — has all of the above held for several frames running?
//      The debounce, and the direct analogue of micPitch's `stableFrames`.
// ⚠️ EVERY THRESHOLD BELOW IS MEASURED, NOT GUESSED. The first draft of this
// block was written from intuition and three of the five numbers were wrong
// enough to matter — one of them (stability) let noise through completely. They
// now come from running real signals through the real functions; the table in
// `chromaSelftest.mjs` §gating prints the measurements, and the tests assert the
// separation still holds. Re-run it before changing anything here.
//
//                    flatness   chroma entropy   frame-to-frame stability
//   clean triad        0.030         0.62              ~1.00
//   overdriven triad   0.102         0.64              ~1.00
//   noisy acoustic     0.139         0.67              ~0.99
//   speech             0.285         0.93               0.02
//   pink noise (fan)   0.744         0.97               0.08
//   white noise        0.846         0.94               0.04
//   click (door/keys)  0.889         0.98               0.13
export const GATE_DEFAULTS = {
  floorMarginDb: 12,       // dB above the rolling room floor a frame must sit
  floorHalfLifeMs: 3000,   // how fast the floor follows the room upward
  maxFlatness: 0.20,       // music tops out at 0.14, speech starts at 0.26
  maxEntropy: 0.85,        // music tops out at 0.67, speech/noise sit above 0.93
  minStability: 0.60,      // music ~1.0, everything else under 0.15 — huge margin
  stableFrames: 3,         // consecutive passing frames before we believe it
  releaseMs: 600,          // continuous rejection before the smoother resets
};

/**
 * Spectral flatness (Wiener entropy): geometric mean / arithmetic mean of the
 * magnitude spectrum across the analysis band. 0 = a pure tone, 1 = white
 * noise. See the measured table above GATE_DEFAULTS — music lands under 0.14,
 * broadband noise above 0.74.
 *
 * This is the gate that kills fans, traffic, hiss, applause and clatter. It is
 * NOT the gate that kills speech: voiced speech is pitched, and at 0.29 it sits
 * uncomfortably close to a noisy acoustic chord at 0.14. Speech is caught by
 * stability instead — it never holds the same pitch classes for three frames.
 */
export function spectralFlatness(mags, sampleRate, fftSize, opts = {}) {
  const o = { ...CHROMA_DEFAULTS, ...opts };
  const binHz = sampleRate / fftSize;
  const lo = Math.max(1, Math.floor(o.minHz / binHz));
  const hi = Math.min(mags.length - 1, Math.ceil(o.maxHz / binHz));
  if (hi <= lo) return 1;

  const EPS = 1e-12;
  let logSum = 0;
  let sum = 0;
  let n = 0;
  for (let i = lo; i <= hi; i++) {
    const m = mags[i] + EPS;
    logSum += Math.log(m);
    sum += m;
    n++;
  }
  if (n === 0 || sum <= 0) return 1;
  const geo = Math.exp(logSum / n);
  const arith = sum / n;
  return Math.min(1, geo / arith);
}

/**
 * Normalized Shannon entropy of a chroma vector, 0..1.
 * 0 = all the energy in one pitch class, 1 = all twelve equally lit.
 * A triad measures ~0.55–0.75; noise-derived chroma sits above 0.93.
 */
export function chromaEntropy(chroma) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += chroma[i];
  if (sum <= 0) return 1;
  let h = 0;
  for (let i = 0; i < 12; i++) {
    const p = chroma[i] / sum;
    if (p > 0) h -= p * Math.log(p);
  }
  return h / Math.log(12);
}

/**
 * Correlation between two chroma vectors, −1..1. Used for frame-to-frame
 * stability.
 *
 * ⚠️ MEAN-REMOVED ON PURPOSE — plain cosine similarity does not work here and
 * was tried first. Chroma vectors are all-positive, so two vectors of pure
 * NOISE still score ~0.81 cosine simply by both being roughly uniform; the
 * gate waved noise straight through. Subtracting the mean measures whether the
 * same pitch classes stick out, which is the actual question. Measured after
 * the change: a held chord ~0.99, noise ~0.0, speech ~0.1.
 */
export function chromaSimilarity(a, b) {
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < 12; i++) { ma += a[i]; mb += b[i]; }
  ma /= 12; mb /= 12;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < 12; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den > 0 ? dot / den : 0;
}

/**
 * The gate itself — stateful across frames, pure with respect to audio.
 *
 * Kept out of the render loop and free of DOM references so the whole rejection
 * policy is testable in Node against synthetic noise, which is the only way to
 * know a threshold separates music from clatter rather than merely sounding
 * plausible in a comment.
 *
 * @returns {{ push(frame): verdict, floorDb(): number, reset(): void }}
 *   frame:   { db, flatness, chroma, dtMs }
 *   verdict: { pass, reject, floorDb, stability, entropy, heldMs }
 *     reject is null on pass, otherwise the FIRST gate that failed:
 *     'floor' | 'noisy' | 'unfocused' | 'unstable' | 'settling'
 */
export function makeFrameGate(opts = {}) {
  let o = { ...GATE_DEFAULTS, ...opts };
  let floor = null;
  let prevChroma = null;
  let stable = 0;
  let rejectedMs = 0;

  return {
    push({ db, flatness, chroma, dtMs = 16.7 }) {
      // ⚠️ THE FLOOR IS SEEDED AS SIGNAL, NOT AS FLOOR. Seeding it to the first
      // frame's level was the obvious choice and it is wrong: start the
      // listener while someone is already playing and the floor seeds AT the
      // performance, which then sits below its own threshold and is gated out
      // forever. Assuming the first frame is signal fails safe in the other
      // direction — worst case the gate is briefly too permissive, and the
      // floor corrects downward on the first genuinely quiet frame.
      if (floor === null) floor = db - o.floorMarginDb - 1;

      // The first frame has nothing to compare against. Scoring it 0 would
      // report it as 'unstable', which reads in a UI as "that was noise" when
      // the truth is "no opinion yet". It cannot pass regardless — the
      // stableFrames counter below holds it at 'settling'.
      const stability = prevChroma ? chromaSimilarity(chroma, prevChroma) : 1;
      const entropy = chromaEntropy(chroma);
      prevChroma = Float32Array.from(chroma);

      // Everything EXCEPT the level test, which needs the updated floor.
      let reject = null;
      if (flatness > o.maxFlatness) reject = 'noisy';
      else if (entropy > o.maxEntropy) reject = 'unfocused';
      else if (stability < o.minStability) reject = 'unstable';

      // ⚠️ THE FLOOR ONLY RISES WHILE THE FRAME IS NON-MUSICAL. A plain
      // asymmetric follower still creeps upward during a long sustained note
      // until it swallows the note that raised it — the detector goes deaf part
      // way through anything held. Freezing the rise whenever the frame looks
      // musical means a performance can never raise the bar on itself, while a
      // room that genuinely gets louder still moves the floor. Downward
      // tracking stays instant: a room that goes quiet should be trusted at once.
      if (db < floor) floor = db;
      else if (reject) {
        floor += (db - floor) * (1 - Math.pow(0.5, Math.max(0, dtMs) / o.floorHalfLifeMs));
      }

      if (!reject && db < floor + o.floorMarginDb) reject = 'floor';

      if (reject) {
        stable = 0;
        rejectedMs += dtMs;
      } else {
        stable++;
        rejectedMs = 0;
        if (stable < o.stableFrames) reject = 'settling';
      }

      return {
        pass: reject === null,
        reject,
        floorDb: floor,
        stability,
        entropy,
        flatness,
        heldMs: rejectedMs,
        shouldReset: rejectedMs > o.releaseMs,
      };
    },
    floorDb() { return floor; },
    /** Live threshold tweaks — the bench page drives this from its sliders. */
    setOptions(next) { o = { ...o, ...next }; },
    options() { return { ...o }; },
    reset() { floor = null; prevChroma = null; stable = 0; rejectedMs = 0; },
  };
}

// ── Live mic ────────────────────────────────────────────────────────────────

/** Same availability check as micPitch — HTTPS or localhost required. */
export function chromaAvailable() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Listen to the microphone and report a smoothed chroma vector every frame.
 *
 * Unlike `startMicListening`, this does NOT try to decide when a note started.
 * There are no onsets in a strum you didn't play — the caller gets a continuous
 * picture of what is currently ringing and decides for itself what that means.
 *
 * @param {function} onFrame (frame) => void, every animation frame:
 *   chroma    — smoothed, normalized Float32Array(12), index 0 = C
 *   rawChroma — this frame only, unsmoothed (for meters / debugging)
 *   bass      — sub-`bassMaxHz` chroma, for root and inversion hints
 *   notes     — [{ midi, pc, strength }] WITH register, strongest first. This
 *               is what a fretboard view needs; chroma alone cannot place a
 *               note on a neck because it has folded the octave away.
 *   db        — frame RMS in dBFS
 *   active    — passed the crude absolute floor; there is SOUND here
 *   musical   — passed every gate; this is the flag consumers should read
 *   reject    — null when musical, else which gate said no: 'quiet' | 'floor' |
 *               'noisy' | 'unfocused' | 'unstable' | 'settling'
 *   floorDb, flatness, entropy, stability — the live measurements, so a UI can
 *               show WHY it is refusing to answer instead of just going blank
 * @param {object} opts  overrides for CHROMA_DEFAULTS and GATE_DEFAULTS, plus:
 *   fftSize   — analyser size (default 8192; must be a power of two ≤ 32768)
 * @returns {Promise<{ stop: () => void }>}
 */
export async function startChromaListening(onFrame, opts = {}) {
  let o = { ...CHROMA_DEFAULTS, ...GATE_DEFAULTS, ...opts };

  // Browser DSP is tuned for speech and actively fights us here: noise
  // suppression carves holes in sustained chords and AGC rides the gain up on
  // quiet passages until the room floor clears our gate. All three off, exactly
  // as micPitch.js does it.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  const audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = o.fftSize;
  analyser.smoothingTimeConstant = 0;   // we smooth in chroma space, not bin space
  source.connect(analyser);

  // Chromium quirk (same as micPitch.js): an AnalyserNode may not pull audio
  // unless the graph reaches a destination. Silent gain node, no output.
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;
  analyser.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  const freqData = new Float32Array(analyser.frequencyBinCount);  // dBFS
  const timeData = new Float32Array(analyser.fftSize);
  const mags = new Float32Array(analyser.frequencyBinCount);
  const smoother = makeChromaSmoother({ halfLifeMs: o.smoothHalfLifeMs });
  const gate = makeFrameGate(o);
  const ZERO = new Float32Array(12);

  let running = true;
  let lastT = 0;
  let lastGood = ZERO;
  let lastGoodBass = ZERO;
  let lastGoodNotes = [];

  function loop(t) {
    if (!running) return;
    requestAnimationFrame(loop);
    const dtMs = lastT ? t - lastT : 16.7;
    lastT = t;

    // Gate on time-domain RMS. Cheaper than summing the spectrum and it is the
    // same measurement micPitch.js gates on, so the two modules agree about
    // what "silence" means.
    analyser.getFloatTimeDomainData(timeData);
    let sumSq = 0;
    for (let i = 0; i < timeData.length; i++) sumSq += timeData[i] * timeData[i];
    const rms = Math.sqrt(sumSq / timeData.length);
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;

    if (db < o.gateDb) {
      smoother.reset();
      gate.reset();
      lastGood = ZERO;
      lastGoodBass = ZERO;
      lastGoodNotes = [];
      onFrame({
        chroma: ZERO, rawChroma: ZERO, bass: ZERO, notes: [], db, energy: 0,
        active: false, musical: false, reject: 'quiet',
        floorDb: gate.floorDb(), flatness: 1, entropy: 1, stability: 0,
      });
      return;
    }

    // AnalyserNode reports dBFS; peak picking wants linear magnitude.
    analyser.getFloatFrequencyData(freqData);
    for (let i = 0; i < freqData.length; i++) {
      mags[i] = freqData[i] <= -180 ? 0 : Math.pow(10, freqData[i] / 20);
    }

    const flatness = spectralFlatness(mags, audioCtx.sampleRate, analyser.fftSize, o);
    const { chroma: rawChroma, bass, notes, energy } =
      chromaFromSpectrum(mags, audioCtx.sampleRate, analyser.fftSize, o);
    const verdict = gate.push({ db, flatness, chroma: rawChroma, dtMs });

    // ⚠️ REJECTED FRAMES ARE DROPPED, NOT ZEROED. Zeroing makes the display
    // strobe between an answer and nothing every time a note decays past a
    // threshold — which reads as "broken" even when the detection is fine. A
    // rejected frame simply doesn't update the estimate: the last good read
    // stays on screen, flagged `musical: false`, until either a better frame
    // arrives or `releaseMs` of continuous rejection clears it.
    if (verdict.pass) {
      const chroma = smoother.push(rawChroma, dtMs);
      lastGood = chroma;
      lastGoodBass = bass;
      lastGoodNotes = notes;
    } else if (verdict.shouldReset) {
      smoother.reset();
      lastGood = ZERO;
      lastGoodBass = ZERO;
      lastGoodNotes = [];
    }

    onFrame({
      chroma: lastGood,
      rawChroma,
      bass: lastGoodBass,
      notes: lastGoodNotes,
      db, energy, flatness,
      active: true,
      musical: verdict.pass,
      reject: verdict.reject,
      floorDb: verdict.floorDb,
      entropy: verdict.entropy,
      stability: verdict.stability,
    });
  }

  requestAnimationFrame(loop);

  return {
    /**
     * Retune while listening. Thresholds are room-dependent and the only way to
     * find the right ones is to change them WHILE the room is making the noise
     * you are trying to reject — restarting the stream to try a number loses
     * the adapted noise floor and the thing you were listening to.
     */
    setOptions(next) {
      o = { ...o, ...next };
      gate.setOptions(next);
    },
    options() { return { ...o }; },
    resetGate() { gate.reset(); smoother.reset(); },
    stop() {
      running = false;
      source.disconnect();
      analyser.disconnect();
      silentGain.disconnect();
      stream.getTracks().forEach(tr => tr.stop());
      audioCtx.close().catch(() => {});
    },
  };
}
