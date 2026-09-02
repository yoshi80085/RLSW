// =============================================================================
// music/stackSlots.js  —  🅰️ STACK SLOTS ARE FOUND ON THE BOARD
// -----------------------------------------------------------------------------
// `PROGRESSION_REWRITE_DESIGN.md` §2. Chord capacity used to be BOUGHT: slot 4
// came with `theory_dom7`, slot 5 with `theory_modes`, slot 6 with
// `theory_chromatic`, 38 Db for the three of them. The Theory branch is gone and
// the same three slots are now FOUND — you walk onto the right Lost Chord and
// the seat it opens is the seat it fills.
//
// 🎯 THE LADDER IS NOT NEW MUSIC. These are the existing `CHORD_TEMPLATES` rank
// bands in order, so every slot you earn is a chord you can already spell:
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
//   ⚔️ The Drive spend takes the ROOT (`slice(SWING_DRIVE_SPEND)`) — so spending
//      your foundation hands the root to the next note up, and your hunt on the
//      board moves with it. That is the design's own "removing the root is how
//      you re-point what you are hunting" (§6), for free.
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
// ⚠️ NOTHING IS IMPORTED FROM `gameConstants.js` ON PURPOSE. `stackCapFor` lives
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
  { slot: 4, degrees: [9, 10, 11], label: 'a 7th',            chords: 'Dom7 / Min7 / Maj7 / Dim7 / m7♭5' },
  { slot: 5, degrees: [2],         label: 'the 9th',          chords: 'Dom9 / Min9' },
  { slot: 6, degrees: [5, 9],      label: 'the 11th or 13th', chords: 'Min11 / Dom13' },
];

/** How many extra slots there are to find. Derived, so a fourth rung added above
 *  cannot silently exceed the render ceiling. */
export const SLOT_LADDER_MAX = SLOT_LADDER.length;

const pcOf = n => (typeof n === 'number' ? ((n % 12) + 12) % 12 : pitchIndex(n));

/** The two stacks, by the name the note sheet uses. One list, so a third stack
 *  cannot be added in one place and missed in another. */
export const STACK_KEYS = [
  { which: 'drive',   stack: 'driveStack',   slots: 'driveSlots'   },
  { which: 'sustain', stack: 'sustainStack', slots: 'sustainSlots' },
];

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
export function targetsForStack(stack = [], earned = 0) {
  const out = new Set();
  const rung = nextRung(earned);
  if (!rung) return out;
  const rootPc = pcOf(stackRoot(stack));
  if (!(rootPc >= 0)) return out;
  for (const d of rung.degrees) out.add((rootPc + d) % 12);
  return out;
}

/** 🎯 THE ONE FUNCTION THE BOARD AND THE HUD BOTH READ (§2's `unlockTargets`).
 *  Everything downstream — the weighted spawn, the pin rule, the bot's hunt and
 *  (when it is built) the note-stock highlight — comes through here, so the hex
 *  that lights up and the hex that pays cannot disagree by construction.
 *
 *  @returns { drive: {slot, pcs:Set}|null, sustain: {…}|null, all: Set<number> }
 */
export function unlockTargets(ns = {}) {
  const out = { drive: null, sustain: null, all: new Set() };
  for (const { which, stack, slots } of STACK_KEYS) {
    const earned = ns?.[slots] ?? 0;
    const rung = nextRung(earned);
    if (!rung) continue;
    const pcs = targetsForStack(ns?.[stack] ?? [], earned);
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
  for (const ns of Object.values(noteStates || {})) {
    for (const pc of unlockTargets(ns).all) all.add(pc);
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
export function unlockClaim(ns = {}, note = null) {
  const pc = pcOf(note);
  if (!(pc >= 0)) return null;
  let best = null;
  for (const { which, stack, slots } of STACK_KEYS) {
    const earned = ns?.[slots] ?? 0;
    const rung = nextRung(earned);
    if (!rung) continue;
    if (!targetsForStack(ns?.[stack] ?? [], earned).has(pc)) continue;
    const claim = { which, slot: rung.slot, slotsKey: slots, stackKey: stack, rung };
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
export function applyUnlockClaim(ns = {}, note = null) {
  const claim = unlockClaim(ns, note);
  if (!claim) return null;
  const stack = [...(ns?.[claim.stackKey] ?? []), note];
  return {
    patch: {
      [claim.stackKey]: stack,
      [claim.slotsKey]: (ns?.[claim.slotsKey] ?? 0) + 1,
    },
    which: claim.which,
    slot:  claim.slot,
    chordStack: stack,
  };
}
