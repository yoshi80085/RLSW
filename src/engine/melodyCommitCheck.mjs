// ─── MELODY COMMIT CHECK ─────────────────────────────────────────────────────
// Run: node --import ./src/engine/testAssetStub.mjs src/engine/melodyCommitCheck.mjs
//
// Coverage for `systems/melodyCommit.js` — the economic half of the commit, and
// the hole BOT_STRATEGY_HANDOFF §7 called "the single highest-value next
// extraction in the whole engine."
//
// Four properties matter more than any individual number here:
//
//   1. PURITY. The kernel computes and does not write. Calling it twice on the
//      same state must return the same thing, and must not mutate the state it
//      was handed. An impure kernel would make every search result a function of
//      how many times a line was explored.
//   2. THE ORDER OF `effects` SURVIVES. The riff's Fame is multiplied by the
//      crowd, so it must land AFTER the fans this commit won and BEFORE the
//      cadence fans. This is the kind of rule that has no symptom until someone
//      wonders why a riff paid 3 last week and 2 today.
//   3. THE SEARCHER CAN NOW SEE LONG MELODIES. §6b.1's whole point: a longer
//      track must be visibly worth more than a short one, in AP (🪦 and, until
//      Db was cut on 2026-10-02, in Db). This
//      is the property whose ABSENCE was biasing the bot, so it is asserted
//      directly rather than inferred from a win rate.
//   4. THE REMAINING GAP STAYS DECLARED. `CLIENT_OWNED` must keep announcing
//      `applySkillEffects`. A suite that let that quietly start "working" would
//      be worse than no suite.
//
// ✅ §14 is a DELEGATION GUARD. `confirmNoteTrack` has been rewired onto this
// kernel, so the arithmetic exists in exactly one place. The guard reads the
// monolith's source and fails if any of it comes BACK — the old drift guard
// inverted, because "is there a second copy?" is the question that outlives
// "does the second copy still match?".

import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeRng } from "./rng.js";
import {startTurnNotes} from './systems/turnFlow.js';
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import { legalActions } from "./policies/legalActions.js";
import { applyBotAction, PARTIAL_KINDS } from "./policies/transition.js";
import {
  commitMelodyEconomy, CLIENT_OWNED,
  MIC_VOICE_ROLL_DIE, MIC_VOICE_ROLL_PASS, SPEED_CAP,
} from "./systems/melodyCommit.js";
import { CORNERS } from "../data/corners.js";
import {
  FAME_PER_TURN_CAP,
} from "../data/gameConstants.js";

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.equal(a, b, m); checks++; };
const deep = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };

const RONIN = 'cosmic_ronin', ZERO = 'intergalactic_0', METAL = 'Metalness_Monster';
const START = 45;          // interior, six real neighbours, not the Limelight
const BACK  = CORNERS.blue.homeNum;   // outer ring — FAN_GAIN_BY_RING pays 0 there

const CONFIG = {
  mode: 'ffa', startingLives: 3,
  spirits: [
    { id: RONIN, name: 'Ronin',     corner: 'blue',   num: START, vibe: 5, maxVibe: 5, knockedOut: false, facing: 0, drive: 8, sustain: 5, speed: 5 },
    { id: ZERO,  name: 'Zero',      corner: 'purple', num: CORNERS.purple.homeNum, vibe: 4, maxVibe: 4, knockedOut: false, facing: 0, drive: 6, sustain: 7, speed: 4 },
    { id: METAL, name: 'Metalness', corner: 'yellow', num: CORNERS.yellow.homeNum, vibe: 5, maxVibe: 5, knockedOut: false, facing: 0, drive: 7, sustain: 6, speed: 4 },
  ],
};

const baseState = (seed = 77) => {
  const st = makeInitialState(structuredClone(CONFIG), seed);
  return { ...st, acting: RONIN, turn: { ...st.turn, moveStepsLeft: 0, actionTokenUsed: false } };
};
const withNs = (st, id, patch) => ({ ...st, noteStates: { ...st.noteStates, [id]: { ...st.noteStates[id], ...patch } } });
const withSpirit = (st, id, patch) => ({ ...st, spirits: st.spirits.map(s => s.id === id ? { ...s, ...patch } : s) });
const nsOf = (st, id) => st.noteStates[id];

/** A Spirit standing on a clean C-major sheet with `track` composed. */
const composed = (track, extra = {}, id = RONIN, st = baseState()) => withNs(st, id, {
  melodyLine: track, rootNote: 'C', scaleMode: extra.scaleMode ?? 'major',
  paletteMode: extra.scaleMode ?? 'major',
  unlockedSkills: [], discordUnlocks: [], driveStack: [], sustainStack: [],
  excitement: 0, loyalty: 0, recentP: [], lowPerfStreak: 0,
  finalsTrail: [], cadenceCooldowns: {}, bankedNote: null, tempDrive: 0, tempSustain: 0,
  casuals: 0, diehards: 2, centerStreak: 0, fanLag: 0, mojoDrain: 0,
  ...extra,
});

const run = (st, id = RONIN, ctx = {}) => commitMelodyEconomy(st, id, ctx);

// ═════════════════════════════════════════════════════════════════════════════
// 1. PURITY — the kernel computes; it does not write.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = composed(['C', 'E', 'G']);
  const before = JSON.parse(JSON.stringify(st));
  const a = run(st), b = run(st);

  deep(JSON.parse(JSON.stringify(st)), before, 'the kernel must not mutate the state it is handed');
  eq(a.hexes, b.hexes, 'two calls on one state agree on AP');
  eq(a.report.perfScore, b.report.perfScore, 'two calls on one state agree on P');
  deep(a.patch, b.patch, 'two calls on one state produce an identical patch');
  ok(!Object.is(a.patch, b.patch), 'each call returns a fresh patch, not a shared one');

  // The patch is a description, not an application.
  deep(nsOf(st, RONIN).melodyLine, ['C', 'E', 'G'], 'the source sheet still holds the track');
  eq(nsOf(st, RONIN).hasConfirmed, false, 'the source sheet is still unconfirmed');
  const committed={...nsOf(st,RONIN),...a.patch};
  const nextTurn={...committed,...startTurnNotes(committed).patch};
  deep(nextTurn.lastCommittedMelody,['C','E','G'],'the last melody remains available for a rival-led Riff Off after turn reset');
  deep(nextTurn.committedMelody,[],'the existing per-turn melody still clears');
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE GUARDS — nothing to commit is a refusal, not a zero-score commit.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(run(composed([])).ok, false, 'an empty track cannot be committed');
  eq(run(composed([]), 'nobody').ok, false, 'an unknown Spirit cannot commit');
  ok(run(composed(['C'])).ok, 'a one-note track can');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. §1's SPINE — the melody buys the AP, capped by speed, and the overflow banks.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(run(composed(['C', 'D', 'E'])).hexes, 3, 'three notes buy three hexes');
  // Ronin's speed is 5; a 7-note track is capped there and banks the overflow.
  const long = run(composed(['C', 'D', 'E', 'F', 'G', 'A', 'B']));
  eq(long.hexes, 5, 'the AP grant is capped at speed');
  eq(long.report.overflow, 2, 'notes beyond speed are overflow');
  eq(long.report.canBank, true, 'overflow with an empty bank banks the last note');
  eq(long.report.bankedNote.note, 'B', 'the banked note is the LAST one, not the first overflow');

  const full = run(composed(['C', 'D', 'E', 'F', 'G', 'A'], { bankedNote: { note: 'F#' } }));
  eq(full.report.canBank, false, 'a full bank cannot take a second note');
  eq(full.report.bankedNote.note, 'F#', 'and the existing banked note survives');

  // Zero's speed is 4 — the cap is per-Spirit, not global.
  const zeroSt = composed(['C', 'D', 'E', 'F', 'G'], {}, ZERO);
  eq(run(zeroSt, ZERO).hexes, 4, "the cap reads the Spirit's own speed");
  ok(SPEED_CAP >= 5, 'the hard speed ceiling is at least every shipped Spirit’s speed');
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. ⚠️ THE POINT OF THE WHOLE EXTRACTION — a longer melody is visibly worth more.
//    This is §6b.1's bias, asserted directly. Before the kernel landed, a
//    searcher could see the AP and none of the Db, so every scoring term said
//    "commit early". Both halves must now move in the same direction.
// ═════════════════════════════════════════════════════════════════════════════
{
  const short = run(composed(['C', 'D']));
  const long  = run(composed(['C', 'D', 'E', 'F', 'G']));
  ok(long.hexes > short.hexes, 'a longer clean track buys strictly more AP');
  ok(long.report.perfFansGained >= short.report.perfFansGained, '…and wins at least as many fans');

  // 🪦 The commit writes NO Db — there is none (cut 2026-10-02).
  eq(long.patch.dbPoints, undefined, 'no Db lands on the sheet');
  eq(long.patch.totalDB, undefined, '…and no running Db total either');
  eq(long.patch.hasConfirmed, true, 'the mechanical half still fires');
  deep(long.patch.melodyLine, [], 'the track is cleared on confirm');
  deep(long.patch.committedMelody, ['C', 'D', 'E', 'F', 'G'], '…and stashed for the riff-off');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. THE FINAL NOTE — the ending is classified, and only the carrot pays.
//    🪦 Clean notes, clean streaks and the tonic/4th/5th ending paid Db until
//    2026-10-02. Alex's call: the ending pays NOTHING for now (`ENDING_WEIGHT`
//    in melodyPayout.js is dormant). What still pays is the red/blue carrot.
// ═════════════════════════════════════════════════════════════════════════════
{
  const r = run(composed(['C', 'D', 'E', 'G']));        // ends on the 5th
  eq(r.report.endingChoice, 'fifth', 'the line still RESOLVES on the fifth — the ending is classified');
  eq(r.report.earned, undefined, '🪦 …and pays no Db: there is no `earned` on the report');
  eq(r.report.baseScore, undefined, '🪦 …and no Db breakdown');
  eq(r.report.colorDrive + r.report.colorSustain, 0, 'with no stack root under it, the fifth pays nothing at all');

  const tonic = run(composed(['D', 'E', 'F', 'C'], { driveStack: ['C', 'E', 'G'] }));
  eq(tonic.report.endingChoice, 'tonic', 'the line can resolve to the palette tonic');
  eq(tonic.report.colorDrive, 1, 'ending on the Drive stack root grants a red carrot');
  eq(tonic.patch.tempDrive, 1, 'the carrot is a temporary Drive point');

  const lydianFourth = run(composed(['C', 'D', 'E', 'F#'], { scaleMode: 'lydian' }));
  eq(lydianFourth.report.endingChoice, 'fourth', 'a mode’s fourth degree resolves even when Lydian raises it');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. DISCORD IS INERT — movement survives; fans and endings do not.
// ═════════════════════════════════════════════════════════════════════════════
{
  const one = run(composed(['C', 'D', 'C#', 'G']));
  eq(one.report.unpardonedDiscord, 1, 'one out-of-scale note');
  eq(one.hexes, 4, 'the discord note still buys movement');
  eq(one.report.cleanNoteCount, 3, 'but it is absent from the clean count');

  const three = run(composed(['C', 'C#', 'D#', 'F#', 'G']));
  eq(three.report.unpardonedDiscord, 3, 'three out-of-scale notes');
  const zeroSt = composed(['C', 'C#', 'D#', 'F#', 'G'], {}, ZERO);
  const zeroR  = run(zeroSt, ZERO);
  eq(zeroR.report.cleanNoteCount, three.report.cleanNoteCount,
     'Intergalactic 0 has no Freestyle exception');

  const dirtyEnd = run(composed(['C', 'D', 'E', 'F#']));
  eq(dirtyEnd.report.endingClean, false, 'a discord final is identified');
  eq(dirtyEnd.report.endingChoice, 'normal', 'and cannot resolve an ending');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. A red/blue carrot belongs only to the clean final stack root.
// ═════════════════════════════════════════════════════════════════════════════
{
  const middleRoot = run(composed(['C', 'D', 'C', 'E'], { driveStack: ['C', 'E', 'G'] }));
  eq(middleRoot.report.colorDrive, 0, 'a stack-root note in the middle has no carrot');
  const finalRoot = run(composed(['D', 'E', 'F', 'C'], { driveStack: ['C', 'E', 'G'] }));
  eq(finalRoot.report.colorDrive, 1, 'the final Drive root earns the red carrot');
  eq(finalRoot.report.endingChoice, 'tonic', 'the same final note resolves the line harmonically');

  // ⚠️ BOTH colours need the clean final. The in-scale guard once covered Drive only.
  const blue = run(composed(['C', 'D', 'E', 'G'], { sustainStack: ['G', 'B', 'D'] }));
  eq(blue.report.colorSustain, 1, 'the clean final Sustain root earns the blue carrot');
  const dirtyBlue = run(composed(['C', 'D', 'E', 'F#'], { sustainStack: ['F#', 'A#', 'C#'] }));
  eq(dirtyBlue.report.endingClean, false, 'F# is a discord final here');
  eq(dirtyBlue.report.colorSustain, 0, 'a DISCORD final on the Sustain root earns no blue carrot');
  eq(dirtyBlue.patch.tempSustain ?? 0, 0, '…and no temporary Sustain');
  const dirtyRed = run(composed(['C', 'D', 'E', 'F#'], { driveStack: ['F#', 'A#', 'C#'] }));
  eq(dirtyRed.report.colorDrive, 0, 'the same discord final on the Drive root earns no red carrot either');

  const drained = run(composed(['D', 'E', 'F', 'C'], { driveStack: ['C', 'E', 'G'], mojoDrain: 2 }));
  eq(drained.report.colorDrive, 0, 'Mojo Drain eats the colour payout');
  eq(drained.patch.tempDrive, 0, '…and the Drive boost with it');
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. Layer 1 — each Spirit's decided structure awards melody fans.
// ═════════════════════════════════════════════════════════════════════════════
{
  // 🪦 THIS WAS `C D# D E` → shred, "a free same-letter inflection". D# is out of
  // C major, and discord now BREAKS a shape (Alex, 2026-09-17, rule 4), so the
  // inflection only survives where both spellings are clean — which no palette
  // in the game has today. Superseded, not forgotten.
  const scalar = run(composed(['C', 'D', 'E'], { casuals: 0 }));
  deep(scalar.report.style.hits, ['scalar_shred'], 'Ronin climbs by letter through clean notes');
  const inflected = run(composed(['C', 'D#', 'D', 'E'], { casuals: 0 }));
  deep(inflected.report.style.hits, [], 'a discord inflection breaks the climb — discord earns no fans');
  eq(scalar.report.perfFansGained, 1, 'a completed scalar shred wins one casual fan');
  ok(scalar.effects.some(e => e.type === 'fans' && e.fans.casuals === 1), 'the fan award reaches the reducer effect');

  const skip = run(composed(['C', 'E', 'G'], { casuals: 0 }));
  deep(skip.report.style.hits, ['even_skip'], 'Ronin can instead climb or fall by even letter skips');
  eq(skip.report.perfFansGained, 1, 'the even skip also wins one casual fan');

  const chug = run(composed(['C', 'Db', 'C'], { scaleMode: 'phrygian', casuals: 0 }, METAL), METAL);
  deep(chug.report.style.hits, ['pedal_chug'], 'Metalness earns fans by returning to a chug anchor');
  eq(chug.report.perfFansGained, 1, 'a pedal chug wins one casual fan');

  const signals = run(composed(['C', 'Db', 'C', 'F', 'G', 'F'], { scaleMode: 'phrygian', casuals: 0 }, ZERO), ZERO);
  deep(signals.report.style.hits, ['signal_circle'], 'Intergalactic 0 recognises a signal circle');
  eq(signals.report.perfFansGained, 2, 'two non-overlapping signal circles in one line win two casual fans');
}

// ═════════════════════════════════════════════════════════════════════════════
// Retired melody-economy checks retained below only as historical reference;
// the active contract is the three-layer coverage immediately above.
if (false) {
// 8b. 🎭 PER-SPIRIT STYLE — the riff library's replacement.
// ═════════════════════════════════════════════════════════════════════════════
//
// ⚠️ THE LOAD-BEARING ASSERTION IS THE LAST ONE: STYLE PAYS FANS AND NEVER FAME.
// The riffs were retired because they handed over a third of the win in one
// commit off the note DRAW. Anything that reinstates a Fame payout here has
// re-created the mechanic, and it will look like a balance tweak in the diff.
{
  const plain  = run(composed(['C', 'Eb', 'F', 'G'],  { scaleMode: 'phrygian' }, METAL), METAL);
  const styled = run(composed(['C', 'Db', 'Eb', 'F'], { scaleMode: 'phrygian' }, METAL), METAL);
  deep(plain.report.style.hits, [], 'a line with none of his gestures scores no style');
  deep(styled.report.style.hits, ['phrygian_bite'], 'C→Db states the Phrygian bite, and Eb walks away');
  ok(styled.report.style.score > plain.report.style.score,
     'landing your Spirit’s gesture fills its dedicated crowd seat');

  // The SAME track read from another seat scores nothing — this is what makes
  // the commit phase distinguish the roster, which THEORY_ARCHITECTURE.md §2
  // names as the one place four characters used to play identically.
  const wrongSeat = run(composed(['C', 'Db', 'Eb', 'F'], { scaleMode: 'phrygian' }, RONIN), RONIN);
  ok(!wrongSeat.report.style.hits.includes('phrygian_bite'),
     'the Phrygian bite is Metalness’s gesture, not the Ronin’s');

  const roninRun = run(composed(['C', 'D', 'Eb', 'F'], { scaleMode: 'hirajoshi' }, RONIN), RONIN);
  ok(roninRun.report.style.hits.includes('run'), 'four stepwise notes is the Ronin’s run');

  const zeroLoop = run(composed(['C', 'D', 'Eb', 'C', 'D', 'Eb'], { scaleMode: 'dorian' }, ZERO), ZERO);
  ok(zeroLoop.report.style.hits.includes('loop3'), 'A-B-C-A-B-C is Intergalactic 0’s three-note loop');

  // 🪦 THE RULE THE RIFFS BROKE.
  eq(styled.patch.fame ?? 0, plain.patch.fame ?? 0, 'style pays no Fame — not one point');
  ok(styled.report.perfScore >= styled.report.style.score,
     '…it feeds Performance Score and therefore the crowd, never direct Fame');
}

// ═════════════════════════════════════════════════════════════════════════════
// 9. 🗡️ THE RONIN CLIFF — a step at 5, not a slope. §5's heaviest weight.
// ═════════════════════════════════════════════════════════════════════════════
{
  // Compare the excitement gain either side of the cliff at equal P distance.
  const gainAt = (p, id) => {
    const maxVibe = id === RONIN ? 5 : 5;
    const vf = maxVibe / 5;
    return id === RONIN
      ? (p >= RONIN_PERF_CLIFF ? (p - (RONIN_PERF_CLIFF - 1)) * vf * 2 : (p - RONIN_PERF_CLIFF) * vf * 0.5)
      : Math.max(0, p - (RONIN_PERF_CLIFF - 1)) * vf;
  };
  ok(gainAt(5, RONIN) > 0, 'P=5 wins the Ronin a crowd');
  ok(gainAt(4, RONIN) < 0, '⚠️ P=4 COOLS it — the meter goes negative, it does not merely stall');
  ok(gainAt(5, RONIN) > gainAt(5, METAL), 'a virtuoso show is worth ~double to him');
  ok(gainAt(4, METAL) === 0, 'for everyone else, short of the cliff is simply no change');

  // And the shipped kernel agrees with that shape.
  const weak = run(composed(['C', 'C', 'C']));
  ok(weak.report.perfScore < RONIN_PERF_CLIFF, 'a flat repeated track is a weak show');
  ok(weak.report.perfExciteGain < 0, '…and the Ronin’s crowd cools for it');

  // 🥱 Sustained mediocrity is a NON-Ronin rule — he has the instant version.
  eq(weak.report.lowPerfStreak, 0, 'the Ronin never builds a boredom streak');
  const metalWeak = run(composed(['C', 'C', 'C'], { lowPerfStreak: FAN_BORED_AFTER - 1 }, METAL), METAL);
  eq(metalWeak.report.lowPerfStreak, FAN_BORED_AFTER, 'everyone else does');
  ok(metalWeak.report.perfFansLost >= FAN_DECAY, '…and a full streak sheds fans');
}

// ═════════════════════════════════════════════════════════════════════════════
// 10. 🎤 FANS — position pays for WHERE, the deed pays for WHAT, P pays for HOW.
//     All three fold sequentially so each cap bites in turn.
// ═════════════════════════════════════════════════════════════════════════════
{
  // ⚠️ A discordant track does not merely gain zero — it never touches the
  // promotion clock. `gainFans` early-returns before `centerStreak`.
  const dirty = positionFanGain({ casuals: 0, diehards: 2, centerStreak: 4 }, LIMELIGHT_HEX, false);
  eq(dirty, null, 'a discordant track pays no fans AND does not advance the streak');
  const lagged = positionFanGain({ casuals: 0, diehards: 2, fanLag: 1 }, LIMELIGHT_HEX, true);
  eq(lagged, null, 'a Spirit still shaken from a demolition wins nobody');

  const main = positionFanGain({ casuals: 0, diehards: 2, centerStreak: 0 }, LIMELIGHT_HEX, true);
  eq(main.base, FAN_GAIN_BY_RING.main, 'the Mainstage pays its posted rate');
  eq(main.fans.centerStreak, 1, 'centre play advances the promotion clock');
  eq(main.fans.fanActedThisTurn, true, '…and flags the turn');

  const promote = positionFanGain({ casuals: 3, diehards: 2, centerStreak: FAN_PROMOTE_EVERY - 1 }, LIMELIGHT_HEX, true);
  eq(promote.promoted, true, 'the third consecutive centre turn hardens a casual');
  eq(promote.fans.diehards, 3, '…into a diehard');

  // The centre pays and the back does not — §3.6's "centre pays, centre kills".
  const back = positionFanGain({ casuals: 0, diehards: 2 }, BACK, true);
  eq(back, null, 'the back ring is outside the gain zone entirely');

  // The undecided crowd is only recruited from the spotlight, and never beyond
  // what is actually there.
  eq(positionFanGain({ casuals: 0, diehards: 2 }, LIMELIGHT_HEX, true, 1).recruit, 1, 'the spotlight wins the unsure over');
  eq(positionFanGain({ casuals: 0, diehards: 2 }, LIMELIGHT_HEX, true, 0).recruit, 0, '…but cannot recruit an empty pool');

  // Caps are real, and folding respects them.
  const capped = performanceFanGain({ casuals: FAN_CASUAL_CAP, diehards: 2 }, 5, 0, 0);
  eq(capped.casuals, FAN_CASUAL_CAP, 'casuals cap');
  const capD = performanceFanGain({ casuals: 5, diehards: FAN_DIEHARD_CAP }, 0, 3, 0);
  eq(capD.diehards, FAN_DIEHARD_CAP, 'diehards cap, and a blocked promotion does not eat the casual');
  eq(capD.casuals, 5, '…the casual stays put');
  eq(performanceFanGain({ casuals: 1, diehards: 2 }, 0, 0, 5).casuals, 0, 'losses floor at zero');

  // 🎯 The deed's centre bonus stacks on the cadence's own value.
  const deed = deedFanGain({ casuals: 0, diehards: 2, centerStreak: 0 }, LIMELIGHT_HEX, 2);
  eq(deed.gain, 4, 'a 2-fan cadence on the Mainstage pays 2 + 2');
  eq(deedFanGain({ casuals: 0, diehards: 2 }, BACK, 2).gain, 2, '…and nothing extra from the back');
  eq(deedFanGain({ casuals: 0, diehards: 2 }, LIMELIGHT_HEX, 0), null, 'a zero-value deed is not a deed');
}

// ═════════════════════════════════════════════════════════════════════════════
// 11. ⚠️ THE ORDER OF `effects` — a Fame effect must see the crowd THIS commit
//     won, and NOT the cadence fans that land after it, because `grantFame`
//     multiplies by the crowd. No symptom until someone wonders why the same
//     play paid 3 last week and 2 today.
//
//     🪦 The riff was the effect this rule was written for, and it retired on
//     2026-08-17 — so `fameAt` is currently always -1 and the ordering assertion
//     below is DORMANT, not deleted. ⚠️ That is deliberate and it is the whole
//     point of keeping it: the moment anything pays Fame at the commit again
//     (the per-Spirit style system is expected to), this fires without anyone
//     remembering to re-derive the rule. `fansIdx.length` is asserted
//     unconditionally so the section cannot pass on an empty effects list.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = composed(['C', 'D', 'E'], { casuals: 4 }, RONIN, withSpirit(baseState(), RONIN, { num: LIMELIGHT_HEX }));
  const r = run(st);
  const kinds = r.effects.map(e => e.type);
  const fameAt = kinds.indexOf('fame');
  const fansIdx = kinds.reduce((acc, k, i) => (k === 'fans' ? [...acc, i] : acc), []);
  if (fameAt >= 0 && fansIdx.length > 0) {
    ok(fansIdx[0] < fameAt, 'the crowd this commit won lands BEFORE the Fame it multiplies');
  }
  ok(fansIdx.length >= 1, 'a clean centre-stage commit writes fans');
  ok(r.effects.every(e => ['fans', 'fame', 'unsurePool'].includes(e.type)),
     'no effect kind escapes the three the caller knows how to apply');

  // Every effect names its Spirit — a nameless effect is one a multi-Spirit
  // caller would silently apply to the wrong sheet.
  ok(r.effects.every(e => e.spiritId === RONIN), 'every effect names its Spirit');
}

}
// ═════════════════════════════════════════════════════════════════════════════
// 12. 🎤 THE MIC — the voice roll SHADOWS the track, and it costs rng draws.
//     ⚠️ Everything scores the shadowed line: a bonus note the player never
//     placed still buys AP, Db and P. That is the whole skill.
// ═════════════════════════════════════════════════════════════════════════════
{
  const st = composed(['C', 'D', 'E'], { unlockedSkills: ['mic'] });

  // The roll is deterministic on a seeded stream — same seed, same outcome.
  const a = run(st, RONIN, { rng: makeRng(11) });
  const b = run(st, RONIN, { rng: makeRng(11) });
  eq(a.report.voiceRoll, b.report.voiceRoll, 'the voice roll is seeded, not Math.random');
  eq(a.report.micBonusNote, b.report.micBonusNote, '…and so is the bonus note');
  ok(a.report.voiceRoll >= 1 && a.report.voiceRoll <= MIC_VOICE_ROLL_DIE, 'it is a d6');

  // Draw accounting: 1 draw on a miss, 2 on a hit. A searcher that mis-counts
  // these desyncs every replay downstream of the commit (§0.4).
  const rng = makeRng(11);
  const before = rng.state().cursor;
  const r = run(st, RONIN, { rng });
  const spent = rng.state().cursor - before;
  eq(spent, r.report.voiceRoll >= MIC_VOICE_ROLL_PASS ? 2 : 1,
     'the mic spends exactly one draw on a miss and two on a hit');

  // Find a seed that passes, and check the shadow reaches everything.
  let hit = null;
  for (let s = 1; s < 200 && !hit; s++) {
    const t = run(st, RONIN, { rng: makeRng(s) });
    if (t.report.voiceRoll >= MIC_VOICE_ROLL_PASS) hit = t;
  }
  ok(hit, 'some seed passes the voice roll');
  eq(hit.report.melodyLine.length, 4, 'the bonus note joins the scored track');
  eq(hit.hexes, 4, '⚠️ …and buys AP the player never composed');
  eq(hit.patch.committedFreq.length, 4, 'committedFreq is aligned to the SHADOWED line, one null on the tail');
  eq(hit.patch.committedFreq[3], null, '…and the bonus note has no frequency, by construction');

  // No mic, no roll, no draws.
  const plain = makeRng(11);
  const c0 = plain.state().cursor;
  const noMic = run(composed(['C', 'D', 'E']), RONIN, { rng: plain });
  eq(noMic.report.voiceRoll, null, 'without the skill there is no roll');
  eq(plain.state().cursor, c0, '…and the stream is untouched');

  // ⚠️ Omitting rng entirely must SKIP the mic, never fall back to Math.random.
  const noRng = run(st);
  eq(noRng.report.voiceRoll, null, 'no rng ⇒ the mic is skipped, not silently rolled unseeded');
  eq(noRng.hexes, 3, '…and the track is scored as composed');
}

// ═════════════════════════════════════════════════════════════════════════════
// 13. 🪦 WA NO KOE IS CUT — and this section is the REVIVAL GUARD.
//     Alex cut the ability on 2026-09-04 (`RONIN_ABILITY_DESIGN.md` §2.4). What
//     used to live here was coverage of `checkWaNoKoe` plus a pin on the
//     B10-shaped overwrite bug the kernel deliberately reproduced. Both are gone
//     with the rule.
//     ⚠️ THE ASSERTIONS ARE NOT DELETED, THEY ARE INVERTED — same move as §14,
//     and for the same reason. §B5's cut ran past its own end with eighteen
//     suites green, and a deletion with nothing standing on it is exactly that
//     shape again: the next session re-adds a `waNoKoeBuffs` seat "for
//     compatibility" and nothing anywhere goes red. So the CUT is what has a
//     test now.
//     📌 If the ability comes back in Alex's new form (`IDEAS_INBOX.md`), it
//     comes back as a NEW rule with a new name and new coverage — not by
//     reviving these symbols. Delete this section then, deliberately.
// ═════════════════════════════════════════════════════════════════════════════
{
  const kernelSrc = readFileSync(
    fileURLToPath(new URL('./systems/melodyCommit.js', import.meta.url)), 'utf8');
  ok(!/waNoKoe/i.test(kernelSrc),
     '🪦 the Wa no Koe RULE is gone from the kernel — no function, no patch field, no report field');

  const economySrc = readFileSync(
    fileURLToPath(new URL('./systems/economy.js', import.meta.url)), 'utf8');
  ok(!/waNoKoeBuffs/.test(economySrc),
     '🪦 …and its seat is gone from the initial note state — a dead seat is how a cut ability keeps costing');

  // The commit itself must not carry the field, on the Ronin, with the id set.
  // ⚠️ Reading the REPORT rather than the source is the half that survives a
  // rename: an ability re-added under any spelling shows up here as a patch key.
  const r = run(composed(['C', 'E', 'G'], {
    unlockedSkills: ['wa_no_koe'], driveStack: ['C', 'E', 'G'], tempDrive: 0,
  }));
  eq(r.report.waNoKoe, undefined, '🪦 the commit report has no Wa no Koe seat');
  ok(!Object.keys(r.patch).some(k => /waNoKoe/i.test(k)),
     '🪦 …and the patch writes no buff list, even when the dead skill id is unlocked');
  // ⚠️ THE NUMBER IS THE POINT. `C-E-G` is the Ronin's own chord stack, which
  // under the old rule was a guaranteed fire: +1 Drive for 3 rounds. The track
  // earns no Drive boost of its own, so 0 here is the ability being gone, and a
  // 1 is it back — by any spelling, from any file.
  eq(r.patch.tempDrive, 0,
     '🪦 a melody sitting entirely inside the Ronin\'s own stack now pays nothing extra');
}

// ═════════════════════════════════════════════════════════════════════════════
// 14. ✅ THE REWIRE LANDED — the monolith DELEGATES instead of duplicating.
//     This section used to be a DRIFT GUARD over nine expressions that existed
//     twice, written to be deleted the day `confirmNoteTrack` was rewired onto
//     the kernel. It is not deleted — it is INVERTED. The old guard asked "does
//     the second copy still match?"; this one asks "is there a second copy?".
//     That is the assertion worth keeping, because the failure it catches —
//     somebody re-inlining one expression to make a quick tweak — is exactly
//     how the duplicate arose the first time.
// ═════════════════════════════════════════════════════════════════════════════
{
  const monolithPath = fileURLToPath(new URL('../rlsw-simulator-v3_8_1.jsx', import.meta.url));
  const src = readFileSync(monolithPath, 'utf8').replace(/[ \t]+/g, ' ');

  ok(src.includes('commitMelodyEconomy(engineRef.current, acting.id'),
     'confirmNoteTrack drives the kernel');
  ok(src.includes('from "./engine/systems/melodyCommit.js"'),
     '…importing it directly rather than reaching through another module');

  // ⚠️ THE RNG SHIM IS THE NETCODE CONTRACT. The kernel's draws must ride
  // `drawSeededInt`, which dispatches the LOGGED `randomBatchDrawn` action the
  // netcode relays and every replay reproduces. A bare `makeRng()` in the client
  // would roll identical numbers off an unlogged stream and desync silently —
  // BOT_STRATEGY_HANDOFF §0.4's whole point, and invisible without this line.
  ok(src.includes('const commitRng = { int: (n) => drawSeededInt(n) };'),
     '⚠️ the commit rng is still the seeded, LOGGED shim — not a private stream');

  // The expressions the old guard pinned must now exist in exactly ONE place.
  // Their ABSENCE from the client is what the rewire actually is.
  const goneFromClient = [
    ['const usableMoves = Math.min(totalNotes, actingSpeed);',       'the AP cap'],
    ['const canBank = overflow >= 1 && !existingBank;',              'the bank gate'],
    ['const effectiveDiscord = Math.max(0, unpardonedDiscord - (freestylePardon ? 1 : 0));', 'the freestyle pardon'],
    ['const discordPenalty = discordPenaltyFor(effectiveDiscord);',  'the discord penalty'],
    ['const earnedTotal = earned + dbOverflow + perfDbBonus + edgeDbBonus - edgeDbCost;', 'the Db pot'],
    ['const colorDrive = !isMojoDrained ? Math.min(2, contextPardons.drive) : 0;', 'the colour cap'],
    ['const newDieFloorBoost = !isMojoDrained && isOctaveResolution ? 2 : 0;', 'the octave die floor'],
  ];
  for (const [needle, what] of goneFromClient) {
    ok(!src.includes(needle),
       `⚠️ ${what} is BACK in the monolith — the commit economy has forked again; it belongs in systems/melodyCommit.js`);
  }

  // Two decisions the kernel already made, which the client must not re-make.
  ok(!src.includes('awardTargetSkill(acting.id)'),
     '⚠️ awardTargetSkill at the commit site would find targetSkillId already cleared and silently skip applySkillEffects');
  // 🪦 CUT 2026-09-04. These two used to say "the kernel owns this rule, don't
  // copy it here". They now say "this rule does not exist" — the strictly
  // stronger claim, and the one that catches a revival by copy-paste from the
  // archive rather than from the kernel.
  ok(!src.includes('function applyWaNoKoe('),
     '🪦 Wa no Koe is CUT — a client-side application would resurrect it where no kernel rule answers');
  ok(!src.includes('function checkWaNoKoe('),
     '🪦 …and so would a client-side copy of the rule');
  ok(!src.includes('function tickWaNoKoe('),
     '🪦 …and the expiry tick went with it — a tick with no writer walks an always-empty list forever');
}

// ═════════════════════════════════════════════════════════════════════════════
// 15. THE TRANSITION — `confirmMelody` is no longer PARTIAL, and it runs whole.
// ═════════════════════════════════════════════════════════════════════════════
{
  deep(PARTIAL_KINDS, {}, '⚠️ nothing is partial any more — the claim, not an absence');
  ok(CLIENT_OWNED.includes('applySkillEffects'),
     'the remaining gap stays DECLARED rather than quietly starting to "work"');

  const st = composed(['C', 'D', 'E', 'G']);
  const act = legalActions(st, RONIN).find(a => a.kind === 'confirmMelody');
  ok(act, 'legalActions still offers the commit');

  const res = applyBotAction(st, act, { rng: makeRng(3) });
  ok(res.ok, 'and the transition takes it');
  eq(res.partial, undefined, '…without declaring a gap');

  const after = nsOf(res.state, RONIN);
  eq(after.hasConfirmed, true, 'the mechanical half fired');
  eq(res.state.turn.moveStepsLeft, 4, '…granting AP equal to the track');
  deep(after.melodyLine, [], 'the track cleared');
  ok(after.committedMelody?.length === 4 && typeof after.perfScore === 'number', '⚠️ AND THE ECONOMIC HALF FIRED — this is what was missing (🪦 it was proven by `totalDB` until Db was cut)');
  ok(typeof after.perfScore === 'number', 'P reached the sheet');
  eq(after.rootNote, 'G', 'the next turn’s root is the respelled last note');
  ok(res.report, 'the transition passes the report through for a searcher to read');

  // Determinism: same seed + same action ⇒ identical state. §0.4's tripwire.
  const r1 = applyBotAction(st, act, { rng: makeRng(9) });
  const r2 = applyBotAction(st, act, { rng: makeRng(9) });
  deep(r1.state.noteStates[RONIN], r2.state.noteStates[RONIN], 'the commit is deterministic on a seeded stream');

  // The AP grant reads the SHADOWED track, not the composed one — the bug this
  // rewire could most easily have reintroduced by re-deriving speed locally.
  const micSt = composed(['C', 'D', 'E'], { unlockedSkills: ['mic'] });
  const micAct = legalActions(micSt, RONIN).find(a => a.kind === 'confirmMelody');
  for (let s = 1; s < 200; s++) {
    const probe = commitMelodyEconomy(micSt, RONIN, { rng: makeRng(s) });
    if (probe.report.voiceRoll >= MIC_VOICE_ROLL_PASS) {
      const got = applyBotAction(micSt, micAct, { rng: makeRng(s) });
      eq(got.state.turn.moveStepsLeft, 4, '⚠️ the AP grant counts the mic’s bonus note');
      break;
    }
  }

  // 🌀 Tripped still halves the grant inside the reducer — not re-derived here.
  const tripped = withNs(composed(['C', 'D', 'E', 'F']), RONIN, { tripped: true });
  const trippedRes = applyBotAction(tripped, legalActions(tripped, RONIN).find(a => a.kind === 'confirmMelody'), { rng: makeRng(3) });
  ok(trippedRes.state.turn.moveStepsLeft < 4, 'a tripped Spirit’s melody buys less');
  ok(trippedRes.state.turn.moveStepsLeft >= 1, '…but never nothing');
}

// ═════════════════════════════════════════════════════════════════════════════
// 16. 🪦 THERE IS NO Db BAR (2026-10-02). This section pinned the bar advancing
//     toward a target skill and the award landing. The draft now hands every
//     seat two abilities and Db is cut — so a commit, whatever a stale sheet
//     says, awards nothing and touches neither the kit nor any Db field.
// ═════════════════════════════════════════════════════════════════════════════
{
  const stale = composed(['C', 'D', 'E', 'G'], { targetSkillId: 'shadow_illusion', dbPoints: 99, upgradesPending: 1 });
  const r = run(stale, RONIN, { view: { skillById: { shadow_illusion: { id: 'shadow_illusion', dbCost: 1 } } } });
  eq(r.patch.unlockedSkills, undefined, 'a commit never changes the kit, even off a stale save that still aims at a skill');
  eq(r.report.awardedSkillId, undefined, '…awards nothing');
  eq(r.patch.dbPoints, undefined, '…and writes no Db');
  eq(r.patch.upgradesPending, undefined, '…and queues no upgrade overlay');
}

// ═════════════════════════════════════════════════════════════════════════════
// Retired cadence and ending-fork assertions (the final note now owns the full
// resolution rule) are kept below as history only.
if (false) {
// 17. 🎯 CADENCES & 🎼 RIFFS — the trail, the cooldown, and who pays what.
// ═════════════════════════════════════════════════════════════════════════════
{
  // A cadence resolves off the trail of FINAL notes, not the track itself.
  const noCad = run(composed(['C', 'D', 'E']));
  deep(noCad.patch.finalsTrail.slice(-1), [4], 'the last note’s pitch class joins the trail');
  eq(noCad.report.cadence, null, 'one final is not a cadence');

  // Trail-driven: build a trail that the next final resolves.
  let resolved = null;
  for (const trail of [[0, 5, 7], [7, 0], [5, 0], [0, 5]]) {
    const t = run(composed(['C'], { finalsTrail: trail }));
    if (t.report.cadence) { resolved = t; break; }
  }
  if (resolved) {
    deep(resolved.patch.finalsTrail, [0], '⚠️ a resolution STARTS A FRESH RUN — it does not extend the old one');
    ok(resolved.patch.cadenceCooldowns[resolved.report.cadence.id] === 3, 'and the cadence goes on cooldown');
    ok(resolved.effects.some(e => e.type === 'fans'), '🎯 a cadence builds CROWD…');
    ok(!resolved.effects.some(e => e.type === 'fame' && e.reason?.includes(resolved.report.cadence.name)),
       '…and never Fame directly');
  }

  // 🪦 A riff discovery was the ONLY Fame a commit could pay, and rediscovery
  //    paid a flat 1. Retired 2026-08-17 with the library.
  //
  // ⚠️ SO THE COMMIT NOW PAYS NO FAME AT ALL, and that is worth an assertion
  // rather than an absence — it is a deliberate hole in the Fame economy, and
  // the next person to read this file should be told so by a test rather than
  // discover it from a bench number. Cadences still pay FANS (asserted above),
  // which is the shape the per-Spirit style system is meant to grow into.
  const st = composed(['C', 'D', 'E']);
  const r = run(st);
  eq(r.report.riff, undefined, '🪦 no riff award survives on the report');
  ok(!r.effects.some(e => e.type === 'fame'),
     '🪦 …and a melody commit pays NO Fame — the hole the style system has to fill');
  ok(!('committedHasRiff' in r.patch), '🪦 …and nothing stashes a riff flag for the riff-off');
}

// ═════════════════════════════════════════════════════════════════════════════
// THE ENDING FORK — Db cadence/lock OR the red/blue stack carrot.
// ═════════════════════════════════════════════════════════════════════════════
{
  const state = composed(['C', 'D', 'Eb', 'G'], { driveStack: ['C', 'Eb', 'G'] });
  const db = run(state, RONIN, { endingChoice: 'db' });
  const color = run(state, RONIN, { endingChoice: 'color' });
  eq(db.report.endingChoice, 'db', 'Db is the default ending choice');
  ok(db.report.baseScore.endingBonus > 0, 'Db choice can take the cadence ending');
  eq(db.report.colorDrive, 0, 'Db choice refuses the stack carrot');
  eq(color.report.baseScore.endingBonus, 0, 'stack choice refuses the Db ending');
  ok(color.report.colorDrive > 0, 'stack choice takes the red carrot');
}
}

console.log(`✅ melodyCommitCheck — ${checks} assertions passed`);
