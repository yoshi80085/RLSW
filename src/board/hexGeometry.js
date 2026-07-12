// ─── HEX GEOMETRY ─────────────────────────────────────────────────────────────
// Pure geometry helpers extracted from the main file. fanPawnShape (a JSX render
// helper) intentionally stays in the main file; only math/data lives here.
import { HEX_BY_QR } from "./hexMap.js";

export function pointyCorners(cx, cy, size) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i);
    return `${(cx + size * Math.cos(a)).toFixed(1)},${(cy + size * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

// Deterministic per-fan gesture: mostly rest/wave, a fair few horns, the odd
// phone-light (1 in 9) and lighter (1 in 9). Index-keyed so it never flickers.
export const FAN_GESTURES = ['rest','wave','fist','rest','phone','wave','fist','rest','lighter'];
export function fanGesture(i) {
  const n = FAN_GESTURES.length;
  return FAN_GESTURES[((i % n) + n) % n];
}

// ── 🏟️ GRANDSTAND — seat + tier geometry for the corner fan stands ──────────
// The stand faces the board hub. (ox, oy) is the outward unit vector from hub
// through the home corner (the FAN CROWDS block already computes it); the
// perpendicular (-oy, ox) runs along the rows. Row 0 is the front (nearest
// the board); deeper rows step outward by rowGap. Seats fill CENTRE-OUT
// (slot order 0, -1, +1, -2, +2) so a thin crowd huddles mid-stand instead
// of queueing from one end. Pure math, index-keyed — stable across renders.
export function grandstandSeat(i, anchorX, anchorY, ox, oy, seatGap, rowGap, rowLen = 5) {
  const row = Math.floor(i / rowLen), col = i % rowLen;
  const slot = (col % 2 ? -1 : 1) * Math.ceil(col / 2);   // 0,-1,+1,-2,+2
  const pxv = -oy, pyv = ox;
  const along = slot * seatGap, depth = row * rowGap;
  return { row,
    x: anchorX + pxv * along + ox * depth,
    y: anchorY + pyv * along + oy * depth };
}

// One tier platform as an SVG polygon points string. Slight taper with depth
// fakes perspective; the 0.6-seat overhang past the end seats reads as the
// platform edge.
export function grandstandTier(row, anchorX, anchorY, ox, oy, seatGap, rowGap, rowLen = 5) {
  const pxv = -oy, pyv = ox;
  const halfL = (rowLen / 2 + 0.6) * seatGap * (1 - row * 0.04);
  const d0 = row * rowGap - rowGap * 0.42, d1 = row * rowGap + rowGap * 0.42;
  const pt = (along, depth) =>
    `${(anchorX + pxv * along + ox * depth).toFixed(1)},${(anchorY + pyv * along + oy * depth).toFixed(1)}`;
  return `${pt(-halfL, d0)} ${pt(halfL, d0)} ${pt(halfL * 0.96, d1)} ${pt(-halfL * 0.96, d1)}`;
}

export function axialDist(q1, r1, q2, r2) {
  return (Math.abs(q1-q2) + Math.abs(q1+r1-q2-r2) + Math.abs(r1-r2)) / 2;
}

export function axialNeighbors(q, r) {
  return [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]].map(([dq,dr]) => ({ q:q+dq, r:r+dr }));
}

export function facingAngle(fromHex, toHex) {
  const dx = toHex.px - fromHex.px;
  const dy = toHex.py - fromHex.py;
  return Math.atan2(dy, dx);
}

export function getFlatTopNeighborSlots(originHex) {
  return axialNeighbors(originHex.q, originHex.r)
    .map(({q,r}) => HEX_BY_QR[`${q},${r}`])
    .filter(Boolean);
}

export function angleTo(fromHex, toHex) {
  return Math.atan2(toHex.py - fromHex.py, toHex.px - fromHex.px);
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

export function neighborInDirection(originHex, angle) {
  const neighbors = getFlatTopNeighborSlots(originHex);
  return neighbors.reduce((best, nb) => {
    const diff = angleDiff(angle, angleTo(originHex, nb));
    if (!best || diff < best.diff) return { hex: nb, diff };
    return best;
  }, null)?.hex;
}
