// ─── THE BENCH ───────────────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/bench.mjs [n] [a] [b]
//   e.g. npm run bench:bot -- 2000 searcher unranked
//
// BOT_STRATEGY_HANDOFF §6.6's ~2000 matches. NOT a test — it prints evidence.
// `harnessCheck.mjs` is what guards the instrument; this drives it.
//
// ⚠️ READ `HARNESS_GAPS` BEFORE QUOTING ANY NUMBER THIS PRINTS. Every match here
// is played on BASE KITS (SKILL_TREE is still in the monolith), with no Smash or
// Blaster (both unmodelled), on SHORT GAMES (two lives, to sidestep the Rock God
// finale), and with the client's fan hooks absent. A win rate out of this is
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
const bench = runBench({ seeds, spirits: DUEL, a: A, b: B });
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
console.log(`  §6.6 bar is ≥60% — ${bench.rate >= 0.6 ? '✅ CLEARED' : '❌ NOT CLEARED'}`);
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
