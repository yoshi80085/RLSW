// =============================================================================
// music/spice.js — 🎩 SPICE SET + NOTE CLASSIFIER — Discord Coach's brain
// -----------------------------------------------------------------------------
// PURE MODULE — no React, no audio, no state. Deterministic, unit-testable.
//
// Two exports:
//   spiceSetFor(rootPc, chordId, mode)
//     → { chord: Set<pc>, color: Set<pc>, spice: Set<pc> }
//     Computes the three highlight layers for a given chord context.
//
//   classifyNote(history, pc, chordCtx)
//     → 'SAFE' | 'COLOR' | 'DEPTH' | 'NOISE'
//     Watches the last 2–3 notes and classifies based on step-resolution.
//     A note alone is never wrong — the coach watches phrases, not notes.
//
// Pitch class (pc) = 0..11, where 0 = C (matching PC_NAMES in chords.js).
// =============================================================================
import { CHORD_TEMPLATES } from "./chords.js";

// ── The A natural minor scale (matches the riff pitch space) ────────────────
// Semitones from root: 0 2 3 5 7 8 10
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

function scaleForMode(mode) {
  return mode === 'major' ? MAJOR_SCALE : MINOR_SCALE;
}

// ── Chord quality detection (from template id) ──────────────────────────────
function chordQuality(chordId) {
  if (['maj', 'maj7'].includes(chordId)) return 'major';
  if (['min', 'min7', 'min9'].includes(chordId)) return 'minor';
  if (['dom7', 'dom9'].includes(chordId)) return 'dominant';
  if (['dim', 'dim7', 'm7b5'].includes(chordId)) return 'diminished';
  if (chordId === 'aug') return 'augmented';
  if (['sus2', 'sus4'].includes(chordId)) return 'sus';
  if (chordId === 'power') return 'power';
  return 'other';
}

// ── spiceSetFor ─────────────────────────────────────────────────────────────
/**
 * @param {number}  rootPc  Root pitch class (0=C, 9=A, etc.)
 * @param {string}  chordId Template id from CHORD_TEMPLATES
 * @param {string}  mode    'minor' or 'major'
 * @returns {{ chord: Set<number>, color: Set<number>, spice: Set<number> }}
 */
export function spiceSetFor(rootPc, chordId, mode = 'minor') {
  const tpl = CHORD_TEMPLATES.find(t => t.id === chordId);
  const ivals = tpl ? tpl.ivals : [0, 7]; // fallback to power chord

  // CHORD layer: root + chord tones
  const chord = new Set(ivals.map(iv => (rootPc + iv) % 12));

  // COLOR layer: scale tones minus chord tones
  const scale = scaleForMode(mode);
  const scalePcs = new Set(scale.map(s => (rootPc + s) % 12));
  const color = new Set();
  for (const pc of scalePcs) {
    if (!chord.has(pc)) color.add(pc);
  }

  // SPICE layer: curated off-notes with a known payoff
  const spice = new Set();
  const quality = chordQuality(chordId);

  // Universal: ♭7 (blues snarl) over any triad/power
  if (['major', 'minor', 'power', 'sus'].includes(quality)) {
    spice.add((rootPc + 10) % 12); // ♭7
  }

  // Chromatic approach cells: one semitone below/above each chord tone
  for (const iv of ivals) {
    const ct = (rootPc + iv) % 12;
    const below = (ct - 1 + 12) % 12;
    const above = (ct + 1) % 12;
    if (!chord.has(below) && !color.has(below)) spice.add(below);
    if (!chord.has(above) && !color.has(above)) spice.add(above);
  }

  // Quality-specific spice
  if (quality === 'major') {
    spice.add((rootPc + 6) % 12); // ♯4 (Lydian lift)
  }
  if (quality === 'minor') {
    spice.add((rootPc + 9) % 12); // natural 6 (Dorian glow)
  }
  if (quality === 'dominant') {
    spice.add((rootPc + 1) % 12); // ♭9 (the menace note)
  }

  // Universal: tritone against the root (extra-hot)
  spice.add((rootPc + 6) % 12);

  // Remove any spice that's already chord or color
  for (const pc of chord) spice.delete(pc);
  for (const pc of color) spice.delete(pc);

  return { chord, color, spice };
}

// ── classifyNote ────────────────────────────────────────────────────────────
// history: array of recent notes, each { pc, time }. Newest last.
// pc: pitch class of the note being classified (0–11).
// chordCtx: { chord: Set<pc>, color: Set<pc>, spice: Set<pc> }
//
// Resolution rule: an off-note (spice or raw) that resolves by STEP
// (≤ 2 semitones, any direction) onto a chord tone within 2 notes or ~1.5s
// scores DEPTH. Otherwise it's NOISE.
//
// This function classifies the PREVIOUS off-note when a new note arrives,
// so it needs the history. Returns the classification for the current note.

const RESOLVE_WINDOW_MS = 1500;
const RESOLVE_MAX_NOTES = 2;

function isStep(fromPc, toPc) {
  const d = Math.abs(fromPc - toPc);
  const dist = Math.min(d, 12 - d);
  return dist <= 2;
}

/**
 * @param {{ pc: number, time: number }[]} history  Recent notes (newest last, INCLUDING current)
 * @param {number} pc  Current note's pitch class
 * @param {{ chord: Set<number>, color: Set<number>, spice: Set<number> }} chordCtx
 * @returns {{ current: string, resolved: { idx: number, classification: string }[] }}
 *   current: classification of the current note
 *   resolved: any previously-open off-notes that just got classified by this note
 */
export function classifyNote(history, pc, chordCtx) {
  const { chord, color, spice } = chordCtx;
  const now = history.length > 0 ? history[history.length - 1].time : 0;

  // Classify the current note itself
  let current;
  if (chord.has(pc)) {
    current = 'SAFE';
  } else if (color.has(pc)) {
    current = 'COLOR';
  } else {
    // Off-note (spice or raw) — we won't know until it resolves or expires
    current = spice.has(pc) ? 'SPICE-OPEN' : 'RAW-OPEN';
  }

  // Check if this note resolves any recent off-notes
  const resolved = [];
  if (chord.has(pc)) {
    // A chord tone just landed — check if it resolves open off-notes by step
    for (let i = history.length - 2; i >= 0 && i >= history.length - 1 - RESOLVE_MAX_NOTES; i--) {
      const h = history[i];
      if (now - h.time > RESOLVE_WINDOW_MS) break;
      if (chord.has(h.pc) || color.has(h.pc)) continue; // wasn't an off-note
      if (isStep(h.pc, pc)) {
        resolved.push({ idx: i, classification: 'DEPTH' });
      }
    }
  }

  return { current, resolved };
}

// ── Batch classifier: expire open off-notes ─────────────────────────────────
// Call this periodically or when checking session stats.
// Returns indices of history entries that expired as NOISE.
export function expireOpenNotes(history, chordCtx, now) {
  const { chord, color } = chordCtx;
  const expired = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h.classified) continue;
    if (chord.has(h.pc) || color.has(h.pc)) continue;
    if (now - h.time > RESOLVE_WINDOW_MS) {
      expired.push(i);
    }
  }
  return expired;
}

// ── Coach lines ─────────────────────────────────────────────────────────────
const PC_DISPLAY = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];

export function coachLine(event, fromPc, toPc, chordCtx) {
  const from = PC_DISPLAY[fromPc];
  const to   = PC_DISPLAY[toPc];
  if (event === 'DEPTH') {
    const lines = [
      `That ${from} wanted to fall into the ${to} — and you let it.`,
      `THAT'S the Edge. Same move wins you Drive in the pit.`,
      `${from} → ${to}. Tension released. Beautiful.`,
      `The ${from} was begging for resolution — the ${to} delivered.`,
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }
  if (event === 'NOISE') {
    const target = nearestChordTone(fromPc, chordCtx.chord);
    const tName = PC_DISPLAY[target];
    const lines = [
      `That ${from} wanted to land on the ${tName} — try stepping into it.`,
      `Close — the ${from} needed a step down to ${tName} to land.`,
      `The tension was there. Next time, resolve it by step.`,
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }
  return '';
}

function nearestChordTone(pc, chord) {
  let best = 0, bestDist = 99;
  for (const ct of chord) {
    const d = Math.min(Math.abs(pc - ct), 12 - Math.abs(pc - ct));
    if (d < bestDist) { bestDist = d; best = ct; }
  }
  return best;
}
