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
