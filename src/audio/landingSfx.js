// ─── 🔔 LANDING SOUNDS — what a standee's step sounds like when it lands ──────
// Alex, 2026-09-30: "I'm thinking perhaps it make a crystal/glass like sound
// when the standees move to a space." Then: "how a heavy weighted object might
// sound - a more dull sound like a thump/thud as it hits something like a glass
// surface … as well as something that might sound 'mysterious' or space-y".
// ⭐ HIS PICK (the dial-in, `board/standeeMotion.js` STANDEE_MOVE): `slab` —
// a stone piece set down on a glass slab — with a .45 weight under it, a touch
// of echo (.06), two sparkle pings, and a heavy rumble while it travels.
// Every other voice stays here because the preview page still offers them.
//
// ⭐ ALL SYNTHESISED, NO SAMPLES — the same doctrine as `riffSfx.js` and
// `unlockSfx.js`: a handful of sine partials with their own decays is what a
// struck piece of glass IS, so it costs nothing to ship and it can be tuned to
// any pitch the game hands it.
//
// 📌 The partial ratios are the physics, not taste:
//   · a free bar / chime rings at 1 : 2.756 : 5.404 : 8.933;
//   · a wine glass at roughly 1 : 2.32 : 4.25, each mode a slowly beating pair;
//   · a singing bowl at ~1 : 2.71 : 4.8 with a slow beat.
//
// 🎚️ ON THE SFX FADER. Everything goes through `getRiffAudio()` and
// `getSfxBus(ctx)` (riffSfx.js), so ☰ Audio's SFX slider reaches it. The room
// (a convolver) and the space echo (a feedback delay) are ONE bus per context,
// cached on the context like `getSfxBus` — ⚠️ a second copy per arena mount
// would leave a feedback loop running on the audio thread for every remount.
//
// 🧹 TEARDOWN (`SEQUENCING` 45-playtest: "stop() is not cleanup"). Every
// landing's own nodes are disconnected once its tail has run out, so no filter
// keeps ringing silence on the audio thread. `standeeMoveCheck` §4 holds it.
import { getRiffAudio, getSfxBus } from './riffSfx.js';

// ⭐ THREE FAMILIES (Alex, 2026-09-30, second pass): the original GLASS set;
// WEIGHTED — "how a heavy weighted object might sound - a more dull sound like
// a thump/thud as it hits something like a glass surface"; and SPACE —
// "something that might sound 'mysterious' or space-y".
export const VOICE_FAMILIES = Object.freeze([
  ['Glass',    ['clink', 'ping', 'celesta', 'chime', 'bowl', 'shard']],
  ['Weighted', ['thud', 'knock', 'muffled', 'slab']],
  ['Space',    ['bloom', 'sonar', 'ghost', 'theremin']],
]);
export const LANDING_VOICES = Object.freeze([...VOICE_FAMILIES.flatMap(([, v]) => v), 'none']);
export const VOICE_LABELS = Object.freeze({
  clink:'Acrylic clink', ping:'Wine-glass ping', celesta:'Glass celesta', chime:'Crystal chime',
  bowl:'Singing bowl', shard:'Crystal shard (FM)',
  thud:'Heavy thud on glass', knock:'Dull knock', muffled:'Muffled glass', slab:'Stone on glass',
  bloom:'Deep-space bloom', sonar:'Sonar ping', ghost:'Ghost ring', theremin:'Theremin sigh',
  none:'Silent',
});
export const TRAVEL_SOUNDS = Object.freeze(['none', 'swish', 'shimmer', 'gliss', 'rumble', 'warp']);
export const TRAVEL_LABELS = Object.freeze({ none:'None', swish:'Air swish', shimmer:'Glass shimmer', gliss:'Tuned rise',
  rumble:'Heavy rumble', warp:'Space warble' });

export const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);

// 🎚️ LEVELLED BY MEASUREMENT, not by ear: each voice rendered offline at C6 and
// scaled so they all peak near 0.2 (`.scratch/_sfxrun.mjs`). Without this the
// acrylic clink was six times quieter than the bowl, so swapping voices on the
// page compared LOUDNESS, not timbre.
// 📌 The weighted voices are levelled a little HOTTER (peak ~0.3): a 70 Hz body
// at the same peak as a 1 kHz ping sounds far quieter to the ear.
const LOUD = Object.freeze({ clink:3.4, ping:0.85, celesta:1.5, chime:1, bowl:0.6, shard:1.9,
  thud:3, knock:5.5, muffled:2.1, slab:2.6, bloom:0.42, sonar:1.25, ghost:1, theremin:1 });

/** The low body of a weighted voice: the note dropped to 45–150 Hz, still in key. */
export function bodyFreq(f) { let b = f; while (b > 150) b /= 2; return Math.max(45, b); }

/**
 * @param context a function returning the AudioContext (null when there is none)
 * @param output  a function from the context to the node the sounds end in
 */
export function createLandingSfx({ context = getRiffAudio, output = getSfxBus } = {}) {
  let ctx = null, master = null, wet = null, dry = null, verb = null, noiseBuf = null;
  let echoIn = null, echoDelay = null, bus = null;
  let bag = null;   // the nodes the current call builds, for teardown

  const mix = { volume:0.7, space:0.3, spaceLen:1.8, echo:0, echoTime:0.28 };
  function impulse(seconds) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }

  /** The shared landing bus for this context: master → compressor → SFX bus. */
  function landingBus() {
    if (ctx.__rlswLandingBus) return ctx.__rlswLandingBus;
    const b = {};
    b.master = ctx.createGain(); b.master.gain.value = mix.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.002; comp.release.value = 0.2;
    b.master.connect(comp); comp.connect(output(ctx));
    b.dry = ctx.createGain(); b.dry.connect(b.master);
    b.verb = ctx.createConvolver(); b.verb.buffer = impulse(mix.spaceLen); b.verbLen = mix.spaceLen;
    b.wet = ctx.createGain(); b.wet.gain.value = mix.space; b.verb.connect(b.wet); b.wet.connect(b.master);
    // 🌌 THE SPACE ECHO: a feedback delay, darkened on every repeat, so any
    // voice can trail off into the distance (the `echo` lever; 0 = none).
    b.echoIn = ctx.createGain(); b.echoIn.gain.value = mix.echo;
    b.echoDelay = ctx.createDelay(1.5); b.echoDelay.delayTime.value = mix.echoTime;
    const fb = ctx.createGain(); fb.gain.value = 0.45;
    const dark = ctx.createBiquadFilter(); dark.type = 'lowpass'; dark.frequency.value = 2600;
    b.echoIn.connect(b.echoDelay); b.echoDelay.connect(dark); dark.connect(fb); fb.connect(b.echoDelay);
    dark.connect(b.master); dark.connect(b.verb);
    b.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ctx.__rlswLandingBus = b;
    return b;
  }

  /** The context, ready to play into — or null (no WebAudio, a test, a server). */
  function ensure() {
    const c = context();
    if (!c) return null;
    if (c !== ctx) {
      ctx = c; bus = landingBus();
      ({ master, dry, verb, wet, echoIn, echoDelay } = bus); noiseBuf = bus.noise;
      setMix({});
    }
    if (ctx.state === 'suspended') ctx.resume?.();
    return ctx;
  }

  function setMix({ vol, room, roomLen, echoAmt, echoSec }) {
    if (vol != null) mix.volume = vol;
    if (room != null) mix.space = room;
    if (roomLen != null) mix.spaceLen = roomLen;
    if (echoAmt != null) mix.echo = echoAmt;
    if (echoSec != null) mix.echoTime = echoSec;
    if (!bus) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(mix.volume, t, 0.02);
    wet.gain.setTargetAtTime(mix.space, t, 0.02);
    echoIn.gain.setTargetAtTime(mix.echo, t, 0.02);
    echoDelay.delayTime.setTargetAtTime(mix.echoTime, t, 0.05);
    if (Math.abs(mix.spaceLen - bus.verbLen) > 0.05) { bus.verbLen = mix.spaceLen; verb.buffer = impulse(mix.spaceLen); }
  }

  /** Everything plays into `out`, which feeds the dry path, the room and the echo. */
  function voiceOut(gain) {
    const g = ctx.createGain(); g.gain.value = gain;
    g.connect(dry); g.connect(verb); g.connect(echoIn);
    bag?.push(g);
    return g;
  }

  /**
   * 🧹 Run `build`, then cut every out and filter it made once `tail` seconds
   * have passed. The sources have stopped themselves by then; cutting the outs
   * takes what is left off the render (the shared room and echo keep ringing).
   */
  function built(tail, build) {
    const mine = []; bag = mine;
    try { build(); } finally { bag = null; }
    setTimeout(() => { for (const n of mine) { try { n.disconnect(); } catch { /* already gone */ } } }, Math.ceil(tail * 1000));
    return mine;
  }

  function partial(out, freq, amp, decay, t0, { attack = 0.002, detune = 0 } = {}) {
    if (freq > ctx.sampleRate / 2.2 || amp <= 0) return;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.value = freq; o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(amp, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    o.connect(g); g.connect(out);
    o.start(t0); o.stop(t0 + attack + decay + 0.05);
  }

  /** A filter in front of `out` — how a voice gets MUFFLED. */
  function filtered(out, type, freq, q = 0.7) {
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = Math.min(freq, ctx.sampleRate / 2.3); f.Q.value = q;
    f.connect(out); bag?.push(f); return f;
  }

  /** A sine whose pitch falls from `from` to `to` — the "boom" of a weight. */
  function drop(out, from, to, amp, fall, decay, t0) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(from, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + fall);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(amp, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + decay + 0.05);
  }

  /** A soft, slow-blooming tone for the space voices: detuned pair, drifting flat. */
  function pad(out, freq, amp, attack, decay, t0, { spread = 7, drift = -12, type = 'sine' } = {}) {
    for (const d of [-spread, spread]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      o.detune.setValueAtTime(d, t0); o.detune.linearRampToValueAtTime(d + drift, t0 + attack + decay);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(amp, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
      o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + attack + decay + 0.05);
    }
  }

  /**
   * ⚖️ THE WEIGHT LAYER — a thump under ANY voice (the `weight` lever), so a
   * crystal chime can land like something heavy. Also the core of `thud`.
   */
  function thump(out, f, amt, t0, ring = 1) {
    if (amt <= 0) return;
    const b = bodyFreq(f);
    drop(out, b * 2.4, b, 0.9 * amt, 0.07, 0.32 * ring, t0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; bag?.push(lp);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9 * amt, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    s.connect(lp); lp.connect(g); g.connect(out); s.start(t0, Math.random() * 0.5); s.stop(t0 + 0.12);
  }

  function click(out, centre, amp, len, t0, q = 1.2) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = Math.min(centre, ctx.sampleRate / 2.3); f.Q.value = q; bag?.push(f);
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + len + 0.02);
  }

  /**
   * One landing. `freqs` is one pitch or several (a Shukuchi dyad, everyone
   * landing at once). `ring` scales every decay; `bright` scales the upper
   * partials; `vel` is loudness 0…1.
   */
  function landNow(voice, freqs, { vel = 1, ring = 1, bright = 0.6, sparkle = 0, delay = 0, weight = 0 } = {}) {
    if (!ensure() || voice === 'none') return;
    const t0 = ctx.currentTime + 0.005 + delay;
    const list = Array.isArray(freqs) ? freqs : [freqs];
    const per = vel / Math.sqrt(list.length);
    for (const f of list) {
      const out = voiceOut(per * 0.5 * (LOUD[voice] ?? 1));
      switch (voice) {
        case 'clink': {           // acrylic: short, dry, a woody tick under the glass
          partial(out, f, 0.55, 0.07 * ring, t0);
          partial(out, f * 2.756, 0.35 * bright, 0.045 * ring, t0);
          partial(out, f * 5.404, 0.18 * bright, 0.025 * ring, t0);
          click(out, f * 3, 0.5, 0.018, t0, 2);
          click(out, 1400, 0.25, 0.03, t0, 0.8);
          break;
        }
        case 'ping': {            // wine glass: pure, long, a slow beat in each mode
          for (const [ratio, amp, dec, beat] of [[1, 0.6, 1.5, 3], [2.32, 0.28 * bright, 0.8, 5], [4.25, 0.12 * bright, 0.35, 7]]) {
            partial(out, f * ratio, amp, dec * ring, t0, { attack:0.003, detune:-beat });
            partial(out, f * ratio, amp * 0.8, dec * ring * 0.9, t0, { attack:0.003, detune:beat });
          }
          click(out, f * 4, 0.12, 0.01, t0, 3);
          break;
        }
        case 'celesta': {         // mallet on glass: warm fundamental, a quick bright strike
          partial(out, f, 0.6, 0.9 * ring, t0, { attack:0.002 });
          partial(out, f * 2, 0.18, 0.4 * ring, t0);
          partial(out, f * 4.0, 0.22 * bright, 0.12 * ring, t0);
          partial(out, f * 9.9, 0.1 * bright, 0.04 * ring, t0);
          click(out, 2500, 0.18, 0.012, t0, 1);
          break;
        }
        case 'chime': {           // free bar / crystal bell
          const P = [[1, 0.55, 1.8], [2.756, 0.32 * bright, 1.0], [5.404, 0.18 * bright, 0.5], [8.933, 0.1 * bright, 0.28]];
          for (const [ratio, amp, dec] of P) partial(out, f * ratio, amp, dec * ring, t0, { attack:0.0015 });
          click(out, f * 6, 0.1, 0.008, t0, 4);
          break;
        }
        case 'bowl': {            // singing bowl: soft onset, very long, slow wobble
          for (const [ratio, amp, dec, beat] of [[1, 0.55, 3.2, 1.2], [2.71, 0.25 * bright, 2.0, 2], [4.8, 0.1 * bright, 1.0, 3]]) {
            partial(out, f * ratio, amp, dec * ring, t0, { attack:0.02, detune:-beat });
            partial(out, f * ratio, amp * 0.9, dec * ring, t0, { attack:0.02, detune:beat });
          }
          break;
        }
        case 'shard': {           // FM: a bright, glassy "tink" with a metallic edge
          const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
          car.frequency.value = f; mod.frequency.value = f * 3.53;
          mg.gain.setValueAtTime(f * (2 + 5 * bright), t0); mg.gain.exponentialRampToValueAtTime(1, t0 + 0.25 * ring);
          g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.45, t0 + 0.002);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9 * ring);
          mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(out);
          car.start(t0); mod.start(t0); car.stop(t0 + ring + 0.1); mod.stop(t0 + ring + 0.1);
          partial(out, f * 2, 0.12, 0.5 * ring, t0);
          break;
        }
      }
      // ── WEIGHTED: the piece is heavy and the table is thick glass ──────
      if (voice === 'thud') {            // a weight set down hard: boom, dull knock, a faint glass tick
        thump(out, f, 1, t0, ring);
        partial(filtered(out, 'lowpass', 900), bodyFreq(f) * 4, 0.12, 0.08 * ring, t0);
        partial(out, f, 0.05 * bright, 0.05, t0);      // the glass, barely
        click(out, 700, 0.35, 0.03, t0, 0.8);
      } else if (voice === 'knock') {    // resin puck on thick glass: a short, woody, pitched tock
        const k = bodyFreq(f) * 2;
        click(out, k * 2.5, 0.9, 0.05, t0, 3);
        partial(out, k, 0.5, 0.14 * ring, t0);
        partial(out, k * 2.3, 0.2, 0.06 * ring, t0);
        partial(filtered(out, 'lowpass', 1500), f * 0.5, 0.12 * bright, 0.18 * ring, t0);
        drop(out, k, k * 0.7, 0.25, 0.05, 0.12, t0);
      } else if (voice === 'muffled') {  // a crystal chime with a hand on it: the ring, dulled
        const m = filtered(out, 'lowpass', f * (0.9 + bright), 0.5);
        for (const [ratio, amp, dec] of [[1, 0.7, 0.45], [2.756, 0.35, 0.2], [5.404, 0.15, 0.09]]) partial(m, f * ratio, amp, dec * ring, t0);
        thump(out, f, 0.35, t0, ring);
        click(out, 500, 0.25, 0.025, t0, 0.8);
      } else if (voice === 'slab') {     // a stone piece on a glass slab: a gritty double contact
        thump(out, f, 0.8, t0 + 0.012, ring);
        click(out, 260, 0.6, 0.02, t0, 0.7);             // the edge touching first
        click(out, 1900, 0.3 * (0.5 + bright), 0.05, t0 + 0.012, 0.6);   // grit
        partial(filtered(out, 'bandpass', f, 4), f, 0.18 * bright, 0.3 * ring, t0 + 0.012);   // the slab's own note, faint
      }
      // ── SPACE: slow, detuned, a long way off ───────────────────────────
      else if (voice === 'bloom') {      // a chord that swells out of nothing and drifts flat
        const lp = filtered(out, 'lowpass', f * 0.7, 1.2);
        lp.frequency.setValueAtTime(f * 0.7, t0); lp.frequency.exponentialRampToValueAtTime(f * (2 + 4 * bright), t0 + 0.5);
        lp.frequency.exponentialRampToValueAtTime(f * 0.8, t0 + 3 * ring);
        pad(lp, f, 0.4, 0.09, 3.2 * ring, t0, { type:'triangle' });
        pad(lp, f * 1.5, 0.22, 0.14, 2.6 * ring, t0, { spread:9 });
        pad(lp, f * 0.5, 0.3, 0.06, 2.8 * ring, t0, { spread:4 });
      } else if (voice === 'sonar') {    // one ping, bending down, answered three times from far away
        for (let i = 0; i < 4; i++) {
          const ti = t0 + i * 0.32 * ring, a = 0.55 * Math.pow(0.42, i);
          const tgt = i ? filtered(out, 'lowpass', f * (1.4 - i * 0.25)) : out;
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(f, ti); o.frequency.exponentialRampToValueAtTime(f * 0.94, ti + 0.9);
          const g = ctx.createGain(); g.gain.setValueAtTime(0, ti); g.gain.linearRampToValueAtTime(a, ti + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, ti + 0.9 * ring);
          o.connect(g); g.connect(tgt); o.start(ti); o.stop(ti + ring + 0.05);
        }
        partial(out, f * 3, 0.08 * bright, 0.08, t0);
      } else if (voice === 'ghost') {    // ring modulation: a clang no instrument makes, then echoes
        for (let i = 0; i < 3; i++) {
          const ti = t0 + i * 0.24 * ring, a = 0.6 * Math.pow(0.4, i);
          const car = ctx.createOscillator(), mod = ctx.createOscillator(), rm = ctx.createGain(), g = ctx.createGain();
          car.frequency.value = f; mod.frequency.value = f * 0.7071; rm.gain.value = 0;
          mod.connect(rm.gain); car.connect(rm); rm.connect(g); g.connect(filtered(out, 'lowpass', f * (2 + 3 * bright) / (i + 1)));
          g.gain.setValueAtTime(0, ti); g.gain.linearRampToValueAtTime(a, ti + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, ti + 1.6 * ring);
          car.start(ti); mod.start(ti); car.stop(ti + 1.7 * ring); mod.stop(ti + 1.7 * ring);
        }
        pad(out, f * 0.5, 0.15, 0.2, 2 * ring, t0, { spread:5, drift:-20 });
      } else if (voice === 'theremin') { // slides up into the note, then wavers
        const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator(), depth = ctx.createGain(), g = ctx.createGain();
        o.type = 'sine'; o2.type = 'triangle';
        for (const x of [o, o2]) { x.frequency.setValueAtTime(f * 0.89, t0); x.frequency.exponentialRampToValueAtTime(f, t0 + 0.14); }
        lfo.frequency.value = 5.6; depth.gain.setValueAtTime(0, t0); depth.gain.linearRampToValueAtTime(14, t0 + 0.35);
        lfo.connect(depth); depth.connect(o.detune); depth.connect(o2.detune);
        const mix2 = ctx.createGain(); mix2.gain.value = 0.25 * bright; o2.connect(mix2); mix2.connect(g); o.connect(g);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6 * ring);
        g.connect(out);
        for (const x of [o, o2, lfo]) { x.start(t0); x.stop(t0 + 1.7 * ring); }
      }
      if (weight > 0 && voice !== 'thud') thump(out, f, weight, t0, ring);
      // ✨ A sparkle tail: a few tiny, very high pings scattered just after.
      for (let i = 0; i < sparkle; i++) {
        const tt = t0 + 0.04 + Math.random() * 0.35;
        partial(out, f * (4 + Math.floor(Math.random() * 4)) * (1 + (Math.random() - 0.5) * 0.02), 0.05, 0.12 + Math.random() * 0.2, tt);
      }
    }
  }

  /** A sound WHILE it travels, `sec` long, ending at the landing. */
  function travelNow(kind, sec, freq, { vel = 1 } = {}) {
    if (!ensure() || kind === 'none' || sec <= 0.02) return;
    const t0 = ctx.currentTime + 0.005, t1 = t0 + sec;
    const out = voiceOut(vel * 0.35);
    if (kind === 'swish') {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; bag?.push(f);
      f.frequency.setValueAtTime(700, t0); f.frequency.exponentialRampToValueAtTime(3800, t0 + sec * 0.55);
      f.frequency.exponentialRampToValueAtTime(1500, t1);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + sec * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t1);
      s.connect(f); f.connect(g); g.connect(out); s.start(t0); s.stop(t1 + 0.05);
    } else if (kind === 'shimmer') {
      const n = Math.max(3, Math.round(sec * 22));
      for (let i = 0; i < n; i++) {
        const k = i / n, tt = t0 + k * sec;
        partial(out, freq * (2 + k * 2) * (1 + (Math.random() - 0.5) * 0.03), 0.16 * Math.sin(Math.PI * k) + 0.04, 0.09, tt);
      }
    } else if (kind === 'rumble') {   // a heavy piece dragged over glass: low, grainy
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180; f.Q.value = 4; bag?.push(f);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(1.4, t0 + sec * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t1);
      s.connect(f); f.connect(g); g.connect(out); s.start(t0); s.stop(t1 + 0.05);
    } else if (kind === 'warp') {     // a wobbling tone that climbs into the landing note
      const o = ctx.createOscillator(), lfo = ctx.createOscillator(), d = ctx.createGain(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(freq / 4, t0); o.frequency.exponentialRampToValueAtTime(freq / 2, t1);
      lfo.frequency.setValueAtTime(3, t0); lfo.frequency.exponentialRampToValueAtTime(14, t1);
      d.gain.value = 60; lfo.connect(d); d.connect(o.detune);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22, t0 + sec * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.03);
      o.connect(g); g.connect(out); o.start(t0); lfo.start(t0); o.stop(t1 + 0.06); lfo.stop(t1 + 0.06);
    } else if (kind === 'gliss') {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(freq / 2, t0); o.frequency.exponentialRampToValueAtTime(freq, t1);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + sec * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.02);
      o.connect(g); g.connect(out); o.start(t0); o.stop(t1 + 0.05);
    }
  }

  /** A soft tick as it leaves the deck (lift & place, hop). */
  function takeoffNow(freq, { vel = 1 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + 0.005, out = voiceOut(vel * 1.0);
    click(out, 1800, 0.35, 0.02, t0, 1.5);
    partial(out, freq * 0.5, 0.2, 0.05, t0);
  }

  /** A shove: a heavier acrylic clack with a low knock under it. */
  function clackNow(freq, { vel = 1 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + 0.005, out = voiceOut(vel * 1.9);
    click(out, 900, 0.8, 0.05, t0, 0.9);
    partial(out, freq / 4, 0.5, 0.12, t0);
    partial(out, freq * 0.5 * 2.756, 0.25, 0.06, t0);
  }

  // ── the public calls: each builds inside `built`, so it is torn down ──────
  // ⚠️ The tails are the LONGEST a voice can ring (the bowl, 3.2 s × ring) plus
  // margin — cutting earlier would clip a note; never cutting is the leak.
  /** One landing. Returns the nodes it built (for the teardown check). */
  function land(voice, freqs, o = {}) {
    if (!ensure() || voice === 'none') return [];
    return built((o.delay ?? 0) + 4.4 * (o.ring ?? 1) + 0.6, () => landNow(voice, freqs, o));
  }
  /** A sound WHILE it travels, `sec` long, ending at the landing. */
  function travel(kind, sec, freq, o = {}) {
    if (!ensure() || kind === 'none' || sec <= 0.02) return [];
    return built(sec + 0.6, () => travelNow(kind, sec, freq, o));
  }
  function takeoff(freq, o = {}) { if (!ensure()) return []; return built(1, () => takeoffNow(freq, o)); }
  function clack(freq, o = {}) { if (!ensure()) return []; return built(1, () => clackNow(freq, o)); }

  return { ensure, setMix, land, travel, takeoff, clack, get ready() { return !!ctx && ctx.state === 'running'; } };
}
