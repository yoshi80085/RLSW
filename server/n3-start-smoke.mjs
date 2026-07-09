// ─── N3 START HANDSHAKE SMOKE ───────────────────────────────────────────────
// Proves the N3 exit criterion headlessly: host sends START_GAME with a config,
// server stamps the seed, both clients receive GAME_STARTED with the SAME seed
// + config, and makeInitialState produces identical engine state on both sides.
//
//   node n3-start-smoke.mjs   (spawns its own server on a scratch port)

import { spawn } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { makeNetClient } from "../src/net/client.js";
import { makeInitialState } from "../src/engine/state.js";

const PORT = 18789;
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
  // ── set up two tabs ───────────────────────────────────────────────────────
  const a = tab(), b = tab();
  await a.connect();
  a.createRoom("Host");
  await a.waitFor("WELCOME");
  assert.equal(a.seatId, 1, "host is seat 1");

  await b.connect();
  b.joinRoom(a.code, { name: "Guest" });
  await b.waitFor("WELCOME");
  assert.equal(b.seatId, 2, "guest is seat 2");

  // wait until both see 2 seats
  await a.waitFor("ROOM_STATE", { where: f => f.seats.length === 2 });

  // ── host sends START_GAME with a minimal config ───────────────────────────
  // Mirror what handleStartOnline() builds in the lobby
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

  // both listen for GAME_STARTED
  const aStarted = a.waitFor("GAME_STARTED", { ms: 5000 });
  const bStarted = b.waitFor("GAME_STARTED", { ms: 5000 });

  a.startGame(config, { seatMap });

  const aFrame = await aStarted;
  const bFrame = await bStarted;

  // ── verify: same seed, same config ────────────────────────────────────────
  assert.ok(typeof aFrame.seed === "number" && aFrame.seed > 0, "seed is a positive number");
  assert.equal(aFrame.seed, bFrame.seed, "both clients got the SAME seed");
  assert.deepEqual(aFrame.config, bFrame.config, "config matches");
  assert.deepEqual(aFrame.seats, bFrame.seats, "seat list matches");
  assert.equal(aFrame.seats.length, 2, "two seats");
  assert.equal(aFrame.seats[0].spiritId, "vex", "seat 1 → vex");
  assert.equal(aFrame.seats[1].spiritId, "riv", "seat 2 → riv");

  // ── verify: makeInitialState produces identical engine state ──────────────
  const gsA = { ...aFrame.config, spirits: aFrame.config.spirits, seed: aFrame.seed };
  const gsB = { ...bFrame.config, spirits: bFrame.config.spirits, seed: bFrame.seed };
  const engA = makeInitialState(gsA, gsA.seed);
  const engB = makeInitialState(gsB, gsB.seed);

  assert.equal(engA.rng.seed, engB.rng.seed, "engine seeds match");
  assert.equal(engA.rng.cursor, engB.rng.cursor, "engine cursors match (both 0)");
  assert.equal(engA.rng.cursor, 0, "cursor starts at 0");
  assert.deepEqual(
    engA.spirits.map(s => s.id),
    engB.spirits.map(s => s.id),
    "spirit order matches"
  );
  // Board state is seeded — spot check one piece
  assert.equal(engA.board.spotlightHex, engB.board.spotlightHex, "spotlight hex matches (seeded board)");

  console.log("n3 start smoke test: all assertions passed ✔");
  console.log(`  seed=${aFrame.seed}, cursor=${engA.rng.cursor}, spotlight=${engA.board.spotlightHex}`);
  a.close(); b.close();
} finally {
  server.kill();
}
