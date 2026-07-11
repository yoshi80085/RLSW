// ─── N6 SPECTATE + RECONNECT SMOKE ────────────────────────────────────────
// Proves N6 exit criteria headlessly:
// 1. Spectator joins mid-game → receives CATCH_UP → replays to identical state
// 2. Player disconnects (F5) → rejoins with rejoinToken → catches up exactly
//
//   node n6-spectate-smoke.mjs   (spawns its own server on a scratch port)

import { spawn } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { makeNetClient } from "../src/net/client.js";
import { makeInitialState } from "../src/engine/state.js";
import { applyAction } from "../src/engine/reduce.js";
import {
  turnStarted, moveBudgetSet, moveStep, beatsSpent, turnEnded,
} from "../src/engine/actions.js";

const PORT = 18792;
const url = `ws://127.0.0.1:${PORT}`;

const memStore = () => {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
};
const tab = () => makeNetClient({ url, WebSocketImpl: WebSocket, storage: memStore() });

const server = spawn(process.execPath, ["index.js"], {
  cwd: fileURLToPath(new URL(".", import.meta.url)),
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise(r => server.stdout.once("data", r));

try {
  // ── set up two players & start the game ─────────────────────────────────
  const a = tab(), b = tab();
  await a.connect();
  a.createRoom("Host");
  await a.waitFor("WELCOME");

  await b.connect();
  b.joinRoom(a.code, { name: "Guest" });
  await b.waitFor("WELCOME");
  await a.waitFor("ROOM_STATE", { where: f => f.seats.length === 2 });

  const config = {
    spirits: [
      { id: "vex", name: "Vex", num: 7,   facing: "se", corner: "blue", color: "#4488ff", cpu: false },
      { id: "riv", name: "Riv", num: 105, facing: "nw", corner: "red",  color: "#ff6600", cpu: false },
    ],
    mode: "ffa",
    teams: null,
    startingLives: 3,
    beginnerMode: false,
  };
  const seatMap = [
    { seatId: 1, spiritId: "vex" },
    { seatId: 2, spiritId: "riv" },
  ];

  const aStarted = a.waitFor("GAME_STARTED", { ms: 5000 });
  const bStarted = b.waitFor("GAME_STARTED", { ms: 5000 });
  a.startGame(config, { seatMap });

  const aFrame = await aStarted;
  const bFrame = await bStarted;

  let engA = makeInitialState({ ...aFrame.config, seed: aFrame.seed }, aFrame.seed);
  let engB = makeInitialState({ ...bFrame.config, seed: bFrame.seed }, bFrame.seed);

  // ── play a short turn sequence so there's log to catch up to ────────────
  const actingSpirit = engA.acting;
  const startNum = engA.spirits.find(s => s.id === actingSpirit).num;
  const adjHex = startNum === 7 ? 8 : 104;

  async function dispatchFromA(engineAction) {
    const cursorBefore = engA.rng.cursor;
    const bProm = b.waitFor("ACTION", { ms: 3000 });
    engA = applyAction(engA, engineAction);
    a.sendAction(engineAction, cursorBefore);
    const frame = await bProm;
    engB = applyAction(engB, frame.action);
  }

  // Send some log lines for catch-up logLines
  a.sendLogLine("⚡ Vex steps onto the stage");
  await new Promise(r => setTimeout(r, 50));

  await dispatchFromA(turnStarted(actingSpirit));
  a.sendLogLine(`🎸 ${actingSpirit} starts their turn`);
  await new Promise(r => setTimeout(r, 50));

  await dispatchFromA(moveBudgetSet(2, false));
  await dispatchFromA(moveStep(actingSpirit, adjHex, false));

  a.sendLogLine(`🚶 ${actingSpirit} moves to hex ${adjHex}`);
  await new Promise(r => setTimeout(r, 50));

  await dispatchFromA(beatsSpent(0, false, { all: true }));
  await dispatchFromA(turnEnded());

  // Sanity: A and B agree before spectator joins
  assert.equal(engA.rng.cursor, engB.rng.cursor, "A & B cursors match pre-spectate");
  console.log(`  pre-spectate: cursor=${engA.rng.cursor}, acting=${engA.acting}`);

  // ── TEST 1: spectator joins mid-game ────────────────────────────────────
  {
    const spec = tab();
    await spec.connect();
    spec.joinRoom(a.code, { name: "Spectator", spectator: true });
    const welcome = await spec.waitFor("WELCOME", { ms: 3000 });
    assert.equal(welcome.spectator, true, "server marks spectator");
    assert.equal(welcome.seatId, null, "spectator has no seat");

    // CATCH_UP should arrive right after WELCOME
    const cu = await spec.waitFor("CATCH_UP", { ms: 3000 });
    assert.ok(cu.seed, "CATCH_UP has seed");
    assert.ok(cu.config, "CATCH_UP has config");
    assert.ok(Array.isArray(cu.log), "CATCH_UP has log array");
    assert.ok(cu.log.length > 0, "CATCH_UP log is non-empty");
    assert.ok(Array.isArray(cu.logLines), "CATCH_UP has logLines");
    assert.ok(cu.logLines.length > 0, "CATCH_UP has logLines entries");

    // Replay the log — exactly what the Game component does on mount
    let engSpec = makeInitialState({ ...cu.config, seed: cu.seed }, cu.seed);
    for (const entry of cu.log) {
      engSpec = applyAction(engSpec, entry.action);
    }

    // Spectator's engine must match the live players
    assert.equal(engSpec.rng.cursor, engA.rng.cursor,
      `spectator cursor=${engSpec.rng.cursor} matches A=${engA.rng.cursor}`);
    assert.equal(engSpec.acting, engA.acting,
      `spectator acting=${engSpec.acting} matches A=${engA.acting}`);
    assert.deepEqual(
      engSpec.spirits.map(s => ({ id: s.id, num: s.num })),
      engA.spirits.map(s => ({ id: s.id, num: s.num })),
      "spectator spirit positions match"
    );

    // Spectator should also receive LIVE actions going forward
    const nextActing = engA.acting;

    const specProm = spec.waitFor("ACTION", { ms: 3000 });
    const cbTs = engA.rng.cursor;
    const tsAction = turnStarted(nextActing);
    engA = applyAction(engA, tsAction);
    a.sendAction(tsAction, cbTs);

    const liveFrame = await specProm;
    engSpec = applyAction(engSpec, liveFrame.action);
    assert.equal(engSpec.rng.cursor, engA.rng.cursor, "spectator tracks live actions");

    console.log("  ✔ spectator joins mid-game, catches up, tracks live actions");
    spec.close();
  }

  // ── TEST 2: player disconnects (F5) and reconnects ──────────────────────
  {
    // Remember B's rejoin token before disconnecting
    const bToken = b.rejoinToken;
    const bCode = b.code;
    assert.ok(bToken, "B has a rejoin token");

    // Set up listener BEFORE close so we catch the disconnect broadcast
    const dropProm = a.waitFor("ROOM_STATE", { ms: 3000, rejectOnError: false });
    b.close();
    await dropProm;

    // Reconnect as B with the saved token
    const b2 = tab();
    await b2.connect();
    b2.joinRoom(bCode, { name: "Guest", rejoinToken: bToken });
    const welcome = await b2.waitFor("WELCOME", { ms: 3000 });
    assert.equal(welcome.rejoined, true, "server acknowledges rejoin");
    assert.equal(welcome.seatId, 2, "reclaimed seat 2");

    // CATCH_UP arrives for the reconnecting player
    const cu = await b2.waitFor("CATCH_UP", { ms: 3000 });
    assert.ok(cu.log.length > 0, "CATCH_UP log has entries for reconnect");

    // Replay — same as Game component
    let engB2 = makeInitialState({ ...cu.config, seed: cu.seed }, cu.seed);
    for (const entry of cu.log) {
      engB2 = applyAction(engB2, entry.action);
    }

    assert.equal(engB2.rng.cursor, engA.rng.cursor,
      `reconnected B cursor=${engB2.rng.cursor} matches A=${engA.rng.cursor}`);
    assert.equal(engB2.acting, engA.acting,
      `reconnected B acting=${engB2.acting} matches A=${engA.acting}`);
    assert.deepEqual(
      engB2.spirits.map(s => ({ id: s.id, num: s.num })),
      engA.spirits.map(s => ({ id: s.id, num: s.num })),
      "reconnected B spirit positions match"
    );

    // Reconnected B should also work as a live player going forward
    const b2Prom = b2.waitFor("ACTION", { ms: 3000 });
    const cb = engA.rng.cursor;
    const act = moveBudgetSet(2, false);
    engA = applyAction(engA, act);
    a.sendAction(act, cb);

    const liveFrame = await b2Prom;
    engB2 = applyAction(engB2, liveFrame.action);
    assert.equal(engB2.rng.cursor, engA.rng.cursor, "reconnected B tracks live actions");

    console.log("  ✔ player disconnects (F5), reconnects with token, catches up, resumes live");
    b2.close();
  }

  console.log("n6 spectate + reconnect smoke test: all assertions passed ✔");
  a.close();
} finally {
  server.kill();
}
