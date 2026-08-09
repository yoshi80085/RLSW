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
const ROOM_TTL_MS = Number(process.env.ROOM_TTL_MS ?? 10 * 60 * 1000); // empty-room grave timer
// Lobby ghosts: a seat whose socket dropped IN THE LOBBY is kept briefly (so a
// refresh can reclaim it by token), then removed — no lingering phantom
// players. Mid-game seats survive indefinitely (reclaimable all match).
// Env override exists for the smoke tests.
const LOBBY_LINGER_MS = Number(process.env.LOBBY_LINGER_MS ?? 45_000);
const SCHEMA = 1;                   // must match engine state schema

// ─── N12: ABUSE LIMITS ──────────────────────────────────────────────────────
// The server is a public socket on a small box with all state in RAM, so every
// unbounded thing is a free OOM for anyone who finds the URL. Each limit below
// is generous for real play and ruinous for a script. All env-overridable so
// the smokes can tighten them without waiting around.
const LIMITS = {
  // per-message ceiling — `ws` defaults to 100MB, which is absurd for our frames
  maxPayloadBytes: Number(process.env.MAX_PAYLOAD_BYTES ?? 64 * 1024),
  // token bucket per socket: sustained rate + burst allowance
  msgPerSec: Number(process.env.MSG_PER_SEC ?? 30),
  msgBurst: Number(process.env.MSG_BURST ?? 60),
  // room minting
  maxRooms: Number(process.env.MAX_ROOMS ?? 500),
  maxRoomsPerIp: Number(process.env.MAX_ROOMS_PER_IP ?? 5),
  // simultaneous sockets from one address (a household NAT needs headroom)
  maxConnPerIp: Number(process.env.MAX_CONN_PER_IP ?? 20),
  // match log — a real game is a few hundred actions; 20k is a runaway
  maxLog: Number(process.env.MAX_LOG ?? 20_000),
  maxLogLines: Number(process.env.MAX_LOG_LINES ?? 5_000),
  maxSpectators: Number(process.env.MAX_SPECTATORS ?? 20),
  maxNameLen: Number(process.env.MAX_NAME_LEN ?? 24),
  // failed JOIN_ROOM attempts before we hang up — room codes are only 4 chars
  // over a 24-letter alphabet (~331k combos), which is walkable in minutes
  maxBadJoins: Number(process.env.MAX_BAD_JOINS ?? 20),
  badJoinWindowMs: Number(process.env.BAD_JOIN_WINDOW_MS ?? 60_000),
};

// Origin allowlist. Browsers always send Origin; non-browser clients (our node
// smokes, curl) send none — those are allowed through, since Origin is a
// browser-integrity signal, not authentication. Set ALLOWED_ORIGINS="*" to
// disable (handy for LAN play off a phone).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ??
  "https://yoshi80085.github.io,http://localhost:5173,http://127.0.0.1:5173")
  .split(",").map(s => s.trim()).filter(Boolean);

function originAllowed(origin) {
  if (ALLOWED_ORIGINS.includes("*")) return true;
  if (!origin) return true;              // non-browser client
  return ALLOWED_ORIGINS.includes(origin);
}

// Client address. Behind Render/Fly the socket peer is the proxy, so we read
// X-Forwarded-For — but ONLY the rightmost entry, which is the one our nearest
// trusted proxy appended. The left entries are client-supplied and forgeable;
// trusting those would let one attacker wear a different IP per request and
// walk straight through every per-IP limit here.
//
// OFF by default, deliberately. With no proxy in front of us, ANY X-Forwarded-For
// is attacker-written, so trusting it would silently void every per-IP limit
// below — the worst kind of bug, one that looks fine. Set TRUST_PROXY=1 only
// where a proxy really does terminate the connection (see render.yaml). Getting
// that wrong the other way is loud and harmless: everyone shares one bucket and
// you notice immediately.
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
function clientIp(req) {
  if (TRUST_PROXY) {
    const xff = req.headers["x-forwarded-for"];
    if (xff) {
      const hops = String(xff).split(",").map(s => s.trim()).filter(Boolean);
      if (hops.length) return hops[hops.length - 1];
    }
  }
  return req.socket?.remoteAddress ?? "unknown";
}

/** ip → live socket count */
const connsByIp = new Map();
/** ip → rooms currently owned */
const roomsByIp = new Map();
/** ip → { count, resetAt } for failed joins */
const badJoinsByIp = new Map();

const bump = (map, key, delta) => {
  const next = (map.get(key) ?? 0) + delta;
  if (next <= 0) map.delete(key); else map.set(key, next);
  return next;
};

// Trim a player-supplied display name: strip control characters (they wreck
// the lobby layout and log lines) and cap the length before it gets broadcast
// to every other client in the room.
function cleanName(raw) {
  const s = String(raw ?? "Player")
    /* eslint-disable-next-line no-control-regex */
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, LIMITS.maxNameLen);
  return s || "Player";
}

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

function makeRoom(code, ownerIp = null) {
  return {
    code,
    ownerIp,                 // N12: charged against this IP's room quota
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
    floorSeatId: null,       // Ear Spy: who is currently playing (see "FLOOR")
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
    floorSeatId: room.floorSeatId,
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

// Drop a seat for good (leave / boot / lobby-linger expiry). Migrates hostship
// to the first remaining human if the host left.
function removeSeat(room, s) {
  clearTimeout(s.lingerTimer);
  room.seats = room.seats.filter(x => x !== s);
  if (room.hostSeatId === s.seatId) {
    room.hostSeatId = room.seats.find(x => !x.isBot)?.seatId ?? null;
  }
  // ⚠️ THE FLOOR HAS TO BE RELEASED WITH THE SEAT. A player who closes the tab
  // while holding it would otherwise leave the room permanently unable to
  // play: every remaining CLAIM is refused with FLOOR_TAKEN by a seat that no
  // longer exists, and nothing else in the protocol ever clears it.
  if (room.floorSeatId === s.seatId) room.floorSeatId = null;
}

// next free seatId — seats can be removed in the lobby, so length+1 can collide
const nextSeatId = (room) => room.seats.reduce((m, s) => Math.max(m, s.seatId), 0) + 1;

function startLobbyLinger(room, s) {
  clearTimeout(s.lingerTimer);
  s.lingerTimer = setTimeout(() => {
    if (!s.ws && room.seats.includes(s)) {
      removeSeat(room, s);
      broadcast(room, roomState(room));
    }
  }, LOBBY_LINGER_MS);
}

// N12: single exit for a room's life, so the creator's per-IP quota is always
// released. Anything that forgets this leaks quota until the process restarts.
function deleteRoom(room) {
  clearTimeout(room.graveTimer);
  if (rooms.delete(room.code) && room.ownerIp) bump(roomsByIp, room.ownerIp, -1);
}

function scheduleGrave(room) {
  clearTimeout(room.graveTimer);
  room.graveTimer = setTimeout(() => {
    const anyLive = room.seats.some(s => s.ws) || room.spectators.size > 0;
    if (!anyLive) deleteRoom(room);
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

const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITS.maxPayloadBytes });

// Same reasoning as the per-socket handler below: an unhandled 'error' here is
// a process-wide crash triggerable by one malformed handshake.
wss.on("error", (e) => console.error("wss error:", e.message));
httpServer.on("clientError", (_e, socket) => {
  try { socket.destroy(); } catch { /* already gone */ }
});

// N12: refuse at the handshake, before a socket object exists — an upgrade we
// never complete costs us nothing, which is the whole point.
httpServer.on("upgrade", (req, socket, head) => {
  const origin = req.headers.origin;
  if (!originAllowed(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    return socket.destroy();
  }
  const ip = clientIp(req);
  if ((connsByIp.get(ip) ?? 0) >= LIMITS.maxConnPerIp) {
    socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws, req) => {
  // per-connection context
  let room = null;
  let seat = null;      // null for spectators
  const ip = clientIp(req);
  bump(connsByIp, ip, +1);
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  // N12: a socket-level error ('error' on an EventEmitter with no listener is
  // an uncaught throw) takes the whole process down and every live game with
  // it. `ws` raises one for any protocol violation — an oversized frame, a bad
  // opcode, a broken mask — so this listener is load-bearing, not politeness.
  // 'close' still fires after, which is what releases the seat and the IP slot.
  ws.on("error", () => { try { ws.terminate(); } catch { /* already gone */ } });

  // N12: token bucket. Refills continuously at msgPerSec up to msgBurst, so
  // normal play (a handful of frames per turn) never notices it, while a flood
  // drains the bucket in well under a second and gets hung up on.
  let tokens = LIMITS.msgBurst;
  let lastRefill = Date.now();
  function allowMessage() {
    const now = Date.now();
    tokens = Math.min(LIMITS.msgBurst, tokens + ((now - lastRefill) / 1000) * LIMITS.msgPerSec);
    lastRefill = now;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  }

  const err = (code, msg) => send(ws, { t: "ERROR", code, msg });

  ws.on("message", (raw) => {
    if (!allowMessage()) {
      err("RATE_LIMITED", "too many frames — slow down");
      return ws.close(1008, "rate limited");
    }

    let f;
    try { f = JSON.parse(raw); } catch { return err("BAD_JSON", "unparseable frame"); }
    if (!f || typeof f !== "object") return err("BAD_FRAME", "frame must be an object");

    switch (f.t) {
      case "PING": return send(ws, { t: "PONG" });

      case "CREATE_ROOM": {
        if (room) return err("ALREADY_IN_ROOM", "leave first");
        const mismatch = versionMismatch(f);
        if (mismatch) return err("VERSION_MISMATCH", mismatch);
        // N12: room minting is the cheapest attack on a RAM-only server —
        // gate it globally and per-IP before anything gets allocated.
        if (rooms.size >= LIMITS.maxRooms) {
          return err("SERVER_BUSY", "too many rooms open — try again shortly");
        }
        if ((roomsByIp.get(ip) ?? 0) >= LIMITS.maxRoomsPerIp) {
          return err("TOO_MANY_ROOMS", `you already have ${LIMITS.maxRoomsPerIp} rooms open`);
        }
        room = makeRoom(newRoomCode(), ip);
        room.appVersion = f.appVersion ?? null; // N8: pin the creator's build
        rooms.set(room.code, room);
        bump(roomsByIp, ip, +1);
        seat = { seatId: 1, name: cleanName(f.name), ws, rejoinToken: newToken(), isBot: false, spiritId: null };
        room.seats.push(seat);
        room.hostSeatId = seat.seatId;
        send(ws, { t: "WELCOME", code: room.code, seatId: seat.seatId, rejoinToken: seat.rejoinToken, schema: SCHEMA });
        return send(ws, roomState(room));
      }

      case "JOIN_ROOM": {
        if (room) return err("ALREADY_IN_ROOM", "leave first");
        const r = rooms.get(String(f.code ?? "").slice(0, 8).toUpperCase());
        if (!r) {
          // N12: wrong codes are how you enumerate a 4-char keyspace. Count
          // them per IP over a sliding window and hang up on a scanner —
          // a human fat-fingering a code will never reach the ceiling.
          const now = Date.now();
          const rec = badJoinsByIp.get(ip);
          if (!rec || now > rec.resetAt) {
            badJoinsByIp.set(ip, { count: 1, resetAt: now + LIMITS.badJoinWindowMs });
          } else if (++rec.count > LIMITS.maxBadJoins) {
            err("TOO_MANY_ATTEMPTS", "too many bad room codes — try again later");
            return ws.close(1008, "join flood");
          }
          return err("NO_SUCH_ROOM", "bad code");
        }
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
            clearTimeout(back.lingerTimer); // back before the lobby ghost expired
            clearTimeout(room.graveTimer);
            send(ws, { t: "WELCOME", code: room.code, seatId: seat.seatId, rejoinToken: seat.rejoinToken, schema: SCHEMA, rejoined: true });
            if (room.phase === "playing") send(ws, catchUp(room));
            broadcast(room, roomState(room));
            return;
          }
        }

        if (f.spectator || r.phase === "playing") {
          // mid-game joins become spectators (a seat can only be reclaimed by token)
          if (r.spectators.size >= LIMITS.maxSpectators) {
            return err("SPECTATORS_FULL", "too many spectators watching this room");
          }
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
        seat = { seatId: nextSeatId(r), name: cleanName(f.name), ws, rejoinToken: newToken(), isBot: false, spiritId: null };
        r.seats.push(seat);
        if (r.hostSeatId == null) r.hostSeatId = seat.seatId; // room had emptied of humans
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
          // N12: bots are seats the host conjures out of a frame, so the 4-seat
          // rule has to be enforced here too — otherwise a crafted START_GAME
          // pushes unbounded seats into the room.
          for (const b of f.botSeats) {
            if (room.seats.length >= 4) break;
            room.seats.push({ seatId: nextSeatId(room), name: cleanName(b?.name ?? "Bot"), ws: null, rejoinToken: null, isBot: true, spiritId: b?.spiritId ?? null });
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
        // N12: the log is replayed to every joiner, so it's both a memory and a
        // bandwidth liability. Refuse past the ceiling rather than trimming —
        // dropping the front of a lockstep log would desync everyone.
        if (room.log.length >= LIMITS.maxLog) {
          return err("LOG_FULL", "match log limit reached — start a new game");
        }
        const entry = { seq: ++room.seq, seatId: seat.seatId, action: f.action, cursorBefore: f.cursorBefore ?? null };
        room.log.push(entry);
        // echo to everyone INCLUDING the sender — the sender uses the echo only
        // to confirm sequencing (it already applied locally); everyone else applies.
        return broadcast(room, { t: "ACTION", ...entry });
      }

      case "LOG_LINE": {
        if (!room || room.phase !== "playing" || !seat) return;
        const entry = { seq: room.seq, seatId: seat.seatId, text: String(f.text ?? "").slice(0, 500) };
        // Log lines are cosmetic (they only feed the on-screen feed), so unlike
        // the action log these can safely lose their oldest entries.
        if (room.logLines.length >= LIMITS.maxLogLines) room.logLines.shift();
        room.logLines.push(entry);
        return broadcast(room, { t: "LOG_LINE", ...entry }, { except: ws });
      }

      // N8: desync recovery — a client that detects a cursor mismatch or a seq
      // gap freezes its input and asks for the authoritative log; the server
      // answers with the same CATCH_UP bundle a late joiner gets.
      // ─── EAR SPY ONLINE (see src/net/riffWire.js) ──────────────────────────
      // Live listening analysis, relayed to the rest of the room.
      //
      // ⚠️ RIFF FRAMES NEVER ENTER room.log, AND THAT IS THE WHOLE POINT. The
      // action log is a lockstep record replayed in full to every joiner; it is
      // both a memory and a bandwidth liability (see ACTION above). Analysis is
      // the opposite kind of data — 8 frames a second of "what is sounding
      // right now", worthless one second later. Logging it would blow through
      // maxLog in about forty minutes and hand every late joiner a replay of
      // someone's warm-up. It is a passthrough: relayed, never remembered.
      //
      // The server still does not understand the payload — same contract as
      // ACTION. It checks the shape enough to bound the cost and forwards it.
      case "RIFF": {
        if (!room || !seat) return; // spectators listen, they don't broadcast
        // Only the player holding the floor may stream. Without this, every
        // client in the room could push 8 frames/sec at everyone else and the
        // relay cost becomes seats² — and the display would show two people
        // playing at once, which is the exact thing turn-taking exists to stop.
        if (room.floorSeatId !== seat.seatId) return;
        const frame = f.frame;
        if (!frame || typeof frame !== "object" || Array.isArray(frame)) return;
        return broadcast(room, { t: "RIFF", seatId: seat.seatId, frame }, { except: ws });
      }

      // Who currently has the floor. Held on the room so a late joiner or a
      // rejoin after a wifi blip learns whose turn it is without waiting for
      // the next hand-over — the same reason seats and phase live here.
      case "FLOOR": {
        if (!room || !seat) return err("SPECTATOR", "spectators can't take the floor");
        const mode = String(f.mode ?? "");
        if (mode === "claim") {
          // Taking the floor is only refused if someone else genuinely holds
          // it; re-claiming your own is a harmless no-op (a reconnect will).
          if (room.floorSeatId != null && room.floorSeatId !== seat.seatId) {
            return err("FLOOR_TAKEN", "someone else is playing");
          }
          room.floorSeatId = seat.seatId;
        } else if (mode === "release") {
          if (room.floorSeatId !== seat.seatId) return;
          room.floorSeatId = null;
        } else if (mode === "pass") {
          if (room.floorSeatId !== seat.seatId) return err("NOT_YOURS", "you don't have the floor");
          const target = room.seats.find(s => s.seatId === f.toSeatId && !s.isBot);
          if (!target) return err("NO_SUCH_SEAT", "nobody there to pass to");
          room.floorSeatId = target.seatId;
        } else {
          return err("BAD_MODE", "claim | release | pass");
        }
        return broadcast(room, { t: "FLOOR", floorSeatId: room.floorSeatId });
      }

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
        // seats that were already disconnected mid-game won't get a close event
        // now that we're back in the lobby — start their ghost timers here
        for (const s of room.seats) if (!s.ws) startLobbyLinger(room, s);
        broadcast(room, { t: "RETURNED_TO_LOBBY" });
        return broadcast(room, roomState(room));
      }

      // Host removes a player from the lobby (ghost seat or unwanted guest).
      // Lobby-only: booting a seat mid-game would break lockstep. The booted
      // player's token dies with the seat; a live socket is told, then closed.
      case "BOOT_PLAYER": {
        if (!room || !seat) return err("NOT_IN_ROOM", "join first");
        if (seat.seatId !== room.hostSeatId) return err("NOT_HOST", "host boots players");
        if (room.phase !== "lobby") return err("PLAYING", "can't boot mid-game");
        const target = room.seats.find(s => s.seatId === f.seatId && !s.isBot);
        if (!target) return err("NO_SUCH_SEAT", "no such player");
        if (target === seat) return err("SELF_BOOT", "you can't boot yourself — use LEAVE");
        const targetWs = target.ws;
        removeSeat(room, target);
        if (targetWs) {
          send(targetWs, { t: "BOOTED", msg: "the host removed you from the room" });
          try { targetWs.close(); } catch { /* already dead */ }
        }
        return broadcast(room, roomState(room));
      }

      case "LEAVE": {
        // an explicit lobby leave frees the seat immediately — no ghost.
        // Mid-game the seat survives (disconnected) so the token could still
        // reclaim it; a LEAVE-ing client wiped its token, so it just idles.
        if (room && seat && room.phase === "lobby") {
          removeSeat(room, seat);
          seat = null;
          broadcast(room, roomState(room));
        }
        ws.close();
        return;
      }

      default: return err("UNKNOWN_FRAME", `unknown t: ${f.t}`);
    }
  });

  ws.on("close", () => {
    bump(connsByIp, ip, -1); // N12: release the per-IP slot before anything else
    if (!room) return;
    if (seat && seat.ws === ws) {
      seat.ws = null; // seat survives — reclaimable by token (guard: a rejoin may have already replaced this socket)
      // The seat survives a wifi blip; the FLOOR does not. Holding it means
      // "I am playing right now", which a disconnected player by definition
      // isn't — and leaving it held would block everyone else for the whole
      // rejoin window. They simply claim it again when they come back.
      if (room.floorSeatId === seat.seatId) {
        room.floorSeatId = null;
        broadcast(room, { t: "FLOOR", floorSeatId: null });
      }
      // in the lobby, a dropped seat only survives the linger window (F5 grace)
      if (room.phase === "lobby") startLobbyLinger(room, seat);
    }
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
