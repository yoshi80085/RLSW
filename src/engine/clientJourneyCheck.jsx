import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import assert from 'node:assert/strict';
import process from 'node:process';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
// jsdom has no Web Animations renderer; gameplay handlers still run normally.
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById('root'));
const config = buildTestingGroundsConfig({ beginnerMode: false });
config.seed = 4242;
config.spirits = config.spirits.map(spirit => ({ ...spirit, cpu: false }));
const click = async element => {
  assert.ok(element, 'click target exists');
  await act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
};
const button = text => [...document.querySelectorAll('button')].find(el => el.textContent.includes(text));
try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}} />));
  assert.ok(document.querySelector('[data-tip-anchor="drive-stack"]'));
  console.log('Mounted match');
  await click(button('Continue to Melody'));
  assert.ok(document.querySelector('[data-tip-anchor="commit-track"]'));
  const notes = [...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')]
    .map(svg => svg.parentElement).filter(el => el.style.cursor === 'pointer');
  assert.ok(notes.length >= 3, 'dealt a playable hand');
  for (const note of notes.slice(0, 3)) await click(note);
  assert.ok(button('Commit (3 notes'), 'three notes entered the melody');
  await click(button('Commit (3 notes'));
  assert.ok(document.querySelector('[data-tip-anchor="end-turn"]'), 'commit opens movement/actions');
  await click(document.querySelector('[data-tip-anchor="end-turn"]'));
  assert.ok(button('Continue to Melody'), 'next player gets the chord step');
  await click(button('Continue to Melody'));
  const nextNote = [...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')]
    .map(svg => svg.parentElement).find(el => el.style.cursor === 'pointer');
  await click(nextNote);
  assert.ok(button('Commit (1 notes'), 'next player can build a melody');
  await click(button('Commit (1 notes'));
  assert.ok(document.querySelector('[data-tip-anchor="end-turn"]'), 'next player can commit and act');
  console.log('PASS: match start, three-note melody, commit, movement phase, end turn, next-player melody and commit');
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
process.exit(0);
