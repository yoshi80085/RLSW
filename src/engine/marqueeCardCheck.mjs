// 🃏 test:cards — the marquee prize cards (MARQUEE_QUIZ_DESIGN.md §10).
// Pure card rules, the hand, the throw, the Swing and Sonic reducers, the
// turn-end disarm, the bot's choices and the headless marquee.
import assert from 'node:assert/strict';
import { makeInitialState } from './state.js';
import { makeRng } from './rng.js';
import { applyAction } from './reduce.js';
import { attackRolled, attackRerolled, marqueeCardWon, marqueeCardArmed, marqueeCardPlayed, turnEnded } from './actions.js';
import { attackParams } from './systems/attackParams.js';
import { throwPool, keepBest } from './systems/dicePool.js';
import {
  MARQUEE_CARDS, MARQUEE_CARD_IDS, drawMarqueeCard, applyCard, weakestDieIdx, cardedRig,
  wonCardPatch, armPatch, spendArmedPatch, armedCardId, handOf, botArmIdx, botReplaceIdx, bonusDieOf,
} from './systems/marqueeCards.js';
import { drawMarqueeQuestion, TRIVIA_QUESTIONS } from '../data/trivia.js';
import { MARQUEE_HAND_MAX, ELEVEN_DIE } from '../data/gameConstants.js';
import { HEX_BY_NUM } from '../board/hexMap.js';
import { neighborInDirection } from '../board/hexGeometry.js';
import { collectPickups } from './policies/transition.js';
import { eventHexTriggered, eventHexSpawned, marqueeKindSet } from './actions.js';
import { marqueeKindOf, rollMarqueeKind, lightPendingMarquees, pendingMarquees, plannedMarqueeHexes, pickMarquee, occupiedHexes } from './systems/marqueeSpaces.js';
import { botAnswers, communityOutcome, soloOutcome, communityParticipants, marqueeDrawCount, roundLimitMs } from './systems/marqueeRound.js';
import { MARQUEE_COMMUNITY_SHARE, MARQUEE_BOT_ANSWER_S, MARQUEE_SOLO_SECONDS, MARQUEE_COMMUNITY_SECONDS } from '../data/gameConstants.js';
import { TRIVIA_BOT_ODDS } from '../data/trivia.js';
import { cornersForCount, seatSpirit } from '../data/matchSetup.js';
import { SPIRIT_DEFS } from '../data/spirits.js';
import { CORNERS } from '../data/corners.js';
import {
  MARQUEE_CORNERS, MARQUEE_QUADRANT_POOLS, quadrantOf, marqueeCount, openQuadrants,
} from './systems/marqueeSpaces.js';
import { LIMELIGHT_HEX, MARQUEE_RELIGHT_MIN_DIST, CHARGE_ZONE_COUNT } from '../data/gameConstants.js';
import { axialDist } from '../board/hexGeometry.js';

let n = 0;
const ok = (msg, cond) => { assert.ok(cond, msg); n++; };
const eq = (msg, a, b) => { assert.deepEqual(a, b, msg); n++; };

// ── 1. The deck ──────────────────────────────────────────────────────────────
eq('six cards in the deck', MARQUEE_CARD_IDS.length, 6);
{
  const total = MARQUEE_CARD_IDS.reduce((s, id) => s + MARQUEE_CARDS[id].weight, 0);
  const seen = Object.fromEntries(MARQUEE_CARD_IDS.map(id => [id, 0]));
  const N = total * 1000;
  for (let i = 0; i < N; i++) seen[drawMarqueeCard((i + 0.5) / N)]++;
  for (const id of MARQUEE_CARD_IDS) eq(`draw weight: ${id}`, seen[id], MARQUEE_CARDS[id].weight * 1000);
  ok('a float of 0 draws a card', !!MARQUEE_CARDS[drawMarqueeCard(0)]);
  ok('a float of 1 does not fall off the end', !!MARQUEE_CARDS[drawMarqueeCard(1)]);
  ok('garbage reads as 0, not a crash', !!MARQUEE_CARDS[drawMarqueeCard(NaN)]);
}

// ── 2. What each card does to a throw ────────────────────────────────────────
eq('weakest die = the LAST of the smallest size', weakestDieIdx([8, 8, 6, 6]), 3);
eq('…never the Eleven die', weakestDieIdx([ELEVEN_DIE, 6, 6]), 2);
eq('…and an Eleven-only pool has none', weakestDieIdx([ELEVEN_DIE]), -1);
// ⭐ 2026-10-09: the card's die is a BONUS die — appended, one more seat, pinned (Alex's dial-in).
const PIN = (idx, face) => [{ idx, pin: true, bonus: true, ...(face != null ? { face } : {}) }];
eq('Loaded 6 adds a die SET on 6, pinned, in a seat of its own', applyCard([8, 6, 6], 2, 'loaded6'), { pool: [8, 6, 6, 6], keep: 3, fixed: PIN(3, 6), card: 'loaded6' });
eq('Loaded 4 adds a die set on 4', applyCard([6, 6, 6], 3, 'loaded4').fixed, PIN(3, 4));
eq('Bigger Cab: a bonus d8 on a d6 pool', applyCard([6, 6], 2, 'biggerCab'), { pool: [6, 6, 8], keep: 3, fixed: PIN(2), card: 'biggerCab' });
eq('Bigger Cab: an all-d8 pool gets a bonus d10', applyCard([8, 8], 2, 'biggerCab').pool, [8, 8, 10]);
eq('Bigger Cab: capped at a d12', applyCard([12], 1, 'biggerCab').pool, [12, 12]);
eq('Full Stack: a bonus d10', applyCard([8, 6, 6], 3, 'fullStack'), { pool: [8, 6, 6, 10], keep: 4, fixed: PIN(3), card: 'fullStack' });
eq('Full Stack on d10s and up still counts now (it was refused when it only bent a die)', applyCard([10, 12], 2, 'fullStack').card, 'fullStack');
eq('Encore: one more die counts', applyCard([6, 6, 6, 6], 3, 'encore').keep, 4);
eq('Encore may pass the usual keep cap of 5', applyCard([6, 6, 6, 6, 6, 6, 6, 6], 5, 'encore').keep, 6);
eq('Encore on a pool that keeps every die does nothing → not spent', applyCard([6, 6], 2, 'encore').card, null);
eq('no dice, no card', applyCard([], 0, 'loaded6').card, null);
eq('an unknown card does nothing', applyCard([6, 6], 2, 'pickles').card, null);
eq('the Eleven die is left alone (the bonus is added beside it)', applyCard([ELEVEN_DIE, 6], 2, 'fullStack').pool, [ELEVEN_DIE, 6, 10]);
eq('…and an Eleven-only pool sizes Bigger Cab off a d6', applyCard([ELEVEN_DIE], 1, 'biggerCab').pool, [ELEVEN_DIE, 8]);
eq('bonusDieOf finds the card die', bonusDieOf(applyCard([6, 6], 2, 'loaded5').fixed), PIN(2, 5)[0]);
eq('…and Encore has none', bonusDieOf(applyCard([6, 6, 6], 2, 'encore').fixed), null);

// ── 3. The bonus die in the throw ────────────────────────────────────────────
{
  eq('keepBest: a pinned die is kept whatever it shows', keepBest([6, 6, 6, 1], [6, 6, 6, 6], 3, [3]).keptIdx, [0, 1, 3]);
  eq('keepBest: no pins, the old rule', keepBest([6, 6, 6, 1], [6, 6, 6, 6], 3).keptIdx, [0, 1, 2]);
  const pool = [6, 6, 6, 6];
  const a = makeRng(7), b = makeRng(7);
  const plain = throwPool(pool, 2, a);
  const r = applyCard(pool, 2, 'loaded6'), set = throwPool(r.pool, r.keep, b, 0, r.fixed);
  eq('the set die shows its face', set.thrown[4], 6);
  eq('every die of your own lands as it would have', set.thrown.slice(0, 4), plain.thrown);
  eq('…and your own kept dice are the same ones', set.vals.slice(0, -1), plain.vals);
  { const e = makeRng(7); throwPool([...pool, 6], 3, e);   // five plain dice: five draws
    eq('⚠️ the set die still spends its rng draw (one per die in pool order)', b.int(1000), e.int(1000)); }
  // A replay recorded BEFORE the bonus die carries { idx, face } with no pin: it must throw exactly as it did.
  const c = makeRng(7), d = makeRng(7);
  const old = throwPool(pool, 2, c, 0, [{ idx: 3, face: 6 }]), oldRef = throwPool(pool, 2, d);
  eq('a pre-bonus replay entry still sets that die and nothing else', old.thrown, [...oldRef.thrown.slice(0, 3), 6]);
  // ⭐ Never nothing, never worse — the whole point (Alex: "the dice card doesn't make any effect").
  let always = true, exact = true, worst = Infinity;
  const sum = xs => xs.reduce((x, y) => x + y, 0);
  for (const [pl, k] of [[[6, 6, 6], 3], [[6, 6, 6, 6, 6], 3], [[6, 6, 6, 6, 6, 6], 4], [[8, 8, 6, 6, 6, 6, 6, 6], 5]]) {
    for (const id of ['loaded4', 'loaded5', 'loaded6', 'biggerCab', 'fullStack']) {
      for (let seed = 1; seed <= 400; seed++) {
        const card = applyCard(pl, k, id), t = throwPool(card.pool, card.keep, makeRng(seed), 0, card.fixed), base = throwPool(pl, k, makeRng(seed));
        const gain = sum(t.vals) - sum(base.vals), bonusFace = t.thrown[card.pool.length - 1];
        always &&= gain >= 1; exact &&= gain === bonusFace && t.keptIdx.includes(card.pool.length - 1); worst = Math.min(worst, gain);
      }
    }
  }
  ok(`⭐ every die card adds at least 1, over 10,000 throws (worst +${worst})`, always);
  ok('⭐ …and adds exactly its own die: your own kept dice never change', exact);
}

// ── 4. The hand ──────────────────────────────────────────────────────────────
{
  let ns = {};
  for (const id of ['loaded4', 'encore', 'biggerCab']) ns = { ...ns, ...wonCardPatch(ns, id) };
  eq('three cards fill the hand', handOf(ns), ['loaded4', 'encore', 'biggerCab']);
  eq('MARQUEE_HAND_MAX is 3', MARQUEE_HAND_MAX, 3);
  eq('a fourth with no swap is refused (let go)', wonCardPatch(ns, 'loaded6'), null);
  eq('a swap replaces in place', wonCardPatch(ns, 'loaded6', 0).marqueeCards, ['loaded6', 'encore', 'biggerCab']);
  ns = { ...ns, ...armPatch(ns, 1) };
  eq('arming names the card', armedCardId(ns), 'encore');
  eq('swapping out the ARMED card disarms it', wonCardPatch(ns, 'loaded6', 1).marqueeArmed, null);
  eq('arming a slot that does not exist is refused', armPatch(ns, 5), null);
  eq('spending removes the armed card and disarms', spendArmedPatch(ns), { marqueeCards: ['loaded4', 'biggerCab'], marqueeArmed: null });
  eq('an index past the hand reads as nothing armed', armedCardId({ marqueeCards: ['encore'], marqueeArmed: 3 }), null);
  eq('cardedRig carries the armed card', cardedRig({ pool: [6, 6, 6], keep: 2 }, ns).keep, 3);
  eq('…and nothing armed changes nothing', cardedRig({ pool: [6, 6, 6], keep: 2 }, {}).cardId, null);
}

// ── 5. Bots ──────────────────────────────────────────────────────────────────
{
  const ns = { marqueeCards: ['loaded4', 'encore', 'fullStack'] };
  eq('a bot arms its best card that does something', botArmIdx(ns, { pool: [6, 6, 6], keep: 2 }), 2);
  eq('…skipping one that would do nothing', botArmIdx({ marqueeCards: ['encore', 'loaded4'] }, { pool: [6, 6], keep: 2 }), 1);
  eq('…and arms nothing with no dice', botArmIdx(ns, { pool: [] }), null);
  eq('full hand: throws away its worst for a better card', botReplaceIdx(ns, 'loaded6'), 0);
  eq('…and lets a worse card go', botReplaceIdx({ marqueeCards: ['fullStack', 'loaded6', 'encore'] }, 'loaded4'), null);
  eq('…and never swaps with room in hand', botReplaceIdx({ marqueeCards: ['encore'] }, 'loaded6'), null);
}

// ── 6. The question draw ─────────────────────────────────────────────────────
{
  let used = [], seen = new Set();
  for (let i = 0; i < TRIVIA_QUESTIONS.length; i++) {
    const r = drawMarqueeQuestion((i * 0.618) % 1, used); used = r.used; seen.add(r.q.id);
  }
  eq('no repeats until the whole deck is seen', seen.size, TRIVIA_QUESTIONS.length);
  const again = drawMarqueeQuestion(0.3, used);
  eq('…then the deck recycles', again.used.length, 1);
  eq('pure: same float, same question', drawMarqueeQuestion(0.42, []).q.id, drawMarqueeQuestion(0.42, []).q.id);
}

// ── 7. The reducers: Swing and Sonic spend the armed card ────────────────────
const ids = ['cosmic_ronin', 'intergalactic_0'];
const A = HEX_BY_NUM[40], B = neighborInDirection(A, 0);
const config = { mode: 'ffa', startingLives: 3, elimination: 'off',
  spirits: ids.map((id, i) => ({ id, name: id, num: i ? B.num : A.num, facing: 0, vibe: 30, maxVibe: 30, cpu: false })) };
const withStacks = s => ({ ...s, acting: ids[0], noteStates: { ...s.noteStates,
  [ids[0]]: { ...s.noteStates[ids[0]], driveStack: ['C', 'E', 'G', 'B'] },
  [ids[1]]: { ...s.noteStates[ids[1]], driveStack: ['C', 'E', 'G'], sustainStack: ['C', 'E', 'G'] } } });
const base = withStacks(makeInitialState(config, 44));
eq('a fresh sheet holds no cards', handOf(base.noteStates[ids[0]]), []);
{
  let s = applyAction(base, marqueeCardWon(ids[0], 'fullStack'), makeRng(1));
  s = applyAction(s, marqueeCardWon(ids[0], 'loaded6'), makeRng(1));
  eq('MARQUEE_CARD_WON adds to the hand', handOf(s.noteStates[ids[0]]), ['fullStack', 'loaded6']);
  const armed = applyAction(s, marqueeCardArmed(ids[0], 0), makeRng(1));
  eq('MARQUEE_CARD_ARMED arms', armed.noteStates[ids[0]].marqueeArmed, 0);

  // Swing
  const plainSwing = applyAction(s, attackRolled('swing', ...ids, {}), makeRng(10)).battle;
  const swing = applyAction(armed, attackRolled('swing', ...ids, {}), makeRng(10));
  eq('Swing: the card is recorded on the battle', swing.battle.cardPlayed, 'fullStack');
  ok('Swing: a d10 is in the thrown pool', swing.battle.rolledPool.includes(10));
  ok('Swing: without the card, no d10', !plainSwing.rolledPool.includes(10));
  eq('Swing: the card leaves the hand', handOf(swing.noteStates[ids[0]]), ['loaded6']);
  eq('Swing: …and nothing is armed', swing.noteStates[ids[0]].marqueeArmed, null);
  eq('Swing: the defender\'s sheet is untouched', swing.noteStates[ids[1]], armed.noteStates[ids[1]]);
  const reSwing = applyAction(swing, attackRerolled(), makeRng(90)).battle;
  ok('Swing reroll: re-throws the carded pool', reSwing.rolledPool.includes(10));
  eq('Swing: no card armed → nothing spent', applyAction(s, attackRolled('swing', ...ids, {}), makeRng(10)).noteStates[ids[0]].marqueeCards, ['fullStack', 'loaded6']);

  // Sonic, through attackParams exactly as the client and the bot call it
  const loadedArm = applyAction(s, marqueeCardArmed(ids[0], 1), makeRng(1));
  const p = attackParams(loadedArm, ids[0], ids[1], 'sonic');
  ok('Sonic params carry the loaded face', p.atkFixed?.length === 1 && p.atkFixed[0].face === 6);
  eq('Sonic params carry the card', p.cardId, 'loaded6');
  const { _derived, ...opts } = p; void _derived;
  const sonic = applyAction(loadedArm, attackRolled('sonic', ...ids, opts), makeRng(20));
  eq('Sonic: the card is recorded', sonic.battle.cardPlayed, 'loaded6');
  ok('Sonic: a 6 was thrown', [...sonic.battle.diceVals, ...sonic.battle.droppedDiceVals].includes(6));
  eq('Sonic: the loaded face is stored for a reroll', sonic.battle.atkFixed, p.atkFixed);
  eq('Sonic: the card leaves the hand', handOf(sonic.noteStates[ids[0]]), ['fullStack']);
  eq('Sonic: the defender still gets their volley tally', sonic.noteStates[ids[1]].pendingSonicAttacks, 1);
  const reSonic = applyAction(sonic, attackRerolled(), makeRng(91)).battle;
  ok('Sonic reroll: the loaded 6 is still loaded', [...reSonic.diceVals, ...(reSonic.droppedDiceVals ?? [])].includes(6));
  eq('Sonic: seeded repeatability', applyAction(loadedArm, attackRolled('sonic', ...ids, opts), makeRng(20)), sonic);

  // Turn end disarms an unthrown card
  const ended = applyAction(armed, turnEnded(), makeRng(3));
  eq('turn end: an unthrown armed card goes back in the hand', ended.noteStates[ids[0]].marqueeArmed, null);
  eq('…and is not lost', handOf(ended.noteStates[ids[0]]), ['fullStack', 'loaded6']);
}

// ── 9. Playing a card AT THE ROLL (MARQUEE_CARD_PLAYED) ─────────────────────
// (A refused play leaves the game alone; `applyAction` still stamps the rng.)
const game = st => ({ battle: st.battle, noteStates: st.noteStates });
{
  let s = applyAction(base, marqueeCardWon(ids[0], 'encore'), makeRng(1));
  s = applyAction(s, marqueeCardWon(ids[0], 'fullStack'), makeRng(1));
  const swing = applyAction(s, attackRolled('swing', ...ids, {}), makeRng(10));
  eq('at the roll: nothing was armed, so nothing was spent yet', handOf(swing.noteStates[ids[0]]), ['encore', 'fullStack']);
  const played = applyAction(swing, marqueeCardPlayed(ids[0], 1), makeRng(77));
  eq('Swing at the roll: the card is recorded', played.battle.cardPlayed, 'fullStack');
  ok('Swing at the roll: the re-thrown pool has the d10', played.battle.rolledPool.includes(10));
  eq('Swing at the roll: the card leaves the hand', handOf(played.noteStates[ids[0]]), ['encore']);
  eq('Swing at the roll: the Rival\'s throw stands', played.battle.defenderDiceVals, swing.battle.defenderDiceVals);
  eq('Swing at the roll: totals are re-resolved', played.battle.atkTotal, played.battle.diceVals.reduce((a, b) => a + b, 0));
  eq('one card per battle', game(applyAction(played, marqueeCardPlayed(ids[0], 0), makeRng(78))), game(played));
  eq('only the attacker plays', game(applyAction(swing, marqueeCardPlayed(ids[1], 0), makeRng(78))), game(swing));
  eq('a hand index that is not there does nothing', game(applyAction(swing, marqueeCardPlayed(ids[0], 7), makeRng(78))), game(swing));
  eq('seeded repeatability', applyAction(swing, marqueeCardPlayed(ids[0], 1), makeRng(77)), played);
  const noBattle = { ...s, battle: null };
  eq('no battle, no play', game(applyAction(noBattle, marqueeCardPlayed(ids[0], 0), makeRng(1))), game(noBattle));

  const p = attackParams(s, ids[0], ids[1], 'sonic');
  const { _derived, ...opts } = p; void _derived;
  const sonic = applyAction(s, attackRolled('sonic', ...ids, opts), makeRng(20));
  const idleEncore = applyCard(sonic.battle.rolledPool, sonic.battle.atkKeep, 'encore').card;
  const sp = applyAction(sonic, marqueeCardPlayed(ids[0], 0), makeRng(55));
  if (idleEncore) {
    eq('Sonic at the roll: Encore keeps one more', sp.battle.atkKeep, sonic.battle.atkKeep + 1);
    eq('Sonic at the roll: the card is recorded', sp.battle.cardPlayed, 'encore');
  } else {
    eq('Sonic at the roll: an Encore that changes nothing is refused', game(sp), game(sonic));
  }
  const sp2 = applyAction(sonic, marqueeCardPlayed(ids[0], 1), makeRng(55));
  ok('Sonic at the roll: Full Stack re-throws with a d10', sp2.battle.rolledPool.includes(10));
  eq('Sonic at the roll: the shield stands', [sp2.battle.shieldValue, sp2.battle.sustainRolls], [sonic.battle.shieldValue, sonic.battle.sustainRolls]);
  ok('Sonic at the roll: the volley is re-resolved (shots match the kept dice)', sp2.battle.shots.length === sp2.battle.diceVals.length);
  eq('Sonic at the roll: the defender is not billed a second volley', sp2.noteStates[ids[1]].pendingSonicAttacks, 1);
  const enc = applyAction(swing, marqueeCardPlayed(ids[0], 0), makeRng(5));
  ok('Swing: Encore either keeps one more or is refused', enc.battle.cardPlayed ? enc.battle.atkKeep === swing.battle.atkKeep + 1 : handOf(enc.noteStates[ids[0]]).length === 2);
}

// ── 8. The headless marquee (the bot's path) ────────────────────────────────
{
  const hex = 30;
  const onBoard = { ...base, board: { ...base.board, eventHexes: [hex, ...(base.board.eventHexes ?? []).filter(h => h !== hex)] } };
  let won = 0, lost = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { state: out, logs } = collectPickups(onBoard, ids[0], hex, makeRng(seed));
    ok(`headless seed ${seed}: the marquee burns out`, !out.board.eventHexes.includes(hex));
    const h = handOf(out.noteStates[ids[0]]);
    if (logs.some(l => l.startsWith('🃏 correct'))) { won++; ok(`headless seed ${seed}: a correct answer puts a card in hand`, h.length === 1 && !!MARQUEE_CARDS[h[0]]); }
    else { lost++; eq(`headless seed ${seed}: a wrong answer wins nothing`, h, []); }
  }
  ok(`headless: both outcomes happen over 40 seeds (won ${won}, lost ${lost})`, won > 0 && lost > 0);
  const full = { ...onBoard, noteStates: { ...onBoard.noteStates, [ids[0]]: { ...onBoard.noteStates[ids[0]], marqueeCards: ['loaded4', 'loaded4', 'loaded4'] } } };
  let swapped = false;
  for (let seed = 1; seed <= 40 && !swapped; seed++) {
    const { state: out, logs } = collectPickups(full, ids[0], hex, makeRng(seed));
    const h = handOf(out.noteStates[ids[0]]);
    ok(`headless full hand seed ${seed}: never more than ${MARQUEE_HAND_MAX}`, h.length === MARQUEE_HAND_MAX);
    if (logs.some(l => l.startsWith('🃏 correct')) && h.some(c => c !== 'loaded4')) swapped = true;
  }
  ok('headless full hand: a bot swaps its worst card for a better one', swapped);
}

// ── 10. 🎪 Where the marquees stand (MARQUEE_QUIZ_DESIGN.md §11) ─────────────
{
  const all = MARQUEE_CORNERS.flatMap(c => MARQUEE_QUADRANT_POOLS[c]);
  eq('the four quadrant pools never share a hex', new Set(all).size, all.length);
  for (const c of MARQUEE_CORNERS) {
    ok(`${c}: its pool is its own quadrant`, MARQUEE_QUADRANT_POOLS[c].every(n => quadrantOf(n) === c));
    ok(`${c}: its home hex is in its quadrant, and never a marquee`, quadrantOf(CORNERS[c].homeNum) === c && !all.includes(CORNERS[c].homeNum));
  }
  ok('never the Limelight', !all.includes(LIMELIGHT_HEX));
  eq('🪦 charge spaces are retired: none are placed', CHARGE_ZONE_COUNT, 0);

  const DEFS = Object.keys(SPIRIT_DEFS);
  const table = (n, seed) => makeInitialState({ mode: 'ffa', startingLives: 3, elimination: 'off',
    spirits: cornersForCount(n).map((c, i) => ({ ...seatSpirit({ ...SPIRIT_DEFS[DEFS[i % DEFS.length]], id: `p${i}` }, c),
      name: `p${i}`, vibe: 30, maxVibe: 30 })) }, seed);
  const d = (a, b) => { const ha = HEX_BY_NUM[a], hb = HEX_BY_NUM[b]; return axialDist(ha.q, ha.r, hb.q, hb.r); };
  const oneEach = st => { const q = st.board.eventHexes.map(quadrantOf); return q.every(Boolean) && new Set(q).size === q.length; };

  for (const n of [2, 3, 4]) {
    const seated = cornersForCount(n);
    const seen = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      let st = table(n, seed);
      if (seed === 1) {
        eq(`${n} players: ${n} marquees`, st.board.eventHexes.length, n);
        eq(`${n} players: one in each seated quadrant`, st.board.eventHexes.map(quadrantOf).sort(), [...seated].sort());
        eq(`${n} players: no charge zones on the board`, st.board.chargeZones, []);
        eq(`${n} players: marqueeCount`, marqueeCount(st), n);
      }
      // Take marquees over and over, from a Spirit standing on it; the count and
      // the one-per-quadrant rule must hold every time.
      for (let step = 0; step < 12; step++) {
        const hex = st.board.eventHexes[(seed + step) % st.board.eventHexes.length];
        const from = quadrantOf(hex), open = new Set([...openQuadrants(st.board.eventHexes), from]);
        st = { ...st, spirits: st.spirits.map((s, i) => (i === 0 ? { ...s, num: hex } : s)) };
        st = applyAction(st, eventHexTriggered(st.spirits[0].id, hex, null), makeRng(seed * 100 + step));
        // ⏳ 2026-10-09: chosen at the take, NOT lit until the turn ends.
        const waiting = pendingMarquees(st.board);
        if (st.board.eventHexes.length !== n - 1 || waiting.length !== 1 || st.board.lastEventRespawn != null
          || st.board.eventHexes.includes(waiting[0].hexNum) || st.board.marqueeKinds[waiting[0].hexNum] !== undefined) {
          ok(`${n}p seed ${seed}: a taken marquee's replacement waits, unlit, for the turn end`, false); break; }
        if (plannedMarqueeHexes(st.board).length !== n) { ok(`${n}p: the waiting one still counts toward one per seat`, false); break; }
        st = lightPendingMarquees(st);
        const relit = st.board.lastEventRespawn;
        if (!(relit && relit.from === hex && relit.deferred && pendingMarquees(st.board).length === 0)) { ok(`${n}p seed ${seed}: it lights at the turn end`, false); break; }
        const q = quadrantOf(relit.hexNum);
        if (!open.has(q)) { ok(`${n}p seed ${seed}: relit in the emptied quadrant or an empty one (got ${q} from ${from})`, false); break; }
        if (d(relit.hexNum, hex) < MARQUEE_RELIGHT_MIN_DIST) { ok(`${n}p: relit at least ${MARQUEE_RELIGHT_MIN_DIST} away`, false); break; }
        if (st.spirits.some(s => s.num === relit.hexNum)) { ok(`${n}p: never under a Spirit`, false); break; }
        if (st.board.eventHexes.length !== n || !oneEach(st)) { ok(`${n}p: ${n} marquees, one per quadrant`, false); break; }
        if (n === 4 && q !== from) { ok('4 players: persistent in the same quadrant', false); break; }
        seen.add(q === from ? 'same' : 'empty');
      }
    }
    ok(`${n} players: 360 takes keep ${n} marquees, one per quadrant, relit ≥ ${MARQUEE_RELIGHT_MIN_DIST} away — each waiting unlit until the turn end`, true);
    if (n === 4) eq('4 players: always the same quadrant', [...seen], ['same']);
    else ok(`${n} players: both the same quadrant and the empty one get used (${[...seen]})`, seen.has('same') && seen.has('empty'));
  }

  // The fallback top-up fills a short board in an open quadrant.
  const st = table(3, 5);
  const short = { ...st, board: { ...st.board, eventHexes: st.board.eventHexes.slice(1) } };
  const filled = applyAction(short, eventHexSpawned([]), makeRng(3));
  eq('top-up: back to one per seat', filled.board.eventHexes.length, 3);
  ok('top-up: into a quadrant that had none', oneEach(filled));
  eq('top-up: a full board is left alone', applyAction(filled, eventHexSpawned([]), makeRng(3)).board.eventHexes, filled.board.eventHexes);

  // ⏳ 2026-10-09 — Alex: "New marquee spaces shouldn't appear again on the same turn if one was taken."
  {
    let s0 = table(3, 7);
    s0 = { ...s0, acting: s0.turnQueue[0] };
    const actor = s0.acting, hex = s0.board.eventHexes[0];
    s0 = { ...s0, spirits: s0.spirits.map(s => (s.id === actor ? { ...s, num: hex } : s)) };
    const taken = applyAction(s0, eventHexTriggered(actor, hex, null), makeRng(77));
    const [wait] = pendingMarquees(taken.board);
    ok('⏳ the take leaves the board one short for the rest of the turn', taken.board.eventHexes.length === 2 && !!wait);
    eq('⏳ …the round-end top-up does not fill the gap (the waiting one is counted)', applyAction(taken, eventHexSpawned([]), makeRng(5)).board.eventHexes, taken.board.eventHexes);
    const ended = applyAction(taken, turnEnded(), makeRng(1));
    ok('⏳ TURN_ENDED lights it, with its kind, and reports it as deferred', ended.board.eventHexes.includes(wait.hexNum)
      && ended.board.marqueeKinds[wait.hexNum] === wait.kind && ended.board.lastEventRespawn?.deferred === true && pendingMarquees(ended.board).length === 0);
    // the draws did not move: the SAME hex and kind as the old light-at-once rule drew
    // Re-draw by hand exactly what the old light-at-once reducer drew — quadrant + hex, then kind — off the same seed.
    const r = makeRng(77), left = s0.board.eventHexes.filter(n => n !== hex);
    const oldHex = pickMarquee(r, left, { occupied: occupiedHexes(s0), awayFrom: hex }), oldKind = rollMarqueeKind(r);
    ok('⏳ the replay stream is untouched: the same hex and kind the old rule drew, from the same three numbers',
      wait.hexNum === oldHex && wait.kind === oldKind && wait.from === hex);
    // someone standing on the chosen hex at the turn end: it waits another turn rather than lighting underfoot
    const blocked = { ...taken, spirits: taken.spirits.map(s => (s.id === actor ? { ...s, num: wait.hexNum } : s)) };
    const still = applyAction(blocked, turnEnded(), makeRng(1));
    ok('⏳ a Spirit standing on it at the turn end: it stays waiting, never lights underfoot', !still.board.eventHexes.includes(wait.hexNum) && pendingMarquees(still.board).length === 1);
    const moved = { ...still, spirits: still.spirits.map(s => (s.id === actor ? { ...s, num: hex } : s)) };
    ok('⏳ …and lights at the next turn end once the hex is clear', applyAction(moved, turnEnded(), makeRng(1)).board.eventHexes.includes(wait.hexNum));
    // two takes in one turn: both wait, in different quadrants
    const hex2 = taken.board.eventHexes[0];
    const two = applyAction({ ...taken, spirits: taken.spirits.map(s => (s.id === actor ? { ...s, num: hex2 } : s)) }, eventHexTriggered(actor, hex2, null), makeRng(78));
    const q2 = plannedMarqueeHexes(two.board).map(quadrantOf);
    ok('⏳ two takes in one turn: both wait, and lit + waiting stay one per quadrant', pendingMarquees(two.board).length === 2 && two.board.eventHexes.length === 1 && new Set(q2).size === 3);
  }
}

// ── 11. 🎤 Solo and community marquees (MARQUEE_QUIZ_DESIGN.md §13) ──────────
{
  eq('solo clock 10 s', roundLimitMs('solo'), MARQUEE_SOLO_SECONDS * 1000);
  eq('community clock 15 s', roundLimitMs('community'), MARQUEE_COMMUNITY_SECONDS * 1000);
  eq('community share is 1 in 3', MARQUEE_COMMUNITY_SHARE, 1 / 3);
  eq('rollMarqueeKind: under 1/3 is community', [rollMarqueeKind(() => 0.1), rollMarqueeKind(() => 0.5)], ['community', 'solo']);
  eq('an unrolled marquee reads solo', marqueeKindOf({}, 5), 'solo');

  // Kinds on the board: every opening marquee has one; over many tables ~1/3 community.
  const DEFS = Object.keys(SPIRIT_DEFS);
  const table = (n, seed) => makeInitialState({ mode: 'ffa', startingLives: 3, elimination: 'off',
    spirits: cornersForCount(n).map((c, i) => ({ ...seatSpirit({ ...SPIRIT_DEFS[DEFS[i % DEFS.length]], id: `p${i}` }, c),
      name: `p${i}`, vibe: 30, maxVibe: 30, cpu: true })) }, seed);
  let community = 0, total = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const st = table(4, seed);
    ok(`seed ${seed}: every opening marquee has a kind`, st.board.eventHexes.every(h => ['community', 'solo'].includes(st.board.marqueeKinds?.[h])));
    community += st.board.eventHexes.filter(h => st.board.marqueeKinds[h] === 'community').length; total += st.board.eventHexes.length;
  }
  ok(`opening kinds are ~1/3 community (${community}/${total})`, community / total > 0.26 && community / total < 0.41);
  // Relights roll a kind too; the taken hex's kind goes with it.
  let st = table(4, 9), relitCommunity = 0, relits = 0;
  for (let step = 0; step < 240; step++) {
    const hex = st.board.eventHexes[step % st.board.eventHexes.length];
    st = { ...st, spirits: st.spirits.map((s, i) => (i === 0 ? { ...s, num: hex } : s)) };
    st = lightPendingMarquees(applyAction(st, eventHexTriggered('p0', hex, null), makeRng(1000 + step)));
    const r = st.board.lastEventRespawn;
    if (!r) continue;
    relits++; if (st.board.marqueeKinds[r.hexNum] === 'community') relitCommunity++;
    if (st.board.marqueeKinds[hex] !== undefined && !st.board.eventHexes.includes(hex)) { ok('a taken marquee\'s kind is cleared', false); break; }
    if (Object.keys(st.board.marqueeKinds).length !== st.board.eventHexes.length) { ok('one kind per lit marquee', false); break; }
  }
  ok(`relit kinds are ~1/3 community too (${relitCommunity}/${relits})`, relitCommunity / relits > 0.24 && relitCommunity / relits < 0.43);
  const hx = st.board.eventHexes[0];
  eq('MARQUEE_KIND_SET flips a lit marquee', marqueeKindOf(applyAction(st, marqueeKindSet(hx, 'community'), makeRng(1)).board, hx), 'community');
  eq('…and ignores an unlit hex', applyAction(st, marqueeKindSet(999, 'community'), makeRng(1)).board.marqueeKinds, st.board.marqueeKinds);

  // The pure round rules.
  const P = [{ id: 'a', bot: false }, { id: 'b', bot: true }, { id: 'c', bot: true }];
  eq('draws: solo 3', marqueeDrawCount('solo', 2), 3);
  eq('draws: community 3 + 2 per bot', marqueeDrawCount('community', 2), 7);
  const [lo, hi] = MARQUEE_BOT_ANSWER_S;
  const bots = botAnswers(P, [0.1, 0, 0.99, 1], 'easy');
  eq('bots answer in participant order', bots.map(b => b.id), ['b', 'c']);
  eq('a bot is right under its odds, wrong over', bots.map(b => b.correct), [0.1 < TRIVIA_BOT_ODDS.easy, false]);
  eq('bots click inside the window', bots.map(b => b.atMs), [lo * 1000, hi * 1000]);
  eq('participants: the lander first, the knocked-out left out',
    communityParticipants([{ id: 'x' }, { id: 'y', cpu: true }, { id: 'z', knockedOut: true }, { id: 'w' }], 'w').map(p => [p.id, p.bot]),
    [['w', false], ['x', false], ['y', true]]);
  const first = communityOutcome([{ id: 'a', correct: false, atMs: 1000 }, { id: 'b', correct: true, atMs: 2000 }, { id: 'c', correct: true, atMs: 1500 }]);
  eq('the FIRST right answer wins; the wrong one before it is locked out', [first.winnerId, first.lockedOut], ['c', ['a']]);
  eq('a player only gets one try', communityOutcome([{ id: 'a', correct: false, atMs: 100 }, { id: 'a', correct: true, atMs: 200 }], { participants: [{ id: 'a' }] }).winnerId, null);
  eq('a right answer after 15 s does not count', communityOutcome([{ id: 'a', correct: true, atMs: 15001 }]).winnerId, null);
  eq('ties go to the one listed first', communityOutcome([{ id: 'a', correct: true, atMs: 500 }, { id: 'b', correct: true, atMs: 500 }]).winnerId, 'a');
  const mid = communityOutcome([{ id: 'b', correct: true, atMs: 9000 }], { nowMs: 4000, participants: P });
  ok('a bot answer in the future has not landed yet', mid.winnerId === null && !mid.settled);
  ok('everyone out → settled early, nobody wins', communityOutcome(P.map((p, i) => ({ id: p.id, correct: false, atMs: 100 * i })), { nowMs: 400, participants: P }).settled);
  ok('time up → settled', communityOutcome([], { nowMs: 15000 }).settled);
  eq('solo: right in time wins', soloOutcome({ correct: true, atMs: 9999 }), { won: true, timedOut: false });
  eq('solo: right but late is wrong', soloOutcome({ correct: true, atMs: 10001 }), { won: false, timedOut: true });
  eq('solo: no click is a timeout', soloOutcome({}), { won: false, timedOut: true });

  // Headless community: bots race; the winner may not be the lander.
  let otherWins = 0, landerWins = 0, nobody = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const s0 = table(4, 3);
    const hex = s0.board.eventHexes[0];
    const on = applyAction({ ...s0, spirits: s0.spirits.map((s, i) => (i === 0 ? { ...s, num: hex } : s)) }, marqueeKindSet(hex, 'community'), makeRng(1));
    const { state: out, logs } = collectPickups(on, 'p0', hex, makeRng(seed));
    const holders = out.spirits.filter(s => handOf(out.noteStates[s.id]).length).map(s => s.id);
    if (holders.length > 1) { ok('headless community: at most one winner', false); break; }
    if (!holders.length) nobody++; else if (holders[0] === 'p0') landerWins++; else otherWins++;
    ok(`headless community seed ${seed}: logged as community`, logs.some(l => l.includes('community marquee')));
  }
  ok(`headless community: sometimes a rival answers first (${otherWins}), sometimes the lander (${landerWins})`, otherWins > 0 && landerWins > 0);
  ok(`headless community: sometimes nobody (${nobody})`, nobody >= 0);
}

console.log(`🃏 test:cards — ${n} marquee card checks passed.`);
