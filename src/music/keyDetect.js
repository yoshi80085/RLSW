// =============================================================================
// music/keyDetect.js — WHAT ARE THEY PLAYING? — key + chord inference
// -----------------------------------------------------------------------------
// Takes the 12-bin chroma vectors from `audio/chroma.js` and answers two
// different questions with two different confidence levels. Keeping them apart
// is the whole design:
//
//   CHORDS — one moment, one guess. Hard. A strum lasts 300 ms, distortion
//     manufactures partials, and a missing third turns a major into a power
//     chord. Expect ~85% on clean triads and much worse on a full mix, so this
//     returns a RANKED list with confidences and never pretends to be certain.
//
//   KEY / SCALE — many moments, one guess. Easy, and this is the mode's real
//     payoff. Errors average out over twenty seconds instead of compounding per
//     frame, so a running histogram lands the key reliably even when the
//     frame-by-frame chord read is a mess.
//
// PURE MODULE — no audio, no DOM, no app state. Pitch classes are C-based
// (0 = C), matching `music/chords.js` PC_NAMES, micPitch's `pcAbsolute`, and
// chroma.js output. Reuses CHORD_TEMPLATES rather than restating harmony.
//
// ⚠️ ONE INHERITED FIELD IS DELIBERATELY IGNORED: CHORD_TEMPLATES.rank. In the
// duel, rank rewards SOPHISTICATION — a dom13 outranks a major triad because
// spelling one is an achievement. Detection wants the opposite instinct: given
// ambiguous evidence, the simpler chord is the better guess. Rather than invert
// rank (and risk somebody "fixing" the inversion later), scoring ignores it
// entirely — cosine similarity against a normalized template already penalizes
// unsupported extensions, because a 4-note template with only 3 notes present
// scores below the 3-note template that fits exactly. See `chordCandidates`.
// =============================================================================
import { CHORD_TEMPLATES, PC_NAMES } from "./chords.js";
import { NOTE_POOL, canonicalRoot, buildScale } from "./notes.js";

// ── Krumhansl-Kessler key profiles ──────────────────────────────────────────
// Empirical "how much does each scale degree belong to this key" weights from
// the probe-tone experiments. The tonic dominates, the dominant and mediant
// follow, chromatic degrees sit low. Correlating a played pitch-class histogram
// against all 24 rotations of these is the standard key-finding method and it
// is remarkably hard to beat with anything short of a trained model.
export const KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
export const KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

// Margin (best minus runner-up correlation) at which key confidence reads 1.0.
// Calibrated so a clear diatonic passage tops out and a chromatic mess doesn't.
const KEY_MARGIN_FULL = 0.12;
// Same idea for chords, on the tighter scale cosine similarities live on.
const CHORD_MARGIN_FULL = 0.08;

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

function pearson(a, b) {
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < 12; i++) { ma += a[i]; mb += b[i]; }
  ma /= 12; mb /= 12;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < 12; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  const den = Math.sqrt(da * db);
  return den > 0 ? num / den : 0;
}

// ── Key detection ───────────────────────────────────────────────────────────

/**
 * Rank all 24 keys against a pitch-class histogram.
 *
 * @param {number[]|Float32Array} hist  length-12, non-negative, any scale.
 *   Usually an accumulation of many chroma frames — see `makeKeyTracker`. A
 *   single frame technically works and is meaningless: three notes cannot
 *   distinguish C major from G major or A minor.
 * @returns {{
 *   best: object|null,
 *   ranked: {rootPc:number, root:string, mode:string, name:string, score:number}[],
 *   confidence: number, margin: number
 * }}
 *   confidence = clamp01(bestCorrelation) * clamp01(margin / KEY_MARGIN_FULL).
 *   Both factors matter: a strong correlation that ties with its relative
 *   minor is NOT a confident answer, and neither is a clear winner at r = 0.1.
 */
export function detectKey(hist) {
  let total = 0;
  for (let i = 0; i < 12; i++) total += hist[i] || 0;
  if (total <= 0) return { best: null, ranked: [], confidence: 0, margin: 0 };

  const ranked = [];
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    for (const mode of ['major', 'minor']) {
      const prof = mode === 'major' ? KS_MAJOR : KS_MINOR;
      // Rotate the profile so index i of the histogram lines up with the
      // scale degree it would be in this key.
      const rotated = new Array(12);
      for (let i = 0; i < 12; i++) rotated[i] = prof[((i - rootPc) % 12 + 12) % 12];
      const root = canonicalRoot(NOTE_POOL[rootPc], mode);
      ranked.push({
        rootPc,
        root,
        mode,
        name: `${root} ${mode}`,
        score: pearson(hist, rotated),
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  const margin = ranked.length > 1 ? ranked[0].score - ranked[1].score : ranked[0].score;
  const confidence = clamp01(ranked[0].score) * clamp01(margin / KEY_MARGIN_FULL);
  return { best: ranked[0], ranked, confidence, margin };
}

/**
 * Running key estimate over a stream of chroma frames.
 *
 * Accumulates a histogram with an exponential half-life, so the estimate tracks
 * a modulation instead of averaging the whole session into mud — but slowly
 * enough that one weird bar doesn't move it. Default 20 s is about four bars at
 * 80 bpm, which is roughly how long a human needs too.
 *
 * @returns {{ push, estimate, histogram, framesSeen, reset }}
 */
export function makeKeyTracker(opts = {}) {
  const halfLifeMs = opts.halfLifeMs ?? 20000;
  const minFrames = opts.minFrames ?? 60;   // ~1 s at 60 fps before answering
  let hist = new Float64Array(12);
  let frames = 0;

  return {
    /** @param {Float32Array} chroma  a gated, normalized frame. Skip inactive frames. */
    push(chroma, dtMs = 16.7) {
      const decay = Math.pow(0.5, Math.max(0, dtMs) / halfLifeMs);
      for (let i = 0; i < 12; i++) hist[i] = hist[i] * decay + (chroma[i] || 0);
      frames++;
    },
    /** Null best until `minFrames` frames have landed — an early guess is noise. */
    estimate() {
      if (frames < minFrames) {
        return { best: null, ranked: [], confidence: 0, margin: 0, warmingUp: true };
      }
      return { ...detectKey(hist), warmingUp: false };
    },
    histogram() { return Float32Array.from(hist); },
    framesSeen() { return frames; },
    reset() { hist = new Float64Array(12); frames = 0; },
  };
}

/** Key → the spelled scale the game already knows how to draw. */
export function keyToScale(rootPc, mode) {
  const root = canonicalRoot(NOTE_POOL[rootPc], mode);
  return { root, mode, notes: buildScale(root, mode) };
}

/** Pitch classes of a key, as a Set — the bias input for `chordCandidates`. */
export function keyPitchClasses(rootPc, mode) {
  const ivals = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  return new Set(ivals.map(iv => (rootPc + iv) % 12));
}

// ── Chord detection ─────────────────────────────────────────────────────────

/**
 * Rank chord candidates against one chroma frame.
 *
 * Scoring, per (root × template) pair:
 *
 *   base   = cosine similarity between the chroma and the template's binary
 *            note mask. Self-balancing on chord size: a template whose notes
 *            are all present and strong scores ~1, and every extension the
 *            audio does not support drags the score down by the template's
 *            own norm. This is what replaces `rank` (see the header note).
 *   + key  = keyBonus × (fraction of the template's notes that are diatonic to
 *            the supplied key). Off by default; supply `keyPcs` to enable. This
 *            is the single biggest real-world accuracy win available, because
 *            most players stay in one key for far longer than one chord.
 *   + bass = bassBonus × strength of the candidate root in the sub-200 Hz
 *            chroma. Cheap root disambiguation: C major and A minor share two
 *            notes, and what settles it is which one the bass is playing.
 *
 * @param {Float32Array} chroma  normalized 12-bin frame
 * @param {object} opts
 *   bass     — Float32Array(12) low-band chroma from chroma.js (optional)
 *   keyPcs   — Set<number> of diatonic pitch classes (optional)
 *   topN     — how many candidates to return (default 3)
 *   keyBonus / bassBonus — set to 0 to disable either bias
 *   minPresence — chroma level a template note must clear to count as "present"
 *                 in the returned `missing` list (display aid, not scoring)
 * @returns {{ ranked: object[], best: object|null, confidence: number, margin: number }}
 *   Each candidate: { id, label, name, root, rootPc, ivals, score, notes, missing }
 */
export function chordCandidates(chroma, opts = {}) {
  const {
    bass = null,
    keyPcs = null,
    topN = 3,
    keyBonus = 0.05,
    bassBonus = 0.06,
    minPresence = 0.35,
  } = opts;

  let norm = 0;
  for (let i = 0; i < 12; i++) norm += chroma[i] * chroma[i];
  norm = Math.sqrt(norm);
  if (norm <= 0) return { ranked: [], best: null, confidence: 0, margin: 0 };

  const ranked = [];
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    for (const tpl of CHORD_TEMPLATES) {
      const pcs = tpl.ivals.map(iv => (rootPc + iv) % 12);

      let dot = 0;
      for (const pc of pcs) dot += chroma[pc];
      const base = dot / (Math.sqrt(pcs.length) * norm);

      let score = base;
      if (keyPcs) {
        const inKey = pcs.reduce((n, pc) => n + (keyPcs.has(pc) ? 1 : 0), 0);
        score += keyBonus * (inKey / pcs.length);
      }
      if (bass) score += bassBonus * (bass[rootPc] || 0);

      const root = PC_NAMES[rootPc];
      ranked.push({
        id: tpl.id,
        label: tpl.label,
        root,
        rootPc,
        name: `${root} ${tpl.label}`,
        ivals: tpl.ivals,
        score,
        base,
        notes: pcs.map(pc => PC_NAMES[pc]),
        missing: pcs.filter(pc => chroma[pc] < minPresence).map(pc => PC_NAMES[pc]),
      });
    }
  }

  // Ties break toward the simpler chord — fewer notes claimed is fewer notes to
  // be wrong about, and a listener hearing an ambiguous stack calls it the
  // plain triad too.
  ranked.sort((a, b) => (b.score - a.score) || (a.ivals.length - b.ivals.length));

  const top = ranked.slice(0, Math.max(1, topN));
  const margin = ranked.length > 1 ? ranked[0].score - ranked[1].score : ranked[0].score;
  const confidence = clamp01(ranked[0].score) * clamp01(margin / CHORD_MARGIN_FULL);
  return { ranked: top, best: top[0], confidence, margin };
}

/**
 * Pitch classes strong enough in a chroma frame to call "sounding".
 * The bridge to existing code: the returned names feed `evaluateChord(notes)`
 * from music/chords.js unchanged, so a listened-to chord can be scored for
 * Drive/Sustain exactly like a played one.
 */
export function activeNotes(chroma, threshold = 0.5) {
  const out = [];
  for (let pc = 0; pc < 12; pc++) if (chroma[pc] >= threshold) out.push(PC_NAMES[pc]);
  return out;
}

// ── Melodic structure ───────────────────────────────────────────────────────
// A key is one answer about a whole piece. A PALETTE is a sharper one: which
// notes are actually being used. "A minor" and "A minor pentatonic" are the
// same key and completely different information — the second tells you what to
// play, and it is the thing a listener works out after a chorus or two.
//
// ⚠️ WHY THIS IS SEPARATE FROM detectKey, AND NOT MORE SHAPES. Key detection
// correlates against all 24 major/minor profiles and is a statement about
// tonality. This asks a narrower question — what is the smallest scale that
// accounts for the notes played — and the answer is only useful if the shape
// list stays short. Every shape added is another chance to "explain" a passage
// with a mode nobody was thinking in; seven notes will always fit SOMETHING.
// The list below is the rock/blues vocabulary this game is about. Adding
// melodic minor and the rest would raise the hit rate on paper and lower it in
// the room.
// `mode` drives root SPELLING only (canonicalRoot needs to know whether to call
// it G♯ or A♭) — it is not part of the matching. Stated explicitly rather than
// sniffed from the id, so adding a shape can't quietly get it wrong.
export const SCALE_SHAPES = [
  { id: 'pent_min', label: 'minor pentatonic', mode: 'minor', ivals: [0, 3, 5, 7, 10] },
  { id: 'pent_maj', label: 'major pentatonic', mode: 'major', ivals: [0, 2, 4, 7, 9] },
  { id: 'blues',    label: 'blues',            mode: 'minor', ivals: [0, 3, 5, 6, 7, 10] },
  { id: 'minor',    label: 'natural minor',    mode: 'minor', ivals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'major',    label: 'major',            mode: 'major', ivals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'dorian',   label: 'dorian',           mode: 'minor', ivals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'mixo',     label: 'mixolydian',       mode: 'major', ivals: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'phrygian', label: 'phrygian',         mode: 'minor', ivals: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'harm_min', label: 'harmonic minor',   mode: 'minor', ivals: [0, 2, 3, 5, 7, 8, 11] },
];

/**
 * What scale is this person playing out of?
 *
 * Scored as precision and recall against the accumulated pitch-class usage,
 * combined as an F-measure:
 *
 *   precision — of everything played, how much falls inside the shape?
 *               (a shape that misses the notes being used scores badly)
 *   recall    — of the shape's notes, how many are actually being used?
 *               (a big shape that "explains" a passage by containing a smaller
 *               one scores badly, which is what stops major from always
 *               beating its own pentatonic)
 *
 * That second term is the important one. Any five-note passage fits inside
 * dozens of seven-note scales; requiring the shape to be USED, not merely
 * compatible, is what makes "A minor pentatonic" win over "A natural minor"
 * when the 2nd and 6th never appear.
 *
 * ⚠️ THE NOTE SET CANNOT NAME ITS OWN TONIC. A minor pentatonic and C major
 * pentatonic are the SAME FIVE PITCH CLASSES; so are every pair of relative
 * modes. Nothing in a usage histogram distinguishes them, and any code that
 * appears to is really just breaking a tie by array order. Two things are
 * allowed to break it honestly:
 *
 *   keyRootPc — the tonic from `detectKey`, which is a genuinely different
 *               measurement (Krumhansl-Kessler profiles weight the tonic, so
 *               they answer the question this function can't). Pass it in.
 *   rootBonus — a mild preference for shapes rooted on a heavily-played note,
 *               since tonics do get played more. Real but weak; it decides
 *               nothing on its own and is not meant to.
 *
 * With neither, relative modes tie and the shorter/earlier one wins. That is
 * the correct outcome for an underdetermined question, and the reason the UI
 * feeds the key estimate in.
 *
 * @param {Float32Array|number[]} usage  length-12 pitch class weights
 * @param {object} opts
 *   minWeight  — fraction of the strongest note a pitch class must reach before
 *                it counts as "in use" at all. Filters out detection leakage —
 *                without it every one of the twelve has some weight and every
 *                shape gets full precision.
 *   keyRootPc  — tonic hint from detectKey (optional but strongly advised)
 *   keyBonus   — how much that hint is worth
 * @returns {{ best, ranked, notesUsed, confidence }}
 */
export function detectPalette(usage, opts = {}) {
  const minWeight = opts.minWeight ?? 0.12;
  const keyRootPc = Number.isInteger(opts.keyRootPc) ? opts.keyRootPc : null;
  const keyBonus = opts.keyBonus ?? 0.08;
  const rootBonus = opts.rootBonus ?? 0.03;

  let max = 0;
  for (let i = 0; i < 12; i++) max = Math.max(max, usage[i] || 0);
  if (max <= 0) return { best: null, ranked: [], notesUsed: [], confidence: 0 };

  // Weights below the floor are treated as absent, not as small.
  const w = new Array(12);
  let kept = 0;
  for (let i = 0; i < 12; i++) {
    w[i] = (usage[i] || 0) / max >= minWeight ? usage[i] : 0;
    kept += w[i];
  }
  const notesUsed = [];
  for (let i = 0; i < 12; i++) if (w[i] > 0) notesUsed.push({ pc: i, name: PC_NAMES[i], weight: w[i] / max });
  notesUsed.sort((a, b) => b.weight - a.weight);
  if (kept <= 0) return { best: null, ranked: [], notesUsed: [], confidence: 0 };

  const ranked = [];
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    for (const shape of SCALE_SHAPES) {
      const pcs = shape.ivals.map(iv => (rootPc + iv) % 12);
      const inSet = new Set(pcs);

      let inside = 0;
      for (let i = 0; i < 12; i++) if (inSet.has(i)) inside += w[i];
      const precision = inside / kept;

      const usedOfShape = pcs.reduce((n, pc) => n + (w[pc] > 0 ? 1 : 0), 0);
      const recall = usedOfShape / pcs.length;

      const fMeasure = precision + recall > 0
        ? (2 * precision * recall) / (precision + recall)
        : 0;
      // Tonic evidence, which the note set itself cannot supply.
      const score = fMeasure
        + (keyRootPc !== null && rootPc === keyRootPc ? keyBonus : 0)
        + rootBonus * (w[rootPc] / max);

      const root = canonicalRoot(NOTE_POOL[rootPc], shape.mode);
      ranked.push({
        id: shape.id,
        label: shape.label,
        rootPc,
        root,
        name: `${root} ${shape.label}`,
        pcs,
        score,
        fMeasure,
        precision,
        recall,
        outside: notesUsed.filter(n => !inSet.has(n.pc)).map(n => n.name),
      });
    }
  }

  // Ties break toward the SMALLER shape — the same parsimony argument the chord
  // matcher makes. Claiming fewer notes is claiming less.
  ranked.sort((a, b) => (b.score - a.score) || (a.pcs.length - b.pcs.length));
  const top = ranked.slice(0, 3);
  const margin = ranked.length > 1 ? ranked[0].score - ranked[1].score : ranked[0].score;
  return {
    best: top[0],
    ranked: top,
    notesUsed,
    confidence: clamp01(ranked[0].score) * clamp01(margin / 0.06),
  };
}

/**
 * One-call convenience for a live listener: chord read, biased by the running
 * key when that key is trustworthy.
 *
 * The gate on key confidence is the point. An unreliable key estimate biasing
 * chord detection is worse than no bias at all — it would lock early mistakes
 * in place and then quietly confirm them, which is the classic way these
 * systems end up confidently wrong.
 */
export function listenFrame(chroma, bass, keyEstimate, opts = {}) {
  const minKeyConfidence = opts.minKeyConfidence ?? 0.35;
  const useKey = keyEstimate && keyEstimate.best && keyEstimate.confidence >= minKeyConfidence;
  const keyPcs = useKey ? keyPitchClasses(keyEstimate.best.rootPc, keyEstimate.best.mode) : null;
  return {
    ...chordCandidates(chroma, { ...opts, bass, keyPcs }),
    keyBiased: !!useKey,
  };
}
