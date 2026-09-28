import * as THREE from 'three';
import { rng } from './formation.js';
import { applyRockLook } from './rockLook.js';

export function createDriftingDebris(){
  const group=new THREE.Group();group.name='Drifting rocks';
  // Restore the earlier simple faceted chunks and their elongated proportions.
  const material=applyRockLook(new THREE.MeshStandardMaterial({color:0x263a60,roughness:.9,metalness:.18,flatShading:true}));
  const mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),material,65);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,-15,0),62);group.add(mesh);
  const random=rng(6921),rocks=[];
  for(let i=0;i<65;i++){
    const transform=new THREE.Object3D(),angle=random()*Math.PI*2,radius=19+random()*24,k=.25+random()*.9;
    transform.scale.set(k,k*(1.6+random()*1.7),k*.8);
    const rotation=new THREE.Vector3(random()*6,random()*6,random()*6);
    rocks.push({transform,angle,radius,y:-5-random()*21,phase:random()*Math.PI*2,rotation,
      orbit:(random()<.5?-1:1)*(.004+random()*.006),
      spin:new THREE.Vector3((random()-.5)*.035,(random()-.5)*.05,(random()-.5)*.03)});
  }
  let time=0;
  return {group,update(dt,{amount=1,speed=1,reduced=false,brightness=.6,color='#263a60'}={}){
    if(!reduced)time+=dt*speed;
    mesh.count=Math.min(65,Math.max(0,Math.floor(43*amount)));group.visible=mesh.count>0;
    material.color.set(color).multiplyScalar(brightness);
    rocks.forEach((r,i)=>{
      const a=r.angle+time*r.orbit,radius=r.radius+Math.sin(time*.045+r.phase)*1.15;
      r.transform.position.set(Math.cos(a)*radius,r.y+Math.sin(time*.075+r.phase)*1.1,Math.sin(a)*radius);
      r.transform.rotation.set(r.rotation.x+time*r.spin.x,r.rotation.y+time*r.spin.y,r.rotation.z+time*r.spin.z);
      r.transform.updateMatrix();mesh.setMatrixAt(i,r.transform.matrix);
    });mesh.instanceMatrix.needsUpdate=true;
  }};
}
