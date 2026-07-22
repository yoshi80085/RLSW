// ─── ENGINE SYSTEM: COMBAT ───────────────────────────────────────────────────
// Phase 3a: the pure combat MATH — damage/knockback/fame tables — extracted
// verbatim from Game so a server can score battles identically. No actions,
// no state mutation, no timers yet: those land in 3b–3e (rolls → DAMAGE_APPLIED
// → KNOCKBACK_MOVED → KNOCKED_OUT → RETALIATION_*). `Game` imports these the
// same way it imports `riffStats` — single source of truth for the tables.

import {
  UNDERDOG_MIN_DEFICIT, UNDERDOG_DEFICIT_PER_STEP, UNDERDOG_MAX_MULT,
  THRASH_DAMAGE_CAP, THRASH_WHIFF_DMG, THRASH_PUSH_THRESHOLD,
  SONIC_VIBE_CAP,
  STOCK_REFILL_RATE,
} from "../../data/gameConstants.js";
import { CORNERS } from "../../data/corners.js";
import { cornerFacing } from "../../board/boardHelpers.js";
import { STANCE_DEFS } from "../../data/stances.js";

/**
 * LEGACY damage table — still used by Smash, riff-off, and any call site that
 * hasn't been split yet. New code should use thrashDamage / sonicDamage.
 */
export function marginToDamage(margin) {
  if (margin <= 3)  return 1;
  if (margin <= 6)  return 2;
  if (margin <= 9)  return 3;
  if (margin <= 12) return 4;
  return 5;
}

// ─── THRASH (melee) ──────────────────────────────────────────────────────────
/**
 * Thrash Vibe damage — the heavy hitter. Drive/Sustain is the real driver;
 * a Spirit who's burned their chord stack and dropped Sustain will eat it bad.
 * Clean 2-wide bands keep the curve readable, capped at THRASH_DAMAGE_CAP (4).
 *   margin 1-2 = 1,  3-4 = 2,  5-6 = 3,  7+ = 4 (cap)
 * @param {boolean} isAttackerLoss  true when the ATTACKER lost — caps at THRASH_WHIFF_DMG (1).
 */
export function thrashDamage(margin, isAttackerLoss = false) {
  if (isAttackerLoss) return THRASH_WHIFF_DMG;
  if (margin <= 2) return 1;
  if (margin <= 4) return 2;
  if (margin <= 6) return 3;
  return THRASH_DAMAGE_CAP;
}

/**
 * Thrash knockback — minimal positional displacement.
 * 0 hexes on small wins, 1 hex only when margin >= THRASH_PUSH_THRESHOLD (3).
 */
export function thrashKnockback(margin) {
  return margin >= THRASH_PUSH_THRESHOLD ? 1 : 0;
}

/** Thrash FP — fighting earns almost no Fame; you fight to hurt, not to shine. */
export function thrashFame() {
  return 1;
}

// ─── SONIC (ranged) ──────────────────────────────────────────────────────────
/**
 * Sonic Vibe damage — the beam stings but doesn't destroy. Capped at
 * SONIC_VIBE_CAP (2). Most hits deal 1.
 */
export function sonicDamage(margin) {
  if (margin <= 4) return 1;
  return Math.min(SONIC_VIBE_CAP, 2);
}

/**
 * Sonic knockback — the main positional weapon. Base push from margin (1-3),
 * plus a Vibe-deficit bonus: a battered rival gets launched further.
 */
export function sonicKnockback(margin, vibe, maxVibe) {
  vibe = vibe ?? 1;
  maxVibe = maxVibe ?? 1;
  const baseKB   = Math.min(3, Math.max(1, Math.ceil(margin / 2)));
  const vibeRatio = Math.max(0, 1 - (vibe / Math.max(1, maxVibe)));
  const vibeKB    = Math.floor(vibeRatio * 2);
  return Math.min(5, baseKB + vibeKB);
}

/**
 * Sonic FP — the primary Fame engine. Scales directly with margin so the
 * Drive/Sustain gap you built matters. Bigger wins = bigger legend.
 */
export function sonicFame(margin) {
  return Math.max(1, Math.ceil(margin / 2));
}

// ─── LEGACY knockback / fame (kept for Smash, riff-off, etc.) ────────────────
export function knockbackSpaces(bs, margin) {
  const m = margin ?? bs?.margin ?? 1;
  return bs?.sonicAttack ? Math.min(3, Math.max(1, Math.ceil(m / 2))) : 1;
}

export function fameFromMargin(margin) {
  if (margin <= 3) return 1;
  if (margin <= 6) return 2;
  return 3;
}

/**
 * Underdog / comeback amplifier — pure over the two Fame totals.
 */
export function underdogBonus(winnerFame, loserFame, baseFp) {
  const deficit = loserFame - winnerFame;
  if (deficit < UNDERDOG_MIN_DEFICIT) return { fp: baseFp, deficit: 0, mult: 1 };
  const mult = Math.min(UNDERDOG_MAX_MULT, 1 + (deficit / UNDERDOG_DEFICIT_PER_STEP) * 0.5);
  let fp = Math.round(baseFp * mult);
  const maxFp = Math.max(baseFp, deficit);
  fp = Math.min(fp, maxFp);
  return { fp, deficit, mult };
}

// (Phase 3d counter/retaliation rolls REMOVED — the Stance rework replaces the
// counter mechanic with natural Thrash-adjacency retaliation; §3/§8 of
// STANCE_SYSTEM_DESIGN.md.)

/**
 * decideWinner (Phase 3c kernel) — boss-aware win check.
 */
export function decideWinner(spirits, { godSummoned = false, attackerId = null, hasWinner = false } = {}) {
  const survivors = spirits.filter(s => !s.knockedOut);
  if (godSummoned && !hasWinner) {
    return { winnerId: null, godTriumphs: survivors.length === 0 };
  }
  if (survivors.length === 1) return { winnerId: survivors[0].id, godTriumphs: false };
  if (survivors.length === 0 && attackerId) {
    const atk = spirits.find(s => s.id === attackerId && !s.knockedOut);
    if (atk) return { winnerId: atk.id, godTriumphs: false };
  }
  return { winnerId: null, godTriumphs: false };
}

/**
 * resolveKnockdown (Phase 3c kernel) — respawn/KO state transform.
 */
export function resolveKnockdown(spirit, corners = CORNERS) {
  const livesLeft = (spirit.lives ?? 1) - 1;
  if (livesLeft > 0) {
    const homeNum   = spirit.corner ? corners[spirit.corner]?.homeNum : spirit.num;
    const newFacing = spirit.corner ? cornerFacing(homeNum) : spirit.facing;
    return {
      respawned: true, livesLeft,
      next: { ...spirit, lives: livesLeft, num: homeNum, facing: newFacing, vibe: spirit.maxVibe },
    };
  }
  return { respawned: false, livesLeft: 0, next: { ...spirit, lives: 0, knockedOut: true } };
}

/**
 * DAMAGE_APPLIED (Phase 5c) — subtract Vibe from target, floored at 0.
 */
export function applyDamageApplied(state, action) {
  const { targetId, dmg = 0 } = action;
  return {
    ...state,
    spirits: state.spirits.map(s =>
      s.id === targetId ? { ...s, vibe: Math.max(0, (s.vibe ?? 0) - dmg) } : s),
  };
}

/**
 * KNOCKDOWN_RESOLVED (Phase 5c) — apply resolveKnockdown transform.
 */
export function applyKnockdownResolved(state, action, corners = CORNERS) {
  const { targetId } = action;
  const spirit = state.spirits.find(s => s.id === targetId);
  if (!spirit) return state;
  const { next } = resolveKnockdown(spirit, corners);
  return {
    ...state,
    spirits: state.spirits.map(s => (s.id === targetId ? next : s)),
  };
}

/**
 * WINNER_DECLARED (Phase 5c) — lock in the match winner.
 */
export function applyWinnerDeclared(state, action) {
  return { ...state, winner: action.winnerId ?? null };
}

/**
 * THE SMASH (Phase 3b) — deterministic, undefendable melee.
 */
export function smashOutcome(thrown) {
  const damage    = Math.min(5, Math.max(1, Math.ceil(thrown / 2)));
  const knockback = Math.min(3, Math.ceil(thrown / 3));
  const scatterN  = Math.floor(thrown / 2);
  return { damage, knockback, scatterN };
}

/**
 * ATTACK_ROLLED (Phase 3b) — roll attack dice on the engine's seeded rng.
 * Swing = single die (d4 base for Thrash, or atkDie). Sonic = keep-highest pool.
 * Defender rolls defDie (d4 for Thrash, d6 for Sonic).
 */
export function applyAttackRolled(state, action, rng) {
  const {
    kind, attackerId, defenderId,
    atkStat = 0, defStat = 0, posing = false, halveDef = false, psychoEligible = false,
    dicePool = null, atkFloor = 0, atkDie = 6, defDie = 6,
  } = action;

  const clampFloor = v => Math.max(v, 1 + atkFloor);

  let atkRoll, diceVals = null, keptIdx = null;
  if (dicePool && dicePool.length) {
    diceVals = dicePool.map(sides => clampFloor(rng.int(sides) + 1));
    atkRoll  = Math.max(...diceVals);
    keptIdx  = diceVals.indexOf(atkRoll);
  } else {
    atkRoll  = clampFloor(rng.int(atkDie) + 1);
  }

  const rawDefRoll = posing ? 0 : rng.int(defDie) + 1;
  let   defRoll    = posing
    ? 0
    : (halveDef ? Math.max(1, Math.floor(rawDefRoll / 2)) : rawDefRoll);

  const psychoBushido = !!psychoEligible && !posing && atkRoll >= 5;
  if (psychoBushido) defRoll = 1;

  const atkTotal    = atkStat + atkRoll;
  const defTotal    = posing ? 0 : defStat + defRoll;
  const attackerWon = atkTotal > defTotal;
  const margin      = Math.abs(atkTotal - defTotal);

  // Damage splits by attack kind
  const damage = kind === 'sonic'
    ? sonicDamage(margin)
    : kind === 'swing'
      ? thrashDamage(margin, !attackerWon)
      : marginToDamage(margin);

  return {
    ...state,
    battle: {
      kind: "attack", attackKind: kind,
      attackerId, defenderId, atkStat, defStat,
      atkRoll, diceVals, keptIdx, rawDefRoll, defRoll, defDie,
      atkTotal, defTotal, attackerWon, margin, damage, psychoBushido,
    },
  };
}

// ─── STANCE v2: FINISHER OUTCOME ────────────────────────────────────────────
// Pure — deterministic finisher math, parameterized per stance. Keeps full
// Smash DNA: costs 2 AP, requires ≥ 2 unused stock, hurls ALL unused stock,
// roots you (no movement after), leaves you Exposed. Damage is FIXED per
// finisher, not derived from thrown-note count.
//
// Returns { damage, range, stackWipe, slideIn, thrown }.
// `stackWipe`:
//   'scatter'    — Smash-style random scatter (Bend, Slide)
//   'obliterate' — clear entire chord stack (Thrash finisher)
// `slideIn`: true for Slide (attacker moves adjacent to target).

export function finisherOutcome(stanceId, thrown) {
  const def = STANCE_DEFS[stanceId];
  if (!def) return smashOutcome(thrown);  // fallback to legacy smash
  const fin = def.finisher;
  return {
    damage:    fin.damage,
    range:     fin.range,
    stackWipe: fin.stackWipe,
    slideIn:   !!fin.slideIn,
    thrown,
    // Legacy compat — the old smash scatterN for scatter-type wipes
    scatterN:  fin.stackWipe === 'scatter' ? Math.floor(thrown / 2) : 0,
    knockback: 0,  // finishers don't knock back (they have other effects)
  };
}

// ─── STANCE v2: PHYSICAL SPECIAL MODIFIERS ──────────────────────────────────
// Pure helpers that compute attack modifiers for each stance's physical special.
// The caller (Game) applies these to the normal swing pipeline.

/**
 * Hammer-On (Solo): Drive −1 for the roll. On hit: 2× damage, capped at
 * 2×THRASH_DAMAGE_CAP.
 */
export function hammerOnDamage(baseDamage) {
  return Math.min(baseDamage * 2, THRASH_DAMAGE_CAP * 2);
}

/**
 * Axe Swing whiff penalty: halve next turn's stock refill.
 * Returns the reduced refill rate.
 */
export function axeSwingWhiffRefill() {
  return Math.floor(STOCK_REFILL_RATE / 2);
}

// ─── STANCE v2: SONIC SPECIAL CONDITIONS ────────────────────────────────────
// Pure predicates that check whether a sonic special's +2 Drive condition is met.

/**
 * Pinch Harmonic (Solo): root note appears ≥ 2× in chord stack.
 */
export function pinchHarmonicCondition(chordStack, rootNote) {
  return chordStack.filter(n => n === rootNote).length >= 2;
}

/**
 * Power Chord (Low Slung): chord stack contains the perfect 5th of the root.
 * Caller passes the fifth note pre-computed (semitonesUp(root, 7)).
 */
export function powerChordCondition(chordStack, fifthNote) {
  return chordStack.includes(fifthNote);
}

/**
 * Gallop (Wide Leg): chord stack is at full capacity.
 * `maxStack` is the spirit's chord stack cap (default 6).
 */
export function gallopCondition(chordStack, maxStack = 6) {
  return chordStack.length >= maxStack;
}

// ─── STANCE v2: PASSIVE EFFECT HELPERS ──────────────────────────────────────

/**
 * Pull-Off (Solo passive): +1 knockback when you win a battle.
 * Returns the adjusted knockback value.
 */
export function pullOffKnockback(baseKnockback) {
  return baseKnockback + 1;
}

/**
 * Feedback (Low Slung passive): if an attack on you deals 0 damage,
 * the attacker takes 1 Vibe damage.
 * Returns the retaliation damage (0 if not triggered).
 */
export function feedbackRetaliation(damageDealt) {
  return damageDealt === 0 ? 1 : 0;
}

/**
 * Headbang (Wide Leg passive): improved fan conversion numbers.
 * Returns { promoteEvery, loyaltyPerDiehard } overrides.
 */
export function headbangFanOverrides() {
  return {
    promoteEvery: 2,        // base FAN_PROMOTE_EVERY is 3
    loyaltyPerDiehard: 16,  // base LOYALTY_PER_DIEHARD is 24
  };
}
