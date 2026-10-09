// ─── 🎸 NOTE TECHNIQUES CHECK — the Ronin's hammer-on / pull-off ─────────────
// MELODY_IDENTITY_DESIGN.md §13. Preview stage: only the dial-in page calls
// `hammerCandidate` today, and this suite pins the rule it lights the button by.
//
// ⚠️ WHAT THIS SUITE IS REALLY GUARDING:
//   §2 — THE READOUT IS THE COMMIT'S OWN SUM. "+1 fan" on the button must be
//        what `melodyPayoutFor` pays (style + craft), or the button lies.
//   §3 — EVERY LIT NOTE REALLY CONTINUES THE SHAPE, by the payout's own readers,
//        on every root. A hammer that lit for a note no reader calls a
//        continuation would be "smart" in name only.
//   §4 — THE GAP AT A♭. Hirajoshi + P4 has no B: the letter step does not exist
//        but the scale step (C) does. The 10-07 spec guessed "dark"; it lights.
//
// Run: npm run test:notetechniques
let pass = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) pass++;
  else { failures.push(msg); console.log('  ✗', msg); }
}

const { hammerCandidate, fansFor, HAMMER_ON, HAMMER_DARK_WHY } = await import('./noteTechniques.js');
const { melodyPayoutFor, craftRunFor } = await import('./melodyPayout.js');
const { trailingContour } = await import('./spiritStyle.js');
const { playableScale, getSpelledPool } = await import('./notes.js');
const { melodyModeFor } = await import('./melodyIdentity.js');

console.log('🎸 noteTechniquesCheck — the hammer-on lights only when it can be used\n');
const RONIN = 'cosmic_ronin';
const mode = melodyModeFor(RONIN);
const C = playableScale('C', mode);
const hc = (line, charges = 1, scale = C) => hammerCandidate(RONIN, line, scale, { charges });

// §1 — the named cases (Alex's own example first: two notes, the third missing)
console.log('§1 named cases');
ok(C.join(' ') === 'C D Eb F G Ab', `Ronin palette on C is Hirajoshi + P4 (got ${C.join(' ')})`);
const cases = [
  [['C', 'D'],           { note: 'Eb', label: 'hammer', pays: 1 }, 'two notes up a step → E♭ finishes the shred'],
  [['C', 'Eb'],          { note: 'G',  label: 'hammer', pays: 1 }, 'two notes up a skip → G finishes the arpeggio skip'],
  [['G', 'F'],           { note: 'Eb', label: 'pull',   pays: 1 }, 'falling → a PULL-OFF to E♭'],
  [['C', 'D', 'Eb'],     { note: 'F',  label: 'hammer', pays: 1 }, 'a 3-run → F makes the 4-run (+1 craft)'],
  [['C', 'D', 'Eb', 'F'],{ note: 'G',  label: 'hammer', pays: 0 }, 'lit but no new fans (4→5 is still +1)'],
];
for (const [line, want, why] of cases) {
  const r = hc(line);
  ok(r.ok && r.note === want.note && r.label === want.label && r.pays === want.pays,
    `${line.join(' ')}: ${why} (got ${r.ok ? `${r.label} ${r.note} +${r.pays}` : r.reason})`);
}
const dark = [
  [['C', 'D'], 0, 'no-charge'], [['C'], 1, 'too-short'], [[], 1, 'too-short'],
  [['C', 'D', 'B'], 1, 'discord-last'], [['C', 'D', 'Eb', 'F', 'G', 'Ab', 'C', 'D'], 1, 'track-full'],
  [['C', 'B', 'D'], 1, 'no-shape'],
];
for (const [line, ch, why] of dark) {
  const r = hc(line, ch);
  ok(!r.ok && r.reason === why, `${line.join(' ') || '(empty)'} with ${ch} charge(s) is dark: ${why} (got ${r.ok ? r.note : r.reason})`);
  ok(!r.ok && typeof HAMMER_DARK_WHY[r.reason] === 'string', `dark reason ${r.reason} has words for the button`);
}
// both charges on one melody (Alex, 2026-10-08): the hammered note is a base
const first = hc(['C', 'D', 'Eb', 'F'], 2);
const second = hc(['C', 'D', 'Eb', 'F', first.note], 1);
ok(first.ok && second.ok && second.note === 'Ab' && second.pays === 1,
  `two charges: 4-run → G (+0) → A♭ (+1, the 6-run cap) (got ${second.note} +${second.pays})`);
ok(HAMMER_ON.perTurn === 1 && HAMMER_ON.bank === 2, 'one charge a turn, a bank of two (Alex)');

// §2 — the readout is the commit's own sum
console.log('§2 the readout = melodyPayoutFor');
const commitFans = line => { const p = melodyPayoutFor(RONIN, line, C); return p.style.score + p.craftFans; };
for (const line of [['C', 'D'], ['C', 'D', 'Eb', 'F'], ['F', 'G', 'Ab'], ['G', 'F', 'Eb'], ['C', 'Eb', 'G']]) {
  ok(fansFor(RONIN, line, C) === commitFans(line), `fansFor(${line.join(' ')}) = the commit's style + craft`);
  const r = hc(line);
  if (r.ok) ok(r.pays === commitFans([...line, r.note]) - commitFans(line), `${line.join(' ')} → ${r.note}: "+${r.pays}" is what the commit would add`);
}

// §3 — every lit note continues a shape, on every root, by the payout's readers
console.log('§3 sweep — 12 roots × every two- and three-note clean line');
let lit = 0, darkN = 0, bad = 0;
for (const root of getSpelledPool('C', 'major').filter((n, i, a) => a.indexOf(n) === i)) {
  const S = playableScale(root, mode);
  const lines = [];
  for (const a of S) for (const b of S) { lines.push([a, b]); for (const c of S) lines.push([a, b, c]); }
  for (const line of lines) {
    const r = hc(line, 1, S);
    if (!r.ok) { darkN++; continue; }
    lit++;
    for (const cand of r.candidates) {
      const next = [...line, cand.note];
      const contourOk = [1, 2].some(sp => trailingContour(line, sp, S) >= 1 && trailingContour(next, sp, S) === trailingContour(line, sp, S) + 1);
      const craftOk = [2, 3].some(k => k <= line.length && craftRunFor([...line.slice(-k), cand.note], S) === k + 1);
      if (!S.includes(cand.note) || !(contourOk || craftOk)) bad++;
    }
  }
}
ok(bad === 0, `every candidate is in the palette and continues a shape by a payout reader (${bad} bad of ${lit} lit lines)`);
ok(lit > 0 && darkN > 0, `the sweep sees both lit (${lit}) and dark (${darkN}) lines`);

// §4 — the gap at A♭
console.log('§4 the gap at A♭');
const gap = hc(['F', 'G', 'Ab']);
ok(gap.ok && gap.note === 'C' && gap.via.contour === 0 && gap.via.craft === 4,
  `F G A♭ → C by the SCALE step (no B in the palette), the craft run's continuation (got ${gap.ok ? gap.note : gap.reason})`);

// §5 — THE GAME'S HALF (2026-10-08 port): charges, the turn end, the commit
console.log('§5 charges, the turn end, the commit');
const { makeInitialNoteState } = await import('../engine/systems/economy.js');
const { makeInitialState } = await import('../engine/state.js');
const { applyAction } = await import('../engine/reduce.js');
const { turnEnded } = await import('../engine/actions.js');
const { commitMelodyEconomy } = await import('../engine/systems/melodyCommit.js');
const { CORNERS } = await import('../data/corners.js');
const { hasHammerOn, hammerRecharge, isTechniqueSrc, playedNotes } = await import('./noteTechniques.js');
const METAL = 'Metalness_Monster', ZERO = 'intergalactic_0';

ok(hasHammerOn(RONIN) && hasHammerOn(`${RONIN}::blue`), '⭐ the Ronin has the technique, by character (any seat)');
ok(![METAL, ZERO, 'Glamarchy'].some(hasHammerOn), '⭐ no other Spirit does (Alex: "other Spirits aren\'t touched")');
ok(makeInitialNoteState(RONIN, () => 0.5).hammerCharges === 1, 'the Ronin is dealt one charge for his first turn');
ok(!('hammerCharges' in makeInitialNoteState(METAL, () => 0.5)), 'nobody else gets the field at all');
ok(hammerRecharge(RONIN, { hammerCharges: 0 }) === 1 && hammerRecharge(RONIN, { hammerCharges: 1 }) === 2,
  '+1 at his turn end');
ok(hammerRecharge(RONIN, { hammerCharges: 2 }) === null, 'a full bank stays at 2 (and writes nothing)');
ok(hammerRecharge(METAL, { hammerCharges: 0 }) === null, 'another Spirit is never recharged');
ok(isTechniqueSrc('hammer') && isTechniqueSrc('pull') && !isTechniqueSrc(3) && !isTechniqueSrc('bank') && !isTechniqueSrc(-1),
  'only hammer / pull mark a technique seat (hand slots, the bank, the Mixer do not)');

const CONFIG = { mode: 'ffa', startingLives: 3, testMode: true, spirits: [
  { id: RONIN, name: 'Shredding Ronin', corner: 'blue', num: CORNERS.blue.homeNum, vibe: 15, maxVibe: 15, knockedOut: false, facing: 0 },
  { id: METAL, name: 'Metalness Monster', corner: 'yellow', num: CORNERS.yellow.homeNum, vibe: 15, maxVibe: 15, knockedOut: false, facing: 0 },
] };
const s0 = makeInitialState(structuredClone(CONFIG), 4242);
ok(s0.noteStates[RONIN].hammerCharges === 1, 'a new match: the Ronin holds one charge');
// End whichever turn comes first, then the other, and watch only the Ronin move.
let s = s0, roninEnds = 0;
for (let k = 0; k < 4; k += 1) {
  const ended = s.acting;
  const metalBefore = s.noteStates[METAL];
  s = applyAction(s, turnEnded());
  if (ended === RONIN) roninEnds += 1;
  if (ended === METAL) ok(s.noteStates[METAL] === metalBefore || JSON.stringify(s.noteStates[METAL]) === JSON.stringify(metalBefore),
    'the Monster\'s turn end leaves his sheet untouched by the hammer');
}
ok(roninEnds === 2 && s.noteStates[RONIN].hammerCharges === 2, `two Ronin turn ends from 1 → capped at 2 (got ${s.noteStates[RONIN].hammerCharges})`);

// The commit: a hammered note pays and moves, but does not lift a curse.
// v3 (2026-10-09): Iwato on D, haunted ♭2 ♭5 ♭7 (Eb Ab C) — every one must be played to lift it.
const curse = { root: 'D', turnsLeft: 3, key: 'K1', by: 'x', targets: [1, 6, 10], lifted: [] };
const mk = (line, srcs) => ({ spirits: [{ id: 'r', name: 'Rival', speed: 5 }], noteStates: { r: {
  ...makeInitialNoteState(RONIN, () => 0.5), rootNote: 'E', paletteMode: 'lydian',
  melodyLine: line, melodySrcIdx: srcs, iwatoCurse: curse } } });
const allPlayed = commitMelodyEconomy(mk(['Eb', 'Ab', 'C'], [0, 1, 2]), 'r', {});
ok(allPlayed.ok && allPlayed.report.exorcised, 'control: the three haunted notes played from the hand lift the curse');
const oneHammered = commitMelodyEconomy(mk(['Eb', 'Ab', 'C'], [0, 1, 'hammer']), 'r', {});
ok(oneHammered.ok && !oneHammered.report.exorcised && !(oneHammered.patch.iwatoCurse?.lifted ?? []).includes(10),
  '⭐ the same line with C hammered on does NOT lift C (Alex: only notes played count) — the curse stays on');
ok(oneHammered.hexes === 3, `…but the hammered note still counts toward movement (Alex: yes) — ${oneHammered.hexes} hexes`);
ok(playedNotes(['D', 'G', 'C'], [0, 'pull', 2]).join() === 'D,C', 'playedNotes drops technique seats only');
const paid = commitMelodyEconomy({ spirits: [{ id: RONIN, name: 'R', speed: 5 }], noteStates: { [RONIN]: {
  ...makeInitialNoteState(RONIN, () => 0.5), rootNote: 'C', melodyLine: ['C', 'D', 'Eb'], melodySrcIdx: [0, 1, 'hammer'] } } }, RONIN, {});
ok(paid.ok && paid.report.style.hits.includes('scalar_shred'), 'a hammered E♭ completes the shred in the real commit (it pays)');

console.log(`\n${failures.length ? '❌' : '✅'} noteTechniquesCheck: ${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
