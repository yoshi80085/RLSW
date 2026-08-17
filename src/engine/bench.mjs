// ─── THE BENCH ───────────────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/bench.mjs [n] [a] [b]
//   e.g. npm run bench:bot -- 2000 searcher unranked
//        npm run bench:bot -- 520 searcher unranked 0 --weights='{"pressure":0}'
//
// BOT_STRATEGY_HANDOFF §6.6's ~2000 matches. NOT a test — it prints evidence.
// `harnessCheck.mjs` is what guards the instrument; this drives it.
//
// ⚠️ READ `HARNESS_GAPS` BEFORE QUOTING ANY NUMBER THIS PRINTS. ~~Base kits~~ —
// unlocks have been live since the SKILL_TREE extraction — but there is still no
// Smash and no Blaster (both unmodelled), the games are SHORT (two lives, to
// sidestep the Rock God finale), the client's fan hooks are absent, and as of
// 2026-08-17 the riff-off's two PERFORMANCES are modelled rather than played. A win rate out of this is
// evidence about the searcher, not a balance reading about the roster — and
// §4.3's rule still stands regardless: Metalness's eval weights are not
// tunable against the other two until his kit is finished.

import { runBench, HARNESS_GAPS, POLICIES } from "./policies/play.js";

const argv = process.argv.slice(2);
const N = Number(argv[0] ?? 400);
const A = argv[1] ?? 'searcher';
const B = argv[2] ?? 'unranked';
// ⚠️ CHUNKING IS NOT SAMPLING TWICE. `offset` shifts the seed index so a long
// run can be split across several invocations and the parts SUMMED — each chunk
// draws a disjoint slice of the same decorrelated seed sequence, so N=2000 in
// one process and 8×250 with offsets 0,250,… are the same 2000 matches.
const OFFSET = Number(argv[3] ?? 0);
const JSON_LINE = argv.includes('--json');

// 🔬 `--weights='{"pressure":0}'` — patch §5's weight table for THIS RUN ONLY.
//
// ⚠️ WHAT IT IS FOR IS ISOLATING ONE TERM, and that is a different question from
// tuning one. When two changes land together — a new term and a bug fix — the
// win rate that comes out afterwards cannot say which of them moved it. Zeroing
// the term at fixed seeds, with everything else identical, splits the two.
// Without this the only way to ask was to edit `evaluate.js` and remember to put
// it back, which is a procedure, not an instrument.
//
// ⚠️ IT APPLIES TO BOTH SEATS. The override rides `view`, which `runMatch` hands
// to every policy in the match, so this asks "what does the game look like
// WITHOUT this term" — not "what happens when one side is handicapped". For the
// second question, use a per-Spirit table.
//
// 📌 It MERGES onto the Spirit's column rather than replacing it (see
// `weightsFor`), so a one-key object changes exactly one row.
const wArg = argv.find(a => a.startsWith('--weights='));
let WEIGHT_OVERRIDES = null;
if (wArg) {
  try {
    WEIGHT_OVERRIDES = JSON.parse(wArg.slice('--weights='.length));
  } catch (e) {
    console.error(`--weights is not valid JSON: ${e.message}`);
    process.exit(1);
  }
}

if (!POLICIES[A] || !POLICIES[B]) {
  console.error(`unknown policy — available: ${Object.keys(POLICIES).join(', ')}`);
  process.exit(1);
}

// ⚠️ SEEDS ARE SPREAD, NOT SEQUENTIAL. `makeInitialState` forks its subsystem
// rngs off the seed by label, and adjacent integer seeds are adjacent mulberry32
// states — a run of 1..N risks correlated openings, which would quietly shrink
// the effective sample. A large odd stride decorrelates them and stays
// reproducible from N alone.
const seeds = Array.from({ length: N }, (_, i) => ((i + OFFSET) * 2654435761 + 12345) >>> 0);

const DUEL = [
  { id: 'cosmic_ronin',    name: 'Shredding Ronin', corner: 'blue',   num: 12, vibe: 5, maxVibe: 5, speed: 5, facing: 0 },
  { id: 'intergalactic_0', name: 'Intergalactic 0', corner: 'purple', num: 44, vibe: 4, maxVibe: 4, speed: 4, facing: 0 },
];

const t0 = Date.now();
const bench = runBench({
  seeds, spirits: DUEL, a: A, b: B,
  view: WEIGHT_OVERRIDES ? { weightOverrides: WEIGHT_OVERRIDES } : undefined,
});
const ms = Date.now() - t0;

const pct = (n) => `${(n * 100).toFixed(1)}%`;
const turns = bench.results.map(r => r.turns);
const mean = turns.reduce((s, t) => s + t, 0) / (turns.length || 1);

console.log('');
console.log(`🎸 §6.6 BENCH — ${A} vs ${B}, ${N} matches in ${(ms / 1000).toFixed(1)}s`);
console.log('─'.repeat(64));
console.log(`  ${A.padEnd(10)} ${String(bench.wins[A]).padStart(5)} wins`);
console.log(`  ${B.padEnd(10)} ${String(bench.wins[B]).padStart(5)} wins`);
console.log(`  inconclusive ${String(bench.inconclusive).padStart(3)}  (turn cap — EXCLUDED from the rate, not counted as losses)`);
console.log('─'.repeat(64));
console.log(`  ${A} win rate over DECIDED matches: ${pct(bench.rate)}  (${bench.wins[A]}/${bench.decided})`);

// ── 🎯 THE BAR, RESTATED AS TWO GATES — `SEQUENCING.md` §5.A ────────────────
//
// ⚠️ "≥60% OVER DECIDED MATCHES" WAS MEASURING ITS OWN FILTER, and it was not a
// subtle effect. Across the three runs on record the decided-only rate tracked
// the EXCLUSION rate almost perfectly — 36.9% excluded → 65.7%, 49.2% → 84.5%,
// 9.8% → 56.3% — because a match resolves when somebody runs away with it, which
// is exactly the situation a stronger searcher creates. Throwing away the stalls
// throws away the hard games. Under the old single gate the WORST configuration
// ever measured, the one where half the matches never finished, scored best.
//
// So there are two gates now and both must clear:
//   1. A DRAW-INCLUSIVE WIN RATE, over a denominator that cannot move — a stall
//      counts as half a win for each side. ⚠️ This is a BOUND, not a
//      measurement: it assumes stalls are 50/50, which is a guess. It is an
//      honest guess in a way that dropping them is not.
//   2. A MAXIMUM INCONCLUSIVE RATE. A game that cannot end is a design finding
//      in its own right and must never be silently filtered into a better score.
const INCONCLUSIVE_MAX = 0.15;
const DRAW_INCLUSIVE_BAR = 0.60;
const inconclusiveRate = bench.inconclusive / (N || 1);
const drawInclusive = (bench.wins[A] + bench.inconclusive / 2) / (N || 1);
const gate1 = drawInclusive >= DRAW_INCLUSIVE_BAR;
const gate2 = inconclusiveRate <= INCONCLUSIVE_MAX;
console.log(`  draw-inclusive rate (fixed denominator): ${pct(drawInclusive)}  — bar ≥${pct(DRAW_INCLUSIVE_BAR)} ${gate1 ? '✅' : '❌'}`);
console.log(`  inconclusive rate:                       ${pct(inconclusiveRate)}  — bar ≤${pct(INCONCLUSIVE_MAX)} ${gate2 ? '✅' : '❌'}`);
console.log(`  §6.6 bar (both gates): ${gate1 && gate2 ? '✅ CLEARED' : '❌ NOT CLEARED'}`);
console.log(`  📌 old single gate, kept for comparison only: ${bench.rate >= 0.6 ? 'would clear' : 'would not clear'} at ≥60% decided-only`);
console.log('');

// ⚠️ A 95% interval on a proportion, so a 3-point gap on 200 matches is not read
// as a result. §5's warning about trusting a single number applies here too.
const n = bench.decided || 1;
const se = Math.sqrt(bench.rate * (1 - bench.rate) / n);
console.log(`  ±${(1.96 * se * 100).toFixed(1)} points at 95% on ${n} decided matches`);
console.log(`  mean match length: ${mean.toFixed(0)} turns`);
console.log('');
if (!JSON_LINE) {
  console.log('⚠️ what this did NOT measure:');
  for (const [k, why] of Object.entries(HARNESS_GAPS)) console.log(`   · ${k}: ${why}`);
  console.log('');
} else {
  console.log(`JSON ${JSON.stringify({ n: N, offset: OFFSET, a: A, b: B, wins: bench.wins, inconclusive: bench.inconclusive, decided: bench.decided, ms })}`);
}
