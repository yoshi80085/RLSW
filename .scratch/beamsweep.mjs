// 🔬 §6.6.10's SWEEP — one variable, through the bench's own instrument
// (`weightOverrides`), so no code edit is needed to re-run it.
// Run: node --import ./src/engine/testAssetStub.mjs .scratch/beamsweep.mjs 3 15
//      (args: startingLives, matches per pair)
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
const n = Number(process.argv[3] ?? 15);
for (const bs of [null, 2.2, 1.2, 0.3]) {
  const view = bs == null ? {} : { weightOverrides: { beamSetup: bs } };
  let dec = 0, turns = 0, fame = 0; const D = { fought: 0 }; const acts = {};
  for (const s of PAIRS) for (let i = 0; i < n; i++) {
    const policies = Object.fromEntries(s.map(x => [x.id, (st, sid, v, ctx) => {
      const p = POLICIES.searcher({})(st, sid, v, ctx);
      for (const a of (Array.isArray(p) ? p : [p])) if (['swing','sonic','riffOff','move'].includes(a?.kind)) acts[a.kind] = (acts[a.kind] ?? 0) + 1;
      return p;
    }]));
    const r = runMatch({ seed: (i * 2654435761 + 12345) >>> 0, spirits: s, policies, lives, view });
    turns += r.turns; if (r.winner) dec++;
    fame += Object.values(r.fame ?? {}).reduce((a,b)=>a+b,0);
    D.fought += r.duels?.fought ?? 0;
  }
  const N = n * PAIRS.length;
  console.log(`beamSetup ${bs ?? 'SHIPPED COLUMN'} — decided ${dec}/${N} (${(100*dec/N).toFixed(0)}%)  mean turns ${Math.round(turns/N)}  FP/turn ${(fame/turns).toFixed(3)}  duels ${D.fought}  actions ${JSON.stringify(acts)}`);
  for (const k of Object.keys(acts)) delete acts[k];
}
