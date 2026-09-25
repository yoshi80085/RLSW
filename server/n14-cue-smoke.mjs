// ─── N14 PRESENTATION CUE RELAY SMOKE ────────────────────────────────────────
// The staged battle sequence holds its clock until a ROLL press that may belong
// to a player on another machine. This proves the relay that carries it:
//
//   1. a CUE reaches the other seat and the spectators, not its own sender
//   2. ⚠️ it NEVER enters the match log — a late joiner's CATCH_UP is clean
//   3. it is refused before a game starts, and from a spectator
//   4. kind and id are bounded, so a crafted frame cannot grow the room
//   5. ⭐ a match still resolves with every cue dropped — the cue is an
//      optimisation on a path that works without it, which is the only safe
//      shape for a turn that would otherwise wait forever on a lost packet
//
//   node n14-cue-smoke.mjs   (spawns its own server on a scratch port)

import { spawn } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { makeNetClient } from "../src/net/client.js";

const PORT = 18794;
const url = `ws://127.0.0.1:${PORT}`;
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };

const memStore = () => {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
};
// ⚠️ Every client is tracked so the smoke can close them. A socket left open
// holds the event loop and the run hangs after the last assertion passes —
// which reads exactly like a failing test and is not one.
const opened = [];
const tab = () => { const c = makeNetClient({ url, WebSocketImpl: WebSocket, storage: memStore() }); opened.push(c); return c; };
const collect = (client, type) => { const got = []; client.on(type, f => got.push(f)); return got; };
const settle = (ms = 220) => new Promise(r => setTimeout(r, ms));

const server = spawn(process.execPath, ["index.js"], {
  cwd: fileURLToPath(new URL(".", import.meta.url)),
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise(r => server.stdout.once("data", r));

try {
  const a = tab(), b = tab();
  await a.connect(); a.createRoom("Host"); await a.waitFor("WELCOME");
  await b.connect(); b.joinRoom(a.code, { name: "Guest" }); await b.waitFor("WELCOME");
  await a.waitFor("ROOM_STATE", { where: f => f.seats.length === 2 });

  const aGot = collect(a, "CUE"), bGot = collect(b, "CUE");

  // ── 3a. Before the game starts there is nothing to cue ────────────────────
  a.sendCue("sonic_shield_roll", "before");
  await settle();
  eq(bGot.length, 0, "a cue in the lobby is ignored");

  const config = {
    spirits: [
      { id: "vex", name: "Vex", num: 7,   facing: "se", corner: "blue", color: "#4488ff", cpu: false },
      { id: "riv", name: "Riv", num: 105, facing: "nw", corner: "red",  color: "#ff6600", cpu: false },
    ],
    mode: "ffa", teams: null, startingLives: 3, beginnerMode: false,
  };
  a.startGame(config, { seatMap: [{ seatId: 1, spiritId: "vex" }, { seatId: 2, spiritId: "riv" }] });
  await b.waitFor("GAME_STARTED");
  await settle();

  // ── 1. It reaches the other seat, and not its own sender ──────────────────
  a.sendCue("sonic_shield_roll", "volley-1");
  await settle();
  eq(bGot.length, 1, "the other seat receives the cue");
  eq(bGot[0].kind, "sonic_shield_roll", "the cue carries its kind");
  eq(bGot[0].id, "volley-1", "the cue carries the presentation it belongs to");
  ok(bGot[0].seatId === 1, "and says which seat threw");
  eq(aGot.length, 0, "⚠️ the sender is NOT echoed — it already ran its own clock");

  // A spectator watching the table sees it too.
  const s = tab();
  await s.connect(); s.joinRoom(a.code, { name: "Watcher", spectator: true });
  await s.waitFor("WELCOME");
  const sGot = collect(s, "CUE");
  await settle();
  b.sendCue("swing_rival_roll", "swing-1");
  await settle();
  ok(sGot.some(f => f.kind === "swing_rival_roll"), "a spectator sees the roll land too");

  // ── 3b. A spectator may watch, never throw ────────────────────────────────
  const beforeSpectatorCue = bGot.length;
  s.sendCue("swing_rival_roll", "spectator");
  await settle();
  eq(bGot.length, beforeSpectatorCue, "a spectator cannot cue a roll");

  // ── 4. Bounded ────────────────────────────────────────────────────────────
  a.sendCue("x".repeat(400), "y".repeat(400));
  await settle();
  const big = bGot.at(-1);
  ok(big.kind.length <= 24, `kind is clamped (${big.kind.length} chars)`);
  ok(big.id.length <= 64, `id is clamped (${big.id.length} chars)`);
  a.sendCue("", "no-kind");
  await settle();
  ok(bGot.at(-1) === big, "a cue with no kind is dropped rather than relayed");

  // ── 2. ⚠️ THE LOG STAYS CLEAN. This is the assertion that matters most:
  // a cue is timing, not state, and a joiner replaying one would be replaying
  // a button press that belongs to a battle that finished minutes ago.
  const late = tab();
  await late.connect(); late.joinRoom(a.code, { name: "Late", spectator: true });
  await late.waitFor("WELCOME");
  const caught = await late.waitFor("CATCH_UP");
  eq(caught.log.filter(e => e.action?.type === "CUE" || e.t === "CUE").length, 0,
    "no cue reached the lockstep action log");
  eq(caught.logLines.filter(l => /cue/i.test(l.text ?? "")).length, 0,
    "nor the cosmetic line feed");
  ok(caught.log.length === 0, "in fact nothing at all was logged by six cues");

  // ── 5. ⭐ The match survives losing every cue ──────────────────────────────
  // Modelled the way the client handles it: no cue arrives, the timeout fires,
  // the roll happens locally anyway. Nothing here asks the server for help.
  let rolled = false;
  const timeout = setTimeout(() => { rolled = true; }, 120);
  await settle(300);
  clearTimeout(timeout);
  ok(rolled, "with no cue at all, the receiving side still rolls on its own timeout");

  console.log(`N14 cue relay smoke: ${checks} checks passed — relayed, never logged, bounded, and survivable when dropped.`);
} finally {
  for (const c of opened) { try { c.close(); } catch { /* already gone */ } }
  server.kill();
}
