// ─── A + B0 CHECK ───────────────────────────────────────────────────────────
// Standalone coverage for Task A (chord strength curve) and B0 (single-note
// seed + earned stack capacity). Run: `node src/engine/b0check.mjs`
//
// Why this is separate from selftest.mjs: selftest imports the style/legend
// modules, which reach `data/spirits.js`, which imports .png standees. Bare
// node can't resolve those (Vite loader only), so `npm run test:engine` throws
// ERR_UNKNOWN_FILE_EXTENSION before any assertion runs. That breakage is
// PRE-EXISTING and unrelated to A/B0. This file imports only pure modules, so
// it runs anywhere. Fold these cases back into selftest once the png import
// chain is fixed.
import { STACK_CAP_BASE, STACK_CAP_MAX, stackCapFor } from "../data/gameConstants.js";
import { makeInitialNoteState } from "../engine/systems/economy.js";
import { evaluateChord, CHORD_TEMPLATES } from "../music/chords.js";
import assert from "node:assert";

// ── B0b: derived cap ──
const cases = [
  [[], 3], [undefined, 3], [['amp_1'], 3], [['theory_major'], 3], [['theory_minor'], 3],
  [['theory_dom7'], 4], [['theory_modes'], 4], [['theory_dom7','theory_modes'], 5],
  [['theory_major','theory_minor','theory_dom7','theory_modes','theory_chromatic'], 5],
];
for (const [sk, want] of cases) assert.equal(stackCapFor(sk), want, `stackCapFor(${JSON.stringify(sk)}) → ${want}`);
console.log("✓ stackCapFor: all", cases.length, "unlock combinations correct");

// ── B0a: single-note seed ──
for (const id of ["test_spirit", "cosmic_ronin"]) {
  const ns = makeInitialNoteState(id, () => 0.5);
  assert.deepEqual(ns.driveStack, [ns.rootNote]);
  assert.deepEqual(ns.sustainStack, [ns.rootNote]);
  assert.deepEqual(ns.chordStack, [ns.rootNote]);
  const seed = evaluateChord(ns.driveStack);
  assert.equal(seed.id, 'single', 'seed reads as a Single note');
  assert.equal(seed.drive, 3); assert.equal(seed.sustain, 3);
}
console.log("✓ B0a: stacks seed [root] → Single note D3/S3 (was power chord D5/S5)");

// ── Task A: note-count curve ──
const base = { 5: 8, 4: 7, 3: 6, 2: 5 };
for (const t of CHORD_TEMPLATES) {
  const n = t.ivals.length, b = base[n];
  const pair = [t.drive, t.sustain].sort((a,z)=>a-z);
  assert.deepEqual(pair, t.drive === t.sustain ? [b,b] : [b-1,b+1],
    `${t.id}: ${n} notes → base ${b}, got D${t.drive}/S${t.sustain}`);
}
console.log("✓ Task A: all", CHORD_TEMPLATES.length, "templates sit on base±1 for their note count");

// Major triad no longer punished
const maj = evaluateChord(['C','E','G']);
assert.equal(maj.id, 'maj'); assert.equal(maj.drive, 5);
console.log(`✓ Major triad now D${maj.drive}/S${maj.sustain} (was D4/S7) — no longer punished in the Drive Stack`);
const cl = evaluateChord(['C','C#','D']);
assert.equal(cl.id, 'cluster'); assert.equal(cl.drive, 3); assert.equal(cl.sustain, 2);
console.log(`✓ Tone cluster now D${cl.drive}/S${cl.sustain} (was D7/S1) — no longer a free drive engine`);

// Monotonic power by note count
const dom9 = evaluateChord(['C','E','G','A#','D']), dom7 = evaluateChord(['C','E','G','A#']), pow = evaluateChord(['C','G']);
assert.ok(dom9.drive+dom9.sustain > dom7.drive+dom7.sustain);
assert.ok(dom7.drive+dom7.sustain > maj.drive+maj.sustain);
assert.ok(maj.drive+maj.sustain > pow.drive+pow.sustain);
console.log(`✓ total power is monotonic in note count: power ${pow.drive+pow.sustain} < triad ${maj.drive+maj.sustain} < dom7 ${dom7.drive+dom7.sustain} < dom9 ${dom9.drive+dom9.sustain}`);

// ── Gate coherence: a 4-note chord is unreachable until theory_dom7 ──
assert.ok(4 > stackCapFor([]), "dom7 unreachable at baseline");
assert.ok(4 <= stackCapFor(['theory_dom7']), "theory_dom7 makes dom7 buildable");
assert.ok(5 > stackCapFor(['theory_dom7']), "dom9 still unreachable at 4 slots");
assert.ok(5 <= stackCapFor(['theory_dom7','theory_modes']), "theory_modes makes dom9 buildable");
console.log("✓ B0b gate lines up with Task A: each Theory tier unlocks exactly the chord sizes it licenses");
