import { playSpiritSting, stopSpiritSting } from '../../src/audio/spiritSting.js';
import { CHARACTERS } from './timeline.js';

// Own context, so pause/seek/replay can stop the entire preview without touching
// another game tab. The riff itself is the exact production picker function.
export function createIntroAudio() {
  let ctx = null, output = null;
  const live = new Set();
  function stop() {
    if (!ctx) return;
    stopSpiritSting(ctx);
    for (const item of [...live]) item();
  }
  async function enable() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC(); output = ctx.createGain(); output.gain.value = .6; output.connect(ctx.destination);
    }
    await ctx.resume(); return ctx.state === 'running';
  }
  function boom(weight) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime, nodes = [], sources = [];
    const g = ctx.createGain(); nodes.push(g); g.connect(output);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(weight, t + .012); g.gain.exponentialRampToValueAtTime(.001, t + 2.3);
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2.4), ctx.sampleRate), data = buffer.getChannelData(0);
    let last = 0; for (let i = 0; i < data.length; i++) { last = (last + (Math.random() * 2 - 1) * .025) / 1.025; data[i] = last * 4; }
    const noise = ctx.createBufferSource(); noise.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 850;
    noise.connect(filter); filter.connect(g); nodes.push(noise, filter); sources.push(noise);
    const sub = ctx.createOscillator(), subGain = ctx.createGain(); sub.type = 'sine';
    sub.frequency.setValueAtTime(90, t); sub.frequency.exponentialRampToValueAtTime(29, t + .7);
    subGain.gain.value = .45; sub.connect(subGain); subGain.connect(g); nodes.push(sub, subGain); sources.push(sub);
    const clean = () => { sources.forEach(s => { try { s.stop(); } catch { /* ended */ } }); nodes.forEach(n => n.disconnect()); live.delete(clean); };
    live.add(clean); noise.onended = clean; sources.forEach(s => { s.start(t); s.stop(t + 2.4); });
  }
  return { enable, stop,
    cue(c) {
      if (!ctx || ctx.state !== 'running') return;
      if (c.kind === 'riff') playSpiritSting(ctx, CHARACTERS[c.seat]);
      else boom(c.kind === 'thunder' ? .75 : c.kind === 'crash' ? .48 : .12);
    },
    async pause() { stop(); if (ctx?.state === 'running') await ctx.suspend(); },
    dispose() { stop(); output?.disconnect(); ctx?.close(); ctx = null; },
  };
}
