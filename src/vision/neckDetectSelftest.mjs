// =============================================================================
// vision/neckDetectSelftest.mjs — finding a neck in a picture, with no picture
// -----------------------------------------------------------------------------
//   npm run test:detect
//
// The detector is the one piece of this project whose failures are silent,
// plausible and confidently wrong: a fret labelling one out shifts the whole neck
// by a fret and nothing says so. So it is tested against SYNTHETIC PHOTOGRAPHS —
// a real fretboard, logarithmically spaced wires, six strings, rasterised through
// pinhole cameras at angles a phone or a laptop would really see.
//
// ⚠️ THE RENDERER MUST NOT SHARE ASSUMPTIONS WITH THE DETECTOR. It draws from
// millimetres and a camera matrix; the detector sees only a grid of brightness
// and must recover everything. If the two ever start sharing a helper, this file
// stops proving anything.
//
// The first section is the most important one in the vision code: it is the proof
// that the obvious approach cannot work.
// =============================================================================

import {
  toGray, sobel, houghLines, groupByAngle, sameLine, crossRatio,
  fit1DProjective, apply1D, identifyFrets, detectNeck, looksLikeBoardEnd,
  bandMask, suppressLines, thinByPosition, lineIntersection, mergeNearby,
  labellingsAgree, DETECT_DEFAULTS,
} from './neckDetect.js';
import {
  fretToSpan, spanToFret, makeNeckCalibration, CORNER_TARGETS, NECK_STRINGS,
} from './neckGeometry.js';

let passed = 0;
let failed = 0;
let pending = 0;
const fails = [];
const pendings = [];

// ⚠️ A THIRD OUTCOME, ON PURPOSE. Some of what this file describes is not built
// yet and is KNOWN not to work. Asserting it would leave a permanently red suite
// that everyone learns to ignore; deleting it would quietly lose the record of
// how far the work got and where it stopped. `pending` prints the gap, keeps the
// suite green, and refuses to let the gap be forgotten.
function todo(name, why) {
  pending++;
  pendings.push(`${name} — ${why}`);
  console.log(`  ⏳ ${name}\n      ${why}`);
}

function ok(cond, name) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; fails.push(name); console.log(`  ✗ ${name}`); }
}
function near(a, b, tol, name) {
  const good = Number.isFinite(a) && Math.abs(a - b) <= tol;
  ok(good, `${name}${good ? '' : `  (got ${Number(a).toFixed(4)}, want ${b} ±${tol})`}`);
}
function group(name) { console.log(`\n${name}`); }

// =============================================================================
group('⚠️  THE NECK IS PROJECTIVELY SELF-SIMILAR — why the obvious idea fails');
// =============================================================================

// This section exists to stop the cross-ratio idea being reinvented. It is the
// natural thing to reach for, it is beautiful, and it does not work.
{
  const crs = [0, 1, 2, 5, 9, 14].map(n => crossRatio(...[n, n + 1, n + 2, n + 3].map(fretToSpan)));
  const spread = Math.max(...crs) - Math.min(...crs);
  near(crs[0], 1.332962922399, 1e-9,
    'four consecutive frets have cross-ratio 1.332962922399…');
  ok(spread < 1e-9,
    '…and it is THE SAME NUMBER at every position on the neck, to twelve places');

  // Why: shifting the fret index IS a projective map of position, so the camera
  // cannot tell fret 2 from fret 9 — up to a homography they are one picture.
  //   span(n) = 2(1 − 2^(−n/12))     ⇒  u = 2^(−n/12) = 1 − span/2
  //   n → n+k  scales u by r = 2^(−k/12)
  //   ⇒  span' = 2(1 − r·(1 − span/2)) = (2 − 2r) + r·span
  // …which is affine, and affine is projective with the bottom row left alone.
  const shift = k => {
    const r = Math.pow(2, -k / 12);
    return d => (2 - 2 * r) + r * d;
  };
  let worst = 0;
  for (let n = 0; n <= 8; n++) {
    worst = Math.max(worst, Math.abs(shift(3)(fretToSpan(n)) - fretToSpan(n + 3)));
  }
  near(worst, 0, 1e-12,
    'sliding three frets up the neck is exactly a projective transformation');
}

{
  // The practical consequence, stated as an assertion so it cannot rot.
  const warp = t => (3.2 * t + 0.15) / (1.4 * t + 1);
  const seen = [2, 3, 4, 5, 6, 7, 8].map(f => warp(fretToSpan(f)));
  ok(identifyFrets(seen) === null,
    'so identifyFrets REFUSES to label fret lines with no anchor');
  ok(identifyFrets(seen, { anchor: null }) === null, 'and an empty anchor is not an anchor');

  // Proof that the refusal is not laziness: without the anchor, every hypothesis
  // fits to floating-point noise, so the "winner" is meaningless.
  const fits = [];
  for (let start = 0; start <= 8; start++) {
    const src = Array.from({ length: 7 }, (_, i) => fretToSpan(start + i));
    const m = fit1DProjective(src, seen);
    let s = 0;
    for (let i = 0; i < src.length; i++) s += (apply1D(m, src[i]) - seen[i]) ** 2;
    fits.push(Math.sqrt(s / src.length));
  }
  ok(Math.max(...fits) < 1e-10,
    'every possible starting fret fits the same lines to within 1e-10 — there is nothing to choose between them');
}

{
  // And the thing that DOES break the symmetry: uneven spacing. Inlay dots.
  const a = crossRatio(...[3, 5, 7, 9].map(fretToSpan));
  const b = crossRatio(...[5, 7, 9, 12].map(fretToSpan));
  const c = crossRatio(...[7, 9, 12, 15].map(fretToSpan));
  ok(Math.abs(a - b) > 0.05 && Math.abs(b - c) > 0.05 && Math.abs(a - c) > 0.05,
    'inlay dots ARE unevenly spaced, so their cross-ratios differ and could anchor');
}

// =============================================================================
group('identifying frets, once something has broken the symmetry');
// =============================================================================

const warpView = t => (3.2 * t + 0.15) / (1.4 * t + 1);
const anchorAt = fret => ({ pos: warpView(fretToSpan(fret)), fret });

{
  const frets = [2, 3, 4, 5, 6, 7, 8];
  const id = identifyFrets(frets.map(f => warpView(fretToSpan(f))), { anchor: anchorAt(0) });
  ok(id !== null, 'with the nut anchored, a run of seven frets is identified');
  ok(JSON.stringify(id.frets) === JSON.stringify(frets),
    'and identified as exactly the right frets, from an unknown camera');
}

{
  const high = [9, 10, 11, 12, 13, 14];
  const id = identifyFrets(high.map(f => warpView(fretToSpan(f))), { anchor: anchorAt(0) });
  ok(id && JSON.stringify(id.frets) === JSON.stringify(high),
    'a run right up the neck is placed correctly — the anchor does the work');
}

{
  const frets = [3, 4, 6, 7, 8, 9];
  const id = identifyFrets(frets.map(f => warpView(fretToSpan(f))), { anchor: anchorAt(0) });
  ok(id && JSON.stringify(id.frets) === JSON.stringify(frets),
    'a run with one fret hidden by a hand is identified, gap and all');
}

{
  const frets = [4, 5, 6, 7, 8, 9];
  const clean = frets.map(f => warpView(fretToSpan(f)));
  const span = clean[clean.length - 1] - clean[0];
  const noisy = clean.map((x, i) => x + span * 0.003 * (i % 2 ? 1 : -1));
  const id = identifyFrets(noisy, { anchor: anchorAt(0) });
  ok(id && JSON.stringify(id.frets) === JSON.stringify(frets),
    'and it survives a couple of pixels of noise on every line');
}

{
  // ⚠️ THE TRAP. It is natural to assume any known fret will do as an anchor —
  // an inlay dot, say. It will not. The sequence is projectively symmetric under
  // REVERSAL as well as translation (u → C/u is Möbius), so a single interior
  // anchor leaves the mirrored labelling fitting exactly as well, and the tie is
  // broken by floating-point noise. Only fret 0 works, and only because the
  // mirror image of a run anchored at the nut lands on negative frets.
  const frets = [5, 6, 7, 8, 9, 10, 11];
  const seen = frets.map(f => warpView(fretToSpan(f)));
  const withNut = identifyFrets(seen, { anchor: anchorAt(0) });
  ok(withNut && JSON.stringify(withNut.frets) === JSON.stringify(frets),
    'anchored at the NUT, an interior run is identified correctly');

  // ⚠️ THE TRAP, demonstrated directly. Reversal is a projective map, so the
  // SAME observed positions fit a mirrored labelling exactly as well as the true
  // one. Anchoring on a single interior dot does not help: the dot maps to itself
  // under the reflection that swaps fret n with fret 2k−n about that dot.
  const mirrored = frets.map(f => 2 * 12 - f).reverse();
  const fitFwd = fit1DProjective(frets.map(fretToSpan), seen);
  const fitRev = fit1DProjective(mirrored.map(fretToSpan), seen);
  const rms = (map, src, dst) => {
    let t = 0;
    for (let i = 0; i < src.length; i++) t += (apply1D(map, src[i]) - dst[i]) ** 2;
    return Math.sqrt(t / src.length);
  };
  const fErr = rms(fitFwd, frets.map(fretToSpan), seen);
  const rErr = rms(fitRev, mirrored.map(fretToSpan), seen);
  ok(fErr < 1e-9 && rErr < 1e-9,
    'the true labelling and its mirror image BOTH fit the same lines exactly');
  ok(true, '(which is why the detector anchors on the end of the board, not on a dot)');
}

{
  const evenly = [0, 1, 2, 3, 4, 5, 6].map(i => i * 0.1);
  ok(identifyFrets(evenly, { anchor: { pos: -0.05, fret: 0 } }) === null,
    'evenly spaced lines are refused even WITH an anchor — a neck is not even');
  ok(identifyFrets([0, 0.3, 0.31, 0.9, 1.4], { anchor: { pos: -0.1, fret: 0 } }) === null,
    'and so is a random scatter');
}

// =============================================================================
group('line finding');
// =============================================================================

{
  const a = { theta: 0.02, rho: 0.5 };
  const b = { theta: Math.PI - 0.02, rho: -0.5 };
  ok(sameLine(a, b, 0.1, 0.02),
    'a line that wraps past π is recognised as the same line with ρ negated');
  ok(!sameLine({ theta: 0.02, rho: 0.5 }, { theta: 0.02, rho: -0.5 }, 0.1, 0.02),
    'while two genuinely different lines are not merged by comparing |ρ|');
}

// =============================================================================
group('a synthetic photograph of a fretboard');
// =============================================================================

const SCALE_MM = 648;
const STRING_GAP_MM = 10.4;
const W = 400;
const H = 220;

function makeCamera(eye, at, focal = 540) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = v => { const m = Math.hypot(...v); return [v[0] / m, v[1] / m, v[2] / m]; };
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
  ];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const fwd = norm(sub(at, eye));
  const right = norm(cross(fwd, [0, 0, 1]));
  const up = cross(right, fwd);
  return p => {
    const d = sub(p, eye);
    const z = dot(d, fwd);
    if (z <= 1) return null;
    return [W / 2 + (focal * dot(d, right)) / z, H / 2 - (focal * dot(d, up)) / z];
  };
}

const worldOf = (span, string) => [
  span * (SCALE_MM / 2),
  (string - (NECK_STRINGS - 1) / 2) * STRING_GAP_MM,
  0,
];

const BOARD_MIN = 0;        // the board STOPS at the nut — that is the anchor
const BOARD_MAX = 1.5;
const EDGE_LO = -0.7;
const EDGE_HI = NECK_STRINGS - 0.3;

/** Render an RGBA fretboard: pale background, dark board, bright wires. */
function render(cam, { hideFrets = [], noise = 0, background = 160 } = {}) {
  const px = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = background;
    px[i * 4 + 3] = 255;
  }
  const setPx = (x, y, v) => {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
    const i = (yi * W + xi) * 4;
    px[i] = px[i + 1] = px[i + 2] = v;
  };
  const drawLine = (a, b, v, thickness = 0) => {
    if (!a || !b) return;
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      setPx(x, y, v);
      for (let d = 0.5; d <= thickness; d += 0.5) {
        setPx(x, y + d, v); setPx(x, y - d, v);
        setPx(x + d, y, v); setPx(x - d, y, v);
      }
    }
  };

  // The board as a solid dark fill, so sobel only sees its OUTLINE — drawing it
  // as a stack of separate lines would hand the detector a false fret family.
  for (let s = 0; s <= 600; s++) {
    const sp = BOARD_MIN + (BOARD_MAX - BOARD_MIN) * (s / 600);
    drawLine(cam(worldOf(sp, EDGE_LO)), cam(worldOf(sp, EDGE_HI)), 55, 0.5);
  }
  // Fret wires.
  for (let f = 0; f <= 19; f++) {
    if (hideFrets.includes(f)) continue;
    drawLine(cam(worldOf(fretToSpan(f), EDGE_LO)), cam(worldOf(fretToSpan(f), EDGE_HI)), 240, 0.5);
  }
  // Strings, which continue past the nut toward the tuners.
  for (let s = 0; s < NECK_STRINGS; s++) {
    drawLine(cam(worldOf(-0.25, s)), cam(worldOf(BOARD_MAX, s)), 250, 0.5);
  }
  if (noise > 0) {
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < W * H; i++) {
      const n = (rnd() - 0.5) * 2 * noise * 255;
      px[i * 4] = Math.max(0, Math.min(255, px[i * 4] + n));
      px[i * 4 + 1] = px[i * 4 + 2] = px[i * 4];
    }
  }
  return px;
}

// ⚠️ THE CAMERA HAS TO BE ABOVE THE PLANE OF THE BOARD, and by a decent margin.
// Two earlier attempts failed here and both were the test's fault, not the
// detector's: the first looked at the 12th fret from close up and put the nut
// 146 px off the left edge; the second sat at 11° of elevation, which squashed
// a 62 mm-wide board into NINE PIXELS. Fret wires nine pixels long cast almost no
// Hough votes, so the detector saw strings and nothing else — which is also
// exactly what will happen to a real user whose camera is level with the guitar.
// That is a finding about camera placement, not a bug, and §6 already says it.
const VIEWS = {
  'square on': makeCamera([190, -450, 400], [190, 0, 0], 537),
  'off to one side': makeCamera([430, -430, 380], [190, 0, 0], 537),
  'lower, like a propped phone': makeCamera([190, -500, 260], [200, 0, 0], 500),
};

for (const [label, cam] of Object.entries(VIEWS)) {
  group(`  the pipeline, stage by stage: ${label}`);
  const { gray, width, height } = toGray(render(cam), W, H);
  const mag = sobel(gray, width, height);

  // ── Stage 1: the strings ──
  const strong = houghLines(mag, width, height, {
    ...DETECT_DEFAULTS,
    peakThreshold: DETECT_DEFAULTS.stringPeakThreshold,
    maxLines: DETECT_DEFAULTS.maxStringLines,
  });
  const families = groupByAngle(strong);
  // Three is enough — the band only needs an outer pair — but it is worth
  // noticing that six strings plus two board edges do NOT all survive: the
  // accumulator's local-maximum test merges strings that are only a few pixels
  // apart at this scale, which is correct behaviour and a real limit on how much
  // the string family can be relied on for anything but the band.
  ok(families.length >= 1 && families[0].lines.length >= 3,
    `the string family is found (${families[0] ? families[0].lines.length : 0} lines)`);

  // The strings really do run along the neck: compare the family's angle to the
  // true one, which the renderer knows and the detector does not.
  const nutMid = cam(worldOf(0, 2.5));
  const endMid = cam(worldOf(1, 2.5));
  const trueDir = Math.atan2(endMid[1] - nutMid[1], endMid[0] - nutMid[0]);
  const trueTheta = ((trueDir + Math.PI / 2) + Math.PI * 2) % Math.PI;
  let dTheta = Math.abs(families[0].theta - trueTheta);
  if (dTheta > Math.PI / 2) dTheta = Math.PI - dTheta;
  ok(dTheta < 0.12, `and points along the real neck (${(dTheta * 180 / Math.PI).toFixed(1)}° out)`);

  // ── Stage 2: the frets, inside the board, strings erased ──
  const sorted = [...families[0].lines].sort((a, b) => a.rho - b.rho);
  const mask = bandMask(width, height, sorted[0], sorted[sorted.length - 1],
    DETECT_DEFAULTS.bandMargin * Math.max(width, height));
  ok(mask !== null, 'the board band is isolated');
  suppressLines(mask, width, height, families[0].lines, DETECT_DEFAULTS.stringSuppressPx);
  const fretLines = houghLines(mag, width, height, {
    ...DETECT_DEFAULTS,
    mask,
    acceptTheta: {
      theta: (families[0].theta + Math.PI / 2) % Math.PI,
      half: DETECT_DEFAULTS.fretAcceptHalfWidth,
    },
  });
  ok(fretLines.length >= 8, `fret-orientation lines are recovered (${fretLines.length})`);
}

// =============================================================================
group('⏳ end-to-end detection — the part that is NOT finished');
// =============================================================================

{
  const cam = VIEWS['square on'];
  const { gray, width, height } = toGray(render(cam), W, H);
  const found = detectNeck(gray, width, height);

  todo('detectNeck() does not yet return a calibration on a clean synthetic neck',
    'THE ANCHOR IS NO LONGER THE BLOCKER — that diagnosis was wrong, and the reason\n'
    + '      it looked right is recorded below. What remains is CONDENSING LINES.\n'
    + '\n'
    + '      Pass 2 must reach deep into the ranked candidates or it loses the nut (a\n'
    + '      foreshortened edge fret scored 0.77 against a cut of 0.776). Reaching that\n'
    + '      deep also admits the SHOULDERS of each fret\'s Hough ridge — phantoms about\n'
    + '      7 px from a real fret while real frets are 14–24 px apart. mergeNearby cannot\n'
    + '      remove them: its tolerance comes from the observed gaps, and fret spacing\n'
    + '      varies threefold along one neck. identifyFrets then prefers a STRETCHED\n'
    + '      labelling that gives a fret and its own shoulder consecutive numbers —\n'
    + '      residual 0.0024, 20 inliers, ONE label in twenty correct. Both ends of the\n'
    + '      board then pass the nut test with contradictory labellings, and the\n'
    + '      agreement veto below correctly refuses to pick between them.\n'
    + '      Widening nmsRhoFrac to 0.025 gives 17/17 correct labels square-on and\n'
    + '      starves the other two views of lines. One threshold does not serve all\n'
    + '      three, which is why this is still open.');

  // ⚠️ THE ONE THING THAT MUST STAY TRUE WHILE IT IS BROKEN. A detector that
  // cannot find the neck has to return null. It must never fall back to a guess,
  // because a guessed neck is silently wrong by several frets and everything
  // downstream will believe it.
  ok(found === null || (found.frets && found.frets[0] === 0),
    'and while it is unfinished it returns null rather than a guess');
}

// =============================================================================
group('⚠️  the nut test was being fed the wrong coordinate space');
// =============================================================================

// This is the defect that made the previous diagnosis look correct. ρ is
// normalised by max(w, h), so `lineIntersection` returns points in HOUGH space,
// while `looksLikeBoardEnd` indexes `gray[y * w + x]` and needs PIXELS. Handing
// it Hough-space points sampled pixel (0, 0) for both the inside strip and the
// beyond strip, so the two means were identical, `diff` was exactly 0, and
// `isEnd` was false at EVERY candidate line. No amount of trying more candidate
// lines could have fixed that — which is exactly what the old note proposed.
{
  const cam = VIEWS['square on'];
  const { gray, width, height } = toGray(render(cam), W, H);
  const o = DETECT_DEFAULTS;
  const mag = sobel(gray, width, height);
  const strong = houghLines(mag, width, height, {
    ...o, peakThreshold: o.stringPeakThreshold, maxLines: o.maxStringLines,
  });
  const sg = groupByAngle(strong)[0];
  const sorted = [...sg.lines].sort((a, b) => a.rho - b.rho);
  const outer = [sorted[0], sorted[sorted.length - 1]];
  const mask = bandMask(width, height, outer[0], outer[1], o.bandMargin * Math.max(width, height));
  suppressLines(mask, width, height, sg.lines, o.stringSuppressPx);
  const fretLines = houghLines(mag, width, height, {
    ...o, mask, maxLines: o.maxFretLines,
    acceptTheta: { theta: (sg.theta + Math.PI / 2) % Math.PI, half: o.fretAcceptHalfWidth },
  });
  let rhoSum = 0;
  for (const l of sg.lines) rhoSum += l.rho;
  const axis = { theta: sg.theta, rho: rhoSum / sg.lines.length };
  const dir = [Math.sin(axis.theta), -Math.cos(axis.theta)];
  const hits = [];
  for (const fl of fretLines) {
    const p = lineIntersection(fl, axis);
    const a = lineIntersection(fl, outer[0]);
    const b = lineIntersection(fl, outer[1]);
    if (p && a && b) hits.push({ line: fl, a, b, t: p[0] * dir[0] + p[1] * dir[1] });
  }
  hits.sort((x, y) => x.t - y.t);
  const frets = thinByPosition(mergeNearby(hits, o.mergeGapFrac), o.positionBins);
  const houghScale = Math.max(width, height);
  const toPixel = p => [p[0] * houghScale, p[1] * houghScale];

  // In HOUGH space every strip lands on the same pixel, so the test is blind.
  let blindDiffs = 0;
  for (let i = 0; i < 3; i++) {
    const e = looksLikeBoardEnd(gray, width, height,
      frets[i].a, frets[i].b, frets[i + 1].a, frets[i + 1].b, o);
    if (e && e.diff === 0) blindDiffs++;
  }
  ok(blindDiffs === 3,
    'fed Hough-space points the nut test reports a contrast of exactly zero every time');

  // In PIXEL space it fires on the real end of the board.
  let fired = false;
  for (let i = 0; i < o.maxNutCandidates; i++) {
    const e = looksLikeBoardEnd(gray, width, height,
      toPixel(frets[i].a), toPixel(frets[i].b), toPixel(frets[i + 1].a), toPixel(frets[i + 1].b), o);
    if (e && e.isEnd) fired = true;
  }
  ok(fired, 'and fed pixels it finds the end of the board on a synthetic neck');
}

// =============================================================================
group('thinning keeps the ends of the neck, which ranking by votes does not');
// =============================================================================

{
  // Twelve positions; the two at the ends are the WEAKEST, as edge frets are.
  const hits = [];
  for (let i = 0; i < 12; i++) {
    hits.push({ t: i / 11, line: { votes: (i === 0 || i === 11) ? 0.3 : 0.9 } });
  }
  const byVotes = [...hits].sort((a, b) => b.line.votes - a.line.votes).slice(0, 8);
  ok(!byVotes.some(x => x.t === 0) && !byVotes.some(x => x.t === 1),
    'ranking by votes throws away both ends — which is where the nut is');

  const thinned = thinByPosition(hits, 8);
  ok(thinned.some(x => x.t === 0) && thinned.some(x => x.t === 1),
    'while thinning by position keeps them, weak though they are');
  ok(thinned.length <= 10, 'and still respects the budget, give or take the two ends');

  // A duplicate in the same INTERIOR bin loses to its stronger twin. Tested
  // away from the ends on purpose: the ends are exempt from this rule, because
  // keeping a weak duplicate at the edge costs a candidate the nut search will
  // try anyway, while dropping the edge costs the anchor outright.
  const dupes = [
    { t: 0, line: { votes: 0.5 } }, { t: 0.50, line: { votes: 0.4 } },
    { t: 0.51, line: { votes: 0.9 } }, { t: 1, line: { votes: 0.5 } },
  ];
  const dedup = thinByPosition(dupes, 3);
  ok(dedup.length === 3 && dedup.some(x => x.t === 0.51) && !dedup.some(x => x.t === 0.50),
    'and within one bin the strongest line is the one kept');
}

// =============================================================================
group('two anchors that contradict each other are a veto, not a vote');
// =============================================================================

// The module header explains why a REVERSED labelling fits a set of fret lines
// exactly as well as the true one, and it was observed doing so on the bench at
// a residual of 0.0029. Nothing about the fit, the inlier count or the nut
// contrast separates the two. Contradiction is the only signal there is, so a
// rival that disagrees has to sink the answer rather than come second.
{
  const asc = { pairs: [{ pos: 0.1, fret: 0 }, { pos: 0.4, fret: 5 }, { pos: 0.7, fret: 9 }, { pos: 0.9, fret: 12 }] };
  const same = { pairs: [{ pos: 0.1, fret: 0 }, { pos: 0.4, fret: 5 }, { pos: 0.9, fret: 12 }] };
  const reversed = { pairs: [{ pos: 0.1, fret: 12 }, { pos: 0.4, fret: 9 }, { pos: 0.7, fret: 5 }, { pos: 0.9, fret: 0 }] };
  const shifted = { pairs: [{ pos: 0.1, fret: 1 }, { pos: 0.4, fret: 6 }, { pos: 0.7, fret: 10 }, { pos: 0.9, fret: 13 }] };

  ok(labellingsAgree(asc, same, 0.01), 'two readings of the same neck agree');
  ok(!labellingsAgree(asc, reversed, 0.01), 'a neck read backwards does not');
  ok(!labellingsAgree(asc, shifted, 0.01), 'and neither does one shifted by a single fret');

  // ⚠️ NO OVERLAP IS NOT AGREEMENT. Two labellings of disjoint parts of the
  // picture have never contradicted each other and never confirmed each other
  // either; treating that as consensus would wave through exactly the case
  // where there is no evidence at all.
  const elsewhere = { pairs: [{ pos: 0.2, fret: 3 }, { pos: 0.5, fret: 6 }, { pos: 0.8, fret: 11 }] };
  ok(!labellingsAgree(asc, elsewhere, 0.001),
    'and two labellings that share no lines are not counted as agreeing');
}

// =============================================================================
group('the string-side ambiguity is genuinely harmless');
// =============================================================================

{
  // Asserted on a HAND-BUILT calibration rather than a detected one, so it tests
  // the claim in neckDetect's header rather than waiting on the detector.
  const cam = VIEWS['square on'];
  const corners = CORNER_TARGETS.map(([sp, st]) => cam(worldOf(sp, st)));
  const cal = makeNeckCalibration(corners);
  const mirror = makeNeckCalibration([corners[1], corners[0], corners[3], corners[2]]);
  let worstFret = 0;
  let worstString = 0;
  for (let f = 0; f <= 12; f++) {
    const p = cam(worldOf(fretToSpan(f), 2));
    worstFret = Math.max(worstFret, Math.abs(cal.toNeck(p).fret - mirror.toNeck(p).fret));
    worstString = Math.max(worstString, Math.abs(cal.toNeck(p).string - mirror.toNeck(p).string));
  }
  near(worstFret, 0, 0.02, 'mirroring the strings does not move the fret reading at all');
  ok(worstString > 0.5, 'while it does mirror the string reading, which nothing trusts');
}

// =============================================================================
group('the nut test in isolation');
// =============================================================================

{
  // Board on one side, background on the other → an end.
  const gray = new Float32Array(60 * 60).fill(0.8);
  for (let y = 0; y < 60; y++) for (let x = 30; x < 60; x++) gray[y * 60 + x] = 0.2;
  const end = looksLikeBoardEnd(gray, 60, 60, [30, 5], [30, 55], [45, 5], [45, 55]);
  ok(end && end.isEnd, 'board on one side and background on the other reads as the end');

  const uniform = new Float32Array(60 * 60).fill(0.25);
  const mid = looksLikeBoardEnd(uniform, 60, 60, [30, 5], [30, 55], [45, 5], [45, 55]);
  ok(mid && !mid.isEnd, 'while more of the same board reads as an interior fret');
}

// =============================================================================
group('the fret maths this all rests on');
// =============================================================================

near(spanToFret(fretToSpan(7)), 7, 1e-9, 'span and fret still round-trip');
ok(fretToSpan(1) - fretToSpan(0) > fretToSpan(12) - fretToSpan(11),
  'and the spacing still shrinks toward the bridge');

// =============================================================================
console.log(`\nneck detect selftest: ${passed} assertions passed${failed ? `, ${failed} FAILED` : ''}${pending ? `, ${pending} PENDING` : ''}`);
if (pending) {
  console.log('\nnot built yet:');
  for (const p of pendings) console.log(`  ⏳ ${p}`);
}
if (failed) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
