// =============================================================================
// vision/neckGeometry.js — 📐 CAMERA PIXELS → NECK COORDINATES
// -----------------------------------------------------------------------------
// The maths half of the camera-fusion experiment (`EAR_SPY_HANDOFF.md` §6). Given
// four clicked corners of the fretboard in a camera image, this maps any image
// point to a (fret, string) coordinate on the neck, and back again.
//
// It is a SEPARATE, PURE module rather than script inside `camera-test.html` for
// the same reason `audio/chroma.js` ships its own FFT: geometry that can only be
// checked by pointing a webcam at a guitar cannot really be checked at all. Every
// function here runs in Node, and `neckGeometrySelftest.mjs` asserts it.
//
// ⚠️ NO DEPENDENCY ON MEDIAPIPE, OR ON A CAMERA, OR ON A DOM. The vision library
// produces 21 landmarks in normalised image space; that is the ONLY thing it
// contributes, and it is deliberately kept on the far side of this boundary so
// the decision of whether to adopt it stays reversible.
//
// ── THE ONE PIECE OF REAL GUITAR PHYSICS IN HERE ──
// A camera looking at a flat fretboard is a projective map, so image → neck is a
// homography and DISTANCE ALONG THE NECK comes back linear. Fret NUMBER is not
// linear in distance — frets crowd together toward the body on a logarithmic
// scale. Reading the coordinate straight off as a fret number is wrong by more
// than a whole fret in the middle of the neck: the point halfway between the nut
// and the 12th fret is fret 5, not fret 6. See `spanToFret`.
// =============================================================================

import { MAX_FRET } from '../riff/guitarMap.js';

export const NECK_STRINGS = 6;
export { MAX_FRET };

// The calibration asks for four corners in a fixed logical order, which is what
// lets the same routine handle a right-handed player, a left-handed player, a
// mirrored preview and a camera lying on its side without a single flag.
//
// ⚠️ THESE ARE MOUSE-CLICK TARGETS AND THE WORDING HAS TO SAY SO. The first draft
// read "NUT end, LOW-E side (the fat string)" — and a playtester holding a guitar
// read a string name in a prompt and plucked the low E, repeatedly, wondering why
// nothing happened. It is an entirely reasonable reading: everything else in this
// project asks you to PLAY something. So the strings are now described as EDGES of
// the board, never named as strings, and the verb is carried by the page.
//
// Do not put a bare string name back in here.
//
// They are also worded as WHERE TWO THINGS MEET rather than as "the corner of the
// board", because CORNER_TARGETS below places them on the outer STRINGS, not on
// the wooden edge — those are a few millimetres apart and the prompts used to
// point at the wrong one.
export const CORNER_PROMPTS = [
  'where the NUT meets the FATTEST string',
  'where the NUT meets the THINNEST string',
  'where the 12th FRET (double dot) meets the THINNEST string',
  'where the 12th FRET meets the FATTEST string',
];

// …and the neck coordinates those four corners are declared to be, as
// [span, string] where span is 0 at the nut and 1 at the 12th fret.
export const CORNER_TARGETS = [
  [0, 0], [0, NECK_STRINGS - 1], [1, NECK_STRINGS - 1], [1, 0],
];

// =============================================================================
// Fret spacing
// =============================================================================

/**
 * Distance along the neck → fret number.
 *
 * `span` is measured in units of "nut to 12th fret", because that is the pair of
 * landmarks a person can actually click accurately — the 12th fret has the double
 * dot on it. The 12th fret sits at exactly half the scale length (that is what an
 * octave IS on a string), so span 1 = half the scale length, and the standard
 * rule d = L(1 − 2^(−n/12)) rearranges to the line below.
 *
 * Returns a FLOAT, and deliberately not a rounded fret: the caller wants to know
 * that the hand is at 4.6 rather than pretending to know it is at 5.
 *
 * @param {number} span  0 = nut, 1 = 12th fret. Extrapolates sanely past both.
 * @returns {number} fret number, 0 = nut. Above the 24th fret it saturates.
 */
export function spanToFret(span) {
  // span/2 is the fraction of the scale length travelled. At span = 2 the
  // fraction is 1.0 — the bridge — where the fret number is infinite, so the
  // domain is clamped just short of it and the result capped at a number no
  // guitar in this model has.
  const travelled = Math.min(0.9995, span / 2);
  if (travelled <= -0.5) return -12;               // absurdly behind the nut
  const fret = -12 * Math.log2(1 - travelled);
  return Math.max(-12, Math.min(48, fret));
}

/** Inverse of `spanToFret` — fret number → distance in nut-to-12th units. */
export function fretToSpan(fret) {
  return 2 * (1 - Math.pow(2, -fret / 12));
}

/**
 * The fret a fingertip at this span is PRESSING.
 *
 * A finger presses the space BEHIND a fret wire, so a continuous reading of 4.6
 * means the finger is between wire 4 and wire 5, which is fret 5. Ceiling, not
 * round — and it is worth being explicit, because rounding here is an off-by-one
 * that would look like a small calibration error rather than a logic bug, and
 * would therefore get "fixed" by dragging the calibration corners.
 */
export function spanToPressedFret(span) {
  const f = spanToFret(span);
  if (f <= 0) return 0;                            // open string / behind the nut
  return Math.max(0, Math.min(MAX_FRET, Math.ceil(f - 1e-9)));
}

// =============================================================================
// Homography
// =============================================================================

/**
 * Solve a linear system by Gaussian elimination with partial pivoting.
 * @param {number[][]} A  n×n, mutated
 * @param {number[]} b    length n, mutated
 * @returns {number[]|null} solution, or null if the system is singular
 */
export function solveLinear(A, b) {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) return null;
    [A[col], A[piv]] = [A[piv], A[col]];
    [b[col], b[piv]] = [b[piv], b[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const k = A[r][col] / A[col][col];
      if (k === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= k * A[col][c];
      b[r] -= k * b[col];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

/**
 * The 3×3 projective map taking four source points to four destination points,
 * returned as the 8 free coefficients (h8 is fixed at 1).
 *
 * ⚠️ FOUR POINTS IS THE MINIMUM AND THERE IS NO REDUNDANCY. A homography has 8
 * degrees of freedom and four correspondences supply exactly 8 equations, so the
 * fit is exact by construction — it passes through your four clicks no matter how
 * badly you clicked. That means THE RESIDUAL IS ALWAYS ZERO AND PROVES NOTHING.
 * A sloppy calibration cannot be detected numerically here; it can only be seen,
 * which is why the bench page draws the predicted fret wires back over the video.
 * If they don't sit on the real frets, the calibration is wrong.
 *
 * @returns {number[]|null} [h0..h7], or null for a degenerate (e.g. collinear) quad
 */
export function solveHomography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [X, Y] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
  }
  return solveLinear(A, b);
}

/**
 * Same, but from FOUR OR MORE correspondences, by least squares.
 *
 * ⚠️ THIS IS THE ONE WITH A MEANINGFUL RESIDUAL. `solveHomography` fits four
 * points exactly and therefore cannot tell you anything about whether they were
 * good points. Give it a fifth and the fit becomes over-determined, the residual
 * becomes real, and a bad correspondence finally has somewhere to show up. Which
 * is exactly why automatic detection can be trusted more than four hand clicks
 * can: it produces dozens of correspondences, and they have to agree.
 *
 * @returns {{ h: number[], residual: number }|null}  residual is RMS in dst units
 */
export function solveHomographyLS(src, dst) {
  const n = Math.min(src.length, dst.length);
  if (n < 4) return null;

  // Normal equations for the 8 unknowns: Aᵀ A h = Aᵀ b, built incrementally so
  // there is never an n×8 matrix in memory.
  const AtA = Array.from({ length: 8 }, () => new Float64Array(8));
  const Atb = new Float64Array(8);
  const addRow = (row, val) => {
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) AtA[i][j] += row[i] * row[j];
      Atb[i] += row[i] * val;
    }
  };
  for (let k = 0; k < n; k++) {
    const [x, y] = src[k];
    const [X, Y] = dst[k];
    addRow([x, y, 1, 0, 0, 0, -X * x, -X * y], X);
    addRow([0, 0, 0, x, y, 1, -Y * x, -Y * y], Y);
  }
  const h = solveLinear(AtA.map(r => [...r]), [...Atb]);
  if (!h || h.some(v => !Number.isFinite(v))) return null;

  let sum = 0;
  for (let k = 0; k < n; k++) {
    const p = applyHomography(h, src[k]);
    if (!p) return null;
    sum += (p[0] - dst[k][0]) ** 2 + (p[1] - dst[k][1]) ** 2;
  }
  return { h, residual: Math.sqrt(sum / n) };
}

/** Apply an 8-coefficient homography to a point. */
export function applyHomography(h, [x, y]) {
  const w = h[6] * x + h[7] * y + 1;
  if (Math.abs(w) < 1e-12) return null;            // point on the horizon line
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
}

/**
 * Build both directions of the neck ↔ image mapping from four clicked corners.
 *
 * Both are solved independently rather than inverting one matrix — same cost, and
 * it keeps the failure mode honest: a degenerate quad returns null from whichever
 * direction is degenerate instead of producing a plausible-looking inverse of
 * something meaningless.
 *
 * @param {[number,number][]} corners  four image points, in CORNER_PROMPTS order
 * @returns {{ toNeck, toImage, corners }|null}
 *   toNeck(imagePoint)  → { span, string, fret }
 *   toImage(neckPoint)  → [x, y]   where neckPoint is [span, string]
 */
export function makeNeckCalibration(corners) {
  if (!corners || corners.length !== 4) return null;
  const fwd = solveHomography(corners, CORNER_TARGETS);
  const inv = solveHomography(CORNER_TARGETS, corners);
  if (!fwd || !inv) return null;

  return {
    corners: corners.map(c => [...c]),
    toNeck(pt) {
      const r = applyHomography(fwd, pt);
      if (!r) return null;
      return { span: r[0], string: r[1], fret: spanToFret(r[0]) };
    },
    toImage(neckPt) { return applyHomography(inv, neckPt); },
    /** The image-space polyline of a fret wire, for drawing the check overlay. */
    fretWire(fret) {
      const span = fretToSpan(fret);
      const a = applyHomography(inv, [span, -0.5]);
      const b = applyHomography(inv, [span, NECK_STRINGS - 0.5]);
      return a && b ? [a, b] : null;
    },
    /** The image-space polyline of a string, likewise. */
    stringLine(string) {
      const a = applyHomography(inv, [0, string]);
      const b = applyHomography(inv, [1, string]);
      return a && b ? [a, b] : null;
    },
  };
}

// =============================================================================
// Is this calibration any good?
// =============================================================================

// ⚠️ THIS EXISTS BECAUSE THE RESIDUAL CANNOT TELL YOU. Four clicks fit a
// homography exactly, so the only numeric error signal is identically zero for a
// perfect calibration and for four points clicked at random. Everything below is
// therefore a check on the SHAPE of the quadrilateral rather than on the fit:
// a real fretboard, seen through a real camera, cannot project to certain shapes,
// and when it does the person clicked something that was not a fretboard corner.
export const CALIBRATION_LIMITS = {
  // A corner sitting on the edge of the picture almost always means the neck
  // continues past it. The commonest single mistake: the nut is out of frame, so
  // the "nut" corner gets clicked wherever the neck leaves the picture, and every
  // fret number afterwards is shifted by however much was cut off.
  edgeMargin: 0.015,
  // Nut to 12th fret is ~324 mm; the board is ~43 mm at the nut. So the true
  // ratio is about 7:1, and perspective only ever squashes it. Well outside this
  // range means the quad is not a neck.
  minAspect: 2.0,
  maxAspect: 30,
  // The nut edge against the 12th-fret edge. Below this the camera is so oblique
  // that a pixel at the far end covers a lot of neck, and the reading gets coarse
  // exactly where it is being asked to be precise.
  minForeshorten: 0.22,
  // How much of the picture the neck fills. Too small and a one-pixel landmark
  // error is worth most of a fret.
  minCoverage: 0.02,
};

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Signed area of a polygon (shoelace). Sign gives the winding direction. */
export function polygonArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/**
 * Structural sanity check on four clicked corners.
 *
 * Returns a list of `{ id, severity, problem, fix }`, worst first, empty when the
 * quad looks like a fretboard. Every entry carries the ACTION to take, not just
 * the complaint — a bench that says "foreshortening 0.19" to someone holding a
 * guitar has told them nothing they can do anything about.
 *
 * @param {[number,number][]} corners  normalised 0..1, in CORNER_PROMPTS order
 */
export function checkCalibration(corners, opts = {}) {
  const o = { ...CALIBRATION_LIMITS, ...opts };
  const issues = [];
  if (!corners || corners.length !== 4) return issues;

  // ── Order and shape ──
  // A rectangle photographed from anywhere is a convex quadrilateral. If the
  // cross products of consecutive edges disagree in sign, the outline crosses
  // itself, which happens when the corners are clicked in the wrong sequence —
  // by far the most likely way to get a confidently wrong neck.
  let pos = 0;
  let neg = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const c = corners[(i + 2) % 4];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross > 0) pos++; else if (cross < 0) neg++;
  }
  if (pos && neg) {
    issues.push({
      id: 'twisted', severity: 'blocker',
      problem: 'those four points cross over each other, so they are not a neck',
      fix: 'recalibrate and follow the prompts in order — the two nut corners first, then the two 12th-fret corners, going around the outline rather than side to side',
    });
  }

  // ── Scale ──
  const area = Math.abs(polygonArea(corners));
  if (area < o.minCoverage) {
    issues.push({
      id: 'tiny', severity: 'blocker',
      problem: 'the neck fills almost none of the picture',
      fix: 'move the camera closer, or turn the guitar so the neck lies across the frame instead of pointing away from it',
    });
  }

  // ── Proportions ──
  const width = (dist(corners[0], corners[1]) + dist(corners[2], corners[3])) / 2;
  const length = (dist(corners[1], corners[2]) + dist(corners[3], corners[0])) / 2;
  const aspect = width > 0 ? length / width : Infinity;
  if (aspect < o.minAspect) {
    issues.push({
      id: 'stubby', severity: 'blocker',
      problem: 'that shape is far too short and wide to be a nut-to-12th-fret stretch',
      fix: 'check you clicked the 12th fret (the one with the double dot) and not a fret near the nut',
    });
  } else if (aspect > o.maxAspect) {
    issues.push({
      id: 'sliver', severity: 'warn',
      problem: 'that shape is a sliver — the two "sides" of the neck are almost the same line',
      fix: 'click the outer EDGES of the fretboard, just outside the low E and high e strings, not two points on the same string',
    });
  }

  // ── Angle ──
  const w0 = dist(corners[0], corners[1]);
  const w1 = dist(corners[2], corners[3]);
  const foreshorten = Math.max(w0, w1) > 0 ? Math.min(w0, w1) / Math.max(w0, w1) : 1;
  if (foreshorten < o.minForeshorten) {
    issues.push({
      id: 'oblique', severity: 'warn',
      problem: `one end of the neck is ${(1 / Math.max(foreshorten, 1e-6)).toFixed(0)}× smaller than the other — the camera is looking down the neck`,
      fix: 'move the camera round so it faces the side of the neck rather than the end of it. Readings at the far end will be coarse until you do',
    });
  }

  // ── Framing ──
  // Checked last because it is the most common and the fix is the most annoying;
  // if something else is also wrong, that is likelier to be the real problem.
  const atEdge = [];
  corners.forEach((c, i) => {
    if (c[0] < o.edgeMargin || c[0] > 1 - o.edgeMargin
      || c[1] < o.edgeMargin || c[1] > 1 - o.edgeMargin) atEdge.push(i + 1);
  });
  if (atEdge.length) {
    issues.push({
      id: 'cropped', severity: 'blocker',
      problem: `corner${atEdge.length > 1 ? 's' : ''} ${atEdge.join(' and ')} ${atEdge.length > 1 ? 'are' : 'is'} hard against the edge of the picture, so part of the neck is outside it`,
      fix: 'get the WHOLE fretboard in shot — nut, 12th fret and both edges, with a margin around it — then recalibrate',
    });
  }

  const rank = { blocker: 0, warn: 1, tip: 2 };
  return issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// =============================================================================
// Reading a hand
// =============================================================================

// MediaPipe hand landmark indices. Only the fretting fingers matter: the thumb
// is behind the neck and the wrist is off the board entirely, and including
// either drags the estimate toward the nut by a fret or more.
export const FINGERTIPS = [8, 12, 16, 20];         // index, middle, ring, pinky
export const FINGER_MCPS = [5, 9, 13, 17];         // the knuckles behind them
export const WRIST = 0;

export const VISION_DEFAULTS = {
  // ⚠️ THE STRING SLACK IS ENORMOUS ON PURPOSE, AND IT IS NOT A FUDGE — IT IS THE
  // HEADLINE MEASUREMENT OF THIS WHOLE EXPERIMENT. A homography maps a PLANE, and
  // fingertips are not in the plane: a fretting finger stands 15–20 mm above the
  // board. That elevation reprojects almost entirely into apparent movement ACROSS
  // the strings, because the strings are ~10 mm apart while the frets near the
  // hand are ~30 mm apart and the camera is usually above the neck rather than
  // beside it. In the selftest's square-on phone view, a fingertip 18 mm up reads
  // ~5 strings out of place and under half a fret out of place.
  //
  // Which is, luckily, the exact shape of the answer §6 hoped for: the coordinate
  // that survives finger height is the one actually wanted (WHICH FRET), and the
  // one it destroys is the one audio already couldn't give either (WHICH STRING).
  // So the gate leans on fret and all but ignores string — a tight string check
  // would reject every genuine fretting hand seen from above.
  //
  // Do not "tighten this up". Tightening it does not make the string coordinate
  // trustworthy, it just makes the fret coordinate stop being reported.
  stringSlack: 4.5,
  fretMin: -2,
  fretMax: MAX_FRET + 5,
  // Below this many believable fingertips, the frame says "I don't know" instead
  // of averaging whatever it has. Two is the floor for a shape rather than a dot.
  minTips: 2,
};

/** Is this projected point plausibly ON the neck? */
export function onNeck(nk, opts = {}) {
  const o = { ...VISION_DEFAULTS, ...opts };
  if (!nk) return false;
  return nk.string >= -o.stringSlack
    && nk.string <= NECK_STRINGS - 1 + o.stringSlack
    && nk.fret >= o.fretMin
    && nk.fret <= o.fretMax;
}

/**
 * One hand's 21 landmarks → where on the neck that hand is.
 *
 * ⚠️ THE MEDIAN, NOT THE MEAN. A hand in a four-fret box has fingertips spread
 * across four frets, and one of them is usually somewhere else entirely — lifted,
 * reaching, or simply mislocated by the model. A mean chases that outlier; a
 * median ignores it, which is the whole reason the estimate is worth anything at
 * a fret's precision.
 *
 * @param {{x:number,y:number}[]} landmarks  normalised 0..1, or pixel — must match
 *   the space the calibration corners were clicked in
 * @param {object} cal  from makeNeckCalibration
 * @returns {{ fret, string, span, tips, spread, tipFrets }|null}
 *   fret   — the number this module exists to produce. Trustworthy.
 *   string — ⚠️ NOT trustworthy; see the note on `stringSlack`. Returned because
 *            it is the honest output of the projection and because watching it
 *            drift is how you notice the calibration has come loose — but nothing
 *            downstream should decide anything from it.
 *   tips   — how many fingertips landed on the neck (0–4); the confidence signal
 *   spread — fret range those tips covered, i.e. how wide the hand is sitting
 */
export function readHand(landmarks, cal, opts = {}) {
  const o = { ...VISION_DEFAULTS, ...opts };
  if (!landmarks || !cal) return null;

  const tipFrets = [];
  const tipStrings = [];
  const tipSpans = [];
  for (const i of FINGERTIPS) {
    const lm = landmarks[i];
    if (!lm) continue;
    const nk = cal.toNeck([lm.x, lm.y]);
    if (!onNeck(nk, o)) continue;
    tipFrets.push(nk.fret);
    tipStrings.push(nk.string);
    tipSpans.push(nk.span);
  }
  if (tipFrets.length < o.minTips) return null;

  const med = arr => {
    const s = [...arr].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  return {
    fret: med(tipFrets),
    string: med(tipStrings),
    span: med(tipSpans),
    tips: tipFrets.length,
    spread: Math.max(...tipFrets) - Math.min(...tipFrets),
    tipFrets,
  };
}

/**
 * Choose the fretting hand out of everything the model found.
 *
 * ⚠️ HANDEDNESS IS THE WRONG SIGNAL AND IS DELIBERATELY IGNORED. MediaPipe reports
 * left/right, which tempts an obvious rule — but the fretting hand is the left one
 * only for right-handed players, only when the camera is not mirrored, and the
 * preview usually IS mirrored. Three ways to be wrong for no gain. Geometry does
 * not care: of the hands actually on the fretboard, the fretting hand is the one
 * nearer the nut. The strumming hand is over the soundhole, off the far end of the
 * calibrated quad, and mostly fails `onNeck` outright.
 */
export function pickFrettingHand(hands, cal, opts = {}) {
  const reads = (hands || [])
    .map((lms, i) => ({ index: i, read: readHand(lms, cal, opts) }))
    .filter(r => r.read);
  if (!reads.length) return null;
  reads.sort((a, b) => a.read.fret - b.read.fret);
  return reads[0];
}

/**
 * Rolling smoother for the camera estimate.
 *
 * Runs on the same principle as `makeHandTracker` in `music/neckPlacement.js` —
 * exponential decay toward what was just seen — but with a much shorter half-life,
 * because unlike the audio heuristic this one is actually LOOKING at the hand and
 * should follow a position change in a beat rather than in a bar. It exists to
 * take the jitter off a 12 fps estimate, not to hold an opinion.
 */
export function makeVisionTracker(opts = {}) {
  const o = { halfLifeMs: 140, lostAfterMs: 700, ...opts };
  let fret = null;
  let string = null;
  let sinceSeen = Infinity;

  return {
    /** @param {{fret,string}|null} read  null = the hand was not found this frame */
    push(read, dtMs = 80) {
      if (read) {
        sinceSeen = 0;
        if (fret == null) { fret = read.fret; string = read.string; }
        else {
          const alpha = 1 - Math.pow(0.5, Math.max(0, dtMs) / o.halfLifeMs);
          fret += alpha * (read.fret - fret);
          string += alpha * (read.string - string);
        }
      } else {
        sinceSeen += Math.max(0, dtMs);
        // ⚠️ A LOST HAND HOLDS, THEN GOES NULL — it does not decay toward the
        // middle of the neck. The same ruling as EAR_SPY_HANDOFF §0.3: an estimate
        // that slides somewhere plausible while the camera sees nothing is worse
        // than no estimate, because nothing on screen says it stopped being real.
        if (sinceSeen > o.lostAfterMs) { fret = null; string = null; }
      }
    },
    value() { return fret == null ? null : { fret, string, stale: sinceSeen > 0 }; },
    /** Milliseconds since a hand was last actually seen. */
    age() { return sinceSeen; },
    reset() { fret = null; string = null; sinceSeen = Infinity; },
  };
}

/**
 * Running comparison of two estimators against logged ground truth.
 *
 * This is the part that decides the whole question, so it reports MEDIAN absolute
 * error alongside the mean: one botched log — a mistimed click, a hand moved
 * between playing and logging — moves a mean by a fret and a median not at all.
 * `within1` is the number that matters most in practice, because the consumer of
 * all this is `placePitch`'s hand reference, which only needs to be right to about
 * a fret to pick the correct position.
 */
export function makeScoreboard() {
  const logs = [];
  const summarise = key => {
    const errs = logs.filter(l => l[key] != null).map(l => Math.abs(l[key] - l.truth));
    if (!errs.length) return { n: 0 };
    const sorted = [...errs].sort((a, b) => a - b);
    const m = sorted.length >> 1;
    return {
      n: errs.length,
      mean: errs.reduce((a, b) => a + b, 0) / errs.length,
      median: sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2,
      within1: errs.filter(e => e <= 1).length / errs.length,
      worst: sorted[sorted.length - 1],
      // Frames where the estimator had nothing to say. Counted separately and
      // NOT as an error, because "I don't know" and "wrong" are different
      // failures — one is recoverable by falling back to the other sensor.
      blank: logs.length - errs.length,
    };
  };
  return {
    log(truth, camera, audio) { logs.push({ truth, camera, audio }); },
    undo() { logs.pop(); },
    clear() { logs.length = 0; },
    count() { return logs.length; },
    entries() { return logs.map(l => ({ ...l })); },
    camera() { return summarise('camera'); },
    audio() { return summarise('audio'); },
  };
}
