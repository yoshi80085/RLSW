// ─── ENGINE SELF-TEST ────────────────────────────────────────────────────────
// Headless node test — no DOM, no React. Run:  node src/engine/selftest.mjs
// Exits non-zero on failure. Extend with each extraction phase.

import assert from "node:assert/strict";
import { makeRng, restoreRng, hashSeed } from "./rng.js";
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import { gameInit } from "./actions.js";
import { snapshot, restore, replay } from "./serialize.js";

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

console.log("engine selftest: all assertions passed ✔");
