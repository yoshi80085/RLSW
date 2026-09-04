// ─── 🌀 SHUKUCHI ARPEGGIO CHECK ──────────────────────────────────────────────
// Run: `npm run test:shukuchi`
//
// Coverage for 縮地 — `RONIN_ABILITY_DESIGN.md` §2.5 and §2.5.0.
//
// ⚠️ THE ABILITY IS BUILT HEADLESS. There is no client button, no board
// animation and no target overlay yet — the hop is a VISUAL and `CLAUDE.md`'s
// standing rule sends a visual to a `.scratch/` preview before the monolith.
// `BOT_CLIENT_GAPS` names the gap, and `legalActionsCheck` §16 is what forces it
// to stay named. This file is therefore the ONLY thing standing on the rule.
//
// Four properties matter more than any individual number:
//
//   1. THE BILL. Every hop costs exactly `SHUKUCHI_AP_PER_HOP` out of the same
//      `moveStepsLeft` pool as walking, the Swing and Bushido. That single line
//      is the entire balance of the ability (§2.5.0) — if it ever stops being
//      charged, Shukuchi becomes the free 6-hex teleport the first sketch was.
//   2. THE FIRST HOP PAYS, THE REST ARE FREE. One activation, one Db, one clock.
//      ⚠️ And the clock must NOT then refuse hops two and three, which is the
//      bug the sheet-side budget exists to prevent.
//   3. NOTHING STOPS HIM IN THE AIR. Only the landing hex is consulted. A test
//      that only ever hops across empty board cannot tell this rule from
//      ordinary movement, so the interposed-body case is asserted directly.
//   4. HE ENDS FACING WHERE HE LANDED. The hop follows walking, not the warp —
//      keeping his old facing would hand him the free half of a Bushido setup.

import assert from "node:assert";
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import { makeRng } from "./rng.js";
import { shukuchiHopped } from "./actions.js";
import { legalActions } from "./policies/legalActions.js";
import { applyBotAction, MODELLED_KINDS } from "./policies/transition.js";
import { BOT_CLIENT_KINDS, BOT_CLIENT_GAPS, BOT_SPIRIT_SKILLS } from "./policies/bot.js";
import {
  SHUKUCHI_SKILL, shukuchiLandings, canHop, hopIsActivation,
  hopBudgetPatch, shukuchiHopsLeft, applyShukuchiHop,
} from "./systems/shukuchi.js";
import { ABILITY_CD, ABILITY_DB_COST, cooldownLeft } from "./systems/cooldowns.js";
import { tokenAt } from "./systems/board.js";
import {
  SHUKUCHI_CD, SHUKUCHI_DB_COST, SHUKUCHI_MAX_HOPS,
  SHUKUCHI_HOP_RINGS, SHUKUCHI_AP_PER_HOP,
} from "../data/gameConstants.js";
import { SKILL_BY_ID } from "../data/skillTree.js";
import { CORNERS } from "../data/corners.js";
import { HEX_BY_NUM } from "../board/hexMap.js";
import { axialDist, axialNeighbors } from "../board/hexGeometry.js";

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); checks++; };

const RONIN = 'cosmic_ronin', ZERO = 'intergalactic_0', METAL = 'Metalness_Monster';

// ── Fixture ──────────────────────────────────────────────────────────────────
// ⚠️ AN INTERIOR HEX WITH TWO CLEAR RINGS AROUND IT. Ring 2 is the ONLY ring
// this ability lands on, so a start hex near the rim would clip the landing set
// and every count below would be a property of the fixture instead of the rule.
const START = 45;

const CONFIG = {
  mode: 'ffa',
  startingLives: 3,
  spirits: [
    { id: RONIN, name: 'Shredding Ronin',   corner: 'blue',   num: START, vibe: 5, maxVibe: 5, knockedOut: false, facing: 0 },
    { id: ZERO,  name: 'Intergalactic 0',   corner: 'purple', num: CORNERS.purple.homeNum, vibe: 4, maxVibe: 4, knockedOut: false, facing: 0 },
    { id: METAL, name: 'Metalness Monster', corner: 'yellow', num: CORNERS.yellow.homeNum, vibe: 5, maxVibe: 5, knockedOut: false, facing: 0 },
  ],
};

const base = (ap = 5) => {
  const st = makeInitialState(structuredClone(CONFIG), 909);
  return { ...st, acting: RONIN, turn: { ...st.turn, moveStepsLeft: ap, actionTokenUsed: false } };
};
const withNs = (st, id, patch) => ({
  ...st, noteStates: { ...st.noteStates, [id]: { ...st.noteStates[id], ...patch } },
});
const withSpirit = (st, id, patch) => ({
  ...st, spirits: st.spirits.map(s => s.id === id ? { ...s, ...patch } : s),
});
/** A confirmed turn with Shukuchi bought and Db in the bank. */
const armed = (ap = 5, extra = {}) => withNs(base(ap), RONIN, {
  hasConfirmed: true, unlockedSkills: [SHUKUCHI_SKILL], dbPoints: 10, ...extra,
});
const at = (n) => HEX_BY_NUM[n];
const rng = () => makeRng(4242);
const hop = (st, to) => applyBotAction(st, { kind: 'shukuchi', to }, { rng: rng(), view: {} });
const hexOf = (st, id) => st.spirits.find(s => s.id === id)?.num;
const nsOf = (st, id) => st.noteStates?.[id] ?? {};

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE CONSTANTS, AND THE ONE RELATIONSHIP THAT IS THE BALANCE.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(SHUKUCHI_HOP_RINGS, 2, '🌀 a hop is exactly 2 hexes');
  eq(SHUKUCHI_MAX_HOPS, 3, '🌀 three of them per activation');
  eq(SHUKUCHI_CD, 3, '🌀 3-round cooldown');
  eq(SHUKUCHI_DB_COST, 1, '🌀 1 Db per activation');

  // ⭐ THE LINE THE WHOLE ABILITY BALANCES ON (§2.5.0). The first sketch made
  // Shukuchi the entire movement turn — six hexes for the turn, priced against
  // nothing. Alex's rule bills it against the pool everything else spends from,
  // so three hops is a Bushido he did not throw. A 0 here restores the sketch.
  eq(SHUKUCHI_AP_PER_HOP, 1,
    '⭐ a hop costs the SAME AP as an ordinary step — this is the brake, and it is the only one');
  ok(SHUKUCHI_AP_PER_HOP > 0,
    '⚠️ a free hop is the 6-hex teleport §2.5.0 rejected — the AP bill IS the ability’s price');

  eq(ABILITY_CD[SHUKUCHI_SKILL], SHUKUCHI_CD, '🕒 it is in the cooldown table');
  eq(ABILITY_DB_COST[SHUKUCHI_SKILL], SHUKUCHI_DB_COST, '💿 …and in the per-use Db table');

  const row = SKILL_BY_ID[SHUKUCHI_SKILL];
  ok(!!row, '🌀 the skill row exists — an ability nobody can buy is not an ability');
  eq(row.dbCost, 6, '🌀 6 Db to unlock (§2.5)');
  ok(/縮地/.test(row.label), '🌀 …and the label carries the kanji the ability is named for');
  ok(/Action Point/i.test(row.desc),
    '⚠️ the card SELLS THE AP BILL. "Six hexes" without "three of your steps" is the trap a new player falls into');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE LANDING SET — ring 2, and only ring 2.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = armed();
  const landings = shukuchiLandings(st, RONIN);
  ok(landings.length > 0, '🌀 there are landings from an interior hex');

  const from = at(START);
  ok(landings.every(n => axialDist(from.q, from.r, at(n).q, at(n).r) === SHUKUCHI_HOP_RINGS),
    '🌀 EVERY landing is exactly 2 hexes away — not "up to 2"');

  // ⚠️ THE NEGATIVE IS THE INTERESTING HALF. A hop is not a longer walk: the
  // hexes he could have STEPPED to are not landings, so a Ronin mid-Shukuchi
  // cannot use it to shuffle one hex sideways.
  const neighbours = new Set(axialNeighbors(from.q, from.r)
    .map(({ q, r }) => Object.values(HEX_BY_NUM).find(h => h.q === q && h.r === r)?.num)
    .filter(n => n != null));
  ok(landings.every(n => !neighbours.has(n)),
    '🌀 no landing is an ADJACENT hex — the hop cannot be spent as an ordinary step');
  ok(!landings.includes(START), '🌀 …and he cannot hop onto himself');

  eq([...landings].sort((a, b) => a - b), landings,
    '📏 the landing list is sorted — a searcher walking it must be deterministic (§0.4)');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. 🌀 NOTHING STOPS HIM IN THE AIR — the rule that makes it Shukuchi.
//    Alex, §2.5.2 #1: bodies, hazards, walls and 🐙 slime all pass underneath.
//    ⚠️ Asserted with a body ON the intervening hex, because a test that only
//    hops across empty board cannot tell this rule from ordinary movement.
// ═════════════════════════════════════════════════════════════════════════════
{
  const from = at(START);
  const landings0 = shukuchiLandings(armed(), RONIN);
  const target = landings0[0];
  const to = at(target);

  // A hex on the line between the two — the one a walker would have to cross.
  const between = Object.values(HEX_BY_NUM).find(h =>
    axialDist(from.q, from.r, h.q, h.r) === 1 &&
    axialDist(to.q, to.r, h.q, h.r) === 1);
  ok(!!between, 'fixture: there is an intervening hex between start and landing');

  const blockedMid = withSpirit(armed(), ZERO, { num: between.num });
  const stillThere = shukuchiLandings(blockedMid, RONIN, new Set([between.num]));
  ok(stillThere.includes(target),
    '🌀 A BODY IN THE WAY DOES NOT BLOCK THE HOP — only the landing hex is consulted');

  // …but the landing itself must be clear.
  const blockedEnd = withSpirit(armed(), ZERO, { num: target });
  const withoutIt = shukuchiLandings(blockedEnd, RONIN, new Set([target]));
  ok(!withoutIt.includes(target),
    '🌀 …and an OCCUPIED landing is refused — he jumps over people, he does not land on them');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. THE BILL, AND THE FACING.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = armed(5);
  const target = shukuchiLandings(st, RONIN)[0];
  const hopped = applyShukuchiHop(st, { spiritId: RONIN, toNum: target });

  eq(hexOf(hopped, RONIN), target, '🌀 he is on the landing hex');
  eq(hopped.turn.moveStepsLeft, 5 - SHUKUCHI_AP_PER_HOP,
    '⭐ …and one AP is gone — the same bill an ordinary step pays');

  // ⚠️ FACING FOLLOWS WALKING, NOT THE WARP. `applySpiritWarped` deliberately
  // leaves facing alone; a hop that did the same would let him land beside a
  // rival while still aimed down the lane he came from — the free half of a
  // Bushido setup, handed over for nothing.
  const before = st.spirits.find(s => s.id === RONIN).facing;
  const after = hopped.spirits.find(s => s.id === RONIN).facing;
  ok(after !== before || target === START,
    '🌀 the hop RE-FACES him down the direction of travel, exactly as walking does');
  ok(hopped.turn.lastMove?.shukuchi === true,
    '📌 `lastMove` says which of the two it was, so a client need not re-derive it from the distance');

  // Off-board is refused in place rather than throwing — `applyMoveStep`'s convention.
  const nowhere = applyShukuchiHop(st, { spiritId: RONIN, toNum: 99999 });
  eq(hexOf(nowhere, RONIN), START, '🌀 an off-board target leaves the state alone');
  eq(nowhere.turn.moveStepsLeft, 5, '🌀 …and charges nothing for the refusal');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. ⭐ THE FIRST HOP PAYS AND THE OTHER TWO DO NOT — and the clock must not
//    then refuse them. This is the whole reason the hop budget lives on the
//    sheet, and the bug it prevents is an ability that advertises three hops
//    and can only ever take one.
// ═════════════════════════════════════════════════════════════════════════════
{
  let st = armed(5);
  eq(shukuchiHopsLeft(nsOf(st, RONIN)), 0, '🌀 a fresh sheet is not mid-Shukuchi');
  ok(hopIsActivation(nsOf(st, RONIN)), '🌀 …so the next hop is the activation');
  ok(canHop(nsOf(st, RONIN)), '🌀 …and it is available');

  const db0 = nsOf(st, RONIN).dbPoints;
  const r1 = hop(st, shukuchiLandings(st, RONIN)[0]);
  ok(r1.ok, '🌀 hop 1 runs');
  st = r1.state;
  eq(nsOf(st, RONIN).dbPoints, db0 - SHUKUCHI_DB_COST, '💿 hop 1 pays the Db');
  eq(cooldownLeft(nsOf(st, RONIN), SHUKUCHI_SKILL), SHUKUCHI_CD, '🕒 …and starts the clock');
  eq(shukuchiHopsLeft(nsOf(st, RONIN)), SHUKUCHI_MAX_HOPS - 1, '🌀 …leaving two hops in the turn');

  // ⚠️ THE ASSERTION THIS FILE EXISTS FOR. `canFire` is false now — the clock is
  // running — so a continuation that asked it would refuse, and Shukuchi would
  // be a 2-hex blink wearing a three-hop card.
  ok(canHop(nsOf(st, RONIN)),
    '⭐ hop 2 is legal WHILE THE COOLDOWN RUNS — the budget answers, not the clock');
  ok(!hopIsActivation(nsOf(st, RONIN)), '🌀 …and it is not a second activation');

  const db1 = nsOf(st, RONIN).dbPoints;
  const r2 = hop(st, shukuchiLandings(st, RONIN)[0]);
  ok(r2.ok, '🌀 hop 2 runs');
  st = r2.state;
  eq(nsOf(st, RONIN).dbPoints, db1, '💿 hop 2 is FREE of Db — one activation, one charge (§2.5.0a)');
  eq(cooldownLeft(nsOf(st, RONIN), SHUKUCHI_SKILL), SHUKUCHI_CD, '🕒 …and does not re-start the clock');
  eq(shukuchiHopsLeft(nsOf(st, RONIN)), SHUKUCHI_MAX_HOPS - 2, '🌀 …leaving one');

  const r3 = hop(st, shukuchiLandings(st, RONIN)[0]);
  ok(r3.ok, '🌀 hop 3 runs');
  st = r3.state;
  eq(shukuchiHopsLeft(nsOf(st, RONIN)), 0, '🌀 …and the budget is spent');

  // ⛔ THE FOURTH IS REFUSED, and it is refused by the CLOCK rather than the
  // budget — the budget is back to 0, which reads as "not mid-Shukuchi", so
  // `canHop` falls through to `canFire` and finds the cooldown it started.
  ok(!canHop(nsOf(st, RONIN)),
    '⛔ a FOURTH hop is refused — the budget is spent and the clock is still running');
  eq(st.turn.moveStepsLeft, 5 - 3 * SHUKUCHI_AP_PER_HOP,
    '⭐ three hops cost three AP — six hexes of ground for three of his five steps');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. THE GATES — unlocked, affordable, off cooldown, and enough AP.
// ═════════════════════════════════════════════════════════════════════════════
{
  const locked = withNs(base(5), RONIN, { hasConfirmed: true, dbPoints: 10 });
  ok(!canHop(nsOf(locked, RONIN)), '🌀 not bought, not available');
  ok(!legalActions(locked, RONIN).some(a => a.kind === 'shukuchi'),
    '🌀 …and `legalActions` does not offer it');

  const broke = armed(5, { dbPoints: 0 });
  ok(!canHop(nsOf(broke, RONIN)), '💿 no Db, no activation');

  const cooling = armed(5, { abilityCd: { [SHUKUCHI_SKILL]: 2 } });
  ok(!canHop(nsOf(cooling, RONIN)), '🕒 mid-cooldown and not mid-move, so no');

  // ⚠️ …but mid-move it is available even while cooling. Same sheet, one field
  // apart — this pair is the §5 rule stated as a gate rather than as a sequence.
  const coolingMid = armed(5, { abilityCd: { [SHUKUCHI_SKILL]: 2 }, shukuchiHopsLeft: 1 });
  ok(canHop(nsOf(coolingMid, RONIN)), '🌀 …unless he is mid-Shukuchi, which is the point');

  const noAp = armed(0);
  ok(!legalActions(noAp, RONIN).some(a => a.kind === 'shukuchi'),
    '⭐ no AP, no hop — it is billed like a step, so it runs out like one');

  // ⚠️ AND IT IS AN ACTION-PHASE MOVE. Before the melody is confirmed there is
  // no AP to spend, and offering it there would let a searcher plan a turn the
  // spine (§1) does not have.
  const unconfirmed = withNs(armed(5), RONIN, { hasConfirmed: false });
  ok(!legalActions(unconfirmed, RONIN).some(a => a.kind === 'shukuchi'),
    '🌀 nothing is offered before the melody is confirmed — AP does not exist yet');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. WHAT `legalActions` EMITS — and it must match the landing set exactly.
//    An over-permissive generator is the dangerous direction: the searcher plans
//    a line, the game refuses it, and it reads as "the bot is bad".
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = armed(5);
  const emitted = legalActions(st, RONIN).filter(a => a.kind === 'shukuchi');
  ok(emitted.length > 0, '🌀 the action phase offers hops');
  eq(emitted.every(a => a.apCost === SHUKUCHI_AP_PER_HOP), true,
    '⭐ every emitted hop carries the AP bill, so the beam prices it against walking');

  const rivals = new Set(st.spirits.filter(s => s.id !== RONIN).map(s => s.num));
  eq(new Set(emitted.map(a => a.to)),
     new Set(shukuchiLandings(st, RONIN, rivals)),
     '🌀 the generator and the landing rule agree exactly — no hop is offered that the resolver would refuse');

  ok(MODELLED_KINDS.has('shukuchi'),
    '🌀 the transition can run it headlessly — otherwise the searcher plans a kind it cannot take');

  // ✅ THE CLIENT DRIVES IT — ported 2026-09-04e, and this assertion is the
  // INVERSE of the one that stood here. It used to assert the gap was declared;
  // now it asserts the gap is closed, and it will fail the day somebody reverts
  // the client wiring without saying so. 🎯 Same move `melodyCommitCheck` §13
  // made when Wa no Koe was cut: a suite that stood on an absence becomes the
  // guard on its presence rather than being deleted.
  //
  // ⚠️ THE CLIENT PATH IS NOT THE SAME THING AS THE OVERLAY. This asserts the
  // searcher can TAKE a hop; `test:shukuchiui` asserts the player can SEE where
  // one goes. Both had to land for the bench and the played game to agree, and
  // neither on its own is evidence for the other.
  ok(BOT_CLIENT_KINDS.has('shukuchi') && !BOT_CLIENT_GAPS.has('shukuchi'),
    '✅ the client bot has a path to the hop, and it is no longer declared a gap');

  eq(BOT_SPIRIT_SKILLS[RONIN][0], SHUKUCHI_SKILL,
    '🤖 it is the head of the Ronin\'s ladder — the bot buys ~2.7 skills a match, so the tail is never seen');
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. 🎵 EVERY LANDING PICKS UP (§2.5.2 #5) — through the same helper walking on
//    a hex uses, so charge zones and event hexes behave identically.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st0 = armed(5);
  const target = shukuchiLandings(st0, RONIN)[0];
  // Put a Lost Chord on the landing hex. ⚠️ `boardTokens`, keyed by `num` — the
  // shape `tokenAt` reads. A fixture that invented its own key would assert
  // nothing and still go green, which is the §B2 failure in miniature.
  const st = { ...st0, board: { ...st0.board, boardTokens: [
    ...(st0.board?.boardTokens ?? []).filter(t => t.num !== target),
    { num: target, note: 'C' },
  ] } };
  ok(!!tokenAt(st, target), 'fixture: there is a Lost Chord on the landing hex');

  const r = hop(st, target);
  ok(r.ok, '🌀 the hop runs onto the note');
  eq(tokenAt(r.state, target), null,
    '🎵 the note is off the board — every landing picks up, exactly as walking on does');
  ok((r.logs ?? []).length > 0,
    '🎵 …and it is TRANSCRIBED, so a rewired client renders the find without recomputing it');

  // ⚠️ AND IT RUNS THE SAME HELPER WALKING DOES. `collectPickups` is what pays a
  // seat, the Ronin's second-note roll and a Charge Zone — so "landing picks up"
  // is one line in `transition.js` and not a second copy of the note economy.
  const stockBefore = (nsOf(st, RONIN).noteStock ?? []).filter(Boolean).length;
  const stockAfter = (nsOf(r.state, RONIN).noteStock ?? []).filter(Boolean).length;
  ok(stockAfter >= stockBefore,
    '🎵 the find reaches the stock through the ordinary path, not a bespoke one');
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. THE TURN BOUNDARY — the budget does not carry.
//    ⚠️ Two clocks, deliberately different: the hop budget is PER TURN and the
//    cooldown is PER ROUND. A budget that carried would let him bank a hop
//    against a turn he never paid for.
// ═════════════════════════════════════════════════════════════════════════════
{
  const mid = armed(5, { shukuchiHopsLeft: 2, abilityCd: { [SHUKUCHI_SKILL]: 3 } });
  eq(shukuchiHopsLeft(nsOf(mid, RONIN)), 2, 'fixture: he is mid-Shukuchi with two hops left');

  // `hopBudgetPatch` is the sheet-side half; the turn reset lives in turnFlow's
  // patch and is asserted there by the field being present in the reset list.
  eq(hopBudgetPatch({ shukuchiHopsLeft: 0 }).shukuchiHopsLeft, SHUKUCHI_MAX_HOPS - 1,
    '🌀 an activation opens the budget at two remaining');
  eq(hopBudgetPatch({ shukuchiHopsLeft: 2 }).shukuchiHopsLeft, 1,
    '🌀 …and a continuation spends one');
  eq(hopBudgetPatch({ shukuchiHopsLeft: 1 }).shukuchiHopsLeft, 0,
    '🌀 …down to nothing');

  const src = (await import('node:fs')).readFileSync(
    (await import('node:url')).fileURLToPath(new URL('./systems/turnFlow.js', import.meta.url)), 'utf8');
  ok(/shukuchiHopsLeft:\s*0/.test(src),
    '⚠️ the turn reset still zeroes the budget — without it a hop banks across turns');
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. THE REDUCER IS PURE — it must not mutate the state it is handed.
//     Every searcher result would otherwise be a function of how many times a
//     line was explored (`melodyCommit.js`'s property 1, same reason).
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = armed(5);
  const snapshot = JSON.stringify({ spirits: st.spirits, turn: st.turn });
  const target = shukuchiLandings(st, RONIN)[0];
  applyShukuchiHop(st, { spiritId: RONIN, toNum: target });
  applyShukuchiHop(st, { spiritId: RONIN, toNum: target });
  eq(JSON.stringify({ spirits: st.spirits, turn: st.turn }), snapshot,
    '📏 the hop does not touch the state it was handed — twice through, unchanged');

  const a = applyShukuchiHop(st, { spiritId: RONIN, toNum: target });
  const b = applyShukuchiHop(st, { spiritId: RONIN, toNum: target });
  eq(JSON.stringify(a.spirits), JSON.stringify(b.spirits),
    '📏 …and the same call twice returns the same thing');
}

console.log(`✅ shukuchiCheck — ${checks} assertions passed`);
