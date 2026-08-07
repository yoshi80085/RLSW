// =============================================================================
// riff/callAnswer.js — 🗣️ CALL & ANSWER — the derivation layer over defRiff
// -----------------------------------------------------------------------------
// The riff-off's fourth view turns the DEFENDER's turn into a puzzle. Today the
// defender is simply SHOWN `defRiff` and asked to hit the notes. But
// `generateDefenderRiff` doesn't invent an answer — it TRANSFORMS the call by a
// stated rule (inversion / modulation / twisted notes / phrase finisher). If the
// rule is stated and the notes are hidden, playing the answer stops being a
// reading test and becomes what a riff-off actually is: someone throws a lick,
// you work out the reply.
//
// ⚠️ THIS MODULE GENERATES NOTHING. `defRiff` is already the correct answer and
// the engine already owns it. All this module does is decide WHAT THE PLAYER IS
// TOLD about each answer note. That is the whole reason the mechanic is free of
// engine changes: the run, the judge (`|press − hitTime|` + correct key) and the
// results array are untouched. A note you derived wrong is a wrong KEY, which
// the existing judge already grades `wrong`. No new verdict math, ever.
//
// PURE MODULE — no React, no audio, no app state. Deterministic: no RNG.
//
// Main entries:
//   revealForTier(tierId)                  → the tier's occlusion policy
//   answerSlots(call, ans, kind, reveal)   → per-note: what the player may see
//   ghostTrack(call, kind, ans)            → the teaching overlay's derived line
// =============================================================================
import { RIFF_ANSWER_LABELS, riffDegreesToNotes } from "./riffGeneration.js";

// ── The rules, as the player is told them ───────────────────────────────────
// Keyed to `generateDefenderRiff`'s `kind`. `RIFF_ANSWER_LABELS` stays the
// single source for name + prose; this table only adds what the DERIVATION
// needs, so there is no second copy of the flavour text to drift.
//
// `op` is the shape of the transform:
//   'mirror' — every note reflects around the call's root (fully derivable)
//   'shift'  — every note moves by one constant (derivable ONCE you know it)
//   'keep'   — the answer is the call, with exceptions you must catch live
export const ANSWER_OPS = {
  inversion:  { op: 'mirror', hint: 'every climb becomes a fall — reflect it around the root' },
  modulation: { op: 'shift',  hint: 'same shape, new key — find the first note, then follow the contour' },
  variation:  { op: 'keep',   hint: 'the call comes back — but two notes are bent out of place' },
  resolution: { op: 'keep',   hint: 'it opens like the call, then walks home to the root' },
};

/** Name + prose + op for a kind, merged from the two sources. */
export function answerRule(kind) {
  const label = RIFF_ANSWER_LABELS[kind] ?? { name: 'ANSWER', desc: 'answer the call' };
  const ops   = ANSWER_OPS[kind] ?? { op: 'keep', hint: 'answer the call' };
  return { kind, name: label.name, desc: label.desc, ...ops };
}

// ── Occlusion tiers ─────────────────────────────────────────────────────────
// Mirrors `RIFF_FALL_DIFFICULTY`'s ladder so the player meets one difficulty
// concept, not two. `answerKey` is the only real dial:
//   'always' — the note letter rides the gem, exactly like the other views
//   'late'   — it appears at `lateAt` of the way in: derive it, or wait and react
//   'never'  — derive it or miss it
// `callKey` keeps the CALL's letters on screen (the material you derive FROM);
// `ghostTrack` draws the derived line over the call so the rule is visible
// rather than merely stated — the Intuitive lens, paid in training wheels.
export const ANSWER_REVEAL = {
  rookie:   { answerKey: 'always', callKey: true,  ghostTrack: true,  lateAt: 0 },
  gigging:  { answerKey: 'late',   callKey: true,  ghostTrack: true,  lateAt: 0.55 },
  shredder: { answerKey: 'late',   callKey: true,  ghostTrack: false, lateAt: 0.80 },
  virtuoso: { answerKey: 'never',  callKey: false, ghostTrack: false, lateAt: 1 },
};
export const ANSWER_REVEAL_DEFAULT = 'rookie';

export function revealForTier(tierId) {
  return ANSWER_REVEAL[tierId] ?? ANSWER_REVEAL[ANSWER_REVEAL_DEFAULT];
}

// ── Per-note derivability ───────────────────────────────────────────────────
// The fairness rule that makes the whole mechanic honest: A NOTE IS ONLY EVER
// HIDDEN IF THE PLAYER COULD HAVE WORKED IT OUT.
//
// `generateDefenderRiff` is not uniformly derivable, and pretending otherwise
// would be a taught-vs-coded mismatch (`DESIGN_AUDIT_v2.md` §2):
//   • inversion  — every note follows from the root. All derivable.
//   • modulation — the shift is not announced anywhere. The FIRST note is
//     therefore an ANCHOR: always shown, because hearing the new root is how a
//     real player finds the key. Everything after it follows the contour.
//   • variation  — two notes are randomly bent; the rest are the call verbatim.
//     The bent ones are underivable by construction, so they reveal late. That
//     is the mechanic, not a concession: play the call back and catch the bends.
//   • resolution — the opening half IS the call; the walk home is generated and
//     cannot be predicted note-for-note, so the walk reveals late.
//
// Anything flagged underivable ignores the tier and reveals — including at
// VIRTUOSO. A tier may make the game harder; it may never make it unfair.
function slotDerivable(kind, i, callDeg, callSharp, ansDeg, ansSharp) {
  if (kind === 'inversion')  return true;
  if (kind === 'modulation') return i > 0;              // note 0 anchors the key
  return callDeg === ansDeg && !!callSharp === !!ansSharp;
}

/**
 * What the player may see for every note of the answer.
 *
 * @param {{degrees:number[], sharps:boolean[]}} call  the attacker's riff
 * @param {{degrees:number[], sharps:boolean[]}} ans   the defender's riff (defRiff)
 * @param {string} kind    defRiff.kind — inversion | modulation | variation | resolution
 * @param {object} reveal  from revealForTier()
 * @returns {Array<{idx,callKey,ansKey,callDeg,ansDeg,derivable,anchor,revealAt}>}
 *   `revealAt` is a FRACTION of the note's lead time (0 = visible on spawn,
 *   1 = never). The view compares it against the note's own progress, so this
 *   stays independent of tempo, difficulty and the speed dial.
 */
export function answerSlots(call, ans, kind, reveal) {
  const cDeg = call?.degrees ?? [];
  const aDeg = ans?.degrees ?? [];
  const cSh  = call?.sharps ?? [];
  const aSh  = ans?.sharps ?? [];
  const cKey = riffDegreesToNotes(cDeg, cSh);
  const aKey = riffDegreesToNotes(aDeg, aSh);
  const r    = reveal ?? revealForTier(ANSWER_REVEAL_DEFAULT);

  return aDeg.map((d, i) => {
    const derivable = slotDerivable(kind, i, cDeg[i], cSh[i], d, aSh[i]);
    const anchor    = kind === 'modulation' && i === 0;
    let revealAt;
    if (!derivable || anchor)          revealAt = 0;             // fairness floor
    else if (r.answerKey === 'always') revealAt = 0;
    else if (r.answerKey === 'late')   revealAt = r.lateAt;
    else                               revealAt = 1;             // 'never'
    return {
      idx: i,
      callKey: cKey[i] ?? null,
      ansKey:  aKey[i] ?? null,
      callDeg: cDeg[i] ?? null,
      ansDeg:  d,
      derivable, anchor, revealAt,
    };
  });
}

/** True once a note that reveals at `revealAt` should show its letter.
 *  `p` is the note's own progress through its lead time, 0 → 1. */
export function slotRevealed(slot, p) {
  return slot.revealAt < 1 && p >= slot.revealAt;
}

// ── The teaching overlay ────────────────────────────────────────────────────
/**
 * The line the RULE would draw over the call, for the ghost-track overlay.
 * For 'mirror' and 'shift' this is exactly the answer, which is the point —
 * seeing the derived line sit on top of the real one is how the rule teaches
 * itself. For 'keep' ops there is nothing to derive, so the call is returned
 * unchanged and the view simply doesn't draw a second line.
 */
export function ghostTrack(call, kind, ans) {
  const c  = call?.degrees ?? [];
  const op = (ANSWER_OPS[kind] ?? {}).op;
  if (op === 'mirror') {
    const root = c[0] ?? 0;
    return c.map(d => root - (d - root));
  }
  if (op === 'shift') {
    const shift = (ans?.degrees?.[0] ?? c[0] ?? 0) - (c[0] ?? 0);
    return c.map(d => d + shift);
  }
  return c.slice();
}

/** The modulation interval, for the rule card ("shifted +2 steps"). */
export function shiftOf(call, ans) {
  return (ans?.degrees?.[0] ?? 0) - (call?.degrees?.[0] ?? 0);
}

/** One-line rule text for the card above the run, kind-aware and specific. */
export function ruleText(call, ans, kind) {
  const rule = answerRule(kind);
  if (rule.op === 'shift') {
    const s = shiftOf(call, ans);
    return `${rule.hint}${s ? ` (${s > 0 ? '+' : ''}${s} steps)` : ''}`;
  }
  return rule.hint;
}

// ── Post-round teaching reveal ──────────────────────────────────────────────
/**
 * Per-note relation for the results card: what the rule did to each note, and
 * whether the player's press agreed. `results` is the standard riff results
 * array ([{hit, grade, noteIdx}]) so this reads the same data the verdict does.
 */
export function answerReview(slots, results) {
  const byIdx = {};
  (results ?? []).forEach(r => { if (r.noteIdx != null) byIdx[r.noteIdx] = r; });
  return slots.map(s => {
    const r     = byIdx[s.idx];
    const delta = (s.ansDeg ?? 0) - (s.callDeg ?? 0);
    return {
      ...s,
      grade: r?.grade ?? 'miss',
      hit: !!r?.hit,
      delta,
      moved: delta === 0 ? 'same' : delta > 0 ? 'up' : 'down',
    };
  });
}

/** How much of the answer the player worked out rather than read — the stat the
 *  mechanic exists to produce.
 *
 *  Counts only slots that were NOT handed over at spawn (`revealAt > 0`), which
 *  is every derivable slot above ROOKIE. Notes revealed for fairness (modulation
 *  anchors, bent notes, the walk home) sit at `revealAt === 0` and are excluded
 *  from both halves of the fraction — you get no credit for a note the game
 *  gave you, and no blame for one it had to.
 *
 *  A 'late' slot the player hit may still have been read off a letter that
 *  appeared before they pressed; the run does not record what was on screen at
 *  press time. So treat this as a difficulty-weighted accuracy, not proof of
 *  derivation — only VIRTUOSO (`answerKey: 'never'`) is a clean measurement. */
export function derivationScore(slots, results) {
  const byIdx = {};
  (results ?? []).forEach(r => { if (r.noteIdx != null) byIdx[r.noteIdx] = r; });
  const earned = slots.filter(s => s.derivable && !s.anchor && s.revealAt > 0);
  if (!earned.length) return { derived: 0, total: 0, pct: null };
  const derived = earned.filter(s => byIdx[s.idx]?.hit).length;
  return { derived, total: earned.length, pct: Math.round((derived / earned.length) * 100) };
}
