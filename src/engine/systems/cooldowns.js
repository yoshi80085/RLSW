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
export function tickCooldowns(ns) {
  return Object.fromEntries(Object.entries(ns?.abilityCd ?? {}).map(([id, left]) => [id, Math.max(0, left - 1)]));
}
// 🪦 `tickShamisen` and `resetAllCooldowns` went with the glow-and-debt Shamisen
// (2026-10-02): the Iwato curse speeds up and resets nothing. §2.3.00.
