// ─── 🎸🔊 CURSED SHAMISEN — the sound of the curse ───────────────────────────
// Every sound is synthesised (no samples to license or ship), on the SFX bus,
// and built from the instrument Alex already dialled in: the plucks ARE
// `shamisenBuffer` (his 2026-09-28 string), only detuned and darkened.
//
//   pluck    — a tuned string / a phrase note: his shamisen, flattened `detune`
//              cents (a slightly-off string is the whole "cursed" colour)
//   snap     — a string breaking: a high twang, a whip of noise
//   bell     — a temple bell (bonshō): low inharmonic partials, slow beating, a long tail
//   hush     — the world holding its breath: a low brown-noise swell and a sub
//   hyuDoro  — a wisp leaving: kabuki's ghost cue, "hyū-dorodoro" — a breathy
//              rising flute glide over a soft low drum roll
//   slap     — the ofuda striking: paper slap + thud + a ♭2/♭5 cluster
//   infect   — a dissonant drone (1, ♭2, ♭5) swelling under the infection
//   burnOut  — a wisp dying: crackle and a puff
//   exorcise — the charm burning + a bright major arpeggio on the string + shimmer
//   expire   — the curse letting go: a quiet falling Iwato line
//
// `scheduleCast` lays the cast's sounds on `planCast`, the same plan the picture
// uses, so the two cannot drift.
import { getRiffAudio, getSfxBus } from './riffSfx.js';
import { shamisenBuffer } from './shamisen.js';
import { CURSED_SHAMISEN, IWATO } from '../board/cursedShamisen.js';

export const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

export function createShamisenCurseSfx({ context = getRiffAudio, output = getSfxBus } = {}) {
  let ctx = null, bus = null, brown = null, white = null;
  const live = new Set();
  const mix = { volume:CURSED_SHAMISEN.volume, room:CURSED_SHAMISEN.room };

  function ensure() {
    // ⚠️ an OfflineAudioContext (a render, a check) refuses resume() until it starts — swallow that, never throw
    if (ctx) { if (ctx.state === 'suspended') ctx.resume?.()?.catch?.(() => {}); return ctx; }
    ctx = context(); if (!ctx) return null;
    bus = {};
    bus.master = ctx.createGain(); bus.master.gain.value = mix.volume;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.3;
    bus.master.connect(comp); comp.connect(output(ctx));
    bus.dry = ctx.createGain(); bus.dry.connect(bus.master);
    bus.verb = ctx.createConvolver(); bus.verb.buffer = impulse(3.4);
    bus.wet = ctx.createGain(); bus.wet.gain.value = mix.room; bus.verb.connect(bus.wet); bus.wet.connect(bus.master);
    brown = noise(4, true); white = noise(2, false);
    return ctx;
  }
  function impulse(sec) {
    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2); }
    return buf;
  }
  function noise(sec, isBrown) {
    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (isBrown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    return buf;
  }
  function setMix({ vol, room } = {}) {
    if (vol != null) mix.volume = vol; if (room != null) mix.room = room;
    if (!ctx) return;
    bus.master.gain.setTargetAtTime(mix.volume, ctx.currentTime, 0.02); bus.wet.gain.setTargetAtTime(mix.room, ctx.currentTime, 0.02);
  }
  // One call's nodes, torn down after their tail (the 2026-09-30 voice-leak lesson).
  function voice(when, tail, send = 0.5) {
    const out = ctx.createGain(); out.connect(bus.dry);
    const s = ctx.createGain(); s.gain.value = send; out.connect(s); s.connect(bus.verb);
    const nodes = [out, s], add = n => { nodes.push(n); return n; };
    setTimeout(() => { for (const n of nodes) { try { n.disconnect(); } catch { /* gone */ } } }, Math.max(50, (when - ctx.currentTime + tail) * 1000 + 300));
    return { out, add };
  }
  const track = b => { live.add(b); b.onended = () => live.delete(b); return b; };
  const at = delay => ctx.currentTime + Math.max(0, delay);

  /**
   * One string. `bend` = SURI: it starts `bend` cents off and slides home over
   * `slide` s. `send` = how much goes to the room (a ghost is nearly all room).
   */
  function pluck(freq, { vel = 0.8, detune = CURSED_SHAMISEN.detune, delay = 0, dark = 0.4, bend = 0, slide = 0.14, send = 0.55 } = {}) {
    if (!ensure()) return;
    const when = at(delay), buf = shamisenBuffer(ctx, freq);
    const v = voice(when, buf.duration, send);
    const b = track(v.add(ctx.createBufferSource())); b.buffer = buf;
    const home = Math.pow(2, (detune + (Math.random() - 0.5) * 10) / 1200);
    b.playbackRate.setValueAtTime(home * Math.pow(2, bend / 1200), when);
    if (bend) b.playbackRate.exponentialRampToValueAtTime(home, when + slide);
    const lp = v.add(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 9000 - dark * 6500;
    const g = v.add(ctx.createGain()); g.gain.value = vel;
    b.connect(lp); lp.connect(g); g.connect(v.out); b.start(when);
  }
  function snap({ delay = 0 } = {}) {
    if (!ensure()) return;
    const when = at(delay), v = voice(when, 0.8, 0.3);
    const o = track(v.add(ctx.createOscillator())); o.type = 'sawtooth'; o.frequency.setValueAtTime(1900, when); o.frequency.exponentialRampToValueAtTime(240, when + 0.25);
    const g = v.add(ctx.createGain()); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.35, when + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
    const n = track(v.add(ctx.createBufferSource())); n.buffer = white;
    const hp = v.add(ctx.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = 2500;
    const ng = v.add(ctx.createGain()); ng.gain.setValueAtTime(0.5, when); ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
    o.connect(g); g.connect(v.out); n.connect(hp); hp.connect(ng); ng.connect(v.out);
    o.start(when); o.stop(when + 0.32); n.start(when); n.stop(when + 0.14);
  }
  /** Bonshō: the partials of a struck bronze bell, each with its own slow beat. */
  function bell(freq = 98, { delay = 0, vel = 0.8 } = {}) {
    if (!ensure()) return;
    const when = at(delay), tail = 9, v = voice(when, tail, 0.7);
    const parts = [[0.5, 1, 9], [1, 0.8, 7], [1.183, 0.35, 5], [1.506, 0.4, 4.5], [2, 0.3, 3.5], [2.514, 0.18, 2.5], [3.011, 0.12, 2]];
    for (const [r, a, d] of parts) for (const det of [-0.6, 0.6]) {
      const o = track(v.add(ctx.createOscillator())); o.type = 'sine'; o.frequency.value = freq * r + det;
      const g = v.add(ctx.createGain()); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vel * a * 0.18, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + d);
      o.connect(g); g.connect(v.out); o.start(when); o.stop(when + d + 0.05);
    }
    const n = track(v.add(ctx.createBufferSource())); n.buffer = white;
    const bp = v.add(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.5;
    const ng = v.add(ctx.createGain()); ng.gain.setValueAtTime(vel * 0.25, when); ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
    n.connect(bp); bp.connect(ng); ng.connect(v.out); n.start(when); n.stop(when + 0.1);
  }
  function hush(dur = 4, { delay = 0, rise = 0.7 } = {}) {
    if (!ensure()) return;
    const when = at(delay), v = voice(when, dur + 1.5, 0.6);
    const n = track(v.add(ctx.createBufferSource())); n.buffer = brown; n.loop = true;
    const lp = v.add(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 320;
    const sub = track(v.add(ctx.createOscillator())); sub.type = 'sine'; sub.frequency.value = 43;
    const g = v.add(ctx.createGain()); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.32, when + rise);
    g.gain.setValueAtTime(0.32, when + dur); g.gain.linearRampToValueAtTime(0.0001, when + dur + 1.2);
    const sg = v.add(ctx.createGain()); sg.gain.value = 0.5;
    n.connect(lp); lp.connect(g); sub.connect(sg); sg.connect(g); g.connect(v.out);
    n.start(when); n.stop(when + dur + 1.3); sub.start(when); sub.stop(when + dur + 1.3);
  }
  /** "Hyū-dorodoro": a ghost's entrance in kabuki — breathy rising glide, soft drum roll. */
  function hyuDoro({ delay = 0, vel = 0.6, dur = 1.6 } = {}) {
    if (!ensure()) return;
    const when = at(delay), v = voice(when, dur + 1, 0.8);
    const o = track(v.add(ctx.createOscillator())); o.type = 'sine';
    o.frequency.setValueAtTime(520, when); o.frequency.exponentialRampToValueAtTime(1500, when + dur * 0.55); o.frequency.exponentialRampToValueAtTime(1180, when + dur);
    const lfo = track(v.add(ctx.createOscillator())); lfo.frequency.value = 5.5; const lg = v.add(ctx.createGain()); lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);
    const og = v.add(ctx.createGain()); og.gain.setValueAtTime(0.0001, when); og.gain.linearRampToValueAtTime(vel * 0.18, when + 0.25); og.gain.linearRampToValueAtTime(0.0001, when + dur);
    const br = track(v.add(ctx.createBufferSource())); br.buffer = white; br.loop = true;
    const bp = v.add(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.setValueAtTime(900, when); bp.frequency.exponentialRampToValueAtTime(2600, when + dur * 0.6);
    const bg = v.add(ctx.createGain()); bg.gain.setValueAtTime(0.0001, when); bg.gain.linearRampToValueAtTime(vel * 0.12, when + 0.3); bg.gain.linearRampToValueAtTime(0.0001, when + dur);
    o.connect(og); og.connect(v.out); br.connect(bp); bp.connect(bg); bg.connect(v.out);
    o.start(when); o.stop(when + dur + 0.05); lfo.start(when); lfo.stop(when + dur + 0.05); br.start(when); br.stop(when + dur + 0.05);
    // dorodoro: a soft low drum roll under it
    for (let i = 0; i < 14; i++) {
      const t = when + 0.1 + i * 0.075, d = track(v.add(ctx.createOscillator())); d.type = 'sine';
      d.frequency.setValueAtTime(92, t); d.frequency.exponentialRampToValueAtTime(55, t + 0.12);
      const dg = v.add(ctx.createGain()); const a = vel * 0.22 * Math.sin(Math.PI * (i + 1) / 15);
      dg.gain.setValueAtTime(0.0001, t); dg.gain.linearRampToValueAtTime(a, t + 0.006); dg.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      d.connect(dg); dg.connect(v.out); d.start(t); d.stop(t + 0.16);
    }
  }
  function slap(rootHz, { delay = 0 } = {}) {
    if (!ensure()) return;
    const when = at(delay), v = voice(when, 1.2, 0.4);
    const n = track(v.add(ctx.createBufferSource())); n.buffer = white;
    const hp = v.add(ctx.createBiquadFilter()); hp.type = 'highpass'; hp.frequency.value = 1400;
    const ng = v.add(ctx.createGain()); ng.gain.setValueAtTime(0.9, when); ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    const th = track(v.add(ctx.createOscillator())); th.type = 'sine'; th.frequency.setValueAtTime(140, when); th.frequency.exponentialRampToValueAtTime(48, when + 0.18);
    const tg = v.add(ctx.createGain()); tg.gain.setValueAtTime(0.0001, when); tg.gain.linearRampToValueAtTime(0.8, when + 0.004); tg.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
    n.connect(hp); hp.connect(ng); ng.connect(v.out); th.connect(tg); tg.connect(v.out);
    n.start(when); n.stop(when + 0.07); th.start(when); th.stop(when + 0.27);
    for (const iv of [1, 6]) pluck(rootHz * Math.pow(2, iv / 12), { vel:0.55, delay:delay + 0.01, dark:0.2 });
  }
  function infect(rootHz, dur = 2, { delay = 0 } = {}) {
    if (!ensure()) return;
    const when = at(delay), v = voice(when, dur + 1.6, 0.7);
    for (const iv of [0, 1, 6, 12]) for (const det of [-3, 3]) {
      const o = track(v.add(ctx.createOscillator())); o.type = 'triangle'; o.frequency.value = rootHz / 2 * Math.pow(2, iv / 12) + det * 0.2;
      const g = v.add(ctx.createGain()); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.05, when + dur * 0.6);
      g.gain.linearRampToValueAtTime(0.0001, when + dur + 1.5);
      o.connect(g); g.connect(v.out); o.start(when); o.stop(when + dur + 1.6);
    }
  }
  function crackle(dur, vel, when, v) {
    for (let i = 0; i < Math.round(dur * 40); i++) {
      const t = when + Math.random() * dur, n = track(v.add(ctx.createBufferSource())); n.buffer = white;
      const bp = v.add(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 3500; bp.Q.value = 3;
      const g = v.add(ctx.createGain()); g.gain.setValueAtTime(vel * (0.3 + Math.random() * 0.7), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
      n.connect(bp); bp.connect(g); g.connect(v.out); n.start(t, Math.random()); n.stop(t + 0.02);
    }
  }
  function burnOut({ delay = 0 } = {}) {
    if (!ensure()) return;
    const when = at(delay), v = voice(when, 1.5, 0.5);
    crackle(0.7, 0.5, when, v);
    const n = track(v.add(ctx.createBufferSource())); n.buffer = brown;
    const g = v.add(ctx.createGain()); g.gain.setValueAtTime(0.0001, when + 0.5); g.gain.linearRampToValueAtTime(0.35, when + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, when + 1.1);
    n.connect(g); g.connect(v.out); n.start(when + 0.5); n.stop(when + 1.2);
  }
  function exorcise(rootHz, { delay = 0 } = {}) {
    if (!ensure()) return;
    const when = at(delay), v = voice(when, 3, 0.6);
    crackle(1.2, 0.6, when, v);
    [0, 4, 7, 12, 16].forEach((iv, i) => pluck(rootHz * 2 * Math.pow(2, iv / 12), { vel:0.7, detune:0, delay:delay + 0.35 + i * 0.09, dark:0 }));
    for (let i = 0; i < 6; i++) {
      const t = when + 0.5 + i * 0.07, o = track(v.add(ctx.createOscillator())); o.type = 'sine'; o.frequency.value = 2600 + Math.random() * 2400;
      const g = v.add(ctx.createGain()); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.04, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(g); g.connect(v.out); o.start(t); o.stop(t + 1.25);
    }
  }
  function expire(rootHz, { delay = 0 } = {}) {
    if (!ensure()) return;
    [10, 6, 1, 0].forEach((iv, i) => pluck(rootHz * Math.pow(2, iv / 12), { vel:0.35, delay:delay + i * 0.32, dark:0.75 }));
  }
  /** A low breath under the melody: the root and ♭2 as slow-beating sines, and air. */
  function drone(rootHz, dur, { delay = 0, level = 0.5 } = {}) {
    if (!ensure() || level <= 0) return;
    const when = at(delay), v = voice(when, dur + 2, 0.8);
    const g = v.add(ctx.createGain()); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.09 * level, when + 1.4);
    g.gain.setValueAtTime(0.09 * level, when + dur); g.gain.linearRampToValueAtTime(0.0001, when + dur + 1.8); g.connect(v.out);
    for (const [iv, det] of [[0, -0.7], [0, 0.7], [1, 0], [-12, 0.3]]) {
      const o = track(v.add(ctx.createOscillator())); o.type = 'sine'; o.frequency.value = rootHz / 2 * Math.pow(2, iv / 12) + det;
      o.connect(g); o.start(when); o.stop(when + dur + 1.9);
    }
    const n = track(v.add(ctx.createBufferSource())); n.buffer = white; n.loop = true;
    const bp = v.add(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.8;
    const ng = v.add(ctx.createGain()); ng.gain.value = 0.25;
    n.connect(bp); bp.connect(ng); ng.connect(g); n.start(when); n.stop(when + dur + 1.9);
  }
  function stopAll() { for (const b of live) { try { b.stop(); } catch { /* not started */ } } live.clear(); }
  return { ensure, setMix, pluck, drone, snap, bell, hush, hyuDoro, slap, infect, burnOut, exorcise, expire, stopAll };
}

/** A string's pitch for an Iwato note on the Ronin's root (`rootMidi`, e.g. 50 = D3). */
export const iwatoHz = (rootMidi, iv) => midiHz(rootMidi + iv);

/**
 * The cast's sound, laid on `plan` (`planCast`) — the same beats the picture
 * uses. `rootMidi` is the Ronin's root; the melody sits an octave above it.
 * Each score note becomes: its pluck (sliding home if it has a `bend`), a bachi
 * TREMOLO if it has `trem`, a quiet octave-up ECHO (`L.echo`), and for the
 * ghost almost nothing but room. The `dyad` note sounds the ♭2 against home.
 */
export function scheduleCast(sfx, plan, rootMidi, L = CURSED_SHAMISEN) {
  const s = ms => ms / 1000;
  sfx.hush(s(plan.hushOut), { rise:s(L.hushMs) });
  scheduleMelody(sfx, plan, rootMidi, L);
  sfx.hyuDoro({ delay:s(plan.wisps[0].launch), dur:s(plan.wisps.at(-1).arrive - plan.wisps[0].launch) });
  sfx.slap(midiHz(rootMidi + 12), { delay:s(plan.slapAt) });
  sfx.infect(midiHz(rootMidi + 12), s(L.infectMs), { delay:s(plan.infectStart) });
}
/** The melody alone — the drone, the bell and the score (the preview's 🎵 button auditions it). */
export function scheduleMelody(sfx, plan, rootMidi, L = CURSED_SHAMISEN) {
  const s = ms => ms / 1000, hz = semis => midiHz(rootMidi + 12 + semis);
  sfx.drone(midiHz(rootMidi), s(plan.phraseEnd - plan.phraseStart), { delay:s(plan.phraseStart) * 0.5, level:L.drone });
  if (plan.bellAt != null) sfx.bell(midiHz(rootMidi - 24), { delay:s(plan.bellAt) });
  for (const n of plan.notes) {
    const o = { vel:n.vel * (n.ghost ? 0.7 : 1), delay:s(n.at), detune:L.detune, bend:n.bend, dark:n.ghost ? 0.1 : n.ring ? 0.55 : 0.4, send:n.ghost ? 0.95 : 0.55 };
    sfx.pluck(hz(n.semis), o);
    for (let k = 1; k <= n.trem; k++) sfx.pluck(hz(n.semis), { ...o, bend:0, vel:n.vel * Math.pow(0.78, k), delay:o.delay + k * 0.068 });
    if (n.dyad != null) sfx.pluck(hz(n.semis + n.dyad), { ...o, bend:0, vel:n.vel * 0.8, delay:o.delay + 0.03 });
    if (L.echo > 0 && !n.ghost) sfx.pluck(hz(n.semis + 12), { ...o, bend:0, vel:n.vel * L.echo * 0.5, delay:o.delay + 0.19, dark:0.15, send:0.9 });
  }
}
export { IWATO };
