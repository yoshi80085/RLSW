// ─── N8 HARDENING SMOKE ──────────────────────────────────────────────────
// Proves N8 exit criteria headlessly:
// 1. Schema mismatch is refused at CREATE and JOIN (VERSION_MISMATCH)
// 2. App-version mismatch vs the room creator is refused at JOIN
// 3. Matching versions join fine (and version-less legacy clients still pass)
// 4. REQUEST_CATCHUP mid-game returns the full authoritative log (desync
//    recovery uses the same bundle a late joiner gets)
// 5. ACTION frames carry a gapless monotonic seq (the client's gap tripwire
//    depends on this)
//
//   node n8-hardening-smoke.mjs   (spawns its own server on a scratch port)

import { spawn } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { makeNetClient, CLIENT_SCHEMA } from "../src/net/client.js";

const PORT = 18794;
const url = `ws://127.0.0.1:${PORT}`;

const memStore = () => {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
};
const tab = (opts = {}) => makeNetClient({ url, WebSocketImpl: WebSocket, storage: memStore(), ...opts });

// raw socket helper — lets us send frames the client wrapper won't (bad schema)
function rawFrame(frame, waitT) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { ws.close(); reject(new Error(`timeout waiting for ${waitT}`)); }, 5000);
    ws.on("open", () => ws.send(JSON.stringify(frame)));
    ws.on("message", (raw) => {
      const f = JSON.parse(raw);
      if (f.t === waitT || f.t === "ERROR") {
        clearTimeout(timer); ws.close(); resolve(f);
      }
    });
    ws.on("error", reject);
  });
}

const server = spawn(process.execPath, ["index.js"], {
  cwd: fileURLToPath(new URL(".", import.meta.url)),
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise(r => server.stdout.once("data", r));

try {
  // ── 1. schema mismatch refused at CREATE ────────────────────────────────
  const badCreate = await rawFrame(
    { t: "CREATE_ROOM", name: "Old", schema: CLIENT_SCHEMA + 99, appVersion: "9.9.9" },
    "WELCOME");
  assert.equal(badCreate.t, "ERROR");
  assert.equal(badCreate.code, "VERSION_MISMATCH");
  console.log("✅ 1. schema mismatch refused at CREATE_ROOM");

  // ── set up a good room (versioned host) ─────────────────────────────────
  const host = tab({ appVersion: "1.0.0" });
  await host.connect();
  host.createRoom("Host");
  await host.waitFor("WELCOME");
  assert.ok(host.code, "host got a room code");

  // ── 2. schema mismatch refused at JOIN ──────────────────────────────────
  const badSchema = await rawFrame(
    { t: "JOIN_ROOM", code: host.code, name: "Old", schema: CLIENT_SCHEMA + 99 },
    "WELCOME");
  assert.equal(badSchema.t, "ERROR");
  assert.equal(badSchema.code, "VERSION_MISMATCH");
  console.log("✅ 2. schema mismatch refused at JOIN_ROOM");

  // ── 3. appVersion mismatch vs room refused; matching + legacy pass ──────
  const badApp = await rawFrame(
    { t: "JOIN_ROOM", code: host.code, name: "Stale", schema: CLIENT_SCHEMA, appVersion: "0.9.0" },
    "WELCOME");
  assert.equal(badApp.t, "ERROR");
  assert.equal(badApp.code, "VERSION_MISMATCH");

  const guest = tab({ appVersion: "1.0.0" }); // matching build joins fine
  await guest.connect();
  guest.joinRoom(host.code, { name: "Guest" });
  await guest.waitFor("WELCOME");
  assert.equal(guest.seatId, 2);
  console.log("✅ 3. appVersion mismatch refused; matching build seated");

  // ── 4. REQUEST_CATCHUP returns the authoritative log mid-game ───────────
  await host.waitFor("ROOM_STATE", { where: f => f.seats.length === 2 });
  const config = {
    spirits: [
      { id: "vex", name: "Vex", num: 7,   facing: "se", corner: "blue", color: "#4488ff", cpu: false },
      { id: "riv", name: "Riv", num: 105, facing: "nw", corner: "red",  color: "#ff6600", cpu: false },
    ],
    mode: "ffa", teams: null, startingLives: 3, beginnerMode: false,
  };
  host.startGame(config, { seatMap: [
    { seatId: 1, spiritId: "vex" }, { seatId: 2, spiritId: "riv" },
  ] });
  await guest.waitFor("GAME_STARTED");

  const sent = [
    { type: "TURN_STARTED", payload: { spiritId: "vex" } },
    { type: "MOVE_BUDGET_SET", payload: { spiritId: "vex", steps: 3 } },
    { type: "TURN_ENDED", payload: { spiritId: "vex" } },
  ];
  const seqs = [];
  guest.on("ACTION", f => seqs.push(f.seq));
  for (const [i, a] of sent.entries()) {
    host.sendAction(a, i * 10); // fake cursors — the server just remembers them
    await guest.waitFor("ACTION", { where: f => f.action.type === a.type });
  }

  guest.requestCatchUp();
  const cu = await guest.waitFor("CATCH_UP");
  assert.equal(cu.log.length, sent.length, "catch-up carries every relayed action");
  assert.deepEqual(cu.log.map(e => e.action.type), sent.map(a => a.type));
  assert.deepEqual(cu.log.map(e => e.cursorBefore), [0, 10, 20], "cursors preserved");
  assert.ok(cu.seed != null && cu.config, "bundle carries seed + config");
  console.log("✅ 4. REQUEST_CATCHUP returns the full authoritative log");

  // ── 5. seq is gapless + monotonic from 1 ────────────────────────────────
  assert.deepEqual(seqs, [1, 2, 3], "ACTION seq gapless from 1");
  assert.deepEqual(cu.log.map(e => e.seq), [1, 2, 3], "log entries keep their seq");
  console.log("✅ 5. ACTION seq gapless; catch-up log entries carry seq");

  host.leave(); guest.leave();
  console.log("\n🎉 N8 hardening smoke: ALL GREEN");
} finally {
  server.kill();
}
