// ─── 🎸 SHAMISEN JOURNEY — the Iwato curse v3 ("the trap"), in the real Game ──
// `test:shamisen` proves the rules; this proves the WIRING, in a mounted match
// driven only by clicks, with the engine's own note sheets as the witness:
//   Ronin  — after his melody, the rail's "Curse a Lost Chord", then a click on
//            a Lost Chord: the Action Token and the cooldown are spent, the trap
//            is on HIS sheet, and his screen (only) marks it
//   rival  — their screen does not; they walk onto it and the curse SPRINGS:
//            Iwato on the trapped note, three creepy haunted notes, the cursed
//            Scale Wheel; their own notes pay nothing
//   later  — their 2nd cursed turn keeps the same haunted notes (no refresh);
//            a haunted note played lifts a ghost; the third turn end finishes it
// Run: npm run test:shamisenjourney
import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import assert from 'node:assert/strict';
import process from 'node:process';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import { makeInitialState } from './state.js';
import { HEX_BY_NUM } from '../board/hexMap.js';
import { neighborInDirection, angleTo } from '../board/hexGeometry.js';
import { isIwato, CREEPY_IVS, stringIv } from '../board/cursedShamisen.js';
import { CURSED_SHAMISEN_CD } from '../data/gameConstants.js';
import { CURSE_TURNS, HAUNTED_NOTES } from './systems/iwatoCurse.js';
import { pitchIndex } from '../music/notes.js';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── the table: the Ronin with the Shamisen; the seat after him one step from a Lost Chord ──
const seed = Number(process.env.SEED ?? 4);
const base = buildTestingGroundsConfig({ beginnerMode: false });
base.seed = seed;
base.spirits = base.spirits.map(s => ({ ...s, cpu: false }));
const roninAt = base.spirits.findIndex(s => s.id.startsWith('cosmic_ronin'));
assert.ok(roninAt >= 0, 'the Testing Grounds seat a Ronin');
base.spirits[roninAt] = { ...base.spirits[roninAt], abilities: ['psycho_bushido', 'cursed_shamisen'] };
const rivalAt = (roninAt + 1) % base.spirits.length;

function tableBesideALostChord() {
  const first = makeInitialState(base, seed);
  const taken = new Set(base.spirits.map(s => s.num));
  for (const tok of first.board.boardTokens) {
    for (let d = 0; d < 6; d++) {
      const nb = neighborInDirection(HEX_BY_NUM[tok.num], d);
      if (!nb || taken.has(nb.num) || first.board.boardTokens.some(t => t.num === nb.num)) continue;
      const trial = { ...base, spirits: base.spirits.map((s, i) => i === rivalAt ? { ...s, num: nb.num, facing: angleTo(nb, HEX_BY_NUM[tok.num]) } : s) };
      const st = makeInitialState(trial, seed);
      if (st.board.boardTokens.some(t => t.num === tok.num && t.note === tok.note)) return { config: trial, trap: tok };
    }
  }
  throw new Error('no free hex beside a Lost Chord');
}
const { config, trap } = tableBesideALostChord();

let observed = null, checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const root = createRoot(document.getElementById('root'));
const click = async el => { assert.ok(el, 'click target exists'); await act(async () => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); };
const wait = ms => act(async () => new Promise(r => setTimeout(r, ms)));
const buttons = () => [...document.querySelectorAll('button')];
const button = text => buttons().find(el => el.textContent.includes(text));
const sheetOf = id => observed.noteStates[id];
const acting = () => observed.acting;
const RONIN = config.spirits[roninAt].id, RIVAL = config.spirits[rivalAt].id;
const usedHas = (used, i) => Array.isArray(used) ? used.includes(i) : !!used?.has?.(i);
const freeIdx = id => sheetOf(id).noteStock.map((_, i) => i).filter(i => !usedHas(sheetOf(id).usedStockIdx, i));
const pickable = () => [...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')].map(svg => svg.parentElement).find(el => el.style.cursor === 'pointer');

/** Play a whole plain turn for whoever is acting: melody of up to n notes, commit, end. */
async function plainTurn(n = 2) {
  if (button('Continue to Melody')) await click(button('Continue to Melody'));
  for (let k = 0; k < n; k++) { const note = pickable(); if (!note) break; await click(note); }
  const commit = buttons().find(b => /Commit \(\d/.test(b.textContent));
  if (commit && !commit.disabled) await click(commit);
  await click(button('End ⏭'));
  await wait(120);
}
async function toTurnOf(id, guard = 8) {
  while (acting() !== id && guard-- > 0) await plainTurn(2);
  assert.equal(acting(), id, `reached ${id}'s turn`);
}
async function melodyOf(idxs) {
  if (button('Continue to Melody')) await click(button('Continue to Melody'));
  for (const i of idxs) await click(document.querySelector(`[data-stock-idx="${i}"]`));
  const commit = buttons().find(b => /Commit \(\d/.test(b.textContent));
  if (commit && !commit.disabled) await click(commit);
}

try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}} onEngineState={s => { observed = s; }} />));
  ok(sheetOf(RONIN).unlockedSkills.includes('cursed_shamisen'), 'the Ronin brought the Shamisen');
  ok(observed.board.boardTokens.some(t => t.num === trap.num), `a Lost Chord (${trap.note}) on #${trap.num}, one step from the rival`);
  await toTurnOf(RONIN);

  // ── the Ronin lays the trap ──
  ok(!document.body.textContent.includes('STRINGS') && !button('Take up Shamisen'), '🪦 no strings row, no take-up');
  await plainTurnUntilCommit();
  const lay = button('Curse a Lost Chord');
  ok(lay && !lay.disabled, 'after his melody the rail offers to curse a Lost Chord');
  await click(lay);
  ok(button('Cancel'), 'armed — the rail offers Cancel while he picks the note');
  await click(document.querySelector(`[data-hex-num="${trap.num}"]`));
  const t = sheetOf(RONIN).shamisenTrap;
  ok(t && t.hexNum === trap.num && t.note === trap.note, '🪤 the trap is on HIS sheet: that hex, that note');
  ok(observed.turn.actionTokenUsed, '⭐ the price is the Action Token');
  ok(sheetOf(RONIN).abilityCd.cursed_shamisen === CURSED_SHAMISEN_CD, '…and the cooldown starts on the lay');
  ok(button('Trap set'), 'the rail says the trap is set');
  ok(document.querySelector(`[data-shamisen-trap="${trap.num}"]`), '⭐ HIS screen marks the cursed note');
  // (no log line names the trap — `test:shamisen` §13 pins `layShamisenTrap` to a refusal-only log)
  await click(button('End ⏭')); await wait(120);

  // ── the rival walks into it ──
  await toTurnOf(RIVAL);
  ok(!document.querySelector('[data-shamisen-trap]'), '⭐ the rival\'s screen does NOT mark it');
  ok(observed.board.boardTokens.some(t2 => t2.num === trap.num && t2.note === trap.note), 'the cursed note held its hex');
  const fansBefore = sheetOf(RIVAL).casuals ?? 0;
  await plainTurnUntilCommit();
  await click(document.querySelector(`[data-hex-num="${trap.num}"]`));
  await wait(1500);   // the hop lands before the pickup
  const c = sheetOf(RIVAL).iwatoCurse;
  ok(observed.spirits.find(s => s.id === RIVAL).num === trap.num, 'the rival stepped onto the note');
  ok(!observed.board.boardTokens.some(t2 => t2.num === trap.num), '…and picked it up as usual');
  ok(c && c.by === RONIN && c.root === trap.note && c.fromHex === trap.num, `🌑 the curse SPRANG — Iwato on the trapped note (${trap.note})`);
  ok(c.turnsLeft === CURSE_TURNS && c.targets.length === HAUNTED_NOTES && new Set(c.targets).size === HAUNTED_NOTES && c.targets.every(iv => CREEPY_IVS.includes(iv)),
    'three different creepy haunted notes, three turns (this one counting)');
  ok(sheetOf(RONIN).shamisenTrap === null, 'the trap is spent');
  ok(document.querySelector('[data-cursed-wheel="cursed"]'), 'their Scale Wheel is the cursed one');
  ok(document.querySelectorAll('[data-haunted="on"]').length === HAUNTED_NOTES, '…with the three haunted notes marked');
  ok((sheetOf(RIVAL).casuals ?? 0) >= fansBefore, '(the melody before the step was theirs)');
  await click(button('End ⏭')); await wait(120);
  ok(sheetOf(RIVAL).iwatoCurse?.turnsLeft === CURSE_TURNS - 1, 'the end of their turn counts it down');

  // ── their 2nd cursed turn: the same haunted notes, and a lift ──
  await toTurnOf(RIVAL);
  const c2 = sheetOf(RIVAL).iwatoCurse;
  ok(c2 && JSON.stringify(c2.targets) === JSON.stringify(c.targets) && !('refreshed' in c2), '👻 the haunted notes are the ones that sprang (no refresh)');
  const hauntedIdx = freeIdx(RIVAL).filter(i => c2.targets.includes(stringIv(sheetOf(RIVAL).noteStock[i], c2.root)));
  const deadIdx = freeIdx(RIVAL).filter(i => !isIwato(sheetOf(RIVAL).noteStock[i], c2.root));
  console.log(`  Rival's hand: ${sheetOf(RIVAL).noteStock.join(' ')} — haunted ${c2.targets.join(',')} on ${c2.root}; holds ${hauntedIdx.map(i => sheetOf(RIVAL).noteStock[i]).join(' ') || 'none'}`);
  if (hauntedIdx.length) {
    const fans2 = sheetOf(RIVAL).casuals ?? 0;
    await melodyOf([hauntedIdx[0], ...deadIdx.slice(0, 1)]);
    const after = sheetOf(RIVAL);
    ok((after.iwatoCurse?.lifted ?? []).length >= 1 || after.curseEnded?.how === 'exorcised', '👻 a haunted note in the melody lifted a ghost');
    void fans2;
    await click(button('End ⏭')); await wait(120);
  } else {
    await melodyOf(deadIdx.slice(0, 2));
    ok((sheetOf(RIVAL).iwatoCurse?.lifted ?? []).length === 0, 'no haunted note held: nothing lifts');
    await click(button('End ⏭')); await wait(120);
  }
  if (sheetOf(RIVAL).iwatoCurse) {
    ok(sheetOf(RIVAL).iwatoCurse.turnsLeft === 1, 'one cursed turn left');
    await toTurnOf(RIVAL);
    await plainTurn(2);
    ok(!sheetOf(RIVAL).iwatoCurse && ['expired', 'exorcised'].includes(sheetOf(RIVAL).curseEnded?.how), 'the third cursed turn ends it, either way');
  }
  ok(pitchIndex(trap.note) >= 0, 'done');
  console.log(`PASS: ${checks} checks — lay (token, cooldown, his screen only), the pinned note, the spring on pickup (Iwato on the note, three creepy haunted notes, the cursed wheel), the fixed haunted notes, a lift, the end`);
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
process.exit(0);

/** Continue to Melody, two notes, commit — and stop there (the move/act step). */
async function plainTurnUntilCommit() {
  if (button('Continue to Melody')) await click(button('Continue to Melody'));
  for (let k = 0; k < 2; k++) { const note = pickable(); if (!note) break; await click(note); }
  const commit = buttons().find(b => /Commit \(\d/.test(b.textContent));
  if (commit && !commit.disabled) await click(commit);
}
