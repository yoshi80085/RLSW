// ─── N12 ABUSE SMOKE ─────────────────────────────────────────────────────────
// Proves the resource limits in index.js actually bite. Every check here is a
// way to knock over a RAM-only server on a free dyno, so each one spawns its
// own server with that limit tightened to something testable — otherwise we'd
// be sitting here minting 500 rooms to prove a cap works.
//
//  1. Oversized frames are rejected (maxPayload)
//  2. Frame floods are rate-limited and hung up on
//  3. Room creation is capped per IP...
//  4. ...and the quota is released when the room dies
//  5. Bad room codes are throttled (code enumeration)
//  6. Display names are trimmed of control chars and length-capped
//  7. Spectators are capped per room
//  8. Disallowed browser Origins are refused at the handshake
//  9. Origin-less (non-browser) clients still connect
// 10. The action log is capped
// 11. botSeats can't push a room past 4 seats
//
//   node n12-abuse-smoke.mjs   (spawns servers on scratch ports)

import { spawn } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const CWD = fileURLToPath(new URL(".", import.meta.url));
let nextPort = 18820;

/** spawn a server with `env` overrides, run `fn(url)`, always clean up */
async function withServer(env, fn) {
  const port = nextPort++;
  const server = spawn(process.execPath, ["index.js"], {
    cwd: CWD,
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise(r => server.stdout.once("data", r));
  try {
    return await fn(`ws://127.0.0.1:${port}`);
  } finally {
    server.kill();
  }
}

/** open a socket; resolves once it's live. `headers` lets us forge an Origin. */
function open(url, headers) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, headers ? { headers } : undefined);
    const fail = (e) => reject(e instanceof Error ? e : new Error(String(e)));
    ws.on("open", () => resolve(ws));
    ws.on("error", fail);
    ws.on("unexpected-response", (_req, res) => fail(new Error(`http ${res.statusCode}`)));
  });
}

/** wait for the next frame matching `where` (or any frame if omitted) */
function next(ws, where = () => true, ms = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error("timeout waiting for frame")); }, ms);
    const onMsg = (raw) => {
      const f = JSON.parse(raw);
      if (!where(f)) return;
      cleanup(); resolve(f);
    };
    const onClose = (code) => { cleanup(); resolve({ t: "__CLOSED", code }); };
    function cleanup() { clearTimeout(timer); ws.off("message", onMsg); ws.off("close", onClose); }
    ws.on("message", onMsg);
    ws.on("close", onClose);
  });
}

const closed = (ws, ms = 5000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("socket never closed")), ms);
  ws.on("close", (code) => { clearTimeout(timer); resolve(code); });
});

const send = (ws, frame) => ws.send(JSON.stringify(frame));

/** create a room and return { ws, code } */
async function makeRoom(url, name = "Host") {
  const ws = await open(url);
  send(ws, { t: "CREATE_ROOM", name });
  const w = await next(ws, f => f.t === "WELCOME" || f.t === "ERROR");
  assert.equal(w.t, "WELCOME", `expected WELCOME, got ${w.t}:${w.code ?? ""}`);
  return { ws, code: w.code };
}

// ── 1. oversized frame rejected — WITHOUT taking the server down ────────────
// The first cut of this passed the assert below while the server process was
// dying behind it: `ws` raises a socket 'error' for an over-length frame, and
// an unhandled 'error' event is an uncaught throw. One 64KB message would have
// killed every game in progress. Hence the survivor check.
await withServer({ MAX_PAYLOAD_BYTES: "2048" }, async (url) => {
  const ws = await open(url);
  send(ws, { t: "CREATE_ROOM", name: "X".repeat(8192) });
  const code = await closed(ws);
  assert.equal(code, 1009, "oversized frame closes with 1009 Message Too Big");

  const survivor = await makeRoom(url, "StillHere");
  assert.ok(survivor.code, "server still serving after an oversized frame");
  survivor.ws.close();
  console.log("✅  1. oversized frames rejected, server survives");
});

// ── 2. frame flood rate-limited ─────────────────────────────────────────────
await withServer({ MSG_PER_SEC: "5", MSG_BURST: "10" }, async (url) => {
  const ws = await open(url);
  const hit = next(ws, f => f.t === "ERROR" && f.code === "RATE_LIMITED");
  for (let i = 0; i < 60; i++) send(ws, { t: "PING" });
  const f = await hit;
  assert.equal(f.code, "RATE_LIMITED");
  assert.equal(await closed(ws), 1008, "flooder is hung up on");
  console.log("✅  2. frame floods rate-limited and closed");
});

// ── 3 + 4. per-IP room cap, and quota released when the room dies ───────────
await withServer({ MAX_ROOMS_PER_IP: "2", ROOM_TTL_MS: "150" }, async (url) => {
  const a = await makeRoom(url);
  const b = await makeRoom(url);

  const third = await open(url);
  send(third, { t: "CREATE_ROOM", name: "Greedy" });
  const denied = await next(third, f => f.t === "WELCOME" || f.t === "ERROR");
  assert.equal(denied.t, "ERROR");
  assert.equal(denied.code, "TOO_MANY_ROOMS");
  third.close();
  console.log("✅  3. room creation capped per IP");

  // drop one room and let the grave timer fire — the quota must come back,
  // or a busy evening slowly locks the host out of their own server
  a.ws.close();
  await new Promise(r => setTimeout(r, 400));
  const c = await makeRoom(url, "AfterGrave");
  assert.ok(c.code, "a freed room slot can be reused");
  b.ws.close(); c.ws.close();
  console.log("✅  4. room quota released when the room is reaped");
});

// ── 5. bad room codes throttled ─────────────────────────────────────────────
await withServer({ MAX_BAD_JOINS: "3", BAD_JOIN_WINDOW_MS: "60000" }, async (url) => {
  const ws = await open(url);
  for (let i = 0; i < 3; i++) {
    send(ws, { t: "JOIN_ROOM", code: "ZZZZ", name: "Scanner" });
    const f = await next(ws, x => x.t === "ERROR");
    assert.equal(f.code, "NO_SUCH_ROOM");
  }
  send(ws, { t: "JOIN_ROOM", code: "ZZZZ", name: "Scanner" });
  const f = await next(ws, x => x.t === "ERROR");
  assert.equal(f.code, "TOO_MANY_ATTEMPTS", "scanner cut off past the ceiling");
  assert.equal(await closed(ws), 1008);
  console.log("✅  5. room-code enumeration throttled");
});

// ── 6. names sanitised and capped ───────────────────────────────────────────
await withServer({ MAX_NAME_LEN: "10" }, async (url) => {
  const ws = await open(url);
  send(ws, { t: "CREATE_ROOM", name: "  \u0007ab\ncdefghijklmnop  " });
  await next(ws, f => f.t === "WELCOME");
  const st = await next(ws, f => f.t === "ROOM_STATE");
  const name = st.seats[0].name;
  /* eslint-disable-next-line no-control-regex */
  assert.ok(!/[\u0000-\u001f\u007f]/.test(name), `control chars stripped, got ${JSON.stringify(name)}`);
  assert.ok(name.length <= 10, `name capped at 10, got ${name.length}`);
  assert.equal(name, "abcdefghij");

  // an all-junk name must still leave something renderable behind
  const ws2 = await open(url);
  send(ws2, { t: "CREATE_ROOM", name: "\u0007\u0000 \u001b" });
  await next(ws2, f => f.t === "WELCOME");
  const st2 = await next(ws2, f => f.t === "ROOM_STATE");
  assert.equal(st2.seats[0].name, "Player", "empty-after-strip falls back");
  ws.close(); ws2.close();
  console.log("✅  6. display names sanitised and length-capped");
});

// ── 7. spectators capped ────────────────────────────────────────────────────
await withServer({ MAX_SPECTATORS: "1" }, async (url) => {
  const { ws: host, code } = await makeRoom(url);
  const s1 = await open(url);
  send(s1, { t: "JOIN_ROOM", code, name: "Watcher1", spectator: true });
  assert.equal((await next(s1, f => f.t === "WELCOME" || f.t === "ERROR")).t, "WELCOME");

  const s2 = await open(url);
  send(s2, { t: "JOIN_ROOM", code, name: "Watcher2", spectator: true });
  const f = await next(s2, x => x.t === "WELCOME" || x.t === "ERROR");
  assert.equal(f.t, "ERROR");
  assert.equal(f.code, "SPECTATORS_FULL");
  host.close(); s1.close(); s2.close();
  console.log("✅  7. spectators capped per room");
});

// ── 8 + 9. origin allowlist ─────────────────────────────────────────────────
await withServer({ ALLOWED_ORIGINS: "https://yoshi80085.github.io" }, async (url) => {
  await assert.rejects(
    () => open(url, { Origin: "https://evil.example" }),
    /http 403/,
    "a disallowed browser origin is refused at the handshake");
  console.log("✅  8. disallowed Origin refused (403)");

  const ok = await open(url, { Origin: "https://yoshi80085.github.io" });
  ok.close();
  const bare = await open(url); // node/curl send no Origin at all
  bare.close();
  console.log("✅  9. allowed Origin + origin-less clients connect");
});

// ── 10 + 11. action log cap, and bots can't overflow the seat table ─────────
await withServer({ MAX_LOG: "3" }, async (url) => {
  const { ws: host } = await makeRoom(url);
  const config = { spirits: [{ id: "vex", name: "Vex" }], mode: "ffa" };
  send(host, {
    t: "START_GAME", config,
    seatMap: [{ seatId: 1, spiritId: "vex" }],
    // 11: eight bots into a 4-seat room
    botSeats: Array.from({ length: 8 }, (_, i) => ({ name: `Bot${i}`, spiritId: "riv" })),
  });
  const started = await next(host, f => f.t === "GAME_STARTED" || f.t === "ERROR");
  assert.equal(started.t, "GAME_STARTED");
  assert.equal(started.seats.length, 4, `seat table stays at 4, got ${started.seats.length}`);
  console.log("✅ 11. botSeats can't push a room past 4 seats");

  for (let i = 0; i < 3; i++) {
    send(host, { t: "ACTION", action: { type: "NOOP" }, cursorBefore: i });
    await next(host, f => f.t === "ACTION");
  }
  send(host, { t: "ACTION", action: { type: "NOOP" }, cursorBefore: 99 });
  const f = await next(host, x => x.t === "ACTION" || x.t === "ERROR");
  assert.equal(f.t, "ERROR");
  assert.equal(f.code, "LOG_FULL");
  host.close();
  console.log("✅ 10. action log capped");
});

console.log("\n🎉 N12 abuse smoke: ALL GREEN");
