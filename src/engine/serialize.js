// ─── ENGINE SERIALIZE ────────────────────────────────────────────────────────
// Snapshot/restore for GameState. Trivial because GameState is plain JSON by
// contract — this module exists so every save/send/replay goes through one
// door that can validate + version-migrate later.

import { applyAction } from "./reduce.js";
import { restoreRng } from "./rng.js";

/** GameState → JSON string. */
export function snapshot(state) {
  return JSON.stringify(state);
}

/** JSON string → GameState. Throws on schema mismatch (add migrations here). */
export function restore(json) {
  const state = JSON.parse(json);
  if (state.schema !== 1) {
    throw new Error(`[engine] unknown GameState schema: ${state.schema}`);
  }
  return state;
}

/**
 * Replay an action log from an initial state. The determinism proof:
 * replay(snapshotOfStart, log) must equal the live final state, byte for
 * byte. (Phase 8 turns this into an automated test.)
 */
export function replay(initialState, actionLog) {
  let state = initialState;
  for (const action of actionLog) {
    state = applyAction(state, action, restoreRng(state.rng));
  }
  return state;
}
