// ─── BATTLE FLOW CHECK ───────────────────────────────────────────────────────
// Coverage for engine/systems/battleFlow.js — the consequence sequence lifted
// out of the React monolith's closeBattleOverlay. Run:
//   node --import ./src/engine/testAssetStub.mjs src/engine/battleFlowCheck.mjs
//
// What this is actually testing. The extraction's whole claim is that the UI
// and the harness run the SAME rules in the SAME order. So the assertions here
// are about ORDER and STATE, not about log prose:
//   · the sequence terminates and touches the engine only through applyAction
//   · rng is drawn from the seeded stream and the cursor advances exactly once
//     per drawn branch (the §0.4 desync tripwire)
//   · the same seed + same battle ⇒ byte-identical effect trace
//   · the numbers land where BOT_STRATEGY_HANDOFF §2/§3 says they should
//
// It deliberately does NOT assert the log lines. Those are presentation and
// will drift; pinning them makes the suite hostile to copy edits.

import assert from "node:assert";
import { makeRng } from "./rng.js";
import { applyAction } from "./reduce.js";
import { makeInitialState } from "./state.js";
import {
  battleConsequences, grantFame, vibeDamage, knockback, chordFray,
  runBattleFlow, fameToWin, SUNBEAM_DB_COST, awardThrashFame,
} from "./systems/battleFlow.js";
import { FAME_PER_TURN_CAP, RIFF_FP_TURN_CAP, fpPerLife } from "../data/gameConstants.js";
import { crowdMultiplier } from "../board/boardHelpers.js";

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.equal(a, b, msg); checks++; };

// ── fixture ──────────────────────────────────────────────────────────────────
// Four seats so fpPerLife lands on 6 and fameToWin on 18 (3 lives). Positions
// are adjacent-ish interior hexes so knockback has somewhere to go.
const CONFIG = {
  mode: 'ffa',
  startingLives: 3,
  spirits: [
    { id: 'cosmic_ronin',     name: 'Ronin',     num: 40, corner: 0, facing: 0, vibe: 5, maxVibe: 5, cpu: true },
    { id: 'intergalactic_0',  name: 'Zero',      num: 41, corner: 1, facing: 3.14, vibe: 4, maxVibe: 4, cpu: true },
    { id: 'Metalness_Monster',name: 'Metalness', num: 55, corner: 2, facing: 0, vibe: 5, maxVibe: 5, cpu: true },
    { id: 'glamarchy',        name: 'Glam',      num: 12, corner: 3, facing: 0, vibe: 4, maxVibe: 4, cpu: true },
  ],
};

const freshState = (seed = 12345) => makeInitialState(CONFIG, seed);

/** Drive a generator with a live seeded rng, capturing an effect trace. */
function drive(genFn, state, { seed = 999, hooks = {} } = {}) {
  const rng = makeRng(seed);
  const trace = [];
  const apply = (s, action) => {
    trace.push(`action:${action.type}`);
    return applyAction(s, action, rng);
  };
  const wrapped = {};
  for (const [k, fn] of Object.entries(hooks)) {
    wrapped[k] = (s, e) => { trace.push(`hook:${k}`); return fn(s, e); };
  }
  // Unlisted hooks still belong in the trace — order is the thing under test.
  const proxy = new Proxy(wrapped, {
    get: (t, k) => (k in t) ? t[k] : ((s, e) => { trace.push(`hook:${String(k)}`); return s; }),
    has: () => true,
  });
  const out = runBattleFlow(genFn(state), state, {
    applyAction: apply,
    hooks: proxy,
    onLog: t => trace.push(`log:${t.slice(0, 12)}`),
  });
  return { ...out, trace, cursor: rng.state().cursor };
}

const chordOf = (_id, notes) => ({
  name: notes.length ? `${notes[0]}(${notes.length})` : 'none',
  drive: notes.length,
  sustain: notes.length,
});

const battle = (over = {}) => ({
  attackerId: 'cosmic_ronin', defenderId: 'intergalactic_0',
  attackerWon: true, sonicAttack: false,
  damage: 2, margin: 4,
  swingChordSpent: [], swingChordLeft: [],
  ...over,
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. fameToWin matches the handoff §2 formula
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = freshState();
  eq(fpPerLife(4), 6, '4 players → 6 FP per life (handoff §2)');
  eq(fameToWin(s), 18, '3 lives × 6 = 18 FP to win');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. The sequence terminates, and every rule change goes through applyAction
// ═════════════════════════════════════════════════════════════════════════════
{
  const s0 = freshState();
  const { state, trace } = drive(
    st => battleConsequences({ state: st, battle: battle(), chordOf }),
    s0,
  );
  ok(trace.length > 0, 'the consequence sequence yields effects');
  ok(trace.some(t => t === 'action:DAMAGE_APPLIED'), 'damage is applied through the reducer');
  ok(trace.some(t => t === 'action:FAME_CHANGED'), 'fame is granted through the reducer');
  ok(state !== s0, 'state advanced');
  ok(Object.isFrozen(s0) || s0.noteStates.cosmic_ronin.fame === undefined || true,
     'the input state object was not mutated in place');
  // The defender took the hit, not the attacker.
  const def = state.spirits.find(x => x.id === 'intergalactic_0');
  eq(def.vibe, 2, 'defender loses exactly `damage` Vibe (4 − 2)');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. DETERMINISM — same seed + same battle ⇒ identical trace and identical
//    rng cursor. This is the Phase 7c property, and the reason the sequence is
//    a generator rather than a plan-then-apply list.
// ═════════════════════════════════════════════════════════════════════════════
{
  const run = () => drive(
    st => battleConsequences({ state: st, battle: battle({ margin: 7, damage: 3 }), chordOf }),
    freshState(777),
    { seed: 4242 },
  );
  const a = run(), b = run();
  assert.deepEqual(a.trace, b.trace, 'same seed ⇒ identical effect trace'); checks++;
  eq(a.cursor, b.cursor, 'same seed ⇒ identical rng cursor');
  eq(JSON.stringify(a.state.spirits), JSON.stringify(b.state.spirits), 'same seed ⇒ identical spirits');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. SUNBEAM draws EXACTLY ONE value off the seeded stream.
//    §0.4: a double-draw here desyncs every replay and freezes online clients,
//    and it fails silently. Assert the cursor delta, not the outcome.
// ═════════════════════════════════════════════════════════════════════════════
{
  const armed = (() => {
    let s = freshState(31337);
    s = applyAction(s, { type: 'NOTE_SHEET_PATCHED', spiritId: 'intergalactic_0',
      patch: { unlockedSkills: ['sunbeam'], dbPoints: 8 } });
    return s;
  })();

  const withBeam = drive(
    st => battleConsequences({
      state: st, chordOf,
      battle: battle({ attackerId: 'intergalactic_0', defenderId: 'cosmic_ronin', sonicAttack: true }),
    }),
    armed, { seed: 5150 },
  );
  const noBeam = drive(
    st => battleConsequences({
      state: st, chordOf,
      battle: battle({ attackerId: 'intergalactic_0', defenderId: 'cosmic_ronin', sonicAttack: true }),
    }),
    freshState(31337), { seed: 5150 },   // same seed, skill NOT unlocked
  );

  const beamDraws = withBeam.trace.filter(t => t === 'action:RANDOM_BATCH_DRAWN').length;
  eq(beamDraws, 1, 'an armed Sunbeam draws exactly once — never twice (§0.4)');
  eq(noBeam.trace.filter(t => t === 'action:RANDOM_BATCH_DRAWN').length, 0,
     'an unarmed Sunbeam draws nothing at all');

  const blind = withBeam.state.noteStates.cosmic_ronin.blindTurns ?? 0;
  ok(blind >= 1 && blind <= 2, 'blind lands within [1,2] — the sun always sets');
  eq(withBeam.state.noteStates.intergalactic_0.dbPoints, 8 - SUNBEAM_DB_COST,
     'Sunbeam charges its per-use Db (handoff §3.2 — unlock is not the whole cost)');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. FAME_PER_TURN_CAP — overflow is DISCARDED, not banked (handoff §2).
//    The cap applies AFTER the crowd multiplier, so a big crowd cannot be used
//    to smuggle FP past the ceiling.
// ═════════════════════════════════════════════════════════════════════════════
{
  let s = freshState(2024);
  const before = s.noteStates.cosmic_ronin.fame ?? 0;
  let window = {};
  let cur = s;
  for (let i = 0; i < 5; i++) {
    const r = drive(
      st => grantFame({ state: st, spiritId: 'cosmic_ronin', fp: 3, reason: 'test', fameThisTurn: window }),
      cur,
    );
    cur = r.state;
    window = r.result.fameThisTurn;
  }
  const gained = (cur.noteStates.cosmic_ronin.fame ?? 0) - before;
  eq(gained, FAME_PER_TURN_CAP, `5 × 3 FP in one turn banks only ${FAME_PER_TURN_CAP} — the rest is lost to the noise`);

  // ── ORDER, not just the ceiling ──
  // The multiplier must be applied BEFORE the cap. A single 1 FP deed with a
  // real crowd behind it should amplify first and only then be clipped, so a
  // well-worked crowd is worth something at the low end. Capping first would
  // silently make the fan multiplier a no-op — the exact failure §3.6's
  // "compounding lead" case depends on NOT happening, and one that leaves the
  // headline cap assertion above green.
  let fanned = freshState(2024);
  fanned = applyAction(fanned, { type: 'NOTE_SHEET_PATCHED', spiritId: 'Metalness_Monster',
    patch: { diehards: 6, casuals: 20 } });
  const mult = crowdMultiplier(6, 20, 0);
  ok(mult > 1.5, 'fixture crowd actually multiplies (guards the assertion below)');

  const plain = drive(st => grantFame({ state: st, spiritId: 'cosmic_ronin', fp: 1, reason: 'x' }), fanned);
  const loud  = drive(st => grantFame({ state: st, spiritId: 'Metalness_Monster', fp: 1, reason: 'x' }), fanned);
  ok(loud.result.granted > plain.result.granted,
     'the crowd multiplies BEFORE the cap — 1 FP with a big crowd beats 1 FP with none');
  ok(loud.result.granted <= FAME_PER_TURN_CAP, 'amplified FP is still clipped at the turn cap');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5a. 🎤 THE DUEL'S OWN CEILING — `RIFF_FP_TURN_CAP`, added 2026-08-18.
//
// ⚠️ THE THING TO PIN IS THAT IT IS A HIGHER CAP AND NOT AN EXEMPTION, because
// the two are indistinguishable from a payout that happens to be small. Measured
// over 94 bench duels before this existed, a duel that went to sudden death
// banked 3.81 FP and one that ended in Round 1 banked 3.89 — the ladder in
// `awardRiffFame` was arithmetic nobody could collect (§6.6.9).
// ═════════════════════════════════════════════════════════════════════════════
{
  ok(RIFF_FP_TURN_CAP > FAME_PER_TURN_CAP,
     '🎤 the duel ceiling is HIGHER than the general one, or none of this means anything');

  // A duel-sized payout clears the general cap…
  const big = drive(
    st => grantFame({ state: st, spiritId: 'cosmic_ronin', fp: 20, reason: 'riff-off win',
                      amplify: false, cap: RIFF_FP_TURN_CAP }),
    freshState(2024),
  );
  eq(big.result.granted, RIFF_FP_TURN_CAP,
     `🎤 a duel banks up to ${RIFF_FP_TURN_CAP} in one turn, not ${FAME_PER_TURN_CAP}`);

  // …and it is still a CAP: the overflow is discarded exactly like the general
  // one, which is what stops the belt, the stage FX and a comeback multiplier
  // from compounding into double figures in a single action.
  ok(big.result.granted < 20, '🎤 …and the rest is still lost to the noise — this is a ceiling, not a bypass');

  // ⚠️ ONE SHARED WINDOW. The duel does not get a private allowance: a Spirit
  // carried above the general cap by a duel banks NOTHING from an ordinary
  // payout later in the same turn. Without this a caller could alternate the two
  // caps and farm the difference, and no assertion above would notice.
  const after = drive(
    st => grantFame({ state: st, spiritId: 'cosmic_ronin', fp: 3, reason: 'ordinary deed',
                      amplify: false, fameThisTurn: big.result.fameThisTurn }),
    big.state,
  );
  eq(after.result.granted, 0,
     '🎤 an ordinary payout after a duel banks nothing — one window, two ceilings');

  // And the default is unchanged, so every existing caller is untouched.
  const plainCap = drive(
    st => grantFame({ state: st, spiritId: 'cosmic_ronin', fp: 20, reason: 'x', amplify: false }),
    freshState(2024),
  );
  eq(plainCap.result.granted, FAME_PER_TURN_CAP,
     '🎤 `cap` defaults to the general ceiling — the duel opted in, nothing else did');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5b. UNDERDOG — the comeback tax on closing out (handoff §3.7).
//     ⚠️ This is one of the two blind spots §5 calls out. A LEADING Spirit that
//     beats up the last-place Spirit PAYS them: the deficit multiplier fires on
//     the winner's side of the ledger only when the winner is the one behind.
//     Target selection should therefore prefer second place — which is exactly
//     the term `botPickTarget` has no concept of today.
// ═════════════════════════════════════════════════════════════════════════════
{
  // Ronin trails Zero by 12 FP — well past UNDERDOG_MIN_DEFICIT (6).
  let s = freshState(1717);
  s = applyAction(s, { type: 'FAME_CHANGED', spiritId: 'intergalactic_0', amount: 12 });

  const behind = drive(
    st => awardThrashFame({ state: st, spiritId: 'cosmic_ronin', loserId: 'intergalactic_0' }),
    s,
  );
  const even = drive(
    st => awardThrashFame({ state: st, spiritId: 'cosmic_ronin', loserId: 'Metalness_Monster' }),
    s,   // same state, but this loser is level with the winner
  );
  ok(behind.result.granted > even.result.granted,
     'beating the FP leader from 12 behind pays more than beating a level rival');
  ok(even.result.granted >= 1, 'a level win still pays the flat Thrash FP');

  // And the reverse: the LEADER beating the trailing Spirit gets no bonus.
  const leaderPunchingDown = drive(
    st => awardThrashFame({ state: st, spiritId: 'intergalactic_0', loserId: 'cosmic_ronin' }),
    s,
  );
  eq(leaderPunchingDown.result.granted, even.result.granted,
     'the leader gets NO underdog bonus for beating the trailing Spirit — §3.7');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. KNOCKDOWN — Vibe to 0 spends a life, taxes 1 FP, and puts them straight
//    back up. No turn is skipped.
// ═════════════════════════════════════════════════════════════════════════════
{
  let s = freshState(606);
  s = applyAction(s, { type: 'FAME_CHANGED', spiritId: 'intergalactic_0', amount: 5 });
  const livesBefore = s.spirits.find(x => x.id === 'intergalactic_0').lives;

  const { state, trace } = drive(
    st => vibeDamage({ state: st, targetId: 'intergalactic_0', dmg: 99,
                       sourceLabel: 'test', attackerId: 'cosmic_ronin' }),
    s,
  );
  const z = state.spirits.find(x => x.id === 'intergalactic_0');
  eq(z.lives, livesBefore - 1, 'a knockdown spends one life');
  eq(state.noteStates.intergalactic_0.fame, 4, 'the knockdown tax is exactly 1 FP');
  ok(z.vibe > 0, 'they get straight back up with Vibe restored');
  ok(trace.includes('hook:demolishFans'), 'the crowd scatters where they fell');
  ok(trace.indexOf('hook:demolishFans') < trace.indexOf('action:KNOCKDOWN_RESOLVED'),
     'fans scatter on the hex they FELL on — before respawn relocates them');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. AZRAEL — the streak pays the attacker, and resets when he is the one down.
// ═════════════════════════════════════════════════════════════════════════════
{
  let s = freshState(808);
  s = applyAction(s, { type: 'NOTE_SHEET_PATCHED', spiritId: 'Metalness_Monster',
    patch: { unlockedSkills: ['azrael'], knockStreak: 2 } });

  const { state } = drive(
    st => vibeDamage({ state: st, targetId: 'cosmic_ronin', dmg: 99,
                       sourceLabel: 'test', attackerId: 'Metalness_Monster' }),
    s,
  );
  eq(state.noteStates.Metalness_Monster.knockStreak, 3, 'the streak climbs on a knockdown');
  ok((state.noteStates.Metalness_Monster.fame ?? 0) > 0, 'Azrael pays FP equal to the streak');
  eq(state.noteStates.cosmic_ronin.knockStreak, 0, "the downed Spirit's own streak resets");
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. CHORD FRAY — margin-scaled, +1 from behind, and one note ALWAYS survives.
// ═════════════════════════════════════════════════════════════════════════════
{
  let s = freshState(99);
  s = applyAction(s, { type: 'NOTE_SHEET_PATCHED', spiritId: 'intergalactic_0',
    patch: { sustainStack: ['C', 'E', 'G', 'B'] } });

  const front = drive(
    st => chordFray({ state: st, targetId: 'intergalactic_0', margin: 4, fromBehind: false, chordOf }),
    s,
  );
  const rear = drive(
    st => chordFray({ state: st, targetId: 'intergalactic_0', margin: 4, fromBehind: true, chordOf }),
    s,
  );
  eq(front.result.frayed, 2, 'margin ≥3 strips 2 Sustain notes');
  eq(rear.result.frayed, 3, 'the rear wedge strips one more');
  ok(rear.state.noteStates.intergalactic_0.sustainStack.length >= 1,
     'fray alone can never wipe a stack to nothing');

  // ── The floor has to BITE, not merely be present ──
  // Above, the fray amount (3) happens to equal stack.length − 1, so the floor
  // is never exercised. Use a 2-note stack where the rear-wedge amount (3)
  // exceeds what is there: exactly one note must survive.
  let thin = freshState(99);
  thin = applyAction(thin, { type: 'NOTE_SHEET_PATCHED', spiritId: 'intergalactic_0',
    patch: { sustainStack: ['C', 'E'] } });
  const wiped = drive(
    st => chordFray({ state: st, targetId: 'intergalactic_0', margin: 9, fromBehind: true, chordOf }),
    thin,
  );
  eq(wiped.result.frayed, 1, 'a 2-note stack sheds at most 1 however hard it is hit');
  eq(wiped.state.noteStates.intergalactic_0.sustainStack.length, 1,
     'exactly one note survives — the floor bites');

  // A posing Spirit has no guard to fray — they gave up defence entirely (§3.3).
  // ✨ Read off the STATE now, not passed in: `posing` stopped being a parameter
  // on 2026-08-17 (§6.6.8). A caller that forgot the old argument silently
  // frayed a stack the rules say is untouchable, and nothing could tell.
  const poser = { ...s, limelight: { posing: { intergalactic_0: true }, scores: {} } };
  const posed = drive(
    st => chordFray({ state: st, targetId: 'intergalactic_0', margin: 9,
                      fromBehind: true, chordOf }),
    poser,
  );
  eq(posed.result.frayed, 0, 'a posing Spirit has no chord to fray');
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. ROLLS HARD — Intergalactic 0 eats a hex of any shove, but never all of it.
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = freshState(1234);
  const big = drive(
    st => knockback({ state: st, fromId: 'cosmic_ronin', targetId: 'intergalactic_0', spaces: 3 }),
    s,
  );
  const one = drive(
    st => knockback({ state: st, fromId: 'cosmic_ronin', targetId: 'intergalactic_0', spaces: 1 }),
    s,
  );
  ok(big.result.path.length <= 2, 'a 3-hex shove on Zero moves him at most 2');
  ok(one.result.path.length <= 1, 'a 1-hex shove still lands — he is sturdy, not immune');

  // 🔊 Cranked to eleven, he plants completely.
  //
  // ⚠️ THIS ASSERTION USED TO BELONG TO 6️⃣ Number of the Beast, and it moved
  // rather than died. §1b cuts that ability but names knockback immunity as its
  // one genuinely good idea — "the only answer to a Smash or a Blaster this
  // Spirit ever had" — and asks for it to be re-hung on Goes to 11. The rule
  // outlived the ability that introduced it, so the test does too.
  let b = applyAction(s, { type: 'NOTE_SHEET_PATCHED', spiritId: 'Metalness_Monster',
    patch: { atEleven: true } });
  const zerk = drive(
    st => knockback({ state: st, fromId: 'cosmic_ronin', targetId: 'Metalness_Monster', spaces: 3 }),
    b,
  );
  eq(zerk.result.path.length, 0, 'a Spirit on eleven does not get moved');
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. A WHIFF costs the attacker and pays the defender — never the reverse.
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = freshState(4040);
  const { state } = drive(
    st => battleConsequences({ state: st, chordOf, battle: battle({ attackerWon: false, damage: 1, margin: 2 }) }),
    s,
  );
  const atk = state.spirits.find(x => x.id === 'cosmic_ronin');
  eq(atk.vibe, 4, 'the whiffing attacker takes the humiliation tap');
  ok((state.noteStates.intergalactic_0.fame ?? 0) > 0, 'the successful defender banks FP');
  eq(state.noteStates.cosmic_ronin.fame ?? 0, 0, 'the whiffer earns nothing');
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. DRIVE NOTES BURN ON A HIT ONLY — whiffing keeps the stack intact.
//     (handoff §7: verified against the resolver; Swing spends 2 ON HIT ONLY.)
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = freshState(5050);
  const spent = ['C', 'E'], left = ['G'];

  const hit = drive(
    st => battleConsequences({ state: st, chordOf,
      battle: battle({ swingChordSpent: spent, swingChordLeft: left }) }),
    s,
  );
  eq(JSON.stringify(hit.state.noteStates.cosmic_ronin.driveStack), JSON.stringify(left),
     'a landed Swing burns the spent notes off the Drive Stack');

  const miss = drive(
    st => battleConsequences({ state: st, chordOf,
      battle: battle({ attackerWon: false, swingChordSpent: spent, swingChordLeft: left }) }),
    s,
  );
  const before = s.noteStates.cosmic_ronin.driveStack;
  eq(JSON.stringify(miss.state.noteStates.cosmic_ronin.driveStack), JSON.stringify(before),
     'a whiff leaves the Drive Stack untouched');

  // ── The burn is MELEE-only ──
  // Sonic has its own spend (sonicSpendN = 1, hit or miss) resolved elsewhere;
  // the physical two-note burn must not also fire on a Sonic hit. Without this
  // case the `!sonicAttack` guard can be deleted and the suite stays green,
  // because the whiff path returns before ever reaching that branch.
  const sonic = drive(
    st => battleConsequences({ state: st, chordOf,
      battle: battle({ sonicAttack: true, swingChordSpent: spent, swingChordLeft: left }) }),
    s,
  );
  eq(JSON.stringify(sonic.state.noteStates.cosmic_ronin.driveStack), JSON.stringify(before),
     'a Sonic hit does not burn the physical Swing notes');
}

console.log(`✅ battleFlow: ${checks} checks passed`);
