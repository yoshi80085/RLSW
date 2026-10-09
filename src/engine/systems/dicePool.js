// ─── ENGINE SYSTEM: 🎲 DICE POOLS — power → dice, roll, keep the best ─────────
// `CHORD_VOCABULARY_DESIGN.md` §1 + Alex's 2026-09-27 rulings. Pure.
//
//   power → dice   one d6 per point up to DICE_ROLLED_MAX; each point past it
//                  upgrades a d6 to a d8 (the six-note chord's two d8s).
//   roll           every die is thrown — the dropped ones are SHOWN, dimmed.
//   keep           the best `keep` faces count; the Eleven die is always kept.
//
// ⚠️ ONE `rng.int` PER DIE, in pool order, and that is the determinism
// contract: every client replays the same stream, so the throw may never spend
// a second number on a die (the Eleven die spends one `rng.int(ELEVEN_FACES)`).
import {
  DICE_ROLLED_MAX, DICE_KEPT_MAX, ELEVEN_DIE, ELEVEN_FACES, SONIC_BASE_DIE, SONIC_UPGRADED_DIE,
} from "../../data/gameConstants.js";

/** Dice for a power. `ceil` grows every die one size (charge zone), capped at 12. */
export function powerPool(power, { ceil = false } = {}) {
  const p = Math.max(0, Math.floor(power || 0));
  const count = Math.min(DICE_ROLLED_MAX, p);
  const d8s = Math.min(count, Math.max(0, p - DICE_ROLLED_MAX));
  const grow = s => Math.min(12, s + (ceil ? 2 : 0));
  return [...Array(d8s).fill(grow(SONIC_UPGRADED_DIE)), ...Array(count - d8s).fill(grow(SONIC_BASE_DIE))];
}

/** 🔊 Swap the Eleven die in for the weakest die (or add it to an empty pool). */
export function withElevenDie(pool = []) {
  if (!pool.length) return [ELEVEN_DIE];
  const out = [...pool];
  let lo = 0; out.forEach((s, i) => { if (s < out[lo]) lo = i; });
  out[lo] = ELEVEN_DIE;
  return out;
}

/** How many dice a stack keeps: its seats, never more than DICE_KEPT_MAX. */
export const keepForSeats = seats => Math.max(0, Math.min(DICE_KEPT_MAX, Math.floor(seats || 0)));

/** One die. `floor` (charge zone) lifts low faces — never the Eleven die's 1. */
export function rollDie(sides, rng, floor = 0) {
  // ⚠️ The 1 is the LAST face. Comparing against ELEVEN_DIE (the d12 version)
  // would read every face of a d6 as 11 and the die could never fizzle.
  if (sides === ELEVEN_DIE) return rng.int(ELEVEN_FACES) < ELEVEN_FACES - 1 ? 11 : 1;
  return Math.min(sides, Math.max(1 + floor, rng.int(sides) + 1));
}

/**
 * Split a thrown pool into what counts and what is shown dimmed.
 * Kept = the Eleven die (always), then the highest faces; ties keep the
 * earlier throw. Both halves stay in throw order.
 * @returns {{ keptIdx:number[], droppedIdx:number[], vals:number[], pool:number[],
 *             droppedVals:number[], droppedPool:number[], fizzled:boolean }}
 */
export function keepBest(values = [], pool = [], keep = values.length, pinned = []) {
  const k = Math.max(0, Math.min(values.length, keep));
  // 🃏 A PINNED die (a marquee card's bonus die, `marqueeCards.js` applyCard)
  // is kept whatever it shows, like the Eleven die: it sits in a seat of its own.
  const pin = new Set(pinned);
  const order = values.map((v, i) => i).sort((a, b) =>
    (pool[b] === ELEVEN_DIE) - (pool[a] === ELEVEN_DIE) || pin.has(b) - pin.has(a) || values[b] - values[a] || a - b);
  const keptSet = new Set(order.slice(0, Math.max(k, pool.includes(ELEVEN_DIE) ? 1 : 0, pin.size)));
  const keptIdx = values.map((v, i) => i).filter(i => keptSet.has(i));
  const droppedIdx = values.map((v, i) => i).filter(i => !keptSet.has(i));
  const fizzled = keptIdx.some(i => pool[i] === ELEVEN_DIE && values[i] === 1);
  return {
    keptIdx, droppedIdx, fizzled,
    // 🔊 An Eleven die showing 1 is an ABSOLUTE FAIL: nothing he threw lands.
    // `vals` stay the real faces (they are what the table shows); a resolver
    // reads `fizzled` and scores them as nothing.
    vals: keptIdx.map(i => values[i]),
    pool: keptIdx.map(i => pool[i]),
    droppedVals: droppedIdx.map(i => values[i]),
    droppedPool: droppedIdx.map(i => pool[i]),
  };
}

/**
 * Throw a whole pool and keep the best.
 * 🃏 `fixed` — a marquee card's dice, [{ idx, face?, pin? }]. `face` SETS that
 * die's face; `pin` keeps it whatever it shows (the card's bonus die, which
 * `applyCard` appends to the pool with one more seat — Alex, 2026-10-09).
 * ⚠️ A set die is still ROLLED (one `rng.int`, like every die) and only then
 * set, so a card never shifts the stream (see the header). A replay recorded
 * before the bonus die carries `{ idx, face }` with no pin and throws exactly
 * as it did.
 */
export function throwPool(pool = [], keep = pool.length, rng, floor = 0, fixed = []) {
  const load = new Map((fixed ?? []).filter(f => Number.isFinite(f.face)).map(f => [f.idx, f.face]));
  const pinned = (fixed ?? []).filter(f => f.pin && f.idx >= 0 && f.idx < pool.length).map(f => f.idx);
  const thrown = pool.map((s, i) => { const v = rollDie(s, rng, floor); return load.has(i) ? load.get(i) : v; });
  return { thrown, ...keepBest(thrown, pool, keep, pinned) };
}
