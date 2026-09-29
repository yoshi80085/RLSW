// ─── beamLayerCheck — the Sonic's rings draw over everything but the attacker ──
// (Alex, 2026-09-30: "the sound form rings should be in a layer in front of
// everything … when the attack 'circles' the attacking Spirit - it should go
// 'behind' it … it loses out to some assets and gets cut out".) beamLayer.js
// has the why. The pixels were checked in Chromium (`.scratch/beam-layer/`);
// this pins the wiring that makes them, so it cannot quietly come undone:
//   §1 the live arena hands the clash to the beam layer, and names the attacker
//   §2 the layer's passes, in order, against a recording renderer
//   §3 nothing it borrows is left changed — materials, layers, camera, clear colour
//   §4 arenaRenderer draws it LAST, after the solids and the standees
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFileSync } from 'node:fs';
import { resolveSonicBarrage } from '../engine/systems/sonicBarrage.js';
import { createArenaVisuals } from './arenaVisuals.js';
import { arenaFrame } from './arenaFrame.js';
import { createBeamLayer, BEAM_OCCLUDER_LAYER, BEAM_FLAT_LAYER } from './beamLayer.js';
import { createStandee } from './standee.js';

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
// ⚠️ Identity, not assert.equal: a failing equal on two three.js objects spends
// minutes printing their diff, and a mutant reads as a hang instead of a FAIL.
const eq = (a, b, message) => { assert.ok(a === b, `${message} (got ${typeof a === 'object' && a ? a.constructor?.name ?? 'object' : a}, want ${typeof b === 'object' && b ? b.constructor?.name ?? 'object' : b})`); checks++; };

// ── §1 the live arena ─────────────────────────────────────────────────────────
console.log('§1 the live arena hands the clash to the beam layer');
const bytes = readFileSync(new URL('../../public/cosmic-arena/cosmic-arena.glb', import.meta.url));
const model = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
model.scale.z = -1;
const scene = new THREE.Scene(), fg = new THREE.Scene(), beamScene = new THREE.Scene();
scene.add(model);
const visuals = createArenaVisuals(scene, { foregroundScene: fg, beamScene }); visuals.attachModel(model);
const drive = [6, 5, 4], ledger = resolveSonicBarrage(drive, 9);
const battle = { attackerId: 'a', defenderId: 'b', sonicAttack: true, sonicVersion: 2, sonicId: 'beam', phase: 'sonic_roll',
  sonicRollStartedAt: performance.now() - 7000, dicePool: drive.map(() => 6), diceVals: drive, diceHits: ledger.shots.map(s => s.through > 0),
  shieldValue: 9, sustainPool: [6, 6], sustainRolls: [5, 4], ...ledger };
visuals.update(arenaFrame({ spirits: [{ id: 'a', num: 7, corner: 'blue', color: '#62dbff' }, { id: 'b', num: 16, corner: 'red', color: '#b0a0ff' }], noteStates: {}, battle }));
visuals.tick(1);
ok(beamScene.getObjectByName('Sonic clash'), 'the clash (beams, shield, shards) is drawn by the beam layer');
eq(scene.getObjectByName('Sonic clash'), undefined, '…and NOT in the arena, where the board and the foreground paint over it');
ok(scene.getObjectByName('Arena floor dice'), 'the dice stay in the arena (the solid layer re-draws them)');
const occluders = visuals.beamOccluders();
eq(occluders.length, 1, 'exactly one thing may hide the beam');
eq(occluders[0], visuals.pawnFor('a'), '…the ATTACKER it loops round — never the Rival');
visuals.dispose();
eq(beamScene.getObjectByName('Sonic clash'), undefined, 'the clash leaves the beam layer with the visuals');
eq(visuals.beamOccluders().length, 0, 'no Sonic, nothing to pass behind');
// Without a beam layer (the headless checks) the clash stays in the arena, as it was.
{
  const s = new THREE.Scene(); const m = model.clone(true); s.add(m);
  const v = createArenaVisuals(s); v.attachModel(m);
  v.update(arenaFrame({ spirits: [{ id: 'a', num: 7, corner: 'blue', color: '#62dbff' }, { id: 'b', num: 16, corner: 'red', color: '#b0a0ff' }], noteStates: {}, battle }));
  ok(s.getObjectByName('Sonic clash'), 'no beam layer → the arena draws it, exactly as before');
  v.dispose();
}

// ── §2 the passes ─────────────────────────────────────────────────────────────
console.log('§2 the passes, in order');
const log = [];
let clearAlpha = 0, target = null;
const foreground = {
  getClearAlpha: () => clearAlpha, getClearColor: c => c.set(0x000000),
  setClearColor: (c, a) => { clearAlpha = a ?? 1; },
  getDrawingBufferSize: v => v.set(64, 32),
  setRenderTarget: t => { target = t; }, clear: () => log.push({ op: 'clear', target }), clearDepth: () => log.push({ op: 'clearDepth', target }),
  render(root, camera) {
    const drawn = [];
    root.traverseVisible(o => { if ((o.isMesh || o.isSprite || o.isLine) && o.layers.test(camera.layers)) drawn.push({ o, material: o.material }); });
    log.push({ op: 'render', root, target, mask: camera.layers.mask, drawn, clearAlpha });
  },
};
const layer = createBeamLayer({ foreground });
const camera = new THREE.PerspectiveCamera(); camera.layers.set(0);
eq(layer.render(camera), false, 'an empty layer draws nothing');
eq(log.length, 0, '…and does not even clear depth');

// A beam: one additive ring the arena drew with depthTest:false, and one plain
// label plate (normal blending — its dark plate would vanish if added).
const ring = new THREE.Mesh(new THREE.TorusGeometry(1, .1), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
const plate = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
layer.scene.add(ring, plate);
// The attacker: a real standee (print alpha-tested + writes depth, sheet never does).
const room = new THREE.Scene();
const standee = createStandee({ id: 'cosmic_ronin', color: '#62dbff', imageSrc: 'x.png' }, { loader: () => new THREE.Texture() });
const attacker = standee.group;
room.add(attacker); room.updateMatrixWorld(true);
const printMesh = standee.parts.find(m => m.renderOrder === 10), sheet = standee.parts.find(m => m.renderOrder === 8);
const printMaterial = printMesh.material, printLayers = printMesh.layers.mask;
const roomAuto = room.matrixWorldAutoUpdate;
clearAlpha = 0;
eq(layer.render(camera, { occluderScene: room, occluders: [attacker], bloom: false }), true, 'a beam draws');
const renders = log.filter(e => e.op === 'render');
// ① into the glow target: the attacker's depth, then the additive parts
eq(renders[0].root, room, '① the attacker is written first…');
ok(renders[0].target, '…into the glow target');
eq(renders[0].mask, 1 << BEAM_OCCLUDER_LAYER, '…alone (its own layer — no other Spirit, amp or fan)');
const occl = renders[0].drawn;
ok(occl.some(d => d.o === printMesh), 'the print occludes');
ok(!occl.some(d => d.o === sheet), 'the clear acrylic sheet does NOT (it never writes depth)');
ok(occl.every(d => d.material.colorWrite === false), '…depth only: no colour from the stand-in');
eq(occl.find(d => d.o === printMesh).material.alphaTest, printMaterial.alphaTest, '…cut to the print\'s outline (alphaTest), not its rectangle');
ok(log.find(e => e.op === 'clear' && e.target) && log.find(e => e.op === 'clear').clearAlpha !== 0, 'the glow target is cleared');
eq(renders[1].root, layer.scene, '…then the beam');
ok(renders[1].target, '…into the same target');
eq(renders[1].mask, 1, '…its additive parts only (layer 0)');
ok(renders[1].drawn.some(d => d.o === ring) && !renders[1].drawn.some(d => d.o === plate), 'the ring glows; the plate waits');
// ② the composite onto the canvas
const composite = renders[2];
eq(composite.target, null, '② the glow is composited onto the canvas');
const comp = composite.drawn[0].material;
eq(comp.blending, THREE.CustomBlending, '…with its own blend');
eq(comp.blendDst, THREE.OneMinusSrcAlphaFactor, '…a SCREEN (premultiplied over, alpha = brightest channel) — not an add, which blew out to white');
ok(/max\(gl_FragColor\.r/.test(comp.fragmentShader) && /tonemapping_fragment/.test(comp.fragmentShader), '…tone-mapped with the renderer\'s own ACES first');
eq(comp.depthTest, false, '…and never depth-tested against the solids already on the canvas');
// ③ the flat parts
const flatClear = log.findIndex(e => e.op === 'clearDepth' && !e.target);
ok(flatClear > log.indexOf(composite), '③ the canvas depth is cleared (the solids and standees lose their vote)…');
eq(renders[3].root, room, '…the attacker written again');
eq(renders[3].target, null, '…onto the canvas');
eq(renders[4].mask, 1 << BEAM_FLAT_LAYER, '…then the flat parts');
ok(renders[4].drawn.some(d => d.o === plate), '…the plate among them');
eq(renders.length, 5, 'five draws, no more');
// The rules the layer enforces on what it draws.
eq(ring.material.depthTest, true, 'every beam material depth-TESTS here (the only depth is the attacker\'s)');
eq(ring.material.depthWrite, false, '…and none writes it, so one ring never hides another');
eq(plate.layers.mask, 1 << BEAM_FLAT_LAYER, 'a normal-blended part goes on the flat layer');
eq(ring.layers.mask, 1, 'an additive part stays on the glow layer');

// ── §3 nothing borrowed is left changed ───────────────────────────────────────
console.log('§3 nothing borrowed is left changed');
eq(printMesh.material, printMaterial, 'the print has its own material back');
eq(printMesh.layers.mask, printLayers, '…and its own layers');
eq(room.matrixWorldAutoUpdate, roomAuto, 'the room updates its matrices again');
eq(camera.layers.mask, 1, 'the camera sees what it saw');
eq(target, null, 'the canvas is the render target again');
eq(clearAlpha, 0, 'the foreground clears see-through again');
// A second frame reuses the stand-ins rather than making new ones.
const standIn = occl.find(d => d.o === printMesh).material;
log.length = 0; layer.render(camera, { occluderScene: room, occluders: [attacker], bloom: false });
eq(log.find(e => e.op === 'render').drawn.find(d => d.o === printMesh).material, standIn, 'the depth stand-in is made once per material');
// The clash group is up for the whole bout; only its PARTS say whether there is anything to see.
const holder = new THREE.Group(); holder.add(ring, plate); layer.scene.add(holder);
ring.visible = plate.visible = false; log.length = 0;
eq(layer.render(camera, { occluderScene: room, occluders: [attacker] }), false, 'a visible group with nothing lit in it (the dice beats) draws nothing');
eq(log.length, 0, '…and costs nothing — no clear, no bloom');
holder.visible = false;
eq(layer.render(camera, { occluderScene: room, occluders: [attacker] }), false, 'a hidden group (an interrupted volley) draws nothing');
layer.dispose();

// ── §4 the renderer draws it last ─────────────────────────────────────────────
console.log('§4 arenaRenderer draws it LAST');
const src = readFileSync(new URL('./arenaRenderer.js', import.meta.url), 'utf8');
const fgAt = src.indexOf('foreground.render(foregroundScene,camera)'), beamAt = src.indexOf('beams.render(camera,');
ok(fgAt > 0 && beamAt > fgAt, 'the beam layer draws after the solids and the standees');
ok(/createArenaVisuals\(scene,\{foregroundScene,beamScene:beams\.scene\}\)/.test(src), 'the live arena is given the beam layer');
ok(/occluders:visuals\.beamOccluders\(\)/.test(src), '…and the attacker to pass behind');
ok(/bloom:bloom\.enabled/.test(src), 'its glow follows the arena\'s (off in Lite)');
ok(/strength:bloom\.strength,radius:bloom\.radius,threshold:bloom\.threshold/.test(src), '…at the arena\'s own bloom settings');

console.log(`PASS: beam layer — ${checks} checks: the clash on its own layer, the attacker the only occluder, glow → screen → flat passes, nothing borrowed left changed, drawn last`);
