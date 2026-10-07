// ─── THE OPENING ACT'S THUNDER AND IMPACTS ──────────────────────────────────
// Ported from `previews/bardbarian-intro/audio.js` (`boom`), unchanged in shape:
// a low-passed brown-noise roll over a falling sine sub. Weights are the
// preview's: thunder .75, a standee's crash .48, the step onto the home hex .12.
// ⭐ ROUTED THROUGH THE SFX BUS (`riffSfx.getSfxBus`) so the mixer's SFX fader
// owns it, like every other effect in the match. The riffs themselves are the
// picker's own `playSpiritSting`, called by the client.

import { getSfxBus } from './riffSfx.js';

export const OPENING_BOOM = Object.freeze({ thunder: .75, crash: .48, step: .12 });

/** One boom on `ctx`. Returns a stop function (safe to call twice). */
export function playOpeningBoom(ctx, kind) {
  const weight = OPENING_BOOM[kind] ?? 0;
  if (!ctx || ctx.state !== 'running' || !weight) return () => {};
  const t = ctx.currentTime, nodes = [], sources = [];
  const g = ctx.createGain(); nodes.push(g); g.connect(getSfxBus(ctx));
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(weight, t + .012); g.gain.exponentialRampToValueAtTime(.001, t + 2.3);
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2.4), ctx.sampleRate), data = buffer.getChannelData(0);
  let last = 0; for (let i = 0; i < data.length; i++) { last = (last + (Math.random() * 2 - 1) * .025) / 1.025; data[i] = last * 4; }
  const noise = ctx.createBufferSource(); noise.buffer = buffer;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 850;
  noise.connect(filter); filter.connect(g); nodes.push(noise, filter); sources.push(noise);
  const sub = ctx.createOscillator(), subGain = ctx.createGain(); sub.type = 'sine';
  sub.frequency.setValueAtTime(90, t); sub.frequency.exponentialRampToValueAtTime(29, t + .7);
  subGain.gain.value = .45; sub.connect(subGain); subGain.connect(g); nodes.push(sub, subGain); sources.push(sub);
  let done = false;
  // ⚠️ Unplugged when it ends (the `voiceleak` rule): a finished boom must not
  // keep its nodes on the audio thread.
  const clean = () => { if (done) return; done = true;
    sources.forEach(s => { try { s.stop(); } catch { /* ended */ } }); nodes.forEach(n => { try { n.disconnect(); } catch { /* gone */ } }); };
  noise.onended = clean; sources.forEach(s => { s.start(t); s.stop(t + 2.4); });
  return clean;
}
