// =============================================================================
// audio/unlockSfx.js — 🔓 THE SEAT-UNLOCK HIT (2026-09-28)
// -----------------------------------------------------------------------------
// The sound under the moment a Lost Chord opens a stack seat: a sub BOOM with a
// crash on top (the cabinet landing), a bright three-note chime (the seat), and
// the crowd ROARING. The Spirit then plays the new chord in their signature
// build — that part is the caller's (`audio/commitStyles.js`).
// Pure Web Audio: the caller hands in the context and the bus to play into.
// =============================================================================

/** Every level and length here is a dial-in lever. */
export const UNLOCK_SFX = Object.freeze({
  boom:  0.55, boomFrom: 120, boomTo: 36, boomFor: 0.9,
  crash: 0.20, crashHz: 2400, crashFor: 1.1,
  chime: 0.07, chimeHz: [1046.5, 1568, 2093], chimeGap: 0.07,
  roar:  0.16, roarFor: 2.4, woos: 5,
  landAt: 0.42,       // s — the second, smaller thud when the cabinet lands
});

function noiseBuffer(ctx, seconds) {
  const key = `__rlswNoise${Math.round(seconds * 10)}`;
  if (ctx[key]?.sampleRate === ctx.sampleRate) return ctx[key];
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  ctx[key] = buf;
  return buf;
}

function boom(ctx, out, t, level, S) {
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(S.boomFrom, t);
  o.frequency.exponentialRampToValueAtTime(S.boomTo, t + S.boomFor * 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + S.boomFor);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + S.boomFor + 0.05);
}

function burst(ctx, out, t, level, hz, dur, q = 0.8) {
  const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 2);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = hz; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + dur + 0.05);
}

/**
 * @param {AudioContext} ctx
 * @param {AudioNode} out  the master bus
 * @param {{short?:boolean}} [opts]  a bot's unlock: the boom and chime only
 */
export function playUnlockHit(ctx, out, { short = false } = {}, S = UNLOCK_SFX) {
  try {
    if (!ctx || !out) return;
    const t = ctx.currentTime + 0.02;
    const k = short ? 0.6 : 1;
    boom(ctx, out, t, S.boom * k, S);
    burst(ctx, out, t, S.crash * k, S.crashHz, S.crashFor);
    S.chimeHz.forEach((hz, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz;
      const g = ctx.createGain(); const at = t + 0.05 + i * S.chimeGap;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(S.chime * k, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.9);
      o.connect(g); g.connect(out); o.start(at); o.stop(at + 0.95);
    });
    if (short) return;
    // The cabinet lands.
    boom(ctx, out, t + S.landAt, S.boom * 0.45, { ...S, boomFrom: 90, boomFor: 0.5 });
    // 👏 The crowd: a swelling wash of voices, and a few "WOO"s gliding up out of it.
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 3);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(S.roar, t + 0.35);
    g.gain.setValueAtTime(S.roar, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.001, t + S.roarFor);
    n.connect(bp); bp.connect(g); g.connect(out); n.start(t); n.stop(t + S.roarFor + 0.1);
    for (let i = 0; i < S.woos; i++) {
      const at = t + 0.15 + Math.random() * 0.6, f0 = 380 + Math.random() * 220;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f0 * 1.7, at + 0.5);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      const vg = ctx.createGain();
      vg.gain.setValueAtTime(0, at); vg.gain.linearRampToValueAtTime(S.roar * 0.18, at + 0.08);
      vg.gain.exponentialRampToValueAtTime(0.001, at + 0.75);
      o.connect(lp); lp.connect(vg); vg.connect(out); o.start(at); o.stop(at + 0.8);
    }
  } catch { /* audio is best effort */ }
}
