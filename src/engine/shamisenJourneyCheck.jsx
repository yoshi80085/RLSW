// ─── 🎸 SHAMISEN JOURNEY — the Iwato curse, played in the real Game ──────────
// `test:shamisen` proves the rules; this proves the WIRING, in a mounted match
// driven only by clicks, with the engine's own note sheets as the witness:
//   turn 1  — take the shamisen up from the rail; the strings do NOT open yet
//   turn 2  — the chord step's third destination: three Iwato strings out of
//             the 3-commit budget, a non-Iwato note refused; then the cast on a
//             rival two hexes away (the Action Token, Db, the cooldown)
//   rival   — their hand reads on the Iwato palette; each of their turn ends
//             counts the curse down; the second one ends it
// Run: npm run test:shamisenjourney
import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import assert from 'node:assert/strict';
import process from 'node:process';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import { HEX_BY_NUM } from '../board/hexMap.js';
import { neighborInDirection, axialDist } from '../board/hexGeometry.js';
import { isIwato } from '../board/cursedShamisen.js';
import { CURSED_SHAMISEN_DB_COST, CURSED_SHAMISEN_CD } from '../data/gameConstants.js';
import { CURSE_TURNS, CAST_RANGE } from './systems/iwatoCurse.js';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── the table: the Ronin with the Shamisen, a rival two hexes in front of him ──
const config = buildTestingGroundsConfig({ beginnerMode: false });
config.seed = Number(process.env.SEED ?? 4);
config.spirits = config.spirits.map(s => ({ ...s, cpu: false }));
const roninAt = config.spirits.findIndex(s => s.id.startsWith('cosmic_ronin'));
assert.ok(roninAt >= 0, 'the Testing Grounds seat a Ronin');
const ronin0 = config.spirits[roninAt];
config.spirits[roninAt] = { ...ronin0, abilities: ['psycho_bushido', 'cursed_shamisen'] };
const rivalAt = (roninAt + 1) % config.spirits.length;
const home = HEX_BY_NUM[ronin0.num];
let near = null;
for (let d = 0; d < 6 && !near; d++) {
  const one = neighborInDirection(home, d), two = one && neighborInDirection(one, d);
  if (two && !config.spirits.some(s => s.num === two.num)) near = two;
}
assert.ok(near && axialDist(home.q, home.r, near.q, near.r) === 2, 'a free hex two away from the Ronin');
config.spirits[rivalAt] = { ...config.spirits[rivalAt], num: near.num };

let observed = null, checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const root = createRoot(document.getElementById('root'));
const click = async el => { assert.ok(el, 'click target exists'); await act(async () => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); };
const wait = ms => act(async () => new Promise(r => setTimeout(r, ms)));
const buttons = () => [...document.querySelectorAll('button')];
const button = text => buttons().find(el => el.textContent.includes(text));
const chip = label => [...document.querySelectorAll('button.stack-chip')].find(b => b.textContent.trim().startsWith(label));
const sheetOf = id => observed.noteStates[id];
const acting = () => observed.acting;
const RONIN = ronin0.id, RIVAL = config.spirits[rivalAt].id;
const usedHas = (used, i) => Array.isArray(used) ? used.includes(i) : !!used?.has?.(i);
const freeIdx = id => sheetOf(id).noteStock.map((_, i) => i).filter(i => !usedHas(sheetOf(id).usedStockIdx, i));

/** Play a whole plain turn for whoever is acting: melody of up to n notes, commit, end. */
async function plainTurn(n = 2) {
  if (button('Continue to Melody')) await click(button('Continue to Melody'));
  for (let k = 0; k < n; k++) {
    const note = [...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')].map(svg => svg.parentElement).find(el => el.style.cursor === 'pointer');
    if (!note) break;
    await click(note);
  }
  const commit = buttons().find(b => /Commit \(\d/.test(b.textContent));
  if (commit && !commit.disabled) await click(commit);
  await click(button('End ⏭'));
  await wait(120);
}
async function toTurnOf(id, guard = 8) {
  while (acting() !== id && guard-- > 0) await plainTurn(2);
  assert.equal(acting(), id, `reached ${id}'s turn`);
}

try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}} onEngineState={s => { observed = s; }} />));
  ok(sheetOf(RONIN).unlockedSkills.includes('cursed_shamisen'), 'the Ronin brought the Shamisen');
  await toTurnOf(RONIN);

  // ── turn 1: take it up ──
  ok(!chip('🎸') && !document.body.textContent.includes('Strings open next turn'), 'no strings row before it is taken up');
  await click(button('Continue to Melody'));
  for (let k = 0; k < 2; k++) await click([...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')].map(s => s.parentElement).find(el => el.style.cursor === 'pointer'));
  await click(buttons().find(b => /Commit \(\d/.test(b.textContent)));
  const takeUp = button('Take up Shamisen');
  ok(takeUp && !takeUp.disabled, 'the rail offers to take the shamisen up');
  const dbBefore = sheetOf(RONIN).dbPoints ?? 0;
  await click(takeUp);
  ok(sheetOf(RONIN).shamisen && sheetOf(RONIN).shamisen.ready === false, 'taken up — and the strings are NOT open this turn');
  ok((sheetOf(RONIN).dbPoints ?? 0) === dbBefore, 'the take-up is free');
  ok(button('strings next turn'), 'the rail says when the strings open');
  const root0 = sheetOf(RONIN).shamisen.root;
  await click(button('End ⏭')); await wait(120);

  // ── round the table, back to him ──
  await toTurnOf(RONIN);
  ok(sheetOf(RONIN).shamisen.ready === true, '⭐ his next turn opens the strings');
  const strings = chip('Strings');
  ok(strings && !strings.disabled, 'the chord step shows the third destination');
  await click(strings);
  ok(strings.getAttribute('aria-pressed') === 'true', 'the strings are picked');
  const iw = freeIdx(RONIN).filter(i => isIwato(sheetOf(RONIN).noteStock[i], root0));
  const non = freeIdx(RONIN).filter(i => !isIwato(sheetOf(RONIN).noteStock[i], root0));
  console.log(`  Ronin's hand (root ${root0}): ${sheetOf(RONIN).noteStock.join(' ')} — Iwato slots ${iw.join(',')}`);
  assert.ok(iw.length >= 3, `seed ${config.seed}: the hand needs three Iwato notes (try another SEED)`);
  if (non.length) {
    const before = sheetOf(RONIN).stackCommitsThisTurn ?? 0;
    await click(document.querySelector(`[data-stock-idx="${non[0]}"]`));
    ok((sheetOf(RONIN).shamisen.strings.length === 0) && (sheetOf(RONIN).stackCommitsThisTurn ?? 0) === before,
      `${sheetOf(RONIN).noteStock[non[0]]} is not Iwato — refused, no commit spent`);
  }
  for (const i of iw.slice(0, 3)) await click(document.querySelector(`[data-stock-idx="${i}"]`));
  const sh = sheetOf(RONIN).shamisen;
  ok(sh.strings.length === 3, `three strings tuned: ${sh.strings.join(' ')}`);
  ok(sheetOf(RONIN).stackCommitsThisTurn === 3, '⭐ they came out of the SAME 3-commit budget as Drive and Sustain');
  ok(iw.slice(0, 3).every(i => usedHas(sheetOf(RONIN).usedStockIdx, i)), '…and spent those notes from his hand');
  await click(button('Continue to Melody'));
  const note = [...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')].map(s => s.parentElement).find(el => el.style.cursor === 'pointer');
  if (note) await click(note);
  const commit = buttons().find(b => /Commit \(\d/.test(b.textContent));
  if (commit && !commit.disabled) await click(commit);
  // Db for the cast, from the Testing Grounds panel (the same lever a tester uses).
  await click(button('🧪 TEST'));
  while ((sheetOf(RONIN).dbPoints ?? 0) < CURSED_SHAMISEN_DB_COST) await click(button('+3 DB'));
  await click(button('🧪 CLOSE'));
  const castBtn = button('Cast the curse');
  ok(castBtn && !castBtn.disabled, 'three strings, Db and an action: the rail offers the cast');
  await click(castBtn);
  ok(button('Cancel'), `armed — the rail offers Cancel while it waits for a rival within ${CAST_RANGE} hexes`);
  const db0 = sheetOf(RONIN).dbPoints;
  await click(document.querySelector(`[data-hex-num="${near.num}"]`));
  const curse = sheetOf(RIVAL).iwatoCurse;
  ok(curse && curse.by === RONIN && curse.roninRoot === root0 && curse.turnsLeft === CURSE_TURNS, '⚡ the rival is cursed, in the key he took the shamisen up in');
  ok(sheetOf(RONIN).shamisen === null, 'the strings are spent and the instrument put away');
  ok(sheetOf(RONIN).dbPoints === db0 - CURSED_SHAMISEN_DB_COST, `he paid ${CURSED_SHAMISEN_DB_COST} Db`);
  ok(sheetOf(RONIN).abilityCd.cursed_shamisen === CURSED_SHAMISEN_CD, 'the cooldown runs');
  ok(observed.turn.actionTokenUsed, 'the Action Token is spent');
  ok(button('Shamisen 🕒'), 'the rail shows it recharging');
  await click(button('End ⏭')); await wait(120);

  // ── the rival's cursed turns ──
  await toTurnOf(RIVAL);
  ok(sheetOf(RIVAL).iwatoCurse?.turnsLeft === CURSE_TURNS, 'their first cursed turn');
  // ⭐ A line of their OWN notes (none Iwato on his root) is discord now: no Db.
  await click(button('Continue to Melody'));
  const dead = freeIdx(RIVAL).filter(i => !isIwato(sheetOf(RIVAL).noteStock[i], root0)).slice(0, 2);
  console.log(`  Rival's hand: ${sheetOf(RIVAL).noteStock.join(' ')} — playing ${dead.map(i => sheetOf(RIVAL).noteStock[i]).join(' ')}`);
  ok(dead.length === 2, 'the rival holds two non-Iwato notes to try');
  for (const i of dead) await click(document.querySelector(`[data-stock-idx="${i}"]`));
  const rivalDb = sheetOf(RIVAL).dbPoints ?? 0;
  await click(buttons().find(b => /Commit \(\d/.test(b.textContent)));
  ok((sheetOf(RIVAL).dbPoints ?? 0) === rivalDb, '⭐ cursed: a melody of their own scale earns NO Db');
  ok(sheetOf(RIVAL).iwatoCurse?.turnsLeft === CURSE_TURNS, '…and does not exorcise');
  await click(button('End ⏭')); await wait(120);
  const after1 = sheetOf(RIVAL);
  ok(after1.iwatoCurse ? after1.iwatoCurse.turnsLeft === 1 : after1.curseEnded?.how === 'exorcised',
    after1.iwatoCurse ? 'the end of their turn counts it down' : '(their two notes happened to exorcise it)');
  if (after1.iwatoCurse) {
    await toTurnOf(RIVAL);
    await plainTurn(2);
    ok(!sheetOf(RIVAL).iwatoCurse && sheetOf(RIVAL).curseEnded?.how === 'expired', 'the second cursed turn ends it — expired');
  }
  console.log(`PASS: ${checks} checks — take up (free, strings next turn), the third chord-step destination out of the shared budget, Iwato only, the cast (token, Db, cooldown, his key), the curse counted on the rival's own turn ends`);
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
process.exit(0);
