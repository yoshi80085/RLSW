// ─── ⚡ PSYCHO BUSHIDO SOUND — crackle, thunder, the draw and the sheath ─────
// Alex, 2026-09-30: "a Zenitsu lightning strike kind of move with lightning
// strikes." The strike has five sounds, in the order they happen:
//   1. the CHARGE — static crackle and a rising electric hum while he crouches;
//   2. the DRAW — a blade leaving the scabbard ("shing") the instant he goes;
//   3. the CLAP — a thunder crack right on top of him, then a long ROLL;
//   4. a ZAP for each bolt the sky drops on the lane;
//   5. the SHEATH — the click (and, if you like, a ring) once it is all over.
//
// ⭐ ALL SYNTHESISED, NO SAMPLES — the doctrine of `riffSfx.js`, `unlockSfx.js`
// and `landingSfx.js`. Thunder is shaped noise; a crackle is a spray of very
// short noise clicks; a blade is a band of noise swept upward over a few
// inharmonic metal partials.
//
// 🎚️ ON THE SFX FADER: `getRiffAudio()` + `getSfxBus(ctx)`, so ☰ Audio's SFX
// slider reaches it (and the preview page shares the game's level).
//
// 🧹 Every call's nodes are disconnected once their tail has run out, and
// `stopAll()` cuts anything still scheduled (a replay mid-charge).
//
// ⭐ PORTED 2026-10-01 from `.scratch/bushidoSfx.js` (which now re-exports this),
// at Alex's dial-in: every sound level as the page offered it, the sheath OFF.
// In the game the strike also gets `growl` (the rumble before take-off), `jolt`
// (one per die of his that lands) and `shieldHit` / `shatter` (his dice on the
// Rival's Sustain shield); `scheduleBushidoStrike` below lays them all on the
// battle's own clock.
import { getRiffAudio, getSfxBus } from './riffSfx.js';
import { createLandingSfx, midiFreq } from './landingSfx.js';
import { STANDEE_MOVE } from '../board/standeeMotion.js';
import { BUSHIDO_STRIKE, planStrike, rumbleWeight } from '../board/bushidoStrike.js';
import { barrageContact, BUSHIDO_BEATS } from '../board/sonicBarrageTiming.js';

export function createBushidoSfx({ context = getRiffAudio, output = getSfxBus } = {}) {
  let ctx = null, bus = null, white = null, brown = null;
  const live = new Set();          // sources still scheduled, for stopAll()
  const mix = { volume:0.75, room:0.35 };

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    ctx = context(); if (!ctx) return null;
    bus = {};
    bus.master = ctx.createGain(); bus.master.gain.value = mix.volume;
    // ⚠️ A LIMITER, NOT A LEVELLER: a thunderclap is meant to be the loudest
    // thing in the strike; this only stops it clipping the SFX bus.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 6; comp.attack.value = 0.001; comp.release.value = 0.25;
    bus.master.connect(comp); comp.connect(output(ctx));
    bus.dry = ctx.createGain(); bus.dry.connect(bus.master);
    bus.verb = ctx.createConvolver(); bus.verb.buffer = impulse(2.6);
    bus.wet = ctx.createGain(); bus.wet.gain.value = mix.room;
    bus.verb.connect(bus.wet); bus.wet.connect(bus.master);
    white = noiseBuffer(2, 'white'); brown = noiseBuffer(4, 'brown');
    return ctx;
  }
  function impulse(sec) {
    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    return buf;
  }
  function noiseBuffer(sec, kind) {
    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }
  function setMix({ vol, room } = {}) {
    if (vol != null) mix.volume = vol;
    if (room != null) mix.room = room;
    if (!ctx) return;
    bus.master.gain.setTargetAtTime(mix.volume, ctx.currentTime, 0.02);
    bus.wet.gain.setTargetAtTime(mix.room, ctx.currentTime, 0.02);
  }

  // One call's nodes: an output gain (dry + a send to the room), torn down after `tail`.
  function voice(when, tail, send = 0.5) {
    const out = ctx.createGain(); out.connect(bus.dry);
    const s = ctx.createGain(); s.gain.value = send; out.connect(s); s.connect(bus.verb);
    const nodes = [out, s];
    const add = n => { nodes.push(n); return n; };
    const ms = (when - ctx.currentTime + tail) * 1000 + 200;
    setTimeout(() => { for (const n of nodes) { try { n.disconnect(); } catch { /* already gone */ } } }, Math.max(50, ms));
    return { out, add };
  }
  const src = (v, buf, when, dur, offset = Math.random()) => {
    const b = v.add(ctx.createBufferSource()); b.buffer = buf; b.loop = true;
    b.start(when, offset * buf.duration * 0.9); b.stop(when + dur);
    live.add(b); b.onended = () => live.delete(b);
    return b;
  };
  const env = (v, when, peak, a, d, curve = 'exp') => {
    const g = v.add(ctx.createGain()); g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + a);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, when + a + d);
    else g.gain.linearRampToValueAtTime(0, when + a + d);
    return g;
  };
  const filt = (v, type, f, q = 0.7) => { const n = v.add(ctx.createBiquadFilter()); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };

  /**
   * ⚡ THE CHARGE: `sec` of static that thickens as the stance fills.
   * `mode` 'crackle' | 'hum' | 'both' | 'off'. Stops dead at `sec` — the hush.
   */
  function charge(sec, { mode = 'both', level = 0.5, delay = 0 } = {}) {
    if (mode === 'off' || !ensure()) return;
    const t0 = ctx.currentTime + delay, v = voice(t0, sec + 0.3, 0.25);
    if (mode === 'crackle' || mode === 'both') {
      // A spray of clicks, sparse → dense (a Poisson clock whose rate climbs).
      const hp = filt(v, 'highpass', 2400); hp.connect(v.out);
      let t = 0;
      while (t < sec) {
        const k = t / sec, rate = 8 + 90 * k * k;          // clicks per second
        t += -Math.log(1 - Math.random()) / rate;
        if (t >= sec) break;
        const len = 0.002 + Math.random() * 0.012;
        const g = env(v, t0 + t, level * (0.25 + 0.75 * Math.random()) * (0.4 + 0.6 * k), 0.0007, len);
        src(v, white, t0 + t, len + 0.01).connect(g); g.connect(hp);
      }
    }
    if (mode === 'hum' || mode === 'both') {
      const o1 = v.add(ctx.createOscillator()), o2 = v.add(ctx.createOscillator());
      o1.type = 'sawtooth'; o2.type = 'square';
      o1.frequency.setValueAtTime(55, t0); o1.frequency.exponentialRampToValueAtTime(130, t0 + sec);
      o2.frequency.setValueAtTime(55.7, t0); o2.frequency.exponentialRampToValueAtTime(131.5, t0 + sec);
      const bp = filt(v, 'bandpass', 300, 2.5);
      bp.frequency.setValueAtTime(300, t0); bp.frequency.exponentialRampToValueAtTime(2200, t0 + sec);
      const g = v.add(ctx.createGain());
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(level * 0.22, t0 + sec * 0.9);
      g.gain.setValueAtTime(level * 0.22, t0 + sec - 0.008); g.gain.linearRampToValueAtTime(0, t0 + sec);
      // the buzz wobbles like a live wire (a 28 Hz tremolo)
      const lfo = v.add(ctx.createOscillator()), lg = v.add(ctx.createGain());
      lfo.frequency.value = 28; lg.gain.value = level * 0.08; lfo.connect(lg); lg.connect(g.gain);
      o1.connect(bp); o2.connect(bp); bp.connect(g); g.connect(v.out);
      for (const o of [o1, o2, lfo]) { o.start(t0); o.stop(t0 + sec + 0.02); live.add(o); o.onended = () => live.delete(o); }
    }
  }

  /**
   * ⚡ THE LIVE CHARGE — for the rolled strike, where the charge is not a
   * ramp but whatever the dice have given him so far. The caller `tick`s it
   * every frame with the seconds elapsed and the charge (0…1); the hum's
   * level and pitch follow, and the crackle's density is scheduled a frame
   * at a time. `stop()` cuts it dead (the hush) and tears it down.
   */
  function chargeLive({ mode = 'both', level = 0.5 } = {}) {
    const off = { tick() {}, stop() {} };
    if (mode === 'off' || !ensure()) return off;
    const t0 = ctx.currentTime, nodes = [];
    const add = n => { nodes.push(n); return n; };
    const out = add(ctx.createGain()); out.connect(bus.dry);
    const send = add(ctx.createGain()); send.gain.value = 0.25; out.connect(send); send.connect(bus.verb);
    const hp = add(ctx.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = 2400; hp.connect(out);
    let hum = null;
    if (mode === 'hum' || mode === 'both') {
      const o1 = add(ctx.createOscillator()), o2 = add(ctx.createOscillator());
      o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = 55; o2.frequency.value = 55.7;
      const bp = add(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.Q.value = 2.5; bp.frequency.value = 300;
      const g = add(ctx.createGain()); g.gain.value = 0.0001;
      const lfo = add(ctx.createOscillator()), lg = add(ctx.createGain());
      lfo.frequency.value = 28; lg.gain.value = 0; lfo.connect(lg); lg.connect(g.gain);
      o1.connect(bp); o2.connect(bp); bp.connect(g); g.connect(out);
      for (const o of [o1, o2, lfo]) o.start(t0);
      hum = { o1, o2, bp, g, lg, lfo };
    }
    const crackle = mode === 'crackle' || mode === 'both';
    let stopped = false;
    return {
      tick(dt, c) {
        if (stopped) return;
        const now = ctx.currentTime;
        if (hum) {
          const f = 55 + 75 * c;
          hum.o1.frequency.setTargetAtTime(f, now, 0.08); hum.o2.frequency.setTargetAtTime(f * 1.013, now, 0.08);
          hum.bp.frequency.setTargetAtTime(300 + 1900 * c, now, 0.08);
          hum.g.gain.setTargetAtTime(Math.max(0.0001, level * 0.22 * (0.15 + 0.85 * c)), now, 0.06);
          hum.lg.gain.setTargetAtTime(level * 0.08 * c, now, 0.06);
        }
        if (crackle) {
          let t = 0;
          const rate = 3 + 90 * c * c;
          for (;;) {
            t += -Math.log(1 - Math.random()) / rate;
            if (t >= dt) break;
            const len = 0.002 + Math.random() * 0.012;
            // (not in `nodes`: each click cleans itself up when it ends)
            const b = ctx.createBufferSource(); b.buffer = white; b.start(now + t, Math.random() * 1.8); b.stop(now + t + len + 0.01);
            const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now + t);
            g.gain.linearRampToValueAtTime(level * (0.25 + 0.75 * Math.random()) * (0.3 + 0.7 * c), now + t + 0.0007);
            g.gain.exponentialRampToValueAtTime(0.0001, now + t + len);
            b.connect(g); g.connect(hp);
            b.onended = () => { try { b.disconnect(); g.disconnect(); } catch { /* gone */ } };
          }
        }
      },
      stop() {
        if (stopped) return; stopped = true;
        const now = ctx.currentTime;
        if (hum) { hum.g.gain.cancelScheduledValues(now); hum.g.gain.setValueAtTime(hum.g.gain.value, now); hum.g.gain.linearRampToValueAtTime(0, now + 0.01); }
        setTimeout(() => {
          for (const n of nodes) { try { n.stop?.(); } catch { /* not a source */ } try { n.disconnect(); } catch { /* gone */ } }
        }, 80);
      },
    };
  }

  /**
   * ⚡ ONE DIE LANDS: a jolt of static as big as its face. `amt` is face/sides
   * (0…1) — a 6 on a d6 cracks, a 1 fizzes.
   */
  function jolt({ amt = 0.5, level = 0.6, delay = 0 } = {}) {
    if (!ensure() || level <= 0) return;
    const t0 = ctx.currentTime + delay, v = voice(t0, 0.8, 0.35);
    const hp = filt(v, 'highpass', 1500 + 2500 * amt);
    const n = 2 + Math.round(amt * 8);
    for (let i = 0; i < n; i++) {
      const t = t0 + Math.random() * (0.03 + 0.12 * amt), len = 0.003 + Math.random() * 0.015;
      const g = env(v, t, level * (0.4 + 0.6 * amt) * (0.5 + 0.5 * Math.random()), 0.0006, len);
      src(v, white, t, len + 0.01).connect(g); g.connect(hp);
    }
    hp.connect(v.out);
    if (amt > 0.55) {                                   // a big face also snaps
      const o = v.add(ctx.createOscillator()); o.type = 'sawtooth';
      o.frequency.setValueAtTime(1800 + 1400 * amt, t0); o.frequency.exponentialRampToValueAtTime(220, t0 + 0.07);
      const og = env(v, t0, 0.1 * level * amt, 0.001, 0.09); o.connect(og); og.connect(v.out); o.start(t0); o.stop(t0 + 0.12);
    }
  }

  /**
   * 🫨 THE RUMBLE BEFORE TAKE-OFF: low ground-shake that swells for `sec` and
   * stops dead (the hush). `amt` is how much he threw (`rumbleWeight`).
   */
  function growl(sec, { level = 0.6, amt = 1, delay = 0 } = {}) {
    if (!ensure() || level <= 0 || sec <= 0) return;
    const t0 = ctx.currentTime + delay, v = voice(t0, sec + 0.2, 0.3);
    const lp = filt(v, 'lowpass', 90, 1.2);
    lp.frequency.setValueAtTime(70, t0); lp.frequency.exponentialRampToValueAtTime(140 + 120 * Math.min(1.5, amt), t0 + sec);
    const g = v.add(ctx.createGain());
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.001, level * 0.9 * Math.min(1.6, amt)), t0 + sec);
    g.gain.setValueAtTime(level * 0.9 * Math.min(1.6, amt), t0 + sec - 0.008); g.gain.linearRampToValueAtTime(0, t0 + sec);
    // the stamp: a sub thump on a quickening beat
    const am = v.add(ctx.createGain()); am.gain.value = 0.6;
    const lfo = v.add(ctx.createOscillator()); lfo.type = 'square';
    lfo.frequency.setValueAtTime(5, t0); lfo.frequency.exponentialRampToValueAtTime(14, t0 + sec);
    const lg = v.add(ctx.createGain()); lg.gain.value = 0.4; lfo.connect(lg); lg.connect(am.gain);
    lfo.start(t0); lfo.stop(t0 + sec + 0.02);
    src(v, brown, t0, sec + 0.02).connect(lp); lp.connect(am); am.connect(g); g.connect(v.out);
  }

  /** 🛡️ A DIE HITS THE SHIELD: a zap into a glassy, humming wall. `amt` = its share of the shield. */
  function shieldHit({ amt = 0.5, vel = 0.7, delay = 0 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay, v = voice(t0, 1.2, 0.5);
    zap({ vel:vel * 0.8, delay });
    for (const [f, a, d] of [[620, 0.12, 0.5], [1370, 0.07, 0.35], [2210, 0.04, 0.25]]) {
      const o = v.add(ctx.createOscillator()); o.type = 'triangle'; o.frequency.value = f * (0.9 + 0.2 * Math.random());
      const og = env(v, t0, a * vel * (0.6 + amt), 0.002, d); o.connect(og); og.connect(v.out); o.start(t0); o.stop(t0 + d + 0.05);
    }
  }

  /** 💥 THE SHIELD BREAKS: a glassy burst over a low crack. */
  function shatter({ vel = 1, delay = 0 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay, v = voice(t0, 2, 0.6);
    const hp = filt(v, 'highpass', 2500); const g = env(v, t0, 0.7 * vel, 0.001, 0.6);
    src(v, white, t0, 0.8).connect(hp); hp.connect(g); g.connect(v.out);
    for (let i = 0; i < 14; i++) {
      const t = t0 + Math.random() * 0.35, o = v.add(ctx.createOscillator()); o.frequency.value = 2500 + Math.random() * 5000;
      const og = env(v, t, 0.05 * vel, 0.001, 0.08 + Math.random() * 0.15); o.connect(og); og.connect(v.out); o.start(t); o.stop(t + 0.3);
    }
    const b = v.add(ctx.createOscillator()); b.frequency.setValueAtTime(110, t0); b.frequency.exponentialRampToValueAtTime(40, t0 + 0.4);
    const bg = env(v, t0, 0.6 * vel, 0.003, 0.5); b.connect(bg); bg.connect(v.out); b.start(t0); b.stop(t0 + 0.6);
  }

  /** 🗡️ THE DRAW: a blade leaving the scabbard. */
  function shing({ vel = 1, delay = 0 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay, v = voice(t0, 1.2, 0.4);
    const bp = filt(v, 'bandpass', 2500, 6);
    bp.frequency.setValueAtTime(2500, t0); bp.frequency.exponentialRampToValueAtTime(8500, t0 + 0.22);
    const g = env(v, t0, 0.35 * vel, 0.01, 0.3); src(v, white, t0, 0.4).connect(bp); bp.connect(g); g.connect(v.out);
    for (const [f, a, d] of [[2130, 0.08, 0.7], [3470, 0.06, 0.55], [5610, 0.05, 0.4], [7920, 0.03, 0.3]]) {
      const o = v.add(ctx.createOscillator()); o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.004);
      const og = env(v, t0 + 0.05, a * vel, 0.004, d); o.connect(og); og.connect(v.out); o.start(t0 + 0.05); o.stop(t0 + 0.06 + d);
    }
  }

  /** ⚡ THE CLAP: a crack on top of him — a snap, a burst of torn air, a sub drop. */
  function crack({ vel = 1, delay = 0 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay, v = voice(t0, 2.5, 0.7);
    // the snap
    const hp = filt(v, 'highpass', 3000); const sg = env(v, t0, 0.9 * vel, 0.0005, 0.03);
    src(v, white, t0, 0.05).connect(hp); hp.connect(sg); sg.connect(v.out);
    // torn air: a burst whose brightness collapses
    const lp = filt(v, 'lowpass', 9000, 0.9);
    lp.frequency.setValueAtTime(9000, t0); lp.frequency.exponentialRampToValueAtTime(500, t0 + 0.45);
    const bg = env(v, t0, 0.8 * vel, 0.002, 0.55); src(v, white, t0, 0.7).connect(lp); lp.connect(bg); bg.connect(v.out);
    // the boom under it
    const o = v.add(ctx.createOscillator()); o.type = 'sine';
    o.frequency.setValueAtTime(95, t0); o.frequency.exponentialRampToValueAtTime(32, t0 + 0.6);
    const og = env(v, t0, 0.9 * vel, 0.004, 0.8); o.connect(og); og.connect(v.out); o.start(t0); o.stop(t0 + 0.9);
  }

  /** 🌩️ THE ROLL: `sec` of low, uneven thunder rolling away. */
  function rumble(sec, { vel = 1, delay = 0 } = {}) {
    if (!ensure() || sec <= 0) return;
    const t0 = ctx.currentTime + delay, v = voice(t0, sec + 0.5, 0.6);
    const lp = filt(v, 'lowpass', 220, 0.8);
    lp.frequency.setValueAtTime(420, t0); lp.frequency.exponentialRampToValueAtTime(110, t0 + sec);
    const g = v.add(ctx.createGain());
    // a lumpy envelope: a few swells, each quieter than the last
    const n = 64, curve = new Float32Array(n);
    let lump = 1;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      if (Math.random() < 0.12) lump = 0.5 + Math.random() * 0.7;
      curve[i] = vel * 0.9 * Math.min(1, k * 14) * Math.pow(1 - k, 1.6) * lump;
    }
    curve[n - 1] = 0;
    g.gain.setValueCurveAtTime(curve, t0, sec);
    src(v, brown, t0, sec + 0.05).connect(lp); lp.connect(g); g.connect(v.out);
  }

  /** ⚡ A BOLT FROM THE SKY: a crackle, a falling chirp, a small clap. */
  function zap({ vel = 0.5, delay = 0 } = {}) {
    if (!ensure() || vel <= 0) return;
    const t0 = ctx.currentTime + delay, v = voice(t0, 1, 0.5);
    const o = v.add(ctx.createOscillator()); o.type = 'sawtooth';
    o.frequency.setValueAtTime(2600, t0); o.frequency.exponentialRampToValueAtTime(140, t0 + 0.09);
    const og = env(v, t0, 0.18 * vel, 0.001, 0.12); const lp = filt(v, 'lowpass', 5000);
    o.connect(lp); lp.connect(og); og.connect(v.out); o.start(t0); o.stop(t0 + 0.15);
    const bp = filt(v, 'bandpass', 1800, 0.8); const ng = env(v, t0, 0.7 * vel, 0.001, 0.18);
    src(v, white, t0, 0.25).connect(bp); bp.connect(ng); ng.connect(v.out);
  }

  /**
   * 🔒 THE SHEATH: "chin". `mode` 'click' (the guard meeting the mouth) or
   * 'ring' (and the blade rings on the Ronin's own note, `freq`).
   */
  function sheath({ mode = 'ring', freq = 1046.5, vel = 1, delay = 0 } = {}) {
    if (mode === 'off' || !ensure()) return;
    const t0 = ctx.currentTime + delay, v = voice(t0, 2.2, 0.35);
    const bp = filt(v, 'bandpass', 4200, 3); const cg = env(v, t0, 0.5 * vel, 0.0005, 0.02);
    src(v, white, t0, 0.04).connect(bp); bp.connect(cg); cg.connect(v.out);
    const k = v.add(ctx.createOscillator()); k.frequency.value = 900;
    const kg = env(v, t0, 0.25 * vel, 0.001, 0.05); k.connect(kg); kg.connect(v.out); k.start(t0); k.stop(t0 + 0.08);
    if (mode === 'ring') {
      // a struck bar's modes (1 : 2.756 : 5.404), the same physics as `landingSfx`
      for (const [r, a, d] of [[1, 0.16, 1.6], [2.756, 0.07, 0.9], [5.404, 0.035, 0.5]]) {
        const o = v.add(ctx.createOscillator()); o.frequency.value = freq * r;
        const og = env(v, t0 + 0.003, a * vel, 0.002, d); o.connect(og); og.connect(v.out); o.start(t0); o.stop(t0 + d + 0.05);
      }
    }
  }

  function stopAll() {
    for (const s of live) { try { s.stop(); } catch { /* not started yet or done */ } }
    live.clear();
  }

  return { ensure, setMix, charge, chargeLive, jolt, growl, shieldHit, shatter, shing, crack, rumble, zap, sheath, stopAll };
}

/**
 * ⚡ THE WHOLE STRIKE'S SOUND, laid on the battle clock at the attacker's ROLL.
 *
 * @param sfx      a `createBushidoSfx()` (one per client, like the landing sfx)
 * @param battle   the frozen verdict — `bushidoDist`, `dicePool`/`diceVals`,
 *                 `droppedDicePool`, `shots`, `breakIndex`
 * @param at       sequence seconds → seconds from NOW (the caller's gated clock)
 * @param landings his Drive dice as `{ t, amt }` (sequence seconds; `amt` =
 *                 face / sides) — from `arenaDieTiming`, so the jolts land with
 *                 the dice the table is watching
 * @param launch   the sequence second he draws (the Sonic's launch beat)
 * 📌 The Rival's half (his dice, his shield chord) is the Sonic's own audio.
 */
export function scheduleBushidoStrike(sfx, { battle, at, landings = [], launch, L = BUSHIDO_STRIKE, landing = null }) {
  const shots = battle.shots ?? [];
  const plan = planStrike(L, { dist:battle.bushidoDist ?? 4, clashMs:launch * 1000, shots:shots.length });
  const sec = ms => ms / 1000;
  const when = t => { const d = at(t); return d >= -0.05 ? Math.max(0, d) : null; };
  const kept = battle.diceVals ?? [], pool = battle.dicePool ?? [];
  const ceiling = Math.max(1, Math.max(6, ...pool) * Math.max(1, kept.length));
  const charge = Math.min(1, kept.reduce((a, v) => a + v, 0) / ceiling);
  // the static: from his throw to the hush, as loud as his dice made it
  const first = landings.length ? Math.min(...landings.map(d => d.t)) - 0.6 : launch - 3;
  const d0 = when(first);
  if (d0 != null) sfx.charge(Math.max(0.2, sec(plan.stanceEnd) - first), { mode:L.chargeSound, level:L.chargeLevel * (0.45 + 0.55 * charge), delay:d0 });
  for (const d of landings) { const w = when(d.t); if (w != null) sfx.jolt({ amt:d.amt, level:L.joltLevel, delay:w }); }
  const thrown = [...pool, ...(battle.droppedDicePool ?? [])];
  const g = when(sec(plan.rumbleStart));
  if (g != null && plan.stanceEnd > plan.rumbleStart) sfx.growl(sec(plan.stanceEnd - plan.rumbleStart), { level:L.rumbleSound, amt:rumbleWeight(thrown), delay:g });
  const v = when(sec(plan.vanish));
  if (v != null && L.drawShing === 'on') sfx.shing({ vel:0.9, delay:v });
  const th = when(sec(plan.thunderAt));
  if (th != null) {
    const vel = L.thunderLevel * (0.75 + 0.25 * charge);
    if (L.thunder === 'both' || L.thunder === 'crack') sfx.crack({ vel, delay:th });
    if (L.thunder === 'both' || L.thunder === 'roll') sfx.rumble(L.rumbleSec, { vel:vel * 0.8, delay:th + 0.05 });
  }
  for (const s of plan.sky) { const w = when(sec(s.at)); if (w != null) sfx.zap({ vel:L.zapLevel, delay:w }); }
  const arrive = when(sec(plan.arrive));
  if (arrive != null && L.landSound === 'shipped' && landing) {
    const S = STANDEE_MOVE, f = midiFreq(12 * (S.octave + 1) + S.keyRoot);
    setTimeout(() => landing.land(S.voice, [f], { vel:0.9, ring:S.ring, bright:S.bright, sparkle:S.sparkleTail, weight:S.weight }), arrive * 1000);
  }
  const hp = Math.max(1, battle.shieldValue ?? 1);
  shots.forEach(shot => {
    const w = when(launch + barrageContact(shot.index, BUSHIDO_BEATS));
    if (w == null) return;
    if (shot.before > 0) sfx.shieldHit({ amt:shot.absorbed / hp, vel:0.5 + 0.4 * Math.min(1, shot.strength / 8), delay:w });
    else sfx.zap({ vel:0.6 * L.zapLevel + 0.2, delay:w });
    if (shot.index === battle.breakIndex) sfx.shatter({ vel:0.9, delay:w + 0.02 });
  });
  const sh = when(sec(plan.sheathAt));
  if (sh != null && L.sheath !== 'off') sfx.sheath({ mode:L.sheath, delay:sh });
}

/** The one landing voice the strike borrows — the shipped stone-on-glass. */
export const bushidoLandingSfx = () => createLandingSfx();
