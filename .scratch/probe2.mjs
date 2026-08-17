import { simulateRiffPerformance, riffStats, riffSkill } from '../src/engine/systems/riffOff.js';
import { makeRng } from '../src/engine/rng.js';
const rng = makeRng(7);
for (const p of [0, 3, 5, 8]) {
  const r = simulateRiffPerformance(10, p, rng);
  console.log('P=' + p, 'skill=' + riffSkill(p).toFixed(2), JSON.stringify(riffStats(r)));
}
