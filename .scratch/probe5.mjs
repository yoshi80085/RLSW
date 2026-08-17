// When an attack IS on the table, what does the evaluator think of it?
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { evaluate } from '../src/engine/policies/evaluate.js';
import { legalActions } from '../src/engine/policies/legalActions.js';
import { applyBotAction } from '../src/engine/policies/transition.js';
import { makeRng } from '../src/engine/rng.js';

const ids = ['cosmic_ronin', 'Metalness_Monster'];
const spirits = ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: i, num: [1, 91][i], facing: 0,
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe, cpu: true,
}));

const ATT = new Set(['swing', 'sonic', 'riffOff', 'tentacle']);
let offered = 0, dp = 0, chosen = 0;
const samples = [];
const policies = Object.fromEntries(ids.map(id => [id, (st, sid, v, ctx) => {
  dp++;
  const opts = legalActions(st, sid, v);
  const atk = opts.filter(a => ATT.has(a.kind));
  const pick = POLICIES.searcher({})(st, sid, v, ctx);
  const arr = Array.isArray(pick) ? pick : [pick];
  if (atk.length) {
    offered++;
    if (arr.some(a => ATT.has(a.kind))) chosen++;
    else if (samples.length < 3) {
      // score every option from this seat
      const rng = makeRng(99).fork('probe');
      const base = evaluate(st, sid, v).score;
      const rows = [];
      for (const a of opts) {
        const r = applyBotAction(st, a, { rng, view: v, hooks: {} });
        if (!r.ok) continue;
        const e = evaluate(r.state, sid, r.view ?? v);
        rows.push({ k: a.kind, t: a.targetId ?? a.to ?? '', d: e.score - base, terms: e.terms, w: e.weights });
      }
      rows.sort((x, y) => y.d - x.d);
      samples.push({ sid, base, rows, ap: st.turn.moveStepsLeft });
    }
  }
  return pick;
}]));
runMatch({ seed: 4242, spirits, policies, maxTurns: 250 });
console.log(`decision points ${dp}; attack offered ${offered}; attack chosen ${chosen}`);
for (const s of samples) {
  console.log(`\n== ${s.sid}  ap=${s.ap}  base=${s.base.toFixed(3)}`);
  for (const r of s.rows.slice(0, 6)) console.log('   ', r.k.padEnd(12), String(r.t).padEnd(18), r.d.toFixed(4));
  const atk = s.rows.filter(r => ATT.has(r.k));
  for (const r of atk) {
    console.log('  >>', r.k.padEnd(12), String(r.t).padEnd(18), r.d.toFixed(4),
      '| pressure', (r.terms.pressure * r.w.pressure).toFixed(3),
      'fame', (r.terms.fame * r.w.fame).toFixed(3),
      'apBanked', (r.terms.apBanked * r.w.apBanked).toFixed(3),
      'survival', (r.terms.survival * r.w.survival).toFixed(3),
      'beamSetup', (r.terms.beamSetup * r.w.beamSetup).toFixed(3));
  }
}
