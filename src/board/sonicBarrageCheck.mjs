import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readFileSync} from 'node:fs';
import {resolveSonicBarrage} from '../engine/systems/sonicBarrage.js';
import {createArenaVisuals, AMP_ROLES} from './arenaVisuals.js';
import {arenaFrame} from './arenaFrame.js';
import {barrageContact,barrageTime,barrageSimulationTime,BARRAGE_LAUNCH,BARRAGE_HOLD,SONIC_DICE,SONIC_GATE} from './sonicBarrageTiming.js';
import {ARENA_DICE_READ_AT,ARENA_DICE_TIMING} from './arenaDiceSequence.js';
import {scheduleSonicBarrage} from './sonicPresentation.js';
import {barrageHitstop,SONIC_BEATS} from './sonicBarrageTiming.js';
import {hitKind,shieldStrength} from './sonicClashVisuals.js';
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
// ⚠️ STAGED (2026-09-22/24): the launch is the LAST pool's read plus the hold,
// never the old simultaneous read (`ARENA_DICE_READ_AT`) — that was the literal
// 8.25 that drifted when the dice were staged.
assert.ok(Math.abs(BARRAGE_LAUNCH-(SONIC_DICE.readAt+BARRAGE_HOLD))<1e-9,'launch follows the staged read');
assert.ok(BARRAGE_LAUNCH>SONIC_DICE.landedAt[0],'the amps never fire while the attacker\'s dice are in the air');
const battle={attackerId:'a',defenderId:'b',sonicAttack:true,sonicVersion:2,sonicId:'modern',
 phase:'sonic_roll',sonicRollStartedAt:performance.now()-7000,dicePool:drive.map(()=>6),diceVals:drive,
 diceHits:ledger.shots.map(s=>s.through>0),shieldValue:12,sustainPool:[6,6,6],sustainRolls:[5,4,3],...ledger};
for(const reduced of [true,false])for(let t=0;t<6;t+=.017)
 assert.ok(Math.abs(barrageSimulationTime(battle,barrageTime(battle,t,reduced),reduced)-t)<1e-8);
const sound=barrageSoundEvents({...battle,shots:ledger.shots.map(s=>({...s,at:BARRAGE_LAUNCH+barrageContact(s.index)}))});
assert.equal(sound.filter(s=>s.kind==='count').length,8);
assert.equal(sound.filter(s=>s.kind==='crack').length,1);
const timers=[];scheduleSonicBarrage({battle,schedule:(fn,at)=>timers.push(at),phase(){},close(){}});
// The barrage is scheduled from the ATTACKER's press, which is the gate.
assert.ok(Math.abs(timers[1]-(BARRAGE_LAUNCH-SONIC_GATE)*1000)<1e-6,'launch timer runs from the attacker\'s throw');assert.ok(timers.every((t,i)=>!i||t>timers[i-1]));
const bytes=readFileSync(new URL('../../public/cosmic-arena/cosmic-arena.glb',import.meta.url));
const model=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
model.scale.z=-1;const scene=new THREE.Scene();scene.add(model);const visuals=createArenaVisuals(scene);visuals.attachModel(model);
// 🔇 Snapshot every amp cabinet's scale BEFORE the battle — Alex: "make sure
// the amp itself isn't 'pulsing' or moving". Compared after the ticks below.
const ampScales=[];model.traverse(n=>{let p=n;while(p&&!/^Amp_/.test(p.name))p=p.parent;if(p)ampScales.push([n,n.scale.toArray().join()]);});
const f=arenaFrame({spirits:[{id:'a',num:7,corner:'blue',color:'#62dbff'},{id:'b',num:16,corner:'red',color:'#b0a0ff'}],noteStates:{},battle});
visuals.update(f);visuals.tick(1);
assert.ok(scene.getObjectByName('Arena floor dice')?.visible,'live arena uses floor dice');
// 🔊 2026-09-24: the live Sonic is the CLASH — the signed-off ring beam at full
// tuning against one shield the Rival builds (Alex's beat list). The 2026-09-19
// barrage wrapper must not come back by accident.
assert.ok(scene.getObjectByName('Sonic clash'),'live arena draws the Sonic clash');
assert.equal(scene.getObjectByName('Sonic shieldbreaker barrage'),undefined,'…and not the 2026-09-19 barrage wrapper');
assert.ok(scene.getObjectByName('Sonic shield'),'the Rival has ONE shield for the whole bout');
// ⏸ Every contact freezes the wall clock for the hit-stop; the break then crawls.
for(let i=0;i<drive.length;i++){
 const at=barrageTime(battle,barrageContact(i));
 assert.ok(Math.abs(barrageSimulationTime(battle,at+SONIC_BEATS.hitstop*.5)-barrageContact(i))<1e-9,`hit ${i+1} holds the picture still`);
 assert.equal(barrageHitstop(battle,at+.1)?.index,i,`hit ${i+1} is a hit-stop the lens can shake on`);
}
const breakAt=barrageTime(battle,barrageContact(battle.breakIndex))+SONIC_BEATS.hitstop;
assert.ok(Math.abs(barrageSimulationTime(battle,breakAt+.5)-(barrageContact(battle.breakIndex)+.5*SONIC_BEATS.breakRate))<1e-9,'the break plays in slow motion');
assert.equal(barrageTime(battle,3,true),3,'reduced motion keeps no stops');
// What each die does to the shield.
assert.deepEqual(ledger.shots.map(s=>hitKind(s,battle)),['crack','both','shatter','spirit','spirit']);
assert.equal(hitKind({index:0,strength:1,before:12,absorbed:1,through:0},battle),'burst','a weak die just bursts on a strong shield');
assert.ok(Math.abs(shieldStrength(battle)-12/18)<1e-9,'brightness = the Sustain roll against its maximum');
for(const [corner,roles] of Object.entries(AMP_ROLES)){
 const driveBox=new THREE.Box3().setFromObject(model.getObjectByName('Amp_'+roles.drive));
 const sustainBox=new THREE.Box3().setFromObject(model.getObjectByName('Amp_'+roles.sustain));
 assert.ok(driveBox.getSize(new THREE.Vector3()).length()>sustainBox.getSize(new THREE.Vector3()).length(),corner+' dedicates its larger stack to Drive');
}
f.battle.phase='sonic_volley';visuals.update(f);visuals.tick(2);visuals.tick(4.6);
assert.equal(scene.getObjectByName('Arena floor dice').visible,false);
assert.ok(f.battle.focus,'the ring beam supplies cinematic focus');
assert.ok(ampScales.length>0&&ampScales.every(([n,was])=>n.scale.toArray().join()===was),'no amp cabinet grows, shrinks or jitters through a Sonic');
let ringBeams=0;scene.getObjectByName('Sonic clash').traverse(n=>{if(n.name==='Sonic zigzag volley')ringBeams++;});
assert.equal(ringBeams,drive.length,'one signed-off ring beam per Drive die');
scene.traverse(n=>{assert.ok(n.position.toArray().every(Number.isFinite),n.name+' has finite coordinates');});
visuals.dispose();assert.equal(scene.getObjectByName('Sonic clash'),undefined);
console.log('PASS: shield ledger, conservation, exact break, timing inversion, sound cues and hit-stops, slow break, hit kinds and the real arena clash wiring');
