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
import { getLevel, onMixChange } from "./mixer.js";

export const TONE_KNOB_DEFAULTS = { drive: 0.45, tone: 0.35, echo: 0.55, verb: 0.18, voice: 'saw' };

// 🎚️ Each Spirit's out-of-the-box rig (mirrored from the tone panel design).
export const SPIRIT_TONES = {
  cosmic_ronin:      { drive: 0.72, tone: 0.58, echo: 0.34, verb: 0.24, voice: 'ronin' },    // 🗡️ singing katana lead (was saw @ 0.55 drive until 2026-09-16)
  intergalactic_0:   { drive: 0.30, tone: 0.42, echo: 0.55, verb: 0.38, voice: 'triangle' }, // mellow cosmic groove
  Metalness_Monster: { drive: 0.82, tone: 0.30, echo: 0.20, verb: 0.14, voice: 'fuzz' },     // heavy fuzz
  Glamarchy:         { drive: 0.45, tone: 0.55, echo: 0.62, verb: 0.42, voice: 'square' },   // glam shimmer
};

// 🎙️ VOICE — oscillator character. Each voice swaps waveforms (and how hard it
// drives) for a genuinely different timbre, cycling order:
export const TONE_VOICE_ORDER = ['saw', 'square', 'triangle', 'sine', 'fuzz', 'ronin'];

// 🗡️ RONIN_LEAD — the extra stages behind the Ronin's KATANA voice (2026-09-16).
// Alex: *"more drive and punch… I want his guitar to sing in a distorted
// magnificence."* Every number here is a dial-in lever
// (`.scratch/ronin-tone-preview.html`). ⚠️ These stages run ONLY for a voice that
// carries `lead` — the other five voices build exactly the graph they always did,
// and `roninToneCheck` §4 counts the nodes to hold that line.
export const RONIN_LEAD = Object.freeze({
  // PUNCH — tighten the low end BEFORE the clipper, so the palm-heavy bottom
  // stops blooming into mud and every pick lands as a hit.
  tightHz:    240,    // pre-drive highpass
  punch:      1.35,   // pick overshoot above the note's volume
  punchTime:  0.07,   // s — how fast the overshoot settles to the hold
  pickBright: 1.8,    // the lowpass opens this much on the pick, then closes to TONE
  // SING — a mid hump into the clipper (the classic lead-boost shape) and a
  // compressed hold, so the note keeps its voice instead of dying after the pick.
  humpHz:     820,
  humpDb:     9,
  humpQ:      0.9,
  sustain:    0.92,   // held level after the pick (stock voices settle to 0.82)
  // DRIVE — a second, softer clipping stage after the first. More harmonics, more
  // sustain, and the cab shelf below keeps the double clip from fizzing.
  stage2:     0.55,   // 0 = single stage
  fizzHz:     5600,
  fizzDb:     -9,
  outTrim:    0.95,   // level back-off for the hotter chain
  // ⚠️ 0.95 IS A LEVEL MATCH, NOT A TASTE CALL. Rendered offline at C4 the KATANA's
  // held RMS is 0.133 against the old saw rig's 0.132, so a before/after compares
  // CHARACTER — louder always wins a quick A/B, and 0.78 made the new rig lose
  // 15% of its level while claiming "more drive".
  // 🎌 THE JAPANESE INFLECTION — every note slides up into pitch, and a held
  // note grows a slow, wide vibrato only after it has spoken.
  scoopCents: -40,
  scoopTime:  0.06,
  vibDelay:   0.30,   // s — notes shorter than this never wobble (shred stays straight)
  vibRamp:    0.40,
  vibRate:    5.6,    // Hz
  vibCents:   16,
  // MAGNIFICENCE — on long holds an octave harmonic swells in under the clipper,
  // the way a cranked amp blooms into feedback.
  bloom:      0.07,
  bloomTime:  0.9,
});
export const TONE_VOICES = {
  saw:      { label: 'LEAD',   osc1: 'sawtooth', osc2: 'sawtooth', sub: 'square',   driveMul: 1.0,  octave: false },
  square:   { label: 'BUZZ',   osc1: 'square',   osc2: 'square',   sub: 'square',   driveMul: 0.9,  octave: false },
  triangle: { label: 'MELLOW', osc1: 'triangle', osc2: 'triangle', sub: 'sine',     driveMul: 0.7,  octave: false },
  sine:     { label: 'CLEAN',  osc1: 'sine',     osc2: 'sine',     sub: 'sine',     driveMul: 0.5,  octave: false },
  fuzz:     { label: 'FUZZ',   osc1: 'square',   osc2: 'sawtooth', sub: 'square',   driveMul: 1.5,  octave: true  },
  // ⚠️ `playScratchAtom` in the main file reads osc1/osc2/sub/driveMul/octave off
  // any voice and ignores `lead` — so the KATANA still scratches, just without
  // its extra stages.
  ronin:    { label: 'KATANA', osc1: 'sawtooth', osc2: 'sawtooth', sub: 'square',   driveMul: 1.2,  octave: false, lead: RONIN_LEAD },
};

// Soft, symmetric tanh curve — the KATANA's second clipping stage. Rounder than
// `makeDistortionCurve`, so stacking it adds sustain rather than more rasp.
export function makeSoftClipCurve(amount = 3) {
  const samples = 1024;
  const curve = new Float32Array(samples);
  const norm = Math.tanh(amount);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = Math.tanh(amount * x) / norm;
  }
  return curve;
}

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

    // 🎚️ THE NOTES FADER LIVES HERE, and it is the last thing before the
    // speakers on purpose — AFTER the compressor, not before it. Putting a
    // player-controlled gain in FRONT of a compressor makes the compressor undo
    // it: turn the guitar down and the limiter simply stops limiting, so the
    // first two thirds of the fader would do almost nothing.
    const notesGain = ctx.createGain();
    notesGain.gain.value = getLevel('notes');
    master.connect(notesGain);
    notesGain.connect(ctx.destination);

    const verbBus = ctx.createConvolver();
    verbBus.buffer = getReverbImpulse(ctx);
    verbBus.connect(master);

    // The fader follows the mixer for as long as this context lives. Ramped,
    // not set: a step change on a sounding note is an audible click.
    onMixChange(mix => {
      try { notesGain.gain.setTargetAtTime(mix.notes, ctx.currentTime, 0.02); }
      catch { notesGain.gain.value = mix.notes; }
    });

    ctx.__rlswBuses = { master, verbBus, notesGain };
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
 *   bend     — semitones the note STARTS away from pitch and bends into (e.g. -2
 *              is a whole-step bend up). Any voice. `bendTime` defaults 0.18 s.
 *   lead     — partial RONIN_LEAD override (dial-in preview only); applies only
 *              to a voice that already carries `lead`.
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
    // 🗡️ Lead stages exist only on a voice that declares them.
    const L = V.lead ? { ...V.lead, ...(opts.lead ?? {}) } : null;

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
    // 🗡️ KATANA: tight highpass → mid hump → drive. Everyone else mixes straight in.
    let preDrive = drive;
    if (L) {
      const tight = ctx.createBiquadFilter();
      tight.type = 'highpass'; tight.frequency.value = L.tightHz; tight.Q.value = 0.7;
      const hump = ctx.createBiquadFilter();
      hump.type = 'peaking'; hump.frequency.value = L.humpHz;
      hump.gain.value = L.humpDb; hump.Q.value = L.humpQ;
      tight.connect(hump); hump.connect(drive);
      preDrive = tight;
    }
    oscGain1.connect(preDrive); oscGain2.connect(preDrive); subGain.connect(preDrive);
    if (octGain) octGain.connect(preDrive);

    // Waveshaper distortion — curve hardness follows DRIVE (wider, gnarlier range)
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(20 + kn.drive * 900 * V.driveMul);
    shaper.oversample = '4x';
    drive.connect(shaper);

    // 🗡️ KATANA: second, softer clipping stage for sustain.
    let clipOut = shaper;
    if (L && L.stage2 > 0) {
      const s2gain = ctx.createGain(); s2gain.gain.value = 1 + L.stage2 * 6;
      const shaper2 = ctx.createWaveShaper();
      shaper2.curve = makeSoftClipCurve(1 + L.stage2 * 3);
      shaper2.oversample = '4x';
      shaper.connect(s2gain); s2gain.connect(shaper2);
      clipOut = shaper2;
    }

    // Tone stack — TONE knob opens the lowpass (1.2kHz dark → 6.5kHz bright)
    const lp = ctx.createBiquadFilter();
    const lpHz = 1200 + kn.tone * 5300;
    lp.type = 'lowpass'; lp.frequency.value = lpHz; lp.Q.value = 0.9;
    if (L) {
      // PUNCH: the filter flares open on the pick, then settles to the TONE knob.
      const nyq = ctx.sampleRate / 2 - 100;
      lp.frequency.setValueAtTime(Math.min(nyq, lpHz * L.pickBright), now);
      lp.frequency.exponentialRampToValueAtTime(lpHz, now + attackTime + L.punchTime * 1.6);
    }
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 120;
    clipOut.connect(lp); lp.connect(hp);

    // Presence mid boost — a touch more presence as TONE opens up
    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking'; mid.frequency.value = 1800;
    mid.gain.value = 3 + kn.tone * 4; mid.Q.value = 1.2;
    hp.connect(mid);

    // Hotter drive compensation — a gentle backoff; the master limiter below
    // catches the peaks, so DRIVE can roar much harder than before
    const comp = ctx.createGain();
    comp.gain.value = (1 - kn.drive * 0.12) * (L ? L.outTrim : 1);
    if (L) {
      // 🗡️ KATANA cab shelf — takes the fizz off the double clip.
      const fizz = ctx.createBiquadFilter();
      fizz.type = 'highshelf'; fizz.frequency.value = L.fizzHz; fizz.gain.value = L.fizzDb;
      mid.connect(fizz); fizz.connect(comp);
    } else {
      mid.connect(comp);
    }

    // ── Pitch motion: bend (any voice, opt-in) · scoop + vibrato + bloom (KATANA) ─
    const pitched = [osc1, osc2, sub];
    let lfo = null, bloomOsc = null;
    if (L && L.bloom > 0 && holdTime >= 0.5) {
      bloomOsc = ctx.createOscillator(); bloomOsc.type = 'sine';
      bloomOsc.frequency.setValueAtTime(freq * 2, now);
      const bloomGain = ctx.createGain();
      bloomGain.gain.setValueAtTime(0, now);
      bloomGain.gain.linearRampToValueAtTime(L.bloom, now + Math.min(holdTime, L.bloomTime));
      bloomOsc.connect(bloomGain); bloomGain.connect(preDrive);
      pitched.push(bloomOsc);
    }
    const bendCents = Number.isFinite(opts.bend) ? opts.bend * 100 : 0;
    const startCents = bendCents || (L ? L.scoopCents : 0);
    if (startCents) {
      const glide = bendCents ? (opts.bendTime ?? 0.18) : L.scoopTime;
      for (const o of pitched) {
        o.detune.setValueAtTime(startCents, now);
        o.detune.linearRampToValueAtTime(0, now + glide);
      }
    }
    if (L && holdTime >= L.vibDelay && L.vibCents > 0) {
      lfo = ctx.createOscillator(); lfo.type = 'sine';
      lfo.frequency.value = L.vibRate;
      const depth = ctx.createGain();
      const vibAt = now + L.vibDelay + (bendCents ? (opts.bendTime ?? 0.18) : 0);
      depth.gain.setValueAtTime(0, now);
      depth.gain.setValueAtTime(0, vibAt);
      depth.gain.linearRampToValueAtTime(L.vibCents, vibAt + L.vibRamp);
      lfo.connect(depth);
      for (const o of pitched) depth.connect(o.detune);
    }

    // 🔊 MASTER LIMITER — shared bus; tames peaks so cranked drive/voices stay
    // punchy. Everything (dry + echo + verb) feeds it.
    const { master, verbBus } = getAmpBuses(ctx);

    // Amp envelope: pick (or slow swell) → hold at volume → slow fade
    const ampEnv = ctx.createGain();
    // 🗡️ KATANA picks harder (overshoot) and holds higher (compressed sustain).
    const peak   = volume * (L ? L.punch : 1);
    const held   = volume * (L ? L.sustain : 0.82);
    const settle = L ? attackTime + L.punchTime : Math.max(0.06, attackTime + 0.05);
    ampEnv.gain.setValueAtTime(0,              now);
    ampEnv.gain.linearRampToValueAtTime(peak,              now + attackTime); // pick attack / swell
    ampEnv.gain.linearRampToValueAtTime(held,              now + settle); // settle
    ampEnv.gain.setValueAtTime(held,                       now + Math.max(holdTime, L ? settle + 0.05 : attackTime + 0.1)); // hold
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
    if (lfo) { lfo.start(now); lfo.stop(now + totalTime + tail); }
    if (bloomOsc) { bloomOsc.start(now); bloomOsc.stop(now + totalTime + tail); }
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
