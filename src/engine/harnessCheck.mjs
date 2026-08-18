// ─── HARNESS CHECK ───────────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/harnessCheck.mjs
//
// Coverage for BOT_STRATEGY_HANDOFF §6.6 — the headless bench in
// `policies/play.js`.
//
// ⚠️ A HARNESS IS THE ONE PIECE OF TEST INFRASTRUCTURE THAT CAN LIE WITH
// AUTHORITY. Everything else in this repo fails loudly when it is wrong; a
// broken bench reports a number, and a number gets written into a design doc and
// cited for months. So the assertions here are mostly about the instrument
// rather than about any bot:
//
//   · it must be DETERMINISTIC — §6.6's regression, and the precondition for
//     every other number it produces;
//   · it must never apply an action `legalActions` did not offer, because a
//     harness that quietly swallows a refusal averages a broken rule away;
//   · it must actually FINISH matches, or a win rate is measuring its own
//     ceiling rather than a policy;
//   · and it must not have re-opened §6b.1's one-note-melody blind spot, which
//     is the failure the first headless trace actually found.

import assert from "node:assert";
import {
  runMatch, runBench, playTurn, startSpiritTurn, harnessHooks,
  matchConfig, POLICIES, HARNESS_GAPS, MAX_ACTIONS_PER_TURN,
} from "./policies/play.js";
import { makeInitialState } from "./state.js";
import { makeRng } from "./rng.js";
import { UNMODELLED_KINDS } from "./policies/transition.js";
import { SLIME_INNATE_OWNER } from "./systems/slime.js";
import { SKILL_BY_ID } from "../data/skillTree.js";
import { MELODY_MAX } from "./policies/legalActions.js";

let count = 0;
const ok = (cond, msg) => { count++; assert.ok(cond, msg); };
const eq = (a, b, msg) => { count++; assert.deepStrictEqual(a, b, msg); };

const RONIN = 'cosmic_ronin', ZERO = 'intergalactic_0', MM = 'Metalness_Monster';

const DUEL = [
  { id: RONIN, name: 'Shredding Ronin',   corner: 'blue',   num: 12, vibe: 5, maxVibe: 5, speed: 5, facing: 0 },
  { id: ZERO,  name: 'Intergalactic 0',   corner: 'purple', num: 44, vibe: 4, maxVibe: 4, speed: 4, facing: 0 },
];
const TRIO = [
  ...DUEL,
  { id: MM, name: 'Metalness Monster', corner: 'yellow', num: 28, vibe: 5, maxVibe: 5, speed: 4, facing: 0 },
];

const duel = (a, b) => ({ [RONIN]: POLICIES[a]({}), [ZERO]: POLICIES[b]({}) });

/** Replay a match, collecting every action every seat actually took. */
function traceMatch({ seed, spirits, policyName, turns = 12 }) {
  const rng = makeRng(seed >>> 0);
  let state = makeInitialState(matchConfig(spirits), seed >>> 0);
  const ctx = { rng, hooks: harnessHooks({ rng }) };
  const policy = POLICIES[policyName]({});
  // ⚠️ THE SAME VIEW `runMatch` BUILDS, `skillById` INCLUDED. This helper used to
  // hand-roll a view without it, which silently made every traced match a
  // base-kit match while `runMatch` played with unlocks — two different games
  // under one file, and the §9 assertions below would have been measuring the
  // wrong one.
  let v = { amps: [], shadowHex: null, rockGodActive: false, skillById: SKILL_BY_ID };
  const log = [];
  for (let i = 0; i < turns && !state.winner && state.acting; i++) {
    state = startSpiritTurn(state, rng);
    const seat = state.acting;
    const t = playTurn(state, v, policy, ctx);
    state = t.state; v = t.view;
    log.push({ seat, actions: t.actions, stalled: !!t.stalled, refused: t.refused ?? null });
  }
  return { state, log };
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. ⚠️ DETERMINISM — §6.6's regression. Same seed, same everything.
// ═════════════════════════════════════════════════════════════════════════════
{
  for (const seed of [1, 7, 4242]) {
    const a = traceMatch({ seed, spirits: DUEL, policyName: 'searcher' });
    const b = traceMatch({ seed, spirits: DUEL, policyName: 'searcher' });
    eq(JSON.stringify(a.log), JSON.stringify(b.log),
       `⚠️ seed ${seed}: same seed ⇒ IDENTICAL action sequence — the property every other number here rests on`);
    eq(a.state.winner, b.state.winner, `seed ${seed}: same seed ⇒ same outcome`);
  }

  // And a different seed must actually produce a different game, or the runs
  // are correlated and 2000 matches is really one match counted 2000 times.
  const x = traceMatch({ seed: 11, spirits: DUEL, policyName: 'searcher' });
  const y = traceMatch({ seed: 12, spirits: DUEL, policyName: 'searcher' });
  ok(JSON.stringify(x.log) !== JSON.stringify(y.log),
     '⚠️ different seeds diverge — otherwise the bench is one match counted N times');

  // Whole-match determinism, not just the opening.
  const m1 = runMatch({ seed: 99, spirits: DUEL, policies: duel('searcher', 'unranked') });
  const m2 = runMatch({ seed: 99, spirits: DUEL, policies: duel('searcher', 'unranked') });
  eq([m1.winner, m1.turns, m1.reason], [m2.winner, m2.turns, m2.reason],
     'a whole match replays identically from the seed');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. ⚠️ NOTHING ILLEGAL IS EVER APPLIED — the contract §6 rests on.
// ═════════════════════════════════════════════════════════════════════════════
{
  for (const policyName of ['searcher', 'unranked', 'random']) {
    for (const seed of [3, 21]) {
      const { log } = traceMatch({ seed, spirits: TRIO, policyName, turns: 20 });
      for (const turn of log) {
        // ⚠️ `illegal` means `legalActions` and `transition` have DRIFTED. It is
        // never a policy's fault and must never be swallowed as a stall.
        ok(turn.refused?.reason !== 'illegal',
           `${policyName} seed ${seed}: no action was refused as illegal — ${JSON.stringify(turn.refused)}`);
        ok(turn.refused?.reason !== 'unmodelled',
           `${policyName} seed ${seed}: unmodelled kinds are filtered before they are ever chosen`);
        for (const a of turn.actions) {
          ok(!UNMODELLED_KINDS.has(a.kind),
             `${policyName}: no ${a.kind} was played — it is declared unmodelled`);
        }
        ok(turn.actions.length <= MAX_ACTIONS_PER_TURN, 'no turn ran past the ceiling');
      }
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. 🧪 THE SLIME GATE, AT MATCH LEVEL — the bug this harness found.
//
// `slimeCheck` §13 pins the generator. This pins the CONSEQUENCE: across whole
// matches, nobody but the owner ever actually calls the ooze. The two are worth
// having separately — the first is the rule, this is the proof that no path
// through a real game reaches around it.
// ═════════════════════════════════════════════════════════════════════════════
{
  for (const seed of [5, 6, 7]) {
    const { log } = traceMatch({ seed, spirits: TRIO, policyName: 'searcher', turns: 30 });
    for (const turn of log) {
      for (const a of turn.actions) {
        if (a.kind === 'slime' || a.kind === 'slide') {
          eq(turn.seat, SLIME_INNATE_OWNER,
             `⚠️ seed ${seed}: only ${SLIME_INNATE_OWNER} ever works the road — ${turn.seat} played ${a.kind}`);
        }
      }
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. ⚠️ THE ONE-NOTE MELODY — the regression the first headless trace found.
//
// A step-at-a-time greedy confirms a ONE-NOTE track every turn: adding a note
// moves no term in `evaluate`, while confirming immediately raises `apBanked`.
// That is §6b.1's caveat re-appearing at the POLICY layer after being closed at
// the transition layer, and it silently deletes the entire commit economy —
// the Db, the Performance Score, the fans and the riff a long track pays.
// ═════════════════════════════════════════════════════════════════════════════
{
  for (const policyName of ['searcher', 'unranked']) {
    const { log } = traceMatch({ seed: 3, spirits: DUEL, policyName, turns: 8 });
    const committed = log.filter(t => t.actions.some(a => a.kind === 'confirmMelody'));
    ok(committed.length >= 4, `${policyName}: melodies are actually being committed`);

    const trackLen = (t) => t.actions.filter(a => a.kind === 'melodyNote').length;
    const longest = Math.max(...committed.map(trackLen));
    ok(longest > 1,
       `⚠️ ${policyName}: the composition phase writes MUSIC, not a one-note track — greedy-per-action does not`);
    ok(longest <= MELODY_MAX, `${policyName}: and never past the ${MELODY_MAX}-note cap`);

    // ⚠️ Each committed track is priced AT ITS CONFIRM, so `confirmMelody` is
    // always the last thing in the composition run. A confirm with notes after
    // it would mean a line was scored truncated.
    for (const t of committed) {
      const idx = t.actions.findIndex(a => a.kind === 'confirmMelody');
      const after = t.actions.slice(idx + 1);
      ok(!after.some(a => a.kind === 'melodyNote' || a.kind === 'stackCommit'),
         `${policyName}: nothing is composed after the confirm — the phase split is real`);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. ⚠️ MATCHES ACTUALLY FINISH — or a win rate measures the turn cap.
// ═════════════════════════════════════════════════════════════════════════════
{
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const runs = seeds.map(seed => runMatch({ seed, spirits: DUEL, policies: duel('searcher', 'unranked') }));

  ok(runs.every(r => r.anomaly == null), `no match reported an anomaly: ${JSON.stringify(runs.find(r => r.anomaly)?.anomaly)}`);
  ok(runs.every(r => r.reason !== 'stalled'), 'no match stalled');

  const decided = runs.filter(r => r.reason === 'winner');
  ok(decided.length >= seeds.length / 2,
     `⚠️ most matches reach a winner (${decided.length}/${seeds.length}) — a bench of timeouts is measuring its own ceiling`);

  // The Rock God is sidestepped by construction (short games crown outright),
  // so a finished match must have a real winner rather than a summoned finale.
  for (const r of decided) {
    ok([RONIN, ZERO].includes(r.winner), 'the winner is a seat at the table');
    ok(r.turns > 0 && r.turns <= 400, 'and it took a plausible number of turns');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. 🔁 SEAT SWAPPING — the bench measures policies, not chairs.
// ═════════════════════════════════════════════════════════════════════════════
{
  const seeds = [10, 11, 12, 13];
  const bench = runBench({ seeds, spirits: DUEL, a: 'searcher', b: 'unranked' });

  eq(bench.results.length, seeds.length, 'every seed produced a record');
  eq(bench.results[0].assign[RONIN], 'searcher', 'the first match seats A first');
  eq(bench.results[1].assign[RONIN], 'unranked',
     '⚠️ …and the second SWAPS — seats differ by Spirit, by home corner and by turn order, so a fixed assignment measures the chair');
  eq(bench.wins.searcher + bench.wins.unranked + bench.inconclusive, seeds.length,
     'every match is accounted for: a win for someone, or explicitly inconclusive');
  ok(bench.rate >= 0 && bench.rate <= 1, 'the rate is a fraction of DECIDED matches');

  // ⚠️ Inconclusive matches are excluded from the rate rather than counted as
  // losses. Counting a timeout as a loss for A would make "A is slow" read as
  // "A is worse", which is a different claim.
  const inconclusive = bench.results.filter(r => !r.winnerPolicy).length;
  eq(inconclusive, bench.inconclusive, 'the inconclusive count is the records that named no winner');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. 🌅 TURN START — the refill actually happens.
// ═════════════════════════════════════════════════════════════════════════════
{
  const rng = makeRng(77);
  let state = makeInitialState(matchConfig(DUEL), 77);
  const before = state.noteStates[state.acting];
  const opened = startSpiritTurn(state, rng);
  const after = opened.noteStates[opened.acting];

  eq(after.melodyLine, [], 'the melody line is cleared at turn start');
  eq(after.hasConfirmed, false, '…and the phase is reset to composition');
  eq(after.noteStock.length, before.noteStock.length, 'the stock keeps its shape');
  ok(startSpiritTurn({ ...state, acting: null }, rng) != null, 'no acting Spirit is a no-op, not a throw');
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. 📋 THE GAPS ARE DECLARED — a harness that hides its limits is worse than
//    one that has them.
// ═════════════════════════════════════════════════════════════════════════════
{
  for (const kind of UNMODELLED_KINDS) {
    ok(HARNESS_GAPS[kind], `${kind} is declared in HARNESS_GAPS, not silently absent`);
  }
  ok(!HARNESS_GAPS.skillUnlock,
     '⚠️ base-kit-only is NO LONGER a gap — SKILL_TREE left the monolith 2026-08-16 and `runMatch` passes the real tree');
  ok(HARNESS_GAPS.skillEffects,
     '…but what replaced it is declared: the STATE half of an unlock lands, `applySkillEffects` is still client-owned');
  ok(!HARNESS_GAPS.pose,
     '✨ the pose is NO LONGER a gap — `posing`/`limelightScores` are engine state and `endTurn` drives the payout (§6.6.8)');
  ok(!HARNESS_GAPS.riffRound2,
     '⚡ sudden death is NO LONGER a gap — `transition.js` escalates on `verdict.close`, the client\'s own gate (§6.6.9)');
  ok(HARNESS_GAPS.riffRound2Speed,
     '…but what replaced it is declared: the 0.58× Round-2 chart is played at Round-1 difficulty, because `simulateRiffPerformance` has no tempo term');
  ok(HARNESS_GAPS.summonRockGod, 'the sidestepped finale is declared');
  ok(!('legacy' in POLICIES),
     '⚠️ there is no `legacy` policy — a stub by that name would be cited as "the current bot" by the first person who read a table without reading the file');
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. 🎓 UNLOCKS ARE LIVE — the payoff of the SKILL_TREE extraction.
//
// ⚠️ THE ASSERTION THAT MATTERS IS THE OWNERSHIP ONE. Handing the real tree to
// the searcher armed a gate that had never once fired: `legalActions` resolved
// exclusivity from `skill.spiritOnly`, which the tree builder never populated,
// so every Spirit was eligible for every other Spirit's exclusive route. It was
// invisible while the tree was in the monolith and the family was absent.
// ═════════════════════════════════════════════════════════════════════════════
{
  const { log, state } = traceMatch({ seed: 4242, spirits: TRIO, policyName: 'searcher', turns: 60 });

  const aimed = [];
  for (const turn of log) {
    for (const a of turn.actions) {
      if (a.kind === 'skillTarget') aimed.push({ seat: turn.seat, id: a.skillId });
    }
  }
  ok(aimed.length > 0, '⚠️ Spirits actually AIM at skills now — a bench that never unlocks anything measures a game nobody plays');

  // ⚠️ And the aiming turns into OWNING. The award is `commitMelodyEconomy`'s,
  // not the action's, so this is the assertion that the two halves actually
  // meet: a searcher that targeted skills but never received them would pass
  // the line above and still be measuring a game with no progression in it.
  const owned = TRIO.map(sp => (state.noteStates?.[sp.id]?.unlockedSkills ?? []).length);
  ok(Math.max(...owned) > 2,
     `⚠️ …and the Db bar actually PAYS OUT — somebody climbed past their starting kit (${owned.join('/')})`);

  const ownedBy = { psycho_bushido: RONIN, shadow_illusion: RONIN, cursed_shamisen: RONIN, wa_no_koe: RONIN,
                    tentacle: MM, goes_to_11: MM, master_moshpits: MM, azrael: MM,
                    blaster_of_ra: ZERO };
  for (const b of aimed) {
    if (ownedBy[b.id]) {
      eq(b.seat, ownedBy[b.id],
         `⚠️ ${b.id} was aimed at by its OWNER — this gate read an always-undefined field until the tree was extracted`);
    }
  }
}

console.log(`✅ harnessCheck: ${count} assertions passed`);
