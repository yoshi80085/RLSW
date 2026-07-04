// =============================================================================
// board/rockGodFx.js — 🤘 ROCK GOD boss-fight board geometry (pure, no React)
// -----------------------------------------------------------------------------
// Hex math for the Rock God engine: AoE rings, the Power Slide line, and the
// Mosh Command shove. Damage/state live in the main file's ROCK GOD SYSTEM.
// =============================================================================
import { HEX_BY_NUM, HEX_BY_QR, ALL_HEXES } from "./hexMap.js";
import { axialDist, axialNeighbors } from "./hexGeometry.js";

// All hex nums within `radius` of a hex (excluding the hex itself).
export function hexesWithin(num, radius) {
  const hub = HEX_BY_NUM[num];
  if (!hub) return [];
  return ALL_HEXES
    .filter(h => h.num !== num && axialDist(h.q, h.r, hub.q, hub.r) <= radius)
    .map(h => h.num);
}

// POWER SLIDE — the god charges in a straight axial line toward a target,
// sliding until the stage edge. Returns { path:[hexNums crossed], end:hexNum }.
export function slideLine(fromNum, towardNum) {
  const from = HEX_BY_NUM[fromNum], toward = HEX_BY_NUM[towardNum];
  if (!from || !toward) return { path: [], end: fromNum };
  // Choose the axial step that closes the distance fastest (first slide hex).
  const steps = axialNeighbors(from.q, from.r)
    .map(({ q, r }) => HEX_BY_QR[`${q},${r}`])
    .filter(Boolean)
    .map(h => ({ h, d: axialDist(h.q, h.r, toward.q, toward.r) }))
    .sort((a, b) => a.d - b.d);
  if (!steps.length) return { path: [], end: fromNum };
  const first = steps[0].h;
  const dq = first.q - from.q, dr = first.r - from.r;
  const path = [];
  let q = from.q, r = from.r, end = fromNum;
  for (let i = 0; i < 12; i++) {              // hard cap; the board is 13 cols wide
    q += dq; r += dr;
    const hex = HEX_BY_QR[`${q},${r}`];
    if (!hex) break;                          // slid to the edge of the stage
    path.push(hex.num);
    end = hex.num;
  }
  return { path, end };
}

// MOSH COMMAND — where a spirit gets shoved: the free neighbour hex furthest
// from the god. Returns a hexNum, or null if boxed in (they eat damage instead).
export function shoveAwayHex(spiritNum, godNum, occupiedNums = []) {
  const here = HEX_BY_NUM[spiritNum], god = HEX_BY_NUM[godNum];
  if (!here || !god) return null;
  const occ = new Set(occupiedNums);
  const options = axialNeighbors(here.q, here.r)
    .map(({ q, r }) => HEX_BY_QR[`${q},${r}`])
    .filter(Boolean)
    .filter(h => !occ.has(h.num) && h.num !== godNum)
    .map(h => ({ h, d: axialDist(h.q, h.r, god.q, god.r) }))
    .sort((a, b) => b.d - a.d);
  const hereD = axialDist(here.q, here.r, god.q, god.r);
  return options.length && options[0].d > hereD ? options[0].h.num : null;
}

// The nearest living spirit to a hex (for slide targeting / face-melter).
export function nearestSpiritTo(num, spirits) {
  const hub = HEX_BY_NUM[num];
  const live = spirits.filter(s => !s.knockedOut);
  if (!hub || !live.length) return null;
  return live
    .map(sp => ({ sp, h: HEX_BY_NUM[sp.num] }))
    .filter(x => x.h)
    .sort((a, b) => axialDist(a.h.q, a.h.r, hub.q, hub.r) - axialDist(b.h.q, b.h.r, hub.q, hub.r))[0]?.sp ?? null;
}

// A free neighbour hex for a spirit displaced by the god's arrival.
export function freeNeighborHex(num, occupiedNums = []) {
  const here = HEX_BY_NUM[num];
  if (!here) return null;
  const occ = new Set(occupiedNums);
  const options = axialNeighbors(here.q, here.r)
    .map(({ q, r }) => HEX_BY_QR[`${q},${r}`])
    .filter(Boolean)
    .filter(h => !occ.has(h.num));
  return options.length ? options[Math.floor(Math.random() * options.length)].num : null;
}
