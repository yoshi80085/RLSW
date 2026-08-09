// =============================================================================
// music/neckPlacement.js — HEARD NOTES → FRETS — where might that have been?
// -----------------------------------------------------------------------------
// Takes the register-aware `notes` from `audio/chroma.js` and works out where
// on a 6×13 neck they were probably played, producing a `layers` object that
// drops straight into `ui/FretboardFull.jsx`.
//
// ⚠️ THE HONEST PROBLEM THIS MODULE EXISTS TO HANDLE. A microphone hears
// PITCHES. A guitar plays POSITIONS, and the map between them is many-to-one:
// E4 sits on four different strings, and the audio cannot tell you which one a
// player used. Any UI that lights a single dot is guessing. So this module
// never pretends otherwise — it ranks the candidates, marks the most plausible
// one, and keeps the rest visible but quiet. Three tiers:
//
//   HEARD      the best-guess position for a note actually detected  → 'hot'
//   ALTERNATE  the same exact pitch, playable elsewhere on the neck  → 'dim'
//   ECHO       the same pitch CLASS in other octaves                 → 'dim',
//              in a second colour, because this one is theory rather than
//              observation: nobody played that note, it just shares a name.
//
// The "best guess" is a PLAYABILITY argument, not an acoustic one — the audio
// has no opinion. A hand stays put: guitarists play runs inside a four-or-five
// fret window and move between them deliberately. So the module tracks a
// rolling hand position and prefers positions near it, which is the same
// assumption `voiceRiff` already makes with its anchor windows.
//
// PURE MODULE — no React, no audio, no app state. Geometry comes from
// `riff/guitarMap.js` so the neck model stays single-sourced.
// =============================================================================
import { STRING_OPENS, MAX_FRET, positionsForPitch } from "../riff/guitarMap.js";

// `pitch` in guitarMap's coordinate space is semitones above open low E (E2).
// MIDI 40 IS E2, so the two systems differ by a constant and nothing else.
export const E2_MIDI = 40;
export const NECK_MIN_PITCH = 0;                              // open low E
export const NECK_MAX_PITCH = STRING_OPENS[5] + MAX_FRET;     // 36 = E5 at fret 12

export const midiToPitch = midi => midi - E2_MIDI;
export const pitchToMidi = pitch => pitch + E2_MIDI;

export const PLACEMENT_DEFAULTS = {
  // Cost weights for choosing between positions that sound identical.
  // Fret distance dominates: a hand spans all six strings at once but only
  // four or five frets, so crossing strings is nearly free and sliding is not.
  fretCost: 1.0,
  stringCost: 0.25,
  openBonus: 1.2,        // open strings are easy and players reach for them
  // How fast the assumed hand position follows what is being played. Long
  // enough that one stray note doesn't yank the hand up the neck.
  handHalfLifeMs: 900,
  restFret: 5,           // where the hand is assumed to sit before you play
  restString: 2,
  trailHalfLifeMs: 700,  // how long a note keeps glowing after it stops
  minStrength: 0.12,     // drop trail entries below this

  // Melody trail — the line that blazes from note to note.
  melodyMs: 2800,        // how long a step stays on the path
  melodyMax: 14,         // hard cap on path length
  // How long the newest span takes to reach across to the note that just
  // landed. A note is an instant, but a line that appears whole in one frame
  // reads as a glitch rather than as movement — the eye needs to see it travel
  // to read it as one line rather than a new object. ~7 frames.
  growMs: 120,
};

/**
 * Fold a pitch onto the playable neck by whole octaves.
 * A bass note below open E, or a solo above the 12th fret, is still a real
 * note — it just isn't reachable in the model. Folding keeps it visible in the
 * right pitch class rather than silently dropping it.
 * @returns {{ pitch: number, folded: number }} folded = octaves shifted
 */
export function foldOntoNeck(pitch) {
  let p = pitch;
  let folded = 0;
  while (p < NECK_MIN_PITCH) { p += 12; folded++; }
  while (p > NECK_MAX_PITCH) { p -= 12; folded--; }
  return { pitch: p, folded };
}

/** All neck positions whose pitch CLASS matches, any octave. */
export function positionsForPitchClass(pc) {
  const out = [];
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= MAX_FRET; f++) {
      if ((((STRING_OPENS[s] + f + 4) % 12) + 12) % 12 === pc) out.push([s, f]);
    }
  }
  return out;
}

/** Pitch class (0 = C) of a neck cell. Open low E is E = pc 4. */
export function cellPc(string, fret) {
  return (((STRING_OPENS[string] + fret + 4) % 12) + 12) % 12;
}

/**
 * Rank the positions that sound `pitch`, cheapest hand movement first.
 * @param {number} pitch  semitones above open low E
 * @param {[number,number]} ref  assumed hand position [string, fret]
 * @returns {{ best: [number,number]|null, alternates: [number,number][], folded: number }}
 */
export function placePitch(pitch, ref = [PLACEMENT_DEFAULTS.restString, PLACEMENT_DEFAULTS.restFret], opts = {}) {
  const o = { ...PLACEMENT_DEFAULTS, ...opts };
  const { pitch: onNeck, folded } = foldOntoNeck(pitch);
  const positions = positionsForPitch(onNeck);
  if (positions.length === 0) return { best: null, alternates: [], folded };

  const cost = ([s, f]) =>
    Math.abs(f - ref[1]) * o.fretCost +
    Math.abs(s - ref[0]) * o.stringCost -
    (f === 0 ? o.openBonus : 0);

  const sorted = [...positions].sort((a, b) => cost(a) - cost(b));
  return { best: sorted[0], alternates: sorted.slice(1), folded };
}

/**
 * Rolling hand position. Notes drag the assumed hand toward themselves, slowly.
 *
 * ⚠️ WHY THIS IS NOT JUST "use the last note's fret". A single note has several
 * candidate positions and picking one to define the hand position, from which
 * the next note's position is picked, makes the whole readout a chain of
 * guesses that can run away up the neck and never come back. Averaging over a
 * window keeps one ambiguous note from stealing the hand, and the decay toward
 * rest means a pause resets the assumption instead of stranding it at fret 11.
 */
export function makeHandTracker(opts = {}) {
  const o = { ...PLACEMENT_DEFAULTS, ...opts };
  let fret = o.restFret;
  let string = o.restString;

  return {
    ref() { return [string, fret]; },
    /** @param {[number,number][]} positions  the positions just committed to */
    push(positions, dtMs = 16.7) {
      if (!positions.length) return;
      let sf = 0;
      let ss = 0;
      for (const [s, f] of positions) { ss += s; sf += f; }
      const alpha = 1 - Math.pow(0.5, Math.max(0, dtMs) / o.handHalfLifeMs);
      fret += alpha * (sf / positions.length - fret);
      string += alpha * (ss / positions.length - string);
    },
    reset() { fret = o.restFret; string = o.restString; },
  };
}

/**
 * One-shot placement: heard notes → FretboardFull `layers`.
 *
 * ⚠️ ALTERNATES AND ECHOES ARE OFF BY DEFAULT, AND THAT IS A REVERSAL. They
 * were on originally, on the reasoning that showing every position a note could
 * occupy is more honest about the ambiguity. In use it reads as the opposite:
 * one played note lights up to seven cells, a three-note chord lights twenty,
 * and a neck that is mostly on tells you nothing. Worse, it buries the actual
 * finding — the eye cannot pick three bright cells out of twenty lit ones.
 * Honesty about uncertainty is worth having, but not at the cost of the signal;
 * it is now a toggle for when you want it, not the default state.
 *
 * @param {{midi:number, pc:number, strength:number}[]} notes  from chroma.js
 * @param {object} opts
 *   ref            — [string, fret] assumed hand position
 *   colors         — { heard, alternate, echo } hex strings
 *   showAlternates — other positions of the same exact pitch (default false)
 *   showEchoes     — other octaves of the same pitch class  (default false)
 * @returns {{ layers: object, placements: object[] }}
 *   layers: cellId ("s,f") → { color, style } — FretboardFull's contract
 */
export function placeNotes(notes = [], opts = {}) {
  const o = { ...PLACEMENT_DEFAULTS, ...opts };
  const colors = {
    heard: '#19e6ff', alternate: '#19e6ff', echo: '#8a5cff', ...(opts.colors || {}),
  };
  const showEchoes = opts.showEchoes === true;
  const showAlternates = opts.showAlternates === true;
  const ref = opts.ref || [o.restString, o.restFret];

  const layers = {};
  const placements = [];

  // ECHOES FIRST, so anything observed overwrites anything merely implied.
  // Painting in confidence order is what keeps a real detection from being
  // buried under the theory layer for the same pitch class.
  if (showEchoes) {
    for (const n of notes) {
      for (const [s, f] of positionsForPitchClass(n.pc)) {
        layers[`${s},${f}`] = { color: colors.echo, style: 'dim' };
      }
    }
  }

  for (const n of notes) {
    const { best, alternates, folded } = placePitch(midiToPitch(n.midi), ref, o);
    if (!best) continue;
    if (showAlternates) {
      for (const [s, f] of alternates) {
        layers[`${s},${f}`] = { color: colors.alternate, style: 'dim' };
      }
    }
    layers[`${best[0]},${best[1]}`] = {
      color: colors.heard,
      style: n.strength >= 0.6 ? 'hot' : 'solid',
    };
    placements.push({ ...n, position: best, alternates, folded });
  }

  return { layers, placements };
}

/**
 * Stateful placement over time — the thing a live view actually wants.
 *
 * Keeps TWO pictures of the neck at once, because they answer different
 * questions and neither one substitutes for the other:
 *
 *   NOW  — a short decaying trail of what is ringing this moment. Answers
 *          "what is that chord", changes constantly, bright.
 *   USED — every position heard so far this session, accumulated and never
 *          decayed. Answers "what is this piece MADE of" — after a minute of
 *          listening it has drawn the scale shape the player is working in,
 *          which no single frame can ever show. Quiet, and underneath.
 *
 * The second one is the whole reason to leave this mode running. A snapshot
 * shows a chord; an accumulation shows a key, a mode, a pentatonic box, and
 * the two or three chromatic notes someone keeps leaning on.
 *
 * @returns {{ push, layers, notes, usedCells, usageByPc, totalHeard,
 *             ref, reset, clearUsage }}
 */
export function makeNeckTracker(opts = {}) {
  const o = { ...PLACEMENT_DEFAULTS, ...opts };
  const hand = makeHandTracker(o);
  /** @type {Map<number, number>} midi → current strength (the NOW layer) */
  let live = new Map();
  /** @type {Map<string, number>} cellId → accumulated weight (the USED layer) */
  let usage = new Map();
  /** Pitch-class usage, the input to melodic-structure analysis. */
  let pcUsage = new Float64Array(12);
  let heardFrames = 0;
  /** @type {{s:number, f:number, midi:number, t:number}[]} the melody path */
  let melody = [];
  let clock = 0;        // ms since this tracker started; frame-rate independent
  let lastTopMidi = null;

  return {
    /**
     * @returns {{midi,pc,s,f,t}|null} the melody step recorded on THIS frame, if
     *   any. Returned rather than left for the caller to spot, because the only
     *   other way to notice a new step is to diff `melodyTrail()` — and that
     *   list also loses entries off its tail, so its length says nothing.
     */
    push(notes = [], dtMs = 16.7) {
      let newStep = null;
      const decay = Math.pow(0.5, Math.max(0, dtMs) / o.trailHalfLifeMs);
      for (const [midi, s] of live) live.set(midi, s * decay);
      // A note currently sounding takes the MAX of its decayed trail and its
      // fresh strength — a held note stays at full brightness rather than
      // fading while it is still ringing.
      for (const n of notes) live.set(n.midi, Math.max(live.get(n.midi) || 0, n.strength));
      for (const [midi, s] of [...live]) if (s < o.minStrength) live.delete(midi);

      // Only notes heard THIS frame move the hand or count as usage. Trail
      // entries are memory, and memory should neither drag the hand toward a
      // note that stopped sounding two seconds ago nor inflate the usage map
      // by re-counting the same note on every frame it lingers.
      if (notes.length) {
        const positions = notes
          .map(n => placePitch(midiToPitch(n.midi), hand.ref(), o).best)
          .filter(Boolean);
        hand.push(positions, dtMs);

        // ⚠️ USAGE IS WEIGHTED BY TIME, NOT BY FRAME COUNT. Accumulating one
        // unit per frame makes the map a measure of how long the browser
        // managed to render, so a note held through a slow patch would count
        // less than the same note during a smooth one. Seconds-of-sounding is
        // the thing actually being asked about.
        const seconds = Math.max(0, dtMs) / 1000;
        for (let i = 0; i < notes.length; i++) {
          const p = positions[i];
          if (!p) continue;
          const w = notes[i].strength * seconds;
          const id = `${p[0]},${p[1]}`;
          usage.set(id, (usage.get(id) || 0) + w);
          pcUsage[notes[i].pc] += w;
        }
        heardFrames++;

        // ── The melody path ──
        // ⚠️ THE TOP VOICE IS THE MELODY. When three notes sound at once there
        // is no acoustic fact about which one is "the tune", so a rule has to
        // be chosen and stated: highest pitch wins. It is the convention
        // listeners actually use — the top of a chord is what you hum — and it
        // degrades sensibly, because a single-note line IS its own top voice.
        //
        // A step is recorded only when the top voice CHANGES. Recording every
        // frame would stack hundreds of identical points on one cell and make
        // a held note look like a scribble.
        const top = notes.reduce((a, b) => (b.midi > a.midi ? b : a));
        if (top.midi !== lastTopMidi) {
          lastTopMidi = top.midi;
          const spot = placePitch(midiToPitch(top.midi), hand.ref(), o).best;
          if (spot) {
            newStep = {
              s: spot[0], f: spot[1], midi: top.midi,
              pc: ((top.midi % 12) + 12) % 12, t: clock,
            };
            melody.push(newStep);
            if (melody.length > o.melodyMax) melody.shift();
          }
        }
      }
      clock += Math.max(0, dtMs);
      // Expire old steps regardless of whether anything is sounding, so the
      // path fades out during a rest instead of freezing mid-phrase.
      const cutoff = clock - o.melodyMs;
      while (melody.length && melody[0].t < cutoff) melody.shift();
      return newStep;
    },

    /** The tracker's own clock in ms — the time base melody steps are stamped
     *  with. Anything reasoning about those timestamps must use this, not
     *  performance.now(), or the two will disagree about how long a rest was. */
    now() { return clock; },

    /**
     * The melody path, oldest → newest, ready for FretboardFull's `trail` prop.
     *
     * `fade` is 1 for the note just played and approaches 0 as a step ages out.
     * `grow` runs 0 → 1 over `growMs` from the moment the step landed; the
     * renderer uses the LAST point's value to decide how far the head has
     * reached toward it, so the line travels out of the previous note instead
     * of appearing whole. Only the newest point's `grow` matters visually, but
     * every point carries it so the renderer needs no special case.
     */
    melodyTrail() {
      return melody.map(m => ({
        cellId: `${m.s},${m.f}`,
        midi: m.midi,
        fade: Math.max(0, Math.min(1, 1 - (clock - m.t) / o.melodyMs)),
        grow: Math.max(0, Math.min(1, (clock - m.t) / o.growMs)),
      }));
    },
    notes() {
      return [...live.entries()]
        .map(([midi, strength]) => ({ midi, pc: ((midi % 12) + 12) % 12, strength }))
        .sort((a, b) => b.strength - a.strength);
    },
    /** Positions heard at some point this session, with 0..1 relative weight. */
    usedCells() {
      let max = 0;
      for (const w of usage.values()) if (w > max) max = w;
      if (max <= 0) return {};
      const out = {};
      for (const [id, w] of usage) out[id] = w / max;
      return out;
    },
    /** Pitch-class usage over the session — feeds melodic-structure analysis. */
    usageByPc() { return Float32Array.from(pcUsage); },
    totalHeard() { return heardFrames; },

    /**
     * The merged neck picture: USED underneath, NOW on top.
     *
     * Paint order is load-bearing. The used layer covers many more cells than
     * the live one and would erase this moment's reading if it went last —
     * the same paint-order rule the echo layer follows, for the same reason.
     *
     * @param {object} layerOpts
     *   showUsed   — draw the session's accumulated positions (default true)
     *   usedColor  — colour for the used layer
     *   minUsed    — relative weight a cell needs before it counts as "used",
     *                which keeps one stray detection out of the picture
     *   dropPcs    — Set of pitch classes the riff analysis judged to have
     *                never landed. Removed from the picture entirely.
     *   flavorPcs  — Set of pitch classes that are deliberate discords.
     *                Kept, and coloured differently.
     *   flavorColor — colour for those
     */
    layers(layerOpts = {}) {
      const showUsed = layerOpts.showUsed !== false;
      const usedColor = layerOpts.usedColor || '#44ff88';
      const flavorColor = layerOpts.flavorColor || '#ff2d95';
      const minUsed = layerOpts.minUsed ?? 0.08;
      const dropPcs = layerOpts.dropPcs || null;
      const flavorPcs = layerOpts.flavorPcs || null;

      const out = {};
      if (showUsed) {
        for (const [id, w] of Object.entries(this.usedCells())) {
          if (w < minUsed) continue;
          const [s, f] = id.split(',').map(Number);
          const pc = cellPc(s, f);
          // ⚠️ DROPPED NOTES LEAVE THE PICTURE, BUT NOT THE TALLY. The cell
          // stops being drawn; `usedCells` and `usageByPc` still hold it. A
          // later phrase can resolve the same note and bring it back, which it
          // could not do if the evidence had been deleted on one bad phrase.
          if (dropPcs && dropPcs.has(pc)) continue;

          // ⚠️ BRIGHTNESS IS CONTINUOUS, NOT BUCKETED. This used to pick
          // between two fixed styles at a threshold, which drew a passage as
          // two flat tiers and hid the actual shape of the playing — the whole
          // question being "which notes does this person lean on". `level` is
          // the usage weight itself; FretboardFull multiplies it into the
          // flash. The floor of 0.25 keeps a once-touched note visible rather
          // than invisible-but-present, which would be a lie of a different kind.
          const level = 0.25 + 0.75 * w;
          out[id] = flavorPcs && flavorPcs.has(pc)
            ? { color: flavorColor, style: 'pulse', level: Math.max(0.5, level) }
            : { color: usedColor, style: 'pulse', level };
        }
      }
      const now = placeNotes(this.notes(), { ...o, ...layerOpts, ref: hand.ref() }).layers;
      return { ...out, ...now };
    },
    ref() { return hand.ref(); },
    /** Clears the session picture but leaves the live trail and hand alone. */
    clearUsage() { usage = new Map(); pcUsage = new Float64Array(12); heardFrames = 0; },
    reset() {
      live = new Map();
      usage = new Map();
      pcUsage = new Float64Array(12);
      heardFrames = 0;
      melody = [];
      lastTopMidi = null;
      hand.reset();
      // `clock` deliberately keeps running: it is a monotonic timeline, and
      // rewinding it to 0 while any surviving step still carries an old
      // timestamp would compute a negative age and a fade above 1.
    },
  };
}
