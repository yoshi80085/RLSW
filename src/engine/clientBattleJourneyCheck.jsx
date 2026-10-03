import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import assert from 'node:assert/strict';
import process from 'node:process';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import { HEX_BY_NUM } from '../board/hexMap.js';
import { angleTo, neighborInDirection } from '../board/hexGeometry.js';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const realSetTimeout = globalThis.setTimeout;

const root = createRoot(document.getElementById('root'));
const config = buildTestingGroundsConfig({ beginnerMode: false });
config.seed = 4242;
config.spirits = config.spirits.map(spirit => ({ ...spirit, cpu: false }));

const attackerHex = HEX_BY_NUM[45];
const defenderHex = neighborInDirection(attackerHex, 0);
assert.ok(defenderHex, 'battle fixture has a forward neighbouring hex');
config.spirits[0] = {
  ...config.spirits[0], num: attackerHex.num,
  facing: angleTo(attackerHex, defenderHex), drive: 0,
};
config.spirits[1] = {
  ...config.spirits[1], num: defenderHex.num, sustain: 100,
};
const defenderId = config.spirits[1].id;
const attackerId = config.spirits[0].id;
let observedState = null;

const button = text => [...document.querySelectorAll('button')]
  .find(el => el.textContent.includes(text));
const click = async element => {
  assert.ok(element, 'click target exists');
  await act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
};
const waitFor = async (read, message, timeoutMs = 12000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = read();
    if (value) return value;
    await act(async () => new Promise(resolve => realSetTimeout(resolve, 10)));
  }
  assert.fail(message);
};
const phase = expected => waitFor(
  () => document.querySelector(`[data-battle-phase="${expected}"]`),
  `battle reaches ${expected}`,
);
const vibe = spiritId => Number(document.querySelector(`[data-spirit-id="${spiritId}"]`)?.dataset.vibe);

{
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}}
    onEngineState={state => { observedState = state; }} />));
  await click(button('Continue to Melody'));
  const note = [...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')]
    .map(svg => svg.parentElement).find(el => el.style.cursor === 'pointer');
  await click(note);
  await click(button('Commit (1 notes'));
  console.log('Reached action rail');

  const startingAttackerVibe = vibe(attackerId);
  const startingDefenderVibe = vibe(defenderId);
  assert.equal(startingAttackerVibe, config.spirits[0].vibe, 'attacker Vibe is visible before combat');
  assert.equal(startingDefenderVibe, config.spirits[1].vibe, 'rival Vibe is visible before combat');
  await click(button('Swing'));
  await click(document.querySelector(`[data-hex-num="${defenderHex.num}"]`));
  assert.ok(document.querySelector('[data-battle-phase]'), 'Swing opens the battle overlay');
  console.log('Opened battle overlay');

  await click(button('SKIP TO ROLL'));
  await phase('atk_die_spin');
  console.log('Reached attacker die');
  await click([...document.querySelectorAll('div')].find(el => el.textContent === 'CLICK'));
  await phase('def_die_spin');
  console.log('Reached defender die');
  const diePrompts = [...document.querySelectorAll('div')].filter(el => el.textContent === 'CLICK');
  await click(diePrompts.at(-1));
  await phase('result');
  console.log('Reached battle result');
  await click(button('BACK TO GAME'));
  console.log('Closed battle result');

  assert.ok(!document.querySelector('[data-battle-phase]'), 'battle overlay closes');
  assert.ok(observedState, 'client exposes the latest authoritative engine state');
  assert.ok(observedState.spirits.find(s => s.id === attackerId).vibe < startingAttackerVibe,
    'the deterministic whiff applies Vibe self-damage');
  assert.ok(document.querySelector('[data-tip-anchor="end-turn"]'), 'player returns to the action rail');
  assert.equal(button('Swing')?.disabled, true, 'the spent Action Token disables another Swing');
  console.log('PASS: melody, Swing target, both dice, result, close, Vibe consequence, spent action');
}
process.exit(0);
