// ─── ACTION SCORE CHECK ──────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/actionScoreCheck.mjs
//
// Coverage for BOT_STRATEGY_HANDOFF §6.3 — the `score` the beam shipped without.
//
// Two properties are worth more than everything else in this file, and both are
// about what the scorer is NOT allowed to be:
//
//   1. ⚠️ IT MUST AGREE WITH THE SHIPPED PLANNERS. §6.3 asks for the existing
//      planners wired in "so their tuning is preserved". The way that promise
//      fails is not with an exception — it is with a scorer that quietly ranks
//      slightly differently from the chooser it replaced, so the bot plays a
//      subtly different game and every number in §5 is measured against a
//      character nobody tuned. So the load-bearing assertions here all have the
//      same shape: THE TOP-SCORED ACTION OF A KIND IS THE ONE THE OLD CHOOSER
//      WOULD HAVE CHOSEN.
//
//   2. ⚠️ IT MUST NOT BECOME A VETO. A beam narrows; it never forbids. Scoring
//      something zero has to leave it legal, and a group of one must survive
//      whatever it scores — otherwise a preference has been smuggled into a
//      place tuning cannot see, which is the failure `legalActions`' header
//      exists to prevent, one file downstream.
//
// The 🐙 Tentacle case is the reason this file exists at all: it is the first
// kind whose branch count scales with the BOARD rather than with the roster.

import assert from "node:assert";
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import { slimeDropped, moveBudgetSet } from "./actions.js";
import { legalActions, beamActions, tentacleOptions } from "./policies/legalActions.js";
import {
  makeActionScorer, beamFor, resolvePersona, NEUTRAL_PERSONA, TENTACLE_RANK_STRIDE,
  STYLE_RANK_STRIDE, STYLE_GAIN_FLOOR,
} from "./policies/actionScore.js";
import { styleGain, styleProgress, detectSpiritStyle, gesturesFor } from "../music/spiritStyle.js";
import {
  BOT_PERSONALITIES, BOT_SPIRIT_SKILLS,
  botPlanNoteStep, botPlanStackCommit, botPickTarget, botPlanMove, botMoveCtx, botHexScore,
} from "./policies/bot.js";
import { stackCapFor } from "../data/gameConstants.js";
import { HEX_BY_NUM, HEX_BY_QR, ALL_HEXES } from "../board/hexMap.js";
import { axialDist, axialNeighbors, angleTo } from "../board/hexGeometry.js";

let count = 0;
const ok = (cond, msg) => { count++; assert.ok(cond, msg); };
const eq = (a, b, msg) => { count++; assert.deepStrictEqual(a, b, msg); };

const MM = 'Metalness_Monster';
const RONIN = 'cosmic_ronin';
const ZERO = 'intergalactic_0';

const base = makeInitialState({
  spirits: [
    { id: MM,    name: 'Metalness Monster', num: 1,  maxVibe: 5, vibe: 5, speed: 4, facing: 0 },
    { id: RONIN, name: 'Shredding Ronin',   num: 30, maxVibe: 5, vibe: 5, speed: 5, facing: 0 },
    { id: ZERO,  name: 'Intergalactic 0',   num: 44, maxVibe: 4, vibe: 4, speed: 4, facing: 0 },
  ],
  mode: 'ffa', startingLives: 3,
}, 12345);

const apply = (st, a) => applyAction(st, a);
const withNs = (st, id, patch) => ({
  ...st, noteStates: { ...st.noteStates, [id]: { ...st.noteStates[id], ...patch } },
});
const withSpirit = (st, id, patch) => ({
  ...st, spirits: st.spirits.map(s => s.id === id ? { ...s, ...patch } : s),
});
const ofKind = (acts, k) => acts.filter(a => a.kind === k);

/** The best-scoring action of a kind, ties broken the way `beamActions` breaks them. */
const top = (acts, k, score) => beamActions(ofKind(acts, k), { limit: 1, score })[0];

/** A real chain of adjacent hexes starting from `startNum` — same walker slimeCheck uses. */
function walk(startNum, n) {
  const path = [startNum];
  let cur = HEX_BY_NUM[startNum];
  const used = new Set([startNum]);
  while (path.length <= n) {
    const next = ALL_HEXES.find(h => !used.has(h.num) && axialDist(cur.q, cur.r, h.q, h.r) === 1);
    if (!next) break;
    path.push(next.num); used.add(next.num); cur = next;
  }
  return path;
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE CONTRACT — pure, total, and never a veto.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = { ...base, acting: MM };
  const score = makeActionScorer(st, MM, {});

  const acts = legalActions(st, MM, {});
  ok(acts.length > 0, 'the fixture has something to score');
  for (const a of acts) {
    const s = score(a);
    ok(typeof s === 'number' && Number.isFinite(s), `${a.kind} scores a finite number`);
  }

  // PURE — same action, same number, however many times you ask.
  const a0 = acts[0];
  eq(score(a0), score(a0), 'the same action scores the same number twice');
  eq(makeActionScorer(st, MM, {})(a0), score(a0), 'two scorers built from one state agree');

  // TOTAL — an unknown kind is scored, not thrown at. A new action kind landing
  // in `legalActions` must not take the beam down with it; it should simply be
  // unranked until somebody teaches this file about it.
  eq(score({ kind: 'something_nobody_has_written_yet' }), 0, 'an unknown kind is unranked, not fatal');
  eq(score(null), 0, 'a null action does not throw');
  eq(score({}), 0, 'a kindless action does not throw');

  // NOT A VETO — every kind that went in comes out.
  const beamed = beamFor(st, MM, acts, {}, { limit: 2 });
  const kindsIn  = [...new Set(acts.map(a => a.kind))].sort();
  const kindsOut = [...new Set(beamed.map(a => a.kind))].sort();
  eq(kindsOut, kindsIn, '⚠️ ranking narrows WITHIN kinds and never deletes one — a zero is not a ban');
  ok(beamed.every(a => acts.includes(a)), 'the beam returns input actions, never invented ones');

  // A seat that is not on the board degrades to flat — i.e. to source order,
  // which is exactly what the beam did before this file existed.
  const ghost = makeActionScorer(st, 'nobody_at_all', {});
  eq(ghost(acts[0]), 0, 'a scorer for an absent Spirit has no opinion rather than an error');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. 🎼 MELODY NOTES — the top-scored note is `botPlanNoteStep`'s note.
//    The combinatorial kind, and the one an unranked beam mangles worst.
// ═════════════════════════════════════════════════════════════════════════════
{
  for (const personaKey of ['maestro', 'moshlord', 'diva', 'saboteur']) {
    const persona = BOT_PERSONALITIES[personaKey];
    const st = { ...base, acting: RONIN };
    const acts = legalActions(st, RONIN, {});
    const notes = ofKind(acts, 'melodyNote');
    ok(notes.length > 1, `${personaKey}: there is more than one note to choose between`);

    const score = makeActionScorer(st, RONIN, { persona: personaKey });
    const plan  = botPlanNoteStep(st.noteStates[RONIN], persona);
    const best  = top(acts, 'melodyNote', score);

    eq(best.stockIdx, plan.slot,
       `⚠️ ${personaKey}: the beam's favourite note IS the planner's note — the tuning is preserved by CALLING it, not by re-deriving it`);

    // The persona key and the persona object are the same instruction.
    const byObject = makeActionScorer(st, RONIN, { persona });
    eq(top(acts, 'melodyNote', byObject).stockIdx, best.stockIdx,
       `${personaKey}: a persona key and a persona object resolve identically`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. ⚠️ UNRANKED IS LAST, NOT RESHUFFLED — the floor at zero.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = { ...base, acting: RONIN };
  const acts = legalActions(st, RONIN, {});
  const notes = ofKind(acts, 'melodyNote');
  const score = makeActionScorer(st, RONIN, { persona: 'maestro' });

  const ranked   = notes.filter(a => score(a) > 0);
  const unranked = notes.filter(a => score(a) === 0);
  ok(ranked.length > 0, 'the planner has an opinion about at least one note');
  for (const r of ranked) for (const u of unranked) {
    ok(score(r) > score(u), 'every ranked note outranks every unranked one');
  }

  // ⚠️ Unranked notes all score the SAME, so `beamActions`' index tie-break
  // leaves them in source order. A partial preference that half-sorted them
  // would make the beam depend on stock arrival order in a way nobody wrote
  // down — and it would only show up as a determinism failure much later.
  eq([...new Set(unranked.map(score))].length, unranked.length ? 1 : 0,
     '⚠️ the unranked all collapse to ONE value, so the tie-break is source order rather than an unwritten preference');

  const wide = beamActions(notes, { limit: notes.length, score });
  eq(beamActions(notes, { limit: notes.length, score }).map(a => a.stockIdx), wide.map(a => a.stockIdx),
     'ranking is stable across calls');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. 🎸 STACK COMMITS — the top-scored commit is `botPlanStackCommit`'s first.
// ═════════════════════════════════════════════════════════════════════════════
{
  const persona = BOT_PERSONALITIES.moshlord;
  const st = { ...base, acting: RONIN };
  const acts = legalActions(st, RONIN, {});
  const commits = ofKind(acts, 'stackCommit');
  ok(commits.length > 1, 'there is more than one commit on offer');

  const ns = st.noteStates[RONIN];
  const self = st.spirits.find(s => s.id === RONIN);
  const plan = botPlanStackCommit(ns, RONIN, persona, self.vibe, self.maxVibe,
    { drive: stackCapFor(ns, 'drive'), sustain: stackCapFor(ns, 'sustain') });
  ok(plan.length > 0, 'the planner wants to commit something');

  const score = makeActionScorer(st, RONIN, { persona: 'moshlord' });
  const best = top(acts, 'stackCommit', score);
  eq([best.dest, best.note], [plan[0].dest, plan[0].note],
     '⚠️ the beam keeps the planner\'s FIRST commit — same destination, same note');

  // The planner names a note, not a stock slot, so duplicate pitches tie. That
  // is correct rather than sloppy: they are the same commit as far as the stack
  // is concerned, and the tie-break puts them in source order.
  const twins = commits.filter(a => a.dest === best.dest && a.note === best.note);
  eq([...new Set(twins.map(score))].length, 1,
     'two stock slots holding one pitch score identically — the stack cannot tell them apart either');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. 🔪 ATTACK TARGETS — the top-scored swing hits `botPickTarget`'s rival.
// ═════════════════════════════════════════════════════════════════════════════
{
  // Put both rivals in the Monster's cone, one of them bleeding.
  const here = HEX_BY_NUM[base.spirits[0].num];
  const nbs = axialNeighbors(here.q, here.r).map(({ q, r }) => HEX_BY_QR[`${q},${r}`]).filter(Boolean);
  ok(nbs.length >= 2, 'the fixture hex has room for two rivals');

  let st = { ...base, acting: MM };
  st = withSpirit(st, RONIN, { num: nbs[0].num, vibe: 5 });
  st = withSpirit(st, ZERO,  { num: nbs[1].num, vibe: 1 });   // 🩸 nearly down
  st = withSpirit(st, MM,    { facing: angleTo(here, nbs[0]) });
  st = withNs(st, MM, { hasConfirmed: true });
  st = apply(st, moveBudgetSet(5, false));

  const acts = legalActions(st, MM, {});
  const swings = ofKind(acts, 'swing');
  ok(swings.length >= 1, 'at least one rival is in the cone');

  if (swings.length > 1) {
    const self = st.spirits.find(s => s.id === MM);
    const cands = st.spirits.filter(s => swings.some(a => a.targetId === s.id));
    const picked = botPickTarget(cands, st.noteStates, self.num);
    const score = makeActionScorer(st, MM, {});
    eq(top(acts, 'swing', score).targetId, picked.id,
       '⚠️ the beam swings at the rival `botPickTarget` would have swung at — one comparator, two consumers');
    ok(score({ kind: 'swing', targetId: ZERO }) > score({ kind: 'swing', targetId: RONIN }),
       'closing a knockdown outranks a healthy rival, which is `botPickTarget`\'s first rule');
  }

  // A rival who is not on the board at all is unranked rather than fatal.
  const score = makeActionScorer(st, MM, {});
  eq(score({ kind: 'swing', targetId: 'a_spirit_that_left' }), 0, 'an unknown target is unranked');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. 🐙 THE TENTACLE — WHO, then HOW MUCH ROAD. The reason this file exists.
// ═════════════════════════════════════════════════════════════════════════════
{
  const chain = walk(base.spirits[0].num, 4);
  let st = { ...base, acting: MM };
  for (let i = 0; i < chain.length - 1; i++) st = apply(st, slimeDropped(MM, chain[i], 9));
  st = withSpirit(st, MM, { num: chain[chain.length - 1] });
  st = apply(st, moveBudgetSet(5, false));
  st = withNs(st, MM, { hasConfirmed: true, unlockedSkills: ['tentacle'] });

  const self = st.spirits.find(s => s.id === MM);
  const opts = tentacleOptions(st, self);
  ok(opts.length >= 2, 'the road offers more than one origin');

  const score = makeActionScorer(st, MM, {});

  // ⚠️ SAME RIVAL, CHEAPER REACH WINS. The road reached THROUGH is consumed
  // (§4a), so the surviving trail is the Slam's fuel and the next Slide's floor.
  const near = { kind: 'tentacle', targetId: RONIN, reach: 1 };
  const far  = { kind: 'tentacle', targetId: RONIN, reach: opts.length };
  ok(score(near) > score(far),
     '⚠️ reaching further for the SAME rival scores worse — range is priced in road, and the road is three abilities\' currency');

  // ⚠️ …BUT WHO YOU HIT STRICTLY DOMINATES. A better target at the longest
  // possible reach still beats a worse one at point blank, which is what the
  // stride buys: reach is a tie-break, never a veto on a target.
  st = withSpirit(st, ZERO, { vibe: 1 });
  const score2 = makeActionScorer(st, MM, {});
  ok(score2({ kind: 'tentacle', targetId: ZERO, reach: 99 }) > score2({ kind: 'tentacle', targetId: RONIN, reach: 1 }),
     '⚠️ the wounded rival at maximum reach still outranks a healthy one at arm\'s length — reach separates equals, nothing more');
  ok(TENTACLE_RANK_STRIDE > 99,
     'the stride clears any trail the board can hold, so the dominance above is structural rather than lucky');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. 🐙 THE BLOCKER ITSELF — a long trail, a narrow beam, and the option that
//    an UNRANKED beam would have thrown away.
// ═════════════════════════════════════════════════════════════════════════════
{
  const chain = walk(base.spirits[0].num, 5);
  let st = { ...base, acting: MM };
  for (let i = 0; i < chain.length - 1; i++) st = apply(st, slimeDropped(MM, chain[i], 9));
  st = withSpirit(st, MM, { num: chain[chain.length - 1] });
  st = apply(st, moveBudgetSet(5, false));
  st = withNs(st, MM, { hasConfirmed: true, unlockedSkills: ['tentacle'] });

  const self = st.spirits.find(s => s.id === MM);
  const opts = tentacleOptions(st, self);

  // Park one rival in the FAR cone and one in the near cone, and wound the far
  // one — so the best play is the expensive reach and it sits late in the list.
  const farOpt  = opts[opts.length - 1];
  const nearOpt = opts[0];
  const farSpot  = [...farOpt.cone].find(n => n !== self.num);
  const nearSpot = [...nearOpt.cone].find(n => n !== self.num && n !== farSpot);

  if (farSpot != null && nearSpot != null) {
    st = withSpirit(st, ZERO,  { num: farSpot,  vibe: 1 });   // 🩸 the real target
    st = withSpirit(st, RONIN, { num: nearSpot, vibe: 5 });

    const acts = legalActions(st, MM, {});
    const tents = ofKind(acts, 'tentacle');
    ok(tents.length > 0, 'the arm has something to hit');

    const score = makeActionScorer(st, MM, {});
    const ranked = beamActions(tents, { limit: 1, score });
    eq(ranked[0].targetId, ZERO,
       '⚠️ THE POINT OF THIS WHOLE FILE: with one slot in the beam, the arm goes for the wounded rival');

    // And the thing that was actually broken: an unranked beam keeps whatever
    // came first. Assert the two disagree whenever the source order is unlucky,
    // because "the ranked beam is right" is only interesting if the unranked one
    // could have been wrong.
    const arbitrary = beamActions(tents, { limit: 1 });
    if (arbitrary[0].targetId !== ZERO) {
      ok(true, '⚠️ …and the UNRANKED beam kept a different, worse tentacle — §6.3\'s "just the first 5", demonstrated');
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. 🗺️ MOVEMENT — the top-scored step is `botPlanMove`'s step.
// ═════════════════════════════════════════════════════════════════════════════
{
  for (const personaKey of ['maestro', 'moshlord', 'diva', 'saboteur']) {
    const persona = BOT_PERSONALITIES[personaKey];
    let st = { ...base, acting: RONIN };
    st = withNs(st, RONIN, { hasConfirmed: true });
    st = apply(st, moveBudgetSet(5, false));

    const acts = legalActions(st, RONIN, {});
    const moves = ofKind(acts, 'move');
    ok(moves.length > 1, `${personaKey}: more than one step is legal`);

    const self = st.spirits.find(s => s.id === RONIN);
    const planned = botPlanMove(st, self, persona, []);
    const score = makeActionScorer(st, RONIN, { persona: personaKey });
    const best = top(acts, 'move', score);

    // ⚠️ `botPlanMove` returns null when HOLDING beats every step — that is a
    // decision the beam does not make, because holding is `endTurn` (a different
    // kind) and kinds are ranked separately. When it does name a hex, though,
    // the beam's favourite step must be that hex.
    if (planned != null) {
      eq(best.to, planned, `⚠️ ${personaKey}: the beam's favourite step IS the planner's step`);
    } else {
      const ctx = botMoveCtx(st, self, persona);
      ok(botHexScore(HEX_BY_NUM[best.to], ctx) <= botHexScore(HEX_BY_NUM[self.num], ctx) + 0.5,
         `${personaKey}: when the planner would hold, the beam's best step is one it judged not worth taking`);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. 🔪 FACING — the same scorer with the position held.
// ═════════════════════════════════════════════════════════════════════════════
{
  // An interior hex, so all six facings are legal and the wedge is never
  // quietly clipped by the rim.
  const here = ALL_HEXES.find(h =>
    axialNeighbors(h.q, h.r).every(({ q, r }) => HEX_BY_QR[`${q},${r}`]));
  ok(here, 'the board has a hex with all six neighbours');
  const nbs = axialNeighbors(here.q, here.r).map(({ q, r }) => HEX_BY_QR[`${q},${r}`]);

  let st = { ...base, acting: MM };
  st = withSpirit(st, MM,    { num: here.num, facing: 0 });
  st = withSpirit(st, RONIN, { num: nbs[0].num });
  st = withSpirit(st, ZERO,  { num: 44, knockedOut: true });   // one rival, one wedge
  st = withNs(st, MM, { hasConfirmed: true });
  st = apply(st, moveBudgetSet(5, false));

  const acts = legalActions(st, MM, {});
  const faces = ofKind(acts, 'face');
  ok(faces.length > 1, 'there is more than one direction to turn');

  const score = makeActionScorer(st, MM, {});
  const toward = angleTo(here, nbs[0]);
  const away   = angleTo(here, nbs[3]);
  ok(score({ kind: 'face', facing: toward }) > score({ kind: 'face', facing: away }),
     '⚠️ turning to meet the adjacent rival beats turning your back on it — `isRearHit` reads facing on DEFENCE, and `botHexScore` already priced that trade at the hex you are standing on');

  // ⚠️ TIES ARE EXPECTED HERE AND ARE NOT A BUG. `isRearHit` is a BOOLEAN wedge,
  // so every facing that neither meets a rival nor turns its back on one scores
  // identically. That is precisely why the beam's source-order tie-break matters:
  // a scorer with a genuinely flat opinion must not be allowed to reshuffle.
  const best = top(acts, 'face', score);
  const worst = [...faces].sort((a, b) => score(a) - score(b))[0];
  ok(score(best) >= score(worst), 'the best legal facing is at least as good as the worst');
  ok(score({ kind: 'face', facing: best.facing }) >= score({ kind: 'face', facing: away }),
     '⚠️ the beam never prefers a facing that hands a neighbouring rival your back — the rear wedge strips an extra Sustain note on DEFENCE');
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. 🎯 SKILL TARGETING — the exclusive route outranks the shared ladder.
//     (Renamed from `skillUnlock` 2026-08-16; the ranking is unchanged, because
//     `botPickSkillTarget`'s order was always a SAVING order.)
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = { ...base, acting: MM };
  const score = makeActionScorer(st, MM, { persona: 'moshlord' });

  const own = BOT_SPIRIT_SKILLS[MM] ?? [];
  ok(own.length > 0, 'the Monster has an exclusive route to prefer');
  ok(score({ kind: 'skillTarget', skillId: own[0] }) > score({ kind: 'skillTarget', skillId: 'amp_1' }),
     '⚠️ the Spirit\'s own route ranks above the generic ladder — `botPickSkillTarget`\'s order, not a new opinion');
  ok(score({ kind: 'skillTarget', skillId: own[0] }) > score({ kind: 'skillTarget', skillId: own[1] }),
     'and within the route, the earlier entry wins');
  eq(score({ kind: 'skillTarget', skillId: 'not_a_skill' }), 0, 'an unlisted skill is unranked');
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. ⚖️ THE NEUTRAL DEFAULT — no persona is not the Maestro.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(resolvePersona(null), NEUTRAL_PERSONA, 'nothing resolves to neutral');
  eq(resolvePersona('not_a_persona'), NEUTRAL_PERSONA, 'an unknown key resolves to neutral');
  eq(resolvePersona({ nonsense: true }), NEUTRAL_PERSONA, 'an object with no move weights is not a persona');
  eq(resolvePersona('maestro'), BOT_PERSONALITIES.maestro, 'a real key resolves to the real persona');

  // ⚠️ `note: null` is the load-bearing field: it keeps `botNoteStepOrder` out
  // of BOTH style branches, so the default has no cadence hunt and no tritone
  // appetite. A default that silently played the Maestro would be a character
  // choice disguised as a fallback.
  eq(NEUTRAL_PERSONA.note, null, 'the neutral persona has no note style');
  eq([...new Set(Object.values(NEUTRAL_PERSONA.move))], [1],
     'every neutral move weight is 1.0, so `botHexScore`\'s shipped magnitudes come through unchanged');

  const st = { ...base, acting: RONIN };
  const acts = legalActions(st, RONIN, {});
  const neutral = makeActionScorer(st, RONIN, {});
  const maestro = makeActionScorer(st, RONIN, { persona: 'maestro' });
  const nBest = top(acts, 'melodyNote', neutral);
  const mBest = top(acts, 'melodyNote', maestro);
  ok(nBest && mBest, 'both scorers rank the notes');
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. 🎲 DETERMINISM — the §6.6 regression's precondition.
// ═════════════════════════════════════════════════════════════════════════════
{
  const chain = walk(base.spirits[0].num, 5);
  let st = { ...base, acting: MM };
  for (let i = 0; i < chain.length - 1; i++) st = apply(st, slimeDropped(MM, chain[i], 9));
  st = withSpirit(st, MM, { num: chain[chain.length - 1] });
  st = apply(st, moveBudgetSet(5, false));
  st = withNs(st, MM, { hasConfirmed: true, unlockedSkills: ['tentacle', 'goes_to_11'] });

  const acts = legalActions(st, MM, {});
  const a = beamFor(st, MM, acts, { persona: 'moshlord' }, { limit: 3 });
  const b = beamFor(st, MM, acts, { persona: 'moshlord' }, { limit: 3 });
  eq(JSON.stringify(a), JSON.stringify(b),
     '⚠️ same state, same beam — a scorer that wandered would break the determinism regression INTERMITTENTLY, which is the worst way for it to break');

  // Singletons ride through untouched, whatever they score.
  const score = makeActionScorer(st, MM, {});
  for (const k of ['endTurn', 'slime', 'eleven', 'slide']) {
    const group = ofKind(acts, k);
    if (!group.length) continue;
    eq(score(group[0]), 0, `${k} is a singleton and scores the neutral constant`);
    eq(beamActions(group, { limit: 1, score }).length, 1,
       `⚠️ …and survives anyway — nothing is ever dropped from a group of one`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 🪦 THE RIFF LADDER'S SECTION LIVED HERE and retired with the mechanic on
//    2026-08-17. It pinned four properties that any future melody-SHAPE term
//    (per-Spirit style: a gallop, a tritone, a Spirit-appropriate cadence) will
//    want pinned again, so they are recorded rather than deleted:
//
//      · a noise floor — one matching interval must score ZERO, or with a large
//        pattern set the term fires on nearly every note and drowns out the
//        shipped planners;
//      · monotone progress — the score never falls as the track closes in;
//      · EVERY pattern reachable — a shape the ladder cannot climb is one the
//        bot can never aim at, and it fails silently;
//      · unreachable targets do not steer — `MELODY_MAX` is 8, and scoring an
//        unfinishable shape small does not help, because a small score still
//        steers.
//
//    The last one was the sharpest: it is the difference between a term that
//    plans and a term that merely leans. See git for the assertions.
// ═════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════
// 16. 🎭 THE STYLE LADDER — what steers a track toward this Spirit's own sound.
// ═════════════════════════════════════════════════════════════════════════════
//
// ⚠️ THE FIRST ASSERTION IS THE ONE THAT WOULD HAVE CAUGHT THE BUG THIS SHIPPED
// WITH. Every gesture climbs in THIRDS, and the floor was originally set at
// 0.34 — just above a third — so five of the six gestures were silently
// unreachable and the sixth looked like the only style anybody had. A ladder
// whose rungs are all below its own floor is not a weak ladder, it is no ladder,
// and nothing about it fails.
{
  ok(STYLE_GAIN_FLOOR < 1 / 3,
     '🎭 the floor admits a one-third gain — every gesture climbs in thirds');

  // Each Spirit's gestures must be REACHABLE: some note completes each one.
  for (const id of [MM, RONIN, ZERO]) {
    for (const g of gesturesFor(id)) {
      ok(g.notes <= 8, `🎭 ${id}/${g.id} fits inside MELODY_MAX`);
    }
    ok(gesturesFor(id).length > 0, `🎭 ${id} has a sound of their own`);
  }
  eq(gesturesFor('Glamarchy'), [],
     '🎭 a Spirit with no kit gets no gestures — never another character\'s');

  // ── The Ronin's run: C D E is two-thirds of it, and F finishes it.
  const track = ['C', 'D', 'E'];
  ok(styleProgress(RONIN, track, 5) > 0, '🎭 three stepwise notes is real progress');
  const good = styleGain(RONIN, track, 'F', 4);
  const bad  = styleGain(RONIN, track, 'A#', 4);
  ok(good > bad, '🎭 the note that continues the run gains more than one that breaks it');
  ok(good >= STYLE_GAIN_FLOOR, '🎭 …and it clears the floor, so it actually steers');
  eq(bad, 0, '🎭 a note that closes nothing gains exactly nothing');

  // ⚠️ A GESTURE THAT CANNOT FIT MUST NOT STEER. Scoring it small does not help:
  // a small score still steers. With no slots left it must drop out entirely.
  ok(styleGain(RONIN, track, 'F', 0) > 0,
     '🎭 the LAST slot still lands a shape that only needs one more note');
  eq(styleGain(RONIN, ['C'], 'D', 0), 0,
     '🎭 …but a shape needing two more notes with one slot left stops pulling entirely');

  // ── And the ladder actually reaches the beam: the completing note outranks
  //    every other candidate of its kind, whatever the planner thought.
  {
    let st = { ...base, acting: RONIN };
    st = withNs(st, RONIN, {
      melodyLine: ['C', 'D', 'E'],
      noteStock: ['A#', 'G#', 'F', 'B'],
      usedStockIdx: [],
    });
    const score = makeActionScorer(st, RONIN, {});
    const notes = legalActions(st, RONIN, {}).filter(a => a.kind === 'melodyNote');
    ok(notes.length >= 2, 'fixture: several notes are on offer');
    const best = notes.map(a => ({ a, s: score(a) })).sort((x, y) => y.s - x.s)[0];
    eq(best.a.note, 'F', '🎭 the beam ranks the note that lands the gesture first');
    const others = notes.filter(a => a.note !== 'F').map(a => score(a));
    ok(Math.max(...others) + STYLE_RANK_STRIDE <= best.s,
       '🎭 …by a full stride, so the planners tie-break rather than overrule');
  }

  // ── Style is per-Spirit, and that is the point: THE SAME TRACK reads
  //    differently from a different seat. This is the first term in the commit
  //    phase that distinguishes the roster at all.
  {
    const metalLine = ['C', 'F#', 'G'];
    ok(detectSpiritStyle(MM, metalLine).hits.length > 0, '🎭 the walked tritone is Metalness\'s');
    eq(detectSpiritStyle(RONIN, metalLine).hits.length, 0, '🎭 …and means nothing to the Ronin');
  }
}

console.log(`✅ actionScoreCheck: ${count} assertions passed`);
