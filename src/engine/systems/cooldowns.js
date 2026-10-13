// A selected ability is ready at the start of the match and recharges over two
// owner-to-owner rounds. 🪦 THERE IS NO Db ANY MORE (Alex, 2026-10-02): the
// cooldown and each ability's own sacrifice — AP, Action Token, stack notes,
// Sustain drain, strings — are the gate, not a second economy laid over them.
// ⚠️ Do not re-add a currency check here: `canFire` is the ONE gate the client,
// the kernel, the bot and the sandbox all share, so a cost added here is a cost
// added everywhere at once.
import { SKILL_BY_ID } from '../../data/skillTree.js';
export const ABILITY_CD = Object.fromEntries(Object.keys(SKILL_BY_ID).map(id => [id, 2]));
export function cooldownLeft(ns, skillId) { return ns?.abilityCd?.[skillId] ?? 0; }
export function onCooldown(ns, skillId) { return cooldownLeft(ns, skillId) > 0; }
export function canFire(ns, skillId) {
  return !!ABILITY_CD[skillId] && (ns?.unlockedSkills ?? []).includes(skillId)
    && !onCooldown(ns, skillId);
}
// Apply after validating the action, exactly once per activation (not per hop).
export function firePatch(ns, skillId) {
  if (!ABILITY_CD[skillId]) return {};
  return { abilityCd: { ...(ns?.abilityCd ?? {}), [skillId]: ABILITY_CD[skillId] } };
}
/**
 * 👤 THE SHADOW'S CLOCK WAITS FOR THE DOUBLE (Alex, 2026-10-13: *"for now its cool
 * down begins after the previous 'shadow' has been exhausted. It lasts as long as
 * everything else."*). While a double is standing at the top of his turn, the
 * Shadow's cooldown does not tick — including the turn it falls, which counts as
 * the moment it was "fired". Then the usual 2 rounds. ⚠️ Why: with every cooldown
 * flattened to 2 (Db cut, 2026-10-02) a 2-turn double and a 2-round clock ended
 * together, so he could stand a new one up the turn the last one fell — the
 * ability became a thing he KEEPS UP rather than spends (the 2026-09-04 respec).
 * 📌 Read off `ns.shadowIllusion` BEFORE this turn's double tick, so a double that
 * a hit dismissed mid-round starts its clock at once; one that times out at his
 * turn start starts it there.
 */
export const HELD_WHILE_LIVE = Object.freeze({ shadow_illusion: ns => !!ns?.shadowIllusion });
export function tickCooldowns(ns) {
  return Object.fromEntries(Object.entries(ns?.abilityCd ?? {}).map(([id, left]) =>
    [id, HELD_WHILE_LIVE[id]?.(ns) ? left : Math.max(0, left - 1)]));
}
// 🪦 `tickShamisen` and `resetAllCooldowns` went with the glow-and-debt Shamisen
// (2026-10-02): the Iwato curse speeds up and resets nothing. §2.3.00.
