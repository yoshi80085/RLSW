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
  spiritFaced, spiritEliminated,
  riffOffStarted, riffResultsSubmitted, riffResolved, riffRound2Started, riffClosed,
  attackRolled, counterRolled,
  damageApplied, knockdownResolved, winnerDeclared,
  noteStatesSynced, fameChanged,
} from "./actions.js";
import { snapshot, restore, replay, assertJsonSafe } from "./serialize.js";
import {
  marginToDamage, fameFromMargin, knockbackSpaces, underdogBonus, smashOutcome,
  decideWinner, resolveKnockdown, counterOutcome,
} from "./systems/combat.js";
import { usedHas, usedList, usedAdd, performanceScore, makeInitialNoteState } from "./systems/economy.js";
import { skillEligibility, ULTIMATE_PREREQS, THEORY_DISCORD_GRANTS, CQC_SWING_MAP } from "./systems/skills.js";
import { pitchIndex } from "../music/notes.js";
import { detectMotifRepeat } from "../music/cadence.js";
import { CORNERS } from "../data/corners.js";
import { pickGodAttack, godTauntLine, pickRockGod, ROCK_GODS } from "../data/rockGods.js";
import { shuffledStageFxDeck, STAGE_FX_IDS } from "../data/stageEffects.js";
import {
  LIMELIGHT_HEX, UNDERDOG_MIN_DEFICIT, UNDERDOG_MAX_MULT,
} from "../data/gameConstants.js";
import { HEX_BY_NUM } from "../board/hexMap.js";
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
    assert.equal(b.damage, marginToDamage(b.margin));
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
        marginToDamage(Math.abs(atkTotal - defTotal)), bushido],
      "swing verdict matches old Game math given identical rolls");
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
      assert.equal(b.damage, marginToDamage(b.margin));
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
      [atkRoll, defRoll, at, dt, at > dt, Math.abs(at - dt), marginToDamage(Math.abs(at - dt))],
      "sonic verdict matches old Game math");
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

console.log("engine selftest: all assertions passed ✔");
// end of selftest
