// ─── BOT TRANSITION ─────────────────────────────────────────────────────────
// `applyBotAction(state, action, ctx) -> { state, view, ok, reason, logs }`
// BOT_STRATEGY_HANDOFF §6 — the link between §6.1 and §5.
//
// `legalActions` says what may happen. `evaluate` says how good a position is.
// Neither is worth anything without the thing in the middle: a way to actually
// TAKE an action and get the next state back. That is this file, and it is what
// turns three separate modules into a searcher and a harness.
//
// ⚠️ THIS FILE OWNS NO RULES. Every kind below routes into the existing engine —
// `applyAction` (the reducer), `attackParams` (the stat derivation),
// `battleConsequences` (the ordered aftermath). Where a rule would have to be
// re-implemented to make a kind work, the kind is declared UNMODELLED instead.
// A transition that quietly invents rules is worse than one that admits a gap:
// the gap shows up as a bot that never considers a line, which is visible; an
// invented rule shows up as a bot that is confidently wrong, which is not.
//
// ── THE CONTRACT ────────────────────────────────────────────────────────────
// Returns `{ state, view, ok, reason, logs }`. `ok: false` leaves `state`
// UNTOUCHED and names the reason. Two reasons exist and they are different:
//   · `'illegal'`    — the rules refuse it. A caller feeding actions straight
//                      from `legalActions` should never see this; if it does,
//                      the two files have drifted and that is a bug in one.
//   · `'unmodelled'` — the rules ALLOW it, but the engine cannot yet run it
//                      headlessly. Not a bug. See UNMODELLED below.
//
// ── ⚠️ WHAT IS NOT MODELLED YET, AND WHY IT MATTERS ─────────────────────────
//  1. `confirmMelody` is PARTIAL, and this is the significant one. It applies
//     the MECHANICAL half — the AP grant (§1's spine) and the `hasConfirmed`
//     flip — but not the ECONOMIC half: Db payout, Performance Score, fan gain,
//     mode re-derivation, banked note. Those live in `confirmNoteTrack`, ~600
//     lines deep in the monolith, and re-deriving them here would be exactly
//     the invented-rules failure above. CONSEQUENCE FOR TUNING: a searcher on
//     this transition sees the melody's MOVEMENT value but is blind to its
//     SCORING value, which will bias it toward short tracks. Do not read
//     win rates off §6.6 as melody-strategy evidence until this lands.
//  2. `smash` / `blaster` are UNMODELLED. They are not `attackRolled` attacks —
//     they are undefendable, resolve through `smashOutcome`, and carry a long
//     bespoke side-effect chain (whole Drive stack spent, stock hurled,
//     `smashExposed` set, movement zeroed). §3.4 calls the Smash a
//     defence-breaker whose real payload is the exposure, so a half-modelled
//     Smash would misprice the single highest-damage sequence in the game.
//  3. `pose` moves `view.posing` only. The per-round FP tick and Sustain toll
//     are on the turn clock in the client.
//
// Everything else — movement, facing, melody notes, stack commits, skill
// unlocks, Swing, Sonic, end of turn — is exact.

import { applyAction } from "../reduce.js";
import {
  moveStep, spiritFaced, beatsSpent, moveBudgetSet, turnEnded,
  noteSheetPatched, attackRolled,
} from "../actions.js";
import { battleConsequences, runBattleFlow } from "../systems/battleFlow.js";
import { attackParams, spiritChord } from "../systems/attackParams.js";
import { usedAdd } from "../systems/economy.js";
import { SPIRIT_DEFS } from "../../data/spirits.js";
import { SWING_AP_COST, SONIC_AP_COST } from "./legalActions.js";

/** Kinds this file can actually run headlessly. */
export const MODELLED_KINDS = new Set([
  'melodyNote', 'stackCommit', 'confirmMelody',
  'move', 'face', 'swing', 'sonic', 'pose', 'skillUnlock', 'endTurn',
]);

/** Kinds the rules allow but the engine cannot yet run. See the header. */
export const UNMODELLED_KINDS = new Set(['smash', 'blaster']);

/** `confirmMelody` applies the AP grant but not the scoring economy. */
export const PARTIAL_KINDS = { confirmMelody: ['dbPayout', 'perfScore', 'fanGain', 'modeDerivation', 'bankedNote'] };

const fail = (state, view, reason, detail) => ({ state, view, ok: false, reason, detail: detail ?? null, logs: [] });

/** Merge a patch into one Spirit's note sheet, through the reducer. */
const patchNs = (state, spiritId, patch, rng) =>
  applyAction(state, noteSheetPatched(spiritId, patch), rng);

/**
 * Take one bot action.
 *
 * @param {object} state    engine GameState
 * @param {object} action   from `legalActions`
 * @param {object} ctx
 *   · `rng`   seeded rng. ⚠️ MUST be a fork (`rng.fork('search')`) when this is
 *             called speculatively — §0.4. Burning cursor draws inside a
 *             hypothetical desyncs every replay and every online client, and it
 *             fails SILENTLY. This file cannot enforce that; the caller must.
 *   · `view`  client-owned slices (`posing`, `amps`, `shadowHex`, `skillById`)
 *   · `hooks` battleFlow hooks the client still owns (demolishFans, knockOut…);
 *             absent hooks are simply skipped, which is what the harness wants.
 */
export function applyBotAction(state, action, ctx = {}) {
  const { rng, view = {}, hooks = {} } = ctx;
  const kind = action?.kind;

  if (!kind) return fail(state, view, 'illegal', 'action has no kind');
  if (UNMODELLED_KINDS.has(kind)) return fail(state, view, 'unmodelled', kind);
  if (!MODELLED_KINDS.has(kind)) return fail(state, view, 'illegal', `unknown kind ${kind}`);

  const spiritId = state?.acting;
  const self = (state?.spirits ?? []).find(s => s.id === spiritId);
  if (!self) return fail(state, view, 'illegal', 'nobody is acting');
  const ns = state?.noteStates?.[spiritId] ?? {};

  switch (kind) {
    // ── COMPOSITION ────────────────────────────────────────────────────────
    case 'melodyNote':
      return {
        state: patchNs(state, spiritId, {
          melodyLine:   [...(ns.melodyLine ?? []), action.note],
          usedStockIdx: usedAdd(ns.usedStockIdx, action.stockIdx),
        }, rng),
        view, ok: true, reason: null, logs: [],
      };

    case 'stackCommit': {
      const key = action.dest === 'sustain' ? 'sustainStack' : 'driveStack';
      return {
        state: patchNs(state, spiritId, {
          [key]:                [...(ns[key] ?? []), action.note],
          usedStockIdx:         usedAdd(ns.usedStockIdx, action.stockIdx),
          stackCommitsThisTurn: (ns.stackCommitsThisTurn ?? 0) + 1,
        }, rng),
        view, ok: true, reason: null, logs: [],
      };
    }

    case 'confirmMelody': {
      // §1's spine, and the only part of the commit this file claims: the
      // melody you wrote becomes the AP you act with, capped by speed.
      // `tripped` halves it (min 1) inside the reducer — not re-derived here.
      const track = ns.melodyLine ?? [];
      if (!track.length) return fail(state, view, 'illegal', 'nothing to confirm');
      const speed = SPIRIT_DEFS[spiritId]?.speed ?? 5;
      let next = applyAction(state, moveBudgetSet(Math.min(track.length, speed), !!ns.tripped), rng);
      next = patchNs(next, spiritId, { hasConfirmed: true }, rng);
      return {
        state: next, view, ok: true, reason: null,
        partial: PARTIAL_KINDS.confirmMelody,     // ⚠️ the economy did NOT run
        logs: [],
      };
    }

    // ── BOARD ──────────────────────────────────────────────────────────────
    // NOTE: `applyMoveStep` spends the AP itself AND re-faces the Spirit down
    // the direction of travel. No separate beatsSpent, and no separate face —
    // walking IS a facing decision, which is why a bot that steps toward a
    // rival is also turning its back on whatever is behind it.
    case 'move':
      return {
        state: applyAction(state, moveStep(spiritId, action.to, !!ns.dazed), rng),
        view, ok: true, reason: null, logs: [],
      };

    case 'face':
      return {
        state: applyAction(state, spiritFaced(spiritId, action.facing), rng),
        view, ok: true, reason: null, logs: [],
      };

    // ── VIOLENCE ───────────────────────────────────────────────────────────
    case 'swing':
    case 'sonic': {
      const params = attackParams(state, spiritId, action.targetId, kind, view);
      if (!params) return fail(state, view, 'illegal', 'attacker or defender not on the board');
      const { _derived, ...rollOpts } = params;

      // Pay first, exactly as the client does: AP off the shared pool, and the
      // Action Token — the one-attack-per-turn rule (§6a).
      let next = applyAction(state, beatsSpent(kind === 'swing' ? SWING_AP_COST : SONIC_AP_COST, true), rng);

      // ⚠️ The exposure is consumed by being READ. `attackParams` cannot clear
      // it (it is pure), so the clear happens here — miss it and the rival's
      // armour stays switched off for the rest of the match.
      if (_derived.consumedSmashExposed) {
        next = patchNs(next, action.targetId, { smashExposed: false }, rng);
      }

      next = applyAction(next, attackRolled(kind, spiritId, action.targetId, rollOpts), rng);
      const battle = next.battle;

      // The ordered aftermath — the same generator the UI drives, run to
      // completion synchronously. Identical order by construction; only the
      // pacing differs. Hooks the caller does not supply are skipped.
      const run = runBattleFlow(
        battleConsequences({
          state: next, battle,
          chordOf: spiritChord,
          amps: view.amps ?? [],
          fameThisTurn: view.fameThisTurn ?? {},
        }),
        next,
        { applyAction: (s, a) => applyAction(s, a, rng), hooks },
      );

      return { state: run.state, view, ok: true, reason: null, logs: run.logs, battle };
    }

    // ── EVERYTHING ELSE ────────────────────────────────────────────────────
    case 'pose':
      // 🎤 Opening a pose is free; the FP tick and the Sustain toll ride the
      // turn clock in the client, so only the flag moves here.
      return {
        state,
        view: { ...view, posing: { ...(view.posing ?? {}), [spiritId]: true } },
        ok: true, reason: null, logs: [],
      };

    case 'skillUnlock': {
      const cost = action.dbCost ?? 0;
      if ((ns.dbPoints ?? 0) < cost) return fail(state, view, 'illegal', 'cannot afford it');
      return {
        state: patchNs(state, spiritId, {
          unlockedSkills: [...(ns.unlockedSkills ?? []), action.skillId],
          dbPoints:       (ns.dbPoints ?? 0) - cost,
        }, rng),
        view, ok: true, reason: null, logs: [],
      };
    }

    case 'endTurn':
      return { state: applyAction(state, turnEnded(), rng), view, ok: true, reason: null, logs: [] };

    default:
      return fail(state, view, 'illegal', `unhandled kind ${kind}`);
  }
}

/**
 * Take a whole sequence. ⚠️ ATOMIC: all of it applies, or none of it does.
 *
 * Returns `{ state, view, taken, stoppedAt }`. `stoppedAt` names the action
 * that refused and why, or is null if the line ran clean.
 *
 * ⚠️ THE ROLLBACK IS THE POINT, and it is worth being explicit about because
 * the alternative looks more efficient. Returning the partially-advanced state
 * would let a caller score a TRUNCATED line as though it were the line it asked
 * for — "walk in, then Smash" scored as "walk in", i.e. a position that looks
 * safe precisely because the dangerous half silently did not happen. That is
 * the same class of failure as an invented rule, just quieter. A caller that
 * genuinely wants the prefix can ask for the prefix.
 *
 * Rollback is free here: engine states are immutable snapshots, so "undo" is
 * just declining to keep the new one.
 */
export function applyBotLine(state, actions, ctx = {}) {
  const startView = ctx.view ?? {};
  let cur = state, view = startView;
  const taken = [];
  for (const a of actions ?? []) {
    const r = applyBotAction(cur, a, { ...ctx, view });
    if (!r.ok) {
      return { state, view: startView, taken: [], stoppedAt: { action: a, reason: r.reason, detail: r.detail } };
    }
    cur = r.state; view = r.view;
    taken.push(a);
  }
  return { state: cur, view, taken, stoppedAt: null };
}
