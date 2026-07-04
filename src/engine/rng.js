// ─── ENGINE RNG ──────────────────────────────────────────────────────────────
// Seeded, serializable PRNG (mulberry32). Every random draw in game RULES must
// go through an instance of this — never Math.random() — so that a server or
// replay can reproduce identical outcomes from { seed, cursor }.
//
// Serialization contract: an rng is fully described by its `seed` and `cursor`
// (number of draws so far). `restoreRng` re-seeds and burns `cursor` draws;
// game-scale cursors make this instant.

/** Core mulberry32 step. Returns [nextInternalState, float in [0,1)]. */
function mulberry32Step(a) {
  a = (a + 0x6d2b79f5) | 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [a, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
}

/** 32-bit string/number hash — used to derive fork seeds from labels. */
export function hashSeed(input) {
  const str = String(input);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Create a seeded rng.
 * @param {number} seed  uint32 seed
 * @param {number} [cursor=0]  draws already consumed (for restore)
 */
export function makeRng(seed, cursor = 0) {
  seed = seed >>> 0;
  let state = seed;
  let count = 0;
  const step = () => {
    const [next, val] = mulberry32Step(state);
    state = next;
    count++;
    return val;
  };
  // burn to cursor on restore
  while (count < cursor) step();

  const rng = () => step();
  /** integer in [0, n) */
  rng.int = n => Math.floor(step() * n);
  /** pick a random element of arr */
  rng.pick = arr => arr[Math.floor(step() * arr.length)];
  /** true with probability p */
  rng.chance = p => step() < p;
  /** in-place-free Fisher–Yates shuffle → new array */
  rng.shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(step() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  /** serializable snapshot */
  rng.state = () => ({ seed, cursor: count });
  /**
   * Derive an independent child rng for a subsystem (e.g. "riff", "events").
   * Deterministic: same parent seed + label → same child seed. Forking does
   * NOT consume parent draws, so subsystem call order can't desync streams.
   */
  rng.fork = label => makeRng((seed ^ hashSeed(label)) >>> 0);
  return rng;
}

/** Rebuild an rng from a snapshot produced by rng.state(). */
export function restoreRng({ seed, cursor }) {
  return makeRng(seed, cursor);
}
