// 🃏 test:cards — the marquee prize cards (MARQUEE_QUIZ_DESIGN.md §10).
// Pure card rules, the hand, the throw, the Swing and Sonic reducers, the
// turn-end disarm, the bot's choices and the headless marquee.
import assert from 'node:assert/strict';
import { makeInitialState } from './state.js';
import { makeRng } from './rng.js';
import { applyAction } from './reduce.js';
import { attackRolled, attackRerolled, marqueeCardWon, marqueeCardArmed, marqueeCardPlayed, turnEnded } from './actions.js';
import { attackParams } from './systems/attackParams.js';
import { throwPool } from './systems/dicePool.js';
import {
  MARQUEE_CARDS, MARQUEE_CARD_IDS, drawMarqueeCard, applyCard, weakestDieIdx, cardedRig,
  wonCardPatch, armPatch, spendArmedPatch, armedCardId, handOf, botArmIdx, botReplaceIdx,
} from './systems/marqueeCards.js';
import { drawMarqueeQuestion, TRIVIA_QUESTIONS } from '../data/trivia.js';
import { MARQUEE_HAND_MAX, ELEVEN_DIE } from '../data/gameConstants.js';
import { HEX_BY_NUM } from '../board/hexMap.js';
import { neighborInDirection } from '../board/hexGeometry.js';
import { collectPickups } from './policies/transition.js';
import { eventHexTriggered, eventHexSpawned } from './actions.js';
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
eq('Loaded 6 loads the tail d6', applyCard([8, 6, 6], 2, 'loaded6').fixed, [{ idx: 2, face: 6 }]);
eq('Loaded 4 keeps the pool and keep', (({ pool, keep }) => ({ pool, keep }))(applyCard([6, 6, 6], 3, 'loaded4')), { pool: [6, 6, 6], keep: 3 });
eq('Bigger Cab: d6 → d8', applyCard([6, 6], 2, 'biggerCab').pool, [6, 8]);
eq('Bigger Cab: an all-d8 pool grows a d10', applyCard([8, 8], 2, 'biggerCab').pool, [8, 10]);
eq('Full Stack: the weakest die becomes a d10', applyCard([8, 6, 6], 3, 'fullStack').pool, [8, 6, 10]);
eq('Encore: one more die counts', applyCard([6, 6, 6, 6], 3, 'encore').keep, 4);
eq('Encore may pass the usual keep cap of 5', applyCard([6, 6, 6, 6, 6, 6, 6, 6], 5, 'encore').keep, 6);
eq('Encore on a pool that keeps every die does nothing → not spent', applyCard([6, 6], 2, 'encore').card, null);
eq('no dice, no card', applyCard([], 0, 'loaded6').card, null);
eq('Full Stack on a d10 or bigger does nothing', applyCard([10, 12], 2, 'fullStack').card, null);
eq('an unknown card does nothing', applyCard([6, 6], 2, 'pickles').card, null);
eq('the Eleven die is left alone', applyCard([ELEVEN_DIE, 6], 2, 'fullStack').pool, [ELEVEN_DIE, 10]);

// ── 3. The loaded die in the throw ───────────────────────────────────────────
{
  const pool = [6, 6, 6, 6];
  const a = makeRng(7), b = makeRng(7);
  const plain = throwPool(pool, 2, a);
  const loaded = throwPool(pool, 2, b, 0, [{ idx: 3, face: 6 }]);
  eq('the loaded die lands on its face', loaded.thrown[3], 6);
  eq('every other die lands as it would have', loaded.thrown.slice(0, 3), plain.thrown.slice(0, 3));
  eq('⚠️ the loaded die still spends its rng draw — the stream does not shift', a.int(1000), b.int(1000));
  ok('a loaded 6 is kept by keep-the-best', loaded.vals.includes(6));
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
        const relit = st.board.lastEventRespawn;
        if (!(relit && relit.from === hex)) { ok(`${n}p seed ${seed}: a taken marquee relights at once`, false); break; }
        const q = quadrantOf(relit.hexNum);
        if (!open.has(q)) { ok(`${n}p seed ${seed}: relit in the emptied quadrant or an empty one (got ${q} from ${from})`, false); break; }
        if (d(relit.hexNum, hex) < MARQUEE_RELIGHT_MIN_DIST) { ok(`${n}p: relit at least ${MARQUEE_RELIGHT_MIN_DIST} away`, false); break; }
        if (st.spirits.some(s => s.num === relit.hexNum)) { ok(`${n}p: never under a Spirit`, false); break; }
        if (st.board.eventHexes.length !== n || !oneEach(st)) { ok(`${n}p: ${n} marquees, one per quadrant`, false); break; }
        if (n === 4 && q !== from) { ok('4 players: persistent in the same quadrant', false); break; }
        seen.add(q === from ? 'same' : 'empty');
      }
    }
    ok(`${n} players: 360 takes keep ${n} marquees, one per quadrant, relit ≥ ${MARQUEE_RELIGHT_MIN_DIST} away`, true);
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
}

console.log(`🃏 test:cards — ${n} marquee card checks passed.`);
