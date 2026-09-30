// ─── 🎭 STANDEE STEPS — the queue, the landing light, the landing sound ──────
// The three.js half of `standeeMotion.js` (Alex's dial-in, 2026-09-30). The
// pure half says where a piece is `ms` into a step; this half keeps each
// pawn's queue of steps, drives the pawn through them, and at touch-down lights
// the hex (a ripple, a flash, sparkles) and rings the landing through
// `audio/landingSfx.js`.
//
// ⭐ WHAT IT REPLACED: `arenaVisuals` used to `lerp` every pawn toward its
// target at rate 14 — a straight, silent ~0.2 s slide, and a second step
// mid-slide simply re-aimed it. Now each hex change is QUEUED and played out:
// a hop for a walk step, a blink for a leap (Shukuchi), a skate backwards with
// a clack for a shove. Fast clicks queue and speed up (`catchUp`), they never
// skip a landing.
//
// ⚠️ THE CARRIER CONTRACT CHANGES, ON PURPOSE. `standee.js` says the caller
// owns only where the piece stands and which way it turns. While a step runs
// this module also owns the group's TILT (`rotation.x`, plus a `roll` handed
// back for `rotation.z`) and its SQUASH (`scale`), and hands the standee a
// `lift` so its shadow and acting ring stay on the deck. Between steps it
// hands everything back at rest (tilt 0, scale 1).
//
// ⚠️ IT NEVER TOUCHES `pawn.visible` — the Swing hides the real pawns and
// shows its own figures, and a blink fighting that would put a Spirit on the
// board twice. The blink's "gone" is a scale of ~0 instead.
//
// ⚠️ It only ever sees a hex number change (`stepKind`): a bot that takes two
// steps inside one frame reads as a 2-hex leap and blinks. Rare, harmless, noted.
import * as THREE from 'three';
import { STANDEE_MOVE, planStep, stepPose, reducedPose, angleDelta, stepKind, styleFor, landingNotes } from './standeeMotion.js';
import { STANDEE_Y } from './standee.js';

const midiFreq = m => 440 * Math.pow(2, (m - 69) / 12);

/**
 * @param root the scene the landing light goes in (the arena's, like the move tiles)
 * @param o.pointFor `(num, y) → Vector3 | null` — `arenaPoint`
 * @param o.distance `(fromNum, toNum) → hexes` — axial distance on the real map
 * @param o.scaleFor `(spiritId) → scale intervals` — the Spirit's palette
 * @param o.sfx a `createLandingSfx()` (null = silent: headless, tests)
 */
export function createStandeeSteps(root, { pointFor, distance, scaleFor, sfx = null, T = STANDEE_MOVE } = {}) {
  const group = new THREE.Group(); group.name = 'Standee landings'; root.add(group);
  const ringGeo = new THREE.RingGeometry(0.86, 1, 6, 1).rotateX(-Math.PI / 2);
  const hexGeo = new THREE.CircleGeometry(0.93, 6).rotateX(-Math.PI / 2);
  const puckGeo = new THREE.CircleGeometry(0.42, 6).rotateX(-Math.PI / 2);
  const beamGeo = new THREE.CylinderGeometry(0.5, 0.62, 3.6, 28, 1, true);
  const fx = [];
  const glow = color => new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0, depthWrite:false,
    blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide });
  const velJit = () => 1 - Math.random() * T.velJitter;
  const human = f => f * Math.pow(2, ((Math.random() * 2 - 1) * T.humanise) / 1200);
  sfx?.setMix?.({ vol:T.volume, room:T.room, roomLen:T.roomLen, echoAmt:T.echo, echoSec:T.echoTime });

  const stateOf = pawn => (pawn.userData.steps ??= { queue:[], cur:null, walk:{}, lastPuck:0, beams:null });

  // ♿ Reduced motion keeps the hex lighting up (a fade) but drops the expanding
  // ripple and the flying sparkles — those are motion.
  function landingLight(at, color, reduced = false) {
    const col = T.rippleColor === 'white' ? new THREE.Color(0xffffff) : T.rippleColor === 'cyan' ? new THREE.Color(0x9fe8ff) : new THREE.Color(color ?? 0xffffff);
    const now = performance.now();
    if (T.ripple === 'on' && !reduced) {
      for (const [delay, sc] of [[0, 1], [90, 0.75]]) {
        const m = new THREE.Mesh(ringGeo, glow(col)); m.position.set(at.x, STANDEE_Y + 0.015, at.z); m.visible = false; group.add(m);
        fx.push({ kind:'ripple', obj:m, t0:now + delay, dur:T.rippleMs, size:T.rippleSize * sc });
      }
    }
    if (T.tileFlash > 0) {
      // 📌 The preview lit its own tile; the board's hexes are the SVG's, so the
      // flash is a hex of light laid on the deck instead.
      const m = new THREE.Mesh(hexGeo, glow(col)); m.position.set(at.x, STANDEE_Y + 0.008, at.z); group.add(m);
      fx.push({ kind:'flash', obj:m, t0:now, dur:900, peak:T.tileFlash });
    }
    if (T.sparkles > 0 && !reduced) {
      const n = T.sparkles, pos = new Float32Array(n * 3), vel = [];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 0.5;
        pos.set([at.x + Math.cos(a) * r, STANDEE_Y + 0.1 + Math.random() * 0.4, at.z + Math.sin(a) * r], i * 3);
        vel.push([Math.cos(a) * (0.6 + Math.random()), 2 + Math.random() * 2.2, Math.sin(a) * (0.6 + Math.random())]);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color:col.clone().lerp(new THREE.Color(0xffffff), 0.5), size:0.14,
        transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
      group.add(pts); fx.push({ kind:'sparkle', obj:pts, t0:now, dur:850, vel });
    }
  }

  function start(pawn, S, now) {
    const item = S.queue.shift();
    if (!item) { S.cur = null; return; }
    const from = S.at ?? item.fromPoint, to = item.toPoint;
    const yaw0 = pawn.rotation.y, yaw1 = yaw0 + angleDelta(yaw0, item.yaw);
    const style = styleFor(item.id, item.kind, T);
    const step = { style, kind:item.kind, bot:item.bot, yaw0, yaw1, from, to, speed:Math.min(3, 1 + T.catchUp * S.queue.length) };
    const plan = planStep(step, T);
    const d = to.clone().sub(from).setY(0).normalize();
    const f = new THREE.Vector3(Math.sin(yaw1), 0, Math.cos(yaw1)), right = new THREE.Vector3(Math.cos(yaw1), 0, -Math.sin(yaw1));
    const scale = scaleFor?.(item.id) ?? [0];
    const notes = style === 'shipped' ? null : landingNotes({ scale, kind:item.kind, now, walk:S.walk }, T);
    S.at = to;
    S.cur = { step, plan, lean:{ fwd:d.dot(f), side:d.dot(right) }, notes, t0:now, fired:{}, color:item.color };
  }

  function onTravel(cur) {
    const { step, plan, notes } = cur;
    if (!notes || !sfx) return;
    const vel = velJit() * (step.bot ? T.botVol : 1), f = midiFreq(notes.midis[0]);
    if (T.takeoff === 'on' && (step.style === 'hop' || step.style === 'lift')) sfx.takeoff(f, { vel });
    if (step.kind !== 'shove') sfx.travel(T.travelSound, (plan.land - plan.turnMs - plan.pre) / 1000, f, { vel });
  }

  function onLand(cur, reduced) {
    const { step, notes } = cur;
    if (step.style === 'shipped') return;
    landingLight(step.to, cur.color, reduced);
    if (!notes || !sfx) return;
    const vel = velJit() * (step.bot ? T.botVol : 1);
    if (step.kind === 'shove' && T.shoveSound !== 'same') {
      if (T.shoveSound === 'clack') sfx.clack(midiFreq(notes.midis[0]), { vel });
    } else {
      sfx.land(T.voice, notes.midis.map(m => human(midiFreq(m))), { vel, ring:T.ring, bright:T.bright, sparkle:T.sparkleTail, weight:T.weight });
    }
  }

  return {
    group,
    /**
     * A pawn's hex changed. Queue the step — nothing moves until `drive`.
     * @param o `{ id, from, to, yaw, shoved, bot, color }` — hex numbers, the target yaw
     */
    step(pawn, { id, from, to, yaw, shoved = false, bot = false, color }) {
      const fromPoint = pointFor(from, STANDEE_Y), toPoint = pointFor(to, STANDEE_Y);
      if (!fromPoint || !toPoint) return false;
      const S = stateOf(pawn);
      if (!S.cur && !S.queue.length) S.at = pawn.position.clone().setY(STANDEE_Y);
      const kind = stepKind(distance?.(from, to) ?? 1, { shoved });
      S.queue.push({ id, kind, bot, color, yaw, fromPoint, toPoint });
      return true;
    },
    /** Is this pawn mid-step (or waiting on one)? */
    busy:pawn => !!(pawn.userData.steps && (pawn.userData.steps.cur || pawn.userData.steps.queue.length)),
    /**
     * Move the pawn along its current step. Returns `null` when there is no
     * step (the caller rests the pawn as before), else `{ roll, lift }`.
     */
    drive(pawn, now, reduced = false) {
      const S = pawn.userData.steps;
      if (!S) return null;
      if (!S.cur) start(pawn, S, now);
      const cur = S.cur;
      if (!cur) return null;
      const { step, plan, lean } = cur;
      const ms = now - cur.t0;
      const P = reduced ? reducedPose(step) : stepPose(step, plan, ms, T, lean);
      if (!cur.fired.travel && (reduced || ms >= plan.turnMs + plan.pre)) { cur.fired.travel = true; if (!reduced) onTravel(cur); }
      if (!cur.fired.land && (reduced || ms >= plan.land)) { cur.fired.land = true; onLand(cur, reduced); }
      const x = step.from.x + (step.to.x - step.from.x) * P.p, z = step.from.z + (step.to.z - step.from.z) * P.p;
      pawn.position.set(x, STANDEE_Y + P.y, z);
      pawn.rotation.x = P.pitch; pawn.rotation.y = P.yaw;
      const gone = P.vis > 0.02 ? 1 : 0.001;
      pawn.scale.set(P.sxz * gone, P.sy * gone, P.sxz * gone);
      if (step.style === 'blink' || S.beams) {
        if (!S.beams) S.beams = [0, 1].map(() => { const m = new THREE.Mesh(beamGeo, glow(new THREE.Color(cur.color ?? 0xffffff))); m.renderOrder = 12; group.add(m); return m; });
        const [bo, bi] = S.beams;
        bo.position.set(step.from.x, STANDEE_Y + 1.8, step.from.z); bo.material.opacity = 0.55 * P.beamOut; bo.visible = P.beamOut > 0.01;
        bi.position.set(step.to.x, STANDEE_Y + 1.8, step.to.z); bi.material.opacity = 0.55 * P.beamIn; bi.visible = P.beamIn > 0.01;
      }
      if (T.trail === 'on' && !reduced && step.style !== 'shipped' && ms > plan.turnMs + plan.pre && ms < plan.land && P.vis > 0.5 && now - S.lastPuck > 28) {
        S.lastPuck = now;
        const m = new THREE.Mesh(puckGeo, glow(new THREE.Color(cur.color ?? 0xffffff))); m.position.set(x, STANDEE_Y + 0.012, z); group.add(m);
        fx.push({ kind:'puck', obj:m, t0:now, dur:T.trailMs });
      }
      const lift = P.y / Math.max(0.05, P.sy);
      if (reduced || ms >= plan.total) {
        // ⭐ Hand the pawn back AT REST: level, full size, on its hex, facing the step.
        pawn.rotation.x = 0; pawn.rotation.y = step.yaw1; pawn.scale.setScalar(1);
        pawn.position.set(step.to.x, STANDEE_Y, step.to.z);
        if (S.beams) for (const b of S.beams) b.visible = false;
        S.cur = null;
        if (S.queue.length) start(pawn, S, now);
        return { roll:0, lift:0 };
      }
      return { roll:P.roll, lift };
    },
    /** The landing light's clock. */
    update(now, dt) {
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i], k = (now - f.t0) / f.dur;
        if (k < 0) { f.obj.visible = false; continue; }
        f.obj.visible = true;
        if (k >= 1) { group.remove(f.obj); if (f.kind === 'sparkle') f.obj.geometry.dispose(); f.obj.material.dispose(); fx.splice(i, 1); continue; }
        if (f.kind === 'ripple') { f.obj.scale.setScalar(0.6 + k * 0.85 * f.size); f.obj.material.opacity = Math.pow(1 - k, 1.6) * 0.95; }
        else if (f.kind === 'flash') f.obj.material.opacity = f.peak * Math.exp(-k * 3.2);
        else if (f.kind === 'puck') { f.obj.material.opacity = 0.4 * (1 - k); f.obj.scale.setScalar(1 - k * 0.4); }
        else if (f.kind === 'sparkle') {
          const p = f.obj.geometry.attributes.position;
          for (let j = 0; j < f.vel.length; j++) {
            const v = f.vel[j]; v[1] -= 6 * dt;
            p.setXYZ(j, p.getX(j) + v[0] * dt, Math.max(STANDEE_Y + 0.02, p.getY(j) + v[1] * dt), p.getZ(j) + v[2] * dt);
          }
          p.needsUpdate = true; f.obj.material.opacity = 1 - k * k;
        }
      }
    },
    /** A pawn left the board: drop its queue and its beams. */
    forget(pawn) {
      const S = pawn.userData.steps; if (!S) return;
      if (S.beams) for (const b of S.beams) { group.remove(b); b.material.dispose(); }
      delete pawn.userData.steps;
    },
    get live() { return fx.length; },
    dispose() {
      for (const f of fx) { group.remove(f.obj); if (f.kind === 'sparkle') f.obj.geometry.dispose(); f.obj.material.dispose(); }
      fx.length = 0;
      for (const g of [ringGeo, hexGeo, puckGeo, beamGeo]) g.dispose();
      root.remove(group);
    },
  };
}
