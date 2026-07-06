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

// ─── PHASE 8b: JSON-SAFETY GUARD ─────────────────────────────────────────────
// `snapshot` is `JSON.stringify`, which LOSES data silently: Infinity/NaN → null,
// `undefined` keys + Set/Map are dropped, class instances flatten. That's a hole
// in the determinism proof — a bad value survives `snapshot(a) === snapshot(b)`
// (both stringify to the same lossy bytes) while a live object and its restored
// twin actually diverge. This walker makes that impossible to introduce silently:
// it throws on the first value that wouldn't round-trip through JSON, naming the
// exact path. It is a DEV/TEST assertion (walks the tree) — call it in selftest
// and, if desired, behind a dev flag before a save; NOT on every snapshot in prod.
//
// Allowed: null, finite number, string, boolean, plain object, array.
// Rejected: undefined, NaN/Infinity, function, symbol, bigint, Date, Set/Map/
// WeakSet/WeakMap, and any class instance (prototype not Object.prototype/null).
export function assertJsonSafe(value, path = "state") {
  const t = typeof value;

  if (value === null || t === "string" || t === "boolean") return true;

  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`[engine] non-finite number at ${path}: ${value} (JSON.stringify would coerce it to null)`);
    }
    return true;
  }

  if (t === "undefined") {
    throw new Error(`[engine] undefined at ${path} (JSON.stringify would drop this key → live/restored divergence)`);
  }
  if (t === "function" || t === "symbol" || t === "bigint") {
    throw new Error(`[engine] non-JSON ${t} at ${path}`);
  }

  if (Array.isArray(value)) {
    value.forEach((v, i) => assertJsonSafe(v, `${path}[${i}]`));
    return true;
  }

  if (t === "object") {
    if (value instanceof Set || value instanceof Map ||
        value instanceof WeakSet || value instanceof WeakMap) {
      throw new Error(`[engine] ${value.constructor.name} at ${path} — not JSON-safe (convert to a plain array/object; see the usedStockIdx precedent)`);
    }
    if (value instanceof Date) {
      throw new Error(`[engine] Date at ${path} — store an epoch number or ISO string instead`);
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      const name = value.constructor && value.constructor.name;
      throw new Error(`[engine] class instance (${name || "unknown"}) at ${path} — GameState must be plain objects only`);
    }
    for (const k of Object.keys(value)) assertJsonSafe(value[k], `${path}.${k}`);
    return true;
  }

  throw new Error(`[engine] unexpected ${t} at ${path}`);
}
