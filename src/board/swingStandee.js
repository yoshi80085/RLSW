// ─── SWING STANDEES — the stick figures, cut into acrylic ───────────────────
// Alex, 2026-09-24: "the 3D stick figure models - I'd like them inside an
// acrylic standee - just as the game pieces currently are", and "for a Swing
// attack, I'd like the standees to change direction so that the 'thin' sides
// face each other".
//
// ⭐ PORTED 2026-09-24 off `.scratch/battle-sequence-preview.html` (which now
// imports this file). It WRAPS the real `createSwingClashVisuals` figures after
// they are built — the poses, the raise, the shake, the beams and the camera
// focus are all still that module's. `arenaVisuals.updateSwing` wraps every
// Swing; the preview wraps its own.
//
// 🎯 THE GEOMETRY OF "THIN SIDES FACING EACH OTHER". A standee's broad face
// normally points where the Spirit faces (`standee.js` ruling 1). For a Swing
// the two are on ADJACENT hexes, so each sheet pivots until its plane CONTAINS
// the lane: the table sees both Spirits in profile, like a fighting game, and
// the cut edges point at each other. The stick figure's forward is local +z,
// so its profile lives in the carrier's local YZ plane — the sheet is built in
// exactly that plane and its normal is local x.
//
// 🎭 2026-09-24 (second pass) — THE ART SWAP. The Spirit's real printed standee
// (`createStandee`, the board piece itself) stands there before the turn and
// after the turn back; the stick-figure sheet only exists while it is side-on.
// The swap happens part-way through each turn (`swapAt`), because mid-turn is
// when the sheet is least readable and a change of print is least jarring.
//
// 🎸 2026-10-06 — A SPIRIT WITH ITS OWN THRASH ART PLAYS IT (Alex: "phase 1 of
// Thrash is Thrash1, phase 2 is Thrash2", and the 'hit' when he loses). For a
// side whose standee has the `thrash1` and `thrash2` poses (`standee.js` 1b,
// `data/standeePoses.js` — the Ronin), there is NO stick figure: his own
// printed standee turns side-on and swaps print on the stick figure's own
// beats — 'ready' (the raise) → thrash1, 'strike' (the clash) → thrash2, and
// from the result on, if he lost or tied, → hit. ⭐ His print is turned to face
// the FRONT side (the battle director's, away from the amps — where the lens
// films the bout from), because his back is blank now; and the drawings strike
// to their RIGHT, so where facing the front would aim him away from the Rival,
// the posed print is mirrored. The mirror goes on with the first pose swap,
// never on his base print, so the flip is hidden inside the change of drawing.
import * as THREE from 'three';
import { STANDEE, ribbons, createStandee } from './standee.js';

export const STICK_STANDEE = Object.freeze({
  depth:.15, thickness:STANDEE.thickness, margin:.16, edgeGlow:STANDEE.edgeGlow,
  pass:.14, closeIn:0, cut:'pose', base:.46,
  lead:1, turnTime:.5, backAfter:.4, turnFrom:'toward', rivalFrom:'toward', back:'on', swapAt:.5,
});

/**
 * Where each side's sheet starts, as a pivot yaw. 0 is side-on (the Swing
 * stance); −90° is broadside TO the other Spirit (the art faces them).
 * 📌 The attacker always starts facing the Rival — a Swing is declared at a
 * neighbour you are looking at. The Rival can be caught facing anywhere.
 */
export const START_YAW = Object.freeze({
  toward:-Math.PI / 2, away:Math.PI / 2, angled:-Math.PI / 6, side:0,
});

// ── pure: the cut ───────────────────────────────────────────────────────────
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
/** Andrew's monotone chain. A cut you could actually laser — no concave notches. */
export function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (hi.length >= 2 && cross(hi.at(-2), hi.at(-1), q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1));
}
/**
 * The hull grown by `margin` all round (rounded corners), with a flat foot.
 * ⚠️ The foot is clamped to just above the stand, not to 0 — a sheet that
 * dips below the base's top face pokes out underneath the hex disc.
 */
export function cutOutline(points, margin, foot = .02) {
  const grown = [];
  for (const [x, y] of hull(points)) for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2; grown.push([x + Math.cos(a) * margin, y + Math.sin(a) * margin]);
  }
  const out = [];
  for (const [x, y] of hull(grown)) {
    const q = [x, Math.max(foot, y)], last = out.at(-1);
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 1e-4) out.push(q);
  }
  return out;
}

/** Every vertex of a pose, in the pose's own frame, as (forward z, up y). */
function profileOf(pose) {
  pose.updateWorldMatrix(true, true);
  const inv = pose.matrixWorld.clone().invert(), v = new THREE.Vector3(), pts = [];
  pose.traverse(o => {
    if (!o.isMesh) return;
    const m = inv.clone().multiply(o.matrixWorld), pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(m); pts.push([v.z, v.y]); }
  });
  // 📌 The foot of the sheet always spans the stand, even for a pose whose
  // legs collapse to one line in profile.
  pts.push([-.3, .05], [.3, .05]);
  return pts;
}

// ── three: one acrylic sheet in the local YZ plane ──────────────────────────
function sheet(outline, color, T) {
  const group = new THREE.Group(); group.name = 'Stick standee sheet';
  const edgeColor = new THREE.Color(color).multiplyScalar(T.edgeGlow);
  const shape = new THREE.Shape(outline.map(([u, v]) => new THREE.Vector2(u, v)));
  // Shape x = forward → local +z; extrude z → local x (the sheet normal).
  const panelGeo = new THREE.ExtrudeGeometry(shape, { depth:T.thickness, bevelEnabled:false });
  panelGeo.translate(0, 0, -T.thickness / 2).rotateY(-Math.PI / 2);
  // ⚠️ The SAME acrylic as `createStandee` (glass look, Alex's dial-in),
  // re-stated because that function builds its sheet from a traced Spirit
  // outline and cannot be handed an arbitrary cut. Port: share the material.
  const panel = new THREE.Mesh(panelGeo, new THREE.MeshPhysicalMaterial({
    color:0xffffff, transmission:1, ior:1.49, thickness:T.thickness * 4,
    attenuationColor:new THREE.Color(STANDEE.panelTint),
    attenuationDistance:Math.max(.4, T.thickness * 2 / Math.max(.02, STANDEE.panelOpacity)),
    roughness:Math.max(.02, (1 - STANDEE.gloss) * .6), metalness:0,
    clearcoat:STANDEE.gloss, clearcoatRoughness:(1 - STANDEE.gloss) * .4,
    // ⚠️ NEVER depthWrite — same trap as the real standee: the sheet's near
    // face would hide the figure inside it.
    side:THREE.DoubleSide, depthWrite:false, emissive:edgeColor, emissiveIntensity:STANDEE.edgeSpread * .25,
  }));
  panel.renderOrder = 8; group.add(panel);
  // `ribbons` maps [x, y] → [(x − .5)·h·(w/h), (1 − y)·h]; with w = h = height = 1
  // that is (u, v) back again from [u + .5, 1 − v].
  const edgeGeo = ribbons([outline.map(([u, v]) => [u + .5, 1 - v])], 1, 1, 1, T.thickness, 1).rotateY(-Math.PI / 2);
  const edge = new THREE.Mesh(edgeGeo, new THREE.MeshStandardMaterial({ color:0x0b1020, emissive:edgeColor,
    emissiveIntensity:1, roughness:.35, metalness:.2, side:THREE.DoubleSide }));
  edge.renderOrder = 9; group.add(edge);
  return group;
}

function stand(color, T) {
  const group = new THREE.Group(), r = T.base, c = new THREE.Color(color);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * .85, r, .1, 6).rotateY(Math.PI / 6),
    new THREE.MeshStandardMaterial({ color:0x111a2d, metalness:.65, roughness:.4, emissive:c, emissiveIntensity:.25 * STANDEE.baseGlow }));
  disc.position.y = .05;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(r * 1.08, .05, 8, 36).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color:c.clone().multiplyScalar(1.6 * STANDEE.baseGlow), toneMapped:false }));
  halo.position.y = .1;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(r * 1.4, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:STANDEE.shadow, depthWrite:false }));
  shadow.position.y = -.01;
  group.add(disc, halo, shadow);
  return group;
}

const ease = p => p * p * (3 - 2 * p);
const clamp01 = x => Math.max(0, Math.min(1, x));

/**
 * Wrap a built `createSwingClashVisuals` in standees. Mutates its figures'
 * `start`/`end` (the only positions its `update` reads), so the shipped
 * update keeps driving everything — raise hop, shake, beams — unchanged.
 *
 * @param spirits `[{ id, color, imageSrc }]` per side, or null for no art swap.
 * @returns `{ update(t, { knockedOut }), rigs, turnAt, backAt }` — call
 *   `update` AFTER the real `update(t)` each frame.
 */
/** True when a built standee can play a Thrash in its own art (has both phases). */
export const playsOwnThrash = art => !!art?.poses?.includes('thrash1') && art.poses.includes('thrash2');

/**
 * The pose a side with its own Thrash art shows at sequence time `t` — pure, so
 * the beats can be asserted without a scene. `figure` is which stick pose the
 * real sequence shows ('idle' | 'ready' | 'strike'), `lost` whether this side
 * lost or tied (null while unknown), `home` whether the sheet has turned back.
 */
export function thrashPose({ t, figure, resultAt, lost = null, home = false }) {
  if (lost && t >= resultAt) return 'hit';
  if (home) return null;
  return figure === 'strike' ? 'thrash2' : figure === 'ready' ? 'thrash1' : null;
}

export function wrapClashStandees(live, colors, T = STICK_STANDEE, spirits = null, { front = null, loader } = {}) {
  const [A, B] = live.figures;
  const lane = B.start.clone().sub(A.start).setY(0).normalize();
  const side = new THREE.Vector3(-lane.z, 0, lane.x);
  const rigs = live.figures.map((f, i) => {
    // ⭐ HOLD THE HEX. A Swing is only legal between neighbours, so there is
    // nowhere to walk to. `closeIn` 1 is the old approach, kept for comparison.
    // 📌 `pass` slides the two sheets apart sideways so the instruments cross
    // like blades instead of the sheets cutting through each other.
    const travel = f.end.clone().sub(f.start);
    f.start.addScaledVector(side, (i ? -1 : 1) * T.pass);
    f.end.copy(f.start).addScaledVector(travel, T.closeIn);
    const poses = [f.idle, f.ready, f.strike];
    const profiles = poses.map(profileOf);      // measured BEFORE flattening
    const pivot = new THREE.Group(); pivot.name = 'Standee pivot';
    f.carrier.add(pivot);
    const stick = new THREE.Group(); stick.name = 'Stick-figure standee'; pivot.add(stick);
    for (const p of poses) { stick.add(p); p.scale.x = T.depth; }
    const sheets = T.cut === 'card'
      ? [sheet(cutOutline(profiles.flat(), T.margin), colors[i], T)]
      : profiles.map(p => sheet(cutOutline(p, T.margin), colors[i], T));
    for (const s of sheets) stick.add(s);
    stick.add(stand(colors[i], T));
    // The board piece. Its art normal is its local +z; the stick sheet's is the
    // pivot's local x, so a quarter turn puts both prints on the same face.
    let art = null;
    if (spirits?.[i]) {
      art = createStandee(spirits[i], loader ? { loader } : undefined);
      art.group.rotation.y = Math.PI / 2;
      pivot.add(art.group);
    }
    const from = T.turnFrom === 'none' ? 0 : START_YAW[i ? T.rivalFrom : 'toward'] ?? START_YAW.toward;
    // 🎸 Its own Thrash art: where the turn ends, and whether the poses mirror.
    // The print's normal is the pivot's +x at yaw 0 and −x at yaw −π; the
    // drawing's RIGHT (where he strikes) is the carrier's −z at 0 and +z — the
    // Rival — at −π. So: the front on +x → end at 0, mirrored; else end at −π.
    const own = playsOwnThrash(art);
    let end = 0, mirror = false;
    if (own) {
      const sideX = new THREE.Vector3(1, 0, 0).applyQuaternion(f.carrier.quaternion);
      const onX = !!front && sideX.dot(front) > 0;
      end = onX ? 0 : -Math.PI; mirror = onX;
      stick.visible = false;
    }
    return { f, poses, sheets, pivot, stick, art, from, own, end, mirror };
  });
  const turnStart = T.turnFrom === 'none' ? -Infinity : -T.lead;
  const backAt = T.back === 'on' ? live.T.result + T.backAfter : Infinity;
  return {
    rigs, lane, turnAt:T.turnFrom === 'none' ? null : turnStart, backAt,
    backEnd:backAt + T.turnTime,
    /**
     * @param turnT seconds since the pieces were asked to turn. The preview
     *   runs the turn as a lead-in BEFORE the attacker's throw (negative `t`);
     *   the game's clock sits at 0 until that throw, so it passes the seconds
     *   since the Swing OPENED instead. Omitted → `t + lead`, the preview's.
     */
    // @param winner 0 | 1, null for a tie, undefined while unknown — only the
    //   sides that play their own Thrash art read it (the 'hit' print).
    update(t, { knockedOut = [false, false], reduced = false, turnT = t + T.lead, winner } = {}) {
      const into = T.turnFrom === 'none' ? 1 : ease(clamp01(turnT / T.turnTime));
      const back = ease(clamp01((t - backAt) / T.turnTime));
      // ⚠️ The swap reads the RAW turn progress on both legs, so a swapAt of
      // .5 is "halfway round" going in AND coming back, not two different moments.
      const stickShown = (T.turnFrom === 'none' || into >= T.swapAt) && back < T.swapAt;
      for (const [i, r] of rigs.entries()) {
        r.pivot.rotation.y = r.from + (r.end - r.from) * (into - back);
        if (r.own) {
          // 🎸 His own print the whole bout, on the stick figure's beats.
          const figure = r.f.strike.visible ? 'strike' : r.f.ready.visible ? 'ready' : 'idle';
          const lost = winner === undefined ? null : winner === null || winner === 1 - i;
          const pose = thrashPose({ t, figure, resultAt:live.T.result, lost, home:back >= T.swapAt });
          r.art.setPose(pose);
          r.art.group.scale.x = r.mirror && pose ? -1 : 1;
          r.art.group.visible = true;
          r.art.frame(Math.max(0, t), { knockedOut:knockedOut[i], reduced });
          continue;
        }
        r.stick.visible = stickShown || !r.art;
        if (r.art) {
          r.art.group.visible = !r.stick.visible;
          r.art.frame(Math.max(0, t), { knockedOut:knockedOut[i], reduced });
        }
        if (r.sheets.length > 1) r.sheets.forEach((s, k) => (s.visible = r.poses[k].visible));
      }
    },
    /**
     * Which way each side's print faces now, world, horizontal — for the battle
     * director. The stick sheet faces the carrier's +x; a side playing its own
     * art faces wherever its standee's face (local +z) points.
     */
    facings() {
      return rigs.map(r => {
        if (r.own) r.art.group.updateWorldMatrix(true, false);
        const n = r.own ? r.art.group.getWorldDirection(new THREE.Vector3())
          : new THREE.Vector3(1, 0, 0).applyQuaternion(r.f.carrier.getWorldQuaternion(new THREE.Quaternion()));
        return n.setY(0).normalize();
      });
    },
  };
}
