// 🔬 §6.6.8 — the pose actually PAID how often? A pose action is not a payout:
// `limelightHeld` needs BOTH ends of the turn on hex 56, so a Spirit who walks
// in, poses, and is shoved out (or walks off) banks nothing at all.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';

const sp = (ids, hexes, corners) => ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: corners[i], num: hexes[i],
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe,
  speed: SPIRIT_DEFS[id].speed, facing: 0, cpu: true,
}));
const PAIRS = [
  ['R-vs-Z', sp(['cosmic_ronin', 'intergalactic_0'], [12, 44], ['blue', 'purple'])],
  ['R-vs-M', sp(['cosmic_ronin', 'Metalness_Monster'], [12, 44], ['blue', 'yellow'])],
];

const W = Number(process.argv[2] ?? 1.2);
const EXTRA = process.argv[4] ? JSON.parse(process.argv[4]) : {};
const n = Number(process.argv[3] ?? 9);
let poses = 0, banked = 0, maxStreak = 0, turns = 0, fame = 0, dec = 0;

for (const [, s] of PAIRS) for (let i = 0; i < n; i++) {
  const policies = Object.fromEntries(s.map(x => [x.id, (st, sid, v, ctx) => {
    const p = POLICIES.searcher({})(st, sid, v, ctx);
    for (const a of (Array.isArray(p) ? p : [p])) if (a?.kind === 'pose') poses++;
    return p;
  }]));
  const r = runMatch({ seed: (i * 2654435761 + 12345) >>> 0, spirits: s, policies,
                       view: { weightOverrides: { posePlay: W, ...EXTRA } } });
  turns += r.turns; if (r.winner) dec++;
  fame += Object.values(r.fame ?? {}).reduce((a, b) => a + b, 0);
  for (const v of Object.values(r.limelightScores ?? {})) {
    banked += v; maxStreak = Math.max(maxStreak, v);
  }
}
const N = n * PAIRS.length;
console.log(`posePlay ${W}: ${poses} poses struck, ${banked} rounds BANKED (longest streak ${maxStreak})`);
console.log(`  turns ${Math.round(turns / N)}  decided ${dec}/${N}  FP/turn ${(fame / turns).toFixed(3)}`);
console.log(`  → ${poses ? (banked / poses).toFixed(2) : 0} paid rounds per pose struck`);
