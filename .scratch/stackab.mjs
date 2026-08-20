// 🥁 PROBE 3 — IS IT THE ORDERING, OR DOES `evaluate` NOT WANT THE STACKS?
// For every composition turn, price two lines at their own confirm:
//   A) what the searcher actually built (notes only, until the track is full)
//   B) the same search, but the first up-to-3 steps SPENT ON COMMITS
// Same transition, same evaluator, same state. A tie or a loss for B means the
// ordering is not the whole story.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { legalActions, beamActions } from '../src/engine/policies/legalActions.js';
import { makeActionScorer } from '../src/engine/policies/actionScore.js';
import { applyBotAction, applyBotLine } from '../src/engine/policies/transition.js';
import { evaluate } from '../src/engine/policies/evaluate.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';

const sp = (ids, hexes, corners) => ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: corners[i], num: hexes[i],
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe,
  speed: SPIRIT_DEFS[id].speed, facing: 0, cpu: true,
}));
const PAIRS = [
  sp(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple']),
  sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']),
  sp(['Metalness_Monster','intergalactic_0'],[12,44],['yellow','purple']),
];
const n = Number(process.argv[2] ?? 4);
const lives = Number(process.argv[3] ?? 3);
const DEPTH = 11;

// Walk one composition, preferring `preferKind` while it is legal & budgeted.
function bestLine(state, spiritId, view, ctx, preferCommits) {
  const probe = ctx.rng.fork(`ab:${state?.turn?.count ?? 0}:${preferCommits ? 'c' : 'n'}`);
  let cur = state, curView = view;
  const prefix = [];
  let best = null, bestScore = -Infinity, bestCommits = 0;
  for (let i = 0; i <= DEPTH; i++) {
    const options = legalActions(cur, spiritId, curView).filter(a => !a.illegal);
    const confirm = options.find(a => a.kind === 'confirmMelody');
    if (confirm) {
      const line = [...prefix, confirm];
      const r = applyBotLine(state, line, { rng: probe, view, hooks: ctx.hooks });
      if (!r.stoppedAt) {
        const s = evaluate(r.state, spiritId, r.view ?? view).score;
        if (s > bestScore) {
          bestScore = s; best = line;
          bestCommits = line.filter(a => a.kind === 'stackCommit').length;
        }
      }
    }
    let steps = options.filter(a => a.kind === 'melodyNote' || a.kind === 'stackCommit');
    if (!steps.length) break;
    if (preferCommits) {
      const c = steps.filter(a => a.kind === 'stackCommit');
      if (c.length) steps = c;
    }
    const pick = beamActions(steps, { limit: 1, score: makeActionScorer(cur, spiritId, curView) })[0];
    if (!pick) break;
    const r = applyBotAction(cur, pick, { rng: probe, view: curView, hooks: ctx.hooks });
    if (!r.ok) break;
    cur = r.state; curView = r.view ?? curView;
    prefix.push(pick);
  }
  return { score: bestScore, commits: bestCommits, len: best ? best.length - 1 : 0 };
}

const stat = {};
const get = (id) => (stat[id] ??= { turns: 0, bWins: 0, aWins: 0, ties: 0, delta: [], bCommits: [] });

for (const S of PAIRS) {
  for (let i = 0; i < n; i++) {
    const policies = Object.fromEntries(S.map(x => {
      const inner = POLICIES.searcher();
      return [x.id, (state, spiritId, view, ctx) => {
        const ns = state?.noteStates?.[spiritId] ?? {};
        if (!ns.hasConfirmed) {
          const hasCommit = legalActions(state, spiritId, view).some(a => a.kind === 'stackCommit');
          if (hasCommit) {
            const A = bestLine(state, spiritId, view, ctx, false);
            const B = bestLine(state, spiritId, view, ctx, true);
            const s = get(spiritId);
            if (Number.isFinite(A.score) && Number.isFinite(B.score)) {
              s.turns++;
              s.delta.push(B.score - A.score);
              s.bCommits.push(B.commits);
              if (B.score > A.score + 1e-9) s.bWins++;
              else if (A.score > B.score + 1e-9) s.aWins++;
              else s.ties++;
            }
          }
        }
        return inner(state, spiritId, view, ctx);
      }];
    }));
    runMatch({ seed: (i * 2654435761 + 12345) >>> 0, spirits: S, policies, lives });
  }
}

const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
console.log(`A = notes-first (shipped)   B = commits-first, same search & evaluator\n`);
for (const [id, s] of Object.entries(stat)) {
  console.log(id);
  console.log(`  turns compared     ${s.turns}`);
  console.log(`  B better ${s.bWins}  |  A better ${s.aWins}  |  tie ${s.ties}`);
  console.log(`  mean score delta (B − A)  ${mean(s.delta).toFixed(3)}`);
  console.log(`  commits in B's winning line, mean ${mean(s.bCommits).toFixed(2)}\n`);
}
