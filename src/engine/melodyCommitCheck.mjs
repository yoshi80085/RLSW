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
//      track must be visibly worth more than a short one, in Db and in AP. This
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
import { makeInitialState } from "./state.js";
import { applyAction } from "./reduce.js";
import { legalActions } from "./policies/legalActions.js";
import { applyBotAction, PARTIAL_KINDS } from "./policies/transition.js";
import {
  commitMelodyEconomy, positionFanGain, deedFanGain, performanceFanGain,
  checkWaNoKoe, CLIENT_OWNED, COLOR_PAYOUT_CAP, RONIN_PERF_CLIFF,
  MIC_VOICE_ROLL_DIE, MIC_VOICE_ROLL_PASS, SPEED_CAP,
} from "./systems/melodyCommit.js";
import { performanceScore } from "./systems/economy.js";
import { scoreTrackDB } from "../music/cadence.js";
import { discordPenaltyFor } from "../music/context.js";
import { advanceDB } from "../board/boardHelpers.js";
import { CORNERS } from "../data/corners.js";
import {
  DB_UPGRADE_THRESHOLD, FAN_CASUAL_CAP, FAN_DIEHARD_CAP, FAN_PROMOTE_EVERY,
  FAN_GAIN_BY_RING, FAN_BORED_AFTER, FAN_DECAY, EXCITE_PER_CASUAL,
  LIMELIGHT_HEX, FAME_PER_TURN_CAP,
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
  melodyLine: track, rootNote: 'C', scaleMode: 'major',
  unlockedSkills: [], discordUnlocks: [], driveStack: [], sustainStack: [],
  dbPoints: 0, totalDB: 0, excitement: 0, loyalty: 0, recentP: [], lowPerfStreak: 0,
  finalsTrail: [], cadenceCooldowns: {}, bankedNote: null, tempDrive: 0, tempSustain: 0,
  casuals: 0, diehards: 2, centerStreak: 0, fanLag: 0, mojoDrain: 0,
  targetSkillId: null, upgradesPending: 0, payoutRouting: {}, ...extra,
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
  eq(a.report.earned, b.report.earned, 'two calls on one state agree on Db');
  eq(a.report.perfScore, b.report.perfScore, 'two calls on one state agree on P');
  deep(a.patch, b.patch, 'two calls on one state produce an identical patch');
  ok(!Object.is(a.patch, b.patch), 'each call returns a fresh patch, not a shared one');

  // The patch is a description, not an application.
  deep(nsOf(st, RONIN).melodyLine, ['C', 'E', 'G'], 'the source sheet still holds the track');
  eq(nsOf(st, RONIN).hasConfirmed, false, 'the source sheet is still unconfirmed');
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
  ok(long.report.earned >= short.report.earned, 'a longer clean track earns at least as much Db');
  ok(long.hexes > short.hexes, '…and strictly more AP');
  ok(long.report.earned + long.hexes > short.report.earned + short.hexes,
     'the two halves of the melody’s value point the same way');

  // And the Db is REAL — it reaches the sheet, not just the report.
  ok(long.patch.dbPoints > 0 || long.patch.totalDB > 0, 'earned Db lands on the sheet');
  eq(long.patch.totalDB, long.report.earnedTotal, 'totalDB accumulates the full payout');
  eq(long.patch.hasConfirmed, true, 'the mechanical half still fires');
  deep(long.patch.melodyLine, [], 'the track is cleared on confirm');
  deep(long.patch.committedMelody, ['C', 'D', 'E', 'F', 'G'], '…and stashed for the riff-off');
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. THE FOUR Db SOURCES — length, ending, lock, penalty. No fifth.
// ═════════════════════════════════════════════════════════════════════════════
{
  const track = ['C', 'D', 'E', 'G'];        // ends on the 5th
  const r = run(composed(track));
  const base = scoreTrackDB(track, 'F', 'G');
  eq(r.report.baseScore.points, base.points, 'length + ending come from scoreTrackDB, untouched');
  eq(r.report.earned, Math.max(0, base.points + r.report.lock.bonus - r.report.discordPenalty),
     'earned = length+ending + lock − penalty, and nothing else');
  eq(r.report.dbOverflow, 0, '⚠️ the discarded boost NO LONGER feeds Db (13% of income, deleted)');
  eq(r.report.earnedTotal, r.report.earned, 'with the Edge and P-topup gone, the pot is just `earned`');

  // 🔒 Harmonic Lock ESCALATES the ending bonus, so it REQUIRES one.
  const locked = run(composed(track, { driveStack: ['C', 'E', 'G'] }));
  ok(locked.report.lock.bonus > 0, 'landing on a chord tone with an ending bonus locks');
  ok(locked.report.earned > r.report.earned, '…and pays more than the same track with no chord');

  const noEnding = ['C', 'D', 'E', 'A'];     // A is neither 4th nor 5th nor octave
  const noLock = run(composed(noEnding, { driveStack: ['A', 'C', 'E'] }));
  eq(noLock.report.baseScore.endingBonus, 0, 'no ending bonus on this track');
  eq(noLock.report.lock.bonus, 0, '⚠️ no ending bonus ⇒ NO LOCK, even on a chord tone');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. B7 — THE DISCORD PENALTY HAS TEETH. First one free, per note, floored.
// ═════════════════════════════════════════════════════════════════════════════
{
  const one = run(composed(['C', 'D', 'C#', 'G']));
  eq(one.report.unpardonedDiscord, 1, 'one out-of-scale note');
  eq(one.report.discordPenalty, discordPenaltyFor(1), 'the penalty comes from the shared curve');
  eq(one.report.discordPenalty, 0, '…and the first wrong note is free');

  const three = run(composed(['C', 'C#', 'D#', 'F#', 'G']));
  eq(three.report.unpardonedDiscord, 3, 'three out-of-scale notes');
  ok(three.report.discordPenalty > 0, '…and past the grace they cost');
  eq(three.report.discordPenalty, discordPenaltyFor(3), 'still the shared curve, not a local copy');

  // 🌀 Freestyle stacks WITH the grace — two free notes for Intergalactic 0.
  const zeroSt = composed(['C', 'C#', 'D#', 'F#', 'G'], {}, ZERO);
  const zeroR  = run(zeroSt, ZERO);
  eq(zeroR.report.effectiveDiscord, 2, "Intergalactic 0's freestyle pardons the first wrong note");
  ok(zeroR.report.discordPenalty < three.report.discordPenalty,
     '…so the same track costs him strictly less');
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. B4 — COLOUR PAYS THE STACK THAT AUTHORIZED IT, in Drive/Sustain, never Db.
// ═════════════════════════════════════════════════════════════════════════════
{
  // A stack that legalizes an out-of-scale note turns it from a tax into income.
  const bare  = run(composed(['C', 'D', 'D#', 'E', 'G']));
  const chord = run(composed(['C', 'D', 'D#', 'E', 'G'], { driveStack: ['C', 'D#', 'G'] }));
  ok(chord.report.contextPardons.drive >= bare.report.contextPardons.drive,
     'a chord containing the grey note legalizes it');
  ok(chord.report.colorDrive <= COLOR_PAYOUT_CAP, 'colour is capped per stack per commit');
  eq(chord.report.dbOverflow, 0, '⚠️ colour never pays Db — that is the ENDING’s job');

  // Mojo Drain suppresses the colour payout entirely.
  const drained = run(composed(['C', 'D', 'D#', 'E', 'G'], { driveStack: ['C', 'D#', 'G'], mojoDrain: 2 }));
  eq(drained.report.colorDrive, 0, 'Mojo Drain eats the colour payout');
  eq(drained.patch.tempDrive, 0, '…and the Drive boost with it');
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. 🎭 PERFORMANCE SCORE — the shared kernel, and P PAYS THE CROWD ALONE.
// ═════════════════════════════════════════════════════════════════════════════
{
  const track = ['C', 'G', 'E', 'C', 'A', 'F'];
  const r = run(composed(track));
  const direct = performanceScore({
    melodyLine: track,
    trackHasTritone: r.report.trackHasTritone,
    isOctaveResolution: r.report.isOctaveResolution,
    diatonicRunLen: r.report.diatonicRunLen,
    repeatPatLen: r.report.repeatPatLen,
    skipClimbLen: r.report.skipClimbLen,
    hasGatedEnding: r.report.hasGatedEnding,
    cadenceResolved: !!r.report.cadence,
    // 🎭 The per-Spirit style score is an INPUT to P, so re-deriving P without it
    // is re-deriving a different number. Reading it off the report rather than
    // re-detecting is the point of the assertion: it pins that the style the
    // report announces is the same one that was paid for.
    styleBig: r.report.style.score,
    earned: r.report.earned, edgeResolved: false, susEnd: false,
    discordCount: r.report.unpardonedDiscord, freestylePardon: false,
  });
  eq(r.report.perfScore, direct.score, 'P comes from economy.js’s kernel, not a second copy');
  ok(r.report.perfScore >= 0 && r.report.perfScore <= 10, 'P is clamped to 0..10');
  eq(r.patch.perfScore, r.report.perfScore, 'P lands on the sheet for the crowd to read');

  // ⚠️ P must not appear anywhere in the Db arithmetic.
  eq(r.report.earnedTotal - r.report.earned, 0, 'P contributes exactly 0 Db');
  deep(r.patch.recentP.slice(-1), [r.report.perfScore], 'recentP keeps the last two shows');
}

// ═════════════════════════════════════════════════════════════════════════════
// 8b. 🎭 PER-SPIRIT STYLE — the riff library's replacement.
// ═════════════════════════════════════════════════════════════════════════════
//
// ⚠️ THE LOAD-BEARING ASSERTION IS THE LAST ONE: STYLE PAYS FANS AND NEVER FAME.
// The riffs were retired because they handed over a third of the win in one
// commit off the note DRAW. Anything that reinstates a Fame payout here has
// re-created the mechanic, and it will look like a balance tweak in the diff.
{
  const plain  = run(composed(['C', 'D', 'E', 'F'],  {}, METAL), METAL);
  const styled = run(composed(['C', 'F#', 'G', 'A'], {}, METAL), METAL);
  deep(plain.report.style.hits, [], 'a line with none of his gestures scores no style');
  deep(styled.report.style.hits, ['diabolus'], 'C→F# is a tritone, and G walks away from it');
  ok(styled.report.perfScore > plain.report.perfScore,
     'landing your Spirit’s gesture raises the Performance Score');

  // The SAME track read from another seat scores nothing — this is what makes
  // the commit phase distinguish the roster, which THEORY_ARCHITECTURE.md §2
  // names as the one place four characters used to play identically.
  const wrongSeat = run(composed(['C', 'F#', 'G', 'A'], {}, RONIN), RONIN);
  deep(wrongSeat.report.style.hits, [], 'the tritone is Metalness’s gesture, not the Ronin’s');

  const roninRun = run(composed(['C', 'D', 'E', 'F'], {}, RONIN), RONIN);
  ok(roninRun.report.style.hits.includes('run'), 'four stepwise notes is the Ronin’s run');

  // 🪦 THE RULE THE RIFFS BROKE.
  eq(styled.patch.fame ?? 0, plain.patch.fame ?? 0, 'style pays no Fame — not one point');
  ok((styled.report.perfExciteGain ?? 0) > (plain.report.perfExciteGain ?? 0),
     '…it pays the CROWD, through P’s excitement, where it can only multiply');
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
// 13. 🎵 WA NO KOE — and the bug it is FAITHFUL TO.
// ═════════════════════════════════════════════════════════════════════════════
{
  eq(checkWaNoKoe(['C', 'E', 'G'], ['C', 'E', 'G'], {}), null, 'locked without the skill');
  eq(checkWaNoKoe(['C', 'E', 'G'], [], { unlockedSkills: ['wa_no_koe'] }), null, 'an empty chord aligns with nothing');
  eq(checkWaNoKoe(['A', 'B', 'D'], ['C', 'E', 'G'], { unlockedSkills: ['wa_no_koe'] }), null, 'under half is not alignment');
  const fired = checkWaNoKoe(['C', 'E', 'A'], ['C', 'E', 'G'], { unlockedSkills: ['wa_no_koe'], driveStack: ['C', 'E', 'G'] });
  eq(fired.stat, 'drive', 'the bigger stack takes the boost, ties to Drive');
  eq(fired.turnsLeft, 3, '…for three rounds');

  // ⚠️ THE BUG, PINNED. In Game, `applyWaNoKoe` reads `curTemp` off the
  // PRE-commit sheet and writes `curTemp + 1` over the tempDrive the commit just
  // set — so a turn that earns BOTH a Drive boost and Wa no Koe silently
  // discards the boost. Reproduced deliberately; see BOT_STRATEGY_HANDOFF §7.
  const st = composed(['C', 'D', 'E', 'F', 'G'], {
    unlockedSkills: ['wa_no_koe'], driveStack: ['C', 'E', 'G'], tempDrive: 0,
  });
  const r = run(st);
  if (r.report.waNoKoe?.stat === 'drive') {
    ok(r.report.diatonicRunLen >= 3, 'this track does earn a Drive boost');
    eq(r.patch.tempDrive, 1, '⚠️ …and Wa no Koe OVERWRITES it with prevTempDrive + 1 — faithful to the shipped bug');
  }
  // A non-Ronin never fires it, whatever they have unlocked.
  const metal = run(composed(['C', 'E', 'G'], { unlockedSkills: ['wa_no_koe'], driveStack: ['C', 'E', 'G'] }, METAL), METAL);
  eq(metal.report.waNoKoe, null, 'Wa no Koe is the Ronin’s, and only his');
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
    ['perfScore >= 5',                                    `the Ronin cliff (now ${RONIN_PERF_CLIFF}, kernel-side only)`],
  ];
  for (const [needle, what] of goneFromClient) {
    ok(!src.includes(needle),
       `⚠️ ${what} is BACK in the monolith — the commit economy has forked again; it belongs in systems/melodyCommit.js`);
  }

  // Two decisions the kernel already made, which the client must not re-make.
  ok(!src.includes('awardTargetSkill(acting.id)'),
     '⚠️ awardTargetSkill at the commit site would find targetSkillId already cleared and silently skip applySkillEffects');
  ok(!src.includes('function applyWaNoKoe('),
     '⚠️ Wa no Koe is written by the commit patch — a second application would double the buff');
  ok(!src.includes('function checkWaNoKoe('),
     '⚠️ the Wa no Koe RULE lives in the kernel; a client copy is a third one');
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
  ok(after.totalDB > 0, '⚠️ AND THE ECONOMIC HALF FIRED — this is what was missing');
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
// 16. §3.2's TENSION IS VISIBLE — the Db bar advances toward the TARGET's cost,
//     not a flat threshold, and an unlock actually lands.
// ═════════════════════════════════════════════════════════════════════════════
{
  const skillById = { theory_major: { id: 'theory_major', label: 'Major Theory', dbCost: 3 } };
  const st = composed(['C', 'D', 'E', 'G'], { targetSkillId: 'theory_major', dbPoints: 2 });

  const noView = run(st);
  eq(noView.report.targetCost, DB_UPGRADE_THRESHOLD,
     'without `skillById` the real cost is UNKNOWN, so the bar falls back to the default');

  const withView = run(st, RONIN, { view: { skillById } });
  eq(withView.report.targetCost, 3, 'with it, the bar targets the skill’s own dbCost');
  const expect = advanceDB(2, withView.report.earnedTotal, 3);
  eq(withView.report.upgradeTriggered, expect.upgradeTriggered, 'the bar comes from advanceDB, not a local copy');
  eq(withView.report.newDBPoints, Math.max(0, expect.newDBPoints), '…including the remainder');

  if (withView.report.upgradeTriggered) {
    eq(withView.report.awardedSkillId, 'theory_major', 'a triggered upgrade awards the TARGET skill');
    ok(withView.patch.unlockedSkills.includes('theory_major'), '⚠️ …and it reaches unlockedSkills');
    eq(withView.patch.targetSkillId, null, 'the target clears so the next commit picks a new one');
    eq(withView.patch.upgradesPending, 1, 'and the overlay is queued');
  }

  // No target, but the bar filled anyway: the pending upgrade is held, not lost.
  const noTarget = run(composed(['C', 'D', 'E', 'F', 'G'], { targetSkillId: null, dbPoints: 3 }));
  if (noTarget.report.upgradeTriggered) {
    eq(noTarget.report.awardedSkillId, null, 'nothing is awarded without a target');
    eq(noTarget.patch.upgradesPending, 1, '…but the upgrade is held pending');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
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
// 🎯 THE FOUR UNGATED FLAGS — 2026-09-02i. `discordUnlocks` IS EMPTY HERE
// AND THAT IS THE WHOLE POINT.
//
// `composed()` sets `discordUnlocks: []`, which is what every Spirit in the
// shipped game has and can never stop having: `THEORY_DISCORD_GRANTS` was the
// only writer and it went with the branch. Before the ungating, these four
// assertions were unwritable — `hasGatedEnding` was `false` by construction on
// every possible input, and `chromClimbActive` could not be reached at all.
//
// ⚠️ THIS IS THE CHECK THAT WOULD HAVE CAUGHT THE ORIGINAL HOLE. The endings and
// the pardon were only ever exercised through a skill purchase, so deleting the
// granter left four rules with no test standing on them — `MELODY_IDENTITY_DESIGN.md`
// §5.6's "four dead flags, not three". These stand on the RULE instead.
// ═════════════════════════════════════════════════════════════════════════════
{
  // ♭7 in major: C major, land on Bb (the spelling `getIntervalNotes` returns).
  const m7 = run(composed(['C', 'D', 'E', 'Bb']));
  ok(m7.report.hasGatedEnding,
     '🎯 the ♭7 ending pays its crowd seat with nothing unlocked — it was dead for every Spirit until 2026-09-02i');

  // The tritone, in either mode: C major, land on F#.
  const tt = run(composed(['C', 'D', 'E', 'F#']));
  ok(tt.report.hasGatedEnding, '🎯 …and so does the tritone ending');

  // ⚠️ AND AN ORDINARY ENDING STILL DOES NOT. Without this the two above would
  // pass just as happily against `hasGatedEnding = true`, which is the failure
  // mode `legalActionsCheck` §15 is named for.
  const plain = run(composed(['C', 'D', 'E', 'G']));
  ok(!plain.report.hasGatedEnding,
     '🎯 …while landing on the 5th does NOT — the flag reads the ending, not the commit');

  // 🎤 THE PARDON. A chromatic run of 3+ declares the track clean to the CROWD —
  // `MELODY_IDENTITY_DESIGN.md` §5.5's "the crowd forgives THIS kind of wrong
  // note", which had not executed once since the branch came off.
  const chrom = run(composed(['C', 'C#', 'D', 'D#']));
  ok(chrom.report.chromClimbActive, '🎤 a chromatic run of 3+ is live with nothing unlocked');
  ok(chrom.report.allInScale,
     '🎤 …and it forces `allInScale`, so `positionFanGain` pays a dirty track — the per-character seam');
  ok(chrom.report.unpardonedDiscord > 0,
     '⚠️ …while the Db side still counts the dirt — the pardon is the CROWD\'s, not the ledger\'s');
}

console.log(`✅ melodyCommitCheck — ${checks} assertions passed`);
