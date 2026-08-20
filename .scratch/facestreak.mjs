// 🧭 HOW LONG DOES IT SPIN? `facingOptions` returns ALL SIX neighbour angles, so
// ANY facing is reachable in ONE `face` action at a flat 1 AP — rotation
// distance is not priced. Two `face` actions back to back are therefore
// STRICTLY dominated: the second facing was available to the first, for half
// the AP, and nothing happened in between to change which facings were legal.
//
// ⚠️ THIS IS A DOMINANCE ARGUMENT, NOT A TASTE ONE. It does not need a weight
// table to adjudicate it. A run of N consecutive faces wastes N-1 AP outright.
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
  runMatch({ seed: (i * 2654435761 + 12345) >>> 0, spirits: S, policies, lives: 3 });
}
const turns = []; let cur = null;
for (const e of journal) {
  if (e.t !== 'action') continue;
  if (!cur || cur.turn !== e.turn || cur.spiritId !== e.spiritId) {
    cur = { turn: e.turn, spiritId: e.spiritId, kinds: [], keys: [] }; turns.push(cur);
  }
  cur.kinds.push(e.chosen?.kind ?? '?'); cur.keys.push(e.chosen?.key ?? '');
}
const S = {};
const get = id => (S[id] ??= { turns: 0, actions: 0, faces: 0, streaks: {}, wasted: 0, revisit: 0 });
for (const t of turns) {
  const s = get(t.spiritId); s.turns++; s.actions += t.kinds.length;
  for (let i = 0; i < t.kinds.length; ) {
    if (t.kinds[i] !== 'face') { i++; continue; }
    let j = i; const seen = [];
    while (j < t.kinds.length && t.kinds[j] === 'face') { seen.push(t.keys[j]); j++; }
    const len = j - i;
    s.faces += len;
    s.streaks[len] = (s.streaks[len] ?? 0) + 1;
    s.wasted += len - 1;                       // every face but the last is dominated
    if (new Set(seen).size < seen.length) s.revisit++;   // turned back to a facing it already had
    i = j;
  }
}
console.log(`${PAIRS.length*n} matches, ${turns.length} turns, ${Object.values(S).reduce((a,s)=>a+s.actions,0)} action decisions\n`);
for (const [id, s] of Object.entries(S)) {
  const lens = Object.keys(s.streaks).map(Number).sort((a,b)=>a-b);
  const runs = lens.reduce((a,l)=>a+s.streaks[l],0);
  console.log(`${id}`);
  console.log(`   ${s.faces} face actions = ${(100*s.faces/s.actions).toFixed(1)}% of ALL its AP spends, over ${runs} separate spins`);
  console.log(`   run length:  ${lens.map(l=>`${l}×${s.streaks[l]}`).join('  ')}   (longest ${Math.max(...lens)})`);
  console.log(`   ⚠️ ${s.wasted} AP strictly dominated (${(100*s.wasted/s.faces).toFixed(1)}% of every face it ever paid for)`);
  console.log(`   ${s.revisit} spins turned back to a facing it had already held inside the same run\n`);
}
const T = Object.values(S).reduce((a,s)=>({f:a.f+s.faces,w:a.w+s.wasted,a:a.a+s.actions}),{f:0,w:0,a:0});
console.log(`TOTAL — face is ${(100*T.f/T.a).toFixed(1)}% of every action taken in the sample.`);
console.log(`        ${T.w} of ${T.f} face-AP is provably wasted (${(100*T.w/T.f).toFixed(1)}%) = ${(100*T.w/T.a).toFixed(1)}% of the bots' ENTIRE AP budget, spinning on the spot.`);
