import { HEX_BY_NUM, HEX_BY_QR } from '../../board/hexMap.js';
import { neighborInDirection } from '../../board/hexGeometry.js';
import { PSYCHO_BUSHIDO_MAX_RANGE, PSYCHO_BUSHIDO_STACK_COST, psychoBushidoBonus } from '../../data/gameConstants.js';
import { firePatch } from './cooldowns.js';

// One geometric walk; callers supply their existing occupancy policy. The
// client click historically ignores blockers, highlights stop at live spirits,
// and the planner also stops at amps/decoys. Preserve that compatibility until
// the gameplay discrepancy is deliberately resolved, rather than hiding a fix
// inside a refactor. Includes close hexes so callers retain refusal messages.
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
