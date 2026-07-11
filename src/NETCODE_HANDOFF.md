# NETCODE HANDOFF — online play for RLSW

> **Mission:** play RLSW online with friends — room codes, 2–4 players FFA,
> spectators, bot seat-fill, and reconnect. Built on the finished multiplayer
> foundation (see MULTIPLAYER_HANDOFF.md — all 8 phases ☑): a deterministic,
> serializable engine where `{ seed, config, log }` reproduces any game
> byte-for-byte.

## Architecture (decided 2026-07-09, owner-confirmed)

- **Topology: Node WebSocket server.** A small standalone Node program
  (`server/`) holds rooms and an open socket per browser. Localhost/LAN first,
  cheap cloud host later. Same language as the game; the engine itself is pure
  ESM with no React deps (selftest runs under plain `node`), so the server can
  import it for validation when we graduate to authority.
- **Authority: action-relay lockstep (v1).** The ACTING player's client runs
  the orchestration exactly as today and dispatches engine actions; the server
  sequences them (monotonic `seq`) and broadcasts; every other client applies
  the same actions in order. The server is a dumb, ordered pipe that remembers
  the log. Trusts the actor — fine for friends. **v2 (later): server authority**
  — the server runs `applyAction` itself and validates; requires graduating the
  remaining client-side rules (VIBE_CHANGED, SPIRIT_MOVED, event orchestration)
  into reducers first. The protocol below is designed so v2 changes the server,
  not the message shapes.
- **v1 scope:** room codes · 2–4 player FFA · spectators · human+bot mix ·
  reconnect (spectator catch-up and rejoin are the same machinery).

## The contract the foundation already gives us

- `dispatch` (Game, ~L633) is the SINGLE choke point: every engine write goes
  through it and is appended to `actionLogRef` as `{ action, cursorBefore }`.
  The relay hook lives here and nowhere else.
- `makeInitialState(config, seed)` + the log = byte-identical replay (Phase 8c
  selftest). The 💾 EXPORT ACTION LOG bundle `{ schema, seed, config,
  actionCount, log }` IS the catch-up payload.
- `cursorBefore` is a free per-action DESYNC TRIPWIRE: before applying a remote
  action, compare local `rng.cursor` to the sender's `cursorBefore`; mismatch =
  divergence → freeze input, request CATCH_UP, log loudly.
- All client `Math.random` outcomes already ride in payloads
  (RIFF_RESULTS_SUBMITTED pattern) — remote replay never re-rolls. **Invariant
  for all new code: outcomes in payloads, never re-computed on remote clients.**

## Protocol (JSON frames over ws)

Client → server:
`CREATE_ROOM { name }` · `JOIN_ROOM { code, name, spectator? , rejoinToken? }`
· `START_GAME { config }` (host only; server injects `seed`) · `ACTION
{ action, cursorBefore }` (acting seat only) · `LOG_LINE { text }`
(presentation side-channel) · `PING`.

Server → client:
`ROOM_STATE { code, you, seats[], spectators, phase }` · `GAME_STARTED { seed,
config, seats }` · `ACTION { seq, seatId, action, cursorBefore }` · `LOG_LINE
{ seq, seatId, text }` · `CATCH_UP { seed, config, seats, log, logLines }` ·
`ERROR { code, msg }` · `PONG`.

Server state per room: `{ code, phase: lobby|playing, seats[{ seatId, name,
spiritId?, connected, rejoinToken, isBot }], spectators, seed, config, log[],
logLines[], seq }`. Rooms die 10 min after the last socket drops.

## Phases

| # | Phase | Exit criterion | Status |
|---|-------|----------------|--------|
| N0 | Seed threading | `gameState.seed` reaches `makeInitialState`; offline unchanged | ☑ |
| N1 | Room server skeleton | node smoke script: create/join/relay/catch-up green | ☑ |
| N2 | Net client + lobby UI | two tabs see each other in a room | ☑ |
| N3 | Start handshake | both tabs boot the SAME game (seed+config from server) | ☑ |
| N4 | Action relay | full 2-human match across two tabs | ☑ |
| N5 | Presentation relay | remote log lines + acceptable remote visuals | ☑ |
| N6 | Spectate + reconnect | spectator joins mid-game; player F5s and resumes | ☑ |
| N7 | Bot seats | 1 human + bots online; bot actions relay like human ones | ☑ |
| N8 | Hardening | version check, heartbeats, dev-panel gating, desync UX | ☐ |
| N9 | Deploy | play over the internet | ☐ |

- **N0 — seed threading (one line + lobby plumbing).**
  `makeInitialState(gameState)` currently defaults `seed = Date.now()>>>0`
  (state.js L26). Change the Game init to `makeInitialState(gameState,
  gameState.seed)` — undefined keeps today's default, so offline is
  byte-unchanged. Online, `GAME_STARTED.seed` rides into `gameState`.
- **N1 — room server skeleton.** `server/` (own package.json, dep: `ws`).
  Rooms, 4-letter codes, seats, sequencing, broadcast, CATCH_UP, rejoin
  tokens, LOG_LINE relay, heartbeat sweep. NO game knowledge (v1). Smoke
  script `server/smoke.mjs` drives 3 fake clients end-to-end. **Scaffolded —
  see server/README.md; `npm i && npm test` inside server/.**
- **N2 — net client + lobby UI.** `src/net/client.js`: tiny ws wrapper
  (connect, send, on, auto-reconnect with backoff, rejoinToken in
  localStorage). Lobby gains "Play online": create room (shows code) / join
  code / seat list / ready. Keep the offline path 100% untouched — online is
  additive UI state.
- **N3 — start handshake.** Host configures the lineup in the existing Lobby
  (config shape already = `makeInitialState`'s first arg, proven by the export
  bundle); server stamps `seed` and broadcasts GAME_STARTED; every client
  calls `onStart({ ...config, seed, net })`. Remote clients boot the identical
  engine state. Exit check: both tabs' `engineState.rng.seed` and initial
  snapshot hashes match (log them).
- **N4 — action relay (the heart).** In `dispatch`: if online and this client
  controls `engineState.acting`, apply locally (unchanged synchronous return —
  timeout chains keep working) AND send ACTION. Remote ACTION frames go
  through `applyRemote(action, cursorBefore)`: verify cursor, `applyAction`,
  `setEngineState`, append local log. NEVER run orchestration for remote
  actions — no addLog, no FX, no timeouts (presentation comes from N5).
  Input gating: disable action UI when `acting` isn't yours (read seat→spirit
  map from GAME_STARTED). Server enforces sender==acting-seat loosely by
  tracking TURN_STARTED/TURN_ENDED in the stream (lite validation, v1).
- **N5 — presentation relay.** Remote board/HUD largely renders itself —
  spirits, noteStates, board hexes, battle + riff slices are all engine state
  now (that was the point of the flip). Relay `addLog` lines via LOG_LINE so
  everyone reads the same story. Accept degraded remote cinematics v1 (results
  without every dice-spin frame); note gaps during smoke tests and promote the
  worst offenders to engine `turn.last*` reports later, not ad-hoc FX messages.
- **N6 — spectate + reconnect (same machinery).** Any JOIN mid-game (spectator
  or returning seat, matched by rejoinToken) gets CATCH_UP `{ seed, config,
  log }` → client builds initial state and replays the log at max speed with
  presentation suppressed (engine replay is cheap — selftest replays hundreds
  of actions instantly), then resumes live. F5 = disconnect + rejoin, free.
- **N7 — bot seats.** Host's lobby marks empty seats as bots. The bot step
  machine already runs client-side and dispatches through the same choke
  point — gate it to run ONLY on the host's client, only for bot seats; its
  actions relay like any other. (Bot decisions read engine state and bot rolls
  use engine rng, so replay stays exact — the step machine's setTimeout pacing
  is presentation, sequenced by the server like everything else.)
- **N8 — hardening.** Handshake carries `{ schema, appVersion (git hash or
  package version) }` — mismatch = refuse room, not mid-game desync. Heartbeat
  + "X disconnected (reconnecting…)" banners. Desync UX: on cursor mismatch,
  freeze input + auto-CATCH-UP + toast. Disable Testing Grounds / dev grants
  online (or host-only). The SPIRITS_SYNCED / NOTE_STATES_SYNCED fallbacks
  must NEVER fire online — console.error tripwire + auto-report.
- **N9 — deploy.** LAN: `vite --host` + server on :8787 (one command each).
  Internet: server on a small host (Fly.io / Railway / any $5 VPS) behind
  `wss://`; client stays on gh-pages with the server URL in an env/config.
  CORS is a non-issue for pure websockets; just get TLS right (wss).

## Landmines (read before each phase)

1. **Remote clients replay, never re-run.** The acting client's timeout chains
   (knockback slides, battle beats) emit actions over wall-clock time; the
   server's seq order IS the truth; remote clients apply in order as frames
   arrive. Any new randomness must ride in the payload.
2. **Game remount key.** `<Game key={JSON.stringify(gameState.spirits…)}>`
   (App ~L609) remounts Game when the lineup changes — make sure GAME_STARTED
   produces exactly one mount, and CATCH_UP does not remount mid-replay.
3. **`spirits`/`noteStates` shims.** Legacy writes still flow through the
   diffing shims → SPIRIT_PATCHED / NOTE_SHEET_PATCHED. That's replay-safe by
   construction, but shim writes on a REMOTE client's machine would fork
   reality — they can only ever run inside orchestration, which only the
   acting client runs (invariant #1 again; the N8 tripwire catches violations).
4. **Fast-forward (⏩) is per-client presentation** — safe to leave as is;
   never let it scale anything that emits actions on a non-acting client.
5. **Rooms are RAM.** Server restart kills games (v1 accepted). The CATCH_UP
   bundle is JSON — trivially persistable later if it ever matters.
6. **Winner + Rock God edges.** Two non-combat `setWinner` sites don't shadow
   WINNER_DECLARED yet (MULTIPLAYER_HANDOFF §5c tail) — harmless for relay
   (clients converge via the log) but fold them in during N5 so remote HUDs
   read `engineState.winner` too.
