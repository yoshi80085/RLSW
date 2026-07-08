// ─── ENGINE SYSTEM: ROCK GOD (Phase 6c) ──────────────────────────────────────
// The endgame boss is ENGINE state (Phase 6c flip): `state.rockGod` owns the
// one-god-per-game flag, the god's live object (HP / position / telegraph /
// winded / lastAttack), and the fight's outcome. The rules ported verbatim
// from the client's ROCK GOD SYSTEM:
//   GOD_SUMMONED      — descend to the Limelight (HP scales with living Spirits)
//   GOD_DAMAGED       — a Spirit's hit lands (engine doubles it while WINDED)
//   GOD_ACTED         — the God's whole end-of-turn answer: an armed telegraph
//                       resolves, or a winded God recovers, or a NEW attack
//                       opens (weighted pick on engine rng, no immediate
//                       repeat; mosh shoves move the engine spirits directly)
//   GOD_DEFEATED / GOD_TRIUMPHED — lock the outcome slice
//   GOD_TIMER_EXPIRED — replay-log record of the boss clock dying (the timer
//                       itself is CLIENT; vengeance damage flows through
//                       DAMAGE_APPLIED like any hit)
// The client renders reports (lastHit / lastAct) for logs, flashes, damage
// timing, and camera moves; taunts stay client Math.random (log-only flavor).

import { ROCK_GODS, ROCK_GOD_HP_PER_SPIRIT, pickGodAttack } from "../../data/rockGods.js";
import { LIMELIGHT_HEX } from "../../data/gameConstants.js";
import { hexesWithin, slideLine, shoveAwayHex, nearestSpiritTo } from "../../board/rockGodFx.js";

/**
 * GOD_ATTACK_PICKED { godId, lastAttackId } — standalone weighted draw over a
 * god's attack deck (no immediate repeat) on engine rng. Superseded by
 * GOD_ACTED (which picks internally) but kept for replay compatibility and
 * as the minimal pick primitive. Report: `state.rockGod.lastPick`.
 */
export function applyGodAttackPicked(state, { godId, lastAttackId = null }, rng) {
  const def = ROCK_GODS[godId];
  const pick = def ? pickGodAttack(def, lastAttackId, rng) : null;
  return {
    ...state,
    rockGod: { ...(state.rockGod ?? {}), lastPick: pick ? { godId, attackId: pick.id } : null },
  };
}

/**
 * GOD_SUMMONED { leaderId, godId } — ONE god per game descends to the
 * Limelight. The god pick itself stays client (`pickRockGod` reads amps,
 * which are still React-owned) and rides in the payload; HP scales with the
 * engine's own living-spirit count. The Limelight squatter shove + all the
 * pageantry stay client.
 */
export function applyGodSummoned(state, { godId }) {
  const rg = state.rockGod ?? {};
  if (rg.summoned) return state; // one god per game, ever
  const alive = state.spirits.filter(sp => !sp.knockedOut);
  const hp = ROCK_GOD_HP_PER_SPIRIT * Math.max(1, alive.length);
  return {
    ...state,
    rockGod: {
      ...rg,
      summoned: true,
      god: { id: godId, num: LIMELIGHT_HEX, hp, maxHp: hp, winded: false, telegraph: null, lastAttack: null },
    },
  };
}

/**
 * GOD_DAMAGED { spiritId, dmg } — a Spirit's strike lands. `dmg` is the RAW
 * chord-drive damage; the reducer owns the WINDED ×2 rule (single source —
 * client and server can never disagree on the double). HP floors at 0; a
 * killing blow also clears the telegraph (the fall interrupts the wind-up).
 * Report: `lastHit { spiritId, dmg(final), defeated }`. Fame for the hit stays
 * client (grantFame → FAME_CHANGED, amplify=false).
 */
export function applyGodDamaged(state, { spiritId, dmg }) {
  const rg = state.rockGod ?? {};
  const god = rg.god;
  if (!god || god.hp <= 0 || rg.outcome) {
    return { ...state, rockGod: { ...rg, lastHit: null } };
  }
  const final = god.winded ? dmg * 2 : dmg;
  const hp = Math.max(0, god.hp - final);
  const defeated = hp <= 0;
  return {
    ...state,
    rockGod: {
      ...rg,
      god: defeated ? { ...god, hp: 0, telegraph: null } : { ...god, hp },
      lastHit: { spiritId, dmg: final, defeated },
    },
  };
}

/**
 * GOD_ACTED — the God answers at the end of a player turn (rules verbatim from
 * the client rockGodAct):
 *   1) an armed telegraph RESOLVES (thunderclap AoE / power slide — the slide
 *      moves the god and leaves him WINDED),
 *   2) else a winded God spends the beat recovering,
 *   3) else a NEW attack opens: weighted pick on engine rng (no immediate
 *      repeat) — thunderclap/power-slide telegraph one turn ahead (the slide
 *      aims at the engine's FP leader), face-melter zaps the nearest Spirit,
 *      mosh command shoves everyone outward (engine spirits move here; boxed-in
 *      Spirits are reported crushed).
 * Report: `lastAct` — { kind: 'resolved'|'recovered'|'telegraph'|'fizzled'|
 * 'melted'|'moshed', ... } (null when the fight isn't live). Damage
 * application, hazard entry checks on shoved Spirits, logs/FX/camera stay
 * client, played off the report at the same beats as before.
 */
export function applyGodActed(state, _action, rng) {
  const rg = state.rockGod ?? {};
  const god = rg.god;
  const noAct = () => ({ ...state, rockGod: { ...rg, lastAct: null } });
  if (!god || god.hp <= 0 || rg.outcome || state.winner) return noAct();
  const def = ROCK_GODS[god.id];
  const live = state.spirits.filter(sp => !sp.knockedOut);
  if (!def || !live.length) return noAct();

  // 1) An armed telegraph RESOLVES.
  if (god.telegraph) {
    const t = god.telegraph;
    if (t.attackId === "thunderclap") {
      const caught = live.filter(sp => t.hexes.includes(sp.num)).map(sp => sp.id);
      return {
        ...state,
        rockGod: {
          ...rg,
          god: { ...god, telegraph: null, lastAttack: "thunderclap" },
          lastAct: { kind: "resolved", attackId: "thunderclap", label: t.label, dmg: t.dmg, caught },
        },
      };
    }
    if (t.attackId === "power_slide") {
      const caught = live.filter(sp => t.hexes.includes(sp.num)).map(sp => sp.id);
      return {
        ...state,
        rockGod: {
          ...rg,
          god: { ...god, num: t.end, telegraph: null, winded: true, lastAttack: "power_slide" },
          lastAct: { kind: "resolved", attackId: "power_slide", label: t.label, dmg: t.dmg, caught, end: t.end },
        },
      };
    }
    return noAct(); // unknown telegraph kind — defensive parity (old code idled)
  }

  // 2) Winded → he spends the beat recovering (the punish window closes).
  if (god.winded) {
    return {
      ...state,
      rockGod: { ...rg, god: { ...god, winded: false }, lastAct: { kind: "recovered" } },
    };
  }

  // 3) Open a new attack — weighted pick on ENGINE rng, no immediate repeat.
  const atk = pickGodAttack(def, god.lastAttack ?? null, rng);
  if (!atk) return noAct();
  if (atk.id === "thunderclap") {
    const hexes = hexesWithin(god.num, atk.radius);
    return {
      ...state,
      rockGod: {
        ...rg,
        god: { ...god, telegraph: { attackId: "thunderclap", label: atk.label, warn: atk.warn, hexes, dmg: atk.dmg } },
        lastAct: { kind: "telegraph", attackId: "thunderclap", warn: atk.warn },
      },
    };
  }
  if (atk.id === "power_slide") {
    // Aim the slide at the FP leader — the Gods punish success.
    const target = [...live].sort((a, b) =>
      (state.noteStates?.[b.id]?.fame ?? 0) - (state.noteStates?.[a.id]?.fame ?? 0))[0];
    const { path, end } = slideLine(god.num, target.num);
    if (!path.length) {
      return {
        ...state,
        rockGod: {
          ...rg,
          god: { ...god, lastAttack: "power_slide" },
          lastAct: { kind: "fizzled", attackId: "power_slide" },
        },
      };
    }
    return {
      ...state,
      rockGod: {
        ...rg,
        god: { ...god, telegraph: { attackId: "power_slide", label: atk.label, warn: atk.warn, hexes: path, end, dmg: atk.dmg } },
        lastAct: { kind: "telegraph", attackId: "power_slide", warn: atk.warn, targetId: target.id },
      },
    };
  }
  if (atk.id === "face_melter") {
    const target = nearestSpiritTo(god.num, live);
    if (!target) return noAct();
    return {
      ...state,
      rockGod: {
        ...rg,
        god: { ...god, lastAttack: "face_melter" },
        lastAct: { kind: "melted", attackId: "face_melter", label: atk.label, targetId: target.id, dmg: atk.dmg },
      },
    };
  }
  if (atk.id === "mosh_command") {
    const occupied = [...live.map(sp => sp.num), god.num];
    const moves = [];
    const crushed = [];
    for (const sp of live) {
      const dest = shoveAwayHex(sp.num, god.num, occupied);
      if (dest) { moves.push({ id: sp.id, to: dest }); occupied.push(dest); }
      else crushed.push(sp.id);
    }
    const byId = new Map(moves.map(m => [m.id, m.to]));
    const spirits = moves.length
      ? state.spirits.map(sp => (byId.has(sp.id) ? { ...sp, num: byId.get(sp.id) } : sp))
      : state.spirits;
    return {
      ...state,
      spirits,
      rockGod: {
        ...rg,
        god: { ...god, lastAttack: "mosh_command" },
        lastAct: { kind: "moshed", attackId: "mosh_command", label: atk.label, dmg: atk.dmg, moves, crushed },
      },
    };
  }
  return noAct();
}

/**
 * GOD_DEFEATED { killerId } — the God falls; the Spirits win the boss fight.
 * Locks `outcome: 'spirits'`. Kill-blow fame, the champion crowning (and its
 * WINNER_DECLARED) stay client orchestration.
 */
export function applyGodDefeated(state, _action) {
  const rg = state.rockGod ?? {};
  if (rg.outcome) return state;
  return { ...state, rockGod: { ...rg, outcome: "spirits" } };
}

/** GOD_TRIUMPHED — every Spirit lies silent; the crown stays with the Gods. */
export function applyGodTriumphed(state) {
  const rg = state.rockGod ?? {};
  if (rg.outcome) return state;
  return { ...state, rockGod: { ...rg, outcome: "god" } };
}

/**
 * GOD_TIMER_EXPIRED { spiritId } — the acting human let the boss clock die.
 * Pure replay-log record: the timer is CLIENT, and the Vengeance damage the
 * client deals flows through DAMAGE_APPLIED like any other hit.
 */
export function applyGodTimerExpired(state, { spiritId }) {
  return { ...state, rockGod: { ...(state.rockGod ?? {}), lastTimerExpiry: { spiritId } } };
}
