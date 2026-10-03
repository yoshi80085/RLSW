# Bat + Crumbling Stage — source bundle

Attach this file together with CLAUDE_STAGE_EFFECTS_HANDOFF.md to Claude for review.
These source files import the existing RLSW repository; this document is not a standalone application.
The ZIP contains screenshots, complete changed-file snapshots, and a patch.

## .scratch/stage-bats/batShow.js

````````text
import * as THREE from 'three';

export const DEFAULTS = Object.freeze({size:1.1,flap:1,height:2.3,glow:1.1,bank:.65,particles:1,bloom:.5,entrance:true,sonar:true,shadows:true,compare:false,reduced:false,camera:'hero'});
export const SLIDERS = [['size','Wingspan',.65,1.6,.05],['flap','Wingbeat',.4,1.8,.05],['height','Hover height',1.5,3.5,.1],['glow','Vein glow',0,2,.05],['bank','Bank into turns',0,1,.05],['particles','Collision sparks',0,1.5,.1],['bloom','Bloom',0,1,.05]];
export const smooth = n => { const u=THREE.MathUtils.clamp(n,0,1);return u*u*(3-2*u); };

// Geometry, not a facing billboard: membranes and finger bones remain readable
// from the match camera as well as the close inspection camera.
export function makeBat() {
 const root=new THREE.Group(), wings=[];
 const skin=new THREE.MeshStandardMaterial({color:'#171422',roughness:.66,metalness:.18});
 const membrane=new THREE.MeshStandardMaterial({color:'#661c48',emissive:'#4b123e',emissiveIntensity:.35,roughness:.46,metalness:.12,side:THREE.DoubleSide});
 const ribs=new THREE.MeshStandardMaterial({color:'#a376bd',emissive:'#943dcc',emissiveIntensity:.5,roughness:.35});
 function orb(parent,material,scale,pos){const m=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),material);m.scale.set(...scale);m.position.set(...pos);parent.add(m);return m;}
 orb(root,skin,[.18,.18,.38],[0,0,0]);orb(root,skin,[.21,.2,.2],[0,.07,.27]);
 function bone(parent,points,r=.014){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));parent.add(new THREE.Mesh(new THREE.TubeGeometry(curve,12,r,5,false),ribs));}
 for(const side of [-1,1]){
  const shoulder=new THREE.Group();shoulder.position.x=side*.12;root.add(shoulder);
  const mirrored=new THREE.Group();mirrored.scale.x=side;shoulder.add(mirrored);
  const wrist=new THREE.Group();wrist.position.set(.47,.01,.19);mirrored.add(wrist);
  const arm=new THREE.Shape();arm.moveTo(0,.14);arm.quadraticCurveTo(.21,.4,.47,.19);arm.lineTo(.48,-.37);arm.quadraticCurveTo(.24,-.21,0,-.3);arm.closePath();
  mirrored.add(new THREE.Mesh(new THREE.ShapeGeometry(arm,16).rotateX(Math.PI/2),membrane));
  const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.4,.3,.93,.14);shape.quadraticCurveTo(.61,-.05,.72,-.46);shape.quadraticCurveTo(.39,-.16,.36,-.65);shape.quadraticCurveTo(.12,-.36,0,-.56);shape.closePath();
  wrist.add(new THREE.Mesh(new THREE.ShapeGeometry(shape,20).rotateX(Math.PI/2),membrane));
  bone(mirrored,[[0,.015,.14],[.23,.065,.34],[.47,.015,.19]],.025);
  for(const tip of [[.93,.01,.14],[.72,.01,-.46],[.36,.01,-.65],[0,.01,-.56]])bone(wrist,[[0,.025,0],[tip[0]*.6,.045,tip[2]*.45],tip]);
  const ear=new THREE.Mesh(new THREE.ConeGeometry(.1,.32,4),skin);ear.position.set(side*.135,.28,.22);ear.rotation.z=-side*.23;root.add(ear);
  const inner=new THREE.Mesh(new THREE.ConeGeometry(.053,.19,3),membrane);inner.position.set(side*.135,.29,.265);root.add(inner);
  const eye=orb(root,new THREE.MeshBasicMaterial({color:'#ff645c',toneMapped:false}),[.034,.026,.027],[side*.103,.13,.443]);eye.material.color.multiplyScalar(2.2);
  const fang=new THREE.Mesh(new THREE.ConeGeometry(.018,.075,5),new THREE.MeshStandardMaterial({color:'#ead8de'}));fang.rotation.x=Math.PI;fang.position.set(side*.055,-.05,.422);root.add(fang);
  wings.push({shoulder,wrist,side});
 }
 const tail=new THREE.Mesh(new THREE.ConeGeometry(.11,.3,3),membrane);tail.rotation.x=-Math.PI/2;tail.position.z=-.4;root.add(tail);
 return {root,pose(time,L,index=0){root.scale.setScalar(L.size);membrane.emissiveIntensity=.15+L.glow*.2;ribs.emissiveIntensity=L.glow;
  const beat=time*12*L.flap+index*1.91;
  for(const {shoulder,wrist,side} of wings){shoulder.rotation.z=L.reduced?side*.18:side*(.18+Math.sin(beat)*.53);wrist.rotation.z=L.reduced?0:Math.sin(beat-.7)*.28;}
 }};
}

export function makeMarker() {
 const root=new THREE.Group();
 const mat=new THREE.MeshBasicMaterial({color:'#bc8cff',transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false});
 const rim=new THREE.Mesh(new THREE.RingGeometry(.86,.9,6).rotateX(-Math.PI/2),mat);root.add(rim);
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(.6,28).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#030108',transparent:true,opacity:.5,depthWrite:false}));shadow.position.y=-.007;root.add(shadow);
 return {root,shadow};
}

export function disposeTree(root){const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of [o.material].flat())materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}

````````

## .scratch/stage-bats/index.html

````````text
<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bat Stage Effect · Night Flight</title><link rel="stylesheet" href="./style.css"></head>
<body>
<header><div><span class="eyebrow">SPIRIT WARS / STAGE STUDY 05</span><h1>Night flight<span>Bat Stage Effect</span></h1></div><div class="badge">INTERACTIVE LOOK STUDY</div></header>
<main><section class="show">
 <div id="stage"><div id="loading">Setting the stage…</div><div class="scene-label"><span class="dot"></span> THE COSMIC ARENA <small>Drag to orbit · scroll to inspect</small></div><div id="caption"><span id="act">01 / THE ROOST WAKES</span><h2 id="moment">Something in the rafters.</h2><p id="description"></p></div><div id="popup" hidden></div><div id="comparison" hidden><span>CURRENT LIVE MODEL</span></div></div>
 <div class="transport"><button id="play">Pause</button><button id="replay">Replay show</button><input id="timeline" type="range" aria-label="Show timeline" min="0" max="18" step=".01" value="0"><output id="time">0.0 / 18s</output><select id="speed" aria-label="Playback speed"><option value="1">1× speed</option><option value="0.5">½ speed</option></select></div>
 <nav aria-label="Show moments"><button data-time="0">01 · Entrance</button><button data-time="4">02 · Stalk</button><button data-time="7">03 · Bite</button><button data-time="10">04 · Catch</button><button data-time="15">05 · Finale</button></nav>
 <div class="notes"><div><b>FOUR HUNTERS. ONE HEADLINER.</b><p>The real chase stays: biggest FP → slowest turns → nearest Spirit. This film compresses time; live bats step every 30 seconds.</p></div><div><b>MAKE THE OUTCOME LEGIBLE.</b><p>Violet sonar announces the hunt. Crimson marks a bite (−1 Vibe). Gold celebrates a catch (+2 fans). Both collisions respawn the bat.</p></div></div>
</section><aside>
 <div class="panel-head"><span class="eyebrow">ART DIRECTION</span><h2>Give the dark wings.</h2><p>Obsidian bodies, wine-red membranes, fine luminous ribs. A little menace; a lot of stagecraft.</p></div>
 <div class="presets"><button data-preset="theatrical" class="selected">Theatrical</button><button data-preset="restrained">Restrained</button><button data-preset="supernatural">Supernatural</button></div>
 <div id="sliders"></div>
 <div class="toggles" id="toggles"></div>
 <label class="select-row">Camera<select id="camera"><option value="hero">Close inspection</option><option value="board">Match distance</option><option value="top">Top-down</option></select></label>
 <div class="handoff"><button id="copy">Copy dial-in</button><button id="reset">Reset look</button><p id="saved">Settings save in this browser. Copy before moving or renaming the page.</p><textarea id="dial" aria-label="Copyable dial-in settings" readonly hidden></textarea></div>
</aside></main>
<footer>PREVIEW ONLY · Includes proposed entrance, sonar, collision and exit choreography. Gameplay values come from the current rules.</footer>
<script type="module" src="./preview.js"></script></body></html>

````````

## .scratch/stage-bats/preview.js

````````text
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createArenaEnvironment, polishArenaModel } from '../../src/board/arenaEnvironment.js';
import { createStandee } from '../../src/board/standee.js';
import { SPIRIT_DEFS } from '../../src/data/spirits.js';
import { HEX_BY_NUM } from '../../src/board/hexMap.js';
import { createBatStage } from '../../src/board/batStage.js';
import { BAT_DAMAGE, BAT_FAN_GAIN, BAT_STEP_MS } from '../../src/data/stageEffects.js';
import { DEFAULTS, SLIDERS, smooth, makeBat, makeMarker, disposeTree } from './batShow.js';

const $=id=>document.getElementById(id), storage=`rlsw.bats.look.v1:${location.pathname}`;
const media=matchMedia('(prefers-reduced-motion: reduce)');
let L={...DEFAULTS,reduced:media.matches};
try {const saved=JSON.parse(localStorage.getItem(storage)||'{}');for(const [k,,min,max] of SLIDERS)if(Number.isFinite(saved[k]))L[k]=THREE.MathUtils.clamp(saved[k],min,max);for(const k of ['entrance','sonar','shadows','compare','reduced'])if(typeof saved[k]==='boolean')L[k]=saved[k];if(['hero','board','top'].includes(saved.camera))L.camera=saved.camera;}catch{/* Browser persistence is optional. */}
if(media.matches)L.reduced=true;
let age=0,paused=media.matches,speed=1,ready=false,disposed=false;
const presetLooks={theatrical:{...DEFAULTS},restrained:{...DEFAULTS,size:.9,glow:.45,bank:.25,particles:.5,bloom:.25},supernatural:{...DEFAULTS,size:1.3,glow:1.8,bank:.9,particles:1.4,bloom:.75}};
for(const [key,label,min,max,step] of SLIDERS){const row=document.createElement('label');row.className='slider';row.innerHTML=`<span>${label}<output id="${key}Value"></output></span><input id="${key}" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}">`;$('sliders').append(row);$(key).oninput=()=>{L[key]=Number($(key).value);sync();};}
for(const [key,label] of [['entrance','Swarm entrance & exit'],['sonar','Echolocation rings'],['shadows','Ground shadows'],['compare','Compare current bat'],['reduced','Reduced motion']]){const row=document.createElement('label');row.innerHTML=`${label}<input type="checkbox" id="${key}">`;$('toggles').append(row);$(key).onchange=()=>{L[key]=$(key).checked;sync();};}
function sync(){
 for(const [key] of SLIDERS){$(key).value=L[key];$(`${key}Value`).textContent=`${L[key].toFixed(2)}${L[key]!==DEFAULTS[key]?' *':''}`;$(key).closest('label').classList.toggle('changed',L[key]!==DEFAULTS[key]);}
 for(const key of ['entrance','sonar','shadows','compare','reduced'])$(key).checked=L[key];$('camera').value=L.camera;
 $('comparison').hidden=!L.compare;
 for(const b of document.querySelectorAll('[data-preset]'))b.classList.toggle('selected',SLIDERS.every(([k])=>L[k]===presetLooks[b.dataset.preset][k]));
 $('dial').value=JSON.stringify({study:'Bat Stage Effect / Night Flight',version:1,settings:L,changed:Object.fromEntries(Object.entries(L).filter(([k,v])=>v!==DEFAULTS[k])),untouched:Object.keys(L).filter(k=>L[k]===DEFAULTS[k])},null,2);
 try{localStorage.setItem(storage,JSON.stringify(L));}catch{$('saved').textContent='Browser storage is unavailable. Copy your settings to keep them.';}
}
function pause(value){paused=value;$('play').textContent=paused?'Play':'Pause';}
$('play').onclick=()=>pause(!paused);$('replay').onclick=()=>{age=0;pause(false);};$('timeline').oninput=()=>{age=Number($('timeline').value);pause(true);};$('speed').onchange=()=>{speed=Number($('speed').value);};
for(const b of document.querySelectorAll('[data-time]'))b.onclick=()=>{age=Number(b.dataset.time);pause(false);};
for(const b of document.querySelectorAll('[data-preset]'))b.onclick=()=>{L={...L,...presetLooks[b.dataset.preset],camera:L.camera,compare:L.compare,reduced:L.reduced};sync();};
$('reset').onclick=()=>{L={...DEFAULTS,reduced:media.matches};sync();cameraPose();};
$('copy').onclick=async()=>{$('dial').hidden=false;$('dial').select();try{await navigator.clipboard.writeText($('dial').value);$('saved').textContent='Copied. Paste the dial-in into our chat; * marks changed controls.';}catch{$('saved').textContent='Settings selected. Press Ctrl+C to copy.';}};
$('camera').onchange=()=>{L.camera=$('camera').value;cameraPose();sync();};
sync();pause(paused);

const point=(num,y=.23)=>{const h=HEX_BY_NUM[num];return new THREE.Vector3((h.px-3255)/200,y,(h.py-2415)/200);};
const host=$('stage'), scene=new THREE.Scene();scene.background=new THREE.Color('#060711');
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;host.append(renderer.domElement);
const camera=new THREE.PerspectiveCamera(40,1,.1,250),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI*.485;controls.minDistance=5;controls.maxDistance=55;
const environment=createArenaEnvironment(scene,{classicScenery:false});
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),L.bloom,.55,1);composer.addPass(bloom);const output=new OutputPass();composer.addPass(output);
function cameraPose(){const target=point(56,1.15);controls.target.copy(target);const positions={hero:[9,10,15],board:[18,24,29],top:[0,24,.1]};camera.position.copy(target).add(new THREE.Vector3(...positions[L.camera]));controls.update();}
cameraPose();
const observer=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(host);
let arena=null;
new GLTFLoader().load(`${import.meta.env.BASE_URL}cosmic-arena/cosmic-arena.glb`,g=>{if(disposed){disposeTree(g.scene);return;}arena=g.scene;arena.scale.z=-1;polishArenaModel(arena);scene.add(arena);$('loading').hidden=true;ready=true;},undefined,()=>{$('loading').textContent='The arena could not load. Reload this local preview to retry.';});
const pawn=createStandee({...SPIRIT_DEFS.cosmic_ronin,color:'#6daaff'});scene.add(pawn.group);const pawnHome=point(56,.2);
const bats=Array.from({length:4},()=>{const bat=makeBat(),marker=makeMarker();scene.add(bat.root,marker.root);return {...bat,marker};});
// Fixed occupied hexes in this art study; only the prop drifts. A future port
// must drive these markers with the engine's hex immediately, as batStage does.
const homes=[46,65,38,74].map(n=>point(n,L.height));
const swarm=Array.from({length:16},()=>{const b=makeBat();scene.add(b.root);return b;});
const sonar=Array.from({length:3},()=>{const ring=new THREE.Mesh(new THREE.RingGeometry(.98,1,80).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#ba78ff',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(ring);return ring;});
const sparksGeo=new THREE.BufferGeometry(),sparkPositions=new Float32Array(90*3);sparksGeo.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3));const sparks=new THREE.Points(sparksGeo,new THREE.PointsMaterial({color:'#ffce72',size:.065,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(sparks);
const impact=new THREE.Mesh(new THREE.RingGeometry(.88,1,64).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#ff526c',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));scene.add(impact);
const oldScene=new THREE.Scene();oldScene.background=new THREE.Color('#0a0b13');oldScene.add(new THREE.HemisphereLight('#c9d8ff','#39263c',3));
const oldLight=new THREE.DirectionalLight('#ffffff',3);oldLight.position.set(3,6,4);oldScene.add(oldLight);
const oldCamera=new THREE.PerspectiveCamera(40,1.2,.1,50);oldCamera.position.set(3.2,4.3,6);oldCamera.lookAt(0,1.2,0);
const oldRenderer=new THREE.WebGLRenderer({antialias:true});oldRenderer.setSize(180,150);oldRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));$('comparison').append(oldRenderer.domElement);
const oldBat=createBatStage(oldScene,{pointFor:(_,y)=>new THREE.Vector3(0,y,0),release:disposeTree});oldBat.update([{key:'reference',num:56,flight:0}]);
const acts=[['01 / THE ROOST WAKES','Something in the rafters.','A ribbon of silhouettes crosses the lights. Four hunters peel away and settle over their hexes.'],['02 / THE HUNT','They can hear the headliner.','A violet echo passes across the deck. The hunters bank and beat their wings, anchored to clear occupied hexes.'],['03 / THE BITE','One beat too late.',`A sharp dive, a crimson shock ring and a brief recoil: −${BAT_DAMAGE} Vibe. The bat returns to the stage.`],['04 / THE CATCH','Turn the scare into an encore.',`The Spirit steps into the bat’s hex. Gold sparks and +${BAT_FAN_GAIN} fans celebrate the catch, then the bat respawns.`],['05 / THE FINALE','Back into the night.','The four hunters rise into a loose spiral. The echoes fade and the arena is yours again.']];
function draw(t){
 const fixed=L.reduced?0:t,idx=t<3?0:t<7?1:t<10?2:t<15?3:4;
 $('act').textContent=acts[idx][0];$('moment').textContent=acts[idx][1];$('description').textContent=acts[idx][2];
 for(const b of document.querySelectorAll('[data-time]'))b.setAttribute('aria-current',String([...document.querySelectorAll('[data-time]')].indexOf(b)===idx));
 $('timeline').value=t;$('time').textContent=`${t.toFixed(1)} / 18s`;bloom.strength=L.bloom;
 pawn.group.position.copy(pawnHome);pawn.group.rotation.set(0,.3,0);
 // CATCH moves the Spirit to the bat, BITE moves the bat to the Spirit.
 const catchTravel=smooth((t-10)/.8)*(1-smooth((t-12.7)/.8));
 pawn.group.position.lerp(homes[1].clone().setY(.2),L.reduced?(t>=10.8&&t<12.7?1:0):catchTravel);
 const biteAge=t-7.65,catchAge=t-10.8,contact=idx===2?biteAge:catchAge;
 if(!L.reduced&&biteAge>0&&biteAge<.65)pawn.group.rotation.z=Math.sin(biteAge*29)*.12*Math.exp(-biteAge*5);
 for(let i=0;i<4;i++){
  const b=bats[i],home=homes[i].clone().setY(L.height),p=home.clone();let yaw=.45;
  const enter=L.entrance?smooth((t-i*.12)/2):1,exit=L.entrance?smooth((t-15-i*.15)/2.1):0;
  if(!L.reduced){p.x+=Math.sin(fixed*.75+i)*.15;p.z+=Math.cos(fixed*.85+i)*.15;p.y+=Math.sin(fixed*2.1+i)*.13;
   if(enter<1){p.x+=(1-enter)*(-8+i*4);p.y+=(1-enter)*7;p.z-=(1-enter)*8;}
   if(exit>0){p.x+=Math.sin(exit*5+i)*exit*4;p.z-=exit*8;p.y+=exit*8;}
  }
  b.root.visible=L.reduced?(t>=1&&t<17.5):enter>.03&&exit<.98;
  if(i===0&&idx===2){const dive=smooth((t-7)/.65),retreat=smooth((t-8)/1.2),amount=dive*(1-retreat);const target=pawnHome.clone().setY(1.6);p.lerp(target,L.reduced?0:amount);yaw=Math.atan2(target.x-home.x,target.z-home.z);}
  const caught=i===1&&catchAge>=0&&catchAge<1.1;b.root.visible&&=!caught;
  b.root.position.copy(p);b.root.rotation.set(0,yaw,L.reduced?0:Math.sin(fixed*1.4+i)*.18*L.bank);b.pose(fixed,L,i);
  b.marker.root.position.copy(home).setY(.235);b.marker.root.visible=b.root.visible;b.marker.shadow.visible=L.shadows;
 }
 for(let i=0;i<swarm.length;i++){const b=swarm[i],entry=t<3,u=entry?(t-i*.035)/3:(t-15-i*.025)/2.7;b.root.visible=L.entrance&&!L.reduced&&u>0&&u<1&&(t<3||t>=15);if(!b.root.visible)continue;const theta=i*2.4+u*5;b.root.position.set(Math.cos(theta)*(7-2*u),3+Math.sin(i)*.7+(entry?(1-u)*5:u*7),Math.sin(theta)*4-3-u*5);b.root.rotation.set(0,theta+.8,Math.sin(theta)*.4);b.pose(fixed,{...L,size:.22+i%4*.045},i);}
 for(let i=0;i<3;i++){const r=sonar[i],u=L.reduced?.35:((t+i*.6)%2.4)/2.4;r.position.copy(pawnHome).setY(.25+i*.003);r.scale.setScalar(1+u*6);r.material.opacity=L.sonar&&idx===1?(L.reduced?.12:(1-u)*.23):0;}
 const active=(idx===2||idx===3)&&contact>=0&&contact<1.2;
 const color=idx===2?'#ff526c':'#ffd478';impact.position.copy(pawn.group.position).setY(.255);impact.scale.setScalar(L.reduced?1.2:.4+Math.max(0,contact)*2.8);impact.material.color.set(color);impact.material.opacity=active?(L.reduced?.35:(1-contact/1.2)*.7):0;
 sparks.material.color.set(color);sparks.material.opacity=active&&!L.reduced?Math.max(0,1-contact/1.2):0;sparksGeo.setDrawRange(0,Math.round(60*L.particles));
 for(let i=0;i<90;i++){const a=i*2.3999,v=.7+(i%7)*.25,dt=Math.max(0,contact);sparkPositions[i*3]=pawn.group.position.x+Math.cos(a)*dt*v;sparkPositions[i*3+1]=1.4+Math.sin(i*17)*dt*2-dt*dt*.8;sparkPositions[i*3+2]=pawn.group.position.z+Math.sin(a)*dt*v;}sparksGeo.attributes.position.needsUpdate=true;
 // Keep culling in sync with the particle buffer as the catch moves its origin.
 sparksGeo.computeBoundingSphere();
 const pop=$('popup');pop.hidden=!active;pop.textContent=idx===2?`−${BAT_DAMAGE} VIBE`:`+${BAT_FAN_GAIN} FANS`;pop.style.color=color;
 const screen=pawn.group.position.clone().add(new THREE.Vector3(0,3.7,0)).project(camera);pop.style.left=`${(screen.x*.5+.5)*host.clientWidth}px`;pop.style.top=`${(-screen.y*.5+.5)*host.clientHeight}px`;pop.style.transform='translate(-50%,-50%)';
 oldBat.tick(fixed,{reduced:L.reduced});if(L.compare)oldRenderer.render(oldScene,oldCamera);
 composer.render();
}
let previous=performance.now(),raf;
function frame(now){if(disposed)return;const dt=Math.min((now-previous)/1000,.05);previous=now;if(ready&&!paused&&!document.hidden)age=(age+dt*speed)%18;controls.update();draw(age);raf=requestAnimationFrame(frame);}
raf=requestAnimationFrame(frame);
function preference(){if(media.matches){L.reduced=true;pause(true);sync();}}media.addEventListener('change',preference);
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();media.removeEventListener('change',preference);controls.dispose();oldBat.dispose();oldRenderer.dispose();pawn.dispose();environment.dispose();disposeTree(scene);bloom.dispose();output.dispose();composer.dispose();renderer.dispose();},{once:true});
// Small read-only hook for visual QA, no dependency from the live game.
window.batStudy={get state(){return {age,paused,ready,settings:{...L},ruleStepMs:BAT_STEP_MS,batCount:bats.length};}};

````````

## .scratch/stage-bats/README.md

````````text
# Bat Stage Effect — Night Flight

Standalone visual study, 2026-10-03. Run the repository's Vite server and open
`/RLSW/.scratch/stage-bats/`. No live game modules are changed by this study.

Uses the actual Cosmic Arena GLB, arena lighting and Ronin standee. New procedural
3D bats have wine-red scalloped membranes, two-part wings, curved finger bones,
obsidian bodies, inner ears, fangs and luminous eyes. Four occupied-hex markers
remain pinned underneath the hovering models. Current bat comparison imports
the actual `src/board/batStage.js` into a separate inspection window.

The 18-second film offers entrance, stalking/sonar, bite/recoil, catch/reward and
spiral-exit moments. Bite and catch use the current damage and fan constants.
It is staged choreography, not a rules simulator: the real 30-second steps and
target priorities are described on the page. A production port must consume
`stageFx.lastBats.hits/eaten/moves` and drive markers from the engine's bat hexes.
No extra roosting rule is implemented. Audio is not included in this visual pass.

**Alex's instruction, 2026-10-03: keep BOTH bat assets.** He likes the charm of
Sol 6.1's original bat. Preserve `src/board/batStage.js` alongside this folder's
`batShow.js`; do not replace or delete the original on integration. The original
remains live and is available in the comparison window. A later integration
should keep both as selectable styles.

Seven sliders, three presets, camera choices, layer toggles, reduced motion,
pause, seek, half-speed, current-model comparison and copyable JSON dial-in.
Settings persist by page path; export explicitly distinguishes changed settings
from untouched defaults. System reduced motion starts paused with minimal poses.

Possible next gameplay idea: an amp roost, flushed by its owner's next melody.
This is a proposal only; balance and rule changes need a separate decision.

````````

## .scratch/stage-bats/style.css

````````text
:root{color-scheme:dark;font-family:Inter,Segoe UI,sans-serif;background:#080a10;color:#e9e6f0;font-synthesis:none}*{box-sizing:border-box}body{margin:0}header{padding:25px 32px 21px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #292331}.eyebrow{font-size:10px;letter-spacing:2.2px;color:#ad93c2;font-weight:700}h1{font-size:32px;letter-spacing:-1px;margin:7px 0 0;font-weight:600}h1 span{font-size:12px;letter-spacing:.4px;color:#9692a3;margin-left:20px;font-weight:400}.badge{font-size:10px;letter-spacing:1.4px;border:1px solid #43334e;color:#c6a9de;padding:9px 12px;border-radius:20px}main{padding:22px 28px;display:grid;grid-template-columns:minmax(0,1fr) 292px;gap:24px}.show{min-width:0}#stage{height:clamp(430px,65vh,800px);position:relative;border:1px solid #31263d;border-radius:12px;overflow:hidden;background:#05060d}canvas{display:block}#stage>canvas{width:100%;height:100%}.scene-label{position:absolute;top:18px;left:20px;z-index:1;font-size:10px;letter-spacing:1.6px;color:#c9bdd6;pointer-events:none}.scene-label small{display:block;margin-top:8px;font-size:10px;letter-spacing:.2px;color:#8a8199}.dot{display:inline-block;background:#bb8bf2;width:6px;height:6px;border-radius:50%;margin-right:7px;box-shadow:0 0 10px #cc7fff}#caption{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,#070811ed);padding:55px 22px 22px;pointer-events:none}#act{font-size:10px;letter-spacing:2px;color:#caaaeb}#moment{font-size:26px;letter-spacing:-.6px;font-weight:500;margin:9px 0}#description{color:#a6a1b2;font-size:12px;max-width:570px;margin:0;line-height:1.6}#loading{position:absolute;inset:0;display:grid;place-items:center;background:#080a10;z-index:3;color:#c6a9de}#loading[hidden]{display:none}#popup{position:absolute;left:50%;top:32%;font-size:21px;font-weight:800;letter-spacing:1px;text-shadow:0 2px 12px #000;pointer-events:none}#comparison{position:absolute;right:15px;top:15px;width:180px;height:150px;border:1px solid #45344f;background:#0a0b13;border-radius:8px;overflow:hidden}#comparison span{position:absolute;bottom:10px;left:12px;font-size:9px;letter-spacing:1px;color:#a7a0b3}button,select{background:#15131f;border:1px solid #383041;color:#c6c0d4;padding:9px 11px;border-radius:6px;font:inherit;font-size:11px;cursor:pointer}button:hover{border-color:#b482dc;color:white}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid #d6b0ff;outline-offset:3px}button.selected,button[aria-current=true]{background:#352043;color:#ead9ff;border-color:#8d5ead}.transport{display:flex;gap:9px;align-items:center;padding:15px 0}.transport input{flex:1;min-width:70px}input[type=range]{accent-color:#b18acb;height:4px;cursor:pointer}output{font:10px ui-monospace,monospace;color:#baadcb}.transport output{white-space:nowrap}nav{display:flex;gap:7px;flex-wrap:wrap}nav button{flex:1;white-space:nowrap;padding:11px 6px;font-size:10px}.notes{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px;border-top:1px solid #27212f;padding-top:20px}.notes b{font-size:9px;letter-spacing:1.2px;color:#b9a7c9}.notes p,aside p{font-size:11px;line-height:1.7;color:#8e879b}.panel-head h2{font-weight:500;font-size:23px;letter-spacing:-.5px;margin:10px 0}.panel-head p{margin-bottom:19px}.presets{display:flex;gap:4px;margin-bottom:20px}.presets button{font-size:10px;padding:8px;flex:1}.slider{display:block;margin:17px 0}.slider span{display:flex;justify-content:space-between;font-size:11px;color:#bdb3ca}.slider input{width:100%;margin-top:11px}.changed span{color:#e7c88d}.toggles{border-top:1px solid #292231;margin-top:22px;padding-top:12px}.toggles label{display:flex;align-items:center;justify-content:space-between;margin:12px 0;font-size:11px;color:#bdb3ca}input[type=checkbox]{accent-color:#bc8cff}.select-row{display:flex;justify-content:space-between;align-items:center;font-size:11px;margin:20px 0}.handoff{border-top:1px solid #292231;padding-top:18px}.handoff button:first-child{background:#b995d1;color:#170d20;border-color:#b995d1;font-weight:700}.handoff p{font-size:10px}textarea{width:100%;height:130px;background:#080a10;border:1px solid #43334e;color:#c5b2d5;font:10px monospace;padding:10px}footer{padding:0 28px 22px;color:#756b83;font-size:9px;letter-spacing:.8px}@media(max-width:1000px){main{grid-template-columns:minmax(0,1fr) 245px;padding:16px;gap:16px}header{padding:20px}h1 span{display:block;margin:7px 0 0}.badge{display:none}.transport{flex-wrap:wrap}}@media(max-width:700px){main{grid-template-columns:1fr}aside{max-width:500px}.notes{gap:15px}}

````````

## .scratch/crumbling-stage/index.html

````````text
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#090c12"><title>Crumbling Stage · Spirit Wars</title><link rel="stylesheet" href="./style.css"></head><body><main>
<header><a class="brand" href="./index.html"><span class="brand-mark">SW</span><span>SPIRIT WARS<small>THE STAGE IS A WEAPON</small></span></a><div class="edition"><span class="dot"></span> STAGE EFFECT LAB / 003</div></header>
<div class="intro"><div><div class="eyebrow">ENVIRONMENTAL HAZARD / THREE-ROUND SHOW</div><h1>Crumbling <em>Stage.</em></h1><p>The floor gives way. Make sure your rival goes with it.</p></div><div class="preview-badge">INTERACTIVE STUDY<span>PREVIEW · NOT LIVE</span></div></div>
<div class="layout"><section class="arena" aria-label="Interactive crumbling stage"><div class="stage-top"><div><span class="dot"></span><span id="showtag">INTACT STAGE</span></div><span id="roundtag">111 HEXES / 4 PROTECTED HOMES</span></div><div id="board" class="board" tabindex="0" aria-label="3D stage. Drag to orbit, scroll to zoom. Use camera buttons for fixed views."></div><div id="cue" class="cue" aria-live="polite"></div><div class="viewbar"><span>DRAG TO ORBIT · SCROLL TO ZOOM</span><div class="buttons"><button id="wide" class="view active">Arena</button><button id="close" class="view">Hazard close-up</button><button id="top" class="view">Overhead</button></div></div><div class="transport"><div><span class="eyebrow">01 / BREAK THE FLOOR</span><p id="instruction">Open four traps. Find your next opening.</p></div><button class="primary" id="start">✦ Crumble stage</button><button id="round">Next round →</button></div><div class="stats"><div><span>RIVAL FAME</span><strong id="fp">23</strong><small id="loss">No FP lost</small></div><div><span>OPEN ABYSSES</span><strong id="holes">00</strong><small>4 new holes / round</small></div><div class="spirit-state"><span>RIVAL STATUS</span><strong id="status">On stage</strong><small id="vibe">Full Vibe · 3 lives intact</small></div></div></section>
<aside><section class="card"><div class="card-title"><h2>Run the encounter</h2><span>01</span></div><p>Turn a broken floor into the final hit.</p><div class="action-stack"><button id="push">Push rival into abyss ↘</button><button id="turn">Rival’s next turn ↗</button></div><div class="setup"><label for="fame">Starting Fame</label><input id="fame" type="number" value="23" min="0" max="999"><button id="reset" class="quiet">↺ Reset</button></div><div class="rules"><div><b>−10%</b><span>Fame on a fall, rounded up.</span></div><div><b>↗ HOME</b><span>Next own turn. Full Vibe. Lives intact.</span></div></div></section>
<section class="card"><div class="card-title"><h2>Art direction</h2><span>02</span></div><div id="levers"></div><div class="toggles"><label><input id="numbers" type="checkbox"> Hex numbers</label><label><input id="motion" type="checkbox"> Reduced motion</label></div><label class="seed-label" for="seed">Pattern seed <input id="seed" type="number" min="1" max="99999"></label><div class="handoff"><button id="copy">Copy dial-in ↗</button><button id="defaults" class="quiet">Restore look</button></div><textarea id="dial" aria-label="Dial-in handoff" readonly placeholder="Your settings appear here."></textarea><small id="copystatus">Settings save at this URL. Copy before moving the page.</small></section></aside></div>
<section class="eventlog"><span class="eyebrow">LIVE FIELD NOTES</span><p id="log" aria-live="polite">The stage is intact. Crumble it to reveal the traps.</p><a href="./original.html" target="_blank" rel="noopener">Original study ↗</a></section><footer><span>SPIRIT WARS / CRUMBLING STAGE</span><span>REAL GAME RULES. EXPERIMENTAL STAGE ART.</span></footer></main><script type="module" src="./preview.js"></script></body></html>

````````

## .scratch/crumbling-stage/original.html

````````text
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Crumbling Stage · Spirit Wars</title>
<style>
:root{color-scheme:dark;font-family:Inter,Segoe UI,sans-serif;background:#080c15;color:#e6e5f5}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 40% 30%,#22213b,#080c15 65%);min-height:100vh}main{max-width:1320px;margin:auto;padding:30px}header{display:flex;justify-content:space-between;align-items:center}small{letter-spacing:3px;color:#a899cf;font-size:11px}h1{font-weight:650;font-size:32px;margin:8px 0}p{color:#a7aac2;line-height:1.6;font-size:14px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:24px;margin-top:24px}.arena{position:relative;border:1px solid #39324b;border-radius:24px;overflow:hidden;background:radial-gradient(ellipse,#272840,#0b0e1b 70%);min-height:600px;padding:35px 15px}.tag{position:absolute;left:24px;top:22px;color:#cfb2ff;font-size:11px;letter-spacing:2px}.board{height:450px;margin-top:25px;perspective:1000px}.board svg{width:100%;height:100%;overflow:visible;transform:rotateX(var(--tilt));transform-origin:center}polygon{stroke:#56647d;stroke-width:3;fill:#263448}.hole polygon{fill:#020309;stroke:var(--rim);stroke-width:5;filter:drop-shadow(0 0 8px var(--rim))}.hole .crack{stroke:var(--rim);stroke-width:3;fill:none;opacity:.8}.hole .shard{fill:#6e6885;stroke:none;transform-box:fill-box;transform-origin:center;animation:crumble var(--speed) ease-in infinite}.tiletext{fill:#8e9eb6;font-size:27px;text-anchor:middle;pointer-events:none}.home polygon{fill:#243750;stroke:#719aca}.home .tiletext{fill:#aacdff}.spirit circle{fill:#4ca9ff;stroke:#b3ddff;stroke-width:5;filter:drop-shadow(0 0 20px #4ca9ff)}.spirit text{fill:white;font-size:32px;font-weight:700;text-anchor:middle}.victim circle{fill:#ff815a;stroke:#ffc2a6;filter:drop-shadow(0 0 20px #ff815a)}.falling{animation:fall var(--speed) ease-in both;transform-box:fill-box;transform-origin:center}@keyframes crumble{0%,30%{opacity:.75;transform:translateY(0) rotate(0)}95%,100%{opacity:0;transform:translateY(100px) rotate(90deg) scale(.3)}}@keyframes fall{to{opacity:0;transform:translateY(100px) scale(.1) rotate(60deg)}}.card{border:1px solid #34354c;background:#121827cc;border-radius:16px;padding:19px;margin-bottom:15px}h2{font-size:13px;letter-spacing:1px;margin:0 0 16px;color:#cfc6e8}label{display:block;font-size:12px;color:#c2c4d8;margin-top:17px}label span{float:right;color:#d9baff}input[type=range]{width:100%;accent-color:#b48cff;margin-top:9px}input[type=number]{background:#0c1020;color:white;border:1px solid #464860;border-radius:6px;padding:7px;width:75px}button{background:#292b43;border:1px solid #51516f;color:#e6e5f5;border-radius:9px;padding:11px 14px;cursor:pointer;font-size:12px}button:hover{border-color:#c0a1fa;background:#39324e}button:disabled{opacity:.35;cursor:default}.primary{background:#734fa3;border-color:#b991f0}.buttons{display:flex;gap:9px;flex-wrap:wrap}.footer{padding:0 12px;display:flex;justify-content:space-between;gap:15px;font-size:13px}.value{font-size:26px;font-weight:650;color:#e9d9ff}.muted{font-size:11px;color:#848ba5}.log{font-size:13px;line-height:1.65;min-height:95px;color:#c1bdd6;border-left:2px solid #9272bf;padding-left:16px;margin:18px 10px 0}textarea{width:100%;height:90px;background:#070d18;color:#b9c9e4;border:1px solid #41445b;font-size:11px;padding:8px;margin-top:10px;border-radius:6px}@media(max-width:950px){.layout{grid-template-columns:1fr}.arena{min-height:500px}.board{height:370px}}
</style></head><body><main>
<header><div><small>SPIRIT WARS · STAGE EFFECT STUDY</small><h1>Crumbling Stage</h1><p>The floor gives way. The abyss becomes part of the fight.</p></div><small>PREVIEW · NOT LIVE</small></header>
<div class="layout"><section class="arena"><div class="tag" id="showtag">INTACT STAGE · 111 HEXES</div><div class="board" id="board"></div><div class="footer"><div><div class="muted">RIVAL FP</div><div class="value" id="fp">23</div></div><div><div class="muted">STATUS</div><div id="status">On stage</div></div><div><div class="muted">HOLES</div><div class="value" id="holes">0</div></div></div><div class="log" id="log">Start the effect, then push the rival into a hole. These buttons run the actual game engine.</div></section>
<aside><div class="card"><h2>PLAY THE RULE</h2><div class="buttons"><button class="primary" id="start">Crumble stage</button><button id="round">Next round</button><button id="push">Push into abyss</button><button id="turn">Rival’s next turn</button><button id="reset">Reset</button></div><label>Rival’s starting FP <input id="fame" type="number" value="23" min="0" max="999"></label><p>4 empty hexes collapse each round. Existing holes stay open until the 3-round show ends. Home hexes stay safe.</p><p>A fall loses 10% FP, rounded up. The Spirit returns home with full Vibe on its own next turn. Lives stay intact.</p></div>
<div class="card"><h2>DIAL IN THE LOOK</h2><label>Crumbled rim <span id="rimv"></span><input id="rim" type="range" min="0" max="100"></label><label>Fall duration <span id="speedv"></span><input id="speed" type="range" min="300" max="2000" step="50"></label><label>Board tilt <span id="tiltv"></span><input id="tilt" type="range" min="0" max="45"></label><label>Pattern seed <input id="seed" type="number" min="1" max="99999"></label><p class="muted">Settings save here on every change. Copy before moving or renaming this page; saved settings belong to this URL.</p><button id="copy">Copy dial-in</button><textarea id="dial" aria-label="Dial-in handoff" readonly placeholder="Your settings will appear here before copying."></textarea><div class="muted" id="copystatus"></div></div></aside></div></main>
<script type="module" src="./original.js"></script></body></html>


````````

## .scratch/crumbling-stage/original.js

````````text
import { ALL_HEXES, HEX_BY_NUM } from '../../src/board/hexMap.js';
import { straightNeighborInDirection } from '../../src/board/hexGeometry.js';
import { makeInitialState } from '../../src/engine/state.js';
import { applyAction } from '../../src/engine/reduce.js';
import { stageFxActivated, stageFxRoundTicked, turnStarted, spiritsSynced } from '../../src/engine/actions.js';
import { knockback, runBattleFlow } from '../../src/engine/systems/battleFlow.js';

const $ = id => document.getElementById(id);
const defaults = { rim: 55, speed: 950, tilt: 22, seed: 31 };
const storageKey = 'rlsw-crumbling-stage-v1';
let prefs = { ...defaults };
try { prefs = { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) ?? '{}') }; } catch { /* storage can be unavailable */ }
for (const key of Object.keys(defaults)) $(key).value = prefs[key];
let state, logs = [], fallen = null;
function reset() {
  state = makeInitialState({ spirits: [
    { id: 'wildaxe', name: 'Wildaxe', num: 7, corner: 'blue', facing: 0, vibe: 10, maxVibe: 10 },
    { id: 'vera', name: 'Vera', num: 105, corner: 'red', facing: 3, vibe: 10, maxVibe: 10 },
  ], mode: 'ffa', startingLives: 3 }, prefs.seed);
  state.noteStates.vera.fame = Math.max(0, Number($('fame').value) || 0);
  fallen = null; logs = ['The stage is intact. Crumble it to reveal the traps.']; render();
}
function dispatch(action) { state = applyAction(state, action); }
function lane() {
  const holes = state.stageFx.crumbling?.hexes ?? [];
  for (const n of holes) for (const angle of [0, 60, 120, 180, 240, 300]) {
    const hole = HEX_BY_NUM[n], target = straightNeighborInDirection(hole, angle + 180);
    const attacker = target && straightNeighborInDirection(target, angle + 180);
    if (attacker && target && !holes.includes(target.num) && !holes.includes(attacker.num)) return { hole, target, attacker, angle };
  }
  return null;
}
function render() {
  try { localStorage.setItem(storageKey, JSON.stringify(prefs)); } catch { /* controls still work */ }
  document.documentElement.style.setProperty('--tilt', `${prefs.tilt}deg`);
  document.documentElement.style.setProperty('--speed', `${prefs.speed}ms`);
  document.documentElement.style.setProperty('--rim', `hsl(268 60% ${15 + prefs.rim * .55}%)`);
  $('rimv').textContent = `${prefs.rim}%`; $('speedv').textContent = `${prefs.speed}ms`; $('tiltv').textContent = `${prefs.tilt}°`;
  const holes = state.stageFx.crumbling?.hexes ?? [], victim = state.spirits.find(s => s.id === 'vera');
  const points = (h, size = 191) => Array.from({ length: 6 }, (_, i) => {
    const a = i * Math.PI / 3; return `${h.px + Math.cos(a) * size},${h.py + Math.sin(a) * size}`;
  }).join(' ');
  const pieces = ALL_HEXES.map(h => `<g class="${holes.includes(h.num) ? 'hole' : [7,12,100,105].includes(h.num) ? 'home' : ''}"><polygon points="${points(h)}"/><text class="tiletext" x="${h.px}" y="${h.py+12}">${h.num}</text>${holes.includes(h.num) ? `<path class="crack" d="M${h.px-185},${h.py} l40,20 -20,35 M${h.px+90},${h.py-155} l-10,40 35,12"/><polygon class="shard" points="${h.px-75},${h.py-20} ${h.px-20},${h.py-40} ${h.px-38},${h.py+20}"/>` : ''}</g>`).join('');
  const spirit = (sp, num = sp.num, extra = '') => {
    const h = HEX_BY_NUM[num]; if (!h) return '';
    return `<g class="spirit ${sp.id==='vera'?'victim':''} ${extra}"><circle cx="${h.px}" cy="${h.py-35}" r="72"/><text x="${h.px}" y="${h.py-25}">${sp.id==='vera'?'V':'W'}</text></g>`;
  };
  $('board').innerHTML = `<svg viewBox="1050 400 4400 3850" role="img" aria-label="111-hex stage with ${holes.length} abyss holes">${pieces}${state.spirits.map(s=>spirit(s)).join('')}${fallen ? spirit(victim, fallen, 'falling') : ''}</svg>`;
  $('showtag').textContent = state.stageFx.crumbling ? `CRUMBLING STAGE · SHOW ROUND ${state.stageFx.crumbling.showRound} · ${state.stageFx.crumbling.roundsLeft} LEFT` : 'INTACT STAGE · 111 HEXES';
  $('holes').textContent = holes.length; $('fp').textContent = state.noteStates.vera.fame;
  $('status').textContent = victim.abyssPending ? 'In the abyss · returns next turn' : victim.num === 105 ? 'At starting hex #105' : `On hex #${victim.num}`;
  $('log').textContent = logs.slice(-3).join(' ');
  $('push').disabled = !lane() || !!victim.abyssPending;
  $('turn').disabled = !victim.abyssPending; $('round').disabled = !holes.length;
  $('start').disabled = !!state.stageFx.crumbling;
}
$('start').onclick = () => { dispatch(stageFxActivated('crumbling_stage', [], 3)); logs.push('Four empty hexes collapse. The dark pits are now KO traps.'); render(); };
$('round').onclick = () => { dispatch(stageFxRoundTicked()); logs.push(state.stageFx.crumbling ? 'Four more empty hexes give way; earlier holes stay open.' : 'The show ends and the stage repairs. A fallen Spirit still returns on its own next turn.'); render(); };
$('push').onclick = () => {
  const l = lane(); if (!l) return;
  dispatch(spiritsSynced(state.spirits.map(s => ({ ...s, num: s.id==='vera' ? l.target.num : l.attacker.num }))));
  const out = runBattleFlow(knockback({ state, fromId:'wildaxe', targetId:'vera', spaces:3, direction:l.angle }), state, { applyAction });
  state = out.state; const report = state.stageFx.lastAbyss;
  fallen = report?.hexNum; logs.push(`Vera is shoved into #${fallen}. −${report?.lost} FP (10%, rounded up). The shove ends immediately.`); render();
};
$('turn').onclick = () => { dispatch(turnStarted('vera')); fallen = null; logs.push('Vera’s own next turn: back at #105, full Vibe, ready to play.'); render(); };
$('reset').onclick = reset;
for (const key of Object.keys(defaults)) $(key).oninput = () => { prefs[key] = Number($(key).value); if (key==='seed') reset(); else render(); };
$('fame').onchange = reset;
$('copy').onclick = async () => {
  const data = { preview:'Crumbling Stage', settings:Object.fromEntries(Object.keys(defaults).map(k => [k,{ value:prefs[k], default:defaults[k], changed:prefs[k]!==defaults[k] }])), rules:{ fpLoss:'10%, rounded up', respawn:'next own turn, starting hex, full Vibe', holesPerRound:4, duration:3, lives:'unchanged' } };
  $('dial').value = JSON.stringify(data, null, 2); $('dial').select();
  try { await navigator.clipboard.writeText($('dial').value); $('copystatus').textContent='Copied — paste this into the chat.'; } catch { $('copystatus').textContent='Select and copy the text above.'; }
};
reset();

````````

## .scratch/crumbling-stage/preview.js

````````text
import { HEX_BY_NUM } from '../../src/board/hexMap.js';
import { straightNeighborInDirection } from '../../src/board/hexGeometry.js';
import { makeInitialState } from '../../src/engine/state.js';
import { applyAction } from '../../src/engine/reduce.js';
import { stageFxActivated, stageFxRoundTicked, turnStarted, spiritsSynced } from '../../src/engine/actions.js';
import { knockback, runBattleFlow } from '../../src/engine/systems/battleFlow.js';
import { createStage } from './stage.js';

const $=id=>document.getElementById(id);
const levers=[['rim','Abyss glow',0,100,1,'%'],['bloom','Bloom',0,120,5,'%'],['debris','Falling debris',0,100,5,'%'],['speed','Fall duration',300,2000,50,'ms'],['tilt','Camera tilt',0,45,1,'°'],['shake','Collapse shake',0,100,5,'%']];
const defaults={rim:75,bloom:55,debris:65,speed:950,tilt:22,shake:35,seed:31,numbers:false,motion:matchMedia('(prefers-reduced-motion: reduce)').matches};
const storageKey='rlsw-crumbling-stage-v2';
let prefs={...defaults};
try{
  const stored=JSON.parse(localStorage.getItem(storageKey)??localStorage.getItem('rlsw-crumbling-stage-v1')??'{}');
  for(const [key,,min,max]of levers)if(Number.isFinite(stored[key]))prefs[key]=Math.min(max,Math.max(min,stored[key]));
  if(Number.isFinite(stored.seed))prefs.seed=Math.min(99999,Math.max(1,Math.floor(stored.seed)));
  for(const key of ['numbers','motion'])if(typeof stored[key]==='boolean')prefs[key]=stored[key];
}catch{/* Private storage must not disable the preview. */}
$('levers').innerHTML=levers.map(([key,label,min,max,step])=>`<div class="lever"><label for="${key}">${label}<output id="${key}v"></output></label><input id="${key}" type="range" min="${min}" max="${max}" step="${step}"></div>`).join('');
let state,logs=[],stage=null,busy=false,busyTimer=0,cueTimer=0,loss=0;
function cue(text){clearTimeout(cueTimer);$('cue').textContent=text;$('cue').classList.add('visible');cueTimer=setTimeout(()=>$('cue').classList.remove('visible'),1900);}
function settle(){busy=false;render();}
function hold(ms){clearTimeout(busyTimer);busy=true;busyTimer=setTimeout(settle,ms);}
function dispatch(action){state=applyAction(state,action);}
function lane(){
  const holes=state.stageFx.crumbling?.hexes??[];
  for(const n of holes)for(const angle of [0,60,120,180,240,300]){
    const hole=HEX_BY_NUM[n],target=straightNeighborInDirection(hole,angle+180),attacker=target&&straightNeighborInDirection(target,angle+180);
    if(attacker&&target&&!holes.includes(target.num)&&!holes.includes(attacker.num))return{hole,target,attacker,angle};
  }return null;
}
function render(){
  try{localStorage.setItem(storageKey,JSON.stringify(prefs));}catch{/* Controls remain usable without storage. */}
  for(const [key,,, , ,unit]of levers){$(key).value=prefs[key];$(key+'v').textContent=`${prefs[key]}${unit}`;}
  $('seed').value=prefs.seed;for(const key of ['numbers','motion'])$(key).checked=prefs[key];
  const show=state.stageFx.crumbling,holes=show?.hexes??[],victim=state.spirits.find(s=>s.id==='vera');
  $('showtag').textContent=show?'CRUMBLING STAGE / ACTIVE':'INTACT STAGE';
  $('roundtag').textContent=show?`SHOW ROUND ${show.showRound} / 3 · ${show.roundsLeft} LEFT`:'111 HEXES / 4 PROTECTED HOMES';
  $('holes').textContent=String(holes.length).padStart(2,'0');$('fp').textContent=state.noteStates.vera.fame;
  $('loss').textContent=loss?`−${loss} FP on last fall`:'No FP lost';
  $('status').textContent=victim.abyssPending?'In the abyss':victim.num===105?'Home · hex 105':`On stage · hex ${victim.num}`;
  $('status').classList.toggle('pending',!!victim.abyssPending);
  $('vibe').textContent=victim.abyssPending?'Returns on own next turn':`Vibe ${victim.vibe}/${victim.maxVibe} · lives intact`;
  $('instruction').textContent=victim.abyssPending?'An empty spotlight. A way back next turn.':show?'The gaps stay open. Line up the shove.':'Open four traps. Find your next opening.';
  $('log').textContent=logs.slice(-2).join(' ');
  $('push').disabled=busy||!lane()||!!victim.abyssPending;$('turn').disabled=busy||!victim.abyssPending;$('round').disabled=busy||!holes.length;$('start').disabled=busy||!!show;
  stage?.configure(prefs);
}
function reset(){
  clearTimeout(busyTimer);clearTimeout(cueTimer);busy=false;loss=0;$('cue').classList.remove('visible');
  const fame=Math.min(999,Math.max(0,Math.floor(Number($('fame').value)||0)));$('fame').value=fame;
  state=makeInitialState({spirits:[{id:'wildaxe',name:'Wildaxe',num:7,corner:'blue',facing:0,vibe:10,maxVibe:10},{id:'vera',name:'Vera',num:105,corner:'red',facing:3,vibe:10,maxVibe:10}],mode:'ffa',startingLives:3},prefs.seed);
  state.noteStates.vera.fame=fame;logs=['The stage is intact. Crumble it to reveal the traps.'];stage?.sync(state,{kind:'reset'});render();
}
$('start').onclick=()=>{dispatch(stageFxActivated('crumbling_stage',[],3));hold(prefs.motion?100:1300);stage?.sync(state);logs.push('Four empty hexes fracture and fall away. Home hexes stay safe.');cue('THE FLOOR GIVES WAY');render();};
$('round').onclick=()=>{dispatch(stageFxRoundTicked());hold(prefs.motion?100:1300);stage?.sync(state);logs.push(state.stageFx.crumbling?'Four more hexes collapse. The earlier holes stay open.':'The show ends. The stage reforms; fallen Spirits still return on their own turns.');cue(state.stageFx.crumbling?'FOUR MORE FALL':'THE STAGE REFORMS');render();};
$('push').onclick=()=>{
  const l=lane();if(!l||busy)return;
  dispatch(spiritsSynced(state.spirits.map(s=>({...s,num:s.id==='vera'?l.target.num:l.attacker.num}))));
  state=runBattleFlow(knockback({state,fromId:'wildaxe',targetId:'vera',spaces:3,direction:l.angle}),state,{applyAction}).state;
  const report=state.stageFx.lastAbyss;loss=report?.lost??0;
  hold(450+prefs.speed+100);stage?.sync(state,{kind:'fall',from:l.target.num,to:report?.hexNum??l.hole.num});
  logs.push(`Vera is shoved into #${report?.hexNum}. −${loss} FP (10%, rounded up). The shove stops at the hole.`);cue(`INTO THE ABYSS / −${loss} FP`);render();
};
$('turn').onclick=()=>{dispatch(turnStarted('vera'));hold(850);stage?.sync(state,{kind:'return'});logs.push('Vera’s own turn: back at #105 with full Vibe. No life lost.');cue('BACK FOR THE ENCORE');render();};
$('reset').onclick=reset;$('fame').onchange=reset;
for(const [key]of levers)$(key).oninput=()=>{prefs[key]=Number($(key).value);render();};
$('seed').onchange=()=>{prefs.seed=Math.min(99999,Math.max(1,Math.floor(Number($('seed').value)||31)));reset();};
for(const key of ['numbers','motion'])$(key).onchange=()=>{prefs[key]=$(key).checked;render();};
$('defaults').onclick=()=>{prefs={...defaults,seed:prefs.seed};render();};
for(const id of ['wide','close','top'])$(id).onclick=()=>{stage?.setView(id);for(const other of ['wide','close','top'])$(other).classList.toggle('active',other===id);};
$('copy').onclick=async()=>{
  const data={preview:'Crumbling Stage / 3D',settings:Object.fromEntries(Object.keys(defaults).map(k=>[k,{value:prefs[k],default:defaults[k],changed:prefs[k]!==defaults[k]}])),rules:{fpLoss:'10%, rounded up',respawn:'next own turn, home hex, full Vibe',holesPerRound:4,duration:3,lives:'unchanged'}};
  $('dial').classList.add('revealed');$('dial').value=JSON.stringify(data,null,2);$('dial').select();
  try{await navigator.clipboard.writeText($('dial').value);$('copystatus').textContent='Copied. Paste these settings into the chat.';}catch{$('copystatus').textContent='Settings selected. Press Ctrl+C to copy.';}
};
reset();
try{stage=createStage($('board'),prefs,settle);stage.sync(state);render();}
catch(error){console.error(error);$('board').innerHTML='<div class="error">The 3D stage needs WebGL.<br><a href="./original.html">Open the original 2D study ↗</a></div>';}
window.addEventListener('pagehide',()=>{stage?.dispose();clearTimeout(busyTimer);clearTimeout(cueTimer);});

````````

## .scratch/crumbling-stage/README.md

````````text
# Crumbling Stage — graphics study

Open `/RLSW/.scratch/crumbling-stage/index.html` on the local Vite server.
Start it from the repository root with `node node_modules/vite/bin/vite.js --host 127.0.0.1`.

The original 2D study is preserved at `original.html` (linked from the page).
This is a preview-only graphics pass; the live client and game rules were not edited.

## What is here

- `preview.js`: original real-engine scenario, controls, validation, persistence, and dial-in export.
- `stage.js`: persistent Three.js scene, stone-and-metal slabs, fractured collars and deep shafts,
  procedural nebula, falling rubble and motes, acrylic standees, shove/fall/return choreography,
  three camera presets, orbit/zoom, bloom, reduced motion, and resource cleanup.
- `style.css`: desktop lab layout with a stacked arrangement for narrow desktop preview panes.

The preview uses the shipped standee renderer and existing Ronin/Monster artwork to represent
its original Wildaxe/Vera test fixtures. It uses the existing hex map and reducers for all rules.
All new environment art is procedural and local; only the optional Google Fonts stylesheet
requires a network request, with system-font fallbacks.

Visual controls save in `rlsw-crumbling-stage-v2`, migrating the prior preview's numerical
settings when available. Copy dial-in shows selectable JSON first and marks each setting's
changed/default status. Changing seed or starting Fame resets the scenario. Reset preserves
art direction; Restore look preserves the pattern seed.

## Verification — 2026-10-03

- Preview JavaScript syntax and in-memory bundle: passed, zero bundler warnings.
- Crumbling engine suite: 344 assertions passed.
- Browser: WebGL renders, no console errors/warnings; 4 → 8 → 12 → 0 holes; push changes
  Fame 23 → 20 and removes the rival; next own turn returns it to #105 at 10/10 Vibe.
- Browser: camera presets, settings export (changed glow marked true), and reload persistence.
- Full repository suite passes vocab (640), cards (441), card journey (14), marquee markers (50),
  marquee journey (14), then stops at the existing `src/engine/selftest.mjs:457` assertion
  `atkTotal = stat + roll` (actual 4, expected 11), also recorded in STATE_OF_PLAY.md.

Use Crumble stage, Hazard close-up, then Push rival into abyss to inspect the choreography.
The art is ready for dialing in; porting this renderer into the live arena is a separate step.

````````

## .scratch/crumbling-stage/stage.js

````````text
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ALL_HEXES, HEX_BY_NUM } from '../../src/board/hexMap.js';
import { createStandee, STANDEE } from '../../src/board/standee.js';
import { SPIRIT_DEFS } from '../../src/data/spirits.js';

const clamp = THREE.MathUtils.clamp;
const world = n => { const h = HEX_BY_NUM[n]; return new THREE.Vector3((h.px-3255)/200, .2, (h.py-2415)/200); };
const hash = n => { const v = Math.sin(n*127.1+311.7)*43758.5453; return v-Math.floor(v); };
const homes = new Map([[7,0x75cfff],[12,0xc599ff],[100,0xe7d784],[105,0xff9569]]);
function shape(r, seed=0, jagged=false) {
  const s = new THREE.Shape();
  for(let i=0;i<6;i++) { const a=i*Math.PI/3, rr=r*(jagged ? .88+hash(seed+i)*.17 : 1); s[i?'lineTo':'moveTo'](Math.cos(a)*rr,Math.sin(a)*rr); }
  s.closePath(); return s;
}
function lineHex(r,y,color,opacity=1) {
  const pts=Array.from({length:7},(_,i)=>new THREE.Vector3(Math.cos(i*Math.PI/3)*r,y,Math.sin(i*Math.PI/3)*r));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color,transparent:true,opacity,toneMapped:false}));
}
export function createStage(host, prefs, onSettled) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6)); renderer.setClearColor(0x080b14,0);
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(); scene.fog=new THREE.FogExp2(0x080b14,.015);
  const camera=new THREE.PerspectiveCamera(39,1,.1,180);
  const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.minDistance=7;controls.maxDistance=65;controls.maxPolarAngle=Math.PI*.48;controls.target.set(0,-.3,0);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.55,.6,.85);composer.addPass(bloom);composer.addPass(new OutputPass());
  scene.add(new THREE.HemisphereLight(0xb7cce9,0x24102f,2.1));
  const key=new THREE.DirectionalLight(0xd6eeff,3);key.position.set(-8,18,10);scene.add(key);
  const rimLight=new THREE.DirectionalLight(0xad79ff,2.5);rimLight.position.set(5,2,-12);scene.add(rimLight);
  const under=new THREE.PointLight(0x934cff,70,35,2);under.position.set(0,-5,0);scene.add(under);
  const root=new THREE.Group();scene.add(root);
  // A sky dome adds depth without a downloaded backdrop or a screen-space overlay.
  const sky=new THREE.Mesh(new THREE.SphereGeometry(78,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec3 vP;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 p=normalize(vP);float n=noise(p*5.)*.55+noise(p*13.)*.3+noise(p*31.)*.15;float band=exp(-pow((p.y+.17+p.x*.23)*4.,2.));vec3 col=vec3(.014,.022,.043)+mix(vec3(.025,.09,.14),vec3(.19,.065,.24),smoothstep(-.8,.8,p.x))*pow(n,2.)*band;gl_FragColor=vec4(col,1.);}`,
    toneMapped:false}));scene.add(sky);
  const mistCanvas=document.createElement('canvas');mistCanvas.width=mistCanvas.height=256;
  const mc=mistCanvas.getContext('2d'),mg=mc.createRadialGradient(128,128,8,128,128,128);mg.addColorStop(0,'#7a30b988');mg.addColorStop(.42,'#773bd54d');mg.addColorStop(.72,'#3e328529');mg.addColorStop(1,'#281d5500');mc.fillStyle=mg;mc.fillRect(0,0,256,256);
  const mist=new THREE.Mesh(new THREE.PlaneGeometry(44,44).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(mistCanvas),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));mist.position.y=-4.8;scene.add(mist);
  // Procedural stone grain stays local and repeats at the physical tile scale.
  const texCanvas=document.createElement('canvas');texCanvas.width=texCanvas.height=128;const ctx=texCanvas.getContext('2d');
  ctx.fillStyle='#7e8796';ctx.fillRect(0,0,128,128);
  for(let i=0;i<5000;i++){const v=90+hash(i+16)*85;ctx.fillStyle=`rgba(${v},${v},${v},.23)`;ctx.fillRect(hash(i)*128,hash(i+9)*128,1+hash(i+2)*3,1);}
  const stone=new THREE.CanvasTexture(texCanvas);stone.colorSpace=THREE.SRGBColorSpace;stone.wrapS=stone.wrapT=THREE.RepeatWrapping;
  const rockMat=new THREE.MeshStandardMaterial({color:0x293341,roughness:.91,flatShading:true});
  const slabGeo=new THREE.ExtrudeGeometry(shape(1.065),{depth:.62,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.045,bevelThickness:.035}).rotateX(-Math.PI/2);
  const tiles=new Map(), bursts=[], pits=new Map();
  // One atlas for all tile labels, so enabling the map does not allocate 111 textures.
  const atlas=document.createElement('canvas');atlas.width=atlas.height=1024;const ac=atlas.getContext('2d');ac.font='500 35px monospace';ac.textAlign='center';ac.textBaseline='middle';ac.fillStyle='#a8bfd0';
  ALL_HEXES.forEach((h,i)=>ac.fillText(h.num,(i%12)*80+40,Math.floor(i/12)*80+40));
  const numberTexture=new THREE.CanvasTexture(atlas);numberTexture.colorSpace=THREE.SRGBColorSpace;
  const numberMat=new THREE.MeshBasicMaterial({map:numberTexture,transparent:true,depthWrite:false,opacity:.7});
  ALL_HEXES.forEach((h,i)=>{
    const p=world(h.num), g=new THREE.Group();g.position.set(p.x,0,p.z);root.add(g);
    const mat=new THREE.MeshStandardMaterial({color:homes.get(h.num)??new THREE.Color().setHSL(.60,.12,.22+hash(h.num)*.055),map:stone,bumpMap:stone,bumpScale:.055,metalness:.48,roughness:.62});
    if(homes.has(h.num)){mat.color.multiplyScalar(.45);mat.emissive=new THREE.Color(homes.get(h.num));mat.emissiveIntensity=.08;}
    const slab=new THREE.Mesh(slabGeo,mat);slab.position.y=-.48;g.add(slab);
    const border=lineHex(1.064,.185,homes.get(h.num)??0x536b85,homes.has(h.num)?1:.62);g.add(border);
    const inset=lineHex(.88,.192,homes.get(h.num)??0x456078,homes.has(h.num)?.6:.18);g.add(inset);
    const seams=[];
    for(let j=0;j<3;j++){const a=j*Math.PI*2/3,r=.99;seams.push(new THREE.Vector3(Math.cos(a)*r,.2,Math.sin(a)*r),new THREE.Vector3(Math.cos(a)*.89,.2,Math.sin(a)*.89));}
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seams),new THREE.LineBasicMaterial({color:0xa8bdc9,transparent:true,opacity:.32})));
    const rock=new THREE.Mesh(new THREE.ConeGeometry(.99,1.2+hash(h.num)*1.7,6,1),rockMat);rock.rotation.z=Math.PI;rock.rotation.y=Math.PI/6;rock.position.y=-1.1;g.add(rock);
    const ng=new THREE.PlaneGeometry(.55,.55).rotateX(-Math.PI/2),uv=ng.attributes.uv;
    for(let j=0;j<uv.count;j++)uv.setXY(j,((i%12)*80+uv.getX(j)*80)/1024,1-(Math.floor(i/12)*80+(1-uv.getY(j))*80)/1024);
    const number=new THREE.Mesh(ng,numberMat);number.position.y=.199;g.add(number);
    if(homes.has(h.num)){
      const beacon=new THREE.Mesh(new THREE.RingGeometry(.53,.58,6).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:homes.get(h.num),toneMapped:false,transparent:true,opacity:.7}));beacon.position.y=.21;g.add(beacon);
    }
    tiles.set(h.num,{g,number,slab,mat,base:mat.color.clone(),born:-99,open:false});
  });
  const starGeo=new THREE.BufferGeometry(),stars=[];
  for(let i=0;i<550;i++)stars.push((hash(i+21)-.5)*110,(hash(i+81)-.45)*65,(hash(i+111)-.5)*110);
  starGeo.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
  scene.add(new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x9cacd2,size:.06,transparent:true,opacity:.55,sizeAttenuation:true})));
  const floaters=[];
  for(let i=0;i<24;i++){
    const a=i*2.4,r=15+hash(i)*11,s=.18+hash(i+10)*.7;
    const m=new THREE.Mesh(new THREE.IcosahedronGeometry(s,0),rockMat);m.position.set(Math.cos(a)*r,-3-hash(i+60)*7,Math.sin(a)*r);m.rotation.set(i,i*.7,i*.3);scene.add(m);floaters.push({m,y:m.position.y});
  }
  const actors=new Map();
  for(const [id,art,color] of [['wildaxe','cosmic_ronin','#73ccff'],['vera','Metalness_Monster','#ff966c']]){
    const st=createStandee({...SPIRIT_DEFS[art],color},{T:{...STANDEE,height:2.8}});scene.add(st.group);actors.set(id,st);
  }
  let settings=prefs, current=null, action=null, view='wide', aim=null, disposed=false,last=performance.now()/1000, clock=0, shake=0;
  const getFocus=()=>world(current?.stageFx?.lastAbyss?.hexNum??current?.stageFx?.crumbling?.hexes?.[0]??56);
  function setView(kind,snap=false){
    view=kind;const target=kind==='close'?getFocus():new THREE.Vector3(0,-.5,0);
    const distance=kind==='close'?Math.max(11,5/(Math.tan(camera.fov*Math.PI/360)*camera.aspect)):Math.max(36,13/(Math.tan(camera.fov*Math.PI/360)*camera.aspect)),angle=kind==='top'?1.49:THREE.MathUtils.degToRad(64-settings.tilt);
    const pos=target.clone().add(new THREE.Vector3(distance*.13,Math.sin(angle)*distance,Math.cos(angle)*distance));
    aim={pos,target};if(snap||settings.motion){camera.position.copy(pos);controls.target.copy(target);aim=null;}controls.update();
  }
  controls.addEventListener('start',()=>{aim=null;});
  function pit(n){
    const g=new THREE.Group(),p=world(n);g.position.set(p.x,0,p.z);root.add(g);
    // Jagged stone collar surrounds an actual empty shaft; nothing caps the opening.
    const collar=shape(1.105,n,true),cut=shape(.77,n+50,true);collar.holes.push(new THREE.Path(cut.getPoints()));
    const collarMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(collar,{depth:.38,bevelEnabled:false}).rotateX(-Math.PI/2),rockMat);collarMesh.position.y=-.23;g.add(collarMesh);
    const glow=new THREE.LineBasicMaterial({color:new THREE.Color(1.7,.7,3),toneMapped:false,transparent:true,opacity:.85});
    const rims=[];
    for(let j=0;j<4;j++){const l=lineHex(.84-j*.07,-j*.63,0xb887ff,.7-j*.14);g.add(l);rims.push(l);}
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.85,.55,4.6,6,1,true),new THREE.ShaderMaterial({side:THREE.DoubleSide,
      vertexShader:`varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec3 vP;void main(){float d=clamp((vP.y+2.3)/4.6,0.,1.);float veins=pow(.5+.5*sin(atan(vP.z,vP.x)*21.+vP.y*2.),12.);vec3 col=mix(vec3(.002,.001,.006),vec3(.045,.014,.085),d*d)+vec3(.10,.025,.2)*veins*d*d;gl_FragColor=vec4(col,1.);}`,
      toneMapped:false}));shaft.rotation.y=Math.PI/6;shaft.position.y=-2.4;g.add(shaft);
    const black=new THREE.Mesh(new THREE.CircleGeometry(.6,6).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x020106}));black.position.y=-4.7;g.add(black);
    const cracks=[];
    for(let i=0;i<6;i++){
      const a=i*Math.PI/3+.1,pts=[new THREE.Vector3(Math.cos(a)*.76,.205,Math.sin(a)*.76),new THREE.Vector3(Math.cos(a+.07)*.94,.213,Math.sin(a+.07)*.94),new THREE.Vector3(Math.cos(a-.1)*1.06,.212,Math.sin(a-.1)*1.06)];
      const crack=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),glow);g.add(crack);cracks.push(crack);
    }
    // Broken facets interrupt the collar silhouette so it reads as torn rock.
    for(let j=0;j<9;j++){const a=j*Math.PI*2/9,shard=new THREE.Mesh(new THREE.TetrahedronGeometry(.13+hash(n+j)*.13),rockMat);shard.position.set(Math.cos(a)*.9,.11,Math.sin(a)*.9);shard.rotation.set(j,n,j*.7);g.add(shard);}
    const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(60),3));
    const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:new THREE.Color(1.4,.7,2.6),size:.045,transparent:true,opacity:.8,depthWrite:false,toneMapped:false}));g.add(dust);
    pits.set(n,{g,rims,glow,dust,born:clock});
  }
  const chunkGeo=new THREE.IcosahedronGeometry(.14,0);
  const chunkMat=new THREE.MeshStandardMaterial({color:0x7a6b94,roughness:.9,flatShading:true});
  function burst(n,count=20){
    const p=world(n);
    for(let i=0;i<count;i++){
      const m=new THREE.Mesh(chunkGeo,chunkMat),a=hash(i+n)*Math.PI*2,r=.45+hash(i+n+9)*.45;m.position.copy(p).add(new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r));m.scale.set(.5+hash(i)*1.4,.4+hash(i+7)*1.8,.7);scene.add(m);
      bursts.push({m,origin:m.position.clone(),vx:Math.cos(a)*(.2+hash(i+21)*.5),vz:Math.sin(a)*(.2+hash(i+21)*.5),start:clock+hash(i+n)*.16,life:1.4+hash(i)*.7});
    }
  }
  function removePit(p){root.remove(p.g);p.g.traverse(o=>{o.geometry?.dispose();if(o.material&&o.material!==rockMat){o.material.dispose();}});}
  function sync(state,event={}){
    current=state;
    const holes=new Set(state.stageFx.crumbling?.hexes??[]);
    if(event.kind==='reset'){action=null;for(const b of bursts)scene.remove(b.m);bursts.length=0;shake=0;}
    for(const [n,t]of tiles){
      const open=holes.has(n);
      if(open&&!t.open){pit(n);t.born=clock;if(!settings.motion)burst(n,Math.round(settings.debris*.32));shake=settings.motion?0:settings.shake*.02;}
      if(!open&&pits.has(n)){removePit(pits.get(n));pits.delete(n);}
      t.open=open;t.g.position.y=0;t.g.rotation.set(0,0,0);t.g.scale.setScalar(1);t.g.visible=!open||(!settings.motion&&clock-t.born<1.2);
    }
    for(const s of state.spirits){const st=actors.get(s.id);st.group.visible=Number.isFinite(s.num);if(st.group.visible){st.group.position.copy(world(s.num));st.group.rotation.set(0,.12,0);st.group.scale.setScalar(1);}}
    if(event.kind==='fall'){
      const st=actors.get('vera');st.group.visible=true;action={kind:'fall',start:clock,from:world(event.from),to:world(event.to),duration:.45+settings.speed/1000};
      if(!settings.motion)burst(event.to,Math.round(settings.debris*.45));
    }
    if(event.kind==='return')action={kind:'return',start:clock,to:world(state.spirits.find(s=>s.id==='vera').num),duration:.8};
    if(view==='close')setView('close');
  }
  function configure(p){const old=settings;settings={...p};bloom.strength=p.bloom/100;for(const t of tiles.values())t.number.visible=p.numbers;if(old.tilt!==p.tilt)setView(view);}
  function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();if(view==='wide')setView(view);}
  const observer=new ResizeObserver(resize);observer.observe(host);setView('wide',true);configure(prefs);
  function frame(now){
    if(disposed)return;const dt=Math.min(.05,now/1000-last);last=now/1000;if(!document.hidden)clock+=dt;
    if(aim){const k=settings.motion?1:1-Math.exp(-dt*5);camera.position.lerp(aim.pos,k);controls.target.lerp(aim.target,k);if(camera.position.distanceTo(aim.pos)<.01)aim=null;}
    controls.update();
    for(const t of tiles.values())if(t.open){const age=clock-t.born;t.g.visible=!settings.motion&&age<1.2;if(t.g.visible){const k=clamp((age-.15)/1,0,1);t.g.position.y=-6*k*k;t.g.rotation.x=k*.4;t.g.rotation.z=k*.3;t.g.scale.setScalar(1-k*.65);}}
    for(const p of pits.values()){const pulse=settings.motion?1:.92+.08*Math.sin(clock*2.7+p.born);p.rims.forEach((l,i)=>{l.material.opacity=(settings.rim/100)*(.95-i*.18)*pulse;l.material.color.setRGB(1.4,.65,2.8);});p.glow.opacity=settings.rim/100;
      const pos=p.dust.geometry.attributes.position,t=settings.motion?0:clock;
      for(let i=0;i<20;i++){const a=i*2.399+t*.3,r=.35+hash(i)*.28;pos.setXYZ(i,Math.cos(a)*r,.65-((i*.23+t*.55)%4),Math.sin(a)*r);}pos.needsUpdate=true;p.dust.visible=settings.debris>0;p.dust.material.opacity=settings.debris/100;
    }
    for(let i=bursts.length-1;i>=0;i--){const b=bursts[i],t=clock-b.start;if(t>b.life||settings.motion){scene.remove(b.m);bursts.splice(i,1);continue;}b.m.visible=t>=0;if(t>=0){b.m.position.copy(b.origin).add(new THREE.Vector3(b.vx*t,.4*t-4.5*t*t,b.vz*t));b.m.rotation.set(t*2,t*3,t);b.m.scale.setScalar(Math.max(.02,1-t/b.life));}}
    for(const f of floaters){f.m.position.y=f.y+(settings.motion?0:Math.sin(clock*.3+f.y)*.22);}
    for(const st of actors.values())st.frame(clock,{cameraPos:camera.position,reduced:settings.motion});
    if(action){
      const a=action,age=clock-a.start,t=clamp(age/a.duration,0,1),st=actors.get('vera');st.group.visible=true;
      if(a.kind==='fall'){
        const move=clamp(age/.45,0,1);st.group.position.copy(a.from).lerp(a.to,move*move*(3-2*move));
        const fall=clamp((age-.45)/(a.duration-.45),0,1);
        st.group.position.y=.2-8*fall*fall;st.group.scale.setScalar(1-fall*.87);st.group.rotation.set(fall*.7,.12+fall*3,fall*.6);
        if(settings.motion)st.group.visible=false;
      }else{st.group.position.copy(a.to);st.group.position.y+=settings.motion?0:(1-t)*3;st.group.scale.setScalar(settings.motion?1:.4+.6*t);st.group.rotation.set(0,.12,0);}
      if(t>=1){st.group.visible=a.kind==='return';st.group.scale.setScalar(1);st.group.rotation.set(0,.12,0);action=null;onSettled?.();}
    }
    const dx=settings.motion?0:Math.sin(clock*77)*shake;camera.position.x+=dx;composer.render();camera.position.x-=dx;shake*=Math.exp(-dt*5);
  }
  renderer.setAnimationLoop(frame);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);host.insertAdjacentHTML('beforeend','<div class="error">The graphics context was interrupted.<br>Reload this page to restore the stage.</div>');});
  return {sync,configure,setView,dispose(){disposed=true;renderer.setAnimationLoop(null);observer.disconnect();controls.dispose();const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of(o.material?(Array.isArray(o.material)?o.material:[o.material]):[])){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());composer.dispose();renderer.dispose();}};
}

````````

## .scratch/crumbling-stage/style.css

````````text
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700&display=swap');
:root{color-scheme:dark;font-family:Barlow,"Segoe UI",sans-serif;color:#e7ecee;background:#090c12;--lime:#daff89;--line:#29313a}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 74% 10%,#201b2a55,transparent 55%),#090c12}main{max-width:1660px;margin:auto;padding:0 42px}header{height:91px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}.brand{color:inherit;text-decoration:none;display:flex;align-items:center;gap:14px;font-weight:700;letter-spacing:2px;font-size:14px}.brand small{display:block;color:#88929e;font-size:8px;letter-spacing:2px;margin-top:6px}.brand-mark{font-size:25px;font-style:italic;letter-spacing:-5px;border:1px solid #a8be7b;width:49px;height:43px;padding:4px;color:var(--lime);transform:skew(-6deg)}.edition,.eyebrow,footer,.preview-badge,.stage-top,.viewbar,.stats>div>span{font-family:Consolas,monospace;font-size:10px;letter-spacing:1.6px}.edition{color:#acb4ba}.dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--lime);margin-right:10px;box-shadow:0 0 12px #daff8955}.intro{display:flex;justify-content:space-between;align-items:center;padding:34px 0 29px}.eyebrow{color:#a1b086;font-size:9px}h1{font-family:"Barlow Condensed","Arial Narrow",Impact,sans-serif;font-size:clamp(48px,4.5vw,74px);line-height:1;margin:11px 0 14px;font-weight:700;letter-spacing:-1px;text-transform:uppercase}h1 em{color:var(--lime);font-style:normal}.intro p{color:#9ca7b1;font-size:14px;margin:0}.preview-badge{text-align:right;color:#ccd1d6;line-height:2}.preview-badge span{display:block;color:#707f8c;font-size:9px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:22px;align-items:start}.arena{background:#080b13;border:1px solid #303a45;position:relative;overflow:hidden;border-radius:4px}.stage-top{position:absolute;top:22px;left:23px;right:23px;display:flex;justify-content:space-between;gap:20px;color:#bac7cf;z-index:2;pointer-events:none;font-size:9px}.stage-top>span{color:#788391;font-size:8px}.board{height:clamp(455px,43vw,665px);width:100%;position:relative;background:radial-gradient(ellipse at 50% 40%,#18162c,#070b13 72%)}.board canvas{display:block;width:100%;height:100%;outline:none;touch-action:none}.board:focus-visible{outline:1px solid var(--lime);outline-offset:-2px}.viewbar{position:absolute;top:calc(clamp(455px,43vw,665px) - 44px);left:23px;right:23px;display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:8px;color:#758390}.buttons{display:flex;gap:3px}button{font:500 12px Barlow,"Segoe UI",sans-serif;border:1px solid #36424e;background:#18212b;color:#dce5eb;padding:12px 16px;border-radius:3px;cursor:pointer;transition:background .15s,border-color .15s,opacity .15s}button:hover:not(:disabled){background:#26343d;border-color:#72808d}button:focus-visible,input:focus-visible,textarea:focus-visible,a:focus-visible{outline:2px solid var(--lime);outline-offset:3px}button:disabled{opacity:.3;cursor:not-allowed}.view{font-size:10px;padding:7px 10px;background:#0d141dcc}.view.active{border-color:#869d60;color:var(--lime);background:#29312866}.primary{background:var(--lime);border-color:var(--lime);color:#192510;font-weight:700;white-space:nowrap}.primary:hover:not(:disabled){background:#ecffbd;color:#1d2b12;border-color:#ecffbd}.transport{padding:22px 23px;border-top:1px solid #25303b;display:flex;align-items:center;gap:9px;background:#101720}.transport>div{margin-right:auto}.transport p{font-size:12px;color:#a9b4bb;margin:7px 0 0}.transport .eyebrow{font-size:8px}.stats{border-top:1px solid #27313a;display:grid;grid-template-columns:1fr 1fr 1.6fr;background:#111820;padding:22px 0}.stats>div{padding:0 24px;border-right:1px solid #2b343b}.stats>div:last-child{border:0}.stats>div>span{color:#8e9ba7;font-size:8px;display:block}.stats strong{font:500 37px "Barlow Condensed",sans-serif;display:block;margin:6px 0 2px;line-height:1.1}.stats small{color:#788c99;font-size:10px}.stats .spirit-state strong{font:600 16px Barlow,sans-serif;margin:15px 0 9px}.stats .spirit-state strong.pending{color:#c6a8ff}.card{background:#121820;border:1px solid #2c343e;border-radius:4px;padding:21px;margin-bottom:16px}.card-title{display:flex;justify-content:space-between;align-items:center}.card-title span{font:10px Consolas,monospace;color:#6e7b87}h2{font-size:15px;font-weight:600;margin:0}.card>p{font-size:12px;color:#8b9ba6;margin:10px 0 18px}.action-stack{display:grid;gap:8px}.action-stack button:first-child{color:#d2bcff;border-color:#514565;background:#282136}.setup{display:flex;align-items:center;gap:10px;margin:18px 0;font-size:11px;color:#9dabb5}.setup label{margin-right:auto}input[type=number]{width:56px;background:#0d131a;color:#ced9e0;border:1px solid #35424c;border-radius:3px;padding:6px;font:11px Consolas,monospace}.quiet{border:0;background:transparent;padding:7px 2px;color:#92a0ac;font-size:11px}.rules{border-top:1px solid var(--line);padding-top:15px;display:grid;gap:13px}.rules>div{display:flex;gap:12px;align-items:center}.rules b{color:#b6c497;font:11px Consolas,monospace;width:55px;flex-shrink:0}.rules span{font-size:10px;color:#8d9ba6;line-height:1.5}.lever{margin-top:18px}.lever label{display:flex;justify-content:space-between;font-size:11px;color:#b2bdc6}.lever output{color:#c7b4ed;font:10px Consolas,monospace}input[type=range]{width:100%;accent-color:#b1c887;height:4px;margin:12px 0 3px;cursor:pointer}.toggles{display:flex;justify-content:space-between;gap:8px;margin-top:21px;font-size:10px;color:#9fadb7}.toggles label{display:flex;gap:4px;align-items:center}input[type=checkbox]{accent-color:var(--lime);margin:0}.seed-label{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#aebbc3;margin-top:18px}.handoff{display:flex;gap:14px;margin-top:19px;padding-top:16px;border-top:1px solid var(--line)}.handoff>button:first-child{flex:1;font-size:11px;padding:10px}textarea{display:none;width:100%;height:96px;background:#080e15;color:#b7c8d3;border:1px solid #3a4755;font:10px Consolas,monospace;padding:8px;margin-top:12px}textarea.revealed{display:block}#copystatus{display:block;font-size:9px;color:#758692;line-height:1.6;margin-top:12px}.eventlog{display:flex;align-items:center;gap:24px;padding:19px 0;border-bottom:1px solid var(--line)}.eventlog .eyebrow{white-space:nowrap;color:#7f918a}.eventlog p{font-size:12px;color:#9daeb9;flex:1;line-height:1.6;margin:0}.eventlog a{font-size:11px;color:#9fb686;white-space:nowrap;text-decoration:none}footer{display:flex;justify-content:space-between;padding:21px 0 30px;color:#546570;font-size:8px}.cue{position:absolute;left:50%;top:19%;transform:translate(-50%,8px);text-align:center;pointer-events:none;opacity:0;transition:opacity .25s,transform .25s;color:#e2d6ff;font:700 33px "Barlow Condensed",sans-serif;letter-spacing:2px;text-shadow:0 2px 20px #080313}.cue.visible{opacity:1;transform:translate(-50%,0)}.error{position:absolute;inset:20%;display:grid;place-content:center;text-align:center;color:#b6c4d1;line-height:1.7;font-size:14px}.error a{color:var(--lime)}@media(max-width:1150px){main{padding:0 24px}.layout{grid-template-columns:minmax(0,1fr) 270px;gap:16px}.card{padding:17px}.transport{flex-wrap:wrap}.transport>div{width:100%;margin-bottom:6px}.stage-top>span,.viewbar>span{display:none}.viewbar{justify-content:flex-end}.stats>div{padding:0 16px}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
/* A narrow desktop preview pane stacks the controls below the stage. */
@media(max-width:900px){.layout{grid-template-columns:1fr}.intro{gap:15px}.preview-badge{display:none}h1{font-size:54px}.board{height:480px}.viewbar{top:436px}.transport>div{width:100%}.transport{padding:19px 16px}.stats>div{padding:0 12px}.stats{grid-template-columns:.8fr .8fr 1.4fr}.stats .spirit-state strong{font-size:13px}.eventlog{flex-wrap:wrap;gap:10px}.eventlog p{flex-basis:100%}.edition{font-size:8px;letter-spacing:1px}.brand{font-size:11px;gap:10px}.brand small{font-size:6px}footer{gap:20px;line-height:1.8}aside{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{margin:0}.intro p{line-height:1.6}}@media(max-width:620px){aside{grid-template-columns:1fr}.brand-mark{display:none}.intro{padding-top:26px}.eyebrow{letter-spacing:1px;font-size:8px}.view{padding:7px 9px}.stats small{font-size:9px}}

````````

## src/board/batStage.js

````````text
import * as THREE from 'three';

// A tiny stage prop built from geometry: scalloped wings, ears and ruby eyes.
export function createBatStage(parent, { pointFor, release }) {
  const root = new THREE.Group(); root.name = 'Stage bats'; parent.add(root);
  const live = new Map();
  let clock = 0;
  function model(key) {
    const container = new THREE.Group(); container.name = `${key}-prop`;
    const group = new THREE.Group(); group.name = key;
    const marker = new THREE.Group(); marker.name = `${key}-hex`;
    const rim = new THREE.Mesh(new THREE.RingGeometry(.82, .94, 6),
      new THREE.MeshBasicMaterial({ color: 0xd9b5ff, side: THREE.DoubleSide, depthWrite: false }));
    rim.rotation.x = -Math.PI / 2; marker.add(rim);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(.82, 6),
      new THREE.MeshBasicMaterial({ color: 0x9b55ed, transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide }));
    fill.rotation.x = -Math.PI / 2; fill.position.y = -.005; marker.add(fill);
    const dot = new THREE.Mesh(new THREE.RingGeometry(.11, .17, 20),
      new THREE.MeshBasicMaterial({ color: 0xf4ddff, side: THREE.DoubleSide, depthWrite: false }));
    dot.rotation.x = -Math.PI / 2; dot.position.y = .005; marker.add(dot);
    const tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({ color: 0xd9b5ff, transparent: true, opacity: .65,
        dashSize: .12, gapSize: .1, depthWrite: false }));
    tether.name = `${key}-tether`;
    container.add(marker, tether, group); root.add(container);
    const skin = new THREE.MeshStandardMaterial({ color: 0x201329, roughness: .65,
      emissive: 0x6b2a99, emissiveIntensity: .35, side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 8), skin);
    body.scale.set(1, 1.5, .7); group.add(body);
    const wings = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.x = side * .1;
      const shape = new THREE.Shape();
      shape.moveTo(0, .1); shape.quadraticCurveTo(.42, .48, .95, .18);
      shape.lineTo(.78, -.18); shape.quadraticCurveTo(.55, .02, .52, -.3);
      shape.quadraticCurveTo(.3, -.08, .25, -.34); shape.lineTo(0, -.08);
      const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), skin); wing.scale.x = side;
      pivot.add(wing); group.add(pivot); wings.push({ pivot, side });
      const ear = new THREE.Mesh(new THREE.ConeGeometry(.08, .25, 3), skin);
      ear.position.set(side * .105, .3, 0); ear.rotation.z = -side * .22; group.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xff445c }));
      eye.position.set(side * .07, .12, .13); group.add(eye);
    }
    return { container, marker, tether, group, wings, from: new THREE.Vector3(), to: new THREE.Vector3(), start: clock, flight: -1 };
  }
  return {
    update(bats = []) {
      const keys = new Set(bats.map(b => b.key));
      for (const [key, b] of live) if (!keys.has(key)) { root.remove(b.container); release(b.container); live.delete(key); }
      for (const bat of bats) {
        const p = pointFor(bat.num, 1.9); if (!p) continue;
        let b = live.get(bat.key);
        if (!b) { b = model(bat.key); live.set(bat.key, b); b.group.position.copy(p); b.to.copy(p); }
        // This marker follows the RULE hex immediately, even while the bat
        // itself is still flying there. It never bobs or drifts with the prop.
        b.marker.position.copy(pointFor(bat.num, .24));
        b.marker.userData.hexNum = bat.num;
        if (b.flight !== bat.flight || !b.to.equals(p)) {
          b.from.copy(b.group.position); b.to.copy(p); b.start = clock; b.flight = bat.flight;
        }
      }
    },
    tick(time, { reduced = false } = {}) {
      clock = time;
      let index = 0;
      for (const b of live.values()) {
        const phase = time * 15 + index++ * 1.7;
        const u = reduced ? 1 : Math.min(1, Math.max(0, (time - b.start) / 1.2));
        b.group.position.lerpVectors(b.from, b.to, u * u * (3 - 2 * u));
        if (!reduced) b.group.position.y += Math.sin(u * Math.PI) * .65 + Math.sin(phase * .3) * .09;
        for (const { pivot, side } of b.wings) pivot.rotation.y = reduced ? side * .15 : Math.sin(phase) * side * .7;
        b.group.rotation.z = reduced ? 0 : Math.sin(phase * .24) * .08;
        const endpoints = b.tether.geometry.attributes.position;
        endpoints.setXYZ(0, b.marker.position.x, b.marker.position.y, b.marker.position.z);
        endpoints.setXYZ(1, b.group.position.x, b.group.position.y, b.group.position.z);
        endpoints.needsUpdate = true;
        b.tether.geometry.computeBoundingSphere();
        b.tether.computeLineDistances();
      }
    },
    get count() { return live.size; },
    dispose() { for (const b of live.values()) release(b.container); live.clear(); parent.remove(root); },
  };
}

````````

## src/board/batRules.js

````````text
import { ALL_HEXES, HEX_BY_NUM, HEX_BY_QR } from './hexMap.js';
import { axialDist, axialNeighbors } from './hexGeometry.js';

export function batSpawn(excluded, rng) {
  const blocked = new Set(excluded);
  const pool = ALL_HEXES.filter(h => !blocked.has(h.num));
  return pool.length ? pool[Math.floor(rng() * pool.length)].num : null;
}

// Dynamic radix weights guarantee FP > all timing/distance combined, and
// timing > distance. Ranking timing avoids arbitrary millisecond/FP scales.
export function batTarget(fromNum, spirits, sheets = {}, timing = {}, current = {}) {
  const from = HEX_BY_NUM[fromNum];
  if (!from) return null;
  const candidates = spirits.filter(s => !s.knockedOut && (s.vibe ?? 1) > 0 && HEX_BY_NUM[s.num])
    .map(s => {
      const h = HEX_BY_NUM[s.num], t = timing[s.id];
      return { id: s.id, num: s.num, fp: Math.max(0, sheets[s.id]?.fame ?? 0),
        ms: Math.max(t?.turns ? t.totalMs / t.turns : 0, current.spiritId === s.id ? current.ms ?? 0 : 0),
        distance: axialDist(from.q, from.r, h.q, h.r) };
    });
  const times = [...new Set(candidates.map(c => c.ms))].sort((a, b) => a - b);
  const distanceWeight = Math.max(0, ...candidates.map(c => c.distance)) + 1;
  const fpWeight = (times.length + 1) * distanceWeight;
  return candidates.map(c => ({ ...c, score: c.fp * fpWeight + times.indexOf(c.ms) * distanceWeight - c.distance }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0] ?? null;
}

export function batStep(fromNum, target, blocked, rng) {
  const from = HEX_BY_NUM[fromNum], goal = HEX_BY_NUM[target?.num];
  if (!from || !goal) return fromNum;
  const taken = new Set(blocked);
  const options = axialNeighbors(from.q, from.r).map(h => HEX_BY_QR[`${h.q},${h.r}`])
    .filter(h => h && !taken.has(h.num))
    .map(h => ({ num: h.num, d: axialDist(h.q, h.r, goal.q, goal.r) }));
  if (!options.length) return fromNum;
  const best = Math.min(...options.map(h => h.d));
  const ties = options.filter(h => h.d === best);
  return ties[Math.floor(rng() * ties.length)].num;
}

````````

## src/engine/systems/bats.js

````````text
import { BAT_COUNT, BAT_ROUNDS, BAT_FAN_GAIN, BAT_DAMAGE, BAT_STEP_MS } from '../../data/stageEffects.js';
import { batSpawn, batTarget, batStep } from '../../board/batRules.js';
import { addCasuals } from '../../data/gameConstants.js';
import { applyDamageApplied } from './combat.js';

const occupied = state => state.spirits.filter(s => !s.knockedOut).map(s => s.num);
const obstacles = state => state.stageFx.bats?.obstacles ?? [];

export function activateBats(state, clear, rounds, rng) {
  const bats = [];
  for (let i = 0; i < BAT_COUNT; i++) {
    const num = batSpawn([...clear, ...bats.map(b => b.num)], rng);
    if (num != null) bats.push({ key: `bat-${state.turn.count}-${i}`, num, targetId: null, flight: 0 });
  }
  return { roundsLeft: rounds ?? BAT_ROUNDS, bats, tick: 0, elapsedMs: 0,
    obstacles: clear.filter(n => !occupied(state).includes(n)) };
}

export function applyBatTurnTimed(state, { spiritId, turnCount, durationMs }) {
  if (state.acting !== spiritId || state.turn.count !== turnCount || !Number.isFinite(durationMs) || durationMs < 0) return state;
  const timing = state.stageFx.turnTiming ?? {};
  const old = timing[spiritId] ?? { turns: 0, totalMs: 0, lastTurn: -1 };
  if (old.lastTurn === turnCount) return state;
  return { ...state, stageFx: { ...state.stageFx, turnTiming: { ...timing,
    [spiritId]: { turns: old.turns + 1, totalMs: old.totalMs + durationMs, lastTurn: turnCount } } } };
}

export function applyBatsTicked(state, { tick, spiritId, turnCount, currentTurnMs, elapsedMs = BAT_STEP_MS }, rng) {
  const show = state.stageFx?.bats;
  if (!show || state.winner || show.tick !== tick || state.acting !== spiritId || state.turn.count !== turnCount) return state;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return state;
  const elapsed = (show.elapsedMs ?? 0) + Math.min(BAT_STEP_MS, elapsedMs);
  if (elapsed < BAT_STEP_MS) return { ...state, stageFx: { ...state.stageFx,
    bats: { ...show, elapsedMs: elapsed, tick: tick + 1 } } };
  let next = state;
  const taken = new Set(show.bats.map(b => b.num)), hits = [], moves = [];
  const bats = show.bats.map(bat => {
    taken.delete(bat.num);
    const target = batTarget(bat.num, next.spirits, next.noteStates, next.stageFx.turnTiming,
      { spiritId, ms: Number.isFinite(currentTurnMs) ? Math.max(0, currentTurnMs) : 0 });
    let num = batStep(bat.num, target, [...taken, ...obstacles(next)], rng);
    const victim = next.spirits.find(s => !s.knockedOut && (s.vibe ?? 1) > 0 && s.num === num);
    if (victim) {
      hits.push({ key: bat.key, spiritId: victim.id, hexNum: num, damage: BAT_DAMAGE });
      next = applyDamageApplied(next, { targetId: victim.id, dmg: BAT_DAMAGE });
      num = batSpawn([...occupied(next), ...taken, ...obstacles(next), bat.num], rng) ?? bat.num;
    }
    taken.add(num);
    moves.push({ key: bat.key, from: bat.num, to: num, targetId: target?.id ?? null });
    return { ...bat, num, targetId: target?.id ?? null, flight: (bat.flight ?? 0) + 1 };
  });
  return { ...next, stageFx: { ...next.stageFx, bats: { ...show, bats, tick: tick + 1, elapsedMs: elapsed - BAT_STEP_MS },
    lastBats: { event: 'flew', hits, eaten: [], moves } } };
}

// Position changes from walking, warping, shoves and slides share this rule.
// Respawning after a knockdown is excluded: returning to your corner is no deed.
export function collectBatEntries(before, after, rng) {
  const show = after.stageFx?.bats;
  if (!show) return after;
  const entrants = after.spirits.filter(s => !s.knockedOut && (s.vibe ?? 1) > 0 && before.spirits.some(b => b.id === s.id && b.num !== s.num));
  const eaten = [], taken = new Set(show.bats.map(b => b.num));
  let sheets = after.noteStates;
  const bats = show.bats.map(bat => {
    const eater = entrants.find(s => s.num === bat.num);
    if (!eater) return bat;
    const ns = sheets[eater.id] ?? {};
    const casuals = addCasuals(ns, BAT_FAN_GAIN);
    sheets = { ...sheets, [eater.id]: { ...ns, casuals, fanActedThisTurn: true, fanLag: 0 } };
    eaten.push({ key: bat.key, spiritId: eater.id, hexNum: bat.num, gain: casuals - (ns.casuals ?? 0) });
    taken.delete(bat.num);
    const num = batSpawn([...occupied(after), ...taken, ...obstacles(after), bat.num], rng) ?? bat.num;
    taken.add(num);
    return { ...bat, num, targetId: null, flight: (bat.flight ?? 0) + 1 };
  });
  if (!eaten.length) return after;
  return { ...after, noteStates: sheets, stageFx: { ...after.stageFx, bats: { ...show, bats },
    lastBats: { event: 'eaten', eaten, hits: [], moves: [] } } };
}

````````

## src/engine/systems/crumbling.js

````````text
import { ALL_HEXES, HEX_BY_NUM } from '../../board/hexMap.js';
import { CORNERS } from '../../data/corners.js';
import { cornerFacing } from '../../board/boardHelpers.js';
import { LIMELIGHT_HEX } from '../../data/gameConstants.js';
import { CRUMBLING_ROUNDS, CRUMBLING_HEXES_PER_ROUND, ABYSS_FP_FRACTION } from '../../data/stageEffects.js';
import { applyPoseSet, isPosing } from './limelight.js';

const startingHex = sp => sp.startNum ?? CORNERS[sp.corner]?.homeNum ?? sp.num;

function collapse(state, count, occupied, rng) {
  // Never remove someone's footing, their respawn point, or a rig. Re-read
  // occupied hexes every round: a safe activation is not a safe later collapse.
  const excluded = new Set([
    LIMELIGHT_HEX, ...Object.values(CORNERS).map(c => c.homeNum),
    ...occupied, ...(state.stageFx.crumbling?.hexes ?? []),
    ...state.spirits.flatMap(sp => [sp.num, startingHex(sp)]),
    ...(state.amps ?? []).map(a => a.hexNum),
  ]);
  const pool = ALL_HEXES.filter(h => !excluded.has(h.num)).map(h => h.num);
  const added = [];
  while (added.length < count && pool.length) added.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return added;
}

export function activateCrumbling(state, occupied, rounds, rng) {
  const hexes = collapse(state, CRUMBLING_HEXES_PER_ROUND, occupied, rng);
  return { hexes, added: hexes, showRound: 1, roundsLeft: rounds ?? CRUMBLING_ROUNDS };
}

export function tickCrumbling(state, rng) {
  const show = state.stageFx.crumbling;
  if (!show || show.roundsLeft <= 1) return null;
  const added = collapse(state, CRUMBLING_HEXES_PER_ROUND, [], rng);
  return { ...show, hexes: [...show.hexes, ...added], added,
    showRound: show.showRound + 1, roundsLeft: show.roundsLeft - 1 };
}

/** Whole FP only: round the lost 10% UP, so small scores still pay a price. */
export function abyssFpLoss(fp) {
  return Math.min(Math.max(0, fp), Math.ceil(Math.max(0, fp) * ABYSS_FP_FRACTION));
}

/** An entry invariant shared by walking, every shove, slides and warps. */
export function resolveAbyssEntries(before, after) {
  const holes = after.stageFx?.crumbling?.hexes;
  if (!holes?.length) return after;
  let state = after;
  for (const sp of after.spirits) {
    const old = before.spirits.find(s => s.id === sp.id);
    if (!old || sp.knockedOut || sp.abyssPending || old.num === sp.num || !holes.includes(sp.num)) continue;
    const homeNum = startingHex(old);
    if (!HEX_BY_NUM[homeNum]) continue;
    const sheet = state.noteStates?.[sp.id] ?? {};
    const lost = abyssFpLoss(sheet.fame ?? 0);
    if (isPosing(state, sp.id)) state = applyPoseSet(state, { spiritId: sp.id, on: false });
    state = {
      ...state,
      // Null is off the board; retain the queue slot so the next OWN turn is
      // the respawn beat. This is not permanent elimination or a life spend.
      spirits: state.spirits.map(s => s.id === sp.id ? { ...s, num: null,
        abyssPending: { homeNum, fellOn: sp.num },
        knockdownCount: (s.knockdownCount ?? 0) + 1 } : s),
      noteStates: { ...state.noteStates, [sp.id]: { ...sheet,
        fame: Math.max(0, (sheet.fame ?? 0) - lost), knockStreak: 0 } },
      stageFx: { ...state.stageFx, lastAbyss: { event: 'fell', spiritId: sp.id, hexNum: sp.num, lost } },
      ...(state.acting === sp.id ? { turn: { ...state.turn, moveStepsLeft: 0,
        slideStepsLeft: 0, actionTokenUsed: true } } : {}),
    };
  }
  return state;
}

export function respawnFromAbyss(state, spiritId) {
  const sp = state.spirits.find(s => s.id === spiritId);
  if (!sp?.abyssPending || sp.knockedOut) return state;
  const { homeNum } = sp.abyssPending;
  return { ...state,
    spirits: state.spirits.map(s => s.id === spiritId ? { ...s, num: homeNum,
      facing: cornerFacing(homeNum), vibe: s.maxVibe, abyssPending: null } : s),
    stageFx: { ...state.stageFx, lastAbyss: { event: 'respawned', spiritId, hexNum: homeNum } },
  };
}

````````
