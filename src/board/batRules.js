import { ALL_HEXES, HEX_BY_NUM, HEX_BY_QR } from './hexMap.js';
import { axialDist, axialNeighbors } from './hexGeometry.js';

export function batSpawn(excluded, rng) {
  const blocked = new Set(excluded);
  const pool = ALL_HEXES.filter(h => !blocked.has(h.num));
  return pool.length ? pool[Math.floor(rng() * pool.length)].num : null;
}

// Dynamic radix weights guarantee FP > all timing/distance combined, and
// timing > distance. Ranking timing avoids arbitrary millisecond/FP scales.
export function batTarget(fromNum, spirits, sheets = {}, timing = {}, current = {}) {
  const from = HEX_BY_NUM[fromNum];
  if (!from) return null;
  const candidates = spirits.filter(s => !s.knockedOut && (s.vibe ?? 1) > 0 && HEX_BY_NUM[s.num])
    .map(s => {
      const h = HEX_BY_NUM[s.num], t = timing[s.id];
      return { id: s.id, num: s.num, fp: Math.max(0, sheets[s.id]?.fame ?? 0),
        ms: Math.max(t?.turns ? t.totalMs / t.turns : 0, current.spiritId === s.id ? current.ms ?? 0 : 0),
        distance: axialDist(from.q, from.r, h.q, h.r) };
    });
  const times = [...new Set(candidates.map(c => c.ms))].sort((a, b) => a - b);
  const distanceWeight = Math.max(0, ...candidates.map(c => c.distance)) + 1;
  const fpWeight = (times.length + 1) * distanceWeight;
  return candidates.map(c => ({ ...c, score: c.fp * fpWeight + times.indexOf(c.ms) * distanceWeight - c.distance }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0] ?? null;
}

export function batStep(fromNum, target, blocked, rng) {
  const from = HEX_BY_NUM[fromNum], goal = HEX_BY_NUM[target?.num];
  if (!from || !goal) return fromNum;
  const taken = new Set(blocked);
  const options = axialNeighbors(from.q, from.r).map(h => HEX_BY_QR[`${h.q},${h.r}`])
    .filter(h => h && !taken.has(h.num))
    .map(h => ({ num: h.num, d: axialDist(h.q, h.r, goal.q, goal.r) }));
  if (!options.length) return fromNum;
  const best = Math.min(...options.map(h => h.d));
  const ties = options.filter(h => h.d === best);
  return ties[Math.floor(rng() * ties.length)].num;
}
