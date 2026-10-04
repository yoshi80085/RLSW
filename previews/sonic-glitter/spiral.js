// The preview and game use one implementation and the approved settings.
import { SONIC_GLITTER, LIMITS, createSpiralGlitter as createSharedSpiral } from '../../src/board/sonicGlitter.js';
export { normalizeSettings, readRingStations, LIMITS } from '../../src/board/sonicGlitter.js';
export const DEFAULTS = SONIC_GLITTER;
export const PRESETS = Object.freeze({
  'Approved': { ...SONIC_GLITTER },
  'Double helix': { ...SONIC_GLITTER, turns: 2.2, strands: 2, radius: .79, spread: .025, density: 3000, size: 2.2, filament: .22, spin: .12 },
  'Stardust': { ...SONIC_GLITTER, turns: 4.5, strands: 3, radius: .62, spread: .19, density: 4400, size: 2.7, brightness: .7, twinkle: .85, filament: .025, iridescence: .8 },
});
export function createSpiralGlitter(mesh, options = {}) {
  return createSharedSpiral(mesh, { capacity: LIMITS.density[1], ...options });
}
