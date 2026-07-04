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
  attackRolled,
} from "./actions.js";
import { snapshot, restore, replay } from "./serialize.js";
import {
  marginToDamage, fameFromMargin, knockbackSpaces, underdogBonus, smashOutcome,
  decideWinner, resolveKnockdown,
} from "./systems/combat.js";
import { CORNERS } from "../data/corners.js";
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
  assert.deepEqual(s.battle.r1, { won: true, tie: false, margin: v.margin }, "round-1 edge remembered");

  // double whiff = tie
  let t = applyAction(started, riffResultsSubmitted("attacker", mkResults(["miss","miss","miss","miss","miss","miss"])));
  t = applyAction(t, riffResultsSubmitted("defender", mkResults(["miss","miss","miss","miss","miss","miss"])));
  assert.equal(applyAction(t, riffResolved()).battle.verdict.tie, true);

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

console.log("engine selftest: all assertions passed ✔");
