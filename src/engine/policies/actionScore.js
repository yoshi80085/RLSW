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
      case 'melodyNote':
        return noteRank.get(action.stockIdx) ?? 0;

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
      case 'swing':
      case 'sonic':
      case 'smash':
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
