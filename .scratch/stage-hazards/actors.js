import * as THREE from 'three';
import { createStandee, STANDEE, STANDEE_Y } from '../../src/board/standee.js';
import ronin from '../../src/standees/Cosmic_Ronin.png';
import monster from '../../src/standees/Metalness_monster.png';
import glam from '../../src/standees/Glamarchy.png';
import { xyz, shoveAt, reactionAt } from './motion.js';
const characters=[{id:'cosmic_ronin',imageSrc:ronin,color:'#54a9fa'},{id:'Metalness_Monster',imageSrc:monster,color:'#ffa35e'},{id:'Glamarchy',imageSrc:glam,color:'#af8cff'}];
export function createHazardActors(scene){
 const root=new THREE.Group();root.name='Shared standee hazard study';scene.add(root);
 const actors=characters.map(s=>{const actor=createStandee(s);actor.group.rotation.order='YXZ';root.add(actor.group);return actor;});
 const mat=new THREE.MeshBasicMaterial({color:'#ffa14f',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide});
 const ring=new THREE.Mesh(new THREE.RingGeometry(.68,.82,40),mat);ring.rotation.x=-Math.PI/2;root.add(ring);
 const flare=new THREE.PointLight('#ffa14f',0,8,2);root.add(flare);
 const sparks=new THREE.BufferGeometry(),points=new Float32Array(32*3);sparks.setAttribute('position',new THREE.BufferAttribute(points,3));
 const sm=new THREE.PointsMaterial({color:'#ffc170',size:.075,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
 const scatter=new THREE.Points(sparks,sm);scatter.frustumCulled=false;root.add(scatter);
 return {root,update(time,positions,camera,{sequence=null,kind='pyro',knockdown=false,strength=1,reduced=false}={}){
  let reaction=null;ring.visible=scatter.visible=false;flare.intensity=0;
  actors.forEach((actor,i)=>{
   const g=actor.group,p=xyz(positions[i]);g.position.set(p.x,STANDEE_Y,p.z);g.rotation.set(0,.35,0);g.scale.set(1,1,1);
   let lift=0,ko=0;
   if(i===0&&sequence){
    const pose=shoveAt(sequence,time,reduced);g.position.set(pose.x,STANDEE_Y+pose.y,pose.z);g.rotation.set(pose.pitch,pose.yaw,pose.roll);g.scale.set(pose.sxz,pose.sy,pose.sxz);lift=pose.y;
    const elapsed=time-sequence.arrival;
    if(elapsed>=0&&sequence.hit!=null){
     reaction=reactionAt(kind,elapsed,{strength,knockdown,reduced});const at=xyz(sequence.path.at(-1)),from=xyz(sequence.from),dx=at.x-from.x,dz=at.z-from.z,len=Math.hypot(dx,dz);
     g.position.set(at.x+dx/len*reaction.recoil,STANDEE_Y+reaction.y,at.z+dz/len*reaction.recoil);g.rotation.set(reaction.pitch,sequence.step.yaw0,reaction.roll);g.scale.set(reaction.sxz,reaction.sy,reaction.sxz);lift=reaction.y;ko=reaction.ko;
     const color=kind==='pyro'?'#ff9d3a':'#96e8ff';ring.material.color.set(color);sm.color.set(color);flare.color.set(color);
     ring.visible=elapsed<.8;ring.position.set(at.x,.23,at.z);ring.scale.setScalar(reduced?1:.8+reaction.ring*1.7);ring.material.opacity=.7*Math.max(0,1-elapsed/.8);
     flare.position.set(at.x,1.5+lift,at.z);flare.intensity=reaction.flash*12;
     scatter.visible=!reduced&&elapsed<.55;sm.opacity=Math.max(0,1-elapsed/.55);
     for(let j=0;j<32;j++){const angle=j*2.39996,speed=.9+(j%5)*.3;points[j*3]=at.x+Math.cos(angle)*elapsed*speed;points[j*3+1]=1.2+elapsed*(1+(j%4))-.5*elapsed*elapsed*5;points[j*3+2]=at.z+Math.sin(angle)*elapsed*speed;}sparks.attributes.position.needsUpdate=true;
    }
   }
   actor.frame(time,{acting:i===0,reduced,cameraPos:camera.position,lift:lift/Math.max(.05,g.scale.y),knockedOut:ko>=1});
   // Transition into the exact shipped knockdown pose, instead of snapping.
   if(ko>0&&ko<1)for(const part of actor.parts.slice(1,4)){part.rotation.x-=THREE.MathUtils.degToRad(STANDEE.koTilt)*ko;part.position.y+=(.05+STANDEE.sink)*ko;}
  });return reaction;
 },dispose(){scene.remove(root);actors.forEach(a=>a.dispose());ring.geometry.dispose();mat.dispose();sparks.dispose();sm.dispose();}};
}
