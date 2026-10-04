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
import { SHAMISEN, shamisenBuffer } from "./shamisen.js";
export { SHAMISEN };

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
export const TONE_VOICE_ORDER = ['saw', 'square', 'triangle', 'sine', 'fuzz', 'ronin', 'shamisen', 'shamisen_dist', 'katana_shamisen'];

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
// 🪕 THE SHAMISEN THROUGH THE AMP (2026-09-28) — the Ronin's distorted hybrid.
// The KATANA's stages, retuned for a plucked source: a lower tight-cut (the
// shamisen has no low end to spare), no scoop (a shamisen SLIDES — `suri` — and
// the commit styles ask for that on purpose with `bend`), a gentler pick, a
// wider slower vibrato (`yuri`), and barely any bloom.
export const SHAMISEN_LEAD = Object.freeze({
  ...RONIN_LEAD,
  tightHz: 160, punch: 1.15, scoopCents: 0, vibDelay: 0.35, vibRate: 5.2, vibCents: 22, bloom: 0.03,
});
// ⚔️🪕 KATANA × SHAMISEN (Alex, 2026-09-28: *"an option to combine Katana and
// Shamisen sounds into 1"*). BOTH sources at once, through the full KATANA
// chain: the rendered shamisen string gives the note its bachi strike, its
// twang and its sawari buzz; the KATANA's oscillators swell in underneath it and
// SING the note on. The string speaks first, the guitar carries it — a
// crossfade in time, not a static mix.
//   layer    — 0 = all KATANA, 1 = all shamisen (the balance of the held note)
//   oscStart — where the KATANA starts, as a share of its level, at the pick
//   swell    — seconds for the KATANA to swell up to its level
// 🎛️ DIALLED IN BY ALEX on the bench, 2026-09-28: layer 0.95 (the string leads —
// the KATANA sits under it at a tenth of its level), oscStart 1 (so the guitar is
// there from the strike and `swell` has nothing to do; kept for the next dial-in).
export const KATANA_SHAMISEN = Object.freeze({ layer: 0.95, oscStart: 1, swell: 0.42 });

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
  // 🪕 PLUCKED VOICES (audio/shamisen.js). `pluck` swaps the three oscillators for
  // one rendered string; `clean` skips the clipper. osc1/osc2/sub stay only
  // because `playScratchAtom` reads them off any voice. `pluckGain` level-matches
  // a decaying string against a sustained oscillator stack.
  shamisen:      { label: 'SHAMISEN',     short: 'SHAMI', osc1: 'triangle', osc2: 'triangle', sub: 'sine',   driveMul: 0.4, octave: false, pluck: SHAMISEN, clean: true, pluckGain: 2.4 },
  shamisen_dist: { label: 'ONI SHAMISEN', short: 'ONI', osc1: 'sawtooth', osc2: 'sawtooth', sub: 'square', driveMul: 1.1, octave: false, pluck: SHAMISEN, lead: SHAMISEN_LEAD, pluckGain: 1.6 },
  // ⚔️🪕 `layer` = both sources: the string AND the oscillator stack.
  // `short` is what fits the 36px VOICE button; `label` is the full name.
  katana_shamisen: { label: 'KATANA × SHAMISEN', short: 'K×S', osc1: 'sawtooth', osc2: 'sawtooth', sub: 'square', driveMul: 1.2, octave: false, pluck: SHAMISEN, lead: RONIN_LEAD, pluckGain: 1.6, layer: KATANA_SHAMISEN },
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
 *   out / verbOut — optional destinations for the dry+echo path and the reverb
 *              send (default: the shared master and convolver).
 */
export function playAmpNote(ctx, freq, opts = {}) {
  try {
    if (!ctx || freq == null) return;
    const now = Math.max(ctx.currentTime, opts.when ?? 0);
    const holdTime  = opts.holdTime  ?? 1.1;   // how long it stays loud
    const fadeTime  = opts.fadeTime  ?? 0.8;   // release fade duration
    const volume    = opts.volume    ?? 0.18;
    const kn = { ...TONE_KNOB_DEFAULTS, ...(opts.knobs ?? {}) };

    // 🎙️ VOICE — wave character (defaults to the classic saw lead)
    const V = TONE_VOICES[kn.voice] ?? TONE_VOICES.saw;
    // attackTime — 8ms default is the pick; ambient beds pass ~1s to SWELL in.
    // 🪕 A plucked voice's attack is IN the rendered string (the bachi), so the
    // envelope only needs to get out of its way.
    const attackTime = opts.attackTime ?? (V.pluck ? 0.0015 : 0.008);
    const totalTime = holdTime + fadeTime;
    // 🗡️ Lead stages exist only on a voice that declares them.
    const L = V.lead ? { ...V.lead, ...(opts.lead ?? {}) } : null;

    // 🪕 A plucked voice is ONE rendered string instead of the oscillator stack.
    // Everything after the source (drive, tone, envelope, echo, verb) is shared.
    let pluckSrc = null, pluckGain = null;
    let osc1 = null, osc2 = null, sub = null, oscGain1 = null, oscGain2 = null, subGain = null;
    let oct = null, octGain = null;
    // ⚔️🪕 A LAYERED voice (`V.layer`) builds BOTH: the string and, below, the
    // oscillator stack behind a swelling bus (`oscBus`).
    const LY = V.layer ? { ...V.layer, ...(opts.layer ?? {}) } : null;
    let oscBus = null;
    if (V.pluck) {
      pluckSrc = ctx.createBufferSource();
      pluckSrc.buffer = shamisenBuffer(ctx, freq, { ...V.pluck, ...(opts.pluck ?? {}) });
      pluckGain = ctx.createGain(); pluckGain.gain.value = (V.pluckGain ?? 1) * (LY ? Math.min(1, Math.max(0, LY.layer)) * 2 : 1);
      pluckSrc.connect(pluckGain);
    }
    if (!V.pluck || LY) {
    // Two detuned oscillators for thickness — waveform set by the VOICE
    osc1 = ctx.createOscillator();
    osc2 = ctx.createOscillator();
    osc1.type = V.osc1;
    osc2.type = V.osc2;
    osc1.frequency.setValueAtTime(freq,         now);
    osc2.frequency.setValueAtTime(freq * 1.008, now); // slight detune

    // Sub oscillator one octave down for body
    sub = ctx.createOscillator();
    sub.type = V.sub;
    sub.frequency.setValueAtTime(freq / 2, now);

    // Optional octave-UP oscillator — gives FUZZ its searing bite
    if (V.octave) {
      oct = ctx.createOscillator(); oct.type = 'square';
      oct.frequency.setValueAtTime(freq * 2, now);
      octGain = ctx.createGain(); octGain.gain.value = 0.16;
      oct.connect(octGain);
    }

    // Mix oscillators
    oscGain1 = ctx.createGain(); oscGain1.gain.value = 0.5;
    oscGain2 = ctx.createGain(); oscGain2.gain.value = 0.5;
    subGain  = ctx.createGain(); subGain.gain.value  = 0.2;
    osc1.connect(oscGain1); osc2.connect(oscGain2); sub.connect(subGain);
    }

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
    if (pluckGain) pluckGain.connect(preDrive);
    if (osc1 && LY) {
      // The KATANA swells in under the string: from `oscStart` of its level at
      // the pick to its full share (1 − layer, doubled so 0.5 is an even blend).
      const level = Math.min(1, Math.max(0, 1 - LY.layer)) * 2;
      oscBus = ctx.createGain();
      oscBus.gain.setValueAtTime(level * LY.oscStart, now);
      oscBus.gain.linearRampToValueAtTime(level, now + Math.max(0.005, LY.swell));
      oscGain1.connect(oscBus); oscGain2.connect(oscBus); subGain.connect(oscBus);
      oscBus.connect(preDrive);
    } else if (osc1) { oscGain1.connect(preDrive); oscGain2.connect(preDrive); subGain.connect(preDrive); }
    if (octGain) octGain.connect(preDrive);

    // Waveshaper distortion — curve hardness follows DRIVE (wider, gnarlier range).
    // 🪕 A `clean` voice has no clipper at all: the drive gain feeds the tone stack.
    let shaper = null;
    if (!V.clean) {
      shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(20 + kn.drive * 900 * V.driveMul);
      shaper.oversample = '4x';
      drive.connect(shaper);
    }

    // 🗡️ KATANA: second, softer clipping stage for sustain.
    let clipOut = shaper ?? drive;
    if (L && L.stage2 > 0 && shaper) {
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
    const pitched = [pluckSrc, osc1, osc2, sub].filter(Boolean);
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
    // 🎭 `out` / `verbOut` let a caller put a phrase behind its OWN gain (the
    // Spirit-select sting, so a fresh pick can cut the last one off). Unset →
    // the shared buses, exactly as before; no extra node either way.
    const dryOut = opts.out ?? master, verbIn = opts.verbOut ?? verbBus;

    // Amp envelope: pick (or slow swell) → hold at volume → slow fade
    const ampEnv = ctx.createGain();
    // 🗡️ KATANA picks harder (overshoot) and holds higher (compressed sustain).
    const peak   = volume * (L ? L.punch : 1);
    // 🪕 A plucked string decays by itself — the envelope holds, it does not sag.
    const held   = volume * (L ? L.sustain : V.pluck ? 1 : 0.82);
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
    ampEnv.connect(dryOut);
    // Wet delay path (with feedback loop for repeats)
    if (kn.echo > 0.02) {
      ampEnv.connect(delayNode);
      delayNode.connect(delayFb);
      delayFb.connect(delayNode);
      delayNode.connect(delayGain);
      delayGain.connect(delayFade);
      delayFade.connect(dryOut);
    }
    // VERB knob — send to the SHARED convolver (per-note send level)
    let revGain = null;
    if (kn.verb > 0.02) {
      revGain = ctx.createGain();
      revGain.gain.value = kn.verb * 0.85;
      ampEnv.connect(revGain);
      revGain.connect(verbIn);
    }

    const tail = 0.35 + kn.echo * 1.6; // let echo repeats ring out
    if (pluckSrc) { pluckSrc.start(now); pluckSrc.stop(now + totalTime + tail); }
    if (osc1) {
    osc1.start(now); osc2.start(now); sub.start(now);
    if (oct) oct.start(now);
    osc1.stop(now + totalTime + tail);
    osc2.stop(now + totalTime + tail);
    sub.stop(now + totalTime + tail);
    }
    if (oct) oct.stop(now + totalTime + tail);
    if (lfo) { lfo.start(now); lfo.stop(now + totalTime + tail); }
    if (bloomOsc) { bloomOsc.start(now); bloomOsc.stop(now + totalTime + tail); }

    // 🧹 VOICE TEARDOWN — unplug the note once it has finished sounding.
    // ⚠️ STOPPING THE OSCILLATORS IS NOT ENOUGH, and that was the melody
    // "cut off part way through" bug (Alex's playtest, 2026-09-30). Chrome
    // keeps every BiquadFilter "ringing" for its computed tail — capped at
    // 30 s — and the tone stack, the KATANA's hump/fizz and the waveshapers
    // behind them keep being processed, silently, for that whole time. Measured
    // in Chromium: 60 KATANA notes (one Ronin commit, give or take) burned ~0.8
    // of a CPU core for ~25 s AFTER the last note ended. Two commits and a
    // barrage later the audio thread cannot keep up and the next phrase drops
    // out mid-line. Disconnecting the graph drops it out of the render at once.
    // 🎯 SOUND-NEUTRAL: the sources stop exactly where they always did, the
    // front of the chain is cut only once they have stopped (behind an
    // envelope already at −60 dB), and the echo/reverb sends are cut only
    // after the echo's own fade has run out. `audio/voiceTeardownCheck.mjs`
    // (`test:voiceleak`) holds the line.
    const ender = osc1 ?? pluckSrc;
    const echoEnd = now + totalTime + 0.6 + kn.echo * 1.6;
    if (ender) ender.onended = () => {
      try { comp.disconnect(); } catch { /* already gone */ }
      const wait = Math.max(0, echoEnd - ctx.currentTime) * 1000 + 120;
      setTimeout(() => {
        for (const n of [ampEnv, delayNode, delayFb, delayGain, delayFade, revGain]) {
          try { n?.disconnect(); } catch { /* already gone */ }
        }
      }, wait);
    };
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
