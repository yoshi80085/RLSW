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
  // 🪦 THERE IS NO "3D board" / "2D board" SWITCH ANY MORE. The standalone 2D
  // presentation was archived 2026-09-22 (`const board3D = true` in the client),
  // so the match OPENS immersive and stays there; this journey used to click
  // into 3D here and back out to 2D at the end, and failed on the missing button.
  assert.equal(button('3D board'), undefined, 'no 3D toggle — the board is always 3D');
  assert.equal(document.querySelector('[data-match-layout]').dataset.matchLayout, 'immersive');
  assert.ok(document.querySelector('[data-immersive-track]'), '3D melody uses the immersive floating track');
  assert.ok(stock && board, 'the dealt hand and the board are mounted');
  assert.ok(button('Commit (3 notes'), 'the draft is live in the immersive layout');
  const panelButton = text => [...document.querySelectorAll('[aria-label="Arena panels"] button')].find(el => el.textContent === text);
  await click(document.querySelector('.match-player-card')); // 🎡 Spirit details: the card's ＋ (the nav's middle chip is Scale now)
  assert.equal(document.querySelector('[data-hud-region="turn"]').hidden, true);
  assert.equal(document.querySelector('[data-hud-region="spirit"]').hidden, false);
  // 🪪 The Spirit window (2026-10-07): it is the ACTING Spirit's sheet, and its ✕
  // closes through the arena's own selection — then the card opens it again.
  const sheet = document.querySelector('[data-hud-region="spirit"] .ss-root');
  assert.ok(sheet, 'the Spirit window is the new sheet, not the old 2D card');
  assert.equal(sheet.dataset.spiritId, observedState.acting, 'the sheet is the acting Spirit\'s');
  assert.ok(sheet.textContent.includes('FAME') && sheet.textContent.includes('ABILITIES'), 'the sheet drew its sections');
  await click(sheet.querySelector('.ss-close'));
  assert.equal(document.querySelector('[data-hud-region="spirit"]').hidden, true, 'its ✕ closes the window');
  await click(document.querySelector('.match-player-card'));
  assert.equal(document.querySelector('[data-hud-region="spirit"]').hidden, false, '…and the card opens it again');
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
  // 🎸 THE IWATO CURSE — v3 "the trap" (2026-10-09). One rail button: arm it,
  // then click any Lost Chord. (v1's take-up / strings and the older 💰 Pay Debt are gone.)
  assert.equal(button('💰 Pay Debt'), undefined, '🪦 there is no debt to pay any more');
  const curseBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('🎸'));
  assert.ok(curseBtn, 'the Shamisen has its rail button');
  assert.ok(!/Take up|strings/.test(curseBtn.textContent), '🪦 v1\'s take-up and strings are gone');
  if (!curseBtn.disabled) {
    await click(curseBtn);
    const tok = observedState.board.boardTokens[0];
    await click(document.querySelector(`[data-hex-num="${tok.num}"]`));
    assert.equal(observedState?.noteStates?.[roninId]?.shamisenTrap?.hexNum, tok.num, 'a click on a Lost Chord lays the trap on his sheet');
    assert.ok(button('🎸 Trap set'), 'the same button now says the trap is set');
  } else {
    assert.ok(/no action left|🕒|no Lost Chords/.test(curseBtn.textContent), `the button says why not (${curseBtn.textContent})`);
  }
  // Inspect details, then return through the same controls a player uses.
  await click(document.querySelector('.match-player-card')); // 🎡 Spirit details: the card's ＋ (the nav's middle chip is Scale now)
  await click(panelButton('Turn'));
  await click(document.querySelector('[data-tip-anchor="end-turn"]'));
  assert.equal(document.querySelector('[data-hud-region="turn"]').hidden, false, 'next player gets turn controls');
  // ⚠️ `data-immersive-stack` is carried by TWO kinds of element: the chord-phase
  // board panels (`ChordStackPanel`, value "true") and the pocket HUD dials
  // (`MatchSurface`, value "drive"/"sustain" — the 3D note-flight landing target,
  // SEQUENCING.md). Counting the bare attribute read 4 the day the pocket dials
  // gained it and failed with a panel count that had not changed. Count each kind.
  const arenaStacks = [...document.querySelectorAll('[data-immersive-stack="true"]')];
  assert.equal(arenaStacks.length, 2,
    '3D chord phase keeps both board stack panels, at arena width');
  assert.deepEqual(
    [...document.querySelectorAll('[data-immersive-stack]:not([data-immersive-stack="true"])')]
      .map(el => el.dataset.immersiveStack).sort(),
    ['drive', 'sustain'],
    'the pocket Drive/Sustain dials stay tagged as the 3D note-flight landing targets');
  // ⚠️ MOUNTED IS NOT DRAWN, and this suite learned that the expensive way: the
  // assertion above passed for the whole period the panels were
  // 'visibility:hidden', which is precisely when the arena was not showing them.
  assert.ok(arenaStacks.every(el => el.style.visibility !== 'hidden'),
    'the arena stack panels are drawn, not merely mounted');
  assert.ok(button('Continue to Melody'), 'next player gets the chord step');
  await click(button('Continue to Melody'));
  const nextNote = [...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')]
    .map(svg => svg.parentElement).find(el => el.style.cursor === 'pointer');
  await click(nextNote);
  assert.ok(button('Commit (1 notes'), 'next player can build a melody');
  await click(button('Commit (1 notes'));
  assert.ok(document.querySelector('[data-tip-anchor="end-turn"]'), 'next player can commit and act');
  assert.equal(button('2D board'), undefined, 'no 2D toggle either — the classic layout is archived');
  assert.equal(document.querySelector('[data-board-view] .arena-tactical > svg'), board,
    'the board DOM survives two whole turns — nothing remounted it');
  console.log('PASS: melody, immersive layout/drawers, preserved live controls, Shukuchi hop, Shadow summon, Shamisen trap, Bushido arm/cancel, next-turn reset, second commit, no 2D switch');
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
process.exit(0);
