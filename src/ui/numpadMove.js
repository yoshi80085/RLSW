// ─── ⌨️ NUMPAD MOVES THE SPIRIT ───────────────────────────────────────────────
// Alex, 2026-09-30: "the numlock numbers can move the spirit. So 8 is up, 2 is
// down, 6 is right, 4 is left, 7, 9, 1, and 3 are diagonal."
//
// ⭐ HIS TWO RULINGS (asked the same day, both the recommended option):
//   1. 4 AND 6 DO NOTHING. The board's hexes are FLAT-TOPPED — every hex has a
//      neighbour straight up and straight down and four on the diagonals, but
//      none directly left or right (`getFlatTopNeighborSlots`). So 8/2 are up
//      and down, 7/9/1/3 the four diagonals, and every press is exactly one
//      legal step or nothing.
//   2. "UP" IS BOARD NORTH, not screen up: 8 always walks toward the top of the
//      board as the top-down view shows it, whatever the camera is doing.
//
// ⚠️ BY `e.code`, NOT `e.key`. The numpad sends `e.key` '1'…'9' with Num Lock on
// and 'ArrowUp'/'Home'/… with it off; `e.code` is 'Numpad8' either way. And the
// top-row digits share `e.key` with the numpad — the Riff-Off's strings are
// '1'…'6' on `e.key` — so a key-based map would walk a Spirit mid-duel.
//
// 📌 Pure: which neighbour a key means. The client decides whether a step is
// legal, through the same `move()` / `onHexClick` a click on a lit hex uses.
import { getFlatTopNeighborSlots, angleTo, angleDiff } from '../board/hexGeometry.js';

// Screen angles (SVG pixels, y DOWN — `hexGeometry.angleTo`), so north is −90°.
// A flat-top neighbour sits at ±30°, ±90° or ±150°; the diagonals here are ±30°
// off the horizontal, not 45°, and that is simply where the hexes are.
const DEG = Math.PI / 180;
export const NUMPAD_DIRS = Object.freeze({
  Numpad8:{ name:'up',         angle:-90 * DEG },
  Numpad2:{ name:'down',       angle: 90 * DEG },
  Numpad9:{ name:'up-right',   angle:-30 * DEG },
  Numpad3:{ name:'down-right', angle: 30 * DEG },
  Numpad7:{ name:'up-left',    angle:-150 * DEG },
  Numpad1:{ name:'down-left',  angle: 150 * DEG },
  // ⭐ Numpad4 / Numpad6 are left out ON PURPOSE — ruling 1 above.
});

/** Is this a key the numpad-move handler owns? (4 and 6 are not.) */
export const isNumpadMove = e => !!e && Object.prototype.hasOwnProperty.call(NUMPAD_DIRS, e.code);

/**
 * The neighbour of `fromHex` a numpad key points at, or null (4/6, another key,
 * or the edge of the board). Matched by angle with a 20° tolerance, so the
 * answer comes from the real board geometry rather than a hand-kept delta table.
 */
export function numpadTarget(code, fromHex) {
  const dir = NUMPAD_DIRS[code];
  if (!dir || !fromHex) return null;
  let best = null, bestD = Infinity;
  for (const n of getFlatTopNeighborSlots(fromHex)) {
    const d = Math.abs(angleDiff(angleTo(fromHex, n), dir.angle));
    if (d < bestD) { bestD = d; best = n; }
  }
  return bestD <= 20 * DEG ? best : null;
}
