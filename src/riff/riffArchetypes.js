// =============================================================================
// riff/riffArchetypes.js — 🤘 ARCHETYPE RIFF GENERATOR
// -----------------------------------------------------------------------------
// Riffs are not random walks. They are a short CELL, stated and restated with
// variation, built from a small vocabulary of devices that rock and metal have
// used for fifty years. This module generates from that vocabulary instead of
// from a biased coin.
//
// WHY THIS EXISTS
//   The prototype's first generator stepped a scale degree up or down by a
//   weighted roll. It produced note sequences that were individually plausible
//   and collectively meaningless — no repetition, no motif, no pedal, and a
//   flat ~21% of notes landing as "same pitch" scattered at random. On an arrow
//   highway a scattered "→" is a reading tax with no musical payoff. In a real
//   riff, repeated notes are almost never scattered: they are a CHUG (a run of
//   them) or a PEDAL (a root you keep returning to between melodic notes).
//
// THE ARROW CONSEQUENCE (why this matters for the input model)
//   Each archetype has a characteristic ARROW SIGNATURE:
//     pedal      → ↑↓↑↓↑↓   the root keeps pulling you back down
//     chug       → →→→ then a move — repetition in RUNS, not scattered
//     gallop     → →→ pairs riding a long-short-short rhythm
//     run        → ↑↑↑↑ or ↓↓↓↓
//     arch_run   → ↑↑↑↑↓↓↓↓  (this is Shred's "contour turn" signature)
//     alt_cell   → ↑↓↑↓ from A-B-A-B
//     chromatic  → ↑↑↑ / ↓↓↓ by semitone — same arrows, hostile sound
//     blues_box  → mixed, bend-heavy
//     power_plane→ wide leaps, sparse
//
//   So "% of → notes" is NOT a number to minimise globally. It is a per-STYLE
//   signature. A Groove riff SHOULD be full of →; that is the pocket. A Shred
//   riff should have almost none. See STYLE_SYSTEM_HANDOFF.md §3 — the Db
//   earning rules already define exactly these patterns, and this generator
//   fields material that lets each Style's detector actually fire.
//
// PURE MODULE — no React, no audio, no app state. Test with:
//     node src/riff/riffArchetypes.test.mjs
// =============================================================================

/* ─────────────────────────────────────────────────────────────────────────────
   SCALES — semitone offsets from the root.
   Metal lives in the dark modes; classic rock lives in the pentatonic box.
   ────────────────────────────────────────────────────────────────────────── */

export const SCALES = {
  aeolian:        [0, 2, 3, 5, 7, 8, 10],   // natural minor — the default dark
  phrygian:       [0, 1, 3, 5, 7, 8, 10],   // b2 — hostile on contact
  phrygian_dom:   [0, 1, 4, 5, 7, 8, 10],   // b2 + major 3rd — exotic menace
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],   // leading tone — NWOBHM drama
  dorian:         [0, 2, 3, 5, 7, 9, 10],   // natural 6 — brighter groove
  minor_pent:     [0, 3, 5, 7, 10],         // the box — classic rock bread & butter
  blues:          [0, 3, 5, 6, 7, 10],      // box + b5 — the blue note
};

/** Power intervals — what a riff leaps to when it is not walking. */
const POWER = [3, 5, 7, 10, 12];            // b3, 4th, 5th, b7, octave

/* ─────────────────────────────────────────────────────────────────────────────
   GENRES — each is a weighted bag of archetypes plus a scale palette and a
   tempo/density character. Weights are integers; higher = more likely.
   ────────────────────────────────────────────────────────────────────────── */

export const GENRES = {
  classic_rock: {
    label: 'CLASSIC ROCK',
    archetypes: { blues_box: 4, power_plane: 3, pedal: 2, alt_cell: 2, run: 1 },
    scales:     { minor_pent: 4, blues: 3, dorian: 2, aeolian: 1 },
    density: 0.9, bendPct: 26, sustainPct: 26, restPct: 0.16,
  },
  hard_rock: {
    label: 'HARD ROCK',
    archetypes: { pedal: 4, power_plane: 3, blues_box: 3, alt_cell: 2, chug: 1 },
    scales:     { aeolian: 3, minor_pent: 3, blues: 2, dorian: 1 },
    density: 1.0, bendPct: 18, sustainPct: 22, restPct: 0.13,
  },
  metal: {
    label: 'METAL',
    archetypes: { gallop: 4, pedal: 4, run: 3, arch_run: 2, power_plane: 2 },
    scales:     { aeolian: 4, harmonic_minor: 2, phrygian: 2, dorian: 1 },
    density: 1.15, bendPct: 10, sustainPct: 18, restPct: 0.10,
  },
  thrash: {
    label: 'THRASH',
    archetypes: { chug: 5, chromatic: 4, run: 3, gallop: 3, pedal: 2 },
    scales:     { phrygian: 4, aeolian: 3, phrygian_dom: 2, harmonic_minor: 1 },
    density: 1.35, bendPct: 5, sustainPct: 11, restPct: 0.07,
  },
  doom: {
    label: 'DOOM',
    archetypes: { pedal: 5, power_plane: 4, blues_box: 2, chug: 1 },
    scales:     { aeolian: 3, phrygian: 3, minor_pent: 2, blues: 1 },
    density: 0.6, bendPct: 22, sustainPct: 46, restPct: 0.24,
  },
  punk: {
    label: 'PUNK',
    archetypes: { power_plane: 5, chug: 4, alt_cell: 2 },
    scales:     { minor_pent: 4, aeolian: 3, dorian: 1 },
    density: 1.25, bendPct: 3, sustainPct: 9, restPct: 0.05,
  },
  prog: {
    label: 'PROG',
    archetypes: { arch_run: 4, run: 3, alt_cell: 3, chromatic: 2, pedal: 2 },
    scales:     { dorian: 3, harmonic_minor: 3, aeolian: 2, phrygian_dom: 2 },
    density: 1.1, bendPct: 14, sustainPct: 20, restPct: 0.15,
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   STYLE BIAS — STYLE_SYSTEM_HANDOFF.md §3 defines how each Style earns Db.
   The generator tilts its archetype bag so a Spirit's riffs actually contain
   the pattern its Style is scored on. This is the honest version of "your
   melody is your combat": a Groove spirit fields groove-shaped material.
   ────────────────────────────────────────────────────────────────────────── */

// NOTE: every off-signature archetype must be named explicitly. An archetype
// absent from a bias entry keeps its full genre weight — that leak let alt_cell
// (a pure ↑↓↑↓ alternator, longest directional run = 1) dominate Shred bags and
// drag Shred's runs below the §3.1 scoring threshold.
export const STYLE_BIAS = {
  // §3.1 — runs of 3+ notes, one direction, consistent interval class.
  Shred:  { run: 5, arch_run: 5, chromatic: 2, power_plane: 1.2,
            chug: 0.1, pedal: 0.25, alt_cell: 0.1, gallop: 0.2, blues_box: 0.5 },
  // §3.2 — repeated notes, alternating pairs, repeated cells.
  Groove: { chug: 5, pedal: 3, alt_cell: 4, gallop: 3, blues_box: 0.8,
            run: 0.15, arch_run: 0.1, chromatic: 0.2, power_plane: 0.5 },
  // §3.3 — out-of-scale notes that RESOLVE, half-step approaches.
  Flair:  { chromatic: 5, blues_box: 4, pedal: 1.2, arch_run: 0.8, run: 0.6,
            chug: 0.25, power_plane: 0.5, alt_cell: 0.4, gallop: 0.3 },
};

/* ─────────────────────────────────────────────────────────────────────────────
   FORMS — how cells are laid out across the riff. This is the thing the
   random walk had none of. A is the motif; A' is the motif with its tail
   altered; B is a contrasting answer.
   ────────────────────────────────────────────────────────────────────────── */

const FORMS = [
  ['A','A','A','B'],        // the classic — say it three times, then answer
  ['A','A','B'],
  ['A','A','B','A'],
  ['A','B','A','B'],
  ['A','A',"A'",'B'],
  ['A',"A'",'A',"A'"],
  ['A','A'],                // short riffs: just state it twice
];

/* ─────────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */

function weightedPick(bag, rand) {
  const entries = Object.entries(bag).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}

/** Nearest scale tone to an arbitrary semitone offset (keeps riffs in key). */
function snapToScale(semi, scale) {
  const oct = Math.floor(semi / 12);
  const within = semi - oct * 12;
  let best = scale[0], bestD = Infinity;
  for (const s of scale) { const d = Math.abs(s - within); if (d < bestD) { bestD = d; best = s; } }
  // also consider the octave above, so a semi near 12 snaps up rather than down
  if (Math.abs(12 - within) < bestD) return oct * 12 + 12;
  return oct * 12 + best;
}

function inScale(semi, scale) {
  const within = ((semi % 12) + 12) % 12;
  return scale.includes(within);
}

/* ─────────────────────────────────────────────────────────────────────────────
   ARCHETYPE CELL BUILDERS
   Each returns an array of { semi, accent } — semitones above the riff root.
   `accent` marks a note the rhythm layer should treat as the strong beat.
   These are deliberately SHORT: a cell is 2–5 notes. Length comes from form.
   ────────────────────────────────────────────────────────────────────────── */

const CELLS = {

  /* Low root alternating with melodic notes above it. Sabbath / "Enter
     Sandman" / half of Maiden. The root keeps yanking the line back down, so
     the arrow read is a clean ↑↓↑↓ — the most legible pattern on the highway. */
  pedal(ctx) {
    const { rand, scale } = ctx;
    const n = 4 + (rand() < 0.4 ? 2 : 0);
    const out = [];
    for (let i = 0; i < n; i++) {
      if (i % 2 === 0) out.push({ semi: 0, accent: true });          // the pedal
      else {
        const up = POWER[Math.floor(rand() * POWER.length)];
        out.push({ semi: snapToScale(up, scale), accent: false });
      }
    }
    return out;
  },

  /* Palm-muted repetition on the root, then a move. Pantera / modern metal.
     THE REASON → EXISTS. A chug is a run of identical notes — on the highway
     that is →→→, a burst you feel as a groove event rather than read as three
     separate notes. Scattered "same" is noise; clustered "same" is a riff. */
  chug(ctx) {
    const { rand, scale } = ctx;
    const reps = 2 + Math.floor(rand() * 3);                          // 2–4 chugs
    const out = [];
    for (let i = 0; i < reps; i++) out.push({ semi: 0, accent: i === 0 });
    const move = POWER[Math.floor(rand() * 3)];                       // b3/4th/5th
    out.push({ semi: snapToScale(rand() < 0.35 ? -move : move, scale), accent: true });
    return out;
  },

  /* Eighth + two sixteenths on the root, then a melodic step. Maiden, "Run to
     the Hills". The pitch content is thin on purpose — the RHYTHM is the hook,
     which the rhythm layer below renders as long-short-short. */
  gallop(ctx) {
    const { rand, scale } = ctx;
    const out = [
      { semi: 0, accent: true,  gallop: 'long'  },
      { semi: 0, accent: false, gallop: 'short' },
      { semi: 0, accent: false, gallop: 'short' },
    ];
    const step = rand() < 0.5 ? 2 : 3;
    out.push({ semi: snapToScale(step, scale), accent: true });
    if (rand() < 0.45) out.push({ semi: snapToScale(step + 2, scale), accent: false });
    return out;
  },

  /* Scalar run in one direction. Thrash lead, Shred's bread and butter.
     Interval class is held CONSTANT across the run — that is exactly what
     STYLE_SYSTEM_HANDOFF §3.1 requires to score. */
  run(ctx) {
    const { rand, scale } = ctx;
    const n = 3 + Math.floor(rand() * 3);                             // 3–5 notes
    const dir = rand() < 0.5 ? 1 : -1;
    const klass = rand() < 0.6 ? 1 : (rand() < 0.7 ? 2 : 3);          // step / 3rd / 4th
    const startIdx = dir > 0 ? 0 : Math.min(scale.length - 1, n * klass);
    const out = [];
    for (let i = 0; i < n; i++) {
      const idx = startIdx + dir * i * klass;
      const oct = Math.floor(idx / scale.length);
      const s = scale[((idx % scale.length) + scale.length) % scale.length] + 12 * oct;
      out.push({ semi: s, accent: i === 0 });
    }
    return out;
  },

  /* Up the neck and back down — Shred's SIGNATURE bonus (§3.1: two qualifying
     runs in opposite directions sharing a pivot). Arrow read: ↑↑↑↓↓↓. */
  arch_run(ctx) {
    const { rand, scale } = ctx;
    // n notes up then n−1 back down ⇒ two directional runs of n notes each.
    // §3.1 pays at 3–4 notes and again at 5–6, so n must reach 4–5 for the
    // signature "contour turn" to be worth fielding at all.
    const n = 4 + Math.floor(rand() * 2);
    const klass = rand() < 0.7 ? 1 : 2;
    const down = rand() < 0.5;
    const up = [];
    for (let i = 0; i < n; i++) {
      const idx = i * klass;
      const oct = Math.floor(idx / scale.length);
      up.push({ semi: scale[idx % scale.length] + 12 * oct, accent: i === 0 });
    }
    const back = [];
    for (let i = n - 2; i >= 0; i--) back.push({ semi: up[i].semi, accent: false });
    const seq = down ? [...up.slice().reverse(), ...back.slice().reverse()] : [...up, ...back];
    return seq;
  },

  /* Semitone creep — b2 Phrygian menace, tritone slides. Thrash/death.
     Deliberately emits OUT-OF-SCALE notes that RESOLVE into scale tones,
     which is precisely what Flair scores on (§3.3) including the half-step
     approach signature. */
  chromatic(ctx) {
    const { rand, scale } = ctx;
    const dir = rand() < 0.5 ? 1 : -1;
    const anchor = scale[Math.floor(rand() * Math.min(4, scale.length))];
    const out = [];
    const n = 3 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) out.push({ semi: anchor + dir * i, accent: i === 0 });
    // resolve: land on a scale tone so the discord pays off rather than dangles
    const last = out[out.length - 1].semi;
    if (!inScale(last, scale)) out.push({ semi: snapToScale(last + dir, scale), accent: true, resolves: true });
    return out;
  },

  /* The pentatonic box with bends. Zeppelin / AC/DC / Angus. Mixed contour,
     bend-heavy, syncopated — the classic-rock feel. */
  blues_box(ctx) {
    const { rand } = ctx;
    const box = [0, 3, 5, 7, 10, 12];
    const n = 3 + Math.floor(rand() * 3);
    const out = [];
    let idx = Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      out.push({ semi: box[Math.max(0, Math.min(box.length - 1, idx))], accent: i === 0,
                 bendable: i > 0 && rand() < 0.45 });
      idx += rand() < 0.55 ? 1 : -1;
      if (rand() < 0.2) idx += rand() < 0.5 ? 1 : -1;
    }
    if (rand() < 0.35) out.push({ semi: 6, accent: false, blue: true });   // the b5
    return out;
  },

  /* Power-chord roots planing in 4ths and 5ths. Punk and hard rock — sparse,
     wide, all root motion. Arrow read: big leaps, few notes. */
  power_plane(ctx) {
    const { rand, scale } = ctx;
    const n = 3 + Math.floor(rand() * 2);
    const out = [{ semi: 0, accent: true }];
    let cur = 0;
    for (let i = 1; i < n; i++) {
      const jump = [5, 7, -5, -7, 3, 10][Math.floor(rand() * 6)];
      cur = Math.max(-5, Math.min(14, cur + jump));
      out.push({ semi: snapToScale(cur, scale), accent: true });
    }
    return out;
  },

  /* A-B-A-B. Groove's "alternating pair" detector (§3.2) fires on exactly
     this. Arrow read: ↑↓↑↓. */
  alt_cell(ctx) {
    const { rand, scale } = ctx;
    const a = 0;
    const b = snapToScale(POWER[Math.floor(rand() * POWER.length)], scale);
    const reps = 2 + Math.floor(rand() * 2);
    const out = [];
    for (let i = 0; i < reps; i++) {
      out.push({ semi: a, accent: true });
      out.push({ semi: b, accent: false });
    }
    return out;
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   RHYTHM — archetype-aware. Emits the existing {gapBefore, feel} vocabulary
   from riffGeneration.js so buildRiffTimeline consumes it unchanged.
   ────────────────────────────────────────────────────────────────────────── */

const GAP = { steady: 300, rushed: 160, rest: 650 };

function rhythmFor(notes, ctx) {
  const { rand, genre } = ctx;
  const g = GENRES[genre];
  return notes.map((n, i) => {
    if (i === 0) return { gapBefore: 0, feel: 'steady' };

    // A gallop's two short notes are the whole point — honour them literally.
    if (n.gallop === 'short') return { gapBefore: Math.round(GAP.rushed * 0.72), feel: 'rushed' };
    if (n.gallop === 'long')  return { gapBefore: GAP.steady, feel: 'steady' };

    // Chug runs are machine-even: identical gaps, no breathing.
    if (n.chugPart) return { gapBefore: Math.round(GAP.steady * 0.62 / g.density), feel: 'rushed' };

    // Rests fall before an accent — that is where a riff breathes.
    if (n.accent && rand() < g.restPct) return { gapBefore: GAP.rest, feel: 'rest' };

    const r = rand();
    const feel = r < 0.34 ? 'rushed' : 'steady';
    return { gapBefore: Math.round(GAP[feel] / g.density), feel };
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   THE GENERATOR
   ────────────────────────────────────────────────────────────────────────── */

/**
 * @param {object} opts
 * @param {string} opts.genre      key of GENRES (default 'metal')
 * @param {string=} opts.style     'Shred' | 'Groove' | 'Flair' — tilts archetypes
 * @param {number} opts.len        target note count
 * @param {function} opts.rand     () => [0,1)
 * @param {string=} opts.archetype force a specific archetype (for testing/preview)
 * @param {string=} opts.scale     force a specific scale
 * @returns {{ notes, archetype, scale, scaleName, root, form, genre, style }}
 *   notes: [{ semi, feel, gapBefore, sustain, bend, accent, outOfScale }]
 *   `semi` is semitones above the riff root; the caller voices it onto the neck.
 */
export function generateArchetypeRiff({
  genre = 'metal', style = null, len = 11, rand = Math.random,
  archetype = null, scale: forceScale = null,
} = {}) {
  const g = GENRES[genre] ?? GENRES.metal;

  // ── choose archetype: genre bag, tilted by Style ──────────────────────
  let bag = { ...g.archetypes };
  if (style && STYLE_BIAS[style]) {
    const bias = STYLE_BIAS[style];
    bag = Object.fromEntries(
      Object.keys({ ...bag, ...bias }).map(k => [k, (bag[k] ?? 0.6) * (bias[k] ?? 1)])
    );
  }
  const arch = archetype ?? weightedPick(bag, rand);

  // ── scale + root ──────────────────────────────────────────────────────
  const scaleName = forceScale ?? weightedPick(g.scales, rand);
  const scale = SCALES[scaleName];
  const root = 0;

  const ctx = { rand, scale, scaleName, genre, style };

  // ── build cells and lay them out over a form ──────────────────────────
  const A  = CELLS[arch](ctx);
  const B  = CELLS[arch](ctx);                       // contrasting restatement
  const Ap = A.map((n, i) => (i >= A.length - 2      // A' — same head, new tail
    ? { ...n, semi: snapToScale(n.semi + (rand() < 0.5 ? 2 : -2), scale) }
    : { ...n }));

  const form = FORMS[Math.floor(rand() * FORMS.length)];
  const bank = { A, B, "A'": Ap };

  let notes = [];
  for (const sym of form) {
    if (notes.length >= len) break;
    notes.push(...bank[sym].map(n => ({ ...n })));
  }
  // pad by restating the motif rather than by inventing filler
  let guard = 0;
  while (notes.length < len && guard++ < 24) notes.push(...A.map(n => ({ ...n })));
  notes = notes.slice(0, Math.max(2, len));

  // ── mark chug runs so the rhythm layer can machine them ───────────────
  for (let i = 1; i < notes.length; i++) {
    if (notes[i].semi === notes[i - 1].semi) notes[i].chugPart = true;
  }

  // ── resolution: Groove's signature bonus is landing on the root (§3.2) ─
  if (style === 'Groove' || rand() < 0.4) notes[notes.length - 1].semi = root;

  // ── rhythm ────────────────────────────────────────────────────────────
  const rhythm = rhythmFor(notes, ctx);

  // ── sustains + bends, weighted by genre character ─────────────────────
  notes.forEach((n, i) => {
    const last = i === notes.length - 1;
    n.sustain = 0; n.bend = false;
    const susChance = (g.sustainPct / 100) * (n.accent ? 1.4 : 0.7);
    if (last || (!n.chugPart && rand() < susChance)) {
      n.sustain = Math.round((last ? 520 : 300) + rand() * (g.density < 0.8 ? 900 : 520));
    }
    if (n.sustain && (n.bendable || rand() < g.bendPct / 100)) n.bend = true;
    n.feel = rhythm[i].feel;
    n.gapBefore = rhythm[i].gapBefore;
    n.outOfScale = !inScale(n.semi, scale);
  });

  return { notes, archetype: arch, scale, scaleName, root, form: form.join(''), genre, style };
}

/* ─────────────────────────────────────────────────────────────────────────────
   ARROW DERIVATION + ANALYSIS
   The highway reads only these. Kept here so the generator and the analysis
   agree by construction.
   ────────────────────────────────────────────────────────────────────────── */

/** notes → ['same','up','down',…]. First note is the anchor: 'same'. */
export function arrowsFor(notes) {
  return notes.map((n, i) => {
    if (i === 0) return 'same';
    return n.semi > notes[i - 1].semi ? 'up'
         : n.semi < notes[i - 1].semi ? 'down' : 'same';
  });
}

/**
 * Describe the arrow stream the way a player experiences it.
 * `sameRuns` is the number that actually matters: clustered "same" is a chug
 * you feel, scattered "same" is a reading tax. `sameScattered` counts the
 * lone ones — that is the metric to keep low, not the raw same %.
 */
export function analyseArrows(notes) {
  const a = arrowsFor(notes);
  const counts = { up: 0, down: 0, same: 0 };
  a.forEach(d => counts[d]++);

  const runs = [];
  let cur = { dir: a[0], len: 1 };
  for (let i = 1; i < a.length; i++) {
    if (a[i] === cur.dir) cur.len++;
    else { runs.push(cur); cur = { dir: a[i], len: 1 }; }
  }
  runs.push(cur);

  const sameRuns = runs.filter(r => r.dir === 'same');
  const dirRuns  = runs.filter(r => r.dir !== 'same');

  return {
    counts,
    total: a.length,
    samePct: +(counts.same / a.length * 100).toFixed(1),
    // lone "same" notes, excluding the anchor at index 0
    sameScattered: sameRuns.filter(r => r.len === 1).length - (a[0] === 'same' && (a[1] !== 'same') ? 1 : 0),
    sameClustered: sameRuns.filter(r => r.len >= 2).reduce((s, r) => s + r.len, 0),
    longestSameRun: Math.max(0, ...sameRuns.map(r => r.len)),
    // ARROWS, not notes. A run of k arrows spans k+1 notes — mind the fencepost:
    // STYLE_SYSTEM_HANDOFF §3.1 counts NOTES ("3+ consecutive notes"), so its
    // 3-note threshold is an arrow-run of 2. Use longestDirNoteRun to compare
    // against the Db table directly.
    longestDirRun:  Math.max(0, ...dirRuns.map(r => r.len)),
    longestDirNoteRun: dirRuns.length ? Math.max(...dirRuns.map(r => r.len)) + 1 : 0,
    alternations:   runs.filter(r => r.len === 1 && r.dir !== 'same').length,
    runs,
  };
}

/** Longest single-direction arrow run — what STYLE §3.1 (Shred) scores on. */
export function longestDirectionalRun(notes) {
  return analyseArrows(notes).longestDirRun;
}
