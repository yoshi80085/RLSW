// --- BOARD SYSTEM ------------------------------------------------------------
// Phase 6a -- spotlight, event hexes, Lost Chord tokens, charge zones, and
// flaming-disc (Disco Inferno) board state. The engine now owns this data;
// the client reads it for rendering and dispatches actions for mutations.
//
// Every reducer is pure: (state, action[, rng]) -> state. Reports live in
// state.board.last* for the client to read for logs/FX.

import { SPOTLIGHT_POOL, EVENT_HEX_POOL, makeBoardToken } from "../../board/boardHelpers.js";
import { ALL_HEXES } from "../../board/hexMap.js";
import { TOKEN_MAX, TOKEN_BASE_POOL, TOKEN_PER_ROUND_BASE, EVENT_RESPAWN_TURNS, CHARGE_ZONE_COOLDOWN, LIMELIGHT_HEX } from "../../data/gameConstants.js";

// All valid hex nums for token scatter (exclude nothing -- exclusions come in `occupied`)
const ALL_HEX_NUMS = ALL_HEXES.filter(h => h.num !== LIMELIGHT_HEX).map(h => h.num);

// -- Bridge -------------------------------------------------------------------

/** TEMP full-replace bridge -- same pattern as SPIRITS_SYNCED. */
export function applyBoardSynced(state, { board }) {
  return { ...state, board: { ...state.board, ...board } };
}

// -- Spotlight ----------------------------------------------------------------

/** Spirit ends turn on the spotlight hex -> +1 Vibe (engine owns spirits). */
export function applySpotlightHealed(state, { spiritId }) {
  const spot = state.board.spotlightHex;
  const sp = state.spirits.find(s => s.id === spiritId);
  if (!sp || sp.knockedOut || sp.num !== spot) {
    return { ...state, board: { ...state.board, lastSpotlightHeal: null } };
  }
  const healed = { ...sp, vibe: Math.min(sp.maxVibe, (sp.vibe ?? 0) + 1) };
  return {
    ...state,
    spirits: state.spirits.map(s => s.id === spiritId ? healed : s),
    board: { ...state.board, lastSpotlightHeal: { spiritId } },
  };
}

/** Spotlight moves to a new random interior hex at round end. */
export function applySpotlightMoved(state, { occupied }, rng) {
  const prev = state.board.spotlightHex;
  const occ = new Set(occupied);
  const pool = SPOTLIGHT_POOL.filter(n => n !== prev && !occ.has(n));
  if (pool.length === 0) {
    return { ...state, board: { ...state.board, lastSpotlightMove: null } };
  }
  const pick = pool[Math.floor(rng() * pool.length)];
  return {
    ...state,
    board: { ...state.board, spotlightHex: pick, lastSpotlightMove: { from: prev, to: pick } },
  };
}

// -- Lost Chord tokens --------------------------------------------------------

/** Scatter fresh Lost Chords at round end.
 *  The stage resonates with competing frequencies -- the more Spirits performing,
 *  the denser the harmonic interference and the fewer stray notes crystallise.
 *  When players are eliminated the resonance thins, so more fragments break free.
 *  aliveCount = Spirits still standing; totalPlayers = starting roster size.
 *  Cap rises with fewer players (TOKEN_BASE_POOL - alive) so the board stays
 *  populated even in a 1v1. */
export function applyTokensScattered(state, { occupied, aliveCount, totalPlayers }, rng) {
  // Derive defaults from state so callers that omit counts still behave correctly
  const total = totalPlayers ?? state.spirits.length;
  const alive = aliveCount ?? state.spirits.filter(s => !s.knockedOut).length;
  // Dynamic cap: fewer alive -> more room for tokens on the board
  const cap = Math.max(TOKEN_MAX, TOKEN_BASE_POOL - alive);
  const tokens = state.board.boardTokens;
  if (tokens.length >= cap) {
    return { ...state, board: { ...state.board, lastTokensScattered: null } };
  }
  // Scatter rate scales inversely with alive count:
  // 4 alive -> 2/round (base), 3 -> 3, 2 -> 4, 1 -> 5
  const scatterCount = TOKEN_PER_ROUND_BASE + Math.max(0, total - alive);
  const occ = new Set(occupied);
  tokens.forEach(t => occ.add(t.num));
  const available = ALL_HEX_NUMS.filter(n => !occ.has(n));
  const out = [...tokens];
  const added = [];
  for (let i = 0; i < scatterCount && out.length < cap && available.length > 0; i++) {
    const k = Math.floor(rng() * available.length);
    const num = available.splice(k, 1)[0];
    out.push(makeBoardToken(num, rng));
    added.push(num);
  }
  if (added.length === 0) {
    return { ...state, board: { ...state.board, lastTokensScattered: null } };
  }
  return {
    ...state,
    board: { ...state.board, boardTokens: out, lastTokensScattered: { added } },
  };
}

/** A successful Thrash hit knocks Lost Chords loose around the defender.
 *  The physical impact shakes stray notes out of the stage floor near the
 *  defender. Count scales with crash tier: light=1, medium=2, heavy=3.
 *  Tokens land on empty adjacent hexes only -- no cap check (impact bypasses
 *  equilibrium). */
export function applyThrashTokensSpawned(state, { defenderHex, occupied, crashTier, spread = 1 }, rng) {
  const count = crashTier === 'heavy' ? 3 : crashTier === 'medium' ? 2 : 1;
  const occ = new Set(occupied);
  state.board.boardTokens.forEach(t => occ.add(t.num));

  // Find empty hexes at exactly `spread` ring distance from the defender
  // (spread 1 = the old adjacency; 🌋 Aftershock scatters at ring 2).
  const defHex = ALL_HEXES.find(h => h.num === defenderHex);
  if (!defHex) return { ...state, board: { ...state.board, lastThrashTokens: null } };

  const hexDist = (a, b) => Math.max(
    Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs((-a.q - a.r) - (-b.q - b.r)));
  const adjNums = ALL_HEXES
    .filter(h => hexDist(h, defHex) === spread)
    .map(h => h.num)
    .filter(n => !occ.has(n));

  if (adjNums.length === 0) return { ...state, board: { ...state.board, lastThrashTokens: null } };

  const tokens = [...state.board.boardTokens];
  const added = [];
  for (let i = 0; i < count && adjNums.length > 0; i++) {
    const k = Math.floor(rng() * adjNums.length);
    const num = adjNums.splice(k, 1)[0];
    tokens.push(makeBoardToken(num, rng));
    added.push(num);
  }
  return {
    ...state,
    board: { ...state.board, boardTokens: tokens, lastThrashTokens: { added } },
  };
}

/** A spirit picks up a Lost Chord -- remove it from the board. */
export function applyTokenPickedUp(state, { spiritId, hexNum }) {
  const tok = state.board.boardTokens.find(t => t.num === hexNum);
  if (!tok) return state;
  return {
    ...state,
    board: {
      ...state.board,
      boardTokens: state.board.boardTokens.filter(t => t.num !== hexNum),
    },
  };
}

// -- Event hexes --------------------------------------------------------------

/** Spirit steps on a marquee event hex -- hex consumed, respawn timer set. */
export function applyEventHexTriggered(state, { spiritId, hexNum }) {
  if (!state.board.eventHexes.includes(hexNum)) return state;
  return {
    ...state,
    board: {
      ...state.board,
      eventHexes: state.board.eventHexes.filter(n => n !== hexNum),
      eventRespawnIn: EVENT_RESPAWN_TURNS,
    },
  };
}

/** Respawn countdown ticks -- decrement per spirit turn. */
export function applyEventRespawnTicked(state) {
  const prev = state.board.eventRespawnIn;
  if (prev <= 0) return state;
  return {
    ...state,
    board: { ...state.board, eventRespawnIn: prev - 1 },
  };
}

/** A new marquee event hex spawns (when respawn counter reached 0). */
export function applyEventHexSpawned(state, { occupied }, rng) {
  const evHexes = state.board.eventHexes;
  if (evHexes.length >= 2) {
    return { ...state, board: { ...state.board, lastEventRespawn: null } };
  }
  const occ = new Set([...occupied, ...evHexes]);
  const pool = EVENT_HEX_POOL.filter(n => !occ.has(n));
  if (pool.length === 0) {
    return { ...state, board: { ...state.board, lastEventRespawn: null } };
  }
  const pick = pool[Math.floor(rng() * pool.length)];
  return {
    ...state,
    board: {
      ...state.board,
      eventHexes: [...evHexes, pick],
      lastEventRespawn: { hexNum: pick },
    },
  };
}

// -- Charge zones -------------------------------------------------------------

/** A spirit taps a charge zone -- set its cooldown. */
export function applyChargeZoneUsed(state, { spiritId, hexNum }) {
  const zone = state.board.chargeZones.find(z => z.num === hexNum);
  if (!zone || (zone.cooldown ?? 0) > 0) return state;
  return {
    ...state,
    board: {
      ...state.board,
      chargeZones: state.board.chargeZones.map(z =>
        z.num === hexNum ? { ...z, cooldown: CHARGE_ZONE_COOLDOWN } : z
      ),
    },
  };
}

/** Charge zone cooldowns tick once per spirit turn. */
export function applyChargeZonesTicked(state) {
  const changed = state.board.chargeZones.some(z => (z.cooldown ?? 0) > 0);
  if (!changed) return state;
  return {
    ...state,
    board: {
      ...state.board,
      chargeZones: state.board.chargeZones.map(z =>
        (z.cooldown ?? 0) > 0 ? { ...z, cooldown: z.cooldown - 1 } : z
      ),
    },
  };
}

// -- Flaming hexes (Disco Inferno) --------------------------------------------

/** Set flaming hexes (Disco Inferno event fires). */
export function applyFlamingHexesSet(state, { hexes, rounds }) {
  return {
    ...state,
    board: {
      ...state.board,
      flamingHexes: { hexes, roundsLeft: rounds },
    },
  };
}

/** Disco Inferno flames decay one round at round end. */
export function applyFlamingDecayed(state) {
  const fl = state.board.flamingHexes;
  if (fl.roundsLeft <= 0) {
    return { ...state, board: { ...state.board, lastFlamingDecay: null } };
  }
  const left = fl.roundsLeft - 1;
  if (left <= 0) {
    return {
      ...state,
      board: {
        ...state.board,
        flamingHexes: { hexes: [], roundsLeft: 0 },
        lastFlamingDecay: { roundsLeft: 0, expired: true },
      },
    };
  }
  return {
    ...state,
    board: {
      ...state.board,
      flamingHexes: { ...fl, roundsLeft: left },
      lastFlamingDecay: { roundsLeft: left, expired: false },
    },
  };
}
