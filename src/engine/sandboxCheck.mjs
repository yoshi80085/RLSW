// ─── 🧪 TESTING GROUNDS SANDBOX CHECK ────────────────────────────────────────
// Run: `npm run test:sandbox`
//
// Covers the 2026-09-24 revival of the Testing Grounds (Alex: "take any player
// and drop them anywhere on the arena and use any move at any time"):
//
//   §1  🎮 PLAY AS   — SANDBOX_SEAT_TAKEN rotates the ring, never reorders it,
//                     and is NOT a turn ending (no count, no round, no ticks).
//   §2  🆓 FREE PLAY — SANDBOX_REFILLED tops up AP, token, cooldowns, Db and the
//                     full kit; only ever UP; a no-op when nothing is short.
//   §3  ⭐ the refill makes a REAL gate pass — `canFire` refuses, then allows.
//   §4  📼 replay — a sandbox action log replays to the identical state, which
//                     is the whole reason these are engine actions at all.
//   §5  🔌 the client wiring that a headless suite can see only as SOURCE:
//       testMode gating, the drop owning the hex click, all-human seats.
//
// ⚠️ §5 reads source text on purpose (the `bushidoCheck` pattern): the monolith
// cannot be imported headless, and "the flag is gated on testMode" is exactly
// the kind of line a refactor drops without any other suite noticing — and a
// free-play refill that leaked online would be a desync on every click.

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import { sandboxSeatTaken, sandboxRefilled, beatsSpent, turnEnded } from "./actions.js";
import {
  SANDBOX_AP, applySandboxSeatTaken, applySandboxRefilled, sandboxNeedsRefill,
} from "./systems/sandbox.js";
import { canFire, firePatch, ABILITY_CD, dbCostOf } from "./systems/cooldowns.js";
import { abilitiesFor } from "../data/loadouts.js";
import { CORNERS } from "../data/corners.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const ok = (cond, msg) => { checks++; assert.ok(cond, msg); console.log(`  ✓ ${msg}`); };
const eq = (a, b, msg) => { checks++; assert.deepStrictEqual(a, b, msg); console.log(`  ✓ ${msg}`); };

const RONIN = "cosmic_ronin", ZERO = "intergalactic_0", METAL = "Metalness_Monster";
const CONFIG = {
  mode: "ffa", startingLives: 3, testMode: true,
  spirits: [
    { id: RONIN, name: "Shredding Ronin",   corner: "blue",   num: CORNERS.blue.homeNum,   vibe: 15, maxVibe: 15, knockedOut: false, facing: 0 },
    { id: ZERO,  name: "Intergalactic 0",   corner: "purple", num: CORNERS.purple.homeNum, vibe: 12, maxVibe: 12, knockedOut: false, facing: 0 },
    { id: METAL, name: "Metalness Monster", corner: "yellow", num: CORNERS.yellow.homeNum, vibe: 15, maxVibe: 15, knockedOut: false, facing: 0 },
  ],
};
const fresh = () => makeInitialState(structuredClone(CONFIG), 4242);

// ── §1 PLAY AS ────────────────────────────────────────────────────────────────
console.log("\n§1 🎮 play as — a rotation, not a turn ending");
{
  const s0 = fresh();
  const q0 = [...s0.turnQueue];
  ok(s0.acting === q0[0], "a fresh match acts from the front of the queue");
  // ⚠️ The MIDDLE seat, on purpose: with three Spirits, taking the LAST one
  // gives the same queue whether you rotate or just move it to the front — a
  // mutant that did the latter survived this suite's first draft.
  const target = q0[1];
  const s1 = applyAction(s0, sandboxSeatTaken(target));
  eq(s1.acting, target, "the chosen Spirit is now acting");
  eq(s1.turnQueue, [q0[1], q0[2], q0[0]], "the queue is ROTATED — everyone keeps their place in the ring");
  eq(s1.turn.count, s0.turn.count, "no turn was counted");
  eq(s1.turn.round, s0.turn.round, "the round clock did not move");
  eq(s1.turn.moveStepsLeft, 0, "the incoming Spirit starts with no inherited AP");
  eq(s1.turn.actionTokenUsed, false, "and an unspent action token");
  const s2 = applyAction(s1, turnEnded());
  eq(s2.acting, q0[2], "End Turn afterwards passes to whoever really follows them in the ring");
  ok(applySandboxSeatTaken(s1, { spiritId: target }) === s1, "taking the seat you already hold is a no-op (identity)");
  ok(applySandboxSeatTaken(s0, { spiritId: "nobody" }) === s0, "an unknown Spirit is refused (identity)");
  const out = { ...s0, turnQueue: s0.turnQueue.filter(id => id !== METAL) };
  ok(applySandboxSeatTaken(out, { spiritId: METAL }) === out, "a Spirit out of the queue is refused — the sandbox never resurrects");
}

// ── §2 FREE PLAY ──────────────────────────────────────────────────────────────
console.log("\n§2 🆓 free play — the refill");
const spent = () => {
  let s = fresh();
  const id = s.acting;
  s = applyAction(s, beatsSpent(0, true));             // token spent, AP already 0
  const ns = s.noteStates[id];
  const kit = abilitiesFor(s.spirits.find(x => x.id === id)).map(k => k.id);
  s = { ...s, noteStates: { ...s.noteStates, [id]: {
    ...ns, dbPoints: 0, unlockedSkills: kit.slice(0, 1),
    abilityCd: Object.fromEntries(kit.map(k => [k, 2])),
  } } };
  return { s, id, kit };
};
{
  const { s, id, kit } = spent();
  ok(sandboxNeedsRefill(s, id), "a spent Spirit needs a refill");
  const r = applyAction(s, sandboxRefilled(id));
  const ns = r.noteStates[id];
  eq(r.turn.moveStepsLeft, SANDBOX_AP, `AP is topped up to ${SANDBOX_AP}`);
  eq(r.turn.actionTokenUsed, false, "the action token is handed back");
  ok(kit.every(k => ns.unlockedSkills.includes(k)), `the FULL kit is unlocked (${kit.length} abilities, not the 2-slot loadout)`);
  ok(Object.values(ns.abilityCd).every(v => v === 0), "every cooldown is cleared");
  const dearest = Math.max(...kit.filter(k => ABILITY_CD[k]).map(dbCostOf));
  ok(ns.dbPoints >= dearest, `Db covers the dearest ability in the kit (${dearest})`);
  ok(!sandboxNeedsRefill(r, id), "once full, it needs nothing");
  ok(applySandboxRefilled(r, { spiritId: id }) === r, "and a second refill is a no-op (identity) — an idle board logs nothing");

  // only ever UP
  const rich = { ...r, turn: { ...r.turn, moveStepsLeft: 15 },
    noteStates: { ...r.noteStates, [id]: { ...r.noteStates[id], dbPoints: 40 } } };
  const rich2 = applySandboxRefilled({ ...rich, turn: { ...rich.turn, actionTokenUsed: true } }, { spiritId: id });
  eq(rich2.turn.moveStepsLeft, 15, "a refill never LOWERS AP a lever raised");
  eq(rich2.noteStates[id].dbPoints, 40, "…nor Db");
  const other = r.acting === RONIN ? ZERO : RONIN;
  const r2 = applyAction(s, sandboxRefilled(id));
  eq(r2.noteStates[other], s.noteStates[other], "only the named Spirit's sheet is touched");
}

// ── §3 A REAL GATE ────────────────────────────────────────────────────────────
console.log("\n§3 ⭐ refill, not bypass — the real gate passes");
{
  const { s, id, kit } = spent();
  const skill = kit.find(k => ABILITY_CD[k]);
  ok(!canFire(s.noteStates[id], skill), `before: canFire refuses ${skill} (locked / cooling / broke)`);
  let r = applyAction(s, sandboxRefilled(id));
  ok(canFire(r.noteStates[id], skill), `after: canFire allows ${skill}`);
  // pay for it the way the client does, then refill again
  const paid = { ...r.noteStates[id], ...firePatch(r.noteStates[id], skill) };
  r = { ...r, noteStates: { ...r.noteStates, [id]: paid } };
  ok(!canFire(r.noteStates[id], skill), "firing it paid the real price — it is cooling again");
  r = applyAction(r, sandboxRefilled(id));
  ok(canFire(r.noteStates[id], skill), "and free play hands it straight back");
}

// ── §4 REPLAY ─────────────────────────────────────────────────────────────────
console.log("\n§4 📼 a sandbox log replays byte-for-byte");
{
  const log = [];
  let live = fresh();
  const d = a => { log.push(a); live = applyAction(live, a); };
  d(sandboxRefilled(live.acting));
  d(beatsSpent(3, true));
  d(sandboxRefilled(live.acting));
  d(sandboxSeatTaken(live.turnQueue[1]));
  d(sandboxRefilled(live.acting));
  d(turnEnded());
  let replay = fresh();
  for (const a of log) replay = applyAction(replay, JSON.parse(JSON.stringify(a)));
  eq(JSON.stringify(replay), JSON.stringify(live), `${log.length} actions replay to the identical state`);
}

// ── §5 CLIENT WIRING (source) ────────────────────────────────────────────────
console.log("\n§5 🔌 the client wiring");
{
  const mono = readFileSync(join(SRC, "rlsw-simulator-v3_8_1.jsx"), "utf8");
  ok(/useState\(\(\) => testMode && !!gameState\.freePlay\)/.test(mono),
    "free play can only start ON inside testMode (testMode is hard-off online)");
  ok(/if \(!testMode \|\| !devFreePlay \|\| !acting \|\| winner \|\| battleState\) return;\s*\n\s*if \(!sandboxNeedsRefill\(/.test(mono),
    "the refill effect is gated on testMode, holds during a battle, and asks before it dispatches");
  const click = mono.slice(mono.indexOf("function onHexClick(num) {"));
  const dropAt = click.indexOf("if (testMode && devPlaceId) { devPlaceAt(num); return; }");
  const gateAt = click.indexOf("if (!acting || !canAct) return;");
  ok(dropAt > 0 && dropAt < gateAt, "a pending drop owns the hex click BEFORE the acting-Spirit gate (it places ANY Spirit)");
  ok(/dispatch\(spiritWarped\(who\.id, num, 0\)\)/.test(mono), "a drop is SPIRIT_WARPED at cost 0 — a pure position write");
  ok(/dispatch\(sandboxSeatTaken\(spiritId\)\);\s*\n\s*startNewTurnNotes\(spiritId\);/.test(mono),
    "play-as runs the normal turn START for the incoming Spirit");

  const setup = readFileSync(join(SRC, "data", "matchSetup.js"), "utf8");
  ok(/seatSpirit\(SPIRIT_DEFS\[ids\[i % ids\.length\]\], corner, \{ cpu: false \}\)/.test(setup),
    "every Testing Grounds seat is human — no bot moves the board between tests");
  ok(/freePlay = false/.test(setup), "freePlay defaults OFF, so the journey suites drive real turns");
  const app = readFileSync(join(SRC, "app", "RLSWSimulator.jsx"), "utf8");
  const lobby = readFileSync(join(SRC, "ui", "Lobby.jsx"), "utf8");
  ok(/buildTestingGroundsConfig\(\{ freePlay: true \}\)/.test(app), "the title-menu launch starts with free play ON");
  ok(/buildTestingGroundsConfig\(\{beginnerMode,freePlay:true\}\)/.test(lobby), "…and so does the lobby's button");
}

console.log(`\n✅ sandboxCheck: ${checks}/${checks} checks passed`);
