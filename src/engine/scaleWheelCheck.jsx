// ─── 🎡 SCALE WHEEL CHECK ────────────────────────────────────────────────────
// §1 the model, for every Spirit × every root: twelve slots, the palette lit,
//    exactly one tonic / 4th / 5th badge, one ★, spelling from the real pool.
// §2 the real Game: while composing the note pool IS the wheel (big, over the arena —
//    the Scale chip and W show / hide it; a click commits through clickNoteStock, to a
//    stack in step 1 and the track in step 2); from Move & Act the small card is back
//    under the nav chips, collapsible by the chip and W, remembered per character.
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
import { ENDING_WEIGHT } from '../music/melodyPayout.js';
import { poolDiscStyle, poolScrimGradient } from '../ui/padTurnUi.js';
import { PAD_TURN } from '../input/padTurn.js';

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
ok(ENDING_WEIGHT.fifth === 3 && ENDING_WEIGHT.fourth === 2 && ENDING_WEIGHT.tonic === 1, 'the dormant ending ladder is intact (1/2/3) for the Riff-Off hook');

// ── §1b 🪟 the pool's window (`poolDiscStyle`, Alex 14 Oct: "dark but not totally opaque") ──
// The first pass (.88 / blur 10 / edge .82 / glow 1 / hard rim) must still be drawable from its
// numbers, and the defaults must be HIS dial-in (22:32), so the game shows what he chose.
console.log('§1b the pool window: his dial-in is the default; the levers move it');
{
  const first = poolDiscStyle({ disc: .88, blur: 10, edge: .82, rim: 1, soft: 0 }, '#80e8ff');
  ok(first.width === '96%' && first.left === '2%' && first.marginTop === '2%' && first.top === 0, 'first pass: 96% wide, centred on the wheel');
  ok(first.background === 'radial-gradient(circle, rgba(6,10,24,0.88) 0 62%, rgba(6,10,24,0.7216) 100%)', `first pass glass: navy .88 → .82 of it at the rim (${first.background})`);
  ok(first.backdropFilter === 'blur(10px)' && first.WebkitBackdropFilter === 'blur(10px)', 'first pass: 10px blur');
  ok(first.boxShadow.includes('#80e8ff 38%') && first.boxShadow.includes('#80e8ff 45%') && first.boxShadow.includes('inset 0 0 40px rgba(0,0,0,0.55)'), 'first pass: the accent glow and the inner shade');
  ok(!first.maskImage, 'first pass: a hard rim (no mask, so the glow ring stays)');
  const d = poolDiscStyle({}, '#80e8ff');
  ok(PAD_TURN.poolDisc === .42 && PAD_TURN.poolBlur === 3 && PAD_TURN.poolDiscEdge === .97 && PAD_TURN.poolDiscRim === 1.25 && PAD_TURN.poolDiscSoft === 31, "⭐ the defaults are Alex's dial-in (5 of 10 moved)");
  ok(d.background === 'radial-gradient(circle, rgba(6,10,24,0.42) 0 62%, rgba(6,10,24,0.4074) 100%)', `his glass: 58% see-through, nearly even to the rim (${d.background})`);
  ok(d.backdropFilter === 'blur(3px)' && d.maskImage === 'radial-gradient(closest-side, #000 69%, transparent 100%)' && d.width === '96%', 'his: 3px blur, the edge fading over the last 31%, the size untouched');
  const glass = poolDiscStyle({ disc: .4, tint: 'black', rim: 0, soft: 20, size: 110, blur: 4 }, '#80e8ff');
  ok(glass.background.startsWith('radial-gradient(circle, rgba(0,0,0,0.4) 0 62%'), 'darkness .4 in black is 60% see-through');
  ok(glass.width === '110%' && glass.left === '-5%' && glass.marginTop === '-5%', 'a bigger disc stays centred on the wheel');
  ok(!glass.boxShadow.includes('38%') && glass.boxShadow.includes('rgba(0,0,0,0.25)'), 'no glow ring at rim 0; the inner shade thins with the glass');
  ok(glass.maskImage === 'radial-gradient(closest-side, #000 80%, transparent 100%)' && glass.backdropFilter === 'blur(4px)', 'a soft edge fades out over the last 20%');
  ok(poolDiscStyle({ tint: 'spirit' }, '#ff0000').background.includes('rgba(56,8,19'), "'spirit' washes the glass with a fifth of the accent");
  const g = poolScrimGradient('50% 50%');
  ok(g.includes('var(--pool-hole, .55)') && g.includes('var(--pool-reach, 340px)'), 'the dim: hole .55 and reach 340px unless the levers say otherwise');
  ok(['poolDiscEdge', 'poolDiscTint', 'poolDiscSize', 'poolDiscRim', 'poolDiscSoft', 'poolDimHole', 'poolDimReach'].every(k => k in PAD_TURN), 'every window lever has a PAD_TURN default');
}
ok(!('dbBadges' in WHEEL_DEFAULTS), '🪦 the wheel no longer badges endings with Db (cut 2026-10-02)');
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
  // 🎡 Turn · Scale · Rivals. ⭐ 2026-10-14: while you COMPOSE (Chord, Melody) the note
  // pool IS the scale wheel, big over the arena — so the Scale chip (and W) show / hide
  // THAT, and the small card under the chips stands down (one wheel, not two).
  const chips = () => [...document.querySelectorAll('[aria-label="Arena panels"] button')];
  const pool = () => document.querySelector('[data-pool-wheel]');
  ok(chips().map(b => b.textContent).join() === 'Turn,Scale,Rivals', 'nav reads Turn · Scale · Rivals');
  ok(document.querySelector('.match-player-card'), 'the Spirit card on the left is untouched');
  ok(pool()?.querySelector('[data-scale-wheel]')?.dataset.scaleWheel === 'cosmic_ronin', "composing: the pool is the Ronin's wheel");
  ok(!panel(), '…and the small card under the chips stands down (no second wheel)');
  ok(chips()[1].getAttribute('aria-expanded') === 'true', 'the Scale chip shows the pool open');
  ok(document.querySelector('[data-hud-region="turn"]')?.hidden === false, 'the Turn controls stay up beside it');
  await click(chips()[1]);
  ok(!pool() && chips()[1].getAttribute('aria-expanded') === 'false', 'the Scale chip puts the pool away (to see the board)');
  await click(chips()[1]);
  ok(pool(), 'and brings it back');
  const s0 = sheet();
  const pc = pitchIndex(s0.noteStock[0]);
  const slot = () => pool()?.querySelector(`[data-wheel-pc="${pc}"]`);
  ok(slot()?.classList.contains('is-held'), `slot ${s0.noteStock[0]} is marked held`);
  const stack0 = (s0.driveStack ?? []).length;
  await click(slot());
  ok(sheet().melodyLine.length === 0 && (sheet().driveStack ?? []).length === stack0 + 1,
    'in step 1 a pool click commits to a STACK (Drive, the first open one) — never into the track');
  await click(button('Continue to Melody'));
  ok(pool(), 'still there in the melody step');
  const pc2 = pitchIndex(sheet().noteStock.find((n, i) => !(sheet().usedStockIdx ?? []).includes(i)));
  await click(pool().querySelector(`[data-wheel-pc="${pc2}"]`));
  ok(sheet().melodyLine.length === 1 && pitchIndex(sheet().melodyLine[0]) === pc2, 'clicking a slot played that note');
  ok(button('Commit (1 notes'), 'through the normal track (Commit counts it)');
  const empty = [...pool().querySelectorAll('[data-wheel-pc]')].find(g => !g.classList.contains('is-held'));
  await click(empty);
  ok(sheet().melodyLine.length === 1, 'a slot you do not hold does nothing');
  let ev = await press('w');
  ok(ev.defaultPrevented && !pool(), 'W puts the pool away while composing');
  await press('w');
  ok(pool(), 'W brings the pool back');
  // ── Move & Act: the pool goes (the hand is spent), the card under the chips is back ──
  await click(button('Commit (1 notes'));
  ok(!pool(), 'committed: the pool goes');
  ok(document.querySelector('.match-panel-dock')?.contains(panel()), 'the card is back under the nav chips');
  ok(document.querySelector('[data-scale-wheel]')?.dataset.scaleWheel === 'cosmic_ronin', "it is the Ronin's wheel");
  ok(document.querySelector('[data-wheel-pc] title')?.textContent.length > 3, 'hover tooltips on the nav wheel');
  await click(chips()[1]);
  ok(!panel() && chips()[1].getAttribute('aria-expanded') === 'false', 'the Scale chip closes it');
  ok(JSON.parse(globalThis.localStorage.getItem('rlsw.scaleWheelOpen') || '{}').cosmic_ronin === false, 'remembered per character');
  await click(chips()[1]);
  ok(panel(), 'and opens it again');
  ev = await press('w');
  ok(ev.defaultPrevented && !panel(), 'W closes it in Move & Act');
  await press('w');
  ok(panel(), 'W opens it again');
  console.log(`PASS: ${checks} checks`);
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
process.exit(0);
