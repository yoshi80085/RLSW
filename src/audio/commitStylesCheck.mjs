// ─── 🎸 COMMIT STYLES CHECK ──────────────────────────────────────────────────
// Alex, 2026-09-28: three builds per Spirit, "so it's not sounding the same all
// the time", and a shamisen for the Ronin. What this suite guards:
//   §1 every Spirit's set is three real builds, signature first;
//   §2 the pick is deterministic (online clients agree), never repeats a build on
//      a seat's consecutive turns, and walks the whole set in three rounds;
//   §3 every build, for every track length, schedules finite notes inside the
//      turn's ~3 s budget, and the Ronin's shamisen builds really ask for the
//      shamisen voices;
//   §4 the shamisen string itself: in tune, decays, and the sawari adds buzz;
//   §6 the SIGNATURE LAYER (2026-09-28): every build gets its Spirit's noises and
//      a doubled money note, adds no late onset, and leaves the build untouched.
// Run: npm run test:commitstyles
import { COMMIT_STYLE_SETS, COMMIT_STYLES, pickCommitStyle, playCommitStyle } from './commitStyles.js';
import { renderShamisenPluck, SHAMISEN } from './shamisen.js';
import { TONE_VOICES, TONE_VOICE_ORDER, playAmpNote, getAmpBuses, KATANA_SHAMISEN, RONIN_LEAD } from './ampVoice.js';
import { NOTE_POOL, pitchIndex } from '../music/notes.js';

let pass = 0; const failures = [];
const ok = (c, m) => { if (c) pass++; else { failures.push(m); console.log('  ✗', m); } };

console.log('🎸 commitStylesCheck — three builds a Spirit, and a shamisen\n');

console.log('§1 the sets');
{
  const spirits = Object.keys(COMMIT_STYLE_SETS);
  ok(spirits.length === 4, 'four signature Spirits');
  const sig = { cosmic_ronin: 'shred', Metalness_Monster: 'breakdown', intergalactic_0: 'scratch', Glamarchy: 'strut' };
  for (const id of spirits) {
    const set = COMMIT_STYLE_SETS[id];
    ok(set.length === 3 && new Set(set).size === 3, `${id}: three distinct builds`);
    ok(set[0] === sig[id], `${id}: the signature build (${sig[id]}) is still first`);
    ok(set.every(s => COMMIT_STYLES[s]?.label), `${id}: every build has a label`);
  }
  ok(COMMIT_STYLE_SETS.cosmic_ronin.includes('tsugaru') && COMMIT_STYLE_SETS.cosmic_ronin.includes('iai'), 'the Ronin plays Tsugaru and Iai');
}

console.log('§2 the pick');
{
  for (const id of Object.keys(COMMIT_STYLE_SETS)) for (const seat of [`${id}::red`, `${id}::blue`, `${id}::green`]) {
    const seq = Array.from({ length: 9 }, (_, r) => pickCommitStyle(id, { seatId: seat, round: r }));
    ok(seq.every((s, i) => s === pickCommitStyle(id, { seatId: seat, round: i })), `${seat}: deterministic`);
    ok(seq.every((s, i) => i === 0 || s !== seq[i - 1]), `${seat}: never the same build two turns running`);
    ok(new Set(seq.slice(0, 3)).size === 3, `${seat}: all three inside three rounds`);
  }
  ok(pickCommitStyle('riff_rat', { seatId: 'x', round: 1 }) === null, 'a Spirit with no set → null (classic groove)');
  const starts = new Set(['red', 'blue', 'green', 'purple'].map(c => pickCommitStyle('cosmic_ronin', { seatId: `cosmic_ronin::${c}`, round: 0 })));
  ok(starts.size >= 2, 'mirror seats do not all open on the same build');
}

console.log('§3 every build, every length');
{
  const BASE = 261.63;
  const lead = (note, prev) => {
    const pc = pitchIndex(note); if (!(pc >= 0)) return null;
    const base = BASE * Math.pow(2, pc / 12);
    if (!prev) return base;
    let best = base, bd = Infinity;
    for (const k of [-1, 0, 1]) { const f = base * 2 ** k; const d = Math.abs(Math.log2(f / prev)); if (d < bd) { bd = d; best = f; } }
    return best;
  };
  let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const style of Object.keys(COMMIT_STYLES)) {
    let worst = 0, onset = 0, bad = null, notes = 0, scratches = 0, voices = new Set();
    for (let n = 1; n <= 12; n++) for (let rep = 0; rep < 4; rep++) {
      const track = Array.from({ length: n }, () => NOTE_POOL[Math.floor(rand() * NOTE_POOL.length)]);
      const calls = [];
      const api = { now: () => 10, lead, pitchIndex, rand,
        note: (name, o) => calls.push({ name, ...o }),
        scratch: (name, hz, pattern, when) => { scratches++; calls.push({ name, freq: hz, when, holdTime: 0.4, fadeTime: 0 }); } };
      // ⚠️ The budget is measured WITH the signature layer (§6) — it must add no
      // late onset — but a build's VOICE is its own, so that is read layer-off.
      ok(playCommitStyle(style, track, api) === true, `${style} n=${n}: plays`);
      const bare = [];
      playCommitStyle(style, track, { ...api, note: (name, o) => bare.push({ name, ...o }), scratch() {} }, { layer: false });
      for (const c of bare) if (c.knobs?.voice) voices.add(c.knobs.voice);
      notes += calls.length;
      for (const c of calls) {
        const nums = [c.when, c.holdTime ?? 1.1, c.fadeTime ?? 0.8, c.volume ?? 0.18, ...(c.freq === undefined ? [] : [c.freq])];
        if (!nums.every(Number.isFinite) || c.when < 10) bad ??= `${style} n=${n}: ${JSON.stringify(c)}`;
        worst = Math.max(worst, c.when + (c.holdTime ?? 1.1) + (c.fadeTime ?? 0.8) - 10);
        onset = Math.max(onset, c.when - 10);
      }
    }
    ok(!bad, `${style}: every scheduled note is finite and after the anchor${bad ? ` — ${bad}` : ''}`);
    ok(notes > 0, `${style}: schedules notes`);
    // 📏 The legacy four were measured, not guessed: their last ONSET lands by
    // ~3.1 s and their longest ring-out ends by ~5.2 s. The new builds are held
    // to the same envelope so no Spirit's commit holds the turn up longer.
    console.log(`    ${style.padEnd(10)} last onset ≤ ${onset.toFixed(2)} s · rings out by ${worst.toFixed(2)} s`);
    ok(onset <= 3.2, `${style}: the last note starts inside the old budget (${onset.toFixed(2)} s)`);
    ok(worst <= 5.3, `${style}: the longest track rings out no later than the old builds (${worst.toFixed(2)} s)`);
    if (style === 'scratch') ok(scratches > 0, 'scratch: reaches the vinyl atom');
    if (style === 'tsugaru') ok(voices.has('shamisen') && voices.size === 1, 'tsugaru: plays the clean shamisen');
    if (style === 'iai') ok(voices.has('shamisen_dist') && voices.size === 1, 'iai: plays the distorted shamisen');
    if (style === 'shred') ok(voices.size === 0, 'shred: plays the seat’s own rig (the KATANA)');
  }
  ok(playCommitStyle('nope', ['C'], { now: () => 0, note() {} }) === false, 'an unknown build declines');
  ok(playCommitStyle('shred', [], { now: () => 0, note() {} }) === false, 'an empty track declines');
}

console.log('§4 the shamisen string');
{
  ok(TONE_VOICES.shamisen?.pluck && TONE_VOICES.shamisen.clean, 'SHAMISEN is a clean plucked voice');
  const ALEX = { t60: 3.15, bright: 0.87, pluckPos: 0.09, sawariEdge: 0.67, sawariHz: 4650, bachi: 1.16, skin: 0.79 };
  ok(Object.entries(ALEX).every(([k, v]) => SHAMISEN[k] === v), 'Alex’s shamisen dial-in (2026-09-28) is what ships');
  { const x = renderShamisenPluck(48000, 196); ok(x[x.length - 1] === 0 && Math.abs(x[x.length - 200]) < 0.01, 'the rendered string ends in silence (no click)'); }
  ok(TONE_VOICES.shamisen_dist?.pluck && TONE_VOICES.shamisen_dist.lead, 'ONI SHAMISEN is plucked and runs the lead stages');
  ok(TONE_VOICE_ORDER.includes('shamisen') && TONE_VOICE_ORDER.includes('shamisen_dist'), 'both are on the voice button');
  const sr = 48000;
  for (const f of [146.8, 220, 392, 659.3]) {
    const x = renderShamisenPluck(sr, f);
    ok(x.every(Number.isFinite), `${f} Hz: finite`);
    const peak = x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    ok(Math.abs(peak - SHAMISEN.level) < 1e-3, `${f} Hz: normalised to ${SHAMISEN.level}`);
    const seg = x.subarray(Math.floor(0.3 * sr), Math.floor(0.45 * sr));
    let best = -Infinity, bl = 0;
    for (let lag = Math.floor(sr / (f * 1.1)); lag <= Math.ceil(sr / (f * 0.9)); lag++) {
      let c = 0; for (let i = 0; i + lag < seg.length; i++) c += seg[i] * seg[i + lag];
      if (c > best) { best = c; bl = lag; }
    }
    const cents = 1200 * Math.log2((sr / bl) / f);
    ok(Math.abs(cents) < 1200 * Math.log2((bl + 1) / bl) + 2, `${f} Hz: in tune to the lag resolution (${cents.toFixed(1)}¢)`);
    const rms = (a, b) => Math.sqrt(x.subarray(Math.floor(a * sr), Math.floor(b * sr)).reduce((s, v) => s + v * v, 0) / ((b - a) * sr));
    ok(rms(0.9, 1.2) < rms(0.1, 0.4) * 0.3, `${f} Hz: the string dies away`);
  }
  // Sawari: more energy above the 8th harmonic late in the note.
  const hi = (p) => {
    const f = 196, x = renderShamisenPluck(sr, f, p), i0 = Math.floor(0.4 * sr), N = Math.floor(0.2 * sr);
    const mags = [];
    for (let h = 1; h <= 24; h++) { let re = 0, im = 0; const w = 2 * Math.PI * f * h / sr;
      for (let i = 0; i < N; i++) { re += x[i0 + i] * Math.cos(w * i); im += x[i0 + i] * Math.sin(w * i); } mags.push(re * re + im * im); }
    const tot = mags.reduce((a, b) => a + b, 0); return mags.slice(7).reduce((a, b) => a + b, 0) / tot;
  };
  ok(hi({}) > hi({ sawari: 0 }) * 1.3, `the sawari buzz lifts the upper harmonics (${(hi({ sawari: 0 }) * 100).toFixed(1)}% → ${(hi({}) * 100).toFixed(1)}%)`);
  const a = renderShamisenPluck(sr, 220), b = renderShamisenPluck(sr, 220);
  ok(a.every((v, i) => v === b[i]), 'the same note renders identically (cache-exact)');
}

console.log('§5 the shamisen through the amp');
{
  const mock = () => {
    const nodes = [], edges = [];
    const param = (v = 0) => ({ value: v, events: [], setValueAtTime(x, t) { this.events.push(['set', x, t]); this.value = x; },
      linearRampToValueAtTime(x, t) { this.events.push(['lin', x, t]); }, exponentialRampToValueAtTime(x, t) { this.events.push(['exp', x, t]); } });
    const mk = (kind, extra = {}) => { const n = { kind, ...extra, connect(d) { edges.push([n, d]); return d; } }; nodes.push(n); return n; };
    return { currentTime: 1, sampleRate: 48000, destination: { kind: 'destination' }, nodes, edges,
      createOscillator: () => mk('osc', { type: 'sine', frequency: param(440), detune: param(0), start(t) { this.started = t; }, stop(t) { this.stopped = t; } }),
      createBufferSource: () => mk('buffer', { buffer: null, detune: param(0), playbackRate: param(1), start(t) { this.started = t; }, stop(t) { this.stopped = t; } }),
      createGain: () => mk('gain', { gain: param(1) }),
      createBiquadFilter: () => mk('biquad', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }),
      createWaveShaper: () => mk('shaper', { curve: null, oversample: 'none' }),
      createDelay: () => mk('delay', { delayTime: param(0) }),
      createDynamicsCompressor: () => mk('compressor', { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
      createConvolver: () => mk('convolver', { buffer: null }),
      createBuffer: (ch, len, sr) => { const d = new Float32Array(len); return { sampleRate: sr, length: len, getChannelData: () => d, copyToChannel(src) { d.set(src); } }; },
    };
  };
  const play = (voice, opts = {}) => { const ctx = mock(); getAmpBuses(ctx); const b = ctx.nodes.length; playAmpNote(ctx, 220, { holdTime: 1.1, knobs: { voice }, ...opts }); ctx.nodes.splice(0, b); return ctx; };
  const clean = play('shamisen');
  ok(!clean.nodes.some(n => n.kind === 'osc' && n.type !== 'sine'), 'SHAMISEN: no string oscillators — the string is rendered');
  const src = clean.nodes.find(n => n.kind === 'buffer');
  ok(src && src.buffer?.length > 0 && src.started != null && src.stopped > src.started, 'SHAMISEN: one rendered string, started and stopped');
  ok(!clean.nodes.some(n => n.kind === 'shaper'), 'SHAMISEN: clean — no clipper at all');
  const dist = play('shamisen_dist');
  ok(dist.nodes.filter(n => n.kind === 'shaper').length === 2, 'ONI SHAMISEN: both KATANA clipping stages');
  ok(dist.nodes.some(n => n.kind === 'buffer'), 'ONI SHAMISEN: plucked, not oscillated');
  const bent = play('shamisen', { bend: -2 });
  ok(bent.nodes.find(n => n.kind === 'buffer').detune.events[0]?.[1] === -200, 'a suri slide bends the rendered string (detune)');
  const c1 = mock(); getAmpBuses(c1);
  playAmpNote(c1, 220, { knobs: { voice: 'shamisen' } }); playAmpNote(c1, 220, { knobs: { voice: 'shamisen' } });
  const bufs = c1.nodes.filter(n => n.kind === 'buffer');
  ok(bufs.length === 2 && bufs[0].buffer === bufs[1].buffer, 'a repeated note re-uses the cached string');

  // ⚔️🪕 KATANA × SHAMISEN — both sources, one chain.
  ok(TONE_VOICE_ORDER.includes('katana_shamisen'), 'KATANA × SHAMISEN is on the voice button');
  ok(TONE_VOICES.katana_shamisen.lead === RONIN_LEAD, '…and runs the real KATANA stages');
  const both = play('katana_shamisen');
  const str = both.nodes.find(n => n.kind === 'buffer');
  const saws = both.nodes.filter(n => n.kind === 'osc' && n.type === 'sawtooth');
  ok(str && saws.length === 2, 'the string AND the two KATANA oscillators are in one note');
  ok(both.nodes.filter(n => n.kind === 'shaper').length === 2, 'both go through the KATANA’s two clipping stages');
  const bus = both.nodes.find(n => n.kind === 'gain' && n.gain.events[0]?.[0] === 'set' && n.gain.events[1]?.[0] === 'lin' && n.gain.events.length === 2);
  const level = Math.min(1, Math.max(0, 1 - KATANA_SHAMISEN.layer)) * 2;
  ok(bus && Math.abs(bus.gain.events[0][1] - level * KATANA_SHAMISEN.oscStart) < 1e-9 && Math.abs(bus.gain.events[1][1] - level) < 1e-9,
     `the KATANA sits under the string at its dialled share (${level.toFixed(2)}), from oscStart`);
  const even = play('katana_shamisen', { layer: { layer: 0.5, oscStart: 0.3 } });
  const evenBus = even.nodes.find(n => n.kind === 'gain' && n.gain.events.length === 2 && n.gain.events[1]?.[0] === 'lin' && n.gain.events[0]?.[0] === 'set');
  ok(Math.abs(evenBus.gain.events[0][1] - 0.3) < 1e-9 && evenBus.gain.events[1][1] === 1, 'an even blend swells the guitar from oscStart to full');
  ok(KATANA_SHAMISEN.layer === 0.95 && KATANA_SHAMISEN.oscStart === 1 && KATANA_SHAMISEN.swell === 0.42, 'Alex’s dial-in (2026-09-28) is what ships');
  ok(saws.every(o => o.detune.events[0]?.[1] === RONIN_LEAD.scoopCents) && str.detune.events[0]?.[1] === RONIN_LEAD.scoopCents,
     'the scoop moves the string and the guitar together');
  const allSham = play('katana_shamisen', { layer: { layer: 1 } });
  const oscBus1 = allSham.nodes.find(n => n.kind === 'gain' && n.gain.events.length === 2 && n.gain.events[1]?.[0] === 'lin');
  ok(oscBus1?.gain.events[1][1] === 0, 'layer 1 = all string, the guitar silent');
  const allKat = play('katana_shamisen', { layer: { layer: 0 } });
  ok(allKat.nodes.find(n => n.kind === 'buffer') && allKat.edges.some(([a]) => a.kind === 'buffer'), 'layer 0 still builds the string (at zero)');
  ok([...both.nodes].filter(n => n.started != null).every(n => n.stopped > n.started), 'everything it starts, it stops');
}

console.log('§6 the signature layer — the stings’ recipe on every build');
{
  const { COMMIT_LAYERS, layerAnchors } = await import('./commitStyles.js');
  const { SPIRIT_FX_KINDS } = await import('./spiritSting.js');
  const lead = n => { const pc = pitchIndex(n); return pc >= 0 ? 261.63 * 2 ** (pc / 12) : null; };
  const run = (style, track, opts, withFx = true) => {
    const notes = [], fx = [];
    const api = { now: () => 10, lead, pitchIndex, rand: () => 0.5, note: (name, o) => notes.push({ name, ...o }), scratch() {},
      ...(withFx ? { fx: (kind, when, level) => fx.push({ kind, when, level }) } : {}) };
    playCommitStyle(style, track, api, opts);
    return { notes, fx };
  };
  const track = ['E', 'G', 'A', 'B', 'D'];
  for (const [id, set] of Object.entries(COMMIT_STYLE_SETS)) {
    const L = COMMIT_LAYERS[id];
    ok(!!L, `${id}: has a signature layer`);
    ok([...L.open, ...L.land].every(n => SPIRIT_FX_KINDS.includes(n.kind)), `${id}: every layer noise is a real sting noise`);
    ok(L.open.length + L.land.length > 0, `${id}: at least one character noise`);
    for (const style of set) {
      const bare = run(style, track, { layer: false }).notes, full = run(style, track);
      const extra = full.notes.slice(bare.length);
      const lastBare = Math.max(...bare.map(c => c.when));
      ok(extra.length >= 1 && extra.every(c => Number.isFinite(c.freq) && c.freq > 0), `${style}: the layer doubles at least one note (${extra.length})`);
      ok(full.notes.every(c => c.when <= lastBare + 1e-9), `${style}: the layer adds no onset after the build's last note`);
      ok(JSON.stringify(full.notes.slice(0, bare.length)) === JSON.stringify(bare), `${style}: the build itself is untouched`);
      const money = layerAnchors(bare.map(c => ({ note: c.name, o: c }))).money.o;
      ok(extra.some(c => c.when === money.when), `${style}: the money note is doubled`);
      ok(full.fx.filter(f => L.open.some(n => n.kind === f.kind)).every(f => f.when === 10.06), `${style}: the open noise lands on the downbeat`);
      ok(L.land.every(n => full.fx.some(f => f.kind === n.kind && f.when === money.when)), `${style}: the land noise hits under the money note`);
      ok(run(style, track, { layer: 'voice' }).fx.length === 0, `${style}: layer 'voice' plays no noises (the unlock moment)`);
      ok(run(style, track, undefined, false).notes.length === full.notes.length, `${style}: an api with no fx still gets the doubled voice, no throw`);
    }
  }
  {
    const shred = run('shred', track), bare = run('shred', track, { layer: false }).notes;
    const ex = shred.notes.slice(bare.length);
    ok(ex.length === 2 && ex.every(c => c.knobs?.voice === 'shamisen'), 'Ronin shred: the shamisen strikes his first and money notes');
    const ts = run('tsugaru', track), tb = run('tsugaru', track, { layer: false }).notes;
    const tx = ts.notes.slice(tb.length);
    ok(tx.length === 1 && tx[0].knobs?.voice === 'ronin' && tx[0].bend === -2, 'Ronin tsugaru: the KATANA sings the money note over the string, bent in');
    const money = layerAnchors(tb.map(c => ({ note: c.name, o: c }))).money.o;
    ok(Math.max(...tb.map(c => c.holdTime ?? 0)) === money.holdTime, 'the money note is the longest hold');
  }
  ok(layerAnchors([]) === null, 'nothing played → no anchors');
  // ⚠️ The game half — read the CLIENT, not a copy (CLAUDE.md: a passing test is not evidence a rule is real).
  const fs = await import('node:fs');
  const mono = fs.readFileSync(new URL('../rlsw-simulator-v3_8_1.jsx', import.meta.url), 'utf8');
  const commitApi = mono.slice(mono.indexOf('const commitApi = (seat) => ({'), mono.indexOf('function playTrackSequence('));
  ok(/fx: \(kind, when, level\) => playSpiritFx\(getAudioCtx\(\), kind, when, level\)/.test(commitApi), 'the game’s commit api carries the noises (playSpiritFx)');
  ok(/playCommitStyle\(build, stack, commitApi\(spiritId\), \{ layer: 'voice' \}\)/.test(mono), 'the seat-unlock fanfare plays the layer voice-only');
  ok((mono.match(/playCommitStyle\(/g) ?? []).length === 2, 'the game plays builds from exactly two places');
}

console.log('');
if (failures.length) { console.log(`❌ commitStylesCheck: ${failures.length} failed, ${pass} passed`); process.exit(1); }
console.log(`✅ commitStylesCheck: ${pass} assertions passed`);
