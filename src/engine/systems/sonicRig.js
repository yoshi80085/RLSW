// ─── ENGINE SYSTEM: SONIC RIG ────────────────────────────────────────────────
// Pure function that computes the Sonic dice pool from a Spirit's unlocked
// skills and position. Replaces the old board/ampRigs.js chain-counting system.
//
// Three axes:
//   Amp I–III  → pool size (+1 d6 per tier, base 1)
//   Power I–III → die upgrades (d6 → d8, gated behind matching Amp tier)
//   Range I–III → radius from home where the full rig applies
//
// Roll is KEEP-HIGHEST: roll the whole pool, best single die is the result.
// Outside your Range radius you fall back to baseline 1d6 (the Main Amp's
// board-wide floor). chargeBoost adds extra d8s that work anywhere.
//
// See AMP_DECK_DESIGN.md §2 for the full design rationale.

import {
  SONIC_BASE_DIE, SONIC_UPGRADED_DIE, RIG_RADIUS_BY_TIER,
} from "../../data/gameConstants.js";

export const RIG_AMP_IDS   = ["amp_1", "amp_2", "amp_3"];
export const RIG_POWER_IDS = ["power_1", "power_2", "power_3"];
export const RIG_RANGE_IDS = ["range_1", "range_2", "range_3"];

function countOf(unlocked, ids) {
  return ids.filter(id => unlocked.includes(id)).length;
}

/**
 * Compute the Sonic dice pool for a Spirit.
 *
 * @param {string[]} unlockedSkills  the spirit's unlockedSkills array
 * @param {number}   distFromHome    axial distance from the spirit's home hex
 * @param {number}   [chargeBoost=0] extra d8 dice (Charge Zone / "goes to eleven")
 * @returns {{ pool: number[], inRange: boolean }}
 *   pool   — array of die sizes, e.g. [8, 8, 6, 6]
 *   inRange — whether the spirit is inside their rig's effective radius
 */
export function sonicRig(unlockedSkills, distFromHome, chargeBoost = 0) {
  const ampT   = countOf(unlockedSkills, RIG_AMP_IDS);
  const powT   = countOf(unlockedSkills, RIG_POWER_IDS);
  const rangeT = countOf(unlockedSkills, RIG_RANGE_IDS);

  const inRange = distFromHome <= RIG_RADIUS_BY_TIER[rangeT];

  // Base pool: 1 die + amp tiers (only counted when in range)
  const size = 1 + (inRange ? ampT : 0);

  // Power upgrades: convert d6 → d8 (only in range), plus charge d8s (anywhere)
  const d8s = (inRange ? Math.min(powT, size) : 0) + chargeBoost;

  const pool = Array.from(
    { length: size + chargeBoost },
    (_, i) => i < d8s ? SONIC_UPGRADED_DIE : SONIC_BASE_DIE,
  );

  return { pool, inRange };
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
