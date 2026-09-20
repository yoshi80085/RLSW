import * as THREE from 'three';

const CORNERS={blue:[-1,-1],purple:[-1,1],yellow:[1,-1],red:[1,1]};
// Matches the authored seats in scripts/cosmic-arena/build_scene.py.
// Blender's (x,y,z) becomes glTF (x,z,-y); the live arena then flips Z.
export function grandstandSeats(corner) {
  const signs=CORNERS[corner];if(!signs)return [];
  const origin=new THREE.Vector2(signs[0]*10.5,signs[1]*6.25),normal=origin.clone().normalize().negate();
  const tangent=new THREE.Vector2(-normal.y,normal.x),seats=[];
  for(let row=0;row<4;row++)for(let i=0;i<7-row;i++){
    const q=origin.clone().addScaledVector(normal,-row*.4).addScaledVector(tangent,(i-(6-row)/2)*.25);
    seats.push({position:new THREE.Vector3(q.x,.08+row*.23+.23,q.y),facing:Math.atan2(normal.x,normal.y),row});
  }
  return seats;
}

export function createArenaCrowd(scene) {
  const group=new THREE.Group();group.name='Seated 3D fans';scene.add(group);
  const mat=new THREE.MeshStandardMaterial({roughness:.8});
  const heads=new THREE.InstancedMesh(new THREE.SphereGeometry(1,7,5),mat,88);
  const bodies=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,88);
  const limbs=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,352);
  group.add(heads,bodies,limbs);for(const mesh of group.children){mesh.count=0;mesh.frustumCulled=false;}
  const dummy=new THREE.Object3D(),rotation=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
  let fans=[],key='';
  function update(crowds=[]) {
    const next=JSON.stringify(crowds);if(next===key)return;key=next;fans=[];
    for(const crowd of crowds){
      const seats=grandstandSeats(crowd.corner),count=Math.min(seats.length,Math.max(0,(crowd.diehards??0)+(crowd.casuals??0)));
      for(let i=0;i<count;i++)fans.push({...seats[i],color:crowd.color??'#b29aff',diehard:i<(crowd.diehards??0),index:i});
    }
    heads.count=bodies.count=fans.length;limbs.count=fans.length*4;
    fans.forEach((f,i)=>{heads.setColorAt(i,new THREE.Color(f.diehard?'#ffe6a3':'#d9bc9f'));bodies.setColorAt(i,new THREE.Color(f.color));
      for(let j=0;j<4;j++)limbs.setColorAt(i,new THREE.Color(j<2?f.color:'#343b59'));});
    for(const mesh of group.children)if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  }
  function tick(time,{reduced=false}={}){
    const put=(mesh,index,f,offset,scale,tilt=0)=>{
      rotation.setFromAxisAngle(up,f.facing);dummy.position.set(...offset).applyQuaternion(rotation).add(f.position);
      dummy.rotation.set(0,f.facing,tilt);dummy.scale.set(...scale);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
    };
    fans.forEach((f,i)=>{
      const bob=reduced?0:Math.sin(time*(f.diehard?5:2.4)+i)*.009;
      put(heads,i,f,[0,.255+bob,0],[.057,.061,.057]);put(bodies,i,f,[0,.135,0],[.11,.15,.075]);
      for(let side=0;side<2;side++){
        const x=side?1:-1;
        put(limbs,i*4+side,f,[x*.078,.15+bob,.01],[.032,.13,.032],x*(f.diehard?.65:.18));
        put(limbs,i*4+side+2,f,[x*.033,.015,.055],[.036,.11,.045]);
      }
    });
    for(const mesh of group.children)mesh.instanceMatrix.needsUpdate=true;
  }
  return {group,update,tick,get count(){return fans.length;},dispose(){group.removeFromParent();for(const mesh of group.children)mesh.geometry.dispose();mat.dispose();}};
}
