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
const tray=createCombatDiceDisplay({drive:Array(11).fill(12),sustain:Array(11).fill(8),driveSides:12,sustainSides:8});
const renderer={autoClear:true,clearDepth(){},render(scene,camera){
 scene.updateMatrixWorld();camera.updateMatrixWorld();
 for(const d of tray.dice){const p=d.group.getWorldPosition(d.group.position.clone()).project(camera);assert.ok(Math.abs(p.x)<.94&&Math.abs(p.y)<.94,'all 22 dice fit both layouts');}
}};
tray.render(renderer,{width:400,height:460,progress:1});tray.render(renderer,{width:1000,height:460,progress:1});assert.equal(renderer.autoClear,true);tray.dispose();
console.log('PASS: physical d4/d6/d8/d10/d12/d20 faces, every settled result, opposite numbering, deterministic roll, reduced motion, cleanup and 22-die layouts.');
