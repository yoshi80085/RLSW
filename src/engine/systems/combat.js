// ─── ENGINE SYSTEM: COMBAT ───────────────────────────────────────────────────
// Phase 3a: the pure combat MATH — damage/knockback/fame tables — extracted
// verbatim from Game so a server can score battles identically. No actions,
// no state mutation, no timers yet: those land in 3b–3e (rolls → DAMAGE_APPLIED
// → KNOCKBACK_MOVED → KNOCKED_OUT → RETALIATION_*). `Game` imports these the
// same way it imports `riffStats` — single source of truth for the tables.

import {
  UNDERDOG_MIN_DEFICIT, UNDERDOG_DEFICIT_PER_STEP, UNDERDOG_MAX_MULT,
} from "../../data/gameConstants.js";
import { CORNERS } from "../../data/corners.js";
import { cornerFacing } from "../../board/boardHelpers.js";

/**
 * Damage table: battle margin → Vibe damage (softened — wider bands, low
 * ceiling). Used by swing, sonic, smash and the riff-off damage hookup.
 */
export function marginToDamage(margin) {
  if (margin <= 3)  return 1;
  if (margin <= 6)  return 2;
  if (margin <= 9)  return 3;
  if (margin <= 12) return 4;
  return 5;
}

/**
 * Knockback distance in hexes. A Swing defeat always shoves 1; a Sonic defeat
 * scales with margin (1–2 → 1, 3–4 → 2, 5+ → 3, capped at 3).
 * `bs` is the battle-state-shaped object (`{ sonicAttack, margin }`); `margin`
 * may be passed explicitly to override `bs.margin` (matches Game's call sites).
 */
export function knockbackSpaces(bs, margin) {
  const m = margin ?? bs?.margin ?? 1;
  return bs?.sonicAttack ? Math.min(3, Math.max(1, Math.ceil(m / 2))) : 1;
}

/** Base Fame earned for a win, by margin. Bigger margin, bigger legend. */
export function fameFromMargin(margin) {
  if (margin <= 3) return 1;
  if (margin <= 6) return 2;
  return 3;
}

/**
 * 🔥 Underdog / comeback amplifier — pure over the two Fame totals.
 * When the winner was TRAILING the loser by ≥ UNDERDOG_MIN_DEFICIT, the base
 * payout is ramped by the deficit (capped by UNDERDOG_MAX_MULT) and then
 * clamped so a single comeback win never vaults the winner clean PAST the
 * loser — it closes the gap to at most level. Returns `{ fp, deficit, mult }`.
 *
 * The `!loserId`/self-hit guard stays in Game (it owns spirit identity); this
 * fn takes the resolved Fame numbers so it can live in the engine unchanged.
 */
export function underdogBonus(winnerFame, loserFame, baseFp) {
  const deficit = loserFame - winnerFame;      // how far the winner was trailing
  if (deficit < UNDERDOG_MIN_DEFICIT) return { fp: baseFp, deficit: 0, mult: 1 };
  const mult = Math.min(UNDERDOG_MAX_MULT, 1 + (deficit / UNDERDOG_DEFICIT_PER_STEP) * 0.5);
  let fp = Math.round(baseFp * mult);
  const maxFp = Math.max(baseFp, deficit); // never overshoot past the loser
  fp = Math.min(fp, maxFp);
  return { fp, deficit, mult };
}

/**
 * 🥊 COUNTER_ROLLED (Phase 3d) — a glanced defender swings back. The engine
 * rolls a counter d6, adds a Vibe bonus (`round(vibe/maxVibe × 3)`), and the
 * counter LANDS when the total clears the attacker's winning die (`target`).
 * Verbatim from Game.resolveRetaliation; merged into the live `battle` slice so
 * the spin overlay can read the already-decided `counterRoll`.
 */
export function applyCounterRolled(state, action, rng) {
  const { defenderId, vibe = 1, maxVibe = 1, target = 1 } = action;
  const vibeBonus      = Math.round((vibe / maxVibe) * 3);
  const counterRoll    = rng.int(6) + 1;
  const counterTotal   = counterRoll + vibeBonus;
  const counterSuccess = counterTotal >= target;
  return {
    ...state,
    battle: {
      ...(state.battle ?? {}),
      defenderId,
      counterRoll, vibeBonus, counterTotal,
      counterTarget: target, counterSuccess,
    },
  };
}

/**
 * 🥊 counterOutcome (Phase 3d) — a LANDED counter's margin → damage, verbatim
 * from Game.finishCounter: `counterMargin = max(1, total − target + 1)`, then
 * the shared `marginToDamage` table. (A failed counter uses the attacker's
 * `margin + 2` back through `marginToDamage` and stays inline in the client.)
 */
export function counterOutcome(counterTotal, counterTarget) {
  const counterMargin = Math.max(1, counterTotal - counterTarget + 1);
  return { counterMargin, counterDmg: marginToDamage(counterMargin) };
}

/**
 * 🏆 decideWinner (Phase 3c kernel) — the boss-aware win check, verbatim from
 * Game.knockOut.checkWinner. Pure predicate over the (already post-KO) spirits:
 *   • A Rock God on the board changes the rule: last-Spirit-standing does NOT
 *     win — only a TOTAL wipe resolves it, and the God keeps the crown
 *     (`godTriumphs`). While a God holds the gate no PvP winner is declared.
 *   • Otherwise: one survivor wins; a mutual wipe credits a still-standing
 *     attacker (a faithful port — with 0 survivors the attacker is down too, so
 *     this branch is effectively unreachable, kept for exactness).
 * Returns `{ winnerId, godTriumphs }`; the client runs the timers/setWinner.
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
 * 💥 resolveKnockdown (Phase 3c kernel) — the respawn/KO state transform,
 * verbatim from Game.knockOut / applyVibeDamage. A downed Spirit either pops
 * back up at its home corner with full Vibe (a life spent), or, out of lives, is
 * knocked out for good. Returns the flag + the spirit's `next` shape; the client
 * applies it and runs the Fame penalty, flashes, and slide-off cinematic.
 * @param {object} spirit  the downed spirit (pre-transform)
 * @param {object} [corners=CORNERS]  corner → { homeNum } map (injectable for tests)
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
 * DAMAGE_APPLIED (Phase 5c) — subtract Vibe from the target on the engine's
 * spirits, floored at 0. Pure; the KO/respawn check is a separate action. Mirrors
 * the core of Game.applyVibeDamage (`vibe = max(0, vibe − dmg)`), minus the FX.
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
 * KNOCKDOWN_RESOLVED (Phase 5c) — apply the `resolveKnockdown` transform to the
 * downed spirit: respawn to the home corner with full Vibe (a life spent), or KO
 * for good when out of lives. Mirrors Game.knockOut.applyKnockOut, which already
 * uses the same kernel — this just makes the engine spirits authoritative for it.
 * @param {object} [corners=CORNERS] injectable corner map (tests)
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
 * WINNER_DECLARED (Phase 5c) — lock in the match `winner` slice. The boss-aware
 * decision is `decideWinner` (run by the caller); this records its result.
 */
export function applyWinnerDeclared(state, action) {
  return { ...state, winner: action.winnerId ?? null };
}

/**
 * 🎸💥 THE SMASH (Phase 3b) — deterministic, undefendable melee: no dice roll.
 * Outcome scales purely with `thrown` (the count of unused stock notes hurled):
 *   • damage    — ⌈thrown/2⌉, floored at 1, capped at 5. Shredding Ronin's own
 *                 Smash lands SOFT (≈half, min 1) — brute force isn't his art.
 *   • knockback — ⌈thrown/3⌉, capped at 3 hexes.
 *   • scatterN  — ⌊thrown/2⌋ of the rival's unused notes knocked loose; DOUBLED
 *                 when the target is Shredding Ronin (weak to the windmill).
 * Same formula backs Blaster of Ra (Intergalactic 0's ranged replacement), so
 * this is the single source of truth. The state changes (Exposed, stock scatter,
 * damage application) stay in Game until noteStates/combat join in Phases 3c/5.
 */
export function smashOutcome(thrown, { roninSmasher = false, roninTarget = false } = {}) {
  const baseDmg   = Math.min(5, Math.max(1, Math.ceil(thrown / 2)));
  const damage    = roninSmasher ? Math.max(1, Math.floor(baseDmg / 2)) : baseDmg;
  const knockback = Math.min(3, Math.ceil(thrown / 3));
  const scatterN  = Math.floor(thrown / 2) * (roninTarget ? 2 : 1);
  return { damage, knockback, scatterN };
}

/**
 * ATTACK_ROLLED (Phase 3b) — roll the attack's dice on the engine's seeded rng
 * and store the verdict in `state.battle`. Verbatim math from Game.initiateSwing
 * / initiateSonicAttack:
 *   • SWING (no `dicePool`) — the attacker rolls a single d6.
 *   • SONIC (`dicePool` = amp-scaled sizes, e.g. [6,6], [6,6,8], [8,8,8]) — roll
 *     each die and KEEP THE HIGHEST; `diceVals` + `keptIdx` record the pool for
 *     the overlay.
 * The defender path is shared: a posing defender rolls nothing (0); otherwise a
 * d6, halved (min 1) under Laser Show; Psycho Bushido (swing only) collapses the
 * defender's die to 1 when the attacker rolls a 5/6. Totals add the pre-computed
 * stats, the higher total wins, and the margin maps to damage via `marginToDamage`.
 *
 * The client passes `atkStat`/`defStat`, the mod flags, and (for sonic) the
 * `dicePool` — all depend on noteStates/board state (Phase 5). The engine owns
 * the dice and the verdict; the spin overlay reads the already-decided faces.
 */
export function applyAttackRolled(state, action, rng) {
  const {
    kind, attackerId, defenderId,
    atkStat = 0, defStat = 0, posing = false, halveDef = false, psychoEligible = false,
    dicePool = null,
  } = action;

  // Attacker roll: keep-highest sonic pool, or a plain swing d6.
  let atkRoll, diceVals = null, keptIdx = null;
  if (dicePool && dicePool.length) {
    diceVals = dicePool.map(sides => rng.int(sides) + 1);
    atkRoll  = Math.max(...diceVals);
    keptIdx  = diceVals.indexOf(atkRoll);
  } else {
    atkRoll  = rng.int(6) + 1; // d6, 1–6
  }

  const rawDefRoll = posing ? 0 : rng.int(6) + 1;    // posing defender rolls nothing
  let   defRoll    = posing
    ? 0
    : (halveDef ? Math.max(1, Math.floor(rawDefRoll / 2)) : rawDefRoll);

  // 🌀 Psycho Bushido — a 5/6 stuns the rival into folding: their die drops to 1.
  const psychoBushido = !!psychoEligible && !posing && atkRoll >= 5;
  if (psychoBushido) defRoll = 1;

  const atkTotal    = atkStat + atkRoll;
  const defTotal    = posing ? 0 : defStat + defRoll;
  const attackerWon = atkTotal > defTotal;
  const margin      = Math.abs(atkTotal - defTotal);
  const damage      = marginToDamage(margin);

  return {
    ...state,
    battle: {
      kind: "attack", attackKind: kind,
      attackerId, defenderId,
      atkStat, defStat,
      atkRoll, diceVals, keptIdx, rawDefRoll, defRoll,
      atkTotal, defTotal,
      attackerWon, margin, damage,
      psychoBushido,
    },
  };
}
