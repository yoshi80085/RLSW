/* eslint-disable react-refresh/only-export-components -- Executable DOM test, not a hot-reloaded application module. */
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BoardViewport } from '../ui/BoardViewport.jsx';
import { MatchSurface, HudRegion } from '../ui/MatchSurface.jsx';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'HTMLCanvasElement']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? dom.window : dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// Exercise the actual Three.js constructor failure, not a replacement renderer.
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
function Fixture() {
  const [enabled, setEnabled] = useState(false);
  const [steps, setSteps] = useState(3);
  return <>
    <button onClick={() => setEnabled(true)}>3D</button>
    <BoardViewport enabled={enabled} >
      <svg><g data-hex-num="16" onClick={() => setSteps(n => n - 1)}><text>{steps} AP</text></g></svg>
    </BoardViewport>
  </>;
}
const root = createRoot(document.getElementById('root'));
const click = async element => act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
const realError = console.error;
let expectedErrors = 0;
console.error = (...args) => {
  if (args.some(arg => String(arg).includes('Error creating WebGL context'))) expectedErrors++;
  else realError(...args);
};
try {
  await act(async () => root.render(<Fixture />));
  const hex = document.querySelector('[data-hex-num]');
  await click(hex);
  assert.equal(hex.textContent, '2 AP');
  await click(document.querySelector('button'));
  for (let i = 0; i < 100 && !document.querySelector('[role="status"]')?.textContent.includes('unavailable'); i++) {
    await act(async () => new Promise(resolve => setTimeout(resolve, 10)));
  }
  assert.match(document.querySelector('[role="status"]')?.textContent ?? '', /3D unavailable/);
  assert.equal(expectedErrors, 1, 'actual WebGL initialization was refused');
  assert.equal([...document.querySelectorAll('button')].some(el => el.textContent === '2D board'), false);
  const back = [...document.querySelectorAll('button')].find(el => el.textContent === 'Retry arena');
  await click(back);
  for (let i = 0; i < 100 && expectedErrors < 2; i++) {
    await act(async () => new Promise(resolve => setTimeout(resolve, 10)));
  }
  assert.equal(expectedErrors, 2, 'retry attempts a fresh renderer');
  assert.equal(document.querySelector('[data-board-view]').dataset.boardView, '3d');
  assert.equal(document.querySelector('[data-hex-num]'), hex, 'retry preserves the same live board node');
  assert.equal(hex.textContent, '2 AP', 'retry preserves game state');
  await click(hex);
  assert.equal(hex.textContent, '1 AP', 'targeting remains mounted after retry');
  assert.equal(document.querySelector('canvas'), null, 'failed startup leaves no canvas behind');
  console.log('PASS: actual WebGL failure, 3D retry, no 2D switch, same board/state, no canvas leak');

  // Revisit the SAME spirit/phase on a later turn: an old drawer choice must
  // not resurface. No WebGL needed for this layout ownership contract.
  const surface = (turnNumber, tutorial = false) => <MatchSurface immersive
    spirit={{ id: 'ronin', name: 'Ronin', color: '#7fe0ff' }} turnNumber={turnNumber} step="chord" canAct tutorial={tutorial}
    hud={{ vibe: 4, maxVibe: 5, drive: 6, sustain: 3, db: 8, fans: 5, noteCount: 9 }}>
    <HudRegion name="turn"><input defaultValue="draft" /></HudRegion>
    <HudRegion name="spirit">Details</HudRegion>
    <HudRegion name="rivals">Rivals</HudRegion>
  </MatchSurface>;
  await act(async () => root.render(surface(1)));
  const draft = document.querySelector('input');
  assert.equal(document.querySelector('[data-match-step]').dataset.matchStep, 'chord', 'surface exposes its phase to the HUD skin');
  assert.match(document.querySelector('.match-player-pocket').textContent, /Ronin.*VIBE 4\/5.*DRIVE6.*SUSTAIN3.*Db8.*FANS5/s,
    'compact player pocket reads authoritative live values');
  assert.match(document.querySelector('.match-phase-rail [data-state="now"]').textContent, /BUILD CHORD/i,
    'phase rail marks the live step');
  // 🪦 THIS USED TO READ '.match-turn-summary' — the NOW window, retired
  // 2026-09-12. Its headline was the step name, which the rail below and the
  // step-3 drawer were both already printing; only its two LIVE facts survived,
  // onto the rail's active step. So the contract moves with them rather than
  // being deleted: something must still report the live hand without copying a
  // control, and now it is the step you are on that says so.
  assert.match(document.querySelector('.match-phase-rail [data-state="now"]').textContent, /9 notes available/,
    'the live step carries the hand count the NOW window used to');
  assert.equal(document.querySelector('.match-turn-summary'), null,
    'the retired NOW window stays retired');
  // 🎡 2026-09-25: the nav's middle chip is Scale (the wheel toggle) now; the
  // Spirit details are reached from the SPIRIT card's ＋ instead.
  assert.deepEqual([...document.querySelectorAll('[aria-label="Arena panels"] button')].map(b => b.textContent),
    ['Turn', 'Scale', 'Rivals'], 'nav reads Turn · Scale · Rivals');
  await click(document.querySelector('.match-player-card'));
  assert.equal(document.querySelector('[data-hud-region="turn"]').hidden, true);
  await act(async () => root.render(surface(4)));
  assert.equal(document.querySelector('[data-hud-region="turn"]').hidden, false, 'later turn of same spirit opens Turn');
  assert.equal(document.querySelector('input'), draft, 'new turn disclosure preserves mounted children');
  await act(async () => root.render(surface(4, true)));
  for (const region of document.querySelectorAll('[data-hud-region]')) assert.equal(region.hidden, false, 'tutorial anchors are disclosed');
  console.log('PASS: repeated spirit/phase resets disclosure, stable controls, tutorial access');
} finally {
  await act(async () => root.unmount());
  console.error = realError;
  dom.window.close();
}
