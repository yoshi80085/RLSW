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

/**
 * The round clock. A ROUND is one full revolution of the turn order — see the
 * `turn.round` block in state.js for why this is anchored rather than counted.
 * Returns the next anchor and whether play has come back round to it.
 *
 * Elimination closes a round: if the Spirit who opened the revolution is gone
 * from the queue, the rotation they anchored no longer exists, so we bank the
 * round and re-anchor on whoever acts next. (Without this, losing the anchor
 * would mean the board never ticked again.)
 */
function rollRound(state, turnQueue, nextId) {
  const anchor = state.turn.roundStarterId ?? state.turnQueue[0] ?? nextId;
  if (turnQueue.length === 0) return { starter: anchor, completed: false };
  if (!turnQueue.includes(anchor)) return { starter: nextId, completed: true };
  return { starter: anchor, completed: nextId != null && nextId === anchor };
}

/** TURN_ENDED — limelight verdict, counters, per-turn resets, queue advance. */
export function applyTurnEnded(state) {
  const endedId = state.acting;
  const sp = state.spirits.find(s => s.id === endedId);
  const limelightHeld =
    !!sp && sp.num === LIMELIGHT_HEX && !!state.turn.startedOnLimelight[endedId];

  const count = state.turn.count + 1;

  const turnQueue = advanceTurnQueue(
    state.turnQueue, state.spirits, state.config.mode, state.config.teams);
  const nextId = turnQueue[0] ?? null;

  const { starter, completed } = rollRound(state, turnQueue, nextId);
  // A round banked by a skipped turn is spent here.
  const roundCompleted = completed || state.turn.roundPending;
  const round = state.turn.round + (roundCompleted ? 1 : 0);

  return {
    ...state,
    turnQueue,
    acting: nextId,
    turn: {
      ...state.turn,
      count,
      round,
      roundStarterId: starter,
      roundPending: false,
      moveStepsLeft: 0,
      actionTokenUsed: false,
      lastMove: null,
      lastReport: { type: "turnEnded", endedId, nextId, limelightHeld, roundCompleted, round },
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
  // The skip still consumed a slot in the rotation. If that closes the round,
  // BANK it (roundPending) instead of reporting it — no end-of-turn ticks run
  // on a skip, so the board effects are spent by the next real turn end.
  const { starter, completed } = rollRound(state, turnQueue, nextId);
  return {
    ...state,
    turnQueue,
    acting: nextId,
    turn: {
      ...state.turn,
      roundStarterId: starter,
      roundPending: state.turn.roundPending || completed,
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

/**
 * SPIRIT_PATCHED (Phase 5c) — merge a client-computed field patch into ONE
 * spirit (no whitelist: this is the `setSpirits` shim's generic diff action, so
 * it must be able to carry any spirit field). No-op if the spirit id is unknown
 * — the shim only emits patches for the current roster (roster changes fall
 * back to the SPIRITS_SYNCED full replace). Consumes no rng.
 */
export function applySpiritPatched(state, { spiritId, patch = {} }) {
  const sp = state.spirits.find(s => s.id === spiritId);
  if (!sp) return state;
  return {
    ...state,
    spirits: state.spirits.map(s => s.id !== spiritId ? s : { ...s, ...patch }),
  };
}
