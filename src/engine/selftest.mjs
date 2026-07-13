// ─── ENGINE SELF-TEST ────────────────────────────────────────────────────────
// Headless node test — no DOM, no React. Run:  node src/engine/selftest.mjs
// Exits non-zero on failure. Extend with each extraction phase.

import assert from "node:assert/strict";
import { makeRng, restoreRng, hashSeed } from "./rng.js";
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import {
  gameInit, turnStarted, turnEnded, turnSkipped,
  moveBudgetSet, moveStep, beatsSpent, spiritWarped, spiritsSynced,
  spiritFaced, spiritEliminated, spiritPatched,
  riffOffStarted, riffResultsSubmitted, riffResolved, riffRound2Started, riffClosed,
  attackRolled, counterRolled,
  damageApplied, knockdownResolved, winnerDeclared,
  noteStatesSynced, fameChanged, fansChanged, noteSheetPatched, fansTicked,
  debuffsTicked, burnTicked,
  stageFxDrawn, stageFxActivated, stageFxTurnTicked, stageFxRoundTicked,
  godAttackPicked, godSummoned, godDamaged, godActed,
  godDefeated, godTriumphed, godTimerExpired,
  spotlightHealed, spotlightMoved, tokensScattered, flamingDecayed,
  eventRespawnTicked, eventHexSpawned, chargeZonesTicked,
  eventHexTriggered, tokenPickedUp, chargeZoneUsed, flamingHexesSet,
  randomBatchDrawn,
} from "./actions.js";
import { snapshot, restore, replay, assertJsonSafe } from "./serialize.js";
import {
  marginToDamage, fameFromMargin, knockbackSpaces, underdogBonus, smashOutcome,
  decideWinner, resolveKnockdown, counterOutcome,
  thrashDamage, sonicDamage,
} from "./systems/combat.js";
import { usedHas, usedList, usedAdd, performanceScore, makeInitialNoteState } from "./systems/economy.js";
import { skillEligibility, ULTIMATE_PREREQS, THEORY_DISCORD_GRANTS, CQC_SWING_MAP } from "./systems/skills.js";
import { pitchIndex } from "../music/notes.js";
import { detectMotifRepeat } from "../music/cadence.js";
import { CORNERS } from "../data/corners.js";
import { pickGodAttack, godTauntLine, pickRockGod, ROCK_GODS, ROCK_GOD_HP_PER_SPIRIT } from "../data/rockGods.js";
import { applyGodActed } from "./systems/rockGod.js";
import {
  shuffledStageFxDeck, STAGE_FX_IDS,
  SMOKE_START_RADIUS, SMOKE_ROUNDS, LASER_ROUNDS, LASER_BEAM_COUNT,
  PYRO_WAVES, PYRO_WAVE_HEXES, ANIMATRONIC_COUNT, ANIMATRONIC_TURNS,
} from "../data/stageEffects.js";
import {
  LIMELIGHT_HEX, UNDERDOG_MIN_DEFICIT, UNDERDOG_MAX_MULT,
  FAN_BORED_AFTER, FAN_DECAY,
  TOKEN_MAX, EVENT_RESPAWN_TURNS, CHARGE_ZONE_COOLDOWN,
} from "../data/gameConstants.js";
import { hexRingFromCenter } from "../board/boardHelpers.js";
import { HEX_BY_NUM, EDGE_HEX_NUMS } from "../board/hexMap.js";
import { getFlatTopNeighborSlots } from "../board/hexGeometry.js";

// -- rng determinism ----------------------------------------------------------
{
  const a = makeRng(1234), b = makeRng(1234);
  const seqA = [a(), a.int(100), a.pick(["x", "y", "z"]), a.chance(0.5)];
  const seqB = [b(), b.int(100), b.pick(["x", "y", "z"]), b.chance(0.5)];
  assert.deepEqual(seqA, seqB, "same seed → same sequence");

  // restore from {seed, cursor} resumes the exact stream
  const c = makeRng(42);
  c(); c(); c();
  const resumed = restoreRng(c.state());
  assert.equal(c(), resumed(), "restored rng resumes identically");

  // forks are independent + deterministic, and don't advance the parent
  const p1 = makeRng(7), p2 = makeRng(7);
  const f1 = p1.fork("riff"), f2 = p2.fork("riff");
  assert.equal(f1(), f2(), "same fork label → same child stream");
  assert.equal(p1(), p2(), "forking does not consume parent draws");
  assert.notEqual(makeRng(7).fork("riff")(), makeRng(7).fork("events")(),
    "different labels → different streams");
  assert.equal(hashSeed("riff"), hashSeed("riff"), "hashSeed stable");

  // shuffle: deterministic permutation, source untouched
  const src = [1, 2, 3, 4, 5];
  assert.deepEqual(makeRng(9).shuffle(src), makeRng(9).shuffle(src));
  assert.deepEqual(src, [1, 2, 3, 4, 5], "shuffle does not mutate");
}

// -- initial state ------------------------------------------------------------
const config = {
  spirits: [
    { id: "wildaxe", num: 7,  facing: 2, corner: "blue", color: "#4aa3ff", cpu: false },
    { id: "vera",    num: 105, facing: 5, corner: "red", color: "#ff4a6a", cpu: true },
  ],
  mode: "ffa", teams: null, startingLives: 3, beginnerMode: true,
};
{
  const s = makeInitialState(config, 999);
  assert.equal(s.schema, 1);
  assert.equal(s.rng.seed, 999);
  assert.deepEqual(s.turnQueue, ["wildaxe", "vera"], "turnQueue = lobby order of ids");
  assert.equal(s.acting, "wildaxe");
  assert.ok(s.spirits.every(sp => sp.lives === 3), "lives applied");
  assert.equal(JSON.parse(JSON.stringify(s)) instanceof Object, true);
  assert.deepEqual(JSON.parse(snapshot(s)), s, "plain-JSON round-trip is lossless");
}

// -- reducer + serialize + replay ----------------------------------------------
{
  const s0 = makeInitialState(config, 555);
  const s1 = applyAction(s0, gameInit());
  assert.deepEqual({ ...s1, rng: null }, { ...s0, rng: null }, "GAME_INIT is a no-op on rules state");
  assert.deepEqual(s0, makeInitialState(config, 555), "applyAction never mutates input");

  const restored = restore(snapshot(s1));
  assert.deepEqual(restored, s1, "snapshot/restore round-trip");

  const replayed = replay(makeInitialState(config, 555), [gameInit()]);
  assert.deepEqual(replayed, s1, "replay reproduces identical state");
}

// -- Phase 2: turn & movement ---------------------------------------------------
{
  const s0 = makeInitialState(config, 777);

  // move budget + tripped halving (min 1)
  assert.equal(applyAction(s0, moveBudgetSet(5)).turn.moveStepsLeft, 5);
  assert.equal(applyAction(s0, moveBudgetSet(5, true)).turn.moveStepsLeft, 2);
  assert.equal(applyAction(s0, moveBudgetSet(1, true)).turn.moveStepsLeft, 1);

  // plain move: steps down 1, position + facing update, lastMove report
  const neighbor = getFlatTopNeighborSlots(HEX_BY_NUM[7])[0].num;
  let s = applyAction(s0, moveBudgetSet(3));
  s = applyAction(s, moveStep("wildaxe", neighbor));
  const sp = s.spirits.find(x => x.id === "wildaxe");
  assert.equal(sp.num, neighbor, "spirit moved");
  assert.equal(typeof sp.facing, "number");
  assert.equal(s.turn.moveStepsLeft, 2);
  assert.deepEqual(
    { to: s.turn.lastMove.to, stepsLeft: s.turn.lastMove.stepsLeft, redirected: false },
    { to: neighbor, stepsLeft: 2, redirected: s.turn.lastMove.redirected });

  // dazed move is deterministic under a fixed seed + replayable
  const dazedOnce = applyAction(s0, moveStep("wildaxe", neighbor, true));
  const dazedTwice = applyAction(s0, moveStep("wildaxe", neighbor, true));
  assert.deepEqual(dazedOnce, dazedTwice, "same state+seed → same dazed outcome");
  assert.ok(HEX_BY_NUM[dazedOnce.turn.lastMove.to], "dazed always lands on-board");

  // beats: combat costs + action token; `all` zeroes
  let b = applyAction(s0, moveBudgetSet(4));
  b = applyAction(b, beatsSpent(2, true));
  assert.deepEqual(
    [b.turn.moveStepsLeft, b.turn.actionTokenUsed], [2, true]);
  assert.equal(applyAction(b, beatsSpent(0, true, { all: true })).turn.moveStepsLeft, 0);
  assert.equal(applyAction(b, beatsSpent(99)).turn.moveStepsLeft, 0, "clamped at 0");

  // warp: position change + AP cost, facing untouched
  const w = applyAction(b, spiritWarped("wildaxe", 50, 2));
  assert.equal(w.spirits.find(x => x.id === "wildaxe").num, 50);
  assert.equal(w.turn.moveStepsLeft, 0);
  assert.equal(w.spirits.find(x => x.id === "wildaxe").facing,
    b.spirits.find(x => x.id === "wildaxe").facing);

  // limelight: started + ended on the hex → limelightHeld
  const onLime = applyAction(s0,
    spiritsSynced(s0.spirits.map(x => x.id === "wildaxe" ? { ...x, num: LIMELIGHT_HEX } : x)));
  const started = applyAction(onLime, turnStarted("wildaxe"));
  assert.equal(started.turn.startedOnLimelight.wildaxe, true);
  const ended = applyAction(started, turnEnded());
  assert.equal(ended.turn.lastReport.limelightHeld, true);
  assert.equal(ended.turn.lastReport.endedId, "wildaxe");
  assert.equal(ended.acting, "vera", "queue advanced");
  assert.deepEqual([ended.turn.moveStepsLeft, ended.turn.actionTokenUsed], [0, false]);

  // no limelight payout without starting there (first-turn case included)
  const endedCold = applyAction(onLime, turnEnded());
  assert.equal(endedCold.turn.lastReport.limelightHeld, false);

  // round completion: 2 alive spirits → every 2nd turn
  const t1 = applyAction(s0, turnEnded());
  assert.equal(t1.turn.lastReport.roundCompleted, false);
  const t2 = applyAction(t1, turnEnded());
  assert.equal(t2.turn.lastReport.roundCompleted, true);
  assert.equal(t2.turn.count, 2);

  // skip: queue advances, counter does NOT
  const sk = applyAction(s0, turnSkipped());
  assert.equal(sk.acting, "vera");
  assert.equal(sk.turn.count, 0);
  assert.equal(sk.turn.lastReport.type, "turnSkipped");

  // full mini-turn replay determinism
  const log = [gameInit(), turnStarted("wildaxe"), moveBudgetSet(4),
    moveStep("wildaxe", neighbor, true), beatsSpent(1, true), turnEnded()];
  const live = log.reduce((st, a) => applyAction(st, a), makeInitialState(config, 4242));
  const replayed = replay(restore(snapshot(makeInitialState(config, 4242))), log);
  assert.deepEqual(replayed, live, "phase-2 action log replays identically");
}

// -- facing + elimination -------------------------------------------------------
{
  const s0 = makeInitialState(config, 31337);
  let f = applyAction(s0, moveBudgetSet(3));
  f = applyAction(f, spiritFaced("wildaxe", 4));
  assert.equal(f.spirits.find(x => x.id === "wildaxe").facing, 4);
  assert.equal(f.turn.moveStepsLeft, 2, "facing costs 1 step");
  assert.equal(f.spirits.find(x => x.id === "wildaxe").num, 7, "facing does not move");

  const e = applyAction(s0, spiritEliminated("vera"));
  assert.deepEqual(e.turnQueue, ["wildaxe"]);
  assert.equal(e.acting, "wildaxe", "acting untouched when survivor acts");
  const e2 = applyAction(s0, spiritEliminated("wildaxe"));
  assert.equal(e2.acting, "vera", "acting falls to queue head when head eliminated");
}

// -- Phase 4: riff-off seam -------------------------------------------------
{
  const s0 = makeInitialState(config, 2026);
  const started = applyAction(s0, riffOffStarted("wildaxe", "vera", { slayer: true, eRush: true }));
  const b = started.battle;
  assert.equal(b.kind, "riffOff");
  assert.equal(b.atkRiff.degrees.length, 6);
  assert.equal(b.defRiff.degrees.length, 6);
  assert.ok(b.defGlitch.length >= 2 && b.defGlitch.length <= 3, "slayer glitches 2-3 notes");
  assert.equal(b.defGhosts.length, 6, "eRush ghosts every answer note");
  assert.deepEqual(started, applyAction(s0, riffOffStarted("wildaxe", "vera", { slayer: true, eRush: true })),
    "same seed → identical riffs, glitches, ghosts");

  // score win: clean attacker vs sloppy defender
  const mkResults = grades => grades.map((g, i) =>
    ({ hit: g !== "miss" && g !== "wrong", rt: 200 + i, grade: g, noteIdx: i }));
  let s = applyAction(started, riffResultsSubmitted("attacker",
    mkResults(["perfect","perfect","good","perfect","good","perfect"])));
  s = applyAction(s, riffResultsSubmitted("defender",
    mkResults(["ok","miss","good","miss","ok","miss"])));
  s = applyAction(s, riffResolved());
  const v = s.battle.verdict;
  assert.equal(v.attackerWon, true);
  assert.ok(v.margin >= 1);
  assert.equal(v.tie, false);
  assert.equal(v.decidedBy, "performance");
  // 🎸 Phase 3e: damage is decided in the verdict (round 1 → no round bonus).
  assert.equal(v.damage, marginToDamage(v.margin), "round-1 verdict damage = marginToDamage(margin)");
  assert.deepEqual(s.battle.r1, { won: true, tie: false, margin: v.margin }, "round-1 edge remembered");

  // double whiff = tie → zero damage
  let t = applyAction(started, riffResultsSubmitted("attacker", mkResults(["miss","miss","miss","miss","miss","miss"])));
  t = applyAction(t, riffResultsSubmitted("defender", mkResults(["miss","miss","miss","miss","miss","miss"])));
  const tv = applyAction(t, riffResolved()).battle.verdict;
  assert.equal(tv.tie, true);
  assert.equal(tv.damage, 0, "a tie deals no damage");

  // round 2: fresh faster riffs, mods rerolled, r1 kept, results cleared
  const r2 = applyAction(s, riffRound2Started());
  assert.equal(r2.battle.round, 2);
  assert.notDeepEqual(r2.battle.atkRiff.degrees, s.battle.atkRiff.degrees);
  assert.ok(r2.battle.atkRiff.rhythm.every(x => x.window <= 1600), "round 2 sped up");
  assert.ok(r2.battle.defGlitch.length >= 2, "slayer carries into round 2");
  assert.equal(r2.battle.defGhosts.length, 6, "ghosts carry into round 2");
  assert.equal(r2.battle.atkResults, null);
  assert.deepEqual(r2.battle.r1, s.battle.r1);

  // dead-even round 2 falls back to round-1 edge
  let f = applyAction(r2, riffResultsSubmitted("attacker", mkResults(["miss","miss","miss","miss","miss","miss"])));
  f = applyAction(f, riffResultsSubmitted("defender", mkResults(["miss","miss","miss","miss","miss","miss"])));
  const fv = applyAction(f, riffResolved()).battle.verdict;
  assert.equal(fv.tie, false, "round-1 edge breaks the round-2 dead heat");
  assert.equal(fv.attackerWon, true);
  assert.equal(fv.decidedBy, "Round 1 edge · Round 2");
  // 🎸 Phase 3e: round-2 damage takes the extra band (margin + 1).
  assert.equal(fv.damage, marginToDamage(fv.margin + 1), "round-2 verdict damage adds the round bonus");

  // close clears the slice
  assert.equal(applyAction(f, riffClosed()).battle, null);
}

// -- Phase 3a: combat math ------------------------------------------------------
{
  // damage table: band boundaries (≤3,≤6,≤9,≤12, else)
  assert.deepEqual(
    [1, 3, 4, 6, 7, 9, 10, 12, 13, 99].map(marginToDamage),
    [1, 1, 2, 2, 3, 3, 4, 4, 5, 5], "marginToDamage bands");

  // fame table: ≤3→1, ≤6→2, else 3
  assert.deepEqual(
    [1, 3, 4, 6, 7, 99].map(fameFromMargin),
    [1, 1, 2, 2, 3, 3], "fameFromMargin bands");

  // knockback: swing always 1 hex regardless of margin
  assert.equal(knockbackSpaces({ sonicAttack: false }, 9), 1, "swing = 1 hex");
  assert.equal(knockbackSpaces({}, 5), 1, "non-sonic = 1 hex");
  // sonic: margin 1-2→1, 3-4→2, 5+→3 (capped)
  assert.deepEqual(
    [1, 2, 3, 4, 5, 12].map(m => knockbackSpaces({ sonicAttack: true }, m)),
    [1, 1, 2, 2, 3, 3], "sonic knockback scales + caps at 3");
  // margin falls back to bs.margin, then 1
  assert.equal(knockbackSpaces({ sonicAttack: true, margin: 4 }), 2, "bs.margin fallback");
  assert.equal(knockbackSpaces({ sonicAttack: true }), 1, "default margin 1");

  // underdog: below the deficit floor → no bonus, deficit reported 0
  assert.deepEqual(
    underdogBonus(10, 10 + UNDERDOG_MIN_DEFICIT - 1, 2),
    { fp: 2, deficit: 0, mult: 1 }, "sub-threshold deficit → no bonus");

  // at exactly the floor (6): ramp ×1.5, but clamped so it never overshoots.
  // base 2, deficit 6 → round(2×1.5)=3, maxFp=max(2,6)=6 → 3.
  {
    const r = underdogBonus(0, UNDERDOG_MIN_DEFICIT, 2);
    assert.equal(r.deficit, UNDERDOG_MIN_DEFICIT);
    assert.equal(r.mult, 1.5);
    assert.equal(r.fp, 3, "6-deficit ramps base 2 → 3");
  }

  // big deficit clamps at the multiplier ceiling AND at the close-the-gap cap.
  // base 3, deficit 60 → mult capped at UNDERDOG_MAX_MULT; fp then clamped so
  // it never exceeds the deficit (would-be huge, capped to a level-up at most).
  {
    const r = underdogBonus(0, 60, 3);
    assert.equal(r.mult, UNDERDOG_MAX_MULT, "multiplier hits the ceiling");
    assert.ok(r.fp <= Math.max(3, 60), "fp never overshoots past the loser");
    assert.equal(r.fp, Math.min(Math.round(3 * UNDERDOG_MAX_MULT), 60));
  }

  // exact match with the old Game math across a grid (regression guard)
  const oldUnderdog = (wFame, lFame, baseFp) => {
    const deficit = lFame - wFame;
    if (deficit < UNDERDOG_MIN_DEFICIT) return { fp: baseFp, deficit: 0, mult: 1 };
    const mult = Math.min(UNDERDOG_MAX_MULT, 1 + (deficit / 6) * 0.5);
    let fp = Math.round(baseFp * mult);
    fp = Math.min(fp, Math.max(baseFp, deficit));
    return { fp, deficit, mult };
  };
  for (const w of [0, 3, 7, 15]) for (const l of [0, 5, 6, 12, 20, 40])
    for (const base of [1, 2, 3])
      assert.deepEqual(underdogBonus(w, l, base), oldUnderdog(w, l, base),
        `underdogBonus matches old math (w=${w},l=${l},base=${base})`);
}

// -- Phase 3b: ATTACK_ROLLED (swing) --------------------------------------------
{
  const mk = (over = {}) => attackRolled("swing", "wildaxe", "vera",
    { atkStat: 7, defStat: 5, ...over });

  // determinism: same state+seed+action → identical verdict
  assert.deepEqual(
    applyAction(makeInitialState(config, 8181), mk()).battle,
    applyAction(makeInitialState(config, 8181), mk()).battle,
    "same seed → identical roll");

  // structural invariants across many seeds
  for (let seed = 1; seed <= 300; seed++) {
    const b = applyAction(makeInitialState(config, seed), mk()).battle;
    assert.equal(b.kind, "attack");
    assert.equal(b.attackKind, "swing");
    assert.ok(b.atkRoll >= 1 && b.atkRoll <= 6, "atk d6 in range");
    assert.ok(b.defRoll >= 1 && b.defRoll <= 6, "def d6 in range");
    assert.equal(b.atkTotal, 7 + b.atkRoll, "atkTotal = stat + roll");
    assert.equal(b.defTotal, 5 + b.defRoll, "defTotal = stat + roll");
    assert.equal(b.attackerWon, b.atkTotal > b.defTotal);
    assert.equal(b.margin, Math.abs(b.atkTotal - b.defTotal));
    assert.equal(b.damage, thrashDamage(b.margin, !b.attackerWon), "swing damage = thrashDamage(margin, isAttackerLoss)");
  }

  // posing defender rolls nothing → defRoll 0, defTotal 0, attacker always wins
  for (let seed = 1; seed <= 60; seed++) {
    const b = applyAction(makeInitialState(config, seed), mk({ posing: true })).battle;
    assert.deepEqual([b.defRoll, b.defTotal, b.attackerWon], [0, 0, true]);
    assert.equal(b.margin, b.atkTotal);
  }

  // Laser Show halves the defender die (min 1); rawDefRoll is preserved
  for (let seed = 1; seed <= 100; seed++) {
    const b = applyAction(makeInitialState(config, seed), mk({ halveDef: true })).battle;
    assert.equal(b.defRoll, Math.max(1, Math.floor(b.rawDefRoll / 2)), "laser halves def die");
  }

  // Psycho Bushido: fires iff eligible & not posing & atkRoll ≥ 5, dropping def die to 1
  let triggered = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const b = applyAction(makeInitialState(config, seed), mk({ psychoEligible: true })).battle;
    assert.equal(b.psychoBushido, b.atkRoll >= 5, "bushido iff 5/6");
    if (b.psychoBushido) { triggered++; assert.equal(b.defRoll, 1, "bushido drops def die to 1"); }
  }
  assert.ok(triggered > 0, "bushido fires on some seed");
  for (let seed = 1; seed <= 100; seed++) {
    const b = applyAction(makeInitialState(config, seed), mk()).battle; // not eligible
    assert.equal(b.psychoBushido, false, "no skill → no bushido even on a 5/6");
  }

  // verdict regression: recompute the OLD Game math from the SAME engine rolls
  for (let seed = 1; seed <= 200; seed++) {
    const b = applyAction(makeInitialState(config, seed), mk({ halveDef: true, psychoEligible: true })).battle;
    const atkStat = 7, defStat = 5;
    let defRoll = Math.max(1, Math.floor(b.rawDefRoll / 2));
    const bushido = b.atkRoll >= 5;
    if (bushido) defRoll = 1;
    const atkTotal = atkStat + b.atkRoll, defTotal = defStat + defRoll;
    assert.deepEqual(
      [b.defRoll, b.atkTotal, b.defTotal, b.attackerWon, b.margin, b.damage, b.psychoBushido],
      [defRoll, atkTotal, defTotal, atkTotal > defTotal, Math.abs(atkTotal - defTotal),
        thrashDamage(Math.abs(atkTotal - defTotal), !(atkTotal > defTotal)), bushido],
      "swing verdict matches thrashDamage given identical rolls");
  }

  // battle slice is JSON-serializable (crosses the network / replay log)
  const bs = applyAction(makeInitialState(config, 5), mk()).battle;
  assert.deepEqual(JSON.parse(JSON.stringify(bs)), bs, "attack battle is plain JSON");

  // swing records no dice pool
  assert.equal(bs.diceVals, null, "swing has no pool");
  assert.equal(bs.keptIdx, null);
}

// -- Phase 3b: ATTACK_ROLLED (sonic keep-highest pool) --------------------------
{
  const sonic = (pool, over = {}) => attackRolled("sonic", "wildaxe", "vera",
    { atkStat: 6, defStat: 4, dicePool: pool, ...over });

  for (const pool of [[6, 6], [6, 6, 6], [6, 6, 8], [8, 8, 8]]) {
    for (let seed = 1; seed <= 200; seed++) {
      const b = applyAction(makeInitialState(config, seed), sonic(pool)).battle;
      assert.equal(b.diceVals.length, pool.length, "one value per die");
      b.diceVals.forEach((v, i) =>
        assert.ok(v >= 1 && v <= pool[i], `die ${i} within [1, ${pool[i]}]`));
      assert.equal(b.atkRoll, Math.max(...b.diceVals), "keeps the highest die");
      assert.equal(b.keptIdx, b.diceVals.indexOf(b.atkRoll), "keptIdx points at the max");
      assert.equal(b.atkTotal, 6 + b.atkRoll);
      assert.equal(b.defTotal, 4 + b.defRoll);
      assert.equal(b.margin, Math.abs(b.atkTotal - b.defTotal));
      assert.equal(b.damage, sonicDamage(b.margin), "sonic damage = sonicDamage(margin)");
    }
  }

  // determinism over the pool
  assert.deepEqual(
    applyAction(makeInitialState(config, 321), sonic([6, 6, 8])).battle,
    applyAction(makeInitialState(config, 321), sonic([6, 6, 8])).battle,
    "same seed → identical sonic roll");

  // 3d8 can punch past a d6 ceiling — at least one seed rolls atkRoll ≥ 7
  let big = false;
  for (let seed = 1; seed <= 300 && !big; seed++)
    if (applyAction(makeInitialState(config, seed), sonic([8, 8, 8])).battle.atkRoll >= 7) big = true;
  assert.ok(big, "3d8 pool can exceed a d6 ceiling");

  // posing defender still rolls nothing under a sonic pool
  for (let seed = 1; seed <= 40; seed++) {
    const b = applyAction(makeInitialState(config, seed), sonic([6, 6], { posing: true })).battle;
    assert.deepEqual([b.defRoll, b.defTotal, b.attackerWon], [0, 0, true]);
  }

  // sonic verdict regression vs old Game math given identical rolls
  for (let seed = 1; seed <= 200; seed++) {
    const b = applyAction(makeInitialState(config, seed), sonic([6, 6, 8], { halveDef: true })).battle;
    const atkRoll = Math.max(...b.diceVals);
    const defRoll = Math.max(1, Math.floor(b.rawDefRoll / 2));
    const at = 6 + atkRoll, dt = 4 + defRoll;
    assert.deepEqual(
      [b.atkRoll, b.defRoll, b.atkTotal, b.defTotal, b.attackerWon, b.margin, b.damage],
      [atkRoll, defRoll, at, dt, at > dt, Math.abs(at - dt), sonicDamage(Math.abs(at - dt))],
      "sonic verdict matches sonicDamage");
  }
}

// -- Phase 3b: smashOutcome (deterministic, no roll) ----------------------------
{
  // exact regression vs the old Game math across the whole throw range + flags
  const old = (thrown, roninSmasher, roninTarget) => {
    const baseDmg   = Math.min(5, Math.max(1, Math.ceil(thrown / 2)));
    const damage    = roninSmasher ? Math.max(1, Math.floor(baseDmg / 2)) : baseDmg;
    const knockback = Math.min(3, Math.ceil(thrown / 3));
    const scatterN  = Math.floor(thrown / 2) * (roninTarget ? 2 : 1);
    return { damage, knockback, scatterN };
  };
  for (let thrown = 2; thrown <= 14; thrown++)
    for (const rs of [false, true]) for (const rt of [false, true])
      assert.deepEqual(
        smashOutcome(thrown, { roninSmasher: rs, roninTarget: rt }),
        old(thrown, rs, rt), `smash math (thrown=${thrown}, rs=${rs}, rt=${rt})`);

  // spot checks: caps + Ronin modifiers
  assert.deepEqual(smashOutcome(2), { damage: 1, knockback: 1, scatterN: 1 });
  assert.deepEqual(smashOutcome(4), { damage: 2, knockback: 2, scatterN: 2 });
  assert.equal(smashOutcome(99).damage, 5, "damage caps at 5");
  assert.equal(smashOutcome(99).knockback, 3, "knockback caps at 3");
  assert.equal(smashOutcome(8, { roninSmasher: true }).damage, 2, "Ronin's own Smash lands soft (≈half)");
  assert.equal(smashOutcome(2, { roninSmasher: true }).damage, 1, "soft Smash floored at 1");
  assert.equal(smashOutcome(6, { roninTarget: true }).scatterN, 6, "Ronin target scatters double");

  // Blaster of Ra parity: base (non-Ronin) damage/knockback/scatter match a Smash
  const s = smashOutcome(7);
  assert.deepEqual([s.damage, s.knockback, s.scatterN], [4, 3, 3], "Blaster shares the Smash formula");
}

// -- Phase 3c kernels: decideWinner + resolveKnockdown --------------------------
{
  const sp = (id, over = {}) => ({ id, knockedOut: false, lives: 3, ...over });

  // one survivor wins
  assert.deepEqual(
    decideWinner([sp("a", { knockedOut: true }), sp("b")]),
    { winnerId: "b", godTriumphs: false }, "last standing wins");
  // more than one alive → no winner yet
  assert.deepEqual(decideWinner([sp("a"), sp("b")]),
    { winnerId: null, godTriumphs: false }, "two alive → undecided");

  // boss on board: last-standing does NOT win while the God holds the gate
  assert.deepEqual(
    decideWinner([sp("a", { knockedOut: true }), sp("b")], { godSummoned: true }),
    { winnerId: null, godTriumphs: false }, "God holds — no PvP winner");
  // boss on board + total wipe → God triumphs
  assert.deepEqual(
    decideWinner([sp("a", { knockedOut: true }), sp("b", { knockedOut: true })], { godSummoned: true }),
    { winnerId: null, godTriumphs: true }, "total wipe → God triumphs");
  // once a winner already exists the God branch is bypassed
  assert.equal(
    decideWinner([sp("a"), sp("b", { knockedOut: true })], { godSummoned: true, hasWinner: true }).winnerId,
    "a", "existing winner bypasses the God hold");

  // resolveKnockdown — respawn to home corner with full Vibe, one life spent
  const cornerId = Object.keys(CORNERS)[0];
  const home = CORNERS[cornerId].homeNum;
  const downed = { id: "wildaxe", lives: 3, num: 42, facing: 3, corner: cornerId, maxVibe: 10, vibe: 0 };
  const kd = resolveKnockdown(downed, CORNERS);
  assert.equal(kd.respawned, true);
  assert.equal(kd.livesLeft, 2);
  assert.equal(kd.next.num, home, "respawns at home corner");
  assert.equal(kd.next.vibe, 10, "restored to full Vibe");
  assert.equal(kd.next.knockedOut ?? false, false, "still in the game");

  // out of lives → knocked out for good, position untouched
  const last = { id: "vera", lives: 1, num: 77, facing: 1, corner: cornerId, maxVibe: 8, vibe: 0 };
  const ko = resolveKnockdown(last, CORNERS);
  assert.deepEqual([ko.respawned, ko.livesLeft], [false, 0]);
  assert.equal(ko.next.knockedOut, true);
  assert.equal(ko.next.lives, 0);
  assert.equal(ko.next.num, 77, "KO leaves the body where it fell");

  // corner-less fallback: respawn in place (num/facing unchanged)
  const nc = resolveKnockdown({ id: "x", lives: 2, num: 5, facing: 4, corner: null, maxVibe: 9, vibe: 0 }, CORNERS);
  assert.deepEqual([nc.next.num, nc.next.facing, nc.next.vibe], [5, 4, 9]);
}

// -- Phase 3d: COUNTER_ROLLED + counterOutcome ----------------------------------
{
  // an attack must be on the slice first (counter merges into it)
  const withAttack = seed => applyAction(makeInitialState(config, seed),
    attackRolled("swing", "wildaxe", "vera", { atkStat: 7, defStat: 5 }));
  const counter = (seed, over = {}) => applyAction(withAttack(seed),
    counterRolled("vera", { vibe: 6, maxVibe: 10, target: 4, ...over })).battle;

  // determinism + preserves the attack fields it merges into
  const a = counter(4242), b = counter(4242);
  assert.deepEqual(a, b, "same seed → identical counter");
  assert.equal(a.kind, "attack", "counter merges into the live battle slice");
  assert.equal(a.attackKind, "swing");

  for (let seed = 1; seed <= 300; seed++) {
    const c = counter(seed);
    assert.ok(c.counterRoll >= 1 && c.counterRoll <= 6, "counter d6 in range");
    assert.equal(c.vibeBonus, Math.round((6 / 10) * 3), "vibe bonus = round(6/10*3)=2");
    assert.equal(c.counterTotal, c.counterRoll + c.vibeBonus, "total = roll + bonus");
    assert.equal(c.counterTarget, 4);
    assert.equal(c.counterSuccess, c.counterTotal >= 4, "success clears the target die");
  }

  // vibe bonus scales 0..3 with the Vibe fraction
  assert.equal(counter(1, { vibe: 0, maxVibe: 10 }).vibeBonus, 0, "empty Vibe → +0");
  assert.equal(counter(1, { vibe: 10, maxVibe: 10 }).vibeBonus, 3, "full Vibe → +3");
  assert.equal(counter(1, { vibe: 5, maxVibe: 10 }).vibeBonus, 2, "half Vibe → round(1.5)=2");

  // a trivially-low target is always cleared; an impossible one never is
  assert.equal(counter(7, { vibe: 10, maxVibe: 10, target: 1 }).counterSuccess, true);
  assert.equal(counter(7, { vibe: 0, maxVibe: 10, target: 99 }).counterSuccess, false);

  // counterOutcome: landed-counter margin/damage vs the old Game math
  for (let total = 1; total <= 12; total++)
    for (let tgt = 1; tgt <= 6; tgt++) {
      const m = Math.max(1, total - tgt + 1);
      assert.deepEqual(counterOutcome(total, tgt),
        { counterMargin: m, counterDmg: marginToDamage(m) },
        `counterOutcome(${total},${tgt})`);
    }
}

// -- Phase 5a: usedStockIdx Set→array contract helpers --------------------------
{
  // These reproduce the OLD JS-Set semantics exactly, but on a plain JSON array.
  // The reference is the literal old code: `new Set([...used, ...idxs])` spread
  // back to an array — i.e. insertion order + dedup. Sorting is deliberately NOT
  // used (startNewTurnNotes recharges spent slots in insertion order).

  // membership — array, legacy Set, and empty/undefined
  assert.equal(usedHas([3, 1, 5], 5), true);
  assert.equal(usedHas([3, 1, 5], 9), false);
  assert.equal(usedHas(new Set([4, 2]), 2), true, "accepts a legacy Set defensively");
  assert.equal(usedHas(undefined, 0), false, "undefined → not a member");

  // usedList — fresh array copy, insertion order preserved, never the same ref
  const srcArr = [2, 0, 7];
  const listed = usedList(srcArr);
  assert.deepEqual(listed, [2, 0, 7], "usedList preserves order");
  assert.notEqual(listed, srcArr, "usedList returns a copy (mutating it can't corrupt state)");
  assert.deepEqual(usedList(new Set([2, 0, 7])), [2, 0, 7], "usedList from a legacy Set (insertion order)");
  assert.deepEqual(usedList(undefined), [], "usedList(undefined) → []");

  // usedAdd — insertion-ordered dedup, returns a NEW array, source untouched
  const base = [];
  assert.deepEqual(usedAdd(base, 3), [3]);
  assert.deepEqual(usedAdd([3], 3), [3], "adding an existing index is a no-op (dedup)");
  assert.deepEqual(usedAdd([3, 1, 5], 1, 8, 3), [3, 1, 5, 8], "keeps first-seen order, drops dups");
  assert.deepEqual(usedAdd([3, 1, 5], [8, 1]), [3, 1, 5, 8], "accepts an array arg (…unusedIdxs path)");
  assert.deepEqual(base, [], "usedAdd never mutates its input");

  // equivalence to the exact old expression it replaces, over a fuzz grid
  for (let trial = 0; trial < 200; trial++) {
    const start = Array.from({ length: (trial * 7) % 6 }, (_, k) => (trial * 3 + k * 5) % 9);
    const adds  = Array.from({ length: (trial * 5) % 5 }, (_, k) => (trial + k * 4) % 9);
    const oldWay = [...new Set([...start, ...adds])];              // literal old code
    const newWay = usedAdd(usedList(start), adds);                 // helper path
    assert.deepEqual(newWay, oldWay, `usedAdd ≡ new Set([...used, ...idxs]) (trial ${trial})`);
  }

  // the field is plain JSON now (survives snapshot/replay — the Phase-8 contract)
  assert.deepEqual(JSON.parse(JSON.stringify(usedAdd([], 2, 5))), [2, 5],
    "usedStockIdx is plain-JSON serializable");
}

// -- Phase 5a: performanceScore kernel ≡ old inline confirmNoteTrack math --------
{
  // The reference is the ORIGINAL inline P formula, verbatim. Extraction is a
  // no-op on behavior iff the kernel matches it for every track+flag combo.
  const POOL = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const oldP = (ml, f) => {
    const pc = ml.map(pitchIndex).filter(p => p >= 0);
    const diff = [];
    for (let i = 1; i < pc.length; i++) { let d = ((pc[i]-pc[i-1])%12+12)%12; if (d>6) d-=12; diff.push(d); }
    let dc = 0, pd = 0;
    for (const d of diff) { const s = Math.sign(d); if (s && pd && s !== pd) dc++; if (s) pd = s; }
    const leaps = diff.filter(d => Math.abs(d) >= 3).length;
    const intdiv = new Set(diff.filter(d => d).map(d => Math.abs(d))).size;
    const dpc = new Set(pc).size;
    let r3 = false;
    for (let i = 2; i < ml.length; i++) if (ml[i]===ml[i-1] && ml[i-1]===ml[i-2]) { r3 = true; break; }
    const shape = Math.min(2,dc) + Math.min(2,leaps) + (intdiv>=2?1:0) + (intdiv>=3?1:0);
    const pal = (dpc>=3 && !r3 ? 1:0) + (dpc>=5?1:0);
    const gest = Math.min(3, (f.tri?1:0)+(f.oct?1:0)+(f.dia>=3?1:0)+(f.rep>=3?1:0)+(f.skip>=3?1:0)+(f.gated?1:0));
    const m0 = detectMotifRepeat(ml); const motif = (m0.period>=3?2:0) + (m0.reps>=3?1:0);
    const big = (f.riff?3:0) + (f.cad?1:0);
    const len = Math.floor(f.earned/3);
    const pdisc = f.free ? Math.max(0, f.disc-1) : f.disc;
    const pfree = (f.free && f.disc>=1) ? 1 : 0;
    const score = Math.max(0, Math.min(10, shape+pal+gest+motif+big+len+(f.edge?2:0)+(f.sus?1:0)+pfree-pdisc));
    return { score, freestyle: pfree };
  };
  let seed = 12345; const rnd = () => { seed = (seed*1103515245+12345) & 0x7fffffff; return seed/0x7fffffff; };
  for (let t = 0; t < 3000; t++) {
    const len = Math.floor(rnd()*9);
    const ml = Array.from({ length: len }, () => POOL[Math.floor(rnd()*12)]);
    const f = {
      tri: rnd()<.4, oct: rnd()<.3, dia: Math.floor(rnd()*6), rep: Math.floor(rnd()*6), skip: Math.floor(rnd()*6),
      gated: rnd()<.5, riff: rnd()<.15, cad: rnd()<.3, earned: Math.floor(rnd()*12),
      edge: rnd()<.25, sus: rnd()<.2, disc: Math.floor(rnd()*4), free: rnd()<.3,
    };
    assert.deepEqual(
      performanceScore({ melodyLine: ml, trackHasTritone: f.tri, isOctaveResolution: f.oct,
        diatonicRunLen: f.dia, repeatPatLen: f.rep, skipClimbLen: f.skip, hasGatedEnding: f.gated,
        hasRiff: f.riff, cadenceResolved: f.cad, earned: f.earned, edgeResolved: f.edge,
        susEnd: f.sus, discordCount: f.disc, freestylePardon: f.free }),
      oldP(ml, f), `performanceScore matches old inline math (trial ${t})`);
  }
  // clamp + freestyle spot checks
  assert.equal(performanceScore({ melodyLine: [], trackHasTritone: false, isOctaveResolution: false,
    diatonicRunLen: 0, repeatPatLen: 0, skipClimbLen: 0, hasGatedEnding: false, hasRiff: false,
    cadenceResolved: false, earned: 0, edgeResolved: false, susEnd: false, discordCount: 5,
    freestylePardon: false }).score, 0, "P floors at 0 under heavy discord");
  assert.deepEqual(performanceScore({ melodyLine: ["C","D"], trackHasTritone: false, isOctaveResolution: false,
    diatonicRunLen: 0, repeatPatLen: 0, skipClimbLen: 0, hasGatedEnding: false, hasRiff: false,
    cadenceResolved: false, earned: 0, edgeResolved: false, susEnd: false, discordCount: 2,
    freestylePardon: true }), performanceScore({ melodyLine: ["C","D"], trackHasTritone: false,
    isOctaveResolution: false, diatonicRunLen: 0, repeatPatLen: 0, skipClimbLen: 0, hasGatedEnding: false,
    hasRiff: false, cadenceResolved: false, earned: 0, edgeResolved: false, susEnd: false, discordCount: 2,
    freestylePardon: true }), "deterministic (pure)");
}

// -- Phase 5b: skillEligibility ≡ old bot + human gating ------------------------
{
  // References = the ORIGINAL two implementations, verbatim.
  const botOld = (sk, unlocked, selfId, ownerRoute) => {
    if (!sk || unlocked.includes(sk.id)) return false;
    if (ownerRoute && ownerRoute !== selfId) return false;
    if (sk.prereq === "__all_pa__")
      return ["mic", "pedal_dist", "amp_1", "mixer"].every(id => unlocked.includes(id));
    if (sk.prereq && !unlocked.includes(sk.prereq)) return false;
    if (sk.chainId === "pa" && sk.id !== "amp_1" && !unlocked.includes("amp_1")) return false;
    return true;
  };
  // old human path (no owner check): returns the toast it would have shown, or "" to proceed.
  const humanOld = (sk, unlocked) => {
    if (unlocked.includes(sk.id)) return "already";
    if (sk.prereq && sk.prereq !== "__all_pa__") {
      if (!unlocked.includes(sk.prereq)) return `❌ Requires ${sk.prereq} first.`;
    }
    if (sk.prereq === "__all_pa__") {
      const missing = ["mic", "pedal_dist", "amp_1", "mixer"].filter(id => !unlocked.includes(id));
      if (missing.length) return `❌ Ultimate requires: ${missing.join(", ")}`;
    }
    if (sk.chainId === "pa" && sk.id !== "amp_1" && !unlocked.includes("amp_1")) return `❌ PA system requires Amp I first.`;
    return "";
  };
  // new human wrapper reproduced from Game.setSkillTarget's reason mapping
  const humanNew = (sk, unlocked) => {
    const e = skillEligibility(sk, unlocked);
    if (e.ok) return "";
    if (e.reason === "prereq")        return `❌ Requires ${sk.prereq} first.`;
    if (e.reason === "ultimate")      return `❌ Ultimate requires: ${e.missing.join(", ")}`;
    if (e.reason === "pa")            return `❌ PA system requires Amp I first.`;
    return "already"; // already-unlocked is filtered before this block in Game; matches humanOld
  };

  // synthetic skills covering every branch
  const SK = {
    a:      { id: "a" },
    b:      { id: "b", prereq: "a" },
    ult:    { id: "ult", prereq: "__all_pa__" },
    pa2:    { id: "pa2", chainId: "pa" },
    amp_1:  { id: "amp_1", chainId: "pa" },
    ronin:  { id: "ronin", routeId: "shredding_ronin" },
  };
  const ROUTE = { shredding_ronin: "cosmic_ronin", metalness: "Metalness_Monster" };
  const POOL = ["a", "b", "mic", "pedal_dist", "amp_1", "mixer", "pa2", "ult", "ronin"];
  const selves = [null, "cosmic_ronin", "vera"];

  let seed = 999; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let t = 0; t < 4000; t++) {
    const unlocked = POOL.filter(() => rnd() < 0.5);
    const sk = SK[Object.keys(SK)[Math.floor(rnd() * Object.keys(SK).length)]];
    const selfId = selves[Math.floor(rnd() * selves.length)];
    const ownerRoute = sk.routeId ? ROUTE[sk.routeId] : null;
    // bot equivalence
    assert.equal(
      skillEligibility(sk, unlocked, { ownerRoute, selfId }).ok,
      botOld(sk, unlocked, selfId, ownerRoute),
      `skillEligibility.ok ≡ botSkillEligible (t${t})`);
    // human equivalence (no owner route)
    assert.equal(humanNew(sk, unlocked), humanOld(sk, unlocked),
      `human toast ≡ old setSkillTarget (t${t})`);
  }

  // spot checks on reasons + missing list
  assert.deepEqual(skillEligibility(SK.ult, ["mic", "amp_1"]),
    { ok: false, reason: "ultimate", missing: ["pedal_dist", "mixer"] }, "ultimate reports missing PA parts");
  assert.deepEqual(skillEligibility(SK.ult, ["mic", "pedal_dist", "amp_1", "mixer"]), { ok: true }, "full PA → Ultimate opens");
  assert.deepEqual(skillEligibility(SK.pa2, []), { ok: false, reason: "pa" }, "pa chain needs amp_1");
  assert.deepEqual(skillEligibility(SK.amp_1, []), { ok: true }, "amp_1 itself is exempt from the pa gate");
  assert.deepEqual(skillEligibility(SK.b, ["b"]), { ok: false, reason: "already" }, "already-unlocked");
  assert.deepEqual(skillEligibility(SK.ronin, [], { ownerRoute: "cosmic_ronin", selfId: "vera" }),
    { ok: false, reason: "owner" }, "owner-only route blocks non-owner");
  assert.deepEqual(skillEligibility(SK.ronin, [], { ownerRoute: "cosmic_ronin", selfId: "cosmic_ronin" }),
    { ok: true }, "owner may take their signature skill");

  // grant tables intact
  assert.deepEqual(THEORY_DISCORD_GRANTS.theory_chromatic, ["discord_2", "discord_4"]);
  assert.equal(CQC_SWING_MAP.baki_gravity, "swing_3");
  assert.deepEqual(ULTIMATE_PREREQS, ["mic", "pedal_dist", "amp_1", "mixer"]);
}

// -- Phase 5c foundation: combat-ownership actions on engine spirits ------------
{
  const cornerId = Object.keys(CORNERS)[0];
  const home = CORNERS[cornerId].homeNum;
  // Seed a full spirit shape (Vibe/lives/corner) via the Phase-2 sync bridge.
  const seed = applyAction(makeInitialState(config, 314), spiritsSynced([
    { id: "wildaxe", num: 42, facing: 3, corner: cornerId, color: "#fff", cpu: false, lives: 3, vibe: 10, maxVibe: 10, knockedOut: false },
    { id: "vera",    num: 77, facing: 1, corner: cornerId, color: "#f00", cpu: true,  lives: 1, vibe: 2,  maxVibe: 8,  knockedOut: false },
  ]));

  // DAMAGE_APPLIED — subtract Vibe, floor at 0, only the target, never mutate input
  const d = applyAction(seed, damageApplied("wildaxe", 4));
  assert.equal(d.spirits.find(s => s.id === "wildaxe").vibe, 6, "damage subtracts Vibe");
  assert.equal(d.spirits.find(s => s.id === "vera").vibe, 2, "other spirit untouched");
  assert.equal(applyAction(seed, damageApplied("wildaxe", 999)).spirits.find(s => s.id === "wildaxe").vibe, 0, "Vibe floors at 0");
  assert.equal(seed.spirits.find(s => s.id === "wildaxe").vibe, 10, "applyAction never mutates input");
  assert.equal(applyAction(seed, damageApplied("ghost", 3)).spirits.length, 2, "damage to an unknown id is a no-op");

  // KNOCKDOWN_RESOLVED — respawn (lives > 1): life spent, home corner, full Vibe, still in
  const w = applyAction(seed, knockdownResolved("wildaxe")).spirits.find(s => s.id === "wildaxe");
  assert.deepEqual([w.lives, w.num, w.vibe, w.knockedOut ?? false], [2, home, 10, false], "respawn: home corner, full Vibe, one life spent");
  // KNOCKDOWN_RESOLVED — KO (last life): knockedOut, lives 0, body stays where it fell
  const koState = applyAction(seed, knockdownResolved("vera"));
  const v = koState.spirits.find(s => s.id === "vera");
  assert.deepEqual([v.lives, v.knockedOut, v.num], [0, true, 77], "out of lives → KO in place");
  // reducer branch == the resolveKnockdown kernel directly (single source)
  assert.deepEqual(v, resolveKnockdown(seed.spirits.find(s => s.id === "vera")).next,
    "KNOCKDOWN_RESOLVED == resolveKnockdown kernel");

  // WINNER_DECLARED — records the winner slice
  assert.equal(seed.winner, null, "winner starts null");
  assert.equal(applyAction(seed, winnerDeclared("wildaxe")).winner, "wildaxe", "winner locked in");

  // all three are plain-JSON + replay-deterministic (the multiplayer contract)
  const log = [damageApplied("vera", 5), knockdownResolved("vera"), winnerDeclared("wildaxe")];
  const live = log.reduce((st, a) => applyAction(st, a), seed);
  assert.deepEqual(replay(restore(snapshot(seed)), log), live, "5c-foundation actions replay identically");
  assert.deepEqual(JSON.parse(snapshot(live)), live, "post-flip state is plain JSON");
}

// -- Phase 5c foundation: engine builds + owns noteStates (seeded, dormant) -----
{
  const s = makeInitialState(config, 4242);
  assert.deepEqual(Object.keys(s.noteStates).sort(), ["vera", "wildaxe"], "a note sheet per spirit");
  const ns = s.noteStates.wildaxe;
  assert.equal(typeof ns.rootNote, "string", "root note built");
  assert.equal(ns.noteStock.length, 8, "default stock size 8");
  assert.deepEqual(ns.usedStockIdx, [], "usedStockIdx is a JSON array (5a)");
  assert.equal(ns.chordStack.length, 2, "opens on a power chord");
  assert.equal(ns.scaleMode, "major");
  assert.equal(ns.pivotPending, true);

  // building note sheets must NOT consume the main rng stream (it forks) → cursor 0,
  // so every existing roll downstream is byte-identical to before this landed.
  assert.equal(s.rng.cursor, 0, "note-sheet build does not advance the main rng");

  // seeded + deterministic: same seed → identical sheets (the replay contract)
  assert.deepEqual(makeInitialState(config, 4242).noteStates, s.noteStates, "same seed → identical note sheets");
  // matches an independent rebuild on the same forked stream (single source of truth)
  const rebuilt = {};
  const frng = makeRng(4242 >>> 0).fork("noteStatesInit");
  for (const sp of s.spirits) rebuilt[sp.id] = makeInitialNoteState(sp.id, frng);
  assert.deepEqual(rebuilt, s.noteStates, "makeInitialState builds via makeInitialNoteState on the forked rng");

  // still plain-JSON (no Set/Map/function slipped in) — the Phase-8 contract
  assert.deepEqual(JSON.parse(JSON.stringify(s.noteStates)), s.noteStates, "note sheets are plain JSON");

  // NOTE_STATES_SYNCED bridge (client-flip): full-map replace, engine authoritative.
  const bumped = { ...s.noteStates, wildaxe: { ...s.noteStates.wildaxe, fame: 42 } };
  const s2 = applyAction(s, noteStatesSynced(bumped));
  assert.equal(s2.noteStates.wildaxe.fame, 42, "NOTE_STATES_SYNCED replaces the note map");
  assert.equal(s2.noteStates.vera, s.noteStates.vera, "untouched sheets carry over by reference");
  assert.equal(s2.rng.cursor, s.rng.cursor, "the bridge consumes no rng");

  // FAME_CHANGED — signed delta, floored at 0
  const f0 = s.noteStates.wildaxe.fame ?? 0;
  const fUp = applyAction(s, fameChanged("wildaxe", 5));
  assert.equal(fUp.noteStates.wildaxe.fame, f0 + 5, "FAME_CHANGED adds a positive delta");
  const fDn = applyAction(fUp, fameChanged("wildaxe", -100));
  assert.equal(fDn.noteStates.wildaxe.fame, 0, "FAME_CHANGED floors Fame at 0");
  assert.equal(applyAction(s, fameChanged("nobody", 5)).noteStates, s.noteStates, "no sheet → no-op");

  // FANS_CHANGED — whitelisted fan-field patch
  const fanPatch = { casuals: 7, diehards: 3, centerStreak: 2, outerStreak: 1, fanLag: 4,
                     fanActedThisTurn: true, divineShield: 1, fame: 999, unlockedSkills: ["hax"] };
  const fFan = applyAction(s, fansChanged("wildaxe", fanPatch));
  assert.equal(fFan.noteStates.wildaxe.casuals, 7,  "FANS_CHANGED patches casuals");
  assert.equal(fFan.noteStates.wildaxe.diehards, 3, "FANS_CHANGED patches diehards");
  assert.equal(fFan.noteStates.wildaxe.centerStreak, 2, "FANS_CHANGED patches centerStreak");
  assert.equal(fFan.noteStates.wildaxe.outerStreak, 1,  "FANS_CHANGED patches outerStreak");
  assert.equal(fFan.noteStates.wildaxe.fanLag, 4,       "FANS_CHANGED patches fanLag");
  assert.equal(fFan.noteStates.wildaxe.fanActedThisTurn, true, "FANS_CHANGED patches fanActedThisTurn");
  assert.equal(fFan.noteStates.wildaxe.divineShield, 1, "FANS_CHANGED patches divineShield");
  assert.equal(fFan.noteStates.wildaxe.fame, s.noteStates.wildaxe.fame,
    "FANS_CHANGED can NOT touch fame (whitelist filter)");
  assert.deepEqual(fFan.noteStates.wildaxe.unlockedSkills, s.noteStates.wildaxe.unlockedSkills,
    "FANS_CHANGED can NOT touch skills (whitelist filter)");
  assert.equal(fFan.noteStates.vera, s.noteStates.vera, "untouched sheets carry over by reference");
  assert.equal(fFan.rng.cursor, s.rng.cursor, "FANS_CHANGED consumes no rng");
  assert.equal(applyAction(s, fansChanged("nobody", { casuals: 1 })).noteStates, s.noteStates,
    "FANS_CHANGED: no sheet → no-op");

  // NOTE_SHEET_PATCHED — the shim's generic per-spirit diff action
  const p1 = applyAction(s, noteSheetPatched("wildaxe",
    { hcPoints: 4, unlockedSkills: ["mic"], burn: { turnsLeft: 2 }, fame: 6 }));
  assert.equal(p1.noteStates.wildaxe.hcPoints, 4, "NOTE_SHEET_PATCHED merges scalar fields");
  assert.deepEqual(p1.noteStates.wildaxe.unlockedSkills, ["mic"], "…and array fields");
  assert.deepEqual(p1.noteStates.wildaxe.burn, { turnsLeft: 2 }, "…and object fields");
  assert.equal(p1.noteStates.wildaxe.fame, 6, "no whitelist — any sheet field may ride");
  assert.equal(p1.noteStates.wildaxe.rootNote, s.noteStates.wildaxe.rootNote,
    "unpatched fields carry over");
  assert.equal(p1.noteStates.vera, s.noteStates.vera, "untouched sheets carry over by reference");
  assert.equal(p1.rng.cursor, s.rng.cursor, "NOTE_SHEET_PATCHED consumes no rng");
  assert.equal(applyAction(s, noteSheetPatched("nobody", { hcPoints: 1 })).noteStates, s.noteStates,
    "NOTE_SHEET_PATCHED: no sheet → no-op (the shim falls back to the full replace)");

  // SPIRIT_PATCHED — the setSpirits shim's generic per-spirit diff action
  const waBefore = s.spirits.find(x => x.id === "wildaxe");
  const veraBefore = s.spirits.find(x => x.id === "vera");
  const sp1 = applyAction(s, spiritPatched("wildaxe",
    { vibe: 2, num: 42, facing: 3, drive: 7, customFlag: true }));
  const wa1 = sp1.spirits.find(x => x.id === "wildaxe");
  assert.equal(wa1.vibe, 2,   "SPIRIT_PATCHED merges vibe");
  assert.equal(wa1.num, 42,   "…and position");
  assert.equal(wa1.facing, 3, "…and facing");
  assert.equal(wa1.drive, 7,  "…and drive");
  assert.equal(wa1.customFlag, true, "no whitelist — any spirit field may ride");
  assert.equal(wa1.corner, waBefore.corner, "unpatched fields carry over");
  assert.equal(wa1.lives, waBefore.lives, "unpatched fields carry over (lives)");
  assert.equal(sp1.spirits.find(x => x.id === "vera"), veraBefore,
    "untouched spirits carry over by reference");
  assert.equal(sp1.rng.cursor, s.rng.cursor, "SPIRIT_PATCHED consumes no rng");
  assert.equal(applyAction(s, spiritPatched("nobody", { vibe: 1 })).spirits, s.spirits,
    "SPIRIT_PATCHED: unknown id → no-op (the shim falls back to the full replace)");
}

// -- Phase 5d: FANS_TICKED — the end-of-turn fan tick as an engine rule ---------
{
  const nums = Object.values(HEX_BY_NUM).map(h => h.num);
  const hexIn = ring => nums.find(n => hexRingFromCenter(n) === ring);
  const backHex = hexIn("back"), floorHex = hexIn("floor"), pitHex = hexIn("pit");
  assert.ok(backHex != null && floorHex != null && pitHex != null, "fixture hexes exist");

  const base = makeInitialState(config, 616);
  // place wildaxe + shape its fan block, then tick
  const tick = (num, fanOver) => {
    let st = applyAction(base, spiritsSynced(base.spirits.map(x => x.id === "wildaxe" ? { ...x, num } : x)));
    st = applyAction(st, noteStatesSynced({ ...st.noteStates,
      wildaxe: { ...st.noteStates.wildaxe, ...fanOver } }));
    const pre = st.rng.cursor;
    const out = applyAction(st, fansTicked("wildaxe"));
    assert.equal(out.rng.cursor, pre, "FANS_TICKED consumes no rng");
    return out;
  };

  // centre (acted): streaks kept, outer reset, acted-flag cleared, lag recovers
  let t = tick(LIMELIGHT_HEX, { centerStreak: 2, outerStreak: 2, fanLag: 3, fanActedThisTurn: true, casuals: 6 });
  let w = t.noteStates.wildaxe;
  assert.deepEqual(
    [w.centerStreak, w.outerStreak, w.fanLag, w.fanActedThisTurn, w.casuals], [2, 0, 2, false, 6],
    "main+acted: centre streak survives, outer resets, lag −1, acted clears, crowd kept");
  assert.deepEqual(t.turn.lastFanTick, { spiritId: "wildaxe", zone: "main", lost: 0 }, "report rides in turn.lastFanTick");

  // centre (idle): the promote streak breaks
  w = tick(pitHex, { centerStreak: 4, fanActedThisTurn: false }).noteStates.wildaxe;
  assert.equal(w.centerStreak, 0, "pit+idle: idle in the spotlight breaks the streak");

  // floor: neutral — no boredom, no loyalty
  w = tick(floorHex, { centerStreak: 3, outerStreak: 2, casuals: 6 }).noteStates.wildaxe;
  assert.deepEqual([w.centerStreak, w.outerStreak, w.casuals], [0, 0, 6], "floor resets both streaks, keeps the crowd");

  // outer edge: streak builds; decay bites only once it reaches FAN_BORED_AFTER
  w = tick(backHex, { outerStreak: 0, casuals: 6 }).noteStates.wildaxe;
  assert.deepEqual([w.outerStreak, w.casuals], [1, 6], "first outer turn: no decay yet");
  t = tick(backHex, { outerStreak: FAN_BORED_AFTER - 1, casuals: 6 });
  w = t.noteStates.wildaxe;
  assert.deepEqual([w.outerStreak, w.casuals], [FAN_BORED_AFTER, 6 - FAN_DECAY], "grace exhausted: casuals drift");
  assert.equal(t.turn.lastFanTick.lost, FAN_DECAY, "report carries the loss");
  w = tick(backHex, { outerStreak: FAN_BORED_AFTER, casuals: 1 }).noteStates.wildaxe;
  assert.equal(w.casuals, 0, "decay floors at 0");

  // no sheet → no-op; deterministic + replayable
  assert.equal(applyAction(base, fansTicked("nobody")).noteStates, base.noteStates, "no sheet → no-op");
  const logT = [fansTicked("wildaxe"), turnEnded(), fansTicked("vera")];
  const liveT = logT.reduce((st, a) => applyAction(st, a), base);
  assert.equal(snapshot(replay(restore(snapshot(base)), logT)), snapshot(liveT), "FANS_TICKED replays byte-identically");
}

// -- Phase 6b: stage-FX deck + threshold draws (engine-owned) -------------------
{
  const s0 = makeInitialState(config, 909);
  // seeded deck: a permutation, deterministic per seed, main rng untouched
  assert.deepEqual([...s0.stageFx.deck].sort(), [...STAGE_FX_IDS].sort(), "deck is a permutation of the effects");
  assert.deepEqual(makeInitialState(config, 909).stageFx.deck, s0.stageFx.deck, "same seed → same deck order");
  assert.equal(s0.rng.cursor, 0, "deck build does not advance the main rng (forked)");
  assert.deepEqual(s0.stageFx.fired, [], "no thresholds fired at start");

  // draws follow the deck in firing order
  const d1 = applyAction(s0, stageFxDrawn(8));
  assert.deepEqual(d1.stageFx.lastDraw, { threshold: 8, fxId: s0.stageFx.deck[0] }, "first draw = deck[0]");
  assert.deepEqual(d1.stageFx.fired, [8], "threshold recorded");
  const d2 = applyAction(d1, stageFxDrawn(16));
  assert.deepEqual(d2.stageFx.lastDraw, { threshold: 16, fxId: s0.stageFx.deck[1] }, "second draw = deck[1]");

  // exactly-once: a duplicate threshold is a dead draw (the old firedRef guarantee)
  const dup = applyAction(d2, stageFxDrawn(8));
  assert.equal(dup.stageFx.lastDraw, null, "duplicate threshold → lastDraw null");
  assert.deepEqual(dup.stageFx.fired, [8, 16], "duplicate does not re-fire");

  // deterministic + serializable + rng-free
  assert.equal(d2.rng.cursor, s0.rng.cursor, "draws consume no rng");
  const logF = [stageFxDrawn(8), stageFxDrawn(16), stageFxDrawn(8), stageFxDrawn(24)];
  const liveF = logF.reduce((st, a) => applyAction(st, a), s0);
  assert.equal(snapshot(replay(restore(snapshot(s0)), logF)), snapshot(liveF), "STAGE_FX_DRAWN replays byte-identically");
  assert.equal(assertJsonSafe(liveF), true, "stageFx slice is JSON-safe");
}

// -- Phase 6b: ACTIVE stage effects + ticks (engine-owned) ----------------------
// STAGE_FX_ACTIVATED creates the live effect (patterns/spawns on engine rng);
// STAGE_FX_TURN_TICKED runs the pyro cadence + animatronic steps;
// STAGE_FX_ROUND_TICKED spreads/clears smoke and re-patterns/kills the lasers.
// Rules ported verbatim from the client tickStageFxTurn/tickStageFxRound.
{
  const cornerId = Object.keys(CORNERS)[0];
  const seed = (base, positions) => applyAction(base, spiritsSynced([
    { id: "wildaxe", num: positions.wildaxe, facing: 2, corner: cornerId, lives: 3, vibe: 10, maxVibe: 10, knockedOut: false },
    { id: "vera",    num: positions.vera,    facing: 5, corner: cornerId, lives: 3, vibe: 8,  maxVibe: 8,  knockedOut: false },
  ]));
  const s0 = seed(makeInitialState(config, 4242), { wildaxe: 7, vera: 40 });

  // 💨 SMOKE — activation shape; spreads per round; clears at the end
  {
    const on = applyAction(s0, stageFxActivated("smoke_machine"));
    assert.deepEqual(on.stageFx.smoke, { radius: SMOKE_START_RADIUS, roundsLeft: SMOKE_ROUNDS },
      "smoke activates at the start radius");
    assert.equal(on.rng.cursor, s0.rng.cursor, "smoke activation consumes no rng");
    let st = on;
    for (let r = 1; r < SMOKE_ROUNDS; r++) {
      st = applyAction(st, stageFxRoundTicked());
      assert.deepEqual(st.stageFx.lastRoundTick.smoke,
        { event: "spread", radius: SMOKE_START_RADIUS + r, left: SMOKE_ROUNDS - r },
        `round ${r}: smoke spreads one ring`);
    }
    st = applyAction(st, stageFxRoundTicked());
    assert.equal(st.stageFx.smoke, null, "smoke clears after its rounds");
    assert.deepEqual(st.stageFx.lastRoundTick.smoke, { event: "cleared" }, "clear reported");
  }

  // 🔺 LASERS — seeded pattern; zap report lists spirits standing in beams;
  // re-patterns per round then powers down
  {
    const on = applyAction(s0, stageFxActivated("laser_show"));
    const lz = on.stageFx.laser;
    assert.equal(lz.beams.length, LASER_BEAM_COUNT, "beam count");
    assert.equal(lz.roundsLeft, LASER_ROUNDS, "laser round clock");
    assert.ok(on.rng.cursor > s0.rng.cursor, "beam pattern rolls on engine rng");
    assert.deepEqual(applyAction(s0, stageFxActivated("laser_show")).stageFx.laser, lz,
      "same seed → same pattern");
    // plant a spirit ON a beam hex → the fresh-pattern zap must report them
    const beamHex = lz.beams[0].hexes[0];
    const planted = applyAction(seed(makeInitialState(config, 4242), { wildaxe: beamHex, vera: 40 }),
      stageFxActivated("laser_show"));
    assert.ok(planted.stageFx.lastActivation.zapped.includes("wildaxe"),
      "spirit standing in a fresh beam is reported zapped");
    // re-pattern: new beams, one less round, zap re-checked; then off
    let st = on;
    for (let r = 1; r < LASER_ROUNDS; r++) {
      st = applyAction(st, stageFxRoundTicked());
      assert.equal(st.stageFx.lastRoundTick.laser.event, "repatterned", `round ${r}: re-patterns`);
      assert.equal(st.stageFx.laser.roundsLeft, LASER_ROUNDS - r, "clock ticks down");
    }
    st = applyAction(st, stageFxRoundTicked());
    assert.equal(st.stageFx.laser, null, "laser rig powers down");
    assert.deepEqual(st.stageFx.lastRoundTick.laser, { event: "off" }, "power-down reported");
  }

  // 🎆 PYRO — arm → erupt (caught computed from engine spirits) → re-arm
  // excluding the spent wave → finale → burnout
  {
    const on = applyAction(s0, stageFxActivated("pyrotechnics"));
    assert.equal(on.stageFx.pyro.phase, "arming", "pyro arms first");
    assert.equal(on.stageFx.pyro.wave, 1, "wave 1");
    assert.equal(on.stageFx.pyro.hexes.length, PYRO_WAVE_HEXES[0], "wave-1 hex count");
    // plant a spirit on an armed hex → eruption catches them
    const hot = on.stageFx.pyro.hexes[0];
    let st = seed(on, { wildaxe: hot, vera: 40 });
    st = applyAction(st, stageFxTurnTicked());
    assert.equal(st.stageFx.pyro.phase, "erupting", "armed charges blow");
    assert.deepEqual(st.stageFx.lastTurnTick.pyro,
      { event: "erupted", wave: 1, hexes: on.stageFx.pyro.hexes, caught: ["wildaxe"] },
      "eruption reports the caught spirit");
    // re-arm: next wave's hexes avoid the spent wave
    st = applyAction(st, stageFxTurnTicked());
    assert.equal(st.stageFx.pyro.phase, "arming", "next wave arms");
    assert.equal(st.stageFx.pyro.wave, 2, "wave 2");
    assert.ok(st.stageFx.pyro.hexes.every(h => !on.stageFx.pyro.hexes.includes(h)),
      "fresh charges avoid the previous wave");
    // run out the remaining waves → burnout
    for (let w = 2; w <= PYRO_WAVES; w++) {
      st = applyAction(st, stageFxTurnTicked());               // erupt wave w
      if (w < PYRO_WAVES) st = applyAction(st, stageFxTurnTicked()); // re-arm w+1
    }
    st = applyAction(st, stageFxTurnTicked());
    assert.equal(st.stageFx.pyro, null, "show burns out after the finale");
    assert.deepEqual(st.stageFx.lastTurnTick.pyro, { event: "burnout" }, "burnout reported");
  }

  // 🤖 ANIMATRONICS — deterministic-keyed spawn on free edge hexes; steps
  // toward the nearest spirit each turn; slams get reported; clock expiry
  {
    const occupied = [7, 40];
    const on = applyAction(s0, stageFxActivated("animatronics", occupied));
    const bots = on.stageFx.animatronics;
    assert.equal(bots.length, ANIMATRONIC_COUNT, "spawn count");
    assert.ok(bots.every(b => /^anim-t\d+-\d+$/.test(b.key)), "keys are deterministic (no Date.now)");
    assert.ok(bots.every(b => EDGE_HEX_NUMS.has(b.num) && !occupied.includes(b.num)),
      "bots spawn on free edge hexes");   // EDGE_HEX_NUMS is a Set
    assert.ok(bots.every(b => b.turnsLeft === ANIMATRONIC_TURNS), "full clocks");
    assert.deepEqual(applyAction(s0, stageFxActivated("animatronics", occupied)).stageFx.animatronics,
      bots, "same seed → same spawn");
    // one tick: every surviving bot moved-or-lunged and its clock ticked down
    const t1 = applyAction(on, stageFxTurnTicked());
    assert.equal(t1.stageFx.animatronics.length, ANIMATRONIC_COUNT, "no expiry yet");
    assert.ok(t1.stageFx.animatronics.every(b => b.turnsLeft === ANIMATRONIC_TURNS - 1),
      "clocks tick");
    // run the clock out — bots expire and are removed
    let st = on;
    for (let i = 0; i < ANIMATRONIC_TURNS; i++) st = applyAction(st, stageFxTurnTicked());
    assert.equal(st.stageFx.animatronics.length, 0, "bots wind down after their turns");
    assert.equal(st.stageFx.lastTurnTick.anim.expired, ANIMATRONIC_COUNT, "expiry reported");
    // a bot adjacent to a spirit lunges: plant vera next to a bot's spawn hex
    const bHex = HEX_BY_NUM[bots[0].num];
    const nHex = getFlatTopNeighborSlots(bHex)[0]?.num;
    if (nHex != null) {
      const near = seed(on, { wildaxe: 7, vera: nHex });
      const hit = applyAction(near, stageFxTurnTicked()).stageFx.lastTurnTick.anim.hits;
      assert.ok(hit.some(h => h.victimId === "vera"), "adjacent spirit gets slammed");
    }
  }

  // idle ticks are cheap no-ops with null-field reports; everything replays +
  // stays JSON-safe end to end
  {
    const idle = applyAction(s0, stageFxTurnTicked());
    assert.deepEqual(idle.stageFx.lastTurnTick, { pyro: null, anim: null }, "no active FX → null report");
    const log = [
      stageFxActivated("pyrotechnics"),
      stageFxTurnTicked(),
      stageFxActivated("laser_show"),
      stageFxRoundTicked(),
      stageFxActivated("animatronics", [7, 40]),
      stageFxTurnTicked(),
      stageFxActivated("smoke_machine"),
      stageFxRoundTicked(),
    ];
    const live = log.reduce((st, a) => applyAction(st, a), s0);
    assert.equal(snapshot(replay(restore(snapshot(s0)), log)), snapshot(live),
      "active-FX lifecycle replays byte-identically");
    assert.equal(assertJsonSafe(live), true, "active-FX state is JSON-safe");
  }
}

// -- Phase 6c: GOD_ATTACK_PICKED — the boss's attack pick on engine rng ---------
{
  const s0 = makeInitialState(config, 1717);

  // determinism: same state+seed → same pick; picks are valid deck entries
  const p1 = applyAction(s0, godAttackPicked("bardbarian"));
  const p2 = applyAction(s0, godAttackPicked("bardbarian"));
  assert.deepEqual(p1.rockGod.lastPick, p2.rockGod.lastPick, "same seed → same pick");
  assert.ok(ROCK_GODS.bardbarian.attacks.some(a => a.id === p1.rockGod.lastPick.attackId),
    "pick is a real attack of the god");
  assert.equal(p1.rockGod.lastPick.godId, "bardbarian");
  assert.ok(p1.rng.cursor > s0.rng.cursor, "the pick consumes engine rng");

  // no immediate repeat across many seeds
  for (let seed = 1; seed <= 120; seed++) {
    const last = ROCK_GODS.bardbarian.attacks[seed % ROCK_GODS.bardbarian.attacks.length].id;
    const pick = applyAction(makeInitialState(config, seed), godAttackPicked("bardbarian", last))
      .rockGod.lastPick.attackId;
    assert.notEqual(pick, last, `no immediate repeat (seed ${seed})`);
  }

  // unknown god / empty deck → null pick
  assert.equal(applyAction(s0, godAttackPicked("nobody")).rockGod.lastPick, null, "unknown god → null");
  assert.equal(applyAction(s0, godAttackPicked("glam_reaper")).rockGod.lastPick, null, "empty deck → null");

  // replayable byte-for-byte (rng cursor rides in state)
  const logG = [godAttackPicked("bardbarian"), godAttackPicked("bardbarian", "thunderclap")];
  const liveG = logG.reduce((st, a) => applyAction(st, a), s0);
  assert.equal(snapshot(replay(restore(snapshot(s0)), logG)), snapshot(liveG), "GOD_ATTACK_PICKED replays byte-identically");
  assert.equal(assertJsonSafe(liveG), true, "rockGod pick slice is JSON-safe");
}

// -- Phase 6c: Rock God state ownership (summon / damage / act / outcome) -------
// The boss is engine state now: GOD_SUMMONED / GOD_DAMAGED (winded ×2 + HP
// floor) / GOD_ACTED (telegraph resolve → winded recovery → weighted open;
// mosh moves the engine spirits) / GOD_DEFEATED / GOD_TRIUMPHED /
// GOD_TIMER_EXPIRED. Rules ported verbatim from the client ROCK GOD SYSTEM.
{
  const cornerId = Object.keys(CORNERS)[0];
  const seedSpirits = (base, positions) => applyAction(base, spiritsSynced([
    { id: "wildaxe", num: positions.wildaxe, facing: 2, corner: cornerId, lives: 3, vibe: 10, maxVibe: 10, knockedOut: false },
    { id: "vera",    num: positions.vera,    facing: 5, corner: cornerId, lives: 3, vibe: 8,  maxVibe: 8,  knockedOut: false },
  ]));
  const s0 = seedSpirits(makeInitialState(config, 6606), { wildaxe: 40, vera: 105 });

  // 🌩️ SUMMON — one god per game; HP scales with the engine's living spirits
  const up = applyAction(s0, godSummoned("wildaxe", "bardbarian"));
  assert.equal(up.rockGod.summoned, true, "summoned flag set");
  assert.equal(up.rockGod.god.id, "bardbarian");
  assert.equal(up.rockGod.god.num, LIMELIGHT_HEX, "god descends to the Limelight");
  assert.equal(up.rockGod.god.hp, ROCK_GOD_HP_PER_SPIRIT * 2, "HP = per-spirit × living spirits");
  assert.equal(up.rockGod.god.hp, up.rockGod.god.maxHp);
  assert.deepEqual(
    { winded: up.rockGod.god.winded, telegraph: up.rockGod.god.telegraph, lastAttack: up.rockGod.god.lastAttack },
    { winded: false, telegraph: null, lastAttack: null }, "fresh god state");
  assert.equal(up.rng.cursor, s0.rng.cursor, "summon consumes no rng");
  const dup = applyAction(up, godSummoned("vera", "glam_reaper"));
  assert.equal(dup.rockGod.god.id, "bardbarian", "second summon is a no-op — one god per game, ever");

  // ⚔️ DAMAGE — raw subtract; winded doubles; floor at 0 clears the telegraph
  const hit1 = applyAction(up, godDamaged("wildaxe", 7));
  assert.equal(hit1.rockGod.god.hp, up.rockGod.god.hp - 7, "raw damage lands");
  assert.deepEqual(hit1.rockGod.lastHit, { spiritId: "wildaxe", dmg: 7, defeated: false }, "hit reported");
  const windedUp = { ...hit1, rockGod: { ...hit1.rockGod, god: { ...hit1.rockGod.god, winded: true, telegraph: { attackId: "thunderclap", label: "T", warn: "w", hexes: [], dmg: 2 } } } };
  const hit2 = applyAction(windedUp, godDamaged("vera", 5));
  assert.equal(hit2.rockGod.god.hp, windedUp.rockGod.god.hp - 10, "winded → double damage");
  assert.equal(hit2.rockGod.lastHit.dmg, 10, "report carries the doubled number");
  const kill = applyAction(windedUp, godDamaged("vera", 999));
  assert.deepEqual(
    { hp: kill.rockGod.god.hp, telegraph: kill.rockGod.god.telegraph, defeated: kill.rockGod.lastHit.defeated },
    { hp: 0, telegraph: null, defeated: true }, "killing blow floors HP + clears the telegraph");
  assert.equal(hit1.rng.cursor, up.rng.cursor, "damage consumes no rng");

  // 🤘 ACT 1 — an armed THUNDERCLAP resolves: caught from engine positions
  const armed = { ...up, rockGod: { ...up.rockGod, god: { ...up.rockGod.god, telegraph: { attackId: "thunderclap", label: "THUNDERCLAP", warn: "w", hexes: [40, 41], dmg: 2 } } } };
  const clap = applyAction(armed, godActed());
  assert.deepEqual(clap.rockGod.lastAct,
    { kind: "resolved", attackId: "thunderclap", label: "THUNDERCLAP", dmg: 2, caught: ["wildaxe"] },
    "thunderclap resolve reports who's caught");
  assert.equal(clap.rockGod.god.telegraph, null, "telegraph cleared");
  assert.equal(clap.rockGod.god.lastAttack, "thunderclap");
  assert.equal(clap.rng.cursor, armed.rng.cursor, "telegraph resolve consumes no rng");

  // 🛝 ACT 1b — an armed POWER SLIDE resolves: god moves to `end`, WINDED
  const slideArmed = { ...up, rockGod: { ...up.rockGod, god: { ...up.rockGod.god, telegraph: { attackId: "power_slide", label: "POWER SLIDE", warn: "w", hexes: [105], end: 99, dmg: 3 } } } };
  const slid = applyAction(slideArmed, godActed());
  assert.deepEqual(
    { num: slid.rockGod.god.num, winded: slid.rockGod.god.winded, last: slid.rockGod.god.lastAttack },
    { num: 99, winded: true, last: "power_slide" }, "slide moves the god + leaves him winded");
  assert.deepEqual(slid.rockGod.lastAct.caught, ["vera"], "spirit on the line is bowled over");
  assert.equal(slid.rockGod.lastAct.end, 99, "report carries the stop hex");

  // 😵 ACT 2 — winded god recovers instead of attacking
  const recovered = applyAction(slid, godActed());
  assert.deepEqual(recovered.rockGod.lastAct, { kind: "recovered" }, "recovery beat");
  assert.equal(recovered.rockGod.god.winded, false, "window closes");

  // 🎲 ACT 3 — a new attack OPENS on engine rng (weighted, no immediate repeat).
  // Direct-call the reducer with pinned rands to hit each bucket (w 3/3/2/2).
  const open = v => applyGodActed(up, {}, () => v).rockGod;
  assert.equal(open(0.0).lastAct.attackId, "thunderclap", "bucket 1 → thunderclap telegraph");
  assert.equal(open(0.0).lastAct.kind, "telegraph");
  assert.ok(open(0.0).god.telegraph.hexes.length > 0, "AoE hexes armed");
  const ps = open(0.4);
  assert.equal(ps.lastAct.attackId, "power_slide", "bucket 2 → power slide telegraph");
  assert.equal(ps.lastAct.targetId, "wildaxe", "slide aims at a live spirit");
  assert.ok(ps.god.telegraph.end != null, "slide line armed with a stop hex");
  const fm = open(0.65);
  assert.equal(fm.lastAct.kind, "melted", "bucket 3 → face-melter (no telegraph)");
  assert.ok(["wildaxe", "vera"].includes(fm.lastAct.targetId), "melts the nearest spirit");
  assert.equal(fm.god.lastAttack, "face_melter");
  const mosh = applyGodActed(up, {}, () => 0.85);
  assert.equal(mosh.rockGod.lastAct.kind, "moshed", "bucket 4 → mosh command");
  const { moves, crushed } = mosh.rockGod.lastAct;
  assert.deepEqual([...moves.map(m => m.id), ...crushed].sort(), ["vera", "wildaxe"],
    "every living spirit is either shoved or crushed");
  for (const mv of moves) {
    assert.equal(mosh.spirits.find(sp => sp.id === mv.id).num, mv.to,
      "mosh shove moves the ENGINE spirit");
  }
  // via applyAction the open consumes the main rng stream
  const opened = applyAction(up, godActed());
  assert.ok(opened.rng.cursor > up.rng.cursor, "opening an attack consumes engine rng");
  assert.deepEqual(applyAction(up, godActed()).rockGod.lastAct, opened.rockGod.lastAct,
    "same seed → same answer");

  // 🏁 OUTCOME + timer seam
  const won = applyAction(up, godDefeated("wildaxe"));
  assert.equal(won.rockGod.outcome, "spirits", "defeat locks outcome");
  assert.equal(applyAction(won, godTriumphed()).rockGod.outcome, "spirits", "outcome can't flip");
  assert.equal(applyAction(up, godTriumphed()).rockGod.outcome, "god", "wipe → the God keeps the crown");
  assert.deepEqual(applyAction(up, godTimerExpired("wildaxe")).rockGod.lastTimerExpiry,
    { spiritId: "wildaxe" }, "timer expiry is recorded for the replay log");
  assert.equal(applyAction(won, godActed()).rockGod.lastAct, null, "no act once the fight is decided");

  // 📼 the whole boss lifecycle replays byte-for-byte + stays JSON-safe
  const logB = [
    godSummoned("wildaxe", "bardbarian"),
    godActed(), godActed(), godActed(),       // open/resolve a few beats (rng)
    godDamaged("wildaxe", 6), godDamaged("vera", 9),
    godTimerExpired("wildaxe"),
    godDamaged("wildaxe", 999),
    godDefeated("wildaxe"),
  ];
  const liveB = logB.reduce((st, a) => applyAction(st, a), s0);
  assert.equal(snapshot(replay(restore(snapshot(s0)), logB)), snapshot(liveB),
    "boss lifecycle replays byte-identically");
  assert.equal(assertJsonSafe(liveB), true, "rockGod slice is JSON-safe");
}

// -- Phase 8 (partial): cross-system determinism / replay proof ----------------
// The mission's exit criterion, over every system that's engine-owned today:
// a scripted log spanning turn → move → attack (rng) → counter (rng) → damage →
// knockdown → winner → riff-off (rng-heavy generation) must reproduce identically
// when replayed from a SERIALIZED start, and must be resumable mid-game. This is
// the real "a server replays the log and gets the same game" guarantee — it will
// widen to note-track/skill/event/god actions as those systems land.
{
  const s0 = makeInitialState(config, 20260706);
  const cornerId = Object.keys(CORNERS)[0];
  const neighbor = getFlatTopNeighborSlots(HEX_BY_NUM[7])[0].num;
  const mkResults = grades => grades.map((g, i) =>
    ({ hit: g !== "miss" && g !== "wrong", rt: 200 + i, grade: g, noteIdx: i }));

  const log = [
    gameInit(),
    // inject full spirit shape (Vibe/lives/corner) the way the client bridge does
    spiritsSynced([
      { id: "wildaxe", num: 7,   facing: 2, corner: cornerId, color: "#4aa3ff", cpu: false, lives: 3, vibe: 10, maxVibe: 10, knockedOut: false },
      { id: "vera",    num: 105, facing: 5, corner: cornerId, color: "#ff4a6a", cpu: true,  lives: 2, vibe: 8,  maxVibe: 8,  knockedOut: false },
    ]),
    turnStarted("wildaxe"),
    moveBudgetSet(4),
    moveStep("wildaxe", neighbor),
    beatsSpent(1, true),
    attackRolled("swing", "wildaxe", "vera", { atkStat: 7, defStat: 5 }),
    counterRolled("vera", { vibe: 6, maxVibe: 10, target: 4 }),
    damageApplied("vera", 3),
    knockdownResolved("vera"),      // lives 2 → respawns at home corner, full Vibe
    // Phase 5c economy actions — widen the proof over the noteStates writes
    fameChanged("wildaxe", 3),
    fameChanged("vera", -1),        // knockdown penalty path (floors at 0)
    fansChanged("wildaxe", { casuals: 9, diehards: 4, centerStreak: 1, fanActedThisTurn: true }),
    fansChanged("vera", { fanLag: 3, centerStreak: 0 }),
    noteSheetPatched("wildaxe", { hcPoints: 2, unlockedSkills: ["mic"], burnArmed: true }),
    noteSheetPatched("vera", { stagger: { turnsLeft: 1 }, modCards: [] }),
    winnerDeclared("wildaxe"),
    turnEnded(),
    // rng-heavy riff-off generation across the serialization boundary
    riffOffStarted("wildaxe", "vera", { slayer: true, eRush: true }),
    riffResultsSubmitted("attacker", mkResults(["perfect", "good", "perfect", "good", "perfect", "good"])),
    riffResultsSubmitted("defender", mkResults(["ok", "miss", "good", "miss", "ok", "miss"])),
    riffResolved(),
    riffClosed(),
  ];

  const live = log.reduce((st, a) => applyAction(st, a), s0);

  // 1) replay from a SERIALIZED start reproduces live play byte-for-byte
  assert.equal(
    snapshot(replay(restore(snapshot(s0)), log)),
    snapshot(live),
    "replay from a restored snapshot == live play, byte for byte");

  // 2) mid-game save/resume: snapshot after N actions, restore, replay the tail
  const half = Math.floor(log.length / 2);
  const mid = log.slice(0, half).reduce((st, a) => applyAction(st, a), s0);
  assert.equal(
    snapshot(replay(restore(snapshot(mid)), log.slice(half))),
    snapshot(live),
    "snapshot mid-game + replay the tail == uninterrupted play");

  // 3) determinism from scratch: same seed + same log → identical state
  assert.equal(
    snapshot(log.reduce((st, a) => applyAction(st, a), makeInitialState(config, 20260706))),
    snapshot(live),
    "same seed + same log is fully deterministic");
}

// -- Phase 8b: JSON-safety guard ----------------------------------------------
// The determinism proof compares snapshot(a) === snapshot(b), i.e. two LOSSY
// JSON.stringify outputs — so a Set/Infinity/undefined that crept into state
// could pass it while a live object and its restored twin actually diverge.
// assertJsonSafe walks real state and rejects anything that wouldn't round-trip.
{
  const config = {
    mode: "ffa",
    spirits: [
      { id: "wildaxe", name: "Wildaxe", num: 7, facing: 0 },
      { id: "vera",    name: "Vera",    num: 40, facing: 3 },
    ],
    startingLives: 3,
  };

  // 1) a fresh, seeded initial state is fully JSON-safe (all ~60 noteState
  //    fields per spirit + every Phase-2/5c slice).
  assert.equal(assertJsonSafe(makeInitialState(config, 8080)), true,
    "makeInitialState output is JSON-safe");

  // 2) a REPLAYED multi-system final state stays JSON-safe (nothing the
  //    reducers write introduces a Set/Infinity/undefined). Inject the full
  //    spirit shape (Vibe/lives/corner) via the client bridge so knockdown can
  //    respawn to a real home corner with full Vibe.
  const cornerId = Object.keys(CORNERS)[0];
  const s0 = makeInitialState(config, 8080);
  const played = [
    spiritsSynced([
      { id: "wildaxe", num: 7,  facing: 2, corner: cornerId, lives: 3, vibe: 10, maxVibe: 10, knockedOut: false },
      { id: "vera",    num: 40, facing: 5, corner: cornerId, lives: 2, vibe: 8,  maxVibe: 8,  knockedOut: false },
    ]),
    moveBudgetSet(4),
    attackRolled("swing", "wildaxe", "vera", { atkStat: 7, defStat: 5 }),
    counterRolled("vera", { vibe: 6, maxVibe: 10, target: 4 }),
    damageApplied("vera", 3),
    knockdownResolved("vera"),   // lives 2 → respawns at home corner, full Vibe
    winnerDeclared("wildaxe"),
    turnEnded(),
  ].reduce((st, a) => applyAction(st, a), s0);
  assert.equal(assertJsonSafe(played), true, "replayed final state is JSON-safe");

  // 3) the guard actually BITES — each known offender throws, naming the path.
  //    `want` (label first) is a substring of the expected message.
  function bites(want, mutate) {
    const bad = JSON.parse(snapshot(s0));   // deep plain-JSON clone
    mutate(bad);
    assert.throws(() => assertJsonSafe(bad), (err) => err.message.includes(want));
  }
  bites("Set at state.spirits[0].tag", (b) => { b.spirits[0].tag = new Set([1, 2]); });
  bites("non-finite number at state.turn.moveStepsLeft", (b) => { b.turn.moveStepsLeft = Infinity; });
  bites("non-finite number", (b) => { b.turn.moveStepsLeft = NaN; });
  bites("undefined at state.acting", (b) => { b.acting = undefined; });
  bites("Date at state.rng.at", (b) => { b.rng.at = new Date(); });
  bites("non-JSON function at state.config.fn", (b) => { b.config.fn = Math.max; });
}

// -- Phase 6c prep: Rock God rng determinism ----------------------------------
// pickGodAttack / godTauntLine now take an injectable `rand` (default
// Math.random). These lock the weighted-draw math, the no-immediate-repeat rule,
// and determinism so the eventual GOD_ATTACKED action replays byte-identically.
{
  const bard = ROCK_GODS.bardbarian;   // attacks: thunderclap/power_slide (w3) + face_melter/mosh_command (w2); total 10

  // exact weighted-draw boundaries at cumulative weight 3 / 6 / 8 / 10
  const at = v => pickGodAttack(bard, undefined, () => v).id;
  assert.equal(at(0.00), "thunderclap",  "roll 0.0 → first bucket");
  assert.equal(at(0.29), "thunderclap",  "just below the 3/10 edge");
  assert.equal(at(0.31), "power_slide",  "just above the 3/10 edge");
  assert.equal(at(0.59), "power_slide",  "just below the 6/10 edge");
  assert.equal(at(0.61), "face_melter",  "just above the 6/10 edge");
  assert.equal(at(0.79), "face_melter",  "just below the 8/10 edge");
  assert.equal(at(0.81), "mosh_command", "top bucket");

  // no immediate repeat: excluding the last id draws from the rest
  assert.equal(pickGodAttack(bard, "thunderclap", () => 0).id, "power_slide",
    "lastId is excluded from the pool");
  // ...unless it's the ONLY attack — then repeats are unavoidable (never null)
  assert.equal(pickGodAttack({ attacks: [{ id: "solo", weight: 1 }] }, "solo", () => 0).id, "solo",
    "single-attack deck falls back to the only attack");

  // determinism: same rand stream → identical sequence
  const mkFeed = () => { const seq = [0.1, 0.7, 0.9, 0.4, 0.05]; let i = 0; return () => seq[i++ % seq.length]; };
  let last1 = null;
  const run = feed => Array.from({ length: 5 }, () => (last1 = pickGodAttack(bard, last1, feed)?.id));
  const seqA = run(mkFeed()); last1 = null;
  const seqB = run(mkFeed());
  assert.deepEqual(seqA, seqB, "same rand stream → same attack sequence");

  // empty deck → null (unimplemented gods)
  assert.equal(pickGodAttack(ROCK_GODS.glam_reaper, undefined, () => 0.5), null, "empty deck → null");

  // taunt selection is rng-indexed + deterministic
  assert.equal(godTauntLine(bard, "summon", () => 0),    bard.taunts.summon[0], "taunt idx floor(0)");
  assert.equal(godTauntLine(bard, "summon", () => 0.99), bard.taunts.summon[1], "taunt idx floor(0.99·2)=1");
  assert.equal(godTauntLine(bard, "nonexistent", () => 0), null, "missing taunt kind → null");

  // pickRockGod (pure): playstyle scores pick a god; unimplemented falls back
  assert.equal(pickRockGod({ unlockedSkills: ["shank_skank", "cosmic_boogaloo"] }), "bardbarian",
    "brawler skills → Bardbarian");
  assert.equal(pickRockGod({ livesLost: 10 }), "bardbarian",
    "Glam Reaper would score highest but isn't implemented → Bardbarian fallback");
  assert.equal(pickRockGod({}), "bardbarian", "empty profile → default Bardbarian");
}

// -- Phase 6b prep: stage-FX deck shuffle determinism -------------------------
// shuffledStageFxDeck now takes an injectable `rand` (default Math.random). At
// the 6b flip the engine builds the deck once on the seeded rng so its order is
// replay-deterministic GameState instead of a per-client draw. Lock: exact
// Fisher-Yates output for two controlled rands, permutation invariants, and
// determinism.
{
  const IDS = STAGE_FX_IDS;   // [smoke_machine, laser_show, pyrotechnics, animatronics]

  // exact Fisher-Yates results for the two boundary rands
  assert.deepEqual(shuffledStageFxDeck(() => 0),
    ["laser_show", "pyrotechnics", "animatronics", "smoke_machine"],
    "rand→0 rotates the deck deterministically");
  assert.deepEqual(shuffledStageFxDeck(() => 0.99), IDS.slice(),
    "rand→~1 leaves the deck in identity order");

  // always a permutation of the ids (all present, no dupes, same length)
  const feed = (() => { const seq = [0.3, 0.8, 0.1, 0.6, 0.5]; let i = 0; return () => seq[i++ % seq.length]; });
  const deck = shuffledStageFxDeck(feed());
  assert.equal(deck.length, IDS.length, "deck keeps every effect");
  assert.deepEqual([...deck].sort(), [...IDS].sort(), "deck is a permutation of the ids");

  // deterministic: same rand stream → identical deck
  assert.deepEqual(shuffledStageFxDeck(feed()), shuffledStageFxDeck(feed()),
    "same rand stream → same deck order");

  // default arg still yields a valid permutation (live client behavior)
  assert.deepEqual([...shuffledStageFxDeck()].sort(), [...IDS].sort(),
    "default Math.random path stays a valid permutation");
}

// -- Phase 6d: DEBUFFS_TICKED ------------------------------------------------
{
  const s0 = makeInitialState({
    spirits: [{ id: "a", name: "A", num: 1, color: "#f00" }],
    mode: "ffa", startingLives: 3,
  }, 900);

  // Set up debuffs on the spirit's note sheet
  let state = applyAction(s0, noteSheetPatched("a", {
    tripped: true, dazed: true, instrumentDropped: true,
    mojoDrain: 2, stagger: { slots: [0, 1], turnsLeft: 3 },
  }));

  // Dispatch debuff tick
  state = applyAction(state, debuffsTicked("a"));
  const ns = state.noteStates["a"];
  assert.equal(ns.tripped, false, "debuff: tripped cleared");
  assert.equal(ns.dazed, false, "debuff: dazed cleared");
  assert.equal(ns.instrumentDropped, false, "debuff: instrumentDropped cleared");
  assert.equal(ns.mojoDrain, 1, "debuff: mojoDrain decremented");
  assert.deepEqual(ns.stagger, { slots: [0, 1], turnsLeft: 2 }, "debuff: stagger ticked");

  // Report
  const rep = state.turn.lastDebuffTick;
  assert.equal(rep.cleared, true, "debuff report: cleared=true");
  assert.equal(rep.tripped, true, "debuff report: tripped was true");
  assert.equal(rep.mojoDrainBefore, 2, "debuff report: mojoDrain before");

  // Second tick: mojoDrain goes to 0, stagger ticks down
  state = applyAction(state, debuffsTicked("a"));
  assert.equal(state.noteStates["a"].mojoDrain, 0, "debuff: mojoDrain hits 0");
  assert.deepEqual(state.noteStates["a"].stagger, { slots: [0, 1], turnsLeft: 1 }, "debuff: stagger=1");

  // Third tick: stagger expires
  state = applyAction(state, debuffsTicked("a"));
  assert.equal(state.noteStates["a"].stagger, null, "debuff: stagger expired");

  // No debuffs: cleared=false
  state = applyAction(state, debuffsTicked("a"));
  assert.equal(state.turn.lastDebuffTick.cleared, false, "debuff: no-op report");

  // Unknown spirit: no-op
  const s2 = applyAction(s0, debuffsTicked("nonexistent"));
  assert.deepEqual(s2.noteStates, s0.noteStates, "debuff: unknown id is no-op");
}

// -- Phase 6d: BURN_TICKED ---------------------------------------------------
{
  const s0 = makeInitialState({
    spirits: [{ id: "a", name: "A", num: 1, color: "#f00", vibe: 5, maxVibe: 8 }],
    mode: "ffa", startingLives: 3,
  }, 901);

  // Give the spirit burn (3 turns) and set Vibe
  let state = applyAction(s0, noteSheetPatched("a", { burn: { turnsLeft: 3 } }));
  // Set Vibe to a known value via spirits
  state = { ...state, spirits: state.spirits.map(s => s.id === "a" ? { ...s, vibe: 5 } : s) };

  // Burn tick with rng < 0.5 → damage
  const { applyBurnTicked } = await import("./systems/economy.js");
  const rngDmg = () => 0.3;  // < 0.5 → damage
  const s1 = applyBurnTicked(state, { spiritId: "a" }, rngDmg);
  assert.equal(s1.turn.lastBurnTick.burnDamage, 1, "burn: coin < 0.5 → 1 damage");
  assert.equal(s1.turn.lastBurnTick.turnsLeft, 2, "burn: turnsLeft decremented");
  assert.equal(s1.turn.lastBurnTick.expired, false, "burn: not expired yet");
  assert.equal(s1.spirits.find(s => s.id === "a").vibe, 4, "burn: vibe reduced by 1");
  assert.deepEqual(s1.noteStates["a"].burn, { turnsLeft: 2 }, "burn: noteStates burn updated");

  // Burn tick with rng >= 0.5 → no damage
  const rngNoDmg = () => 0.7;  // >= 0.5 → no damage
  const s2 = applyBurnTicked(state, { spiritId: "a" }, rngNoDmg);
  assert.equal(s2.turn.lastBurnTick.burnDamage, 0, "burn: coin >= 0.5 → 0 damage");
  assert.equal(s2.spirits.find(s => s.id === "a").vibe, 5, "burn: vibe unchanged");

  // Burn expiry: turnsLeft=1 → next tick clears burn
  let s3 = applyBurnTicked(state, { spiritId: "a" }, rngNoDmg);  // 3→2
  s3 = applyBurnTicked(s3, { spiritId: "a" }, rngNoDmg);          // 2→1
  s3 = applyBurnTicked(s3, { spiritId: "a" }, rngNoDmg);          // 1→0 (expired)
  assert.equal(s3.turn.lastBurnTick.expired, true, "burn: expired on last tick");
  assert.equal(s3.noteStates["a"].burn, null, "burn: cleared to null on expiry");

  // No burn: report is null
  const s4 = applyBurnTicked(s3, { spiritId: "a" }, () => 0.5);
  assert.equal(s4.turn.lastBurnTick, null, "burn: no-burn → null report");

  // Vibe floor at 0
  let s5 = { ...state, spirits: state.spirits.map(s => s.id === "a" ? { ...s, vibe: 0 } : s) };
  const s6 = applyBurnTicked(s5, { spiritId: "a" }, rngDmg);
  assert.equal(s6.spirits.find(s => s.id === "a").vibe, 0, "burn: vibe floored at 0");

  // Determinism: same seed → same coin → same damage via applyAction
  let sa = applyAction(state, noteSheetPatched("a", { burn: { turnsLeft: 2 } }));
  let sb = applyAction(state, noteSheetPatched("a", { burn: { turnsLeft: 2 } }));
  // Force same rng cursor
  sa = { ...sa, rng: { seed: 5555, cursor: 0 } };
  sb = { ...sb, rng: { seed: 5555, cursor: 0 } };
  const ra = applyAction(sa, burnTicked("a"));
  const rb = applyAction(sb, burnTicked("a"));
  assert.equal(ra.turn.lastBurnTick.burnDamage, rb.turn.lastBurnTick.burnDamage,
    "burn: same seed → same coin outcome");
  assert.equal(
    snapshot(ra), snapshot(rb),
    "burn: byte-identical replay"
  );
}

// -- Phase 6d: replay proof (debuff + burn in the action log) -----------------
{
  const s0 = makeInitialState({
    spirits: [
      { id: "a", name: "A", num: 1, color: "#f00", vibe: 6, maxVibe: 8 },
      { id: "b", name: "B", num: 5, color: "#00f", vibe: 6, maxVibe: 8 },
    ],
    mode: "ffa", startingLives: 3,
  }, 6000);

  const log = [
    gameInit(),
    turnStarted("a"),
    noteSheetPatched("a", { tripped: true, burn: { turnsLeft: 2 } }),
    debuffsTicked("a"),
    burnTicked("a"),
    turnEnded(),
    turnStarted("b"),
    debuffsTicked("b"),
    burnTicked("b"),
    turnEnded(),
  ];

  const final = replay(s0, log);
  // Replay from scratch
  const replayed = replay(s0, log);
  assert.equal(snapshot(final), snapshot(replayed), "6d: full-log replay is byte-identical");

  // Mid-log snapshot → restore → replay tail
  const mid = replay(s0, log.slice(0, 5));
  const midSnap = snapshot(mid);
  const tail = replay(restore(midSnap), log.slice(5));
  assert.equal(snapshot(tail), snapshot(final), "6d: snapshot/restore/replay-tail matches");

  // JSON-safe
  assertJsonSafe(final);
}

// -- Phase 6a: board semantic actions -------------------------------------------
{
  const s0 = makeInitialState(config, 7070);

  // SPOTLIGHT_HEALED — spirit on the spotlight hex gets +1 Vibe
  const spotHex = s0.board.spotlightHex;
  const onSpot = applyAction(s0, spiritsSynced(
    s0.spirits.map(x => x.id === "wildaxe" ? { ...x, num: spotHex, vibe: 3, maxVibe: 8, knockedOut: false } : x)));
  const healed = applyAction(onSpot, spotlightHealed("wildaxe"));
  assert.equal(healed.spirits.find(s => s.id === "wildaxe").vibe, 4, "SPOTLIGHT_HEALED: +1 Vibe");
  assert.deepEqual(healed.board.lastSpotlightHeal, { spiritId: "wildaxe" }, "report written");
  // Off-spotlight: no heal
  const offSpot = applyAction(s0, spotlightHealed("wildaxe"));
  assert.equal(offSpot.board.lastSpotlightHeal, null, "off-spotlight → null report");
  assert.equal(offSpot.rng.cursor, s0.rng.cursor, "SPOTLIGHT_HEALED consumes no rng");

  // SPOTLIGHT_MOVED — moves to a new hex on engine rng
  const moved = applyAction(s0, spotlightMoved([]));
  assert.notEqual(moved.board.spotlightHex, s0.board.spotlightHex, "spotlight moved");
  assert.ok(moved.board.lastSpotlightMove, "report written");
  assert.equal(moved.board.lastSpotlightMove.from, s0.board.spotlightHex, "report.from correct");
  assert.ok(moved.rng.cursor > s0.rng.cursor, "SPOTLIGHT_MOVED consumes rng");

  // TOKENS_SCATTERED — adds tokens on engine rng (up to TOKEN_MAX)
  // Deplete some tokens first so the scatter has room to add
  const depleted1 = applyAction(applyAction(s0,
    tokenPickedUp("wildaxe", s0.board.boardTokens[0].num)),
    tokenPickedUp("wildaxe", s0.board.boardTokens[1].num));
  const scattered = applyAction(depleted1, tokensScattered([]));
  assert.ok(scattered.board.boardTokens.length > depleted1.board.boardTokens.length, "tokens added");
  assert.ok(scattered.rng.cursor > depleted1.rng.cursor, "TOKENS_SCATTERED consumes rng");

  // TOKEN_PICKED_UP — removes the token
  const tok0 = s0.board.boardTokens[0];
  const picked = applyAction(s0, tokenPickedUp("wildaxe", tok0.num));
  assert.equal(picked.board.boardTokens.length, s0.board.boardTokens.length - 1, "one token removed");
  assert.ok(!picked.board.boardTokens.find(t => t.num === tok0.num), "correct token gone");
  assert.equal(picked.rng.cursor, s0.rng.cursor, "TOKEN_PICKED_UP consumes no rng");

  // EVENT_HEX_TRIGGERED — removes hex, sets respawn timer
  const evHex = s0.board.eventHexes[0];
  const triggered = applyAction(s0, eventHexTriggered("wildaxe", evHex));
  assert.ok(!triggered.board.eventHexes.includes(evHex), "event hex consumed");
  assert.equal(triggered.board.eventRespawnIn, EVENT_RESPAWN_TURNS, "respawn timer set");

  // EVENT_RESPAWN_TICKED — decrements counter
  const withTimer = applyAction(s0, eventHexTriggered("wildaxe", evHex));
  const ticked = applyAction(withTimer, eventRespawnTicked());
  assert.equal(ticked.board.eventRespawnIn, EVENT_RESPAWN_TURNS - 1, "counter decremented");
  // No-op when already 0
  assert.equal(applyAction(s0, eventRespawnTicked()).board.eventRespawnIn, 0, "0 stays 0");

  // EVENT_HEX_SPAWNED — adds a new event hex on engine rng
  const depleted = applyAction(applyAction(s0,
    eventHexTriggered("wildaxe", s0.board.eventHexes[0])),
    eventHexTriggered("wildaxe", s0.board.eventHexes[1] ?? s0.board.eventHexes[0]));
  const spawned = applyAction(depleted, eventHexSpawned([]));
  assert.ok(spawned.board.eventHexes.length > 0, "new event hex spawned");
  assert.ok(spawned.board.lastEventRespawn, "report written");

  // CHARGE_ZONE_USED — sets cooldown
  const cz = s0.board.chargeZones[0];
  const used = applyAction(s0, chargeZoneUsed("wildaxe", cz.num));
  assert.equal(used.board.chargeZones.find(z => z.num === cz.num).cooldown, CHARGE_ZONE_COOLDOWN, "cooldown set");

  // CHARGE_ZONES_TICKED — decrements cooldowns
  const czTicked = applyAction(used, chargeZonesTicked());
  assert.equal(czTicked.board.chargeZones.find(z => z.num === cz.num).cooldown, CHARGE_ZONE_COOLDOWN - 1, "cooldown decremented");

  // FLAMING_HEXES_SET + FLAMING_DECAYED
  const flamed = applyAction(s0, flamingHexesSet([10, 11, 12], 3));
  assert.deepEqual(flamed.board.flamingHexes, { hexes: [10, 11, 12], roundsLeft: 3 }, "flames set");
  const decayed = applyAction(flamed, flamingDecayed());
  assert.equal(decayed.board.flamingHexes.roundsLeft, 2, "flames decay one round");
  const expired = applyAction(applyAction(applyAction(flamed, flamingDecayed()), flamingDecayed()), flamingDecayed());
  assert.deepEqual(expired.board.flamingHexes, { hexes: [], roundsLeft: 0 }, "flames expire and clear");
  assert.ok(expired.board.lastFlamingDecay.expired, "expiry reported");
}

// -- Phase 6a: board action replay proof ----------------------------------------
{
  const s0 = makeInitialState({
    spirits: [
      { id: "a", name: "A", num: 1, color: "#f00", vibe: 6, maxVibe: 8 },
      { id: "b", name: "B", num: 5, color: "#00f", vibe: 6, maxVibe: 8 },
    ],
    mode: "ffa", startingLives: 3,
  }, 7777);

  const log = [
    gameInit(),
    turnStarted("a"),
    spotlightHealed("a"),
    chargeZoneUsed("a", s0.board.chargeZones[0]?.num ?? 1),
    tokenPickedUp("a", s0.board.boardTokens[0]?.num ?? 1),
    eventHexTriggered("a", s0.board.eventHexes[0] ?? 1),
    eventRespawnTicked(),
    chargeZonesTicked(),
    flamingHexesSet([10, 11], 2),
    turnEnded(),
    spotlightMoved([]),
    tokensScattered([]),
    flamingDecayed(),
    eventHexSpawned([]),
    turnStarted("b"),
    debuffsTicked("b"),
    turnEnded(),
  ];

  const final = replay(s0, log);
  // Full replay
  assert.equal(snapshot(replay(s0, log)), snapshot(final), "6a: full-log replay is byte-identical");
  // Mid-log snapshot → restore → tail
  const mid = replay(s0, log.slice(0, 8));
  const tail = replay(restore(snapshot(mid)), log.slice(8));
  assert.equal(snapshot(tail), snapshot(final), "6a: snapshot/restore/replay-tail matches");
  // JSON-safe
  assertJsonSafe(final);
}

// -- Phase 7a: bot policy pure functions ----------------------------------------
{
  // Import the policy module
  const botMod = await import("./policies/bot.js");

  // ── botAssignPersona ──
  // First 4 bots get distinct personas
  assert.equal(botMod.botAssignPersona([], 0.5), "maestro", "first bot gets maestro");
  assert.equal(botMod.botAssignPersona(["maestro"], 0.5), "moshlord", "second gets moshlord");
  assert.equal(botMod.botAssignPersona(["maestro","moshlord"], 0.5), "diva", "third gets diva");
  assert.equal(botMod.botAssignPersona(["maestro","moshlord","diva"], 0.5), "saboteur", "fourth gets saboteur");
  // 5th+ falls back to rng
  const fifth = botMod.botAssignPersona(["maestro","moshlord","diva","saboteur"], 0.0);
  assert.equal(fifth, "maestro", "5th bot picks by rng (floor(0.0 * 4) = 0 → maestro)");
  const fifth2 = botMod.botAssignPersona(["maestro","moshlord","diva","saboteur"], 0.99);
  assert.equal(fifth2, "saboteur", "5th bot picks by rng (floor(0.99 * 4) = 3 → saboteur)");

  // ── botPickTarget ──
  const ns = {
    a: { fame: 10 }, b: { fame: 5 }, c: { fame: 15 },
  };
  const mkR = (id, vibe) => ({ id, vibe });
  // Fame leader targeted first
  assert.equal(botMod.botPickTarget([mkR("a",6), mkR("b",6), mkR("c",6)], ns).id, "c",
    "targets highest-fame rival");
  // Low-vibe kill priority over fame
  assert.equal(botMod.botPickTarget([mkR("a",1), mkR("c",6)], ns).id, "a",
    "targets low-vibe rival for the kill over fame leader");
  // Empty → null
  assert.equal(botMod.botPickTarget([], ns), null, "empty candidates → null");

  // ── botHexScore ──
  const fakeHex = { num: 10, q: 0, r: 0, edge: false };
  const fakeCtx = {
    p: botMod.BOT_PERSONALITIES.maestro,
    center: { q: 0, r: 0 }, hurt: false, myFame: 0,
    spot: null, tokens: [], events: [], rivals: [],
  };
  const score = botMod.botHexScore(fakeHex, fakeCtx);
  assert.ok(typeof score === "number" && isFinite(score), "botHexScore returns a finite number");

  // ── botSkillEligible ──
  const fakeSkillById = {
    fans_4eva: { id: "fans_4eva", routeId: "common", prereq: null },
    theory_minor: { id: "theory_minor", routeId: "common", prereq: "theory_major" },
  };
  assert.ok(botMod.botSkillEligible("fans_4eva", [], "wildaxe", fakeSkillById),
    "fans_4eva eligible with no prereqs");
  assert.ok(!botMod.botSkillEligible("theory_minor", [], "wildaxe", fakeSkillById),
    "theory_minor NOT eligible without theory_major");
  assert.ok(botMod.botSkillEligible("theory_minor", ["theory_major"], "wildaxe", fakeSkillById),
    "theory_minor eligible WITH theory_major");

  // ── botPickSkillTarget ──
  const pick = botMod.botPickSkillTarget("wildaxe", [], "maestro", fakeSkillById);
  assert.equal(pick, "fans_4eva", "maestro's first eligible skill is fans_4eva");

  // ── botRiffResults ──
  // determinism: same rng sequence → same results
  let cursor1 = 0, cursor2 = 0;
  const s = makeInitialState(config, 4242);
  const s1 = applyAction(s, randomBatchDrawn(30));
  const batch1 = s1.lastRandomBatch;
  const s2 = applyAction(s, randomBatchDrawn(30));
  const batch2 = s2.lastRandomBatch;
  const r1 = botMod.botRiffResults(10, () => batch1[cursor1++]);
  const r2 = botMod.botRiffResults(10, () => batch2[cursor2++]);
  assert.deepEqual(r1, r2, "botRiffResults: same rng → same results");
  assert.equal(r1.length, 10, "botRiffResults: correct length");
  for (const entry of r1) {
    assert.ok(["hit","rt","grade","noteIdx"].every(k => k in entry),
      "botRiffResults: entry has all required fields");
    if (entry.hit) {
      assert.ok(["perfect","good","ok"].includes(entry.grade), "grade ∈ {perfect,good,ok}");
      assert.ok(typeof entry.rt === "number", "rt is a number for hits");
    } else {
      assert.equal(entry.grade, "miss", "non-hit grade is miss");
    }
  }
}

// -- Phase 6 remaining: RANDOM_BATCH_DRAWN — engine-sourced event rng ----------
{
  const s = makeInitialState(config, 5050);
  const c0 = s.rng.cursor;

  // Drawing 0 values = no-op on rng
  const s0 = applyAction(s, randomBatchDrawn(0));
  assert.deepEqual(s0.lastRandomBatch, [], "0-draw yields empty array");
  assert.equal(s0.rng.cursor, c0, "0-draw does not advance rng");

  // Drawing 5 values → 5 floats in [0,1), rng cursor advances by 5
  const s5 = applyAction(s, randomBatchDrawn(5));
  assert.equal(s5.lastRandomBatch.length, 5, "5-draw yields 5 values");
  assert.equal(s5.rng.cursor, c0 + 5, "5-draw advances rng by 5");
  for (const v of s5.lastRandomBatch) {
    assert.ok(typeof v === 'number' && v >= 0 && v < 1, `value ${v} is a [0,1) float`);
  }

  // Same seed + same count = same values (determinism)
  const s5b = applyAction(s, randomBatchDrawn(5));
  assert.deepEqual(s5b.lastRandomBatch, s5.lastRandomBatch, "same seed → same draw");

  // Chained draws advance the cursor cumulatively
  const s2 = applyAction(s5, randomBatchDrawn(3));
  assert.equal(s2.rng.cursor, c0 + 5 + 3, "chained draws stack cursor");
  // second batch differs from the first 3 of the first batch (different rng position)
  const overlap = s2.lastRandomBatch.every((v, i) => v === s5.lastRandomBatch[i]);
  assert.ok(!overlap, "subsequent draw produces different values");

  // d6 usage: Math.floor(val * 6) + 1 ∈ [1,6]
  const sDice = applyAction(s, randomBatchDrawn(100));
  const dice = sDice.lastRandomBatch.map(v => Math.floor(v * 6) + 1);
  assert.ok(dice.every(d => d >= 1 && d <= 6), "all d6 conversions ∈ [1,6]");

  // Replay proof: RANDOM_BATCH_DRAWN in the action log replays identically
  const s0r = makeInitialState({
    spirits: [
      { id: "a", name: "A", num: 1, color: "#f00", vibe: 6, maxVibe: 8 },
      { id: "b", name: "B", num: 5, color: "#00f", vibe: 6, maxVibe: 8 },
    ],
    mode: "ffa", startingLives: 3,
  }, 9090);

  const log = [
    gameInit(),
    randomBatchDrawn(4),
    turnStarted("a"),
    randomBatchDrawn(6),
    spotlightHealed("a"),
    turnEnded(),
    spotlightMoved([]),
    tokensScattered([]),
    randomBatchDrawn(2),
    turnStarted("b"),
    turnEnded(),
  ];

  const final = replay(s0r, log);
  assert.equal(snapshot(replay(s0r, log)), snapshot(final), "event rng: full-log replay is byte-identical");
  const mid = replay(s0r, log.slice(0, 5));
  const tail = replay(restore(snapshot(mid)), log.slice(5));
  assert.equal(snapshot(tail), snapshot(final), "event rng: snapshot/restore/replay-tail matches");
  assertJsonSafe(final);
}

// -- Phase 7b: bot plan functions -----------------------------------------------
{
  const botMod = await import("./policies/bot.js");

  // ── botPlanNoteStep ──
  // Build a minimal noteState with a C-major stock
  const fakeNS = {
    rootNote: 'C', scaleMode: 'major',
    noteStock: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'F#4'],
    // F#4 is a tritone — discord in C major
    melodyLine: [],
    usedStockIdx: [],
    discordUnlocks: [],
    finalsTrail: [],
    cadenceCooldowns: {},
  };
  const maestroP = botMod.BOT_PERSONALITIES.maestro;
  const step1 = botMod.botPlanNoteStep(fakeNS, maestroP);
  assert.ok('slot' in step1, "botPlanNoteStep returns a slot to play");
  assert.ok(step1.slot >= 0 && step1.slot < 8, "slot is a valid stock index");
  // The tritone (index 7) should NOT be played by a musical persona (not combat)
  assert.ok(step1.slot !== 7, "musical persona avoids tritone");

  // Combat persona welcomes one tritone
  const moshlordP = botMod.BOT_PERSONALITIES.moshlord;
  // Play all clean notes first, then check if tritone appears
  const usedAll = [0, 1, 2, 3, 4, 5, 6]; // all clean used, only tritone left
  const fakeNS2 = { ...fakeNS, usedStockIdx: usedAll, melodyLine: ['C4'] };
  const stepCombat = botMod.botPlanNoteStep(fakeNS2, moshlordP);
  // With only tritone left and track has notes, combat persona commits
  // (tritone body trick only works if track.length < NOTE_CAP - 1 and discord not empty)
  assert.ok(stepCombat.commit || stepCombat.slot === 7,
    "combat persona either commits or takes the tritone");

  // Full track → commit
  const fullNS = { ...fakeNS, melodyLine: ['C4','D4','E4','F4','G4','A4','B4','C5'] };
  assert.deepEqual(botMod.botPlanNoteStep(fullNS, maestroP), { commit: true },
    "full track → commit");

  // Empty stock → commit
  const emptyNS = { ...fakeNS, usedStockIdx: [0,1,2,3,4,5,6,7] };
  assert.deepEqual(botMod.botPlanNoteStep(emptyNS, maestroP), { commit: true },
    "all stock used → commit");

  // ── botSpiritChord ──
  const ch = botMod.botSpiritChord('wildaxe', ['C4', 'E4', 'G4']);
  assert.ok(typeof ch.drive === 'number', "botSpiritChord returns drive");
  assert.ok(typeof ch.sustain === 'number', "botSpiritChord returns sustain");
  // Intergalactic 0 gets +1 sustain
  const chI = botMod.botSpiritChord('intergalactic_0', ['C4', 'E4', 'G4']);
  assert.equal(chI.sustain, ch.sustain + 1, "intergalactic_0 gets +1 sustain");

  // ── botPlanRevoice ──
  const revoiceNS = {
    revoiceUsedThisTurn: false,
    chordStack: ['C4'],
    noteStock: ['E4', 'G4', 'B4'],
  };
  const revoice = botMod.botPlanRevoice(revoiceNS, 'wildaxe', maestroP);
  assert.ok(revoice === null || typeof revoice === 'string',
    "botPlanRevoice returns a note or null");
  // Already used → null
  const usedRevoiceNS = { ...revoiceNS, revoiceUsedThisTurn: true };
  assert.equal(botMod.botPlanRevoice(usedRevoiceNS, 'wildaxe', maestroP), null,
    "revoice already used → null");
  // Full chord → null
  const fullChordNS = { ...revoiceNS, chordStack: ['C4','D4','E4','F4','G4'] };
  assert.equal(botMod.botPlanRevoice(fullChordNS, 'wildaxe', maestroP), null,
    "full chord → null");

  // ── botRivalsWithin ──
  const testSpirits = [
    { id: 'a', num: 1, knockedOut: false },
    { id: 'b', num: 2, knockedOut: false },
    { id: 'c', num: 10, knockedOut: false },
    { id: 'd', num: 3, knockedOut: true },
  ];
  const near = botMod.botRivalsWithin(testSpirits, 'a', 1, 2);
  assert.ok(Array.isArray(near), "botRivalsWithin returns array");
  // 'd' is knocked out → excluded
  assert.ok(!near.find(s => s.id === 'd'), "KO'd spirits excluded");
  // 'a' is self → excluded
  assert.ok(!near.find(s => s.id === 'a'), "self excluded");

  // ── botPlanMove ──
  const moveState = makeInitialState(config, 7777);
  // Give a spirit a position and test movement
  const moveResult = botMod.botPlanMove(
    moveState, moveState.spirits[0], maestroP, []
  );
  assert.ok(moveResult === null || typeof moveResult === 'number',
    "botPlanMove returns hex num or null");
}

// -- Phase 7c: bot determinism proof ---------------------------------------------
// Same seed + same state ⇒ same action sequence. This is the property that makes
// bots replayable in Phase 8 and host-runnable in multiplayer.
{
  const botMod = await import("./policies/bot.js");

  // Build a rich game state with varied noteStates for a multi-step bot turn.
  const detState = makeInitialState(config, 42424242);
  // Give spirit 0 a non-trivial noteState for the build phase:
  const sid = detState.spirits[0].id;
  detState.noteStates[sid] = {
    ...detState.noteStates[sid],
    melodyLine: [],
    usedStockIdx: [],
    discordUnlocks: [],
    revoiceUsedThisTurn: false,
    chordStack: ['C4'],
    finalsTrail: [],
    cadenceCooldowns: {},
    pivotPending: false,
    upgradesPending: 0,
    targetSkillId: null,
    unlockedSkills: [],
    modCards: [],
  };
  const persona = botMod.BOT_PERSONALITIES.maestro;

  // ── Sequence determinism: run the entire build-phase decision loop twice ──
  function simulateBuildPhase(state, spiritId, p) {
    const ns = state.noteStates[spiritId];
    const actions = [];
    // Clone noteState so we can simulate stock consumption
    const simNS = { ...ns, usedStockIdx: [...(ns.usedStockIdx ?? [])],
                    melodyLine: [...(ns.melodyLine ?? [])] };
    for (let i = 0; i < 20; i++) { // safety cap
      const plan = botMod.botPlanNoteStep(simNS, p);
      actions.push(JSON.parse(JSON.stringify(plan)));
      if (plan.commit) break;
      // Simulate the stock consumption
      simNS.usedStockIdx = [...simNS.usedStockIdx, plan.slot];
      simNS.melodyLine = [...simNS.melodyLine, simNS.noteStock[plan.slot]];
    }
    return actions;
  }

  const seq1 = simulateBuildPhase(detState, sid, persona);
  const seq2 = simulateBuildPhase(detState, sid, persona);
  assert.deepEqual(seq1, seq2, "bot build-phase: identical action sequence on identical state");
  assert.ok(seq1.length >= 2, "bot build-phase: produced at least 2 actions (notes + commit)");
  assert.ok(seq1[seq1.length - 1].commit, "bot build-phase: sequence ends with commit");

  // ── Movement determinism ──
  const mv1 = botMod.botPlanMove(detState, detState.spirits[0], persona, []);
  const mv2 = botMod.botPlanMove(detState, detState.spirits[0], persona, []);
  assert.strictEqual(mv1, mv2, "bot movement: identical result on identical state");

  // ── Revoice determinism ──
  const rvNS = { revoiceUsedThisTurn: false, chordStack: ['C4'],
                 noteStock: ['E4', 'G4', 'B4', 'D5'] };
  const rv1 = botMod.botPlanRevoice(rvNS, sid, persona);
  const rv2 = botMod.botPlanRevoice(rvNS, sid, persona);
  assert.strictEqual(rv1, rv2, "bot revoice: identical result on identical state");

  // ── Target picking determinism ──
  const cands = detState.spirits.filter(s => s.id !== sid);
  const ns4tgt = Object.fromEntries(detState.spirits.map(s =>
    [s.id, detState.noteStates[s.id]]));
  const tgt1 = botMod.botPickTarget(cands, ns4tgt);
  const tgt2 = botMod.botPickTarget(cands, ns4tgt);
  assert.strictEqual(tgt1?.id, tgt2?.id, "bot target: identical result on identical state");

  // ── Riff results determinism (rng-seeded) ──
  const rng1 = makeRng(99999);
  const batch = [];
  for (let i = 0; i < 30; i++) batch.push(rng1());
  let c1 = 0, c2 = 0;
  const rr1 = botMod.botRiffResults(10, () => batch[c1++]);
  const rr2 = botMod.botRiffResults(10, () => batch[c2++]);
  assert.deepEqual(rr1, rr2, "bot riff: identical results on same rng stream");

  // ── Cross-persona determinism (different persona, same inputs, still deterministic) ──
  for (const key of botMod.BOT_PERSONA_KEYS) {
    const p = botMod.BOT_PERSONALITIES[key];
    const a = simulateBuildPhase(detState, sid, p);
    const b = simulateBuildPhase(detState, sid, p);
    assert.deepEqual(a, b, `bot determinism: ${key} build-phase identical`);
  }
}

// -- Phase 8c: COMPREHENSIVE cross-system replay proof ---------------------------
// The mission's exit criterion (§1): "a server replaying the log gets the same
// game." One scripted log spanning EVERY engine-owned system — turn/move, combat
// (swing + counter + damage + knockdown), riff-off, economy (fame/fans/noteSheet/
// fanTick), stage FX (draw + activate + ticks), Rock God (summon + damage + act),
// debuffs, burn, board (spotlight/tokens/events/charge/flaming), and random-batch
// draws — replayed from a SERIALIZED start, resumable mid-game, JSON-safe.
{
  const s0 = makeInitialState(config, 20260709);
  const cornerId = Object.keys(CORNERS)[0];
  const neighbor = getFlatTopNeighborSlots(HEX_BY_NUM[7])[0].num;
  const mkResults = grades => grades.map((g, i) =>
    ({ hit: g !== "miss" && g !== "wrong", rt: 200 + i, grade: g, noteIdx: i }));

  const log = [
    // ── SETUP ──
    gameInit(),
    spiritsSynced([
      { id: "wildaxe", num: 7,   facing: 2, corner: cornerId, color: "#4aa3ff", cpu: false,
        lives: 3, vibe: 10, maxVibe: 10, knockedOut: false },
      { id: "vera",    num: 105, facing: 5, corner: cornerId, color: "#ff4a6a", cpu: true,
        lives: 2, vibe: 8,  maxVibe: 8,  knockedOut: false },
    ]),

    // ── TURN 1: movement + combat ──
    turnStarted("wildaxe"),
    moveBudgetSet(4),
    moveStep("wildaxe", neighbor),
    spiritFaced("wildaxe", 4),
    beatsSpent(1, true),
    attackRolled("swing", "wildaxe", "vera", { atkStat: 7, defStat: 5 }),
    counterRolled("vera", { vibe: 6, maxVibe: 10, target: 4 }),
    damageApplied("vera", 3),
    knockdownResolved("vera"),

    // ── ECONOMY ──
    fameChanged("wildaxe", 3),
    fameChanged("vera", -1),
    fansChanged("wildaxe", { casuals: 9, diehards: 4, centerStreak: 1, fanActedThisTurn: true }),
    fansChanged("vera", { fanLag: 3, centerStreak: 0 }),
    noteSheetPatched("wildaxe", { hcPoints: 2, unlockedSkills: ["mic"], burnArmed: true }),
    noteSheetPatched("vera", { stagger: { turnsLeft: 2 }, modCards: [] }),
    spiritPatched("wildaxe", { vibe: 5, drive: 7 }),
    spiritPatched("vera", { num: 63, facing: 1 }),

    // ── BOARD ──
    spotlightHealed("wildaxe"),
    spotlightMoved(),
    tokensScattered(),
    tokenPickedUp("wildaxe", 0),
    eventHexTriggered(0),
    eventRespawnTicked(),
    eventHexSpawned(),
    chargeZoneUsed(0),
    chargeZonesTicked(),
    flamingHexesSet([40, 41, 42], 3),
    flamingDecayed(),

    // ── STAGE FX ──
    stageFxDrawn(8),
    stageFxActivated("pyrotechnics"),
    stageFxTurnTicked(),
    stageFxDrawn(16),
    stageFxActivated("smoke_machine"),
    stageFxRoundTicked(),

    // ── ROCK GOD ──
    godSummoned("wildaxe", "bardbarian"),
    godDamaged("wildaxe", 5),
    godActed(),

    // ── DEBUFFS + BURN ──
    debuffsTicked("vera"),
    burnTicked("wildaxe"),

    // ── RIFF-OFF ──
    riffOffStarted("wildaxe", "vera", { slayer: true, eRush: true }),
    riffResultsSubmitted("attacker",
      mkResults(["perfect", "good", "perfect", "good", "perfect", "good"])),
    riffResultsSubmitted("defender",
      mkResults(["ok", "miss", "good", "miss", "ok", "miss"])),
    riffResolved(),
    riffRound2Started(),
    riffResultsSubmitted("attacker",
      mkResults(["perfect", "perfect", "perfect", "perfect", "perfect", "perfect"])),
    riffResultsSubmitted("defender",
      mkResults(["good", "good", "good", "ok", "miss", "miss"])),
    riffResolved(),
    riffClosed(),

    // ── FAN TICK + RANDOM BATCH ──
    fansTicked("wildaxe"),
    fansTicked("vera"),
    randomBatchDrawn(5),

    // ── CLOSE ──
    winnerDeclared("wildaxe"),
    turnEnded(),
  ];

  const live = log.reduce((st, a) => applyAction(st, a), s0);

  // 1) replay from a SERIALIZED start reproduces live play byte-for-byte
  const replayedFull = replay(restore(snapshot(s0)), log);
  assert.equal(snapshot(replayedFull), snapshot(live),
    "8c COMPREHENSIVE: replay from restored snapshot == live play, byte for byte");

  // 2) mid-game save/resume at several cut points
  for (const cut of [10, 20, 30, 40]) {
    const mid = log.slice(0, cut).reduce((st, a) => applyAction(st, a), s0);
    const tail = replay(restore(snapshot(mid)), log.slice(cut));
    assert.equal(snapshot(tail), snapshot(live),
      `8c COMPREHENSIVE: snapshot at action ${cut} + replay tail == uninterrupted play`);
  }

  // 3) determinism from scratch: same seed + same log → identical state
  const scratch = log.reduce((st, a) => applyAction(st, a), makeInitialState(config, 20260709));
  assert.equal(snapshot(scratch), snapshot(live),
    "8c COMPREHENSIVE: same seed + same log is fully deterministic");

  // 4) JSON-safe: the final state survives JSON round-trip without data loss
  assert.equal(assertJsonSafe(live), true,
    "8c COMPREHENSIVE: final state is JSON-safe");

  // Count: verify the test spans enough systems
  const actionTypes = new Set(log.map(a => a.type));
  assert.ok(actionTypes.size >= 30,
    `8c COMPREHENSIVE: log spans ${actionTypes.size} distinct action types (target ≥ 30)`);
}

console.log("engine selftest: all assertions passed ✔");
// end of selftest
