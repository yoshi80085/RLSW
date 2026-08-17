// 🔬 §6.6.8 sweep — what is `posePlay` worth, and where does it start
// switching the beam off (the §6.6.7 centre/rig tension, one term further on)?
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

const N_MATCH = Number(process.argv[2] ?? 9);
const WEIGHTS = (process.argv[3] ?? '0,0.3,0.6,0.9,1.2,1.5,2.0').split(',').map(Number);
function go(label, over, n = N_MATCH) {
  let turns = 0, dec = 0, fame = 0, poses = 0; const by = {};
  for (const [, s] of PAIRS) for (let i = 0; i < n; i++) {
    const policies = Object.fromEntries(s.map(x => [x.id, (st, sid, v, ctx) => {
      const p = POLICIES.searcher({})(st, sid, v, ctx);
      for (const a of (Array.isArray(p) ? p : [p])) {
        if (a?.kind === 'pose') poses++;
        if (ATT.has(a?.kind)) by[a.kind] = (by[a.kind] ?? 0) + 1;
      }
      return p;
    }]));
    const r = runMatch({ seed: (i * 2654435761 + 12345) >>> 0, spirits: s, policies,
                         view: over ? { weightOverrides: over } : {} });
    turns += r.turns; if (r.winner) dec++;
    fame += Object.values(r.fame ?? {}).reduce((a, b) => a + b, 0);
  }
  const N = n * PAIRS.length;
  console.log(label.padEnd(22), 'turns', String(Math.round(turns / N)).padStart(4),
    'decided', `${dec}/${N}`.padStart(6), 'FP/turn', (fame / turns).toFixed(3),
    'poses', String(poses).padStart(4), 'atk', JSON.stringify(by));
}

for (const w of WEIGHTS) go(`posePlay ${w}`, { posePlay: w });
