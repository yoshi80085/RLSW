// ── ⏱️ THE DIAL TICK — how Drive and Sustain travel to a new value ───────────
//
// When something moves Drive or Sustain, `ArenaDial` no longer jumps: it waits
// a beat, then steps ONE BLOCK AT A TIME to the new value, flashing each block
// white as it is gained or red as it is lost. IDEAS_INBOX [P1] 2026-09-08 —
// Alex: *"show the dials slowly ticking up/down with any action affecting them."*
//
// ⭐ THE NUMBERS ARE ALEX'S DIAL-IN, 2026-09-16, off
// `.scratch/drive-sustain-dial-tick.html`. ⚠️ **He returned the dial-in with
// ALL SIXTEEN LEVERS UNTOUCHED** — so these are the page's defaults, approved
// as they stood, not values he moved to. If one of them ever reads wrong, it was
// a first guess he accepted, not a number he chose; re-open the page before
// assuming it is load-bearing.
//
// The levers that are not numbers landed as behaviour, not constants:
//   rhythm EVEN · the number COUNTS WITH the blocks · glow pulse EVERY TICK ·
//   gained block flashes WHITE · lost block flashes RED · no +N/−N tag ·
//   Drive and Sustain tick TOGETHER · a turn handoff SNAPS.
//
// 📌 Pure and React-free on purpose, so `dialTickCheck.mjs` runs in plain node
// with no esbuild step — the hook that drives the timers lives in ArenaDial.jsx
// and is only glue around these three functions.

export const DIAL_TICK = Object.freeze({
  delayMs: 120,       // a beat so the eye finds the dial before it moves
  stepMs: 160,        // one block
  maxTotalMs: 1100,   // ⚠️ a big jump speeds up to fit — 0→10 must never drag
  fadeMs: 90,         // each block's own fade in/out
  flarePeak: 0.46,    // the bloom's peak on every tick — the value that shipped
  flareMs: 256,       // bloom decay per tick (the page's stepMs × 1.6, capped 300)
  gainFlashMs: 280,   // white flash on a gained block
  lossFlashMs: 340,   // red flash on a lost block
});

/** ms between blocks for a run with `remaining` blocks left to travel. EVEN
 *  rhythm: every step the same, shortened only when the cap demands it. */
export function dialTickInterval(remaining, t = DIAL_TICK) {
  return Math.min(t.stepMs, t.maxTotalMs / Math.max(1, Math.abs(remaining)));
}

/** One step from `shown` toward `target`. Whole blocks; the last step lands
 *  EXACTLY on target, so a fractional value is reached rather than overshot. */
export function dialTickStep(shown, target) {
  const d = target - shown;
  return Math.abs(d) <= 1 ? target : shown + Math.sign(d);
}

/** Which block changed between two values, and which way. `index` is the block
 *  that lit (gain) or went dark (loss); null when the lit count did not move. */
export function dialTickFlash(prev, next) {
  const a = Math.ceil(prev), b = Math.ceil(next);
  if (a === b) return null;
  return b > a ? { index: b - 1, dir: 1 } : { index: b, dir: -1 };
}

/** The whole uninterrupted run as [{ atMs, value }] — the timeline the hook
 *  plays. Used by the check; the hook schedules the same steps one at a time. */
export function dialTickSchedule(from, to, t = DIAL_TICK) {
  const out = [];
  if (from === to) return out;
  const every = dialTickInterval(to - from, t);
  let v = from, at = t.delayMs;
  while (v !== to) { v = dialTickStep(v, to); out.push({ atMs: at, value: v }); at += every; }
  return out;
}
