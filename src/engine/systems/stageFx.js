// ─── ENGINE SYSTEM: STAGE FX (Phase 6b) ──────────────────────────────────────
// The show's board hazards fire at Fame thresholds (⭐8/16/24). The engine owns:
//   deck   — the draw ORDER, shuffled ONCE at makeInitialState on a forked seeded
//            rng ("stageFxDeck") — replaces the client's Math.random mount shuffle.
//   fired  — thresholds already fired, in firing order (was the client's firedRef
//            Set; the reducer's dedup gives the same exactly-once guarantee, since
//            dispatch applies synchronously).
//   smoke / laser / pyro / animatronics — the ACTIVE effect state (Phase 6b
//            flip: was useStageEffects React state). All rng (beam patterns,
//            pyro hexes, animatronic spawn/steps) rolls on the ENGINE rng.
// The client renders these slices directly and plays the cinematics (logs,
// flashes, damage timing) off the reports below; damage itself still flows
// through the client's applyVibeDamage → DAMAGE_APPLIED, same as combat.
//
// Reports (overwritten on every dispatch of their action, null when nothing
// happened): `lastDraw`, `lastActivation`, `lastTurnTick`, `lastRoundTick`.

import {
  SMOKE_START_RADIUS, SMOKE_ROUNDS,
  LASER_ROUNDS, LASER_BEAM_COUNT,
  PYRO_WAVES, PYRO_WAVE_HEXES,
  ANIMATRONIC_COUNT, ANIMATRONIC_TURNS,
} from "../../data/stageEffects.js";
import {
  rollLaserBeams, rollPyroHexes, spawnAnimatronics, animatronicStep, hexInBeams,
} from "../../board/stageFx.js";

// Living spirits standing in the given beam pattern (for the zap report).
function spiritsInBeams(state, beams) {
  return state.spirits.filter(sp => !sp.knockedOut && hexInBeams(sp.num, beams)).map(sp => sp.id);
}

/**
 * STAGE_FX_DRAWN { threshold } — a Fame threshold was crossed: record it and
 * draw the next effect off the deck. Duplicate thresholds are a no-op draw
 * (lastDraw: null) so async grant chains can never double-fire a show.
 * Report rides in `state.stageFx.lastDraw { threshold, fxId }`.
 * Deterministic — consumes no rng (the deck order was fixed at init).
 */
export function applyStageFxDrawn(state, { threshold }) {
  const fx = state.stageFx;
  if (!fx) return state;
  if (fx.fired.includes(threshold)) {
    return { ...state, stageFx: { ...fx, lastDraw: null } };
  }
  const fired = [...fx.fired, threshold];
  const fxId = fx.deck[(fired.length - 1) % fx.deck.length];
  return { ...state, stageFx: { ...fx, fired, lastDraw: { threshold, fxId } } };
}

/**
 * STAGE_FX_ACTIVATED { fxId, occupied } — the drawn effect goes live: the
 * engine creates the active-effect state, rolling patterns/spawns on its rng.
 * `occupied` (hex nums the animatronics must not spawn on — spirits + amps) is
 * client-supplied because amps are still React-owned (Phase 5 leftovers).
 * Report: `lastActivation { fxId, zapped:[spiritIds] }` — `zapped` lists the
 * spirits already standing in a fresh laser pattern (client plays the zap
 * cinematic + applies the damage, exactly like the old zapSpiritsInBeams).
 */
export function applyStageFxActivated(state, { fxId, occupied = [] }, rng) {
  const fx = state.stageFx;
  if (!fx) return state;
  let next = { ...fx, lastActivation: { fxId, zapped: [] } };
  if (fxId === "smoke_machine") {
    next.smoke = { radius: SMOKE_START_RADIUS, roundsLeft: SMOKE_ROUNDS };
  } else if (fxId === "laser_show") {
    const beams = rollLaserBeams(LASER_BEAM_COUNT, rng);
    next.laser = { beams, roundsLeft: LASER_ROUNDS };
    next.lastActivation = { fxId, zapped: spiritsInBeams(state, beams) };
  } else if (fxId === "pyrotechnics") {
    next.pyro = { phase: "arming", hexes: rollPyroHexes(PYRO_WAVE_HEXES[0] ?? 5, [], rng), wave: 1 };
  } else if (fxId === "animatronics") {
    // Deterministic keys — Date.now() keys would diverge replays. Unique per
    // game: the deck never repeats an effect, so one spawn wave ever.
    next.animatronics = spawnAnimatronics(
      ANIMATRONIC_COUNT, ANIMATRONIC_TURNS, occupied, rng, `anim-t${state.turn?.count ?? 0}`);
  } else {
    return { ...state, stageFx: { ...fx, lastActivation: null } };
  }
  return { ...state, stageFx: next };
}

/**
 * STAGE_FX_TURN_TICKED — the per-TURN cadence (end of every player's turn),
 * rules verbatim from the old client tickStageFxTurn:
 *   🎆 pyro: arming → ERUPTS (report who's caught); spent flames re-arm the
 *      next wave (finale bigger) or burn out after PYRO_WAVES.
 *   🤖 animatronics: each takes one step toward the nearest living Spirit
 *      (slamming anything adjacent/in the way — report the victims), then its
 *      clock ticks down; expired bots are removed.
 * Report: `lastTurnTick { pyro, anim }`:
 *   pyro: null | { event:'erupted', wave, hexes, caught:[ids] }
 *              | { event:'burnout' }
 *              | { event:'rearmed', wave, hexes }
 *   anim: null | { hits:[{ key, victimId }], expired:number }
 * Damage application + burn status stay client (off the report), same beat as
 * before.
 */
export function applyStageFxTurnTicked(state, _action, rng) {
  const fx = state.stageFx;
  if (!fx) return state;
  let pyro = fx.pyro;
  let pyroReport = null;
  if (pyro) {
    if (pyro.phase === "arming") {
      const caught = state.spirits
        .filter(sp => !sp.knockedOut && pyro.hexes.includes(sp.num))
        .map(sp => sp.id);
      pyroReport = { event: "erupted", wave: pyro.wave, hexes: pyro.hexes, caught };
      pyro = { ...pyro, phase: "erupting" };
    } else if (pyro.wave >= PYRO_WAVES) {
      pyroReport = { event: "burnout" };
      pyro = null;
    } else {
      const wave = pyro.wave + 1;
      const hexes = rollPyroHexes(PYRO_WAVE_HEXES[wave - 1] ?? 5, pyro.hexes, rng);
      pyroReport = { event: "rearmed", wave, hexes };
      pyro = { phase: "arming", hexes, wave };
    }
  }

  let animatronics = fx.animatronics ?? [];
  let animReport = null;
  if (animatronics.length) {
    const alive = state.spirits.filter(sp => !sp.knockedOut);
    const taken = new Set(animatronics.map(b => b.num));
    const next = [];
    const hits = [];
    let expired = 0;
    for (const bot of animatronics) {
      taken.delete(bot.num);
      const { move, hitId } = animatronicStep(bot.num, alive, [...taken], rng);
      if (hitId) hits.push({ key: bot.key, victimId: hitId });
      const num = move ?? bot.num;
      taken.add(num);
      const turnsLeft = bot.turnsLeft - 1;
      if (turnsLeft > 0) next.push({ ...bot, num, turnsLeft });
      else expired++;
    }
    animatronics = next;
    animReport = { hits, expired };
  }

  return {
    ...state,
    stageFx: { ...fx, pyro, animatronics, lastTurnTick: { pyro: pyroReport, anim: animReport } },
  };
}

/**
 * STAGE_FX_ROUND_TICKED — the per-ROUND cadence (once per full round), rules
 * verbatim from the old client tickStageFxRound:
 *   💨 smoke: spreads one ring per surviving round, then clears.
 *   🔺 laser: re-patterns on fresh engine-rng beams (report who's zapped),
 *      then powers down.
 * Report: `lastRoundTick { smoke, laser }`:
 *   smoke: null | { event:'cleared' } | { event:'spread', radius, left }
 *   laser: null | { event:'off' } | { event:'repatterned', left, zapped:[ids] }
 */
export function applyStageFxRoundTicked(state, _action, rng) {
  const fx = state.stageFx;
  if (!fx) return state;
  let smoke = fx.smoke;
  let smokeReport = null;
  if (smoke) {
    const left = smoke.roundsLeft - 1;
    if (left <= 0) {
      smokeReport = { event: "cleared" };
      smoke = null;
    } else {
      smoke = { radius: smoke.radius + 1, roundsLeft: left };
      smokeReport = { event: "spread", radius: smoke.radius, left };
    }
  }
  let laser = fx.laser;
  let laserReport = null;
  if (laser) {
    const left = laser.roundsLeft - 1;
    if (left <= 0) {
      laserReport = { event: "off" };
      laser = null;
    } else {
      const beams = rollLaserBeams(LASER_BEAM_COUNT, rng);
      laser = { beams, roundsLeft: left };
      laserReport = { event: "repatterned", left, zapped: spiritsInBeams(state, beams) };
    }
  }
  return {
    ...state,
    stageFx: { ...fx, smoke, laser, lastRoundTick: { smoke: smokeReport, laser: laserReport } },
  };
}
