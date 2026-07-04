import { HEX_BY_NUM } from "./hexMap.js";
import { axialDist, getFlatTopNeighborSlots, angleTo, angleDiff } from "./hexGeometry.js";
import { NOTE_POOL } from "../music/notes.js";
import { LIMELIGHT_HEX, FAN_DIEHARD_WEIGHT, FAN_CASUAL_WEIGHT, FAN_MULT_CAP, FAN_DIEHARD_START, HC_UPGRADE_THRESHOLD } from "../data/gameConstants.js";

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

// 🎵 A board mini-goal token: a Lost Chord (grants a note to your stock). Lighters
// (direct Fame, no performance required) were cut -- unearned FP, per the STICs +
// Earned checklist in ARCHITECTURE.md. See ECONOMY_HANDOFF.md for the full history.
export function makeBoardToken(num) {
  return { num, kind: 'chord', note: NOTE_POOL[Math.floor(Math.random() * NOTE_POOL.length)] };
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
export function crowdMultiplier(diehards = FAN_DIEHARD_START, casuals = 0) {
  return Math.min(
    FAN_MULT_CAP,
    1 + FAN_DIEHARD_WEIGHT * diehards + FAN_CASUAL_WEIGHT * casuals
  );
}

// advanceHC: progress hcPoints toward a dynamic target cost.
// Returns whether the target was reached this increment.
export function advanceHC(hcPoints, earned, targetCost) {
  const cost  = targetCost ?? HC_UPGRADE_THRESHOLD; // default 8 for first pick
  const total = hcPoints + earned;
  if (total >= cost) {
    return { newHCPoints: total - cost, upgradeTriggered: true };
  }
  return { newHCPoints: total, upgradeTriggered: false };
}
