import { HEX_BY_NUM, ALL_HEXES } from "./hexMap.js";
import { axialDist, getFlatTopNeighborSlots, angleTo, angleDiff } from "./hexGeometry.js";
import { NOTE_POOL } from "../music/notes.js";
import { LIMELIGHT_HEX, FAN_DIEHARD_WEIGHT, FAN_CASUAL_WEIGHT, FAN_MULT_CAP, FAN_DIEHARD_START, DB_UPGRADE_THRESHOLD, EVENT_MIN_SEPARATION, TOKEN_UNLOCK_SPAWN_SHARE } from "../data/gameConstants.js";

// ── Hex pools for board placement (engine + client) ──
// Non-edge hexes minus the Limelight — where the spotlight roams.
export const SPOTLIGHT_POOL = ALL_HEXES.filter(h => !h.edge && h.num !== 56).map(h => h.num);
// Non-Limelight interior hexes — where marquee event spaces can appear.
export const EVENT_HEX_POOL = ALL_HEXES.filter(h => !h.edge && h.num !== LIMELIGHT_HEX).map(h => h.num);

/** Axial distance between two hex NUMBERS. Unknown nums read as infinitely far
 *  apart, so a bad num can never make two marquees look adjacent. */
function hexDist(a, b) {
  const ha = HEX_BY_NUM[a], hb = HEX_BY_NUM[b];
  if (!ha || !hb) return Infinity;
  return axialDist(ha.q, ha.r, hb.q, hb.r);
}

// 🎪 Where a marquee may light up, given what is already on the board.
// `occupied` = anything a marquee must not land on (Spirits, tokens, the
// spotlight…); `liveHexes` = the marquees already lit.
//
// ⚠️ SEPARATION IS A PREFERENCE, NOT A GATE, AND THAT IS DELIBERATE. On a busy
// board the spaced pool can come back empty. Returning nothing there would stop
// marquees respawning for the rest of the match — silently, with no log line and
// no error, which is the worst failure shape available. So we fall back to the
// unspaced pool and light one anyway: a badly placed marquee beats no marquee.
export function eventHexCandidates(occupied = [], liveHexes = []) {
  const taken = new Set([...occupied, ...liveHexes]);
  const free  = EVENT_HEX_POOL.filter(n => !taken.has(n));
  if (liveHexes.length === 0 || free.length === 0) return free;
  const spaced = free.filter(n => liveHexes.every(live => hexDist(n, live) >= EVENT_MIN_SEPARATION));
  return spaced.length > 0 ? spaced : free;
}

export function cornerFacing(homeNum) {
  const home   = HEX_BY_NUM[homeNum];
  const centre = HEX_BY_NUM[56];
  if (!home || !centre) return 0;
  const raw = Math.atan2(centre.py - home.py, centre.px - home.px);
  const neighbors = getFlatTopNeighborSlots(home);
  if (!neighbors.length) return raw;
  return neighbors.reduce((best, nb) => {
    const a = angleTo(home, nb);
    return angleDiff(raw, a) < angleDiff(raw, best) ? a : best;
  }, angleTo(home, neighbors[0]));
}

export function advanceTurnQueue(queue, spirits, mode, teams) {
  const [acted, ...rest] = queue;
  const aliveIds = new Set(spirits.filter(s => !s.knockedOut).map(s => s.id));
  const aliveRest = rest.filter(id => aliveIds.has(id));

  if (mode !== "team" || !teams) {
    return aliveIds.has(acted) ? [...aliveRest, acted] : aliveRest;
  }

  const actedSpirit = spirits.find(s => s.id === acted);
  const actedTeam = actedSpirit
    ? (teams.a.includes(actedSpirit.corner) ? "a" : "b")
    : null;
  const otherTeam = actedTeam === "a" ? "b" : "a";

  if (!aliveIds.has(acted)) return aliveRest;

  const firstOtherIdx = aliveRest.findIndex(id => {
    const sp = spirits.find(s => s.id === id);
    return sp && teams[otherTeam]?.includes(sp.corner);
  });

  if (firstOtherIdx === -1) return [...aliveRest, acted];

  const insertAt = firstOtherIdx + 1;
  return [...aliveRest.slice(0, insertAt), acted, ...aliveRest.slice(insertAt)];
}

// 🎵 A board mini-goal token: a Lost Chord (grants a note to your stock, or opens
// a stack seat — see `music/stackSlots.js`). Lighters (direct Fame, no performance
// required) were cut -- unearned FP, per the STICs + Earned checklist in
// ARCHITECTURE.md. See ECONOMY_HANDOFF.md for the full history.
//
// 🔓 `targetPcs` is the set of pitch classes that would open a seat for SOMEBODY
// right now (`liveUnlockPcs`). `TOKEN_UNLOCK_SPAWN_SHARE` of new tokens roll from
// it instead of from the uniform twelve.
//
// ⚠️ THE DRAW HAPPENS UNCONDITIONALLY, BEFORE THE BRANCH, and that is not style —
// it is determinism. `determinismCheck` replays a match off a seeded stream, and a
// generator that consumes one number on some boards and two on others desyncs
// every seat downstream of the first token that had no live targets.
export function makeBoardToken(num, rand = Math.random, targetPcs = null) {
  const roll   = rand();          // ← always drawn
  const pick   = rand();          // ← always drawn
  const live   = targetPcs && targetPcs.size ? [...targetPcs].sort((a, b) => a - b) : null;
  const note   = (live && roll < TOKEN_UNLOCK_SPAWN_SHARE)
    ? NOTE_POOL[live[Math.floor(pick * live.length)] % 12]
    : NOTE_POOL[Math.floor(pick * NOTE_POOL.length)];
  return { num, kind: 'chord', note, turnsOnBoard: 0 };
}

// Which centre ring a hex sits in, measured from the Limelight (hex 56).
export function hexRingFromCenter(num) {
  const here = HEX_BY_NUM[num], hub = HEX_BY_NUM[LIMELIGHT_HEX];
  if (!here || !hub) return 'back';
  const d = axialDist(here.q, here.r, hub.q, hub.r);
  if (d === 0) return 'main';   // the Mainstage itself
  if (d === 1) return 'pit';    // the Pit — 6 hexes hugging the stage
  if (d <= 3) return 'floor';   // the Floor
  return 'back';                // Backstage / edges
}

// Crowd multiplier from a spirit's two fan bands.
// `assigned` = number of Diehards currently on crew assignments (they step out
// of the crowd while backstage — CREW_SYSTEM_DESIGN.md §2).
export function crowdMultiplier(diehards = FAN_DIEHARD_START, casuals = 0, assigned = 0) {
  const activeDiehards = Math.max(0, diehards - assigned);
  return Math.min(
    FAN_MULT_CAP,
    1 + FAN_DIEHARD_WEIGHT * activeDiehards + FAN_CASUAL_WEIGHT * casuals
  );
}

// advanceDB: progress dbPoints toward a dynamic target cost.
// Returns whether the target was reached this increment.
export function advanceDB(dbPoints, earned, targetCost) {
  const cost  = targetCost ?? DB_UPGRADE_THRESHOLD; // default 8 for first pick
  const total = dbPoints + earned;
  if (total >= cost) {
    return { newDBPoints: total - cost, upgradeTriggered: true };
  }
  return { newDBPoints: total, upgradeTriggered: false };
}
