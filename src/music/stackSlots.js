// =============================================================================
// music/stackSlots.js  —  🅰️ STACK SLOTS ARE FOUND ON THE BOARD
// -----------------------------------------------------------------------------
// `PROGRESSION_REWRITE_DESIGN.md` §2. Chord capacity used to be BOUGHT: slot 4
// came with `theory_dom7`, slot 5 with `theory_modes`, slot 6 with
// `theory_chromatic`, 38 Db for the three of them. The Theory branch is gone and
// the same three slots are now FOUND — once your CROWD has filled the row that
// seat asks for and the current stack is full. You walk onto the right Lost Chord and
// the seat it opens is the seat it fills.
//
// ⭐ 2026-09-27 — THE TARGETS ARE NOW EACH SPIRIT'S OWN (CHORD_VOCABULARY_DESIGN.md
// §5). The seat-N target is the note that makes the stack a spelling of exactly
// N notes from THAT Spirit's vocabulary (`music/vocabularies.js` `seatTargets`),
// on either branch — the same note that glows in the hand. A full stack of
// loose notes has no target: seats are opened by spelling. The ladder below
// keeps only its gates (`slot`, `row`); its `degrees` are history.
//
// 🎤 2026-09-28 — THE CROWD IS THE GATE (Alex: "You played it. You earned it. If
// you want yours — you play it well as it is first before exploring the bigger
// chords out there."). Each seat waits for a full ROW of your own grandstand:
// row 1 (6 fans) → seat 4, row 2 (12) → seat 5, row 3 (18) → seat 6. It is the
// CURRENT crowd, Casuals + Diehards — lose the room and the next hunt pauses,
// but a seat already opened is never lost.
//   ⛔ It REPLACES `upgradesRequired` (1 / 2 / 4 distinct `unlockedSkills`),
// which the loadout draft broke: every Spirit now opens with its 2-ability kit
// and Db never grants another, so seats 4–5 were ungated from turn 1 and seat 6
// could never open outside the Testing Grounds.
//
// 🎯 (HISTORY) THE LADDER WAS NOT NEW MUSIC. These were the old `CHORD_TEMPLATES`
// rank bands in order, so every slot you earned was a chord you could already spell:
//
//   slot 4 ← a 7th of your root      → Dom7 / Min7 / Maj7 / Dim7 / m7♭5   (rank 6)
//   slot 5 ← the 9th                 → Dom9 / Min9                        (rank 7)
//   slot 6 ← the 11th or the 13th    → Min11 / Dom13                      (rank 8)
//
// ⚠️ "A 7TH", NOT "THE ♭7", AND THE THREE SPELLINGS ARE ALL LOAD-BEARING. ♭7
// (10), ♮7 (11) and the 𝄫7 (9, which is the 6th by another name) each count. Ask
// for the ♭7 alone and a Maj7 builder can never open the seat that holds his own
// chord, and the Dim7 builder never opens his at all — the ladder would be a
// dominant-only ladder wearing a general one's clothes.
//
// 📌 9 IS ON TWO RUNGS (the 𝄫7 at slot 4, the 13th at slot 6) AND THAT IS FINE.
// Exactly one rung is live for a stack at a time — the next one it has not
// earned — so a pitch class can never claim two slots from one pickup.
//
// ── THE ROOT IS `stack[0]`, AND IT IS DERIVED, NOT STORED ────────────────────
//
// The design says "the root is the first note committed to that stack", which
// reads like a new state field. It is not, and storing it would have been a bug
// farm: the client and the engine both write the stacks, and a second field that
// must agree with an array is the exact shape of every desync this project has
// had (`SEQUENCING.md` §5.A). `stack[0]` IS the first note committed, because
// commits push.
//
// And it re-points itself correctly under the two rules that already exist:
//   ⚔️ The Drive spend takes the TOP two notes since 2026-09-27 (it used to take
//      the root) — the chord steps down its own branch and the root stays put.
//   🛡️ Sustain frays from the TAIL, cheapest note first — so a Sustain root
//      survives fraying and your hunt is stable across three opponents' turns,
//      which is the half of the split that needs to be stable.
//
// ⚠️ THE SLOT ITSELF IS NEVER LOST — not to fray, not to the Drive spend, not to
// removing the note that opened it. `driveSlots` / `sustainSlots` on the note
// sheet only ever go up. Capacity is a fact about the player; the notes in the
// seat are a fact about the turn.
//
// ⚠️ AND THE UNLOCK IS ORDER-FREE EVALUATION'S ONE EXCEPTION, DELIBERATELY.
// `evaluateChord` still scans every pitch class present and keeps the best-ranked
// match — no chord in the game was re-priced by this file. The root here decides
// only WHICH NOTE YOU ARE HUNTING. Alex's call, 2026-09-02: §7.4 measured that
// root-anchored *scoring* leaves 67–92% of stacks spelling no chord at all once a
// root is consumed, so scoring stays where it was and the root does one job.
//
// Pure module — no game state, no React, no rng.
// =============================================================================
import { pitchIndex } from "./notes.js";
import { seatTargets } from "./vocabularies.js";
// 🎤 The crowd gate's two numbers. ✅ SAFE because `gameConstants.js` imports
// nothing at all — the cycle warned about below needs an arrow BACK from there to
// here, and there is none (`music/cadence.js` imports it the same way). Pulled
// rather than copied so a grandstand re-seat moves the gate with it.
import { FAN_DIEHARD_START, CROWD_SEATS_PER_ROW } from "../data/gameConstants.js";
// ⚠️ NOTHING ELSE IS IMPORTED FROM `gameConstants.js` ON PURPOSE. `stackCapFor` lives
// there and reads `driveSlots`/`sustainSlots` directly, so the arrow points one
// way — data → music, never back. Importing the ceiling here to re-derive the cap
// would make `gameConstants` and this file mutually dependent, and a const export
// across an ES-module cycle reads as `undefined` at load rather than failing.
// 📌 The two ends still have to agree: `STACK_CAP_BASE + SLOT_LADDER.length` must
// equal `STACK_CAP_MAX`, or a rung exists that the HUD never draws a seat for.
// `stackSlotsCheck.mjs` §1 asserts exactly that, because nothing else can.

/** The rungs, in order. `degrees` are semitones above the stack's ROOT.
 *  `slot` is the seat number a player sees (4, 5, 6); the index in this array
 *  is how many extra slots you already hold. */
export const SLOT_LADDER = [
  { slot: 4, degrees: [9, 10, 11], row: 1, fansRequired: 1 * CROWD_SEATS_PER_ROW, label: 'your 4-note chord', chords: "this Spirit's 4-note spellings" },
  { slot: 5, degrees: [2],         row: 2, fansRequired: 2 * CROWD_SEATS_PER_ROW, label: 'your 5-note chord', chords: "this Spirit's 5-note spellings" },
  { slot: 6, degrees: [5, 9],      row: 3, fansRequired: 3 * CROWD_SEATS_PER_ROW, label: 'your 6-note chord', chords: "this Spirit's 6-note spellings" },
];

/** How many extra slots there are to find. Derived, so a fourth rung added above
 *  cannot silently exceed the render ceiling. */
export const SLOT_LADDER_MAX = SLOT_LADDER.length;

const pcOf = n => (typeof n === 'number' ? ((n % 12) + 12) % 12 : pitchIndex(n));

/** The two stacks, by the name the note sheet uses. One list, so a third stack
 *  cannot be added in one place and missed in another. */
export const STACK_KEYS = [
  { which: 'drive',   stack: 'driveStack',   slots: 'driveSlots',   opened: 'driveSeatOpenedThisTurn'   },
  { which: 'sustain', stack: 'sustainStack', slots: 'sustainSlots', opened: 'sustainSeatOpenedThisTurn' },
];

// ⏳ ONE SEAT PER STACK PER ROUND (Alex, 2026-09-30 playtest: *"Drive stack
// was able to be upgraded twice in one round. I wonder if there should be a
// gate for this?"* — ruled: one per stack per round, so a round can still
// grow one Drive seat AND one Sustain seat).
// 🎯 HOW IT HAPPENED: the found note sits DOWN in the seat it opens, so seat 4
// opening makes the stack full at 4 — which is exactly seat 5's "earlier seats
// filled" condition. With 12+ fans and a second Lost Chord in reach (three
// Shukuchi landings, or just a short walk) the ladder climbed twice in a turn.
// 📌 A TURN FLAG IS A ROUND FLAG HERE: seats are only ever found by walking,
// and you only walk on your own turn, which comes round once a round. The flag
// is set by `applyUnlockClaim` and cleared by `startTurnNotes` (turnFlow.js),
// the one turn-start both the engine and the client run.

/** 🎸 The root of a stack: the first note still standing in it. `null` for an
 *  empty stack — and a stack with no root is hunting nothing, which is correct:
 *  until you commit something there is no chord to extend. */
export function stackRoot(stack = []) {
  return (stack || []).find(Boolean) ?? null;
}

/** The rung a stack is working on, or `null` when it already holds all three.
 *  @returns null | { slot, degrees, label, chords, index } */
export function nextRung(earned = 0) {
  const i = Math.max(0, Math.floor(earned || 0));
  if (i >= SLOT_LADDER.length) return null;
  return { ...SLOT_LADDER[i], index: i };
}

/** 🎯 The pitch classes that would open this stack's next seat, right now.
 *  Empty when the stack has no root, or has already earned every slot.
 *  @returns Set<number> */
export function targetsForStack(stack = [], earned = 0, spiritId = null) {
  const rung = nextRung(earned);
  if (!rung) return new Set();
  if (!(pcOf(stackRoot(stack)) >= 0)) return new Set();
  return seatTargets(spiritId, stack, rung.slot);
}

/** 🎤 The Spirit's crowd RIGHT NOW — Diehards + Casuals, the same two numbers
 *  the grandstand draws. Missing Diehards read as the opening crowd, exactly as
 *  `crowdMultiplier` and `addCasuals` read them. */
export function crowdSize(ns = {}) {
  return Math.max(0, ns?.diehards ?? FAN_DIEHARD_START) + Math.max(0, ns?.casuals ?? 0);
}

/** Has this crowd filled the row the rung asks for? */
export function crowdGateMet(ns = {}, rung = null) {
  return !!rung && crowdSize(ns) >= rung.fansRequired;
}

/** ⏳ Has this stack already opened a seat this round? (The gate above.) The
 *  HUD asks, so a gated stack says "next round" instead of "no target". */
export function seatOpenedThisRound(ns = {}, which = 'drive') {
  const key = STACK_KEYS.find(k => k.which === which)?.opened;
  return !!(key && ns?.[key]);
}

/** A rung becomes a live board target only after the stack has filled every
 * earlier seat and the Spirit's crowd has filled that rung's row — and, with
 * `turnGate`, only if this stack has not already opened a seat this round. */
function canHuntRung(ns = {}, stack = [], rung = null, opened = null, turnGate = true) {
  if (!rung) return false;
  if (turnGate && opened && ns?.[opened]) return false;
  const filled = (stack ?? []).filter(Boolean).length;
  // The capacity immediately before seat N opens is N - 1: 3, 4, then 5.
  return filled >= rung.slot - 1 && crowdGateMet(ns, rung);
}

/** 🎯 THE ONE FUNCTION THE BOARD AND THE HUD BOTH READ (§2's `unlockTargets`).
 *  Everything downstream — the weighted spawn, the pin rule, the bot's hunt and
 *  (when it is built) the note-stock highlight — comes through here, so the hex
 *  that lights up and the hex that pays cannot disagree by construction.
 *
 *  @returns { drive: {slot, pcs:Set}|null, sustain: {…}|null, all: Set<number> }
 */
export function unlockTargets(ns = {}, spiritId = null, { turnGate = true } = {}) {
  const out = { drive: null, sustain: null, all: new Set() };
  for (const { which, stack, slots, opened } of STACK_KEYS) {
    const earned = ns?.[slots] ?? 0;
    const rung = nextRung(earned);
    if (!rung) continue;
    const chordStack = ns?.[stack] ?? [];
    if (!canHuntRung(ns, chordStack, rung, opened, turnGate)) continue;
    const pcs = targetsForStack(chordStack, earned, spiritId);
    if (pcs.size === 0) continue;
    out[which] = { slot: rung.slot, pcs };
    for (const pc of pcs) out.all.add(pc);
  }
  return out;
}

/** Every pitch class that is a live unlock for ANY of the seats in `noteStates`.
 *  This is what the board asks: the spawner weights toward it and the drift rule
 *  holds it in place.
 *
 *  ⚠️ IT IS DELIBERATELY EVERYONE'S TARGETS AT ONCE, NOT THE ACTING SPIRIT'S.
 *  Alex's call, 2026-09-02: **denial is real.** Anyone may take any Lost Chord,
 *  so a B♭ that is useless to you is still worth walking onto if it is the seat
 *  your rival is one hex from opening. Filtering this per-Spirit would quietly
 *  delete that play.
 *  @returns Set<number> */
export function liveUnlockPcs(noteStates = {}) {
  const all = new Set();
  for (const [spiritId, ns] of Object.entries(noteStates || {})) {
    // ⚠️ `turnGate: false` — the BOARD keeps pinning and spawning a Spirit's
    // next seat even in the round they just opened one. The gate is about when
    // you may TAKE it (your next turn), not about whether it exists; without
    // this the hex you are walking back to could drift away between turns.
    for (const pc of unlockTargets(ns, spiritId, { turnGate: false }).all) all.add(pc);
  }
  return all;
}

/** 🔓 Does walking onto `note` open a seat for this Spirit, and which one?
 *
 *  @returns null | { which:'drive'|'sustain', slot, slotsKey, stackKey, rung }
 *
 *  Both stacks can want the same pitch at once (they have different roots, so
 *  this is a coincidence rather than a rule). ⚠️ THE LOWER SEAT WINS, ties to
 *  Drive — the same tie-break `claimAt` uses in `context.js`, and for the same
 *  reason: one rule, written once, so the log line and the state agree. Taking
 *  the lower seat first also means a find can never skip a rung. */
export function unlockClaim(ns = {}, note = null, spiritId = null) {
  const pc = pcOf(note);
  if (!(pc >= 0)) return null;
  let best = null;
  for (const { which, stack, slots, opened } of STACK_KEYS) {
    const earned = ns?.[slots] ?? 0;
    const rung = nextRung(earned);
    if (!rung) continue;
    const chordStack = ns?.[stack] ?? [];
    if (!canHuntRung(ns, chordStack, rung, opened)) continue;
    if (!targetsForStack(chordStack, earned, spiritId).has(pc)) continue;
    const claim = { which, slot: rung.slot, slotsKey: slots, stackKey: stack, openedKey: opened, rung };
    // lower seat wins; Drive is first in STACK_KEYS, so a tie keeps Drive
    if (!best || claim.slot < best.slot) best = claim;
  }
  return best;
}

/** The note sheet patch a found unlock writes: the seat goes up by one and the
 *  note that opened it sits down in it.
 *
 *  ⚠️ IT COSTS NO STACK COMMIT. "The found note fills the seat it opened" — one
 *  gesture, and charging a commit for it would mean a Spirit who had already
 *  spent their three could walk onto their own unlock and be told no.
 *
 *  @returns null | { patch, which, slot, chordStack } */
export function applyUnlockClaim(ns = {}, note = null, spiritId = null) {
  const claim = unlockClaim(ns, note, spiritId);
  if (!claim) return null;
  const stack = [...(ns?.[claim.stackKey] ?? []), note];
  return {
    patch: {
      [claim.stackKey]: stack,
      [claim.slotsKey]: (ns?.[claim.slotsKey] ?? 0) + 1,
      [claim.openedKey]: true,   // ⏳ one seat per stack per round — see STACK_KEYS
    },
    which: claim.which,
    slot:  claim.slot,
    chordStack: stack,
  };
}
