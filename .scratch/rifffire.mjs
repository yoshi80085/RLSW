// Does the searcher EVER discover a riff? Riffs pay 2-5 FP against a 16 FP
// target, and the bot commits 1400 melodies a match-set. Logs carry the tell.
import { matchConfig, MAX_TURNS, harnessHooks, startSpiritTurn, playTurn, POLICIES } from '../src/engine/policies/play.js';
import { makeInitialState } from '../src/engine/state.js';
import { makeRng } from '../src/engine/rng.js';
import { SKILL_BY_ID } from '../src/data/skillTree.js';
import { detectRiff } from '../src/music/riffLibrary.js';
import { RIFF_LIBRARY } from '../src/music/riffLibrary.js';

const DUEL = [
  { id: 'cosmic_ronin',    name: 'Shredding Ronin', corner: 'blue',   num: 12, vibe: 5, maxVibe: 5, speed: 5, facing: 0 },
  { id: 'intergalactic_0', name: 'Intergalactic 0', corner: 'purple', num: 44, vibe: 4, maxVibe: 4, speed: 4, facing: 0 },
];
let riffLogs = 0, cadenceLogs = 0, fameLogs = 0, commits = 0, turns = 0;
const fameReasons = {};
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
    for (const a of r.actions) if (a.kind === 'confirmMelody') commits++;
    for (const L of (r.logs ?? [])) {
      const s = String(L?.text ?? L ?? '');
      if (s.includes('🎼')) riffLogs++;
      if (s.includes('🎯')) cadenceLogs++;
      if (s.includes('⭐')) { fameLogs++; const m = s.match(/\((.*?)\)/); if (m) fameReasons[m[1]] = (fameReasons[m[1]] ?? 0) + 1; }
    }
    if (r.stalled) break;
  }
  turns += t;
}
console.log(`6 matches, ${turns} turns, ${commits} melody commits`);
console.log(`  🎼 riff log lines:    ${riffLogs}`);
console.log(`  🎯 cadence log lines: ${cadenceLogs}`);
console.log(`  ⭐ fame log lines:    ${fameLogs}`);
console.log(`  fame reasons:`, JSON.stringify(fameReasons));
console.log(`\nriff library: ${RIFF_LIBRARY.length} riffs, trigger length ${[...new Set(RIFF_LIBRARY.map(r=>r.triggerLen))].join('/')}, worth ${Math.min(...RIFF_LIBRARY.map(r=>r.fp))}-${Math.max(...RIFF_LIBRARY.map(r=>r.fp))} FP each`);
