// ─── 🔊🛡️ THE SONIC CLASH — ring beams against a shield that is BUILT, then BROKEN ──
// Alex's beat list, 2026-09-24:
//   "Rival - rolls dice (that player's color of dice) - shield goes up (its
//    brightness determined by the rolled number) - the brightness determines
//    strength - Sustain amp blasts out rings towards the player (rings not as
//    'close' together) - this 'builds out' the shield. Attacking player - dice
//    roll … Blasts collide with shield. Each blast that connects - make the
//    action 'briefly' stop … - shield cracks (or the blast just explodes on it -
//    or both - depending on attack strength/strength of shield) - if the shield
//    bursts (slow motion), the next blasts then connect to the player (again,
//    stopping briefly) on each hit - then finally being pushed back depending
//    on how many hits were connected."
//
// WHAT DRAWS WHAT:
//   · the beams — the signed-off RING BEAM (`createSonicZigzagVisuals`,
//     `strokeStyle:'rings'`) at FULL `RING_TUNING`. ⚠️ NO `tuning` OVERRIDE. The
//     2026-09-19 barrage passed `{slowmo:18, burst:2.1, ringTail:16}` to fit a
//     0.22 s cadence, and that cut-down beam is what Alex called "far lower
//     quality". One beam per Drive die; its own per-shot shield arc is hidden
//     (the persistent shield below replaces it) but its contact ripple, its
//     compression hoops, its splash and its burst all stay.
//   · the shield — ONE arc for the whole bout, in the Rival's colour, the ring
//     beam's own shape (same stand-off, so a blocked beam dies exactly on it).
//     Brightness = strength = the Sustain roll against its maximum.
//   · the build — rings from the Rival's Sustain amp to the shield while the
//     shield shot holds, wide apart, each one lifting the shield a notch.
//   · every hit — per `hitKind`: a burst on the surface, cracks, or both; the
//     break SHATTERS it (the clock runs that in slow motion — see below).
//
// ⭐ THIS FILE KNOWS NOTHING ABOUT FREEZES OR SLOW MOTION. It is drawn in
// SIMULATION seconds; `sonicBarrageTiming.js` owns the mapping from the wall
// clock (hit-stops, the slow burst) and the caller passes the mapped time. So a
// freeze is simply the same `t` for half a second — beams, cracks and shards
// all hold together, and the sound (scheduled through the same mapping) too.

import * as THREE from 'three';
import { createSonicZigzagVisuals, FLIGHT_SECONDS, IMPACT_SECONDS } from './sonicZigzagVisuals.js';
import { BARRAGE_FLIGHT, BARRAGE_SPACING, barrageContact } from './sonicBarrageTiming.js';
import { sonicSceneLabel } from './sonicDiceVisuals.js';

export const SONIC_CLASH_LOOK = Object.freeze({
  buildRings: 7,      // rings the Sustain amp throws to raise the shield
  buildFlight: .95,   // seconds each takes to cross
  buildRadius: .62,   // their size — wide and few, "not as close together"
  settle: .8,         // after contact, the ring beam's burst plays over this (its own IMPACT_SECONDS)
  cracks: 22,         // crack lines pre-cut into the arc, revealed as it takes damage
  shards: 34,         // pieces when it bursts
  shardFlight: 1.4,   // sim-seconds the pieces fly (slow motion stretches it on screen)
  flash: .22,         // a hit's flash on the surface
  weak: .75,          // a Drive die under this share of ONE Sustain die just bursts on the shield…
  strong: 1.3,        // …over this it cracks it clean; in between, both
});

const clamp = THREE.MathUtils.clamp;
const hash = n => { const x = Math.sin(n * 91.7 + 17.3) * 43758.5453; return x - Math.floor(x); };

/** 0…1 — the Rival's Sustain roll against the most that pool could roll. */
export function shieldStrength(battle) {
  const pool = battle.sustainPool?.length ? battle.sustainPool : (battle.sustainRolls ?? []).map(() => 6);
  const most = pool.reduce((n, sides) => n + (Number(sides) || 6), 0);
  return most > 0 ? clamp((battle.shieldValue ?? 0) / most, 0, 1) : 0;
}

/**
 * What one Drive die does when it arrives.
 *   'spirit'  — the shield was already down: the beam connects with the Spirit
 *   'shatter' — this is the die that breaks it (spillover then carries through)
 *   'burst'   — weak against this shield: it explodes on the surface, no crack
 *   'crack'   — strong: it splits the surface
 *   'both'    — in between: a burst AND a crack
 * "Strong" is measured against ONE Sustain die (the shield's HP over its dice),
 * so a d6 against a three-die shield reads the way the table reads it.
 */
export function hitKind(shot, battle, L = SONIC_CLASH_LOOK) {
  if (!(shot.before > 0)) return 'spirit';
  if (shot.index === battle.breakIndex) return 'shatter';
  const dice = Math.max(1, battle.sustainRolls?.length ?? battle.sustainPool?.length ?? 1);
  const perDie = (battle.shieldValue ?? 0) / dice;
  const r = perDie > 0 ? shot.strength / perDie : 2;
  return r < L.weak ? 'burst' : r > L.strong ? 'crack' : 'both';
}

/** The ring beam's own clock for shot `i`: its flight stretched to ours, its impact at its own pace. */
function beamLocalTime(age, L) {
  return age <= BARRAGE_FLIGHT ? age * FLIGHT_SECONDS / BARRAGE_FLIGHT
    : FLIGHT_SECONDS + (age - BARRAGE_FLIGHT) * IMPACT_SECONDS / L.settle;
}

export function createSonicClashVisuals(options) {
  const L = { ...SONIC_CLASH_LOOK, ...options.look };
  const { battle, attackerPosition: attacker, defenderPosition: defender } = options;
  const group = new THREE.Group(); group.name = 'Sonic clash';
  const lane = defender.clone().sub(attacker).setY(0);
  const gap = lane.length() || 1; lane.divideScalar(gap);
  // ⚠️ THE SAME STAND-OFF THE RING BEAM COMPUTES — `min(shieldRadius, gap·0.45)`
  // — so a blocked beam's terminus is exactly on this arc. Change one, change both.
  const standoff = Math.min(options.shieldRadius ?? .78, gap * .45);
  const height = Math.min(options.shieldSize ?? 2.6, standoff * 1.5 + .7);
  const ARC = Math.PI * .66;
  const maxHp = battle.shieldValue ?? 0, strength = shieldStrength(battle);
  const hsl = new THREE.Color(options.shieldColor ?? '#b0a0ff').getHSL({ h: 0, s: 0, l: 0 });
  const tone = (s, l) => new THREE.Color().setHSL(hsl.h, s, l);
  const glow = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
  const dispose = [];

  // ── the shield ──────────────────────────────────────────────────────────────
  const shield = new THREE.Group(); shield.name = 'Sonic shield';
  shield.position.copy(defender).setY(defender.y + .1);
  shield.rotation.y = Math.atan2(-lane.x, -lane.z);
  group.add(shield);
  const arc = (h, r, o, s, l, seg = 48) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg, 1, true, -ARC / 2, ARC), glow(tone(s, l), o));
    m.renderOrder = 138; shield.add(m); return m;
  };
  const field = arc(height, standoff, .14, .75, .45); field.name = 'Sonic shield field';
  const inner = arc(height * .5, standoff * 1.003, .3, .8, .58); inner.name = 'Sonic shield core';
  const rims = [arc(.085, standoff, 1, .85, .7), arc(.085, standoff, 1, .85, .7)];
  rims[0].position.y = height / 2; rims[1].position.y = -height / 2;
  const ribs = [];
  for (let i = 0; i < 7; i++) {
    const at = -ARC / 2 + ARC * (i + .5) / 7;
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(standoff * 1.005, standoff * 1.005, height * .94, 2, 1, true, at - .012, .024), glow(tone(.8, .62), .55));
    rib.renderOrder = 138; shield.add(rib); ribs.push(rib);
  }
  // Where on the arc a hit lands: the point facing the attacker, give or take.
  const surface = (u, y) => new THREE.Vector3(Math.sin(u) * standoff * 1.01, y, Math.cos(u) * standoff * 1.01);
  // Cracks: jagged polylines pre-cut across the arc, revealed in a fixed order
  // (nearest the lane first) as the damage mounts. Pre-cut, so a replay cracks
  // the same way and no frame ever allocates.
  const cracks = [];
  for (let i = 0; i < L.cracks; i++) {
    const u0 = (hash(i) - .5) * ARC * .55, y0 = (hash(i + 40) - .5) * height * .5;
    const pts = [surface(u0, y0)];
    let u = u0, y = y0;
    const dir = hash(i + 80) * Math.PI * 2;
    for (let k = 0; k < 6; k++) {
      u += Math.cos(dir + (hash(i * 7 + k) - .5) * 1.3) * .09;
      y += Math.sin(dir + (hash(i * 5 + k) - .5) * 1.3) * .2;
      pts.push(surface(clamp(u, -ARC / 2, ARC / 2), clamp(y, -height / 2, height / 2)));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: tone(.35, .9), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    line.renderOrder = 141; line.visible = false; shield.add(line); cracks.push(line);
  }
  const flash = new THREE.Mesh(new THREE.CircleGeometry(.55, 24), glow(tone(.6, .85), 0));
  flash.renderOrder = 142; flash.visible = false; shield.add(flash);
  const hpLabel = sonicSceneLabel('', '#eaf2ff', 2.8, .42); group.add(hpLabel.sprite); hpLabel.sprite.visible = false;

  // Shards for the burst — world space, so they keep flying when the arc is gone.
  const shards = [];
  for (let i = 0; i < L.shards; i++) {
    const s = new THREE.Mesh(new THREE.TetrahedronGeometry(.1 + hash(i + 3) * .16, 0), glow(tone(.8, .5 + hash(i) * .25), 1));
    s.renderOrder = 143; s.visible = false; group.add(s);
    const u = (hash(i + 11) - .5) * ARC, y = (hash(i + 23) - .5) * height;
    shards.push({ mesh: s, u, y, spin: 2 + hash(i + 5) * 6, speed: 2.2 + hash(i + 9) * 3.4, lift: 1 + hash(i + 17) * 2.2 });
  }

  // ── the build: the Rival's Sustain amp throws rings at their own shield ─────
  const build = [];
  const from = options.sustainOrigin ?? null;
  const buildStart = options.buildStart ?? -Infinity, buildEnd = options.buildEnd ?? buildStart + 2.4;
  let buildCurve = null;
  if (from && maxHp > 0) {
    const to = defender.clone().setY(defender.y + .1 + height * .1).addScaledVector(lane, -standoff);
    buildCurve = new THREE.QuadraticBezierCurve3(from.clone(), from.clone().lerp(to, .5).add(new THREE.Vector3(0, 1.8, 0)), to);
    for (let i = 0; i < L.buildRings; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(L.buildRadius, .045, 8, 40), glow(tone(.85, .62), 0));
      ring.renderOrder = 139; ring.visible = false; group.add(ring); build.push(ring);
    }
  }
  const buildGap = build.length > 1 ? Math.max(.12, (buildEnd - buildStart - L.buildFlight - .2) / (build.length - 1)) : 0;
  const ringArrive = i => buildStart + i * buildGap + L.buildFlight;

  // ── the ring beams, one per Drive die ───────────────────────────────────────
  const dice = Math.max(1, battle.sustainRolls?.length ?? battle.sustainPool?.length ?? 1);
  const shots = (battle.shots ?? []).map(shot => {
    const kind = hitKind(shot, battle, L);
    const visual = createSonicZigzagVisuals({
      ampOrigins: options.ampOrigins?.length ? [options.ampOrigins[shot.index % options.ampOrigins.length]] : undefined,
      attackerPosition: attacker, defenderPosition: defender, color: options.color, shieldColor: options.shieldColor,
      chordPitches: options.chordPitches, clearance: options.clearance ?? 1.15,
      shieldRadius: options.shieldRadius ?? .78, shieldSize: options.shieldSize ?? 2.6,
      // `margin` against ONE Sustain die, the scale the ring beam was tuned on.
      shieldValue: maxHp / dice, intensityMode: 'margin', strokeStyle: 'rings',
      dice: [{ value: shot.strength, sides: battle.dicePool?.[shot.index] ?? 6, passed: kind === 'spirit' || (kind === 'shatter' && shot.through > 0) }],
    });
    // Its own static arc gives way to the persistent shield; the contact effects stay.
    visual.group.traverse(n => { if (/^Sustain (field|rim|inner|rib)$/.test(n.name)) n.visible = false; });
    group.add(visual.group);
    // The Drive amp kicks as this beam leaves it.
    const origin = options.ampOrigins?.length ? options.ampOrigins[shot.index % options.ampOrigins.length] : null;
    let kick = null;
    if (origin) {
      kick = new THREE.Mesh(new THREE.TorusGeometry(.6, .05, 6, 36), glow(options.color ?? '#62dbff', 0));
      kick.position.copy(origin); kick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), attacker.clone().sub(origin).normalize());
      kick.renderOrder = 140; kick.visible = false; group.add(kick);
    }
    return { shot, kind, visual, kick, at: barrageContact(shot.index), launch: shot.index * BARRAGE_SPACING };
  });
  const breakAt = battle.breakIndex >= 0 ? barrageContact(battle.breakIndex) : Infinity;
  // Damage the cracks show after each landed hit, 0…1: a clean crack counts
  // extra, a mere burst barely marks it.
  let wear = 0;
  const wearAfter = shots.map(s => {
    if (s.kind === 'crack' || s.kind === 'both') wear += (s.shot.absorbed / Math.max(1, maxHp)) * (s.kind === 'crack' ? 1.5 : 1);
    else if (s.kind === 'burst') wear += (s.shot.absorbed / Math.max(1, maxHp)) * .2;
    return clamp(wear, 0, 1);
  });

  let focus = null, lastHp = null;
  function update(time, { camera, reduced = false, defenderPosition, interrupted = false } = {}) {
    group.visible = !interrupted;
    if (interrupted) return;
    // ── build ──
    const hasShield = maxHp > 0;
    let built = hasShield ? (time >= buildEnd ? 1 : 0) : 0;
    build.forEach((ring, i) => {
      const t0 = buildStart + i * buildGap, p = (time - t0) / L.buildFlight;
      ring.visible = !reduced && p >= 0 && p < 1.15 && time < buildEnd + .4;
      if (p >= 1) built = Math.max(built, (i + 1) / build.length);
      if (!ring.visible) return;
      const q = clamp(p, 0, 1);
      ring.position.copy(buildCurve.getPoint(q));
      ring.lookAt(buildCurve.getPoint(Math.min(1, q + .02)).add(new THREE.Vector3(0, 1e-4, 0)));
      ring.scale.setScalar(p < 1 ? .7 + q * .5 : 1.2 + (p - 1) * 6);
      ring.material.opacity = p < 1 ? .9 : Math.max(0, 1 - (p - 1) / .15);
    });
    if (reduced && time >= buildStart) built = 1;
    // ── hits so far ──
    const landed = shots.filter(s => time >= s.at);
    const last = landed.at(-1);
    const hp = last ? last.shot.after : maxHp;
    const broken = time >= breakAt;
    const breakAge = time - breakAt;
    const damage = last ? wearAfter[last.shot.index] : 0;
    // ── the shield: brightness = strength, dimmed by damage, pulsed by the build and every hit ──
    const up = hasShield && time >= buildStart && (!broken || breakAge < .05);
    shield.visible = up;
    if (up) {
      const bright = (.35 + .65 * strength) * (1 - .45 * damage);
      const riseArrive = build.length ? build.map((_, i) => ringArrive(i)).filter(a => time >= a).at(-1) : null;
      const riseKick = riseArrive != null ? Math.max(0, 1 - (time - riseArrive) / .35) : 0;
      const hitAge = last ? time - last.at : Infinity, hitKick = Math.max(0, 1 - hitAge / L.flash);
      const level = built * bright;
      field.material.opacity = (.07 + .2 * level) + .25 * (riseKick + hitKick) * bright;
      inner.material.opacity = (.12 + .38 * level) + .2 * hitKick;
      rims.forEach(r => { r.material.opacity = .25 + .75 * level; });
      ribs.forEach(r => { r.material.opacity = .15 + .55 * level; });
      shield.scale.set(1, .25 + .75 * Math.max(built, reduced ? 1 : 0), 1);
      cracks.forEach((c, i) => {
        const on = i < Math.round(damage * cracks.length);
        c.visible = on;
        if (on) c.material.opacity = .55 + .45 * Math.max(hitKick, .4 + .6 * damage);
      });
      flash.visible = hitKick > 0 && !reduced && last && last.kind !== 'spirit';
      if (flash.visible) {
        flash.position.copy(surface((hash(last.shot.index) - .5) * .35, (hash(last.shot.index + 7) - .5) * height * .3));
        flash.lookAt(shield.localToWorld(flash.position.clone().multiplyScalar(2)));
        flash.scale.setScalar(.6 + (1 - hitKick) * (last.kind === 'burst' ? 2.8 : 1.6));
        flash.material.opacity = hitKick * (last.kind === 'burst' ? 1 : .7);
      }
    }
    // ── the burst ──
    shards.forEach((s, i) => {
      const age = breakAge;
      s.mesh.visible = !reduced && broken && age < L.shardFlight;
      if (!s.mesh.visible) return;
      const origin = shield.localToWorld(surface(s.u, s.y));
      const out = origin.clone().sub(defender).setY(0).normalize().addScaledVector(lane, -.6).normalize();
      s.mesh.position.copy(origin).addScaledVector(out, s.speed * age).add(new THREE.Vector3(0, s.lift * age - 3.2 * age * age, 0));
      s.mesh.rotation.set(age * s.spin, age * s.spin * .7, i);
      s.mesh.material.opacity = 1 - clamp(age / L.shardFlight, 0, 1) ** 2;
    });
    // ── the beams and the amp kicks ──
    for (const s of shots) {
      const age = time - s.launch;
      s.visual.update(beamLocalTime(age, L), { camera, reduced });
      if (s.kick) {
        s.kick.visible = !reduced && age >= 0 && age < .45;
        if (s.kick.visible) { s.kick.scale.setScalar(1 + age * 3.2); s.kick.material.opacity = .9 * (1 - age / .45); }
      }
    }
    // ── the HP plate ──
    if (hp !== lastHp) { hpLabel.write(broken ? 'SHIELD BROKEN' : `SHIELD ${hp} / ${maxHp}`); lastHp = hp; }
    hpLabel.sprite.position.copy(defenderPosition ?? defender).add(new THREE.Vector3(0, height * .5 + 1.6, 0));
    hpLabel.sprite.visible = hasShield && time >= buildStart && (!broken || breakAge < 1.4);
    // ── where the lens wants to be (used when the director is off) ──
    const current = shots.filter(s => time >= s.launch).at(-1) ?? shots[0];
    focus = current ? current.visual.getFocus(beamLocalTime(time - current.launch, L), { reduced }) : null;
  }
  return {
    group, update, getFocus: () => focus,
    /** For the checks: what the shield is doing at `time`. */
    state(time) {
      const landed = shots.filter(s => time >= s.at);
      return { built: time >= buildEnd, broken: time >= breakAt, hits: landed.map(s => s.kind),
        cracks: cracks.filter(c => c.visible).length, strength };
    },
    dispose() {
      shots.forEach(s => s.visual.dispose());
      hpLabel.texture?.dispose();
      group.traverse(n => { n.geometry?.dispose(); for (const m of [n.material].flat().filter(Boolean)) m.dispose(); });
      group.clear(); group.removeFromParent();
    },
  };
}
