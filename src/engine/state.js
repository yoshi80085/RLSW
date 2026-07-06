// ─── ENGINE STATE ────────────────────────────────────────────────────────────
// makeInitialState(gameConfig) → the single plain-JSON GameState object.
//
// PHASE 1 STATUS: only `config`, `spirits`, `turnQueue`, `acting`, and `rng`
// are authoritative-shaped. Every slice marked `null` below is still owned by
// React state inside `Game` and moves here in its own phase (see
// src/MULTIPLAYER_HANDOFF.md §4–5). Do not read null slices from the client.
//
// Rules for this file:
//   - Plain JSON only. No class instances, no functions, no JSX, no Infinity.
//   - No client-only state (hover/zoom, FX queues, riff timers, BGM, dice
//     spin faces, log strings — those stay in React).

import { makeRng } from "./rng.js";
import { makeInitialNoteState } from "./systems/economy.js";

/**
 * @param {object} gameConfig  Lobby's onStart payload:
 *   { spirits, mode, teams, startingLives, beginnerMode, testMode? }
 * @param {number} [seed]      uint32 rng seed; defaults to a time-derived one.
 */
export function makeInitialState(gameConfig, seed = Date.now() >>> 0) {
  const startingLives = gameConfig.startingLives ?? 3;

  // Mirrors Game's own init exactly:
  //   spirits: lobby spirits + lives   (Game ~line 611)
  //   turnQueue: lobby order of ids    (Game "const [turnQueue] = useState(...)")
  const spirits = gameConfig.spirits.map(s => ({ ...s, lives: startingLives }));

  // ── Phase 5c foundation: engine builds + OWNS the per-spirit note sheets ──
  // Built on a FORKED rng ("noteStatesInit") so the opening roots/stock are
  // seeded-deterministic (replay-safe) WITHOUT consuming the main rng stream —
  // forking never advances the parent, so `rng.cursor` below stays 0 and every
  // existing roll is byte-unchanged. Dormant until the client flip reads it.
  const noteRng = makeRng(seed >>> 0).fork("noteStatesInit");
  const noteStates = {};
  for (const s of spirits) noteStates[s.id] = makeInitialNoteState(s.id, noteRng);

  return {
    schema: 1, // bump when the GameState shape changes incompatibly
    config: {
      mode: gameConfig.mode,
      teams: gameConfig.teams ?? null,
      startingLives,
      beginnerMode: !!gameConfig.beginnerMode,
      testMode: !!gameConfig.testMode,
    },
    rng: { seed: seed >>> 0, cursor: 0 },

    spirits,
    turnQueue: spirits.map(s => s.id),
    acting: spirits[0]?.id ?? null,

    // ── Phase 2: turn & movement (authoritative) ──
    turn: {
      count: 0,               // total turns ended (round check: count % alive)
      moveStepsLeft: 0,       // beats/AP — granted by melody commit, spent by moves & combat
      actionTokenUsed: false, // one Action per turn
      startedOnLimelight: {}, // spiritId → began its turn on the Limelight hex
      lastMove: null,         // report of the latest MOVE_STEP (null if refused)
      lastReport: null,       // report of the latest TURN_ENDED / TURN_SKIPPED
    },

    // ── Phase 5c: per-spirit note/skill/fan sheets (engine-owned, seeded) ──
    // Dormant until the client flip: the client still builds + reads its own
    // React `noteStates`; this is the authoritative seeded copy the flip adopts.
    noteStates,

    // ── Slices below land in later phases (null = still React-owned) ──
    fame: null,        // Phase 5 — fame points / score track
    amps: null,        // Phase 2/5 — board deployables
    boardTokens: null, // Phase 5
    boardCards: null,  // Phase 5
    chargeZones: null, // Phase 5
    eventSpaces: null, // Phase 6
    unsurePool: null,  // Phase 5 — fan economy
    battle: null,      // Phase 3/4 — combat + riff-off (results only, no timers)
    rockGod: null,     // Phase 6
    stageFx: null,     // Phase 6
    winner: null,      // Phase 3 — set by KO/win check
  };
}
