// =============================================================================
// riff/callAnswer.test.mjs — 🗣️ CALL & ANSWER contract tests
// -----------------------------------------------------------------------------
//   node src/riff/callAnswer.test.mjs
//
// Re-run after touching callAnswer.js OR riffGeneration.js — the fairness rules
// here are assertions ABOUT `generateDefenderRiff`'s behaviour, so a change to
// how answers are built can silently make the occlusion unfair. That is exactly
// the failure this file exists to catch.
// =============================================================================
import {
  generateAttackerRiff, generateDefenderRiff, riffDegreesToNotes,
} from "./riffGeneration.js";
import {
  answerRule, answerSlots, revealForTier, ghostTrack, shiftOf,
  slotRevealed, answerReview, derivationScore, ANSWER_REVEAL,
} from "./callAnswer.js";

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.error(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
}

// Deterministic rng so a failure is reproducible.
function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── A corpus of real call/answer pairs, all four kinds represented ──────────
const CORPUS = [];
for (let s = 1; s <= 400; s++) {
  const rand = mulberry(s);
  const call = generateAttackerRiff(rand, 6 + (s % 8));
  const ans  = generateDefenderRiff(call, rand);
  CORPUS.push({ call, ans, kind: ans.kind, seed: s });
}
const kinds = new Set(CORPUS.map(c => c.kind));
ok('corpus covers all four answer kinds', kinds.size === 4, [...kinds].join(','));

// ── 1. THE FAIRNESS FLOOR ───────────────────────────────────────────────────
// The load-bearing invariant: a note is only ever hidden if the player could
// have worked it out. Anything a player cannot derive must reveal at every
// tier, VIRTUOSO included.
for (const tier of Object.keys(ANSWER_REVEAL)) {
  const reveal = revealForTier(tier);
  let violations = 0, checked = 0;
  for (const { call, ans, kind } of CORPUS) {
    for (const slot of answerSlots(call, ans, kind, reveal)) {
      checked++;
      if (!slot.derivable && slot.revealAt !== 0) violations++;
    }
  }
  ok(`[${tier}] underivable notes always reveal`, violations === 0,
     `${violations}/${checked} hidden but underivable`);
}

// ── 2. DERIVABILITY MATCHES WHAT THE GENERATOR ACTUALLY DID ─────────────────
// Every slot marked derivable must be reproducible from the call by the kind's
// stated rule. This is the anti-lie test: if `generateDefenderRiff` changes,
// the rule text we show the player stops being true and this fails.
{
  let bad = 0, checked = 0;
  for (const { call, ans, kind, seed } of CORPUS) {
    const slots = answerSlots(call, ans, kind, revealForTier('virtuoso'));
    const root  = call.degrees[0];
    const shift = shiftOf(call, ans);
    for (const s of slots) {
      if (!s.derivable) continue;
      checked++;
      let expected;
      if (kind === 'inversion')       expected = root - (s.callDeg - root);
      else if (kind === 'modulation') expected = s.callDeg + shift;
      else                            expected = s.callDeg;   // 'keep' ops
      if (expected !== s.ansDeg) {
        bad++;
        if (bad === 1) console.error(`    first: seed ${seed} ${kind} idx ${s.idx} expected ${expected} got ${s.ansDeg}`);
      }
    }
  }
  ok('derivable slots follow the stated rule', bad === 0, `${bad}/${checked} broke the rule`);
}

// ── 3. MODULATION ANCHORS ITS FIRST NOTE ────────────────────────────────────
// The shift is announced nowhere, so note 0 must be given or the tier is a
// guessing game. Also asserts note 0 is NOT counted as derived work.
{
  const mods = CORPUS.filter(c => c.kind === 'modulation');
  ok('modulation pairs exist in corpus', mods.length > 0, `${mods.length}`);
  let bad = 0;
  for (const { call, ans, kind } of mods) {
    const slots = answerSlots(call, ans, kind, revealForTier('virtuoso'));
    if (!slots[0].anchor || slots[0].revealAt !== 0) bad++;
    if (slots[0].derivable) bad++;
  }
  ok('modulation reveals its first note at every tier', bad === 0, `${bad} bad`);
}

// ── 4. INVERSION IS FULLY DERIVABLE ─────────────────────────────────────────
{
  const invs = CORPUS.filter(c => c.kind === 'inversion');
  let bad = 0;
  for (const { call, ans, kind } of invs) {
    const slots = answerSlots(call, ans, kind, revealForTier('virtuoso'));
    if (slots.some(s => !s.derivable)) bad++;
  }
  ok('inversion hides every note at virtuoso', bad === 0, `${bad}/${invs.length} leaked`);
}

// ── 5. GHOST TRACK REPRODUCES THE ANSWER FOR DERIVABLE OPS ──────────────────
// The teaching overlay must draw the REAL answer line, not an approximation —
// otherwise the training wheels teach the wrong rule.
{
  let bad = 0, checked = 0;
  for (const { call, ans, kind } of CORPUS) {
    const rule = answerRule(kind);
    if (rule.op !== 'mirror' && rule.op !== 'shift') continue;
    checked++;
    const g = ghostTrack(call, kind, ans);
    if (g.length !== ans.degrees.length || g.some((d, i) => d !== ans.degrees[i])) bad++;
  }
  ok('ghost track equals the answer for mirror/shift', bad === 0, `${bad}/${checked} mismatched`);
}

// ── 6. LETTERS MATCH THE JUDGE'S ALPHABET ───────────────────────────────────
// `ansKey` is what the player must press, and the judge compares it against
// `run.notes[i].key`, which the app builds with riffDegreesToNotes. Same source,
// but assert it — a drift here would be invisible until someone couldn't win.
{
  let bad = 0;
  for (const { call, ans, kind } of CORPUS) {
    const expect = riffDegreesToNotes(ans.degrees, ans.sharps);
    const slots  = answerSlots(call, ans, kind, revealForTier('rookie'));
    if (slots.some((s, i) => s.ansKey !== expect[i])) bad++;
  }
  ok('slot keys match riffDegreesToNotes', bad === 0, `${bad} mismatched riffs`);
}

// ── 7. REVEAL TIMING IS MONOTONIC ACROSS THE LADDER ─────────────────────────
// Later tiers must never show a derivable note EARLIER than an easier tier.
{
  const order = ['rookie', 'gigging', 'shredder', 'virtuoso'];
  let bad = 0;
  for (const { call, ans, kind } of CORPUS) {
    const tracks = order.map(t => answerSlots(call, ans, kind, revealForTier(t)));
    for (let i = 0; i < tracks[0].length; i++) {
      for (let t = 1; t < order.length; t++) {
        if (tracks[t][i].revealAt < tracks[t - 1][i].revealAt) bad++;
      }
    }
  }
  ok('reveal never gets earlier as tiers climb', bad === 0, `${bad} inversions`);
}

// ── 8. slotRevealed / review / score behave ─────────────────────────────────
{
  const { call, ans, kind } = CORPUS.find(c => c.kind === 'inversion');
  const slots = answerSlots(call, ans, kind, revealForTier('gigging'));
  const s = slots.find(x => x.revealAt > 0 && x.revealAt < 1);
  ok('a gigging slot reveals part-way', !!s);
  if (s) {
    ok('hidden before its reveal point', !slotRevealed(s, s.revealAt - 0.01));
    ok('shown at its reveal point',      slotRevealed(s, s.revealAt));
  }
  const never = answerSlots(call, ans, kind, revealForTier('virtuoso'))[1];
  ok('virtuoso derivable slot never reveals', !slotRevealed(never, 1));

  const results = slots.map(x => ({ hit: true, rt: 40, grade: 'perfect', noteIdx: x.idx }));
  const review  = answerReview(slots, results);
  ok('review covers every slot', review.length === slots.length);
  ok('review carries the grade', review.every(r => r.grade === 'perfect'));
  ok('review labels direction', review.every(r => ['up', 'down', 'same'].includes(r.moved)));

  const all = derivationScore(slots, results);
  ok('derivation score is 100% on a clean run', all.pct === 100, JSON.stringify(all));
  const none = derivationScore(slots, []);
  ok('derivation score is 0% on an empty run', none.pct === 0, JSON.stringify(none));
  const rookie = derivationScore(answerSlots(call, ans, kind, revealForTier('rookie')), results);
  ok('rookie derives nothing (everything is given)', rookie.pct === null, JSON.stringify(rookie));
}

// ── 9. EMPTY / DEGENERATE INPUT ─────────────────────────────────────────────
{
  ok('empty riffs produce no slots', answerSlots(null, null, 'inversion', revealForTier('rookie')).length === 0);
  ok('unknown kind still yields a rule', !!answerRule('nonsense').name);
  ok('unknown kind slots are all shown',
     answerSlots({ degrees: [0, 1], sharps: [false, false] },
                 { degrees: [0, 2], sharps: [false, false] },
                 'nonsense', revealForTier('virtuoso'))
       .every(s => s.revealAt === 0 || s.derivable));
}

console.log(`\ncallAnswer: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
