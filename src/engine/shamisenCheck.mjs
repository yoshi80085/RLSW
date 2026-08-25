// ─── 🎸 CURSED SHAMISEN CHECK ────────────────────────────────────────────────
// `npm run test:shamisen`. Pins the pure half of the haunting Ronin feeds:
// `feedShamisenPhrase`, `shamisenNextPc`, `shamisenResolvingPc` and
// `shamisenRings` in `music/cadence.js`, plus the constants they are driven by.
// `RONIN_ABILITY_DESIGN.md` §2.3 is the spec.
//
// ⚠️ THIS FILE EXISTS BECAUSE `test:all` CAME BACK BYTE-IDENTICAL AFTER THE
// REWORK, AND THAT IS THE WARNING, NOT THE WIN. The 2026-08-25 pass changed what
// the ability attacks (`tempSustain`+Vibe → the `sustainStack`), deleted its
// lifespan outright, gave it a radius that grows, and added an exorcism verb the
// game did not have — and all seventeen suites returned the same counts they
// returned before. That can only mean one thing: NOTHING ASSERTED OVER THIS
// ABILITY AT ALL. It is the same shape as the Sunbeam hole `RONIN_ABILITY_
// DESIGN.md` §7.5 caught, and the same lesson: an unchanged count after a real
// change is a hole, not a pass.
//
// 📌 WHAT THIS FILE CANNOT REACH, STATED SO NOBODY MISTAKES IT FOR COVERAGE.
// The Shamisen's tick, wander, bite, summon guard and exorcism click all live in
// `rlsw-simulator-v3_8_1.jsx` — the ~16.5k-line client monolith — and no harness
// can drive them today. What is asserted here is the phrase logic those callers
// depend on. The rest is covered by `check:bundle` and eyes, which is a real gap
// and is exactly why the pure parts were lifted OUT of the monolith in the same
// pass rather than written inline where they would be untestable.

import assert from "node:assert";
import {
  feedShamisenPhrase, shamisenNextPc, shamisenResolvingPc, shamisenRings,
} from "../music/cadence.js";
import { pitchIndex } from "../music/notes.js";
import {
  SHAMISEN_PHRASE, SHAMISEN_RING_MAX, SHAMISEN_FRAY, CURSED_SHAMISEN_DB_COST,
} from "../data/gameConstants.js";

let count = 0;
const ok = (c, m) => { count++; assert.ok(c, m); };
const eq = (a, b, m) => { count++; assert.deepStrictEqual(a, b, m); };

// C is pitch class 0, so the phrase spells out in absolute pitch classes as
// 3 (D#/♭3) · 2 (D) · 0 (C) · 8 (G#/♭6) · 7 (G).
const C = pitchIndex('C');
const PHRASE_IN_C = ['D#', 'D', 'C', 'G#', 'G'];

// ── THE PHRASE ITSELF ────────────────────────────────────────────────────────

eq(SHAMISEN_PHRASE, [3, 2, 0, 8, 7], '🎸 the haunting is ♭3 → 2 → 1 → ♭6 → 5, in semitones off RONIN\'S root');
eq(SHAMISEN_PHRASE[SHAMISEN_PHRASE.length - 1], 7,
  '🎯 IT ENDS ON THE 5 — a half cadence, hanging on the dominant. This is the whole reason the thing will not stop playing, and the reason the exorcism is what it is. If this ever stops being 7, §2.3.6 needs rewriting, not patching.');
eq(SHAMISEN_PHRASE[2], 0,
  '⚠️ the TONIC sits in the middle of the phrase — the same pitch class that FEEDS the curse as link 3 is the one that KILLS it when spent at the instrument. Same note, opposite verb (§2.3.6).');

// ── FEEDING — an ordered subsequence inside ONE committed melody line ────────

eq(feedShamisenPhrase(PHRASE_IN_C, C, 0, SHAMISEN_PHRASE), 5,
  '⚡ THE WHOLE PHRASE CAN LAND IN A SINGLE TURN. This is the headline rule (Alex, 2026-08-25): hold all five degrees, place them in order in one commit, and the haunting is finished on the turn it is set down.');
eq(feedShamisenPhrase(['D#'], C, 0, SHAMISEN_PHRASE), 1, '🎸 one link a turn is the slow route, and it works');
eq(feedShamisenPhrase(['D#', 'D'], C, 0, SHAMISEN_PHRASE), 2, '🎸 two links in one line');
eq(feedShamisenPhrase(['D'], C, 0, SHAMISEN_PHRASE), 0,
  '⚠️ ORDER IS LOAD-BEARING: the 2 does not feed a phrase still waiting on the ♭3. Out-of-order notes advance nothing.');
eq(feedShamisenPhrase(['D'], C, 1, SHAMISEN_PHRASE), 2, '🎸 …and the same note DOES feed it once the ♭3 is already in place');

eq(feedShamisenPhrase(['D#', 'A', 'F', 'D'], C, 0, SHAMISEN_PHRASE), 2,
  '🎯 SUBSEQUENCE, NOT SUBSTRING — links must be in order but need not be adjacent. A player walking through other notes to reach the next link is still playing the phrase; demanding adjacency would hand the ability to note-pool luck.');
eq(feedShamisenPhrase(['A', 'F', 'B'], C, 0, SHAMISEN_PHRASE), 0,
  '🎸 a track with none of the phrase in it advances nothing — which is what kills an unfinished haunting at the round tick');
eq(feedShamisenPhrase([], C, 2, SHAMISEN_PHRASE), 2, '🎸 an empty track is not a feed');
eq(feedShamisenPhrase(null, C, 2, SHAMISEN_PHRASE), 2, '🎸 …and neither is a missing one');

eq(feedShamisenPhrase(PHRASE_IN_C, C, 5, SHAMISEN_PHRASE), 5,
  '🎸 a FINISHED haunting eats nothing more — it needs no food and cannot be over-fed past its length');
ok(feedShamisenPhrase([...PHRASE_IN_C, 'C', 'G'], C, 0, SHAMISEN_PHRASE) === SHAMISEN_PHRASE.length,
  '⚠️ and it never runs off the end of the phrase even when the track keeps going');

// The haunting is in RONIN'S key, never the listener's. In A (pitch class 9) the
// same phrase spells C · B · A · F · E.
const A = pitchIndex('A');
eq(feedShamisenPhrase(['C', 'B', 'A', 'F', 'E'], A, 0, SHAMISEN_PHRASE), 5,
  '🎸 the phrase transposes with Ronin\'s root — in A it is C · B · A · F · E');
eq(feedShamisenPhrase(PHRASE_IN_C, A, 0, SHAMISEN_PHRASE), 1,
  '⚠️ …and the C-rooted spelling gets ONE link by accident against an A-rooted Ronin and then stalls dead. 📌 The accident is worth pinning rather than wishing away: a stray note CAN start someone else\'s phrase, because pitch classes are shared — what it cannot do is carry it. Every note in this ability is measured in HIS key, and a track built for the wrong root fails at link 2.');

// ── THE REQUIRED NOTE — public on purpose, for both sides ────────────────────

eq(shamisenNextPc(C, 0, SHAMISEN_PHRASE), 3, '🎶 a fresh haunting is waiting on the ♭3');
eq(shamisenNextPc(C, 4, SHAMISEN_PHRASE), 7, '🎶 one link from home it wants the 5');
eq(shamisenNextPc(C, 5, SHAMISEN_PHRASE), null,
  '🎶 a finished phrase wants nothing — `null` is what tells the UI to stop printing a required note');

// ── THE RESOLVING NOTE — what a rival spends to end it ───────────────────────

eq(shamisenResolvingPc(C), 0, '⚔️ the exorcism note is Ronin\'s TONIC — you finish the sentence he refused to finish');
eq(shamisenResolvingPc(A), 9, '⚔️ …in his key, so an A-rooted Ronin is exorcised with an A');
eq(shamisenResolvingPc(C), SHAMISEN_PHRASE[2],
  '⚠️ THE EXORCISM NOTE AND LINK 3 ARE THE SAME PITCH CLASS, asserted rather than left to be rediscovered. Ronin commits it INTO a melody to feed; a rival spends it AT the instrument to kill. If anyone ever "simplifies" one path into the other, this is the assertion that should stop them.');

// ── THE GROWING REACH, AND WHY IT IS ALSO THE COUNTERPLAY ────────────────────

eq([0, 1, 2, 3, 4, 5].map(n => shamisenRings(n, SHAMISEN_RING_MAX)), [1, 1, 1, 2, 2, 3],
  '🎸 the ring table: `ceil(links/2)`, floored at 1 so a just-placed Shamisen still bites, capped at the max');
eq(shamisenRings(0, SHAMISEN_RING_MAX), 1,
  '⚠️ FLOORED AT 1, NOT 0 — a haunting with no reach would be unexorcisable, because you have to be INSIDE the rings to answer it');
eq(shamisenRings(99, SHAMISEN_RING_MAX), SHAMISEN_RING_MAX, '🎸 and it never exceeds the cap');
eq(SHAMISEN_RING_MAX, 3,
  '📌 3 rings is 37 of the board\'s 111 hexes (3r²+3r+1) — a third of the stage. 4 would be 61, over HALF, and 5 is 91 ≈ everywhere. If this number moves, it moves to 4 and no further.');

ok(shamisenRings(5, SHAMISEN_RING_MAX) > shamisenRings(1, SHAMISEN_RING_MAX),
  '🎯 THE REACH GROWS WITH THE PHRASE, and this is the ability\'s self-balancing hinge: exorcism requires standing inside the rings, so the number that makes the haunting dangerous is the same number that decides who may kill it. A weak haunting is nearly untouchable AND nearly harmless; a bound one is lethal AND standing in reach of a third of the board. An earlier design draft refused a growing radius for the opposite reason and was wrong.');

// ── THE BITE, AND THE LINE IT MUST NOT CROSS ─────────────────────────────────

eq(SHAMISEN_FRAY, 1,
  '🎸 ONE escalating axis, not two: the reach grows, the bite never does. The fray is 1 note at every stage, complete or not.');
eq(CURSED_SHAMISEN_DB_COST, 2, '🎸 2 Db per use, unchanged by the rework');

console.log(`\n✅ shamisenCheck: ${count} assertions passed — the phrase hangs on the 5, and the reach that makes it dangerous is the reach that lets you end it`);
