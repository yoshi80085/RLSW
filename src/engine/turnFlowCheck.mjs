// ─── TURN FLOW CHECK ─────────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/turnFlowCheck.mjs
//
// Coverage for the turn-start transform lifted out of `startNewTurnNotes`.
// This is §1's spine — the six slots that buy every hex walked and every stack
// commit — so the cases here are about the ECONOMY, not the plumbing:
//   · unused notes carry over; only SPENT slots recharge, oldest first
//   · the rate is halved / drained / floored, and both penalties are consumed
//   · the mode is derived from the Drive Stack and the stock is respelled into it
//   · every per-turn reset and cooldown tick actually fires
//   · the function is PURE — same input twice, same output, no mutation

import assert from "node:assert";
import { makeRng } from "./rng.js";
import { startTurnNotes, refillRateFor, refillDrawCount } from "./systems/turnFlow.js";
import { makeInitialNoteState } from "./systems/economy.js";
import { STOCK_REFILL_RATE } from "../data/gameConstants.js";

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.equal(a, b, m); checks++; };

const sheet = (over = {}) => ({
  ...makeInitialNoteState('cosmic_ronin', makeRng(11)),
  ...over,
});

/** Draw the right number of seeded values for a sheet, the way the client does. */
const drawsFor = (ns, seed = 5) => {
  const r = makeRng(seed);
  return Array.from({ length: refillDrawCount(ns) }, () => r());
};

const run = (ns, seed = 5) => startTurnNotes(ns, { draws: drawsFor(ns, seed) });

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE REFILL RATE — and both things that cut it.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(refillRateFor({}), STOCK_REFILL_RATE, `a clean sheet refills at the full ${STOCK_REFILL_RATE}`);
  eq(refillRateFor({ halfRefillNextTurn: true }), Math.floor(STOCK_REFILL_RATE / 2),
     '🪓 an Axe Swing whiff halves the rate');
  eq(refillRateFor({ refillDrain: 2 }), STOCK_REFILL_RATE - 2,
     '🕳️ Gravity Control drains notes off the rate');

  // The two stack, and the result floors at 0 — being slimed AND swallowed is a
  // bad turn, never a negative refill that would hand notes back.
  eq(refillRateFor({ halfRefillNextTurn: true, refillDrain: 2 }),
     Math.max(0, Math.floor(STOCK_REFILL_RATE / 2) - 2),
     'the halving and the drain stack');
  eq(refillRateFor({ halfRefillNextTurn: true, refillDrain: 99 }), 0,
     'the rate floors at 0 — a drain can never hand notes back');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. GRADUAL REFILL — unused notes carry over, spent slots recharge oldest-first.
//    This is the carry-over that makes §1 a tempo decision rather than a
//    use-it-or-lose-it hand.
// ═════════════════════════════════════════════════════════════════════════════
{
  // Spend 9 slots — more than one turn can recharge.
  const spent = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const ns = sheet({ usedStockIdx: spent });
  const { patch, report } = run(ns);

  eq(report.refreshedCount, STOCK_REFILL_RATE,
     `only ${STOCK_REFILL_RATE} of 9 spent slots recharge in one turn`);
  eq(patch.usedStockIdx.length, spent.length - STOCK_REFILL_RATE,
     'the rest stay spent and carry into next turn');
  assert.deepEqual(report.refreshedIdx, spent.slice(0, STOCK_REFILL_RATE),
    'spent slots recharge in insertion order — oldest debt first'); checks++;
  assert.deepEqual(patch.usedStockIdx, spent.slice(STOCK_REFILL_RATE),
    'the carried-over debt keeps its order'); checks++;

  // Unspent slots are untouched (beyond respelling, covered below).
  const untouched = sheet({ usedStockIdx: [] });
  const r2 = run(untouched);
  eq(r2.report.refreshedCount, 0, 'a sheet that spent nothing draws nothing');
  eq(r2.patch.usedStockIdx.length, 0, 'and carries no debt');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. THE DRAW BUDGET — refillDrawCount must match what the transform consumes.
//    ⚠️ If these ever disagree the client draws the wrong number of values off
//    the seeded stream and EVERY subsequent draw in the match is misaligned —
//    a desync that looks like nothing until a replay diverges.
// ═════════════════════════════════════════════════════════════════════════════
{
  for (const over of [
    { usedStockIdx: [] },
    { usedStockIdx: [0] },
    { usedStockIdx: [0, 1, 2, 3, 4, 5, 6, 7] },
    { usedStockIdx: [0, 1, 2], halfRefillNextTurn: true },
    { usedStockIdx: [0, 1, 2, 3, 4, 5], refillDrain: 2 },
    { usedStockIdx: [0, 1, 2], halfRefillNextTurn: true, refillDrain: 99 },
  ]) {
    const ns = sheet(over);
    const promised = refillDrawCount(ns);
    // Hand it exactly one MORE than promised, all distinguishable, and assert
    // the extra is never touched.
    const draws = Array.from({ length: promised + 1 }, (_, i) => i / (promised + 2));
    const { report } = startTurnNotes(ns, { draws });
    ok(report.refreshedCount <= promised,
       `refillDrawCount(${JSON.stringify(over)}) promises ≥ what the transform consumes`);
  }

  // And the promise is tight, not merely an upper bound, in the ordinary case.
  const busy = sheet({ usedStockIdx: [0, 1, 2, 3, 4, 5, 6, 7] });
  eq(refillDrawCount(busy), run(busy).report.refreshedCount,
     'the promised draw count equals the consumed draw count');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. PENALTIES ARE CONSUMED — each bites exactly once.
// ═════════════════════════════════════════════════════════════════════════════
{
  const ns = sheet({ usedStockIdx: [0, 1, 2, 3, 4, 5], halfRefillNextTurn: true, refillDrain: 1 });
  const { patch, report } = run(ns);
  eq(report.halvedByAxeSwing, true, 'the report tells the client to announce the whiff penalty');
  eq(report.drainedByVortex, 1, 'and how many notes the vortex ate');
  eq(patch.halfRefillNextTurn, false, '🪓 the whiff penalty is spent');
  eq(patch.refillDrain, 0, '🕳️ the vortex drain is spent');

  // Next turn, off the patched sheet, the rate is whole again.
  eq(refillRateFor({ ...ns, ...patch }), STOCK_REFILL_RATE, 'the following turn refills at full rate');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. MODE DERIVATION — the Drive Stack declares it, and the stock is respelled.
// ═════════════════════════════════════════════════════════════════════════════
{
  // A minor triad in the Drive Stack should pull the sheet minor.
  const minor = sheet({ driveStack: ['C', 'Eb', 'G'], scaleMode: 'major', rootNote: 'C' });
  const { patch, report } = run(minor);
  eq(patch.scaleMode, 'minor', 'a minor triad in the Drive Stack declares the mode minor');
  eq(report.modeChanged, true, 'and the report flags the flip so the HUD can say so');
  ok(patch.modeChordName?.length > 0, 'the chord that decided it is named for the HUD');
  eq(patch.pendingModeBonus.mode, 'minor', 'the Db bonus is STAGED, not paid — the caller owns that');

  // Carried-over (unspent) notes are respelled into the derived key rather than
  // left in last turn's spelling.
  const respelled = sheet({ driveStack: ['C', 'Eb', 'G'], usedStockIdx: [], rootNote: 'C', scaleMode: 'major' });
  const out = run(respelled);
  eq(out.patch.noteStock.length, respelled.noteStock.length, 'respelling never changes stock size');
  eq(out.report.refreshedCount, 0, 'and it is not a refill — nothing was spent');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. PER-TURN RESETS AND COOLDOWN TICKS.
// ═════════════════════════════════════════════════════════════════════════════
{
  const ns = sheet({
    melodyLine: ['C', 'D'], hasConfirmed: true, discordCount: 3,
    stackCommitsThisTurn: 3, smashExposed: true, swingExposed: true,
    mixerUsedThisTurn: true, moshpitUsedThisTurn: true, dieFloorBoost: 2,
    psychoBushidoCd: 2, elevenTurns: 3, chargeFloorTurns: 2, chargeCeilTurns: 1,
    cadenceCooldowns: { perfect: 3, plagal: 1, deceptive: 0 },
    roadies: [{ id: 'a', cooldownTurns: 2 }, { id: 'b', cooldownTurns: 0 }],
    modCards: [{ id: 'x', exhausted: true }, { id: 'y', oneShot: true, exhausted: true }],
  });
  const { patch } = run(ns);

  assert.deepEqual(patch.melodyLine, [], 'the melody line clears'); checks++;
  eq(patch.hasConfirmed, false, 'the confirm flag clears');
  eq(patch.discordCount, 0, 'the discord counter clears');
  eq(patch.stackCommitsThisTurn, 0, '🎸 the stack commit budget refreshes');
  eq(patch.smashExposed, false, '💥 Smash exposure clears at the start of your own turn');
  eq(patch.swingExposed, false, '🥊 CQC exposure clears too');
  eq(patch.mixerUsedThisTurn, false, 'the mixer recharges');
  eq(patch.moshpitUsedThisTurn, false, '🤘 moshpit recharges');
  eq(patch.dieFloorBoost, 0, 'the die floor boost clears');

  eq(patch.psychoBushidoCd, 1, '🌀 Psycho Bushido cooldown ticks');
  eq(patch.elevenTurns, 2, 'the eleven boost ticks');
  eq(patch.chargeFloorTurns, 1, '⚡ floor charge ticks on the holder\'s own turn');
  eq(patch.chargeCeilTurns, 0, '⚡ ceiling charge ticks');
  eq(patch.cadenceCooldowns.perfect, 2, 'cadence cooldowns tick');
  eq(patch.cadenceCooldowns.deceptive, 0, 'and floor at 0 rather than going negative');
  eq(patch.roadies[0].cooldownTurns, 1, 'roadie cooldowns tick');
  eq(patch.roadies[1].cooldownTurns, 0, 'and a ready roadie stays ready');
  eq(patch.modCards.length, 1, 'a spent ONE-SHOT mod card falls away instead of recharging');
  eq(patch.modCards[0].exhausted, false, 'a normal mod card refreshes');

  // ⚡ Charges floor rather than going negative — a stale −1 would read as
  // "expired" everywhere but sort wrong anywhere it is compared.
  const flat = run(sheet({ chargeFloorTurns: 0, chargeCeilTurns: 0 })).patch;
  eq(flat.chargeFloorTurns, 0, 'charge turns floor at 0');
  eq(flat.chargeCeilTurns, 0, 'both of them');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. 👤 SHADOW ILLUSION — counts the Ronin's own turns, and the report exposes
//    the PRE-tick state so the client can announce the double melting away.
// ═════════════════════════════════════════════════════════════════════════════
{
  const alive = run(sheet({ shadowIllusion: { hex: 40, turnsLeft: 3, stepsLeft: 4 } }));
  eq(alive.patch.shadowIllusion.turnsLeft, 2, 'the double ticks down');
  eq(alive.patch.shadowIllusion.stepsLeft, 0,
     "the double's legs zero here — the melody commit refills them to THIS turn's budget");
  eq(alive.report.shadowExpiring, false, 'and it is not announced as expiring');

  const last = run(sheet({ shadowIllusion: { hex: 40, turnsLeft: 1, stepsLeft: 2 } }));
  eq(last.patch.shadowIllusion, null, 'the double is spent on its last turn');
  eq(last.report.shadowExpiring, true, 'the report flags it BEFORE the patch erases it');
  eq(last.report.shadowHexBefore, 40, 'and carries the hex so the FX knows where to play');

  eq(run(sheet({ shadowIllusion: null })).patch.shadowIllusion, null, 'no illusion stays no illusion');
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. PURITY — same input twice ⇒ identical output, and the input is untouched.
//    The client feeds this through a React functional update, which may be
//    invoked more than once for a single logical update.
// ═════════════════════════════════════════════════════════════════════════════
{
  const ns = sheet({ usedStockIdx: [0, 1, 2, 3], driveStack: ['C', 'Eb', 'G'] });
  const before = JSON.stringify(ns);
  const draws = drawsFor(ns);

  const a = startTurnNotes(ns, { draws });
  const b = startTurnNotes(ns, { draws });
  eq(JSON.stringify(a.patch), JSON.stringify(b.patch), 'same sheet + same draws ⇒ identical patch');
  eq(JSON.stringify(ns), before, 'the input sheet is not mutated');

  // Different draws ⇒ different fresh notes (otherwise the draws are ignored
  // and the "deterministic" result is deterministic for the wrong reason).
  const c = startTurnNotes(ns, { draws: drawsFor(ns, 999) });
  ok(JSON.stringify(c.patch.noteStock) !== JSON.stringify(a.patch.noteStock),
     'the seeded draws actually decide the fresh notes');

  eq(startTurnNotes(null).patch, null, 'a missing sheet is a no-op, not a throw');
}

console.log(`✅ turnFlow: ${checks} checks passed`);
