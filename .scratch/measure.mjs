// The shipped table, measured. Duel and 3-hander, more seeds.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { legalActions } from '../src/engine/policies/legalActions.js';

const ATT = new Set(['swing', 'sonic', 'riffOff', 'tentacle']);
function seats(ids, hexes) {
  return ids.map((id, i) => ({
    ...SPIRIT_DEFS[id], id, corner: i, num: hexes[i], facing: 0,
    vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe, cpu: true,
  }));
}
function run(label, spirits, n, lives) {
  const ids = spirits.map(s => s.id);
  let turns = 0, decided = 0, fame = 0, atk = 0, duels = 0, sonics = 0, poses = 0;
  const styles = {};
  for (let i = 0; i < n; i++) {
    const policies = Object.fromEntries(ids.map(id => [id, (st, sid, v, ctx) => {
      const p = POLICIES.searcher({})(st, sid, v, ctx);
      for (const a of (Array.isArray(p) ? p : [p])) {
        if (ATT.has(a?.kind)) atk++;
        if (a?.kind === 'riffOff') duels++;
        if (a?.kind === 'sonic') sonics++;
        if (a?.kind === 'pose') poses++;
      }
      return p;
    }]));
    const r = runMatch({ seed: 9000 + i, spirits, policies, lives });
    turns += r.turns; if (r.winner) decided++;
    fame += Object.values(r.fame ?? {}).reduce((a, b) => a + b, 0);
  }
  const rounds = turns / n / ids.length;
  console.log(label.padEnd(22),
    'turns/match', String(Math.round(turns / n)).padStart(4),
    '~rounds', String(Math.round(rounds)).padStart(3),
    'decided', `${decided}/${n}`.padStart(7),
    'FP/turn', (fame / turns).toFixed(3),
    'atk', String(atk).padStart(4),
    'sonic', String(sonics).padStart(3),
    'duels', String(duels).padStart(3),
    'pose', String(poses).padStart(3));
}
run('duel (2 lives)', seats(['cosmic_ronin','Metalness_Monster'], [1,91]), 30);
run('duel (3 lives)', seats(['cosmic_ronin','Metalness_Monster'], [1,91]), 20, 3);
run('3-hander (2 lives)', seats(['cosmic_ronin','Metalness_Monster','intergalactic_0'], [1,91,10]), 20);
