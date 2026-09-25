// ─── ENGINE SYSTEM: SANDBOX (🧪 Testing Grounds only) ─────────────────────────
// Two dev levers that must still be REAL actions, because the Testing Grounds
// keeps the replay guarantee: `💾 EXPORT ACTION LOG` promises that the log,
// replayed through `applyAction`, reproduces the match. A lever that wrote React
// state behind the engine's back would make every exported sandbox log lie.
//
//   SANDBOX_SEAT_TAKEN — "play as": the chosen Spirit becomes the acting one,
//                        mid-turn, without anybody's turn ENDING.
//   SANDBOX_REFILLED   — free play: the acting Spirit's AP, action token,
//                        cooldowns, Db and kit are topped back up.
//
// ⚠️ NEITHER IS A GAME RULE. Nothing outside the Testing Grounds may dispatch
// them — the client gates both on `testMode`, which is itself hard-off online
// (N8). A match that contains either action is a sandbox match by definition.

import { SLIDE_STEPS_PER_TURN } from "../../data/gameConstants.js";
import { abilitiesFor } from "../../data/loadouts.js";
import { ABILITY_CD, dbCostOf } from "./cooldowns.js";

/**
 * How much AP free play keeps the acting Spirit topped up to.
 *
 * 📌 NOT `Infinity` and not 99, on purpose. `moveStepsLeft` is DRAWN: the 3D
 * step pips put one pip per step at the pawn, and the move tiles light every
 * hex reachable inside the budget. 10 is enough for any ability in the game
 * (Bushido, the dearest, is 3) and still draws as a row of pips and a
 * finite glow instead of a board-wide flood — while being well past a normal
 * Spirit's 4–6, so the free-play glow is visibly different from a real turn.
 */
export const SANDBOX_AP = 10;

/**
 * SANDBOX_SEAT_TAKEN — rotate the turn queue so `spiritId` is at its front.
 *
 * ⭐ A ROTATION, NOT A SWAP. Turn order is a ring; rotating it keeps everyone's
 * relative order, so "End turn" after taking control passes to whoever really
 * follows that Spirit — the sandbox never invents a turn order the real game
 * could not have.
 *
 * ⚠️ NO END-OF-TURN TICKS AND NO ROUND. This is not a turn ending — cooldowns
 * do not tick, the road does not age, the round clock does not move. The per-turn
 * budget is zeroed exactly like a fresh turn, and the client then runs the
 * normal turn-START (`startNewTurnNotes`), so the incoming Spirit gets a real
 * refill rather than inheriting the last Spirit's leftover AP.
 *
 * A KO'd or unknown Spirit is refused (state returned unchanged): putting a
 * Spirit that is out of the queue at its front would resurrect it.
 */
export function applySandboxSeatTaken(state, { spiritId }) {
  const i = state.turnQueue.indexOf(spiritId);
  if (i < 0 || state.acting === spiritId) return state;
  const turnQueue = [...state.turnQueue.slice(i), ...state.turnQueue.slice(0, i)];
  return {
    ...state,
    turnQueue,
    acting: spiritId,
    turn: {
      ...state.turn,
      moveStepsLeft: 0,
      slideStepsLeft: 0,
      actionTokenUsed: false,
      slimingId: null,
      lastMove: null,
    },
  };
}

/**
 * SANDBOX_REFILLED — top the acting Spirit back up so every move is on the table.
 *
 * ⭐ REFILL, DON'T BYPASS. Every ability in the client checks its own gates —
 * `canFire`, `actionTokenUsed`, `moveStepsLeft`, the kit list — at a dozen sites
 * in a 16k-line file. Teaching each of them a "free play" exception is a dozen
 * chances to miss one, and a sandbox that takes a different code path from the
 * real game tests the sandbox, not the game. Instead the costs are PAID for
 * real (the same `firePatch`, the same `beatsSpent`) and then handed back, so
 * the move you test is byte-for-byte the move a player makes.
 *
 * What it restores, and only ever UP (never lowers a value a lever raised):
 *   · AP to `SANDBOX_AP`, slide steps to a full turn's worth
 *   · the action token (Sonic / Swing / Smash every click)
 *   · every ability cooldown to 0
 *   · Db to at least the dearest ability in the kit, so any one can fire
 *   · the FULL kit unlocked — not just the two-ability loadout
 *
 * 📌 Writes nothing when nothing is short, so an idle sandbox does not spam
 * the action log with no-op refills.
 */
export function applySandboxRefilled(state, { spiritId, ap = SANDBOX_AP }) {
  const sp = state.spirits.find(s => s.id === spiritId);
  const ns = state.noteStates?.[spiritId];
  if (!sp || !ns) return state;

  const kit = abilitiesFor(sp).map(s => s.id);
  const unlocked = ns.unlockedSkills ?? [];
  const missing = kit.filter(id => !unlocked.includes(id));
  const cd = ns.abilityCd ?? {};
  const cooling = Object.values(cd).some(left => left > 0);
  const needDb = Math.max(0, ...kit.filter(id => ABILITY_CD[id]).map(dbCostOf));
  const db = ns.dbPoints ?? 0;

  const t = state.turn;
  const turnShort = t.moveStepsLeft < ap || t.actionTokenUsed
    || (t.slideStepsLeft ?? 0) < SLIDE_STEPS_PER_TURN;
  const sheetShort = missing.length > 0 || cooling || db < needDb;
  if (!turnShort && !sheetShort) return state;

  return {
    ...state,
    turn: turnShort ? {
      ...t,
      moveStepsLeft: Math.max(t.moveStepsLeft, ap),
      slideStepsLeft: Math.max(t.slideStepsLeft ?? 0, SLIDE_STEPS_PER_TURN),
      actionTokenUsed: false,
    } : t,
    noteStates: sheetShort ? {
      ...state.noteStates,
      [spiritId]: {
        ...ns,
        unlockedSkills: [...unlocked, ...missing],
        abilityCd: Object.fromEntries(Object.keys(cd).map(id => [id, 0])),
        dbPoints: Math.max(db, needDb),
      },
    } : state.noteStates,
  };
}

/**
 * Would a refill change anything right now? The client asks this BEFORE it
 * dispatches, so an idle free-play board logs nothing.
 *
 * ⭐ Defined AS the reducer's own no-op test (identity), not as a second copy of
 * the "what counts as short" rules — two copies of that list is two lists that
 * drift, and a drifted guard means either a refill that never fires or one
 * that fires every render.
 */
export function sandboxNeedsRefill(state, spiritId, ap = SANDBOX_AP) {
  return applySandboxRefilled(state, { spiritId, ap }) !== state;
}
