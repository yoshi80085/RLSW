import { ALL_HEXES, HEX_BY_NUM } from '../../board/hexMap.js';
import { CORNERS } from '../../data/corners.js';
import { cornerFacing } from '../../board/boardHelpers.js';
import { LIMELIGHT_HEX } from '../../data/gameConstants.js';
import { CRUMBLING_ROUNDS, CRUMBLING_HEXES_PER_ROUND, ABYSS_FP_FRACTION } from '../../data/stageEffects.js';
import { applyPoseSet, isPosing } from './limelight.js';

const startingHex = sp => sp.startNum ?? CORNERS[sp.corner]?.homeNum ?? sp.num;

function collapse(state, count, occupied, rng) {
  // Never remove someone's footing, their respawn point, or a rig. Re-read
  // occupied hexes every round: a safe activation is not a safe later collapse.
  const excluded = new Set([
    LIMELIGHT_HEX, ...Object.values(CORNERS).map(c => c.homeNum),
    ...occupied, ...(state.stageFx.crumbling?.hexes ?? []),
    ...state.spirits.flatMap(sp => [sp.num, startingHex(sp)]),
    ...(state.amps ?? []).map(a => a.hexNum),
  ]);
  const pool = ALL_HEXES.filter(h => !excluded.has(h.num)).map(h => h.num);
  const added = [];
  while (added.length < count && pool.length) added.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return added;
}

export function activateCrumbling(state, occupied, rounds, rng) {
  const hexes = collapse(state, CRUMBLING_HEXES_PER_ROUND, occupied, rng);
  return { hexes, added: hexes, showRound: 1, roundsLeft: rounds ?? CRUMBLING_ROUNDS };
}

export function tickCrumbling(state, rng) {
  const show = state.stageFx.crumbling;
  if (!show || show.roundsLeft <= 1) return null;
  const added = collapse(state, CRUMBLING_HEXES_PER_ROUND, [], rng);
  return { ...show, hexes: [...show.hexes, ...added], added,
    showRound: show.showRound + 1, roundsLeft: show.roundsLeft - 1 };
}

/** Whole FP only: round the lost 10% UP, so small scores still pay a price. */
export function abyssFpLoss(fp) {
  return Math.min(Math.max(0, fp), Math.ceil(Math.max(0, fp) * ABYSS_FP_FRACTION));
}

/** An entry invariant shared by walking, every shove, slides and warps. */
export function resolveAbyssEntries(before, after) {
  const holes = after.stageFx?.crumbling?.hexes;
  if (!holes?.length) return after;
  let state = after;
  for (const sp of after.spirits) {
    const old = before.spirits.find(s => s.id === sp.id);
    if (!old || sp.knockedOut || sp.abyssPending || old.num === sp.num || !holes.includes(sp.num)) continue;
    const homeNum = startingHex(old);
    if (!HEX_BY_NUM[homeNum]) continue;
    const sheet = state.noteStates?.[sp.id] ?? {};
    const lost = abyssFpLoss(sheet.fame ?? 0);
    if (isPosing(state, sp.id)) state = applyPoseSet(state, { spiritId: sp.id, on: false });
    state = {
      ...state,
      // Null is off the board; retain the queue slot so the next OWN turn is
      // the respawn beat. This is not permanent elimination or a life spend.
      spirits: state.spirits.map(s => s.id === sp.id ? { ...s, num: null,
        abyssPending: { homeNum, fellOn: sp.num },
        knockdownCount: (s.knockdownCount ?? 0) + 1 } : s),
      noteStates: { ...state.noteStates, [sp.id]: { ...sheet,
        fame: Math.max(0, (sheet.fame ?? 0) - lost), knockStreak: 0 } },
      stageFx: { ...state.stageFx, lastAbyss: { event: 'fell', spiritId: sp.id, hexNum: sp.num, lost } },
      ...(state.acting === sp.id ? { turn: { ...state.turn, moveStepsLeft: 0,
        slideStepsLeft: 0, actionTokenUsed: true } } : {}),
    };
  }
  return state;
}

export function respawnFromAbyss(state, spiritId) {
  const sp = state.spirits.find(s => s.id === spiritId);
  if (!sp?.abyssPending || sp.knockedOut) return state;
  const { homeNum } = sp.abyssPending;
  return { ...state,
    spirits: state.spirits.map(s => s.id === spiritId ? { ...s, num: homeNum,
      facing: cornerFacing(homeNum), vibe: s.maxVibe, abyssPending: null } : s),
    stageFx: { ...state.stageFx, lastAbyss: { event: 'respawned', spiritId, hexNum: homeNum } },
  };
}
