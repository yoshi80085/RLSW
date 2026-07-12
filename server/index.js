// ─── RLSW ROOM SERVER — netcode phase N1 (see src/NETCODE_HANDOFF.md) ────────
// A dumb, ordered pipe with a memory: rooms, seats, action sequencing,
// broadcast, catch-up. NO game knowledge in v1 — the engine stays client-side
// (action-relay lockstep). Protocol frames are documented in the handoff doc.
//
//   node index.js          (PORT env to override, default 8787)

import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8787);
const ROOM_TTL_MS = 10 * 60 * 1000; // empty-room grave timer
const SCHEMA = 1;                   // must match engine state schema

// N8: version gate — a mismatched client is refused at the door (clean error
// in the lobby) instead of desyncing mid-game. `schema` is the engine/protocol
// schema (server-owned); `appVersion` is the client build — the CREATOR's
// version is pinned on the room and every joiner must match it exactly.
// Both checks are null-tolerant: clients that don't send versions (old smokes,
// dev tools) are let through — the gate only refuses EXPLICIT mismatches.
function versionMismatch(f, room = null) {
  if (f.schema != null && f.schema !== SCHEMA) {
    return `schema ${f.schema} ≠ server schema ${SCHEMA} — update your client`;
  }
  if (room && room.appVersion && f.appVersion && f.appVersion !== room.appVersion) {
    return `app version ${f.appVersion} ≠ room version ${room.appVersion} — everyone needs the same build`;
  }
  return null;
}

/** rooms: code → room. All state is RAM (landmine #5 in the handoff doc). */
const rooms = new Map();

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O — read aloud safely
function newRoomCode() {
  for (;;) {
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += CODE_ALPHABET[randomBytes(1)[0] % CODE_ALPHABET.length];
    }
    if (!rooms.has(code)) return code;
  }
}
const newToken = () => randomBytes(12).toString("hex");

function makeRoom(code) {
  return {
    code,
    appVersion: null,        // N8: creator's build — joiners must match
    phase: "lobby",          // lobby | playing
    seats: [],               // { seatId, name, ws|null, rejoinToken, isBot, spiritId|null }
    spectators: new Set(),   // ws
    hostSeatId: null,
    seed: null,
    config: null,
    seq: 0,
    log: [],                 // { seq, seatId, action, cursorBefore }
    logLines: [],            // { seq, seatId, text }
    graveTimer: null,
  };
}

const send = (ws, frame) => {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(frame));
};

function broadcast(room, frame, { except } = {}) {
  for (const seat of room.seats) if (seat.ws && seat.ws !== except) send(seat.ws, frame);
  for (const ws of room.spectators) if (ws !== except) send(ws, frame);
}

function roomState(room) {
  return {
    t: "ROOM_STATE",
    code: room.code,
    phase: room.phase,
    hostSeatId: room.hostSeatId,
    seats: room.seats.map(s => ({
      seatId: s.seatId, name: s.name, isBot: s.isBot,
      spiritId: s.spiritId, connected: s.isBot || !!s.ws,
    })),
    spectators: room.spectators.size,
  };
}

function catchUp(room) {
  return {
    t: "CATCH_UP",
    schema: SCHEMA,
    seed: room.seed,
    config: room.config,
    seats: room.seats.map(s => ({ seatId: s.seatId, name: s.name, isBot: s.isBot, spiritId: s.spiritId })),
    log: room.log,
    logLines: room.logLines,
  };
}

function scheduleGrave(room) {
  clearTimeout(room.graveTimer);
  room.graveTimer = setTimeout(() => {
    const anyLive = room.seats.some(s => s.ws) || room.spectators.size > 0;
    if (!anyLive) rooms.delete(room.code);
  }, ROOM_TTL_MS);
}

// ─── HTTP server + WebSocket upgrade ────────────────────────────────────────
// N9: Render (and most PaaS) routes all traffic through a single HTTP port and
// health-checks via GET. We serve a tiny HTTP handler for that, and upgrade
// WebSocket connections on the same port.
const httpServer = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end(`RLSW room server OK — ${rooms.size} room(s)`);
  }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ noServer: true });
httpServer.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws) => {
  // per-connection context
  let room = null;
  let seat = null;      // null for spectators
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  const err = (code, msg) => send(ws, { t: "ERROR", code, msg });

  ws.on("message", (raw) => {
    let f;
    try { f = JSON.parse(raw); } catch { return err("BAD_JSON", "unparseable frame"); }

    switch (f.t) {
      case "PING": return send(ws, { t: "PONG" });

      case "CREATE_ROOM": {
        if (room) return err("ALREADY_IN_ROOM", "leave first");
        const mismatch = versionMismatch(f);
        if (mismatch) return err("VERSION_MISMATCH", mismatch);
        room = makeRoom(newRoomCode());
        room.appVersion = f.appVersion ?? null; // N8: pin the creator's build
        rooms.set(room.code, room);
        seat = { seatId: 1, name: String(f.name ?? "Player"), ws, rejoinToken: newToken(), isBot: false, spiritId: null };
        room.seats.push(seat);
        room.hostSeatId = seat.seatId;
        send(ws, { t: "WELCOME", code: room.code, seatId: seat.seatId, rejoinToken: seat.rejoinToken, schema: SCHEMA });
        return send(ws, roomState(room));
      }

      case "JOIN_ROOM": {
        if (room) return err("ALREADY_IN_ROOM", "leave first");
        const r = rooms.get(String(f.code ?? "").toUpperCase());
        if (!r) return err("NO_SUCH_ROOM", "bad code");
        const mismatch = versionMismatch(f, r);
        if (mismatch) return err("VERSION_MISMATCH", mismatch);

        // rejoin: token matches a seat → reclaim it (works mid-game). If a stale
        // socket is still attached (fast F5, return-to-lobby race), kick it —
        // the token proves this connection is the same player.
        if (f.rejoinToken) {
          const back = r.seats.find(s => !s.isBot && s.rejoinToken === f.rejoinToken);
          if (back) {
            if (back.ws && back.ws !== ws) { try { back.ws.terminate(); } catch { /* already dead */ } back.ws = null; }
            room = r; seat = back; seat.ws = ws;
            clearTimeout(room.graveTimer);
            send(ws, { t: "WELCOME", code: room.code, seatId: seat.seatId, rejoinToken: seat.rejoinToken, schema: SCHEMA, rejoined: true });
            if (room.phase === "playing") send(ws, catchUp(room));
            broadcast(room, roomState(room));
            return;
          }
        }

        if (f.spectator || r.phase === "playing") {
          // mid-game joins become spectators (a seat can only be reclaimed by token)
          room = r;
          room.spectators.add(ws);
          clearTimeout(room.graveTimer);
          send(ws, { t: "WELCOME", code: room.code, seatId: null, spectator: true, schema: SCHEMA });
          if (room.phase === "playing") send(ws, catchUp(room));
          broadcast(room, roomState(room));
          return;
        }

        if (r.seats.length >= 4) return err("ROOM_FULL", "4 seats max");
        room = r;
        seat = { seatId: r.seats.length + 1, name: String(f.name ?? "Player"), ws, rejoinToken: newToken(), isBot: false, spiritId: null };
        r.seats.push(seat);
        clearTimeout(room.graveTimer);
        send(ws, { t: "WELCOME", code: room.code, seatId: seat.seatId, rejoinToken: seat.rejoinToken, schema: SCHEMA });
        return broadcast(room, roomState(room));
      }

      case "START_GAME": {
        if (!room || !seat) return err("NOT_IN_ROOM", "join first");
        if (seat.seatId !== room.hostSeatId) return err("NOT_HOST", "host starts the game");
        if (room.phase === "playing") return err("ALREADY_PLAYING", "game already started");
        if (!f.config || !Array.isArray(f.config.spirits)) return err("BAD_CONFIG", "config.spirits required");
        room.phase = "playing";
        room.config = f.config;
        room.seed = (f.seed >>> 0) || (Date.now() >>> 0); // server stamps the seed
        // seat→spirit mapping rides in config.seats (host assigns); bots = seats the host marked
        if (Array.isArray(f.seatMap)) {
          for (const m of f.seatMap) {
            const s = room.seats.find(x => x.seatId === m.seatId);
            if (s) s.spiritId = m.spiritId;
          }
        }
        if (Array.isArray(f.botSeats)) {
          for (const b of f.botSeats) {
            room.seats.push({ seatId: room.seats.length + 1, name: b.name ?? "Bot", ws: null, rejoinToken: null, isBot: true, spiritId: b.spiritId ?? null });
          }
        }
        return broadcast(room, {
          t: "GAME_STARTED", schema: SCHEMA, seed: room.seed, config: room.config,
          seats: room.seats.map(s => ({ seatId: s.seatId, name: s.name, isBot: s.isBot, spiritId: s.spiritId })),
        });
      }

      case "ACTION": {
        if (!room || room.phase !== "playing") return err("NOT_PLAYING", "no game in progress");
        if (!seat) return err("SPECTATOR", "spectators can't act");
        if (!f.action || typeof f.action.type !== "string") return err("BAD_ACTION", "action.type required");
        const entry = { seq: ++room.seq, seatId: seat.seatId, action: f.action, cursorBefore: f.cursorBefore ?? null };
        room.log.push(entry);
        // echo to everyone INCLUDING the sender — the sender uses the echo only
        // to confirm sequencing (it already applied locally); everyone else applies.
        return broadcast(room, { t: "ACTION", ...entry });
      }

      case "LOG_LINE": {
        if (!room || room.phase !== "playing" || !seat) return;
        const entry = { seq: room.seq, seatId: seat.seatId, text: String(f.text ?? "").slice(0, 500) };
        room.logLines.push(entry);
        return broadcast(room, { t: "LOG_LINE", ...entry }, { except: ws });
      }

      // N8: desync recovery — a client that detects a cursor mismatch or a seq
      // gap freezes its input and asks for the authoritative log; the server
      // answers with the same CATCH_UP bundle a late joiner gets.
      case "REQUEST_CATCHUP": {
        if (!room || room.phase !== "playing") return err("NOT_PLAYING", "no game in progress");
        return send(ws, catchUp(room));
      }

      // Return the whole room to the lobby (game over → play again). Any seated
      // player may trigger it — lockstep can't continue without them anyway.
      // Wipes the match (log/seed/config/bots) but keeps human seats + tokens,
      // so everyone's auto-rejoin lands back in the room's lobby, not as a
      // spectator of a dead game.
      case "RETURN_TO_LOBBY": {
        if (!room) return err("NOT_IN_ROOM", "join first");
        if (!seat) return err("SPECTATOR", "spectators can't reset the room");
        if (room.phase !== "playing") return; // already in lobby — idempotent
        room.phase = "lobby";
        room.seed = null; room.config = null;
        room.seq = 0; room.log = []; room.logLines = [];
        room.seats = room.seats.filter(s => !s.isBot); // bots were per-match
        for (const s of room.seats) s.spiritId = null;
        broadcast(room, { t: "RETURNED_TO_LOBBY" });
        return broadcast(room, roomState(room));
      }

      case "LEAVE": {
        ws.close();
        return;
      }

      default: return err("UNKNOWN_FRAME", `unknown t: ${f.t}`);
    }
  });

  ws.on("close", () => {
    if (!room) return;
    if (seat && seat.ws === ws) seat.ws = null; // seat survives — reclaimable by token (guard: a rejoin may have already replaced this socket)
    room.spectators.delete(ws);
    broadcast(room, roomState(room));
    const anyLive = room.seats.some(s => s.ws) || room.spectators.size > 0;
    if (!anyLive) scheduleGrave(room);
  });
});

// heartbeat sweep — kill zombie sockets so seats show disconnected promptly
const sweep = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);
wss.on("close", () => clearInterval(sweep));

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`RLSW room server listening on :${PORT} (schema ${SCHEMA})`);
});
