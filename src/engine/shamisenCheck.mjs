// ─── 🎸 CURSED SHAMISEN CHECK — THE IWATO CURSE ─────────────────────────────
// `npm run test:shamisen`. Pins the RULES of the Iwato curse
// (`engine/systems/iwatoCurse.js`, `RONIN_ABILITY_DESIGN.md` §2.3.00) and the
// places the curse has to reach to be true: the turn start that opens the
// strings, the melody commit that scores a cursed hand, and the finder.
// The look and the scale helpers are `test:cursedshamisen`.
//
// 🪦 This file used to pin the glow-and-debt Shamisen (2026-08-26): `tickShamisen`,
// `resetAllCooldowns`, `CURSED_SHAMISEN_DURATION`, `CURSED_SHAMISEN_PAYOFF_COST`.
// All four are gone with the mechanic — §6 below asserts they STAY gone.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as cooldowns from './systems/cooldowns.js';
import * as constants from '../data/gameConstants.js';
import { ABILITY_CD } from './systems/cooldowns.js';
import { CURSED_SHAMISEN_CD, SONIC_BEAM_REACH } from '../data/gameConstants.js';
import { SKILL_BY_ID } from '../data/skillTree.js';
import {
  SHAMISEN_SKILL, CAST_RANGE, STRINGS, CURSE_TURNS, EXORCISE_NOTES,
  hasShamisen, stringsOf, shamisenRoot, canTakeUp, takeUpPatch, tuningOpen, tuneCheck, tunePatch, tunableIdx, stringVoicing,
  castCheck, castPatches, curseScene, exorcisePatch, isCursed, exorciseWindow, cursedPalette, livePalette, exorcisedBy, endCursedTurn,
} from './systems/iwatoCurse.js';
import { startTurnNotes } from './systems/turnFlow.js';
import { commitMelodyEconomy } from './systems/melodyCommit.js';
import { playableScale, paletteScaleFor, pitchIndex } from '../music/notes.js';
import { makeInitialNoteState } from './systems/economy.js';
const initNoteState = () => makeInitialNoteState('cosmic_ronin', () => 0.5);

let count = 0;
const ok = (c, m) => { count++; assert.ok(c, m); };
const eq = (a, b, m) => { count++; assert.deepStrictEqual(a, b, m); };
const section = t => console.log(`\n${t}`);

const RONIN = 'cosmic_ronin';
// The Ronin on D: Iwato on D is D Eb G Ab C.
const ronin = (over = {}) => ({ rootNote: 'D', unlockedSkills: [SHAMISEN_SKILL], abilityCd: {},
  noteStock: ['D', 'Eb', 'E', 'G', 'Ab', 'A', 'C', 'F'], usedStockIdx: [], ...over });

// ═══ 1. the numbers ══════════════════════════════════════════════════════════
section('§1 the numbers');
eq(STRINGS, 3, 'a shamisen has three strings');
eq(CURSE_TURNS, 2, 'the curse holds their next two turns');
eq(EXORCISE_NOTES, 3, 'three different Iwato notes exorcise it');
eq(CAST_RANGE, SONIC_BEAM_REACH, '⁉️ the cast reaches as far as the Sonic beam (default until Alex rules)');
eq(ABILITY_CD[SHAMISEN_SKILL], CURSED_SHAMISEN_CD, 'the quoted cooldown is the real one');

// ═══ 2. take up → tune from the next turn ═══════════════════════════════════
section('§2 take up, and the strings open on the NEXT turn');
ok(hasShamisen(ronin()), 'the Ronin who brought it owns it');
ok(!hasShamisen({ unlockedSkills: ['psycho_bushido'] }), 'a Ronin without it does not');
ok(canTakeUp(ronin()), 'off cooldown and not yet up → he may take it up');
ok(!canTakeUp(ronin({ abilityCd: { [SHAMISEN_SKILL]: 1 } })), '⚠️ not while it recharges');
ok(!canTakeUp(ronin({ shamisen: { strings: [], ready: false } })), 'not twice');
const up = { ...ronin(), ...takeUpPatch(ronin()) };
eq(up.shamisen, { strings: [], ready: false, root: 'D' }, 'the take-up is free and writes an untuned instrument in his key');
ok(!tuningOpen(up), '⭐ Alex: "from the next turn" — no tuning in the turn he takes it up');
eq(tuneCheck(up, 'Eb').ok, false, '…and the check refuses it');
const next = { ...up, ...startTurnNotes(up, { spiritId: RONIN }).patch };
eq(next.shamisen.ready, true, '⭐ his next turn start opens the strings (`turnFlow`)');
ok(tuningOpen(next), 'the third destination is open');
const again = { ...next, ...startTurnNotes(next, { spiritId: RONIN }).patch };
eq(again.shamisen, next.shamisen, 'a later turn start leaves the strings alone (they persist)');
eq(startTurnNotes(ronin(), { spiritId: RONIN }).patch.shamisen, undefined, 'a Ronin who never took it up gets no instrument');

// ═══ 3. tuning ══════════════════════════════════════════════════════════════
section('§3 tuning: Iwato notes on HIS root, up to three');
eq(tuneCheck(next, 'Eb').ok, true, '♭2 tunes');
eq(tuneCheck(next, 'E').ok, false, 'E is not Iwato on D');
eq(tuneCheck(next, 'F').ok, false, 'F (his ♭3, in his own palette) is not Iwato either — the curse is built from other notes');
let s = next;
for (const n of ['Eb', 'Eb', 'Ab']) { ok(tuneCheck(s, n).ok, `${n} tunes`); s = { ...s, ...tunePatch(s, n) }; }
eq(stringsOf(s), ['Eb', 'Eb', 'Ab'], 'repeats are allowed (Alex: "any random note from the scale")');
eq(stringVoicing(s).octaves, [0, 1, 0], '🎚️ …and a repeat rings an octave higher');
eq(stringVoicing(s).degrees, ['♭2', '♭2', '♭5'], 'the strings read as degrees');
eq(tuneCheck(s, 'D').ok, false, 'a fourth string does not exist');
ok(!tuningOpen(s), 'the destination closes when all three are tuned');
// ⚠️ His root follows his melody — the instrument must not.
const moved = { ...s, rootNote: 'A' };
eq(shamisenRoot(moved), 'D', '⭐ the shamisen keeps the key it was taken up in, after his root moves');
eq(castPatches(moved, RONIN).rival.iwatoCurse.roninRoot, 'D', '…and curses in that key');
eq(tuneCheck({ ...next, rootNote: 'A' }, 'Eb').ok, true, '…and tunes in it (E♭ is Iwato on D, not on A)');
const pcs = (ns, idx) => idx.map(i => pitchIndex(ns.noteStock[i]));
eq(pcs(next, tunableIdx(next)), [2, 3, 7, 8, 0], 'the hand glows exactly its Iwato notes (D E♭ G A♭ C, however his pool spells them)');
eq(pcs(next, tunableIdx(next, new Set([1]))), [2, 7, 8, 0], '…minus the ones already spent');

// ═══ 4. the cast ════════════════════════════════════════════════════════════
section('§4 the cast');
const here = { q: 0, r: 0 }, three = { q: 3, r: 0 }, four = { q: 2, r: 2 };
eq(castCheck({ ns: next }).ok, false, 'not before three strings');
eq(castCheck({ ns: s, from: here, to: three }).ok, true, 'three strings, in reach, token → it casts');
eq(castCheck({ ns: s, from: here, to: four }).ok, false, `⚠️ 4 hexes is out of reach (${CAST_RANGE})`);
eq(castCheck({ ns: s, tokenUsed: true }).ok, false, 'the Action Token is the cast\'s');
eq(castCheck({ ns: { ...s, abilityCd: { [SHAMISEN_SKILL]: 1 } } }).ok, false, 'recharging → no cast (🪦 the Db refusal went with Db, 2026-10-02)');
eq(castCheck({ ns: s, rivalNs: { iwatoCurse: { turnsLeft: 1 } } }).ok, false, 'one curse per rival at a time');
const cast = castPatches(s, RONIN, 'K1');
eq(cast.ronin.shamisen, null, 'the strings are spent and the instrument put away');
eq(cast.ronin.dbPoints, undefined, '🪦 he pays no Db — there is none');
eq(cast.ronin.abilityCd[SHAMISEN_SKILL], CURSED_SHAMISEN_CD, '…and the cooldown');
eq(cast.rival.iwatoCurse, { key: 'K1', by: RONIN, roninRoot: 'D', strings: ['Eb', 'Eb', 'Ab'], turnsLeft: CURSE_TURNS }, 'the rival carries the curse on HIS root');
ok(!canTakeUp({ ...s, ...cast.ronin }), 'he cannot take it straight back up — the cooldown runs first');

// ═══ 5. the curse ═══════════════════════════════════════════════════════════
section('§5 the curse: the palette, the exorcism, the countdown');
// A Lydian-ish rival on E whose own palette shares little with Iwato on D.
const rival = { rootNote: 'E', paletteMode: 'lydian', unlockedSkills: [] };
const cursed = { ...rival, ...cast.rival };
ok(isCursed(cursed) && !isCursed(rival), 'isCursed reads the sheet');
eq(livePalette('x', rival), playableScale('E', 'lydian'), 'uncursed, the live palette is exactly the Spirit\'s own');
eq(livePalette('x', rival), paletteScaleFor('x', rival), '…the same reading as notes.js');
eq(cursedPalette('x', cursed).map(pitchIndex), [2, 3, 7, 8, 0], 'cursed: Iwato on the RONIN\'s root (D), not theirs');
eq(livePalette('x', cursed), cursedPalette('x', cursed), 'livePalette swaps to it');
// Spelling: the rival on a sharp key spells Eb as D#, and the palette must match the hand by name.
const sharpRival = { rootNote: 'B', paletteMode: 'lydian', iwatoCurse: { roninRoot: 'D', turnsLeft: 2 } };
ok(cursedPalette('x', sharpRival).includes('D#') && !cursedPalette('x', sharpRival).includes('Eb'),
  '⚠️ the palette is spelled through the RIVAL\'s pool (D#), because their hand is — a name mismatch would make a real Iwato note read as discord');

ok(exorciseWindow(cursed), 'their first cursed turn is the exorcism window');
ok(exorcisedBy(cursed, ['D', 'G', 'C', 'E']), 'three different Iwato notes lift it');
ok(!exorcisedBy(cursed, ['D', 'D', 'G', 'E']), '…two different do not');
ok(!exorcisedBy(rival, ['D', 'G', 'C']), 'nothing to lift on an uncursed sheet');
const t1 = endCursedTurn(cursed);
eq([t1.ended, t1.turnsLeft], [null, 1], 'the end of their first cursed turn: one left');
const c2 = { ...cursed, ...t1.patch };
ok(isCursed(c2) && !exorciseWindow(c2), '⚠️ the second turn is cursed but can no longer be exorcised (Alex: "their very next turn")');
ok(!exorcisedBy(c2, ['D', 'G', 'C']), '…so the same melody does nothing now');
const t2 = endCursedTurn(c2);
eq([t2.ended, t2.patch], ['expired', { iwatoCurse: null, curseEnded: { key: 'K1', how: 'expired' } }], 'the end of the second: it expires, and says how (for every client\'s picture)');
eq(endCursedTurn(rival).patch, null, 'an uncursed turn end writes nothing');

// ── the commit really scores a cursed hand on Iwato ──
section('§5b the melody commit scores the cursed palette');
const mk = (line, curse) => {
  const ns = { ...initNoteState(), rootNote: 'E', paletteMode: 'lydian', melodyLine: line, iwatoCurse: curse ?? null };
  return { spirits: [{ id: 'r', name: 'Rival' }], noteStates: { r: ns } };
};
const own = ['E', 'F#', 'B', 'C#'];                     // E Lydian, none of them Iwato on D (D Eb G Ab C)
const plain = commitMelodyEconomy(mk(own), 'r', {});
const hexed = commitMelodyEconomy(mk(own, cast.rival.iwatoCurse), 'r', {});
ok(plain.ok && hexed.ok, 'both commits run');
const clean = r => r.report?.cleanNoteCount ?? r.report?.trackClassified?.filter?.(n => n.inScale).length;
eq(clean(plain), 4, 'uncursed, their own notes are clean');
eq(clean(hexed), 0, '⭐ cursed, the same notes are ALL discord — "a hand built for their own scale goes dead"');
const iw = commitMelodyEconomy(mk(['D', 'G', 'C', 'Ab'], cast.rival.iwatoCurse), 'r', {});
eq(clean(iw), 4, '…and Iwato notes play clean');
ok(iw.report.exorcised && iw.patch.iwatoCurse === null, '🔥 three different Iwato notes on the first cursed turn: the commit itself lifts the curse');
eq(iw.patch.curseEnded, { key: 'K1', how: 'exorcised' }, '…and records HOW it ended');
ok(iw.report.earned > 0 || iw.report.cleanNoteCount === 4, '…and the exorcising line is scored clean (it pays)');
ok(!hexed.report.exorcised && !('iwatoCurse' in hexed.patch), 'a line that does not exorcise leaves the curse alone');
const late = commitMelodyEconomy(mk(['D', 'G', 'C', 'Ab'], { ...cast.rival.iwatoCurse, turnsLeft: 1 }), 'r', {});
ok(!late.report.exorcised && !('iwatoCurse' in late.patch), '⚠️ …and the second cursed turn cannot exorcise, even with the notes');

// ═══ 5c. the picture's reading ═════════════════════════════════════════════
section('§5c curseScene — what every client draws, from state alone');
{
  const sp = [{ id: RONIN, color: '#4488ff' }, { id: 'r', color: '#ff4444' }, { id: 'q', color: '#ffcc00' }];
  const sc = curseScene(sp, { [RONIN]: s, r: cursed, q: { curseEnded: { key: 'K0', how: 'exorcised' } } });
  eq(sc.instruments, [{ roninId: RONIN, color: '#4488ff', strings: ['♭2', '♭2′', '♭5'] }], 'his instrument, its strings as degrees (a repeat primed: it rings an octave up)');
  eq(sc.curses[0], { key: 'K1', roninId: RONIN, color: '#4488ff', targetId: 'r', ivs: [1, 1, 6], turnsLeft: 2, ended: null }, 'the live curse, with his strings as intervals for the cast\'s melody');
  eq([sc.curses[1].key, sc.curses[1].ended], ['K0', 'exorcised'], 'an ended curse says how it ended');
  eq(curseScene(sp, {}), { instruments: [], curses: [] }, 'nothing to draw on a quiet board');
  eq(curseScene([{ id: RONIN, knockedOut: true }], { [RONIN]: s }).instruments, [], 'a knocked-out Ronin holds nothing up');
  eq(exorcisePatch({}), { iwatoCurse: null, curseEnded: { key: null, how: 'exorcised' } }, 'exorcisePatch is safe on a keyless curse');
}

// ═══ 6. the old Shamisen is gone and stays gone ═════════════════════════════
section('§6 the glow-and-debt Shamisen stays gone');
ok(!('tickShamisen' in cooldowns) && !('resetAllCooldowns' in cooldowns), '🪦 no cooldown accelerator, no reset');
ok(!('CURSED_SHAMISEN_DURATION' in constants) && !('CURSED_SHAMISEN_PAYOFF_COST' in constants), '🪦 no duration, no debt');
eq(initNoteState().shamisenCurse, undefined, '🪦 no `shamisenCurse` on a fresh sheet');
eq([initNoteState().shamisen, initNoteState().iwatoCurse], [null, null], 'the new fields seed empty');
const client = readFileSync(new URL('../rlsw-simulator-v3_8_1.jsx', import.meta.url), 'utf8');
ok(!/[.?]shamisenCurse\b|\bshamisenCurse\s*:/.test(client), '🪦 the client no longer reads or writes `shamisenCurse`');
for (const dead of ['payShamisenDebt', 'checkShamisenCursePenalty', 'tickCursedShamisen', 'resolveCursedShamisen', 'shamisen-glow', 'playShamisenStrum'])
  ok(!client.includes(dead), `🪦 the client no longer mentions \`${dead}\``);

// ═══ 7. the words match the rules ═══════════════════════════════════════════
section('§7 the skill text quotes the real numbers');
const desc = SKILL_BY_ID[SHAMISEN_SKILL].desc;
ok(desc.includes(`${CAST_RANGE} hexes`), 'the reach');
ok(desc.includes(`${CURSED_SHAMISEN_CD}-round cooldown`) && !/\bDb\b/.test(desc), 'the price — a cooldown, and no Db anywhere in the text');
ok(desc.includes(`${STRINGS} strings`) && desc.includes(`next ${CURSE_TURNS} turns`) && desc.includes(`${EXORCISE_NOTES} different Iwato notes`), 'the three rule numbers');
ok(/NEXT turn/.test(desc), 'the next-turn rule is stated');

console.log(`\n✅ shamisenCheck: ${count} assertions passed — take up, tune from the next turn, cast, curse, exorcise or expire`);
