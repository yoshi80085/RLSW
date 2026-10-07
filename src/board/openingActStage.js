// ─── THE OPENING ACT ON THE LIVE ARENA ───────────────────────────────────────
// The Bardbarian and his storm over the real arena, the waiting pads, the crash
// landings, the hop onto the home hex, and the intro's camera — ported from
// `previews/bardbarian-intro/scene.js` at Alex's dial-in (2026-10-04).
//
// ⭐ IT READS ONE CLOCK AND OWNS NOTHING ELSE. The client puts `frame.opening`
// on the arena frame — wall-clock ms stamps from `openingAct.openingSchedule`
// and `entranceAt` — and this file draws whatever those stamps say `now` is.
// The rule (who waits, when they enter, the two fans) is the engine's
// (`engine/systems/entrance.js`); a standee standing on its pad here is
// presentation of a fact the reducer already decided.
//
// ⚠️ IT DRIVES PAWNS THROUGH `pose`, LIKE THE PYRO REACTION — the arena asks
// before easing a standee to its target, and a seat that is falling, waiting or
// hopping is placed here instead. A seat with nothing to show returns null and
// the arena has it back, so nothing here can strand a piece.

import * as THREE from 'three';
import { createBardbarian } from './bardbarian.js';
import { OPENING_ACT, padPoint, homePoint, homeNumFor, seatPose, smooth, clamp } from './openingAct.js';
import { standeeYaw, STANDEE_Y } from './standee.js';

const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true,
  opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide });

export function createOpeningActStage(root, { loader = new THREE.TextureLoader() } = {}) {
  const group = new THREE.Group(); group.name = 'Opening act'; root.add(group);
  // ⚠️ THE BARDBARIAN IS BUILT ON FIRST USE, not here: his texture load needs a
  // DOM, and the arena is also created by headless checks that never open a
  // match with the act on. No schedule, no god, no image request.
  let god = null;
  const summon = () => { if (!god) { god = createBardbarian(loader); god.group.visible = false; group.add(god.group); } return god; };
  const seats = new Map();   // id → pad, rings, shaft, shards
  let opening = null, shake = 0, envelope = 0, disposed = false;

  function buildSeat(id, corner, color) {
    const pad = new THREE.Group(); pad.name = `Waiting pad · ${id}`;
    const at = padPoint(corner); if (!at) return null;
    pad.position.set(at.x, at.y, at.z); group.add(pad);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(.87, 1.03, .16, 6), new THREE.MeshStandardMaterial({
      color: '#131a32', metalness: .65, roughness: .36, emissive: color, emissiveIntensity: .16 }));
    plate.position.y = -.09; pad.add(plate);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(.89, .018, 5, 6), glow(color, .8));
    edge.rotation.x = Math.PI / 2; pad.add(edge);
    const home = homePoint(corner);
    const homeRing = new THREE.Mesh(new THREE.RingGeometry(.73, .81, 6).rotateX(-Math.PI / 2), glow(color, .48));
    homeRing.position.set(home.x, home.y + .015, home.z); group.add(homeRing);
    const impactRings = Array.from({ length: 3 }, () => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(.7, .75, 64).rotateX(-Math.PI / 2), glow(color, 0));
      ring.position.set(at.x, at.y + .06, at.z); ring.visible = false; group.add(ring); return ring;
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.055, .62, 1, 12, 1, true), glow(color, 0));
    shaft.visible = false; group.add(shaft);
    const particles = new Float32Array(70 * 3), geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
    const shards = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size: .08, transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    shards.visible = false; group.add(shards);
    return { id, corner, homeNum: homeNumFor(corner), at: v(at.x, at.y, at.z), home: v(home.x, STANDEE_Y, home.z), pad, edge, homeRing, impactRings, shaft, shards };
  }
  function dropSeat(seat) {
    for (const o of [seat.pad, seat.homeRing, seat.shaft, seat.shards, ...seat.impactRings]) {
      o.removeFromParent(); o.traverse(c => { c.geometry?.dispose(); c.material?.dispose?.(); });
    }
  }

  return {
    /** `next` = frame.opening (or null); `spirits` = frame.spirits (for colour
     *  and the live waiting flag). Builds a pad per seat the schedule names. */
    update(next, spirits = []) {
      if (disposed) return;
      opening = next ?? null;
      // 🔊 A ring-out's beam-down hangs on a schedule with no intro (`noGod`): no Bardbarian.
      if (opening && !opening.noGod) summon();
      const want = new Set(Object.keys(opening?.seats ?? {}));
      for (const [id, seat] of seats) if (!want.has(id)) { dropSeat(seat); seats.delete(id); }
      for (const id of want) {
        if (seats.has(id)) continue;
        const sp = spirits.find(s => s.id === id), info = opening.seats[id];
        const seat = buildSeat(id, info.corner, sp?.color ?? '#9aa7ff');
        if (seat) seats.set(id, seat);
      }
      for (const sp of spirits) { const seat = seats.get(sp.id); if (seat) seat.waiting = !!sp.waiting; }
    },
    /** Advance the storm and the landings. `now` is performance.now(). */
    tick(now, { reduced = false } = {}) {
      if (disposed || !opening) { if (god) god.group.visible = false; shake = 0; envelope = 0; return; }
      const s = { ...OPENING_ACT, reduced };
      const t = (now - opening.startMs) / 1000, end = (opening.endMs - opening.startMs) / 1000;
      envelope = god ? god.update(t, s, end) : 0;
      shake = 0;
      for (const seat of seats.values()) {
        const info = opening.seats[seat.id], pose = seatPose(info, now, { reduced, waiting: seat.waiting });
        const age = pose.impactAge, entered = pose.progress >= 1;
        seat.edge.material.opacity = entered ? .12 : .65;
        seat.homeRing.material.opacity = entered ? .12 : pose.phase === 'riff' || pose.phase === 'step' ? .8 : .25;
        seat.impactRings.forEach((ring, k) => {
          const u = age - k * .1; ring.visible = !reduced && u >= 0 && u < 1;
          ring.scale.setScalar(1 + Math.max(0, u) * (3.3 + k * .8) * s.impact);
          ring.material.opacity = clamp(1 - u) * (.55 - k * .12);
        });
        seat.shaft.visible = !reduced && age > -.8 && age < .15;
        if (seat.shaft.visible) {
          seat.shaft.position.copy(seat.at).add(v(0, 8 + Math.max(0, pose.fall) / 2, 0));
          seat.shaft.scale.y = 16 + pose.fall;
          seat.shaft.material.opacity = Math.max(0, .25 * (1 - Math.abs(age + .25) / .55));
        }
        seat.shards.visible = !reduced && age >= 0 && age < 1.5;
        if (seat.shards.visible) {
          seat.shards.material.opacity = clamp(1 - age / 1.5);
          const pos = seat.shards.geometry.attributes.position;
          for (let j = 0; j < pos.count; j++) {
            const angle = j * 2.39996, speed = (.4 + (j % 11) * .21) * s.impact;
            pos.setXYZ(j, seat.at.x + Math.cos(angle) * age * speed,
              seat.at.y + Math.max(0, age * (1.1 + j % 7 * .24) - age * age * 2),
              seat.at.z + Math.sin(angle) * age * speed);
          }
          pos.needsUpdate = true;
        }
        if (!reduced && age >= 0 && age < 1) shake += Math.exp(-age * 7) * s.shake;
      }
    },
    /**
     * A standee's pose, or null to hand it back to the arena. Writes the carrier
     * (position, yaw, roll, squash) and returns `{ lift, acting }` for its frame().
     */
    pose(id, pawn, now, { reduced = false, cameraPos = null } = {}) {
      const seat = seats.get(id);
      if (!seat || !opening) return null;
      const info = opening.seats[id];
      // Owned while it waits on the pad, and from its riff until the hop lands.
      if (!seat.waiting && !(info?.riffAt != null && now < info.doneAt)) return null;
      // ⚠️ …unless the piece has already moved on from its home hex (a quick
      // walk during the riff): the real move wins and the arena takes it back.
      if (!seat.waiting && pawn.userData.num != null && pawn.userData.num !== seat.homeNum) return null;
      const st = seatPose(info, now, { reduced, waiting: seat.waiting });
      pawn.visible = st.visible;
      const age = st.impactAge, landing = age >= 0 && age < 1;
      const bounce = reduced ? 0 : landing ? Math.sin(clamp(age / .6) * Math.PI) * .28 * Math.exp(-age * 4) : 0;
      const hop = reduced ? 0 : Math.sin(st.progress * Math.PI) * .48;
      pawn.position.copy(seat.at).setY(STANDEE_Y).lerp(seat.home, st.progress);
      pawn.position.y += st.fall + bounce + hop;
      // Faces the camera while it waits and plays; turns to its game facing on arrival.
      const finalYaw = pawn.userData.targetFacing ?? standeeYaw(0);
      const performYaw = cameraPos ? Math.atan2(cameraPos.x - seat.at.x, cameraPos.z - seat.at.z) : finalYaw;
      const turn = (st.phase === 'riff' || st.phase === 'step' ? 1 : .7) * (1 - st.progress);
      pawn.rotation.y = finalYaw + Math.atan2(Math.sin(performYaw - finalYaw), Math.cos(performYaw - finalYaw)) * turn;
      let roll = reduced ? 0 : landing ? Math.sin(age * 24) * .075 * Math.exp(-age * 5) : 0;
      if (!reduced && st.phase === 'riff') roll = Math.sin(now / 1000 * 9) * .025;
      pawn.rotation.z = roll;
      const squash = reduced || !landing ? 0 : Math.exp(-age * 18) * .17;
      pawn.scale.set(1 + squash, 1 - squash, 1 + squash);
      return { lift: st.fall + hop, acting: st.phase === 'riff' || st.phase === 'step' };
    },
    /** True while any seat is falling, playing or hopping — the arena keeps drawing. */
    busy(now) {
      if (!opening) return false;
      if (now < opening.endMs + 3000) return true;
      return [...seats.values()].some(seat => { const i = opening.seats[seat.id];
        return (i?.doneAt && now < i.doneAt + 300) || (i?.landingAt && now > i.landingAt - 1200 && now < i.landingAt + 1600); });
    },
    /**
     * The intro's lens (the preview's 'cinematic' camera): a wide establishing
     * shot that meets the board as the last Spirit lands, leaning toward each
     * pad while its riff plays. Null once the intro and seat one's step are over.
     */
    camera(now, aspect, { reduced = false } = {}) {
      if (!opening || now > opening.cameraUntil) return null;
      const t = (now - opening.startMs) / 1000, end = (opening.endMs - opening.startMs) / 1000;
      const blend = reduced ? 0 : smooth((t - end + 1.2) / 3);
      const pad = Math.max(1, 1.6 / Math.max(.25, aspect));
      const position = v(0, 22, 57).multiplyScalar(pad).lerp(v(0, 23, 29).multiplyScalar(pad), blend);
      const target = v(0, 8.5, -3).lerp(v(0, .5, 0), blend);
      if (!reduced && OPENING_ACT.camera === 'cinematic') {
        for (const seat of seats.values()) {
          const i = opening.seats[seat.id]; if (i?.riffAt == null) continue;
          const hold = (i.doneAt - i.riffAt) / 1000, since = (now - i.riffAt) / 1000;
          const focus = smooth(since / 1.1) * (1 - smooth((since - hold + .3) / 1.2));
          position.addScaledVector(seat.at, focus * .28); target.addScaledVector(seat.at, focus * .25);
        }
        position.x += Math.sin(now / 1000 * 61) * shake * .24; position.y += Math.sin(now / 1000 * 53) * shake * .13;
      }
      return { position, target, blend };
    },
    /** How strongly the intro's own look (bloom, exposure) is on, 0..1. */
    get envelope() { return envelope; },
    diagnostics: () => ({ pads: seats.size, god: !!god?.group.visible, envelope, shake }),
    dispose() {
      if (disposed) return; disposed = true;
      for (const seat of seats.values()) dropSeat(seat); seats.clear();
      god?.dispose(); group.removeFromParent();
    },
  };
}
