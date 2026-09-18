// ─── 🗡️ RONIN TONE CHECK ─────────────────────────────────────────────────────
// The Ronin's sound, 2026-09-16. Alex: *"change his sound to that one of a more
// Japanese nature — the Hirajoshi scale with a perfect 4th… more drive and punch…
// I want his guitar to sing in a distorted magnificence."*
//
// Two changes, one suite, because they are one request:
//   1. The PALETTE — `cosmic_ronin` plays `hirajoshi` (1 2 ♭3 4 5 ♭6), not Lydian.
//   2. The VOICE — `SPIRIT_TONES.cosmic_ronin` plays the KATANA (`RONIN_LEAD`).
//
// ⚠️ WHAT THIS SUITE IS REALLY GUARDING:
//   §1 — the six-note ORDER. `melodyCommit.js` reads the resolving 4th and 5th as
//        `harmonicScale[3]` / `[4]`. Drop the 4th ("Hirajoshi is five notes") and
//        both endings move without a single error.
//   §4 — the other five voices. The KATANA's stages hang off `V.lead`; if they
//        ever leak into the shared path, Metalness, Zero and Glamarchy change
//        sound in a diff that says "Ronin". The node counts below are a snapshot
//        of `ampVoice.js` as it was BEFORE the KATANA existed.
//
// Run: npm run test:ronintone
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = rel => fs.readFileSync(path.join(HERE, rel), 'utf8');

let pass = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) { pass++; }
  else { failures.push(msg); console.log('  ✗', msg); }
}
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)})`);

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const MI = await import('../music/melodyIdentity.js');
const N  = await import('../music/notes.js');
const A  = await import('./ampVoice.js');

console.log('🗡️  roninToneCheck — Hirajoshi, and a guitar that sings\n');

// ═══ 1. THE PALETTE ═════════════════════════════════════════════════════════
console.log('§1 the Ronin plays Hirajoshi with the perfect 4th');
{
  eq(MI.melodyModeFor('cosmic_ronin'), 'hirajoshi', 'the Ronin’s mode is hirajoshi');
  eq([...MI.MODE_INTERVALS.hirajoshi], [0, 2, 3, 5, 7, 8], 'hirajoshi + P4 is 1 2 ♭3 4 5 ♭6');
  ok(Object.isFrozen(MI.MODE_INTERVALS.hirajoshi), 'the interval list is frozen like its siblings');
  eq(N.buildScale('C', 'hirajoshi'), ['C', 'D', 'Eb', 'F', 'G', 'Ab'], 'C Hirajoshi + P4 spells C D E♭ F G A♭');
  eq(N.playableScale('C', 'hirajoshi'), ['C', 'D', 'Eb', 'F', 'G', 'Ab'], 'the clean palette is those six and only those six');
  eq(N.buildScale('A', 'hirajoshi'), ['A', 'B', 'C', 'D', 'E', 'F'], 'A Hirajoshi + P4 is all white keys: A B C D E F');
  eq(N.buildScale('E', 'hirajoshi'), ['E', 'F#', 'G', 'A', 'B', 'C'], 'E Hirajoshi + P4 spells E F♯ G A B C');

  // ⚠️ THE LOAD-BEARING PAIR. melodyCommit reads these two seats as the endings.
  for (const root of ['C', 'D', 'Eb', 'F#', 'Ab', 'B']) {
    const s = N.buildScale(root, 'hirajoshi');
    const i = N.getIntervalNotes(root, 'hirajoshi');
    ok(s[3] === i.fourth, `${root}: degree index 3 is the perfect 4th (${s[3]})`);
    ok(s[4] === i.fifth,  `${root}: degree index 4 is the perfect 5th (${s[4]})`);
  }

  eq(MI.modeFamily('hirajoshi'), 'minor', 'hirajoshi is a minor-family mode (♭3) for split-root spelling');
  eq(N.canonicalRoot('G#', 'hirajoshi'), 'G#', 'a G♯ root stays G♯ in the minor family');

  // The rest of the roster did not move.
  eq(MI.melodyModeFor('Metalness_Monster'), 'phrygian', 'Metalness still Phrygian');
  eq(MI.melodyModeFor('intergalactic_0'), 'dorian', 'Intergalactic 0 still Dorian');
  eq(MI.BEGINNER_FALLBACK_MODE, 'lydian', 'the unsettled-seat fallback is still Lydian');
  eq(MI.melodyModeFor('Glamarchy'), 'lydian', 'Glamarchy still falls back to Lydian');
  eq([...MI.MODE_INTERVALS.lydian], [0, 2, 4, 6, 7, 9, 11], 'Lydian itself is untouched');
}

// ═══ 2. THE RIG ═════════════════════════════════════════════════════════════
console.log('§2 the Ronin’s rig is the KATANA, hotter than the saw it replaced');
{
  const r = A.SPIRIT_TONES.cosmic_ronin;
  eq(r.voice, 'ronin', 'the Ronin’s signature voice is ronin');
  ok(r.drive > 0.55, 'more drive than the old 0.55 saw rig');
  ok(A.TONE_VOICES.ronin?.label === 'KATANA', 'the voice reads KATANA on the panel');
  ok(A.TONE_VOICES.ronin.lead === A.RONIN_LEAD, 'the KATANA carries RONIN_LEAD');
  ok(Object.isFrozen(A.RONIN_LEAD), 'RONIN_LEAD is frozen — a dial-in, not a mutable global');
  ok(A.TONE_VOICE_ORDER.includes('ronin'), 'the voice button can cycle back to KATANA');
  ok(A.TONE_VOICE_ORDER.every(v => A.TONE_VOICES[v]), 'every voice in the cycle exists');
  for (const k of ['osc1', 'osc2', 'sub', 'driveMul', 'octave']) {
    ok(k in A.TONE_VOICES.ronin, `KATANA has ${k} — playScratchAtom reads it off any voice`);
  }
  // The other Spirits' rigs, exactly as they were.
  eq(A.SPIRIT_TONES.intergalactic_0,   { drive: 0.30, tone: 0.42, echo: 0.55, verb: 0.38, voice: 'triangle' }, 'Zero’s rig unchanged');
  eq(A.SPIRIT_TONES.Metalness_Monster, { drive: 0.82, tone: 0.30, echo: 0.20, verb: 0.14, voice: 'fuzz' },     'Metalness’s rig unchanged');
  eq(A.SPIRIT_TONES.Glamarchy,         { drive: 0.45, tone: 0.55, echo: 0.62, verb: 0.42, voice: 'square' },   'Glamarchy’s rig unchanged');
}

// ── a WebAudio graph recorder ────────────────────────────────────────────────
function mockCtx() {
  const nodes = [], edges = [];
  const param = (v = 0) => ({ value: v, events: [],
    setValueAtTime(x, t) { this.events.push(['set', x, t]); this.value = x; },
    linearRampToValueAtTime(x, t) { this.events.push(['lin', x, t]); },
    exponentialRampToValueAtTime(x, t) { this.events.push(['exp', x, t]); },
    setTargetAtTime(x, t, c) { this.events.push(['target', x, t, c]); } });
  const mk = (kind, extra = {}) => {
    const n = { kind, ...extra, connect(d) { edges.push([n, d]); return d; } };
    nodes.push(n); return n;
  };
  return {
    currentTime: 1, sampleRate: 48000, destination: { kind: 'destination' }, nodes, edges,
    createOscillator: () => mk('osc', { type: 'sine', frequency: param(440), detune: param(0),
      start(t) { this.started = t; }, stop(t) { this.stopped = t; } }),
    createGain: () => mk('gain', { gain: param(1) }),
    createBiquadFilter: () => mk('biquad', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }),
    createWaveShaper: () => mk('shaper', { curve: null, oversample: 'none' }),
    createDelay: () => mk('delay', { delayTime: param(0) }),
    createDynamicsCompressor: () => mk('compressor', { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createConvolver: () => mk('convolver', { buffer: null }),
    createBuffer: (ch, len, sr) => ({ sampleRate: sr, getChannelData: () => new Float32Array(len) }),
  };
}
/** Play one note on a fresh context; return only the note's own nodes. */
function play(opts) {
  const ctx = mockCtx();
  A.getAmpBuses(ctx);
  const busNodes = ctx.nodes.length, busEdges = ctx.edges.length;
  A.playAmpNote(ctx, 440, opts);
  ctx.nodes.splice(0, busNodes);
  ctx.edges.splice(0, busEdges);
  return ctx;
}
function signature(ctx) {
  const c = {};
  for (const n of ctx.nodes) { const k = n.kind + (n.type ? ':' + n.type : ''); c[k] = (c[k] ?? 0) + 1; }
  return Object.fromEntries(Object.entries(c).sort());
}
const into = (ctx, node) => ctx.edges.filter(([, d]) => d === node).map(([s]) => s);
const outOf = (ctx, node) => ctx.edges.filter(([s]) => s === node).map(([, d]) => d);
const envOf = ctx => ctx.nodes.filter(n => n.kind === 'gain').map(n => n.gain.events)
  .find(e => e.length >= 4 && e[0][1] === 0 && e.at(-1)[0] === 'exp');

// ═══ 3. THE KATANA GRAPH ════════════════════════════════════════════════════
console.log('§3 punch, drive, sing — the KATANA’s stages are really in the graph');
{
  const L = A.RONIN_LEAD;
  const knobs = A.SPIRIT_TONES.cosmic_ronin;
  const g = play({ holdTime: 1.1, volume: 0.2, knobs });
  const shapers = g.nodes.filter(n => n.kind === 'shaper');
  eq(shapers.length, 2, 'two clipping stages');
  ok(shapers.every(s => s.oversample === '4x'), 'both stages oversample 4x');

  const drive = into(g, shapers[0])[0];
  const hump = into(g, drive)[0];
  ok(hump?.type === 'peaking' && hump.frequency.value === L.humpHz && hump.gain.value === L.humpDb,
     'a mid hump feeds the drive stage (SING)');
  const tight = into(g, hump)[0];
  ok(tight?.type === 'highpass' && tight.frequency.value === L.tightHz, 'a tight highpass sits before the hump (PUNCH)');
  ok(g.nodes.filter(n => n.kind === 'osc' && n.type !== 'sine').every(o => outOf(g, o).every(gn => outOf(g, gn).includes(tight))),
     'every string oscillator enters through the tight highpass');

  const soft = shapers[1];
  ok(into(g, into(g, soft)[0])[0] === shapers[0], 'the soft stage follows the hard stage');
  ok(g.nodes.some(n => n.type === 'highshelf' && n.gain.value === L.fizzDb), 'a cab shelf takes the fizz off');

  const lp = g.nodes.find(n => n.type === 'lowpass');
  const lpHz = 1200 + knobs.tone * 5300;
  ok(lp.frequency.events[0][1] > lpHz * 1.5, 'the lowpass flares open on the pick');
  ok(lp.frequency.events.at(-1)[1] === lpHz, '…and settles to the TONE knob');

  const env = envOf(g);
  ok(Math.abs(env[1][1] - 0.2 * L.punch) < 1e-9, 'the pick overshoots to volume × punch');
  ok(Math.abs(env[2][1] - 0.2 * L.sustain) < 1e-9, 'the hold sits at volume × sustain');
  ok(L.sustain > 0.82, 'the KATANA holds higher than the stock 0.82 settle');

  const strings = g.nodes.filter(n => n.kind === 'osc' && n.frequency.events.length && n.type !== 'sine' || (n.type === 'sine' && n.frequency.events[0]?.[1] === 880));
  ok(strings.length >= 3, 'three string oscillators plus the bloom');
  ok(strings.every(o => o.detune.events[0]?.[1] === L.scoopCents && o.detune.events[1]?.[1] === 0),
     'every note scoops up into pitch');

  const lfo = g.nodes.find(n => n.kind === 'osc' && n.frequency.value === L.vibRate);
  ok(!!lfo, 'a held note grows vibrato');
  const depth = outOf(g, lfo)[0];
  ok(depth.gain.events[0][1] === 0 && depth.gain.events.at(-1)[1] === L.vibCents, '…that starts at zero and widens');
  ok(depth.gain.events.at(-1)[2] > 1 + L.vibDelay, '…only after the note has spoken');
  ok(outOf(g, depth).length === 4, 'vibrato moves all four pitched oscillators together');

  const bloom = g.nodes.find(n => n.kind === 'osc' && n.frequency.events[0]?.[1] === 880);
  ok(!!bloom, 'a long hold blooms an octave harmonic');
  ok(outOf(g, outOf(g, bloom)[0]).includes(tight), '…and the bloom goes THROUGH the clipper');
  ok(g.nodes.filter(n => n.kind === 'osc').every(o => o.started != null && o.stopped > o.started),
     'every oscillator it starts, it stops');

  // Shred notes stay straight.
  const shred = play({ holdTime: 0.12, fadeTime: 0.08, knobs });
  ok(!shred.nodes.some(n => n.kind === 'osc' && n.frequency.value === L.vibRate), 'a shred note has no vibrato');
  ok(!shred.nodes.some(n => n.kind === 'osc' && n.frequency.events[0]?.[1] === 880), 'a shred note has no bloom');

  // The money-note bend.
  const bent = play({ holdTime: 1.1, knobs, bend: -2 });
  const bentOsc = bent.nodes.find(n => n.kind === 'osc' && n.type === 'sawtooth');
  ok(bentOsc.detune.events[0][1] === -200, 'bend −2 starts a whole step below');
  ok(Math.abs(bentOsc.detune.events[1][2] - 1.18) < 1e-9, '…and arrives at pitch after bendTime (0.18 s)');

  // The preview's override reaches the stages.
  const dry = play({ holdTime: 1.1, knobs, lead: { stage2: 0, vibCents: 0, bloom: 0 } });
  eq(dry.nodes.filter(n => n.kind === 'shaper').length, 1, 'lead.stage2 = 0 drops the second stage');
  ok(!dry.nodes.some(n => n.kind === 'osc' && n.frequency.value === A.RONIN_LEAD.vibRate), 'lead.vibCents = 0 drops the vibrato');
  ok(A.RONIN_LEAD.stage2 > 0, '…and the override did not mutate RONIN_LEAD');
}

// ═══ 4. EVERYONE ELSE ═══════════════════════════════════════════════════════
console.log('§4 the other five voices build exactly the graph they always did');
{
  // Snapshot of ampVoice.js BEFORE the KATANA (2026-09-16), on this recorder.
  const BEFORE = {
    saw:      { sig: { 'biquad:highpass': 1, 'biquad:lowpass': 1, 'biquad:peaking': 1, delay: 1, gain: 10, 'osc:sawtooth': 2, 'osc:square': 1, shaper: 1 }, edges: 21 },
    square:   { sig: { 'biquad:highpass': 1, 'biquad:lowpass': 1, 'biquad:peaking': 1, delay: 1, gain: 10, 'osc:square': 3, shaper: 1 }, edges: 21 },
    triangle: { sig: { 'biquad:highpass': 1, 'biquad:lowpass': 1, 'biquad:peaking': 1, delay: 1, gain: 10, 'osc:sine': 1, 'osc:triangle': 2, shaper: 1 }, edges: 21 },
    sine:     { sig: { 'biquad:highpass': 1, 'biquad:lowpass': 1, 'biquad:peaking': 1, delay: 1, gain: 10, 'osc:sine': 3, shaper: 1 }, edges: 21 },
    fuzz:     { sig: { 'biquad:highpass': 1, 'biquad:lowpass': 1, 'biquad:peaking': 1, delay: 1, gain: 11, 'osc:sawtooth': 1, 'osc:square': 3, shaper: 1 }, edges: 23 },
  };
  for (const [voice, want] of Object.entries(BEFORE)) {
    const g = play({ holdTime: 1.1, knobs: { voice } });
    eq(signature(g), want.sig, `${voice}: same nodes`);
    eq(g.edges.length, want.edges, `${voice}: same wiring`);
    ok(g.nodes.filter(n => n.kind === 'osc').every(o => o.detune.events.length === 0), `${voice}: no scoop, no vibrato`);
  }
  eq(envOf(play({ holdTime: 1.1, volume: 0.18, knobs: { voice: 'saw' } })),
     [['set', 0, 1], ['lin', 0.18, 1.008], ['lin', 0.18 * 0.82, 1.06], ['set', 0.18 * 0.82, 2.1], ['exp', 0.001, 1 + 1.1 + 0.8]],
     'saw: the envelope is the old envelope to the sample');
  eq(envOf(play({ holdTime: 0.1, volume: 0.18, knobs: { voice: 'saw' } }))[3], ['set', 0.18 * 0.82, 1.108],
     'saw: a short note’s hold point is unchanged too');

  // `bend` is opt-in for any voice, and costs no nodes.
  const bentSaw = play({ holdTime: 1.1, knobs: { voice: 'saw' }, bend: -1 });
  eq(signature(bentSaw), BEFORE.saw.sig, 'a bent saw note adds no nodes');
  ok(bentSaw.nodes.find(n => n.type === 'sawtooth').detune.events[0][1] === -100, '…it only moves the pitch');
}

// ═══ 5. THE SOFT CLIP CURVE ═════════════════════════════════════════════════
console.log('§5 the second stage is round, odd and bounded');
{
  const c = A.makeSoftClipCurve(3);
  ok(Math.abs(c[0] + 1) < 1e-9 && Math.abs(c.at(-1) - 1) < 1e-9, 'it spans exactly −1…1');
  let mono = true, odd = true;
  for (let i = 1; i < c.length; i++) if (c[i] < c[i - 1]) mono = false;
  for (let i = 0; i < c.length; i++) if (Math.abs(c[i] + c[c.length - 1 - i]) > 1e-6) odd = false;
  ok(mono, 'monotonic — no fold-back');
  ok(odd, 'symmetric — no DC offset from the second stage');
}

// ═══ 6. THE WIRING ══════════════════════════════════════════════════════════
console.log('§6 the game reaches all of it');
{
  const econ = read('../engine/systems/economy.js');
  ok(/const initMode = melodyModeFor\(spiritId\)/.test(econ), 'a new note sheet takes its mode from melodyModeFor');
  ok(/paletteMode:\s*initMode/.test(econ), '…and stores it as the palette');
  const commit = read('../engine/systems/melodyCommit.js');
  ok(/fourth: harmonicScale\[3\], fifth: harmonicScale\[4\]/.test(commit), 'the endings still read degree seats 3 and 4 (§1 holds them)');
  const client = read('../rlsw-simulator-v3_8_1.jsx');
  ok(/SPIRIT_TONES\[id\]/.test(client), 'the client seeds each Spirit’s rig from SPIRIT_TONES');
  const shred = client.slice(client.indexOf('function playShredSequence'), client.indexOf('function playBreakdownSequence'));
  ok(shred.length > 0, 'the Ronin’s shred sequence exists');
  ok(/const RONIN_MONEY_BEND = -2;/.test(shred), 'the money-note bend is a whole step');
  eq((shred.match(/bend: RONIN_MONEY_BEND/g) ?? []).length, 2, 'both ringing endings bend');
  const pkg = JSON.parse(read('../../package.json'));
  ok(!!pkg.scripts['test:ronintone'], 'npm run test:ronintone exists');
  ok(/test:ronintone/.test(pkg.scripts['test:all']), '…and test:all runs it');
}

console.log('');
if (failures.length) {
  console.log(`❌ roninToneCheck: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`✅ roninToneCheck: ${pass} assertions passed`);
