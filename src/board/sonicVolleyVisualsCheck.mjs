import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildSonicPath,createSonicVolleyVisuals,sonicVolleyDuration} from './sonicVolleyVisuals.js';

const attacker=new THREE.Vector3(0,.9,0),defender=new THREE.Vector3(6,.9,0);
const origins=[new THREE.Vector3(-7,2,-3),new THREE.Vector3(-7,3,3)];
const distanceXZ=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
for(const origin of [...origins,new THREE.Vector3(9,2,2)])for(const side of [-1,1])for(const passed of [false,true]) {
  const path=buildSonicPath({origin,attackerPosition:attacker,defenderPosition:defender,side,passed});
  assert.ok(path.getPoint(0).distanceTo(origin)<1e-10,'launches at the actual world-space speaker');
  assert.ok(path.getPoint(1).distanceTo(passed?defender:path.shieldPoint)<1e-10,'absorbed notes stop at the shield; successes reach the Spirit');
  assert.ok(path.getPoint(path.shieldT).distanceTo(path.shieldPoint)<1e-9,'shield timing marks the exact contact');
  let wrapped=false;
  for(let j=0;j<=1500;j++) {
    const p=path.getPoint(j/1500),previous=path.getPoint(Math.max(0,j-1)/1500);
    assert.ok(distanceXZ(p,attacker)>=1.05-1e-9,'no trajectory cuts through the attacking body');
    assert.ok(p.distanceTo(previous)<=path.length/1500+1e-8,'path is continuous, including tangent joins');
    if(Math.abs(p.x-attacker.x)<.3&&Math.sign(p.z-attacker.z)===side)wrapped=true;
  }
  assert.ok(wrapped,'each path wraps its assigned side of the attacker');
}
const input={ampOrigins:origins,attackerPosition:attacker,defenderPosition:defender,dice:[{value:6,passed:true},{value:2,passed:false}],chordPitches:[0,3,6,9],launchDelay:.8};
const before=JSON.stringify(input),volley=createSonicVolleyVisuals(input),scene=new THREE.Scene();scene.add(volley.group);
const notes=volley.group.children.filter(o=>o.name.startsWith('Sonic die'));
assert.equal(notes.length,2);assert.deepEqual(notes.map(o=>o.userData.wrapSide),[1,-1]);
assert.equal(volley.duration,sonicVolleyDuration(2,.8));
volley.update(-1);assert.ok(volley.group.visible);assert.ok(notes.every(o=>!o.visible));
assert.ok(volley.group.getObjectByName('Sustain holds').children[0].material.opacity>0,'the intact shield can be shown before the dice roll');
volley.update(.7);assert.ok(notes.every(o=>!o.visible),'wave launch waits until the caller-visible dice roll finishes');
volley.update(.8);assert.ok(notes[0].visible);assert.ok(notes[0].position.equals(origins[0]));
const state=()=>volley.group.children.map(o=>({name:o.name,visible:o.visible,position:o.position.toArray(),scale:o.scale.toArray(),opacity:o.material?.opacity}));
volley.update(1.7);const first=state();volley.update(2.5);volley.update(1.7);assert.deepEqual(state(),first,'absolute time permits deterministic replay/seeking');
volley.update(1.7,{reduced:true});assert.ok(notes.every(o=>!o.visible),'reduced motion suppresses travelling notes');
assert.ok(volley.group.children.filter(o=>o.name==='Harmonic wave ribbon').every(o=>!o.visible),'reduced motion suppresses moving trails');
volley.update(2.62,{reduced:true});assert.ok(volley.group.children.some(o=>o.name==='Spirit note arrival'&&o.visible),'reduced motion retains an outcome cue');
const shield=volley.group.getObjectByName('Sustain holds');const shellChildren=[...shield.children];
volley.update(2.95);assert.deepEqual(shield.children,shellChildren,'successful/absorbed notes never dismantle the shield');
assert.ok(shield.scale.equals(new THREE.Vector3(1,1,1)),'the held shield does not collapse');
assert.equal(JSON.stringify(input),before,'caller data is read-only');
volley.update(volley.duration);assert.equal(volley.group.visible,false,'the complete timeline expires');
const resources=new Map();volley.group.traverse(o=>{if(o.geometry)resources.set(o.geometry,0);if(o.material)resources.set(o.material,0);});
for(const resource of resources.keys())resource.addEventListener('dispose',()=>resources.set(resource,resources.get(resource)+1));
volley.dispose();volley.dispose();volley.update(0);
assert.ok([...resources.values()].every(count=>count===1),'every shared geometry/material is disposed exactly once');
assert.equal(scene.children.length,0);assert.equal(volley.group.children.length,0);
const noRig=createSonicVolleyVisuals({...input,ampOrigins:[]});assert.equal(noRig.group.visible,false,'no physical rig means no invented spirit-origin shots');noRig.dispose();
const transposed=createSonicVolleyVisuals({...input,chordPitches:[2,5,8,11]}),major=createSonicVolleyVisuals({...input,chordPitches:[0,4,7,11]});
assert.deepEqual(transposed.group.children.filter(o=>o.name.startsWith('Sonic die')).map(o=>o.userData.interval),[0,3],'transposing preserves the chord texture');
assert.deepEqual(major.group.children.filter(o=>o.name.startsWith('Sonic die')).map(o=>o.userData.interval),[0,4],'chord quality changes harmonic texture');
transposed.dispose();major.dispose();
console.log('PASS: real amp origins, both wrap sides, body clearance, shield/Spirit endpoints, deterministic timeline, reduced motion, intact Sustain and resource cleanup');
