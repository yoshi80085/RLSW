import * as THREE from 'three';
import { DAMAGE_DEFAULTS, normalizeDamage } from '../../src/board/sustainDamage.js';
export * from '../../src/board/sustainDamage.js';
const clamp = THREE.MathUtils.clamp;
const smooth = n => { n = clamp(n, 0, 1); return n * n * (3 - 2 * n); };
export const FIRST_HIT = 4.2;
export const breakTime = d => FIRST_HIT + (d.hits - 1) * d.interval;
export const cycleDuration = (d = DAMAGE_DEFAULTS) => breakTime(d) + Math.max(3.5, d.linger * 1.6) + .5;
const hitLocations = [[.78, .55], [.26, .6], [.56, .7], [.06, .48], [.9, .65], [.4, .45], [.68, .72], [.16, .62]];

// State and particles are sampled from hit times, never integrated frame by
// frame. Pausing, seeking backwards and replaying therefore give the same hit.
export function damageState(time, mode = 'living', values = DAMAGE_DEFAULTS, manualHits = []) {
  const d = normalizeDamage(values), duration = cycleDuration(d);
  const clock = mode === 'cycle' ? (time % duration + duration) % duration : time;
  const times = mode === 'cycle' ? Array.from({ length: d.hits }, (_, i) => FIRST_HIT + i * d.interval) : manualHits.slice(0, d.hits);
  const events = times.flatMap((at, index) => {
    if (at > clock + 1e-9) return [];
    return [{ at, index, age: Math.max(0, clock - at), u: hitLocations[index][0], r: hitLocations[index][1],
      before: 1 - index / d.hits, after: Math.max(0, 1 - (index + 1) / d.hits), breaking: index === d.hits - 1 }];
  });
  const last = events.at(-1), health = last?.after ?? 1;
  const build = mode === 'cycle' ? smooth(clock / 2.5) : 1;
  const breakAge = last?.breaking ? last.age : -1;
  let phase = health <= 0 ? (breakAge < d.linger * 1.4 ? 'Shield breaks · glitter released' : 'Shield spent')
    : health <= 1 / d.hits + 1e-9 ? 'Critical · the rings are coming apart'
      : health < 1 ? 'Weakened · energy escapes through the gaps' : 'Shield sustained';
  if (build < 1) phase = 'Gathering from the Sustain amp';
  else if (last && !last.breaking && last.age < .65) phase = `Hit ${events.length} · glitter sheds from the surface`;
  return { time: clock, duration, build, health, events, hitAge: last?.age ?? -1, breakAge,
    phase, feed: mode === 'cycle' && clock < 2.5, hits: events.length };
}

