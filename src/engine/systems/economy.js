// ─── ENGINE SYSTEM: ECONOMY (note-track / skills) ────────────────────────────
// Phase 5a: contract fixes ahead of the full economy extraction (Phase 5c flip).

import { pitchIndex } from "../../music/notes.js";
import { detectMotifRepeat } from "../../music/cadence.js";
//
// `usedStockIdx` — the per-spirit set of spent stock-slot indices — used to be a
// JS `Set`, which violates the plain-JSON GameState contract (a Set doesn't
// survive JSON.stringify → the Phase-8 replay/serialize proof). It's now a plain
// **insertion-ordered array of integer indices**.
//
// IMPORTANT — insertion order, NOT sorted. A JS `Set` iterates in insertion
// order, and `startNewTurnNotes` relies on that: `[...usedStockIdx].slice(0,
// STOCK_REFILL_RATE)` recharges the slots that were spent FIRST, not the
// lowest-numbered slots. Sorting here would silently change which stock slots
// refill each turn. Insertion order is still fully JSON-safe and replay-
// deterministic (the array is a pure function of the action order, so a headless
// replay reproduces it byte-for-byte). These helpers reproduce the old Set
// semantics exactly (membership + dedup-on-add, insertion order preserved) and
// accept a legacy Set defensively but always emit an array.

/** Membership test — replaces `usedStockIdx.has(idx)`. */
export function usedHas(used, idx) {
  if (Array.isArray(used)) return used.includes(idx);
  if (used && typeof used.has === "function") return used.has(idx);
  return false;
}

/** Fresh plain-array copy — replaces `[...usedStockIdx]`. */
export function usedList(used) {
  if (Array.isArray(used)) return used.slice();
  if (used && typeof used[Symbol.iterator] === "function") return Array.from(used);
  return [];
}

/**
 * Add one or more indices, deduped, preserving insertion order, returning a new
 * array — replaces `new Set([...usedStockIdx, idx])` / `new Set([...used,
 * ...idxs])` (which, spread back out, is exactly an insertion-ordered dedup).
 */
export function usedAdd(used, ...idxs) {
  const out = usedList(used);
  for (const i of idxs.flat()) if (!out.includes(i)) out.push(i);
  return out;
}

// ─── PERFORMANCE SCORE P (Crowd & Intimidation flair, §4) ────────────────────
// Pure kernel extracted verbatim from `confirmNoteTrack` (Phase 5a) — same trick
// as `smashOutcome`/`riffStats`: a single source of truth a server can score
// identically. P measures how INTERESTING the note placement was (melodic shape,
// palette, recognized gestures, repeated motifs) with track length only a small
// nudge; it routes to crowd growth / HC top-up / intimidation downstream.
//
// Returns { score, freestyle }: `score` is P clamped to 0..10; `freestyle` is the
// Freestyle flair flag (Intergalactic 0's pardoned first wrong note), which the
// caller also needs for its flash/log — returned here so the discord/freestyle
// arithmetic lives in ONE place and can't drift.
//
// Inputs (all already computed by the caller):
//   melodyLine          — the committed note track (array of note names)
//   trackHasTritone, isOctaveResolution           — interval-effect flags
//   diatonicRunLen, repeatPatLen, skipClimbLen     — detected run lengths
//   hasGatedEnding      — minor-7th | major-3rd | tritone unlock-gated ending
//   hasRiff             — a legendary riff was detected on the track
//   cadenceResolved     — a cadence objective completed this commit
//   earned              — base HC points earned (feeds the small length nudge)
//   edgeResolved        — the Dissonance Edge resolved this turn (+2 flair)
//   susEnd              — theory_sus suspended ending (+1 flair)
//   discordCount        — raw off-scale note count this track
//   freestylePardon     — Intergalactic 0's first-wrong-note pardon is active
export function performanceScore({
  melodyLine,
  trackHasTritone, isOctaveResolution,
  diatonicRunLen, repeatPatLen, skipClimbLen,
  hasGatedEnding, hasRiff, cadenceResolved,
  earned, edgeResolved, susEnd,
  discordCount, freestylePardon,
}) {
  const perfPc = melodyLine.map(pitchIndex).filter(p => p >= 0);
  const perfDiff = [];
  for (let i = 1; i < perfPc.length; i++) {
    let d = ((perfPc[i] - perfPc[i - 1]) % 12 + 12) % 12;   // fold to nearest direction (−6..6)
    if (d > 6) d -= 12;
    perfDiff.push(d);
  }
  // melodic shape — contour direction changes, leaps (≥3 semitones), interval variety
  let perfDirChg = 0, perfPrevDir = 0;
  for (const d of perfDiff) { const sgn = Math.sign(d); if (sgn && perfPrevDir && sgn !== perfPrevDir) perfDirChg++; if (sgn) perfPrevDir = sgn; }
  const perfLeaps      = perfDiff.filter(d => Math.abs(d) >= 3).length;
  const perfIntDiv     = new Set(perfDiff.filter(d => d).map(d => Math.abs(d))).size;
  const perfDistinctPc = new Set(perfPc).size;
  let perfHas3Repeat   = false;
  for (let i = 2; i < melodyLine.length; i++) {
    if (melodyLine[i] === melodyLine[i - 1] && melodyLine[i - 1] === melodyLine[i - 2]) { perfHas3Repeat = true; break; }
  }
  const perfShape   = Math.min(2, perfDirChg) + Math.min(2, perfLeaps) + (perfIntDiv >= 2 ? 1 : 0) + (perfIntDiv >= 3 ? 1 : 0);
  const perfPalette = (perfDistinctPc >= 3 && !perfHas3Repeat ? 1 : 0) + (perfDistinctPc >= 5 ? 1 : 0);
  const perfGest = Math.min(3,
      (trackHasTritone ? 1 : 0)
    + (isOctaveResolution ? 1 : 0)
    + (diatonicRunLen >= 3 ? 1 : 0)
    + (repeatPatLen   >= 3 ? 1 : 0)
    + (skipClimbLen   >= 3 ? 1 : 0)
    + (hasGatedEnding ? 1 : 0)
  );
  const perfMotif0 = detectMotifRepeat(melodyLine);
  const perfMotif  = (perfMotif0.period >= 3 ? 2 : 0) + (perfMotif0.reps >= 3 ? 1 : 0);
  const perfBig      = (hasRiff ? 3 : 0) + (cadenceResolved ? 1 : 0);  // a landed riff is peak flair
  const perfLenNudge = Math.floor(earned / 3);                          // length is only a small nudge
  const perfDiscord   = freestylePardon ? Math.max(0, discordCount - 1) : discordCount;
  const perfFreestyle = (freestylePardon && discordCount >= 1) ? 1 : 0;
  const score = Math.max(0, Math.min(10,
    perfShape + perfPalette + perfGest + perfMotif + perfBig + perfLenNudge
      + (edgeResolved ? 2 : 0) + (susEnd ? 1 : 0) + perfFreestyle - perfDiscord
  ));
  return { score, freestyle: perfFreestyle };
}
