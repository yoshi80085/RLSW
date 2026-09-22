import { characterId } from "../data/spiritIdentity.js";
// A Spirit's fan rule is a small, explicit melody structure. These are not
// Db rules: fans reward a recognisable identity; clean notes and endings have
// their own payout layers in melodyPayout.js.
//
// ⭐ DISCORD BREAKS A SHAPE (Alex, 2026-09-17 — MELODY_IDENTITY_DESIGN.md
// §5⃣.0.0 rule 4, "discord notes are inert: no fans"). Every public reader takes
// the clean palette as `scale`; an out-of-palette note is blanked before any
// gesture looks at the line, so it resets a contour and cannot be either end or
// the middle of a return phrase — exactly how the craft run already treats it.
// 🪦 Before this, D♭ B♭ G♭ was a paid Ronin skip in C major.
// ⚠️ `scale` omitted = no palette check. Only fixtures should rely on that; every
// live caller passes it (payout, bot, finder, crowd coach).

import { pitchIndex } from './notes.js';

const LETTERS = Object.freeze(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
const letterIndex = note => LETTERS.indexOf(String(note ?? '')[0]);

/** The longest one-direction letter-name run. Accidentals are inflections:
 * C → D♭ → E still climbs; C → C♯ does not create a chromatic shortcut.
 * `trailing` returns the run still OPEN at the end of the line instead.
 * ⚠️ It used to reverse the notes first and then return the last run it saw —
 * which is the run at the line's START. `G C D` read 0 (should be 1) and
 * `C D G` read 1 (should be 0), so the coach and the bot's `styleGain` chased a
 * run the line had already broken. A run's length does not depend on which way
 * you read it, so there is nothing to reverse. `actionScoreCheck` pins both. */
function contourRun(line, span, trailing = false) {
  const notes = line ?? [];
  let best = 0, run = 0, direction = 0;
  for (let i = 1; i < notes.length; i += 1) {
    const a = letterIndex(notes[i - 1]);
    const b = letterIndex(notes[i]);
    if (a < 0 || b < 0) { run = 0; direction = 0; continue; }
    const delta = (b - a + 7) % 7;
    if (delta === 0) continue;
    const sign = delta === span ? 1 : delta === 7 - span ? -1 : 0;
    if (!sign) { run = 0; direction = 0; continue; }
    if (direction && sign !== direction) run = 0;
    direction = sign;
    run += 1;
    best = Math.max(best, run);
  }
  return trailing ? run : best;
}

/** The line as the crowd hears it: discord notes become holes (null). */
function heard(line, scale) {
  const notes = line ?? [];
  return scale ? notes.map(n => (scale.includes(n) ? n : null)) : notes;
}

function samePitch(a, b) {
  const aPc = pitchIndex(a), bPc = pitchIndex(b);
  return aPc >= 0 && aPc === bPc;
}

/** Count only non-overlapping A → B → A phrases. This lets Intergalactic 0
 * transmit several distinct signals in one line without A-B-A-B-A farming. */
function returnPhrases(line) {
  let count = 0;
  for (let i = 0; i + 2 < (line?.length ?? 0);) {
    const [a, b, c] = line.slice(i, i + 3);
    if (b != null && samePitch(a, c) && !samePitch(a, b)) { count += 1; i += 3; }
    else i += 1;
  }
  return count;
}

function returnProgress(line) {
  const tail = line?.slice(-2) ?? [];
  return tail.length === 2 && tail[0] != null && tail[1] != null && !samePitch(tail[0], tail[1]) ? 0.5 : 0;
}

export const STYLE_GESTURES = Object.freeze({
  cosmic_ronin: Object.freeze([
    {
      id: 'scalar_shred', label: 'scalar shred', notes: 3,
      pattern: '1 → 2 → 3', lesson: 'Climb or fall through adjacent letter names.', accent: '#b98aff',
      detect: line => contourRun(line, 1) >= 2,
      progress: line => Math.min(2, contourRun(line, 1, true)) / 2,
    },
    {
      id: 'even_skip', label: 'arpeggio skip', notes: 3,
      pattern: '1 → 3 → 5', lesson: 'Keep the same even letter skip in one direction.', accent: '#b98aff',
      detect: line => contourRun(line, 2) >= 2,
      progress: line => Math.min(2, contourRun(line, 2, true)) / 2,
    },
  ]),
  Metalness_Monster: Object.freeze([
    {
      id: 'pedal_chug', label: 'pedal chug', notes: 3,
      pattern: '1 → 2 → 1', lesson: 'Hit a different note, then slam back to the anchor.', accent: '#ffcc33',
      detect: line => returnPhrases(line) > 0,
      progress: returnProgress,
    },
  ]),
  intergalactic_0: Object.freeze([
    {
      id: 'signal_circle', label: 'signal circle', notes: 3, repeatable: true,
      pattern: '1 → 2 → 1  ·  4 → 5 → 4', lesson: 'Send a two-note signal, return to its start, then transmit another.', accent: '#66ddff',
      hits: returnPhrases,
      detect: line => returnPhrases(line) > 0,
      progress: returnProgress,
    },
  ]),
});

export function gesturesFor(spiritId) {
  return STYLE_GESTURES[characterId(spiritId)] ?? [];
}

function hitCount(gesture, line) {
  return gesture.hits ? gesture.hits(line) : (gesture.detect(line) ? 1 : 0);
}

/** Completed structures earn one casual fan each. Intergalactic 0's signal
 * circles are deliberately repeatable; the other identities earn once per
 * named gesture per committed line. */
export function detectSpiritStyle(spiritId, melodyLine, scale = null) {
  const hits = [], labels = [];
  let score = 0;
  const line = heard(melodyLine, scale);
  for (const gesture of gesturesFor(spiritId)) {
    const count = hitCount(gesture, line);
    if (!count) continue;
    hits.push(gesture.id);
    labels.push(count > 1 ? `${gesture.label} ×${count}` : gesture.label);
    score += count;
  }
  return { score, hits, labels };
}

function notesStillNeeded(gesture, progress) {
  return Math.ceil((gesture.notes - 1) * (1 - progress));
}

function steerValue(gesture, line, slotsLeft) {
  const hits = hitCount(gesture, line);
  if (hits) return hits;
  const progress = gesture.progress(line);
  return notesStillNeeded(gesture, progress) <= slotsLeft ? progress : 0;
}

export function styleProgress(spiritId, melodyLine, slotsLeft = Infinity, scale = null) {
  let best = 0;
  const line = heard(melodyLine, scale);
  for (const gesture of gesturesFor(spiritId)) {
    best = Math.max(best, steerValue(gesture, line, slotsLeft));
  }
  return best;
}

export function styleProgressWithNote(spiritId, melodyLine, note, slotsLeft = Infinity, scale = null) {
  const line = heard([...(melodyLine ?? []), note], scale);
  let best = 0;
  for (const gesture of gesturesFor(spiritId)) {
    best = Math.max(best, steerValue(gesture, line, slotsLeft));
  }
  return best;
}

/** The bot needs the increase in completed phrases too: a second Intergalactic
 * signal is worth pursuing even though the first already filled the meter. */
export function styleGain(spiritId, melodyLine, note, slotsLeft = Infinity, scale = null) {
  const beforeLine = heard(melodyLine, scale);
  const before = gesturesFor(spiritId).reduce(
    (sum, gesture) => sum + steerValue(gesture, beforeLine, slotsLeft + 1), 0);
  const afterLine = heard([...(melodyLine ?? []), note], scale);
  const after = gesturesFor(spiritId).reduce(
    (sum, gesture) => sum + steerValue(gesture, afterLine, slotsLeft), 0);
  return Math.max(0, after - before);
}

/** Presentation-safe copy of the rule state. The UI can teach the player from
 * this without reimplementing a detector or predicting a payout itself. */
export function styleCoachFor(spiritId, melodyLine, slotsLeft = Infinity, scale = null) {
  const line = heard(melodyLine, scale);
  return gesturesFor(spiritId).map(gesture => {
    const hits = hitCount(gesture, line);
    const progress = gesture.progress(line);
    return {
      id: gesture.id, label: gesture.label, pattern: gesture.pattern,
      lesson: gesture.lesson, accent: gesture.accent, repeatable: Boolean(gesture.repeatable),
      hits, progress, notesNeeded: hits ? 0 : notesStillNeeded(gesture, progress),
      reachable: hits > 0 || notesStillNeeded(gesture, progress) <= slotsLeft,
    };
  });
}
