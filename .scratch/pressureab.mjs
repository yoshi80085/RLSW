// 🔬 §6.6.11's A/B — the `pressure` knockback bound, ONE VARIABLE.
//
// ⚠️ RUNS UNCHANGED ON BOTH TREES, the `ab68.mjs` discipline: the change is a
// FORMULA, not a weight, so `weightOverrides` cannot express it and the honest
// before/after is the same script against a HEAD checkout. Set one up with
//   mkdir -p /tmp/head && cp -r src .scratch package.json /tmp/head/ \
//     && ln -s "$PWD/node_modules" /tmp/head/node_modules \
//     && git show HEAD:src/engine/policies/evaluate.js > /tmp/head/src/engine/policies/evaluate.js
// Run: node --import ./src/engine/testAssetStub.mjs .scratch/pressureab.mjs 3 20
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
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
const n = Number(process.argv[3] ?? 20);
// ⚠️ LIVES ARE NOT ON THE MATCH RESULT — `runMatch` returns winner/turns/fame/
// limelightScores/duels and nothing else. A first cut of this probe read
// `r.lives` and reported "lives lost 0" for BOTH trees, which is the shape of a
// green test measuring nothing. Lives are counted here by watching the board
// between policy calls instead.
let dec = 0, turns = 0, fame = 0, fought = 0, lifeLoss = 0;
const acts = {};
for (const S of PAIRS) for (let i = 0; i < n; i++) {
  const seen = {};
  const policies = Object.fromEntries(S.map(x => [x.id, (st, sid, v, ctx) => {
    for (const s2 of st.spirits ?? []) {
      const l = s2.lives ?? lives;
      if (seen[s2.id] != null && l < seen[s2.id]) lifeLoss += seen[s2.id] - l;
      seen[s2.id] = l;
    }
    const p = POLICIES.searcher({})(st, sid, v, ctx);
    for (const a of (Array.isArray(p) ? p : [p])) if (['swing','sonic','riffOff','move','pose'].includes(a?.kind)) acts[a.kind] = (acts[a.kind] ?? 0) + 1;
    return p;
  }]));
  const r = runMatch({ seed: (i * 2654435761 + 12345) >>> 0, spirits: S, policies, lives });
  turns += r.turns; if (r.winner) dec++;
  fame += Object.values(r.fame ?? {}).reduce((a,b)=>a+b,0);
  fought += r.duels?.fought ?? 0;
}
const N = n * PAIRS.length;
console.log(`lives ${lives} · ${N} matches — decided ${dec}/${N} (${(100*dec/N).toFixed(0)}%)  mean turns ${Math.round(turns/N)}  FP/turn ${(fame/turns).toFixed(3)}  duels ${fought}  lives lost ${lifeLoss}  actions ${JSON.stringify(acts)}`);
