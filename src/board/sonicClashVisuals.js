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
//     (the persistent shield below replaces it). Compression hoops, splash
//     and burst stay; the living shield owns the surface ripple.
//   · the shield — the approved purple living oval-hex for the whole bout,
//     at the same stand-off so a blocked beam dies exactly on its face.
//     Sustain roll controls brightness; remaining HP controls degradation.
//   · the build — rings from the Rival's Sustain amp to the shield while the
//     shield shot holds, wide apart, each one lifting the shield a notch.
//   · every shield hit — sheds glitter and frays the rings in proportion to
//     actual HP lost; the break scatters glitter and curved ring fragments.
//
// ⭐ THIS FILE KNOWS NOTHING ABOUT FREEZES OR SLOW MOTION. It is drawn in
// SIMULATION seconds; `sonicBarrageTiming.js` owns the mapping from the wall
// clock (hit-stops, the slow burst) and the caller passes the mapped time. So a
// freeze is simply the same `t` for half a second — beams, glitter and fragments
// all hold together, and the sound (scheduled through the same mapping) too.

import * as THREE from 'three';
import { createSonicZigzagVisuals, FLIGHT_SECONDS, IMPACT_SECONDS } from './sonicZigzagVisuals.js';
import { BARRAGE_FLIGHT, barrageContact, beatsFor } from './sonicBarrageTiming.js';
import { sonicSceneLabel } from './sonicDiceVisuals.js';
import { createSustainShield, DEFAULTS as SUSTAIN_SHIELD } from './sustainShield.js';
import { DAMAGE_DEFAULTS } from './sustainDamage.js';
import { createSpiralGlitter, createHelixStations, SONIC_GLITTER } from './sonicGlitter.js';

export const SONIC_CLASH_LOOK = Object.freeze({
  buildRings: 7,      // rings the Sustain amp throws to raise the shield
  buildFlight: .95,   // seconds each takes to cross
  buildRadius: .62,   // their size — wide and few, "not as close together"
  settle: .8,         // after contact, the ring beam's burst plays over this (its own IMPACT_SECONDS)
  cracks: 22,         // retained for the legacy state/debug crack count
  shards: 34,         // legacy presentation knobs; new debris uses DAMAGE_DEFAULTS
  shardFlight: 1.4,
  flash: .22,
  weak: .75,          // a Drive die under this share of ONE Sustain die just bursts on the shield…
  strong: 1.3,        // …over this it cracks it clean; in between, both
});

const clamp = THREE.MathUtils.clamp;

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
export function sonicClashBeamTime(age, L = SONIC_CLASH_LOOK) {
  return age <= BARRAGE_FLIGHT ? age * FLIGHT_SECONDS / BARRAGE_FLIGHT
    : FLIGHT_SECONDS + (age - BARRAGE_FLIGHT) * IMPACT_SECONDS / L.settle;
}

export function createSonicClashVisuals(options) {
  const L = { ...SONIC_CLASH_LOOK, ...options.look };
  const { battle, attackerPosition: attacker, defenderPosition: defender } = options;
  const group = new THREE.Group(); group.name = 'Sonic clash';
  const lane = defender.clone().sub(attacker).setY(0);
  const gap = lane.length() || 1; lane.divideScalar(gap);
  // The same contact stand-off the ring beam computes — `min(shieldRadius, gap·0.45)`
  // keeps the new surface exactly at the blocked beam terminus.
  const standoff = Math.min(options.shieldRadius ?? .78, gap * .45);
  const height = SUSTAIN_SHIELD.height;
  const maxHp = battle.shieldValue ?? 0, strength = shieldStrength(battle);
  const hsl = new THREE.Color(options.shieldColor ?? '#b0a0ff').getHSL({ h: 0, s: 0, l: 0 });
  const tone = (s, l) => new THREE.Color().setHSL(hsl.h, s, l);
  const glow = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });

  // The approved oval-hex sits in front of the Spirit. Its face at the actual
  // beam height remains exactly on the old stand-off, despite its shallow dome.
  const sustain = createSustainShield();
  const centerY = Math.max(defender.y + .1, height / 2 + .12);
  const contactY = defender.y - centerY;
  const contactRadius = Math.min(1, Math.abs(contactY) / (height / 2));
  const faceDepth = SUSTAIN_SHIELD.dome * (1 - contactRadius * contactRadius);
  sustain.group.position.copy(defender).setY(centerY).addScaledVector(lane, -standoff + faceDepth);
  sustain.group.rotation.y = Math.atan2(-lane.x, -lane.z);
  sustain.group.traverse(n => { if (n.isMesh && n.renderOrder === 0) n.renderOrder = 138; });
  group.add(sustain.group);
  const hpLabel = sonicSceneLabel('', '#eaf2ff', 2.8, .42);
  group.add(hpLabel.sprite); hpLabel.sprite.visible = false;
  const feedGlitter = createSpiralGlitter(null, { capacity: 2000, tint: options.shieldColor ?? '#b0a0ff' });
  const feedStations = createHelixStations(64);
  group.add(feedGlitter.group); feedGlitter.group.name = 'Sustain amp glitter feed';

  // ── the build: the Rival's Sustain amp throws rings at their own shield ─────
  const build = [];
  const from = options.sustainOrigin ?? null;
  const buildStart = options.buildStart ?? -Infinity, buildEnd = options.buildEnd ?? buildStart + 2.4;
  let buildCurve = null;
  if (from && maxHp > 0) {
    const to = defender.clone().setY(defender.y).addScaledVector(lane, -standoff);
    buildCurve = new THREE.QuadraticBezierCurve3(from.clone(), from.clone().lerp(to, .5).add(new THREE.Vector3(0, 1.8, 0)), to);
    for (let i = 0; i < L.buildRings; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(L.buildRadius, .045, 8, 40), glow(tone(.85, .62), 0));
      ring.renderOrder = 139; ring.visible = false; group.add(ring); build.push(ring);
    }
  }
  if (buildCurve) {
    const tangent = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    feedStations.forEach((station, i) => {
      const u = i / (feedStations.length - 1);
      buildCurve.getPoint(u, station.center); buildCurve.getTangent(u, tangent);
      station.across.crossVectors(tangent, Math.abs(tangent.y) > .99 ? new THREE.Vector3(1, 0, 0) : up).normalize();
      station.up.crossVectors(station.across, tangent).normalize();
      station.radius = L.buildRadius * (.4 + .45 * Math.sin(u * Math.PI));
    });
  }
  const buildGap = build.length > 1 ? Math.max(.12, (buildEnd - buildStart - L.buildFlight - .2) / (build.length - 1)) : 0;

  // ── the ring beams, one per Drive die ───────────────────────────────────────
  const dice = Math.max(1, battle.sustainRolls?.length ?? battle.sustainPool?.length ?? 1);
  // ⚡ `beams: false` — a PSYCHO BUSHIDO (2026-10-01). The shield, its build from
  // the Rival's Sustain amp, its glitter shedding and its break all stay, on
  // the Bushido's own beats (`beatsFor`); the ring beams do not exist — his
  // lightning is drawn by `bushidoStrikeVisuals.js` and lands on these contacts.
  const beams = options.beams !== false, B = beatsFor(battle);
  const shots = (battle.shots ?? []).map(shot => {
    const kind = hitKind(shot, battle, L);
    if (!beams) return { shot, kind, visual:null, kick:null, at: barrageContact(shot.index, B), launch: shot.index * B.spacing };
    const visual = createSonicZigzagVisuals({
      ampOrigins: options.ampOrigins?.length ? [options.ampOrigins[shot.index % options.ampOrigins.length]] : undefined,
      attackerPosition: attacker, defenderPosition: defender, color: options.color, shieldColor: options.shieldColor,
      chordPitches: options.chordPitches, clearance: options.clearance ?? 1.15,
      shieldRadius: options.shieldRadius ?? .78, shieldSize: options.shieldSize ?? 2.6,
      // `margin` against ONE Sustain die, the scale the ring beam was tuned on.
      shieldValue: maxHp / dice, intensityMode: 'margin', strokeStyle: 'rings', surfaceRipple: false,
      // 📌 Preview-only hook: the dial-in page passes levers here. The game passes none.
      ...(options.beamTuning ? { tuning: options.beamTuning } : null),
      dice: [{ value: shot.strength, sides: battle.dicePool?.[shot.index] ?? 6, passed: kind === 'spirit' || (kind === 'shatter' && shot.through > 0) }],
    });
    // The living shield supplies its own surface and ripple; beam compression stays.
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
    return { shot, kind, visual, kick, at: barrageContact(shot.index, B), launch: shot.index * B.spacing };
  });
  const breakAt = battle.breakIndex >= 0 ? barrageContact(battle.breakIndex, B) : Infinity;
  // Only impacts that actually hit remaining shield HP can shed shield energy.
  // Later Spirit hits must not re-break or re-emit the already destroyed shield.
  const shieldHits = shots.filter(s => s.shot.before > 0).map(s => ({
    at: s.at, index: s.shot.index, before: s.shot.before / Math.max(1, maxHp),
    after: s.shot.after / Math.max(1, maxHp), breaking: s.kind === 'shatter',
    u: contactY >= 0 ? 1 / 24 : 13 / 24, r: contactRadius,
    amount: (s.shot.absorbed ?? s.shot.before - s.shot.after) / Math.max(1, maxHp),
  }));
  const sampleShield = (time, built = 1) => {
    const events = shieldHits.filter(hit => time >= hit.at).map(hit => ({ ...hit, age: time - hit.at }));
    const last = events.at(-1);
    return { time, build: built, health: maxHp > 0 ? last?.after ?? 1 : 0, events,
      hitAge: last ? time - last.at : -1, breakAge: time >= breakAt ? time - breakAt : -1 };
  };

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
    const active = hasShield && time >= buildStart;
    sustain.group.visible = active;
    sustain.update(time, SUSTAIN_SHIELD, { state: sampleShield(time, active ? built : 0),
      damage: DAMAGE_DEFAULTS, strengthScale: .35 + .65 * strength, reduced });
    feedGlitter.update(time, SONIC_GLITTER, { stations: feedStations,
      enabled: !!buildCurve && active && time < buildEnd && !broken && !reduced,
      opacity: .65 + .35 * strength, reduced });
    // ── the beams and the amp kicks ──
    for (const s of shots) {
      const age = time - s.launch;
      if (!s.visual) continue;
      s.visual.update(sonicClashBeamTime(age, L), { camera, reduced });
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
    focus = current?.visual ? current.visual.getFocus(sonicClashBeamTime(time - current.launch, L), { reduced }) : null;
  }
  return {
    group, update, getFocus: () => focus, sustain,
    /** For the checks: what the shield is doing at `time`. */
    state(time) {
      const landed = shots.filter(s => time >= s.at);
      return { built: time >= buildEnd, broken: time >= breakAt, hits: landed.map(s => s.kind),
        cracks: Math.round((1 - sampleShield(time).health) * L.cracks), health: sampleShield(time).health, strength };
    },
    dispose() {
      sustain.dispose(); feedGlitter.dispose();
      shots.forEach(s => s.visual?.dispose());
      hpLabel.texture?.dispose();
      group.traverse(n => { n.geometry?.dispose(); for (const m of [n.material].flat().filter(Boolean)) m.dispose(); });
      group.clear(); group.removeFromParent();
    },
  };
}
