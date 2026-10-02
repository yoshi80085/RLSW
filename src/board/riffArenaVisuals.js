import * as THREE from 'three';
import {createDuelWaveforms} from './riffWaveforms.js';
import {RIFF_ARENA} from '../riff/arenaDuel.js';

// Presentation staging only: logical hexes and game facings are never changed.
export function createRiffArenaVisuals(parent,{key,spirits,positions,origins}){
  const mid=positions[0].clone().add(positions[1]).multiplyScalar(.5),axis=positions[1].clone().sub(positions[0]).setY(0).normalize();
  if(axis.lengthSq()<.1)axis.set(1,0,0);
  const half=Math.max(4,positions[0].distanceTo(positions[1])*.5);
  const poses=[mid.clone().addScaledVector(axis,-half),mid.clone().addScaledVector(axis,half)];
  const front=new THREE.Vector3(-axis.z,0,axis.x),center=mid.clone().setY(1.85);
  const fx=createDuelWaveforms(parent,spirits.map(s=>s.color));fx.setOrigins(origins);fx.reset();
  const glimmer=new THREE.PointLight('#b7eaff',0,10);glimmer.position.copy(center);parent.add(glimmer);
  let shownTime=0,shake=0;
  return {key,ids:spirits.map(s=>s.id),poses,ball:fx.ball,
    update(b,camera,reduced,dt=1/60){
      shownTime=reduced?b.time:THREE.MathUtils.damp(shownTime,b.time,18,dt);
      const total=b.energy.reduce((a,n)=>a+n,0),shift=THREE.MathUtils.clamp((b.energy[0]-b.energy[1])/Math.max(4,total)*1.3,-1.3,1.3);
      const impact=b.impactAt==null?null:{side:b.attackerWon?0:1,tie:b.tie,born:b.impactAt};
      fx.update({...RIFF_ARENA,time:shownTime,energy:b.energy,scale:RIFF_ARENA.orb,shift,center,targets:poses,impact,reduced,maximumRadius:Math.min(3,half*.63),dt});
      glimmer.position.copy(fx.ball.position);glimmer.intensity=THREE.MathUtils.damp(glimmer.intensity,Math.min(8,total*.2),8,dt);
      shake=reduced||!total?0:Math.min(.12,Math.max(0,fx.ball.userData.radius-.35)*.05);
      const distance=Math.max(15,half*2.5/Math.max(.6,camera?.aspect??1.6));
      return {key:`riff:${key}`,pos:center.clone().addScaledVector(front,distance).add(new THREE.Vector3(0,5,0)),target:center.clone().add(new THREE.Vector3(0,1,0)),fov:44,focus:null};
    },
    pose(pawn,id){const i=spirits.findIndex(s=>s.id===id);if(i<0)return;
      pawn.position.copy(poses[i]);pawn.rotation.y=Math.atan2(front.x,front.z)+(i===0?.5:-.5);
      // Two slightly different rattles, anchored to the staged feet. This is
      // carrier motion only; logical hexes, facings and the camera stay still.
      const t=shownTime/1000,p=i*2.17;
      pawn.position.addScaledVector(axis,shake*(Math.sin(t*29+p)*.7+Math.sin(t*43+p)*.3));
      pawn.position.addScaledVector(front,shake*.35*Math.sin(t*37+p));
      pawn.rotation.z+=shake*.32*Math.sin(t*33+p);},
    dispose(){fx.dispose();glimmer.removeFromParent();glimmer.dispose();},
  };
}
