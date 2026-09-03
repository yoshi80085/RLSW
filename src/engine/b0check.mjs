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
import { getSpelledPool, pitchIndex, PITCH_INDEX, canonicalRoot } from "../music/notes.js";
import { chordContext, contextClaim, classifyTrack, countUnpardoned, countPardonedByStack, modeFromStack, harmonicLock, stackContext, discordPenaltyFor } from "../music/context.js";
import { detectChromaticRun } from "../music/cadence.js";
import { skillEligibility } from "../engine/systems/skills.js";
import { SKILL_BY_ID } from "../data/skillTree.js";
import { readFileSync } from "node:fs";
import assert from "node:assert";

// ── 🅰️ B0b: THE DERIVED CAP, PER STACK ──
// ⚠️ THE THREE SEATS ARE FOUND ON THE BOARD, NOT BOUGHT. `theory_chromatic` used
// to sell the sixth; the branch is deleted and a Lost Chord that extends the
// stack's root opens the seat instead (`music/stackSlots.js`, and the ladder's own
// suite is `stackSlotsCheck.mjs`). What is pinned here is the CHOKE POINT: the one
// function every "is this stack full?" test in the game goes through.
const cases = [
  [{}, 'drive', 3], [undefined, 'drive', 3], [{}, 'sustain', 3],
  [{ driveSlots: 1 }, 'drive', 4], [{ driveSlots: 2 }, 'drive', 5], [{ driveSlots: 3 }, 'drive', 6],
  [{ sustainSlots: 1 }, 'sustain', 4], [{ sustainSlots: 3 }, 'sustain', 6],
  // 🎯 The two stacks are independent — Drive's finds never widen Sustain.
  [{ driveSlots: 3 }, 'sustain', 3], [{ sustainSlots: 3 }, 'drive', 3],
  // Clamped at the render ceiling: a seat the HUD cannot draw is not a seat.
  [{ driveSlots: 9 }, 'drive', STACK_CAP_MAX],
  [{ driveSlots: -2 }, 'drive', STACK_CAP_BASE],
];
for (const [ns, which, want] of cases) {
  assert.equal(stackCapFor(ns, which), want,
    `stackCapFor(${JSON.stringify(ns)}, '${which}') → ${want}`);
}
assert.equal(stackCapFor({ driveSlots: 3 }), STACK_CAP_MAX, 'three found seats reach the ceiling');
assert.ok(stackCapFor({ driveSlots: 2 }, 'drive') < STACK_CAP_MAX,
  'seat 6 must stay unreachable until the third find — it is the last rung, not a rounding');
// ⚠️ An array is an un-migrated caller and must fail LOUDLY. The quiet version of
// this caps every stack at 3 forever and nothing in the game would say so.
assert.throws(() => stackCapFor(['theory_dom7']), /ARRAY was passed/,
  'the old unlockedSkills signature throws rather than silently capping at 3');
console.log("✓ stackCapFor: all", cases.length, "per-stack cases correct, and the old signature throws");

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
// One point of base per note, from 2 notes = 5. The 6-note entry arrived with the
// 13th/11th chords that give the Theory capstone's 6th stack slot something to hold.
const base = { 6: 9, 5: 8, 4: 7, 3: 6, 2: 5 };
for (const t of CHORD_TEMPLATES) {
  const n = t.ivals.length, b = base[n];
  assert.ok(b !== undefined,
    `${t.id}: ${n} notes has no base in the Task A curve — extend it rather than exempting the chord`);
  const pair = [t.drive, t.sustain].sort((a,z)=>a-z);
  assert.deepEqual(pair, t.drive === t.sustain ? [b,b] : [b-1,b+1],
    `${t.id}: ${n} notes → base ${b}, got D${t.drive}/S${t.sustain}`);
}
console.log("✓ Task A: all", CHORD_TEMPLATES.length, "templates sit on base±1 for their note count");

// Rank must be monotone in note count — "more notes = stronger chord" is the rule
// Task A exists to enforce, and rank is what Harmonic Lock and B4's routing read.
{
  const byN = {};
  for (const t of CHORD_TEMPLATES) (byN[t.ivals.length] ??= []).push(t.rank);
  const sizes = Object.keys(byN).map(Number).sort((a, z) => a - z);
  for (let i = 1; i < sizes.length; i++) {
    assert.ok(Math.min(...byN[sizes[i]]) >= Math.max(...byN[sizes[i - 1]]),
      `rank must not fall as notes rise: ${sizes[i]}-note chords rank ${Math.min(...byN[sizes[i]])}, ` +
      `${sizes[i - 1]}-note rank up to ${Math.max(...byN[sizes[i - 1]])}`);
  }
  assert.equal(Math.max(...CHORD_TEMPLATES.map(t => t.ivals.length)), STACK_CAP_MAX,
    'the biggest chord must exactly fill the biggest stack — a slot with nothing to hold is a dead skill');
}
console.log("✓ Task A: rank never falls as notes rise, and the biggest chord fills the biggest stack");

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

// ── 🅰️ Gate coherence: each FOUND seat licenses exactly the chord size it opens.
// The rung → chord mapping itself is `stackSlotsCheck.mjs`; what is pinned here is
// that Task A's note-count curve and the seat ladder still agree.
assert.ok(4 > stackCapFor({}, 'drive'), "dom7 unreachable at baseline");
assert.ok(4 <= stackCapFor({ driveSlots: 1 }, 'drive'), "seat 4 makes dom7 buildable");
assert.ok(5 > stackCapFor({ driveSlots: 1 }, 'drive'), "dom9 still unreachable at 4 seats");
assert.ok(5 <= stackCapFor({ driveSlots: 2 }, 'drive'), "seat 5 makes dom9 buildable");
assert.ok(6 <= stackCapFor({ driveSlots: 3 }, 'drive'), "seat 6 makes the 11th/13th buildable");
console.log("✓ B0b gate lines up with Task A: each seat found on the board licenses exactly the chord sizes it opens");

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

// ─── B3: THE CHORD CONTEXT LADDER — 🅱️ UNIVERSAL AND FREE SINCE 2026-09-02 ──
//
// ⚠️ THIS SECTION USED TO BE A TIER TEST AND IS NOW A MECHANIC TEST, and the
// difference matters. It ran every assertion at five tier levels — NONE, MINOR,
// DOM7, MODES, CHROM — and roughly a third of them asserted that a pardon was
// **withheld** below the rung that sold it ("maj7 NOT pardoned at theory_minor").
// The Theory branch is deleted; every tier is live for every Spirit from turn one
// (`PROGRESSION_REWRITE_DESIGN.md` §3), so those withholding assertions describe
// a rule the game no longer has and are removed rather than inverted.
//
// 🎯 What survives is everything that was ever about the MUSIC — which pitch each
// tier reaches, and why — because that is what was actually valuable here and none
// of it changed. `tiersFor` returning all four is asserted once, at the top, since
// it is now the premise the rest of the section rests on.
const pcs = s => [...s].sort((a,b)=>a-b);
const Bb = 10, E = 4, G = 7, C = 0, Fs = 6, A = 9, Db_ = 1, D = 2, B = 11;

// The premise: no stack, no context. ⚠️ NOT "no tiers, no context" any more —
// there is no tier to be without. An empty pair of stacks pardons nothing because
// there is no chord to pardon anything WITH, which is a different and better rule.
assert.deepEqual(pcs(chordContext([], [])), []);
console.log("✓ B3: empty stacks pardon nothing — the melody is judged against the key alone");

// Chord Tone Pardon — literal notes, free, turn one.
assert.deepEqual(pcs(chordContext(['C','E','G'], [])), pcs(new Set([C, E, G, B, Fs])));
console.log("✓ B3 literal: notes sitting in a stack are never Discord — and it costs nobody anything now");

// Play the Changes. THE SPEC CASE: a C-E-G stack pardons the 7th the player never
// placed. (The spec said ♭7 off a C-E-G-B♭ stack, which is self-contradictory
// under subset matching — see context.js. A major triad completes to maj7, so the
// earned note is B; the ♭7 case is the minor triad.)
assert.ok(chordContext(['C','E','G'], []).has(B),   "a major triad hands over its maj7");
assert.ok(chordContext(['C','D#','G'], []).has(Bb), "a minor triad hands over its ♭7");
console.log("✓ B3 chord: triads hand over their implied 7th — the completion is the tier, and everyone has it");
// A power chord has no third, so no quality to complete — it earns nothing here.
// ⚠️ THIS EXCLUSION IS LOAD-BEARING NOW IN A WAY IT WAS NOT BEFORE. It used to be
// balanced by a 46-Db price tag; free, it would hand the ♭7 to the one stack every
// player holds from turn one, for nothing. It is the last thing standing between
// "your chord decides" and "the ♭7 is just clean".
assert.deepEqual(pcs(chordContext(['C','G'], [])), [C, G]);
// Already-complete chords gain no seventh either — theirs is already there.
assert.deepEqual(pcs(chordContext(['C','E','G','A#'], [])), pcs(new Set([C, E, G, Bb, Db_, D])));
console.log("✓ B3 chord: power chords complete to nothing, and complete 7ths gain no phantom eighth");

// Extensions by quality: ♯4 over major, nat 6 over minor, ♭9+9 over dom.
assert.ok(chordContext(['C','E','G'],      []).has(Fs),  "♯4 over major");
assert.ok(chordContext(['C','D#','G'],     []).has(A),   "nat 6 over minor");
assert.ok(chordContext(['C','E','G','A#'], []).has(Db_), "♭9 over dominant");
assert.ok(chordContext(['C','E','G','A#'], []).has(D),   "9 over dominant");
// ⚠️ AND THE QUALITIES WITH NO TENSION TABLE STILL CONTRIBUTE NOTHING. dim, aug,
// sus and power stay at their chord tones — that is what keeps the extension tier
// from quietly pardoning most of the chromatic scale now that it is free.
assert.deepEqual(pcs(chordContext(['C','D#','F#'], [])), pcs(new Set([C, 3, Fs, A])));
console.log("✓ B3 extension: tensions arrive by chord quality, and the untabled qualities stay shut");

// ⛔ MONOTONICITY IS GONE, AND IT DID NOT SURVIVE IN ANY FORM. WORTH READING.
//
// The old assertion was "buying up never removes a pardon you already had" — the
// one property an UPGRADE may never break, and `tiersFor`'s cumulative OR existed
// to guarantee it. Nothing is bought any more, so the obvious replacement is
// "committing a note never removes a pardon". ⚠️ **THAT IS FALSE, and it is false
// by design.** The pardon set is a function of the chord's QUALITY, so changing
// the quality trades one set of legal notes for another:
//
//   C-E-G   → maj  → completes to B (maj7), extends to F♯ (Lydian ♯4)
//   +A♯     → dom7 → already complete, so no B; extends to D♭/D (♭9, 9) instead
//
// The B and the F♯ go grey the instant the B♭ lands. That is `context.js`'s whole
// thesis — "stack a ♭3 and watch which notes go grey" — and B8 deleted the
// declare-your-mode prompt specifically to move that decision into the stack.
//
// 🎯 SO THE INVARIANT WORTH PINNING IS THE DIFFERENT ONE: whatever else moves, a
// note you have LITERALLY PLACED is pardoned, always, at every quality. That is
// the floor the player can reason about without knowing any theory, and it is the
// thing a future "simplification" of `stackContext` would break first.
for (const stack of [['C','E','G'], ['C','E','G','A#'], ['C','D#','G'], ['C','G'], ['C','C#','F#']]) {
  const ctx = chordContext(stack, []);
  for (const n of stack) {
    assert.ok(ctx.has(pitchIndex(n)),
      `a note literally in the stack ${JSON.stringify(stack)} is always pardoned (${n})`);
  }
}
// And the quality trade is REAL, not theoretical — pinned so it cannot regress
// into silence.
{
  const maj = chordContext(['C','E','G'], []);
  const dom = chordContext(['C','E','G','A#'], []);
  assert.ok(maj.has(B) && !dom.has(B),
    '🎯 committing the ♭7 takes the maj7 away — the chord decides, and the decision has a cost');
  assert.ok(maj.has(Fs) && !dom.has(Fs),
    '🎯 …and swaps Lydian\'s ♯4 for the dominant\'s ♭9/9');
  assert.ok(dom.has(Db_) && dom.has(D), '…which are genuinely there in exchange');
}
console.log("✓ B3: literal notes are pardoned at every quality — and a commit TRADES pardons rather than only adding them");

// ── classifyTrack: provenance and B4 routing ──
const keyC = ['C','D','E','F','G','A','B'];
let cls = classifyTrack(['C','D','A#'], keyC, ['C','E','G','A#'], []);
assert.deepEqual(cls.map(c => c.inScale), [true, true, false]);
assert.deepEqual(cls.map(c => c.pardonedBy), [null, null, 'literal']);
assert.deepEqual(cls.map(c => c.stack), [null, null, 'drive']);
console.log("✓ B3 classifyTrack: in-scale notes are pardoned by nobody and pay nobody");

// Routing: legal in BOTH → higher chord rank wins.
cls = classifyTrack(['A#'], keyC, ['C','A#'], ['C','E','G','A#']);
assert.equal(cls[0].stack, 'sustain', "dom7 (rank 6) outranks the drive cluster");
// Tie goes to Drive.
cls = classifyTrack(['A#'], keyC, ['C','E','G','A#'], ['C','E','G','A#']);
assert.equal(cls[0].stack, 'drive', "equal rank → Drive");
console.log("✓ B4 routing: higher chord rank claims the note, ties go to Drive");

// Unpardoned notes are what B7 will count.
cls = classifyTrack(['C','C#','G#'], keyC, ['C','E','G'], []);
assert.equal(countUnpardoned(cls), 2, "two off-scale notes, neither reachable from the stacks");
assert.equal(countUnpardoned(classifyTrack(['C','D','E'], keyC, [], [])), 0);
console.log("✓ B7 input: countUnpardoned isolates exactly the notes still owed a penalty");

// ── Approach Notes: conditional on the NEXT note, so the last note can't use it ──
// C# is chromatic garbage, but E (a chord tone of the C-E-G stack) follows it.
cls = classifyTrack(['C','C#','E'], keyC, ['C','E','G'], []);
assert.equal(cls[1].pardonedBy, 'approach', "C# pardoned — it lands on E");
assert.equal(countUnpardoned(cls), 0);
// Same note at the END of the track has no next note and stays a discord.
cls = classifyTrack(['C','E','C#'], keyC, ['C','E','G'], []);
assert.equal(cls[2].pardonedBy, null, "a trailing chromatic note is never pardoned");
assert.equal(countUnpardoned(cls), 1);
console.log("✓ B3 approach: approach notes must LAND — the final note can never be pardoned by them");

// ── C4 LANDMINE GUARD ──
// The context must never be folded into the key scale. If it were, an off-scale
// note would come back inScale:true and Flair's discord detector would see nothing.
// ⚠️ THIS GUARD MATTERS MORE NOW, NOT LESS. The temptation the deletion creates is
// "the ladder is free, so just widen `playableScale` and delete the pardon" — which
// is the C4 collapse with a fresh coat of paint, and it would also delete the
// colour payout (`melodyCommit.js`'s `colorDrive`/`colorSustain`).
cls = classifyTrack(['A#'], keyC, ['C','E','G','A#'], []);
assert.equal(cls[0].inScale, false, "⚠️ C4: a pardoned note is still OFF-SCALE — pardon ≠ classification");
assert.equal(cls[0].pardonedBy, 'literal');
console.log("✓ C4 landmine: pardoned notes still report inScale:false — scoring changes, classification doesn't");

const { drive, sustain } = countPardonedByStack(
  classifyTrack(['A#','F#','C#'], keyC, ['C','E','G','A#'], ['D','F#','A']));
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
const mk = (stack, cur = 'major') => modeFromStack(stack, cur);
assert.deepEqual(mk(['C','D#','G']),      { mode:'minor', reason:'quality'   }, "minor triad → minor");
assert.deepEqual(mk(['C','D#','G','A#']), { mode:'minor', reason:'quality'   }, "min7 → minor");
assert.deepEqual(mk(['C','D#','F#']),     { mode:'minor', reason:'quality'   }, "dim → minor");
assert.deepEqual(mk(['C','E','G']),       { mode:'major', reason:'quality'   }, "major triad → major");
assert.deepEqual(mk(['C','E','G','A#']),  { mode:'major', reason:'quality'   }, "dom7 → major");
console.log("✓ B8: the Drive Stack's chord quality sets the mode — no prompt, no theory quiz");

// Quality-ambiguous shapes hold the current mode instead of forcing one.
for (const stack of [['C','G'], ['C','D','G'], ['C','F','G'], ['C'], [], ['C','C#','D']]) {
  assert.equal(mk(stack, 'minor').mode, 'minor', `${stack.join('-')||'empty'} holds minor`);
  assert.equal(mk(stack, 'major').mode, 'major', `${stack.join('-')||'empty'} holds major`);
  assert.equal(mk(stack).reason, 'ambiguous');
}
console.log("✓ B8: power/sus/single/cluster have no third to read — they hold the mode, never flip it");

// 🅱️ EVERY Spirit is dragged into minor by their own stack now — the gate is gone.
assert.deepEqual(mk(['C','D#','G']), { mode:'minor', reason:'quality' },
  "a minor stack turns the song minor, unconditionally");
console.log("✓ B8: minor is not gated — the stack decides the key for everybody, from turn one");

// Turn one, post-B0: the stack is a single seeded note, so nothing is forced.
assert.equal(mk([makeInitialNoteState('test_spirit', () => 0.5).rootNote]).reason, 'ambiguous');
console.log("✓ B8: the B0 single-note seed reads as ambiguous — turn one never force-flips a spirit's mode");

// ─── B8 WIRING: the derived mode reaches the turn flow ──────────────────────
// These cover the invariants the wiring depends on. The React plumbing itself
// (the pendingModeBonus effect, the read-only HUD line) isn't reachable from
// bare node — what IS reachable is every property that plumbing assumes, so if
// one of them stops holding, the failure surfaces here instead of in play.

// The sheet no longer ships a pending pivot, and what it does ship agrees with
// what modeFromStack would derive from its own seeded stack. (If B0's seed ever
// grows a third, this is the check that notices.)
for (const id of ["test_spirit", "cosmic_ronin"]) {
  for (const r of [0.0, 0.31, 0.5, 0.87, 0.99]) {
    const ns = makeInitialNoteState(id, () => r);
    assert.equal(ns.pivotPending, false, `${id}: no pivot to pend at init`);
    const d = modeFromStack(ns.driveStack, ns.scaleMode);
    assert.equal(d.mode,   ns.scaleMode,  `${id}: seeded mode is the derived mode`);
    assert.equal(d.reason, ns.modeReason, `${id}: seeded reason matches`);
  }
}
console.log("✓ B8 wiring: the initial sheet ships a derived mode, not a pending prompt");

// IDEMPOTENCE ACROSS TURNS. Turn start feeds the previous turn's mode back in as
// `currentMode`. If derivation weren't a fixed point, an untouched stack would
// oscillate the key every turn all by itself — respelling the stock each time.
for (const stack of [['C','E','G'], ['C','D#','G'], ['C','G'], ['C'], [], ['C','D','G'], ['C','C#','D']]) {
  let mode = 'major';
  for (let turn = 0; turn < 5; turn++) {
    const next = modeFromStack(stack, mode).mode;
    if (turn > 0) assert.equal(next, mode, `${stack.join('-')||'empty'}: mode drifts on turn ${turn}`);
    mode = next;
  }
}
console.log("✓ B8 wiring: derivation is a fixed point — an unchanged stack never drifts the key");

// RESPELL STABILITY. Turn start respells the carried stock through
// getSpelledPool(canonicalRoot(root, mode), mode). Doing that on five
// consecutive turns must not walk a note's name (Eb → D# → Eb...), or a note the
// player is holding would rename itself while they watch.
for (const root of SPELL_ROOTS) {
  for (const mode of ['major','minor']) {
    const cr   = canonicalRoot(root, mode);
    const pool = getSpelledPool(cr, mode);
    assert.equal(canonicalRoot(cr, mode), cr, `${root} ${mode}: canonicalRoot is not stable`);
    const once  = pool.map(n => pool[pitchIndex(n)]);
    assert.deepEqual(once, pool, `${root} ${mode}: respelling twice changes the names`);
  }
}
console.log("✓ B8 wiring: turn-start respell is stable — held notes never rename themselves");

// 🪦 'LOCKED' IS GONE — THERE IS NOTHING LEFT TO UNLOCK. The block here asserted
// that buying Minor Tonality promoted a stack out of `reason: 'locked'` and never
// demoted another. Minor is free for everybody from turn one (2026-09-02), so the
// promotion has no before-state — every minor stack reads minor immediately.
// ⚠️ Pinned as an ABSENCE, because the client still has a `modeLocked` read and a
// dead amber-badge branch behind it: if 'locked' ever comes back, that badge
// starts firing again for a skill that does not exist.
for (const stack of [['C','D#','G'], ['C','D#','G','A#'], ['C','D#','F#'], ['C','E','G'], ['C','G']]) {
  const m = modeFromStack(stack, 'major');
  assert.notEqual(m.reason, 'locked',
    `${stack.join('-')}: nothing is locked any more — the branch is unreachable`);
}
assert.equal(modeFromStack(['C','D#','G'], 'major').mode, 'minor',
  '🎯 a minor stack turns the song minor on turn one, for every Spirit, free');
console.log("✓ B8 wiring: 'locked' is unreachable — a minor stack delivers minor immediately, for everyone");

// ── B4: COLOR NOTES PAY THE STACK THAT AUTHORIZED THEM ──────────────────────
// The payout itself lives in confirmNoteTrack (React state, not reachable from
// bare node). What IS reachable is every routing invariant that payout assumes,
// so if one stops holding the failure surfaces here instead of in play.
//
// The scale used throughout: C major. Everything outside it is a candidate for
// pardon, and therefore a candidate for payment.
const CMAJ = ['C','D','E','F','G','A','B'];

// The cap B4 applies at the commit site, restated so the arithmetic is pinned
// even though the call site can't be imported. If this formula changes in the
// JSX, this assertion is the reminder that it changed in two places.
const b4cap = n => Math.min(2, n);
assert.deepEqual([0,1,2,3,6].map(b4cap), [0,1,2,2,2], 'B4: cap is min(2, n) per stack');

// EVERY PARDONED NOTE PAYS EXACTLY ONE STACK. If drive + sustain ever came out
// below the pardoned total, some note would be forgiven for free — pardoned by a
// chord but paying nobody, which is the one outcome B4 exists to prevent.
// Above the total would be worse: the same note paid twice.
const b4tracks = [
  ['C','D#','G'], ['C#','D#','F#','G#'], ['A#','B','C'], ['F#','C','G'],
  ['C','E','G','B'], ['D#','F#','A#','C#','E'], ['C','C#','D','D#','E'],
];
const b4stacks = [
  [['C','E','G'],      ['A','C','E']],
  [['C','D#','G'],     ['F','A','C']],
  [['C','E','G','A#'], ['D','F#','A','C']],
  [['C','G'],          []],
  [[],                 []],
  [['C','D#','F#','A'],['G','B','D','F']],
];
let b4checked = 0;
for (const track of b4tracks) {
  for (const [ds, ss] of b4stacks) {
    {
      const cl   = classifyTrack(track, CMAJ, ds, ss);
      const paid = countPardonedByStack(cl);
      const pardoned = cl.filter(c => c.pardonedBy !== null).length;
      assert.equal(paid.drive + paid.sustain, pardoned,
        `B4: ${track.join('-')} / ${ds.join('-')||'∅'} — ${pardoned} pardoned but ${paid.drive + paid.sustain} paid`);
      // Nobody is paid for a note that was never in trouble, and nobody is paid
      // for a note that stayed in trouble.
      for (const c of cl) {
        if (c.inScale) assert.equal(c.stack, null, `B4: in-scale ${c.note} named a paying stack`);
        if (c.pardonedBy === null) assert.equal(c.stack, null, `B4: unpardoned ${c.note} named a paying stack`);
        else assert.ok(c.stack === 'drive' || c.stack === 'sustain',
          `B4: ${c.note} pardoned by ${c.pardonedBy} but routed to ${c.stack}`);
      }
      // The cap can never invent income.
      assert.ok(b4cap(paid.drive)   <= paid.drive,   'B4: cap raised the Drive payout');
      assert.ok(b4cap(paid.sustain) <= paid.sustain, 'B4: cap raised the Sustain payout');
      b4checked++;
    }
  }
}
console.log("✓ B4 routing:", b4checked, "track×stack combinations — every pardon pays exactly one stack");

// RANK BREAKS THE TIE, AND THE TIE GOES TO DRIVE. A note legal against both
// stacks must be routed to the more sophisticated chord — that's what makes
// building the better stack worth doing — and an actual rank tie must land on
// Drive deterministically rather than by set-iteration accident.
// Both stacks below literally contain D#; only their rank differs.
{
  const dHigh = classifyTrack(['D#'], CMAJ, ['C','D#','F#','A'], ['C','D#','G']);
  assert.equal(dHigh[0].stack, 'drive',   'B4: higher-ranked Drive stack should claim the note');
  const sHigh = classifyTrack(['D#'], CMAJ, ['C','D#','G'], ['C','D#','F#','A']);
  assert.equal(sHigh[0].stack, 'sustain', 'B4: higher-ranked Sustain stack should claim the note');
  // Same chord id on both sides → same rank → Drive.
  const tie = classifyTrack(['D#'], CMAJ, ['C','D#','G'], ['C','D#','G']);
  assert.equal(tie[0].stack, 'drive', 'B4: rank tie must go to Drive');
  // Run the tie 20× to be sure it is decided by rank, not by iteration order.
  for (let i = 0; i < 20; i++) {
    assert.equal(classifyTrack(['D#'], CMAJ, ['C','D#','G'], ['C','D#','G'])[0].stack,
      'drive', 'B4: tie-break is not deterministic');
  }
}
console.log("✓ B4 routing: higher chord rank claims a shared note, ties resolve to Drive every time");

// 🪦 "BUYING A TIER NEVER REDUCES WHAT THE TRACK PAYS" — no tiers, no purchases,
// nothing left to assert. ⚠️ AND ITS REPLACEMENT DOES NOT HOLD: a stack COMMIT can
// reduce a track's payout, because changing the chord's quality trades one pardon
// set for another (see the monotonicity note in the B3 section above).
//
// 🎯 SO THE INVARIANT THAT REPLACES IT IS AN ACCOUNTING ONE, and it is the one
// the payout actually depends on: the two stacks' tallies always sum to the number
// of pardoned notes, and neither can be negative — a routing bug that paid a note
// twice, or paid a stack that did not authorise it, shows up here rather than as a
// quiet Db surplus in play. (The per-combination version of this runs above; this
// pins the boundary cases the loop's stack list does not reach.)
for (const track of b4tracks) {
  for (const [ds, ss] of b4stacks) {
    const cl   = classifyTrack(track, CMAJ, ds, ss);
    const paid = countPardonedByStack(cl);
    assert.ok(paid.drive >= 0 && paid.sustain >= 0, 'B4: a stack was paid a negative number of notes');
    assert.equal(paid.drive + paid.sustain, cl.filter(c => c.pardonedBy !== null).length,
      `B4: ${track.join('-')} / ${ds.join('-')||'∅'} — the tallies do not sum to the pardons`);
  }
}
console.log("✓ B4 routing: the two stacks' tallies always sum to the pardons — no note pays twice, none pays nobody");

// ── B5: HARMONIC LOCK ───────────────────────────────────────────────────────
// The rank bands, restated from the spec so a template rank change trips here.
{
  const bands = [
    // [stack,                     last note, expected bonus, why]
    // ⚠️ The 6-note chords exist ONLY to give the Theory capstone's 6th stack slot
    // something to hold. Without them slot 6 evaluated as a plain dom9 — same rank,
    // same payout — and the most expensive skill in the game paid −0.04 Db.
    [['C','E','G','A#','D','A'],  'A',  3, 'dom13 rank 8 → +3 (capstone only)'],
    [['C','D#','G','A#','D','F'], 'F',  3, 'min11 rank 8 → +3 (capstone only)'],
    [['C','E','G','A#','D'], 'D',  2, 'dom9 rank 7 → +2'],
    [['C','D#','G','A#','D'],'D',  2, 'min9 rank 7 → +2'],
    [['C','E','G','A#'],     'G',  2, 'dom7 rank 6 → +2'],
    [['C','E','G','B'],      'B',  2, 'maj7 rank 6 → +2'],
    [['C','D#','G','A#'],    'A#', 2, 'min7 rank 6 → +2'],
    [['C','D#','F#','A'],    'A',  2, 'dim7 rank 6 → +2'],
    [['C','D#','F#','A#'],   'A#', 2, 'm7b5 rank 6 → +2'],
    [['C','D#','F#'],        'F#', 1, 'dim rank 5 → +1'],
    [['C','E','G#'],         'G#', 1, 'aug rank 5 → +1'],
    // ⚠️ TRIADS PAY NOW. These two used to expect +0, which meant the mechanic
    // built to reward "you built a chord and landed on it" ignored the two most
    // musical chords there are — and since the stack cap is 3 until Blues/Dom7 is
    // bought, a triad is the ONLY chord a new player can build. Harmonic Lock
    // measured a flat 0.00 across the first three Theory tiers because of this.
    [['C','E','G'],          'G',  1, 'maj triad rank 4 → +1'],
    [['C','D#','G'],         'G',  1, 'min triad rank 4 → +1'],
    // The floor holds where it should: sus and power chords are still rank < 4 and
    // still pay nothing. "Build a real chord" has to keep meaning something.
    [['C','D','G'],          'D',  0, 'sus2 rank 3 → +0'],
    [['C','F','G'],          'F',  0, 'sus4 rank 3 → +0'],
    [['C','G'],              'G',  0, 'power rank 2 → +0'],
  ];
  // The band table must be monotone in rank — a bigger chord may never pay less.
  {
    let prevRank = -1, prevBonus = -1;
    for (const [stack, last] of [...bands].reverse()) {
      const g = harmonicLock(last, stack, []);
      if (g.rank > prevRank) assert.ok(g.bonus >= prevBonus,
        `B5: rank ${g.rank} pays ${g.bonus} but rank ${prevRank} paid ${prevBonus} — non-monotone`);
      prevRank = g.rank; prevBonus = g.bonus;
    }
  }
  for (const [stack, last, want, why] of bands) {
    const got = harmonicLock(last, stack, []);
    assert.equal(got.bonus, want, `B5: ${why} — got +${got.bonus} on ${stack.join('-')} ending ${last}`);
    assert.equal(got.stack, 'drive', `B5: ${why} — should be claimed by the Drive stack`);
  }
  console.log("✓ B5 Harmonic Lock:", bands.length, "rank bands pay exactly what the spec says");
}

// NOTHING TO LOCK ONTO. A single note and an unrecognized cluster are rank 0 and
// must pay nothing — you cannot collect for landing on a note you merely hold.
for (const stack of [['C'], [], ['C','C#','D'], ['C','C#','D','D#']]) {
  const last = stack[0] ?? 'C';
  const got  = harmonicLock(last, stack, []);
  assert.equal(got.bonus, 0,    `B5: ${stack.join('-')||'empty'} is not a chord and must pay 0`);
  assert.equal(got.stack, null, `B5: ${stack.join('-')||'empty'} must claim nothing`);
  assert.equal(got.rank,  0,    `B5: ${stack.join('-')||'empty'} must report rank 0`);
}
console.log("✓ B5 Harmonic Lock: single notes and clusters pay nothing — rank 0 claims nothing");

// THE LOCK READS THE CHORD, NOT THE PARDON. `tones` excludes the seventh that
// theory_dom7 *implies*, so landing on a maj triad's ♮7 must NOT pay. This is the
// distinction that keeps B5 from paying out on a chord the player didn't build.
{
  const triad = ['C','E','G'];
  const ctx   = stackContext(triad);
  assert.ok(ctx.chordTones.has(11), 'B5 precondition: dom7 tier implies the ♮7 of a C maj triad');
  assert.ok(!ctx.tones.has(11),     'B5: `tones` must NOT contain the merely-implied ♮7');
  assert.equal(harmonicLock('B', triad, []).bonus, 0,
    'B5: landing on an implied 7th is not landing on the chord');
  assert.equal(harmonicLock('B', triad, []).stack, null,
    'B5: an implied 7th must not let a stack claim the ending');
  // And the real thing still pays: place the B and it becomes a maj7.
  assert.equal(harmonicLock('B', ['C','E','G','B'], []).bonus, 2,
    'B5: once the 7th is actually placed, the maj7 pays');
}
console.log("✓ B5 Harmonic Lock: reads what the chord IS, not what a tier implies");

// STACK SELECTION IS B4'S RULE — higher rank wins, ties to Drive. Both stacks
// below contain G; only their rank differs.
{
  assert.equal(harmonicLock('G', ['C','E','G','A#'], ['C','E','G']).stack, 'drive',
    'B5: higher-ranked Drive stack should claim the ending');
  assert.equal(harmonicLock('G', ['C','E','G','A#'], ['C','E','G']).bonus, 2,
    'B5: and should pay its own band, not the loser\'s');
  assert.equal(harmonicLock('G', ['C','E','G'], ['C','E','G','A#']).stack, 'sustain',
    'B5: higher-ranked Sustain stack should claim the ending');
  assert.equal(harmonicLock('G', ['C','E','G'], ['C','E','G','A#']).bonus, 2,
    'B5: Sustain claim pays the Sustain chord\'s band');
  // True tie → Drive, deterministically.
  for (let i = 0; i < 20; i++) {
    assert.equal(harmonicLock('G', ['C','E','G','A#'], ['C','E','G','A#']).stack, 'drive',
      'B5: rank tie must resolve to Drive every time');
  }
  // Only the Sustain stack contains the note → Sustain claims it even at lower rank.
  assert.equal(harmonicLock('F#', ['C','E','G'], ['C','D#','F#']).stack, 'sustain',
    'B5: the only stack containing the note claims it regardless of the other\'s rank');
}
console.log("✓ B5 Harmonic Lock: stack selection matches B4 — higher rank, ties to Drive");

// B5 REQUIRES AN ENDING BONUS TO ESCALATE. That gate lives at the commit site, so
// what's asserted here is the contract it reads: scoreTrackDB must report
// endingBonus/endingKind without the caller parsing display strings.
{
  const F = 'F', G = 'G';
  const fifth  = scoreTrackDB(['C','D','E','G'], F, G);
  assert.equal(fifth.endingBonus, 3,       'scoreTrackDB: 5th ending reports 3');
  assert.equal(fifth.endingKind,  'fifth', 'scoreTrackDB: 5th ending names itself');
  const fourth = scoreTrackDB(['C','D','E','F'], F, G);
  assert.equal(fourth.endingBonus, 2,        'scoreTrackDB: 4th ending reports 2');
  assert.equal(fourth.endingKind,  'fourth', 'scoreTrackDB: 4th ending names itself');
  const oct = scoreTrackDB(['C','D','E','C'], F, G);
  assert.equal(oct.endingBonus, 1,        'scoreTrackDB: octave ending reports 1');
  assert.equal(oct.endingKind,  'octave', 'scoreTrackDB: octave ending names itself');
  const none = scoreTrackDB(['C','D','E','A'], F, G);
  assert.equal(none.endingBonus, 0,    'scoreTrackDB: a non-resolving ending reports 0');
  assert.equal(none.endingKind,  null, 'scoreTrackDB: a non-resolving ending names nothing');
  // endingBonus must be exactly the ending's share of points, never double-counted.
  for (const t of [['C','D','E','G'], ['C','D','E','F'], ['C','D','E','C'], ['C','D','E','A'], ['C'], []]) {
    const r = scoreTrackDB(t, F, G);
    const placement = Math.max(0, Math.floor(t.length / 2) - 1);
    assert.equal(r.points, placement + r.endingBonus,
      `scoreTrackDB: ${t.join('-')||'empty'} — points must equal placement + endingBonus`);
  }
  // The headline number from the spec: a 5th ending into a dom9 stack is 3 + 2 = 5.
  const track = ['C','D','E','F','A','B','D','G'];
  const base  = scoreTrackDB(track, F, G);
  const lock  = harmonicLock(track[track.length - 1], ['C','E','G','A#','D'], []);
  assert.equal(base.endingBonus + lock.bonus, 5, 'B5: 5th end into a dom9 stack must total 5 Db');
}
console.log("✓ B5: scoreTrackDB reports endingBonus/endingKind — the gate B5 reads, no string matching");

// ─── B6: THE CHROMATIC PAYOUT — DELETED ─────────────────────────────────────
// Three assertion groups covered the payout curve, its detector wiring, and the
// deliberate double-pay with B4. All gone with `chromaticPayout` itself.
//
// The reason is the most useful number this project has produced: the payout fired
// on 1% OF COMMITS, worth 0.02 Db each. It was the loud headline at the top of a
// 46-Db skill ladder and the player was never going to see it. Every one of those
// assertions passed, every one of them was correct, and none of them could tell us
// the mechanic was inert — that took `src/engine/dbaudit.mjs`.
//
// ⚠️ TESTS PROVE A MECHANIC WORKS. THEY DO NOT PROVE IT MATTERS. Run the audit
// before adding a Db source, not just b0check after.
//
// `detectChromaticRun` is still live and still tested elsewhere — it flips
// `allInScale`, which feeds the crowd.


// ─── B7: THE DISCORD PENALTY GETS TEETH ─────────────────────────────────────
// penalty = min(3, max(0, unpardoned − 1)). The grace and the floor are both
// load-bearing; see `discordPenaltyFor`.
{
  const want = { 0:0, 1:0, 2:1, 3:2, 4:3, 5:3, 6:3, 8:3 };
  for (const [n, p] of Object.entries(want)) {
    assert.equal(discordPenaltyFor(Number(n)), p,
      `B7: ${n} unpardoned discord${n === '1' ? '' : 's'} must cost ${p}`);
  }
  assert.equal(discordPenaltyFor(1), 0, 'B7: THE FIRST DISCORD IS FREE — the grace is load-bearing');
  assert.equal(discordPenaltyFor(99), 3, 'B7: THE FLOOR IS 3 — a lost track never spirals');
  // Monotonic: more wrong notes may never cost less.
  for (let n = 1; n <= 20; n++) {
    assert.ok(discordPenaltyFor(n) >= discordPenaltyFor(n - 1),
      `B7: ${n} discords must not cost less than ${n - 1}`);
  }
  // Never negative, never NaN — this is subtracted from the Db meter.
  for (const junk of [undefined, null, NaN, -5, -1, 'two', {}, Infinity]) {
    const p = discordPenaltyFor(junk);
    assert.ok(Number.isFinite(p) && p >= 0 && p <= 3,
      `B7: ${String(junk)} must yield a penalty in 0..3, got ${p}`);
  }
  // The old behaviour, stated so the change is unmistakable: it used to be a flat
  // 1 for any number of wrong notes. Two of the eight rows above now differ.
  assert.notEqual(discordPenaltyFor(1), 1, 'B7: one wrong note no longer costs 1 (was flat −1)');
  assert.notEqual(discordPenaltyFor(4), 1, 'B7: four wrong notes no longer cost 1 (was flat −1)');
}
console.log("✓ B7: per-note discord penalty — first free, floored at 3, monotonic, never negative");

// B7 must score from classifyTrack's SETTLED count, not a placement counter. The
// contract that makes that possible: `countUnpardoned` only counts notes the chord
// context declined to pardon.
//
// 🅱️ THE TIER SWEEP IS GONE — the ladder is universal and free (2026-09-02), so
// "buying up never raises the penalty" has no purchases to sweep. **THE STACK IS
// THE LEVER NOW**, and that is the far better assertion: the same wrong notes cost
// a Spirit who built the right chord less than they cost a Spirit holding nothing.
// It used to take 46 Db to make that true; it now takes playing well.
{
  const keyC  = [0,2,4,5,7,9,11];
  const track = ['C','C#','D#','F#','A#','C'];   // four off-scale notes in C major
  const bare  = discordPenaltyFor(countUnpardoned(classifyTrack(track, keyC, [], [])));
  const built = discordPenaltyFor(countUnpardoned(classifyTrack(track, keyC, ['C','E','G','A#'], [])));
  assert.equal(bare, 3,
    'B7: with nothing stacked, four wrong notes pay the full floor of 3');
  assert.ok(built < bare,
    `B7: the SAME track costs less against a C7 stack (${built} < ${bare}) — the chord is what buys the pardon now`);
  // ⚠️ And a stack cannot make things WORSE than holding nothing. This is the one
  // direction that must never invert: a player who commits notes and finds their
  // melody more expensive would be being punished for engaging with the mechanic.
  for (const ds of [['C'], ['C','G'], ['C','E','G'], ['C','D#','G'], ['C','E','G','A#'], ['C','D#','F#','A']]) {
    const p = discordPenaltyFor(countUnpardoned(classifyTrack(track, keyC, ds, [])));
    assert.ok(p <= bare, `B7: stacking ${ds.join('-')} RAISED the penalty (${p} > ${bare})`);
  }
}
console.log("✓ B7: the STACK is what lowers the penalty now — 3 with nothing built, less with a chord, never more");

// ═══ THE Db PAYOUT — FOUR SOURCES ═══════════════════════════════════════════
// The commit-site arithmetic, in full:
//
//   earned = max(0, length + ending + lock − penalty)
//
// Four terms. It used to be nine. This group asserts the shape of the whole
// economy rather than any one mechanic, because the failure this project actually
// suffered was not a broken mechanic — every mechanic passed its own tests — it
// was mechanics quietly stacking up until nobody could read the total.
//
// ⚠️ IF YOU ADD A FIFTH TERM, THIS GROUP SHOULD FAIL AND MAKE YOU JUSTIFY IT.
{
  const keyC = [0,2,4,5,7,9,11], F = 'F', G = 'G';
  const stack = ['C','E','G'];
  // The commit's arithmetic, transcribed. Keep in step with confirmNoteTrack.
  const commitDb = (track, ds = stack, ss = []) => {
    const base = scoreTrackDB(track, F, G);
    const lock = base.endingBonus > 0
      ? harmonicLock(track[track.length - 1], ds, ss).bonus : 0;
    const pen  = discordPenaltyFor(countUnpardoned(classifyTrack(track, keyC, ds, ss)));
    return { total: Math.max(0, base.points + lock - pen),
             length: base.points - base.endingBonus, ending: base.endingBonus, lock, pen };
  };

  // 1. A clean line that lands on the 5th of the chord you built pays all three
  //    positive terms — and a triad is enough. This is the headline case, and the
  //    one that used to pay nothing because rank 4 was banded out of the Lock.
  const good = commitDb(['C','D','E','F','G']);
  assert.ok(good.length > 0, 'four-source: length pays');
  assert.equal(good.ending, 3,   'four-source: a 5th ending pays 3');
  assert.equal(good.lock,   1,   'four-source: landing in a MAJOR TRIAD pays 1 — from turn one, with nothing found');
  assert.equal(good.pen,    0,   'four-source: a diatonic line owes nothing');
  assert.equal(good.total,  good.length + 3 + 1, 'four-source: the terms simply add');

  // 2. Every term is reachable on turn one, with nothing found and nothing bought.
  //    A ladder whose first rung is a prerequisite for being paid at all is the bug
  //    this replaced — and there is no ladder left to be at the bottom of.
  assert.ok(good.total > 0, 'four-source: a turn-one Spirit can earn from every positive term');

  // 3. The penalty is the only negative, it can zero a track but never invert it.
  for (const t of [['C#','D#','F#','G#','A#'], ['C#'], ['C#','D#'], []]) {
    const r = commitDb(t);
    assert.ok(r.total >= 0, `four-source: ${t.join('-')||'empty'} floored at 0, never negative`);
  }

  // 4. 🅱️ Building a chord can only ever help THE PENALTY. The tier sweep this
  //    replaced asserted the same shape about purchases; the lever is the stack now.
  //    ⚠️ Stated about the PENALTY specifically, not the total — the total also
  //    carries Harmonic Lock, which legitimately moves both ways as the chord's
  //    quality changes what the line lands in.
  const colourful = ['C','Eb','E','F','G'];
  const barePen = commitDb(colourful, []).pen;
  for (const ds of [['C'], ['C','E','G'], ['C','D#','G'], ['C','E','G','Bb'], ['C','D#','G','A#','D']]) {
    assert.ok(commitDb(colourful, ds).pen <= barePen,
      `four-source: stacking ${ds.join('-')} RAISED the discord bill on ${colourful.join('-')}`);
  }

  // 5. The chord is load-bearing: the SAME line pays more into a real chord than
  //    into a single note. This is the chord↔melody link, reduced to one assertion.
  const intoChord  = commitDb(['C','D','E','F','G'], ['C','E','G']);
  const intoNote   = commitDb(['C','D','E','F','G'], ['C']);
  const intoSeventh= commitDb(['C','D','E','F','G'], ['C','E','G','Bb']);
  assert.ok(intoChord.total > intoNote.total,
    'four-source: building a chord must beat holding a single note');
  assert.ok(intoSeventh.total > intoChord.total,
    'four-source: and a seventh must beat a triad — the seat ladder has to slope, or finding one is pointless');
}
console.log("✓ Db payout: four sources — length + ending + lock − penalty, all reachable on turn one");
console.log("✓ Db payout: building a chord never raises the discord bill, and a bigger chord always pays more");

// ─── 🪦 B10: THE RONIN'S FREE RUNG IS EVERYBODY'S FLOOR NOW ─────────────────
//
// He started holding `theory_minor` so Wa no Koe amplified the chord-context
// system instead of being obsoleted by it. The pardon ladder is universal and free
// as of 2026-09-02, so his head start is the whole roster's baseline: he lost a
// grant and gained nothing, and everybody else gained what he had.
//
// ⚠️ HE IS MEASURABLY WEAKER RELATIVE TO THE FIELD FOR IT — he opened one rung up
// the game's only shared ladder and that ladder is gone. Wa no Koe still stacks on
// top exactly as designed; whether the character needs something back is a
// CHARACTER question (`CHARACTER_HANDOFF.md`), not something to patch here.
//
// 🎯 What is asserted instead is the property B10 was really protecting: **the
// pardon reaches the ladder on turn one with no purchases.** It used to be true
// for one Spirit and is now true for all of them, which is a strictly stronger
// version of the same check.
{
  const keyC = [0,2,4,5,7,9,11];
  for (const id of ['cosmic_ronin', 'Metalness_Monster', 'intergalactic_0', 'Glamarchy']) {
    const ns = makeInitialNoteState(id, () => 0.5);
    assert.deepEqual(ns.unlockedSkills, [],
      `${id}: nobody is born holding a skill any more — not even the Ronin`);
    const stack = ns.driveStack;                 // [root]
    const inKey = keyC.includes(pitchIndex(stack[0]));
    const cls   = classifyTrack([stack[0]], keyC, stack, []);
    if (!inKey) {
      assert.equal(cls[0].pardonedBy, 'literal',
        `${id}: a note literally in the stack is pardoned on turn one, with nothing bought`);
    }
  }
  // 🎯 AND THE ASYMMETRY IS GONE. The old pair asserted the Ronin got a pardon the
  // Monster did not; pinned in reverse now, because a grant creeping back in for
  // one character is exactly the kind of thing nobody notices.
  const roninNs   = makeInitialNoteState('cosmic_ronin', () => 0.5);
  const monsterNs = makeInitialNoteState('Metalness_Monster', () => 0.5);
  assert.deepEqual(roninNs.unlockedSkills, monsterNs.unlockedSkills,
    '🎯 every Spirit opens with the SAME empty kit — no free tier survives for anyone');
}
console.log("✓ 🅱️ the pardon reaches the ladder on turn one for EVERY Spirit, with nothing bought");

// The B0a mode invariant still has to hold, and it matters more now that minor is
// free: if the seed stack ever grew a third, turn one would force-flip the key for
// the whole roster rather than for one character.
{
  const ronin = makeInitialNoteState('cosmic_ronin', () => 0.5);
  assert.deepEqual(ronin.driveStack, [ronin.rootNote],
    'B0a: the stack still seeds with the root alone');
  const m = modeFromStack(ronin.driveStack, ronin.scaleMode);
  assert.equal(m.reason, 'ambiguous',
    'B0a: a single-note seed has no third to read, so it stays ambiguous');
  assert.equal(m.mode, ronin.scaleMode,
    'B0a: so turn one never force-flips anybody\'s mode');
  assert.equal(modeFromStack(['C','D#','G'], 'major').mode, 'minor',
    '🅱️ …but a real minor third DOES turn the song minor, for everybody, from turn one');
}
console.log("✓ B0a holds under a free minor: the ambiguous seed still can't force-flip a key on turn one");

// 🪦 B10's ACCEPTED CONSEQUENCE IS MOOT — there is no ladder to skip a rung of.
// This block asserted that holding `theory_minor` satisfied `theory_dom7`'s prereq,
// so the Ronin's climb cost 38 Db against everyone else's 46, and pinned the 52 /
// 46 / 38 arithmetic the design docs quote. All three numbers now describe a
// ladder that does not exist.
//
// ⛔ AND THE HOLE THEY LEAVE IS THE FINDING: **52 Db of sink left the game with
// the branch.** `PROGRESSION_REWRITE_DESIGN.md` §5 — per-ability upgrade streams
// on the abilities characters already have — is what replaces it, and §5 IS NOT
// BUILT. Pinned as an alarm rather than deleted quietly, because "Db piles up
// against a tree that cannot absorb it" is a balance state that reads as fine in
// every individual test.
{
  const priced = Object.values(SKILL_BY_ID).reduce((a, sk) => a + (sk.dbCost ?? 0), 0);
  assert.ok(priced > 0, 'the surviving exclusive routes are still priced in Db');
  // 🎯 What a Spirit with NO exclusive route can spend Db on, in total.
  const forGlam = Object.values(SKILL_BY_ID)
    .filter(sk => skillEligibility(sk, [], { ownerRoute: sk.spiritOnly ?? null, selfId: 'Glamarchy' }).ok)
    .reduce((a, sk) => a + (sk.dbCost ?? 0), 0);
  assert.equal(forGlam, 0,
    '⛔ 🎀 Glamarchy has 0 Db of sink available — the shared ladder is gone and §5 has not replaced it');
}
console.log("✓ ⛔ 52 Db of shared sink left with the branch — §5's upgrade streams are the unbuilt replacement");

// ─── 🪦 THE INITIAL-SKILL GRANT INVARIANT — THE GRANT IS GONE, THE LESSON ISN'T ──
//
// `theory_major` used to be granted free at the start of a Spirit's first turn,
// and this block pinned the gate that decided when. The Theory branch is deleted
// (2026-09-02), so there is no grant left to gate — everyone opens on the Major
// Pentatonic BY DESIGN now, and the chord widens it (`music/notes.js`).
//
// 🎯 THE BUG THIS BLOCK EXISTED FOR IS WORTH RE-PINNING IN ITS NEW FORM, because
// it has now bitten twice and the second bite was invisible for a year. The grant
// was gated on `unlockedSkills.length === 0`, and `makeInitialNoteState` seeded
// `["amp_1"]` for everybody — so the gate read true on turn one, always, and the
// grant NEVER FIRED while every price in the design docs assumed it had. When the
// rig branch went, the seed became asymmetric (`theory_minor` for the Ronin
// alone), which would have broken exactly one character and been far harder to
// spot.
//
// ⚠️ THE SEED IS NOW UNIFORMLY EMPTY FOR THE WHOLE ROSTER — nobody is born
// holding a skill. That is the most dangerous version of this trap yet: an
// "emptiness means turn one" shortcut would now be RIGHT for every Spirit on turn
// one and WRONG the moment anybody buys anything, with no asymmetry to give it
// away. So what is pinned is the seed itself, and the fact that emptiness is a
// statement about purchases rather than about time.
{
  for (const id of ['test_spirit', 'cosmic_ronin', 'Metalness_Monster', 'intergalactic_0']) {
    const ns = makeInitialNoteState(id, () => 0.5);
    assert.deepEqual(ns.unlockedSkills, [],
      `${id}: starts holding NOTHING — no Spirit is born with a skill any more`);
    assert.ok(!ns.initialPickDone,
      `${id}: initialPickDone starts falsy`);
    // 🅰️ And no seats are found yet — the board has not been walked.
    assert.equal(ns.driveSlots, 0,   `${id}: opens with no found Drive seats`);
    assert.equal(ns.sustainSlots, 0, `${id}: opens with no found Sustain seats`);
  }
  // ⚠️ THE REGRESSION WITNESS. Emptiness is now uniform, so it can no longer be
  // caught by asymmetry — it is caught by saying out loud that a NON-empty list
  // means "has bought something", never "is past turn one".
  const bought = { ...makeInitialNoteState('test_spirit', () => 0.5), unlockedSkills: ['tentacle'] };
  assert.equal((bought.unlockedSkills ?? []).length === 0, false,
    '🎯 a Spirit who has bought something is not empty — which is the ONLY thing emptiness has ever meant');
  assert.ok(!bought.initialPickDone,
    '🎯 …and they can still be on turn one. Emptiness is not a clock. Do not write a third version of this bug.');
}
console.log("✓ initial state: every Spirit opens with no skills and no found seats — the amp_1 emptiness trap is pinned in its third form");

// 🪦 The `THEORY_DISCORD_GRANTS` block lived here — it asserted that the palette
// table granted no context tiers. The table is deleted with the branch
// (`systems/skills.js`).
//
// ✅ UPDATED 2026-09-02i — THE HOLE IT LEFT IS CLOSED, AND IT WAS BIGGER THAN
// THIS FILE RECORDED. The note said "the three unlock-gated endings are now
// unreachable". The set was FOUR (`MELODY_IDENTITY_DESIGN.md` §5.6): the fourth,
// `discord_4`, gated `chromClimbActive` — the `allInScale` override that lets a
// chromatic run be forgiven by the CROWD. Its knock-on was that `hasGatedEnding`
// became a permanently-`false` input to `performanceScore`, i.e. a crowd seat the
// game was about to re-weight per character could not fire.
//
// ⚠️ SO THE THING TO PIN IS NO LONGER "NOTHING GRANTS THESE IDS" — that is still
// true and still asserted below, but it is no longer load-bearing. What must not
// come back is the GATE: `melodyCommit.js` must not read `discordUnlocks` at all,
// because re-granting the ids to wake the endings would also widen `keyScale` and
// delete the colour payout §5-seats deliberately kept (everyone stays pentatonic).
{
  for (const id of ['test_spirit', 'cosmic_ronin', 'Metalness_Monster', 'intergalactic_0']) {
    const ns = makeInitialNoteState(id, () => 0.5);
    assert.deepEqual(ns.discordUnlocks ?? [], [],
      `${id}: opens with no colour-note unlocks`);
  }
  // ⛔ AND NOTHING IN THE GAME GRANTS ONE ANY MORE. The only writer was the Theory
  // ladder. Pinned as a FINDING: when §4's ending fork lands, this is expected to
  // fail and the fix is to assert the new rule.
  const src = readFileSync(new URL('./systems/skills.js', import.meta.url), 'utf8');
  assert.ok(!/export const THEORY_DISCORD_GRANTS/.test(src),
    '⛔ the palette table is deleted, not emptied — reviving a Theory grant must fail to import');

  // ✅ AND THE KERNEL NO LONGER ASKS. Four flags used to be ANDed with membership
  // of this array; all four are unconditional now, so the endings and the crowd's
  // chromatic pardon depend on the MUSIC rather than on a purchase nobody can make.
  // ⚠️ A source assertion rather than a behavioural one because the failure being
  // guarded is a REVIVAL — someone "fixing" the dead ids by re-granting them, which
  // would quietly widen `keyScale` and take the colour payout with it.
  const kernel = readFileSync(new URL('./systems/melodyCommit.js', import.meta.url), 'utf8');
  const live = kernel.split('\n').filter(l => l.includes('discordUnlocks') && !l.trimStart().startsWith('//'));
  assert.deepEqual(live, [],
    `⛔ the melody kernel must not gate on \`discordUnlocks\` — found: ${live.join(' | ')}`);
}
console.log("✓ ✅ the four colour flags are UNGATED — the endings and the crowd's chromatic pardon no longer need a purchase nobody can make");


// ═══ STACK-COLOURED NOTE STOCK — contextClaim + payout routing ══════════════
// The note stock stopped lighting pardoned notes gold and started lighting them
// with the COLOUR OF THE STACK THAT GETS PAID: Drive red, Sustain blue, and an
// alternating pulse when both qualify and the player picks at commit.
//
// The whole feature rests on one property — the colour on the hex and the Db the
// note earns must come from the same decision. `contextClaim` (the highlight) and
// `classifyTrack` (the settlement) are separate entry points, so that property is
// only true as long as both keep routing through `claimAt`. These assertions are
// what will fail if someone "optimizes" one of them into its own logic.
{
  const [C, Cs, D, Eb, E, F, Fs, G, Ab, A, Bb, B] = [0,1,2,3,4,5,6,7,8,9,10,11];
  void Cs; void D; void F; void Fs; void A;

  // ── 🅱️ NO STACKS, NO CLAIM. This used to read "below theory_minor nothing is
  //    claimed"; the tier is free now, so what makes a claim impossible is having
  //    built nothing to claim WITH. ⚠️ The `null` return is load-bearing either way
  //    — the note stock paints its hexes off it, and `null` is what "leave this hex
  //    plain" means.
  assert.equal(contextClaim(E, [], []), null,
    'contextClaim: with nothing stacked nothing is claimed — the melody is judged against the key alone');

  // ── Single-stack attribution, both directions. ──
  const dOnly = contextClaim(Eb, ['C','Eb','G'], ['C','E','G']);
  assert.equal(dOnly?.stack, 'drive',   'a note only the Drive stack holds pays Drive');
  assert.equal(dOnly?.both,  false,     '…and is not dual-legal');
  const sOnly = contextClaim(Eb, ['C','E','G'], ['C','Eb','G']);
  assert.equal(sOnly?.stack, 'sustain', 'a note only the Sustain stack holds pays Sustain');
  assert.equal(sOnly?.both,  false,     '…and is not dual-legal');

  // ── `both` fires only when each stack legalizes the pitch INDEPENDENTLY. ──
  // Identical stacks: every literal note is claimed twice, tie → Drive.
  const dual = contextClaim(G, ['C','E','G'], ['C','E','G']);
  assert.equal(dual?.both,  true,    'a pitch in BOTH stacks is dual-legal');
  assert.equal(dual?.stack, 'drive', '…and defaults to Drive on a rank tie');
  // Rank tie-break: the Sustain stack spells a richer chord, so it claims a note
  // both reach — the highlight must follow the payout, not alphabetical order.
  const ranked = contextClaim(Bb, ['C','E','G','Bb'], ['C','E','G','Bb','D']);
  assert.equal(ranked?.both, true, 'shared ♭7 is dual-legal at the chord tier');
  assert.equal(ranked?.stack, 'sustain',
    'the higher-ranked chord claims a shared note — same rule classifyTrack settles with');

  // ── THE LOAD-BEARING ONE: highlight and settlement never disagree. ──
  // Every pitch class, against a stack pair chosen so the two disagree if anything
  // is re-derived rather than shared. keyScale is empty so nothing is in-scale and
  // every pardon is visible.
  {
    // 🅱️ The tier sweep is gone; the STACK PAIRS are the sweep now, which is a
    // wider net than the tiers ever were — each pair reaches a different rung.
    for (const [drive, sustain] of [
      [['C','E','G'],      ['C','Eb','G','Bb']],   // maj triad vs min7
      [['C','G'],          ['C','E','G','Bb']],    // power (completes to nothing) vs dom7
      [['C','Eb','Gb'],    ['C','E','G']],         // dim (no tensions) vs maj
      [['C'],              []],                    // single note vs nothing
      [['C','E','G','Bb','D'], ['C','Eb','G','Bb','D']],  // dom9 vs min9
    ]) {
      for (let pc = 0; pc < 12; pc++) {
        const note = getSpelledPool('C', 'major')[pc];
        const claim = contextClaim(pc, drive, sustain);
        const [settled] = classifyTrack([note], [], drive, sustain);
        assert.equal(claim === null, settled.pardonedBy === null,
          `pc ${pc}: the hex lights iff the note is actually pardoned`);
        if (claim) {
          assert.equal(claim.stack, settled.stack,
            `pc ${pc}: the colour on the hex must be the stack that gets paid`);
          assert.equal(claim.both, settled.both,
            `pc ${pc}: the alternating pulse must match the routable flag`);
        }
      }
    }
  }
}
console.log("✓ note stock: contextClaim and classifyTrack agree on every pitch — the hex colour IS the payee");

{
  const drive = ['C','E','G'], sustain = ['C','E','G'];   // identical → everything dual
  const track = ['E', 'G', 'E'];                          // three dual-legal notes

  // Omitting `routing` must reproduce the old behaviour exactly. Anything else
  // silently rescores every existing save and every bot turn.
  const base = classifyTrack(track, [], drive, sustain);
  assert.deepEqual(base.map(c => c.stack), ['drive','drive','drive'],
    'no routing map → the claimAt default stands, unchanged');
  assert.deepEqual(countPardonedByStack(base), { drive: 3, sustain: 0 },
    'and the tally is what it was before routing existed');

  // Routing is keyed by TRACK INDEX, not by note — the same pitch at two positions
  // must be independently routable, or a repeated note becomes un-splittable.
  const split = classifyTrack(track, [], drive, sustain, { 0: 'sustain', 2: 'drive' });
  assert.deepEqual(split.map(c => c.stack), ['sustain','drive','drive'],
    'routing is per-index — the same pitch can pay different stacks at different positions');
  assert.deepEqual(countPardonedByStack(split), { drive: 2, sustain: 1 },
    'the tally follows the routing');

  // ── Routing may REDIRECT a pardon, never CREATE one. ──
  // A note only Drive legalizes cannot be handed to Sustain: Sustain didn't earn
  // it. This is the guard that keeps the choice a tactical one rather than a free
  // +Db button, so it gets the fuzz.
  {
    const d = ['C','E','G'], s = ['D','F#','A'];
    for (let pc = 0; pc < 12; pc++) {
      const note = getSpelledPool('C', 'major')[pc];
      const [plain] = classifyTrack([note], [], d, s);
      for (const forced of ['drive', 'sustain']) {
        const [bent] = classifyTrack([note], [], d, s, { 0: forced });
        assert.equal(bent.pardonedBy, plain.pardonedBy,
          `pc ${pc}: routing must never change WHETHER a note is pardoned`);
        if (!plain.both) {
          assert.equal(bent.stack, plain.stack,
            `pc ${pc}: a note only one stack legalized cannot be routed to the other`);
        }
      }
    }
  }

  // Garbage in the map is inert — a stale key, a bad value, a negative index.
  const junk = classifyTrack(track, [], drive, sustain,
    { 0: 'bass', 7: 'sustain', '-1': 'sustain', x: 'sustain' });
  assert.deepEqual(junk.map(c => c.stack), base.map(c => c.stack),
    'a malformed or stale routing map changes nothing');
  assert.deepEqual(classifyTrack(track, [], drive, sustain, null).map(c => c.stack),
    base.map(c => c.stack), 'a null routing map is the same as none');

  // In-scale notes are nobody's to route — they were never Discord, so no stack
  // earned them and none may be paid for them.
  const inScale = classifyTrack(['E'], ['E'], drive, sustain, { 0: 'sustain' });
  assert.equal(inScale[0].inScale, true);
  assert.equal(inScale[0].stack, null, 'an in-scale note cannot be routed to a stack');
  assert.equal(inScale[0].both,  false, 'and is never marked dual-legal');
}
console.log("✓ payout routing: per-index, redirect-only, inert on garbage — and identical to the old scoring when omitted");

// ═══ TASK C — STYLE — DELETED ═══════════════════════════════════════════════
// Six assertion groups covered C4 (the three styles' chord-context reads, the
// landmine, the Groove root-bonus witness, Flair's Outside) and C1 (preview/commit
// agreement, the voice-roll floor). All are gone with the Style system.
//
// Two of them are worth remembering rather than merely deleting:
//
//  • The C1 preview/commit fuzz FOUND A REAL BUG that had nothing to do with C1 —
//    the mic voice roll could append a note that erased a Groove spirit's root
//    landing. A fuzz that compares two paths finds things neither path's own tests
//    would. That technique should come back when there are two paths again.
//
//  • That same fuzz was itself wrong on its first run: it seeded an LCG and drew
//    with `seed % n`, and an LCG's low bits are degenerate — `rnd(2)` returned 0 on
//    99.7% of draws, so it generated almost exclusively descending runs while
//    reporting 4000 cases of coverage. Any future fuzz in this file must take the
//    HIGH bits (`seed >>> 15`). Cheap mistake, invisible symptom, worthless test.

