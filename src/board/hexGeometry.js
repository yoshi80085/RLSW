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

// ── 🏟️ GRANDSTAND — polar seat + tier geometry for the corner fan stands ────
// The stand is an amphitheater wedge CURVED AROUND THE BOARD HUB: every row is
// an arc centred on the hub, so the front rail keeps a constant gap from the
// board's edge no matter the corner. The square window corner is handled by
// TAPER, not curve — rows shrink 6·5·5·4 into the dead wedge (deepest along
// the corner diagonal, tightest toward the flat window edges). (ox, oy) is
// the outward unit vector hub → home corner; its angle is the stand's
// centreline. Seats fill CENTRE-OUT within each row so a thin crowd huddles
// mid-stand. Pure math, index-keyed — stable across renders.
export const STAND_ROWS = [6, 5, 5, 4];   // seats per row, front rail → back

function standRowCol(i) {
  let row = 0, start = 0;
  for (const n of STAND_ROWS) {
    if (i < start + n) return { row, col: i - start, n };
    start += n; row++;
  }
  return null;
}

// Seat i → { row, x, y }. frontR = radius of row 0 from the hub; seatGap is
// an ARC length (converted per-row to an angle, so seats stay evenly spaced
// even as deeper rows ride bigger radii); rowGap steps rows outward.
export function grandstandSeat(i, hubX, hubY, ox, oy, frontR, seatGap, rowGap) {
  const rc = standRowCol(i);
  if (!rc) return null;
  const { row, col, n } = rc;
  const R = frontR + row * rowGap;
  // Centre-out deal: odd rows 0,-1,+1,-2,+2 — even rows ±0.5,±1.5,±2.5.
  const slot = n % 2
    ? (col % 2 ? -1 : 1) * Math.ceil(col / 2)
    : (col % 2 ? -1 : 1) * (Math.floor(col / 2) + 0.5);
  const a = Math.atan2(oy, ox) + slot * (seatGap / R);
  return { row, x: hubX + R * Math.cos(a), y: hubY + R * Math.sin(a) };
}

// Half angular span of a row's platform (seats + a 0.7-seat overhang).
export function grandstandRowSpan(row, frontR, seatGap, rowGap) {
  const n = STAND_ROWS[row] ?? STAND_ROWS[STAND_ROWS.length - 1];
  const R = frontR + row * rowGap;
  const maxAbs = n % 2 ? Math.floor(n / 2) : (n - 1) / 2;
  return (maxAbs + 0.7) * (seatGap / R);
}

// Arc path (SVG `d`) centred on the hub at radius R, spanning midA ± halfSpan.
// Callers stroke it: wide for tier platforms, thin for edges, glowing for the
// barricade rail. halfSpan < π/2 always → large-arc 0, sweep 1.
export function grandstandArc(hubX, hubY, R, midA, halfSpan) {
  const a0 = midA - halfSpan, a1 = midA + halfSpan;
  const x0 = hubX + R * Math.cos(a0), y0 = hubY + R * Math.sin(a0);
  const x1 = hubX + R * Math.cos(a1), y1 = hubY + R * Math.sin(a1);
  return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R.toFixed(1)} ${R.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
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
