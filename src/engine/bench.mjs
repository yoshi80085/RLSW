// ─── THE BENCH ───────────────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/bench.mjs [n] [a] [b]
//   e.g. npm run bench:bot -- 2000 searcher unranked
//        npm run bench:bot -- 520 searcher unranked 0 --weights='{"pressure":0}'
//
// BOT_STRATEGY_HANDOFF §6.6's ~2000 matches. NOT a test — it prints evidence.
// `harnessCheck.mjs` is what guards the instrument; this drives it.
//
// ⚠️ READ `HARNESS_GAPS` BEFORE QUOTING ANY NUMBER THIS PRINTS. Three of the old
// caveats are gone and it is worth saying which, because the numbers moved with
// them: ~~base kits~~ (unlocks live since the SKILL_TREE extraction), ~~two-life
// games~~ (three by default since 2026-08-18; the boss that forced it was
// archived 2026-09-01), and ~~the client's fan hooks are absent~~ (`gainFans`
// and `demolishFans` are in `harnessHooks` since 2026-09-01 — and that one was
// not cosmetic: fans MULTIPLY Fame by up to ×2.0 inside `grantFame`, so a
// harness that paid none was pricing every Fame payout in the game against a
// crowd that could only grow).
//
// What is still missing: no Smash and no Blaster (both unmodelled), the Unsure
// crowd is banked per turn rather than instantly, and the riff-off's two
// PERFORMANCES are modelled rather than played. A win rate out of this is
// evidence about the searcher, not a balance reading about the roster — and
// §4.3's rule still stands regardless: Metalness's eval weights are not
// tunable against the other two until his kit is finished.
//
// ⚠️ EVERY NUMBER FROM BEFORE 2026-09-01 IS DRAWN FROM A DIFFERENT SEEDED
// SEQUENCE. The demolition hook takes one seeded draw per scatter, so the
// stream diverges from the first knockdown in the centre onwards. A win-rate
// difference across that date is not a policy result.

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
// ⚠️ THE PLAIN MEAN AVERAGES THE TURN CAP IN, and at a 12% stall rate that is
// most of it: 5 matches parked at MAX_TURNS contribute more turns than the 35
// that finished. Quoting it as "how long a game runs" over-states the horizon by
// a factor of three, which matters because §3.2/§3.6 make the horizon the
// strategic variable. Decided-only and the median are the honest numbers.
const decidedTurns = bench.results.filter(r => r.reason === 'winner').map(r => r.turns).sort((x, y) => x - y);
const meanDecided = decidedTurns.reduce((s2, t) => s2 + t, 0) / (decidedTurns.length || 1);
const median = decidedTurns.length
  ? (decidedTurns.length % 2
      ? decidedTurns[(decidedTurns.length - 1) / 2]
      : (decidedTurns[decidedTurns.length / 2 - 1] + decidedTurns[decidedTurns.length / 2]) / 2)
  : 0;
const seats = DUEL.length;
console.log(`  match length — all: ${mean.toFixed(0)} turns (the turn cap is averaged in)`);
console.log(`               decided: mean ${meanDecided.toFixed(0)}, median ${median} spirit-turns`
  + `  = ${(meanDecided / seats).toFixed(0)} per player over ${seats} seats`);
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// ⭐📏 THE FAME LEDGER — what the rules awarded vs what anybody kept.
//
// ⚠️ THIS HAD NEVER BEEN PRINTED. `FAME_PER_TURN_CAP` DISCARDS overflow, so
// "Fame earned" and "Fame awarded" are two different quantities and the bench
// only ever saw the first. PROGRESSION_REWRITE_DESIGN §8 wants to add a whole
// new fan source (fans multiply Fame) on top of a cap nobody had measured.
//
// `crowd ×` is the EFFECTIVE multiplier — amplified ÷ asked, over every grant
// in every match. It is not `FAN_MULT_CAP` and should not be compared to it:
// most grants happen on a small crowd, and this is the average one.
// ═══════════════════════════════════════════════════════════════════════════
const led = {};
for (const r of bench.results) {
  for (const [id, row] of Object.entries(r.fameLedger ?? {})) {
    const t = led[id] ??= { grants: 0, silenced: 0, asked: 0, amplified: 0, banked: 0, discarded: 0 };
    for (const k of Object.keys(t)) t[k] += row[k] ?? 0;
  }
}
const all = Object.values(led).reduce((t, row) => {
  for (const k of Object.keys(t)) t[k] += row[k] ?? 0;
  return t;
}, { grants: 0, silenced: 0, asked: 0, amplified: 0, banked: 0, discarded: 0 });

if (all.grants > 0) {
  const awarded = all.banked + all.discarded;
  console.log('⭐ FAME LEDGER — awarded vs kept');
  console.log('─'.repeat(64));
  console.log(`  grants:      ${all.grants}  (${(all.grants / N).toFixed(1)} per match)`);
  console.log(`  asked:       ${all.asked}   → amplified: ${all.amplified}  (crowd ×${(all.amplified / (all.asked || 1)).toFixed(2)} effective)`);
  console.log(`  banked:      ${all.banked}`);
  console.log(`  DISCARDED:   ${all.discarded}  — ${pct(all.discarded / (awarded || 1))} of everything the rules awarded, lost to the ${'FAME_PER_TURN_CAP'}`);
  console.log(`  silenced:    ${all.silenced} grants banked ZERO  (${pct(all.silenced / all.grants)} of grants)`);
  for (const [id, row] of Object.entries(led)) {
    const aw = row.banked + row.discarded;
    console.log(`    ${id.padEnd(18)} banked ${String(row.banked).padStart(5)}  discarded ${String(row.discarded).padStart(5)}  (${pct(row.discarded / (aw || 1))})`);
  }
  console.log('');
}
if (!JSON_LINE) {
  console.log('⚠️ what this did NOT measure:');
  for (const [k, why] of Object.entries(HARNESS_GAPS)) console.log(`   · ${k}: ${why}`);
  console.log('');
} else {
  console.log(`JSON ${JSON.stringify({ n: N, offset: OFFSET, a: A, b: B, wins: bench.wins, inconclusive: bench.inconclusive, decided: bench.decided, ms })}`);
}
