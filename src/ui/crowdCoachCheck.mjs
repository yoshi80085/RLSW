// ─── 🎤 CROWD COACH CHECK ────────────────────────────────────────────────────
// `ui/crowdCoach.js` — what the fans shout in the melody step, and which notes
// glow in the chord step (IDEAS_INBOX [P1] Beginner chord finder, step 2).
//
// ⚠️ WHAT THIS SUITE IS REALLY GUARDING:
//   §2 — A BUBBLE IS ONE INSTRUCTION. The words and the note chips describe the
//        same notes: a named gesture is completed by exactly the chips shown, its
//        direction is the chips' direction, a return phrase names the chips' own
//        notes. The first draft broke this ("Hit B♭, SLAM back to A♭!" over C E♭ F)
//        and nothing but reading it would have said so.
//   §3 — FOLLOWING THE CROWD KEEPS ITS PROMISE. A player who plays the first chip
//        of every bubble ends on a line that pays at least what the first bubble
//        promised. A coach whose promise shrinks as you obey it teaches distrust.
//   §4 — THE GLOW IS THE FINDER'S. Never a slot the finder did not choose, one
//        colour per slot, and the tie rule as documented.
//
// Run: npm run test:crowdcoach
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

const { crowdAsks, chordGlow, CROWD_VOICES, prettyNote } = await import('./crowdCoach.js');
const { findBestPlays, scorePlay } = await import('../engine/policies/playFinder.js');
const { detectSpiritStyle } = await import('../music/spiritStyle.js');
const { paletteScaleFor } = await import('../music/notes.js');
const { refillStock } = await import('../music/cadence.js');
const { melodyModeFor } = await import('../music/melodyIdentity.js');
const { makeRng } = await import('../engine/rng.js');

console.log('🎤 crowdCoachCheck — the bubble says what the chips show\n');

const ROSTER = ['cosmic_ronin', 'Metalness_Monster', 'intergalactic_0'];
const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'Bb'];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const letter = n => LETTERS.indexOf(String(n)[0]);
const sheet = (over = {}) => ({ rootNote: 'C', noteStock: [], usedStockIdx: [], driveStack: [], sustainStack: [], melodyLine: [], ...over });
const GESTURE_KEYS = { scalar_shred_up: 'scalar_shred', scalar_shred_down: 'scalar_shred', even_skip_up: 'even_skip', even_skip_down: 'even_skip', pedal_chug: 'pedal_chug', signal_circle: 'signal_circle' };

// ═══ 1. THE VOICES ══════════════════════════════════════════════════════════
console.log('§1 every voice can say everything the logic can reach');
{
  const src = read('./crowdCoach.js');
  const reachable = new Set([
    ...Object.keys(GESTURE_KEYS), 'craft_up', 'craft_down', 'lead_up', 'lead_down',
    'ending_fifth', 'ending_fourth', 'ending_tonic', 'in_key',
  ]);
  for (const [name, voice] of Object.entries(CROWD_VOICES)) {
    ok(same(Object.keys(voice).sort(), [...reachable].sort()), `voice "${name}" has exactly the reachable keys`);
    ok(Object.values(voice).every(t => typeof t === 'string' && t.length > 0 && t.length <= 44), `voice "${name}": every line fits a bubble (≤ 44 chars)`);
  }
  ok(/'in_key'/.test(src) && /`ending_\$\{/.test(src) && /lead_down/.test(src), 'the keys the suite lists are the keys the logic builds');
  ok(prettyNote('Bb') === 'B♭' && prettyNote('F#') === 'F♯' && prettyNote('B') === 'B', 'chips spell ♭ and ♯');
}

// Seeded hands, walked note by note the way a beginner who obeys the crowd would.
const walks = [];
for (let seed = 1; seed <= 36; seed += 1) {
  const spiritId = ROSTER[seed % ROSTER.length];
  const mode = melodyModeFor(spiritId);
  const root = ROOTS[seed % ROOTS.length];
  const rng = makeRng(5150 + seed);
  const stock = refillStock(root, mode, spiritId === 'cosmic_ronin' ? 11 : 10, rng);
  walks.push({ seed, spiritId, ns: sheet({ rootNote: root, paletteMode: mode, noteStock: stock }) });
}

// ═══ 2. A BUBBLE IS ONE INSTRUCTION ═════════════════════════════════════════
// ═══ 3. FOLLOWING THE CROWD KEEPS ITS PROMISE ═══════════════════════════════
console.log('§2 words and chips agree · §3 following the crowd keeps its promise');
{
  let bubbles = 0, gestureBubbles = 0, steps = 0, spoke = 0;
  for (const { seed, spiritId, ns: start } of walks) {
    let ns = start;
    const first = findBestPlays(spiritId, ns, { goals: ['fans', 'db'] });
    const promised = first.fans.result.fans;
    for (let step = 0; step < 8; step += 1) {
      const plays = findBestPlays(spiritId, ns, { goals: ['fans', 'db'] });
      const asks = crowdAsks(spiritId, ns, plays);
      const prefix = ns.melodyLine;
      steps += 1;
      if (asks.length) spoke += 1;
      for (const ask of asks) {
        bubbles += 1;
        const tag = `seed ${seed} ${spiritId} step ${step} "${ask.text}" [${ask.notes.join(' ')}]`;
        const play = plays[ask.goal];
        ok(ask.notes.length >= 1 && ask.notes.length === ask.idx.length, `${tag}: notes and slots pair up`);
        ok(ask.idx.every((i, k) => ns.noteStock[i] === ask.notes[k] && !ns.usedStockIdx.includes(i)), `${tag}: every chip is a live slot holding that note`);
        if (ask.kind === 'fans' || ask.key === 'in_key') {
          ok(same(ask.notes, play.melody.slice(0, ask.notes.length).map(m => m.note)), `${tag}: the chips are the finder's next notes, in order`);
        } else {
          if (asks[0].kind === 'fans') ok(ask.goal === 'fans' && ask.idx[0] === plays.fans.melody.at(-1).idx, `${tag}: same-line (the default) — the ending belongs to the line the fans bubble is walking`);
          ok(ask.notes[0] === play.melody.at(-1).note && ask.idx[0] === play.melody.at(-1).idx, `${tag}: the ending chip is the finder line's last note`);
          ok(ask.key === `ending_${play.result.ending}`, `${tag}: the ending named is the one the line pays`);
          ok(ask.text.includes(prettyNote(ask.notes[0])), `${tag}: the ending's words name its chip`);
        }
        const gesture = GESTURE_KEYS[ask.key];
        if (gesture) {
          gestureBubbles += 1;
          const through = [...prefix, ...ask.notes];
          const pal = paletteScaleFor(spiritId, ns);   // the payout's palette — discord breaks a shape
          ok(detectSpiritStyle(spiritId, through, pal).hits.includes(gesture), `${tag}: the chips COMPLETE the ${gesture} it names`);
          ok(!detectSpiritStyle(spiritId, through.slice(0, -1), pal).hits.includes(gesture) || detectSpiritStyle(spiritId, prefix, pal).hits.includes(gesture),
            `${tag}: …and not one chip earlier (the window stops where the gesture lands)`);
          if (/_up$|_down$/.test(ask.key)) {
            const a = letter(through.at(-2)), b = letter(through.at(-1));
            const climbs = ((b - a + 7) % 7) <= 3;
            ok(a !== b && climbs === ask.key.endsWith('_up'), `${tag}: "${ask.key}" matches the last step's direction`);
          } else {
            const [a, b, c] = through.slice(-3);
            ok(a === c && ask.text.includes(prettyNote(a)) && ask.text.includes(prettyNote(b)), `${tag}: the return phrase names the chips' own ${a}–${b}–${a}`);
          }
        }
        ok(ask.payoff.fans === play.result.fans && ask.payoff.db === play.result.db, `${tag}: the payoff is the whole line's (nothing pays before commit)`);
      }
      // Obey the crowd: play the first chip of the first bubble.
      const lead = asks[0];
      if (!lead) break;
      const idx = lead.kind === 'fans' || lead.key === 'in_key' ? lead.idx[0] : plays[lead.goal].melody[0].idx;
      ns = { ...ns, melodyLine: [...ns.melodyLine, ns.noteStock[idx]], usedStockIdx: [...ns.usedStockIdx, idx] };
    }
    const final = scorePlay(spiritId, start, { line: ns.melodyLine });
    if (promised > 0) ok(final.fans >= promised, `seed ${seed} ${spiritId}: obeying the crowd lands ${final.fans} fans, promised ${promised} (${ns.melodyLine.join(' ')})`);
  }
  ok(bubbles >= 150 && gestureBubbles >= 40, `…${bubbles} bubbles checked, ${gestureBubbles} naming a gesture, over ${steps} steps`);
  ok(spoke / steps > 0.5, `the crowd has something to say on most steps (${spoke}/${steps})`);
}

// ═══ 4. THE RULES AROUND THE BUBBLES ════════════════════════════════════════
console.log('§4 quiet when it should be, and the glow is the finder’s');
{
  const ronin = 'cosmic_ronin';
  const base = { rootNote: 'C', paletteMode: 'hirajoshi' };
  // A confirmed turn: silence.
  const done = sheet({ ...base, noteStock: ['C', 'D', 'Eb'], hasConfirmed: true });
  ok(crowdAsks(ronin, done, findBestPlays(ronin, done, { goals: ['fans', 'db'] })).length === 0, 'a confirmed turn: the crowd is quiet');
  // An all-discord hand pays nothing: silence rather than noise.
  const junk = sheet({ ...base, noteStock: ['B', 'E', 'A', 'Db'] });
  ok(crowdAsks(ronin, junk, findBestPlays(ronin, junk, { goals: ['fans', 'db'] })).length === 0, 'nothing worth playing: the crowd is quiet');
  // dbBubble off.
  const hand = sheet({ ...base, noteStock: ['C', 'D', 'Eb', 'F', 'G'] });
  const plays = findBestPlays(ronin, hand, { goals: ['fans', 'db'] });
  const on = crowdAsks(ronin, hand, plays), off = crowdAsks(ronin, hand, plays, { dbBubble: false });
  ok(on.some(a => a.kind === 'db') && !off.some(a => a.kind === 'db'), 'dbBubble: false removes the ending bubble');
  ok(on[0].kind === 'fans', 'the fans bubble comes first');
  // same-line vs best-db.
  const same_ = on.find(a => a.kind === 'db');
  ok(same_ && same_.idx[0] === plays.fans.melody.at(-1).idx, "same-line: the ending names the fans line's own last note");
  const best = crowdAsks(ronin, hand, plays, { ending: 'best-db' }).find(a => a.kind === 'db');
  ok(best && best.idx[0] === plays.db.melody.at(-1).idx, 'best-db: the ending names the best-Db line\'s last note');
  // Plain voice changes words, never notes.
  const plain = crowdAsks(ronin, hand, plays, { voice: 'plain' });
  ok(same(plain.map(a => a.notes), on.map(a => a.notes)) && !same(plain.map(a => a.text), on.map(a => a.text)), 'the voice lever changes the words and never the notes');
  // Chip cap.
  ok(crowdAsks(ronin, hand, plays, { chips: 1 }).every(a => a.notes.length === 1), 'chips: 1 → one chip per bubble');

  // 🔴🔵 The glow.
  for (const { seed, spiritId, ns } of walks.slice(0, 12)) {
    const cp = findBestPlays(spiritId, ns, { goals: ['drive', 'sustain'] });
    for (const src of ['drive', 'sustain', 'both']) {
      const glow = chordGlow(cp, src, { drive: 3, sustain: 2 });
      const chosen = new Set([...(cp.drive.stack), ...(cp.sustain.stack)].map(s => s.idx));
      ok([...glow.keys()].every(i => chosen.has(i)), `seed ${seed} ${src}: only slots the finder chose glow`);
      ok([...glow.values()].every(v => v === 'drive' || v === 'sustain'), `seed ${seed} ${src}: one colour per slot`);
      if (src !== 'both') ok(same([...glow.keys()].sort(), cp[src].stack.map(s => s.idx).sort()), `seed ${seed} ${src}: exactly that play's stack`);
    }
  }
  const tie = { drive: { stack: [{ idx: 0, dest: 'drive' }] }, sustain: { stack: [{ idx: 0, dest: 'sustain' }, { idx: 1, dest: 'sustain' }] } };
  ok(chordGlow(tie, 'both', { drive: 2, sustain: 2 }).get(0) === 'drive', 'a slot best for both: Drive wins a tie');
  ok(chordGlow(tie, 'both', { drive: 4, sustain: 2 }).get(0) === 'sustain', '…and the lower dial wins otherwise');
  ok(chordGlow(tie, 'both', {}).get(1) === 'sustain', 'a Sustain-only slot glows blue');
}

// ═══ 5. WIRED ═══════════════════════════════════════════════════════════════
console.log('§5 the suite is run by something');
{
  const pkg = JSON.parse(read('../../package.json'));
  ok(!!pkg.scripts['test:crowdcoach'] && /test:crowdcoach/.test(pkg.scripts['test:all']), 'test:crowdcoach exists and test:all runs it');
}

console.log('');
if (failures.length) {
  console.log(`❌ crowdCoachCheck: ${failures.length} failed, ${pass} passed`);
  process.exit(1);
}
console.log(`✅ crowdCoachCheck: ${pass} assertions passed`);
