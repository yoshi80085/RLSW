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
export function wrapClashStandees(live, colors, T = STICK_STANDEE, spirits = null) {
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
      art = createStandee(spirits[i]);
      art.group.rotation.y = Math.PI / 2;
      pivot.add(art.group);
    }
    const from = T.turnFrom === 'none' ? 0 : START_YAW[i ? T.rivalFrom : 'toward'] ?? START_YAW.toward;
    return { f, poses, sheets, pivot, stick, art, from };
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
    update(t, { knockedOut = [false, false], reduced = false, turnT = t + T.lead } = {}) {
      const into = T.turnFrom === 'none' ? 1 : ease(clamp01(turnT / T.turnTime));
      const back = ease(clamp01((t - backAt) / T.turnTime));
      // ⚠️ The swap reads the RAW turn progress on both legs, so a swapAt of
      // .5 is "halfway round" going in AND coming back, not two different moments.
      const stickShown = (T.turnFrom === 'none' || into >= T.swapAt) && back < T.swapAt;
      for (const [i, r] of rigs.entries()) {
        r.pivot.rotation.y = r.from * (1 - into + back);
        r.stick.visible = stickShown || !r.art;
        if (r.art) {
          r.art.group.visible = !r.stick.visible;
          r.art.frame(Math.max(0, t), { knockedOut:knockedOut[i], reduced });
        }
        if (r.sheets.length > 1) r.sheets.forEach((s, k) => (s.visible = r.poses[k].visible));
      }
    },
  };
}
