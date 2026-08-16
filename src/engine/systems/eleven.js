// ─── ENGINE SYSTEM: 🔊 GOES TO 11 ────────────────────────────────────────────
// `METALNESS_REWORK_DESIGN.md` §4d. The dial, not the bonus.
//
// ── WHY IT IS A SET AND NOT A BONUS ─────────────────────────────────────────
// Everything in this game has a cap, and eleven is one louder than the cap.
// That is the whole joke and it is also the whole mechanic.
//
// `ATK_BONUS_CAP` is 5, and `attackParams` builds an attack as
// `base + min(bonus, 5)` precisely so no single turn assembles a tower. The
// ability this replaces — 6️⃣ Number of the Beast — got its +6 by riding the
// BASE instead, i.e. by being written outside the rule rather than inside it.
// That is a special case, and special cases are how a cap stops meaning
// anything.
//
// A SET needs no exemption. `atkStat = 11` does not participate in the bonus
// tower at all, so the cap is untouched and still true. And it buys a second
// property for free, which is the actually interesting one:
//
//   ⚠️ IF HE IS ALREADY LOUDER THAN 11, CALLING IT TURNS HIM DOWN.
//
// Stack Moshpits and a Drive boost onto a good chord, hit the dial, and you get
// QUIETER. The amp only goes to 11. The joke and the balance lever are the same
// rule — it is a hard ceiling on his damage that he opts into, which means his
// buff pile can never compound into something the cap was supposed to prevent.
//
// ── THE TWO COSTS ───────────────────────────────────────────────────────────
// 1. THE SUSTAIN STACK. §0 of the rework: he is the toughest body in the game —
//    the only Spirit with both 5 Vibe and 6 Sustain — and nothing in his kit
//    read that stat. Not one thing. This spends it: armour into volume.
//
// 2. THE AMP. Blowing it does not make his rig WEAK, it makes it OFFLINE, and
//    that costs nothing to implement because §3.1's rule already exists: outside
//    your own rig radius the Sonic is not available and you brace on a bare
//    `SONIC_DEF_DIE_OUT_OF_RIG` (d4) instead of a d6. A blown amp simply reads
//    as out-of-rig wherever he stands. One enormous swing, then a turn in the
//    worst square on the board.
//
// ── ⚠️ AND KNOCKBACK IMMUNITY, SALVAGED ─────────────────────────────────────
// §1b's salvage note: the Beast's one genuinely good idea was immunity to
// knockback — "the only answer to a Smash (2 hexes) or a Blaster this Spirit
// ever had" — and it asks for it to be hung off this ability if nothing else
// provides it. Nothing else does, so it hangs here. It also reads: the man is
// braced against his own amp stack with the gain on 11. He does not move.

import {
  ELEVEN_DRIVE, ELEVEN_AMP_BLOWN_TURNS,
} from "../../data/gameConstants.js";

/** Is this Spirit currently cranked? */
export function atEleven(ns) {
  return !!ns?.atEleven;
}

/** Is this Spirit's rig blown right now? */
export function ampBlown(ns) {
  return (ns?.ampBlownTurns ?? 0) > 0;
}

/**
 * May `spiritId` call it?
 *
 * ⚠️ THE SUSTAIN STACK IS THE GATE, not merely the bill. If the cost is "your
 * Sustain stack" then calling it with an empty stack costs nothing at all, and
 * a free 11 is a different and much worse ability. Requiring a stack to spend is
 * what keeps the price honest — and it means the turn he wants to crank is a
 * turn he spent notes building armour, which is the decision.
 */
export function canCallEleven(state, spiritId) {
  const ns = state?.noteStates?.[spiritId] ?? {};
  if (ns.atEleven) return false;
  return (ns.sustainStack ?? []).length > 0;
}

/**
 * ELEVEN_CALLED — turn it up.
 *
 * ⚠️ `ampBlownTurns` IS SEEDED WITH 2 AND THE ARITHMETIC IS THE WHOLE POINT.
 * It ticks at the END of his own turn (`applyDebuffsTicked`), so:
 *
 *     call it on turn N ─┬─ end of N  → 1   (blown)
 *                        ├─ all of N+1     (blown — the full turn without a rig)
 *                        └─ end of N+1 → 0 (back for N+2)
 *
 * Seeding with 1 would look right and cost NOTHING: the tick at the end of turn
 * N would clear it before he ever drew a hex without a rig. That is the trap
 * `economy.js` documents at length for Sunbeam's `blindTurns`, the one
 * `decayPoisonSlime` fell into, and the one the slime road's decay hit again
 * last week. This is the fourth appearance, so the sum is written out above
 * rather than left as a number somebody has to re-derive under pressure.
 */
export function applyElevenCalled(state, { spiritId }) {
  if (!canCallEleven(state, spiritId)) return state;
  const ns = state.noteStates[spiritId];
  return {
    ...state,
    noteStates: {
      ...state.noteStates,
      [spiritId]: {
        ...ns,
        atEleven:      true,
        sustainStack:  [],                          // armour into volume
        ampBlownTurns: ELEVEN_AMP_BLOWN_TURNS,
      },
    },
  };
}

/** The attack stat of a cranked Spirit — flat, capless, and a CEILING. */
export function elevenDrive() {
  return ELEVEN_DRIVE;
}
