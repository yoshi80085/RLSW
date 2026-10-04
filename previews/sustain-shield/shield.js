export * from '../../src/board/sustainShield.js';
import { createSustainShield, DEFAULTS } from '../../src/board/sustainShield.js';
import { damageState } from './damage.js';

// The lab supplies a synthetic hit ledger; the game supplies actual shield HP.
export function createShield() {
  const visual = createSustainShield();
  return { ...visual, update(time, settings = DEFAULTS, options = {}) {
    const state = damageState(time, options.mode, options.damage, options.manualHits);
    return visual.update(time, settings, { ...options, state });
  } };
}
