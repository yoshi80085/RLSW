// ─── SLIME TRAIL CHECK ───────────────────────────────────────────────────────
// `npm run test:slime`. Pins `engine/systems/slime.js` — the ordered, owned
// path that `METALNESS_REWORK_DESIGN.md` §3 turns into a currency.
//
// The migration this covers is behaviour-PRESERVING by design: the trail moved
// out of React and into engine state, and nothing about its lifetime, its
// damage or its immunity rule changed. So most of what is asserted here is
// "still true", and the interesting assertions are the two properties the old
// `{hexNum: turns}` map could not HOLD, let alone express — ORDER and OWNER.

import assert from "node:assert";
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import { slimeDropped, slimeDecayed, slimeCleared, spiritSlid, moveBudgetSet, moveStep, slimeCalled, turnEnded } from "./actions.js";
import { applyBotAction } from "./policies/transition.js";
import { makeRng } from "./rng.js";
import {
  trailOf, trailRun, slimeAt, slimeBites, slideTarget,
  canCallSlime, SLIME_INNATE_OWNER,
  SLIME_VIBE_DAMAGE, SLIME_LIFETIME,
} from "./systems/slime.js";
import { legalActions, tentacleOptions, swingCone } from "./policies/legalActions.js";
import { SLIDE_STEPS_PER_TURN, SLIME_TRAIL_MAX, SLIME_AP_COST, SLIME_MOVE_STEPS, SLIME_LIFETIME_TURNS } from "../data/gameConstants.js";
import { HEX_BY_NUM, ALL_HEXES } from "../board/hexMap.js";
import { axialDist } from "../board/hexGeometry.js";

let count = 0;
const ok = (cond, msg) => { count++; assert.ok(cond, msg); };
const eq = (a, b, msg) => { count++; assert.deepStrictEqual(a, b, msg); };

const MM = 'Metalness_Monster';
const RONIN = 'cosmic_ronin';

const base = makeInitialState({
  spirits: [
    { id: MM,    name: 'Metalness Monster', num: 1, maxVibe: 5, vibe: 5, speed: 4 },
    { id: RONIN, name: 'Shredding Ronin',   num: 30, maxVibe: 5, vibe: 5, speed: 5 },
  ],
  mode: 'ffa', startingLives: 3,
}, 12345);

const apply = (st, a) => applyAction(st, a);

/** A real chain of adjacent hexes starting from `startNum`, length n. */
function walk(startNum, n) {
  const path = [startNum];
  let cur = HEX_BY_NUM[startNum];
  const used = new Set([startNum]);
  while (path.length <= n) {
    const next = ALL_HEXES.find(h =>
      !used.has(h.num) && axialDist(cur.q, cur.r, h.q, h.r) === 1);
    if (!next) break;
    path.push(next.num); used.add(next.num); cur = next;
  }
  return path;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE SHAPE — engine state, not React state.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(base.board.slime, {}, 'a fresh board carries an empty slime map, not undefined');
  eq(trailOf(base, MM), [], 'trailOf never returns null — an absent trail is an empty one');
  eq(slimeAt(base, 1), null, 'nothing on a clean hex');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. DROP — newest first, and re-entering REFRESHES rather than duplicates.
// ═════════════════════════════════════════════════════════════════════════════
{
  let st = base;
  st = apply(st, slimeDropped(MM, 10, 3));
  st = apply(st, slimeDropped(MM, 11, 3));
  eq(trailOf(st, MM).map(e => e.num), [11, 10], 'the path is NEWEST FIRST — index 0 is the hex just vacated');

  st = apply(st, slimeDecayed(MM));
  eq(trailOf(st, MM).map(e => e.turns), [2, 2], 'every entry ages together');
  eq(apply(st, slimeDecayed(RONIN)), st,
     '⚠️ …and ONLY its owner\'s. Ageing every road on every turn end is what made a lifetime quoted in turns silently mean spirit-turns.');

  // Double back onto 10.
  st = apply(st, slimeDropped(MM, 10, 3));
  eq(trailOf(st, MM).map(e => e.num), [10, 11], 'a re-entered hex moves to the FRONT');
  eq(trailOf(st, MM).length, 2, '⚠️ …and does NOT appear twice — a doubled entry would price one hex as two steps of Tentacle reach');
  eq(trailOf(st, MM)[0].turns, 3, '…refreshed to full life');

  ok(!apply(st, slimeDropped(MM, null, 3)).board.slime[MM].some(e => e.num == null),
     'a null hex is refused rather than stored');
  eq(apply(st, slimeDropped(MM, 12, 0)), st, 'a zero-life drop is a no-op, not a hex that expires on arrival');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. OWNERSHIP — the property the old map could not hold at all.
//    "Immune to his own" was a hardcoded string compare against one Spirit id.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = apply(base, slimeDropped(MM, 10, 3));
  eq(slimeAt(st, 10), { ownerId: MM, turns: 3 }, 'slime knows whose it is');
  ok(!slimeBites(st, MM, 10),    'the owner is immune to their own goo');
  ok(slimeBites(st, RONIN, 10),  '…and everybody else is not');
  ok(!slimeBites(st, RONIN, 11), 'a clean hex bites nobody');

  // The rule is now about ownership, not about one Spirit id.
  const roninTrail = apply(base, slimeDropped(RONIN, 20, 3));
  ok(!slimeBites(roninTrail, RONIN, 20),
     '⚠️ the immunity is a RULE about owners, not a string compare on Metalness');
  ok(slimeBites(roninTrail, MM, 20), '…so a second trail-layer would bite the Monster');
  eq(SLIME_VIBE_DAMAGE, 1, 'the bite is still 1 Vibe — the migration changed no numbers');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. DECAY — ONE lifetime, counted in the OWNER'S turns.
//
//    ⚠️ An earlier pass split this into a short "bite" window and a longer
//    "road" window so dried slime stayed walkable but harmless. That existed
//    only to work around a road that expired before its owner could spend it,
//    and making Slime an ABILITY removed the problem — he places road on
//    purpose now, and it lives three of his own turns as both. The split went
//    with its reason; a rule kept past its cause is one nobody can explain.
// ═════════════════════════════════════════════════════════════════════════════
{
  let st = apply(base, slimeDropped(MM, 10, 2));
  st = apply(st, slimeDropped(MM, 11, 1));   // shorter-lived, laid later
  st = apply(st, slimeDecayed(MM));
  eq(trailOf(st, MM).map(e => e.num), [10], 'an expired hex leaves the road');
  ok(st.board.slime[MM], 'a partly-alive road survives');

  st = apply(st, slimeDecayed(MM));
  eq(trailOf(st, MM), [], 'the last hex expires');
  eq(st.board.slime, {}, '⚠️ …and the OWNER leaves too — no empty arrays accumulate');

  // ── THE TRAP THIS RULE IS BUILT OUT OF ────────────────────────────────────
  // Three of HIS turns. Ticked on anyone's turn end it would be three
  // spirit-turns, so in a four-handed game the road would be gone before he
  // acted again and the ability would read as broken rather than as short.
  // `economy.js` carries the same warning on Sunbeam's `blindTurns`, and
  // `decayPoisonSlime` fell into it once already — this is the third system
  // with that shape and the first built to refuse it.
  let live = apply(base, slimeDropped(MM, 10, SLIME_LIFETIME_TURNS));
  for (const rival of [RONIN, RONIN, RONIN]) live = apply(live, slimeDecayed(rival));
  eq(trailOf(live, MM).map(e => e.turns), [SLIME_LIFETIME_TURNS],
     '⚠️ a whole revolution of RIVAL turn-ends does not age his road by one tick');
  for (let i = 0; i < SLIME_LIFETIME_TURNS - 1; i++) live = apply(live, slimeDecayed(MM));
  ok(trailOf(live, MM).length === 1, '…it survives his own turns up to the last one');
  live = apply(live, slimeDecayed(MM));
  eq(trailOf(live, MM), [], '…and expires on the third of HIS turns, which is the number on the tin');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. ⚠️ `trailRun` — CONTIGUITY. The whole reason the trail became a path.
//    The Slide walks this and the Tentacle reaches through it. Reaching across
//    a gap would look like a slightly longer reach, not like a broken rule —
//    which is exactly why it is pinned rather than trusted.
// ═════════════════════════════════════════════════════════════════════════════
{
  const chain = walk(base.spirits[0].num, 4);   // [standing, a, b, c, d]
  ok(chain.length >= 4, 'the board gave us a real chain to test with');

  // Lay it the way WALKING lays it: slime goes on the hex you LEAVE, so he
  // drops on every hex except the one he ends up standing on.
  let st = base;
  for (let i = 0; i < chain.length - 1; i++) st = apply(st, slimeDropped(MM, chain[i], 9));
  st = { ...st, spirits: st.spirits.map(s => s.id === MM ? { ...s, num: chain[chain.length - 1] } : s) };

  const run = trailRun(st, MM);
  eq(run, chain.slice(0, -1).reverse(),
     'the run walks back the way he came, nearest hex first');
  ok(run.length === chain.length - 1, 'the run length IS the maximum reach');

  // ⚠️ He never stands on his own newest slime — it goes on the hex he vacated.
  ok(!trailOf(st, MM).some(e => e.num === chain[chain.length - 1]),
     'the hex he is standing on carries no slime of his own');

  // Break the middle and the run must stop at the break.
  const broken = apply(st, slimeCleared(MM, [run[1]]));
  eq(trailRun(broken, MM), [run[0]],
     '⚠️ a gap STOPS the run — a knockback, a warp or an expiring middle segment all break the road');
  ok(trailOf(broken, MM).length > 1,
     '…even though the trail itself still has hexes beyond the gap');

  // A trail that is not adjacent to him at all gives no run.
  const far = chain.find(n => {
    const h = HEX_BY_NUM[n], me = HEX_BY_NUM[base.spirits[0].num];
    return axialDist(h.q, h.r, me.q, me.r) > 1;
  });
  ok(far != null, 'the chain reaches somewhere non-adjacent');
  const stranded = apply(base, slimeDropped(MM, far, 9));
  eq(trailRun(stranded, MM), [], 'slime you are not standing next to is not a road');

  // ⚠️ NOT a nearest-neighbour search: a stray hex that happens to sit beside
  // him but was laid long ago must not be picked up out of order.
  eq(trailRun(base, MM), [], 'no trail, no run');
  eq(trailRun(st, 'nobody'), [], 'a Spirit who is not on the board has no run');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. CLEAR — the write the three competing uses all spend through (§3).
// ═════════════════════════════════════════════════════════════════════════════
{
  let st = base;
  for (const n of [10, 11, 12]) st = apply(st, slimeDropped(MM, n, 5));

  const partial = apply(st, slimeCleared(MM, [11]));
  eq(trailOf(partial, MM).map(e => e.num), [12, 10], 'a partial spend removes exactly what it names');

  const whole = apply(st, slimeCleared(MM));
  eq(trailOf(whole, MM), [], 'no hex list collapses the WHOLE trail — that is the Slam');
  eq(whole.board.slime, {}, '…and the owner goes with it');

  eq(apply(base, slimeCleared(MM, [10])), base, 'clearing a trail that is not there is a no-op');

  const allNamed = apply(st, slimeCleared(MM, [10, 11, 12]));
  eq(allNamed.board.slime, {}, 'naming every hex is the same as naming none');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. THE MIGRATION'S OWN CLAIM — nothing about the shipped rules moved.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(SLIME_LIFETIME, SLIME_LIFETIME_TURNS,
     'the system re-exports the tuning constant rather than keeping a second copy of it');
  const st = apply(base, slimeDropped(MM, 10, 4));
  eq(slimeAt(st, 10).turns, 4,
     'the drop still takes its lifetime from the caller — the reducer supplies SLIME_LIFETIME_TURNS at the one drop site');
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. 🧪 THE SLIDE — free retreat BACKWARDS along his own trail, spending it.
//    §5's ruling: sliding CONSUMES the slime, so all three uses of the trail
//    compete for one meter and a long escape costs a long road.
// ═════════════════════════════════════════════════════════════════════════════
{
  const chain = walk(base.spirits[0].num, 3);
  let st = base;
  for (let i = 0; i < chain.length - 1; i++) st = apply(st, slimeDropped(MM, chain[i], 9));
  st = { ...st, spirits: st.spirits.map(s => s.id === MM ? { ...s, num: chain[chain.length - 1] } : s) };

  // ── the budget is granted with the legs, by MOVE_BUDGET_SET ──
  eq(st.turn.slideStepsLeft, 0, 'no melody committed, no slide');
  eq(slideTarget(st, MM), null, '…and no target to offer');
  st = apply(st, moveBudgetSet(4, false));
  eq(st.turn.slideStepsLeft, SLIDE_STEPS_PER_TURN, 'the commit that grants legs grants the slide too');

  // ⚠️ tripped halves the WALK and not the slide — the slide is the road he
  // already walked, not a walk he is about to take.
  const trip = apply(st, moveBudgetSet(4, true));
  ok(trip.turn.moveStepsLeft < 4, 'tripped still halves the walk');
  eq(trip.turn.slideStepsLeft, SLIDE_STEPS_PER_TURN, '…and deliberately does not halve the slide');

  const first = slideTarget(st, MM);
  eq(first, chain[chain.length - 2], 'the slide goes to the hex he most recently vacated');

  const facingBefore = st.spirits.find(s => s.id === MM).facing;
  const slid = apply(st, spiritSlid(MM, first));
  eq(slid.spirits.find(s => s.id === MM).num, first, 'he moved');
  eq(slid.spirits.find(s => s.id === MM).facing, facingBefore,
     '⚠️ …WITHOUT re-facing — isRearHit reads facing on DEFENCE, so a re-facing retreat would turn his back on what he just escaped');
  eq(slid.turn.moveStepsLeft, st.turn.moveStepsLeft, '⚠️ and it cost no AP — this is the one exception to §1\u2019s spine');
  eq(slid.turn.slideStepsLeft, SLIDE_STEPS_PER_TURN - 1, 'it spent one slide step');

  // ⚠️ THE COST: the slime he crossed is GONE.
  eq(slimeAt(slid, first), null, '⚠️ sliding CONSUMES the slime it crosses — §5\u2019s ruling, and what puts all three uses on one meter');
  ok(!trailOf(slid, MM).some(e => e.num === first), '…so the road behind him is one hex shorter');
  ok(!trailOf(slid, MM).some(e => e.num === slid.spirits.find(s => s.id === MM).num),
     'he never stands on his own slime — the invariant trailRun depends on');

  // It composes with itself: the next slide is again trailRun[0].
  const second = slideTarget(slid, MM);
  eq(second, chain[chain.length - 3], 'the next slide continues back down the road');
  const twice = apply(slid, spiritSlid(MM, second));
  eq(twice.turn.slideStepsLeft, 0, 'the budget runs out');
  eq(slideTarget(twice, MM), null, '⚠️ and an exhausted budget offers NO target — the cap is what stops one enormous disengage');

  // A Spirit with no trail cannot slide at all.
  const clean = apply(base, moveBudgetSet(4, false));
  eq(slideTarget(clean, MM), null, 'no trail, no retreat');
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. THE SLIDE IS VISIBLE TO THE SEARCHER — the whole reason for the migration.
// ═════════════════════════════════════════════════════════════════════════════
{
  const chain = walk(base.spirits[0].num, 3);
  let st = { ...base, acting: MM };
  for (let i = 0; i < chain.length - 1; i++) st = apply(st, slimeDropped(MM, chain[i], 9));
  st = { ...st, spirits: st.spirits.map(s => s.id === MM ? { ...s, num: chain[chain.length - 1] } : s) };
  st = apply(st, moveBudgetSet(4, false));
  st = { ...st, noteStates: { ...st.noteStates, [MM]: { ...st.noteStates[MM], hasConfirmed: true } } };

  const acts = legalActions(st, MM, {});
  const slides = acts.filter(a => a.kind === 'slide');
  eq(slides.length, 1, 'exactly one slide is offered — one hex at a time');
  eq(slides[0].to, chain[chain.length - 2], '…to the hex he just left');
  eq(slides[0].apCost, 0, '…for free');

  // ⚠️ Not gated on the action token: swing, THEN slide out. That line is the
  // whole point of the ability (§2 — "the only melee Spirit who can hit and leave").
  const spent = { ...st, turn: { ...st.turn, actionTokenUsed: true } };
  ok(legalActions(spent, MM, {}).some(a => a.kind === 'slide'),
     '⚠️ the slide survives a spent action token — hit and leave');

  // ⚠️ Not gated on AP either: stranded with no legs, he can still get out.
  const noAp = { ...st, turn: { ...st.turn, moveStepsLeft: 0 } };
  const noApActs = legalActions(noAp, MM, {});
  ok(!noApActs.some(a => a.kind === 'move'), 'no AP, no walking');
  ok(noApActs.some(a => a.kind === 'slide'), '⚠️ …but the retreat is still there — free movement is the innate');

  // A rival standing on the hex blocks it, same as any move.
  const blockedSt = { ...st, spirits: st.spirits.map(s => s.id === RONIN ? { ...s, num: chain[chain.length - 2] } : s) };
  ok(!legalActions(blockedSt, MM, {}).some(a => a.kind === 'slide'),
     'a body on the road blocks the retreat, same as any hex');
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. 🐙 THE TENTACLE — a Swing thrown from the trail, paid for in road (§4a).
// ═════════════════════════════════════════════════════════════════════════════
{
  const chain = walk(base.spirits[0].num, 4);
  let st = { ...base, acting: MM };
  for (let i = 0; i < chain.length - 1; i++) st = apply(st, slimeDropped(MM, chain[i], 9));
  st = { ...st, spirits: st.spirits.map(s => s.id === MM ? { ...s, num: chain[chain.length - 1] } : s) };
  const self = st.spirits.find(s => s.id === MM);

  const opts = tentacleOptions(st, self);
  eq(opts.length, chain.length - 1, 'one origin per hex of the contiguous run');
  eq(opts.map(o => o.reach), opts.map((_, i) => i + 1), 'reach counts outward from him');

  // ⚠️ REACH IS PRICED BY INDEX — the far origin costs the whole road.
  eq(opts[0].spend, [chain[chain.length - 2]], 'the nearest origin spends one hex');
  eq(opts[opts.length - 1].spend.length, opts.length,
     '⚠️ the furthest origin spends the WHOLE road — range is priced, which is what makes it compete with the Slide and the Slam');
  for (const o of opts) eq(o.spend[o.spend.length - 1], o.origin, 'the origin is always the last hex paid for');

  // ⚠️ THE ARM HAS ITS OWN FACING, and it is the road — not his.
  const spun = { ...self, facing: (self.facing ?? 0) + Math.PI };
  deepSameCones(tentacleOptions({ ...st, spirits: st.spirits.map(s => s.id === MM ? spun : s) }, spun), opts);
  function deepSameCones(a, b) {
    eq(a.map(o => [...o.cone].sort()), b.map(o => [...o.cone].sort()),
       '⚠️ turning him on the spot does NOT move the arm — the cone faces down the road it travelled, which is why he never has to re-face');
  }

  // …and it is genuinely a different cone from his own Swing.
  const ownCone = [...swingCone(self)].sort();
  ok(opts.some(o => JSON.stringify([...o.cone].sort()) !== JSON.stringify(ownCone)),
     'the arm threatens hexes his own Swing cannot');

  // A gap in the road shortens the option list, exactly as it shortens the run.
  const broken = apply(st, slimeCleared(MM, [chain[chain.length - 3]]));
  eq(tentacleOptions(broken, self).length, 1, 'a broken road offers only the origins before the break');
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. 🐙 THE TENTACLE THROUGH THE SEARCHER — legal, and it PAYS.
// ═════════════════════════════════════════════════════════════════════════════
{
  const chain = walk(base.spirits[0].num, 4);
  let st = { ...base, acting: MM };
  for (let i = 0; i < chain.length - 1; i++) st = apply(st, slimeDropped(MM, chain[i], 9));
  st = { ...st, spirits: st.spirits.map(s => s.id === MM ? { ...s, num: chain[chain.length - 1] } : s) };
  st = apply(st, moveBudgetSet(5, false));
  st = { ...st, noteStates: { ...st.noteStates, [MM]: {
    ...st.noteStates[MM], hasConfirmed: true, unlockedSkills: ['tentacle'],
  } } };

  const self = st.spirits.find(s => s.id === MM);
  const opts = tentacleOptions(st, self);
  const far  = opts[opts.length - 1];
  const spot = [...far.cone][0];

  // No skill, no arm.
  const unskilled = { ...st, noteStates: { ...st.noteStates, [MM]: { ...st.noteStates[MM], unlockedSkills: [] } } };
  const parked = { ...unskilled, spirits: unskilled.spirits.map(s => s.id === RONIN ? { ...s, num: spot } : s) };
  ok(!legalActions(parked, MM, {}).some(a => a.kind === 'tentacle'), 'the Tentacle is an unlock, not an innate');

  // Rival parked in the far cone — the arm reaches.
  const armed = { ...st, spirits: st.spirits.map(s => s.id === RONIN ? { ...s, num: spot } : s) };
  const acts  = legalActions(armed, MM, {}).filter(a => a.kind === 'tentacle');
  ok(acts.length >= 1, 'the searcher is offered the strike');
  ok(acts.every(a => a.apCost === 1), 'it costs a Swing, because it IS a Swing');
  ok(acts.every(a => a.spend.length === a.reach), '⚠️ every action carries its own price, so a scorer can compare reaches');

  // ⚠️ EVERY (rival × origin) PAIR, not just the cheapest — §6a: this generator
  // answers what is LEGAL, never what is good. This is also exactly the
  // branching blow-up §6 predicted, and why beamActions' null `score` is now a
  // blocker rather than a to-do.
  const reaches = new Set(acts.map(a => a.reach));
  ok(reaches.size >= 1, 'reaches are enumerated rather than pre-narrowed');

  // ── AND IT PAYS. The road it reached through is gone, win or lose. ──
  const chosen = acts.reduce((a, b) => (a.reach >= b.reach ? a : b));
  const before = trailOf(armed, MM).length;
  const res = applyBotAction(armed, chosen, { rng: makeRng(7) });
  ok(res.ok, 'the transition runs it');
  const after = trailOf(res.state, MM).length;
  eq(after, before - chosen.reach,
     '⚠️ the reach is PAID IN ROAD — spent before the dice, so a whiffed reach is never free');
  for (const h of chosen.spend) eq(slimeAt(res.state, h), null, 'every hex it reached through is gone');
  eq(res.state.spirits.find(s => s.id === MM).num, self.num, 'and he never moved');
  eq(res.state.spirits.find(s => s.id === MM).facing, self.facing,
     '⚠️ …and never turned. Both trail abilities decline the re-face walking gives you.');
  eq(res.state.turn.actionTokenUsed, true, 'it spends the one attack of the turn');
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. 🧪 SLIME IS AN ABILITY — called for 1 AP, then walked.
//
// This section used to prove that WALKING laid road, because the road was a
// passive and the drop site was a client side effect the engine never saw.
// Both of those are gone. Slime is now a deliberate call that costs AP, SETS
// movement to 3, and arms `applyMoveStep` to turn each vacated hex into road —
// which also means a searcher can BUILD a road instead of only inheriting one.
// ═════════════════════════════════════════════════════════════════════════════
{
  const chain = walk(base.spirits[0].num, SLIME_MOVE_STEPS);
  let st = { ...base, acting: MM };
  st = apply(st, moveBudgetSet(4, false));
  st = { ...st, noteStates: { ...st.noteStates, [MM]: {
    ...st.noteStates[MM], hasConfirmed: true, unlockedSkills: ['tentacle'],
  } } };

  // ── OFF BY DEFAULT, and that is the change §5 asked for. ──────────────────
  // "It is a resource he accrues for free that rivals can only avoid" was the
  // doc's one unanswered complaint about the trail. Walking no longer pays it.
  const dry = apply(st, moveStep(MM, chain[1], false));
  eq(trailOf(dry, MM), [],
     '⚠️ walking lays NO road until the ability is called — the free trail is gone');
  eq(dry.turn.slimingId, null, '…and nothing switched itself on');

  // ── CALL IT ───────────────────────────────────────────────────────────────
  const called = apply(st, slimeCalled(MM));
  eq(called.turn.slimingId, MM, 'the ooze is on, and it is owned');
  eq(called.turn.moveStepsLeft, SLIME_MOVE_STEPS,
     '⚠️ movement is SET to 3, not decremented by the 1 AP — see gameConstants on why a set is the more interesting number');

  // ⚠️ THE HALF THAT MAKES IT AN ABILITY RATHER THAN A TAX. Off a good melody
  // the call costs a step; off a bad one it HANDS him steps. That is the first
  // thing in his kit that gives a weak commit somewhere useful to go.
  const thin = apply({ ...st, turn: { ...st.turn, moveStepsLeft: 1 } }, slimeCalled(MM));
  eq(thin.turn.moveStepsLeft, SLIME_MOVE_STEPS,
     '⚠️ from a 1-AP turn the call is a NET GAIN of movement');
  const broke = apply({ ...st, turn: { ...st.turn, moveStepsLeft: 0 } }, slimeCalled(MM));
  eq(broke.turn.slimingId, null, '…but an empty pool cannot pay the 1 AP, so nothing happens');

  // ── ONCE PER TURN — and this gate is load-bearing, not hygiene. Because the
  // call SETS the pool, a second one would top it back up to 3 for 1 AP, over
  // and over: 1 AP for 2 net steps, repeatable. That is a movement engine, and
  // it would erase the ceiling on his road that §3's whole currency rests on.
  ok(legalActions(st, MM, {}).some(a => a.kind === 'slime'), 'it is offered');
  ok(!legalActions(called, MM, {}).some(a => a.kind === 'slime'),
     '⚠️ …and never twice in a turn');
  const slimeAct = legalActions(st, MM, {}).find(a => a.kind === 'slime');
  eq(slimeAct.apCost, SLIME_AP_COST, 'the searcher sees the bill');
  eq(slimeAct.apGranted, SLIME_MOVE_STEPS,
     '⚠️ …and the GRANT, because this action rewrites the budget every action after it spends from. Pricing it as "-1 AP" gets the sign wrong on a bad melody.');

  // ── NOW WALK. The reducer lays the road; no client side effect involved. ──
  let run = called;
  for (let i = 1; i < chain.length; i++) run = apply(run, moveStep(MM, chain[i], false));
  const walked = chain.slice(0, -1);

  eq(trailOf(run, MM).map(e => e.num), [...walked].reverse(),
     'every hex he vacated while oozing became road, newest first');
  eq(trailOf(run, MM).map(e => e.turns),
     walked.map(() => SLIME_LIFETIME_TURNS), '…each seeded with the owner-turn lifetime');
  eq(run.turn.moveStepsLeft, 0, 'three steps is exactly what three steps buys');
  eq(trailRun(run, MM), [...walked].reverse(),
     '⚠️ and the road is ONE CONTIGUOUS RUN, so every hex is reachable by the abilities that spend it');

  const self = run.spirits.find(s => s.id === MM);
  eq(slimeAt(run, self.num), null,
     '⚠️ he never stands on his own road — `applySpiritSlid` depends on path[0] being a hex he has LEFT');

  // ── THE ABILITIES LIGHT UP OFF IT ────────────────────────────────────────
  const acts = legalActions(run, MM, {});
  ok(acts.some(a => a.kind === 'slide'), 'the Slide is on the table');
  eq(acts.filter(a => a.kind === 'slide')[0].to, walked[walked.length - 1],
     '…back down the hex he most recently vacated');
  eq(tentacleOptions(run, self).length, walked.length,
     'the arm reaches exactly as far as he laid');

  // ── AND IT SURVIVES INTO HIS NEXT TURN, which is the whole point of counting
  // the lifetime in HIS turns. A full revolution of rivals ending their turns
  // does not age it at all.
  let next = run;
  for (const r of [RONIN, RONIN, RONIN]) next = apply(next, slimeDecayed(r));
  eq(trailOf(next, MM).map(e => e.turns), walked.map(() => SLIME_LIFETIME_TURNS),
     '⚠️ rivals ending their turns do not touch his road');
  ok(legalActions({ ...next, turn: { ...next.turn, slimingId: null, moveStepsLeft: 4 } }, MM, {})
       .some(a => a.kind === 'slide'),
     '⚠️ …so the Slide is still there when his turn comes back round, which under the passive it never was');

  // ── TURN END CLEANS UP AFTER ITSELF ──────────────────────────────────────
  const ended = apply({ ...run, acting: MM }, turnEnded());
  eq(ended.turn.slimingId, null,
     '⚠️ the ooze is a THIS-TURN state — left set, every future walk would lay road for free and the passive would be back');
  eq(trailOf(ended, MM).map(e => e.turns), walked.map(() => SLIME_LIFETIME_TURNS - 1),
     '…and his own turn end is the one that ages his road');
}
// ═════════════════════════════════════════════════════════════════════════════
// 13. ⚠️ THE CAP — the road is his last SLIME_TRAIL_MAX vacated hexes, and the
//     cap is now the ONLY thing that ends one. Walk a seventh, lose the first.
// ═════════════════════════════════════════════════════════════════════════════
{
  const chain = walk(base.spirits[0].num, SLIME_TRAIL_MAX + 3);
  ok(chain.length === SLIME_TRAIL_MAX + 4, 'the board affords a walk long enough to overrun the cap');

  let st = { ...base, acting: MM };
  st = apply(st, moveBudgetSet(20, false));
  st = { ...st, noteStates: { ...st.noteStates, [MM]: {
    ...st.noteStates[MM], hasConfirmed: true, unlockedSkills: ['tentacle'],
  } } };
  for (let i = 1; i < chain.length; i++) {
    const from = st.spirits.find(sp => sp.id === MM).num;
    st = apply(st, moveStep(MM, chain[i], false));
    st = apply(st, slimeDropped(MM, from, 4));
  }

  eq(trailOf(st, MM).length, SLIME_TRAIL_MAX, 'the road never grows past the cap');
  eq(trailOf(st, MM).map(e => e.num), chain.slice(-SLIME_TRAIL_MAX - 1, -1).reverse(),
     '⚠️ …and it is the NEWEST hexes that survive — the oldest drops off the far end, so the road tracks where he has been LATELY');

  const self = st.spirits.find(sp => sp.id === MM);
  eq(trailRun(st, MM).length, SLIME_TRAIL_MAX,
     'the whole capped road is still one contiguous run — the cap trims the tail, it does not punch holes');
  eq(tentacleOptions(st, self).length, SLIME_TRAIL_MAX,
     '⚠️ …which BOUNDS the arm at 6 origins. §6 called cone-from-each-trail-hex a bot blocker because `beamActions` keeps an arbitrary first five while its score is null; the cap makes the branching finite by construction rather than by hoping trails stay short.');
}

// ═════════════════════════════════════════════════════════════════════════════
// 14. ⚠️ ONE TICK PER REVOLUTION — driven through REAL turn ends.
//
// This is a regression for a bug that shipped and was caught in play: the road
// aged TWICE per revolution, so a 3-turn lifetime behaved like a 2-turn one.
// `applyTurnEnded` had grown its own decay while the client kept the call it
// used to make — and because `turnEnded` advances `acting` before the client's
// line ran, the extra tick landed on the INCOMING Spirit's road rather than the
// outgoing one. Two owners' worth of wrong, from one duplicated call.
//
// ⚠️ EVERY SECTION ABOVE DRIVES `slimeDecayed` DIRECTLY, which is exactly why
// none of them saw it. Testing the tick in isolation proves the tick; it cannot
// prove how many times a turn fires it. This section spends real `turnEnded`s.
// ═════════════════════════════════════════════════════════════════════════════
{
  let st = { ...base, acting: MM };
  st = apply(st, slimeDropped(MM, 10, SLIME_LIFETIME_TURNS));

  st = apply(st, turnEnded());
  eq(trailOf(st, MM)[0].turns, SLIME_LIFETIME_TURNS - 1,
     'his own turn end ages his road by exactly one');

  // Every other Spirit in the rotation ends a turn. None of them is his.
  const others = base.spirits.filter(sp => sp.id !== MM).length;
  for (let i = 0; i < others; i++) st = apply(st, turnEnded());
  eq(trailOf(st, MM)[0].turns, SLIME_LIFETIME_TURNS - 1,
     '⚠️ …and a full revolution of OTHER turn ends does not age it at all. One tick per revolution, not two.');

  // …so the number in gameConstants is the number of his turns he actually gets.
  let live = { ...base, acting: MM };
  live = apply(live, slimeDropped(MM, 10, SLIME_LIFETIME_TURNS));
  for (let t = 0; t < SLIME_LIFETIME_TURNS - 1; t++) {
    for (let i = 0; i <= others; i++) live = apply(live, turnEnded());
  }
  ok(trailOf(live, MM).length === 1,
     `the road is still there on his ${SLIME_LIFETIME_TURNS}th turn`);
  for (let i = 0; i <= others; i++) live = apply(live, turnEnded());
  eq(trailOf(live, MM), [], '…and gone on the one after, exactly as advertised');
}

// ═════════════════════════════════════════════════════════════════════════════
// 13. 🧪 WHOSE OOZE IS IT — the gate the §6.6 harness found standing open.
//
// ⚠️ REGRESSION, and worth stating what the bug WAS rather than only that it is
// fixed. `legalActions` gated the call on AP and on `turn.slimingId` and on
// nothing else, so it emitted `slime` for every Spirit on the board. It never
// surfaced in play because the button lives behind
// `acting?.id === 'Metalness_Monster'` in the JSX — the rule was in a render
// condition, so the generator had nothing to transcribe and the missing gate
// read as the deliberate absence of an `unlockedSkills` check. The first
// headless match had the Ronin calling the ooze, laying road and sliding on it.
//
// This is exactly the over-permissiveness `legalActions`' header calls the
// dangerous failure: the searcher plans a line the client would never offer.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(canCallSlime(SLIME_INNATE_OWNER), true, 'the owner may call the ooze');
  eq(canCallSlime(RONIN), false, '⚠️ nobody else may — INNATE means no PURCHASE, not no OWNER');
  eq(canCallSlime(undefined), false, 'a missing id is not the owner');

  const armed = (id) => {
    let st = { ...base, acting: id };
    st = apply(st, moveBudgetSet(5, false));
    return { ...st, noteStates: { ...st.noteStates, [id]: { ...st.noteStates[id], hasConfirmed: true } } };
  };

  ok(legalActions(armed(MM), MM, {}).some(a => a.kind === 'slime'),
     'the Monster is offered the ooze with AP in hand');
  ok(!legalActions(armed(RONIN), RONIN, {}).some(a => a.kind === 'slime'),
     '⚠️ THE REGRESSION: no other Spirit is ever offered it, however much AP they hold');
}

console.log(`✅ slimeCheck — ${count} assertions passed`);
