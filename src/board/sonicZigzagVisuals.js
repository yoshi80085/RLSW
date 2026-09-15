import * as THREE from 'three';
import { buildSonicPath, sonicVolleyDuration } from './sonicVolleyVisuals.js';

// ── THE SONIC PROJECTILE ─────────────────────────────────────────────────────
// Three treatments share this module, chosen with `strokeStyle`:
//
//   · 'rings'   — ⭐ THE ONE THAT SHIPS. Hoops at fixed stations that inflate
//                 behind the head into a beam, riding a smooth travelling wave.
//                 Decided by Alex 2026-09-13 off a live preview; the decision is
//                 PROJECTILE_COMBAT_DESIGN.md §12.1c and his dialled numbers are
//                 RING_TUNING below.
//   · 'ribbon'  — the mitred cel zigzag described under STAGE 1 below
//   · 'chevron' — chevrons at fixed stations, igniting in turn
//
// The other two are kept, not dead weight: they share every piece of machinery
// with the beam — the path out of the amp, the Sustain barrier, the flight
// cadence, the per-die power ramp and the camera hand-off — so they are how the
// next look gets auditioned without a second module. Neither is reachable from
// the game; only arenaVisuals' 'rings' call site is.
//
// ── STAGE 1: the cel zigzag, which the other two are built on ────────────────
// One thick, constant-width stroke fired from the amp along the SAME tested
// path the other treatments use (buildSonicPath is untouched: it still clears
// the attacking body and lands on the shield or the Spirit).
//
// Three things this build is deliberately built around:
//
//  1. The stroke is hand-built MITRED RIBBON geometry, not a line primitive.
//     `LineBasicMaterial.linewidth` is ignored on every WebGL platform, and the
//     obvious replacement — Line2 — draws round caps and round joins, so a thick
//     stroke physically cannot hold a sharp corner or come to a point. Mitring
//     the polyline ourselves gives hard corners AND lets the width follow a
//     profile, which is what makes the leading end a spear rather than a blunt
//     cap. Widths are in world units, so the shot has real physical presence and
//     grows as the camera pushes in.
//  2. The outline stroke is NORMAL-blended, not additive. An additive "dark
//     outline" adds light and cannot darken anything; a real cel edge has to be
//     drawn as an opaque deep-hue stroke underneath the bright one.
//  3. The zigzag oscillates on a CAMERA-FACING axis, recomputed per frame. In a
//     fixed world plane there is a camera angle that collapses it to a straight
//     line, and the sonic camera moves during the shot.
//
// Presentation only: no rules, no RNG, no audio. Absolute elapsed seconds in,
// so replay and seeking stay deterministic.

const clamp = THREE.MathUtils.clamp;
const point = p => new THREE.Vector3(p.x, p.y, p.z);
const FLIGHT_SECONDS = 1.75, STAGGER_SECONDS = 0.13, IMPACT_SECONDS = 0.52;
const SAMPLES = 72;          // stroke resolution along the path
// Trail, wavelength and amplitude are all in WORLD UNITS, then converted to the
// path's 0..1 parameter per shot. Expressing them as a fraction of the path
// makes a short shot scribble over itself and a long one go slack; in world
// units every shot has the same wave, whatever the range.
// A zigzag only reads if its legs are long relative to the stroke's own width.
// At a short leg a thick stroke fills its own corners in and the whole thing
// turns into a fat squiggle, so these are deliberately open.
const TRAIL_UNITS = 5.5;     // visible length of the stroke
const ZAG_LEG = 2.6;         // world distance between consecutive corners
const SWING_MIN = 0.12;      // half-amplitude of a feeble shot; the top end is tunable
const SHARDS_PER_SHOT = 10;
const RIPPLES_PER_SHOT = 8, RIPPLE_SEGMENTS = 14, RIPPLE_LIFE = 0.62;
const BURST_SPIKES = 16, BURST_LIFE = 0.5;

// ── the cadence ──────────────────────────────────────────────────────────────
// The shot does not travel at a constant speed. It SNAPS along each leg and
// eases through the corner, then crosses most of the arena fast and crawls the
// last stretch into the Rival — the slow-motion approach of §12.1b beat 4.
//
// Crucially the total flight time is UNCHANGED: this only redistributes time
// within it. `sonicVolleyDuration` still reports the same number, so the
// simulator's result/close scheduling and the per-die audio stagger need no
// adjustment at all.
const CREEP = 0.09;          // the corner is a slow drift, never a dead stop
const SLOWMO_CURVE = 2.5;    // how late the slowdown arrives

/**
 * Every number worth arguing about, in one place. Pass a partial `tuning` to
 * `createSonicZigzagVisuals` to override any of them; the defaults are the
 * shipped values. Kept as data rather than constants so the look can be dialled
 * in from a control panel instead of a code edit and a reload.
 */
export const SONIC_TUNING = {
  legLength: 2.6,   // world distance between zigzag corners
  swing: 0.8,       // half-amplitude of the zigzag at full power
  snap: 0.28,       // share of a leg's time spent easing through its corner
  slowmo: 22,       // how much longer the last leg takes than the first
  width: 1,         // multiplier on all three cel band widths
  ripple: 1,        // multiplier on corner ripple strength
  burst: 1,         // multiplier on impact burst size
  chevronGap: 0.72, // world distance between chevrons, in chevron mode
  chevronTail: 9,   // how many chevrons trail the head before it has dissipated
  thread: 1,        // neon thread woven through the chevrons; 0 turns it off
  ringGap: 0.3,     // world distance between ring stations, in ring mode
  ringTail: 18,     // how many rings stand behind the head — the beam's length
  beamRadius: 0.8,  // the beam's radius at full power
  // Ring mode drops the per-leg staccato from the flight curve. The legs still
  // grow toward the Rival, so the slow-motion approach survives untouched, but
  // the head no longer dashes and eases inside each one.
  smooth: false,
};
/**
 * ⭐ ALEX'S RING-BEAM DIAL-IN — screenshot of the preview panel, 2026-09-13.
 *
 * Applied ON TOP of SONIC_TUNING whenever `strokeStyle: 'rings'`, and still
 * overridable by a caller's own `tuning`. Kept as its own layer rather than
 * folded into SONIC_TUNING for two reasons:
 *
 *  1. SONIC_TUNING is the zigzag/chevron baseline and `sonicZigzagCheck.mjs`
 *     asserts the cadence against it. Overwriting it to suit the ring beam
 *     would silently re-dial two other treatments and move a tested curve.
 *  2. ⚠️ These seven numbers are a TASTE DECISION someone made by eye and can
 *     only be re-made by eye. Anonymous in a shared defaults block they read as
 *     arbitrary and get "tidied"; here they have an owner and a date.
 *
 * 🎯 The direction, if one of them ever has to move: he took the beam THINNER
 * and SPARSER but LONGER, with a brighter filament, a far bigger detonation and
 * a much slower final approach. Mass came out, contrast went in. Protect the
 * contrast — the slow approach and the burst — before protecting the calibre.
 */
export const RING_TUNING = {
  slowmo: 52,       // 22 → 52. The approach crawls much harder than the cel look wanted
  width: 0.8,       // 1 → 0.8. Thinner bands
  burst: 3.1,       // 1 → 3.1. The detonation is the payoff beat
  thread: 1.35,     // 1 → 1.35. The axial filament carries more of the brightness
  ringGap: 0.42,    // 0.3 → 0.42. Rings read individually rather than fusing into a tube
  ringTail: 22,     // 18 → 22. A longer column
  beamRadius: 0.64, // 0.8 → 0.64. Narrower calibre
};
// 📌 Camera, not geometry, so it does not live in the tuning object: he also took
// the contact push-in from 0.82 to 0.95. That belongs to `arenaRenderer.js`'s
// framing, and the preview's own ZOOM IN slider is the same quantity.
export const RING_CAMERA_ZOOM = 0.95;

const MAX_CHEVRONS = 44;
const MAX_RINGS = 64, RING_SEGMENTS = 18;
// A BLUR, not a line. Five nested ribbons whose widths and opacities fall off
// like a Gaussian; summed additively they make a soft-edged glow with no hard
// silhouette. This is the cheap way to get one — a single flat ribbon always
// shows its edges, and a real blur would mean a separate pass the arena's
// composer has no slot for.
const THREAD_LAYERS = [
  { width: 1, opacity: 0.055, hot: false },
  { width: 0.68, opacity: 0.075, hot: false },
  { width: 0.44, opacity: 0.1, hot: true },
  { width: 0.25, opacity: 0.16, hot: true },
  { width: 0.11, opacity: 0.3, hot: true },
];

const triangle = y => 1 - 2 * Math.abs(((y % 2) + 2) % 2 - 1);
const easeOutCubic = x => 1 - Math.pow(1 - x, 3);

// Each leg gets its own slice of the flight, and the slices grow toward the
// Rival — so the shot snaps across the arena early and the last two zags play
// out in slow motion. One mechanism, not a staccato and a separate time warp
// fighting each other: layering those two ease-outs multiplies their tails and
// the shot freezes just short of the shield instead of arriving.
const legCache = new Map();
function legBoundaries(corners, slowmo) {
  const n = Math.max(1, Math.round(corners));
  const key = `${n}|${slowmo}`;
  const cached = legCache.get(key);
  if (cached) return cached;
  const weights = [];
  for (let k = 0; k < n; k++) weights.push(1 + slowmo * Math.pow(n === 1 ? 0 : k / (n - 1), SLOWMO_CURVE));
  const total = weights.reduce((a, b) => a + b, 0);
  const bounds = [0];
  for (let k = 0; k < n; k++) bounds.push(bounds[k] + weights[k] / total);
  bounds[n] = 1;
  legCache.set(key, bounds);
  return bounds;
}

/**
 * Normalised flight time (0..1) -> position along the path (0..1).
 * Pure, monotonic and always arrives at 1, so seeking to a time lands on the
 * same frame every run and the contact cue can never be missed.
 * Total flight time is UNCHANGED — this only redistributes time within it, so
 * `sonicVolleyDuration` still reports the same number and the simulator's
 * result/close scheduling and per-die audio stagger need no adjustment.
 */
export function sonicFlightCurve(x, corners, { snap = SONIC_TUNING.snap, slowmo = SONIC_TUNING.slowmo, smooth = false } = {}) {
  x = clamp(x, 0, 1);
  const n = Math.max(1, Math.round(corners));
  const bounds = legBoundaries(n, slowmo);
  let k = n - 1;
  for (let i = 0; i < n; i++) if (x < bounds[i + 1]) { k = i; break; }
  const span = bounds[k + 1] - bounds[k];
  const q = span > 0 ? clamp((x - bounds[k]) / span, 0, 1) : 1;
  // ── the fluid cadence (ring mode) ──────────────────────────────────────────
  // Every leg glides, the way the final one already does. The legs still grow
  // toward the Rival, so the shot still crosses the arena early and crawls the
  // approach — but the head no longer dashes and eases inside each leg, which
  // is the part that reads as a tick rather than a flow. Speed is then constant
  // within a leg and steps between them, and with 3–14 legs those steps are a
  // few percent each: a ramp, not a staccato. Still monotonic, still lands
  // exactly on 1, still the same total flight time.
  //
  // The FINAL leg always glides, in every mode: its far corner IS the contact
  // point, and easing to a halt there reads as the shot freezing short of the
  // shield rather than arriving in slow motion.
  if (smooth || k === n - 1) return clamp((k + q) / n, 0, 1);
  // Every other leg snaps across and eases through its corner without ever
  // fully stopping — the corner is a held note, not a pause.
  const dash = easeOutCubic(Math.min(1, q / (1 - snap)));
  return clamp((k + dash * (1 - CREEP) + q * CREEP) / n, 0, 1);
}
// "When does the head reach this point on the path?" Solved once per shot at
// build time rather than detected per frame, so the shield cue sits in the same
// place under replay however the head's speed is warped.
export function sonicFlightInverse(target, corners, tuning) {
  let lo = 0, hi = 1;
  for (let i = 0; i < 34; i++) {
    const mid = (lo + hi) / 2;
    if (sonicFlightCurve(mid, corners, tuning) < target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * How hard did this die hit?  0 = feeble, 1 = everything you have.
 * `margin` measures the roll against the shield it had to beat, so high Sustain
 * visibly dims the whole incoming volley (§12.1 — the defender should get to
 * SEE their Sustain working) and a bigger die earns its upgrade by being able
 * to roll a bigger margin. `face` is the raw roll, ignoring the shield.
 * Both are pure functions of already-resolved values.
 */
export function sonicShotIntensity({ value = 1, sides = 6, shieldValue = 0, mode = 'margin' }) {
  if (mode === 'face') return clamp((value - 1) / Math.max(1, sides - 1), 0, 1);
  const span = Math.max(2, sides - 1);
  return clamp(0.5 + (value - shieldValue) / span, 0, 1);
}

// Shaft, shoulders, point. The flare just behind the tip is what reads as a
// SPEARHEAD; taper straight to zero instead and you get a needle.
function spearProfile(u) {
  if (u < 0.14) return easeOutCubic(u / 0.14) * 0.5;
  if (u < 0.74) return 0.5 + 0.5 * ((u - 0.14) / 0.6);
  if (u < 0.88) return 1 + 0.9 * ((u - 0.74) / 0.14);
  return Math.max(0, 1.9 * (1 - (u - 0.88) / 0.12));
}

// A flat triangle strip, two vertices per sample, rewritten in place each frame.
function ribbon(color, opacity, additive) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SAMPLES * 2 * 3), 3));
  const indices = [];
  for (let j = 0; j < SAMPLES - 1; j++) {
    const k = j * 2;
    indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity,
    depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

// One expanding ring per zigzag corner the stroke has already turned: the wave
// leaves a wake at every point where it changed direction. Billboarded, drawn
// as a thin annulus strip, all of a shot's rings living in one buffer.
function rippleField(color, opacity) {
  const geometry = new THREE.BufferGeometry();
  const perRing = (RIPPLE_SEGMENTS + 1) * 2;
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RIPPLES_PER_SHOT * perRing * 3), 3));
  const indices = [];
  for (let r = 0; r < RIPPLES_PER_SHOT; r++) {
    const base = r * perRing;
    for (let seg = 0; seg < RIPPLE_SEGMENTS; seg++) {
      const k = base + seg * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity,
    depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

// The impact. Radial spikes of uneven length, which is what makes a burst read
// as a detonation rather than as an expanding hoop.
function burstField(color, opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BURST_SPIKES * 3 * 3), 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity,
    depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

// ── chevron mode ─────────────────────────────────────────────────────────────
// The beam as a PROCESSION rather than a stroke: chevrons sit at fixed stations
// along the path and ignite in turn as the wavefront reaches them, so each one
// appears in the space ahead of the last. Nothing translates — the motion is
// entirely in the ignition order, which is what makes it read as energy running
// down a conduit rather than as objects being thrown.
//
// Six vertices and four triangles per chevron: a thick V with a hollow back, so
// it stays a chevron rather than collapsing into a solid dart at distance.
function chevronField(color, opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_CHEVRONS * 6 * 3), 3));
  const indices = [];
  for (let c = 0; c < MAX_CHEVRONS; c++) {
    const b = c * 6;           // 0 apex, 1 left outer, 2 left inner, 3 apex inner, 4 right outer, 5 right inner
    indices.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 3, b + 5, b, b + 5, b + 4);
  }
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity,
    depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

// ── ring mode ────────────────────────────────────────────────────────────────
// The beam as a STACK OF SHOCK RINGS. Like the chevrons they sit at fixed
// stations and ignite in turn, but each one is a full hoop lying in the plane
// perpendicular to travel — a cross-section of the beam rather than a mark
// pointing along it. A ring is born tight at the wavefront and inflates as the
// front moves past, so the beam visibly BUILDS OUT behind the head instead of
// being drawn all at once.
//
// A hoop also cannot go edge-on. The chevrons and the cel ribbon both have to
// be re-oriented toward the camera every frame or they collapse to a line at
// the wrong angle; a ring is rotationally symmetric about its own axis, so the
// worst case is seeing it face-on as a perfect circle.
//
// All of a shot's rings live in one buffer, each an annulus strip of
// RING_SEGMENTS quads.
function ringField(color, opacity) {
  const geometry = new THREE.BufferGeometry();
  const perRing = (RING_SEGMENTS + 1) * 2;
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_RINGS * perRing * 3), 3));
  const indices = [];
  for (let r = 0; r < MAX_RINGS; r++) {
    const base = r * perRing;
    for (let seg = 0; seg < RING_SEGMENTS; seg++) {
      const k = base + seg * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity,
    depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

// Hard-edged chevron slivers flowing along the shot — the cover art's grain.
// Round sprites are the opposite of the look, so these are real triangles.
function shardField(color, opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SHARDS_PER_SHOT * 3 * 3), 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: new THREE.Color(color), transparent: true, opacity,
    depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }));
  mesh.frustumCulled = false;
  return mesh;
}

export function createSonicZigzagVisuals({
  ampOrigins, attackerPosition, defenderPosition, dice = [], chordPitches = [0, 4, 7],
  color = '#62dbff', shieldColor = '#b0a0ff', shieldValue = 0, launchDelay = 0,
  clearance = 1.05, shieldRadius = 0.78, shieldSize = 2.6, intensityMode = 'margin',
  strokeStyle = 'ribbon', tuning = {},
}) {
  const beam = strokeStyle === 'rings';
  // Ring mode carries its own approved numbers, so the game gets Alex's look
  // from `strokeStyle: 'rings'` alone with nothing to configure at the call
  // site — while a caller that DOES pass `tuning` still wins, which is what the
  // preview's sliders rely on.
  const T = { ...SONIC_TUNING, ...(beam ? RING_TUNING : null), ...tuning };
  // Ring mode is the fluid treatment end to end: it drives the flight curve as
  // well as the drawing, so the head flows instead of ticking. Set here rather
  // than asked for by the caller — the two belong together.
  T.smooth = beam;
  const group = new THREE.Group(); group.name = 'Sonic zigzag volley';
  const origins = (ampOrigins ?? []).map(point);
  const attacker = point(attackerPosition), defender = point(defenderPosition);
  const delay = Math.max(0, launchDelay);
  const duration = sonicVolleyDuration(dice.length, delay);
  const records = [];
  let disposed = false;

  const glow = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });

  // ── the Sustain barrier ────────────────────────────────────────────────────
  // A neon barrier STANDING IN FRONT of the Rival, not a cage wrapped around
  // it. The point is spatial: an absorbed shot dies visibly short of the Spirit
  // and a through-shot visibly crosses the plane, so the verdict is readable
  // without reading a label.
  //
  // It is a CURVED arc, not a flat panel. A flat panel faces the attacker and
  // therefore goes nearly edge-on from the side — which is exactly the angle
  // the volley is framed from, so the shield would vanish at the moment it
  // matters. An arc reads as a wall head-on and as a curve from the side.
  //
  // The arc's radius IS the stand-off, so its surface is precisely the set of
  // points where `buildSonicPath` stops an absorbed shot. The two cannot drift
  // apart. The stand-off is clamped against the real gap between the Spirits —
  // at melee range an unclamped barrier would sit behind the attacker and every
  // shot would launch from the wrong side of it.
  const laneForward = new THREE.Vector3().subVectors(defender, attacker).setY(0);
  const laneGap = laneForward.length() || 1;
  laneForward.divideScalar(laneGap);
  const standoff = Math.min(shieldRadius, laneGap * 0.45);
  const height = Math.min(shieldSize, standoff * 1.5 + 0.7);
  const ARC = Math.PI * 0.62;

  const shield = new THREE.Group(); shield.name = 'Sustain holds';
  shield.position.copy(defender).setY(defender.y + 0.1);
  // Swing the arc's centre onto the incoming lane. This is a physical barrier,
  // so it orients to the attack, never to the camera.
  shield.rotation.y = Math.atan2(-laneForward.x, -laneForward.z);
  group.add(shield);

  // Neon means SATURATED. A pale shield colour blended additively at low
  // opacity over a dark arena just reads as grey haze, so the barrier gets the
  // same one-hue / three-lightness ramp as the strokes.
  const shieldHsl = new THREE.Color(shieldColor).getHSL({ h: 0, s: 0, l: 0 });
  const shieldTone = (sat, light) => new THREE.Color().setHSL(shieldHsl.h, sat, light);
  const arc = (h, radius, opacity, sat, light) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, h, 40, 1, true, -ARC / 2, ARC),
      glow(shieldTone(sat, light), opacity));
    mesh.renderOrder = 138;
    shield.add(mesh);
    return mesh;
  };
  const field = arc(height, standoff, 0.11, 0.72, 0.42);            field.name = 'Sustain field';
  const rimTop = arc(0.075, standoff, 0.95, 0.8, 0.68);             rimTop.name = 'Sustain rim';
  const rimLow = arc(0.075, standoff, 0.95, 0.8, 0.68);             rimLow.name = 'Sustain rim';
  const spine = arc(height * 0.44, standoff * 1.002, 0.26, 0.78, 0.56); spine.name = 'Sustain inner';
  rimTop.position.y = height / 2; rimLow.position.y = -height / 2;
  // Vertical ribs read as a powered barrier rather than a sheet of fog, and
  // give the curve something to catch the eye at oblique angles.
  const ribs = [];
  for (let i = 0; i < 5; i++) {
    const at = -ARC / 2 + (ARC * (i + 0.5)) / 5;
    const rib = new THREE.Mesh(
      new THREE.CylinderGeometry(standoff * 1.004, standoff * 1.004, height * 0.94, 2, 1, true, at - 0.012, 0.024),
      glow(shieldTone(0.8, 0.6), 0.5));
    rib.renderOrder = 138; rib.name = 'Sustain rib'; shield.add(rib); ribs.push(rib);
  }

  const pitches = chordPitches.length ? chordPitches : [0];
  const rootPitch = Number(pitches[0]) || 0;

  if (origins.length) for (let i = 0; i < dice.length; i++) {
    const die = dice[i];
    const pitch = ((Number(pitches[i % pitches.length]) || 0) % 12 + 12) % 12;
    const interval = ((pitch - rootPitch) % 12 + 12) % 12;
    const sides = die.sides ?? 6;
    const power = sonicShotIntensity({ value: die.value, sides, shieldValue, mode: intensityMode });

    // A cel ramp is ONE hue at three lightnesses, not a hue lerped toward white
    // and black — lerping desaturates, which is why a strong shot washed out to
    // grey. The hue drifts with the chord pitch; saturation and lightness carry
    // the power, so a 6 reads hotter without ever losing its colour.
    const base = new THREE.Color(color);
    const hsl = base.getHSL({ h: 0, s: 0, l: 0 });
    const hue = (hsl.h + (pitch / 12 - 0.5) * 0.11 + 1) % 1;
    const tint = new THREE.Color().setHSL(hue, 0.62 + power * 0.32, 0.48 + power * 0.14);
    const hot = new THREE.Color().setHSL(hue, 0.42 + power * 0.2, 0.74 + power * 0.14);
    const edge = new THREE.Color().setHSL(hue, 0.86, 0.1 + power * 0.06);

    const path = buildSonicPath({
      origin: origins[i % origins.length], attackerPosition: attacker, defenderPosition: defender,
      side: i % 2 ? -1 : 1, passed: !!die.passed, clearance, shieldRadius:standoff,
    });
    // Leg length drifts with the chord interval, so a tritone shot zags more
    // often than a root. The corner count is what BOTH the drawn wave and the
    // head's cadence are built from, which is what keeps them in lockstep.
    const legLength = Math.max(1.3, T.legLength - interval * 0.07);
    const cornerCount = clamp(Math.round((path.length || 1) / legLength), 3, 14);

    const shot = new THREE.Group();
    shot.name = `Sonic die ${i + 1}: ${die.value} ${die.passed ? 'through' : 'absorbed'}`;
    shot.userData = { value: die.value, sides, passed: !!die.passed, power, interval, wrapSide: path.side };
    group.add(shot);

    // Cel shading is FLAT BANDS, so only the thin core is additive. Stacking
    // three additive strokes blows past 1.0 on every channel and the stroke
    // desaturates to white — the tint is lost before the bloom pass even runs.
    // Two opaque bands carry the colour; the core is the only part that halos.
    const outline = ribbon(edge, 0.92, false); outline.renderOrder = 140;
    const body = ribbon(tint, 0.62 + power * 0.34, false); body.renderOrder = 141;
    const core = ribbon(hot, power * 0.9, true); core.renderOrder = 142;
    outline.name = body.name = core.name = 'Harmonic wave ribbon';
    shot.add(outline, body, core);
    const bandWidths = [0.055 + power * 0.115, 0.032 + power * 0.072, 0.011 + power * 0.03].map(w => w * T.width);

    // Sparks shed from the stroke, concentrated at the zigzag's corners, where
    // the turn is sharpest. Strong shots fray; a 1 barely sheds at all.
    // Two cel bands of chevrons: a wide dim one reading as the outline, a bright
    // inner one. Only built in chevron mode, so ribbon mode pays nothing.
    const chevrons = strokeStyle === 'chevron' ? chevronField(tint, 0.9) : null;
    const chevronCore = strokeStyle === 'chevron' ? chevronField(hot, 0.95) : null;
    // A thin neon thread woven THROUGH the procession. Smooth sine against the
    // chevrons' hard angles — the contrast is the point; a second angular
    // element would just read as noise. Two bands so it glows without the
    // bloom pass, which the preview has no equivalent of.
    // The ring stack and its hot inner band. Two bands rather than three: the
    // cel outline exists to hold a hard silhouette, and a beam made of hoops
    // has no silhouette to hold — an opaque dark band under every ring would
    // just punch the arena out behind the beam.
    // Ring mode gets its OWN two tones rather than reusing the cel ramp. The
    // cel `hot` sits at lightness 0.74+ because one thin core line has to survive
    // a bloom pass; twenty overlapping hoops at that lightness sum straight to
    // white and the volley loses its colour entirely. So: more saturation, less
    // lightness, and let the overlap supply the brightness.
    const ringTint = new THREE.Color().setHSL(hue, 0.88, 0.48 + power * 0.07);
    const ringHot = new THREE.Color().setHSL(hue, 0.6, 0.66 + power * 0.08);
    const rings = strokeStyle === 'rings' ? ringField(ringTint, 0.85) : null;
    const ringCore = strokeStyle === 'rings' ? ringField(ringHot, 0.95) : null;
    // The same neon thread, now running down the beam's axis: the rings are the
    // body, the thread is the charge inside it.
    const threadBands = strokeStyle === 'chevron' || strokeStyle === 'rings'
      ? THREAD_LAYERS.map(layer => ribbon(layer.hot ? hot : tint, layer.opacity, true))
      : null;
    if (rings) {
      rings.name = ringCore.name = 'Harmonic wave rings';
      rings.renderOrder = 140; ringCore.renderOrder = 141;
      threadBands.forEach((band, i) => { band.name = 'Harmonic wave thread'; band.renderOrder = 142 + i; });
      shot.add(rings, ringCore, ...threadBands);
      for (const band of [outline, body, core]) band.visible = false;
    }
    if (chevrons) {
      chevrons.name = chevronCore.name = 'Harmonic wave chevrons';
      chevrons.renderOrder = 140; chevronCore.renderOrder = 141;
      threadBands.forEach((band, i) => { band.name = 'Harmonic wave thread'; band.renderOrder = 142 + i; });
      shot.add(chevrons, chevronCore, ...threadBands);
      for (const band of [outline, body, core]) band.visible = false;
    }

    const sparks = shardField(hot, 0.9);
    sparks.name = 'Harmonic wave ribbon'; sparks.renderOrder = 143; shot.add(sparks);

    // Where this shot meets the barrier plane. An absorbed shot blooms wide and
    // dies here; a through-shot only scuffs it on the way past.
    const ripples = rippleField(tint, 0.2); ripples.name = 'Harmonic wave ripple';
    ripples.renderOrder = 137; shot.add(ripples);

    // Absorbed shots detonate against the barrier; through-shots detonate on
    // the Spirit. Either way the shot ENDS in a burst rather than a fade.
    const burstColor = die.passed ? hot : shieldTone(0.85, 0.66);
    const burst = burstField(burstColor, 1); burst.name = 'Sonic impact burst';
    burst.renderOrder = 144; burst.visible = false; group.add(burst);
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), glow(burstColor, 1));
    flash.name = 'Sonic impact flash'; flash.renderOrder = 145; flash.visible = false; group.add(flash);
    const terminus = path.getPoint(1);
    burst.position.copy(terminus); flash.position.copy(terminus);

    const splash = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 6, 1), glow(die.passed ? hot : shieldColor, 0.9));
    splash.name = 'Sustain splash'; splash.renderOrder = 139; splash.visible = false;
    splash.position.copy(path.shieldPoint).setY(path.shieldPoint.y + 0.1);
    splash.lookAt(splash.position.clone().addScaledVector(laneForward, -1));
    group.add(splash);

    let compression=null,barrierRipple=null;
    if(beam&&!die.passed){
      compression=new THREE.Group();compression.name='Sustain compression';
      compression.position.copy(terminus);
      compression.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),laneForward.clone().negate());
      for(let c=0;c<4;c++){
        const hoop=new THREE.Mesh(new THREE.RingGeometry(.72,.92,24),glow(shieldTone(.85,.58),.3));
        compression.add(hoop);
      }
      group.add(compression);
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(37*6),3));
      const indices=[];for(let c=0;c<36;c++)indices.push(c*2,c*2+1,c*2+2,c*2+1,c*2+3,c*2+2);
      geometry.setIndex(indices);
      barrierRipple=new THREE.Mesh(geometry,glow(shieldTone(.85,.65),.5));
      barrierRipple.name='Sustain surface ripple';barrierRipple.frustumCulled=false;
      shield.add(barrierRipple);
    }

    records.push({
      path, shot, outline, body, core, sparks, splash, ripples, burst, flash, interval, power, sides,
      chevrons, chevronCore, threadBands, rings, ringCore, compression, barrierRipple,
      chevronCount: clamp(Math.ceil((path.length || 1) / T.chevronGap), 4, MAX_CHEVRONS),
      ringCount: clamp(Math.ceil((path.length || 1) / Math.max(0.18, T.ringGap)) + 1, 4, MAX_RINGS),
      passed: !!die.passed, value: die.value, start: delay + i * STAGGER_SECONDS,
      pathLength: path.length || 1,
      trail: Math.min(0.85, TRAIL_UNITS / (path.length || 1)),
      corners: cornerCount,
      // Solved once, not detected per frame, so the shield cue stays in the
      // same place under replay however the head's speed is warped.
      shieldTime: FLIGHT_SECONDS * sonicFlightInverse(path.shieldT, cornerCount, T),
      bands: [outline, body, core], bandWidths,
      // One centreline and one set of mitred normals, shared by all three bands.
      line: new Float32Array(SAMPLES * 3), normals: new Float32Array(SAMPLES * 3),
      // Per-shot constants, so a given die always frays identically on replay.
      seed: (i * 97 + die.value * 31 + interval * 17) % 1000 / 1000,
      // Solved once: the moment the head turned each corner. Detecting the turn
      // per frame would make the ripples depend on frame timing, and they would
      // land somewhere else on a replay.
      cornerTimes: Array.from({ length: cornerCount - 1 }, (_, c) =>
        FLIGHT_SECONDS * sonicFlightInverse((c + 1) / cornerCount, cornerCount, T)),
      burstAt: FLIGHT_SECONDS,
    });
  }

  const tangent = new THREE.Vector3(), across = new THREE.Vector3();
  const rightV = new THREE.Vector3(), upV = new THREE.Vector3();
  const edgeA = new THREE.Vector3(), edgeB = new THREE.Vector3();
  const normalA = new THREE.Vector3(), normalB = new THREE.Vector3(), miter = new THREE.Vector3();
  const toCamera = new THREE.Vector3(), worldUp = new THREE.Vector3(0, 1, 0);
  const sample = new THREE.Vector3();
  // Scratch for the fluid centreline. Deliberately separate from the vectors
  // above: solving the wave at two neighbouring stations to get its direction
  // must not clobber the frame the caller is in the middle of building.
  const centreA = new THREE.Vector3(), centreB = new THREE.Vector3();
  const wTan = new THREE.Vector3(), wAcross = new THREE.Vector3(), wUp = new THREE.Vector3(), wCam = new THREE.Vector3();

  /**
   * The fluid centreline at `t`, written into `target`. A sine plus a quiet
   * second harmonic on the camera-facing axis, and a quarter-turn-out-of-phase
   * companion on the axis perpendicular to that, so the wave has depth instead
   * of lying in one flat plane. The phase advances with the clock, so the wave
   * runs forward through the beam rather than sitting frozen in the world while
   * the head slides along it — still a pure function of elapsed time, so replay
   * and seeking land on identical frames. Returns the amplitude envelope.
   */
  function fluidCentre(target, r, t, swing, time, camera) {
    const tt = clamp(t, 0, 1);
    target.copy(r.path.getPoint(tt));
    wTan.copy(r.path.getTangent(tt));
    if (camera) {
      wCam.copy(camera.position).sub(target).normalize();
      wAcross.crossVectors(wTan, wCam);
      if (wAcross.lengthSq() < 1e-6) wAcross.crossVectors(wTan, worldUp);
    } else wAcross.crossVectors(wTan, worldUp);
    wAcross.normalize();
    wUp.crossVectors(wAcross, wTan).normalize();
    const envelope = (0.62 + 0.38 * Math.pow(1 - tt, 0.8)) * easeOutCubic(clamp((1 - tt) / 0.05, 0, 1));
    const y = Math.PI * tt * r.corners, phase = time * 2.4 + r.seed * 6.283;
    const lateral = (Math.sin(y - phase) * 0.84 + Math.sin(y * 2.17 + phase * 0.6) * 0.16) * swing * envelope;
    // Held well under the lateral swing: enough to keep the wave from being a
    // flat ribbon, not so much that the beam reads as a corkscrew.
    const lift = Math.cos(y - phase) * 0.26 * swing * envelope;
    target.addScaledVector(wAcross, lateral).addScaledVector(wUp, lift);
    return envelope;
  }

  /**
   * Where the camera should be looking, and how tight.
   *
   * ⚠️ The camera follows ONE subject — the first shot launched — for the whole
   * volley, and that subject is never retired. The obvious version ("focus on
   * whichever shot is furthest along, skipping ones that have landed") lurches
   * the camera backwards once per die: the leader finishes, drops out of the
   * search, and the focus snaps back to a shot one stagger-step behind, pulling
   * the camera out before it ramps in again. Five dice, five lurches.
   *
   * Pinning to the first shot makes both the focus point and `closeness`
   * monotonic by construction: its progress only ever increases, and once it
   * reaches contact it stays there — which is exactly where every later shot is
   * about to land anyway, so the camera holds on the action instead of chasing
   * individual projectiles. Returns null before the first shot launches.
   */
  function getFocus(elapsedSeconds, { reduced = false } = {}) {
    if (disposed || reduced || !records.length) return null;
    const time = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
    const lead = records[0];
    const age = time - lead.start;
    if (age < 0) return null;
    const progress = sonicFlightCurve(clamp(age / FLIGHT_SECONDS, 0, 1), lead.corners, T);
    return {
      progress,
      point: lead.path.getPoint(progress),
      target: lead.path.getPoint(1),
      closeness: clamp((progress - 0.55) / 0.45, 0, 1),
      passed: lead.passed,
    };
  }

  // Kept for call-site compatibility. Stroke widths are world units now, so
  // there is no screen resolution to tell the material about.
  function setResolution() {}

  // Ripples and the burst outlive the stroke, so they are driven from one place
  // and called on every record whether or not it is still in flight.
  function paintAftermath(r, age, reduced, camera) {
    // ── corner ripples ───────────────────────────────────────────────────────
    const rippleArray = r.ripples.geometry.attributes.position.array;
    const perRing = (RIPPLE_SEGMENTS + 1) * 2;
    let ring = 0;
    // Ring mode already leaves a wake made of rings, so a second field of
    // billboarded corner rings on top of it is just haze — and there are no
    // corners on a smooth wave to hang them off in the first place.
    if (!reduced && !r.rings) for (let c = r.cornerTimes.length - 1; c >= 0 && ring < RIPPLES_PER_SHOT; c--) {
      const life = (age - r.cornerTimes[c]) / RIPPLE_LIFE;
      if (life < 0 || life >= 1) continue;
      const at = r.path.getPoint((c + 1) / r.corners);
      // Billboarded: a ripple is a disturbance seen from wherever you stand.
      if (camera) { rightV.setFromMatrixColumn(camera.matrixWorld, 0); upV.setFromMatrixColumn(camera.matrixWorld, 1); }
      else { rightV.set(1, 0, 0); upV.set(0, 1, 0); }
      const outer = (0.14 + easeOutCubic(life) * (0.5 + r.power * 0.95)) * T.ripple;
      const inner = outer * (0.88 + life * 0.08);
      const base = ring * perRing;
      for (let seg = 0; seg <= RIPPLE_SEGMENTS; seg++) {
        const a = (seg / RIPPLE_SEGMENTS) * Math.PI * 2;
        const cx = Math.cos(a), cy = Math.sin(a);
        for (const [radius, slot] of [[inner, 0], [outer, 1]]) {
          const k = (base + seg * 2 + slot) * 3;
          rippleArray[k] = at.x + (rightV.x * cx + upV.x * cy) * radius;
          rippleArray[k + 1] = at.y + (rightV.y * cx + upV.y * cy) * radius;
          rippleArray[k + 2] = at.z + (rightV.z * cx + upV.z * cy) * radius;
        }
      }
      ring++;
    }
    for (let k = ring * perRing * 3; k < rippleArray.length; k++) rippleArray[k] = 0;
    r.ripples.geometry.attributes.position.needsUpdate = true;
    r.ripples.visible = ring > 0;
    r.ripples.material.opacity = 0.2 * (0.35 + r.power * 0.65) * T.ripple;

    // ── the burst ────────────────────────────────────────────────────────────
    const burstLife = (age - r.burstAt) / BURST_LIFE;
    const bursting = burstLife >= 0 && burstLife < 1;
    r.burst.visible = bursting; r.flash.visible = bursting && burstLife < 0.3;
    if (!bursting) return 0;
    const eased = easeOutCubic(burstLife);
    // An absorbed shot detonates flat and wide across the barrier; a
    // through-shot punches a tighter, hotter hole in the Spirit.
    const reach = (r.passed ? 0.75 : 1.5) * (0.45 + r.power * 0.9) * T.burst;
    const array = r.burst.geometry.attributes.position.array;
    if (camera) { rightV.setFromMatrixColumn(camera.matrixWorld, 0); upV.setFromMatrixColumn(camera.matrixWorld, 1); }
    else { rightV.set(1, 0, 0); upV.set(0, 1, 0); }
    for (let i = 0; i < BURST_SPIKES; i++) {
      const a = (i / BURST_SPIKES) * Math.PI * 2 + r.seed * 6.283;
      // Uneven lengths are what make it a detonation and not a hoop.
      const ragged = 0.45 + ((Math.sin(i * 12.9898 + r.seed * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.55;
      const len = reach * eased * ragged;
      const wide = len * 0.16 * (1 - eased * 0.6);
      const dx = Math.cos(a), dy = Math.sin(a);
      const px = rightV.x * dx + upV.x * dy, py = rightV.y * dx + upV.y * dy, pz = rightV.z * dx + upV.z * dy;
      const qx = -rightV.x * dy + upV.x * dx, qy = -rightV.y * dy + upV.y * dx, qz = -rightV.z * dy + upV.z * dx;
      const b = i * 9;
      array[b] = px * len; array[b + 1] = py * len; array[b + 2] = pz * len;
      array[b + 3] = px * len * 0.12 + qx * wide; array[b + 4] = py * len * 0.12 + qy * wide; array[b + 5] = pz * len * 0.12 + qz * wide;
      array[b + 6] = px * len * 0.12 - qx * wide; array[b + 7] = py * len * 0.12 - qy * wide; array[b + 8] = pz * len * 0.12 - qz * wide;
    }
    r.burst.geometry.attributes.position.needsUpdate = true;
    r.burst.material.opacity = (1 - eased) * (0.55 + r.power * 0.45);
    r.flash.scale.setScalar((0.6 + eased * 5) * (0.5 + r.power) * T.burst);
    r.flash.material.opacity = Math.max(0, 1 - burstLife / 0.3) * (0.5 + r.power * 0.5);
    return (1 - burstLife) * (r.passed ? 0.3 : 1.1) * (0.4 + r.power);
  }

  // Chevrons occupy fixed stations along the path and ignite in order, so the
  // "movement" is the ignition sweeping forward. Behind the head they decay over
  // a fixed NUMBER of chevrons rather than a fixed time — which keeps the tail
  // legible whatever the cadence is doing, where a time-based fade would vanish
  // entirely once the shot drops into its slow-motion approach.
  /**
   * Put `sample` on the wave's centreline at `t`, leaving `tangent`, `across`
   * and (in fluid mode) `upV` as an orthonormal frame there. Returns the
   * amplitude envelope, so callers can taper whatever else they draw the same
   * way. Shared by the chevrons, the rings and the thread, which is what keeps
   * the thread woven through the procession rather than beside it.
   *
   * Fluid mode is a smooth TRAVELLING wave on two perpendicular axes — a
   * flattened helix — where the zigzag modes tick along a camera-facing
   * triangle. Two differences do the work:
   *   · a sine plus a quiet second harmonic, instead of a triangle, so the line
   *     sways instead of turning corners;
   *   · a phase that advances with the clock, so the wave runs forward through
   *     the beam in place instead of sitting frozen while the head slides along
   *     it. It stays a pure function of absolute elapsed time, so replay and
   *     seeking still land on identical frames.
   */
  function placeCentre(r, t, swing, time, camera, fluid) {
    if (!fluid) {
      sample.copy(r.path.getPoint(t));
      tangent.copy(r.path.getTangent(t));
      if (camera) {
        toCamera.copy(camera.position).sub(sample).normalize();
        across.crossVectors(tangent, toCamera);
        if (across.lengthSq() < 1e-6) across.crossVectors(tangent, worldUp);
      } else across.crossVectors(tangent, worldUp);
      across.normalize();
      const flat = (0.62 + 0.38 * Math.pow(1 - t, 0.8)) * easeOutCubic(clamp((1 - t) / 0.05, 0, 1));
      sample.addScaledVector(across, triangle(t * r.corners) * swing * flat);
      return flat;
    }
    const envelope = fluidCentre(sample, r, t, swing, time, camera);
    // ⚠️ The frame comes from the DISPLACED curve, not from the path underneath
    // it. Orienting the rings to the path's own tangent leaves every hoop facing
    // the same way while their centres snake between them — which reads as a
    // corkscrew spring, not as a beam. Differencing the wave either side of the
    // station gives the direction the beam is actually pointing there, so the
    // hoops stay square to it and the stack bends as one tube.
    const step = 0.004;
    fluidCentre(centreA, r, Math.min(1, t + step), swing, time, camera);
    fluidCentre(centreB, r, Math.max(0, t - step), swing, time, camera);
    tangent.subVectors(centreA, centreB);
    if (tangent.lengthSq() < 1e-12) tangent.copy(r.path.getTangent(t));
    tangent.normalize();
    if (camera) {
      toCamera.copy(camera.position).sub(sample).normalize();
      across.crossVectors(tangent, toCamera);
      if (across.lengthSq() < 1e-6) across.crossVectors(tangent, worldUp);
    } else across.crossVectors(tangent, worldUp);
    across.normalize();
    upV.crossVectors(across, tangent).normalize();
    return envelope;
  }

  function paintThread(r, tailT, headT, swing, alive, time, camera, T, fluid = false) {
    // Against the chevrons the thread is the one soft thing in the frame and can
    // afford to be bright. Inside a ring beam it is one more additive element in
    // a stack that is already close to clipping, so it runs well back.
    const trim = fluid ? 0.55 : 1;
    const scale = Math.max(0, T.thread) * trim;
    const base = 0.155 * scale;
    if (scale <= 0.001 || headT - tailT < 1e-4) {
      for (const band of r.threadBands) band.visible = false;
      return;
    }
    for (let s = 0; s < SAMPLES; s++) {
      const u = s / (SAMPLES - 1);
      const t = tailT + (headT - tailT) * u;
      const envelope = placeCentre(r, t, swing, time, camera, fluid);
      // A smooth weave around the procession's own centre, so the thread
      // crosses in and out between the marks instead of running alongside. In
      // ring mode the rings are hoops around this line, so the weave is what
      // stops the thread sitting dead on their shared axis.
      const weave = Math.sin(t * r.pathLength * 1.15 + time * 3.2 + r.seed * 6.283) * 0.19 * scale * envelope;
      sample.addScaledVector(across, weave);
      const fade = easeOutCubic(clamp(u / 0.16, 0, 1)) * easeOutCubic(clamp((1 - u) / 0.06, 0, 1));
      // A little width wobble along the length, so the blur breathes instead of
      // reading as a perfectly extruded tube.
      const breathe = 1 + 0.22 * Math.sin(t * r.pathLength * 2.3 - time * 4.1 + r.seed * 3.1);
      for (let b = 0; b < r.threadBands.length; b++) {
        const array = r.threadBands[b].geometry.attributes.position.array;
        const w = base * THREAD_LAYERS[b].width * breathe * (0.35 + 0.65 * fade);
        const a = s * 6, c = a + 3;
        array[a] = sample.x + across.x * w; array[a + 1] = sample.y + across.y * w; array[a + 2] = sample.z + across.z * w;
        array[c] = sample.x - across.x * w; array[c + 1] = sample.y - across.y * w; array[c + 2] = sample.z - across.z * w;
      }
    }
    for (let b = 0; b < r.threadBands.length; b++) {
      const mesh = r.threadBands[b];
      mesh.geometry.attributes.position.needsUpdate = true;
      mesh.visible = true;
      mesh.material.opacity = THREAD_LAYERS[b].opacity * trim * alive * (0.4 + r.power * 0.6);
    }
  }

  function paintChevrons(r, head, tail, swing, alive, time, reduced, camera, T) {
    const positions = r.chevrons.geometry.attributes.position;
    const array = positions.array, coreArray = r.chevronCore.geometry.attributes.position.array;
    const gap = Math.max(0.25, T.chevronGap);
    const headStation = head * r.pathLength / gap;
    // The tail draws in as the shot closes, so the procession concentrates into
    // the impact instead of arriving with a long train behind it.
    const tailLength = Math.max(2, T.chevronTail * (1 - 0.55 * head));
    let lit = 0;
    for (let c = 0; c < MAX_CHEVRONS; c++) {
      const base = c * 18;
      const behind = headStation - c;
      const station = (c * gap) / r.pathLength;
      let strength = 0;
      if (c < r.chevronCount && behind >= 0 && behind <= tailLength && station <= 1) {
        strength = 1 - behind / tailLength;
        // A brief flare on the frame it ignites: the chevron announces itself.
        if (behind < 0.6) strength = Math.min(1.6, strength + (0.6 - behind) * 1.1);
      }
      if (strength <= 0.001) { for (let k = 0; k < 18; k++) { array[base + k] = 0; coreArray[base + k] = 0; } continue; }
      lit++;
      placeCentre(r, station, swing, time, camera, false);
      // Fading chevrons also shrink, so the tail dissipates rather than just
      // turning translucent.
      const scale = (0.55 + r.power * 0.75) * Math.min(1, 0.45 + strength * 0.75) * T.width;
      const len = 0.4 * scale, wide = 0.3 * scale, thick = 0.17 * scale;
      const write = (target, mul) => {
        const L = len * mul, W = wide * mul, T2 = thick * mul;
        const put = (slot, f, sdir) => {
          const k = base + slot * 3;
          target[k] = sample.x + tangent.x * f + across.x * sdir;
          target[k + 1] = sample.y + tangent.y * f + across.y * sdir;
          target[k + 2] = sample.z + tangent.z * f + across.z * sdir;
        };
        put(0, L, 0); put(1, -L * 0.35, W); put(2, -L * 0.35 - T2, W);
        put(3, L - T2 * 1.7, 0); put(4, -L * 0.35, -W); put(5, -L * 0.35 - T2, -W);
      };
      write(array, 1); write(coreArray, 0.58);
    }
    positions.needsUpdate = true;
    r.chevronCore.geometry.attributes.position.needsUpdate = true;
    r.chevrons.visible = r.chevronCore.visible = lit > 0;
    // The thread spans exactly the lit stretch of the procession.
    const tailStation = Math.max(0, headStation - tailLength);
    paintThread(r, clamp(tailStation * gap / r.pathLength, 0, 1), clamp(head, 0, 1), swing, alive, time, camera, T);
    r.chevrons.material.opacity = 0.55 * alive * (0.4 + r.power * 0.6);
    r.chevronCore.material.opacity = 0.85 * alive * (0.3 + r.power * 0.7);
  }

  // ── the ring beam ──────────────────────────────────────────────────────────
  // Rings occupy fixed stations and ignite in order, exactly like the chevrons,
  // but each one then INFLATES as the wavefront pulls away from it. That is the
  // whole read: at the head there is only a bright point, and a beam grows out
  // of it backwards. The stack's outline — tight nose, full body, tapering
  // tail — is a profile of `behind`, so it travels with the shot rather than
  // being painted onto the arena.
  //
  // Every ring shares one material, so brightness cannot vary per ring. The
  // gradient along the beam is carried instead by GEOMETRY: rings thin out as
  // they fall behind, and the hot inner band is only written for the front
  // stretch, collapsing to nothing by the middle of the tail. Under additive
  // blending less covered area reads as dimmer, which is the effect wanted.
  function paintRings(r, head, rawSwing, alive, time, reduced, camera, T) {
    // The wave has to stay SMALLER than the beam it is bending, or the column
    // stops reading as a beam and turns into a wire threaded with hoops. The
    // zigzag modes want the opposite — there the swing IS the shape — so the
    // shared Wave size knob is damped here rather than split into two controls
    // that would have to be dialled in step.
    const swing = rawSwing * 0.6;
    const array = r.rings.geometry.attributes.position.array;
    const coreArray = r.ringCore.geometry.attributes.position.array;
    const perRing = (RING_SEGMENTS + 1) * 2, stride = perRing * 3;
    const gap = Math.max(0.18, T.ringGap);
    const headStation = head * r.pathLength / gap;
    // The beam draws in as the shot closes, so it concentrates into the impact
    // instead of arriving with a long column behind it. Counted in RINGS, not
    // in seconds: a time-based tail would evaporate the moment the shot drops
    // into its slow-motion approach, because no new rings are igniting.
    const tailLength = Math.max(3, T.ringTail * (1 - 0.35 * head));
    const beam = Math.max(0.02, T.beamRadius) * (0.45 + r.power * 0.85);
    let lit = 0;
    for (let c = 0; c < MAX_RINGS; c++) {
      const base = c * stride;
      const behind = headStation - c;
      const station = (c * gap) / r.pathLength;
      const b = c < r.ringCount && behind >= 0 && behind <= tailLength && station <= 1
        ? behind / tailLength : -1;
      if (b < 0) { for (let k = 0; k < stride; k++) { array[base + k] = 0; coreArray[base + k] = 0; } continue; }
      lit++;
      placeCentre(r, station, swing, time, camera, true);
      // The last 160 ms of a held shot stacks its hoops against the wall.
      // Only compress the forward tail; launching and the smooth cadence stay intact.
      const squeeze=r.passed||reduced?0:clamp((time-r.start-FLIGHT_SECONDS+.16)/.16,0,1);
      if(squeeze){
        const distance=r.path.shieldPoint.clone().sub(sample).dot(laneForward);
        sample.addScaledVector(laneForward,Math.max(0,distance)*squeeze*.62);
      }
      // Born tight at the wavefront, open by a sixth of the way back: the beam
      // builds out of the head rather than switching on along its length.
      const nose = easeOutCubic(clamp(b / 0.28, 0, 1));
      const fall = Math.pow(1 - b, 0.7);
      // A swell running back through the stack — the rings breathe in sequence,
      // which is what makes the beam read as a waveform and not as a pipe.
      const swell = reduced ? 1 : 1 + 0.24 * Math.sin(b * 5.6 - time * 5.2 + r.seed * 6.283);
      // Necking down into contact, so the beam converges on the impact point.
      const tip = 0.35 + 0.65 * easeOutCubic(clamp((1 - station) / 0.05, 0, 1));
      const radius = Math.max(0.004, beam * nose * fall * swell * tip * (1+squeeze*.22));
      // Thickness is a FRACTION OF THE RADIUS, not an absolute width. A fixed
      // hairline band turns the beam into a wireframe drawing of itself — every
      // hoop reads as an outline and the column has no mass. Scaling with the
      // radius keeps each ring a substantial band whatever the calibre, and it
      // is the overlap of those bands that makes the beam look solid.
      const thick = radius * (0.34 + r.power * 0.26) * T.width * (0.45 + 0.55 * (1 - b));
      const inner = Math.max(0.001, radius - thick * 0.5), outer = radius + thick * 0.5;
      // The hot band only exists on the leading stretch, so the beam runs from
      // a white-hot nose to a cool trailing column.
      const heat = clamp((0.55 - b) / 0.55, 0, 1);
      const hotThick = thick * 0.62 * heat;
      const hotIn = Math.max(0.0005, radius - hotThick * 0.5), hotOut = radius + hotThick * 0.5;
      for (let s = 0; s <= RING_SEGMENTS; s++) {
        const a = (s / RING_SEGMENTS) * Math.PI * 2;
        const cx = Math.cos(a), cy = Math.sin(a);
        const dx = across.x * cx + upV.x * cy, dy = across.y * cx + upV.y * cy, dz = across.z * cx + upV.z * cy;
        const k = base + s * 6;
        array[k] = sample.x + dx * inner; array[k + 1] = sample.y + dy * inner; array[k + 2] = sample.z + dz * inner;
        array[k + 3] = sample.x + dx * outer; array[k + 4] = sample.y + dy * outer; array[k + 5] = sample.z + dz * outer;
        coreArray[k] = sample.x + dx * hotIn; coreArray[k + 1] = sample.y + dy * hotIn; coreArray[k + 2] = sample.z + dz * hotIn;
        coreArray[k + 3] = sample.x + dx * hotOut; coreArray[k + 4] = sample.y + dy * hotOut; coreArray[k + 5] = sample.z + dz * hotOut;
      }
    }
    r.rings.geometry.attributes.position.needsUpdate = true;
    r.ringCore.geometry.attributes.position.needsUpdate = true;
    r.rings.visible = r.ringCore.visible = lit > 0;
    // The thread runs the lit length of the beam — the charge inside the hoops.
    const tailStation = Math.max(0, headStation - tailLength) * gap / r.pathLength;
    paintThread(r, clamp(tailStation, 0, 1), clamp(head, 0, 1), swing, alive, time, camera, T, true);
    // Twenty overlapping hoops summed additively reach 1.0 on every channel long
    // before the bloom pass does, and the tint is gone — the beam turns white.
    // A beam made of many marks has to run at a fraction of the per-mark opacity
    // a single stroke can afford, and the depth of colour comes back from the
    // overlap instead of from the material.
    r.rings.material.opacity = 0.3 * alive * (0.4 + r.power * 0.6);
    r.ringCore.material.opacity = 0.46 * alive * (0.3 + r.power * 0.7);
  }

  function update(elapsedSeconds, { reduced = false, camera = null } = {}) {
    if (disposed) return;
    const time = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0;
    group.visible = time < duration && records.length > 0;
    let resonance = 0;

    for (const r of records) {
      const age = time - r.start;
      if(r.compression){
        const contactAge=age-FLIGHT_SECONDS;
        const life=clamp(contactAge/.38,0,1);
        r.compression.visible=contactAge>=0&&contactAge<.22;
        r.barrierRipple.visible=contactAge>=0&&contactAge<.46;
        r.compression.children.forEach((hoop,i)=>{
          hoop.position.z=reduced?.015:.025+i*.14*(1-clamp(contactAge/.14,0,1));
          hoop.scale.setScalar(T.beamRadius*(.55+r.power*.6)*(1+i*.14+life*.9));
          hoop.material.opacity=.34*(1-clamp(contactAge/.22,0,1));
        });
        const radius=reduced?.48:.12+life*Math.min(height*.7,standoff*.85);
        const array=r.barrierRipple.geometry.attributes.position.array;
        for(let seg=0;seg<=36;seg++)for(let edge=0;edge<2;edge++){
          const theta=seg/36*Math.PI*2,rad=radius*(edge?.99:.90);
          const angle=clamp(Math.cos(theta)*rad/standoff,-ARC*.48,ARC*.48),k=seg*6+edge*3;
          array[k]=Math.sin(angle)*(standoff+.012);
          array[k+1]=clamp(Math.sin(theta)*rad,-height*.48,height*.48);
          array[k+2]=Math.cos(angle)*(standoff+.012);
        }
        r.barrierRipple.geometry.attributes.position.needsUpdate=true;
        r.barrierRipple.material.opacity=.65*(1-clamp(contactAge/.46,0,1));
      }
      const progress = clamp(age / FLIGHT_SECONDS, 0, 1);
      const flying = age >= 0 && age < FLIGHT_SECONDS;
      r.shot.visible = flying;
      resonance = Math.max(resonance, paintAftermath(r, age, reduced, camera));
      if (!flying) {
        r.sparks.visible = false;
        if (r.rings) r.rings.visible = r.ringCore.visible = false;
        if (r.chevrons) r.chevrons.visible = r.chevronCore.visible = false;
        if (r.threadBands) for (const band of r.threadBands) band.visible = false;
        // The splash outlives the stroke — it is the moment of contact, and the
        // stroke has already been consumed by the time it blooms.
        const splashAge = age - r.shieldTime, life = clamp(splashAge / 0.46, 0, 1);
        r.splash.visible = splashAge >= 0 && life < 1;
        if (r.splash.visible) {
          r.splash.scale.setScalar(1 + life * (r.passed ? 1.6 : 5.5) * (0.5 + r.power));
          r.splash.material.opacity = (1 - life) * (r.passed ? 0.45 : 1) * (0.45 + r.power * 0.55);
          resonance = Math.max(resonance, (1 - life) * (r.passed ? 0.3 : 1) * (0.4 + r.power));
        }
        continue;
      }

      // Fade in at the muzzle and out at contact, so nothing pops.
      const entry = clamp(age / 0.12, 0, 1);
      const exit = clamp((FLIGHT_SECONDS - age) / 0.14, 0, 1);
      const alive = entry * exit;

      // Reduced motion gets the plain linear travel — the staccato and the
      // slow-motion approach are exactly the kind of thing that has to stop.
      const head = reduced ? progress : sonicFlightCurve(progress, r.corners, T);
      const tail = Math.max(0, head - r.trail);
      const strokeUnits = Math.max(0.25, (head - tail) * r.pathLength);
      const cycles = strokeUnits / (r.pathLength / r.corners) / 2;
      // A touch of electric shimmer, strongest while the head eases through a
      // corner, so a dwelling stroke reads as held rather than as frozen.
      // Ring mode has no corners to dwell in, and the electric shimmer is there
      // to keep a HELD stroke from reading as a frozen one — a beam that is
      // already undulating needs no such rescue.
      const dwell = r.rings ? 0 : 1 - Math.abs(triangle(head * r.corners));
      const shimmer = reduced ? 1 : 1 + 0.07 * dwell * Math.sin(time * 38 + r.seed * 9);
      const swing = (reduced ? SWING_MIN : SWING_MIN + (T.swing - SWING_MIN) * r.power) * shimmer;

      // The barrier splash is solved off the same clock in every mode, so it is
      // painted BEFORE the drawing branches rather than after them — the
      // chevrons and the rings both return early, and hanging the splash off
      // the end of the ribbon path would silently drop it for both.
      const contactAge = age - r.shieldTime;
      const contactLife = clamp(contactAge / 0.46, 0, 1);
      r.splash.visible = contactAge >= 0 && contactLife < 1;
      if (r.splash.visible) {
        // Absorbed shots spread right across the panel; through-shots barely
        // disturb it, which is the second, non-spatial channel for the verdict.
        r.splash.scale.setScalar(1 + contactLife * (r.passed ? 1.6 : 5.5) * (0.5 + r.power));
        r.splash.material.opacity = (1 - contactLife) * (r.passed ? 0.45 : 1) * (0.45 + r.power * 0.55);
        resonance = Math.max(resonance, (1 - contactLife) * (r.passed ? 0.3 : 1) * (0.4 + r.power));
      }

      if (r.rings) { paintRings(r, head, swing, alive, time, reduced, camera, T); continue; }
      if (r.chevrons) { paintChevrons(r, head, tail, swing, alive, time, reduced, camera, T); continue; }

      // ── pass 1: the centreline ─────────────────────────────────────────────
      for (let s = 0; s < SAMPLES; s++) {
        const along = s / (SAMPLES - 1);
        const t = tail + (head - tail) * along;
        sample.copy(r.path.getPoint(t));
        tangent.copy(r.path.getTangent(t));
        // Oscillate across the view, not across the world: a world-locked plane
        // vanishes when the camera lines up with it.
        if (camera) {
          toCamera.copy(camera.position).sub(sample).normalize();
          across.crossVectors(tangent, toCamera);
          if (across.lengthSq() < 1e-6) across.crossVectors(tangent, worldUp);
        } else across.crossVectors(tangent, worldUp);
        across.normalize();
        // Amplitude has to SURVIVE the approach. Fading it toward the target, or
        // toward the leading end of the stroke, flattens the zigzag exactly
        // during the slow-motion beat the player is watching.
        const tailFade = easeOutCubic(clamp(along / 0.22, 0, 1));
        const tipTaper = easeOutCubic(clamp((1 - t) / 0.05, 0, 1));
        const envelope = (0.62 + 0.38 * Math.pow(1 - t, 0.8)) * tailFade * tipTaper;
        // Phase comes from how far along the PATH this point is, not from where
        // it sits in the stroke — so the wave is emitted into the world and the
        // travelling stroke slides along it, instead of the wave sliding inside
        // a stroke that is itself moving (which reads as wobble, not as flow).
        sample.addScaledVector(across, triangle(t * r.corners) * swing * envelope);
        r.line[s * 3] = sample.x; r.line[s * 3 + 1] = sample.y; r.line[s * 3 + 2] = sample.z;
      }

      // ── pass 2: mitred normals ─────────────────────────────────────────────
      // The corner is only as sharp as its join. Averaging the two edge normals
      // and extending by 1/cos(half-angle) keeps the OUTSIDE of each turn on a
      // clean point instead of rounding it off — which is the whole reason this
      // is hand-built rather than a line primitive. The extension is clamped so
      // a hairpin cannot fire a spike across the arena.
      for (let s = 0; s < SAMPLES; s++) {
        const i3 = s * 3;
        const prev = Math.max(0, s - 1) * 3, next = Math.min(SAMPLES - 1, s + 1) * 3;
        edgeA.set(r.line[i3] - r.line[prev], r.line[i3 + 1] - r.line[prev + 1], r.line[i3 + 2] - r.line[prev + 2]);
        edgeB.set(r.line[next] - r.line[i3], r.line[next + 1] - r.line[i3 + 1], r.line[next + 2] - r.line[i3 + 2]);
        if (edgeA.lengthSq() < 1e-12) edgeA.copy(edgeB);
        if (edgeB.lengthSq() < 1e-12) edgeB.copy(edgeA);
        edgeA.normalize(); edgeB.normalize();
        sample.set(r.line[i3], r.line[i3 + 1], r.line[i3 + 2]);
        if (camera) toCamera.copy(camera.position).sub(sample).normalize();
        else toCamera.copy(worldUp);
        normalA.crossVectors(edgeA, toCamera);
        normalB.crossVectors(edgeB, toCamera);
        if (normalA.lengthSq() < 1e-12) normalA.crossVectors(edgeA, worldUp);
        if (normalB.lengthSq() < 1e-12) normalB.crossVectors(edgeB, worldUp);
        normalA.normalize(); normalB.normalize();
        miter.copy(normalA).add(normalB);
        let extend = 1;
        if (miter.lengthSq() < 1e-12) miter.copy(normalB);
        else { miter.normalize(); extend = Math.min(3, 1 / Math.max(0.34, miter.dot(normalB))); }
        r.normals[i3] = miter.x * extend;
        r.normals[i3 + 1] = miter.y * extend;
        r.normals[i3 + 2] = miter.z * extend;
      }

      // ── pass 3: three cel bands off one centreline ─────────────────────────
      for (let b = 0; b < 3; b++) {
        const positions = r.bands[b].geometry.attributes.position;
        const array = positions.array, width = r.bandWidths[b];
        for (let s = 0; s < SAMPLES; s++) {
          const i3 = s * 3, w = width * spearProfile(s / (SAMPLES - 1));
          const nx = r.normals[i3] * w, ny = r.normals[i3 + 1] * w, nz = r.normals[i3 + 2] * w;
          const a = s * 6, c = a + 3;
          array[a] = r.line[i3] + nx; array[a + 1] = r.line[i3 + 1] + ny; array[a + 2] = r.line[i3 + 2] + nz;
          array[c] = r.line[i3] - nx; array[c + 1] = r.line[i3 + 1] - ny; array[c + 2] = r.line[i3 + 2] - nz;
        }
        positions.needsUpdate = true;
      }
      r.outline.material.opacity = 0.85 * alive;
      r.body.material.opacity = (0.5 + r.power * 0.45) * alive;
      r.core.material.opacity = r.power * 0.95 * alive;

      // Chevron shards shed from the corners of the wave, where the turn is
      // sharpest and the energy would actually spill. Hard-edged and aligned to
      // travel — a round sprite would undo the whole cel read.
      const shedding = !reduced && r.power > 0.18;
      r.sparks.visible = shedding;
      if (shedding) {
        const positions = r.sparks.geometry.attributes.position;
        const array = positions.array;
        const count = Math.max(3, Math.round(SHARDS_PER_SHOT * r.power));
        for (let s = 0; s < SHARDS_PER_SHOT; s++) {
          const base = s * 9;
          if (s >= count) { for (let k = 0; k < 9; k++) array[base + k] = 0; continue; }
          const crest = (Math.floor(s * 0.5) + 0.5) / Math.max(1, cycles);
          const along = clamp(crest + (s % 2 ? 0.5 / Math.max(1, cycles) : 0), 0.04, 0.97);
          const t = tail + (head - tail) * along;
          const life = ((time * (1.4 + r.seed) + s * 0.137) % 1);
          sample.copy(r.path.getPoint(t));
          tangent.copy(r.path.getTangent(t));
          if (camera) {
            toCamera.copy(camera.position).sub(sample).normalize();
            across.crossVectors(tangent, toCamera);
            if (across.lengthSq() < 1e-6) across.crossVectors(tangent, worldUp);
          } else across.crossVectors(tangent, worldUp);
          across.normalize();
          const envelope = 0.62 + 0.38 * Math.pow(1 - t, 0.8);
          const side = s % 2 ? 1 : -1;
          const spread = (SWING_MIN + r.power * 0.34) * envelope * (0.5 + life * 1.4);
          sample.addScaledVector(across, side * spread).addScaledVector(tangent, -life * 0.5);
          sample.y += life * 0.16 * envelope;
          // Apex forward along travel, two corners trailing: a dart, not a dot.
          const len = (0.09 + r.power * 0.14) * (1 - life * 0.55);
          const half = len * 0.34;
          array[base] = sample.x + tangent.x * len;
          array[base + 1] = sample.y + tangent.y * len;
          array[base + 2] = sample.z + tangent.z * len;
          array[base + 3] = sample.x - tangent.x * len * 0.5 + across.x * half;
          array[base + 4] = sample.y - tangent.y * len * 0.5 + across.y * half;
          array[base + 5] = sample.z - tangent.z * len * 0.5 + across.z * half;
          array[base + 6] = sample.x - tangent.x * len * 0.5 - across.x * half;
          array[base + 7] = sample.y - tangent.y * len * 0.5 - across.y * half;
          array[base + 8] = sample.z - tangent.z * len * 0.5 - across.z * half;
        }
        positions.needsUpdate = true;
        r.sparks.material.opacity = 0.85 * alive * r.power;
      }
    }
    // The barrier holds: it brightens under fire and never comes apart. §3 —
    // absorbing is what Sustain DOES, so it must not read as damage.
    const fade = clamp((duration - time) * 4, 0, 1);
    const lit = (0.9 + resonance * 0.7) * fade;
    rimTop.material.opacity = lit; rimLow.material.opacity = lit;
    field.material.opacity = (0.08 + resonance * 0.45) * fade;
    spine.material.opacity = (0.26 + resonance * 0.5) * fade;
    for (let i = 0; i < ribs.length; i++) {
      // The ribs ripple outward from the centre under fire.
      const pulse = reduced ? 0 : Math.sin(time * 7 - i * 0.7) * 0.5 + 0.5;
      ribs[i].material.opacity = (0.32 + resonance * 0.55 * pulse) * fade;
    }
    // It flexes under fire and never comes apart: §3 — absorbing is what
    // Sustain DOES, so it must not read as damage.
    shield.scale.setScalar(1 + resonance * 0.03);
  }

  function dispose() {
    if (disposed) return; disposed = true;
    group.removeFromParent();
    const resources = new Set();
    group.traverse(o => {
      if (o.geometry) resources.add(o.geometry);
      for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) resources.add(m);
    });
    for (const r of resources) r.dispose();
    group.clear(); records.length = 0;
  }

  update(0);
  return { group, object: group, duration, update, dispose, setResolution, getFocus };
}

export { FLIGHT_SECONDS, IMPACT_SECONDS, STAGGER_SECONDS };
