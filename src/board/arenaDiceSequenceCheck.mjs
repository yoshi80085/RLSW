import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3} from 'three';
import {createArenaDiceSequence,arenaDiceSchedule,arenaDieTiming,diceBeat,ARENA_DICE_READ_AT,ARENA_DICE_GATHER_AT,ARENA_DICE_TIMING} from './arenaDiceSequence.js';
import {COMBAT_DICE_SIDES} from './combatDice.js';

for(const sides of COMBAT_DICE_SIDES){
 const values=Array.from({length:11},(_,i)=>1+i%sides),sequence=createArenaDiceSequence({drive:values,sustain:values,driveSides:sides,sustainSides:sides});
 let previous=[0,0];
 for(let time=0;time<ARENA_DICE_READ_AT+.1;time+=.05){
  const state=sequence.update(time);
  assert.ok(state.sums.every((v,i)=>v>=previous[i]),'counted totals never decrease');previous=state.sums;
  for(const e of sequence.entries){
   const g=e.die.group,p=g.geometry?.attributes?.position;if(!p)continue;const v=new Vector3();
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

// ── The staged throw (one pool at a time) ───────────────────────────────────
// ⚠️ THE WHOLE POINT OF THE STAGING IS THAT THE GATHER WAITS. These assertions
// exist because the obvious implementation — leaving the gather on the module
// constant — sweeps the second Spirit's dice up while they are still in the
// air, and it looks like a rendering glitch rather than a timing bug.

// The simultaneous case is still exactly what it was, by construction.
const flat=arenaDiceSchedule([0,0]);
assert.equal(flat.gatherAt,ARENA_DICE_GATHER_AT,'poolStart [0,0] gathers on the legacy constant');
assert.equal(flat.readAt,ARENA_DICE_READ_AT,'poolStart [0,0] reads on the legacy constant');
assert.equal(flat.rollingUntil,ARENA_DICE_TIMING.roll,'poolStart [0,0] rolls for exactly the legacy window');
// ⚠️ WRITTEN OUT AS LITERALS ON PURPOSE. Comparing `arenaDieTiming(…,[0,0])`
// against `arenaDieTiming(…)` only proves the function agrees with itself —
// a dropped term passes that happily. This is the pre-staging formula, copied.
const legacyNoise=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
for(let pool=0;pool<2;pool++)for(let index=0;index<7;index++){
 const value=3,seed=index+pool*23+value*.07,t=arenaDieTiming(value,index,pool,[0,0]);
 assert.deepEqual(arenaDieTiming(value,index,pool),t,'a die with no poolStart is timed as one started at zero');
 assert.equal(t.seed,seed,'legacy seed');
 assert.equal(t.delay,index*.075+pool*.11,'legacy throw stagger, including the per-pool offset');
 assert.equal(t.flight,.72+legacyNoise(seed+7)*.16,'legacy flight time');
 assert.equal(t.dockedAt,ARENA_DICE_GATHER_AT+index*.12+pool*.05+.85,'legacy dock time');
 assert.equal(diceBeat(1.0000000000000002),1,'beats are rounded to the millisecond');
}

// A staged schedule hangs off the LAST pool to be thrown, either way round.
for(const starts of [[0,4.6],[4.6,0],[0,9],[2,2]]){
 const s=arenaDiceSchedule(starts),last=Math.max(...starts);
 assert.equal(s.gatherAt,diceBeat(last+ARENA_DICE_TIMING.roll+ARENA_DICE_TIMING.landedHold),'gather follows the last pool thrown');
 assert.equal(s.readAt,diceBeat(s.gatherAt+ARENA_DICE_TIMING.gather),'read follows the gather');
 assert.ok(s.landedAt.every((at,i)=>at===diceBeat(starts[i]+ARENA_DICE_TIMING.roll+ARENA_DICE_TIMING.landedHold)),'each pool lands on its own clock');
 assert.ok(s.gatherAt>=Math.max(...s.landedAt),'no pool is gathered before it has landed');
}

// Sustain first, then Drive — the Sonic order — driven frame by frame.
{
 const drive=[5,3,6,2],sustain=[4,4,1],start=[5.2,0];
 const staged=createArenaDiceSequence({drive,sustain,poolStart:start});
 const s=staged.schedule;
 assert.deepEqual(s.poolStart,start,'the sequence reports the schedule it was built with');
 // The attacker's dice do not exist on the floor until the attacker throws.
 for(let time=0;time<start[0];time+=.1){
  staged.update(time);
  assert.ok(staged.entries.filter(e=>e.pool===0).every(e=>!e.die.group.visible),'pool 0 stays off the floor until its own start');
  assert.ok(time<s.landedAt[1]||staged.entries.filter(e=>e.pool===1).every(e=>e.die.group.visible),'pool 1 is on the floor once it has landed');
 }
 // ⭐ The captions are the staged read: each header lands with its own pool,
 // both totals wait for the gather. A header that waits with the totals tells
 // the table nothing while the first Spirit's dice sit there; a total that
 // arrives with its header does the arithmetic twice, in front of everyone.
 for(const [i,at] of s.landedAt.entries()){
  staged.update(at-1e-6);assert.equal(staged.headers[i].mesh.visible,false,`pool ${i}'s header waits for its own dice`);
  staged.update(at);assert.equal(staged.headers[i].mesh.visible,true,`pool ${i}'s header arrives when its own dice land`);
  staged.update(s.gatherAt-1e-6);assert.equal(staged.totals[i].mesh.visible,false,`pool ${i}'s total waits for the gather`);
  staged.update(s.gatherAt);assert.equal(staged.totals[i].mesh.visible,true,`pool ${i}'s total arrives at the gather`);
 }
 assert.ok(s.landedAt[1]<s.landedAt[0],'this fixture throws Sustain first, so its header must arrive first');
 // Nothing is counted before the gather, and both totals arrive together.
 let lastBefore=staged.update(s.gatherAt-1e-6);
 assert.deepEqual(lastBefore.counts,[0,0],'no die is counted before the pair is gathered');
 assert.equal(lastBefore.phase,'landed','the beat before the gather is the landed hold');
 const read=staged.update(s.readAt);
 assert.deepEqual(read.sums,[drive.reduce((a,b)=>a+b),sustain.reduce((a,b)=>a+b)],'both pools total correctly after a staged throw');
 assert.equal(read.phase,'reading');
 // Against the literal window, not against `s.rollingUntil` — the same trap as
 // the timing parity above: a phase read off its own constant always agrees.
 assert.equal(staged.update(start[0]+ARENA_DICE_TIMING.roll-1e-6).phase,'rolling','the later pool is still rolling right up to its own window closing');
 assert.equal(staged.update(start[0]+ARENA_DICE_TIMING.roll).phase,'landed','the landed hold begins when the LAST pool stops rolling');

 // ⚠️ THE DEFECT THIS WHOLE BLOCK EXISTS FOR. Leaving the airborne branch on
 // the module constant leaves the second pool's dice parked at their landed
 // position from 3.85s: invisible until their start, then POPPING INTO BEING
 // ALREADY AT REST. Every other assertion here passes while that happens —
 // the totals are right, nothing sinks, nothing counts early — so the only
 // thing that catches it is insisting the dice are actually thrown.
 let airborne=0,travelled=0;
 for(let time=start[0];time<s.landedAt[0];time+=.05){
  staged.update(time);
  for(const e of staged.entries.filter(e=>e.pool===0&&e.die.group.visible)){
   if(e.die.group.position.y-e.die.supportHeight()-.014>.35)airborne++;
   if(e.die.group.position.distanceTo(e.landed)>.5&&e.die.group.position.distanceTo(e.origin)>.5)travelled++;
  }
 }
 assert.ok(airborne>20,`the later pool's dice are thrown, not placed — lifted on ${airborne} samples`);
 assert.ok(travelled>20,`the later pool's dice travel between origin and landing — in flight on ${travelled} samples`);
 // Every die is at rest where it landed at the instant the gather begins.
 staged.update(s.gatherAt-1e-6);const rest=staged.entries.map(e=>e.die.group.position.clone());
 staged.update(s.gatherAt);
 staged.entries.forEach((e,i)=>assert.ok(e.die.group.position.distanceTo(rest[i])<1e-6,'a staged gather also starts exactly where each die landed'));
 // No die sinks through the floor anywhere across the longer timeline.
 for(let time=0;time<s.readAt+.1;time+=.05){
  staged.update(time);
  for(const e of staged.entries){
   const g=e.die.group,p=g.geometry?.attributes?.position;if(!p)continue;const v=new Vector3();
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyQuaternion(g.quaternion).multiplyScalar(g.scale.y).add(g.position);assert.ok(v.y>=0,'no staged die sinks through the floor');}
  }
 }
 staged.dispose();
}

// Drive first, then Sustain — the Swing order — reaches the same totals.
{
 const both=[6,6,6],swing=createArenaDiceSequence({drive:both,sustain:both,defenderTitle:'RIVAL DRIVE',poolStart:[0,4.4]});
 const read=swing.update(swing.schedule.readAt);
 assert.deepEqual(read.sums,[18,18],'a Drive-first staged pair still totals both sides');
 assert.equal(swing.schedule.gatherAt,diceBeat(4.4+ARENA_DICE_TIMING.roll+ARENA_DICE_TIMING.landedHold));
 swing.dispose();
}
// Catch the interrupted edit that previously prevented preview initialization.
const js=readFileSync(new URL('../../.scratch/sonic-rework/barrage.mjs',import.meta.url),'utf8'),html=readFileSync(new URL('../../.scratch/sonic-rework/barrage.html',import.meta.url),'utf8');
for(const match of js.matchAll(/\$\('([^']+)'\)\.addEventListener/g))assert.ok(html.includes(`id="${match[1]}"`),`preview control ${match[1]} exists`);
console.log('Arena floor dice: simultaneous parity, staged schedules, per-pool visibility, gather ordering and totals passed.');
