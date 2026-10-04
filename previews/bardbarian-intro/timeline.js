// Presentation study, deliberately separate from the live match reducer.
// An entrance is one transaction: riff, step, THEN two fans. Seeking is pure.
import { stingDuration } from '../../src/audio/spiritSting.js';
import alexDialIn from './alex-dial-in.json' with { type: 'json' };

// Alex's pasted 2026-10-04 export is the saved baseline, not browser storage.
// Keep its original defaults/changedFromDefault as provenance; only settings
// drives the scene. A single import prevents the handoff and preview drifting.
export const DEFAULTS = Object.freeze({ ...alexDialIn.settings });
export const LIMITS = Object.freeze({ players: [2, 4], godScale: [.65, 1.35], presence: [.15, 1], detail: [.25, .85],
  storm: [0, 1.5], stagger: [.55, 1.8], fallHeight: [8, 30], impact: [.2, 1.7],
  shake: [0, 1], bloom: [0, 1.3], exposure: [.7, 1.8] });
export const CHARACTERS = ['cosmic_ronin', 'Metalness_Monster', 'intergalactic_0', 'cosmic_ronin'];
export const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
export const smooth = n => { const p = clamp(n); return p * p * (3 - 2 * p); };
export function normalizeSettings(input = {}) {
  const s = { ...DEFAULTS };
  for (const [key, [lo, hi]] of Object.entries(LIMITS)) {
    const n = Number(input[key]); if (Number.isFinite(n)) s[key] = clamp(n, lo, hi);
  }
  s.players = Math.round(s.players);
  s.camera = ['cinematic', 'wide', 'board'].includes(input.camera) ? input.camera : DEFAULTS.camera;
  s.reduced = input.reduced === true;
  return s;
}
export const landingTime = (i, s) => 4.2 + i * s.stagger;
export const introEnd = s => landingTime(s.players - 1, s) + 2.8;
export const entranceDuration = id => stingDuration(id) / 1000 + .85;
export function turnStart(i, s) {
  let t = introEnd(s);
  for (let seat = 0; seat < i; seat++) t += entranceDuration(CHARACTERS[seat]) + 1.2;
  return t;
}
export const duration = s => turnStart(s.players - 1, s) + entranceDuration(CHARACTERS[s.players - 1]) + 2;
export function seatState(i, t, s) {
  const landing = landingTime(i, s), start = turnStart(i, s);
  const stepStart = start + stingDuration(CHARACTERS[i]) / 1000;
  const progress = smooth((t - stepStart) / .85);
  const entered = t >= stepStart + .85;
  return { visible: t >= landing - .8, landing, start, stepStart, progress, entered,
    fans: entered ? 2 : 0, targetable: entered, // Off-board seats cannot be attacked.
    phase: entered ? 'On stage' : t >= stepStart ? 'Stepping in' : t >= start ? 'Playing entrance riff' : 'Waiting off-board',
    fall: s.reduced ? 0 : Math.pow(1 - clamp((t - landing + .8) / .8), 2) * s.fallHeight,
    impactAge: t - landing };
}
export function cues(s) {
  return [
    { at: 1.2, kind: 'thunder', seat: -1 },
    ...Array.from({ length: s.players }, (_, i) => [
      { at: landingTime(i, s), kind: 'crash', seat: i },
      { at: turnStart(i, s), kind: 'riff', seat: i },
      { at: turnStart(i, s) + entranceDuration(CHARACTERS[i]), kind: 'step', seat: i },
    ]).flat(),
  ].sort((a, b) => a.at - b.at);
}
export const crossedCues = (from, to, s) => to <= from ? [] : cues(s).filter(c => c.at > from && c.at <= to);
