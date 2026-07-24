// =============================================================================
// audio/micPitch.js — MIC PITCH DETECTION — real guitar input
// -----------------------------------------------------------------------------
// Uses Web Audio API + YIN-inspired autocorrelation to detect pitched notes
// from the microphone. Designed for guitar: frequency range 75–700 Hz
// (E2 to E5+), with gate + onset detection to fire one callback per pluck
// rather than spamming continuously.
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
  const threshold = 0.15;
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
    if (minVal > 0.4) return { freq: -1, confidence: 0 };
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

/** Check if getUserMedia is available (HTTPS or localhost required). */
export function micAvailable() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Start listening to the microphone for pitched notes.
 * @param {function} onNote  ({ key, pcAbsolute, freq, confidence }) => void
 * @param {object}   opts    { gateDb, minConfidence, minGapMs }
 * @returns {Promise<{ stop: () => void }>}
 * @throws  If getUserMedia is denied or unavailable.
 */
export async function startMicListening(onNote, opts = {}) {
  const {
    gateDb        = -38,   // dBFS — ignore signals quieter than this
    minConfidence = 0.82,  // YIN confidence floor
    minGapMs      = 100,   // minimum ms between callbacks (debounce)
  } = opts;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,  // raw signal — no voice processing
      noiseSuppression: false,
      autoGainControl:  false,
    },
  });

  const audioCtx = new AudioContext();
  const source   = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;  // ~46ms at 44.1 kHz — enough for 2 cycles of low E
  source.connect(analyser);

  const buffer = new Float32Array(analyser.fftSize);
  let running      = true;
  let lastKey      = null;
  let lastCallTime = 0;
  let wasSilent    = true;

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);

    analyser.getFloatTimeDomainData(buffer);

    // ── Gate: RMS level check ──
    let sumSq = 0;
    for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i];
    const rms = Math.sqrt(sumSq / buffer.length);
    const db  = rms > 0 ? 20 * Math.log10(rms) : -100;

    if (db < gateDb) {
      wasSilent = true;
      return;
    }

    // ── Detect pitch ──
    const { freq, confidence } = detectPitch(buffer, audioCtx.sampleRate);
    if (freq <= 0 || confidence < minConfidence) return;

    // ── Map to game's note system ──
    const pitch      = freqToPitch(freq);
    const key        = pitchToKey(pitch);
    const pcAbsolute = pitchToPcAbsolute(pitch);

    // ── Onset filter: fire on silence→sound or pitch change ──
    const now           = performance.now();
    const isNewOnset    = wasSilent;
    const isPitchChange = key !== lastKey;
    const hasMinGap     = now - lastCallTime >= minGapMs;

    if ((isNewOnset || isPitchChange) && hasMinGap) {
      lastKey      = key;
      lastCallTime = now;
      wasSilent    = false;
      onNote({ key, pcAbsolute, freq, confidence });
    } else {
      wasSilent = false;
    }
  }

  loop();

  return {
    stop() {
      running = false;
      source.disconnect();
      stream.getTracks().forEach(t => t.stop());
      audioCtx.close().catch(() => {});
    },
  };
}
