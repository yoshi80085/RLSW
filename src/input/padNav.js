// ─── 🎮 THE HIGHLIGHT'S NEXT STOP — pure spatial navigation ─────────────────
// The D-pad moves a highlight between the things a mouse could click
// (`padFocus.js` finds them). This file only answers the geometry: from THIS box,
// pressing Right, which box next? Rects are plain `{ left, top, width, height }`.
//
// ⭐ THE SCORE is measured EDGE TO EDGE, not centre to centre: the gap ahead,
// plus a heavy price (×6, NAV_TUNING.sidePrice) for each px of gap to the side.
// A box that overlaps ours across the press (the next button in a row, the next
// chip in the hand) pays no side price at all, so a row is walked along its row.
// ⚠️ CENTRES WERE TRIED FIRST AND LOST (Controller Lab, 2026-10-14): from a WIDE
// button, the centre of the next button in its own row is far away, so Right
// dropped to a small chip in the row below. Edges don't care how wide a box is.
// ⚠️ "THAT WAY" MEANS REACHING FURTHER: pressing Right, a box must end further
// right than ours does (by `ahead` px) — a chip tucked under a wide button is
// below it, not right of it — and two boxes on one line can't ping-pong.

export const NAV_TUNING = Object.freeze({
  ahead: 4,         // px a box must reach past ours to count as "that way"
  sidePrice: 6,     // each px of side gap costs this many px ahead
  coneSlope: 3,     // a side gap over this × the gap ahead (min 8 px) = not "that way"
});

const centre = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** Score of moving from `from` to `to` pressing `dir`, or Infinity if `to` is not that way. */
export function navScore(from, to, dir, tune = NAV_TUNING) {
  const horiz = dir === 'left' || dir === 'right';
  const fwd = dir === 'right' || dir === 'down';
  // project onto the press axis (a) and across it (b): [start, end] each
  const [fa0, fa1, fb0, fb1] = horiz ? [from.left, from.left + from.width, from.top, from.top + from.height]
    : [from.top, from.top + from.height, from.left, from.left + from.width];
  const [ta0, ta1, tb0, tb1] = horiz ? [to.left, to.left + to.width, to.top, to.top + to.height]
    : [to.top, to.top + to.height, to.left, to.left + to.width];
  const reach = fwd ? ta1 - fa1 : fa0 - ta0;           // how much further it reaches
  const lead = fwd ? (ta0 + ta1) - (fa0 + fa1) : (fa0 + fa1) - (ta0 + ta1);   // centres, ×2
  if (reach <= tune.ahead || lead <= 0) return Infinity;
  const ahead = Math.max(0, fwd ? ta0 - fa1 : fa0 - ta1);
  const side = Math.max(0, tb0 - fb1, fb0 - tb1);
  if (side > Math.max(ahead, 8) * tune.coneSlope) return Infinity;
  // a hair of centre misalignment breaks ties between boxes in the same row
  const skew = Math.abs((tb0 + tb1) - (fb0 + fb1)) / 2;
  return ahead + side * tune.sidePrice + skew * .05;
}

/** Does `to` overlap `from` across the press (same row for ←/→, same column for ↑/↓)? */
export function inLine(from, to, dir) {
  const horiz = dir === 'left' || dir === 'right';
  const [a0, a1, b0, b1] = horiz ? [from.top, from.top + from.height, to.top, to.top + to.height]
    : [from.left, from.left + from.width, to.left, to.left + to.width];
  return Math.min(a1, b1) - Math.max(a0, b0) > 0;
}

/**
 * Index of the best next rect from `from` pressing `dir`, or -1 if nothing lies that way.
 * ⭐ IN LINE FIRST: if anything that way shares our row (or column), the best of
 * THOSE wins, however near a box in the next row is; only with nothing in line
 * does the highlight cut across. 🐛 Found in the Controller Lab, 14 Oct: from a
 * button whose row continued further right, Right hopped UP to a note chip that
 * overlapped it sideways (0 px ahead + a small side price beat 150 px along the row).
 */
export function pickNeighbor(from, rects, dir, tune = NAV_TUNING) {
  let best = -1, bestS = Infinity, bestLined = false;
  rects.forEach((r, i) => {
    if (r === from) return;
    const sc = navScore(from, r, dir, tune);
    if (sc === Infinity) return;
    const lined = inLine(from, r, dir);
    if (lined && !bestLined) { best = i; bestS = sc; bestLined = true; return; }
    if (lined === bestLined && sc < bestS) { best = i; bestS = sc; }
  });
  return best;
}

/** Index of the rect whose centre is nearest a point (where the highlight first lands). */
export function nearestTo(point, rects) {
  let best = -1, bestD = Infinity;
  rects.forEach((r, i) => {
    const c = centre(r), d = Math.hypot(c.x - point.x, c.y - point.y);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}
