// ─── 🗡️ PSYCHO BUSHIDO + 👤 SHADOW ILLUSION — THE 2026-09-04f RESPEC ─────────
// Run: `npm run test:bushido`
//
// Coverage for step (c) of `RONIN_ABILITY_DESIGN.md` §8.1 — the respec Alex
// settled across 2026-09-04e and 2026-09-04f. §2.1.1 and §2.2.1 are the specs.
//
// ⚠️ THIS IS A RULE, NOT A REFACTOR, WHICH IS WHY IT HAS ITS OWN FILE. The
// ability changed shape in four places at once — the window, the payout, the AP
// bill and a brand-new price paid in PROGRESSION currency — and three of those
// four are duplicated between `legalActions.js`, `transition.js` and the client.
// `CLAUDE.md`: a check without a script is not a suite, so this one is wired
// into `test:all` in the same pass it was written.
//
// Five properties matter more than any individual number:
//
//   1. THE WINDOW IS A REFUSAL, NOT A POOR PAYOUT. Before the respec the close
//      charge was legal and merely bad, because the dash billed the whole AP
//      pool. The bill is FLAT now, so "bad" would have become "free" — a 3 AP
//      charge from next door would be a Swing with a bonus stapled to it. If
//      §min-range ever stops refusing, the ability silently becomes that.
//   2. THE LADDER RISES. §2.1 says the ability IS the distance gradient. The
//      sign has already flipped once (`SEQUENCING.md` §B8: the bonus used to pay
//      MOST for a charge of zero hexes), so monotonicity is asserted directly
//      rather than trusted to a table nobody re-reads.
//   3. THE BILL IS FLAT AND IT IS THE SAME BILL IN BOTH ENGINES. A kernel that
//      charges less than the client is a searcher playing a cheaper game — the
//      exact failure `melodyCommit.js` warns about and §5-hopport.D caught.
//   4. THE DRIVE-STACK PRICE TAKES FROM THE FRONT, LIKE EVERY OTHER DRIVE SPEND.
//      `attackParams.js` slices `SWING_DRIVE_SPEND` off the head on every Swing,
//      and `music/stackSlots.js` documents that as the game's way of RE-POINTING
//      what a player hunts. Bushido eating the tail instead would have been a
//      second convention for one stack inside a single action. 🚩 And because the
//      strike at the end IS a Swing, a draw costs FOUR notes, not two — asserted
//      below, because it is the ability's real price and nothing else states it.
//   5. THE FLAT UNLOCK PRICE IS A RULE ABOUT THE WHOLE TREE, not about the Ronin.
//
// 📌 THE DOUBLE IS CLIENT-ONLY AND THAT IS WHY §5 IS SHORT. `legalActions` does
// not emit Shadow Illusion, so what the kernel owns is the TICK — the duration
// countdown and the Sustain drain in `turnFlow.js`. The summon lives in the
// monolith. The constants are asserted here because they are what the two halves
// share, and `SHADOW_ILLUSION_TURNS` was a bare local `3` in the client until
// this respec hoisted it.

import assert from "node:assert";
import { makeInitialState } from "./state.js";
import { legalActions } from "./policies/legalActions.js";
import { applyBotAction, spendDriveStack } from "./policies/transition.js";
import { makeRng } from "./rng.js";
import { ABILITY_CD, ABILITY_DB_COST, cooldownLeft } from "./systems/cooldowns.js";
import { SWING_DRIVE_SPEND } from "./systems/attackParams.js";
import {
  PSYCHO_BUSHIDO_CD, PSYCHO_BUSHIDO_DB_COST, PSYCHO_BUSHIDO_AP_COST,
  PSYCHO_BUSHIDO_MIN_RANGE, PSYCHO_BUSHIDO_MAX_RANGE,
  PSYCHO_BUSHIDO_STACK_COST, PSYCHO_BUSHIDO_DRIVE_LADDER, psychoBushidoBonus,
  SHADOW_ILLUSION_CD, SHADOW_ILLUSION_DB_COST, SHADOW_ILLUSION_TURNS,
  SHADOW_ILLUSION_SUSTAIN_DRAIN, FLAT_ABILITY_UNLOCK_DB,
} from "../data/gameConstants.js";
import { SKILL_BY_ID } from "../data/skillTree.js";
import { CORNERS } from "../data/corners.js";
import { HEX_BY_NUM, HEX_BY_QR } from "../board/hexMap.js";
import { neighborInDirection } from "../board/hexGeometry.js";
import { bushidoLane, bushidoDrawPatch } from './systems/bushido.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); checks++; };

const RONIN = 'cosmic_ronin', ZERO = 'intergalactic_0', METAL = 'Metalness_Monster';
const BUSHIDO = 'psycho_bushido';

console.log('🗡️  bushidoCheck — the draw, the window, the ladder and the stack bill\n');

// ── Fixture ──────────────────────────────────────────────────────────────────
// ⚠️ THE START HEX NEEDS SIX CLEAR HEXES IN FRONT OF IT, not two. The window
// reaches 5 and the "just past the window" case needs a 6th, so a start hex near
// the rim would make every refusal below a property of the board rather than of
// the rule. 45 is the interior hex `shukuchiCheck` uses for the same reason.
const START = 45;
const LANE = (() => {
  const out = [];
  const origin = HEX_BY_NUM[START];
  const first = neighborInDirection(origin, 0);
  const dq = first.q - origin.q, dr = first.r - origin.r;
  let q = origin.q, r = origin.r;
  for (let d = 1; d <= 7; d++) {
    q += dq; r += dr;
    const h = HEX_BY_QR[`${q},${r}`];
    if (!h) break;
    out[d] = h.num;
  }
  return out;
})();
ok(LANE[6] != null,
  '🧪 the fixture has 6 clear hexes ahead — otherwise "just past the window" is untestable');

/** A board with the Ronin on START facing 0 and a rival `d` hexes down the lane. */
function boardAt(d, { ap = 5, ns = {} } = {}) {
  const config = {
    mode: 'ffa',
    startingLives: 3,
    spirits: [
      { id: RONIN, name: 'Shredding Ronin',   corner: 'blue',   num: START,   vibe: 5, maxVibe: 5, knockedOut: false, facing: 0 },
      { id: ZERO,  name: 'Intergalactic 0',   corner: 'purple', num: LANE[d], vibe: 4, maxVibe: 4, knockedOut: false, facing: 0 },
      { id: METAL, name: 'Metalness Monster', corner: 'yellow', num: CORNERS.yellow.homeNum, vibe: 5, maxVibe: 5, knockedOut: false, facing: 0 },
    ],
  };
  const st = makeInitialState(structuredClone(config), 909);
  return {
    ...st,
    acting: RONIN,
    turn: { ...st.turn, moveStepsLeft: ap, actionTokenUsed: false },
    noteStates: {
      ...st.noteStates,
      [RONIN]: {
        ...st.noteStates[RONIN],
        hasConfirmed: true, unlockedSkills: [BUSHIDO], dbPoints: 10, ...ns,
      },
    },
  };
}
const bushidosIn = (st) => legalActions(st, RONIN, {}).filter(a => a.kind === 'psychoBushido');
const nsOf = (st, id) => st.noteStates?.[id] ?? {};

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE CONSTANTS — and the respec is a DIRECTION, so the deltas are asserted.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(PSYCHO_BUSHIDO_MIN_RANGE, 3, '🗡️ the draw opens at 3 hexes (§2.1.1)');
  eq(PSYCHO_BUSHIDO_MAX_RANGE, 5, '🗡️ …and closes at 5');
  eq(PSYCHO_BUSHIDO_AP_COST, 3, '🗡️ 3 AP flat — not "everything you have left"');
  eq(PSYCHO_BUSHIDO_CD, 4, '🕒 4-round cooldown — was 2');
  eq(PSYCHO_BUSHIDO_DB_COST, 1, '💿 still 1 Db a draw — the per-use price did not move');
  eq(PSYCHO_BUSHIDO_STACK_COST, 2, '🎸 …and 2 notes off the Drive stack, which is new');
  eq(PSYCHO_BUSHIDO_DRIVE_LADDER, [2, 3, 4], '⭐ the ladder Alex settled 2026-09-04e');

  eq(ABILITY_CD[BUSHIDO], PSYCHO_BUSHIDO_CD, '🕒 the cooldown table reads the constant');
  eq(ABILITY_DB_COST[BUSHIDO], PSYCHO_BUSHIDO_DB_COST, '💿 …and so does the per-use table');

  // ⚠️ THE WINDOW MUST BE AS WIDE AS THE LADDER IS LONG. A ladder with four rungs
  // and a three-hex window would make the fourth unreachable, and nothing else in
  // the repo could tell — the extra rung would simply never be read.
  eq(PSYCHO_BUSHIDO_DRIVE_LADDER.length, PSYCHO_BUSHIDO_MAX_RANGE - PSYCHO_BUSHIDO_MIN_RANGE + 1,
    '⭐ one rung per legal distance — no rung is unreachable and no distance is unpriced');
  ok(PSYCHO_BUSHIDO_AP_COST <= PSYCHO_BUSHIDO_MIN_RANGE,
    '⚡ the bill is payable by a Spirit who can reach the near edge of the window at all');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE LADDER — it rises, and it pays nothing outside the window.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(psychoBushidoBonus(3), 2, '⭐ +2 at the near edge');
  eq(psychoBushidoBonus(4), 3, '⭐ +3 in the middle');
  eq(psychoBushidoBonus(5), 4, '⭐ +4 at full draw');

  // ⭐ MONOTONIC, ASSERTED RATHER THAN ASSUMED. §B8: the bonus was once
  // `apLeft - dist`, which paid MOST for a charge of zero hexes — "the ability
  // rewarded standing still and called it lightning." A ladder makes the sign
  // structural, and this is the guard that keeps it that way.
  for (let d = PSYCHO_BUSHIDO_MIN_RANGE; d < PSYCHO_BUSHIDO_MAX_RANGE; d++) {
    ok(psychoBushidoBonus(d + 1) > psychoBushidoBonus(d),
      `⭐ farther pays more: ${d + 1} hexes beats ${d} hexes (§B8 — the sign has flipped once already)`);
  }

  // 📌 Out of the window it pays 0, not a negative and not a NaN. A caller that
  // skipped the legality check gets nothing rather than an invented rung.
  for (const d of [0, 1, 2, 6, 9]) {
    eq(psychoBushidoBonus(d), 0, `⭐ ${d} hexes is outside the window and pays 0`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. THE WINDOW IS A REFUSAL — `legalActions` emits nothing inside 3 hexes.
// ═════════════════════════════════════════════════════════════════════════════
{
  for (const d of [1, 2]) {
    eq(bushidosIn(boardAt(d)).length, 0,
      `🚫 a rival ${d} hex(es) away is NOT a target — too close to draw (§2.1.1)`);
  }
  for (let d = PSYCHO_BUSHIDO_MIN_RANGE; d <= PSYCHO_BUSHIDO_MAX_RANGE; d++) {
    const moves = bushidosIn(boardAt(d));
    eq(moves.length, 1, `🗡️ a rival at ${d} hexes IS a target — inside the window`);
    eq(moves[0].dist, d, `🗡️ …and the emitted distance is the real one (${d})`);
    eq(moves[0].targetId, ZERO, '🗡️ …aimed at the rival actually standing in the lane');
  }
  eq(bushidosIn(boardAt(6)).length, 0,
    '🚫 a rival 6 hexes away is out of the lane — the window has a far edge too');

  // ⚠️ A BODY TOO CLOSE STILL BLOCKS THE LANE. This is what makes standing at
  // range 2 a defence against the ability, and it is why the 👤 decoy is worth
  // parking in front of a Ronin. A generator that skipped past the near body and
  // offered the far one would delete both.
  {
    const st = boardAt(5);
    const blocked = {
      ...st,
      spirits: st.spirits.map(s => s.id === METAL ? { ...s, num: LANE[2] } : s),
    };
    eq(bushidosIn(blocked).length, 0,
      '🛡️ a body at 2 hexes blocks the draw at 5 — too close to strike, close enough to stop it');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. THE BILL IS FLAT — same AP at 3 hexes as at 5, and it does not read `ap`.
// ═════════════════════════════════════════════════════════════════════════════
{
  for (let d = PSYCHO_BUSHIDO_MIN_RANGE; d <= PSYCHO_BUSHIDO_MAX_RANGE; d++) {
    eq(bushidosIn(boardAt(d))[0].apCost, PSYCHO_BUSHIDO_AP_COST,
      `⚡ a draw at ${d} hexes costs ${PSYCHO_BUSHIDO_AP_COST} AP — the bill does not scale with reach`);
  }

  // ⭐ THE LANE IS A FIXED LENGTH, NOT AN AP RANGE. It used to run to the AP pool
  // because the pool WAS the reach. If this regressed, a fast Ronin would reach
  // further than a slow one and the window would drift with speed.
  eq(bushidosIn(boardAt(5, { ap: PSYCHO_BUSHIDO_AP_COST })).length, 1,
    '⚡ exactly enough AP still reaches the FAR edge — reach is the window, not the pool');
  eq(bushidosIn(boardAt(3, { ap: PSYCHO_BUSHIDO_AP_COST - 1 })).length, 0,
    '⚡ one AP short and there is no draw at all — the flat bill is a hard gate');

  // 💿🕒 Both halves of `canFire`, because `legalActions` asks them as one
  // question and a generator that emitted a move the resolver refuses is a
  // searcher planning turns it cannot play.
  eq(bushidosIn(boardAt(4, { ns: { dbPoints: 0 } })).length, 0,
    '💿 no Db, no draw');
  eq(bushidosIn(boardAt(4, { ns: { abilityCd: { [BUSHIDO]: 2 } } })).length, 0,
    '🕒 recharging, no draw');
  eq(bushidosIn(boardAt(4, { ns: { unlockedSkills: [] } })).length, 0,
    '🔒 not bought, no draw');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. THE KERNEL PAYS THE LADDER, THE FLAT AP AND THE STACK BILL.
// ═════════════════════════════════════════════════════════════════════════════
{
  for (let d = PSYCHO_BUSHIDO_MIN_RANGE; d <= PSYCHO_BUSHIDO_MAX_RANGE; d++) {
    const st = boardAt(d, { ns: { driveStack: ['C3', 'E3', 'G3', 'B3'] } });
    const before = st.turn.moveStepsLeft;
    const move = bushidosIn(st)[0];
    const res = applyBotAction(st, move, { rng: makeRng(4242), view: {} });
    ok(res.ok, `🗡️ the draw at ${d} hexes actually runs headlessly (${res.reason ?? 'ok'})`);
    const after = res.state;
    const ns = nsOf(after, RONIN);

    // ⚠️ THE BUFF LANDS BEFORE THE BLOW — `tempDrive` is zeroed when a battle
    // resolves, so what is asserted is the Db and the clock, plus the stack.
    // The bonus itself is checked through `psychoBushidoBonus` in §2; asserting a
    // post-battle `tempDrive` would be asserting `battleFlow`'s cleanup.
    eq(cooldownLeft(ns, BUSHIDO), PSYCHO_BUSHIDO_CD,
      `🕒 the draw at ${d} starts the ${PSYCHO_BUSHIDO_CD}-round clock`);
    eq(ns.dbPoints, 10 - PSYCHO_BUSHIDO_DB_COST,
      `💿 …and pays ${PSYCHO_BUSHIDO_DB_COST} Db, exactly as the client does`);
    // 🚩 FOUR NOTES, NOT TWO — the ability's bill plus the strike's own Swing
    // spend, both off the front. This is the assertion that states the real price
    // of a draw; nothing else in the repo does, and it is what makes the trade
    // legible if anyone later asks why Bushido feels expensive.
    eq((ns.driveStack ?? []).length, 0,
      `🎸 a 4-note stack is emptied by a draw: ${PSYCHO_BUSHIDO_STACK_COST} for the ability, ${SWING_DRIVE_SPEND} for the strike`);

    // ⚡ TOTAL AP: the dash pays its share and the Swing pays the rest. Asserting
    // the TOTAL rather than the dash is deliberate — the bill was split between
    // two call sites precisely so neither could pay it twice.
    eq(before - after.turn.moveStepsLeft, PSYCHO_BUSHIDO_AP_COST,
      `⚡ the whole draw at ${d} hexes costs ${PSYCHO_BUSHIDO_AP_COST} AP, dash and strike together`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. 🎸 THE STACK BILL — one direction, the game's direction.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(spendDriveStack(['C3', 'E3', 'G3', 'B3'], 2), ['G3', 'B3'],
    '🎸 two off the FRONT of a four-note stack — the foundation, not the tail');
  eq(spendDriveStack(['C3', 'E3'], 2), [],
    '🎸 …and a two-note stack is emptied, which is a legal state ("drive exhausted")');
  eq(spendDriveStack(['C3'], 2), [],
    '🎸 …as is a short stack, taken for what it has');

  // ⭐ SAME DIRECTION AS THE SWING, ASSERTED AGAINST THE SWING'S OWN RULE rather
  // than against a literal. `music/stackSlots.js` calls the front spend the
  // design's way of re-pointing a hunt; if Bushido ever drifts to taking the tail
  // there will be two conventions for one stack and only this line can tell.
  {
    const stack = ['C3', 'E3', 'G3', 'B3'];
    const bySwing   = stack.slice(SWING_DRIVE_SPEND);
    const byBushido = spendDriveStack(stack, SWING_DRIVE_SPEND);
    eq(byBushido, bySwing,
      '⭐ Bushido spends the Drive stack exactly the way a Swing does — one stack, one direction');
  }

  // ⭐ AND THE ROOT MOVES UP, WHICH IS THE POINT, NOT A CASUALTY. Spending the
  // foundation hands the root to the next note and the 🔦 hunt marker follows it.
  eq(spendDriveStack(['C3', 'E3', 'G3'], 1)[0], 'E3',
    '🔦 the root hands off to the next note up — the hunt re-points, by design');

  eq(spendDriveStack(['C3', 'E3'], 0), ['C3', 'E3'], '🎸 a zero bill is a no-op');
  eq(spendDriveStack(undefined, 2), [], '🎸 …and an absent stack is not a crash');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. 👤 SHADOW ILLUSION — the respec, and the constant that came out of the client.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(SHADOW_ILLUSION_CD, 4, '👤 4-round cooldown — was 3 (§2.2.1)');
  eq(SHADOW_ILLUSION_DB_COST, 1, '👤 1 Db to fire — was 2. Dearer to own, cheaper to fire');
  eq(SHADOW_ILLUSION_TURNS, 2, '👤 the double stands 2 of his turns — was 3');
  eq(SHADOW_ILLUSION_SUSTAIN_DRAIN, 1, '👤 …and eats 1 Sustain each of them');
  eq(ABILITY_CD.shadow_illusion, SHADOW_ILLUSION_CD, '🕒 the cooldown table reads the constant');
  eq(ABILITY_DB_COST.shadow_illusion, SHADOW_ILLUSION_DB_COST, '💿 …and so does the per-use table');

  // ⚠️ THE COOLDOWN MUST OUTLAST THE DOUBLE, or he can stand a second one up the
  // turn the first falls and the ability stops being a thing you SPEND. That is
  // the whole point of the respec, and it is the relationship rather than either
  // number that carries it.
  ok(SHADOW_ILLUSION_CD > SHADOW_ILLUSION_TURNS,
    '👤 there is a gap between one double falling and the next standing — it is spent, not maintained');

  // 🚩 THE OPEN RIDER, PINNED SO IT CANNOT BE FORGOTTEN. §6.3 warns that if the
  // double never survives long enough to matter, duration is "the first dial to
  // turn" — and this respec turned that dial DOWN, at three pop conditions.
  // Alex took it knowingly on 2026-09-04f. This assertion is here so that the day
  // someone raises the duration, they find the warning attached to the number.
  ok(SHADOW_ILLUSION_TURNS >= 1,
    '👤 ⚠️ §6.3 rider: duration was cut with all three pop conditions still live — if the double never survives, THIS is the dial');
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. ⭐ THE FLAT UNLOCK PRICE — a rule about the whole tree, not about the Ronin.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(FLAT_ABILITY_UNLOCK_DB, 6, '⭐ every ability unlocks at 6 Db (Alex, 2026-09-04f)');
  eq(SKILL_BY_ID[BUSHIDO].dbCost, FLAT_ABILITY_UNLOCK_DB,
    '⭐ …including Bushido, whose respec asked for 8 and did not get it');
  eq(SKILL_BY_ID.shadow_illusion.dbCost, FLAT_ABILITY_UNLOCK_DB,
    '⭐ …and Shadow Illusion, whose respec asked for 10');

  // ⚠️ THE PER-USE PRICES ARE **NOT** FLATTENED, AND THAT IS THE OTHER HALF OF THE
  // RULE. `UPGRADE_SHOP_DESIGN.md` §0⃣.3 files "do per-use costs flatten too?" as
  // its own open question; the standing assumption is no. An ability's ongoing
  // price is now the only place its cost can vary, so if this set ever collapses
  // to one value the flattening has spread further than anyone decided.
  const perUse = new Set(Object.values(ABILITY_DB_COST));
  ok(perUse.size > 1,
    '💿 per-USE Db is still varied — only the UNLOCK price is flat (§0⃣.3 is still open)');
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. THE CARD SELLS THE NEW RULE — player-facing text is where drift shows first.
// ═════════════════════════════════════════════════════════════════════════════
{
  const bush = SKILL_BY_ID[BUSHIDO].desc;
  ok(/3 to 5 hexes|3 hexes|DIRECTLY IN FRONT/i.test(bush),
    '📖 the Bushido card names the WINDOW — a refusal a player cannot read is a bug report');
  ok(/Drive stack/i.test(bush) && /RE-POINTS/i.test(bush),
    '📖 …and the Drive-stack bill, including that losing the foundation re-points the hunt');
  ok(!/spends every Action Point/i.test(bush),
    '🪦 …and it no longer sells the pre-respec AP rule. §B1: a card that reads as current and is not is worse than no card');

  const shad = SKILL_BY_ID.shadow_illusion.desc;
  ok(!/Lasts 3 turns/i.test(shad),
    '🪦 the Shadow card no longer says "Lasts 3 turns" — the number is interpolated now, so it cannot drift again');
  ok(new RegExp(`Lasts ${SHADOW_ILLUSION_TURNS} turns`).test(shad),
    '📖 …it says the real duration, read from the constant');
}

// Shared extraction contracts: blockers remain a caller policy; spending is
// immutable, additive and takes the foundation before the Swing's own bill.
{
  const ronin = { num: START, facing: 0 };
  eq(bushidoLane(ronin).map(x => x.num), LANE.slice(1, 6), 'full fixed facing lane');
  eq(bushidoLane(ronin, new Set([LANE[2]])).map(x => x.num), LANE.slice(1, 3), 'close blocker included and stops the walk');
  eq(bushidoLane(ronin)[4].to, LANE[4], 'range-five landing is immediately before rival');
  eq(bushidoLane(null), [], 'missing actor has no lane');
  const ns = { dbPoints: 10, tempDrive: 2, driveStack: ['A', 'B', 'C', 'D'], abilityCd: { other: 2 } };
  const before = structuredClone(ns);
  const patch = bushidoDrawPatch(ns, 5);
  eq(ns, before, 'draw calculation does not mutate the live sheet');
  eq(patch.driveStack, ['C', 'D'], 'draw spends from the front');
  eq(patch.tempDrive, 6, 'draw adds its bonus to existing temporary Drive');
  eq(patch.dbPoints, 9, 'draw pays one Db');
  eq(patch.abilityCd, { other: 2, psycho_bushido: 4 }, 'draw preserves other cooldowns');
}

console.log(`\n✅ bushidoCheck: ${checks} assertions passed`);
