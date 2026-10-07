// ─── ENTRANCE CHECK — the opening act's rules (`systems/entrance.js`) ────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/entranceCheck.mjs
//
// Alex's rule (2026-10-04, placed 2026-10-06): every Spirit waits OFF the board,
// fanless, on the spot between its home hex and its grandstand; it steps onto
// its home hex at the start of its own first turn and gains exactly two fans.
// Its home hex is reserved until then. The point: a player who has built Drive
// and Sustain cannot attack a Spirit that has not started.
//
// ⚠️ §5 IS THE ONE THAT MATTERS. Everything above it pins a mechanism; §5 plays
// whole bot matches at 2/3/4 seats and checks, after every turn, that nothing
// in the game — any attack, shove, hazard, hop or client bridge the bots can
// reach — touched a Spirit before its entrance or put a body on a reserved hex.

import assert from 'node:assert/strict';
import { makeInitialState } from './state.js';
import { applyAction } from './reduce.js';
import { turnStarted, moveStep, spiritWarped, spiritPatched, shukuchiHopped } from './actions.js';
import { legalActions } from './policies/legalActions.js';
import { runMatch, playTurn, startSpiritTurn, harnessHooks, matchConfig, POLICIES } from './policies/play.js';
import { makeRng } from './rng.js';
import { knockback, runBattleFlow } from './systems/battleFlow.js';
import { bushidoBlockers } from './systems/bushido.js';
import { ENTRANCE_FANS, entranceHexes, isWaiting, openingActOn } from './systems/entrance.js';
import { HEX_BY_NUM, HEX_BY_QR } from '../board/hexMap.js';
import { axialNeighbors, straightNeighborInDirection, angleTo } from '../board/hexGeometry.js';
import { SPIRIT_DEFS, PLAYABLE_ORDER } from '../data/spirits.js';
import { cornersForCount, seatSpirit } from '../data/matchSetup.js';
import { seatId } from '../data/spiritIdentity.js';
import { SKILL_BY_ID } from '../data/skillTree.js';
import { FAN_DIEHARD_START } from '../data/gameConstants.js';
import * as act from '../board/openingAct.js';
import * as preview from '../../previews/bardbarian-intro/timeline.js';
import alexDialIn from '../../previews/bardbarian-intro/alex-dial-in.json' with { type: 'json' };
import { CORNERS } from '../data/corners.js';

let n = 0;
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };
const ok = (a, msg) => { assert.ok(a, msg); n++; };

/** Seats exactly as the lobby builds them: seat ids, corners, CPU flags. A
 *  4-seat table repeats the roster (the preview's duplicate Ronin) under a
 *  unique corner seat id — Glamarchy stays locked. */
function table(count) {
  return cornersForCount(count).map((corner, i) => {
    const def = SPIRIT_DEFS[PLAYABLE_ORDER[i % PLAYABLE_ORDER.length]];
    return { ...seatSpirit(def, corner, { cpu: true }), id: seatId(def.id, corner), characterId: def.id };
  });
}
const cfg = (count, extra = {}) => ({ spirits: table(count), mode: 'ffa', startingLives: 3, openingAct: true, ...extra });
const sp = (st, id) => st.spirits.find(s => s.id === id);
const home = s => s.entrance?.homeNum ?? s.num;
/** Drop a Spirit on a hex (fixture surgery, not a game action). */
const place = (st, id, num, facing) => ({ ...st,
  spirits: st.spirits.map(s => s.id === id ? { ...s, num, ...(facing != null ? { facing } : {}) } : s) });
/** Skip the melody: confirmed, `steps` to spend, the token unused. */
const actionPhase = (st, id, steps = 6) => ({ ...st,
  noteStates: { ...st.noteStates, [id]: { ...st.noteStates[id], hasConfirmed: true } },
  turn: { ...st.turn, moveStepsLeft: steps, actionTokenUsed: false } });
/** Every string anywhere inside an action — a target id can hide in any field. */
const mentions = (a, id) => JSON.stringify(a).includes(JSON.stringify(id));

// ═════════════════════════════════════════════════════════════════════════════
// 1. OPT-IN. Without the flag — and in Testing Grounds even with it — the
//    match starts exactly as it always has.
// ═════════════════════════════════════════════════════════════════════════════
{
  const plain = makeInitialState({ ...cfg(4), openingAct: undefined }, 99);
  ok(plain.spirits.every(s => s.num != null && !s.entrance), 'no flag: every Spirit starts on its home hex');
  ok(plain.spirits.every(s => plain.noteStates[s.id].diehards === FAN_DIEHARD_START), 'no flag: everyone starts with their Diehards');
  eq(plain.config.openingAct, undefined, 'no flag: config carries nothing new');
  eq(plain.turn.lastEntrance, undefined, 'no flag: no entrance report');
  const sandbox = makeInitialState(cfg(4, { testMode: true }), 99);
  ok(sandbox.spirits.every(s => s.num != null && !s.entrance), 'Testing Grounds never uses the opening act');
  eq(openingActOn({ openingAct: true, testMode: true }), false, 'openingActOn: testMode wins');
  eq(openingActOn({}), false, 'openingActOn: off unless asked');
  // ⚠️ The act moves bodies and fans, never notes: the seeded deal is identical.
  const acted = makeInitialState(cfg(4), 99);
  for (const s of plain.spirits) eq(acted.noteStates[s.id].noteStock, plain.noteStates[s.id].noteStock, `${s.id}: same dealt hand with the act on`);
  eq(acted.rng, plain.rng, 'same rng cursor with the act on');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE OPENING BOARD — seat one is on stage, everyone else waits fanless.
// ═════════════════════════════════════════════════════════════════════════════
for (const count of [2, 3, 4]) {
  const st = makeInitialState(cfg(count), 7);
  const [first, ...rest] = st.spirits;
  eq(st.acting, first.id, `${count}p: seat one acts first`);
  eq(first.num, table(count)[0].num, `${count}p: seat one stands on its home hex`);
  eq(first.entrance, null, `${count}p: seat one has entered`);
  eq(st.noteStates[first.id].diehards, ENTRANCE_FANS, `${count}p: seat one gained its two fans`);
  eq(st.turn.lastEntrance?.spiritId, first.id, `${count}p: seat one's entrance is reported for the theatre`);
  ok(rest.every(s => s.num === null && isWaiting(s)), `${count}p: every other Spirit waits off the board`);
  ok(rest.every(s => st.noteStates[s.id].diehards === 0), `${count}p: waiting Spirits have no fans`);
  eq([...entranceHexes(st.spirits)].sort(), rest.map(home).sort(), `${count}p: their home hexes are reserved`);
  const homes = new Set(st.spirits.map(home));
  ok(!st.board.eventHexes.some(h => homes.has(h)), `${count}p: no marquee on a home hex`);
  ok(!st.board.boardTokens.some(t => homes.has(t.num)), `${count}p: no Lost Chord on a home hex`);
  eq(st.config.openingAct, true, `${count}p: config records the act`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. THE ENTRANCE — at TURN_STARTED, exactly once.
// ═════════════════════════════════════════════════════════════════════════════
{
  let st = makeInitialState(cfg(4), 11);
  const second = st.spirits[1];
  st = { ...st, acting: second.id, turnQueue: [second.id, ...st.turnQueue.filter(id => id !== second.id)] };
  const entered = applyAction(st, turnStarted(second.id));
  eq(sp(entered, second.id).num, second.entrance.homeNum, 'TURN_STARTED steps the Spirit onto its home hex');
  eq(sp(entered, second.id).facing, second.entrance.facing, '…facing the way its corner faces');
  eq(entered.noteStates[second.id].diehards, ENTRANCE_FANS, '…and grants exactly two fans');
  eq(entered.turn.lastEntrance.spiritId, second.id, '…and reports it');
  eq(entered.turn.lastEntrance.contested, undefined, '…on an empty hex');
  const twice = applyAction(entered, turnStarted(second.id));
  eq(twice.noteStates[second.id].diehards, ENTRANCE_FANS, 'a second TURN_STARTED grants nothing more');
  eq(sp(twice, second.id).num, second.entrance.homeNum, '…and moves nothing');
  // The others are untouched by someone else's entrance.
  ok(entered.spirits.slice(2).every(s => s.num === null && entered.noteStates[s.id].diehards === 0), 'other waiting Spirits stay waiting');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. THE RESERVATION AND THE UNTARGETABLE — seat one parked right next to a
//    waiting rival's home hex, with steps to spend.
// ═════════════════════════════════════════════════════════════════════════════
{
  let st = makeInitialState(cfg(4), 23);
  const me = st.spirits[0], waiter = st.spirits[1];
  const reserved = waiter.entrance.homeNum;
  const rh = HEX_BY_NUM[reserved];
  const beside = axialNeighbors(rh.q, rh.r).map(({ q, r }) => HEX_BY_QR[`${q},${r}`]).find(Boolean);
  st = actionPhase(place(st, me.id, beside.num, null), me.id);
  const acts = legalActions(st, me.id, { skillById: SKILL_BY_ID });
  ok(acts.some(a => a.kind === 'move'), 'fixture: seat one can walk');
  ok(!acts.some(a => a.to === reserved), 'nothing the searcher offers lands on the reserved hex');
  for (const w of st.spirits.filter(isWaiting)) ok(!acts.some(a => mentions(a, w.id)), `no legal action names waiting ${w.id}`);
  ok(bushidoBlockers({ spirits: st.spirits, selfId: me.id }).has(reserved), 'the shared blocker set treats the reserved hex as a body');

  const walked = applyAction(st, moveStep(me.id, reserved, false));
  eq(sp(walked, me.id).num, beside.num, 'MOVE_STEP onto the reserved hex is refused');
  eq(walked.turn.lastMove, null, '…the way an off-board step is');
  eq(sp(applyAction(st, shukuchiHopped(me.id, reserved)), me.id).num, beside.num, 'a hop onto it is refused');
  eq(sp(applyAction(st, spiritWarped(me.id, reserved, 0)), me.id).num, beside.num, 'a warp onto it is refused');
  const patched = applyAction(st, spiritPatched(me.id, { num: reserved, vibe: 3 }));
  eq(sp(patched, me.id).num, beside.num, 'a client patch cannot move anyone onto it…');
  eq(sp(patched, me.id).vibe, 3, '…but the rest of the patch lands');
  eq(sp(applyAction(st, spiritPatched(waiter.id, { num: 56 })), waiter.id).num, null, 'a patch cannot put a waiting Spirit on the board');
  eq(sp(applyAction({ ...st, acting: waiter.id }, moveStep(waiter.id, 56, false)), waiter.id).num, null, 'a waiting Spirit cannot walk');

  // A shove aimed straight through the reserved hex stops in front of it.
  const victim = st.spirits[2];
  const from = straightNeighborInDirection(beside, angleTo(rh, beside));
  if (from) {
    let fx = place(place(st, victim.id, beside.num, 0), me.id, from.num, 0);
    fx = { ...fx, spirits: fx.spirits.map(s => s.id === victim.id ? { ...s, entrance: null, vibe: 5, maxVibe: 5 } : s) };
    const out = runBattleFlow(knockback({ state: fx, fromId: me.id, targetId: victim.id, spaces: 3, direction: angleTo(HEX_BY_NUM[from.num], beside) }), fx, { applyAction });
    ok(!out.result.path.includes(reserved), 'a shove never pushes anyone onto a reserved hex');
    eq(sp(out.state, victim.id).num === reserved, false, '…the victim stops short');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. ⭐ WHOLE MATCHES. Bots at 2/3/4 seats, checked after every turn.
// ═════════════════════════════════════════════════════════════════════════════
function audit(count, seed, policyName) {
  const rng = makeRng(seed >>> 0);
  let state = makeInitialState(matchConfig(table(count), { openingAct: true }), seed >>> 0);
  const ctx = { rng, hooks: harnessHooks({ rng }) };
  const policies = Object.fromEntries(state.spirits.map(s => [s.id, POLICIES[policyName]({})]));
  let v = { amps: [], shadowHex: null, skillById: SKILL_BY_ID };
  const entries = {};
  const startVibe = Object.fromEntries(state.spirits.map(s => [s.id, s.vibe]));
  for (let turn = 0; turn < count * 4 && !state.winner && state.acting; turn++) {
    const seat = state.acting;
    const waitingBefore = state.spirits.some(s => s.id === seat && isWaiting(s));
    state = startSpiritTurn(state, rng);
    const me = sp(state, seat);
    ok(!isWaiting(me) && me.num != null, `${count}p/${seed}: ${seat} is on stage when its turn begins`);
    if (waitingBefore) {
      entries[seat] = (entries[seat] ?? 0) + 1;
      eq(state.turn.lastEntrance?.spiritId, seat, `${count}p/${seed}: ${seat}'s entrance is reported`);
      eq(state.turn.lastEntrance?.contested, undefined, `${count}p/${seed}: ${seat}'s home hex was free`);
      eq(state.noteStates[seat].diehards, ENTRANCE_FANS, `${count}p/${seed}: ${seat} enters with exactly two fans`);
    }
    const t = playTurn(state, v, policies[seat], ctx);
    state = t.state; v = t.view;
    const reserved = entranceHexes(state.spirits);
    for (const s of state.spirits) {
      if (isWaiting(s)) {
        eq(s.num, null, `${count}p/${seed} t${turn}: waiting ${s.id} is still off the board`);
        eq(s.vibe, startVibe[s.id], `${count}p/${seed} t${turn}: waiting ${s.id} took no damage`);
        eq(state.noteStates[s.id].diehards ?? 0, 0, `${count}p/${seed} t${turn}: waiting ${s.id} has no fans`);
        eq(state.noteStates[s.id].fame ?? 0, 0, `${count}p/${seed} t${turn}: waiting ${s.id} has no Fame`);
        eq(state.damageLedger?.[s.id]?.taken ?? 0, 0, `${count}p/${seed} t${turn}: nothing was dealt to waiting ${s.id}`);
      } else if (!s.knockedOut) {
        ok(!reserved.has(s.num), `${count}p/${seed} t${turn}: ${s.id} is not standing on a reserved hex`);
      }
    }
  }
  ok(state.spirits.every(s => !isWaiting(s)), `${count}p/${seed}: by the end of round one everyone has entered`);
  ok(Object.values(entries).every(k => k === 1), `${count}p/${seed}: each Spirit entered exactly once`);
}
for (const count of [2, 3, 4]) for (const seed of [1, 2, 3, 5, 8, 13]) for (const p of ['searcher', 'random']) audit(count, seed, p);

// And the bench end to end: a full match with the act on finishes like any other.
{
  const r = runMatch({ seed: 4242, spirits: table(4), openingAct: true,
    policies: Object.fromEntries(table(4).map(s => [s.id, POLICIES.searcher({})])) });
  ok(['buzzer', 'winner'].includes(r.reason), `a 4-player bench match with the act on ends cleanly (${r.reason}${r.anomaly ? ': ' + JSON.stringify(r.anomaly) : ''})`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. THE PICTURE FOLLOWS THE PREVIEW — `board/openingAct.js` is the game's copy
//    of the preview's clock; the dial-in is one record, not two.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq({ ...act.OPENING_ACT }, alexDialIn.settings, 'the game plays Alex\'s exact dial-in');
  eq({ ...preview.DEFAULTS }, alexDialIn.settings, '…and so does the preview — one record');
  for (const players of [2, 3, 4]) {
    const s = { ...preview.DEFAULTS, players };
    for (let i = 0; i < players; i++) ok(Math.abs(act.landingTime(i) - preview.landingTime(i, s)) < 1e-9, `${players}p seat ${i + 1}: same landing time`);
    ok(Math.abs(act.introEnd(players) - preview.introEnd(s)) < 1e-9, `${players}p: same intro end`);
    ok(Math.abs(act.riffSeconds(preview.CHARACTERS[0]) + act.STEP_SECONDS - preview.entranceDuration(preview.CHARACTERS[0])) < 1e-9, `${players}p: same entrance length`);
  }
  const seats = table(4).map(s => ({ id: s.id, corner: s.corner }));
  const sched = act.openingSchedule(seats, 1000);
  const first = sched.seats[seats[0].id];
  eq(first.riffAt, sched.endMs, 'seat one\'s riff starts as the intro ends');
  ok(Math.abs(first.stepAt - first.riffAt - act.riffSeconds(seats[0].id) * 1000) < 1e-6, '…and its step waits for the whole picker riff');
  ok(seats.slice(1).every(s => sched.seats[s.id].riffAt == null), 'later seats have no entrance until their own turn');
  eq(act.openingDoneAt(sched), first.doneAt, 'the intro is done when seat one has landed on its hex');
  const at = t => act.seatPose(first, t);
  eq(at(first.landingAt - 900).visible, false, 'a standee is not on screen before it falls');
  ok(at(first.landingAt - 400).fall > 0, 'it falls…');
  eq(act.seatPose(first, first.landingAt - 400, { reduced: true }).fall, 0, '…except under reduced motion');
  eq(at(first.riffAt + 10).progress, 0, 'it stays on its pad while its riff plays');
  eq(at(first.riffAt + 10).fansShown, false, '…with an empty stand');
  ok(at(first.stepAt + 400).progress > 0 && at(first.stepAt + 400).progress < 1, 'it hops after the riff');
  eq(at(first.doneAt + 1).fansShown, true, 'its two fans show once it lands');
  eq(act.seatPose(sched.seats[seats[1].id], 1e9, { waiting: true }).progress, 0, 'a seat still waiting stays on its pad whatever the clock says');
  for (const corner of Object.keys(CORNERS)) {
    const pad = act.padPoint(corner), home = act.homePoint(corner);
    const d = Math.hypot(pad.x - home.x, pad.z - home.z);
    ok(d > .5 && d < 2, `${corner}: the pad is just off the board, beside the home hex (${d.toFixed(2)})`);
  }
}

console.log(`Opening act (entrance): ${n} checks passed.`);
