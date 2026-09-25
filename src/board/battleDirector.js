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
});

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
  const seatShot = (key, onFight = false) => {
    const diceAt = ctx.dice ?? mid;
    const fight = mid.clone().add(up(1)).add(ctx.shift ?? new THREE.Vector3());
    const target = onFight ? fight : diceAt.clone().lerp(fight, L.seatLook);
    // Same chair, same angle as before — only the DISTANCE is now earned by
    // what has to be in frame: both Spirits, and the dice when there are dice.
    const dir = seat.clone().multiplyScalar(L.seatDist).add(up(L.seatHeight)).normalize();
    const must = onFight ? heads() : [...heads(), diceAt.clone().add(up(1.2)), diceAt.clone().addScaledVector(seat, -1.5)];
    const dist = Math.max(Math.hypot(L.seatDist, L.seatHeight), fitDistance(must, target, dir, 46, ctx.aspect ?? L.aspect));
    const pos = target.clone().addScaledVector(dir, dist);
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
    const view = h => h.clone().multiplyScalar(4).add(up(L.twoHeight)).normalize();
    const frameAt = d => Math.max(L.twoMin, fitDistance(heads(), target, d, L.twoFov, ctx.aspect ?? L.aspect, L.twoMargin));
    const score = d => { const at = target.clone().addScaledVector(d, frameAt(d));
      return Math.min(...spirits.map((S, i) => Math.abs(at.clone().sub(S).setY(0).normalize().dot(normals[i])))); };
    let dir = view(front), bestScore = score(dir);
    search: for (let deg = 5; deg <= L.twoSwing; deg += 5) for (const sgn of [1, -1]) {
      if (bestScore >= L.twoGood) break search;
      const d = view(front.clone().applyAxisAngle(Y, THREE.MathUtils.degToRad(deg * sgn))), sc = score(d);
      if (sc > bestScore + 1e-3) { dir = d; bestScore = sc; }
    }
    const tight = frameAt(dir);
    const p = ease(age / L.pushTime);
    const dist = tight * THREE.MathUtils.lerp(L.pushFrom, 1, p);
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
    const pos = S.clone().setY(mid.y).addScaledVector(dir, dist).add(up(height));
    // Aim part-way from the standee toward what it is about to be about — its
    // amp for a charge, its crowd for the last shot — so both are in frame.
    const behind = fans ? G.clone().add(up(1.2)) : A.clone().setY(mid.y + 1.3);
    const target = S.clone().setY(mid.y + 1.3).lerp(behind, fans ? L.finalFrame : L.chargeFrame);
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
    const dist = Math.max(L.sideDist, fitDistance(heads(), target, dir, 38, ctx.aspect ?? L.aspect, 1.3));
    const pos = target.clone().addScaledVector(dir, dist);
    return { key, kind:'side', pos, target, focus:pos.distanceTo(target), fov:38 };
  };
  const bothCrowds = key => {
    const c = stands[0].clone().lerp(stands[1], .5);
    // Both stands are far either side of the fight, so this is WIDE and far.
    const pos = mid.clone().addScaledVector(front, 13).add(up(6.5));
    const target = mid.clone().lerp(c, .5).add(up(1));
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
