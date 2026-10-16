// ─── 🎤🧪 THE FAN MC, SUMMONED IN TESTING GROUNDS ────────────────────────────
// `test:fanmcsummon` — Alex, 2026-10-16: *"I haven't seen him in the game - can you
// make sure he can be summoned in the testing grounds?"*. The real `Game` on the
// Testing Grounds config, driven by clicks the way a tester drives it:
//   · 🧪 TEST → 🎤 THE FAN MC → pick 💨 → "🎤📺 + Replay"
//   · the effect is LIVE in the rules at once, but veiled on the board; the 🧪
//     layer steps aside so nothing sits on top of him
//   · his last-show riff beat plays — a demo duel, because this sandbox has none,
//     and the demo never reaches the engine (`bestRiff` stays null)
//   · Escape (a pad's B) skips to his call: the effect is named and appears
//   · he leaves, the board and the 🧪 button come back; a plain summon has no riff beat
// ⚠️ jsdom has no WebGL: no arena, so his words are the caption (the 3D half is the
// Chromium check in SEQUENCING §A).
// Run: npm run test:fanmcsummon
import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import assert from 'node:assert/strict';
import process from 'node:process';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';

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
const press = async code => {
  const ev = { code, key: code, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
    target: document.body, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} };
  await act(async () => { for (const fn of [...keyListeners]) fn(ev); });
  return ev;
};
const settle = ms => act(async () => new Promise(r => realSetTimeout(r, ms)));
const click = async el => { assert.ok(el, 'the control is on screen'); await act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); }); };
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text));
const overlay = () => document.querySelector('[data-fanmc]');
async function waitFor(pred, ms, what) {
  const until = Date.now() + ms;
  while (!pred() && Date.now() < until) await settle(100);
  ok(pred(), what);
}

const config = buildTestingGroundsConfig({ beginnerMode: false });
config.seed = 1016; config.spirits = config.spirits.map(s => ({ ...s, cpu: false }));
let state = null;
const root = createRoot(document.getElementById('root'));
try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}} onEngineState={s => { state = s; }} />));
  await settle(40);
  ok(!overlay(), 'Testing Grounds: no MC until you call him');
  ok(!state.stageFx.smoke, 'no smoke yet');

  // ── 🎤📺 summon him with the replay, calling the smoke machine ─────────────
  await click(button('🧪 TEST'));
  ok(document.querySelector('[data-tg-fanmc="true"]'), 'the 🧪 panel has a 🎤 THE FAN MC section');
  await click(document.querySelector('[data-tg-mcfx="smoke_machine"]'));
  await click(document.querySelector('[data-tg-fanmc="true"]'));
  await settle(60);
  ok(overlay(), 'he takes the stage');
  ok(!button('🧪 TEST') && !button('🧪 CLOSE'), 'the 🧪 layer steps aside: nothing sits on top of him');
  ok(!!state.stageFx.smoke, 'the smoke is ALREADY live in the rules (the real flow: rules first, picture at his call)');
  ok(!document.querySelector('[data-arena-flat="stage-fx"]'), 'VEILED: the board does not show it yet');
  ok(document.body.dataset.fanmcLive !== undefined, 'the HUD steps aside');
  await waitFor(() => overlay()?.dataset.fanmc === 'standings', 12000, 'the standings');
  await waitFor(() => overlay()?.dataset.fanmc === 'riff', 25000, 'his last-show riff beat plays');
  ok(state.bestRiff == null, 'the demo duel is a picture only — the engine remembers nothing');
  const esc = await press('Escape');
  ok(esc.defaultPrevented, 'Escape (a pad\'s B) skips');
  await waitFor(() => document.querySelector('[data-fanmc-call]')?.getAttribute('data-fanmc-call') === 'smoke_machine', 3000, 'he calls the SMOKE MACHINE');
  await waitFor(() => !!document.querySelector('[data-arena-flat="stage-fx"]'), 2000, '…and at his call it appears on the board');
  await waitFor(() => !overlay(), 9000, 'then he leaves');
  ok(button('🧪 TEST'), 'the 🧪 button is back');
  ok(document.body.dataset.fanmcLive === undefined, 'the HUD is back');

  // ── 🎤 a plain summon: standings and the call, no riff beat ────────────────
  await click(button('🧪 TEST'));
  await click(document.querySelector('[data-tg-mcfx="random"]'));
  await click(document.querySelector('[data-tg-fanmc="false"]'));
  await settle(60);
  ok(overlay(), 'summoned again (any number of times)');
  const seen = new Set();
  await waitFor(() => { const b = overlay()?.dataset.fanmc; if (b) seen.add(b); return b === 'tease' || !overlay(); }, 30000, 'the plain show runs to the tease');
  ok(!seen.has('riff'), 'a plain summon has no riff beat');
  await press('Escape');
  await waitFor(() => !overlay(), 12000, 'and he goes');

  console.log(`✅ fanMcSummonJourneyCheck: ${n} checks passed`);
  await act(async () => root.unmount());
  process.exit(0);
} catch (e) {
  console.error(e);
  console.error(`❌ fanMcSummonJourneyCheck failed after ${n} checks`);
  process.exit(1);
}
