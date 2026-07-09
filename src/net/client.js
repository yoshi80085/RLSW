// ─── NET CLIENT — netcode N2 (see src/NETCODE_HANDOFF.md) ────────────────────
// Tiny WebSocket wrapper for the room server: connect / send / on(type),
// auto-reconnect with exponential backoff, and a persisted rejoin token so a
// refresh or wifi blip reclaims the same seat (N6 rides on this machinery).
//
// Environment-agnostic on purpose: the browser passes nothing; node tests pass
// { WebSocketImpl, storage } (see server/n2-client-smoke.mjs). No React, no
// engine imports — a dumb socket with a memory, mirroring the server.

const SESSION_KEY = "rlsw.net.session"; // { code, rejoinToken, name }
const BACKOFF_MIN = 500, BACKOFF_MAX = 8000;

export function defaultServerUrl() {
  if (typeof location === "undefined") return "ws://127.0.0.1:8787";
  const qs = new URLSearchParams(location.search).get("server");
  if (qs) return qs; // ?server=wss://host — N9 deploy override
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.hostname}:8787`;
}

export function makeNetClient({ url, WebSocketImpl, storage } = {}) {
  const WS = WebSocketImpl ?? globalThis.WebSocket;
  const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);

  let ws = null;
  let closedByUs = false;
  let backoff = BACKOFF_MIN;
  let reconnectTimer = null;
  // frame type (or "*" / "net:open" / "net:close" / "net:reconnecting") → Set<fn>
  const handlers = new Map();

  const emit = (type, frame) => {
    for (const fn of [...(handlers.get(type) ?? [])]) fn(frame);
    if (type !== "*") for (const fn of [...(handlers.get("*") ?? [])]) fn(frame);
  };

  const client = {
    url: url ?? defaultServerUrl(),
    connected: false,
    // set by WELCOME:
    code: null, seatId: null, rejoinToken: null, spectator: false, schema: null,
    name: null,

    /** subscribe to a frame type; returns an unsubscribe fn */
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type)?.delete(fn);
    },

    /** promise for the next `type` frame (optionally matching `where`);
     *  rejects on server ERROR frames (unless opted out) and on timeout */
    waitFor(type, { ms = 5000, where = null, rejectOnError = true } = {}) {
      return new Promise((resolve, reject) => {
        const offs = [];
        const settle = (fn) => (arg) => { clearTimeout(timer); offs.forEach(o => o()); fn(arg); };
        const ok = settle(resolve), bad = settle(reject);
        const timer = setTimeout(() => bad(new Error(`timeout waiting for ${type}`)), ms);
        offs.push(client.on(type, f => { if (!where || where(f)) ok(f); }));
        if (rejectOnError && type !== "ERROR") {
          offs.push(client.on("ERROR", f =>
            bad(Object.assign(new Error(f.msg ?? f.code), { code: f.code }))));
        }
      });
    },

    /** open the socket. Resolves on open; rejects if the FIRST attempt can't
     *  reach the server (no auto-retry pre-open — the lobby button owns that).
     *  Drops AFTER open auto-reconnect with backoff + seat reclaim. */
    connect() {
      closedByUs = false;
      return new Promise((resolve, reject) => {
        let settled = false;
        ws = new WS(client.url);
        ws.onopen = () => {
          client.connected = true; backoff = BACKOFF_MIN;
          emit("net:open", {});
          if (!settled) { settled = true; resolve(client); }
        };
        ws.onmessage = (ev) => {
          let f; try { f = JSON.parse(ev.data); } catch { return; }
          if (f.t === "WELCOME") {
            client.code = f.code; client.seatId = f.seatId;
            client.spectator = !!f.spectator; client.schema = f.schema;
            if (f.rejoinToken) client.rejoinToken = f.rejoinToken;
            saveSession();
          }
          emit(f.t, f);
        };
        ws.onerror = () => { /* onclose always follows; it owns retry/rejection */ };
        ws.onclose = () => {
          client.connected = false;
          emit("net:close", {});
          if (!settled) { settled = true; return reject(new Error(`can't reach ${client.url}`)); }
          if (!closedByUs) scheduleReconnect();
        };
      });
    },

    send(frame) {
      if (ws && ws.readyState === 1 /* OPEN */) ws.send(JSON.stringify(frame));
    },

    createRoom(name) { client.name = name; client.send({ t: "CREATE_ROOM", name }); },
    joinRoom(code, { name, spectator, rejoinToken } = {}) {
      client.name = name ?? client.name;
      client.send({ t: "JOIN_ROOM", code, name: client.name, spectator, rejoinToken });
    },
    startGame(config, { seatMap, botSeats } = {}) { client.send({ t: "START_GAME", config, seatMap, botSeats }); }, // N3
    sendAction(action, cursorBefore) { client.send({ t: "ACTION", action, cursorBefore }); },                       // N4
    sendLogLine(text) { client.send({ t: "LOG_LINE", text }); },                                                    // N5

    /** leave the room for good — forget the seat, close the socket */
    leave() {
      clearSession();
      closedByUs = true; clearTimeout(reconnectTimer);
      client.send({ t: "LEAVE" });
      try { ws?.close(); } catch { /* already dead */ }
      client.code = client.seatId = client.rejoinToken = null;
    },

    /** close WITHOUT forgetting the session (unmount / F5 — rejoin later) */
    close() {
      closedByUs = true; clearTimeout(reconnectTimer);
      try { ws?.close(); } catch { /* already dead */ }
    },

    savedSession,
    _ws: () => ws, // test hook: lets the smoke test sever the socket mid-flight
  };

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    emit("net:reconnecting", { inMs: backoff });
    reconnectTimer = setTimeout(() => {
      backoff = Math.min(backoff * 2, BACKOFF_MAX);
      client.connect().then(() => {
        // reclaim our seat; mid-game the server answers WELCOME + CATCH_UP (N6)
        if (client.code && client.rejoinToken) {
          client.joinRoom(client.code, { rejoinToken: client.rejoinToken });
        }
      }).catch(() => scheduleReconnect()); // still down — keep backing off
    }, backoff);
  }

  function saveSession() {
    if (!store || client.spectator || !client.rejoinToken) return;
    try {
      store.setItem(SESSION_KEY, JSON.stringify({
        code: client.code, rejoinToken: client.rejoinToken, name: client.name,
      }));
    } catch { /* storage full/blocked — session just won't survive F5 */ }
  }
  function savedSession() {
    if (!store) return null;
    try { return JSON.parse(store.getItem(SESSION_KEY) ?? "null"); } catch { return null; }
  }
  function clearSession() {
    try { store?.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }

  return client;
}
