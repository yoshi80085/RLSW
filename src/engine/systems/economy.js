// ─── ENGINE SYSTEM: ECONOMY (note-track / skills) ────────────────────────────
// Phase 5a: contract fixes ahead of the full economy extraction (Phase 5c flip).

import { pitchIndex, NOTE_POOL, canonicalRoot, semitonesUp } from "../../music/notes.js";
import { detectMotifRepeat, refillStock } from "../../music/cadence.js";
import { FAN_DIEHARD_START, FAN_CASUAL_START, FAN_BORED_AFTER, FAN_DECAY } from "../../data/gameConstants.js";
import { STARTING_STANCE } from "../../data/stances.js";
import { hexRingFromCenter } from "../../board/boardHelpers.js";
//
// `usedStockIdx` — the per-spirit set of spent stock-slot indices — used to be a
// JS `Set`, which violates the plain-JSON GameState contract (a Set doesn't
// survive JSON.stringify → the Phase-8 replay/serialize proof). It's now a plain
// **insertion-ordered array of integer indices**.
//
// IMPORTANT — insertion order, NOT sorted. A JS `Set` iterates in insertion
// order, and `startNewTurnNotes` relies on that: `[...usedStockIdx].slice(0,
// STOCK_REFILL_RATE)` recharges the slots that were spent FIRST, not the
// lowest-numbered slots. Sorting here would silently change which stock slots
// refill each turn. Insertion order is still fully JSON-safe and replay-
// deterministic (the array is a pure function of the action order, so a headless
// replay reproduces it byte-for-byte). These helpers reproduce the old Set
// semantics exactly (membership + dedup-on-add, insertion order preserved) and
// accept a legacy Set defensively but always emit an array.

/** Membership test — replaces `usedStockIdx.has(idx)`. */
export function usedHas(used, idx) {
  if (Array.isArray(used)) return used.includes(idx);
  if (used && typeof used.has === "function") return used.has(idx);
  return false;
}

/** Fresh plain-array copy — replaces `[...usedStockIdx]`. */
export function usedList(used) {
  if (Array.isArray(used)) return used.slice();
  if (used && typeof used[Symbol.iterator] === "function") return Array.from(used);
  return [];
}

/**
 * Add one or more indices, deduped, preserving insertion order, returning a new
 * array — replaces `new Set([...usedStockIdx, idx])` / `new Set([...used,
 * ...idxs])` (which, spread back out, is exactly an insertion-ordered dedup).
 */
export function usedAdd(used, ...idxs) {
  const out = usedList(used);
  for (const i of idxs.flat()) if (!out.includes(i)) out.push(i);
  return out;
}

// ─── PERFORMANCE SCORE P (Crowd & Intimidation flair, §4) ────────────────────
// Pure kernel extracted verbatim from `confirmNoteTrack` (Phase 5a) — same trick
// as `smashOutcome`/`riffStats`: a single source of truth a server can score
// identically. P measures how INTERESTING the note placement was (melodic shape,
// palette, recognized gestures, repeated motifs) with track length only a small
// nudge; it routes to crowd growth / DB top-up / intimidation downstream.
//
// Returns { score, freestyle }: `score` is P clamped to 0..10; `freestyle` is the
// Freestyle flair flag (Intergalactic 0's pardoned first wrong note), which the
// caller also needs for its flash/log — returned here so the discord/freestyle
// arithmetic lives in ONE place and can't drift.
//
// Inputs (all already computed by the caller):
//   melodyLine          — the committed note track (array of note names)
//   trackHasTritone, isOctaveResolution           — interval-effect flags
//   diatonicRunLen, repeatPatLen, skipClimbLen     — detected run lengths
//   hasGatedEnding      — minor-7th | major-3rd | tritone unlock-gated ending
//   hasRiff             — a legendary riff was detected on the track
//   cadenceResolved     — a cadence objective completed this commit
//   earned              — base DB points earned (feeds the small length nudge)
//   edgeResolved        — the Dissonance Edge resolved this turn (+2 flair)
//   susEnd              — theory_sus suspended ending (+1 flair)
//   discordCount        — raw off-scale note count this track
//   freestylePardon     — Intergalactic 0's first-wrong-note pardon is active
export function performanceScore({
  melodyLine,
  trackHasTritone, isOctaveResolution,
  diatonicRunLen, repeatPatLen, skipClimbLen,
  hasGatedEnding, hasRiff, cadenceResolved,
  earned, edgeResolved, susEnd,
  discordCount, freestylePardon,
}) {
  const perfPc = melodyLine.map(pitchIndex).filter(p => p >= 0);
  const perfDiff = [];
  for (let i = 1; i < perfPc.length; i++) {
    let d = ((perfPc[i] - perfPc[i - 1]) % 12 + 12) % 12;   // fold to nearest direction (−6..6)
    if (d > 6) d -= 12;
    perfDiff.push(d);
  }
  // melodic shape — contour direction changes, leaps (≥3 semitones), interval variety
  let perfDirChg = 0, perfPrevDir = 0;
  for (const d of perfDiff) { const sgn = Math.sign(d); if (sgn && perfPrevDir && sgn !== perfPrevDir) perfDirChg++; if (sgn) perfPrevDir = sgn; }
  const perfLeaps      = perfDiff.filter(d => Math.abs(d) >= 3).length;
  const perfIntDiv     = new Set(perfDiff.filter(d => d).map(d => Math.abs(d))).size;
  const perfDistinctPc = new Set(perfPc).size;
  let perfHas3Repeat   = false;
  for (let i = 2; i < melodyLine.length; i++) {
    if (melodyLine[i] === melodyLine[i - 1] && melodyLine[i - 1] === melodyLine[i - 2]) { perfHas3Repeat = true; break; }
  }
  const perfShape   = Math.min(2, perfDirChg) + Math.min(2, perfLeaps) + (perfIntDiv >= 2 ? 1 : 0) + (perfIntDiv >= 3 ? 1 : 0);
  const perfPalette = (perfDistinctPc >= 3 && !perfHas3Repeat ? 1 : 0) + (perfDistinctPc >= 5 ? 1 : 0);
  const perfGest = Math.min(3,
      (trackHasTritone ? 1 : 0)
    + (isOctaveResolution ? 1 : 0)
    + (diatonicRunLen >= 3 ? 1 : 0)
    + (repeatPatLen   >= 3 ? 1 : 0)
    + (skipClimbLen   >= 3 ? 1 : 0)
    + (hasGatedEnding ? 1 : 0)
  );
  const perfMotif0 = detectMotifRepeat(melodyLine);
  const perfMotif  = (perfMotif0.period >= 3 ? 2 : 0) + (perfMotif0.reps >= 3 ? 1 : 0);
  const perfBig      = (hasRiff ? 3 : 0) + (cadenceResolved ? 1 : 0);  // a landed riff is peak flair
  const perfLenNudge = Math.floor(earned / 3);                          // length is only a small nudge
  const perfDiscord   = freestylePardon ? Math.max(0, discordCount - 1) : discordCount;
  const perfFreestyle = (freestylePardon && discordCount >= 1) ? 1 : 0;
  const score = Math.max(0, Math.min(10,
    perfShape + perfPalette + perfGest + perfMotif + perfBig + perfLenNudge
      + (edgeResolved ? 2 : 0) + (susEnd ? 1 : 0) + perfFreestyle - perfDiscord
  ));
  return { score, freestyle: perfFreestyle };
}

// ─── INITIAL NOTE STATE (per-spirit economy sheet) ───────────────────────────
// Phase 5c foundation: the per-spirit note/skill/fan sheet builder, moved here
// verbatim from Game so `makeInitialState` can build + OWN `engineState.noteStates`
// on the seeded rng (replay-deterministic — this is why 5a threaded the `rand`
// param through `randomNote`/`refillStock`). ~60 plain-JSON fields; no Set (5a),
// no React, no FX.
//
// ⚠️ KEEP IN SYNC with Game.makeInitialNoteState until the 5c client flip. Both
// are byte-identical today; the client's copy is deleted when the client reads
// `engineState.noteStates` (then this becomes the single source). `rand` is a
// 0..1 PRNG — the engine passes its seeded rng; it defaults to Math.random so the
// (still-live) client copy behaves exactly as before.
export function makeInitialNoteState(spiritId, rand = Math.random) {
  const rawRoot = NOTE_POOL[Math.floor(rand() * NOTE_POOL.length)];
  const initMode = "major";
  const root = canonicalRoot(rawRoot, initMode);
  // 🗡️ SHREDDING RONIN carries a deeper well: 10 stock slots instead of 8.
  const stockSize = spiritId === "cosmic_ronin" ? 10 : 8;
  const startStance = STARTING_STANCE[spiritId] ?? "cool";
  return {
    noteStock:       refillStock(root, initMode, stockSize, rand),
    melodyLine:      [],
    chordStack:      [root, semitonesUp(root, 7)], // 🎸 Power Chord (R+5); persists across turns
    // ── 🧍 STANCE (combat/performance identity — STANCE_SYSTEM_DESIGN.md) ──
    stance:          startStance,        // 'soloist'|'power'|'cool'|'groove'
    stancesKnown:    [startStance],      // grows via the Stance skill route
    grooveCounter:   0,                  // Groove stance's banked wave (0..cap)
    revoiceUsedThisTurn: false,
    bonusRevoiceAvailable: false,
    usedStockIdx:    [], // insertion-ordered array of spent stock-slot indices (JSON-safe; was a Set)
    rootNote:        root,
    scaleMode:       initMode,
    pivotPending:    true,
    diceTier:        0,
    tierPoints:      0,
    discordCount:    0,
    hasConfirmed:    false,
    feedbackBoost:   false,
    dieFloorBoost:   0,
    chargeFloorTurns: 0,   // ⚡ Charge Zone floor charge (attack dice can't roll below 3)
    chargeCeilTurns:  0,   // ⚡ Charge Zone ceiling charge (attack dice +1 die size)
    statusEffects:   [],
    stagger:         null,
    mojoDrain:       0,
    burn:            null,
    burnArmed:       false,
    statusShield:    false,
    tempDrive:       0,
    tempSustain:     0,
    swingExposed:    false,
    smashExposed:    false,
    displaceCd:      0,
    dbPoints:        0,
    totalDB:         0,
    upgradesPending: 0,
    skillRoute:      null,
    unlockedSkills:  [],
    targetSkillId:   null,
    diceLevel:       0,
    ampOwned:        false,
    roadies:         [],
    bankedNote:      null,
    knockStreak:     0,
    riffSlayerArmed: false,
    pendingParanoia: false,
    eRushArmed:      false,
    discordUnlocks:  [],
    tripped:         false,
    instrumentDropped: false,
    dazed:           false,
    modCards:        [{ id: "starter-transpose", type: "transpose", exhausted: false, oneShot: true }],
    groupieCooldowns: {},
    ultimateUsed:     false,
    mixerUsedThisTurn: false,
    elevenTurns:      0,
    edgeStage:        0,
    fame:             0,
    finalsTrail:      [],
    cadenceCooldowns: {},
    // ── 🎤 FAN ECONOMY ──
    diehards:         FAN_DIEHARD_START,
    casuals:          FAN_CASUAL_START,
    centerStreak:     0,
    outerStreak:      0,
    fanLag:           0,
    fanActedThisTurn: false,
    // ── 🎫 CREW ASSIGNMENTS (CREW_SYSTEM_DESIGN.md) ──
    // Array of taskIds a Diehard is currently assigned to. Each entry pulls one
    // Diehard out of the crowdMultiplier. Max length = 1 (or 2 with crew_manager).
    assignments:      [],
    heckled:          false,  // 📢 Heckler flag — next crowd-gain is zeroed, then clears
    // ── 🎭 CROWD & INTIMIDATION LAYER ──
    perfScore:    0,
    recentP:      [],
    excitement:   0,
    loyalty:      0,
    intimArmed:   null,
    intimidation: null,
  };
}

/**
 * NOTE_STATES_SYNCED (Phase 5c) — full-map replace of the engine's noteStates.
 * The client-flip compat bridge (mirrors applySpiritsSynced): the React shim
 * applies its functional/plain update to the live engine noteStates and writes
 * the whole map back through here, making the engine authoritative while every
 * legacy setNoteStates site keeps working unchanged.
 */
export function applyNoteStatesSynced(state, { noteStates }) {
  return { ...state, noteStates };
}

/**
 * FAME_CHANGED (Phase 5c) — add a signed delta to one spirit's Fame, floored at
 * 0. Mirrors grantFame's `fame + finalFp` (finalFp>0 → floor is a no-op) and the
 * knockdown −1 penalty. No-op if the spirit has no sheet.
 */
export function applyFameChanged(state, { spiritId, amount = 0 }) {
  const ns = state.noteStates[spiritId];
  if (!ns) return state;
  return {
    ...state,
    noteStates: { ...state.noteStates, [spiritId]: { ...ns, fame: Math.max(0, (ns.fame ?? 0) + amount) } },
  };
}

/**
 * HEADLINER_CHANGED (Phase R5) — the riff-off winner claims the Headliner
 * title (or null to vacate it). Top-level state key, not per-spirit.
 */
export function applyHeadlinerChanged(state, { spiritId }) {
  return { ...state, headliner: spiritId ?? null };
}

/**
 * FANS_CHANGED (Phase 5c) — merge a patch into one spirit's FAN block. Only the
 * whitelisted fields below can change (a malformed payload can't touch fame,
 * skills, or the note track). The client still computes the values (zone rules,
 * promotion, demolition scatter + its flee roll — carried as action payload, the
 * RIFF_RESULTS_SUBMITTED pattern), so this is a scoped, semantic write — not a
 * rules engine yet; those rules land with the 5d END_TURN tick. No-op if the
 * spirit has no sheet.
 */
export const FAN_FIELDS = [
  "diehards", "casuals", "centerStreak", "outerStreak",
  "fanLag", "fanActedThisTurn", "divineShield",
];
export function applyFansChanged(state, { spiritId, fans = {} }) {
  const ns = state.noteStates[spiritId];
  if (!ns) return state;
  const patch = {};
  for (const k of FAN_FIELDS) if (k in fans) patch[k] = fans[k];
  return {
    ...state,
    noteStates: { ...state.noteStates, [spiritId]: { ...ns, ...patch } },
  };
}

/**
 * NOTE_SHEET_PATCHED (Phase 5c) — merge a client-computed field patch into one
 * spirit's sheet (no whitelist: this is the shim's generic diff action, so it
 * must be able to carry any sheet field). No-op if the spirit has no sheet —
 * the shim only emits patches for ids already in the map (anything else falls
 * back to the NOTE_STATES_SYNCED full replace). Consumes no rng.
 */
export function applyNoteSheetPatched(state, { spiritId, patch = {} }) {
  const ns = state.noteStates[spiritId];
  if (!ns) return state;
  return {
    ...state,
    noteStates: { ...state.noteStates, [spiritId]: { ...ns, ...patch } },
  };
}

/**
 * DEBUFFS_TICKED (Phase 6d) — end-of-turn debuff countdown for the acting spirit.
 * Clears one-turn flags (tripped, dazed, instrumentDropped), decrements mojoDrain
 * (−1, floored at 0), and ticks stagger.turnsLeft (expiry clears it to null).
 * Pure — consumes no rng. Report in `state.turn.lastDebuffTick`.
 */
export function applyDebuffsTicked(state, { spiritId }) {
  const ns = state.noteStates[spiritId];
  if (!ns) return state;
  const hadDebuff = ns.tripped || ns.dazed || ns.instrumentDropped
    || (ns.mojoDrain ?? 0) > 0 || ns.stagger;
  if (!hadDebuff) {
    return { ...state, turn: { ...state.turn, lastDebuffTick: { spiritId, cleared: false } } };
  }
  const newMojoDrain = Math.max(0, (ns.mojoDrain ?? 0) - 1);
  let newStagger = null;
  if (ns.stagger && ns.stagger.turnsLeft > 1) {
    newStagger = { ...ns.stagger, turnsLeft: ns.stagger.turnsLeft - 1 };
  }
  return {
    ...state,
    noteStates: { ...state.noteStates, [spiritId]: {
      ...ns,
      tripped:           false,
      dazed:             false,
      instrumentDropped: false,
      mojoDrain:         newMojoDrain,
      stagger:           newStagger,
    }},
    turn: { ...state.turn, lastDebuffTick: {
      spiritId, cleared: true,
      tripped: !!ns.tripped, dazed: !!ns.dazed,
      instrumentDropped: !!ns.instrumentDropped,
      mojoDrainBefore: ns.mojoDrain ?? 0,
      staggerBefore: ns.stagger ? ns.stagger.turnsLeft : 0,
    }},
  };
}

/**
 * BURN_TICKED (Phase 6d) — end-of-turn burn tick. Flips a 50/50 on the engine rng;
 * on heads, subtracts 1 Vibe from the spirit (floored at 0 — same as DAMAGE_APPLIED).
 * Always decrements burn.turnsLeft; on expiry, clears burn to null. Report in
 * `state.turn.lastBurnTick { spiritId, burnDamage, turnsLeft, expired }`. The
 * client dispatches KNOCKDOWN_RESOLVED if Vibe reaches 0 (same cinematic pattern).
 */
export function applyBurnTicked(state, { spiritId }, rng) {
  const ns = state.noteStates[spiritId];
  if (!ns || !(ns.burn?.turnsLeft > 0)) {
    return { ...state, turn: { ...state.turn, lastBurnTick: null } };
  }
  const turnsLeft = ns.burn.turnsLeft - 1;
  const coin = rng();  // 0..1 — < 0.5 = damage
  const burnDamage = coin < 0.5 ? 1 : 0;

  // Apply damage to engine spirits (same floor as DAMAGE_APPLIED)
  let spirits = state.spirits;
  if (burnDamage > 0) {
    spirits = spirits.map(s =>
      s.id === spiritId ? { ...s, vibe: Math.max(0, (s.vibe ?? 0) - burnDamage) } : s
    );
  }

  return {
    ...state,
    spirits,
    noteStates: { ...state.noteStates, [spiritId]: {
      ...ns, burn: turnsLeft > 0 ? { turnsLeft } : null,
    }},
    turn: { ...state.turn, lastBurnTick: {
      spiritId, burnDamage, turnsLeft, expired: turnsLeft <= 0,
    }},
  };
}

/**
 * FANS_TICKED (Phase 5d) — the end-of-turn fan tick, extracted verbatim from
 * Game.tickFans. Zone comes from the ENGINE's spirit position (single source;
 * the old client arg is retired). Rules: centre keeps the crowd (idle in the
 * spotlight breaks the promote streak), the floor is neutral (no boredom, no
 * loyalty), the outer edge builds an `outerStreak` that sheds FAN_DECAY casuals
 * per turn once it reaches FAN_BORED_AFTER; demolition `fanLag` recovers by 1;
 * `fanActedThisTurn` always resets. Deterministic — consumes no rng. The
 * client-facing report lands in `state.turn.lastFanTick { spiritId, zone, lost }`.
 */
export function applyFansTicked(state, { spiritId }) {
  const ns = state.noteStates[spiritId];
  if (!ns) return state;
  const sp = state.spirits.find(x => x.id === spiritId);
  const zone = sp ? hexRingFromCenter(sp.num) : "back";
  let casuals      = ns.casuals ?? 0;
  let centerStreak = ns.centerStreak ?? 0;
  let outerStreak  = ns.outerStreak ?? 0;
  const fanLag     = Math.max(0, (ns.fanLag ?? 0) - 1);
  let lost = 0;
  if (zone === "main" || zone === "pit") {
    outerStreak = 0;
    if (!ns.fanActedThisTurn) centerStreak = 0; // idle in the spotlight breaks the streak
  } else if (zone === "floor") {
    outerStreak = 0;      // neutral ground — no boredom
    centerStreak = 0;     // ...but no loyalty built out here either
  } else {
    // Outer edge — patience runs out only after several turns in a row.
    outerStreak += 1;
    centerStreak = 0;
    if (outerStreak >= FAN_BORED_AFTER && casuals > 0) {
      const before = casuals;
      casuals = Math.max(0, casuals - FAN_DECAY);
      lost = before - casuals;
    }
  }
  return {
    ...state,
    noteStates: { ...state.noteStates, [spiritId]: {
      ...ns, casuals, centerStreak, outerStreak, fanLag, fanActedThisTurn: false } },
    turn: { ...state.turn, lastFanTick: { spiritId, zone, lost } },
  };
}
