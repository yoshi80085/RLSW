// ─── ACTION SCORING ─────────────────────────────────────────────────────────
// `makeActionScorer(state, spiritId, view) -> (action) => number`
// BOT_STRATEGY_HANDOFF §6.3 — the `score` the beam shipped without.
//
// `beamActions` has been in since 2026-08-14 with `score = null`, which means
// every beam taken so far has been "keep the first `limit` of each kind". §6.3
// names that exactly: **an unranked beam is just the first 5.** It was survivable
// while the branch counts were small. It stopped being survivable the moment the
// 🐙 Tentacle landed — `legalActions` emits every (rival × trail-origin) pair, so
// a long trail pushes real options off the end of an arbitrary list, and the
// searcher meant to evaluate the ability would be judging five arbitrary
// tentacles. `METALNESS_REWORK_DESIGN.md` §6 called this out in advance and
// `SEQUENCING.md` made step 4 a CO-REQUISITE of step 3 because of it.
//
// PURE and DETERMINISTIC. No rng, no React, no mutation. The beam runs inside
// the search, so a scorer that drew from the rng would burn cursor draws inside
// a hypothetical — §0.4's silent-desync failure — and a scorer that read the
// clock would break the §6.6 determinism regression intermittently.
//
// ── ⚠️ THE ONE THING TO UNDERSTAND BEFORE READING ANY NUMBER BELOW ──────────
// **THESE SCORES ARE ONLY EVER COMPARED WITHIN A KIND.** `beamActions` groups by
// `kind` FIRST and ranks inside each group, so nothing here is calibrated
// against anything in another group and no attempt has been made to make it so.
// A `move` scoring 41 and a `swing` scoring 3 says nothing whatsoever about
// whether to walk or hit. Two consequences worth stating plainly:
//
//   · **DO NOT sum, average or compare these across kinds**, and do not feed
//     them to anything that will. If a caller ever wants "which kind", that is
//     `evaluate.js` on the resulting positions, not this.
//   · **A constant is a perfectly good score** for a kind that emits at most one
//     action (`confirmMelody`, `slime`, `slide`, `eleven`, `pose`, `endTurn`).
//     Zero here means "nothing to rank", not "worthless".
//
// ── AND WHAT THIS IS NOT ────────────────────────────────────────────────────
// **It is not the evaluator, and it must never grow into one.** Its only job is
// to decide what SURVIVES to be searched; `evaluate.js` decides what is good.
// The distinction is not academic — this scorer looks at an action in isolation,
// with no idea what the position looks like after it, which is precisely the
// framing §6.2 says `evaluate` exists to replace. Anything here that starts
// wanting to know the resulting state is a sign the logic belongs in the search.
//
// Nor does it own LEGALITY. Scoring an action zero is not a veto — `legalActions`
// decides what may happen, and a scorer that quietly floored an option class to
// keep it out of the beam would be smuggling a rule into a place tuning cannot
// see it, which is the exact failure that file's header exists to prevent.
//
// ── HOW THE TUNING IS PRESERVED ─────────────────────────────────────────────
// §6.3's instruction is "wire the existing planners in as the `score` function
// so their tuning is preserved". Taken literally: every ranking below CALLS a
// shipped planner rather than re-deriving its preference.
//
//   `move` / `face`   → `botHexScore` on the ctx `botPlanMove` builds
//   attack targets    → `botTargetOrder` (`botPickTarget` is its head)
//   `melodyNote`      → `botNoteStepOrder` (`botPlanNoteStep` is its head)
//   `stackCommit`     → `botPlanStackCommit`'s own plan
//   `skillTarget`     → `botPickSkillTarget`'s priority order
//
// Three of those were choosers that threw their ordering away at the last line
// (§6.1: "a chooser cannot be searched"). They have been promoted to rankers in
// `bot.js` with the chooser kept as the head, so there is one comparator per
// decision and not two — a forked preference would look correct right up until
// somebody retuned only one copy.

import { HEX_BY_NUM } from "../../board/hexMap.js";
import { beamActions } from "./legalActions.js";
import {
  BOT_PERSONALITIES, BOT_SPIRIT_SKILLS, BOT_SKILL_PRIORITY_BASE,
  botHexScore, botMoveCtx, botTargetOrder, botNoteStepOrder, botPlanStackCommit,
} from "./bot.js";
import { stackCapFor } from "../../data/gameConstants.js";
import { MELODY_MAX } from "./legalActions.js";
import { styleGain } from "../../music/spiritStyle.js";
import { SPIRIT_DEFS } from "../../data/spirits.js";

// ── The neutral seat ────────────────────────────────────────────────────────

/**
 * The persona used when the caller supplies none.
 *
 * ⚠️ FLAT ON PURPOSE, AND `note: null` IS THE LOAD-BEARING FIELD. Defaulting to
 * a real persona would hand a scorer with no opinion the Maestro's cadence hunt
 * or the Mosh Lord's tritone appetite and call it neutrality — a character
 * choice smuggled in as a fallback. With `note: null`, `botNoteStepOrder` skips
 * both style branches and lands on its own default ending (the fifth, then the
 * fourth), which is the closest thing to "no persona" that function has.
 *
 * The move weights are 1.0 across the board for the same reason: `botHexScore`
 * multiplies every term by one of them, so ones leave its shipped magnitudes
 * exactly as written.
 *
 * 📌 This is a BEAM default, not a bot. `evaluate.js` is the persona
 * replacement (§5); a live bot passes its assigned persona through `view`.
 */
export const NEUTRAL_PERSONA = {
  name: 'Neutral', emoji: '⚖️', note: null,
  blurb: 'no opinion — the beam default, not a playable personality.',
  move: { center: 1, rival: 1, token: 1, spotlight: 1, edgeFear: 1, rear: 1, rearFear: 1 },
  skillOrder: [],
};

/** Accept a persona key, a persona object, or nothing at all. */
export function resolvePersona(persona) {
  if (!persona) return NEUTRAL_PERSONA;
  if (typeof persona === 'string') return BOT_PERSONALITIES[persona] ?? NEUTRAL_PERSONA;
  return persona.move ? persona : NEUTRAL_PERSONA;
}

// ── Ranking helpers ─────────────────────────────────────────────────────────

/**
 * Turn a best-first list into a lookup of DESCENDING POSITIVE scores, with
 * everything absent scoring 0.
 *
 * ⚠️ THE FLOOR AT ZERO IS THE WHOLE TRICK, and it is what keeps the beam
 * deterministic. Unranked actions all collapse to the same value, so
 * `beamActions`' index tie-break puts them in SOURCE ORDER rather than in
 * whatever order a partial preference implied. And because every ranked entry
 * scores at least 1, a ranked action always outranks an unranked one — "the
 * planner had no opinion about this" reads as last, never as best.
 */
// ── 🪦 THE RIFF LADDER — ADDED AND RETIRED THE SAME DAY, 2026-08-17 ─────────
//
// `riffProgress` scored a candidate note by how much closer it brought the track
// to one of 34 named-tune triggers, and it worked: the bot went from **0 riffs
// in 1,218 commits** to 5–6 a match, matches went from 89 rounds ending in
// knockouts to 25 rounds ending on Fame, and the stall rate hit 0%.
//
// ⚠️ IT IS GONE BECAUSE THE MECHANIC IS GONE, NOT BECAUSE IT FAILED. The riff
// library was retired as a design decision — the tunes were not rock, and the
// Fame came from the note DRAW rather than from a decision. See
// `systems/melodyCommit.js` for the full reasoning.
//
// 🧭 **KEEP THE SHAPE, IT IS THE REUSABLE PART.** Whatever scores per-Spirit
// STYLE next — a gallop, a tritone, a Spirit-appropriate cadence — needs exactly
// this structure, and these were the four decisions worth re-making:
//
//   · IT BELONGS IN THE SCORER, NOT `evaluate`. A payoff that lands AT the
//     commit is already visible to `evaluate`; what is missing is anything that
//     values a track one note AWAY from it, so the searcher never steers there.
//     §6.3: the scorer picks WHICH note, `evaluate` picks HOW MANY.
//   · SCORE THE GAIN, not the absolute position — a note is worth what it ADDS.
//   · KEEP A NOISE FLOOR. Any two notes spell some interval; a one-rung match
//     fires on nearly every note and drowns the shipped planners in noise.
//   · A TARGET YOU CANNOT REACH MUST NOT STEER. `MELODY_MAX` is 8; a shape
//     needing four more notes with two slots left is a distraction, and scoring
//     it small does not help — a small score still steers.
//
// The full version is in git; `RIFF_RANK_STRIDE`'s job (dominate the note rank,
// leave the planners as the tie-break) is the one number worth copying.

function rankMap(order) {
  const m = new Map();
  const n = order.length;
  order.forEach((key, i) => { if (!m.has(key)) m.set(key, n - i); });
  return m;
}

/**
 * 🐙 How far a tentacle rank has to outrun a reach penalty.
 *
 * The two are combined as `rank * TENTACLE_RANK_STRIDE - reach`, i.e. WHO you
 * hit strictly dominates HOW MUCH ROAD IT COSTS, and reach only ever separates
 * two ways of hitting the same rival. Any stride above the longest trail the
 * game can produce does that; 1000 is absurdly clear of it and needs no upkeep
 * if the trail lifetime is ever retuned.
 *
 * ⚠️ CHEAPER REACH WINS TIES, and it is worth being explicit that this is a
 * claim about the design and not an arbitrary sign. §4a: the trail reached
 * THROUGH is consumed, so two origins that reach the same rival differ only in
 * how much of the road survives — and the survivor is the Slam's fuel and the
 * next Slide's floor (§3's one meter). The doc's counter-case, "the longer reach
 * is sometimes the better play, because it strikes from a different angle", is
 * real but shows up as a DIFFERENT TARGET SET, which the rank term already
 * separates. Nothing here removes the long reach from `legalActions`; it is
 * ranked below its cheaper twin, which is a different thing.
 */
export const TENTACLE_RANK_STRIDE = 1000;

/**
 * 🎭 How far a STYLE gain has to outrun the note planners' own preference.
 *
 * ✅ THE RIFF LADDER'S SHAPE, REBUILT ON THE THING THAT REPLACED IT. The ladder
 * retired above worked — 0 riffs in 1,218 commits became 5–6 a match — and the
 * comment kept four decisions worth re-making. All four are honoured here:
 *
 *   · IT LIVES IN THE SCORER, NOT `evaluate`. The style payout lands AT the
 *     commit, where `evaluate` can already see it in the fans. What nothing can
 *     see is a track ONE NOTE AWAY from a gesture, because that state pays
 *     nothing yet. §6.3: the scorer picks WHICH note, `evaluate` picks HOW MANY.
 *   · IT SCORES THE GAIN, not the absolute position — `styleGain`.
 *   · IT HAS A NOISE FLOOR. `STYLE_GAIN_FLOOR` below.
 *   · A TARGET THAT CANNOT FIT MUST NOT STEER, and scoring it small does not
 *     help because a small score still steers. `styleProgress` drops unreachable
 *     gestures outright, given the slots left.
 *
 * ⚠️ THE STRIDE DOMINATES, THE PLANNERS TIE-BREAK, and that ordering is the
 * whole design. `botNoteStepOrder` ranks up to ~11 stock slots, so a stride
 * above that guarantees a note completing a gesture outranks every note that
 * does not — while two notes with the SAME style gain still fall back to the
 * shipped musical judgement rather than to source order.
 */
export const STYLE_RANK_STRIDE = 40;

/**
 * The smallest style gain worth steering on.
 *
 * ⚠️ IT SITS JUST BELOW A THIRD, AND THE FIRST VERSION SAT JUST ABOVE IT — which
 * silently switched the whole ladder off for five gestures out of six. Every
 * gesture in `spiritStyle.js` climbs in thirds (0 → ⅓ → ⅔ → 1), so a floor of
 * 0.34 admitted only the one gesture that happened to move in halves. Measured
 * over 536 commits: that gesture landed 180 times and the other five landed
 * 11-19 times each, which read as "the Ronin's style is hard" rather than as a
 * dead comparison.
 *
 * 📌 The floor still has a job — it is what keeps a gain of exactly zero from
 * being strided — and the noise it was originally written against is now handled
 * where it belongs, by making every gesture's progress 0 until real pattern
 * material is on the track. A guard in the consumer was papering over a
 * definition problem in the source.
 */
export const STYLE_GAIN_FLOOR = 0.3;

// ── The scorer ──────────────────────────────────────────────────────────────

/**
 * Build the `score` function for one Spirit's turn.
 *
 * ⚠️ BUILT ONCE PER STATE, NOT PER ACTION, and the shape is the reason: the
 * planners it wraps each read the whole board to produce ONE ordering, and a
 * beam calls `score` once per branch. Rebuilding the target order inside every
 * call would re-sort the rivals for every tentacle origin on the list.
 *
 * @param {object} state     engine GameState
 * @param {string} spiritId  the acting Spirit
 * @param {object} [view]    the same client-owned slices `legalActions` takes,
 *                           plus `persona` (key or object) if the caller has one
 * @returns {(action:object)=>number} higher is better, WITHIN A KIND
 */
export function makeActionScorer(state, spiritId, view = {}) {
  const persona = resolvePersona(view.persona);
  const self = (state?.spirits ?? []).find(s => s.id === spiritId);
  const ns   = state?.noteStates?.[spiritId] ?? {};
  const def  = SPIRIT_DEFS[spiritId] ?? {};

  // A seat that is not on the board has no opinion about anything. Returning a
  // flat scorer rather than throwing keeps the beam's contract intact: it
  // degrades to source order, which is exactly what it did before this file.
  if (!self) return () => 0;

  const ctx  = botMoveCtx(state, self, persona);
  const here = HEX_BY_NUM[self.num];

  // ── Attack targets. Ranked ONCE for the whole turn, from where the Spirit
  // actually stands.
  //
  // ⚠️ INCLUDING FOR THE TENTACLE, WHICH LOOKS WRONG AND IS NOT. The arm strikes
  // from a trail hex, so the instinct is to re-rank per origin — but the rear
  // wedge is resolved in `combat.js` off the ATTACKER'S OWN HEX, and the tentacle
  // never moves him (§4a: "he stays where he is, facing where he was"). Ranking
  // per origin would invent a flanking bonus the resolver does not pay.
  const rivals = (state?.spirits ?? []).filter(s => s.id !== spiritId && !s.knockedOut);
  const targetRank = rankMap(
    botTargetOrder(rivals, state?.noteStates ?? {}, self.num).map(r => r.id)
  );

  // ── Melody notes, keyed by the stock index the action carries.
  const noteRank = rankMap(botNoteStepOrder(ns, persona).order);

  // 🎭 The track as it stands, and how many slots are left after it. Read HERE
  // rather than inside `score` because the scorer is rebuilt per composition
  // step (see the note below), so this is already the current track — and
  // re-reading it per candidate would be the same lookup twenty times over.
  const track     = ns.melodyLine ?? [];
  const slotsLeft = Math.max(0, MELODY_MAX - track.length - 1);

  // 📌 The scorer is rebuilt PER COMPOSITION STEP, not per turn — `composePhase`
  // calls `makeActionScorer(cur, …)` inside its loop with the state after each
  // note. Nothing here reads the growing track today, but anything scoring the
  // SHAPE of a melody-in-progress (the style system) depends on that, and it is
  // the first thing to check if such a term ever seems stuck on its first rung.

  // ── Stack commits. The plan names (note, dest) pairs, so that is the key.
  //
  // ⚠️ THE KEY IS THE NOTE, NOT THE STOCK INDEX, because that is all the planner
  // knows. Two stock slots holding the same pitch therefore tie — and tie
  // correctly: they are the same commit as far as the stacks are concerned, and
  // `beamActions` breaks the tie on source order.
  const commitPlan = botPlanStackCommit(
    ns, spiritId, persona,
    self.vibe ?? def.maxVibe ?? 5,
    self.maxVibe ?? def.maxVibe ?? 5,
    stackCapFor(ns.unlockedSkills ?? []),
  );
  const commitRank = rankMap(commitPlan.map(c => `${c.dest}:${c.note}`));

  // ── Skill unlocks, in `botPickSkillTarget`'s exact priority order: the
  // Spirit's exclusive route first, then the persona's ladder, then the base.
  // That function returns the first ELIGIBLE id; here the whole list is ranked
  // and eligibility is left where it belongs, in `legalActions`.
  const skillRank = rankMap([
    ...(BOT_SPIRIT_SKILLS[spiritId] ?? []),
    ...(persona.skillOrder ?? []),
    ...BOT_SKILL_PRIORITY_BASE,
  ]);

  return function score(action) {
    switch (action?.kind) {
      // ── COMPOSITION ─────────────────────────────────────────────────────
      // 🎭 STYLE FIRST, THE MUSICIAN SECOND. A note that closes one of this
      // Spirit's own gestures outranks every note that does not; among notes
      // that are equal on style — which is most of them — `botNoteStepOrder`'s
      // shipped judgement decides, exactly as before.
      case 'melodyNote': {
        const base = noteRank.get(action.stockIdx) ?? 0;
        const gain = styleGain(spiritId, track, action.note, slotsLeft);
        // ⚠️ `gain` is quantised to tenths before it is strided, so two notes
        // that close a shape by the same amount land on the SAME rung and fall
        // through to the planner's tie-break — which is the whole point of
        // having a stride rather than just adding a float.
        return gain >= STYLE_GAIN_FLOOR
          ? base + Math.round(gain * 10) * STYLE_RANK_STRIDE
          : base;
      }

      case 'stackCommit':
        return commitRank.get(`${action.dest}:${action.note}`) ?? 0;

      // ── BOARD ───────────────────────────────────────────────────────────
      // Walking re-faces you down the direction of travel, so the destination
      // decides the rear wedge as well as the position — `botHexScore` already
      // scores both halves of that trade, which is why it can take the hex.
      case 'move': {
        const to = HEX_BY_NUM[action.to];
        return (ctx && to) ? botHexScore(to, ctx) : 0;
      }

      // 🔪 A `face` is the SAME scorer with the position held and only the
      // facing varied — `botHexScore` reads `ctx.selfFacing` on exactly the
      // branch where the hex is the one you are already standing on. Every
      // other term is constant across facings, so they cancel within the kind
      // and what remains is the rear-wedge trade this action exists to make.
      case 'face':
        return (ctx && here) ? botHexScore(here, { ...ctx, selfFacing: action.facing }) : 0;

      // ── VIOLENCE ────────────────────────────────────────────────────────
      // 🎤 `riffOff` ranks here because it IS an attack — the same button as the
      // Sonic, the same 2 AP, the same "which rival" question. WHETHER to duel at
      // all is `evaluate`'s, on the position after it, and `beamSetup` is the
      // term that sees one coming.
      // ⚠️ The comment sits ABOVE the group rather than between two cases: a
      // comment between empty `case` labels reads as a fall-through to eslint.
      case 'swing':
      case 'sonic':
      case 'smash':
      case 'riffOff':
        return targetRank.get(action.targetId) ?? 0;

      // 🐙 WHO you hit, then how much road it costs. See TENTACLE_RANK_STRIDE.
      case 'tentacle':
        return (targetRank.get(action.targetId) ?? 0) * TENTACLE_RANK_STRIDE
             - (action.reach ?? 0);

      // 🌀 The Blaster pierces, so it carries a LIST and `legalActions` emits at
      // most one of them per state. It is ranked anyway rather than constant:
      // the day a second geometry makes two blasters legal in one turn, the beam
      // should already prefer the one that catches the better rival, and the
      // best rival in the line is the honest read of a shot that hits all of them.
      case 'blaster':
        return (action.targetIds ?? []).reduce((best, id) => Math.max(best, targetRank.get(id) ?? 0), 0);

      // ── DB ──────────────────────────────────────────────────────────────
      // 🎯 Renamed from `skillUnlock` 2026-08-16 — the action is choosing what to
      // SAVE FOR, not buying. The ranking is unchanged: `botPickSkillTarget`'s
      // order was always a saving order, which is why the rename cost nothing here.
      case 'skillTarget':
        return skillRank.get(action.skillId) ?? 0;

      // ── THE SINGLETONS ──────────────────────────────────────────────────
      // `confirmMelody`, `slime`, `slide`, `eleven`, `pose`, `endTurn` — at most
      // one of each is ever legal in a given state, so there is no ordering to
      // express and a constant is the honest answer. ⚠️ NOT a judgement that
      // they are worthless: nothing is ever dropped from a group of one, whatever
      // it scores. Read the header.
      default:
        return 0;
    }
  };
}

/**
 * The whole §6.3 step in one call: rank, then narrow.
 *
 * Convenience only — it composes `makeActionScorer` with `beamActions` and adds
 * no policy of its own. Callers that already hold a scorer (a search reusing one
 * across a ply, say) should keep calling `beamActions` directly.
 */
export function beamFor(state, spiritId, actions, view = {}, opts = {}) {
  return beamActions(actions, { ...opts, score: makeActionScorer(state, spiritId, view) });
}
