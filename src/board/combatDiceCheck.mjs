import assert from 'node:assert/strict';
import {createCombatDie,COMBAT_DICE_SIDES} from './combatDice.js';
import {createCombatDiceDisplay} from './combatDiceDisplay.js';

for(const sides of COMBAT_DICE_SIDES)for(let value=1;value<=sides;value++){
 const die=createCombatDie({sides,value,seed:value});
 assert.equal(die.group.userData.faceCount,sides,`d${sides} has ${sides} physical faces`);
 die.update(.3);assert.equal(die.group.userData.result,null);
 const rolling=die.group.quaternion.clone();die.update(1);
 assert.equal(die.group.userData.result,value);
 assert.ok(die.faces[value-1].normal.clone().applyQuaternion(die.group.quaternion).z>.96,'settled value faces the reader');
 const settled=die.group.quaternion.clone();die.update(.3);assert.ok(die.group.quaternion.equals(rolling),'scrubbing is deterministic');die.update(1);assert.ok(die.group.quaternion.equals(settled));
 if(sides!==4)for(let i=0;i<sides;i++)assert.ok(die.faces[i].normal.dot(die.faces[sides-1-i].normal)<-.99,'opposite values add to sides+1');
 die.update(.3,{reduced:true});assert.ok(die.group.quaternion.equals(settled),'reduced motion avoids tumbling');
 let geometryDisposed=0;die.group.children[0].geometry.addEventListener('dispose',()=>geometryDisposed++);
 die.dispose();die.dispose();assert.equal(geometryDisposed,1,'dispose is idempotent');
}
assert.throws(()=>createCombatDie({sides:7}));assert.throws(()=>createCombatDie({sides:6,value:7}));
// 🔊 The Eleven die (sides 11): a d6 body, its 1 opposite an 11, and ONLY 1 or 11 are legal results.
for(const value of [1,11]){
 const die=createCombatDie({sides:11,value,seed:3});
 assert.equal(die.group.userData.faceCount,6,'the Eleven die is a d6 body');
 assert.equal(die.faces.filter(f=>f.value===11).length,5,'five faces read 11');assert.equal(die.faces.filter(f=>f.value===1).length,1,'one face reads 1');
 die.update(1);assert.equal(die.group.userData.result,value);
 const shown=die.faces.filter(f=>f.normal.clone().applyQuaternion(die.group.quaternion).z>.96);
 assert.ok(shown.length===1&&shown[0].value===value,`the Eleven die settles showing ${value}`);
 assert.ok(die.faces[0].normal.dot(die.faces[5].normal)<-.99,'the 1 sits opposite an 11');
 die.dispose();
}
for(const value of [2,6,12])assert.throws(()=>createCombatDie({sides:11,value}),`the Eleven die cannot show ${value}`);
const tray=createCombatDiceDisplay({drive:Array(11).fill(12),sustain:Array(11).fill(8),driveSides:12,sustainSides:8});
const renderer={autoClear:true,clearDepth(){},render(scene,camera){
 scene.updateMatrixWorld();camera.updateMatrixWorld();
 for(const d of tray.dice){const p=d.group.getWorldPosition(d.group.position.clone()).project(camera);assert.ok(Math.abs(p.x)<.94&&Math.abs(p.y)<.94,'all 22 dice fit both layouts');}
}};
tray.render(renderer,{width:400,height:460,progress:1});tray.render(renderer,{width:1000,height:460,progress:1});assert.equal(renderer.autoClear,true);tray.dispose();
console.log('PASS: physical d4/d6/d8/d10/d12/d20 faces, the Eleven die (d6 body, 11/1), every settled result, opposite numbering, deterministic roll, reduced motion, cleanup and 22-die layouts.');
