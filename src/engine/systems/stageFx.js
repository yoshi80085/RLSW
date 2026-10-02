// ─── ENGINE SYSTEM: STAGE FX (Phase 6b) ──────────────────────────────────────
// The show's board hazards fire on a ROUND SCHEDULE (2026-09-29 — round 7, then
// every 5; `data/stageEffects.js` `stageFxSchedule`). They used to fire at Fame
// thresholds; that path survives in the reducer ONLY so old replay logs resolve.
// The engine owns:
//   deck   — the draw ORDER, shuffled ONCE at makeInitialState on a forked seeded
//            rng ("stageFxDeck") — replaces the client's Math.random mount shuffle.
//   fired  — scheduled rounds (or, in a legacy log, Fame thresholds) already
//            fired, in firing order. The reducer's dedup is the exactly-once
//            guarantee, since dispatch applies synchronously.
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
  SMOKE_START_RADIUS, SMOKE_ROUNDS, SMOKE_MAX_RADIUS, stageFxSchedule,
  LASER_ROUNDS, LASER_BEAM_COUNT,
  PYRO_WAVES, PYRO_WAVE_HEXES, PYRO_VERSION, PYRO_ROUND_HEXES,
  ANIMATRONIC_COUNT, ANIMATRONIC_ROUNDS,
} from "../../data/stageEffects.js";
import {
  rollLaserBeams, rollPyroHexes, spawnAnimatronics, animatronicStep,
} from "../../board/stageFx.js";
import { roundLimitFor } from "./battleFlow.js";

// ── HAZARDS NEVER START ON A PLAYER (2026-08-05) ─────────────────────────────
// Every hazard that picks hexes (laser beams, pyro charges, animatronic spawns)
// is rolled AWAY from the hexes Spirits currently occupy. You can still walk
// into one, or be knocked into one — being shoved onto a live beam is a good
// death — but nothing switches on under your feet while you stand still, and
// nothing can hit a player who has not had a turn yet. `spiritsInBeams` and the
// `zapped` reports it fed are gone with the rule: there is no longer any moment
// where a beam appearing deals damage.
function occupiedHexes(state) {
  return state.spirits.filter(sp => !sp.knockedOut).map(sp => sp.num);
}

/**
 * STAGE_FX_DRAWN { round } — a round opened. If the schedule has a show that
 * starts on it, record the round and draw the next effect off the deck.
 * Report: `state.stageFx.lastDraw { round, untilRound, rounds, fxId }`, where
 * `rounds` is how many round-end ticks the effect lives through (the client
 * passes it straight into STAGE_FX_ACTIVATED). Any other round, or a round
 * already fired, is a no-op draw (lastDraw: null) — so the client may simply
 * ask on EVERY round and the schedule is decided here, in one place.
 *
 * 📌 LEGACY: STAGE_FX_DRAWN { threshold } — the old Fame-threshold draw, kept
 * verbatim so replay logs recorded before 2026-09-29 resolve as they did.
 * Nothing in the game dispatches it any more.
 * Deterministic — consumes no rng (the deck order was fixed at init).
 */
export function applyStageFxDrawn(state, { round, threshold }) {
  const fx = state.stageFx;
  if (!fx) return state;
  const dead = { ...state, stageFx: { ...fx, lastDraw: null } };
  if (round == null) {
    // ── legacy Fame-threshold path ──
    if (fx.fired.includes(threshold)) return dead;
    const fired = [...fx.fired, threshold];
    const fxId = fx.deck[(fired.length - 1) % fx.deck.length];
    return { ...state, stageFx: { ...fx, fired, lastDraw: { threshold, fxId } } };
  }
  const show = stageFxSchedule(roundLimitFor(state)).find(s => s.round === round);
  if (!show || fx.fired.includes(round)) return dead;
  const fired = [...fx.fired, round];
  const fxId = fx.deck[(fired.length - 1) % fx.deck.length];
  const rounds = show.untilRound - show.round + 1;
  return { ...state, stageFx: { ...fx, fired, lastDraw: { round, untilRound: show.untilRound, rounds, fxId } } };
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
export function applyStageFxActivated(state, { fxId, occupied = [], rounds, pyroVersion }, rng) {
  const fx = state.stageFx;
  if (!fx) return state;
  // 🗓️ `rounds` comes from the schedule (lastDraw.rounds). ⚠️ Absent = a legacy
  // replay or the Testing Grounds button, which get each effect's old length.
  const scheduled = Number.isFinite(rounds) && rounds > 0;
  let next = { ...fx, lastActivation: { fxId, zapped: [] } };
  // `occupied` from the client covers Spirits + amps + the Ronin's shadow; fold
  // in the engine's own spirit hexes so the no-start-on-a-player rule holds even
  // if a caller forgets to pass them.
  const clear = [...new Set([...occupied, ...occupiedHexes(state)])];
  if (fxId === "smoke_machine") {
    next.smoke = { radius: SMOKE_START_RADIUS, roundsLeft: scheduled ? rounds : SMOKE_ROUNDS };
  } else if (fxId === "laser_show") {
    // Beams route around everyone standing on the board — the show opens on
    // empty stage, and only a Spirit's own step (or a shove) puts them in it.
    const beams = rollLaserBeams(LASER_BEAM_COUNT, rng, clear);
    next.laser = { beams, roundsLeft: scheduled ? rounds : LASER_ROUNDS };
    next.lastActivation = { fxId, zapped: [] };
  } else if (fxId === "pyrotechnics" && pyroVersion === PYRO_VERSION) {
    // 🎆 PYRO v2 — the mortars rise at once and fire at the end of the first
    // turn. `showRound` sizes every re-arm; `roundsLeft` is the same show clock
    // the legacy path keeps (no clock = the Testing Grounds: three rounds).
    next.pyro = {
      v: PYRO_VERSION, phase: "armed", wave: 1, showRound: 1,
      hexes: rollPyroHexes(pyroRoundSize(1), clear, rng),
      roundsLeft: scheduled ? rounds : PYRO_ROUND_HEXES.length,
    };
    next.lastPyro = { event: "armed", wave: 1, hexes: next.pyro.hexes };
  } else if (fxId === "pyrotechnics") {
    next.pyro = { phase: "arming", hexes: rollPyroHexes(PYRO_WAVE_HEXES[0] ?? 5, clear, rng), wave: 1 };
    // ⚠️ Only a SCHEDULED pyro carries a clock. Its absence is what routes the
    // tick down the legacy wave-count path, so do not default it.
    if (scheduled) next.pyro.roundsLeft = rounds;
  } else if (fxId === "animatronics") {
    // Deterministic keys — Date.now() keys would diverge replays. Unique per
    // game: the deck never repeats an effect, so one spawn wave ever.
    next.animatronics = spawnAnimatronics(
      ANIMATRONIC_COUNT, scheduled ? rounds : ANIMATRONIC_ROUNDS, occupied, rng, `anim-t${state.turn?.count ?? 0}`);
  } else {
    return { ...state, stageFx: { ...fx, lastActivation: null } };
  }
  return { ...state, stageFx: next };
}

/**
 * STAGE_FX_TURN_TICKED — the pyro/animatronic cadence.
 *
 * ⏱️ 2026-08-05: this now fires ONCE PER ROUND, not once per player-turn. The
 * action keeps its name so old replay logs still resolve; only the client's
 * call site moved (endTurn's roundCompleted block). The reason is the whole
 * point of the round clock: on a 4-player board this used to advance four
 * times before the last player had moved once, so a Spirit could be telegraphed
 * at, erupted on and slammed by an animatronic without ever taking a turn.
 *
 * Rules otherwise verbatim from the old client tickStageFxTurn:
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
  let lastPyro = fx.lastPyro ?? null;
  if (pyro?.v === PYRO_VERSION) {
    // 🎆 PYRO v2 — this tick is only its ROUND CLOCK. The firing is per turn
    // (`applyPyroTurnEnded`), so all that happens here is the show getting one
    // round older: the next re-arm is bigger, or the show is over.
    const left = pyro.roundsLeft - 1;
    if (left <= 0) {
      // ⚠️ A charge still ARMED here means a turn ended without the client's
      // end-turn volley (an old save, a skipped beat). It blows now as the
      // finale rather than vanishing — a glowing hex that never goes off
      // teaches players to ignore the glow.
      if (pyro.phase === "armed" && pyro.hexes.length) {
        const caught = caughtOn(state, pyro.hexes);
        pyroReport = { event: "erupted", wave: pyro.wave, hexes: pyro.hexes, caught, finale: true };
        lastPyro = { event: "fired", wave: pyro.wave, hexes: pyro.hexes, caught, finale: true };
      } else {
        pyroReport = { event: "burnout" };
        lastPyro = { event: "retracted", hexes: pyro.hexes ?? [] };
      }
      pyro = null;
    } else {
      pyro = { ...pyro, roundsLeft: left, showRound: pyro.showRound + 1 };
    }
  } else if (pyro && pyro.roundsLeft != null) {
    // 🗓️ SCHEDULED pyro: cycle arm → erupt → re-arm until its show's clock runs
    // out. The last tick of the show erupts an armed wave as the finale (and
    // clears in the same beat) or burns out a spent one.
    const left = pyro.roundsLeft - 1;
    if (pyro.phase === "arming") {
      const caught = state.spirits
        .filter(sp => !sp.knockedOut && pyro.hexes.includes(sp.num))
        .map(sp => sp.id);
      pyroReport = { event: "erupted", wave: pyro.wave, hexes: pyro.hexes, caught };
      if (left <= 0) { pyroReport.finale = true; pyro = null; }
      else pyro = { ...pyro, phase: "erupting", roundsLeft: left };
    } else if (left <= 0) {
      pyroReport = { event: "burnout" };
      pyro = null;
    } else {
      const wave = pyro.wave + 1;
      const size = PYRO_WAVE_HEXES[Math.min(wave, PYRO_WAVE_HEXES.length) - 1] ?? 5;
      const hexes = rollPyroHexes(size, [...pyro.hexes, ...occupiedHexes(state)], rng);
      pyroReport = { event: "rearmed", wave, hexes };
      pyro = { phase: "arming", hexes, wave, roundsLeft: left };
    }
  } else if (pyro) {
    // ── legacy wave-count path (replays from before the schedule) ──
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
      // Fresh charges avoid last wave's hexes AND everyone standing on the
      // board — a charge must never prime under a Spirit's feet. Anyone caught
      // in the eruption below therefore walked onto a glowing hex (or was
      // pushed onto one) with a full round of warning.
      const hexes = rollPyroHexes(
        PYRO_WAVE_HEXES[wave - 1] ?? 5, [...pyro.hexes, ...occupiedHexes(state)], rng);
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
    stageFx: { ...fx, pyro, animatronics, lastPyro, lastTurnTick: { pyro: pyroReport, anim: animReport } },
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 🎆 PYRO v2 — the mortars (Alex, 2026-10-02; the rule text is in
// data/stageEffects.js). Three actions, each reporting in `stageFx.lastPyro`:
//   PYRO_TURN_ENDED    → { event:'fired', wave, hexes, caught:[ids] }
//   PYRO_TURN_STARTED  → { event:'armed', wave, hexes }
//   PYRO_CHARGE_STRUCK → { event:'struck', hexNum, spiritId, wave }
// A no-op leaves `lastPyro: null`, so the client can play a report the instant
// it lands without guarding against a stale one. Damage stays CLIENT-applied off
// these reports, the same beat as every other stage hazard (header above).
// ═════════════════════════════════════════════════════════════════════════════
const pyroRoundSize = showRound =>
  PYRO_ROUND_HEXES[Math.min(Math.max(1, showRound), PYRO_ROUND_HEXES.length) - 1];
const caughtOn = (state, hexes) =>
  state.spirits.filter(sp => !sp.knockedOut && hexes.includes(sp.num)).map(sp => sp.id);
const quiet = state => ({ ...state, stageFx: { ...state.stageFx, lastPyro: null } });

/** Is `hexNum` an ARMED v2 charge right now? The one question every shove asks. */
export function isArmedPyroHex(state, hexNum) {
  const p = state.stageFx?.pyro;
  return p?.v === PYRO_VERSION && p.phase === "armed" && p.hexes.includes(hexNum);
}

export function applyPyroTurnEnded(state) {
  const fx = state.stageFx, p = fx?.pyro;
  if (p?.v !== PYRO_VERSION || p.phase !== "armed") return fx ? quiet(state) : state;
  // A set whose every charge was struck by shoves fires nothing — but it is
  // still SPENT, so the re-arm below runs on schedule.
  const caught = caughtOn(state, p.hexes);
  return {
    ...state,
    stageFx: {
      ...fx,
      pyro: { ...p, phase: "spent", hexes: [], spentHexes: [...(p.spentHexes ?? []), ...p.hexes] },
      lastPyro: { event: "fired", wave: p.wave, hexes: p.hexes, caught },
    },
  };
}

export function applyPyroTurnStarted(state, { occupied = [] }, rng) {
  const fx = state.stageFx, p = fx?.pyro;
  if (p?.v !== PYRO_VERSION || p.phase !== "spent") return fx ? quiet(state) : state;
  // Fresh charges never prime under a Spirit (the rule at the top of this
  // file) and avoid the set that just blew, so the mortars visibly MOVE.
  const clear = [...new Set([...occupied, ...occupiedHexes(state), ...(p.spentHexes ?? [])])];
  const hexes = rollPyroHexes(pyroRoundSize(p.showRound), clear, rng);
  const wave = p.wave + 1;
  return {
    ...state,
    stageFx: {
      ...fx,
      pyro: { ...p, phase: "armed", wave, hexes, spentHexes: [], struck: [] },
      lastPyro: { event: "armed", wave, hexes },
    },
  };
}

export function applyPyroChargeStruck(state, { spiritId, hexNum }) {
  if (!isArmedPyroHex(state, hexNum)) return state.stageFx ? quiet(state) : state;
  const fx = state.stageFx, p = fx.pyro;
  return {
    ...state,
    stageFx: {
      ...fx,
      // Spent, not gone: it fired, and the re-arm must not drop a fresh charge
      // straight back under the Spirit it just launched.
      // `struck` is what the arena reads to play the right Spirit's reaction on
      // the right mortar — a report alone would be overwritten before a frame
      // drawn after a batch of dispatches ever saw it.
      pyro: { ...p, hexes: p.hexes.filter(h => h !== hexNum), spentHexes: [...(p.spentHexes ?? []), hexNum],
        struck: [...(p.struck ?? []), { hexNum, spiritId }] },
      lastPyro: { event: "struck", wave: p.wave, hexNum, spiritId },
    },
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
      // ⚠️ Capped: a show that runs to the buzzer lasts longer than the 3
      // rounds this growth was tuned for. A legacy 3-round cloud never hits it.
      smoke = { radius: Math.min(smoke.radius + 1, SMOKE_MAX_RADIUS), roundsLeft: left };
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
      // Re-pattern around the current bodies — the beams sweep to where nobody
      // is standing, so a re-pattern is a movement problem, never free damage.
      const beams = rollLaserBeams(LASER_BEAM_COUNT, rng, occupiedHexes(state));
      laser = { beams, roundsLeft: left };
      laserReport = { event: "repatterned", left, zapped: [] };
    }
  }
  return {
    ...state,
    stageFx: { ...fx, smoke, laser, lastRoundTick: { smoke: smokeReport, laser: laserReport } },
  };
}
