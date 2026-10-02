// ─── 🎆 PYRO STAGE CHECK — the mortars and the shove, on the real arena ──────
// `npm run test:pyrostage`. Driven on a virtual clock (no GPU, no audio):
//   §A the stage alone — a wave rises (its machinery heard), a shove's strike
//      waits for the skate to LAND and then owns the piece (fuse, the launch,
//      the spin, back down ON the mortar, the daze), hands it back at rest and
//      untinted; END TURN fires the rest as a salvo (not the struck one again);
//      the set folds away and is disposed; a batched volley + re-arm reads as
//      "fired, then a new set"; the show ending retires everything; a legacy
//      show draws nothing here; reduced motion keeps no lens shake.
//   §B the real `arenaVisuals` + `arenaFrame` — the GLB arena, a real standee
//      shoved two hexes onto an armed mortar: Astra's set is in the scene, the
//      legacy discs are not, the piece is thrown up and comes down on the
//      mortar, and the lens gets its shake.
//   §C the wiring — read from the source (§B2): who calls what, in what order.
import * as THREE from 'three';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
let vnow = 1000; performance.now = () => vnow;
globalThis.document ??= {
  createElementNS:() => ({ addEventListener() {}, removeEventListener() {}, set src(v) { void v; } }),
  createElement:() => ({ getContext:() => null, style:{} }),
};
const { createPyroStage, mortarLookFor } = await import('./pyroStage.js');
const { PYRO_SHOVE, timeline, makeShowClock } = await import('./pyroShove.js');
const { MORTAR_TIMING } = await import('./pyroMortars.js');
const { STANDEE_Y } = await import('./standee.js');
const { HEX_BY_NUM, HEX_BY_QR } = await import('./hexMap.js');
const { neighborInDirection } = await import('./hexGeometry.js');
const { PYRO_DAMAGE } = await import('../data/stageEffects.js');

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const near = (a, b, e, m) => ok(Math.abs(a - b) <= e, `${m}: ${a} vs ${b}`);
const L = PYRO_SHOVE, T = timeline(L), C = makeShowClock(L);
const point = (num, y = 0) => { const h = HEX_BY_NUM[num]; return h ? new THREE.Vector3((h.px - 3255) / 200, y, (h.py - 2415) / 200) : null; };

// a recording stand-in for createPyroSfx — every voice the game can ask for
const VOICES = ['plate', 'whine', 'boom', 'crackle', 'shell', 'crown', 'land', 'burn', 'unlock', 'lift', 'lock', 'release', 'retract', 'seal', 'launch', 'flame', 'curtain'];
const recorder = () => { const calls = []; const s = { calls, setMix() {} }; for (const v of VOICES) s[v] = (...a) => calls.push({ v, a }); return s; };
// a stand-in standee: the four parts pyroStage tints, a frame() it may call
const fakeStandee = () => {
  const parts = [0, 1, 2, 3].map(() => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color:0xffffff, emissive:0x223344, emissiveIntensity:0.5 })));
  return { parts, frame() {} };
};
const pawnOn = (num, yaw = 0.7) => { const g = new THREE.Group(); g.userData.standee = fakeStandee(); g.userData.targetFacing = yaw; g.position.copy(point(num, STANDEE_Y)); g.rotation.order = 'YXZ'; g.rotation.y = yaw; return g; };
const frameOf = (pyro, spirits) => ({ pyro, spirits });

// ── §A the stage alone ───────────────────────────────────────────────────────
{
  const sfx = recorder(), plates = [];
  const root = new THREE.Scene();
  const label = (text) => { const sprite = new THREE.Sprite(new THREE.SpriteMaterial()); sprite.userData.text = text; plates.push(text); return { sprite, write() {} }; };
  const S = createPyroStage(root, { pointFor:point, sfx, label });
  const hexes = [12, 40, 56, 77, 98];
  const B = 'vera', from = 45, onto = 56;
  let t = 10;
  const step = (dt = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) { t += dt; S.tick(t); } };
  const spirits = num => [{ id:B, num }];
  // a wave arms
  S.update(frameOf({ v:2, wave:1, phase:'armed', hexes, struck:[] }, spirits(from)));
  ok(S.setsNow().length === 1 && S.setsNow()[0].hexes.length === 5, 'an armed wave becomes one set of five mortars');
  step(1 / 60, 150);
  const mech = sfx.calls.filter(c => ['unlock', 'lift', 'lock'].includes(c.v)).map(c => c.v);
  ok(mech.filter(v => v === 'unlock').length === 4 && mech.filter(v => v === 'lock').length === 4, 'the deploy machinery is heard: four voices of unlock / lift / lock');
  ok(!sfx.calls.some(c => c.v === 'launch'), 'nothing fires while armed');
  // the shove: the engine marks the strike; the reaction WAITS for the landing
  S.update(frameOf({ v:2, wave:1, phase:'armed', hexes:hexes.filter(h => h !== onto), struck:[{ hexNum:onto, spiritId:B }] }, spirits(onto)));
  ok(S.live.pending === 1 && S.live.reactions === 0, 'a strike waits for the skate to land');
  const pawn = pawnOn(onto);
  step(0.2);
  ok(S.pose(B, pawn) === null, '…and nothing poses the piece before it lands');
  S.landed({ id:B, from:point(from), to:point(onto), toNum:onto, kind:'shove' });
  const contact = t;
  ok(S.live.reactions === 1 && S.live.pending === 0, 'the landing starts the reaction');
  const before = sfx.calls.length;
  step(1 / 60, 1);
  ok(sfx.calls.slice(before).some(c => c.v === 'plate'), 'contact: the trip-plate clunk');
  // through the fuse, the bang, the air
  const at = age => { const real = contact + C.realAt(age); while (t < real) step(Math.min(1 / 60, real - t + 1e-6)); return S.pose(B, pawn); };
  const mid = at(T.ti + (T.tl - T.ti) / 2);
  ok(mid && pawn.position.y > STANDEE_Y + L.launchH * 0.7, `the piece is thrown up (${pawn.position.y.toFixed(2)})`);
  ok(sfx.calls.some(c => c.v === 'boom'), 'the boom on the bang');
  ok(Math.abs(pawn.rotation.y - 0.7) > 0.05, "Alex's spin: the piece turns about its own axis in the air");
  ok(plates.includes(`−${PYRO_DAMAGE} VIBE`) && plates.includes('🔥 BURN'), `the labels read the engine's damage (−${PYRO_DAMAGE} VIBE) and the Burn`);
  const art = pawn.userData.standee.parts[3].material;
  ok(art.color.r < 0.99, 'the print is scorched');
  at(T.tl + 0.02);
  near(pawn.position.x, point(onto).x, 1e-6, 'it comes down ON the mortar (x)'); near(pawn.position.z, point(onto).z, 1e-6, '…(z)');
  ok(sfx.calls.some(c => c.v === 'land'), 'the acrylic rattles on landing');
  at(T.end + 0.05); S.tick(t);
  ok(S.pose(B, pawn) === null, 'after the daze the piece is handed back');
  near(art.color.r, 1, 1e-9, '…untinted'); near(art.emissiveIntensity, 0.5, 1e-9, '…its glow restored');
  ok(S.live.reactions === 1 && S.live.posing === 0, "the struck mortar's tail runs on until the wave folds away");
  // a second shove on the same Spirit is allowed once the first has let go
  ok(S.reactionOf(B) === null, 'the Spirit is free for another shove');
  // END TURN: the rest fire as a salvo; the struck one does not fire again
  const launchesBefore = sfx.calls.filter(c => c.v === 'launch').length;
  S.update(frameOf({ v:2, wave:1, phase:'spent', hexes:[], struck:[{ hexNum:onto, spiritId:B }] }, spirits(onto)));
  const set = S.setsNow()[0];
  ok(set.fired, 'END TURN fires the set');
  const iStruck = set.hexes.indexOf(onto);
  ok(set.cue.fireAt[iStruck] < t - 1, "the struck mortar keeps its own earlier bang");
  ok(set.cue.fireAt.every(Number.isFinite), 'every mortar has fired');
  near(set.cue.endAt, Math.max(...set.cue.fireAt) + L.holdS, 1e-9, 'the set folds away holdS after its last shot');
  step(1 / 60, 240);
  ok(sfx.calls.filter(c => c.v === 'launch').length - launchesBefore === 4, 'four launches for the four unstruck mortars');
  step(1 / 60, 60 * 4);
  ok(sfx.calls.some(c => c.v === 'seal'), 'the retract machinery is heard');
  ok(S.setsNow().length === 0 && S.live.reactions === 0, 'the folded set and the reaction tail are disposed');
  // a volley and a re-arm batched into ONE frame: the old set fires, a new one rises
  S.update(frameOf({ v:2, wave:2, phase:'armed', hexes:[20, 30, 60], struck:[] }, spirits(onto)));
  S.update(frameOf({ v:2, wave:3, phase:'armed', hexes:[21, 31, 61, 71], struck:[] }, spirits(onto)));
  const now2 = S.setsNow();
  ok(now2.length === 2 && now2[0].fired && !now2[1].fired && now2[1].wave === 3, 'a batched volley + re-arm reads as "that set fired, this one rose"');
  // the show ends: everything retires
  S.update(frameOf(null, spirits(onto)));
  ok(S.setsNow().every(s => s.fired && Number.isFinite(s.cue.endAt)), 'the show ending fires and folds every set');
  step(1 / 60, 60 * 8);
  ok(S.setsNow().length === 0 && !S.busy, '…and the board is clear');
  // a legacy (old replay) show draws nothing here
  S.update(frameOf({ phase:'arming', hexes:[5, 6, 7] }, spirits(onto)));
  ok(S.setsNow().length === 0, 'a legacy show is not drawn as mortars');
  ok(S.camera(true) === null, '♿ no lens shake under reduced motion');
  S.dispose(); ok(!root.children.includes(S.group), 'dispose clears the stage');
}
{
  // a knockout respawn mid-air lets go of the piece at once
  const S = createPyroStage(new THREE.Scene(), { pointFor:point, sfx:recorder() });
  let t = 0; S.tick(t);
  S.update(frameOf({ v:2, wave:1, phase:'armed', hexes:[56, 12], struck:[{ hexNum:56, spiritId:'x' }] }, [{ id:'x', num:56 }]));
  S.landed({ id:'x', from:point(45), to:point(56), toNum:56, kind:'shove' });
  for (let i = 0; i < 30; i++) { t += 1 / 60; S.tick(t); }
  const p = pawnOn(56);
  ok(S.pose('x', p) !== null, 'posing mid-air');
  ok(S.camera(false) !== null, 'the hit shakes the lens');
  S.update(frameOf({ v:2, wave:1, phase:'armed', hexes:[12], struck:[{ hexNum:56, spiritId:'x' }] }, [{ id:'x', num:3 }]));
  ok(S.pose('x', p) === null, 'a Spirit the engine moved off the mortar is let go at once');
  // a strike whose landing never comes (a block pawn) still plays
  S.update(frameOf({ v:2, wave:1, phase:'armed', hexes:[], struck:[{ hexNum:56, spiritId:'x' }, { hexNum:12, spiritId:'y' }] }, [{ id:'x', num:3 }, { id:'y', num:12 }]));
  for (let i = 0; i < 90; i++) { t += 1 / 60; S.tick(t); }
  ok(S.reactionOf('y') !== null, 'a strike with no landing starts on its own after a beat');
  S.dispose();
}

// ── §B the real arena ────────────────────────────────────────────────────────
{
  const { createArenaVisuals } = await import('./arenaVisuals.js');
  const { arenaFrame } = await import('./arenaFrame.js');
  const bytes = readFileSync(new URL('../../public/cosmic-arena/cosmic-arena.glb', import.meta.url));
  const model = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  model.scale.z = -1;
  const scene = new THREE.Scene(); scene.add(model);
  const fg = new THREE.Scene();
  const visuals = createArenaVisuals(scene, { foregroundScene:fg }); visuals.attachModel(model); model.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(43, 1.9, 0.1, 500); camera.position.set(28, 21, 37); camera.lookAt(0, 0, 0);
  const A = 45, a0 = HEX_BY_NUM[A], nb = neighborInDirection(a0, 0), dq = nb.q - a0.q, dr = nb.r - a0.r;
  const lane = d => HEX_BY_QR[`${a0.q + dq * d},${a0.r + dr * d}`].num;
  const RIVAL = lane(1), MORTAR = lane(3);
  const mortars = [MORTAR, 12, 98, 77, 30].filter((h, i, a) => a.indexOf(h) === i);
  const sp = (num, hit = 0) => [
    { id:'cosmic_ronin', num:A, corner:'blue', color:'#4488ff', facing:0, vibe:9, maxVibe:9, imageSrc:'/spirits/ronin.png', hitBackCount:0 },
    { id:'b', num, corner:'red', color:'#ff6600', facing:3, vibe:9, maxVibe:9, imageSrc:'/spirits/b.png', hitBackCount:hit },
  ];
  let time = 1;
  const feed = (spirits, pyro) => visuals.update(arenaFrame({ spirits, actingId:'cosmic_ronin', pyro }));
  const run = (sec) => { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) { time += 1 / 60; vnow += 1000 / 60; visuals.tick(time, false, camera); } };
  feed(sp(RIVAL), { v:2, wave:1, phase:'armed', hexes:mortars, struck:[] });
  run(2.2);
  const group = scene.getObjectByName('Pyro mortars');
  ok(group, "Astra's mortars are in the arena");
  ok(group.getObjectByName(`mortar-${MORTAR}`)?.visible, 'the armed mortar stands on its hex');
  ok(visuals.diagnostics().pyro.sets === 1, 'one set for the wave');
  ok(visuals.diagnostics().hazards === 0 || !scene.getObjectsByProperty?.('userData', 'fire')?.length, 'no legacy discs or cones for a v2 show');
  // the engine's shove: two hexes, the second ONTO the mortar — it stops there
  feed(sp(lane(2), 1), { v:2, wave:1, phase:'armed', hexes:mortars, struck:[] });
  run(0.3);
  feed(sp(MORTAR, 2), { v:2, wave:1, phase:'armed', hexes:mortars.filter(h => h !== MORTAR), struck:[{ hexNum:MORTAR, spiritId:'b' }] });
  let peak = 0, shook = false, landedOn = null;
  const pawn = fg.getObjectByName ? null : null; void pawn;
  const bPawn = () => { let found = null; fg.traverse(o => { if (o.userData?.standee && o.userData.num === MORTAR) found = o; }); return found; };
  // until the reaction has let go of the piece (its T.end, on the show clock, after the skate lands)
  for (let i = 0; i < 60 * 9 && (i < 60 || visuals.diagnostics().pyro.posing > 0); i++) {
    time += 1 / 60; vnow += 1000 / 60; visuals.tick(time, false, camera);
    const p = bPawn(); if (p) peak = Math.max(peak, p.position.y - STANDEE_Y);
    if (visuals.pyroCamera(false)) shook = true;
  }
  const p = bPawn();
  ok(p, 'the shoved standee is on the mortar hex');
  ok(visuals.diagnostics().pyro.posing === 0, 'the reaction has handed the piece back');
  ok(peak > L.launchH * 0.8, `it is thrown up off the mortar (peak ${peak.toFixed(2)} of launchH ${L.launchH})`);
  const at = point(MORTAR);
  near(p.position.x, at.x, 1e-3, 'it comes back down ON the mortar (x)'); near(p.position.z, at.z, 1e-3, '…(z)');
  near(p.position.y, STANDEE_Y, 1e-3, '…standing on the deck');
  near(p.scale.y, 1, 1e-6, '…at rest (no squash left)'); near(p.rotation.x, 0, 1e-6, '…level');
  ok(shook, 'the hit shook the lens');
  ok(visuals.pyroCamera(true) === null, '…but never under reduced motion');
  // END TURN
  feed(sp(MORTAR, 2), { v:2, wave:1, phase:'spent', hexes:[], struck:[{ hexNum:MORTAR, spiritId:'b' }] });
  run(0.5);
  ok(visuals.diagnostics().pyro.sets === 1, 'the set fires and stays up through its hold');
  run(MORTAR_TIMING.flight + L.holdS + 2.5);
  ok(visuals.diagnostics().pyro.sets === 0 && !visuals.diagnostics().pyroBusy, '…then folds away and is gone');
  visuals.dispose();
}

// ── §C the wiring ────────────────────────────────────────────────────────────
{
  const av = readFileSync(new URL('./arenaVisuals.js', import.meta.url), 'utf8');
  const rr = readFileSync(new URL('./arenaRenderer.js', import.meta.url), 'utf8');
  const ss = readFileSync(new URL('./standeeSteps.js', import.meta.url), 'utf8');
  ok(/createStandeeSteps\(root,\{pointFor:arenaPoint,onLand:e=>pyro\.landed\(e\)/.test(av), 'the skate\'s landing is what starts the blast');
  ok(av.indexOf('pyro.tick(time,{reduced});') < av.indexOf('for(const [pawnId,pawn] of pawns)'), 'the stage advances BEFORE the pawns are driven');
  ok(/const blown=pawn\.userData\.standee\?pyro\.pose\(pawnId,pawn\):null;/.test(av), 'a blown piece is posed by the reaction, not the step');
  ok(/updatePawns\(frame\);\s*pyro\.update\(frame\);/.test(av), 'the stage reads the frame after the pawns');
  ok(/const legacyPyro=next\.pyro&&!next\.pyro\.v/.test(av), 'only a legacy show keeps the old discs');
  ok(/visuals\.pyroCamera\?\.\(reduced\)/.test(rr) && /camera\.fov=fov0;camera\.updateProjectionMatrix\(\);/.test(rr), 'the renderer applies the lens shake and puts the camera back');
  ok(/visuals\.resize\?\.\(height\*renderer\.getPixelRatio\(\)\)/.test(rr), 'the mortars learn the screen height');
  ok(/landed\?\.\(\{ id:cur\.id, from:step\.from, to:step\.to, toNum:cur\.toNum, kind:step\.kind \}\)/.test(ss), 'standeeSteps reports each landing once, with its hex');
  ok(JSON.stringify(mortarLookFor(L)).includes('"cannons":false') && JSON.stringify(mortarLookFor(L)).includes('"curtain":false'), 'the game look has no blasters and no curtain (Alex: mortars only)');
}

console.log(`✅ pyroStageCheck: ${checks} checks passed`);
