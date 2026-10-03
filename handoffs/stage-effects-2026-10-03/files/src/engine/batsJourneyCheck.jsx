import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import assert from 'node:assert/strict';
import process from 'node:process';
import { ALL_HEXES, HEX_BY_NUM } from '../board/hexMap.js';
import { axialDist } from '../board/hexGeometry.js';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const oscillator = AudioContext.prototype.createOscillator;
AudioContext.prototype.createOscillator = function () {
  const o = oscillator.call(this);
  o.frequency.exponentialRampToValueAtTime = () => {};
  o.frequency.linearRampToValueAtTime = () => {};
  return o;
};
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
  const id = observed.acting, bat = observed.stageFx.bats.bats[0];
  const fansBefore = observed.noteStates[id].casuals;
  const vibeBefore = observed.spirits.find(s => s.id === id).vibe;
  await click(button('🧪 TEST'));
  await click([...document.querySelector(`[data-tg-seat="${id}"]`).querySelectorAll('button')].find(b => b.textContent.includes('Drop')));
  await click(button('🧪 CLOSE'));
  await click(document.querySelector(`[data-hex-num="${bat.num}"]`));
  ok(observed.noteStates[id].casuals === fansBefore + 2, 'board entry awards two fans in the live game');
  ok(observed.spirits.find(s => s.id === id).vibe === vibeBefore, 'eating a bat costs no Vibe');
  ok(observed.stageFx.bats.bats.length === 4 && !observed.stageFx.bats.bats.some(b => b.num === bat.num), 'eaten bat respawns clear of the Spirit');
  ok(document.body.textContent.includes('+2 FANS!'), 'eating feedback flashes on the board');
  const elapsed = observed.stageFx.bats.elapsedMs;
  await click(button('🧪 TEST'));
  await click(button('Move & Act'));
  await click(button('🧪 CLOSE'));
  await click(document.querySelector('[data-tip-anchor="end-turn"]'));
  ok(observed.stageFx.turnTiming[id]?.totalMs >= 31000, 'the live game records decision time when the turn ends');
  ok(observed.stageFx.bats.elapsedMs === elapsed, 'ending a turn preserves the bat clock');
  const victimId = observed.acting, hunter = observed.stageFx.bats.bats[0];
  const hunterHex = HEX_BY_NUM[hunter.num];
  const occupied = new Set([...observed.spirits.filter(s => s.id !== victimId).map(s => s.num),
    ...observed.stageFx.bats.bats.map(b => b.num), ...observed.stageFx.bats.obstacles]);
  const adjacent = ALL_HEXES.find(h => !occupied.has(h.num) && axialDist(h.q, h.r, hunterHex.q, hunterHex.r) === 1);
  ok(adjacent, 'a clear hex next to the bat is available');
  await click(button('🧪 TEST'));
  await click(button('+3 FP'));
  await click([...document.querySelector(`[data-tg-seat="${victimId}"]`).querySelectorAll('button')].find(b => b.textContent.includes('Drop')));
  await click(button('🧪 CLOSE'));
  await click(document.querySelector(`[data-hex-num="${adjacent.num}"]`));
  const beforeHit = observed.spirits.find(s => s.id === victimId).vibe;
  const beforeFans = observed.noteStates[victimId].casuals;
  await advance(30000 - elapsed);
  const hits = observed.stageFx.lastBats.hits.filter(h => h.spiritId === victimId);
  ok(hits.length >= 1, 'bat reaches the FP leader from the adjacent hex');
  ok(observed.spirits.find(s => s.id === victimId).vibe === beforeHit - hits.length,
    'live damage is applied once per attacking bat');
  ok(observed.noteStates[victimId].casuals === beforeFans, 'bat attack gives no eating reward');
  ok(observed.stageFx.bats.bats.length === 4, 'attacking bats also respawn');
  console.log(`✅ batsJourneyCheck: ${checks} checks passed`);
} finally {
  await act(async () => root.unmount());
  globalThis.setInterval = realInterval; globalThis.clearInterval = realClear; performance.now = realNow;
  AudioContext.prototype.createOscillator = oscillator;
}
process.exit(0);
