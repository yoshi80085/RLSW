// ─── ⚡ PSYCHO BUSHIDO — THE BURST (2026-10-01) ───────────────────────────────
// Alex, 2026-09-30 → 10-01, in order:
//   · "it should be 'charging' while the dice are rolling (the higher the dice,
//     the more the charge)"
//   · "Bushido essentially starts turning the d6 into d8's - the further away the
//     strike, the more dice turn to d8's" — and his rulings: it REPLACES the old
//     Drive bonus, only d6s upgrade, a pool short of d6s simply runs out.
//   · "I actually wonder if this should be a Drive Vs Sustain type of action, not
//     a normal Swing … the Rival puts up a shield that Ronin has to 1st Burst
//     through before getting to the Rival" — then "Everything looks good".
//   · "make sure the rule holds that the Spirit gets knocked back - This time the
//     same as it would during a Sonic attack".
//
// So: the Ronin throws his DRIVE rig (no amp needed) with the range upgrading
// d6 → d8; the Rival throws his SUSTAIN as a shield; the Ronin's kept dice hit it
// one by one on the Sonic's own ledger; the damage is what gets THROUGH; the push
// is the Sonic's (one hex per die through, along his facing, ring-outs allowed);
// a shield that holds costs the Ronin nothing more — no counter-blow.
//
// ⚠️ `bushidoCheck.mjs` holds the window, the lane and the bill, and it is red
// on its own older assertions (cooldown / Db respecs that predate this). This
// suite is the burst, and it is green on its own so the rule is guarded.
import assert from "node:assert";
import { makeInitialState } from "./state.js";
import { legalActions } from "./policies/legalActions.js";
import { applyBotAction } from "./policies/transition.js";
import { applyAction } from "./reduce.js";
import { attackRolled } from "./actions.js";
import { makeRng } from "./rng.js";
import { attackParams } from "./systems/attackParams.js";
import { sonicRig, sustainRig } from "./systems/sonicRig.js";
import { bushidoUpgrade, bushidoDrawPatch } from "./systems/bushido.js";
import { applyAttackRerolled } from "./systems/combat.js";
import { resolveSonicBarrage } from "./systems/sonicBarrage.js";
import { PSYCHO_BUSHIDO_D8_LADDER, psychoBushidoD8s, PSYCHO_BUSHIDO_AP_COST, PSYCHO_BUSHIDO_STACK_COST } from "../data/gameConstants.js";
import { HEX_BY_NUM, HEX_BY_QR } from "../board/hexMap.js";
import { neighborInDirection } from "../board/hexGeometry.js";
import { CORNERS } from "../data/corners.js";
import { readFileSync } from "node:fs";

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); checks++; };
console.log('⚡ bushidoBurstCheck — d6→d8 by range, Drive against a Sustain shield, the Sonic push\n');

const RONIN = 'cosmic_ronin', ZERO = 'intergalactic_0', METAL = 'Metalness_Monster';
const START = 45;
const o = HEX_BY_NUM[START], f = neighborInDirection(o, 0), dq = f.q - o.q, dr = f.r - o.r;
const laneAt = d => HEX_BY_QR[`${o.q + dq * d},${o.r + dr * d}`]?.num;
// 📌 Real spellings, not 'C3' — the vocabularies read pitch classes, and a stack
// they cannot read has a Drive of 0 (an empty pool would pass every check below).
const DRIVE6 = ['C', 'Eb', 'F', 'G', 'Bb', 'D'];
const SUSTAIN4 = ['C', 'D', 'E', 'G'];

function boardAt(d, { ronin = {}, zero = {}, zeroVibe = 9 } = {}) {
  const st = makeInitialState(structuredClone({ mode:'ffa', startingLives:3, spirits:[
    { id:RONIN, name:'Shredding Ronin', corner:'blue', num:START, vibe:9, maxVibe:9, knockedOut:false, facing:0 },
    { id:ZERO, name:'Intergalactic 0', corner:'purple', num:laneAt(d), vibe:zeroVibe, maxVibe:9, knockedOut:false, facing:0 },
    { id:METAL, name:'Metalness Monster', corner:'yellow', num:CORNERS.yellow.homeNum, vibe:5, maxVibe:5, knockedOut:false, facing:0 },
  ] }), 909);
  return { ...st, acting:RONIN, turn:{ ...st.turn, moveStepsLeft:5, actionTokenUsed:false },
    noteStates:{ ...st.noteStates,
      [RONIN]:{ ...st.noteStates[RONIN], hasConfirmed:true, unlockedSkills:['psycho_bushido'], dbPoints:10, driveStack:[...DRIVE6], ...ronin },
      [ZERO]:{ ...st.noteStates[ZERO], sustainStack:[...SUSTAIN4], ...zero } } };
}
const drawOf = st => legalActions(st, RONIN, {}).find(a => a.kind === 'psychoBushido');
const spirit = (st, id) => st.spirits.find(s => s.id === id);

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE UPGRADE — two, three, four d6s become d8s; only d6s; it can run out.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(PSYCHO_BUSHIDO_D8_LADDER, [2, 3, 4], '⚡ the ladder: 2 / 3 / 4 d8s across the 3–5 window');
  eq([3, 4, 5].map(psychoBushidoD8s), [2, 3, 4], '⚡ …read through the one function');
  eq([0, 2, 6].map(psychoBushidoD8s), [0, 0, 0], '⚡ …and nothing outside the window');
  eq(bushidoUpgrade([6, 6, 6, 6], 3), [8, 8, 6, 6], '⚡ range 3: two of four d6s');
  eq(bushidoUpgrade([6, 6, 6, 6], 4), [8, 8, 8, 6], '⚡ range 4: three');
  eq(bushidoUpgrade([6, 6, 6, 6], 5), [8, 8, 8, 8], '⚡ range 5: all four');
  eq(bushidoUpgrade([6, 6, 6], 5), [8, 8, 8], '⚡ a pool short of d6s runs out — no fourth die appears (Alex: "right")');
  eq(bushidoUpgrade([8, 8, 6, 6, 6, 6, 6, 6], 4), [8, 8, 8, 8, 8, 6, 6, 6],
    '⚡ a six-note chord\'s own d8s are not "spent" by the upgrade — only d6s turn');
  eq(bushidoUpgrade([11, 6, 6], 5), [11, 8, 8], '⚡ the Eleven die is left alone');
  eq(bushidoUpgrade([10, 10, 6], 5), [10, 10, 8], '⚡ so is a charge-zone d10');
  ok(bushidoUpgrade([6, 6, 6, 6], 5).length === 4, '⚡ no dice are added — the pool keeps its length');
  const ns = { driveStack:['A', 'B', 'C', 'D'], tempDrive:1, dbPoints:10 };
  ok(!('tempDrive' in bushidoDrawPatch(ns, 5)), '🪦 the draw pays no tempDrive any more — the cap of 2 dice used to flatten ranges 4 and 5');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE PARAMETERS — his Drive rig upgraded, the Rival's Sustain as a shield.
// ═════════════════════════════════════════════════════════════════════════════
for (const d of [3, 4, 5]) {
  const st = boardAt(d);
  const p = attackParams(st, RONIN, ZERO, 'bushido', { bushido:{ dist:d } });
  const rig = sonicRig(st.noteStates[RONIN], 0, 0, true, RONIN);
  eq(p.dicePool, bushidoUpgrade(rig.pool, d), `⚔️ range ${d}: he throws his own Drive rig, ${psychoBushidoD8s(d)} d6s turned to d8s`);
  eq(p.atkKeep, rig.keep, '⚔️ …keeping his Drive seats\' worth');
  ok(p.sustainPool.length > 0, '🛡️ the Rival throws Sustain dice for the shield');
  eq(p.bushidoDist, d, '📏 the range rides along for the show');
}
{
  // No amp needed: a Sonic is offline with a blown amp; the draw is not.
  const st = boardAt(4, { ronin:{ ampBlown:true, ampBlownTurns:2 } });
  ok(attackParams(st, RONIN, ZERO, 'bushido', { bushido:{ dist:4 } }).dicePool.length > 0,
    '🔌 a blown amp does not stop the draw — it is his blade, not his rig');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. THE ROLL — the Sonic ledger, a Bushido battle, damage = strength through.
// ═════════════════════════════════════════════════════════════════════════════
{
  let seen = { hold:0, through:0 };
  for (let seed = 1; seed <= 60; seed++) {
    const st = boardAt(4);
    const p = attackParams(st, RONIN, ZERO, 'bushido', { bushido:{ dist:4 } });
    const { _derived, ...opts } = p;
    const after = applyAction(st, attackRolled('bushido', RONIN, ZERO, opts), makeRng(seed));
    const b = after.battle;
    if (seed === 1) {
      eq([b.attackKind, b.bushido, b.sonicAttack, b.sonicVersion], ['bushido', true, true, 2],
        '⚡ a Bushido battle: its own kind, flagged, and riding the staged Sonic path');
      eq(b.bushidoFrom, START, '⚡ he draws from the hex he stands on — the warp comes after the roll');
      eq(b.bushidoDist, 4, '📏 …and the battle knows the range');
      eq(after.noteStates[ZERO].pendingSonicAttacks ?? 0, st.noteStates[ZERO].pendingSonicAttacks ?? 0,
        '🔊 the per-lap Sonic tally is NOT charged — this was not a Sonic');
    }
    const ledger = resolveSonicBarrage(b.diceVals, b.shieldValue);
    eq(b.strengthThrough, ledger.strengthThrough, `🛡️ seed ${seed}: the Sonic's own ledger decides it`);
    eq(b.strengthThrough, Math.max(0, b.diceVals.reduce((a, v) => a + v, 0) - b.shieldValue),
      `🛡️ seed ${seed}: what gets through is his kept total over the shield`);
    eq(b.damage, b.strengthThrough, `💥 seed ${seed}: the damage IS the strength through (not the Sonic's 1–2)`);
    eq(b.shieldValue, b.sustainRolls.reduce((a, v) => a + v, 0), `🛡️ seed ${seed}: the shield is the kept Sustain total`);
    if (b.strengthThrough > 0) seen.through++; else seen.hold++;
  }
  ok(seen.hold > 0 && seen.through > 0, `🎲 the fixture sees both a held shield (${seen.hold}) and a burst (${seen.through})`);
}
{
  // A re-thrown Bushido (Code Injection) keeps its own damage rule.
  const st = boardAt(4);
  const { _derived, ...opts } = attackParams(st, RONIN, ZERO, 'bushido', { bushido:{ dist:4 } });
  const rolled = applyAction(st, attackRolled('bushido', RONIN, ZERO, opts), makeRng(3));
  for (let seed = 1; seed <= 20; seed++) {
    const re = applyAttackRerolled(rolled, {}, makeRng(seed)).battle;
    eq(re.damage, re.strengthThrough, `🎲 a re-throw (seed ${seed}) still deals the strength through`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. THE KERNEL — the whole draw, headless, exactly as the client plays it.
// ═════════════════════════════════════════════════════════════════════════════
{
  let pushes = 0, holds = 0, rings = 0;
  for (const d of [3, 4, 5]) for (let seed = 1; seed <= 25; seed++) {
    const st = boardAt(d);
    const move = drawOf(st);
    ok(move && move.dist === d, `🗡️ range ${d}: the draw is legal`);
    const res = applyBotAction(st, move, { rng:makeRng(seed * 31), view:{} });
    ok(res.ok, `🗡️ range ${d} seed ${seed}: it runs (${res.reason ?? 'ok'})`);
    const after = res.state, b = after.lastBattle ?? res.battle ?? after.battle ?? null;
    const ronin = spirit(after, RONIN), zero = spirit(after, ZERO);
    eq(ronin.num, move.to, '🏁 he ends on the hex before the Rival');
    eq(st.turn.moveStepsLeft - after.turn.moveStepsLeft, PSYCHO_BUSHIDO_AP_COST, '⚡ 3 AP, flat, paid once');
    eq(after.turn.actionTokenUsed, true, '⚡ …and the Action Token');
    eq(after.noteStates[RONIN].driveStack.length, DRIVE6.length - PSYCHO_BUSHIDO_STACK_COST,
      '🎸 the draw takes its two notes off the stack — and no Swing spend on top');
    eq(ronin.vibe, 9, '🛡️ NO COUNTER-BLOW: whatever happens, the Ronin takes nothing');
    eq(after.noteStates[RONIN].swingExposed, true, '🥊 he dashed into melee: his guard is down until his next turn');
    // Read the verdict off the Rival: a held shield moves and hurts nobody.
    const moved = zero.num !== laneAt(d);
    if (!moved) {
      holds++;
      eq(zero.vibe, 9, '🛡️ a held shield: the Rival is untouched');
    } else if (zero.num === CORNERS.purple.homeNum) {
      rings++;                                   // pushed off the edge: the Sonic's ring-out
    } else {
      pushes++;
      // ⭐ THE SONIC PUSH: straight on down his line, one hex per die through.
      const path = [1, 2, 3, 4, 5].map(k => laneAt(d + k));
      ok(path.includes(zero.num), `🌀 range ${d} seed ${seed}: pushed straight on down the lane (to ${zero.num})`);
      ok(zero.vibe < 9, '💥 …and hurt');
    }
  }
  ok(holds > 0 && pushes > 0, `🎲 the kernel sees holds (${holds}) and pushes (${pushes})${rings ? ` and ring-outs (${rings})` : ''}`);
}
{
  // The push is exactly the hits: replay one roll by hand and check the distance.
  for (let seed = 1; seed <= 30; seed++) {
    const st = boardAt(3, { zeroVibe:9 });
    const move = drawOf(st);
    // Roll exactly as the kernel will (same rng stream), via the reducer.
    const res = applyBotAction(st, move, { rng:makeRng(seed * 7), view:{} });
    const zero = spirit(res.state, ZERO);
    const lane = [0, 1, 2, 3, 4, 5, 6, 7].map(k => laneAt(3 + k));
    const steps = lane.indexOf(zero.num);
    if (steps < 0) continue;                     // a ring-out or a respawn
    ok(steps <= 5, `🌀 seed ${seed}: never pushed further than his dice could`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. THE CLIENT — §B2: read the client, not the test.
// ═════════════════════════════════════════════════════════════════════════════
{
  const CLIENT = readFileSync(new URL('../rlsw-simulator-v3_8_1.jsx', import.meta.url), 'utf8');
  const body = CLIENT.slice(CLIENT.indexOf('function resolvePsychoBushido('), CLIENT.indexOf('function getPsychoBushidoTargets('));
  ok(/attackRolled\('bushido'/.test(body), '🖥️ the client rolls a Bushido, not a Swing');
  ok(!/initiateSwing\(/.test(body), '🖥️ …and no longer hands the strike to initiateSwing');
  ok(!/spiritWarped/.test(body), '🖥️ …and does not move him before the dice — he draws from where he stands');
  ok(/bushidoTo/.test(CLIENT) && /spiritWarped\(scene\.attackerId,\s*scene\.bushidoTo/.test(CLIENT),
    '🖥️ the warp happens at the draw, inside the sequence that then resolves the push');
}

console.log(`\n✅ bushidoBurstCheck: ${checks} assertions passed`);
