// ─── HEADLESS PLAY ──────────────────────────────────────────────────────────
// `runMatch({ seed, config, policies })` — BOT_STRATEGY_HANDOFF §6.6's harness.
//
// The instrument, not an arm. §5's weight table says its numbers are "starting
// points to be tuned by the §6 harness, **not** measurements"; §7 says tuning
// the Smash before anything has played 2000 matches is tuning blind;
// `THEORY_ROUTES_DESIGN.md` §4.3 calls this the thing that "turns 'feels better'
// into evidence". None of that is available until a match can play itself with
// no React in the room. This file is that.
//
// It owns NO RULES, exactly like `transition.js` — it is a driver. Where a rule
// would have to be re-implemented to make a match run, the gap is DECLARED
// (see HARNESS_GAPS) rather than filled, because a harness that quietly invents
// a rule reports confident numbers about a game nobody is playing.
//
// ── ⚠️ THE BASELINE IS NOT THE SHIPPED BOT, AND THAT IS A DELIBERATE CHOICE ──
// §6.6 words the bar as "new bot vs current bot, ~2000 matches, ≥60%". The
// current bot CANNOT be the baseline here, and it is worth being explicit about
// why rather than letting it look like an omission:
//
//   The shipped bot is a React step-machine (`botStepRef`: idle → building →
//   committed → moving → acting → ending) wired through refs, `schedule()`,
//   `setTimeout`, and a dozen closure-scoped helpers (`getRivalsInCone`,
//   `botBestFacing`, `ampsInRangeRef`…). It cannot be lifted out headlessly.
//   Re-implementing it here would produce a THIRD copy of the bot's judgement
//   to keep in step with the other two — the precise failure the chooser →
//   ranker promotion in `bot.js` was done to avoid, committed one layer up and
//   with 2000 matches of authority behind it.
//
// So the baseline is `unranked`: THE SAME SEARCHER WITH THE BEAM'S `score`
// TURNED OFF. That is a strictly better controlled experiment for the question
// actually on the table — it isolates the one variable §6.3 changed, where
// "searcher vs step-machine" would confound ranking with search, phase order,
// and a re-implementation's own bugs. `random` is included as a floor: if the
// searcher cannot beat uniform-legal play, the instrument is broken, not the
// bot.
//
// 📌 A faithful `legacy` policy becomes cheap the day the bot step-machine
// leaves the monolith. The seat is left open (`POLICIES`) for exactly that.

import { applyAction } from "../reduce.js";
import { makeRng } from "../rng.js";
import {
  turnStarted, noteSheetPatched,
  knockdownResolved, spiritEliminated, winnerDeclared,
} from "../actions.js";
import { makeInitialState } from "../state.js";
import { SKILL_BY_ID } from "../../data/skillTree.js";
import { startTurnNotes, refillDrawCount } from "../systems/turnFlow.js";
import { decideWinner } from "../systems/combat.js";
import { legalActions, beamActions } from "./legalActions.js";
import { traceKey } from "./botJournal.js";
import { makeActionScorer } from "./actionScore.js";
import { evaluate } from "./evaluate.js";
import { applyBotAction, applyBotLine, UNMODELLED_KINDS } from "./transition.js";

// ── What this harness does not model ────────────────────────────────────────

/**
 * ⚠️ READ THIS BEFORE CITING A WIN RATE. Each entry is a thing the shipped game
 * does that a headless match does not, with the reason it is absent. None of
 * them is a bug; every one of them narrows what a number out of here means.
 */
export const HARNESS_GAPS = {
  // `transition.js` declares these unmodelled: undefendable, with a long
  // bespoke side-effect chain. They are FILTERED OUT of every policy's options,
  // so no seat ever smashes. ⚠️ §7's open question about the Smash punishing a
  // good turn therefore CANNOT be measured here yet — which is unfortunate,
  // because §7 explicitly wants to hold that fix until §6.6 can measure it.
  smash: 'UNMODELLED in transition.js — filtered from every policy',
  blaster: 'UNMODELLED in transition.js — filtered from every policy',

  // ~~SKILL_TREE still lives in the monolith~~ ✅ CLOSED 2026-08-16 —
  // `data/skillTree.js`. `runMatch` now passes the real tree by default, so
  // unlocks are live and Metalness's rework is finally exercised. Pass
  // `view.skillById: null` to go back to base kits deliberately.
  //
  // ⚠️ WHAT IS STILL MISSING IS THE SIDE-EFFECT CHAIN, NOT THE UNLOCK.
  // `transition.js` applies the STATE half of a skill award — the id enters
  // `unlockedSkills` and the Db is spent — but `applySkillEffects` is
  // client-owned, so anything a skill does at the MOMENT of purchase does not
  // fire here. Skills whose whole effect is passive and read off the sheet
  // (🐙 Tentacle, 🔊 Goes to 11, the Theory rungs) are fully live; skills that
  // reach into the client on unlock are bought and then partly inert.
  skillEffects: 'the STATE half of an unlock lands; applySkillEffects is client-owned',

  // The client's own hooks. Absent hooks are skipped by `runBattleFlow`, which
  // is what the harness wants for theatre — but these two carry real economy.
  demolishFans: 'crowd scatter on a knockdown — client-owned, skipped',
  gainFans: 'deed-driven fan gains — client-owned, skipped',
  hexHazards: 'hazard hexes along a knockback path — client-owned, skipped',
  stageFxThresholds: 'stage FX draws at Fame thresholds — client-owned, skipped',

  // ~~The pose's per-round FP tick and Sustain toll ride the client turn clock
  // (`transition.js` gap 3), so a `pose` here flips a flag and pays nothing.~~
  //
  // ✅ CLOSED 2026-08-17 (§6.6.8) — the key is DELETED, not set to a nicer
  // string, so `harnessCheck`'s "declared, not silently absent" sweep keeps
  // meaning what it says. `posing` and `limelightScores` are engine state
  // (`systems/limelight.js`); `transition.js`'s `endTurn` drives
  // `poseConsequences` off the same `limelightHeld` verdict the client reads, so
  // the FP goes through `grantFame` (crowd multiplier, per-turn cap, win check)
  // and the Sustain note is billed, exactly once, in one place.
  //
  // ⚠️ AND CLOSING IT UNCOVERED A SECOND GAP UNDERNEATH. `hook('leftLimelight')`
  // — the pose ending when you are SHOVED out of the middle — was client-only,
  // and `harnessHooks` never implemented it, so a bench Spirit knocked off the
  // Limelight kept `posing` set and rolled a ZERO defence die for the rest of
  // the match. That one was not an unpaid bonus; it was a live penalty welded
  // on, on a Spirit who never chose it. It is a rule in `battleFlow.js` now.

  // See `matchConfig` — the Rock God finale is sidestepped by construction.
  //
  // 🪦 AND AS OF 2026-08-18 IT IS SHELVED, NOT PENDING (Alex's call). That
  // changes what this entry MEANS rather than whether it is here: it used to
  // name work the harness owed the game, and it now names a subsystem the game
  // is not currently shipping.
  //
  // ✅ AND THE CONSTRAINT IT IMPOSED IS RECLAIMED. The finale used to be
  // sidestepped by playing TWO-LIFE matches, which `matchConfig` was very clear
  // under-rates every investment term in §3.2 and §3.6. `grantFame` now crowns on
  // the Fame target at any number of lives, so `matchConfig` defaults to THREE
  // and the bench finally measures the horizon the game is played on.
  summonRockGod: '🪦 SHELVED 2026-08-18 — `ROCK_GODS_SHELVED`; the Fame target crowns outright at any number of lives',

  // ── 🎤 NEW 2026-08-17 — the riff-off runs, with one modelled part ──────────
  //
  // ⚠️ THE RULES ARE REAL; THE HANDS ARE NOT. Both charts come out of
  // `applyRiffOffStarted` exactly as they do online, and the verdict is
  // `applyRiffResolved`'s. What no state can supply is the PERFORMANCE — for a
  // human that is fingers on a falling-notes highway — so the two results arrays
  // come from `riffOff.js: simulateRiffPerformance`, whose single assumption is
  // that a Spirit plays the duel as well as they played their last melody.
  // ⚠️ ANY BENCH READING ABOUT RIFF-OFF FREQUENCY OR PAYOUT IS A READING OF THAT
  // CURVE AS MUCH AS OF THE GAME. Quote it that way.
  riffPerformance: 'the duel runs; both sides are PLAYED by simulateRiffPerformance (perfScore-driven)',

  // ~~Round 2 escalation is not driven headlessly: the Round-1 verdict closes
  // the duel.~~
  //
  // ✅ CLOSED 2026-08-18 — the key is DELETED, not softened, so `harnessCheck`'s
  // "declared, not silently absent" sweep keeps meaning what it says.
  // `transition.js`'s `riffOff` case now escalates on the engine's own
  // `verdict.close`, exactly where the client's `fireBeamClash` does, capped at
  // two rounds. That restores the 2 FP sudden-death bonus, the extra damage
  // band, and the both-paid consolation — which `bothStrong` gates on
  // `round >= 2`, so before this it could not fire at all.
  //
  // ⚠️ WHAT IS LEFT IS A DIFFICULTY GAP, NOT A RULES GAP. Round 2's chart is
  // sped up to 0.58× the gaps and `simulateRiffPerformance` has no tempo term,
  // so both sides play sudden death as well as they played Round 1. That
  // OVER-states clean quality in Round 2 specifically, which matters most at the
  // `RIFF_BOTH_PAID_QUALITY` bar (75%): the consolation fires more often here
  // than it would with human hands on a chart that just got half again as fast.
  // Declared rather than corrected — a tempo penalty would be a number nobody
  // has measured, sitting in the one place tuning cannot see it.
  riffRound2Speed: 'sudden death IS driven; its 0.58× chart is played at Round-1 difficulty (no tempo term)',

  // The Overcharge modal (choose floor / ceiling / chord assist on a Charge Zone)
  // is a player decision the headless path does not guess at: it takes the
  // ordinary 50/50 spark. Likewise a picked-up Lost Chord always BANKS rather
  // than being woven straight into a stack, which is the conservative branch.
  pickupChoices: 'Overcharge + stack-weave modals not modelled; spark is 50/50, chords bank',
};

// ── The hooks a match genuinely needs ───────────────────────────────────────

/**
 * The two hooks without which a match cannot END.
 *
 * ⚠️ `declareWinner` IS NOT OPTIONAL, and its absence fails silently in the
 * worst way: `runBattleFlow` skips hooks it does not have, so a harness without
 * this one plays a game that can never be won and reports a timeout as a draw.
 * Everything else in `HARNESS_GAPS` is skippable. These two are not.
 *
 * `knockOut` has to finish a job `battleFlow` deliberately leaves open: the
 * knockdown branch that still has lives runs `knockdownResolved` itself, but
 * the out-of-lives branch only yields the hook, because who gets removed from
 * the rotation and what that means for the match is the caller's business.
 */
export function harnessHooks({ rng }) {
  const act = (state, action) => applyAction(state, action, rng);
  return {
    declareWinner: (state, e) => act(state, winnerDeclared(e.spiritId)),
    knockOut: (state, e) => {
      // `knockdownResolved` runs the same `resolveKnockdown` kernel the
      // respawn branch uses; out of lives, it sets `knockedOut`.
      let next = act(state, knockdownResolved(e.spiritId));
      next = act(next, spiritEliminated(e.spiritId));
      const { winnerId } = decideWinner(next.spirits, { hasWinner: !!next.winner });
      return winnerId ? act(next, winnerDeclared(winnerId)) : next;
    },
  };
}

// ── Turn start ──────────────────────────────────────────────────────────────

/**
 * Open the acting Spirit's turn: the refill, the mode derivation, the cleared
 * melody line — everything `startTurnNotes` owns.
 *
 * ⚠️ THE DRAW COUNT COMES FROM `refillDrawCount`, NOT FROM COUNTING BY EYE, and
 * the client carries the same warning: if the number drawn and the number
 * consumed ever disagree, every later draw in the match is misaligned, and it
 * shows up as nothing at all until a replay diverges.
 *
 * ⚠️ AND THIS IS DRIVEN FROM HERE RATHER THAN BY THE REDUCER because that is
 * where the shipped game drives it too — `startTurnNotes` is a pure kernel the
 * client calls on turn start. A harness that skipped it would run every Spirit
 * on the stock they were dealt at match start, i.e. would measure a game with
 * no §1 tempo in it at all.
 */
export function startSpiritTurn(state, rng) {
  const id = state?.acting;
  if (!id) return state;
  let next = applyAction(state, turnStarted(id), rng);
  const ns = next.noteStates?.[id];
  if (!ns) return next;
  const draws = Array.from({ length: refillDrawCount(ns) }, () => rng());
  const { patch } = startTurnNotes(ns, { draws });
  return patch ? applyAction(next, noteSheetPatched(id, patch), rng) : next;
}

// ── Policies ────────────────────────────────────────────────────────────────

/** Options a policy never gets to see past. */
const playable = (actions) => actions.filter(a => !UNMODELLED_KINDS.has(a.kind));

/**
 * The searcher: `legalActions` → beam → `applyBotAction` → `evaluate`, greedy,
 * one action at a time.
 *
 * ⚠️ ONE PLY, AND THE HANDOFF SAYS SO. §6.4 wants expectimax over sampled
 * rollouts because Swing is d6, Sonic is keep-highest and knockback scatters —
 * plain greedy over one fixed dice sample will systematically mis-price
 * high-variance lines. This is the shape that step lands ON, not a substitute
 * for it: the beam, the transition and the evaluator are all in place, and what
 * is missing is the sampling.
 *
 * ⚠️ THE SPECULATIVE RNG IS FORKED, WHICH IS §0.4's RULE AND NOT A DETAIL.
 * `applyBotAction`'s own header says it cannot enforce this and the caller must:
 * a speculative roll off the live cursor burns draws inside a hypothetical and
 * desyncs every replay and every online client, SILENTLY. The fork label carries
 * the turn count so the bot is not married to one dice roll for a whole match
 * while staying reproducible from the seed alone.
 */
const COMPOSITION_KINDS = new Set(['melodyNote', 'stackCommit']);

/**
 * ⚠️ THE COMPOSITION PHASE IS A PLAN, NOT A SEQUENCE OF STEPS — and the first
 * headless trace proved it the hard way.
 *
 * A step-at-a-time greedy CONFIRMS A ONE-NOTE MELODY every single turn, and the
 * reason is structural rather than a tuning miss: adding a note to the track
 * moves no term in `evaluate` at all, while `confirmMelody` immediately raises
 * `apBanked`. So one-ply greedy scores "confirm now" above "write more music",
 * every turn, forever — the bot buys 1 AP and skips the Db, the Performance
 * Score, the fans and the riff that a longer track pays.
 *
 * 📌 **THIS IS §6b.1's CAVEAT COMING BACK ONE LAYER UP.** That caveat was about
 * the TRANSITION being blind to the commit's economy, and it was closed by
 * `melodyCommit.js` — the transition now prices a long track correctly. What
 * this trace found is that a one-ply POLICY cannot see that price no matter how
 * correct the transition is, because the whole payoff lands on one action and
 * greedy compares one action at a time. Same blind spot, different organ.
 *
 * The fix keeps the two jobs separate and each with its owner:
 *   · WHICH note or commit to add next → the beam's scorer, i.e. the shipped
 *     planners' musical judgement (`botPlanNoteStep`'s order, and per §6.3 not
 *     re-derived here).
 *   · HOW MANY to add before confirming → `evaluate`, on the state AFTER the
 *     confirm, which is the only place the economy is visible.
 *
 * ⚠️ EVERY CANDIDATE IS EVALUATED AT ITS OWN CONFIRM, never mid-track. Scoring
 * a truncated composition would compare "three notes written" against "one note
 * written and cashed", which is not a comparison — `transition.js`'s
 * `applyBotLine` header refuses partial lines for exactly this reason.
 */
// ⚠️ NO `limit` HERE, AND IT IS NOT AN OVERSIGHT. The beam's per-kind cap is a
// branching-factor control for a search that keeps several lines alive; this
// walks ONE line and only ever needs the single best next step, so it asks for
// `limit: 1` outright. Taking a `limit` it then ignored would read as a knob.
function composePhase(state, spiritId, view, ctx, { ranked, trace = null }) {
  const probe = ctx.rng.fork(`compose:${state?.turn?.count ?? 0}`);
  let cur = state, curView = view;
  const prefix = [];
  const curve = [];
  let best = null, bestScore = -Infinity;

  for (let i = 0; i <= MELODY_SEARCH_DEPTH; i++) {
    const options = playable(legalActions(cur, spiritId, curView));

    // Price THIS track, as committed. `applyBotLine` is atomic, so a refusal
    // anywhere in the line leaves the real state untouched.
    const confirm = options.find(a => a.kind === 'confirmMelody');
    if (confirm) {
      const line = [...prefix, confirm];
      const r = applyBotLine(state, line, { rng: probe, view, hooks: ctx.hooks });
      if (!r.stoppedAt) {
        const s = evaluate(r.state, spiritId, r.view ?? view).score;
        // 🧠 THE CURVE — what each track LENGTH was worth, which is the whole
        // argument of this function made visible. §6.3's finding was that a
        // one-ply greedy confirms a ONE-NOTE melody every turn; this is the
        // shape that says whether it still would.
        if (trace) curve.push({ len: prefix.length, score: s });
        if (s > bestScore) { bestScore = s; best = line; }
      }
    }

    // Extend by the single best composition step the SCORER likes.
    const steps = options.filter(a => COMPOSITION_KINDS.has(a.kind));
    if (!steps.length) break;
    const pick = ranked
      ? beamActions(steps, { limit: 1, score: makeActionScorer(cur, spiritId, curView) })[0]
      : steps[0];
    if (!pick) break;
    const r = applyBotAction(cur, pick, { rng: probe, view: curView, hooks: ctx.hooks });
    if (!r.ok) break;
    cur = r.state; curView = r.view ?? curView;
    prefix.push(pick);
  }

  if (trace) {
    trace({
      t: 'compose', turn: state?.turn?.count ?? 0, spiritId,
      curve, chosen: best ? { len: best.length - 1 } : null, score: bestScore,
    });
  }
  return best;
}

/** How long a track the composition search will consider. `MELODY_MAX` is 8 and
 *  `STACK_COMMIT_BUDGET` adds 3 more steps, so this covers the whole phase. */
export const MELODY_SEARCH_DEPTH = 11;

/**
 * ⚠️ ACTIONS WHOSE OUTCOME IS A DICE ROLL, AND WHY THEY CANNOT BE SCORED ONCE.
 *
 * 🎯 THIS IS §6.4, AND UNTIL 2026-08-17 IT WAS THE LARGEST UNBUILT PIECE OF THE
 * SEARCHER. Measured before it landed: across a 250-turn duel an attack was
 * legal at **773** decision points and was chosen **2** times. The weights were
 * not the reason and neither was the beam — both were exonerated by probe.
 *
 * The reason is structural. `applyBotAction` RESOLVES an attack: it rolls, it
 * applies damage or a whiff, it knocks somebody back. So a one-sample greedy
 * decides whether to fight by rolling the dice ONCE and reading the result as if
 * it were the action's value. A Swing's hit rate runs 17.8% on one Drive note to
 * 100% on eight (§6.6.0), so a single sample is not an estimate of anything — and
 * a miss is expensive (the defender's counter, the knockback, the AP), so the
 * modal sample of a marginal attack is a loss. The bot was not attack-shy. It was
 * looking at one roll and believing it.
 *
 * §6.4 called this in advance and got the SIGN backwards, which is worth
 * recording: it warned that "plain minimax will systematically OVER-value
 * high-variance lines". In a game where the variance is mostly downside and the
 * alternative is a safe shuffle, one sample systematically UNDER-values them.
 *
 * 📌 Deterministic kinds are still scored once, and that is not an optimisation
 * to be tidied away later — sampling something with no randomness in it would
 * burn N times the transitions to return the same number N times.
 */
export const STOCHASTIC_KINDS = new Set([
  'swing', 'sonic', 'tentacle', 'riffOff', 'smash', 'blaster',
]);

/**
 * How many rolls an attack is judged on.
 *
 * ⚠️ A BUDGET, NOT A CONVERGENCE TARGET. Six samples of a d6-scale outcome still
 * carry real error; the point is to move from "one roll, believed" to "a mean
 * with a known bias", which is the difference between never attacking and
 * attacking when the odds are good. It is the searcher's dominant cost — every
 * sample is a full battle resolution — so raising it is a runtime decision to be
 * made against the §6.6 bench, not a free accuracy dial.
 */
export const ATTACK_SAMPLES = 6;

/**
 * The score of winning outright.
 *
 * ⚠️ FINITE, AND IT HAS TO BE. `Infinity` was correct while every action was
 * scored once — a line that wins is taken — but it does not survive averaging:
 * one winning sample in six would make the mean `Infinity` too, so a 17% chance
 * of victory would outrank a certainty. Large enough to dominate any real
 * position, small enough that expectation still works on it.
 */
export const WIN_SCORE = 1e6;

/**
 * Expected value of one action, over `samples` independent dice draws.
 *
 * ⚠️ EACH SAMPLE GETS ITS OWN FORK, AND THE LABEL CARRIES THE INDEX. Reusing one
 * fork across the samples would replay the same stream from a different point
 * for every action — correlated, and worse, ORDER-DEPENDENT, so the beam's
 * source order would leak into the estimate. Labelled forks keep every action's
 * k-th sample drawn from the same place, which is what makes this a fair
 * comparison and keeps the §6.6 determinism regression green: forks are derived
 * from the seed, so the whole search is still reproducible from `{seed}` alone.
 */
function expectedScore(state, action, spiritId, view, ctx, samples) {
  let total = 0, n = 0;
  for (let k = 0; k < samples; k++) {
    const probe = ctx.rng.fork(`search:${state?.turn?.count ?? 0}:${k}`);
    const r = applyBotAction(state, action, { rng: probe, view, hooks: ctx.hooks });
    if (!r.ok) continue;
    // A dead seat is -Infinity by `evaluate`'s own contract. ⚠️ That one value
    // must NOT be averaged — a line that can kill you is not redeemed by five
    // samples where it does not — so it short-circuits the whole estimate.
    if (r.state?.winner === spiritId) { total += WIN_SCORE; n++; continue; }
    const sc = evaluate(r.state, spiritId, r.view ?? view).score;
    if (!Number.isFinite(sc)) return -Infinity;
    total += sc; n++;
  }
  return n ? total / n : -Infinity;
}

/**
 * @param {object} opts
 *   · `ranked`  rank the beam by `makeActionScorer` (false = "the first 5")
 *   · `limit`   beam width per kind · `samples` dice draws per stochastic action
 *   · `trace`   🧠 OPTIONAL SINK. Called with one plain object per decision — see
 *     `botJournal.js` for the shapes. ⚠️ PURE FROM THIS SIDE: the return value is
 *     ignored, nothing is read back, and no clock is read here (a sink that wants
 *     wall-clock stamps its own — the engine reading the clock is what broke the
 *     determinism regression the last time somebody tried it). `botTraceCheck`
 *     pins the consequence: same seed, traced and untraced, same game.
 *   · `audit`   🎯 also price the options the BEAM THREW AWAY, and report the best
 *     of them as `bestPruned`. Costs a second full sampling pass over the pruned
 *     options, so it is off by default and off in the bench — but a played game
 *     spends 520ms a tick doing nothing, which is a budget worth spending on the
 *     one question §5.E⁗ item 1 cannot otherwise answer: does the ranking throw
 *     away better moves than it keeps? ⚠️ It cannot change play. `expectedScore`
 *     works on forks, and a fork consumes nothing from the stream it came from.
 */
function searcherPolicy({ ranked = true, limit = 5, samples = ATTACK_SAMPLES, trace = null, audit = false } = {}) {
  return function choose(state, spiritId, view, ctx) {
    const ns = state?.noteStates?.[spiritId] ?? {};

    // COMPOSITION — searched as a line, for the reason above.
    if (!ns.hasConfirmed) {
      const line = composePhase(state, spiritId, view, ctx, { ranked, trace });
      if (line?.length) return line;
      // No confirmable track (an empty melody line is not confirmable), so fall
      // through and let the action phase's greedy answer — which will be
      // `endTurn`, correctly: a Spirit with nothing to play has nothing to do.
    }

    // ACTION PHASE — greedy over ONE PLY, but over the EXPECTATION of that ply
    // rather than over one sample of it. Every action still has an immediate
    // board effect the evaluator can see; what needed fixing was not the depth
    // but the fact that some of those effects are rolled.
    const options = playable(legalActions(state, spiritId, view));
    if (!options.length) return { kind: 'endTurn', apCost: 0 };

    const beamed = ranked
      ? beamActions(options, { limit, score: makeActionScorer(state, spiritId, view) })
      : beamActions(options, { limit });

    let best = null, bestScore = -Infinity;
    const scored = trace ? [] : null;
    for (const action of beamed) {
      const n = STOCHASTIC_KINDS.has(action.kind) ? samples : 1;
      const s = expectedScore(state, action, spiritId, view, ctx, n);
      if (scored) scored.push({ kind: action.kind, key: traceKey(action), score: s });
      if (s > bestScore) { bestScore = s; best = action; }
    }

    if (trace) {
      // 🎯 WHAT THE BEAM THREW AWAY. Priced with the same sampler, on forks, and
      // then discarded — the chosen action above is already fixed by the loop
      // that ran before this block, so nothing here can reach the game.
      let bestPruned = null;
      if (audit) {
        const kept = new Set(beamed);
        for (const action of options) {
          if (kept.has(action)) continue;
          const n = STOCHASTIC_KINDS.has(action.kind) ? samples : 1;
          const s = expectedScore(state, action, spiritId, view, ctx, n);
          if (!bestPruned || s > bestPruned.score) {
            bestPruned = { kind: action.kind, key: traceKey(action), score: s };
          }
        }
      }
      trace({
        t: 'action', turn: state?.turn?.count ?? 0, spiritId,
        legalKinds: [...new Set(options.map(a => a.kind))],
        legal: options.length, beamed: beamed.length, pruned: options.length - beamed.length,
        considered: scored.slice().sort((x, y) => y.score - x.score),
        chosen: best ? { kind: best.kind, key: traceKey(best) } : null,
        score: bestScore, bestPruned,
      });
    }
    return best ?? { kind: 'endTurn', apCost: 0 };
  };
}

/**
 * Uniform over legal actions — the FLOOR, not a bot.
 *
 * It exists to catch the failure mode where the instrument, not the policy, is
 * what is being measured: if a searcher cannot beat this, the harness is broken.
 * ⚠️ It draws from the live rng on purpose (it is a real decision, not a
 * hypothetical), which is why it takes `ctx.rng` rather than a fork.
 */
function randomPolicy() {
  return function chooseAction(state, spiritId, view, ctx) {
    const options = playable(legalActions(state, spiritId, view));
    if (!options.length) return { kind: 'endTurn', apCost: 0 };
    return options[ctx.rng.int(options.length)];
  };
}

/**
 * The policies a match can be played with.
 *
 * 📌 `legacy` is deliberately ABSENT rather than stubbed — see the header. A
 * stub named `legacy` would get cited as "the current bot" by the first person
 * who read a bench table without reading this file.
 */
export const POLICIES = {
  searcher: (opts) => searcherPolicy({ ...opts, ranked: true }),
  unranked: (opts) => searcherPolicy({ ...opts, ranked: false }),
  random: () => randomPolicy(),
};

// ── One turn ────────────────────────────────────────────────────────────────

/**
 * ⚠️ A TURN NEEDS A CEILING, and it is a real safety rail rather than paranoia.
 * A policy that keeps choosing a zero-cost action it has already taken —
 * `pose` when the flag is already set, a `face` it cannot afford to follow
 * through on — would spin forever inside one turn and hang a 2000-match run
 * with no output at all. The ceiling converts that into a reported anomaly.
 */
export const MAX_ACTIONS_PER_TURN = 60;

export function playTurn(state, view, policy, ctx) {
  const spiritId = state.acting;
  let cur = state;
  // The FP-per-turn window is per turn and per Spirit; the client clears it at
  // turn start and `grantFame` reads it to enforce FAME_PER_TURN_CAP.
  let v = { ...view, fameThisTurn: {} };
  const actions = [];
  // 🎤 EVERY DUEL FOUGHT THIS TURN, as the verdict that ended it. ⚠️ A RIFF-OFF
  // COUNTED IS NOT A ROUND 2 REACHED — the same distinction `limelightScores`
  // exists for. Counting `riffOff` actions would report a thriving sudden-death
  // economy on a tree that never escalates, which is exactly the reading §6.6.9
  // had to disprove. `applyBotAction` hands the resolved battle back; this keeps
  // the three fields a payout depends on and drops the charts.
  const duels = [];

  for (let i = 0; i < MAX_ACTIONS_PER_TURN; i++) {
    if (cur.winner) return { state: cur, view: v, actions, duels, stalled: false };

    // ⚠️ A POLICY MAY ANSWER WITH A LINE, NOT JUST A STEP. The composition phase
    // is a plan whose whole payoff lands on its last action (`confirmMelody`),
    // so a policy that could only speak one action at a time could not express
    // it — see `composePhase`. Applied here one at a time regardless, so the
    // refusal check below still sees every action individually.
    const answer = policy(cur, spiritId, v, ctx) ?? { kind: 'endTurn', apCost: 0 };
    const chunk = Array.isArray(answer) ? answer : [answer];
    if (!chunk.length) return { state: cur, view: v, actions, duels, stalled: true, refused: { reason: 'empty plan' } };

    for (const action of chunk) {
      const before = cur;
      const r = applyBotAction(cur, action, { rng: ctx.rng, view: v, hooks: ctx.hooks });
      if (!r.ok) {
        // ⚠️ A refusal here is a REAL BUG and must not be swallowed. Actions come
        // straight from `legalActions`, so `illegal` means the generator and the
        // transition have drifted — §6's contract, broken. The run reports it
        // rather than quietly ending the turn and averaging the damage away.
        return { state: cur, view: v, actions, duels, stalled: true, refused: { action, reason: r.reason, detail: r.detail } };
      }
      cur = r.state; v = r.view ?? v;
      actions.push(action);
      if (action.kind === 'riffOff' && r.battle?.verdict) {
        const vd = r.battle.verdict;
        // ⚠️ `fp` IS THE POINT OF THIS LEDGER, not a nicety. A duel RESOLVED and
        // a duel PAID are different events — `grantFame` clips at
        // `FAME_PER_TURN_CAP`, so a bonus can be awarded in full and banked at
        // zero. Measured across the action rather than read off the verdict for
        // that exact reason: the verdict knows what was owed, not what landed.
        // §6.6.9 is the finding this field produced.
        const fpOf = (st) => (st.noteStates?.[spiritId]?.fame ?? 0)
                           + (st.noteStates?.[action.targetId]?.fame ?? 0);
        duels.push({
          round: vd.round ?? 1, tie: !!vd.tie, close: !!vd.close,
          bothStrong: !!vd.bothStrong, fp: fpOf(r.state) - fpOf(before),
        });
      }
      if (action.kind === 'endTurn') return { state: cur, view: v, actions, duels, stalled: false };
      if (cur.winner) return { state: cur, view: v, actions, duels, stalled: false };
    }
  }
  return { state: cur, view: v, actions, duels, stalled: true, refused: { reason: 'turn ceiling' } };
}

// ── One match ───────────────────────────────────────────────────────────────

/**
 * ✅ FULL-LENGTH GAMES BY DEFAULT SINCE 2026-08-18 — and the change is a
 * constraint being RETIRED, not a preference.
 *
 * ~~⚠️ SHORT GAMES BY DEFAULT, AND IT IS LOAD-BEARING RATHER THAN IMPATIENT.
 * `grantFame` branches on `shortGame = startingLives < 3`: under three lives a
 * Spirit who reaches the Fame target is crowned outright, and above it a close
 * race summons a Rock God to settle the finale instead. The God is a whole
 * subsystem the harness does not drive, so a 3-life match can reach the target
 * and then run forever with nothing able to end it. Two lives sidesteps that by
 * construction rather than by patching the rule.~~
 *
 * 🪦 The Rock God finale is SHELVED (`ROCK_GODS_SHELVED`, Alex 2026-08-18), so
 * `grantFame` now crowns on the Fame target at any number of lives and there is
 * nothing left to sidestep. The warning that made two lives a cost worth paying:
 *
 * > ⚠️ THE COST IS REAL AND MUST BE QUOTED WITH ANY RESULT: `fameToWin` is
 * > `lives × fpPerLife(count)`, so a 2-life match has a materially shorter
 * > horizon — and §3.2 and §3.6 both make the horizon a strategic variable
 * > (banked Db and fan multipliers are worth less the closer the finish line).
 * > A bench on short games under-rates investment and over-rates tempo.
 *
 * 🐛 AND THE FIRST ATTEMPT AT THREE FAILED, WHICH IS HOW §6.6.10 WAS FOUND.
 * Three lives ran 20/40 decided at a 400-turn cap and 21/40 at 800 — doubling
 * the cap bought three points, because the stalls were not slow games but dead
 * ones. The cause was the evaluator, not the horizon: `beamSetup` was priced
 * above the Fame it sets up, so `endTurn` outscored every action on the board
 * (see `evaluate.js`, above `BEAM_READY`). With that corrected, 30 matches a row:
 *
 * | lives | decided | mean turns | FP/turn |
 * |---|---|---|---|
 * | 2 | **30/30** | 24 | 0.77 |
 * | 3 | **30/30** | 34 | 0.74 |
 *
 * ⚠️ EVERY NUMBER MEASURED BEFORE 2026-08-18 WAS MEASURED ON TWO LIVES, and the
 * horizon is the variable §3.2 and §3.6 are about. Do not compare a three-life
 * reading to a two-life one and call the difference a policy change.
 */
export function matchConfig(spirits, { startingLives = 3, mode = 'ffa' } = {}) {
  return { mode, startingLives, spirits: structuredClone(spirits) };
}

/** A match that never ends is a result, not a hang. */
export const MAX_TURNS = 400;

/**
 * Play one seeded match to completion.
 *
 * @returns {{ winner, turns, reason, fame, anomaly }}
 *   `reason` is 'winner' | 'turnCap' | 'stalled'. ⚠️ Anything but 'winner'
 *   must be reported rather than folded into a win rate — a bench that counts
 *   timeouts as losses is measuring its own ceiling.
 */
export function runMatch({ seed, spirits, policies, view = {}, lives, maxTurns = MAX_TURNS }) {
  const rng = makeRng(seed >>> 0);
  const config = matchConfig(spirits, { startingLives: lives });
  let state = makeInitialState(config, seed >>> 0);
  const hooks = harnessHooks({ rng });
  const ctx = { rng, hooks };

  // ⚠️ THE REAL TREE BY DEFAULT. `legalActions` emits the `skillTarget` family
  // only when handed one (§6a: absent rather than guessed), and until the tree
  // was extracted from the monolith on 2026-08-16 there was nothing to hand it —
  // so every bench match was played on base kits, i.e. blind to every unlock in
  // the game and therefore to the whole of `METALNESS_REWORK_DESIGN.md`.
  // `view.skillById: null` still opts out, deliberately.
  // ✨ `posing: {}` is GONE from here (§6.6.8) — it is engine state now, and
  // leaving a dead copy in `view` would be a second source of truth that only
  // ever agreed by accident.
  let v = { amps: [], shadowHex: null, rockGodActive: false, skillById: SKILL_BY_ID, ...view };
  let turns = 0;
  // 🎤 The duel ledger — see `playTurn`. `round2` is the one that matters: it is
  // the difference between a rule being present and a rule being reachable.
  const duels = { fought: 0, round2: 0, ties: 0, bothPaid: 0, fp: 0, fpRound2: 0 };

  while (!state.winner && turns < maxTurns) {
    if (!state.acting) break;
    const seat = state.acting;
    const policy = policies[seat];
    if (!policy) return { winner: null, turns, duels, reason: 'stalled', anomaly: `no policy for ${seat}` };

    state = startSpiritTurn(state, rng);
    const t = playTurn(state, v, policy, ctx);
    state = t.state; v = t.view;
    turns++;
    for (const d of t.duels ?? []) {
      duels.fought++;
      duels.fp += d.fp ?? 0;
      if (d.round >= 2) { duels.round2++; duels.fpRound2 += d.fp ?? 0; }
      if (d.tie) duels.ties++;
      if (d.bothStrong) duels.bothPaid++;
    }

    if (t.stalled) {
      return { winner: state.winner ?? null, turns, duels, reason: 'stalled', anomaly: t.refused };
    }
    // `endTurn` already rotated the queue; a policy that returned early on a
    // winner did not, and does not need to.
  }

  const fame = Object.fromEntries(
    (state.spirits ?? []).map(s => [s.id, state.noteStates?.[s.id]?.fame ?? 0]));

  // ✨ Banked pose rounds come back with the result (§6.6.8) for the same reason
  // `fame` does: a POSE STRUCK IS NOT A POSE PAID. `limelightHeld` needs both
  // ends of the turn on hex 56, so a Spirit who walks in, poses, and is shoved
  // out banks nothing — and a probe that counted `pose` actions would report a
  // thriving Limelight economy that never paid anybody. This is the number that
  // says which of the two happened.
  const limelightScores = { ...(state.limelight?.scores ?? {}) };

  return {
    winner: state.winner ?? null,
    turns,
    reason: state.winner ? 'winner' : 'turnCap',
    fame,
    limelightScores,
    duels,
    anomaly: null,
  };
}

/**
 * Play `n` matches, SWAPPING SEATS EVERY OTHER MATCH.
 *
 * ⚠️ THE SWAP IS NOT POLITENESS, IT IS THE EXPERIMENT. Seats are not
 * interchangeable: they differ by Spirit (three different stat lines and
 * innates), by home corner, and by turn order — the first seat to act gets the
 * first melody commit and therefore the first AP in the match. A bench that
 * pinned policy A to seat 1 would measure the seat and report it as the policy.
 *
 * Returns per-policy wins, the draw/anomaly count, and the raw records, because
 * §5's own warning applies to this file too: a single number tells you the bot
 * preferred a line but never why.
 */
export function runBench({ seeds, spirits, a = 'searcher', b = 'unranked', opts = {}, view, lives }) {
  const seatIds = spirits.map(s => s.id);
  const results = [];
  const wins = { [a]: 0, [b]: 0 };
  let inconclusive = 0;

  for (let i = 0; i < seeds.length; i++) {
    // Alternate which policy takes which half of the table.
    const flip = i % 2 === 1;
    const assign = {};
    seatIds.forEach((id, k) => {
      const first = (k % 2 === 0) !== flip;
      assign[id] = first ? a : b;
    });
    const policies = Object.fromEntries(
      seatIds.map(id => [id, POLICIES[assign[id]](opts)]));

    const r = runMatch({ seed: seeds[i], spirits, policies, view, lives });
    const winnerPolicy = r.winner ? assign[r.winner] : null;
    if (winnerPolicy) wins[winnerPolicy]++; else inconclusive++;
    results.push({ ...r, assign, winnerPolicy, seed: seeds[i] });
  }

  const decided = wins[a] + wins[b];
  return {
    wins, inconclusive, decided,
    rate: decided ? wins[a] / decided : 0,
    results,
  };
}
