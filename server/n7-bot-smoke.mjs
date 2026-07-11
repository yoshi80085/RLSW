// ─── N7 BOT SEATS SMOKE ──────────────────────────────────────────────────
// Proves N7 exit criteria headlessly:
// 1. Host starts a game with bot seats → GAME_STARTED includes bot seats
// 2. Host dispatches actions "for" a bot → other client receives & converges
// 3. Bot seats appear in CATCH_UP for late joiners
//
//   node n7-bot-smoke.mjs   (spawns its own server on a scratch port)

import { spawn } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { makeNetClient } from "../src/net/client.js";
import { makeInitialState } from "../src/engine/state.js";
import { applyAction } from "../src/engine/reduce.js";
import {
  turnStarted, moveBudgetSet, beatsSpent, turnEnded,
} from "../src/engine/actions.js";

const PORT = 18793;
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
  // ── set up: 1 human host + 1 bot ───────────────────────────────────────
  const host = tab();
  await host.connect();
  host.createRoom("Host");
  await host.waitFor("WELCOME");

  // A second human joins to observe bot actions relaying
  const observer = tab();
  await observer.connect();
  observer.joinRoom(host.code, { name: "Observer" });
  await observer.waitFor("WELCOME");
  await host.waitFor("ROOM_STATE", { where: f => f.seats.length === 2 });

  const config = {
    spirits: [
      { id: "vex", name: "Vex", num: 7,   facing: "se", corner: "blue", color: "#4488ff", cpu: false },
      { id: "riv", name: "Riv", num: 105, facing: "nw", corner: "red",  color: "#ff6600", cpu: false },
      { id: "kha", name: "Kha", num: 55,  facing: "sw", corner: "purple", color: "#aa55ff", cpu: true },
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
  const botSeats = [
    { name: "Kha (Bot)", spiritId: "kha" },
  ];

  const hStarted = host.waitFor("GAME_STARTED", { ms: 5000 });
  const oStarted = observer.waitFor("GAME_STARTED", { ms: 5000 });
  host.startGame(config, { seatMap, botSeats });

  const hFrame = await hStarted;
  const oFrame = await oStarted;

  // ── TEST 1: GAME_STARTED includes bot seats ─────────────────────────────
  assert.equal(hFrame.seats.length, 3, "host sees 3 seats (2 human + 1 bot)");
  const botSeat = hFrame.seats.find(s => s.isBot);
  assert.ok(botSeat, "one seat is marked isBot");
  assert.equal(botSeat.spiritId, "kha", "bot seat has correct spiritId");
  assert.equal(botSeat.name, "Kha (Bot)", "bot seat has correct name");

  assert.equal(oFrame.seats.length, 3, "observer also sees 3 seats");
  assert.ok(oFrame.seats.find(s => s.isBot), "observer sees bot seat");

  console.log("  ✔ GAME_STARTED includes bot seats with isBot flag");

  // ── Boot engines ────────────────────────────────────────────────────────
  let engH = makeInitialState({ ...hFrame.config, seed: hFrame.seed }, hFrame.seed);
  let engO = makeInitialState({ ...oFrame.config, seed: oFrame.seed }, oFrame.seed);
  assert.equal(engH.rng.cursor, engO.rng.cursor, "engines start at same cursor");

  // ── TEST 2: host dispatches a human turn, then a bot turn ───────────────
  // First: play through human turns until the bot's turn comes up
  // The turn queue is based on spirit order in config, so it's vex → riv → kha
  const turnQueue = engH.turnQueue;
  console.log(`  turn queue: ${turnQueue.join(" → ")}`);

  // Helper: host dispatches, observer receives
  async function dispatchFromHost(engineAction) {
    const cursorBefore = engH.rng.cursor;
    const oProm = observer.waitFor("ACTION", { ms: 3000 });
    engH = applyAction(engH, engineAction);
    host.sendAction(engineAction, cursorBefore);
    const frame = await oProm;
    engO = applyAction(engO, frame.action);
  }

  // Play through vex's turn (human — seat 1)
  await dispatchFromHost(turnStarted("vex"));
  await dispatchFromHost(moveBudgetSet(0, false));
  await dispatchFromHost(beatsSpent(0, false, { all: true }));
  await dispatchFromHost(turnEnded());
  assert.equal(engH.acting, engO.acting, "both engines agree on next acting");
  console.log(`  after vex's turn: acting=${engH.acting}`);

  // Play through riv's turn (human — seat 2)
  await dispatchFromHost(turnStarted("riv"));
  await dispatchFromHost(moveBudgetSet(0, false));
  await dispatchFromHost(beatsSpent(0, false, { all: true }));
  await dispatchFromHost(turnEnded());
  assert.equal(engH.acting, "kha", "kha (bot) is now acting");
  console.log(`  after riv's turn: acting=${engH.acting} (bot's turn)`);

  // Now the host dispatches kha's (bot) turn — same choke point
  // This simulates what the bot step machine does on the host
  await dispatchFromHost(turnStarted("kha"));
  await dispatchFromHost(moveBudgetSet(0, false));
  await dispatchFromHost(beatsSpent(0, false, { all: true }));
  await dispatchFromHost(turnEnded());

  assert.equal(engH.rng.cursor, engO.rng.cursor,
    `cursors match after bot turn: H=${engH.rng.cursor} O=${engO.rng.cursor}`);
  assert.equal(engH.acting, engO.acting,
    `both engines agree on acting after bot turn: ${engH.acting}`);
  assert.equal(engH.acting, "vex", "turn wrapped back to vex");

  console.log("  ✔ host dispatches bot actions, observer receives and converges");

  // ── TEST 3: spectator joining mid-game gets bot seats in CATCH_UP ──────
  {
    const spec = tab();
    await spec.connect();
    spec.joinRoom(host.code, { name: "Late Joiner", spectator: true });
    await spec.waitFor("WELCOME", { ms: 3000 });
    const cu = await spec.waitFor("CATCH_UP", { ms: 3000 });

    assert.ok(cu.seats.find(s => s.isBot && s.spiritId === "kha"),
      "CATCH_UP includes bot seat");
    assert.ok(cu.log.length > 0, "CATCH_UP has the full action log");

    // Replay and verify convergence
    let engS = makeInitialState({ ...cu.config, seed: cu.seed }, cu.seed);
    for (const entry of cu.log) {
      engS = applyAction(engS, entry.action);
    }
    assert.equal(engS.rng.cursor, engH.rng.cursor,
      `spectator catches up: cursor=${engS.rng.cursor}`);
    assert.equal(engS.acting, engH.acting,
      `spectator acting matches: ${engS.acting}`);

    console.log("  ✔ spectator catches up with bot actions in the log");
    spec.close();
  }

  console.log("n7 bot seats smoke test: all assertions passed ✔");
  host.close(); observer.close();
} finally {
  server.kill();
}
