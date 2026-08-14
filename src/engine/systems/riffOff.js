// ─── ENGINE SYSTEM: RIFF-OFF ─────────────────────────────────────────────────
// Phase 4: the multiplayer seam for the falling-notes duel. The engine owns
// the riff DATA and the VERDICT; each client performs locally (gems, timing,
// keystrokes, beam-clash cinematics stay 100% client) and submits a results
// array [{hit, rt, grade, noteIdx}] — exactly how networked riff-offs will
// work. Damage application is combat (Phase 3) and stays client for now.

import {
  generateAttackerRiff, generateDefenderRiff, speedUpRiffRhythm,
  riffDegreesToNotes, RIFF_LEN_DEFAULT,
} from "../../riff/riffGeneration.js";
import { melodyToRiff } from "../../riff/melodyRiff.js";
import { voiceRiff, degreePitch } from "../../riff/guitarMap.js";
import { applyPerformance, applyChords } from "../../riff/riffPerformance.js";
import { marginToDamage } from "./combat.js";

// Grade → weight for the performance score (single source of truth; the
// client imports riffStats from here for its live overlay too).
export const RIFF_GRADE_WEIGHT = { perfect: 1.0, good: 0.7, ok: 0.45, miss: 0, wrong: 0 };
export const RIFF_MARGIN_SCALE = 2.6; // margin = round(scoreGap × this)
export const RIFF_TIE_EPS      = 0.4; // score gaps below this are "too close to call"

// ── HOW CLOSE IS "TOO CLOSE TO END IT"? ──────────────────────────────────────
// The Round-2 gate. A Round-1 win only ENDS the duel if the winner out-played
// the loser by this many percentage points of clean quality; anything tighter
// locks the beams and forces sudden death.
//
// Why quality and not `margin`: margin is a scaled score gap, so the same
// performance gap produces a different margin at 6 notes than at 16 — the old
// `margin >= 3` gate meant a Virtuoso duel escalated far more readily than an
// Influencer one, for no reason a player could see. Quality is already
// normalised per note (score ÷ notes), so 20 points reads the same at every
// tier: about one clean note in five. Below that, the crowd can't call it and
// the beams surge.
export const RIFF_CLOSE_QUALITY_GAP = 20;

/** Was this round close enough that Round 1 can't end the duel? */
export function riffIsClose(atkStats, defStats) {
  const gap = Math.abs((atkStats?.quality ?? 0) - (defStats?.quality ?? 0));
  return gap < RIFF_CLOSE_QUALITY_GAP;
}

// ── WHEN BOTH SIDES GET PAID ─────────────────────────────────────────────────
// A duel that survives to the end of Round 2 with both performers above this
// quality bar pays BOTH of them Fame. Losing a great duel is not the same as
// being outclassed, and the crowd knows it — but there is still a winner, and
// they still take home more (see `awardRiffFame`).
export const RIFF_BOTH_PAID_QUALITY = 75;

// Riff note token pool (mirrors riffGeneration's naturals/sharpables — kept
// here so the engine never imports the Web-Audio module).
const RIFF_NATURALS  = ["a", "b", "c", "d", "e", "f", "g"];
const RIFF_SHARPABLE = new Set(["a", "c", "d", "f", "g"]);

/** Grade-weighted performance stats for one submitted results array. */
export function riffStats(results) {
  const hits  = results.filter(r => r.hit).length;
  const rts   = results.filter(r => r.hit).map(r => r.rt);
  const avgRt = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null;
  const score = results.reduce((a, r) => a + (RIFF_GRADE_WEIGHT[r.grade] ?? 0), 0);
  const perfects = results.filter(r => r.grade === "perfect").length;
  const quality  = results.length ? Math.round((score / results.length) * 100) : 0;
  return { hits, avgRt, score: Math.round(score * 100) / 100, perfects, quality };
}

/** Riff Slayer: pick 2–3 defender note indexes to glitch mid-flight.
 *  Chord notes are exempt (`chordOf`): lurching either half of a power chord
 *  mid-fall leaves a pair that is no longer a fifth and no longer adjacent —
 *  the gesture the chart is asking for stops existing, which is a different
 *  (and unfair) thing from making a note harder to read. */
function pickGlitchIndexes(defLen, rng, chordOf = null) {
  const glitchN = 2 + Math.floor(rng() * 2); // 2 or 3
  const inChord = new Set();
  (chordOf ?? []).forEach((root, i) => {
    if (root != null) { inChord.add(i); inChord.add(root); }
  });
  const idxPool = Array.from({ length: defLen }, (_, i) => i).filter(i => !inChord.has(i));
  for (let i = idxPool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idxPool[i], idxPool[j]] = [idxPool[j], idxPool[i]];
  }
  return idxPool.slice(0, Math.min(glitchN, defLen)).sort((a, b) => a - b);
}

/** E-Rush: a ghost key per answer note — any pool letter ≠ the real one. */
function pickGhostLetters(notes, rng) {
  const pool = [];
  RIFF_NATURALS.forEach(n => {
    pool.push(n);
    if (RIFF_SHARPABLE.has(n)) pool.push(n.toUpperCase());
  });
  return notes.map(n => {
    const choices = pool.filter(x => x !== n);
    return choices[Math.floor(rng() * choices.length)] ?? n;
  });
}

// ── THE FIFTH, IN DEGREES ────────────────────────────────────────────────────
// Riff notes are scale degrees, not semitones, so a chord partner needs a
// DEGREE that happens to sit a perfect fifth above its root. Four scale steps
// up is a perfect fifth from every degree but the seventh, where it collapses
// to a tritone — and a sharp on the root does not always survive the move
// (a♯ + 4 steps lands on e, which has no sharp, so the interval shrinks).
//
// Rather than special-case that, just ASK: build the candidate and keep it only
// if it really is seven semitones. Anything else refuses the chord, which is
// the honest outcome — a power chord that isn't a fifth isn't a power chord.
const FIFTH_STEPS = 4;
function fifthOf(degree, sharp) {
  const d2 = degree + FIFTH_STEPS;
  return degreePitch(d2, sharp) - degreePitch(degree, sharp) === 7
    ? { degree: d2, sharp: !!sharp } : null;
}

/**
 * Build the full PERFORMED chart for one side's riff: melodic direction (the
 * arrow the highway draws), sustains, bends, and two-note power chords.
 *
 * Returns a REPLACEMENT for the riff's note arrays, because chords INSERT
 * notes. Every index-keyed array has to grow together or `noteIdx` — the key
 * that results, scoring, ghost arrays and glitch indexes are all built against
 * — starts pointing at the wrong gem. That coupling is why chords sat out of
 * riff-offs until now; the fix is to expand degrees, sharps, rhythm and perf in
 * one place and derive everything else downstream of it.
 *
 * ⚠️ ORDER MATTERS. Call this AFTER `generateDefenderRiff` (the answer is
 * derived from the attacker's bare call, not from its chords) and BEFORE
 * anything that reads `degrees.length` — glitch indexes, ghost letters, the
 * client's note/freq arrays.
 *
 * `perf` now also carries `string`/`fret`. It has to: a chord partner is voiced
 * onto the adjacent string by the chord pass itself, and re-running `voiceRiff`
 * on the expanded degrees would voice the two notes of a chord SEQUENTIALLY —
 * quite possibly onto the same string, which is unplayable at a shared hit
 * time. The chart's positions are authoritative; `voiceRiff` is still used for
 * the camera anchors, which are per-phrase and unaffected.
 */
function performanceFor(riff, rng) {
  const voicing = voiceRiff(riff.degrees, riff.sharps, riff.rhythm);
  const notes = riff.degrees.map((d, i) => {
    const [string, fret] = voicing?.positions?.[i] ?? [0, 0];
    const sharp = !!riff.sharps?.[i];
    return {
      degree: d, sharp,
      pitch: degreePitch(d, sharp),
      string, fret,
      accent: (riff.rhythm?.[i]?.feel ?? 'steady') !== 'rushed',
      beat: riff.rhythm?.[i] ?? null,
    };
  });

  const played = applyPerformance(notes, rng);
  // 🤘 TWO-NOTE CHORDS — the same pass the practice highway runs, so a riff-off
  // asks for exactly what Riff Practice teaches. `times` is a throwaway here:
  // the client builds the real timeline from the rhythm, and reads `chordOf` to
  // give a partner its root's hit-time to the millisecond.
  applyChords(played, played.map((_, i) => i), rng, {
    eligible: n => fifthOf(n.degree, n.sharp) != null,
    partnerFields: n => fifthOf(n.degree, n.sharp),
  });

  return {
    degrees: played.map(n => n.degree),
    sharps:  played.map(n => n.sharp),
    rhythm:  played.map(n => n.beat ?? { gapBefore: undefined, feel: 'steady' }),
    perf: played.map(n => ({
      dir: n.dir, chugPart: !!n.chugPart, sustain: n.sustain,
      bend: n.bend, bendDir: n.bendDir, bendAmt: n.bendAmt,
      bendAt: n.bendAt, bendWeight: n.bendWeight,
      string: n.string, fret: n.fret,
      hasPartner: !!n.hasPartner, partnerOf: n.partnerOf ?? null,
    })),
    // Index-aligned: null, or the index of the root this note is chorded to.
    // The client's timeline reads it to pin a partner onto its root's instant.
    chordOf: played.map(n => n.partnerOf ?? null),
  };
}

/** RIFF_OFF_STARTED — generate both riffs + skill modifiers on engine rng.
 *  When melodyLine is provided (Phase R1), the attacker's riff is built from
 *  their committed melody instead of randomly generated. If the melody is too
 *  short (<4 notes), falls back to a random riff (reduced-pot flag set). */
export function applyRiffOffStarted(state, { attackerId, defenderId, slayer, eRush, melodyLine, hasRiff, maxLen }, rng) {
  const len = Math.max(4, maxLen ?? RIFF_LEN_DEFAULT);
  let atk;
  let fromMelody = false;
  if (melodyLine && melodyLine.length >= 4) {
    // targetLen: full tier length — short melodies get padded with passing
    // tones (melodyRiff.js) so a melody-built riff is as EPIC as a random one
    atk = melodyToRiff(melodyLine, { rand: rng, targetLen: len });
  }
  if (atk) {
    fromMelody = true;
  } else {
    // No melody or minimum-material rule failed — random riff at tier length
    atk = generateAttackerRiff(rng, len);
  }
  // The ANSWER is derived from the bare call — before chords, sustains or bends
  // decorate it. `generateDefenderRiff` transforms a melodic line (inverts it,
  // modulates it, resolves it); handing it a chart with power chords already
  // spliced in would have it answering the harmony instead of the melody.
  const def = generateDefenderRiff(atk, rng);

  // 🎸 PERFORMANCE — which notes ring, which ones bend, and how hard.
  //
  // This MUST happen here, on the engine's seeded rng, not on the client at
  // render time: in a multiplayer riff-off both players have to be handed the
  // identical chart, or they're performing different riffs and the verdict
  // means nothing. Same reason the riffs themselves are generated here.
  //
  // voiceRiff has no RNG (GUITAR_NECK_HANDOFF §0.3), so calling it here and
  // again on the client yields the same positions — but positions now come off
  // `perf` regardless, because chord partners are voiced by the chord pass.
  //
  // performanceFor REPLACES the note arrays (chords insert notes), so both
  // riffs are rebuilt from its output before anything reads their length.
  const atkChart = performanceFor(atk, rng);
  const defChart = performanceFor(def, rng);
  const atkFull = { ...atk, ...atkChart };
  const defFull = { ...def, ...defChart };
  // ⚠️ Derived from the EXPANDED chart — glitch indexes and ghost letters are
  // keyed by noteIdx, so building them off the pre-chord arrays would aim them
  // at the wrong gems (and, past the old length, at gems that don't exist).
  const defNotes = riffDegreesToNotes(defFull.degrees, defFull.sharps);
  return {
    ...state,
    battle: {
      kind: "riffOff",
      // (The Phase R4 'acoustic' | 'stadium' tier is GONE — the Acoustic Duel
      // was cut, so every riff-off is the plugged-in, beam-crossed duel.)
      attackerId, defenderId,
      round: 1,
      atkRiff: atkFull,                // {degrees, sharps, contour, rhythm, perf, chordOf}
      defRiff: defFull,                // {degrees, sharps, kind, rhythm, perf, chordOf}
      fromMelody,                      // true when the riff came from the player's melody
      hasRiff: !!hasRiff,              // legendary riff detected on the melody — bonus pot
      defGlitch: slayer ? pickGlitchIndexes(defFull.degrees.length, rng, defFull.chordOf) : [],
      defGhosts: eRush ? pickGhostLetters(defNotes, rng) : null,
      atkResults: null, defResults: null,
      r1: null,
      verdict: null,
    },
  };
}

/** RIFF_RESULTS_SUBMITTED — a performer's results array arrives. */
export function applyRiffResultsSubmitted(state, { role, results }) {
  if (state.battle?.kind !== "riffOff") return state;
  const key = role === "attacker" ? "atkResults" : "defResults";
  return { ...state, battle: { ...state.battle, [key]: results } };
}

/**
 * RIFF_RESOLVED — the verdict. Pure math over the two submitted results
 * arrays (extracted verbatim from Game.riffResolve): quality gap decides;
 * near-mirrors fall to reaction time; Round 2 is sudden death with a
 * fallback to Round 1's edge; only a double dead-heat ties.
 */
export function applyRiffResolved(state) {
  const b = state.battle;
  if (b?.kind !== "riffOff" || !b.atkResults || !b.defResults) return state;
  const round = b.round ?? 1;
  const A = riffStats(b.atkResults);
  const D = riffStats(b.defResults);
  let attackerWon = false, margin = 0, tie = false, decidedBy = "performance";
  const scoreGap = Math.abs(A.score - D.score);
  if (scoreGap >= RIFF_TIE_EPS) {
    attackerWon = A.score > D.score;
    margin = Math.max(1, Math.round(scoreGap * RIFF_MARGIN_SCALE));
  } else if (A.score === 0 && D.score === 0) {
    tie = true;
  } else if (A.avgRt != null && D.avgRt != null && A.avgRt !== D.avgRt) {
    decidedBy   = "reaction";
    attackerWon = A.avgRt < D.avgRt;
    margin      = Math.abs(A.avgRt - D.avgRt) >= 150 ? 2 : 1;
  } else if (A.score !== D.score) {
    attackerWon = A.score > D.score;
    margin = 1;
  } else {
    tie = true;
  }
  if (round >= 2) {
    if (tie && !b.r1?.tie) {
      tie = false;
      attackerWon = !!b.r1?.won;
      decidedBy = "Round 1 edge";
      margin = Math.max(1, b.r1?.margin ?? 1);
    }
    if (!tie) { margin += 1; decidedBy += " · Round 2"; }
  }
  // Damage the winning riff deals — computed HERE (single source) so the client
  // reads verdict.damage instead of re-deriving it (Phase 3e). A tie deals none;
  // Round 2 hits one band harder (verbatim from the old Game.riffResolve).
  const damage = tie ? 0 : marginToDamage(margin + (round >= 2 ? 1 : 0));
  // `close` is the Round-2 gate, decided HERE (engine, single source) rather
  // than re-derived by the client's beam-clash code — in a networked duel both
  // peers must agree on whether the beams break or surge.
  const qualityGap = Math.abs(A.quality - D.quality);
  const close = tie || riffIsClose(A, D);
  // `bothStrong` — did BOTH sides play well, all the way through sudden death?
  // Read by the payout (awardRiffFame) so a hard-fought duel pays the loser too.
  // Round 2 is part of the condition, not an extra check bolted on at the payout
  // site: the whole idea is that surviving a second round together is what makes
  // the losing set worth paying for.
  const bothStrong = round >= 2
    && A.quality >= RIFF_BOTH_PAID_QUALITY && D.quality >= RIFF_BOTH_PAID_QUALITY;
  const verdict = {
    round, attackerWon, margin, tie, decidedBy, damage,
    atkStats: A, defStats: D, qualityGap, close, bothStrong,
  };
  return {
    ...state,
    battle: {
      ...b,
      verdict,
      r1: round === 1 ? { won: attackerWon, tie, margin } : b.r1,
    },
  };
}

/** RIFF_ROUND2_STARTED — sudden death: fresh riffs, faster (0.58×), rerolled skill mods. */
export function applyRiffRound2Started(state, _action, rng) {
  const b = state.battle;
  if (b?.kind !== "riffOff") return state;
  // Keep the tier's riff length for sudden death. Measure it off the ROUND-1
  // chart's root notes, not its raw length — that length now includes chord
  // partners, and feeding it back in would grow the riff every round.
  const r1Len = (b.atkRiff?.chordOf ?? []).length
    ? b.atkRiff.chordOf.filter(c => c == null).length
    : (b.atkRiff?.degrees?.length ?? RIFF_LEN_DEFAULT);
  const atk = generateAttackerRiff(rng, r1Len);
  const def = generateDefenderRiff(atk, rng);
  // Round 2 is a full performance too — sustains, bends and chords included.
  // It previously shipped bare note arrays with no `perf` at all, so sudden
  // death was mechanically SIMPLER than the round that led to it.
  const atkFull = { ...atk, ...performanceFor(atk, rng) };
  const defFull = { ...def, ...performanceFor(def, rng) };
  const speed = r => ({ ...r, origRhythm: r.rhythm, rhythm: speedUpRiffRhythm(r.rhythm, 0.58) });
  const defNotes = riffDegreesToNotes(defFull.degrees, defFull.sharps);
  return {
    ...state,
    battle: {
      ...b,
      round: 2,
      atkRiff: speed(atkFull),
      defRiff: speed(defFull),
      // Riff Slayer / E-Rush carry into Round 2 if active in Round 1
      defGlitch: (b.defGlitch?.length ?? 0) > 0
        ? pickGlitchIndexes(defFull.degrees.length, rng, defFull.chordOf) : [],
      defGhosts: b.defGhosts ? pickGhostLetters(defNotes, rng) : null,
      atkResults: null, defResults: null,
      verdict: null, // r1 kept — the Round-2 resolve may fall back to it
    },
  };
}

/** RIFF_CLOSED — duel over (or aborted): clear the battle slice. */
export function applyRiffClosed(state) {
  if (state.battle?.kind !== "riffOff") return state;
  return { ...state, battle: null };
}
