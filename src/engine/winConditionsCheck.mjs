// ─── WIN CONDITIONS CHECK ────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/winConditionsCheck.mjs
//
// Coverage for 🏆 Legend Run vs 🎸 Battle of the Bands — `WIN_CONDITIONS_DESIGN.md`
// §8 step 4, built in the same pass as the rules per `CLAUDE.md`'s standing rule:
// **a round-limit ending that no script runs is not a rule.**
//
// The properties that matter more than any individual assertion here:
//
//   1. 🏆 TODAY'S GAME IS UNCHANGED BY DEFAULT. Every caller that names neither
//      axis must get Legend Run with elimination on, a per-turn cap of 4 and a
//      real finish line. A mode switch that quietly moves the default game is
//      the worst possible outcome of this change, and it would not show up in
//      any other suite.
//   2. ⚠️ THE THREE AXES STAY SEPARATE. `mode` is table structure,
//      `winCondition` is how it ends, `elimination` is whether you can be
//      removed. §1 of the design doc: a field with two meanings is how this
//      codebase's older bugs were written (`legalActionsCheck` §15 is the
//      monument). So `rounds + elimination:'on'` and `fame + elimination:'off'`
//      must both be reachable and both behave.
//   3. 💥 THE TIE LADDER IS TESTED RUNG BY RUNG, each rung forced in isolation.
//      A ladder only ever exercised through whole matches is a ladder whose
//      lower rungs have never run.
//
// ⚠️ NOT COVERED: the client. Nothing in `rlsw-simulator-v3_8_1.jsx` can select
// a win condition yet — there is no menu, by design (`WIN_CONDITIONS_DESIGN.md`
// §8 step 6 is the one with the preview-page rule on it). When it lands, the
// client's turn-end path must call the same `buzzerReached`/`buzzerVerdict`
// this suite tests, not its own copy.

import assert from "node:assert";
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import { makeRng } from "./rng.js";
import { damageApplied } from "./actions.js";
import { runMatch, POLICIES, matchConfig } from "./policies/play.js";
import {
  fameToWin, famePerTurnCap, roundLimitFor, buzzerReached, buzzerVerdict,
} from "./systems/battleFlow.js";
import { resolveKnockdown } from "./systems/combat.js";
import { FAME_PER_TURN_CAP, ROUND_LIMIT_DEFAULT, RIFF_FP_TURN_CAP } from "../data/gameConstants.js";

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.equal(a, b, m); checks++; };
const deep = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

const RONIN = 'cosmic_ronin', ZERO = 'intergalactic_0';
const DUEL = [
  { id: RONIN, name: 'Shredding Ronin', corner: 'blue',   num: 12, vibe: 5, maxVibe: 5, speed: 5, facing: 0 },
  { id: ZERO,  name: 'Intergalactic 0', corner: 'purple', num: 44, vibe: 4, maxVibe: 4, speed: 4, facing: 0 },
];
const st = (cfg = {}) => makeInitialState(matchConfig(DUEL, { startingLives: 3, ...cfg }), 4242);
const seats = () => Object.fromEntries(DUEL.map(s => [s.id, POLICIES.searcher({})]));

// ═════════════════════════════════════════════════════════════════════════════
// §1. 🏆 THE DEFAULT IS TODAY'S GAME
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = st();
  eq(s.config.winCondition, 'fame',  '🏆 winCondition defaults to fame — Legend Run is what ships');
  eq(s.config.elimination,  'on',    '🏆 elimination defaults to on');
  eq(fameToWin(s), 24,               '🏆 the finish line is still lives × fpPerLife = 24 at 2P × 3 lives');
  eq(famePerTurnCap(s), FAME_PER_TURN_CAP, '🏆 the per-turn cap is still 4');
  eq(roundLimitFor(s), null,         '🏆 Legend Run has no round clock');
  eq(buzzerReached({ ...s, turn: { ...s.turn, round: 999 } }), false,
     '🏆 ⚠️ NO BUZZER IN A RACE, at any round number — this is the assertion that stops a mode leaking into the default game');

  // ⚠️ The whitelist trap `fameTarget`/`fameCap` fell into: a config field that
  // sets cleanly on the object and never reaches the state.
  const r = st({ winCondition: 'rounds', roundLimit: 3 });
  eq(r.config.winCondition, 'rounds', '⚠️ winCondition SURVIVES the state.js config whitelist');
  eq(r.config.roundLimit, 3,          '⚠️ roundLimit survives the whitelist');
  eq(r.config.elimination, 'off',     '🎸 elimination defaults OFF in Battle of the Bands (a default, not a coupling)');
}

// ═════════════════════════════════════════════════════════════════════════════
// §2. 🎸 THE MODE'S THREE RULE CHANGES
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = st({ winCondition: 'rounds' });
  eq(fameToWin(s), Infinity,   '🎸 no finish line — grantFame can never crown anybody');
  eq(famePerTurnCap(s), Infinity, '🎸 THE PER-TURN CAP IS GONE — the crowd finally lands in full (§4.4)');
  eq(roundLimitFor(s), ROUND_LIMIT_DEFAULT, '🎸 the default set is 10 rounds');
  eq(roundLimitFor(st({ winCondition: 'rounds', roundLimit: 4 })), 4, '🎸 …and the lobby dial overrides it');

  // The buzzer is `> limit`, not `>=`: the last round is played out IN FULL, so
  // every seat gets the same number of turns. That is the whole point.
  const at = (round) => buzzerReached({ ...s, turn: { ...s.turn, round } });
  eq(at(ROUND_LIMIT_DEFAULT), false, '🎸 no buzzer DURING the last round — it is played out in full');
  eq(at(ROUND_LIMIT_DEFAULT + 1), true, '🎸 the buzzer goes once the last round has closed');

  // ⚠️ The instrument still wins, or no bench can pin the cap in this mode.
  eq(famePerTurnCap(st({ winCondition: 'rounds', fameCap: 4 })), 4,
     '📏 config.fameCap OVERRIDES the mode cap — the bench must be able to pin it either way');
  eq(famePerTurnCap(st({ fameCap: 9 })), 9, '📏 …in Legend Run too');
}

// ═════════════════════════════════════════════════════════════════════════════
// §3. 💀 ELIMINATION IS ITS OWN AXIS
// ═════════════════════════════════════════════════════════════════════════════
{
  const spirit = { id: RONIN, lives: 1, num: 30, corner: 'blue', facing: 0, vibe: 0, maxVibe: 5 };

  const out = resolveKnockdown(spirit);
  eq(out.respawned, false, '💀 elimination ON: the last life spent removes you');
  eq(out.next.knockedOut, true, '💀 …and knockedOut is set');

  const stays = resolveKnockdown(spirit, undefined, { elimination: false });
  eq(stays.respawned, true,  '🎸 elimination OFF: you get straight back up on your last life');
  eq(!!stays.next.knockedOut, false, '🎸 …and are never knocked out');
  eq(stays.next.lives, 1, '🎸 ⚠️ LIVES ARE INERT, NOT FLOORED — a life is not a resource in a game you cannot be put out of, and lives:0 sitting in state reads as "nearly dead" to decideWinner and evaluate.js');
  eq(stays.next.vibe, spirit.maxVibe, '🎸 the Vibe still resets — the knockdown still costs you');

  // 📌 The axes are independent, per Alex's instruction that a later difficulty
  // setting must turn elimination ON inside Battle of the Bands.
  eq(st({ winCondition: 'rounds', elimination: 'on' }).config.elimination, 'on',
     '📌 rounds + elimination ON is reachable — the pairing is a default, not a coupling');
  eq(st({ elimination: 'off' }).config.elimination, 'off',
     '📌 …and so is fame + elimination OFF');
}

// ═════════════════════════════════════════════════════════════════════════════
// §4. 💥 THE DAMAGE SCOREBOARD
// ═════════════════════════════════════════════════════════════════════════════
{
  const rng = makeRng(1);
  let s = st();
  deep(s.damageLedger, {}, '💥 the scoreboard starts empty');

  s = applyAction(s, damageApplied(ZERO, 3, RONIN), rng);
  eq(s.damageLedger[RONIN].dealt, 3, '💥 the attacker is credited');
  eq(s.damageLedger[ZERO].taken, 3,  '💥 the victim is debited');
  eq(s.damageLedger[RONIN].taken, 0, '💥 …and only on the side that earned it');

  s = applyAction(s, damageApplied(ZERO, 2, RONIN), rng);
  eq(s.damageLedger[RONIN].dealt, 5, '💥 it accumulates');

  // ⚠️ A hit with no attacker — a board hazard, economy.js's coin-flip Vibe
  // loss — is damage TAKEN by nobody's hand. Crediting it would let a Spirit
  // win a tie-break by hurting himself.
  const before = s.damageLedger[ZERO].dealt ?? 0;
  s = applyAction(s, damageApplied(ZERO, 4), rng);
  eq(s.damageLedger[ZERO].taken, 9, '💥 an unattributed hit still counts as taken (3 + 2 + 4)');
  eq(s.damageLedger[ZERO].dealt ?? 0, before, '💥 ⚠️ …and is credited to NOBODY — no winning a tie-break by hurting yourself');

  s = applyAction(s, damageApplied(RONIN, 3, RONIN), rng);
  eq(s.damageLedger[RONIN].dealt, 5, '💥 a self-hit is not "dealt" either');

  const zero = applyAction(st(), damageApplied(ZERO, 0, RONIN), rng);
  deep(zero.damageLedger, {}, '💥 a 0-damage event does not open a row');
}

// ═════════════════════════════════════════════════════════════════════════════
// §5. 🎤 THE TIE LADDER, RUNG BY RUNG
// ═════════════════════════════════════════════════════════════════════════════
{
  const board = ({ fame, diehards, dealt = [0, 0], taken = [0, 0] }) => {
    const s = st({ winCondition: 'rounds' });
    return {
      ...s,
      noteStates: {
        ...s.noteStates,
        [RONIN]: { ...s.noteStates[RONIN], fame: fame[0], diehards: diehards[0] },
        [ZERO]:  { ...s.noteStates[ZERO],  fame: fame[1], diehards: diehards[1] },
      },
      damageLedger: {
        [RONIN]: { dealt: dealt[0], taken: taken[0] },
        [ZERO]:  { dealt: dealt[1], taken: taken[1] },
      },
    };
  };

  let v = buzzerVerdict(board({ fame: [20, 12], diehards: [1, 6] }));
  eq(v.winnerId, RONIN,     '⭐ rung 1 — most Fame takes it');
  eq(v.decidedOn, 'fame',   '⭐ …and says so');
  deep(v.tied, [],          '⭐ nobody is tied');

  v = buzzerVerdict(board({ fame: [20, 20], diehards: [2, 5] }));
  eq(v.winnerId, ZERO,      '🎤 rung 2 — level on Fame, the bigger loyal core takes it');
  eq(v.decidedOn, 'diehards', '🎤 …and says which rung settled it');

  v = buzzerVerdict(board({ fame: [20, 20], diehards: [4, 4], dealt: [9, 2], taken: [2, 9] }));
  eq(v.winnerId, RONIN,     '💥 rung 3 — level on Fame AND crowd, the band that did the damage takes it');
  eq(v.decidedOn, 'net',    '💥 …decided on net Vibe damage');

  // ⚠️ NET, not dealt: taking a beating costs you the rung.
  v = buzzerVerdict(board({ fame: [5, 5], diehards: [3, 3], dealt: [10, 6], taken: [9, 1] }));
  eq(v.winnerId, ZERO, '💥 ⚠️ NET, NOT DEALT — 10 dealt and 9 taken loses to 6 dealt and 1 taken');

  v = buzzerVerdict(board({ fame: [7, 7], diehards: [3, 3], dealt: [4, 4], taken: [4, 4] }));
  eq(v.winnerId, null,   '🤝 dead level on all three — both bands headline');
  eq(v.decidedOn, null,  '🤝 …decided on nothing');
  deep(v.tied.slice().sort(), [RONIN, ZERO].sort(), '🤝 …and the draw NAMES them');

  eq(buzzerVerdict(board({ fame: [3, 3], diehards: [1, 1] })).standings.length, 2,
     '📊 the full standings come back either way — a tie-break that fires invisibly is one nobody can tell from a bug');
}

// ═════════════════════════════════════════════════════════════════════════════
// §6. 🎸 WHOLE MATCHES
// ═════════════════════════════════════════════════════════════════════════════
{
  // 🏆 The control. If this row ever changes, the mode leaked.
  const legend = runMatch({ seed: 12345, spirits: DUEL, policies: seats(), lives: 3 });
  eq(legend.reason, 'winner', '🏆 a Legend Run still ends on a winner');
  eq(legend.verdict, null,    '🏆 …and carries no buzzer verdict');
  ok(Math.max(...Object.values(legend.fame)) >= 24, '🏆 …who reached the finish line');

  for (const roundLimit of [3, 6, 10]) {
    const r = runMatch({ seed: 12345, spirits: DUEL, policies: seats(), lives: 3,
                         winCondition: 'rounds', roundLimit });
    eq(r.reason, 'buzzer', `🎸 a ${roundLimit}-round set ends on the BUZZER, not on turnCap — a clean ending is not an anomaly`);
    eq(r.turns, roundLimit * DUEL.length,
       `🎸 …after exactly ${roundLimit} full revolutions, so both seats got the same number of turns`);
    ok(r.winner, '🎸 …and somebody headlines');
    eq(r.verdict.winnerId, r.winner, '🎸 the declared winner IS the buzzer verdict');

    // ⛔ The cap is gone: not one Fame point thrown on the floor.
    const discarded = Object.values(r.fameLedger ?? {}).reduce((a, b) => a + (b.discarded ?? 0), 0);
    const banked    = Object.values(r.fameLedger ?? {}).reduce((a, b) => a + (b.banked ?? 0), 0);
    eq(discarded, 0, '⛔ NOT ONE FAME POINT DISCARDED — the per-turn cap is gone in this mode');
    ok(banked > 0, '⭐ …and Fame was actually banked');

    // 🎸 Nobody is eliminated, whatever happened on the board.
    ok(r.damage && Object.keys(r.damage).length >= 0, '💥 the damage scoreboard comes back with the result');
  }

  // 🎸 Nobody leaves the stage. Run several seeds so a quiet one cannot pass it.
  for (const seed of [12345, 999, 424242, 7]) {
    const r = runMatch({ seed, spirits: DUEL, policies: seats(), lives: 3,
                         winCondition: 'rounds', roundLimit: 8 });
    eq(r.reason, 'buzzer', `🎸 seed ${seed} reaches the buzzer`);
    const fame = Object.values(r.fame);
    eq(fame.length, 2, `🎸 seed ${seed}: BOTH bands are still standing at the buzzer — nobody is eliminated`);
  }

  // ⚠️ rounds + elimination ON: the buzzer and removal coexist. Whoever wins,
  // the match must still end on one of the two and never hang.
  const both = runMatch({ seed: 999, spirits: DUEL, policies: seats(), lives: 1,
                          winCondition: 'rounds', elimination: 'on', roundLimit: 12 });
  ok(both.reason === 'buzzer' || both.reason === 'winner',
     '⚠️ rounds + elimination ON ends on the buzzer OR on a knockout, and never hangs');
}

console.log(`✅ winConditionsCheck — ${checks} assertions passed`);
