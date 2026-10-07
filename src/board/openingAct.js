// ─── THE OPENING ACT — timeline and geometry (presentation only) ─────────────
// The Bardbarian, a colossal spectral outline in the storm, introduces the
// Spirits; each crashes onto its WAITING PAD between its grandstand and its home
// hex; on its own first turn it plays its picker riff and steps on (Alex,
// 2026-10-04, dial-in `previews/bardbarian-intro/alex-dial-in.json`).
//
// ⭐ THE RULE IS NOT HERE. Who is waiting, when they enter and the two fans are
// `engine/systems/entrance.js`. This file only answers "where is the pad" and
// "what should be on screen at time t" — pure, so the client (sound, input
// lock) and the arena (pawns, storm, camera) read one clock.
//
// 📌 ALEX'S DIAL-IN IS IMPORTED, NOT COPIED. `alex-dial-in.json` is his exact
// export and stays the one record (the preview's `timeline.js` reads the same
// file). Retune in the preview, export, replace the file — the game follows.
//
// 📌 The formulas mirror the preview's `timeline.js` (landing 4.2 s + stagger
// per seat, intro end 2.8 s after the last landing, the step = sting + 0.85 s)
// and `entranceCheck`'s presentation half pins them to it, so the two cannot
// drift apart silently.

import { grandstandPlacement } from './cosmicFans.js';
import { CORNERS } from '../data/corners.js';
import { HEX_BY_NUM } from './hexMap.js';
import { stingDuration } from '../audio/spiritSting.js';
import { characterId } from '../data/spiritIdentity.js';
import alexDialIn from '../../previews/bardbarian-intro/alex-dial-in.json' with { type: 'json' };

/** Alex's selected look. `players` and `reduced` are preview controls: the
 *  match supplies its own seats, and the viewer's OS supplies reduced motion. */
export const OPENING_ACT = Object.freeze({ ...alexDialIn.settings });

// ── Timing (seconds from the moment the arena is on screen) ──────────────────
export const THUNDER_AT = 1.2;
export const FIRST_LANDING = 4.2;
export const FALL_LEAD = .8;      // a standee is visible this long before it lands
export const AFTER_LAST = 2.8;    // the last landing settles before seat one's riff
export const STEP_SECONDS = .85;  // the hop from the pad onto the home hex
// 🔊 A ring-out flies off the stage, then is beamed down onto its pad this long after.
export const RING_OUT_BEAM_MS = 1800;
export const smooth = n => { const p = Math.max(0, Math.min(1, n)); return p * p * (3 - 2 * p); };
export const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

export const landingTime = (i, s = OPENING_ACT) => FIRST_LANDING + i * s.stagger;
export const introEnd = (seats, s = OPENING_ACT) => landingTime(Math.max(0, seats - 1), s) + AFTER_LAST;
/** Seconds of a Spirit's picker riff — the entrance waits for it to finish. */
export const riffSeconds = id => stingDuration(characterId(id)) / 1000;

/**
 * The whole intro for a table, as wall-clock milliseconds from `startMs`.
 * Every seat lands on its pad; seat ONE (already entered in the engine) plays
 * its riff and steps at the intro's end. Later seats get their `riffAt` when
 * their own first turn begins (`entranceAt`).
 */
export function openingSchedule(seats, startMs, s = OPENING_ACT) {
  const end = introEnd(seats.length, s);
  const out = { startMs, endMs: startMs + end * 1000, thunderAt: startMs + THUNDER_AT * 1000, seats: {} };
  seats.forEach((seat, i) => {
    out.seats[seat.id] = { corner: seat.corner, landingAt: startMs + landingTime(i, s) * 1000,
      ...(i === 0 ? entranceAt(seat.id, out.endMs) : {}) };
  });
  return out;
}

/** A first turn's entrance, starting at `nowMs`: riff, then the step. */
export function entranceAt(id, nowMs) {
  const stepAt = nowMs + riffSeconds(id) * 1000;
  return { riffAt: nowMs, stepAt, doneAt: stepAt + STEP_SECONDS * 1000 };
}

/** When the intro (including seat one's entrance) is fully over. */
export const openingDoneAt = sched => Math.max(sched.endMs,
  ...Object.values(sched.seats).map(s => s.doneAt ?? 0));

/**
 * One seat at `now` (ms): where its standee is between pad and home, how far it
 * is still falling, and whether its two fans are on show yet.
 * `progress` 0 = on the pad, 1 = on the home hex.
 */
export function seatPose(seat, now, { reduced = false, waiting = false, s = OPENING_ACT } = {}) {
  const landing = seat?.landingAt ?? -Infinity;
  const visible = now >= landing - FALL_LEAD * 1000;
  const fallT = clamp((now - landing + FALL_LEAD * 1000) / (FALL_LEAD * 1000));
  const fall = reduced ? 0 : Math.pow(1 - fallT, 2) * s.fallHeight;
  const impactAge = (now - landing) / 1000;
  let progress = waiting ? 0 : 1, phase = waiting ? 'waiting' : 'on stage';
  if (!waiting && seat?.riffAt != null) {
    if (now < seat.riffAt) { progress = 0; phase = 'waiting'; }
    else if (now < seat.stepAt) { progress = 0; phase = 'riff'; }
    else if (now < seat.doneAt) { progress = smooth((now - seat.stepAt) / (STEP_SECONDS * 1000)); phase = 'step'; }
  }
  return { visible, fall, impactAge, progress, phase, fansShown: progress >= 1 };
}

// ── Geometry (arena units, the same space as `arenaPoint`) ───────────────────
const hexPoint = (num, y = .2) => { const h = HEX_BY_NUM[num]; return h ? { x: (h.px - 3255) / 200, y, z: (h.py - 2415) / 200 } : null; };
export const homeNumFor = corner => CORNERS[corner]?.homeNum ?? null;
/** The waiting pad: 47% of the way from the home hex to the grandstand (the
 *  preview's placement, which Alex dialled in against the real arena). */
export function padPoint(corner, y = .22) {
  const home = hexPoint(homeNumFor(corner));
  if (!home) return null;
  const stand = grandstandPlacement(corner).position;
  return { x: home.x + (stand.x - home.x) * .47, y, z: home.z + (stand.z - home.z) * .47 };
}
export const homePoint = (corner, y = .2) => hexPoint(homeNumFor(corner), y);
