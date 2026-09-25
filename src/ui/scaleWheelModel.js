// ─── 🎡 SCALE WHEEL — the model half ─────────────────────────────────────────
// Alex's dial, each Spirit's look, and `wheelModel` — everything the wheel draws,
// as data, from the same modules the engine scores with. The SVG lives in
// `ScaleWheel.jsx`; this file is split off so that one exports components only.
import { getSpelledPool, playableScale, buildScale, pitchIndex } from '../music/notes.js';
import { melodyModeFor } from '../music/melodyIdentity.js';
import { characterId } from '../data/spiritIdentity.js';
import { styleGain, detectSpiritStyle } from '../music/spiritStyle.js';
import { melodyPayoutFor, ENDING_DB } from '../music/melodyPayout.js';

const TRACK_MAX = 8;

/** 🎛️ ALEX'S DIAL, 2026-09-25 — read off the preview's control panel. */
export const WHEEL_DEFAULTS = Object.freeze({
  size: 343,             // px; the SVG scales down to its column if narrower
  rotate: 'root',        // 'root' = root at 12 o'clock · 'c' = C at top
  degrees: true,         // 1 ♭3 4 5… outside each chip
  dbBadges: true,        // +1 / +2 / +3 Db beside the tonic / 4th / 5th
  phraseGlow: true,      // hand notes that build a fan phrase pulse
  fadeUnheld: true,      // palette notes you are not holding go dim
  ghostNextKey: false,   // dashed shape of next turn's key (off at the dial)
  motif: true,           // each Spirit's ring ornament
  signature: true,       // ★ on the mode's signature note
  path: 'curve',         // melody line bowed toward the hub
  hoverSound: true,      // the CALLER plays it — see onHoverNote
  collapsedByDefault: false,
  wKey: true,            // W toggles the wheel (W is not a note letter)
});

/** 📐 THE NAV WHEEL — Alex, 2026-09-25 PM: *"a bit smaller … around the same size
 *  as all 3 of those [Turn / Scale / Rivals] together"*, dropped under that row by
 *  the Scale chip. ≈214px, with hover tooltips standing in for the info line.
 *  (Named POCKET_ from a first placement in the player pocket; kept to spare churn.) */
export const POCKET_WHEEL = Object.freeze({ ...WHEEL_DEFAULTS, size: 214, titles: true });

/** 🎭 Whose wheel. `accent` is the Spirit's fan-phrase accent (spiritStyle.js);
 *  `sig` is the interval that makes the mode sound like itself — it gets the ★. */
export const WHEEL_LOOK = Object.freeze({
  cosmic_ronin:      { accent: '#b98aff', motif: 'brush',  glyph: '平調子', sig: [8],
                       tag: 'Hirajoshi + the 4th — five steps, a fourth, and the ♭6 that cuts.' },
  Metalness_Monster: { accent: '#ffcc33', motif: 'spikes', glyph: 'Φ',     sig: [1],
                       tag: 'Phrygian — the ♭2 right next to home is the snarl.' },
  intergalactic_0:   { accent: '#66ddff', motif: 'orbit',  glyph: '◎',     sig: [9],
                       tag: 'Dorian — minor, but the natural 6 keeps it floating.' },
  Glamarchy:         { accent: '#ff66cc', motif: 'gem',    glyph: '✦',     sig: [6],
                       tag: 'Lydian — the raised ♯4 is pure sparkle.' },
});
export const lookFor = spiritId => WHEEL_LOOK[characterId(spiritId)] ?? WHEEL_LOOK.Glamarchy;

export const MODE_NAME = { hirajoshi: 'Hirajoshi', phrygian: 'Phrygian', dorian: 'Dorian', lydian: 'Lydian',
  ionian: 'Ionian', mixolydian: 'Mixolydian', aeolian: 'Aeolian', locrian: 'Locrian', major: 'Major', minor: 'Minor' };
export const DEGREE = ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'];
export const pretty = n => String(n ?? '').replace(/b$/, '♭').replace(/#$/, '♯');

/** Everything the wheel draws, as data — exported so the check can read the
 *  rules without a DOM. `available(i)` is the caller's used/staggered gate. */
export function wheelModel({ spiritId, root, hand = [], available = () => true, line = [], opts = WHEEL_DEFAULTS }) {
  const mode = melodyModeFor(spiritId);
  const look = lookFor(spiritId);
  const pool = getSpelledPool(root, mode);
  const palette = playableScale(root, mode);
  const harm = buildScale(root, mode);
  const rootPc = pitchIndex(root);
  const palPcs = new Set(palette.map(pitchIndex));
  const fourthPc = pitchIndex(harm[3]), fifthPc = pitchIndex(harm[4]);
  const kOf = pc => opts.rotate === 'root' ? (pc - rootPc + 12) % 12 : pc;
  const slotsLeft = TRACK_MAX - line.length;
  const baseStyle = detectSpiritStyle(spiritId, line, palette).score;
  const slots = Array.from({ length: 12 }, (_, pc) => {
    const iv = (pc - rootPc + 12) % 12;
    const inPal = palPcs.has(pc);
    const held = [];
    hand.forEach((n, i) => { if (available(i) && pitchIndex(n) === pc) held.push(i); });
    const ending = !inPal ? null : pc === rootPc ? 'tonic' : pc === fifthPc ? 'fifth' : pc === fourthPc ? 'fourth' : null;
    let phrase = 0;
    if (opts.phraseGlow && held.length && slotsLeft > 0) {
      const note = hand[held[0]];
      const done = detectSpiritStyle(spiritId, [...line, note], palette).score > baseStyle;
      phrase = done ? 2 : styleGain(spiritId, line, note, slotsLeft - 1, palette) > 0 ? 1 : 0;
    }
    return { pc, iv, k: kOf(pc), name: pool[pc], degree: DEGREE[iv], inPal, held, ending, phrase,
      sig: !!opts.signature && inPal && look.sig.includes(iv) };
  });
  const payout = line.length ? melodyPayoutFor(spiritId, line, palette, {
    tonic: root, fourth: harm[3], fifth: harm[4], driveRoot: null, sustainRoot: null }) : null;
  return { mode, look, pool, palette, rootPc, palPcs, kOf, slots, payout };
}

/** Words for a hovered slot — the line under the wheel. */
export function describeSlot(s) {
  if (!s) return null;
  const bits = [`${pretty(s.name)} · ${s.degree}`, s.inPal ? 'in your scale' : 'discord',
    s.held.length ? `you hold ${s.held.length}` : 'not in your hand'];
  if (s.ending) bits.push(`end here: +${ENDING_DB[s.ending]} Db`);
  if (s.phrase === 2) bits.push('★ completes a fan phrase');
  else if (s.phrase === 1) bits.push('builds toward a fan phrase');
  return bits.join('  ·  ');
}
