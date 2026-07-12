// ─── N11 LOBBY GHOSTS + BOOT SMOKE ───────────────────────────────────────────
// Proves lobby-seat lifecycle headlessly:
// 1. Explicit LEAVE in the lobby frees the seat immediately (no ghost)
// 2. A silent disconnect in the lobby is removed after LOBBY_LINGER_MS
//    (but a token rejoin WITHIN the window reclaims the seat — F5 grace)
// 3. seatIds never collide after removals (next join gets a fresh id)
// 4. Host BOOT_PLAYER removes any seat; a live target gets BOOTED + closed
// 5. Non-hosts can't boot; the host can't boot itself; no booting mid-game
// 6. Host LEAVE migrates hostship to the next human seat
//
//   node n11-boot-smoke.mjs   (spawns its own server on a scratch port)

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const PORT = 18797;
const LINGER = 600; // ms — shrunk via env so the smoke doesn't wait 45s
const WS_URL = `ws://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const server = spawn(process.execPath, ["index.js"], {
  cwd: fileURLToPath(new URL(".", import.meta.url)),
  env: { ...process.env, PORT: String(PORT), LOBBY_LINGER_MS: String(LINGER) },
  stdio: "ignore",
});
await sleep(700);

function client(name) {
  const ws = new WebSocket(WS_URL);
  const inbox = [];
  ws.on("message", raw => inbox.push(JSON.parse(raw)));
  const open = new Promise(r => ws.on("open", r));
  const waitFor = async (t, pred = () => true, ms = 3000) => {
    const t0 = Date.now();
    for (;;) {
      const i = inbox.findIndex(f => f.t === t && pred(f));
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
  // ── setup: A hosts, B + C join ─────────────────────────────────────────────
  const a = client("A"), b = client("B"), c = client("C");
  await Promise.all([a.open, b.open, c.open]);
  a.send({ t: "CREATE_ROOM", name: "Alice" });
  const wA = await a.waitFor("WELCOME");
  b.send({ t: "JOIN_ROOM", code: wA.code, name: "Bob" });
  await b.waitFor("WELCOME");
  c.send({ t: "JOIN_ROOM", code: wA.code, name: "Cara" });
  const wC = await c.waitFor("WELCOME");
  await a.waitFor("ROOM_STATE", f => f.seats.length === 3);

  // ── 1. explicit LEAVE frees the seat immediately ──────────────────────────
  a.inbox.length = 0; // drop stale ROOM_STATEs from the join sequence
  b.send({ t: "LEAVE" });
  const rs1 = await a.waitFor("ROOM_STATE", f => !f.seats.some(s => s.name === "Bob"));
  check("LEAVE removes the seat immediately", rs1.seats.length === 2);

  // ── 2. silent disconnect lingers, then the ghost is removed ───────────────
  c.ws.close();
  const rs2 = await a.waitFor("ROOM_STATE", f => f.seats.some(s => s.name === "Cara" && !s.connected));
  check("dropped seat first shows disconnected", !!rs2);
  const rs3 = await a.waitFor("ROOM_STATE", f => !f.seats.some(s => s.name === "Cara"), LINGER + 2000);
  check("ghost seat removed after linger window", rs3.seats.length === 1);

  // ── 2b. rejoin WITHIN the window keeps the seat (F5 grace) ────────────────
  const d = client("D");
  await d.open;
  d.send({ t: "JOIN_ROOM", code: wA.code, name: "Dana" });
  const wD = await d.waitFor("WELCOME");
  d.ws.close();
  await sleep(150); // well inside the linger window
  const d2 = client("D2");
  await d2.open;
  d2.send({ t: "JOIN_ROOM", code: wA.code, rejoinToken: wD.rejoinToken });
  const wD2 = await d2.waitFor("WELCOME");
  check("F5-style rejoin inside window reclaims seat", wD2.seatId === wD.seatId && wD2.rejoined === true);
  await sleep(LINGER + 300);
  const rs4 = await (async () => { a.inbox.length = 0; const e0 = client("probe"); await e0.open;
    e0.send({ t: "JOIN_ROOM", code: wA.code, name: "Probe" }); await e0.waitFor("WELCOME");
    const rs = await a.waitFor("ROOM_STATE", f => f.seats.some(s => s.name === "Probe"));
    return { rs, e0 }; })();
  check("reclaimed seat survives past the old linger deadline", rs4.rs.seats.some(s => s.name === "Dana" && s.connected));

  // ── 3. seatIds don't collide after removals ───────────────────────────────
  const ids = rs4.rs.seats.map(s => s.seatId);
  check("no duplicate seatIds after churn", new Set(ids).size === ids.length);

  // ── 4/5. boot rules ───────────────────────────────────────────────────────
  const probe = rs4.e0;
  probe.send({ t: "BOOT_PLAYER", seatId: wA.seatId }); // non-host boots host
  const e1 = await probe.waitFor("ERROR");
  check("non-host boot refused", e1.code === "NOT_HOST");

  a.send({ t: "BOOT_PLAYER", seatId: wA.seatId }); // host boots itself
  const e2 = await a.waitFor("ERROR");
  check("self-boot refused", e2.code === "SELF_BOOT");

  const probeSeatId = rs4.rs.seats.find(s => s.name === "Probe").seatId;
  a.send({ t: "BOOT_PLAYER", seatId: probeSeatId });
  const booted = await probe.waitFor("BOOTED");
  check("booted player is told", !!booted);
  await sleep(200);
  check("booted player's socket closed", probe.ws.readyState !== WebSocket.OPEN);
  const rs5 = await a.waitFor("ROOM_STATE", f => !f.seats.some(s => s.name === "Probe"));
  check("booted seat removed for everyone", !!rs5);

  // no booting mid-game
  a.send({ t: "START_GAME", config: { spirits: [{ id: "x" }, { id: "y" }] },
    seatMap: rs5.seats.map((s, i) => ({ seatId: s.seatId, spiritId: i ? "y" : "x" })) });
  await a.waitFor("GAME_STARTED");
  a.send({ t: "BOOT_PLAYER", seatId: rs5.seats.find(s => s.seatId !== wA.seatId).seatId });
  const e3 = await a.waitFor("ERROR");
  check("mid-game boot refused", e3.code === "PLAYING");
  a.send({ t: "RETURN_TO_LOBBY" });
  await a.waitFor("RETURNED_TO_LOBBY");

  // ── 6. host LEAVE migrates hostship ───────────────────────────────────────
  a.send({ t: "LEAVE" });
  const rs6 = await d2.waitFor("ROOM_STATE", f => !f.seats.some(s => s.name === "Alice"));
  check("host seat removed on LEAVE", rs6.seats.length === 1);
  check("hostship migrated to remaining player", rs6.hostSeatId === wD2.seatId);

  console.log(`\n${fail === 0 ? "N11 SMOKE: ALL PASS" : "N11 SMOKE: FAILURES"} — ${pass} passed, ${fail} failed`);
} finally {
  server.kill();
}
process.exit(fail === 0 ? 0 : 1);
