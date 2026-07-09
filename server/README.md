# RLSW room server (netcode N1)

The websocket room server for online play — see `src/NETCODE_HANDOFF.md` for
the full plan and protocol. v1 is a dumb, ordered pipe with a memory: it holds
rooms, assigns seats, stamps the game seed, sequences every action, and hands
the `{ seed, config, log }` catch-up bundle to spectators and rejoiners.

```
cd server
npm install     # just `ws`
npm test        # smoke test: create/join/start/relay/spectate/rejoin
npm start       # listens on :8787 (PORT env to override)
```

The server knows nothing about the game's rules on purpose (action-relay
lockstep). When the remaining client rules graduate into the engine, it can
import `src/engine/` (pure ESM, node-safe) and validate — same protocol,
smarter pipe.
