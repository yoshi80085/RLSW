// Weight sweep: what actually makes matches END, with Fame moving.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { legalActions } from '../src/engine/policies/legalActions.js';

const ids = ['cosmic_ronin', 'Metalness_Monster'];
const spirits = ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: i, num: [1, 91][i], facing: 0,
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe, cpu: true,
}));
const ATT = new Set(['swing', 'sonic', 'riffOff', 'tentacle']);

function run(label, overrides, n = 10, maxTurns = 400) {
  let turns = 0, decided = 0, fameTotal = 0, atk = 0, duels = 0, offered = 0, dp = 0;
  for (let i = 0; i < n; i++) {
    const policies = Object.fromEntries(ids.map(id => [id, (st, sid, v, ctx) => {
      dp++;
      if (legalActions(st, sid, v).some(a => ATT.has(a.kind))) offered++;
      const p = POLICIES.searcher({})(st, sid, v, ctx);
      const arr = Array.isArray(p) ? p : [p];
      for (const a of arr) { if (ATT.has(a?.kind)) atk++; if (a?.kind === 'riffOff') duels++; }
      return p;
    }]));
    const r = runMatch({ seed: 5000 + i, spirits, policies,
                         view: overrides ? { weightOverrides: overrides } : {}, maxTurns });
    turns += r.turns;
    if (r.winner) decided++;
    fameTotal += Object.values(r.fame ?? {}).reduce((a, b) => a + b, 0);
  }
  console.log(
    label.padEnd(26),
    'turns', String(Math.round(turns / n)).padStart(4),
    'decided', `${decided}/${n}`.padStart(6),
    'FP/turn', (fameTotal / turns).toFixed(3),
    'atk', String(atk).padStart(4), '/ offered', String(offered).padStart(5),
    'duels', String(duels).padStart(3));
}

const B = { drive: 0.6, sustain: 0.5, pressure: 2.5, fame: 2.0 };
run('base B', B);
run('B + beam 2.5', { ...B, beamSetup: 2.5 });
run('B + beam 4', { ...B, beamSetup: 4.0 });
run('B + beam 4, apB 0.2', { ...B, beamSetup: 4.0, apBanked: 0.2 });
run('B fame 1.6', { ...B, fame: 1.6, beamSetup: 3.0 });
run('B drive .8', { ...B, drive: 0.8, sustain: 0.65, beamSetup: 3.0 });
run('B press 2.0', { ...B, pressure: 2.0, beamSetup: 3.0 });
