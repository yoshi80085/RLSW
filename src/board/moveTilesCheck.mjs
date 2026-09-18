// 🟪 moveTilesCheck — `test:movetiles`. The hexes you can step to, as magenta
// tiles in the 3D arena, and the pips that count the steps left (Alex,
// 2026-09-17; dial-in off `.scratch/camera-move-tiles-preview.html`).
//
// Plain node. The pure half is asserted at exact milliseconds; the three.js half
// is built for real (three runs headless) and read back.
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { MOVE_TILES as T, tileWant, fadeToward, createStepBudget, createMoveTiles } from './moveTiles.js';
import { arenaFrame } from './arenaFrame.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) pass++; else fail++; if (!cond || process.env.VERBOSE) console.log(`  ${cond ? '✓' : '✗'} ${name}${extra !== '' ? ' — ' + extra : ''}`); };
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
console.log('🟪 moveTilesCheck — you can see where you can go, and how far\n');

console.log('§1 the numbers are the dial-in');
ok('MOVE_TILES is frozen', Object.isFrozen(T));
ok('MOVE_TILES matches the 2026-09-17 dial-in', JSON.stringify(T) === JSON.stringify({
  color:'#ff3df2', style:'outline', rim:'spirit', brightness:2.25, nearOpacity:0.7, plateHeight:0.22, plateInset:0.86,
  pulseS:2.4, pulseDepth:0.35, hoverBoost:0.75, pips:'ring', boardDim:0.25, fadeMs:180, farReach:'off', farOpacity:0.1 }));
{
  const preview = new URL('../../.scratch/camera-move-tiles-preview.html', import.meta.url);
  if (existsSync(preview)) {
    const html = readFileSync(preview, 'utf8');
    const def = k => { const m = html.match(new RegExp(`key:'${k}'[^\\n]*?def:([^,}\\n]+)`)); return m && m[1].trim().replace(/^'|'$/g, ''); };
    const map = { tileColor:'color', tileStyle:'style', rimColor:'rim', brightness:'brightness', nearOpacity:'nearOpacity', plateHeight:'plateHeight',
      plateInset:'plateInset', pulseS:'pulseS', pulseDepth:'pulseDepth', hoverBoost:'hoverBoost', pips:'pips', boardDim:'boardDim', fadeMs:'fadeMs', farReach:'farReach', farOpacity:'farOpacity' };
    const off = Object.entries(map).filter(([k, v]) => String(def(k)) !== String(T[v])).map(([k]) => `${k}=${def(k)}≠${T[map[k]]}`);
    ok('every tile lever on the preview page equals the shipped number', off.length === 0, off.join(', '));
  } else console.log('  (preview page not present — parity skipped)');
}

console.log('§2 the pure half');
{
  ok('a tile nobody can reach wants nothing', JSON.stringify(tileWant({ near:false, hot:true, nowMs:0 })) === '{"a":0,"lift":0}');
  const as = []; for (let t = 0; t < T.pulseS * 1000; t += 50) as.push(tileWant({ near:true, hot:false, nowMs:t }).a);
  ok('a reachable tile pulses between nearOpacity·(1−depth) and nearOpacity', Math.abs(Math.min(...as) - T.nearOpacity * (1 - T.pulseDepth)) < 0.01 && Math.abs(Math.max(...as) - T.nearOpacity) < 0.01, `${Math.min(...as).toFixed(3)}…${Math.max(...as).toFixed(3)}`);
  const hot = tileWant({ near:true, hot:true, nowMs:0 }), cold = tileWant({ near:true, hot:false, nowMs:0 });
  ok('the tile under the mouse is brighter and lifted', hot.a > cold.a && hot.lift > 0 && cold.lift === 0);
  const r1 = tileWant({ near:true, hot:false, nowMs:0, reduced:true }), r2 = tileWant({ near:true, hot:false, nowMs:777, reduced:true });
  ok('reduced motion: no pulse', r1.a === r2.a);
  ok('fade: part way after one frame, instant under reduced motion', fadeToward(0, 1, 16) > 0 && fadeToward(0, 1, 16) < 1 && fadeToward(0, 1, 16, { reduced:true }) === 1);
  ok('fade: ~95% there after fadeMs', fadeToward(0, 1, T.fadeMs) > 0.94);
  const b = createStepBudget();
  ok('budget: the grant is the high-water mark', b.read({ kind:'move', ownerId:'ronin', turn:3, steps:4 }) === 4 && b.read({ kind:'move', ownerId:'ronin', turn:3, steps:2 }) === 4);
  ok('budget: a new turn starts over', b.read({ kind:'move', ownerId:'monster', turn:4, steps:2 }) === 2);
  ok('budget: an explicit max wins (the Shadow keeps its own)', b.read({ kind:'shadow', ownerId:'ronin', turn:4, steps:1, max:3 }) === 3);
  ok('budget: no reach, no pips', b.read(null) === 0);
}

console.log('§3 the three.js half');
{
  const pointFor = (n, h = 0.2) => new THREE.Vector3(n * 2, h, 0);
  const root = new THREE.Group(), tiles = createMoveTiles(root, { pointFor });
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 500); camera.position.set(0, 20, 30);
  const pawn = new THREE.Group(); pawn.position.set(0, 0.34, 0); const pawns = new Map([['ronin', pawn]]);
  const spirits = [{ id:'ronin', color:'#4488ff' }];
  let now = 1000; const run = (ms, opts) => { for (let t = 0; t < ms; t += 16) { now += 16; tiles.tick(now, camera, pawns, opts); } };
  tiles.update({ kind:'move', ownerId:'ronin', turn:1, near:[1, 2, 3], steps:3, hover:2 }, spirits);
  run(600);
  const d = tiles.diagnostics();
  ok('the reachable hexes are lit', JSON.stringify(d.lit) === '[1,2,3]', JSON.stringify(d.lit));
  const group = root.getObjectByName('Move tiles');
  const meshes = group.children.filter(o => o.isMesh && o.geometry.type === 'CylinderGeometry');
  const plate = meshes.find(m => Math.abs(m.position.x - 2) < 1e-9);
  const expect = new THREE.Color(T.color).multiplyScalar(T.brightness);
  ok('the fill is the dial-in magenta at its glow', plate.material.color.equals(expect), plate.material.color.getHexString());
  ok("'outline': the fill stays faint (≤ 15% of the tile's strength)", plate.material.opacity <= 0.15 + 1e-9, plate.material.opacity.toFixed(3));
  const rims = group.children.filter(o => o.isMesh && o.geometry.type === 'RingGeometry' && o.visible);
  ok("'rim: spirit': the outline is the Spirit's own colour", rims.length === 3 && rims[0].material.color.equals(new THREE.Color('#4488ff').multiplyScalar(T.brightness)));
  const hovered = rims.find(m => Math.abs(m.position.x - 4) < 1e-9), other = rims.find(m => Math.abs(m.position.x - 2) < 1e-9);
  ok('the hovered tile rises above the others', hovered.position.y > other.position.y + 0.05, `${hovered.position.y.toFixed(3)} vs ${other.position.y.toFixed(3)}`);
  ok('the tiles sit on the board, under the pawns', other.position.y > 0.15 && other.position.y < 0.34);
  ok('pips: one per step, on the camera side of the pawn', d.pips === 3);
  const pipGroup = group.getObjectByName('Step pips');
  const lit = pipGroup.children.filter(m => !m.material.color.equals(new THREE.Color(0x3a4666))).length;
  ok('pips: all lit at a full budget', lit === 3);
  ok('pips: toward the camera', pipGroup.children.every(m => m.position.z > 0));
  ok('the board dims while a walk is armed', Math.abs(d.dim - T.boardDim) < 0.01, d.dim.toFixed(3));
  ok('active() > 0 while lit — the reduced-motion loop keeps drawing', tiles.active() > 0);
  tiles.update({ kind:'move', ownerId:'ronin', turn:1, near:[2, 3, 4], steps:1, hover:null }, spirits); run(600);
  const d2 = tiles.diagnostics();
  ok('a step later: the old hex fades, the new one lights', JSON.stringify(d2.lit) === '[2,3,4]', JSON.stringify(d2.lit));
  ok('pips: still three, one lit', d2.pips === 3 && pipGroup.children.filter(m => !m.material.color.equals(new THREE.Color(0x3a4666))).length === 1);
  tiles.update({ kind:'move', ownerId:'ronin', turn:1, near:[], steps:0, hover:null }, spirits); run(600);
  const d3 = tiles.diagnostics();
  ok('out of steps: no tiles, no dim — but the pips stay, all grey', d3.lit.length === 0 && d3.dim < 0.01 && d3.pips === 3 && pipGroup.children.every(m => m.material.color.equals(new THREE.Color(0x3a4666))), JSON.stringify(d3));
  tiles.update(null, spirits); run(600);
  ok('no walk armed: nothing drawn, active() is 0', tiles.diagnostics().pips === 0 && tiles.active() === 0);
  tiles.update({ kind:'shadow', ownerId:'ronin', turn:1, near:[5], steps:2, max:3, hover:null }, spirits); run(600);
  ok("the Shadow's walk lights tiles but draws no pips (its decoy isn't in the arena)", JSON.stringify(tiles.diagnostics().lit) === '[5]' && tiles.diagnostics().pips === 0);
  tiles.update({ kind:'move', ownerId:'ronin', turn:2, near:[7], steps:2, hover:null }, spirits); tiles.tick(now + 16, camera, pawns, { reduced:true });
  ok('reduced motion: tiles appear at once, no fade', JSON.stringify(tiles.diagnostics().lit) === '[7]');
  tiles.dispose();
  ok('dispose removes the group', !root.getObjectByName('Move tiles'));
}

console.log('§4 the frame');
{
  const spirits = [{ id:'ronin', num:10 }, { id:'monster', num:20 }];
  const f = arenaFrame({ spirits, actingId:'ronin', reach:{ kind:'move', ownerId:'ronin', turn:4, near:new Set([11, 12]), steps:2, hover:11 } });
  ok('reach passes through for a visible owner, as plain arrays', JSON.stringify(f.reach) === JSON.stringify({ kind:'move', ownerId:'ronin', turn:4, near:[11, 12], steps:2, hover:11 }), JSON.stringify(f.reach));
  ok('a smoke-hidden owner sends no reach', arenaFrame({ spirits:[{ id:'monster', num:20 }], reach:{ kind:'move', ownerId:'ronin', near:[11] } }).reach === null);
  ok("the Shadow's reach needs its decoy in the frame", arenaFrame({ spirits, reach:{ kind:'shadow', ownerId:'ronin', near:[11], max:3 } }).reach === null
    && arenaFrame({ spirits, shadowDecoy:{ id:'ronin', num:30 }, reach:{ kind:'shadow', ownerId:'ronin', near:[11], steps:1, max:3 } }).reach?.max === 3);
  ok('no reach → null', arenaFrame({ spirits }).reach === null);
}

console.log('§5 the wiring');
{
  const v = read('./arenaVisuals.js'), r = read('./arenaRenderer.js'), c = read('../rlsw-simulator-v3_8_1.jsx'), b = read('../ui/BoardViewport.jsx');
  ok('arenaVisuals builds, feeds, ticks and disposes the tiles', /createMoveTiles\(root,\{pointFor:arenaPoint\}\)/.test(v) && /moveTiles\.update\(frame\.reach,frame\.spirits\)/.test(v)
    && /moveTiles\.tick\(time\*1000,camera,pawns,\{reduced\}\)/.test(v) && /moveTiles\.dispose\(\)/.test(v) && /moveTiles:moveTiles\.active\(\)/.test(v));
  ok('the renderer keeps drawing under reduced motion while tiles fade', /stats\.moveTiles>0/.test(r));
  const call = c.slice(c.indexOf('sceneFrame={board3D ? arenaFrame({'), c.indexOf('}) : undefined}>', c.indexOf('sceneFrame={board3D ? arenaFrame({')));
  ok('the client sends the SAME reachable set the click layer uses', /near:\[\.\.\.reachable\], steps:moveStepsLeft, hover:hovered/.test(call));
  ok("…and the Shadow's, with its own step budget", /near:\[\.\.\.shadowReachable\], steps:shadowSteps, max:shadowIllusion\?\.stepsMax/.test(call));
  ok('the SVG hex marks a move tile', /data-move-tile=\{reachable\.has\(hex\.num\) \|\| shadowReachable\.has\(hex\.num\) \? '' : undefined\}/.test(c));
  ok("…and BoardViewport hides that old 9% fill once the arena is ready", /\[data-arena-ready\] \.arena-tactical \[data-move-tile\] \{ fill:transparent; \}/.test(b));
}

console.log(fail ? `\n❌ moveTilesCheck: ${fail} failed, ${pass} passed` : `\n✅ moveTilesCheck: ${pass} assertions passed`);
process.exit(fail ? 1 : 0);
