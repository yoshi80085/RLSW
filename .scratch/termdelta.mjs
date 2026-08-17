// §6.6.0 reproduction with PER-TERM deltas, separating a swing that LANDS from
// one that whiffs. Sizing a weight against the wrong outcome is how you get a
// number that looks measured and is not.
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
function scenario() {
  let st = makeInitialState({ mode: 'ffa', startingLives: 2, spirits: [
    { id: A, name: 'R', corner: 'blue',   num: 45, vibe: 5, maxVibe: 5, speed: 5, facing: 0 },
    { id: B, name: 'Z', corner: 'purple', num: 44, vibe: 4, maxVibe: 4, speed: 4, facing: 0 },
  ] }, 9);
  const here = HEX_BY_NUM[45];
  const nb = axialNeighbors(here.q, here.r).map(({ q, r }) => HEX_BY_QR[`${q},${r}`]).filter(Boolean)[0];
  st = { ...st, acting: A, spirits: st.spirits.map(s =>
    s.id === B ? { ...s, num: nb.num } : (s.id === A ? { ...s, facing: angleTo(here, nb) } : s)) };
  st = applyAction(st, moveBudgetSet(5, false));
  return { ...st, noteStates: { ...st.noteStates, [A]: { ...st.noteStates[A], hasConfirmed: true } } };
}

const v = { posing: {}, amps: [], shadowHex: null, rockGodActive: false };
const st = scenario();
const base = evaluate(st, A, v);
const acts = legalActions(st, A, v);
const swing = acts.find(a => a.kind === 'swing');

function report(label, after, extra) {
  const d = after.score - base.score;
  console.log(`${label.padEnd(22)} ${after.score.toFixed(4)}  ${d >= 0 ? '+' : ''}${d.toFixed(4)}  ${extra}`);
  for (const k of Object.keys(after.terms)) {
    const dt = (after.terms[k] ?? 0) - (base.terms[k] ?? 0);
    if (Math.abs(dt) > 1e-9) {
      const c = dt * after.weights[k];
      console.log(`      ${k.padEnd(14)} ${dt >= 0 ? '+' : ''}${dt.toFixed(3)} x ${after.weights[k]}  =  ${c >= 0 ? '+' : ''}${c.toFixed(3)}`);
    }
  }
}

console.log('base score', base.score.toFixed(4), '\n');

// Walk seeds until we have seen the swing both land and whiff.
let land = null, whiff = null;
for (let s = 1; s < 400 && !(land && whiff); s++) {
  const r = applyBotAction(st, swing, { rng: makeRng(s).fork('search'), view: v, hooks: {} });
  if (!r.ok) continue;
  const tgt = r.state.spirits.find(x => x.id === B);
  const me  = r.state.spirits.find(x => x.id === A);
  const rec = { s, after: evaluate(r.state, A, v), tv: tgt.vibe, mv: me.vibe, mn: me.num, tn: tgt.num };
  if (tgt.vibe < 4) { land ??= rec; } else { whiff ??= rec; }
}
let hits = 0, n = 0;
for (let s = 1; s <= 300; s++) {
  const r = applyBotAction(st, swing, { rng: makeRng(s).fork('search'), view: v, hooks: {} });
  if (!r.ok) continue;
  n++; if (r.state.spirits.find(x => x.id === B).vibe < 4) hits++;
}
console.log(`swing hit rate over ${n} seeds: ${(100 * hits / n).toFixed(1)}%\n`);
if (land)  report('swing LANDS',  land.after,  `[rival vibe 4 -> ${land.tv}; me vibe ${land.mv}, hex ${land.mn}]`);
console.log('');
if (whiff) report('swing WHIFFS', whiff.after, `[rival vibe stays ${whiff.tv}; me vibe ${whiff.mv}, hex ${whiff.mn}]`);
