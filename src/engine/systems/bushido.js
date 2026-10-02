import { HEX_BY_NUM, HEX_BY_QR } from '../../board/hexMap.js';
import { neighborInDirection } from '../../board/hexGeometry.js';
import { PSYCHO_BUSHIDO_MAX_RANGE, PSYCHO_BUSHIDO_STACK_COST, psychoBushidoD8s, SONIC_BASE_DIE, SONIC_UPGRADED_DIE } from '../../data/gameConstants.js';
import { firePatch } from './cooldowns.js';

// ⭐ ONE OCCUPANCY POLICY, AND IT IS ALEX'S CALL OF 2026-09-05: ANY BODY BLOCKS.
//
// ⚠️ THIS FUNCTION IS WHAT THE THREE CALLERS NOW SHARE, AND IT IS THE WHOLE
// POINT OF IT EXISTING. Until 2026-09-05 the same ability answered "what stops
// the lane?" three different ways — the client click passed NOTHING, the client
// highlight passed live spirits, and the searcher passed spirits + amps + the
// 👤 decoy. §A recorded that as preserved-on-purpose ("shared geometry does not
// mean shared eligibility"); it is now resolved on purpose instead. A spirit, an
// amp or the decoy stops the draw dead, which is what makes standing at range 2
// a defence against this ability and what makes parking the decoy in front of a
// Ronin worth doing.
//
// 📌 SELF IS EXCLUDED, not filtered by the caller. The lane starts at distance
// 1 so the origin can never appear in it, but a caller that built the set from
// "every spirit" and then re-checked `step.num === self.num` inside its own loop
// is exactly the kind of duplicated policy this replaces.
export function bushidoBlockers({ spirits = [], amps = [], shadowHex = null, shadowHexes = [], selfId = null } = {}) {
  return new Set([
    ...spirits.filter(s => !s?.knockedOut && s?.id !== selfId).map(s => s.num),
    ...amps.map(a => a.hexNum),
    ...shadowHexes,
    ...(shadowHex != null ? [shadowHex] : []),
  ]);
}

// One geometric walk; callers hand it `bushidoBlockers` above. Includes the
// blocked hex itself, and close hexes, so callers retain their refusal messages
// — "someone is in the way" and "too close to draw" are different sentences and
// a player needs to be told which one they hit.
export function bushidoLane(spirit, blocked = new Set()) {
  const origin = HEX_BY_NUM[spirit?.num];
  if (!origin) return [];
  const first = neighborInDirection(origin, spirit.facing ?? 0);
  if (!first) return [];
  const dq = first.q - origin.q, dr = first.r - origin.r;
  const lane = [];
  let previous = origin.num;
  for (let dist = 1; dist <= PSYCHO_BUSHIDO_MAX_RANGE; dist++) {
    const hex = HEX_BY_QR[`${origin.q + dq * dist},${origin.r + dr * dist}`];
    if (!hex) break;
    lane.push({ num: hex.num, to: previous, dist });
    if (blocked.has(hex.num)) break;
    previous = hex.num;
  }
  return lane;
}

// ⭐ THE DRAW'S BILL: the Db and the clock, and two notes off the TOP of the
// Drive stack (Alex, 2026-09-27 — the root stays, the chord steps down).
// 🪦 IT NO LONGER PAYS `tempDrive`. Until 2026-10-01 the range ladder went in
// here as bonus Drive, which `sonicRig.drivePowerBreakdown` caps at 2 dice — so
// ranges 4 and 5 bought what range 3 did. The range now turns d6s into d8s on
// the strike's own pool (`bushidoUpgrade`, applied by `attackParams`).
// 📌 `dist` stays in the signature so every caller keeps reading the same way.
export function bushidoDrawPatch(ns, dist) {
  void dist;
  return {
    ...firePatch(ns, 'psycho_bushido'),
    // 🔝 Spent from the TOP (Alex, 2026-09-27) — the root stays, the chord steps down.
    driveStack: (ns.driveStack ?? []).slice(0, Math.max(0, (ns.driveStack ?? []).length - PSYCHO_BUSHIDO_STACK_COST)),
  };
}

/**
 * ⚡ THE RANGE TURNS d6s INTO d8s (Alex, 2026-09-30/10-01). Range 3 → two,
 * 4 → three, 5 → four (`psychoBushidoD8s`). Only d6s upgrade — a six-note
 * chord's d8s, a charge-zone d10 and the Eleven die are left as they are — and
 * a pool with fewer d6s than the rung runs out: a Drive-3 Ronin at range 5
 * throws 3d8, not four. No dice are added; the pool keeps its length.
 */
export function bushidoUpgrade(pool = [], dist = 0) {
  let left = psychoBushidoD8s(dist);
  return pool.map(sides => (sides === SONIC_BASE_DIE && left > 0 ? (left--, SONIC_UPGRADED_DIE) : sides));
}
