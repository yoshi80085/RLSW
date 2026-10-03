import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ALL_HEXES } from '../../src/board/hexMap.js';
import { createStandee, STANDEE } from '../../src/board/standee.js';
import { SPIRIT_DEFS } from '../../src/data/spirits.js';
import { world, affected, plan, sector, ease } from './model.js';

const GOLD=0xe8b873,TEAL=0x67c8ca;
const v=(p)=>new THREE.Vector3(p.x,p.y,p.z);
function hex(radius){const s=new THREE.Shape();for(let i=0;i<6;i++){const a=i*Math.PI/3;s[i?'lineTo':'moveTo'](Math.cos(a)*radius,Math.sin(a)*radius);}s.closePath();return s;}
function release(root){const gs=new Set(),ms=new Set(),ts=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of [o.material].flat().filter(Boolean)){ms.add(m);for(const value of Object.values(m))if(value?.isTexture)ts.add(value);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());}
function circle(radius,y,color,width=.025){const m=new THREE.Mesh(new THREE.TorusGeometry(radius,width,6,96),new THREE.MeshBasicMaterial({color,toneMapped:false}));m.rotation.x=Math.PI/2;m.position.y=y;return m;}
function lineHex(radius,y,color){return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:6},(_,i)=>new THREE.Vector3(Math.cos(i*Math.PI/3)*radius,y,Math.sin(i*Math.PI/3)*radius))),new THREE.LineBasicMaterial({color,transparent:true,opacity:.65}));}
function amp(color){const root=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(.8,1.05,.55),new THREE.MeshStandardMaterial({color:0x1f2a30,metalness:.35,roughness:.5}));body.position.y=.55;root.add(body);const face=new THREE.Mesh(new THREE.PlaneGeometry(.69,.84),new THREE.MeshStandardMaterial({color:0x09121a,metalness:.3,roughness:.8}));face.position.set(0,.55,.282);root.add(face);for(const y of [.34,.74]){const speaker=new THREE.Mesh(new THREE.TorusGeometry(.15,.025,8,24),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.3}));speaker.position.set(0,y,.3);root.add(speaker);const cone=new THREE.Mesh(new THREE.CircleGeometry(.135,24),new THREE.MeshStandardMaterial({color:0x263a42,roughness:.8}));cone.position.set(0,y,.294);root.add(cone);}const handle=new THREE.Mesh(new THREE.BoxGeometry(.34,.06,.1),new THREE.MeshStandardMaterial({color:0x758792}));handle.position.y=1.12;root.add(handle);return {group:root,frame(){},dispose(){release(root);}};}

export function createStage(host,initialActors,L){
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;host.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#08111b');scene.fog=new THREE.FogExp2('#08111b',.009);
 const camera=new THREE.PerspectiveCamera(38,1,.1,170),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=7;controls.maxDistance=58;controls.maxPolarAngle=Math.PI*.485;
 scene.add(new THREE.HemisphereLight(0xb5d6ed,0x303323,2));
 for(const [color,intensity,pos] of [[0xdceef3,2.8,[4,15,8]],[0xe8b976,2.4,[-8,5,-6]],[0x57c7d0,1.7,[12,0,-6]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);scene.add(light);}
 const under=new THREE.PointLight(GOLD,45,20,2);under.position.set(0,-1.7,0);scene.add(under);
 const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),L.bloom,.5,.95);composer.addPass(bloom);const output=new OutputPass();composer.addPass(output);
 const staticDeck=new THREE.Group(),rotor=new THREE.Group(),mechanism=new THREE.Group(),routes=new THREE.Group(),labels=new THREE.Group();scene.add(staticDeck,rotor,mechanism,routes,labels);
 const staticMat=new THREE.MeshStandardMaterial({color:0x1c303e,roughness:.7,metalness:.48}),movingMat=new THREE.MeshStandardMaterial({color:0x413d33,roughness:.52,metalness:.68});
 const steel=new THREE.MeshStandardMaterial({color:0x293b45,roughness:.4,metalness:.85}),brass=new THREE.MeshStandardMaterial({color:0x9a7945,roughness:.36,metalness:.76});
 const tileGeo=new THREE.ExtrudeGeometry(hex(1.105),{depth:.38,bevelEnabled:true,bevelSegments:1,bevelSize:.025,bevelThickness:.025}).rotateX(-Math.PI/2);
 const tiles=[];
 for(const h of ALL_HEXES){const root=new THREE.Group(),p=world(h.num,0);root.position.copy(v(p));staticDeck.add(root);const body=new THREE.Mesh(tileGeo,staticMat);body.position.y=-.205;root.add(body);const border=lineHex(1.105,.21,0x466679);root.add(border);const inset=lineHex(.94,.217,0x334e5e);root.add(inset);tiles.push({num:h.num,root,body,border,inset});}
 // Labels are board addresses, not stickers travelling with the machinery.
 // Hide them during a lift; reappear on the fixed lattice once the deck locks.
 const atlas=document.createElement('canvas');atlas.width=atlas.height=1024;const ac=atlas.getContext('2d');ac.textAlign='center';ac.textBaseline='middle';ac.font='500 32px monospace';ac.fillStyle='#c5d9df';ALL_HEXES.forEach((h,i)=>ac.fillText(h.num,(i%12)*80+40,Math.floor(i/12)*80+40));const labelTex=new THREE.CanvasTexture(atlas);labelTex.colorSpace=THREE.SRGBColorSpace;const labelMat=new THREE.MeshBasicMaterial({map:labelTex,transparent:true,depthWrite:false,opacity:.75});
 for(let i=0;i<ALL_HEXES.length;i++){const geo=new THREE.PlaneGeometry(.65,.65).rotateX(-Math.PI/2),uv=geo.attributes.uv;for(let j=0;j<uv.count;j++)uv.setXY(j,((i%12)*80+uv.getX(j)*80)/1024,1-(Math.floor(i/12)*80+(1-uv.getY(j))*80)/1024);const m=new THREE.Mesh(geo,labelMat);m.position.copy(v(world(ALL_HEXES[i].num,.24)));labels.add(m);}
 // A fixed central bearing surrounds Limelight. It is never part of the rotor.
 staticDeck.add(circle(1.04,.23,TEAL,.035));staticDeck.add(circle(.77,.235,TEAL,.016));
 const core=new THREE.Mesh(new THREE.CylinderGeometry(.85,.85,1.35,24),steel);core.position.y=-.52;staticDeck.add(core);
 const gridBase=new THREE.Mesh(new THREE.CylinderGeometry(13,12.4,.6,64),new THREE.MeshStandardMaterial({color:0x0e202b,metalness:.62,roughness:.53}));gridBase.position.y=-1.65;scene.add(gridBase);
 scene.add(circle(12.75,-1.29,TEAL,.035));
 const stars=[];for(let i=0;i<600;i++){const a=i*2.39996,r=28+(i%71)*.55;stars.push(Math.cos(a)*r,Math.sin(i*11.7)*26,Math.sin(a)*r);}const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0x83adc1,size:.045,transparent:true,opacity:.6})));
 const actors=new Map();for(const a of initialActors){const st=a.amp?amp(a.color):createStandee({...SPIRIT_DEFS[a.art],color:a.color},{T:{...STANDEE,height:2.6,bob:0}});scene.add(st.group);actors.set(a.id,st);}
 let selectionKey=null,settings=L,disposed=false;
 const gearRoot=new THREE.Group(),carrier=new THREE.Group(),drive=new THREE.Group(),warningArrows=new THREE.Group(),locks=[];mechanism.add(gearRoot,drive,warningArrows);rotor.add(carrier);
 function buildLegacyMechanism(selected){
  release(gearRoot);gearRoot.clear();release(carrier);carrier.clear();release(warningArrows);warningArrows.clear();locks.length=0;
  const matSteel=()=>steel.clone(),matBrass=()=>brass.clone();
  // Independent cloned materials: rebuilding a footprint never disposes tile
  // materials or the fixed bearing still used elsewhere in this scene.
  for(const r of selected){
  const outer=r*1.95+1.07,inner=(r-1)*1.95+1.12;
  const bearing=new THREE.Mesh(new THREE.CylinderGeometry(outer,outer,.45,96,1,true),matSteel());bearing.position.y=-.6;gearRoot.add(bearing);
  gearRoot.add(circle(outer+.06,-.35,GOLD,.035));gearRoot.add(circle(outer,-.88,TEAL,.018));
  // Each selected ring gets its OWN annular carrier. A single solid plate
  // would rise through (and visually cover) a deliberately stationary middle ring.
  const plate=new THREE.Mesh(new THREE.RingGeometry(inner,outer-.08,96).rotateX(-Math.PI/2),matSteel());plate.position.y=-.34;carrier.add(plate);
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(outer-.23,.12,8,96),matBrass());wheel.rotation.x=Math.PI/2;wheel.position.y=-.47;carrier.add(wheel);
  for(let i=0;i<60;i++){const a=i*Math.PI/30,tooth=new THREE.Mesh(new THREE.BoxGeometry(.19,.2,.24),matBrass());tooth.position.set(Math.cos(a)*(outer-.12),-.49,Math.sin(a)*(outer-.12));tooth.rotation.y=-a;carrier.add(tooth);}
  for(let i=0;i<12;i++){const a=i*Math.PI/6,spoke=new THREE.Mesh(new THREE.BoxGeometry(outer-inner-.15,.13,.14),matBrass());spoke.position.set(Math.cos(a)*(outer+inner)/2,-.57,Math.sin(a)*(outer+inner)/2);spoke.rotation.y=-a;carrier.add(spoke);}
  for(let i=0;i<6;i++){const a=i*Math.PI/3,lock=new THREE.Group();lock.position.set(Math.cos(a)*(outer+.1),-.3,Math.sin(a)*(outer+.1));lock.rotation.y=-a;const block=new THREE.Mesh(new THREE.BoxGeometry(.45,.3,.4),matSteel());lock.add(block);const led=new THREE.Mesh(new THREE.BoxGeometry(.23,.035,.23),new THREE.MeshBasicMaterial({color:GOLD}));led.position.y=.17;lock.add(led);gearRoot.add(lock);locks.push({lock,a,x:lock.position.x,z:lock.position.z,led});
   const arrow=new THREE.Mesh(new THREE.ConeGeometry(.18,.5,3),new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:.85,depthWrite:false}));arrow.rotation.x=Math.PI/2;arrow.rotation.z=a;arrow.position.set(Math.cos(a)*(outer+.48),.31,Math.sin(a)*(outer+.48));warningArrows.add(arrow);
  }
  }
 }
 function buildMechanism(selected){
  release(drive);drive.clear();
  if(settings.mechanism==='previous'){buildLegacyMechanism(selected);return;}
  release(gearRoot);gearRoot.clear();release(carrier);carrier.clear();release(warningArrows);warningArrows.clear();locks.length=0;
  const cells=sector(selected).map(h=>world(h.num,0));
  // The lift cassette follows the actual jagged opening, including the inner
  // boundary of isolated rings. A bounding circle overhangs stationary cells:
  // it cuts through their tops on ascent and is occluded too soon on descent.
  // Closed, inset hex housings stay attached; no phase fades or visibility cuts.
  const casingGeo=new THREE.ExtrudeGeometry(hex(1.07),{depth:.22,bevelEnabled:false}).rotateX(-Math.PI/2);
  const casingMat=steel.clone(),ribGeo=new THREE.BoxGeometry(.13,.16,.065),ribMat=brass.clone();
  for(const p of cells){
   const housing=new THREE.Mesh(casingGeo,casingMat);housing.position.set(p.x,-.435,p.z);carrier.add(housing);
   const lowerRim=lineHex(1.065,-.415,GOLD);lowerRim.position.set(p.x,0,p.z);carrier.add(lowerRim);
   for(let edge=0;edge<6;edge++){
    const a=Math.PI/6+edge*Math.PI/3,nx=Math.cos(a),nz=Math.sin(a);
    const neighbour=cells.some(q=>Math.hypot(q.x-p.x-nx*1.95,q.z-p.z-nz*1.95)<.02);
    if(neighbour)continue;
    // Inset brass teeth on the exposed walls, entirely beneath their own tile.
    for(const along of [-.34,0,.34]){const rib=new THREE.Mesh(ribGeo,ribMat);rib.position.set(p.x+nx*.91-nz*along,-.325,p.z+nz*.91+nx*along);rib.rotation.y=Math.PI/2-a;carrier.add(rib);}
   }
  }
  if(!cells.length){casingGeo.dispose();casingMat.dispose();ribGeo.dispose();ribMat.dispose();}
  // The large circular drive is a BELOW-DECK part. It rotates but does not
  // ride the lift, so its swept radius can never emerge through fixed tiles.
  for(const r of selected){
   const radius=r*1.95;
   const bearing=new THREE.Mesh(new THREE.CylinderGeometry(radius+.23,radius+.23,.23,96,1,true),steel.clone());bearing.position.y=-.88;gearRoot.add(bearing);
   gearRoot.add(circle(radius+.25,-.75,TEAL,.018));
   const wheel=new THREE.Mesh(new THREE.TorusGeometry(radius,.09,8,96),brass.clone());wheel.rotation.x=Math.PI/2;wheel.position.y=-.68;drive.add(wheel);
   for(let i=0;i<60;i++){const a=i*Math.PI/30,tooth=new THREE.Mesh(new THREE.BoxGeometry(.14,.12,.18),brass.clone());tooth.position.set(Math.cos(a)*(radius+.06),-.68,Math.sin(a)*(radius+.06));tooth.rotation.y=-a;drive.add(tooth);}
   for(let i=0;i<6;i++){
    const a=Math.PI/6+i*Math.PI/3,x=Math.cos(a)*radius,z=Math.sin(a)*radius;
    const lock=new THREE.Group();lock.position.set(x,-.62,z);lock.rotation.y=-a;
    lock.add(new THREE.Mesh(new THREE.BoxGeometry(.3,.2,.28),steel.clone()));
    const led=new THREE.Mesh(new THREE.BoxGeometry(.2,.025,.15),new THREE.MeshBasicMaterial({color:GOLD}));led.position.y=.11;lock.add(led);gearRoot.add(lock);locks.push({lock,a,x,z,led});
    const arrow=new THREE.Mesh(new THREE.ConeGeometry(.18,.5,3),new THREE.MeshBasicMaterial({color:GOLD,transparent:true,opacity:.85,depthWrite:false}));arrow.rotation.x=Math.PI/2;arrow.rotation.z=a;arrow.position.set(x,.31,z);warningArrows.add(arrow);
   }
  }
 }
 function configure(next,source){
  settings=next;
  const key=`${next.mechanism}:${next.rings.join(',')}`;
  if(selectionKey!==key){selectionKey=key;buildMechanism(next.rings);for(const tile of tiles){const moving=affected(tile.num,next.rings);(moving?rotor:staticDeck).add(tile.root);tile.body.material=moving?movingMat:staticMat;tile.border.material.color.set(moving?GOLD:tile.num===56?TEAL:0x466679);tile.inset.material.color.set(moving?0x8a704c:0x334e5e);}}
  release(routes);routes.clear();
  for(const a of plan(source,next))if(a.riding){const from=world(a.num,.28),angle=-next.direction*next.steps*Math.PI/3,pts=[];for(let i=0;i<=40;i++)pts.push(v(from).applyAxisAngle(new THREE.Vector3(0,1,0),angle*i/40));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color:a.color,dashSize:.13,gapSize:.1,transparent:true,opacity:.75,depthWrite:false}));line.computeLineDistances();routes.add(line);const ring=circle(.72,.27,a.color,.025);const dest=world(a.to);ring.position.x=dest.x;ring.position.z=dest.z;routes.add(ring);const center=new THREE.Mesh(new THREE.RingGeometry(.12,.2,6).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:a.color,transparent:true,opacity:.8,side:THREE.DoubleSide}));center.position.copy(v(world(a.to,.28)));routes.add(center);}
  warningArrows.scale.z=next.direction;
 }
 function view(kind){const small=host.clientWidth<600;const target=new THREE.Vector3(0,kind==='mechanism'?-.3:.3,0);const distance=kind==='mechanism'?18:kind==='top'?29:29;const fit=Math.max(distance,15/(Math.tan(camera.fov*Math.PI/360)*Math.max(camera.aspect,.6)));const d=kind==='mechanism'?Math.max(18,fit*.63):fit;const unit=kind==='top'?new THREE.Vector3(0,1,.001):kind==='mechanism'?new THREE.Vector3(.35,.25,1).normalize():new THREE.Vector3(.22,.85,1).normalize();camera.position.copy(target).addScaledVector(unit,d*(small?1.02:1));controls.target.copy(target);controls.update();}
 const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();view(settings.camera);});resize.observe(host);
 configure(L,initialActors);view(L.camera);
 return {configure,view,
  render(t,p,source){
   rotor.rotation.y=p.displayAngle;rotor.position.y=p.displayLift;
   drive.rotation.y=p.displayAngle;
   carrier.rotation.y=0;labels.visible=settings.numbers&&(p.phase==='warning'||p.phase==='locked');routes.visible=settings.ghosts&&p.phase!=='locked';
   warningArrows.visible=p.phase==='warning';warningArrows.children.forEach((a,i)=>{a.material.opacity=settings.reduced?.8:.45+.35*Math.sin(t*4-i);});
   const latch=ease((t-settings.warning+.22)/.22)*(1-ease((t-settings.warning-.8-settings.turnTime-.8)/.25));
   for(const {lock,a,x,z,led} of locks){lock.position.x=x+Math.cos(a)*latch*.18;lock.position.z=z+Math.sin(a)*latch*.18;led.material.color.set(p.phase==='locked'?TEAL:GOLD);}
   movingMat.emissive.set(GOLD);movingMat.emissiveIntensity=settings.glow*(p.phase==='warning'?.07:.035);bloom.strength=settings.bloom;under.intensity=40*settings.glow;
   for(const a of source){const st=actors.get(a.id),riding=affected(a.num,settings.rings),pos=v(world(a.num));if(riding){pos.applyAxisAngle(new THREE.Vector3(0,1,0),p.displayAngle);pos.y+=p.displayLift;}st.group.position.copy(pos);st.group.rotation.y=a.yaw+(riding&&settings.carryFacing?p.displayAngle:0);st.frame(t,{reduced:settings.reduced,cameraPos:camera.position});}
   controls.update();composer.render();
  },
  dispose(){if(disposed)return;disposed=true;resize.disconnect();controls.dispose();for(const st of actors.values()){scene.remove(st.group);st.dispose();}release(scene);steel.dispose();brass.dispose();staticMat.dispose();movingMat.dispose();bloom.dispose();output.dispose();composer.dispose();renderer.dispose();renderer.domElement.remove();}
 };
}
