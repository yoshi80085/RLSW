// 🔬 THE DECISION DUMP — at a stalled match's action phase, what does the
// searcher SEE? Scores every legal action the way the search does (apply it,
// evaluate the resulting position) and then prints the WEIGHTED TERM DELTAS for
// the two actions that should be the game. §6.6.10 came out of this file.
// Run: node --import ./src/engine/testAssetStub.mjs .scratch/whynofight.mjs 120 2.2
//
// ⚠️ SECOND ARG IS THE OLD `beamSetup` WEIGHT, and you need it now: on the fixed
// tree these matches END (25 turns), so there is no turn 120 to dump. Pass 2.2 to
// put the pre-§6.6.10 weight back and watch `endTurn` outscore the board again.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { legalActions } from '../src/engine/policies/legalActions.js';
import { applyBotAction } from '../src/engine/policies/transition.js';
import { evaluate, weightsFor } from '../src/engine/policies/evaluate.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
const sp = (ids, hexes, corners) => ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: corners[i], num: hexes[i],
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe,
  speed: SPIRIT_DEFS[id].speed, facing: 0, cpu: true,
}));
const S = sp(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple']);
const TARGET_TURN = Number(process.argv[2] ?? 120);
const OLD_BEAM = process.argv[3] ? Number(process.argv[3]) : null;
const VIEW = OLD_BEAM == null ? {} : { weightOverrides: { beamSetup: OLD_BEAM } };
let dumped = false;
const policies = Object.fromEntries(S.map(x => [x.id, (st, sid, v, ctx) => {
  const ns = st.noteStates?.[sid] ?? {};
  if (!dumped && ns.hasConfirmed && (st.turn?.count ?? 0) >= TARGET_TURN) {
    const opts = legalActions(st, sid, v);
    const base = evaluate(st, sid, v);
    const rows = [];
    for (const a of opts) {
      const n = ['swing','sonic','tentacle','riffOff'].includes(a.kind) ? 6 : 1;
      let tot = 0, ok = 0;
      for (let k = 0; k < n; k++) {
        const r = applyBotAction(st, a, { rng: ctx.rng.fork(`probe:${k}`), view: v, hooks: ctx.hooks });
        if (!r.ok) continue;
        const sc = evaluate(r.state, sid, r.view ?? v).score;
        if (Number.isFinite(sc)) { tot += sc; ok++; }
      }
      if (ok) rows.push({ kind: a.kind, target: a.targetId ?? a.num ?? '', score: +(tot/ok).toFixed(3) });
    }
    rows.sort((x,y)=>y.score-x.score);
    const seen = new Set(); const top = [];
    for (const r of rows) { if (seen.has(r.kind)) continue; seen.add(r.kind); top.push(r); }
    console.log(`--- turn ${st.turn?.count} seat ${sid}`);
    console.log(`    position score now ${base.score.toFixed(3)}`);
    console.log(`    best per kind: ${JSON.stringify(top)}`);
    // ⚠️ WEIGHTS FROM THE VIEW, not the shipped table — in reproduction mode the
    // match is running on the OLD weight, and reading the new one here would
    // print deltas a third of the size next to totals from the old one.
    const W = weightsFor(sid, VIEW.weightOverrides ?? null);
    for (const kind of ['riffOff','swing','endTurn']) {
      const a = opts.find(x => x.kind === kind);
      if (!a) continue;
      const r = applyBotAction(st, a, { rng: ctx.rng.fork('delta'), view: v, hooks: ctx.hooks });
      if (!r.ok) continue;
      const after = evaluate(r.state, sid, r.view ?? v);
      const d = [];
      for (const k of Object.keys(base.terms ?? {})) {
        const dv = ((after.terms?.[k] ?? 0) - (base.terms?.[k] ?? 0)) * (W[k] ?? 0);
        if (Math.abs(dv) > 0.05) d.push([k, +dv.toFixed(2)]);
      }
      d.sort((x,y)=>Math.abs(y[1])-Math.abs(x[1]));
      console.log(`    ${kind}: total ${(after.score-base.score).toFixed(2)}  weighted deltas ${JSON.stringify(d.slice(0,8))}`);
    }
    dumped = true;
  }
  return POLICIES.searcher({})(st, sid, v, ctx);
}]));
const r = runMatch({ seed: (0 * 2654435761 + 12345) >>> 0, spirits: S, policies, lives: 3, view: VIEW });
console.log(`match: winner ${r.winner ?? 'NONE'} turns ${r.turns} fame ${JSON.stringify(r.fame)}`);
