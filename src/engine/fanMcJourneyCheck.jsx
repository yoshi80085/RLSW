// ─── 🎤 THE FAN MC, MOUNTED ──────────────────────────────────────────────────
// `test:fanmcjourney` — the real `Game`, a lobby-shaped 2-seat 20-round match
// (the opening act on, as the lobby starts one), played turn by turn with the
// player's own keys (§B2 — the module suite is not the game):
//   · round 7 opens → the MC holds the board: his overlay is up, Enter does
//     nothing, the effect is LIVE in the rules but veiled on the board; Escape
//     (a pad's B) skips to his call: the effect is named and appears on the
//     board, then the board comes back
//   · round 12: standings and the call, NO riff beat
//   · round 17 (the last show of 20): the riff beat plays (no duel this match,
//     so he says so — the replay itself is test:fanmc's and the preview's)
// ⚠️ jsdom has no WebGL: no arena, so his words fall back to the caption. The
// 3D half (him, the mic, the TV) is checked in Chromium (SEQUENCING §A).
// Run: npm run test:fanmcjourney
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
import { parseStockNote } from '../music/noteKeys.js';
import { STAGE_FX_META } from '../data/stageEffects.js';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const realSetTimeout = globalThis.setTimeout;
const keyListeners = new Set();
const shimAdd = globalThis.addEventListener, shimRemove = globalThis.removeEventListener;
globalThis.addEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.add(fn) : shimAdd?.(type, fn, opts);
globalThis.removeEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.delete(fn) : shimRemove?.(type, fn, opts);
let n = 0;
const ok = (v, m) => { assert.ok(v, m); n++; };

const press = async (code, mods = {}) => {
  const ev = { code, key: code, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
    target: document.body, defaultPrevented: false, ...mods, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} };
  await act(async () => { for (const fn of [...keyListeners]) fn(ev); });
  return ev;
};
const settle = ms => act(async () => new Promise(r => realSetTimeout(r, ms)));
const click = async el => { assert.ok(el, 'the control is on screen'); await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
const letter = note => { const p = parseStockNote(note); return [p.letter.toLowerCase(), { shiftKey: p.altered }]; };

// The lobby's own seat shape (Lobby.jsx handleStart), two humans, 20 rounds.
const spirits = cornersForCount(2).map((corner, i) => {
  const def = SPIRIT_DEFS[PLAYABLE_ORDER[i % PLAYABLE_ORDER.length]];
  return { ...seatSpirit(def, corner, { cpu: false }), id: seatId(def.id, corner), characterId: def.id };
});
const config = { spirits, mode: 'ffa', teams: null, startingLives: 3, beginnerMode: false,
  winCondition: 'rounds', roundLimit: 20, openingAct: true, seed: 7171 };
let state = null, logLines = [];
const sheet = () => state.noteStates?.[state.acting];
const overlay = () => document.querySelector('[data-fanmc]');

// One player's turn, the way a player plays it: Continue, a note, Commit, End turn.
async function playTurn() {
  await press('Enter');
  const u = sheet().usedStockIdx, used = i => Array.isArray(u) ? u.includes(i) : !!u?.has?.(i);
  const free = sheet().noteStock.find((_, i) => !used(i));
  if (free) await press(...letter(free));
  await press('Enter');
  await settle(700);
  await click(document.querySelector('[data-tip-anchor="end-turn"]'));
  await settle(450);
}
async function playToRound(r) {
  for (let guard = 0; state.turn.round < r && guard < 80; guard++) {
    if (overlay()) { await click(document.querySelector('[data-fanmc-skip]')); await settle(5500); continue; }
    await playTurn();
  }
}
async function waitFor(pred, ms, what) {
  const until = Date.now() + ms;
  while (!pred() && Date.now() < until) await settle(100);
  ok(pred(), what);
}

const root = createRoot(document.getElementById('root'));
try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}} onEngineState={s => { state = s; }} />));
  await settle(40);
  ok(!overlay(), 'no MC at the start of a match');

  // ── round 7: the first show ────────────────────────────────────────────────
  await playToRound(7);
  ok(state.turn.round === 7, 'round 7 has opened');
  const draw = state.stageFx.lastDraw;
  ok(draw?.round === 7 && STAGE_FX_META[draw.fxId], `the engine drew ${draw?.fxId} for round 7`);
  const fxLive = !!(state.stageFx.smoke || state.stageFx.laser || state.stageFx.pyro || state.stageFx.animatronics?.length || state.stageFx.bats);
  ok(fxLive, 'the effect is ALREADY live in the rules — nothing about the game waits');
  await settle(50);
  ok(overlay(), 'the MC has the stage');
  ok(document.body.dataset.fanmcLive !== undefined, 'the HUD steps aside (body flag)');
  ok(!document.querySelector('[data-arena-flat="stage-fx"]'), 'VEILED: the board does not show the effect yet (StageFXBoardLayer draws nothing)');
  ok(!document.querySelector('[data-fanmc-call]'), 'not called yet');
  const step0 = sheet()?.melodyLine?.length ?? 0, acting0 = state.acting;
  await press('a'); await press('c');
  ok(state.acting === acting0 && (sheet()?.melodyLine?.length ?? 0) === step0 && overlay(), 'the board is held: a note key does nothing while he talks');
  ok(document.querySelector('[data-fanmc-skip]')?.getAttribute('data-pad-default')?.startsWith('fanmc:'), 'pad-ready: the ring starts on ⏭ Skip');
  await waitFor(() => overlay()?.dataset.fanmc === 'standings', 12000, 'the standings come up');
  ok(document.querySelectorAll('[data-fanmc-bar]').length === 2, 'the Fame bar chart: one bar per Spirit');
  const esc = await press('Escape');
  ok(esc.defaultPrevented, 'Escape (a pad\'s B) is his Skip');
  await waitFor(() => !!document.querySelector('[data-fanmc-call]'), 3000, '⏭ Skip lands on his call: the effect is NAMED');
  await waitFor(() => !!document.querySelector('[data-arena-flat="stage-fx"]'), 2000, '…and at his call it comes into being on the board');
  await waitFor(() => !overlay(), 9000, 'then he leaves and the board comes back');
  ok(document.body.dataset.fanmcLive === undefined, 'the HUD is back');
  await playTurn();
  ok(state.turn.round === 7 && (state.turn.count ?? 0) > 0, 'play goes on under the effect');

  // ── round 12: standings and the call, no riff beat ─────────────────────────
  const seen12 = new Set();
  await playToRound(12);
  await settle(50);
  ok(overlay(), 'round 12: the MC again');
  await waitFor(() => { const b = overlay()?.dataset.fanmc; if (b) seen12.add(b); return b === 'reveal' || !overlay(); }, 40000, 'round 12 runs to the call');
  ok(!seen12.has('riff'), 'round 12 of 20: no riff beat (only the last show replays)');
  await waitFor(() => !overlay(), 12000, 'round 12 show over');

  // ── round 17: the last show of 20 — the riff beat ─────────────────────────
  await playToRound(17);
  await settle(50);
  ok(overlay(), 'round 17: the MC\'s last visit');
  await waitFor(() => overlay()?.dataset.fanmc === 'riff', 40000, 'the last show of a 20-round match has the riff beat');
  await waitFor(() => /riff-off/i.test(document.querySelector('[data-fanmc-caption]')?.textContent ?? ''), 6000, 'no duel this match, so he says so');
  ok(state.bestRiff == null, 'nothing was remembered — nobody duelled');
  console.log(`✅ fanMcJourneyCheck: ${n} checks passed`);
  await act(async () => root.unmount());
  process.exit(0);
} catch (e) {
  console.error(e);
  console.error(`❌ fanMcJourneyCheck failed after ${n} checks`);
  process.exit(1);
}
