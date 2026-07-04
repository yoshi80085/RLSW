// ─── ENGINE SYSTEM: COMBAT ───────────────────────────────────────────────────
// Phase 3a: the pure combat MATH — damage/knockback/fame tables — extracted
// verbatim from Game so a server can score battles identically. No actions,
// no state mutation, no timers yet: those land in 3b–3e (rolls → DAMAGE_APPLIED
// → KNOCKBACK_MOVED → KNOCKED_OUT → RETALIATION_*). `Game` imports these the
// same way it imports `riffStats` — single source of truth for the tables.

import {
  UNDERDOG_MIN_DEFICIT, UNDERDOG_DEFICIT_PER_STEP, UNDERDOG_MAX_MULT,
} from "../../data/gameConstants.js";

/**
 * Damage table: battle margin → Vibe damage (softened — wider bands, low
 * ceiling). Used by swing, sonic, smash and the riff-off damage hookup.
 */
export function marginToDamage(margin) {
  if (margin <= 3)  return 1;
  if (margin <= 6)  return 2;
  if (margin <= 9)  return 3;
  if (margin <= 12) return 4;
  return 5;
}

/**
 * Knockback distance in hexes. A Swing defeat always shoves 1; a Sonic defeat
 * scales with margin (1–2 → 1, 3–4 → 2, 5+ → 3, capped at 3).
 * `bs` is the battle-state-shaped object (`{ sonicAttack, margin }`); `margin`
 * may be passed explicitly to override `bs.margin` (matches Game's call sites).
 */
export function knockbackSpaces(bs, margin) {
  const m = margin ?? bs?.margin ?? 1;
  return bs?.sonicAttack ? Math.min(3, Math.max(1, Math.ceil(m / 2))) : 1;
}

/** Base Fame earned for a win, by margin. Bigger margin, bigger legend. */
export function fameFromMargin(margin) {
  if (margin <= 3) return 1;
  if (margin <= 6) return 2;
  return 3;
}

/**
 * 🔥 Underdog / comeback amplifier — pure over the two Fame totals.
 * When the winner was TRAILING the loser by ≥ UNDERDOG_MIN_DEFICIT, the base
 * payout is ramped by the deficit (capped by UNDERDOG_MAX_MULT) and then
 * clamped so a single comeback win never vaults the winner clean PAST the
 * loser — it closes the gap to at most level. Returns `{ fp, deficit, mult }`.
 *
 * The `!loserId`/self-hit guard stays in Game (it owns spirit identity); this
 * fn takes the resolved Fame numbers so it can live in the engine unchanged.
 */
export function underdogBonus(winnerFame, loserFame, baseFp) {
  const deficit = loserFame - winnerFame;      // how far the winner was trailing
  if (deficit < UNDERDOG_MIN_DEFICIT) return { fp: baseFp, deficit: 0, mult: 1 };
  const mult = Math.min(UNDERDOG_MAX_MULT, 1 + (deficit / UNDERDOG_DEFICIT_PER_STEP) * 0.5);
  let fp = Math.round(baseFp * mult);
  const maxFp = Math.max(baseFp, deficit); // never overshoot past the loser
  fp = Math.min(fp, maxFp);
  return { fp, deficit, mult };
}
