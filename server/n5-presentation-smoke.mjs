// ─── N5 PRESENTATION RELAY SMOKE ──────────────────────────────────────────
// Proves N5 exit criteria headlessly:
// 1. LOG_LINE frames relay from sender to receiver (not echoed to sender)
// 2. WINNER_DECLARED action relays via ACTION frames → both engines agree on winner
//
//   node n5-presentation-smoke.mjs   (spawns its own server on a scratch port)

import { spawn } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { makeNetClient } from "../src/net/client.js";
import { makeInitialState } from "../src/engine/state.js";
import { applyAction } from "../src/engine/reduce.js";
import {
  turnStarted, winnerDeclared,
} from "../src/engine/actions.js";

const PORT = 18791;
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

  let engA = makeInitialState({ ...aFrame.config, seed: aFrame.seed }, aFrame.seed);
  let engB = makeInitialState({ ...bFrame.config, seed: bFrame.seed }, bFrame.seed);

  // ── TEST 1: LOG_LINE relay ───────────────────────────────────────────────
  // A sends a log line → B receives it; A does NOT get an echo.
  {
    const bLog = b.waitFor("LOG_LINE", { ms: 3000 });

    // Set up a trap: if A receives LOG_LINE, that's a bug (server excludes sender)
    let aGotEcho = false;
    const offEcho = a.on("LOG_LINE", () => { aGotEcho = true; });

    a.sendLogLine("🎵 Vex shreds the opening riff!");
    const frame = await bLog;
    assert.equal(frame.text, "🎵 Vex shreds the opening riff!", "B receives the log line text");
    assert.equal(frame.seatId, 1, "LOG_LINE tagged with sender's seat");

    // Small wait to ensure no echo arrives on A
    await new Promise(r => setTimeout(r, 200));
    assert.ok(!aGotEcho, "sender does NOT receive their own LOG_LINE echo");
    offEcho();

    console.log("  ✔ LOG_LINE relay: B receives, A gets no echo");
  }

  // ── TEST 2: multiple log lines accumulate ────────────────────────────────
  {
    const lines = [
      "⚡ Vex moves to hex 8",
      "🎸 Riff discovered — Power Chord!",
      "💥 Critical hit for 12 damage",
    ];

    for (const line of lines) {
      const bProm = b.waitFor("LOG_LINE", { ms: 3000 });
      a.sendLogLine(line);
      const f = await bProm;
      assert.equal(f.text, line, `line relayed: "${line.slice(0, 30)}…"`);
    }

    console.log("  ✔ multiple LOG_LINEs relay in order");
  }

  // ── TEST 3: WINNER_DECLARED relays via ACTION ────────────────────────────
  // Start A's turn, then declare a winner — B's engine should agree.
  {
    // TURN_STARTED so the engine is in a valid state
    const cbTs = engA.rng.cursor;
    const tsAction = turnStarted(engA.acting);

    const bAction1 = b.waitFor("ACTION", { ms: 3000 });
    a.sendAction(tsAction, cbTs);
    engA = applyAction(engA, tsAction);

    const f1 = await bAction1;
    engB = applyAction(engB, f1.action);

    // Now dispatch WINNER_DECLARED
    const cbWd = engA.rng.cursor;
    const wdAction = winnerDeclared("vex");

    const bAction2 = b.waitFor("ACTION", { ms: 3000 });
    a.sendAction(wdAction, cbWd);
    engA = applyAction(engA, wdAction);

    const f2 = await bAction2;
    engB = applyAction(engB, f2.action);

    assert.equal(engA.winner, "vex", "engine A has winner");
    assert.equal(engB.winner, "vex", "engine B has winner via relay");
    assert.equal(engA.winner, engB.winner, "both engines agree on winner");

    console.log("  ✔ WINNER_DECLARED relays — both engines agree on winner");
  }

  // ── TEST 4: B can also send LOG_LINE to A ────────────────────────────────
  {
    const aLog = a.waitFor("LOG_LINE", { ms: 3000 });
    b.sendLogLine("🎤 Riv plays a counter-riff!");
    const frame = await aLog;
    assert.equal(frame.text, "🎤 Riv plays a counter-riff!", "A receives B's log line");
    assert.equal(frame.seatId, 2, "tagged with B's seat");

    console.log("  ✔ LOG_LINE works in both directions");
  }

  console.log("n5 presentation smoke test: all assertions passed ✔");
  a.close(); b.close();
} finally {
  server.kill();
}
