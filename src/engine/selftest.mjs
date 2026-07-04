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
} from "./actions.js";
import { snapshot, restore, replay } from "./serialize.js";
import { LIMELIGHT_HEX } from "../data/gameConstants.js";
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

console.log("engine selftest: all assertions passed ✔");
