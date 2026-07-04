// =============================================================================
// data/stageEffects.js — 🎇 STAGE EFFECTS (board hazards) — pure data + tuning
// -----------------------------------------------------------------------------
// The show gets bigger as the night goes on: the FIRST time ANY Spirit crosses
// each Fame threshold below, one Stage Effect fires (once per threshold, per
// game). Which one is decided by a deck shuffled at game start — no repeats, so
// 3 of the 4 appear each game and future effects slot in by joining the deck.
//
// These replaced the old skill-tree "stage effect" battle buffs (laser_show /
// stage_light / fog_machine / pyrotechnics) — those were retired; effects now
// live ON THE BOARD as escalating spectacle/hazards.
//
// Geometry helpers live in board/stageFx.js. Balance numbers live HERE.
// =============================================================================

export const STAGE_FX_THRESHOLDS = [8, 16, 24];

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
};
export const STAGE_FX_IDS = Object.keys(STAGE_FX_META);

// ── 💨 SMOKE MACHINE ─────────────────────────────────────────────────────────
export const SMOKE_START_RADIUS = 2;  // rings from the Limelight covered on activation
export const SMOKE_ROUNDS       = 3;  // full rounds it lasts; +1 ring per surviving round

// ── 🔺 LASER SHOW ────────────────────────────────────────────────────────────
export const LASER_ROUNDS     = 3;    // full rounds active; beams re-pattern each round
export const LASER_BEAM_COUNT = 3;    // diagonal beams per pattern
export const LASER_DAMAGE     = 1;    // Vibe lost crossing / caught in a beam

// ── 🎆 PYROTECHNICS ──────────────────────────────────────────────────────────
export const PYRO_WAVES      = 3;         // arming→eruption cycles
export const PYRO_WAVE_HEXES = [5, 5, 8]; // hexes per wave — the finale is bigger
export const PYRO_DAMAGE     = 1;         // Vibe lost in an eruption
export const PYRO_BURN_TURNS = 2;         // Burn status applied (reuses the Burn tick)

// ── 🤖 ANIMATRONICS ──────────────────────────────────────────────────────────
export const ANIMATRONIC_COUNT  = 2;  // robots spawned (on outer edge hexes)
export const ANIMATRONIC_TURNS  = 5;  // player-turns before they power down
export const ANIMATRONIC_DAMAGE = 1;  // Vibe dealt slamming a Spirit in the way

// Fisher–Yates shuffle of the effect ids — drawn top-down, one per threshold.
export function shuffledStageFxDeck() {
  const d = [...STAGE_FX_IDS];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
