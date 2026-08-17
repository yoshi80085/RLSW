// ─── PER-SPIRIT STYLE ────────────────────────────────────────────────────────
// What each Spirit's melody is SUPPOSED to sound like, and how close a track is
// to sounding like it. `BOT_STRATEGY_HANDOFF.md` §6.6.7 / `SEQUENCING.md` §5.D-4.
//
// 🪦 THIS IS THE RIFF LIBRARY'S REPLACEMENT, AND IT IS DELIBERATELY A DIFFERENT
// KIND OF THING. The 34 riffs were retired on 2026-08-17 for two reasons, and
// both are design constraints on whatever stands in their place:
//
//   1. THE FAME CAME FROM THE NOTE DRAW, NOT FROM A DECISION. A riff trigger was
//      four specific pitches in order; whether you could play one was mostly a
//      question of what your stock happened to hold. A tight match could turn on
//      a shape one player was dealt. Every gesture below is a SHAPE — a pedal, a
//      direction, an interval class — so it can be built out of many different
//      draws, which makes reaching for it a decision rather than a lottery.
//   2. THEY PAID FAME, IN LUMPS. A single commit could hand over a third of the
//      win. These pay FANS (through `performanceScore`'s `perfBig` seat), and
//      fans only ever MULTIPLY earned FP — so a strong style run compounds
//      through the crowd instead of ending the race.
//
// ⚠️ NOTHING IN THIS FILE PAYS FAME, AND THAT IS LOAD-BEARING RATHER THAN
// INCIDENTAL. If a future edit wires a gesture to `grantFame`, it has re-created
// the mechanic that was just removed, and it will look like a balance tweak.
//
// PURE. No rng, no React, no state. Note NAMES in, numbers out — which is what
// lets `economy.js` pay for a gesture and `policies/actionScore.js` steer toward
// one out of the same definitions, instead of two readings that drift.

import { pitchIndex } from "./notes.js";

// ── The two readings of a track ─────────────────────────────────────────────
//
// ⚠️ DETECTION SCANS THE WHOLE TRACK; PROGRESS ONLY LOOKS AT THE TAIL, and the
// split is the point rather than an optimisation. A gesture that completed in
// the middle of a line was still played, so it is paid. But a HALF-finished
// gesture back there cannot be finished any more — the notes after it broke it —
// so steering toward it would send the searcher after something unreachable.
// Progress is therefore anchored at the end of the track, where the next note
// actually lands.

/** Pitch classes of a track, dropping anything unspellable. */
function pcsOf(melodyLine) {
  return (melodyLine ?? []).map(pitchIndex).filter(p => p >= 0);
}

/**
 * Adjacent intervals, folded to the NEARER direction (−6…+6).
 *
 * ⚠️ FOLDED THE SAME WAY `performanceScore` FOLDS THEM, on purpose. That
 * function already classifies leaps and direction changes off this exact
 * transform, so a gesture defined against a different fold would disagree with
 * the score it feeds — a C→A would read as a rising minor sixth in one place and
 * a falling minor third in the other.
 */
function diffsOf(pcs) {
  const out = [];
  for (let i = 1; i < pcs.length; i++) {
    let d = ((pcs[i] - pcs[i - 1]) % 12 + 12) % 12;
    if (d > 6) d -= 12;
    out.push(d);
  }
  return out;
}

const last = (arr, back = 0) => arr[arr.length - 1 - back];

// ── The gestures ────────────────────────────────────────────────────────────
//
// Two per Spirit, and two is a considered number rather than a stopping point.
// One would make a Spirit's whole commit phase a single question with a single
// answer; three starts to be a ladder, and a ladder wants the Theory routes
// (`THEORY_ROUTES_DESIGN.md`), which are a different arm. Two gives the searcher
// a genuine choice inside a turn — the shapes need different material — while
// keeping the whole system readable off one page.
//
// Each gesture declares:
//   · `notes`    — how many notes it takes to spell. `progress` never rewards a
//                  track that cannot fit the remainder (see `styleProgress`).
//   · `detect`   — did this line play it, anywhere?
//   · `progress` — how much of it the track's TAIL already spells, in [0, 1].

/** Longest run of trailing intervals satisfying `ok`, all the same sign. */
function trailingRun(diffs, ok) {
  let n = 0;
  let sign = 0;
  for (let i = diffs.length - 1; i >= 0; i--) {
    const d = diffs[i];
    if (!ok(d)) break;
    const s = Math.sign(d);
    if (sign && s !== sign) break;
    sign = s;
    n++;
  }
  return n;
}

/** Longest run of intervals satisfying `ok` with a constant sign, anywhere. */
function bestRun(diffs, ok) {
  let best = 0, n = 0, sign = 0;
  for (const d of diffs) {
    if (ok(d) && (!sign || Math.sign(d) === sign)) { n++; sign = Math.sign(d); }
    else if (ok(d)) { n = 1; sign = Math.sign(d); }
    else { n = 0; sign = 0; }
    if (n > best) best = n;
  }
  return best;
}

const stepwise = (d) => d !== 0 && Math.abs(d) <= 2;
const chromatic = (d) => Math.abs(d) === 1;
// A third, give or take — the interval an arpeggio moves by.
const thirdish  = (d) => Math.abs(d) >= 3 && Math.abs(d) <= 4;

/**
 * 🟢 THE PEDAL (Metalness) — one note hammered, with other notes between it.
 *
 * The gallop, expressed in pitch rather than rhythm. ⚠️ THE MELODY LINE CARRIES
 * NO RHYTHM AT ALL — it is an ordered list of pitches — so "gallop" has to be
 * read as the pitch figure a gallop is played ON: a root struck repeatedly with
 * the line stepping away and back. Reading it as rhythm would mean detecting
 * something the data does not contain, which is how a test ends up green against
 * a mechanic that is not there (`CLAUDE.md`'s §15 warning).
 */
const PEDAL_WINDOW = 5;
const PEDAL_HITS   = 3;

function pedalCount(pcs) {
  const win = pcs.slice(-PEDAL_WINDOW);
  let best = 0;
  for (const pc of new Set(win)) {
    const n = win.filter(x => x === pc).length;
    if (n > best) best = n;
  }
  return best;
}

// ⚠️ EVERY `progress` BELOW RETURNS 0 UNTIL REAL PATTERN MATERIAL IS ON THE
// TRACK, and that rule was learned the hard way the same day it shipped.
//
// The first draft gave several gestures a floor for "having played any note at
// all" — `leap` returned 1/3 with one note down, `groove` returned 1/3 for any
// non-zero interval. It reads as harmless because `styleGain` only ever takes a
// DIFFERENCE, and a constant floor differences away. It is not harmless: a floor
// that arrives with the FIRST note is a gain of 1/3 on that note, awarded for
// nothing, on nearly every candidate. Measured over 536 commits, the searcher
// landed the one gesture whose ladder cleared the noise floor (Metalness's
// tritone, 180 times) and essentially never landed any of the other five (11-19
// times each). A ladder that pays for standing still does not climb.
//
// So: 0 means "nothing here yet", and every step up names something the track
// actually spells. It also makes the gains legible — a 1/3 step is always one
// note of real progress, which is what `STYLE_GAIN_FLOOR` is set against.

export const STYLE_GESTURES = {
  // 🟢 THE BRUISER — vertical and dark. A hammered root, and the devil's
  // interval WALKED AWAY FROM, which is the same musical territory
  // `METALNESS_REWORK_DESIGN.md` and the Theory doc's tier-1 Diabolus stake out.
  Metalness_Monster: [
    {
      id: 'pedal', label: 'the gallop', notes: PEDAL_WINDOW,
      detect: (pcs) => {
        for (let end = PEDAL_HITS; end <= pcs.length; end++) {
          if (pedalCount(pcs.slice(0, end)) >= PEDAL_HITS) return true;
        }
        return false;
      },
      // 0 / ⅓ / ⅔ / 1 by how many times the window's best pitch has landed.
      progress: (pcs) => (pcs.length ? Math.min(PEDAL_HITS, pedalCount(pcs)) / PEDAL_HITS : 0),
    },
    {
      // ⚠️ THREE NOTES, NOT TWO, AND THE THIRD IS THE WHOLE POINT. As a bare
      // adjacent tritone this fired on 67% of all commits — it is one interval
      // out of twelve and any two notes spell something, so "did a tritone
      // happen" is close to a coin toss rather than a decision. Requiring it to
      // be ANSWERED — stated, then stepped away from — makes it a gesture
      // somebody plays on purpose, which is the entire distinction this file
      // exists to draw between a style and the note draw.
      id: 'diabolus', label: 'the tritone, walked', notes: 3,
      detect: (_pcs, diffs) => {
        for (let i = 1; i < diffs.length; i++) {
          if (Math.abs(diffs[i - 1]) === 6 && stepwise(diffs[i])) return true;
        }
        return false;
      },
      progress: (pcs, diffs) => {
        const d1 = last(diffs), d2 = last(diffs, 1);
        if (d2 != null && Math.abs(d2) === 6 && stepwise(d1)) return 1;
        if (d1 != null && Math.abs(d1) === 6) return 2 / 3;
        return 0;
      },
    },
  ],

  // 🗡️ THE VIRTUOSO — speed and reach. A clean scalar run, and the leap that is
  // answered rather than abandoned. §4.1's cliff is a performance cliff, so his
  // gestures are the two that most obviously read as PLAYING WELL.
  cosmic_ronin: [
    {
      id: 'run', label: 'the run', notes: 4,
      detect: (_pcs, diffs) => bestRun(diffs, stepwise) >= 3,
      progress: (pcs, diffs) => (pcs.length ? Math.min(3, trailingRun(diffs, stepwise)) / 3 : 0),
    },
    {
      // 🎸 THE SWEEP — three thirds in a row, the same way: an arpeggio climbing
      // or falling through a chord rather than walking a scale.
      //
      // 🪦 IT REPLACED "the leap, answered" (a wide interval followed by a step
      // back), and the reason is a property of the DATA rather than a balance
      // call. `melodyLine` is pitch CLASSES with no octave, and the interval fold
      // that keeps this file agreeing with `performanceScore` caps every distance
      // at six semitones — so "a leap" could only ever mean a fourth or a
      // tritone, both of which turn up constantly in a random draw. Measured: it
      // fired on 87% of the Ronin's commits, which is a tax rebate, not a
      // gesture. There is no such thing as a big leap in pitch-class space, and
      // pretending otherwise was measuring the fold.
      id: 'sweep', label: 'the sweep', notes: 4,
      detect: (_pcs, diffs) => bestRun(diffs, thirdish) >= 3,
      progress: (pcs, diffs) => (pcs.length ? Math.min(3, trailingRun(diffs, thirdish)) / 3 : 0),
    },
  ],

  // 📻 THE CONTROLLER — sideways motion. The chromatic slide is the natural home
  // for his Freestyle innate (the first out-of-scale note per turn is free), and
  // the two-note motif is what "Groove" means when you only have pitches.
  intergalactic_0: [
    {
      id: 'slide', label: 'the chromatic slide', notes: 4,
      detect: (_pcs, diffs) => bestRun(diffs, chromatic) >= 3,
      progress: (pcs, diffs) => (pcs.length ? Math.min(3, trailingRun(diffs, chromatic)) / 3 : 0),
    },
    {
      // A B A B — up, back, up. The middle interval is the exact inverse of the
      // two around it, which is what makes it read as one figure said twice
      // rather than as three unrelated moves.
      id: 'groove', label: 'the two-note groove', notes: 4,
      detect: (_pcs, diffs) => {
        for (let i = 2; i < diffs.length; i++) {
          if (diffs[i] !== 0 && diffs[i] === diffs[i - 2] && diffs[i - 1] === -diffs[i]) return true;
        }
        return false;
      },
      progress: (_pcs, diffs) => {
        const d1 = last(diffs), d2 = last(diffs, 1), d3 = last(diffs, 2);
        if (d3 != null && d1 !== 0 && d1 === d3 && d2 === -d1) return 1;
        if (d2 != null && d1 != null && d1 !== 0 && d2 === -d1) return 2 / 3;
        return 0;
      },
    },
  ],
};

/** The gestures a Spirit is playing for. Unknown Spirits have none — see below. */
export function gesturesFor(spiritId) {
  // ⚠️ AN UNKNOWN SPIRIT GETS AN EMPTY LIST, NOT A DEFAULT SET. Glamarchy is
  // `IN_DEVELOPMENT` (§0.5) and has no musical identity yet; handing her another
  // character's gestures would pay her for playing like somebody else and would
  // read, in a bench table, as a balanced fourth seat.
  return STYLE_GESTURES[spiritId] ?? [];
}

// ── The payout side ─────────────────────────────────────────────────────────

/** How many `perfBig` points a style run is worth at most. */
export const STYLE_BIG_MAX = 2;

/**
 * 🎭 Did this committed line sound like this Spirit? Read at commit time by
 * `melodyCommit.js` and paid through `performanceScore`'s `perfBig` seat.
 *
 * @returns {{ score:number, hits:string[], labels:string[] }}
 *   `score` is one point per completed gesture, capped at `STYLE_BIG_MAX`.
 */
export function detectSpiritStyle(spiritId, melodyLine) {
  const pcs   = pcsOf(melodyLine);
  const diffs = diffsOf(pcs);
  const hits = [], labels = [];
  for (const g of gesturesFor(spiritId)) {
    if (g.detect(pcs, diffs)) { hits.push(g.id); labels.push(g.label); }
  }
  return { score: Math.min(STYLE_BIG_MAX, hits.length), hits, labels };
}

// ── The steering side ───────────────────────────────────────────────────────

/**
 * How many more notes a gesture at progress `p` still wants.
 *
 * ⚠️ MEASURED IN INTERVALS, NOT NOTES, and getting that wrong is an off-by-one
 * that silently disables the ladder at the end of a track. Every gesture's
 * progress is computed over the intervals BETWEEN its notes, so an `n`-note
 * shape has `n - 1` rungs: the Ronin's four-note run is two-thirds done with one
 * note to go, and `ceil(4 × ⅓)` says two. A gesture that reports needing one
 * note more than it does drops out of consideration exactly when it is closest
 * to landing, which is the worst possible moment to stop steering.
 */
function notesStillNeeded(gesture, p) {
  return Math.ceil((gesture.notes - 1) * (1 - p));
}

/**
 * 🎯 How close the track's TAIL is to completing one of this Spirit's gestures.
 *
 * ⚠️ THIS IS THE HALF THE PAYOUT CANNOT DO, and §6.6.3's lesson is the whole
 * reason it exists. A reward that lands AT the commit is already visible to
 * `evaluate` — the fans arrive, the term moves. What no term can see is a track
 * ONE NOTE AWAY from a gesture, because that state pays nothing yet. So without
 * this the searcher never steers toward a shape, the shape never completes, and
 * the whole system reads as switched off while every test stays green. Exactly
 * how the bot went 1,218 commits without playing a single riff.
 *
 * ⚠️ A GESTURE THAT CANNOT FIT IN THE REMAINING SLOTS MUST NOT STEER, and
 * scoring it small does not help — a small score still steers. `MELODY_MAX` is
 * 8, so a four-note figure started with two slots left is a distraction, and the
 * honest answer is to drop it from consideration entirely.
 *
 * @param {string} spiritId
 * @param {string[]} melodyLine   the track as it stands
 * @param {number} [slotsLeft]    melody slots still available AFTER this track
 * @returns {number} best progress in [0, 1] over the reachable gestures
 */
export function styleProgress(spiritId, melodyLine, slotsLeft = Infinity) {
  const pcs   = pcsOf(melodyLine);
  const diffs = diffsOf(pcs);
  let best = 0;
  for (const g of gesturesFor(spiritId)) {
    const p = g.progress(pcs, diffs);
    if (p >= 1) continue;                     // already played — nothing left to steer at
    const needed = notesStillNeeded(g, p);
    if (needed > slotsLeft) continue;
    if (p > best) best = p;
  }
  return best;
}

/**
 * The GAIN a candidate note adds — what the beam's scorer actually ranks on.
 *
 * 🧭 SCORE THE GAIN, NOT THE ABSOLUTE POSITION. This was one of the four
 * decisions worth keeping from the retired riff ladder (`actionScore.js` records
 * the other three): a note is worth what it ADDS. Ranking on absolute progress
 * would score every candidate identically whenever the track is already close,
 * which is precisely when the choice matters most.
 */
export function styleGain(spiritId, melodyLine, note, slotsLeft = Infinity) {
  const before = styleProgress(spiritId, melodyLine, slotsLeft + 1);
  const after  = styleProgressWithNote(spiritId, melodyLine, note, slotsLeft);
  return Math.max(0, after - before);
}

/** Progress of `melodyLine + note`, including a gesture the note COMPLETES. */
export function styleProgressWithNote(spiritId, melodyLine, note, slotsLeft = Infinity) {
  const line  = [...(melodyLine ?? []), note];
  const pcs   = pcsOf(line);
  const diffs = diffsOf(pcs);
  let best = 0;
  for (const g of gesturesFor(spiritId)) {
    const p = g.progress(pcs, diffs);
    // ⚠️ A COMPLETING NOTE IS THE WHOLE POINT, so unlike `styleProgress` this
    // does NOT skip `p >= 1`. Skipping it there is right (nothing left to steer
    // at); skipping it here would make the note that finishes a gesture score
    // exactly the same as one that ignores it.
    if (p < 1 && notesStillNeeded(g, p) > slotsLeft) continue;
    if (p > best) best = p;
  }
  return best;
}
