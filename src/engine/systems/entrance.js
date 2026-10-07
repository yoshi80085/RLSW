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
import { CORNERS } from '../../data/corners.js';
import { HEX_BY_NUM, HEX_BY_QR } from '../../board/hexMap.js';
import { axialNeighbors } from '../../board/hexGeometry.js';
import { isPosing, applyPoseSet } from './limelight.js';

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
  const { homeNum, facing, ringOut = null } = sp.entrance;
  // 🔊 A ring-out comes back with the crowd it had — the two Diehards are the
  // opening act's once-a-match gift (`entrance.fans` 0, written by `applyRingOut`).
  const fans = sp.entrance.fans ?? ENTRANCE_FANS;
  const occupied = num => state.spirits.some(s => s.id !== spiritId && !s.knockedOut && s.num === num);
  const occupant = state.spirits.find(s => s.id !== spiritId && !s.knockedOut && s.num === homeNum);
  // 🔊 Unlike the opening act, a ring-out's home hex was NOT reserved all match:
  // someone may have been standing on it when he went off. He lands on the
  // nearest free hex instead (never a shove, never a wait).
  const landNum = ringOut != null && occupant ? (nearestFreeHex(state, homeNum, spiritId) ?? homeNum) : homeNum;
  const ns = state.noteStates?.[spiritId];
  return {
    ...state,
    spirits: state.spirits.map(s => s.id === spiritId
      ? { ...s, num: landNum, facing: facing ?? cornerFacing(homeNum), entrance: null } : s),
    ...(ns && fans ? { noteStates: { ...state.noteStates,
      [spiritId]: { ...ns, diehards: (ns.diehards ?? 0) + fans } } } : {}),
    turn: { ...state.turn,
      lastEntrance: { spiritId, homeNum:landNum, fans, count: state.turn?.count ?? 0,
        ...(ringOut != null ? { ringOut } : {}),
        ...(occupied(landNum) ? { contested: occupant?.id ?? true } : {}) } },
  };
}

/** The free hex nearest `num` (rings outward): no live body, not reserved. */
function nearestFreeHex(state, num, selfId) {
  const start = HEX_BY_NUM[num];
  if (!start) return null;
  const reserved = entranceHexes(state.spirits);
  const taken = n => reserved.has(n) || state.spirits.some(s => s.id !== selfId && !s.knockedOut && s.num === n);
  const seen = new Set([num]), queue = [start];
  while (queue.length) {
    const h = queue.shift();
    if (!taken(h.num)) return h.num;
    for (const { q, r } of axialNeighbors(h.q, h.r)) {
      const n = HEX_BY_QR[`${q},${r}`];
      if (n && !seen.has(n.num)) { seen.add(n.num); queue.push(n); }
    }
  }
  return null;
}

/**
 * 🔊 RING-OUT (Alex, 2026-10-07: *"The player that gets knocked off can come
 * back exactly the way they come in - get beamed down into their 'safe' spot on
 * the board"*). Blasted off the stage, the Spirit goes back to WAITING on its
 * pad — `num` null, its home hex reserved — and steps on again at its own next
 * TURN_STARTED, exactly as it first entered (`applySpiritEntered`). Costs what
 * a knockdown costs (a life, Vibe back to full — Alex: "A Ring out is the same as
 * a Knock Out"), no notes, no fans; the FP drain and the attacker's bonus are
 * `battleFlow.knockback`'s. A pose ends (he left the hex).
 * `entrance.ringOut` is a running count, so every return is a fresh entrance
 * the client can tell apart from the last one.
 */
export function applyRingOut(state, { spiritId }) {
  const sp = state.spirits.find(s => s.id === spiritId);
  if (!sp || sp.knockedOut || sp.entrance) return state;
  const homeNum = (sp.corner ? CORNERS[sp.corner]?.homeNum : null) ?? sp.num;
  const ringOut = (sp.ringOuts ?? 0) + 1;
  // 🔊 "A Ring out is the same as a Knock Out" (Alex, 2026-10-07): a life (when
  // the match spends them), Vibe restored, and it counts as a knockdown. The
  // last-life case never gets here — `battleFlow.knockback` eliminates instead.
  const elimination = state.config?.elimination !== 'off';
  const lives = elimination ? Math.max(0, (sp.lives ?? 1) - 1) : sp.lives;
  const dropped = isPosing(state, spiritId) ? applyPoseSet(state, { spiritId, on: false }) : state;
  return {
    ...dropped,
    spirits: dropped.spirits.map(s => s.id === spiritId ? { ...s, num: null, ringOuts: ringOut, abyssPending: null,
      lives, vibe: s.maxVibe ?? s.vibe, knockdownCount: (s.knockdownCount ?? 0) + 1,
      entrance: { homeNum, facing: cornerFacing(homeNum), fans: 0, ringOut } } : s),
  };
}

/** Was this Spirit blasted off (as opposed to waiting for its first turn)? */
export const isRingedOut = sp => sp?.entrance?.ringOut != null;

/** Seat every Spirit waiting and empty its crowd. Used by `makeInitialState`. */
export function openingActSeats(spirits, noteStates) {
  const seated = spirits.map(seatWaiting);
  const sheets = {};
  for (const [id, ns] of Object.entries(noteStates)) sheets[id] = { ...ns, diehards: 0 };
  return { spirits: seated, noteStates: sheets };
}
