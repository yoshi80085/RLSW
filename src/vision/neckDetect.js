// =============================================================================
// vision/neckDetect.js — 🔍 FINDING THE NECK WITHOUT BEING TOLD WHERE IT IS
// -----------------------------------------------------------------------------
// Replaces the four calibration clicks with a detector, because four clicks is a
// setup step most players will simply skip — and because a hand-clicked
// calibration goes STALE SILENTLY the moment you shift in your chair, while a
// detector that re-runs can notice and re-solve. The second reason is the better
// one: the clicks are annoying, but the drift is what produces wrong data.
//
// ── WHY A GUITAR IS EASY TO FIND ──
// Frets are high-contrast lines whose spacings shrink by exactly 2^(1/12) each
// time. Almost nothing else in a room does that, so finding the fretboard is
// close to free. Standard Canny + Hough, as in TapToTab (arXiv:2409.08618).
//
// ── AND WHY IT IS HARD TO READ ──
// ⚠️ READ THIS BEFORE CHANGING ANYTHING. The obvious idea — identify WHICH frets
// you are looking at from the cross-ratio, which is projectively invariant and so
// survives an unknown camera — DOES NOT WORK, and it fails in a way that looks
// like it works. The fret sequence is PROJECTIVELY SELF-SIMILAR:
//
//     fret position   d(n) = L(1 − 2^(−n/12))
//     substitute      u = 2^(−n/12)   ⇒   d is a Möbius function of u
//     shift the index n → n+k         ⇒   u → 2^(−k/12)·u, a scaling
//     and a scaling of u is itself a Möbius map.
//
// So SLIDING ALONG THE NECK IS A PROJECTIVE TRANSFORMATION. Every run of four
// consecutive frets, anywhere on any guitar, has the identical cross-ratio
// 1.332962922399… — the selftest asserts this to twelve places. No projective
// invariant can ever tell fret 2 from fret 9, because to a camera they are the
// same thing. Any hypothesis search over "which fret does this run start at"
// will find every hypothesis fits essentially perfectly, and will then return
// whichever one won by floating-point noise. That is a detector that is
// confidently wrong by several frets, at random, which is far worse than none.
//
// ── AND THERE IS A SECOND SYMMETRY, WHICH IS WORSE ──
// The sequence is also projectively symmetric under REVERSAL. With u = 2^(−n/12),
// the map u → C/u sends the geometric sequence to itself backwards — and it too
// is a Möbius transformation. So a camera cannot tell which way up the neck runs
// either. Direction is not recoverable from the line positions, and "the gaps get
// smaller toward the bridge" is NOT a usable test, because the reversal is a
// legal projective view of the same lines.
//
// ── WHAT ACTUALLY BREAKS BOTH ──
// An anchor AT FRET 0, plus the constraint that fret numbers cannot be negative.
// That combination is what defeats the reversal: reflecting a run anchored at the
// nut sends it to negative frets, which do not exist, so only one labelling
// survives. ⚠️ AN ANCHOR ANYWHERE ELSE IS NOT ENOUGH ON ITS OWN — anchoring on a
// single 12th-fret marker leaves the mirrored labelling fitting just as well, and
// there is a test asserting exactly that trap.
//
// So the anchor is THE END OF THE BOARD: the neck stops at the nut, and past
// fret 0 there is headstock or hand rather than more fretboard. That is an image
// test, not a geometric one, which is the whole point — see `looksLikeBoardEnd`.
//
// Inlay dots could also serve, but only as a PATTERN of three or more, or via the
// double dot at the 12th being visually distinct from the singles: two plain dots
// are as reversible as two frets. `INLAY_FRETS` is exported for that future work.
//
// Without an anchor, `identifyFrets` returns null. It does not guess.
//
// ── WHAT THIS MODULE DELIBERATELY DOES NOT TRY TO DO ──
// Tell the fat-string side from the thin-string side. There is no geometric way:
// a fretboard mirrored along its own axis is still a fretboard. It is left alone
// rather than guessed at, because getting it wrong mirrors only the STRING
// coordinate — already documented as untrustworthy in `neckGeometry.js` — and
// leaves the FRET coordinate exactly correct. There is a test for that.
//
// PURE MODULE — takes a grayscale Float32Array, returns numbers. No DOM, no
// canvas, no camera.
// =============================================================================

import {
  fretToSpan, spanToFret, solveHomographyLS, applyHomography, makeNeckCalibration,
  CORNER_TARGETS, NECK_STRINGS,
} from './neckGeometry.js';

/** Frets that carry a position marker on a standard neck. Unevenly spaced —
 *  which is exactly why they can identify themselves and the frets cannot. */
export const INLAY_FRETS = [3, 5, 7, 9, 12, 15, 17, 19, 21];

export const DETECT_DEFAULTS = {
  workWidth: 320,
  edgeThreshold: 0.22,
  thetaBins: 180,
  rhoBins: 400,
  // ⚠️ LOW, ON PURPOSE. Strings run the whole length of the frame and frets only
  // cross its width, so a fret's Hough peak is a fraction of a string's. A
  // threshold high enough to look "clean" keeps every string and throws away
  // every fret, and the detector then fails with a full set of lines in hand.
  // ── PASS 1: the strings ──
  // Long, strong, and all pointing the same way. Easy, so the threshold is high.
  stringPeakThreshold: 0.40,
  maxStringLines: 14,
  // ── PASS 2: the frets ──
  // ⚠️ WHY THERE ARE TWO PASSES AT ALL. A string runs the length of the frame; a
  // fret only crosses the width of the board, so a fret casts roughly a TENTH of
  // a string's Hough votes. Ranked together, the strongest ninety lines in the
  // picture are ninety strings and board edges and every fret falls off the end
  // of the list — the detector then fails while holding a perfectly good set of
  // lines, which is a maddening thing to debug. Normalising per orientation was
  // tried and is worse: it promotes one line out of every θ row, so the answer
  // becomes 180 imaginary lines. The fix is structural. Find the strings, use
  // them to mask the board, then look for frets ONLY inside it and ONLY at
  // orientations the strings are not using.
  peakThreshold: 0.30,
  // ⚠️ PASS 2 GETS ITS OWN, MUCH LARGER CAP, AND THE REASON IS THE WHOLE ANCHOR.
  // Sharing `maxLines: 40` with pass 1 looks harmless and silently breaks
  // detection: a fret near the edge of the frame is foreshortened, so it casts
  // fewer votes than one in the middle, and a vote-ranked cap therefore throws
  // away the OUTERMOST frets first — which are precisely the ones the nut test
  // needs. Measured on the synthetic bench: the nut scored 0.77 against a cut of
  // 0.776 and was dropped by four thousandths, in all three camera views. The
  // detector then had a perfect set of interior frets, no nut, and no way to
  // anchor. Take lines generously here and thin them by POSITION below, which
  // discards duplicates instead of extremities.
  //
  // ⚠️ AND THIS IS THE TRADE THAT IS STILL OPEN — see §6b of EAR_SPY_HANDOFF.
  // Reaching this deep into the ranked candidate list also admits the SHOULDERS
  // of each fret's Hough ridge: phantom lines sitting roughly midway between
  // real frets, about 7 px apart at the working width while genuine frets are
  // 14–24 px apart. They are NOT a fixture artefact — the synthetic board fill
  // was checked and is solid — and `mergeNearby` cannot remove them, because its
  // tolerance is derived from the observed gaps and fret spacing itself varies
  // threefold along the neck. With the shoulders present, `identifyFrets` finds
  // a STRETCHED labelling that hands consecutive fret numbers to a fret and its
  // own shoulder: residual 0.0024, twenty inliers, and one label in twenty
  // correct. Widening `nmsRhoFrac` to 0.025 fixes it outright for the square-on
  // view (17/17 labels correct) and starves the other two views of lines
  // altogether. The unfinished work is CONDENSING LINES, not finding the nut.
  maxFretLines: 200,
  // Frets are looked for within this much of PERPENDICULAR to the strings.
  fretAcceptHalfWidth: 45 * Math.PI / 180,
  bandMargin: 0.06,
  // How wide a swathe to delete around each detected string.
  stringSuppressPx: 2.5,
  // Fraction of a typical fret gap below which two detections are one fret.
  mergeGapFrac: 0.30,
  maxLines: 40,
  nmsTheta: 3 * Math.PI / 180,
  // ~3 px at the working width: enough to merge the two edges of one fret wire,
  // tight enough to keep frets 11 and 12 apart.
  nmsRhoFrac: 0.010,
  familySpread: 35 * Math.PI / 180,
  minFretLines: 4,
  minStringLines: 2,
  // Tight. A run of evenly spaced lines — a window blind, a radiator, a bookcase
  // — fits a fret labelling at about 1.6% of span, and a real neck with a couple
  // of pixels of noise on every line comes in under 0.4%. The gate sits in that
  // gap, nearer the good side, because a false positive here is a confidently
  // wrong neck and a false negative is just "press it again".
  maxFitResidual: 0.008,
  highestFret: 20,
  // How close a line must land to a fret to count as explaining it, as a
  // fraction of the observed span.
  inlierFrac: 0.012,
  // Fewer agreeing lines than this and it is a coincidence, not a fretboard.
  minInliers: 6,
  // ⚠️ A DENSITY PRIOR, AND IT IS DOING REAL WORK. Nine evenly spaced lines — a
  // window blind — get happily labelled as frets 1,3,5,…,17 at a residual of
  // 0.2%, because a projective map really can send every other fret to an
  // arithmetic sequence. Nothing about the fit rejects it. What rejects it is
  // that no camera skips alternate frets: a genuine run is dense. This is the
  // ratio of the span of fret NUMBERS to the count of them, so 0..19 seen as 17
  // lines scores 1.18 and 1,3,…,17 seen as 9 scores 1.89.
  maxSkipRatio: 1.5,
  // How different the region beyond the outermost fret has to look from the
  // board before it counts as the end of the neck.
  nutContrast: 0.10,
  // ⚠️ HOW MANY DISTINCT POSITIONS SURVIVE INTO IDENTIFICATION, AND IT IS A COST
  // CEILING AS MUCH AS AN ACCURACY ONE. `identifyFrets` searches pairs of lines
  // against pairs of fret numbers, so it is O(m²·F²): measured at 194 ms for
  // m = 20, 1.4 s for m = 44 and 3.5 s for m = 60. Thinning to one line per bin
  // along the neck keeps m near the number of frets that can actually be in
  // shot, which is the honest bound anyway — two lines in the same bin are the
  // same fret found twice, and the strongest of them is the one to keep.
  positionBins: 32,
  // How many lines in from each end to try as the nut. The extreme line is often
  // a stray, so trying only it is what left `detectNeck` returning null.
  maxNutCandidates: 3,
  // A rival labelling within this many inliers of the best is a genuine rival.
  // If it disagrees, the detector declines rather than picking a winner.
  rivalInlierSlack: 2,
};

// =============================================================================
// Image → edges
// =============================================================================

/** RGBA bytes → grayscale floats 0..1, downscaled by an integer factor. */
export function toGray(rgba, w, h, step = 1) {
  const ow = Math.floor(w / step);
  const oh = Math.floor(h / step);
  const out = new Float32Array(ow * oh);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const i = ((y * step) * w + x * step) * 4;
      // Rec. 601 luma — a plain channel average loses fret wire against maple.
      out[y * ow + x] = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) / 255;
    }
  }
  return { gray: out, width: ow, height: oh };
}

/** Sobel gradient magnitude, normalised so the strongest edge is 1. */
export function sobel(gray, w, h) {
  const mag = new Float32Array(w * h);
  let max = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1]
        + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1]
        + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      const m = Math.hypot(gx, gy);
      mag[i] = m;
      if (m > max) max = m;
    }
  }
  if (max > 0) for (let i = 0; i < mag.length; i++) mag[i] /= max;
  return mag;
}

// =============================================================================
// Edges → lines
// =============================================================================

/**
 * Are these the same line? θ is π-periodic, and a line that wraps past π comes
 * back with its ρ negated — comparing |ρ| instead, which is the tempting
 * shortcut, silently merges every line with its mirror through the origin.
 */
export function sameLine(a, b, dTheta, dRho) {
  let dt = a.theta - b.theta;
  let rb = b.rho;
  if (dt > Math.PI / 2) { dt -= Math.PI; rb = -rb; }
  else if (dt < -Math.PI / 2) { dt += Math.PI; rb = -rb; }
  return Math.abs(dt) < dTheta && Math.abs(a.rho - rb) < dRho;
}

/**
 * Standard Hough transform. Lines come back as `{ theta, rho, votes }` with
 * `x·cos θ + y·sin θ = ρ`, ρ normalised by the longer image axis so every
 * threshold in this module is resolution-independent.
 */
export function houghLines(mag, w, h, opts = {}) {
  const o = { ...DETECT_DEFAULTS, ...opts };
  const diag = Math.hypot(w, h);
  const scale = Math.max(w, h);
  const acc = new Float32Array(o.thetaBins * o.rhoBins);
  const cos = new Float32Array(o.thetaBins);
  const sin = new Float32Array(o.thetaBins);
  const allowed = new Uint8Array(o.thetaBins);
  for (let t = 0; t < o.thetaBins; t++) {
    const th = (t / o.thetaBins) * Math.PI;
    cos[t] = Math.cos(th);
    sin[t] = Math.sin(th);
    // An orientation can be excluded outright, which is how the second pass
    // stops the strings drowning out the frets: they are simply not looked for.
    // ⚠️ AN ACCEPT BAND, NOT A REJECT BAND. Excluding a window around the string
    // direction is the obvious move and it is not enough: a 300-pixel string
    // smears votes across a wide arc, and just outside the exclusion that smear
    // still outscores a 38-pixel fret. Every slot then fills with string leakage
    // at exactly the exclusion boundary — the giveaway symptom is a fret family
    // whose angles all sit at the edge of the band you excluded. Naming the
    // orientation you DO want removes the whole arc instead of a slice of it.
    let keep = 1;
    if (o.acceptTheta) {
      let d = Math.abs(th - o.acceptTheta.theta);
      if (d > Math.PI / 2) d = Math.PI - d;
      if (d > o.acceptTheta.half) keep = 0;
    }
    allowed[t] = keep;
  }

  const mask = o.mask || null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (mag[idx] < o.edgeThreshold) continue;
      if (mask && !mask[idx]) continue;
      const m = mag[idx];
      // ⚠️ EVERY ORIENTATION IS ACCUMULATED, even the ones no candidate may come
      // from. The local-maximum test below has to see a peak's true neighbours;
      // if the excluded rows were left empty, a rising ridge that is cut off by
      // the accept band would compare itself against zeros and declare itself a
      // maximum. That is why an earlier version kept "finding frets" at exactly
      // 45° and 135° — the edges of the window — rather than at the frets.
      for (let t = 0; t < o.thetaBins; t++) {
        const rb = Math.round(((x * cos[t] + y * sin[t] + diag) / (2 * diag)) * (o.rhoBins - 1));
        if (rb >= 0 && rb < o.rhoBins) acc[t * o.rhoBins + rb] += m;
      }
    }
  }

  // Threshold against the strongest peak AT AN ALLOWED ORIENTATION — using the
  // global maximum would put every fret under a string's shadow again.
  let peak = 0;
  for (let t = 0; t < o.thetaBins; t++) {
    if (!allowed[t]) continue;
    for (let rb = 0; rb < o.rhoBins; rb++) {
      const v = acc[t * o.rhoBins + rb];
      if (v > peak) peak = v;
    }
  }
  if (peak <= 0) return [];

  // ⚠️ LOCAL MAXIMA IN THE ACCUMULATOR, NOT JUST A THRESHOLD. A finite line does
  // not produce a point in Hough space, it produces a butterfly-shaped RIDGE: the
  // same fret wire shows up at θ = 0°, 3°, 5°, 7° with correspondingly shifted ρ,
  // and none of those pairs is close enough in (θ, ρ) for list-level suppression
  // to merge them. One fret then arrives as eight, the spacing sequence is
  // garbage, and identification refuses — while the picture in front of you looks
  // perfectly detected. Requiring a peak to dominate a window along BOTH axes
  // collapses each ridge back to the one line that made it.
  const thetaWin = Math.max(1, Math.round(o.nmsTheta / (Math.PI / o.thetaBins)) * 4);
  const rhoWin = Math.max(1, Math.round((o.nmsRhoFrac * scale) / (2 * diag / (o.rhoBins - 1))));
  const isLocalMax = (t, rb, v) => {
    for (let dt = -thetaWin; dt <= thetaWin; dt++) {
      const tt = t + dt;
      if (tt < 0 || tt >= o.thetaBins) continue;
      for (let dr = -rhoWin; dr <= rhoWin; dr++) {
        const rr = rb + dr;
        if (rr < 0 || rr >= o.rhoBins) continue;
        if (acc[tt * o.rhoBins + rr] > v) return false;
      }
    }
    return true;
  };

  const cand = [];
  for (let t = 0; t < o.thetaBins; t++) {
    if (!allowed[t]) continue;
    for (let rb = 0; rb < o.rhoBins; rb++) {
      const v = acc[t * o.rhoBins + rb];
      if (v < peak * o.peakThreshold) continue;
      if (!isLocalMax(t, rb, v)) continue;
      cand.push({
        theta: (t / o.thetaBins) * Math.PI,
        rho: ((rb / (o.rhoBins - 1)) * 2 * diag - diag) / scale,
        votes: v / peak,
      });
    }
  }
  cand.sort((a, b) => b.votes - a.votes);

  // ⚠️ NON-MAXIMUM SUPPRESSION IS NOT HOUSEKEEPING HERE, IT IS LOAD-BEARING. One
  // fret wire is several pixels thick and lights up a blob of neighbouring cells.
  // Without suppression a single fret arrives as eight "frets" a hair apart, the
  // spacing sequence becomes nonsense, and identification correctly refuses. The
  // symptom reads as "detection doesn't work"; the cause is three lines.
  const kept = [];
  for (const c of cand) {
    if (kept.some(k => sameLine(c, k, o.nmsTheta, o.nmsRhoFrac))) continue;
    kept.push(c);
    if (kept.length >= o.maxLines) break;
  }
  return kept;
}

/** Where two normal-form lines cross, or null if parallel. */
export function lineIntersection(a, b) {
  const det = Math.cos(a.theta) * Math.sin(b.theta) - Math.sin(a.theta) * Math.cos(b.theta);
  if (Math.abs(det) < 1e-9) return null;
  return [
    (a.rho * Math.sin(b.theta) - b.rho * Math.sin(a.theta)) / det,
    (b.rho * Math.cos(a.theta) - a.rho * Math.cos(b.theta)) / det,
  ];
}

/**
 * Split lines into angular families — frets and strings.
 *
 * Angles live on a circle of period π, so they are doubled before averaging and
 * halved after; a family straddling 0/π would otherwise average to the one angle
 * none of its members have.
 */
export function groupByAngle(lines) {
  if (!lines || !lines.length) return [];
  if (lines.length === 1) return [{ theta: lines[0].theta, lines: [...lines] }];

  // ⚠️ TWO-MEANS, NOT GREEDY BUCKETING. The first version grew clusters around
  // whichever line had the most votes, with a fixed angular tolerance. Under
  // perspective the frets fan out and the strings fan out, so with a tolerance
  // wide enough to hold one family together, the running mean drifts and
  // swallows the other one — every line ends up in a single group and detection
  // fails with a perfectly good set of lines in hand. There are exactly two
  // families on a guitar; asking for exactly two is both simpler and correct.
  const v = lines.map(l => [Math.cos(2 * l.theta), Math.sin(2 * l.theta)]);
  let bi = 0;
  let bj = 1;
  let worst = Infinity;
  for (let i = 0; i < v.length; i++) {
    for (let j = i + 1; j < v.length; j++) {
      const d = v[i][0] * v[j][0] + v[i][1] * v[j][1];
      if (d < worst) { worst = d; bi = i; bj = j; }
    }
  }
  let c0 = v[bi];
  let c1 = v[bj];
  const assign = new Array(lines.length).fill(0);
  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < v.length; i++) {
      assign[i] = (v[i][0] * c0[0] + v[i][1] * c0[1]) >= (v[i][0] * c1[0] + v[i][1] * c1[1]) ? 0 : 1;
    }
    const sum = [[0, 0], [0, 0]];
    for (let i = 0; i < v.length; i++) {
      sum[assign[i]][0] += v[i][0];
      sum[assign[i]][1] += v[i][1];
    }
    for (const k of [0, 1]) {
      const m = Math.hypot(sum[k][0], sum[k][1]);
      if (m < 1e-9) continue;
      const c = [sum[k][0] / m, sum[k][1] / m];
      if (k === 0) c0 = c; else c1 = c;
    }
  }
  const buckets = [[], []];
  for (let i = 0; i < lines.length; i++) buckets[assign[i]].push(lines[i]);
  const centres = [c0, c1];
  return [0, 1]
    .filter(k => buckets[k].length)
    .map(k => ({
      theta: ((Math.atan2(centres[k][1], centres[k][0]) / 2) + Math.PI) % Math.PI,
      lines: buckets[k],
    }))
    .sort((a, b) => b.lines.length - a.lines.length);
}

// =============================================================================
// Which frets are these?
// =============================================================================

/** Cross-ratio of four collinear points — the projective invariant. */
export function crossRatio(a, b, c, d) {
  return ((c - a) * (d - b)) / ((c - b) * (d - a));
}

/** Fit t ↦ (m0·t + m1)/(m2·t + 1) by least squares. Three unknowns. */
export function fit1DProjective(src, dst) {
  const n = Math.min(src.length, dst.length);
  if (n < 3) return null;
  const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const b = [0, 0, 0];
  for (let k = 0; k < n; k++) {
    const row = [src[k], 1, -src[k] * dst[k]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) A[i][j] += row[i] * row[j];
      b[i] += row[i] * dst[k];
    }
  }
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    if (Math.abs(A[piv][c]) < 1e-12) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const k = A[r][c] / A[c][c];
      for (let j = c; j < 3; j++) A[r][j] -= k * A[c][j];
      b[r] -= k * b[c];
    }
  }
  const m = [b[0] / A[0][0], b[1] / A[1][1], b[2] / A[2][2]];
  return m.every(Number.isFinite) ? m : null;
}

/** Apply a 1-D projective map. */
export function apply1D(m, t) {
  const den = m[2] * t + 1;
  return Math.abs(den) < 1e-12 ? null : (m[0] * t + m[1]) / den;
}

/**
 * Label observed fret-line positions with actual fret numbers.
 *
 * ⚠️ AN ANCHOR IS REQUIRED AND THE FUNCTION RETURNS NULL WITHOUT ONE. See the
 * module header: sliding along the neck is a projective transformation, so from
 * the line positions alone every labelling fits perfectly and the "best" one is
 * whichever won on floating-point noise. The anchor is one position in the image
 * whose fret number is known by some NON-projective means — the end of the board,
 * or an inlay dot.
 *
 * @param {number[]} positions  1-D coordinates of the fret lines, any units
 * @param {{pos:number, fret:number}} anchor  a position whose fret is known
 * @returns {{frets:number[], map:number[], residual:number, pairs:[]}|null}
 */
export function identifyFrets(positions, opts = {}) {
  const o = { ...DETECT_DEFAULTS, ...opts };
  const anchor = o.anchor;
  if (!anchor || !Number.isFinite(anchor.pos) || !Number.isFinite(anchor.fret)) return null;

  const xs = [...positions].sort((a, b) => a - b);
  const m = xs.length;
  if (m < 4) return null;
  const span = xs[m - 1] - xs[0];
  if (!(span > 0)) return null;
  const tol = span * o.inlierFrac;

  // ⚠️ RANSAC, NOT A FIT TO EVERYTHING. The first version demanded that every
  // detected line land on a fret, which is fine for synthetic input and hopeless
  // for a photograph: one smudge on the board, one bright edge on the headstock,
  // one fret found twice, and the whole labelling is rejected. Real line
  // detection always produces outliers, so the question is not "do all of these
  // fit" but "what is the largest set of them that agrees".
  //
  // The anchor plus two assignments is exactly three correspondences, which
  // determines the 1-D projective map with nothing left over — so each hypothesis
  // is solved outright rather than optimised, and scored by how many OTHER lines
  // it happens to explain.
  const anchorSpan = fretToSpan(anchor.fret);
  let best = null;

  const score = (map) => {
    if (!map) return null;
    const [a, b, c] = map;
    if (Math.abs(a) < 1e-12) return null;
    const inv = [1 / a, -b / a, -c / a];
    const inliers = [];
    const frets = [];
    const used = new Set();
    for (const x of xs) {
      const t = apply1D(inv, x);
      if (t == null) continue;
      const f = Math.round(spanToFret(t));
      if (f < 0 || f > o.highestFret || used.has(f)) continue;
      const predicted = apply1D(map, fretToSpan(f));
      if (predicted == null || Math.abs(predicted - x) > tol) continue;
      used.add(f);
      inliers.push(x);
      frets.push(f);
    }
    if (inliers.length < o.minInliers) return null;
    const numeric = [...frets].sort((a, b) => a - b);
    const spread = numeric[numeric.length - 1] - numeric[0] + 1;
    if (spread / numeric.length > o.maxSkipRatio) return null;
    // Refit on the inliers only, so the answer is not hostage to the three
    // points that happened to seed it.
    const refit = fit1DProjective([...frets.map(fretToSpan), anchorSpan],
      [...inliers, anchor.pos]);
    if (!refit) return null;
    let sum = 0;
    for (let i = 0; i < frets.length; i++) {
      const p = apply1D(refit, fretToSpan(frets[i]));
      if (p == null) return null;
      sum += (p - inliers[i]) ** 2;
    }
    return {
      frets, map: refit, inliers,
      residual: Math.sqrt(sum / frets.length) / span,
    };
  };

  const better = (candidate) => {
    if (!candidate) return;
    if (candidate.residual > o.maxFitResidual) return;
    if (!best
      || candidate.frets.length > best.frets.length
      || (candidate.frets.length === best.frets.length && candidate.residual < best.residual)) {
      best = candidate;
    }
  };

  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      for (let fa = 0; fa <= o.highestFret; fa++) {
        for (let fb = fa + 1; fb <= o.highestFret; fb++) {
          // Both directions, because reversal is a legal projective view.
          better(score(fit1DProjective(
            [anchorSpan, fretToSpan(fa), fretToSpan(fb)], [anchor.pos, xs[i], xs[j]])));
          better(score(fit1DProjective(
            [anchorSpan, fretToSpan(fb), fretToSpan(fa)], [anchor.pos, xs[i], xs[j]])));
        }
      }
    }
  }

  if (!best) return null;
  return {
    frets: best.frets,
    map: best.map,
    residual: best.residual,
    inliers: best.inliers.length,
    total: m,
    pairs: best.frets.map((f, i) => ({ fret: f, pos: best.inliers[i] })),
  };
}

// =============================================================================
// The whole thing
// =============================================================================

/** Mean brightness over a quadrilateral, sampled on a grid. */
export function sampleQuadMean(gray, w, h, quad, n = 9) {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const u = (i + 0.5) / n;
      const v = (j + 0.5) / n;
      // Bilinear across the quad's corners.
      const top = [
        quad[0][0] + (quad[1][0] - quad[0][0]) * u,
        quad[0][1] + (quad[1][1] - quad[0][1]) * u,
      ];
      const bot = [
        quad[3][0] + (quad[2][0] - quad[3][0]) * u,
        quad[3][1] + (quad[2][1] - quad[3][1]) * u,
      ];
      const x = Math.round(top[0] + (bot[0] - top[0]) * v);
      const y = Math.round(top[1] + (bot[1] - top[1]) * v);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      sum += gray[y * w + x];
      count++;
    }
  }
  return count ? { mean: sum / count, coverage: count / (n * n) } : null;
}

/**
 * Is the outermost fret line the END of the board — i.e. the nut?
 *
 * Compares the strip just INSIDE it against the strip just BEYOND it. Past the
 * nut is headstock, hand or background; past an interior fret is more fretboard,
 * which looks like the fretboard because it is.
 *
 * ⚠️ THIS IS THE ONLY THING STOPPING THE WHOLE DETECTOR BEING OFF BY N FRETS,
 * and it is an image-statistics test rather than a geometric one — precisely
 * because no geometric test can exist. If it is unsure, it says so and the
 * detector declines rather than shipping a confident guess.
 */
export function looksLikeBoardEnd(gray, w, h, edgeA, edgeB, nextA, nextB, opts = {}) {
  const o = { ...DETECT_DEFAULTS, ...opts };
  const inside = sampleQuadMean(gray, w, h, [edgeA, edgeB, nextB, nextA]);
  // Reflect the neighbouring fret through the outermost one to get "beyond".
  const beyondA = [2 * edgeA[0] - nextA[0], 2 * edgeA[1] - nextA[1]];
  const beyondB = [2 * edgeB[0] - nextB[0], 2 * edgeB[1] - nextB[1]];
  const beyond = sampleQuadMean(gray, w, h, [edgeA, edgeB, beyondB, beyondA]);
  if (!inside || !beyond || beyond.coverage < 0.5) return null;
  const diff = Math.abs(inside.mean - beyond.mean);
  return { isEnd: diff > o.nutContrast, diff, inside: inside.mean, beyond: beyond.mean };
}

/**
 * Keep only the strongest line in each bin along the neck axis.
 *
 * ⚠️ THINNING BY POSITION, NOT BY VOTES, AND THE DIFFERENCE IS THE WHOLE
 * DETECTOR. Ranking lines by Hough votes and keeping the top N throws away the
 * outermost frets first, because a fret near the edge of the frame is
 * foreshortened and casts fewer votes than one in the middle — so a vote-ranked
 * cap deletes the nut and keeps three copies of fret 7. Binning along the neck
 * gives every REGION one representative, which is what identification actually
 * wants: duplicates are what should go, extremities are what must stay.
 *
 * @param {{t:number, line?:{votes:number}}[]} hits  sorted by `t`
 */
export function thinByPosition(hits, bins) {
  if (!hits || hits.length <= bins || bins < 2) return [...(hits || [])];
  const lo = hits[0].t;
  const hi = hits[hits.length - 1].t;
  const span = hi - lo;
  if (!(span > 0)) return [...hits];
  const votesOf = x => (x.line && x.line.votes) || x.votes || 0;
  const best = new Map();
  for (const x of hits) {
    const b = Math.min(bins - 1, Math.floor(((x.t - lo) / span) * bins));
    const cur = best.get(b);
    if (!cur || votesOf(x) > votesOf(cur)) best.set(b, x);
  }
  const kept = new Set(best.values());
  // ⚠️ THE TWO EXTREMES ARE KEPT UNCONDITIONALLY, AND THIS IS NOT A FLOURISH.
  // Binning is half-open, so the very last position clamps into the same bin as
  // its neighbour and then loses to it on votes — which is the one line that
  // must never be dropped, because an edge fret is weak precisely BECAUSE it is
  // at the edge, and the edge is where the nut is. Thinning that can discard an
  // endpoint is thinning that recreates the bug it exists to fix.
  kept.add(hits[0]);
  kept.add(hits[hits.length - 1]);
  return [...kept].sort((a, b) => a.t - b.t);
}

/**
 * Do two labellings say the same thing about the lines they share?
 *
 * ⚠️ THE ONLY CHECK THAT CATCHES A WRONG ANCHOR. Anchoring on the wrong end of
 * the board produces a REVERSED labelling that fits just as well — the module
 * header explains why no geometric test can rule it out, and it was observed on
 * the bench scoring a residual of 0.0033 while being wrong by twenty frets. What
 * gives it away is that it CONTRADICTS the labelling anchored at the real nut.
 * So rival anchors are not scored against each other, they are asked whether
 * they agree; when they do not, the detector declines.
 */
export function labellingsAgree(a, b, tol) {
  let shared = 0;
  for (const pa of a.pairs) {
    for (const pb of b.pairs) {
      if (Math.abs(pa.pos - pb.pos) > tol) continue;
      shared++;
      if (pa.fret !== pb.fret) return false;
      break;
    }
  }
  // No overlap at all is not agreement, it is two unrelated answers.
  return shared >= 3;
}

/**
 * Find the neck in a grayscale frame.
 *
 * ⚠️ THREE COORDINATE SPACES MEET IN THIS FUNCTION AND MIXING THEM IS SILENT.
 * This was the actual reason the detector returned null for so long, and it did
 * not look like a units bug from the outside — it looked like the nut test never
 * firing:
 *
 *   1. HOUGH space — `lineIntersection` inherits ρ's normalisation, which is
 *      ISOTROPIC, by `max(w, h)` on both axes. `t`, and every `hit.a`/`hit.b`,
 *      live here.
 *   2. PIXEL space — what `gray[y * w + x]` is indexed by, and therefore what
 *      `looksLikeBoardEnd` needs. Handing it Hough-space points sampled pixel
 *      (0, 0) for BOTH the inside and the beyond strip, so `diff` was exactly
 *      0.000 at every candidate and `isEnd` could never be true. No amount of
 *      trying more candidate lines could have fixed that.
 *   3. FRAME space — `[x / w, y / h]`, ANISOTROPIC, which is what MediaPipe
 *      reports landmarks in and what `CameraCalibrator` collects clicks in. The
 *      returned corners must be in this one to be a drop-in for four clicks.
 *
 * @returns {{corners, calibration, frets, confidence, ...}|null}
 */
export function detectNeck(gray, w, h, opts = {}) {
  const o = { ...DETECT_DEFAULTS, ...opts };
  const mag = sobel(gray, w, h);
  // Hough space → pixels, and Hough space → the frame space the callers use.
  const houghScale = Math.max(w, h);
  const toPixel = p => [p[0] * houghScale, p[1] * houghScale];
  const toFrame = p => [(p[0] * houghScale) / w, (p[1] * houghScale) / h];

  // ── PASS 1: the strings and the board edges ──
  const strong = houghLines(mag, w, h, {
    ...o, peakThreshold: o.stringPeakThreshold, maxLines: o.maxStringLines,
  });
  if (strong.length < o.minStringLines) return null;
  const families = groupByAngle(strong);
  const stringGroup = families[0];
  if (!stringGroup || stringGroup.lines.length < o.minStringLines) return null;

  const outer = outermost(stringGroup.lines, o);
  if (!outer) return null;

  // ── The board band ──
  // Everything between the two outermost long lines, plus a margin. Restricting
  // the second pass to this mask throws away the table edge, the window frame and
  // the pattern on the sofa before they ever reach the accumulator.
  const mask = bandMask(w, h, outer[0], outer[1], o.bandMargin * Math.max(w, h));
  if (!mask) return null;

  // ⚠️ AND THEN ERASE THE STRINGS THEMSELVES. Restricting pass 2 to orientations
  // near perpendicular is still not enough on its own: a 300-pixel string smears
  // votes across a wide arc, and even 45° away that smear matches a 38-pixel fret.
  // The tell is a "fret family" whose angles all sit exactly at the edge of
  // whatever angular window you chose — the window is not finding frets, it is
  // clipping a string. Deleting the pixels removes the smear at its source, and
  // costs each fret only the six pixels where a string crosses it.
  suppressLines(mask, w, h, stringGroup.lines, o.stringSuppressPx);

  // ── PASS 2: the frets, inside the board, at other orientations ──
  const fretLines = houghLines(mag, w, h, {
    ...o,
    mask,
    maxLines: o.maxFretLines,
    acceptTheta: {
      theta: (stringGroup.theta + Math.PI / 2) % Math.PI,
      half: o.fretAcceptHalfWidth,
    },
  });
  if (fretLines.length < o.minFretLines) return null;

  // Fret positions along the neck axis.
  const axis = { theta: stringGroup.theta, rho: meanRho(stringGroup.lines) };
  const dir = [Math.sin(axis.theta), -Math.cos(axis.theta)];
  const hits = [];
  for (const fl of fretLines) {
    const p = lineIntersection(fl, axis);
    const a = lineIntersection(fl, outer[0]);
    const b = lineIntersection(fl, outer[1]);
    if (p && a && b) hits.push({ line: fl, a, b, t: p[0] * dir[0] + p[1] * dir[1] });
  }
  if (hits.length < o.minFretLines) return null;
  hits.sort((x, y) => x.t - y.t);
  const frets = thinByPosition(mergeNearby(hits, o.mergeGapFrac), o.positionBins);
  if (frets.length < o.minFretLines) return null;

  // ── Find the nut ──
  // Which end has the wider spacing is a hint, not proof — reversal is a legal
  // projective view — so BOTH ends are offered to the picture and it decides.
  //
  // ⚠️ AND SEVERAL LINES IN FROM EACH END, NOT JUST THE EXTREME ONE. The
  // outermost detection is frequently a stray — a shadow past the nut, the edge
  // of the board where it leaves frame — and testing only it means the real nut,
  // sitting one or two places inside, is never asked.
  const positions = frets.map(x => x.t);
  const posTol = (positions[positions.length - 1] - positions[0]) * o.inlierFrac;
  const candidates = [];
  for (const nutFirst of [true, false]) {
    for (let k = 0; k < o.maxNutCandidates; k++) {
      const i = nutFirst ? k : frets.length - 1 - k;
      const j = nutFirst ? i + 1 : i - 1;
      if (i < 0 || i >= frets.length || j < 0 || j >= frets.length) continue;
      const edge = frets[i];
      const next = frets[j];
      const end = looksLikeBoardEnd(gray, w, h,
        toPixel(edge.a), toPixel(edge.b), toPixel(next.a), toPixel(next.b), o);
      if (!end || !end.isEnd) continue;    // cannot anchor ⇒ will not guess

      const ident = identifyFrets(positions, { ...o, anchor: { pos: edge.t, fret: 0 } });
      if (!ident) continue;
      candidates.push({ ident, end });
    }
  }
  if (!candidates.length) return null;

  // Most lines explained wins, residual breaks ties.
  candidates.sort((a, b) =>
    b.ident.inliers - a.ident.inliers || a.ident.residual - b.ident.residual);

  // ⚠️ A RIVAL THAT DISAGREES IS A VETO, NOT A RUNNER-UP. See `labellingsAgree`:
  // a wrong anchor yields a confident, well-fitting, completely wrong answer, and
  // contradiction is the only signal that separates it from a right one. A false
  // negative here costs a button press; a false positive silently shifts every
  // fret the player is shown.
  const top = candidates[0];
  for (const rival of candidates.slice(1)) {
    if (rival.ident.inliers < top.ident.inliers - o.rivalInlierSlack) continue;
    if (!labellingsAgree(top.ident, rival.ident, posTol)) return null;
  }

  {
    const ident = top.ident;
    const end = top.end;

    // ⚠️ PAIR BY POSITION, NEVER BY INDEX. `ident.frets` lists only the INLIERS,
    // while `frets` holds every surviving line, so walking the two together with
    // one counter reads fret numbers off the end of the shorter array and hands
    // the homography `undefined` — a NaN fit, or worse a partial one. Each label
    // carries the position it was measured at, so the line it belongs to is
    // looked up rather than assumed.
    const byPos = (pos) => {
      let best = null;
      let bestD = Infinity;
      for (const hit of frets) {
        const d = Math.abs(hit.t - pos);
        if (d < bestD) { bestD = d; best = hit; }
      }
      return bestD <= posTol ? best : null;
    };

    // ⚠️ THE OUTER LINES MAY BE THE BOARD EDGES RATHER THAN THE OUTER STRINGS,
    // and they are mapped to strings 0 and 5 regardless. That puts the STRING
    // coordinate out by a fraction of a string — which is untrusted anyway, and
    // an order of magnitude smaller than the finger-height parallax already
    // documented in neckGeometry.js. The FRET coordinate, which is the one that
    // matters, comes from the fret lines and is completely unaffected.
    const src = [];
    const dst = [];
    for (const pair of ident.pairs) {
      const hit = byPos(pair.pos);
      if (!hit) continue;
      src.push(toFrame(hit.a), toFrame(hit.b));
      dst.push([fretToSpan(pair.fret), 0], [fretToSpan(pair.fret), NECK_STRINGS - 1]);
    }
    if (src.length < 6) return null;

    const fit = solveHomographyLS(src, dst);
    const inv = solveHomographyLS(dst, src);
    if (!fit || !inv) return null;

    // Corners come from the fit, not from any detected line, so a fret that was
    // never visible is still placed correctly by the ones that were.
    const corners = CORNER_TARGETS.map(t => applyHomography(inv.h, t));
    if (corners.some(c => !c || !c.every(Number.isFinite))) return null;

    return {
      corners,
      calibration: makeNeckCalibration(corners),
      frets: ident.frets,
      residual: ident.residual,
      fitResidual: fit.residual,
      nutContrast: end.diff,
      fretLines: frets.length,
      stringLines: stringGroup.lines.length,
      // ⚠️ CONFIDENCE IS BUILT FROM THE THINGS THAT CAN BE WRONG, not from how
      // bright the edges were. Votes measure contrast; these measure whether the
      // thing found behaves like a fretboard.
      confidence: confidenceOf(ident, fit, ident.frets.length, end, o),
    };
  }
}

/**
 * Collapse detections that are really the same fret seen more than once.
 *
 * ⚠️ THE TOLERANCE IS DERIVED FROM THE DATA, NOT FIXED. A fret gap in image units
 * depends on how far away the guitar is and how much of the neck is in shot, so a
 * constant would be wrong for every camera but one. The 75th-percentile gap is a
 * robust estimate of "one fret" even when most of the gaps in the list are
 * duplicate-sized: duplicates cluster at the bottom of the distribution and
 * cannot drag the upper quartile.
 */
export function mergeNearby(hits, frac = 0.3) {
  if (hits.length < 2) return [...hits];
  const gaps = [];
  for (let i = 1; i < hits.length; i++) gaps.push(hits[i].t - hits[i - 1].t);
  const sorted = [...gaps].sort((a, b) => a - b);
  const typical = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.75))];
  const tol = typical * frac;

  const out = [];
  let cluster = [hits[0]];
  const flush = () => {
    // Keep the strongest member rather than an average: its endpoints are a real
    // measured intersection, and averaging two lines gives a line through
    // neither of them.
    const votes = x => (x.line && x.line.votes) || x.votes || 0;
    out.push(cluster.reduce((a, b) => (votes(b) > votes(a) ? b : a)));
  };
  for (let i = 1; i < hits.length; i++) {
    if (hits[i].t - cluster[cluster.length - 1].t <= tol) cluster.push(hits[i]);
    else { flush(); cluster = [hits[i]]; }
  }
  flush();
  return out;
}

/** Zero out mask pixels within `radius` of any of these lines, in place. */
export function suppressLines(mask, w, h, lines, radius) {
  const scale = Math.max(w, h);
  const geo = lines.map(l => ({
    c: Math.cos(l.theta), s: Math.sin(l.theta), r: l.rho * scale,
  }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      for (const g of geo) {
        if (Math.abs(x * g.c + y * g.s - g.r) <= radius) { mask[i] = 0; break; }
      }
    }
  }
  return mask;
}

/** Pixels lying between two lines, with a margin. */
export function bandMask(w, h, l0, l1, margin) {
  const c0 = Math.cos(l0.theta);
  const s0 = Math.sin(l0.theta);
  const c1 = Math.cos(l1.theta);
  const s1 = Math.sin(l1.theta);
  const scale = Math.max(w, h);
  const r0 = l0.rho * scale;
  const r1 = l1.rho * scale;
  const mask = new Uint8Array(w * h);
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d0 = x * c0 + y * s0 - r0;
      const d1 = x * c1 + y * s1 - r1;
      // Between the two lines, or within `margin` of either — the margin matters
      // because the outermost detected line is usually the board edge and the nut
      // corner sits a hair outside it.
      if (d0 * d1 <= 0 || Math.abs(d0) < margin || Math.abs(d1) < margin) {
        mask[y * w + x] = 1;
        count++;
      }
    }
  }
  return count > 40 ? mask : null;
}

function meanRho(lines) {
  let s = 0;
  for (const l of lines) s += l.rho;
  return s / lines.length;
}

/** The two lines furthest apart in offset — the edges of the string family. */
function outermost(lines, o) {
  if (lines.length < o.minStringLines) return null;
  const sorted = [...lines].sort((a, b) => a.rho - b.rho);
  const a = sorted[0];
  const b = sorted[sorted.length - 1];
  return Math.abs(a.rho - b.rho) < 1e-6 ? null : [a, b];
}

function confidenceOf(ident, fit, nFrets, end, o) {
  const label = Math.max(0, 1 - ident.residual / o.maxFitResidual);
  const geom = Math.max(0, 1 - fit.residual / 0.05);
  const evidence = Math.min(1, (nFrets - 3) / 7);
  // How decisively the nut test came out. A marginal call here is the one that
  // shifts every fret number at once, so it is weighted like the others.
  const anchor = Math.min(1, end.diff / (o.nutContrast * 2.5));
  return Math.max(0, Math.min(1,
    label * 0.25 + geom * 0.25 + evidence * 0.2 + anchor * 0.3));
}
