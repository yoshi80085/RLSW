// ─── 🎆 PYRO JOURNEY — the real Game, the mortars on the per-turn clock ──────
// `engine/pyroRulesCheck.mjs` proves the rules on the reducer and reads the
// client's source; this MOUNTS the real `Game` and plays it with the player's
// own controls (§B2 — a passing engine test is not a game):
//   · 🧪 TEST → 🎆 Pyrotechnics arms a v2 show (5 mortars, the new log line);
//   · every END TURN fires the set and a fresh one rises before the next turn —
//     every player's turn, not every round;
//   · the set grows by show round (5 → 10 → 13) and the show ends cleanly.
// 📌 Who gets hit (standing on one at END TURN, shoved onto one) is
// `test:pyrorules`' — this DOM has no board geometry to click a Spirit onto a hex.
// Run: npm run test:pyrojourney
import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import { parseStockNote } from '../music/noteKeys.js';
import { PYRO_ROUND_HEXES } from '../data/stageEffects.js';
import assert from 'node:assert/strict';
import process from 'node:process';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const keyListeners = new Set();
const shimAdd = globalThis.addEventListener, shimRemove = globalThis.removeEventListener;
globalThis.addEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.add(fn) : shimAdd?.(type, fn, opts);
globalThis.removeEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.delete(fn) : shimRemove?.(type, fn, opts);
const press = async (code, mods = {}) => {
  const key = code.startsWith('Numpad') ? code.slice(6) : code.startsWith('Digit') ? code.slice(5) : code;
  const ev = { code, key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
    target: document.body, defaultPrevented: false, ...mods, preventDefault() { this.defaultPrevented = true; } };
  await act(async () => { for (const fn of [...keyListeners]) fn(ev); });
};
const settle = ms => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const click = async el => { assert.ok(el, 'the control is on screen'); await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text));
const letter = note => { const n = parseStockNote(note); return [n.letter.toLowerCase(), { shiftKey: n.altered }]; };

const config = buildTestingGroundsConfig({ beginnerMode: false });
config.seed = 5150;
config.spirits = config.spirits.map(spirit => ({ ...spirit, cpu: false }));
let observed = null;
const root = createRoot(document.getElementById('root'));
const pyro = () => observed.stageFx.pyro;
const sheet = () => observed.noteStates?.[observed.acting];

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

// One player's turn, the way a player plays it: Continue, a note, Commit, End turn.
async function playTurn() {
  await press('Enter');
  const u = sheet().usedStockIdx, used = i => Array.isArray(u) ? u.includes(i) : !!u?.has?.(i);
  const free = sheet().noteStock.find((n, i) => !used(i));
  if (free) await press(...letter(free));
  await press('Enter');
  await settle(1200);
  await click(document.querySelector('[data-tip-anchor="end-turn"]'));
  await settle(1500);
}

try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}}
    onEngineState={state => { observed = state; }} />));
  ok(observed?.acting, 'engine state observed');
  const seats = observed.spirits.filter(s => !s.knockedOut).length;
  ok(seats >= 2, `a table of ${seats}`);

  // ── 🧪 TEST → 🎆 Pyrotechnics ──
  await click(button('🧪 TEST'));
  await click(button('Pyrotechnics'));
  await settle(200);
  ok(pyro()?.v === 2, 'the live game runs pyro on the v2 rules');
  ok(pyro().phase === 'armed' && pyro().hexes.length === PYRO_ROUND_HEXES[0], `the mortars rise — ${PYRO_ROUND_HEXES[0]} of them`);
  await click(button('🧪 CLOSE'));

  // ── the per-TURN clock ──
  const sizes = [], waves = [];
  let turns = 0;
  for (let round = 1; round <= 3; round++) {
    for (let t = 0; t < seats; t++) {
      sizes.push(pyro()?.hexes.length ?? 0); waves.push(pyro()?.wave ?? null);
      await playTurn(); turns++;
    }
  }
  ok(waves[1] === waves[0] + 1, 'one END TURN later it is a NEW set — the mortars fired and re-armed on a single turn, not a round');
  ok(waves.every((w, i) => i === 0 || w === waves[i - 1] + 1), `a fresh set every turn (${waves.join(', ')})`);
  const want = Array.from({ length: 3 }, (_, r) => Array(seats).fill(PYRO_ROUND_HEXES[r])).flat();
  // the first turn's set is the activation's own (round 1); every set after it is
  // sized by the round the NEXT turn is in
  ok(JSON.stringify(sizes) === JSON.stringify(want), `the set grows by show round: ${sizes.join(', ')}`);
  ok(pyro() === null, `the show is over after three rounds (${turns} turns)`);
  console.log(`✅ pyroJourneyCheck: ${checks} checks passed`);
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await act(async () => root.unmount());
}
process.exit(process.exitCode ?? 0);
