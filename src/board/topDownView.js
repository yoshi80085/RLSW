// ⌗ THE TOP-DOWN AXIS — what "top-down" means to the camera (Alex, 2026-09-24).
// *"Make sure top-down does not 'equal' stationary. Any movement that tilts the
// axis means not top-down, but … just zooming in or out (not changing the axis
// tilt) does not mean a 'change' from top-down."*
//
// 🎯 So top-down is a DIRECTION, not a spot: the line from the look-at point to
// the lens. A dolly slides the lens along that line and a pan moves both ends by
// the same step, so both keep it; an orbit (tilt or turn) swings it, so it ends.
// Pure — plain {x,y,z} in, no three.js — so it is checkable without a browser.

/** The ⌗ Top preset's offset from its target, per unit of distance (arenaRenderer `frameView`). */
export const TOP_OFFSET = Object.freeze([0, .94, .34]);
/** ⚠️ Only float noise from the dolly lives under this. A deliberate one-pixel orbit is far past it. */
export const TOP_TOLERANCE = .5 * Math.PI / 180;

const LEN = Math.hypot(...TOP_OFFSET);
const AXIS = TOP_OFFSET.map(v => v / LEN);

/** The angle (radians) between the lens's line of sight and the top-down axis. */
export function topAxisAngle(position, target) {
  const d = [position.x - target.x, position.y - target.y, position.z - target.z];
  const len = Math.hypot(...d);
  if (!(len > 0)) return Math.PI;
  const cos = (d[0] * AXIS[0] + d[1] * AXIS[1] + d[2] * AXIS[2]) / len;
  return Math.acos(Math.min(1, Math.max(-1, cos)));
}

/** Is the lens still looking straight down the top-down axis? Zoom and pan keep it; tilt and turn break it. */
export const onTopAxis = (position, target) => topAxisAngle(position, target) <= TOP_TOLERANCE;
