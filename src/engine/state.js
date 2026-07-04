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

    // ── Slices below land in later phases (null = still React-owned) ──
    fame: null,        // Phase 5 — fame points / score track
    noteStates: null,  // Phase 5 — per-spirit note tracks, chords, skills
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
