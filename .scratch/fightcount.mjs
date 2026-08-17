// §6.6.0 measured "688 melody notes, 508 moves, 120 commits — and ZERO attacks
// of any kind" over 120 turns of a duel. Does the bench contain fights now?
import { matchConfig, MAX_TURNS, harnessHooks, startSpiritTurn, playTurn, POLICIES } from '../src/engine/policies/play.js';
import { makeInitialState } from '../src/engine/state.js';
import { makeRng } from '../src/engine/rng.js';
import { SKILL_BY_ID } from '../src/data/skillTree.js';

const SPIRITS = [
  { id: 'cosmic_ronin',    name: 'Shredding Ronin', corner: 'blue',   num: 12, vibe: 5, maxVibe: 5, speed: 5, facing: 0 },
  { id: 'intergalactic_0', name: 'Intergalactic 0', corner: 'purple', num: 44, vibe: 4, maxVibe: 4, speed: 4, facing: 0 },
];
const tally = {};
let turns = 0, matches = 0, decided = 0, lifeLoss = 0;

for (let seed = 1; seed <= 12; seed++) {
  const rng = makeRng(seed >>> 0);
  const config = matchConfig(SPIRITS, { startingLives: 2 });
  let state = makeInitialState(config, seed >>> 0);
  const ctx = { rng, hooks: harnessHooks({ rng }) };
  let v = { posing: {}, amps: [], shadowHex: null, rockGodActive: false, skillById: SKILL_BY_ID };
  const livesAt = Object.fromEntries(state.spirits.map(s => [s.id, s.lives]));
  let t = 0;
  while (!state.winner && t < MAX_TURNS && state.acting) {
    state = startSpiritTurn(state, rng);
    const r = playTurn(state, v, POLICIES.searcher({}), ctx);
    state = r.state; v = r.view; t++;
    for (const a of r.actions) tally[a.kind] = (tally[a.kind] ?? 0) + 1;
    if (r.stalled) break;
  }
  for (const s of state.spirits) lifeLoss += Math.max(0, (livesAt[s.id] ?? 2) - (s.lives ?? 0));
  turns += t; matches++; if (state.winner) decided++;
}

console.log(`${matches} matches, ${turns} turns total (mean ${(turns/matches).toFixed(0)}), ${decided} decided, ${lifeLoss} lives taken`);
const attacks = ['swing','sonic','smash','blaster','tentacle'];
const rows = Object.entries(tally).sort((a,b)=>b[1]-a[1]);
for (const [k,n] of rows) console.log(`  ${attacks.includes(k)?'⚔️ ':'   '}${k.padEnd(14)} ${String(n).padStart(6)}   ${(n/turns).toFixed(2)} per turn`);
const atk = attacks.reduce((s,k)=>s+(tally[k]??0),0);
console.log(`\n  ⚔️  ATTACKS TOTAL: ${atk}  (${(atk/turns).toFixed(3)} per turn, ${(atk/matches).toFixed(1)} per match)`);
