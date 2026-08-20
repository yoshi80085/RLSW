// 🥁 DOES THE SEARCHER EVER COMMIT TO A STACK — and when?
//
// ⚠️ THE COLUMN THAT MATTERS IS "both kinds legal → step [0]". `composePhase`
// extends its line with `beamActions(steps, { limit: 1, … })[0]`, and
// `beamActions` groups BY KIND and emits the groups in first-appearance order.
// `legalActions` pushes every `melodyNote` before every `stackCommit`, so [0] is
// the best melody note whenever one is legal — the two kinds are never compared.
// `makeActionScorer`'s own contract says its scores are "higher is better,
// WITHIN A KIND", so there is no cross-kind number to compare them with.
//
// 📌 The journal cannot see this: `journalSummary` bumps `chosen` with the
// literal 'confirmMelody' for every compose entry, so `stackCommit` can never
// appear in `chosen` OR in `neverChosen`. §5.A's automated predictor is blind to
// the whole composition phase.
//
// Run: node --import ./src/engine/testAssetStub.mjs .scratch/stackorder.mjs 6 3
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { legalActions, beamActions } from '../src/engine/policies/legalActions.js';
import { makeActionScorer } from '../src/engine/policies/actionScore.js';
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
const n = Number(process.argv[2] ?? 6);
const lives = Number(process.argv[3] ?? 3);

const stat = {};
const get = (id) => (stat[id] ??= {
  turns: 0, commitTurns: 0, commitsAtFull: 0, commitsBelowFull: 0,
  // what the first composition step was, when BOTH kinds were on the menu
  firstStepNote: 0, firstStepCommit: 0,
  driveAtConfirm: [], sustAtConfirm: [],
});

for (const S of PAIRS) {
  for (let i = 0; i < n; i++) {
    const policies = Object.fromEntries(S.map(x => {
      const inner = POLICIES.searcher();
      return [x.id, (state, spiritId, view, ctx) => {
        const ns = state?.noteStates?.[spiritId] ?? {};
        const composing = !ns.hasConfirmed;
        const ans = inner(state, spiritId, view, ctx);
        if (composing && Array.isArray(ans)) {
          const s = get(spiritId);
          s.turns++;
          const notes   = ans.filter(a => a.kind === 'melodyNote').length;
          const commits = ans.filter(a => a.kind === 'stackCommit').length;
          if (commits) {
            s.commitTurns++;
            if (notes >= 8) s.commitsAtFull += commits; else s.commitsBelowFull += commits;
          }
          s.driveAtConfirm.push((ns.driveStack ?? []).length
            + ans.filter(a => a.kind === 'stackCommit' && a.dest === 'drive').length);
          s.sustAtConfirm.push((ns.sustainStack ?? []).length
            + ans.filter(a => a.kind === 'stackCommit' && a.dest === 'sustain').length);

          // 🔎 THE MECHANISM. With both kinds legal, what does the beam hand back
          // as [0] — i.e. which kind wins the composition step?
          const opts = legalActions(state, spiritId, view);
          const steps = opts.filter(a => a.kind === 'melodyNote' || a.kind === 'stackCommit');
          const kinds = new Set(steps.map(a => a.kind));
          if (kinds.size === 2) {
            const pick = beamActions(steps, { limit: 1, score: makeActionScorer(state, spiritId, view) })[0];
            if (pick?.kind === 'melodyNote') s.firstStepNote++; else s.firstStepCommit++;
          }
        }
        return ans;
      }];
    }));
    runMatch({ seed: (i * 2654435761 + 12345) >>> 0, spirits: S, policies, lives });
  }
}

const mean = (a) => a.length ? (a.reduce((x, y) => x + y, 0) / a.length) : 0;
const pct = (a, f) => (100 * a.filter(f).length / Math.max(1, a.length)).toFixed(0);
for (const [id, s] of Object.entries(stat)) {
  console.log(id);
  console.log(`  composition turns              ${s.turns}`);
  console.log(`  turns containing ANY commit    ${s.commitTurns} (${(100*s.commitTurns/Math.max(1,s.turns)).toFixed(0)}%)`);
  console.log(`  commits made on a FULL 8-track ${s.commitsAtFull} | on a shorter track ${s.commitsBelowFull}`);
  // ⚠️ THIS ROW IS THE CONTROL, NOT THE BOT. It calls `beamActions(...)[0]`
  // directly — the picker as it was BEFORE the 2026-08-19 fix — so it keeps
  // reporting `stackCommit 0×` however well the searcher now plays. That is the
  // point: it is the regression witness for the ordering bug itself. What the
  // shipped searcher actually does is the two rows above and below it.
  console.log(`  [control] old picker's step [0]: melodyNote ${s.firstStepNote}× / stackCommit ${s.firstStepCommit}×`);
  console.log(`  Drive at confirm  mean ${mean(s.driveAtConfirm).toFixed(2)}  (empty on ${pct(s.driveAtConfirm, v=>v===0)}% of turns)`);
  console.log(`  Sustain at confirm mean ${mean(s.sustAtConfirm).toFixed(2)}  (empty on ${pct(s.sustAtConfirm, v=>v===0)}% of turns)\n`);
}
