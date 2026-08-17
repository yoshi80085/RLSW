// --- ENGINE: ATTACK PARAMETERS -----------------------------------------------
// The STAT DERIVATION that feeds `attackRolled`, extracted from the React
// monolith's `resolveSwing` / `initiateSonicAttack` preambles.
//
// WHY THIS IS THE MISSING LINK. The engine already owns both ends of a battle:
// `applyAttackRolled` rolls the dice and decides the verdict, and
// `battleFlow.js` runs the consequence sequence. What lived only in the client
// was the bit in the MIDDLE — turning two note sheets and two board positions
// into `{ atkStat, defStat, dicePool, atkDie, defDie, atkFloor, posing }`.
// Without it a headless searcher can generate an attack (`legalActions`) and
// score the aftermath (`evaluate`) but cannot actually THROW the punch.
//
// PURE. Takes state, returns a payload. It rolls nothing, logs nothing and
// mutates nothing — every draw still happens inside `applyAttackRolled` off the
// seeded stream, which is what keeps §0.4's replay/desync guarantee intact.
//
// ⚠️ HOW MUCH OF THE OLD PREAMBLE IS ACTUALLY LIVE. Reading the client, most of
// the modifier tower is inert and has been for a while:
//   · `getBattleSkillMods` returns `halveDef:false, fogActive:false,
//     pyroBonus:0, laserActive:false` — the stage-effect battle buffs were
//     RETIRED when Stage Effects moved onto the board. The flags survive only
//     so downstream visuals don't crash.
//   · `edgeCombatMods()` returns `{ drive: 0, sustainPenalty: 0 }` — the
//     Dissonance Edge is removed.
// They are therefore NOT re-implemented here. This is a deliberate simplification
// of dead branches, not an oversight: reproducing `+ 0` in four places would
// imply those systems still exist and invite someone to "fix" the bot by tuning
// them. If a stage effect ever bites in battle again, it enters HERE, once.

import { evaluateChord } from "../../music/chords.js";
import { sonicRig } from "./sonicRig.js";
import { SPIRIT_DEFS } from "../../data/spirits.js";
import {
  ATK_BONUS_CAP, CHARGE_FLOOR_BONUS,
  THRASH_DIE, THRASH_CEIL_DIE,
  SONIC_DEF_DIE, SONIC_DEF_DIE_OUT_OF_RIG,
  SONIC_BASE_DIE, ELEVEN_DRIVE,
} from "../../data/gameConstants.js";
import { ampBlown } from "./eleven.js";
import { distFromHome } from "../policies/evaluate.js";

// 6️⃣ CUT 2026-08-17 — `BEAST_DRIVE`, Number of the Beast's uncapped +6.
//
// §1a/§1b of `METALNESS_REWORK_DESIGN.md` cut it for two reasons. It fought
// Azrael by rule — the Beast ended when you put a rival down, and Azrael paid
// for a knockdown STREAK, so his two most expensive slots were mutually
// exclusive. And the numerology came first: 666 → +6 Drive → a 2-Vibe gate, with
// the design bent to fit the number.
//
// ⚠️ THE MECHANICAL SIN IS THE ONE WORTH REMEMBERING HERE. It got its +6 by
// riding `atkBase`, i.e. by being written OUTSIDE `ATK_BONUS_CAP` rather than
// inside it — and a cap with an exemption written into it is not a cap. 🔊 Goes
// to 11 replaces it by SETTING the total instead, which needs no exemption and
// leaves the rule intact. See systems/eleven.js.

// The biggest a charged die may grow. Mirrors the client's `Math.min(12, s + 2)`.
export const CHARGE_DIE_CEILING = 12;

// 🎸 WHAT AN ATTACK COSTS THE DRIVE STACK, and the two halves are NOT the same
// rule wearing two numbers — they differ in WHEN as well as HOW MUCH:
//
//   · SWING  — 2 notes, ON A HIT ONLY. Whiffing keeps the stack intact, so the
//     spend is a consequence and `battleConsequences` applies it.
//   · SONIC  — 1 note, HIT OR MISS. You spent the note the moment you projected
//     it, so the spend is part of throwing the attack and the caller applies it
//     BEFORE the roll (after the chord stats are derived off the full stack —
//     get that order wrong and the beam is weaker than the one the player fires).
//
// Both transcribed from the client (`resolveSwing`'s `.slice(2)` and
// `initiateSonicAttack`'s `sonicSpendN = 1`), not invented here.
export const SWING_DRIVE_SPEND = 2;
export const SONIC_DRIVE_SPEND = 1;

/**
 * A Spirit's combat chord.
 *
 * ⚠️ THREE COPIES OF THIS EXIST — `spiritChord` in the monolith,
 * `botSpiritChord` in `policies/bot.js`, and this one. They are byte-identical
 * today. This is the copy a headless caller should use; the other two should
 * collapse into it when their files are next touched.
 *
 * 🪐 Intergalactic 0's innate rides here: +1 Sustain on every voicing, and a
 * cluster reads as +1 Drive too (his Freestyle identity — the 8/2 cluster read).
 */
export function spiritChord(spiritId, notes) {
  const ch = evaluateChord(notes);
  if (spiritId === 'intergalactic_0') {
    return { ...ch, drive: ch.id === 'cluster' ? ch.drive + 1 : ch.drive, sustain: ch.sustain + 1 };
  }
  return ch;
}

/** The dice pool a Spirit's Sonic rig throws right now, charge included. */
export function rigFor(spirit, ns = {}) {
  // 🔊 A BLOWN AMP IS OUT-OF-RIG, WHEREVER HE IS STANDING — and expressing it
  // that way is why Goes to 11 needs no new systems at all. §3.1's rule already
  // says what happens to a Spirit with no rig behind them: the Sonic is OFFLINE
  // rather than weak (`legalActions` refuses to emit it), and they brace against
  // an incoming beam on a bare d4 instead of a d6. Blowing the amp just moves him
  // into that state without moving him. One flag, one line, and the "worst square
  // on the board" the rework promised is the square he is already on.
  if (ampBlown(ns)) return { pool: [SONIC_BASE_DIE], inRange: false };
  const chargeBoost = (ns.chargeCeilTurns ?? 0) > 0 ? 1 : 0;
  return sonicRig(ns.unlockedSkills ?? [], distFromHome(spirit, ns), chargeBoost);
}

/**
 * Everything `attackRolled` needs, for one attacker against one defender.
 *
 * @param {object} state     engine GameState
 * @param {string} attackerId
 * @param {string} defenderId
 * @param {'swing'|'sonic'} kind
 * @param {object} [view]    client-owned slices — `posing` only
 * @returns {object|null} the `attackRolled` options payload, plus `_derived`
 *   for tests and logs. `null` when either Spirit is missing from the board.
 *
 * ⚠️ `smashExposed` is READ here but NOT CLEARED. The client clears it as a
 * side effect mid-derivation (`setNoteField(targetId, { smashExposed: false })`),
 * which a pure function cannot do — so the CALLER must clear it after a Smashed
 * defender is struck, and `_derived.consumedSmashExposed` says when. Missing
 * that clear makes the exposure permanent, which reads in play as "this rival's
 * armour stopped working" and is very hard to trace back to here.
 */
export function attackParams(state, attackerId, defenderId, kind, view = {}) {
  const { posing = {} } = view;
  const spirits = state?.spirits ?? [];
  const attacker = spirits.find(s => s.id === attackerId);
  const defender = spirits.find(s => s.id === defenderId);
  if (!attacker || !defender) return null;

  const nsA = state?.noteStates?.[attackerId] ?? {};
  const nsD = state?.noteStates?.[defenderId] ?? {};
  const defA = SPIRIT_DEFS[attackerId] ?? {};
  const defD = SPIRIT_DEFS[defenderId] ?? {};

  // 🎸 HARMONY → COMBAT. Drive comes off the Drive stack, Sustain off the
  // Sustain stack; the static spirit stat is only a fallback for a Spirit who
  // has not voiced anything yet. This is the Earned lens in its purest form —
  // the number that decides the fight is one the player built this turn.
  const atkChord = (nsA.driveStack?.length)   ? spiritChord(attackerId, nsA.driveStack)   : null;
  const defChord = (nsD.sustainStack?.length) ? spiritChord(defenderId, nsD.sustainStack) : null;
  const atkChordDrive = atkChord ? atkChord.drive : (attacker.drive ?? defA.drive ?? 6);

  // 💥 SMASH EXPOSURE — a Smashed rival is wide open: this blow ignores their
  // Sustain entirely, then the flag clears. §3.4's real payload, and the reason
  // a Smash followed by any hit is the highest-damage sequence in the game.
  const exposed = !!nsD.smashExposed;
  const defChordSustain = exposed
    ? 0
    : (defChord ? defChord.sustain : (defender.sustain ?? defD.sustain ?? 5));

  // ATTACK. Berserk rides the base (uncapped); everything else is a bonus and
  // lives under ATK_BONUS_CAP so no single turn assembles a +6-and-up tower.
  const atkBase  = atkChordDrive + (nsA.instrumentDropped ? -1 : 0);
  const rawBonus = (nsA.tempDrive ?? 0) + (nsA.moshDrive ?? 0);
  const atkBonus = Math.min(rawBonus, ATK_BONUS_CAP);

  // 🔊 GOES TO 11 — a SET, and therefore a CEILING as much as a floor.
  //
  // ⚠️ IT DOES NOT PARTICIPATE IN THE TOWER, which is the point. The ability it
  // replaces got its +6 by riding `atkBase` — i.e. by being written outside
  // ATK_BONUS_CAP rather than inside it — and a cap with an exemption in it is
  // not a cap. Overwriting the total needs no exemption, leaves the rule intact,
  // and gives the joke for free: pile on Moshpits and a Drive boost, hit the
  // dial, and you get QUIETER. The amp only goes to 11.
  const cranked = !!nsA.atEleven;
  const atkStat  = cranked ? ELEVEN_DRIVE : atkBase + atkBonus;

  // DEFENCE. 🥊 `swingExposed` is the melee self-debuff: committing to a Swing
  // drops your guard for −1 Sustain until your next turn. Ranged Sonic keeps
  // you safe — the evaluator must charge the Swing this or it over-rates melee.
  const defBase = defChordSustain - (nsD.swingExposed ? 1 : 0);
  const defStat = defBase + (nsD.tempSustain ?? 0);

  // ⚡ CHARGE ZONE — attacks only. The FLOOR clamps every result to at least
  // 1 + CHARGE_FLOOR_BONUS; the CEILING grows dice a size. The dormant
  // `dieFloorBoost` (octave resolution / Spinal Tap) wires in here too, and the
  // STRONGEST floor wins — they explicitly do not stack.
  const chargeFloor = (nsA.chargeFloorTurns ?? 0) > 0;
  const chargeCeil  = (nsA.chargeCeilTurns  ?? 0) > 0;
  const atkFloor = Math.max(chargeFloor ? CHARGE_FLOOR_BONUS : 0, nsA.dieFloorBoost ?? 0);

  const base = {
    atkStat, defStat,
    posing: !!posing[defenderId],
    halveDef: false,                    // retired — see the header
    atkFloor,
    _derived: {
      atkChord: atkChord?.name ?? null,
      defChord: defChord?.name ?? null,
      atkChordDrive, defChordSustain,
      atkBonusCapped: rawBonus > atkBonus,
      cranked,
      crankedDown: cranked && (atkBase + atkBonus) > ELEVEN_DRIVE,
      consumedSmashExposed: exposed,    // ⚠️ caller must clear the flag — see above
    },
  };

  if (kind === 'sonic') {
    // The attacker throws their rig's pool; the ceiling charge grows EVERY die
    // one size (d6→d8, d8→d10), capped.
    const pool = rigFor(attacker, nsA).pool;
    const dicePool = chargeCeil ? pool.map(s => Math.min(CHARGE_DIE_CEILING, s + 2)) : [...pool];

    // 🛡️ Inside their own rig radius the rival braces against the beam with
    // their amp behind them (d6). Stranded outside it there is no rig to answer
    // with and they scramble a bare d4 — the same rule that blocks the riff-off.
    const defInRig = rigFor(defender, nsD).inRange;
    return {
      ...base,
      dicePool,
      defDie: defInRig ? SONIC_DEF_DIE : SONIC_DEF_DIE_OUT_OF_RIG,
      _derived: { ...base._derived, defInRig, poolBeforeCharge: pool },
    };
  }

  // SWING — a single die. The ceiling charge grows the Thrash die d4→d6; the
  // defender always answers a Swing on the base die.
  //
  // 🎸 AND THE CHORD BURN PLAN RIDES ALONG. `battleConsequences` spends these on
  // a HIT ONLY (whiffing keeps the stack intact), which is why the plan is
  // derived here — pure, off the stack as it stands BEFORE the blow — and
  // applied there.
  //
  // ⚠️ THIS WAS MISSING UNTIL 2026-08-17 AND THE GAP WAS SILENT. `battleConsequences`
  // destructures `swingChordLeft = [], swingChordSpent = []`, so a battle object
  // that never carried them burned nothing and logged nothing — it cannot tell
  // "no notes left to spend" from "nobody told me what to spend". Every headless
  // Swing was therefore FREE, while the client's `resolveSwing` hung the same two
  // fields on its own battle object and paid in full. That is §6a's over-permissive
  // failure wearing a different coat: the rule lived in the client, the engine had
  // nothing to transcribe from, and the default swallowed the evidence.
  //
  // 📌 The 2 is the client's literal `.slice(2)` in `resolveSwing`, transcribed
  // rather than invented. Hoist it to `gameConstants` when the Sonic's
  // `sonicSpendN = 1` goes with it — they are one rule with two numbers.
  //
  // ⚠️ THE TENTACLE INHERITS THIS, because it enters as `rollKind: 'swing'` and
  // this function sees only the roll kind. That is consistent with §4a's "one
  // combat path, not two" — but whether a reach swing should ALSO burn 2 Drive
  // notes on top of the trail it already spent is a `METALNESS_REWORK_DESIGN.md`
  // question, not a transcription. Flagged there rather than decided here.
  const driveStack = nsA.driveStack ?? [];
  return {
    ...base,
    dicePool: null,
    atkDie: chargeCeil ? THRASH_CEIL_DIE : THRASH_DIE,
    defDie: THRASH_DIE,
    swingChordLeft:  driveStack.slice(SWING_DRIVE_SPEND),
    swingChordSpent: driveStack.slice(0, SWING_DRIVE_SPEND),
  };
}
