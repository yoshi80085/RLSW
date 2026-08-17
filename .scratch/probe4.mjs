// Where do they stand, and what does the evaluator say about moving?
import { runMatch, POLICIES, startSpiritTurn } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { hexRingFromCenter } from '../src/board/boardHelpers.js';
import { axialDist } from '../src/board/hexGeometry.js';
import { HEX_BY_NUM } from '../src/board/hexMap.js';
import { evaluate } from '../src/engine/policies/evaluate.js';
import { legalActions } from '../src/engine/policies/legalActions.js';
import { applyBotAction } from '../src/engine/policies/transition.js';
import { SKILL_BY_ID } from '../src/data/skillTree.js';
import { makeRng } from '../src/engine/rng.js';

const ids = ['cosmic_ronin', 'Metalness_Monster'];
const spirits = ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: i, num: [1, 91][i], facing: 0,
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe, cpu: true,
}));

const rings = {}; const dists = {}; let n = 0; let sample = null;
const policies = Object.fromEntries(ids.map(id => [id, (st, sid, v, ctx) => {
  n++;
  for (const sp of st.spirits) rings[hexRingFromCenter(sp.num)] = (rings[hexRingFromCenter(sp.num)] ?? 0) + 1;
  const a = HEX_BY_NUM[st.spirits[0].num], b = HEX_BY_NUM[st.spirits[1].num];
  const d = axialDist(a.q, a.r, b.q, b.r); dists[d] = (dists[d] ?? 0) + 1;
  if (!sample && n > 400 && st.noteStates[sid]?.hasConfirmed && st.turn.moveStepsLeft >= 2) {
    sample = { state: st, sid, view: v };
  }
  return POLICIES.searcher({})(st, sid, v, ctx);
}]));
runMatch({ seed: 4242, spirits, policies, maxTurns: 200 });
console.log('decision points', n);
console.log('ring occupancy', JSON.stringify(rings));
console.log('rival distance', JSON.stringify(dists));

if (sample) {
  const { state, sid, view } = sample;
  const rng = makeRng(1).fork('probe');
  const base = evaluate(state, sid, view);
  console.log('\n--- sample seat', sid, 'hex', state.spirits.find(s=>s.id===sid).num,
              'ring', hexRingFromCenter(state.spirits.find(s=>s.id===sid).num),
              'ap', state.turn.moveStepsLeft);
  console.log('base', base.score.toFixed(4));
  const rows = [];
  for (const a of legalActions(state, sid, view)) {
    const r = applyBotAction(state, a, { rng, view, hooks: {} });
    if (!r.ok) continue;
    const e = evaluate(r.state, sid, r.view ?? view);
    rows.push({ kind: a.kind, to: a.to ?? a.targetId ?? '', d: e.score - base.score, terms: e.terms });
  }
  rows.sort((x, y) => y.d - x.d);
  for (const r of rows.slice(0, 8)) console.log('  ', r.kind.padEnd(14), String(r.to).padEnd(6), r.d.toFixed(4));
  console.log('  ...');
  for (const r of rows.slice(-3)) console.log('  ', r.kind.padEnd(14), String(r.to).padEnd(6), r.d.toFixed(4));
  const bt = base.terms, bw = base.weights;
  console.log('  base terms:', Object.keys(bt).map(k => `${k}=${(bt[k]*bw[k]).toFixed(2)}`).join(' '));
}
