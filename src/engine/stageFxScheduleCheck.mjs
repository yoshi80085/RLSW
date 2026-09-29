// ─── STAGE FX ROUND SCHEDULE CHECK (2026-09-29) ─────────────────────────────
// Alex: Stage Effects stop riding Fame and fire at set rounds —
//   10 rounds → 7 (to the buzzer) · 15 → 7 (3 rounds), 12 (to the buzzer)
//   20 → 7, 12 (3 rounds each), 17 (to the buzzer) — random, no repeats.
// This suite pins the schedule, the engine's draw + lengths, the legacy
// threshold path old replays need, and — reading the CLIENT (§B2) — that the
// game actually asks the schedule on the round clock and nowhere else.
// Run: npm run test:stagefx

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import {
  stageFxDrawn, stageFxScheduled, stageFxActivated, stageFxTurnTicked, stageFxRoundTicked, spiritsSynced,
} from "./actions.js";
import { snapshot, restore, replay } from "./serialize.js";
import {
  stageFxSchedule, STAGE_FX_IDS, SMOKE_ROUNDS, SMOKE_MAX_RADIUS, LASER_ROUNDS, ANIMATRONIC_ROUNDS,
} from "../data/stageEffects.js";
import { ROUND_LIMIT_CHOICES } from "../data/gameConstants.js";
import { CORNERS } from "../data/corners.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

const base = (winCondition, roundLimit, seed = 909) => makeInitialState({
  spirits: [
    { id: "wildaxe", num: 7,  facing: 2, corner: "blue", color: "#4aa3ff", cpu: false },
    { id: "vera",    num: 105, facing: 5, corner: "red", color: "#ff4a6a", cpu: true },
  ],
  mode: "ffa", teams: null, startingLives: 3, beginnerMode: true, winCondition, roundLimit,
}, seed);

// ── §1 the schedule, exactly as Alex said it ─────────────────────────────────
eq(stageFxSchedule(10), [{ round: 7, untilRound: 10 }], "10 rounds: one show at 7, to the buzzer");
eq(stageFxSchedule(15), [{ round: 7, untilRound: 9 }, { round: 12, untilRound: 15 }], "15 rounds: 7–9, then 12 to the buzzer");
eq(stageFxSchedule(20), [{ round: 7, untilRound: 9 }, { round: 12, untilRound: 14 }, { round: 17, untilRound: 20 }], "20 rounds: 7–9, 12–14, 17 to the buzzer");
eq(stageFxSchedule(null), [{ round: 7, untilRound: 9 }, { round: 12, untilRound: 14 }, { round: 17, untilRound: 19 }], "Legend Run: three 3-round shows (no buzzer to run to)");
for (const L of ROUND_LIMIT_CHOICES) {
  const s = stageFxSchedule(L);
  ok(s.length >= 1 && s.length <= STAGE_FX_IDS.length, `${L} rounds: 1..deck-size shows (no repeat possible)`);
  eq(s[s.length - 1].untilRound, L, `${L} rounds: the last show runs to the buzzer`);
  for (let i = 1; i < s.length; i++) ok(s[i].round > s[i - 1].untilRound, `${L} rounds: shows never overlap`);
}

// ── §2 the engine draws exactly on the scheduled rounds ──────────────────────
for (const L of ROUND_LIMIT_CHOICES) {
  const s0 = base("rounds", L);
  let st = s0;
  const drawn = [];
  for (let r = 1; r <= L + 2; r++) {
    st = applyAction(st, stageFxScheduled(r));
    if (st.stageFx.lastDraw) drawn.push(st.stageFx.lastDraw);
  }
  const want = stageFxSchedule(L);
  eq(drawn.map(d => d.round), want.map(w => w.round), `${L} rounds: draws on ${want.map(w => w.round)} and no other round`);
  eq(drawn.map(d => d.rounds), want.map(w => w.untilRound - w.round + 1), `${L} rounds: each draw carries its show's length`);
  eq(drawn.map(d => d.fxId), s0.stageFx.deck.slice(0, drawn.length), `${L} rounds: effects come off the shuffled deck in order`);
  eq(new Set(drawn.map(d => d.fxId)).size, drawn.length, `${L} rounds: no effect repeats`);
  eq(st.rng.cursor, s0.rng.cursor, `${L} rounds: drawing consumes no rng`);
  const again = applyAction(st, stageFxScheduled(7));
  eq(again.stageFx.lastDraw, null, `${L} rounds: re-asking a fired round is a dead draw`);
  eq(again.stageFx.fired, st.stageFx.fired, `${L} rounds: …and fires nothing`);
}
{
  // random: the deck differs across seeds (a show is not always the same effect)
  const firsts = new Set(Array.from({ length: 24 }, (_, i) => base("rounds", 10, 100 + i).stageFx.deck[0]));
  ok(firsts.size >= 3, `round 7's effect varies by seed (${firsts.size} of 4 seen over 24 seeds)`);
  const leg = base("fame", 10);
  const legDraws = [7, 12, 17, 22].map(r => applyAction(leg, stageFxScheduled(r)).stageFx.lastDraw?.rounds ?? null);
  eq(legDraws, [3, 3, 3, null], "Legend Run: shows at 7/12/17, 3 rounds each, nothing after");
}

// ── §3 an activated show lives exactly `rounds` round-ends ──────────────────
const cornerId = Object.keys(CORNERS)[0];
const onBoard = applyAction(base("rounds", 15, 4242), spiritsSynced([
  { id: "wildaxe", num: 7,  facing: 2, corner: cornerId, lives: 3, vibe: 10, maxVibe: 10, knockedOut: false },
  { id: "vera",    num: 40, facing: 5, corner: cornerId, lives: 3, vibe: 8,  maxVibe: 8,  knockedOut: false },
]));
const roundEnd = (st) => applyAction(applyAction(st, stageFxRoundTicked()), stageFxTurnTicked()); // the client's order
const alive = (st, fxId) => ({
  smoke_machine: !!st.stageFx.smoke, laser_show: !!st.stageFx.laser,
  pyrotechnics: !!st.stageFx.pyro, animatronics: (st.stageFx.animatronics ?? []).length > 0,
})[fxId];
for (const fxId of STAGE_FX_IDS) {
  for (const R of [3, 4]) {
    let st = applyAction(onBoard, stageFxActivated(fxId, [7, 40], R));
    ok(alive(st, fxId), `${fxId} ×${R}: live on activation`);
    let maxRadius = st.stageFx.smoke?.radius ?? 0;
    for (let i = 1; i < R; i++) {
      st = roundEnd(st);
      ok(alive(st, fxId), `${fxId} ×${R}: still live after round-end ${i}`);
      maxRadius = Math.max(maxRadius, st.stageFx.smoke?.radius ?? 0);
    }
    st = roundEnd(st);
    ok(!alive(st, fxId), `${fxId} ×${R}: gone after round-end ${R}`);
    if (fxId === "smoke_machine") ok(maxRadius <= SMOKE_MAX_RADIUS, `smoke ×${R}: never wider than ${SMOKE_MAX_RADIUS} rings (got ${maxRadius})`);
  }
}
{
  // 🎆 a 3-round pyro: erupt, re-arm (bigger), and the armed finale BLOWS as it ends
  let st = applyAction(onBoard, stageFxActivated("pyrotechnics", [7, 40], 3));
  const events = [];
  for (let i = 0; i < 3; i++) { st = roundEnd(st); const p = st.stageFx.lastTurnTick.pyro; events.push(p.event + (p.finale ? "!" : "")); }
  eq(events, ["erupted", "rearmed", "erupted!"], "pyro ×3: erupt → re-arm → finale erupts and clears (never fizzles armed)");
  st = applyAction(onBoard, stageFxActivated("pyrotechnics", [7, 40], 4));
  const ev4 = [];
  for (let i = 0; i < 4; i++) { st = roundEnd(st); ev4.push(st.stageFx.lastTurnTick.pyro.event); }
  eq(ev4, ["erupted", "rearmed", "erupted", "burnout"], "pyro ×4: a spent wave burns out at the end");
}

// ── §4 legacy replays still resolve the old way ─────────────────────────────
{
  const s0 = base("rounds", 10);
  const d = applyAction(s0, stageFxDrawn(8));
  eq(d.stageFx.lastDraw, { threshold: 8, fxId: s0.stageFx.deck[0] }, "legacy STAGE_FX_DRAWN {threshold} still draws");
  eq(applyAction(onBoard, stageFxActivated("smoke_machine")).stageFx.smoke.roundsLeft, SMOKE_ROUNDS, "legacy activation: smoke keeps its old length");
  eq(applyAction(onBoard, stageFxActivated("laser_show")).stageFx.laser.roundsLeft, LASER_ROUNDS, "legacy activation: lasers keep their old length");
  eq(applyAction(onBoard, stageFxActivated("animatronics", [7, 40])).stageFx.animatronics[0].turnsLeft, ANIMATRONIC_ROUNDS, "legacy activation: animatronics keep their old length");
  eq(applyAction(onBoard, stageFxActivated("pyrotechnics")).stageFx.pyro.roundsLeft, undefined, "legacy activation: pyro carries no clock (wave-count path)");
  eq(stageFxActivated("smoke_machine"), { type: "STAGE_FX_ACTIVATED", fxId: "smoke_machine", occupied: [] }, "legacy action shape unchanged");
}

// ── §5 a scheduled match replays byte-identically ───────────────────────────
{
  const log = [];
  for (let r = 1; r <= 15; r++) {
    log.push(stageFxScheduled(r));
    if (r === 7 || r === 12) log.push(stageFxActivated(null, [7, 40], r === 7 ? 3 : 4));
    log.push(stageFxRoundTicked(), stageFxTurnTicked());
  }
  // fill in the fxIds the live run draws
  let live = onBoard;
  const filled = [];
  for (const a of log) {
    const act = a.type === "STAGE_FX_ACTIVATED" ? { ...a, fxId: live.stageFx.lastDraw.fxId } : a;
    filled.push(act);
    live = applyAction(live, act);
  }
  eq(snapshot(replay(restore(snapshot(onBoard)), filled)), snapshot(live), "a 15-round scheduled show replays byte-identically");
  eq(live.stageFx.fired, [7, 12], "15 rounds: fired on 7 and 12");
}

// ── §6 the CLIENT asks the schedule on the round clock, and only there ───────
{
  const client = readFileSync(new URL("../rlsw-simulator-v3_8_1.jsx", import.meta.url), "utf8");
  ok(!/stageFxThresholds|checkStageFxThresholds/.test(client), "client: the Fame-threshold trigger is gone");
  ok(!/stageFxDrawn\(/.test(client), "client: nothing dispatches the legacy threshold draw");
  const calls = client.match(/checkStageFxSchedule\(/g) ?? [];
  eq(calls.length, 2, "client: checkStageFxSchedule is defined once and called once");
  const block = client.indexOf("if (report.roundCompleted) {");
  const tick = client.indexOf("tickStageFxTurn();", block);
  const ask = client.indexOf("checkStageFxSchedule(engineRef.current.turn?.round)", block);
  ok(block > 0 && tick > block && ask > tick, "client: the schedule is asked in the roundCompleted block, AFTER the ticks");
  ok(/fameBanked:\s*\(e\)/.test(client), "client: the renamed fameBanked hook is handled (first-Fame tip survives)");
  const flow = readFileSync(new URL("./systems/battleFlow.js", import.meta.url), "utf8");
  ok(/hook\('fameBanked'/.test(flow) && !/hook\('stageFxThresholds'/.test(flow), "battleFlow: yields fameBanked, not stageFxThresholds");
}

console.log(`✅ stageFxScheduleCheck: ${n} assertions passed`);
