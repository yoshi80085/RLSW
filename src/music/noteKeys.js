// ─── ⌨️ NOTE KEYS — commit hand notes from the keyboard ─────────────────────
// Alex, 2026-09-25: moving the mouse over every chip "gets kind of tiring".
//
//   letter            → that letter's NATURAL in your hand     (a → A)
//   Shift + letter    → that letter's SHARP OR FLAT in your hand (Shift+B → Bb,
//                        Shift+F → F#)
//   Tab               → switch the stack you are committing to (Drive ⇄ Sustain)
//   Backspace         → pull the last Melody Track note back out
//
// 🎯 WHY ONE MODIFIER COVERS BOTH ♯ AND ♭. The keys never NAME a pitch; they
// PICK a chip that is already in the hand. A hand is drawn from one key's
// spelling (`getSpelledPool`), and that spelling gives each letter at most ONE
// accidental form — B and Bb, never Bb and B#. So "Shift + B" can only mean the
// one altered B you are holding. If two different accidentals on one letter
// ever do meet (a Db kept from one root, a D# drawn under another), presses take
// them left to right, exactly like duplicates of the same note.
//
// Pure: no React, no DOM. The monolith's `keyboardNoteCommit` is the only caller.

const LETTERS = 'ABCDEFG';

/** A stock note → { letter, altered }, or null if it isn't a note name.
 *  Octave digits are ignored ("Bb3" → B, altered). */
export function parseStockNote(note) {
  const s = String(note ?? '').replace(/\d/g, '');
  const letter = s.charAt(0).toUpperCase();
  if (!LETTERS.includes(letter) || !letter) return null;
  return { letter, altered: /[#b♯♭]/.test(s.slice(1)) };
}

/** A keydown → { letter, altered } for a note key, or null.
 *  ⚠️ `altered` reads `shiftKey`, not the letter's case, so Caps Lock can't
 *  silently turn every press into a sharp. Ctrl / Alt / Cmd chords are left to
 *  the browser and the OS. */
export function noteKeyFromEvent(e) {
  if (!e || e.ctrlKey || e.altKey || e.metaKey) return null;
  const k = String(e.key ?? '');
  if (k.length !== 1) return null;
  const letter = k.toUpperCase();
  if (!LETTERS.includes(letter)) return null;
  return { letter, altered: !!e.shiftKey };
}

/** First stock index (left to right) holding that letter in that form and
 *  still available — or -1. `available(i)` is the caller's used/staggered gate. */
export function stockIndexForKey(stock, want, available = () => true) {
  if (!want) return -1;
  for (let i = 0; i < (stock?.length ?? 0); i += 1) {
    const n = parseStockNote(stock[i]);
    if (n && n.letter === want.letter && n.altered === want.altered && available(i)) return i;
  }
  return -1;
}

/** Tab's cycle over the stacks that can still take a note.
 *  null (no stack picked yet) → the first open one; Drive ⇄ Sustain after that.
 *  Returns null when neither stack is open. */
export function nextStackDest(current, { driveOpen = true, sustainOpen = true } = {}) {
  const open = [driveOpen && 'drive', sustainOpen && 'sustain'].filter(Boolean);
  if (!open.length) return null;
  const at = open.indexOf(current);
  return open[(at + 1) % open.length];
}

/** How a key reads on screen: "B" / "Shift+B". */
export function keyLabel(want) {
  return want ? `${want.altered ? 'Shift+' : ''}${want.letter}` : '';
}
