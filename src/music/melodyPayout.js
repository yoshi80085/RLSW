// The deliberately small melody economy. Keep the three layers separate so a
// new Spirit can add a fan preference without changing Db or resolution.
import { pitchIndex } from './notes.js';
import { detectSpiritStyle } from './spiritStyle.js';

export const CLEAN_NOTE_DB = 0.5;
export const CLEAN_STREAK_DB = 0.5;
export const CLEAN_STREAK_MIN = 3;
export const CLEAN_STREAK_CAP = 2;

function longestCleanRun(line, scale) {
  let best = 0, run = 0;
  for (const note of line ?? []) {
    if (scale.includes(note)) { run += 1; best = Math.max(best, run); }
    else run = 0;
  }
  return best;
}

function cleanStreakCount(line, scale) {
  let count = 0, run = 0;
  for (const note of [...(line ?? []), null]) {
    if (scale.includes(note)) { run += 1; continue; }
    if (run >= CLEAN_STREAK_MIN) count += 1;
    run = 0;
  }
  return Math.min(CLEAN_STREAK_CAP, count);
}

export function melodyPayoutFor(spiritId, line, scale, {
  tonic, fourth, fifth, driveRoot, sustainRoot,
} = {}) {
  const cleanCount = (line ?? []).filter(note => scale.includes(note)).length;
  const longestRun = longestCleanRun(line, scale);
  const streakBonus = cleanStreakCount(line, scale) * CLEAN_STREAK_DB;
  const style = detectSpiritStyle(spiritId, line);
  const last = line?.at(-1);
  const samePitch = (a, b) => pitchIndex(a) >= 0 && pitchIndex(a) === pitchIndex(b);
  const ending = !scale.includes(last) ? 'normal'
    : samePitch(last, tonic) ? 'tonic' : samePitch(last, fifth) ? 'fifth' : samePitch(last, fourth) ? 'fourth' : 'normal';
  const endingDb = ending === 'fifth' ? 3 : ending === 'fourth' ? 2 : ending === 'tonic' ? 1 : 0;
  return {
    cleanCount,
    longestCleanRun: longestRun,
    cleanDb: cleanCount * CLEAN_NOTE_DB,
    streakDb: streakBonus,
    style,
    ending,
    endingDb,
    resolved: ending !== 'normal',
    chordRootCarrot: scale.includes(last) && samePitch(last, driveRoot) ? 'drive'
      : samePitch(last, sustainRoot) ? 'sustain' : null,
    db: cleanCount * CLEAN_NOTE_DB + streakBonus + endingDb,
  };
}

export const roninMelodyPayout = (line, scale, context) =>
  melodyPayoutFor('cosmic_ronin', line, scale, context);
