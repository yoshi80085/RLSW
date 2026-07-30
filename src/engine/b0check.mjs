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
import { chordContext, classifyTrack, countUnpardoned, countPardonedByStack, modeFromStack, harmonicLock, stackContext, discordPenaltyFor } from "../music/context.js";
import { detectChromaticRun } from "../music/cadence.js";
import { skillEligibility, THEORY_DISCORD_GRANTS } from "../engine/systems/skills.js";
import assert from "node:assert";

// ── B0b: derived cap ──
// ⚠️ `theory_chromatic` grants the 6th slot — that is now the capstone's whole
// reason to exist. It used to pay LESS than the rung below it (−0.04 Db measured);
// slots are what make the Theory ladder pay, because a bigger stack is a bigger
// chord for Harmonic Lock to land in.
const cases = [
  [[], 3], [undefined, 3], [['amp_1'], 3], [['theory_major'], 3], [['theory_minor'], 3],
  [['theory_dom7'], 4], [['theory_modes'], 4], [['theory_chromatic'], 4],
  [['theory_dom7','theory_modes'], 5],
  [['theory_dom7','theory_chromatic'], 5], [['theory_modes','theory_chromatic'], 5],
  [['theory_dom7','theory_modes','theory_chromatic'], 6],
  [['theory_major','theory_minor','theory_dom7','theory_modes','theory_chromatic'], 6],
];
// The capstone is the ONLY route to six, and the ladder never goes backwards.
assert.equal(stackCapFor(['theory_dom7','theory_modes','theory_chromatic']), STACK_CAP_MAX,
  'the full Theory ladder reaches the ceiling');
assert.ok(stackCapFor(['theory_dom7','theory_modes']) < STACK_CAP_MAX,
  'slot 6 must be unreachable without theory_chromatic — it is the capstone\'s only product');
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
  const commitDb = (track, skills, ds = stack, ss = []) => {
    const base = scoreTrackDB(track, F, G);
    const lock = base.endingBonus > 0
      ? harmonicLock(track[track.length - 1], ds, ss).bonus : 0;
    const pen  = discordPenaltyFor(countUnpardoned(classifyTrack(track, keyC, ds, ss, skills)));
    return { total: Math.max(0, base.points + lock - pen),
             length: base.points - base.endingBonus, ending: base.endingBonus, lock, pen };
  };

  // 1. A clean line that lands on the 5th of the chord you built pays all three
  //    positive terms — and a triad is enough. This is the headline case, and the
  //    one that used to pay nothing because rank 4 was banded out of the Lock.
  const good = commitDb(['C','D','E','F','G'], NONE);
  assert.ok(good.length > 0, 'four-source: length pays');
  assert.equal(good.ending, 3,   'four-source: a 5th ending pays 3');
  assert.equal(good.lock,   1,   'four-source: landing in a MAJOR TRIAD pays 1 — from turn one, no Theory');
  assert.equal(good.pen,    0,   'four-source: a diatonic line owes nothing');
  assert.equal(good.total,  good.length + 3 + 1, 'four-source: the terms simply add');

  // 2. Every term is reachable at tier 0. A ladder whose first rung is a
  //    prerequisite for being paid at all is the bug this replaced.
  assert.ok(good.total > 0, 'four-source: a tier-0 spirit can earn from every positive term');

  // 3. The penalty is the only negative, it can zero a track but never invert it.
  for (const t of [['C#','D#','F#','G#','A#'], ['C#'], ['C#','D#'], []]) {
    const r = commitDb(t, NONE);
    assert.ok(r.total >= 0, `four-source: ${t.join('-')||'empty'} floored at 0, never negative`);
  }

  // 4. Theory can only ever help. Buying a tier widens the pardon, which can only
  //    shrink the penalty — the one thing an upgrade may never do is cost you.
  const colourful = ['C','Eb','E','F','G'];
  let prev = -1;
  for (const tier of [NONE, MINOR, DOM7, MODES, CHROM]) {
    const r = commitDb(colourful, tier);
    assert.ok(r.total >= prev,
      `four-source: buying Theory LOWERED the payout (${prev} → ${r.total}) on ${colourful.join('-')}`);
    prev = r.total;
  }

  // 5. The chord is load-bearing: the SAME line pays more into a real chord than
  //    into a single note. This is the chord↔melody link, reduced to one assertion.
  const intoChord  = commitDb(['C','D','E','F','G'], NONE, ['C','E','G']);
  const intoNote   = commitDb(['C','D','E','F','G'], NONE, ['C']);
  const intoSeventh= commitDb(['C','D','E','F','G'], NONE, ['C','E','G','Bb']);
  assert.ok(intoChord.total > intoNote.total,
    'four-source: building a chord must beat holding a single note');
  assert.ok(intoSeventh.total > intoChord.total,
    'four-source: and a seventh must beat a triad — the slot ladder has to slope');
}
console.log("✓ Db payout: four sources — length + ending + lock − penalty, all reachable at tier 0");
console.log("✓ Db payout: Theory never lowers it, and a bigger chord always pays more than a smaller one");

// ─── B10: RONIN OWNS THE FIRST RUNG OF THE LADDER ───────────────────────────
// He starts holding `theory_minor` so Wa no Koe amplifies the chord-context system
// instead of being obsoleted by it. Asserted here because the grant is a single
// literal in makeInitialNoteState and nothing else in the codebase would notice if
// it silently disappeared.
{
  const ronin = makeInitialNoteState('cosmic_ronin', () => 0.5);
  const other = makeInitialNoteState('Metalness_Monster', () => 0.5);
  assert.ok(ronin.unlockedSkills.includes('theory_minor'),
    'B10: Ronin must start holding theory_minor');
  assert.ok(ronin.unlockedSkills.includes('amp_1'),
    'B10: and must not have LOST amp_1 to the grant');
  assert.ok(!other.unlockedSkills.includes('theory_minor'),
    'B10: no other spirit starts with a Theory tier');
  assert.deepEqual(other.unlockedSkills, ['amp_1'],
    'B10: every other spirit still starts with amp_1 alone');

  // The grant must actually reach the pardon ladder — the whole point of it.
  const keyC  = [0,2,4,5,7,9,11];
  const stack = ronin.driveStack;              // [root]
  const offNote = ['C#','D#','F#','G#','A#'].find(n => !stack.includes(n)) ?? 'C#';
  // A note LITERALLY in his stack must be pardoned from turn one, with no purchases.
  const cls = classifyTrack([stack[0]], keyC, stack, [], ronin.unlockedSkills);
  const inKey = keyC.includes(pitchIndex(stack[0]));
  if (!inKey) {
    assert.equal(cls[0].pardonedBy, 'literal',
      'B10: Ronin\'s own stack note must be pardoned by the literal tier on turn one');
  }
  // And a spirit WITHOUT the grant must not get that pardon on the same input.
  const clsOther = classifyTrack([stack[0]], keyC, stack, [], other.unlockedSkills);
  if (!inKey) {
    assert.equal(clsOther.pardonedBy ?? clsOther[0].pardonedBy, null,
      'B10: the same note is unpardoned for a spirit without the tier — the grant is what differs');
  }
  void offNote;
}
console.log("✓ B10: Ronin starts holding theory_minor — and it reaches the pardon ladder on turn one");

// B10 must not break the B0a mode invariant: the free tier lets modeFromStack FLIP
// to minor, so it matters that his seed stack is still quality-ambiguous. If the
// grant ever accidentally arrived alongside a minor-third seed, turn one would
// force-flip his key.
{
  const ronin = makeInitialNoteState('cosmic_ronin', () => 0.5);
  assert.deepEqual(ronin.driveStack, [ronin.rootNote],
    'B10: Ronin\'s stack still seeds with the root alone');
  const m = modeFromStack(ronin.driveStack, ronin.unlockedSkills, ronin.scaleMode);
  assert.equal(m.reason, 'ambiguous',
    'B10: a single-note seed has no third to read, so it stays ambiguous even WITH theory_minor');
  assert.equal(m.mode, ronin.scaleMode,
    'B10: so turn one never force-flips his mode despite the free tier');
  // But the tier IS live: give him a real minor stack and he flips, where an
  // ungranted spirit would be held at major with reason 'locked'.
  assert.equal(modeFromStack(['C','D#','G'], ronin.unlockedSkills, 'major').mode, 'minor',
    'B10: a minor third in his stack DOES turn the song minor from turn one');
  assert.equal(modeFromStack(['C','D#','G'], ['amp_1'], 'major').reason, 'locked',
    'B10: the same stack is held at major for a spirit without the tier');
}
console.log("✓ B10: the free tier is live but B0a's ambiguous seed still holds — turn one can't force-flip his key");

// ⚠️ B10's ACCEPTED CONSEQUENCE, asserted so it can't drift into a surprise:
// holding theory_minor satisfies theory_dom7's prereq, so Ronin's ladder is 8 Db
// cheaper than everyone else's. This test DOCUMENTS that as intended.
{
  const ronin = makeInitialNoteState('cosmic_ronin', () => 0.5);
  const dom7  = { id:'theory_dom7', prereq:'theory_minor', dbCost:10 };
  const minor = { id:'theory_minor', prereq:'theory_major', dbCost:8 };
  assert.ok(skillEligibility(dom7, ronin.unlockedSkills).ok,
    'B10: Ronin may target theory_dom7 immediately — accepted consequence of the full grant');
  assert.equal(skillEligibility(dom7, ['amp_1']).reason, 'prereq',
    'B10: a spirit without the tier is blocked on the prereq');
  assert.equal(skillEligibility(minor, ronin.unlockedSkills).reason, 'already',
    'B10: and he cannot re-buy the tier he was given');
  // The arithmetic, in the frame PENDING_CHANGES uses. The doc calls this "a 46-Db
  // ladder", which is list price MINUS theory_major — because theory_major is
  // supposed to be granted free at the start of a spirit's first turn. Both numbers
  // are asserted so the two frames can't be confused for a discrepancy.
  const ladder = { theory_major:6, theory_minor:8, theory_dom7:10, theory_modes:12, theory_chromatic:16 };
  const list = Object.values(ladder).reduce((a,b)=>a+b, 0);
  assert.equal(list, 52, 'B10: all five rungs total 52 Db at list price');
  assert.equal(list - ladder.theory_major, 46,
    'B10: with theory_major free at start, the climb is the 46 Db the doc quotes');
  assert.equal(list - ladder.theory_major - ladder.theory_minor, 38,
    'B10: Ronin skips the 8 Db rung on top of that — his climb is 38, the price of the flagship');
}
console.log("✓ B10: the free tier's accepted cost — Ronin skips a rung, documented not accidental");

// ─── THE INITIAL-SKILL GRANT INVARIANT (bug found during the B9 pass) ───────
// `theory_major` is granted free at the start of a spirit's first turn, and every
// price in PENDING_CHANGES assumes it ("the 46-Db ladder" = 52 list − 6). The grant
// used to be gated on `unlockedSkills.length === 0`, which `amp_1` made permanently
// false, so it NEVER FIRED and every spirit played the pentatonic.
//
// The real gate can't be imported (it's a useEffect inside the component), so what's
// pinned here is the PRECONDITION that broke it: a fresh spirit always has a
// non-empty skill list, therefore emptiness can never be the test.
{
  for (const id of ['test_spirit', 'cosmic_ronin', 'Metalness_Monster', 'intergalactic_0']) {
    const ns = makeInitialNoteState(id, () => 0.5);
    assert.ok((ns.unlockedSkills?.length ?? 0) > 0,
      `${id}: starts with a NON-EMPTY skill list — so "is the list empty" can never gate the grant`);
    assert.ok(!ns.unlockedSkills.includes('theory_major'),
      `${id}: does NOT start holding theory_major — the grant must still have work to do`);
    assert.ok(!ns.initialPickDone,
      `${id}: initialPickDone starts falsy so the grant is reachable on turn one`);
  }
  // And the grant's own condition, evaluated the way the fixed code evaluates it.
  for (const id of ['test_spirit', 'cosmic_ronin']) {
    const ns = makeInitialNoteState(id, () => 0.5);
    const hasScale = (ns.unlockedSkills ?? []).includes('theory_major');
    assert.ok(!hasScale && !ns.targetSkillId && !(ns.upgradesPending ?? 0) && !ns.initialPickDone,
      `${id}: the fixed gate MUST open on turn one`);
    // The old gate, kept as a regression witness: it must be shown to fail.
    const oldGateOpens = !((ns.unlockedSkills?.length ?? 0) > 0);
    assert.equal(oldGateOpens, false,
      `${id}: the OLD emptiness gate stays closed — this is the bug, pinned so it can't return`);
  }
  // Idempotence: once granted, the gate must close.
  const granted = { ...makeInitialNoteState('test_spirit', () => 0.5) };
  granted.unlockedSkills = [...granted.unlockedSkills, 'theory_major'];
  assert.ok((granted.unlockedSkills).includes('theory_major'),
    'the gate closes once the scale is held — no double grant');
}
console.log("✓ initial grant: theory_major's gate opens on turn one for every spirit (the amp_1 emptiness bug is pinned)");

// The grants table is not the list of Theory tiers — `theory_minor` is the first
// rung of the context ladder and is deliberately absent from it. Asserted because
// the two look like they should match and a future reader may try to "fix" it.
{
  assert.ok(!('theory_minor' in THEORY_DISCORD_GRANTS),
    'B9: theory_minor grants no discord id — its scale expansion is handled in playableScale');
  assert.ok(!('theory_major' in THEORY_DISCORD_GRANTS),
    'B9: theory_major grants no discord id either');
  assert.deepEqual(THEORY_DISCORD_GRANTS.theory_chromatic, ['discord_2', 'discord_4'],
    'B9: the capstone still grants maj3 + chromatic palette flags');
  // Every id the table hands out is a discord_N flag, never a skill id — mixing the
  // two would silently grant a context tier through the palette table.
  for (const [skill, ids] of Object.entries(THEORY_DISCORD_GRANTS)) {
    for (const id of ids) {
      assert.match(id, /^discord_\d+$/,
        `B9: ${skill} grants "${id}" — the table may only hand out discord_N palette flags`);
    }
  }
}
console.log("✓ B9: THEORY_DISCORD_GRANTS is a palette table only — it grants no context tiers, by design");

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

