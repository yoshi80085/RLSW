// The in-arena dice are the readable source of truth for the volley (§12.1b).
// node src/board/sonicDiceVisualsCheck.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSonicDiceVisuals, sonicSceneLabel } from './sonicDiceVisuals.js';

const attacker=new THREE.Vector3(0,1,0),defender=new THREE.Vector3(6,1,0);
const input={attackerPosition:attacker,defenderPosition:defender,
  dicePool:[6,6,8,12,6],diceVals:[6,4,5,1,4],diceHits:[true,false,true,false,false],
  shieldValue:4,hitCount:2,damage:1,color:'#66dcff',shieldColor:'#b0a0ff'};
const before=JSON.stringify(input);
const scene=new THREE.Scene(),visuals=createSonicDiceVisuals(input);scene.add(visuals.group);
const dice=visuals.group.children.filter(o=>o.name.startsWith('Sonic die'));
assert.equal(dice.length,5,'one object per pooled die');

// Nothing may leak a verdict before the roll has been revealed.
for(const phase of ['sonic_ready','sonic_armed','sonic_roll']) {
  visuals.update(.5,{phase});
  assert.ok(dice.every(d=>d.userData.settled===false),`${phase} keeps the dice unsettled`);
  assert.ok(dice.every(d=>d.userData.hit===null),`${phase} never previews which dice pass`);
}
visuals.update(.4,{phase:'sonic_armed'});
const armedTitle=visuals.group.children.find(o=>o.isSprite&&/PRESS ROLL/.test(o.userData.text??''));
assert.ok(armedTitle,'the armed phase tells the player a roll is owed');
assert.ok(/5 DICE/.test(armedTitle.userData.text)&&/SUSTAIN 4/.test(armedTitle.userData.text),'the armed prompt carries pool size and the threshold');

const faceOf=die=>die.children.find(o=>o.isSprite&&o.scale.x>1).userData.text;
visuals.update(.5,{phase:'sonic_roll'});
assert.ok(dice.every(d=>/^[0-9]+$/.test(faceOf(d))),'the tumble shows moving faces');
assert.ok(dice.some((d,i)=>faceOf(d)!==String(input.diceVals[i])),'the tumble is not the settled result');
visuals.update(.5,{phase:'sonic_roll',reduced:true});
assert.deepEqual(dice.map(faceOf),['?','?','?','?','?'],'reduced motion holds a steady face instead of flickering');

visuals.update(1,{phase:'sonic_reveal'});
assert.deepEqual(dice.map(faceOf),['6','4','5','1','4'],'reveal shows every rolled face');
assert.deepEqual(dice.map(d=>d.userData.hit),[true,false,true,false,false],'verdicts follow the engine, not the face alone');
const verdicts=dice.map(d=>d.children.filter(o=>o.isSprite).map(o=>o.userData.text??'').find(t=>/HIT|HELD/.test(t)));
assert.deepEqual(verdicts,['6 > 4 · HIT','4 = 4 · HELD','5 > 4 · HIT','1 < 4 · HELD','4 = 4 · HELD'],
  'the comparison is spelled out, so a tie never depends on colour');
const rings=dice.map(d=>d.children.find(o=>o.isMesh&&o.geometry.type==='RingGeometry'));
assert.ok(rings.every(Boolean),'each die carries a non-colour verdict ring');
assert.ok(rings[0].material.color.getHexString()!==rings[1].material.color.getHexString(),'passed and held dice are separable at a glance');

// Determinism: the same absolute phase time renders the same frame.
const snapshot=()=>dice.map(d=>({p:d.position.toArray(),s:d.scale.toArray(),o:d.children.map(c=>c.material?.opacity??null)}));
visuals.update(1,{phase:'sonic_reveal'});const first=snapshot();
visuals.update(2.4,{phase:'sonic_reveal'});visuals.update(1,{phase:'sonic_reveal'});
assert.deepEqual(snapshot(),first,'replay/seeking is deterministic');

visuals.update(0,{phase:'result'});
assert.ok(dice.every(d=>!d.visible),'the dice clear once the volley resolves');
const headline=visuals.group.children.find(o=>o.isSprite&&/VIBE/.test(o.userData.text??''));
assert.ok(/2 THROUGH/.test(headline.userData.text)&&/1 VIBE/.test(headline.userData.text),'the result headline reports hits and Vibe');
assert.equal(JSON.stringify(input),before,'caller data is read-only');

const resources=new Map();
visuals.group.traverse(o=>{if(o.geometry)resources.set(o.geometry,0);if(o.material)resources.set(o.material,0);});
for(const r of resources.keys())r.addEventListener('dispose',()=>resources.set(r,resources.get(r)+1));
visuals.dispose();visuals.dispose();visuals.update(0);
assert.ok([...resources.values()].every(n=>n===1),'every geometry/material is disposed exactly once');
assert.equal(scene.children.length,0);

const badge=sonicSceneLabel('SUSTAIN −2 NEXT TURN','#aaddff',3.2,.4);
assert.equal(badge.sprite.userData.text,'SUSTAIN −2 NEXT TURN','the shared label helper still serves the pawn badge');
badge.write('SUSTAIN −1 NEXT TURN');
assert.equal(badge.sprite.userData.text,'SUSTAIN −1 NEXT TURN','labels rewrite in place');

const empty=createSonicDiceVisuals({...input,dicePool:[],diceVals:[],diceHits:[]});
empty.update(1,{phase:'sonic_reveal'});
assert.equal(empty.group.children.filter(o=>o.name.startsWith('Sonic die')).length,0,'an empty charge invents no dice');
empty.dispose();
console.log('PASS: readable faces, spelled-out verdicts, no pre-reveal leak, armed prompt, determinism and resource cleanup');
