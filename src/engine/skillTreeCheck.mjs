// ─── SKILL TREE CHECK ────────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/skillTreeCheck.mjs
//
// Pins `data/skillTree.js` — extracted from the monolith 2026-08-16 so the
// engine could finally read the thing it had been mirroring by hand.
//
// ⚠️ THE THEME OF THIS FILE IS OWNERSHIP, because that is what the extraction
// found broken in two places at once. Exclusivity is declared ONCE, on a route
// ("this ladder is the Ronin's"), and two separate consumers each re-derived it
// their own way: `legalActions` off `skill.spiritOnly`, which the tree builder
// never populated, and `bot.js` off a hand-written route map that was missing
// one of the three exclusive routes. One fact, two derivations, and neither of
// them right. So most of what is asserted here is that the DATA says who owns
// what, and that nobody is re-deriving it.

import assert from "node:assert";
import { SKILL_TREE, SKILL_BY_ID, SPIRIT_ONLY_ROUTE } from "../data/skillTree.js";
import { skillEligibility } from "./systems/skills.js";
import { legalActions } from "./policies/legalActions.js";
import { makeInitialState } from "./state.js";
import { moveBudgetSet } from "./actions.js";
import { applyAction } from "./reduce.js";

let count = 0;
const ok = (cond, msg) => { count++; assert.ok(cond, msg); };
const eq = (a, b, msg) => { count++; assert.deepStrictEqual(a, b, msg); };

const RONIN = 'cosmic_ronin', ZERO = 'intergalactic_0', MM = 'Metalness_Monster';

const allSkills = () => Object.values(SKILL_BY_ID);

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE SHAPE — every skill is reachable, and carries where it came from.
// ═════════════════════════════════════════════════════════════════════════════
{
  // ⛔ THREE ROUTES, AND ALL THREE ARE EXCLUSIVE. The Theory branch — the last
  // SHARED ladder in the game — was deleted on 2026-09-02
  // (`PROGRESSION_REWRITE_DESIGN.md`), and the rig branch went on 2026-08-20
  // before it. §6 below is the assertion that carries what that means.
  ok(SKILL_TREE.routes.length === 3, 'the tree has its three surviving routes');

  // 🎯 THE FLAT LOOKUP HOLDS EXACTLY WHAT THE ROUTES DECLARE — derived, not a
  // magic number. This used to assert `>= 20`, which is the kind of threshold
  // that passes for years and then fails for the wrong reason: when the rig
  // branch was deleted on 2026-08-20 the count fell from 28 to 18 and this line
  // failed, reporting "the flat lookup found them all" about a lookup that had in
  // fact found them all. Counting the source is the assertion that was meant.
  const declared = SKILL_TREE.routes.flatMap(r =>
    [...(r.skills ?? []), ...(r.subChains ?? []).flatMap(c => c.skills ?? [])]);
  eq(allSkills().length, declared.length,
     `the flat lookup found every skill the routes declare (${declared.length})`);

  for (const sk of allSkills()) {
    ok(typeof sk.id === 'string' && sk.id, 'every skill has an id');
    ok(Number.isFinite(sk.dbCost), `${sk.id} has a Db price — the engine reads it`);
    ok(typeof sk.routeId === 'string', `${sk.id} knows its route`);
    ok('spiritOnly' in sk, `⚠️ ${sk.id} answers the ownership question explicitly, even if the answer is null`);
  }

  // Ids are unique, or the flat map silently ate one.
  const ids = allSkills().map(s => s.id);
  eq(ids.length, new Set(ids).size, 'no two skills share an id');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. ⚠️ OWNERSHIP IS PUSHED DOWN FROM THE ROUTE — the hole this file exists for.
// ═════════════════════════════════════════════════════════════════════════════
{
  const owners = { shredding_ronin: RONIN, metalness: MM, intergalactic: ZERO };
  for (const [routeId, owner] of Object.entries(owners)) {
    const route = SKILL_TREE.routes.find(r => r.id === routeId);
    ok(route, `the ${routeId} route exists`);
    eq(route.spiritOnly, owner, `${routeId} declares its owner on the ROUTE, which is the right place for it`);

    const skills = allSkills().filter(s => s.routeId === routeId);
    ok(skills.length > 0, `${routeId} has skills`);
    for (const sk of skills) {
      eq(sk.spiritOnly, owner,
         `⚠️ ${sk.id} carries its owner DOWN from the route — it was \`undefined\` on all 28 skills until 2026-08-16, which is why the gate below could never fire`);
    }
  }

  // Shared routes say null, not nothing. An absent key reads identically to
  // "nobody has populated this yet", which is exactly how the hole hid.
  for (const sk of allSkills().filter(s => !owners[s.routeId])) {
    eq(sk.spiritOnly, null, `${sk.id} is on a shared route and says so explicitly`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. ⚠️ THE DERIVED MAP — and the route it used to be missing.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(SPIRIT_ONLY_ROUTE.shredding_ronin, RONIN, 'the Ronin route maps to the Ronin');
  eq(SPIRIT_ONLY_ROUTE.metalness, MM, 'the Metalness route maps to the Monster');
  eq(SPIRIT_ONLY_ROUTE.intergalactic, ZERO,
     '⚠️ THE REGRESSION: the hand-written map omitted this one, so the bot could buy Intergalactic 0\'s exclusive route on any Spirit');

  // Derived, not written — every exclusive route in the tree is in the map and
  // nothing else is.
  const declared = SKILL_TREE.routes.filter(r => r.spiritOnly).map(r => r.id).sort();
  eq(Object.keys(SPIRIT_ONLY_ROUTE).sort(), declared,
     'the map IS the tree — adding an exclusive route is one edit, not two');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. THE GATE ACTUALLY FIRES — end to end, through the real eligibility rule.
// ═════════════════════════════════════════════════════════════════════════════
{
  const tentacle = SKILL_BY_ID.tentacle;
  ok(tentacle, 'the Tentacle is in the tree');

  // ⚠️ `unlocked` matters: this rule answers prereqs and ownership TOGETHER, so
  // a shared rung with an unmet prereq fails for a reason that has nothing to do
  // with who owns it. Pass the prereq in when the question is ownership.
  const gate = (skill, selfId, unlocked = []) =>
    skillEligibility(skill, unlocked, { ownerRoute: skill.spiritOnly ?? null, selfId }).ok;

  eq(gate(tentacle, MM), true, 'the Monster may buy his own arm');
  eq(gate(tentacle, RONIN), false, '⚠️ …and nobody else may');
  eq(gate(SKILL_BY_ID.blaster_of_ra, RONIN), false, 'nor may the Ronin take the Blaster');
  eq(gate(SKILL_BY_ID.blaster_of_ra, ZERO), true, 'its owner may');
  // ⛔ THE SHARED-RUNG ARM HAS NO LIVE DATA LEFT TO STAND ON. It used `amp_2`
  // until 2026-08-20 and `theory_minor` until 2026-09-02; both ladders are
  // deleted and every surviving route is exclusive, so there is no shared rung in
  // the game to assert about. ⚠️ IT IS NOT REPLACED WITH A FIXTURE — a shared-rung
  // assertion passing against an invented skill is `legalActionsCheck` §15 exactly,
  // and it would read as evidence the game still has a shared ladder. §6 asserts
  // the truth instead: it does not.
  //
  // The `prereq` refusal is in the same position — nothing in the tree chains any
  // more — so the reason-naming assertion is tested on a LABELLED unit fixture and
  // says so.
  const unitChild = { id: 'unit_child', routeId: 'unit', prereq: 'unit_root', spiritOnly: null };
  eq(skillEligibility(unitChild, [], { ownerRoute: null, selfId: RONIN }).reason, 'prereq',
     '🧪 UNIT: the rule still names a prereq refusal — no shipped route exercises this');
  eq(skillEligibility(unitChild, ['unit_root'], { ownerRoute: null, selfId: RONIN }).ok, true,
     '🧪 UNIT: …and clears once the prereq is held');
  eq(skillEligibility(tentacle, [], { ownerRoute: tentacle.spiritOnly, selfId: RONIN }).reason, 'owner',
     '⚠️ …and ownership refuses by NAME, so a future bug here is legible rather than silent');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. ⚠️ THROUGH `legalActions` — the consumer whose gate had never once fired.
// ═════════════════════════════════════════════════════════════════════════════
{
  const CONFIG = {
    mode: 'ffa', startingLives: 3,
    spirits: [
      { id: RONIN, name: 'Shredding Ronin',   corner: 'blue',   num: 12, vibe: 5, maxVibe: 5, knockedOut: false, facing: 0 },
      { id: MM,    name: 'Metalness Monster', corner: 'yellow', num: 28, vibe: 5, maxVibe: 5, knockedOut: false, facing: 0 },
    ],
  };

  const rich = (id) => {
    let st = makeInitialState(structuredClone(CONFIG), 4242);
    st = { ...st, acting: id };
    st = applyAction(st, moveBudgetSet(5, false));
    // 📌 Db is irrelevant to this family now — you may SAVE toward anything you
    // are eligible for however broke you are. Left rich anyway, so a regression
    // that reintroduced an affordability gate would show up as a diff here.
    return { ...st, noteStates: { ...st.noteStates, [id]: { ...st.noteStates[id], dbPoints: 999 } } };
  };

  const offered = (id) => new Set(
    legalActions(rich(id), id, { skillById: SKILL_BY_ID })
      .filter(a => a.kind === 'skillTarget').map(a => a.skillId));

  const toRonin = offered(RONIN);
  const toMonster = offered(MM);

  ok(toRonin.size > 0, 'with a real tree in the view, the skillTarget family finally appears');
  ok(toMonster.has('tentacle'), 'the Monster is offered his own arm');
  ok(!toRonin.has('tentacle'),
     '⚠️ THE REGRESSION: the Ronin is NOT offered the Tentacle — this gate read an always-undefined field until the tree was extracted');
  ok(!toRonin.has('goes_to_11'), '…nor the dial');
  ok(!toMonster.has('blaster_of_ra'), '…and the Monster is not offered the Blaster');
  ok(toRonin.has('psycho_bushido'), 'each Spirit IS offered their own exclusive route');
  ok(toMonster.has('goes_to_11') && toMonster.has('master_moshpits'),
     '…including the Monster\'s whole rework, which is the point of the extraction');
  ok(!toMonster.has('psycho_bushido'), 'the Monster is not offered the Ronin\'s route either — the gate cuts both ways');

  // 📌 A rung a Spirit ALREADY OWNS is offered to nobody — `skillEligibility`
  // returns `already`. This was pinned on `amp_1` (granted to everyone at setup)
  // until the rig branch went, then on the Ronin's free `theory_minor` until the
  // Theory branch went. ⚠️ **NOBODY IS BORN HOLDING A SKILL ANY MORE**
  // (`economy.js` seeds `unlockedSkills: []` for the whole roster), so the rule is
  // exercised by handing a Spirit a rung and checking it leaves the list. Worth
  // keeping, because "rung missing from the list" is otherwise indistinguishable
  // from a broken gate.
  const ownedAlready = new Set(
    legalActions(
      (() => { const st = rich(RONIN);
               return { ...st, noteStates: { ...st.noteStates,
                 [RONIN]: { ...st.noteStates[RONIN], unlockedSkills: ['psycho_bushido'] } } }; })(),
      RONIN, { skillById: SKILL_BY_ID })
      .filter(a => a.kind === 'skillTarget').map(a => a.skillId));
  ok(!ownedAlready.has('psycho_bushido'),
     'a rung already held is not offered again — `already`, not a broken gate');
  ok(ownedAlready.has('shadow_illusion'),
     '…while the rest of his own route still is');

  // 🛑 AND NOTHING FROM THE DELETED RIG BRANCH IS OFFERED TO ANYBODY. This is the
  // assertion that would have caught a half-finished deletion: the ids are gone
  // from the tree, so the family cannot emit them, so no Spirit can aim Db at a
  // rung that does nothing.
  for (const dead of ['amp_1', 'amp_2', 'amp_3', 'power_1', 'power_2', 'power_3',
                      'range_1', 'range_2', 'range_3', 'overcharge',
                      // 🅰️ and the Theory branch, deleted 2026-09-02 — stack seats
                      // are FOUND on the board now (`music/stackSlots.js`), and
                      // the pardon ladder is universal and free.
                      'theory_major', 'theory_minor', 'theory_dom7',
                      'theory_modes', 'theory_chromatic', 'theory_sus']) {
    ok(!toRonin.has(dead) && !toMonster.has(dead) && !SKILL_BY_ID[dead],
       `🛑 ${dead} is gone from the tree — nobody can aim Db at a rung that does nothing`);
  }

  // 📌 And the family really is ABSENT without a tree — §6a's rule, which is
  // what made both holes invisible for so long.
  const blind = legalActions(rich(RONIN), RONIN, {}).filter(a => a.kind === 'skillTarget');
  eq(blind.length, 0, '⚠️ no `skillById`, no `skillTarget` family — absent rather than guessed, which is correct AND is how all three of these holes hid');

  // ⚠️ AND THE POOR ARE OFFERED THE SAME LIST AS THE RICH. `skillUnlock` gated
  // on `dbPoints >= dbCost`, which was part of the shop fiction; saving toward a
  // capstone you cannot yet afford IS the §3.2 decision, so hiding it from a
  // broke Spirit hid the interesting choice exactly when it was interesting.
  let broke = makeInitialState(structuredClone(CONFIG), 4242);
  broke = { ...broke, acting: MM };
  broke = { ...broke, noteStates: { ...broke.noteStates, [MM]: { ...broke.noteStates[MM], dbPoints: 0 } } };
  const toBroke = new Set(legalActions(broke, MM, { skillById: SKILL_BY_ID })
    .filter(a => a.kind === 'skillTarget').map(a => a.skillId));
  ok(toBroke.has('tentacle'), '⚠️ a Spirit with 0 Db may still AIM at a 10 Db unlock — that is what saving is');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. PRICES ARE REAL NUMBERS — the engine spends them.
// ═════════════════════════════════════════════════════════════════════════════
{
  for (const sk of allSkills()) {
    ok(sk.dbCost >= 0 && sk.dbCost < 100, `${sk.id}'s Db price is sane (${sk.dbCost})`);
  }
  eq(SKILL_BY_ID.tentacle.dbCost, 10, 'the Tentacle still costs what the design doc says');
  eq(SKILL_BY_ID.master_moshpits.dbCost, 8, 'Master of Moshpits still costs 8');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. ⛔ THERE IS NO SHARED LADDER LEFT, AND THAT IS A FINDING, NOT A RULE.
//
//    Both universal routes are deleted — the rig on 2026-08-20, Music Theory on
//    2026-09-02 — so what a Spirit may buy is now entirely a function of WHO THEY
//    ARE. 🎀 Glamarchy owns no route, so **she can buy nothing at all**, and every
//    Db she earns banks forever.
//
//    🎯 `PROGRESSION_REWRITE_DESIGN.md` §5 is the answer (per-ability upgrade
//    streams on the abilities characters already have) and §5 IS NOT BUILT. These
//    assertions are the alarm for that, pinned where somebody reading the tree
//    will trip over them. **When §5 lands they are EXPECTED TO FAIL**, and the fix
//    is to assert what each Spirit can buy — not to delete the block.
// ═════════════════════════════════════════════════════════════════════════════
{
  ok(SKILL_TREE.routes.every(r => r.spiritOnly),
     '⛔ every surviving route is exclusive — no shared ladder is left in the game');

  const routeOwners = new Set(SKILL_TREE.routes.map(r => r.spiritOnly));
  ok(!routeOwners.has('Glamarchy'),
     '⛔ 🎀 Glamarchy owns no route — §5 has not given her one yet');

  const offeredToGlam = allSkills().filter(sk =>
    skillEligibility(sk, [], { ownerRoute: sk.spiritOnly ?? null, selfId: 'Glamarchy' }).ok);
  eq(offeredToGlam.length, 0,
     '⛔ …so nothing in the tree is eligible for her at all — every Db she earns banks forever');
}

console.log(`✅ skillTreeCheck: ${count} assertions passed`);
