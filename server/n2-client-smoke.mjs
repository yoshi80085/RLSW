// ─── N2 CLIENT SMOKE — drives TWO src/net/client.js clients at a live server ─
// Proves the N2 exit criterion headlessly: two clients (≙ two browser tabs)
// create/join a room and each sees the other in ROOM_STATE. Also covers the
// wrapper's own machinery: ERROR surfacing (bad code), and backoff reconnect
// reclaiming the same seat after the socket is severed mid-flight.
//
//   node n2-client-smoke.mjs   (spawns its own server on a scratch port)

import { spawn } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { makeNetClient } from "../src/net/client.js";

const PORT = 18788;
const url = `ws://127.0.0.1:${PORT}`;

// stand-in for browser localStorage (one per "tab")
const memStore = () => {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
};
const tab = () => makeNetClient({ url, WebSocketImpl: WebSocket, storage: memStore() });

const server = spawn(process.execPath, ["index.js"], {
  cwd: fileURLToPath(new URL(".", import.meta.url)), // Windows-safe
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise(r => server.stdout.once("data", r)); // "listening" line

try {
  // ── two tabs see each other in a room (THE N2 exit criterion) ──────────────
  const a = tab(), b = tab();
  await a.connect();
  a.createRoom("Alex");
  await a.waitFor("WELCOME");
  assert.equal(a.seatId, 1);
  assert.ok(/^[A-Z]{4}$/.test(a.code), "4-letter room code");
  assert.ok(a.rejoinToken, "rejoin token persisted");

  await b.connect();
  const aSees = a.waitFor("ROOM_STATE", { where: f => f.seats.length === 2 });
  b.joinRoom(a.code, { name: "Sam" });
  const bSees = await b.waitFor("ROOM_STATE", { where: f => f.seats.length === 2 });
  assert.deepEqual(bSees.seats.map(s => s.name), ["Alex", "Sam"], "tab B sees both players");
  assert.deepEqual((await aSees).seats.map(s => s.name), ["Alex", "Sam"], "tab A sees both players");
  assert.equal(bSees.hostSeatId, 1, "host badge points at the creator");

  // ── ERROR frames surface as rejections (bad room code) ─────────────────────
  const c = tab();
  await c.connect();
  c.joinRoom("ZZZZ", { name: "Ghost" });
  await assert.rejects(c.waitFor("WELCOME"), /bad code/, "NO_SUCH_ROOM rejects the join");
  c.close();

  // ── sever B's socket → backoff reconnect reclaims the SAME seat ────────────
  const seatBefore = b.seatId;
  const rejoined = b.waitFor("WELCOME", { ms: 10000 });
  const aSeesDrop = a.waitFor("ROOM_STATE", { where: f => f.seats.some(s => s.seatId === 2 && !s.connected), ms: 10000 });
  b._ws().close(); // wifi blip — NOT leave(), so the session must survive
  await aSeesDrop;
  const w = await rejoined;
  assert.equal(w.rejoined, true, "server recognised the rejoin token");
  assert.equal(b.seatId, seatBefore, "backoff reconnect reclaimed the same seat");
  await a.waitFor("ROOM_STATE", { where: f => f.seats.every(s => s.connected), ms: 10000 });

  // ── leave() forgets the session for good ────────────────────────────────────
  b.leave();
  assert.equal(b.savedSession(), null, "leave() cleared the stored session");

  console.log("n2 client smoke test: all assertions passed ✔");
  a.close();
} finally {
  server.kill();
}
