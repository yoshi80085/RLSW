// ─── ENGINE SYSTEM: TURN ─────────────────────────────────────────────────────
// Turn queue, beats (AP), limelight tracking, turn/round counters (Phase 2).
// The many END-TURN *ticks* (debuffs, burn, fans, stage FX, Rock God, spawns)
// still run in React — they join the engine with their slices in Phases 5–6.
// TURN_ENDED writes `turn.lastReport` so the client knows what to run:
//   { type, endedId, nextId, limelightHeld, roundCompleted }

import { advanceTurnQueue } from "../../board/boardHelpers.js";
import { LIMELIGHT_HEX } from "../../data/gameConstants.js";

/** TURN_STARTED — record whether the spirit begins its turn on the Limelight hex. */
export function applyTurnStarted(state, { spiritId }) {
  const sp = state.spirits.find(s => s.id === spiritId);
  return {
    ...state,
    turn: {
      ...state.turn,
      startedOnLimelight: {
        ...state.turn.startedOnLimelight,
        [spiritId]: !!sp && sp.num === LIMELIGHT_HEX,
      },
    },
  };
}

/** MOVE_BUDGET_SET — melody commit grants steps; tripped halves them (min 1). */
export function applyMoveBudgetSet(state, { steps, tripped }) {
  const granted = tripped ? Math.max(1, Math.floor(steps / 2)) : steps;
  return { ...state, turn: { ...state.turn, moveStepsLeft: granted } };
}

/** BEATS_SPENT — combat actions pay AP; most also exhaust the action token. */
export function applyBeatsSpent(state, { n = 0, all = false, exhaustToken = false }) {
  return {
    ...state,
    turn: {
      ...state.turn,
      moveStepsLeft: all ? 0 : Math.max(0, state.turn.moveStepsLeft - n),
      actionTokenUsed: exhaustToken ? true : state.turn.actionTokenUsed,
    },
  };
}

/** TURN_ENDED — limelight verdict, counters, per-turn resets, queue advance. */
export function applyTurnEnded(state) {
  const endedId = state.acting;
  const sp = state.spirits.find(s => s.id === endedId);
  const limelightHeld =
    !!sp && sp.num === LIMELIGHT_HEX && !!state.turn.startedOnLimelight[endedId];

  const count = state.turn.count + 1;
  const alive = state.spirits.filter(s => !s.knockedOut).length;
  const roundCompleted = alive > 0 && count % alive === 0;

  const turnQueue = advanceTurnQueue(
    state.turnQueue, state.spirits, state.config.mode, state.config.teams);
  const nextId = turnQueue[0] ?? null;

  return {
    ...state,
    turnQueue,
    acting: nextId,
    turn: {
      ...state.turn,
      count,
      moveStepsLeft: 0,
      actionTokenUsed: false,
      lastMove: null,
      lastReport: { type: "turnEnded", endedId, nextId, limelightHeld, roundCompleted },
    },
  };
}

/**
 * TURN_SKIPPED — knock-down recovery skip: queue advances but NO end-of-turn
 * ticks fire and the turn counter does NOT advance (matches old behavior).
 */
export function applyTurnSkipped(state) {
  const endedId = state.acting;
  const turnQueue = advanceTurnQueue(
    state.turnQueue, state.spirits, state.config.mode, state.config.teams);
  const nextId = turnQueue[0] ?? null;
  return {
    ...state,
    turnQueue,
    acting: nextId,
    turn: {
      ...state.turn,
      lastMove: null,
      lastReport: { type: "turnSkipped", endedId, nextId, limelightHeld: false, roundCompleted: false },
    },
  };
}

/** SPIRIT_ELIMINATED — out of lives: removed from the turn queue for good. */
export function applySpiritEliminated(state, { spiritId }) {
  const turnQueue = state.turnQueue.filter(id => id !== spiritId);
  return {
    ...state,
    turnQueue,
    acting: turnQueue.includes(state.acting) ? state.acting : (turnQueue[0] ?? null),
  };
}

/**
 * SPIRITS_SYNCED — TEMPORARY Phase 2 bridge. Combat / KO / respawn / knockback
 * still live in React and mutate spirit fields the engine doesn't govern yet.
 * The client syncs the full spirits array into the engine before actions that
 * read spirit state (move, endTurn, skip). Remove in Phase 3 when combat joins
 * the engine and the engine's spirits become the single source of truth.
 */
export function applySpiritsSynced(state, { spirits }) {
  return { ...state, spirits };
}
