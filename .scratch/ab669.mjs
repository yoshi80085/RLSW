// A/B for §6.6.9 — the riff-off's Round 2, before and after. Runs UNCHANGED on
// both trees: an older checkout simply never escalates, so its `duels` column is
// all Round 1 and its FP/turn is the Round-1-only economy. Same seeds, same
// fixture, same pairs as ab68.mjs so the two probes are comparable.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
const ATT = new Set(['swing', 'sonic', 'riffOff', 'tentacle']);
const sp = (ids, hexes, corners) => ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: corners[i], num: hexes[i],
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe,
  speed: SPIRIT_DEFS[id].speed, facing: 0, cpu: true,
}));
const PAIRS = [
  ['R-vs-Z', sp(['cosmic_ronin', 'intergalactic_0'], [12, 44], ['blue', 'purple'])],
  ['R-vs-M', sp(['cosmic_ronin', 'Metalness_Monster'], [12, 44], ['blue', 'yellow'])],
];
const n = Number(process.argv[2] ?? 22);
let turns = 0, dec = 0, fame = 0, banked = 0; const by = {};
const D = { fought: 0, round2: 0, ties: 0, bothPaid: 0, fp: 0, fpRound2: 0 };
for (const [, s] of PAIRS) for (let i = 0; i < n; i++) {
  const policies = Object.fromEntries(s.map(x => [x.id, (st, sid, v, ctx) => {
    const p = POLICIES.searcher({})(st, sid, v, ctx);
    for (const a of (Array.isArray(p) ? p : [p])) {
      if (ATT.has(a?.kind)) by[a.kind] = (by[a.kind] ?? 0) + 1;
    }
    return p;
  }]));
  const r = runMatch({ seed: (i * 2654435761 + 12345) >>> 0, spirits: s, policies });
  turns += r.turns; if (r.winner) dec++;
  fame += Object.values(r.fame ?? {}).reduce((a, b) => a + b, 0);
  banked += Object.values(r.limelightScores ?? {}).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(D)) D[k] += r.duels?.[k] ?? 0;
}
const N = n * PAIRS.length;
console.log(`matches ${N}  turns ${Math.round(turns / N)}  decided ${dec}/${N} (${(100*dec/N).toFixed(0)}%)`);
console.log(`  FP/turn ${(fame / turns).toFixed(3)}  total FP ${fame}  pose rounds PAID ${banked}`);
console.log(`  attacks ${JSON.stringify(by)}`);
const r1n = D.fought - D.round2, r1fp = D.fp - D.fpRound2;
console.log(`  FP per duel — Round 1 ${(r1fp / Math.max(1, r1n)).toFixed(2)} (${r1n} duels)  ·  Round 2 ${(D.fpRound2 / Math.max(1, D.round2)).toFixed(2)} (${D.round2} duels)`);
console.log(`  duels ${JSON.stringify(D)}   (an older tree reports round2 0 — that is the finding)`);
