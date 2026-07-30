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
import { scoreTrackDB } from "../music/cadence.js";
import { getSpelledPool, pitchIndex, PITCH_INDEX } from "../music/notes.js";
import { chordContext, classifyTrack, countUnpardoned, countPardonedByStack, modeFromStack } from "../music/context.js";
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

// ─── B2: MELODY DB RESCORE ──────────────────────────────────────────────────
// Base halved (floor(len/2) - 1, floored at 0); endings 5th +3 / 4th +2 / oct +1.
// The ladder stays cadential — no 7th/9th ending bonus, by design.
const dbBase = [[1,0],[2,0],[3,0],[4,1],[5,1],[6,2],[7,2],[8,3]];
for (const [len, want] of dbBase) {
  const trk = Array.from({length: len}, (_, i) => ['C','D','E','A','B','D','E','A'][i]);
  assert.equal(scoreTrackDB(trk, 'F', 'G').points, want, `len ${len} → ${want} base`);
}
console.log("✓ B2 base: 0/0/0/1/1/2/2/3 across lengths 1–8 — length is still a slope, not free money");
assert.equal(scoreTrackDB(['C','D','G'], 'F', 'G').points, 3, "5th end +3");
assert.equal(scoreTrackDB(['C','D','F'], 'F', 'G').points, 2, "4th end +2");
assert.equal(scoreTrackDB(['C','D','C'], 'F', 'G').points, 1, "octave end +1");
assert.equal(scoreTrackDB(['C','D','E'], 'F', 'G').points, 0, "no cadence, no ending bonus");
assert.equal(scoreTrackDB(['C','D','E','A','B','D','E','G'], 'F', 'G').points, 6, "best case: 8 notes + 5th end = 6");
assert.equal(scoreTrackDB([], 'F', 'G').points, 0);
console.log("✓ B2 endings: 5th +3 / 4th +2 / octave +1 — best-case track now 6 Db (was 9)");
// Ending bonus does not double-count as an octave when it is also the 5th
assert.deepEqual(scoreTrackDB(['G','D','G'], 'F', 'G').breakdown.filter(b => b.includes('end')), ['5th end +3']);
console.log("✓ B2: ending bonuses are exclusive — a 5th that is also an octave pays once");

// ─── B3: THE CHORD CONTEXT LADDER ───────────────────────────────────────────
const NONE   = [];
const MINOR  = ['theory_minor'];
const DOM7   = ['theory_minor','theory_dom7'];
const MODES  = ['theory_minor','theory_dom7','theory_modes'];
const CHROM  = ['theory_minor','theory_dom7','theory_modes','theory_chromatic'];
const pcs = s => [...s].sort((a,b)=>a-b);
const Bb = 10, E = 4, G = 7, C = 0, Fs = 6, A = 9, Db_ = 1, D = 2, B = 11;

// No tiers → no context at all.
assert.deepEqual(pcs(chordContext(['C','E','G','A#'], ['C'], NONE)), []);
console.log("✓ B3 tier 0: no Theory → the stacks pardon nothing, melody is judged against the key alone");

// theory_minor — Chord Tone Pardon: literal notes only.
assert.deepEqual(pcs(chordContext(['C','E','G'], [], MINOR)), [C, E, G]);
console.log("✓ B3 theory_minor: literal stack notes are pardoned, and nothing else");

// theory_dom7 — Play the Changes. The SPEC CASE: a C-E-G stack pardons the 7th
// the player never placed. (Spec said ♭7 off a C-E-G-B♭ stack, which is
// self-contradictory under subset matching — see context.js. A major triad
// completes to maj7, so the earned note is B; the ♭7 case is the minor triad.)
assert.ok(!chordContext(['C','E','G'], [], MINOR).has(B),  "maj7 NOT pardoned at theory_minor");
assert.ok( chordContext(['C','E','G'], [], DOM7 ).has(B),  "maj7 pardoned at theory_dom7");
assert.ok(!chordContext(['C','D#','G'], [], MINOR).has(Bb), "♭7 NOT pardoned at theory_minor");
assert.ok( chordContext(['C','D#','G'], [], DOM7 ).has(Bb), "♭7 pardoned at theory_dom7");
console.log("✓ B3 theory_dom7: triads hand over their implied 7th — the tier is no longer a no-op");
// A power chord has no third, so no quality to complete — it earns nothing here.
assert.deepEqual(pcs(chordContext(['C','G'], [], DOM7)), [C, G]);
// Already-complete chords gain nothing either; their reward is the 4th slot.
assert.deepEqual(pcs(chordContext(['C','E','G','A#'], [], DOM7)), [C, E, G, Bb]);
console.log("✓ B3 theory_dom7: power chords and complete 7ths gain no extra tones (slot 4 is their payoff)");

// theory_modes — Extensions by quality: ♯4 over major, nat 6 over minor, ♭9+9 over dom.
assert.ok( chordContext(['C','E','G'],      [], MODES).has(Fs), "♯4 over major");
assert.ok( chordContext(['C','D#','G'],     [], MODES).has(A),  "nat 6 over minor");
assert.ok( chordContext(['C','E','G','A#'], [], MODES).has(Db_), "♭9 over dominant");
assert.ok( chordContext(['C','E','G','A#'], [], MODES).has(D),  "9 over dominant");
assert.ok(!chordContext(['C','E','G'],      [], DOM7 ).has(Fs), "♯4 NOT pardoned below theory_modes");
console.log("✓ B3 theory_modes: tensions arrive by chord quality, not as a flat note list");

// Tiers are cumulative — buying up never removes a pardon you already had.
for (const higher of [DOM7, MODES, CHROM]) {
  for (const pc of chordContext(['C','E','G'], ['D'], MINOR)) {
    assert.ok(chordContext(['C','E','G'], ['D'], higher).has(pc), "higher tier keeps lower pardons");
  }
}
console.log("✓ B3: the ladder is monotonic — no purchase is ever a downgrade");

// ── classifyTrack: provenance and B4 routing ──
const keyC = ['C','D','E','F','G','A','B'];
let cls = classifyTrack(['C','D','A#'], keyC, ['C','E','G','A#'], [], DOM7);
assert.deepEqual(cls.map(c => c.inScale), [true, true, false]);
assert.deepEqual(cls.map(c => c.pardonedBy), [null, null, 'literal']);
assert.deepEqual(cls.map(c => c.stack), [null, null, 'drive']);
console.log("✓ B3 classifyTrack: in-scale notes are pardoned by nobody and pay nobody");

// Routing: legal in BOTH → higher chord rank wins.
cls = classifyTrack(['A#'], keyC, ['C','A#'], ['C','E','G','A#'], DOM7);
assert.equal(cls[0].stack, 'sustain', "dom7 (rank 6) outranks the drive cluster");
// Tie goes to Drive.
cls = classifyTrack(['A#'], keyC, ['C','E','G','A#'], ['C','E','G','A#'], DOM7);
assert.equal(cls[0].stack, 'drive', "equal rank → Drive");
console.log("✓ B4 routing: higher chord rank claims the note, ties go to Drive");

// Unpardoned notes are what B7 will count.
cls = classifyTrack(['C','C#','F#'], keyC, ['C','E','G'], [], MINOR);
assert.equal(countUnpardoned(cls), 2, "two off-scale notes, neither in the stacks");
assert.equal(countUnpardoned(classifyTrack(['C','D','E'], keyC, [], [], NONE)), 0);
console.log("✓ B7 input: countUnpardoned isolates exactly the notes still owed a penalty");

// ── Approach Notes: conditional on the NEXT note, so the last note can't use it ──
// C# is chromatic garbage, but E (a chord tone of the C-E-G stack) follows it.
cls = classifyTrack(['C','C#','E'], keyC, ['C','E','G'], [], CHROM);
assert.equal(cls[1].pardonedBy, 'approach', "C# pardoned — it lands on E");
assert.equal(countUnpardoned(cls), 0);
// Same note at the END of the track has no next note and stays a discord.
cls = classifyTrack(['C','E','C#'], keyC, ['C','E','G'], [], CHROM);
assert.equal(cls[2].pardonedBy, null, "a trailing chromatic note is never pardoned");
assert.equal(countUnpardoned(cls), 1);
console.log("✓ B3 theory_chromatic: approach notes must LAND — the final note can never be pardoned by them");
// And the approach tier does nothing without the unlock.
assert.equal(classifyTrack(['C','C#','E'], keyC, ['C','E','G'], [], MODES)[1].pardonedBy, null);
console.log("✓ B3: total chromatic freedom stays locked behind theory_chromatic");

// ── C4 LANDMINE GUARD ──
// The context must never be folded into the key scale. If it were, an off-scale
// note would come back inScale:true and Flair's discord detector would see nothing.
cls = classifyTrack(['A#'], keyC, ['C','E','G','A#'], [], MODES);
assert.equal(cls[0].inScale, false, "⚠️ C4: a pardoned note is still OFF-SCALE — pardon ≠ classification");
assert.equal(cls[0].pardonedBy, 'literal');
console.log("✓ C4 landmine: pardoned notes still report inScale:false — scoring changes, classification doesn't");

const { drive, sustain } = countPardonedByStack(
  classifyTrack(['A#','F#','C#'], keyC, ['C','E','G','A#'], ['D','F#','A'], MODES));
assert.ok(drive >= 1 && sustain >= 1, "both stacks can earn in one track");
console.log(`✓ B4 tally: countPardonedByStack → drive ${drive}, sustain ${sustain} (B4 caps each at +2 at the call site)`);

// ─── NOTE SPELLING — degree-based, mode-free ────────────────────────────────
// Replaces the key-signature pool that mis-spelled 14 borrowed degrees, most
// visibly the blues ♭7 in C (the default root) rendering as "A#".
const SPELL_ROOTS = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
for (const mode of ['major','minor']) {
  for (const r of SPELL_ROOTS) {
    const pool = getSpelledPool(r, mode);
    assert.equal(pool.length, 12, `${r} ${mode}: 12 slots`);
    assert.equal(new Set(pool).size, 12, `${r} ${mode}: no duplicate names`);
    pool.forEach((n, pc) => {
      assert.equal(pitchIndex(n), pc, `${r} ${mode}: ${n} must sit at pc ${pc}`);
      assert.ok(PITCH_INDEX[n] !== undefined, `${r} ${mode}: ${n} must be a resolvable name`);
      assert.ok(n.length <= 2, `${r} ${mode}: ${n} — no double accidentals on a note chip`);
      assert.ok(!['Fb','Cb','B#','E#'].includes(n), `${r} ${mode}: ${n} — white keys never take an accidental`);
    });
  }
}
console.log("✓ speller: all 24 pools are 12 unique, correctly-pitched, chip-readable names");

// The lowered degrees take flat names; the ♯4 takes a sharp name.
for (const r of SPELL_ROOTS) {
  const pool = getSpelledPool(r, 'major'), rp = pitchIndex(r);
  for (const iv of [1, 3, 8, 10]) {
    const n = pool[(rp + iv) % 12];
    assert.ok(!n.includes('#'), `${r}: interval ${iv} is a LOWERED degree — ${n} must not be sharp`);
  }
  const sharp4 = pool[(rp + 6) % 12];
  assert.ok(!sharp4.includes('b'), `${r}: the tritone is a ♯4, never a ♭5 — got ${sharp4}`);
}
console.log("✓ speller: lowered degrees spell flat, the tritone always spells ♯4 (RLSW rock bias)");

// The headline fix, stated as a case rather than a rule.
assert.equal(getSpelledPool('C','major')[10], 'Bb', "the blues ♭7 in C is B♭, not A♯");
assert.equal(getSpelledPool('C','major')[3],  'Eb', "the ♭3 in C is E♭, not D♯");
assert.equal(getSpelledPool('E','major')[2],  'D',  "the ♭7 in E (pc 2) is a plain D");
assert.equal(getSpelledPool('F#','major')[0], 'C',  "the ♯4 of F♯ reads C, not B♯");
console.log("✓ speller: C's blues ♭7 finally reads B♭ — the signature note of the theory_dom7 tier");

// Spelling no longer depends on mode anywhere except the split roots, where the
// ROOT ITSELF is genuinely ambiguous (D♭ major vs C♯ minor) — canonicalRoot's job.
const modeSensitive = SPELL_ROOTS.filter(r =>
  getSpelledPool(r,'major').join() !== getSpelledPool(r,'minor').join());
assert.deepEqual(modeSensitive, ['Db','Ab'], "only the split roots still read mode");
console.log("✓ speller: mode-free for 10 of 12 roots — the last two are the split roots themselves");

// ─── MODE DERIVED FROM THE DRIVE STACK (B8 revision) ────────────────────────
const mk = (stack, unlocks = MINOR, cur = 'major') => modeFromStack(stack, unlocks, cur);
assert.deepEqual(mk(['C','D#','G']),      { mode:'minor', reason:'quality'   }, "minor triad → minor");
assert.deepEqual(mk(['C','D#','G','A#']), { mode:'minor', reason:'quality'   }, "min7 → minor");
assert.deepEqual(mk(['C','D#','F#']),     { mode:'minor', reason:'quality'   }, "dim → minor");
assert.deepEqual(mk(['C','E','G']),       { mode:'major', reason:'quality'   }, "major triad → major");
assert.deepEqual(mk(['C','E','G','A#']),  { mode:'major', reason:'quality'   }, "dom7 → major");
console.log("✓ B8: the Drive Stack's chord quality sets the mode — no prompt, no theory quiz");

// Quality-ambiguous shapes hold the current mode instead of forcing one.
for (const stack of [['C','G'], ['C','D','G'], ['C','F','G'], ['C'], [], ['C','C#','D']]) {
  assert.equal(mk(stack, MINOR, 'minor').mode, 'minor', `${stack.join('-')||'empty'} holds minor`);
  assert.equal(mk(stack, MINOR, 'major').mode, 'major', `${stack.join('-')||'empty'} holds major`);
  assert.equal(mk(stack).reason, 'ambiguous');
}
console.log("✓ B8: power/sus/single/cluster have no third to read — they hold the mode, never flip it");

// A spirit without theory_minor can't be dragged into minor by their own stack.
assert.deepEqual(mk(['C','D#','G'], []), { mode:'major', reason:'locked' },
  "minor stack without theory_minor → hold major, flagged 'locked'");
assert.equal(mk(['C','D#','G'], ['theory_minor']).mode, 'minor');
console.log("✓ B8: theory_minor still gates minor — 'locked' lets the UI advertise the skill at the exact moment it's wanted");

// Turn one, post-B0: the stack is a single seeded note, so nothing is forced.
assert.equal(mk([makeInitialNoteState('test_spirit', () => 0.5).rootNote]).reason, 'ambiguous');
console.log("✓ B8: the B0 single-note seed reads as ambiguous — turn one never force-flips a spirit's mode");
