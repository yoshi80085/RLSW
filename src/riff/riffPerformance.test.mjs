// =============================================================================
// riff/riffPerformance.test.mjs — the chart the engine hands the highway
// -----------------------------------------------------------------------------
//   node src/riff/riffPerformance.test.mjs
//
// Written after a real miss: the riff-off shipped with the arrow highway
// rendering every gem as a flat "same" bar, because `dir` was never set on the
// notes the engine handed over — and with the sustain and bend judges wired but
// unreachable, because nothing generated sustains or bends at all. The code
// looked right on both sides of a seam that carried nothing across it.
//
// So these assertions are about the SEAM, not the algorithm: whatever the
// engine emits must actually contain the fields the highway draws from.
// =============================================================================

import { applyPerformance, applyChords, directionsFor,
         BEND_WEIGHTS, BEND_MIN_SUSTAIN, SHOWPIECE_MIN_SUSTAIN } from './riffPerformance.js';
import { generateAttackerRiff, generateRiffRhythm } from './riffGeneration.js';
import { voiceRiff, degreePitch, STRING_OPENS, MAX_FRET } from './guitarMap.js';

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { if (fails < 12) console.log('  ❌ ' + m); fails++; } };

function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Exactly what engine/systems/riffOff.js → performanceFor does. */
function chartFor(riff, rng) {
  const voicing = voiceRiff(riff.degrees, riff.sharps, riff.rhythm);
  const notes = riff.degrees.map((d, i) => {
    const [string, fret] = voicing?.positions?.[i] ?? [0, 0];
    return { pitch: degreePitch(d, riff.sharps?.[i]), string, fret,
             accent: (riff.rhythm?.[i]?.feel ?? 'steady') !== 'rushed' };
  });
  return applyPerformance(notes, rng);
}

// ── 1. contour ──────────────────────────────────────────────────────────────
ok(JSON.stringify(directionsFor([5, 7, 7, 3])) === JSON.stringify(['same','up','same','down']),
   'directionsFor reads rise / repeat / fall');
ok(directionsFor([9])[0] === 'same', 'a lone note is the anchor');
ok(directionsFor([]).length === 0, 'empty riff is handled');

// ── 2. the corpus ───────────────────────────────────────────────────────────
let n = 0, dirs = { up: 0, down: 0, same: 0 }, noSus = 0, lastDead = 0,
    susMidChug = 0, bendNoSus = 0, bendNoRoom = 0, bendEdge = 0, badAmt = 0,
    showShort = 0, showDown = 0, riffs = 0, withShow = 0, flatCharts = 0;

for (let i = 0; i < 2000; i++) {
  const rng  = makeRng(i * 7919 + 13);
  const riff = generateAttackerRiff(rng, 6 + (i % 12));
  riff.rhythm = riff.rhythm ?? generateRiffRhythm(rng, riff.degrees.length);
  const chart = chartFor(riff, rng);
  riffs++;

  // THE SEAM: every note must carry what the highway reads.
  for (const x of chart) {
    n++;
    ok(['up','down','same'].includes(x.dir), `dir present and valid (got ${x.dir})`);
    ok(typeof x.sustain === 'number', 'sustain present');
    ok(typeof x.bend === 'boolean', 'bend present');
    dirs[x.dir]++;
  }
  // A chart where EVERY arrow is "same" is the exact bug that shipped — a riff
  // with real melodic motion must never flatten to a wall of bars.
  const moved = chart.filter(x => x.dir !== 'same').length;
  const pitches = new Set(chart.map(x => x.pitch));
  if (pitches.size > 1 && moved === 0) flatCharts++;

  const sus = chart.filter(x => x.sustain > 0);
  if (!sus.length) noSus++;
  if (!chart[chart.length - 1].sustain) lastDead++;

  for (let k = 0; k < chart.length; k++) {
    const x = chart[k];
    if (x.sustain && chart[k + 1]?.chugPart) susMidChug++;
    if (!x.bend) continue;
    if (!x.sustain) bendNoSus++;
    if (x.sustain < BEND_MIN_SUSTAIN) bendNoRoom++;
    if (x.bendAt < x.sustain * 0.28 || x.bendAt > x.sustain * 0.62) bendEdge++;
    if (x.bendAmt !== BEND_WEIGHTS[x.bendWeight].semis) badAmt++;
    if (x.bendWeight === 'showpiece') {
      if (x.sustain < SHOWPIECE_MIN_SUSTAIN) showShort++;
      if (x.bendDir !== 'up') showDown++;
    }
  }
  if (chart.some(x => x.bendWeight === 'showpiece')) withShow++;

  // Determinism — same seed, same chart, or a networked riff-off desyncs.
  // Replay the WHOLE pipeline from a fresh seed: riff generation draws from the
  // same rng stream before the chart does, so seeding only the chart call would
  // start it at a different position and prove nothing.
  const twin = (() => {
    const r = makeRng(i * 7919 + 13);
    const rf = generateAttackerRiff(r, 6 + (i % 12));
    rf.rhythm = rf.rhythm ?? generateRiffRhythm(r, rf.degrees.length);
    return chartFor(rf, r);
  })();
  ok(JSON.stringify(twin.map(x => [x.dir, x.sustain, x.bend, x.bendAt])) ===
     JSON.stringify(chart.map(x => [x.dir, x.sustain, x.bend, x.bendAt])),
     'chart is deterministic for a given seed');
}

ok(flatCharts === 0, `no riff with real motion charts as all-"same" (${flatCharts} flat)`);
ok(noSus === 0, `every riff has at least one sustain (${noSus} without)`);
ok(lastDead === 0, `every riff rings out on its last note (${lastDead} dead ends)`);
ok(susMidChug === 0, `no sustain mid chug run (${susMidChug})`);
ok(bendNoSus === 0, `every bend rides a sustain (${bendNoSus})`);
ok(bendNoRoom === 0, `every bend has room for the gesture (${bendNoRoom})`);
ok(bendEdge === 0, `bend marker sits mid-tail (${bendEdge})`);
ok(badAmt === 0, `bend depth matches its weight class (${badAmt})`);
ok(showShort === 0, `showpieces only on tails long enough to sing (${showShort})`);
ok(showDown === 0, `showpieces always bend up (${showDown})`);
ok(withShow / riffs < 0.45, `showpieces stay rare (${(withShow/riffs*100).toFixed(1)}% of riffs)`);

// ── 3. chords ───────────────────────────────────────────────────────────────
let pairs = 0, nonAdj = 0, notFifth = 0, badTime = 0, offNeck = 0;
for (let i = 0; i < 800; i++) {
  const rng  = makeRng(i * 104729 + 7);
  const riff = generateAttackerRiff(rng, 11);
  riff.rhythm = riff.rhythm ?? generateRiffRhythm(rng, 11);
  const chart = chartFor(riff, rng);
  const times = chart.map((_, k) => 1600 + k * 400);
  applyChords(chart, times, rng);
  for (let k = 0; k < chart.length; k++) {
    const x = chart[k];
    if (!x.hasPartner) continue;
    pairs++;
    const p = chart[k + 1];
    if (!p || p.partnerOf !== k) { nonAdj++; continue; }
    if (Math.abs(p.string - x.string) !== 1) nonAdj++;
    if (p.pitch - x.pitch !== 7) notFifth++;
    if (times[k + 1] !== times[k]) badTime++;
    if (p.fret < 0 || p.fret > MAX_FRET || STRING_OPENS[p.string] + p.fret !== p.pitch) offNeck++;
  }
}
ok(nonAdj === 0, `chord partners on adjacent strings (${nonAdj})`);
ok(notFifth === 0, `chord partner is a fifth above (${notFifth})`);
ok(badTime === 0, `chord partners share a hit time (${badTime})`);
ok(offNeck === 0, `chord partners land on a real cell (${offNeck})`);

console.log(`\narrow mix   ↑${dirs.up} ↓${dirs.down} →${dirs.same}` +
            `  (same ${(dirs.same / n * 100).toFixed(1)}%)`);
console.log(`showpieces  ${(withShow / riffs * 100).toFixed(1)}% of riffs`);
console.log(`chords      ${pairs} partners over 800 riffs`);
console.log(`notes ${n}   assertions ${checks}`);
console.log(fails ? `\n❌ ${fails} FAILURES` : `\n✅ all ${checks} assertions passed`);
process.exit(fails ? 1 : 0);
