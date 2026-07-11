// ─── N4 ACTION RELAY SMOKE ─────────────────────────────────────────────────
// Proves the N4 exit criterion headlessly: client A dispatches engine actions
// through the server, client B receives them via ACTION frames, both engines
// converge (same cursor + acting spirit).
//
//   node n4-relay-smoke.mjs   (spawns its own server on a scratch port)

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

const PORT = 18790;
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
await new Promise(r => server.stdout.once("data", r)); // "listening" line

try {
  // ── set up two clients & start the game ──────────────────────────────────
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

  // Boot identical engines on both sides
  let engA = makeInitialState({ ...aFrame.config, seed: aFrame.seed }, aFrame.seed);
  let engB = makeInitialState({ ...bFrame.config, seed: bFrame.seed }, bFrame.seed);

  assert.equal(engA.rng.cursor, engB.rng.cursor, "engines start at same cursor");

  // ── helper: client A dispatches, client B receives ────────────────────────
  // Set up BOTH waitFor promises BEFORE sending, so neither echo nor relay
  // can be missed.

  let bSeq = 0;

  async function dispatchFromA(engineAction) {
    const cursorBefore = engA.rng.cursor;

    // Set up listeners BEFORE sending (echo + relay arrive unpredictably)
    const bProm = b.waitFor("ACTION", { ms: 3000 });
    const aProm = a.waitFor("ACTION", { ms: 3000 }); // echo

    // Local apply (what the acting client's dispatch() does)
    engA = applyAction(engA, engineAction);

    // Send to server
    a.sendAction(engineAction, cursorBefore);

    // Wait for B to receive
    const frame = await bProm;
    assert.equal(frame.seatId, 1, "ACTION comes from seat 1 (host)");
    assert.ok(frame.seq > bSeq, `seq increases (${frame.seq} > ${bSeq})`);
    bSeq = frame.seq;

    // Desync tripwire: B's cursor should match the sent cursorBefore
    assert.equal(engB.rng.cursor, frame.cursorBefore,
      `cursor sync: B=${engB.rng.cursor} == frame.cursorBefore=${frame.cursorBefore}`);

    // Remote apply
    engB = applyAction(engB, frame.action);

    // Verify convergence
    assert.equal(engA.rng.cursor, engB.rng.cursor,
      `cursors converge after ${engineAction.type}: A=${engA.rng.cursor} B=${engB.rng.cursor}`);

    // Wait for the echo on A (just drain it — in real code the listener skips it)
    const echo = await aProm;
    assert.equal(echo.seatId, 1, "echo comes from own seat (would be skipped)");
  }

  // ── dispatch a short turn sequence ────────────────────────────────────────
  const actingSpirit = engA.acting;
  console.log(`  acting spirit: ${actingSpirit}`);

  const startNum = engA.spirits.find(s => s.id === actingSpirit).num;
  const adjHex = startNum === 7 ? 8 : 104;

  // 1. TURN_STARTED
  await dispatchFromA(turnStarted(actingSpirit));
  assert.equal(engA.acting, actingSpirit, "acting unchanged after TURN_STARTED");

  // 2. MOVE_BUDGET_SET (give 2 steps)
  await dispatchFromA(moveBudgetSet(2, false));

  // 3. MOVE_STEP (one hex)
  await dispatchFromA(moveStep(actingSpirit, adjHex, false));
  assert.equal(
    engA.spirits.find(s => s.id === actingSpirit).num,
    engB.spirits.find(s => s.id === actingSpirit).num,
    "spirit position matches after MOVE_STEP"
  );

  // 4. BEATS_SPENT (end movement, spend all)
  await dispatchFromA(beatsSpent(0, false, { all: true }));

  // 5. TURN_ENDED
  await dispatchFromA(turnEnded());
  assert.equal(engA.acting, engB.acting, "acting spirit matches after TURN_ENDED");
  assert.notEqual(engA.acting, actingSpirit, "acting advanced to next spirit");

  // ── final convergence check ──────────────────────────────────────────────
  assert.equal(engA.rng.cursor, engB.rng.cursor, "final cursor match");
  assert.deepEqual(engA.turn, engB.turn, "turn state matches");
  assert.deepEqual(
    engA.spirits.map(s => ({ id: s.id, num: s.num, hp: s.hp })),
    engB.spirits.map(s => ({ id: s.id, num: s.num, hp: s.hp })),
    "spirit snapshot matches"
  );

  console.log("n4 relay smoke test: all assertions passed ✔");
  console.log(`  final cursor=${engA.rng.cursor}, acting=${engA.acting}, turnCount=${engA.turn.count}`);
  a.close(); b.close();
} finally {
  server.kill();
}
