// --- ENGINE: TURN FLOW -------------------------------------------------------
// The TURN-START transform, extracted from the React monolith's
// `startNewTurnNotes`. One pure function over one Spirit's note sheet.
//
// WHY THIS ONE MATTERS MOST. BOT_STRATEGY_HANDOFF §1 calls the stock the spine:
// six refilled slots a turn, and every hex walked and every stack commit is paid
// out of them. A bot evaluator that cannot see this transform cannot reason
// about the only budget in the game, and the headless harness cannot advance a
// turn without it.
//
// SHAPE: `startTurnNotes(ns, opts) -> { patch, report }` — NOT a generator.
// Unlike battleFlow's consequence sequence there are no interleaved rule hooks
// and no state-dependent branching mid-way; it is one snapshot in, one snapshot
// out. A plain function is honest about that, and it means the harness can call
// it directly while the client keeps feeding it through its setNoteStates shim.
//
// The `report` carries everything the client needs for logs and FX (how many
// notes refreshed, which slots, whether a penalty bit) so no presentation
// decision has to re-derive rules from the patch.
//
// ⚠️ RNG IS PASSED IN AS PRE-DRAWN VALUES, never as a live rng. The client draws
// them off the seeded stream via RANDOM_BATCH_DRAWN before calling, because
// React may invoke a functional update more than once and a live draw in here
// would advance the engine cursor once per invocation. See determinismCheck.mjs.

import { modeFromStack } from "../../music/context.js";
import { canonicalRoot, getSpelledPool, pitchIndex } from "../../music/notes.js";
import { randomNote } from "../../music/cadence.js";
import { evaluateChord } from "../../music/chords.js";
import { usedList } from "./economy.js";
import { STOCK_REFILL_RATE } from "../../data/gameConstants.js";

/**
 * How many stock slots recharge for this sheet this turn.
 *
 * 🪓 Axe Swing whiff halves the rate; 🕳️ Gravity Control's drain subtracts on
 * TOP of that and the result floors at 0 — being both slimed and swallowed is a
 * bad turn, not a negative refill. Both are consumed by this turn (cleared in
 * the patch below), so each bites exactly once.
 *
 * Exported because the caller must know the count BEFORE calling, in order to
 * draw exactly that many seeded values. Keeping the arithmetic in one place is
 * what stops the draw count and the consume count drifting apart — a drift that
 * would silently misalign every subsequent draw in the match.
 */
export function refillRateFor(ns = {}) {
  const halved = ns.halfRefillNextTurn
    ? Math.floor(STOCK_REFILL_RATE / 2)
    : STOCK_REFILL_RATE;
  return Math.max(0, halved - (ns.refillDrain ?? 0));
}

/** How many seeded draws `startTurnNotes` will consume for this sheet. */
export function refillDrawCount(ns = {}) {
  return Math.min(refillRateFor(ns), (ns.noteStock ?? []).length);
}

/**
 * The turn-start transform for one Spirit.
 *
 * @param {object} ns       the Spirit's note sheet (never mutated)
 * @param {object} [opts]
 * @param {number[]} [opts.draws]  pre-drawn seeded floats, one per refreshed
 *   slot — exactly `refillDrawCount(ns)` of them. Short arrays fall back to 0,
 *   which is deterministic but degenerate; the caller should not rely on it.
 * @returns {{ patch: object, report: object }} patch merges onto the sheet.
 */
export function startTurnNotes(ns, { draws = [] } = {}) {
  if (!ns) return { patch: null, report: null };

  // ── 🎸 B8: THE CHORD DECLARES THE MODE ────────────────────────────────────
  // ⚠️ DERIVED AT TURN START ONLY, never on stack commit. Re-deriving mid-turn
  // would respell the note stock underneath notes the player has already placed.
  // A stack committed this turn changes the mode NEXT turn.
  const derived     = modeFromStack(ns.driveStack ?? [], ns.unlockedSkills ?? [], ns.scaleMode ?? 'major');
  const derivedMode = derived.mode;
  const derivedRoot = canonicalRoot(ns.rootNote, derivedMode);
  const modePool    = getSpelledPool(derivedRoot, derivedMode);
  const driveChord  = evaluateChord((ns.driveStack ?? []).filter(Boolean));

  // ── 🎵 GRADUAL REFILL ─────────────────────────────────────────────────────
  // Unused notes CARRY OVER; only spent slots recharge, and only up to the rate.
  // Spend big one turn, run short the next — that is the whole tempo of §1.
  const refillRate = refillRateFor(ns);
  const usedIdxs   = usedList(ns.usedStockIdx);
  const refreshing = new Set(usedIdxs.slice(0, refillRate));

  // Fresh notes are drawn in the DERIVED key and carried-over notes are
  // respelled into it — both here, before the player ever sees the stock.
  // Drawing in ns.scaleMode would spell this turn's new notes in last turn's
  // mode, the exact bug the old pivot's respell-on-declare existed to prevent.
  let cursor = 0;
  const newStock = (ns.noteStock ?? []).map((note, idx) => {
    if (refreshing.has(idx)) {
      const draw = draws[cursor++] ?? 0;
      return randomNote(derivedRoot, derivedMode, () => draw);
    }
    const pi = pitchIndex(note);
    return pi !== -1 ? modePool[pi] : note;
  });

  // Insertion order preserved (this was a Set before it had to be JSON-safe).
  const carriedUsed = usedIdxs.filter(i => !refreshing.has(i));

  const patch = {
    noteStock:    newStock,
    melodyLine:   [],
    melodySrcIdx: [],
    melodyFreq:   [],
    committedMelody:  null,   // Phase R1: clear last turn's stashed melody
    committedFreq:    null,
    stackCommitsThisTurn: 0,  // 🎸 fresh stack commit budget each turn
    usedStockIdx: carriedUsed,
    discordCount: 0,
    payoutRouting: {},        // dies with the track it indexes into
    hasConfirmed: false,
    dieFloorBoost: 0,
    smashExposed: false,        // 🎸💥 exposure clears at the start of your own turn
    halfRefillNextTurn: false,  // 🪓 Axe Swing whiff penalty consumed
    refillDrain: 0,             // 🕳️ vortex drain consumed (applied to the rate above)

    // 🌀 Psycho Bushido cooldown ticks on the Ronin's own turns.
    psychoBushidoCd: Math.max(0, (ns.psychoBushidoCd ?? 0) - 1),

    // 🎫 Crew: roadie cooldowns tick down (CREW_SYSTEM_DESIGN.md §4.2).
    roadies: (ns.roadies ?? []).map(r =>
      r.cooldownTurns > 0 ? { ...r, cooldownTurns: r.cooldownTurns - 1 } : r
    ),
    cadenceCooldowns: Object.fromEntries(
      Object.entries(ns.cadenceCooldowns ?? {}).map(([k, v]) => [k, Math.max(0, v - 1)])
    ),
    elevenTurns: Math.max(0, (ns.elevenTurns ?? 0) - 1),

    // ⚡ Charge Zone charges tick on the holder's own turns (2 ≈ 2 rounds).
    // Battles burn them early — that is §3.5's "roam vs. fight".
    chargeFloorTurns: Math.max(0, (ns.chargeFloorTurns ?? 0) - 1),
    chargeCeilTurns:  Math.max(0, (ns.chargeCeilTurns  ?? 0) - 1),

    mixerUsedThisTurn:   false,
    moshpitUsedThisTurn: false,
    swingExposed:        false,   // 🥊 CQC exposure clears at your next turn

    // Modulation cards refresh, but spent one-shots fall away instead.
    modCards: (ns.modCards ?? [])
      .filter(c => !(c.oneShot && c.exhausted))
      .map(c => ({ ...c, exhausted: false })),

    // 🎸 B8: the derived mode lands here. The Db bonus it earns is STAGED, not
    // paid — paying it needs side effects the caller owns (advanceDB /
    // awardTargetSkill), and this function must stay callable twice with the
    // same result.
    rootNote:      derivedRoot,
    scaleMode:     derivedMode,
    modeReason:    derived.reason,    // 'quality' | 'ambiguous' | 'locked'
    modeChordName: driveChord.name,   // e.g. "C Minor triad" — the HUD cites it
    pivotPending:  false,             // ⚠️ never true again; guards stay, harmless
    pendingModeBonus: { mode: derivedMode, reason: derived.reason, root: derivedRoot },

    // 👤 Shadow Illusion counts the Ronin's OWN turns, so a 3-turn double
    // survives three full rounds of rivals guessing wrong.
    shadowIllusion: tickShadowIllusion(ns.shadowIllusion),
  };

  return {
    patch,
    report: {
      refreshedIdx:   [...refreshing],
      refreshedCount: refreshing.size,
      refillRate,
      halvedByAxeSwing: !!ns.halfRefillNextTurn,
      drainedByVortex:  ns.refillDrain ?? 0,
      derivedMode,
      derivedRoot,
      modeReason:  derived.reason,
      modeChanged: derivedMode !== (ns.scaleMode ?? 'major'),
      // The PRE-tick value, so the caller can announce a double melting away —
      // by the time it reads the patch the illusion is already gone.
      shadowExpiring: !!ns.shadowIllusion && (ns.shadowIllusion.turnsLeft ?? 1) <= 1,
      shadowHexBefore: ns.shadowIllusion?.hex ?? null,
    },
  };
}

/**
 * 👤 Tick the Shadow Illusion; null once spent.
 *
 * The double's legs are zeroed here and refilled by the melody commit to THIS
 * turn's granted budget — otherwise last turn's leftover steps carry into a turn
 * whose budget isn't known yet.
 */
function tickShadowIllusion(si) {
  if (!si) return null;
  const left = (si.turnsLeft ?? 1) - 1;
  return left > 0 ? { ...si, turnsLeft: left, stepsLeft: 0 } : null;
}
