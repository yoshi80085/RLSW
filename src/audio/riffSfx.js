const RIFF_NATURALS     = ['a','b','c','d','e','f','g'];
const RIFF_SHARPABLE    = new Set(['a','c','d','f','g']);  // no B♯ / E♯
const RIFF_NAT_SEMIS    = [0, 2, 3, 5, 7, 8, 10];          // a b c d e f g — A natural minor

let riffAudioCtx = null;
export function getRiffAudio() {
  try {
    if (!riffAudioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      riffAudioCtx = new AC();
    }
    if (riffAudioCtx.state === 'suspended') riffAudioCtx.resume();
    return riffAudioCtx;
  } catch { return null; }
}

// Pitch comes from the UNWRAPPED scale degree, so an ascending run truly
// climbs across octaves instead of wrapping g→a back down. Degree 0 = A2 —
// dropped a full octave into chug register so riffs land HEAVY through the
// amp's saw/fuzz voices (the sub oscillator growls at A1 under the root).
export function riffDegreeFreq(degree, sharp) {
  const idx = ((degree % 7) + 7) % 7;
  const oct = Math.floor(degree / 7);
  let semis = RIFF_NAT_SEMIS[idx] + oct * 12
    + (sharp && RIFF_SHARPABLE.has(RIFF_NATURALS[idx]) ? 1 : 0)
    - 12;                                       // 🤘 the octave drop
  semis = Math.max(-26, Math.min(20, semis));   // ~A1 growl up to ~F5 lead
  return 220 * Math.pow(2, semis / 12);
}

// Wrong key still makes a sound — the note they actually pressed, bending
// sourly downward. The mistake is audible, like a real fumbled riff.
export function playRiffWrong(letter) {
  const ctx = getRiffAudio(); if (!ctx) return;
  const idx  = RIFF_NATURALS.indexOf(letter.toLowerCase());
  const base = idx >= 0
    ? 220 * Math.pow(2, (RIFF_NAT_SEMIS[idx] + (letter === letter.toUpperCase() ? 1 : 0)) / 12)
    : 180;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator(); osc.type = 'square';
  osc.frequency.setValueAtTime(base, t);
  osc.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.3);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(f); f.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.4);
}

// 🗡️ RIFF SLAYER — pick a riff note DIFFERENT from the current one, plus its
// frequency, so a glitched note both looks and sounds like a different target.
export function pickGlitchRiffNote(current) {
  // Build the pool of valid riff note tokens (naturals + sharpable uppercase)
  const pool = [];
  RIFF_NATURALS.forEach(n => {
    pool.push(n);
    if (RIFF_SHARPABLE.has(n)) pool.push(n.toUpperCase());
  });
  const choices = pool.filter(n => n !== current);
  const letter  = choices[Math.floor(Math.random() * choices.length)] ?? current;
  const idx     = RIFF_NATURALS.indexOf(letter.toLowerCase());
  const freq    = idx >= 0
    ? 220 * Math.pow(2, (RIFF_NAT_SEMIS[idx] + (letter === letter.toUpperCase() ? 1 : 0)) / 12)
    : 180;
  return { letter, freq };
}

// Timed-out note: a muted string scrape (filtered noise burst)
export function playRiffMiss() {
  const ctx = getRiffAudio(); if (!ctx) return;
  const len = 0.18;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.value = 0.22;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start();
}

// ── BEAM-CLASH SFX (Kamehameha) — synthesized through the riff audio path ──
// playBeamClash: rising detuned whine + swelling crackle + sub rumble as the
// two beams meet. playBeamSurge: a "power up" riser for the Round 2 escalation.
// playBeamBreak: the overpower explosion when one beam breaks through.
export function playBeamClash(intense = false) {
  const ctx = getRiffAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  const dur = intense ? 1.5 : 1.2;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(intense ? 0.5 : 0.36, t + 0.18);
  master.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  master.connect(ctx.destination);
  // Two detuned saws sweeping UP as the beams collide
  [0, 7].forEach((det) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const base = (intense ? 220 : 160) + det;
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * (intense ? 4.2 : 3.2), t + 0.5);
    const g = ctx.createGain(); g.gain.value = 0.18;
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur);
  });
  // Crackling energy — bandpassed noise that swells
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.4 + 0.6 * (i / d.length));
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(2600, t + dur); bp.Q.value = 0.7;
  const ng = ctx.createGain(); ng.gain.value = intense ? 0.5 : 0.38;
  src.connect(bp); bp.connect(ng); ng.connect(master);
  src.start(t);
  // Low rumble bed
  const sub = ctx.createOscillator(); sub.type = 'sine';
  sub.frequency.setValueAtTime(intense ? 70 : 55, t);
  const subG = ctx.createGain(); subG.gain.value = 0.4;
  sub.connect(subG); subG.connect(master);
  sub.start(t); sub.stop(t + dur);
}

export function playBeamSurge() {
  const ctx = getRiffAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(900, t + 1.2);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3500, t + 1.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  o.connect(f); f.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + 1.45);
  const o2 = ctx.createOscillator(); o2.type = 'triangle';
  o2.frequency.setValueAtTime(600, t);
  o2.frequency.exponentialRampToValueAtTime(1800, t + 1.2);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(0.16, t + 0.4);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  o2.connect(g2); g2.connect(ctx.destination);
  o2.start(t); o2.stop(t + 1.35);
}

export function playBeamBreak(intense = false) {
  const ctx = getRiffAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  const len = intense ? 1.4 : 1.0;
  // Explosion: lowpassed noise burst with long decay
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.6);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(intense ? 1800 : 1400, t);
  lp.frequency.exponentialRampToValueAtTime(140, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(intense ? 0.7 : 0.55, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(lp); lp.connect(g); g.connect(ctx.destination);
  src.start(t);
  // Downward boom sweep
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(intense ? 320 : 240, t);
  o.frequency.exponentialRampToValueAtTime(40, t + (intense ? 0.7 : 0.5));
  const og = ctx.createGain();
  og.gain.setValueAtTime(intense ? 0.55 : 0.4, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + (intense ? 0.8 : 0.6));
  o.connect(og); og.connect(ctx.destination);
  o.start(t); o.stop(t + 0.9);
}

// 🎆 FAN POP — a bright, bubbly "pop!" when new fans arrive. A big haul stacks a
// few staggered pops so it crackles like fireworks. Routed through the same synth
// path as the other SFX (no sample files).
export function playFanPop(n = 1) {
  const ctx = getRiffAudio(); if (!ctx) return;
  const pops = Math.max(1, Math.min(5, Math.round(n)));
  for (let k = 0; k < pops; k++) {
    const t = ctx.currentTime + k * 0.065;
    const base = 460 + Math.random() * 220 + k * 45;
    // Body — a quick upward chirp that pops, then settles and decays
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(base * 0.6, t);
    o.frequency.exponentialRampToValueAtTime(base * 2.4, t + 0.035);
    o.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + 0.2);
    // Transient — a tiny high-passed noise tick gives the lip-pop snap
    const len = 0.03;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const ng = ctx.createGain(); ng.gain.value = 0.16;
    src.connect(hp); hp.connect(ng); ng.connect(ctx.destination);
    src.start(t);
  }
}
