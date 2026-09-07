import { HEX_BY_NUM, HEX_BY_QR } from '../../board/hexMap.js';
import { neighborInDirection } from '../../board/hexGeometry.js';
import { PSYCHO_BUSHIDO_MAX_RANGE, PSYCHO_BUSHIDO_STACK_COST, psychoBushidoBonus } from '../../data/gameConstants.js';
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
export function bushidoBlockers({ spirits = [], amps = [], shadowHex = null, selfId = null } = {}) {
  return new Set([
    ...spirits.filter(s => !s?.knockedOut && s?.id !== selfId).map(s => s.num),
    ...amps.map(a => a.hexNum),
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

// Apply after warp/AP payment and before the ordinary Swing reads its stats.
// This is only the draw's bill: the Swing still pays its own stack and AP cost.
export function bushidoDrawPatch(ns, dist) {
  return {
    ...firePatch(ns, 'psycho_bushido'),
    tempDrive: (ns.tempDrive ?? 0) + psychoBushidoBonus(dist),
    driveStack: (ns.driveStack ?? []).slice(PSYCHO_BUSHIDO_STACK_COST),
  };
}
