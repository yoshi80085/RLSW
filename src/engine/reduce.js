// ─── ENGINE REDUCER ──────────────────────────────────────────────────────────
// applyAction(state, action, rng) → new state. THE one door into game-rule
// changes. Pure: no timers, no DOM, no Math.random (draw via `rng` only —
// its {seed,cursor} is written back into the returned state so the caller
// never has to thread rng bookkeeping by hand).
//
// Presentation delays live in the client: the client *waits*, then
// dispatches the transition action (e.g. BEAM_CLASH_RESOLVED). The reducer
// never schedules anything.

import {
  GAME_INIT,
  TURN_STARTED, TURN_ENDED, TURN_SKIPPED,
  MOVE_BUDGET_SET, MOVE_STEP, BEATS_SPENT, SPIRIT_WARPED, SPIRITS_SYNCED,
  SPIRIT_FACED, SPIRIT_ELIMINATED, SPIRIT_PATCHED,
  RIFF_OFF_STARTED, RIFF_RESULTS_SUBMITTED, RIFF_RESOLVED,
  RIFF_ROUND2_STARTED, RIFF_CLOSED,
  ATTACK_ROLLED, COUNTER_ROLLED,
  DAMAGE_APPLIED, KNOCKDOWN_RESOLVED, WINNER_DECLARED,
  NOTE_STATES_SYNCED, FAME_CHANGED, FANS_CHANGED, NOTE_SHEET_PATCHED, FANS_TICKED,
  DEBUFFS_TICKED, BURN_TICKED,
  STAGE_FX_DRAWN, STAGE_FX_ACTIVATED, STAGE_FX_TURN_TICKED, STAGE_FX_ROUND_TICKED,
  GOD_ATTACK_PICKED, GOD_SUMMONED, GOD_DAMAGED, GOD_ACTED,
  GOD_DEFEATED, GOD_TRIUMPHED, GOD_TIMER_EXPIRED,
  BOARD_SYNCED,
  SPOTLIGHT_HEALED, SPOTLIGHT_MOVED, TOKENS_SCATTERED, FLAMING_DECAYED,
  EVENT_RESPAWN_TICKED, EVENT_HEX_SPAWNED, CHARGE_ZONES_TICKED,
  EVENT_HEX_TRIGGERED, TOKEN_PICKED_UP, CHARGE_ZONE_USED, FLAMING_HEXES_SET,
  RANDOM_BATCH_DRAWN,
} from "./actions.js";
import { restoreRng } from "./rng.js";
import {
  applyTurnStarted, applyTurnEnded, applyTurnSkipped,
  applyMoveBudgetSet, applyBeatsSpent, applySpiritsSynced,
  applySpiritEliminated, applySpiritPatched,
} from "./systems/turn.js";
import { applyMoveStep, applySpiritWarped, applySpiritFaced } from "./systems/movement.js";
import {
  applyAttackRolled, applyCounterRolled,
  applyDamageApplied, applyKnockdownResolved, applyWinnerDeclared,
} from "./systems/combat.js";
import {
  applyRiffOffStarted, applyRiffResultsSubmitted, applyRiffResolved,
  applyRiffRound2Started, applyRiffClosed,
} from "./systems/riffOff.js";
import {
  applyNoteStatesSynced, applyFameChanged, applyFansChanged, applyNoteSheetPatched,
  applyFansTicked, applyDebuffsTicked, applyBurnTicked,
} from "./systems/economy.js";
import {
  applyStageFxDrawn, applyStageFxActivated,
  applyStageFxTurnTicked, applyStageFxRoundTicked,
} from "./systems/stageFx.js";
import {
  applyGodAttackPicked, applyGodSummoned, applyGodDamaged, applyGodActed,
  applyGodDefeated, applyGodTriumphed, applyGodTimerExpired,
} from "./systems/rockGod.js";
import {
  applyBoardSynced,
  applySpotlightHealed, applySpotlightMoved,
  applyTokensScattered, applyTokenPickedUp,
  applyEventHexTriggered, applyEventRespawnTicked, applyEventHexSpawned,
  applyChargeZoneUsed, applyChargeZonesTicked,
  applyFlamingHexesSet, applyFlamingDecayed,
} from "./systems/board.js";

/**
 * @param {object} state   plain-JSON GameState (never mutated)
 * @param {object} action  { type, ...payload } (plain JSON)
 * @param {function} [rng] seeded rng; defaults to one restored from state.rng
 * @returns {object} next GameState
 */
export function applyAction(state, action, rng = restoreRng(state.rng)) {
  const next = reduce(state, action, rng);
  // Persist rng position so the next applyAction resumes the same stream.
  return { ...next, rng: rng.state() };
}

function reduce(state, action, rng) {
  switch (action.type) {
    case GAME_INIT:       return state;

    // ── Phase 2: turn & movement ──
    case TURN_STARTED:    return applyTurnStarted(state, action);
    case TURN_ENDED:      return applyTurnEnded(state);
    case TURN_SKIPPED:    return applyTurnSkipped(state);
    case MOVE_BUDGET_SET: return applyMoveBudgetSet(state, action);
    case MOVE_STEP:       return applyMoveStep(state, action, rng);
    case BEATS_SPENT:     return applyBeatsSpent(state, action);
    case SPIRIT_WARPED:   return applySpiritWarped(state, action);
    case SPIRIT_FACED:    return applySpiritFaced(state, action);
    case SPIRIT_ELIMINATED: return applySpiritEliminated(state, action);
    case SPIRITS_SYNCED:  return applySpiritsSynced(state, action);
    case SPIRIT_PATCHED:  return applySpiritPatched(state, action);

    // ── Phase 4: riff-off ──
    case RIFF_OFF_STARTED:       return applyRiffOffStarted(state, action, rng);
    case RIFF_RESULTS_SUBMITTED: return applyRiffResultsSubmitted(state, action);
    case RIFF_RESOLVED:          return applyRiffResolved(state);
    case RIFF_ROUND2_STARTED:    return applyRiffRound2Started(state, action, rng);
    case RIFF_CLOSED:            return applyRiffClosed(state);

    // ── Phase 3b: combat rolls ──
    case ATTACK_ROLLED:          return applyAttackRolled(state, action, rng);

    // ── Phase 3d: retaliation (counter) roll ──
    case COUNTER_ROLLED:         return applyCounterRolled(state, action, rng);

    // ── Phase 5c: spirit combat-ownership (deferred 3c flip, engine side) ──
    case DAMAGE_APPLIED:         return applyDamageApplied(state, action);
    case KNOCKDOWN_RESOLVED:     return applyKnockdownResolved(state, action);
    case WINNER_DECLARED:        return applyWinnerDeclared(state, action);

    // ── Phase 5c: noteStates ownership bridge ──
    case NOTE_STATES_SYNCED:     return applyNoteStatesSynced(state, action);
    case FAME_CHANGED:           return applyFameChanged(state, action);
    case FANS_CHANGED:           return applyFansChanged(state, action);
    case NOTE_SHEET_PATCHED:     return applyNoteSheetPatched(state, action);
    case FANS_TICKED:            return applyFansTicked(state, action);
    case DEBUFFS_TICKED:         return applyDebuffsTicked(state, action);
    case BURN_TICKED:            return applyBurnTicked(state, action, rng);

    // ── Phase 6b: stage FX ──
    case STAGE_FX_DRAWN:         return applyStageFxDrawn(state, action);
    case STAGE_FX_ACTIVATED:     return applyStageFxActivated(state, action, rng);
    case STAGE_FX_TURN_TICKED:   return applyStageFxTurnTicked(state, action, rng);
    case STAGE_FX_ROUND_TICKED:  return applyStageFxRoundTicked(state, action, rng);

    // ── Phase 6c: Rock God ──
    case GOD_ATTACK_PICKED:      return applyGodAttackPicked(state, action, rng);
    case GOD_SUMMONED:           return applyGodSummoned(state, action);
    case GOD_DAMAGED:            return applyGodDamaged(state, action);
    case GOD_ACTED:              return applyGodActed(state, action, rng);
    case GOD_DEFEATED:           return applyGodDefeated(state, action);
    case GOD_TRIUMPHED:          return applyGodTriumphed(state);
    case GOD_TIMER_EXPIRED:      return applyGodTimerExpired(state, action);

    // ── Phase 6a: board state ──
    case BOARD_SYNCED:           return applyBoardSynced(state, action);
    case SPOTLIGHT_HEALED:       return applySpotlightHealed(state, action);
    case SPOTLIGHT_MOVED:        return applySpotlightMoved(state, action, rng);
    case TOKENS_SCATTERED:       return applyTokensScattered(state, action, rng);
    case TOKEN_PICKED_UP:        return applyTokenPickedUp(state, action);
    case EVENT_HEX_TRIGGERED:    return applyEventHexTriggered(state, action);
    case EVENT_RESPAWN_TICKED:   return applyEventRespawnTicked(state);
    case EVENT_HEX_SPAWNED:      return applyEventHexSpawned(state, action, rng);
    case CHARGE_ZONE_USED:       return applyChargeZoneUsed(state, action);
    case CHARGE_ZONES_TICKED:    return applyChargeZonesTicked(state);
    case FLAMING_HEXES_SET:      return applyFlamingHexesSet(state, action);
    case FLAMING_DECAYED:        return applyFlamingDecayed(state);

    // ── Phase 6 remaining: event resolution rng ──
    case RANDOM_BATCH_DRAWN: {
      const values = [];
      for (let i = 0; i < action.count; i++) values.push(rng());
      return { ...state, lastRandomBatch: values };
    }

    default:
      // Unknown action = a bug (client/server version skew or a typo).
      // Loud in dev, lenient in replay: return state unchanged.
      console.warn(`[engine] unknown action type: ${action.type}`);
      return state;
  }
}
