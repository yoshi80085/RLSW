import assert from 'node:assert/strict';
import * as THREE from 'three';
import { scheduleSonicVolley, SONIC_PRESENTATION } from './sonicPresentation.js';
import { createSonicCamera } from './sonicCamera.js';
import { createSonicDiceVisuals } from './sonicDiceVisuals.js';
import { createSonicZigzagVisuals, FLIGHT_SECONDS } from './sonicZigzagVisuals.js';
import { playSonicBeamAudio, sonicChordVoices } from '../audio/sonicBeamAudio.js';
import { createSonicSequenceVisuals } from './sonicSequenceVisuals.js';
import { sonicContactTime, sonicShotStart, SONIC_SEQUENCE } from './sonicSequence.js';
import { arenaFrame } from './arenaFrame.js';
import { createArenaVisuals, arenaPoint } from './arenaVisuals.js';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

for(const count of [1,2,5,11]){
  const events=[],calls=[];
  scheduleSonicVolley({count,schedule:(fn,at)=>events.push({fn,at}),phase:p=>calls.push(p),charge:()=>calls.push('audio'),launch:()=>calls.push('amp'),close:()=>calls.push('close')});
  assert.ok(events.every((e,i)=>!i||e.at>events[i-1].at));
  assert.equal(events[2].at-events[1].at,180,'dice clear before launch');
  assert.equal(events.at(-1).at-events.at(-2).at,500,'result holds half a second');
  events.forEach(e=>e.fn());
  assert.deepEqual(calls,['sonic_reveal','sonic_charge','audio','sonic_volley','amp','result','close']);
}
const a=new THREE.Vector3(0,1,0),b=new THREE.Vector3(2.4,1,0);
const input={attackerPosition:a,defenderPosition:b,ampOrigins:[new THREE.Vector3(-6,2,3)],dice:[{value:2,sides:6,passed:false}],shieldValue:4,shieldRadius:2.4,shieldSize:2.1,strokeStyle:'rings'};
const v=createSonicZigzagVisuals(input);
v.update(FLIGHT_SECONDS+.03);
const compression=v.group.getObjectByName('Sustain compression'),ripple=v.group.getObjectByName('Sustain surface ripple');
assert.ok(compression.visible&&ripple.visible,'held contact compresses and sends a surface ripple');
const shield=v.group.getObjectByName('Sustain holds');
assert.ok(compression.position.x>a.x&&compression.position.x<b.x,'adjacent barrier stays between the actors');
const snapshot=()=>Array.from(ripple.geometry.attributes.position.array);
const first=snapshot();v.update(.1);v.update(FLIGHT_SECONDS+.03);assert.deepEqual(snapshot(),first,'contact seeking is deterministic');
v.update(FLIGHT_SECONDS+.3);assert.ok(!compression.visible&&ripple.visible,'the compression releases into the ripple');
v.update(FLIGHT_SECONDS+.5);assert.ok(!ripple.visible&&shield.visible,'the ripple fades and the shield survives');v.dispose();
const d=createSonicDiceVisuals({...input,dicePool:[6],diceVals:[2],diceHits:[false]});
const die=d.group.getObjectByName('Sonic die 1');
d.update(1,{phase:'sonic_reveal'});assert.ok(die.visible);
d.update(SONIC_PRESENTATION.charge,{phase:'sonic_charge'});assert.ok(!die.visible);
d.update(0,{phase:'sonic_volley'});assert.ok(!die.visible,'no dice ghost over the launch');d.dispose();

const camera=new THREE.PerspectiveCamera(43,1.5,.1,500);camera.position.set(25,20,30);
const controls={target:new THREE.Vector3(),enabled:true,enableDamping:true,update(){}};
const saved=camera.position.clone();const shot=createSonicCamera({camera,controls,pointFor:(num,y)=>new THREE.Vector3(num,y,0)});
const frame={spirits:[{id:'a',num:0,corner:'blue'},{id:'b',num:9}],battle:{key:'1',volley:true,attackerId:'a',defenderId:'b',dicePool:Array(11).fill(6),phase:'sonic_armed'}};
shot.update(frame,null,.016);assert.equal(controls.enabled,true);assert.equal(controls.enableDamping,false);
frame.battle.phase='sonic_volley';frame.battle.focus={point:new THREE.Vector3(9,1,0),target:new THREE.Vector3(9,1,0),closeness:1};
for(let i=0;i<150;i++)shot.update(frame,null,1/60);
assert.ok(camera.position.distanceTo(controls.target)>=5,'contact clearance outside the flash');
const held=camera.position.clone();frame.battle.phase='result';shot.update(frame,null,.05);assert.ok(camera.position.equals(held),'result never reframes');
shot.update({...frame,battle:null},null,.1);assert.ok(!camera.position.equals(saved),'return interpolates rather than snapping');
for(let i=0;i<50;i++)shot.update({...frame,battle:null},null,.02);
assert.ok(camera.position.equals(saved));assert.equal(controls.enabled,true);assert.equal(controls.enableDamping,true);
shot.update(frame,null,.016,true);assert.ok(camera.position.equals(saved),'reduced motion holds the original view');
shot.update({...frame,battle:null},null,.016,true);assert.equal(shot.active,false);

// Actual arena call site, authored cabinets and public frame: upgraded sides and
// first-shot focus must survive the adapter, not merely work in the ring unit test.
const bytes=readFileSync(new URL('../../public/cosmic-arena/cosmic-arena.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
gltf.scene.scale.z=-1;const scene=new THREE.Scene();scene.add(gltf.scene);const visuals=createArenaVisuals(scene);visuals.attachModel(gltf.scene);
const f=arenaFrame({spirits:[{id:'a',num:7,corner:'blue',color:'#62dbff'},{id:'b',num:16,corner:'red',color:'#b0a0ff'}],noteStates:{a:{rigPool:1,rigPower:1}},battle:{attackerId:'a',defenderId:'b',sonicAttack:true,sonicId:'test',phase:'sonic_armed',dicePool:[12],diceVals:[11],diceHits:[true],shieldValue:4,hitCount:1,damage:1}});
visuals.update(f);visuals.tick(1,false,camera);f.battle.phase='sonic_volley';visuals.update(f);visuals.tick(2,false,camera);
assert.ok(f.battle.focus&&f.battle.focus.progress>0,'live frame carries moving camera focus');
assert.ok(scene.getObjectByName('Sonic sequential volley'),'live arena uses the sequential ring module');
assert.ok(f.battle.focus.target.distanceTo(arenaPoint(16,1))<1e-8,'successful shot follows defender');
visuals.dispose();

// Observe Web Audio scheduling without needing a physical output device.
const audioNodes=[];
const param=()=>({events:[],value:0,setValueAtTime(v,t){this.events.push([v,t]);},linearRampToValueAtTime(v,t){this.events.push([v,t]);},exponentialRampToValueAtTime(v,t){assert.ok(v>0);this.events.push([v,t]);},cancelScheduledValues(){}});
const node=()=>{const n={gain:param(),frequency:param(),connect(){return this;},disconnect(){this.disconnected=true;},start(t){this.started=t;},stop(t){this.ended=t;}};audioNodes.push(n);return n;};
const ctx={currentTime:3,createGain:node,createBiquadFilter:node,createOscillator:node};
const stop=playSonicBeamAudio(ctx,{}, {notes:['C','E'],defence:['G'],dice:[{value:6,sides:6,passed:true},{value:2,sides:6,passed:false}],shieldValue:4});
const oscillators=audioNodes.filter(n=>n.started!=null);
assert.equal(oscillators.length,2,'one chord voice per projectile');
assert.equal(oscillators[0].started,oscillators[1].started,'the full chord sounds together');
assert.ok(oscillators.every(n=>n.frequency.events.length===1),'chord pitches stay stable through flight');
assert.deepEqual(sonicChordVoices(['C','Eb','G','Bb'],2).map(v=>v.pitch),[0,3,7,10],'fewer dice cannot drop chord tones');
assert.deepEqual(sonicChordVoices(['C','E','G'],5).map(v=>v.shotIndex),[0,1,2,3,4],'each projectile owns a release');
assert.deepEqual(sonicChordVoices([],5),[],'missing chord data cannot invent a chord');
assert.ok(Math.abs(oscillators[1].ended-oscillators[0].ended-(sonicContactTime(1)-sonicContactTime(0)-.18))<1e-8,'voice release follows individual contacts');
assert.ok(oscillators.every(n=>Number.isFinite(n.ended)&&n.ended>n.started),'all voices have bounded lifetimes');
const filters=audioNodes.filter(n=>n.type==='lowpass');
assert.ok(filters.some(n=>n.frequency.events.some(([v])=>v===6200))&&filters.some(n=>n.frequency.events.some(([v])=>v===180)),'hit opens, absorption chokes');
stop();stop();assert.ok(audioNodes.every(n=>n.disconnected),'cancellation disconnects every node');
const sequence=createSonicSequenceVisuals({...input,dice:[{value:6,sides:6,passed:true},{value:6,sides:6,passed:true}]});
sequence.update(0);const original=sequence.getFocus(.1).target.clone();
const moved=b.clone().add(new THREE.Vector3(2,0,0));
sequence.update(SONIC_SEQUENCE.flight-.1,{defenderPosition:moved});
assert.ok(sequence.getFocus(SONIC_SEQUENCE.flight-.1).target.equals(original),'an airborne shot keeps its aim');
sequence.update(sonicShotStart(1),{defenderPosition:moved});
assert.ok(sequence.getFocus(sonicShotStart(1)).target.equals(moved),'next projectile realigns to the live Rival');
sequence.dispose();
const heldSequence=createSonicSequenceVisuals(input);
heldSequence.update(SONIC_SEQUENCE.flight+.15);
assert.ok(heldSequence.getFocus(SONIC_SEQUENCE.flight+.15).target.x<b.x,'held contact keeps the camera on the barrier, not behind it');
heldSequence.dispose();
console.log('PASS: launch clearance, shield compression/ripple, dice fade, contact hold/return, live arena wiring and bounded distinct audio');

// The user owns an orbit/zoom for the rest of a battle, including result and return.
shot.update(frame,null,.016);shot.userStart();
camera.position.set(17,12,4);controls.target.set(2,1,3);const manualPosition=camera.position.clone();
shot.update(frame,null,.1);assert.ok(camera.position.equals(manualPosition));assert.equal(controls.enabled,true);
frame.battle.phase='result';shot.update(frame,null,.1);assert.ok(camera.position.equals(manualPosition));
shot.update({...frame,battle:null},null,.1);assert.ok(camera.position.equals(manualPosition),'no snap back after a manual battle');
shot.autoCamera(false);shot.update(frame,null,.1);assert.ok(camera.position.equals(manualPosition),'auto-off applies during battle');
shot.autoCamera(true);frame.battle.phase='sonic_roll';shot.update(frame,null,.1);assert.ok(!camera.position.equals(manualPosition),'Follow battle resumes composition');
shot.userStart();camera.position.set(22,14,6);shot.update(frame,null,.1,true);assert.equal(camera.position.x,22,'reduced motion still permits manual orbit');
shot.dispose();
