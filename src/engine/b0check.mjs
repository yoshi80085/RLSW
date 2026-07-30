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
import { chordContext, classifyTrack, countUnpardoned, countPardonedByStack, modeFromStack, harmonicLock, stackContext, chromaticPayout, discordPenaltyFor } from "../music/context.js";
import { detectChromaticRun } from "../music/cadence.js";
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
    const d = modeFromStack(ns.driveStack, ns.unlockedSkills ?? [], ns.scaleMode);
    assert.equal(d.mode,   ns.scaleMode,  `${id}: seeded mode is the derived mode`);
    assert.equal(d.reason, ns.modeReason, `${id}: seeded reason matches`);
  }
}
console.log("✓ B8 wiring: the initial sheet ships a derived mode, not a pending prompt");

// IDEMPOTENCE ACROSS TURNS. Turn start feeds the previous turn's mode back in as
// `currentMode`. If derivation weren't a fixed point, an untouched stack would
// oscillate the key every turn all by itself — respelling the stock each time.
for (const stack of [['C','E','G'], ['C','D#','G'], ['C','G'], ['C'], [], ['C','D','G'], ['C','C#','D']]) {
  for (const unlocks of [[], MINOR]) {
    let mode = 'major';
    for (let turn = 0; turn < 5; turn++) {
      const next = modeFromStack(stack, unlocks, mode).mode;
      if (turn > 0) assert.equal(next, mode, `${stack.join('-')||'empty'}: mode drifts on turn ${turn}`);
      mode = next;
    }
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

// UNLOCKING MINOR IS A PROMOTION, NEVER A DEMOTION. A 'locked' stack must read
// minor the moment theory_minor lands, and no unlock may ever move a spirit the
// other way (from minor back to major) on the same stack.
for (const stack of [['C','D#','G'], ['C','D#','G','A#'], ['C','D#','F#'], ['C','E','G'], ['C','G']]) {
  const before = modeFromStack(stack, [], 'major');
  const after  = modeFromStack(stack, MINOR, before.mode);
  assert.notEqual(after.reason, 'locked', `${stack.join('-')}: still locked after unlocking`);
  if (before.mode === 'minor') assert.equal(after.mode, 'minor', `${stack.join('-')}: unlock demoted to major`);
  if (before.reason === 'locked') assert.equal(after.mode, 'minor', `${stack.join('-')}: unlock didn't deliver minor`);
}
console.log("✓ B8 wiring: buying Minor Tonality promotes a locked stack and never demotes any other");

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
    for (const unlocks of [[], MINOR, DOM7, MODES, CHROM]) {
      const cl   = classifyTrack(track, CMAJ, ds, ss, unlocks);
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
console.log("✓ B4 routing:", b4checked, "track×stack×tier combinations — every pardon pays exactly one stack");

// RANK BREAKS THE TIE, AND THE TIE GOES TO DRIVE. A note legal against both
// stacks must be routed to the more sophisticated chord — that's what makes
// building the better stack worth doing — and an actual rank tie must land on
// Drive deterministically rather than by set-iteration accident.
// Both stacks below literally contain D#; only their rank differs.
{
  const dHigh = classifyTrack(['D#'], CMAJ, ['C','D#','F#','A'], ['C','D#','G'], DOM7);
  assert.equal(dHigh[0].stack, 'drive',   'B4: higher-ranked Drive stack should claim the note');
  const sHigh = classifyTrack(['D#'], CMAJ, ['C','D#','G'], ['C','D#','F#','A'], DOM7);
  assert.equal(sHigh[0].stack, 'sustain', 'B4: higher-ranked Sustain stack should claim the note');
  // Same chord id on both sides → same rank → Drive.
  const tie = classifyTrack(['D#'], CMAJ, ['C','D#','G'], ['C','D#','G'], DOM7);
  assert.equal(tie[0].stack, 'drive', 'B4: rank tie must go to Drive');
  // Run the tie 20× to be sure it is decided by rank, not by iteration order.
  for (let i = 0; i < 20; i++) {
    assert.equal(classifyTrack(['D#'], CMAJ, ['C','D#','G'], ['C','D#','G'], DOM7)[0].stack,
      'drive', 'B4: tie-break is not deterministic');
  }
}
console.log("✓ B4 routing: higher chord rank claims a shared note, ties resolve to Drive every time");

// A PARDON IS A PROMOTION HERE TOO. Buying a tier may add payees but must never
// remove one — if a note paid Drive at theory_dom7 and paid nobody at
// theory_modes, the purchase would have cost the player income.
for (const track of b4tracks) {
  for (const [ds, ss] of b4stacks) {
    let prev = null;
    for (const unlocks of [MINOR, DOM7, MODES, CHROM]) {
      const paid = countPardonedByStack(classifyTrack(track, CMAJ, ds, ss, unlocks));
      const total = paid.drive + paid.sustain;
      if (prev !== null) assert.ok(total >= prev,
        `B4: ${track.join('-')} / ${ds.join('-')||'∅'} — payout dropped from ${prev} to ${total} on unlock`);
      prev = total;
    }
  }
}
console.log("✓ B4 routing: buying a higher tier never reduces what the track pays");

// ── B5: HARMONIC LOCK ───────────────────────────────────────────────────────
// The rank bands, restated from the spec so a template rank change trips here.
{
  const bands = [
    // [stack,                     last note, expected bonus, why]
    [['C','E','G','A#','D'], 'D',  2, 'dom9 rank 7 → +2'],
    [['C','D#','G','A#','D'],'D',  2, 'min9 rank 7 → +2'],
    [['C','E','G','A#'],     'G',  2, 'dom7 rank 6 → +2'],
    [['C','E','G','B'],      'B',  2, 'maj7 rank 6 → +2'],
    [['C','D#','G','A#'],    'A#', 2, 'min7 rank 6 → +2'],
    [['C','D#','F#','A'],    'A',  2, 'dim7 rank 6 → +2'],
    [['C','D#','F#','A#'],   'A#', 2, 'm7b5 rank 6 → +2'],
    [['C','D#','F#'],        'F#', 1, 'dim rank 5 → +1'],
    [['C','E','G#'],         'G#', 1, 'aug rank 5 → +1'],
    [['C','E','G'],          'G',  0, 'maj triad rank 4 → +0'],
    [['C','D#','G'],         'G',  0, 'min triad rank 4 → +0'],
    [['C','D','G'],          'D',  0, 'sus2 rank 3 → +0'],
    [['C','F','G'],          'F',  0, 'sus4 rank 3 → +0'],
    [['C','G'],              'G',  0, 'power rank 2 → +0'],
  ];
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

// ─── B6: THE CHROMATIC RUN — PARDON BECAME PAYOUT ───────────────────────────
// The curve: run of 3 → +3, +1 per note beyond, capped +5. Locked spirits get 0
// however long the run, because before the capstone the run is the risk, not the
// reward — that asymmetry IS the mechanic.
{
  const want = { 0:0, 1:0, 2:0, 3:3, 4:4, 5:5, 6:5, 7:5, 8:5, 12:5 };
  for (const [len, db] of Object.entries(want)) {
    assert.equal(chromaticPayout(Number(len), CHROM).db, db,
      `B6: a run of ${len} at theory_chromatic must pay ${db}`);
    assert.equal(chromaticPayout(Number(len), CHROM).runLen, Number(len),
      'B6: the payout must report the run length it scored, for the flash copy');
  }
  // Every tier BELOW the capstone pays nothing, at every run length.
  for (const tier of [NONE, MINOR, DOM7, MODES]) {
    for (let len = 0; len <= 8; len++) {
      assert.equal(chromaticPayout(len, tier).db, 0,
        `B6: a run of ${len} must pay 0 without theory_chromatic (tier ${JSON.stringify(tier)})`);
    }
  }
  // Monotonic and capped — no run length is ever worth less than a shorter one.
  for (let len = 1; len <= 12; len++) {
    const a = chromaticPayout(len - 1, CHROM).db, b = chromaticPayout(len, CHROM).db;
    assert.ok(b >= a, `B6: run ${len} must not pay less than run ${len - 1}`);
    assert.ok(b <= 5, 'B6: the payout is hard-capped at +5');
  }
  // Garbage in → 0 out, not NaN. This feeds an arithmetic chain into the Db meter.
  for (const junk of [undefined, null, NaN, Infinity, -3, 'four', {}]) {
    const r = chromaticPayout(junk, CHROM);
    assert.equal(r.db, 0, `B6: ${String(junk)} must pay 0, not NaN`);
    assert.ok(Number.isFinite(r.db), 'B6: the payout is always a finite number');
  }
  // A Set of skills must work identically to an array (callers pass both).
  assert.equal(chromaticPayout(4, new Set(CHROM)).db, 4, 'B6: skills as a Set behave as an array');
}
console.log("✓ B6: chromatic payout curve — 3/4/5+ → 3/4/5 capped, zero below the capstone, monotonic, NaN-safe");

// B6 reads the SAME detector the old pardon read, so the spec's example tracks
// must actually register as runs. A payout gated on a length nothing produces is
// a payout that never fires.
{
  assert.equal(detectChromaticRun(['C','C#','D']), 3, 'B6: three semitone steps is a run of 3');
  assert.equal(detectChromaticRun(['C','C#','D','D#','E']), 5, 'B6: five ascending semitones is a run of 5');
  assert.equal(detectChromaticRun(['E','D#','D','C#']), 4, 'B6: descending counts too');
  assert.equal(detectChromaticRun(['C','C#','D','F','G']), 3, 'B6: the run need not span the whole track');
  assert.equal(detectChromaticRun(['C','C#','C','C#']), 0, 'B6: direction must be consistent — zigzag is not a run');
  assert.equal(detectChromaticRun(['C','D','E']), 0, 'B6: whole steps are not a chromatic run');
  // End to end: the spec's headline case.
  assert.equal(chromaticPayout(detectChromaticRun(['C','C#','D','D#','E']), CHROM).db, 5,
    'B6: a 5-note chromatic run at the capstone pays the +5 cap');
  assert.equal(chromaticPayout(detectChromaticRun(['C','C#','D']), CHROM).db, 3,
    'B6: the minimum qualifying run pays the +3 base');
}
console.log("✓ B6: detectChromaticRun feeds the payout — the spec's tracks register at the lengths it prices");

// ⚠️ B6 DOUBLE-PAYS WITH B4, BY DECISION. This group DOCUMENTS that as intended
// rather than guarding against it, so a future reader can tell a deliberate
// overlap from a bug. The decision and its three reasons are at `chromaticPayout`.
{
  // C-C#-D over a C-E-G drive stack at the capstone. C and D are in the C major
  // key; C# is off-scale and the Approach Notes tier pardons it because the NEXT
  // note (D)... is not a chord tone. So take a run that DOES resolve onto one:
  // A#-B-C into C-E-G — C is a chord tone, so B is pardoned as an approach note.
  const keyC  = [0,2,4,5,7,9,11];
  const track = ['G','A#','B','C'];
  const cls   = classifyTrack(track, keyC, ['C','E','G'], [], CHROM);
  const paid  = countPardonedByStack(cls);
  assert.equal(detectChromaticRun(track), 3, 'B6/B4: A#-B-C is a chromatic run of 3');
  assert.ok(paid.drive + paid.sustain > 0,
    'B6/B4: a run resolving onto a chord tone DOES also earn Drive/Sustain — the double pay is real');
  assert.equal(chromaticPayout(detectChromaticRun(track), CHROM).db, 3,
    'B6/B4: and the same run still collects its full +3 Db — priced knowing it stacks');
  // The other half of the decision: the stacking is NOT automatic. A run that
  // wanders off instead of resolving collects the Db and no colour at all.
  const wander = ['C','C#','D','D#'];
  const wcls   = classifyTrack(wander, keyC, ['C','E','G'], [], CHROM);
  const wpaid  = countPardonedByStack(wcls);
  assert.equal(detectChromaticRun(wander), 4, 'B6/B4: C-C#-D-D# is a run of 4');
  assert.equal(chromaticPayout(4, CHROM).db, 4, 'B6/B4: it earns +4 Db');
  assert.equal(wpaid.drive + wpaid.sustain, 0,
    'B6/B4: but nothing in it resolves onto a chord tone, so it earns no colour — ' +
    'the stacking is a skill gradient, not a flat bonus');
}
console.log("✓ B6/B4: the double pay is deliberate AND conditional — it only stacks where the run resolves");

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
// contract that makes that possible: countUnpardoned only counts notes the chord
// context declined to pardon, so buying a tier can only ever LOWER the penalty.
{
  const keyC  = [0,2,4,5,7,9,11];
  const track = ['C','C#','D#','F#','A#','C'];   // four off-scale notes in C major
  const stack = ['C','E','G','A#'];              // C7 — pardons C#/D#/F#/A# by tier
  let prev = Infinity;
  for (const tier of [NONE, MINOR, DOM7, MODES, CHROM]) {
    const n = countUnpardoned(classifyTrack(track, keyC, stack, [], tier));
    const p = discordPenaltyFor(n);
    assert.ok(p <= prev,
      `B7: buying up the ladder must never RAISE the discord penalty (tier ${JSON.stringify(tier)}: ${p} > ${prev})`);
    prev = p;
  }
  // And at tier 0 this track is expensive — the tax the ladder is sold against.
  assert.equal(discordPenaltyFor(countUnpardoned(classifyTrack(track, keyC, stack, [], NONE))), 3,
    'B7: an untutored spirit playing four wrong notes pays the full floor of 3');
  assert.ok(discordPenaltyFor(countUnpardoned(classifyTrack(track, keyC, stack, [], CHROM))) < 3,
    'B7: the same track costs the capstone spirit less — which is what the 46-Db ladder buys');
}
console.log("✓ B7: penalty falls monotonically as the pardon ladder widens — 3 at tier 0, less at the capstone");

// B6 + B7 on ONE track, the arithmetic the commit site performs:
//   earned = max(0, base + lock + chromRun − discordPenalty)
// The claim being checked is the design one: a chromatic run is never a net loss
// at the capstone, and IS one before it.
{
  const keyC = [0,2,4,5,7,9,11], F = 'F', G = 'G';
  const track = ['C','C#','D','D#','E','F','F#','G'];  // a long run, ending on the 5th
  const stack = ['C','E','G'];
  const runLen = detectChromaticRun(track);
  assert.ok(runLen >= 5, 'B6/B7: the sample track holds a long chromatic run');
  const base = scoreTrackDB(track, F, G);
  for (const [tier, label] of [[NONE, 'tier 0'], [CHROM, 'capstone']]) {
    const n    = countUnpardoned(classifyTrack(track, keyC, stack, [], tier));
    const pen  = discordPenaltyFor(n);
    const pay  = chromaticPayout(runLen, tier).db;
    const lock = base.endingBonus > 0 ? harmonicLock(track[track.length - 1], stack, []).bonus : 0;
    const earned = Math.max(0, base.points + lock + pay - pen);
    if (tier === CHROM) {
      assert.equal(pay, 5, 'B6/B7 capstone: the run pays the +5 cap');
      assert.ok(pay > pen, `B6/B7 capstone: the payout must exceed the penalty (${pay} vs ${pen})`);
      assert.ok(earned > base.points,
        'B6/B7 capstone: the run must leave the track BETTER off than its bare placement score');
    } else {
      assert.equal(pay, 0, 'B6/B7 tier 0: the run pays nothing');
      assert.ok(pen > 0, 'B6/B7 tier 0: and the wrong notes in it still cost');
      assert.ok(earned < base.points,
        'B6/B7 tier 0: so the same track is WORSE than its bare placement score — before the skill it wrecks you');
    }
  }
  // The floor holds even in the worst case: earned can never go negative here.
  for (let n = 0; n <= 12; n++) {
    assert.ok(Math.max(0, 0 + 0 + 0 - discordPenaltyFor(n)) === 0,
      'B6/B7: a scoreless track floors at 0 Db, never negative');
  }
}
console.log("✓ B6+B7 together: the run is a net GAIN at the capstone and a net LOSS below it — the asymmetry the spec asks for");
