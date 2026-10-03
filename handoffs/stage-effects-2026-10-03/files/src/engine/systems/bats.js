import { BAT_COUNT, BAT_ROUNDS, BAT_FAN_GAIN, BAT_DAMAGE, BAT_STEP_MS } from '../../data/stageEffects.js';
import { batSpawn, batTarget, batStep } from '../../board/batRules.js';
import { addCasuals } from '../../data/gameConstants.js';
import { applyDamageApplied } from './combat.js';

const occupied = state => state.spirits.filter(s => !s.knockedOut).map(s => s.num);
const obstacles = state => state.stageFx.bats?.obstacles ?? [];

export function activateBats(state, clear, rounds, rng) {
  const bats = [];
  for (let i = 0; i < BAT_COUNT; i++) {
    const num = batSpawn([...clear, ...bats.map(b => b.num)], rng);
    if (num != null) bats.push({ key: `bat-${state.turn.count}-${i}`, num, targetId: null, flight: 0 });
  }
  return { roundsLeft: rounds ?? BAT_ROUNDS, bats, tick: 0, elapsedMs: 0,
    obstacles: clear.filter(n => !occupied(state).includes(n)) };
}

export function applyBatTurnTimed(state, { spiritId, turnCount, durationMs }) {
  if (state.acting !== spiritId || state.turn.count !== turnCount || !Number.isFinite(durationMs) || durationMs < 0) return state;
  const timing = state.stageFx.turnTiming ?? {};
  const old = timing[spiritId] ?? { turns: 0, totalMs: 0, lastTurn: -1 };
  if (old.lastTurn === turnCount) return state;
  return { ...state, stageFx: { ...state.stageFx, turnTiming: { ...timing,
    [spiritId]: { turns: old.turns + 1, totalMs: old.totalMs + durationMs, lastTurn: turnCount } } } };
}

export function applyBatsTicked(state, { tick, spiritId, turnCount, currentTurnMs, elapsedMs = BAT_STEP_MS }, rng) {
  const show = state.stageFx?.bats;
  if (!show || state.winner || show.tick !== tick || state.acting !== spiritId || state.turn.count !== turnCount) return state;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return state;
  const elapsed = (show.elapsedMs ?? 0) + Math.min(BAT_STEP_MS, elapsedMs);
  if (elapsed < BAT_STEP_MS) return { ...state, stageFx: { ...state.stageFx,
    bats: { ...show, elapsedMs: elapsed, tick: tick + 1 } } };
  let next = state;
  const taken = new Set(show.bats.map(b => b.num)), hits = [], moves = [];
  const bats = show.bats.map(bat => {
    taken.delete(bat.num);
    const target = batTarget(bat.num, next.spirits, next.noteStates, next.stageFx.turnTiming,
      { spiritId, ms: Number.isFinite(currentTurnMs) ? Math.max(0, currentTurnMs) : 0 });
    let num = batStep(bat.num, target, [...taken, ...obstacles(next)], rng);
    const victim = next.spirits.find(s => !s.knockedOut && (s.vibe ?? 1) > 0 && s.num === num);
    if (victim) {
      hits.push({ key: bat.key, spiritId: victim.id, hexNum: num, damage: BAT_DAMAGE });
      next = applyDamageApplied(next, { targetId: victim.id, dmg: BAT_DAMAGE });
      num = batSpawn([...occupied(next), ...taken, ...obstacles(next), bat.num], rng) ?? bat.num;
    }
    taken.add(num);
    moves.push({ key: bat.key, from: bat.num, to: num, targetId: target?.id ?? null });
    return { ...bat, num, targetId: target?.id ?? null, flight: (bat.flight ?? 0) + 1 };
  });
  return { ...next, stageFx: { ...next.stageFx, bats: { ...show, bats, tick: tick + 1, elapsedMs: elapsed - BAT_STEP_MS },
    lastBats: { event: 'flew', hits, eaten: [], moves } } };
}

// Position changes from walking, warping, shoves and slides share this rule.
// Respawning after a knockdown is excluded: returning to your corner is no deed.
export function collectBatEntries(before, after, rng) {
  const show = after.stageFx?.bats;
  if (!show) return after;
  const entrants = after.spirits.filter(s => !s.knockedOut && (s.vibe ?? 1) > 0 && before.spirits.some(b => b.id === s.id && b.num !== s.num));
  const eaten = [], taken = new Set(show.bats.map(b => b.num));
  let sheets = after.noteStates;
  const bats = show.bats.map(bat => {
    const eater = entrants.find(s => s.num === bat.num);
    if (!eater) return bat;
    const ns = sheets[eater.id] ?? {};
    const casuals = addCasuals(ns, BAT_FAN_GAIN);
    sheets = { ...sheets, [eater.id]: { ...ns, casuals, fanActedThisTurn: true, fanLag: 0 } };
    eaten.push({ key: bat.key, spiritId: eater.id, hexNum: bat.num, gain: casuals - (ns.casuals ?? 0) });
    taken.delete(bat.num);
    const num = batSpawn([...occupied(after), ...taken, ...obstacles(after), bat.num], rng) ?? bat.num;
    taken.add(num);
    return { ...bat, num, targetId: null, flight: (bat.flight ?? 0) + 1 };
  });
  if (!eaten.length) return after;
  return { ...after, noteStates: sheets, stageFx: { ...after.stageFx, bats: { ...show, bats },
    lastBats: { event: 'eaten', eaten, hits: [], moves: [] } } };
}
