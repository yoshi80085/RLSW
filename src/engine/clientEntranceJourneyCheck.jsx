// ─── 🎸 THE OPENING ACT, MOUNTED ─────────────────────────────────────────────
// `test:entrancejourney` — the real `Game`, a normal 4-seat match with the
// opening act on (as the lobby starts one), driven by clicks:
//   · with no 3D arena (jsdom) the intro gives the board straight back
//   · only seat one is on stage, with two fans; the rest wait off the board
//   · seat one parked right beside seat two's home hex cannot step onto it —
//     the tile is not lit and a click on it moves nothing
//   · no attack can reach a Spirit that has not entered
//   · ending the turn brings seat two on, onto its home hex, with two fans
// ⚠️ jsdom has no WebGL, so the arena reports itself unavailable and the intro
// never starts. Its overlay, ⏭ Skip and the 3D half are checked in Chromium
// (see SEQUENCING §A).
import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import assert from 'node:assert/strict';
import process from 'node:process';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { SPIRIT_DEFS, PLAYABLE_ORDER } from '../data/spirits.js';
import { cornersForCount, seatSpirit } from '../data/matchSetup.js';
import { seatId } from '../data/spiritIdentity.js';
import { HEX_BY_NUM, HEX_BY_QR } from '../board/hexMap.js';
import { axialNeighbors } from '../board/hexGeometry.js';
import { CORNERS } from '../data/corners.js';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const realSetTimeout = globalThis.setTimeout;
// The render shim makes window listeners no-ops; keep a real registry for keydown
// (the noteKeysJourney pattern).
const keyListeners = new Set();
const shimAdd = globalThis.addEventListener, shimRemove = globalThis.removeEventListener;
globalThis.addEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.add(fn) : shimAdd?.(type, fn, opts);
globalThis.removeEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.delete(fn) : shimRemove?.(type, fn, opts);
let n = 0;
const ok = (v, m) => { assert.ok(v, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// The lobby's own seat shape (Lobby.jsx handleStart), four humans.
const spirits = cornersForCount(4).map((corner, i) => {
  const def = SPIRIT_DEFS[PLAYABLE_ORDER[i % PLAYABLE_ORDER.length]];
  return { ...seatSpirit(def, corner, { cpu: false }), id: seatId(def.id, corner), characterId: def.id };
});
// Seat one is parked right beside seat two's home hex — the reservation's test.
const reserved = CORNERS[spirits[1].corner].homeNum;
const rh = HEX_BY_NUM[reserved];
const beside = axialNeighbors(rh.q, rh.r).map(({ q, r }) => HEX_BY_QR[`${q},${r}`]).find(Boolean);
spirits[0] = { ...spirits[0], num: beside.num };
const config = { spirits, mode: 'ffa', teams: null, startingLives: 3, beginnerMode: false,
  winCondition: 'rounds', roundLimit: 10, openingAct: true, seed: 4242 };

let state = null;
const root = createRoot(document.getElementById('root'));
const button = text => [...document.querySelectorAll('button')].find(el => el.textContent.includes(text));
const click = async element => {
  assert.ok(element, 'click target exists');
  await act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
};
const key = async k => {
  const ev = { key: k, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
    target: document.body, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} };
  await act(async () => { for (const fn of [...keyListeners]) fn(ev); });
  return ev;
};
const settle = ms => act(async () => new Promise(r => realSetTimeout(r, ms)));
const sp = id => state.spirits.find(s => s.id === id);
const [one, two, three, four] = spirits.map(s => s.id);

try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}} onEngineState={s => { state = s; }} />));
  await settle(20);
  // ── No 3D here, so the intro gives the board straight back ───────────────
  // (jsdom has no WebGL: BoardViewport reports the arena unavailable and the
  // client gives the intro up — the same path a browser without WebGL takes.
  // The intro itself, its overlay and ⏭ Skip are checked in Chromium.)
  for (let i = 0; i < 100 && document.querySelector('[data-opening-act]'); i++) await settle(20);
  eq(document.querySelector('[data-opening-act]'), null, 'without a 3D arena the intro gives the board back');
  eq(document.body.dataset.openingLive, undefined, '…and the HUD is not left hidden');
  eq(sp(one).num, beside.num, 'seat one is on stage from the start');
  eq(state.noteStates[one].diehards, 2, '…with its two fans');
  for (const id of [two, three, four]) {
    eq(sp(id).num, null, `${id} waits off the board`);
    eq(state.noteStates[id].diehards, 0, `${id} has no fans yet`);
  }
  eq(state.turn.lastEntrance?.spiritId, one, 'seat one\'s entrance is on the report for the theatre');

  // ── Seat one's turn: walk up to the reserved hex ──────────────────────────
  await click(button('Continue to Melody'));
  const notes = [...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')]
    .map(svg => svg.parentElement).filter(el => el.style.cursor === 'pointer');
  for (const note of notes.slice(0, 3)) await click(note);
  await click(button('Commit ('));
  ok(document.querySelector('[data-tip-anchor="end-turn"]'), 'seat one reaches Move & Act');
  const lit = [...document.querySelectorAll('[data-move-tile]')].map(el => Number(el.closest('[data-hex-num]')?.dataset.hexNum));
  ok(lit.length > 0, 'seat one has lit move tiles');
  ok(!lit.includes(reserved), 'seat two\'s reserved home hex is not lit');
  const steps = state.turn.moveStepsLeft;
  await click(document.querySelector(`[data-hex-num="${reserved}"]`));
  eq(sp(one).num, beside.num, 'a click on the reserved hex moves nothing');
  eq(state.turn.moveStepsLeft, steps, '…and costs nothing');
  // No attack of any kind can name a Spirit that has not entered.
  for (const label of ['Sonic', 'Thrash']) {
    const b = button(label);
    if (b && !b.disabled) { await click(b); await click(document.querySelector(`[data-hex-num="${reserved}"]`)); await key('Escape'); }
  }
  for (const id of [two, three, four]) {
    eq(sp(id).vibe, spirits.find(s => s.id === id).vibe ?? sp(id).maxVibe, `${id} took nothing while waiting`);
    eq(sp(id).num, null, `${id} is still off the board`);
  }

  // ── Seat two's first turn: it enters ──────────────────────────────────────
  await click(document.querySelector('[data-tip-anchor="end-turn"]'));
  await settle(50);
  eq(state.acting, two, 'seat two acts next');
  eq(sp(two).num, reserved, 'seat two stepped onto its home hex');
  eq(state.noteStates[two].diehards, 2, '…and gained exactly two fans');
  eq(state.turn.lastEntrance?.spiritId, two, '…and its entrance was reported');
  for (const id of [three, four]) eq(sp(id).num, null, `${id} still waits`);
  ok(button('Continue to Melody'), 'seat two gets a normal first turn');
  console.log(`PASS: opening act mounted — ${n} checks: no-3D intro gives way, seat one on stage with two fans, the reserved hex unlit and unclickable, nobody waiting touched, seat two enters with two fans`);
} catch (e) {
  console.error(e); process.exitCode = 1;
} finally {
  await act(async () => root.unmount());
  process.exit(process.exitCode ?? 0);
}
