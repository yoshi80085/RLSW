// =============================================================================
// vision/neckGeometrySelftest.mjs — camera geometry, checked without a camera
// -----------------------------------------------------------------------------
//   npm run test:vision
//
// The point of this file: every claim `neckGeometry.js` makes is a claim about
// numbers, and pointing a webcam at a guitar is the worst possible way to find
// out whether the numbers are right — a bad reading could be the maths, the
// calibration, the lighting, the camera angle, or the hand. Here there is only
// the maths, so if a real session reads wrong, this file has already ruled one
// suspect out.
//
// Synthetic cameras below are real perspective projections of a real fretboard
// (a 648 mm scale length, 6 strings, viewed from angles a phone or a laptop would
// actually see), not made-up quadrilaterals — the same reasoning as testing chroma
// against harmonic tones rather than sines. A test built from the same assumption
// as the code proves nothing.
// =============================================================================

import {
  spanToFret, fretToSpan, spanToPressedFret, solveHomography, applyHomography,
  makeNeckCalibration, readHand, pickFrettingHand, makeVisionTracker,
  makeScoreboard, onNeck, checkCalibration, polygonArea,
  CORNER_TARGETS, CORNER_PROMPTS, FINGERTIPS, NECK_STRINGS,
} from './neckGeometry.js';
import { diagnose, nextAction } from './visionCoach.js';
import { makeNeckTracker, pitchToMidi } from '../music/neckPlacement.js';
import { snapToPosition, makeFretFusion, FUSION_DEFAULTS } from './fretFusion.js';
import { STRING_OPENS } from '../riff/guitarMap.js';
import { MAX_FRET } from '../riff/guitarMap.js';

let passed = 0;
let failed = 0;
const fails = [];

function ok(cond, name) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; fails.push(name); console.log(`  ✗ ${name}`); }
}
function near(a, b, tol, name) {
  const good = Number.isFinite(a) && Math.abs(a - b) <= tol;
  ok(good, `${name}${good ? '' : `  (got ${Number(a).toFixed(4)}, want ${b} ±${tol})`}`);
}
function group(name) { console.log(`\n${name}`); }

/** Fret numbers of every neck position sounding a given pitch. */
function positionsForPitchList(pitch) {
  const out = [];
  for (let s = 0; s < NECK_STRINGS; s++) {
    const f = pitch - STRING_OPENS[s];
    if (f >= 0 && f <= MAX_FRET) out.push(f);
  }
  return out;
}

// =============================================================================
group('fret spacing — the logarithmic neck');
// =============================================================================

near(spanToFret(0), 0, 1e-9, 'the nut is fret 0');
near(spanToFret(1), 12, 1e-9, 'the 12th fret is, by definition, fret 12');

// The headline correction. If someone ever "simplifies" spanToFret to `span * 12`
// this is the assertion that stops them, and the message says why.
near(spanToFret(0.5), 4.98, 0.01,
  'halfway to the 12th fret is fret 5, NOT fret 6 — frets are logarithmic');
ok(Math.abs(spanToFret(0.5) - 6) > 0.9,
  'a linear reading would be wrong by more than a whole fret at mid-neck');

near(spanToFret(fretToSpan(7)), 7, 1e-9, 'fretToSpan and spanToFret invert');
near(spanToFret(fretToSpan(3)), 3, 1e-9, 'and again at the 3rd');
near(fretToSpan(12), 1, 1e-9, 'the 12th fret is one span unit from the nut');
near(fretToSpan(24), 1.5, 1e-9, 'the 24th fret is three quarters of the way to the bridge');

ok(Number.isFinite(spanToFret(1.9)) && spanToFret(1.9) <= 48,
  'approaching the bridge saturates instead of returning Infinity');
ok(Number.isFinite(spanToFret(2)) && Number.isFinite(spanToFret(5)),
  'and the bridge itself, and beyond it, are still numbers');
ok(spanToFret(-0.2) < 0, 'behind the nut reads as a negative fret, not as zero');

// Frets get closer together toward the body — the property the whole conversion
// exists for. Checked as a monotonic squeeze rather than at one point.
let shrinking = true;
for (let n = 1; n < 12; n++) {
  const wide = fretToSpan(n) - fretToSpan(n - 1);
  const narrow = fretToSpan(n + 1) - fretToSpan(n);
  if (!(narrow < wide)) shrinking = false;
}
ok(shrinking, 'every fret is narrower than the one before it, all the way up');

near(spanToPressedFret(fretToSpan(4.5)), 5, 1e-9,
  'a finger between wires 4 and 5 is pressing fret 5 (ceiling, not round)');
ok(spanToPressedFret(0) === 0, 'a finger at the nut is an open string');
ok(spanToPressedFret(fretToSpan(30)) === MAX_FRET,
  'past the end of the modelled neck clamps to the last fret');

// =============================================================================
group('homography — the solver itself');
// =============================================================================

{
  const src = [[0, 0], [100, 0], [100, 50], [0, 50]];
  const dst = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const h = solveHomography(src, dst);
  ok(h !== null, 'a well-formed quad solves');
  let exact = true;
  for (let i = 0; i < 4; i++) {
    const got = applyHomography(h, src[i]);
    if (Math.hypot(got[0] - dst[i][0], got[1] - dst[i][1]) > 1e-9) exact = false;
  }
  ok(exact, 'the fit passes exactly through all four correspondences');
  const mid = applyHomography(h, [50, 25]);
  near(mid[0], 0.5, 1e-9, 'and interpolates the middle of an affine case');
}

ok(solveHomography([[0, 0], [1, 1], [2, 2], [3, 3]], CORNER_TARGETS) === null,
  'four collinear clicks are refused rather than fitted to nonsense');

// =============================================================================
group('a synthetic camera looking at a real fretboard');
// =============================================================================

// ── The fretboard, in millimetres ──
// 648 mm scale length (a Strat), strings 52 mm apart across at the 12th fret.
// Neck-space (span, string) → 3D world millimetres. The nut is the origin.
const SCALE_MM = 648;
const STRING_GAP_MM = 10.4;                        // ≈52 mm across six strings
const worldOf = (span, string) => [
  span * (SCALE_MM / 2),                           // along the neck from the nut
  (string - (NECK_STRINGS - 1) / 2) * STRING_GAP_MM,
  0,
];

/**
 * A pinhole camera at `eye` looking at `at`, projecting to a 1280×720 frame
 * normalised to 0..1 — the space MediaPipe reports landmarks in.
 */
function makeCamera(eye, at, focal = 900) {
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
    if (z <= 1) return null;                       // behind the camera
    return [
      0.5 + (focal * dot(d, right)) / z / 1280,
      0.5 - (focal * dot(d, up)) / z / 720,
    ];
  };
}

// Three viewpoints, from the ideal to the one §6 warns about.
const VIEWS = {
  'a propped phone, square on': makeCamera([324, -700, 260], [324, 0, 0]),
  'off to one side and low': makeCamera([700, -520, 90], [300, 0, 0]),
  'a laptop lid — steep and foreshortened': makeCamera([120, -260, 520], [420, 0, 0]),
};

for (const [label, cam] of Object.entries(VIEWS)) {
  group(`  view: ${label}`);
  const corners = CORNER_TARGETS.map(([sp, st]) => cam(worldOf(sp, st)));
  ok(corners.every(Boolean), 'all four corners are in frame');
  const cal = makeNeckCalibration(corners);
  ok(cal !== null, 'the calibration solves');

  // ⚠️ THE LOAD-BEARING TEST. Points the calibration never saw must come back
  // correct. The four corners are exact by construction and prove nothing; these
  // interior points are the only evidence the projection is genuinely inverted.
  let worstFret = 0;
  let worstString = 0;
  for (let f = 0; f <= 12; f++) {
    for (let s = 0; s < NECK_STRINGS; s++) {
      const px = cam(worldOf(fretToSpan(f), s));
      const nk = cal.toNeck(px);
      worstFret = Math.max(worstFret, Math.abs(nk.fret - f));
      worstString = Math.max(worstString, Math.abs(nk.string - s));
    }
  }
  near(worstFret, 0, 0.02, 'every fret/string crossing inverts back to itself');
  near(worstString, 0, 0.02, '…including across the strings');

  // And the drawn overlay must land back on the wire it claims to be.
  const wire = cal.fretWire(5);
  const trueWire = cam(worldOf(fretToSpan(5), 2.5));
  const mid = [(wire[0][0] + wire[1][0]) / 2, (wire[0][1] + wire[1][1]) / 2];
  near(Math.hypot(mid[0] - trueWire[0], mid[1] - trueWire[1]), 0, 0.005,
    'the drawn 5th-fret wire lands on the real 5th fret');
}

// =============================================================================
group('reading a hand');
// =============================================================================

const cam = VIEWS['a propped phone, square on'];
const cal = makeNeckCalibration(CORNER_TARGETS.map(([sp, st]) => cam(worldOf(sp, st))));

/**
 * A plausible fretting hand: four fingertips in a box starting at `fret`, each on
 * a different string, each raised ~18 mm off the board (fingers have depth, and
 * that height is exactly the sort of thing a flat homography cannot know about).
 */
function handAt(fret, { spread = 3, lowString = 1, height = 18, jitterFret = 0 } = {}) {
  const lms = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5 }));
  FINGERTIPS.forEach((tipIdx, i) => {
    const f = fret + (spread * i) / 3 + (i % 2 ? jitterFret : -jitterFret);
    const w = worldOf(fretToSpan(f), lowString + i * 0.6);
    const px = cam([w[0], w[1], height]);
    lms[tipIdx] = { x: px[0], y: px[1] };
  });
  return lms;
}

{
  const read = readHand(handAt(5), cal);
  ok(read !== null, 'a hand in a box on the neck reads');
  // Not asserted to the exact fret: the fingers are 18 mm above the board and a
  // homography maps the BOARD, so an off-axis camera projects a raised fingertip
  // slightly along the neck. That parallax is a real, permanent property of this
  // approach and the test states its size rather than pretending it away.
  near(read.fret, 6.5, 1.5, 'and lands in the right region of the neck');
  ok(read.tips === 4, 'all four fingertips were believed');
  ok(read.spread > 1.5, 'the hand is reported as spanning a few frets, not a point');
}

{
  const low = readHand(handAt(1), cal).fret;
  const high = readHand(handAt(9), cal).fret;
  ok(high > low + 5, 'moving the hand up the neck moves the reading up the neck');
}

{
  // ⚠️ THE MEASUREMENT THE WHOLE EXPERIMENT TURNS ON, asserted so it cannot
  // quietly stop being true. Fingertips are ABOVE the board; the calibration maps
  // the board. Lift the same hand off the plane and watch where the error goes.
  const flat = readHand(handAt(5, { height: 0 }), cal);
  const real = readHand(handAt(5, { height: 18 }), cal);
  const fretErr = Math.abs(real.fret - flat.fret);
  const stringErr = Math.abs(real.string - flat.string);
  ok(fretErr < 0.6, `18 mm of finger height costs under 0.6 frets (${fretErr.toFixed(2)})`);
  ok(stringErr > 3, `…and over 3 strings (${stringErr.toFixed(2)}) — string is not recoverable`);
  ok(stringErr > fretErr * 5,
    'height parallax lands almost entirely on the axis audio was never going to help with');

  // Which means the gate must not be tight across the strings, or a normally
  // fretted hand seen from above gets thrown away as "not on the neck".
  ok(readHand(handAt(5, { height: 18 }), cal, { stringSlack: 1.5 }) === null,
    'proof of the trap: a tight string slack rejects a perfectly good hand');
}

{
  // ⚠️ THE MEDIAN IS WHY THIS PASSES. One fingertip flung to the 12th fret is the
  // single most common failure of a landmark model on a partly-occluded hand.
  const clean = readHand(handAt(4), cal);
  const lms = handAt(4);
  lms[20] = { x: cam(worldOf(fretToSpan(12), 5))[0], y: cam(worldOf(fretToSpan(12), 5))[1] };
  const outlier = readHand(lms, cal);
  near(outlier.fret - clean.fret, 0, 0.9,
    'one wildly mislocated fingertip barely moves the estimate');
}

{
  const away = new Array(21).fill(null).map(() => ({ x: 0.02, y: 0.02 }));
  ok(readHand(away, cal) === null, 'a hand nowhere near the neck reads as nothing, not as fret 0');
  ok(readHand(null, cal) === null, 'no landmarks at all is handled');
  ok(readHand(handAt(5), null) === null, 'no calibration is handled');
}

{
  const lms = handAt(5);
  for (const i of [12, 16, 20]) lms[i] = { x: 0.02, y: 0.02 };   // three off-board
  ok(readHand(lms, cal) === null,
    'one believable fingertip is not enough to claim a position');
}

{
  // The strumming hand: over the body, well past the 12th fret.
  const strum = new Array(21).fill(null).map(() => ({ x: 0.5, y: 0.5 }));
  FINGERTIPS.forEach((t, i) => {
    const px = cam([SCALE_MM * 0.78, -20 + i * 8, 40]);
    strum[t] = { x: px[0], y: px[1] };
  });
  const pick = pickFrettingHand([strum, handAt(4)], cal);
  ok(pick !== null && pick.index === 1,
    'given both hands, the one nearer the nut is taken as the fretting hand');
  ok(onNeck(cal.toNeck([strum[8].x, strum[8].y])) === false,
    'and the strumming hand is off the calibrated board anyway');
  ok(pickFrettingHand([], cal) === null, 'no hands is null, not a crash');
}

// =============================================================================
group('the vision tracker — smoothing without inventing');
// =============================================================================

{
  const t = makeVisionTracker();
  ok(t.value() === null, 'before anything is seen there is no estimate');
  for (let i = 0; i < 20; i++) t.push({ fret: 7, string: 2 }, 80);
  near(t.value().fret, 7, 0.05, 'a steady hand converges on where it is');

  // Jitter in, calm out — the entire job.
  const jittery = makeVisionTracker();
  for (let i = 0; i < 40; i++) jittery.push({ fret: 7 + (i % 2 ? 1.2 : -1.2), string: 2 }, 80);
  near(jittery.value().fret, 7, 0.45, '±1.2 frets of frame-to-frame jitter smooths to ~0');
}

{
  const t = makeVisionTracker();
  for (let i = 0; i < 20; i++) t.push({ fret: 9, string: 2 }, 80);
  t.push(null, 200);
  near(t.value().fret, 9, 0.01, 'a brief loss HOLDS the last position');
  ok(t.value().stale === true, 'and says out loud that it is holding');
  t.push(null, 900);
  ok(t.value() === null, 'a long loss gives up entirely rather than drifting');
  ok(t.age() > 1000, 'and reports how long it has been blind');
}

{
  const t = makeVisionTracker();
  for (let i = 0; i < 30; i++) t.push({ fret: 3, string: 2 }, 80);
  let steps = 0;
  while (t.value().fret < 9.5 && steps < 100) { t.push({ fret: 10, string: 2 }, 80); steps++; }
  ok(steps * 80 < 600, 'a real position change is followed within a beat');
}

// =============================================================================
group('handing the camera to placePitch — the actual integration');
// =============================================================================

{
  const t = makeNeckTracker();
  ok(JSON.stringify(t.ref()) === JSON.stringify([2, 5]) && t.refSource() === 'audio',
    'with no camera the tracker sits at its rest position and says so');

  t.setRef([2, 9]);
  ok(t.refSource() === 'camera', 'a supplied reference takes over');
  const step = t.push([{ midi: 64, pc: 4, strength: 0.9 }], 16.7);
  ok(step && step.f >= 7,
    'and an ambiguous note is placed near the hand the camera saw, not near fret 5');

  // ⚠️ THE FALLBACK MUST STAY WARM. It is tempting to stop feeding the audio
  // tracker while the camera is supplying a reference. Then the camera loses the
  // hand — a lift, a shadow, someone walking past — and the fallback resumes with
  // whatever it believed a minute ago.
  const warm = makeNeckTracker();
  warm.setRef([2, 11]);
  for (let i = 0; i < 60; i++) warm.push([{ midi: 64, pc: 4, strength: 0.9 }], 16.7);
  warm.setRef(null);
  ok(warm.ref()[1] > 6,
    'the audio tracker kept tracking underneath, so the handover is not to a stale guess');

  const guard = makeNeckTracker();
  guard.setRef([NaN, 3]);
  ok(guard.refSource() === 'audio', 'a malformed reference is refused rather than believed');
  guard.setRef([1, 2, 3]);
  ok(guard.refSource() === 'audio', 'and so is one of the wrong shape');
}

// =============================================================================
group('pitch + camera → the exact position');
// =============================================================================

// The note at a given cell, as MIDI. Built from the neck model rather than from
// the module under test, so the two cannot agree by sharing a bug.
const midiAt = (string, fret) => pitchToMidi(STRING_OPENS[string] + fret);

{
  // ⚠️ THE CLAIM THE WHOLE MODULE RESTS ON: candidates for one pitch are far
  // apart, so a coarse camera still picks exactly.
  let worstGap = Infinity;
  for (let p = 0; p <= STRING_OPENS[5] + MAX_FRET; p++) {
    const frets = [...new Set(positionsForPitchList(p))].sort((a, b) => a - b);
    for (let i = 1; i < frets.length; i++) worstGap = Math.min(worstGap, frets[i] - frets[i - 1]);
  }
  ok(worstGap >= 4,
    `the closest two ways to play the same note are ${worstGap} frets apart — a fourth`);
  ok(worstGap / 2 > 0.66 * 2,
    'so the tolerance is over 2 frets, against a measured camera error of 0.66');
}

{
  // E4 sits on the G string at 9, the B string at 5, and the top string open.
  const e4 = midiAt(3, 9);
  ok(snapToPosition(e4, 9).fret === 9, 'a hand at fret 9 resolves E4 to the G string');
  ok(snapToPosition(e4, 9).string === 3, '…on the right string, which audio alone cannot say');
  ok(snapToPosition(e4, 5).fret === 5, 'the same pitch with the hand at 5 resolves to the B string');
  ok(snapToPosition(e4, 0.4).fret === 0, 'and near the nut, to the open string');
}

{
  // Every cell on the neck, snapped from a camera reading half a fret out.
  let right = 0;
  let total = 0;
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= MAX_FRET; f++) {
      const snap = snapToPosition(midiAt(s, f), f + (f % 2 ? 0.5 : -0.5));
      total++;
      if (snap && snap.fret === f) right++;
    }
  }
  ok(right === total,
    `every one of ${total} cells resolves to its own fret from a reading half a fret out`);
}

{
  const e4 = midiAt(3, 9);
  const clear = snapToPosition(e4, 9);
  near(clear.margin, 2, 0.01,
    'a pick in the clear reports the full margin — half the gap to the next option');
  ok(clear.confident, 'and calls itself confident');

  // Halfway between the B string at 5 and the G string at 9.
  const boundary = snapToPosition(e4, 7);
  near(boundary.margin, 0, 0.01, 'a pick exactly on the boundary reports a margin of zero');
  ok(!boundary.confident,
    'and refuses to call itself confident — which a continuous estimate could never tell you');
}

{
  ok(snapToPosition(NaN, 5) === null, 'a missing pitch is handled');
  ok(snapToPosition(midiAt(2, 3), NaN) === null, 'and a missing camera reading');
  const lonely = snapToPosition(midiAt(0, 1), 1);
  ok(lonely && lonely.margin === Infinity,
    'a pitch playable in only one place has infinite margin, not zero');
}

// =============================================================================
group('learning the parallax from ordinary playing');
// =============================================================================

{
  // A camera reading 0.6 frets high at the nut and drifting to 0.6 low at the
  // twelfth — the trend measured on the real logs.
  const bias = f => 0.607 - 0.0993 * f;
  const fusion = makeFretFusion();
  ok(!fusion.ready(), 'it starts with nothing learned and says so');
  ok(fusion.correctedFret(7) === 7, 'and corrects nothing until it has evidence');

  for (let round = 0; round < 4; round++) {
    for (const f of [2, 4, 5, 7, 9, 10, 12]) {
      fusion.observe(midiAt(3, f), f + bias(f));
    }
  }
  ok(fusion.ready(), 'after enough spread-out notes it has a fit');
  const before = [2, 5, 9, 12].map(f => Math.abs((f + bias(f)) - f));
  const after = [2, 5, 9, 12].map(f => Math.abs(fusion.correctedFret(f + bias(f)) - f));
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  ok(mean(after) < mean(before) * 0.25,
    `the learned correction removes most of the bias (${mean(before).toFixed(2)} → ${mean(after).toFixed(2)} frets)`);
}

{
  // ⚠️ THE GUARD AGAINST THE LOOP EATING ITSELF. A calibration a couple of frets
  // out produces snaps whose residual is too large to be parallax; learning from
  // those would entrench the error and silence the alarm it should be raising.
  const fusion = makeFretFusion();
  for (let round = 0; round < 8; round++) {
    for (const f of [2, 5, 9, 12]) fusion.observe(midiAt(3, f), f + 2.2);
  }
  ok(fusion.state().rejected > 0, 'residuals too big to be parallax are refused');
  ok(fusion.state().samples === 0, 'so nothing at all is learned from a calibration 2 frets out');
  ok(!fusion.ready(), 'and no correction is offered');
}

{
  // ⚠️⚠️ AND HERE IS THE LIMIT, WHICH NO GUARD CATCHES. Candidates for one pitch
  // sit a fourth apart, so a calibration wrong by ABOUT a fourth lands on a
  // different real position and every residual comes back small and innocent.
  // The snap is then confidently, consistently wrong by five frets and by a whole
  // string, and nothing in this module can tell. It is the same aliasing family
  // as the projective self-similarity in neckDetect: the neck is a repeating
  // structure, and repeating structures alias.
  //
  // What catches it is OUTSIDE this module — the drawn fret wires not sitting on
  // the real frets, and the off-board rate climbing in `cameraHand`. This test
  // exists so nobody believes the guard above is stronger than it is.
  const fooled = makeFretFusion();
  for (let round = 0; round < 8; round++) {
    for (const f of [2, 5, 7]) fooled.observe(midiAt(3, f), f + 5);
  }
  const snap = snapToPosition(midiAt(3, 2), 2 + 5);
  ok(snap.fret === 7 && snap.confident,
    'a calibration out by a fourth snaps CONFIDENTLY to the wrong position');
  ok(fooled.state().rejected === 0,
    'and the residual guard sees nothing wrong, because there is nothing wrong to see');
}

{
  // Samples all at one spot cannot support a slope, and a slope fitted at one
  // position is worse than no slope at all.
  const fusion = makeFretFusion();
  for (let i = 0; i < 60; i++) fusion.observe(midiAt(3, 7), 7.3);
  ok(!fusion.ready(), 'sixty samples at one position still do not earn a fit');
  ok(fusion.state().spread < FUSION_DEFAULTS.minSpread, 'because they cover no neck');
}

{
  const fusion = makeFretFusion();
  for (let round = 0; round < 6; round++) {
    for (const f of [2, 5, 9, 12]) fusion.observe(midiAt(3, f), f + 0.4);
  }
  ok(fusion.ready(), 'a good run produces a fit');
  fusion.reset();
  ok(!fusion.ready() && fusion.state().samples === 0,
    'and recalibrating throws it away — what was learned described THAT camera position');
}

{
  // A boundary note must not teach anything, however many times it is played.
  const fusion = makeFretFusion();
  const e4 = midiAt(3, 9);
  for (let i = 0; i < 60; i++) fusion.observe(e4, 7);   // exactly between 5 and 9
  ok(fusion.state().samples === 0, 'notes played on a boundary are never learned from');
}

// =============================================================================
group('the scoreboard — the thing that decides whether this is worth adopting');
// =============================================================================

{
  const sb = makeScoreboard();
  sb.log(5, 5.2, 8);
  sb.log(7, 6.8, 3);
  sb.log(3, 3.1, 9);
  const c = sb.camera();
  const a = sb.audio();
  near(c.mean, 0.1667, 0.01, 'camera mean error is computed over the logs');
  ok(c.within1 === 1, 'all three camera reads were within a fret');
  ok(a.within1 === 0, 'none of the audio reads were');
  ok(a.mean > c.mean, 'and the comparison comes out the way the numbers say');
}

{
  // ⚠️ THIS IS THE ASSERTION THE MEDIAN EXISTS FOR. One mistimed log — clicked
  // after the hand already moved — must not be able to decide the verdict.
  const sb = makeScoreboard();
  for (let i = 0; i < 9; i++) sb.log(5, 5.1, 5.1);
  sb.log(5, 5.1, 11);
  ok(sb.audio().mean > 0.6, 'one bad log visibly moves the mean');
  near(sb.audio().median, 0.1, 0.001, 'and leaves the median alone');
  ok(sb.audio().worst === 6, 'the worst case is still reported, not hidden');
}

{
  const sb = makeScoreboard();
  sb.log(5, null, 5.4);
  sb.log(6, 6.2, 6.1);
  ok(sb.camera().n === 1 && sb.camera().blank === 1,
    'a frame where the camera saw nothing is counted as blank, NOT as an error');
  ok(sb.audio().blank === 0, 'while the estimator that answered is scored on all of them');
  sb.undo();
  ok(sb.count() === 1, 'a misclick can be taken back');
  sb.clear();
  ok(sb.count() === 0 && sb.camera().n === 0, 'and the board clears');
}

// =============================================================================
group('calibration sanity — catching a bad quad without a residual to look at');
// =============================================================================

// A believable calibration: the neck across the middle of the frame, with the
// far end a bit smaller because the camera is off to one side.
const GOOD = [[0.12, 0.42], [0.12, 0.58], [0.86, 0.54], [0.86, 0.46]];

{
  ok(checkCalibration(GOOD).length === 0, 'a plausible neck raises nothing');
  ok(checkCalibration(null).length === 0, 'no corners is not an error, it is just nothing');
  near(Math.abs(polygonArea(GOOD)), 0.089, 0.01, 'the quad area comes out right');
}

{
  // ⚠️ THE ONE THIS WHOLE FILE IS FOR. Four clicks fit exactly, so nothing
  // numeric objects to a quad whose corners are jammed against the frame edge —
  // and "the nut is just out of shot" is the single commonest way to get a neck
  // that looks calibrated and reads several frets wrong.
  const cropped = [[0.002, 0.42], [0.002, 0.58], [0.86, 0.54], [0.86, 0.46]];
  const issues = checkCalibration(cropped);
  const it = issues.find(i => i.id === 'cropped');
  ok(it, 'a corner against the edge of frame is caught');
  ok(it.severity === 'blocker', 'and treated as a blocker, not a nicety');
  ok(/whole fretboard/i.test(it.fix), 'and the fix tells you to reframe');
  ok(/corners 1 and 2/.test(it.problem), 'naming which corners are the problem');
}

{
  // Corners 2 and 3 swapped — the outline crosses itself.
  const twisted = [GOOD[0], GOOD[2], GOOD[1], GOOD[3]];
  ok(checkCalibration(twisted).some(i => i.id === 'twisted'),
    'clicking the corners out of order is caught as a crossed outline');
  ok(checkCalibration(GOOD).every(i => i.id !== 'twisted'),
    'and a correctly ordered quad is not accused of it');
}

{
  const tiny = [[0.48, 0.49], [0.48, 0.51], [0.55, 0.51], [0.55, 0.49]];
  ok(checkCalibration(tiny).some(i => i.id === 'tiny'),
    'a neck filling almost none of the frame is caught');
  const stubby = [[0.2, 0.2], [0.2, 0.8], [0.8, 0.8], [0.8, 0.2]];
  ok(checkCalibration(stubby).some(i => i.id === 'stubby'),
    'a near-square is caught — you clicked a fret near the nut, not the 12th');
  const sliver = [[0.1, 0.5], [0.1, 0.505], [0.9, 0.505], [0.9, 0.5]];
  ok(checkCalibration(sliver).some(i => i.id === 'sliver'),
    'two points on the same string, twice, is caught');
}

{
  const oblique = [[0.12, 0.30], [0.12, 0.70], [0.90, 0.52], [0.90, 0.48]];
  const it = checkCalibration(oblique).find(i => i.id === 'oblique');
  ok(it, 'a camera looking down the length of the neck is caught');
  ok(it.severity === 'warn',
    'as a warning, not a blocker — it still works, it is just coarse at the far end');
}

{
  // Cropped at both ends AND looking down the neck: two independent faults.
  const issues = checkCalibration([[0.002, 0.05], [0.002, 0.95], [0.998, 0.55], [0.998, 0.45]]);
  ok(issues.length > 1, 'a quad can be wrong in several ways at once');
  ok(issues.some(i => i.id === 'cropped') && issues.some(i => i.id === 'oblique'),
    'and both faults are named rather than the first one masking the second');
  ok(issues[0].severity === 'blocker', 'and blockers sort ahead of warnings');
}

{
  let allActionable = true;
  const shapes = [GOOD, [GOOD[0], GOOD[2], GOOD[1], GOOD[3]],
    [[0.002, 0.42], [0.002, 0.58], [0.86, 0.54], [0.86, 0.46]],
    [[0.2, 0.2], [0.2, 0.8], [0.8, 0.8], [0.8, 0.2]]];
  for (const sh of shapes) {
    for (const i of checkCalibration(sh)) {
      // The copy rule, enforced: a fix that quotes a number at someone holding a
      // guitar is not a fix. Every one has to name something to DO.
      if (!/\b(move|press|click|check|get|recalibrate|drop|bring|play|turn|raise)\b/i.test(i.fix)) {
        allActionable = false;
      }
    }
  }
  ok(allActionable, 'every fix string tells you to do something, not just what is wrong');
}

// =============================================================================
group('the coach — one instruction at a time, in the right order');
// =============================================================================

const HEALTHY = {
  cameraOn: true, micOn: true, cdnError: null, calibrating: false,
  corners: GOOD, calOk: true, handsSeen: 1,
  read: { tips: 4, spread: 3, fret: 5, string: 2 },
  noHandMs: 0, offBoardRate: 0, visionMs: 12, micState: 'music', logCount: 12,
};

{
  ok(diagnose(HEALTHY).length === 0, 'a healthy bench has nothing to say');
  const n = nextAction(diagnose(HEALTHY), HEALTHY);
  ok(n.severity === 'ok', '…and says so, rather than going silent');
  ok(/move around the neck/.test(n.fix), 'nudging you toward logs that actually mean something');
}

{
  // ⚠️ THE COACH IS A QUEUE, NOT A REPORT. With the camera off, everything else
  // is also "wrong", and listing all of it reads as unfixable.
  const cold = { ...HEALTHY, cameraOn: false, micOn: false, corners: null, handsSeen: 0 };
  const issues = diagnose(cold);
  ok(issues.length === 1, 'with the camera off, exactly one thing is said');
  ok(issues[0].id === 'nocamera', 'and it is the camera');
  ok(/laptop lid/.test(issues[0].fix),
    'warning about the one angle that cannot work, BEFORE the time is wasted');
}

{
  const noCdn = { ...HEALTHY, cdnError: 'could not reach the CDN' };
  const issues = diagnose(noCdn);
  ok(issues.length === 1 && issues[0].id === 'cdn', 'a CDN failure short-circuits everything else');
  ok(/offline/.test(issues[0].fix), 'and says the audio half still works');
}

{
  // ⚠️ A DENIED CAMERA AND A BLOCKED CDN MUST NOT SHARE A MESSAGE. They present
  // identically — a black rectangle and no numbers — and the fixes have nothing
  // to do with each other, so one merged "could not start" sends people to check
  // a webcam that was never the problem.
  const denied = diagnose({ ...HEALTHY, camError: 'the browser denied access to the camera' });
  ok(denied[0].id === 'camerror', 'a camera failure is its own blocker');
  ok(/address bar/.test(denied[0].fix), 'and a denial is answered with the permission fix');
  const missing = diagnose({ ...HEALTHY, camError: 'no camera was found on this machine' });
  ok(/already in use/.test(missing[0].fix),
    'while a missing camera gets the hardware fix instead');
}

{
  const mid = { ...HEALTHY, calibrating: true, clicksSoFar: 2, corners: null };
  const issues = diagnose(mid);
  ok(issues[0].id === 'calibrating' && /3 of 4/.test(issues[0].problem),
    'mid-calibration it tracks which corner you are on');
  ok(/stop and move the camera/.test(issues[0].fix),
    'and warns you off clicking corners that are not in the picture');

  // ⚠️ REGRESSION: a playtester read "LOW-E side (the fat string)" as an
  // instruction to PLUCK the low E and sat there playing at a page waiting for a
  // mouse. Everything else in this project asks you to play something, so a
  // string name in a prompt is read as a verb. It must say what to do with a
  // mouse, and it must not name a string.
  ok(/mouse/i.test(issues[0].fix) && /nothing to play/i.test(issues[0].fix),
    'and says out loud that this is a mouse click, not something to play');
  ok(CORNER_PROMPTS.length === 4, 'there are four corner prompts');
  ok(CORNER_PROMPTS.every(p => /where the/i.test(p) && /meets/i.test(p)),
    'each names a place where two things MEET, not a thing to play');
  ok(CORNER_PROMPTS.every(p => !/\b(low-?e|high-?e|e string|6th string|1st string)\b/i.test(p)),
    'and none of them names a string, which reads as "play this"');
}

{
  const uncal = { ...HEALTHY, corners: null, handsSeen: 1 };
  ok(diagnose(uncal)[0].fix.includes('press CALIBRATE NECK'),
    'with a hand visible but no calibration, it points at the button');
  const uncalNoHand = { ...HEALTHY, corners: null, handsSeen: 0 };
  ok(/into the picture/.test(diagnose(uncalNoHand)[0].fix),
    'and with no hand visible, it points at the framing first');
}

{
  // Drift outranks a missing hand: a lost hand shows as blank and everyone
  // understands blank, but a drifted calibration prints a confident wrong number.
  const drifted = { ...HEALTHY, offBoardRate: 0.8, handsSeen: 1, read: null, noHandMs: 5000 };
  const issues = diagnose(drifted);
  ok(issues[0].id === 'drift', 'drift is reported ahead of the missing hand it causes');
  ok(/suspect/.test(issues[0].fix),
    'and says the logs taken since it started cannot be trusted');
}

{
  const lost = { ...HEALTHY, handsSeen: 0, read: null, noHandMs: 5000 };
  ok(diagnose(lost).some(i => i.id === 'nohands'), 'a hand missing for seconds is raised');
  const blink = { ...HEALTHY, handsSeen: 0, read: null, noHandMs: 400 };
  ok(!diagnose(blink).some(i => i.id === 'nohands'),
    'but a momentary loss is not — it would fire constantly while you play');
}

{
  const strum = { ...HEALTHY, handsSeen: 1, read: null, noHandMs: 5000 };
  const it = diagnose(strum).find(i => i.id === 'offboard');
  ok(it, 'a visible hand that is not on the board is raised');
  ok(/strumming hand, this is correct/.test(it.fix),
    'while allowing that it is probably just the strumming hand');
}

{
  ok(diagnose({ ...HEALTHY, read: { tips: 2, spread: 2 } }).some(i => i.id === 'fewtips'),
    'partly occluded fingers are raised as a tip');
  ok(diagnose({ ...HEALTHY, read: { tips: 4, spread: 9 } }).some(i => i.id === 'spread'),
    'a hand supposedly spanning nine frets is raised');
  ok(diagnose({ ...HEALTHY, visionMs: 70 }).some(i => i.id === 'slow'),
    'expensive detection is raised, with the slider as the fix');
}

{
  const noMic = { ...HEALTHY, micOn: false };
  const it = diagnose(noMic).find(i => i.id === 'nomic');
  ok(it, 'a missing mic is raised — there is no experiment without it');
  ok(/proves nothing/.test(it.fix), 'and says why it matters rather than just naming it');

  const gated = { ...HEALTHY, micState: 'ignoring — noisy' };
  const g = diagnose(gated).find(i => i.id === 'gated');
  ok(g && g.severity === 'tip', 'a rejecting gate is a tip, not a problem');
  ok(/correct between notes/.test(g.fix),
    'because between notes it is the gate working, which is what confused the first run');
}

{
  const messy = { ...HEALTHY, offBoardRate: 0.9, visionMs: 90, micOn: false };
  const n = nextAction(diagnose(messy), messy);
  ok(n.others >= 2, 'when several things are wrong it counts the rest');
  ok(n.id === 'drift', 'but leads with the worst one');
}

{
  const fresh = { ...HEALTHY, logCount: 2 };
  const n = nextAction(diagnose(fresh), fresh);
  ok(/6 more logs/.test(n.fix), 'with everything working it counts you toward a usable verdict');
  const one = nextAction(diagnose({ ...HEALTHY, logCount: 7 }), { ...HEALTHY, logCount: 7 });
  ok(/1 more log\b/.test(one.fix), 'and gets the singular right');
}

// =============================================================================
console.log(`\nneck geometry selftest: ${passed} assertions passed${failed ? `, ${failed} FAILED` : ''}`);
if (failed) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
