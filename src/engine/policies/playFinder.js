// =============================================================================
// engine/policies/playFinder.js  —  🎯 THE BEGINNER FINDER: the best play in a hand
// -----------------------------------------------------------------------------
// IDEAS_INBOX [P1] "Beginner chord finder" (2026-09-16), step 1 of 3: THE BRAIN.
// Given one Spirit's note sheet at the start of (or part-way through) their build,
// it answers "what is the strongest thing I can play with the notes I actually
// hold?" — once for each thing a beginner might be chasing:
//
//   🔴 drive    — the Drive stat after the turn (Drive-stack chord + temp boost)
//   🔵 sustain  — the Sustain stat after the turn (Sustain-stack chord + temp boost)
//   💰 db       — the Db the melody commit pays
//   🎤 fans     — the fans the melody commit wins (Spirit structure + craft run)
//
// A PLAY is the whole build for the turn: which notes go to which stack (up to the
// stack-commit budget, inside each stack's found seats) AND the melody line built
// from what is left, in order. The two halves are searched TOGETHER because they
// compete for the same notes and because the melody's ending reads the stacks'
// roots (the red/blue carrot).
//
// 🎯 THE DELIVERY IS NOT THIS FILE. Alex's call (2026-09-16): the fans say what
// melody they want in SPEECH BUBBLES. This module is what the crowd asks for; it
// must never ask for a line the hand cannot make. The bubbles and their preview
// are steps 2 and 3. Pure module — no React, no rng, no state writes.
//
// ⚠️ EVERY NUMBER HERE COMES FROM THE GAME'S OWN SCORERS, AND THAT IS THE POINT.
// Chords go through `spiritChord` (attackParams.js — the headless copy), the
// melody through `melodyPayoutFor` (the exact function `commitMelodyEconomy`
// pays with), the seats through `stackCapFor`. Nothing is re-derived. A finder
// that scored with its own arithmetic would be a fourth copy of the economy, and
// the day the fifth pays differently it would coach players into a worse line
// while every suite stayed green (`SEQUENCING.md` §B2). The only things computed
// locally are UPPER BOUNDS for pruning — and a wrong bound can only make the
// search slower or miss a line, never report a number the game would not pay;
// `playFinderCheck.mjs` proves the result against brute force.
//
// ⚠️ THE DRIVE/SUSTAIN IT REPORTS IS THE POCKET DIAL'S NUMBER, NOT COMBAT'S.
// An EMPTY stack reads `spiritChord([])` = 1 on the dial, but `attackParams`
// falls back to the Spirit's static sheet stat (Ronin Drive 8) when the stack is
// empty — higher than any chord the rebased 1–5 table can make. Following combat
// would coach "commit nothing to Drive", which is a bug's lesson, not the game's.
// 🚩 Reported in the 2026-09-16 handoff; not fixed here.
//
// 📌 WHAT IT DOES NOT MODEL (deliberately, for v1): the mic's bonus note (a die
// roll), next turn's refill beyond the "spend fewer notes" tie-break, the board
// hunt a stack root points at, removing notes already in a stack, and movement
// value beyond reporting `moves`.
// =============================================================================
import { spiritChord } from "../systems/attackParams.js";
import { usedHas } from "../systems/economy.js";
import { SPEED_CAP } from "../systems/melodyCommit.js";
import { SPIRIT_DEFS } from "../../data/spirits.js";
import { STACK_COMMIT_BUDGET, stackCapFor } from "../../data/gameConstants.js";
import { buildScale, playableScale, pitchIndex } from "../../music/notes.js";
import { melodyModeFor } from "../../music/melodyIdentity.js";
import { melodyPayoutFor, craftFansFromRun } from "../../music/melodyPayout.js";
import { styleCoachFor } from "../../music/spiritStyle.js";

export const FINDER_GOALS = Object.freeze(['drive', 'sustain', 'db', 'fans']);

/** The melody track's seat count — the client refuses a ninth note
 *  (`melodyLine.length >= 8` in `rlsw-simulator-v3_8_1.jsx`'s note click). */
export const FINDER_TRACK_SEATS = 8;

/** How many candidate lines one search may score before it settles for the best
 *  it has found. ⚠️ A budget hit is REPORTED (`exact: false`), never silent — a
 *  hint that claims "strongest possible" must be able to say when it only looked
 *  hard. 📏 Measured 2026-09-16 (cloud Node, fresh 10–11 note hands, half with a
 *  stack already started): 180 hands × 4 goals, EVERY answer proven; all four
 *  goals together average 0.2–0.35 s per hand, worst 1.7 s (a Ronin hand — six
 *  clean notes and two letter gestures make the widest search). ⚠️ That is too
 *  slow to run on every render: the UI step should compute once per hand change,
 *  and only the goal it is about to show. `playFinderCheck.mjs` §6 re-proves a
 *  seeded sample on every run. */
export const FINDER_NODE_BUDGET = 250_000;

// 🎯 WHAT "BEST" MEANS, PER GOAL — lexicographic, most important first.
// The last key is always `-spent`: unused stock CARRIES OVER and spent slots refill
// only up to `STOCK_REFILL_RATE` (turnFlow.js), so between two plays that pay the
// same, the one that spends fewer notes is strictly the better turn.
const GOAL_KEYS = Object.freeze({
  drive:   ['drive', 'db', 'fans', 'sustain'],
  sustain: ['sustain', 'db', 'fans', 'drive'],
  db:      ['db', 'fans', 'drive', 'sustain'],
  fans:    ['fans', 'db', 'drive', 'sustain'],
});

const lexCompare = (a, b) => {
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};

// 📌 The two melody-only orders are the CEILINGS every goal is clamped by — see
// `melodyCeilings`. Their `-spent` is the line's own length: a shorter line
// that pays the same leaves more of the hand for the stacks and next turn.
const CEILING_KEYS = Object.freeze({ dbFans: ['db', 'fans'], fansDb: ['fans', 'db'] });

const vectorFor = (goal, v) => [...(GOAL_KEYS[goal] ?? CEILING_KEYS[goal]).map(k => v[k]), -v.spent];

/** Everything about the hand the search needs, read once. */
function readHand(spiritId, ns, opts) {
  const rootNote = ns.rootNote ?? 'C';
  const mode = ns.paletteMode ?? melodyModeFor(spiritId);
  const scale = playableScale(rootNote, mode);
  const harmonic = buildScale(rootNote, mode);
  const stock = ns.noteStock ?? [];
  const unavailable = new Set(opts.unavailable ?? []);
  const free = [];
  stock.forEach((note, idx) => {
    if (note == null || usedHas(ns.usedStockIdx, idx) || unavailable.has(idx)) return;
    free.push({ idx, note });
  });
  const prefix = [...(ns.melodyLine ?? [])];
  const confirmed = !!ns.hasConfirmed;
  const budget = confirmed ? 0 : Math.max(0, STACK_COMMIT_BUDGET - (ns.stackCommitsThisTurn ?? 0));
  const speed = Math.min(SPEED_CAP, SPIRIT_DEFS[spiritId]?.speed ?? 5);
  // Per-spelling facts the bounds read on every node, computed once.
  const info = new Map();
  for (const n of [...free.map(f => f.note), ...prefix]) {
    if (!info.has(n)) info.set(n, { clean: scale.includes(n), deg: scale.indexOf(n), letter: letterOf(n), pc: pitchIndex(n) });
  }
  return { info,
    spiritId, rootNote, mode, scale, harmonic, free, prefix, confirmed, budget, speed,
    driveStack: [...(ns.driveStack ?? [])], sustainStack: [...(ns.sustainStack ?? [])],
    capDrive: stackCapFor(ns, 'drive'), capSustain: stackCapFor(ns, 'sustain'),
    tempDrive: ns.tempDrive ?? 0, tempSustain: ns.tempSustain ?? 0,
    mojoDrained: (ns.mojoDrain ?? 0) > 0,
  };
}

/** The payout context `commitMelodyEconomy` builds — same seats, same roots. */
function payoutContext(hand, driveStack, sustainStack) {
  return {
    // ⚠️ Index 3/4 = the mode's 4th/5th, exactly as melodyCommit.js reads them.
    tonic: hand.rootNote, fourth: hand.harmonic[3], fifth: hand.harmonic[4],
    driveRoot: driveStack[0] ?? null, sustainRoot: sustainStack[0] ?? null,
  };
}

/** Group free notes by SPELLING. ⚠️ Spelling, not pitch class: the payout tests
 *  cleanliness with `scale.includes(note)` on the string, so C♯ and D♭ are not
 *  interchangeable in the melody even though they are in a chord. */
function groupBySpelling(free) {
  const groups = new Map();
  for (const { idx, note } of free) {
    if (!groups.has(note)) groups.set(note, []);
    groups.get(note).push(idx);
  }
  return groups;
}

/**
 * Every legal way to spend this turn's stack commits. Each plan is
 * `{ drive: [note…], sustain: [note…] }` — the notes ADDED, in commit order.
 *
 * Pruned without loss: a note whose pitch class the stack already holds adds
 * nothing to `evaluateChord` (distinct pitch classes) and only takes a note away
 * from the melody, so it is never generated. Order inside an addition matters
 * ONLY when the stack is empty — the first note becomes `stack[0]`, the root the
 * ending carrot reads — so each possible root is its own plan.
 */
function stackPlans(hand, groups) {
  const keys = [...groups.keys()];
  const plans = [];
  const roomD = Math.max(0, hand.capDrive - hand.driveStack.length);
  const roomS = Math.max(0, hand.capSustain - hand.sustainStack.length);
  const pcsD = new Set(hand.driveStack.map(pitchIndex));
  const pcsS = new Set(hand.sustainStack.map(pitchIndex));

  const subsets = (room, heldPcs) => {
    const out = [[]];
    const rec = (start, chosen, pcs) => {
      if (chosen.length >= Math.min(room, hand.budget)) return;
      for (let i = start; i < keys.length; i += 1) {
        const pc = pitchIndex(keys[i]);
        if (pc < 0 || heldPcs.has(pc) || pcs.has(pc)) continue;
        const next = [...chosen, keys[i]];
        out.push(next);
        rec(i + 1, next, new Set([...pcs, pc]));
      }
    };
    rec(0, [], new Set());
    return out;
  };
  // Each subset, and when the stack is empty, each choice of which note leads.
  const orderings = (subset, stackEmpty) => (stackEmpty && subset.length > 1)
    ? subset.map(lead => [lead, ...subset.filter(n => n !== lead)])
    : [subset];

  const dSubs = subsets(roomD, pcsD);
  const sSubs = subsets(roomS, pcsS);
  for (const d of dSubs) {
    for (const s of sSubs) {
      if (d.length + s.length > hand.budget) continue;
      const need = new Map();
      for (const n of [...d, ...s]) need.set(n, (need.get(n) ?? 0) + 1);
      if ([...need].some(([n, c]) => (groups.get(n)?.length ?? 0) < c)) continue;
      for (const dOrd of orderings(d, hand.driveStack.length === 0)) {
        for (const sOrd of orderings(s, hand.sustainStack.length === 0)) {
          plans.push({ drive: dOrd, sustain: sOrd });
        }
      }
    }
  }
  return plans;
}

// ── 🧮 BOUND HELPERS ─────────────────────────────────────────────────────────
// ⚠️ THESE KNOW THE SHAPE OF FOUR GESTURES AND ONE RUN DETECTOR, AND THAT IS A
// COPY OF RULES — IN BOUND FORM ONLY. They never score anything; they only say
// "no line from here can do better than N". If a gesture changes and a bound
// here becomes too TIGHT, the finder would silently miss lines, so:
//   · a gesture id not listed in `GESTURE_BOUNDS` falls back to the loose,
//     rule-blind bound (slower, never wrong), and
//   · `playFinderCheck.mjs` asserts the listed ids are exactly the ones
//     `STYLE_GESTURES` ships, and proves the finder against brute force.

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const letterOf = note => LETTERS.indexOf(String(note ?? '')[0]);

/** Longest one-direction walk around a ring of `size` positions, stepping `span`,
 *  each landing spending one count. `from` = start ONE STEP past that position. */
function ringWalk(countsByPos, size, span, limit, from = null, dirs = [1, -1]) {
  let best = 0;
  const left = new Int8Array(size);
  for (let start = 0; start < size; start += 1) {
    if (from != null && start !== from) continue;
    if (from == null && !countsByPos[start]) continue;
    for (const dir of dirs) {
      left.set(countsByPos);
      let pos = from == null ? start : ((start + dir * span) % size + size) % size;
      let len = 0;
      while (len < limit && left[pos] > 0) {
        left[pos] -= 1;
        len += 1;
        pos = ((pos + dir * span) % size + size) % size;
      }
      if (len > best) best = len;
    }
  }
  return best;
}

/** The letter-contour run still OPEN at the end of the line: `{ run, dir }`.
 *  Same walk as `spiritStyle.js`'s `contourRun` (a repeated letter neither
 *  extends nor breaks), read forward so the run returned is the LAST one. */
function openContour(line, span) {
  let run = 0, dir = 0;
  for (let i = 1; i < line.length; i += 1) {
    const a = letterOf(line[i - 1]), b = letterOf(line[i]);
    if (a < 0 || b < 0) { run = 0; dir = 0; continue; }
    const delta = (b - a + 7) % 7;
    if (delta === 0) continue;
    const sign = delta === span ? 1 : delta === 7 - span ? -1 : 0;
    if (!sign) { run = 0; dir = 0; continue; }
    if (dir && sign !== dir) run = 0;
    dir = sign;
    run += 1;
  }
  return { run, dir };
}

/** `craftRunFor` = the longest clean same-direction run by step OR by third,
 *  over scale positions with wrap (`cadence.js` `degreeStep`). A future run either
 *  extends the trailing clean run from the last note, or is fresh. */
function craftRunBound(scale, counts, line, payout, slots, trailingClean, info) {
  const now = line.length ? payout.craftRun : 0;
  if (slots <= 0) return now;
  const byDeg = new Int8Array(scale.length);
  for (const [n, c] of counts) {
    const d = info.get(n).deg;
    if (d >= 0 && c > 0) byDeg[d] += c;
  }
  const lastDeg = line.length ? info.get(line.at(-1)).deg : -1;
  let best = now;
  for (const span of [1, 2]) {
    best = Math.max(best, ringWalk(byDeg, scale.length, span, slots));
    if (lastDeg >= 0) best = Math.max(best, trailingClean + ringWalk(byDeg, scale.length, span, slots, lastDeg));
  }
  return best;
}

/** Letter-contour gestures (the Ronin): three notes walking letter names by a
 *  fixed span in one direction; a repeated letter neither helps nor breaks. */
function contourGestureBound(g, span, counts, line, slots, info) {
  if (g.hits) return g.hits;
  if (slots <= 0) return 0;
  const byLetter = new Int8Array(7);
  for (const [n, c] of counts) {
    const l = info.get(n).letter;
    if (l >= 0 && c > 0) byLetter[l] += c;
  }
  if (slots >= 3 && ringWalk(byLetter, 7, span, 3) >= 3) return 1;
  // ⚠️ NOT `g.notesNeeded`. The coach's "trailing" progress reads the run at the
  // START of the line, not the end (`contourRun(line, span, true)` reverses the
  // notes and then returns the last run it saw — which is the first run of the
  // original). Trusting it made this bound too tight and pruned the winning line
  // (`playFinderCheck` §3, seed 120). ✅ `contourRun` was fixed 2026-09-17; this
  // bound still reads the open run itself, which also gives it the direction.
  const last = line.length ? letterOf(line.at(-1)) : -1;
  if (last < 0) return 0;
  const open = openContour(line, span);
  // One more note in the SAME direction finishes an open run of one…
  if (open.run >= 1 && ringWalk(byLetter, 7, span, 1, last, [open.dir]) >= 1) return 1;
  // …or two more, either way, start a fresh run AT the last note.
  if (slots >= 2 && ringWalk(byLetter, 7, span, 2, last) >= 2) return 1;
  return 0;
}

/** A → B → A return phrases (Metalness, Intergalactic 0). Each new phrase needs a
 *  pitch twice, and may borrow at most the line's last two notes. */
function returnGestureBound(g, counts, line, slots) {
  if (slots <= 0) return g.hits;
  const byPc = new Map();
  const bump = (n, c) => { const pc = pitchIndex(n); if (pc >= 0 && c > 0) byPc.set(pc, (byPc.get(pc) ?? 0) + c); };
  for (const [n, c] of counts) bump(n, c);
  for (const n of line.slice(-2)) bump(n, 1);
  const pairs = byPc.size >= 2 ? [...byPc.values()].reduce((sum, c) => sum + Math.floor(c / 2), 0) : 0;
  const more = Math.min(Math.floor((slots + 2) / 3), pairs);
  return g.repeatable ? g.hits + more : (g.hits ? g.hits : (more > 0 ? 1 : 0));
}

const GESTURE_BOUNDS = Object.freeze({
  scalar_shred:  (g, counts, line, slots, info) => contourGestureBound(g, 1, counts, line, slots, info),
  even_skip:     (g, counts, line, slots, info) => contourGestureBound(g, 2, counts, line, slots, info),
  pedal_chug:    returnGestureBound,
  signal_circle: returnGestureBound,
});

/** Exported for the suite: the ids whose bounds know the rule. */
export const FINDER_BOUNDED_GESTURES = Object.freeze(Object.keys(GESTURE_BOUNDS));

function gestureBound(g, counts, line, slots, info) {
  const known = GESTURE_BOUNDS[g.id];
  if (known) return known(g, counts, line, slots, info);
  // Rule-blind fallback: slower, never too tight.
  if (g.repeatable) return g.hits + (slots > 0 ? Math.floor((slots + 2) / 3) : 0);
  return g.hits ? g.hits : (g.reachable && slots > 0 ? 1 : 0);
}

/** Chord stats of a stack as the pocket dial reads them. */
const chordOf = (spiritId, stack) => spiritChord(spiritId, stack);

/**
 * Search one goal. Branch-and-bound over (stack plan × ordered melody line), with
 * ONE incumbent shared across every plan so a strong early play prunes whole
 * plans before their melody is ever searched.
 */
function searchGoal(hand, goal, budgetNodes, ceilings = null) {
  const { spiritId, scale } = hand;
  const groups = groupBySpelling(hand.free);
  // A ceiling search is the melody alone, over the WHOLE hand: no stack plan.
  const plans = CEILING_KEYS[goal] ? [{ drive: [], sustain: [] }] : stackPlans(hand, groups);
  const seats = Math.max(0, FINDER_TRACK_SEATS - hand.prefix.length);

  let best = null;
  let nodes = 0;
  let exhausted = false;

  // Per-plan constants, and an optimistic bound so the plans are tried best-first.
  const prepared = plans.map(plan => {
    const driveStack = [...hand.driveStack, ...plan.drive];
    const sustainStack = [...hand.sustainStack, ...plan.sustain];
    const counts = new Map([...groups].map(([n, idxs]) => [n, idxs.length]));
    for (const n of [...plan.drive, ...plan.sustain]) counts.set(n, counts.get(n) - 1);
    const ctx = payoutContext(hand, driveStack, sustainStack);
    // Last-note facts depend only on the note, so one single-note payout each
    // answers "what would ending here pay / carrot" without copying the ladder.
    const lastNote = new Map([...counts.keys()].map(n => [n, melodyPayoutFor(spiritId, [n], scale, ctx)]));
    const dChord = chordOf(spiritId, driveStack);
    const sChord = chordOf(spiritId, sustainStack);
    return { plan, driveStack, sustainStack, counts, ctx, lastNote, dChord, sChord,
      spentStack: plan.drive.length + plan.sustain.length };
  });

  const valuesFor = (p, line, payout) => {
    const carrot = hand.mojoDrained || line.length === 0 ? null : payout.chordRootCarrot;
    return {
      drive: p.dChord.drive + Math.max(hand.tempDrive, carrot === 'drive' ? 1 : 0),
      sustain: p.sChord.sustain + Math.max(hand.tempSustain, carrot === 'sustain' ? 1 : 0),
      db: line.length ? payout.db : 0,
      fans: line.length ? payout.style.score + payout.craftFans : 0,
      spent: p.spentStack + (line.length - hand.prefix.length),
      carrot,
    };
  };

  // 🧮 THE BOUND. Every term is an OVER-estimate of what any extension of `line`
  // could reach, read off the real payout of `line` itself plus note counts.
  // ⚡ LAZY, AND COMPARED AS IT GOES: the components are computed in the goal's
  // own order and the comparison with the incumbent stops at the first one that
  // decides it. The fans term is by far the dearest (gesture and run walks), and
  // for most nodes a cheaper term earlier in the order has already settled it.
  // Comparing a bound vector key by key IS a lexicographic compare, so laziness
  // changes the cost, never the answer.
  const scanFor = (p, line, payout, slots) => {
    let cleanLeft = 0, endBest = line.length ? payout.endingDb : 0;
    let carrotD = !hand.mojoDrained && line.length > 0 && payout.chordRootCarrot === 'drive';
    let carrotS = !hand.mojoDrained && line.length > 0 && payout.chordRootCarrot === 'sustain';
    if (slots > 0) {
      for (const [n, c] of p.counts) {
        if (!c) continue;
        if (hand.info.get(n).clean) cleanLeft += c;
        const one = p.lastNote.get(n);
        if (one.endingDb > endBest) endBest = one.endingDb;
        if (!hand.mojoDrained && one.chordRootCarrot === 'drive') carrotD = true;
        if (!hand.mojoDrained && one.chordRootCarrot === 'sustain') carrotS = true;
      }
    }
    return { cleanLeft, endBest, carrotD, carrotS };
  };

  const componentFor = (key, p, line, payout, slots, memo) => {
    const scan = () => (memo.scan ??= scanFor(p, line, payout, slots));
    switch (key) {
      case 'drive': return p.dChord.drive + Math.max(hand.tempDrive, scan().carrotD ? 1 : 0);
      case 'sustain': return p.sChord.sustain + Math.max(hand.tempSustain, scan().carrotS ? 1 : 0);
      case 'db': {
        const { cleanLeft, endBest } = scan();
        const cleanNow = line.length ? payout.cleanCount : 0;
        const cleanMax = cleanNow + Math.min(slots, cleanLeft);
        // ⚠️ Streak and ending are bounded by their caps, not their current values:
        // appending can open a streak, and the ending is whatever note lands LAST.
        // Two streaks need a NON-clean note between them, and that note takes a
        // seat a clean note could have had — so "every seat clean" and "two
        // streaks" are bounded as the two separate cases they are.
        const oneStreak = cleanMax * 0.5 + (cleanMax >= 3 ? 0.5 : 0);
        // ⚠️ Only subtract the separator's seat when the line has NO non-clean
        // note yet. Once one is on the track it may already be the separator —
        // found by `playFinderCheck` §3's brute force, which caught this bound
        // pruning the winning "clean run · discord · clean run" line.
        const hasSeparator = line.some(n => !hand.info.get(n)?.clean);
        const twoClean = cleanNow + Math.min(hasSeparator ? slots : Math.max(0, slots - 1), cleanLeft);
        const twoStreaks = twoClean >= 6 ? twoClean * 0.5 + 1 : 0;
        return Math.max(oneStreak, twoStreaks) + endBest;
      }
      case 'fans': {
        let trailingClean = 0;
        for (let i = line.length - 1; i >= 0 && hand.info.get(line[i])?.clean; i -= 1) trailingClean += 1;
        const runMax = craftRunBound(scale, p.counts, line, payout, slots, trailingClean, hand.info);
        let styleMax = 0;
        for (const g of styleCoachFor(spiritId, line, slots, scale)) styleMax += gestureBound(g, p.counts, line, slots, hand.info);
        return styleMax + craftFansFromRun(runMax);
      }
      default: throw new Error(`playFinder: no bound for "${key}"`);
    }
  };

  // 🎯 THE CLAMP. Db and fans never depend on the stacks — only on which notes
  // are left for the line — and a line from fewer notes is a line from more. So
  // the best (db, then fans) the WHOLE hand can play is a ceiling on every plan's
  // melody, and likewise (fans, then db). Clamping the loose per-node bound down
  // to those exact ceilings is what lets one proof serve every plan instead of
  // re-proving the melody under each of them. ⚠️ Only valid when the ceiling was
  // PROVEN — a ceiling that hit its budget is null and does not clamp.
  const keys = GOAL_KEYS[goal] ?? CEILING_KEYS[goal];
  const pairCeiling = (first, second) => {
    if (!ceilings || !GOAL_KEYS[goal]) return null;
    if (first === 'db' && second === 'fans') return ceilings.dbFans;
    if (first === 'fans' && second === 'db') return ceilings.fansDb;
    return null;
  };

  /** Could any extension of `line` under plan `p` beat the incumbent? Returns
   *  the (possibly partial) bound vector too, which ranks the plans. */
  const canBeat = (p, line, payout, slots, full = false) => {
    const vec = [];
    const memo = {};
    let clampNext = null;
    for (let i = 0; i < keys.length; i += 1) {
      let v = componentFor(keys[i], p, line, payout, slots, memo);
      if (clampNext != null) { v = Math.min(v, clampNext); clampNext = null; }
      const ceil = pairCeiling(keys[i], keys[i + 1]);
      if (ceil) { v = Math.min(v, ceil[0]); if (v === ceil[0]) clampNext = ceil[1]; }
      vec.push(v);
      if (!full && best && v !== best.vec[i]) return { beat: v > best.vec[i], vec };
    }
    const spent = -(p.spentStack + (line.length - hand.prefix.length));
    vec.push(spent);
    if (!best) return { beat: true, vec };
    return { beat: lexCompare(vec, best.vec) > 0, vec };
  };

  // ⚡ Hot path: compare key by key straight off the payout and only build the
  // values object for a new incumbent (most candidates lose on the first key).
  const consider = (p, line, payout) => {
    const carrot = hand.mojoDrained || line.length === 0 ? null : payout.chordRootCarrot;
    const read = k => k === 'db' ? (line.length ? payout.db : 0)
      : k === 'fans' ? (line.length ? payout.style.score + payout.craftFans : 0)
      : k === 'drive' ? p.dChord.drive + Math.max(hand.tempDrive, carrot === 'drive' ? 1 : 0)
      : p.sChord.sustain + Math.max(hand.tempSustain, carrot === 'sustain' ? 1 : 0);
    if (best) {
      let verdict = 0;
      for (let i = 0; i < keys.length && verdict === 0; i += 1) verdict = read(keys[i]) - best.vec[i];
      if (verdict === 0) verdict = -(p.spentStack + (line.length - hand.prefix.length)) - best.vec[keys.length];
      if (verdict <= 0) return;
    }
    const values = valuesFor(p, line, payout);
    best = { vec: vectorFor(goal, values), values, prep: p, line: [...line], payout };
  };

  const emptyPayout = hand.prefix.length ? null : { db: 0, style: { score: 0 }, craftFans: 0, chordRootCarrot: null, endingDb: 0, cleanCount: 0, craftRun: 0 };

  // Plans best-first by their optimistic bound.
  const ranked = prepared.map(p => {
    const payout = hand.prefix.length ? melodyPayoutFor(spiritId, hand.prefix, scale, p.ctx) : emptyPayout;
    const slots = hand.confirmed ? 0 : seats;
    return { p, payout, ub: canBeat(p, hand.prefix, payout, slots, true).vec };
  }).sort((a, b) => lexCompare(b.ub, a.ub));

  // Child order: in-scale notes in scale order first (runs and shreds are found
  // early, so the incumbent is strong before the long tail), discord last.
  const order = n => { const i = scale.indexOf(n); return i < 0 ? 100 + pitchIndex(n) : i; };

  for (const { p, payout, ub } of ranked) {
    if (best && lexCompare(ub, best.vec) <= 0) continue;
    const line = [...hand.prefix];
    const noteKeys = [...p.counts.keys()].sort((a, b) => order(a) - order(b));
    consider(p, line, payout);
    if (hand.confirmed) continue;

    const rec = () => {
      const slots = seats - (line.length - hand.prefix.length);
      if (slots <= 0) return;
      for (const n of noteKeys) {
        const c = p.counts.get(n);
        if (!c) continue;
        if (nodes >= budgetNodes) { exhausted = true; return; }
        p.counts.set(n, c - 1);
        line.push(n);
        nodes += 1;
        const pay = melodyPayoutFor(spiritId, line, scale, p.ctx);
        consider(p, line, pay);
        if (canBeat(p, line, pay, slots - 1).beat) rec();
        line.pop();
        p.counts.set(n, c);
        if (exhausted) return;
      }
    };
    rec();
    if (exhausted) break;
  }

  return { best, nodes, exact: !exhausted, plans: plans.length };
}

/** Turn a winning (plan, line) back into concrete stock indices and a report. */
function describe(hand, goal, found, ceilings) {
  const { best } = found;
  const groups = groupBySpelling(hand.free);
  const take = note => groups.get(note).shift();
  const stack = [
    ...best.prep.plan.drive.map(note => ({ note, idx: take(note), dest: 'drive' })),
    ...best.prep.plan.sustain.map(note => ({ note, idx: take(note), dest: 'sustain' })),
  ];
  const added = best.line.slice(hand.prefix.length);
  const melody = added.map(note => ({ note, idx: take(note) }));
  const pay = best.line.length ? best.payout : null;
  return {
    goal,
    stack,
    melody,
    line: best.line,
    result: {
      drive: best.values.drive,
      sustain: best.values.sustain,
      db: best.values.db,
      fans: best.values.fans,
      spent: best.values.spent,
      moves: Math.min(best.line.length, hand.speed),
      driveChord: best.prep.dChord.name,
      sustainChord: best.prep.sChord.name,
      carrot: best.values.carrot,
      ending: pay?.ending ?? null,
      styleFans: pay?.style.score ?? 0,
      styleHits: pay?.style.labels ?? [],
      craftRun: pay?.craftRun ?? 0,
      craftFans: pay?.craftFans ?? 0,
      cleanCount: pay?.cleanCount ?? 0,
    },
    // Exact only if the goal's own search AND both ceilings it leaned on were proven.
    exact: found.exact && !!ceilings?.dbFans && !!ceilings?.fansDb,
    searched: { plans: found.plans, lines: found.nodes, ceilingLines: ceilings?.lines ?? 0 },
  };
}

/**
 * The best play for ONE goal.
 *
 * @param {string} spiritId
 * @param {object} ns      the Spirit's note sheet (never mutated)
 * @param {'drive'|'sustain'|'db'|'fans'} goal
 * @param {object} [opts]
 * @param {number[]} [opts.unavailable]  stock indices that cannot be played this
 *   turn (the client's `staggeredSlots`)
 * @param {number}   [opts.nodeBudget]   see `FINDER_NODE_BUDGET`
 */
export function findBestPlay(spiritId, ns = {}, goal = 'db', opts = {}) {
  if (!GOAL_KEYS[goal]) throw new RangeError(`findBestPlay: unknown goal "${goal}" — one of ${FINDER_GOALS.join(', ')}`);
  const hand = readHand(spiritId, ns ?? {}, opts);
  const budget = opts.nodeBudget ?? FINDER_NODE_BUDGET;
  const ceilings = opts._ceilings ?? melodyCeilings(hand, budget);

  // 💰🎤 Db AND FANS: THE LINE FIRST, THEN THE STACKS FROM WHAT IT LEAVES.
  // ⚠️ Deliberately sequential, and it is a DEFINITION, not an approximation of
  // the joint search. Db and fans do not depend on the stacks at all, so the
  // line's payout is proven over the whole hand; the stacks then take the best
  // chord the leftovers can make. Searched jointly, every stack plan re-proved
  // the melody under it and a full hand cost seconds (measured 2026-09-16,
  // `SEQUENCING.md` handoff). What the definition gives up: when two lines pay
  // the same, it keeps the SHORTER one, not the one whose leftovers voice the
  // better chord.
  if (goal === 'db' || goal === 'fans') {
    const lineFound = ceilings[goal === 'db' ? 'dbFansFound' : 'fansDbFound'];
    const found = stacksAfterLine(hand, goal, lineFound);
    return describe(hand, goal, found, ceilings);
  }
  const found = searchGoal(hand, goal, budget, ceilings);
  return describe(hand, goal, found, ceilings);
}

/** The best stacks the leftovers of a fixed line can build (Db / fans goals). */
function stacksAfterLine(hand, goal, lineFound) {
  const line = lineFound.best.line;
  const groups = groupBySpelling(hand.free);
  for (const n of line.slice(hand.prefix.length)) groups.get(n).pop();
  for (const [n, idxs] of [...groups]) if (!idxs.length) groups.delete(n);
  let best = null;
  const plans = stackPlans(hand, groups);
  for (const plan of plans) {
    const driveStack = [...hand.driveStack, ...plan.drive];
    const sustainStack = [...hand.sustainStack, ...plan.sustain];
    const payout = melodyPayoutFor(hand.spiritId, line, hand.scale, payoutContext(hand, driveStack, sustainStack));
    const values = scorePlay(hand.spiritId, null, { stack: [], line }, { hand, driveStack, sustainStack, payout, spentStack: plan.drive.length + plan.sustain.length });
    const vec = vectorFor(goal, values);
    if (!best || lexCompare(vec, best.vec) > 0) {
      best = { vec, values, line, payout, prep: { plan,
        dChord: chordOf(hand.spiritId, driveStack), sChord: chordOf(hand.spiritId, sustainStack) } };
    }
  }
  return { best, nodes: 0, exact: lineFound.exact, plans: plans.length };
}

/** Proven melody ceilings for a hand, or null per order when a proof ran out of
 *  budget (a null ceiling simply does not clamp). The winning lines ride along:
 *  they ARE the Db and fans goals' melodies. */
function melodyCeilings(hand, budget) {
  const out = { dbFans: null, fansDb: null, lines: 0 };
  for (const name of Object.keys(CEILING_KEYS)) {
    const found = searchGoal(hand, name, budget, null);
    out.lines += found.nodes;
    out[`${name}Found`] = found;
    if (found.exact) out[name] = found.best.vec;
  }
  return out;
}

/** The best play for every goal — what the crowd (and the stacks) can ask for.
 *  The two melody ceilings are proven ONCE and shared by all four goals.
 *  `opts.goals` narrows the set: the melody step only needs `['fans', 'db']`,
 *  which skips the two joint stack searches — the dear half of the cost. */
export function findBestPlays(spiritId, ns = {}, opts = {}) {
  const goals = opts.goals ?? FINDER_GOALS;
  for (const goal of goals) {
    if (!GOAL_KEYS[goal]) throw new RangeError(`findBestPlays: unknown goal "${goal}" — one of ${FINDER_GOALS.join(', ')}`);
  }
  const hand = readHand(spiritId, ns ?? {}, opts);
  const ceilings = melodyCeilings(hand, opts.nodeBudget ?? FINDER_NODE_BUDGET);
  return Object.fromEntries(goals.map(goal =>
    [goal, findBestPlay(spiritId, ns, goal, { ...opts, _ceilings: ceilings })]));
}

/**
 * Score an arbitrary play with the same readers the finder uses — the referee the
 * suite checks the finder against. `play` is `{ stack: [{note, dest}], line }`
 * where `line` is the WHOLE melody (prefix included).
 */
export function scorePlay(spiritId, ns = {}, play = {}, _pre = null) {
  const hand = _pre?.hand ?? readHand(spiritId, ns ?? {}, {});
  const driveStack = _pre?.driveStack ?? [...hand.driveStack, ...(play.stack ?? []).filter(s => s.dest === 'drive').map(s => s.note)];
  const sustainStack = _pre?.sustainStack ?? [...hand.sustainStack, ...(play.stack ?? []).filter(s => s.dest === 'sustain').map(s => s.note)];
  const line = play.line ?? [];
  const payout = _pre?.payout ?? melodyPayoutFor(spiritId, line, hand.scale, payoutContext(hand, driveStack, sustainStack));
  const carrot = hand.mojoDrained || !line.length ? null : payout.chordRootCarrot;
  const spentStack = _pre?.spentStack ?? (play.stack ?? []).length;
  return {
    drive: chordOf(spiritId, driveStack).drive + Math.max(hand.tempDrive, carrot === 'drive' ? 1 : 0),
    sustain: chordOf(spiritId, sustainStack).sustain + Math.max(hand.tempSustain, carrot === 'sustain' ? 1 : 0),
    db: line.length ? payout.db : 0,
    fans: line.length ? payout.style.score + payout.craftFans : 0,
    spent: spentStack + Math.max(0, line.length - hand.prefix.length),
    carrot,
  };
}

/** The lexicographic key a goal ranks plays by — exported for the suite. */
export function goalVector(goal, values) {
  return vectorFor(goal, values);
}
