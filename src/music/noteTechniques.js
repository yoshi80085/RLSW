// ─── 🎸 NOTE TECHNIQUES — each Spirit bends its own melody ────────────────────
// Alex, 2026-10-07: *"Each Spirit should get a way to 'manipulate' notes in
// their stock somehow."* The Ronin's is first: the HAMMER-ON (going up) / the
// PULL-OFF (going down). Spec: MELODY_IDENTITY_DESIGN.md §13.
//
// ✅ IN THE GAME (2026-10-08, Alex's dial-in: 0 of 24 levers moved). The client
// (`hammerOn` in the monolith), the engine (charges in `economy.js` /
// `turn.js`, the exorcism in `melodyCommit.js`) and the preview page all read
// this one file. ⭐ RONIN ONLY (Alex: "designed only for Ronin as of now, other
// Spirits aren't touched") — `hasHammerOn` is the one gate.
//
// ⭐ "SMART" (Alex: *"the button only available if it senses it can be used in
// a correct way"*). The hammer adds the one note that CONTINUES THE LINE'S LAST
// MOVE, in the Spirit's palette. Two readers decide what "continues" means and
// both are the payout's own, never a copy:
//   • the gestures' letter contour — `spiritStyle.js` `trailingContour`
//     (span 1 = the shred 1→2→3, span 2 = the arpeggio skip 1→3→5);
//   • the craft run — `melodyPayout.js` `craftRunFor` (scale steps or thirds).
// ⚠️ THE TWO DISAGREE AROUND A GAP IN THE SCALE. Hirajoshi + P4 on C is
// C D E♭ F G A♭ — no B. Climbing from A♭, the next LETTER step (a B) does not
// exist, but the next SCALE step is C, which the craft run counts as a step.
// So the button lights on C there (my 2026-10-07 spec said it would stay dark —
// corrected by building it). The readout says what it pays, so it never lies.
//
// ✅ Alex's rulings that live here: it lights whenever it continues the shape,
// paying or not (the readout shows "+N fans" or "no new fans"); both banked
// charges may go on one melody (so a hammered note can be the base of the next).
// 📌 Rulings that live ELSEWHERE when the build comes: charges per turn / the
// bank (turnFlow), not counting toward the Iwato exorcism (melodyCommit).
import { characterId } from '../data/spiritIdentity.js';
import { detectSpiritStyle, trailingContour } from './spiritStyle.js';
import { craftRunFor, craftFansFromRun } from './melodyPayout.js';

export const HAMMER_ON = Object.freeze({
  perTurn: 1,      // ✅ Alex: one technique per turn…
  bank:    2,      // ✅ …carrying over to a max of 2
  minLine: 2,      // ⁉️ my reading: one note is no shape to continue
  maxLine: 8,      // the track's seats (`legalActions.js` MELODY_MAX)
  spans:   [1, 2], // the Ronin's two gestures: step, skip
});

/** ⭐ THE ONE GATE: only the Ronin has a technique (Alex, 2026-10-08). */
export const hasHammerOn = spiritOrId => characterId(spiritOrId) === 'cosmic_ronin';

/** A hammered note's mark in `melodySrcIdx` (the track's "where did this note
 *  come from" array): `'hammer'` or `'pull'`, never a hand slot. ⚠️ Reusing
 *  that array on purpose — every edit to the track already splices it in step
 *  with `melodyLine`, so a technique note can never drift out of alignment. */
export const isTechniqueSrc = src => src === 'hammer' || src === 'pull';

/** The notes the player actually played FROM THE HAND (or bank, or mic) —
 *  what the Iwato exorcism counts (Alex: a hammered note does not lift a curse). */
export const playedNotes = (line, srcs) => (line ?? []).filter((_, i) => !isTechniqueSrc(srcs?.[i]));

/** The charge a turn adds, at the END of the Ronin's own turn (`turn.js`
 *  applyTurnEnded), so it is there for his next one. Returns the new count, or
 *  `null` when nothing changes (another Spirit, or the bank already full), so
 *  the reducer can leave the sheet byte-identical.
 *  ⚠️ WHY TURN END AND NOT TURN START: the client never runs a turn start for
 *  seat one's first turn (`state.js`), so a turn-start grant would give a
 *  seat-one Ronin nothing on turn 1 and a seat-two Ronin his. Instead every
 *  Ronin is DEALT one charge (`economy.js` makeInitialNoteState) and earns the
 *  next at each turn end — the same count at every seat, client and harness. */
export function hammerRecharge(spiritId, ns) {
  if (!ns || !hasHammerOn(spiritId)) return null;
  const now = ns.hammerCharges ?? 0;
  const next = Math.min(HAMMER_ON.bank, now + HAMMER_ON.perTurn);
  return next === now ? null : next;
}

const LETTERS = 'CDEFGAB';
const letterOf = n => LETTERS.indexOf(String(n ?? '')[0]);

/** What a line earns in fans — exactly the commit's sum (melodyCommit.js:
 *  `style.score + craftFans`). */
export function fansFor(spiritId, line, scale) {
  return detectSpiritStyle(spiritId, line, scale).score + craftFansFromRun(craftRunFor(line, scale));
}

/** Does `note` extend a craft run that ends on the line's last note? Returns the
 *  run's new length, or 0. ⚠️ Asked of the REAL reader on each tail: the tail
 *  plus the note is one run exactly when `craftRunFor` says the whole thing is. */
function craftExtension(line, note, scale) {
  let best = 0;
  for (let k = 2; k <= line.length; k += 1) {
    const tail = [...line.slice(-k), note];
    if (craftRunFor(tail, scale) === tail.length) best = tail.length;
  }
  return best;
}

/** Up or down, read as a player reads it: by letter name, the short way round.
 *  (Pitch classes carry no octave; a skip is at most three letters.) */
function directionOf(from, to) {
  const d = (letterOf(to) - letterOf(from) + 7) % 7;
  return d >= 1 && d <= 3 ? 'up' : 'down';
}

/**
 * 🎸 The hammer-on the line allows right now, or why not.
 * @returns {{ ok:true, note, dir:'up'|'down', label:'hammer'|'pull', pays, via:{contour,craft}, candidates }
 *         | { ok:false, reason, candidates:[] }}
 * Reasons: 'no-charge' · 'track-full' · 'too-short' · 'discord-last'
 *          (the last note is out of key — discord breaks every shape) ·
 *          'no-shape' (the last move is neither a step nor a skip) ·
 *          'no-note' (a shape, but no note in the palette continues it).
 */
export function hammerCandidate(spiritId, line, scale, { charges = 1 } = {}) {
  const L = line ?? [];
  const no = reason => ({ ok: false, reason, candidates: [] });
  if (charges <= 0) return no('no-charge');
  if (L.length >= HAMMER_ON.maxLine) return no('track-full');
  if (L.length < HAMMER_ON.minLine) return no('too-short');
  const [a, b] = L.slice(-2);
  if (!scale.includes(b)) return no('discord-last');
  if (!scale.includes(a)) return no('no-shape');

  const before = fansFor(spiritId, L, scale);
  const candidates = [];
  for (const note of scale) {
    const next = [...L, note];
    let contour = 0;
    for (const span of HAMMER_ON.spans) {
      const was = trailingContour(L, span, scale);
      if (was >= 1 && trailingContour(next, span, scale) === was + 1) { contour = span; break; }
    }
    const craft = craftExtension(L, note, scale);
    if (!contour && !craft) continue;
    candidates.push({ note, pays: fansFor(spiritId, next, scale) - before, via: { contour, craft } });
  }
  if (!candidates.length) {
    // Was there a move to continue at all? A step or a skip, by letter or by scale.
    const dl = (letterOf(b) - letterOf(a) + 7) % 7;
    const n = scale.length, dd = (scale.indexOf(b) - scale.indexOf(a) + n) % n;
    const moved = [1, 2, 5, 6].includes(dl) || [1, 2, n - 1, n - 2].includes(dd);
    return no(moved ? 'no-note' : 'no-shape');
  }
  // Best payer first; on a tie the GESTURE's note (the letter contour) wins,
  // then the step over the skip.
  candidates.sort((x, y) => (y.pays - x.pays)
    || ((y.via.contour ? 1 : 0) - (x.via.contour ? 1 : 0))
    || ((x.via.contour || 9) - (y.via.contour || 9)));
  const best = candidates[0];
  const dir = directionOf(b, best.note);
  return { ok: true, note: best.note, dir, label: dir === 'up' ? 'hammer' : 'pull',
    pays: best.pays, via: best.via, candidates };
}

/** The words for a dark button. One copy, read by the preview and (later) the HUD. */
export const HAMMER_DARK_WHY = Object.freeze({
  // ⚠️ SHORT ON PURPOSE: they share one line of the 238 px column with the
  // button's name, the charges and the H key (measured on the preview).
  'no-charge':    'No charge left',
  'track-full':   'Track is full',
  'too-short':    'Play two notes first',
  'discord-last': 'Last note is out of key',
  'no-shape':     'Step or skip first',
  'no-note':      'No note in your scale fits',
});
