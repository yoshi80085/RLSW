import { SKILL_TREE } from './skillTree.js';
import { characterId } from './spiritIdentity.js';

export const LOADOUT_SIZE = 2;
export const abilitiesFor = spirit => SKILL_TREE.routes.find(r => r.spiritOnly === characterId(spirit))?.skills ?? [];
export function validLoadout(spirit, selected) {
  const allowed = new Set(abilitiesFor(spirit).map(s => s.id));
  return Array.isArray(selected) && selected.length === LOADOUT_SIZE
    && new Set(selected).size === LOADOUT_SIZE && selected.every(id => allowed.has(id));
}
// Direct launches and headless matches receive a deterministic starting kit.
export function initialLoadout(spirit) {
  if (spirit.abilities !== undefined) {
    if (!validLoadout(spirit, spirit.abilities)) throw new Error(`Invalid ability loadout for ${spirit.id}`);
    return [...spirit.abilities];
  }
  return abilitiesFor(spirit).slice(0, LOADOUT_SIZE).map(s => s.id);
}
