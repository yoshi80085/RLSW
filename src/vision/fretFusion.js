// =============================================================================
// vision/fretFusion.js — 🎯 PITCH SAYS WHICH NOTE, CAMERA SAYS WHICH ONE OF THOSE
// -----------------------------------------------------------------------------
// The last step of camera fusion, and the one that makes the answer EXACT rather
// than approximate.
//
// ── THE INSIGHT THIS MODULE IS BUILT ON ──
// A heard pitch is not a position, but it is not a free variable either: E4 is
// playable in three or four places on a 12-fret neck AND NOWHERE ELSE. Adjacent
// strings are a fourth apart, so those places sit FIVE FRETS apart (four across
// the G–B pair). Measured over the whole neck:
//
//     pitches with more than one position   27
//     gap between neighbouring candidates   min 4 frets, median 5
//     ⇒ the camera needs ±2.0 frets to always pick correctly
//     ⇒ it measures 0.66 RMS — three times better than required
//     ⇒ simulated wrong-pick rate at that error: 0.24%
//
// ⚠️ SO DO NOT SPEND EFFORT MAKING THE CAMERA'S FRET NUMBER MORE PRECISE. That
// was the obvious next move and it is wasted: the output is a choice between
// options five frets apart, and the input is already accurate to two thirds of
// one. Precision beyond that buys nothing. What it buys instead is a hard answer
// — the exact string and the exact fret — plus a margin saying how close the call
// was, which a continuous estimate can never give you.
//
// ── AND THE AUDIO PAYS FOR ITSELF TWICE ──
// Once a note has been snapped, its fret number is KNOWN. The gap between that
// and the camera's raw reading is the parallax error, measured — for free, while
// somebody just plays, with no logging session and nobody clicking anything. That
// is what `makeFretFusion` accumulates.
//
// ⚠️ AND THAT LOOP CAN EAT ITSELF. If the calibration is badly wrong the snapping
// is wrong, the "free ground truth" is wrong, and the learner trains on its own
// mistakes and entrenches them. Two guards, both load-bearing: it only learns
// from picks with a wide margin, and it refuses samples whose residual is bigger
// than parallax could explain — a large residual is evidence the CALIBRATION is
// wrong, and absorbing it would hide exactly the failure it should be reporting.
//
// ── AND THE LIMIT THE GUARDS DO NOT COVER ──
// ⚠️ A calibration wrong by ABOUT A FOURTH is undetectable here. Candidates sit
// four or five frets apart, so an error that size lands on a DIFFERENT REAL
// POSITION: every snap is confident, every residual is small, and the answer is
// consistently wrong by five frets and a whole string. It is the same aliasing
// family as the projective self-similarity in `neckDetect` — a repeating
// structure aliases, and a fretboard is a repeating structure.
//
// Nothing in this module can catch it, and pretending otherwise would be worse
// than the bug. What catches it lives outside: the drawn fret wires not sitting
// on the real frets, and the off-board rate in `cameraHand`. There is a test
// named for this so nobody mistakes the guards for a proof.
//
// PURE MODULE — no camera, no audio, no DOM. Just arithmetic on a neck.
// =============================================================================

import { positionsForPitch, WINDOW } from '../riff/guitarMap.js';
import { midiToPitch, foldOntoNeck } from '../music/neckPlacement.js';

export const FUSION_DEFAULTS = {
  // How far the camera would have to be wrong to flip the answer, before the
  // pick counts as confident. Candidates are 4–5 frets apart, so the boundary
  // sits ~2 frets away; asking for 1.2 keeps the comfortable middle and rejects
  // the notes played right on a boundary.
  minMargin: 1.2,
  // ── Learner guards ──
  // A residual larger than this is not parallax, it is a broken calibration.
  maxTrustedResidual: 1.6,
  minSamples: 20,
  // The samples must cover some neck, or the fit is an offset pretending to be
  // a slope — and a slope fitted at one position is worse than no slope at all.
  minSpread: 4,
  // Hard limits on what the correction may do. Parallax is worth a fret at most;
  // anything larger is a bug or a bad calibration, and clamping keeps a runaway
  // loop from walking the whole neck.
  maxOffset: 2,
  maxSlopeDeviation: 0.25,
};

/**
 * Which position produced this pitch?
 *
 * @param {number} midi        the note heard
 * @param {number} cameraFret  where the camera says the hand is
 * @returns {{position:[number,number], fret:number, string:number, margin:number,
 *            confident:boolean, candidates:[number,number][], runnerUp}|null}
 *   margin — how many frets the camera reading could move before the answer
 *            changes. THE useful confidence number, and the reason this returns
 *            a structure rather than a position: a pick made on a boundary and a
 *            pick made in the clear are different facts.
 */
export function snapToPosition(midi, cameraFret, opts = {}) {
  const o = { ...FUSION_DEFAULTS, ...opts };
  if (!Number.isFinite(midi) || !Number.isFinite(cameraFret)) return null;
  const { pitch } = foldOntoNeck(midiToPitch(midi));
  const candidates = positionsForPitch(pitch);
  if (!candidates.length) return null;

  const sorted = [...candidates].sort(
    (a, b) => Math.abs(a[1] - cameraFret) - Math.abs(b[1] - cameraFret));
  const best = sorted[0];
  const runnerUp = sorted[1] || null;

  // The margin is the distance to the BOUNDARY, not the distance to the runner
  // up. Halfway between two candidates is where the answer flips, and that is
  // the number a caller can reason about: "the camera would have to be this far
  // out before this became the wrong note".
  const margin = runnerUp
    ? Math.abs(cameraFret - (best[1] + runnerUp[1]) / 2)
    : Infinity;

  return {
    position: best,
    string: best[0],
    fret: best[1],
    margin,
    confident: margin >= o.minMargin,
    candidates: sorted,
    runnerUp,
    // How far the camera was from the fret it just resolved to. This is the
    // parallax residual, and it is the whole point of the learner below.
    residual: cameraFret - best[1],
  };
}

/**
 * Snap a whole frame of heard notes, EACH ONE INDEPENDENTLY.
 *
 * ⚠️ PREFER `snapChord` FOR ANYTHING SOUNDING AT THE SAME TIME. This function
 * treats every note as if it were alone, which is right for a melodic line and
 * wrong for a chord: notes ringing together must be reachable by ONE hand, and
 * that is a far stronger constraint than each note separately. Kept because a
 * per-note answer is still the honest one when the notes are not simultaneous,
 * and because `snapChord` falls back to it.
 */
export function snapNotes(notes = [], cameraFret, opts = {}) {
  const out = [];
  for (const n of notes) {
    const s = snapToPosition(n.midi, cameraFret, opts);
    if (s) out.push({ ...n, ...s });
  }
  return out;
}

// =============================================================================
// 🖐 What one hand can actually do
// =============================================================================

export const HAND_DEFAULTS = {
  // ⚠️ TAKEN FROM `guitarMap.WINDOW` RATHER THAN CHOSEN HERE. That constant
  // already means "the frets a hand covers without moving" and the riff voicer
  // has been laying out playable riffs with it since long before any of this
  // existed. A project holding two different opinions about how far a hand
  // reaches would eventually show a chord the voicer would never have written.
  // Span is measured max − min, so WINDOW = 4 means five frets inclusive.
  maxSpan: WINDOW,
  // Four fingers. The thumb is handled separately because it can only do one
  // very specific thing.
  maxFingers: 4,
  // ⚠️ THE THUMB IS NOT A FIFTH FINGER. It comes over the top of the neck and
  // can reach exactly one string — the fattest — and only around the lowest
  // fret of the shape, because the rest of the hand is in the way. Modelled as
  // that narrow allowance rather than as an extra digit, because "five fingers"
  // would wave through shapes no hand can make.
  allowThumbOver: true,
  // A ceiling on nodes explored by `snapChord`. Six notes with four candidates
  // each is 4096 leaves before pruning and far fewer after, so this is never
  // reached in practice — it exists so a pathological frame cannot stall a
  // render loop that has to hit 60 Hz.
  maxHandSearch: 20000,
};

/**
 * Can one hand hold this set of positions at once?
 *
 * ⚠️ THIS IS A FEASIBILITY TEST, NOT A FINGERING. It answers "could a hand do
 * this", and deliberately does not decide WHICH finger goes where — that is a
 * much harder problem, it has many valid answers, and none of them are needed
 * to reject an impossible shape. Every count below is therefore a LOWER BOUND
 * on fingers required. Erring toward "reachable" is the safe direction: a false
 * rejection changes the note shown on screen, a false acceptance merely fails to
 * improve it.
 *
 * ⚠️ BARRES ARE NOT SPECIAL-CASED, AND THAT IS THE ONE DESIGN DECISION HERE
 * WORTH KEEPING. Writing a rule for "a barre" and another for "a partial barre"
 * and another for the low-fret exception is how this gets complicated and wrong.
 * One finger lies flat across a RUN OF ADJACENT STRINGS AT ONE FRET — a full
 * barre and a two-string ring-finger squash are the same physical act at
 * different widths, so they get the same rule and fall out of it for free.
 *
 * What breaks a run is a string in the middle of it that the finger would have
 * to lie on top of and must not: one that is OPEN (the finger would mute it) or
 * fretted LOWER (the note nearer the bridge is the one that sounds, so the lower
 * note could never speak). A string that is simply not being played is no
 * obstacle — the barre rests on it and nobody strikes it.
 *
 * @param {[number,number][]} positions  [string, fret]; fret 0 is open
 * @returns {{reachable:boolean, span:number, fingers:number, reason:string|null}}
 */
export function handShape(positions = [], opts = {}) {
  const o = { ...HAND_DEFAULTS, ...opts };
  const clean = (positions || []).filter(
    p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));

  // ⚠️ ONE STRING CANNOT SOUND TWO NOTES, and this is checked before anything
  // else because it is the constraint the independent snap breaks most often —
  // two notes a fourth apart both land happily on the same string and nothing
  // downstream notices.
  const perString = new Map();
  for (const [s, f] of clean) {
    if (perString.has(s) && perString.get(s) !== f) {
      return { reachable: false, span: 0, fingers: 0, reason: 'two notes on one string' };
    }
    perString.set(s, f);
  }

  const fretted = [...perString.entries()].filter(([, f]) => f > 0);
  if (!fretted.length) {
    // All open, or nothing at all. Always playable, and needs no hand.
    return { reachable: true, span: 0, fingers: 0, reason: null };
  }

  const frets = fretted.map(([, f]) => f);
  const lowest = Math.min(...frets);
  const span = Math.max(...frets) - lowest;
  if (span > o.maxSpan) {
    return { reachable: false, span, fingers: 0, reason: 'span' };
  }

  // Group by fret, then split each group into runs one finger could cover.
  const byFret = new Map();
  for (const [s, f] of fretted) {
    if (!byFret.has(f)) byFret.set(f, []);
    byFret.get(f).push(s);
  }

  let fingers = 0;
  let thumbCandidate = false;
  for (const [f, strings] of byFret) {
    strings.sort((a, b) => a - b);
    let runStart = 0;
    for (let i = 0; i < strings.length; i++) {
      const last = i === strings.length - 1;
      let broken = false;
      if (!last) {
        for (let t = strings[i] + 1; t < strings[i + 1]; t++) {
          const at = perString.get(t);
          if (at === 0 || (at !== undefined && at < f)) { broken = true; break; }
        }
      }
      if (last || broken) {
        fingers++;
        // The thumb can take a run only if that run is the fattest string on
        // its own, at the lowest fret in the shape.
        if (strings[runStart] === 0 && i === runStart && f === lowest) thumbCandidate = true;
        runStart = i + 1;
      }
    }
  }

  const allowed = o.maxFingers + (o.allowThumbOver && thumbCandidate ? 1 : 0);
  return {
    reachable: fingers <= allowed,
    span,
    fingers,
    reason: fingers <= allowed ? null : 'fingers',
  };
}

/**
 * Snap notes that are sounding TOGETHER, as one hand shape.
 *
 * ⚠️ THE CONSTRAINT IS NOT A FILTER, IT IS EXTRA INFORMATION — that is the whole
 * reason to do this rather than reject bad shapes after the fact. Each note
 * alone offers three or four positions and the camera picks the nearest. But the
 * notes must share a hand, so a note whose own choice is a coin toss can be
 * settled outright by its neighbours: the only assignment that leaves the chord
 * playable is often unique. Solving them jointly is strictly better than solving
 * them one at a time and repairing afterwards.
 *
 * ⚠️ AND IT NEVER BLANKS. If no reachable assignment exists — an unlikely
 * detection, a note that is really two notes, a hand doing something this model
 * does not know about — it falls back to the independent snap. Ruling 3 of the
 * handoff: a rejected frame HOLDS, it does not blank. Showing nothing because
 * the chord "should be impossible" would be the system calling the player wrong.
 *
 * @param {{midi:number}[]} notes  sounding simultaneously
 * @param {number} cameraFret      where the camera says the hand is
 * @returns {({position:[number,number], fret, string, margin, confident,
 *             candidates, runnerUp, residual, viaHand:boolean}|null)[]}
 *   aligned index-for-index with `notes`.
 */
export function snapChord(notes = [], cameraFret, opts = {}) {
  const o = { ...FUSION_DEFAULTS, ...HAND_DEFAULTS, ...opts };
  const list = notes || [];
  if (!list.length) return [];

  // The per-note answer, which is both the fallback and the thing we compare
  // against to report whether the hand constraint actually moved anything.
  const alone = list.map(n => snapToPosition(n.midi, cameraFret, o));
  if (!Number.isFinite(cameraFret)) return alone.map(() => null);

  // ⚠️ SIX STRINGS, SO AT MOST SIX NOTES. Chroma can report more than a guitar
  // can play — overtones, a second instrument, the room. Beyond six the search
  // is both meaningless and exponential, so the extra notes keep their
  // independent answer rather than dragging the whole frame into a fallback.
  const order = list
    .map((n, i) => ({ i, n }))
    .filter(x => alone[x.i])
    .slice(0, 6);
  if (!order.length) return alone.map(() => null);

  const candidatesFor = (midi) => {
    const { pitch } = foldOntoNeck(midiToPitch(midi));
    return [...positionsForPitch(pitch)]
      .sort((a, b) => Math.abs(a[1] - cameraFret) - Math.abs(b[1] - cameraFret));
  };
  const cands = order.map(x => candidatesFor(x.n.midi));

  // ⚠️ MOST-CONSTRAINED NOTE FIRST. Ordering the search by fewest candidates is
  // what keeps it cheap: an open-string-only note has one option and fixes part
  // of the shape immediately, pruning everything incompatible before the
  // ambiguous notes are ever explored.
  const idx = cands.map((c, k) => k).sort((a, b) => cands[a].length - cands[b].length);

  const cost = ([, f]) => Math.abs(f - cameraFret);
  let best = null;
  let bestCost = Infinity;
  let visited = 0;

  const chosen = new Array(idx.length).fill(null);
  const dfs = (depth, running) => {
    if (++visited > o.maxHandSearch) return;
    if (running >= bestCost) return;               // branch and bound
    if (depth === idx.length) {
      if (!handShape(chosen, o).reachable) return;
      best = [...chosen];
      bestCost = running;
      return;
    }
    const k = idx[depth];
    for (const p of cands[k]) {
      chosen[depth] = p;
      // Prune on the partial shape: a set that is already unreachable cannot be
      // rescued by adding more notes to it.
      if (handShape(chosen.slice(0, depth + 1), o).reachable) {
        dfs(depth + 1, running + cost(p));
      }
      chosen[depth] = null;
    }
  };
  dfs(0, 0);

  const out = alone.map(s => (s ? { ...s, viaHand: false } : null));
  if (!best) return out;                            // no shape works ⇒ keep the guesses

  for (let d = 0; d < idx.length; d++) {
    const target = order[idx[d]].i;
    const p = best[d];
    const solo = alone[target];
    const moved = !solo || solo.fret !== p[1] || solo.string !== p[0];
    // Re-derive the margin AT THE CHOSEN POSITION so `confident` still means
    // what it says: how far the camera could be wrong before this answer flips.
    const re = snapToPosition(order[idx[d]].n.midi, cameraFret, o);
    out[target] = {
      ...(re || {}),
      position: p,
      string: p[0],
      fret: p[1],
      residual: cameraFret - p[1],
      // ⚠️ A NOTE THE HAND SHAPE MOVED IS CONFIDENT BY A DIFFERENT ROUTE. Its
      // own margin may be tiny — that is usually WHY it moved — but it was not
      // chosen by the camera, it was chosen by the only assignment that leaves
      // the chord playable. Reporting it as unconfident would hide a stronger
      // piece of evidence behind a weaker one.
      confident: moved ? true : !!(re && re.confident),
      viaHand: moved,
    };
  }
  return out;
}

/**
 * Learn the parallax offset from ordinary playing.
 *
 * Fits `trueFret ≈ offset + slope · cameraFret` by ordinary least squares over
 * confident snaps, and applies the inverse. Two numbers, both with physical
 * meaning: the offset is where the calibration sits, the slope is what finger
 * height does as the view angle changes along the neck.
 */
export function makeFretFusion(opts = {}) {
  const o = { ...FUSION_DEFAULTS, ...opts };
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let rejected = 0;
  let fit = null;               // { offset, slope } or null while unproven

  const refit = () => {
    if (n < o.minSamples || maxX - minX < o.minSpread) { fit = null; return; }
    const denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-9) { fit = null; return; }
    let slope = (n * sxy - sx * sy) / denom;
    let offset = (sy - slope * sx) / n;
    // ⚠️ CLAMPED, NOT TRUSTED. The correction exists to remove a fraction of a
    // fret of parallax. If the fit wants more than that, the input is wrong, and
    // a learner permitted to act on it would walk the estimate off the neck.
    slope = Math.max(1 - o.maxSlopeDeviation, Math.min(1 + o.maxSlopeDeviation, slope));
    offset = Math.max(-o.maxOffset, Math.min(o.maxOffset, offset));
    fit = { offset, slope };
  };

  return {
    /**
     * Offer a heard note and the camera's raw reading. Returns the snap so the
     * caller can use it; learns from it only if it is safe to.
     */
    observe(midi, cameraFret) {
      const snap = snapToPosition(midi, cameraFret, o);
      if (!snap) return null;
      if (!snap.confident) return snap;
      // The residual guard. A big miss is evidence about the CALIBRATION, not
      // about parallax, and swallowing it would silence the very signal that
      // should be raising the alarm.
      if (Math.abs(snap.residual) > o.maxTrustedResidual) { rejected++; return snap; }

      n++;
      sx += cameraFret;
      sy += snap.fret;
      sxx += cameraFret * cameraFret;
      sxy += cameraFret * snap.fret;
      minX = Math.min(minX, cameraFret);
      maxX = Math.max(maxX, cameraFret);
      refit();
      return snap;
    },

    /** The camera reading with whatever has been learned applied. */
    correctedFret(cameraFret) {
      if (!Number.isFinite(cameraFret)) return cameraFret;
      return fit ? fit.offset + fit.slope * cameraFret : cameraFret;
    },

    /** True once enough spread-out samples exist for the fit to mean anything. */
    ready() { return fit !== null; },
    fit() { return fit ? { ...fit } : null; },
    state() {
      return {
        samples: n,
        rejected,
        spread: n ? maxX - minX : 0,
        ready: fit !== null,
        offset: fit ? fit.offset : 0,
        slope: fit ? fit.slope : 1,
      };
    },
    /**
     * ⚠️ CALLED ON EVERY RECALIBRATION, AND THIS IS NOT OPTIONAL. What has been
     * learned describes one camera in one position relative to one guitar. Carry
     * it across a recalibration and it becomes a second silent-drift bug layered
     * on the one it was built to fix.
     */
    reset() {
      n = 0; sx = 0; sy = 0; sxx = 0; sxy = 0;
      minX = Infinity; maxX = -Infinity; rejected = 0; fit = null;
    },
  };
}
