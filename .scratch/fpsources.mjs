// WHERE DOES FAME COME FROM, and how often does each source fire in the bench?
import { matchConfig, MAX_TURNS, harnessHooks, startSpiritTurn, playTurn, POLICIES } from '../src/engine/policies/play.js';
import { makeInitialState } from '../src/engine/state.js';
import { makeRng } from '../src/engine/rng.js';
import { SKILL_BY_ID } from '../src/data/skillTree.js';
import { commitMelodyEconomy } from '../src/engine/systems/melodyCommit.js';

const DUEL = [
  { id: 'cosmic_ronin',    name: 'Shredding Ronin', corner: 'blue',   num: 12, vibe: 5, maxVibe: 5, speed: 5, facing: 0 },
  { id: 'intergalactic_0', name: 'Intergalactic 0', corner: 'purple', num: 44, vibe: 4, maxVibe: 4, speed: 4, facing: 0 },
];

// Wrap the kernel to see what each commit actually pays.
let commits = 0, riffs = 0, cadences = 0, riffFp = 0, lens = {};
const realCommit = commitMelodyEconomy;

let turnsTotal = 0, matches = 0, byKO = 0, byFame = 0, unfinished = 0;
const acts = {};
for (let seed = 1; seed <= 8; seed++) {
  const rng = makeRng(seed);
  let state = makeInitialState(matchConfig(DUEL, { startingLives: 2 }), seed);
  const ctx = { rng, hooks: harnessHooks({ rng }) };
  let v = { posing: {}, amps: [], shadowHex: null, rockGodActive: false, skillById: SKILL_BY_ID };
  let t = 0;
  while (!state.winner && t < MAX_TURNS && state.acting) {
    const before = state.noteStates[state.acting]?.melodyLine?.length ?? 0;
    state = startSpiritTurn(state, rng);
    const actor = state.acting;
    const r = playTurn(state, v, POLICIES.searcher({}), ctx);
    // count the melody length at the moment of confirm
    for (const a of r.actions) {
      acts[a.kind] = (acts[a.kind] ?? 0) + 1;
      if (a.kind === 'confirmMelody') {
        commits++;
        const L = a.hexes ?? a.apGranted ?? null;
        if (L != null) lens[L] = (lens[L] ?? 0) + 1;
      }
    }
    state = r.state; v = r.view; t++;
    if (r.stalled) break;
  }
  turnsTotal += t; matches++;
  if (!state.winner) unfinished++;
  else if (state.spirits.some(s => s.lives <= 0 || s.knockedOut)) byKO++;
  else byFame++;
}
console.log(`${matches} matches, mean ${(turnsTotal/matches).toFixed(0)} turns (${(turnsTotal/matches/2).toFixed(0)} rounds)`);
console.log(`  ended by KNOCKOUT: ${byKO}   by FAME: ${byFame}   unfinished: ${unfinished}`);
console.log(`\naction counts:`);
for (const [k,n] of Object.entries(acts).sort((a,b)=>b[1]-a[1])) console.log(`  ${k.padEnd(14)} ${n}`);
console.log(`\ncommits: ${commits}`);
console.log(`melody length at confirm (apGranted proxy):`, JSON.stringify(lens));
