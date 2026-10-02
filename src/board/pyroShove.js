// ─── 🔥 PYRO SHOVE — what a standee does when it is shoved onto an armed mortar ─
// Ported 2026-10-02 from `.scratch/pyro-shove/shoveReaction.js` (the preview
// now imports THIS file — one copy, like `standeeMotion.js`). Alex's dial-in is
// in `PYRO_SHOVE` below: 10 levers moved, everything else the preview default.
//
// 📌 PURE. No three, no DOM, no clock — like `standeeMotion.js`. Every function
// takes an absolute time, so pause, scrub and slow playback never accumulate
// state. `pyroStage.js` draws it on the arena; `pyroMortars.js` is Astra's
// mortar; `audio/pyroSfx.js` is the sound.
//
// 📌 THE BEATS, in order (all times are seconds after CONTACT = the instant the
// shoved standee lands on the mortar's hex, which is the shipped shove's own
// `land` moment — so the approach is the game's, untouched):
//
//   0 CONTACT   the trip-plate gives under the weight: a click, a little squash
//   ▸ FUSE      the barrel flares white; the piece is held on it  (fuseMs)
//   ▸ IGNITE    HIT-STOP on the flash frame, then slow motion      (hitStopMs, slowMs)
//   ▸ AIR       thrown up through the blast, spinning              (airMs)
//   ▸ LAND      squash, dust, acrylic rattle, N diminishing bounces — back ON the mortar
//   ▸ AFTER     sways, dazed (stands / knocked flat / flat then rises are the other end states)
//   ▸ BURN      scorched print + flames licking for burnMs
//
// ⭐ THE RULE IS THE ENGINE'S (pyro v2, `data/stageEffects.js`): a shove STOPS on
// an armed mortar and the hit is PYRO_DAMAGE Vibe + Burn. This file is only the
// look of it. ⚠️ The scorch and the licking flames are a DISPLAY-ONLY stand-in
// for the Burn status — what Burn does is `BURN_TICKED`'s, not this file's.
//
// ⁉️ THREE CALLS SHIPPED AT THE DEFAULT, NOT DECIDED (Alex's to make):
//   · the end state — `endState:'dazed'`
//   · hit-stop on EVERY mortar hit, not only a knockout — `hitStopMs:70`
//   · the shell and the aerial burst in a hit — `shell:'on'`

export const HEX_PITCH = 1.93;           // world distance between two hex centres

// ⭐ ALEX'S DIAL-IN (2026-10-02, `.scratch/pyro-shove`), the ✎ lines: slowRate
// 0.45, launchH 3, airMs 1100, tumble 'spin', crown 1.55, bass 1.7, boom 1.65,
// tail 2, shake 0.3, punch 0.2. Every other value is the preview's default.
// 📌 Some keys only mean something on the preview page (who / facing / dir /
// pusher / pushStyle / cam / follow / show / the compare pair) — they stay so
// the page's levers keep lever-for-lever parity with this object.
export const PYRO_SHOVE = Object.freeze({
  // ── setup (what is on stage) ──
  who:'cosmic_ronin', facing:'pusher', dir:2, pusher:'on',
  // ── the approach (the game's shove; these only re-time it) ──
  pushStyle:'skate', pushSpeed:1,
  // ── contact ──
  trip:0.10, fuseMs:120, rumble:0.5, hitStopMs:70, slowRate:0.45, slowMs:450,   // ✎ slowRate (Alex)
  // ── the launch ──
  launchH:3, airMs:1100, hang:0.8, stretch:0.14, blastLean:14,   // ✎ launchH, airMs (Alex)
  drift:'stay', driftHex:1,
  tumble:'spin', turns:1, flipDir:'back', flail:0.6,   // ✎ tumble (Alex)
  // ── the landing ──
  landSquash:0.22, bounces:2, bounceH:0.16, bounceDecay:0.45, landWobble:7, dust:1,
  // ── afterwards ──
  endState:'dazed', dazeMs:1100, fallMs:380, downMs:900, riseMs:520,
  // ── scorch & burn ──
  char:0.55, charMs:4200, glow:0.8, burnMs:2400, flameSize:1,
  // ── the blast itself ──
  fxSource:'astra', bloom:0.6, flash:1, fireball:1, column:1, shock:1, sparks:1, smoke:0.8, debris:0.6, shell:'on', crown:1.55, scorchMark:0.6, tileFlash:0.8,   // ✎ crown (Alex)
  popups:'on',
  // ── sound ──
  volume:0.7, bass:1.7, boom:1.65, tail:2, click:'on', crackle:0.6, rattle:0.6, sirenWhine:0.5,   // ✎ bass, boom, tail (Alex)
  // ── camera ──
  cam:'arena', shake:0.3, punch:0.2, follow:'on',   // ✎ shake, punch (Alex)
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
  // ⚠️ THE CROWN IS HEARD WHEN IT IS SEEN. The preview played it 1.15 s after
  // the bang — when ITS OWN shell burst — but the shipped fire is Astra's
  // (`fxSource:'astra'`), whose shell bursts SHELL_FLIGHT (1.5 s) after
  // ignition, so the sound arrived a third of a second early. Fixed in the port.
  if (L.shell === 'on') { out.push({ at:T.ti + 0.12, type:'shell' }); out.push({ at:T.ti + (L.fxSource === 'astra' ? SHELL_FLIGHT : 1.15), type:'crown' }); }
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

// ═════════════════════════════════════════════════════════════════════════════
// ⏱️ THE SHOW CLOCK — hit-stop and slow motion, as a mapping
// The preview advanced one scene clock at `timeRate` and HELD it for hitStopMs
// on the flash frame. The game cannot slow the whole arena, so the reaction
// runs on its own clock: `ageAt(real)` is the reaction's age `real` seconds
// after contact, `realAt(age)` the inverse. Everything the hit draws or plays
// (the standee, the struck mortar, the blast, the cues) reads THIS clock, so
// they freeze and crawl together exactly as on the page.
// ♿ Reduced motion: no hit-stop (the preview's own rule); the slow-down stays.
// ═════════════════════════════════════════════════════════════════════════════
const CLOCK_DT = 0.001;
export function makeShowClock(L, { reduced = false } = {}) {
  const ti = Math.max(0, L.fuseMs) / 1000, hold = reduced ? 0 : Math.max(0, L.hitStopMs) / 1000;
  const until = ti + Math.max(0, L.slowMs) / 1000 + 0.05;      // past here the rate is 1
  const table = [0];                                            // age at real = k·dt
  let age = 0, real = 0, held = 0;
  while (age < until) {
    if (age >= ti && held < hold) { held += CLOCK_DT; }           // ❄ the hit-stop
    else { age = Math.min(age + CLOCK_DT * timeRate(age, L), age < ti ? Math.min(ti, age + CLOCK_DT) : Infinity); }
    real += CLOCK_DT; table.push(age);
  }
  const tableReal = real, tableAge = age;
  const ageAt = r => {
    if (r <= 0) return r;                                       // before contact: real time
    if (r >= tableReal) return tableAge + (r - tableReal);
    const k = r / CLOCK_DT, i = Math.floor(k), f = k - i;
    return table[i] + (table[Math.min(i + 1, table.length - 1)] - table[i]) * f;
  };
  const realAt = a => {
    if (a <= 0) return a;
    if (a >= tableAge) return tableReal + (a - tableAge);
    let lo = 0, hi = table.length - 1;                          // first index whose age ≥ a
    while (lo < hi) { const mid = (lo + hi) >> 1; if (table[mid] < a) lo = mid + 1; else hi = mid; }
    return lo * CLOCK_DT;
  };
  return { ageAt, realAt, lag:tableReal - tableAge, hold };
}

// ═════════════════════════════════════════════════════════════════════════════
// 🎆 THE SHOW TIMELINE — the mortars' machinery and the volley, as sound cues
// Ported from the preview's `seqTimes` / `seqCues` / `pyroCue`. The preview staged
// ONE show around a shove; the game's show is the engine's (pyro v2): a set ARMS
// (deploy), FIRES at END TURN (the volley), and RETRACTS `holdS` after its last
// mortar. These build each piece; the preview composes them into its sequence.
// Cue times are absolute seconds; `pan` is the stereo lane.
// ═════════════════════════════════════════════════════════════════════════════
// ⚠️ Astra's times, mirrored here because this file must stay free of three.js;
// `pyroShoveCheck` asserts they equal `pyroMortars.js` MORTAR_TIMING.
export const SHELL_FLIGHT = 1.5;                 // s, ignition → the aerial burst
export const MORTAR_SOUND_MARKS = Object.freeze({
  deploy: { unlock:0.02, lift:0.38, lock:1.86 },
  retract: { release:0.02, retract:0.08, seal:1.3 },
});
export const SHOW_PANS = Object.freeze([0, -0.7, 0.7, 0.35]);
// 📌 The preview staged FOUR mortars, so its machinery was four voices. A wave
// can be 13 here; the machinery stays at four voices (a choir of thirteen
// latches is mud), panned like the page's.
export const MECH_VOICES = SHOW_PANS.length;

/** The deploy machinery (unlock → lift → lock) for a set rising at `deployedAt`. */
export function deployCues(deployedAt, n, L = PYRO_SHOVE) {
  const out = [], M = MORTAR_SOUND_MARKS.deploy;
  for (let i = 0; i < Math.min(n, MECH_VOICES); i++) {
    const pan = SHOW_PANS[i], d = deployedAt + i * 0.05;
    out.push({ at:d + M.unlock, type:'unlock', pan, lv:L.mechVol * 0.7 }, { at:d + M.lift, type:'lift', pan, lv:L.mechVol * 0.6 }, { at:d + M.lock, type:'lock', pan, lv:L.mechVol * 0.7 });
  }
  return out;
}
/** The retract machinery (release → retract → seal) for a set folding away at `endAt`. */
export function retractCues(endAt, n, L = PYRO_SHOVE) {
  const out = [], M = MORTAR_SOUND_MARKS.retract;
  for (let i = 0; i < Math.min(n, MECH_VOICES); i++) {
    const pan = SHOW_PANS[i], e = endAt + i * 0.05;
    out.push({ at:e + M.release, type:'release', pan, lv:L.mechVol * 0.7 }, { at:e + M.retract, type:'retract', pan, lv:L.mechVol * 0.6 }, { at:e + M.seal, type:'seal', pan, lv:L.mechVol * 0.7 });
  }
  return out;
}
/**
 * The END TURN volley: mortar i fires at `t0 + i·sympStagger` — the preview's
 * "stagger between them", which is what a rolling salvo of N mortars needs.
 * `Infinity` in `already` (a struck mortar's slot) keeps its own earlier bang.
 */
export function volleyTimes(t0, n, L = PYRO_SHOVE, already = []) {
  let k = 0;
  return Array.from({ length:n }, (_, i) => (Number.isFinite(already[i]) ? already[i] : t0 + (k++) * L.sympStagger));
}
/**
 * Each fired mortar's launch and its burst. Past four, the voices share the
 * level (√(4/n)) so a 13-mortar volley is a salvo, not a wall.
 */
export function volleyCues(fireAt, L = PYRO_SHOVE, { skip = [] } = {}) {
  const live = fireAt.map((f, i) => [f, i]).filter(([f, i]) => Number.isFinite(f) && !skip.includes(i));
  const share = Math.sqrt(Math.min(1, MECH_VOICES / Math.max(1, live.length)));
  const out = [];
  for (const [f, i] of live) {
    const pan = SHOW_PANS[i % SHOW_PANS.length];
    out.push({ at:f, type:'launch', pan, lv:L.launchVol * share }, { at:f + SHELL_FLIGHT, type:'burst', pan, lv:0.7 * L.launchVol * share });
  }
  return out;
}
/** When a set that fired at `fireAt` folds away: `holdS` after its last mortar. */
export function retractAt(fireAt, L = PYRO_SHOVE) {
  const fired = fireAt.filter(Number.isFinite);
  return fired.length ? Math.max(...fired) + L.holdS : Infinity;
}
