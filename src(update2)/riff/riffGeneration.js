// Riff-off constants inlined from the main file
const RIFF_LEN          = 6;
const RIFF_NOTE_WINDOW  = 1600;
const RIFF_QUICK_WINDOW = 1280;
const RIFF_GAP_NORMAL   = 470;
const RIFF_GAP_QUICK    = 250;
const RIFF_GAP_REST     = 1000;
const RIFF_NATURALS     = ['a','b','c','d','e','f','g'];
const RIFF_SHARPABLE    = new Set(['a','c','d','f','g']);

// The riff's GROOVE: each note gets a feel — steady, rushed (short heads-up,
// tighter window), or preceded by a rest. The first note is always steady.
// All generators take an optional `rand` (0..1 fn, default Math.random) so the
// engine can thread its seeded rng through for deterministic multiplayer riffs.
export function generateRiffRhythm(rand = Math.random) {
  return Array.from({ length: RIFF_LEN }, (_, i) => {
    if (i === 0) return { window: RIFF_NOTE_WINDOW, gapBefore: 0, feel: 'steady' };
    const roll = rand();
    if (roll < 0.28) return { window: RIFF_QUICK_WINDOW, gapBefore: RIFF_GAP_QUICK, feel: 'rushed' };
    if (roll < 0.48) return { window: RIFF_NOTE_WINDOW,  gapBefore: RIFF_GAP_REST,  feel: 'rest' };
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

// Attacker riff: walk the scale along a melodic contour, then sprinkle
// 1-2 sharps on sharpable notes for spice.
export function generateAttackerRiff(rand = Math.random) {
  const contours = Object.keys(RIFF_CONTOUR_LABELS);
  const contour  = contours[Math.floor(rand() * contours.length)];
  const degrees  = [Math.floor(rand() * 7)];
  for (let i = 1; i < RIFF_LEN; i++) {
    const step = 1 + Math.floor(rand() * 2); // move 1-2 scale steps
    let dir = 1;
    if (contour === 'descent')      dir = -1;
    else if (contour === 'arch')    dir = i < RIFF_LEN / 2 ?  1 : -1;
    else if (contour === 'valley')  dir = i < RIFF_LEN / 2 ? -1 :  1;
    else if (contour === 'zigzag')  dir = i % 2 === 1 ? 1 : -1;
    degrees.push(degrees[i - 1] + dir * step);
  }
  const sharps  = new Array(RIFF_LEN).fill(false);
  let toPlace   = 1 + Math.floor(rand() * 2);
  const order   = degrees.map((_, i) => i).sort(() => rand() - 0.5);
  for (const i of order) {
    if (toPlace <= 0) break;
    const letter = RIFF_NATURALS[((degrees[i] % 7) + 7) % 7];
    if (RIFF_SHARPABLE.has(letter)) { sharps[i] = true; toPlace--; }
  }
  return { degrees, sharps, contour, rhythm: generateRiffRhythm(rand) };
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
    const half = Math.ceil(RIFF_LEN / 2);
    const root = degrees[0];
    let cur = degrees[half - 1];
    for (let i = half; i < RIFF_LEN; i++) {
      const remaining = RIFF_LEN - i;
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
