// 🔬 §5.E‴ item 2 — DOES A LANDED SWING SCORE `pressure` NEGATIVE?
// Walks real searcher matches, and every time a `swing` is legal, applies it and
// records the case where the blow LANDS (rival vibe or lives dropped). Prints the
// raw and weighted `pressure` delta next to the geometry that explains it.
// Run: node --import ./src/engine/testAssetStub.mjs .scratch/pressureswing.mjs 3 6
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { legalActions } from '../src/engine/policies/legalActions.js';
import { applyBotAction } from '../src/engine/policies/transition.js';
import { evaluate, weightsFor } from '../src/engine/policies/evaluate.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { HEX_BY_NUM } from '../src/board/hexMap.js';
import { axialDist } from '../src/board/hexGeometry.js';

const sp = (ids, hexes, corners) => ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: corners[i], num: hexes[i],
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe,
  speed: SPIRIT_DEFS[id].speed, facing: 0, cpu: true,
}));
const PAIRS = [
  sp(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple']),
  sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']),
];
const lives = Number(process.argv[2] ?? 3);
const n = Number(process.argv[3] ?? 6);

const rows = [];
const dist = (st, a, b) => {
  const A = HEX_BY_NUM[st.spirits.find(s => s.id === a)?.num];
  const B = HEX_BY_NUM[st.spirits.find(s => s.id === b)?.num];
  return A && B ? axialDist(A.q, A.r, B.q, B.r) : null;
};
for (const S of PAIRS) for (let i = 0; i < n; i++) {
  const policies = Object.fromEntries(S.map(x => [x.id, (st, sid, v, ctx) => {
    const opts = legalActions(st, sid, v);
    const sw = opts.filter(a => a.kind === 'swing');
    if (sw.length) {
      const base = evaluate(st, sid, v);
      const W = weightsFor(sid, null);
      for (const a of sw) {
        for (let k = 0; k < 8; k++) {
          const r = applyBotAction(st, a, { rng: ctx.rng.fork(`probe:${i}:${k}`), view: v, hooks: ctx.hooks });
          if (!r.ok) continue;
          const tid = a.targetId;
          const before = st.spirits.find(s => s.id === tid);
          const after  = r.state.spirits.find(s => s.id === tid);
          if (!before || !after) continue;
          const hurt = (after.vibe ?? 0) < (before.vibe ?? 0) || (after.lives ?? 0) < (before.lives ?? 0)
                     || (after.knockedOut && !before.knockedOut);
          if (!hurt) continue;
          const ev = evaluate(r.state, sid, r.view ?? v);
          rows.push({
            seat: sid,
            dP: +(((ev.terms?.pressure ?? 0) - (base.terms?.pressure ?? 0))).toFixed(4),
            wP: +(((ev.terms?.pressure ?? 0) - (base.terms?.pressure ?? 0)) * (W.pressure ?? 0)).toFixed(3),
            dTot: +(ev.score - base.score).toFixed(3),
            vibe: `${before.vibe}->${after.vibe}`,
            lives: `${before.lives}->${after.lives}`,
            d: `${dist(st, sid, tid)}->${dist(r.state, sid, tid)}`,
          });
          break;
        }
      }
    }
    return POLICIES.searcher({})(st, sid, v, ctx);
  }]));
  runMatch({ seed: (i * 2654435761 + 12345) >>> 0, spirits: S, policies, lives });
}
const neg = rows.filter(r => r.dP < 0);
const kb  = rows.filter(r => r.d.split('->')[1] > r.d.split('->')[0]);
console.log(`landed swings sampled: ${rows.length}`);
console.log(`  pressure delta NEGATIVE on a landing blow: ${neg.length} (${(100*neg.length/(rows.length||1)).toFixed(0)}%)`);
console.log(`  of those, knockback moved the rival away: ${neg.filter(r => r.d.split('->')[1] > r.d.split('->')[0]).length}`);
console.log(`  mean weighted pressure delta: ${(rows.reduce((a,b)=>a+b.wP,0)/(rows.length||1)).toFixed(3)}`);
console.log(`  mean weighted pressure delta, knockback cases only: ${(kb.reduce((a,b)=>a+b.wP,0)/(kb.length||1)).toFixed(3)}  (n=${kb.length})`);
console.log('  sample:');
for (const r of rows.filter(x=>x.dP<0).slice(0, 15)) console.log('   ', JSON.stringify(r));
