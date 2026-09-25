import { pitchIndex } from '../music/notes.js';

// ─── 🗡️ THE SWING SOUNDS HARD (Alex, 2026-09-24) ─────────────────────────────
// "A Swing attack should sound more like a *strike* than a chord playing out -
//  its the Drive vs Drive so it should sound out *hard*."
//
// ⭐ BUILT FROM EACH SPIRIT'S OWN DRIVE STACK, like every battle sound — but
// voiced as a POWER CHORD (the stack's lowest note, its fifth and its octave,
// dropped an octave and driven into distortion) rather than the stack played
// as a chord. A Sonic is a chord that travels; a Swing is a riff that lands.
//
// Three moments, called by the client on its own beats:
//   playSwingCharge — a Spirit's amp fires into the raised instrument
//   playSwingStrike — the clash: both power chords, a metal hit, a sub thump
// The stronger the roll (`power`, 0–1, the same number that sizes the beam),
// the louder and longer each one rings.

const curve = (() => { let c = null; return () => {
  if (c) return c; c = new Float32Array(2048);
  for (let i = 0; i < c.length; i++) { const x = i / 1024 - 1; c[i] = Math.tanh(x * 9) * .9; }
  return c;
}; })();

/** The power chord a Drive stack makes: root, fifth, octave, an octave down. */
export function swingPowerChord(notes = []) {
  const pitches = notes.map(pitchIndex).filter(p => p >= 0);
  const root = pitches.length ? Math.min(...pitches) : 7;   // no stack → G, still a riff
  return [0, 7, 12].map(step => 65.4064 * 2 ** ((root + step) / 12));
}

function voice(ctx, destination, freqs, { at, length, level, detune = 9, bright = 2600 }) {
  const nodes = [], sources = [];
  const shaper = ctx.createWaveShaper(); shaper.curve = curve(); shaper.oversample = '4x';
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.setValueAtTime(bright, at);
  tone.frequency.exponentialRampToValueAtTime(Math.max(300, bright * .25), at + length);
  const out = ctx.createGain(); out.gain.setValueAtTime(.0001, at);
  out.gain.exponentialRampToValueAtTime(level, at + .008); out.gain.exponentialRampToValueAtTime(.0001, at + length);
  shaper.connect(tone); tone.connect(out); out.connect(destination); nodes.push(shaper, tone, out);
  for (const f of freqs) for (const cents of [-detune, detune]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * 2 ** (cents / 1200);
    const g = ctx.createGain(); g.gain.value = .35;
    o.connect(g); g.connect(shaper); o.start(at); o.stop(at + length + .05); nodes.push(o, g); sources.push(o);
  }
  return { nodes, sources };
}

function noiseHit(ctx, destination, { at, length, level, freq, type = 'highpass' }) {
  const n = ctx.createBufferSource(), b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate), d = b.getChannelData(0);
  let seed = 4099; for (let i = 0; i < d.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; d[i] = (seed / 2147483648 - 1) * (1 - i / d.length) ** 2; }
  n.buffer = b; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = level; n.connect(f); f.connect(g); g.connect(destination); n.start(at);
  return { nodes:[n, f, g], sources:[n] };
}

const collect = parts => {
  const nodes = parts.flatMap(p => p.nodes), sources = parts.flatMap(p => p.sources); let stopped = false;
  return () => { if (stopped) return; stopped = true;
    for (const s of sources) { try { s.stop(); } catch { /* done */ } } for (const n of nodes) n.disconnect?.(); };
};

/** A Spirit's amp slams its Drive into the raised instrument: a hard chug. */
export function playSwingCharge(ctx, notes, { power = .5, destination = ctx.destination, delay = 0 } = {}) {
  const at = ctx.currentTime + Math.max(0, delay), p = Math.max(0, Math.min(1, power));
  return collect([
    voice(ctx, destination, swingPowerChord(notes), { at, length:.5 + p * .5, level:.07 + p * .07, bright:1400 + p * 2200 }),
    noiseHit(ctx, destination, { at, length:.06, level:.12, freq:2400 }),
  ]);
}

/**
 * ⚔️ The clash. Both power chords at once, a bright metal transient, an
 * inharmonic ring (the instruments meeting) and a sub thump underneath.
 */
export function playSwingStrike(ctx, attackerNotes, rivalNotes, { powers = [.5, .5], destination = ctx.destination, delay = 0 } = {}) {
  const at = ctx.currentTime + Math.max(0, delay), [pa, pb] = powers.map(p => Math.max(0, Math.min(1, p ?? .5)));
  const parts = [
    voice(ctx, destination, swingPowerChord(attackerNotes), { at, length:.8 + pa * .7, level:.08 + pa * .08, bright:3200 }),
    voice(ctx, destination, swingPowerChord(rivalNotes), { at, length:.8 + pb * .7, level:.08 + pb * .08, bright:3200, detune:14 }),
    noiseHit(ctx, destination, { at, length:.09, level:.3, freq:1800 }),
    noiseHit(ctx, destination, { at:at + .01, length:.5, level:.12, freq:4200, type:'bandpass' }),
  ];
  const ring = { nodes:[], sources:[] };
  for (const [ratio, level] of [[1, .05], [2.76, .035], [5.4, .02]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = 440 * ratio;
    g.gain.setValueAtTime(level, at); g.gain.exponentialRampToValueAtTime(.0001, at + 1.1);
    o.connect(g); g.connect(destination); o.start(at); o.stop(at + 1.2); ring.nodes.push(o, g); ring.sources.push(o);
  }
  const thump = { nodes:[], sources:[] }, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(95, at); o.frequency.exponentialRampToValueAtTime(38, at + .35);
  g.gain.setValueAtTime(.35, at); g.gain.exponentialRampToValueAtTime(.0001, at + .4);
  o.connect(g); g.connect(destination); o.start(at); o.stop(at + .45); thump.nodes.push(o, g); thump.sources.push(o);
  return collect([...parts, ring, thump]);
}
