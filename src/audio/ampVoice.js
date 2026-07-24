// =============================================================================
// audio/ampVoice.js — 🎛️ THE SPIRIT AMP — shared distorted-guitar note voice
// -----------------------------------------------------------------------------
// The ONE canonical amp chain for melodic notes: two detuned oscillators + sub
// (+ octave-up for FUZZ) → drive gain → waveshaper distortion → tone stack
// (lowpass + highpass + presence mid) → envelope → dry/echo/verb → shared
// master limiter. Extracted from the main file's `playNoteSound` so every
// surface (board melody line, riff-off highway, lobby practice modes) plays
// through the SAME rig — practice sounds like the game because it IS the game.
//
// PURE-ish MODULE — no React, no app state. Callers pass an AudioContext and a
// knob object; per-context resources (master limiter, reverb convolver, IR
// buffer) are cached ON the context so any number of callers share one bus.
//
// Knobs: { drive, tone, echo, verb, voice } — all 0..1 except voice (id).
// Spirit signature tones live here too (SPIRIT_TONES) so non-game surfaces
// can offer "sound like the Monster" without importing the 11k-line main file.
// =============================================================================

// ── Knob defaults + Spirit signature tones ───────────────────────────────────
export const TONE_KNOB_DEFAULTS = { drive: 0.45, tone: 0.35, echo: 0.55, verb: 0.18, voice: 'saw' };

// 🎚️ Each Spirit's out-of-the-box rig (mirrored from the tone panel design).
export const SPIRIT_TONES = {
  cosmic_ronin:      { drive: 0.55, tone: 0.62, echo: 0.40, verb: 0.18, voice: 'saw' },      // bright cutting lead
  intergalactic_0:   { drive: 0.30, tone: 0.42, echo: 0.55, verb: 0.38, voice: 'triangle' }, // mellow cosmic groove
  Metalness_Monster: { drive: 0.82, tone: 0.30, echo: 0.20, verb: 0.14, voice: 'fuzz' },     // heavy fuzz
  Glamarchy:         { drive: 0.45, tone: 0.55, echo: 0.62, verb: 0.42, voice: 'square' },   // glam shimmer
};

// 🎙️ VOICE — oscillator character. Each voice swaps waveforms (and how hard it
// drives) for a genuinely different timbre, cycling order:
export const TONE_VOICE_ORDER = ['saw', 'square', 'triangle', 'sine', 'fuzz'];
export const TONE_VOICES = {
  saw:      { label: 'LEAD',   osc1: 'sawtooth', osc2: 'sawtooth', sub: 'square',   driveMul: 1.0,  octave: false },
  square:   { label: 'BUZZ',   osc1: 'square',   osc2: 'square',   sub: 'square',   driveMul: 0.9,  octave: false },
  triangle: { label: 'MELLOW', osc1: 'triangle', osc2: 'triangle', sub: 'sine',     driveMul: 0.7,  octave: false },
  sine:     { label: 'CLEAN',  osc1: 'sine',     osc2: 'sine',     sub: 'sine',     driveMul: 0.5,  octave: false },
  fuzz:     { label: 'FUZZ',   osc1: 'square',   osc2: 'sawtooth', sub: 'square',   driveMul: 1.5,  octave: true  },
};

// ── Per-context shared resources ─────────────────────────────────────────────
// Cached noise impulse response for the reverb convolver (built once per ctx).
function getReverbImpulse(ctx) {
  if (ctx.__rlswReverbIR && ctx.__rlswReverbIR.sampleRate === ctx.sampleRate) {
    return ctx.__rlswReverbIR;
  }
  const len = Math.floor(ctx.sampleRate * 1.7);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
  }
  ctx.__rlswReverbIR = buf;
  return buf;
}

// SHARED AUDIO BUSES — one master limiter + ONE reverb convolver per context.
// (ConvolverNode is the most expensive WebAudio node; notes SEND to these buses
// instead of building their own.) Key `__rlswBuses` matches the main file's
// original cache so both resolve to the same bus on a shared context.
export function getAmpBuses(ctx) {
  if (!ctx.__rlswBuses) {
    const master = ctx.createDynamicsCompressor();
    master.threshold.value = -16; master.knee.value = 22;
    master.ratio.value = 5; master.attack.value = 0.003; master.release.value = 0.25;
    master.connect(ctx.destination);
    const verbBus = ctx.createConvolver();
    verbBus.buffer = getReverbImpulse(ctx);
    verbBus.connect(master);
    ctx.__rlswBuses = { master, verbBus };
  }
  return ctx.__rlswBuses;
}

// Waveshaper curve for hard clipping distortion
export function makeDistortionCurve(amount = 300) {
  const samples = 256;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// ── playAmpNote — the canonical note voice ───────────────────────────────────
/**
 * Play one note through the Spirit amp chain.
 * @param {AudioContext} ctx
 * @param {number} freq   Frequency in Hz.
 * @param {object} opts   { when, holdTime, fadeTime, volume, knobs }
 *   when     — schedule on the AUDIO clock (sample-accurate; sequence players
 *              pass future times so a stressed render loop can't bunch notes).
 *   knobs    — { drive, tone, echo, verb, voice }; defaults TONE_KNOB_DEFAULTS.
 */
export function playAmpNote(ctx, freq, opts = {}) {
  try {
    if (!ctx || freq == null) return;
    const now = Math.max(ctx.currentTime, opts.when ?? 0);
    const holdTime  = opts.holdTime  ?? 1.1;   // how long it stays loud
    const fadeTime  = opts.fadeTime  ?? 0.8;   // release fade duration
    const volume    = opts.volume    ?? 0.18;
    // attackTime — 8ms default is the pick; ambient beds pass ~1s to SWELL in
    const attackTime = opts.attackTime ?? 0.008;
    const totalTime = holdTime + fadeTime;
    const kn = { ...TONE_KNOB_DEFAULTS, ...(opts.knobs ?? {}) };

    // 🎙️ VOICE — wave character (defaults to the classic saw lead)
    const V = TONE_VOICES[kn.voice] ?? TONE_VOICES.saw;

    // Two detuned oscillators for thickness — waveform set by the VOICE
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = V.osc1;
    osc2.type = V.osc2;
    osc1.frequency.setValueAtTime(freq,         now);
    osc2.frequency.setValueAtTime(freq * 1.008, now); // slight detune

    // Sub oscillator one octave down for body
    const sub = ctx.createOscillator();
    sub.type = V.sub;
    sub.frequency.setValueAtTime(freq / 2, now);

    // Optional octave-UP oscillator — gives FUZZ its searing bite
    let oct = null, octGain = null;
    if (V.octave) {
      oct = ctx.createOscillator(); oct.type = 'square';
      oct.frequency.setValueAtTime(freq * 2, now);
      octGain = ctx.createGain(); octGain.gain.value = 0.16;
      oct.connect(octGain);
    }

    // Mix oscillators
    const oscGain1 = ctx.createGain(); oscGain1.gain.value = 0.5;
    const oscGain2 = ctx.createGain(); oscGain2.gain.value = 0.5;
    const subGain  = ctx.createGain(); subGain.gain.value  = 0.2;
    osc1.connect(oscGain1); osc2.connect(oscGain2); sub.connect(subGain);

    // Pre-distortion gain — DRIVE knob, scaled by the voice (1× clean → ~11× scorching)
    const drive = ctx.createGain(); drive.gain.value = (1 + kn.drive * 10) * V.driveMul;
    oscGain1.connect(drive); oscGain2.connect(drive); subGain.connect(drive);
    if (octGain) octGain.connect(drive);

    // Waveshaper distortion — curve hardness follows DRIVE (wider, gnarlier range)
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(20 + kn.drive * 900 * V.driveMul);
    shaper.oversample = '4x';
    drive.connect(shaper);

    // Tone stack — TONE knob opens the lowpass (1.2kHz dark → 6.5kHz bright)
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1200 + kn.tone * 5300; lp.Q.value = 0.9;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 120;
    shaper.connect(lp); lp.connect(hp);

    // Presence mid boost — a touch more presence as TONE opens up
    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking'; mid.frequency.value = 1800;
    mid.gain.value = 3 + kn.tone * 4; mid.Q.value = 1.2;
    hp.connect(mid);

    // Hotter drive compensation — a gentle backoff; the master limiter below
    // catches the peaks, so DRIVE can roar much harder than before
    const comp = ctx.createGain();
    comp.gain.value = 1 - kn.drive * 0.12;
    mid.connect(comp);

    // 🔊 MASTER LIMITER — shared bus; tames peaks so cranked drive/voices stay
    // punchy. Everything (dry + echo + verb) feeds it.
    const { master, verbBus } = getAmpBuses(ctx);

    // Amp envelope: pick (or slow swell) → hold at volume → slow fade
    const ampEnv = ctx.createGain();
    ampEnv.gain.setValueAtTime(0,              now);
    ampEnv.gain.linearRampToValueAtTime(volume,            now + attackTime); // pick attack / swell
    ampEnv.gain.linearRampToValueAtTime(volume * 0.82,     now + Math.max(0.06, attackTime + 0.05)); // slight settle
    ampEnv.gain.setValueAtTime(volume * 0.82,              now + Math.max(holdTime, attackTime + 0.1)); // hold
    ampEnv.gain.exponentialRampToValueAtTime(0.001,        now + Math.max(totalTime, attackTime + 0.2)); // slow release

    // ECHO knob — slapback delay level + regenerating repeats (lusher range)
    const delayNode  = ctx.createDelay(0.7);
    delayNode.delayTime.value = 0.19;
    const delayGain  = ctx.createGain();
    delayGain.gain.value = kn.echo * 0.68;
    const delayFb    = ctx.createGain();           // feedback — repeats grow with knob
    delayFb.gain.value = Math.min(0.72, kn.echo * 0.7);
    const delayFade  = ctx.createGain();
    delayFade.gain.setValueAtTime(1,  now + 0.19);
    delayFade.gain.exponentialRampToValueAtTime(0.001, now + totalTime + 0.6 + kn.echo * 1.6);

    comp.connect(ampEnv);
    // Dry path
    ampEnv.connect(master);
    // Wet delay path (with feedback loop for repeats)
    if (kn.echo > 0.02) {
      ampEnv.connect(delayNode);
      delayNode.connect(delayFb);
      delayFb.connect(delayNode);
      delayNode.connect(delayGain);
      delayGain.connect(delayFade);
      delayFade.connect(master);
    }
    // VERB knob — send to the SHARED convolver (per-note send level)
    if (kn.verb > 0.02) {
      const revGain = ctx.createGain();
      revGain.gain.value = kn.verb * 0.85;
      ampEnv.connect(revGain);
      revGain.connect(verbBus);
    }

    osc1.start(now); osc2.start(now); sub.start(now);
    if (oct) oct.start(now);
    const tail = 0.35 + kn.echo * 1.6; // let echo repeats ring out
    osc1.stop(now + totalTime + tail);
    osc2.stop(now + totalTime + tail);
    sub.stop(now + totalTime + tail);
    if (oct) oct.stop(now + totalTime + tail);
  } catch (_) { /* audio unavailable — silent fail */ }
}

// 🤘 POWER CHORD — root + fifth through the amp, volumes/holds scaled by grade.
// Mirrors the riff-off's landed-gem sound (main file `riffPressKey` hit path)
// so practice hits SLAM exactly like duel hits.
export function playAmpPowerChord(ctx, freq, grade, knobs) {
  const hold = grade === 'perfect' ? 0.5  : grade === 'good' ? 0.42 : 0.34;
  const vol  = grade === 'perfect' ? 0.22 : grade === 'good' ? 0.18 : 0.14;
  playAmpNote(ctx, freq,       { holdTime: hold, fadeTime: 0.4, volume: vol, knobs });
  if (freq) playAmpNote(ctx, freq * 1.5, { holdTime: hold, fadeTime: 0.4, volume: vol * 0.5, knobs });
}
