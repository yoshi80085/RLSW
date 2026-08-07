// =============================================================================
// riff/riffPerformance.js — 🎸 SUSTAINS, BENDS & CHORDS on a voiced riff
// -----------------------------------------------------------------------------
// Turns a bare note sequence into something you PERFORM rather than merely hit:
// which notes ring, which ones you bend and how hard, and which land as two-note
// power chords.
//
// ⚠️ DETERMINISM. This runs on the ENGINE's seeded rng, inside
// applyRiffOffStarted — never on the client at render time. Two players in a
// multiplayer riff-off must be handed the identical chart; deciding sustains
// locally would give them different riffs and the verdict would be meaningless.
// Same reason riff generation itself lives in the engine.
//
// Ported from the arrow-highway prototype (arrow-highway-proto.html), which is
// the version that was actually playtested. Behaviour here is deliberately the
// same — the knobs became parameters, nothing else changed.
//
// PURE — no React, no audio, no app state.
// =============================================================================

import { STRING_OPENS, MAX_FRET } from "./guitarMap.js";

/** ms — below this a tail has no room to host a bend gesture. */
export const BEND_MIN_SUSTAIN = 520;
/** ms — a minor-third bend needs a tail long enough to sing on. */
export const SHOWPIECE_MIN_SUSTAIN = 900;

// Not every bend is a showpiece. A half-step nudge and a minor-third scream are
// different gestures; playing them with the same shape makes both wrong — the
// small one sounds overwrought, the big one sounds flat.
export const BEND_WEIGHTS = {
  subtle:    { semis: 1, travel: 0.52, over: 0.08, vib: 0.07, cycles: 3, rate: 0.075, label: '' },
  standard:  { semis: 2, travel: 1.00, over: 0.26, vib: 0.20, cycles: 6, rate: 0.090, label: '' },
  showpiece: { semis: 3, travel: 1.55, over: 0.44, vib: 0.40, cycles: 9, rate: 0.105, label: 'SING' },
};

export const PERFORMANCE_DEFAULTS = {
  sustainPct: 28,   // share of notes that ring
  bendPct:    30,   // share of SUSTAINS that carry a bend
  chordPct:   25,   // how often an eligible note grows a fifth
  bendDepth:  3,    // 1 half step · 2 whole step · 3 minor third (hard ceiling)
};

/**
 * Melodic direction per note — the arrow the highway draws.
 * This is NOTATION, not input: the player presses a string number. It exists so
 * the contour of the melody stays readable without costing a second keypress.
 */
export function directionsFor(pitches) {
  return pitches.map((p, i) => {
    if (i === 0) return 'same';                       // the anchor — just strike it
    return p > pitches[i - 1] ? 'up' : p < pitches[i - 1] ? 'down' : 'same';
  });
}

/**
 * Decorate a voiced riff in place-ish (returns a new array).
 *
 * @param {Array<{pitch:number, string:number, fret:number, accent?:boolean}>} notes
 * @param {function} rng  seeded () => [0,1)
 * @param {object=} opts  PERFORMANCE_DEFAULTS overrides
 * @returns {Array} notes with dir / sustain / bend* / hasPartner / partnerOf
 */
export function applyPerformance(notes, rng, opts = {}) {
  const o = { ...PERFORMANCE_DEFAULTS, ...opts };
  const out = notes.map(n => ({ ...n }));
  if (!out.length) return out;

  // chug = a repeated note. Marking them matters twice over: they're
  // palm-muted in the audio, and they must never host a mid-run sustain.
  const dirs = directionsFor(out.map(n => n.pitch));
  out.forEach((n, i) => { n.dir = dirs[i]; n.chugPart = i > 0 && n.pitch === out[i - 1].pitch; });

  applySustains(out, rng, o);
  applyBends(out, rng, o);
  return out;
}

/**
 * Sustains, with a FLOOR so holds are always part of play. Left purely to
 * chance a riff can come out with zero sustains and the hold mechanic silently
 * disappears for that round — a player would never learn it exists.
 *
 * Placement prefers ACCENTS and never lands MID chug run: holding a note meant
 * to be a machine-gun palm mute fights the groove. The note that ENDS a chug
 * run is fair game — chug-chug-chug-CHUNNNG is a standard riff ending.
 */
function applySustains(notes, rng, o) {
  const want = Math.max(1, Math.round(notes.length * (o.sustainPct / 100)));
  notes.forEach(n => { n.sustain = 0; });

  const last = notes.length - 1;
  const midChug = i => !!(notes[i + 1] && notes[i + 1].chugPart);
  const eligible = notes.map((_, i) => i)
    .filter(i => i !== last && !midChug(i))
    .sort((a, b) => (notes[b].accent ? 1 : 0) - (notes[a].accent ? 1 : 0) || rng() - 0.5);

  // the riff always rings out rather than stopping dead
  notes[last].sustain = 640 + Math.round(rng() * 700);
  for (let k = 0; k < Math.min(want - 1, eligible.length); k++) {
    notes[eligible[k]].sustain = 420 + Math.round(rng() * 620);
  }
}

/**
 * Bends ride sustains only — you cannot bend a note you are not fretting.
 *
 * BALANCE: a showpiece is worth something because it's RARE and because it
 * lands where it can breathe. Scattering minor-thirds makes them wallpaper, so
 * they are PROMOTED onto the best host rather than rolled per note — roughly
 * one riff in three, final note preferred, because a riff that ends on a
 * screaming bend ends on a statement.
 */
function applyBends(notes, rng, o) {
  const want = o.bendPct / 100;
  for (const n of notes) {
    n.bend = false; n.bendDir = null; n.bendAmt = 0; n.bendAt = 0; n.bendWeight = null;
    if (!n.sustain || rng() >= want) continue;
    if (n.sustain < BEND_MIN_SUSTAIN) n.sustain = BEND_MIN_SUSTAIN + Math.round(rng() * 260);

    n.bend = true;
    // Real bends push the pitch UP the overwhelming majority of the time —
    // a down-bend is a pre-bend release, a rarer and more advanced move.
    n.bendDir = rng() < 0.82 ? 'up' : 'down';
    n.bendWeight = rng() < 0.42 ? 'subtle' : 'standard';
    // the gesture sits mid-tail, never at an edge where you couldn't react
    n.bendAt = Math.round(n.sustain * (0.34 + rng() * 0.24));
  }

  if (o.bendDepth >= 3) {
    let budget = rng() < 0.32 ? 1 : 0;
    if (notes.length >= 14 && budget && rng() < 0.22) budget = 2;
    const hosts = notes
      .map((n, i) => ({ n, i }))
      .filter(({ n }) => n.bend && n.sustain >= SHOWPIECE_MIN_SUSTAIN)
      .sort((a, b) =>
        (b.i === notes.length - 1 ? 1e6 : 0) - (a.i === notes.length - 1 ? 1e6 : 0) ||
        b.n.sustain - a.n.sustain);
    for (let k = 0; k < Math.min(budget, hosts.length); k++) {
      const { n } = hosts[k];
      n.bendWeight = 'showpiece';
      n.bendDir = 'up';                          // you don't scream downward
      n.bendAt = Math.round(n.sustain * 0.30);   // start early — it needs runway
    }
  }

  for (const n of notes) {
    if (n.bend) n.bendAmt = Math.min(o.bendDepth, BEND_WEIGHTS[n.bendWeight].semis);
  }
}

/**
 * TWO-NOTE CHORDS — the power chord.
 *
 * Partner is a fifth above the root voiced on the ADJACENT string, and that is
 * what makes it playable: in standard tuning the fifth above a root on string s
 * sits on string s+1 two or three frets up, so the two gems land on ADJACENT
 * NUMBER KEYS. One hand can press 3+4; it could not press 2+6. The instrument's
 * tuning is doing the ergonomics.
 *
 * Runs AFTER the timeline is built — partners share the root's hit time exactly,
 * so `times` is spliced alongside `notes`.
 *
 * @returns {number} how many partners were inserted
 */
export function applyChords(notes, times, rng, opts = {}) {
  const rate = (opts.chordPct ?? PERFORMANCE_DEFAULTS.chordPct) / 100;
  let added = 0;
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i];
    if (n.partnerOf != null || n.hasPartner) continue;
    if (n.chugPart) continue;                          // chugs stay single-note
    if (!n.accent && rng() > rate * 0.4) continue;
    if (rng() >= rate) continue;

    const target = n.pitch + 7;                        // the fifth
    const s = n.string + 1;
    if (s > 5) continue;                               // nothing above the high e
    const fret = target - STRING_OPENS[s];
    if (fret < 0 || fret > MAX_FRET) continue;

    n.hasPartner = true;
    notes.splice(i + 1, 0, {
      ...n, pitch: target, string: s, fret, hasPartner: false, partnerOf: i,
      bend: false, bendDir: null, bendAmt: 0, bendAt: 0, bendWeight: null,
    });
    times.splice(i + 1, 0, times[i]);                  // same instant, exactly
    for (let k = i + 2; k < notes.length; k++) {
      if (notes[k].partnerOf != null && notes[k].partnerOf >= i + 1) notes[k].partnerOf++;
    }
    added++;
  }
  return added;
}
