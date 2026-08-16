// ─── TRANSITION CHECK ────────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/transitionCheck.mjs
//
// Coverage for `policies/transition.js` + `systems/attackParams.js` — the link
// between §6.1's branches and §5's scores.
//
// Three properties matter more than any individual rule here:
//
//   1. CLOSURE WITH `legalActions`. Anything that file emits, this file must
//      accept (or explicitly declare unmodelled). A drift between the two is a
//      bug in one of them, and it would surface as a bot that stalls mid-turn.
//   2. DETERMINISM ON A SEEDED STREAM. Same seed + same line ⇒ identical state.
//      This is §0.4's tripwire: a hypothetical that burns cursor draws desyncs
//      every replay and every online client, and it fails SILENTLY.
//   3. THE GAPS STAY DECLARED. `smash` must refuse as `unmodelled` rather than
//      limp along half-right. `confirmMelody` used to be the second half of this
//      property; since the economy landed it is the inverse — an EMPTY `partial`
//      is a claim that has to be backed by a payout on the sheet. A suite that
//      let either drift would be worse than no suite.

import assert from "node:assert";
import { makeRng } from "./rng.js";
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import { legalActions } from "./policies/legalActions.js";
import {
  applyBotAction, applyBotLine,
  MODELLED_KINDS, UNMODELLED_KINDS, PARTIAL_KINDS,
} from "./policies/transition.js";
import { attackParams, spiritChord, CHARGE_DIE_CEILING } from "./systems/attackParams.js";
import { ELEVEN_DRIVE } from "../data/gameConstants.js";
import { evaluate } from "./policies/evaluate.js";
import { SPIRIT_DEFS } from "../data/spirits.js";
import { CORNERS } from "../data/corners.js";
import {
  ATK_BONUS_CAP, CHARGE_FLOOR_BONUS, THRASH_DIE, THRASH_CEIL_DIE,
  SONIC_DEF_DIE, SONIC_DEF_DIE_OUT_OF_RIG, STACK_COMMIT_BUDGET,
} from "../data/gameConstants.js";
import { HEX_BY_NUM, HEX_BY_QR } from "../board/hexMap.js";
import { axialNeighbors, angleTo } from "../board/hexGeometry.js";

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.equal(a, b, m); checks++; };
const deep = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

const RONIN = 'cosmic_ronin', ZERO = 'intergalactic_0', METAL = 'Metalness_Monster';
const START = 45;   // interior, six real neighbours, not the Limelight

const CONFIG = {
  mode: 'ffa', startingLives: 3,
  spirits: [
    { id: RONIN, name: 'Ronin',     corner: 'blue',   num: START, vibe: 5, maxVibe: 5, knockedOut: false, facing: 0, drive: 8, sustain: 5 },
    { id: ZERO,  name: 'Zero',      corner: 'purple', num: CORNERS.purple.homeNum, vibe: 4, maxVibe: 4, knockedOut: false, facing: 0, drive: 6, sustain: 7 },
    { id: METAL, name: 'Metalness', corner: 'yellow', num: CORNERS.yellow.homeNum, vibe: 5, maxVibe: 5, knockedOut: false, facing: 0, drive: 7, sustain: 6 },
  ],
};

const baseState = (seed = 77) => {
  const st = makeInitialState(structuredClone(CONFIG), seed);
  return { ...st, acting: RONIN, turn: { ...st.turn, moveStepsLeft: 5, actionTokenUsed: false } };
};
const withNs = (st, id, patch) => ({ ...st, noteStates: { ...st.noteStates, [id]: { ...st.noteStates[id], ...patch } } });
const withSpirit = (st, id, patch) => ({ ...st, spirits: st.spirits.map(s => s.id === id ? { ...s, ...patch } : s) });
const confirmed = (st) => withNs(st, RONIN, { hasConfirmed: true });
const rngOf = (seed = 5) => makeRng(seed);

/** Stand METAL on a neighbour of the Ronin, Ronin facing it. */
const armed = (st) => {
  const here = HEX_BY_NUM[START];
  const nb = axialNeighbors(here.q, here.r).map(({ q, r }) => HEX_BY_QR[`${q},${r}`]).filter(Boolean)[0];
  return withSpirit(withSpirit(st, METAL, { num: nb.num }), RONIN, { facing: angleTo(here, nb) });
};

const ofKind = (acts, k) => acts.filter(a => a.kind === k);

// ═════════════════════════════════════════════════════════════════════════════
// 1. CLOSURE — everything `legalActions` emits, this file accepts or declares.
//    The two must not drift; a stall mid-turn is how that drift would present.
// ═════════════════════════════════════════════════════════════════════════════
{
  const states = [
    baseState(),
    confirmed(baseState()),
    armed(confirmed(baseState())),
    withNs(armed(confirmed(baseState())), RONIN, { driveStack: ['A', 'C', 'E'] }),
  ];
  const seen = new Set();
  for (const st of states) {
    for (const a of legalActions(st, RONIN)) {
      seen.add(a.kind);
      ok(MODELLED_KINDS.has(a.kind) || UNMODELLED_KINDS.has(a.kind),
         `legalActions emits '${a.kind}' — transition must model it or declare it`);
    }
  }
  ok(seen.size >= 6, `the fixture exercised a real spread of kinds (${[...seen].join(', ')})`);

  // And nothing is claimed that cannot be produced.
  for (const k of MODELLED_KINDS) {
    ok(!UNMODELLED_KINDS.has(k), `'${k}' is not claimed as both modelled and unmodelled`);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE DECLARED GAPS STAY DECLARED. A refusal must leave state untouched and
//    name WHICH kind of refusal it was — 'illegal' and 'unmodelled' are
//    different facts and a searcher should treat them differently.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = withNs(armed(confirmed(baseState())), RONIN, { driveStack: ['A'] });
  const smash = ofKind(legalActions(st, RONIN), 'smash')[0];
  ok(smash, 'the fixture really does offer a legal Smash');

  const r = applyBotAction(st, smash, { rng: rngOf() });
  eq(r.ok, false, '🎸 the Smash refuses');
  eq(r.reason, 'unmodelled', '...as UNMODELLED — the rules allow it, the engine cannot run it yet');
  eq(r.state, st, 'a refusal leaves the state object untouched, by identity');

  const bogus = applyBotAction(st, { kind: 'teleport' }, { rng: rngOf() });
  eq(bogus.reason, 'illegal', 'an invented kind is illegal, not unmodelled — a different fact');
  eq(applyBotAction(st, null, { rng: rngOf() }).reason, 'illegal', 'a null action does not throw');

  // ⚠️ confirmMelody used to declare an economy it SKIPPED. It no longer skips
  // one — `systems/melodyCommit.js` runs it — so the assertion inverts: the
  // absence of a `partial` list is now a CLAIM, and it has to be backed by the
  // economy visibly landing on the sheet. An empty declaration with no payout
  // behind it would be the worst of both.
  // ⚠️ The key is pinned. `makeInitialNoteState` seeds a RANDOM root and mode,
  // so an unpinned fixture can hand the Ronin a track that is entirely discord —
  // which earns 0 Db for a legitimate reason and would make this assertion flap.
  const track = withNs(baseState(), RONIN, {
    melodyLine: ['C', 'D', 'E', 'G'], rootNote: 'C', scaleMode: 'major',
    driveStack: [], sustainStack: [], discordUnlocks: [], unlockedSkills: [],
  });
  const conf = applyBotAction(track, { kind: 'confirmMelody' }, { rng: rngOf() });
  eq(conf.ok, true, 'confirmMelody runs');
  eq(conf.partial, undefined, '...and declares no gap');
  deep(PARTIAL_KINDS, {}, 'nothing in this file is partial any more');
  ok(conf.report, 'the economy report comes back for a searcher to read');
  ok((conf.state.noteStates[RONIN].totalDB ?? 0) > 0,
     '...and the Db it used to skip actually reaches the sheet — see melodyCommitCheck for the rest');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. §1's SPINE — the melody becomes the AP, capped by speed.
// ═════════════════════════════════════════════════════════════════════════════
{
  const speed = SPIRIT_DEFS[RONIN].speed;
  const short = withNs(baseState(), RONIN, { melodyLine: ['A', 'B'] });
  const long  = withNs(baseState(), RONIN, { melodyLine: Array(8).fill('A') });

  eq(applyBotAction(short, { kind: 'confirmMelody' }, { rng: rngOf() }).state.turn.moveStepsLeft, 2,
     'a 2-note melody buys 2 AP');
  eq(applyBotAction(long, { kind: 'confirmMelody' }, { rng: rngOf() }).state.turn.moveStepsLeft, speed,
     'a long melody is capped by speed — you cannot walk what you cannot carry');
  eq(applyBotAction(short, { kind: 'confirmMelody' }, { rng: rngOf() }).state.noteStates[RONIN].hasConfirmed, true,
     'confirming flips the phase');

  // 🦶 Tripped halves the grant (min 1) — inside the reducer, not re-derived.
  const tripped = withNs(short, RONIN, { tripped: true });
  eq(applyBotAction(tripped, { kind: 'confirmMelody' }, { rng: rngOf() }).state.turn.moveStepsLeft, 1,
     '🦶 tripped halves the AP grant, floored at 1');

  eq(applyBotAction(baseState(), { kind: 'confirmMelody' }, { rng: rngOf() }).ok, false,
     'an empty track cannot be confirmed');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. COMPOSITION SPENDS STOCK. A note goes to exactly one destination and the
//    slot is burned — the split IS the decision (§1).
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = baseState();
  const note = ofKind(legalActions(st, RONIN), 'melodyNote')[0];
  const after = applyBotAction(st, note, { rng: rngOf() }).state;
  eq(after.noteStates[RONIN].melodyLine.length, 1, 'the note lands in the melody');
  ok(after.noteStates[RONIN].usedStockIdx.includes(note.stockIdx), '...and the stock slot is spent');

  // That slot is now gone from BOTH families, not just the one it went to.
  const reoffered = legalActions(after, RONIN).filter(a =>
    (a.kind === 'melodyNote' || a.kind === 'stackCommit') && a.stockIdx === note.stockIdx);
  eq(reoffered.length, 0, 'a spent slot is never re-offered to either destination');

  const commit = ofKind(legalActions(st, RONIN), 'stackCommit').find(a => a.dest === 'drive');
  const afterC = applyBotAction(st, commit, { rng: rngOf() }).state;
  eq(afterC.noteStates[RONIN].driveStack.length, (st.noteStates[RONIN].driveStack ?? []).length + 1,
     'the note lands on the Drive stack');
  eq(afterC.noteStates[RONIN].stackCommitsThisTurn, 1, '...and burns one of the three per-turn commits');

  // Spend the whole budget and the family closes — both stacks at once.
  let walk = st;
  for (let i = 0; i < STACK_COMMIT_BUDGET; i++) {
    const c = ofKind(legalActions(walk, RONIN), 'stackCommit')[0];
    ok(c, `commit ${i + 1} of ${STACK_COMMIT_BUDGET} is still offered`);
    walk = applyBotAction(walk, c, { rng: rngOf() }).state;
  }
  eq(ofKind(legalActions(walk, RONIN), 'stackCommit').length, 0,
     `the per-turn budget of ${STACK_COMMIT_BUDGET} closes the family`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. MOVEMENT SPENDS AP — and RE-FACES you. The second half is easy to miss and
//    it is a real strategic fact: stepping toward a rival turns your back on
//    whatever was behind you, which `isRearHit` reads on defence.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = confirmed(baseState());
  const mv = ofKind(legalActions(st, RONIN), 'move')[0];
  const after = applyBotAction(st, mv, { rng: rngOf() }).state;

  eq(after.spirits.find(s => s.id === RONIN).num, mv.to, 'the Spirit is on the new hex');
  eq(after.turn.moveStepsLeft, st.turn.moveStepsLeft - 1, 'one AP is gone');
  ok(after.spirits.find(s => s.id === RONIN).facing !== undefined, 'walking sets a facing');

  // Walk the pool dry and movement closes.
  let walk = st;
  for (let i = 0; i < st.turn.moveStepsLeft; i++) {
    const m = ofKind(legalActions(walk, RONIN), 'move')[0];
    ok(m, `step ${i + 1} is affordable`);
    walk = applyBotAction(walk, m, { rng: rngOf() }).state;
  }
  eq(walk.turn.moveStepsLeft, 0, 'the pool is empty');
  eq(ofKind(legalActions(walk, RONIN), 'move').length, 0, 'and there is nowhere left to walk');

  // Facing costs an AP too — a hex you will not walk.
  const face = ofKind(legalActions(st, RONIN), 'face')[0];
  const faced = applyBotAction(st, face, { rng: rngOf() }).state;
  eq(faced.turn.moveStepsLeft, st.turn.moveStepsLeft - 1, 'turning in place costs a step');
  eq(faced.spirits.find(s => s.id === RONIN).num, st.spirits.find(s => s.id === RONIN).num, '...and moves you nowhere');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. attackParams — the stat derivation. HARMONY → COMBAT is the Earned lens in
//    its purest form: the number that decides the fight is one you built.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = armed(confirmed(baseState()));

  // Fallback to the static stat before anything is voiced.
  const bare = withNs(withNs(st, RONIN, { driveStack: [] }), METAL, { sustainStack: [] });
  const p0 = attackParams(bare, RONIN, METAL, 'swing');
  eq(p0._derived.atkChordDrive, SPIRIT_DEFS[RONIN].drive, 'no chord → the static Drive stat carries');

  // A voiced chord overrides it.
  const voiced = withNs(st, RONIN, { driveStack: ['A', 'C', 'E'] });
  const p1 = attackParams(voiced, RONIN, METAL, 'swing');
  eq(p1._derived.atkChordDrive, spiritChord(RONIN, ['A', 'C', 'E']).drive, 'a voiced chord sets the Drive');
  ok(p1._derived.atkChord, '...and it is named for the log');

  // 💥 Smash exposure zeroes Sustain — §3.4's real payload — and is flagged for
  // the caller to clear, because a pure function cannot clear it itself.
  const exposedSt = withNs(voiced, METAL, { sustainStack: ['A', 'C', 'E'], smashExposed: true });
  const pE = attackParams(exposedSt, RONIN, METAL, 'swing');
  eq(pE._derived.defChordSustain, 0, '💥 an Exposed rival defends on nothing at all');
  eq(pE._derived.consumedSmashExposed, true, '...and the caller is told to clear the flag');
  eq(attackParams(withNs(exposedSt, METAL, { smashExposed: false }), RONIN, METAL, 'swing')._derived.consumedSmashExposed,
     false, 'un-exposed, the flag is not claimed');

  // 🥊 swingExposed is the melee self-debuff the evaluator must charge.
  const sw = attackParams(withNs(voiced, METAL, { sustainStack: ['A', 'C', 'E'], swingExposed: true }), RONIN, METAL, 'swing');
  const noSw = attackParams(withNs(voiced, METAL, { sustainStack: ['A', 'C', 'E'] }), RONIN, METAL, 'swing');
  eq(sw.defStat, noSw.defStat - 1, '🥊 swingExposed costs the defender exactly 1 Sustain');

  // ⚖️ The bonus tower is capped. 🔊 Goes to 11 does NOT break it — it overwrites
  // the total, which is the difference between a cap with an exemption (what
  // 6️⃣ Number of the Beast was, before §1b cut it) and a cap that still means
  // something. The tower stays capped whether or not the dial is set.
  const towered = withNs(voiced, RONIN, { tempDrive: ATK_BONUS_CAP + 5, moshDrive: 3 });
  const pT = attackParams(towered, RONIN, METAL, 'swing');
  eq(pT.atkStat, p1._derived.atkChordDrive + ATK_BONUS_CAP, `⚖️ stacked bonuses cap at +${ATK_BONUS_CAP}`);
  eq(pT._derived.atkBonusCapped, true, '...and the capping is reported');
  const cranked = attackParams(withNs(towered, RONIN, { atEleven: true }), RONIN, METAL, 'swing');
  eq(cranked.atkStat, ELEVEN_DRIVE,
     '🔊 the dial SETS the total — it does not add to the capped tower, it replaces it');
  eq(cranked._derived.atkBonusCapped, pT._derived.atkBonusCapped,
     '⚠️ …and the cap itself is untouched by the dial being on');

  // 🎸 A dropped instrument is a flat −1 on the base.
  eq(attackParams(withNs(voiced, RONIN, { instrumentDropped: true }), RONIN, METAL, 'swing').atkStat,
     p1.atkStat - 1, '🎸 a dropped instrument costs 1 Drive');

  eq(attackParams(st, RONIN, 'ghost', 'swing'), null, 'an absent defender yields null, not a throw');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. THE DICE — Swing is one die, Sonic is a pool, and ⚡ charges change both.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = withNs(armed(confirmed(baseState())), RONIN, { driveStack: ['A', 'C', 'E'] });

  const sw = attackParams(st, RONIN, METAL, 'swing');
  eq(sw.atkDie, THRASH_DIE, 'the Swing rolls the base Thrash die');
  eq(sw.defDie, THRASH_DIE, '...and the defender always answers a Swing on the same');
  eq(sw.dicePool, null, 'the Swing is a single die, not a pool');

  const ceil = attackParams(withNs(st, RONIN, { chargeCeilTurns: 2 }), RONIN, METAL, 'swing');
  eq(ceil.atkDie, THRASH_CEIL_DIE, `⚡ a ceiling charge grows the Thrash die to d${THRASH_CEIL_DIE}`);

  const floor = attackParams(withNs(st, RONIN, { chargeFloorTurns: 2 }), RONIN, METAL, 'swing');
  eq(floor.atkFloor, CHARGE_FLOOR_BONUS, '⚡ a floor charge clamps the die');
  // Strongest floor wins — they explicitly do not stack.
  eq(attackParams(withNs(st, RONIN, { chargeFloorTurns: 2, dieFloorBoost: CHARGE_FLOOR_BONUS + 3 }), RONIN, METAL, 'swing').atkFloor,
     CHARGE_FLOOR_BONUS + 3, '⚡ the STRONGEST floor wins — floors do not stack');

  // Sonic: a pool, and the defender's die depends on THEIR rig, not the attacker's.
  const so = attackParams(st, RONIN, METAL, 'sonic');
  ok(Array.isArray(so.dicePool) && so.dicePool.length >= 1, 'the Sonic throws a pool');
  eq(so.defDie, so._derived.defInRig ? SONIC_DEF_DIE : SONIC_DEF_DIE_OUT_OF_RIG,
     'the defence die follows the DEFENDER\'s rig, not the attacker\'s');

  const soCeil = attackParams(withNs(st, RONIN, { chargeCeilTurns: 2 }), RONIN, METAL, 'sonic');
  ok(soCeil.dicePool.every((s, i) => s >= soCeil._derived.poolBeforeCharge[i]),
     '⚡ a ceiling charge grows EVERY die in the pool');
  ok(soCeil.dicePool.every(s => s <= CHARGE_DIE_CEILING), `...and none exceeds d${CHARGE_DIE_CEILING}`);

  // 🛡️ A stranded defender scrambles a bare d4 — §3.1's worst square, from the
  // other side of the beam.
  const stranded = withSpirit(st, METAL, { num: CORNERS.red.homeNum });
  eq(attackParams(stranded, RONIN, METAL, 'sonic').defDie, SONIC_DEF_DIE_OUT_OF_RIG,
     '🛡️ stranded outside their own rig, the rival defends on a bare d4');
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. A SWING, END TO END — pay, roll, and run the ordered aftermath.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = withNs(armed(confirmed(baseState())), RONIN, { driveStack: ['A', 'C', 'E'] });
  const swing = ofKind(legalActions(st, RONIN), 'swing')[0];
  ok(swing, 'the fixture offers a Swing');

  const r = applyBotAction(st, swing, { rng: rngOf(3) });
  eq(r.ok, true, 'the Swing resolves');
  eq(r.state.turn.moveStepsLeft, st.turn.moveStepsLeft - 1, 'it cost 1 AP');
  eq(r.state.turn.actionTokenUsed, true, '...and the Action Token — one attack per turn');
  ok(r.battle, 'a battle was rolled');
  ok(typeof r.battle.attackerWon === 'boolean', '...and it reached a verdict');

  // The aftermath actually ran: someone took damage, either way round.
  const vibeBefore = st.spirits.reduce((n, s) => n + (s.vibe ?? 0), 0);
  const vibeAfter  = r.state.spirits.reduce((n, s) => n + (s.vibe ?? 0), 0);
  ok(vibeAfter <= vibeBefore, 'the consequence sequence ran — Vibe moved, or the blow was absorbed');

  // The token is now spent, so `legalActions` must stop offering attacks —
  // the closure property, checked across the seam rather than inside one file.
  for (const k of ['swing', 'sonic', 'smash']) {
    eq(ofKind(legalActions(r.state, RONIN), k).length, 0, `after attacking, no ${k} is offered`);
  }
  ok(ofKind(legalActions(r.state, RONIN), 'move').length > 0, '...but you can still walk away');

  // 💥 And the exposure clear actually happened.
  const exposed = withNs(st, METAL, { smashExposed: true, sustainStack: ['A', 'C', 'E'] });
  const rE = applyBotAction(exposed, swing, { rng: rngOf(3) });
  eq(rE.state.noteStates[METAL].smashExposed, false,
     '💥 the exposure is consumed by the blow that read it — not left switched on forever');
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. DETERMINISM (§0.4's tripwire). Same seed + same line ⇒ identical state.
//    A hypothetical that burns draws off the live stream desyncs every replay
//    and every online client, and it fails SILENTLY — hence a test, not a hope.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = withNs(armed(confirmed(baseState())), RONIN, { driveStack: ['A', 'C', 'E'] });
  const swing = ofKind(legalActions(st, RONIN), 'swing')[0];

  const a = applyBotAction(st, swing, { rng: rngOf(41) });
  const b = applyBotAction(st, swing, { rng: rngOf(41) });
  eq(JSON.stringify(a.state), JSON.stringify(b.state), 'same seed, same line ⇒ byte-identical state');
  eq(JSON.stringify(a.logs), JSON.stringify(b.logs), '...and an identical log trace');

  const c = applyBotAction(st, swing, { rng: rngOf(999) });
  ok(JSON.stringify(c.state) !== JSON.stringify(a.state) || c.battle.atkRoll !== a.battle.atkRoll,
     'a different seed really does roll a different battle — the test is not vacuous');

  // The source state is never touched, whatever happened inside.
  const before = JSON.stringify(st);
  applyBotAction(st, swing, { rng: rngOf(41) });
  eq(JSON.stringify(st), before, 'the state handed in is never mutated');
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. LINES — a searcher needs to know it hit a wall, and WHICH wall, rather
//     than silently scoring a truncated line as the line it asked for.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = confirmed(baseState());
  const moves = ofKind(legalActions(st, RONIN), 'move').slice(0, 1);
  const clean = applyBotLine(st, moves, { rng: rngOf() });
  eq(clean.stoppedAt, null, 'a legal line runs clean');
  eq(clean.taken.length, 1, '...and reports what it took');

  const blocked = applyBotLine(st, [moves[0], { kind: 'smash', targetId: METAL }], { rng: rngOf() });
  eq(blocked.taken.length, 0, 'a refused line reports nothing taken — it is all-or-nothing');
  eq(blocked.stoppedAt.reason, 'unmodelled', '...and names the reason');
  eq(blocked.state, st, '...and rolls the WHOLE line back — a half-applied line is not a position');

  eq(applyBotLine(st, [], { rng: rngOf() }).taken.length, 0, 'an empty line is a no-op');
  eq(applyBotLine(st, null, { rng: rngOf() }).stoppedAt, null, 'a null line does not throw');
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. THE THREE MODULES COMPOSE — branches → transition → score. This is the
//     whole point of the increment, so it gets an explicit test.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = confirmed(baseState());
  const scored = legalActions(st, RONIN)
    .filter(a => MODELLED_KINDS.has(a.kind))
    .map(a => {
      const r = applyBotAction(st, a, { rng: rngOf(7) });
      return { a, ok: r.ok, score: r.ok ? evaluate(r.state, RONIN).score : -Infinity };
    });

  ok(scored.length > 0, 'there are branches to score');
  ok(scored.every(s => s.ok), 'every modelled branch applied cleanly');
  ok(scored.every(s => Number.isFinite(s.score)), 'every resulting position scores to a real number');
  ok(new Set(scored.map(s => s.score)).size > 1,
     'the scores actually DIFFER — a searcher with one flat score is a random-move bot');

  // Other kinds of stuck: skill unlocks are Db, not AP, so a 0-AP position is
  // not a dead one.
  const broke = { ...st, turn: { ...st.turn, moveStepsLeft: 0 } };
  const acts = legalActions(broke, RONIN);
  ok(acts.length > 0, 'a Spirit with no AP still has something to do');
  ok(acts.some(a => a.kind === 'endTurn'), '...at minimum, ending the turn');

  // And ending a turn really does hand play on.
  const ended = applyBotAction(broke, { kind: 'endTurn' }, { rng: rngOf() });
  eq(ended.ok, true, 'endTurn resolves');
  ok(ended.state.acting !== RONIN, '...and play passes to somebody else');
  eq(ended.state.turn.count, broke.turn.count + 1, '...and the turn clock advances');
}

// ═════════════════════════════════════════════════════════════════════════════
// 12. 🎤 POSE moves the VIEW, not the state — because `posing` is still React's.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = withSpirit(confirmed(baseState()), RONIN, { num: 56 });
  const pose = ofKind(legalActions(st, RONIN), 'pose')[0];
  ok(pose, '🎤 on the Limelight the pose is offered');

  const r = applyBotAction(st, pose, { rng: rngOf(), view: { posing: {} } });
  eq(r.ok, true, 'the pose opens');
  eq(r.view.posing[RONIN], true, '...in the VIEW, where `posing` actually lives');
  eq(r.state, st, '...and the engine state is untouched, because it does not own this yet');
  eq(ofKind(legalActions(r.state, RONIN, r.view), 'pose').length, 0,
     'and a pose already running is not re-offered');
}

console.log(`✅ transitionCheck — ${checks} assertions passed`);
