// 🧭 WHY does it spin? Hypothesis: `legalActions` excludes the CURRENT facing
// ("already looking there"), so "stay as I am" is not on the face menu. A
// one-ply greedy pick therefore compares only the five facings it is NOT in.
// If facing A outscores B and B outscores everything else, then from A it takes
// B and from B it takes A — forever, until the AP runs out. Nothing about the
// position changes in between except the AP it is burning.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
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
for (const S of PAIRS) for (let i = 0; i < n; i++) {
  const policies = Object.fromEntries(S.map(x => [x.id,
    POLICIES.searcher({ trace: e => journal.push(e), audit: false })]));
  runMatch({ seed: (i*2654435761+12345)>>>0, spirits: S, policies, lives: 3 });
}
const turns = []; let cur = null;
for (const e of journal) {
  if (e.t !== 'action') continue;
  if (!cur || cur.turn !== e.turn || cur.spiritId !== e.spiritId) { cur = { turn: e.turn, spiritId: e.spiritId, id: e.spiritId, es: [] }; turns.push(cur); }
  cur.es.push(e);
}
let runs = 0, pureAB = 0, endedOnEndTurn = 0, couldHaveStopped = 0, sample = null;
const lenByEnd = {};
for (const t of turns) {
  for (let i = 0; i < t.es.length; ) {
    if (t.es[i].chosen?.kind !== 'face') { i++; continue; }
    let j = i; while (j < t.es.length && t.es[j].chosen?.kind === 'face') j++;
    const run = t.es.slice(i, j);
    if (run.length >= 2) {
      runs++;
      const keys = run.map(e => e.chosen.key);
      const uniq = [...new Set(keys)];
      if (uniq.length === 2 && keys.every((k, x) => k === uniq[x % 2])) pureAB++;
      // Could it have stopped? Was endTurn legal on every step of the spin?
      if (run.every(e => (e.legalKinds ?? []).includes('endTurn'))) couldHaveStopped++;
      const after = t.es[j];
      const endK = after ? after.chosen?.kind : 'AP EXHAUSTED / turn over';
      lenByEnd[endK] = (lenByEnd[endK] ?? 0) + 1;
      if (!sample && run.length >= 4) sample = { id: t.id, run };
    }
    i = j;
  }
}
console.log(`${runs} multi-face spins in the sample`);
console.log(`   ${pureAB} (${(100*pureAB/runs).toFixed(1)}%) are a PERFECT A→B→A→B oscillation between exactly two facings`);
console.log(`   ${couldHaveStopped} (${(100*couldHaveStopped/runs).toFixed(1)}%) had \`endTurn\` legal on every single step — it chose to keep spinning\n`);
console.log('what the spin ran into:');
for (const [k, v] of Object.entries(lenByEnd).sort((a,b)=>b[1]-a[1])) console.log(`   ${String(v).padStart(4)}  ${k}`);
if (sample) {
  console.log(`\nONE SPIN, ${sample.id}, scores as the searcher saw them:`);
  for (const e of sample.run) {
    const top = (e.considered ?? []).slice(0, 3).map(c => `${c.kind}${c.key?`/${c.key}`:''} ${c.score.toFixed(3)}`).join('   |   ');
    console.log(`   took ${String(e.chosen.key).padEnd(6)} score ${e.score.toFixed(3)}   top3: ${top}`);
  }
}
