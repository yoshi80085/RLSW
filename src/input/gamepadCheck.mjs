// ─── 🎮 GAMEPAD CHECK — the map, the runtime, the highlight, the wiring ─────
// Run: npm run test:gamepad
//   §1 the map: six strings on six different fingers, no button doing two jobs
//   §2 reading a pad: deadzone, trigger hysteresis by VALUE (not `.pressed`)
//   §3 the stick walks toward SCREEN-up — checked against a real three.js camera
//   §4 the Riff-Off layer: strings down/up as keys 1–6 (key AND code), bends, start/back
//   §5 the turn layer: keys, highlight, walk, lens, zoom, activity
//   §6 layers: a riff claim wins, a held button never leaks across a switch
//   §7 the highlight's geometry (padNav)
//   §8 the highlight in a DOM: what counts, what is on top, press = click, hover, sliders
//   §9 the wiring in the source: who claims the riff layer, who hears the pad
//   §11 a turn on a pad, IN THE GAME: the wheel picker, the hammer flick, the cross, legal-only aiming
import assert from 'node:assert/strict';
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';
import { PAD_BUTTONS, RIFF_LAYOUT, TURN_LAYOUT, WALK_CODES, PAD_ACTIVITY_EVENT, deadzone, readPad,
  padEdges, heldStrings, stickFlick, stickBoardAngle, walkCodeFor } from './padMap.js';
import { createPadRuntime, claimPadLayer, padLayer } from './gamepad.js';
import { navScore, pickNeighbor, nearestTo, inLine } from './padNav.js';
import { createPadFocus, PAD_RING, PAD_GUARD, PAD_ECHO_EVENT, INPUT_MODE_EVENT, INPUT_MODE_ATTR } from './padFocus.js';
import { PAD_TURN, PAD_TURN_CHOICES, CROSS_MAPS, createWheelAim, stickClock, pickWheelSlot, stepWheelSlot, hopTarget, cycleTarget } from './padTurn.js';
import { NUMPAD_DIRS } from '../ui/numpadMove.js';
import { lensHeading, turnLens } from '../board/topDownView.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const near = (a, b, tol, m) => { assert.ok(Math.abs(a - b) <= tol, `${m} (got ${a})`); checks++; };
const src = p => readFileSync(new URL(p, import.meta.url), 'utf8');

// A fake Gamepad: `held` names down, triggers by value, sticks by axes.
function pad({ held = [], lt = 0, rt = 0, ls = [0, 0], rs = [0, 0], index = 0 } = {}) {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  for (const n of held) buttons[PAD_BUTTONS[n]] = { pressed: true, value: 1 };
  buttons[PAD_BUTTONS.LT] = { pressed: lt > .1, value: lt };
  buttons[PAD_BUTTONS.RT] = { pressed: rt > .1, value: rt };
  return { index, connected: true, mapping: 'standard', buttons, axes: [...ls, ...rs] };
}

// ── §1 the map ──
{
  const fingers = { LT: 'L-middle', LB: 'L-index', Up: 'L-thumb', Down: 'L-thumb', Left: 'L-thumb', Right: 'L-thumb',
    A: 'R-thumb', B: 'R-thumb', X: 'R-thumb', Y: 'R-thumb', RB: 'R-index', RT: 'R-middle' };
  const used = new Map();
  for (let s = 1; s <= 6; s++) {
    const names = RIFF_LAYOUT.strings[s];
    ok(names?.length, `string ${s} has buttons`);
    const f = new Set(names.map(n => fingers[n]));
    ok(f.size === 1 && !f.has(undefined), `string ${s} is played by ONE finger (${[...f]})`);
    const finger = [...f][0];
    ok(!used.has(finger), `string ${s}'s finger (${finger}) plays no other string — any chord is playable`);
    used.set(finger, s);
    for (const n of names) ok(n in PAD_BUTTONS, `${n} is a real button`);
  }
  eq([...used.values()], [1, 2, 3, 4, 5, 6], 'six strings, six fingers');
  eq(RIFF_LAYOUT.strings[1], ['LT'], '1 = left trigger (outermost left)');
  eq(RIFF_LAYOUT.strings[6], ['RT'], '6 = right trigger (outermost right)');
  const riffAll = Object.values(RIFF_LAYOUT.strings).flat();
  for (const n of [...RIFF_LAYOUT.start, ...RIFF_LAYOUT.back]) ok(!riffAll.includes(n), `riff ${n} is not also a string`);
  const turnUse = [...Object.keys(TURN_LAYOUT.keys), ...TURN_LAYOUT.press, ...TURN_LAYOUT.menu, ...Object.keys(TURN_LAYOUT.nav)];
  eq(new Set(turnUse).size, turnUse.length, 'no turn button does two jobs');
  for (const n of turnUse) ok(n in PAD_BUTTONS, `turn button ${n} is real`);
  eq(TURN_LAYOUT.keys.Y, { key: 'Enter', code: 'Enter' }, 'Y = Enter: Continue → Commit → End turn, through the same handlers');
  eq(TURN_LAYOUT.keys.RS.code, 'Numpad5', 'clicking the right stick = Numpad5 (face north)');
  eq(Object.keys(WALK_CODES).sort(), Object.keys(NUMPAD_DIRS).sort(), 'the stick walks with exactly the numpad\'s six keys');
  for (const [code, deg] of Object.entries(WALK_CODES)) ok(Math.abs(deg * Math.PI / 180 - NUMPAD_DIRS[code].angle) < 1e-9, `${code} points where the numpad says`);
}

// ── §2 reading a pad ──
{
  eq(deadzone(.1, .1), { x: 0, y: 0, m: 0 }, 'inside the deadzone reads nothing');
  ok(Math.abs(deadzone(1, 0).m - 1) < 1e-9 && Math.abs(deadzone(1, 0).x - 1) < 1e-9, 'full over reads 1');
  ok(deadzone(.3, 0).m < .1, 'just past the deadzone reads small, not .3 (rescaled)');
  let s = readPad(pad({ lt: .25 }));
  ok(!s.down.LT, 'a trigger at .25 is not down (press at .30)');
  s = readPad(pad({ lt: .31 }), s);
  ok(s.down.LT, 'a trigger at .31 is down');
  s = readPad(pad({ lt: .2 }), s);
  ok(s.down.LT, '…and at .20 it STAYS down (hysteresis: no chattering sustain)');
  s = readPad(pad({ lt: .17 }), s);
  ok(!s.down.LT, '…and lets go under .18');
  const fake = pad(); fake.buttons[PAD_BUTTONS.RT] = { pressed: true, value: .13 };
  ok(!readPad(fake).down.RT, 'a trigger the BROWSER calls pressed at .13 is not down — the value decides, on every machine');
  eq(padEdges(readPad(pad({ held: ['A'] })), readPad(pad({ held: ['B'] }))), { pressed: ['B'], released: ['A'] }, 'edges: B went down, A came up');
  eq([...heldStrings(readPad(pad({ held: ['Left', 'Y', 'RB'], lt: 1 })))].sort(), [1, 3, 4, 5], 'held strings from a snapshot');
  let f = stickFlick({ x: 0, y: -.7, m: .7 }, false);
  eq(f, { armed: true, fire: 'up' }, 'a flick up fires once');
  f = stickFlick({ x: 0, y: -.9, m: .9 }, f.armed);
  eq(f.fire, null, '…and not again while it is held out');
  f = stickFlick({ x: 0, y: -.4, m: .4 }, f.armed);
  ok(f.armed, '…nor while it hovers between Off and On');
  f = stickFlick({ x: 0, y: 0, m: 0 }, f.armed);
  ok(!f.armed, 'back to centre re-arms it');
}

// ── §3 the stick walks toward screen-up — against a REAL camera ──
{
  eq(walkCodeFor(stickBoardAngle(0, -1, 0)), 'Numpad8', 'lens facing north: stick up = Numpad8 (north)');
  eq(walkCodeFor(stickBoardAngle(0, 1, 0)), 'Numpad2', 'lens facing north: stick down = Numpad2');
  eq(walkCodeFor(stickBoardAngle(0, -1, Math.PI)), 'Numpad2', 'lens turned round (facing south): stick up walks SOUTH, toward screen-up');
  // Property: for any heading and any push, the step taken, drawn on screen by a
  // real three.js camera, points within 30° (+ a little perspective) of the push.
  const target = new THREE.Vector3(0, 0, 0);
  const cam = new THREE.PerspectiveCamera(40, 1, .1, 500);
  let worst = 0, cases = 0;
  for (let hd = -180; hd < 180; hd += 15) {
    const p = turnLens({ x: 0, y: 30, z: 4 }, target, hd * Math.PI / 180);   // near top-down, so screen ≈ board
    cam.position.set(p.x, p.y, p.z); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const heading = lensHeading(cam.position, target);
    for (let sd = 0; sd < 360; sd += 10) {
      const sx = Math.cos(sd * Math.PI / 180), sy = Math.sin(sd * Math.PI / 180);   // gamepad: y DOWN
      const code = walkCodeFor(stickBoardAngle(sx, sy, heading));
      const a = WALK_CODES[code] * Math.PI / 180;
      // board (SVG x, y-down) → world (x, z) — `arenaPoint`
      const step = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).project(cam).sub(target.clone().project(cam));
      const screen = Math.atan2(-step.y, step.x);   // NDC y is UP; flip to the pad's y-down
      let d = Math.abs(screen - Math.atan2(sy, sx)); if (d > Math.PI) d = 2 * Math.PI - d;
      worst = Math.max(worst, d); cases++;
    }
  }
  ok(worst <= 34 * Math.PI / 180, `every push walks within 34° of where it points on screen (worst ${(worst * 180 / Math.PI).toFixed(1)}°, ${cases} cases)`);
}

// ── a runtime harness ──
function harness({ layer = 'turn', heading = 0, context = () => null, padMode = 'pad' } = {}) {
  const sent = [];
  let pads = [pad()], lay = layer;
  const focus = { shown: false, moves: [], presses: 0, adjusted: [], hides: 0, menu: null, adjustOK: false, pads: 0,
    enterPad() { this.pads++; },
    visible() { return this.shown; }, show() { this.shown = true; return true; },
    hide() { this.shown = false; this.hides++; }, move(d) { this.moves.push(d); return true; },
    press() { this.presses++; return true; }, adjust(d) { if (this.adjustOK) { this.adjusted.push(d); return true; } return false; },
    pressSelector(sel) { this.menu = sel; return true; },
    on: null, focused: [], target() { return this.on; }, focusOn(el) { this.on = el; this.shown = true; this.focused.push(el?.id); return true; },
    mode() { return padMode; } };
  const camera = { grabs: [], orbits: [], zooms: [], heading: () => heading,
    grab(on) { this.grabs.push(on); }, orbit(a, b) { this.orbits.push([a, b]); }, zoom(f) { this.zooms.push(f); } };
  let acts = 0;
  const rt = createPadRuntime({ getPads: () => pads, sendKey: (type, k) => sent.push(`${type}:${k.key}/${k.code}`),
    focus, camera: () => camera, activity: () => acts++, layer: () => lay, context });
  let t = 1000;
  const step = (p, ms = 8) => { pads = p ? [p] : []; t += ms; rt.tick(t); };
  return { sent, focus, camera, step, setLayer: l => { lay = l; }, acts: () => acts, clear: () => { sent.length = 0; } };
}

// ── §4 the Riff-Off layer ──
{
  const h = harness({ layer: 'riff' });
  h.step(pad());
  h.step(pad({ lt: 1 }));
  eq(h.sent, ['keydown:1/Digit1'], 'LT strikes string 1 — key "1" (the monolith, the practice highway) AND code Digit1 (the arena duel)');
  h.clear(); h.step(pad({ lt: 1, held: ['A'] }));
  eq(h.sent, ['keydown:4/Digit4'], 'A strikes 4 while 1 rings on — a sustain under a strike');
  h.clear(); h.step(pad({ lt: 1, held: ['A', 'X'] }));
  eq(h.sent, [], 'a second face button is the SAME string: no second strike');
  h.clear(); h.step(pad({ held: ['X'] }));
  eq(h.sent, ['keyup:1/Digit1'], 'letting LT go releases 1; 4 is still held by X');
  h.clear(); h.step(pad());
  eq(h.sent, ['keyup:4/Digit4'], '…and 4 lets go with the last face button');
  h.clear(); h.step(pad({ held: ['Left', 'LB', 'RB'], rt: 1 }));
  eq(h.sent, ['keydown:2/Digit2', 'keydown:3/Digit3', 'keydown:5/Digit5', 'keydown:6/Digit6'], 'a four-string chord in one press: 2, 3, 5, 6');
  h.clear(); h.step(pad({ held: ['Left', 'LB', 'RB'], rt: .25 }));
  eq(h.sent, [], 'RT easing to .25 still holds string 6 (hysteresis)');
  h.clear(); h.step(pad({ held: ['Left', 'LB', 'RB'], rt: 1, rs: [0, -.9] }));
  eq(h.sent, ['keydown:ArrowUp/ArrowUp', 'keyup:ArrowUp/ArrowUp'], 'a right-stick flick up = ↑ bend');
  h.clear(); h.step(pad({ held: ['Left', 'LB', 'RB'], rt: 1, rs: [0, -.95] }));
  eq(h.sent, [], 'holding the stick up does not bend again');
  h.clear(); h.step(pad({ held: ['RB'], ls: [0, .9] }));
  ok(h.sent.includes('keydown:ArrowDown/ArrowDown'), 'a LEFT-stick flick down = ↓ bend (either stick: a thumb is always free)');
  h.clear(); h.step(pad({ held: ['Menu'] }));
  ok(h.sent.includes('keydown:Enter/Enter'), 'Menu = Enter (start the practice highway)');
  h.clear(); h.step(pad({ held: ['View'] }));
  ok(h.sent.includes('keydown:Escape/Escape'), 'View = Escape (B is a string here, so View is "back")');
  h.clear(); h.step(pad({ held: ['B'] }));
  eq(h.sent, ['keydown:4/Digit4'], 'in a duel B is string 4, never "back"');
  eq(h.focus.moves.length + h.focus.presses, 0, 'the highlight never moved or pressed during the riff');
  ok(h.focus.pads > 0 && !h.focus.shown, 'a duel is still pad mode (the mouse arrow stays hidden) but the ring stays off');
}

// ── §5 the turn layer ──
{
  const h = harness();
  h.step(pad());
  for (const [btn, want] of [['Y', 'Enter/Enter'], ['X', 'Backspace/Backspace'], ['LB', 'w/KeyW'], ['RB', 'Tab/Tab'], ['B', 'Escape/Escape'], ['RS', '5/Numpad5']]) {
    h.clear(); h.step(pad({ held: [btn] }));
    eq(h.sent, [`keydown:${want}`], `${btn} sends ${want} down`);
    h.clear(); h.step(pad({ held: [btn] }));
    eq(h.sent, [], `…holding ${btn} never auto-repeats`);
    h.clear(); h.step(pad());
    eq(h.sent, [`keyup:${want}`], '…and up on release');
  }
  ok(h.focus.shown && h.focus.pads > 0, 'any pad press lights the ring at once (pad mode) — and the Y that woke it still went through as Enter');
  h.step(pad({ held: ['A'] })); h.step(pad());
  eq(h.focus.presses, 1, 'with the ring lit, A presses what it highlights');
  const wa = harness(); wa.step(pad()); wa.step(pad({ held: ['A'] })); wa.step(pad());
  ok(wa.focus.shown && wa.focus.presses === 0, 'an A that WAKES the ring only shows it — never a blind click');
  const wd = harness(); wd.step(pad()); wd.step(pad({ held: ['Right'] }));
  ok(wd.focus.shown && wd.focus.moves.length === 0, 'a D-pad press that wakes the ring does not also move it');
  wd.step(pad({ held: ['Right'] }), 600);
  eq(wd.focus.moves.length, 1, '…but holding it on repeats from where the ring woke');
  const ws = harness(); ws.step(pad()); ws.step(pad({ ls: [0, -1] }));
  ok(ws.focus.shown && ws.sent.includes('keydown:8/Numpad8'), 'the stick alone lights the ring too — and still walks');
  h.step(pad({ held: ['Menu'] })); h.step(pad());
  eq(h.focus.menu, 'button[aria-label="Menu"]', 'Menu opens ☰');
  h.focus.moves.length = 0;
  h.step(pad({ held: ['Right'] }));
  eq(h.focus.moves, ['right'], 'D-pad right moves the highlight right');
  h.step(pad({ held: ['Right'] }), 300);
  eq(h.focus.moves.length, 1, '…no repeat before the hold delay');
  h.step(pad({ held: ['Right'] }), 100);
  eq(h.focus.moves.length, 2, '…then it repeats');
  h.step(pad({ held: ['Right'] }), 40);
  eq(h.focus.moves.length, 2, '…at the repeat rate, not every poll');
  h.step(pad({ held: ['Right'] }), 90);
  eq(h.focus.moves.length, 3, '…one more after the repeat interval');
  h.step(pad());
  h.focus.adjustOK = true; h.focus.moves.length = 0;
  h.step(pad({ held: ['Left'] })); h.step(pad());
  ok(h.focus.adjusted[0] === 'left' && h.focus.moves.length === 0, 'on a slider, ←/→ nudges it instead of leaving it');
  h.focus.adjustOK = false;
  h.clear(); h.step(pad({ ls: [0, -1] }));
  eq(h.sent, ['keydown:8/Numpad8', 'keyup:8/Numpad8'], 'left stick up (lens facing north) = Numpad8');
  h.clear(); h.step(pad({ ls: [0, -1] }), 100);
  eq(h.sent, [], 'held: no second step before the walk repeat');
  h.clear(); h.step(pad({ ls: [0, -1] }), 250);
  eq(h.sent, ['keydown:8/Numpad8', 'keyup:8/Numpad8'], 'held: one more step after the walk repeat');
  h.clear(); h.step(pad({ ls: [.87, .5] }), 160);
  eq(h.sent, ['keydown:3/Numpad3', 'keyup:3/Numpad3'], 'swinging the held stick to down-right steps that way at once');
  h.step(pad());
  const south = harness({ heading: Math.PI });
  south.step(pad()); south.step(pad({ ls: [0, -1] }));
  eq(south.sent, ['keydown:2/Numpad2', 'keyup:2/Numpad2'], 'lens turned to face south: stick up walks south (screen-up)');
  h.step(pad({ rs: [1, 0] }));
  eq(h.camera.grabs, [true], 'right stick out = a drag starts (the auto camera yields)');
  ok(h.camera.orbits.at(-1)[0] < 0, 'stick right turns like a mouse dragged right (theta falls)');
  h.step(pad({ rs: [0, -1] }));
  ok(h.camera.orbits.at(-1)[1] < 0, 'stick up tilts toward top-down (phi falls)');
  h.step(pad());
  eq(h.camera.grabs, [true, false], 'stick back to centre = the drag ends');
  h.step(pad({ rt: 1 }), 16);
  ok(h.camera.zooms.at(-1) < 1, 'RT zooms in');
  h.step(pad({ lt: 1 }), 16);
  ok(h.camera.zooms.at(-1) > 1, 'LT zooms out');
  ok(h.acts() > 0, 'the pad reports activity (the idle auto camera hears it)');
  const quiet = harness(); quiet.step(pad()); quiet.step(pad()); quiet.step(pad());
  eq(quiet.acts(), 0, 'an idle pad reports nothing');
  const busy = harness(); busy.step(pad());
  for (let i = 0; i < 25; i++) busy.step(pad({ rs: [.8, 0] }), 4);
  ok(busy.acts() <= 2, `activity is throttled (${busy.acts()} in 100 ms of stick)`);
}

// ── §6 layers ──
{
  eq(padLayer(), 'turn', 'no claim = the turn layer');
  const a = claimPadLayer('riff');
  eq(padLayer(), 'riff', 'a claim takes the pad');
  const b = claimPadLayer('menu');
  a();
  eq(padLayer(), 'menu', 'releasing an older claim leaves the newest');
  b();
  eq(padLayer(), 'turn', 'all released = turn');
  const h = harness({ layer: 'riff' });
  h.step(pad()); h.step(pad({ lt: 1, held: ['A'] }));
  h.clear(); h.setLayer('turn'); h.step(pad({ lt: 1, held: ['A'] }));
  eq(h.sent.sort(), ['keyup:1/Digit1', 'keyup:4/Digit4'], 'the duel ending lets go of every held string');
  eq(h.focus.presses + Number(h.focus.shown), 0, '…and the A still held from the duel does NOT press anything on the turn screen');
  h.step(pad()); h.step(pad({ held: ['A'] }));
  ok(h.focus.shown, 'a fresh A afterwards works');
  const edge = harness({ layer: 'riff' }); edge.step(pad());
  edge.setLayer('turn'); edge.step(pad({ held: ['A'] }));
  ok(!edge.focus.shown && edge.focus.presses === 0, 'an A landing on the very poll the duel ends belongs to neither layer (the last strum clicks nothing)');
  const g = harness(); g.step(pad()); g.step(pad({ rs: [1, 0] }));
  g.setLayer('riff'); g.step(pad({ rs: [1, 0] }));
  eq(g.camera.grabs, [true, false], 'a duel starting mid-camera-turn ends the drag');
  ok(g.focus.hides >= 1, '…and hides the highlight');
  const lost = harness({ layer: 'riff' }); lost.step(pad()); lost.step(pad({ held: ['RB'] }));
  lost.clear(); lost.step(null);
  eq(lost.sent, ['keyup:5/Digit5'], 'a pad unplugged mid-note lets the note go');
}

// ── §7 the highlight's geometry ──
{
  const R = (left, top, width = 40, height = 20) => ({ left, top, width, height });
  const row = [R(0, 0), R(60, 2), R(120, 0), R(60, 60)];
  eq(pickNeighbor(row[0], row, 'right'), 1, 'right walks along the row');
  eq(pickNeighbor(row[1], row, 'right'), 2, '…and on');
  eq(pickNeighbor(row[2], row, 'right'), -1, 'nothing further right: stay');
  eq(pickNeighbor(row[1], row, 'down'), 3, 'down drops to the box below');
  eq(pickNeighbor(row[3], row, 'up'), 1, 'up comes back');
  const lined = [R(0, 0, 40, 40), R(200, 10, 40, 40), R(50, 70, 40, 40)];
  eq(pickNeighbor(lined[0], lined, 'right'), 1, 'a box in line across the press beats a nearer one off the line');
  ok(navScore(R(0, 0), R(2, 0), 'right') === Infinity, 'a box barely ahead is not "that way" (no ping-pong)');
  ok(navScore(R(0, 0), R(10, 300), 'right') === Infinity, 'a box far off to the side is not "right"');
  ok(inLine(row[0], row[1], 'right') && !inLine(row[0], row[3], 'right'), 'inLine: same row yes, the row below no');
  eq(nearestTo({ x: 125, y: 5 }, row), 2, 'the highlight lands nearest where it was');
  // 🐛 Found in the Controller Lab: from a WIDE button, Right dropped to a chip in
  // the row below (centres were measured; the next button's centre was far away).
  const hud = [R(0, 0, 160, 32), R(170, 0, 90, 32), R(100, 45, 34, 40), R(140, 45, 34, 40), R(180, 45, 34, 40)];
  eq(pickNeighbor(hud[0], hud, 'right'), 1, 'Right from a wide button is the next button in its row, not a chip below it');
  eq(pickNeighbor(hud[1], hud, 'down'), 4, 'Down from that button is the chip under it');
  eq(pickNeighbor(hud[2], hud, 'right'), 3, 'Right along the chips stays in the chips');
  // 🐛 Found in the Controller Lab, 14 Oct: Right from a button hopped UP to a chip
  // that overlapped it sideways instead of going on along its own row.
  const row2 = [R(0, 100, 128, 30), R(122, 50, 34, 40), R(280, 100, 110, 30)];
  eq(pickNeighbor(row2[0], row2, 'right'), 2, 'Right goes on along its own row, not up to a chip that overlaps it');
  const lonely = [R(0, 0, 40, 30), R(60, 60, 40, 30)];
  eq(pickNeighbor(lonely[0], lonely, 'right'), 1, 'with nothing in line, Right still cuts across to the next row');
}

// ── §8 the highlight in a DOM ──
{
  const dom = new JSDOM(`<body>
    <button id="a">A</button><button id="b">B</button><button id="c" disabled>C</button>
    <div id="d" style="cursor: pointer">D</div><span id="e">plain</span>
    <button id="f" data-pad="skip">F</button><button id="g">covered</button><div id="scrim"></div>
    <input id="r" type="range" min="0" max="100" step="1" value="50">
    <button id="h" data-pad-default>default</button><button id="o"><span style="cursor: pointer">inner</span></button>
  </body>`, { pretendToBeVisual: true });
  const { window } = dom, doc = window.document;
  const rects = { a: [10, 10], b: [80, 10], c: [150, 10], d: [220, 10], e: [290, 10], f: [10, 60], g: [80, 60], r: [150, 60], h: [220, 60], o: [290, 60] };
  for (const [id, [x, y]] of Object.entries(rects)) {
    doc.getElementById(id).getBoundingClientRect = () => ({ left: x, top: y, width: 50, height: 30, right: x + 50, bottom: y + 30 });
  }
  const scrim = doc.getElementById('scrim');
  doc.elementFromPoint = (x, y) => {
    for (const [id, [rx, ry]] of Object.entries(rects)) {
      if (x >= rx && x < rx + 50 && y >= ry && y < ry + 30) return id === 'g' ? scrim : doc.getElementById(id);
    }
    return doc.body;
  };
  Object.defineProperty(window, 'innerWidth', { value: 800 }); Object.defineProperty(window, 'innerHeight', { value: 600 });
  const f = createPadFocus({ doc, win: window, look: { ...PAD_RING, glide: 0, pulse: 0 } });
  eq(f.candidates().map(el => el.id).sort(), ['a', 'b', 'd', 'h', 'o', 'r'],
    'targets: buttons, a cursor:pointer div, a slider — not disabled, skipped, plain or covered ones; the outer of a nested pair');
  const seen = [];
  for (const t of ['mouseover', 'mouseout', 'pointerover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    doc.addEventListener(t, e => seen.push(`${t}:${e.target.id}:${e.rlswPad ? 'pad' : 'real'}`));
  }
  f.show();
  eq(f.target()?.id, 'h', 'the highlight first lands on [data-pad-default]');
  ok(seen.includes('mouseover:h:pad') && seen.includes('pointerover:h:pad'), 'landing hovers it (React onMouseEnter / onPointerEnter) — tagged as the pad');
  seen.length = 0;
  f.move('up');
  eq(f.target()?.id, 'd', 'up from h is d (above it)');
  ok(seen.includes('mouseout:h:pad') && seen.includes('mouseover:d:pad'), 'moving un-hovers the old target and hovers the new');
  f.move('left');
  eq(f.target()?.id, 'b', 'left from d skips the disabled C to B');
  seen.length = 0;
  f.press();
  eq(seen.filter(s => !s.startsWith('mouseo') && !s.startsWith('pointero')),
    ['pointerdown:b:pad', 'mousedown:b:pad', 'pointerup:b:pad', 'mouseup:b:pad', 'click:b:pad'], 'A = the full mouse click sequence on the target');
  let changed = null;
  doc.getElementById('r').addEventListener('input', e => { changed = e.target.value; });
  f.move('down');
  eq(f.target()?.id, 'r', 'down from B reaches the slider (C above it is disabled, G beside it is covered)');
  ok(f.adjust('right') && changed === '55', `→ on the slider moves it a twentieth (now ${changed}) and React hears an input event`);
  ok(!f.adjust('up'), '↑ on a slider is a move, not a nudge');
  const pm = new window.MouseEvent('pointermove', { bubbles: true });
  Object.defineProperty(pm, 'movementX', { value: 20 });
  doc.body.dispatchEvent(pm);
  ok(!f.visible(), 'a real mouse move hands control back (the ring hides)');
  ok(f.pressSelector('#a') && f.visible() && f.target()?.id === 'a', 'pressSelector presses AND highlights (Menu → ☰)');
  ok(doc.querySelector('[data-pad-ring]')?.style.pointerEvents === 'none', 'the ring never catches a click');
  f.dispose();
  ok(!doc.querySelector('[data-pad-ring]'), 'dispose removes the ring');
  window.close();
}

// ── §8c 🛡️ the emulation guard: a pad that is ALSO a mouse and keyboard (Steam Input, DS4Windows) ──
{
  const dom = new JSDOM(`<body><button id="x">✕ close</button></body>`, { pretendToBeVisual: true });
  const { window } = dom, doc = window.document;
  // jsdom marks every scripted event untrusted, so these stand-ins for the OS's echoes are
  // declared "from the OS" here; the default (`isTrusted`) is checked further down.
  const f = createPadFocus({ doc, win: window, look: { ...PAD_RING, glide: 0, pulse: 0 }, fromOs: e => !e.byGame });
  const html = doc.documentElement;
  let clicked = 0, keys = [];
  doc.getElementById('x').addEventListener('click', () => clicked++);
  window.addEventListener('keydown', e => keys.push(e.key));
  const echoes = [];
  doc.addEventListener(PAD_ECHO_EVENT, e => echoes.push(e.detail.echoes));
  const move = (dx, tagged = false) => { const ev = new window.MouseEvent('pointermove', { bubbles: true }); Object.defineProperty(ev, 'movementX', { value: dx }); if (tagged) Object.defineProperty(ev, 'rlswPad', { value: true }); doc.body.dispatchEvent(ev); };
  f.enterPad(); f.show();
  f.padPulse(true);   // the stick is pushed
  move(40);
  eq(html.getAttribute(INPUT_MODE_ATTR), 'pad', '⭐ a mouse move WHILE the stick is pushed is the pad\'s echo — pad mode holds (Alex: "the mouse gets reactivated")');
  const click = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  doc.getElementById('x').dispatchEvent(click);
  ok(clicked === 0 && click.defaultPrevented, '⭐ a real click while the pad is in use is swallowed — it never reaches what the cursor is over ("closing the window")');
  const tap = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(tap, 'rlswPad', { value: true });
  doc.getElementById('x').dispatchEvent(tap);
  eq(clicked, 1, '…the pad\'s OWN press (rlswPad) still goes through');
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const own = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
  Object.defineProperty(own, 'rlswPad', { value: true });
  window.dispatchEvent(own);
  eq(keys, ['Enter'], 'a mapper\'s Escape is swallowed; the pad\'s own Enter goes through');
  ok(!echoes.length, 'two echoes: nothing said yet (a stray click is not a mapper)');
  doc.getElementById('x').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  ok(echoes.length === 1 && doc.querySelector('[data-pad-echo-notice]'), `after ${PAD_GUARD.noticeAfter} echoes the player is told, once, what is doing it`);
  doc.getElementById('x').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  eq(echoes.length, 1, '…and only once');
  // ⭐ the D-pad cross CLICKS a rail button from code while the D-pad is held — that is the game, not an echo
  const byGame = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(byGame, 'byGame', { value: true });
  doc.getElementById('x').dispatchEvent(byGame);
  eq(clicked, 2, '⭐ a click the game\'s own code makes (the cross pressing a rail button) is never swallowed (Alex: "the dpad … I\'m not able to use any of the abilities")');
  f.padPulse(false);
  ok(f.guarding(), 'the guard holds a moment after the pad is let go (the echo trails the input)');
  await new Promise(r => setTimeout(r, PAD_GUARD.ms + 40));
  ok(!f.guarding(), `…and lets go ${PAD_GUARD.ms} ms later`);
  move(40);
  eq(html.getAttribute(INPUT_MODE_ATTR), 'mouse', 'then a real mouse move hands control back, as before');
  doc.getElementById('x').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  eq(clicked, 3, '…and a real click is a click again');
  f.dispose();
  // the DEFAULT test of "from the OS" is the browser's own isTrusted: code's button.click() is untrusted
  const g = createPadFocus({ doc, win: window, look: { ...PAD_RING, glide: 0, pulse: 0 } });
  g.enterPad(); g.padPulse(true);
  doc.getElementById('x').click();
  eq(clicked, 4, '⭐ by default only isTrusted events can be echoes: button.click() from code gets through mid-press');
  g.padPulse(false); g.dispose();
  window.close();
  // the runtime reports "the pad is in use" every poll
  const pulses = [];
  const rtFocus = { padPulse: h => pulses.push(h), enterPad() {}, visible: () => false, show() {}, hide() {}, move() {}, press() {} };
  const rt = createPadRuntime({ getPads: () => [pad({ ls: [0, -.9] })], sendKey: () => {}, focus: rtFocus, layer: () => 'turn', context: () => null });
  rt.tick(1000);
  const rt2 = createPadRuntime({ getPads: () => [pad({ held: ['A'] })], sendKey: () => {}, focus: rtFocus, layer: () => 'turn', context: () => null });
  rt2.tick(1000); rt2.tick(1100);
  const rt3 = createPadRuntime({ getPads: () => [pad()], sendKey: () => {}, focus: rtFocus, layer: () => 'turn', context: () => null });
  rt3.tick(1000);
  eq(pulses, [true, true, true, false], 'the runtime pulses: stick pushed → in use, button HELD (no edge) → in use, a resting pad → not');
}

// ── §8b pad mode vs mouse mode, and where each screen starts the ring ──
{
  const dom = new JSDOM(`<body>
    <button id="a">A</button><button id="b">B</button><button id="c" data-pad-default="chord:pick:1">C</button><button id="d">D</button>
  </body>`, { pretendToBeVisual: true });
  const { window } = dom, doc = window.document;
  const pos = { a: 10, b: 80, c: 150, d: 220 };
  for (const [id, x] of Object.entries(pos)) {
    doc.getElementById(id).getBoundingClientRect = () => ({ left: x, top: 10, width: 50, height: 30, right: x + 50, bottom: 40 });
  }
  // ⚠️ The plural hit-test, with the SHIELD on top of everything when it is shown —
  // the browser's real order. The ring must look through it or nothing is "on top".
  doc.elementsFromPoint = (x, y) => {
    const stack = [];
    const sh = doc.querySelector('[data-pad-shield]');
    if (sh && sh.style.display !== 'none') stack.push(sh);
    for (const [id, rx] of Object.entries(pos)) if (x >= rx && x < rx + 50 && y >= 10 && y < 40) stack.push(doc.getElementById(id));
    stack.push(doc.body);
    return stack;
  };
  doc.elementFromPoint = (x, y) => doc.elementsFromPoint(x, y)[0];
  Object.defineProperty(window, 'innerWidth', { value: 800 }); Object.defineProperty(window, 'innerHeight', { value: 600 });
  const modes = [];
  doc.addEventListener(INPUT_MODE_EVENT, e => modes.push(e.detail.mode));
  const f = createPadFocus({ doc, win: window, look: { ...PAD_RING, glide: 0, pulse: 0 } });
  const html = doc.documentElement, shield = doc.querySelector('[data-pad-shield]');
  eq(html.getAttribute(INPUT_MODE_ATTR), 'mouse', 'a fresh page is in mouse mode');
  ok(shield && shield.style.display === 'none', '…with no shield up');
  f.enterPad();
  eq(html.getAttribute(INPUT_MODE_ATTR), 'pad', 'pad input = pad mode (<html data-rlsw-input="pad">, which hides the arrow)');
  ok(shield.style.display === 'block' && shield.style.cursor === 'none', '…and the shield goes up, so the resting mouse hovers nothing');
  ok(!f.visible(), 'entering pad mode alone does not light the ring (a duel is pad mode too)');
  f.show();
  eq(f.target()?.id, 'c', 'the ring lands on the screen\'s default — THROUGH the shield (elementsFromPoint)');
  eq(f.candidates().map(el => el.id), ['a', 'b', 'c', 'd'], 'every button still counts as on top with the shield up');
  f.move('right');
  eq(f.target()?.id, 'd', 'the player walks the ring on');
  doc.getElementById('c').removeAttribute('data-pad-default');
  doc.getElementById('a').setAttribute('data-pad-default', 'chord:pick:1');
  f.show();
  eq(f.target()?.id, 'd', 'the SAME key on another element (the next open chip) does not yank the ring back');
  doc.getElementById('a').setAttribute('data-pad-default', 'melody:1');
  f.show();
  eq(f.target()?.id, 'a', 'a NEW key (the step moved on) takes the ring there');
  const pm = new window.MouseEvent('pointermove', { bubbles: true });
  Object.defineProperty(pm, 'movementX', { value: 3 });
  doc.body.dispatchEvent(pm);
  ok(f.visible() && f.mode() === 'pad', 'a 3 px twitch of a resting mouse is not the mouse coming back');
  const pm2 = new window.MouseEvent('pointermove', { bubbles: true });
  Object.defineProperty(pm2, 'movementX', { value: 20 });
  doc.body.dispatchEvent(pm2);
  ok(!f.visible() && f.mode() === 'mouse' && html.getAttribute(INPUT_MODE_ATTR) === 'mouse' && shield.style.display === 'none',
    'real mouse travel = mouse mode: ring off, shield down, arrow back');
  f.enterPad();
  shield.dispatchEvent(new window.Event('wheel'));
  eq(f.mode(), 'mouse', 'a real wheel on the shield is the mouse coming back');
  f.enterPad(); f.show();
  const padDown = new window.MouseEvent('pointerdown', { bubbles: true });
  Object.defineProperty(padDown, 'rlswPad', { value: true });
  shield.dispatchEvent(padDown);
  eq(f.mode(), 'pad', '…but the pad\'s own events never switch it back');
  eq(modes, ['pad', 'mouse', 'pad', 'mouse', 'pad'], `the mode event fires once per flip (${modes.join(' → ')})`);
  f.dispose();
  ok(!doc.querySelector('[data-pad-shield]') && html.getAttribute(INPUT_MODE_ATTR) === 'mouse', 'dispose takes the shield down and leaves mouse mode');
  window.close();
}

// ── §10 a turn on a pad (input/padTurn.js — the rules the game and the preview share) ──
{
  near(stickClock(0, -1), 0, 1e-9, 'stick up = 0° (twelve o\'clock, where the wheel puts the root)');
  near(stickClock(1, 0), 90, 1e-9, 'stick right = 90°');
  near(stickClock(0, 1), 180, 1e-9, 'stick down = 180°');
  near(stickClock(-1, 0), 270, 1e-9, 'stick left = 270°');
  // a Hirajoshi-ish hand: root (k0) held, k2 held, k3 in the palette but not held, k7 held, k8 off-key but held
  const slots = [
    { pc: 2, k: 0, held: [0], inPal: true }, { pc: 4, k: 2, held: [1, 4], inPal: true }, { pc: 5, k: 3, held: [], inPal: true },
    { pc: 9, k: 7, held: [2], inPal: true }, { pc: 10, k: 8, held: [3], inPal: false }, { pc: 0, k: 10, held: [], inPal: false },
  ];
  const dir = deg => ({ x: Math.sin(deg * Math.PI / 180), y: -Math.cos(deg * Math.PI / 180), m: 1 });
  eq(pickWheelSlot(dir(0), slots), 2, 'stick up picks the root (k0)');
  eq(pickWheelSlot(dir(95), slots), 4, '⭐ MAGNETIC: 95° is the unheld k3\'s wedge, but the stick snaps to the nearest HELD note (k2)');
  eq(pickWheelSlot(dir(95), slots, { snap: 'palette' }), 5, '…under `palette` it lands on the scale note you don\'t hold');
  eq(pickWheelSlot(dir(300), slots, { snap: 'all' }), 0, '…under `all` even an off-key slot you don\'t hold');
  eq(pickWheelSlot({ x: .3, y: 0, m: .3 }, slots), null, 'a stick under the dead zone picks nothing');
  eq(pickWheelSlot(dir(240), slots), 10, 'an off-key note you HOLD is pickable (it is in your hand)');
  eq(pickWheelSlot(dir(180), [{ pc: 1, k: 5, held: [0] }, { pc: 3, k: 7, held: [1] }]), 1, 'a dead-centre tie goes to the lower slot, every time');
  eq(stepWheelSlot(2, slots, +1), 4, 'D-pad ▶ steps clockwise to the next held note');
  eq(stepWheelSlot(10, slots, +1), 2, '…and wraps round past the top');
  eq(stepWheelSlot(2, slots, -1), 10, 'D-pad ◀ steps back');
  eq(stepWheelSlot(null, slots, +1), 2, 'with nothing picked, ▶ lights the first held note from the root');
  eq(stepWheelSlot(5, slots, +1), 2, 'a pick that is no longer held restarts from the root');
  eq(stepWheelSlot(null, [], +1), null, 'an empty hand picks nothing');
  // aiming
  const ts = [{ id: 'n', x: 0, y: -100 }, { id: 'ne', x: 80, y: -50 }, { id: 'e', x: 100, y: 0 }, { id: 's', x: 0, y: 90 }, { id: 'far-n', x: 0, y: -300 }];
  const me = { id: 'me', x: 0, y: 0 };
  eq(hopTarget(me, ts, 0)?.id, 'n', 'aim up: the nearest legal target that way');
  eq(hopTarget(me, ts, 90)?.id, 'e', 'aim right');
  eq(hopTarget(me, ts, 270), null, 'nothing legal that way: the aim stays put (never a hex it could not reach)');
  eq(hopTarget(ts[0], ts, 0)?.id, 'far-n', 'from a target, up again goes on to the next one up');
  eq(cycleTarget(me, ts, 'n', +1)?.id, 'far-n', 'RB steps round the circle clockwise (same bearing: list order)');
  eq(cycleTarget(me, ts, 's', +1)?.id, 'n', '…and wraps');
  eq(cycleTarget(me, ts, 'n', -1)?.id, 's', 'LB steps back');
  // 🎯 the let-go fix (Alex, 14 Oct: "hard to get it to 'stick' to one of the diagonal
  // directions … it 'wants' to snap to the nearest 4 directions"). A real release from
  // a diagonal: one axis springs home first, so the last readings point straight across.
  const ring = [{ pc: 2, k: 0, held: [0] }, { pc: 4, k: 2, held: [1] }, { pc: 5, k: 3, held: [2] }, { pc: 11, k: 9, held: [3] }];
  const at = (deg, m = 1) => ({ ...dir(deg), x: dir(deg).x * m, y: dir(deg).y * m, m });
  const letGo = opts => {
    const a = createWheelAim({ snap: 'held', dead: .45, ...opts });
    let t = 0;
    for (; t <= 240; t += 16) a.feed(at(60), ring, t);          // held on the 2 o'clock note
    const mid = [a.feed(at(80, .7), ring, t += 16).pc, a.feed(at(89, .5), ring, t += 16).pc];   // the spring
    const end = a.feed({ x: 0, y: 0, m: 0 }, ring, t += 16);
    return { mid, end };
  };
  eq(pickWheelSlot(at(80, .7), ring), 5, 'the trap is real: one spring-back reading alone points at the 3 o\'clock note');
  const full = letGo({});
  ok(full.end.pc === 4 && full.end.released, 'let go from the 2 o\'clock note: it stays picked (all three guards)');
  eq(full.mid, [4, 4], '…and it never even flickers to 3 o\'clock on the way home (so no wrong note is auditioned)');
  eq(letGo({ settleMs: 0, stickDeg: 0 }).end.pc, 4, 'the steady guard alone holds it: a stick losing push is not aiming');
  eq(letGo({ steady: 0, stickDeg: 0 }).mid, [5, 5], 'with no steady guard the spring does reach 3 o\'clock mid-release…');
  eq(letGo({ steady: 0, stickDeg: 0 }).end.pc, 4, '…and the rewind alone puts it back on the note held 90 ms before');
  eq(letGo({ steady: 0, settleMs: 0, stickDeg: 0 }).end.pc, 5, 'with every guard off, the old snap comes back (the bug, reproduced)');
  {
    const a = createWheelAim({ snap: 'held', dead: .45, steady: 0, settleMs: 0 });
    a.feed(at(60), ring, 0);
    eq(a.feed(at(76), ring, 16).pc, 4, 'sticky: 76° is nearer 3 o\'clock by 2°, not the 8° it takes to pull off a picked note');
    eq(a.feed(at(84), ring, 32).pc, 5, '…but a real lean onto it moves the pick');
    eq(createWheelAim({ snap: 'held', dead: .45, steady: 0, settleMs: 0, stickDeg: 0 }).feed(at(76), ring, 0).pc, 5, 'with stickiness 0 the nearest wins outright');
  }
  {
    const a = createWheelAim({ snap: 'held', dead: .45 });
    const seen = [];
    for (let i = 0, t = 0; i <= 6; i++, t += 16) seen.push(a.feed(at(i * 15), ring, t).pc);
    eq([...new Set(seen)], [2, 4, 5], 'a sweep at full push still walks note to note (0 → 2 → 3 o\'clock), every step heard');
    const f = createWheelAim({ snap: 'held', dead: .45 });
    f.feed(at(60), ring, 0); f.feed(at(60), ring, 16);
    eq(f.feed({ x: 0, y: 0, m: 0 }, ring, 32).pc, 4, 'a quick flick shorter than the rewind still keeps the note it flicked to');
    eq(f.feed({ x: 0, y: 0, m: 0 }, ring, 48).released, false, '`released` is true on the one poll the stick comes home, not after');
  }
  // the levers
  for (const [k, choices] of Object.entries(PAD_TURN_CHOICES)) ok(choices.includes(PAD_TURN[k]), `PAD_TURN.${k} is one of its own choices`);
  for (const [name, m] of Object.entries(CROSS_MAPS)) {
    eq(Object.keys(m).sort(), ['Down', 'Left', 'Right', 'Up'], `cross map "${name}" fills all four D-pad directions`);
    eq(Object.values(m).sort(), ['sig1', 'sig2', 'sonic', 'swing'], `cross map "${name}" holds both signatures, Sonic and Swing, once each`);
  }
  ok(Object.isFrozen(PAD_TURN), 'PAD_TURN is frozen (the preview and the port read one copy)');
}

// ── §9 the wiring ──
{
  const mono = src('../rlsw-simulator-v3_8_1.jsx');
  const riffEffect = mono.slice(mono.indexOf("if (!battleState?.riffOff || battleState.phase !== 'riff_play') return;"), mono.indexOf('RIFF-OFF MIC — REMOVED'));
  ok(riffEffect.includes("claimPadLayer('riff')") && riffEffect.includes('releasePad()'), 'the monolith claims the riff layer in the effect that binds 1–6, and releases it in its cleanup');
  ok(mono.includes("data-pad-hex={padAim?.has(hex.num) ? '' : undefined}"), '⭐ hexes join the highlight only while an action is armed — and only the LEGAL ones');
  ok(mono.includes('useEffect(() => providePadTurn(() => padCtxRef.current?.() ?? null), []);'), 'the monolith hands the pad its turn context');
  ok(mono.includes('providePadCamera(() => arenaCameraRef.current)'), 'the monolith hands the pad its arena camera');
  const duel = src('../ui/RiffArenaBattle.jsx');
  ok(duel.includes("claimPadLayer('riff')") && /clockLive=battle\.arenaStartedAt!=null&&!battle\.verdict&&!resume/.test(duel), 'the arena duel claims the riff layer only while its clock runs');
  ok(/Digit\[1-6\]/.test(duel), 'the arena duel reads e.code Digit1–6 — which the pad sends');
  const hw = src('../riff/arrowHighwayEngine.js');
  ok(hw.includes("const releasePad = claimPadLayer('riff')") && hw.includes('releasePad();'), 'the practice highway claims and releases');
  const ar = src('../board/arenaRenderer.js');
  ok(ar.includes('PAD_ACTIVITY_EVENT]') && /grab\(on\)\{/.test(ar) && /orbit\(dTheta,dPhi\)\{/.test(ar) && /heading\(\)\{/.test(ar), 'the arena hears pad activity and exposes grab / orbit / heading');
  ok(/grab\(on\)\{[^}]*takeOver\(\)/.test(ar.replace(/\n/g, ' ')), 'grab is the drag\'s own takeOver');
  const bv = src('../ui/BoardViewport.jsx');
  for (const m of ['heading()', 'grab(on)', 'orbit(dTheta, dPhi)']) ok(bv.includes(m), `BoardViewport passes ${m} through`);
  ok(src('../App.jsx').includes('mountGamepad()'), 'App mounts the pad once, for every screen');
  const gc = src('../ui/GlobalCursor.jsx');
  eq((gc.match(/if \(event\.rlswPad\) return;/g) ?? []).length, 2, 'the mouse arrow ignores the pad\'s hover and clicks');
  eq(PAD_ACTIVITY_EVENT, 'rlsw:pad-activity', 'one activity event name');
  ok(/html\[data-rlsw-input="pad"\] \[data-rlsw-cursor\] \{ display:none !important; \}/.test(gc), 'pad mode hides the mouse arrow');
  // 🎯 every turn step names where the ring starts — and only on a human's own turn
  ok(mono.includes("const padTurnKey    = canAct && acting && !isBot(acting) ? `${engineState.turn.count}:${acting.id}` : null;"), 'the step defaults are keyed by turn and seat, human turns only');
  for (const [where, needle] of [
    ['the chord step (View = the HUD): the destination stack', "data-pad-default={padChord?.at === 'stack' && padChord.side === side ? padChord.key : undefined}"],
    ['the chord step: Continue', "data-pad-default={padChord?.at === 'go' ? padChord.key : undefined}"],
    ['the melody step (View = the HUD): ✓ Commit', "data-pad-default={padTurnKey && turnStep === 'melody' && !hasConfirmed ? `melody:${padTurnKey}` : undefined}"],
    ['Move & Act: Move', 'data-pad-default={padTurnKey && hasConfirmed ? `move:${padTurnKey}` : undefined}'],
    ['an armed ability: the best legal target (a new key per hop, so a second Shukuchi re-aims)', 'data-pad-default={padTurnKey && padAimDefault === hex.num ? `aim:${action}:${acting?.num}:${padTurnKey}` : undefined}'],
  ]) ok(mono.includes(needle), `${where} is the ring's start`);
  ok(!mono.includes('padOpenIdx') && !mono.includes('padMelodyIdx'), 'no step names a hand CHIP any more — the pool is the wheel');
  // ✚ the cross clicks the rail's own buttons: Thrash, Sonic and every signature arm are tagged
  ok(mono.includes('data-pad-ability="swing"') && mono.includes('data-pad-ability="sonic"'), 'the cross can find the Thrash and the Sonic');
  const sigs = [...mono.matchAll(/data-pad-ability="sig:([a-z_0-9]+)"/g)].map(m => m[1]);
  for (const id of ['shukuchi', 'psycho_bushido', 'shadow_illusion', 'cursed_shamisen', 'slime', 'tentacle', 'master_moshpits', 'goes_to_11', 'displace', 'gravity_control', 'code_injection', 'blaster'])
    ok(sigs.includes(id), `the signature "${id}" is on the cross`);
  eq(new Set(sigs).size, sigs.length, 'each signature is tagged once');
  ok(!/data-pad-ability="[^"]*"[^>]*>Cancel/.test(mono), 'no Cancel button is a cross target');
  ok(src('../ui/TitleMenu.jsx').includes("data-pad-default={i === ITEMS.findIndex(x => !x.locked) ? 'title' : undefined}"), 'the title menu starts on its first open option');
  const draft = src('../ui/SpiritDraft.jsx');
  ok(['`draft:pick:${corner}`', '`draft:skills:${corner}:${chosen}`', '`draft:lock:${corner}`'].every(k => draft.includes(k)), 'the Spirit draft walks pick → abilities → LOCK IN');
  ok(src('../ui/Lobby.jsx').includes("data-pad-default={canGo ? 'lobby:go' : undefined"), 'the lobby waits on ENTER ARENA once it can go');
}

// ── §11 a turn on a pad, in the game (`providePadTurn`) ──
{
  // 🎡 'wheel': the left stick points at a note, D-pad ◀▶ steps, A plays, RS flicks the hammer
  const slots = [{ pc: 2, k: 0, held: [0] }, { pc: 4, k: 2, held: [1] }, { pc: 5, k: 3, held: [] }, { pc: 9, k: 7, held: [2] }, { pc: 11, k: 9, held: [3] }];
  const log = [];
  const ctx = { mode: 'wheel', pick: null, slots: () => slots, setPick(pc) { this.pick = pc; log.push(`pick:${pc}`); },
    commit() { log.push(`commit:${this.pick}`); }, canHammer: true, hammer(d) { log.push(`hammer:${d}`); }, hud() { log.push('hud'); } };
  const h = harness({ context: () => ctx });
  h.focus.shown = true;
  h.step(pad());
  eq(ctx.pick, 2, '⭐ the step opens LIT: with nothing picked, the first note you hold is (no stick needed)');
  ok(!h.focus.shown, '…and the ring is put away — the lit note on the wheel is the cursor');
  const dir = deg => [Math.sin(deg * Math.PI / 180), -Math.cos(deg * Math.PI / 180)];
  for (let i = 0; i < 6; i++) h.step(pad({ ls: dir(210) }), 16);
  eq(ctx.pick, 9, 'the stick at 7 o\'clock picks the note held there');
  ok(!h.sent.some(x => x.includes('Numpad')), '…and the stick does NOT walk the Spirit while it picks');
  for (let i = 0; i < 8; i++) h.step(pad(), 16);
  eq(ctx.pick, 9, 'let go: the pick stays (wheelRelease keep)');
  log.length = 0; h.clear();
  h.step(pad({ held: ['A'] })); h.step(pad());
  eq(log, ['commit:9'], 'A plays the lit note');
  eq(h.focus.presses, 0, '…and presses nothing under a ring');
  h.step(pad({ held: ['Right'] })); h.step(pad());
  eq(ctx.pick, 11, 'D-pad ▶ steps clockwise to the next held note');
  h.step(pad({ held: ['Left'] })); h.step(pad());
  eq(ctx.pick, 9, 'D-pad ◀ steps back');
  eq(h.focus.moves.length, 0, '…the D-pad never walks a ring in the wheel');
  slots[1].held = [];   // the D just played was the last one
  ctx.pick = 4; h.step(pad());
  eq(ctx.pick, 9, 'a pick you no longer hold moves on to the next held note');
  log.length = 0;
  h.step(pad({ rs: [0, -.95] })); h.step(pad({ rs: [0, -.95] })); h.step(pad());
  eq(log, ['hammer:up'], 'a right-stick flick ↑ = hammer-on, once per flick');
  log.length = 0; h.step(pad({ rs: [0, .95] })); h.step(pad());
  eq(log, ['hammer:down'], '…↓ = pull-off (the game says which it is if it is the wrong way)');
  eq(h.camera.orbits.length, 0, 'the right stick does not turn the lens while it can hammer');
  ctx.canHammer = false; h.step(pad({ rs: [.9, 0] }), 16);
  ok(h.camera.orbits.length > 0, '…but it does for a Spirit with no hammer-on');
  h.step(pad());
  h.clear(); h.step(pad({ held: ['Y'] })); h.step(pad());
  eq(h.sent, ['keydown:Enter/Enter', 'keyup:Enter/Enter'], 'Y is still Enter (Continue / Commit) — one code path with the keyboard');
  h.clear(); h.step(pad({ held: ['RB'] })); h.step(pad({ held: ['X'] })); h.step(pad({ held: ['LB'] })); h.step(pad());
  eq(h.sent.filter(x => x.startsWith('keydown')), ['keydown:Tab/Tab', 'keydown:Backspace/Backspace', 'keydown:w/KeyW'], 'RB switches stack, X takes back, LB hides the wheel — the keys');
  log.length = 0; h.step(pad({ held: ['View'] })); h.step(pad());
  eq(log, ['hud'], 'View hands the D-pad to the HUD');

  // ✚ 'cross': the D-pad arms the rail's buttons; the stick still walks
  const crossed = [];
  const hc = harness({ context: () => ({ mode: 'cross', cross: d => crossed.push(d), hud() {} }) });
  hc.step(pad());
  for (const d of ['Up', 'Left', 'Right', 'Down']) { hc.step(pad({ held: [d] })); hc.step(pad()); }
  eq(crossed, ['Up', 'Left', 'Right', 'Down'], 'each D-pad direction is a cross arm');
  ok(hc.focus.moves.length === 0 && !hc.focus.shown, '…no ring walks or wakes');
  hc.clear(); hc.step(pad({ ls: [0, -1] }));
  ok(hc.sent.includes('keydown:8/Numpad8'), 'the left stick still walks in Move & Act');

  // 🎯 'aim': only legal targets, ever
  const T = id => ({ id });
  const els = { a: T('a'), b: T('b'), c: T('c'), d: T('d') };
  const targets = [{ id: 1, x: 100, y: 0, el: els.a }, { id: 2, x: 100, y: -100, el: els.b }, { id: 3, x: 200, y: 0, el: els.c }, { id: 4, x: 0, y: 100, el: els.d }];
  const ha = harness({ context: () => ({ mode: 'aim', targets: () => targets, centre: () => ({ x: 0, y: 0 }), hud() {} }) });
  ha.focus.on = els.a;
  ha.step(pad());
  ok(ha.focus.shown, 'arming an ability brings the ring up at once (on the screen\'s default target)');
  ha.focus.on = { id: 'a HUD button' }; ha.step(pad(), 120);
  eq(ha.focus.on, els.a, '⚠️ a ring that fell back onto a HUD button is put back on a legal target (A must never press the HUD mid-aim)');
  ha.step(pad({ held: ['Up'] })); ha.step(pad());
  eq(ha.focus.on, els.b, 'D-pad ▲ hops to the legal target above');
  ha.step(pad({ held: ['Up'] })); ha.step(pad());
  eq(ha.focus.on, els.b, '…and with nothing legal further up, it stays put — never a hex it could not reach');
  ha.focus.on = els.a; ha.step(pad({ ls: [1, 0] })); ha.step(pad({ ls: [1, 0] })); ha.step(pad());
  eq(ha.focus.on, els.c, 'a stick flick right hops right, once per flick');
  ok(!ha.sent.some(x => x.includes('Numpad')), '…and the stick does not walk while aiming');
  ha.focus.on = els.a; ha.step(pad({ held: ['RB'] })); ha.step(pad());
  ok(ha.focus.on !== els.a && targets.some(x => x.el === ha.focus.on), 'RB steps round the legal targets');
  ok(!ha.sent.includes('keydown:Tab/Tab'), '…instead of sending Tab');
  ha.clear(); ha.step(pad({ held: ['A'] })); ha.step(pad());
  eq(ha.focus.presses, 1, 'A fires on the target (a click on that hex — `onHexClick`)');
  ha.clear(); ha.step(pad({ held: ['B'] })); ha.step(pad());
  eq(ha.sent[0], 'keydown:Escape/Escape', 'B is Escape, which backs out of the aim');
  const hm = harness({ padMode: 'mouse', context: () => ({ mode: 'aim', targets: () => targets }) });
  hm.step(pad());
  ok(!hm.focus.shown, '⚠️ a mouse player arming an ability is never flipped into pad mode by an idle pad');
  // 🧭 the button bar and the cross: one copy of the cross map
  const ui = src('../ui/padTurnUi.js');
  ok(ui.includes('INPUT_MODE_EVENT') && src('../ui/PadButtonBar.jsx').includes('barMouseKeys'), 'the bar follows the pad/mouse flip and shows the KEYS in mouse mode');
  ok(ui.includes('CROSS_MAPS[PAD_TURN.crossMap]'), 'the cross reads Alex\'s map (`crossMap`)');
}

console.log(`PASS: ${checks} checks — six strings on six fingers, trigger hysteresis, screen-up walking vs a real camera, riff + turn layers, the highlight in a DOM, pad vs mouse mode, step defaults, the wiring`);
process.exit(0);
