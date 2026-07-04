// ─── ENGINE REDUCER ──────────────────────────────────────────────────────────
// applyAction(state, action, rng) → new state. THE one door into game-rule
// changes. Pure: no timers, no DOM, no Math.random (draw via `rng` only —
// its {seed,cursor} is written back into the returned state so the caller
// never has to thread rng bookkeeping by hand).
//
// Presentation delays live in the client: the client *waits*, then
// dispatches the transition action (e.g. BEAM_CLASH_RESOLVED). The reducer
// never schedules anything.

import { GAME_INIT } from "./actions.js";
import { restoreRng } from "./rng.js";

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

function reduce(state, action, _rng) {
  switch (action.type) {
    case GAME_INIT:
      return state;

    // Phase 2+: MOVE, END_TURN, … land here, delegating to systems/ modules.

    default:
      // Unknown action = a bug (client/server version skew or a typo').
      // Loud in dev, lenient in replay: return state unchanged.
      console.warn(`[engine] unknown action type: ${action.type}`);
      return state;
  }
}
