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

  // The pose's per-round FP tick and Sustain toll ride the client turn clock
  // (`transition.js` gap 3), so a `pose` here flips a flag and pays nothing.
  // Policies are therefore blind to §3.3 rather than wrong about it.
  pose: 'the FP tick and Sustain toll are on the client turn clock',

  // See `matchConfig` — the Rock God finale is sidestepped by construction.
  summonRockGod: 'sidestepped: short games crown outright (see matchConfig)',
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
function composePhase(state, spiritId, view, ctx, { ranked }) {
  const probe = ctx.rng.fork(`compose:${state?.turn?.count ?? 0}`);
  let cur = state, curView = view;
  const prefix = [];
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

  return best;
}

/** How long a track the composition search will consider. `MELODY_MAX` is 8 and
 *  `STACK_COMMIT_BUDGET` adds 3 more steps, so this covers the whole phase. */
export const MELODY_SEARCH_DEPTH = 11;

function searcherPolicy({ ranked = true, limit = 5 } = {}) {
  return function choose(state, spiritId, view, ctx) {
    const ns = state?.noteStates?.[spiritId] ?? {};

    // COMPOSITION — searched as a line, for the reason above.
    if (!ns.hasConfirmed) {
      const line = composePhase(state, spiritId, view, ctx, { ranked });
      if (line?.length) return line;
      // No confirmable track (an empty melody line is not confirmable), so fall
      // through and let the action phase's greedy answer — which will be
      // `endTurn`, correctly: a Spirit with nothing to play has nothing to do.
    }

    // ACTION PHASE — greedy is honest here. Every action has an immediate board
    // effect the evaluator can already see, so there is no deferred payoff for
    // one ply to be blind to.
    const options = playable(legalActions(state, spiritId, view));
    if (!options.length) return { kind: 'endTurn', apCost: 0 };

    const beamed = ranked
      ? beamActions(options, { limit, score: makeActionScorer(state, spiritId, view) })
      : beamActions(options, { limit });

    const probe = ctx.rng.fork(`search:${state?.turn?.count ?? 0}`);
    let best = null, bestScore = -Infinity;
    for (const action of beamed) {
      const r = applyBotAction(state, action, { rng: probe, view, hooks: ctx.hooks });
      if (!r.ok) continue;
      // Scored from this seat, after the action. A dead seat is -Infinity by
      // `evaluate`'s own contract, so nothing has to be special-cased here.
      const s = r.state?.winner === spiritId
        ? Infinity
        : evaluate(r.state, spiritId, r.view ?? view).score;
      if (s > bestScore) { bestScore = s; best = action; }
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

  for (let i = 0; i < MAX_ACTIONS_PER_TURN; i++) {
    if (cur.winner) return { state: cur, view: v, actions, stalled: false };

    // ⚠️ A POLICY MAY ANSWER WITH A LINE, NOT JUST A STEP. The composition phase
    // is a plan whose whole payoff lands on its last action (`confirmMelody`),
    // so a policy that could only speak one action at a time could not express
    // it — see `composePhase`. Applied here one at a time regardless, so the
    // refusal check below still sees every action individually.
    const answer = policy(cur, spiritId, v, ctx) ?? { kind: 'endTurn', apCost: 0 };
    const chunk = Array.isArray(answer) ? answer : [answer];
    if (!chunk.length) return { state: cur, view: v, actions, stalled: true, refused: { reason: 'empty plan' } };

    for (const action of chunk) {
      const r = applyBotAction(cur, action, { rng: ctx.rng, view: v, hooks: ctx.hooks });
      if (!r.ok) {
        // ⚠️ A refusal here is a REAL BUG and must not be swallowed. Actions come
        // straight from `legalActions`, so `illegal` means the generator and the
        // transition have drifted — §6's contract, broken. The run reports it
        // rather than quietly ending the turn and averaging the damage away.
        return { state: cur, view: v, actions, stalled: true, refused: { action, reason: r.reason, detail: r.detail } };
      }
      cur = r.state; v = r.view ?? v;
      actions.push(action);
      if (action.kind === 'endTurn') return { state: cur, view: v, actions, stalled: false };
      if (cur.winner) return { state: cur, view: v, actions, stalled: false };
    }
  }
  return { state: cur, view: v, actions, stalled: true, refused: { reason: 'turn ceiling' } };
}

// ── One match ───────────────────────────────────────────────────────────────

/**
 * ⚠️ SHORT GAMES BY DEFAULT, AND IT IS LOAD-BEARING RATHER THAN IMPATIENT.
 * `grantFame` branches on `shortGame = startingLives < 3`: under three lives a
 * Spirit who reaches the Fame target is crowned outright, and above it a close
 * race summons a Rock God to settle the finale instead. The God is a whole
 * subsystem the harness does not drive, so a 3-life match can reach the target
 * and then run forever with nothing able to end it.
 *
 * Two lives sidesteps that by construction rather than by patching the rule.
 * ⚠️ THE COST IS REAL AND MUST BE QUOTED WITH ANY RESULT: `fameToWin` is
 * `lives × fpPerLife(count)`, so a 2-life match has a materially shorter
 * horizon — and §3.2 and §3.6 both make the horizon a strategic variable
 * (banked Db and fan multipliers are worth less the closer the finish line).
 * A bench on short games under-rates investment and over-rates tempo.
 */
export function matchConfig(spirits, { startingLives = 2, mode = 'ffa' } = {}) {
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
  let v = { posing: {}, amps: [], shadowHex: null, rockGodActive: false, skillById: SKILL_BY_ID, ...view };
  let turns = 0;

  while (!state.winner && turns < maxTurns) {
    if (!state.acting) break;
    const seat = state.acting;
    const policy = policies[seat];
    if (!policy) return { winner: null, turns, reason: 'stalled', anomaly: `no policy for ${seat}` };

    state = startSpiritTurn(state, rng);
    const t = playTurn(state, v, policy, ctx);
    state = t.state; v = t.view;
    turns++;

    if (t.stalled) {
      return { winner: state.winner ?? null, turns, reason: 'stalled', anomaly: t.refused };
    }
    // `endTurn` already rotated the queue; a policy that returned early on a
    // winner did not, and does not need to.
  }

  const fame = Object.fromEntries(
    (state.spirits ?? []).map(s => [s.id, state.noteStates?.[s.id]?.fame ?? 0]));

  return {
    winner: state.winner ?? null,
    turns,
    reason: state.winner ? 'winner' : 'turnCap',
    fame,
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
