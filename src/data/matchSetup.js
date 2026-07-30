// ─── MATCH SETUP HELPERS ─────────────────────────────────────────────────────
// Pure builders that turn a roster choice into the `spirits` array a match
// starts from. Extracted from Lobby so the title menu can launch Testing
// Grounds directly without dragging the whole lobby along for the ride.

import { SPIRIT_DEFS, PLAYABLE_ORDER } from "./spirits.js";
import { CORNERS, CORNER_LABELS, CORNERS_ORDER } from "./corners.js";
import { cornerFacing } from "../board/boardHelpers.js";

// A 2-player match uses opposite corners so the Spirits face each other down
// the board rather than sharing an edge. Anything larger walks the ring.
export function cornersForCount(n) {
  if (n === 2) return ["blue", "red"];
  return CORNERS_ORDER.slice(0, n);
}

/** Place one Spirit def at a corner: home hex, facing, corner colour. */
export function seatSpirit(def, corner, { cpu = false } = {}) {
  const { homeNum } = CORNERS[corner];
  return {
    ...def,
    num: homeNum,
    facing: cornerFacing(homeNum),
    corner,
    color: CORNER_LABELS[corner].color,
    cpu,
  };
}

/**
 * 🧪 TESTING GROUNDS — the dev sandbox. Seats every PLAYABLE Spirit (one per
 * corner, seat 0 human, the rest CPU) and flips testMode on.
 *
 * Spirits still in development are excluded on purpose: dropping a half-built
 * kit into the sandbox produces bug reports about a character that was never
 * finished, which is noise, not signal.
 */
export function buildTestingGroundsConfig({ beginnerMode = true } = {}) {
  const ids = PLAYABLE_ORDER;
  const corners = cornersForCount(Math.max(2, Math.min(4, ids.length)));
  const spirits = corners.map((corner, i) =>
    seatSpirit(SPIRIT_DEFS[ids[i % ids.length]], corner, { cpu: i !== 0 }));
  return {
    spirits,
    mode: "ffa",
    teams: null,
    startingLives: 3,
    testMode: true,
    beginnerMode,
  };
}
