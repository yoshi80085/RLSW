// ─── ⌨️ NUMPAD JOURNEY — the real Game, walked from the numpad ───────────────
// Alex, 2026-09-30: "the numlock numbers can move the spirit. So 8 is up, 2 is
// down … 7, 9, 1, and 3 are diagonal." `board/standeeMoveCheck.mjs` §5 proves
// the mapping; this proves the wiring: a mounted match, keys on `window`, and
// the ENGINE's own spirit position as the witness.
//   · nothing moves before the Move & Act step;
//   · Numpad8 / 2 / 9 / 3 / 7 / 1 each take exactly one step to the neighbour
//     `numpadTarget` names, and spend one step of the budget, like a click;
//   · Numpad4 / 6, the top-row 8, a held (auto-repeating) key and a key typed
//     into a text field move nothing.
// Run: npm run test:numpadjourney
import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import { parseStockNote } from '../music/noteKeys.js';
import { numpadTarget } from '../ui/numpadMove.js';
import { HEX_BY_NUM } from '../board/hexMap.js';
import assert from 'node:assert/strict';
import process from 'node:process';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The render shim makes window listeners no-ops; keep a real registry for keydown.
const keyListeners = new Set();
const shimAdd = globalThis.addEventListener, shimRemove = globalThis.removeEventListener;
globalThis.addEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.add(fn) : shimAdd?.(type, fn, opts);
globalThis.removeEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.delete(fn) : shimRemove?.(type, fn, opts);
const press = async (code, mods = {}) => {
  const key = code.startsWith('Numpad') ? code.slice(6) : code.startsWith('Digit') ? code.slice(5) : code;
  const ev = { code, key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
    target: document.body, defaultPrevented: false, ...mods, preventDefault() { this.defaultPrevented = true; } };
  await act(async () => { for (const fn of [...keyListeners]) fn(ev); });
  return ev;
};
const letter = note => { const n = parseStockNote(note); return [n.letter.toLowerCase(), { shiftKey: n.altered }]; };
const settle = ms => act(async () => { await new Promise(r => setTimeout(r, ms)); });

const config = buildTestingGroundsConfig({ beginnerMode: false });
config.seed = 4242;
config.spirits = config.spirits.map(spirit => ({ ...spirit, cpu: false }));
let observed = null;
const root = createRoot(document.getElementById('root'));
const me = () => observed.spirits.find(s => s.id === observed.acting);
const sheet = () => observed.noteStates?.[observed.acting];

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}}
    onEngineState={state => { observed = state; }} />));
  ok(observed?.acting && me(), 'engine state observed');
  const start = me().num;

  // ── nothing moves in the chord or melody step ──
  let ev = await press('Numpad8');
  ok(!ev.defaultPrevented && me().num === start, 'Numpad8 in the chord step does nothing (the step is not Move & Act)');

  // ── get to Move & Act the way a player does: Continue, one note, Commit ──
  await press('Enter');
    // Four notes — a longer line (the budget is the melody's to give).
  for (let k = 0; k < 4; k++) {
    const u = sheet().usedStockIdx, used2 = i => Array.isArray(u) ? u.includes(i) : !!u?.has?.(i);
    const free = sheet().noteStock.find((n, i) => !used2(i));
    if (free) await press(letter(free)[0], letter(free)[1]);
  }
  await press('Enter');
  await settle(1200);
  ok(sheet().hasConfirmed, 'the melody is committed — the turn is in Move & Act');
  const budget = observed.turn.moveStepsLeft;
  ok(budget >= 1, `there are steps to spend (${budget})`);

  // ── the guards ──
  for (const [code, mods, why] of [['Numpad4', {}, '4 (no left neighbour)'], ['Numpad6', {}, '6 (no right neighbour)'],
    ['Numpad5', {}, '5 (🧭 face north — turns the camera, never the Spirit)'],
    ['Digit8', {}, 'the top-row 8'], ['Numpad8', { repeat: true }, 'a held, auto-repeating 8'],
    ['Numpad8', { target: Object.assign(document.createElement('input'), {}) }, '8 typed into a text field']]) {
    const at = me().num;
    ev = await press(code, mods);
    ok(me().num === at && observed.turn.moveStepsLeft === budget, `${why} moves nothing`);
  }

  // ── each direction: one step, to the neighbour the key names ──
  let spent = 0;
  for (const code of ['Numpad8', 'Numpad3', 'Numpad2', 'Numpad7']) {
    if (observed.turn.moveStepsLeft < 1) break;
    const from = HEX_BY_NUM[me().num], want = numpadTarget(code, from);
    const occupied = want && observed.spirits.some(s => s.num === want.num && s.id !== observed.acting);
    ev = await press(code);
    await settle(50);
    ok(ev.defaultPrevented, `${code} is taken (no page scroll)`);
    if (!want || occupied) { ok(me().num === from.num, `${code}: nothing that way — it stays put`); continue; }
    spent++;
    ok(me().num === want.num, `${code} stepped ${from.num} → ${want.num}`);
    ok(observed.turn.moveStepsLeft === budget - spent, `…and spent one step, like a click (${observed.turn.moveStepsLeft} left)`);
  }
  ok(spent >= 1, `numpad steps were taken (${spent})`);
  console.log(`  walked ${spent} step(s) of ${budget} by numpad`);
  if (observed.turn.moveStepsLeft === 0) {
    const at = me().num;
    await press('Numpad2'); await settle(50);
    ok(me().num === at, 'with no steps left, a key moves nothing (the budget holds for keys too)');
  }

  console.log(`PASS: ${checks} checks — Move & Act only, 4/6 / top-row / auto-repeat / text-field guards, each key one step to its neighbour, one step of budget each`);
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
process.exit(0);
