// ─── 🌀 THE WELLSPRING CHECK ─────────────────────────────────────────────────
// `npm run test:wellspring`. Pins `engine/systems/wellspring.js` — the centre
// hex's per-Spirit tap — and every place the AP ceiling is read.
//
// Alex, 2026-10-16: *"normal characters, including him will start with the 4 AP
// - he can get the 5th for 2 following turns if he steps onto the spot during his
// turn"*. So: everyone is 4; the Ronin stepping onto the centre on HIS turn makes
// his next two turns 5-AP turns; stepping on again refreshes, never stacks.
//
// ⚠️ The ceiling is read in six places (kernel, legal actions, play finder,
// evaluator, client label, Spirit sheet). §7 reads the CLIENT source, because a
// +1 that reaches the HUD and not the grant (or the reverse) is exactly the
// drift `apCeilingFor` exists to stop — and only the client can show it.

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import { turnStarted, turnEnded, moveStep, spiritWarped, shukuchiHopped } from "./actions.js";
import { makeRng } from "./rng.js";
import { assertJsonSafe } from "./serialize.js";
import { legalActions } from "./policies/legalActions.js";
import { commitMelodyEconomy } from "./systems/melodyCommit.js";
import {
  WELL_HEX, BASE_AP, WELL_TAPS, apCeilingFor, isWellLive, wellChargeOf, wellTapFor,
} from "./systems/wellspring.js";
import { SPIRIT_DEFS } from "../data/spirits.js";
import { LIMELIGHT_HEX } from "../data/gameConstants.js";
import { HEX_BY_NUM, HEX_BY_QR } from "../board/hexMap.js";
import { CORNERS } from "../data/corners.js";

let count = 0;
const ok = (c, m) => { count++; assert.ok(c, m); };
const eq = (a, b, m) => { count++; assert.deepStrictEqual(a, b, m); };

const RONIN = 'cosmic_ronin', METAL = 'Metalness_Monster';

// Hex geometry round the centre: a neighbour, the hex past it on the same line,
// and the neighbour opposite (so a 2-hop from one side to the other sails OVER it).
const hub = HEX_BY_NUM[WELL_HEX];
const at = (dq, dr) => HEX_BY_QR[`${hub.q + dq},${hub.r + dr}`]?.num;
const NEAR = at(1, 0), FAR = at(2, 0), OPPOSITE = at(-1, 0), SIDE = at(0, 1);
ok(NEAR && FAR && OPPOSITE && SIDE, 'the centre has the neighbours this suite walks through');

// ⚠️ NO `speed` ON THE FIXTURE SPIRITS: the roster's number is what is under test.
const CONFIG = {
  mode: 'ffa', startingLives: 3,
  spirits: [
    { id: RONIN, name: 'Ronin',     corner: 'blue',   num: NEAR, vibe: 5, maxVibe: 5, knockedOut: false, facing: 0 },
    { id: METAL, name: 'Metalness', corner: 'yellow', num: CORNERS.yellow.homeNum, vibe: 5, maxVibe: 5, knockedOut: false, facing: 0 },
  ],
};
const fresh = () => {
  const st = makeInitialState(structuredClone(CONFIG), 9);
  return { ...st, acting: RONIN, turn: { ...st.turn, moveStepsLeft: 4 } };
};
const apply = (st, a) => applyAction(st, a, makeRng(3));
const step = (st, id, to) => apply(st, moveStep(id, to, false));
const numOf = (st, id) => st.spirits.find(s => s.id === id).num;
/** End the acting Spirit's turn and start `next`'s — the client's order. */
const handTo = (st, next) => apply({ ...apply(st, turnEnded()), acting: next }, turnStarted(next));
/** A full revolution back to the Ronin: his turn ends, Metal plays (nothing), his starts. */
const round = st => handTo(handTo(st, METAL), RONIN);
const withTrack = (st, track) => ({ ...st, noteStates: { ...st.noteStates, [RONIN]: { ...st.noteStates[RONIN],
  melodyLine: track, rootNote: 'C', scaleMode: 'major', paletteMode: 'major', hasConfirmed: false,
  driveStack: [], sustainStack: [], bankedNote: null } } });

// ═════════════════════════════════════════════════════════════════════════════
// 1. EVERYONE STARTS AT 4.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(BASE_AP, 4, 'the base AP is 4');
  for (const [id, def] of Object.entries(SPIRIT_DEFS)) eq(def.speed, BASE_AP, `${id} starts with ${BASE_AP} AP`);
  eq(WELL_HEX, LIMELIGHT_HEX, 'the Wellspring IS the centre hex (shared with the Limelight)');
  const st = fresh();
  eq(apCeilingFor(st, RONIN), 4, 'the Ronin\'s ceiling is 4 with no tap');
  eq(apCeilingFor(st, METAL), 4, 'Metal\'s ceiling is 4');
  eq(wellTapFor(RONIN), WELL_TAPS.cosmic_ronin, 'the Ronin has a tap');
  eq(wellTapFor(`${RONIN}::blue`), WELL_TAPS.cosmic_ronin, 'a SEAT id resolves to its character\'s tap');
  eq(wellTapFor(METAL), null, 'nobody else has one yet');
  eq(WELL_TAPS.cosmic_ronin.amount, 1, 'his tap is +1 AP');
  eq(WELL_TAPS.cosmic_ronin.turns, 2, '…for 2 following turns');
  eq(st.well, { charge: {}, live: {}, lastTap: null }, 'a new match starts with an empty well');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE TAP — on his turn, onto the centre: charged, NOT live this turn.
// ═════════════════════════════════════════════════════════════════════════════
let tapped;
{
  tapped = step(fresh(), RONIN, WELL_HEX);
  eq(numOf(tapped, RONIN), WELL_HEX, 'he is on the centre');
  eq(wellChargeOf(tapped, RONIN), 2, 'stepping on charges 2 following turns');
  eq(isWellLive(tapped, RONIN), false, 'the turn he taps is not itself boosted');
  eq(apCeilingFor(tapped, RONIN), 4, '…so this turn is still 4');
  const r = tapped.well.lastTap;
  eq([r.spiritId, r.kind, r.amount, r.turns, r.seq], [RONIN, 'ap', 1, 2, 1], 'the tap leaves a report for the client');
  assertJsonSafe(tapped); ok(true, 'the slice is plain JSON');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. THE TWO FOLLOWING TURNS — 5, 5, then back to 4.
// ═════════════════════════════════════════════════════════════════════════════
{
  const off = step(tapped, RONIN, SIDE);   // walk off: leaving does not cancel anything
  eq(wellChargeOf(off, RONIN), 2, 'walking off keeps the charge');

  const t1 = round(off);
  eq(isWellLive(t1, RONIN), true, 'turn +1 is live');
  eq(apCeilingFor(t1, RONIN), 5, 'turn +1: the 5th AP');
  eq(wellChargeOf(t1, RONIN), 1, 'one turn of charge left');
  eq(apCeilingFor(t1, METAL), 4, 'nobody else is touched');

  const between = apply(t1, turnEnded());
  eq(isWellLive(between, RONIN), false, 'between his turns the tap reads off (the sheet, the evaluator)');

  const t2 = round(t1);
  eq(apCeilingFor(t2, RONIN), 5, 'turn +2: the 5th AP');
  eq(wellChargeOf(t2, RONIN), 0, 'the charge is spent');

  const t3 = round(t2);
  eq(isWellLive(t3, RONIN), false, 'turn +3 is dark');
  eq(apCeilingFor(t3, RONIN), 4, 'turn +3: back to 4');

  // ⭐ THE GRANT, not just the reader: the kernel buys 5 hexes on a live turn.
  const seven = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  eq(commitMelodyEconomy(withTrack(t1, seven), RONIN, {}).hexes, 5, 'a live turn: 7 notes buy 5 hexes');
  eq(commitMelodyEconomy(withTrack(t3, seven), RONIN, {}).hexes, 4, 'a dark turn: 7 notes buy 4');
  eq(commitMelodyEconomy(withTrack(t1, ['C', 'E', 'G']), RONIN, {}).hexes, 3, 'the tap raises the CEILING; 3 notes still buy 3');
  const conf = st => legalActions(withTrack(st, seven), RONIN).find(a => a.kind === 'confirmMelody');
  eq(conf(t1)?.apGranted, 5, 'legalActions prices the commit at 5 on a live turn');
  eq(conf(t3)?.apGranted, 4, '…and at 4 on a dark one');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. REFRESH, NEVER STACK.
// ═════════════════════════════════════════════════════════════════════════════
{
  const t1 = round(step(tapped, RONIN, SIDE));            // live, charge 1
  const again = step(step(t1, RONIN, NEAR === numOf(t1, RONIN) ? FAR : NEAR), RONIN, WELL_HEX);
  eq(wellChargeOf(again, RONIN), 2, 'stepping on during a live turn refreshes the charge to 2');
  eq(apCeilingFor(again, RONIN), 5, 'the live turn stays 5, not 6');
  eq(again.well.lastTap.seq, 2, 'a second tap is a second report');
  const off = step(again, RONIN, SIDE), back = step(off, RONIN, WELL_HEX);
  eq(wellChargeOf(back, RONIN), 2, 'tapping twice in one turn is still 2 turns, not 4');
  eq(back.well.lastTap.seq, 3, '…though each arrival is reported');
  const n1 = round(back), n2 = round(n1), n3 = round(n2);
  eq([apCeilingFor(n1, RONIN), apCeilingFor(n2, RONIN), apCeilingFor(n3, RONIN)], [5, 5, 4], 'after a refresh: 5, 5, then 4');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. WHAT IS NOT A TAP.
// ═════════════════════════════════════════════════════════════════════════════
{
  // ⚠️ "During his turn": moved onto it on someone else's turn (a shove, a warp).
  const rivalTurn = { ...fresh(), acting: METAL };
  const shoved = apply(rivalTurn, spiritWarped(RONIN, WELL_HEX, 0));
  eq(numOf(shoved, RONIN), WELL_HEX, 'he was put on the centre…');
  eq(wellChargeOf(shoved, RONIN), 0, '…on a rival\'s turn, which is not him tapping in');
  eq(shoved.well.lastTap, null, 'and nothing is reported');

  // Standing on it is not stepping onto it.
  const standing = { ...fresh(), spirits: fresh().spirits.map(s => s.id === RONIN ? { ...s, num: WELL_HEX } : s) };
  const started = apply(standing, turnStarted(RONIN));
  eq(wellChargeOf(started, RONIN), 0, 'starting a turn on the centre earns nothing');
  const left = step(started, RONIN, SIDE);
  eq(wellChargeOf(left, RONIN), 0, 'stepping OFF earns nothing');
  eq(wellChargeOf(step(left, RONIN, WELL_HEX), RONIN), 2, 'stepping back ON taps it');

  // A hop OVER the centre lands elsewhere.
  const hopper = { ...fresh(), spirits: fresh().spirits.map(s => s.id === RONIN ? { ...s, num: OPPOSITE } : s) };
  const over = apply(hopper, shukuchiHopped(RONIN, NEAR));
  eq(numOf(over, RONIN), NEAR, 'the hop landed past the centre');
  eq(wellChargeOf(over, RONIN), 0, 'sailing over the centre is not stepping onto it');
  // …and a hop that LANDS on it is.
  const onto = apply({ ...fresh(), spirits: fresh().spirits.map(s => s.id === RONIN ? { ...s, num: FAR } : s) }, shukuchiHopped(RONIN, WELL_HEX));
  eq(wellChargeOf(onto, RONIN), 2, 'a Shukuchi hop that lands on the centre taps it');

  // A Spirit with no tap lights it up and gets nothing.
  const metal = { ...fresh(), acting: METAL, spirits: fresh().spirits.map(s => s.id === METAL ? { ...s, num: SIDE } : s) };
  const mStep = step(metal, METAL, WELL_HEX);
  eq(wellChargeOf(mStep, METAL), 0, 'no tap, no charge');
  eq(mStep.well.lastTap?.kind, null, 'the arrival is still reported (the well stirs), with no gift');
  eq(apCeilingFor(round(mStep), METAL), 4, 'and Metal stays at 4');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. OLD STATES — a save from before the well still reads.
// ═════════════════════════════════════════════════════════════════════════════
{
  const { well, ...old } = fresh();
  ok(well, 'fresh states carry the slice');
  eq(apCeilingFor(old, RONIN), 4, 'no slice: the ceiling is the speed');
  const t = step(old, RONIN, WELL_HEX);
  eq(wellChargeOf(t, RONIN), 2, 'and a tap on an old state builds the slice');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. EVERY READER ASKS THE SAME FUNCTION (reads the CLIENT, CLAUDE.md).
// ═════════════════════════════════════════════════════════════════════════════
{
  const src = p => readFileSync(new URL(p, import.meta.url), 'utf8');
  const client = src('../rlsw-simulator-v3_8_1.jsx');
  ok(/const actingSpeed\s*=\s*acting \? apCeilingFor\(engineState, acting\.id, acting\)/.test(client), 'the client\'s commit label reads apCeilingFor');
  ok(/apCeiling: apCeilingFor\(engineState, s\.id, s\)/.test(client), 'the Spirit sheet is handed apCeilingFor');
  ok(!/Math\.min\(5, acting\?\.speed/.test(client), 'the old hand-rolled ceiling is gone from the client');
  ok(/apCeilingFor\(state, spiritId, spirit\)/.test(src('./systems/melodyCommit.js')), 'the kernel grants under apCeilingFor');
  ok(/apGranted: Math\.min\(track\.length, apCeilingFor\(/.test(src('./policies/legalActions.js')), 'legalActions prices under it');
  ok(/apCeilingFor\(state, spiritId\)/.test(src('./policies/evaluate.js')), 'the evaluator normalises by it');
  ok(/a\.apCeiling \?\?/.test(src('../ui/spiritSheetModel.js')), 'the sheet model shows the ceiling it is handed');
  ok(/collectWellTaps\(state, next\)/.test(src('./reduce.js')), 'applyAction runs the tap check after movement');
  ok(/wakeWell\(next, action\.spiritId\)/.test(src('./reduce.js')), '…and spends a turn of charge on TURN_STARTED');
}

console.log(`wellspringCheck: ${count} assertions passed`);
