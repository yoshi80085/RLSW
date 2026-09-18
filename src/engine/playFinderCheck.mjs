// ─── 🎯 PLAY FINDER CHECK ────────────────────────────────────────────────────
// IDEAS_INBOX [P1] "Beginner chord finder", step 1 — the brain the fans' speech
// bubbles will speak for (Alex, 2026-09-16). `engine/policies/playFinder.js`.
//
// ⚠️ WHAT THIS SUITE IS REALLY GUARDING:
//   §2 — THE NUMBERS ARE THE GAME'S. Every play the finder returns is committed
//        through the REAL `commitMelodyEconomy`, and the Db, fans, carrot and
//        moves it reports must be the ones that commit pays. A finder that
//        promised a line the commit then paid differently would teach a beginner
//        to distrust the crowd.
//   §3 — "STRONGEST POSSIBLE" IS TRUE. On small hands every play is enumerated
//        by brute force, with NONE of the finder's pruning, and the finder must
//        match the best vector for every goal. The bounds are the finder's only
//        local arithmetic; this is what proves they are never too tight.
//   §5 — THE BOUNDS KNOW EXACTLY THE GESTURES THAT SHIP. A new or renamed
//        gesture must fail here loudly rather than be pruned by a stale bound.
//
// Run: npm run test:playfinder
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = rel => fs.readFileSync(path.join(HERE, rel), 'utf8');

let pass = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) pass++;
  else { failures.push(msg); console.log('  ✗', msg); }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const {
  findBestPlay, findBestPlays, scorePlay, goalVector,
  FINDER_GOALS, FINDER_TRACK_SEATS, FINDER_NODE_BUDGET, FINDER_BOUNDED_GESTURES,
} = await import('./policies/playFinder.js');
const { commitMelodyEconomy } = await import('./systems/melodyCommit.js');
const { spiritChord } = await import('./systems/attackParams.js');
const { STACK_COMMIT_BUDGET, stackCapFor } = await import('../data/gameConstants.js');
const { STYLE_GESTURES } = await import('../music/spiritStyle.js');
const { refillStock } = await import('../music/cadence.js');
const { melodyModeFor } = await import('../music/melodyIdentity.js');
const { buildScale, pitchIndex, playableScale } = await import('../music/notes.js');
const { makeRng } = await import('./rng.js');

console.log('🎯 playFinderCheck — the best play a hand can make, per goal\n');

const ROSTER = ['cosmic_ronin', 'Metalness_Monster', 'intergalactic_0'];
const ROOTS = ['C', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'A', 'Bb', 'B'];
const sheet = (over = {}) => ({
  rootNote: 'C', noteStock: [], usedStockIdx: [], driveStack: [], sustainStack: [],
  stackCommitsThisTurn: 0, melodyLine: [], ...over,
});
const lexCmp = (a, b) => { for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };

/** Structural legality of a returned play against the sheet it came from. */
function legal(spiritId, ns, play) {
  const problems = [];
  const idxs = [...play.stack.map(s => s.idx), ...play.melody.map(m => m.idx)];
  if (new Set(idxs).size !== idxs.length) problems.push('a stock index is used twice');
  for (const { idx, note } of [...play.stack, ...play.melody]) {
    if (ns.noteStock[idx] !== note) problems.push(`idx ${idx} is not ${note}`);
    if ((ns.usedStockIdx ?? []).includes(idx)) problems.push(`idx ${idx} was already spent`);
  }
  if (play.stack.length > STACK_COMMIT_BUDGET - (ns.stackCommitsThisTurn ?? 0)) problems.push('over the stack budget');
  for (const dest of ['drive', 'sustain']) {
    const held = ns[`${dest}Stack`] ?? [];
    const added = play.stack.filter(s => s.dest === dest).map(s => s.note);
    if (held.length + added.length > stackCapFor(ns, dest)) problems.push(`${dest} over its seats`);
  }
  if (play.line.length > FINDER_TRACK_SEATS) problems.push('line longer than the track');
  if (!same(play.line.slice(0, ns.melodyLine?.length ?? 0), ns.melodyLine ?? [])) problems.push('prefix not kept');
  if (!same(play.line.slice(ns.melodyLine?.length ?? 0), play.melody.map(m => m.note))) problems.push('line ≠ prefix + melody');
  return problems;
}

/** Commit the play through the game's own pipeline and read what it pays. */
function commitForReal(spiritId, ns, play) {
  const driveStack = [...(ns.driveStack ?? []), ...play.stack.filter(s => s.dest === 'drive').map(s => s.note)];
  const sustainStack = [...(ns.sustainStack ?? []), ...play.stack.filter(s => s.dest === 'sustain').map(s => s.note)];
  const state = {
    spirits: [{ id: spiritId, name: spiritId }],
    noteStates: { [spiritId]: { ...ns, driveStack, sustainStack, melodyLine: play.line, unlockedSkills: [] } },
  };
  const out = commitMelodyEconomy(state, spiritId, {});
  const temp = out.patch;
  return {
    db: out.report.earnedTotal,
    fans: out.report.perfFansGained,
    moves: out.report.usableMoves,
    drive: spiritChord(spiritId, driveStack).drive + (temp.tempDrive ?? ns.tempDrive ?? 0),
    sustain: spiritChord(spiritId, sustainStack).sustain + (temp.tempSustain ?? ns.tempSustain ?? 0),
  };
}

// ═══ 1. THE CONTRACT ════════════════════════════════════════════════════════
console.log('§1 the shape of an answer');
{
  ok(same(FINDER_GOALS, ['drive', 'sustain', 'db', 'fans']), 'four goals: drive, sustain, db, fans');
  ok(FINDER_TRACK_SEATS === 8, 'the track has 8 seats, as the client’s note click enforces');
  const client = read('../rlsw-simulator-v3_8_1.jsx');
  ok(/if \(melodyLine\.length >= 8\) return;/.test(client), '…and the client still refuses a ninth note (the number is transcribed, so it is checked)');
  ok(Number.isFinite(FINDER_NODE_BUDGET) && FINDER_NODE_BUDGET > 0, 'the node budget is a finite number');
  let threw = false;
  try { findBestPlay('cosmic_ronin', sheet(), 'vibes'); } catch { threw = true; }
  ok(threw, 'an unknown goal throws rather than quietly answering a different question');

  const ns = sheet({ noteStock: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'E', 'C', 'G', 'B', 'D'], paletteMode: 'hirajoshi' });
  const all = findBestPlays('cosmic_ronin', ns);
  ok(same(Object.keys(all), FINDER_GOALS), 'findBestPlays answers every goal');
  for (const goal of FINDER_GOALS) {
    const play = all[goal];
    ok(play.goal === goal, `${goal}: labelled with its goal`);
    ok(legal('cosmic_ronin', ns, play).length === 0, `${goal}: a legal play (${legal('cosmic_ronin', ns, play).join('; ') || 'ok'})`);
    ok(play.exact === true, `${goal}: proven, not merely found`);
    ok(same(play, findBestPlay('cosmic_ronin', ns, goal)), `${goal}: findBestPlay agrees with findBestPlays (the shared ceilings change nothing)`);
  }
  ok(same(ns, sheet({ noteStock: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'E', 'C', 'G', 'B', 'D'], paletteMode: 'hirajoshi' })), 'the note sheet is never mutated');
  const two = findBestPlays('cosmic_ronin', ns, { goals: ['fans', 'db'] });
  ok(same(Object.keys(two), ['fans', 'db']) && same(two.fans, all.fans) && same(two.db, all.db), '`goals` narrows the answer without changing it (the melody step asks for fans + db only)');
  let threwGoals = false;
  try { findBestPlays('cosmic_ronin', ns, { goals: ['fans', 'vibes'] }); } catch { threwGoals = true; }
  ok(threwGoals, '…and an unknown goal in `goals` throws');
}

// ═══ 2. THE NUMBERS ARE THE COMMIT'S ════════════════════════════════════════
console.log('§2 every reported number is what commitMelodyEconomy pays');
{
  let checked = 0;
  for (let seed = 1; seed <= 12; seed += 1) {
    const spiritId = ROSTER[seed % ROSTER.length];
    const mode = melodyModeFor(spiritId);
    const root = ROOTS[seed % ROOTS.length];
    const rng = makeRng(7000 + seed);
    const stock = refillStock(root, mode, spiritId === 'cosmic_ronin' ? 11 : 10, rng);
    const ns = sheet({ rootNote: root, paletteMode: mode, noteStock: stock,
      ...(seed % 3 === 0 ? { driveStack: [stock[0]], sustainStack: [stock[1]], usedStockIdx: [0, 1], stackCommitsThisTurn: 1 } : {}),
      ...(seed % 4 === 0 ? { tempDrive: 1 } : {}) });
    const plays = findBestPlays(spiritId, ns);
    for (const goal of FINDER_GOALS) {
      const play = plays[goal];
      if (!play.line.length) continue;
      const real = commitForReal(spiritId, ns, play);
      checked += 1;
      ok(play.result.db === real.db, `seed ${seed} ${spiritId} ${goal}: Db ${play.result.db} = commit's ${real.db}`);
      ok(play.result.fans === real.fans, `seed ${seed} ${spiritId} ${goal}: fans ${play.result.fans} = commit's ${real.fans}`);
      ok(play.result.moves === real.moves, `seed ${seed} ${spiritId} ${goal}: moves ${play.result.moves} = commit's ${real.moves}`);
      ok(play.result.drive === real.drive, `seed ${seed} ${spiritId} ${goal}: Drive ${play.result.drive} = chord + the commit's temp Drive ${real.drive}`);
      ok(play.result.sustain === real.sustain, `seed ${seed} ${spiritId} ${goal}: Sustain ${play.result.sustain} = chord + the commit's temp Sustain ${real.sustain}`);
      const ref = scorePlay(spiritId, ns, { stack: play.stack, line: play.line });
      ok(['drive', 'sustain', 'db', 'fans', 'spent'].every(k => ref[k] === play.result[k]), `seed ${seed} ${goal}: scorePlay agrees with the report`);
    }
  }
  ok(checked >= 40, `…across ${checked} committed plays`);
}

// ═══ 3. STRONGEST POSSIBLE — BRUTE FORCE ════════════════════════════════════
console.log('§3 brute force, no pruning, agrees on every goal');
{
  /** Every stack plan with no pruning at all: duplicates and every order. */
  function allStackPlans(ns, free) {
    const budget = STACK_COMMIT_BUDGET - (ns.stackCommitsThisTurn ?? 0);
    const out = [];
    const rec = (i, plan, used) => {
      out.push(plan);
      if (plan.length >= budget) return;
      for (const f of free) {
        if (used.has(f.idx)) continue;
        for (const dest of ['drive', 'sustain']) {
          const n = plan.filter(p => p.dest === dest).length + (ns[`${dest}Stack`]?.length ?? 0);
          if (n >= stackCapFor(ns, dest)) continue;
          rec(i + 1, [...plan, { idx: f.idx, note: f.note, dest }], new Set([...used, f.idx]));
        }
      }
    };
    rec(0, [], new Set());
    return out;
  }
  function allLines(ns, free, usedSet) {
    const prefix = ns.melodyLine ?? [];
    const seats = FINDER_TRACK_SEATS - prefix.length;
    const out = [];
    const rec = (line, used) => {
      out.push(line);
      if (line.length - prefix.length >= seats) return;
      for (const f of free) if (!used.has(f.idx)) rec([...line, f.note], new Set([...used, f.idx]));
    };
    rec([...prefix], usedSet);
    return out;
  }
  const freeOf = ns => ns.noteStock.map((note, idx) => ({ idx, note })).filter(f => !(ns.usedStockIdx ?? []).includes(f.idx));

  function brute(spiritId, ns) {
    const free = freeOf(ns);
    const best = {};
    // Joint goals: every (stack plan × line).
    for (const plan of allStackPlans(ns, free)) {
      const used = new Set(plan.map(p => p.idx));
      for (const line of allLines(ns, free, used)) {
        const v = scorePlay(spiritId, ns, { stack: plan, line });
        for (const goal of ['drive', 'sustain']) {
          const vec = goalVector(goal, v);
          if (!best[goal] || lexCmp(vec, best[goal]) > 0) best[goal] = vec;
        }
      }
    }
    // Db / fans, by the finder's documented DEFINITION: the best line over the
    // whole hand (shorter wins a tie), then the best stacks from its leftovers.
    // ⚠️ Several lines can tie on (primary, secondary, length) and leave different
    // notes behind, and the definition does not say which — so brute force keeps
    // EVERY tied line and the finder must equal the outcome of one of them.
    for (const goal of ['db', 'fans']) {
      let topVec = null, tops = [];
      for (const line of allLines(ns, free, new Set())) {
        const v = scorePlay(spiritId, ns, { stack: [], line });
        const vec = goal === 'db' ? [v.db, v.fans, -v.spent] : [v.fans, v.db, -v.spent];
        const c = topVec ? lexCmp(vec, topVec) : 1;
        if (c > 0) { topVec = vec; tops = [line]; } else if (c === 0) tops.push(line);
      }
      best[goal] = new Set();
      for (const line of tops) {
        const counts = new Map();
        for (const n of line.slice((ns.melodyLine ?? []).length)) counts.set(n, (counts.get(n) ?? 0) + 1);
        const left = free.filter(f => { const c = counts.get(f.note) ?? 0; if (c > 0) { counts.set(f.note, c - 1); return false; } return true; });
        let lineBest = null;
        for (const plan of allStackPlans(ns, left)) {
          const vec = goalVector(goal, scorePlay(spiritId, ns, { stack: plan, line }));
          if (!lineBest || lexCmp(vec, lineBest) > 0) lineBest = vec;
        }
        best[goal].add(JSON.stringify(lineBest));
      }
    }
    return best;
  }

  const cases = [];
  const SEEDS = Number(process.env.PLAYFINDER_BRUTE_SEEDS ?? 48);
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const spiritId = ROSTER[seed % ROSTER.length];
    const mode = melodyModeFor(spiritId);
    const root = ROOTS[(seed * 3) % ROOTS.length];
    const rng = makeRng(9100 + seed);
    const size = 5 + (seed % 2);
    // Every other hand is drawn UNWEIGHTED (guarantee 0), so discord-heavy hands —
    // where the separator and letter-contour bounds matter most — are covered.
    const stock = refillStock(root, mode, size, rng, seed % 2 ? 0.5 : 0);
    const variant = seed % 6;
    const ns = sheet({ rootNote: root, paletteMode: mode, noteStock: stock });
    // Every variant is a state the client can actually be in.
    if (variant === 1) Object.assign(ns, { driveStack: ['C', 'E'], sustainStack: [] });
    if (variant === 2) Object.assign(ns, { melodyLine: playableScale(root, mode).slice(0, 4), stackCommitsThisTurn: 2 });
    if (variant === 3) Object.assign(ns, { sustainStack: [stock[0]], usedStockIdx: [0], stackCommitsThisTurn: 1, tempSustain: 1 });
    if (variant === 4) Object.assign(ns, { driveStack: ['C', 'E', 'G'], sustainStack: ['D', 'F', 'A'] });     // both stacks full
    if (variant === 5) Object.assign(ns, { mojoDrain: 1, melodyLine: [buildScale(root, mode)[0]] });
    cases.push({ seed, spiritId, ns });
  }
  for (const { seed, spiritId, ns } of cases) {
    const want = brute(spiritId, ns);
    const got = findBestPlays(spiritId, ns);
    for (const goal of FINDER_GOALS) {
      const vec = goalVector(goal, got[goal].result);
      const match = want[goal] instanceof Set ? want[goal].has(JSON.stringify(vec)) : same(vec, want[goal]);
      ok(match, `seed ${seed} ${spiritId} ${goal}: finder ${JSON.stringify(vec)} = brute force ${want[goal] instanceof Set ? [...want[goal]].join(' or ') : JSON.stringify(want[goal])}`);
      ok(legal(spiritId, ns, got[goal]).length === 0, `seed ${seed} ${goal}: legal`);
    }
  }
}

// ═══ 4. THE RULES IT MUST RESPECT ═══════════════════════════════════════════
console.log('§4 the rules a suggestion must respect');
{
  const ronin = 'cosmic_ronin';
  const base = { rootNote: 'C', paletteMode: 'hirajoshi' };

  // Db wants the fifth LAST (ENDING_DB.fifth is the top rung).
  const db = findBestPlay(ronin, sheet({ ...base, noteStock: ['G', 'C', 'D', 'Eb', 'F'] }), 'db');
  ok(db.line.at(-1) === 'G' && db.result.ending === 'fifth', `Db ends on the fifth (${db.line.join(' ')})`);

  // Fans: with no repeated pitch the Monster's chug is impossible, so his only
  // fans are craft — and five distinct in-mode notes make the 5-note run (+2).
  const fans = findBestPlay('Metalness_Monster', sheet({ rootNote: 'C', paletteMode: 'phrygian', noteStock: ['G', 'Db', 'F', 'C', 'Eb'] }), 'fans');
  ok(fans.result.craftRun >= 5 && fans.result.craftFans === 2 && fans.result.fans === 2, `fans finds the 5-note run (${fans.line.join(' ')})`);

  // 🪤 REGRESSIONS the brute force found while the bounds were being written —
  // pinned here so they do not depend on the seed range §3 happens to run.
  // (a) the Db bound must let a discord already on the track be the separator
  //     between two clean streaks;
  const sep = findBestPlay('intergalactic_0', sheet({ rootNote: 'G', paletteMode: 'dorian', noteStock: ['G', 'A', 'Eb', 'E', 'Ab'], melodyLine: ['G', 'A', 'Bb', 'C'], stackCommitsThisTurn: 2 }), 'db');
  ok(sep.result.db === 5.5, `two streaks around a discord: Db ${sep.result.db} = 5.5 (${sep.line.join(' ')})`);
  // (b) the Ronin's contour bound must read the run OPEN AT THE END of the line —
  //     E♭ D C (shred) then C A♭ F (skip) shares the C, and pays both.
  //     ⚠️ Was E D♭ C until 2026-09-17: E and D♭ are discord in the Ronin's
  //     Hirajoshi, and discord now breaks a shape, so that line paid one fan.
  const both = findBestPlay(ronin, sheet({ ...base, noteStock: ['C', 'Ab', 'F', 'Eb', 'D'] }), 'fans');
  //     (In key the descent E♭ D C A♭ is also a 4-note craft run, hence the +craft.)
  ok(both.result.styleHits.length === 2 && both.result.fans === 2 + both.result.craftFans,
     `shred + skip sharing a note: style ${both.result.styleHits.join('+')}, fans ${both.result.fans} = 2 + craft ${both.result.craftFans} (${both.line.join(' ')})`);

  // Staggered slots are off-limits.
  const stock = ['G', 'C', 'D', 'Eb', 'F'];
  const barred = findBestPlays(ronin, sheet({ ...base, noteStock: stock }), { unavailable: [0] });
  ok(FINDER_GOALS.every(g => ![...barred[g].stack, ...barred[g].melody].some(x => x.idx === 0)), 'an unavailable (staggered) slot is never suggested');
  ok(barred.db.result.ending !== 'fifth', '…so the only fifth cannot be the Db ending');

  // No budget, full stacks, or a confirmed turn → no stack suggestions.
  const spent = findBestPlays(ronin, sheet({ ...base, noteStock: stock, stackCommitsThisTurn: STACK_COMMIT_BUDGET }));
  ok(FINDER_GOALS.every(g => spent[g].stack.length === 0), 'a spent stack budget suggests no stack commits');
  const full = findBestPlays(ronin, sheet({ ...base, noteStock: stock, driveStack: ['C', 'E', 'G'], sustainStack: ['A', 'C', 'E'] }));
  ok(FINDER_GOALS.every(g => full[g].stack.length === 0), 'full stacks suggest no stack commits');
  const opened = findBestPlay(ronin, sheet({ ...base, noteStock: ['Bb', 'D'], driveStack: ['C', 'E', 'G'], driveSlots: 1 }), 'drive');
  ok(opened.stack.some(s => s.dest === 'drive' && s.note === 'Bb') && opened.result.driveChord === 'C Dominant 7', `a FOUND seat is used: C E G + Bb → ${opened.result.driveChord}`);
  const done = findBestPlays(ronin, sheet({ ...base, noteStock: stock, melodyLine: ['C', 'D'], usedStockIdx: [], hasConfirmed: true }));
  ok(FINDER_GOALS.every(g => done[g].stack.length === 0 && done[g].melody.length === 0), 'a confirmed turn suggests nothing new');

  // A duplicate pitch class never goes into a stack that holds it.
  const dup = findBestPlays(ronin, sheet({ ...base, noteStock: ['C', 'C', 'E', 'G'], driveStack: ['C'] }));
  ok(FINDER_GOALS.every(g => !dup[g].stack.some(s => s.dest === 'drive' && pitchIndex(s.note) === 0)), 'a note the stack already holds is never re-committed to it');

  // The carrot: ending on the Drive root pays +1 temp Drive — and Mojo Drain kills it.
  const carrotHand = sheet({ ...base, noteStock: ['C', 'C', 'G', 'D'] });
  const carrot = findBestPlay(ronin, carrotHand, 'drive');
  ok(carrot.result.carrot === 'drive' && carrot.line.at(-1) && pitchIndex(carrot.line.at(-1)) === pitchIndex(carrot.stack.find(s => s.dest === 'drive')?.note),
    `drive: the line ends on the Drive root for the carrot (${carrot.stack.map(s => s.note).join(' ')} | ${carrot.line.join(' ')})`);
  const drained = findBestPlay(ronin, { ...carrotHand, mojoDrain: 1 }, 'drive');
  ok(drained.result.carrot === null, 'Mojo Drain: no carrot is promised');

  // The prefix already on the track is kept, and its notes are not re-used.
  const pre = sheet({ ...base, noteStock: ['C', 'D', 'Eb', 'F', 'G'], melodyLine: ['C', 'D'], usedStockIdx: [0, 1] });
  const kept = findBestPlays(ronin, pre);
  ok(FINDER_GOALS.every(g => same(kept[g].line.slice(0, 2), ['C', 'D']) && legal(ronin, pre, kept[g]).length === 0), 'a line already on the track is continued, not replaced');

  // Ties go to the play that spends fewer notes (unused stock carries over): an
  // all-discord hand pays no Db, so the Db play puts nothing on the track.
  const tie = findBestPlay(ronin, sheet({ ...base, noteStock: ['Bb', 'B', 'C#', 'E'] }), 'db');
  ok(tie.result.db === 0 && tie.melody.length === 0, 'nothing worth playing on the track → no melody suggested');

  // An empty hand is a legal, empty answer.
  const empty = findBestPlays(ronin, sheet({ ...base }));
  ok(FINDER_GOALS.every(g => empty[g].line.length === 0 && empty[g].stack.length === 0 && empty[g].exact), 'an empty hand answers empty, and exact');

  // ⚠️ The pocket dial, not combat's fallback (see the header of playFinder.js).
  const bare = findBestPlay(ronin, sheet({ ...base }), 'drive');
  ok(bare.result.drive === spiritChord(ronin, []).drive, `an empty Drive stack reports the dial's ${spiritChord(ronin, []).drive}, not the sheet stat`);
}

// ═══ 5. THE BOUNDS KNOW EXACTLY WHAT SHIPS ══════════════════════════════════
console.log('§5 the pruning bounds cover exactly the shipped gestures');
{
  const shipped = [...new Set(Object.values(STYLE_GESTURES).flat().map(g => g.id))].sort();
  ok(same([...FINDER_BOUNDED_GESTURES].sort(), shipped),
    `bounded gestures ${JSON.stringify([...FINDER_BOUNDED_GESTURES].sort())} = shipped ${JSON.stringify(shipped)} — a new gesture must be taught to the bound (or left to the loose fallback on purpose)`);
  const style = read('../music/spiritStyle.js');
  ok(/id: 'scalar_shred'[\s\S]*?contourRun\(line, 1\) >= 2/.test(style), 'scalar_shred is still a 1-letter contour of 3 notes (the bound assumes it)');
  ok(/id: 'even_skip'[\s\S]*?contourRun\(line, 2\) >= 2/.test(style), 'even_skip is still a 2-letter contour of 3 notes');
  ok(/id: 'pedal_chug'[\s\S]*?returnPhrases\(line\) > 0/.test(style) && /id: 'signal_circle'[\s\S]*?hits: returnPhrases/.test(style), 'pedal_chug / signal_circle are still A → B → A return phrases');
  const payout = read('../music/melodyPayout.js');
  ok(/Math\.max\(detectDiatonicRun\(line, scale\), detectSkipClimb\(line, scale\)\)/.test(payout), 'craftRunFor is still max(step run, skip run) — the run bound assumes it');
  ok(/export const CLEAN_STREAK_CAP = 2;/.test(payout) && /export const CLEAN_STREAK_MIN = 3;/.test(payout) && /export const CLEAN_NOTE_DB = 0\.5;/.test(payout) && /export const CLEAN_STREAK_DB = 0\.5;/.test(payout),
    'the clean-note / streak numbers the Db bound is written against are unchanged');
}

// ═══ 6. FULL HANDS ARE PROVEN INSIDE THE BUDGET ═════════════════════════════
console.log('§6 full seeded hands: every goal proven inside the budget');
{
  let hands = 0, proven = 0, worstLines = 0, worstMs = 0;
  for (const spiritId of ROSTER) {
    const mode = melodyModeFor(spiritId);
    for (let seed = 1; seed <= 8; seed += 1) {
      const root = ROOTS[(seed * 7) % ROOTS.length];
      const rng = makeRng(31337 + seed * 11 + ROSTER.indexOf(spiritId));
      const stock = refillStock(root, mode, spiritId === 'cosmic_ronin' ? 11 : 10, rng);
      const ns = sheet({ rootNote: root, paletteMode: mode, noteStock: stock });
      const t0 = performance.now();
      const plays = findBestPlays(spiritId, ns);
      worstMs = Math.max(worstMs, performance.now() - t0);
      for (const goal of FINDER_GOALS) {
        hands += 1;
        if (plays[goal].exact) proven += 1;
        worstLines = Math.max(worstLines, plays[goal].searched.lines + plays[goal].searched.ceilingLines);
        ok(legal(spiritId, ns, plays[goal]).length === 0, `${spiritId} seed ${seed} ${goal}: legal`);
      }
    }
  }
  // 📌 Aggregate over fixed seeds with a margin, never one lucky seed (§B4).
  ok(proven === hands, `${proven}/${hands} full-hand goals proven exact (worst ${worstLines} lines, ${worstMs.toFixed(0)} ms for all four goals)`);
  ok(worstLines <= FINDER_NODE_BUDGET * 2, `worst search stays inside twice the per-search budget (${worstLines} ≤ ${FINDER_NODE_BUDGET * 2})`);
  // A starved budget must SAY so rather than claim a proof.
  const rng = makeRng(4242);
  const starved = findBestPlay('cosmic_ronin', sheet({ rootNote: 'D', paletteMode: 'hirajoshi', noteStock: refillStock('D', 'hirajoshi', 11, rng) }), 'fans', { nodeBudget: 50 });
  ok(starved.exact === false,
    'a starved budget reports exact: false instead of claiming a proof');
}

// ═══ 7. WIRED ═══════════════════════════════════════════════════════════════
console.log('§7 the suite is run by something');
{
  const pkg = JSON.parse(read('../../package.json'));
  ok(!!pkg.scripts['test:playfinder'] && /test:playfinder/.test(pkg.scripts['test:all']), 'test:playfinder exists and test:all runs it');
}

console.log('');
if (failures.length) {
  console.log(`❌ playFinderCheck: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`✅ playFinderCheck: ${pass} assertions passed`);
