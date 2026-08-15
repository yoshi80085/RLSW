// ─── ENGINE SYSTEM: MELODY COMMIT (the economic half of the commit) ──────────
// `commitMelodyEconomy(state, spiritId, ctx) -> { ok, patch, effects, hexes, report, ... }`
// BOT_STRATEGY_HANDOFF §6b.1 — the hole this file exists to close.
//
// §1's spine says the melody you commit buys your ability to act. The engine has
// always owned the MECHANICAL half of that sentence (`moveBudgetSet` → AP) and
// never the ECONOMIC half — the Db, the Performance Score, the fans, the banked
// note, the riff, the cadence. Those lived ~600 lines deep inside
// `confirmNoteTrack`, tangled with React setters, so `applyBotAction` could only
// declare `confirmMelody` PARTIAL and a searcher could only see half of what a
// melody is worth. A searcher blind to the scoring half systematically prefers
// SHORT tracks: it can see that three notes cost less stock than six, and cannot
// see that six notes pay Db, flair, and a crowd.
//
// ⚠️ THIS FILE IS PURE AND OWNS NO SIDE EFFECTS. It computes; it does not write.
// It returns a note-sheet `patch` and an ORDERED `effects` list, and the caller
// applies them through the reducer. That is what lets the same arithmetic serve
// three callers that cannot share a call stack — the client (React setters), the
// bot transition (`applyAction`), and a server — without a fourth copy.
//
// ── ⚠️ THE ORDER OF `effects` IS LOAD-BEARING ───────────────────────────────
// The client fires these at 0ms / 0ms / 500ms / 700ms, and the staggering is not
// cosmetic: the riff's Fame payout is multiplied by the crowd, so it must see the
// fans this commit already won but NOT the cadence fans that land after it. Walk
// `effects` in order and the arithmetic matches the shipped game; reorder it and
// a riff quietly pays a different number of Fame Points.
//
// ── WHAT IS STILL THE CLIENT'S ─────────────────────────────────────────────
// Named in `report.clientOwned`, so the gap is announced at every call rather
// than remembered from a doc — the same honest pattern as `PARTIAL_KINDS`:
//   · `applySkillEffects` — the STATE half of a skill award is modelled here
//     (unlockedSkills, targetSkillId cleared); the side-effect chain is not.
//   · presentation — `playTrackSequence`, `playRiffSequence`, the banners, the
//     toasts, the tips, the d6 spin. `flashLines` is returned so a rewired
//     `confirmNoteTrack` can render without recomputing anything.
//   · `unsurePool` — the undecided crowd is client state. Pass it in via
//     `ctx.view.unsurePool`; the recruit it funds comes back as an effect.

import {
  pitchIndex, buildScale, playableScale, getIntervalNotes,
  semitonesUpSpelled, ENHARMONIC_RESPELL,
} from "../../music/notes.js";
import {
  detectCadence, detectChromaticRun, detectDiatonicRun, detectSkipClimb,
  detectRepeatPattern, driveBoostFromRun, sustainBoostFromPattern, scoreTrackDB,
} from "../../music/cadence.js";
import {
  classifyTrack, countUnpardoned, countPardonedByStack,
  harmonicLock, discordPenaltyFor,
} from "../../music/context.js";
import { detectRiff } from "../../music/riffLibrary.js";
import { performanceScore } from "./economy.js";
import { hexRingFromCenter, crowdMultiplier, advanceDB } from "../../board/boardHelpers.js";
import { DISCORD_INTERVAL_MAP } from "../policies/bot.js";
import { SPIRIT_DEFS } from "../../data/spirits.js";
import {
  DB_UPGRADE_THRESHOLD,
  FAN_GAIN_BY_RING, FAN_PROMOTE_EVERY, FAN_BORED_AFTER, FAN_DECAY,
  FAN_CASUAL_CAP, FAN_DIEHARD_CAP, FAN_DIEHARD_START, FAN_CASUAL_START,
  EXCITE_PER_CASUAL, LOYALTY_PER_DIEHARD,
} from "../../data/gameConstants.js";

/** Speed caps at 5 (`Math.min(5, …)` in Game). Inert today — no Spirit exceeds
 *  5 — but kept because it is the rule, and a future 6-speed kit would find it. */
export const SPEED_CAP = 5;

/** 🎤 The mic skill's voice roll: d6, bonus in-scale note on 4+. */
export const MIC_VOICE_ROLL_DIE = 6;
export const MIC_VOICE_ROLL_PASS = 4;

/** Colour notes pay at most +2 per stack per commit (B4). */
export const COLOR_PAYOUT_CAP = 2;

/** ⚠️ Ronin's virtuoso cliff. Same 5 as `evaluate.js`'s `PERF_CLIFF`, and the
 *  same reason it does not live in `gameConstants`: there is no per-Spirit
 *  innate-numbers module yet (§7). If a second innate needs a threshold, that
 *  is the moment to make one rather than scatter a third copy. */
export const RONIN_PERF_CLIFF = 5;

/** Below this Performance Score a non-Ronin Spirit is building a boredom streak. */
export const LOW_PERF_FLOOR = 4;

/** What this kernel still does not do. Read it; do not remember it. */
export const CLIENT_OWNED = [
  'applySkillEffects', 'presentation', 'unsurePoolWrite',
];

// ─── FAN FOLDS ───────────────────────────────────────────────────────────────
// Two pure transforms over the fan bands, lifted from `gainFans` and
// `gainFansFromDeed`. They are separate functions because they are separate
// rules — position pays for WHERE you played, the deed pays for WHAT you landed
// — and because the client applies them at different moments (see the ordering
// note above). Both fold rather than sum: casuals are capped at each step, so
// adding the two gains together first would let a commit exceed the cap.

/**
 * 🎤 Position fans — a clean track played in the centre rings pulls a crowd.
 * Returns `null` when the rules pay nothing at all, which is NOT the same as
 * paying zero: `gainFans` early-returns before touching `centerStreak`, so a
 * discordant track does not even advance the promotion clock.
 */
export function positionFanGain(fans, hexNum, clean, unsurePool = 0) {
  const ring = hexRingFromCenter(hexNum);
  const inCentre   = ring === 'main' || ring === 'pit';
  const inGainZone = inCentre || ring === 'floor';
  if (!clean || !inGainZone || (fans.fanLag ?? 0) > 0) return null;

  const base    = FAN_GAIN_BY_RING[ring] ?? 0;
  // Only the spotlight (main/pit) wins over the undecided crowd on the centre.
  const recruit = inCentre ? Math.min(Math.max(0, unsurePool), base) : 0;
  let casuals   = Math.min(FAN_CASUAL_CAP, (fans.casuals ?? 0) + base + recruit);
  let diehards  = fans.diehards ?? FAN_DIEHARD_START;
  let streak    = fans.centerStreak ?? 0;
  let promoted  = false;
  if (inCentre) {
    streak += 1;
    if (streak % FAN_PROMOTE_EVERY === 0 && casuals > 0 && diehards < FAN_DIEHARD_CAP) {
      casuals -= 1; diehards += 1; promoted = true;
    }
  }
  return {
    fans: { casuals, diehards, centerStreak: streak, fanActedThisTurn: inCentre },
    ring, base, recruit, promoted,
  };
}

/**
 * 🎯 Deed fans — a cadence resolved is a melody-line feat, so it builds crowd,
 * never Fame. The centre bonus stacks on top of the deed's own value.
 */
export function deedFanGain(fans, hexNum, baseAmount) {
  if (!(baseAmount > 0)) return null;
  const ring = hexRingFromCenter(hexNum);
  const inCentre    = ring === 'main' || ring === 'pit';
  const centreBonus = ring === 'main' ? 2 : ring === 'pit' ? 1 : ring === 'floor' ? 1 : 0;
  const gain = baseAmount + centreBonus;
  let casuals  = Math.min(FAN_CASUAL_CAP, (fans.casuals ?? 0) + gain);
  let diehards = fans.diehards ?? FAN_DIEHARD_START;
  let streak   = fans.centerStreak ?? 0;
  let promoted = false;
  if (inCentre) {
    streak += 1;
    if (streak % FAN_PROMOTE_EVERY === 0 && casuals > 0 && diehards < FAN_DIEHARD_CAP) {
      casuals -= 1; diehards += 1; promoted = true;
    }
  }
  return {
    fans: { casuals, diehards, centerStreak: streak, fanActedThisTurn: true, fanLag: 0 },
    ring, gain, promoted,
  };
}

/**
 * 🎭 Performance fans — P drives excitement (new casuals) and loyalty (casual →
 * diehard). ⚠️ P NEVER PAYS FAME. Fans only ever MULTIPLY earned FP.
 */
export function performanceFanGain(fans, gained, promotions, lost) {
  let casuals  = fans.casuals  ?? FAN_CASUAL_START;
  let diehards = fans.diehards ?? FAN_DIEHARD_START;
  casuals = Math.min(FAN_CASUAL_CAP, casuals + gained);
  for (let i = 0; i < promotions; i++) {
    if (casuals > 0 && diehards < FAN_DIEHARD_CAP) { casuals -= 1; diehards += 1; }
  }
  casuals = Math.max(0, casuals - lost);   // 🗡️ bored fans walk (Ronin's weak shows)
  return { casuals, diehards };
}

// ─── 🎵 WA NO KOE — Ronin's harmony passive ─────────────────────────────────
/**
 * Melody aligned with the chord stack (≥ half the notes) converts to +1 Drive or
 * Sustain for 3 rounds. Pure; returns `null` when it does not fire.
 */
export function checkWaNoKoe(melodyLine, chordStack, ns = {}) {
  if (!(ns.unlockedSkills ?? []).includes('wa_no_koe')) return null;
  if (!melodyLine || melodyLine.length === 0 || !chordStack) return null;
  const chordNotes = new Set((chordStack ?? []).map(n => typeof n === 'string' ? n.replace(/\d/g, '') : n));
  if (chordNotes.size === 0) return null;
  const melodyNotes = melodyLine.map(n => typeof n === 'string' ? n.replace(/\d/g, '') : n);
  const matchCount  = melodyNotes.filter(n => chordNotes.has(n)).length;
  if (matchCount / melodyNotes.length < 0.5) return null;
  const stat = (ns.driveStack ?? []).length >= (ns.sustainStack ?? []).length ? 'drive' : 'sustain';
  return { stat, turnsLeft: 3 };
}

// ─── THE COMMIT ──────────────────────────────────────────────────────────────
/**
 * Run the economic half of a melody commit.
 *
 * @param {object} state    engine GameState
 * @param {string} spiritId the committing Spirit (Game's `acting`)
 * @param {object} ctx
 *   · `rng`  seeded rng. ⚠️ CONSUMES DRAWS — one for the mic voice roll, and a
 *            second for the bonus note when the roll passes. Nothing else in
 *            this file is random. Must be a fork (`rng.fork('search')`) when
 *            called speculatively (§0.4). Omit it and the mic skill is skipped
 *            rather than silently rolled off `Math.random`.
 *   · `view` client-owned slices: `skillById` (SKILL_TREE still lives in the
 *            monolith — without it a target skill's real `dbCost` is unknown and
 *            the threshold falls back to `DB_UPGRADE_THRESHOLD`), `riffBook`
 *            (who has already discovered which riff), `unsurePool`.
 *
 * @returns {object}
 *   · `ok`      false only when there is nothing to commit
 *   · `patch`   note-sheet patch for `spiritId` (apply via `noteSheetPatched`)
 *   · `effects` ORDERED list — `{type:'fans'|'fame'|'unsurePool', …}`. See the
 *               ordering warning at the top of this file.
 *   · `hexes`   `usableMoves` — the AP grant §1 is about
 *   · `report`  every derived number a caller, a check, or a searcher wants
 *   · `logs` / `flashLines`  transcribed copy, so a rewired client renders
 *               without recomputing
 */
export function commitMelodyEconomy(state, spiritId, ctx = {}) {
  const { rng, view = {} } = ctx;
  const ns     = state?.noteStates?.[spiritId];
  const spirit = (state?.spirits ?? []).find(s => s.id === spiritId);
  if (!ns || !spirit) return { ok: false, reason: 'no such spirit', patch: null, effects: [], logs: [] };

  const baseTrack = ns.melodyLine ?? [];
  if (baseTrack.length === 0) return { ok: false, reason: 'empty track', patch: null, effects: [], logs: [] };

  const logs = [], flashLines = [];
  const name = spirit.name ?? spiritId;

  const rootNote       = ns.rootNote  ?? 'C';
  const scaleMode      = ns.scaleMode ?? 'major';
  const unlockedSkills = ns.unlockedSkills ?? [];
  const discordUnlocks = ns.discordUnlocks ?? [];
  const driveStack     = ns.driveStack   ?? [];
  const sustainStack   = ns.sustainStack ?? [];
  const melodyFreq     = ns.melodyFreq   ?? [];

  // ── 🎤 MIC — the voice roll SHADOWS the track ─────────────────────────────
  // ⚠️ Everything below scores `melodyLine`, not `baseTrack`. A bonus note the
  // player never placed still counts for Db, for P, for the ending, and for the
  // AP grant — which is the whole point of the skill.
  let melodyLine = baseTrack;
  let voiceRoll = null, micBonusNote = null;
  if (unlockedSkills.includes('mic') && typeof rng?.int === 'function') {
    voiceRoll = rng.int(MIC_VOICE_ROLL_DIE) + 1;
    if (voiceRoll >= MIC_VOICE_ROLL_PASS) {
      const scaleNotes = buildScale(rootNote, scaleMode);
      micBonusNote = scaleNotes[rng.int(scaleNotes.length)];
      melodyLine = [...baseTrack, micBonusNote];
      logs.push(`🎤 Voice roll ${voiceRoll} — your vocals land! Bonus note ${micBonusNote} joins the track.`);
    } else {
      logs.push(`🎤 Voice roll ${voiceRoll} — the crowd drowns you out. No bonus note.`);
    }
  }

  // ── 🎼 RIFF DETECTION ─────────────────────────────────────────────────────
  const riffMatch = detectRiff(melodyLine);
  let riffAward = null;
  if (riffMatch) {
    const isNew = !(view.riffBook ?? {})[riffMatch.riff.id];
    // ⚠️ `riff` and `rootPc` ride along for PRESENTATION ONLY — `playRiffSequence`
    // needs the riff object and the key it matched in. They are carried rather
    // than re-derived because a client that calls `detectRiff` again is a second
    // copy of a decision this kernel already made.
    riffAward = { riffId: riffMatch.riff.id, name: riffMatch.riff.name, fp: isNew ? riffMatch.riff.fp : 1, isNew,
                  riff: riffMatch.riff, rootPc: riffMatch.rootPc };
    logs.push(isNew
      ? `🎼✨ RIFF DISCOVERED — ${riffMatch.riff.name}! ${name} writes it into the Riffbook!`
      : `🎼 ${name} plays ${riffMatch.riff.name}!`);
  }

  // ── 🎯 CADENCE — the track's FINAL note is this turn's "final" ─────────────
  const cooldowns = ns.cadenceCooldowns ?? {};
  const lastPc = pitchIndex(melodyLine[melodyLine.length - 1]);
  let cadenceResolved = false, cadence = null, trailPatch = {};
  if (lastPc >= 0) {
    const newTrail = [...(ns.finalsTrail ?? []), lastPc].slice(-6);
    cadence = detectCadence(newTrail, cooldowns);
    if (cadence) {
      cadenceResolved = true;
      trailPatch = {
        finalsTrail: [lastPc],              // the resolution starts a fresh run
        cadenceCooldowns: { ...cooldowns, [cadence.id]: 3 },
      };
      logs.push(`🎯✨ ${name} resolves ${cadence.name} (${cadence.formula})!`);
    } else {
      trailPatch = { finalsTrail: newTrail };
    }
  }

  // ── 🎸 CHORD CONTEXT — THE SINGLE PASS (B3) ───────────────────────────────
  // ⚠️ `keyScale` and the stacks' pardons stay SEPARATE, permanently. The pardon
  // changes what a wrong note COSTS; it must not change what COUNTS as one.
  const intervals    = getIntervalNotes(rootNote, scaleMode);
  const currentScale = playableScale(rootNote, scaleMode, unlockedSkills);
  const unlockedIntervalKeys = new Set(
    DISCORD_INTERVAL_MAP
      .filter(t => discordUnlocks.includes(t.id))
      .flatMap(t => t.notesByMode?.[scaleMode] ?? t.notes ?? []));
  const keyScale = [...new Set([
    ...currentScale,
    ...[...unlockedIntervalKeys].map(k => intervals[k]).filter(Boolean),
  ])];

  // 🌀 Intergalactic 0's first wrong note each turn lands intentional, not wrong.
  const freestylePardon = spiritId === 'intergalactic_0';
  const trackClassified = classifyTrack(
    melodyLine, keyScale, driveStack, sustainStack, unlockedSkills, ns.payoutRouting ?? {});
  const unpardonedDiscord = countUnpardoned(trackClassified);
  const contextPardons    = countPardonedByStack(trackClassified);
  const effectiveDiscord  = Math.max(0, unpardonedDiscord - (freestylePardon ? 1 : 0));
  let allInScale = effectiveDiscord === 0;

  const lastNote   = melodyLine[melodyLine.length - 1];
  const firstNote  = melodyLine[0];
  // B8: the mode is DERIVED at the start of the next turn (`startNewTurnNotes` →
  // `modeFromStack`), so what is written here is a placeholder turn start will
  // overwrite. ⚠️ This is why "modeDerivation" was never really missing from the
  // transition — `turnFlow.js` already owns it.
  const newMode       = scaleMode;
  const newPivotPending = false;
  const newRootRaw    = ENHARMONIC_RESPELL[lastNote] ?? lastNote;

  // ── SPEED & BANKING — §1's spine ──────────────────────────────────────────
  const speed        = Math.min(SPEED_CAP, spirit.speed ?? SPIRIT_DEFS[spiritId]?.speed ?? 5);
  const totalNotes   = melodyLine.length;
  const usableMoves  = Math.min(totalNotes, speed);
  const overflow     = totalNotes - usableMoves;
  const existingBank = ns.bankedNote ?? null;
  const canBank      = overflow >= 1 && !existingBank;
  const newBankedNote = canBank ? { note: melodyLine[totalNotes - 1] } : existingBank;
  const hexes = usableMoves;

  const isMojoDrained = (ns.mojoDrain ?? 0) > 0;

  // ── INTERVAL EFFECTS ──────────────────────────────────────────────────────
  const trackHasTritone    = melodyLine.includes(intervals.tritone);
  const isOctaveResolution = hexes >= 2 && firstNote === lastNote;
  const hasBlues     = discordUnlocks.includes('discord_1');
  const hasBorrowed  = discordUnlocks.includes('discord_2');
  const hasTritoneUp = discordUnlocks.includes('discord_3');
  const hasChromClimb = discordUnlocks.includes('discord_4');
  const isMinorSeventhEnd = hasBlues && scaleMode === 'major' && lastNote === intervals.minorSeventh;
  const isMajorThirdEnd   = hasBorrowed && scaleMode === 'minor' && allInScale && lastNote === intervals.majorThird;
  const isTritoneEnd      = hasTritoneUp && lastNote === intervals.tritone;

  // B6: the chromatic run's Db payout was DELETED (it fired on 1% of commits).
  // The run still flips `allInScale`, which is what the CROWD reads — flair pays
  // fans now, not Decibills.
  const chromRunLen      = detectChromaticRun(melodyLine);
  const chromClimbActive = hasChromClimb && chromRunLen >= 3;
  if (chromClimbActive) allInScale = true;

  const diatonicRunLen = detectDiatonicRun(melodyLine, currentScale);
  const skipClimbLen   = detectSkipClimb(melodyLine, currentScale);
  const repeatPatLen   = detectRepeatPattern(melodyLine, currentScale);

  // ── B4: COLOR NOTES PAY THE STACK THAT AUTHORIZED THEM ────────────────────
  // In Drive/Sustain, never in Db. Db is the ENDING's payout; Drive/Sustain is
  // the INTERIOR's, and colour is an interior gesture. Folded into the RAW boost
  // rather than added afterwards, so colour flows through the same
  // highest-wins/discard machinery as every other boost — otherwise it would be
  // the one boost in the game that cannot be discarded.
  const colorDrive   = !isMojoDrained ? Math.min(COLOR_PAYOUT_CAP, contextPardons.drive)   : 0;
  const colorSustain = !isMojoDrained ? Math.min(COLOR_PAYOUT_CAP, contextPardons.sustain) : 0;

  const rawDriveBoost = !isMojoDrained ? driveBoostFromRun(diatonicRunLen) + colorDrive : 0;
  const prevTempDrive = ns.tempDrive ?? 0;
  let newTempDrive = prevTempDrive, driveOverflowToDB = 0;
  if (rawDriveBoost > 0) {
    if (rawDriveBoost > prevTempDrive) { driveOverflowToDB = prevTempDrive; newTempDrive = rawDriveBoost; }
    else                               { driveOverflowToDB = rawDriveBoost; }
  }

  const rawSustainBoost = !isMojoDrained ? sustainBoostFromPattern(repeatPatLen) + colorSustain : 0;
  const prevTempSustain = ns.tempSustain ?? 0;
  let newTempSustain = prevTempSustain, sustainOverflowToDB = 0;
  if (rawSustainBoost > 0) {
    if (rawSustainBoost > prevTempSustain) { sustainOverflowToDB = prevTempSustain; newTempSustain = rawSustainBoost; }
    else                                   { sustainOverflowToDB = rawSustainBoost; }
  }
  // ⚠️ The discard NO LONGER FEEDS Db. It was 13% of all Db income and the single
  // largest source the player could neither see, name, nor aim at — because it
  // paid out the half of a comparison that LOST. Kept as a display value only.
  const dbOverflow = 0;
  const discarded  = driveOverflowToDB + sustainOverflowToDB;

  const newDieFloorBoost = !isMojoDrained && isOctaveResolution ? 2 : 0;
  const newStatusEffects = [...(ns.statusEffects ?? [])];

  // ── THE Db PAYOUT — FOUR SOURCES, AND THAT IS THE POINT ───────────────────
  //   length  — how much did you play?          (scoreTrackDB step A)
  //   ending  — where did you come to rest?     (scoreTrackDB step B)
  //   lock    — was that landing in YOUR CHORD? (harmonicLock)
  //   penalty — how many notes fought the key?  (discordPenaltyFor)
  // Db pays for FACTS, not for taste. Everything cut was some version of trying
  // to score taste; that judgement moved to the crowd, where being
  // impressionistic is correct. See `perfScore` — it now feeds fans alone.
  const discordPenalty = discordPenaltyFor(effectiveDiscord);
  const baseScore = scoreTrackDB(melodyLine, intervals.fourth, intervals.fifth);
  // ⚠️ Harmonic Lock ESCALATES the ending bonus, so it REQUIRES one. No ending
  // bonus → no lock, even when the final note is a chord tone.
  const lock = baseScore.endingBonus > 0
    ? harmonicLock(lastNote, driveStack, sustainStack)
    : { bonus: 0, stack: null, rank: 0, chordName: null };

  const breakdown = [...baseScore.breakdown];
  if (lock.bonus > 0) breakdown.push(`🔒 ${lock.chordName} +${lock.bonus}`);
  const preDiscordPoints = baseScore.points + lock.bonus;
  const earned = Math.max(0, preDiscordPoints - discordPenalty);
  if (discordPenalty > 0 && preDiscordPoints > 0) breakdown.push(`−${discordPenalty} discord`);

  // ── ⚡ DISSONANCE EDGE — REMOVED. Pinned at 0 rather than deleted from the
  // arithmetic below, so the Db pot still reads as the single pot it is.
  const edgeDbCost = 0, edgeDbBonus = 0, edgeFanCost = 0, edgeCollapseFans = 0;
  const edgeResolvedThisTurn = false, newEdgeStage = 0;

  // ── 🎭 PERFORMANCE SCORE P ────────────────────────────────────────────────
  const perfSusEnd = unlockedSkills.includes('theory_sus')
    && (lastNote === semitonesUpSpelled(rootNote, scaleMode, 2) || lastNote === intervals.fourth);
  // B3: score the SETTLED count, not the placement counter — a note the chord
  // legalized was never a wrong note, so it must not drag the flair score either.
  const { score: perfScore, freestyle: perfFreestyle } = performanceScore({
    melodyLine,
    trackHasTritone, isOctaveResolution,
    diatonicRunLen, repeatPatLen, skipClimbLen,
    hasGatedEnding: isMinorSeventhEnd || isMajorThirdEnd || isTritoneEnd,
    hasRiff: !!riffMatch, cadenceResolved,
    earned, edgeResolved: edgeResolvedThisTurn, susEnd: perfSusEnd,
    discordCount: unpardonedDiscord, freestylePardon,
  });

  // ⚠️ P NO LONGER PAYS Db — IT PAYS THE CROWD, AND ONLY THE CROWD. Nobody minds
  // a fickle audience; everybody minds a fickle upgrade bar.
  const perfDbBonus = 0;
  const perfVibeFactor = (spirit.maxVibe ?? 5) / 5;
  // 🗡️ SHREDDING RONIN — the fans came for a masterpiece. P≥5 wins ~double the
  // crowd; short of it the meter COOLS (negative) and sustained mediocrity sheds
  // a casual. It is a CLIFF, not a slope — §5's highest-weighted term for him.
  const isRonin = spiritId === 'cosmic_ronin';
  const perfExciteGain = isRonin
    ? (perfScore >= RONIN_PERF_CLIFF
        ? (perfScore - (RONIN_PERF_CLIFF - 1)) * perfVibeFactor * 2
        : (perfScore - RONIN_PERF_CLIFF) * perfVibeFactor * 0.5)
    : Math.max(0, perfScore - (RONIN_PERF_CLIFF - 1)) * perfVibeFactor;
  let perfExcitement = (ns.excitement ?? 0) + perfExciteGain;
  let perfLoyalty    = Math.max(0, (ns.loyalty ?? 0) + perfExciteGain);
  let perfFansGained = 0, perfPromotions = 0, perfFansLost = edgeFanCost + edgeCollapseFans;
  while (perfExcitement >= EXCITE_PER_CASUAL)  { perfExcitement -= EXCITE_PER_CASUAL;  perfFansGained += 1; }
  while (perfLoyalty    >= LOYALTY_PER_DIEHARD) { perfLoyalty   -= LOYALTY_PER_DIEHARD; perfPromotions += 1; }
  while (perfExcitement <= -EXCITE_PER_CASUAL) { perfExcitement += EXCITE_PER_CASUAL;  perfFansLost   += 1; }

  // 🥱 Sustained mediocrity (everyone except Ronin, who has the instant version
  // above) — same FAN_BORED_AFTER / FAN_DECAY shape as positional boredom.
  const prevLowPerfStreak = ns.lowPerfStreak ?? 0;
  const lowPerfStreak = (!isRonin && perfScore < LOW_PERF_FLOOR) ? prevLowPerfStreak + 1 : 0;
  if (!isRonin && lowPerfStreak >= FAN_BORED_AFTER) perfFansLost += FAN_DECAY;

  // Four sources in, one number out.
  const earnedTotal = earned + dbOverflow + perfDbBonus + edgeDbBonus - edgeDbCost;

  // ── Db BAR & THE UPGRADE ──────────────────────────────────────────────────
  // ⚠️ §3.2's tension lives here: `dbCost` is the ONE-TIME unlock, but several
  // abilities then charge per use from the same pool. The bar does not know that;
  // the evaluator must.
  const targetSkill = ns.targetSkillId ? (view.skillById ?? {})[ns.targetSkillId] : null;
  const targetCost  = targetSkill?.dbCost ?? DB_UPGRADE_THRESHOLD;
  const { newDBPoints: rawDBPoints, upgradeTriggered } = advanceDB(ns.dbPoints ?? 0, earnedTotal, targetCost);
  const newDBPoints = Math.max(0, rawDBPoints);
  const newUpgradesPending = upgradeTriggered ? (ns.upgradesPending ?? 0) + 1 : (ns.upgradesPending ?? 0);

  // ── THE SHEET PATCH ───────────────────────────────────────────────────────
  const patch = {
    melodyLine: [], melodySrcIdx: [], melodyFreq: [],
    // Phase R1: the riff-off reads these; turn start clears them.
    // ⚠️ Mapped over `melodyLine`, not copied from `melodyFreq`: the mic roll
    // shadows the track and may append a note the player never played.
    committedMelody:  melodyLine,
    committedFreq:    melodyLine.map((_, i) => melodyFreq[i] ?? null),
    committedHasRiff: !!riffMatch,
    discordCount:  0,
    pivotPending:  newPivotPending,
    rootNote:      newRootRaw,
    scaleMode:     newMode,
    dbPoints:      newDBPoints,
    totalDB:       (ns.totalDB ?? 0) + earnedTotal,
    edgeStage:     newEdgeStage,
    perfScore,
    recentP:       [...(ns.recentP ?? []), perfScore].slice(-2),
    excitement:    perfExcitement,
    loyalty:       perfLoyalty,
    lowPerfStreak,
    upgradesPending: newUpgradesPending,
    hasConfirmed:  true,
    dieFloorBoost: newDieFloorBoost,
    statusEffects: newStatusEffects,
    tempDrive:     newTempDrive,
    tempSustain:   newTempSustain,
    bankedNote:    newBankedNote,
    transposeCardPending: null,
    ...trailPatch,
  };

  // ── THE SKILL AWARD — state half only ─────────────────────────────────────
  // `awardTargetSkill`'s sheet write is modelled; `applySkillEffects` is not
  // (see CLIENT_OWNED). A searcher that earned a capstone and never received it
  // would misprice every Db decision downstream, which is worse than the gap.
  let awardedSkillId = null;
  if (upgradeTriggered) {
    if (ns.targetSkillId) {
      awardedSkillId = ns.targetSkillId;
      const already = patch.unlockedSkills ?? unlockedSkills;
      patch.unlockedSkills      = already.includes(awardedSkillId) ? already : [...already, awardedSkillId];
      patch.upgradesPending     = 1;
      patch.pendingAwardSkillId = awardedSkillId;
      patch.targetSkillId       = null;
      const awarded = (view.skillById ?? {})[awardedSkillId];
      logs.push(`🏆 ${name} earned: ${awarded ? `${awarded.icon ?? ''} ${awarded.label}`.trim() : awardedSkillId}!`);
    } else {
      patch.upgradesPending = 1;
    }
  }

  // ── 🎵 WA NO KOE ──────────────────────────────────────────────────────────
  // ⚠️ FAITHFUL TO A BUG. In Game, `applyWaNoKoe` reads `curTemp` off the
  // RENDER-SCOPED `actingNoteState` — i.e. the PRE-commit value — and writes
  // `curTemp + 1` over the `tempDrive`/`tempSustain` the commit patch just set.
  // So on a turn where the Ronin earns both a Drive boost AND Wa no Koe, the
  // boost is SILENTLY DISCARDED and he ends on `oldTempDrive + 1`.
  //
  // Reproduced rather than fixed, because this file's job is to match the game
  // that ships, and a kernel that quietly plays a better game than the client is
  // the same failure as an invented rule. Fix it in ONE place when it is fixed
  // — see BOT_STRATEGY_HANDOFF §7.
  let waNoKoe = null;
  if (isRonin) {
    waNoKoe = checkWaNoKoe(melodyLine, [...driveStack, ...sustainStack], ns);
    if (waNoKoe) {
      patch.waNoKoeBuffs = [...(ns.waNoKoeBuffs ?? []), waNoKoe];
      if (waNoKoe.stat === 'drive') patch.tempDrive   = prevTempDrive   + 1;
      else                          patch.tempSustain = prevTempSustain + 1;
      logs.push(`🎵 WA NO KOE! Melody harmonizes with the chord — +1 ${waNoKoe.stat === 'drive' ? 'Drive' : 'Sustain'} for 3 rounds.`);
    }
  }

  // ── THE ORDERED EFFECTS ───────────────────────────────────────────────────
  // Client timing: position fans 0ms, performance fans 0ms, riff Fame 500ms,
  // cadence fans 700ms. Fans are folded SEQUENTIALLY (never summed) so each cap
  // bites in turn, then emitted as one write — same arithmetic, one dispatch.
  const effects = [];
  let fans = {
    casuals: ns.casuals ?? FAN_CASUAL_START,
    diehards: ns.diehards ?? FAN_DIEHARD_START,
    centerStreak: ns.centerStreak ?? 0,
    fanLag: ns.fanLag ?? 0,
  };

  const pos = positionFanGain(fans, spirit.num, allInScale, view.unsurePool ?? 0);
  let fanWrite = null;
  // (`pos` and `deed` are re-exported on `report` below — a client needs `base`,
  //  `recruit` and `gain` to size its fan bursts, and re-deriving them would put
  //  the ring arithmetic back in two places.)
  if (pos) {
    fans = { ...fans, ...pos.fans };
    fanWrite = { ...pos.fans };
    if (pos.recruit > 0) effects.push({ type: 'unsurePool', spiritId, delta: -pos.recruit });
    // ⚠️ The multiplier is part of this line on purpose: it is the moment the
    // player can see WHY a crowd is worth having. Derived here rather than in the
    // client, so the sentence and the number cannot drift apart.
    const mult = crowdMultiplier(fans.diehards, fans.casuals, (ns.assignments ?? []).length);
    logs.push(`🎤 ${name} works ${pos.ring === 'main' ? 'the Mainstage' : pos.ring === 'pit' ? 'the Pit' : 'the neutral floor'} — casuals +${pos.base}${pos.recruit > 0 ? ` (+${pos.recruit} won over)` : ''} → ♥${fans.diehards}·👥${fans.casuals} (×${mult.toFixed(2)})`);
    if (pos.promoted) logs.push(`🎤 A casual hardens into a Diehard for ${name}! (${fans.diehards}♥)`);
  }
  if (perfFansGained > 0 || perfPromotions > 0 || perfFansLost > 0) {
    const perf = performanceFanGain(fans, perfFansGained, perfPromotions, perfFansLost);
    fans = { ...fans, ...perf };
    fanWrite = { ...(fanWrite ?? {}), ...perf };
    if (perfFansGained > 0) logs.push(`🎤 ${name}'s performance wins over ${perfFansGained} new fan${perfFansGained !== 1 ? 's' : ''}!`);
    if (perfPromotions > 0) logs.push(`💜 ${perfPromotions} of ${name}'s casuals harden into Diehards!`);
    if (perfFansLost   > 0) logs.push(`😴 ${name}'s show falls flat — ${perfFansLost} bored fan${perfFansLost !== 1 ? 's' : ''} drift off.`);
  }
  if (fanWrite) effects.push({ type: 'fans', spiritId, fans: fanWrite });

  // ⭐ The riff is the ONLY Fame this commit can pay, and it is amplified by the
  // crowd the two writes above just settled — which is exactly why it sits here
  // and not at the end. Run it through `battleFlow.grantFame` so the 4/turn cap,
  // the crowd multiplier and the Rock God gate all apply once, in one place.
  if (riffAward) {
    effects.push({ type: 'fame', spiritId, fp: riffAward.fp, reason: `🎼 ${riffAward.name}` });
  }

  // 🎯 Cadences are a melody-line feat, not a battle — they build crowd, not Fame.
  let deedReport = null;
  if (cadence) {
    const deed = deedFanGain(fans, spirit.num, cadence.fp);
    if (deed) {
      deedReport = { ring: deed.ring, gain: deed.gain, promoted: deed.promoted };
      fans = { ...fans, ...deed.fans };
      effects.push({ type: 'fans', spiritId, fans: deed.fans });
      logs.push(`🎤 ${name} wins the crowd — 🎯 ${cadence.name} — +${deed.gain} casual fan${deed.gain !== 1 ? 's' : ''}!`);
    }
  }

  // ── FLASH (presentation; transcribed so a rewired client recomputes nothing) ──
  if (earned > 0) {
    flashLines.push(`+${earned} DB pts`);
    breakdown.forEach(b => flashLines.push(b));
    if (upgradeTriggered) flashLines.push(`🎸 ${targetSkill?.label ?? 'UPGRADE'} UNLOCKED!`);
  }
  if (rawDriveBoost > 0)   flashLines.push(`⚔️ Drive +${newTempDrive}`);
  if (rawSustainBoost > 0) flashLines.push(`🛡️ Sustain +${newTempSustain}`);
  if (lock.bonus > 0)      flashLines.push(`🔒 Harmonic Lock — ${lock.chordName} · DB +${lock.bonus}`);
  if (isOctaveResolution)  flashLines.push('🎶 Octave — DB +2');
  if (chromRunLen >= 3)    flashLines.push(`⚡ Chromatic run ×${chromRunLen} — the crowd eats it up`);
  const pardonedTotal = contextPardons.drive + contextPardons.sustain;
  if (pardonedTotal > 0) {
    const paidTo = [];
    if (colorDrive   > 0) paidTo.push(`⚔️ +${colorDrive}`);
    if (colorSustain > 0) paidTo.push(`🛡️ +${colorSustain}`);
    flashLines.push(`🎸 Your chord legalized ${pardonedTotal} note${pardonedTotal !== 1 ? 's' : ''}`
      + (paidTo.length > 0 ? ` — ${paidTo.join(' ')}` : isMojoDrained ? ' — Mojo Drain, no payout' : ''));
  }
  if (perfFreestyle > 0) flashLines.push('🌀 Freestyle — first wrong note landed perfect!');
  if (canBank)           flashLines.push(`💾 Banked: ${newBankedNote.note}`);
  if (totalNotes > speed && !canBank) flashLines.push(`⚠️ ${totalNotes - speed} note(s) discarded (bank full)`);
  if (discordPenalty > 0) flashLines.push(`⚡ ${unpardonedDiscord} Dischord — −${discordPenalty} DB (1st free)`);
  else if (unpardonedDiscord > 0) flashLines.push(`⚡ ${unpardonedDiscord} Dischord — free this turn`);
  flashLines.push(`🎭 Performance ${perfScore}/10`);
  if (perfFansGained > 0) flashLines.push(`🎤 +${perfFansGained} new fan${perfFansGained !== 1 ? 's' : ''} won over!`);
  if (perfPromotions > 0) flashLines.push(`💜 ${perfPromotions} fan${perfPromotions !== 1 ? 's' : ''} → Diehard!`);

  const scoreStr = earned > 0
    ? ` · 🎯 +${earned}pts (${breakdown.join(', ')})${upgradeTriggered ? ` · 🎸 ${targetSkill?.label ?? 'UPGRADE'} UNLOCKED!` : ` · DB [${newDBPoints}/${targetCost}]`}`
    : (discordPenalty > 0 ? ` · ⚡ ${unpardonedDiscord} Dischord — −${discordPenalty}, no points` : ` · DB [${newDBPoints}/${targetCost}]`);
  const speedMsg = totalNotes > speed
    ? ` · SPD ${speed}/${totalNotes}${canBank ? ` · 💾 ${newBankedNote.note} banked` : ' · bank full'}`
    : ` · SPD ${hexes}/${speed}`;
  logs.unshift(`✓ Committed · ${hexes} hexes${scoreStr}`
    + (rawDriveBoost > 0 ? ` · ⚔️ Drive +${newTempDrive}` : '')
    + (rawSustainBoost > 0 ? ` · 🛡️ Sustain +${newTempSustain}` : '')
    + (lock.bonus > 0 ? ` · 🔒 Harmonic Lock ${lock.chordName} DB+${lock.bonus}` : '')
    + (isOctaveResolution ? ' · 🎶 Octave DB+2' : '')
    + `${speedMsg} · Next RN: ${newRootRaw}`);

  return {
    ok: true, reason: null,
    patch, effects, hexes, logs, flashLines,
    report: {
      melodyLine, baseTrack, voiceRoll, micBonusNote,
      riff: riffAward, cadence: cadence ? { id: cadence.id, name: cadence.name, fp: cadence.fp } : null,
      unpardonedDiscord, effectiveDiscord, contextPardons, allInScale,
      colorDrive, colorSustain, discarded, dbOverflow,
      diatonicRunLen, repeatPatLen, skipClimbLen, chromRunLen, chromClimbActive,
      trackHasTritone, isOctaveResolution,
      hasGatedEnding: isMinorSeventhEnd || isMajorThirdEnd || isTritoneEnd,
      baseScore, lock, discordPenalty, breakdown,
      earned, earnedTotal, newDBPoints, targetCost, upgradeTriggered, awardedSkillId,
      perfScore, perfFreestyle, perfExciteGain, perfFansGained, perfPromotions, perfFansLost,
      lowPerfStreak, waNoKoe,
      totalNotes, usableMoves, overflow, canBank, bankedNote: newBankedNote, speed,
      newRootRaw, newMode, fans,
      positionFans: pos ? { ring: pos.ring, base: pos.base, recruit: pos.recruit, promoted: pos.promoted } : null,
      deedFans: deedReport,
      clientOwned: CLIENT_OWNED,
    },
  };
}
