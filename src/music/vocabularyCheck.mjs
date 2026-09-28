// 🎸 vocabularyCheck — CHORD_VOCABULARY_DESIGN.md, against the real modules.
// node src/music/vocabularyCheck.mjs
import { VOCABULARIES, FALLBACK_VOCABULARY, vocabularyFor, readStack, nextStep, seatTargets, leanValue, PC_NAMES }
  from './vocabularies.js';
import { powerPool, withElevenDie, keepForSeats, keepBest, throwPool, rollDie } from '../engine/systems/dicePool.js';
import { sonicRig, ampStacks } from '../engine/systems/sonicRig.js';
import { spiritChord } from '../engine/systems/attackParams.js';
import { botSpiritChord } from '../engine/policies/bot.js';
import { unlockClaim, liveUnlockPcs } from './stackSlots.js';
import { ELEVEN_DIE, ELEVEN_FACES, DICE_KEPT_MAX, DICE_ROLLED_MAX } from '../data/gameConstants.js';
import { applyAttackRolled, applyAttackRerolled } from '../engine/systems/combat.js';
import { attackRolled } from '../engine/actions.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) pass++; else { fail++; console.log('  ❌ ' + name); } };
const section = t => console.log(t);
const notes = (root, ivals) => ivals.map(i => PC_NAMES[(root + i) % 12]);
const SPIRITS = [...Object.keys(VOCABULARIES), 'Glamarchy'];

section('§1 ten distinct spellings per Spirit, each branch climbs one note at a time');
for (const id of SPIRITS) {
  const { rungs } = vocabularyFor(id);
  ok(`${id}: ten rungs`, rungs.length === 10);
  ok(`${id}: ten distinct spellings`, new Set(rungs.map(r => [...r.ivals].sort((a, b) => a - b).join())).size === 10);
  for (const b of ['drive', 'sustain']) {
    const chain = rungs.filter(r => r.branch === 'trunk' || r.branch === b).sort((x, y) => x.size - y.size);
    chain.forEach((r, i) => {
      ok(`${id} ${b} ${r.label}: holds the root`, r.ivals.includes(0));
      if (i) ok(`${id} ${b} ${r.label}: previous rung + exactly one note`,
        r.size === chain[i - 1].size + 1 && chain[i - 1].ivals.every(x => r.ivals.includes(x)));
    });
  }
}
ok('an unknown seat reads the fallback', vocabularyFor('Glamarchy').id === 'fallback' && vocabularyFor('riff_rat::red').id === 'riff_rat');

section('§2 the dial: note count floor, 4/6/8/10 on the matching branch, from every root');
for (const id of SPIRITS) for (const root of [0, 4, 9]) {
  for (const r of vocabularyFor(id).rungs) {
    const ch = readStack(id, notes(root, r.ivals));
    const own = r.branch === 'sustain' ? ch.sustain : ch.drive, other = r.branch === 'sustain' ? ch.drive : ch.sustain;
    if (r.branch !== 'trunk') {
      ok(`${id} ${r.label}@${root}: reads ${leanValue(r.size)} in its own stack`, own === leanValue(r.size));
      ok(`${id} ${r.label}@${root}: never reads higher in the other stack than its notes`, other === r.size);
    } else ok(`${id} ${r.label}: trunk reads its notes`, ch.drive === r.size && ch.sustain === r.size);
    ok(`${id} ${r.label}@${root}: names itself`, ch.label === r.label && ch.root === PC_NAMES[root]);
  }
}
ok('empty stack reads 0/0', readStack('cosmic_ronin', []).drive === 0 && readStack('cosmic_ronin', []).sustain === 0);
{
  const ch = readStack('Metalness_Monster', ['E', 'F', 'B', 'C']); // 5♭9 + a stray C
  ok('extra notes never subtract, and the floor is the note count', ch.drive === 4 && ch.sustain === 4 && ch.label === '5♭9 +1');
}
{
  // ⚠️ root-anchored: the Ronin's Hirajoshi on C CONTAINS In-sen on G. Read from C it is Hirajoshi, full stop.
  const ch = readStack('cosmic_ronin', ['C', 'D', 'D#', 'G', 'G#']);
  ok('root-anchored: Hirajoshi on C does not read as In-sen on G', ch.label === 'Hirajoshi' && ch.drive === 5 && ch.sustain === 8);
}
ok('all three chord readers are one reader', JSON.stringify(spiritChord('riff_rat', ['C', 'E', 'G', 'A#'])) === JSON.stringify(botSpiritChord('riff_rat', ['C', 'E', 'G', 'A#'])));
ok('🪦 Intergalactic 0 innate gone: Minor 13 reads 10, not 11', readStack('intergalactic_0', notes(0, [0, 2, 3, 7, 9, 10])).sustain === 10);

section('§3 the next note glows: one per branch on a clean stack');
for (const id of SPIRITS) for (const b of ['drive', 'sustain']) {
  const chain = vocabularyFor(id).rungs.filter(r => r.branch === 'trunk' || r.branch === b).sort((x, y) => x.size - y.size);
  chain.forEach((r, i) => {
    const step = nextStep(id, notes(2, r.ivals), b);
    if (i === chain.length - 1) ok(`${id} ${b}: nothing past the top`, step === null);
    else ok(`${id} ${b} ${r.label} → ${chain[i + 1].label}: one missing note`,
      step?.rung.label === chain[i + 1].label && step.missing.length === 1);
  });
}

section('§4 seats: targets are the Spirit\'s own next spelling, and loose notes open nothing');
{
  const ns = { driveStack: ['E', 'F', 'B'], sustainStack: ['E'], driveSlots: 0, sustainSlots: 0, casuals: 4 };  // 🎤 6 fans — crowd row 1
  const t = seatTargets('Metalness_Monster', ns.driveStack, 4);
  ok('Metalness 5♭9 on E hunts G♯ (Major ♭9) — and not the jazz ladder\'s 7th (D)', t.has(8) && !t.has(2) && t.size === 1);
  ok('unlockClaim uses the Spirit', unlockClaim(ns, 'G#', 'Metalness_Monster')?.slot === 4);
  ok('…and another Spirit on the same notes hunts something else', unlockClaim(ns, 'G#', 'riff_rat') === null);
  ok('liveUnlockPcs reads each seat as its own Spirit', liveUnlockPcs({ Metalness_Monster: ns }).has(8));
  ok('a full stack of loose notes has no seat target', seatTargets('riff_rat', ['C', 'C#', 'F#'], 4).size === 0);
}

section('§5 dice: power → dice → keep');
ok('power 4 → 4d6', JSON.stringify(powerPool(4)) === '[6,6,6,6]');
ok('power 8 → 8d6', powerPool(8).length === 8 && powerPool(8).every(s => s === 6));
ok('power 10 (six-note chord) → 8 dice, two d8s', JSON.stringify(powerPool(10)) === '[8,8,6,6,6,6,6,6]');
ok('power 12 (… + Moshpit) → 8 dice, four d8s', powerPool(12).filter(s => s === 8).length === 4 && powerPool(12).length === DICE_ROLLED_MAX);
ok('charge ceiling grows every die', powerPool(10, { ceil: true }).join() === '10,10,8,8,8,8,8,8');
ok('keep = seats, capped at 5', [3, 4, 5, 6].map(keepForSeats).join() === `3,4,5,${DICE_KEPT_MAX}`);
{
  const k = keepBest([2, 6, 1, 5, 6], [6, 6, 6, 6, 6], 3);
  ok('keepBest keeps the highest, ties to the earlier throw, in throw order', k.vals.join() === '6,5,6' && k.droppedVals.join() === '2,1');
  const e = keepBest([6, 6, 6, 1], [6, 6, 6, ELEVEN_DIE], 3);
  ok('🔊 the Eleven die is ALWAYS kept', e.pool.includes(ELEVEN_DIE) && e.vals.length === 3 && e.fizzled);
  ok('🔊 …and its 1 fizzles the whole throw', e.fizzled && e.vals.join() === '6,6,1');
  ok('🔊 swapped in for the weakest die', withElevenDie([8, 6, 6]).join() === `8,${ELEVEN_DIE},6`);
}
{
  let seq = [0, 5, 5]; const rng = { int: () => seq.shift() };
  ok('🔊 Eleven die: faces 0–4 read 11, face 5 reads 1, ONE rng per die',
    rollDie(ELEVEN_DIE, rng) === 11 && rollDie(ELEVEN_DIE, rng) === 1 && rollDie(6, rng, 2) === 6 && seq.length === 0);
  // 🔊 The d6 odds, read off every face rather than a seed (§B4: one seed passes on luck).
  const faces = []; let asked = 0;
  for (let f = 0; f < ELEVEN_FACES; f++) faces.push(rollDie(ELEVEN_DIE, { int: s => { asked = s; return f; } }));
  ok('🔊 the Eleven die is a d6: five 11s and one 1 (fizzle 1 in 6)',
    ELEVEN_FACES === 6 && asked === 6 && faces.filter(v => v === 11).length === 5 && faces.filter(v => v === 1).length === 1);
  let n = 0; const count = { int: s => { n++; return s - 1; } };
  throwPool([6, 6, 8, ELEVEN_DIE], 2, count);
  ok('one rng.int per die thrown (determinism contract)', n === 4);
}
{
  const ns = { driveStack: notes(0, [0, 1, 4, 7, 8, 10]), driveSlots: 3 };
  const rig = sonicRig(ns, 0, 0, true, 'Metalness_Monster');
  ok('sonicRig: six-note Drive chord → 8 dice (2 d8), keep 5', rig.pool.length === 8 && rig.pool.filter(s => s === 8).length === 2 && rig.keep === 5 && rig.power === 10);
  const low = sonicRig({ driveStack: ['C', 'F', 'G'] }, 0, 0, true, 'intergalactic_0');
  ok('sonicRig: Sus4 on 3 seats → 4 dice, keep 3', low.pool.length === 4 && low.keep === 3);
  const eleven = sonicRig({ ...ns, atEleven: true }, 0, 0, true, 'Metalness_Monster');
  ok('sonicRig at eleven: one die becomes the Eleven die', eleven.pool.filter(s => s === ELEVEN_DIE).length === 1 && eleven.pool.length === 8);
  ok('sonicRig: an empty Drive stack throws nothing', sonicRig({ driveStack: [] }, 0, 0, true, 'x').pool.length === 0);
}

section('§6 the amps show the seats');
{
  const a = ampStacks({ driveSlots: 1, sustainSlots: 3 });
  ok('4 Drive seats → 2 cabinets; 6 Sustain seats → 3 cabinets and a glow', a.drive.levels === 2 && !a.drive.glow && a.sustain.levels === 3 && a.sustain.glow);
  const b = ampStacks({});
  ok('3 seats → 1 cabinet, no glow', b.drive.levels === 1 && b.sustain.levels === 1 && !b.drive.glow);
}
section('§7 the reducers: only the kept dice count, the dropped ones ride along');
{
  const seqRng = vals => { const q = [...vals]; return { int: () => (q.length ? q.shift() : 0) }; };
  const spirits = [{ id: 'a', num: 26, corner: 'blue' }, { id: 'd', num: 27, corner: 'red' }];
  const five = notes(0, [0, 1, 4, 7, 10]);
  const noteStates = {
    a: { driveStack: five, driveSlots: 0 },                     // 3 seats → keep 3
    d: { driveStack: ['C'], sustainStack: ['C', 'D#', 'G'], sustainSlots: 1 },
  };
  // Swing: attacker 8d6 keep 3, defender 1d6 keep 3.
  const st = { spirits, noteStates, battle: null };
  // faces (rng.int + 1): attacker 1,2,6,3,6,4 → keep 6,6,4 ; defender 5
  const sw = applyAttackRolled(st, { ...attackRolled('swing', 'a', 'd', {}), swingVersion: 2 },
    seqRng([0, 1, 5, 2, 5, 3, 4])).battle;
  // 'a' is no Spirit, so the FALLBACK reads C C♯ E G B♭ as a Dominant 7 (+1): dial 6.
  ok('swing: every die the power buys is thrown', sw.rolledPool.length === 6);
  ok('swing: only the seats\' worth count (keep 3)', sw.diceVals.length === 3 && sw.droppedDiceVals.length === 3);
  ok('swing: the total is the kept dice', sw.atkTotal === sw.diceVals.reduce((x, y) => x + y, 0));
  ok('swing: kept are the highest faces', Math.min(...sw.diceVals) >= Math.max(...sw.droppedDiceVals));
  const rr = applyAttackRerolled({ ...st, battle: sw }, {}, seqRng([5, 5, 5, 5, 5, 5])).battle;
  ok('swing reroll re-throws the WHOLE pool and keeps again', rr.diceVals.join() === '6,6,6' && rr.droppedDiceVals.length === 3 && rr.defenderDiceVals.join() === sw.defenderDiceVals.join());
  // Sonic: explicit pools from attackParams.
  const so = applyAttackRolled(st, attackRolled('sonic', 'a', 'd', { atkStat: 4, defStat: 4, dicePool: [6, 6, 6, 6], atkKeep: 2,
    sustainPool: [6, 6, 6, 6], defKeep: 3 }), seqRng([0, 5, 4, 1, 0, 1, 2, 3])).battle;
  ok('sonic: 4 thrown, the best 2 fire', so.diceVals.join() === '6,5' && so.droppedDiceVals.join() === '1,2');
  ok('sonic: the shield is the best 3 Sustain dice', so.sustainRolls.join() === '2,3,4' && so.shieldValue === 9 && so.sustainDropped.join() === '1');
  ok('sonic: one beam per KEPT die', so.shots.length === 2 && so.diceHits.length === 2);
  const fz = applyAttackRolled(st, attackRolled('sonic', 'a', 'd', { atkStat: 3, defStat: 1, dicePool: [6, 6, ELEVEN_DIE], atkKeep: 2,
    sustainPool: [6], defKeep: 1 }), seqRng([5, 5, 11, 0])).battle;
  ok('🔊 a fizzled Eleven fires nothing, whatever else he threw', fz.elevenFizzled && fz.hitCount === 0 && fz.diceVals.includes(1));
  const old = applyAttackRolled(st, attackRolled('sonic', 'a', 'd', { atkStat: 2, defStat: 2, dicePool: [6, 6] }), seqRng([1, 2, 3, 4])).battle;
  ok('an old caller with no keep counts every die, as before', old.diceVals.length === 2 && old.sustainRolls.length === 2);
}
void FALLBACK_VOCABULARY;
console.log(fail ? `\n❌ vocabularyCheck: ${fail} failed, ${pass} passed` : `\n✅ vocabularyCheck: ${pass} assertions passed`);
process.exit(fail ? 1 : 0);
