// ─── 🎸 HAMMER-ON JOURNEY — the real Game, the Ronin's hammer-on by keys ──────
// `music/noteTechniquesCheck.mjs` proves the rule and the engine's half; this
// proves the WIRING in the mounted match, with the engine's note sheet as the
// witness (MELODY_IDENTITY_DESIGN §13, Alex 2026-10-07/08):
//   • the Ronin is dealt one charge; the button and the ghost light only once
//     two notes make a shape; H adds the rule's note with NO hand note spent
//   • the charge is gone after one use and H does nothing more
//   • taking back the note it was played off takes the hammered note too, and
//     refunds the charge; Backspace refunds it as well
//   • the commit counts it toward movement; his turn end recharges him
//   • ⭐ another Spirit gets no button, no plate and no H key at all
// Run: npm run test:hammeronjourney
import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import { parseStockNote } from '../music/noteKeys.js';
import { hammerCandidate, hasHammerOn, isTechniqueSrc } from '../music/noteTechniques.js';
import { livePalette } from './systems/iwatoCurse.js';
import assert from 'node:assert/strict';
import process from 'node:process';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Same keydown registry as `noteKeysJourneyCheck` — ONE act per listener, as a browser does.
const keyListeners = new Set();
const shimAdd = globalThis.addEventListener, shimRemove = globalThis.removeEventListener;
globalThis.addEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.add(fn) : shimAdd?.(type, fn, opts);
globalThis.removeEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.delete(fn) : shimRemove?.(type, fn, opts);
const press = async (key, mods = {}) => {
  const ev = { key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
    target: document.body, defaultPrevented: false, ...mods, preventDefault() { this.defaultPrevented = true; } };
  for (const fn of [...keyListeners]) await act(async () => { fn(ev); });
  return ev;
};
const keyFor = note => { const n = parseStockNote(note); return [n.letter.toLowerCase(), { shiftKey: n.altered }]; };

const config = buildTestingGroundsConfig({ beginnerMode: false });
config.seed = 4242;
// The Ronin acts first, so his hammer-on is the first thing the match offers.
config.spirits = [...config.spirits].sort((a, b) => (hasHammerOn(b) ? 1 : 0) - (hasHammerOn(a) ? 1 : 0))
  .map(spirit => ({ ...spirit, cpu: false }));
let observed = null;
const root = createRoot(document.getElementById('root'));
const click = async el => { assert.ok(el, 'click target exists'); await act(async () => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); };
const sheet = (id = observed.acting) => observed.noteStates[id];
const usedCount = () => { const u = sheet().usedStockIdx; return Array.isArray(u) ? u.length : u?.size ?? 0; };
const usedHas = (used, i) => Array.isArray(used) ? used.includes(i) : !!used?.has?.(i);
const hammerBtn = () => document.querySelector('[data-hammer-button]');
const seat = i => document.querySelector(`[data-track-seat="${i}"]`);

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}}
    onEngineState={state => { observed = state; }} />));
  const RONIN = observed.acting;
  ok(hasHammerOn(RONIN), `the Ronin acts first (${RONIN})`);
  ok(sheet().hammerCharges === 1, 'he is dealt one hammer-on charge');
  console.log(`Mounted — ${RONIN} holds ${sheet().noteStock.join(' ')}`);

  // chord step → melody step
  ok(!hammerBtn(), 'no hammer-on button in the chord step');
  await press('Enter');
  ok(hammerBtn()?.dataset.hammerButton === 'too-short', 'Melody step, empty track: the button is up and dark — "play two notes first"');
  ok(document.querySelector('[data-hammer-plate]'), 'his charges sit on the MELODY panel\'s frame');

  // Two hand notes that make a shape the rule can carry on.
  const palette = livePalette(RONIN, sheet());
  const free = sheet().noteStock.map((n, i) => ({ n, i })).filter(({ i }) => !usedHas(sheet().usedStockIdx, i));
  const firstOf = n => free.find(f => keyFor(f.n).join() === keyFor(n).join())?.n === n;   // the key picks THIS copy
  let pair = null;
  for (const a of free) for (const b of free) {
    if (pair || a.i === b.i || !firstOf(a.n) || !firstOf(b.n) || keyFor(a.n).join() === keyFor(b.n).join()) continue;
    if (hammerCandidate(RONIN, [a.n, b.n], palette, { charges: 1 }).ok) pair = [a.n, b.n];
  }
  ok(pair, `the hand holds two notes the hammer can carry on (${pair})`);
  await press(...keyFor(pair[0]));
  ok(hammerBtn()?.dataset.hammerButton === 'too-short', 'one note: still dark');
  await press(...keyFor(pair[1]));
  const cand = hammerCandidate(RONIN, pair, palette, { charges: 1 });
  ok(hammerBtn()?.dataset.hammerButton === 'lit', `two notes (${pair.join(' ')}): the button lights`);
  ok(hammerBtn().textContent.includes(cand.label === 'pull' ? 'PULL-OFF' : 'HAMMER-ON'), `…and says ${cand.label === 'pull' ? 'PULL-OFF' : 'HAMMER-ON'}`);
  ok(/Hammer-on|Pull-off/.test(seat(2)?.getAttribute('title') ?? ''), 'the ghost of the next note waits in seat 3');

  // H
  const usedBefore = usedCount();
  let ev = await press('h');
  ok(ev.defaultPrevented, 'H is taken in the Melody step');
  ok(sheet().melodyLine.length === 3 && sheet().melodyLine[2] === cand.note, `H added ${cand.note}, the rule's note`);
  ok(isTechniqueSrc(sheet().melodySrcIdx[2]) && sheet().melodySrcIdx[2] === cand.label, 'its source is the technique, not a hand slot');
  ok(usedCount() === usedBefore, '⭐ no hand note was spent');
  ok(sheet().hammerCharges === 0, 'the charge is spent');
  ok(document.querySelector('[data-hammer-mark]'), 'the hammered seat wears its h / p mark');
  ok(hammerBtn()?.dataset.hammerButton === 'no-charge', 'the button goes dark: no charge left');
  await press('h');
  ok(sheet().melodyLine.length === 3, 'a second H does nothing');

  // take back the base note → the hammered one goes too, charge refunded
  await click(seat(1));
  ok(JSON.stringify(sheet().melodyLine) === JSON.stringify([pair[0]]), 'taking back the note it was played off takes the hammered note too');
  ok(sheet().hammerCharges === 1, '…and refunds the charge');
  // Backspace refunds too
  await press(...keyFor(pair[1])); await press('h');
  ok(sheet().hammerCharges === 0 && sheet().melodyLine.length === 3, 'hammered again');
  await press('Backspace');
  ok(sheet().hammerCharges === 1 && sheet().melodyLine.length === 2, 'Backspace takes it back and refunds the charge');
  await press('h');

  // commit: it counts toward movement
  const speed = observed.spirits.find(s => s.id === RONIN)?.speed ?? 5;
  await press('Enter');
  ok(sheet(RONIN).hasConfirmed && (sheet(RONIN).committedMelody ?? []).length === 3, 'the committed track holds all three notes');
  ok(observed.turn.moveStepsLeft === Math.min(3, speed), `✅ the hammered note counts toward movement (${observed.turn.moveStepsLeft} hexes)`);

  // end the turn: he recharges; the next Spirit has no technique
  await press('Enter');
  ok(observed.acting !== RONIN, 'the turn passed on');
  ok(sheet(RONIN).hammerCharges === 1, 'his turn end recharged him (0 → 1)');
  const OTHER = observed.acting;
  ok(!hasHammerOn(OTHER), `the next Spirit (${OTHER}) is not the Ronin`);
  await press('Enter');   // chord → melody
  ok(!hammerBtn() && !document.querySelector('[data-hammer-plate]'), '⭐ another Spirit gets no button and no plate');
  const len = (sheet().melodyLine ?? []).length;
  ev = await press('h');
  ok(!ev.defaultPrevented && (sheet().melodyLine ?? []).length === len, '⭐ …and H is left alone');
  ok(!('hammerCharges' in sheet()), '…and carries no charges');

  console.log(`\n✅ hammerOnJourneyCheck: ${checks} checks passed`);
  await act(async () => root.unmount());
  process.exit(0);
} catch (err) {
  console.error(`\n❌ hammerOnJourneyCheck failed after ${checks} checks:`, err?.message ?? err);
  process.exit(1);
}
