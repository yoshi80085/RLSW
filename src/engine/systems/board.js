// --- BOARD SYSTEM ------------------------------------------------------------
// Phase 6a -- spotlight, event hexes, Lost Chord tokens, charge zones, and
// flaming-disc (Disco Inferno) board state. The engine now owns this data;
// the client reads it for rendering and dispatches actions for mutations.
//
// Every reducer is pure: (state, action[, rng]) -> state. Reports live in
// state.board.last* for the client to read for logs/FX.

import { SPOTLIGHT_POOL, eventHexCandidates, makeBoardToken } from "../../board/boardHelpers.js";
import { ALL_HEXES } from "../../board/hexMap.js";
import { TOKEN_MAX, TOKEN_BASE_POOL, TOKEN_PER_ROUND_BASE, TOKEN_DRIFT_TURNS, EVENT_HEX_COUNT, EVENT_RESPAWN_TURNS, CHARGE_ZONE_COOLDOWN, LIMELIGHT_HEX } from "../../data/gameConstants.js";

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

/** Tick token ages and relocate stale ones.
 *  Called once per spirit turn. Each token's `turnsOnBoard` increments by 1.
 *  Tokens that hit TOKEN_DRIFT_TURNS relocate to a new random unoccupied hex
 *  (same note, reset age). If no free hex exists the token stays put. */
export function applyTokensDrifted(state, { occupied }, rng) {
  const tokens = state.board.boardTokens;
  if (tokens.length === 0) return { ...state, board: { ...state.board, lastTokensDrifted: null } };
  const occ = new Set(occupied);
  const moved = [];
  const out = tokens.map(t => {
    const age = (t.turnsOnBoard ?? 0) + 1;
    if (age < TOKEN_DRIFT_TURNS) return { ...t, turnsOnBoard: age };
    // Time to relocate — find a free hex
    const usedNums = new Set([...occ, ...tokens.map(tk => tk.num), ...moved.map(m => m.to)]);
    const pool = ALL_HEX_NUMS.filter(n => !usedNums.has(n));
    if (pool.length === 0) return { ...t, turnsOnBoard: age }; // nowhere to go
    const newNum = pool[Math.floor(rng() * pool.length)];
    moved.push({ from: t.num, to: newNum });
    return { ...t, num: newNum, turnsOnBoard: 0 };
  });
  return {
    ...state,
    board: { ...state.board, boardTokens: out, lastTokensDrifted: moved.length > 0 ? { moved } : null },
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

/**
 * A new marquee event hex lights up (when the respawn counter reached 0).
 * Lights exactly ONE, and re-arms the timer if the board is still short.
 *
 * ⚠️ THE CAP USED TO BE THE LITERAL `2`. It happened to match the count we now
 * want, which is precisely why it was dangerous: raise `EVENT_HEX_COUNT` to 3
 * and the spawner would have refused to go past two, with no error, no log line
 * and a board quietly one marquee short for the rest of the match. It reads the
 * constant now, so the count has exactly one home.
 *
 * ⚠️ ONE PER CALL, NOT A FULL TOP-UP, is a pacing decision rather than a
 * limitation. `EVENT_RESPAWN_TURNS` is the cadence of a marquee LIGHTING, and
 * the client's log line ("a new marquee hex lights up") reads as one event.
 * Consume both in the same round and the board recovers over two rounds rather
 * than snapping back to full — the middle stays scarce right when the table has
 * just fought over it. Re-arming here (rather than in the client) is what makes
 * that true no matter who calls this.
 */
export function applyEventHexSpawned(state, { occupied }, rng) {
  const evHexes = state.board.eventHexes;
  if (evHexes.length >= EVENT_HEX_COUNT) {
    return { ...state, board: { ...state.board, lastEventRespawn: null } };
  }
  // Separation from the marquees already lit lives in the candidate helper --
  // see `eventHexCandidates`, which degrades to the unspaced pool rather than
  // returning nothing on a crowded board.
  const pool = eventHexCandidates(occupied, evHexes);
  if (pool.length === 0) {
    // Nowhere to go. Leave the timer where it is; the caller's "am I short?"
    // check will bring us back next round, so a full board self-heals.
    return { ...state, board: { ...state.board, lastEventRespawn: null } };
  }
  const pick = pool[Math.floor(rng() * pool.length)];
  const next = [...evHexes, pick];
  return {
    ...state,
    board: {
      ...state.board,
      eventHexes: next,
      eventRespawnIn: next.length < EVENT_HEX_COUNT ? EVENT_RESPAWN_TURNS : 0,
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

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 WHAT WALKING ONTO A HEX PAYS — the pickup kernels
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ ADDED 2026-08-17, AND THE REASON IS A BUG OF THE FAMILY `SEQUENCING.md`
// §5.A CATALOGUES — the seventh instance, and the same shape every time.
//
// `applyTokenPickedUp` and `applyChargeZoneUsed` have been engine reducers for a
// long time and they are CORRECT. Nothing called them outside React. The rules
// that decide WHAT you get — the Lost Chord landing in your stock, the 50/50
// charge spark — lived only inside `Game.checkTokenPickup` and
// `Game.grantChargeSpark`, closure-scoped in the monolith, where
// `policies/transition.js` had nothing to transcribe from.
//
// The consequence was not an error. It was silence:
//   · The bot walked over Lost Chords and got no note.
//   · The bot walked over Charge Zones and got no charge — which means
//     `evaluate`'s `charge` weight of **2.2**, Intergalactic 0's single highest
//     number and the term the handoff calls "the whole character" (§4.2), has
//     never once been able to fire in a bench match. Every reading about him is
//     a reading of a Spirit with his identity switched off.
//
// 📌 The kernels live HERE, next to the reducers that own the board half, and
// the client is rewired onto them in the same pass. Two copies of a payout rule
// is how `checkWaNoKoe` drifted (`SEQUENCING.md` §3) and it is not worth
// repeating for the sake of a smaller diff.

/**
 * 🎵 A Lost Chord lands in the stock.
 *
 * Returns the new `noteStock` array. ⚠️ It OVERWRITES the first unused slot
 * before it appends, which looks like a detail and is the rule: stock is a
 * reservoir of fixed slots, not a hand, so a pickup refills a spent slot rather
 * than growing the sheet. Appending unconditionally would hand the collector a
 * reservoir bigger than `stockSize` and quietly break §1's spine.
 *
 * `extraNote` is the 🗡️ Ronin's second note (his innate finds more music in a
 * find). Pass `null` for everyone else; the caller owns the coin flip because
 * the draw has to happen on a logged stream, never inside a state updater.
 */
export function bankLostChord(noteStock, usedIdxList, note, extraNote = null) {
  const stock  = [...(noteStock ?? [])];
  const used   = new Set(usedIdxList ?? []);
  const placed = new Set();
  const place = (n) => {
    const slot = stock.findIndex((_, i) => !used.has(i) && !placed.has(i));
    if (slot === -1) { stock.push(n); placed.add(stock.length - 1); }
    else { stock[slot] = n; placed.add(slot); }
  };
  place(note);
  if (extraNote) place(extraNote);
  return { noteStock: stock, placed: [...placed] };
}

/**
 * ⚡ The charge spark — the sheet patch a tapped Charge Zone writes.
 *
 * A 50/50 between a die FLOOR (attack dice cannot roll below 3) and a die
 * CEILING (dice grow a size, d6→d8). ⚠️ A DUPLICATE FLIPS TO THE OTHER TYPE
 * rather than refreshing what you already hold, which is what stops a Spirit
 * camping one zone from banking the same half twice; holding both refreshes
 * both. Transcribed from `Game.grantChargeSpark` — if that ramp changes, this
 * changes with it, and vice versa, because they are now the same function.
 *
 * @param {object} ns    the Spirit's note sheet (reads the two charge counters)
 * @param {number} draw  a float in [0,1) from the CALLER's rng
 * @param {number} turns `CHARGE_ZONE_BOOST_TURNS`
 * @returns {{ patch:object, kind:'floor'|'ceil'|'both' }}
 */
export function chargeSparkPatch(ns = {}, draw = 0, turns = 2) {
  const hasFloor = (ns.chargeFloorTurns ?? 0) > 0;
  const hasCeil  = (ns.chargeCeilTurns  ?? 0) > 0;
  let kind = draw < 0.5 ? 'floor' : 'ceil';
  if (hasFloor && hasCeil)               kind = 'both';
  else if (kind === 'floor' && hasFloor) kind = 'ceil';
  else if (kind === 'ceil'  && hasCeil)  kind = 'floor';
  const patch = {};
  if (kind === 'floor' || kind === 'both') patch.chargeFloorTurns = turns;
  if (kind === 'ceil'  || kind === 'both') patch.chargeCeilTurns  = turns;
  return { patch, kind };
}

/** Is there an uncollected Lost Chord on this hex? */
export function tokenAt(state, hexNum) {
  return (state?.board?.boardTokens ?? []).find(t => t.num === hexNum) ?? null;
}

/** Is there a LIT (off-cooldown) Charge Zone on this hex? */
export function liveChargeZoneAt(state, hexNum) {
  return (state?.board?.chargeZones ?? [])
    .find(z => z.num === hexNum && (z.cooldown ?? 0) <= 0) ?? null;
}
