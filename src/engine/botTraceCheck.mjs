// ─── BOT TRACE CHECK ─────────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/botTraceCheck.mjs
//
// Coverage for the 🧠 journal — `searcherPolicy`'s `trace` sink and
// `policies/botJournal.js`'s summary.
//
// ⚠️ THE FIRST ASSERTION IS THE WHOLE POINT. A journal that changes the game it
// is journalling is worse than no journal: every reading taken through it would
// describe a bot nobody plays against. So the same seed, traced and untraced —
// and with the audit pass on and off — must produce the same winner, the same
// turn count, the same Fame, and the same list of chosen actions. Everything
// below that is shape.
import assert from "node:assert";
import { runMatch, POLICIES, COMPOSITION_KINDS } from "./policies/play.js";
import { journalSummary, traceKey, JOURNAL_CLOSE_GAP } from "./policies/botJournal.js";
import { MODELLED_KINDS } from "./policies/transition.js";
import { MELODY_MAX } from "./policies/legalActions.js";
import { SPIRIT_DEFS } from "../data/spirits.js";

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); checks++; };

const sp = (ids, hexes, corners) => ids.map((id, i) => ({
  ...SPIRIT_DEFS[id], id, corner: corners[i], num: hexes[i],
  vibe: SPIRIT_DEFS[id].maxVibe, maxVibe: SPIRIT_DEFS[id].maxVibe,
  speed: SPIRIT_DEFS[id].speed, facing: 0, cpu: true,
}));
const DUEL = sp(['cosmic_ronin', 'intergalactic_0'], [12, 44], ['blue', 'purple']);
const SEED = 12345;

/** Play one match, recording every action the policy returned. `opts` rides through. */
function play(opts) {
  const taken = [];
  const journal = [];
  const policies = Object.fromEntries(DUEL.map(x => [x.id, (st, sid, v, ctx) => {
    const p = POLICIES.searcher({ ...opts, trace: opts.trace ? (e => journal.push(e)) : null })(st, sid, v, ctx);
    for (const a of (Array.isArray(p) ? p : (p ? [p] : []))) taken.push(`${a.kind}:${traceKey(a) ?? ''}`);
    return p;
  }]));
  const r = runMatch({ seed: SEED, spirits: DUEL, policies, lives: 2 });
  return { taken, journal, result: { winner: r.winner, turns: r.turns, fame: r.fame, duels: r.duels } };
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. 🎯 THE JOURNAL DOES NOT CHANGE THE GAME
// ═════════════════════════════════════════════════════════════════════════════
const plain   = play({});
const traced  = play({ trace: true });
const audited = play({ trace: true, audit: true });

eq(traced.result, plain.result,   '🧠 a traced match plays out exactly like an untraced one');
eq(traced.taken,  plain.taken,    '🧠 ...action for action, not just to the same result');
eq(audited.result, plain.result,  '🎯 and the AUDIT pass — which prices everything the beam threw away — changes nothing either');
eq(audited.taken,  plain.taken,   '🎯 ...action for action. `expectedScore` runs on forks; a fork consumes nothing.');
ok(plain.journal.length === 0,    '🧠 no sink, no entries');
ok(traced.journal.length > 0,     '🧠 a sink gets entries');

// ═════════════════════════════════════════════════════════════════════════════
// 2. ENTRY SHAPE — action decisions
// ═════════════════════════════════════════════════════════════════════════════
const actions = traced.journal.filter(e => e.t === 'action');
const composes = traced.journal.filter(e => e.t === 'compose');
ok(actions.length > 0,  '🧠 the action phase reports');
ok(composes.length > 0, '🧠 the composition phase reports');

for (const e of actions) {
  ok(typeof e.spiritId === 'string' && Number.isFinite(e.turn), 'every entry names a seat and a turn');
  ok(e.pruned === e.legal - e.beamed, '📏 pruned is exactly what the beam did not keep');
  ok(e.pruned >= 0 && e.beamed <= e.legal, '📏 ...and the beam never keeps more than it was given');
  eq(e.considered.length, e.beamed, '📏 everything the beam kept was PRICED — the beam is the sampling cost');
  ok((e.legalKinds ?? []).every(k => MODELLED_KINDS.has(k)),
     '📏 every legal kind reported is one the transition models');
  // The chosen action must be one of the ones it looked at. A chosen action that
  // is not in `considered` would mean the trace is describing a different search.
  ok(e.considered.some(c => c.kind === e.chosen?.kind),
     '🎯 the chosen action is one of the ones it priced');
  for (let i = 1; i < e.considered.length; i++) {
    ok(e.considered[i - 1].score >= e.considered[i].score, '📏 considered is sorted best-first');
  }
  // 🧭 THE CONTRACT IS ABOUT ELIGIBLE OPTIONS, NOT PRICED ONES, and the gap
  // between the two is the face guard. A `face` that does not out-score standing
  // still is priced, recorded, and then skipped — so it can sit at the TOP of
  // `considered` while the reported score belongs to something below it. That is
  // the guard working, and it must stay visible here rather than be filtered out
  // upstream: an option that scores best and is never taken is exactly what this
  // journal was built to surface.
  const eligible = e.considered.filter(c => !c.skipped);
  ok(eligible.length === 0 || Math.abs(eligible[0].score - e.score) < 1e-9,
     '🎯 the reported score IS the best ELIGIBLE considered score');
  ok(e.considered.every(c => !c.skipped || c.kind === 'face'),
     '🧭 nothing but a `face` is ever skipped — the guard is scoped, not general');
  ok(!e.considered.some(c => c.skipped && c.kind === e.chosen?.kind && c.key === e.chosen?.key),
     '🧭 a skipped option is never the chosen one');
  ok(e.bestPruned === null, '📏 no audit, no bestPruned');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. ENTRY SHAPE — the composition curve
// ═════════════════════════════════════════════════════════════════════════════
for (const e of composes) {
  ok(Array.isArray(e.curve), 'the curve is a list');
  for (let i = 1; i < e.curve.length; i++) {
    ok(e.curve[i].len > e.curve[i - 1].len, '📏 the curve walks one track length at a time, upward');
  }
  if (e.chosen) {
    ok(Number.isFinite(e.score), 'a chosen line has a finite score');
    ok(e.curve.some(p => Math.abs(p.score - e.score) < 1e-9),
       '🎯 the chosen line is one of the lengths the curve priced');
    ok(e.terms && typeof e.terms === 'object',
       '🧠 a chosen line carries the term vector it was chosen on');
  }
  // 🥁 THE COMPOSITION PHASE REPORTS WHAT IT PLAYED, NOT JUST HOW MUCH OF IT.
  ok(Array.isArray(e.legalKinds), 'a compose entry lists the composition kinds it was offered');
  ok(e.legalKinds.every(k => COMPOSITION_KINDS.has(k)),
     '📏 ...and only composition kinds — the action beam owns the rest');
  ok(e.chosenKinds && typeof e.chosenKinds === 'object', 'a compose entry counts the kinds it took');
  ok(Object.keys(e.chosenKinds).every(k => e.legalKinds.includes(k)),
     '📏 nothing can be taken that was never offered');
  eq(Object.values(e.chosenKinds).reduce((a, b) => a + b, 0), e.chosen ? e.chosen.len : 0,
     '📏 the kind counts add up to the length of the line');
  for (const st of e.steps ?? []) {
    ok(st.cands.some(c => c.kind === st.took.kind), '📏 the step took one of the candidates it priced');
    ok(new Set(st.cands.map(c => c.kind)).size === st.cands.length,
       '📏 one candidate per kind — the beam ranks WITHIN a kind, this chooses BETWEEN them');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3b. 🥁 THE REGRESSION — a stack commit is reachable before the track is full
//
// 🎯 THE BUG THIS PINS, 2026-08-19. `beamActions` groups by kind and emits the
// groups in first-appearance order; `legalActions` pushes every `melodyNote`
// before every `stackCommit`; `composePhase` took `[0]`. So a commit was
// unreachable until `melodyNote` stopped being legal at all — i.e. until the
// 8-note track was full. Over 18 headless matches the step-picker was offered
// both kinds 455 times and took a note 455 times.
//
// ⚠️ THE ASSERTION IS "ON A SHORT TRACK", NOT "AT ALL", AND THAT IS THE WHOLE
// VALUE OF IT. The shipped bug still produced commits — 148 in that sample —
// every one of them on a FULL track, as leftovers once there was nothing else to
// spend stock on. A test that asked only "does it ever commit" would have been
// green throughout, which is §5.A's lesson wearing a new hat: the count was
// never zero, so nothing looked broken.
// ═════════════════════════════════════════════════════════════════════════════
ok(composes.some(e => (e.chosenKinds?.stackCommit ?? 0) > 0
                   && (e.chosenKinds?.melodyNote ?? 0) < MELODY_MAX),
   '🥁 the searcher commits to a stack BEFORE the melody line is full');
ok(composes.some(e => (e.steps ?? []).some(st => st.cands.length > 1 && st.took.kind === 'stackCommit')),
   '🥁 ...and takes one in a step where a melody note was priced against it');

// ═════════════════════════════════════════════════════════════════════════════
// 4. 🎯 THE AUDIT — and what it is for
// ═════════════════════════════════════════════════════════════════════════════
const auditedActions = audited.journal.filter(e => e.t === 'action');
ok(auditedActions.some(e => e.bestPruned !== null),
   '🎯 with the audit on, the options the beam threw away are priced too');
for (const e of auditedActions) {
  if (e.pruned === 0) ok(e.bestPruned === null, '📏 nothing pruned, nothing to report');
  if (e.bestPruned) ok(Number.isFinite(e.bestPruned.score) || e.bestPruned.score === -Infinity,
                       'a pruned option carries a real score');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. THE SUMMARY
// ═════════════════════════════════════════════════════════════════════════════
const sum = journalSummary(traced.journal);
const seats = Object.keys(sum);
eq(seats.sort(), DUEL.map(s => s.id).sort(), 'every seat that decided appears in the summary');
let total = 0;
for (const id of seats) {
  const s = sum[id];
  total += s.decisions;
  eq(s.decisions, s.actionDecisions + s.composeDecisions, 'decisions split cleanly by phase');
  ok(s.prunedMax >= s.meanPruned, 'the worst prune is at least the mean one');
  // ⚠️ The §5.A detector must not fire on its own construction. `confirmMelody` is
  // legal on action decisions and answered by the composition phase instead, so
  // an un-excluded sweep would report the bot "never confirms a melody" in a
  // match where it confirmed one every turn — a false positive at the top of the
  // one column that is meant to be read as a bug report.
  ok(!s.neverChosen.includes('confirmMelody'),
     '🎯 the never-chosen sweep excludes confirmMelody, which the action beam never answers');
  for (const k of s.neverChosen) {
    ok(s.legalSeen[k] > 0, `never-chosen '${k}' was actually legal at some point`);
    ok(!s.chosen[k],       `never-chosen '${k}' was actually never chosen`);
  }
  eq(s.rankingCost, 0, '📏 no audit in this journal, so nothing can be blamed on the ranking');

  // 🥁 THE COMPOSITION PHASE IS IN THE SAME TWO COLUMNS AS THE ACTION PHASE.
  // This is the fix to the blindness that hid the stack bug: `neverChosen` is
  // derived from `legalSeen` minus `chosen`, and until 2026-08-19 nothing from
  // the composition phase reached either of them.
  ok(s.legalSeen.melodyNote > 0, '🥁 the summary can see that melody notes were offered');
  ok(s.chosen.melodyNote > 0,    '🥁 ...and that they were taken');
  ok(s.legalSeen.stackCommit > 0 || s.composeDecisions === 0,
     '🥁 the summary can see that stack commits were offered');
  ok(!s.neverChosen.includes('melodyNote'),
     '📏 a kind the bot plays every turn cannot be reported as never played');
  eq(s.meanNotes, (s.composeKinds.melodyNote ?? 0) / Math.max(1, s.composeDecisions),
     '📏 notes per composition turn is a mean over composition turns, not over decisions');
  eq(s.meanCommits, (s.composeKinds.stackCommit ?? 0) / Math.max(1, s.composeDecisions),
     '📏 ...and so is commits per composition turn');

  // 🎯 WHICH TERMS DECIDE THE CLOSE CALLS.
  ok(Array.isArray(s.termSwing), 'the summary reports a term-swing ranking');
  for (let i = 1; i < s.termSwing.length; i++) {
    ok(s.termSwing[i - 1][1] >= s.termSwing[i][1], '📏 term swings are ranked biggest first');
  }
  ok(s.termSwing.every(([, v]) => v >= 0), '📏 a swing is an absolute difference, never negative');
  ok(s.termSwingN <= s.closeCalls,
     '📏 a term swing is only measured on a close call, so it cannot outnumber them');
}
eq(total, traced.journal.length, 'the summary accounts for every entry');
eq(journalSummary([]), {}, 'an empty journal summarises to nothing rather than throwing');
eq(journalSummary(undefined), {}, '...and so does no journal at all');
ok(JOURNAL_CLOSE_GAP > 0, 'the close-call threshold is a real number');

const auditSum = journalSummary(audited.journal);
ok(Object.values(auditSum).some(s => s.rankingCost >= 0), 'the audited journal reports a ranking cost');

// ── 📊 EVIDENCE, NOT ASSERTIONS ─────────────────────────────────────────────
// What the journal actually says about this match. Printed because a detector
// nobody reads is a detector that does not exist.
for (const id of seats) {
  const s = auditSum[id] ?? sum[id];
  console.log(`   ${id}: ${s.decisions} decisions · mean pruned ${s.meanPruned.toFixed(1)} (worst ${s.prunedMax})`
    + ` · close calls ${s.closeCalls}`
    + ` · beam cost the position ${s.rankingCost}×`
    + (s.neverChosen.length ? ` · NEVER CHOSEN: ${s.neverChosen.map(k => `${k}(legal ${s.legalSeen[k]}×)`).join(', ')}` : ' · nothing legal went unplayed'));
  // 🥁 The composition half of the turn, which reported nothing at all until now.
  console.log(`      ✍️  per composition turn: ${s.meanNotes.toFixed(2)} notes, ${s.meanCommits.toFixed(2)} commits`
    + ` (${s.composeTurnsWith.stackCommit ?? 0}/${s.composeDecisions} turns loaded a stack)`);
  // 🎯 What the coin flips are actually flipping on. Raw terms — read against the
  // weight table, never instead of it.
  if (s.termSwing.length) {
    console.log(`      🎯 close calls turn on: ${s.termSwing.slice(0, 4).map(([k, v]) => `${k} ${v.toFixed(3)}`).join(', ')}`);
  }
}

console.log(`✅ botTraceCheck — ${checks} assertions passed`);
