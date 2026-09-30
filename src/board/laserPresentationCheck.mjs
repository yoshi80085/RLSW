import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createArenaLasers } from './arenaLasers.js';
import { arenaFrame } from './arenaFrame.js';
import { createArenaVisuals } from './arenaVisuals.js';
import { makeInitialState } from '../engine/state.js';
import { applyAction } from '../engine/reduce.js';
import { stageFxActivated, stageFxRoundTicked } from '../engine/actions.js';

const pods = rig => rig.root.children.filter(o => o.name.startsWith('Laser pod'));
const worldPos = p => p.position.clone().add(new THREE.Vector3(0, p.children[0].position.y, 0));
const markers = rig => { const nums = []; rig.root.traverse(o => { if (o.name.startsWith('Laser hazard hex ')) nums.push(Number(o.name.split(' ').at(-1))); }); return [...new Set(nums)].sort((a,b)=>a-b); };
const expected = lines => [...new Set(lines.flat())].sort((a,b)=>a-b);

for (const rounds of [3,4]) {
  let state = makeInitialState({ spirits: [{id:'wildaxe',num:7,corner:'blue'},{id:'vera',num:105,corner:'red'}], mode:'ffa', teams:null, startingLives:3, beginnerMode:false, winCondition:'rounds', roundLimit:20 }, 909);
  state = applyAction(state, stageFxActivated('laser_show', [7,105], rounds));
  assert.ok(state.stageFx.laser, 'real activation creates laser state');
  const scene = new THREE.Scene(), rig = createArenaLasers(scene);
  let time = 0, f = arenaFrame({laser:state.stageFx.laser}), input = JSON.stringify(f);
  assert.equal(f.laserRound, rounds);
  rig.update(f.laser,f.laserRound,time); assert.deepEqual(markers(rig),expected(f.laser),'hazard markers appear before hardware arrives');
  rig.tick(time+4); assert.equal(rig.diagnostics().pods,6); assert.equal(rig.diagnostics().beam,1);
  const identities = pods(rig);
  rig.update(structuredClone(f.laser), f.laserRound, time+5);
  assert.equal(rig.diagnostics().busy,false,'ordinary rerenders do not restart entry');
  assert.equal(JSON.stringify(f),input,'presentation never mutates the frame');
  time=10;
  for(let round=1;round<rounds;round++) {
    state=applyAction(state,stageFxRoundTicked()); f=arenaFrame({laser:state.stageFx.laser});
    rig.tick(time); const before=identities.map(worldPos);
    rig.update(f.laser,f.laserRound,time);
    assert.deepEqual(pods(rig),identities,'round changes keep the exact same six objects');
    identities.forEach((p,i)=>assert.ok(worldPos(p).distanceTo(before[i])<1e-8,'round edge has no teleport'));
    assert.deepEqual(markers(rig),expected(f.laser),'only the new engine lanes remain marked');
    for(const dt of [.23,.8,1.4,2.3]) {
      rig.tick(time+dt); const d=rig.diagnostics();
      assert.equal(d.pods,6); assert.equal(d.beam,0,'no beam sweeps across the board in transit');
    }
    rig.tick(time+4); assert.equal(rig.diagnostics().beam,1); assert.equal(rig.diagnostics().busy,false);
    time+=10;
  }
  state=applyAction(state,stageFxRoundTicked()); assert.equal(state.stageFx.laser,null);
  rig.update([],null,time); assert.equal(rig.diagnostics().lanes,0); assert.equal(rig.diagnostics().beam,0);
  assert.deepEqual(markers(rig),[],'no expired hazard marks during the departure');
  rig.tick(time+1); assert.equal(rig.diagnostics().pods,6,'the dark fleet departs visibly');
  rig.tick(time+3); assert.equal(rig.diagnostics().pods,0); assert.equal(rig.diagnostics().busy,false);
  let disposed=0; rig.root.traverse(o=>o.geometry?.addEventListener('dispose',()=>disposed++));
  rig.dispose(); assert.equal(scene.children.length,0); assert.ok(disposed>0); rig.dispose();
}

// Fast sandbox/replay changes must depart from the current pose, not the last
// pattern's endpoint; expiry during entry/movement cannot bring the beam back.
const a=[[2,9,18,28,38,48,58,68,78,88,98],[1,7,15,24,33,42],[14,24,34,44,54,64,74,84,94,103,110]];
const b=[[5,12,21,31,41,51],a[2],a[0]];
const scene=new THREE.Scene(), rig=createArenaLasers(scene);
rig.update(a,3,0); rig.tick(.8); let before=pods(rig).map(worldPos);
rig.update(b,2,.8); pods(rig).forEach((p,i)=>assert.ok(worldPos(p).distanceTo(before[i])<1e-8));
rig.tick(1.9); before=pods(rig).map(worldPos); rig.update(a,1,1.9);
pods(rig).forEach((p,i)=>assert.ok(worldPos(p).distanceTo(before[i])<1e-8));
rig.update([],null,2); rig.tick(2.2); assert.equal(rig.diagnostics().beam,0);
rig.update(a,3,2.2); rig.tick(2.2,{reduced:true}); assert.equal(rig.diagnostics().beam,1); assert.equal(rig.diagnostics().busy,false);
rig.update([],null,2.3); assert.equal(rig.diagnostics().pods,0,'reduced motion removes expired pods without flying');
rig.dispose();

// The actual arena owns the lifecycle, draws above the SVG and cleans it up.
const arena=new THREE.Scene(), foreground=new THREE.Scene(), visuals=createArenaVisuals(arena,{foregroundScene:foreground});
visuals.update(arenaFrame({laser:{beams:a.map(hexes=>({hexes})),roundsLeft:3}}));
visuals.tick(4,true); assert.equal(visuals.diagnostics().laserDetail.pods,6);
assert.ok(foreground.getObjectByName('Live laser show')); assert.equal(arena.getObjectByName('Live laser show'),undefined);
visuals.update(arenaFrame({})); assert.equal(visuals.diagnostics().hazards,0);
visuals.dispose(); assert.equal(foreground.getObjectByName('Live laser show'),undefined);
console.log('PASS: live engine 3/4-round laser lifecycle, persistent pods, active-lane truth, interruptions, reduced motion, foreground ownership and disposal');
