// ─── N1 SMOKE TEST — drives 3 fake clients against a live server ─────────────
// Proves: create/join, seat assignment, start handshake with server-stamped
// seed, action sequencing + broadcast order, spectator catch-up, and rejoin.
//
//   node smoke.mjs        (spawns its own server on a scratch port)

import { spawn } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const PORT = 18787;
const url = `ws://127.0.0.1:${PORT}`;

// tiny promise-flavoured ws client
function client() {
  const ws = new WebSocket(url);
  const inbox = [];
  const waiters = [];
  ws.on("message", (raw) => {
    const f = JSON.parse(raw);
    const i = waiters.findIndex(w => w.match(f));
    if (i >= 0) waiters.splice(i, 1)[0].resolve(f);
    else inbox.push(f);
  });
  const next = (match, ms = 3000) => {
    const j = inbox.findIndex(match);
    if (j >= 0) return Promise.resolve(inbox.splice(j, 1)[0]);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout waiting for frame`)), ms);
      waiters.push({ match, resolve: f => { clearTimeout(t); resolve(f); } });
    });
  };
  return {
    ws, next,
    send: f => ws.send(JSON.stringify(f)),
    open: () => new Promise(r => ws.once("open", r)),
    close: () => ws.close(),
  };
}

const server = spawn(process.execPath, ["index.js"], {
  cwd: fileURLToPath(new URL(".", import.meta.url)), // Windows-safe (no leading-slash /C:/ path)
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise(r => server.stdout.once("data", r)); // "listening" line

try {
  // ── create + join ──────────────────────────────────────────────────────────
  const alex = client(); await alex.open();
  alex.send({ t: "CREATE_ROOM", name: "Alex" });
  const w1 = await alex.next(f => f.t === "WELCOME");
  assert.equal(w1.seatId, 1);
  assert.ok(/^[A-Z]{4}$/.test(w1.code), "4-letter room code");
  const rejoinToken = w1.rejoinToken;

  const sam = client(); await sam.open();
  sam.send({ t: "JOIN_ROOM", code: w1.code, name: "Sam" });
  const w2 = await sam.next(f => f.t === "WELCOME");
  assert.equal(w2.seatId, 2);
  const rs = await alex.next(f => f.t === "ROOM_STATE" && f.seats.length === 2);
  assert.deepEqual(rs.seats.map(s => s.name), ["Alex", "Sam"]);

  assert.ok((await (async () => { sam.send({ t: "START_GAME", config: {} }); return sam.next(f => f.t === "ERROR"); })()).code === "NOT_HOST",
    "non-host can't start");

  // ── start handshake ────────────────────────────────────────────────────────
  const config = { spirits: [{ id: "wildaxe", num: 7 }, { id: "vera", num: 105 }], mode: "ffa" };
  alex.send({ t: "START_GAME", config, seatMap: [{ seatId: 1, spiritId: "wildaxe" }, { seatId: 2, spiritId: "vera" }] });
  const g1 = await alex.next(f => f.t === "GAME_STARTED");
  const g2 = await sam.next(f => f.t === "GAME_STARTED");
  assert.equal(g1.seed, g2.seed, "both clients get the SAME seed");
  assert.ok(g1.seed > 0, "server stamped a seed");
  assert.deepEqual(g1.config, config);

  // ── action relay: order + broadcast ────────────────────────────────────────
  alex.send({ t: "ACTION", action: { type: "TURN_STARTED", spiritId: "wildaxe" }, cursorBefore: 0 });
  alex.send({ t: "ACTION", action: { type: "MOVE_STEP", spiritId: "wildaxe", toNum: 8 }, cursorBefore: 0 });
  sam.send({ t: "ACTION", action: { type: "TURN_STARTED", spiritId: "vera" }, cursorBefore: 3 });
  const a1 = await sam.next(f => f.t === "ACTION" && f.seq === 1);
  const a2 = await sam.next(f => f.t === "ACTION" && f.seq === 2);
  const a3 = await alex.next(f => f.t === "ACTION" && f.seq === 3);
  assert.equal(a1.action.type, "TURN_STARTED");
  assert.equal(a2.action.type, "MOVE_STEP");
  assert.equal(a2.seatId, 1);
  assert.equal(a3.seatId, 2, "seq 3 came from seat 2");
  await alex.next(f => f.t === "ACTION" && f.seq === 1); // sender echo arrives too
  alex.send({ t: "LOG_LINE", text: "🚶 Wildaxe → #8" });
  assert.equal((await sam.next(f => f.t === "LOG_LINE")).text, "🚶 Wildaxe → #8");

  // ── spectator catch-up mid-game ────────────────────────────────────────────
  const spec = client(); await spec.open();
  spec.send({ t: "JOIN_ROOM", code: w1.code, name: "Watcher", spectator: true });
  const w3 = await spec.next(f => f.t === "WELCOME");
  assert.equal(w3.spectator, true);
  const cu = await spec.next(f => f.t === "CATCH_UP");
  assert.equal(cu.seed, g1.seed, "catch-up carries the game seed");
  assert.equal(cu.log.length, 3, "catch-up carries the full sequenced log");
  assert.deepEqual(cu.log.map(e => e.seq), [1, 2, 3], "log is in seq order");
  assert.equal(cu.logLines.length, 1, "catch-up carries log lines");

  // spectators can't act
  spec.send({ t: "ACTION", action: { type: "MOVE_STEP" } });
  assert.equal((await spec.next(f => f.t === "ERROR")).code, "SPECTATOR");

  // ── reconnect: drop Alex, rejoin by token, catch up ────────────────────────
  alex.close();
  await sam.next(f => f.t === "ROOM_STATE" && f.seats.some(s => s.seatId === 1 && !s.connected));
  const alex2 = client(); await alex2.open();
  alex2.send({ t: "JOIN_ROOM", code: w1.code, rejoinToken });
  const w4 = await alex2.next(f => f.t === "WELCOME");
  assert.equal(w4.seatId, 1, "token reclaims the original seat");
  assert.equal(w4.rejoined, true);
  const cu2 = await alex2.next(f => f.t === "CATCH_UP");
  assert.equal(cu2.log.length, 3, "rejoiner gets the same catch-up bundle");

  // rejoined seat can act again and everyone stays in sequence
  alex2.send({ t: "ACTION", action: { type: "TURN_ENDED" }, cursorBefore: 9 });
  assert.equal((await sam.next(f => f.t === "ACTION" && f.seq === 4)).seatId, 1);
  assert.equal((await spec.next(f => f.t === "ACTION" && f.seq === 4)).action.type, "TURN_ENDED");

  console.log("room-server smoke test: all assertions passed ✔");
  alex2.close(); sam.close(); spec.close();
} finally {
  server.kill();
}
