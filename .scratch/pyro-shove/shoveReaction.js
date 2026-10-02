// ─── 🔥 PYRO SHOVE — what a standee does when it is pushed onto an armed mortar ─
// Alex, 2026-10-02: Astra's study (.scratch/stage-hazards) shows ONE reaction —
// jolt, land, recover — with a strength slider. This is a second opinion, built
// as a full set of levers so the taste calls can be made by eye.
//
// 📌 PURE. No three, no DOM, no clock — like `src/board/standeeMotion.js`. Every
// function takes an absolute time, so pause, scrub and slow playback never
// accumulate state. The preview (`preview.js`) draws it; `blastFx.js` is the fire;
// `blastSfx.js` is the sound.
//
// 📌 THE BEATS, in order (all times are seconds after CONTACT = the instant the
// shoved standee lands on the mortar's hex, which is the shipped shove's own
// `land` moment — so the approach is the game's, untouched):
//
//   0 CONTACT   the trip-plate gives under the weight: a click, a little squash
//   ▸ FUSE      the barrel flares white; the piece is held on it  (fuseMs)
//   ▸ IGNITE    HIT-STOP on the flash frame, then slow motion      (hitStopMs, slowMs)
//   ▸ AIR       thrown up through the blast, tumbling              (airMs)
//   ▸ LAND      squash, dust, acrylic rattle, N diminishing bounces
//   ▸ AFTER     stands / sways dazed / knocked flat / flat then rises
//   ▸ BURN      scorched print + flames licking for burnMs (the "1 Vibe + Burn" stand-in)
//
// ⛔ PREVIEW-ONLY. No damage, no Burn ticks, no knockout is applied anywhere.

export const HEX_PITCH = 1.93;           // world distance between two hex centres

export const PYRO_SHOVE = Object.freeze({
  // ── setup (what is on stage) ──
  who:'cosmic_ronin', facing:'pusher', dir:2, pusher:'on',
  // ── the approach (the game's shove; these only re-time it) ──
  pushStyle:'skate', pushSpeed:1,
  // ── contact ──
  trip:0.10, fuseMs:120, rumble:0.5, hitStopMs:70, slowRate:0.35, slowMs:450,
  // ── the launch ──
  launchH:2.4, airMs:950, hang:0.8, stretch:0.14, blastLean:14,
  drift:'stay', driftHex:1,
  tumble:'flip', turns:1, flipDir:'back', flail:0.6,
  // ── the landing ──
  landSquash:0.22, bounces:2, bounceH:0.16, bounceDecay:0.45, landWobble:7, dust:1,
  // ── afterwards ──
  endState:'dazed', dazeMs:1100, fallMs:380, downMs:900, riseMs:520,
  // ── scorch & burn ──
  char:0.55, charMs:4200, glow:0.8, burnMs:2400, flameSize:1,
  // ── the blast itself ──
  fxSource:'astra', bloom:0.6, flash:1, fireball:1, column:1, shock:1, sparks:1, smoke:0.8, debris:0.6, shell:'on', crown:1, scorchMark:0.6, tileFlash:0.8,
  popups:'on',
  // ── sound ──
  volume:0.7, bass:1, boom:1, tail:1.4, click:'on', crackle:0.6, rattle:0.6, sirenWhine:0.5,
  // ── camera ──
  cam:'arena', shake:0.5, punch:0.5, follow:'on',
  // ── compare with Astra's study ──
  show:'sequence', deployLead:2.3, sympathy:'on', sympGap:0.6, sympStagger:0.2, holdS:3.4, cannonsOn:'on', cannonDelay:0.5, curtainOn:'on', mechVol:1, launchVol:1, flameVol:1, curtainVol:0.8,
  astraStrength:1, astraKnockdown:'off',
});

const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = v => { v = clamp01(v); return v * v * (3 - 2 * v); };
const easeOut = u => 1 - (1 - u) * (1 - u);
const easeInOut = u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
export const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const DEG = Math.PI / 180;

/** Every key time of one reaction, in seconds after contact. */
export function timeline(L) {
  const ti = Math.max(0, L.fuseMs) / 1000;
  const air = Math.max(0.2, L.airMs) / 1000;
  const tl = ti + air;
  // Gravity that makes a launch of `launchH` last `air`: g = 8H/T². A bounce of height h then lasts T·√(h/H).
  const contacts = [{ at:tl, power:1 }], bounces = [];
  let t = tl, h = L.launchH * L.bounceH;
  for (let i = 0; i < Math.round(L.bounces); i++) {
    const d = Math.max(0.09, air * Math.sqrt(h / Math.max(0.01, L.launchH)));
    bounces.push({ start:t, dur:d, h });
    t += d; contacts.push({ at:t, power:Math.pow(L.bounceDecay, i + 1) });
    h *= L.bounceDecay;
  }
  const tb = t;                                     // the last touchdown
  const fall = Math.max(0.05, L.fallMs / 1000);
  const rise = Math.max(0.1, L.riseMs / 1000);
  const tRise = tl + fall + L.downMs / 1000;        // downRise: when it starts to get up
  const tail = L.endState === 'dazed' ? L.dazeMs / 1000
    : L.endState === 'down' ? fall + 0.3
    : L.endState === 'downRise' ? fall + L.downMs / 1000 + rise + 0.3 : 0.5;
  const burnEnd = tl + L.burnMs / 1000;
  return { ti, air, tl, contacts, bounces, tb, fall, rise, tRise, end:Math.max(tb + tail, burnEnd, ti + L.charMs / 1000 * 0.4) + 0.4, burnEnd };
}

/** How fast the show runs `age` s after contact: 1 normally, slower through the blast. */
export function timeRate(age, L) {
  const ti = L.fuseMs / 1000, s = L.slowMs / 1000, a = age - ti;
  if (s <= 0 || L.slowRate >= 1 || a < 0 || a > s) return 1;
  const k = a / s;                                   // hold the slow rate, ramp back out over the last 45%
  return L.slowRate + (1 - L.slowRate) * smooth((k - 0.55) / 0.45);
}

/**
 * The reaction `age` s after contact (age ≤ 0 → untouched).
 * `x`/`z` are world offsets from the mortar hex along the push direction `dir` (unit x,z).
 * `pitch` is a tilt toward the print, `roll` sideways, `yaw` extra spin — as `standeeMotion`.
 */
export function reactionAt(age, L, { dir = { x:1, z:0 }, reduced = false } = {}) {
  const T = timeline(L);
  const o = { x:0, z:0, y:0, pitch:0, roll:0, yaw:0, sy:1, sxz:1, ko:0, heat:0, char:0, burn:0, plate:0,
    phase:'approach', airU:0, landed:false, ignited:false, since:{ ignite:-1, land:-1 } };
  if (age <= 0) return o;
  const a = age - T.ti;
  const sign = L.drift === 'back' ? -1 : L.drift === 'onward' ? 1 : 0;
  const dist = sign * L.driftHex * HEX_PITCH;
  const place = p => { o.x = dir.x * dist * p; o.z = dir.z * dist * p; };

  // ── FUSE: held on the plate ────────────────────────────────────────────────
  if (a < 0) {
    o.phase = 'fuse';
    o.plate = T.ti > 0 ? smooth(age / Math.min(0.08, T.ti)) : 1;
    o.sy = 1 - L.trip * o.plate; o.sxz = 1 + (1 - o.sy) * 0.5;
    if (!reduced) o.roll = L.rumble * 0.03 * Math.sin(age * 120) * o.plate;
    o.heat = clamp01(age / Math.max(0.05, T.ti)) * 0.8;
    return o;
  }

  // ── from here the barrel has fired ─────────────────────────────────────────
  o.ignited = true; o.plate = 1; o.since.ignite = a;
  o.heat = L.glow * Math.exp(-a / 0.9);
  o.burn = age < T.tl ? 1 : clamp01(1 - (age - T.tl) / Math.max(0.1, L.burnMs / 1000));
  o.char = L.char * smooth(a / 0.14) * (1 - smooth((a - 0.5) / Math.max(0.5, L.charMs / 1000)));

  if (reduced) {                                    // the piece stays put; the flash and the sound carry it
    o.phase = age < T.tl ? 'air' : 'recover'; o.landed = age >= T.tl; place(age >= T.tl ? 1 : 0);
    if (L.endState === 'down') o.ko = smooth((age - T.tl) / T.fall);
    if (L.endState === 'downRise') o.ko = smooth((age - T.tl) / T.fall) * (1 - smooth((age - T.tRise) / T.rise));
    return o;
  }

  if (age < T.tl) {                                 // ── AIR ──
    const u = clamp01(a / T.air); o.airU = u; o.phase = 'air';
    o.y = L.launchH * Math.pow(4 * u * (1 - u), L.hang);
    place(1 - Math.pow(1 - u, 1.8));
    o.sy = 1 + L.stretch * Math.sin(Math.PI * u) * (1 - u) + L.stretch * 0.9 * Math.exp(-a * 16);
    o.sxz = 1 - (o.sy - 1) * 0.4;
    o.pitch = -L.blastLean * DEG * Math.sin(Math.PI * u);
    const turns = Math.round(L.turns), e = 1 - Math.pow(1 - u, 2.1), dirSign = L.flipDir === 'back' ? -1 : 1;
    if (L.tumble === 'flip') o.pitch += dirSign * Math.PI * 2 * turns * e;
    else if (L.tumble === 'cartwheel') o.roll += Math.PI * 2 * turns * e;
    else if (L.tumble === 'spin') o.yaw += Math.PI * 2 * turns * e;
    else if (L.tumble === 'flail') {
      const f = L.flail * Math.sin(Math.PI * u);
      o.pitch += f * (0.9 * Math.sin(a * 17 + 1) + 0.5 * Math.sin(a * 29));
      o.roll += f * (0.8 * Math.sin(a * 13 + 2) + 0.4 * Math.sin(a * 23));
      o.yaw += f * 0.6 * Math.sin(a * 9);
    }
    return o;
  }

  // ── LAND (+ bounces) ───────────────────────────────────────────────────────
  o.landed = true; place(1); o.since.land = age - T.tl;
  o.phase = age < T.tb ? 'bounce' : 'recover';
  // bounce arcs: contacts[i] → contacts[i+1]
  for (const b of T.bounces) if (age >= b.start && age < b.start + b.dur) {
    const v = (age - b.start) / b.dur; o.y = b.h * 4 * v * (1 - v);
  }
  // a damped squash at every touchdown, weaker for each bounce
  let squash = 0;
  for (const c of T.contacts) {
    const d = age - c.at; if (d < 0) continue;
    squash += L.landSquash * c.power * Math.exp(-d / 0.1) * Math.cos(d * 26);
  }
  o.sy = 1 - squash; o.sxz = 1 + squash * 0.5;
  const d = age - T.tb;
  if (d > 0) {
    const w = L.landWobble * DEG * Math.exp(-d / 0.45);
    o.roll += w * Math.sin(d * 21); o.pitch += w * 0.7 * Math.sin(d * 17 + 1);
  }

  // ── AFTER ──────────────────────────────────────────────────────────────────
  const since = age - T.tl;
  if (L.endState === 'dazed' && d > 0 && L.dazeMs > 0) {
    const dec = Math.exp(-d / (L.dazeMs / 1000 / 2.6));
    o.roll += 7 * DEG * Math.sin(d * 5.2) * dec; o.yaw += 14 * DEG * Math.sin(d * 3.1 + 0.6) * dec; o.pitch += 3 * DEG * Math.sin(d * 4.4) * dec;
  } else if (L.endState === 'down') {
    o.ko = smooth(since / T.fall);
  } else if (L.endState === 'downRise') {
    o.ko = smooth(since / T.fall) * (1 - smooth((age - T.tRise) / T.rise));
    const g = age - T.tRise - T.rise;
    if (g > 0) { const s = 0.1 * Math.exp(-g / 0.1) * Math.cos(g * 24); o.sy -= s; o.sxz += s * 0.5; }
  }
  if (o.ko > 0) { o.pitch *= 1 - o.ko; o.roll *= 1 - o.ko; o.sy = 1 - (1 - o.sy) * (1 - o.ko); o.sxz = 1 + (o.sxz - 1) * (1 - o.ko); }
  return o;
}

/** The sound cues of one run, as `{ at, type, ... }` in seconds after contact. */
export function cues(L) {
  const T = timeline(L), out = [];
  if (L.click === 'on') out.push({ at:0, type:'plate' });
  if (L.sirenWhine > 0 && T.ti > 0.04) out.push({ at:0.02, type:'whine', dur:T.ti - 0.02 });
  out.push({ at:T.ti, type:'boom' });
  if (L.crackle > 0) out.push({ at:T.ti + 0.05, type:'crackle' });
  if (L.shell === 'on') { out.push({ at:T.ti + 0.12, type:'shell' }); out.push({ at:T.ti + 1.15, type:'crown' }); }
  T.contacts.forEach((c, i) => out.push({ at:c.at, type:i === 0 ? 'land' : 'bounce', power:c.power }));
  if (L.burnMs > 0) out.push({ at:T.ti + 0.3, type:'burn', dur:(L.burnMs / 1000) * 0.9 + T.air });
  return out.sort((x, y) => x.at - y.at);
}

/** Camera shake in world units, `age` s after contact. Deterministic: a hash of time, not a random draw. */
export function shakeAt(age, L) {
  const T = timeline(L), a = age - T.ti;
  let amp = 0;
  if (age > 0 && age < T.ti) amp += 0.015 * L.rumble;
  if (a >= 0) amp += Math.exp(-a * 6.5) * 0.55 + (age >= T.tl ? Math.exp(-(age - T.tl) * 10) * 0.18 : 0);
  amp *= L.shake;
  const k = Math.floor(age * 60);
  return { x:(hash(k) - 0.5) * 2 * amp, y:(hash(k + 91) - 0.5) * 2 * amp, amp };
}
