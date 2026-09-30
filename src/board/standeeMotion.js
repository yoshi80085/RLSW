// ─── 🎭 STANDEE MOTION — how a Spirit crosses a hex, and which note it lands on ─
// Alex, 2026-09-30: "I'd like to change the way the standees move - I'd like to
// look at different options from how they might move or glide to how it sounds
// when they 'land' on a space. I'm thinking perhaps it make a crystal/glass like
// sound when the standees move to a space." Second pass the same day: "how a
// heavy weighted object might sound - a more dull sound like a thump/thud as it
// hits something like a glass surface … as well as something … space-y".
//
// ⭐ EVERY NUMBER IN `STANDEE_MOVE` IS ALEX'S DIAL-IN off
// `.scratch/standee-move-preview.html` (2026-09-30): 6 of 61 levers moved —
//   voice slab · weight .45 · echo .06 · sparkleTail 2 · travelSound rumble ·
//   pitchMode fixed.
// Everything else he left at the page's defaults, which is also a decision:
// the HOP, the ripple, the blink for Shukuchi, the skate + clack for a shove.
// "I found a good sound I think. I'd like to run with this for now."
//
// 📌 ONE COPY. The preview page imports THIS object as its defaults, so "reset"
// on the page is the game, and the next dial-in is measured against what ships.
// `standeeMoveCheck.mjs` §0 fails if the page grows a lever this does not name.
//
// 📌 TWO HALVES, like `moveTiles.js` / `standee.js`. This file is pure — no
// three, no DOM, no clock: `planStep` says how long each phase of one step
// lasts, `stepPose` says where the piece is `ms` into it, `landingNotes` says
// which note rings. `standeeSteps.js` is the three.js half (the queue, the
// ripple, the sparkles); `audio/landingSfx.js` is the sound.
//
// ⚠️ A STEP IS ONE HEX. The engine's `MOVE_STEP` (`engine/systems/movement.js`)
// is one hex and turns the Spirit to face it, so a four-hex walk is four steps.
// The renderer only sees `spirit.num` change, so it infers the KIND from the
// distance and the knockback counter (`stepKind`).
//
// ⚠️ ROTATION ORDER. `pitch` tips the sheet toward its OWN face (the print — the
// way the Spirit faces), `roll` tips it sideways. They assume the group's
// `rotation.order` is 'YXZ': yaw first, then the tilt in the standee's own
// frame. With pitch at 0 that order leaves the old knockback wobble on
// `rotation.z` exactly as it was.

export const STANDEE_MOVE = Object.freeze({
  // ── motion (every style) ──
  style:'hop', stepMs:420, settleMs:260, settleWobble:5, turnMode:'during', turnMs:160, catchUp:0.5,
  glideLift:0.08, glideLean:5, glideOvershoot:0.06,
  hopHeight:0.8, hopTilt:12, hopSquash:0.12, hopAntic:70,
  liftHeight:1.0, liftRise:0.25, liftLower:0.3, liftSwing:6,
  skateLean:12,
  blinkOut:170, blinkGap:80, blinkIn:220,
  // ── Shukuchi (and any leap of 2+ hexes) & being shoved ──
  shukuchiStyle:'blink', shukuchiTime:1.3, shukuchiHeight:1.6, shukuchiDyad:'dyad',
  shoveStyle:'skate', shoveTime:0.7, shoveSound:'clack',
  // ── a move style of each Spirit's own ('main' = the style above) ──
  style_cosmic_ronin:'main', style_Metalness_Monster:'main', style_intergalactic_0:'main', style_Glamarchy:'main',
  // ── the landing light ──
  ripple:'on', rippleSize:1, rippleMs:600, rippleColor:'player', tileFlash:0.55, sparkles:10,
  trail:'off', trailMs:380,
  // ── the landing sound ── ⭐ Alex's five sound levers are here
  voice:'slab', weight:0.45, echo:0.06, echoTime:0.28, ring:1, bright:0.6, sparkleTail:2,
  travelSound:'rumble', takeoff:'off', humanise:6, velJitter:0.15,
  // ── which note rings ── ⭐ and the sixth: one note, every landing
  pitchMode:'fixed', walkShape:'up', walkReset:1200, keyRoot:0, octave:6,
  // ── mix ──
  volume:0.7, botVol:0.55, room:0.3, roomLen:1.8,
});

export const MOVE_STYLES = Object.freeze(['shipped', 'glide', 'hop', 'lift', 'skate', 'blink']);
export const STYLE_LABELS = Object.freeze({
  shipped:'Old straight slide', glide:'Glide', hop:'Hop', lift:'Lift & place', skate:'Skate & lean', blink:'Shimmer blink',
});

/** The pre-2026-09-30 pawn, kept as a style so the preview can compare against it. */
export const SHIPPED_RATE = 14;

const clamp01 = v => Math.max(0, Math.min(1, v));
const easeInOutSine = u => -(Math.cos(Math.PI * u) - 1) / 2;
const easeInOutCubic = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const easeOutCubic = u => 1 - Math.pow(1 - u, 3);
const easeInCubic = u => u * u * u;
const easeInOutQuad = u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const easeOutBack = (u, s = 1.7) => 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2);
const DEG = Math.PI / 180;

/** Shortest signed turn from a to b, in radians. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
const lerpAngle = (a, b, t) => a + angleDelta(a, b) * t;

/** A damped wobble that starts at 0, rises, and dies away (`a` ms after landing). */
const wobble = (a, amp, periodMs, decayMs) =>
  amp * Math.exp(-a / Math.max(1, decayMs)) * Math.sin((a / Math.max(1, periodMs)) * Math.PI * 2);

/**
 * What kind of move the renderer just saw. ⚠️ It only sees the hex number
 * change, so: the knockback counter moved → a shove (whatever the distance);
 * one hex → a walk step; two or more → a leap (Shukuchi is the one that exists
 * today — a warp or a respawn reads the same and blinks, which suits them).
 */
export function stepKind(distance, { shoved = false } = {}) {
  if (shoved) return 'shove';
  return distance >= 2 ? 'shukuchi' : 'walk';
}

/** The style one move uses: the Spirit's own, the main one, or the leap/shove override. */
export function styleFor(id, kind, T = STANDEE_MOVE) {
  const own = T[`style_${id}`];
  const walk = own && own !== 'main' ? own : T.style;
  if (kind === 'shukuchi' && T.shukuchiStyle !== 'same') return T.shukuchiStyle;
  if (kind === 'shove' && T.shoveStyle !== 'same') return T.shoveStyle;
  return walk;
}

/**
 * How long each phase of one step lasts, in ms (already divided by `speed`).
 * `land` is the moment the landing sound fires and the ripple starts.
 *
 * @param step `{ style, kind:'walk'|'shukuchi'|'shove', yaw0, yaw1, speed }`
 */
export function planStep(step, L = STANDEE_MOVE) {
  const speed = Math.max(0.25, step.speed ?? 1);
  if (step.style === 'shipped') {
    // 1 − e^(−14 s) passes 95% at ln 20 / 14 = 214 ms and 99% at 329 ms.
    return { turnMs:0, pre:0, dur:214, settle:186, total:400, land:214, speed:1 };
  }
  const kindScale = step.kind === 'shukuchi' ? L.shukuchiTime : step.kind === 'shove' ? L.shoveTime : 1;
  const turns = step.kind !== 'shove' && Math.abs(angleDelta(step.yaw0, step.yaw1)) > 0.12;
  const turnMs = (L.turnMode === 'first' && turns ? L.turnMs : 0) / speed;
  if (step.style === 'blink') {
    const out = L.blinkOut / speed, gap = L.blinkGap / speed, inn = L.blinkIn / speed;
    const dur = (out + gap + inn) * kindScale;
    return { turnMs:0, pre:0, dur, settle:L.settleMs / speed, total:dur + L.settleMs / speed,
      land:(out + gap) * kindScale, speed, out:out * kindScale, gap:gap * kindScale, inn:inn * kindScale };
  }
  const pre = step.style === 'hop' ? L.hopAntic / speed : 0;
  const dur = (L.stepMs * kindScale) / speed;
  const settle = L.settleMs / speed;
  return { turnMs, pre, dur, settle, total:turnMs + pre + dur + settle, land:turnMs + pre + dur, speed };
}

/**
 * Where the standee is `ms` into a step.
 *
 * Returns `{ p, y, yaw, pitch, roll, sy, sxz, vis, beamOut, beamIn, moving }`:
 * `p` is progress from `from` to `to` (it may pass 1 — an overshoot), `y` is
 * lift above the deck, `pitch`/`roll` are radians of tilt, `sy`/`sxz`
 * squash-and-stretch, `vis` 0…1 how much of the standee exists (the blink),
 * `beamOut`/`beamIn` 0…1 the blink's light column.
 *
 * `lean` is `{ fwd, side }`: how much of the travel is along the Spirit's face
 * and how much is sideways (unit vectors dotted). A shove is travel BACKWARD,
 * so the same lean tips the other way without a special case.
 */
export function stepPose(step, plan, ms, L = STANDEE_MOVE, lean = { fwd:1, side:0 }) {
  const P = { p:0, y:0, yaw:step.yaw0, pitch:0, roll:0, sy:1, sxz:1, vis:1, beamOut:0, beamIn:0, moving:true };
  const tilt = amt => { P.pitch += amt * lean.fwd; P.roll += -amt * lean.side; };
  const yawTo = t => { P.yaw = lerpAngle(step.yaw0, step.yaw1, clamp01(t)); };

  if (step.style === 'shipped') {
    const k = 1 - Math.exp(-SHIPPED_RATE * (ms / 1000));
    P.p = k; yawTo(k); P.moving = ms < plan.total; return P;
  }

  // ── the turn ───────────────────────────────────────────────────────────────
  if (ms < plan.turnMs) { yawTo(easeInOutSine(ms / plan.turnMs)); return P; }
  const t = ms - plan.turnMs;
  const u = clamp01((t - plan.pre) / plan.dur);          // travel, 0…1
  const after = ms - plan.land;                           // ms since landing (<0 before)
  if (L.turnMode === 'during') yawTo(easeInOutSine(clamp01(u * 1.6)));
  else yawTo(1);                                          // 'first' (already turned) and 'snap'
  P.moving = ms < plan.total;
  const big = step.kind === 'shukuchi' ? L.shukuchiHeight : 1;

  switch (step.style) {
    case 'glide': {
      P.p = easeInOutSine(u);
      P.y = L.glideLift * big * Math.min(1, Math.sin(Math.PI * u) * 1.8);
      tilt(L.glideLean * DEG * Math.sin(Math.PI * u));
      if (after > 0) {
        // ⭐ The overshoot happens AFTER the landing sound: the piece arrives,
        // rings, and its momentum carries it a hair past and back.
        P.p = 1 + (L.glideOvershoot / (step.kind === 'shukuchi' ? 2 : 1)) * wobble(after, 1, plan.settle * 1.2, plan.settle * 0.35);
        tilt(wobble(after, L.settleWobble * DEG, plan.settle * 0.8, plan.settle * 0.3));
      }
      break;
    }
    case 'hop': {
      if (t < plan.pre) {                                  // the crouch before the jump
        P.sy = 1 - L.hopSquash * 0.7 * easeOutCubic(t / plan.pre);
      } else if (u < 1) {
        P.p = easeInOutSine(u) * 0.35 + u * 0.65;          // mostly linear, like a thrown piece
        P.y = L.hopHeight * big * 4 * u * (1 - u);
        P.sy = 1 + L.hopSquash * 0.5 * Math.sin(Math.PI * u) * (1 - u);   // stretch off the deck
        tilt(L.hopTilt * DEG * Math.sin(Math.PI * u));
      } else {
        P.p = 1;
      }
      if (after >= 0) {
        const s = L.hopSquash * Math.exp(-after / Math.max(1, plan.settle * 0.3)) * Math.cos((after / Math.max(1, plan.settle * 0.9)) * Math.PI * 2);
        P.sy = 1 - s;
        tilt(wobble(after, L.settleWobble * DEG, plan.settle * 0.8, plan.settle * 0.3));
      }
      P.sxz = 1 + (1 - P.sy) * 0.5;
      break;
    }
    case 'lift': {
      const r = L.liftRise, l = L.liftLower, mid = Math.max(0.05, 1 - r - l);
      const H = L.liftHeight * big;
      if (u < r) { P.p = 0; P.y = H * easeOutCubic(u / r); }
      else if (u < r + mid) {
        const m = (u - r) / mid;
        P.p = easeInOutCubic(m); P.y = H;
        tilt(-L.liftSwing * DEG * Math.sin(Math.PI * 2 * m));   // dangles: lags, then swings on
      } else { P.p = 1; P.y = H * (1 - easeInCubic((u - r - mid) / l)); }
      if (after > 0) tilt(wobble(after, L.settleWobble * DEG * 0.6, plan.settle * 0.8, plan.settle * 0.3));
      break;
    }
    case 'skate': {
      P.p = easeInOutQuad(u);
      tilt(L.skateLean * DEG * Math.sin(Math.PI * u));
      if (after > 0) tilt(wobble(after, L.settleWobble * DEG * 1.4, plan.settle * 0.7, plan.settle * 0.35));
      break;
    }
    case 'blink': {
      const a = t;                                         // no turn phase for a blink
      if (a < plan.out) {
        const k = easeInCubic(a / plan.out);
        P.vis = 1 - k; P.sy = 1 - k * 0.9; P.sxz = 1 - k * 0.55; P.y = k * 0.15 * big;
        P.beamOut = Math.sin(Math.PI * Math.min(1, a / plan.out * 0.9));
        P.yaw = step.yaw0;
      } else if (a < plan.out + plan.gap) {
        P.vis = 0; P.sy = 0.05; P.sxz = 0.3; P.p = 1; P.yaw = step.yaw1;
        P.beamOut = 1 - (a - plan.out) / Math.max(1, plan.gap);
        P.beamIn = (a - plan.out) / Math.max(1, plan.gap);
      } else {
        const k = clamp01((a - plan.out - plan.gap) / plan.inn);
        P.p = 1; P.yaw = step.yaw1;
        P.vis = clamp01(k * 1.3); P.sy = Math.max(0.05, easeOutBack(k, 2.2)); P.sxz = 0.45 + 0.55 * easeOutCubic(k);
        P.beamIn = 1 - k;
      }
      break;
    }
    default: P.p = u;
  }
  return P;
}

/** Reduced motion: the standee is simply there (the sound still plays). */
export function reducedPose(step) {
  return { p:1, y:0, yaw:step.yaw1, pitch:0, roll:0, sy:1, sxz:1, vis:1, beamOut:0, beamIn:0, moving:false };
}

// ── which note rings ─────────────────────────────────────────────────────────
/** A scale degree (may run past the octave either way) as a MIDI note. */
export function degreeMidi(scale, deg, L = STANDEE_MOVE) {
  const n = scale.length, o = Math.floor(deg / n);
  return 12 * (L.octave + 1) + Number(L.keyRoot) + scale[((deg % n) + n) % n] + 12 * o;
}

/**
 * The notes one landing rings, as MIDI numbers.
 *
 * ⭐ SHIPPED: `pitchMode:'fixed'` — every landing rings the root (C6), which on
 * the dialled `slab` voice is a stone body at C3 under a faint C6 in the glass.
 * A leap lands on two notes (root + the Spirit's own third degree).
 *
 * `walk` state (`{ idx, lastAt, lastDeg }`) lives on the caller and is mutated.
 * ⚠️ `'spent'` needs the note the engine spent on the step, which the renderer
 * is not told — it falls back to `'fixed'` here; only the preview fakes a draw.
 *
 * @param o `{ scale, kind, now, walk, hexDeg, dirIdx }`
 */
export function landingNotes({ scale, kind = 'walk', now = 0, walk = null, hexDeg = 0, dirIdx = 0 }, L = STANDEE_MOVE) {
  const n = scale.length;
  let deg = 0;
  if (L.pitchMode === 'walk' && walk) {
    walk.idx = now - (walk.lastAt ?? -Infinity) > L.walkReset ? 0 : (walk.idx ?? -1) + 1;
    const i = walk.idx;
    if (L.walkShape === 'updown') { const k = i % (2 * n); deg = k <= n ? k : 2 * n - k; }
    else if (L.walkShape === 'random') { do deg = Math.floor(Math.random() * n); while (n > 1 && deg === walk.lastDeg); }
    else deg = i;
    walk.lastAt = now; walk.lastDeg = deg;
  } else if (L.pitchMode === 'hex') deg = hexDeg;
  else if (L.pitchMode === 'direction') deg = dirIdx;
  const midis = [degreeMidi(scale, deg, L)];
  if (kind === 'shukuchi' && L.shukuchiDyad === 'dyad') midis.push(degreeMidi(scale, deg + 2, L));
  return { midis, deg };
}
