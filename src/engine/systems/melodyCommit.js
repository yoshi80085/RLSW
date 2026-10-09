import { characterId } from "../../data/spiritIdentity.js";
// ─── ENGINE SYSTEM: MELODY COMMIT (the economic half of the commit) ──────────
// `commitMelodyEconomy(state, spiritId, ctx) -> { ok, patch, effects, hexes, report, ... }`
// BOT_STRATEGY_HANDOFF §6b.1 — the hole this file exists to close.
//
// §1's spine says the melody you commit buys your ability to act. The engine has
// always owned the MECHANICAL half of that sentence (`moveBudgetSet` → AP) and
// never the ECONOMIC half — the Performance Score, the fans, the banked
// note, the riff, the cadence. Those lived ~600 lines deep inside
// `confirmNoteTrack`, tangled with React setters, so `applyBotAction` could only
// declare `confirmMelody` PARTIAL and a searcher could only see half of what a
// melody is worth. A searcher blind to the scoring half systematically prefers
// SHORT tracks: it can see that three notes cost less stock than six, and cannot
// see that six notes pay flair and a crowd.
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
//   · `applySkillEffects` — 🪦 a commit awards nothing since Db was cut
//     (2026-10-02); the name stays in `CLIENT_OWNED` only so old readers of the
//     list still find it.
//   · presentation — `playTrackSequence`, `playRiffSequence`, the banners, the
//     toasts, the tips, the d6 spin. `flashLines` is returned so a rewired
//     `confirmNoteTrack` can render without recomputing anything.
//   · `unsurePool` — the undecided crowd is client state. Pass it in via
//     `ctx.view.unsurePool`; the recruit it funds comes back as an effect.

import { buildScale, ENHARMONIC_RESPELL } from "../../music/notes.js";
import {
  classifyTrack, countUnpardoned, countPardonedByStack,
} from "../../music/context.js";
import { melodyModeFor } from "../../music/melodyIdentity.js";
import { melodyPayoutFor } from "../../music/melodyPayout.js";
import { livePalette, liftOutcome } from "./iwatoCurse.js";
import { playedNotes } from "../../music/noteTechniques.js";
import { SPIRIT_DEFS } from "../../data/spirits.js";
import {
  FAN_CASUAL_CAP, FAN_DIEHARD_START, FAN_CASUAL_START,
} from "../../data/gameConstants.js";

/** Speed caps at 5 (`Math.min(5, …)` in Game). Inert today — no Spirit exceeds
 *  5 — but kept because it is the rule, and a future 6-speed kit would find it. */
export const SPEED_CAP = 5;

/** 🎤 The mic skill's voice roll: d6, bonus in-scale note on 4+. */
export const MIC_VOICE_ROLL_DIE = 6;
export const MIC_VOICE_ROLL_PASS = 4;

/** What this kernel still does not do. Read it; do not remember it. */
export const CLIENT_OWNED = [
  'applySkillEffects', 'presentation', 'unsurePoolWrite',
];

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
 *   · `view` client-owned slices: `unsurePool`. 🪦 `riffBook` is gone with the
 *            riff library, and `skillById` with Db (nothing is awarded now).
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
  const scaleMode      = ns.paletteMode ?? melodyModeFor(spiritId);
  const unlockedSkills = ns.unlockedSkills ?? [];
  const driveStack     = ns.driveStack   ?? [];
  const sustainStack   = ns.sustainStack ?? [];
  const melodyFreq     = ns.melodyFreq   ?? [];

  // ── 🎤 MIC — the voice roll SHADOWS the track ─────────────────────────────
  // ⚠️ Everything below scores `melodyLine`, not `baseTrack`. A bonus note the
  // player never placed still counts for P, for the ending, and for the
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

  // One classification owns every answer about the committed notes. The
  // Spirit's mode is the clean palette; chord pardons are tracked separately
  // for the red/blue ending carrot and never become clean notes.
  // 🌑 THE IWATO CURSE SWAPS THIS PALETTE, and only this one line knows it:
  // under a curse every note that is not Iwato on the curse's root classifies
  // as discord, and "discord notes are inert" does the rest (no fans).
  // `iwatoCurse.js` `livePalette`; uncursed it is exactly `playableScale`.
  const currentScale = livePalette(spiritId, ns);
  const harmonicScale = buildScale(rootNote, scaleMode);
  const trackClassified = classifyTrack(
    melodyLine, currentScale, driveStack, sustainStack);
  const unpardonedDiscord = countUnpardoned(trackClassified);
  const contextPardons    = countPardonedByStack(trackClassified);
  const cleanNoteCount    = trackClassified.filter(note => note.inScale).length;
  const endingClean       = !!trackClassified.at(-1)?.inScale;
  const allInScale        = cleanNoteCount === melodyLine.length;
  const cleanRuns = [];
  for (const note of trackClassified) {
    if (note.inScale) {
      if (!cleanRuns.length || cleanRuns.at(-1).closed) cleanRuns.push({ notes: [] });
      cleanRuns.at(-1).notes.push(note.note);
    } else if (cleanRuns.length) cleanRuns.at(-1).closed = true;
  }
  const cleanPhrase = cleanRuns.reduce(
    (best, run) => run.notes.length > best.length ? run.notes : best, []);

  // ── 🪦 LEGENDARY RIFFS — RETIRED 2026-08-17 ───────────────────────────────
  //
  // `detectRiff` scanned every committed track against a 34-entry library of
  // named tunes (Beethoven's Fifth, Ode to Joy, the Andalusian cadence, a dozen
  // rock homages). A match paid 2–5 FP, +3 Performance Score, and flagged a
  // riff-off bonus. All three are gone; the library is gone with them.
  //
  // ⚠️ TWO REASONS, AND THE SECOND IS THE STRUCTURAL ONE.
  //
  //   1. **They were not ROCK.** Half the library was classical and most of the
  //      rest was a named-tune reference. This is a game about four Spirits
  //      making their own noise; a Spirit winning on Für Elise is the wrong
  //      story.
  //   2. ⚠️ **THE FAME WAS NOT EARNED BY A DECISION.** Note stock is DRAWN, so
  //      which riffs a player could even spell was largely their draw. A 5 FP
  //      riff against a 16 FP target is a third of a match, so a tight game
  //      could be decided by a shape one player happened to be dealt and the
  //      other was not. Fame in this game is supposed to come from what you
  //      chose to play.
  //
  // 🧭 **WHAT REPLACES IT IS NOT A SECOND RIFF LIBRARY.** The intended design is
  // per-Spirit STYLE: fans for playing to who you are — Metalness landing a
  // gallop or working a tritone, a cadence that makes sense for THAT Spirit —
  // rather than Fame for reciting a canon. That reads the same melody the player
  // already composed, so it rewards a decision instead of a draw, and it pays
  // FANS (which compound into Fame through the crowd multiplier) instead of
  // handing over a third of the win condition in one commit.
  //
  // 📌 Until that lands there is a real hole in the Fame economy and it is
  // measured rather than guessed: see `BOT_STRATEGY_HANDOFF.md` §6.6.5.

  // Resolutions are now entirely local to the final note. The retired
  // cross-turn cadence trail remains untouched on old saves, but no longer
  // adds a second melody reward.
  const trailPatch = {};

  // ── 🎸 CHORD CONTEXT — THE SINGLE PASS (B3) ───────────────────────────────
  // ⚠️ `keyScale` and the stacks' pardons stay SEPARATE, permanently. The pardon
  // changes what a wrong note COSTS; it must not change what COUNTS as one.
  //
  // 🪦 THE PALETTE-WIDENING READ WAS DELETED HERE 2026-09-02i, AND IT WAS A
  // PROVABLE NO-OP. `keyScale` used to be `currentScale` plus whatever interval
  // keys `DISCORD_INTERVAL_MAP` matched against `discordUnlocks`. That array is
  // written at exactly ONE site (`rlsw-simulator-v3_8_1.jsx:4518`), which fires
  // only on purchasing a skill whose id is `discord_1..4` — and `data/skillTree.js`
  // has contained no such id since the Theory branch came off. The set was
  // therefore always empty and `keyScale === currentScale` on every commit the
  // shipped game has ever scored.
  //
  // ⚠️ IT IS DELETED RATHER THAN REVIVED, AND THE DIRECTION IS THE POINT.
  // Widening the clean palette is the one thing this read must never do:
  // `SEQUENCING.md` §5-seats' fifth decision is that everyone keeps the pentatonic
  // base, because a wider palette means fewer notes need pardoning and THE PARDON
  // IS THE COLOUR PAYOUT. Re-granting the `discord_*` ids to wake the dead ending
  // flags below would have deleted that payout by the back door — which is why
  // the flags are ungated at their own site instead.
  const lastNote   = melodyLine[melodyLine.length - 1];
  const firstNote  = melodyLine[0];
  // The root follows the ending, while the Spirit's mode stays fixed.
  const newMode       = scaleMode;
  const newRootRaw    = ENHARMONIC_RESPELL[lastNote] ?? lastNote;

  // ── SPEED & BANKING — §1's spine ──────────────────────────────────────────
  const speed        = Math.min(SPEED_CAP, spirit.speed ?? SPIRIT_DEFS[characterId(spiritId)]?.speed ?? 5);
  const totalNotes   = melodyLine.length;
  const usableMoves  = Math.min(totalNotes, speed);
  const overflow     = totalNotes - usableMoves;
  const existingBank = ns.bankedNote ?? null;
  const canBank      = overflow >= 1 && !existingBank;
  const newBankedNote = canBank ? { note: melodyLine[totalNotes - 1] } : existingBank;
  const hexes = usableMoves;

  const isMojoDrained = (ns.mojoDrain ?? 0) > 0;

  // ── INTERVAL EFFECTS ──────────────────────────────────────────────────────
  // ── THE MELODY ECONOMY ─────────────────────────────────────────────────────
  // 1. Spirit structure + craft → fans.
  // 2. The final note → when it is a stack root, a red/blue temporary-stat carrot.
  // 🪦 Clean notes, clean streaks and the tonic/4th/5th ending used to pay Db.
  //    Db was cut 2026-10-02 (Alex: "the cooldowns and 'sacrifices' are the
  //    gate"), and on his call the ending pays NOTHING for now — `payout.ending`
  //    is still classified (the Riff-Off's planned hook weight wants it), but
  //    ⚠️ the fifth's chord-change pressure (`ENDING_WEIGHT` in
  //    `melodyPayout.js`) is currently switched off. Open decision, recorded.
  const stackRootDrive = driveStack[0] ?? null;
  const stackRootSustain = sustainStack[0] ?? null;
  const payout = melodyPayoutFor(spiritId, melodyLine, currentScale, {
    // These are scale degrees, not fixed chromatic intervals: a Lydian fourth is
    // ♯4 and must remain a clean resolving note. ⚠️ Index 3/4 assumes the mode
    // HAS a 4th and a 5th at those seats — the Ronin's six-note Hirajoshi does
    // (C D E♭ F G A♭); see the note on `hirajoshi` in melodyIdentity.js.
    tonic: rootNote,
    fourth: harmonicScale[3], fifth: harmonicScale[4],
    driveRoot: stackRootDrive, sustainRoot: stackRootSustain,
  });
  const endingChoice = payout.ending;
  const colorDrive = !isMojoDrained && payout.chordRootCarrot === 'drive' ? 1 : 0;
  const colorSustain = !isMojoDrained && payout.chordRootCarrot === 'sustain' ? 1 : 0;

  const rawDriveBoost = colorDrive;
  const prevTempDrive = ns.tempDrive ?? 0;
  let newTempDrive = prevTempDrive, driveOverflow = 0;
  if (rawDriveBoost > 0) {
    if (rawDriveBoost > prevTempDrive) { driveOverflow = prevTempDrive; newTempDrive = rawDriveBoost; }
    else                               { driveOverflow = rawDriveBoost; }
  }

  const rawSustainBoost = colorSustain;
  const prevTempSustain = ns.tempSustain ?? 0;
  let newTempSustain = prevTempSustain, sustainOverflow = 0;
  if (rawSustainBoost > 0) {
    if (rawSustainBoost > prevTempSustain) { sustainOverflow = prevTempSustain; newTempSustain = rawSustainBoost; }
    else                                   { sustainOverflow = rawSustainBoost; }
  }
  // The carrot that LOST the comparison is discarded — display value only.
  const discarded  = driveOverflow + sustainOverflow;

  const newDieFloorBoost = 0;
  const newStatusEffects = [...(ns.statusEffects ?? [])];

  // ── ⚡ DISSONANCE EDGE — REMOVED. `edgeStage` stays pinned at 0 on the sheet.
  const newEdgeStage = 0;

  // Layer 1: finished Spirit structures — the IDENTITY half of the crowd's ear.
  // Monster and Intergalactic deliberately return zero until their rules exist.
  // Layer 1b: CRAFT — the universal half. A clean, same-direction run of four or
  // more pays whether or not it is this Spirit's named shape. See the long note
  // above `CRAFT_FAN_FLOOR` in `music/melodyPayout.js` for why the ladder starts
  // at four and what deliberately did NOT come back with it.
  // ⚠️ `perfScore` STAYS IDENTITY-ONLY. It is the Structure readout and it feeds
  // `recentP`; folding craft into it would relabel a universal payout as this
  // Spirit's sound. Only `perfFansGained` is the sum.
  const style = payout.style;
  const craftFans = payout.craftFans;
  const perfScore = style.score;
  const perfExciteGain = 0;
  const perfExcitement = ns.excitement ?? 0;
  const perfLoyalty = ns.loyalty ?? 0;
  const perfFansGained = style.score + craftFans;
  const perfPromotions = 0;
  const perfFansLost = 0;
  const lowPerfStreak = 0;


  // ── 👻 THE LIFTS — the Iwato curse's way out (`iwatoCurse.js`, v3) ───────
  // Each haunted note the line holds lifts one ghost; progress accumulates
  // across the Rival's cursed turns and the third lift ends the curse. ⭐ Scored
  // ABOVE on the cursed palette, so the lifting melody pays normally. The lift
  // is in the patch so the kernel and the client cannot disagree about it.
  // 🎸 ⚠️ A HAMMERED NOTE DOES NOT LIFT A CURSE (Alex, 2026-10-08): only notes
  // played from the hand count here, though the hammered ones still PAY above.
  const lift = liftOutcome(ns, playedNotes(melodyLine, ns.melodySrcIdx));
  const exorcised = lift.done;
  if (exorcised) {
    logs.push(`🔥 ${name} plays the last haunted note — the curse paper burns and the Scale Wheel snaps back. LIFTED!`);
    flashLines.push('🔥 CURSE LIFTED!');
  } else if (lift.newly.length) {
    const left = (ns.iwatoCurse?.targets?.length ?? 0) - (ns.iwatoCurse?.lifted?.length ?? 0) - lift.newly.length;
    logs.push(`👻 ${name} plays ${lift.newly.length === 1 ? 'a haunted note' : `${lift.newly.length} haunted notes`} — ${lift.newly.length === 1 ? 'a ghost lifts' : 'ghosts lift'} and fade. ${left} to go.`);
    flashLines.push(`👻 ${lift.newly.length} GHOST${lift.newly.length === 1 ? '' : 'S'} LIFTED`);
  }

  // ── THE SHEET PATCH ───────────────────────────────────────────────────────
  const patch = {
    ...(lift.patch ?? {}),
    melodyLine: [], melodySrcIdx: [], melodyFreq: [],
    // Phase R1: the riff-off reads these; turn start clears them.
    // ⚠️ Mapped over `melodyLine`, not copied from `melodyFreq`: the mic roll
    // shadows the track and may append a note the player never played.
    committedMelody:  melodyLine,
    lastCommittedMelody: [...melodyLine], // Survives turn reset for alternating arena calls.
    committedFreq:    melodyLine.map((_, i) => melodyFreq[i] ?? null),
    discordCount:  0,
    rootNote:      newRootRaw,
    scaleMode:     newMode,
    paletteMode:   newMode,
    edgeStage:     newEdgeStage,
    perfScore,
    recentP:       [...(ns.recentP ?? []), perfScore].slice(-2),
    excitement:    perfExcitement,
    loyalty:       perfLoyalty,
    lowPerfStreak,
    hasConfirmed:  true,
    dieFloorBoost: newDieFloorBoost,
    statusEffects: newStatusEffects,
    tempDrive:     newTempDrive,
    tempSustain:   newTempSustain,
    bankedNote:    newBankedNote,
    transposeCardPending: null,
    ...trailPatch,
  };


  // ── LAYER 1 EFFECTS ───────────────────────────────────────────────────────
  // The commit has one fan source: the Spirit's completed structure. Position,
  // performance-score and cadence fan awards were retired with the old economy.
  const effects = [];
  let fans = {
    casuals: ns.casuals ?? FAN_CASUAL_START,
    diehards: ns.diehards ?? FAN_DIEHARD_START,
    centerStreak: ns.centerStreak ?? 0,
    fanLag: ns.fanLag ?? 0,
  };

  let fanWrite = null;
  if (perfFansGained > 0) {
    const structureFans = {
      casuals: Math.min(FAN_CASUAL_CAP, fans.casuals + perfFansGained),
      diehards: fans.diehards,
    };
    fans = { ...fans, ...structureFans };
    fanWrite = { ...(fanWrite ?? {}), ...structureFans };
    // ⚠️ THE REASON IS BUILT, NOT ASSUMED. A craft-only commit has NO style
    // labels, and the old line read "🎤 Ronin's  wins 1 new fan!" with a hole in
    // it the moment fans could arrive without a named gesture.
    const fanReasons = [...style.labels,
      ...(craftFans > 0 ? [`a ${payout.craftRun}-note run`] : [])];
    logs.push(`🎤 ${name}'s ${fanReasons.join(' + ')} wins ${perfFansGained} new fan${perfFansGained !== 1 ? 's' : ''}!`);
  }
  if (fanWrite) effects.push({ type: 'fans', spiritId, fans: fanWrite });

  const deedReport = null;

  // ── FLASH (presentation; transcribed so a rewired client recomputes nothing) ──
  if (rawDriveBoost > 0)   flashLines.push(`⚔️ Drive +${newTempDrive}`);
  if (rawSustainBoost > 0) flashLines.push(`🛡️ Sustain +${newTempSustain}`);
  if (canBank)           flashLines.push(`💾 Banked: ${newBankedNote.note}`);
  if (totalNotes > speed && !canBank) flashLines.push(`⚠️ ${totalNotes - speed} note(s) discarded (bank full)`);
  if (unpardonedDiscord > 0) flashLines.push(`⚡ ${unpardonedDiscord} Discord — movement only`);
  for (const label of style.labels) {
    flashLines.push(`🎸 ${label} — that's your sound`);
    logs.push(`🎸 ${name} lands ${label} — the crowd knows that sound.`);
  }
  flashLines.push(`🎭 Structure ${perfScore}`);
  if (craftFans > 0) flashLines.push(`🎤 ${payout.craftRun}-note run · +${craftFans} fan${craftFans !== 1 ? 's' : ''}`);
  if (style.score > 0) flashLines.push(`🎤 ${style.labels.join(' + ')} · +${style.score} fan${style.score !== 1 ? 's' : ''}`);
  if (perfPromotions > 0) flashLines.push(`💜 ${perfPromotions} fan${perfPromotions !== 1 ? 's' : ''} → Diehard!`);

  const speedMsg = totalNotes > speed
    ? ` · SPD ${speed}/${totalNotes}${canBank ? ` · 💾 ${newBankedNote.note} banked` : ' · bank full'}`
    : ` · SPD ${hexes}/${speed}`;
  logs.unshift(`✓ Committed · ${hexes} hexes`
    + (rawDriveBoost > 0 ? ` · ⚔️ Drive +${newTempDrive}` : '')
    + (rawSustainBoost > 0 ? ` · 🛡️ Sustain +${newTempSustain}` : '')
    + `${speedMsg} · Next RN: ${newRootRaw}`);

  return {
    ok: true, reason: null,
    patch, effects, hexes, logs, flashLines,
    report: {
      melodyLine, baseTrack, voiceRoll, micBonusNote,
      cadence: null,
      exorcised, liftedNow: lift.newly,
      unpardonedDiscord, contextPardons, allInScale, cleanNoteCount, endingClean,
      cleanPhrase, endingChoice,
      colorDrive, colorSustain, discarded,
      diatonicRunLen: 0, repeatPatLen: 0, skipClimbLen: 0,
      trackHasTritone: false, isOctaveResolution: false,
      perfScore, perfExciteGain, perfFansGained, perfPromotions, perfFansLost,
      craftRun: payout.craftRun, craftFans,
      // 🎭 Which of this Spirit's own gestures the line landed. On the report
      // rather than only in a log line so a check, a searcher, or a HUD can
      // read it without re-detecting — one reading, three consumers.
      style: { score: style.score, hits: style.hits, labels: style.labels },
      lowPerfStreak,
      totalNotes, usableMoves, overflow, canBank, bankedNote: newBankedNote, speed,
      newRootRaw, newMode, fans,
      positionFans: null,
      deedFans: deedReport,
      clientOwned: CLIENT_OWNED,
    },
  };
}
