// ─── LEGAL ACTIONS CHECK ─────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/legalActionsCheck.mjs
//
// Coverage for BOT_STRATEGY_HANDOFF §6.1 — the branch generator.
//
// The contract under test is one-directional and unforgiving: an action emitted
// here MUST be one the client would accept. Over-permissiveness is the
// dangerous failure — the searcher plans a line, the game refuses it, the bot
// stalls mid-turn, and it surfaces as "the bot is bad" rather than "the bot is
// wrong". So most of this file is about what must NOT appear.
//
// The two rules worth stating up front, because they shape everything:
//   · `hasConfirmed` splits the turn. Composition spends STOCK, action spends
//     AP, and confirming is the conversion (§1's spine).
//   · `actionTokenUsed` is ONE token. A turn holds at most one Swing OR Sonic
//     OR Smash, ever.

import assert from "node:assert";
import { makeInitialState } from "./state.js";
import {
  legalActions, beamActions, actionKinds,
  swingCone, sonicBeam, facingOptions,
  SWING_AP_COST, SONIC_AP_COST, MOVE_AP_COST, MELODY_MAX, SONIC_BEAM_REACH,
} from "./policies/legalActions.js";
import {
  LIMELIGHT_HEX, STACK_COMMIT_BUDGET, stackCapFor,
} from "../data/gameConstants.js";
import { SPIRIT_DEFS } from "../data/spirits.js";
import { MODELLED_KINDS, UNMODELLED_KINDS } from "./policies/transition.js";
import { BOT_CLIENT_KINDS, BOT_CLIENT_GAPS } from "./policies/bot.js";
import { CORNERS } from "../data/corners.js";
import { HEX_BY_NUM, HEX_BY_QR } from "../board/hexMap.js";
import { axialNeighbors, angleTo } from "../board/hexGeometry.js";

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.equal(a, b, m); checks++; };

const RONIN = 'cosmic_ronin', ZERO = 'intergalactic_0', METAL = 'Metalness_Monster';

// ── Fixture ──────────────────────────────────────────────────────────────────
// The Ronin starts on an interior hex with room around him, so cone/beam/move
// geometry is never quietly clipped by the edge of the stage.

// ⚠️ NOT hex 56 — that is the Limelight, and starting there would leave §14's
// "no pose off the Limelight" case silently un-exercised. Fully surrounded by
// real hexes, so cone/beam/move geometry is never quietly clipped by the rim.
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

const baseState = () => {
  const st = makeInitialState(structuredClone(CONFIG), 909);
  return { ...st, acting: RONIN, turn: { ...st.turn, moveStepsLeft: 5, actionTokenUsed: false } };
};

const withNs = (st, id, patch) => ({
  ...st, noteStates: { ...st.noteStates, [id]: { ...st.noteStates[id], ...patch } },
});
const withSpirit = (st, id, patch) => ({
  ...st, spirits: st.spirits.map(s => s.id === id ? { ...s, ...patch } : s),
});
const withTurn = (st, patch) => ({ ...st, turn: { ...st.turn, ...patch } });

/** A confirmed turn — the action phase. */
const confirmed = (st) => withNs(st, RONIN, { hasConfirmed: true });

const kinds  = (acts) => new Set(acts.map(a => a.kind));
const ofKind = (acts, k) => acts.filter(a => a.kind === k);

/** Put `rivalId` on a neighbour of the Ronin and point him at it. */
const faceRivalAt = (st, rivalId, step = 0) => {
  const here = HEX_BY_NUM[START];
  const nbs = axialNeighbors(here.q, here.r).map(({ q, r }) => HEX_BY_QR[`${q},${r}`]).filter(Boolean);
  const nb = nbs[step % nbs.length];
  return withSpirit(withSpirit(st, rivalId, { num: nb.num }), RONIN, { facing: angleTo(here, nb) });
};

// ═════════════════════════════════════════════════════════════════════════════
// 1. WHO GETS ACTIONS AT ALL.
//    A non-acting Spirit has no AP, no token and no turn. Emitting hypothetical
//    actions for them would let a search invent replies the rules never offered.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = confirmed(baseState());
  ok(legalActions(st, RONIN).length > 0, 'the acting Spirit has actions');
  eq(legalActions(st, ZERO).length, 0, 'a Spirit who is not acting has none');
  eq(legalActions(withSpirit(st, RONIN, { knockedOut: true }), RONIN).length, 0, 'a knocked-out Spirit has none');
  eq(legalActions({ ...st, winner: ZERO }, RONIN).length, 0, 'the match is over — nobody acts');
  eq(legalActions(st, 'nobody').length, 0, 'an unknown id returns [], it does not throw');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. PURITY. The searcher calls this thousands of times over shared state.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = confirmed(baseState());
  const before = JSON.stringify(st);
  const a = legalActions(st, RONIN), b = legalActions(st, RONIN);
  eq(JSON.stringify(a), JSON.stringify(b), 'same state twice → identical action list, same order');
  eq(JSON.stringify(st), before, 'legalActions does not mutate the state it is handed');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. THE PHASE SPLIT — composition spends STOCK, action spends AP, and the two
//    action sets must not bleed into each other.
// ═════════════════════════════════════════════════════════════════════════════
{
  const comp = legalActions(baseState(), RONIN);
  const act  = legalActions(confirmed(baseState()), RONIN);

  ok(kinds(comp).has('melodyNote'),     'composition offers melody notes');
  ok(kinds(comp).has('stackCommit'),    'composition offers stack commits');
  ok(kinds(comp).has('confirmMelody') === false, 'an EMPTY track cannot be confirmed — nothing to commit');
  ok(!kinds(comp).has('move'),  'no walking before the melody has bought the AP');
  ok(!kinds(comp).has('swing'), 'no attacking before the melody is confirmed');

  ok(!kinds(act).has('melodyNote'),  'the melody is closed once confirmed');
  ok(!kinds(act).has('stackCommit'), 'the stacks are closed once confirmed');
  ok(kinds(act).has('move'),         'the action phase offers movement');
  ok(kinds(act).has('endTurn'),      'ending the turn is always on the table');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. §1's SPINE — confirming converts the melody into AP, capped by SPEED.
//    This is the single most consequential action in a turn, so the generator
//    surfaces the conversion instead of making the searcher re-derive it.
// ═════════════════════════════════════════════════════════════════════════════
{
  const speed = SPIRIT_DEFS[RONIN].speed;
  const short = withNs(baseState(), RONIN, { melodyLine: ['A', 'B'] });
  const long  = withNs(baseState(), RONIN, { melodyLine: Array(MELODY_MAX).fill('A') });

  eq(ofKind(legalActions(short, RONIN), 'confirmMelody')[0].apGranted, 2,
     'a 2-note melody buys 2 AP');
  eq(ofKind(legalActions(long, RONIN), 'confirmMelody')[0].apGranted, speed,
     `a maxed melody is capped by speed (${speed}), not by track length`);
  ok(MELODY_MAX > speed, 'the cap is real — you can write more melody than you can walk');

  eq(ofKind(legalActions(long, RONIN), 'melodyNote').length, 0,
     'a full track offers no more notes');
  ok(ofKind(legalActions(long, RONIN), 'stackCommit').length > 0,
     '...but the stacks are still open — a full track is not a finished turn');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. THE TWO STACK CEILINGS. Conflating them is the classic bug:
//    `stackCommitsThisTurn` is a per-TURN budget shared across BOTH stacks;
//    `stackCapFor()` is a per-STACK capacity that is FOUND ON THE BOARD, never a
//    flat 5 — and since 2026-09-02 the two stacks find their seats SEPARATELY.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = baseState();
  ok(ofKind(legalActions(st, RONIN), 'stackCommit').some(a => a.dest === 'drive'),   'drive is a destination');
  ok(ofKind(legalActions(st, RONIN), 'stackCommit').some(a => a.dest === 'sustain'), 'sustain is a destination');

  const spent = withNs(st, RONIN, { stackCommitsThisTurn: STACK_COMMIT_BUDGET });
  eq(ofKind(legalActions(spent, RONIN), 'stackCommit').length, 0,
     `the per-turn budget of ${STACK_COMMIT_BUDGET} closes BOTH stacks at once`);

  // Fill the drive stack to its found cap; sustain must stay open.
  const cap = stackCapFor(st.noteStates[RONIN] ?? {}, 'drive');
  const fullDrive = withNs(st, RONIN, { driveStack: Array(cap).fill('A') });
  const acts = ofKind(legalActions(fullDrive, RONIN), 'stackCommit');
  eq(acts.filter(a => a.dest === 'drive').length, 0, 'a full drive stack takes no more');
  ok(acts.filter(a => a.dest === 'sustain').length > 0, '...and that does not close sustain');

  // 🅰️ The cap is FOUND — the same stack length reads full or not depending on how
  // many seats that stack has opened on the board.
  const found = withNs(st, RONIN, {
    driveStack: Array(cap).fill('A'),
    driveSlots: 2,
  });
  ok(ofKind(legalActions(found, RONIN), 'stackCommit').some(a => a.dest === 'drive'),
     'finding seats re-opens a stack that was full — seats are what a Lost Chord buys now');

  // ⚠️ AND THE TWO STACKS ARE INDEPENDENT. A Drive seat found on the board must
  // not silently widen Sustain — one shared cap is the bug this replaced, and the
  // quiet version of it hands every Spirit three free seats they never found.
  const lopsided = withNs(st, RONIN, {
    driveSlots: 2, sustainSlots: 0,
    driveStack: Array(4).fill('A'), sustainStack: Array(3).fill('A'),
  });
  const lop = ofKind(legalActions(lopsided, RONIN), 'stackCommit');
  ok(lop.some(a => a.dest === 'drive'), 'Drive with two found seats still has room at 4 of 5');
  eq(lop.filter(a => a.dest === 'sustain').length, 0,
     '...while Sustain, which found none, is full at 3');

  // 🪦 THE MAJOR/MINOR PIVOT IS GONE (Alex, 2026-10-02 — each Spirit plays its
  // own scale). A stale `pivotPending` on an old save must freeze NOTHING.
  const pivot = withNs(st, RONIN, { pivotPending: true, melodyLine: ['A'] });
  ok(ofKind(legalActions(pivot, RONIN), 'melodyNote').length > 0,  '🪦 a stale pivotPending no longer freezes the melody');
  ok(kinds(legalActions(pivot, RONIN)).has('confirmMelody'), '...and you can still confirm what you have');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. SPENT NOTES ARE SPENT. A stock slot already used must never be offered
//    again, to either destination.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = withNs(baseState(), RONIN, { usedStockIdx: [0, 1, 2] });
  const acts = legalActions(st, RONIN);
  for (const a of [...ofKind(acts, 'melodyNote'), ...ofKind(acts, 'stackCommit')]) {
    ok(a.stockIdx > 2, `slot ${a.stockIdx} is unspent — spent slots are never re-offered`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. AP GATING. One pool buys walking AND violence (§1), so the thresholds have
//    to bite independently.
// ═════════════════════════════════════════════════════════════════════════════
{
  const armed = faceRivalAt(confirmed(baseState()), METAL);

  const broke = withTurn(armed, { moveStepsLeft: 0 });
  eq(ofKind(legalActions(broke, RONIN), 'move').length, 0,  '0 AP → nowhere to walk');
  eq(ofKind(legalActions(broke, RONIN), 'swing').length, 0, '0 AP → nothing to swing');
  ok(kinds(legalActions(broke, RONIN)).has('endTurn'), 'broke but never stuck — endTurn survives');

  const one = withTurn(armed, { moveStepsLeft: 1 });
  ok(ofKind(legalActions(one, RONIN), 'swing').length > 0, `1 AP affords the Swing (${SWING_AP_COST} AP)`);
  eq(ofKind(legalActions(one, RONIN), 'sonic').length, 0,  `1 AP cannot afford the Sonic (${SONIC_AP_COST} AP)`);
  ok(ofKind(legalActions(one, RONIN), 'move').length > 0,  `1 AP still walks (${MOVE_AP_COST} AP)`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. ONE TOKEN, ONE ATTACK. The rule that collapses the branching factor — and
//    the one an evaluator is most likely to search straight past.
// ═════════════════════════════════════════════════════════════════════════════
{
  const armed = faceRivalAt(confirmed(baseState()), METAL);
  ok(ofKind(legalActions(armed, RONIN), 'swing').length > 0, 'with the token in hand, the Swing is live');

  const spent = withTurn(armed, { actionTokenUsed: true });
  for (const k of ['swing', 'sonic', 'smash', 'blaster']) {
    eq(ofKind(legalActions(spent, RONIN), k).length, 0, `the token is spent — no ${k} this turn`);
  }
  ok(ofKind(legalActions(spent, RONIN), 'move').length > 0,
     '...but movement is NOT the token: you can still walk after attacking');
  // ⚠️ Facing survives the spent token ON PURPOSE. `isRearHit` reads facing on
  // DEFENCE — a blow in your rear wedge strips an extra Sustain note — so
  // turning to meet a threat is a real play after you have already attacked.
  ok(ofKind(legalActions(spent, RONIN), 'face').length > 0,
     'facing is not just aiming: it is rear-wedge defence, and it outlives the token');
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. GEOMETRY — the cone is not the beam, and neither is "anything adjacent".
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = confirmed(baseState());
  const self = st.spirits.find(s => s.id === RONIN);

  eq(swingCone({ ...self, num: 99999 }).size, 0, 'a Spirit off the map has no cone');
  ok(swingCone(self).size >= 1 && swingCone(self).size <= 3, 'the cone is the forward hex plus two diagonals');
  ok(sonicBeam(self).size <= SONIC_BEAM_REACH, `the beam reaches at most ${SONIC_BEAM_REACH}`);
  eq(facingOptions(self).length, 6, 'six neighbours, six facings');

  // A rival BEHIND is a rival you cannot hit without turning first.
  const here = HEX_BY_NUM[START];
  const nbs  = axialNeighbors(here.q, here.r).map(({ q, r }) => HEX_BY_QR[`${q},${r}`]).filter(Boolean);
  const front = nbs[0], back = nbs[3];
  const facingFront = withSpirit(st, RONIN, { facing: angleTo(here, front) });

  const behind = withSpirit(facingFront, METAL, { num: back.num });
  eq(ofKind(legalActions(behind, RONIN), 'swing').length, 0,
     'adjacent is not enough — a rival at your back is outside the cone');
  ok(ofKind(legalActions(behind, RONIN), 'face').length > 0,
     '...and turning to face them is exactly the AP the geometry is charging you');

  const ahead = withSpirit(facingFront, METAL, { num: front.num });
  eq(ofKind(legalActions(ahead, RONIN), 'swing').length, 1, 'in the cone, in reach — one Swing, one target');
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. THE SONIC IS OFFLINE OUT OF RIG RANGE (§3.1's worst square).
//     Stranded, the ranged attack is not merely weak — it is not available.
// ═════════════════════════════════════════════════════════════════════════════
{
  // Stand the Ronin in the beam-line of a rival, at home (in range) and away.
  const here = HEX_BY_NUM[CORNERS.blue.homeNum];
  const nbs  = axialNeighbors(here.q, here.r).map(({ q, r }) => HEX_BY_QR[`${q},${r}`]).filter(Boolean);
  const front = nbs[0];

  const atHome = withSpirit(
    withSpirit(confirmed(baseState()), RONIN, { num: CORNERS.blue.homeNum, facing: angleTo(here, front) }),
    METAL, { num: front.num });
  ok(ofKind(legalActions(atHome, RONIN), 'sonic').length > 0, 'inside the rig radius the Sonic is live');

  // Same geometry, transplanted to the far corner — out of the blue amp's reach.
  const farHome = HEX_BY_NUM[CORNERS.red.homeNum];
  const farNbs  = axialNeighbors(farHome.q, farHome.r).map(({ q, r }) => HEX_BY_QR[`${q},${r}`]).filter(Boolean);
  const farFront = farNbs[0];
  const stranded = withSpirit(
    withSpirit(confirmed(baseState()), RONIN, { num: CORNERS.red.homeNum, facing: angleTo(farHome, farFront) }),
    METAL, { num: farFront.num });

  eq(ofKind(legalActions(stranded, RONIN), 'sonic').length, 0, '📡 stranded outside the radius: no Sonic at all');
  ok(ofKind(legalActions(stranded, RONIN), 'swing').length > 0, '...melee still works out there — that is the trade');
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. 🪦 THE SMASH IS GONE (removed 2026-09-28, Alex: "it should no longer be
//     in the game"). Even with every old gate met — 2 AP, the token, unused
//     stock, a voiced Drive stack, a rival in the cone — it is never offered.
// ═════════════════════════════════════════════════════════════════════════════
{
  const armed = faceRivalAt(confirmed(baseState()), METAL);

  eq(ofKind(legalActions(withNs(armed, RONIN, { driveStack: ['A'] }), RONIN), 'smash').length, 0,
     '🪦 stock in hand, a voiced chord, a rival in reach — and still no Smash');
  eq(ofKind(legalActions(withNs(armed, RONIN, { driveStack: ['A'] }), RONIN), 'swing')[0].endsMovement, undefined,
     '...and the Swing is not — the difference is the whole decision');
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. 🌀 BLASTER OF RA REPLACES THE SMASH for Intergalactic 0 — different
//     geometry (the beam, piercing every rival in line) and a different fuel bar.
// ═════════════════════════════════════════════════════════════════════════════
{
  const here = HEX_BY_NUM[START];
  const nbs  = axialNeighbors(here.q, here.r).map(({ q, r }) => HEX_BY_QR[`${q},${r}`]).filter(Boolean);
  const front = nbs[0];

  let st = makeInitialState(structuredClone(CONFIG), 909);
  st = { ...st, acting: ZERO, turn: { ...st.turn, moveStepsLeft: 5, actionTokenUsed: false } };
  st = withSpirit(st, ZERO, { num: START, facing: angleTo(here, front) });
  st = withSpirit(st, METAL, { num: front.num });
  st = withNs(st, ZERO, { hasConfirmed: true, driveStack: ['A'] });

  // ⚠️ `unlockedSkills: []` IS EXPLICIT SINCE 2026-10-02. The default draft kit
  // already holds the Blaster; this case only ever saw "no Blaster" because Zero
  // started with 0 Db and `canFire` refused. With Db gone, the kit is the gate.
  const noBlaster = legalActions(withNs(st, ZERO, { unlockedSkills: [] }), ZERO);
  eq(ofKind(noBlaster, 'smash').length, 0, '🪦 without the unlock there is no Smash to fall back on — it is gone');
  eq(ofKind(noBlaster, 'blaster').length, 0, '...and has no Blaster');

  const armed = withNs(st, ZERO, { unlockedSkills: ['amp_1', 'blaster_of_ra'] });
  eq(ofKind(legalActions(armed, ZERO), 'smash').length, 0, '🌀 the Blaster REPLACES the Smash — never both');
  const blast = ofKind(legalActions(armed, ZERO), 'blaster')[0];
  ok(blast, '🌀 the Blaster is offered');
  ok(Array.isArray(blast.targetIds), '...and it pierces: it carries a target LIST, not one target');
  eq(blast.endsMovement, true, 'it ends all movement, not just 2 AP');

  // Its fuel bar is 2 unused notes — and it does NOT ask for a Drive stack.
  const oneNote = withNs(armed, ZERO, {
    usedStockIdx: (armed.noteStates[ZERO].noteStock ?? []).map((_, i) => i).slice(0, -1),
  });
  eq(ofKind(legalActions(oneNote, ZERO), 'blaster').length, 0, '🌀 one unused note is below the Blaster\'s bar of 2');
  ok(ofKind(legalActions(withNs(armed, ZERO, { driveStack: [] }), ZERO), 'blaster').length > 0,
     '🌀 ...but it needs no chord — that gate is the Smash\'s, not his');
}

// ═════════════════════════════════════════════════════════════════════════════
// 13. THE BOARD BLOCKS. Rivals, amp furniture and 👤 the decoy all occupy hexes;
//     the decoy has to block like a body or the pathing itself reveals the bluff.
// ═════════════════════════════════════════════════════════════════════════════
{
  const here = HEX_BY_NUM[START];
  const nbs  = axialNeighbors(here.q, here.r).map(({ q, r }) => HEX_BY_QR[`${q},${r}`]).filter(Boolean);
  const st   = confirmed(baseState());

  const open = ofKind(legalActions(st, RONIN), 'move').map(a => a.to);
  eq(open.length, nbs.length, 'an empty neighbourhood is fully walkable');

  const withRival = withSpirit(st, METAL, { num: nbs[0].num });
  ok(!ofKind(legalActions(withRival, RONIN), 'move').map(a => a.to).includes(nbs[0].num),
     'you cannot walk into a rival');
  ok(!ofKind(legalActions(st, RONIN, { amps: [{ hexNum: nbs[1].num }] }), 'move').map(a => a.to).includes(nbs[1].num),
     'amp furniture blocks a hex');
  ok(!ofKind(legalActions(st, RONIN, { shadowHex: nbs[2].num }), 'move').map(a => a.to).includes(nbs[2].num),
     '👤 the decoy blocks like a body — anything else would leak that it is fake');
}

// ═════════════════════════════════════════════════════════════════════════════
// 14. 🎤 THE POSE and 🤘 THE GOD FIGHT — two narrow gates that are easy to miss.
// ═════════════════════════════════════════════════════════════════════════════
{
  const off = confirmed(baseState());
  ok(!kinds(legalActions(off, RONIN)).has('pose'), 'no pose off the Limelight');

  const on = withSpirit(off, RONIN, { num: LIMELIGHT_HEX });
  ok(kinds(legalActions(on, RONIN)).has('pose'), '🎤 on the Limelight, the pose is on the table');
  // ✨ `posing` is ENGINE STATE since 2026-08-17 (§6.6.8) — it used to arrive
  // through `view`, which meant this generator's gate and the rule that paid the
  // pose read two different maps that only ever agreed by convention.
  const already = { ...on, limelight: { posing: { [RONIN]: true }, scores: {} } };
  ok(!kinds(legalActions(already, RONIN)).has('pose'),
     '...but a pose is a COMMITMENT already running, not a tap to re-tap');

  // 🪦 The five assertions that lived here checked `rockGodActive`, the view flag
  // that switched PvP off while the endgame boss held the stage. The boss was
  // archived on 2026-09-01 and the flag went with it — there is no longer any
  // state in which the attack family is suppressed wholesale, so there is nothing
  // left to assert. The per-attack gates (token spent, AP, range, facing) are
  // covered above and are the real rules.
}

// ═════════════════════════════════════════════════════════════════════════════
// 15. 🪦 SKILL TARGETING IS GONE (2026-10-02).
//
// This family was a shop first (`skillUnlock`, an invented mechanic §B2 is
// about), then a free pick of what a Db bar filled toward. Db was cut and the
// draft hands every seat its two abilities, so the generator offers it to nobody
// — with a tree in the view, rich or broke, with AP or without.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = withNs(confirmed(baseState()), RONIN, { unlockedSkills: ['psycho_bushido'] });
  const skillById = {
    psycho_bushido: { id: 'psycho_bushido', spiritOnly: RONIN },
    shadow_illusion: { id: 'shadow_illusion', spiritOnly: RONIN },
  };
  eq(ofKind(legalActions(st, RONIN), 'skillTarget').length, 0, '🪦 no tree → no skillTarget');
  eq(ofKind(legalActions(st, RONIN, { skillById }), 'skillTarget').length, 0, '🪦 a tree in the view → still none');
  eq(ofKind(legalActions(withTurn(st, { moveStepsLeft: 0 }), RONIN, { skillById }), 'skillTarget').length, 0,
     '🪦 …and none at 0 AP either');
}

// ═════════════════════════════════════════════════════════════════════════════
// 16. THE BEAM (§6.3) — bound the tree WITHOUT ever deleting an option class.
//     A global top-N is the trap: with twenty melody notes on offer the top 5
//     are all melody notes, and the bot silently loses the ability to attack.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = baseState();
  const all = legalActions(st, RONIN);
  ok(ofKind(all, 'melodyNote').length > 5, 'the fixture really does have a wide melody fan-out');

  const beamed = beamActions(all, { limit: 3 });
  eq(actionKinds(beamed).sort().join(','), actionKinds(all).sort().join(','),
     'every action KIND survives the beam');
  for (const k of actionKinds(beamed)) {
    ok(ofKind(beamed, k).length <= 3, `${k} is capped at the limit`);
  }
  ok(beamed.length < all.length, 'the beam actually narrows the tree');

  // Ranked beaming keeps the best, and ties keep SOURCE ORDER — a beam that
  // reordered under equal scores would break the determinism regression
  // intermittently, which is the worst way for it to break.
  const scored = beamActions(ofKind(all, 'melodyNote'), { limit: 2, score: (a) => a.stockIdx });
  eq(scored.length, 2, 'ranked beam respects the limit');
  ok(scored[0].stockIdx > scored[1].stockIdx, 'ranked beam keeps the highest scorers');

  const flat = beamActions(ofKind(all, 'melodyNote'), { limit: 3, score: () => 1 });
  eq(JSON.stringify(flat), JSON.stringify(ofKind(all, 'melodyNote').slice(0, 3)),
     'all-equal scores fall back to source order — deterministic, not sort-stability-dependent');

  eq(beamActions([]).length, 0, 'an empty list beams to empty');
  eq(beamActions(null).length, 0, 'a null list does not throw');
}

// ═════════════════════════════════════════════════════════════════════════════
// 17. NOTHING ILLEGAL, EVER — the global sweep. Whatever the state, every
//     emitted action must be affordable and internally coherent.
// ═════════════════════════════════════════════════════════════════════════════
{
  const states = [
    baseState(),
    confirmed(baseState()),
    faceRivalAt(confirmed(baseState()), METAL),
    withTurn(faceRivalAt(confirmed(baseState()), METAL), { moveStepsLeft: 2 }),
    withTurn(confirmed(baseState()), { moveStepsLeft: 0 }),
    withSpirit(confirmed(baseState()), RONIN, { num: LIMELIGHT_HEX }),
    withNs(baseState(), RONIN, { melodyLine: ['A', 'B', 'C'], stackCommitsThisTurn: 2 }),
  ];
  for (const st of states) {
    const ap = st.turn.moveStepsLeft ?? 0;
    for (const a of legalActions(st, RONIN, { skillById: null })) {
      ok(typeof a.kind === 'string' && a.kind.length > 0, 'every action names its kind');
      ok(Number.isFinite(a.apCost), `${a.kind} carries a finite apCost`);
      ok(a.apCost <= ap, `${a.kind} at ${a.apCost} AP is affordable out of ${ap}`);
      if (a.kind === 'swing' || a.kind === 'sonic' || a.kind === 'smash') {
        ok(typeof a.targetId === 'string', `${a.kind} names a single target`);
        ok(st.spirits.some(s => s.id === a.targetId && !s.knockedOut),
           `${a.kind} targets a LIVING rival on the board`);
      }
      if (a.kind === 'move') {
        ok(HEX_BY_NUM[a.to], 'move targets a real hex');
        ok(!st.spirits.some(s => !s.knockedOut && s.id !== RONIN && s.num === a.to),
           'move never walks into an occupied hex');
      }
    }
  }
}


// ═════════════════════════════════════════════════════════════════════════════
// 16. 🧠 EVERY MODELLED KIND HAS A CLIENT PATH — OR IS NAMED AS NOT HAVING ONE
//
// The searcher chooses actions in `policies/play.js`; the CLIENT executes them
// by translating each `kind` into the function a button would have called. That
// table lives in the .jsx and cannot be imported here, so its CONTENTS are
// mirrored in `bot.js` as `BOT_CLIENT_KINDS` / `BOT_CLIENT_GAPS`.
//
// ⚠️ WHAT THIS CANNOT TELL YOU: whether the translation is correct. It cannot
// see the switch. What it CAN do is fail the moment a new action kind appears in
// the rules with nobody having taught the client about it — which is §5.A's
// predictor written down as a test: the game rewards something, the bot has no
// path to it, and every suite stays green.
// ═════════════════════════════════════════════════════════════════════════════
{
  const covered = new Set([...BOT_CLIENT_KINDS, ...BOT_CLIENT_GAPS]);
  for (const kind of MODELLED_KINDS) {
    ok(covered.has(kind),
       `🧠 modelled kind '${kind}' is either driven by the client bot or named as a gap`);
  }
  for (const kind of UNMODELLED_KINDS) {
    ok(BOT_CLIENT_GAPS.has(kind),
       `🧠 unmodelled kind '${kind}' is named as a gap — the searcher can never choose it`);
  }
  // And the mirror must not rot in the other direction either: a kind listed as
  // driven that the rules no longer emit is a translation branch nobody can reach.
  for (const kind of BOT_CLIENT_KINDS) {
    ok(MODELLED_KINDS.has(kind),
       `🧠 client-driven kind '${kind}' is still a kind the rules actually emit`);
  }
  ok(![...BOT_CLIENT_KINDS].some(k => BOT_CLIENT_GAPS.has(k)),
     '🧠 no kind is both driven and a gap');
}

console.log(`✅ legalActionsCheck — ${checks} assertions passed`);
