// ─── ENGINE SYSTEM: MOVEMENT ─────────────────────────────────────────────────
// Pure movement rules extracted verbatim from Game.move() (Phase 2).
// Client-side hazard/pickup checks (flaming discs, stage FX, tokens, charge
// zones, events) still run in React after the dispatch — they move here in
// Phases 5–6.

import { HEX_BY_NUM } from "../../board/hexMap.js";
import { getFlatTopNeighborSlots, facingAngle } from "../../board/hexGeometry.js";
import { applySlimeDropped } from "./slime.js";
import { SLIME_LIFETIME_TURNS } from "../../data/gameConstants.js";

/**
 * MOVE_STEP — one hex of movement by the acting spirit.
 * Dazed rule (CQC): 33% chance the step is redirected to a random *different*
 * neighbour. `dazed` arrives in the payload until noteStates joins the engine
 * (Phase 5). On an off-board redirect the step is refused: state unchanged
 * except `turn.lastMove = null` (old code `if (!to) return;`).
 */
export function applyMoveStep(state, { spiritId, toNum, dazed }, rng) {
  const sp = state.spirits.find(s => s.id === spiritId);
  if (!sp) return { ...state, turn: { ...state.turn, lastMove: null } };

  let actualTarget = toNum;
  let redirected = false;
  if (dazed && rng.chance(0.33)) {
    const fromHex = HEX_BY_NUM[sp.num];
    const neighbours = fromHex
      ? getFlatTopNeighborSlots(fromHex).filter(n => n.num !== toNum)
      : [];
    if (neighbours.length > 0) {
      actualTarget = rng.pick(neighbours).num;
      redirected = true;
    }
  }

  const from = HEX_BY_NUM[sp.num], to = HEX_BY_NUM[actualTarget];
  if (!to) return { ...state, turn: { ...state.turn, lastMove: null } };

  const facing = facingAngle(from, to);
  const moveStepsLeft = state.turn.moveStepsLeft - 1;
  const moved = {
    ...state,
    spirits: state.spirits.map(s =>
      s.id !== spiritId ? s : { ...s, num: actualTarget, facing }),
    turn: {
      ...state.turn,
      moveStepsLeft,
      lastMove: {
        spiritId, from: sp.num, to: actualTarget, facing,
        redirected, requestedTo: toNum, stepsLeft: moveStepsLeft,
      },
    },
  };

  // 🧪 THE ROAD IS LAID HERE, and moving it here is the point rather than tidying.
  //
  // It used to be a client side effect: `move()` called `dropPoisonSlime` after
  // dispatching, so the engine never saw a hex become road. Two things were wrong
  // with that and only one of them was visible. The visible one was that the
  // client wrote to a React map the engine could not read, so the trail was empty
  // in engine state and every ability built on it was dead. The other is that a
  // SEARCHER stepping through `applyMoveStep` could only ever inherit whatever
  // road already existed at the root — it could not build one, so no line that
  // began "lay road, then use it" was reachable to the bot at all.
  //
  // ⚠️ GATED ON `slimingId`, NOT ON WHO IS MOVING. Slime is an ability now, not a
  // property of being Metalness: walking with it off lays nothing, and the flag —
  // not the Spirit id — is what says otherwise. That is also what keeps the rule
  // expressible if anything else ever oozes.
  //
  // ⚠️ AND IT LAYS `sp.num`, THE HEX HE LEFT — never the one he arrived on. The
  // whole trail API depends on it (`applySpiritSlid`: "path[0] is always a hex he
  // has LEFT, never one he is on"), and a dazed redirect does not break it,
  // because a redirect still steps to a NEIGHBOUR of the hex he vacated.
  if (state.turn.slimingId === spiritId) {
    return applySlimeDropped(moved, {
      spiritId, hexNum: sp.num, turns: SLIME_LIFETIME_TURNS,
    });
  }
  return moved;
}

/** SPIRIT_FACED — turn in place to aim: facing change + step cost (default 1). */
export function applySpiritFaced(state, { spiritId, facing, cost = 1 }) {
  return {
    ...state,
    spirits: state.spirits.map(s =>
      s.id !== spiritId ? s : { ...s, facing }),
    turn: {
      ...state.turn,
      moveStepsLeft: Math.max(0, state.turn.moveStepsLeft - cost),
    },
  };
}

/** SPIRIT_WARPED — teleport (Displace skill): position change + AP cost, no facing change. */
export function applySpiritWarped(state, { spiritId, toNum, cost = 0 }) {
  return {
    ...state,
    spirits: state.spirits.map(s =>
      s.id !== spiritId ? s : { ...s, num: toNum }),
    turn: {
      ...state.turn,
      moveStepsLeft: Math.max(0, state.turn.moveStepsLeft - cost),
    },
  };
}
