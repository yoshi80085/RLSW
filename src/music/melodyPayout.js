// The deliberately small melody economy. Keep the layers separate so a new
// Spirit can add a fan preference without changing resolution or the carrot.
// (Db was the third layer until it was cut, 2026-10-02.)
import { pitchIndex } from './notes.js';
import { detectSpiritStyle } from './spiritStyle.js';
import { detectDiatonicRun, detectSkipClimb } from './cadence.js';

// ── 🎤 CRAFT — the universal half of the crowd's ear ─────────────────────────
//
// 🪦 WHAT THIS RESTORES, AND WHY IT IS NOT THE OLD SYSTEM COMING BACK.
// `cadence.js`'s shape detectors were unplugged when melody shape stopped paying
// Drive and Sustain (MELODY_IDENTITY_DESIGN.md §4, shipped 2026-09-10). The
// WITHDRAWAL was right — it collapsed a per-character currency table into one
// rule. But §4.3's own point 3 warned, in writing, that it was safe *"only
// because the fan route pays the middle instead… without it, the middle of a
// melody would pay nothing but length"*, and the fan route that shipped pays
// exact named shapes only. So the middle of the line went back to paying for
// length and CLEANLINESS — and cleanliness is shape-blind: `longestCleanRun`
// scores C-C-C exactly as it scores C-D-E.
//
// ⚠️ WHAT IS **NOT** COMING BACK is the subjective half — `excitement`,
// `loyalty`, fan promotions, `perfFansLost`, `lowPerfStreak`: a mood model that
// decided whether you had been entertaining and took fans away when it judged
// you dull. Those remain pinned at 0 in `melodyCommit.js`. Alex cut them on
// purpose and this does not reopen that. The DETECTORS were arithmetic; the
// crowd model around them was not, and only the arithmetic returns.
//
// 🎯 THE LADDER STARTS AT FOUR, AND THAT IS THE WHOLE DESIGN. The Ronin's
// `scalar_shred` already fires on a THREE-note stepwise run, so a craft layer
// paying from three would hand him two fans for one gesture and teach nothing.
// Starting at four means the entry rung stays IDENTITY and every note you extend
// it by is CRAFT — which is exactly the complaint this answers: *"trying to play
// something out then gives no bonus."* For a Spirit whose identity lives
// elsewhere it is simply a shaped line finally paying something.
//
//   run of 3 → +0    run of 4–5 → +1    run of 6 or more → +2
//
// 🎚️ THE TOP RUNG MOVED 5 → 6 (Alex, 2026-09-30 playtest: *"I was able to get a
// full crowd by round 7 or so — lets dial back the fan gain *slightly*"*). A
// Ronin landing shred + skip + a five-note run banked the maximum 4 fans on
// nearly every commit, and 28 open seats ÷ 4 is round 7. Of the three dials
// offered he picked the gentlest: the ceiling is still 4 and the floor is
// untouched, but the +2 now asks for a SIX-note run — most of an 8-seat track.
//
// 📌 BOTH DETECTORS ARE CLEAN-ONLY ALREADY — they index into `currentScale`, so
// an out-of-scale note breaks the run. Discord still buys movement and nothing
// else, which is the rule everywhere else in the economy.
export const CRAFT_FAN_FLOOR = 4;   // the first run length that pays craft (+1)
export const CRAFT_FAN_TOP   = 6;   // the run length that pays the cap (+2) — was 5 until 2026-09-30
export const CRAFT_FAN_CAP   = 2;   // ⚠️ fans feed FAME — see §4.3's bench note

/** The longest clean, same-direction run the line contains, by step OR by
 *  third. The two are deliberately MAXed rather than summed: a line is one
 *  gesture played well, not a checklist of gestures to collect. */
export function craftRunFor(line, scale) {
  return Math.max(detectDiatonicRun(line, scale), detectSkipClimb(line, scale));
}

export function craftFansFromRun(run) {
  const r = run ?? 0;
  // ⚠️ Stays MONOTONIC in `run` — `playFinder`'s fans bound feeds it an upper
  // bound on the run and relies on a longer run never paying less.
  return r >= CRAFT_FAN_TOP ? CRAFT_FAN_CAP : r >= CRAFT_FAN_FLOOR ? 1 : 0;
}

// ── 🎼 THE ENDING LADDER — WHY THE FIFTH PAYS MOST ───────────────────────────
//
// 🚨 DORMANT SINCE 2026-10-02 — IT PAYS NOTHING. These rungs paid Db, and Db was
// cut from the game (Alex: "the cooldowns and 'sacrifices' are the gate"). His
// call on what a good ending earns instead: *nothing for now*. The table is
// KEPT, renamed `ENDING_DB` → `ENDING_WEIGHT`, as data for the Riff-Off's
// planned hook weight (§14.9.5 below) — ⚠️ and so REASON 2 BELOW IS CURRENTLY
// SWITCHED OFF: nothing in the live game pushes players to change chords via
// the ending. That is a known, recorded loss and an OPEN decision
// (`STATE_OF_PLAY.md` §4), not an accident. Read the rest as the rationale to
// carry into whatever the ending pays next.
//
// 🪦 THIS WAS AN ANONYMOUS INLINE TERNARY FOR MONTHS, WITH NO COMMENT ANYWHERE —
// not here, not in `melodyCommit.js`, not in `MELODY_IDENTITY_DESIGN.md`. A
// deliberate design decision read exactly like an arbitrary number. That is
// `SEQUENCING.md` §B9 in its purest form, and it is why this block exists.
// Alex's own rationale, recovered 2026-09-14 (`PROJECTILE_COMBAT_DESIGN.md`
// §14.9.3) — TWO reasons, and only the first is guessable:
//
//   1. 🎸 THE ROCK ARGUMENT. *"Usually nothing is as strong for Rock as the
//      5th."* Harmonic structure, and the genre the game is about.
//   2. ⭐ THE SYSTEMS ARGUMENT, AND NOBODY COULD HAVE RECONSTRUCTED THIS ONE.
//      *"I also wanted to have the players change chords often, so that was
//      another reason it was stronger than say the tonic."*
//
// 🚨 REASON 2 MAKES THIS A LEVER ON THE CHORD ECONOMY, NOT MELODY FLAVOUR.
// Flatten the ladder and you silently switch off the pressure that makes players
// move between chords — the thing the number was invented to do. ⚠️ Anyone
// tuning the ending for feel would have done exactly that without knowing.
//
// 🎯 AND IT IS ABOUT TO DO A SECOND JOB. §14.9.5 rules that the fifth's ending
// weight is ALSO the duel's hook weight — *"the note you are taught to aim for
// in a melody should be the note that wins duels."* One lesson, learned once.
// ⚠️ THE COST, STATED HONESTLY: a number doing two jobs cannot be tuned apart.
// If the fifth proves too strong in duels, the only lever also moves whatever
// the ending pays, and with it Alex's chord-change pressure. **That is the trade. Do not
// discover it by accident.**
//
// 📌 THE TONIC IS PROVISIONALLY UNDER REVIEW at 2 (§14.9.4, Alex: *"2 times or
// so, 1.5 even"*) and is NOT settled. ⚠️ At 2 the tonic and the fourth become
// the same rung and the fourth stops meaning anything distinct — so moving it is
// a three-rung decision, not a one-number one. Read §14.9.4 before you touch it.
export const ENDING_WEIGHT = {
  fifth:  3,   // ⭐ the rock interval, AND the chord-change pressure — reason 2
  fourth: 2,   // the plagal landing
  tonic:  1,   // ⁉️ provisionally under review at 2 — §14.9.4, unsettled
  normal: 0,   // ⭐ an unresolved line has NO hook. No new rule.
};

// 🪦 `CLEAN_NOTE_DB`, `CLEAN_STREAK_DB`, `CLEAN_STREAK_MIN` and `CLEAN_STREAK_CAP`
// went with Db, 2026-10-02. Clean notes still MATTER — discord breaks every fan
// shape and cannot land the red/blue carrot — they just no longer pay a number.

function longestCleanRun(line, scale) {
  let best = 0, run = 0;
  for (const note of line ?? []) {
    if (scale.includes(note)) { run += 1; best = Math.max(best, run); }
    else run = 0;
  }
  return best;
}


export function melodyPayoutFor(spiritId, line, scale, {
  tonic, fourth, fifth, driveRoot, sustainRoot,
} = {}) {
  const cleanCount = (line ?? []).filter(note => scale.includes(note)).length;
  const longestRun = longestCleanRun(line, scale);
  const craftRun = craftRunFor(line, scale);
  const craftFans = craftFansFromRun(craftRun);
  const style = detectSpiritStyle(spiritId, line, scale);   // discord breaks a shape
  const last = line?.at(-1);
  const samePitch = (a, b) => pitchIndex(a) >= 0 && pitchIndex(a) === pitchIndex(b);
  const ending = !scale.includes(last) ? 'normal'
    : samePitch(last, tonic) ? 'tonic' : samePitch(last, fifth) ? 'fifth' : samePitch(last, fourth) ? 'fourth' : 'normal';
  return {
    cleanCount,
    longestCleanRun: longestRun,
    craftRun,
    craftFans,
    style,
    ending,
    resolved: ending !== 'normal',
    // ⚠️ THE IN-SCALE TEST GUARDS BOTH COLOURS. It used to bind to the Drive
    // branch alone (`a && b ? 'drive' : c ? 'sustain'`), so a DISCORD final that
    // matched the Sustain root still paid the blue carrot — against "discord is
    // inert". `melodyCommitCheck` §7 pins both colours.
    chordRootCarrot: !scale.includes(last) ? null
      : samePitch(last, driveRoot) ? 'drive'
      : samePitch(last, sustainRoot) ? 'sustain' : null,
  };
}

export const roninMelodyPayout = (line, scale, context) =>
  melodyPayoutFor('cosmic_ronin', line, scale, context);
