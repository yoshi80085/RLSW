// =============================================================================
// data/stageEffects.js — 🎇 STAGE EFFECTS (board hazards) — pure data + tuning
// -----------------------------------------------------------------------------
// The show gets bigger as the night goes on: Stage Effects fire on a ROUND
// SCHEDULE (Alex, 2026-09-29) — round 7, then every 5 rounds — see
// `stageFxSchedule` below. Which one is decided by a deck shuffled at game
// start — no repeats, so at most 3 of the 5 appear in a game and future effects
// slot in by joining the deck.
//
// 🪦 They used to fire when any Spirit first crossed a Fame threshold. That
// tied the show to how fast the leader scored, so a slow table might never see
// one and a runaway leader set them all off early. The schedule makes every
// match of the same length get the same show at the same moments.
//
// These replaced the old skill-tree "stage effect" battle buffs (laser_show /
// stage_light / fog_machine / pyrotechnics) — those were retired; effects now
// live ON THE BOARD as escalating spectacle/hazards.
//
// Geometry helpers live in board/stageFx.js. Balance numbers live HERE.
// =============================================================================

// ── 🗓️ THE SCHEDULE (Alex, 2026-09-29) ─────────────────────────────────────
//   10 rounds → round 7, lasts to the buzzer (7–10)
//   15 rounds → round 7 for 3 rounds (7–9), round 12 to the buzzer (12–15)
//   20 rounds → 7–9, 12–14, 17 to the buzzer (17–20)
// i.e. one show every STAGE_FX_EVERY rounds from STAGE_FX_FIRST_ROUND; every
// show lasts STAGE_FX_SHOW_ROUNDS except the LAST, which runs to the buzzer.
// 📌 The rule is written generally rather than as a table of the three lengths
// so a new ROUND_LIMIT_CHOICES entry gets a sensible show without an edit here.
export const STAGE_FX_FIRST_ROUND = 7;
export const STAGE_FX_EVERY       = 5;
export const STAGE_FX_SHOW_ROUNDS = 3;
// 🏆 Legend Run has no buzzer, so there is no "last show runs to the end".
// ⚠️ Alex has not ruled on this mode — the default is a 20-round game's three
// start rounds, every show 3 rounds long.
export const STAGE_FX_LEGEND_SHOWS = 3;

/**
 * The shows a match gets, in order: `[{ round, untilRound }]`, both inclusive.
 * `roundLimit` null = Legend Run (no buzzer).
 * ⚠️ `untilRound` is the last round the effect is ON the board — it clears in
 * the round-end tick that closes that round. A show that runs "to the buzzer"
 * has `untilRound === roundLimit`, and the buzzer ends the match in the same
 * round-end beat, so it is still on the board when the crowd decides.
 */
export function stageFxSchedule(roundLimit) {
  const shows = [];
  if (roundLimit == null || !Number.isFinite(roundLimit)) {
    for (let i = 0; i < STAGE_FX_LEGEND_SHOWS; i++) {
      const round = STAGE_FX_FIRST_ROUND + i * STAGE_FX_EVERY;
      shows.push({ round, untilRound: round + STAGE_FX_SHOW_ROUNDS - 1 });
    }
    return shows;
  }
  for (let round = STAGE_FX_FIRST_ROUND; round <= roundLimit; round += STAGE_FX_EVERY) {
    shows.push({ round, untilRound: Math.min(roundLimit, round + STAGE_FX_SHOW_ROUNDS - 1) });
  }
  // The last show of a timed match runs to the buzzer.
  if (shows.length) shows[shows.length - 1].untilRound = roundLimit;
  return shows;
}

export const STAGE_FX_META = {
  smoke_machine: {
    name: 'Smoke Machine', icon: '💨', color: '#9fb8cc',
    blurb: 'A smoke cloud swallows the centre stage — Spirits inside vanish from view, and it spreads wider every round.',
  },
  laser_show: {
    name: 'Laser Show', icon: '🔺', color: '#ff2266',
    blurb: 'Neon beams rake diagonally across the stage. Crossing one costs 1 Vibe. New pattern every round.',
  },
  pyrotechnics: {
    name: 'Pyrotechnics', icon: '🎆', color: '#ff7722',
    blurb: 'Charges prime under random hexes and glow red — next turn they ERUPT, burning anyone standing there.',
  },
  animatronics: {
    name: 'Animatronics', icon: '🤖', color: '#88ffcc',
    blurb: 'Stage robots wake up on the outer edge and stalk the nearest Spirit, slamming anything in their way.',
  },
  bats: {
    name: 'Bats', icon: '🦇', color: '#bc8cff',
    blurb: 'Four bats hunt the biggest FP star, then the slowest turn-taker, then the nearest Spirit. Step onto a bat for +2 fans; let it reach you and lose 1 Vibe. Bats respawn after either collision.',
  },
};
export const STAGE_FX_IDS = Object.keys(STAGE_FX_META);

// ── 💨 SMOKE MACHINE ─────────────────────────────────────────────────────────
export const SMOKE_START_RADIUS = 2;  // rings from the Limelight covered on activation
export const SMOKE_ROUNDS       = 3;  // LEGACY replays only: rounds it lasted before the schedule; +1 ring per surviving round
// ⚠️ A show that runs to the buzzer can last 4 rounds, and one ring a round
// would swallow most of the board. The cloud stops at the size a 3-round show
// always reached, so a long show is a longer cloud, not a bigger one.
export const SMOKE_MAX_RADIUS   = SMOKE_START_RADIUS + SMOKE_ROUNDS - 1;

// ── 🔺 LASER SHOW ────────────────────────────────────────────────────────────
export const LASER_ROUNDS     = 3;    // LEGACY replays only: rounds active before the schedule; beams re-pattern each round
export const LASER_BEAM_COUNT = 3;    // diagonal beams per pattern
export const LASER_DAMAGE     = 1;    // Vibe lost crossing / caught in a beam

// ── 🎆 PYROTECHNICS ──────────────────────────────────────────────────────────
// ⏱️ ROUND CLOCK (2026-08-05): the arm→erupt cycle now advances once per ROUND
// instead of once per player-turn, so every Spirit gets a move between the
// glow and the bang. Waves cut 3→2 to keep the show about the same LENGTH in
// real time — at 4 players 3 waves on the round clock ran ~6 revolutions.
export const PYRO_WAVES      = 2;         // LEGACY replays only: arming→eruption cycles before the schedule
export const PYRO_WAVE_HEXES = [5, 8];    // hexes per wave — later waves stay at the last (bigger) size
// 🗓️ Under the schedule pyro keeps cycling (arm → erupt → re-arm) for as long
// as its show lasts. If the show ends while a wave is ARMED, that wave blows as
// the finale in the same tick instead of fizzling — a glowing hex that never
// goes off would teach players to ignore the glow.
// ⭐ 2026-10-02 (Alex): "real Vibe damage — like 3 or so". Was 1. One number for
// every pyro hit: caught when a volley fires, shoved onto a charge, and the
// legacy walk-into-flames hazard old replays still route through.
export const PYRO_DAMAGE     = 3;         // Vibe lost to a pyro hit
export const PYRO_BURN_TURNS = 2;         // Burn status applied (reuses the Burn tick — the victim's OWN turns)

// ── 🎆 PYRO v2 — THE MORTARS (Alex, 2026-10-02) ──────────────────────────────
// "Once the Stage effect triggers, the mortars arm — they fire under 2
// conditions: 1. end of a player's turn (not a full round) … coming back before
// the start of the next player's turn, or 2. if a player gets pushed into it —
// doesn't matter if the push would have pushed the Spirit past the mortar — it
// STOPS on the mortar and takes damage. 1st round about 5 mortars, 2nd 10 or so,
// 3rd 13 or so."
//   ⏱️ fire   — every END TURN (`pyroTurnEnded`): every armed charge blows; anyone
//              standing on one is caught.
//   ⏱️ re-arm — before the NEXT turn starts (`pyroTurnStarted`), sized by the
//              show's round. Between the two, the round clock can end the show,
//              so the last volley closes it and no armed charge is left to fizzle.
//   💥 shove  — a forced move that ENTERS an armed hex stops on it; that charge
//              fires on the Spirit and is spent until the re-arm.
//   🚶 walking onto one does NOTHING by itself — you are simply standing on it
//              when your own turn ends.
// ⚠️ VERSIONED. Only an activation that carries `pyroVersion: 2` runs these
// rules; a replay log recorded before them has no field and keeps the old
// round-clock arm → erupt → re-arm cadence above, bit for bit.
export const PYRO_VERSION      = 2;
export const PYRO_ROUND_HEXES  = [5, 10, 13];   // armed charges per show round — later rounds stay at the last size

// ── 🤖 ANIMATRONICS ──────────────────────────────────────────────────────────
// ⏱️ ROUND CLOCK: they take one step per ROUND now, not per player-turn. 5
// player-turns ≈ 2 revolutions at 3 players, so the life expectancy is
// restated as rounds rather than left to quietly triple.
export const ANIMATRONIC_ROUNDS = 2;  // LEGACY replays only: rounds before they powered down (scheduled shows use the show's length)
export const ANIMATRONIC_COUNT  = 2;  // robots spawned (on outer edge hexes)
export const ANIMATRONIC_DAMAGE = 1;  // Vibe dealt slamming a Spirit in the way

// Bats fly one hex per real-time beat; the show's lifetime uses the round clock.
export const BAT_COUNT = 4;
export const BAT_STEP_MS = 30000;
export const BAT_ROUNDS = 3;
export const BAT_FAN_GAIN = 2;
export const BAT_DAMAGE = 1;

// Crumbling Stage is available to the engine/preview; add it to the live deck
// only after its board presentation is approved (CLAUDE.md preview rule).
export const CRUMBLING_META = {
  name: 'Crumbling Stage', icon: '🕳️', color: '#c49aff',
  blurb: 'The floor collapses into the abyss. Fall in: lose 10% FP and return to your starting hex next turn.',
};
export const CRUMBLING_ROUNDS = 3;
export const CRUMBLING_HEXES_PER_ROUND = 4;
export const ABYSS_FP_FRACTION = 0.10;

// Fisher–Yates shuffle of the effect ids — drawn top-down, one per scheduled show.
// `rand` is an injectable 0..1 PRNG (Phase 6b prep — same treatment as the Rock
// God / economy rng threading): defaults to Math.random so the still-live
// `useStageEffects` mount-shuffle behaves exactly as before. At the 6b flip the
// engine builds the deck ONCE at makeInitialState on the seeded rng, so the deck
// order becomes replay-deterministic GameState instead of a per-client Math.random
// draw. Pure otherwise.
export function shuffledStageFxDeck(rand = Math.random) {
  const d = [...STAGE_FX_IDS];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
