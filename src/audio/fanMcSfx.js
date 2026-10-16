// ─── 🎤 THE FAN MC'S SOUNDS — synthesized, no files ─────────────────────────
// The crowd's roar as he lands, the mic tap, the drumroll under the tease, the hit
// when he calls the effect, the whoosh as he flies. Dialled on
// `.scratch/fan-mc-preview.html` (`FAN_MC.volume`, `FAN_MC.roar`); the client fires
// them on the show's clock (`data/fanMc.js` fanMcSoundTimes).
import { FAN_MC } from '../data/fanMc.js';

let noiseBuf = null;
function noiseFor(ctx) {
  if (noiseBuf?.sampleRate === ctx.sampleRate) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function noise(ctx, out, at, dur, { f = 900, q = .7, gain = .3, attack = .3, type = 'bandpass' } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseFor(ctx); s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain();
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + attack); g.gain.exponentialRampToValueAtTime(.0005, at + dur);
  s.connect(fl).connect(g).connect(out); s.start(at); s.stop(at + dur + .05);
}
function tone(ctx, out, at, f0, f1, dur, gain = .4) {
  const o = ctx.createOscillator(); o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, at); g.gain.exponentialRampToValueAtTime(.0005, at + dur); o.connect(g).connect(out); o.start(at); o.stop(at + dur + .02);
}

/** Play one of the MC's sounds now: 'arrive' | 'tap' | 'roll' (dur s) | 'hit' | 'leave'. */
export function playFanMcSound(ctx, kind, { dur = 1, look = FAN_MC } = {}) {
  if (!ctx) return;
  const out = ctx.createGain(); out.gain.value = look.volume; out.connect(ctx.destination);
  const t = ctx.currentTime, R = look.roar;
  const roar = a => { noise(ctx, out, t, 2.6, { f:1100, q:.5, gain:.22 * a * R, attack:.35 }); noise(ctx, out, t, 2.2, { f:420, q:.6, gain:.16 * a * R, attack:.25 }); };
  const whoosh = () => noise(ctx, out, t, .8, { f:600, q:2, gain:.12, attack:.25 });
  if (kind === 'arrive') { whoosh(); roar(.8); }
  if (kind === 'tap') for (const k of [0, .28]) { tone(ctx, out, t + k, 140, 60, .12, .5); noise(ctx, out, t + k, .06, { f:3000, q:1, gain:.08, attack:.002 }); }
  if (kind === 'roll') { const n = Math.floor(Math.max(.4, dur) * 22); for (let i = 0; i < n; i++) noise(ctx, out, t + i / 22, .05, { f:1800, q:1.2, gain:.03 + .09 * (i / n), attack:.003 }); }
  if (kind === 'hit') { tone(ctx, out, t, 90, 32, .9, .7); noise(ctx, out, t, 1.2, { f:2400, q:.4, gain:.28, attack:.004 }); roar(1.4); }
  if (kind === 'leave') whoosh();
}
