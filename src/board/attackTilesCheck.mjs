// 🎯 attackTilesCheck — `test:attacktiles`. Hover an attack, see its reach.
// Alex, 2026-09-28: "when the mouse hovers over the ability - there should be
// the spaces that glow up that tell the player the 'reach' of the attack".
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { ATTACK_TILES as T, attackTileWant, attackFade, attackColor, createAttackTiles } from './attackTiles.js';
import { arenaFrame } from './arenaFrame.js';
import { createArenaVisuals, arenaPoint } from './arenaVisuals.js';

let passed = 0; const ok = (name, cond) => { assert.ok(cond, name); passed++; };
console.log('🎯 attackTilesCheck — the reach of an attack glows on the board\n');

console.log('§1 what a tile wants');
{
  const off = attackTileWant({ inReach:false, target:false, nowMs:0 });
  const hex = attackTileWant({ inReach:true, target:false, nowMs:0, reduced:true });
  const hit = attackTileWant({ inReach:true, target:true, nowMs:0, reduced:true });
  ok('a hex out of reach is dark', off.a === 0 && off.lift === 0 && off.ring2 === 0);
  ok('a hex in reach glows', hex.a > .3 && hex.ring2 === 0);
  ok('a rival in reach burns brighter, rises and gets the second ring', hit.a > hex.a && hit.lift > 0 && hit.ring2 === 1);
  const a = attackTileWant({ inReach:true, target:false, nowMs:0 }), b = attackTileWant({ inReach:true, target:false, nowMs:T.pulseS * 250 });
  ok('it pulses…', Math.abs(a.a - b.a) > .02);
  ok('…except under reduced motion', attackTileWant({ inReach:true, target:false, nowMs:0, reduced:true }).a === attackTileWant({ inReach:true, target:false, nowMs:777, reduced:true }).a);
  ok('fades in, not pops', attackFade(0, 1, 16) > 0 && attackFade(0, 1, 16) < 1 && attackFade(0, 1, 16, { reduced:true }) === 1);
  ok('Swing red, Sonic blue — the rail buttons\' hues (a deeper blue than the board\'s cyan lines)', attackColor('swing') === '#ff4a3d' && attackColor('sonic') === '#4f7dff');
  ok('every ability the client can preview has a colour',
    ['swing','sonic','blaster','tentacle','psycho_bushido','gravity_control','displace','shukuchi'].every(k => T.colors[k]));
}

console.log('§2 the three.js tiles');
{
  const root = new THREE.Group(), tiles = createAttackTiles(root, { pointFor:arenaPoint });
  tiles.update({ kind:'sonic', ownerId:'a', near:[46, 47, 48], targets:[47] });
  tiles.tick(0, { reduced:true });
  const d = tiles.diagnostics();
  ok('each hex in reach lights', JSON.stringify(d.lit.sort()) === JSON.stringify([46, 47, 48]) && d.kind === 'sonic');
  ok('only the rival\'s hex gets the target ring', JSON.stringify(d.targets) === JSON.stringify([47]));
  let blue = false; root.traverse(o => { if (o.material?.color && o.visible && o.material.color.b > o.material.color.r) blue = true; });
  ok('in the Sonic\'s blue', blue);
  tiles.update(null);
  for (let t = 16; t < 2000; t += 16) tiles.tick(t);
  ok('mouse off: the glow fades away', tiles.active() === 0 && tiles.diagnostics().lit.length === 0);
  tiles.update({ kind:'swing', ownerId:'a', near:[9999], targets:[] });
  tiles.tick(0, { reduced:true });
  ok('a hex that is not on the board is skipped, not a crash', tiles.diagnostics().lit.length === 0);
  tiles.dispose(); ok('dispose empties the group', root.children.length === 0);
}

console.log('§3 through the frame and the arena');
{
  const spirits = [{ id:'a', num:45, corner:'blue', color:'#4488ff' }, { id:'b', num:46, corner:'red', color:'#ff6600' }];
  const f = arenaFrame({ spirits, attack:{ kind:'swing', ownerId:'a', near:[46, 37], targets:[46] } });
  ok('arenaFrame carries the reach', f.attack?.kind === 'swing' && f.attack.near.length === 2 && f.attack.targets[0] === 46);
  ok('…and drops it when the owner is hidden (smoke)', arenaFrame({ spirits:[spirits[1]], attack:{ kind:'swing', ownerId:'a', near:[46], targets:[] } }).attack === null);
  ok('…and when there is nothing in reach', arenaFrame({ spirits, attack:{ kind:'swing', ownerId:'a', near:[], targets:[] } }).attack === null);
  const visuals = createArenaVisuals(new THREE.Scene());
  visuals.update(f); visuals.tick(1, true);
  ok('arenaVisuals builds, feeds and ticks them', visuals.diagnostics().attackTileDetail.lit.length === 2 && visuals.diagnostics().attackTiles > 0);
  visuals.dispose();
}

console.log('§4 the client wires every ability button to it');
{
  const src = readFileSync(new URL('../rlsw-simulator-v3_8_1.jsx', import.meta.url), 'utf8');
  ok('one reach function for every ability', /function attackReachFor\(kind\)/.test(src)
    && /REACH_KINDS = \['swing','sonic','blaster','tentacle','psycho_bushido','gravity_control','displace','shukuchi','cursed_shamisen'\]/.test(src));
  // 🎸 The Iwato curse v3 (2026-10-09): the "reach" is every Lost Chord on the board (the trap), lit while it can be laid.
  ok('the Shamisen\'s trap lights every Lost Chord', /kind === 'cursed_shamisen'\) \{ for \(const t of boardTokens\) near\.add\(t\.num\); \}/.test(src)
    && /\.\.\.\(live \? reachHover\('cursed_shamisen'\) : \{\}\)/.test(src)
    && /const lands = kind === 'displace' \|\| kind === 'shukuchi' \|\| kind === 'cursed_shamisen';/.test(src));
  ok('built from the SAME sets the click layer uses', /getSwingCone\(acting\)/.test(src) && /getSonicBeam\(acting\)/.test(src)
    && /tentacleOptions\(engineState, acting\)/.test(src) && /bushidoLane\(acting, occupied\)/.test(src) && /shukuchiLandingSet\(\)/.test(src));
  ok('hovering wins; otherwise the armed attack shows', /const reachKind = hoverPreview \?\? \(REACH_KINDS\.includes\(action\) \? action : null\);/.test(src));
  ok('the 3D frame gets it', /attack:attackReach,/.test(src));
  for (const k of ['tentacle','displace','gravity_control','shukuchi','psycho_bushido'])
    ok(`the ${k} button has the hover handlers (on a wrapper — a disabled button fires none)`, src.includes(`{...reachHover('${k}')}`));
  ok('Swing, Sonic and the Blaster keep theirs', /setHoverPreview\('swing'\)/.test(src) && /setHoverPreview\('sonic'\)/.test(src) && /setHoverPreview\(mode\)/.test(src));
}
console.log(`\nPASS: attack tiles — ${passed} checks`);
