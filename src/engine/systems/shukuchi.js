// ─── ENGINE SYSTEM: 🌀 SHUKUCHI ARPEGGIO ─────────────────────────────────────
//
// 縮地 — "shrinking the earth": the step that crosses ground without covering
// it. An arpeggio is one chord played as separate notes in sequence, and that is
// the movement — one distance, taken as three strikes of the foot.
//
// Spec: `RONIN_ABILITY_DESIGN.md` §2.5 and §2.5.0.
//
// ⭐ IT IS A MOVEMENT MODE, NOT A MOVEMENT TURN. The 2026-09-04 sketch said
// Shukuchi *was* the movement turn — spend the turn, get six hexes. Alex's rule
// bills each hop at 1 AP out of the SAME `moveStepsLeft` pool as walking, the
// Swing and Bushido. That is the whole balance of the ability: three hops is a
// Bushido he did not throw, so it competes with his turn instead of sitting
// outside it.
//
// ⚠️ ONLY THE LANDING HEX HAS TO BE CLEAR. The hop passes OVER bodies, hazards,
// walls and 🐙 the slime trail (Alex, §2.5.2 #1). That is deliberately a hard
// counter to area denial, and the accepted brake is the AP bill — NOT a hazard
// exception, because a Shukuchi that stops at slime is walking with a Db cost
// and §2.5.1 says that ability has no reason to exist.
//
// ⚠️ AND THE HOP RE-FACES HIM, LIKE WALKING — not like the warp. `applyMoveStep`
// turns a Spirit down its direction of travel; `applySpiritWarped` deliberately
// does not. This follows *walking*, because a hop that let him keep his old
// facing would hand him the free half of the Bushido setup: land beside a rival
// while still aimed down the lane he came from. He ends facing where he last
// jumped, and re-aiming costs a `face` like it does for anybody else.

import { HEX_BY_NUM, ALL_HEXES } from "../../board/hexMap.js";
import { axialDist, facingAngle } from "../../board/hexGeometry.js";
import { canFire } from "./cooldowns.js";
import {
  SHUKUCHI_HOP_RINGS, SHUKUCHI_MAX_HOPS, SHUKUCHI_AP_PER_HOP,
} from "../../data/gameConstants.js";

/** The skill id, in one place — four files gate on it. */
export const SHUKUCHI_SKILL = 'shukuchi';

/**
 * Hops still available to `ns` THIS TURN without re-firing the ability.
 *
 * 📌 `0` means "not currently mid-Shukuchi", which is also what a fresh sheet
 * and a new turn both carry. There is no separate "active" flag on purpose: an
 * active-flag plus a counter is two fields that can disagree, and a counter on
 * its own cannot.
 */
export function shukuchiHopsLeft(ns) {
  return Math.max(0, (ns?.shukuchiHopsLeft ?? 0));
}

/** True when the NEXT hop is the one that pays the Db and starts the clock. */
export function hopIsActivation(ns) {
  return shukuchiHopsLeft(ns) === 0;
}

/**
 * Can this sheet take a Shukuchi hop right now, ignoring AP and the board?
 *
 * Two ways in, and they are not the same question:
 *   · mid-move — `shukuchiHopsLeft > 0`, already paid for, clock already running
 *   · a fresh activation — `canFire` (off cooldown AND able to afford the Db)
 *
 * ⚠️ THE CONTINUATION MUST NOT ASK `canFire`. The first hop starts a 3-round
 * cooldown, so a second hop that re-checked readiness would find the ability
 * recharging and refuse — and the ability would be a 2-hex blink that advertised
 * three. That is the whole reason the budget lives on the sheet.
 */
export function canHop(ns) {
  if (!(ns?.unlockedSkills ?? []).includes(SHUKUCHI_SKILL)) return false;
  return shukuchiHopsLeft(ns) > 0 || canFire(ns, SHUKUCHI_SKILL);
}

/**
 * Every hex `spiritId` may land on with one hop.
 *
 * `blocked` is the set of hex numbers a body already occupies — rivals, amps and
 * the 👤 decoy. ⚠️ It is consulted ONLY on the landing hex. Nothing between the
 * two hexes is looked at, and that absence is the ability.
 *
 * @returns {number[]} hex numbers, ascending — a stable order, so a searcher
 *   walking them is deterministic across runs (`BOT_STRATEGY_HANDOFF` §0.4).
 */
export function shukuchiLandings(state, spiritId, blocked = new Set()) {
  const self = (state?.spirits ?? []).find(s => s.id === spiritId);
  const from = self && HEX_BY_NUM[self.num];
  if (!from) return [];
  return ALL_HEXES
    .filter(h => !blocked.has(h.num)
              && axialDist(from.q, from.r, h.q, h.r) === SHUKUCHI_HOP_RINGS)
    .map(h => h.num)
    .sort((a, b) => a - b);
}

/**
 * SHUKUCHI_HOPPED — one hop: position, facing, the AP, and nothing else.
 *
 * ⚠️ IT DOES NOT PAY THE Db, START THE COOLDOWN, OR SPEND THE HOP BUDGET. All
 * three live on the note sheet, which this reducer cannot reach, so the caller
 * pairs it with `firePatch` and `hopBudgetPatch` — exactly as `transition.js`
 * already does for Bushido. The split is deliberate: a reducer that wrote to two
 * slices would be the only one in the file that did.
 *
 * 📌 Refuses an off-board target by returning the state unchanged, matching
 * `applyMoveStep`'s `if (!to) return` rather than inventing a second convention.
 */
export function applyShukuchiHop(state, { spiritId, toNum }) {
  const sp = state.spirits.find(s => s.id === spiritId);
  const from = sp && HEX_BY_NUM[sp.num];
  const to = HEX_BY_NUM[toNum];
  if (!sp || !from || !to) return state;

  const facing = facingAngle(from, to);
  const stepsLeft = Math.max(0, state.turn.moveStepsLeft - SHUKUCHI_AP_PER_HOP);
  return {
    ...state,
    spirits: state.spirits.map(s =>
      s.id !== spiritId ? s : { ...s, num: toNum, facing }),
    turn: {
      ...state.turn,
      moveStepsLeft: stepsLeft,
      lastMove: {
        spiritId, from: sp.num, to: toNum, facing,
        redirected: false, requestedTo: toNum, stepsLeft,
        // 📌 The one field `move` does not set. A hop and a walk are otherwise
        // the same shape on `lastMove`, and the client will want to know which
        // it is drawing without re-deriving it from the distance.
        shukuchi: true,
      },
    },
  };
}

/**
 * The note-sheet patch for the hop budget, given the sheet BEFORE the hop.
 *
 * ⚠️ Returns the budget ONLY. The Db and the cooldown are `firePatch`'s job, and
 * the caller spreads both together — one place that knows a hop is sometimes an
 * activation, rather than two places that must agree about when.
 */
export function hopBudgetPatch(ns) {
  return {
    shukuchiHopsLeft: hopIsActivation(ns)
      ? SHUKUCHI_MAX_HOPS - 1
      : shukuchiHopsLeft(ns) - 1,
  };
}
