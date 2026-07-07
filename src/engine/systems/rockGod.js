// ─── ENGINE SYSTEM: ROCK GOD (Phase 6c) ──────────────────────────────────────
// First 6c slice: the god's ATTACK PICK — the boss fight's rules-rng — rolls on
// the engine's seeded rng instead of Math.random. The client still owns the
// god's live object (HP, telegraph, winded, timer — they migrate later); it
// passes the pick CONTEXT (godId + lastAttackId, the ATTACK_ROLLED pattern) and
// reads the decided attack id off `state.rockGod.lastPick`. Taunt lines stay
// client Math.random — pure log flavor, never GameState.

import { ROCK_GODS, pickGodAttack } from "../../data/rockGods.js";

/**
 * GOD_ATTACK_PICKED { godId, lastAttackId } — weighted draw over the god's
 * attack deck (no immediate repeat) on engine rng. Report:
 * `state.rockGod.lastPick { godId, attackId }` (null if the god is unknown or
 * has an empty deck).
 */
export function applyGodAttackPicked(state, { godId, lastAttackId = null }, rng) {
  const def = ROCK_GODS[godId];
  const pick = def ? pickGodAttack(def, lastAttackId, rng) : null;
  return {
    ...state,
    rockGod: { ...(state.rockGod ?? {}), lastPick: pick ? { godId, attackId: pick.id } : null },
  };
}
