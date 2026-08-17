// The bot fires ZERO Sonics. Never LEGAL, cut by the BEAM, or OUTSCORED?
// Probe in the ACTION phase — at turn start nobody has confirmed, so no attack
// is legal and the question cannot be asked yet.
import { matchConfig, MAX_TURNS, harnessHooks, startSpiritTurn, playTurn, POLICIES } from '../src/engine/policies/play.js';
import { makeInitialState } from '../src/engine/state.js';
import { makeRng } from '../src/engine/rng.js';
import { SKILL_BY_ID } from '../src/data/skillTree.js';
import { legalActions } from '../src/engine/policies/legalActions.js';
import { applyBotAction } from '../src/engine/policies/transition.js';

const DUEL = [
  { id: 'cosmic_ronin',    name: 'Shredding Ronin', corner: 'blue',   num: 12, vibe: 5, maxVibe: 5, speed: 5, facing: 0 },
  { id: 'intergalactic_0', name: 'Intergalactic 0', corner: 'purple', num: 44, vibe: 4, maxVibe: 4, speed: 4, facing: 0 },
];
let turns = 0, actionPhaseSteps = 0, sonicOffered = 0, swingOffered = 0, sonicSteps = 0, swingSteps = 0;
let minDist = 99; const distHist = {};
for (let seed = 1; seed <= 4; seed++) {
  const rng = makeRng(seed);
  let state = makeInitialState(matchConfig(DUEL, { startingLives: 2 }), seed);
  const ctx = { rng, hooks: harnessHooks({ rng }) };
  let v = { posing: {}, amps: [], shadowHex: null, rockGodActive: false, skillById: SKILL_BY_ID };
  let t = 0;
  while (!state.winner && t < MAX_TURNS && state.acting) {
    state = startSpiritTurn(state, rng);
    const actor = state.acting;
    const r = playTurn(state, v, POLICIES.searcher({}), ctx);
    // replay this turn, checking legality at every step
    let cur = state, cv = v;
    for (const a of r.actions) {
      const opts = legalActions(cur, actor, cv);
      const ns = cur.noteStates?.[actor] ?? {};
      if (ns.hasConfirmed) {
        actionPhaseSteps++;
        const so = opts.filter(o => o.kind === 'sonic').length;
        const sw = opts.filter(o => o.kind === 'swing').length;
        sonicOffered += so; swingOffered += sw;
        if (so) sonicSteps++;
        if (sw) swingSteps++;
      }
      const rr = applyBotAction(cur, a, { rng: ctx.rng, view: cv, hooks: ctx.hooks });
      if (!rr.ok) break;
      cur = rr.state; cv = rr.view ?? cv;
    }
    // how far apart do the two Spirits actually stand?
    const [p, q] = state.spirits;
    const HX = (await import('../src/board/hexMap.js')).HEX_BY_NUM;
    const { axialDist } = await import('../src/board/hexGeometry.js');
    const a1 = HX[p.num], a2 = HX[q.num];
    if (a1 && a2) { const d = axialDist(a1.q, a1.r, a2.q, a2.r); distHist[d] = (distHist[d] ?? 0) + 1; if (d < minDist) minDist = d; }
    state = r.state; v = r.view; t++;
    if (r.stalled) break;
  }
  turns += t;
}
console.log(`${turns} turns, ${actionPhaseSteps} action-phase decision points`);
console.log(`  steps where a SONIC was on the menu: ${sonicSteps}  (${(100*sonicSteps/actionPhaseSteps).toFixed(1)}%)   total offered: ${sonicOffered}`);
console.log(`  steps where a SWING was on the menu: ${swingSteps}  (${(100*swingSteps/actionPhaseSteps).toFixed(1)}%)   total offered: ${swingOffered}`);
console.log(`\n  distance between the two Spirits at turn start (Sonic beam reaches 3):`);
for (const d of Object.keys(distHist).map(Number).sort((a,b)=>a-b)) console.log(`    dist ${String(d).padStart(2)}: ${distHist[d]} turns`);
