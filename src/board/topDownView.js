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

// 🧭 FACE NORTH (Alex, 2026-10-09: *"Give a North orientation button. It can keep
// the same level of zoom … but it should automatically orient so the camera
// faces north. This helps a lot when trying to use the num pad to move"*).
// ⭐ The numpad walks BOARD north (ui/numpadMove.js ruling 2) whatever the lens
// does, so after an orbit 8 can walk a Spirit sideways or toward the player.
// Facing north puts board north at the top of the screen again, and 8 is "up".
//
// 🎯 Board north is world −z (arenaVisuals `arenaPoint`: z grows with the
// board's py), so a lens that FACES north sits due SOUTH of what it looks at:
// its offset from the target has x = 0 and z > 0 — exactly ⌗ Top's TOP_OFFSET.
// ⚠️ ONLY THE TURN CHANGES. Zoom (the offset's length), tilt (its height) and
// the look-at point are all kept, so the button never jumps the board away from
// where the player was looking — it swings the lens round it, nothing else.

/** The lens's heading in radians: 0 faces north, +π/2 faces west (lens east of target). */
export function lensHeading(position, target) {
  return Math.atan2(position.x - target.x, position.z - target.z);
}

/** ⚠️ Below this the turn is float noise — the lens already faces north. */
export const NORTH_TOLERANCE = .25 * Math.PI / 180;

/** Does the lens face north already (within NORTH_TOLERANCE)? A lens straight overhead does, trivially. */
export function facesNorth(position, target) {
  const dx = position.x - target.x, dz = position.z - target.z;
  return Math.hypot(dx, dz) < 1e-9 || Math.abs(lensHeading(position, target)) <= NORTH_TOLERANCE;
}

/**
 * The lens position after turning it `angle` radians about the vertical through
 * `target` — same height, same distance. Plain {x,y,z} out.
 * ⚠️ Turning by −lensHeading is the SHORT way round: atan2 is in (−π, π], so the
 * swing is never more than half a circle.
 */
export function turnLens(position, target, angle) {
  const dx = position.x - target.x, dz = position.z - target.z, c = Math.cos(angle), s = Math.sin(angle);
  return { x: target.x + dx * c + dz * s, y: position.y, z: target.z - dx * s + dz * c };
}

/** Where the lens sits once it faces north: due south of `target`, same height and distance. */
export const northLens = (position, target) => turnLens(position, target, -lensHeading(position, target));
