// ─── 🎼 STOCK DRAW CHECK ─────────────────────────────────────────────────────
// Alex, 2026-09-16: half of every new hand note is picked from the Spirit's own
// palette; the other half from all twelve, as before — *"I still like the idea of
// some variance."* For the Ronin's six-note Hirajoshi that is 75% in tune; for a
// seven-note mode ~79%. (It replaced a flat 75% built earlier the same day.)
//
// ⚠️ WHAT THIS SUITE IS REALLY GUARDING:
//   §3 — ONE rand() PER NOTE. The engine pre-draws one float per refreshed slot
//        and the client batches one per note; a weighted pick that quietly spent
//        two would pass every "is it 75%?" check and desync every replay.
//   §6 — THE BOARD STAYS UNWEIGHTED. Lost Chords are shared by every Spirit;
//        leaning them toward one palette hands that Spirit the board.
//
// Run: npm run test:stockdraw
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = rel => fs.readFileSync(path.join(HERE, rel), 'utf8');

let pass = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) pass++;
  else { failures.push(msg); console.log('  ✗', msg); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const { STOCK_PALETTE_GUARANTEE, TOKEN_UNLOCK_SPAWN_SHARE } = await import('../data/gameConstants.js');
const { randomNote, refillStock } = await import('./cadence.js');
const { playableScale, pitchIndex, getSpelledPool } = await import('./notes.js');
const { melodyModeFor } = await import('./melodyIdentity.js');
const { makeRng } = await import('../engine/rng.js');
const { startTurnNotes, refillDrawCount } = await import('../engine/systems/turnFlow.js');
const { makeInitialNoteState } = await import('../engine/systems/economy.js');

console.log('🎼 stockDrawCheck — half guaranteed in tune, half left to chance\n');

const ROSTER = ['cosmic_ronin', 'Metalness_Monster', 'intergalactic_0', 'Glamarchy'];
const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'C#', 'G#'];
const inPalette = (note, root, mode) => new Set(playableScale(root, mode).map(pitchIndex)).has(pitchIndex(note));

// ═══ 1. THE NUMBER ══════════════════════════════════════════════════════════
console.log('§1 the guarantee is Alex’s half');
const G = STOCK_PALETTE_GUARANTEE;
const expected = size => G + (1 - G) * size / 12;
ok(G === 0.5, 'STOCK_PALETTE_GUARANTEE is 0.5');
ok(expected(6) === 0.75, '…which puts the Ronin’s six-note palette at exactly 75%');
ok(Math.abs(expected(7) - 19 / 24) < 1e-12, '…and a seven-note palette at 19/24 (~79%)');

// ═══ 2. THE RATE ════════════════════════════════════════════════════════════
console.log('§2 every Spirit, every root: guarantee + chance, spread evenly');
{
  const N = 60000;
  for (const id of ROSTER) {
    const mode = melodyModeFor(id);
    for (const root of ['C', 'F#', 'Ab']) {
      const rng = makeRng(1000 + ROOTS.indexOf(root) * 7 + ROSTER.indexOf(id));
      const counts = {};
      let inside = 0;
      for (let i = 0; i < N; i++) {
        const n = randomNote(root, mode, rng);
        counts[pitchIndex(n)] = (counts[pitchIndex(n)] ?? 0) + 1;
        if (inPalette(n, root, mode)) inside++;
      }
      const pal = playableScale(root, mode);
      const rate = inside / N;
      ok(near(rate, expected(pal.length), 0.01), `${id} (${mode}) on ${root}: ${(rate * 100).toFixed(1)}% inside (want ${(expected(pal.length) * 100).toFixed(1)}%)`);
      const palPcs = new Set(pal.map(pitchIndex));
      const inEach = G / pal.length + (1 - G) / 12, outEach = (1 - G) / 12;
      let even = true;
      for (let pc = 0; pc < 12; pc++) {
        const want = palPcs.has(pc) ? inEach : outEach;
        if (!near((counts[pc] ?? 0) / N, want, 0.008)) even = false;
      }
      ok(even, `${id} on ${root}: every note on each side is equally likely — all twelve still appear`);
    }
  }
  // Palette size no longer decides the share.
  ok(playableScale('C', 'hirajoshi').length === 6 && playableScale('C', 'phrygian').length === 7,
    'the Ronin’s palette is six notes, the others seven — the seven-note Spirits sit ~4 points higher, by design');
}

// ═══ 3. ONE rand() PER NOTE ═════════════════════════════════════════════════
console.log('§3 exactly one random number per note — replays stay in step');
{
  for (const root of ROOTS) {
    let calls = 0;
    const counted = () => { calls++; return (calls * 0.6180339887) % 1; };
    randomNote(root, 'hirajoshi', counted);
    ok(calls === 1, `${root}: randomNote spends one number`);
  }
  let calls = 0;
  const counted = () => { calls++; return (calls * 0.37) % 1; };
  const hand = refillStock('D', 'hirajoshi', 11, counted);
  ok(hand.length === 11 && calls === 11, 'refillStock(11) spends eleven numbers');
  calls = 0;
  randomNote(null, 'hirajoshi', counted);
  ok(calls === 1, 'the rootless draw spends one number too');

  const a = makeRng(42), b = makeRng(42);
  const ha = refillStock('E', 'dorian', 40, a), hb = refillStock('E', 'dorian', 40, b);
  ok(JSON.stringify(ha) === JSON.stringify(hb), 'the same seed draws the same forty notes');
  ok(a.state().cursor === 40 && b.state().cursor === 40, '…and leaves both cursors at 40');

  // The single float does both jobs, so its edges must land safely.
  for (const u of [0, 0.4999999, 0.5, 0.9999999]) {
    const n = randomNote('C', 'hirajoshi', () => u);
    ok(typeof n === 'string' && getSpelledPool('C', 'hirajoshi').includes(n), `u=${u} draws a real note (${n})`);
  }
  ok(randomNote('C', 'hirajoshi', () => 0.4999999) === 'Ab', 'just under the guarantee is the top of the palette (A♭)');
  ok(randomNote('C', 'hirajoshi', () => 0.5) === 'C', 'exactly the guarantee starts the chance half at the bottom of all twelve (C)');
  ok(randomNote('C', 'hirajoshi', () => 0.5 + 0.5 * (1.5 / 12)) === 'Db', '…which then walks all twelve, off-palette notes included (D♭)');
}

// ═══ 4. THE SHARE ARGUMENT ══════════════════════════════════════════════════
console.log('§4 the guarantee can be overridden, and clamps');
{
  const rng = makeRng(7);
  const all = (g) => Array.from({ length: 6000 }, () => randomNote('G', 'hirajoshi', rng, g));
  const rateOf = hand => hand.filter(n => inPalette(n, 'G', 'hirajoshi')).length / hand.length;
  ok(all(1).every(n => inPalette(n, 'G', 'hirajoshi')), 'guarantee 1 → only palette notes');
  ok(near(rateOf(all(0)), 0.5, 0.03), 'guarantee 0 → the old uniform draw (50% for six notes)');
  ok(all(5).every(n => inPalette(n, 'G', 'hirajoshi')), 'guarantee above 1 clamps to 1');
  ok(near(rateOf(all(NaN)), 0.75, 0.03), 'a non-number guarantee falls back to the constant');
  const rootless = Array.from({ length: 24000 }, () => randomNote(null, 'hirajoshi', rng));
  const pcs = new Set(rootless.map(pitchIndex));
  ok(pcs.size === 12, 'with no root there is no palette — the draw stays uniform over twelve');
}

// ═══ 5. THE REAL HANDS ══════════════════════════════════════════════════════
console.log('§5 the hands players actually get');
{
  // Opening stock.
  let inside = 0, total = 0;
  for (let seed = 1; seed <= 1500; seed++) {
    const ns = makeInitialNoteState('cosmic_ronin', makeRng(seed));
    total += ns.noteStock.length;
    inside += ns.noteStock.filter(n => inPalette(n, ns.rootNote, ns.paletteMode)).length;
  }
  const perHand = inside / 1500;
  ok(near(perHand, 8.25, 0.15), `the Ronin opens with ${perHand.toFixed(2)} palette notes of 11 (was ~5.5)`);
  ok(near(inside / total, 0.75, 0.01), '…75% of his opening stock');
  // Variance is the point: the chance half must still produce different hands.
  const spreads = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const ns = makeInitialNoteState('cosmic_ronin', makeRng(seed));
    spreads.add(ns.noteStock.filter(n => inPalette(n, ns.rootNote, ns.paletteMode)).length);
  }
  ok(spreads.size >= 4, `opening hands still vary — ${[...spreads].sort((a, b) => a - b).join('/')} palette notes seen across 300 seeds`);

  // Turn-start refill: only the REFRESHED slots are drawn, in next turn's key.
  let fresh = 0, freshInside = 0;
  for (let seed = 1; seed <= 1500; seed++) {
    const base = makeInitialNoteState('intergalactic_0', makeRng(seed));
    const root = ['C', 'E', 'Ab', 'B'][seed % 4];
    const ns = { ...base, rootNote: root, usedStockIdx: [0, 1, 2, 3, 4, 5] };
    const r = makeRng(seed * 31);
    const draws = Array.from({ length: refillDrawCount(ns) }, () => r());
    const { patch } = startTurnNotes(ns, { draws, spiritId: 'intergalactic_0' });
    for (const idx of [0, 1, 2, 3, 4, 5]) {
      fresh++;
      if (inPalette(patch.noteStock[idx], root, base.paletteMode)) freshInside++;
    }
  }
  ok(near(freshInside / fresh, expected(7), 0.015), `refilled slots land in the NEW root's palette ${(100 * freshInside / fresh).toFixed(1)}% of the time (Dorian, want ~79%)`);
}

// ═══ 6. THE WIRING ══════════════════════════════════════════════════════════
console.log('§6 every personal draw is weighted; the board is not');
{
  const turnFlow = read('../engine/systems/turnFlow.js');
  ok(/randomNote\(paletteRoot, paletteMode, \(\) => draw\)/.test(turnFlow), 'the refill draws through randomNote with next turn’s root');
  const econ = read('../engine/systems/economy.js');
  ok(/refillStock\(root, initMode, stockSize, rand\)/.test(econ), 'the opening stock draws through refillStock');
  const transition = read('../engine/policies/transition.js');
  ok(/randomNote\(ns\.rootNote, ns\.scaleMode, \(\) => rng\(\)\)/.test(transition), 'the Ronin’s second note (engine) draws through randomNote');
  const client = read('../rlsw-simulator-v3_8_1.jsx');
  ok(/randomNote\(rootNote, scaleMode, \(\) => batch\[i\+\+\] \?\? 0\)/.test(client), 'the Ronin’s second note (client) draws through randomNote');
  for (const [name, src] of [['turnFlow', turnFlow], ['economy', econ], ['transition', transition], ['client', client]]) {
    ok(!/randomNote\([^)]*,[^)]*,[^)]*,[^)]*\)/.test(src) && !/refillStock\([^)]*,[^)]*,[^)]*,[^)]*,[^)]*\)/.test(src),
      `${name} passes no guarantee of its own — one constant owns the number`);
  }
  const helpers = read('../board/boardHelpers.js');
  const token = helpers.slice(helpers.indexOf('export function makeBoardToken'), helpers.indexOf('\n}', helpers.indexOf('export function makeBoardToken')));
  ok(token.length > 0 && !/randomNote|STOCK_PALETTE_GUARANTEE|playableScale/.test(token), 'makeBoardToken does not read any palette');
  ok(TOKEN_UNLOCK_SPAWN_SHARE === 0.35, 'the board keeps its own, separate lean (0.35 toward seat unlocks)');
  const pkg = JSON.parse(read('../../package.json'));
  ok(!!pkg.scripts['test:stockdraw'] && /test:stockdraw/.test(pkg.scripts['test:all']), 'test:stockdraw exists and test:all runs it');
}

console.log('');
if (failures.length) {
  console.log(`❌ stockDrawCheck: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`✅ stockDrawCheck: ${pass} assertions passed`);
