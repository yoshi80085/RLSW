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
//  1. ~~`confirmMelody` is PARTIAL~~ ✅ COMPLETE — `systems/melodyCommit.js`.
//     It applied only the MECHANICAL half (the AP grant, the `hasConfirmed`
//     flip) and was blind to the ECONOMIC half — Db, Performance Score, fans,
//     the banked note, the riff, the cadence — which biased any searcher on it
//     toward SHORT tracks: three notes visibly cost less stock than six, while
//     six notes invisibly paid Db, flair and a crowd. The economy is now a pure
//     kernel this file drives. ⚠️ ONE THING STILL RIDES THE CLIENT:
//     `applySkillEffects`. The STATE half of a skill award lands (the skill
//     enters `unlockedSkills`); the side-effect chain does not. `report.clientOwned`
//     names it at every call.
//  2. `smash` / `blaster` are UNMODELLED. They are not `attackRolled` attacks —
//     they are undefendable, and carry a long bespoke side-effect chain (whole
//     Drive stack spent, stock hurled, movement zeroed).
//     ⚠️ THEY ARE ONE `kind` PAIR AND TWO DIFFERENT ACTIONS. Only the Blaster
//     runs on `smashOutcome`'s throw curve, and only the Blaster sets
//     `smashExposed` — on ITSELF, as recoil ("ride the recoil into Exposed"),
//     cleared at the start of its own turn. `resolveSmash` sets no flag at all;
//     the 2026-08-05 rework deleted it on purpose ("the cost IS the drawback").
//     An earlier draft of §3.4 had the Smash exposing its TARGET and called the
//     follow-up the highest-damage sequence in the game. It was describing a
//     mechanic that does not exist — corrected there, repeated here because this
//     is the file someone reads right before trying to model it.
//  3. ~~`pose` moves `view.posing` only. The per-round FP tick and Sustain toll
//     are on the turn clock in the client.~~ ✅ CLOSED 2026-08-17 (§6.6.8) —
//     `posing` and `limelightScores` are engine state (`systems/limelight.js`),
//     and `endTurn` below drives `poseConsequences` off the same
//     `limelightHeld` verdict the client reads. The pose now pays and bills
//     headlessly, which it never has.
//
// Everything else — movement, facing, melody notes, stack commits, skill
// unlocks, Swing, Sonic, end of turn — is exact.

import { applyAction } from "../reduce.js";
import {
  moveStep, spiritFaced, beatsSpent, moveBudgetSet, turnEnded,
  noteSheetPatched, attackRolled, fansChanged, spiritSlid, slimeCleared, slimeCalled,
  elevenCalled, posed,
} from "../actions.js";
import {
  battleConsequences, runBattleFlow, grantFame, riffOffConsequences,
  poseConsequences,
} from "../systems/battleFlow.js";
import {
  applyRiffOffStarted, applyRiffResultsSubmitted, applyRiffResolved,
  applyRiffRound2Started, applyRiffClosed, simulateRiffPerformance,
} from "../systems/riffOff.js";
import { attackParams, spiritChord, SONIC_DRIVE_SPEND } from "../systems/attackParams.js";
import { usedAdd, usedList } from "../systems/economy.js";
import {
  bankLostChord, chargeSparkPatch, tokenAt, liveChargeZoneAt,
} from "../systems/board.js";
import { tokenPickedUp, chargeZoneUsed } from "../actions.js";
import { CHARGE_ZONE_BOOST_TURNS } from "../../data/gameConstants.js";
import { randomNote } from "../../music/cadence.js";
import { commitMelodyEconomy } from "../systems/melodyCommit.js";
import { SWING_AP_COST, SONIC_AP_COST } from "./legalActions.js";

/** Kinds this file can actually run headlessly. */
export const MODELLED_KINDS = new Set([
  'melodyNote', 'stackCommit', 'confirmMelody',
  'move', 'slide', 'face', 'swing', 'sonic', 'tentacle', 'pose', 'skillTarget', 'endTurn',
  'riffOff',
  'slime', 'eleven',
]);

/** Kinds the rules allow but the engine cannot yet run. See the header. */
export const UNMODELLED_KINDS = new Set(['smash', 'blaster']);

/**
 * Kinds that run, but hand part of the job back to the client.
 *
 * ⚠️ EMPTY IS A CLAIM, NOT AN ABSENCE. `confirmMelody` used to list five gaps;
 * all five now run through `systems/melodyCommit.js`. Two of them turned out not
 * to be gaps at all on inspection, and that is worth recording rather than
 * quietly dropping:
 *   · `modeDerivation` was never this action's job. B8 moved it to the START of
 *     the next turn (`turnFlow.js` → `modeFromStack`); the mode written at
 *     commit is a placeholder turn start overwrites.
 *   · `bankedNote` was three lines of speed-overflow arithmetic, not a system.
 * The real work was `dbPayout`, `perfScore` and `fanGain`.
 *
 * What is left is smaller and lives in `melodyCommit.CLIENT_OWNED`, reported per
 * call rather than declared here, because it is a property of that kernel's
 * return value and not of this dispatch table.
 */
export const PARTIAL_KINDS = {};

const fail = (state, view, reason, detail) => ({ state, view, ok: false, reason, detail: detail ?? null, logs: [] });

/** Merge a patch into one Spirit's note sheet, through the reducer. */
const patchNs = (state, spiritId, patch, rng) =>
  applyAction(state, noteSheetPatched(spiritId, patch), rng);

/**
 * 🎯 WHAT WALKING ONTO A HEX PAYS — the Lost Chord and the Charge Zone.
 *
 * ⚠️ THIS EXISTED ONLY IN REACT UNTIL 2026-08-17, and its absence was the
 * seventh instance of `SEQUENCING.md` §5.A's pattern: the game rewards going
 * somewhere, the headless path pays nothing for arriving, nothing errors, every
 * suite stays green. The reducers (`applyTokenPickedUp`, `applyChargeZoneUsed`)
 * and now the payout kernels (`systems/board.js`) were all in place; only the
 * TRIGGER was missing, exactly like the riff-off.
 *
 * 🎯 THE CONSEQUENCE WORTH NAMING: `evaluate`'s `charge` term is Intergalactic
 * 0's highest weight at **2.2** — §4.2 calls the Boom Box "the whole character"
 * — and until this landed no bench match could ever set it above zero. Every
 * win rate ever quoted for him was a reading of a Spirit with his identity
 * switched off.
 *
 * ⚠️ THE OVERCHARGE MODAL IS NOT MODELLED, deliberately. With `overcharge`
 * unlocked the client asks the player to CHOOSE floor / ceiling / chord assist;
 * a headless seat takes the ordinary 50/50 spark instead of guessing at a
 * preference. Declared in `HARNESS_GAPS` rather than invented here.
 *
 * ⚠️ AND THE STACK-COMMIT BRANCH IS NOT MODELLED EITHER. A picked-up chord can
 * be woven straight into a stack instead of banked, if the turn's revoice budget
 * is unspent. That is a second decision the client raises as a modal, so the
 * headless path always banks — the conservative half, and the one that does not
 * hand a searcher free stack slots it never chose.
 */
function collectPickups(state, spiritId, hexNum, rng) {
  if (hexNum == null) return { state, logs: [] };
  const logs = [];
  let next = state;

  const tok = tokenAt(next, hexNum);
  if (tok) {
    const ns = next.noteStates?.[spiritId] ?? {};
    // 🗡️ The Ronin hears a second note in the same find (~50%). ⚠️ DRAWN HERE,
    // unconditionally ordered before the patch, because the client draws it
    // before its state updater for the same reason — a draw whose position in
    // the stream depends on a branch is a replay divergence waiting to happen.
    const greed = spiritId === 'cosmic_ronin' && rng ? rng.chance(0.5) : false;
    const extra = greed
      ? randomNote(ns.rootNote, ns.scaleMode, () => rng())
      : null;
    const { noteStock } = bankLostChord(ns.noteStock, usedList(ns.usedStockIdx), tok.note, extra);
    next = applyAction(next, tokenPickedUp(spiritId, hexNum), rng);
    next = patchNs(next, spiritId, { noteStock }, rng);
    logs.push(`🎵 Lost Chord (${tok.note}) picked up on #${hexNum}`);
    if (extra) logs.push(`🗡️ a second note (${extra}) came with it`);
  }

  const zone = liveChargeZoneAt(next, hexNum);
  if (zone) {
    const ns = next.noteStates?.[spiritId] ?? {};
    const { patch, kind } = chargeSparkPatch(ns, rng ? rng() : 0, CHARGE_ZONE_BOOST_TURNS);
    next = applyAction(next, chargeZoneUsed(spiritId, hexNum), rng);
    next = patchNs(next, spiritId, patch, rng);
    logs.push(`⚡ Charge Zone tapped on #${hexNum} — ${kind}`);
  }

  return { state: next, logs };
}

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
      // §1's spine, both halves of it. The melody you wrote becomes the AP you
      // act with — AND the Db, the flair, the crowd and the bank it earned.
      //
      // ⚠️ ORDER MATTERS TWICE OVER. The economy is computed FIRST, off the
      // pre-commit sheet, because it reads `melodyLine` and the kernel's own
      // patch clears it. And `hexes` comes from the kernel rather than being
      // re-derived here: the mic skill's voice roll can append a note the player
      // never placed, so `melodyLine.length` at this point is the WRONG number.
      const commit = commitMelodyEconomy(state, spiritId, { rng, view });
      if (!commit.ok) return fail(state, view, 'illegal', commit.reason);

      let next = patchNs(state, spiritId, commit.patch, rng);
      let logs = [...commit.logs];
      let nextView = view;

      // Walk the ordered effects. ⚠️ DO NOT REORDER — the riff's Fame is
      // multiplied by the crowd, so it must see the fans this commit already won
      // and not the cadence fans that land after it.
      for (const fx of commit.effects) {
        if (fx.type === 'fans') {
          next = applyAction(next, fansChanged(fx.spiritId, fx.fans), rng);
        } else if (fx.type === 'fame') {
          // Through `battleFlow.grantFame` so the 4/turn cap, the crowd
          // multiplier and the Rock God gate all apply in exactly one place.
          const run = runBattleFlow(
            grantFame({ state: next, spiritId: fx.spiritId, fp: fx.fp, reason: fx.reason,
                        fameThisTurn: nextView.fameThisTurn ?? {} }),
            next,
            { applyAction: (s, a) => applyAction(s, a, rng), hooks },
          );
          next = run.state;
          logs = logs.concat(run.logs);
          if (run.result?.fameThisTurn) nextView = { ...nextView, fameThisTurn: run.result.fameThisTurn };
        } else if (fx.type === 'unsurePool') {
          // The undecided crowd is client state; hand back the delta rather than
          // inventing a slice for it.
          nextView = { ...nextView, unsurePool: Math.max(0, (nextView.unsurePool ?? 0) + fx.delta) };
        }
      }

      // `tripped` halves the grant (min 1) inside the reducer — not re-derived here.
      next = applyAction(next, moveBudgetSet(commit.hexes, !!ns.tripped), rng);

      return {
        state: next, view: nextView, ok: true, reason: null,
        report: commit.report, flashLines: commit.flashLines, logs,
      };
    }

    // ── BOARD ──────────────────────────────────────────────────────────────
    // NOTE: `applyMoveStep` spends the AP itself AND re-faces the Spirit down
    // the direction of travel. No separate beatsSpent, and no separate face —
    // walking IS a facing decision, which is why a bot that steps toward a
    // rival is also turning its back on whatever is behind it.
    case 'move': {
      let next = applyAction(state, moveStep(spiritId, action.to, !!ns.dazed), rng);
      // ⚠️ WHERE HE ACTUALLY LANDED, NOT WHERE HE AIMED. The Dazed rule can
      // redirect a step to a different neighbour, so reading `action.to` here
      // would collect a token off a hex nobody is standing on.
      const landedOn = (next.spirits ?? []).find(s => s.id === spiritId)?.num ?? null;
      const { state: picked, logs } = collectPickups(next, spiritId, landedOn, rng);
      return { state: picked, view, ok: true, reason: null, logs };
    }

    // 🔊 GOES TO 11 — the dial, the Sustain stack, and the amp, in one action.
    // Everything downstream reads it off the sheet: `attackParams` SETS the
    // attack stat, `rigFor` reports him out-of-rig, and `battleFlow.knockback`
    // refuses to move him. Nothing here needs to know any of that.
    case 'eleven':
      return {
        state: applyAction(state, elevenCalled(spiritId), rng),
        view, ok: true, reason: null, logs: [],
      };

    // 🧪 SLIME — call the ooze; the road is then laid by `applyMoveStep` itself
    // on every hex he vacates while it is on. Nothing to do here beyond the
    // call, and that is the payoff of moving the drop into the reducer: a line
    // like [slime, move, move, move, tentacle] is now reachable to a searcher,
    // where before it could only ever spend road that already existed.
    case 'slime':
      return {
        state: applyAction(state, slimeCalled(spiritId), rng),
        view, ok: true, reason: null, logs: [],
      };

    // 🧪 THE SLIDE — free retreat along his own trail, spending the slime.
    // ⚠️ Unlike `move` this does NOT re-face him: `isRearHit` reads facing on
    // DEFENCE, so a re-facing retreat would turn his back on the thing he just
    // disengaged from and punish the escape it exists to be. Both trail
    // abilities decline the re-face walking gives you.
    case 'slide':
      return {
        state: applyAction(state, spiritSlid(spiritId, action.to), rng),
        view, ok: true, reason: null, logs: [],
      };

    case 'face':
      return {
        state: applyAction(state, spiritFaced(spiritId, action.facing), rng),
        view, ok: true, reason: null, logs: [],
      };

    // ── VIOLENCE ───────────────────────────────────────────────────────────
    // 🐙 The Tentacle is a Swing with a different ORIGIN and a different bill.
    // It rolls as a swing — same 1 AP, same action token, same cone, same dice —
    // so it deliberately falls through into the case below rather than growing a
    // second combat path. What is bespoke is the payment, and it is paid FIRST:
    // the road is spent whether or not the blow lands, because you used the road
    // to throw the punch (§4a). Paying on hit would make a whiffed reach free,
    // and free reach is the one thing this ability must never be.
    case 'tentacle':
    case 'swing':
    case 'sonic': {
      const isTentacle = kind === 'tentacle';
      const rollKind   = isTentacle ? 'swing' : kind;

      // ⚠️ THE TRAIL IS SPENT BEFORE ANYTHING ELSE — and before `attackParams`,
      // so the stats are derived off the board the blow actually lands on.
      let pre = state;
      if (isTentacle) pre = applyAction(pre, slimeCleared(spiritId, action.spend ?? []), rng);

      const params = attackParams(pre, spiritId, action.targetId, rollKind, view);
      if (!params) return fail(state, view, 'illegal', 'attacker or defender not on the board');
      const { _derived, ...rollOpts } = params;

      // Pay first, exactly as the client does: AP off the shared pool, and the
      // Action Token — the one-attack-per-turn rule (§6a).
      let next = applyAction(pre, beatsSpent(rollKind === 'swing' ? SWING_AP_COST : SONIC_AP_COST, true), rng);

      // ⚠️ The exposure is consumed by being READ. `attackParams` cannot clear
      // it (it is pure), so the clear happens here — miss it and the rival's
      // armour stays switched off for the rest of the match.
      if (_derived.consumedSmashExposed) {
        next = patchNs(next, action.targetId, { smashExposed: false }, rng);
      }

      // 🎸 WHAT THE ATTACK COSTS THE ATTACKER. Both halves were MISSING until
      // 2026-08-17, which made every headless attack free and every bench win
      // rate a reading of a game nobody plays. §6.6.0 diagnosed a bot that
      // "sees every cost of hitting them perfectly well" — it saw none of them.
      //
      // ⚠️ THE TWO KINDS PAY DIFFERENTLY AND THE DIFFERENCE IS THE RULE, not a
      // detail. Collapsing them into one branch is the trap:
      //
      //   · SONIC spends 1 Drive note HIT OR MISS, because the note left the rig
      //     the moment it was projected. It is paid HERE — after `attackParams`
      //     has derived the chord off the FULL stack, before the roll. Pay it
      //     earlier and the beam fires weaker than the one the player throws.
      //   · SWING spends 2 Drive notes ON A HIT ONLY (whiffing keeps the stack),
      //     so its spend is a CONSEQUENCE and rides `swingChordSpent` into
      //     `battleConsequences`. Nothing to do here but take the guard down.
      //
      // 🥊 `swingExposed` is UNCONDITIONAL and it is the attacker's, not the
      // defender's: committing to melee drops your guard for −1 Sustain until
      // your next turn, whether or not the blow lands. Ranged Sonic keeps you
      // safe. `attackParams` reads this flag on the DEFENDER, so an evaluator
      // that never sets it on the attacker prices melee as risk-free and
      // over-rates it — exactly the direction §7 warns about.
      if (rollKind === 'sonic') {
        const stack = pre?.noteStates?.[spiritId]?.driveStack ?? [];
        if (stack.length) {
          next = patchNs(next, spiritId, { driveStack: stack.slice(SONIC_DRIVE_SPEND) }, rng);
        }
      } else {
        next = patchNs(next, spiritId, { swingExposed: true }, rng);
      }

      next = applyAction(next, attackRolled(rollKind, spiritId, action.targetId, rollOpts), rng);
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
    // ═══════════════════════════════════════════════════════════════════════
    // 🎤 THE RIFF-OFF — the duel a Sonic becomes when both beams cross.
    // ═══════════════════════════════════════════════════════════════════════
    //
    // ⚠️ THE TRIGGER WAS THE ONLY MISSING PIECE, and it had been missing since
    // the duel was built. `applyRiffOffStarted`, `applyRiffResolved`,
    // `applyRiffRound2Started` and `applyRiffClosed` have all been engine
    // reducers for a long time and they are correct; `startRiffOff` lived in the
    // monolith, so `legalActions` had nothing to transcribe, so the kind did not
    // exist, so **no bench match in this repo's history has contained a duel** —
    // against Alex's expectation of several per game and the biggest Fame payout
    // in the rules. The seventh sighting of `SEQUENCING.md` §5.A's pattern.
    //
    // ⚠️ THE PERFORMANCE IS MODELLED, THE RULES ARE NOT. Both charts come out of
    // the engine exactly as they do online; the two RESULTS arrays come from
    // `simulateRiffPerformance`, whose single assumption — a Spirit plays the
    // duel as well as they played their last melody — is stated and defended in
    // `riffOff.js`. Read that before quoting any riff-off number out of a bench.
    //
    // ⚡ ROUND 2 IS DRIVEN HERE — 2026-08-18. `applyRiffResolved` sets
    // `verdict.close` when the two sets were within `RIFF_CLOSE_QUALITY_GAP`
    // (or dead-heated), and that flag is the client's escalation gate verbatim:
    // `fireBeamClash` breaks the beams on `!tie && !close` and otherwise surges
    // into sudden death, capped at two rounds.
    //
    // ⚠️ IGNORING IT WAS NOT "A SLIGHTLY CHEAPER DUEL", WHICH IS WHY IT MOVED.
    // Sudden death adds `RIFF_R2_BONUS` (2 FP) and a damage band to the winner,
    // and it is the ONLY path to the both-paid consolation — `bothStrong`
    // requires `round >= 2` by construction. A headless riff-off that stopped at
    // Round 1 therefore ran a different Fame economy from the shipped game, and
    // it was the closest duels — the ones the design cares most about — that it
    // dropped. Eighth sighting of `SEQUENCING.md` §5.A's pattern: the reward
    // existed, the flag that unlocks it was computed, and nothing headless read
    // it back.
    //
    // 📌 What is still modelled rather than played: Round 2's chart runs at
    // 0.58× the gaps and `simulateRiffPerformance` has no tempo term, so both
    // sides play sudden death at Round-1 difficulty. Declared as
    // `HARNESS_GAPS.riffRound2Speed` rather than corrected with a number nobody
    // measured.
    case 'riffOff': {
      const target = (state.spirits ?? []).find(sp => sp.id === action.targetId);
      if (!target) return fail(state, view, 'illegal', 'no such rival');

      // The same price as the Sonic it replaces: 2 AP and the Action Token.
      let next = applyAction(state, beatsSpent(SONIC_AP_COST, true), rng);

      // ⚡ A riff-off is still a battle, so charges burn off on both sides —
      // §3.5's "a charge dies on any battle, win or lose". Missing this would
      // make the duel the one safe place to spend a charge you kept.
      for (const id of [spiritId, action.targetId]) {
        next = patchNs(next, id, { chargeFloorTurns: 0, chargeCeilTurns: 0 }, rng);
      }

      // The attacker calls with their own committed melody where they have one
      // (Phase R1's Rhythm Creation Device); the engine pads or falls back.
      next = applyRiffOffStarted(next, {
        attackerId: spiritId, defenderId: action.targetId,
        slayer: false, eRush: false,
        melodyLine: ns.committedMelody ?? null,
      }, rng);

      const b = next.battle;
      if (b?.kind !== 'riffOff') return fail(state, view, 'illegal', 'duel would not start');

      const atkPerf = ns.perfScore ?? 0;
      const defPerf = next.noteStates?.[action.targetId]?.perfScore ?? 0;

      // One round, played and judged. ⚠️ It re-reads `st.battle` rather than
      // closing over `b`: Round 2 REPLACES both charts (and their lengths — the
      // R1 chart carries chord partners the R2 one has not grown yet), so a
      // helper that remembered Round 1's note counts would submit results arrays
      // of the wrong length and `riffStats` would score gems that do not exist.
      const playRound = (st) => {
        const chart = st.battle;
        st = applyRiffResultsSubmitted(st, {
          role: 'attacker',
          results: simulateRiffPerformance(chart.atkRiff?.degrees?.length ?? 0, atkPerf, rng),
        });
        st = applyRiffResultsSubmitted(st, {
          role: 'defender',
          results: simulateRiffPerformance(chart.defRiff?.degrees?.length ?? 0, defPerf, rng),
        });
        return applyRiffResolved(st);
      };

      next = playRound(next);
      let verdict = next.battle?.verdict;
      if (!verdict) return fail(state, view, 'illegal', 'duel produced no verdict');

      // ⚡ THE BEAMS LOCK AND SURGE. Escalate at most once — `round >= 2` is the
      // client's cap too, and `applyRiffResolved` leans on it: a Round-2 dead
      // heat falls back to the Round-1 edge rather than looping forever looking
      // for a winner. `applyRiffRound2Started` keeps `r1` for exactly that.
      if (verdict.close && (next.battle?.round ?? 1) < 2) {
        next = applyRiffRound2Started(next, null, rng);
        if (next.battle?.round !== 2) return fail(state, view, 'illegal', 'sudden death would not start');
        next = playRound(next);
        verdict = next.battle?.verdict;
        if (!verdict) return fail(state, view, 'illegal', 'sudden death produced no verdict');
      }

      const run = runBattleFlow(
        riffOffConsequences({
          state: next, battle: next.battle, verdict,
          amps: view.amps ?? [],
          fameThisTurn: view.fameThisTurn ?? {},
        }),
        next,
        { applyAction: (st, a) => applyAction(st, a, rng), hooks },
      );

      // ⚠️ CLEAR THE BATTLE SLICE. `battle` is a live-duel marker the rest of the
      // engine reads; leaving it set would have every later action in the turn
      // think a duel is still on the board.
      return {
        state: applyRiffClosed(run.state), view, ok: true, reason: null,
        logs: run.logs, battle: next.battle,
      };
    }

    case 'pose':
      // 🎤 Opening a pose is free and it is a COMMITMENT, not a tap: the FP tick
      // and the Sustain toll land at `endTurn` below, and until then the Spirit
      // is standing in the middle with no defence die at all.
      //
      // ⚠️ THE FLAG USED TO LIVE IN `view` AND THAT IS WHY IT PAID NOTHING.
      // See systems/limelight.js — a searcher could set it, and no rule
      // anywhere downstream could read it back.
      return {
        state: applyAction(state, posed(spiritId, true), rng),
        view, ok: true, reason: null, logs: [],
      };

    // 🎯 CHOOSING WHAT TO SAVE FOR — free, and it does NOT grant the skill.
    //
    // ⚠️ THIS CASE USED TO BE A SHOP (`skillUnlock`): subtract the cost, push the
    // id into `unlockedSkills`. That is not how this game unlocks anything, and
    // it is exactly the invented rule this file's header says is worse than a
    // declared gap — the searcher was "confidently wrong" rather than blind. The
    // real award happens inside `commitMelodyEconomy` when the Db bar fills, and
    // its state half is already modelled there, so nothing needs granting here.
    //
    // ⚠️ `upgradesPending` AND `pendingAwardSkillId` ARE CLEARED, mirroring the
    // client's own target-pick patch. Leaving a stale pending award behind would
    // let a searcher re-collect a skill it already banked by re-aiming.
    case 'skillTarget':
      return {
        state: patchNs(state, spiritId, {
          targetSkillId:       action.skillId,
          pendingAwardSkillId: null,
          upgradesPending:     0,
        }, rng),
        view, ok: true, reason: null, logs: [],
      };

    case 'endTurn': {
      // ✨ THE LIMELIGHT FAUCET, DRIVEN HEADLESSLY FOR THE FIRST TIME (§6.6.8).
      //
      // Order is the client's, and it is load-bearing rather than incidental:
      // `turnEnded` is what DECIDES `limelightHeld` (started AND ended the turn
      // on hex 56 — only the turn reducer knows both ends), so the payout can
      // only be settled after it. ⚠️ And `turnEnded` rotates `state.acting`, so
      // the Spirit being paid must be read BEFORE the dispatch, never after.
      const posingId = spiritId;
      const next = applyAction(state, turnEnded(), rng);
      if (!next.turn?.lastReport?.limelightHeld) {
        return { state: next, view, ok: true, reason: null, logs: [] };
      }

      const run = runBattleFlow(
        poseConsequences({
          state: next, spiritId: posingId, fameThisTurn: view.fameThisTurn ?? {},
        }),
        next,
        { applyAction: (st, a) => applyAction(st, a, rng), hooks },
      );
      // The pose is billed against the window of the turn that just ENDED — it
      // is the payout for having held the middle through it — so the grant goes
      // through the same `fameThisTurn` cap as everything else that turn.
      const nextView = run.result?.fameThisTurn
        ? { ...view, fameThisTurn: run.result.fameThisTurn }
        : view;
      return { state: run.state, view: nextView, ok: true, reason: null, logs: run.logs };
    }

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
