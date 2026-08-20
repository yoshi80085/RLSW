// 💰 WHERE DOES EVERY FAME POINT ACTUALLY COME FROM, and what did it cost?
//
// ⚠️ THIS DUPLICATES `playTurn`'s INNER LOOP ON PURPOSE. `playTurn` reports
// `actions` and a duel ledger, and Fame moves INSIDE `applyBotAction` — so the
// only way to attribute a point to the action that earned it is to measure the
// board either side of each action. Kept deliberately thin: no beam, no audit,
// same policy, same hooks. If `playTurn`'s loop changes, this drifts — the
// header is the warning.
import { matchConfig, MAX_TURNS, harnessHooks, startSpiritTurn, POLICIES } from '../src/engine/policies/play.js';
import { applyBotAction } from '../src/engine/policies/transition.js';
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
const N = Number(process.argv[2] ?? 8);

const fpBy = {}, count = {}, vibeLostAfter = {};
const turnFp = [];   // every per-turn FP window that paid anything at all
let turns = 0, matches = 0, decided = 0, totalFp = 0;
const totalFame = (st) => (st.spirits ?? []).reduce((s, x) => s + (st.noteStates?.[x.id]?.fame ?? 0), 0);
const totalVibe = (st) => (st.spirits ?? []).reduce((s, x) => s + (x.vibe ?? 0) + 10 * (x.lives ?? 0), 0);

for (const SPIRITS of PAIRS) for (let i = 0; i < N; i++) {
  const seed = (i * 2654435761 + 999) >>> 0;
  const rng = makeRng(seed);
  let state = makeInitialState(matchConfig(SPIRITS, { startingLives: 3 }), seed);
  const ctx = { rng, hooks: harnessHooks({ rng }) };
  let v = { amps: [], shadowHex: null, rockGodActive: false, skillById: SKILL_BY_ID };
  const policy = POLICIES.searcher({});
  let t = 0;
  while (!state.winner && t < MAX_TURNS && state.acting) {
    state = startSpiritTurn(state, rng);
    const spiritId = state.acting;
    let cur = state;
    v = { ...v, fameThisTurn: {} };
    let guard = 0, ended = false;
    while (!ended && guard++ < 60) {
      const answer = policy(cur, spiritId, v, ctx) ?? { kind: 'endTurn', apCost: 0 };
      for (const a of (Array.isArray(answer) ? answer : [answer])) {
        const fpBefore = totalFame(cur), vBefore = totalVibe(cur);
        const r = applyBotAction(cur, a, { rng, view: v, hooks: ctx.hooks });
        if (!r.ok) { ended = true; break; }
        cur = r.state; v = r.view ?? v;
        const d = totalFame(cur) - fpBefore;
        count[a.kind] = (count[a.kind] ?? 0) + 1;
        if (d) fpBy[a.kind] = (fpBy[a.kind] ?? 0) + d;
        const vd = vBefore - totalVibe(cur);
        if (vd) vibeLostAfter[a.kind] = (vibeLostAfter[a.kind] ?? 0) + vd;
        if (a.kind === 'endTurn' || cur.winner) { ended = true; break; }
      }
    }
    // one turn window closed — what did the acting Spirit bank in it?
    const banked = (cur.noteStates?.[spiritId]?.fame ?? 0) - (state.noteStates?.[spiritId]?.fame ?? 0);
    if (banked > 0) turnFp.push(banked);
    state = cur; t++;
  }
  turns += t; matches++; if (state.winner) decided++;
  totalFp += totalFame(state);
}

console.log(`${matches} matches, 3 lives, searcher both seats — ${decided} decided, mean ${(turns/matches).toFixed(0)} turns`);
console.log(`${totalFp} Fame Points banked in total (${(totalFp/turns).toFixed(3)} per turn)\n`);
console.log(`  ${'action'.padEnd(14)} ${'taken'.padStart(7)} ${'FP earned'.padStart(10)} ${'FP/use'.padStart(7)} ${'% of all FP'.padStart(11)}`);
for (const [k, fp] of Object.entries(fpBy).sort((a, b) => b[1] - a[1])) {
  const n = count[k] ?? 0;
  console.log(`  ${k.padEnd(14)} ${String(n).padStart(7)} ${String(fp).padStart(10)} ${(fp/Math.max(1,n)).toFixed(2).padStart(7)} ${((100*fp)/totalFp).toFixed(1).padStart(10)}%`);
}
// 💥 WHAT EACH ACTION COST THE TABLE IN VIBE (positive = Vibe/lives came off
// the board on that action, either seat).
console.log(`\n  💥 Vibe+lives removed from the board, by the action that did it:`);
for (const [k, d] of Object.entries(vibeLostAfter).sort((a,b)=>b[1]-a[1]))
  console.log(`     ${k.padEnd(14)} ${String(d).padStart(6)}  (${(d/Math.max(1,count[k]??1)).toFixed(2)} per use)`);

// 🎤 WHAT THE CLIENT'S CEILING WOULD THROW AWAY. The engine banks a duel against
// RIFF_FP_TURN_CAP (8); the shipped client's `grantFame` has no `cap` argument at
// all and clips everything at FAME_PER_TURN_CAP (4). ⚠️ AN UPPER BOUND, NOT A
// MEASUREMENT: these totals were already clipped at 8 inside the engine, so
// re-clipping at 4 shows what the SECOND ceiling would take off what survived
// the first.
const kept = turnFp.reduce((s, x) => s + Math.min(4, x), 0);
const raw  = turnFp.reduce((s, x) => s + x, 0);
console.log(`\n  🎤 per-turn FP windows: ${turnFp.length} that paid anything, ${raw} FP banked at the engine's ceiling`);
console.log(`     re-clipped at the client's flat 4/turn: ${kept} FP — ${(100*(raw-kept)/Math.max(1,raw)).toFixed(0)}% of all Fame discarded`);
console.log(`     windows over 4 FP: ${turnFp.filter(x=>x>4).length}/${turnFp.length}, biggest ${Math.max(...turnFp)}`);

console.log(`\n  ⚔️ actions that were taken and earned NOTHING:`);
for (const [k, n] of Object.entries(count).sort((a,b)=>b[1]-a[1])) if (!fpBy[k]) console.log(`     ${k.padEnd(14)} ${n}×`);
