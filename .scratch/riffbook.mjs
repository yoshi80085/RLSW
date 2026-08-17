// Does the riffbook actually accumulate, and does a repeat drop to 1 FP?
import { matchConfig, MAX_TURNS, harnessHooks, startSpiritTurn, playTurn, POLICIES } from '../src/engine/policies/play.js';
import { makeInitialState } from '../src/engine/state.js';
import { makeRng } from '../src/engine/rng.js';
import { SKILL_BY_ID } from '../src/data/skillTree.js';
import { RIFF_LIBRARY } from '../src/music/riffLibrary.js';
const DUEL = [
  { id: 'cosmic_ronin',    name: 'Shredding Ronin', corner: 'blue',   num: 12, vibe: 5, maxVibe: 5, speed: 5, facing: 0 },
  { id: 'intergalactic_0', name: 'Intergalactic 0', corner: 'purple', num: 44, vibe: 4, maxVibe: 4, speed: 4, facing: 0 },
];
let books = [], turnsAll = [];
for (let seed = 1; seed <= 6; seed++) {
  const rng = makeRng(seed);
  let state = makeInitialState(matchConfig(DUEL, { startingLives: 2 }), seed);
  const ctx = { rng, hooks: harnessHooks({ rng }) };
  let v = { posing: {}, amps: [], shadowHex: null, rockGodActive: false, skillById: SKILL_BY_ID };
  let t = 0;
  while (!state.winner && t < MAX_TURNS && state.acting) {
    state = startSpiritTurn(state, rng);
    const r = playTurn(state, v, POLICIES.searcher({}), ctx);
    state = r.state; v = r.view; t++;
    if (r.stalled) break;
  }
  const book = v.riffBook ?? {};
  books.push(Object.keys(book).length);
  turnsAll.push(t);
  if (seed === 1) {
    console.log('seed 1 riffbook:', Object.entries(book).map(([id,who])=>`${id}→${who.slice(0,6)}`).join(', ') || '(EMPTY — the fix is not biting)');
    const fps = Object.keys(book).map(id => RIFF_LIBRARY.find(r=>r.id===id)?.fp ?? 0);
    console.log('  fp of discovered riffs:', JSON.stringify(fps), 'sum', fps.reduce((a,b)=>a+b,0));
  }
}
console.log(`\ndistinct riffs discovered per match: ${JSON.stringify(books)}  (library has ${RIFF_LIBRARY.length})`);
console.log(`match lengths (turns):               ${JSON.stringify(turnsAll)}`);
