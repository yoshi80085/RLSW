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
import { runMatch, POLICIES } from "./policies/play.js";
import { journalSummary, traceKey, JOURNAL_CLOSE_GAP } from "./policies/botJournal.js";
import { MODELLED_KINDS } from "./policies/transition.js";
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
  ok(e.considered.length === 0 || Math.abs(e.considered[0].score - e.score) < 1e-9,
     '🎯 the reported score IS the best considered score');
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
  }
}

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
}

console.log(`✅ botTraceCheck — ${checks} assertions passed`);
