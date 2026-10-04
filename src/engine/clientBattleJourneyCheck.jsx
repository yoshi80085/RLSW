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
  // 🤘 A Thrash needs 2 Drive notes (2026-10-03): voice one more onto the root in the chord step.
  await click([...document.querySelectorAll('button.stack-chip')].find(b => b.textContent.trim() === 'Drive'));
  await click([...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')].map(e => e.parentElement).find(e => e.style.cursor === 'pointer'));
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
  // ⚠️ REWRITTEN 2026-10-04: THE THRASH IS THE 3D CLASH NOW. This journey drove
  // the classic BattleMeterOverlay — SKIP TO ROLL, two CLICK die spins, BACK TO
  // GAME — but every live Thrash has been a `swingClash` since 2026-09-20 and
  // the client hands that overlay `null` for one, so the screen this walked
  // through is one no player reaches. `test:swing` owns the clash's own timing
  // and sound; what this journey keeps is the AFTERMATH, end to end.
  await click(button('Thrash'));
  await click(document.querySelector(`[data-hex-num="${defenderHex.num}"]`));
  assert.ok(observedState.battle?.swingClash, 'the Thrash rolls the engine clash');
  assert.ok(document.querySelector('[data-swing-phase]'), 'the clash plays on the 3D board');
  assert.equal(document.querySelector('[data-battle-phase]'), null, '…and the archived 2D battle overlay stays shut');
  const verdict = observedState.battle;
  console.log('Opened the clash');

  for (const who of ['attacker', 'Rival']) {
    const roll = await waitFor(() => document.querySelector('.sonic-roll-prompt button'), `the ${who} is asked to roll`);
    await click(roll);
  }
  await waitFor(() => !document.querySelector('[data-swing-phase]'), 'the clash closes', 20000);
  console.log('Closed the clash');

  assert.ok(observedState, 'client exposes the latest authoritative engine state');
  if (verdict.margin) {
    const loser = verdict.attackerWon ? defenderId : attackerId;
    const startOf = loser === attackerId ? startingAttackerVibe : startingDefenderVibe;
    await waitFor(() => observedState.spirits.find(s => s.id === loser).vibe < startOf,
      'the loser takes the clash damage');
    assert.equal(observedState.spirits.find(s => s.id === loser).vibe, startOf - verdict.margin,
      'the loser loses exactly the margin in Vibe');
  } else {
    assert.equal(vibe(attackerId), startingAttackerVibe, 'a tie costs nobody Vibe');
    assert.equal(vibe(defenderId), startingDefenderVibe, '…on either side');
  }
  assert.ok(document.querySelector('[data-tip-anchor="end-turn"]'), 'player returns to the action rail');
  assert.equal(button('Thrash')?.disabled, true, 'the spent Action Token disables another Thrash');
  console.log(`PASS: melody, Thrash target, the clash (${verdict.margin ? 'margin ' + verdict.margin : 'a tie'}), close, Vibe consequence, spent action`);
}
process.exit(0);
