// =============================================================================
// music/styles.js — 🎸 LEGEND STYLES — the brain behind Legend Lessons
// -----------------------------------------------------------------------------
// PURE MODULE — no React, no audio, no state. Deterministic, unit-testable.
//
// Each LEGEND is pure data: a tone preset, a bed chord, a palette function,
// signature licks, move detectors, phrasing stats, and coach lines. The UI
// (LegendLessons.jsx) consumes this; nothing here touches the DOM or WebAudio.
//
// Detection primitives all operate on the same { pc, time } history array that
// the Discord Coach already keeps — same shape, same pipeline, richer output.
//
// IP NOTE: Legend names are original in-world characters. The "inspired by"
// comments are internal design references and NEVER appear in-game.
// =============================================================================

// ── Pitch-class helpers ─────────────────────────────────────────────────────
const MINOR_PENT   = [0, 3, 5, 7, 10];       // relative semitones from root
const MAJOR_PENT   = [0, 2, 4, 7, 9];
const DORIAN       = [0, 2, 3, 5, 7, 9, 10]; // natural minor + nat6
const NAT_MINOR    = [0, 2, 3, 5, 7, 8, 10];

function pcSet(root, intervals) {
  return new Set(intervals.map(iv => (root + iv) % 12));
}

// ── LEGENDS — v1 roster (first three ship; 4–6 data-proven) ─────────────────
// Bed shape: { rootPc, chordId, mode, spacingMs }
// tone: amp knobs { drive, tone, echo, verb, voice }
// palette(rootPc) → Set<pc>  — the "in" notes for this style
// starSpice: the one exotic note that defines the legend (pc offset from root)
// licks: authored pc sequences (relative to root) — the ONLY hand-authored
//        musical content. 4–6 notes each, free-time replay.
// moves: array of { id, label, detect(history, rootPc, palette) → count }
// phraseStat: { id, label, compute(history) → 0..1 }
// coachLines: { onMove: { [moveId]: string[] }, onMeter: string[] }

export const LEGENDS = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. VOODOO COMET  (inspired by Hendrix — fuzz, minor pent + ♯9)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'voodoo_comet',
    name: 'Voodoo Comet',
    emoji: '🌀',
    tease: 'Fuzz, fire, and the ♯9 that started it all.',
    description: 'The Comet plays minor pentatonic over a dominant 7th chord — but the magic is the ♯9, a minor 3rd clashing against the major 3rd in the chord. That clash is the sound of raw blues-rock intensity. The fuzz tone and rhythmic double-stops turn melody into percussion.',
    lessons: [
      'The minor pentatonic is the bedrock of blues-rock lead guitar',
      'The ♯9 (minor 3rd over a dominant chord) creates exciting tension without sounding "wrong"',
      'Double-stops — hitting two notes at once — add rhythmic punch to your lines',
      'Approaching a target note chromatically (one fret below) makes the arrival feel earned',
    ],
    rigHint: 'The Comet\'s tone is thick fuzz with moderate brightness. Listen for the "hair" on the attack — that\'s the FUZZ voice, high gain, rolled-back tone knob.',
    echoHints: [
      'This lick climbs through the pentatonic and hangs on the ♯9 — that\'s the note that makes it sound bluesy over the dom7 chord.',
      'Descending from the 5th through the blue note (♭5) — the ♭5 is a passing tone that adds grit between the 4th and 5th.',
      'A wide sweep from root up to ♭7, then down through the pentatonic. Notice how the ♭7 gives it a "call" quality.',
    ],
    tone: { drive: 0.70, tone: 0.45, echo: 0.35, verb: 0.30, voice: 'fuzz' },
    bed: { rootPc: 4, chordId: 'dom7', mode: 'minor', spacingMs: 2200 },
    palette: (root) => {
      const s = pcSet(root, MINOR_PENT);
      s.add((root + 6) % 12);  // blues ♭5
      s.add((root + 3) % 12);  // ♯9 (= minor 3rd, the clash that IS Hendrix)
      return s;
    },
    starSpice: 3, // ♯9 = minor 3rd offset
    licks: [
      [0, 3, 5, 7, 5, 3],        // root → ♯9 → 4th → 5th → 4th → ♯9
      [7, 6, 5, 3, 0],            // 5th → ♭5 → 4th → ♯9 → root
      [0, 10, 7, 5, 3, 0],        // root → ♭7 → 5th → 4th → ♯9 → root
    ],
    moves: [
      {
        id: 'double_stop',
        label: 'DOUBLE-STOP',
        hint: 'Tap two notes almost simultaneously (within 150ms). Double-stops thicken your sound and add rhythmic weight — they turn a melody line into a punchy statement.',
        detect: (hist) => {
          let count = 0;
          for (let i = 1; i < hist.length; i++) {
            if (hist[i].time - hist[i - 1].time < 150) count++;
          }
          return count;
        },
      },
      {
        id: 'slide_in',
        label: 'SLIDE-IN',
        hint: 'Approach the ♯9 from one or two frets below. This chromatic approach builds anticipation — the ear expects resolution, and the ♯9 delivers it with a blues snarl.',
        detect: (hist, rootPc) => {
          let count = 0;
          const target = (rootPc + 3) % 12;
          for (let i = 1; i < hist.length; i++) {
            const prev = hist[i - 1].pc;
            const cur = hist[i].pc;
            if (cur === target && ((prev + 1) % 12 === cur || (prev + 2) % 12 === cur)) {
              count++;
            }
          }
          return count;
        },
      },
    ],
    phraseStat: {
      id: 'aggression',
      label: 'AGGRESSION',
      hint: 'The Comet plays with intensity — keep your note density up. More notes per second = more fire.',
      compute: (hist) => {
        if (hist.length < 2) return 0;
        const span = (hist[hist.length - 1].time - hist[0].time) / 1000;
        if (span <= 0) return 0;
        return Math.min(1, (hist.length / span) / 3);
      },
    },
    coachLines: {
      onMove: {
        double_stop: [
          'DOUBLE-STOP! Two notes at once creates a fatter sound — like a chord inside a melody.',
          'That rhythmic punch is what separates a lead line from a statement.',
          'Two strings, one punch. Double-stops add harmonic weight your single notes can\'t.',
        ],
        slide_in: [
          'Chromatic slide into the ♯9! That half-step approach makes the target note land harder.',
          'The approach note creates tension — and the ♯9 resolves it with that bluesy bite.',
          'That\'s how you make a note ARRIVE instead of just appearing. Approach from below.',
        ],
      },
      onMeter: [
        'The pentatonic shapes are locking in — try adding the ♯9 (pulsing note) to spice things up.',
        'Good palette fit. Now look for double-stop opportunities — tap two adjacent notes fast.',
        'You\'re in the zone. The ♯9 over this dom7 chord is what gives this style its edge.',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. DORIAN SERPENT  (inspired by Santana — mellow sustain, Dorian, nat6)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'dorian_serpent',
    name: 'Dorian Serpent',
    emoji: '🐍',
    tease: 'Sustain for days. The natural 6th glows.',
    description: 'The Serpent plays Dorian mode over a minor 7th chord — that\'s natural minor with one note raised: the 6th. Where natural minor sounds dark and resigned, Dorian\'s raised 6th adds a warm, hopeful glow. The mellow tone and slow phrasing let each note ring with meaning.',
    lessons: [
      'Dorian mode is natural minor with a raised 6th — one note changes everything',
      'The natural 6th over a minor chord creates warmth without losing the minor feel',
      'Slower phrasing with fewer notes makes each note carry more emotional weight',
      'Resolving the 6th by step (down to the 5th or up to the ♭7) completes the phrase',
    ],
    rigHint: 'The Serpent\'s tone is warm and round — MELLOW voice (triangle wave), moderate drive, plenty of reverb. Listen for the smooth, singing sustain with no harsh edges.',
    echoHints: [
      'This lick walks up through Dorian and lands on the natural 6th — that\'s the bright note in the minor context. It resolves back to the 5th, completing the phrase.',
      'Descending from the natural 6th all the way home. Each step down through the Dorian scale feels inevitable — that\'s the power of stepwise motion.',
      'Rising through the scale to find the 6th, then gracefully stepping back down. The arc — up, peak, return — is the shape of a complete musical thought.',
    ],
    tone: { drive: 0.55, tone: 0.40, echo: 0.30, verb: 0.45, voice: 'triangle' },
    bed: { rootPc: 9, chordId: 'min7', mode: 'minor', spacingMs: 2800 },
    palette: (root) => pcSet(root, DORIAN),
    starSpice: 9, // natural 6th (F♯ over A)
    licks: [
      [0, 2, 3, 7, 9, 7],        // root → 2 → ♭3 → 5 → nat6 → 5
      [9, 7, 5, 3, 2, 0],         // nat6 descending through Dorian
      [0, 3, 5, 9, 7, 5, 3],      // root up through Dorian landing on nat6
    ],
    moves: [
      {
        id: 'sustain_singer',
        label: 'SUSTAIN SINGER',
        hint: 'Play slowly — 20 notes per minute or fewer. The Serpent\'s power is in patience. Let each note sing before moving on. Silence between notes is part of the melody.',
        detect: (hist) => {
          if (hist.length < 4) return 0;
          const span = (hist[hist.length - 1].time - hist[0].time) / 1000;
          if (span <= 0) return 0;
          const nps = hist.length / span;
          const nPerMin = nps * 60;
          return nPerMin <= 20 ? 1 : 0;
        },
      },
      {
        id: 'the_glow',
        label: 'THE GLOW',
        hint: 'Play the natural 6th (pulsing note), then step to the 5th or ♭7. The 6th is Dorian\'s signature — resolving it by step makes it shine instead of hanging unfinished.',
        detect: (hist, rootPc) => {
          let count = 0;
          const nat6 = (rootPc + 9) % 12;
          const fifth = (rootPc + 7) % 12;
          const flat7 = (rootPc + 10) % 12;
          for (let i = 1; i < hist.length; i++) {
            if (hist[i - 1].pc === nat6 && (hist[i].pc === fifth || hist[i].pc === flat7)) {
              count++;
            }
          }
          return count;
        },
      },
    ],
    phraseStat: {
      id: 'serenity',
      label: 'SERENITY',
      hint: 'The Serpent rewards restraint. Play fewer notes, leave space, let each one breathe. Speed works against this style.',
      compute: (hist) => {
        if (hist.length < 2) return 1;
        const span = (hist[hist.length - 1].time - hist[0].time) / 1000;
        if (span <= 0) return 1;
        const nps = hist.length / span;
        return Math.min(1, Math.max(0, 1 - (nps - 0.3) / 1.5));
      },
    },
    coachLines: {
      onMove: {
        sustain_singer: [
          'That patience pays off — fewer notes gives each one room to resonate.',
          'You\'re letting the notes breathe. That\'s how melody becomes emotional.',
          'Sustain over speed. Every note you DON\'T play makes the ones you do play matter more.',
        ],
        the_glow: [
          'Natural 6th resolved by step — that\'s Dorian\'s signature sound. The raised 6th adds warmth the natural minor can\'t.',
          'THE GLOW. The 6th wants to move to the 5th or ♭7 — and you followed through.',
          'That resolution is why Dorian feels hopeful even though it\'s a minor mode.',
        ],
      },
      onMeter: [
        'Good Dorian coverage. Look for the pulsing note — that\'s the natural 6th, the Serpent\'s secret weapon.',
        'Try slowing down — the Serpent rewards patience. Let gaps between notes become part of the music.',
        'Play the 6th, then step down to the 5th. That two-note phrase IS the Serpent\'s voice.',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. IRON RIFFLORD  (inspired by Iommi — heavy fuzz, tritone home)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'iron_rifflord',
    name: 'Iron Rifflord',
    emoji: '🌑',
    tease: 'The tritone is home. Repeat until doom.',
    description: 'The Rifflord uses the tritone — the most dissonant interval in music — not as a mistake but as the foundation. Over a low power-chord drone, the minor pentatonic provides the skeleton, and the tritone (6 semitones from root) adds menace. Riffs repeat obsessively because repetition IS the hook.',
    lessons: [
      'The tritone (6 semitones, "the devil\'s interval") creates maximum tension against the root',
      'Resolving the tritone up one step to the 5th releases that tension — the DOOM STEP',
      'Repeating a short phrase (3–4 notes) creates a hypnotic riff — repetition is a compositional tool, not laziness',
      'Heavy tone with low brightness lets the low notes rumble without fizzy highs getting in the way',
    ],
    rigHint: 'The Rifflord runs maximum fuzz with the tone knob rolled way down — dark and thick. Minimal echo and reverb. Listen for the wall-of-gain rumble without any brightness or shimmer.',
    echoHints: [
      'Root up to the tritone (the pulsing note) and back. The tritone is only one fret from the 5th — that closeness is what gives it tension. It WANTS to resolve.',
      'Root → tritone → 5th → back to tritone. That tritone-to-5th move is the DOOM STEP — the signature resolution that defines this style.',
      'Doubled root for weight, then ascending into doom. Repeating the root note before the climb gives the phrase a heavy, deliberate feel.',
    ],
    tone: { drive: 0.85, tone: 0.25, echo: 0.15, verb: 0.10, voice: 'fuzz' },
    bed: { rootPc: 4, chordId: 'power', mode: 'minor', spacingMs: 3200 },
    palette: (root) => {
      const s = pcSet(root, MINOR_PENT);
      s.add((root + 6) % 12); // tritone — the doom note
      return s;
    },
    starSpice: 6, // tritone
    licks: [
      [0, 3, 5, 6, 5, 3],        // root → ♭3 → 4th → tritone → 4th → ♭3
      [0, 6, 7, 6, 5, 0],         // root → tritone → 5th → tritone → 4th → root
      [0, 0, 3, 5, 6, 7, 6, 5],   // doubled root into ascending doom
    ],
    moves: [
      {
        id: 'the_loop',
        label: 'THE LOOP',
        hint: 'Play a 3–4 note phrase, then repeat it at least 3 times in a row. Riff-based music IS repetition — the cycle becomes the hook that lodges in the listener\'s brain.',
        detect: (hist) => {
          if (hist.length < 9) return 0;
          let count = 0;
          for (let len = 3; len <= 4; len++) {
            for (let start = 0; start <= hist.length - len * 3; start++) {
              const pattern = hist.slice(start, start + len).map(h => h.pc);
              let reps = 1;
              for (let j = start + len; j + len <= hist.length; j += len) {
                const seg = hist.slice(j, j + len).map(h => h.pc);
                if (seg.every((p, k) => p === pattern[k])) reps++;
                else break;
              }
              if (reps >= 3) count++;
            }
          }
          return count;
        },
      },
      {
        id: 'doom_step',
        label: 'DOOM STEP',
        hint: 'Play the tritone (pulsing note), then step up one to the 5th. The tritone is maximum tension — the 5th is home. That one-step resolution is the most dramatic move in heavy music.',
        detect: (hist, rootPc) => {
          let count = 0;
          const tritone = (rootPc + 6) % 12;
          const fifth = (rootPc + 7) % 12;
          for (let i = 1; i < hist.length; i++) {
            if (hist[i - 1].pc === tritone && hist[i].pc === fifth) count++;
          }
          return count;
        },
      },
    ],
    phraseStat: {
      id: 'repetition',
      label: 'REPETITION',
      hint: 'The Rifflord values repetition. Hit the same note twice in a row — doubled notes create rhythmic weight and reinforce the riff.',
      compute: (hist) => {
        if (hist.length < 2) return 0;
        let reps = 0;
        for (let i = 1; i < hist.length; i++) {
          if (hist[i].pc === hist[i - 1].pc) reps++;
        }
        return reps / (hist.length - 1);
      },
    },
    coachLines: {
      onMove: {
        the_loop: [
          'THE LOOP! Repetition is how a riff becomes a hook — the cycle plants itself in the listener\'s memory.',
          'That pattern repeated 3+ times — that\'s riff writing. The cycle IS the composition.',
          'Again. AGAIN. Every great heavy riff is a short phrase the player commits to.',
        ],
        doom_step: [
          'Tritone to 5th — the DOOM STEP. Maximum tension resolved in one move. That\'s the most dramatic interval resolution in music.',
          'The tritone wants to resolve upward. You gave it what it wanted.',
          'That one-fret step from devil\'s interval to perfect 5th — dark to light in a single move.',
        ],
      },
      onMeter: [
        'Good palette coverage. Now try repeating a short phrase — play the same 3–4 notes in a loop.',
        'Look for the pulsing note — that\'s the tritone. Play it, then step up one to the 5th for a DOOM STEP.',
        'The Rifflord\'s secret: don\'t search for new notes. Commit to a phrase and repeat it.',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4–6: specced for data-shape validation, ship in v2
  // ─────────────────────────────────────────────────────────────────────────
  // MOONLIT ARCHITECT (Gilmour) — see LEGEND_LESSONS_HANDOFF.md §1
  // LIGHTNING TAPPER (Van Halen)
  // ONE-NOTE ORACLE (B.B. King)
];

// Quick lookup
export const LEGEND_BY_ID = {};
for (const leg of LEGENDS) LEGEND_BY_ID[leg.id] = leg;

// ── Detection primitives ────────────────────────────────────────────────────
// All pure, all over { pc, time } history arrays.

/**
 * paletteFit — what % of the player's notes landed in the legend's palette?
 * @param {{ pc: number }[]} hist  Note history
 * @param {Set<number>} palette    The legend's palette set
 * @returns {number} 0..1
 */
export function paletteFit(hist, palette) {
  if (hist.length === 0) return 0;
  let inCount = 0;
  for (const h of hist) {
    if (palette.has(h.pc)) inCount++;
  }
  return inCount / hist.length;
}

/**
 * detectMoves — run all of a legend's move detectors over the history
 * @param {Array} moves   Legend's moves array
 * @param {{ pc: number, time: number }[]} hist
 * @param {number} rootPc
 * @param {Set<number>} palette
 * @returns {{ [moveId]: number }} counts per move
 */
export function detectMoves(moves, hist, rootPc, palette) {
  const result = {};
  for (const m of moves) {
    result[m.id] = m.detect(hist, rootPc, palette);
  }
  return result;
}

/**
 * phraseStats — run a legend's phrasing stat
 * @param {{ id, compute }} phraseStat
 * @param {{ pc: number, time: number }[]} hist
 * @returns {number} 0..1
 */
export function phraseStats(phraseStat, hist) {
  return phraseStat.compute(hist);
}

/**
 * styleMeter — composite style-fit score (0..100)
 * Weights from the handoff: palette 40%, moves 40%, phraseStat 20%
 */
export function styleMeter(legend, hist, rootPc) {
  if (hist.length < 3) return 0;
  const palette = legend.palette(rootPc);
  const pFit = paletteFit(hist, palette);
  const moveCounts = detectMoves(legend.moves, hist, rootPc, palette);
  const totalMoves = Object.values(moveCounts).reduce((a, b) => a + b, 0);
  // Normalize moves: each unique move type detected = up to 0.5, cap at 1.0
  const moveScore = Math.min(1, totalMoves * 0.25);
  const phraseFit = phraseStats(legend.phraseStat, hist);
  return Math.round((pFit * 40 + moveScore * 40 + phraseFit * 20));
}

/**
 * toneMatch — are the player's knobs close enough to the legend's?
 * @param {{ drive, tone, echo, verb, voice }} knobs  Player's current knobs
 * @param {{ drive, tone, echo, verb, voice }} target Legend's tone preset
 * @param {number} tol  Tolerance per knob (default 0.12)
 * @returns {boolean}
 */
export function toneMatch(knobs, target, tol = 0.12) {
  if (knobs.voice !== target.voice) return false;
  for (const k of ['drive', 'tone', 'echo', 'verb']) {
    if (Math.abs((knobs[k] ?? 0) - (target[k] ?? 0)) > tol) return false;
  }
  return true;
}

/**
 * lickMatch — does the player's recent pc sequence contain the lick?
 * Order-only, not rhythm (same ruling as Discord Coach).
 * @param {number[]} lickPcs  Lick as pc offsets from root
 * @param {{ pc: number }[]} hist  Player history
 * @param {number} rootPc
 * @returns {boolean}
 */
export function lickMatch(lickPcs, hist, rootPc) {
  const target = lickPcs.map(iv => (rootPc + iv) % 12);
  let ti = 0;
  for (const h of hist) {
    if (h.pc === target[ti]) {
      ti++;
      if (ti >= target.length) return true;
    }
  }
  return false;
}
