// =============================================================================
// riff/riffArchetypes.test.mjs — corpus test for the archetype generator
// -----------------------------------------------------------------------------
//   node src/riff/riffArchetypes.test.mjs
//
// Asserts the properties that make the arrow highway readable, and prints the
// arrow-signature table per genre / archetype / Style so the design claim is
// checkable rather than asserted.
// =============================================================================

import {
  generateArchetypeRiff, analyseArrows, arrowsFor,
  GENRES, SCALES, STYLE_BIAS,
} from './riffArchetypes.js';

let fails = 0, checks = 0;
const ok = (cond, msg) => {
  checks++;
  if (!cond) { if (fails < 12) console.log('  ❌ ' + msg); fails++; }
};

// deterministic rng so the corpus is reproducible
function makeRand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const GENRE_KEYS = Object.keys(GENRES);
const STYLES = ['Shred', 'Groove', 'Flair'];
const ARCHES = ['pedal','chug','gallop','run','arch_run','chromatic','blues_box','power_plane','alt_cell'];

/* ═══════════════════════════════════════════════════════════════════════════
   1. STRUCTURAL INVARIANTS — 3,000 riffs across every genre × style
   ═══════════════════════════════════════════════════════════════════════ */

const perGenre = {}, perStyle = {};
let n = 0;

for (let i = 0; i < 3000; i++) {
  const genre = GENRE_KEYS[i % GENRE_KEYS.length];
  const style = i % 4 === 3 ? null : STYLES[i % 3];
  const len = 6 + (i % 12);
  const rand = makeRand(i * 7919 + 13);

  const riff = generateArchetypeRiff({ genre, style, len, rand });
  const a = analyseArrows(riff.notes);

  ok(riff.notes.length >= 2, `${genre}: riff has notes`);
  ok(riff.notes.length <= Math.max(2, len), `${genre}: riff respects target length (${riff.notes.length} > ${len})`);
  ok(SCALES[riff.scaleName], `${genre}: named scale exists (${riff.scaleName})`);
  ok(ARCHES.includes(riff.archetype), `${genre}: known archetype (${riff.archetype})`);

  for (let k = 0; k < riff.notes.length; k++) {
    const note = riff.notes[k];
    n++;
    ok(Number.isFinite(note.semi), `${genre}: semi is finite`);
    ok(note.semi >= -24 && note.semi <= 36, `${genre}: semi in playable range (${note.semi})`);
    ok(['steady','rushed','rest'].includes(note.feel), `${genre}: known feel (${note.feel})`);
    ok(note.gapBefore >= 0, `${genre}: gapBefore non-negative`);
    ok(k > 0 || note.gapBefore === 0, `${genre}: first note has no gap`);
    ok(!note.bend || note.sustain > 0, `${genre}: bend implies sustain`);
  }

  // arrows must equal true melodic direction — the input contract
  const arrows = arrowsFor(riff.notes);
  for (let k = 1; k < arrows.length; k++) {
    const truth = riff.notes[k].semi > riff.notes[k-1].semi ? 'up'
                : riff.notes[k].semi < riff.notes[k-1].semi ? 'down' : 'same';
    ok(arrows[k] === truth, `${genre}: arrow matches direction at ${k}`);
  }

  // determinism — same seed, same riff
  const twin = generateArchetypeRiff({ genre, style, len, rand: makeRand(i * 7919 + 13) });
  ok(JSON.stringify(twin.notes.map(x => x.semi)) === JSON.stringify(riff.notes.map(x => x.semi)),
     `${genre}: deterministic for a given rng`);

  (perGenre[genre] ??= []).push(a);
  if (style) (perStyle[style] ??= []).push({ a, riff });
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. THE ARROW CLAIM — clustered "same" (chug) vs scattered "same" (tax)
   ═══════════════════════════════════════════════════════════════════════ */

const avg = (xs, f) => xs.reduce((s, x) => s + f(x), 0) / xs.length;

console.log('\n══ ARROW SIGNATURE BY GENRE ══════════════════════════════════════');
console.log('genre          same%   clustered   scattered   longest→run  longest dir-run');
for (const g of GENRE_KEYS) {
  const rows = perGenre[g];
  console.log(
    GENRES[g].label.padEnd(14) +
    avg(rows, r => r.samePct).toFixed(1).padStart(5) +
    avg(rows, r => r.sameClustered).toFixed(2).padStart(12) +
    avg(rows, r => r.sameScattered).toFixed(2).padStart(12) +
    avg(rows, r => r.longestSameRun).toFixed(2).padStart(13) +
    avg(rows, r => r.longestDirRun).toFixed(2).padStart(17)
  );
}

console.log('\n══ ARROW SIGNATURE BY ARCHETYPE ══════════════════════════════════');
console.log('archetype      same%   longest→run  longest dir-run  alternations');
for (const arch of ARCHES) {
  const rows = [];
  for (let i = 0; i < 260; i++) {
    const r = generateArchetypeRiff({
      genre: GENRE_KEYS[i % GENRE_KEYS.length], len: 11,
      rand: makeRand(i * 104729 + 7), archetype: arch,
    });
    rows.push(analyseArrows(r.notes));
  }
  console.log(
    arch.padEnd(14) +
    avg(rows, r => r.samePct).toFixed(1).padStart(5) +
    avg(rows, r => r.longestSameRun).toFixed(2).padStart(13) +
    avg(rows, r => r.longestDirRun).toFixed(2).padStart(17) +
    avg(rows, r => r.alternations).toFixed(2).padStart(14)
  );
}

console.log('\n══ STYLE SEPARATION (STYLE_SYSTEM_HANDOFF §3) ════════════════════');
console.log('style     same%   longest run (notes)   out-of-scale%   ends on root%');
const styleStats = {};
for (const st of STYLES) {
  const rows = perStyle[st];
  const oos = avg(rows, r => r.riff.notes.filter(x => x.outOfScale).length / r.riff.notes.length * 100);
  const root = avg(rows, r => (r.riff.notes[r.riff.notes.length - 1].semi === 0 ? 100 : 0));
  // §3.1 counts NOTES, not arrows — compare against longestDirNoteRun.
  const dirRun = avg(rows, r => r.a.longestDirNoteRun);
  const same = avg(rows, r => r.a.samePct);
  styleStats[st] = { same, dirRun, oos, root };
  console.log(
    st.padEnd(9) + same.toFixed(1).padStart(5) + dirRun.toFixed(2).padStart(17) +
    oos.toFixed(1).padStart(15) + root.toFixed(0).padStart(15)
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. THE DESIGN ASSERTIONS — these are the claims, made falsifiable
   ═══════════════════════════════════════════════════════════════════════ */

console.log('\n══ DESIGN ASSERTIONS ═════════════════════════════════════════════');

// Shred must produce meaningfully longer directional runs than Groove.
// (§3.1 scores runs of 3+; if Shred can't clear that, the Style can't earn.)
ok(styleStats.Shred.dirRun > styleStats.Groove.dirRun + 0.4,
   `Shred out-runs Groove (${styleStats.Shred.dirRun.toFixed(2)} vs ${styleStats.Groove.dirRun.toFixed(2)})`);
// §3.1's lowest Db tier needs a 3-NOTE run. dirRun is measured in notes.
ok(styleStats.Shred.dirRun >= 3,
   `Shred clears §3.1's 3-note run threshold (${styleStats.Shred.dirRun.toFixed(2)} notes)`);

// Groove must produce meaningfully MORE repetition than Shred — that's the point.
ok(styleStats.Groove.same > styleStats.Shred.same + 5,
   `Groove repeats more than Shred (${styleStats.Groove.same.toFixed(1)}% vs ${styleStats.Shred.same.toFixed(1)}%)`);

// Flair must actually field out-of-scale material for §3.3 to have anything to score.
ok(styleStats.Flair.oos > styleStats.Groove.oos,
   `Flair fields more discord than Groove (${styleStats.Flair.oos.toFixed(1)}% vs ${styleStats.Groove.oos.toFixed(1)}%)`);

// Groove's signature bonus is landing on the root.
ok(styleStats.Groove.root > 95, `Groove resolves to the root (${styleStats.Groove.root.toFixed(0)}%)`);

// THE HEADLINE: repeated notes must arrive CLUSTERED, not scattered.
// Across the whole corpus, most "same" notes should sit inside a run of 2+.
const allRows = Object.values(perGenre).flat();
const clustered = avg(allRows, r => r.sameClustered);
const scattered = avg(allRows, r => Math.max(0, r.sameScattered));
ok(clustered > scattered,
   `same-notes arrive clustered not scattered (${clustered.toFixed(2)} vs ${scattered.toFixed(2)} per riff)`);

console.log(`\nclustered "same" per riff : ${clustered.toFixed(2)}`);
console.log(`scattered "same" per riff : ${scattered.toFixed(2)}`);
console.log(`ratio                     : ${(clustered / Math.max(0.01, scattered)).toFixed(2)}× clustered`);

console.log(`\nnotes generated : ${n}`);
console.log(`assertions      : ${checks}`);
console.log(fails ? `\n❌ ${fails} FAILURES` : `\n✅ all ${checks} assertions passed`);
process.exit(fails ? 1 : 0);
