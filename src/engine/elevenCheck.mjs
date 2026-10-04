// ─── 🔊 GOES TO 11 CHECK ─────────────────────────────────────────────────────
// `npm run test:eleven`. Pins `engine/systems/eleven.js` and the three places
// the dial reaches into: `attackParams` (the SET), `rigFor` (the blown amp) and
// `battleFlow.knockback` (the salvaged immunity).
//
// `METALNESS_REWORK_DESIGN.md` §4d. The reason this ability needs its own file
// rather than a section somewhere is that almost none of it lives in one place:
// calling it writes three fields, and every consequence is read somewhere else
// entirely. That is the right shape — it means no system had to learn about the
// ability — but it is also exactly the shape where a rule quietly stops firing.

import assert from "node:assert";
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import { elevenCalled, noteSheetPatched, debuffsTicked, moveBudgetSet } from "./actions.js";
import { attackParams, rigFor } from "./systems/attackParams.js";
import { canCallEleven, ampBlown, atEleven } from "./systems/eleven.js";
import { knockback, runBattleFlow } from "./systems/battleFlow.js";
import { legalActions } from "./policies/legalActions.js";
import { applyBotAction } from "./policies/transition.js";
import { makeRng } from "./rng.js";
import { throwPool } from "./systems/dicePool.js";
import { HEX_BY_NUM, HEX_BY_QR } from "../board/hexMap.js";
import {
  ELEVEN_DRIVE, ELEVEN_AMP_BLOWN_TURNS, ATK_BONUS_CAP, ELEVEN_DIE,
  SONIC_DEF_DIE, SONIC_DEF_DIE_OUT_OF_RIG,
} from "../data/gameConstants.js";

let count = 0;
const ok = (c, m) => { count++; assert.ok(c, m); };
const eq = (a, b, m) => { count++; assert.deepStrictEqual(a, b, m); };

const MM = 'Metalness_Monster';
const RONIN = 'cosmic_ronin';

const base = makeInitialState({
  spirits: [
    { id: MM,    name: 'Metalness Monster', num: 1,  maxVibe: 5, vibe: 5, speed: 4 },
    { id: RONIN, name: 'Shredding Ronin',   num: 30, maxVibe: 5, vibe: 5, speed: 5 },
  ],
  mode: 'ffa', startingLives: 3,
}, 4242);

const apply = (st, a) => applyAction(st, a, makeRng(1));
const withNs = (st, id, patch) => apply(st, noteSheetPatched(id, patch));

/** A sheet with something in both stacks, so there is armour to spend. */
const armed = (st, id, extra = {}) => withNs(st, id, {
  driveStack:   ['E', 'G', 'B'],
  sustainStack: ['C', 'E', 'G'],
  unlockedSkills: ['goes_to_11'],
  hasConfirmed: true,
  ...extra,
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE GATE — the Sustain stack is the price, so it is also the requirement.
// ═════════════════════════════════════════════════════════════════════════════
{
  const bare = withNs(base, MM, { sustainStack: [] });
  ok(!canCallEleven(bare, MM),
     '⚠️ an empty Sustain stack cannot pay — otherwise the price is nothing and a free 11 is a different ability');

  const st = armed(base, MM);
  ok(canCallEleven(st, MM), 'armour in the stack, so there is something to trade');

  const already = withNs(st, MM, { atEleven: true });
  ok(!canCallEleven(already, MM), 'the amp is already on eleven; there is nowhere further to turn it');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE CALL — three fields, and the Sustain stack is GONE.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = apply(armed(base, MM), elevenCalled(MM));
  const ns = st.noteStates[MM];

  ok(atEleven(ns), 'the dial is set');
  eq(ns.sustainStack, [], '⚠️ armour into volume — §0: nothing in his kit had ever read his 6 Sustain');
  eq(ns.ampBlownTurns, ELEVEN_AMP_BLOWN_TURNS, 'and the amp is blown');
  eq(ns.driveStack, ['E', 'G', 'B'], 'the Drive stack is untouched — it is the Sustain he trades');

  // Calling it on an empty stack changes nothing at all, rather than half-firing.
  const bare = withNs(base, MM, { sustainStack: [], unlockedSkills: ['goes_to_11'] });
  eq(apply(bare, elevenCalled(MM)), bare, 'a call that cannot be paid for is a no-op');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. 🔊 THE ELEVEN DIE — it SWAPS IN for his weakest die, and is always kept.
//    ⚠️ REWRITTEN 2026-10-04. This section asserted the old dial — "it SETS the
//    attack to ELEVEN_DRIVE, so it is a ceiling" — through `attackParams`'s
//    single-die tower. Since the chord vocabularies (2026-09-27) the Thrash and
//    the Sonic both throw the rig's pool, and Goes to 11 is the Eleven die: a
//    d6 with five 11s and one 1 (since 2026-09-28), in place of his weakest
//    die, always kept, and a 1 fizzles the whole throw (`dicePool.js`).
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = armed(base, MM);
  const before = attackParams(st, MM, RONIN, 'swing');
  const loud = attackParams(apply(st, elevenCalled(MM)), MM, RONIN, 'swing');

  ok(before.dicePool.length > 0 && !before.dicePool.includes(ELEVEN_DIE), 'un-cranked, an ordinary pool');
  ok(loud.dicePool.includes(ELEVEN_DIE), 'cranked, the Eleven die is in his hand');
  eq(loud.dicePool.length, before.dicePool.length, '…IN PLACE of a die, not on top — the dice count is the chord\'s');
  eq(loud.dicePool.filter(d => d === ELEVEN_DIE).length, 1, '…exactly one of it');
  const lowest = Math.min(...before.dicePool);
  eq([...loud.dicePool].sort(), [...before.dicePool.slice(0, before.dicePool.indexOf(lowest)),
      ...before.dicePool.slice(before.dicePool.indexOf(lowest) + 1), ELEVEN_DIE].sort(),
     '…and it is his WEAKEST die it replaces');

  // Always kept, whatever else he throws.
  for (let seed = 1; seed <= 40; seed++) {
    const t = throwPool([6, 6, 6, 6, ELEVEN_DIE], 2, makeRng(seed));
    ok(t.pool.includes(ELEVEN_DIE), `seed ${seed}: the Eleven die is kept even when only 2 dice count`);
    eq(t.fizzled, t.vals[t.pool.indexOf(ELEVEN_DIE)] === 1, `seed ${seed}: a 1 on it, and only that, fizzles the throw`);
  }
  // A 1 in six: both faces turn up across a modest sweep.
  const faces = new Set(Array.from({ length: 120 }, (_, i) => throwPool([ELEVEN_DIE], 1, makeRng(i + 1)).vals[0]));
  eq([...faces].sort((x, y) => x - y), [1, 11], 'the Eleven die shows 11 — or, sometimes, 1');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. THE BLOWN AMP — offline, not weak, and it costs no new systems.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st   = armed(base, MM);
  const home = st.spirits.find(s => s.id === MM);

  const healthy = rigFor(home, st.noteStates[MM]);
  ok(healthy.inRange, 'with the amp up, he is in rig');
  ok(healthy.pool.length > 1, '…and throws more than the baseline die');

  const blownSt = apply(st, elevenCalled(MM));
  const blown   = rigFor(home, blownSt.noteStates[MM]);
  ok(ampBlown(blownSt.noteStates[MM]), 'the rig is down');
  eq(blown.inRange, false,
     '⚠️ a blown amp reads as OUT OF RIG wherever he stands — the gate legalActions already reads');
  eq(blown.pool.length, 1, '…back to the bare baseline die');

  // ── WHAT THAT ACTUALLY COSTS ─────────────────────────────────────────────
  // The Sonic is not weaker, it is GONE: `legalActions` refuses to emit it.
  const aimed = apply(withNs(blownSt, MM, { melodyLine: [] }), moveBudgetSet(4, false));
  const facing = { ...aimed, spirits: aimed.spirits.map(s => s.id === RONIN ? { ...s, num: 2 } : s), acting: MM };
  ok(!legalActions(facing, MM, {}).some(a => a.kind === 'sonic'),
     '⚠️ the Sonic is OFFLINE, not merely worse — the searcher is never offered it');

  // 🛡️ And the armour he traded is gone: an incoming beam meets no shield.
  // (The old d4 brace — SONIC_DEF_DIE_OUT_OF_RIG — went with the radius; the
  // shield is his Sustain dice now, and Goes to 11 spent his Sustain stack.)
  const incoming = attackParams(blownSt, RONIN, MM, 'sonic');
  eq(incoming.sustainPool, [], '⚠️ …and an incoming beam meets no shield: the Sustain he traded was the shield');
  ok(attackParams(st, RONIN, MM, 'sonic').sustainPool.length > 0, '(which he would have, un-cranked)');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. ⚠️ THE LIFETIME — the trap this codebase has now met four times.
//
// Ticked at the END of his own turn. A seed of 1 would clear before he ever
// played a turn without a rig, so the cost would silently be nothing. That is
// `economy.js`'s long warning on Sunbeam's `blindTurns`, the trap
// `decayPoisonSlime` fell into, and the one the slime road's decay hit again.
// ═════════════════════════════════════════════════════════════════════════════
{
  let st = apply(armed(base, MM), elevenCalled(MM));
  eq(st.noteStates[MM].ampBlownTurns, 2, 'seeded with two, not one');

  st = apply(st, debuffsTicked(MM));            // end of the turn he called it
  ok(ampBlown(st.noteStates[MM]),
     '⚠️ still blown after his own turn ends — a seed of 1 would have cleared here and cost him nothing');
  eq(atEleven(st.noteStates[MM]), false,
     'the DIAL is a this-turn setting though — one attack per turn, so one turn is one enormous swing');

  st = apply(st, debuffsTicked(MM));            // end of the full turn without a rig
  ok(!ampBlown(st.noteStates[MM]), '…and the rig is back the turn after that');

  // ⚠️ THE EARLY-RETURN TRAP. `applyDebuffsTicked` bails when nothing is active,
  // so a blown amp on an otherwise clean sheet — the common case — must count as
  // "something is active" or the tick never runs and the amp never comes back.
  let alone = withNs(base, MM, { ampBlownTurns: 2 });
  alone = apply(alone, debuffsTicked(MM));
  eq(alone.noteStates[MM].ampBlownTurns, 1,
     '⚠️ a blown amp with no other debuff still ticks — it is in the `hadDebuff` guard');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. KNOCKBACK IMMUNITY — salvaged from the ability this one replaced (§1b).
// ═════════════════════════════════════════════════════════════════════════════
{
  const shove = (st) => runBattleFlow(
    knockback({ state: st, fromId: RONIN, targetId: MM, spaces: 2 }),
    st,
    { applyAction: (s, a) => applyAction(s, a, makeRng(3)) },
  );

  // ⚠️ ON OPEN FLOOR. The base fixture stands him on hex 1, a RIM hex, and the
  // straight shove from the Ronin points off the stage — with no ring-out
  // allowed that is a path of zero for reasons that have nothing to do with
  // the dial, and the immunity assertion below would pass on it vacuously.
  const here = HEX_BY_NUM[45];
  const from = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]
    .map(([dq, dr]) => [HEX_BY_QR[`${here.q + dq},${here.r + dr}`], HEX_BY_QR[`${here.q - 2 * dq},${here.r - 2 * dr}`]])
    .find(([nb, back]) => nb && back)[0];
  const open = { ...base, spirits: base.spirits.map(sp =>
    sp.id === MM ? { ...sp, num: 45 } : sp.id === RONIN ? { ...sp, num: from.num } : sp) };
  const moved = shove(open);
  ok(moved.result.path.length > 0, 'ordinarily a 2-hex shove moves him');

  const planted = shove(apply(armed(open, MM), elevenCalled(MM)));
  eq(planted.result.path.length, 0,
     '⚠️ on eleven he does not move an inch. §1b: this was the Beast\'s one genuinely good idea, and the only answer to a Smash this Spirit ever had — cutting the ability is not the same as throwing away the part that worked.');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. THROUGH THE SEARCHER — legal, modelled, and gated where it should be.
// ═════════════════════════════════════════════════════════════════════════════
{
  let st = apply(armed(base, MM), moveBudgetSet(4, false));
  st = { ...st, acting: MM };

  ok(legalActions(st, MM, {}).some(a => a.kind === 'eleven'), 'the searcher is offered the dial');
  eq(legalActions(st, MM, {}).find(a => a.kind === 'eleven').apCost, 0,
     '…for no AP: it buys neither hexes nor violence, so §1\'s pool is the wrong currency');

  // ⚠️ Not after you have already swung. Setting your attack stat once the
  // Action Token is gone does nothing, and offering it would be offering a lie.
  const spent = { ...st, turn: { ...st.turn, actionTokenUsed: true } };
  ok(!legalActions(spent, MM, {}).some(a => a.kind === 'eleven'),
     '⚠️ …and never once the attack is spent');

  const unskilled = withNs(st, MM, { unlockedSkills: [] });
  ok(!legalActions(unskilled, MM, {}).some(a => a.kind === 'eleven'),
     'it is an unlock, not an innate — the road is the innate, this is bought');

  const res = applyBotAction(st, { kind: 'eleven', apCost: 0 }, { rng: makeRng(9) });
  ok(res.ok, 'the transition runs it headlessly');
  eq(res.state.noteStates[MM].sustainStack, [], '…and it really does spend the stack');
  eq(res.state.turn.moveStepsLeft, st.turn.moveStepsLeft, '…while costing no AP');
}

console.log(`✅ elevenCheck — ${count} assertions passed`);
