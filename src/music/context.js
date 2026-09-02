// =============================================================================
// music/context.js  —  THE CHORD CONTEXT LADDER (THEORY_REWRITE_LOG B3)
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

// ── 🅱️ THE GATE CAME OFF — 2026-09-02 ────────────────────────────────────────
//
// The four tiers used to be `theory_minor` / `theory_dom7` / `theory_modes` /
// `theory_chromatic`, bought in that order for 46 Db. The Theory branch is
// deleted (`PROGRESSION_REWRITE_DESIGN.md` §3) and **the whole ladder is now
// universal and free, from turn one, for everybody.**
//
// 🎯 THE MECHANIC IS NOT WHAT WAS DELETED — THE PRICE TAG IS. "Your chord decides
// which notes are legal" is the best idea in the game and it survives intact:
// chord-tone pardon, play the changes, extensions and approach notes all still
// work exactly as documented above, and the red/blue colouring in the note stock
// (`contextClaim`) now returns a real answer for every Spirit instead of `null`
// for anyone who had not bought the first rung.
//
// 📌 THIS IS A SMALLER CHANGE THAN IT SOUNDS, and that was the design's bet:
// everything already routed through one function, so one function is all that
// changed. `CONTEXT_TIERS` is kept as documentation of which rung was which,
// because five other files' comments still name those ids.
export const CONTEXT_TIERS = {
  literal:   'theory_minor',
  chord:     'theory_dom7',
  extension: 'theory_modes',
  approach:  'theory_chromatic',
};

// Pardon strength, strongest first. Used to resolve which tier claims a note when
// several could, and to keep B4's routing deterministic.
export const PARDON_ORDER = ['literal', 'chord', 'extension', 'approach'];

// ⚠️ EVERY TIER, UNCONDITIONALLY. The frozen object is deliberate: this used to be
// per-caller state and is now a constant, and a caller that tries to switch a tier
// off should fail rather than quietly succeed for one Spirit.
const ALL_TIERS = Object.freeze({ literal: true, chord: true, extension: true, approach: true });

// ⚠️ THE ARGUMENT IS GONE, NOT IGNORED. `tiersFor(unlockedSkills)` with the list
// still threaded through would have kept compiling forever while meaning nothing,
// and the `unlockedSkills` parameter would have rotted in six public signatures.
// It is removed from those signatures too — see `chordContext`, `contextClaim` and
// `classifyTrack` below.
function tiersFor() {
  return ALL_TIERS;
}

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
 *  Returns { chord, rank, literal:Set, tones:Set, chordTones:Set, extensions:Set }.
 *  `chord` is the evaluateChord result; `rank` is 0 for single/cluster so B4's
 *  "higher rank wins" tie-break has a number to compare on every stack. */
export function stackContext(stack = []) {
  const notes   = (stack || []).filter(Boolean);
  const literal = new Set(notes.map(pcOf).filter(p => p >= 0));
  const chord   = evaluateChord(notes);
  const tpl     = TEMPLATE_BY_ID[chord.id];
  const rank    = tpl ? tpl.rank : 0;

  // `tones` — what the chord ACTUALLY IS: the notes placed plus the rest of its
  // own template. No implied seventh, no tensions. This is the set B5's Harmonic
  // Lock reads, because "land on the chord" has to mean the chord itself. A maj
  // triad's ♮7 is something the triad *implies*; landing on it is not landing on
  // the triad, and paying the escalation for it would let the player collect on a
  // chord they didn't build.
  const tones = new Set(literal);
  if (tpl && chord.rootPc != null) {
    for (const iv of tpl.ivals) tones.add((chord.rootPc + iv) % 12);
  }

  // `chordTones` — the PARDON set, one tier wider than `tones`: the template
  // degrees PLUS the seventh the quality implies, i.e. the degree the player never
  // placed. That completion IS "Play the Changes"; see the note on
  // SEVENTH_COMPLETION above for why the template alone isn't enough. A single note
  // or an unrecognized cluster has no implied chord, so it contributes only what is
  // literally there.
  const chordTones = new Set(tones);
  if (tpl && chord.rootPc != null) {
    const seventh = SEVENTH_COMPLETION[chord.id];
    if (seventh != null) chordTones.add((chord.rootPc + seventh) % 12);
  }

  const extensions = new Set();
  if (tpl && chord.rootPc != null) {
    for (const iv of (EXTENSIONS[chord.id] || [])) extensions.add((chord.rootPc + iv) % 12);
  }

  return { chord, rank, literal, tones, chordTones, extensions };
}

/** Pitch classes made legal by the stacks, given the player's unlocked tiers.
 *  Returns a Set of pcs. Pure — no game state.
 *
 *  The approach-note tier is NOT represented here and cannot be: it is a
 *  conditional on the *following* note, so it only exists per-position inside a
 *  track. Use `classifyTrack` for scoring. This function is the right one for the
 *  note-stock highlight, where "would this note be clean right now" is the
 *  question — an approach note isn't clean until you commit to landing it. */
export function chordContext(driveStack = [], sustainStack = []) {
  const t   = tiersFor();
  const out = new Set();
  for (const stack of [driveStack, sustainStack]) {
    const c = stackContext(stack);
    for (const pc of c.literal) out.add(pc);
    if (t.chord)     for (const pc of c.chordTones) out.add(pc);
    if (t.extension) for (const pc of c.extensions) out.add(pc);
  }
  return out;
}

// Which stack, if either, pardons `pc` at `tier` — and at what rank.
// Returns null, or { stack:'drive'|'sustain', rank, both }. B4 routes the payout
// with this: legal in both → the stack whose chord has the higher rank, tie to
// Drive.
//
// `both` is the DUAL-LEGAL flag: true when Drive and Sustain each legalize this
// pitch independently at this tier. The winner above is then only a *default* —
// the note stock renders these alternating red/blue, and the player may hand the
// payout to either stack at commit (see `classifyTrack`'s `routing` argument).
// Without this flag the two stacks are indistinguishable downstream, because the
// tie-break has already thrown the loser away.
function claimAt(pc, tier, dCtx, sCtx) {
  const key = tier === 'literal' ? 'literal' : tier === 'chord' ? 'chordTones' : 'extensions';
  const d = dCtx[key].has(pc);
  const s = sCtx[key].has(pc);
  if (!d && !s) return null;
  if (d && !s)  return { stack: 'drive',   rank: dCtx.rank, both: false };
  if (s && !d)  return { stack: 'sustain', rank: sCtx.rank, both: false };
  return sCtx.rank > dCtx.rank
    ? { stack: 'sustain', rank: sCtx.rank, both: true }
    : { stack: 'drive',   rank: dCtx.rank, both: true };   // tie goes to Drive
}

/** Who pardons a single pitch class, right now, at the player's tiers — the
 *  note-stock highlight's counterpart to `chordContext`.
 *
 *  `chordContext` answers "is this note clean?" and flattens everything into one
 *  Set; that was enough while the highlight was a single gold. It isn't enough to
 *  paint Drive red and Sustain blue, and re-deriving the attribution in the UI
 *  would be the classic way for the color to drift out of sync with the payout.
 *  So this walks the same tier ladder, in the same order, through the same
 *  `claimAt` — the hex and the Db it earns cannot disagree by construction.
 *
 *  @returns null | { stack:'drive'|'sustain', tier:'literal'|'chord'|'extension', both:boolean }
 *
 *  Approach Notes are deliberately absent, for the reason given on `chordContext`:
 *  that tier is a conditional on the note you play NEXT, so it has no meaning for a
 *  hex sitting unplayed in the stock. */
export function contextClaim(pc, driveStack = [], sustainStack = []) {
  const t = tiersFor();
  const dCtx = stackContext(driveStack);
  const sCtx = stackContext(sustainStack);
  for (const tier of ['literal', 'chord', 'extension']) {
    if (!t[tier]) continue;
    const claim = claimAt(pc, tier, dCtx, sCtx);
    if (claim) return { stack: claim.stack, tier, both: claim.both };
  }
  return null;
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
 *  Entries also carry `both:true` when Drive and Sustain each legalize the note on
 *  their own. Those are the notes the stock shows alternating red/blue and the ones
 *  `routing` is allowed to move.
 *
 *  @param routing   Optional { [trackIndex]: 'drive' | 'sustain' } — the player's
 *                   commit-time payout choice for DUAL-LEGAL notes. Ignored for any
 *                   index that isn't `both`, so a routing map can never hand Db to a
 *                   stack that didn't authorize the note; the worst a stale or
 *                   malformed map can do is nothing. Omit it and this function
 *                   behaves exactly as it did before the choice existed — the
 *                   `claimAt` tie-break stands as the default.
 *  @param keyScale  Everything legal BEFORE chord context — the playable scale
 *                   PLUS any notes the discord unlocks have already made clean.
 *                   It must match whatever the caller's own `isNotePlayable` says,
 *                   or the live placement counter and the commit score will
 *                   disagree in front of the player. Accepts note names or pcs.
 *                   ⚠️ Never pass a scale that has had the context folded into it. */
export function classifyTrack(track = [], keyScale = [], driveStack = [], sustainStack = [], routing = {}) {
  const t     = tiersFor();
  const scale = new Set((keyScale || []).map(pcOf).filter(p => p >= 0));
  const dCtx  = stackContext(driveStack);
  const sCtx  = stackContext(sustainStack);
  const pcs   = (track || []).map(pcOf);
  // The player's pick only ever *replaces a default*, never creates a pardon. A
  // note is routable strictly because both stacks already legalized it, so this
  // reads as "which of the two that earned it gets paid" — never "which stack do I
  // feel like paying." Anything outside that is dropped on the floor.
  const routed = (i, claim) => {
    const pick = routing?.[i];
    return claim.both && (pick === 'drive' || pick === 'sustain') ? pick : claim.stack;
  };

  return (track || []).map((note, i) => {
    const pc = pcs[i];
    if (pc < 0) return { note, pc, inScale: false, pardonedBy: null, stack: null, both: false };
    if (scale.has(pc)) return { note, pc, inScale: true, pardonedBy: null, stack: null, both: false };

    for (const tier of ['literal', 'chord', 'extension']) {
      if (!t[tier]) continue;
      const claim = claimAt(pc, tier, dCtx, sCtx);
      if (claim) return { note, pc, inScale: false, pardonedBy: tier, stack: routed(i, claim), both: claim.both };
    }

    // Approach Notes — last, and conditional on the NEXT note landing on a chord
    // tone. Ordering matters: the final note of a track has no `i+1`, so it can
    // never be pardoned this way. That's intended — it pushes players toward
    // resolving rather than trailing off into the chromatic scale.
    if (t.approach && i + 1 < pcs.length) {
      const claim = claimAt(pcs[i + 1], 'chord', dCtx, sCtx);
      if (claim) return { note, pc, inScale: false, pardonedBy: 'approach', stack: routed(i, claim), both: claim.both };
    }

    return { note, pc, inScale: false, pardonedBy: null, stack: null, both: false };
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
 *  @returns { mode, reason } — `reason` ∈ 'quality' | 'ambiguous'.
 *
 *  🪦 `reason: 'locked'` IS GONE (2026-09-02). It meant "your stack wants minor but
 *  you have not bought `theory_minor`", and it was the one place the game could
 *  advertise the branch — the player heard the minor chord and was told the game
 *  could not spell it yet. There is nothing left to sell: stack a minor third and
 *  the song follows you, from turn one, for everybody. ⚠️ A caller still branching
 *  on 'locked' is now dead code — that branch can never be taken again. */
export function modeFromStack(driveStack = [], currentMode = 'major') {
  const id = evaluateChord((driveStack || []).filter(Boolean)).id;
  if (MINOR_QUALITY.has(id)) return { mode: 'minor', reason: 'quality' };
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

// ── B5: HARMONIC LOCK (the Db escalation) ────────────────────────────────────
// B2 cut the ending bonus roughly in half (5th end +3, 4th +2, octave +1) so that
// Db income came from playing well rather than from turning up. Harmonic Lock is
// where the other half comes back — but only for a player who built something and
// then landed on it.
//
//   rank ≤ 4  (triads, sus, power)  → +0
//   rank 5    (dim, aug)            → +1
//   rank ≥ 6  (7ths, 9ths)          → +2
//
// So a 5th ending into a dom9 stack is 3 + 2 = 5 Db — about the pre-B2 value,
// earned instead of baseline. This replaces v1's Harmonic Resonance I/II, which
// paid a flat +1 for merely HAVING a recognized chord; after Task A that's true
// almost always, making it a stat bump wearing a mechanic's clothes.
//
// Two deliberate restrictions:
//  • Single notes and unrecognized clusters are rank 0 and pay nothing. You cannot
//    collect for landing on a note you happen to be holding.
//  • The test is `tones`, NOT `chordTones` — the chord itself, without the seventh
//    its quality implies. Landing on a maj triad's ♮7 is not landing on the triad.
//    (It's also why this function takes no `unlockedSkills`: Harmonic Lock reads
//    what the stack IS, which no tier changes. The pardon ladder is a separate
//    question, already answered by classifyTrack.)
//
// ⚠️ TRIADS PAY. This band table used to read `rank >= 6 ? 2 : rank === 5 ? 1 : 0`,
// which meant **major and minor triads — rank 4 — earned nothing.** The one
// mechanic in the game built to reward "you built a chord and landed the line on
// it" ignored the two most common and most musical chords there are. Worse, the
// stack cap is 3 until Blues/Dominant 7th is bought, so a triad is the *only* thing
// a new player can build: Harmonic Lock was unreachable for the entire early game
// and measured a flat 0.00 across the first three Theory tiers.
//
// Now rank 4 (maj/min triad) and rank 5 (dim/aug) pay 1, rank 6–7 (sevenths and
// ninths) pay 2, and rank 8 — the 6-note 13th and 11th chords, reachable only at
// the Theory capstone — pays 3. Build a clean triad, land the line on it, get paid,
// from turn one; and the ladder now slopes all the way to the top instead of
// flattening out at the sevenths.
const LOCK_BONUS_BY_RANK = rank => (rank >= 8 ? 3 : rank >= 6 ? 2 : rank >= 4 ? 1 : 0);

/** B5 — the ending escalation for landing on a stack's chord. Pure.
 *  @param lastNote  the melody's FINAL note (name or pc). Caller must only apply
 *                   this to a track that already earned an ending bonus.
 *  @returns { bonus, stack, rank, chordName } — `stack` is null when nothing
 *           claims the note, and `bonus` is 0 whenever rank < 5.
 *
 *  Stack selection reuses B4's rule exactly: higher rank wins, ties go to Drive.
 *  One tie-break for the whole feature set — if you change it, change `claimAt`
 *  and this together, and update both sets of assertions in b0check. */
export function harmonicLock(lastNote, driveStack = [], sustainStack = []) {
  const pc = pcOf(lastNote);
  const none = { bonus: 0, stack: null, rank: 0, chordName: null };
  if (pc < 0) return none;

  const d = stackContext(driveStack);
  const s = stackContext(sustainStack);
  const dHas = d.rank > 0 && d.tones.has(pc);
  const sHas = s.rank > 0 && s.tones.has(pc);
  if (!dHas && !sHas) return none;

  // Higher rank wins; a tie goes to Drive. Note the bonus is identical on a true
  // tie (same rank → same band), so this only decides which chord gets NAMED —
  // but the flash line cites it, so it still has to be deterministic.
  const pick = (dHas && sHas)
    ? (s.rank > d.rank ? { c: s, stack: 'sustain' } : { c: d, stack: 'drive' })
    : dHas ? { c: d, stack: 'drive' } : { c: s, stack: 'sustain' };

  return {
    bonus:     LOCK_BONUS_BY_RANK(pick.c.rank),
    stack:     pick.stack,
    rank:      pick.c.rank,
    chordName: pick.c.chord.name ?? pick.c.chord.label ?? pick.c.chord.id ?? null,
  };
}

// ── B6: THE CHROMATIC RUN'S Db PAYOUT — DELETED ─────────────────────────────
// `chromaticPayout` and its CHROM_BASE/CHROM_CAP/CHROM_MIN_RUN curve lived here.
// It paid +3 Db for a chromatic run of 3, +1 per note beyond, capped at +5, and it
// was sold as the loudest thing at the top of the Theory ladder.
//
// It fired on 1% OF COMMITS, worth 0.02 Db each across 15,000 simulated commits.
// A chromatic run eats 3+ of your 8 melody slots and the note stock you'd spend
// building stacks, so almost nobody ever played one — the "intrinsic risk" the
// design leaned on turned out to be a deterrent, not a gradient. 16 Db of skill
// ladder bought a payout the player would essentially never see.
//
// Chromatic Mastery now sells the sixth stack slot instead, which is the lever the
// audit showed actually moves the ladder (Harmonic Lock climbs 0.00 → 0.83 Db on
// slots alone). The run itself still lands: `detectChromaticRun` survives in
// cadence.js and still flips `allInScale`, which feeds `gainFans`. A chromatic
// smear now reads to the CROWD as showmanship — which is where flair belongs, now
// that Db pays only for facts.

// ── B7: THE DISCORD PENALTY, PER NOTE ────────────────────────────────────────
// It used to be a flat −1 for the whole track no matter how many notes were wrong.
// That made the entire pardon economy worth at most one point — the tree would be
// selling a 46-Db ladder to dodge a one-point tax. Now each wrong note costs, with
// two guard rails:
//
//   penalty = min(3, max(0, unpardoned − 1))
//
//  • THE FIRST DISCORD IS FREE, and the grace is load-bearing. A strong track
//    under B2+B5 is worth ~5 Db. Without the grace, one grey note a player hasn't
//    learned to see yet takes 20% of the turn; `freestylePardon` (Intergalactic 0)
//    already established the "one pardoned wrong note" pattern and this
//    generalizes it to everyone.
//  • THE FLOOR IS 3, so a genuinely lost track loses most of a turn but never
//    goes negative-spiral. Db is already floored at 0 downstream.
//
// Count from `classifyTrack`, never from the placement-time `discordCount`: at
// `theory_chromatic` the Approach Notes tier can only be resolved once the NEXT
// note is known, so placement over-counts. The placement counter stays as live UI
// feedback and the two legitimately disagree at that one tier.
const DISCORD_GRACE = 1, DISCORD_FLOOR = 3;

/** B7 — per-note discord penalty. Pure.
 *  @param unpardoned  count of notes that are off-scale AND unpardoned, i.e.
 *                     `countUnpardoned(classifyTrack(...))`, with any
 *                     spirit-specific pardon (freestyle) already subtracted.
 *  @returns the Db to deduct: 0, 1, 2 or 3. */
export function discordPenaltyFor(unpardoned = 0) {
  const n = Number.isFinite(unpardoned) ? Math.floor(unpardoned) : 0;
  return Math.min(DISCORD_FLOOR, Math.max(0, n - DISCORD_GRACE));
}
