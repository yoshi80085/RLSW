// ═══ Db SOURCE AUDIT ════════════════════════════════════════════════════════
// `node src/engine/dbaudit.mjs`
//
// WHY THIS EXISTS. Nine separate things move the Db number on a single commit:
// track length, the ending bonus, Harmonic Lock, the chromatic payout, Flair's
// Outside, the discord penalty, the Drive/Sustain overflow, the Performance-Score
// top-up, and Style Db. No player can hold nine inputs in their head, so the Db
// they earn reads as weather rather than as consequence — which quietly undermines
// the whole point of the chord/melody loop, because you cannot feel rewarded for
// building a good chord if you can't tell which of nine things paid you.
//
// This harness measures what each source ACTUALLY pays before anything is cut.
// The doc's own rule, repeatedly: measure, then tune. Don't delete on a hunch.
//
// ⚠️ THIS MIRRORS `confirmNoteTrack`, IT IS NOT THE SAME CODE. The commit path
// lives in the 13.9k-line simulator, which can't be imported here (the .png chain
// through data/spirits.js). The arithmetic below is transcribed from it and the
// line references are noted at each step. If the commit path changes, this drifts
// silently — so treat the SHARES as sound and the absolute values as indicative,
// and re-read the source before acting on a surprising number.
import { scoreTrackDB, detectDiatonicRun, detectSkipClimb, detectRepeatPattern,
         detectChromaticRun, driveBoostFromRun, sustainBoostFromPattern } from "../music/cadence.js";
import { chordContext, classifyTrack, countUnpardoned, countPardonedByStack,
         harmonicLock, discordPenaltyFor } from "../music/context.js";
import { performanceScore } from "./systems/economy.js";
import { buildScale, getIntervalNotes } from "../music/notes.js";

const ROOT = 'C', MODE = 'major';
const SCALE = buildScale(ROOT, MODE);
const IV = getIntervalNotes(ROOT, MODE);

// The five rungs, cumulative, as the tree enforces them.
const TIERS = [
  { name: 'tier 0  (start)',        skills: ['theory_major'] },
  { name: 'tier 1  minor',          skills: ['theory_major','theory_minor'] },
  { name: 'tier 2  dom7',           skills: ['theory_major','theory_minor','theory_dom7'] },
  { name: 'tier 3  modes',          skills: ['theory_major','theory_minor','theory_dom7','theory_modes'] },
  { name: 'tier 4  chromatic',      skills: ['theory_major','theory_minor','theory_dom7','theory_modes','theory_chromatic'] },
];
const STYLES = ['Shred','Groove','Flair'];

// Stacks a player plausibly holds at each tier (cap is 3/3/4/5/5).
const STACKS = [
  process.env.TRIAD0 === '1'
    ? [['C','E','G'], ['C']]                     // a tier-0 player who DID build a triad
    : [['C'],         ['C']],                    // turn one — the B0a seed
  [['C','E','G'],   ['C']],                      // a triad, one stack
  [['C','E','G'],   ['D','F','A']],              // two triads
  [['C','E','G','Bb'], ['D','F','A','C']],       // sevenths
  [['C','E','G','Bb','D','A'], ['D','F','A','C','E']],  // a 13th — capstone only (cap 6)
];

const COLOUR = ['Db','Eb','F#','Ab','Bb'];
let seed = 20260730;
// ⚠️ High bits only — an LCG's low bits are degenerate and every power-of-two
// modulus (rnd(2), rnd(4)) collapses to a constant if you use `% n` on the raw
// seed. That bug hid the Drive/Sustain overflow entirely on the first run.
const rnd = n => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return (seed >>> 15) % n; };

// Track shapes a real player produces — the same generator family as C1's fuzz.
function makeTrack() {
  const s = rnd(SCALE.length);
  let t;
  switch (rnd(7)) {
    case 0: { const n = 3 + rnd(5), d = rnd(2) ? 1 : -1;
              t = Array.from({length:n}, (_,k) => SCALE[((s + d*k) % 7 + 7) % 7]); break; }
    case 1: { const n = 3 + rnd(3);
              t = Array.from({length:n}, (_,k) => SCALE[(s + 2*k) % 7]); break; }
    case 2: { const n = 3 + rnd(2);
              const up = Array.from({length:n}, (_,k) => SCALE[(s+k)%7]);
              t = [...up, ...up.slice(0,-1).reverse()]; break; }
    case 3: { const p = 2 + rnd(3);
              const cell = Array.from({length:p}, (_,k) => SCALE[(s+2*k)%7]);
              t = [...cell, ...cell]; break; }
    case 4: { const a = SCALE[s], b = SCALE[(s+4)%7];
              t = rnd(2) ? [a,a,a,a] : [a,b,a,b]; break; }
    case 5: { t = []; const n = 1 + rnd(3);
              for (let k=0;k<n;k++) t.push(COLOUR[rnd(COLOUR.length)], SCALE[(s+k)%7]); break; }
    default: t = Array.from({length: 3 + rnd(6)}, () =>
              rnd(4) ? SCALE[rnd(SCALE.length)] : COLOUR[rnd(COLOUR.length)]);
  }
  if (rnd(3) === 0 && t.length > 1) {           // sprinkle colour into the shape
    const at = 1 + rnd(t.length - 1);
    t = [...t.slice(0,at), COLOUR[rnd(COLOUR.length)], ...t.slice(at)];
  }
  return t.slice(0, 8);
}

// ── ONE COMMIT, transcribed from confirmNoteTrack ───────────────────────────
function scoreCommit({ track, skills, style, driveStack, sustainStack, prevTempDrive, prevTempSustain }) {
  // keyScale — the playable scale plus the discord unlocks. Simplified to the
  // scale: the audit compares SOURCES against each other, and the palette shifts
  // all of them together.
  const keyScale = SCALE;

  // B3 single pass (jsx ~3023)
  const cl = classifyTrack(track, keyScale, driveStack, sustainStack, skills);
  const unpardoned = countUnpardoned(cl);
  const pardons = countPardonedByStack(cl);

  // B4 colour routing + C4 Flair Outside (jsx ~3210)
  const rawColorDrive   = Math.min(2, pardons.drive);
  const rawColorSustain = Math.min(2, pardons.sustain);
  const isFlair = false;     // Style system deleted
  const colorDrive    = rawColorDrive;
  const colorSustain  = rawColorSustain;
  const flairOutsideDb = 0;

  // Drive / Sustain boosts and their overflow into Db (jsx ~3155 / ~3175)
  const diatonicRunLen = detectDiatonicRun(track, SCALE);
  const skipClimbLen   = detectSkipClimb(track, SCALE);
  const repeatPatLen   = detectRepeatPattern(track, SCALE);
  const rawDrive   = driveBoostFromRun(diatonicRunLen) + colorDrive;
  const rawSustain = sustainBoostFromPattern(repeatPatLen) + colorSustain;
  const dbOverflow = 0;      // the discarded boost no longer becomes Db

  // B7 penalty, B2 base, B6 payout, B5 lock (jsx ~3300)
  const discordPenalty = discordPenaltyFor(unpardoned);
  const base = scoreTrackDB(track, IV.fourth, IV.fifth);
  const chrom = { db: 0 };   // B6 payout deleted — the run pays the crowd now
  let lock = base.endingBonus > 0
    ? harmonicLock(track[track.length-1], driveStack, sustainStack)
    : { bonus: 0 };
  // PROJECTION: model the proposed triad fix (rank 4 and 5 pay 1, rank 6+ pay 2)
  // without editing the shipped LOCK_BONUS_BY_RANK. Toggle with LOCKFIX=1.
  if (process.env.LOCKFIX === '1' && base.endingBonus > 0 && lock.rank >= 4) {
    lock = { ...lock, bonus: lock.rank >= 6 ? 2 : 1 };
  }
  const preDiscord = base.points + lock.bonus + chrom.db + flairOutsideDb;
  const earned = Math.max(0, preDiscord - discordPenalty);

  // Performance Score → Db top-up (jsx ~3380)
  const lastNote = track[track.length-1];
  const perfDiscordCount = unpardoned;   // the Flair P-exemption went with Style
  const { score: perfScore } = performanceScore({
    melodyLine: track,
    trackHasTritone: track.includes(IV.tritone),
    isOctaveResolution: track.length > 1 && lastNote === track[0],
    diatonicRunLen, repeatPatLen, skipClimbLen,
    hasGatedEnding: lastNote === IV.minorSeventh || lastNote === IV.majorThird || lastNote === IV.tritone,
    hasRiff: false, cadenceResolved: false,
    earned, edgeResolved: false, susEnd: false,
    discordCount: perfDiscordCount, freestylePardon: false,
  });
  void perfScore;
  const perfDbBonus = 0;     // P pays the crowd now, not Db

  // Style Db (jsx ~3566)
  void chordContext; void style;
  const st = { db: 0 };      // Style Db deleted

  // ⚠️ `endingBonus` is INSIDE base.points — split out so the audit can see the
  // ending ladder and raw track length as the two separate levers they are.
  // PROJECTION FLAGS — model a cut without deleting anything yet.
  const CUT = process.env.CUT || '';
  const outOverflow = CUT.includes('overflow') ? 0 : dbOverflow;
  const outPerf     = CUT.includes('perf')     ? 0 : perfDbBonus;
  const outStyle    = CUT.includes('style')    ? 0 : st.db;
  const outChrom    = CUT.includes('chrom')    ? 0 : chrom.db;
  const outLock     = CUT.includes('lock')     ? 0 : lock.bonus;
  const outOutside  = CUT.includes('style')    ? 0 : flairOutsideDb;

  return {
    length:   base.points - base.endingBonus,
    ending:   base.endingBonus,
    lock:     outLock,
    chromatic: outChrom,
    outside:  outOutside,
    penalty: -Math.min(discordPenalty, preDiscord),   // what was actually deducted
    overflow: outOverflow,
    perfTopUp: outPerf,
    style:    outStyle,
    total:    Math.max(0, base.points + outLock + outChrom + outOutside - discordPenalty)
              + outOverflow + outPerf + outStyle,
  };
}

// The five dead columns (chromatic, outside, overflow, perfTopUp, style) are kept
// in `scoreCommit`'s return pinned at 0, so this file still documents what USED to
// pay and a re-added source has an obvious slot. They're dropped from the report.
const KEYS = ['length','ending','lock','penalty'];
const LABEL = {
  length:   'length    — how much did you play?',
  ending:   'ending    — where did you come to rest?',
  lock:     'lock      — was that landing in YOUR CHORD?',
  penalty:  'penalty   — how many notes fought the key?',
};

const N = 3000;
const grand = Object.fromEntries(KEYS.map(k => [k, { sum: 0, fired: 0, absSum: 0 }]));
let grandTotal = 0, commits = 0;
const byTier = [];

for (let ti = 0; ti < TIERS.length; ti++) {
  const tier = TIERS[ti];
  const acc = Object.fromEntries(KEYS.map(k => [k, { sum: 0, fired: 0, absSum: 0 }]));
  let total = 0;
  for (let i = 0; i < N; i++) {
    const [ds, ss] = STACKS[Math.min(ti, STACKS.length - 1)];
    const r = scoreCommit({
      track: makeTrack(), skills: tier.skills, style: STYLES[i % 3],   // style is inert now
      driveStack: ds, sustainStack: ss,
      prevTempDrive: rnd(4), prevTempSustain: rnd(4),
    });
    for (const k of KEYS) {
      acc[k].sum += r[k]; acc[k].absSum += Math.abs(r[k]);
      if (r[k] !== 0) acc[k].fired++;
      grand[k].sum += r[k]; grand[k].absSum += Math.abs(r[k]);
      if (r[k] !== 0) grand[k].fired++;
    }
    total += r.total; grandTotal += r.total; commits++;
  }
  byTier.push({ tier: tier.name, acc, total });
}

const pad = (s, n) => String(s).padEnd(n);
const num = (v, n = 6) => String(v).padStart(n);

console.log('\n════ Db SOURCE AUDIT ════════════════════════════════════════════════');
console.log(`${N} commits per tier · deterministic seed\n`);

console.log(pad('SOURCE', 44) + num('mean') + num('share') + num('fires'));
console.log('─'.repeat(68));
const rows = KEYS.map(k => ({
  k,
  mean: grand[k].sum / commits,
  share: grand[k].absSum / commits,
  fires: grand[k].fired / commits,
})).sort((a, b) => b.share - a.share);
for (const r of rows) {
  console.log(pad(LABEL[r.k], 44) + num(r.mean.toFixed(2)) + num((100 * r.share / (grandTotal / commits)).toFixed(0) + '%') + num((100 * r.fires).toFixed(0) + '%'));
}
console.log('─'.repeat(68));
console.log(pad('TOTAL Db per commit', 44) + num((grandTotal / commits).toFixed(2)));

console.log('\n──── by Theory tier (mean Db per commit) ────────────────────────────');
console.log(pad('', 20) + KEYS.map(k => num(k.slice(0, 6), 8)).join(''));
for (const t of byTier) {
  console.log(pad(t.tier, 20) + KEYS.map(k => num((t.acc[k].sum / N).toFixed(2), 8)).join(''));
}
console.log(pad('', 20) + '  ← total: ' + byTier.map(t => (t.total / N).toFixed(2)).join('  '));

console.log('\n──── how often does a source do ANY work? ───────────────────────────');
for (const r of rows) {
  const bar = '█'.repeat(Math.round(r.fires * 40));
  console.log(pad(LABEL[r.k], 44) + num((100 * r.fires).toFixed(0) + '%') + '  ' + bar);
}
console.log();
