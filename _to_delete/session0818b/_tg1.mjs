// 🔬 THE TWO-GATE BENCH §6.6 asked for: a win rate AND a maximum inconclusive
// rate, reported together, because §6.6's own A/B showed the first rises with the
// second. Run: node --import ./src/engine/testAssetStub.mjs .scratch/twogate.mjs 60 3
import { runBench } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
const sp = (ids, hexes, corners) => ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: corners[i], num: hexes[i],
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe,
  speed: SPIRIT_DEFS[id].speed, facing: 0, cpu: true,
}));
const S = sp(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple']);
const n = Number(process.argv[2] ?? 60);
const lives = Number(process.argv[3] ?? 3);
const seeds = Array.from({ length: n }, (_, i) => (i * 2654435761 + 12345) >>> 0);
for (const bs of [null]) {
  const view = bs == null ? {} : { weightOverrides: { beamSetup: bs } };
  const r = runBench({ seeds, spirits: S, a: 'searcher', b: 'unranked', view, lives });
  const drawInc = (r.wins.searcher + r.inconclusive / 2) / seeds.length;
  const se = Math.sqrt(r.rate * (1 - r.rate) / Math.max(1, r.decided)) * 1.96 * 100;
  console.log(`beamSetup ${bs ?? 'SHIPPED'} — searcher ${r.wins.searcher}/${r.decided} = ${(100*r.rate).toFixed(1)}% ±${se.toFixed(1)}  ·  inconclusive ${r.inconclusive}/${seeds.length} (${(100*r.inconclusive/seeds.length).toFixed(0)}%)  ·  draw-inclusive ${(100*drawInc).toFixed(1)}%`);
}
