// ─── 🎡 SCALE WHEEL CHECK ────────────────────────────────────────────────────
// §1 the model, for every Spirit × every root: twelve slots, the palette lit,
//    exactly one tonic / 4th / 5th badge, one ★, spelling from the real pool.
// §2 the real Game: the wheel sits in the player pocket (the Spirit card's old
//    seat) in every step; clicks commit only while composing, through
//    clickNoteStock; W and the header collapse it; remembered per character.
// Run: npm run test:scalewheel
import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import assert from 'node:assert/strict';
import process from 'node:process';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import { wheelModel, WHEEL_DEFAULTS, WHEEL_LOOK, POCKET_WHEEL } from '../ui/scaleWheelModel.js';
import { melodyModeFor } from '../music/melodyIdentity.js';
import { playableScale, getSpelledPool, pitchIndex } from '../music/notes.js';
import { ENDING_DB } from '../music/melodyPayout.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

// ── §1 the model ─────────────────────────────────────────────────────────────
console.log('§1 wheel model × Spirits × roots');
const ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
for (const sp of Object.keys(WHEEL_LOOK)) for (const root of ROOTS) {
  const m = wheelModel({ spiritId: sp, root });
  const mode = melodyModeFor(sp);
  const where = `${sp} ${root}`;
  ok(m.slots.length === 12, `${where}: 12 slots`);
  ok(m.slots.filter(s => s.inPal).length === playableScale(root, mode).length, `${where}: palette lit`);
  ok(m.slots[m.rootPc].k === 0, `${where}: root at 12 o'clock`);
  ok(m.slots.every((s, pc) => s.name === getSpelledPool(root, mode)[pc]), `${where}: spelled by the real pool`);
  const ends = m.slots.filter(s => s.ending).map(s => s.ending).sort().join();
  ok(ends === 'fifth,fourth,tonic', `${where}: one tonic, 4th and 5th (${ends})`);
  ok(m.slots.filter(s => s.sig).length === 1, `${where}: one ★ signature note`);
}
ok(ENDING_DB.fifth === 3 && ENDING_DB.fourth === 2 && ENDING_DB.tonic === 1, 'badges read ENDING_DB (1/2/3)');
const cRot = wheelModel({ spiritId: 'cosmic_ronin', root: 'G', opts: { ...WHEEL_DEFAULTS, rotate: 'c' } });
ok(cRot.slots[0].k === 0 && cRot.slots[7].k === 7, '"C on top" puts C at 12 o\'clock');
const held = wheelModel({ spiritId: 'cosmic_ronin', root: 'C', hand: ['C', 'C', 'Eb', 'F#'], available: i => i !== 1 });
ok(held.slots[0].held.length === 1 && held.slots[3].held.length === 1, 'held counts skip used slots');
ok(!WHEEL_DEFAULTS.ghostNextKey && WHEEL_DEFAULTS.size === 343, "Alex's dial is the default");
ok(POCKET_WHEEL.size === 214 && POCKET_WHEEL.titles && POCKET_WHEEL.degrees, 'the nav wheel: 214px, tooltips, Alex\'s dial otherwise');

// ── §2 the real Game ─────────────────────────────────────────────────────────
console.log('§2 mounted match');
const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const keyListeners = new Set();
const shimAdd = globalThis.addEventListener, shimRemove = globalThis.removeEventListener;
globalThis.addEventListener = (t, fn, o) => t === 'keydown' ? keyListeners.add(fn) : shimAdd?.(t, fn, o);
globalThis.removeEventListener = (t, fn, o) => t === 'keydown' ? keyListeners.delete(fn) : shimRemove?.(t, fn, o);
const press = async (key, mods = {}) => {
  const ev = { key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
    target: document.body, defaultPrevented: false, ...mods, preventDefault() { this.defaultPrevented = true; } };
  await act(async () => { for (const fn of [...keyListeners]) fn(ev); });
  return ev;
};
const config = buildTestingGroundsConfig({ beginnerMode: false });
config.seed = 4242;
config.spirits = config.spirits.map(s => ({ ...s, cpu: false }));
let observed = null;
const root = createRoot(document.getElementById('root'));
const click = async el => { assert.ok(el, 'click target exists'); await act(async () => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); };
const button = text => [...document.querySelectorAll('button')].find(el => el.textContent.includes(text));
const sheet = () => observed.noteStates[observed.acting];
const panel = () => document.querySelector('[data-scale-wheel-panel]');
try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}}
    onEngineState={state => { observed = state; }} />));
  // 🎡 Turn · Scale · Rivals — the middle chip drops the wheel under the row.
  const chips = () => [...document.querySelectorAll('[aria-label="Arena panels"] button')];
  ok(chips().map(b => b.textContent).join() === 'Turn,Scale,Rivals', 'nav reads Turn · Scale · Rivals');
  ok(document.querySelector('.match-player-card'), 'the Spirit card on the left is untouched');
  ok(document.querySelector('.match-panel-dock')?.contains(panel()), 'the wheel sits under the nav chips');
  ok(chips()[1].getAttribute('aria-expanded') === 'true', 'the Scale chip shows it open');
  ok(document.querySelector('[data-hud-region="turn"]')?.hidden === false, 'the Turn controls stay up beside it');
  ok(document.querySelector('[data-scale-wheel]')?.dataset.scaleWheel === 'cosmic_ronin', "it is the Ronin's wheel");
  await click(chips()[1]);
  ok(!panel() && chips()[1].getAttribute('aria-expanded') === 'false', 'the Scale chip closes it');
  ok(JSON.parse(globalThis.localStorage.getItem('rlsw.scaleWheelOpen') || '{}').cosmic_ronin === false, 'remembered per character');
  await click(chips()[1]);
  ok(panel(), 'and opens it again');
  const s0 = sheet();
  const pc = pitchIndex(s0.noteStock[0]);
  const slot = () => document.querySelector(`[data-wheel-pc="${pc}"]`);
  ok(slot()?.classList.contains('is-held'), `slot ${s0.noteStock[0]} is marked held`);
  await click(slot());
  ok(sheet().melodyLine.length === 0, 'in step 1 a wheel click does nothing (it would otherwise land in the track)');
  await click(button('Continue to Melody'));
  ok(panel(), 'still there in the melody step');
  await click(slot());
  ok(sheet().melodyLine.length === 1 && pitchIndex(sheet().melodyLine[0]) === pc, `clicking the slot played ${s0.noteStock[0]}`);
  ok(button('Commit (1 notes'), 'through the normal track (Commit counts it)');
  const empty = [...document.querySelectorAll('[data-wheel-pc]')].find(g => !g.classList.contains('is-held'));
  await click(empty);
  ok(sheet().melodyLine.length === 1, 'a slot you do not hold does nothing');
  ok(document.querySelector('[data-wheel-pc] title')?.textContent.length > 3, 'hover tooltips on the nav wheel');
  const ev = await press('w');
  ok(ev.defaultPrevented && !panel(), 'W closes it');
  await press('w');
  ok(panel(), 'W opens it again');
  console.log(`PASS: ${checks} checks`);
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
process.exit(0);
