// =============================================================================
// music/chords.js  —  Harmony → combat (pure chord evaluation)
// -----------------------------------------------------------------------------
// "Your harmony IS your fight." A spirit's Drive/Sustain are read from the chord
// implied by the notes they committed, not a static stat sheet.
//   • Note count buys total power.                  • A note-set with no chord = a Tone Cluster.
//   • Consonance/dissonance is a ±1 tilt on top: consonant leans Sustain (a stable
//     wall), dissonant leans Drive (aggression). The tilt colours the chord; it no
//     longer decides how strong it is.
//
// evaluateChord(notes) scans the DISTINCT pitch classes present and reports the
// strongest chord that is fully contained in them (subset match), so a melodic
// line that happens to spell a triad still reads as that triad. Pure, no deps
// beyond pitch-class lookup — lives beside detectCadence / detectRiff.
// =============================================================================
import { pitchIndex } from "./notes.js";

export const PC_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Chord templates as interval sets relative to the root (semitones, mod 12).
// `rank` = sophistication: higher wins when several templates match a root.
// Ordered rank-desc so the first match for a given root is that root's best.
//
// drive / sustain follow the note-count curve (PENDING_CHANGES Task A):
//   base from note count — 2-note=5, 3-note=6, 4-note=7, 5-note=8, 6-note=9
//   then a ±1 affinity tilt — drive-lean, sustain-lean, or neutral.
// More notes = stronger chord. Consonance/dissonance is the tilt, not the driver;
// the old model punished players for correctly spelling a major triad.
export const CHORD_TEMPLATES = [
  // ── 6-note (base 9) — THE CAPSTONE'S CHORDS ────────────────────────────────
  // ⚠️ ADDED WITH THE 6th STACK SLOT, AND THE SLOT IS USELESS WITHOUT THEM.
  // `theory_chromatic` grants slot 6, but the table used to stop at 5 notes — so a
  // six-note stack evaluated as a plain Dominant 9 (subset matching), with the same
  // rank, the same Drive/Sustain and the same Harmonic Lock bonus as a five-note
  // one. The most expensive skill in the game measured a payout of −0.04 Db.
  //
  // These are what "Chromatic Mastery" should mean musically: the 11th and the 13th
  // are where a guitarist stops spelling chords and starts voicing them. Rank 8 is
  // a new top band, and Harmonic Lock pays +3 for it — the only +3 in the game.
  { id:'dom13', label:'Dominant 13',  ivals:[0,4,7,10,2,9], rank:8, drive:10, sustain:8 }, // drive-lean
  { id:'min11', label:'Minor 11',     ivals:[0,3,7,10,2,5], rank:8, drive:8,  sustain:10 },// sustain-lean
  // 5-note (base 8)
  { id:'dom9',  label:'Dominant 9',   ivals:[0,4,7,10,2], rank:7, drive:9, sustain:7 },  // drive-lean
  { id:'min9',  label:'Minor 9',      ivals:[0,3,7,10,2], rank:7, drive:7, sustain:9 },  // sustain-lean
  // 4-note (base 7)
  { id:'dim7',  label:'Diminished 7', ivals:[0,3,6,9],    rank:6, drive:8, sustain:6 },  // drive-lean
  { id:'dom7',  label:'Dominant 7',   ivals:[0,4,7,10],   rank:6, drive:8, sustain:6 },  // drive-lean
  { id:'maj7',  label:'Major 7',      ivals:[0,4,7,11],   rank:6, drive:6, sustain:8 },  // sustain-lean
  { id:'min7',  label:'Minor 7',      ivals:[0,3,7,10],   rank:6, drive:6, sustain:8 },  // sustain-lean
  { id:'m7b5',  label:'Half-dim 7',   ivals:[0,3,6,10],   rank:6, drive:8, sustain:6 },  // drive-lean
  // 3-note (base 6)
  { id:'dim',   label:'Diminished',   ivals:[0,3,6],      rank:5, drive:7, sustain:5 },  // drive-lean
  { id:'aug',   label:'Augmented',    ivals:[0,4,8],      rank:5, drive:7, sustain:5 },  // drive-lean
  { id:'maj',   label:'Major triad',  ivals:[0,4,7],      rank:4, drive:5, sustain:7 },  // sustain-lean
  { id:'min',   label:'Minor triad',  ivals:[0,3,7],      rank:4, drive:5, sustain:7 },  // sustain-lean
  { id:'sus2',  label:'Sus2',         ivals:[0,2,7],      rank:3, drive:6, sustain:6 },  // neutral
  { id:'sus4',  label:'Sus4',         ivals:[0,5,7],      rank:3, drive:6, sustain:6 },  // neutral
  // 2-note (base 5)
  { id:'power', label:'Power chord',  ivals:[0,7],        rank:2, drive:5, sustain:5 },  // neutral
];

const SINGLE  = { id:'single',  label:'Single note',  drive:3, sustain:3 };
const CLUSTER = { id:'cluster', label:'Tone cluster', drive:3, sustain:2 };  // was drive:7, sustain:1

// Returns { id, label, name, root, rootPc, drive, sustain, notesCount }.
// notes: array of note names (any spelling) — order/duplicates ignored.
export function evaluateChord(notes) {
  const pcs = [...new Set((notes || []).map(pitchIndex).filter(p => p >= 0))];
  if (pcs.length === 0) return { ...SINGLE, label:'—', name:'—', root:null, rootPc:null, notesCount:0 };
  if (pcs.length === 1) {
    return { ...SINGLE, name:`${PC_NAMES[pcs[0]]} (single)`, root:PC_NAMES[pcs[0]], rootPc:pcs[0], notesCount:1 };
  }

  let best = null; // { tpl, rootPc }
  for (const rootPc of pcs) {
    const rel = new Set(pcs.map(p => ((p - rootPc) % 12 + 12) % 12));
    for (const tpl of CHORD_TEMPLATES) {
      if (tpl.ivals.every(iv => rel.has(iv))) {
        if (!best || tpl.rank > best.tpl.rank ||
            (tpl.rank === best.tpl.rank && tpl.ivals.length > best.tpl.ivals.length)) {
          best = { tpl, rootPc };
        }
        break; // rank-ordered: first hit for this root is its strongest chord
      }
    }
  }

  if (!best) {
    return { ...CLUSTER, name:'Tone cluster', root:PC_NAMES[pcs[0]], rootPc:pcs[0], notesCount:pcs.length };
  }
  const { tpl, rootPc } = best;
  return {
    id: tpl.id, label: tpl.label, quality: tpl.label,
    root: PC_NAMES[rootPc], rootPc,
    name: `${PC_NAMES[rootPc]} ${tpl.label}`,
    drive: tpl.drive, sustain: tpl.sustain,
    notesCount: pcs.length,
  };
}
