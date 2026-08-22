// ─── 🕒 ABILITY COOLDOWNS ────────────────────────────────────────────────────
//
// One map, one tick, one gate. `ns.abilityCd` is `{ [skillId]: roundsLeft }` on
// the note sheet, ticked once per owner-turn in `turnFlow.js`.
//
// ⚠️ THIS REPLACED `psychoBushidoCd`, WHICH WAS THE ONLY COOLDOWN IN THE GAME.
// On 2026-08-22 Alex made "every ability has a cooldown" a rule
// (`RONIN_ABILITY_DESIGN.md` §0), and a rule that has to be satisfied thirteen
// times is not a rule you satisfy by adding thirteen fields. A named field per
// ability means every new ability needs an `economy` seed, a `turnFlow` tick, a
// `legalActions` gate and a HUD read before it can have a cooldown at all — four
// chances to forget, and `psychoBushidoCd` is the proof that when it is that
// much work, twelve abilities simply never get one.
//
// 📌 THE SHAPE IS DELIBERATELY `cadenceCooldowns`'. That map already lived on the
// sheet, already ticked in `turnFlow`, and already survived the netcode — it is
// a plain JSON object of string→number, which `setNoteStates` diffs and syncs
// for free. Copying a proven shape beats inventing a second one that must then
// be proven separately.
//
// ⚠️ ROUNDS, NOT SPIRIT-TURNS. The tick fires in `advanceTurnNotes`, which runs
// at the start of the OWNER's turn — so a `2` costs the owner two of his own
// turns regardless of how many Spirits are in the game. This is the opposite
// convention from board hazards (Poison Slime, the Gravity Vortex), which count
// in spirit-turns seeded with the living-Spirit count because their decay hook
// runs at the end of EVERY spirit's turn. Both are correct; they are counting
// different clocks. Do not "unify" them.

import {
  PSYCHO_BUSHIDO_CD,
  SHADOW_ILLUSION_CD,
  CURSED_SHAMISEN_CD,
  PSYCHO_BUSHIDO_DB_COST,
  SHADOW_ILLUSION_DB_COST,
  CURSED_SHAMISEN_DB_COST,
} from "../../data/gameConstants.js";

/**
 * skillId → rounds the ability sleeps after use.
 *
 * ⚠️ AN ABILITY MISSING FROM THIS TABLE HAS NO COOLDOWN. That is a real state
 * and not an error — nine abilities are in it today — but under the 2026-08-22
 * rule every absence is a DEBT, not a design. `RONIN_ABILITY_DESIGN.md` §0.2 is
 * the ledger of who still owes one.
 */
export const ABILITY_CD = {
  psycho_bushido:  PSYCHO_BUSHIDO_CD,
  shadow_illusion: SHADOW_ILLUSION_CD,
  cursed_shamisen: CURSED_SHAMISEN_CD,
};

/**
 * skillId → Db charged PER USE.
 *
 * ⚠️ NOT `dbCost` FROM THE SKILL TREE. That is the one-time unlock price, paid
 * once, by filling the bar. This is charged out of `ns.dbPoints` every single
 * time the ability fires — and because `advanceDB` spends that same pool on the
 * next unlock the moment it fills, using an ability literally costs progress.
 *
 * 📌 The five abilities that already charged per use (Sunbeam, Space is
 * Displaced, Gravity Control, Code Injection, and the Shamisen) each did it with
 * a bespoke check inside their own resolver. Only the Shamisen is folded in here
 * so far, because only the Ronin's kit has been through the rule. The other four
 * keep their own constants until their Spirits get the same pass.
 */
export const ABILITY_DB_COST = {
  psycho_bushido:  PSYCHO_BUSHIDO_DB_COST,
  shadow_illusion: SHADOW_ILLUSION_DB_COST,
  cursed_shamisen: CURSED_SHAMISEN_DB_COST,
};

/** Rounds left before `skillId` can be used again. 0 = ready. */
export function cooldownLeft(ns, skillId) {
  return (ns?.abilityCd ?? {})[skillId] ?? 0;
}

/** True while `skillId` is still recharging. */
export function onCooldown(ns, skillId) {
  return cooldownLeft(ns, skillId) > 0;
}

/** Db charged per use of `skillId`; 0 for anything not in the table. */
export function dbCostOf(skillId) {
  return ABILITY_DB_COST[skillId] ?? 0;
}

/**
 * Can this sheet afford to fire `skillId` right now?
 *
 * ⚠️ AFFORDABILITY AND READINESS ARE ONE QUESTION, ON PURPOSE. They were two
 * checks in every resolver that had them, and a resolver that tested one and
 * forgot the other is exactly how an ability ends up free — which is the
 * failure this whole module exists to stop. Ask it once, here.
 */
export function canFire(ns, skillId) {
  return !onCooldown(ns, skillId) && (ns?.dbPoints ?? 0) >= dbCostOf(skillId);
}

/**
 * The note-sheet patch for FIRING `skillId`: Db off the bar, cooldown started.
 *
 * ⚠️ RETURNS A PATCH, IT DOES NOT WRITE. Every caller — the client's resolvers,
 * `transition.js`'s searcher, the harness — applies patches its own way, and a
 * helper that wrote through one of them would be unusable from the other two.
 * The kernel and the client MUST charge identically or the searcher is playing a
 * cheaper game than the player (the same failure `melodyCommit` warns about).
 *
 * 📌 Spreads the EXISTING map rather than replacing it, so an ability going on
 * cooldown never resets another one that is already counting down.
 */
export function firePatch(ns, skillId) {
  const cd = ABILITY_CD[skillId] ?? 0;
  const patch = {};
  const cost = dbCostOf(skillId);
  if (cost > 0) patch.dbPoints = Math.max(0, (ns?.dbPoints ?? 0) - cost);
  if (cd > 0)   patch.abilityCd = { ...(ns?.abilityCd ?? {}), [skillId]: cd };
  return patch;
}

/**
 * One round off every live cooldown. Called from `advanceTurnNotes`.
 *
 * 📌 Floors at 0 rather than deleting the key, matching `cadenceCooldowns`. A
 * settled `0` and an absent key both read as "ready" through `cooldownLeft`, so
 * nothing downstream can tell them apart — and keeping the key means the HUD can
 * show an ability as *used this match* rather than *never touched*.
 */
export function tickCooldowns(ns) {
  return Object.fromEntries(
    Object.entries(ns?.abilityCd ?? {}).map(([k, v]) => [k, Math.max(0, v - 1)])
  );
}
