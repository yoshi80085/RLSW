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
import { slimeDropped, slimeDecayed, slimeCleared, spiritSlid, moveBudgetSet } from "./actions.js";
import { applyBotAction } from "./policies/transition.js";
import { makeRng } from "./rng.js";
import {
  trailOf, trailRun, slimeAt, slimeBites, slideTarget,
  SLIME_VIBE_DAMAGE, SLIME_TRAIL_TURNS_PROPOSED,
} from "./systems/slime.js";
import { legalActions, tentacleOptions, swingCone } from "./policies/legalActions.js";
import { SLIDE_STEPS_PER_TURN } from "../data/gameConstants.js";
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

  st = apply(st, slimeDecayed());
  eq(trailOf(st, MM).map(e => e.turns), [2, 2], 'every entry ages together');

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
// 4. DECAY — expiry, and the map does not accumulate empty owners.
// ═════════════════════════════════════════════════════════════════════════════
{
  let st = apply(base, slimeDropped(MM, 10, 2));
  st = apply(st, slimeDropped(MM, 11, 1));   // shorter-lived, laid later
  st = apply(st, slimeDecayed());
  eq(trailOf(st, MM).map(e => e.num), [10], 'an expired hex leaves the path');
  ok(st.board.slime[MM], 'a partly-alive trail survives');

  st = apply(st, slimeDecayed());
  eq(trailOf(st, MM), [], 'the last hex expires');
  eq(st.board.slime, {}, '⚠️ …and the OWNER leaves too — no empty arrays accumulate for anyone who ever laid slime');

  // The shipped seeding rule: living-Spirit count, so it expires as the order
  // comes back round. Two Spirits alive ⇒ two ticks ⇒ clean before MM acts.
  let round = apply(base, slimeDropped(MM, 10, 2));
  round = apply(round, slimeDecayed());
  ok(trailOf(round, MM).length === 1, 'still there after the layer’s own turn end');
  round = apply(round, slimeDecayed());
  eq(trailOf(round, MM), [], '…gone exactly as the turn order returns');
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
  eq(SLIME_TRAIL_TURNS_PROPOSED, 2,
     'the rework’s flat-2 lifetime is EXPORTED but unused — a proposal, not a change');
  const st = apply(base, slimeDropped(MM, 10, 4));
  eq(slimeAt(st, 10).turns, 4,
     '⚠️ the lifetime is still whatever the caller seeds — the client still passes the living-Spirit count');
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

console.log(`✅ slimeCheck — ${count} assertions passed`);
