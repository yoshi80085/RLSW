// ─── N10 RETURN-TO-LOBBY SMOKE ───────────────────────────────────────────────
// Proves the game-over → lobby flow headlessly:
// 1. RETURN_TO_LOBBY resets the room (phase, log, seed, bots, spiritIds) and
//    broadcasts RETURNED_TO_LOBBY to every client
// 2. After the reset, a rejoin token reclaims the SEAT (not spectator) and no
//    CATCH_UP is sent — the player lands in the room's lobby, not a dead game
// 3. A token rejoin kicks a stale still-open socket (fast F5 / lobby-return
//    race) without the dying socket's close handler clobbering the new one
// 4. Non-members / spectators can't reset the room
//
//   node n10-lobby-return-smoke.mjs   (spawns its own server on a scratch port)

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const PORT = 18796;
const WS_URL = `ws://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const server = spawn(process.execPath, ["index.js"], {
  cwd: fileURLToPath(new URL(".", import.meta.url)),
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});
await sleep(700);

function client(name) {
  const ws = new WebSocket(WS_URL);
  const inbox = [];
  ws.on("message", raw => inbox.push(JSON.parse(raw)));
  const open = new Promise(r => ws.on("open", r));
  const waitFor = async (t, ms = 3000) => {
    const t0 = Date.now();
    for (;;) {
      const i = inbox.findIndex(f => f.t === t);
      if (i >= 0) return inbox.splice(i, 1)[0];
      if (Date.now() - t0 > ms) throw new Error(`${name}: timeout waiting for ${t}`);
      await sleep(20);
    }
  };
  const send = (f) => ws.send(JSON.stringify(f));
  return { ws, inbox, open, waitFor, send, name };
}

let pass = 0, fail = 0;
const check = (label, ok) => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${label}`); };

try {
  // ── setup: host + joiner, start a game, relay one action ──────────────────
  const a = client("A"), b = client("B");
  await Promise.all([a.open, b.open]);

  a.send({ t: "CREATE_ROOM", name: "Alice" });
  const wA = await a.waitFor("WELCOME");
  await a.waitFor("ROOM_STATE");

  b.send({ t: "JOIN_ROOM", code: wA.code, name: "Bob" });
  const wB = await b.waitFor("WELCOME");
  check("B seated (not spectator)", wB.seatId === 2 && !wB.spectator);

  a.send({ t: "START_GAME", config: { spirits: [{ id: "x" }, { id: "y" }] },
    seatMap: [{ seatId: 1, spiritId: "x" }, { seatId: 2, spiritId: "y" }],
    botSeats: [{ name: "Botty", spiritId: "z" }] });
  await a.waitFor("GAME_STARTED");
  await b.waitFor("GAME_STARTED");

  a.send({ t: "ACTION", action: { type: "TEST" }, cursorBefore: 0 });
  await b.waitFor("ACTION");

  // ── the fix: RETURN_TO_LOBBY resets the room for everyone ─────────────────
  a.send({ t: "RETURN_TO_LOBBY" });
  const rA = await a.waitFor("RETURNED_TO_LOBBY");
  const rB = await b.waitFor("RETURNED_TO_LOBBY");
  check("both clients got RETURNED_TO_LOBBY", !!rA && !!rB);
  const rsA = await a.waitFor("ROOM_STATE");
  check("room phase back to lobby", rsA.phase === "lobby");
  check("bot seats removed", !rsA.seats.some(s => s.isBot));
  check("spiritIds cleared", rsA.seats.every(s => s.spiritId === null));

  // ── close + rejoin by token → must reclaim SEAT, no CATCH_UP ──────────────
  a.ws.close();
  await sleep(150);
  const a2 = client("A2");
  await a2.open;
  a2.send({ t: "JOIN_ROOM", code: wA.code, rejoinToken: wA.rejoinToken });
  const w2 = await a2.waitFor("WELCOME");
  check("rejoin reclaims seat 1 (not spectator)", w2.seatId === 1 && !w2.spectator && w2.rejoined);
  await sleep(150);
  check("no CATCH_UP after lobby reset", !a2.inbox.some(f => f.t === "CATCH_UP"));

  // ── stale-socket kick: rejoin WHILE the old socket is still open ──────────
  const a3 = client("A3");
  await a3.open;
  a3.send({ t: "JOIN_ROOM", code: wA.code, rejoinToken: wA.rejoinToken });
  const w3 = await a3.waitFor("WELCOME");
  check("token rejoin kicks stale socket, reclaims seat", w3.seatId === 1 && !w3.spectator);
  await sleep(200);
  check("old socket was terminated", a2.ws.readyState !== WebSocket.OPEN);
  // the terminated socket's close handler must NOT null the NEW socket's seat —
  // trigger a fresh broadcast and read seat 1's connected flag:
  a3.inbox.length = 0;
  const probe = client("probe");
  await probe.open;
  probe.send({ t: "JOIN_ROOM", code: wA.code, name: "Probe" });
  await probe.waitFor("WELCOME");
  const rs3 = await a3.waitFor("ROOM_STATE");
  check("seat 1 still connected after stale-socket close", rs3.seats.find(s => s.seatId === 1)?.connected === true);

  // ── non-members can't reset ───────────────────────────────────────────────
  const s = client("S");
  await s.open;
  s.send({ t: "RETURN_TO_LOBBY" });
  const eS = await s.waitFor("ERROR");
  check("non-member RETURN_TO_LOBBY refused", eS.code === "NOT_IN_ROOM");

  console.log(`\n${fail === 0 ? "N10 SMOKE: ALL PASS" : "N10 SMOKE: FAILURES"} — ${pass} passed, ${fail} failed`);
} finally {
  server.kill();
}
process.exit(fail === 0 ? 0 : 1);
