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
import {
  ELEVEN_DRIVE, ELEVEN_AMP_BLOWN_TURNS, ATK_BONUS_CAP,
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
// 3. ⚠️ IT SETS, IT DOES NOT ADD — so it is a CEILING as much as a floor.
//    This is the whole ability, and the half people forget is the second one.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = armed(base, MM);
  const before = attackParams(st, MM, RONIN, 'swing');

  const loud = attackParams(apply(st, elevenCalled(MM)), MM, RONIN, 'swing');
  eq(loud.atkStat, ELEVEN_DRIVE, 'cranked, he swings at exactly eleven');
  ok(loud.atkStat > before.atkStat, '…which is louder than the chord alone');
  ok(loud._derived.cranked, 'and the derivation says why');

  // ── THE JOKE, AND THE BALANCE LEVER, ARE THE SAME RULE ───────────────────
  // Pile every legal buff on first. The tower is capped at ATK_BONUS_CAP, so the
  // biggest honest attack is chord + 5 — and on a DRIVE-LEAN chord that clears
  // 11 comfortably: a dom7 is worth 8 (a dom13, the fattest in the table, is 10).
  // The minor triad the rest of this file uses is only 5, i.e. 10 towered, which
  // is why the down-turn needs a real chord to demonstrate. Worth knowing in its
  // own right: the ceiling only bites when he has actually built something.
  const towered = withNs(st, MM, {
    driveStack: ['C', 'E', 'G', 'A#'],
    tempDrive: ATK_BONUS_CAP, moshDrive: ATK_BONUS_CAP,
  });
  const tall    = attackParams(towered, MM, RONIN, 'swing');
  ok(tall.atkStat > ELEVEN_DRIVE,
     'a fully-towered swing is already louder than eleven (otherwise the next assertion proves nothing)');

  const turnedDown = attackParams(apply(towered, elevenCalled(MM)), MM, RONIN, 'swing');
  eq(turnedDown.atkStat, ELEVEN_DRIVE,
     '⚠️ …and calling it TURNS HIM DOWN. The amp only goes to 11.');
  ok(turnedDown.atkStat < tall.atkStat, 'strictly quieter than not calling it');
  ok(turnedDown._derived.crankedDown, 'the derivation flags that this call cost him damage');

  // ── AND THE CAP IS UNTOUCHED, which is why no exemption was needed. ──────
  // The ability this replaced took its +6 by riding `atkBase`, i.e. by being
  // written OUTSIDE ATK_BONUS_CAP. A cap with an exemption in it is not a cap.
  eq(tall._derived.atkBonusCapped, true,
     '⚠️ the ordinary bonus tower is still capped — Eleven overwrites the total instead of exempting itself from the rule');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. THE BLOWN AMP — offline, not weak, and it costs no new systems.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st   = armed(base, MM, { unlockedSkills: ['goes_to_11', 'amp_1', 'amp_2', 'power_1', 'range_1'] });
  const home = st.spirits.find(s => s.id === MM);

  const healthy = rigFor(home, st.noteStates[MM]);
  ok(healthy.inRange, 'standing at home with a real rig, he is in range');
  ok(healthy.pool.length > 1, '…and throws more than the baseline die');

  const blownSt = apply(st, elevenCalled(MM));
  const blown   = rigFor(home, blownSt.noteStates[MM]);
  ok(ampBlown(blownSt.noteStates[MM]), 'the rig is down');
  eq(blown.inRange, false,
     '⚠️ a blown amp reads as OUT OF RIG wherever he stands — §3.1\'s existing rule, reused whole rather than reimplemented');
  eq(blown.pool.length, 1, '…back to the bare baseline die');

  // ── WHAT THAT ACTUALLY COSTS, both halves ────────────────────────────────
  // 1. The Sonic is not weaker, it is GONE: `legalActions` refuses to emit it.
  const aimed = apply(withNs(blownSt, MM, { melodyLine: [] }), moveBudgetSet(4, false));
  const facing = { ...aimed, spirits: aimed.spirits.map(s => s.id === RONIN ? { ...s, num: 2 } : s), acting: MM };
  ok(!legalActions(facing, MM, {}).some(a => a.kind === 'sonic'),
     '⚠️ the Sonic is OFFLINE, not merely worse — the searcher is never offered it');

  // 2. He braces on a bare d4 when a beam comes back at him.
  const incoming = attackParams(blownSt, RONIN, MM, 'sonic');
  eq(incoming.defDie, SONIC_DEF_DIE_OUT_OF_RIG,
     '⚠️ …and he answers an incoming beam on a d4 instead of a d6 — the worst square on the board, brought to him');
  const safe = attackParams(st, RONIN, MM, 'sonic');
  eq(safe.defDie, SONIC_DEF_DIE, '(which he would not, with the rig up)');
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

  const moved = shove(base);
  ok(moved.result.path.length > 0, 'ordinarily a 2-hex shove moves him');

  const planted = shove(apply(armed(base, MM), elevenCalled(MM)));
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
