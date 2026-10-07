// ─── ENGINE SYSTEM: THE OPENING ACT — the first-turn entrance ────────────────
// Alex, 2026-10-04 (rule) and 2026-10-06 (where they wait):
//   *"Spirits wait there with no fans. On each Spirit's first turn, it plays its
//   existing picker riff, steps onto its original home hex, and gains exactly
//   two fans."* — so that a player who has already built Drive/Sustain cannot
//   attack a Spirit who has not started.
//   *"those players whose turn hasn't come up yet aren't even technically on the
//   board yet … placed in the spot in between the previous 'home hex' and the
//   fan's seats … a space not technically on the board."*
//   And the home hex is RESERVED until its Spirit enters (his ruling, same day).
//
// ⭐ ONE ENTRANCE STATE, AND IT IS `spirit.entrance`. While it is set the Spirit
// is WAITING: `num` is null (off the board, exactly like the abyss — so every
// rule that finds a body by hex finds nothing there), it holds no fans, and its
// home hex is a wall to everybody else (`entranceHexes`). TURN_STARTED clears
// it — the client, the headless harness and the bench all reach the turn start
// through that one action, so there is no second place an entrance can happen.
//
// ⚠️ NULL `num` IS THE PROTECTION, NOT A DETAIL. A waiting Spirit carrying its
// home hex in `num` behind a `waiting` flag would be targetable by every path
// that forgot to read the flag — and there are dozens. With `num` null a path
// that forgot fails CLOSED: it finds no one to hit. The paths that MOVE a body
// are the ones that must read `entranceHexes`, and there are few of them.
//
// 📌 OPT-IN PER MATCH (`config.openingAct`). The lobby turns it on for normal
// matches, local and online. Testing Grounds, old saves, replays and the bench
// fixtures that predate it keep starting every Spirit on its home hex with its
// two Diehards — byte-for-byte the game they were recorded in.
//
// 📌 THE GEOMETRY OF THE WAITING PAD IS PRESENTATION and lives in
// `board/openingAct.js`. The reducer only knows "off the board".

import { cornerFacing } from '../../board/boardHelpers.js';
import { FAN_DIEHARD_START } from '../../data/gameConstants.js';

/** Fans a Spirit gains when it steps on stage — the Diehards every seat used
 *  to START with, so a match with the opening act still ends turn one of each
 *  Spirit on the crowd it always had. */
export const ENTRANCE_FANS = FAN_DIEHARD_START;

/** Is this Spirit still waiting off the board for its first turn? */
export const isWaiting = sp => !!sp?.entrance;

/** Does this match use the opening act? Testing Grounds never does. */
export function openingActOn(gameConfig) {
  return gameConfig?.openingAct === true && !gameConfig?.testMode;
}

/** The home hex a Spirit enters on (waiting) or started on (everyone else). */
export const homeHexOf = sp => sp?.entrance?.homeNum ?? sp?.num ?? null;

/**
 * 🧱 The reserved hexes: the home hex of every Spirit still waiting. Nobody may
 * walk, hop, slide, warp or be shoved onto one — it acts as a wall until its
 * owner enters. Takes the spirits ARRAY so a caller holding a spirits list (the
 * client, `bushidoBlockers`) and one holding a whole state ask the same thing.
 */
export function entranceHexes(spirits = []) {
  const out = new Set();
  for (const sp of spirits ?? []) if (sp?.entrance && sp.entrance.homeNum != null) out.add(sp.entrance.homeNum);
  return out;
}

/** True if `num` is a reserved home hex in this state. */
export function isEntranceHex(state, num) {
  return num != null && entranceHexes(state?.spirits).has(num);
}

/** Seat a Spirit OFF the board, waiting on its pad. Pure. */
export function seatWaiting(sp) {
  return { ...sp, num: null, entrance: { homeNum: sp.num, facing: sp.facing ?? cornerFacing(sp.num) } };
}

/**
 * 🎸 THE ENTRANCE. Steps a waiting Spirit onto its home hex, faces it the way
 * its corner faces, and grants exactly `ENTRANCE_FANS` Diehards. A Spirit that
 * is not waiting is returned untouched — that is what makes it exactly-once:
 * the grant and the flag are cleared in the same object, so a second call (a
 * re-dispatched TURN_STARTED, the sandbox's PLAY AS, a replay) has nothing to do.
 *
 * Writes `turn.lastEntrance` for the client's theatre (riff, hop, fans).
 *
 * ⚠️ `contested` is a TRIPWIRE, not a rule. The home hex is reserved, so nothing
 * should be standing there; if a path that moves bodies forgot to read
 * `entranceHexes`, this records who was there instead of inventing a shove or a
 * delay (the handoff forbids both). `entranceCheck.mjs` asserts it never fires.
 */
export function applySpiritEntered(state, { spiritId }) {
  const sp = state.spirits.find(s => s.id === spiritId);
  if (!sp?.entrance) return state;
  const { homeNum, facing } = sp.entrance;
  const occupant = state.spirits.find(s => s.id !== spiritId && !s.knockedOut && s.num === homeNum);
  const ns = state.noteStates?.[spiritId];
  return {
    ...state,
    spirits: state.spirits.map(s => s.id === spiritId
      ? { ...s, num: homeNum, facing: facing ?? cornerFacing(homeNum), entrance: null } : s),
    ...(ns ? { noteStates: { ...state.noteStates,
      [spiritId]: { ...ns, diehards: (ns.diehards ?? 0) + ENTRANCE_FANS } } } : {}),
    turn: { ...state.turn,
      lastEntrance: { spiritId, homeNum, fans: ENTRANCE_FANS, count: state.turn?.count ?? 0,
        ...(occupant ? { contested: occupant.id } : {}) } },
  };
}

/** Seat every Spirit waiting and empty its crowd. Used by `makeInitialState`. */
export function openingActSeats(spirits, noteStates) {
  const seated = spirits.map(seatWaiting);
  const sheets = {};
  for (const [id, ns] of Object.entries(noteStates)) sheets[id] = { ...ns, diehards: 0 };
  return { spirits: seated, noteStates: sheets };
}
