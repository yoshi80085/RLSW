// Riff-off constants inlined from the main file
export const RIFF_LEN_DEFAULT = 10;     // fallback when no length is specified — riffs are STATEMENTS now
const RIFF_NOTE_WINDOW  = 1600;
const RIFF_QUICK_WINDOW = 1280;
const RIFF_GAP_NORMAL   = 300;          // tightened — the riff drives forward
const RIFF_GAP_QUICK    = 160;
const RIFF_GAP_REST     = 650;
const RIFF_NATURALS     = ['a','b','c','d','e','f','g'];
const RIFF_SHARPABLE    = new Set(['a','c','d','f','g']);

// The riff's GROOVE: each note gets a feel — steady, rushed (short heads-up,
// tighter window), or preceded by a rest. The first note is always steady.
// All generators take an optional `rand` (0..1 fn, default Math.random) so the
// engine can thread its seeded rng through for deterministic multiplayer riffs.
export function generateRiffRhythm(rand = Math.random, len = RIFF_LEN_DEFAULT) {
  return Array.from({ length: len }, (_, i) => {
    if (i === 0) return { window: RIFF_NOTE_WINDOW, gapBefore: 0, feel: 'steady' };
    const roll = rand();
    // Heavier groove: more gallop (rushed pairs), fewer polite breathers.
    if (roll < 0.38) return { window: RIFF_QUICK_WINDOW, gapBefore: RIFF_GAP_QUICK, feel: 'rushed' };
    if (roll < 0.50) return { window: RIFF_NOTE_WINDOW,  gapBefore: RIFF_GAP_REST,  feel: 'rest' };
    return { window: RIFF_NOTE_WINDOW, gapBefore: RIFF_GAP_NORMAL, feel: 'steady' };
  });
}

// Round 2 is FASTER and more intense: tighter hit-windows, shorter gaps, and no
// restful breathers — the riff comes at you harder. Windows are floored generously
// so a player reading notes can still keep up rather than getting blown out.
export function speedUpRiffRhythm(rhythm, factor = 0.82) {
  const minWin = 740;
  return rhythm.map((b, i) => ({
    window:    Math.max(minWin, Math.round((b.window ?? RIFF_NOTE_WINDOW) * factor)),
    gapBefore: i === 0 ? 0 : Math.round((b.gapBefore ?? RIFF_GAP_NORMAL) * factor * 0.9),
    feel:      b.feel === 'rest' ? 'rushed' : b.feel,   // breathers become rushes
  }));
}

export const RIFF_CONTOUR_LABELS = {
  climb:   'ASCENDING RUN',
  descent: 'DESCENDING RUN',
  arch:    'RISE & FALL',
  valley:  'DIP & CLIMB',
  zigzag:  'ZIGZAG LICK',
};
export const RIFF_ANSWER_LABELS = {
  inversion:  { name: 'INVERSION',       desc: 'mirrors the riff — every climb becomes a fall' },
  modulation: { name: 'MODULATION',      desc: 'same shape, shifted to a new key' },
  variation:  { name: 'TWISTED NOTES',   desc: 'the riff returns with notes bent out of place' },
  resolution: { name: 'PHRASE FINISHER', desc: 'starts the same — then resolves the phrase home' },
};

// Degrees walk the natural scale (0=a … 6=g, wrapping); sharps[i] marks ♯
export function riffDegreesToNotes(degrees, sharps) {
  return degrees.map((d, i) => {
    const letter = RIFF_NATURALS[((d % 7) + 7) % 7];
    return (sharps[i] && RIFF_SHARPABLE.has(letter)) ? letter.toUpperCase() : letter;
  });
}

// 🤘 HEAVY ATTACKER RIFF — no scale runs. Phrases are built the way metal
// riffs are: a low ROOT PEDAL punctuated by POWER INTERVALS (b3, 4th, 5th,
// b6, b7, octave), with the occasional tritone accent (a ♯ on the 4th) as
// chromatic menace. Roots are restricted to the dark modes of the natural
// pool — a (aeolian), d (dorian), e (phrygian) — so nothing resolves major.
// The contour label still describes where the power notes travel; the pedal
// keeps hammering the root underneath.
export function generateAttackerRiff(rand = Math.random, len = RIFF_LEN_DEFAULT) {
  const contours = Object.keys(RIFF_CONTOUR_LABELS);
  const contour  = contours[Math.floor(rand() * contours.length)];
  const HEAVY_ROOTS = [0, 3, 4, 0, 4];          // a, d, e — weighted toward a & e
  const root  = HEAVY_ROOTS[Math.floor(rand() * HEAVY_ROOTS.length)];
  const POWER = [2, 3, 4, 5, 6, 7];             // b3, 4th, 5th, b6, b7, octave (scale steps)

  // Target "height" curve (0..7 above root) the power notes follow.
  const height = (t) => {
    switch (contour) {
      case 'climb':   return 2 + t * 5;
      case 'descent': return 7 - t * 5;
      case 'arch':    return 2 + Math.sin(Math.PI * t) * 5;
      case 'valley':  return 7 - Math.sin(Math.PI * t) * 5;
      default:        return 0;                  // zigzag handled below
    }
  };

  const degrees = [root];                        // always open ON the root — the anchor
  let pedalRun = 1;                              // consecutive root chugs so far
  for (let i = 1; i < len; i++) {
    const t = i / (len - 1);
    // Pedal chug ~45% of the time, but never 3 roots in a row and never
    // on the final note (the phrase should END on a power note that rings).
    const chug = i < len - 1 && pedalRun < 2 && rand() < 0.45;
    if (chug) { degrees.push(root); pedalRun++; continue; }
    pedalRun = 0;
    let target;
    if (contour === 'zigzag') {
      target = i % 2 === 1 ? (6 + Math.floor(rand() * 2)) : (2 + Math.floor(rand() * 2)); // high/low slam
    } else {
      target = height(t) + (rand() - 0.5) * 1.6;
    }
    // Snap to the nearest power interval
    let best = POWER[0], bestD = Infinity;
    for (const p of POWER) {
      const d = Math.abs(p - target);
      if (d < bestD) { bestD = d; best = p; }
    }
    degrees.push(root + best);
  }

  // Tritone accents: sharpen 1-3 of the 4ths (root+3) — ♯4 = the devil's
  // interval. Only the 4th gets a sharp, so the chromatic bite is always
  // the tritone, never a major color.
  const sharps = new Array(len).fill(false);
  let toPlace  = 1 + Math.floor(rand() * 3);
  const order  = degrees.map((_, i) => i).sort(() => rand() - 0.5);
  for (const i of order) {
    if (toPlace <= 0) break;
    if (degrees[i] !== root + 3) continue;
    const letter = RIFF_NATURALS[((degrees[i] % 7) + 7) % 7];
    if (RIFF_SHARPABLE.has(letter)) { sharps[i] = true; toPlace--; }
  }
  return { degrees, sharps, contour, rhythm: generateRiffRhythm(rand, len) };
}

// Defender riff: a musical ANSWER built from the attacker's call.
export function generateDefenderRiff(atk, rand = Math.random) {
  const kinds   = Object.keys(RIFF_ANSWER_LABELS);
  const kind    = kinds[Math.floor(rand() * kinds.length)];
  const degrees = [...atk.degrees];
  const sharps  = [...atk.sharps];
  const rhythm  = atk.rhythm.map(r => ({ ...r }));  // the answer keeps the call's groove
  if (kind === 'inversion') {
    // Mirror every interval around the root — climbs become falls
    const root = degrees[0];
    for (let i = 0; i < degrees.length; i++) degrees[i] = root - (degrees[i] - root);
  } else if (kind === 'modulation') {
    // Shift the whole phrase to a new key — same shape, new notes
    const shifts = [1, 2, -1, -2];
    const shift  = shifts[Math.floor(rand() * shifts.length)];
    for (let i = 0; i < degrees.length; i++) degrees[i] += shift;
  } else if (kind === 'variation') {
    // Bend 2 notes out of place: nudge a degree or flip its sharp
    const order = degrees.map((_, i) => i).filter(i => i > 0).sort(() => rand() - 0.5);
    order.slice(0, 2).forEach(i => {
      if (rand() < 0.5) sharps[i] = !sharps[i];
      else degrees[i] += rand() < 0.5 ? 1 : -1;
    });
  } else {
    // resolution — keep the first half, walk the back half home to the root
    const riffLen = degrees.length;
    const half = Math.ceil(riffLen / 2);
    const root = degrees[0];
    let cur = degrees[half - 1];
    for (let i = half; i < riffLen; i++) {
      const remaining = riffLen - i;
      const dist = root - cur;
      if (dist === 0)           cur += remaining > 1 ? (rand() < 0.5 ? 1 : -1) : 0;
      else if (remaining === 1) cur += dist; // land the phrase on the root
      else cur += Math.sign(dist) * Math.min(2, Math.max(1, Math.ceil(Math.abs(dist) / remaining)));
      degrees[i] = cur;
      sharps[i]  = false; // resolve clean — no accidentals on the way home
      rhythm[i]  = { window: RIFF_NOTE_WINDOW, gapBefore: RIFF_GAP_NORMAL, feel: 'steady' }; // settle the groove too
    }
  }
  return { degrees, sharps, kind, rhythm };
}
