// ─── ENGINE SYSTEM: THE WELLSPRING (the centre hex) ──────────────────────────
// Alex, 2026-10-16: *"the middle [should] pulse 'from within' … as if it is
// releasing ancient sonic energy. Spirits will use this spot to 'tap into' their
// special powers (slight bonuses which will be built out later - for now,
// Ronin's is the 5th AP - normal characters, including him will start with the 4
// AP - he can get the 5th for 2 following turns if he steps onto the spot during
// his turn)"*.
//
// The hex is the old Limelight (`LIMELIGHT_HEX`, 56). The pose economy on it is
// untouched; this is a SECOND thing the middle does, and it is per-Spirit.
//
// THE RULE, as built:
//   · Every Spirit's AP ceiling is its `speed`, and every Spirit is 4 now
//     (`data/spirits.js`). AP is still `min(notes committed, ceiling)` —
//     `melodyCommit.js` is the one place the grant happens.
//   · A Spirit with a TAP (`WELL_TAPS`) that steps onto the centre DURING ITS OWN
//     TURN is charged for `turns` of its following turns. Each of its turns that
//     starts while charged is LIVE: the tap applies for that whole turn.
//   · Stepping on again refreshes the charge to `turns`. It never stacks — the
//     Ronin's ceiling is 5, not 6, however often he passes through.
//   · ⚠️ STANDING on it is not stepping onto it. A Spirit who starts a turn on
//     the centre and stays put earns nothing; step off and back on and it does.
//
// ⚠️ "DURING HIS TURN" IS `state.acting`, NOT "whoever moved". A Sonic push or a
// rival's shove that lands him on the centre is not him tapping in — and the
// check sits in ONE place (`collectWellTaps`, run by `applyAction` after every
// movement action) so a new way to move cannot forget it.
//
// 📌 A tap is "built out later" for everyone else (Alex). `WELL_TAPS` is the
// table: add a row and a `kind`, and teach `apCeilingFor` (or a sibling reader)
// what the kind does. Spirits with no row light the well up and get nothing.
//
// Rules for this file: plain JSON, no rng, no React.

import { LIMELIGHT_HEX } from "../../data/gameConstants.js";
import { characterId } from "../../data/spiritIdentity.js";

/** The centre hex. One number, shared with the Limelight on purpose. */
export const WELL_HEX = LIMELIGHT_HEX;

/** The AP every Spirit starts with (Alex, 2026-10-16). `data/spirits.js` speeds match it. */
export const BASE_AP = 4;

/** ⚠️ The hard ceiling `melodyCommit.js` already enforces (`SPEED_CAP`). A tap
 *  that would pass it is clipped, not refused. Kept here as a number rather than
 *  imported so this file stays a leaf (melodyCommit imports from here). */
const AP_HARD_CAP = 5;

/**
 * What each Spirit draws from the well. `turns` = how many of its FOLLOWING
 * turns the tap lasts. 📌 Only the Ronin has one today; the others are "built
 * out later".
 */
export const WELL_TAPS = Object.freeze({
  cosmic_ronin: Object.freeze({ kind: 'ap', amount: 1, turns: 2, label: '5th AP' }),
});

/** The empty slice — `state.js` and any migration agree on the shape.
 *  `charge[id]` = following turns still to come; `live[id]` = the tap is on THIS turn. */
export function makeWellState() {
  return { charge: {}, live: {}, lastTap: null };
}

export const wellTapFor = spiritId => WELL_TAPS[characterId(spiritId)] ?? null;

const slice = state => state?.well ?? makeWellState();

/** Is this Spirit's tap on for the turn it is playing? */
export function isWellLive(state, spiritId) {
  return !!slice(state).live?.[spiritId];
}

/** Turns of charge still banked (not counting a live turn in progress). */
export function wellChargeOf(state, spiritId) {
  return slice(state).charge?.[spiritId] ?? 0;
}

/**
 * The AP ceiling for a commit: the Spirit's speed, plus a live 'ap' tap, under
 * the hard cap. ⭐ EVERY reader of "how many hexes can this commit buy" asks
 * this — the kernel, the legal-action list, the play finder, the evaluator, the
 * client's commit label and the Spirit sheet. Five transcriptions of the old
 * `Math.min(5, speed)` was how a +1 could reach the HUD and not the grant.
 *
 * `spirit` is optional: pass the live spirit object when you have it (a test
 * fixture's `speed` wins over the roster's, as it always has).
 */
export function apCeilingFor(state, spiritId, spirit = null) {
  const sp = spirit ?? state?.spirits?.find(s => s.id === spiritId);
  // ⚠️ NOT `SPIRIT_DEFS[…].speed` as the fallback: `data/spirits.js` imports the
  // standee PNGs, and this file is in `state.js`'s import graph — reaching for
  // the roster here broke every suite that runs without the asset stub
  // (`test:sandbox`, 2026-10-16). Every live spirit carries its `speed` (seated
  // from the roster), and `wellspringCheck` §1 pins every roster speed to BASE_AP,
  // so the fallback cannot drift from the roster.
  const base = sp?.speed ?? BASE_AP;
  const tap = wellTapFor(spiritId);
  const bonus = tap?.kind === 'ap' && isWellLive(state, spiritId) ? tap.amount : 0;
  return Math.min(AP_HARD_CAP, base + bonus);
}

/**
 * TURN_STARTED, for the Spirit whose turn it is: spend one turn of charge into a
 * LIVE turn, or go dark. Run by `applyAction` after `applyTurnStarted`.
 */
export function wakeWell(state, spiritId) {
  const w = slice(state);
  const charge = w.charge?.[spiritId] ?? 0;
  const live = charge > 0;
  if (!live && !w.live?.[spiritId] && !(spiritId in (w.charge ?? {}))) return state;
  return {
    ...state,
    well: {
      ...w,
      charge: { ...w.charge, [spiritId]: Math.max(0, charge - 1) },
      live: { ...w.live, [spiritId]: live },
    },
  };
}

/**
 * TURN_ENDED / TURN_SKIPPED: the turn that was live is over. Cleared here rather
 * than left for the next TURN_STARTED so nothing read BETWEEN his turns (the
 * Spirit sheet, the evaluator pricing a rival's turn) sees a tap still on.
 */
export function sleepWell(state, spiritId) {
  const w = slice(state);
  if (!spiritId || !w.live?.[spiritId]) return state;
  return { ...state, well: { ...w, live: { ...w.live, [spiritId]: false } } };
}

/**
 * The tap itself: `spiritId` just stepped onto the centre during its own turn.
 * Charges it for its following turns and writes `lastTap` — the report the
 * client reads for its log line and flash (`turn` + `seq` make it a fresh key
 * even when the same Spirit taps twice in one turn).
 */
export function applyWellTapped(state, spiritId) {
  const tap = wellTapFor(spiritId);
  const w = slice(state);
  const seq = (w.lastTap?.seq ?? 0) + 1;
  const report = { spiritId, turn: state.turn?.count ?? 0, seq, kind: tap?.kind ?? null,
    amount: tap?.amount ?? 0, turns: tap?.turns ?? 0, label: tap?.label ?? null };
  return {
    ...state,
    well: {
      ...w,
      ...(tap ? { charge: { ...w.charge, [spiritId]: tap.turns } } : {}),
      lastTap: report,
    },
  };
}

/**
 * Run after every movement action (`applyAction`): did the ACTING Spirit just
 * arrive on the centre? `prev` is the state before the action, `next` after.
 * ⚠️ Arrive = was elsewhere before, is on it now. A hop that sails over the
 * centre lands somewhere else and does not count; a walk that passes THROUGH it
 * does (each step is its own action).
 */
export function collectWellTaps(prev, next) {
  const id = next.acting;
  if (!id) return next;
  const before = prev.spirits?.find(s => s.id === id)?.num;
  const after = next.spirits?.find(s => s.id === id)?.num;
  if (after !== WELL_HEX || before === WELL_HEX) return next;
  return applyWellTapped(next, id);
}
