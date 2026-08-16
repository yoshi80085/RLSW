// ─── ENGINE SYSTEM: THE SLIME TRAIL ──────────────────────────────────────────
// 🧪 Metalness Monster's innate, moved out of React and into engine state.
// `METALNESS_REWORK_DESIGN.md` §3 — "the trail is a currency, and this is the
// design spine."
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
// The trail lived in the monolith as `const [poisonSlime, setPoisonSlime] =
// useState({})` — a bare `hexNum → turnsLeft` map, invisible to the engine.
// Three separate things were blocked on that, and all three are in the rework:
//
//   1. **The searcher could not see it at all.** `BOT_STRATEGY_HANDOFF.md` §4.3:
//      "slime makes his vacated hexes dangerous, so his movement is an attack.
//      No current bot scorer models 'where I came from.'" It could not — the
//      board it scores had no slime on it.
//   2. **The map had no ORDER, so two of the three uses were inexpressible.**
//      The Slide is "backwards along your own trail" and the Tentacle reaches
//      "through" it (§4a: he stands on A, his trail runs A ← B ← C ← D). Both
//      are questions about a PATH. A `{hex: turns}` object cannot answer them.
//   3. **The map had no OWNER**, so "immune to his own" was a hardcoded
//      `spiritId === 'Metalness_Monster'` string comparison rather than a rule.
//
// So the shape here is an ORDERED, OWNED path per Spirit, newest first:
//
//     state.board.slime = { [ownerId]: [ { num, turns }, … ] }
//
// `path[0]` is the hex he most recently vacated — i.e. the one he is standing
// next to. Walking outward from index 0 is walking back the way he came.
//
// ⚠️ **A PATH IS NOT A CHAIN.** Entries are laid by vacating hexes, so they are
// usually adjacent in sequence — but a knockback, a warp or a Displace breaks
// the run, and an expiring middle segment breaks it too. Every ability that
// travels the trail must therefore read `trailRun`, never `trailOf`. Reaching
// across a gap is the single easiest bug to write here, and it would be
// invisible: it looks like a slightly longer reach, not like a broken rule.
//
// ── WHAT THIS FILE DELIBERATELY DOES NOT DO ─────────────────────────────────
// It does not damage anybody. `slimeAt` answers "is there slime here and whose
// is it"; the caller applies the Vibe. That keeps the one damage path
// (`applyVibeDamage` / `damageApplied`) intact rather than opening a second
// one, which is the same reasoning `transition.js` uses for unmodelled kinds.

import { HEX_BY_NUM } from "../../board/hexMap.js";
import { axialDist } from "../../board/hexGeometry.js";
import { SLIME_AP_COST, SLIME_MOVE_STEPS, SLIME_LIFETIME_TURNS, SLIME_TRAIL_MAX } from "../../data/gameConstants.js";

/** 🧪 A rival who enters or is pushed into slime loses this much Vibe. */
export const SLIME_VIBE_DAMAGE = 1;

/**
 * ⚠️ ONE LIFETIME, COUNTED IN THE OWNER'S TURNS. An earlier pass split this in
 * two — a short "bite" window and a longer "road" window, so dried slime stayed
 * walkable but harmless. That existed only to work around a road that expired
 * before its owner could spend it, and making Slime an ABILITY removed the
 * problem it was solving: he now places road deliberately and it lives three of
 * his own turns as both hazard and road. A mechanic kept after its reason has
 * gone is just a rule nobody can explain, so it went with the reason.
 */
export const SLIME_LIFETIME = SLIME_LIFETIME_TURNS;

// ─── READS ───────────────────────────────────────────────────────────────────

/** Every hex of `spiritId`'s trail, newest first. Never null. */
export function trailOf(state, spiritId) {
  return state?.board?.slime?.[spiritId] ?? [];
}

/**
 * Whose slime is on `hexNum`, if any → `{ ownerId, turns }` or null.
 * ⚠️ First owner wins. Two trails cannot share a hex today (only one Spirit
 * lays slime), and if a second ever does, the tie needs a rule rather than
 * whichever key `Object.entries` happened to yield first — this is the line
 * that will need changing, and it is why it is one line.
 */
export function slimeAt(state, hexNum) {
  const all = state?.board?.slime ?? {};
  for (const [ownerId, path] of Object.entries(all)) {
    const hit = path.find(e => e.num === hexNum);
    if (hit) return { ownerId, turns: hit.turns };
  }
  return null;
}

/** Does stepping onto `hexNum` hurt `spiritId`? Owner is immune to their own. */
export function slimeBites(state, spiritId, hexNum) {
  const s = slimeAt(state, hexNum);
  return !!s && s.ownerId !== spiritId;
}

const adjacent = (a, b) => {
  const ha = HEX_BY_NUM[a], hb = HEX_BY_NUM[b];
  return !!ha && !!hb && axialDist(ha.q, ha.r, hb.q, hb.r) === 1;
};

/**
 * The **contiguous** run of trail leading away from where `spiritId` stands —
 * the part the Slide can walk and the Tentacle can reach through.
 *
 * Starts at the Spirit's own hex and follows the path outward while each entry
 * is adjacent to the last one accepted, stopping at the first break. Returns
 * hex numbers in reach order: `[0]` is one step out, `[1]` is two, and the
 * length IS the maximum reach.
 *
 * ⚠️ It walks `path` in order rather than searching for the nearest neighbour.
 * A nearest-neighbour walk would happily hop onto a much older loop of trail
 * that happens to pass close by, which turns "the road you came in on" into
 * "any slime near you" — a different and much stronger ability.
 */
export function trailRun(state, spiritId) {
  const sp = (state?.spirits ?? []).find(s => s.id === spiritId);
  if (!sp) return [];
  const run = [];
  let cursor = sp.num;
  for (const entry of trailOf(state, spiritId)) {
    if (!adjacent(cursor, entry.num)) break;
    run.push(entry.num);
    cursor = entry.num;
  }
  return run;
}

/**
 * 🧪 THE SLIDE — where the Monster may retreat to, or null.
 *
 * One hex at a time, and always `trailRun[0]`: the hex he most recently
 * vacated. Sliding consumes it, so after the step his own trail has advanced
 * and the next slide is again `trailRun[0]` — the ability composes with itself
 * without a second rule.
 *
 * ⚠️ **BACKWARDS ONLY, AND THAT IS THE WHOLE BALANCE.** §2: "if it can close
 * distance it stops being a disengage and becomes speed 6, which erases the
 * cost his stat line was buying." Reading `trailRun` rather than "any adjacent
 * slime" is what enforces it — the road only runs one way, because it is the
 * road he already walked.
 */
export function slideTarget(state, spiritId) {
  if (!((state?.turn?.slideStepsLeft ?? 0) > 0)) return null;
  const run = trailRun(state, spiritId);
  return run.length > 0 ? run[0] : null;
}

// ─── WRITES ──────────────────────────────────────────────────────────────────

/**
 * SLIME_DROPPED — lay slime on a hex the owner has just vacated.
 *
 * ⚠️ Re-entering your own trail REFRESHES rather than duplicates: the hex is
 * lifted out of wherever it was and pushed back onto the front at full life.
 * Letting it appear twice would make `trailRun` count one hex as two steps of
 * reach, so the Tentacle would price a doubled-back trail as longer than it is.
 */
export function applySlimeDropped(state, { spiritId, hexNum, turns }) {
  if (hexNum == null || !(turns > 0)) return state;
  const prev = trailOf(state, spiritId).filter(e => e.num !== hexNum);
  // ⚠️ THE CAP IS APPLIED HERE, AT THE ONLY PLACE THE ROAD GROWS, and it is what
  // replaced time-decay as the thing that ends a hex's life. The road is the last
  // SLIME_TRAIL_MAX hexes he vacated — walk a seventh and the oldest falls off the
  // far end. That keeps the trail proportional to how much he has been MOVING
  // rather than to what turn it is, and it bounds `trailRun` (and therefore the
  // Tentacle's origin count) by construction.
  const path = [{ num: hexNum, turns }, ...prev].slice(0, SLIME_TRAIL_MAX);
  return {
    ...state,
    board: {
      ...state.board,
      slime: { ...(state.board.slime ?? {}), [spiritId]: path },
    },
  };
}

/**
 * SLIME_DECAYED — one tick off every hex of every trail, at the end of every
 * Spirit's turn. Expired hexes leave; an owner with nothing left leaves too, so
 * the map does not accumulate empty arrays for anyone who ever laid slime.
 *
 * ⚠️ TICK AT THE **END** OF THE TURN. `economy.js` carries a long warning on
 * Sunbeam's `blindTurns` about decrementing at turn START — it clears a
 * one-turn effect before the victim ever draws a hex, so the effect silently
 * becomes nothing. The shipped `decayPoisonSlime` fell into that trap once
 * already (it seeded with a flat 1 and wiped the trail the instant the
 * Monster's own turn ended, so nobody ever stepped in it). This is the third
 * system with that shape; see `METALNESS_REWORK_DESIGN.md` §4d.
 */
export function applySlimeDecayed(state, { ownerId } = {}) {
  const all = state?.board?.slime ?? {};
  // ⚠️ ONE OWNER'S ROAD AGES, NOT EVERY ROAD ON THE BOARD. Ageing them all on
  // every turn end is what made a lifetime quoted in "turns" silently mean
  // SPIRIT-turns — see the action creator and gameConstants. With no ownerId
  // this is a no-op rather than a tick-everything, because guessing here is
  // exactly how that bug would come back.
  if (!ownerId || !all[ownerId]) return state;
  const kept = all[ownerId]
    .map(e => ({ ...e, turns: e.turns - 1 }))
    .filter(e => e.turns > 0);
  const next = { ...all };
  if (kept.length > 0) next[ownerId] = kept; else delete next[ownerId];
  return { ...state, board: { ...state.board, slime: next } };
}

/**
 * 🧪 SLIME_CALLED — switch the ooze on for the rest of this turn.
 *
 * Three things, and the middle one IS the ability:
 *   1. it bills `SLIME_AP_COST`, so it cannot be called on an empty pool;
 *   2. it SETS movement to `SLIME_MOVE_STEPS` rather than adding to it — see
 *      gameConstants for why a set is a different and better ability than a
 *      bonus, and why it is the same idiom `Goes to 11` runs on;
 *   3. it flags the turn, and `applyMoveStep` reads that flag to decide whether
 *      a vacated hex becomes road.
 *
 * ⚠️ ONCE A TURN, enforced by `legalActions` reading `turn.slimingId`. Calling
 * it twice would refill movement to 3 for 1 AP a time — a movement engine
 * rather than an ability.
 */
export function applySlimeCalled(state, { spiritId }) {
  if ((state?.turn?.moveStepsLeft ?? 0) < SLIME_AP_COST) return state;
  return {
    ...state,
    turn: { ...state.turn, slimingId: spiritId, moveStepsLeft: SLIME_MOVE_STEPS },
  };
}

/**
 * SLIME_CLEARED — spend part or all of a trail.
 *
 * This is the write the whole rework turns on: §3's table gives the trail three
 * competing consumers (Slide retreats along it, Tentacle reaches through it,
 * Slam collapses it), and "spend" has to be a real, visible subtraction or the
 * three do not compete for anything. Omit `hexNums` to clear the owner's whole
 * trail — that is the Slam.
 */
export function applySlimeCleared(state, { spiritId, hexNums }) {
  const all = state?.board?.slime ?? {};
  if (!all[spiritId]) return state;
  const next = { ...all };
  if (!hexNums) {
    delete next[spiritId];
  } else {
    const gone = new Set(hexNums);
    const kept = all[spiritId].filter(e => !gone.has(e.num));
    if (kept.length > 0) next[spiritId] = kept; else delete next[spiritId];
  }
  return { ...state, board: { ...state.board, slime: next } };
}

/**
 * SPIRIT_SLID — retreat one hex along your own trail, spending the slime.
 *
 * Three things it does NOT do, each deliberate:
 *
 * 1. **It costs no AP.** §1's spine says every hex costs AP, and this is the
 *    exception the innate exists to be. §2: his old innate rewarded moving
 *    while his speed 4 punished it, so his identity fought his win path. Now
 *    moving generates movement.
 * 2. **It does NOT re-face him.** `applyMoveStep` turns you down the direction
 *    of travel and `isRearHit` reads facing on DEFENCE, so a re-facing retreat
 *    would turn his back on whatever he just disengaged from — punishing the
 *    escape it exists to be. Both trail abilities decline the re-face that
 *    walking gives you, and that is the unifying rule: **the trail moves you
 *    without turning you.** (§4a spends the same absence as a COST for the
 *    Tentacle, which is the same rule read the other way round.)
 * 3. **It does not check occupancy.** The caller does, via `legalActions` —
 *    same division of labour as every other movement action here.
 *
 * ⚠️ The slime under him is consumed BEFORE he arrives, so he never stands on
 * his own trail. That keeps the invariant `trailRun` depends on: `path[0]` is
 * always a hex he has left, never one he is on.
 */
export function applySpiritSlid(state, { spiritId, toNum }) {
  const sp = (state?.spirits ?? []).find(s => s.id === spiritId);
  if (!sp || toNum == null) return { ...state, turn: { ...state.turn, lastSlide: null } };
  const cleared = applySlimeCleared(state, { spiritId, hexNums: [toNum] });
  return {
    ...cleared,
    spirits: cleared.spirits.map(s => (s.id !== spiritId ? s : { ...s, num: toNum })),
    turn: {
      ...cleared.turn,
      slideStepsLeft: Math.max(0, (cleared.turn.slideStepsLeft ?? 0) - 1),
      lastSlide: { spiritId, from: sp.num, to: toNum },
    },
  };
}
