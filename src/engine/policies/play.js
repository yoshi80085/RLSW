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
  turnStarted, noteSheetPatched, fansChanged,
  knockdownResolved, spiritEliminated, winnerDeclared,
} from "../actions.js";
import { fansFromDeed } from "../systems/economy.js";
import { hexRingFromCenter, crowdMultiplier } from "../../board/boardHelpers.js";
import {
  FAN_DIEHARD_START, FAN_CASUAL_CAP, FAN_RECOVERY_LAG,
  FAN_FLEE_MIN, FAN_FLEE_MAX, FAN_DEFECT_TO_VICTOR,
} from "../../data/gameConstants.js";
import { makeInitialState } from "../state.js";
import { SKILL_BY_ID } from "../../data/skillTree.js";
import { rigTiers } from "../systems/sonicRig.js";
import { startTurnNotes, refillDrawCount } from "../systems/turnFlow.js";
import { decideWinner } from "../systems/combat.js";
import { buzzerReached, buzzerVerdict } from "../systems/battleFlow.js";
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
  // is what the harness wants for theatre.
  //
  // ~~demolishFans / gainFans — crowd scatter and deed fans, client-owned,
  // skipped.~~
  //
  // ✅ CLOSED 2026-09-01 — the keys are DELETED, not softened, so §8's
  // "declared, not silently absent" sweep keeps meaning what it says. Both are
  // implemented in `harnessHooks` below.
  //
  // ⚠️ THESE TWO WERE NOT THEATRE AND THE COMMENT ABOVE THEM SAID SO FOR MONTHS
  // ("these two carry real economy") while nothing acted on it. FANS MULTIPLY
  // FAME — up to `FAN_MULT_CAP` 2.0× — so a harness that pays no fans and
  // scatters no crowds is not measuring a quieter version of the game, it is
  // measuring a game with the Fame multiplier pinned near its floor. Every bench
  // number taken before this date is a reading of that game.
  hexHazards: 'hazard hexes along a knockback path — client-owned, skipped',
  stageFxThresholds: 'stage FX draws at Fame thresholds — client-owned, skipped',
  // 🎪 What is left of the fan economy, and it is one number rather than a
  // subsystem. The UNSURE POOL (fans a demolished act leaves loose on the centre,
  // recruitable by whoever plays there next) is client state, so the harness owns
  // its own copy: `runMatch` keeps a box, `playTurn` reads it into `view` at turn
  // start and writes it back at turn end. A demolition is therefore recruitable
  // from the NEXT turn rather than instantly. It is a latency, not a leak — the
  // pool conserves — and it is declared here rather than assumed harmless.
  unsurePoolLatency: 'the Unsure crowd is client state; the harness banks it per turn, so a demolition is recruitable from the next turn',

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
export function harnessHooks({ rng, crowd = { unsure: 0 } }) {
  const act = (state, action) => applyAction(state, action, rng);
  return {
    // ── 🎤 THE FAN ECONOMY, NO LONGER A GAP ────────────────────────────────
    //
    // ⚠️ WHY THIS IS NOT COSMETIC. Fans do not convert to Fame; they MULTIPLY
    // it, by up to `FAN_MULT_CAP` 2.0×, inside `grantFame` itself. A harness
    // with these two hooks missing therefore ran every Spirit on a crowd that
    // only ever grew from melody commits and never scattered — and priced every
    // Fame payout in the game against it. Both bodies are transcriptions of the
    // monolith's, arithmetic first (`fansFromDeed` is already shared).
    //
    // 📌 The client keeps the logging, the bursts and the camera swing. This
    // keeps the rule.
    gainFans: (state, e) => {
      const sp = (state.spirits ?? []).find(s => s.id === e.spiritId);
      if (!sp) return state;
      const deed = fansFromDeed(state.noteStates?.[e.spiritId] ?? {}, hexRingFromCenter(sp.num), e.n);
      return deed.patch ? act(state, fansChanged(e.spiritId, deed.patch)) : state;
    },

    // 💔 A public beating in the spotlight scatters the crowd — and hands some
    // of it straight to the winner, which is why this is a Fame swing and not
    // just a punishment.
    //
    // ⚠️ IT ONLY FIRES IN THE CENTRE (`main`/`pit`). A knockdown in the cheap
    // seats costs the loser nothing, because nobody saw it — that gate is the
    // whole reason the middle of the board is dangerous rather than merely good.
    demolishFans: (state, e) => {
      const ring = hexRingFromCenter(e.hexNum);
      if (ring !== 'main' && ring !== 'pit') return state;
      const ns = state.noteStates?.[e.targetId];
      if (!ns) return state;
      // 😎 A DIVINE MISSION blessing eats the whole demolition, and is spent.
      if (ns.divineShield) return act(state, fansChanged(e.targetId, { divineShield: 0 }));

      let diehards = ns.diehards ?? FAN_DIEHARD_START;
      let casuals  = ns.casuals ?? 0;
      // ⚠️ ASSIGNED Diehards are backstage and cannot be shaken — only the crowd
      // out front wavers. Reading `assignments` rather than the raw count is the
      // difference between a crew being worth having and being a liability.
      const unassigned = Math.max(0, diehards - ((ns.assignments ?? []).length));
      const shaken = Math.min(2, unassigned);
      diehards -= shaken; casuals += shaken;

      // The one seeded draw in this hook. ⚠️ IT MOVES THE STREAM: every bench
      // number after this date is drawn from a different sequence than before
      // it, so a win-rate difference across 2026-09-01 is not a policy result.
      const flee = Math.min(casuals, FAN_FLEE_MIN + Math.floor(rng() * (FAN_FLEE_MAX - FAN_FLEE_MIN + 1)));
      casuals -= flee;

      const toVictor = (e.attackerId && e.attackerId !== e.targetId) ? Math.min(FAN_DEFECT_TO_VICTOR, flee) : 0;
      const toUnsure = flee - toVictor;

      let next = act(state, fansChanged(e.targetId,
        { diehards, casuals, centerStreak: 0, fanLag: FAN_RECOVERY_LAG }));
      const atk = next.noteStates?.[e.attackerId];
      if (toVictor > 0 && atk) {
        next = act(next, fansChanged(e.attackerId,
          { casuals: Math.min(FAN_CASUAL_CAP, (atk.casuals ?? 0) + toVictor) }));
      }
      // The rest go loose on the centre for whoever plays there next. See
      // `HARNESS_GAPS.unsurePoolLatency` — this box is the harness's copy of a
      // client slice, and `playTurn` folds it into `view` at turn start.
      crowd.unsure += toUnsure;
      return next;
    },

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
// ⚠️ EXPORTED SO A TEST CAN ASSERT AGAINST THE SET ITSELF rather than against a
// hand-written copy of it. `botTraceCheck` §3 checks that a compose entry only
// ever reports composition kinds; a literal there would agree with itself
// forever if a third kind ever joined this phase.
export const COMPOSITION_KINDS = new Set(['melodyNote', 'stackCommit']);

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
 *
 * ── 🥁 AND THE SPLIT ABOVE HAD A THIRD QUESTION HIDING INSIDE THE FIRST ──────
 *
 * 🎯 THE FINDING, 2026-08-19: **a stack commit was unreachable until the melody
 * line was full.** Measured over 18 headless matches — the step-picker was
 * offered both kinds 455 times and returned a `melodyNote` 455 times, and every
 * commit in the sample landed on a full 8-note track, i.e. only once
 * `melodyNote` had stopped being legal at all. The bots went into 12–15% of
 * their turns with anything in a stack.
 *
 * ⚠️ IT WAS NEVER A JUDGEMENT, IT WAS AN ARRAY ORDER. `beamActions` groups by
 * KIND and emits the groups in first-appearance order; `legalActions` pushes
 * every `melodyNote` before every `stackCommit`; this walk took `[0]`. So the
 * two kinds were never compared — and could not have been, because
 * `makeActionScorer`'s own contract is "higher is better, WITHIN A KIND". There
 * is no cross-kind number in that scorer to compare them with. "Which note" and
 * "note or commit" look like the same question and are not: the first is a
 * ranking inside one kind, the second is a trade between two.
 *
 * 🎯 THE OWNER OF THE THIRD QUESTION IS `evaluate`, FOR THE SAME REASON IT OWNS
 * "HOW MANY". A commit's whole value is what it does to the position, and the
 * position is only legible at a confirm. So each kind's best candidate is now
 * priced at ITS OWN confirm and the better price wins — the same instrument,
 * the same discipline, one question further out.
 *
 * ⚠️ AND THE EVALUATOR ALREADY WANTED THE STACKS. Before the fix, forcing the
 * commits first and pricing both lines through this same evaluator preferred the
 * commits-first line on 231 of 310 turns. This is therefore NOT §5.A's usual
 * shape — no weight was missing, `drive` and `sustain` are in every column of
 * the table. ⚠️ It is a new shape worth naming: **the evaluator was never
 * consulted, because the search could not reach the branch to ask about it.**
 * A term nobody disputes is worth nothing if no line ever carries it.
 *
 * 📌 The mean score deltas were small (−0.085 / +0.115 / +0.195 by Spirit) and
 * one of them is NEGATIVE — when notes-first wins it wins bigger. Read that as
 * "the evaluator prefers stacks three turns in four", not as "commits-first is
 * strictly better". §5's standing warning about sample size applies.
 */
// ⚠️ `limit: 1` AND IT IS STILL NOT A KNOB, but it now means something slightly
// different: one candidate PER KIND, which is exactly the shortlist the
// cross-kind price below has to choose between. The beam is being used for what
// it can do (rank within a kind) and nothing more.
/**
 * 🥁 WHAT ONE CANDIDATE IS WORTH — the line `prefix + cand`, cashed immediately.
 *
 * ⚠️ `-Infinity` MEANS "NOT A TURN YET", NOT "BAD". A `stackCommit` onto an
 * empty melody line has no confirm to be priced at (`legalActions` only offers
 * one with `track.length > 0`), so it scores −∞ and loses to any note. That is
 * the right answer for the right reason: a Spirit who voices a chord and writes
 * no melody has spent its turn on a track it cannot cash. When BOTH candidates
 * come back −∞ the caller keeps the first, which is `beamActions`' source order
 * — i.e. exactly the behaviour that shipped, in the one case where there is
 * nothing to choose on.
 *
 * ⚠️ THE FORKS ARE LABELLED AND THE LABEL CARRIES THE STEP AND THE KIND, which
 * is `expectedScore`'s discipline for the same reason: a fork consumes nothing
 * from its parent, so how many candidates get priced can never move the walk's
 * own dice. Pricing two options must not play a different game from pricing one.
 */
function confirmPrice(state, spiritId, view, ctx, prefix, cur, curView, cand, label) {
  const after = applyBotAction(cur, cand,
    { rng: ctx.rng.fork(label), view: curView, hooks: ctx.hooks });
  if (!after.ok) return -Infinity;
  const confirm = playable(legalActions(after.state, spiritId, after.view ?? curView))
    .find(a => a.kind === 'confirmMelody');
  if (!confirm) return -Infinity;
  // Priced by replaying the WHOLE line from the turn's own start, exactly as the
  // curve below does — not by evaluating `after` in place. `applyBotLine` is
  // atomic and starts from the turn-start `view`, so every price in this
  // function and every point on the curve is taken on the same footing.
  const r = applyBotLine(state, [...prefix, cand, confirm],
    { rng: ctx.rng.fork(`${label}:line`), view, hooks: ctx.hooks });
  if (r.stoppedAt) return -Infinity;
  return evaluate(r.state, spiritId, r.view ?? view).score;
}

function composePhase(state, spiritId, view, ctx, { ranked, trace = null }) {
  const turn = state?.turn?.count ?? 0;
  const probe = ctx.rng.fork(`compose:${turn}`);
  let cur = state, curView = view;
  const prefix = [];
  const curve = [];
  const stepLog = trace ? [] : null;
  const legalKinds = new Set();
  let best = null, bestScore = -Infinity, bestTerms = null;

  for (let i = 0; i <= MELODY_SEARCH_DEPTH; i++) {
    const options = playable(legalActions(cur, spiritId, curView));
    // 🧠 EVERY COMPOSITION KIND THAT WAS EVER ON THE MENU THIS TURN. Recorded
    // because `journalSummary`'s never-chosen sweep is fed by `legalKinds`, and
    // until now the composition phase put nothing in it — which is precisely how
    // the stack bug above stayed invisible to the one column built to catch it.
    for (const a of options) if (COMPOSITION_KINDS.has(a.kind)) legalKinds.add(a.kind);

    // Price THIS track, as committed. `applyBotLine` is atomic, so a refusal
    // anywhere in the line leaves the real state untouched.
    const confirm = options.find(a => a.kind === 'confirmMelody');
    if (confirm) {
      const line = [...prefix, confirm];
      const r = applyBotLine(state, line, { rng: probe, view, hooks: ctx.hooks });
      if (!r.stoppedAt) {
        const ev = evaluate(r.state, spiritId, r.view ?? view);
        // 🧠 THE CURVE — what each track LENGTH was worth, which is the whole
        // argument of this function made visible. §6.3's finding was that a
        // one-ply greedy confirms a ONE-NOTE melody every turn; this is the
        // shape that says whether it still would.
        if (trace) curve.push({ len: prefix.length, score: ev.score });
        if (ev.score > bestScore) { bestScore = ev.score; best = line; bestTerms = ev.terms; }
      }
    }

    const steps = options.filter(a => COMPOSITION_KINDS.has(a.kind));
    if (!steps.length) break;

    // ONE CANDIDATE PER KIND — the beam ranking within each kind, which is the
    // only thing it is entitled to say — then the cross-kind trade priced by
    // `evaluate`. See this function's header for why that split is where it is.
    const cands = ranked
      ? beamActions(steps, { limit: 1, score: makeActionScorer(cur, spiritId, curView) })
      // ⚠️ `unranked` is the A/B CONTROL — the beam's `score` switched off — so it
      // must keep taking the first of each kind in source order. It is NOT a
      // second policy that gets to skip the cross-kind price: the whole value of
      // that control is that it differs from `searcher` in one named place.
      : [...new Map(steps.map(a => [a.kind, a])).values()];

    let pick = null, pickPrice = -Infinity;
    const priced = stepLog ? [] : null;
    for (const cand of cands) {
      const price = confirmPrice(state, spiritId, view, ctx, prefix, cur, curView,
        cand, `compose:${turn}:${i}:${cand.kind}`);
      if (priced) priced.push({ kind: cand.kind, key: traceKey(cand), score: price });
      // Strict `>` keeps a tie on source order, matching `beamActions`' own
      // tie-break — an equal price is not a reason to reorder the kinds.
      if (pick === null || price > pickPrice) { pick = cand; pickPrice = price; }
    }
    if (!pick) break;
    if (stepLog) stepLog.push({ i, took: { kind: pick.kind, key: traceKey(pick) }, cands: priced });

    const r = applyBotAction(cur, pick, { rng: probe, view: curView, hooks: ctx.hooks });
    if (!r.ok) break;
    cur = r.state; curView = r.view ?? curView;
    prefix.push(pick);
  }

  if (trace) {
    // 🧠 WHAT THE CHOSEN LINE ACTUALLY CONTAINED, by kind. `chosen.len` alone
    // cannot tell a track of eight notes from five notes and three commits.
    const chosenKinds = {};
    for (const a of best ?? []) {
      if (COMPOSITION_KINDS.has(a.kind)) chosenKinds[a.kind] = (chosenKinds[a.kind] ?? 0) + 1;
    }
    trace({
      t: 'compose', turn, spiritId,
      curve, steps: stepLog, legalKinds: [...legalKinds], chosenKinds,
      chosen: best ? { len: best.length - 1 } : null,
      score: bestScore, terms: bestTerms,
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
  // 🌀 The dash ends in a Swing, so it is judged on the same dice as one. A
  // deterministic estimate here would price a coin-flip blow as a certainty.
  'psychoBushido',
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
function expectedDetail(state, action, spiritId, view, ctx, samples, wantTerms) {
  let total = 0, n = 0;
  // 🧠 THE TERM VECTOR, AVERAGED THE SAME WAY THE SCORE IS. Off unless a sink
  // asked for it — see the note on `terms` in `searcherPolicy`.
  const sum = wantTerms ? {} : null;
  let termN = 0;
  for (let k = 0; k < samples; k++) {
    const probe = ctx.rng.fork(`search:${state?.turn?.count ?? 0}:${k}`);
    const r = applyBotAction(state, action, { rng: probe, view, hooks: ctx.hooks });
    if (!r.ok) continue;
    // A dead seat is -Infinity by `evaluate`'s own contract. ⚠️ That one value
    // must NOT be averaged — a line that can kill you is not redeemed by five
    // samples where it does not — so it short-circuits the whole estimate.
    if (r.state?.winner === spiritId) { total += WIN_SCORE; n++; continue; }
    const ev = evaluate(r.state, spiritId, r.view ?? view);
    if (!Number.isFinite(ev.score)) return { score: -Infinity, terms: null };
    total += ev.score; n++;
    // ⚠️ A WON SAMPLE CONTRIBUTES NO TERMS, ON PURPOSE. `WIN_SCORE` is a
    // sentinel rather than a weighted sum, so folding it into a term mean would
    // report a position that no row of the weight table describes.
    if (sum) {
      for (const [t, v] of Object.entries(ev.terms ?? {})) sum[t] = (sum[t] ?? 0) + v;
      termN++;
    }
  }
  if (sum && termN) for (const t of Object.keys(sum)) sum[t] /= termN;
  return { score: n ? total / n : -Infinity, terms: termN ? sum : null };
}

/**
 * The number `expectedDetail` exists to produce. Kept as its own name because
 * the audit pass wants the score and nothing else, and a caller that ignores
 * half a return value reads like it forgot to use it.
 */
function expectedScore(state, action, spiritId, view, ctx, samples) {
  return expectedDetail(state, action, spiritId, view, ctx, samples, false).score;
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
function searcherPolicy({ ranked = true, limit = 5, samples = ATTACK_SAMPLES, trace = null, audit = false, faceGuard = true } = {}) {
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

    // 🧭 STANDING STILL, PRICED — the option that was never on the ballot.
    //
    // Every action here is compared against the OTHER actions and never against
    // NOT ACTING, and `endTurn` is a poor stand-in for it because it forfeits the
    // whole remaining AP pool at once. So the bot faced a menu where the cheapest
    // item cost 1 AP and the only way to stop cost 4, and it did the arithmetic
    // correctly: it span. Measured 2026-08-20 — 100% of multi-face runs were a
    // two-facing A→B→A→B oscillation, `endTurn` legal on every step of every one,
    // ending exactly when the AP ran out. 37% of the bots' entire AP budget.
    //
    // ⚠️ AND A FACING TERM MAKES IT WORSE, WHICH IS THE COUNTER-INTUITIVE HALF.
    // `legalActions` excludes the facing you are ALREADY IN ("already looking
    // there"), so the moment turning is worth something there is always an
    // attractive facing you are not in — and the one you just left is the best
    // one again. Adding value to facing added fuel. It went 32.7% → 55.7% of all
    // actions before this guard went in.
    // 📌 `faceGuard: false` is the A/B arm and the regression witness, not a
    // tuning knob — a formula change cannot go through `weightOverrides`, so the
    // honest before/after needs the same script running both arms (the
    // `pressureab.mjs` discipline). It is the only thing that can ever put the
    // spin back, which is why it is a named option rather than a deleted branch.
    const standScore = faceGuard ? evaluate(state, spiritId, view).score : -Infinity;

    let best = null, bestScore = -Infinity;
    const scored = trace ? [] : null;
    for (const action of beamed) {
      const n = STOCHASTIC_KINDS.has(action.kind) ? samples : 1;
      // 🧠 TERMS ONLY WHEN SOMEBODY IS LISTENING. Collecting them costs an object
      // per sample and nothing else — no extra transition, no extra roll — but a
      // 2000-match bench with no sink would allocate several million of them for
      // a reading nobody takes.
      const d = expectedDetail(state, action, spiritId, view, ctx, n, !!trace);
      // 🧭 A GUARDED OPTION IS RECORDED, NOT HIDDEN. It was priced, and it may
      // well have priced HIGHEST — that is the whole point of a dominance guard,
      // and §5.B⁵ built this journal precisely to catch "scored well, never once
      // picked". Dropping it from `considered` would make the guard invisible to
      // the one instrument that could ever question it.
      const skipped = (faceGuard && action.kind === 'face' && !(d.score > standScore))
        ? 'faceGuard' : null;
      if (scored) {
        const row = { kind: action.kind, key: traceKey(action), score: d.score, terms: d.terms };
        if (skipped) row.skipped = skipped;
        scored.push(row);
      }
      // 🧭 THE DOMINANCE GUARD. A `face` changes nothing but the facing and costs
      // a guaranteed 1 AP, so a turn that does not out-score standing there is
      // strictly worse than not turning — and once the bot HAS turned to the best
      // facing, turning back can never clear this bar, because it is paying a
      // second AP to reach a facing it has already priced below the one it is in.
      // That is what makes the oscillation unreachable rather than merely unlikely.
      //
      // ⚠️ SCOPED TO `face` DELIBERATELY, though the argument generalises to any
      // pure-cost action. Every other kind moves something the evaluator can see —
      // a body, a note, a blow — and "did not beat standing still" is a judgement
      // about VALUE there, not the dominance proof it is here. Widening this is a
      // balance change wearing a correctness change's clothes.
      // 📌 Both arms of the bench get it, `unranked` included, so an A/B still
      // isolates the ranking rather than confounding it with this.
      if (skipped) continue;
      if (d.score > bestScore) { bestScore = d.score; best = action; }
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
      // 🧠 THE TERM VECTORS RIDE ONLY ON THE TOP TWO, and that is a size decision
      // rather than a modelling one. The interesting quantity is the DELTA
      // between the winner and the runner-up — that is what a "close call"
      // actually is, and it is the only thing that can name which term decided
      // the turn. Carrying ~20 floats on all twelve priced options would multiply
      // a journal entry by an order of magnitude to answer nothing extra.
      const ranking = scored.slice().sort((x, y) => y.score - x.score);
      const considered = ranking.map((e, i) => (i < 2 ? e
        : { kind: e.kind, key: e.key, score: e.score, ...(e.skipped ? { skipped: e.skipped } : {}) }));
      trace({
        t: 'action', turn: state?.turn?.count ?? 0, spiritId,
        legalKinds: [...new Set(options.map(a => a.kind))],
        legal: options.length, beamed: beamed.length, pruned: options.length - beamed.length,
        considered,
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
  // 🎪 THE UNSURE CROWD comes in off the harness's box and goes back out at the
  // end of the turn — see `HARNESS_GAPS.unsurePoolLatency`. `melodyCommit` reads
  // `view.unsurePool` to size the recruit and `transition.js` writes the
  // decrement back, so the two halves of the pool (fans lost to a demolition,
  // fans won over by a commit) meet here and nowhere else.
  let v = { ...view, fameThisTurn: {}, unsurePool: ctx.crowd?.unsure ?? view.unsurePool ?? 0 };
  const actions = [];
  // 📏 THE MEASUREMENT CHANNEL — see `battleFlow.js`'s EFFECT KINDS. Every Fame
  // grant in the turn drops one entry here saying what was asked for, what the
  // crowd multiplied it to, and what the per-turn cap threw away. ⚠️ The last
  // number is the one that has never been measured: `FAME_PER_TURN_CAP`
  // DISCARDS overflow, so "Fame earned" and "Fame the rules awarded" are two
  // different quantities and only the first was ever visible.
  const ledger = [];
  // 🎤 EVERY DUEL FOUGHT THIS TURN, as the verdict that ended it. ⚠️ A RIFF-OFF
  // COUNTED IS NOT A ROUND 2 REACHED — the same distinction `limelightScores`
  // exists for. Counting `riffOff` actions would report a thriving sudden-death
  // economy on a tree that never escalates, which is exactly the reading §6.6.9
  // had to disprove. `applyBotAction` hands the resolved battle back; this keeps
  // the three fields a payout depends on and drops the charts.
  const duels = [];

  // ⚠️ EVERY EXIT FROM THIS LOOP HAS TO BANK THE POOL, including the stalls —
  // a turn that ends on a refusal still happened, and the fans it scattered are
  // on the floor either way.
  const bank = (r) => { if (ctx.crowd) ctx.crowd.unsure = r.view?.unsurePool ?? ctx.crowd.unsure; return r; };

  for (let i = 0; i < MAX_ACTIONS_PER_TURN; i++) {
    if (cur.winner) return bank({ state: cur, view: v, actions, duels, ledger, stalled: false });

    // ⚠️ A POLICY MAY ANSWER WITH A LINE, NOT JUST A STEP. The composition phase
    // is a plan whose whole payoff lands on its last action (`confirmMelody`),
    // so a policy that could only speak one action at a time could not express
    // it — see `composePhase`. Applied here one at a time regardless, so the
    // refusal check below still sees every action individually.
    const answer = policy(cur, spiritId, v, ctx) ?? { kind: 'endTurn', apCost: 0 };
    const chunk = Array.isArray(answer) ? answer : [answer];
    if (!chunk.length) return bank({ state: cur, view: v, actions, duels, ledger, stalled: true, refused: { reason: 'empty plan' } });

    for (const action of chunk) {
      const before = cur;
      const r = applyBotAction(cur, action, { rng: ctx.rng, view: v, hooks: ctx.hooks });
      if (!r.ok) {
        // ⚠️ A refusal here is a REAL BUG and must not be swallowed. Actions come
        // straight from `legalActions`, so `illegal` means the generator and the
        // transition have drifted — §6's contract, broken. The run reports it
        // rather than quietly ending the turn and averaging the damage away.
        return bank({ state: cur, view: v, actions, duels, ledger, stalled: true, refused: { action, reason: r.reason, detail: r.detail } });
      }
      cur = r.state; v = r.view ?? v;
      actions.push(action);
      if (r.ledger?.length) ledger.push(...r.ledger);
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
      if (action.kind === 'endTurn') return bank({ state: cur, view: v, actions, duels, ledger, stalled: false });
      if (cur.winner) return bank({ state: cur, view: v, actions, duels, ledger, stalled: false });
    }
  }
  return bank({ state: cur, view: v, actions, duels, ledger, stalled: true, refused: { reason: 'turn ceiling' } });
}

// ── One match ───────────────────────────────────────────────────────────────

/**
 * ✅ FULL-LENGTH GAMES BY DEFAULT SINCE 2026-08-18 — and the change is a
 * constraint being RETIRED, not a preference.
 *
 * The bench used to run TWO-LIFE matches on purpose. `grantFame` branched on
 * `startingLives < 3`: under three lives the Fame target crowned outright, and
 * above it a close race summoned an endgame boss the harness could not drive —
 * so a 3-life match could reach the target and then run forever with nothing
 * able to end it. Two lives sidestepped that by construction. The boss was
 * shelved on 2026-08-18 and archived on 2026-09-01, `grantFame` crowns at any
 * number of lives, and there is nothing left to sidestep. The warning that made
 * two lives a cost worth paying, kept because the horizon is still the variable:
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
export function matchConfig(spirits, { startingLives = 3, mode = 'ffa', fameTarget, fameCap,
                                       fameWindowScale,
                                       winCondition, elimination, roundLimit } = {}) {
  // 📏 `fameTarget` / `fameCap` ARE MEASUREMENT INSTRUMENTS AND ARE UNDEFINED BY
  // DEFAULT — see `battleFlow.fameToWin` and `grantFame`. They exist so a bench
  // run can ask what the Fame economy PRODUCES over a fixed horizon, which the
  // ordinary rules make unanswerable: a match ends the moment somebody clears
  // the target, so every distribution is truncated at the finish line, and
  // `FAME_PER_TURN_CAP` throws ~29% of the awards away before anyone can count
  // them. ⚠️ A run with either set is not a game and its win rate means nothing.
  const cfg = { mode, startingLives, spirits: structuredClone(spirits) };
  if (fameTarget != null) cfg.fameTarget = fameTarget;
  if (fameCap    != null) cfg.fameCap    = fameCap;
  // 📏 `fameWindowScale` — how much of the crowd multiplier the per-turn window
  // inherits. 0/undefined is the shipped flat window; see `battleFlow.grantFame`.
  if (fameWindowScale != null) cfg.fameWindowScale = fameWindowScale;
  // 🏆🎸 HOW THE MATCH ENDS — real game axes, NOT instruments. Undefined here
  // means today's game: `makeInitialState` defaults `winCondition:'fame'` and
  // `elimination:'on'`. ⚠️ These are deliberately not built out of `fameTarget`
  // and `maxTurns` (`WIN_CONDITIONS_DESIGN.md` §1): those two carry an explicit
  // "a run with this set is not a game" warning, and shipping the mode on top of
  // them would make the game indistinguishable from a probe.
  if (winCondition != null) cfg.winCondition = winCondition;
  if (elimination  != null) cfg.elimination  = elimination;
  if (roundLimit   != null) cfg.roundLimit   = roundLimit;
  return cfg;
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
export function runMatch({ seed, spirits, policies, view = {}, lives, maxTurns = MAX_TURNS,
                           fameTarget, fameCap, fameWindowScale,
                           winCondition, elimination, roundLimit }) {
  const rng = makeRng(seed >>> 0);
  const config = matchConfig(spirits, { startingLives: lives, fameTarget, fameCap, fameWindowScale,
                                       winCondition, elimination, roundLimit });
  let state = makeInitialState(config, seed >>> 0);
  // 🎪 One box per match, shared by the demolition hook (which fills it) and
  // `playTurn` (which lends it to `view` for the turn and takes it back).
  const crowd = { unsure: 0 };
  const hooks = harnessHooks({ rng, crowd });
  const ctx = { rng, hooks, crowd };

  // ⚠️ THE REAL TREE BY DEFAULT. `legalActions` emits the `skillTarget` family
  // only when handed one (§6a: absent rather than guessed), and until the tree
  // was extracted from the monolith on 2026-08-16 there was nothing to hand it —
  // so every bench match was played on base kits, i.e. blind to every unlock in
  // the game and therefore to the whole of `METALNESS_REWORK_DESIGN.md`.
  // `view.skillById: null` still opts out, deliberately.
  // ✨ `posing: {}` is GONE from here (§6.6.8) — it is engine state now, and
  // leaving a dead copy in `view` would be a second source of truth that only
  // ever agreed by accident.
  let v = { amps: [], shadowHex: null, skillById: SKILL_BY_ID, ...view };
  let turns = 0;
  // 🎤 The duel ledger — see `playTurn`. `round2` is the one that matters: it is
  // the difference between a rule being present and a rule being reachable.
  const duels = { fought: 0, round2: 0, ties: 0, bothPaid: 0, fp: 0, fpRound2: 0 };
  // 🎸 Set by the buzzer, below. Null in a Legend Run, which has no buzzer.
  let verdict = null;
  // ⭐ THE FAME LEDGER — see `fameLedger` on the result, below.
  const fameLedger = {};

  while (!state.winner && turns < maxTurns) {
    if (!state.acting) break;
    const seat = state.acting;
    const policy = policies[seat];
    if (!policy) return { winner: null, turns, duels, reason: 'stalled', anomaly: `no policy for ${seat}` };

    state = startSpiritTurn(state, rng);
    const t = playTurn(state, v, policy, ctx);
    state = t.state; v = t.view;
    turns++;
    for (const e of t.ledger ?? []) {
      if (e.name !== 'fame') continue;
      const row = fameLedger[e.spiritId] ??= {
        grants: 0, silenced: 0, asked: 0, amplified: 0, banked: 0, discarded: 0 };
      row.grants    += 1;
      row.asked     += e.asked ?? 0;
      row.amplified += e.uncapped ?? 0;
      row.banked    += e.granted ?? 0;
      row.discarded += e.clipped ?? 0;
      // A grant the cap ate WHOLE — the crowd screamed and nothing landed at all.
      if ((e.granted ?? 0) === 0) row.silenced += 1;
    }
    for (const d of t.duels ?? []) {
      duels.fought++;
      duels.fp += d.fp ?? 0;
      if (d.round >= 2) { duels.round2++; duels.fpRound2 += d.fp ?? 0; }
      if (d.tie) duels.ties++;
      if (d.bothStrong) duels.bothPaid++;
    }

    if (t.stalled) {
      return { winner: state.winner ?? null, turns, duels, fameLedger, reason: 'stalled', anomaly: t.refused };
    }

    // 🎸 THE BUZZER. Checked here rather than inside `applyTurnEnded` because
    // ending a MATCH is not a turn reducer's job — the reducer closes the round,
    // this reads the clock. The client's turn-end path will call the same two
    // functions, which is the point of them being exported from `battleFlow`
    // rather than written inline: one definition of when the set is over.
    // ⚠️ Legend Run never reaches this — `buzzerReached` is false whenever
    // `winCondition` is not 'rounds'.
    if (!state.winner && buzzerReached(state)) {
      verdict = buzzerVerdict(state);
      if (verdict.winnerId) state = applyAction(state, winnerDeclared(verdict.winnerId), rng);
      break;
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

  // 🎛️ THE RIG AS IT ENDED, per seat — new 2026-08-20 with the workout.
  //
  // ⚠️ WITHOUT THIS THE BENCH CANNOT SEE ITS OWN BIGGEST VARIABLE. Pool size
  // and die size used to be a Db purchase, visible in the skill trace; they are
  // won at the marquee now, and `TRIVIA_BOT_ODDS` therefore sets how loud every
  // bot in the match is (MARQUEE_QUIZ_DESIGN.md §6). A win rate quoted without
  // knowing whether the winner was running 2d6 or 3d8+d6 is not a reading of a
  // policy, it is a reading of who found the marquee.
  const rig = Object.fromEntries(
    (state.spirits ?? []).map(s => [s.id, rigTiers(state.noteStates?.[s.id] ?? {})]));

  return {
    winner: state.winner ?? null,
    turns,
    // 🎸 'buzzer' IS ITS OWN REASON AND IT IS NOT 'turnCap'. A fixed-length match
    // that reaches its round limit ENDED CORRECTLY; `turnCap` means the harness
    // safety net fired and the result is not a game. A probe that folded the two
    // together would count every clean Battle of the Bands as an anomaly.
    // ⚠️ A drawn buzzer (`verdict.tied` non-empty) has NO winner and is still
    // 'buzzer' — the tie is a legitimate ending, not a failure to finish.
    reason: verdict ? 'buzzer' : (state.winner ? 'winner' : 'turnCap'),
    // 🎸 The full standings and WHICH RUNG settled it — see `buzzerVerdict`.
    verdict,
    // 💥 Vibe damage dealt and taken per seat. The tie-break's third rung, and
    // the first damage telemetry this project has had.
    damage: { ...(state.damageLedger ?? {}) },
    fame,
    // ⭐📏 WHAT THE RULES AWARDED vs WHAT ANYBODY KEPT, per seat. `fame` above is
    // the second number only. Every grant in the match reports six fields:
    //   · grants     how many payouts fired
    //   · silenced   how many banked ZERO because the turn window was already full
    //   · asked      the sum before the crowd multiplier
    //   · amplified  ...and after it — `amplified / asked` is the crowd's real
    //                effective multiplier, not the theoretical `FAN_MULT_CAP`
    //   · banked     what actually landed (sums to `fame`)
    //   · discarded  what `FAME_PER_TURN_CAP` threw on the floor
    //
    // ⚠️ `discarded` HAS NEVER BEEN MEASURED IN THIS PROJECT and every Fame
    // number quoted before 2026-09-01 was blind to it. It is the term that says
    // whether the cap is a safety rail nobody touches or a wall the economy is
    // already flat against — and PROGRESSION_REWRITE_DESIGN §8 wants to add a
    // whole new fan source on top of it.
    fameLedger,
    limelightScores,
    duels,
    rig,
    // 🎪 How many marquee questions were drawn all match — the denominator
    // for every rig number above. `rig` reports where a Spirit ENDED, and
    // atrophy means that is not where they peaked.
    marquees: (state.board?.usedTrivia ?? []).length,
    // 🎤 THE CROWD AS IT ENDED, per seat, plus what is loose on the centre.
    //
    // ⚠️ NEW 2026-09-01 WITH THE FAN HOOKS, and it is the denominator for every
    // Fame number above it: fans MULTIPLY Fame (`crowdMultiplier`, up to
    // `FAN_MULT_CAP` 2.0×). A win rate quoted without knowing whether the winner
    // was playing to six Diehards or to nobody is a reading of the crowd, not of
    // the policy — the same warning `rig` carries, in the other economy.
    fans: Object.fromEntries((state.spirits ?? []).map(s => [s.id, {
      diehards: state.noteStates?.[s.id]?.diehards ?? 0,
      casuals:  state.noteStates?.[s.id]?.casuals ?? 0,
      mult: crowdMultiplier(
        state.noteStates?.[s.id]?.diehards ?? FAN_DIEHARD_START,
        state.noteStates?.[s.id]?.casuals ?? 0,
        (state.noteStates?.[s.id]?.assignments ?? []).length),
    }])),
    unsure: crowd.unsure,
    // 💰 UNSPENT Db AND WHAT IT BOUGHT, per seat — added 2026-08-20 with the
    // tree deletion. MARQUEE_QUIZ_DESIGN.md §7 parks a known hole: the rig branch
    // was the largest sink in the game and nothing replaced it yet, so Db is
    // expected to pile up. This is the number that says how badly, instead of
    // leaving it as a worry in a doc.
    db: Object.fromEntries((state.spirits ?? []).map(s => [s.id, {
      unspent: state.noteStates?.[s.id]?.dbPoints ?? 0,
      bought:  (state.noteStates?.[s.id]?.unlockedSkills ?? []).length,
    }])),
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
export function runBench({ seeds, spirits, a = 'searcher', b = 'unranked', opts = {}, view, lives,
                           maxTurns, fameTarget, fameCap, fameWindowScale,
                           winCondition, elimination, roundLimit }) {
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

    const r = runMatch({ seed: seeds[i], spirits, policies, view, lives, maxTurns, fameTarget, fameCap,
                         fameWindowScale, winCondition, elimination, roundLimit });
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
