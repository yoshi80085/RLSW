// 🧠 THE JOURNAL, OVER A BENCH RUN — the same summary the in-game review panel
// draws, from headless matches. That is the point of `journalSummary` living in
// the engine: one instrument, both worlds.
// ⚠️ AUDIT IS ON HERE and it is expensive (a second sampling pass over everything
// the beam threw away). Keep the match count small, or turn it off.
// Run: node --import ./src/engine/testAssetStub.mjs .scratch/journal.mjs 3 4
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { journalSummary } from '../src/engine/policies/botJournal.js';
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
const lives = Number(process.argv[2] ?? 3);
const n = Number(process.argv[3] ?? 4);
const audit = process.argv[4] !== 'off';
const journal = [];
for (const S of PAIRS) for (let i = 0; i < n; i++) {
  const policies = Object.fromEntries(S.map(x => [x.id,
    POLICIES.searcher({ trace: e => journal.push(e), audit })]));
  runMatch({ seed: (i * 2654435761 + 12345) >>> 0, spirits: S, policies, lives });
}
const sum = journalSummary(journal);
console.log(`${journal.length} decisions over ${n * PAIRS.length} matches (audit ${audit ? 'ON' : 'off'})\n`);
for (const [id, s] of Object.entries(sum)) {
  console.log(`${id}`);
  console.log(`  decisions      ${s.decisions}  (${s.actionDecisions} action / ${s.composeDecisions} compose)`);
  console.log(`  beam           mean pruned ${s.meanPruned.toFixed(1)}, worst ${s.prunedMax}; mean priced ${s.meanConsidered.toFixed(1)}`);
  console.log(`  close calls    ${s.closeCalls}/${s.actionDecisions} (${(100*s.closeCalls/Math.max(1,s.actionDecisions)).toFixed(0)}%)`);
  console.log(`  🎯 beam cost   ${s.rankingCost}× the position, ${s.rankingCostTotal.toFixed(1)} pts total`);
  console.log(`  chosen         ${Object.entries(s.chosen).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}`).join(', ')}`);
  console.log(`  ⚠️ NEVER PLAYED ${s.neverChosen.length ? s.neverChosen.map(k=>`${k} (legal ${s.legalSeen[k]}×)`).join(', ') : '—'}`);
  console.log(`  track lengths  ${Object.entries(s.trackLengths).sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join(' ')}\n`);
}
