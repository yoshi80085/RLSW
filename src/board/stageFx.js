// =============================================================================
// board/stageFx.js — 🎇 STAGE EFFECTS geometry helpers (pure, no React)
// -----------------------------------------------------------------------------
// Board math for the four board Stage Effects (see data/stageEffects.js for
// tuning + the threshold/deck rules). Everything here is a pure function of the
// hex map — activation, ticking, and damage live in the main file.
// =============================================================================
import { HEX_BY_NUM, HEX_BY_QR, ALL_HEXES, EDGE_HEX_NUMS } from "./hexMap.js";
import { axialDist, axialNeighbors } from "./hexGeometry.js";
import { LIMELIGHT_HEX } from "../data/gameConstants.js";

// ── 💨 SMOKE — all hex nums within `radius` rings of the Limelight ───────────
export function smokeHexNums(radius) {
  const hub = HEX_BY_NUM[LIMELIGHT_HEX];
  if (!hub) return [];
  return ALL_HEXES
    .filter(h => axialDist(h.q, h.r, hub.q, hub.r) <= radius)
    .map(h => h.num);
}
export function hexInSmoke(hexNum, radius) {
  const h = HEX_BY_NUM[hexNum], hub = HEX_BY_NUM[LIMELIGHT_HEX];
  return !!(h && hub && axialDist(h.q, h.r, hub.q, hub.r) <= radius);
}

// ── 🔺 LASERS — diagonal beam lines across the board ─────────────────────────
// A beam follows one of the two DIAGONAL hex axes: constant r, or constant
// s (= −q−r). (Constant q would be a vertical column — not club-laser enough.)
// Returns [{ axis, val, hexes:[nums] }] with hexes ordered along the line.
export function rollLaserBeams(count) {
  const byR = {}, byS = {};
  ALL_HEXES.forEach(h => {
    (byR[h.r] ??= []).push(h);
    (byS[-h.q - h.r] ??= []).push(h);
  });
  const lines = [];
  const collect = (axis, groups) => {
    Object.entries(groups).forEach(([val, hs]) => {
      if (hs.length >= 6) {   // only lines long enough to cross the stage
        const sorted = [...hs].sort((a, b) => a.q - b.q);
        lines.push({ axis, val: Number(val), hexes: sorted.map(h => h.num) });
      }
    });
  };
  collect('r', byR);
  collect('s', byS);
  const picked = [];
  const pool = [...lines];
  while (picked.length < count && pool.length) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}
export function hexInBeams(hexNum, beams) {
  return !!beams?.some(b => b.hexes.includes(hexNum));
}

// ── 🎆 PYRO — random hexes to prime, avoiding the previous wave ──────────────
export function rollPyroHexes(count, excludeNums = []) {
  const excl = new Set(excludeNums);
  const pool = ALL_HEXES.filter(h => !excl.has(h.num)).map(h => h.num);
  const out = [];
  for (let i = 0; i < count && pool.length; i++) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

// ── 🤖 ANIMATRONICS ──────────────────────────────────────────────────────────
// Spawn on random UNOCCUPIED outer-edge hexes.
export function spawnAnimatronics(count, turns, occupiedNums = []) {
  const occ = new Set(occupiedNums);
  const pool = [...EDGE_HEX_NUMS].filter(n => !occ.has(n));
  const bots = [];
  for (let i = 0; i < count && pool.length; i++) {
    const num = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    bots.push({ key: `anim-${Date.now()}-${i}`, num, turnsLeft: turns });
  }
  return bots;
}

// One chase step toward the nearest living Spirit.
// Returns { move: hexNum|null, hitId: spiritId|null } — if the nearest Spirit is
// already adjacent (or the best step lands on one), the bot lunges instead:
// it stays put and `hitId` takes the Vibe damage.
export function animatronicStep(fromNum, spirits, blockedNums = []) {
  const here = HEX_BY_NUM[fromNum];
  const targets = spirits.filter(s => !s.knockedOut);
  if (!here || !targets.length) return { move: null, hitId: null };

  let best = null;
  targets.forEach(sp => {
    const h = HEX_BY_NUM[sp.num];
    if (!h) return;
    const d = axialDist(here.q, here.r, h.q, h.r);
    if (!best || d < best.d) best = { sp, h, d };
  });
  if (!best) return { move: null, hitId: null };
  if (best.d <= 1) return { move: null, hitId: best.sp.id };  // adjacent — SLAM

  const blocked = new Set(blockedNums);
  const spiritByHex = new Map(targets.map(sp => [sp.num, sp.id]));
  const options = axialNeighbors(here.q, here.r)
    .map(({ q, r }) => HEX_BY_QR[`${q},${r}`])
    .filter(Boolean)
    .filter(h => !blocked.has(h.num));
  if (!options.length) return { move: null, hitId: null };

  const scored = options
    .map(h => ({ h, d: axialDist(h.q, h.r, best.h.q, best.h.r) }))
    .sort((a, b) => a.d - b.d);
  const bestD = scored[0].d;
  const ties = scored.filter(o => o.d === bestD);
  const step = ties[Math.floor(Math.random() * ties.length)].h;

  // Best step lands ON a Spirit → slam them, don't enter the hex.
  if (spiritByHex.has(step.num)) return { move: null, hitId: spiritByHex.get(step.num) };
  return { move: step.num, hitId: null };
}
