// =============================================================================
// music/riffAnalysis.js — WHAT WAS THAT RIFF? — post-phrase harmonic analysis
// -----------------------------------------------------------------------------
// Everything else in the listening chain answers in real time and therefore
// answers badly: one frame of audio cannot tell you what a phrase MEANT. This
// module waits until the player stops, then looks back at the whole line and
// says what it was built on.
//
// Three questions, in order, because each one needs the previous answer:
//
//   1. WHERE DOES THE PHRASE END?  A rest. Musicians phrase in breaths and the
//      gaps are where the analysis boundaries already are — no bar counting,
//      no tempo tracking, no guessing at a time signature.
//   2. WHAT IS IT PLAYED OVER?     The implied chord. A melody rarely states
//      its harmony outright, so this is inferred from which notes get the TIME
//      and which ones the line starts and lands on.
//   3. WHAT IS EACH NOTE DOING?    Against that chord, every note is a chord
//      tone, a scale colour, an earned discord, or a mistake.
//
// ⚠️ QUESTION 3 IS ANSWERED BY `music/spice.js`, NOT BY NEW CODE HERE. Discord
// Coach already owns the judgement "an off-note that resolves by step is DEPTH,
// one that just sits there is NOISE" — it is the pedagogy the whole game is
// built around, and a second, subtly different opinion living in this file
// would eventually contradict the coach that taught it. `spiceSetFor` builds
// the chord/colour/spice sets; `classifyNote` runs the resolution rule. What
// this module adds is the part Discord Coach never needed: it knows the chord
// because the player chose it, and here the chord has to be worked out first.
//
// ⚠️ AND THIS IS WHY OFF-NOTES ARE NOT SIMPLY DROPPED. A note outside the key
// is not automatically wrong — that assumption would erase exactly the notes
// that make a riff sound like anything. The ♭5 in a blues lick, the chromatic
// approach into the root, the ♭9 over a dominant: all "outside", all deliberate,
// all the point. Resolution is what separates them from detection noise, and
// resolution can only be judged AFTER the next note has been played. Which is
// the whole reason this analysis is post-hoc rather than live.
//
// PURE MODULE — no audio, no React, no app state. Pitch classes are C-based.
// =============================================================================
import { CHORD_TEMPLATES, PC_NAMES } from "./chords.js";
import { spiceSetFor, classifyNote, coachLine } from "./spice.js";

export const RIFF_DEFAULTS = {
  // A rest this long ends the phrase. Roughly a beat and a half at 90bpm —
  // long enough that a staccato line doesn't get chopped into single notes,
  // short enough that two riffs separated by a breath stay two riffs.
  phraseGapMs: 900,
  minPhraseNotes: 3,     // fewer than this is a stab, not a phrase
  maxPhraseNotes: 64,

  // Implied-harmony weighting. A melody implies a chord mostly through the
  // notes it DWELLS on, and secondarily through where it starts and lands.
  landingBonus: 1.6,     // the note the phrase ends on
  openingBonus: 1.2,     // the note it starts from
  landingRootBonus: 0.10,   // a candidate root the line actually lands on
  openingRootBonus: 0.08,   // ...or sets out from
  rootShareBonus: 0.15,     // ...or simply spends a lot of the phrase on
  sizePenalty: 0.06,        // per note beyond a triad
  minChordScore: 0.35,   // below this we decline to name a chord

  // ⚠️ THE BACKDROP IS A TRIAD OR A SEVENTH, NEVER A 9TH OR 13TH. The first
  // version scored against all of CHORD_TEMPLATES and the extended shapes ate
  // the analysis alive: a line on A-C-E with one passing F♯ came back as
  // "D Dominant 9", which contains all four notes and therefore leaves NOTHING
  // outside — and a chord that can absorb any note makes the entire
  // deliberate-discord judgement impossible, because no note is ever off it.
  // The big templates exist for the duel's stacking mechanic, where the player
  // is spelling a chord on purpose. A melodic backdrop is what a rhythm
  // guitarist would play underneath, and that is four notes at most.
  maxChordNotes: 4,
};

// ── 1. Phrase segmentation ──────────────────────────────────────────────────

/**
 * Collects melodic events and emits a phrase when the player stops.
 *
 * Events are the melody steps from `music/neckPlacement.js` — one per note, not
 * one per frame — carrying { midi, pc, t } and, once the following note
 * arrives, a duration.
 *
 * @returns {{ push, tick, current, reset }}
 *   push(event)      — record a note; event: { midi, pc, t, cell? }
 *   tick(nowMs)      — call every frame; returns a finished phrase or null
 *   current()        — the notes recorded so far
 */
export function makePhraseRecorder(opts = {}) {
  const o = { ...RIFF_DEFAULTS, ...opts };
  let events = [];
  let lastT = null;

  function close(now) {
    // Durations are the gaps BETWEEN onsets; the final note gets the gap that
    // ended the phrase, capped so a long silence doesn't make the last note
    // look like it was held for a bar.
    const out = events.map((e, i) => ({
      ...e,
      duration: i < events.length - 1
        ? Math.max(1, events[i + 1].t - e.t)
        : Math.min(o.phraseGapMs, Math.max(1, now - e.t)),
    }));
    events = [];
    lastT = null;
    return out;
  }

  return {
    push(event) {
      if (events.length >= o.maxPhraseNotes) events.shift();
      events.push({ midi: event.midi, pc: event.pc, t: event.t, cell: event.cell });
      lastT = event.t;
    },
    tick(now) {
      if (lastT === null || events.length === 0) return null;
      if (now - lastT < o.phraseGapMs) return null;
      const phrase = close(now);
      return phrase.length >= o.minPhraseNotes ? phrase : null;
    },
    current() { return events.slice(); },
    reset() { events = []; lastT = null; },
  };
}

// ── 2. Implied harmony ──────────────────────────────────────────────────────

/**
 * Weight each pitch class by how much of the phrase it actually occupies.
 *
 * ⚠️ TIME, NOT NOTE COUNT. Sixteen passing sixteenths and one held whole note
 * are not seventeen equal votes about the harmony — the held note is the one
 * the ear hangs the chord on. Counting onsets instead of duration is the
 * classic way to get a confident, wrong answer about implied harmony.
 */
export function weighPhrase(phrase, opts = {}) {
  const o = { ...RIFF_DEFAULTS, ...opts };
  const w = new Float64Array(12);
  if (!phrase.length) return w;

  phrase.forEach((e, i) => {
    let weight = e.duration ?? 1;
    if (i === phrase.length - 1) weight *= o.landingBonus;
    if (i === 0) weight *= o.openingBonus;
    w[e.pc] += weight;
  });
  return w;
}

/**
 * What chord is this line being played over?
 *
 * Scored as the share of the phrase's weight that lands on chord tones. Note
 * what is deliberately NOT here: the recall term that `detectPalette` needs.
 *
 * ⚠️ A MELODY DOES NOT HAVE TO STATE ITS OWN CHORD, WHICH IS WHY THE SCORING
 * DIFFERS FROM chordCandidates AND detectPalette. Those ask "are these notes
 * present?" — right for a strum, wrong for a line. A riff can imply A minor
 * while never touching the C, and penalising it for the missing third would
 * hand the answer to whichever two-note shape happened to fit. So: reward
 * explaining the notes that WERE played, stay neutral on the ones that weren't,
 * and lean on parsimony to stop a 6-note template from swallowing everything.
 */
export function impliedChord(phrase, opts = {}) {
  const o = { ...RIFF_DEFAULTS, ...opts };
  const w = weighPhrase(phrase, o);
  let total = 0;
  for (let i = 0; i < 12; i++) total += w[i];
  if (total <= 0) return { best: null, ranked: [] };

  const landing = phrase[phrase.length - 1]?.pc;
  const opening = phrase[0]?.pc;

  // ⚠️ ROOT SHARE IS MEASURED ON RAW DURATION, NOT ON THE BOOSTED WEIGHTS.
  // `weighPhrase` already multiplies the landing note by 1.6, so reading root
  // share off `w` credits that note three separate times — once in coverage,
  // once in its inflated share, and once again in landingRootBonus. The visible
  // symptom was a line clearly in A minor coming back as "E Augmented", purely
  // because it happened to end on the E. Raw duration keeps the two kinds of
  // evidence — how long a note sounded, and where it sat in the phrase —
  // independent, which is the only reason adding them together means anything.
  const raw = new Float64Array(12);
  for (const e of phrase) raw[e.pc] += e.duration ?? 1;
  let maxRaw = 0;
  for (let i = 0; i < 12; i++) maxRaw = Math.max(maxRaw, raw[i]);
  const ranked = [];

  const templates = CHORD_TEMPLATES.filter(t => t.ivals.length <= o.maxChordNotes);

  for (let rootPc = 0; rootPc < 12; rootPc++) {
    for (const tpl of templates) {
      const pcs = tpl.ivals.map(iv => (rootPc + iv) % 12);
      const inSet = new Set(pcs);

      let explained = 0;
      for (let i = 0; i < 12; i++) if (inSet.has(i)) explained += w[i];
      const coverage = explained / total;

      // Parsimony: a bigger template explains more by simply covering more of
      // the octave. Charge it for the reach so a plain triad can win.
      const size = o.sizePenalty * (pcs.length - 3);

      // ⚠️ EVIDENCE FOR THE ROOT, WHICH COVERAGE ALONE DOES NOT PROVIDE. Two
      // chords can contain identical notes and differ only in which one is the
      // root — F♯m7♭5 and A minor share A, C and E. Coverage cannot separate
      // them and will happily crown whichever also mops up a passing tone. The
      // tiebreakers are the three places a melody actually shows its root: it
      // tends to set out from it, land on it, and spend time on it.
      const rootEvidence =
        (landing === rootPc ? o.landingRootBonus : 0) +
        (opening === rootPc ? o.openingRootBonus : 0) +
        (maxRaw > 0 ? o.rootShareBonus * (raw[rootPc] / maxRaw) : 0);

      ranked.push({
        id: tpl.id,
        label: tpl.label,
        rootPc,
        root: PC_NAMES[rootPc],
        name: `${PC_NAMES[rootPc]} ${tpl.label}`,
        pcs,
        coverage,
        score: coverage - size + rootEvidence,
      });
    }
  }

  ranked.sort((a, b) => (b.score - a.score) || (a.pcs.length - b.pcs.length));
  const best = ranked[0] && ranked[0].score >= o.minChordScore ? ranked[0] : null;
  return { best, ranked: ranked.slice(0, 3) };
}

// ── 3. What each note was doing ─────────────────────────────────────────────

/** Human labels for the roles spice.js returns. */
export const ROLE_LABELS = {
  SAFE:  'chord tone',
  COLOR: 'in the scale',
  DEPTH: 'discord, resolved',
  NOISE: 'didn\'t land',
};

/**
 * Full post-phrase analysis.
 *
 * @param {object[]} phrase  from makePhraseRecorder
 * @param {object} opts
 *   mode      — 'major' | 'minor' for the colour layer (from the key estimate)
 *   keyRootPc — optional; only used to describe the result, not to judge notes
 * @returns {{
 *   chord, notes, keepPcs, flavorPcs, dropPcs, coach, summary
 * }}
 *   notes     — [{ pc, name, role, weight, count }] strongest first
 *   keepPcs   — pitch classes that belong to the pattern (chord/colour/depth)
 *   flavorPcs — the earned discords, for colouring
 *   dropPcs   — notes that never landed; the caller should stop lighting these
 */
export function analysePhrase(phrase, opts = {}) {
  const o = { ...RIFF_DEFAULTS, ...opts };
  const mode = opts.mode === 'major' ? 'major' : 'minor';
  const empty = {
    chord: null, notes: [], keepPcs: new Set(), flavorPcs: new Set(),
    dropPcs: new Set(), coach: '', summary: 'not enough to go on',
  };
  if (!phrase || phrase.length < 2) return empty;

  const { best: chord } = impliedChord(phrase, o);
  if (!chord) return { ...empty, summary: 'no clear harmony in that one' };

  const ctx = spiceSetFor(chord.rootPc, chord.id, mode);

  // Replay the line through the coach's own classifier, note by note, so an
  // off-note is judged by what came AFTER it — which is the entire rule.
  const history = phrase.map(e => ({ pc: e.pc, t: e.t, time: e.t }));
  const roles = new Array(phrase.length).fill(null);

  for (let i = 0; i < history.length; i++) {
    const slice = history.slice(0, i + 1);
    const { current, resolved } = classifyNote(slice, history[i].pc, ctx);
    if (current === 'SAFE' || current === 'COLOR') roles[i] = current;
    // 'SPICE-OPEN' / 'RAW-OPEN' stay undecided until something resolves them.
    for (const r of resolved) roles[r.idx] = r.classification;   // DEPTH
  }
  // Anything still open by the end of the phrase never resolved.
  for (let i = 0; i < roles.length; i++) if (!roles[i]) roles[i] = 'NOISE';

  // Roll per-note roles up to per-pitch-class. A pitch class that EVER resolved
  // counts as deliberate: hitting the same ♭5 four times and landing it once is
  // a player using it, not a player missing.
  const byPc = new Map();
  phrase.forEach((e, i) => {
    const rec = byPc.get(e.pc) || { pc: e.pc, name: PC_NAMES[e.pc], weight: 0, count: 0, roles: new Set() };
    rec.weight += e.duration ?? 1;
    rec.count += 1;
    rec.roles.add(roles[i]);
    byPc.set(e.pc, rec);
  });

  const notes = [...byPc.values()].map(rec => ({
    pc: rec.pc,
    name: rec.name,
    weight: rec.weight,
    count: rec.count,
    role: rec.roles.has('SAFE') ? 'SAFE'
      : rec.roles.has('COLOR') ? 'COLOR'
        : rec.roles.has('DEPTH') ? 'DEPTH'
          : 'NOISE',
  })).sort((a, b) => b.weight - a.weight);

  const keepPcs = new Set(notes.filter(n => n.role !== 'NOISE').map(n => n.pc));
  const flavorPcs = new Set(notes.filter(n => n.role === 'DEPTH').map(n => n.pc));
  const dropPcs = new Set(notes.filter(n => n.role === 'NOISE').map(n => n.pc));

  // One line of coaching, in Discord Coach's own voice, about the most
  // interesting thing that happened — an earned discord beats a missed one.
  let coach = '';
  const depthIdx = roles.indexOf('DEPTH');
  if (depthIdx >= 0) {
    const to = phrase.slice(depthIdx + 1).find(e => ctx.chord.has(e.pc));
    if (to) coach = coachLine('DEPTH', phrase[depthIdx].pc, to.pc, ctx);
  } else {
    const noiseIdx = roles.indexOf('NOISE');
    if (noiseIdx >= 0) coach = coachLine('NOISE', phrase[noiseIdx].pc, phrase[noiseIdx].pc, ctx);
  }

  const flavor = [...flavorPcs].map(pc => PC_NAMES[pc]);
  const summary = flavor.length
    ? `over ${chord.name}, with ${flavor.join(' and ')} for flavour`
    : `over ${chord.name}`;

  return { chord, notes, keepPcs, flavorPcs, dropPcs, coach, summary, roles };
}
