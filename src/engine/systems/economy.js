// ─── ENGINE SYSTEM: ECONOMY (note-track / skills) ────────────────────────────
// Phase 5a: contract fixes ahead of the full economy extraction (Phase 5c flip).

import { pitchIndex, NOTE_POOL, canonicalRoot } from "../../music/notes.js";
import { detectMotifRepeat, refillStock } from "../../music/cadence.js";
import { FAN_DIEHARD_START, FAN_CASUAL_START, FAN_BORED_AFTER, FAN_DECAY } from "../../data/gameConstants.js";
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
// This is the SINGLE SOURCE for the per-spirit sheet — the client's duplicate
// `Game.makeInitialNoteState` was deleted at the 5c client flip. `rand` is a
// 0..1 PRNG — the engine passes its seeded rng; it defaults to Math.random.
export function makeInitialNoteState(spiritId, rand = Math.random) {
  const rawRoot = NOTE_POOL[Math.floor(rand() * NOTE_POOL.length)];
  const initMode = "major";
  const root = canonicalRoot(rawRoot, initMode);
  // 🗡️ SHREDDING RONIN carries a deeper well: 11 stock slots instead of 10.
  const stockSize = spiritId === "cosmic_ronin" ? 11 : 10;
  return {
    noteStock:       refillStock(root, initMode, stockSize, rand),
    melodyLine:      [],
    // ── 🎸 DRIVE / SUSTAIN SPLIT (DRIVE_SUSTAIN_SPLIT_DESIGN.md) ──
    // B0a: stacks seed with the ROOT ALONE — a Single note (D3/S3), not a free
    // Power Chord. The 5th now costs a stock note like any other, so the power
    // chord is EARNED with your first stack commit. With STACK_COMMIT_BUDGET = 3
    // a full triad is still reachable on turn one if you spend for it — this
    // adds a choice, it does not impose a delay.
    driveStack:      [root],
    sustainStack:    [root],
    chordStack:      [root],  // DEPRECATED — kept for save compat (like edgeStage)
    stackCommitsThisTurn: 0,         // 0–STACK_COMMIT_BUDGET per turn, resets at turn start
    usedStockIdx:    [], // insertion-ordered array of spent stock-slot indices (JSON-safe; was a Set)
    rootNote:        root,
    scaleMode:       initMode,
    // 🎸 B8: no Major/Minor prompt any more — the Drive Stack's chord quality
    // decides, re-derived at the start of every turn. No need to call
    // modeFromStack here: B0a seeds the stack with the root ALONE, which reads as
    // a Single note, which is quality-AMBIGUOUS (no third to hear), so it holds
    // whatever mode it is given — `initMode` — and turn one can never force-flip a
    // spirit's mode. That invariant is asserted in b0check.mjs, so if the seed ever
    // stops being a single note the test will say so.
    pivotPending:    false,
    modeReason:      'ambiguous',
    modeChordName:   `${root} (single)`,
    diceTier:        0,
    tierPoints:      0,
    discordCount:    0,
    hasConfirmed:    false,
    // (B5: `feedbackBoost` removed. It armed a "Damage ×2" HUD badge that no damage
    //  path ever read — damage is banded and capped at 4 (Thrash) / 2 (Sonic)
    //  against a max Vibe of 4–5, so an honest ×2 was never shippable. Removed
    //  rather than deprecated, so archived code reviving it fails loudly — same
    //  treatment as STACK_CAP and FLAT_ROOTS.)
    dieFloorBoost:   0,
    chargeFloorTurns: 0,   // ⚡ Charge Zone floor charge (attack dice can't roll below 3)
    chargeCeilTurns:  0,   // ⚡ Charge Zone ceiling charge (attack dice +1 die size)
    statusEffects:   [],
    // These three statuses SURVIVE B1 — the melody triggers that used to arm
    // them are gone, but each still has an independent source:
    //   stagger   ← an ultimate, and the candle event rolling a 1
    //   mojoDrain ← the Riff-Off "convicted" verdict
    //   burn      ← Pyrotechnics (walk-in and eruption waves)
    // Their ARMING fields (burnArmed / pendingMojoDrain / pendingStagger) and
    // statusShield were removed in B1 — those really were trigger-only.
    stagger:         null,
    mojoDrain:       0,
    burn:            null,
    // 🕳️ Notes the Gravity Control vortex swallowed — subtracted from THIS
    // spirit's next stock refill, then reset. Same shape of penalty as
    // halfRefillNextTurn, just a flat subtraction instead of a halving.
    refillDrain:     0,
    // 💻 Spirit-turns left on an armed Code Injection patch. Syncs like every
    // other sheet field — but it is HIDDEN INFORMATION, so never render it for
    // anyone except the player who owns the Spirit.
    codeInjectTurns: 0,
    // 🕳️ The open black hole, held on Intergalactic 0's sheet only:
    // { hex, turnsLeft, pulled: [] }. Null for everyone else, always.
    gravityVortex:   null,
    // ☀️ Turns of Sunbeam blindness left (Intergalactic 0's on-hit rider).
    // Ticked down at the END of this spirit's own turn by applyDebuffsTicked.
    // Purely a VIEW effect: it whites out the blinded player's own screen and
    // nothing else. It deliberately does NOT touch movement, targeting or any
    // rule — you keep every option you had, you just can't see to use them.
    blindTurns:      0,
    // 🔊 GOES TO 11 — `atEleven` is this turn's dial setting; `ampBlownTurns`
    // is the bill, and it is ticked at the END of his own turn by
    // applyDebuffsTicked so the turn without a rig actually happens.
    atEleven:        false,
    ampBlownTurns:   0,
    tempDrive:       0,
    tempSustain:     0,
    swingExposed:    false,
    smashExposed:    false,
    // (displaceCd REMOVED — Space is Displaced has no cooldown any more; it is
    // metered purely by its per-warp Db cost. Nothing reads the field.)
    dbPoints:        0,
    totalDB:         0,
    upgradesPending: 0,
    skillRoute:      null,
    // 🔊 Amp I is the starting Main Amp — 2d6 from turn 1.
    // ── 🗡️ B10: RONIN OWNS THE FIRST RUNG OF THE LADDER ──────────────────────
    // Wa no Koe (melody/chord alignment → +1 Drive/Sustain) was this whole system
    // as one character's signature, written before the system existed. B3 turned it
    // into a tier every spirit can buy, which would have left Ronin's flagship
    // passive as the thing the tree obsoleted. So he starts holding `theory_minor`
    // and Wa no Koe stacks on top as his personal amplifier: he is the spirit who
    // plays over the changes natively, and he is the branch's in-game tutorial.
    //
    // ⚠️ THIS IS THE WHOLE SKILL, NOT JUST THE TIER, and that is a deliberate
    // choice with three consequences we accept rather than engineer around:
    //   1. He gets Chord Tone Pardon from turn one — the B10 ask.
    //   2. He also gets the MINOR SCALE in `playableScale` and lets `modeFromStack`
    //      flip his key to minor. Fitting for the character; not separable without
    //      a second code path.
    //   3. `theory_dom7`'s prereq is satisfied, so his ladder costs 38 Db, not 46.
    // `music/context.js` documents the mechanism: a caller grants a free tier by
    // putting its id in the list it passes, and there is exactly ONE code path. A
    // spirit may therefore legitimately hold a tier without the ones "below" it —
    // `tiersFor` is a set of independent checks, not an ordered walk, for this
    // reason. Do not "fix" that by assuming the ladder was bought in order.
    unlockedSkills:  spiritId === "cosmic_ronin" ? ["amp_1", "theory_minor"] : ["amp_1"],
    targetSkillId:   null,
    diceLevel:       0,
    ampOwned:        false,
    roadies:         [],
    bankedNote:      null,
    knockStreak:     0,
    // ── 🗡️ SHREDDING RONIN REWORK ──
    psychoBushidoCd:  0,       // 🌀 Psycho Bushido cooldown (2 rounds)
    // 👤 Shadow Illusion body double:
    //   { hex, facing, turnsLeft, stepsLeft, stepsMax }
    // Rendered as a second, identical Ronin standee. `facing` is tracked because
    // a double whose arrow disagreed with its walk direction would be an instant
    // tell. `stepsLeft` is the double's OWN movement pool — refilled each turn to
    // match the Ronin's granted budget, but never drawn from his Action Points.
    shadowIllusion:   null,
    lastMoveBudget:   0,       // 👤 steps granted at the last melody commit

    // 🎸 Cursed Shamisen: { hex, range, roundsLeft, touched[] }
    // 2026-08-05 rework: fixed 2-ring aura, 3 ROUNDS of life, and it only
    // touches Spirits whose scaleMode is 'minor' — wandering one hex a round
    // toward the nearest of them, standing still when the board is all major.
    // (The old stage/hunting growth ladder is gone.) `touched` is the ids its
    // melody reached on the most recent tick, which drives the lingering 🎶
    // mark on those Spirits' standees.
    cursedShamisen:   null,
    waNoKoeBuffs:     [],      // 🎵 Wa no Koe: [{ stat:'drive'|'sustain', turnsLeft }]
    discordUnlocks:  [],
    tripped:         false,
    instrumentDropped: false,
    dazed:           false,
    modCards:        [{ id: "starter-transpose", type: "transpose", exhausted: false, oneShot: true }],
    ultimateUsed:     false,
    mixerUsedThisTurn: false,
    elevenTurns:      0,
    edgeStage:        0,  // DEPRECATED — Edge system removed; kept for save compat
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
    assignments:      [],     // legacy — kept for save compat; no longer used by crew
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
 * (−1, floored at 0), ticks stagger.turnsLeft (expiry clears it to null), and
 * burns down ☀️ Sunbeam's `blindTurns`.
 * Pure — consumes no rng. Report in `state.turn.lastDebuffTick`.
 *
 * ⚠️ BLIND TICKS AT THE **END** OF THE BLINDED SPIRIT'S OWN TURN, ON PURPOSE.
 * Sunbeam is bought and paid for with the promise of "your rival loses a turn",
 * so the clock has to be spent by PLAYING a turn blind, not by the turn merely
 * coming around. Decrementing at turn START would clear a 1-turn blind before
 * the victim ever drew a hex, and the ability would do nothing at all. If you
 * move this tick, check that a fresh `blindTurns: 1` still costs a full turn of
 * vision. (Same trap `decayPoisonSlime` fell into — see CHARACTER_HANDOFF.md.)
 */
export function applyDebuffsTicked(state, { spiritId }) {
  const ns = state.noteStates[spiritId];
  if (!ns) return state;
  // ⚠️ THE EARLY RETURN BELOW IS A TRAP FOR ANY NEW DEBUFF, so 🔊 Eleven's two
  // fields are in this list. Miss one and the tick is skipped on every turn
  // where it is the ONLY thing active — which is the common case for a blown
  // amp — and the cost quietly becomes nothing.
  const hadDebuff = ns.tripped || ns.dazed || ns.instrumentDropped
    || (ns.mojoDrain ?? 0) > 0 || ns.stagger || (ns.blindTurns ?? 0) > 0
    || ns.atEleven || (ns.ampBlownTurns ?? 0) > 0;
  if (!hadDebuff) {
    return { ...state, turn: { ...state.turn, lastDebuffTick: { spiritId, cleared: false } } };
  }
  const newMojoDrain = Math.max(0, (ns.mojoDrain ?? 0) - 1);
  let newStagger = null;
  if (ns.stagger && ns.stagger.turnsLeft > 1) {
    newStagger = { ...ns.stagger, turnsLeft: ns.stagger.turnsLeft - 1 };
  }
  const newBlindTurns = Math.max(0, (ns.blindTurns ?? 0) - 1);
  return {
    ...state,
    noteStates: { ...state.noteStates, [spiritId]: {
      ...ns,
      tripped:           false,
      dazed:             false,
      instrumentDropped: false,
      mojoDrain:         newMojoDrain,
      stagger:           newStagger,
      blindTurns:        newBlindTurns,
      // 🔊 The dial is a THIS-TURN setting — he gets one attack a turn, so one
      // turn IS one enormous swing. The blown amp outlives it on purpose.
      atEleven:          false,
      ampBlownTurns:     Math.max(0, (ns.ampBlownTurns ?? 0) - 1),
    }},
    turn: { ...state.turn, lastDebuffTick: {
      spiritId, cleared: true,
      tripped: !!ns.tripped, dazed: !!ns.dazed,
      instrumentDropped: !!ns.instrumentDropped,
      mojoDrainBefore: ns.mojoDrain ?? 0,
      staggerBefore: ns.stagger ? ns.stagger.turnsLeft : 0,
      blindBefore: ns.blindTurns ?? 0,
      blindCleared: (ns.blindTurns ?? 0) > 0 && newBlindTurns === 0,
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

// ─── STYLE SYSTEM — DELETED ──────────────────────────────────────────────────
// `styleCommitDb`, `styleLengthTier` and `micBonusNote` lived here. All three are
// gone, along with the Style Db payout, C4's per-style chord-context reads, and
// C1's live preview.
//
// WHY. Style was a second scoring layer sitting on top of gestures the game
// already paid for: `detectStyleRun` was an explicit generalisation of the
// Drive-boost's `detectDiatonicRun`/`detectSkipClimb`, `detectRepeatPattern` was
// literally the same function the Sustain boost calls, and Flair's resolved
// discords were the same notes the pardon economy already routed. Three gestures,
// scored twice, in two currencies — a large part of why a single commit had nine
// separate Db sources.
//
// It was also an aesthetic judge, and the game has stopped trying to be one. Db
// now pays for FACTS a player can aim at (how much you played, where you came to
// rest, whether that landing was in your chord, how many notes fought the key).
// The "was that interesting?" question moved wholesale to the crowd, where being
// impressionistic is correct rather than a flaw — see `performanceScore` above,
// which still runs and now feeds fans and fans alone.
//
// `micBonusNote` went with it: it existed only to stop the mic's voice roll
// overwriting a Groove spirit's root landing, and with no Groove there is nothing
// non-monotone left for a rolled note to damage.
//
// STYLE_DEFS survives in data/styles.js as pure character flavour (icon, colour,
// tagline). It has no mechanical effect and nothing reads it for scoring.
