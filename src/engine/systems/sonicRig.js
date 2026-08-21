// ─── ENGINE SYSTEM: SONIC RIG ────────────────────────────────────────────────
// Pure function that computes the Sonic dice pool AND the rig's live radius
// from a Spirit's note state and position.
//
// Three axes, and after the 2026-08-20 rework not one of them is a purchase:
//
//   Pool size — how many dice you roll   → the marquee quiz (MARQUEE_QUIZ_DESIGN §4)
//   Die size  — d6 → d8                  → the marquee quiz (same card)
//   Radius    — how far the rig reaches  → 🫁 IT BREATHES (SEQUENCING.md §5.H⁶)
//
// Roll is KEEP-HIGHEST: roll the whole pool, best single die is the result.
// Outside your radius you fall back to baseline 1d6 (the Main Amp's board-wide
// floor). chargeBoost adds extra d8s that work anywhere.
//
// 🫁 THE RADIUS RULE, AND WHY IT SPLITS BY WHOSE TURN IT IS
//
//   radius = RIG_RADIUS_FLOOR + (your turn ? Drive stack : Sustain stack).length
//
// ⚠️ THE SPLIT IS NOT DECORATION — IT IS WHERE THE EXISTING GATES ALREADY FELL.
// Every OFFENSIVE read of `inRange` happens on your own turn (can you fire a
// Sonic — `legalActions`) and every DEFENSIVE one happens on somebody else's
// (do you brace on a d6 or scramble a d4 — `attackParams`; can you answer a
// beam with a riff-off — `legalActions` / `evaluate`). So "Drive on your turn,
// Sustain on theirs" does not need a new concept: it hands each gate the stack
// that gate was already about. Stack Drive and you reach further when you act;
// stack Sustain and you are still standing in your own rig when they come for
// you.
//
// ⚠️ AND THE FLOOR IS THE ANTI-SPIRAL, SO DO NOT TUNE IT CASUALLY. Sustain
// frays when you are hit, and a shrinking rig means a smaller defence die means
// a harder hit — that loop is real and §5.H⁶ flags it. FLOOR + a stack of one
// (the root alone, which is what `makeInitialNoteState` seeds) is exactly the
// old tier-0 radius of 4, so the resting state of the game is unchanged and
// only a Spirit who has actually been emptied out drops below it.
//
// See MARQUEE_QUIZ_DESIGN.md §0.1 for the three clocks this file now serves.

import {
  SONIC_BASE_DIE, SONIC_UPGRADED_DIE, RIG_RADIUS_FLOOR,
  RIG_TIER_MAX, RIG_POOL_FLOOR, RIG_ATROPHY_TURNS,
} from "../../data/gameConstants.js";

/**
 * The two workout tiers, read off the note sheet with the floor applied.
 *
 * ⚠️ `rigPool` IS THE OLD AMP TIER AND `rigPower` IS THE OLD POWER TIER — same
 * numbers, same ceiling, different source. Before 2026-08-20 these were counted
 * out of `unlockedSkills` (`amp_1..3` / `power_1..3`); the rungs are gone and
 * the tiers are won at the marquee instead. A sheet from before the change has
 * neither field, so the floor is what it gets: 2d6 in range, which is what
 * `amp_1` used to grant every Spirit for free anyway.
 *
 * ⚠️ POWER CANNOT EXCEED POOL and that is enforced HERE rather than trusted.
 * It used to be the tree's `prereq` gate (Power II needed Amp II); with no tree
 * left it survives as plain arithmetic, and it survives in the one function
 * everything reads through, so no caller can talk itself into an upgrade for a
 * die that does not exist.
 */
export function rigTiers(ns = {}) {
  const pool  = Math.max(RIG_POOL_FLOOR, Math.min(RIG_TIER_MAX, ns.rigPool ?? RIG_POOL_FLOOR));
  const power = Math.max(0, Math.min(RIG_TIER_MAX, ns.rigPower ?? 0, pool));
  return { pool, power };
}

/**
 * The stack the rig is currently running on.
 *
 * @param {object}  ns      the spirit's note state
 * @param {boolean} onTurn  is it this Spirit's turn right now?
 */
export function rigStack(ns = {}, onTurn = false) {
  return (onTurn ? ns.driveStack : ns.sustainStack) ?? [];
}

/**
 * How far this Spirit's rig reaches from home, right now.
 *
 * ⚠️ THERE IS NO LONGER AN INFINITE RADIUS. Range III used to grant `Infinity`
 * — the whole venue. Anything that drew or compared against that (the neon ring
 * in `board/ampDecks.jsx` had a `Number.isFinite` branch for it) is now dealing
 * in ordinary numbers, and a full six-note stack tops out at 9, which is most
 * of the board but never all of it. Being far from home always costs something.
 */
export function rigRadius(ns = {}, onTurn = false) {
  return RIG_RADIUS_FLOOR + rigStack(ns, onTurn).length;
}

/**
 * Compute the Sonic dice pool for a Spirit.
 *
 * @param {object}  ns              the spirit's note state (stacks + tiers)
 * @param {number}  distFromHome    axial distance from the spirit's home hex
 * @param {number}  [chargeBoost=0] extra d8 dice (Charge Zone / "goes to eleven")
 * @param {boolean} [onTurn=false]  is it this Spirit's turn? Picks the stack the
 *   radius breathes on. ⚠️ FALSE IS THE SAFE DEFAULT AND THAT IS DELIBERATE: a
 *   caller who forgets it reads the DEFENSIVE rig, so the failure mode is a
 *   Spirit under-reaching on their own turn — visible, and never a phantom
 *   attack from outside the radius the rules allow.
 * @returns {{ pool: number[], inRange: boolean, radius: number }}
 *   pool    — array of die sizes, e.g. [8, 8, 6, 6]
 *   inRange — whether the spirit is inside their rig's live radius
 *   radius  — that radius, so callers can DRAW it without recomputing the rule
 */
export function sonicRig(ns = {}, distFromHome, chargeBoost = 0, onTurn = false) {
  const { pool: ampT, power: powT } = rigTiers(ns);

  const radius  = rigRadius(ns, onTurn);
  const inRange = distFromHome <= radius;

  // Base pool: 1 die + pool tiers (only counted when in range).
  // The FLOOR tier is the Main Amp — board-wide, so its die survives out of
  // range (everyone sits at 2d6 everywhere, trained or not).
  const size = 1 + (inRange ? ampT : Math.min(ampT, RIG_POOL_FLOOR));

  // Power upgrades: convert d6 → d8 (only in range), plus charge d8s (anywhere)
  const d8s = (inRange ? Math.min(powT, size) : 0) + chargeBoost;

  const pool = Array.from(
    { length: size + chargeBoost },
    (_, i) => i < d8s ? SONIC_UPGRADED_DIE : SONIC_BASE_DIE,
  );

  return { pool, inRange, radius };
}

/**
 * Pretty label for a dice pool: [6,6]→"2d6", [6,6,8]→"2d6+d8", [8,8,8]→"3d8".
 */
export function rigPoolLabel(pool) {
  const counts = {};
  pool.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
  return Object.keys(counts).sort((a, b) => a - b)
    .map(s => `${counts[s] > 1 ? counts[s] : ""}d${s}`).join("+");
}

// ─── 🏋️ THE WORKOUT ─────────────────────────────────────────────────────────
// Won at the marquee (MARQUEE_QUIZ_DESIGN.md §4), lost to neglect (§5).

/**
 * Spend ONE won tier on a track. Returns a patch, or null if the spend is
 * illegal — which the caller should treat as "offer the other track", not as an
 * error worth logging at the player.
 *
 * @param {object} ns     the spirit's note state
 * @param {'pool'|'power'} track
 */
export function rigTierSpend(ns = {}, track) {
  const { pool, power } = rigTiers(ns);
  if (track === 'pool')  return pool  < RIG_TIER_MAX ? { rigPool: pool + 1 } : null;
  if (track === 'power') return power < Math.min(RIG_TIER_MAX, pool) ? { rigPower: power + 1 } : null;
  return null;
}

/** Which tracks can still take a tier right now? For the card, and for bots. */
export function rigSpendable(ns = {}) {
  const { pool, power } = rigTiers(ns);
  return { pool: pool < RIG_TIER_MAX, power: power < Math.min(RIG_TIER_MAX, pool) };
}

/**
 * 🎪 TRAINING RESETS THE CLOCK — this is the patch a correct RIG-lane answer
 * produces, before any tier is spent. Walking onto the marquee and getting it
 * right is what "going back to the gym" means mechanically.
 */
export function rigTrained(_ns = {}) {
  return { rigIdleTurns: 0 };
}

/**
 * 🏋️ ATROPHY, ticked at the start of the OWNER'S turn.
 *
 * ⚠️ POWER SHEDS BEFORE POOL, and the order is load-bearing rather than
 * flavour. `rigTiers` clamps power to pool, so shedding a pool tier first while
 * power was equal to it would silently drop BOTH — one turn of neglect costing
 * two tiers, with only one of them logged. Shedding the upgrade first keeps the
 * invariant true at every step and makes the loss legible: you lose the head
 * before you lose the cabinet.
 *
 * Returns a patch to merge into the sheet, plus what was shed so the caller can
 * say so out loud. A rig already at the floor never atrophies and never ticks.
 *
 * @returns {{ patch: object, shed: 'pool'|'power'|null }}
 */
export function rigAtrophyTick(ns = {}) {
  const { pool, power } = rigTiers(ns);
  if (power === 0 && pool <= RIG_POOL_FLOOR) return { patch: { rigIdleTurns: 0 }, shed: null };

  const idle = (ns.rigIdleTurns ?? 0) + 1;
  if (idle < RIG_ATROPHY_TURNS) return { patch: { rigIdleTurns: idle }, shed: null };

  if (power > 0) return { patch: { rigIdleTurns: 0, rigPower: power - 1 }, shed: 'power' };
  return { patch: { rigIdleTurns: 0, rigPool: pool - 1 }, shed: 'pool' };
}
