// How does the Swing's expected value move with the Drive stack, and with how
// hurt the rival already is? §6.6.0 sized the problem from ONE sample.
import { legalActions } from '../src/engine/policies/legalActions.js';
import { applyBotAction } from '../src/engine/policies/transition.js';
import { evaluate } from '../src/engine/policies/evaluate.js';
import { makeInitialState } from '../src/engine/state.js';
import { makeRng } from '../src/engine/rng.js';
import { moveBudgetSet } from '../src/engine/actions.js';
import { applyAction } from '../src/engine/reduce.js';
import { HEX_BY_NUM, HEX_BY_QR } from '../src/board/hexMap.js';
import { axialNeighbors, angleTo } from '../src/board/hexGeometry.js';

const A = 'cosmic_ronin', B = 'intergalactic_0';
const NOTES = ['Eb','Bb','G','D','Ab','C','F','Bb','Eb','G'];

function scenario(driveN, rivalVibe = 4) {
  let st = makeInitialState({ mode: 'ffa', startingLives: 2, spirits: [
    { id: A, name: 'R', corner: 'blue',   num: 45, vibe: 5, maxVibe: 5, speed: 5, facing: 0 },
    { id: B, name: 'Z', corner: 'purple', num: 44, vibe: 4, maxVibe: 4, speed: 4, facing: 0 },
  ] }, 9);
  const here = HEX_BY_NUM[45];
  const nb = axialNeighbors(here.q, here.r).map(({ q, r }) => HEX_BY_QR[`${q},${r}`]).filter(Boolean)[0];
  st = { ...st, acting: A, spirits: st.spirits.map(s =>
    s.id === B ? { ...s, num: nb.num, vibe: rivalVibe } : (s.id === A ? { ...s, facing: angleTo(here, nb) } : s)) };
  st = applyAction(st, moveBudgetSet(5, false));
  return { ...st, noteStates: { ...st.noteStates,
    [A]: { ...st.noteStates[A], hasConfirmed: true, driveStack: NOTES.slice(0, driveN) } } };
}

const v = { posing: {}, amps: [], shadowHex: null, rockGodActive: false };

function sweep(rivalVibe) {
  console.log(`\n=== rival starts at ${rivalVibe}/4 Vibe ===`);
  console.log('driveN | hit%  | E[Δscore] | E[Δfame]  E[Δsurv]  E[Δdrive] | E[Δrival vibe]');
  for (const dn of [1, 2, 3, 4, 6, 8]) {
    const st = scenario(dn, rivalVibe);
    const base = evaluate(st, A, v);
    const swing = legalActions(st, A, v).find(a => a.kind === 'swing');
    if (!swing) { console.log(`${String(dn).padStart(6)} | no legal swing`); continue; }
    let n = 0, hits = 0, dScore = 0, dFame = 0, dSurv = 0, dDrive = 0, dRv = 0, kos = 0;
    for (let s = 1; s <= 400; s++) {
      const r = applyBotAction(st, swing, { rng: makeRng(s).fork('search'), view: v, hooks: {} });
      if (!r.ok) continue;
      const after = evaluate(r.state, A, v);
      const t = r.state.spirits.find(x => x.id === B);
      n++; if (t.vibe < rivalVibe || t.knockedOut || (t.lives ?? 2) < 2) hits++;
      if (t.knockedOut) kos++;
      dScore += after.score - base.score;
      dFame  += (after.terms.fame ?? 0) - (base.terms.fame ?? 0);
      dSurv  += (after.terms.survival ?? 0) - (base.terms.survival ?? 0);
      dDrive += (after.terms.drive ?? 0) - (base.terms.drive ?? 0);
      dRv    += rivalVibe - t.vibe;
    }
    console.log(`${String(dn).padStart(6)} | ${(100*hits/n).toFixed(1).padStart(5)} | ` +
      `${(dScore/n>=0?'+':'')}${(dScore/n).toFixed(4).padStart(8)} | ` +
      `${(dFame/n>=0?'+':'')}${(dFame/n).toFixed(4).padStart(7)}  ` +
      `${(dSurv/n>=0?'+':'')}${(dSurv/n).toFixed(4).padStart(7)}  ` +
      `${(dDrive/n>=0?'+':'')}${(dDrive/n).toFixed(4).padStart(7)} | ${(dRv/n).toFixed(3)}${kos?`  (${kos} KO)`:''}`);
  }
}
sweep(4);
sweep(1);

console.log('\n=== the alternatives, drive stack 4, rival at 4/4 ===');
{
  const st = scenario(4, 4);
  const base = evaluate(st, A, v);
  console.log('base', base.score.toFixed(4));
  const seen = new Set();
  for (const a of legalActions(st, A, v)) {
    if (seen.has(a.kind)) continue; seen.add(a.kind);
    let n = 0, tot = 0;
    for (let s = 1; s <= 200; s++) {
      const r = applyBotAction(st, a, { rng: makeRng(s).fork('search'), view: v, hooks: {} });
      if (!r.ok) continue;
      n++; tot += evaluate(r.state, A, v).score - base.score;
    }
    if (n) console.log(`  ${a.kind.padEnd(12)} E[Δ] ${tot/n>=0?'+':''}${(tot/n).toFixed(4)}`);
  }
}
