// What the bot actually DOES now — one duel, counted by action kind.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { applyAction } from '../src/engine/reduce.js';

const ids = ['cosmic_ronin', 'Metalness_Monster'];
const spirits = ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: i, num: [1, 91][i], facing: 0,
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe, cpu: true,
}));

// Instrument playTurn by wrapping the policy
const counts = {};
function wrap(p) {
  return (state, id, view, ctx) => {
    const a = p(state, id, view, ctx);
    const arr = Array.isArray(a) ? a : [a];
    for (const x of arr) counts[x?.kind ?? 'null'] = (counts[x?.kind ?? 'null'] ?? 0) + 1;
    return a;
  };
}
let turns = 0, fames = [], reasons = {};
const N = 12;
for (let i = 0; i < N; i++) {
  const policies = Object.fromEntries(ids.map(id => [id, wrap(POLICIES.searcher({}))]));
  const r = runMatch({ seed: 1000 + i, spirits, policies });
  turns += r.turns;
  reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
  fames.push(JSON.stringify(r.fame));
}
console.log('matches', N, 'mean turns', (turns / N).toFixed(1), JSON.stringify(reasons));
console.log('final fame:', fames.slice(0, 6).join(' '));
console.log('action counts:', JSON.stringify(counts, null, 0));
