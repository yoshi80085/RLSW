// ─── ENGINE SYSTEM: STAGE FX (Phase 6b) ──────────────────────────────────────
// The show's board hazards fire at Fame thresholds (⭐8/16/24). The engine owns
// the two replay-critical pieces:
//   deck  — the draw ORDER, shuffled ONCE at makeInitialState on a forked seeded
//           rng ("stageFxDeck") — replaces the client's Math.random mount shuffle.
//   fired — thresholds already fired, in firing order (was the client's firedRef
//           Set; the reducer's dedup gives the same exactly-once guarantee, since
//           dispatch applies synchronously).
// The EFFECTS themselves (smoke spread, laser patterns, pyro hexes, animatronic
// pathing) are still client-run — they migrate in later 6b/6d slices.

/**
 * STAGE_FX_DRAWN { threshold } — a Fame threshold was crossed: record it and
 * draw the next effect off the deck. Duplicate thresholds are a no-op draw
 * (lastDraw: null) so async grant chains can never double-fire a show.
 * Report rides in `state.stageFx.lastDraw { threshold, fxId }`.
 * Deterministic — consumes no rng (the deck order was fixed at init).
 */
export function applyStageFxDrawn(state, { threshold }) {
  const fx = state.stageFx;
  if (!fx) return state;
  if (fx.fired.includes(threshold)) {
    return { ...state, stageFx: { ...fx, lastDraw: null } };
  }
  const fired = [...fx.fired, threshold];
  const fxId = fx.deck[(fired.length - 1) % fx.deck.length];
  return { ...state, stageFx: { ...fx, fired, lastDraw: { threshold, fxId } } };
}
