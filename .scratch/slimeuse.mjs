// 🧪 IS THE OOZE DOING ANYTHING? Legal-vs-chosen for the Metalness kit, and the
// win rate of the seat that owns it. ⚠️ This measures USE, not VALUE: nothing
// here says the trail paid, only that it was laid. See the note at the end.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { journalSummary } from '../src/engine/policies/botJournal.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
const sp = (ids, hexes, corners) => ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: corners[i], num: hexes[i],
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe,
  speed: SPIRIT_DEFS[id].speed, facing: 0, cpu: true,
}));
const PAIRS = [
  sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']),
  sp(['Metalness_Monster','intergalactic_0'],[12,44],['yellow','purple']),
  sp(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple']),
];
const n = Number(process.argv[2] ?? 8);
const journal = [];
const wins = {}, seats = {}, turnsAll = [];
for (const S of PAIRS) for (let i = 0; i < n; i++) {
  const policies = Object.fromEntries(S.map(x => [x.id,
    POLICIES.searcher({ trace: e => journal.push(e), audit: false })]));
  const r = runMatch({ seed: (i * 2654435761 + 12345) >>> 0, spirits: S, policies, lives: 3 });
  for (const x of S) seats[x.id] = (seats[x.id] ?? 0) + 1;
  if (r.winner) wins[r.winner] = (wins[r.winner] ?? 0) + 1;
  turnsAll.push(r.turns);
}
const sum = journalSummary(journal);
const KIT = ['slime','slide','tentacle','eleven','swing','sonic','riffOff','pose','face','move'];
console.log(`${PAIRS.length * n} matches, searcher every seat, 3 lives`);
console.log(`decided ${Object.values(wins).reduce((a,b)=>a+b,0)}/${PAIRS.length*n}, mean turns ${(turnsAll.reduce((a,b)=>a+b,0)/turnsAll.length).toFixed(1)}\n`);
for (const [id, s] of Object.entries(sum)) {
  console.log(`${id}  — won ${wins[id] ?? 0}/${seats[id] ?? 0}, ${s.actionDecisions} action decisions`);
  for (const k of KIT) {
    const legal = s.legalSeen?.[k] ?? 0, took = s.chosen?.[k] ?? 0;
    if (!legal && !took) continue;
    const pct = legal ? (100 * took / legal).toFixed(1) : '—';
    console.log(`   ${took === 0 && legal > 0 ? '⚠️ ' : '   '}${k.padEnd(10)} legal ${String(legal).padStart(5)}×   chosen ${String(took).padStart(4)}×   (${pct}% of the times it was offered)`);
  }
  console.log('');
}
