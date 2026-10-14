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
import assert from 'node:assert/strict';
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';
import { PAD_BUTTONS, RIFF_LAYOUT, TURN_LAYOUT, WALK_CODES, PAD_ACTIVITY_EVENT, deadzone, readPad,
  padEdges, heldStrings, stickFlick, stickBoardAngle, walkCodeFor } from './padMap.js';
import { createPadRuntime, claimPadLayer, padLayer } from './gamepad.js';
import { navScore, pickNeighbor, nearestTo, inLine } from './padNav.js';
import { createPadFocus, PAD_RING } from './padFocus.js';
import { NUMPAD_DIRS } from '../ui/numpadMove.js';
import { lensHeading, turnLens } from '../board/topDownView.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
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
function harness({ layer = 'turn', heading = 0 } = {}) {
  const sent = [];
  let pads = [pad()], lay = layer;
  const focus = { shown: false, moves: [], presses: 0, adjusted: [], hides: 0, menu: null, adjustOK: false,
    visible() { return this.shown; }, show() { this.shown = true; return true; },
    hide() { this.shown = false; this.hides++; }, move(d) { this.moves.push(d); return true; },
    press() { this.presses++; return true; }, adjust(d) { if (this.adjustOK) { this.adjusted.push(d); return true; } return false; },
    pressSelector(sel) { this.menu = sel; return true; } };
  const camera = { grabs: [], orbits: [], zooms: [], heading: () => heading,
    grab(on) { this.grabs.push(on); }, orbit(a, b) { this.orbits.push([a, b]); }, zoom(f) { this.zooms.push(f); } };
  let acts = 0;
  const rt = createPadRuntime({ getPads: () => pads, sendKey: (type, k) => sent.push(`${type}:${k.key}/${k.code}`),
    focus, camera: () => camera, activity: () => acts++, layer: () => lay });
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
  h.step(pad({ held: ['A'] })); h.step(pad());
  ok(h.focus.shown && h.focus.presses === 0, 'the first A only SHOWS the highlight — never a blind click');
  h.step(pad({ held: ['A'] })); h.step(pad());
  eq(h.focus.presses, 1, 'the next A presses what it highlights');
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

// ── §9 the wiring ──
{
  const mono = src('../rlsw-simulator-v3_8_1.jsx');
  const riffEffect = mono.slice(mono.indexOf("if (!battleState?.riffOff || battleState.phase !== 'riff_play') return;"), mono.indexOf('RIFF-OFF MIC — REMOVED'));
  ok(riffEffect.includes("claimPadLayer('riff')") && riffEffect.includes('releasePad()'), 'the monolith claims the riff layer in the effect that binds 1–6, and releases it in its cleanup');
  ok(/data-pad-hex=\{action \? '' : undefined\}/.test(mono), 'hexes join the highlight only while an action is armed');
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
}

console.log(`PASS: ${checks} checks — six strings on six fingers, trigger hysteresis, screen-up walking vs a real camera, riff + turn layers, the highlight in a DOM, the wiring`);
process.exit(0);
