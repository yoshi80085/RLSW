// 🧭 IS THE FACING BEING THROWN AWAY? `applyMoveStep` sets
// `facing = facingAngle(from, to)` — EVERY move overwrites facing. So an AP
// spent on `face` is wasted the moment a `move` follows it in the same turn.
// The action phase is greedy over ONE PLY (`play.js` §searcherPolicy), so
// nothing in the searcher can see that a step it takes later will undo the
// turn it is paying for now.
//
// ⚠️ THIS MEASURES WASTE, NOT INTENT. A face→move pair is only waste if the
// move was not itself the payoff; both are counted here and the second column
// separates them.
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

// Group consecutive action entries into turns (turn, spiritId).
const turns = [];
let cur = null;
for (const e of journal) {
  if (e.t !== 'action') continue;
  if (!cur || cur.turn !== e.turn || cur.spiritId !== e.spiritId) {
    cur = { turn: e.turn, spiritId: e.spiritId, kinds: [] };
    turns.push(cur);
  }
  cur.kinds.push(e.chosen?.kind ?? '?');
}

const S = {};
const get = id => (S[id] ??= {
  turns: 0, faces: 0, wastedFaces: 0, keptFaces: 0,
  faceThenAttack: 0, faceLast: 0, faceStreak2: 0, apFaced: 0,
});
const ATTACK = new Set(['swing','sonic','tentacle','riffOff']);

for (const t of turns) {
  const s = get(t.spiritId); s.turns++;
  const k = t.kinds;
  for (let i = 0; i < k.length; i++) {
    if (k[i] !== 'face') continue;
    s.faces++; s.apFaced++;
    // Does a move come later in this same turn? If so the facing is overwritten.
    const laterMove = k.slice(i + 1).includes('move');
    if (laterMove) s.wastedFaces++; else s.keptFaces++;
    // What did it buy, if anything?
    const rest = k.slice(i + 1);
    const nextReal = rest.find(x => x !== 'face');
    if (ATTACK.has(nextReal)) s.faceThenAttack++;
    if (i === k.length - 1 || k.slice(i + 1).every(x => x === 'endTurn')) s.faceLast++;
    if (k[i + 1] === 'face') s.faceStreak2++;
  }
}

console.log(`${PAIRS.length * n} matches, searcher every seat, 3 lives — ${turns.length} turns, ${journal.filter(e=>e.t==='action').length} action decisions\n`);
const pad = (x, w) => String(x).padStart(w);
console.log('spirit                faces   overwritten by a later move   still facing at end   bought an attack   double-faced');
for (const [id, s] of Object.entries(S)) {
  const pc = x => s.faces ? `${(100*x/s.faces).toFixed(1)}%` : '—';
  console.log(
    `${id.padEnd(20)} ${pad(s.faces,6)}   ${pad(s.wastedFaces,6)} (${pc(s.wastedFaces).padStart(6)})` +
    `          ${pad(s.faceLast,5)} (${pc(s.faceLast).padStart(6)})` +
    `      ${pad(s.faceThenAttack,5)} (${pc(s.faceThenAttack).padStart(6)})` +
    `   ${pad(s.faceStreak2,5)} (${pc(s.faceStreak2).padStart(6)})`);
}
const tot = Object.values(S).reduce((a,s)=>({f:a.f+s.faces,w:a.w+s.wastedFaces,t:a.t+s.turns}),{f:0,w:0,t:0});
console.log(`\nTOTAL  ${tot.f} faces over ${tot.t} turns (${(tot.f/tot.t).toFixed(2)} per turn) — ${tot.w} overwritten (${(100*tot.w/tot.f).toFixed(1)}%), i.e. ${tot.w} AP burned for nothing.`);
