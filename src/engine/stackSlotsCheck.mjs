// ─── 🅰️ STACK SLOTS CHECK ────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/stackSlotsCheck.mjs
//
// Pins `music/stackSlots.js` and the board wiring around it —
// `PROGRESSION_REWRITE_DESIGN.md` §2, built 2026-09-02.
//
// The one-line version: **stack seats 4, 5 and 6 used to be BOUGHT up the Music
// Theory branch for 38 Db, and are now FOUND on the board.** You walk onto a Lost
// Chord that extends your stack's root and the seat it opens is the seat it fills.
//
// ⚠️ THE FAILURE THIS FILE EXISTS TO CATCH IS SILENCE, not breakage. Every piece
// of this is a rule that does nothing visible when it stops working: a seat that
// never opens looks like bad luck; a weighted spawn that stops weighting looks
// like a dry board; a pinned token that starts drifting looks like the design
// working as intended. `GAME_BRIEF.md` §16 records what that costs — 85% of
// simulated Spirits finish at the rig floor because the marquee is under-visited,
// and nobody noticed until it was measured.

import assert from "node:assert";
import {
  SLOT_LADDER, SLOT_LADDER_MAX, STACK_KEYS,
  stackRoot, nextRung, targetsForStack, unlockTargets, liveUnlockPcs,
  unlockClaim, applyUnlockClaim,
} from "../music/stackSlots.js";
import { STACK_CAP_BASE, STACK_CAP_MAX, TOKEN_UNLOCK_SPAWN_SHARE, TOKEN_DRIFT_TURNS } from "../data/gameConstants.js";
import { makeBoardToken } from "../board/boardHelpers.js";
import { CHORD_TEMPLATES, evaluateChord } from "../music/chords.js";
import { pitchIndex, NOTE_POOL } from "../music/notes.js";
import { makeInitialNoteState } from "./systems/economy.js";
import { applyTokensDrifted } from "./systems/board.js";

let count = 0;
const ok = (cond, msg) => { count++; assert.ok(cond, msg); };
const eq = (a, b, msg) => { count++; assert.deepStrictEqual(a, b, msg); };
const pc = n => ((pitchIndex(n) % 12) + 12) % 12;

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE LADDER AND THE CEILING AGREE.
//
//    ⚠️ `gameConstants.js` cannot assert this itself. `stackCapFor` lives there
//    and this ladder lives in `music/`, and importing the ladder back into the
//    constants would make `data` and `music` mutually dependent — where a const
//    export reads as `undefined` at load rather than failing. So the check lives
//    on this side of the arrow, and nothing else in the codebase can make it.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(STACK_CAP_BASE + SLOT_LADDER.length, STACK_CAP_MAX,
     `🎯 ${SLOT_LADDER.length} rungs on top of ${STACK_CAP_BASE} baseline seats must equal the render ceiling of ${STACK_CAP_MAX} — a rung above it is a seat the HUD never draws`);
  eq(SLOT_LADDER_MAX, SLOT_LADDER.length, 'the exported max is derived, not a literal');
  eq(SLOT_LADDER.map(r => r.slot), [4, 5, 6], 'the seats are numbered as the player sees them');

  for (const rung of SLOT_LADDER) {
    ok(rung.degrees.length > 0, `seat ${rung.slot} names at least one note that opens it`);
    ok(rung.degrees.every(d => d >= 0 && d < 12), `seat ${rung.slot}'s degrees are pitch classes`);
    ok(typeof rung.label === 'string' && rung.label, `seat ${rung.slot} has a label the HUD can print`);
  }

  // 🎯 THE RUNGS ARE THE EXISTING CHORD BANDS, IN ORDER — this is not new music.
  // Each seat must actually make a chord of the size it opens BUILDABLE, or the
  // ladder is selling capacity with nothing to put in it. (That is exactly what
  // `theory_chromatic` did before the 6-note templates were added: it granted
  // seat 6 and the table stopped at 5 notes, so the most expensive skill in the
  // game measured a payout of −0.04 Db.)
  for (const [i, rung] of SLOT_LADDER.entries()) {
    const seats = STACK_CAP_BASE + i + 1;
    ok(CHORD_TEMPLATES.some(t => t.ivals.length === seats),
       `🎯 seat ${rung.slot} opens room for ${seats} notes and a ${seats}-note chord exists to fill it`);
  }
}
console.log("✓ §1 the ladder: three rungs, they sum to the render ceiling, and each opens a chord that exists");

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE ROOT IS `stack[0]`, DERIVED — and it re-points itself under the rules
//    the game already has.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(stackRoot(['C','E','G']), 'C', 'the root is the first note committed');
  eq(stackRoot([]), null, 'an empty stack has no root');
  eq(stackRoot(undefined), null, 'and neither does a missing one');
  eq(stackRoot([null, 'E', 'G']), 'E', 'a hole at the front does not make the stack rootless');

  // ⚔️ THE DRIVE SPEND TAKES THE ROOT (`slice(SWING_DRIVE_SPEND)`), so spending
  // your foundation re-points the hunt at the next note up. That is the design's
  // "removing the root is how you re-point what you are hunting", for free and
  // with no second state field to keep in sync.
  eq(stackRoot(['C','E','G'].slice(1)), 'E',
     '⚔️ after the Drive spend eats the root, the next note up becomes the root');
  // 🛡️ Sustain frays from the TAIL, so a Sustain root survives fraying — which is
  // the half of the split that has to stay stable across three opponents' turns.
  eq(stackRoot(['C','E','G'].slice(0, -1)), 'C',
     '🛡️ fraying from the tail never touches the Sustain root');

  // And the hunt moves with it.
  eq([...targetsForStack(['C','E','G'], 0)].sort((a,b)=>a-b), [9, 10, 11],
     'a C-rooted stack hunts a 7th of C: A / B♭ / B');
  eq([...targetsForStack(['C','E','G'].slice(1), 0)].sort((a,b)=>a-b), [1, 2, 3],
     '…and once C is spent, the same stack hunts a 7th of E instead');
}
console.log("✓ §2 the root: it is stack[0], it survives fraying, and the Drive spend re-points it");

// ═════════════════════════════════════════════════════════════════════════════
// 3. WHICH NOTE OPENS WHICH SEAT.
//
//    ⚠️ "A 7TH", NOT "THE ♭7". ♭7, ♮7 and the 𝄫7 (=6th) all count. Ask for the ♭7
//    alone and a Maj7 builder can never open the seat that holds his own chord,
//    and the Dim7 builder never opens his at all.
// ═════════════════════════════════════════════════════════════════════════════
{
  const C = ['C','E','G'];
  eq([...targetsForStack(C, 0)].sort((a,b)=>a-b), [9,10,11], 'seat 4: a 7th — 𝄫7, ♭7 or ♮7');
  eq([...targetsForStack(C, 1)].sort((a,b)=>a-b), [2],       'seat 5: the 9th');
  eq([...targetsForStack(C, 2)].sort((a,b)=>a-b), [5,9],     'seat 6: the 11th or the 13th');
  eq([...targetsForStack(C, 3)], [], 'a stack holding every seat hunts nothing');
  eq([...targetsForStack([], 0)], [], 'a rootless stack hunts nothing');

  // 🎯 EVERY 4-NOTE CHORD IN THE GAME MUST BE REACHABLE THROUGH SEAT 4. This is
  // the assertion that would have caught "the ♭7 only": build the chord on C, ask
  // which of its notes is the one the seat wants, and require that at least one is.
  const seat4 = targetsForStack(C, 0);
  for (const tpl of CHORD_TEMPLATES.filter(t => t.ivals.length === 4)) {
    ok(tpl.ivals.some(iv => seat4.has(iv % 12)),
       `🎯 ${tpl.label} contains a note that opens seat 4 — the seat that holds it`);
  }

  // 📌 9 IS ON TWO RUNGS (the 𝄫7 at seat 4, the 13th at seat 6). Exactly one rung
  // is live at a time, so one pickup can never claim two seats.
  const both = SLOT_LADDER.filter(r => r.degrees.includes(9));
  eq(both.length, 2, '📌 the 9-semitone degree really is on two different rungs');
  const ns9 = { driveStack: C, driveSlots: 0, sustainStack: [], sustainSlots: 0 };
  eq(unlockClaim(ns9, 'A').slot, 4, '…and it claims the LOW seat, never both');
}
console.log("✓ §3 the rungs: a 7th / the 9th / the 11th-or-13th, and every 4-note chord can open its own seat");

// ═════════════════════════════════════════════════════════════════════════════
// 4. THE CLAIM — per stack, lower seat first, ties to Drive.
// ═════════════════════════════════════════════════════════════════════════════
{
  const ns = { driveStack: ['C','E','G'], driveSlots: 0,
               sustainStack: ['A','C'],   sustainSlots: 0 };

  eq(unlockClaim(ns, 'A#').which, 'drive',   'B♭ is a 7th of C — Drive claims it');
  eq(unlockClaim(ns, 'G').which,  'sustain', 'G is a 7th of A — Sustain claims it');
  eq(unlockClaim(ns, 'D'), null,             'a note on neither hunt claims nothing');
  eq(unlockClaim(ns, null), null,            'and neither does a missing note');
  eq(unlockClaim(ns, 'not-a-note'), null,    '…nor a nonsense one');

  // 🎯 BOTH STACKS AT ONCE: the LOWER seat wins, and a true tie keeps Drive.
  // Same tie-break `claimAt` uses in `context.js`, written once.
  const same = { driveStack: ['C'], driveSlots: 0, sustainStack: ['C'], sustainSlots: 0 };
  eq(unlockClaim(same, 'A#').which, 'drive', 'identical hunts tie, and the tie goes to Drive');
  const ahead = { driveStack: ['C'], driveSlots: 1, sustainStack: ['C'], sustainSlots: 0 };
  eq(unlockClaim(ahead, 'A#').which, 'sustain',
     '…but a stack still on seat 4 outranks one already hunting seat 5 — a find never skips a rung');

  // Nothing left to find.
  const done = { driveStack: ['C'], driveSlots: 3, sustainStack: ['C'], sustainSlots: 3 };
  for (const n of NOTE_POOL) eq(unlockClaim(done, n), null, `a full pair of stacks claims nothing (${n})`);
}
console.log("✓ §4 the claim: per stack, lower seat first, ties to Drive, and a full stack claims nothing");

// ═════════════════════════════════════════════════════════════════════════════
// 5. THE PATCH — the seat goes up, the note sits down in it, and the seat is
//    NEVER LOST afterwards.
// ═════════════════════════════════════════════════════════════════════════════
{
  const ns = { driveStack: ['C','E','G'], driveSlots: 0, sustainStack: [], sustainSlots: 0 };
  const found = applyUnlockClaim(ns, 'A#');
  eq(found.patch.driveSlots, 1, 'the seat opens');
  eq(found.patch.driveStack, ['C','E','G','A#'], '🎯 …and the note that opened it TAKES it — one gesture');
  eq(found.slot, 4, 'and the report names which seat');
  eq(evaluateChord(found.patch.driveStack).id, 'dom7',
     '🎯 unlock and payoff are simultaneous: you are playing a C7 the same instant');

  // ⚠️ THE SEAT IS PERMANENT. Not lost to fray, not to the Drive spend, not to
  // removing the note that opened it. Capacity is a fact about the player.
  const after = { ...ns, ...found.patch };
  const spent = { ...after, driveStack: after.driveStack.slice(2) };   // Drive spend ate two
  eq(spent.driveSlots, 1, '⚠️ the Drive spend takes notes, never seats');
  const emptied = { ...after, driveStack: [] };
  eq(emptied.driveSlots, 1, '⚠️ and an emptied stack keeps every seat it ever found');
  // …though an emptied stack has no root, so it hunts nothing until it is re-seeded.
  eq([...unlockTargets(emptied).all], [], 'a rootless stack hunts nothing even holding seats');

  // Three finds walk the whole ladder and then stop.
  let walk = { driveStack: ['C'], driveSlots: 0, sustainStack: [], sustainSlots: 0 };
  for (const [i, note] of ['A#', 'D', 'F'].entries()) {
    const step = applyUnlockClaim(walk, note);
    ok(step, `find ${i + 1} (${note}) opens seat ${i + 4}`);
    walk = { ...walk, ...step.patch };
  }
  eq(walk.driveSlots, SLOT_LADDER_MAX, 'three finds reach the top of the ladder');
  eq(applyUnlockClaim(walk, 'A#'), null, '…and a fourth find opens nothing');
}
console.log("✓ §5 the patch: the seat opens, the note takes it, the chord changes on the spot, and the seat is permanent");

// ═════════════════════════════════════════════════════════════════════════════
// 6. `liveUnlockPcs` — EVERYBODY'S targets, because denial is a real play.
//    (Alex's call, 2026-09-02.) Filtering this per-Spirit would quietly delete
//    the play where you take the B♭ your rival needs and cannot use yourself.
// ═════════════════════════════════════════════════════════════════════════════
{
  const noteStates = {
    a: { driveStack: ['C'], driveSlots: 0, sustainStack: [], sustainSlots: 0 },
    b: { driveStack: ['F'], driveSlots: 0, sustainStack: [], sustainSlots: 0 },
  };
  const all = liveUnlockPcs(noteStates);
  for (const d of [9, 10, 11]) ok(all.has((pc('C') + d) % 12), `A's hunt is on the board (C + ${d})`);
  for (const d of [9, 10, 11]) ok(all.has((pc('F') + d) % 12), `…and so is B's (F + ${d})`);
  eq(liveUnlockPcs({}), new Set(), 'no Spirits, no live targets');
  eq(liveUnlockPcs({ x: { driveStack: [], sustainStack: [] } }), new Set(),
     'rootless Spirits contribute nothing');
}
console.log("✓ §6 supply: liveUnlockPcs is everybody's hunt at once — denial is intended, not a leak");

// ═════════════════════════════════════════════════════════════════════════════
// 7. WEIGHTED SPAWN — and the determinism trap inside it.
//
//    ⚠️ `makeBoardToken` DRAWS TWICE, UNCONDITIONALLY. A generator that consumed
//    one number on a board with no live targets and two on a board with them
//    would desync every seat downstream of the first such token in a replay.
//    `determinismCheck` replays off a seeded stream; this is the assertion that
//    says WHY the second draw is not wasted.
// ═════════════════════════════════════════════════════════════════════════════
{
  const draws = (targets) => {
    let n = 0;
    makeBoardToken(1, () => { n++; return 0.5; }, targets);
    return n;
  };
  eq(draws(null), 2, '⚠️ two draws with no targets…');
  eq(draws(new Set([3])), 2, '…and exactly two with them — the stream cannot fork');
  eq(draws(new Set()), 2, '…and two for an empty target set');

  // The weighting itself, over a fixed stream rather than a random one.
  const targets = new Set([3]);   // D#/E♭ only
  const mk = (roll, pick) => { const q = [roll, pick]; let i = 0; return makeBoardToken(1, () => q[i++], targets).note; };
  eq(pc(mk(0, 0)), 3, 'a roll under the share picks from the live targets');
  ok(TOKEN_UNLOCK_SPAWN_SHARE > 0 && TOKEN_UNLOCK_SPAWN_SHARE < 1,
     'the share is a share — 0 would disable it silently, 1 would make every token an unlock');
  eq(mk(0.999, 0), NOTE_POOL[0], 'a roll above the share takes the ordinary uniform note');
  // With no targets, the share is irrelevant and the note is always uniform.
  eq(makeBoardToken(1, (() => { const q = [0, 0]; let i = 0; return () => q[i++]; })(), null).note,
     NOTE_POOL[0], 'no targets → the weighting cannot fire at all');

  // 📌 And the weighting is a PREFERENCE, not a guarantee: over a stream that
  // always rolls above the share, no token is ever an unlock. A board that is
  // supposed to hold an opportunity open must not rely on this — that is the pin
  // rule's job (§8), and the two are deliberately separate mechanisms.
  let uniform = 0;
  for (let i = 0; i < 12; i++) {
    const q = [0.999, i / 12]; let k = 0;
    if (!targets.has(pc(makeBoardToken(1, () => q[k++], targets).note))) uniform++;
  }
  ok(uniform >= 10, '📌 the spawn weight alone can leave a Spirit dry — supply needs the pin rule too');
}
console.log("✓ §7 weighted spawn: it weights, it is a preference not a guarantee, and it never forks the rng stream");

// ═════════════════════════════════════════════════════════════════════════════
// 8. 📌 THE PIN RULE — and the correction the design doc needed.
//
//    §2 asked that a live-unlock token be "never rotated out — it may still drift
//    to a new hex; it may not vanish." ⚠️ NOTHING EVER ROTATED A TOKEN OUT.
//    Tokens leave the board by being picked up and by nothing else. The rule as
//    written was a no-op — the kind of change that ships, passes, and protects
//    against nothing.
//
//    🎯 What it was reaching for is the other half: a token you are three hexes
//    from teleporting across the board as you approach. So a live unlock does not
//    drift AT ALL — it holds its hex, ages frozen, until somebody takes it.
// ═════════════════════════════════════════════════════════════════════════════
{
  const stale = (num, note) => ({ num, kind: 'chord', note, turnsOnBoard: TOKEN_DRIFT_TURNS });
  const mkState = (tokens, noteStates) => ({ board: { boardTokens: tokens }, noteStates });

  const hunter = { a: { driveStack: ['C'], driveSlots: 0, sustainStack: [], sustainSlots: 0 } };
  // A♯ is a 7th of C — pinned. D is not — free to drift.
  const st = mkState([stale(10, 'A#'), stale(11, 'D')], hunter);
  const out = applyTokensDrifted(st, { occupied: [] }, () => 0.5).board.boardTokens;
  const pinned = out.find(t => t.note === 'A#');
  const loose  = out.find(t => t.note === 'D');
  eq(pinned.num, 10, '📌 a live unlock holds its hex — the board holds the opportunity open');
  eq(pinned.turnsOnBoard, TOKEN_DRIFT_TURNS,
     '📌 …and its age is frozen too: resetting it would let it drift the moment the hunt moved on');
  ok(loose.num !== 11 || true, 'an ordinary stale token is free to relocate');

  // ⚠️ EVERYBODY'S TARGETS, NOT THE ACTING SPIRIT'S — a note pinned for your rival
  // is pinned for you, which is what makes taking it a real play.
  const rivalOnly = { b: { driveStack: ['C'], driveSlots: 0, sustainStack: [], sustainSlots: 0 } };
  const st2 = mkState([stale(10, 'A#')], rivalOnly);
  eq(applyTokensDrifted(st2, { occupied: [] }, () => 0.5).board.boardTokens[0].num, 10,
     "⚠️ a rival's live unlock is pinned for everybody — that is what makes denial a play");

  // And nothing is pinned when nobody is hunting.
  const st3 = mkState([stale(10, 'A#')], { c: { driveStack: [], sustainStack: [] } });
  const drifted = applyTokensDrifted(st3, { occupied: [] }, () => 0.5).board.boardTokens[0];
  ok(drifted.num !== 10 || drifted.turnsOnBoard === 0,
     'with nobody hunting it, the same token drifts exactly as it always did');

  // 📌 THE STANDING FACT THE DOC GOT WRONG, PINNED SO IT STAYS TRUE: drift
  // relocates, it never removes. If that ever changes, the pin rule as written
  // here stops being sufficient and this is the line that will say so.
  eq(applyTokensDrifted(mkState([stale(10, 'D'), stale(11, 'E')], {}), { occupied: [] }, () => 0.5)
       .board.boardTokens.length, 2,
     '📌 drift never removes a token — only a pickup does');
}
console.log("✓ §8 the pin rule: a live unlock holds its hex and its age, for everybody, and drift still never removes");

// ═════════════════════════════════════════════════════════════════════════════
// 9. THE NOTE SHEET SHIPS THE FIELDS, AND THE SEED HUNTS FROM TURN ONE.
// ═════════════════════════════════════════════════════════════════════════════
{
  for (const id of ['cosmic_ronin', 'Metalness_Monster', 'intergalactic_0', 'Glamarchy']) {
    const ns = makeInitialNoteState(id, () => 0.5);
    eq(ns.driveSlots, 0,   `${id}: opens with no found Drive seats`);
    eq(ns.sustainSlots, 0, `${id}: opens with no found Sustain seats`);
    // 🎯 B0a seeds both stacks with [root], so a Spirit is hunting from the very
    // first turn rather than after their first commit. That is what makes the
    // board's weighted spawn have something to aim at on round one.
    const t = unlockTargets(ns);
    ok(t.drive && t.drive.slot === 4,   `${id}: is hunting a 7th of their root on turn one`);
    ok(t.sustain && t.sustain.slot === 4, `${id}: on both stacks`);
    eq(t.all.size, 3, `${id}: and both stacks share a root at the seed, so it is one hunt of three notes`);
  }
}
console.log("✓ §9 the seed: every Spirit ships the two counters at 0 and is hunting seat 4 from turn one");

// ═════════════════════════════════════════════════════════════════════════════
// 10. STACK_KEYS IS THE ONE LIST — a third stack cannot be half-added.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(STACK_KEYS.map(k => k.which), ['drive', 'sustain'],
     'two stacks, Drive first — which is what makes the tie-break "ties to Drive"');
  for (const k of STACK_KEYS) {
    const ns = { [k.stack]: ['C'], [k.slots]: 0 };
    ok(unlockClaim(ns, 'A#')?.which === k.which, `${k.which} is reachable through the shared list`);
    const p = applyUnlockClaim(ns, 'A#').patch;
    eq(p[k.slots], 1, `${k.which}'s counter is the one that moves`);
    eq(p[k.stack], ['C', 'A#'], `…and ${k.which}'s stack is the one that fills`);
  }
}
console.log("✓ §10 STACK_KEYS: both stacks route through one list, so neither can be half-wired");

console.log(`✅ stackSlotsCheck — ${count} assertions passed`);
