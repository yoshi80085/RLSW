import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import assert from 'node:assert/strict';
import process from 'node:process';
import { noteSheetPatched } from './actions.js';
import { shukuchiLandings } from './systems/shukuchi.js';

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
// Use the existing replay entry point to give the fixture an owned ability.
config.catchUp = { log: [{ action: noteSheetPatched('cosmic_ronin', {
  unlockedSkills: ['shukuchi', 'psycho_bushido', 'shadow_illusion', 'cursed_shamisen'],
  dbPoints: 10, tempSustain: 1,
}) }] };
config.spirits = config.spirits.map(spirit => ({ ...spirit, cpu: false }));
const roninId = 'cosmic_ronin';
const shukuchiLanding = shukuchiLandings(config, roninId,
  new Set(config.spirits.map(spirit => spirit.num)))[0];
assert.ok(shukuchiLanding, 'fixture provides an unoccupied ring-two Shukuchi landing');
let observedState = null;
const click = async element => {
  assert.ok(element, 'click target exists');
  assert.equal(element.closest('[hidden]'), null, 'click target is not in a closed drawer');
  await act(async () => element.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
};
const button = text => [...document.querySelectorAll('button')].find(el => el.textContent.includes(text));
try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}}
    onEngineState={state => { observedState = state; }} />));
  assert.ok(document.querySelector('[data-tip-anchor="drive-stack"]'));
  console.log('Mounted match');
  await click(button('Continue to Melody'));
  assert.ok(document.querySelector('[data-tip-anchor="commit-track"]'));
  const notes = [...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')]
    .map(svg => svg.parentElement).filter(el => el.style.cursor === 'pointer');
  assert.ok(notes.length >= 3, 'dealt a playable hand');
  for (const note of notes.slice(0, 3)) await click(note);
  assert.ok(button('Commit (3 notes'), 'three notes entered the melody');
  // Layout changes must preserve real in-progress controls, not only engine state.
  const stock = document.querySelector('[data-tip-anchor="note-stock"]');
  const board = document.querySelector('[data-board-view] .arena-tactical > svg');
  await click(button('3D board'));
  assert.equal(document.querySelector('[data-match-layout]').dataset.matchLayout, 'immersive');
  assert.ok(document.querySelector('[data-immersive-track]'), '3D melody uses the immersive floating track');
  assert.equal(document.querySelector('[data-tip-anchor="note-stock"]'), stock, '3D retains the dealt hand DOM');
  assert.equal(document.querySelector('[data-board-view] .arena-tactical > svg'), board, '3D retains the board DOM');
  assert.ok(button('Commit (3 notes'), 'draft survives entering immersive mode');
  const panelButton = text => [...document.querySelectorAll('[aria-label="Arena panels"] button')].find(el => el.textContent === text);
  await click(panelButton('Spirit'));
  assert.equal(document.querySelector('[data-hud-region="turn"]').hidden, true);
  assert.equal(document.querySelector('[data-hud-region="spirit"]').hidden, false);
  await click(panelButton('Rivals'));
  assert.equal(document.querySelector('[data-hud-region="rivals"]').hidden, false);
  await click(panelButton('Turn'));
  assert.equal(document.querySelector('[data-tip-anchor="note-stock"]'), stock, 'drawers do not remount controls');
  await click(button('Commit (3 notes'));
  assert.equal(document.querySelector('[data-hud-region="turn"]').hidden, false, 'new phase shows its controls');
  assert.ok(document.querySelector('.immersive-arail'), '3D action phase uses the immersive command dock');
  assert.ok(document.querySelector('[data-tip-anchor="end-turn"]'), 'commit opens movement/actions');
  assert.equal(document.querySelector('[data-bushido-layer]'), null, 'lane stays hidden until armed');
  await click(button('🌀 Bushido'));
  assert.ok(document.querySelector('[data-bushido-layer="lane"]'), 'arming Bushido paints the lane');
  assert.ok(document.querySelector('[data-bushido-layer="labels"]'), 'rung labels have their own top layer');
  await click(button('Cancel'));
  assert.equal(document.querySelector('[data-bushido-layer]'), null, 'cancelling removes both layers');
  const startingHex = config.spirits.find(spirit => spirit.id === roninId).num;
  await click(button('🌀 Shukuchi'));
  await click(document.querySelector(`[data-hex-num="${shukuchiLanding}"]`));
  const hoppedRonin = observedState?.spirits.find(spirit => spirit.id === roninId);
  assert.equal(hoppedRonin?.num, shukuchiLanding, 'Shukuchi moves Ronin to the chosen ring-two landing');
  assert.equal(observedState?.turn?.lastMove?.from, startingHex, 'Shukuchi records its true origin');
  assert.equal(observedState?.turn?.lastMove?.shukuchi, true, 'Shukuchi keeps its distinct movement marker');
  assert.equal(observedState?.turn?.moveStepsLeft, 2, 'one Shukuchi hop costs one shared Action Point');
  assert.ok(button('🌀 Shukuchi'), 'the paid ability remains available for its remaining hops');
  await click(button('👤 Shadow'));
  const shadow = observedState?.noteStates?.[roninId]?.shadowIllusion;
  assert.equal(shadow?.hex, shukuchiLanding, 'Shadow Illusion begins stacked on Ronin');
  assert.ok(shadow?.turnsLeft > 0, 'Shadow Illusion receives its configured duration');
  assert.ok(shadow?.stepsLeft > 0, 'Shadow Illusion receives an independent movement budget');
  assert.ok(button('👤 Shadow')?.textContent.includes(`${shadow.turnsLeft}t`),
    'the live ability control reports the active Shadow duration');
  await click(button('🎸 Shamisen'));
  const curse = observedState?.noteStates?.[roninId]?.shamisenCurse;
  assert.ok(curse?.turnsLeft > 0, 'Cursed Shamisen starts its timed curse');
  assert.equal(curse?.paidThisRound, false, 'Cursed Shamisen begins with its debt unpaid');
  assert.ok(button('💰 Pay Debt'), 'the active curse exposes its live debt control');
  await click(button('💰 Pay Debt'));
  assert.equal(observedState?.noteStates?.[roninId]?.shamisenCurse?.paidThisRound, true,
    'Pay Debt protects the active curse for this round');
  assert.ok(button('💰 Pay Debt')?.textContent.includes('✓'), 'the debt control confirms payment');
  // Inspect details, then return through the same controls a player uses.
  await click(panelButton('Spirit'));
  await click(panelButton('Turn'));
  await click(document.querySelector('[data-tip-anchor="end-turn"]'));
  assert.equal(document.querySelector('[data-hud-region="turn"]').hidden, false, 'next player gets turn controls');
  assert.equal(document.querySelectorAll('[data-immersive-hidden]').length, 2,
    '3D chord phase retires the two classic board-sized stack panels');
  assert.ok(button('Continue to Melody'), 'next player gets the chord step');
  await click(button('Continue to Melody'));
  const nextNote = [...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')]
    .map(svg => svg.parentElement).find(el => el.style.cursor === 'pointer');
  await click(nextNote);
  assert.ok(button('Commit (1 notes'), 'next player can build a melody');
  await click(button('Commit (1 notes'));
  assert.ok(document.querySelector('[data-tip-anchor="end-turn"]'), 'next player can commit and act');
  await click(button('2D board'));
  assert.equal(document.querySelector('[data-match-layout]').dataset.matchLayout, 'classic');
  assert.equal(document.querySelector('[data-board-view] .arena-tactical > svg'), board, '2D recovery retains original board');
  for (const region of document.querySelectorAll('[data-hud-region]')) assert.equal(region.hidden, false, 'classic shows every HUD region');
  assert.ok(document.querySelector('[data-tip-anchor="end-turn"]'), 'view switch does not reset the phase');
  console.log('PASS: melody, immersive layout/drawers, preserved live controls, Shukuchi hop, Shadow summon, Shamisen debt, Bushido arm/cancel, next-turn reset, second commit, 2D recovery');
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
process.exit(0);
