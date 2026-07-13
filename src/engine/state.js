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
import { shuffledStageFxDeck } from "../data/stageEffects.js";
import { makeBoardToken, SPOTLIGHT_POOL, EVENT_HEX_POOL } from "../board/boardHelpers.js";
import { ALL_HEXES } from "../board/hexMap.js";
import { TOKEN_MAX, EVENT_HEX_COUNT, CHARGE_ZONE_COUNT, LIMELIGHT_HEX, LIGHTNING_TRACK_HEXES } from "../data/gameConstants.js";

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

  // ── Phase 6b: stage-FX draw order (engine-owned, seeded) ──
  // Shuffled ONCE on its own fork (cursor stays 0 — same trick as noteStatesInit)
  // — replaces the client's Math.random mount shuffle, so the show order is
  // replay-deterministic.
  const stageFxDeck = shuffledStageFxDeck(makeRng(seed >>> 0).fork("stageFxDeck"));

  // ── Phase 6a: board state (engine-owned, seeded) ──
  // Spotlight, event hexes, Lost Chord tokens, and charge zones are placed
  // on a forked rng so the board layout is replay-deterministic. Same trick
  // as noteStatesInit — cursor stays 0.
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

  // Lost Chord tokens: avoid spirit starts + Limelight
  const tokenPool = ALL_HEXES.filter(h => !startHexNums.has(h.num) && h.num !== LIMELIGHT_HEX).map(h => h.num);
  const boardTokens = [];
  for (let i = 0; i < TOKEN_MAX && tokenPool.length > 0; i++) {
    const idx = Math.floor(boardRng() * tokenPool.length);
    boardTokens.push(makeBoardToken(tokenPool.splice(idx, 1)[0], boardRng));
  }

  // Charge zones: ONLY hexes the lightning bolt touches (LIGHTNING_TRACK_HEXES),
  // still avoiding spirit starts + tokens + Limelight.
  const tokenHexSet = new Set(boardTokens.map(t => t.num));
  const chargePool = LIGHTNING_TRACK_HEXES
    .filter(n => !startHexNums.has(n) && n !== LIMELIGHT_HEX && !tokenHexSet.has(n));
  const chargeZones = [];
  for (let i = 0; i < CHARGE_ZONE_COUNT && chargePool.length > 0; i++) {
    const idx = Math.floor(boardRng() * chargePool.length);
    chargeZones.push({ num: chargePool.splice(idx, 1)[0], cooldown: 0 });
  }

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

    // ── Phase 6a: board state (engine-owned, seeded) ──
    board: {
      spotlightHex,                          // roaming searchlight position
      eventHexes,                            // marquee event space positions
      eventRespawnIn: 0,                     // turns until next marquee respawn
      boardTokens,                           // [{ num, kind, note }] Lost Chord tokens
      chargeZones,                           // [{ num, cooldown }] fixed charge hexes
      flamingHexes: { hexes: [], roundsLeft: 0 }, // Disco Inferno board hazard
      // reports — ticks/pickups write here for the client to read for logs/FX
      lastSpotlightHeal: null,               // { spiritId } or null
      lastSpotlightMove: null,               // { from, to } or null
      lastTokensScattered: null,             // { added: [nums] } or null
      lastFlamingDecay: null,                // { roundsLeft } or null
      lastEventRespawn: null,                // { hexNum } or null
    },

    // ── Slices below land in later phases (null = still React-owned) ──
    fame: null,        // Phase 5 — fame points / score track
    amps: null,        // Phase 2/5 — board deployables
    boardCards: null,  // Phase 5 (spawnBoardCards is currently a no-op)
    unsurePool: null,  // Phase 5 — fan economy
    battle: null,      // Phase 3/4 — combat + riff-off (results only, no timers)
    // ── Phase 6c: Rock God (engine-owned) ──
    rockGod: {
      summoned: false,      // one god per game, ever (was the client godSummonedRef)
      god: null,            // { id, num, hp, maxHp, winded, telegraph, lastAttack }
      outcome: null,        // null | 'spirits' | 'god' (was the client bossOutcome)
      lastPick: null,       // report: GOD_ATTACK_PICKED { godId, attackId }
      lastHit: null,        // report: GOD_DAMAGED { spiritId, dmg, defeated }
      lastAct: null,        // report: GOD_ACTED (see systems/rockGod.js)
      lastTimerExpiry: null,// report: GOD_TIMER_EXPIRED { spiritId }
    },
    // ── Phase 6b: stage FX (fully engine-owned) ──
    stageFx: {
      deck: stageFxDeck,  // seeded draw order
      fired: [],          // thresholds fired, in firing order (was the client firedRef Set)
      smoke: null,        // 💨 { radius, roundsLeft } — cloud around the Limelight
      laser: null,        // 🔺 { beams:[{axis,val,hexes}], roundsLeft } — re-patterns per round
      pyro: null,         // 🎆 { phase:'arming'|'erupting', hexes:[nums], wave }
      animatronics: [],   // 🤖 [{ key, num, turnsLeft }] — deterministic keys
      lastDraw: null,       // report: STAGE_FX_DRAWN { threshold, fxId } (null on a dup)
      lastActivation: null, // report: STAGE_FX_ACTIVATED { fxId, zapped }
      lastTurnTick: null,   // report: STAGE_FX_TURN_TICKED { pyro, anim }
      lastRoundTick: null,  // report: STAGE_FX_ROUND_TICKED { smoke, laser }
    },
    winner: null,     // Phase 3 — set by KO/win check
  };
}
