// =============================================================================
// riff/guitarMap.test.mjs — standalone test for the full-neck voicing module.
// Run: node src/riff/guitarMap.test.mjs   (no test framework needed)
// Corpus: real generator output — attacker riffs, defender answers, melody
// riffs — under seeded RNG, so failures are reproducible.
// =============================================================================
import {
  STRING_OPENS, MAX_FRET, WINDOW, NECK_MAX_PITCH,
  degreePitch, pitchKey, cellKey, positionsForPitch, voiceRiff,
  nearestPositionForKey,
} from './guitarMap.js';
import {
  generateAttackerRiff, generateDefenderRiff, riffDegreesToNotes,
} from './riffGeneration.js';
import { melodyToRiff } from './melodyRiff.js';

// Seeded RNG (mulberry32) — deterministic corpus.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let failures = 0, checks = 0;
function assert(cond, msg) {
  checks++;
  if (!cond) { failures++; console.error(`  ✗ ${msg}`); }
}

// ── Build corpus ─────────────────────────────────────────────────────────────
const NOTE_POOL = ['A','A#','B','C','C#','D','D#','E','F','F#','G','G#'];
const corpus = [];
for (let seed = 1; seed <= 250; seed++) {
  const rand = mulberry32(seed);
  const len  = 6 + Math.floor(rand() * 10);              // 6..15 (VIRTUOSO max 16)
  const atk  = generateAttackerRiff(rand, len);
  const def  = generateDefenderRiff(atk, rand);
  corpus.push({ tag: `atk#${seed}`, riff: atk });
  corpus.push({ tag: `def#${seed}(${def.kind})`, riff: def });
  const melody = Array.from({ length: 4 + Math.floor(rand() * 12) },
    () => NOTE_POOL[Math.floor(rand() * NOTE_POOL.length)]);
  const mr = melodyToRiff(melody, { rand, targetLen: len });
  if (mr) corpus.push({ tag: `mel#${seed}`, riff: mr });
}
console.log(`Corpus: ${corpus.length} riffs`);

// ── Per-riff assertions ──────────────────────────────────────────────────────
const stringUse = [0, 0, 0, 0, 0, 0];
let openCount = 0, noteCount = 0, totalOverflow = 0, anchorShifts = [];

for (const { tag, riff } of corpus) {
  const { degrees, sharps, rhythm } = riff;
  const keys = riffDegreesToNotes(degrees, sharps);
  const v1 = voiceRiff(degrees, sharps, rhythm);
  const v2 = voiceRiff(degrees, sharps, rhythm);

  // Determinism
  assert(JSON.stringify(v1) === JSON.stringify(v2), `${tag}: non-deterministic voicing`);

  const { positions, anchors, octaveShift, overflow } = v1;
  totalOverflow += overflow.length;
  assert(positions.length === degrees.length, `${tag}: positions length mismatch`);
  assert(anchors.length >= 1, `${tag}: no anchors`);

  // Anchor sanity + full coverage of note indices
  let covered = 0;
  anchors.forEach(a => {
    covered += a.end - a.start + 1;
    assert(a.fret >= 0 && a.fret + WINDOW <= MAX_FRET, `${tag}: anchor fret ${a.fret} out of neck`);
  });
  assert(covered === degrees.length, `${tag}: anchors don't tile the riff`);

  positions.forEach(([s, f], i) => {
    noteCount++;
    stringUse[s]++;
    if (f === 0) openCount++;

    // Neck bounds
    assert(s >= 0 && s <= 5, `${tag}[${i}]: string ${s} out of range`);
    assert(f >= 0 && f <= MAX_FRET, `${tag}[${i}]: fret ${f} out of range`);

    // PITCH CORRECTNESS — the cell sounds the note's pitch class…
    const sounded = STRING_OPENS[s] + f;
    const wanted  = degreePitch(degrees[i], sharps[i]);
    assert((sounded - wanted) % 12 === 0,
      `${tag}[${i}]: cell pc ${pitchKey(sounded)} ≠ note pc ${pitchKey(wanted)}`);
    // …and exactly wanted + globalShift*12 unless flagged overflow
    if (!overflow.includes(i)) {
      assert(sounded === wanted + octaveShift * 12,
        `${tag}[${i}]: octave broke contour without overflow flag`);
    }
    // Key letter matches the engine's judge key
    assert(cellKey(s, f) === keys[i],
      `${tag}[${i}]: cellKey ${cellKey(s, f)} ≠ engine key ${keys[i]}`);

    // WINDOW RULE — fretted notes sit inside their phrase's anchor window
    if (f > 0 && !overflow.includes(i)) {
      const a = anchors.find(a => i >= a.start && i <= a.end);
      assert(f >= a.fret && f <= a.fret + WINDOW,
        `${tag}[${i}]: fret ${f} outside window ${a.fret}..${a.fret + WINDOW}`);
    }
  });

  // CONTOUR — relative pitch ordering survives voicing (non-overflow notes)
  for (let i = 1; i < positions.length; i++) {
    if (overflow.includes(i) || overflow.includes(i - 1)) continue;
    const pa = STRING_OPENS[positions[i - 1][0]] + positions[i - 1][1];
    const pb = STRING_OPENS[positions[i][0]] + positions[i][1];
    const da = degreePitch(degrees[i - 1], sharps[i - 1]);
    const db = degreePitch(degrees[i], sharps[i]);
    assert(Math.sign(pb - pa) === Math.sign(db - da),
      `${tag}[${i}]: contour direction flipped on the neck`);
  }

  for (let i = 1; i < anchors.length; i++) anchorShifts.push(Math.abs(anchors[i].fret - anchors[i - 1].fret));
}

// ── Corpus-level expectations ────────────────────────────────────────────────
assert(totalOverflow === 0, `overflow should be 0 across generated corpus (got ${totalOverflow})`);
assert(stringUse.every(n => n > 0), `all 6 strings should be used across corpus (got ${stringUse})`);

// ── Spot-checks: known fingerings ────────────────────────────────────────────
assert(degreePitch(0, false) === 5, 'degree 0 (a) = open A = pitch 5');
assert(cellKey(1, 0) === 'a', 'open A string is a');
assert(cellKey(0, 0) === 'e', 'open low E is e');
assert(cellKey(4, 0) === 'b', 'open B string is b');
assert(cellKey(4, 1) === 'c', 'B string fret 1 is c');
assert(cellKey(5, 0) === 'e', 'open high e is e');
assert(cellKey(1, 1) === 'A', 'A string fret 1 is A#');
assert(cellKey(3, 1) === 'G', 'G string fret 1 is G#');
assert(pitchKey(degreePitch(1, true)) === 'b', 'B♯ ignored (non-sharpable) like audio');
assert(positionsForPitch(5).length === 2, 'A2: open A + low E fret 5');

// nearestPositionForKey — ghost/glitch gems get a valid cell near their sibling
for (const k of ['a','A','b','c','C','d','D','e','f','F','g','G']) {
  for (const ref of [[0, 0], [2, 5], [5, 12]]) {
    const pos = nearestPositionForKey(k, ref);
    assert(pos && cellKey(pos[0], pos[1]) === k, `nearestPositionForKey(${k}) sounds wrong pc`);
    assert(pos[1] >= 0 && pos[1] <= MAX_FRET, `nearestPositionForKey(${k}) off neck`);
  }
}
assert(JSON.stringify(nearestPositionForKey('a', [1, 0])) === '[1,0]', 'open A is its own nearest a');

// ── Report ───────────────────────────────────────────────────────────────────
console.log(`\n${checks} checks, ${failures} failures`);
console.log(`String usage E A D G B e: ${stringUse.join(' ')}`);
console.log(`Open strings: ${(100 * openCount / noteCount).toFixed(1)}% of ${noteCount} notes`);
const shifted = anchorShifts.filter(s => s > 0).length;
console.log(`Anchor shifts: ${anchorShifts.length} boundaries, ${shifted} moved, max ${Math.max(0, ...anchorShifts)} frets`);
process.exit(failures ? 1 : 0);
