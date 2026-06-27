// =============================================================================
// music/chords.js  —  Harmony → combat (pure chord evaluation)
// -----------------------------------------------------------------------------
// "Your harmony IS your fight." A spirit's Drive/Sustain are read from the chord
// implied by the notes they committed, not a static stat sheet.
//   • Consonance buys Sustain (a stable wall).      • Dissonance buys Drive (aggression).
//   • Sophistication buys total power.              • A note-set with no chord = a Tone Cluster.
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
// drive / sustain come straight from the design table (DESIGN_AUDIT_v2 §6.3).
// Ordered rank-desc so the first match for a given root is that root's best.
export const CHORD_TEMPLATES = [
  { id:'dom9',  label:'Dominant 9',   ivals:[0,4,7,10,2], rank:7, drive:9, sustain:5 },
  { id:'min9',  label:'Minor 9',      ivals:[0,3,7,10,2], rank:7, drive:8, sustain:6 },
  { id:'dim7',  label:'Diminished 7', ivals:[0,3,6,9],    rank:6, drive:9, sustain:2 },
  { id:'dom7',  label:'Dominant 7',   ivals:[0,4,7,10],   rank:6, drive:8, sustain:4 },
  { id:'maj7',  label:'Major 7',      ivals:[0,4,7,11],   rank:6, drive:5, sustain:8 },
  { id:'min7',  label:'Minor 7',      ivals:[0,3,7,10],   rank:6, drive:6, sustain:7 },
  { id:'m7b5',  label:'Half-dim 7',   ivals:[0,3,6,10],   rank:6, drive:7, sustain:4 },
  { id:'dim',   label:'Diminished',   ivals:[0,3,6],      rank:5, drive:9, sustain:2 },
  { id:'aug',   label:'Augmented',    ivals:[0,4,8],      rank:5, drive:8, sustain:3 },
  { id:'maj',   label:'Major triad',  ivals:[0,4,7],      rank:4, drive:4, sustain:7 },
  { id:'min',   label:'Minor triad',  ivals:[0,3,7],      rank:4, drive:5, sustain:6 },
  { id:'sus2',  label:'Sus2',         ivals:[0,2,7],      rank:3, drive:6, sustain:4 },
  { id:'sus4',  label:'Sus4',         ivals:[0,5,7],      rank:3, drive:6, sustain:4 },
  { id:'power', label:'Power chord',  ivals:[0,7],        rank:2, drive:5, sustain:5 },
];

const SINGLE  = { id:'single',  label:'Single note',  drive:3, sustain:3 };
const CLUSTER = { id:'cluster', label:'Tone cluster', drive:7, sustain:1 };

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
