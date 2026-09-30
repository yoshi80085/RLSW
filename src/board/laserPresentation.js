// Seconds animate the hardware only. Active lanes and expiry come from the
// engine; there is no preview round clock or RNG in the live presentation.
export const LASER_TIMING = Object.freeze({ descend: 1.9, open: .7, ignite: .65,
  close: .22, travel: 2.4, align: .45, relight: .43, cool: .7, ascend: 2.2 });
export const laserEase = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export function laserEnvelope(mode, age, { reduced = false } = {}) {
  const t = LASER_TIMING, base = { travel: 1, lift: 1, shutter: 1, beam: 1, lens: 1, busy: false };
  if (mode === 'off' || (reduced && mode === 'leave')) return { ...base, lift: 0, shutter: 0, beam: 0, lens: 0 };
  if (reduced || mode === 'hold') return base;
  if (mode === 'enter') return { ...base, lift: laserEase(age / t.descend), shutter: laserEase((age - t.descend) / t.open),
    lens: laserEase((age - t.descend) / t.open), beam: laserEase((age - t.descend - t.open) / t.ignite), busy: age < t.descend + t.open + t.ignite };
  if (mode === 'move') {
    const arrived = t.close + t.travel, ready = arrived + t.align;
    const shutter = age < t.close ? 1 - laserEase(age / t.close) : laserEase((age - arrived) / t.align);
    return { ...base, travel: laserEase((age - t.close) / t.travel), shutter, lens: shutter,
      beam: laserEase((age - ready) / t.relight), busy: age < ready + t.relight };
  }
  // Expired lanes are extinguished immediately; only the dark hardware remains.
  return { ...base, lift: 1 - laserEase((age - t.cool) / t.ascend), shutter: 1 - laserEase(age / .16),
    beam: 0, lens: 1 - laserEase(age / 1.15), busy: age < t.cool + t.ascend };
}
