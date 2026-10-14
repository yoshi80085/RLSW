// ─── 🎮 PAD JOURNEY — the real Game, a turn played from a controller ────────
// `input/gamepadCheck.mjs` proves the map and the runtime against stubs; this
// proves the WIRING: a mounted match, a fake Gamepad polled by the real runtime
// (`createPadRuntime`), its keys delivered to the window's real keydown
// listeners, and the ENGINE as the witness.
//   · Y = Continue (Chord Stack → Melody) · Y = ✓ Commit · left stick = a step
//     · Y = End turn — the same three Enters a keyboard player presses;
//   · holding Y never double-fires (Commit does not run on into End turn);
//   · the stick walks one hex per push, toward screen-up (no arena here, so the
//     lens heading is 0 and up = north = Numpad8's neighbour).
// 📌 The notes are TYPED: picking a chip from the hand takes the on-screen
// highlight, and this DOM has no layout to aim it with (`gamepadCheck` §8 tests
// the highlight with a stubbed one).
// Run: npm run test:padjourney
import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import { parseStockNote } from '../music/noteKeys.js';
import { numpadTarget } from '../ui/numpadMove.js';
import { HEX_BY_NUM } from '../board/hexMap.js';
import { createPadRuntime } from '../input/gamepad.js';
import { PAD_BUTTONS } from '../input/padMap.js';
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
const delivered = [];
const fire = (key, code, mods = {}) => {
  const ev = { key, code, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
    target: document.body, defaultPrevented: false, ...mods, preventDefault() { this.defaultPrevented = true; } };
  for (const fn of [...keyListeners]) fn(ev);
  return ev;
};

// ── the controller ──
let held = [], stick = [0, 0];
const gamepad = () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  for (const n of held) buttons[PAD_BUTTONS[n]] = { pressed: true, value: 1 };
  return { index: 0, connected: true, mapping: 'standard', buttons, axes: [...stick, 0, 0] };
};
const runtime = createPadRuntime({
  getPads: () => [gamepad()],
  sendKey: (type, k) => { if (type === 'keydown') { delivered.push(k.code); fire(k.key, k.code); } },
  focus: null, camera: () => null, layer: () => 'turn',
});
let clock = 0;
const poll = async (ms = 8) => { clock += ms; await act(async () => runtime.tick(clock)); };
const tapButton = async name => { held = [name]; await poll(); await poll(); held = []; await poll(); };
const settle = ms => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const letter = note => { const n = parseStockNote(note); return [n.letter.toLowerCase(), { shiftKey: n.altered }]; };

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
  await poll(); await poll();   // the pad wakes with nothing held
  const first = observed.acting;

  // ── Y: Continue to Melody ──
  await tapButton('Y');
  ok(delivered.filter(c => c === 'Enter').length === 1, 'Y sent exactly one Enter');
  // ── the notes (typed — see the header) ──
  for (let k = 0; k < 4; k++) {
    const u = sheet().usedStockIdx, used = i => Array.isArray(u) ? u.includes(i) : !!u?.has?.(i);
    const free = sheet().noteStock.find((n, i) => !used(i));
    if (free) await act(async () => { const [l, m] = letter(free); fire(l, `Key${l.toUpperCase()}`, m); });
  }
  const line = sheet().melodyLine?.length ?? sheet().melodyTrack?.length;
  ok(!sheet().hasConfirmed, `notes are on the Melody step, not yet committed${line != null ? ` (${line})` : ''} — so Y #1 really did Continue`);

  // ── Y held: Commit, and ONLY commit ──
  held = ['Y']; await poll(); for (let i = 0; i < 30; i++) await poll(16); held = []; await poll();
  await settle(1200);
  ok(sheet().hasConfirmed, 'Y = ✓ Commit — the melody is in, the turn is in Move & Act');
  ok(observed.acting === first, 'HOLDING Y did not run on into End turn (the pad never auto-repeats a key)');
  const budget = observed.turn.moveStepsLeft;
  ok(budget >= 1, `there are steps to spend (${budget})`);

  // ── left stick up: one step north, per push ──
  const from = HEX_BY_NUM[me().num], want = numpadTarget('Numpad8', from);
  stick = [0, -1]; await poll(); stick = [0, 0]; await poll(); await settle(50);
  if (want && !observed.spirits.some(s => s.num === want.num && s.id !== first)) {
    ok(me().num === want.num, `the stick pushed up walked ${from.num} → ${want.num} (Numpad8's neighbour)`);
    ok(observed.turn.moveStepsLeft === budget - 1, 'one push, one step of budget — like a click');
  } else {
    ok(me().num === from.num, 'nothing north to step onto: the stick walks nowhere');
  }
  const at = me().num, left = observed.turn.moveStepsLeft;
  stick = [0, -.4]; await poll(); stick = [0, 0]; await poll();
  ok(me().num === at && observed.turn.moveStepsLeft === left, 'a stick nudged only part way (under the flick) walks nowhere');

  // ── Y: End turn ──
  await tapButton('Y');
  await settle(800);
  ok(observed.acting !== first, `the turn passed (${first} → ${observed.acting})`);
  console.log(`PASS: ${checks} checks — Y Continue / Commit / End turn through the real handlers, a held Y fires once, the stick walks one hex per push`);
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
process.exit(0);
