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
  ok(SKILL_TREE.routes.length >= 4, 'the tree has its routes');
  ok(allSkills().length >= 20, `the flat lookup found them all (${allSkills().length})`);

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
  eq(gate(SKILL_BY_ID.amp_2, RONIN, ['amp_1']), true, 'shared rungs stay shared');
  eq(gate(SKILL_BY_ID.amp_2, MM, ['amp_1']), true, '…for everyone');
  eq(gate(SKILL_BY_ID.amp_2, RONIN, []).valueOf(), false,
     '…and an unmet prereq still blocks it, which is a DIFFERENT refusal from ownership');
  eq(skillEligibility(SKILL_BY_ID.amp_2, [], { ownerRoute: null, selfId: RONIN }).reason, 'prereq',
     'the rule names which of the two refused');
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
  ok(toRonin.has('amp_2') && toMonster.has('amp_2'), 'shared rungs are offered to both');
  ok(toRonin.has('psycho_bushido'), 'and each Spirit IS offered their own exclusive route');
  ok(toMonster.has('goes_to_11') && toMonster.has('master_moshpits'),
     '…including the Monster\'s whole rework, which is the point of the extraction');
  ok(!toMonster.has('psycho_bushido'), 'the Monster is not offered the Ronin\'s route either — the gate cuts both ways');

  // 📌 `amp_1` is offered to NOBODY, and that is right rather than a gap: every
  // Spirit starts wired in, so it is already in `unlockedSkills` and
  // `skillEligibility` returns `already`. Worth pinning, because "shared rung
  // missing from the list" is otherwise indistinguishable from a broken gate.
  ok(!toRonin.has('amp_1') && !toMonster.has('amp_1'),
     'amp_1 is offered to nobody — everyone already owns it, which is not the same as being blocked');

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

console.log(`✅ skillTreeCheck: ${count} assertions passed`);
