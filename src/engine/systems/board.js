// ─── BOARD SYSTEM ────────────────────────────────────────────────────────────
// Phase 6a — spotlight, event hexes, Lost Chord tokens, charge zones, and
// flaming-disc (Disco Inferno) board state. The engine now owns this data;
// the client reads it for rendering and dispatches actions for mutations.
//
// Every reducer is pure: `(state, action[, rng]) → state`. Reports live in
// `state.board.last*` for the client to read for logs/FX.

import { SPOTLIGHT_POOL, EVENT_HEX_POOL, makeBoardToken } from "../../board/boardHelpers.js";
import { ALL_HEXES } from "../../board/hexMap.js";
import { TOKEN_MAX, EVENT_RESPAWN_TURNS, CHARGE_ZONE_COOLDOWN, LIMELIGHT_HEX } from "../../data/gameConstants.js";

// All valid hex nums for token scatter (exclude nothing — exclusions come in `occupied`)
const ALL_HEX_NUMS = ALL_HEXES.filter(h => h.num !== LIMELIGHT_HEX).map(h => h.num);

// ── Bridge ──────────────────────────────────────────────────────────────────

/** TEMP full-replace bridge — same pattern as SPIRITS_SYNCED. */
export function applyBoardSynced(state, { board }) {
  return { ...state, board: { ...state.board, ...board } };
}

// ── Spotlight ───────────────────────────────────────────────────────────────

/** Spirit ends turn on the spotlight hex → +1 Vibe (engine owns spirits). */
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

// ── Lost Chord tokens ───────────────────────────────────────────────────────

/** Scatter fresh Lost Chords at round end (up to TOKEN_MAX). */
export function applyTokensScattered(state, { occupied }, rng) {
  const tokens = state.board.boardTokens;
  if (tokens.length >= TOKEN_MAX) {
    return { ...state, board: { ...state.board, lastTokensScattered: null } };
  }
  const occ = new Set(occupied);
  // Also exclude existing token hexes
  tokens.forEach(t => occ.add(t.num));
  const available = ALL_HEX_NUMS.filter(n => !occ.has(n));
  const out = [...tokens];
  const added = [];
  for (let i = 0; i < 2 && out.length < TOKEN_MAX && available.length > 0; i++) {
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

/** A spirit picks up a Lost Chord — remove it from the board. */
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

// ── Event hexes ─────────────────────────────────────────────────────────────

/** Spirit steps on a marquee event hex — hex consumed, respawn timer set. */
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

/** Respawn countdown ticks — decrement per spirit turn. */
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

// ── Charge zones ────────────────────────────────────────────────────────────

/** A spirit taps a charge zone — set its cooldown. */
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

// ── Flaming hexes (Disco Inferno) ───────────────────────────────────────────

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
