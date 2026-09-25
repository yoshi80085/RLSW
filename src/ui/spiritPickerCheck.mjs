// 🎭 spiritPickerCheck — `test:spiritpicker`. The select screen's 3D standees,
// the pop on hover and the backstory on a long hover (Alex, 2026-09-25; dial-in
// off `.scratch/spirit-picker-preview.html`).
//
// Plain node (+ the asset stub, because the roster imports its PNGs). The pure
// half is asserted on numbers, the framing is checked by projecting through a
// real three camera, and the wiring is read off the source — the stage itself
// needs WebGL, which node does not have, so that part was verified in Chromium
// and is recorded in the handoff rather than faked here.
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { SPIRIT_PICKER as P, popTarget, easePop, storyShowing, typedChars, pickerFraming, idleYaw, storyX, canUseWebGL }
  from './spiritPickerStage.js';
import { SPIRIT_STORIES, storyFor } from '../data/spiritStories.js';
import { ROSTER_ORDER } from '../data/spirits.js';
import { STANDEE } from '../board/standee.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else fail++; if (!cond || process.env.VERBOSE) console.log(`  ${cond ? '✓' : '✗'} ${name}${extra !== '' ? ' — ' + extra : ''}`); };
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
console.log('🎭 spiritPickerCheck — the standees on the select screen\n');

console.log('§0 the numbers are the dial-in');
ok('SPIRIT_PICKER is frozen', Object.isFrozen(P));
ok('SPIRIT_PICKER is the 2026-09-25 dial-in (2 of 31 levers moved: panelLook glass → tint, compare off)',
  JSON.stringify(P) === JSON.stringify({
    panelLook:'tint', halo:'on', fit:0.72, footPad:54, elev:10, fov:28, locked:'silhouette',
    idle:'sway', idleYaw:-16, swayDeg:8, swaySpeed:0.5,
    popDelay:120, popSpeed:12, popScale:1.3, popLift:0.35, popTurn:'on', popGlow:2, popRing:'on',
    cardLift:6, dimOthers:0.35, bleed:110, selectSpin:'on',
    storyDelay:1300, storyAt:'beside', storyWidth:300, storyCps:160, storyStats:'on' }));
ok('the picker only tints its own sheets — the board keeps glass', STANDEE.panelLook === 'glass' && P.panelLook === 'tint');
{
  // ⚠️ The page is where the next dial-in comes from. If a number moves here and
  // not there, his next paste is measured against defaults that no longer exist.
  const page = new URL('../../.scratch/spirit-picker-preview.js', import.meta.url);
  if (existsSync(page)) {
    const src = readFileSync(page, 'utf8');
    const def = k => { const m = src.match(new RegExp(`k:'${k}'[^\\n]*?def:([^,}\\n]+)`)); return m && m[1].trim().replace(/^'|'$/g, ''); };
    // `panelLook` is the one he moved: the page defaults to the board's setting on purpose.
    const same = (a, b) => (typeof b === 'number' ? Number(a) === b : String(a) === String(b));
    const off = Object.keys(P).filter(k => k !== 'panelLook' && !same(def(k), P[k])).map(k => `${k}=${def(k)}≠${P[k]}`);
    ok('every lever on the preview page equals the shipped number', off.length === 0, off.join(', '));
    ok('…and `panelLook` is the one he changed, off the page default (the board\'s glass)', def('panelLook') === 'STANDEE.panelLook' && P.panelLook === 'tint');
    ok('the page\'s placeholder stories are the shipped ones', ROSTER_ORDER.every(id => SPIRIT_STORIES[id].paragraphs.every(t => src.includes(t))));
  } else console.log('  (preview page not present — parity skipped)');
}

console.log('§1 every Spirit has a story');
for (const id of ROSTER_ORDER) {
  const s = SPIRIT_STORIES[id];
  ok(`${id}: a story with at least one paragraph`, !!s && s.paragraphs.length > 0 && s.paragraphs.every(t => typeof t === 'string' && t.length > 10));
  ok(`${id}: says whether it is placeholder`, typeof s?.placeholder === 'boolean');
}
ok('the stories are frozen', Object.isFrozen(SPIRIT_STORIES));
ok('a Spirit with no story gets a stand-in, not a crash', storyFor('someone_new').paragraphs.length === 1 && storyFor('someone_new').placeholder === true);

console.log('§2 the timing');
ok('no pop before the dialled delay', popTarget(P.popDelay - 1, P) === 0);
ok('…a pop at exactly the delay', popTarget(P.popDelay, P) === 1);
ok('not hovered → no pop', popTarget(null, P) === 0);
ok('a locked Spirit never pops', popTarget(99999, P, { locked:true }) === 0);
{
  let p = 0, prev = 0, mono = true;
  for (let i = 0; i < 120; i++) { p = easePop(p, 1, 1 / 60, P); if (p < prev || p > 1) mono = false; prev = p; }
  ok('the pop eases up without overshooting', mono && p === 1, `after 2 s: ${p}`);
  ok('…and it is snappy: over 80% there in a quarter second', (() => { let q = 0; for (let i = 0; i < 15; i++) q = easePop(q, 1, 1 / 60, P); return q > 0.8; })());
  ok('reduced motion snaps straight to the target', easePop(0, 1, 1 / 60, P, true) === 1 && easePop(1, 0, 1 / 60, P, true) === 0);
}
ok('no story before the dialled delay', !storyShowing(P.storyDelay - 1, P));
ok('…the story at exactly the delay', storyShowing(P.storyDelay, P));
ok('the story waits for a LONGER hover than the pop', P.storyDelay > P.popDelay * 4);
ok('Escape puts the story away while the card is still hovered', !storyShowing(99999, P, true));
ok('the story types on at the dialled speed', typedChars(1000, 500, P) === P.storyCps && typedChars(0, 500, P) === 0);
ok('…never past its own end', typedChars(1e9, 500, P) === 500);
ok('reduced motion shows the whole story at once', typedChars(0, 500, P, true) === 500);
ok('cps 0 means instant', typedChars(0, 500, { ...P, storyCps:0 }) === 500);

console.log('§3 the framing, through a real three camera');
for (const [label, rect] of [['desktop card (220px)', { left:100, top:200, width:300, height:220 }], ['tablet card (190px)', { left:0, top:0, width:150, height:190 }]]) {
  rect.right = rect.left + rect.width; rect.bottom = rect.top + rect.height;
  const f = pickerFraming(rect, P);
  const cam = new THREE.PerspectiveCamera(P.fov, f.vw / f.vh, 0.1, 200);
  cam.position.set(0, f.camY, f.camZ); cam.lookAt(0, f.lookY, 0); cam.updateMatrixWorld();
  const py = y => { const v = new THREE.Vector3(0, y, 0).project(cam); return f.vy + (1 - v.y) / 2 * f.vh; };
  const feet = py(0), top = py(STANDEE.height + 0.15);
  ok(`${label}: the feet stand footPad above the card's bottom edge`, Math.abs(feet - (rect.bottom - P.footPad)) < 3, `${feet.toFixed(1)} vs ${rect.bottom - P.footPad}`);
  ok(`${label}: the standee is \`fit\` of the card tall`, Math.abs((feet - top) - P.fit * rect.height) < 3, `${(feet - top).toFixed(1)}px vs ${(P.fit * rect.height).toFixed(1)}`);
  ok(`${label}: the drawing area is the card plus the bleed on every side`, f.vx === rect.left - P.bleed && f.vw === rect.width + 2 * P.bleed && f.vh === rect.height + 2 * P.bleed);
  const popTop = py((STANDEE.height + 0.15) * P.popScale + P.popLift);
  ok(`${label}: a popped standee rises past the card's top edge but stays inside its bleed`, popTop < rect.top && popTop > f.vy,
    `pop top ${popTop.toFixed(0)}px · card top ${rect.top} · bleed top ${f.vy}`);
}

console.log('§4 idle motion and the story\'s side');
ok('still → the dialled three-quarter angle', idleYaw(5, 0, { ...P, idle:'still' }) === P.idleYaw * Math.PI / 180);
{
  let lo = 9, hi = -9;
  for (let t = 0; t < 20; t += 0.05) { const y = idleYaw(t, 0, P); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  const d = r => r * 180 / Math.PI;
  ok('sway stays within ±swayDeg of the resting angle', d(hi) <= P.idleYaw + P.swayDeg + 1e-6 && d(lo) >= P.idleYaw - P.swayDeg - 1e-6, `${d(lo).toFixed(1)}…${d(hi).toFixed(1)}°`);
}
ok('reduced motion holds still', idleYaw(3.3, 1, P, true) === P.idleYaw * Math.PI / 180);
ok('turntable wraps to ±π (no unbounded angle to lerp through)', Math.abs(idleYaw(1000, 0, { ...P, idle:'turntable' })) <= Math.PI);
ok('the story goes to the RIGHT of a card when there is room', storyX({ left:100, right:400 }, 300, 1400) === 414);
ok('…to the LEFT when there is not', storyX({ left:900, right:1200 }, 300, 1300) === 586);
ok('…and never off the screen', storyX({ left:10, right:300 }, 300, 500) >= 8 && storyX({ left:10, right:300 }, 300, 500) <= 500 - 300 - 8);

console.log('§5 the wiring');
{
  const stage = read('./spiritPickerStage.js'), draft = read('./SpiritDraft.jsx'), css = read('./SpiritDraft.css');
  ok('no window at all (SSR) → the flat art', canUseWebGL() === false);
  globalThis.window = {};
  ok('a window WITHOUT WebGL2 (jsdom in test:loadoutui, an old browser) → the flat art', canUseWebGL() === false);
  globalThis.window.WebGL2RenderingContext = function WebGL2RenderingContext() {};
  ok('…a window WITH it → the standees', canUseWebGL() === true);
  delete globalThis.window;
  ok('ONE renderer for every card', (stage.match(/new THREE\.WebGLRenderer\(/g) ?? []).length === 1);
  ok('the stage builds the REAL board standee, not a copy', /import \{ createStandee, STANDEE \} from '\.\.\/board\/standee\.js'/.test(stage) && /createStandee\(sp, \{ T:\{ \.\.\.STANDEE, panelLook:P\.panelLook \} \}\)/.test(stage));
  ok('the canvas never takes a click', /\.draft-standee-layer\{[^}]*pointer-events:none/.test(css));
  ok('the popped card is drawn LAST, over its neighbours', /sort\(\(a, b\) => a\.p - b\.p\)/.test(stage));
  ok('a standee is clipped to the panel it scrolls in (it must not draw over the lobby header)', /scrollersOf\(slot\)/.test(stage) && !/'hidden'\) out\.push/.test(stage) && /setScissor\(sx0/.test(stage));
  ok('the story is built with textContent, never innerHTML', !/innerHTML/.test(stage));
  ok('dispose takes the canvas, the story and the GPU context away', /canvas\.remove\(\); story\.remove\(\)/.test(stage) && /forceContextLoss\(\)/.test(stage));
  ok('the roster asks canUseWebGL before it builds anything', /useState\(\(\) => canUseWebGL\(\)\)/.test(draft));
  ok('…falls back to the flat art if the stage throws', /catch \{ queueMicrotask\(\(\) => setThreeD\(false\)\)/.test(draft));
  ok('…and the flat art is today\'s img + plinth, only when there is no 3D', /\{!threeD && <><img src=\{sp\.imageSrc\}/.test(draft));
  ok('hover is on the SLOT, so the disabled (locked) card still reports it', /className="draft-slot"[^>]*\n?\s*onPointerEnter=/.test(draft));
  ok('keyboard focus is the hover, and Escape puts the story away', /onFocus=\{\(\)=>s\(\)\?\.hover\(id\)\}/.test(draft) && /e\.key === 'Escape'\) s\(\)\?\.dismiss\(id\)/.test(draft));
  ok('a pick tells the stage (the spin) before the game', /s\(\)\?\.picked\(id\); onChooseSpirit\(corner,id\)/.test(draft));
  ok('the card is still a .draft-portrait button (test:loadoutui clicks it)', /<button ref=\{keep\(id, 'el'\)\} className=\{`draft-portrait/.test(draft));
}

console.log(`\n${fail ? '❌' : '✅'} spiritPickerCheck: ${fail ? `${fail} failed, ` : ''}${pass} passed`);
process.exit(fail ? 1 : 0);
