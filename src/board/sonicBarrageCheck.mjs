import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readFileSync} from 'node:fs';
import {resolveSonicBarrage} from '../engine/systems/sonicBarrage.js';
import {createArenaVisuals, AMP_ROLES} from './arenaVisuals.js';
import {arenaFrame} from './arenaFrame.js';
import {barrageContact,barrageTime,barrageSimulationTime,BARRAGE_LAUNCH} from './sonicBarrageTiming.js';
import {ARENA_DICE_READ_AT,ARENA_DICE_TIMING} from './arenaDiceSequence.js';
import {scheduleSonicBarrage} from './sonicPresentation.js';
import {barrageSoundEvents} from '../audio/sonicBarrageAudio.js';
const drive=[6,5,4,6,3],ledger=resolveSonicBarrage(drive,12);
assert.deepEqual(ledger.shots.map(s=>s.through),[0,0,3,6,3]);
assert.equal(ledger.strengthThrough,12);assert.equal(ledger.breakIndex,2);
assert.equal(resolveSonicBarrage([6,6],12).strengthThrough,0);
assert.equal(resolveSonicBarrage([2,3],12).shieldRemaining,7);
assert.equal(resolveSonicBarrage([2,3],0).strengthThrough,5);
let seed=17;
for(let i=0;i<100;i++){
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return 1+seed%20;};
 const faces=Array.from({length:11},next),hp=next()*4,out=resolveSonicBarrage(faces,hp);
 assert.equal(out.shots.reduce((n,s)=>n+s.absorbed+s.through,0),faces.reduce((n,v)=>n+v,0));
 assert.equal(out.shieldRemaining,Math.max(0,hp-faces.reduce((n,v)=>n+v,0)));
}
assert.equal(BARRAGE_LAUNCH,ARENA_DICE_READ_AT+ARENA_DICE_TIMING.read);
const battle={attackerId:'a',defenderId:'b',sonicAttack:true,sonicVersion:2,sonicId:'modern',
 phase:'sonic_roll',sonicRollStartedAt:performance.now()-7000,dicePool:drive.map(()=>6),diceVals:drive,
 diceHits:ledger.shots.map(s=>s.through>0),shieldValue:12,sustainPool:[6,6,6],sustainRolls:[5,4,3],...ledger};
for(const reduced of [true,false])for(let t=0;t<6;t+=.017)
 assert.ok(Math.abs(barrageSimulationTime(battle,barrageTime(battle,t,reduced),reduced)-t)<1e-8);
const sound=barrageSoundEvents({...battle,shots:ledger.shots.map(s=>({...s,at:BARRAGE_LAUNCH+barrageContact(s.index)}))});
assert.equal(sound.filter(s=>s.kind==='count').length,8);
assert.equal(sound.filter(s=>s.kind==='crack').length,1);
const timers=[];scheduleSonicBarrage({battle,schedule:(fn,at)=>timers.push(at),phase(){},close(){}});
assert.equal(timers[1],8250);assert.ok(timers.every((t,i)=>!i||t>timers[i-1]));
const bytes=readFileSync(new URL('../../public/cosmic-arena/cosmic-arena.glb',import.meta.url));
const model=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
model.scale.z=-1;const scene=new THREE.Scene();scene.add(model);const visuals=createArenaVisuals(scene);visuals.attachModel(model);
const f=arenaFrame({spirits:[{id:'a',num:7,corner:'blue',color:'#62dbff'},{id:'b',num:16,corner:'red',color:'#b0a0ff'}],noteStates:{},battle});
visuals.update(f);visuals.tick(1);
assert.ok(scene.getObjectByName('Arena floor dice')?.visible,'live arena uses floor dice');
assert.ok(scene.getObjectByName('Sonic shieldbreaker barrage'),'live arena uses the approved barrage');
assert.ok(scene.getObjectByName('Sustain amp feed'),'shield has a dedicated feed');
for(const [corner,roles] of Object.entries(AMP_ROLES)){
 const driveBox=new THREE.Box3().setFromObject(model.getObjectByName('Amp_'+roles.drive));
 const sustainBox=new THREE.Box3().setFromObject(model.getObjectByName('Amp_'+roles.sustain));
 assert.ok(driveBox.getSize(new THREE.Vector3()).length()>sustainBox.getSize(new THREE.Vector3()).length(),corner+' dedicates its larger stack to Drive');
}
f.battle.phase='sonic_volley';visuals.update(f);visuals.tick(2);visuals.tick(4.6);
assert.equal(scene.getObjectByName('Arena floor dice').visible,false);
assert.ok(f.battle.focus,'new barrage supplies cinematic focus');
scene.traverse(n=>{assert.ok(n.position.toArray().every(Number.isFinite),n.name+' has finite coordinates');});
visuals.dispose();assert.equal(scene.getObjectByName('Sonic shieldbreaker barrage'),undefined);
console.log('PASS: shield ledger, conservation, exact break, timing inversion, sound cues and real arena barrage wiring');
