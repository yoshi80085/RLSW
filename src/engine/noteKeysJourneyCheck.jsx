// ─── ⌨️ NOTE KEYS JOURNEY — the real Game, driven from the keyboard ──────────
// `music/noteKeysCheck.mjs` proves the rules; this proves the wiring: a mounted
// match, key presses on `window`, and the engine's own note sheet as the witness.
//   chord step  — Tab picks Drive then Sustain; a letter commits to the picked
//                 stack; a letter the hand lacks changes nothing.
//   melody step — letters and Shift+letters enter the track; Backspace pulls
//                 the last one out; Ctrl chords and typing in a text field are
//                 left alone.
// Run: npm run test:notekeysjourney
import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import { parseStockNote } from '../music/noteKeys.js';
import assert from 'node:assert/strict';
import process from 'node:process';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The render shim makes window listeners no-ops. Keep a real registry for
// keydown only — everything else stays inert exactly as the other journeys see it.
const keyListeners = new Set();
const shimAdd = globalThis.addEventListener, shimRemove = globalThis.removeEventListener;
globalThis.addEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.add(fn) : shimAdd?.(type, fn, opts);
globalThis.removeEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.delete(fn) : shimRemove?.(type, fn, opts);
const press = async (key, mods = {}) => {
  const ev = { key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
    target: document.body, defaultPrevented: false, ...mods,
    preventDefault() { this.defaultPrevented = true; } };
  await act(async () => { for (const fn of [...keyListeners]) fn(ev); });
  return ev;
};
const keyFor = note => { const n = parseStockNote(note); return [n.letter.toLowerCase(), { shiftKey: n.altered }]; };

const config = buildTestingGroundsConfig({ beginnerMode: false });
config.seed = 4242;
config.spirits = config.spirits.map(spirit => ({ ...spirit, cpu: false }));
let observed = null;
const root = createRoot(document.getElementById('root'));
const click = async el => { assert.ok(el, 'click target exists'); await act(async () => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); };
const button = text => [...document.querySelectorAll('button')].find(el => el.textContent.includes(text));
const sheet = () => observed.noteStates[observed.acting];
const usedHas = (used, i) => Array.isArray(used) ? used.includes(i) : !!used?.has?.(i);
// A note to press: its FIRST unused copy must be the slot we expect to move.
const freeNotes = () => {
  const s = sheet(); const seen = new Set(); const out = [];
  s.noteStock.forEach((n, i) => {
    const k = keyFor(n).join(); if (seen.has(k)) return; seen.add(k);
    if (!usedHas(s.usedStockIdx, i)) out.push(n);
  });
  return out;
};

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}}
    onEngineState={state => { observed = state; }} />));
  ok(keyListeners.size > 0, 'the match binds a keydown listener');
  ok(observed?.acting && sheet(), 'engine state observed');
  console.log(`Mounted — ${observed.acting} holds ${sheet().noteStock.join(' ')}`);

  // ── chord step ──
  const chip = label => [...document.querySelectorAll('button.stack-chip')].find(b => b.textContent.trim() === label);
  let ev = await press('Tab');
  ok(ev.defaultPrevented, 'Tab is taken in the chord step (no focus jump)');
  ok(chip('Drive')?.getAttribute('aria-pressed') === 'true', 'first Tab picks Drive');
  await press('Tab');
  ok(chip('Sustain')?.getAttribute('aria-pressed') === 'true', 'second Tab switches to Sustain');
  const before = sheet().sustainStack.length;
  const stackNote = freeNotes()[0];
  ev = await press(...keyFor(stackNote));
  ok(ev.defaultPrevented, 'a note key is taken');
  ok(sheet().sustainStack.length === before + 1 && sheet().sustainStack.at(-1) === stackNote,
    `${stackNote} went onto the Sustain stack`);
  ok(sheet().stackCommitsThisTurn === 1, 'it spent one stack commit, like a click');
  const missing = 'ABCDEFG'.split('').find(L => !sheet().noteStock.some(n => parseStockNote(n).letter === L));
  if (missing) {
    const len = sheet().sustainStack.length;
    await press(missing.toLowerCase());
    ok(sheet().sustainStack.length === len, `${missing} is not in the hand — nothing moves`);
  }

  // ── melody step ──
  await click(button('Continue to Melody'));
  const [m1, m2] = freeNotes();
  ok(m1 && m2, 'two distinct notes left to type');
  await press(...keyFor(m1));
  await press(...keyFor(m2));
  ok(JSON.stringify(sheet().melodyLine) === JSON.stringify([m1, m2]), `typed ${m1} ${m2} into the track`);
  ok(button('Commit (2 notes'), 'the Commit button counts them');
  const altered = freeNotes().find(n => parseStockNote(n).altered);
  if (altered) {
    await press(...keyFor(altered));
    ok(sheet().melodyLine.at(-1) === altered, `Shift+${parseStockNote(altered).letter} played ${altered}`);
    await press('Backspace');
  } else console.log('  (no sharp/flat left in this hand — Shift path covered by test:notekeys)');
  ev = await press('Backspace');
  ok(ev.defaultPrevented && JSON.stringify(sheet().melodyLine) === JSON.stringify([m1]), 'Backspace pulled the last note back out');
  ok(!usedHas(sheet().usedStockIdx, sheet().noteStock.indexOf(m2)) || sheet().noteStock.filter(n => n === m2).length > 1,
    `${m2} is back in the hand`);
  const next = freeNotes()[0];
  ev = await press(keyFor(next)[0], { ctrlKey: true });
  ok(!ev.defaultPrevented && sheet().melodyLine.length === 1, 'Ctrl+letter is left to the browser');
  const input = document.createElement('input'); document.body.appendChild(input);
  ev = await press(keyFor(next)[0], { ...keyFor(next)[1], target: input });
  ok(!ev.defaultPrevented && sheet().melodyLine.length === 1, 'typing in a text field is left alone');

  console.log(`PASS: ${checks} checks — Tab stack switch, stack commit, missing letter, melody typing, Shift, Backspace, Ctrl + text-field guards`);
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
process.exit(0);
