// 🎓 WHAT DOES THE SEARCHER SPEND ITS DECIBILLS ON? `skillTarget` is the only
// investment action in the game, so this is the whole of the bot's build order.
import { matchConfig, MAX_TURNS, harnessHooks, startSpiritTurn, playTurn, POLICIES } from '../src/engine/policies/play.js';
import { makeInitialState } from '../src/engine/state.js';
import { makeRng } from '../src/engine/rng.js';
import { SKILL_BY_ID } from '../src/data/skillTree.js';
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
const bought = {}, seatBuys = {}, unlockedEnd = {};
let matches = 0;
for (const S of PAIRS) for (let i = 0; i < 6; i++) {
  const seed = (i * 2654435761 + 999) >>> 0;
  const rng = makeRng(seed);
  let state = makeInitialState(matchConfig(S, { startingLives: 3 }), seed);
  const ctx = { rng, hooks: harnessHooks({ rng }) };
  let v = { amps: [], shadowHex: null, rockGodActive: false, skillById: SKILL_BY_ID };
  let t = 0;
  while (!state.winner && t < MAX_TURNS && state.acting) {
    state = startSpiritTurn(state, rng);
    const who = state.acting;
    const r = playTurn(state, v, POLICIES.searcher({}), ctx);
    state = r.state; v = r.view; t++;
    for (const a of r.actions) if (a.kind === 'skillTarget') {
      bought[a.skillId] = (bought[a.skillId] ?? 0) + 1;
      seatBuys[who] = (seatBuys[who] ?? 0) + 1;
    }
    if (r.stalled) break;
  }
  for (const s of state.spirits) {
    const u = state.noteStates?.[s.id]?.unlockedSkills ?? [];
    unlockedEnd[s.id] = (unlockedEnd[s.id] ?? 0) + u.length;
  }
  matches++;
}
console.log(`${matches} matches — skillTarget picks, most-bought first:\n`);
for (const [id, n] of Object.entries(bought).sort((a,b)=>b[1]-a[1]))
  console.log(`  ${id.padEnd(20)} ${String(n).padStart(4)}×   dbCost ${SKILL_BY_ID[id]?.dbCost ?? '?'}`);
console.log(`\nmean skills actually UNLOCKED by the final whistle:`);
for (const [id, n] of Object.entries(unlockedEnd)) console.log(`  ${id.padEnd(20)} ${(n/matches).toFixed(2)}`);
console.log(`\n⚠️ a PICK is not a PURCHASE — skillTarget sets a savings goal; the Db has to arrive.`);
