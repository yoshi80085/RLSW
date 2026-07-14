// --- ENGINE STATE ------------------------------------------------------------
// makeInitialState(gameConfig) -> the single plain-JSON GameState object.
//
// PHASE 1 STATUS: only `config`, `spirits`, `turnQueue`, `acting`, and `rng`
// are authoritative-shaped. Every slice marked `null` below is still owned by
// React state inside `Game` and moves here in its own phase (see
// src/MULTIPLAYER_HANDOFF.md).  Do not read null slices from the client.
//
// Rules for this file:
//   - Plain JSON only. No class instances, no functions, no JSX, no Infinity.
//   - No client-only state (hover/zoom, FX queues, riff timers, BGM, dice
//     spin faces, log strings -- those stay in React).

import { makeRng } from "./rng.js";
import { makeInitialNoteState } from "./systems/economy.js";
import { shuffledStageFxDeck } from "../data/stageEffects.js";
import { makeBoardToken, SPOTLIGHT_POOL, EVENT_HEX_POOL } from "../board/boardHelpers.js";
import { ALL_HEXES } from "../board/hexMap.js";
import { TOKEN_MAX, TOKEN_BASE_POOL, EVENT_HEX_COUNT, CHARGE_ZONE_COUNT, LIMELIGHT_HEX, LIGHTNING_TRACK_HEXES } from "../data/gameConstants.js";

/**
 * @param {object} gameConfig  Lobby's onStart payload:
 *   { spirits, mode, teams, startingLives, beginnerMode, testMode? }
 * @param {number} [seed]      uint32 rng seed; defaults to a time-derived one.
 */
export function makeInitialState(gameConfig, seed = Date.now() >>> 0) {
  const startingLives = gameConfig.startingLives ?? 3;

  const spirits = gameConfig.spirits.map(s => ({ ...s, lives: startingLives }));

  // Phase 5c foundation: engine builds + OWNS the per-spirit note sheets
  const noteRng = makeRng(seed >>> 0).fork("noteStatesInit");
  const noteStates = {};
  for (const s of spirits) noteStates[s.id] = makeInitialNoteState(s.id, noteRng);

  // Phase 6b: stage-FX draw order (engine-owned, seeded)
  const stageFxDeck = shuffledStageFxDeck(makeRng(seed >>> 0).fork("stageFxDeck"));

  // Phase 6a: board state (engine-owned, seeded)
  const boardRng = makeRng(seed >>> 0).fork("boardInit");
  const startHexNums = new Set(spirits.map(s => s.num));

  // Spotlight: random interior hex
  const spotlightHex = SPOTLIGHT_POOL[Math.floor(boardRng() * SPOTLIGHT_POOL.length)];

  // Event hexes: avoid spirit start positions
  const eventPool = EVENT_HEX_POOL.filter(n => !startHexNums.has(n));
  const eventHexes = [];
  for (let i = 0; i < EVENT_HEX_COUNT && eventPool.length > 0; i++) {
    const idx = Math.floor(boardRng() * eventPool.length);
    eventHexes.push(eventPool.splice(idx, 1)[0]);
  }

  // Lost Chord tokens: avoid spirit starts + Limelight.
  // Fewer players -> more starting tokens so the board feels equally populated.
  const playerCount = spirits.length;
  const initTokenCount = Math.max(TOKEN_MAX, TOKEN_BASE_POOL - playerCount);
  const tokenPool = ALL_HEXES.filter(h => !startHexNums.has(h.num) && h.num !== LIMELIGHT_HEX).map(h => h.num);
  const boardTokens = [];
  for (let i = 0; i < initTokenCount && tokenPool.length > 0; i++) {
    const idx = Math.floor(boardRng() * tokenPool.length);
    boardTokens.push(makeBoardToken(tokenPool.splice(idx, 1)[0], boardRng));
  }

  // Charge zones: ONLY hexes the lightning bolt touches (LIGHTNING_TRACK_HEXES)
  const tokenHexSet = new Set(boardTokens.map(t => t.num));
  const chargePool = LIGHTNING_TRACK_HEXES
    .filter(n => !startHexNums.has(n) && n !== LIMELIGHT_HEX && !tokenHexSet.has(n));
  const chargeZones = [];
  for (let i = 0; i < CHARGE_ZONE_COUNT && chargePool.length > 0; i++) {
    const idx = Math.floor(boardRng() * chargePool.length);
    chargeZones.push({ num: chargePool.splice(idx, 1)[0], cooldown: 0 });
  }

  return {
    schema: 1,
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

    // Phase 2: turn & movement (authoritative)
    turn: {
      count: 0,
      moveStepsLeft: 0,
      actionTokenUsed: false,
      startedOnLimelight: {},
      lastMove: null,
      lastReport: null,
    },

    // Phase 5c: per-spirit note/skill/fan sheets (engine-owned, seeded)
    noteStates,

    // Phase 6a: board state (engine-owned, seeded)
    board: {
      spotlightHex,
      eventHexes,
      eventRespawnIn: 0,
      boardTokens,
      chargeZones,
      flamingHexes: { hexes: [], roundsLeft: 0 },
      // reports
      lastSpotlightHeal: null,
      lastSpotlightMove: null,
      lastTokensScattered: null,
      lastThrashTokens: null,
      lastFlamingDecay: null,
      lastEventRespawn: null,
    },

    // Phase R5: headliner title (riff-off winner)
    headliner: null,

    fame: null,
    amps: null,
    boardCards: null,
    unsurePool: null,
    battle: null,
    // Phase 6c: Rock God (engine-owned)
    rockGod: {
      summoned: false,
      god: null,
      outcome: null,
      lastPick: null,
      lastHit: null,
      lastAct: null,
      lastTimerExpiry: null,
    },
    // Phase 6b: stage FX (fully engine-owned)
    stageFx: {
      deck: stageFxDeck,
      fired: [],
      smoke: null,
      laser: null,
      pyro: null,
      animatronics: [],
      lastDraw: null,
      lastActivation: null,
      lastTurnTick: null,
      lastRoundTick: null,
    },
    winner: null,
  };
}
