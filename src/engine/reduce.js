// ─── ENGINE REDUCER ──────────────────────────────────────────────────────────
// applyAction(state, action, rng) → new state. THE one door into game-rule
// changes. Pure: no timers, no DOM, no Math.random (draw via `rng` only —
// its {seed,cursor} is written back into the returned state so the caller
// never has to thread rng bookkeeping by hand).
//
// Presentation delays live in the client: the client *waits*, then
// dispatches the transition action (e.g. BEAM_CLASH_RESOLVED). The reducer
// never schedules anything.

import {
  GAME_INIT,
  TURN_STARTED, TURN_ENDED, TURN_SKIPPED,
  MOVE_BUDGET_SET, MOVE_STEP, BEATS_SPENT, SPIRIT_WARPED, SPIRITS_SYNCED,
  SPIRIT_FACED, SPIRIT_ELIMINATED,
  RIFF_OFF_STARTED, RIFF_RESULTS_SUBMITTED, RIFF_RESOLVED,
  RIFF_ROUND2_STARTED, RIFF_CLOSED,
  ATTACK_ROLLED,
} from "./actions.js";
import { restoreRng } from "./rng.js";
import {
  applyTurnStarted, applyTurnEnded, applyTurnSkipped,
  applyMoveBudgetSet, applyBeatsSpent, applySpiritsSynced,
  applySpiritEliminated,
} from "./systems/turn.js";
import { applyMoveStep, applySpiritWarped, applySpiritFaced } from "./systems/movement.js";
import { applyAttackRolled } from "./systems/combat.js";
import {
  applyRiffOffStarted, applyRiffResultsSubmitted, applyRiffResolved,
  applyRiffRound2Started, applyRiffClosed,
} from "./systems/riffOff.js";

/**
 * @param {object} state   plain-JSON GameState (never mutated)
 * @param {object} action  { type, ...payload } (plain JSON)
 * @param {function} [rng] seeded rng; defaults to one restored from state.rng
 * @returns {object} next GameState
 */
export function applyAction(state, action, rng = restoreRng(state.rng)) {
  const next = reduce(state, action, rng);
  // Persist rng position so the next applyAction resumes the same stream.
  return { ...next, rng: rng.state() };
}

function reduce(state, action, rng) {
  switch (action.type) {
    case GAME_INIT:       return state;

    // ── Phase 2: turn & movement ──
    case TURN_STARTED:    return applyTurnStarted(state, action);
    case TURN_ENDED:      return applyTurnEnded(state);
    case TURN_SKIPPED:    return applyTurnSkipped(state);
    case MOVE_BUDGET_SET: return applyMoveBudgetSet(state, action);
    case MOVE_STEP:       return applyMoveStep(state, action, rng);
    case BEATS_SPENT:     return applyBeatsSpent(state, action);
    case SPIRIT_WARPED:   return applySpiritWarped(state, action);
    case SPIRIT_FACED:    return applySpiritFaced(state, action);
    case SPIRIT_ELIMINATED: return applySpiritEliminated(state, action);
    case SPIRITS_SYNCED:  return applySpiritsSynced(state, action);

    // ── Phase 4: riff-off ──
    case RIFF_OFF_STARTED:       return applyRiffOffStarted(state, action, rng);
    case RIFF_RESULTS_SUBMITTED: return applyRiffResultsSubmitted(state, action);
    case RIFF_RESOLVED:          return applyRiffResolved(state);
    case RIFF_ROUND2_STARTED:    return applyRiffRound2Started(state, action, rng);
    case RIFF_CLOSED:            return applyRiffClosed(state);

    // ── Phase 3b: combat rolls ──
    case ATTACK_ROLLED:          return applyAttackRolled(state, action, rng);

    default:
      // Unknown action = a bug (client/server version skew or a typo).
      // Loud in dev, lenient in replay: return state unchanged.
      console.warn(`[engine] unknown action type: ${action.type}`);
      return state;
  }
}
