import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ALL_HEXES, HEX_BY_NUM } from '../../src/board/hexMap.js';
import { getFlatTopNeighborSlots } from '../../src/board/hexGeometry.js';
import { applyMoveStep } from '../../src/engine/systems/movement.js';
import { makeRng } from '../../src/engine/rng.js';

// The environment is a visual preview, not a replacement match client. Movement
// delegates to the live reducer after preview legality checks; FX buttons are demos.
const $ = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const assets = new URL('./', import.meta.url);
const vec = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const hexPosition = num => {
  const h = HEX_BY_NUM[num];
  // Blender Z-up becomes glTF Y-up; Blender's +Y becomes glTF -Z.
  return vec((h.px-3255)/200, .11, -(h.py-2415)/200);
};
const initialSpirits = [
  {id:'ronin',name:'Shredding Ronin',num:47,color:0x6be5ff,facing:0},
  {id:'zero',name:'Intergalactic 0',num:65,color:0xc28bff,facing:Math.PI},
  {id:'metal',name:'Metalness Monster',num:30,color:0xffad52,facing:0},
  {id:'glam',name:'Glamarchy',num:83,color:0xff71cb,facing:Math.PI},
];
let state, selected=0, selectedAmp=0, animating=false, cameraTween=null, model=null;
let moveAnim=null, fallAnim=null, hoverHex=null, movementCount=0, fps=0;
const effects=[], pawns=[], targetMeshes=[], ampTargets=[], emissives=[];
const settingsKey='rlsw-cosmic-arena-v1';
const defaults={glow:1,rock:1,height:1,cracks:1,lights:true,debris:true,orbit:false,numbers:false,quality:true};
let settings={...defaults};
try { settings={...defaults,...JSON.parse(localStorage.getItem(settingsKey)||'{}')}; } catch { /* Storage is optional in private browsing. */ }
if(reducedMotion)settings.orbit=false;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x030611);
const camera=new THREE.PerspectiveCamera(43,innerWidth/innerHeight,.15,500);
camera.position.set(28,18,37);
if(innerWidth<760)camera.position.multiplyScalar(1.13);
let renderer;
try { renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); }
catch { $('load-detail').textContent='WebGL could not start. Open this preview in a browser with hardware acceleration enabled.'; throw new Error('WebGL initialization failed'); }
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
renderer.outputColorSpace=THREE.SRGBColorSpace;
$('world').appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label','Drag to orbit the arena. Click spirits, neighboring hexes, or amp cabinets.');
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();$('render-status').textContent='GRAPHICS CONTEXT LOST · RELOAD TO RECOVER';});
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(1,-2.8,0);
controls.enableDamping=true; controls.dampingFactor=.07;
controls.minDistance=12;controls.maxDistance=85;controls.maxPolarAngle=Math.PI*.78;
controls.autoRotateSpeed=.32;
controls.addEventListener('start',()=>{cameraTween=null;});
const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.44,.55,1.05);
composer.addPass(bloom);composer.addPass(new OutputPass());
scene.add(new THREE.HemisphereLight(0x9fc4ff,0x363852,2));
const key=new THREE.DirectionalLight(0xaad8ff,2.2);key.position.set(7,20,16);scene.add(key);
const rim=new THREE.DirectionalLight(0xae72ff,1.6);rim.position.set(-15,9,-12);scene.add(rim);
const rockFill=new THREE.DirectionalLight(0x72aaff,2.4);rockFill.position.set(4,-3,18);scene.add(rockFill);
const lowerLight=new THREE.PointLight(0xb050ff,75,30,2);lowerLight.position.set(0,-7,5);scene.add(lowerLight);

// Procedural backdrop keeps the browser scene self-contained and understated.
let seed=7721;
function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const starPositions=[],starColors=[];
for(let i=0;i<2200;i++){
  const theta=rand()*Math.PI*2,u=rand()*2-1,r=110+rand()*60,s=Math.sqrt(1-u*u);
  starPositions.push(r*s*Math.cos(theta),r*u,r*s*Math.sin(theta));
  const c=new THREE.Color().setHSL(.55+rand()*.16,.12+rand()*.4,.25+rand()*.5);
  starColors.push(c.r,c.g,c.b);
}
const starsGeometry=new THREE.BufferGeometry();
starsGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
starsGeometry.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));
scene.add(new THREE.Points(starsGeometry,new THREE.PointsMaterial({size:.16,vertexColors:true,sizeAttenuation:true,transparent:true,opacity:.85})));
const sky=new THREE.Mesh(new THREE.SphereGeometry(190,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
  vertexShader:'varying vec3 v; void main(){v=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec3 v;
  float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  void main(){vec3 p=normalize(v);float n=noise(p*5.)*.6+noise(p*13.)*.25+noise(p*31.)*.15;float band=exp(-pow((p.y+.12+p.x*.2)*5.,2.));vec3 c=vec3(.002,.004,.011)+vec3(.034,.009,.058)*pow(n,3.)*band;gl_FragColor=vec4(c,1.);}`
}));scene.add(sky);
const planet=new THREE.Mesh(new THREE.SphereGeometry(11,64,32),new THREE.MeshStandardMaterial({color:0x182940,roughness:1,metalness:.05}));planet.position.set(-65,0,-25);scene.add(planet);
const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(11.24,48,32),new THREE.ShaderMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,
  vertexShader:'varying vec3 n; varying vec3 p;void main(){n=normalize(normalMatrix*normal);vec4 q=modelViewMatrix*vec4(position,1.);p=q.xyz;gl_Position=projectionMatrix*q;}',
  fragmentShader:'varying vec3 n;varying vec3 p;void main(){float f=pow(1.-max(0.,dot(normalize(n),normalize(-p))),3.);gl_FragColor=vec4(.14,.35,.65,f*.45);}'
}));atmosphere.position.copy(planet.position);planet.scale.setScalar(.55);atmosphere.scale.setScalar(.55);scene.add(atmosphere);
const moon=new THREE.Mesh(new THREE.SphereGeometry(5.2,36,24),new THREE.MeshStandardMaterial({color:0x40354a,roughness:1}));moon.position.set(1,-10,-65);scene.add(moon);
const ring=new THREE.Mesh(new THREE.RingGeometry(7.5,12,100),new THREE.MeshBasicMaterial({color:0x686578,side:THREE.DoubleSide,transparent:true,opacity:.16}));ring.position.copy(moon.position);ring.rotation.set(-1.2,.25,.3);moon.scale.setScalar(.6);ring.scale.setScalar(.6);scene.add(ring);

const wreckage=new THREE.Group();scene.add(wreckage);
const rockMat=new THREE.MeshStandardMaterial({color:0x303846,metalness:.35,roughness:.83,flatShading:true});
for(let i=0;i<48;i++){
  const a=rand()*Math.PI*2,r=16+rand()*12;
  const chunk=new THREE.Mesh(new THREE.IcosahedronGeometry(.22+rand()*.8,0),rockMat);
  chunk.position.set(Math.cos(a)*r,-4-rand()*11,Math.sin(a)*r);
  chunk.scale.set(.5+rand(),.7+rand()*1.8,.5+rand());
  chunk.rotation.set(rand()*6,rand()*6,rand()*6);
  chunk.userData.baseY=chunk.position.y;chunk.userData.phase=rand()*6;wreckage.add(chunk);
}
for(let i=0;i<7;i++){
  const a=rand()*6.28,r=17+rand()*6;
  const shard=new THREE.Mesh(new THREE.BoxGeometry(1.3,.12,.7),new THREE.MeshStandardMaterial({color:0x283652,metalness:.85,roughness:.4}));
  shard.position.set(Math.cos(a)*r,-2-rand()*6,Math.sin(a)*r);shard.rotation.set(rand()*3,rand()*3,rand()*3);
  shard.userData.baseY=shard.position.y;shard.userData.phase=rand()*6;wreckage.add(shard);
}

const lightBeams=new THREE.Group();scene.add(lightBeams);
for(const sx of [-1,1])for(const sy of [-1,1]){
  const source=vec(sx*9.5,3.42,-sy*7.5),target=vec(sx*3.6,.1,-sy*2.2),d=target.clone().sub(source);
  const beam=new THREE.Mesh(new THREE.ConeGeometry(1.05,d.length(),24,1,true),new THREE.MeshBasicMaterial({color:sx===sy?0x54caff:0xb854ff,transparent:true,opacity:.035,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
  beam.position.copy(source).addScaledVector(d,.5);beam.quaternion.setFromUnitVectors(vec(0,1,0),d.clone().normalize().negate());lightBeams.add(beam);
  const pool=new THREE.Mesh(new THREE.CircleGeometry(.85,32),new THREE.MeshBasicMaterial({color:0x8dbfff,transparent:true,opacity:.075,depthWrite:false,blending:THREE.AdditiveBlending}));pool.rotation.x=-Math.PI/2;pool.position.copy(target);pool.position.y=.07;lightBeams.add(pool);
}

function solid(geometry,color,metalness=.5,emission=0){return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,metalness,roughness:.38,emissive:color,emissiveIntensity:emission}));}
function pawn(sp,i){
  const g=new THREE.Group();g.userData.spiritIndex=i;
  const base=solid(new THREE.CylinderGeometry(.37,.43,.12,6),0x1b2840);base.position.y=.03;g.add(base);
  const halo=solid(new THREE.TorusGeometry(.39,.024,6,36),sp.color,.2,2);halo.rotation.x=Math.PI/2;halo.position.y=.11;g.add(halo);
  const torso=solid(new THREE.BoxGeometry(.39,.47,.24),0x222c49);torso.position.y=.73;g.add(torso);
  const chest=solid(new THREE.BoxGeometry(.075,.33,.25),sp.color,.3,.65);chest.position.y=.75;g.add(chest);
  for(const x of [-.13,.13]){const leg=solid(new THREE.BoxGeometry(.14,.35,.15),0x1d243b);leg.position.set(x,.3,0);g.add(leg);}
  const head=solid(new THREE.IcosahedronGeometry(.19,1),0x8a95ad,.8);head.position.y=1.13;g.add(head);
  const visor=solid(new THREE.BoxGeometry(.29,.045,.06),sp.color,.2,2);visor.position.set(0,1.14,.155);g.add(visor);
  if(i===0){const hat=solid(new THREE.ConeGeometry(.36,.12,6),0x172339);hat.position.y=1.31;g.add(hat);}
  if(i===2){for(const x of [-.2,.2]){const horn=solid(new THREE.ConeGeometry(.085,.28,5),0xc3ac8c);horn.position.set(x,1.3,0);horn.rotation.z=-Math.sign(x)*.5;g.add(horn);}torso.scale.x=1.3;}
  const instrument=new THREE.Group();
  const body=solid(new THREE.BoxGeometry(.27,.33,.09),sp.color,.7,.15);instrument.add(body);
  const neck=solid(new THREE.BoxGeometry(.055,.62,.07),0xd6d7dd,.7);neck.position.y=.42;instrument.add(neck);
  instrument.position.set(.16,.62,.26);instrument.rotation.z=-.65;g.add(instrument);
  g.position.copy(hexPosition(sp.num));scene.add(g);return g;
}

const markerMaterial=new THREE.MeshBasicMaterial({color:0x5fecff,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false});
const legalGroup=new THREE.Group();scene.add(legalGroup);
const pickGeo=new THREE.CircleGeometry(.92,6);pickGeo.rotateX(-Math.PI/2);
for(const h of ALL_HEXES){
  const m=new THREE.Mesh(pickGeo,new THREE.MeshBasicMaterial({visible:false}));
  m.position.copy(hexPosition(h.num));m.position.y=.06;m.userData.hexNum=h.num;scene.add(m);targetMeshes.push(m);
}
const selectionRing=solid(new THREE.TorusGeometry(.63,.025,6,48),0x72eaff,.1,2);selectionRing.rotation.x=Math.PI/2;scene.add(selectionRing);
const hoverRing=new THREE.Mesh(new THREE.RingGeometry(.82,.88,6),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.5,side:THREE.DoubleSide}));hoverRing.rotation.x=-Math.PI/2;hoverRing.visible=false;scene.add(hoverRing);
const labels=new THREE.Group();scene.add(labels);
function textSprite(text,color='#729bb4',scale=.6){
  const c=document.createElement('canvas');c.width=128;c.height=64;
  const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.font='500 27px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,64,32);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:true,opacity:.7}));sprite.scale.set(scale,scale*.5,1);return sprite;
}
for(const h of ALL_HEXES){const s=textSprite(String(h.num));s.position.copy(hexPosition(h.num));s.position.y=.14;labels.add(s);}

function legalHexes(){
  if(!state||state.turn.moveStepsLeft<=0||animating)return [];
  const sp=state.spirits[selected],occupied=new Set(state.spirits.filter(s=>s.id!==sp.id).map(s=>s.num));
  return getFlatTopNeighborSlots(HEX_BY_NUM[sp.num]).filter(h=>!occupied.has(h.num));
}
function updateUI(message){
  const sp=state.spirits[selected];
  $('spirit-name').textContent=sp.name;$('position').textContent=`HEX ${sp.num} · ${state.turn.moveStepsLeft} STEPS`;
  $('spirit-dot').style.background=new THREE.Color(sp.color).getStyle();
  if(message)$('hint').textContent=message;
  else $('hint').textContent=state.turn.moveStepsLeft?'Click a lit neighboring hex to move.':'Movement drill complete. Reset or choose another spirit.';
  for(const m of [...legalGroup.children]){legalGroup.remove(m);}
  for(const h of legalHexes()){
    const m=new THREE.Mesh(pickGeo,markerMaterial);m.position.copy(hexPosition(h.num));m.position.y=.065;legalGroup.add(m);
  }
  selectionRing.material.color.set(sp.color);selectionRing.material.emissive.set(sp.color);
  for(const id of ['shockwave','amp-beam','knockoff','next-spirit'])$(id).disabled=animating;
}
function resetDrill(){
  state={spirits:initialSpirits.map(s=>({...s})),turn:{moveStepsLeft:6,slimingId:null},limelight:{posing:{},scores:{}}};
  selected=0;animating=false;moveAnim=null;fallAnim=null;
  for(let i=0;i<pawns.length;i++){pawns[i].position.copy(hexPosition(state.spirits[i].num));pawns[i].rotation.set(0,0,0);pawns[i].scale.setScalar(1);pawns[i].visible=true;}
  updateUI('Select a spirit, then click a lit neighboring hex.');
}
for(let i=0;i<initialSpirits.length;i++)pawns.push(pawn(initialSpirits[i],i));
resetDrill();

function moveTo(num){
  if(!legalHexes().some(h=>h.num===num)){updateUI('Choose a lit adjacent hex. Occupied spaces are unavailable.');return;}
  const sp=state.spirits[selected];
  const next=applyMoveStep(state,{spiritId:sp.id,toNum:num,dazed:false},makeRng(8437));
  if(next.spirits[selected].num!==num)return;
  state=next;movementCount++;animating=true;
  moveAnim={index:selected,from:pawns[selected].position.clone(),to:hexPosition(num),start:performance.now(),duration:reducedMotion?100:420};
  pawns[selected].rotation.y=state.spirits[selected].facing+Math.PI/2;
  updateUI(`Moving to hex ${num}…`);
}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
function hits(e){const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster;}
renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener('pointerup',e=>{
  if(e.button!==0||!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||animating)return;
  hits(e);
  const pawnHit=raycaster.intersectObjects(pawns,true)[0];
  if(pawnHit){let o=pawnHit.object;while(o&&o.userData.spiritIndex===undefined)o=o.parent;if(o){selected=o.userData.spiritIndex;state.turn.moveStepsLeft=6;updateUI();}return;}
  const ampHit=raycaster.intersectObjects(ampTargets,true)[0];
  if(ampHit){let o=ampHit.object;while(o&&o.userData.ampIndex===undefined)o=o.parent;if(o){selectedAmp=o.userData.ampIndex;$('amp-name').textContent=`AMP ${amps[selectedAmp].id} SELECTED`;updateUI(`Amp ${amps[selectedAmp].id} selected. Fire a beam to preview its effect.`);}return;}
  const h=raycaster.intersectObjects(targetMeshes)[0];if(h)moveTo(h.object.userData.hexNum);
});
renderer.domElement.addEventListener('pointermove',e=>{
  hits(e);const h=raycaster.intersectObjects(targetMeshes)[0];hoverHex=h?.object.userData.hexNum??null;
  hoverRing.visible=!!h&&!animating;
  if(h){hoverRing.position.copy(hexPosition(hoverHex));hoverRing.position.y=.09;hoverRing.material.color.set(legalHexes().some(x=>x.num===hoverHex)?0x9dffff:0x5e728f);}
});
renderer.domElement.addEventListener('pointerleave',()=>{hoverRing.visible=false;});

function disposeFX(fx){scene.remove(fx.group);fx.group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
function shockwaveAt(position,color=0x79e8ff){
  if(effects.length>18)disposeFX(effects.shift());
  const group=new THREE.Group();group.position.copy(position);group.position.y=.22;
  for(let i=0;i<3;i++){
    const m=new THREE.Mesh(new THREE.TorusGeometry(1,.026,6,80),new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));m.rotation.x=Math.PI/2;m.userData.delay=i*.15;group.add(m);
  }
  scene.add(group);effects.push({kind:'pulse',group,start:performance.now(),duration:1300});
}
let amps=[];
function fireBeam(){
  if(!amps.length||animating)return;
  const amp=amps[selectedAmp],from=vec(amp.x,amp.height*.62*settings.height,-amp.z),to=pawns[selected].position.clone().add(vec(0,.7,0));
  const group=new THREE.Group();
  for(let layer=0;layer<3;layer++){
    const points=[];
    for(let i=0;i<=25;i++){const p=from.clone().lerp(to,i/25),f=Math.sin(i/25*Math.PI);p.add(vec((rand()-.5)*.5*f,(rand()-.5)*.65*f,(rand()-.5)*.5*f));points.push(p);}
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:layer?0xb465ff:0xeeccff,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false}));group.add(line);
  }
  const direction=to.clone().sub(from);
  const core=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,direction.length(),8),new THREE.MeshBasicMaterial({color:0xe4caff,transparent:true,opacity:.85,blending:THREE.AdditiveBlending}));core.position.copy(from).addScaledVector(direction,.5);core.quaternion.setFromUnitVectors(vec(0,1,0),direction.clone().normalize());group.add(core);
  const flash=new THREE.PointLight(0xb660ff,85,12,2);flash.position.copy(to);group.add(flash);
  scene.add(group);effects.push({kind:'beam',group,start:performance.now(),duration:650});shockwaveAt(to,0xc493ff);
  updateUI(`Amp ${amp.id} → ${state.spirits[selected].name}. Visual effect demo.`);
}
function knockoff(){
  if(animating)return;
  const start=pawns[selected].position.clone(),out=vec(start.x,0,start.z);
  if(out.length()<1)out.set(-1,0,1);out.normalize();
  // This is a deliberately labeled cinematic demo, not a combat outcome.
  fallAnim={index:selected,from:start,edge:out.multiplyScalar(15.5),start:performance.now(),duration:reducedMotion?900:2600};
  fallAnim.edge.y=.12;animating=true;shockwaveAt(start,0xff72cd);updateUI('Knock-off demo · the spirit returns after the fall.');
}
$('shockwave').onclick=()=>{if(!animating){shockwaveAt(pawns[selected].position,state.spirits[selected].color);updateUI('Sonic pulse · visual effect demo.');}};
$('amp-beam').onclick=fireBeam;$('knockoff').onclick=knockoff;
$('reset-drill').onclick=resetDrill;
$('next-spirit').onclick=()=>{if(!animating){selected=(selected+1)%pawns.length;state.turn.moveStepsLeft=6;updateUI();}};

const views={arena:{p:[28,18,37],t:[1,-2.8,0]},tactical:{p:[0,43,.03],t:[0,0,0]},underside:{p:[24,-9,32],t:[0,-3.7,0]},amps:{p:[-1,6,-1],t:[-8,.6,9.5]}};
function view(name){
  const v=views[name],from=camera.position.clone().sub(controls.target),to=vec(...v.p).sub(vec(...v.t));
  // Orbit between views on a sphere, rather than cutting through the island.
  cameraTween={direction:from.clone().normalize(),rotation:new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(),to.clone().normalize()),radius:from.length(),toRadius:to.length()*(innerWidth<760&&name!=='amps'?1.13:1),target:controls.target.clone(),toTarget:vec(...v.t),start:performance.now(),duration:reducedMotion?50:1100};
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
$('settings-toggle').onclick=()=>{const hidden=$('settings').classList.toggle('hidden');$('settings-toggle').setAttribute('aria-expanded',String(!hidden));};
if(innerWidth<900){$('settings').classList.add('hidden');$('settings-toggle').setAttribute('aria-expanded','false');}
if(!window.__hudToggleBound)$('hud-toggle').onclick=()=>{const player=document.body.classList.toggle('player-hud');$('hud-toggle').textContent=player?'Studio Preview ◈':'Player HUD ◈';$('hud-toggle').setAttribute('aria-pressed',String(player));};
$('reference').onclick=()=>$('reference-dialog').showModal();$('close-reference').onclick=()=>$('reference-dialog').close();
function applySettings(){
  for(const key of ['glow','rock','height','cracks']){$(key).value=settings[key];$(key+'-value').textContent=Number(settings[key]).toFixed(2);}
  for(const key of ['lights','debris','orbit','numbers','quality'])$(key).checked=settings[key];
  for(const {material,base} of emissives){
    const crack=material.name.includes('Crack');material.emissiveIntensity=base*(crack?settings.cracks:settings.glow);
  }
  rockFill.intensity=2.4*settings.rock;lowerLight.intensity=75*settings.cracks;
  for(const o of ampTargets)o.scale.y=settings.height;
  controls.autoRotate=settings.orbit&&!reducedMotion;lightBeams.visible=settings.lights;wreckage.visible=settings.debris;labels.visible=settings.numbers;
  bloom.strength=.44*settings.glow;bloom.enabled=settings.quality;
  renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality?1.75:1));composer.setPixelRatio(renderer.getPixelRatio());
  try{localStorage.setItem(settingsKey,JSON.stringify(settings));}catch{/* Optional storage. */}
}
for(const key of Object.keys(defaults))$(key).addEventListener('input',()=>{settings[key]=typeof defaults[key]==='boolean'?$(key).checked:Number($(key).value);applySettings();});
$('reset-settings').onclick=()=>{settings={...defaults};applySettings();};
$('save-settings').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,settings,camera:camera.position.toArray(),target:controls.target.toArray()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='rlsw-arena-settings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
applySettings();

async function load(){
  try{
    const response=await fetch(new URL('amp-layout.json',assets));if(!response.ok)throw new Error(`Amp layout HTTP ${response.status}`);amps=await response.json();
    const gltf=await new GLTFLoader().loadAsync(new URL('cosmic-arena.glb',assets).href,progress=>{if(progress.total)$('load-detail').textContent=`Loading stage geometry · ${Math.round(progress.loaded/progress.total*100)}%`;});
    model=gltf.scene;scene.add(model);
    const seen=new Set();
    model.traverse(o=>{
      if(o.name.startsWith('Amp_')&&o.type==='Object3D'){
        const key=o.name.slice(4);const i=amps.findIndex(a=>a.id===key);
        if(i>=0){o.userData.ampIndex=i;ampTargets.push(o);}
      }
      if(o.isMesh){o.frustumCulled=true;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.emissiveIntensity&&!seen.has(m.uuid)){seen.add(m.uuid);emissives.push({material:m,base:m.emissiveIntensity});}}
    });
    // GLTFLoader may choose Group for exported Blender empty objects.
    if(!ampTargets.length)for(const a of amps){const o=model.getObjectByName('Amp_'+a.id);if(o){o.userData.ampIndex=amps.indexOf(a);ampTargets.push(o);}}
    applySettings();$('loading').remove();$('render-status').textContent='BLENDER WORLD · READY';
    window.__arenaReady=true;
  }catch(error){console.error(error);$('load-detail').textContent=`The arena could not load: ${error.message}. Reload after the local server is running.`;}
}
load();

let last=performance.now(),frameCount=0,frameStart=last;
function animate(now){
  requestAnimationFrame(animate);
  if(document.hidden){last=now;return;}
  const dt=Math.min((now-last)/1000,.05);last=now;
  if(cameraTween){const a=cameraTween,t=Math.min(1,(now-a.start)/a.duration),s=t*t*(3-2*t);controls.target.lerpVectors(a.target,a.toTarget,s);const q=new THREE.Quaternion().slerp(a.rotation,s);camera.position.copy(a.direction).applyQuaternion(q).multiplyScalar(THREE.MathUtils.lerp(a.radius,a.toRadius,s)).add(controls.target);if(t===1)cameraTween=null;}
  controls.update(dt);
  if(moveAnim){const a=moveAnim,t=Math.min(1,(now-a.start)/a.duration),s=t*t*(3-2*t);pawns[a.index].position.lerpVectors(a.from,a.to,s);pawns[a.index].position.y+=Math.sin(t*Math.PI)*.22;if(t===1){moveAnim=null;animating=false;updateUI();}}
  if(fallAnim){
    const a=fallAnim,t=Math.min(1,(now-a.start)/a.duration),p=pawns[a.index];
    if(t<.36)p.position.lerpVectors(a.from,a.edge,t/.36);
    else {const f=(t-.36)/.64;p.position.copy(a.edge).addScaledVector(a.edge.clone().setY(0).normalize(),f*2.5);p.position.y=.12-f*f*22;p.rotation.z=f*4;p.rotation.x=f*2;}
    if(t===1){p.position.copy(hexPosition(state.spirits[a.index].num));p.rotation.set(0,0,0);fallAnim=null;animating=false;updateUI('Back on stage. Knock-off demo complete.');}
  }
  selectionRing.position.copy(pawns[selected].position);selectionRing.position.y=Math.max(.15,selectionRing.position.y-.02);selectionRing.visible=!fallAnim;
  if(!reducedMotion){for(const o of wreckage.children){o.rotation.y+=dt*.025;o.position.y=o.userData.baseY+Math.sin(now*.0003+o.userData.phase)*.15;}}
  for(let i=effects.length-1;i>=0;i--){
    const fx=effects[i],t=(now-fx.start)/fx.duration;
    if(t>=1){disposeFX(fx);effects.splice(i,1);continue;}
    if(fx.kind==='pulse')for(const m of fx.group.children){const u=Math.max(0,t-m.userData.delay);m.visible=t>=m.userData.delay;m.scale.setScalar(.3+u*7);m.material.opacity=Math.max(0,1-u*1.6);}
    else fx.group.traverse(o=>{if(o.material)o.material.opacity=(1-t)*(.6+.4*Math.sin(t*70));if(o.isLight)o.intensity=85*(1-t);});
  }
  composer.render();frameCount++;
  if(now-frameStart>1800){fps=Math.round(frameCount*1000/(now-frameStart));frameCount=0;frameStart=now;if(window.__arenaReady)$('render-status').textContent=`${fps} FPS · ${settings.quality?'HIGH':'STANDARD'} DETAIL · LOCAL PREVIEW`;}
}
requestAnimationFrame(animate);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});
// Read-only diagnostics for verifying scene contents and coordinates in the browser.
window.arenaDiagnostics=()=>({ready:!!model,hexes:ALL_HEXES.length,amps:ampTargets.length,spirits:state.spirits.map(({id,num})=>({id,num})),steps:state.turn.moveStepsLeft,moves:movementCount,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,fps,settings:{...settings},modelBounds:model?new THREE.Box3().setFromObject(model).getSize(vec()).toArray():null});
