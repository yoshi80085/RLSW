import * as THREE from 'three';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const atlases=new Map(),Z=new THREE.Vector3(0,0,1),Y=new THREE.Vector3(0,1,0);
export const COMBAT_DICE_SIDES=Object.freeze([4,6,8,10,12,20]);
// 📏 Each solid's radius (a d6 is a .94 cube). 🎲 The d8 and d12 grew (Alex,
// 2026-10-09: "the d8 and d12 maybe can be a bit bigger") — .72 → .84 and
// .68 → .80, my numbers, on the Special Dice Bench's two size levers. A pointed
// solid reads smaller than a cube of the same radius, so next to d6s they looked
// like the cheaper dice when they are the better ones. `radii` overrides per die.
export const COMBAT_DIE_RADIUS=Object.freeze({4:.69,8:.84,10:.74,12:.80,20:.72});
// 🃏 A marquee card's bonus die (Alex's dial-in, 2026-10-09: finish "rim"): YOUR
// colour in the body, GOLD on its edges and its numbers, and a harder polish —
// so it reads as yours and as something the card gave you, never as one more die.
export const CARD_DIE_GOLD='#ffcf5a';

// Merge coplanar triangles into physical faces, including pentagons and kites.
function facesOf(geometry){
 const g=geometry.index?geometry.toNonIndexed():geometry.clone(),a=g.attributes.position,faces=new Map();
 for(let i=0;i<a.count;i+=3){
  const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(a,i+k));
  const normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();
  const key=[normal.x,normal.y,normal.z,normal.dot(v[0])].map(n=>Math.round(n*1e5)).join(',');
  if(!faces.has(key))faces.set(key,{normal,vertices:new Map()});
  for(const p of v)faces.get(key).vertices.set(p.toArray().map(n=>Math.round(n*1e5)).join(','),p);
 }
 g.dispose();
 return [...faces.values()].map(f=>{
  const vertices=[...f.vertices.values()],center=vertices.reduce((c,p)=>c.add(p),new THREE.Vector3()).divideScalar(vertices.length);
  const up=Math.abs(f.normal.dot(Y))>.95?Z.clone():Y.clone();up.addScaledVector(f.normal,-up.dot(f.normal)).normalize();
  const right=up.clone().cross(f.normal).normalize();
  vertices.sort((a,b)=>Math.atan2(a.clone().sub(center).dot(up),a.clone().sub(center).dot(right))-Math.atan2(b.clone().sub(center).dot(up),b.clone().sub(center).dot(right)));
  let radius=Infinity;
  vertices.forEach((p,i)=>{const edge=vertices[(i+1)%vertices.length].clone().sub(p);radius=Math.min(radius,p.clone().sub(center).cross(edge).length()/edge.length());});
  return {normal:f.normal,center,up,right,radius};
 });
}
function shape(sides,radii=COMBAT_DIE_RADIUS){
 const r=n=>radii?.[n]??COMBAT_DIE_RADIUS[n];
 if(sides===4)return new THREE.TetrahedronGeometry(r(4));
 // 🔊 11 is the ELEVEN DIE (gameConstants ELEVEN_DIE): a d6 body, five faces read 11, one reads 1.
 if(sides===6||sides===11)return new THREE.BoxGeometry(.94,.94,.94);
 if(sides===8)return new THREE.OctahedronGeometry(r(8));
 if(sides===12)return new THREE.DodecahedronGeometry(r(12));
 if(sides===20)return new THREE.IcosahedronGeometry(r(20));
 // The dual of a pentagonal antiprism is a ten-kite trapezohedron.
 const points=[];for(let i=0;i<5;i++)for(const sign of [-1,1]){
  const a=(i+(sign>0?.5:0))*Math.PI*2/5;points.push(new THREE.Vector3(Math.cos(a),Math.sin(a),sign*.6));
 }
 const antiprism=new ConvexGeometry(points),dual=facesOf(antiprism).map(f=>f.normal.clone().divideScalar(f.normal.dot(f.center)));
 antiprism.dispose();const g=new ConvexGeometry(dual);g.computeBoundingSphere();const k=r(10)/g.boundingSphere.radius;g.scale(k,k,k);return g;
}
function acquireAtlas(sides){
 if(atlases.has(sides)){const a=atlases.get(sides);a.refs++;return a;}
 const faces=sides===11?ELEVEN_BODY:sides,label=i=>sides===11?(i===0?'1':'11'):String(i+1);
 const columns=Math.ceil(Math.sqrt(faces)),rows=Math.ceil(faces/columns),tile=192;
 const canvas=globalThis.document?.createElement?.('canvas');let ctx;
 try{if(canvas){canvas.width=columns*tile;canvas.height=rows*tile;ctx=canvas.getContext('2d');}}catch{/* geometry tests run without a canvas */}
 let texture=null;
 if(ctx){
  ctx.textAlign='center';ctx.textBaseline='middle';
  for(let i=0;i<faces;i++){
   const x=(i%columns+.5)*tile,y=(Math.floor(i/columns)+.5)*tile,text=label(i);
   ctx.font=`bold ${text.length>1?119:145}px Arial`;ctx.fillStyle='#ffffff';ctx.shadowColor='#ffffff';ctx.shadowBlur=13;ctx.fillText(text,x,y);ctx.shadowBlur=0;ctx.fillText(text,x,y);
   if(sides!==11&&(i===5||i===8)){ctx.fillRect(x-23,y+64,46,5);}
  }
  texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 }
 const atlas={texture,columns,rows,refs:1};atlases.set(sides,atlas);return atlas;
}

// Instanced edge tubes give a neon rim without a full-screen bloom pass.
function neonEdges(source,color){
 const wire=new THREE.EdgesGeometry(source),points=wire.attributes.position,count=points.count/2;
 const geometry=new THREE.CylinderGeometry(1,1,1,6),group=new THREE.Group();
 const core=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color,toneMapped:false}),count);
 const halo=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.13,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),count);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),direction=new THREE.Vector3(),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
 for(let i=0;i<count;i++){
  a.fromBufferAttribute(points,i*2);b.fromBufferAttribute(points,i*2+1);direction.subVectors(b,a);rotation.setFromUnitVectors(Y,direction.clone().normalize());a.add(b).multiplyScalar(.5);
  core.setMatrixAt(i,matrix.compose(a,rotation,scale.set(.008,direction.length(),.008)));
  halo.setMatrixAt(i,matrix.compose(a,rotation,scale.set(.032,direction.length(),.032)));
 }
 wire.dispose();group.add(core,halo);
 return {group,dispose(){geometry.dispose();core.material.dispose();halo.material.dispose();core.dispose();halo.dispose();}};
}

// 🔊 The Eleven die is a d6 body whose face 0 reads 1 and faces 1–5 read 11.
// ⚠️ It is NOT in COMBAT_DICE_SIDES (value 1..sides would be wrong for it) — it
// is its own legal case below. It was missing from the check entirely on
// 2026-09-27, so a Goes to 11 throw in the arena threw 'Invalid combat die.'
const ELEVEN_BODY=6;
const isEleven=(sides,value)=>sides===11&&(value===1||value===11);
export function createCombatDie({sides=6,value=1,color='#4ccbdd',seed=0,presentation='face',finish=null,radii=COMBAT_DIE_RADIUS}={}){
 if(!isEleven(sides,value)&&(!COMBAT_DICE_SIDES.includes(sides)||!Number.isInteger(value)||value<1||value>sides))throw Error('Invalid combat die.');
 const source=shape(sides,radii),faces=facesOf(source),remaining=[...faces],numbered=[];
 // Opposite faces add to sides+1 where the solid has opposite faces.
 while(remaining.length){const f=remaining.shift();numbered.push(f);if(sides!==4&&remaining.length){let idx=0;for(let i=1;i<remaining.length;i++)if(remaining[i].normal.dot(f.normal)<remaining[idx].normal.dot(f.normal))idx=i;numbered.splice(numbered.length-1,0,remaining.splice(idx,1)[0]);}}
 const ordered=[];for(let i=0;i<numbered.length;i+=2){ordered[i/2]=numbered[i];if(numbered[i+1])ordered[faces.length-1-i/2]=numbered[i+1];}
 const faceList=sides===4?faces:ordered;
 const group=new THREE.Group();group.name=`Combat d${sides}`;group.userData={sides,value,faceCount:faces.length};
 const bodyGeometry=sides===6||sides===11?new RoundedBoxGeometry(.94,.94,.94,2,.065):source;
 const tint=new THREE.Color(color);
 const card=finish==='card';
 const body=new THREE.Mesh(bodyGeometry,new THREE.MeshStandardMaterial({color:tint.clone().multiplyScalar(.075),emissive:tint,emissiveIntensity:.035,roughness:card?.22:.24,metalness:card?.9:.55,flatShading:true}));group.add(body);
 const edges=neonEdges(source,card?CARD_DIE_GOLD:color);group.add(edges.group);
 const atlas=acquireAtlas(sides),positions=[],uvs=[];
 faceList.forEach((f,i)=>{
  const scale=f.radius*1.8,center=f.center.clone().addScaledVector(f.normal,.008);
  for(const [x,y] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,-.5],[.5,.5],[-.5,.5]]){
   const p=center.clone().addScaledVector(f.right,x*scale).addScaledVector(f.up,y*scale);positions.push(...p.toArray());
   uvs.push((i%atlas.columns+x+.5)/atlas.columns,1-(Math.floor(i/atlas.columns)+.5-y)/atlas.rows);
  }
 });
 const printed=new THREE.BufferGeometry();printed.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));printed.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 const ink=new THREE.Mesh(printed,new THREE.MeshBasicMaterial({map:atlas.texture,transparent:true,depthWrite:false,color:card?new THREE.Color(CARD_DIE_GOLD):tint.clone().lerp(new THREE.Color('#ffffff'),.68),toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1}));ink.name='Printed face numbers';ink.userData.solidDecal=true;group.add(ink);
 // The Eleven die's 11 is the face opposite its 1 (the last face).
 const winnerIndex=sides===11?(value===1?0:faceList.length-1):value-1;
 const winner=faceList[winnerIndex],orientation=new THREE.Quaternion().setFromUnitVectors(winner.normal,Z);
 const up=winner.up.clone().applyQuaternion(orientation);orientation.premultiply(new THREE.Quaternion().setFromAxisAngle(Z,Math.atan2(up.x,up.y)));
 // A slight tilt reveals the body while keeping the selected numeral dominant.
 const tilt=new THREE.Quaternion().setFromEuler(presentation==='floor'?new THREE.Euler(-Math.PI/2,0,0):new THREE.Euler(.16,-.2,0));orientation.premultiply(tilt);
 // A tetrahedron rests on a face; its result is on a sloped face facing the reader.
 if(presentation==='floor'&&sides===4){
  const bottom=faceList.find(f=>f!==winner);
  orientation.setFromUnitVectors(bottom.normal,new THREE.Vector3(0,-1,0));
  const facing=winner.normal.clone().applyQuaternion(orientation);
  orientation.premultiply(new THREE.Quaternion().setFromAxisAngle(Y,-Math.atan2(facing.x,facing.z)));
 }
 const spin=new THREE.Quaternion();let disposed=false;
 function update(progress=1,{reduced=false}={}){
  const p=THREE.MathUtils.clamp(progress,0,1),remaining=(1-p)**3;
  spin.setFromEuler(new THREE.Euler(remaining*(12+seed*.13),remaining*(17+seed*.17),remaining*(9+seed*.07)));
  group.quaternion.copy(orientation);if(!reduced)group.quaternion.premultiply(spin);
  group.userData.settled=p===1;group.userData.result=p===1?value:null;
 }
 function dispose(){if(disposed)return;disposed=true;group.removeFromParent();bodyGeometry.dispose();if(bodyGeometry!==source)source.dispose();edges.dispose();printed.dispose();body.material.dispose();ink.material.dispose();if(--atlas.refs===0){atlas.texture?.dispose();atlases.delete(sides);}}
 // The lowest rotated body vertex keeps any die size resting on the arena.
 const vertex=new THREE.Vector3();
 function supportHeight(){let bottom=Infinity;const p=bodyGeometry.attributes.position;for(let i=0;i<p.count;i++){vertex.fromBufferAttribute(p,i).applyQuaternion(group.quaternion);bottom=Math.min(bottom,vertex.y);}return -bottom*group.scale.y;}
 update(1);return {group,update,dispose,supportHeight,faces:faceList.map((f,i)=>({value:sides===11?(i===0?1:11):i+1,normal:f.normal.clone()}))};
}
