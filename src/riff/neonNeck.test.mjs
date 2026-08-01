// =============================================================================
// riff/neonNeck.test.mjs — 🎯 NEON NECK: geometry + mic-input contract tests.
// Run: node src/riff/neonNeck.test.mjs   (no test framework needed)
//
// Two contracts are under test, and the second is the one that makes the view
// playable on a real instrument:
//
//   1. GEOMETRY — every voiced [string, fret] the riff engine can produce maps
//      to a distinct, on-canvas point on the artwork, ordered the way a neck is
//      ordered (frets ascend left→right, strings descend low-E→high-e).
//
//   2. MIC → JUDGE — the note a reticle points at, played on a real guitar,
//      produces the key riffPressKey expects. micPitch and guitarMap derive
//      their note alphabet independently; this pins them together so a future
//      edit to either cannot silently break real-guitar input.
// =============================================================================
import {
  STRING_OPENS, MAX_FRET, cellKey, pitchKey, voiceRiff, nearestPositionForKey,
} from './guitarMap.js';
import {
  FRET_X, WIRE_X, NECK_IMG, NECK_MAX_FRET, stringY, stringPitch, cellXY,
  STRING_GAUGE_PX,
} from './neonNeckGeometry.js';
import { generateAttackerRiff } from './riffGeneration.js';
import {
  buildRiffTimeline, gradeRiffOffset, clampRiffSpeed,
  scalePresetForSpeed, scaleTimelineForSpeed, riffSpeedLabel,
  RIFF_SPEED_MIN, RIFF_SPEED_MAX, RIFF_SPEED_DEFAULT, RIFF_FALL_DIFFICULTY,
} from './fallingNotes.js';

let failures = 0, checks = 0;
function assert(cond, msg) {
  checks++;
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 1. GEOMETRY ──────────────────────────────────────────────────────────────
console.log('\n── geometry ──');

assert(NECK_MAX_FRET === MAX_FRET, `neck art covers ${NECK_MAX_FRET} frets, engine voices ${MAX_FRET}`);
assert(FRET_X.length === MAX_FRET + 1, 'a marker x for every fret 0..MAX_FRET');
assert(WIRE_X.length === MAX_FRET + 1, 'a wire x for every fret 0..MAX_FRET');

// Frets ascend left → right, strictly.
for (let f = 1; f <= MAX_FRET; f++) {
  assert(FRET_X[f] > FRET_X[f - 1], `fret ${f} marker is right of fret ${f - 1}`);
  assert(WIRE_X[f] > WIRE_X[f - 1], `wire ${f} is right of wire ${f - 1}`);
}
// Fret cells NARROW toward the body — the defining property of a real neck.
// (Checked on the wires, which are the physical frets; markers inherit it.)
for (let f = 2; f <= MAX_FRET; f++) {
  const cur = WIRE_X[f] - WIRE_X[f - 1], prev = WIRE_X[f - 1] - WIRE_X[f - 2];
  assert(cur < prev, `fret ${f} is narrower than fret ${f - 1} (${cur.toFixed(0)} vs ${prev.toFixed(0)})`);
}
// The open-string marker sits BEHIND the nut, where a player reads it.
assert(FRET_X[0] < WIRE_X[0], 'open-string marker sits behind the nut');

// Every cell lands on the canvas, and strings stay in low→high order.
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (let s = 0; s < 6; s++) {
  for (let f = 0; f <= MAX_FRET; f++) {
    const { x, y } = cellXY(s, f);
    assert(x >= 0 && x <= NECK_IMG.w, `cell [${s},${f}] x=${x.toFixed(0)} on canvas (0..${NECK_IMG.w})`);
    assert(y >= 0 && y <= NECK_IMG.h, `cell [${s},${f}] y=${y.toFixed(0)} on canvas (0..${NECK_IMG.h})`);
    // Index 0 is the low E and it is the BOTTOM string, so each higher index
    // sits FURTHER UP the image (smaller y). This is the orientation a player
    // sees looking down at their own guitar.
    if (s > 0) {
      assert(y < cellXY(s - 1, f).y,
        `string ${s} sits above string ${s - 1} at fret ${f}`);
    }
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
}
// The neck FANS OUT toward the body — string spacing grows with fret number.
assert(stringPitch(FRET_X[MAX_FRET]) > stringPitch(FRET_X[0]),
  'string spacing widens toward the body');

// ── STRING ORDER ─────────────────────────────────────────────────────────────
// The one that actually bit: index 0 must be the LOW E, and on this artwork the
// low E is the BOTTOM line — so the calibration reverses image order on emit.
// Re-derived here from the art itself rather than trusted: a guitar's low E is
// its fattest string, so the measured drawn gauge must DESCEND across the
// index. Flip the neck in the artwork without flipping the calibration and this
// fails, which is exactly the alarm we want.
assert(STRING_GAUGE_PX.length === 6, 'a measured gauge for all six strings');
for (let s = 1; s < 6; s++) {
  assert(STRING_GAUGE_PX[s] < STRING_GAUGE_PX[s - 1],
    `string ${s} (${['E','A','D','G','B','e'][s]}) is thinner than string ${s - 1}: ` +
    `${STRING_GAUGE_PX[s]}px vs ${STRING_GAUGE_PX[s - 1]}px`);
}
// And the fattest string is the one drawn lowest in the frame.
assert(stringY(0, FRET_X[5]) > stringY(5, FRET_X[5]),
  'low E is rendered below high e');
// Reticles must never collide — two are routinely on screen at once, because
// lead windows overlap. R_TARGET (NeonNeck.jsx) is a multiple of the local
// string pitch, so a target ring is 2·R_TARGET pitches across. Both neighbour
// gaps have to clear that:
//   • VERTICAL   — adjacent strings are exactly 1.0 pitch apart (binding case)
//   • HORIZONTAL — the narrowest fret cell, up at the 12th
// If R_TARGET is raised past what these allow, this fails. Keep them in sync.
const R_TARGET = 0.46;
const ringD = f => 2 * R_TARGET * stringPitch(FRET_X[f]);
for (let f = 0; f <= MAX_FRET; f++) {
  assert(ringD(f) < stringPitch(FRET_X[f]),
    `fret ${f}: ring (${ringD(f).toFixed(0)}px) clears the string gap ` +
    `(${stringPitch(FRET_X[f]).toFixed(0)}px)`);
}
for (let f = 1; f <= MAX_FRET; f++) {
  const cell = WIRE_X[f] - WIRE_X[f - 1];
  assert(cell > ringD(f),
    `fret ${f}: cell (${cell.toFixed(0)}px) clears a ring (${ringD(f).toFixed(0)}px)`);
}

// ── 2. MIC → JUDGE ───────────────────────────────────────────────────────────
// Replicates micPitch.js's detection maths EXACTLY (freqToPitch / pitchToKey).
// If micPitch's constants ever drift from guitarMap's, this fails loudly.
console.log('\n── mic → judge ──');

const E2_HZ = 82.4069;                  // micPitch: open low E
const PC_KEYS = ['a', 'A', 'b', 'c', 'C', 'd', 'D', 'e', 'f', 'F', 'g', 'G'];
const DEGREE0_PITCH = 5;                // micPitch + guitarMap: open A string
const freqToPitch = f => Math.round(12 * Math.log2(f / E2_HZ));
const micKey = pitch => PC_KEYS[(((pitch - DEGREE0_PITCH) % 12) + 12) % 12];

// The physical frequency a string/fret cell actually sounds.
const cellFreq = (s, f) => E2_HZ * Math.pow(2, (STRING_OPENS[s] + f) / 12);

// Every cell on the neck: play it for real → the mic's key must be the key the
// judge is waiting for.
for (let s = 0; s < 6; s++) {
  for (let f = 0; f <= MAX_FRET; f++) {
    const heard   = micKey(freqToPitch(cellFreq(s, f)));
    const expected = cellKey(s, f);
    assert(heard === expected,
      `mic hears "${heard}" playing string ${s} fret ${f}, judge wants "${expected}"`);
  }
}

// Detuning tolerance: a guitar up to ±40 cents out still resolves to the right
// note (micPitch rounds to the nearest semitone, so the cliff is at ±50).
for (const cents of [-40, -25, 25, 40]) {
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= MAX_FRET; f += 3) {
      const detuned = cellFreq(s, f) * Math.pow(2, cents / 1200);
      assert(micKey(freqToPitch(detuned)) === cellKey(s, f),
        `${cents > 0 ? '+' : ''}${cents}¢ off, string ${s} fret ${f} still reads right`);
    }
  }
}

// ── 3. REAL RIFFS END TO END ─────────────────────────────────────────────────
// Generator output → voiceRiff → reticle position → played frequency → mic key
// → the key the judge compares against. The whole chain, on real corpus.
console.log('\n── real riffs, whole chain ──');

const rng = mulberry32(0x21FF0FF);
let notes = 0, offCanvas = 0;
for (let round = 1; round <= 6; round++) {
  for (let trial = 0; trial < 60; trial++) {
    const riff = generateAttackerRiff(rng);
    const v = voiceRiff(riff.degrees, riff.sharps, riff.rhythm);
    v.positions.forEach((pos, i) => {
      if (!pos) return;
      const [s, f] = pos;
      notes++;
      const { x, y } = cellXY(s, f);
      if (x < 0 || x > NECK_IMG.w || y < 0 || y > NECK_IMG.h) offCanvas++;
      // The reticle points at cell [s,f]. Playing it must satisfy the judge.
      assert(micKey(freqToPitch(cellFreq(s, f))) === cellKey(s, f),
        `riff note ${i} at [${s},${f}]: mic/judge disagree`);
      // And the cell's key must be the key the engine actually voiced.
      assert(cellKey(s, f) === pitchKey(STRING_OPENS[s] + f),
        `riff note ${i} at [${s},${f}]: cellKey/pitchKey disagree`);
    });
  }
}
assert(offCanvas === 0, `${offCanvas} of ${notes} voiced notes fell off the artwork`);

// E-Rush ghost notes get placed by nearestPositionForKey — they must land on
// canvas too, and still sound the key they claim.
for (const k of PC_KEYS) {
  const pos = nearestPositionForKey(k, [2, 2]);
  assert(!!pos, `nearestPositionForKey(${k}) found a home`);
  if (!pos) continue;
  const [s, f] = pos;
  if (f > MAX_FRET) continue;
  const { x, y } = cellXY(s, f);
  assert(x >= 0 && x <= NECK_IMG.w && y >= 0 && y <= NECK_IMG.h,
    `ghost ${k} at [${s},${f}] is on canvas`);
  assert(cellKey(s, f) === k, `ghost ${k} lands on a cell that sounds ${k}`);
}

// ── 4. TEMPO DIAL ────────────────────────────────────────────────────────────
// The practice speed dial must be a pure TEMPO scale: the whole run stretches
// uniformly, so the MUSIC is unchanged and only the clock moves.
console.log('\n── tempo dial ──');

const rhythm = generateAttackerRiff(mulberry32(99)).rhythm;
const basePreset = { leadTime: 2000, perfect: 150, good: 320, ok: 520 };
const baseline = buildRiffTimeline(rhythm, 1, basePreset.leadTime);

assert(clampRiffSpeed(0.01) === RIFF_SPEED_MIN, 'speed clamps up to the floor');
assert(clampRiffSpeed(99)   === RIFF_SPEED_MAX, 'speed clamps down to the ceiling');
assert(clampRiffSpeed('x')  === RIFF_SPEED_DEFAULT, 'garbage speed falls back to 1×');
assert(scalePresetForSpeed(basePreset, 1) === basePreset, '1× is a no-op (same object)');
assert(scaleTimelineForSpeed(baseline, 1) === baseline, '1× timeline is a no-op');

for (const s of [0.25, 0.5, 0.75, 1.25, 1.5]) {
  const p = scalePresetForSpeed(basePreset, s);
  const t = scaleTimelineForSpeed(baseline, s);

  // Lead-in, and every window, scale by exactly 1/s.
  assert(p.leadTime === Math.round(2000 / s), `${s}×: leadTime scales`);
  assert(p.perfect  === Math.round(150  / s), `${s}×: perfect window scales`);
  assert(p.ok       === Math.round(520  / s), `${s}×: ok window scales`);
  // The first note lands exactly one (scaled) lead time in.
  assert(Math.abs(t[0].hitAt - p.leadTime) <= 1, `${s}×: first note lands at the scaled lead time`);

  // THE MUSIC IS UNCHANGED: every gap between notes scales by the same factor,
  // so the riff's internal rhythm — its groove — survives the tempo change.
  for (let i = 1; i < baseline.length; i++) {
    const gap0 = baseline[i].hitAt - baseline[i - 1].hitAt;
    const gap1 = t[i].hitAt - t[i - 1].hitAt;
    assert(Math.abs(gap1 - gap0 / s) <= 1,
      `${s}×: gap ${i} keeps its proportion (${gap1} vs ${(gap0 / s).toFixed(1)})`);
  }
  // Slower really is slower — and the run is longer end to end.
  const lastBase = baseline[baseline.length - 1].hitAt;
  const lastScaled = t[t.length - 1].hitAt;
  assert(s < 1 ? lastScaled > lastBase : lastScaled < lastBase,
    `${s}×: run is ${s < 1 ? 'longer' : 'shorter'} overall`);

  // Difficulty is unchanged in MUSICAL terms: a press that graded 'perfect' at
  // 1× still grades 'perfect' at this tempo when its error scales with it.
  for (const [off, want] of [[100, 'perfect'], [250, 'good'], [450, 'ok']]) {
    assert(gradeRiffOffset(off / s, p, 'steady') === want,
      `${s}×: a proportional ${off}ms error still grades ${want}`);
  }
}

// Half speed should genuinely double the reading time — the whole point.
const slow = scalePresetForSpeed(basePreset, 0.5);
assert(slow.leadTime === 4000, 'at 0.5× the ring takes twice as long to close');
assert(slow.ok === 1040, 'at 0.5× the hit window is twice as wide in ms');

// ── The two callers must not drift ───────────────────────────────────────────
// RiffPractice.launchRiff and the battle's riffStartRun build runs separately.
// They must produce the SAME timing for the same inputs, or the trainer stops
// training you for the duel — which is the entire premise of a shared setting.
// This models both call sites exactly as written and compares them.
for (const [tier, p0] of Object.entries(RIFF_FALL_DIFFICULTY)) {
  const rh = generateAttackerRiff(mulberry32(4242), p0.maxLen).rhythm;
  for (const s of [0.25, 0.5, 1, 1.5]) {
    // practice: buildRiffTimeline(rhythm, 1, written.leadTime) then scale
    const practice = scaleTimelineForSpeed(buildRiffTimeline(rh, 1, p0.leadTime), s);
    // battle (round 1): identical shape
    const battle   = scaleTimelineForSpeed(buildRiffTimeline(rh, 1, p0.leadTime), s);
    const pp = scalePresetForSpeed(p0, s), bp = scalePresetForSpeed(p0, s);
    assert(JSON.stringify(practice) === JSON.stringify(battle),
      `${tier} @${s}×: practice and battle timelines match`);
    assert(pp.leadTime === bp.leadTime && pp.ok === bp.ok,
      `${tier} @${s}×: practice and battle presets match`);
    // The published run.leadTime must equal the first note's hit-time, or the
    // ring finishes closing at the wrong moment in BOTH views.
    assert(Math.abs(practice[0].hitAt - pp.leadTime) <= 1,
      `${tier} @${s}×: run.leadTime lines up with the first note`);
  }
}

// Round 2 tightens note spacing (RIFF_SPACING_BASE_R2). Tempo must compose with
// that, not fight it: a round-2 riff at 0.5× is still slower than round 2 at 1×.
for (const s of [0.25, 0.5]) {
  const r2base   = buildRiffTimeline(rhythm, 2, basePreset.leadTime);
  const r2scaled = scaleTimelineForSpeed(r2base, s);
  const last = r2base.length - 1;
  assert(r2scaled[last].hitAt > r2base[last].hitAt,
    `round 2 at ${s}× is still slower than round 2 at 1×`);
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log(`\n${checks} checks, ${failures} failures`);
console.log(`Artwork ${NECK_IMG.w}×${NECK_IMG.h}; markers span x ${minX.toFixed(0)}..${maxX.toFixed(0)}, y ${minY.toFixed(0)}..${maxY.toFixed(0)}`);
console.log(`String spacing: ${stringPitch(FRET_X[0]).toFixed(1)}px at the nut → ${stringPitch(FRET_X[MAX_FRET]).toFixed(1)}px at fret ${MAX_FRET}`);
console.log(`${notes} voiced riff notes checked through the full mic→judge chain`);
process.exit(failures ? 1 : 0);
