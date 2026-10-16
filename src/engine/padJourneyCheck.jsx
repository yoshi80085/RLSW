// ─── 🎮 PAD JOURNEY — the real Game, a turn played from a controller ────────
// `input/gamepadCheck.mjs` proves the map and the runtime against stubs; this
// proves the WIRING: a mounted match, a fake Gamepad polled by the real runtime
// (`createPadRuntime`), its keys delivered to the window's real keydown
// listeners, and the ENGINE as the witness.
//   · Y = Continue (Chord Stack → Melody) · Y = ✓ Commit · left stick = a step
//     · Y = End turn — the same three Enters a keyboard player presses;
//   · holding Y never double-fires (Commit does not run on into End turn);
//   · the stick walks one hex per push, toward screen-up (no arena here, so the
//     lens heading is 0 and up = north = Numpad8's neighbour).
//   · 🎯 each step names where the ring starts (`[data-pad-default]`) for the
//     HUD (View): the destination stack in Chord, ✓ Commit in Melody, Move in
//     Move & Act, and a NEW key next turn.
//   · 🎡 THE PAD-TURN PORT (2026-10-14): the note pool IS the wheel — the left
//     stick points at a note and A plays it (into Drive, then RB → Sustain), X
//     takes one back, the right stick flicks the hammer-on; in Move & Act the
//     D-pad is the ability cross, an armed ability opens ONLY its legal hexes to
//     the ring, and B backs out. The engine is the witness throughout.
// 📌 One Melody note is still TYPED, so the keyboard route stays covered here too.
// Run: npm run test:padjourney
import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import { parseStockNote } from '../music/noteKeys.js';
import { pitchIndex } from '../music/notes.js';
import { noteSheetPatched } from './actions.js';
import { crossButton } from '../ui/padTurnUi.js';
import { hammerCandidate, hasHammerOn } from '../music/noteTechniques.js';
import { livePalette } from './systems/iwatoCurse.js';
import { numpadTarget } from '../ui/numpadMove.js';
import { HEX_BY_NUM } from '../board/hexMap.js';
import { createPadRuntime } from '../input/gamepad.js';
import { createPadFocus } from '../input/padFocus.js';
import { PAD_BUTTONS } from '../input/padMap.js';
import assert from 'node:assert/strict';
import process from 'node:process';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// The render shim makes window listeners no-ops; keep a real registry for keydown.
const keyListeners = new Set();
const shimAdd = globalThis.addEventListener, shimRemove = globalThis.removeEventListener;
globalThis.addEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.add(fn) : shimAdd?.(type, fn, opts);
globalThis.removeEventListener = (type, fn, opts) => type === 'keydown' ? keyListeners.delete(fn) : shimRemove?.(type, fn, opts);
const delivered = [];
const fire = (key, code, mods = {}) => {
  const ev = { key, code, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, repeat: false,
    target: document.body, defaultPrevented: false, ...mods, preventDefault() { this.defaultPrevented = true; } };
  for (const fn of [...keyListeners]) fn(ev);
  return ev;
};

// ── the controller ──
let held = [], stick = [0, 0], rightStick = [0, 0];
const gamepad = () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  for (const n of held) buttons[PAD_BUTTONS[n]] = { pressed: true, value: 1 };
  return { index: 0, connected: true, mapping: 'standard', buttons, axes: [...stick, ...rightStick] };
};
const runtime = createPadRuntime({
  getPads: () => [gamepad()],
  sendKey: (type, k) => { if (type === 'keydown') { delivered.push(k.code); fire(k.key, k.code); } },
  focus: null, camera: () => null, layer: () => 'turn',
});
let clock = 0;
const poll = async (ms = 8) => { clock += ms; await act(async () => runtime.tick(clock)); };
const tapButton = async name => { held = [name]; await poll(); await poll(); held = []; await poll(); };
const settle = ms => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const letter = note => { const n = parseStockNote(note); return [n.letter.toLowerCase(), { shiftKey: n.altered }]; };

const config = buildTestingGroundsConfig({ beginnerMode: false });
config.seed = 4242;
config.spirits = config.spirits.map(spirit => ({ ...spirit, cpu: false }));
// the Ronin holds Shukuchi, so the cross has a signature to arm (the replay entry point, as clientJourneyCheck)
config.catchUp = { log: [{ action: noteSheetPatched('cosmic_ronin', { unlockedSkills: ['shukuchi'] }) }] };
let observed = null;
const root = createRoot(document.getElementById('root'));
const me = () => observed.spirits.find(s => s.id === observed.acting);
const sheet = () => observed.noteStates?.[observed.acting];

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}}
    onEngineState={state => { observed = state; }} />));
  ok(observed?.acting && me(), 'engine state observed');
  await poll(); await poll();   // the pad wakes with nothing held
  const first = observed.acting;

  // ── 🎯 where the ring starts: Chord Stack ──
  const defaults = () => [...document.querySelectorAll('[data-pad-default]')];
  const theDefault = () => { const d = defaults(); return d.length === 1 ? { el: d[0], key: d[0].getAttribute('data-pad-default') } : { el: null, key: `${d.length} defaults` }; };
  let d = theDefault();
  ok(d.el?.tagName === 'BUTTON' && d.el.textContent.trim() === 'Drive' && d.key.startsWith('chord:pick:'),
    `the turn opens with the ring on Drive (${d.key})`);
  const turnKey = d.key.slice('chord:pick:'.length);
  // ── 🎡 THE NOTE POOL IS THE WHEEL, and the left stick points at a note ──
  ok(document.querySelector('[data-pool-wheel]'), 'the Chord Stack opens with the note pool on the wheel, centre of the arena');
  ok(!document.querySelector('[data-stock-idx]'), '…and the honeycomb is gone');
  const angleOf = note => ((pitchIndex(note) - pitchIndex(sheet().rootNote) + 12) % 12) * 30;
  const point = async deg => {
    stick = [Math.sin(deg * Math.PI / 180), -Math.cos(deg * Math.PI / 180)];
    for (let i = 0; i < 8; i++) await poll(16);
    stick = [0, 0];
    for (let i = 0; i < 8; i++) await poll(16);
  };
  const freeNotes = () => { const u = sheet().usedStockIdx, used = i => Array.isArray(u) ? u.includes(i) : !!u?.has?.(i);
    return sheet().noteStock.filter((n, i) => !used(i)); };
  const t1 = freeNotes()[2], commits0 = sheet().stackCommitsThisTurn ?? 0, drive0 = (sheet().driveStack ?? []).length;
  await point(angleOf(t1));
  await tapButton('A');
  await settle(30);
  ok((sheet().stackCommitsThisTurn ?? 0) === commits0 + 1 && (sheet().driveStack ?? []).length === drive0 + 1, 'A plays the picked note into a stack (Drive, the first open one)');
  ok(pitchIndex(sheet().driveStack.at(-1)) === pitchIndex(t1), `…and it is the note the stick pointed at (${t1})`);
  const sustain0 = (sheet().sustainStack ?? []).length;
  await tapButton('RB');
  ok(delivered.at(-1) === 'Tab', 'RB = Tab (Drive ⇄ Sustain — the wheel\'s hub)');
  const t2 = freeNotes().find(n => pitchIndex(n) !== pitchIndex(t1));
  await point(angleOf(t2));
  await tapButton('A');
  await settle(30);
  ok((sheet().sustainStack ?? []).length === sustain0 + 1 && pitchIndex(sheet().sustainStack.at(-1)) === pitchIndex(t2),
    `…and the next pick lands in Sustain (${t2})`);
  ok(document.querySelector('[data-pad-bar]')?.textContent.includes('Continue'), 'the button bar names what Y does now');
  d = theDefault();
  ok(d.key.startsWith('chord:') && d.key.endsWith(turnKey), `the HUD's ring start (View) is keyed to this turn (${d.key})`);

  // ── Y: Continue to Melody ──
  await tapButton('Y');
  ok(delivered.filter(c => c === 'Enter').length === 1, 'Y sent exactly one Enter');
  // ── the notes: picked on the wheel and played with A ──
  const lineLen = () => (sheet().melodyLine ?? []).length;
  const playByStick = async note => {
    const before = lineLen();
    await point(angleOf(note)); await tapButton('A'); await settle(20);
    ok(lineLen() === before + 1 && pitchIndex(sheet().melodyLine.at(-1)) === pitchIndex(note), `A plays the stick's note onto the track (${note})`);
  };
  // two notes the hammer-on can carry on, if this Spirit has one (the Ronin) — else any two
  const ronin = hasHammerOn(me().id);
  const palette = livePalette(me().id, sheet());
  let pair = null;
  for (const a of freeNotes()) for (const b of freeNotes()) {
    if (pair || pitchIndex(a) === pitchIndex(b)) continue;
    if (!ronin || hammerCandidate(me().id, [a, b], palette, { charges: Math.max(1, sheet().hammerCharges ?? 0) }).ok) pair = [a, b];
  }
  ok(pair, `two notes to play (${pair})`);
  await playByStick(pair[0]); await playByStick(pair[1]);
  // 🎸 the right-stick flick: ↑ hammer-on, ↓ pull-off — and the wrong way plays nothing
  const flick = async y => { rightStick = [0, y]; await poll(); await poll(); rightStick = [0, 0]; await poll(); await settle(20); };
  if (ronin && (sheet().hammerCharges ?? 0) > 0) {
    const cand = hammerCandidate(me().id, sheet().melodyLine, palette, { charges: sheet().hammerCharges });
    ok(cand.ok, `the line can be hammered on from (${cand.label} ${cand.note})`);
    const n0 = lineLen();
    await flick(cand.dir === 'up' ? .95 : -.95);
    ok(lineLen() === n0, `a flick the WRONG way (${cand.dir === 'up' ? '↓' : '↑'}) plays nothing — it is a ${cand.label}`);
    await flick(cand.dir === 'up' ? -.95 : .95);
    ok(lineLen() === n0 + 1 && sheet().melodySrcIdx?.at(-1) === cand.label && sheet().melodyLine.at(-1) === cand.note,
      `the right flick (${cand.dir === 'up' ? '↑' : '↓'}) is the ${cand.label}: ${cand.note}, no hand note spent`);
  } else ok(!ronin, 'only a Spirit with no hammer-on skips the flick');
  const beforeX = lineLen();
  await tapButton('X'); await settle(20);
  ok(lineLen() === beforeX - 1, 'X takes the last note back (Backspace)');
  { const free = freeNotes()[0]; if (free) await act(async () => { const [l, m] = letter(free); fire(l, `Key${l.toUpperCase()}`, m); }); }
  ok(lineLen() === beforeX, 'a typed note still goes in beside the pad (one hand, two routes)');
  const line = lineLen();
  d = theDefault();
  ok(d.key === `melody:${turnKey}`, `the Melody step names its own start for the HUD — ✓ Commit (${d.key})`);
  ok(!sheet().hasConfirmed, `notes are on the Melody step, not yet committed${line != null ? ` (${line})` : ''} — so Y #1 really did Continue`);

  // ── Y held: Commit, and ONLY commit ──
  held = ['Y']; await poll(); for (let i = 0; i < 30; i++) await poll(16); held = []; await poll();
  await settle(1200);
  ok(sheet().hasConfirmed, 'Y = ✓ Commit — the melody is in, the turn is in Move & Act');
  ok(observed.acting === first, 'HOLDING Y did not run on into End turn (the pad never auto-repeats a key)');
  d = theDefault();
  ok(d.el?.textContent.startsWith('Move') && d.key === `move:${turnKey}`, `Move & Act starts the ring on Move (${d.key})`);
  const budget = observed.turn.moveStepsLeft;
  ok(budget >= 1, `there are steps to spend (${budget})`);

  // ── left stick up: one step north, per push ──
  const from = HEX_BY_NUM[me().num], want = numpadTarget('Numpad8', from);
  stick = [0, -1]; await poll(); stick = [0, 0]; await poll(); await settle(50);
  if (want && !observed.spirits.some(s => s.num === want.num && s.id !== first)) {
    ok(me().num === want.num, `the stick pushed up walked ${from.num} → ${want.num} (Numpad8's neighbour)`);
    ok(observed.turn.moveStepsLeft === budget - 1, 'one push, one step of budget — like a click');
  } else {
    ok(me().num === from.num, 'nothing north to step onto: the stick walks nowhere');
  }
  const at = me().num, left = observed.turn.moveStepsLeft;
  stick = [0, -.4]; await poll(); stick = [0, 0]; await poll();
  ok(me().num === at && observed.turn.moveStepsLeft === left, 'a stick nudged only part way (under the flick) walks nowhere');

  // ── ✚ THE ABILITY CROSS, and aiming that only lands on LEGAL hexes ──
  ok(document.querySelector('[data-pad-bar]')?.textContent.includes('End turn'), 'the bar: walk, abilities, End turn');
  const live = ['Left', 'Right', 'Up', 'Down'].find(dir => { const b = crossButton(document, dir); return b && !b.disabled; });
  const dead = ['Left', 'Right', 'Up', 'Down'].find(dir => { const b = crossButton(document, dir); return b && b.disabled; });
  if (dead) {
    const hexes0 = document.querySelectorAll('[data-pad-hex]').length;
    await tapButton(dead); await settle(20);
    ok(document.querySelectorAll('[data-pad-hex]').length === hexes0 && !document.querySelector('[data-pad-default^="aim:"]'),
      `✚ ${dead} on a greyed ability arms nothing (the rail's own gate)`);
  }
  ok(!!live, `the cross has an ability to arm (${live ?? 'none'})`);
  if (live) {
    const label = crossButton(document, live).textContent.trim();
    // 🛡️ WITH THE EMULATION GUARD UP, as on Alex's machine: the D-pad press holds it, and the
    // cross's own button.click() must still land (22:32: "I'm not able to use any of the abilities")
    const guard = createPadFocus({ doc: document, win: dom.window });   // the REAL jsdom window (the shim's listeners are no-ops)
    guard.padPulse(true);
    await tapButton(live); await settle(20);
    ok(guard.guarding(), '…the guard was up while the D-pad was pressed');
    guard.padPulse(false); guard.dispose();
    const open = [...document.querySelectorAll('[data-pad-hex]')].map(el => Number(el.dataset.hexNum));
    const aim = document.querySelector('[data-pad-default^="aim:"]');
    ok(open.length > 0 && aim && open.includes(Number(aim.dataset.hexNum)), `✚ ${live} armed ${label}: the ring starts on a LEGAL hex (${open.length} open)`);
    ok(open.length < 30, '…and only the legal hexes are open to the ring, never the whole board');
    ok(document.querySelector('[data-pad-bar]')?.textContent.includes('Cancel'), 'the bar switches to Aim / fire / Cancel');
    await tapButton('B'); await settle(20);
    ok(!document.querySelector('[data-pad-default^="aim:"]'), 'B (Escape) backs out of the aim');
  }

  // ── Y: End turn ──
  await tapButton('Y');
  await settle(800);
  ok(observed.acting !== first, `the turn passed (${first} → ${observed.acting})`);
  await settle(300);
  d = theDefault();
  ok(d.key.startsWith('chord:pick:') && d.key !== `chord:pick:${turnKey}`, `the next human turn is a NEW key, so the ring jumps again (${d.key})`);
  console.log(`PASS: ${checks} checks — the wheel is the pool (stick picks, A plays, RB Sustain, X back), the hammer flick, Y Continue / Commit / End turn through the real handlers, a held Y fires once, the stick walks one hex per push, the ability cross arms only legal aim, each step names where the ring starts`);
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
process.exit(0);
