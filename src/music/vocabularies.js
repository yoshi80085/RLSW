// =============================================================================
// music/vocabularies.js — 🎸 EACH SPIRIT'S TEN SPELLINGS (pure)
// -----------------------------------------------------------------------------
// `CHORD_VOCABULARY_DESIGN.md` is the why; this is the table and the reader.
//
//   • A TRUNK of two (the root; root + 5th) and TWO BRANCHES of four — Drive
//     (red) and Sustain (blue) — at 3, 4, 5 and 6 notes. Ten spellings.
//   • Each branch chord is the one below it PLUS EXACTLY ONE NOTE, so there is
//     always one next note per branch. That note is what glows, what the ghost
//     names, and what opens the next seat on the board.
//   • EVERY NOTE IS A DIE. A stack reads at least its note count. A chord from
//     the MATCHING branch (Drive chord in the Drive stack, Sustain in Sustain)
//     reads 4 / 6 / 8 / 10 at 3 / 4 / 5 / 6 notes.
//
// ⚠️ THE ROOT IS THE STACK'S ROOT — its first note still standing — and the old
// `evaluateChord` "try every note as the root" scan is deliberately NOT used.
// Several vocabularies contain modes of each other (the Ronin's In-sen IS his
// Hirajoshi started on its 5th), so a root scan reads one branch as the other.
//
// 📌 `music/chords.js` still serves the MELODY side (context.js, keyDetect) —
// only the stacks read this file.
// =============================================================================
import { pitchIndex } from "./notes.js";
import { characterId } from "../data/spiritIdentity.js";

/** Intervals above the stack root. Each branch: sizes 3, 4, 5, 6 in order. */
export const VOCABULARIES = Object.freeze({
  // 🗡️ Hirajoshi + 4. Sustain IS his scale; Drive is In-sen, whose ♭2 is the blade note.
  cosmic_ronin: {
    drive:   [['Sus4', [0,5,7]], ['Sus4 ♭6', [0,5,7,8]], ['In-sen', [0,1,5,7,8]], ['Two Blades', [0,1,3,5,7,8]]],
    sustain: [['Sus2', [0,2,7]], ['Minor add9', [0,2,3,7]], ['Hirajoshi', [0,2,3,7,8]], ['Hirajoshi + 4', [0,2,3,5,7,8]]],
  },
  // 🤘 Phrygian. Drive is Phrygian dominant (the major 3rd is the spice); Sustain is the doom wall.
  Metalness_Monster: {
    drive:   [['5♭9', [0,1,7]], ['Major ♭9', [0,1,4,7]], ['7♭9', [0,1,4,7,10]], ['7♭9♭13', [0,1,4,7,8,10]]],
    sustain: [['Minor', [0,3,7]], ['Minor ♭6', [0,3,7,8]], ['Minor ♭6♭9', [0,1,3,7,8]], ['Phrygian Wall', [0,1,3,7,8,10]]],
  },
  // 🪐 Dorian. Drive climbs in 4ths to the So What chord; Sustain is minor with the natural 6th.
  intergalactic_0: {
    drive:   [['Sus4', [0,5,7]], ['7sus4', [0,5,7,10]], ['So What', [0,3,5,7,10]], ['Minor 11', [0,2,3,5,7,10]]],
    sustain: [['Minor', [0,3,7]], ['Minor 6', [0,3,7,9]], ['Minor 6/9', [0,2,3,7,9]], ['Minor 13', [0,2,3,7,9,10]]],
  },
  // 🐀 (proposed — no palette yet) Drive never plays a 3rd: stacked 5ths. Sustain: the bar-band 7-9-13.
  riff_rat: {
    drive:   [['Stacked 5ths', [0,2,7]], ['Stacked 5ths ×3', [0,2,7,9]], ['Stacked 5ths ×4', [0,2,5,7,9]], ['Wall of 5ths', [0,2,5,7,9,10]]],
    sustain: [['Major', [0,4,7]], ['Dominant 7', [0,4,7,10]], ['Dominant 9', [0,2,4,7,10]], ['Dominant 13', [0,2,4,7,9,10]]],
  },
});

/** Unsettled seats (Glamarchy, old saves): the classic ladder, re-cut into the new shape. */
export const FALLBACK_VOCABULARY = Object.freeze({
  drive:   [['Major', [0,4,7]], ['Dominant 7', [0,4,7,10]], ['Dominant 9', [0,2,4,7,10]], ['Dominant 13', [0,2,4,7,9,10]]],
  sustain: [['Minor', [0,3,7]], ['Minor 7', [0,3,7,10]], ['Minor 9', [0,2,3,7,10]], ['Minor 11', [0,2,3,5,7,10]]],
});

export const PC_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const TRUNK = Object.freeze([
  { id:'single', label:'Single note', ivals:[0],   branch:'trunk', size:1 },
  { id:'power',  label:'Power chord', ivals:[0,7], branch:'trunk', size:2 },
]);

/** Dial on the chord's own side: 1, 2, then 4 / 6 / 8 / 10. */
export const leanValue = size => (size <= 1 ? 1 : 2 * (size - 1));

const cache = new Map();
/** The ten rungs for a Spirit, flattened: trunk, Drive branch, Sustain branch. */
export function vocabularyFor(spiritId) {
  const cid = characterId(spiritId);
  if (cache.has(cid)) return cache.get(cid);
  const v = VOCABULARIES[cid] ?? FALLBACK_VOCABULARY;
  const rungs = [...TRUNK.map(r => ({ ...r, drive: r.size, sustain: r.size }))];
  for (const branch of ['drive', 'sustain']) {
    v[branch].forEach(([label, ivals], i) => {
      const size = ivals.length, lean = leanValue(size);
      rungs.push({ id: `${branch}${size}`, label, ivals, branch, size, step: i + 3,
        drive: branch === 'drive' ? lean : size, sustain: branch === 'sustain' ? lean : size });
    });
  }
  const out = Object.freeze({ id: VOCABULARIES[cid] ? cid : 'fallback', rungs: Object.freeze(rungs) });
  cache.set(cid, out);
  return out;
}

const pcOf = n => (typeof n === 'number' ? ((n % 12) + 12) % 12 : pitchIndex(n));

/** The stack as a set of intervals above its root (its first note still standing). */
export function stackIntervals(notes = []) {
  const pcs = (notes || []).filter(n => n != null && n !== '').map(pcOf).filter(p => p >= 0);
  if (!pcs.length) return { rootPc: null, rel: new Set() };
  const rootPc = pcs[0];
  return { rootPc, rel: new Set(pcs.map(p => ((p - rootPc) % 12 + 12) % 12)) };
}

const contains = (rel, ivals) => ivals.every(i => rel.has(i));

/**
 * 🎯 Read a stack. Returns the old `evaluateChord` shape (id, label, name,
 * root, rootPc, drive, sustain, notesCount) so every caller keeps working, plus
 * `driveRung` / `sustainRung` — which spelling each side is actually being paid
 * for — and `spelled` (the biggest spelling the notes contain).
 *
 *   drive   = max(note count, best contained rung's Drive value)
 *   sustain = max(note count, best contained rung's Sustain value)
 */
export function readStack(spiritId, notes = []) {
  const { rootPc, rel } = stackIntervals(notes);
  const n = rel.size;
  if (!n) return { id:'empty', label:'—', quality:'—', name:'—', root:null, rootPc:null,
    drive:0, sustain:0, notesCount:0, driveRung:null, sustainRung:null, spelled:null, extra:0 };
  const { rungs } = vocabularyFor(spiritId);
  let driveRung = null, sustainRung = null, spelled = null;
  for (const r of rungs) {
    if (!contains(rel, r.ivals)) continue;
    if (!driveRung || r.drive > driveRung.drive || (r.drive === driveRung.drive && r.size > driveRung.size)) driveRung = r;
    if (!sustainRung || r.sustain > sustainRung.sustain || (r.sustain === sustainRung.sustain && r.size > sustainRung.size)) sustainRung = r;
    if (!spelled || r.size > spelled.size) spelled = r;
  }
  const extra = n - (spelled?.size ?? 0);
  const loose = !spelled || (spelled.size < 3 && extra > 0);
  const label = loose ? `Loose notes (${n})` : extra > 0 ? `${spelled.label} +${extra}` : spelled.label;
  const root = PC_NAMES[rootPc];
  return {
    id: loose ? 'loose' : spelled.id, label, quality: label,
    name: `${root} ${label}`, root, rootPc,
    drive:   Math.max(n, driveRung?.drive ?? 0),
    sustain: Math.max(n, sustainRung?.sustain ?? 0),
    notesCount: n, driveRung, sustainRung, spelled, extra,
  };
}

/**
 * 🔴🔵 The next step up a stack's OWN branch (Drive stack → Drive branch).
 * The biggest rung of that branch (or the trunk) the stack already holds, and
 * the notes still missing from the rung above it. `missing` has one note when
 * the stack is spelled clean — the efficient play — and more when it is not.
 * @returns null | { rung, missing: number[] (pitch classes), rootPc }
 */
export function nextStep(spiritId, notes = [], which = 'drive') {
  const { rootPc, rel } = stackIntervals(notes);
  if (rootPc == null) return null;
  const chain = vocabularyFor(spiritId).rungs.filter(r => r.branch === 'trunk' || r.branch === which)
    .sort((a, b) => a.size - b.size);
  let held = -1;
  chain.forEach((r, i) => { if (contains(rel, r.ivals)) held = i; });
  const rung = chain[held + 1];
  if (!rung) return null;
  const missing = rung.ivals.filter(i => !rel.has(i)).map(i => (rootPc + i) % 12);
  return { rung, missing, rootPc };
}

/**
 * 🔓 The pitch classes that would open seat `size` for this stack: adding one
 * of them makes the stack contain a spelling of exactly that size, on EITHER
 * branch. A full stack of loose notes has none — seats are opened by spelling.
 * @returns Set<number>
 */
export function seatTargets(spiritId, notes = [], size) {
  const out = new Set();
  const { rootPc, rel } = stackIntervals(notes);
  if (rootPc == null) return out;
  const wanted = vocabularyFor(spiritId).rungs.filter(r => r.size === size && r.branch !== 'trunk');
  for (let i = 1; i < 12; i++) {
    if (rel.has(i)) continue;
    const next = new Set(rel); next.add(i);
    if (wanted.some(r => contains(next, r.ivals))) out.add((rootPc + i) % 12);
  }
  return out;
}
