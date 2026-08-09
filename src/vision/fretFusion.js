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

import { positionsForPitch } from '../riff/guitarMap.js';
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
 * Snap a whole frame of heard notes.
 *
 * ⚠️ EACH NOTE IS SNAPPED INDEPENDENTLY, AND THAT IS A KNOWN GAP. Notes sounding
 * together must be reachable by ONE hand, which is a much stronger constraint
 * than each note separately — a set demanding a six-fret stretch is impossible
 * even when every note in it looks fine alone. Not implemented; the hand-span
 * rule needs its own rules about barres and thumb-overs before it can be trusted
 * to reject anything.
 */
export function snapNotes(notes = [], cameraFret, opts = {}) {
  const out = [];
  for (const n of notes) {
    const s = snapToPosition(n.midi, cameraFret, opts);
    if (s) out.push({ ...n, ...s });
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
