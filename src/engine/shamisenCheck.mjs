// ─── 🎸 CURSED SHAMISEN CHECK ────────────────────────────────────────────────
// `npm run test:shamisen`. Pins the new Cursed Shamisen: a self-buff that
// accelerates cooldowns, with a debt mechanic that resets them all on damage.
// `RONIN_ABILITY_DESIGN.md` §2.3 is the spec.
//
// 🪦 The old test file pinned `feedShamisenPhrase`, `shamisenRings`,
// `shamisenResolvingPc` and `shamisenNextPc` in `music/cadence.js`. Those
// functions are gone: the Shamisen is no longer a board token with a phrase
// to feed. What lives here now tests `tickShamisen` and `resetAllCooldowns`
// in `engine/systems/cooldowns.js`, plus the constants they rely on.

import assert from "node:assert";
import {
  ABILITY_CD, tickCooldowns, tickShamisen, resetAllCooldowns,
  cooldownLeft, canFire, firePatch,
} from "./systems/cooldowns.js";
import {
  CURSED_SHAMISEN_CD, CURSED_SHAMISEN_DB_COST,
  CURSED_SHAMISEN_DURATION, CURSED_SHAMISEN_PAYOFF_COST,
} from "../data/gameConstants.js";

let count = 0;
const ok = (c, m) => { count++; assert.ok(c, m); };
const eq = (a, b, m) => { count++; assert.deepStrictEqual(a, b, m); };

// ── CONSTANTS ────────────────────────────────────────────────────────────────

eq(CURSED_SHAMISEN_CD, 3, '🎸 3-round cooldown between activations');
eq(CURSED_SHAMISEN_DB_COST, 2, '🎸 2 Db to invoke the curse');
eq(CURSED_SHAMISEN_DURATION, 3, '🎸 the curse runs for 3 rounds');
eq(CURSED_SHAMISEN_PAYOFF_COST, 1,
  '🎸 1 Db per round to pay the debt — separate from the activation cost');
ok(CURSED_SHAMISEN_PAYOFF_COST < CURSED_SHAMISEN_DB_COST,
  '⚠️ the debt payment must be CHEAPER than activation — otherwise paying every round costs more than re-casting, and the bluff collapses');

// ── ABILITY_CD TABLE ─────────────────────────────────────────────────────────

eq(ABILITY_CD['cursed_shamisen'], CURSED_SHAMISEN_CD,
  '🎸 the Shamisen has a cooldown in the table');
ok(ABILITY_CD['psycho_bushido'] > 0,
  '🎸 Bushido has a cooldown (one of the abilities the Shamisen accelerates)');
ok(ABILITY_CD['shadow_illusion'] > 0,
  '🎸 Shadow Illusion has a cooldown');

// ── tickShamisen — the 2× acceleration ──────────────────────────────────────

{
  const ns = { abilityCd: {
    psycho_bushido: 4,
    shadow_illusion: 3,
    cursed_shamisen: 3,
  }};

  const result = tickShamisen(ns);

  eq(result['psycho_bushido'], 3,
    '🎸 Bushido ticks DOWN by 1 extra');
  eq(result['shadow_illusion'], 2,
    '🎸 Shadow Illusion ticks DOWN by 1 extra');
  eq(result['cursed_shamisen'], 3,
    '⚠️ THE SHAMISEN\'S OWN COOLDOWN IS UNTOUCHED — it must NOT accelerate itself, or you get a recursive loop that makes the ability free');
}

{
  // tickShamisen stacked on tickCooldowns = 2 ticks per round for others,
  // 1 tick for shamisen itself. This is what "2× speed" means.
  const ns = { abilityCd: {
    psycho_bushido: 4,
    cursed_shamisen: 2,
  }};

  const afterNormal = tickCooldowns(ns);
  eq(afterNormal['psycho_bushido'], 3, '🕒 normal tick: Bushido 4→3');
  eq(afterNormal['cursed_shamisen'], 1, '🕒 normal tick: Shamisen 2→1');

  const afterBoth = tickShamisen({ abilityCd: afterNormal });
  eq(afterBoth['psycho_bushido'], 2,
    '⚡ normal + shamisen tick: Bushido 4→3→2 in one round — that is 2× speed');
  eq(afterBoth['cursed_shamisen'], 1,
    '⚠️ Shamisen stays at 1 — it only got the normal tick, not its own extra');
}

{
  // Floors at 0 — never goes negative
  const ns = { abilityCd: { psycho_bushido: 0, shadow_illusion: 1 }};
  const result = tickShamisen(ns);
  eq(result['psycho_bushido'], 0,
    '🎸 already at 0 stays at 0 — no negative cooldowns');
  eq(result['shadow_illusion'], 0,
    '🎸 1 ticks to 0');
}

{
  // Empty or missing abilityCd
  const result1 = tickShamisen({});
  eq(result1, {}, '🎸 empty sheet returns empty map');
  const result2 = tickShamisen(null);
  eq(result2, {}, '🎸 null sheet returns empty map');
}

// ── resetAllCooldowns — the punishment ──────────────────────────────────────

{
  const ns = { abilityCd: {
    psycho_bushido: 1,
    shadow_illusion: 0,
    cursed_shamisen: 2,
  }};
  // 🪦 `wa_no_koe` was the fourth id here until 2026-09-04. It is CUT
  // (RONIN_ABILITY_DESIGN §2.4) and the guard below replaces the row it had.
  const unlocked = ['psycho_bushido', 'shadow_illusion', 'cursed_shamisen'];
  const result = resetAllCooldowns(ns, unlocked);

  eq(result['psycho_bushido'], ABILITY_CD['psycho_bushido'],
    '💀 Bushido RESETS to full duration — you lose all the progress you made');
  eq(result['shadow_illusion'], ABILITY_CD['shadow_illusion'],
    '💀 Shadow Illusion resets to full even though it was already ready');
  eq(result['cursed_shamisen'], ABILITY_CD['cursed_shamisen'],
    '💀 the Shamisen ITSELF resets too — the punishment is total');
  // ⚠️ THE CUT, GUARDED AT THE COOLDOWN TABLE. The Ronin's kit is THREE until
  // 🌀 Shukuchi lands. A `wa_no_koe` row appearing in `ABILITY_CD` again would
  // mean the ability came back through the cooldown door — the one place a dead
  // id can start ticking without anybody adding a skill row.
  eq(ABILITY_CD['wa_no_koe'], undefined,
    '🪦 Wa no Koe holds no cooldown seat — it is cut, not merely un-purchasable');
  eq(result['wa_no_koe'], undefined,
    '🪦 …and resetAllCooldowns writes nothing under its id');
}

{
  // Only abilities WITH a cooldown in ABILITY_CD get reset
  const ns = { abilityCd: { psycho_bushido: 1 }};
  const unlocked = ['psycho_bushido', 'some_future_ability'];
  const result = resetAllCooldowns(ns, unlocked);
  eq(result['psycho_bushido'], ABILITY_CD['psycho_bushido'],
    '💀 known ability resets');
  ok(!('some_future_ability' in result) || result['some_future_ability'] === 0,
    '🎸 an ability not in ABILITY_CD cannot be reset to a max that does not exist');
}

{
  // Empty unlocked list — nothing to reset to, but existing state is preserved
  const ns = { abilityCd: { psycho_bushido: 1 }};
  const result = resetAllCooldowns(ns, []);
  eq(result['psycho_bushido'], 1,
    '🎸 with no unlocked skills, existing CDs are kept as-is');
}

// ── firePatch — activation cost and cooldown ────────────────────────────────

{
  const ns = { dbPoints: 10, abilityCd: {} };
  const patch = firePatch(ns, 'cursed_shamisen');
  eq(patch.dbPoints, 10 - CURSED_SHAMISEN_DB_COST,
    '🎸 firing the Shamisen costs exactly CURSED_SHAMISEN_DB_COST Db');
  eq(patch.abilityCd['cursed_shamisen'], CURSED_SHAMISEN_CD,
    '🎸 …and starts the cooldown at CURSED_SHAMISEN_CD rounds');
}

// ── canFire — the gate ──────────────────────────────────────────────────────

{
  const ready = { dbPoints: 5, abilityCd: { cursed_shamisen: 0 } };
  ok(canFire(ready, 'cursed_shamisen'),
    '🎸 Shamisen is ready when CD is 0 and Db is enough');

  const broke = { dbPoints: 1, abilityCd: { cursed_shamisen: 0 } };
  ok(!canFire(broke, 'cursed_shamisen'),
    '⚠️ cannot fire with fewer Db than the cost');

  const cooling = { dbPoints: 5, abilityCd: { cursed_shamisen: 2 } };
  ok(!canFire(cooling, 'cursed_shamisen'),
    '⚠️ cannot fire while still on cooldown');
}

// ── DESIGN INVARIANTS ───────────────────────────────────────────────────────

ok(CURSED_SHAMISEN_DURATION === CURSED_SHAMISEN_CD,
  '📌 duration equals cooldown — the curse expires the same turn it comes off CD, so there is no overlap window where Ronin runs two curses at once. If this equality breaks, the UI needs an "already cursed" guard.');

ok(CURSED_SHAMISEN_DURATION * CURSED_SHAMISEN_PAYOFF_COST < CURSED_SHAMISEN_DURATION + CURSED_SHAMISEN_DB_COST,
  '📌 total debt (3×1=3 Db) is LESS than activation + duration — paying every round is still cheaper than being caught, which is what keeps the bluff alive');

console.log(`\n✅ shamisenCheck: ${count} assertions passed — the curse accelerates, the debt protects, the glow bluffs`);
