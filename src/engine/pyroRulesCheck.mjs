// ─── 🎆 PYRO v2 RULES CHECK (Alex, 2026-10-02) ───────────────────────────────
// "Once the Stage effect triggers, the mortars arm — they fire under 2
// conditions: 1. end of a player's turn … coming back before the start of the
// next player's turn, or 2. if a player gets pushed into it — doesn't matter if
// the push would have pushed the Spirit past the mortar — it stops on the
// mortar and takes damage. 1st round about 5 mortars, 2nd 10 or so, 3rd 13."
// Damage: "like 3 or so".
//
// Pins: the versioned activation (and that an old log keeps the old rules), the
// fire → re-arm turn cadence, the round sizes, the show clock and its clean
// ending, the shove that stops on a charge (in the ENGINE's knockback), and —
// reading the CLIENT (§B2) — that the game actually dispatches every beat.
// Run: npm run test:pyrorules

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import { makeRng } from "./rng.js";
import {
  stageFxActivated, stageFxTurnTicked, pyroTurnEnded, pyroTurnStarted, pyroChargeStruck,
} from "./actions.js";
import { isArmedPyroHex } from "./systems/stageFx.js";
import { knockback, runBattleFlow } from "./systems/battleFlow.js";
import { replay } from "./serialize.js";
import {
  PYRO_VERSION, PYRO_ROUND_HEXES, PYRO_DAMAGE, PYRO_WAVE_HEXES,
} from "../data/stageEffects.js";
import { HEX_BY_NUM } from "../board/hexMap.js";
import { straightNeighborInDirection } from "../board/hexGeometry.js";

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); n++; };

const base = (seed = 77, nums = [7, 105]) => makeInitialState({
  spirits: [
    { id: "wildaxe", name: "Wildaxe", num: nums[0], facing: 2, corner: "blue", color: "#4aa3ff", cpu: false, vibe: 12, maxVibe: 12, lives: 3 },
    { id: "vera",    name: "Vera",    num: nums[1], facing: 5, corner: "red", color: "#ff4a6a", cpu: true, vibe: 12, maxVibe: 12, lives: 3 },
  ],
  mode: "ffa", teams: null, startingLives: 3, beginnerMode: true, winCondition: "rounds", roundLimit: 15,
}, seed);
const V2 = { pyroVersion: PYRO_VERSION };
const arm = (st, rounds = 3, occupied = []) => applyAction(st, stageFxActivated("pyrotechnics", occupied, rounds, V2));
const at = (st, id, num) => ({ ...st, spirits: st.spirits.map(s => s.id === id ? { ...s, num } : s) });
const pyro = st => st.stageFx.pyro;
const report = st => st.stageFx.lastPyro;
// One player's turn boundary, the order the client runs it in: the volley at
// END TURN, then (only at a round boundary) the round clock, then the re-arm.
const turnBoundary = (st, roundEnds = false) => {
  st = applyAction(st, pyroTurnEnded());
  const fired = report(st);
  if (roundEnds) st = applyAction(st, stageFxTurnTicked());
  st = applyAction(st, pyroTurnStarted([]));
  return { st, fired, armed: report(st) };
};

// ── §1 the numbers Alex gave ─────────────────────────────────────────────────
eq(PYRO_DAMAGE, 3, "a pyro hit is 3 Vibe (\"like 3 or so\")");
eq(PYRO_ROUND_HEXES, [5, 10, 13], "about 5 → 10 → 13 mortars, one size per show round");

// ── §2 versioned: the activation opts in, an old log does not ────────────────
{
  const s0 = base();
  const st = arm(s0);
  eq(pyro(st).v, PYRO_VERSION, "a v2 activation is marked v2");
  eq(pyro(st).phase, "armed", "the mortars arm at once");
  eq(pyro(st).hexes.length, PYRO_ROUND_HEXES[0], "round 1 arms 5");
  eq(report(st), { event: "armed", wave: 1, hexes: pyro(st).hexes }, "the activation reports the first set");
  ok(!pyro(st).hexes.some(h => [7, 105].includes(h)), "nothing primes under a Spirit");
  const legacy = applyAction(s0, stageFxActivated("pyrotechnics", [], 3));
  eq(legacy.stageFx.pyro.phase, "arming", "no pyroVersion → the old round-clock rules");
  eq(legacy.stageFx.pyro.hexes.length, PYRO_WAVE_HEXES[0], "…with the old wave size");
  ok(legacy.stageFx.pyro.v == null, "…and no v2 marker");
  eq(stageFxActivated("pyrotechnics", [], 3), { type: "STAGE_FX_ACTIVATED", fxId: "pyrotechnics", occupied: [], rounds: 3 },
    "the action creator adds nothing unless asked (old logs compare equal)");
  eq(stageFxActivated("smoke_machine", [], 3, V2).pyroVersion, undefined, "pyroVersion only rides a pyro activation");
  // the legacy engine ignores the v2 actions entirely
  const l2 = applyAction(applyAction(applyAction(legacy, pyroTurnEnded()), pyroTurnStarted()), pyroChargeStruck("vera", legacy.stageFx.pyro.hexes[0]));
  eq(l2.stageFx.pyro, legacy.stageFx.pyro, "v2 actions are no-ops on a legacy show");
}

// ── §3 the turn cadence: fire at END TURN, re-arm before the next turn ───────
{
  let st = arm(base());
  const first = pyro(st).hexes;
  st = at(st, "vera", first[0]);            // she walked onto a glowing hex…
  eq(pyro(st).phase, "armed", "…and walking on does nothing by itself");
  st = applyAction(st, pyroTurnEnded());
  eq(report(st), { event: "fired", wave: 1, hexes: first, caught: ["vera"] }, "END TURN: every armed charge fires; she is caught");
  eq(pyro(st).phase, "spent", "the set is spent");
  eq(pyro(st).hexes, [], "no charge is armed between the volley and the re-arm");
  ok(!isArmedPyroHex(st, first[1]), "a spent hex is not armed");
  const twice = applyAction(st, pyroTurnEnded());
  eq(report(twice), null, "a second END TURN on a spent set fires nothing");
  st = applyAction(st, pyroTurnStarted([]));
  eq(pyro(st).phase, "armed", "the next turn starts on a fresh set");
  eq(pyro(st).wave, 2, "wave 2");
  eq(pyro(st).hexes.length, PYRO_ROUND_HEXES[0], "still round 1: still 5");
  ok(pyro(st).hexes.every(h => !first.includes(h)), "fresh charges avoid the set that just blew");
  ok(!pyro(st).hexes.includes(first[0]), "…and never re-prime under the Spirit standing there");
  eq(report(applyAction(st, pyroTurnStarted([]))), null, "re-arming an armed set does nothing");
}

// ── §4 the show clock: 5 → 10 → 13, and a clean end ──────────────────────────
for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
  const players = 2;
  let st = arm(base(seed));
  const sizes = [], fires = [];
  for (let round = 1; round <= 3; round++) {
    for (let t = 1; t <= players; t++) {
      sizes.push(pyro(st)?.hexes.length ?? 0);
      const b = turnBoundary(st, t === players);
      st = b.st; fires.push(b.fired?.event ?? null);
    }
  }
  eq(sizes, [5, 5, 10, 10, 13, 13], `seed ${seed}: the set grows by show round — 5, 10, 13`);
  eq(fires, Array(6).fill("fired"), `seed ${seed}: every turn of the show ends in a volley`);
  eq(st.stageFx.pyro, null, `seed ${seed}: the show ends with the third round`);
  eq(st.stageFx.lastTurnTick.pyro, { event: "burnout" }, `seed ${seed}: …and burns out (no armed charge left to fizzle)`);
}
{
  // a show that runs to the buzzer stays at the last size
  let st = arm(base(), 5);
  for (let r = 1; r <= 4; r++) st = turnBoundary(turnBoundary(st).st, true).st;
  eq(pyro(st).hexes.length, 13, "round 5 of a long show stays at 13");
  // ⚠️ an armed set at the show's end blows as the finale instead of vanishing
  let f = arm(base(), 1);
  f = at(f, "wildaxe", pyro(f).hexes[2]);
  f = applyAction(f, stageFxTurnTicked());
  eq(f.stageFx.lastTurnTick.pyro.event, "erupted", "an armed set at the end of the show erupts as the finale");
  eq(f.stageFx.lastTurnTick.pyro.caught, ["wildaxe"], "…and catches whoever stands on it");
  eq(f.stageFx.pyro, null, "…and the show is over");
  // the Testing Grounds (no schedule) still gets a 3-round show
  eq(applyAction(base(), stageFxActivated("pyrotechnics", [], undefined, V2)).stageFx.pyro.roundsLeft, 3,
    "an unscheduled v2 show lasts the three rounds Alex described");
}

// ── §5 a shove onto a charge ─────────────────────────────────────────────────
{
  let st = arm(base());
  const h = pyro(st).hexes[3];
  st = applyAction(st, pyroChargeStruck("vera", h));
  eq(report(st), { event: "struck", wave: 1, hexNum: h, spiritId: "vera" }, "a struck charge reports who and where");
  ok(!pyro(st).hexes.includes(h), "the struck charge is spent");
  eq(pyro(st).hexes.length, PYRO_ROUND_HEXES[0] - 1, "the rest stay armed");
  eq(report(applyAction(st, pyroChargeStruck("vera", h))), null, "a spent charge cannot be struck twice");
  st = applyAction(st, pyroTurnEnded());
  ok(!report(st).hexes.includes(h), "the struck charge does not fire again at END TURN");
  st = applyAction(st, pyroTurnStarted([]));
  ok(!pyro(st).hexes.includes(h), "the re-arm never drops a charge straight back under the launched Spirit");
}

// ── §6 the ENGINE's knockback stops on an armed charge ───────────────────────
// A straight lane: attacker → target → a → b → c. The charge sits on `b`.
{
  const DIR = 0;
  const lane = [HEX_BY_NUM[56]];
  for (let i = 0; i < 5; i++) lane.push(straightNeighborInDirection(lane[lane.length - 1], DIR));
  ok(lane.every(Boolean), "the fixture lane fits on the board");
  const setup = (charge) => {
    let st = base(9, [lane[0].num, lane[1].num]);
    st = arm(st);
    // place the charges where the test wants them (still a v2 armed set)
    st = { ...st, stageFx: { ...st.stageFx, pyro: { ...pyro(st), hexes: charge } } };
    return st;
  };
  const shove = (st, spaces) => {
    const hazards = [];
    const rng = makeRng(3);
    const out = runBattleFlow(knockback({ state: st, fromId: "wildaxe", targetId: "vera", spaces, direction: DIR }), st, {
      applyAction: (s, a) => applyAction(s, a, rng),
      hooks: { hexHazards: (live, e) => { hazards.push(e); return live; } },
    });
    return { out, hazards, vera: out.state.spirits.find(s => s.id === "vera") };
  };
  const hit = shove(setup([lane[3].num]), 4);
  eq(hit.vera.num, lane[3].num, "a 4-hex shove STOPS on the armed mortar two hexes in");
  eq(hit.out.result.stoppedOnPyro, lane[3].num, "…and says why it stopped");
  eq(hit.out.result.path, [lane[2].num, lane[3].num], "…having entered only the hexes before it");
  { const e = hit.hazards.at(-1); eq({ spiritId: e.spiritId, hexNum: e.hexNum, pyroStruck: e.pyroStruck }, { spiritId: "vera", hexNum: lane[3].num, pyroStruck: true }, "the client's hazard hook is told it was a pyro strike"); }
  eq(hit.out.state.stageFx.lastPyro?.event, "struck", "the engine spent that charge");
  ok(!hit.out.state.stageFx.pyro.hexes.includes(lane[3].num), "…so it is no longer armed");
  const exact = shove(setup([lane[3].num]), 2);
  eq(exact.vera.num, lane[3].num, "a shove that would have ended ON the mortar lands there and fires it");
  eq(exact.out.state.stageFx.lastPyro?.event, "struck", "…and strikes it");
  const past = shove(setup([lane[5].num]), 2);
  eq(past.vera.num, lane[3].num, "a mortar beyond the shove's reach does nothing");
  ok(past.hazards.every(e => !e.pyroStruck), "…and no strike is reported");
  const legacy = (() => {
    let st = base(9, [lane[0].num, lane[1].num]);
    st = applyAction(st, stageFxActivated("pyrotechnics", [], 3));
    st = { ...st, stageFx: { ...st.stageFx, pyro: { ...pyro(st), hexes: [lane[3].num] } } };
    return shove(st, 4);
  })();
  eq(legacy.vera.num, lane[5].num, "an OLD-rules (replay) show still lets the shove slide over an arming hex");
}

// ── §7 deterministic: a replayed log lands on the same mortars ───────────────
{
  const s0 = base(31);
  const actions = [stageFxActivated("pyrotechnics", [], 3, V2), pyroTurnEnded(), pyroTurnStarted([]), pyroTurnEnded(), stageFxTurnTicked(), pyroTurnStarted([])];
  let live = s0; for (const a of actions) live = applyAction(live, a);
  const again = replay(s0, actions);
  eq(again.stageFx.pyro, live.stageFx.pyro, "replaying the log re-rolls the same hexes");
  eq(live.stageFx.pyro.hexes.length, 10, "…and round 2's set is the bigger one");
}

// ── §8 the CLIENT runs these rules (§B2 — a passing engine test is not a game) ─
{
  const src = readFileSync(new URL("../rlsw-simulator-v3_8_1.jsx", import.meta.url), "utf8");
  ok(/stageFxActivated\(fxId, occupied, rounds, \{ pyroVersion: PYRO_VERSION \}\)/.test(src), "the live game activates pyro on the v2 rules");
  const endTurn = src.indexOf("firePyroVolley();"), round = src.indexOf("if (report.roundCompleted) {", endTurn), rearm = src.indexOf("rearmPyro();", round);
  ok(endTurn > 0, "END TURN fires the volley");
  ok(round > endTurn && round - endTurn < 400, "…on every turn end, just before the round block (not inside it)");
  ok(rearm > round, "the re-arm runs after the round clock, so a finished show stays down");
  ok(src.includes("checkStageFxHex(e.spiritId, e.hexNum, { pyroStruck: !!e.pyroStruck })"), "the engine's knockback hook delivers the strike to the client's hazard check");
  const stops = src.match(/strikePyroCharge\(/g)?.length ?? 0;
  eq(stops, 4, "every client push site asks about a mortar: the definition, battleKnockback, the one-hex push, the TV scatter");
  ok(/if \(onMortar && strikePyroCharge\(targetId, nextHex\.num\)\) return;/.test(src), "battleKnockback ENDS its slide on a struck mortar");
  ok(src.includes("applyVibeDamage(id, PYRO_DAMAGE, 'Pyrotechnics')"), "a pyro hit costs PYRO_DAMAGE Vibe");
}

console.log(`✅ pyroRulesCheck: ${n} assertions passed`);
