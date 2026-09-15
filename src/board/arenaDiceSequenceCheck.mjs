import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3} from 'three';
import {createArenaDiceSequence,ARENA_DICE_READ_AT,ARENA_DICE_GATHER_AT,ARENA_DICE_TIMING} from './arenaDiceSequence.js';
import {COMBAT_DICE_SIDES} from './combatDice.js';

for(const sides of COMBAT_DICE_SIDES){
 const values=Array.from({length:11},(_,i)=>1+i%sides),sequence=createArenaDiceSequence({drive:values,sustain:values,driveSides:sides,sustainSides:sides});
 let previous=[0,0];
 for(let time=0;time<ARENA_DICE_READ_AT+.1;time+=.05){
  const state=sequence.update(time);
  assert.ok(state.sums.every((v,i)=>v>=previous[i]),'counted totals never decrease');previous=state.sums;
  for(const e of sequence.entries){
   const g=e.die.group,p=g.children[0].geometry.attributes.position,v=new Vector3();
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyQuaternion(g.quaternion).multiplyScalar(g.scale.y).add(g.position);assert.ok(v.y>=0,'no die sinks through the floor');}
  }
 }
 const result=sequence.update(ARENA_DICE_READ_AT);
 assert.deepEqual(result.sums,[values.reduce((a,b)=>a+b),values.reduce((a,b)=>a+b)]);
 for(const e of sequence.entries){assert.equal(e.die.group.userData.result,e.value);assert.ok(Math.abs(e.die.group.position.x-e.dock.x)<1e-9);}
 sequence.update(1.1);const snapshot=sequence.entries.map(e=>[...e.die.group.position.toArray(),...e.die.group.quaternion.toArray()]);
 sequence.update(ARENA_DICE_READ_AT);sequence.update(1.1);
 assert.deepEqual(sequence.entries.map(e=>[...e.die.group.position.toArray(),...e.die.group.quaternion.toArray()]),snapshot,'seek reproduces motion');
 sequence.update(ARENA_DICE_GATHER_AT-1e-6);const landed=sequence.entries.map(e=>e.die.group.position.clone());
 sequence.update(ARENA_DICE_GATHER_AT);sequence.entries.forEach((e,i)=>assert.ok(e.die.group.position.distanceTo(landed[i])<1e-6,'gather starts exactly where each die landed'));
 assert.ok(sequence.entries[0].delay!==sequence.entries[1].delay,'throws stagger');
 sequence.update(.5,{reduced:true});assert.ok(sequence.entries.every(e=>Math.abs(e.die.group.position.y-e.die.supportHeight()-.014)<1e-8));
 sequence.dispose();sequence.dispose();
}
const empty=createArenaDiceSequence({drive:[6],sustain:[]});assert.deepEqual(empty.update(ARENA_DICE_READ_AT).sums,[6,0]);empty.dispose();
assert.equal(ARENA_DICE_TIMING.read,2);
// Catch the interrupted edit that previously prevented preview initialization.
const js=readFileSync(new URL('../../.scratch/sonic-rework/barrage.mjs',import.meta.url),'utf8'),html=readFileSync(new URL('../../.scratch/sonic-rework/barrage.html',import.meta.url),'utf8');
for(const match of js.matchAll(/\$\('([^']+)'\)\.addEventListener/g))assert.ok(html.includes(`id="${match[1]}"`),`preview control ${match[1]} exists`);
console.log('PASS: floor clearance, continuous gather, progressive totals, six die sizes, 22 dice, deterministic seeking, reduced motion and preview controls.');
