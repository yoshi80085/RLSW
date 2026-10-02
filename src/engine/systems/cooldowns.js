// A selected ability costs 5 Db and recharges over two owner-to-owner rounds.
// The opening kit is ready; collecting Db never grants a new ability.
import { SKILL_BY_ID } from '../../data/skillTree.js';
export const ABILITY_CD = Object.fromEntries(Object.keys(SKILL_BY_ID).map(id => [id, 2]));
export const ABILITY_DB_COST = Object.fromEntries(Object.keys(SKILL_BY_ID).map(id => [id, 5]));
export function cooldownLeft(ns, skillId) { return ns?.abilityCd?.[skillId] ?? 0; }
export function onCooldown(ns, skillId) { return cooldownLeft(ns, skillId) > 0; }
export function dbCostOf(skillId) { return ABILITY_DB_COST[skillId] ?? 0; }
export function canFire(ns, skillId) {
  return !!ABILITY_CD[skillId] && (ns?.unlockedSkills ?? []).includes(skillId)
    && !onCooldown(ns, skillId) && (ns?.dbPoints ?? 0) >= dbCostOf(skillId);
}
// Apply after validating the action, exactly once per activation (not per hop).
export function firePatch(ns, skillId) {
  if (!ABILITY_CD[skillId]) return {};
  return { dbPoints: Math.max(0, (ns?.dbPoints ?? 0) - dbCostOf(skillId)),
    abilityCd: { ...(ns?.abilityCd ?? {}), [skillId]: ABILITY_CD[skillId] } };
}
export function tickCooldowns(ns) {
  return Object.fromEntries(Object.entries(ns?.abilityCd ?? {}).map(([id, left]) => [id, Math.max(0, left - 1)]));
}
// 🪦 `tickShamisen` and `resetAllCooldowns` went with the glow-and-debt Shamisen
// (2026-10-02): the Iwato curse speeds up and resets nothing. §2.3.00.
