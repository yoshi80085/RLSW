import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import assert from 'node:assert/strict';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const realInterval = globalThis.setInterval, realClear = globalThis.clearInterval;
const realNow = performance.now;
let now = realNow.call(performance), clockCallback = null;
performance.now = () => now;
globalThis.setInterval = (fn, delay, ...args) => {
  if (delay === 250 && String(fn).includes('batClockCallbackRef')) { clockCallback = fn; return -5150; }
  return realInterval(fn, delay, ...args);
};
globalThis.clearInterval = id => { if (id !== -5150) realClear(id); };
const advance = async ms => {
  for (let t = 0; t < ms; t += 250) await act(async () => { now += 250; clockCallback(); });
};
const click = async el => { assert.ok(el, 'control exists'); await act(async () => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); };
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text));
const config = buildTestingGroundsConfig({ beginnerMode: false });
config.seed = 5150; config.spirits = config.spirits.map(s => ({ ...s, cpu: false }));
let observed;
const root = createRoot(document.getElementById('root'));
let checks = 0;
const ok = (value, label) => { assert.ok(value, label); checks++; };
try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}} onEngineState={s => { observed = s; }} />));
  await click(button('🧪 TEST'));
  await click(button('Bats'));
  ok(observed.stageFx.bats.bats.length === 4, 'Testing Grounds activates four bats');
  await click(button('🧪 CLOSE'));
  ok(document.body.textContent.includes('BATS ×4'), 'bat status visible');
  const starting = observed.stageFx.bats.bats.map(b => b.num).join(',');
  await advance(29000);
  ok(observed.stageFx.bats.bats.map(b => b.num).join(',') === starting, 'real Game holds bats for 29 seconds');
  await advance(1000);
  ok(observed.stageFx.lastBats?.event === 'flew', `real Game moves bats at 30 seconds (elapsed=${observed.stageFx.bats.elapsedMs}, tick=${observed.stageFx.bats.tick})`);
  ok(observed.stageFx.lastBats.moves.length === 4, 'four bats fly on the timer');
  const tick = observed.stageFx.bats.tick;
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  await advance(60000);
  ok(observed.stageFx.bats.tick === tick, 'hidden-tab time is paused');
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  await advance(1000);
  ok(observed.stageFx.bats.elapsedMs === 1000, 'return has no backlog of movement');
  console.log(`✅ batsJourneyCheck: ${checks} checks passed`);
} finally {
  await act(async () => root.unmount());
  globalThis.setInterval = realInterval; globalThis.clearInterval = realClear; performance.now = realNow;
}
process.exit(0);
