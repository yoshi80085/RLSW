// ─── 🎸 CURSED SHAMISEN CHECK — THE IWATO CURSE, v3 "THE TRAP" ──────────────
// `npm run test:shamisen`. Pins the RULES of the v3 curse (`engine/systems/
// iwatoCurse.js`, `src/IWATO_CURSE_V3_SPEC.md`, Alex 2026-10-09) and the places
// it has to reach to be true: the turn start (the wasted trap, the cursed draw
// seeping in ⅓ → ⅔), the drift (the pinned note), the pickup (the spring — headless
// path included), the melody commit (the lifts) and the client's wiring.
// The look and the scale helpers are `test:cursedshamisen`.
//
// 🪦 v1 (take up → tune strings → cast → exorcise) and the glow-and-debt
// Shamisen before it are gone — §13 asserts they STAY gone.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as cooldowns from './systems/cooldowns.js';
import * as constants from '../data/gameConstants.js';
import * as curseApi from './systems/iwatoCurse.js';
import { ABILITY_CD } from './systems/cooldowns.js';
import { CURSED_SHAMISEN_CD } from '../data/gameConstants.js';
import { SKILL_BY_ID } from '../data/skillTree.js';
import {
  SHAMISEN_SKILL, CURSE_TURNS, HAUNTED_NOTES, cursedDrawShare,
  hasShamisen, trapOf, layCheck, layPatch, trapAt, armedTrapHexes, springOutcome, orphanedTraps, cursesStandingBy,
  isCursed, curseRoot, cursedPalette, livePalette, hauntedNotes, liftOutcome, endCursedTurn, curseScene, ashPatch,
} from './systems/iwatoCurse.js';
import { CREEPY_IVS, pickHaunted, hauntRand } from '../board/cursedShamisen.js';
import { startTurnNotes } from './systems/turnFlow.js';
import { commitMelodyEconomy } from './systems/melodyCommit.js';
import { applyTokensDrifted } from './systems/board.js';
import { collectPickups } from './policies/transition.js';
import { makeInitialState } from './state.js';
import { makeRng } from './rng.js';
import { CORNERS } from '../data/corners.js';
import { playableScale, paletteScaleFor, pitchIndex } from '../music/notes.js';
import { makeInitialNoteState } from './systems/economy.js';
const initNoteState = () => makeInitialNoteState('cosmic_ronin', () => 0.5);

let count = 0;
const ok = (c, m) => { count++; assert.ok(c, m); };
const eq = (a, b, m) => { count++; assert.deepStrictEqual(a, b, m); };
const section = t => console.log(`\n${t}`);
const pc = n => ((pitchIndex(n) % 12) + 12) % 12;

const RONIN = 'cosmic_ronin';
const ronin = (over = {}) => ({ rootNote: 'D', unlockedSkills: [SHAMISEN_SKILL], abilityCd: {},
  noteStock: ['D', 'Eb', 'E', 'G', 'Ab', 'A', 'C', 'F'], usedStockIdx: [], ...over });
const TOK = { num: 17, note: 'F' };   // the Lost Chord he curses

// ═══ 1. the numbers ══════════════════════════════════════════════════════════
section('§1 the numbers');
eq(CURSE_TURNS, 3, 'three of the Rival\'s turns, the springing one counting — two cursed melodies (Alex: "2 rounds to deal with the curse in the melody is good")');
eq(HAUNTED_NOTES, 3, 'three haunted notes');
eq([cursedDrawShare(3), cursedDrawShare(2), cursedDrawShare(1)], [0, 1 / 3, 2 / 3], 'the draw seeps in: none on the springing turn, ⅓ on their 2nd, ⅔ on their 3rd');
ok(!('turnStartCurse' in curseApi) && !('REFRESH_AT_TURNS_LEFT' in curseApi), '🪦 the refresh is gone (Alex, 2026-10-09: the seeping draw replaces it)');
eq(CREEPY_IVS, [1, 5, 6, 10], 'the creepy degrees: ♭2 4 ♭5 ♭7 — never the root');
eq(ABILITY_CD[SHAMISEN_SKILL], CURSED_SHAMISEN_CD, 'the quoted cooldown is the real one');

// ═══ 2. laying the trap ══════════════════════════════════════════════════════
section('§2 laying the trap — the Action Token, the cooldown, one at a time');
ok(hasShamisen(ronin()) && !hasShamisen({ unlockedSkills: ['psycho_bushido'] }), 'only the Ronin who brought it owns it');
ok(layCheck({ ns: ronin(), roninId: RONIN }).ok, 'off cooldown, token unspent, nothing out → he may arm it');
ok(layCheck({ ns: ronin(), roninId: RONIN, token: TOK }).ok, '…and lay it on any Lost Chord — there is no range');
eq(layCheck({ ns: { unlockedSkills: [] }, roninId: RONIN }).ok, false, 'not without it in the kit');
eq(layCheck({ ns: ronin(), roninId: RONIN, tokenUsed: true }).ok, false, '⭐ the price is the Action Token');
eq(layCheck({ ns: ronin({ abilityCd: { [SHAMISEN_SKILL]: 1 } }), roninId: RONIN }).ok, false, 'not while it recharges');
eq(layCheck({ ns: ronin(), roninId: RONIN, token: null }).ok, false, 'it needs a Lost Chord');
const laid = { ...ronin(), ...layPatch(ronin(), TOK, 'R#4') };
eq(trapOf(laid), { hexNum: 17, note: 'F', key: 'R#4' }, 'the trap is written on HIS sheet: hex, note, key');
ok(laid.abilityCd[SHAMISEN_SKILL] > 0, '⭐ the cooldown starts when it is LAID (wasted or not)');
eq(layCheck({ ns: laid, roninId: RONIN }).ok, false, '⭐ one at a time: not while a trap is armed');
const haunted = { [RONIN]: ronin(), r: { iwatoCurse: { by: RONIN, turnsLeft: 2, targets: [1, 5, 6], lifted: [] } } };
eq(cursesStandingBy(haunted, RONIN), ['r'], 'cursesStandingBy finds the rival he haunts');
eq(layCheck({ ns: ronin(), roninId: RONIN, noteStates: haunted }).ok, false, '⭐ …and no new trap while his curse still stands');
eq(layCheck({ ns: ronin(), roninId: 'other_ronin', noteStates: haunted }).ok, true, '…another Ronin\'s curse does not block him');
eq(trapAt({ [RONIN]: laid }, 17)?.roninId, RONIN, 'trapAt finds it by hex');
eq(trapAt({ [RONIN]: laid }, 18), null, '…and nothing on any other hex');
eq([...armedTrapHexes({ [RONIN]: laid, x: {} })], [17], 'armedTrapHexes — what the drift pins');

// ═══ 3. one turn: wasted at his next turn start ═════════════════════════════
section('§3 the trap lasts until the start of his next turn');
{
  const st = startTurnNotes({ ...initNoteState(), ...laid }, { spiritId: RONIN });
  eq(st.patch.shamisenTrap, null, '⭐ his next turn start clears it — WASTED');
  eq(st.report.trapWasted, trapOf(laid), '…and the report names it');
  eq(st.patch.shamisenAsh, { key: 'R#4~wasted', trapKey: 'R#4', hexNum: 17, note: 'F', how: 'wasted' },
    '⭐ rule 18: the waste leaves a PUBLIC record — the noroi card burns for everyone');
  ok(!('shamisenAsh' in startTurnNotes({ ...initNoteState(), ...ronin() }, { spiritId: RONIN }).patch), 'no trap, no ash');
  const other = startTurnNotes({ ...initNoteState(), rootNote: 'E' }, { spiritId: 'r' });
  ok(!('shamisenTrap' in other.patch), 'a Rival\'s turn start never touches a trap');
  eq(startTurnNotes({ ...initNoteState(), shamisen: { strings: ['D'], ready: false } }, { spiritId: RONIN }).patch.shamisen, null,
    '🪦 an old v1 instrument on a saved sheet is cleared');
}

// ═══ 4. the cursed note holds its hex ═══════════════════════════════════════
section('§4 the cursed Lost Chord does not drift');
{
  const st = { board: { boardTokens: [{ num: 17, note: 'F', turnsOnBoard: 9 }, { num: 30, note: 'C', turnsOnBoard: 9 }] },
    noteStates: { [RONIN]: laid } };
  const out = applyTokensDrifted(st, { occupied: [] }, () => 0.37);
  const f = out.board.boardTokens.find(t => t.note === 'F');
  const c = out.board.boardTokens.find(t => t.note === 'C');
  eq(f, { num: 17, note: 'F', turnsOnBoard: 9 }, '⭐ the trapped note holds its hex AND its age (Alex: "does not simply vanish and change locations")');
  ok(c.num !== 30, '…while an ordinary stale note still drifts');
  const free = applyTokensDrifted({ ...st, noteStates: { [RONIN]: ronin() } }, { occupied: [] }, () => 0.37);
  ok(free.board.boardTokens.find(t => t.note === 'F').num !== 17, 'once the trap is gone it is an ordinary note again and drifts');
}

// ═══ 5. the spring ══════════════════════════════════════════════════════════
section('§5 the spring — the Rival who takes it is cursed');
{
  const sheets = { [RONIN]: laid, r: { rootNote: 'E' } };
  eq(springOutcome({ noteStates: sheets, pickerId: 'r', hexNum: 18 }), null, 'no trap on that hex: nothing');
  const own = springOutcome({ noteStates: sheets, pickerId: RONIN, hexNum: 17 });
  const ash = how => ({ shamisenTrap: null, shamisenAsh: { key: `R#4~${how}`, trapKey: 'R#4', hexNum: 17, note: 'F', how } });
  eq([own.kind, own.patches], ['disarmed', { [RONIN]: ash('disarmed') }], '⭐ his own pickup: the trap is gone, no curse — and its card burns in public (rule 18)');
  const sp = springOutcome({ noteStates: sheets, pickerId: 'r', hexNum: 17, turnKey: 9 });
  eq(sp.kind, 'sprung', 'a Rival\'s pickup springs it');
  eq(sp.patches[RONIN], { shamisenTrap: null }, 'the trap is spent');
  const c = sp.patches.r.iwatoCurse;
  eq([c.by, c.root, c.fromHex, c.turnsLeft, c.lifted, 'refreshed' in c], [RONIN, 'F', 17, CURSE_TURNS, [], false],
    '⭐ Iwato on the TRAPPED NOTE (Alex: "the note that is cursed - not Ronin\'s key"), from that hex, 3 turns');
  eq(c.targets.length, 3, 'three haunted notes');
  eq(new Set(c.targets).size, 3, '…all different');
  ok(c.targets.every(iv => CREEPY_IVS.includes(iv)), '⭐ all three creepy (Alex: "all 3 notes come from creepy notes") — the root never');
  eq(springOutcome({ noteStates: sheets, pickerId: 'r', hexNum: 17, turnKey: 9 }), sp, 'deterministic: every client draws the same notes from the same key');
  const fz = springOutcome({ noteStates: { ...sheets, r: { iwatoCurse: { turnsLeft: 1, by: 'x' } } }, pickerId: 'r', hexNum: 17 });
  eq([fz.kind, fz.patches], ['fizzled', { [RONIN]: ash('fizzled') }], 'one curse at a time on a Rival: a second fizzles (and burns)');
  const tally = { 1: 0, 5: 0, 6: 0, 10: 0 };
  for (let i = 0; i < 2000; i++) for (const iv of pickHaunted(hauntRand(`k${i}`), 3)) tally[iv]++;
  const lo = Math.max(tally[5], tally[10]);
  ok(Math.min(tally[1], tally[6]) > 1.3 * lo,
    `⭐ ♭2 and ♭5 are drawn more than 4 and ♭7 (${JSON.stringify(tally)})`);
  ok(!pickHaunted(hauntRand('q'), 3, { exclude: [6] }).includes(6), 'exclude is honoured');
}

// ═══ 6. the cursed palette ══════════════════════════════════════════════════
section('§6 the cursed palette — Iwato on the trapped note, spelled their way');
const rival = { rootNote: 'E', paletteMode: 'lydian', unlockedSkills: [] };
const curse = { key: 'K1', by: RONIN, root: 'D', fromHex: 17, targets: [1, 6, 10], lifted: [], turnsLeft: 3 };
const cursed = { ...rival, iwatoCurse: curse };
ok(isCursed(cursed) && !isCursed(rival), 'isCursed reads the sheet');
eq(livePalette('x', rival), playableScale('E', 'lydian'), 'uncursed, the live palette is exactly the Spirit\'s own');
eq(livePalette('x', rival), paletteScaleFor('x', rival), '…the same reading as notes.js');
eq(cursedPalette('x', cursed).map(pc), [2, 3, 7, 8, 0], 'cursed: Iwato on the curse\'s root (D)');
eq(livePalette('x', cursed), cursedPalette('x', cursed), 'livePalette swaps to it');
const sharp = { rootNote: 'B', paletteMode: 'lydian', iwatoCurse: { ...curse } };
ok(cursedPalette('x', sharp).includes('D#') && !cursedPalette('x', sharp).includes('Eb'), '⚠️ spelled through the RIVAL\'s pool (D#), as their hand is');
eq(curseRoot({ roninRoot: 'G' }), 'G', 'an old v1 curse (roninRoot) still reads');
eq(hauntedNotes('x', cursed).map(h => [h.iv, pc(h.note), h.degree, h.lifted]), [[1, 3, '♭2', false], [6, 8, '♭5', false], [10, 0, '♭7', false]],
  'hauntedNotes: interval, note, degree, lifted');

// ═══ 7. the lifts ═══════════════════════════════════════════════════════════
section('§7 the lifts — each haunted note played lifts one ghost; they accumulate');
{
  eq(liftOutcome(rival, ['Eb']).patch, null, 'nothing to lift on an uncursed sheet');
  eq(liftOutcome(cursed, ['D', 'G']).patch, null, 'Iwato but not haunted (the root, the 4th here): no lift');
  const a = liftOutcome(cursed, ['Eb', 'G']);
  eq([a.newly, a.done, a.patch.iwatoCurse.lifted], [[1], false, [1]], 'one haunted note: one ghost lifts');
  const b = liftOutcome({ ...cursed, ...a.patch }, ['D#', 'Ab', 'C']);
  eq([b.newly, b.done], [[6, 10], true], '⭐ progress carries; two in one melody lift together; spelling does not matter (D# = Eb, already lifted)');
  eq(b.patch, { iwatoCurse: null, curseEnded: { key: 'K1', how: 'exorcised', lifted: 3 } }, '⭐ all three: the paper lifts, and it says how');
}
section('§7b the melody commit scores the cursed palette and lifts');
{
  const mk = (line, c) => ({ spirits: [{ id: 'r', name: 'Rival' }],
    noteStates: { r: { ...initNoteState(), rootNote: 'E', paletteMode: 'lydian', melodyLine: line, iwatoCurse: c ?? null } } });
  const clean = r => r.report?.cleanNoteCount;
  const own = ['E', 'F#', 'B', 'C#'];
  eq(clean(commitMelodyEconomy(mk(own), 'r', {})), 4, 'uncursed, their own notes are clean');
  const hexed = commitMelodyEconomy(mk(own, curse), 'r', {});
  eq(clean(hexed), 0, '⭐ cursed, the same notes are ALL discord — no fans');
  ok(!hexed.report.exorcised && !('iwatoCurse' in hexed.patch), 'a line with no haunted note leaves the curse alone');
  const one = commitMelodyEconomy(mk(['D', 'Eb', 'G'], curse), 'r', {});
  eq([one.report.liftedNow, one.patch.iwatoCurse?.lifted], [[1], [1]], 'the commit writes the lift into its own patch');
  eq(clean(one), 3, '…and the Iwato line is scored clean (it pays)');
  const all = commitMelodyEconomy(mk(['Eb', 'Ab', 'C'], curse), 'r', {});
  ok(all.report.exorcised && all.patch.iwatoCurse === null && all.patch.curseEnded.how === 'exorcised', '🔥 all three in one melody: lifted at once');
}

// ═══ 8. no refresh ══════════════════════════════════════════════════════════
section('§8 no refresh — the haunted notes stay the ones that sprang');
{
  const second = { ...initNoteState(), ...rival, iwatoCurse: { ...curse, turnsLeft: 2, lifted: [1] }, noteStock: ['G', 'G', 'G'] };
  const via = startTurnNotes(second, { spiritId: 'r', draws: [] });
  ok(!('iwatoCurse' in via.patch), 'their 2nd cursed turn start leaves the curse alone');
  ok(!('curseRefreshed' in via.report), '…and reports no refresh');
  eq(via.report.curseDrawShare, 1 / 3, '…but says how far the draw has seeped');
}

// ═══ 9. the cursed draw ═════════════════════════════════════════════════════
section('§9 the draw seeps in — ⅓ then ⅔ of the guaranteed slice off the cursed wheel');
{
  // E lydian, cursed on D: Iwato D Eb G Ab C. Guarantee 0.5 → u < 0.5 is the
  // guaranteed slice; share f → u < 0.5·f is the cursed wheel, the rest of the
  // slice their own palette; u ≥ 0.5 all twelve.
  const IW = [2, 3, 7, 8, 0], OWN = playableScale('E', 'lydian').map(pc);
  const sheet = { ...initNoteState(), rootNote: 'E', paletteMode: 'lydian', noteStock: Array(6).fill('E'), usedStockIdx: [0, 1, 2, 3, 4, 5] };
  const draw = (turnsLeft, us) => startTurnNotes({ ...sheet, iwatoCurse: { ...curse, turnsLeft } }, { spiritId: 'r', draws: us }).patch.noteStock;
  const t2 = draw(2, [0.02, 0.09, 0.16, 0.2, 0.33, 0.48]);
  ok(t2.slice(0, 3).every(n => IW.includes(pc(n))), `⭐ 2nd cursed turn: the bottom third of the slice is Iwato (${t2.slice(0, 3).join(' ')})`);
  ok(t2.slice(3).every(n => OWN.includes(pc(n))), `…the rest their own lydian (${t2.slice(3).join(' ')})`);
  const t3 = draw(1, [0.02, 0.16, 0.3, 0.32, 0.36, 0.48]);
  ok(t3.slice(0, 4).every(n => IW.includes(pc(n))), `⭐ 3rd cursed turn: two thirds of the slice is Iwato (${t3.slice(0, 4).join(' ')})`);
  ok(t3.slice(4).every(n => OWN.includes(pc(n))), `…the last third their own (${t3.slice(4).join(' ')})`);
  const t1 = draw(3, [0.02, 0.2, 0.48]);
  ok(t1.every(n => OWN.includes(pc(n))), 'the springing turn\'s share is 0 (never drawn cursed — the draw came first)');
  const plainDraw = startTurnNotes(sheet, { spiritId: 'r', draws: [0.02, 0.2, 0.48] }).patch.noteStock;
  eq(plainDraw, t1, 'share 0 draws exactly what an uncursed sheet draws');
  eq(draw(1, [0.99]).length, 6, 'still one draw per note');
  // the rates, over a fine sweep of u: the cursed wheel's share of new notes
  const rate = turnsLeft => { const us = Array.from({ length: 600 }, (_, k) => (k + 0.5) / 600);
    let hits = 0; for (let k = 0; k < us.length; k += 6) hits += draw(turnsLeft, us.slice(k, k + 6)).filter(n => IW.includes(pc(n))).length;
    return hits / us.length; };
  const r2 = rate(2), r3 = rate(1);
  // expected = f·½ + (1−f)·½·(own∩Iwato)/7 + ½·5/12 — E lydian shares Eb (D#) and Ab (G#) with Iwato on D
  const want = f => f / 2 + (1 - f) / 2 * (OWN.filter(x => IW.includes(x)).length / OWN.length) + 0.5 * 5 / 12;
  ok(Math.abs(r2 - want(1 / 3)) < 0.02 && Math.abs(r3 - want(2 / 3)) < 0.02 && r3 > r2,
    `the cursed share climbs as ruled (2nd ${r2.toFixed(2)} ≈ ${want(1 / 3).toFixed(2)}, 3rd ${r3.toFixed(2)} ≈ ${want(2 / 3).toFixed(2)})`);
}

// ═══ 10. the clock ══════════════════════════════════════════════════════════
section('§10 three of their turns, then it ends either way');
{
  let s = cursed;
  const t1 = endCursedTurn(s); s = { ...s, ...t1.patch };
  const t2 = endCursedTurn(s); s = { ...s, ...t2.patch };
  const t3 = endCursedTurn(s);
  eq([t1.turnsLeft, t2.turnsLeft, t3.ended], [2, 1, 'expired'], '⭐ the springing turn counts as the first: 3 → 2 → 1 → expired');
  eq(t3.patch, { iwatoCurse: null, curseEnded: { key: 'K1', how: 'expired', lifted: 0 } }, 'it says how it ended');
  eq(endCursedTurn(rival).patch, null, 'an uncursed turn end writes nothing');
}

// ═══ 11. an eliminated Ronin, and the picture ═══════════════════════════════
section('§11 orphaned traps, and curseScene keeps the trap secret');
{
  eq(orphanedTraps([{ id: RONIN, knockedOut: true }, { id: 'r' }], { [RONIN]: laid }), [RONIN], 'an eliminated Ronin\'s trap is cleared');
  eq(orphanedTraps([{ id: RONIN, knockedOut: false }], { [RONIN]: laid }), [], '…a standing one\'s is not');
  const sp = [{ id: RONIN, color: '#4488ff' }, { id: 'r', color: '#ff4444' }, { id: 'q', color: '#ffcc00' }];
  const sc = curseScene(sp, { [RONIN]: laid, r: cursed, q: { curseEnded: { key: 'K0', how: 'exorcised', lifted: 3 } } });
  eq(sc.instruments, [], '⚠️ the ARMED TRAP is not in the public scene');
  ok(!JSON.stringify(sc).includes('R#4'), '…not even its key');
  eq(sc.curses[0], { key: 'K1', roninId: RONIN, color: '#4488ff', targetId: 'r', fromHex: 17, ivs: [1, 6, 10], lifted: 0, rootPc: 2, turnsLeft: 3, ended: null },
    'the sprung curse, with its hex and haunted notes for the picture');
  eq([sc.curses[1].key, sc.curses[1].ended, sc.curses[1].lifted], ['K0', 'exorcised', 3], 'an ended curse says how it ended');
  eq(sc.ashes, [], 'no ash while the trap is only armed');
  eq(ashPatch(trapOf(laid), 'orphaned').shamisenAsh.how, 'orphaned', 'an eliminated Ronin\'s trap burns too');
  eq(ashPatch(null, 'wasted'), { shamisenTrap: null }, 'no trap: nothing to burn');
  const burnt = { ...laid, ...ashPatch(trapOf(laid), 'wasted') };
  const sa = curseScene(sp, { [RONIN]: burnt });
  eq(sa.ashes, [{ key: 'R#4~wasted', trapKey: 'R#4', hexNum: 17, note: 'F', roninId: RONIN, color: '#4488ff', how: 'wasted' }],
    '⭐ rule 18: the ash IS in the public scene, with its hex (the trap is spent — nothing hidden is left)');
}

// ═══ 12. the headless path springs it too ═══════════════════════════════════
section('§12 the bench\'s pickup (transition.js) springs the same curse');
{
  const CONFIG = { mode: 'ffa', startingLives: 3, spirits: [
    { id: RONIN, name: 'Shredding Ronin', corner: 'blue', num: 45, vibe: 5, maxVibe: 5, knockedOut: false, facing: 0 },
    { id: 'Metalness_Monster', name: 'Metalness Monster', corner: 'yellow', num: CORNERS.yellow.homeNum, vibe: 5, maxVibe: 5, knockedOut: false, facing: 0 },
  ] };
  const st0 = makeInitialState(structuredClone(CONFIG), 77);
  const hex = 30;
  const st = { ...st0,
    board: { ...st0.board, boardTokens: [...st0.board.boardTokens.filter(t => t.num !== hex), { num: hex, note: 'A', turnsOnBoard: 0 }],
      chargeZones: [], eventHexes: [] },
    noteStates: { ...st0.noteStates, [RONIN]: { ...st0.noteStates[RONIN], shamisenTrap: { hexNum: hex, note: 'A', key: 'B#1' } } } };
  const r = collectPickups(st, 'Metalness_Monster', hex, makeRng(5));
  const c = r.state.noteStates.Metalness_Monster.iwatoCurse;
  ok(c && c.root === 'A' && c.by === RONIN, '⭐ the bot who walks onto it is cursed — Iwato on A');
  eq(r.state.noteStates[RONIN].shamisenTrap, null, 'the trap is spent');
  ok(!r.state.board.boardTokens.some(t => t.num === hex), 'the note was still picked up');
  ok(r.logs.some(l => /CURSED/.test(l)), 'and the log says so');
  const own = collectPickups(st, RONIN, hex, makeRng(5));
  ok(!own.state.noteStates.Metalness_Monster.iwatoCurse && own.state.noteStates[RONIN].shamisenTrap === null, 'his own pickup just disarms it');
}

// ═══ 13. v1 and the glow-and-debt Shamisen stay gone ═════════════════════════
section('§13 the old Shamisens stay gone');
for (const dead of ['canTakeUp', 'takeUpPatch', 'tuneCheck', 'tunePatch', 'castCheck', 'castPatches', 'stringVoicing', 'exorciseWindow', 'exorcisedBy', 'CAST_RANGE'])
  ok(!(dead in curseApi), `🪦 iwatoCurse.js no longer exports \`${dead}\``);
ok(!('tickShamisen' in cooldowns) && !('resetAllCooldowns' in cooldowns), '🪦 no cooldown accelerator, no reset');
ok(!('CURSED_SHAMISEN_DURATION' in constants) && !('CURSED_SHAMISEN_PAYOFF_COST' in constants), '🪦 no duration, no debt');
eq([initNoteState().shamisenTrap, initNoteState().iwatoCurse, initNoteState().shamisen], [null, null, undefined], 'a fresh sheet: no trap, no curse, no instrument');
const client = readFileSync(new URL('../rlsw-simulator-v3_8_1.jsx', import.meta.url), 'utf8');
for (const dead of ['takeUpShamisen', 'resolveIwatoCast', "dest === 'strings'", 'stringsOpen', 'payShamisenDebt'])
  ok(!client.includes(dead), `🪦 the client no longer mentions \`${dead}\``);
ok(!/[.?]shamisenCurse\b|\bshamisenCurse\s*:/.test(client), '🪦 the client no longer reads or writes `shamisenCurse`');
const pickAt = client.indexOf('function checkTokenPickup(');
const pick = client.slice(pickAt, pickAt + 1600);
ok(/springShamisenTrap\(spiritId, hexNum\);\s*dispatch\(tokenPickedUp/.test(pick), '⭐ the client springs the trap BEFORE the token leaves the board');
const layAt = client.indexOf('function layShamisenTrap(');
// ⚠️ the lay function ends at the NEXT function, whichever follows it (the ash's theatre sits between them now)
const layEnd = Math.min(...['function springShamisenTrap(', 'function shamisenAshTheatre('].map(f => client.indexOf(f, layAt)).filter(i => i > layAt));
const lay = client.slice(layAt, layEnd);
ok(lay.includes('beatsSpent(0, true)') && lay.includes('layPatch('), 'laying spends the Action Token and writes the patch');
eq((lay.match(/addLog\(/g) ?? []).length, 1, '⚠️ laying logs nothing but a refusal — the trap is hidden');
// 🪦 rule 18: a trap that caught no one IS public — the log line and the burn, on every path
const ashFn = client.slice(client.indexOf('function shamisenAshTheatre('), client.indexOf('function springShamisenTrap('));
ok(ashFn.includes('addLog(') && ashFn.includes('burnOut('), 'the ash has a public log line and the burn\'s crackle');
ok((client.match(/shamisenAshTheatre\(/g) ?? []).length >= 5, '…called on every way a trap can catch no one (wasted · disarmed · fizzled · orphaned)');
ok(/setNoteField\(id, ashPatch\(t, 'orphaned'\)\)/.test(client), 'an eliminated Ronin\'s trap leaves the public ash too');
ok(/setTimeout\(\(\) => \{ try \{ scheduleCast\([^]*?NOROI_SPRING_CAST_DELAY_MS\)/.test(client), '⏱ the cast\'s sound waits for the arena\'s ghost shamisen (one shared delay)');
ok(/const viewerSeesTrap = roninId => netRef\.current \? netRef\.current\.mySpiritId === roninId/.test(client), '⭐ the trap is drawn for its Ronin\'s screen only');
ok(client.includes("claim:myTrap?.hexNum === tok.num ? 'cursed'"), '…as the Lost Chord\'s colour in the arena');

// ═══ 14. the words match the rules ══════════════════════════════════════════
section('§14 the skill text quotes the real numbers');
const desc = SKILL_BY_ID[SHAMISEN_SKILL].desc;
ok(desc.includes(`${CURSED_SHAMISEN_CD}-round cooldown`) && !/\bDb\b/.test(desc), 'the price — the Action Token and a cooldown, no Db');
ok(desc.includes('Action Token') && /only you can see/i.test(desc), 'the trap: the token, hidden');
ok(desc.includes(`${CURSE_TURNS} of their turns`) && /Three haunted notes/.test(desc), 'the rule numbers');
ok(/on THAT note/.test(desc), 'the key is the cursed note');

console.log(`\n✅ shamisenCheck: ${count} assertions passed — lay, hold, spring, lift, seep, expire`);
