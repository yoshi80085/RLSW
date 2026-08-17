// WHY DO BENCH MATCHES RUN 100+ ROUNDS WHEN A PLAYED GAME ENDS IN 15-20?
// Track Fame per turn, its sources, and the crowd, against the target.
import { matchConfig, MAX_TURNS, harnessHooks, startSpiritTurn, playTurn, POLICIES } from '../src/engine/policies/play.js';
import { makeInitialState } from '../src/engine/state.js';
import { makeRng } from '../src/engine/rng.js';
import { SKILL_BY_ID } from '../src/data/skillTree.js';
import { fameToWin } from '../src/engine/policies/evaluate.js';
import { FAME_PER_TURN_CAP, fpPerLife } from '../src/data/gameConstants.js';

const DUEL = [
  { id: 'cosmic_ronin',    name: 'Shredding Ronin', corner: 'blue',   num: 12, vibe: 5, maxVibe: 5, speed: 5, facing: 0 },
  { id: 'intergalactic_0', name: 'Intergalactic 0', corner: 'purple', num: 44, vibe: 4, maxVibe: 4, speed: 4, facing: 0 },
];

const rng = makeRng(7);
let state = makeInitialState(matchConfig(DUEL, { startingLives: 2 }), 7);
const ctx = { rng, hooks: harnessHooks({ rng }) };
let v = { posing: {}, amps: [], shadowHex: null, rockGodActive: false, skillById: SKILL_BY_ID };

const target = fameToWin(state);
console.log(`players 2, lives 2 → fpPerLife ${fpPerLife(2)}, fameToWin ${target} FP`);
console.log(`FAME_PER_TURN_CAP ${FAME_PER_TURN_CAP} → theoretical floor ${Math.ceil(target/FAME_PER_TURN_CAP)} turns per Spirit\n`);

const snap = () => Object.fromEntries(state.spirits.map(s => {
  const ns = state.noteStates[s.id] ?? {};
  return [s.id, { fame: ns.fame ?? 0, diehards: ns.diehards ?? 0, casuals: ns.casuals ?? 0, perf: ns.perfScore ?? 0, db: ns.totalDB ?? 0 }];
}));

let prev = snap();
let t = 0;
const marks = [1,2,3,5,10,20,30,40,60,80,120,160,200,260,320,400];
while (!state.winner && t < MAX_TURNS && state.acting) {
  state = startSpiritTurn(state, rng);
  const r = playTurn(state, v, POLICIES.searcher({}), ctx);
  state = r.state; v = r.view; t++;
  if (r.stalled) { console.log('STALLED at turn', t); break; }
  if (marks.includes(t)) {
    const now = snap();
    const line = state.spirits.map(s => {
      const a = now[s.id], b = prev[s.id];
      return `${s.id.slice(0,6)} FP ${String(a.fame).padStart(3)} (+${a.fame-b.fame}) fans ${a.diehards}D/${a.casuals}C`;
    }).join('   ');
    console.log(`turn ${String(t).padStart(3)} (round ${String(Math.ceil(t/2)).padStart(3)})  ${line}`);
    prev = now;
  }
}
const f = snap();
console.log(`\nended at turn ${t} (round ${Math.ceil(t/2)}), winner: ${state.winner ?? 'NONE'}`);
for (const s of state.spirits) console.log(`  ${s.id}: ${f[s.id].fame}/${target} FP, ${f[s.id].diehards}D/${f[s.id].casuals}C fans, lives ${s.lives}, totalDB ${f[s.id].db}`);
const totalFame = state.spirits.reduce((n,s)=>n+f[s.id].fame,0);
console.log(`\n  Fame earned across BOTH seats: ${totalFame} over ${t} turns = ${(totalFame/t).toFixed(3)} FP per turn`);
console.log(`  the per-turn CAP is ${FAME_PER_TURN_CAP}, so the bot runs at ${(100*totalFame/t/FAME_PER_TURN_CAP).toFixed(1)}% of the ceiling`);
