// ─── 🔊 PYRO SFX — a mortar going off under a standee, and the mortars' machinery ─
// Ported 2026-10-02 from `.scratch/pyro-shove/blastSfx.js` (the pyro-shove
// preview, Alex's dial-in) — every voice below is the preview's, byte for byte;
// the preview now imports THIS file. Web Audio, synthesised, no samples.
// ⛔ NOT Astra's `stage-pyro/audio.js` (Alex: her audio is not wanted) — her cue
// TIMES drive these voices (`board/pyroMortars.js` MORTAR_SOUND_MARKS).
//
// What it tries to say: a heavy *iron* thing (plate click, barrel boom) and a
// light *plastic* thing (the acrylic sheet rattling when it lands) at once —
// that contrast is the joke and the readability of the hit.
//
// 🎚️ ON THE SFX FADER: the chain ends in `getSfxBus(ctx)` (riffSfx.js), like
// `landingSfx.js`. The chain (saturation, compressor, limiter, the room) is ONE
// per AudioContext, cached on it — ⚠️ a second copy per arena mount would leave
// a convolver running for every remount.
// 🧹 Every voice disconnects its nodes after its tail.
import { getRiffAudio, getSfxBus } from './riffSfx.js';

function pyroChain(ctx, output) {
  if (ctx.__rlswPyroChain) return ctx.__rlswPyroChain;
  const c = {};
  c.master = ctx.createGain(); c.master.gain.value = 0.7;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 24;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.006; comp.release.value = 0.25;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
  // a little saturation carries the low end on laptop speakers
  const sat = ctx.createWaveShaper(), curve = new Float32Array(2048);
  for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = Math.tanh(x * 1.7) / 1.7; }
  sat.curve = curve; sat.oversample = '2x';
  c.bassBus = ctx.createGain(); c.bassBus.gain.value = 1; c.airBus = ctx.createGain();
  c.bassBus.connect(sat); sat.connect(c.master); c.airBus.connect(c.master);
  c.master.connect(hp); hp.connect(comp); comp.connect(lim); lim.connect(output(ctx));
  // a small room: decaying noise as the impulse response
  const room = ctx.createConvolver();
  const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  room.buffer = ir; const roomSend = ctx.createGain(); roomSend.gain.value = 0.22;
  c.airBus.connect(roomSend); roomSend.connect(room); room.connect(c.master);
  c.white = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate); c.brown = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
  const w = c.white.getChannelData(0), b = c.brown.getChannelData(0); let last = 0;
  for (let i = 0; i < w.length; i++) { w[i] = Math.random() * 2 - 1; last = (last + w[i] * 0.035) / 1.006; b[i] = last; }
  let sq = 0; for (let i = 0; i < b.length; i++) sq += b[i] * b[i];
  const k = 0.3 / Math.sqrt(sq / b.length); for (let i = 0; i < b.length; i++) b[i] = Math.max(-1, Math.min(1, b[i] * k));
  ctx.__rlswPyroChain = c;
  return c;
}

/**
 * @param context a function returning the AudioContext (null when there is none)
 * @param output  a function from the context to the node the chain ends in
 */
export function createPyroSfx({ context = getRiffAudio, output = getSfxBus } = {}) {
  let ctx = null, master, bassBus, airBus, white, brown;
  let vol = 0.7, bass = 1;

  /** Ready to play? Wakes the context (call it from a user gesture in a preview). */
  function ensure() {
    const c = context();
    if (!c) return false;
    if (c !== ctx) { ctx = c; ({ master, bassBus, airBus, white, brown } = pyroChain(ctx, output)); setMix(vol, bass); }
    if (ctx.state === 'suspended') ctx.resume?.();
    return true;
  }
  // ⚠️ A voice asks for the context itself: in the game nothing calls ensure()
  // first, and the shared riff context may be created by any earlier sound.
  const live = () => { ensure(); return !!ctx && ctx.state === 'running'; };
  function setMix(v, bs) { vol = v; bass = bs; if (ctx) { master.gain.value = v; bassBus.gain.value = bs; } }

  const fade = (g, t, dur, amp, attack = 0.004) => {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, amp), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };
  function tone(type, f0, f1, t, dur, amp, dest, attack) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    fade(g, t, dur, amp, attack); o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05); o.onended = () => { o.disconnect(); g.disconnect(); };
  }
  function noise(buf, t, dur, amp, dest, { type = 'lowpass', f0 = 800, f1 = f0, q = 0.7, attack = 0.004 } = {}) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); fade(g, t, dur, amp, attack);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
  }
  const now = (delay = 0) => ctx.currentTime + 0.01 + delay;
  // a stereo lane: voices on the left/right of the board. pan 0 = the plain buses.
  function lane(pan) {
    if (!pan) return { air:airBus, bass:bassBus };
    const a = ctx.createStereoPanner(), b = ctx.createStereoPanner(); a.pan.value = b.pan.value = Math.max(-1, Math.min(1, pan));
    a.connect(airBus); b.connect(bassBus); return { air:a, bass:b };
  }

  return {
    ensure, live, setMix, get running() { return live(); },
    /** The trip-plate under the weight: iron clunk. */
    plate() {
      if (!live()) return; const t = now();
      tone('sine', 190, 70, t, 0.16, 0.9, bassBus); noise(white, t, 0.07, 0.5, airBus, { type:'bandpass', f0:2600, f1:1500, q:1.4 });
      tone('square', 880, 520, t, 0.04, 0.12, airBus);
    },
    /** The charge winding up in the fuse. */
    whine(dur, amt) {
      if (!live() || amt <= 0) return; const t = now(), o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(1500, t + dur);
      f.type = 'lowpass'; f.frequency.value = 1800; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * amt, t + dur * 0.9); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.02);
      o.connect(f); f.connect(g); g.connect(airBus); o.start(t); o.stop(t + dur + 0.06); o.onended = () => { o.disconnect(); f.disconnect(); g.disconnect(); };
    },
    /** The deep report of the mortar. `weight` scales the sub, `tail` the rumble in seconds. */
    boom(weight = 1, tail = 1.4) {
      if (!live()) return; const t = now();
      tone('sine', 78, 30, t, 0.95 * Math.min(1.6, tail / 1.2 + 0.3), 1.1 * weight, bassBus, 0.006);
      tone('triangle', 150, 48, t, 0.3, 0.7 * weight, bassBus, 0.004);
      noise(brown, t, 0.8, 1.2 * weight, bassBus, { type:'lowpass', f0:520, f1:110, q:0.5, attack:0.006 });
      noise(brown, t + 0.02, tail, 0.5 * weight, bassBus, { type:'lowpass', f0:170, f1:55, q:0.4, attack:0.08 });
      noise(white, t, 0.14, 0.7, airBus, { type:'highpass', f0:2200, f1:1400, q:0.5, attack:0.002 });   // the crack
      noise(white, t, 0.45, 0.28, airBus, { type:'bandpass', f0:900, f1:260, q:0.7, attack:0.003 });     // the body of the whoomp
    },
    crackle(amt = 0.6) {
      if (!live() || amt <= 0) return; const t = now();
      for (let i = 0; i < 16; i++) noise(white, t + 0.05 + Math.random() * 0.6, 0.025 + Math.random() * 0.03, (0.1 + Math.random() * 0.2) * amt, airBus, { type:'highpass', f0:3000 + Math.random() * 3000, q:0.8, attack:0.001 });
    },
    /** The shell climbing: a rising hiss. */
    shell() {
      if (!live()) return; const t = now();
      noise(white, t, 0.85, 0.22, airBus, { type:'bandpass', f0:500, f1:3800, q:2.2, attack:0.05 });
      tone('sawtooth', 300, 1500, t, 0.8, 0.04, airBus, 0.05);
    },
    /** The aerial burst: a soft thump and a crackle of stars. */
    crown(sc = 1, pan = 0) {
      if (!live()) return; const t = now(); const { air:airBus, bass:bassBus } = lane(pan);
      tone('sine', 95, 40, t, 0.6, 0.55 * sc, bassBus); noise(brown, t, 0.7, 0.6 * sc, bassBus, { type:'lowpass', f0:300, f1:80, q:0.4 });
      noise(white, t, 0.12, 0.3, airBus, { type:'highpass', f0:1800, q:0.6 });
      for (let i = 0; i < 26; i++) noise(white, t + 0.05 + Math.random() * 1.1, 0.02 + Math.random() * 0.025, 0.05 + Math.random() * 0.1, airBus, { type:'highpass', f0:4000 + Math.random() * 3000, q:0.7, attack:0.001 });
    },
    /** Touchdown: a dull body thud and — the point — the acrylic sheet rattling. */
    land(power = 1, rattle = 0.6, dust = 1) {
      if (!live()) return; const t = now();
      tone('sine', 120 + 40 * power, 48, t, 0.2, 0.85 * power, bassBus, 0.003);
      noise(brown, t, 0.18, 0.7 * power, bassBus, { type:'lowpass', f0:420, f1:120, q:0.5, attack:0.003 });
      if (dust > 0) noise(white, t, 0.22, 0.12 * power * dust, airBus, { type:'lowpass', f0:2400, f1:500, q:0.5 });
      if (rattle > 0) {
        // inharmonic partials of a flexing plastic sheet, a few strikes apart
        const n = 3 + Math.round(power * 3);
        for (let i = 0; i < n; i++) {
          const dt = i * (0.035 + Math.random() * 0.03) * (1 + i * 0.25);
          for (const fr of [1900 + Math.random() * 500, 3100 + Math.random() * 800, 4700 + Math.random() * 1100]) {
            tone('sine', fr, fr * 0.985, t + dt, 0.07 + Math.random() * 0.05, (0.07 / (1 + i * 0.5)) * rattle * power, airBus, 0.001);
          }
          noise(white, t + dt, 0.018, 0.1 * rattle * power / (1 + i * 0.4), airBus, { type:'bandpass', f0:3600 + Math.random() * 900, q:1.8, attack:0.001 });
        }
      }
    },

    // ── THE MECHANISM (deploy / retract) — my voices for Astra's cue times ──────────
    /** Latch releases: a sharp clack and a small iron tick. */
    unlock(lv = 1, pan = 0) {
      if (!live() || lv <= 0) return; const t = now(), { air, bass } = lane(pan);
      tone('square', 1500, 800, t, 0.035, 0.16 * lv, air); noise(white, t, 0.05, 0.4 * lv, air, { type:'bandpass', f0:2400, f1:1800, q:1.6 });
      tone('sine', 150, 80, t + 0.03, 0.12, 0.45 * lv, bass);
    },
    /** The barrel rises: a hydraulic whirr with a ratchet of petal ticks. */
    lift(lv = 1, pan = 0) {
      if (!live() || lv <= 0) return; const t = now(), { air, bass } = lane(pan), d = 1.5;
      tone('sawtooth', 60, 130, t, d, 0.13 * lv, bass, 0.12); tone('sine', 380, 560, t + 0.1, d - 0.2, 0.05 * lv, air, 0.2);
      noise(white, t, d, 0.12 * lv, air, { type:'bandpass', f0:500, f1:1100, q:1.2, attack:0.15 });
      for (let i = 0; i < 9; i++) noise(white, t + 0.08 + i * 0.13, 0.02, 0.2 * lv, air, { type:'bandpass', f0:3200, q:2, attack:0.001 });
    },
    /** Locked home: a heavy clunk with a short ring. */
    lock(lv = 1, pan = 0) {
      if (!live() || lv <= 0) return; const t = now(), { air, bass } = lane(pan);
      tone('sine', 140, 52, t, 0.2, 0.8 * lv, bass, 0.003); noise(white, t, 0.06, 0.45 * lv, air, { type:'bandpass', f0:2000, f1:1300, q:1.3 });
      tone('sine', 1180, 1150, t, 0.35, 0.06 * lv, air, 0.002);
    },
    /** Pressure released: a pneumatic hiss. */
    release(lv = 1, pan = 0) {
      if (!live() || lv <= 0) return; const t = now(), { air } = lane(pan);
      noise(white, t, 0.4, 0.28 * lv, air, { type:'highpass', f0:3400, f1:1500, q:0.6, attack:0.01 }); tone('sine', 110, 70, t, 0.1, 0.2 * lv, bassBus);
    },
    /** The barrel sinks: the whirr, reversed. */
    retract(lv = 1, pan = 0) {
      if (!live() || lv <= 0) return; const t = now(), { air, bass } = lane(pan), d = 1.0;
      tone('sawtooth', 130, 55, t, d, 0.12 * lv, bass, 0.05); noise(white, t, d, 0.1 * lv, air, { type:'bandpass', f0:1100, f1:450, q:1.2, attack:0.05 });
      for (let i = 0; i < 6; i++) noise(white, t + i * 0.15, 0.02, 0.15 * lv, air, { type:'bandpass', f0:3000, q:2, attack:0.001 });
    },
    /** Petals seal shut: a soft thud and a last hiss. */
    seal(lv = 1, pan = 0) {
      if (!live() || lv <= 0) return; const t = now(), { air, bass } = lane(pan);
      tone('sine', 100, 45, t, 0.18, 0.6 * lv, bass, 0.004); noise(white, t, 0.18, 0.12 * lv, air, { type:'highpass', f0:3000, f1:1800, q:0.6 });
    },
    // ── THE SHOW — the other mortars, the blasters, the curtain ─────────────────────
    /** A lighter mortar than the struck one: thump, whoosh, shell climbing. */
    launch(lv = 1, pan = 0) {
      if (!live() || lv <= 0) return; const t = now(), { air, bass } = lane(pan);
      tone('sine', 112, 40, t, 0.4, 0.8 * lv, bass, 0.005); noise(brown, t, 0.5, 0.7 * lv, bass, { type:'lowpass', f0:700, f1:140, q:0.5 });
      noise(white, t, 0.1, 0.35 * lv, air, { type:'highpass', f0:2200, f1:1500, q:0.5, attack:0.002 });
      noise(white, t + 0.05, 0.8, 0.14 * lv, air, { type:'bandpass', f0:500, f1:3000, q:2, attack:0.05 });
    },
    /** Blasters (the perimeter cannons): a roaring gout of flame. */
    flame(lv = 1, pan = 0) {
      if (!live() || lv <= 0) return; const t = now(), { air, bass } = lane(pan);
      noise(white, t, 1.2, 0.38 * lv, air, { type:'bandpass', f0:350, f1:1100, q:0.8, attack:0.1 });
      noise(brown, t, 1.3, 0.8 * lv, bass, { type:'lowpass', f0:380, f1:90, q:0.5, attack:0.08 }); tone('sine', 70, 38, t, 0.8, 0.5 * lv, bass, 0.04);
      for (let i = 0; i < 14; i++) noise(white, t + 0.1 + Math.random() * 1, 0.02 + Math.random() * 0.02, (0.05 + Math.random() * 0.1) * lv, air, { type:'highpass', f0:3000 + Math.random() * 3000, q:0.8, attack:0.001 });
    },
    /** The spark curtain: a long fizzing shower. */
    curtain(lv = 1, pan = 0) {
      if (!live() || lv <= 0) return; const t = now(), { air } = lane(pan);
      noise(white, t, 3.4, 0.11 * lv, air, { type:'highpass', f0:4500, f1:3200, q:0.6, attack:0.35 });
      for (let i = 0; i < 70; i++) noise(white, t + 0.1 + Math.random() * 3.1, 0.015 + Math.random() * 0.02, (0.04 + Math.random() * 0.08) * lv, air, { type:'highpass', f0:4000 + Math.random() * 3500, q:0.8, attack:0.001 });
    },
    /** Flames: a soft roar with a crackle. */
    burn(dur, amt = 0.6) {
      if (!live() || amt <= 0) return; const t = now();
      noise(brown, t, dur, 0.5 * amt, bassBus, { type:'lowpass', f0:420, f1:200, q:0.4, attack:0.3 });
      noise(white, t, dur, 0.05 * amt, airBus, { type:'bandpass', f0:1500, f1:700, q:0.6, attack:0.3 });
      for (let i = 0; i < Math.min(40, dur * 14); i++) noise(white, t + 0.1 + Math.random() * dur * 0.9, 0.02 + Math.random() * 0.02, (0.04 + Math.random() * 0.08) * amt, airBus, { type:'highpass', f0:2500 + Math.random() * 3000, q:0.8, attack:0.001 });
    },
  };
}
