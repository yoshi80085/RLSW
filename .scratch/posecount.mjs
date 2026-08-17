// 🔬 §6.6.8 probe — does the pose actually happen, and does it pay?
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

function go(label, over, n = 9) {
  let turns = 0, dec = 0, fame = 0, poses = 0;
  for (const [, s] of PAIRS) for (let i = 0; i < n; i++) {
    const policies = Object.fromEntries(s.map(x => [x.id, (st, sid, v, ctx) => {
      const p = POLICIES.searcher({})(st, sid, v, ctx);
      for (const a of (Array.isArray(p) ? p : [p])) if (a?.kind === 'pose') poses++;
      return p;
    }]));
    const r = runMatch({
      seed: (i * 2654435761 + 12345) >>> 0, spirits: s, policies,
      view: over ? { weightOverrides: over } : {},
    });
    turns += r.turns; if (r.winner) dec++;
    fame += Object.values(r.fame ?? {}).reduce((a, b) => a + b, 0);
  }
  const N = n * PAIRS.length;
  console.log(label.padEnd(26), 'turns', String(Math.round(turns / N)).padStart(4),
    'decided', `${dec}/${N}`.padStart(6), 'FP/turn', (fame / turns).toFixed(3),
    'poses', String(poses).padStart(4));
}

go('pose OFF (weight 0)', { posePlay: 0 });
go('pose ON (shipped)', null);
