// ─── 🎭 SPIRIT STING CHECK ───────────────────────────────────────────────────
// The Spirit-select sting, 2026-09-28. Alex: *"there should be a sound when a
// Spirit is selected - have it play something that signifies 'who they are'."*
//
// ⚠️ WHAT THIS SUITE IS REALLY GUARDING:
//   §1 — "who they are" is the Spirit's OWN palette. A sting note outside the
//        mode is a sting teaching the player a sound the match never makes.
//   §2 — …and their OWN rig. A copied knob object rots the day SPIRIT_TONES is
//        dialled in (§B of SEQUENCING: "a constant that matches X copies X once").
//   §4 — the phrase goes through the sting's OWN gain, so a new pick can cut the
//        last one off. A note that reaches the shared master directly cannot be
//        stopped, and clicking down the roster becomes one noise.
//   §6 — local only: the lobby plays it on the click, never from room state.
//
// Run: npm run test:spiritsting  (spirits.js imports art — the asset stub loads it)
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
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const MI = await import('../music/melodyIdentity.js');
const A  = await import('./ampVoice.js');
const S  = await import('./spiritSting.js');
const { ROSTER_ORDER } = await import('../data/spirits.js');

console.log('🎭 spiritStingCheck — a calling card per Spirit\n');

// ═══ 1. THE PALETTE ═════════════════════════════════════════════════════════
console.log('§1 every note is in the Spirit’s own mode, and the tell note is there');
const TELL = { cosmic_ronin: 8, Metalness_Monster: 1, intergalactic_0: 9, Glamarchy: 6 };  // ♭6 · ♭2 · ♮6 · ♯4
for (const id of ROSTER_ORDER) {
  const st = S.SPIRIT_STINGS[id];
  ok(!!st, `${id} has a sting`);
  if (!st) continue;
  ok(st.mode === MI.melodyModeFor(id), `${id}: the sting's mode is the Spirit's (${MI.melodyModeFor(id)})`);
  const iv = MI.modeIntervals(st.mode);
  const pcs = st.notes.map(n => ((n.s % 12) + 12) % 12);
  ok(pcs.every(pc => iv.includes(pc)), `${id}: every note is in ${st.mode} (got ${pcs.join(',')})`);
  ok(pcs.includes(TELL[id]), `${id}: plays its mode's tell note (${TELL[id]})`);
  const end = st.notes.reduce((a, b) => (b.at >= a.at ? b : a));
  ok(end.hold + end.fade >= 1.5, `${id}: it ENDS on a held note (a calling card, not a blip)`);
}

// ═══ 2. THE RIG ═════════════════════════════════════════════════════════════
console.log('§2 every sting plays through the Spirit’s own rig');
for (const id of ROSTER_ORDER) {
  const st = S.SPIRIT_STINGS[id];
  if (!st) continue;
  ok(st.rig.voice === A.SPIRIT_TONES[id].voice && st.rig.drive === A.SPIRIT_TONES[id].drive,
    `${id}: rig is SPIRIT_TONES.${id} (${st.rig.voice})`);
}
ok(S.SPIRIT_STINGS.cosmic_ronin.notes.some(n => n.knobs?.voice === 'shamisen'), 'the Ronin’s sting has the shamisen in it');
ok(S.SPIRIT_STINGS.cosmic_ronin.notes.some(n => !n.knobs && n.bend === -2), '…and the KATANA bends a whole step into its last note');

// ═══ 3. LENGTH ══════════════════════════════════════════════════════════════
console.log('§3 two to three and a half seconds each, at Alex\'s dial-in');
ok(S.SPIRIT_STING.notes === 1.35 && S.SPIRIT_STING.fx === 1.42 && S.SPIRIT_STING.tempo === 1.22,
  'SPIRIT_STING is Alex\'s dial-in: notes 1.35 · fx 1.42 · tempo 1.22');
{
  const st = S.SPIRIT_STINGS.cosmic_ronin, last = st.notes[st.notes.length - 1];
  ok(S.stingDuration('cosmic_ronin', { S: { tempo: 1 } }) === Math.round(last.at + (last.hold + last.fade) * 1000)
    && S.stingDuration('cosmic_ronin') === Math.round(last.at * 1.22 + (last.hold + last.fade) * 1000),
    'tempo stretches the onsets, not the notes');
}
for (const id of ROSTER_ORDER) {
  const ms = S.stingDuration(id);
  ok(ms >= 1500 && ms <= 3500, `${id}: ${ms} ms`);
}
ok(S.stingDuration('nobody') === 0, 'no sting → 0 ms');
ok(Math.abs(S.stingHz('A', 4, 0) - 440) < 1e-9 && Math.abs(S.stingHz('E', 2, 0) - 82.4069) < 1e-3
  && Math.abs(S.stingHz('A', 3, 12) - 440) < 1e-9, 'stingHz: A4 440, E2 82.41, an octave is 12');

// ── a WebAudio graph recorder ────────────────────────────────────────────────
function mockCtx() {
  const nodes = [], edges = [];
  const param = (v = 0) => ({ value: v, events: [],
    setValueAtTime(x, t) { this.events.push(['set', x, t]); this.value = x; },
    linearRampToValueAtTime(x, t) { this.events.push(['lin', x, t]); },
    exponentialRampToValueAtTime(x, t) { this.events.push(['exp', x, t]); },
    setTargetAtTime(x, t, c) { this.events.push(['target', x, t, c]); } });
  const mk = (kind, extra = {}) => {
    const n = { kind, ...extra, connect(d) { edges.push([n, d]); return d; }, disconnect() {} };
    nodes.push(n); return n;
  };
  const src = kind => () => mk(kind, { type: 'sine', frequency: param(440), detune: param(0), playbackRate: param(1), buffer: null,
    start(t) { this.started = t; }, stop(t) { this.stopped = t; } });
  return {
    currentTime: 1, sampleRate: 48000, destination: { kind: 'destination' }, nodes, edges,
    createOscillator: src('osc'), createBufferSource: src('buffer'),
    createGain: () => mk('gain', { gain: param(1) }),
    createBiquadFilter: () => mk('biquad', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }),
    createWaveShaper: () => mk('shaper', { curve: null, oversample: 'none' }),
    createDelay: () => mk('delay', { delayTime: param(0) }),
    createDynamicsCompressor: () => mk('compressor', { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createConvolver: () => mk('convolver', { buffer: null }),
    createBuffer: (ch, len, sr) => ({ sampleRate: sr, length: len, getChannelData: () => new Float32Array(len) }),
  };
}

// ═══ 4. ROUTING ═════════════════════════════════════════════════════════════
console.log('§4 the phrase goes through the sting’s own gains');
for (const id of ROSTER_ORDER) {
  const ctx = mockCtx();
  const { master, verbBus } = A.getAmpBuses(ctx);
  const before = ctx.edges.length;
  const ms = S.playSpiritSting(ctx, id);
  ok(ms === S.stingDuration(id), `${id}: returns its length`);
  const outs = ctx.__rlswSting;
  ok(Array.isArray(outs) && outs.length === 3, `${id}: three sting gains (dry, verb, sfx)`);
  const fresh = ctx.edges.slice(before);
  const intoMaster = fresh.filter(([, d]) => d === master).map(([s]) => s);
  const intoVerb = fresh.filter(([, d]) => d === verbBus).map(([s]) => s);
  ok(intoMaster.length === 1 && intoMaster[0] === outs[0], `${id}: nothing but the sting's gain reaches the master`);
  ok(intoVerb.length === 1 && intoVerb[0] === outs[1], `${id}: nothing but the sting's verb gain reaches the reverb`);
  const sfxBus = ctx.__rlswSfxBus;
  const intoSfx = fresh.filter(([, d]) => d === sfxBus).map(([s]) => s);
  ok(intoSfx.length === 1 && intoSfx[0] === outs[2], `${id}: its noises ride the SFX fader`);
  ok(fresh.filter(([, d]) => d === outs[2]).length > 0, `${id}: it has a character noise`);
  const starts = ctx.nodes.filter(n => n.started != null).map(n => n.started);
  ok(starts.length > 0 && Math.min(...starts) >= ctx.currentTime, `${id}: nothing is scheduled in the past`);
  const lastAt = Math.max(...S.SPIRIT_STINGS[id].notes.map(n => n.at));
  const want = ctx.currentTime + 0.03 + lastAt * S.SPIRIT_STING.tempo / 1000;
  ok(starts.some(t => Math.abs(t - want) < 1e-6) && !starts.some(t => Math.abs(t - (ctx.currentTime + 0.03 + lastAt / 1000)) < 1e-6),
    `${id}: the last note lands at tempo ${S.SPIRIT_STING.tempo}`);
}

// ═══ 5. ONE AT A TIME ═══════════════════════════════════════════════════════
console.log('§5 a new pick fades the last sting out');
{
  const ctx = mockCtx();
  S.playSpiritSting(ctx, 'cosmic_ronin');
  const first = ctx.__rlswSting;
  S.playSpiritSting(ctx, 'Metalness_Monster');
  ok(ctx.__rlswSting !== first, 'the context now holds the new sting');
  ok(first.every(g => g.gain.events.some(([k, x, t]) => k === 'lin' && x === 0 && Math.abs(t - (ctx.currentTime + S.SPIRIT_STING.cutMs / 1000)) < 1e-9)),
    `every gain of the old sting ramps to 0 over ${S.SPIRIT_STING.cutMs} ms`);
  ok(ctx.__rlswSting.every(g => !g.gain.events.length), 'the new sting is untouched');
  S.stopSpiritSting(ctx);
  ok(ctx.__rlswSting === null, 'stopSpiritSting clears it');
  S.stopSpiritSting(ctx); ok(true, 'stopping twice is harmless');
  ok(S.playSpiritSting(null, 'cosmic_ronin') === 0 && S.playSpiritSting(mockCtx(), 'nobody') === 0, 'no context / no Spirit → nothing, no throw');
}

// ═══ 6. THE LOBBY ═══════════════════════════════════════════════════════════
console.log('§6 the lobby plays it on this player’s click only');
{
  const lobby = read('../ui/Lobby.jsx');
  const calls = lobby.match(/playSpiritSting\(/g) ?? [];
  ok(calls.length === 1, 'Lobby calls playSpiritSting in exactly one place');
  const assign = lobby.slice(lobby.indexOf('function assign('), lobby.indexOf('function confirmSeat('));
  ok(/playPickSting\(spiritId\)/.test(assign), 'assign() — the roster click — plays the sting');
  ok(/onChooseSpirit=\{assign\}/.test(lobby), '…and assign is what the roster calls');
  ok(!/on\("ROOM_STATE"[^\n]*playPickSting/.test(lobby), 'room state never plays it');
  ok(/SPIRIT_STING\.duck/.test(lobby) && /clearTimeout\(duckTimer\.current\)/.test(lobby), 'the menu song ducks under it and comes back');
  const draft = read('../ui/SpiritDraft.jsx');
  ok(/onClick=\{\(\)=>\{ s\(\)\?\.picked\(id\); onChooseSpirit\(corner,id\); \}\}/.test(draft), 'the roster card click is what calls onChooseSpirit');
}

// ═══ 6b. THE NOISES, LENT TO THE COMMIT BUILDS ══════════════════════════════
console.log('§6b playSpiritFx — one noise on the SFX fader');
{
  const ctx = mockCtx();
  const before = ctx.edges.length;
  ok(S.playSpiritFx(ctx, 'slam', 2, 0.5) === true, 'a known noise plays');
  const bus = ctx.__rlswSfxBus;
  const fresh = ctx.edges.slice(before);
  ok(fresh.some(([, d]) => d === bus) && fresh.filter(([, d]) => d === ctx.destination).every(([src]) => src === bus),
    'it goes through the SFX bus');
  ok(S.playSpiritFx(ctx, 'nope', 2, 0.5) === false && S.playSpiritFx(null, 'slam', 2, 0.5) === false && S.playSpiritFx(ctx, 'slam', 2, 0) === false,
    'unknown kind / no context / zero level → false, no throw');
  ok(['sheath', 'slam', 'laser', 'drop', 'stomp', 'clap', 'glitter'].every(k => S.SPIRIT_FX_KINDS.includes(k)), 'every sting noise is lendable');
}

// ═══ 7. THE SHARED VOICE ════════════════════════════════════════════════════
console.log('§7 playAmpNote with no `out` still goes to the shared buses');
{
  const ctx = mockCtx();
  const { master, verbBus } = A.getAmpBuses(ctx);
  const before = ctx.edges.length;
  A.playAmpNote(ctx, 440, { knobs: A.SPIRIT_TONES.intergalactic_0 });
  const fresh = ctx.edges.slice(before);
  ok(fresh.filter(([, d]) => d === master).length === 2, 'dry + echo → master (unchanged)');
  ok(fresh.filter(([, d]) => d === verbBus).length === 1, 'verb send → the shared convolver (unchanged)');
}

console.log(`\n${failures.length ? '❌' : '✅'} spiritStingCheck: ${failures.length ? `${failures.length} failed, ` : ''}${pass} assertions passed`);
if (failures.length) process.exit(1);
