// =============================================================================
// music/context.js  —  THE CHORD CONTEXT LADDER (PENDING_CHANGES B3)
// -----------------------------------------------------------------------------
// The one idea the Theory branch sells: *your chord stack defines the local key.*
// Notes that are Discord against the song's key stop being Discord when the chord
// you built makes them legal. Each Theory tier widens how far that permission
// reaches. Buying Theory doesn't raise your numbers — it changes what counts as a
// wrong note.
//
//   tier               skill              rule
//   ─────────────────  ─────────────────  ────────────────────────────────────────
//   (none)             —                  Melody judged against the key alone.
//   Chord Tone Pardon  theory_minor       A note LITERALLY sitting in either stack
//                                         is never Discord.
//   Play the Changes   theory_dom7        Pardon extends from the literal stack
//                                         notes to the whole implied chord,
//                                         COMPLETED TO ITS SEVENTH. Stack reads
//                                         C-E-G → maj → maj7 → the ♮7 is clean in
//                                         your melody though you never placed a B.
//                                         (Completing the 7th is the whole tier:
//                                         evaluateChord matches subsets, so the
//                                         "implied chord" of a literal stack adds
//                                         nothing on its own. Power chords are
//                                         excluded — no third, no quality to
//                                         complete.)
//   Extensions         theory_modes       Context grows to the chord's available
//                                         tensions, by quality: ♯4 over major,
//                                         natural 6 over minor, ♭9 and 9 over dom.
//   Approach Notes     theory_chromatic   ANY note is clean if the NEXT note is a
//                                         chord tone of either stack.
//
// Pure module — no game state, no React, no imports beyond pitch lookup and chord
// evaluation. Lives beside chords.js and cadence.js.
//
// ⚠️ THE C4 LANDMINE, RESTATED. The pardon changes **scoring**, not
// **classification**. Nothing in here may be folded back into the caller's
// `currentScale` / `keyScale` before it reaches `detectResolvedDiscords` — that
// detector identifies a Flair spirit's color notes by testing them against the key,
// so widening the key would collapse Flair's earning to zero and make Theory
// investment actively destroy the style it's supposed to reward. Keep `keyScale`
// (what the key + Theory scale-expansion allow) and the context set (what the
// stacks pardon) in separate variables, permanently.
// =============================================================================
import { pitchIndex } from "./notes.js";
import { evaluateChord, CHORD_TEMPLATES } from "./chords.js";

// ── TIER FLAGS ───────────────────────────────────────────────────────────────
// Each tier is checked against its own skill id rather than assuming the ladder
// was bought in order. The tree happens to enforce the order today, but B10 grants
// Cosmic Ronin the `theory_minor` tier for free from turn one — so a spirit can
// legitimately hold a tier without the ones "below" it. Callers grant a free tier
// by appending its id to the list they pass in; there is no second code path.
export const CONTEXT_TIERS = {
  literal:   'theory_minor',
  chord:     'theory_dom7',
  extension: 'theory_modes',
  approach:  'theory_chromatic',
};

// Pardon strength, strongest first. Used to resolve which tier claims a note when
// several could, and to keep B4's routing deterministic.
export const PARDON_ORDER = ['literal', 'chord', 'extension', 'approach'];

function tiersFor(unlockedSkills = []) {
  const u = unlockedSkills instanceof Set ? unlockedSkills : new Set(unlockedSkills || []);
  return {
    literal:   u.has(CONTEXT_TIERS.literal)   || u.has(CONTEXT_TIERS.chord) ||
               u.has(CONTEXT_TIERS.extension) || u.has(CONTEXT_TIERS.approach),
    chord:     u.has(CONTEXT_TIERS.chord)     || u.has(CONTEXT_TIERS.extension) ||
               u.has(CONTEXT_TIERS.approach),
    extension: u.has(CONTEXT_TIERS.extension) || u.has(CONTEXT_TIERS.approach),
    approach:  u.has(CONTEXT_TIERS.approach),
  };
}
// Note the cumulative OR above: a higher tier implies every tier beneath it.
// "Play the Changes" that could not also pardon a note you literally placed would
// be a strict downgrade at the moment of purchase, which is the one thing an
// upgrade may never be.

// ── COMPLETION TO THE SEVENTH (theory_dom7) ──────────────────────────────────
// ⚠️ CORRECTION TO THE B3 SPEC. As written, "Play the Changes" was a no-op.
// The spec's example — "stack reads C-E-G-B♭ → dom7 → the ♭7 is clean even if you
// never placed a B♭" — contradicts itself: `evaluateChord` does SUBSET matching,
// so it only ever returns dom7 when the B♭ is literally in the stack. Across every
// template the implied chord's tones are exactly the stack's literal notes, which
// would make this tier pardon nothing that `theory_minor` didn't already pardon.
//
// Resolution: at this tier a TRIAD implies its natural seventh. That's what
// "playing the changes" actually means — you read the triad in front of you and
// hear the seventh the key supplies. Semitones above the CHORD's root:
const SEVENTH_COMPLETION = {
  maj:  11,   // → maj7   (natural 7th)
  min:  10,   // → min7   (♭7)
  dim:   9,   // → dim7   (♭♭7)
  aug:  10,   // → aug7   (♭7 — the augmented-dominant read)
  sus2: 10,   // → 9sus4-ish; sus chords function dominantly
  sus4: 10,
};
// Deliberately absent: `power`. A power chord has no third, so it has no quality
// to complete — inventing one would hand the ♭7 to the one stack every player
// holds from turn one, which is a far larger grant than this tier is priced for.
// Also absent: the 4-note chords (dom7/maj7/min7/m7b5/dim7) and the 9ths, which
// are already complete. Their reward for this tier is the 4th stack slot.

// ── EXTENSIONS BY QUALITY (theory_modes) ─────────────────────────────────────
// Semitones above the CHORD's root — not the song's root. Deliberately limited to
// the three the design names; every other quality contributes no tensions rather
// than an invented set. dim/aug/sus/power stay at their chord tones, which is also
// what keeps `theory_modes` from quietly pardoning most of the chromatic scale.
const EXTENSIONS = {
  maj:   [6],       // ♯4  — Lydian
  maj7:  [6],
  min:   [9],       // nat 6 — Dorian
  min7:  [9],
  min9:  [9],
  dom7:  [1, 2],    // ♭9 and 9
  dom9:  [1, 2],
};

const TEMPLATE_BY_ID = Object.fromEntries(CHORD_TEMPLATES.map(t => [t.id, t]));

const pcOf = n => (typeof n === 'number' ? ((n % 12) + 12) % 12 : pitchIndex(n));

/** Everything one stack knows how to legalize, split by tier.
 *  Returns { chord, rank, literal:Set, chordTones:Set, extensions:Set }.
 *  `chord` is the evaluateChord result; `rank` is 0 for single/cluster so B4's
 *  "higher rank wins" tie-break has a number to compare on every stack. */
export function stackContext(stack = []) {
  const notes   = (stack || []).filter(Boolean);
  const literal = new Set(notes.map(pcOf).filter(p => p >= 0));
  const chord   = evaluateChord(notes);
  const tpl     = TEMPLATE_BY_ID[chord.id];
  const rank    = tpl ? tpl.rank : 0;

  // Chord tones: a recognized chord contributes its whole implied spelling — its
  // own template degrees PLUS the seventh its quality implies, which is the degree
  // the player never placed. That completion IS "Play the Changes"; see the note on
  // SEVENTH_COMPLETION above for why the template alone isn't enough. A single note
  // or an unrecognized cluster has no implied chord, so it contributes only what is
  // literally there.
  const chordTones = new Set(literal);
  if (tpl && chord.rootPc != null) {
    for (const iv of tpl.ivals) chordTones.add((chord.rootPc + iv) % 12);
    const seventh = SEVENTH_COMPLETION[chord.id];
    if (seventh != null) chordTones.add((chord.rootPc + seventh) % 12);
  }

  const extensions = new Set();
  if (tpl && chord.rootPc != null) {
    for (const iv of (EXTENSIONS[chord.id] || [])) extensions.add((chord.rootPc + iv) % 12);
  }

  return { chord, rank, literal, chordTones, extensions };
}

/** Pitch classes made legal by the stacks, given the player's unlocked tiers.
 *  Returns a Set of pcs. Pure — no game state.
 *
 *  The approach-note tier is NOT represented here and cannot be: it is a
 *  conditional on the *following* note, so it only exists per-position inside a
 *  track. Use `classifyTrack` for scoring. This function is the right one for the
 *  note-stock highlight, where "would this note be clean right now" is the
 *  question — an approach note isn't clean until you commit to landing it. */
export function chordContext(driveStack = [], sustainStack = [], unlockedSkills = []) {
  const t   = tiersFor(unlockedSkills);
  const out = new Set();
  if (!t.literal) return out;   // no tiers → no context, melody judged against the key alone
  for (const stack of [driveStack, sustainStack]) {
    const c = stackContext(stack);
    for (const pc of c.literal) out.add(pc);
    if (t.chord)     for (const pc of c.chordTones) out.add(pc);
    if (t.extension) for (const pc of c.extensions) out.add(pc);
  }
  return out;
}

// Which stack, if either, pardons `pc` at `tier` — and at what rank.
// Returns null, or { stack:'drive'|'sustain', rank }. B4 routes the payout with
// this: legal in both → the stack whose chord has the higher rank, tie to Drive.
function claimAt(pc, tier, dCtx, sCtx) {
  const key = tier === 'literal' ? 'literal' : tier === 'chord' ? 'chordTones' : 'extensions';
  const d = dCtx[key].has(pc);
  const s = sCtx[key].has(pc);
  if (!d && !s) return null;
  if (d && !s)  return { stack: 'drive',   rank: dCtx.rank };
  if (s && !d)  return { stack: 'sustain', rank: sCtx.rank };
  return sCtx.rank > dCtx.rank
    ? { stack: 'sustain', rank: sCtx.rank }
    : { stack: 'drive',   rank: dCtx.rank };   // tie goes to Drive
}

/** Per-note classification for a committed track. One entry per note:
 *    { note, pc, inScale, pardonedBy, stack }
 *  `pardonedBy` ∈ null | 'literal' | 'chord' | 'extension' | 'approach'
 *  `stack`      ∈ null | 'drive' | 'sustain'  — which stack authorized it.
 *
 *  In-scale notes come back as { inScale:true, pardonedBy:null, stack:null }; they
 *  were never Discord, so nobody pardoned them and nobody gets paid for them.
 *  An unpardoned off-scale note is { inScale:false, pardonedBy:null } — that is
 *  the set B7 counts for the Discord penalty.
 *
 *  @param keyScale  Everything legal BEFORE chord context — the playable scale
 *                   PLUS any notes the discord unlocks have already made clean.
 *                   It must match whatever the caller's own `isNotePlayable` says,
 *                   or the live placement counter and the commit score will
 *                   disagree in front of the player. Accepts note names or pcs.
 *                   ⚠️ Never pass a scale that has had the context folded into it. */
export function classifyTrack(track = [], keyScale = [], driveStack = [], sustainStack = [], unlockedSkills = []) {
  const t     = tiersFor(unlockedSkills);
  const scale = new Set((keyScale || []).map(pcOf).filter(p => p >= 0));
  const dCtx  = stackContext(driveStack);
  const sCtx  = stackContext(sustainStack);
  const pcs   = (track || []).map(pcOf);

  return (track || []).map((note, i) => {
    const pc = pcs[i];
    if (pc < 0) return { note, pc, inScale: false, pardonedBy: null, stack: null };
    if (scale.has(pc)) return { note, pc, inScale: true, pardonedBy: null, stack: null };

    for (const tier of ['literal', 'chord', 'extension']) {
      if (!t[tier]) continue;
      const claim = claimAt(pc, tier, dCtx, sCtx);
      if (claim) return { note, pc, inScale: false, pardonedBy: tier, stack: claim.stack };
    }

    // Approach Notes — last, and conditional on the NEXT note landing on a chord
    // tone. Ordering matters: the final note of a track has no `i+1`, so it can
    // never be pardoned this way. That's intended — it pushes players toward
    // resolving rather than trailing off into the chromatic scale.
    if (t.approach && i + 1 < pcs.length) {
      const claim = claimAt(pcs[i + 1], 'chord', dCtx, sCtx);
      if (claim) return { note, pc, inScale: false, pardonedBy: 'approach', stack: claim.stack };
    }

    return { note, pc, inScale: false, pardonedBy: null, stack: null };
  });
}

// ── MODE FROM THE STACK (B8 revision) ────────────────────────────────────────
// The per-turn "declare Major or Minor" prompt asked a music-theory question of
// players who may not have one, every single turn — the root changes each turn, so
// it fires constantly. It also bought less than it looked like it did: at full
// unlock the two branches differ by only ♭3/♭6 (minor-only) against maj3/♯4/maj7
// (major-only), and after B3 the ♭3 is already reachable in major by stacking a
// minor triad and letting Chord Tone Pardon legalize it.
//
// So: the chord decides. This is the same idea as the rest of this module — your
// stack defines the local key — applied to the one remaining place the player was
// being asked to state it out loud. The decision doesn't disappear, it moves into
// the thing they're already manipulating: stack a ♭3 and watch which notes go grey.
const MINOR_QUALITY = new Set(['min', 'min7', 'min9', 'dim', 'dim7', 'm7b5']);
const MAJOR_QUALITY = new Set(['maj', 'maj7', 'dom7', 'dom9', 'aug']);
// Everything else — power, sus2, sus4, single, cluster — is quality-AMBIGUOUS and
// holds the current mode rather than forcing one. A power chord has no third; that
// is precisely why rock leans on it, and the game shouldn't pretend otherwise.

/** The mode implied by the Drive Stack. Pure.
 *  @param currentMode  held when the stack implies nothing (no third to read).
 *  @returns { mode, reason } — `reason` ∈ 'quality' | 'ambiguous' | 'locked'.
 *    'locked' means the stack wants minor but `theory_minor` isn't unlocked yet:
 *    hold major and let the caller say so. That's a far better advertisement for
 *    the skill than a greyed-out button ever was — the player can HEAR the minor
 *    chord and is told the game can't spell it yet. */
export function modeFromStack(driveStack = [], unlockedSkills = [], currentMode = 'major') {
  const u  = unlockedSkills instanceof Set ? unlockedSkills : new Set(unlockedSkills || []);
  const id = evaluateChord((driveStack || []).filter(Boolean)).id;
  if (MINOR_QUALITY.has(id)) {
    return u.has('theory_minor')
      ? { mode: 'minor',    reason: 'quality' }
      : { mode: 'major',    reason: 'locked'  };
  }
  if (MAJOR_QUALITY.has(id)) return { mode: 'major', reason: 'quality' };
  return { mode: currentMode, reason: 'ambiguous' };
}

/** Convenience readers over a classifyTrack result — so B4, B5 and B7 all count
 *  from the same single pass instead of re-deriving the pardon three times. */
export function countUnpardoned(classified = []) {
  return classified.filter(c => !c.inScale && c.pardonedBy === null).length;
}
export function countPardonedByStack(classified = []) {
  let drive = 0, sustain = 0;
  for (const c of classified) {
    if (c.pardonedBy === null) continue;
    if (c.stack === 'drive')   drive++;
    else if (c.stack === 'sustain') sustain++;
  }
  return { drive, sustain };
}
