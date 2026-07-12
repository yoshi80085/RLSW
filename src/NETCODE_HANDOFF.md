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
`CREATE_ROOM { name, schema, appVersion }` · `JOIN_ROOM { code, name,
spectator?, rejoinToken?, schema, appVersion }` (N8: schema must match the
server's, appVersion must match the room creator's — explicit mismatch =
`VERSION_MISMATCH`, refused at the door; version-less frames are tolerated)
· `START_GAME { config }` (host only; server injects `seed`) · `ACTION
{ action, cursorBefore }` (acting seat only) · `LOG_LINE { text }`
(presentation side-channel) · `REQUEST_CATCHUP {}` (N8: desync recovery —
answered with the same CATCH_UP bundle a late joiner gets) · `PING`.

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
| N8 | Hardening | version check, heartbeats, dev-panel gating, desync UX | ☑ |
| N9 | Deploy | play over the internet | ☑ |

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
- **N8 — hardening. ☑ Shipped 2026-07-12** (smoke: `server/n8-hardening-smoke.mjs`):
  - **Version handshake:** CREATE/JOIN carry `{ schema, appVersion }`
    (`CLIENT_SCHEMA` in net/client.js; `__APP_VERSION__` injected by vite from
    package.json, "dev" under node). Server refuses explicit mismatches with
    `VERSION_MISMATCH`; the room pins the creator's appVersion.
  - **Desync UX:** cursor mismatch OR a seq gap (every ACTION frame, echoes
    included, must arrive at lastSeq+1) → freeze input (`canAct` false, bot
    step machine halted), send REQUEST_CATCHUP, banner "⚠️ OUT OF SYNC".
    The Game-level CATCH_UP handler rebuilds the engine from seed+config+log
    (same machinery as the N6 mount replay) and unfreezes. This also heals
    wifi blips: the client auto-rejoins and the server's WELCOME+CATCH_UP now
    lands in-game, not just in the lobby.
  - **Presence banners:** in-game ROOM_STATE listener → "🔌 X disconnected
    (reconnecting…)" per dropped human seat; own-socket net:close/net:open →
    "📡 CONNECTION LOST". Server heartbeat sweep (15s ping/pong) was already
    killing zombies so seats flip `connected` promptly.
  - **Dev gating:** Testing Grounds launch button hidden while in a room;
    in-game `testMode` is hard-false when `gameState.net` exists (config rides
    the wire — a flag must not enable dev grants online).
  - **SYNC tripwires:** the SPIRITS_SYNCED / NOTE_STATES_SYNCED full-replace
    fallbacks console.error + post a 🚨 log line if they ever fire online.
  - **Ownership fix (same day):** the skill/upgrade tree is now controllable
    ONLY by the client that controls the acting spirit — UpgradeModal renders
    behind `canAct`, and the initial-pick effect, `setSkillTarget`, `placeAmp`
    + the Place-Amp chip are `canAct`-gated (remote clients previously drove
    other players' trees AND relayed duplicate NOTE_SHEET_PATCHED writes).
- **N9 — deploy. ☑ Shipped 2026-07-12.**
  **What was done:**
  - `__SERVER_URL__` wired into vite.config.js (`process.env.SERVER_URL`) and
    net/client.js (`BAKED_SERVER_URL`). Priority: `?server=` query > baked URL >
    LAN fallback. Build with
    `SERVER_URL=wss://rlsw-server.onrender.com npm run build` to bake a
    production default; `?server=` still overrides for testing.
  - Dockerfile + render.yaml + .dockerignore in `server/` — Render deployment:
    free tier, no credit card, auto-TLS on `*.onrender.com`.
  - Server upgraded to HTTP+WebSocket (N9): `http.createServer` handles health
    checks at `/health`; WebSocket upgrades on the same port. Required by
    Render (and most PaaS) which route all traffic through one HTTP port.
  **Deploy commands:**
  ```
  # 1. Server — push to GitHub, then in Render Dashboard:
  #    New → Web Service → connect repo → set Root Directory to "server"
  #    → pick Free plan → Deploy.
  #    Or use the render.yaml blueprint: New → Blueprint → connect repo.
  #
  # 2. Client (gh-pages, baking the server URL into the build):
  #    (Windows)
  set SERVER_URL=wss://rlsw-server.onrender.com&& npm run build && npm run deploy
  #    (macOS/Linux)
  SERVER_URL=wss://rlsw-server.onrender.com npm run build && npm run deploy
  ```
  **LAN (no deploy needed):** `npx vite --host` + `cd server && node index.js`.
  Gotchas addressed:
  1. **Mixed content (wss mandatory):** `*.onrender.com` gets TLS automatically.
     `defaultServerUrl()` already picks `wss:` when the page is served over
     https.
  2. **LAN-only default:** `BAKED_SERVER_URL` replaces the hostname fallback
     when set. Build without `SERVER_URL` and the old LAN behavior is unchanged.
  3. **Sleeping hosts:** Render free tier sleeps after 15 min of zero inbound
     traffic. Active WebSocket connections (heartbeat pings) count as traffic,
     so the server stays awake during games. First connection after idle has a
     ~30s cold start — rooms from before the sleep are gone (RAM), but the
     grave timer already kills them 10 min after the last disconnect anyway.
     No credit card, no surprise charges — if you exceed the 750 hr/mo free
     cap, service is suspended, not billed.

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
