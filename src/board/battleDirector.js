// ─── 🎬 THE BATTLE DIRECTOR — where the lens goes for a Swing or a Sonic ─────
// Alex, 2026-09-24:
//   "for Sonic and Swing attacks - I'd like for the dice animation to take
//    place in a view above the standees as if the player him/herself were
//    rolling *at* the board looking down. Your screen watches the Rival's roll
//    from that same vantage point … after the rolling sequence, the camera
//    should show the standee in the foreground - in focus - … while the amp is
//    in the background - out of focus at first - then changing to become in
//    focus as the Sonic charge emits from the amps. Fans should also be shown in
//    the background … They should also be in the last shot - the winner of the
//    bout sees their fan's reactions."
// Rulings in the same conversation: BOTH Spirits get a charge shot; the last
// shot is the WINNER's fans on every screen (a tie shows both crowds); the
// dice land ON THE BOARD by the fight. And after seeing it: the Rival's shield
// shot holds "at least a second or 2" (that hold is `SONIC_SHIELD_HOLD`, in
// `battleRollGate.js`, because it is what the attacker's gate waits for).
//
// ⭐ EVERY DEFAULT BELOW IS OFF `.scratch/battle-sequence-preview.html`, which
// imports THIS file — the page and the game cannot disagree about a shot.
// 📌 PURE MATHS OVER POSITIONS. No scene, no clock: the caller hands in where
// the Spirits, amps, stands and dice are and the sequence second, and gets
// back `{ key, pos, target, focus, fov }` — `focus` is the distance along the
// lens that is sharp, which is exactly what `BokehPass.focus` wants.
//
// THREE SHOT TYPES, and every beat is one of them:
//   seat   — your chair at the table, high, looking down at the dice. ⭐ The
//            SAME chair for both throws: you watch the Rival throw from where
//            you sit. Online, the Rival's screen uses THEIR chair (`you`).
//   charge — low, beyond one standee, looking back past it at its own amp and
//            its own fans. Focus starts on the standee and PULLS to the amp /
//            fans as the amp fires.
//   side   — the clash itself, square to the lane, so both side-on sheets
//            read broadside.
import * as THREE from 'three';

export const BATTLE_DIRECTOR = Object.freeze({
  seatAngle:55, seatDist:6.5, seatHeight:7, seatLook:.35,
  chargeDist:4.6, chargeHeight:1.6, chargeFrame:.3, chargeOrbit:15, chargeFov:42,
  finalDist:5.5, finalHeight:1.6, finalFrame:.46, finalOrbit:-25, finalFov:40,
  sonicLead:1.2, sideDist:5.5, pullDelay:0, pullTime:.6,
  aperture:6, maxBlur:12, glide:0,
  diceScale:.55, diceOffset:2.2,
  shoveTime:.45, shoveDelay:.25, fanDelay:.4, finalHold:4, cheer:1,
  // 🎯 THE TWO-SHOT PUSH-IN (Alex, 2026-09-24): "the beginning *should* zoom
  // in - but it should zoom into the 2 Spirits - make lines come in from the
  // outside - the border of the screen to create extra drama". It opens the
  // bout (before the first throw) and returns once the dice have lined up,
  // right before the blasts / the strike. `pushFrom` is how much wider it
  // starts than its tight framing; `pushTime` how long the push takes.
  twoHeight:1.9, twoFov:40, pushFrom:1.75, pushTime:1.1, twoMargin:1.12,
  // 🐛 "THE FIRST CAMERA AFTER A SONIC IS COMMITTED IS POINTING AT NOTHING,
  // ZOOMED IN EXTRA FAR INTO THE STAGE" (Alex, 2026-09-24). Two causes, both
  // measured against the real arena (`battleDirectorCheck` §1c):
  //  · the two-shot stood SQUARE to the lane — and two standees facing each
  //    other down the lane are, from there, two acrylic sheets seen almost
  //    EDGE-ON (78° off their print at adjacent range). Nothing to look at.
  //  · at adjacent range the fit came to ~4.8 units, which is a lens down on
  //    the floor between them. `twoMin` is the closest it may frame the pair.
  // `printMin` is how square-on any shot must see a standee's print
  // (|cos| of the angle off its face: .5 = at most 60° off).
  twoMin:8, printMin:.5, twoSwing:60, twoGood:.6,
  // How tall a standee stands (standee.js, Alex's 2.8 dial-in) — the fit keeps
  // the heads in frame, which is exactly what "zooms in to nothing" did not.
  standeeHeight:2.9,
  // Every framed shot assumes a screen at least this wide. The arena is always
  // wider than tall; 1.5 keeps a margin for a narrow window.
  aspect:1.5,
  // 🐛 THE THIRD "ZOOMS REALLY FAR INTO THE ARENA — INTO NOTHING" (Alex,
  // 2026-09-28). Measured against the real arena on 60 random bouts: half the
  // charge shots put the OTHER Spirit's acrylic sheet a metre or two in front
  // of the lens (up to 4× the screen's height — a wall of clear plastic), and
  // the rest aimed so far toward a distant amp that the middle of the frame
  // was empty floor. Two-shots, chairs and clash shots were sometimes filmed
  // from behind a stacked amp, a grandstand or the lighting truss. Every shot
  // now goes through `clearLens` (below): the same angle if it is clean,
  // otherwise the nearest swing round (and, failing that, up) that is.
  clearNear:3.4,     // no standee may stand closer to the lens than this (horizontal)
  clearSee:.8,       // at least this share of each subject must be in clear view
  clearYaw:[0,12,-12,24,-24,36,-36,50,-50,65,-65,80,-80,100,-100,125,-125,150,-150,180],
  clearLift:[0,12,24],
  // The charge shot aims at most this far from its standee toward the amp:
  // an amp 12 units off used to pull the aim 3.6 into empty floor.
  chargeReach:2.2, finalReach:3.6,
});

// ─── 🔭 CLEAR LENS ───────────────────────────────────────────────────────────
// Everything a lens must not do, scored (0 = clean):
//  · stand within `clearNear` of ANY standee — a sheet that close is a wall;
//  · crop a subject (feet to head must be in frame);
//  · have a standee that is NOT the subject in the foreground, nearer than
//    the subject — the over-the-shoulder that fills half the screen;
//  · have a subject hidden behind the other standee;
//  · have a subject hidden behind arena furniture — `sees(from, points)` is
//    the scene's answer (share of points in clear view), supplied by
//    arenaVisuals; without it (tests, the preview) this part is skipped.
function lensBasis(pos, target, fovDeg, aspect) {
  const fwd = target.clone().sub(pos).normalize();
  const right = new THREE.Vector3().crossVectors(fwd, Y);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0); else right.normalize();
  const upv = new THREE.Vector3().crossVectors(right, fwd);
  const tanV = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2), tanH = tanV * aspect;
  return p => { const v = p.clone().sub(pos), z = v.dot(fwd);
    return z <= .1 ? null : { x:v.dot(right) / (z * tanH), y:v.dot(upv) / (z * tanV), z, half:.65 / (z * tanH) }; };
}
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// Does the segment lens → point pass through the standee standing at `o`?
function hiddenBy(from, to, o, floor, height) {
  const d = to.clone().sub(from), dh = d.x * d.x + d.z * d.z;
  if (dh < 1e-9) return false;
  const t = ((o.x - from.x) * d.x + (o.z - from.z) * d.z) / dh;
  if (t <= .02 || t >= .98) return false;
  const p = from.clone().addScaledVector(d, t);
  return Math.hypot(p.x - o.x, p.z - o.z) < .7 && p.y > floor && p.y < floor + height;
}
export function lensTrouble(pos, target, { fov, aspect, spirits, subjects, floor, L, sees, budget = Infinity }) {
  const H = L.standeeHeight, see = lensBasis(pos, target, fov, aspect);
  const body = S => [.3, H * .5, H].map(y => S.clone().setY(floor + y));
  let bad = 0;
  const subjNear = subjects.length ? Math.min(...subjects.map(i => flat(pos, spirits[i]))) : Infinity;
  spirits.forEach((S, j) => {
    const h = flat(pos, S), pts = body(S).map(see);
    if (subjects.includes(j)) {
      if (h < L.clearNear) bad += 10 * (L.clearNear - h);
      for (const s of pts) bad += !s ? 5 : 4 * (Math.max(0, Math.abs(s.x) - .96) + Math.max(0, Math.abs(s.y) - .96));
    } else if (pts.some(s => s && Math.abs(s.x) - s.half < 1.02 && Math.abs(s.y) < 1.1)) {
      if (h < L.clearNear || (subjects.length && h < subjNear - .25)) bad += 3 + 2 * (Math.max(L.clearNear, subjNear) - h);
      // Half a sheet sliced by the frame's edge reads as clutter, not as a
      // second Spirit: in the frame or out of it, not on the line.
      else if (pts.some(s => s && Math.abs(s.x) + s.half > .98)) bad += .3;
    }
  });
  for (const i of subjects) {
    const pts = body(spirits[i]);
    spirits.forEach((O, j) => {
      if (j === i) return;
      const n = pts.filter(p => hiddenBy(pos, p, O, floor, H)).length;
      // Another SUBJECT half-covering this one is only coverage; all of it is not.
      if (subjects.includes(j) ? n >= 2 : n) bad += n;
    });
  }
  if (sees && bad < budget) bad += sightPenalty(pos, { spirits, subjects, floor, L, sees });
  return bad;
}
/** The furniture part of `lensTrouble` alone — the costly part (it casts rays). */
export function sightPenalty(pos, { spirits, subjects, floor, L, sees }) {
  if (!sees || !subjects.length) return 0;
  // Judged per Spirit — the WORST seen one. Pooled, a Spirit two-fifths behind a
  // truss post averaged out against a clear one and the shot passed.
  let v = 1;
  for (const i of subjects) {
    const side = new THREE.Vector3(-(pos.z - spirits[i].z), 0, pos.x - spirits[i].x).normalize();
    const pts = [.35, 1.2, 2.0, 2.7].flatMap(y => [-.4, 0, .4].map(dx => spirits[i].clone().setY(floor + y).addScaledVector(side, dx)));
    v = Math.min(v, sees(pos, pts));
    if (v < L.clearSee) break;
  }
  return v < L.clearSee ? 6 * (L.clearSee - v) + 1 : 0;
}
/**
 * The nearest clean lens to the one a shot asked for: swing round `pivot` by
 * the `clearYaw` list (smallest first), then up by `clearLift`. The first
 * candidate with no trouble wins; if none is clean, the least troubled.
 * Returns the offsets, so a caller can keep them for the length of a shot
 * (`memo`) and the lens never hunts between two answers mid-shot.
 */
export function clearLens({ pos, target, pivot = target, fov, aspect, spirits, subjects, floor, L, sees, retarget, yaws = L.clearYaw, extra }) {
  const offset = pos.clone().sub(pivot);
  const r = Math.hypot(offset.x, offset.z), el = Math.atan2(offset.y, r), len = offset.length();
  // Two passes: the cheap geometry for every candidate first, then the scene's
  // rays only for the best few, in order — the search costs a handful of ray
  // batches instead of one per candidate (it runs on the frame a shot cuts in).
  const cands = [];
  for (const lift of L.clearLift) for (const yaw of yaws) {
    const a = THREE.MathUtils.degToRad(yaw), e = Math.min(1.35, el + THREE.MathUtils.degToRad(lift));
    const dirH = new THREE.Vector3(offset.x, 0, offset.z).normalize().applyAxisAngle(Y, a);
    const p = pivot.clone().addScaledVector(dirH, Math.cos(e) * len).add(up(Math.sin(e) * len));
    const tgt = retarget ? retarget(p) : target;
    const cheap = lensTrouble(p, tgt, { fov, aspect, spirits, subjects, floor, L })
      + (extra ? extra(p, tgt) : 0) + (Math.abs(yaw) + lift) * 1e-4; // ties go to the smallest change
    cands.push({ yaw, lift, p, cheap, order:cands.length });
  }
  cands.sort((x, y) => x.cheap - y.cheap || x.order - y.order);
  let best = null;
  for (const c of cands) {
    if (best && c.cheap >= best.bad) break;
    const bad = c.cheap + sightPenalty(c.p, { spirits, subjects, floor, L, sees });
    if (!best || bad < best.bad) best = { yaw:c.yaw, lift:c.lift, bad };
    if (bad < .02) break;
  }
  return best;
}
/** Apply a `clearLens` answer to a lens position. */
export function swingLens(pos, pivot, { yaw = 0, lift = 0 } = {}) {
  if (!yaw && !lift) return pos.clone();
  const offset = pos.clone().sub(pivot), r = Math.hypot(offset.x, offset.z), len = offset.length();
  const e = Math.min(1.35, Math.atan2(offset.y, r) + THREE.MathUtils.degToRad(lift));
  const dirH = new THREE.Vector3(offset.x, 0, offset.z).normalize().applyAxisAngle(Y, THREE.MathUtils.degToRad(yaw));
  return pivot.clone().addScaledVector(dirH, Math.cos(e) * len).add(up(Math.sin(e) * len));
}

const up = y => new THREE.Vector3(0, y, 0);

/**
 * How far back along `dir` (unit, target → camera) the lens must stand to keep
 * every point in frame at `fovDeg` (vertical) and `aspect`.
 * ⭐ THIS IS THE FIX FOR "IT ZOOMS WAY IN TO NOTHING" (Alex, 2026-09-24). The
 * chair used to stand a FIXED 6.5 out and 7 up, aimed at where the dice were
 * going to land — so for the first second of every bout the screen was a close
 * shot of empty floor, and the two Spirits the bout is about were off the edge.
 * Every chair shot now fits the dice AND both Spirits, heads included.
 */
export function fitDistance(points, target, dir, fovDeg, aspect = BATTLE_DIRECTOR.aspect, margin = 1.12) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2), tanH = tanV * aspect;
  const right = new THREE.Vector3().crossVectors(Y, dir);
  if (right.lengthSq() < 1e-6) right.set(1, 0, 0); else right.normalize();
  const upv = new THREE.Vector3().crossVectors(dir, right).normalize();
  let d = 0;
  for (const p of points) {
    const v = p.clone().sub(target);
    const x = Math.abs(v.dot(right)) * margin, y = Math.abs(v.dot(upv)) * margin, z = v.dot(dir);
    d = Math.max(d, x / tanH + z, y / tanV + z);
  }
  return d;
}
const ease = p => { p = Math.max(0, Math.min(1, p)); return p * p * (3 - 2 * p); };
const Y = new THREE.Vector3(0, 1, 0);

/**
 * The horizontal unit vector square to the lane on the side AWAY from the
 * amps. The chair, the clash shot and the wide crowd shot all sit on it, so
 * nothing ever looks straight into a cabinet. With no amps known it is +z —
 * which is what the preview's layout gives anyway.
 */
export function frontSide(lane, mid, amps = []) {
  const side = new THREE.Vector3(-lane.z, 0, lane.x);
  const real = amps.filter(Boolean);
  if (real.length) {
    const at = real.reduce((s, a) => s.add(a), new THREE.Vector3()).multiplyScalar(1 / real.length).setY(0);
    if (side.dot(at.sub(mid.clone().setY(0))) > 0) side.negate();
  } else if (side.z < 0) side.negate();
  return side;
}

/**
 * Your chair's direction from the middle of the fight (unit, horizontal).
 * `lane` points attacker → Rival. The attacker sits on their own end of the
 * lane, swung `angle` degrees toward the front side; the Rival mirrors them.
 */
export function seatDirection(lane, you, angleDeg, front = new THREE.Vector3(0, 0, 1)) {
  const back = lane.clone().multiplyScalar(you === 'rival' ? 1 : -1);
  const a = THREE.MathUtils.degToRad(angleDeg);
  return back.multiplyScalar(Math.cos(a)).addScaledVector(front, Math.sin(a)).normalize();
}

/**
 * ⭐ THE DICE LAND ON THE BOARD BY THE FIGHT, laid out facing your chair, and
 * each pool leaves from its OWN player's side of the table — you watch the
 * Rival throw AT you. The layout is `createArenaDiceSequence`'s own; this only
 * places, turns and scales its group and re-points each die's launch point.
 * @returns the world point the dice settle around (for the chair to look at)
 */
export function placeBattleDice(dice, { lane, mid, you = 'attacker', front, L = BATTLE_DIRECTOR }) {
  const seat = seatDirection(lane, you, L.seatAngle, front);
  const g = dice.group, s = L.diceScale;
  g.scale.setScalar(s); g.rotation.set(0, Math.atan2(seat.x, seat.z), 0);
  const anchor = mid.clone().setY(0).addScaledVector(seat, L.diceOffset);
  const centre = new THREE.Vector3(1, 0, 6.2).multiplyScalar(s).applyEuler(g.rotation);
  g.position.copy(anchor).sub(centre).setY(mid.y + .02);
  const mine = you === 'rival' ? 1 : 0;
  for (const e of dice.entries ?? []) e.origin.set(e.landed.x * .35, 0, e.pool === mine ? 15 : -7);
  return anchor.setY(mid.y + .3);
}

/**
 * The shot for one second of the sequence.
 * @param ctx  { t, kind:'swing'|'sonic', you, lane, mid, spirits:[pos], amps:[pos],
 *               stands:[pos], dice:pos|null, beats, winner:0|1|null, shift, L }
 *   beats (swing): { T, settle, fans }  — T is `swingTimingFor().TIMING`
 *   beats (sonic): { S, result, fans } — S is `sonicScheduleFor()`
 *   Either `settle`/`result`/`fans` may be Infinity when the caller does the
 *   aftermath itself (the game does, after the overlay closes).
 */
export function directorShot(ctx) {
  const { t, lane, mid, spirits, amps, stands, beats } = ctx, L = { ...BATTLE_DIRECTOR, ...ctx.L };
  const front = frontSide(lane, mid, amps);
  const seat = seatDirection(lane, ctx.you, L.seatAngle, front);
  // `onFight` frames the pieces instead of the dice — the turn before anyone
  // throws, and the shove after — shifted toward the loser's new hex.
  // Which way each standee's PRINT faces (unit, horizontal). The caller passes
  // the real ones (`facings`, from each pawn's yaw); without them, each is
  // assumed to face the other down the lane — which is how a Sonic stands.
  const normals = spirits.map((_, i) => (ctx.facings?.[i]?.clone() ?? lane.clone().multiplyScalar(i ? -1 : 1)).setY(0).normalize());
  // Bend a horizontal lens direction just far enough toward the print (front
  // or back — the art reads from both sides) that it is at most acos(printMin)
  // off square. A direction already inside that cone is left exactly as it is.
  const readable = (dir, n) => {
    const c = dir.dot(n), face = n.clone().multiplyScalar(c < 0 ? -1 : 1);
    if (Math.abs(c) >= L.printMin) return dir;
    const want = Math.acos(L.printMin), side = new THREE.Vector3().crossVectors(face, dir).y >= 0 ? 1 : -1;
    return face.applyAxisAngle(Y, want * side).normalize();
  };
  const heads = () => spirits.flatMap(S => [S.clone().setY(mid.y), S.clone().setY(mid.y + L.standeeHeight)]);
  // 🔭 Every shot is settled by `clearLens` ONCE, the first frame it is asked
  // for, and holds that answer (`memo`, one per bout, kept by the caller) — so
  // a lens that had to swing round a cabinet does not hunt back and forth.
  const floor = mid.y, aspect = ctx.aspect ?? L.aspect, memo = ctx.memo ?? null;
  const settle = (key, pos, target, fov, subjects, { pivot = target, extra } = {}) => {
    let o = memo?.get(key);
    // Re-settled only if a Spirit has since moved (a shove, a knockback).
    if (!o || o.at?.some((p, j) => !spirits[j] || flat(p, spirits[j]) > .8)) {
      o = { ...clearLens({ pos, target, pivot, fov, aspect, spirits, subjects, floor, L, sees:ctx.sees, extra }), at:spirits.map(S => S.clone()) };
      memo?.set(key, o);
    }
    return swingLens(pos, pivot, o);
  };
  const seatShot = (key, onFight = false) => {
    const diceAt = ctx.dice ?? mid;
    const fight = mid.clone().add(up(1)).add(ctx.shift ?? new THREE.Vector3());
    const target = onFight ? fight : diceAt.clone().lerp(fight, L.seatLook);
    // Same chair, same angle as before — only the DISTANCE is now earned by
    // what has to be in frame: both Spirits, and the dice when there are dice.
    const dir = seat.clone().multiplyScalar(L.seatDist).add(up(L.seatHeight)).normalize();
    const must = onFight ? heads() : [...heads(), diceAt.clone().add(up(1.2)), diceAt.clone().addScaledVector(seat, -1.5)];
    const dist = Math.max(Math.hypot(L.seatDist, L.seatHeight), fitDistance(must, target, dir, 46, aspect));
    const pos = settle(key, target.clone().addScaledVector(dir, dist), target, 46, [0, 1]);
    return { key, kind:'seat', pos, target, focus:pos.distanceTo(target), fov:46 };
  };
  // 🎯 THE TWO-SHOT: both Spirits, head to toe, from the front side, pushing
  // in from wide over `pushTime` — with `lines`, which arenaRenderer turns into
  // the speed lines rushing in from the edge of the screen (speedLines.js).
  const twoShot = (key, age) => {
    const target = mid.clone().add(up(L.standeeHeight * .48));
    // ⭐ A THREE-QUARTER ANGLE, chosen, not assumed: swing off the front side
    // (away from the amps) by the SMALLEST angle that sees both prints well
    // (`twoGood`), else the best within `twoSwing`. Square to the lane is the
    // worst place to stand for two Spirits facing each other — and swinging
    // too far is the other failure: past ~45° the pair line up one behind the
    // other and it stops being a two-shot at all.
    // ⚠️ Scored on the RAY FROM THE LENS TO EACH STANDEE, not on the lens's
    // own heading: at two-shot range perspective matters — a heading that is
    // 45° off both prints still sees the NEAR one edge-on once it is framed.
    const rise = Math.atan2(L.twoHeight, 4);
    const view = (h, lift = 0) => { const e = rise + THREE.MathUtils.degToRad(lift);
      return h.clone().setY(0).normalize().multiplyScalar(Math.cos(e)).add(up(Math.sin(e))); };
    const frameAt = d => Math.max(L.twoMin, fitDistance(heads(), target, d, L.twoFov, aspect, L.twoMargin));
    const score = d => { const at = target.clone().addScaledVector(d, frameAt(d));
      return Math.min(...spirits.map((S, i) => Math.abs(at.clone().sub(S).setY(0).normalize().dot(normals[i])))); };
    // 🔭 …and CLEAR (2026-09-28): the smallest swing that sees both prints AND
    // has nothing between the lens and the pair — not at the tight framing,
    // and not at the wide one the push starts from either (the push used to
    // begin behind a stacked amp or the truss and drive in through it). If the
    // wide start is blocked the push starts closer, from the widest clear point.
    let o = memo?.get(key);
    if (!o) {
      const cheap = p => lensTrouble(p, target, { fov:L.twoFov, aspect, spirits, subjects:[0, 1], floor, L });
      const full = p => cheap(p) + sightPenalty(p, { spirits, subjects:[0, 1], floor, L, sees:ctx.sees });
      const cands = [];
      for (const lift of L.clearLift) for (let deg = 0; deg <= 90; deg += 5) for (const sgn of deg ? [1, -1] : [1]) {
        const d = view(front.clone().applyAxisAngle(Y, THREE.MathUtils.degToRad(deg * sgn)), lift), tight = frameAt(d);
        const base = 4 * Math.max(0, L.twoGood - score(d)) + (deg > L.twoSwing ? .3 : 0) + (deg + lift) * 1e-4;
        cands.push({ d, tight, deg:deg * sgn, lift, base, cheap:base + cheap(target.clone().addScaledVector(d, tight)), order:cands.length });
      }
      cands.sort((x, y) => x.cheap - y.cheap || x.order - y.order);
      for (const c of cands) {
        if (o && c.cheap >= o.bad) break;
        const near = full(target.clone().addScaledVector(c.d, c.tight));
        if (o && c.base + near >= o.bad) continue;
        // The widest start whose WHOLE path in is as clean as the landing.
        let from = 1;
        while (from < L.pushFrom - 1e-6 && full(target.clone().addScaledVector(c.d, c.tight * Math.min(L.pushFrom, from + .15))) <= near + .02)
          from = Math.min(L.pushFrom, from + .15);
        const bad = c.base + near + (L.pushFrom - from) * .2;
        if (!o || bad < o.bad) o = { deg:c.deg, lift:c.lift, from, bad };
        if (bad < .05) break;
      }
      memo?.set(key, o);
    }
    const dir = view(front.clone().applyAxisAngle(Y, THREE.MathUtils.degToRad(o.deg)), o.lift);
    const tight = frameAt(dir);
    const p = ease(age / L.pushTime);
    const dist = tight * THREE.MathUtils.lerp(o.from, 1, p);
    const pos = target.clone().addScaledVector(dir, dist);
    return { key, kind:'two', pos, target, focus:pos.distanceTo(target), fov:L.twoFov,
      lines: ease(age / .3) * (1 - .35 * ease((age - L.pushTime) / .6)), push:p };
  };
  const chargeShot = (key, i, pullAt, onto = 'amp') => {
    const S = spirits[i], A = amps[i] ?? stands[i], G = stands[i] ?? amps[i], fans = onto === 'fans';
    // ⭐ THE LENS STANDS ON THE LINE FROM THE AMP THROUGH THE STANDEE, so the
    // standee is in front and its amp (and the crowd beside it) directly
    // behind — then swings `orbit` degrees OUTWARD, away from the opponent, so
    // the other Spirit's hex is never in the foreground and the side-on print
    // is seen closer to square.
    // 📌 The fan shot swings the OTHER way — by then the print has turned back
    // to face the opponent, and from the outer side it would be edge-on.
    const outward = lane.clone().multiplyScalar(i ? 1 : -1);
    const base = S.clone().sub(fans ? G : A).setY(0).normalize();
    const turn = THREE.MathUtils.degToRad(fans ? -L.finalOrbit : L.chargeOrbit);
    const sign = base.clone().applyAxisAngle(Y, .01).dot(outward) > base.dot(outward) ? 1 : -1;
    // …and never so far round that the print goes edge-on — at some corners
    // the amp sits square to the way the Spirit faces, and the old lens then
    // filmed a sliver of acrylic in front of a cabinet ("pointing at nothing").
    const dir = readable(base.applyAxisAngle(Y, turn * sign), normals[i]);
    const dist = fans ? L.finalDist : L.chargeDist, height = fans ? L.finalHeight : L.chargeHeight;
    // Aim part-way from the standee toward what it is about to be about — its
    // amp for a charge, its crowd for the last shot — so both are in frame.
    // ⚠️ But never further than `chargeReach` / `finalReach` from the standee:
    // a fixed share of the way to an amp across the arena aimed the lens at
    // empty floor ("zooms really far into the arena — into nothing").
    const behind = fans ? G.clone().add(up(1.2)) : A.clone().setY(mid.y + 1.3);
    const chest = S.clone().setY(mid.y + 1.3), toward = behind.clone().sub(chest);
    const target = chest.clone().addScaledVector(toward, Math.min(fans ? L.finalFrame : L.chargeFrame,
      (fans ? L.finalReach : L.chargeReach) / Math.max(1e-6, toward.length())));
    // 🔭 Swung round the standee, never through the other Spirit: the old lens
    // stood on the amp → standee line, which at close range is often exactly
    // where the opponent is — a sheet of acrylic filling the screen.
    const printOff = p => { const c = Math.abs(p.clone().sub(S).setY(0).normalize().dot(normals[i]));
      return c < L.printMin ? 2 * (L.printMin - c) + .5 : 0; };
    const pos = settle(key, S.clone().setY(mid.y).addScaledVector(dir, dist).add(up(height)), target,
      fans ? L.finalFov : L.chargeFov, [i], { pivot:chest, extra:printOff });
    const near = pos.distanceTo(S.clone().setY(mid.y + 1.3));
    const far = fans ? pos.distanceTo(G.clone().add(up(1)))
      : (pos.distanceTo(A) + pos.distanceTo(G.clone().add(up(1)))) / 2;
    const p = ease((t - pullAt - L.pullDelay) / L.pullTime);
    return { key, kind:'charge', pos, target, focus:THREE.MathUtils.lerp(near, far, p), fov:fans ? L.finalFov : L.chargeFov, pull:p };
  };
  const sideShot = key => {
    const target = mid.clone().add(up(1.3));
    // Fitted like the chair (2026-09-24): at a fixed 5.5 the Rival's shield —
    // up to 2.4 across — and its shatter filled the lens and hid the fight.
    const dir = front.clone().multiplyScalar(L.sideDist).add(up(.5)).normalize();
    const dist = Math.max(L.sideDist, fitDistance(heads(), target, dir, 38, aspect, 1.3));
    const pos = settle(key, target.clone().addScaledVector(dir, dist), target, 38, [0, 1]);
    return { key, kind:'side', pos, target, focus:pos.distanceTo(target), fov:38 };
  };
  const bothCrowds = key => {
    const c = stands[0].clone().lerp(stands[1], .5);
    // Both stands are far either side of the fight, so this is WIDE and far.
    const target = mid.clone().lerp(c, .5).add(up(1));
    const pos = settle(key, mid.clone().addScaledVector(front, 13).add(up(6.5)), target, 52, []);
    return { key, kind:'crowds', pos, target, focus:pos.distanceTo(c), fov:52 };
  };
  const final = () => ctx.winner == null ? bothCrowds('final-tie')
    : chargeShot(`final-${ctx.winner}`, ctx.winner, beats.fans, 'fans');

  if (ctx.kind === 'aftermath') {
    // The game's own consequences (shove, wobble, fall) run after the overlay
    // closes; `t` here is seconds since it did.
    const settle = L.shoveTime + L.fanDelay;
    if (t < settle) return seatShot('shove', true);
    return ctx.winner == null ? bothCrowds('final-tie')
      : chargeShot(`final-${ctx.winner}`, ctx.winner, settle, 'fans');
  }
  // Before anybody throws, the bout opens on the two of them.
  if (ctx.intro != null && ctx.kind !== 'aftermath') return twoShot('intro', ctx.intro);
  if (ctx.kind === 'swing') {
    const T = beats.T;
    // The pair square up — from your chair, where the prints still read.
    if (t < 0) return seatShot('turn', true);
    if (t < T.attackerRaise) return seatShot('seat-attacker-roll');
    if (t < T.rival) return chargeShot('charge-0', 0, T.attackerAmp);
    if (t < T.rivalRaise) return seatShot('seat-rival-roll');
    if (t < T.read) return chargeShot('charge-1', 1, T.rivalAmp);
    // ⭐ The dice have lined up: push in on the pair before the strike.
    if (t < T.clash) return twoShot('focus', t - T.read);
    // ⚠️ Square-on only while the pieces are side-on. Once they turn back to
    // face each other a lane-square lens sees two edges, so the shove is
    // watched from your chair again.
    if (t < (beats.settle ?? Infinity)) return sideShot('clash');
    if (t < (beats.fans ?? Infinity)) return seatShot('shove', true);
    return final();
  }
  // Sonic: the Rival's Sustain first (it IS the shield), then the attacker.
  const S = beats.S;
  if (t < S.dice.landedAt[1] + .2) return seatShot('seat-rival-roll');
  if (t < S.gate) return chargeShot('charge-1', 1, S.dice.landedAt[1]);
  // ⭐ The attacker's dice settle and line up (the chair watches), then the
  // lens pushes in on the pair before the amps fire (Alex's beat list).
  if (t < S.dice.readAt) return seatShot('seat-attacker-roll');
  if (t < S.launch - L.sonicLead) return twoShot('focus', t - S.dice.readAt);
  if (t < S.launch + 1.5) return chargeShot('charge-0', 0, S.launch);
  if (t < (beats.result ?? Infinity)) return sideShot('barrage');
  if (t < (beats.fans ?? Infinity)) return seatShot('shove', true);
  return final();
}
