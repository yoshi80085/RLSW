// =============================================================================
// audio/micPitch.js — MIC PITCH DETECTION — real guitar input
// -----------------------------------------------------------------------------
// Uses Web Audio API + YIN-inspired autocorrelation to detect pitched notes
// from the microphone. Designed for guitar: frequency range 75–700 Hz
// (E2 to E5+), with gate + onset detection to fire one callback per pluck
// rather than spamming continuously.
//
// SENSITIVITY (tuned 2026-07): the early "make the mic work at all" pass left
// every threshold wide open, so the detector answered footsteps, speech and
// room tone. It now takes four agreeing filters to fire a note — RMS gate with
// hysteresis, YIN confidence, multi-frame pitch stability, and a debounce.
// See MIC_DEFAULTS / startMicListening opts if it ever needs re-tuning.
//
// PURE MODULE — no React, no app state. Returns a handle with stop().
// Output aligns with guitarMap.js: `key` (riff key letter) and `pcAbsolute`
// (C-based pitch class 0–11) so both FretboardRecon and DiscordCoach can
// consume detected notes without conversion.
//
// Usage:
//   const mic = await startMicListening(({ key, pcAbsolute, freq }) => {
//     // key: 'a','A','b','c','C','d','D','e','f','F','g','G' (same as cellKey)
//     // pcAbsolute: 0=C, 1=C#, ..., 11=B (same as cellPcAbsolute)
//   });
//   mic.stop();  // cleanup: releases mic, closes AudioContext
// =============================================================================

// ── Pitch-to-note mapping (aligned with guitarMap.js) ──────────────────────
const PC_KEYS = ['a', 'A', 'b', 'c', 'C', 'd', 'D', 'e', 'f', 'F', 'g', 'G'];
const DEGREE0_PITCH = 5;  // open A string = pitch 5 in guitarMap coordinate space
const E2_HZ = 82.4069;    // low E string open

function freqToPitch(freq) {
  return Math.round(12 * Math.log2(freq / E2_HZ));
}

function pitchToKey(pitch) {
  return PC_KEYS[(((pitch - DEGREE0_PITCH) % 12) + 12) % 12];
}

function pitchToPcAbsolute(pitch) {
  // STRING_OPENS[0] = 0 = E2, and E = pc 4 in C-based system
  return ((pitch + 4) % 12 + 12) % 12;
}

// ── YIN pitch detection ────────────────────────────────────────────────────
// Simplified YIN: difference function -> cumulative mean normalization ->
// absolute threshold -> parabolic interpolation. Robust against harmonics,
// which matters for guitar's strong overtone series.
function detectPitch(buffer, sampleRate) {
  const SIZE = buffer.length;
  const HALF = SIZE >> 1;

  // Period bounds for guitar range (75 Hz – 700 Hz)
  const minTau = Math.floor(sampleRate / 700);
  const maxTau = Math.min(HALF, Math.ceil(sampleRate / 75));

  // Step 1: Difference function
  const d = new Float32Array(maxTau + 1);
  for (let tau = minTau; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < HALF; i++) {
      const diff = buffer[i] - buffer[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }

  // Step 2: Cumulative mean normalized difference
  const dn = new Float32Array(maxTau + 1);
  dn[0] = 1;
  let runSum = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    runSum += d[tau];
    dn[tau] = runSum > 0 ? d[tau] * tau / runSum : 1;
  }

  // Step 3: Absolute threshold — find first dip below threshold
  // 0.14 demands a genuinely periodic signal. The old 0.25 was loose enough
  // that room tone, keyboard clatter and speech formants cleared the bar, which
  // is why the mic fired at everything. A plucked string sits well under this.
  const threshold = 0.14;
  let tauEst = -1;
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (dn[tau] < threshold) {
      while (tau + 1 <= maxTau && dn[tau + 1] < dn[tau]) tau++;
      tauEst = tau;
      break;
    }
  }

  if (tauEst === -1) {
    // Fallback: global minimum in range (only accept if reasonably periodic)
    let minVal = Infinity;
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (dn[tau] < minVal) { minVal = dn[tau]; tauEst = tau; }
    }
    if (minVal > 0.35) return { freq: -1, confidence: 0 };
  }

  // Step 4: Parabolic interpolation for sub-sample accuracy
  let betterTau = tauEst;
  if (tauEst > minTau && tauEst < maxTau) {
    const s0 = dn[tauEst - 1], s1 = dn[tauEst], s2 = dn[tauEst + 1];
    const denom = 2 * s1 - s2 - s0;
    if (Math.abs(denom) > 1e-10) {
      betterTau = tauEst + (s2 - s0) / (2 * denom);
    }
  }

  return {
    freq: sampleRate / betterTau,
    confidence: 1 - (dn[tauEst] || 0),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Default sensitivity settings — exported so UI meters can draw the gate. */
export const MIC_DEFAULTS = {
  gateDb: -38,
  minConfidence: 0.90,
  minGapMs: 160,
  stableFrames: 3,
};

/** Check if getUserMedia is available (HTTPS or localhost required). */
export function micAvailable() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Start listening to the microphone for pitched notes.
 *
 * Sensitivity note: these defaults are deliberately CONSERVATIVE. The mic
 * should answer a played note, not a chair scrape. Four independent filters
 * have to agree before a note fires:
 *   1. the RMS gate    — is it loud enough to be a deliberate pluck?
 *   2. the YIN confidence — is it actually periodic, or is it noise?
 *   3. pitch stability — did the same note hold for a few frames?
 *   4. the debounce    — has enough time passed since the last note?
 * Loosen `gateDb` toward -50 only if a quiet acoustic is being missed.
 *
 * @param {function} onNote   ({ key, pcAbsolute, freq, confidence }) => void
 * @param {object}   opts
 *   gateDb        — dBFS gate threshold to OPEN the gate (default -38)
 *   releaseDb     — dBFS level the signal must fall below to re-arm the onset
 *                   detector. Hysteresis: prevents one note retriggering as it
 *                   decays. (default gateDb - 8)
 *   minConfidence — YIN confidence floor (default 0.90)
 *   minGapMs      — debounce between callbacks (default 160)
 *   stableFrames  — consecutive frames that must agree on the pitch before it
 *                   counts as a note (default 3, ~50 ms at 60 fps)
 *   onLevel       — optional ({ db, state }) => void, called every frame.
 *                   state: 'silent' | 'detecting' | 'low-confidence' | 'note'
 *                   Use this to drive a signal meter in the UI.
 * @returns {Promise<{ stop: () => void }>}
 * @throws  If getUserMedia is denied or unavailable.
 */
export async function startMicListening(onNote, opts = {}) {
  const {
    gateDb        = MIC_DEFAULTS.gateDb,        // dBFS — a deliberate pluck, not room tone
    minConfidence = MIC_DEFAULTS.minConfidence, // YIN floor — noise scores well below this
    minGapMs      = MIC_DEFAULTS.minGapMs,      // minimum ms between callbacks (debounce)
    stableFrames  = MIC_DEFAULTS.stableFrames,  // frames the same pitch must hold
    onLevel       = null,  // optional signal level callback for UI meters
  } = opts;
  const releaseDb = opts.releaseDb ?? (gateDb - 8);  // hysteresis floor

  // Browser DSP would otherwise ride the gain up on a quiet room until the
  // noise floor clears our gate — exactly the "picks up everything" symptom.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation:  false,
      noiseSuppression:  false,
      autoGainControl:   false,
    },
  });

  const audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  const source   = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  // Chromium quirk: AnalyserNode may not process audio unless the graph has
  // a destination. Route through a silent gain node so mic data flows without
  // outputting any sound to speakers.
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0;
  analyser.connect(silentGain);
  silentGain.connect(audioCtx.destination);

  const buffer = new Float32Array(analyser.fftSize);
  let running      = true;
  let lastKey      = null;
  let lastCallTime = 0;
  let wasSilent    = true;
  // Pitch-stability tracker: a note only counts once the SAME pitch has held
  // for `stableFrames` frames in a row. Transients (a knock, a door, a
  // consonant) resolve to a different pitch every frame and never survive it.
  let candKey      = null;
  let candFrames   = 0;

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);

    analyser.getFloatTimeDomainData(buffer);

    // ── Gate: RMS level check (with hysteresis) ──
    let sumSq = 0;
    for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i];
    const rms = Math.sqrt(sumSq / buffer.length);
    const db  = rms > 0 ? 20 * Math.log10(rms) : -100;

    // Below the RELEASE floor the gate shuts and the onset detector re-arms.
    // Between release and gate is the dead band — a decaying note lives here,
    // and it must not read as a fresh pluck.
    if (db < releaseDb) {
      wasSilent  = true;
      candKey    = null;
      candFrames = 0;
      if (onLevel) onLevel({ db, state: 'silent' });
      return;
    }
    if (db < gateDb) {
      if (onLevel) onLevel({ db, state: 'silent' });
      return;
    }

    // ── Detect pitch ──
    const { freq, confidence } = detectPitch(buffer, audioCtx.sampleRate);
    if (freq <= 0) {
      candKey = null; candFrames = 0;
      if (onLevel) onLevel({ db, state: 'detecting' });
      return;
    }
    if (confidence < minConfidence) {
      candKey = null; candFrames = 0;
      if (onLevel) onLevel({ db, state: 'low-confidence', freq, confidence });
      return;
    }

    // ── Map to game's note system ──
    const pitch      = freqToPitch(freq);
    const key        = pitchToKey(pitch);
    const pcAbsolute = pitchToPcAbsolute(pitch);

    // ── Stability: the same pitch has to hold for a few frames ──
    if (key === candKey) candFrames++;
    else { candKey = key; candFrames = 1; }
    if (candFrames < stableFrames) {
      if (onLevel) onLevel({ db, state: 'detecting', freq, confidence });
      return;
    }

    // ── Onset filter: fire on silence→sound or pitch change ──
    const now           = performance.now();
    const isNewOnset    = wasSilent;
    const isPitchChange = key !== lastKey;
    const hasMinGap     = now - lastCallTime >= minGapMs;

    if ((isNewOnset || isPitchChange) && hasMinGap) {
      lastKey      = key;
      lastCallTime = now;
      wasSilent    = false;
      if (onLevel) onLevel({ db, state: 'note', freq, confidence });
      onNote({ key, pcAbsolute, freq, confidence });
    } else {
      wasSilent = false;
      if (onLevel) onLevel({ db, state: 'note', freq, confidence });
    }
  }

  loop();

  return {
    stop() {
      running = false;
      source.disconnect();
      analyser.disconnect();
      silentGain.disconnect();
      stream.getTracks().forEach(t => t.stop());
      audioCtx.close().catch(() => {});
    },
  };
}
