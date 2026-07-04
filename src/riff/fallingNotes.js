// =============================================================================
// riff/fallingNotes.js — 🎸 FALLING-NOTES RIFF-OFF — timing, difficulty, judging
// -----------------------------------------------------------------------------
// The riff-off plays like Guitar Hero / Synthesia: every note of the riff is
// visible at once, falling down a highway toward the strike line at the
// instrument (piano keys / guitar strings). The player presses the note's
// letter key (Shift = sharp) as the gem CROSSES the line — the grade is the
// distance between the press and the note's scheduled hit-time, early or late.
//
// This module is PURE — no React, no audio, no app state. The engine in the
// main file (`RIFF-OFF ENGINE` banner) and the highway UI (`ui/RiffHighway.jsx`)
// both build on these numbers, so tuning lives here.
// =============================================================================

// ── Difficulty presets ───────────────────────────────────────────────────────
// leadTime — ms a gem spends falling from spawn to the strike line (look-ahead).
// perfect/good/ok — |press − hitTime| grade thresholds in ms. Outside ±ok the
// press doesn't reach the note at all; an un-hit note becomes a MISS at +ok.
// Players are reading real notes (finding the key, not just a lane), so even
// SHREDDER stays gentler than an arcade rhythm game.
export const RIFF_FALL_DIFFICULTY = {
  rookie:   { label: 'ROOKIE',   icon: '🎸', leadTime: 2500, perfect: 150, good: 320, ok: 520,
              blurb: 'slow fall, wide windows — learn the keys' },
  gigging:  { label: 'GIGGING',  icon: '🔥', leadTime: 2000, perfect: 120, good: 250, ok: 420,
              blurb: 'working musician tempo' },
  shredder: { label: 'SHREDDER', icon: '⚡', leadTime: 1500, perfect: 90,  good: 190, ok: 340,
              blurb: 'fast drop, tight groove' },
};
export const RIFF_FALL_DEFAULT = 'rookie';

// ── Note spacing ─────────────────────────────────────────────────────────────
// Time between consecutive hit-times = the rhythm's gapBefore (the GROOVE —
// rushed notes crowd in, rests hold their breath) + a base beat. Round 2 rhythm
// gaps arrive pre-tightened by speedUpRiffRhythm; the base tightens with them.
export const RIFF_SPACING_BASE    = 560;   // ms added to every gapBefore
export const RIFF_SPACING_BASE_R2 = 420;   // round 2 — the riff comes at you harder
const GAP_FALLBACK = 470;                  // matches RIFF_GAP_NORMAL in the main file

// A rushed note tightens its grade windows — the groove demands you catch it
// sharp. (It also visually crowds its neighbor via its short gapBefore.)
export const RIFF_RUSHED_TIGHTEN = 0.8;
// An E-Rush GHOST note demands two presses in one window — give it more room.
export const RIFF_GHOST_WINDOW_MULT = 1.5;

// ── Timeline ─────────────────────────────────────────────────────────────────
// rhythm → [{ hitAt, feel }] where hitAt is ms after the run starts (t0).
// The first gem needs a full fall, so hitAt[0] = leadTime: the run starts the
// instant the countdown ends and the first gem spawns at the top of the highway.
export function buildRiffTimeline(rhythm, round, leadTime) {
  const base = round >= 2 ? RIFF_SPACING_BASE_R2 : RIFF_SPACING_BASE;
  const out = [];
  let t = leadTime;
  (rhythm ?? []).forEach((beat, i) => {
    if (i > 0) t += (beat?.gapBefore ?? GAP_FALLBACK) + base;
    out.push({ hitAt: t, feel: beat?.feel ?? 'steady' });
  });
  return out;
}

// ── Judging ──────────────────────────────────────────────────────────────────
// The reachable window around a note's hit-time (± this many ms).
export function riffOkWindow(preset, feel, hasGhost = false) {
  const tighten = feel === 'rushed' ? RIFF_RUSHED_TIGHTEN : 1;
  const ghost   = hasGhost ? RIFF_GHOST_WINDOW_MULT : 1;
  return Math.round(preset.ok * tighten * ghost);
}

// Grade a correct-key press by its distance from the hit-time. Returns
// 'perfect' | 'good' | 'ok', or null when the press is outside the window
// (callers treat null as "no note in reach — ignore the press").
export function gradeRiffOffset(offsetMs, preset, feel) {
  const tighten = feel === 'rushed' ? RIFF_RUSHED_TIGHTEN : 1;
  const a = Math.abs(offsetMs);
  if (a <= preset.perfect * tighten) return 'perfect';
  if (a <= preset.good    * tighten) return 'good';
  if (a <= preset.ok      * tighten) return 'ok';
  return null;
}
