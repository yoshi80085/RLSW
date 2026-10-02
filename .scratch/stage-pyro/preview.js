import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ALL_HEXES } from '../../src/board/hexMap.js';
import { DEFAULTS, SLIDERS, PRESETS, DURATION, PAWNS, layouts, phaseAt } from './choreography.js';
import { createPyro, point } from './pyro.js';
import { createPyroAudio, crossedCues } from './audio.js';
import { createHazardActors } from '../stage-hazards/actors.js';
import { armTurn, fireRemaining, pushRival } from './sandbox.js';
const $=id=>document.getElementById(id),storage='rlsw.stage-pyro.study.v1';
const audio=createPyroAudio();let soundOn=false,lab=null;
let settings={...DEFAULTS};
try{const v=JSON.parse(localStorage.getItem(storage)||'{}');for(const key of Object.keys(DEFAULTS)){
 if(typeof DEFAULTS[key]==='boolean'&&typeof v[key]==='boolean')settings[key]=v[key];
 }for(const [key,,min,max] of SLIDERS)if(Number.isFinite(v[key]))settings[key]=THREE.MathUtils.clamp(v[key],min,max);
 if(['gold','red','electric'].includes(v.palette))settings.palette=v.palette;
 if([.25,.5,1].includes(v.speed))settings.speed=v.speed;
 if(Number.isInteger(v.seed)&&v.seed>0&&v.seed<100000)settings.seed=v.seed;
 if(['arena','stadium','precision','custom'].includes(v.preset))settings.preset=v.preset;
 if(Number.isFinite(v.volume))settings.volume=THREE.MathUtils.clamp(v.volume,0,1);
 if(Number.isFinite(v.hitStrength))settings.hitStrength=THREE.MathUtils.clamp(v.hitStrength,.5,1.6);
 if(['recover','knockdown'].includes(v.hitOutcome))settings.hitOutcome=v.hitOutcome;
 if(Number.isFinite(v.bass))settings.bass=THREE.MathUtils.clamp(v.bass,.5,2);
}catch{/* Optional saved settings. */}
settings.hitStrength??=1;settings.hitOutcome??='recover';$('hitStrength').value=settings.hitStrength;$('hitOutcome').value=settings.hitOutcome;
settings.bass??=1.35;audio.setBass(settings.bass);$('bass').value=settings.bass;$('bassValue').textContent=`${settings.bass.toFixed(2)}×`;
settings.volume??=.55;audio.setVolume(settings.volume);$('volume').value=settings.volume;$('volumeValue').textContent=`${Math.round(settings.volume*100)}%`;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let actors;
let age=0,paused=reduced.matches,dirty=true,disposed=false,pyro,scene,renderer,composer,controls,resizeObserver,raf;
const toggles=['mortars','cannons','fireworks','curtain','bloom','guides'];
for(const [id,label,min,max,step] of SLIDERS){const el=document.createElement('label');el.className='slider';el.innerHTML=`<span>${label}<output id="${id}Value"></output></span><input id="${id}" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}">`;$('sliders').append(el);$(id).oninput=()=>{settings[id]=Number($(id).value);settings.preset='custom';sync();};}
function sync(){dirty=true;for(const [id] of SLIDERS){$(id).value=settings[id];$(`${id}Value`).textContent=settings[id].toFixed(['stagger','glow'].includes(id)?2:1);}for(const id of toggles)$(id).checked=settings[id];for(const id of ['palette','speed','preset'])$(id).value=settings[id];$('dial').value=JSON.stringify({study:'Pyrotechnics / Stage study 03',version:1,...settings},null,2);try{localStorage.setItem(storage,JSON.stringify(settings));}catch{/* Optional. */}}
function pause(v){paused=v;dirty=true;if(v)audio.stop();$('pause').textContent=paused?'Play':'Pause';}
function seek(t){age=THREE.MathUtils.clamp(t,0,DURATION);pause(true);}
$('pause').onclick=()=>{if(!lab&&age>=DURATION)age=0;pause(!paused);};
$('replay').onclick=()=>{audio.stop();age=0;pause(false);};$('timeline').oninput=()=>seek(Number($('timeline').value));
for(const b of document.querySelectorAll('[data-time]'))b.onclick=()=>seek(Number(b.dataset.time));
for(const id of toggles)$(id).onchange=()=>{settings[id]=$(id).checked;sync();};
for(const id of ['palette','speed'])$(id).onchange=()=>{if(id==='speed')audio.stop();settings[id]=id==='speed'?Number($(id).value):$(id).value;sync();};
$('bass').oninput=()=>{settings.bass=Number($('bass').value);audio.setBass(settings.bass);$('bassValue').textContent=`${settings.bass.toFixed(2)}×`;sync();};
$('volume').oninput=()=>{settings.volume=Number($('volume').value);audio.setVolume(settings.volume);$('volumeValue').textContent=`${Math.round(settings.volume*100)}%`;sync();};
$('sound').onclick=async()=>{if(soundOn){audio.disable();soundOn=false;$('sound').textContent='Enable sound & replay';$('audioStatus').textContent='Sound off.';return;}try{soundOn=await audio.enable();if(!soundOn)throw Error('Click again to start browser audio.');$('sound').textContent='Disable sound';$('audioStatus').textContent='Sound ready · volume 0 silences effects.';if(lab)$('resetLab').click();else{age=0;pause(false);}}catch(e){$('audioStatus').textContent=e.message;}};
$('preset').onchange=()=>{const p=$('preset').value;settings={...settings,...PRESETS[p],preset:p};sync();};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('dial').value);$('saved').textContent='Dial-in copied. Paste it into our chat.';}catch{$('dial').closest('details').open=true;$('dial').select();$('saved').textContent='Copy the selected settings below.';}};
$('download').onclick=()=>{const u=URL.createObjectURL(new Blob([$('dial').value],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='pyrotechnics-dial-in.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);$('saved').textContent='Dial-in saved as JSON.';};
function release(root){const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}
sync();pause(paused);
try{
 const host=$('stage'),canvas=host.querySelector('canvas');
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 scene=new THREE.Scene();scene.background=new THREE.Color('#080c13');scene.fog=new THREE.FogExp2('#080c13',.009);
 scene.add(new THREE.HemisphereLight('#b6cee4','#222131',1.7));
 const key=new THREE.DirectionalLight('#c1d8f5',2.5);key.position.set(-8,14,5);scene.add(key);
 const rim=new THREE.DirectionalLight('#b99377',1.5);rim.position.set(8,5,-12);scene.add(rim);
 const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.5});
 const platform=new THREE.Mesh(new THREE.CylinderGeometry(13.25,13.6,.7,6),mat('#17212c'));platform.position.y=-.42;platform.rotation.y=Math.PI/6;scene.add(platform);
 const trim=new THREE.Mesh(new THREE.CylinderGeometry(13.3,13.3,.05,6,1,true),new THREE.MeshBasicMaterial({color:'#cd782e'}));trim.rotation.y=Math.PI/6;trim.position.y=-.27;scene.add(trim);
 const tileGeo=new THREE.CylinderGeometry(.94,.94,.075,6);tileGeo.rotateY(Math.PI/6);const tileMat=mat('#2c3948'),centerMat=mat('#74627a');
 for(const h of ALL_HEXES){const tile=new THREE.Mesh(tileGeo,h.num===56?centerMat:tileMat);tile.position.copy(point(h.num,.035));scene.add(tile);}
 actors=createHazardActors(scene);
 pyro=createPyro(scene,layouts(settings.seed));
 const camera=new THREE.PerspectiveCamera(44,1,.1,180);controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.minDistance=3;controls.maxDistance=75;controls.maxPolarAngle=Math.PI*.49;controls.addEventListener('change',()=>dirty=true);
 let currentView='stage';
 function view(name){currentView=name;controls.target.set(0,4,0);if(name==='impact'){const n=lab?.push?.path.at(-1)??lab?.path?.[1]??PAWNS[0],p=point(n,1),yaw=lab?.push?.step.yaw0??-.8;controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(Math.sin(yaw)*9+Math.cos(yaw)*5,6,Math.cos(yaw)*9-Math.sin(yaw)*5));}else if(name==='mortar'){const p=pyro.focus();controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(4,3.5,5));}else{camera.position.set(...({stage:[29,24,34],low:[26,12,33],top:[0,46,.01]})[name]);if(name==='top')controls.target.set(0,0,0);}controls.update();dirty=true;for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===name));}
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>view(b.dataset.view);view('stage');
 function rebuild(){scene.remove(pyro.root);release(pyro.root);pyro=createPyro(scene,lab?lab.hexes:layouts(settings.seed));pyro.resize(host.clientHeight*renderer.getPixelRatio());dirty=true;if(currentView==='mortar')view(currentView);}
 function modeUI(){for(const id of ['timeline','replay','loop','pattern'])$(id).disabled=!!lab;for(const b of document.querySelectorAll('[data-time]'))b.disabled=!!lab;$('resetLab').disabled=!lab;$('sandbox').setAttribute('aria-pressed',String(!!lab));$('show').setAttribute('aria-pressed',String(!lab));}
 function resetLab(){audio.stop();age=0;lab=armTurn({seed:settings.seed});rebuild();modeUI();pause(false);$('ruleLog').textContent=`Five empty hexes armed. The push demo has a mortar on step 2 (#${lab.path[1]}).`;}
 $('sandbox').onclick=resetLab;$('resetLab').onclick=resetLab;
 $('demoHit').onclick=()=>{resetLab();age=2.2;lab=pushRival(lab,age+.4);$('ruleLog').textContent='Shared shove motion → contact → eruption → landing. Scrub below to inspect.';view('impact');pause(false);};
 $('impactTimeline').oninput=()=>{if(lab?.push){age=lab.push.start+Number($('impactTimeline').value);pause(true);}};
 for(const id of ['hitOutcome','hitStrength'])$(id).oninput=()=>{settings[id]=id==='hitStrength'?Number($(id).value):$(id).value;sync();};
 $('freezeHit').onclick=()=>{if(lab?.push){age=lab.push.arrival+.25;pause(true);}};
 for(const [id,time] of [['hearAssembly',.9],['hearRetraction',9.9]])$(id).onclick=async()=>{try{soundOn=await audio.enable();if(!soundOn)throw Error('Click again to start audio.');audio.stop();$('sound').textContent='Disable sound';$('audioStatus').textContent=id==='hearAssembly'?'Audition: unlock → lift → lock.':'Audition: release → lower → seal.';lab=null;age=time;rebuild();modeUI();pause(false);}catch(e){$('audioStatus').textContent=e.message;}};
 $('show').onclick=()=>{audio.stop();lab=null;age=0;rebuild();modeUI();pause(false);$('turnStatus').textContent='Show playback · switch to the sandbox to test turn rules.';$('ruleLog').textContent='';};
 $('battle').onclick=()=>{audio.stop();lab=fireRemaining(lab,age+.1,settings.stagger);$('ruleLog').textContent='Battle resolved: unspent mortars fire. They stay spent until the next player turn.';pause(false);};
 $('endTurn').onclick=()=>{lab=fireRemaining(lab,age+.1,settings.stagger);const latest=Math.max(...lab.fireAt);lab={...lab,endAt:Math.max(age+.2,latest+4.5),advanceAt:Math.max(age+1.8,latest+6.2)};$('ruleLog').textContent='Turn concludes: fire any unspent mortars, retract, then relocate for the next player.';pause(false);};
 $('push').onclick=()=>{lab=pushRival(lab,age+.05);$('ruleLog').textContent=lab.hit!=null?`3-space push → stop on step ${lab.push.path.length}, mortar #${lab.hit}. That mortar fires on impact (1 Vibe + Burn in the proposed rules).`:'The push path is clear; no armed mortar was hit.';pause(false);};
 $('pattern').onclick=()=>{settings.seed=settings.seed>=99999?1:settings.seed+1;rebuild();sync();};
 $('defaults').onclick=()=>{settings={...DEFAULTS,volume:.55,bass:1.35,hitStrength:1,hitOutcome:'recover'};$('hitStrength').value=1;$('hitOutcome').value='recover';audio.setBass(1.35);$('bass').value=1.35;$('bassValue').textContent='1.35×';audio.setVolume(.55);$('volume').value=.55;$('volumeValue').textContent='55%';lab=null;audio.stop();rebuild();modeUI();sync();age=0;pause(reduced.matches);view('stage');};
 composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),settings.glow,.55,1.05);composer.addPass(bloom);composer.addPass(new OutputPass());
 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(44)/2)*Math.max(1,.95/camera.aspect)));camera.updateProjectionMatrix();composer.setSize(w,h);pyro.resize(h*renderer.getPixelRatio());dirty=true;}resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
 let last=performance.now(),lastDraw=0;
 function frame(now){if(disposed)return;raf=requestAnimationFrame(frame);if(now-lastDraw<1000/30)return;const dt=Math.min(.1,(now-last)/1000);last=now;if(document.hidden)return;controls.update();if(paused&&!dirty)return;dirty=false;lastDraw=now;const before=age;
  if(!paused){age+=dt*settings.speed;if(!lab&&age>DURATION){audio.stop();if($('loop').checked)age=0;else{age=DURATION;pause(true);}}}
  if(lab&&age>=lab.advanceAt){lab=armTurn({turn:lab.turn+1,positions:lab.positions,seed:settings.seed,previous:lab.hexes,now:age});rebuild();$('ruleLog').textContent=`Player turn ${lab.turn}: new empty positions. Occupied hexes ${lab.positions.join(', ')} excluded.`;}
  if(!paused&&soundOn)for(const c of crossedCues(before,age,settings,lab))audio.play(c.type,c.pan,settings.speed);
  actors.update(age,lab?lab.positions:PAWNS,camera,{sequence:lab?.push,kind:'pyro',knockdown:$('hitOutcome').value==='knockdown',strength:Number($('hitStrength').value),reduced:reduced.matches});
  $('freezeHit').disabled=!lab?.push;$('impactTimeline').disabled=!lab?.push;if(lab?.push)$('impactTimeline').value=Math.min(3.2,Math.max(0,age-lab.push.start));
  if(!paused&&soundOn&&lab?.push)for(let j=0;j<lab.push.path.length-1;j++){const at=lab.push.start+(j*lab.push.plan.total+lab.push.plan.land)/1000;if(before<at&&age>=at)audio.play('step');}
  if(!paused&&soundOn&&lab?.push&&before<lab.push.arrival+.56&&age>=lab.push.arrival+.56)audio.play('lock',0,settings.speed);
  const particles=pyro.update(age,settings,lab);bloom.enabled=settings.bloom;bloom.strength=settings.glow;
  let [phase,desc,label]=phaseAt(age);
  if(lab){const armed=lab.fireAt.filter(t=>t>age).length,busy=Number.isFinite(lab.advanceAt)||age<lab.deployedAt+2.1||age<(lab.push?lab.push.arrival+1.8:0);phase=armed?'Mortars armed':'Salvo spent';if(lab.push&&age>=lab.push.arrival&&lab.hit!=null)phase=age<lab.push.arrival+1.8?'Direct hit!':$('hitOutcome').value==='knockdown'?'Knocked down':'Recovered';desc=lab.hit!=null?'The first armed mortar catches the Rival mid-push.':armed?'Resolve a battle or end the player turn to fire.':'No repeat shots. Next player turn brings a fresh layout.';label=`PLAYER TURN ${lab.turn} · ${armed} / 5 ARMED`;$('turnStatus').textContent=`Turn ${lab.turn} · Rival #${lab.positions[0]} · ${armed} armed · ${5-armed} fired`;$('endTurn').disabled=busy;$('battle').disabled=busy||!lab.fireAt.some(t=>!Number.isFinite(t));$('push').disabled=busy||!lab.path.length||!lab.fireAt.some(t=>!Number.isFinite(t));}
  else for(const id of ['endTurn','battle','push'])$(id).disabled=true;
  $('phase').textContent=phase;$('description').textContent=desc;$('roundLabel').textContent=label;$('timeline').value=lab?0:age;$('clock').textContent=lab?`Turn ${lab.turn}`:`${age.toFixed(1)} / ${DURATION} s`;
  canvas.dataset.loaded='true';canvas.dataset.phase=phase;canvas.dataset.particles=String(particles);canvas.dataset.time=age.toFixed(2);canvas.dataset.audio=audio.status;canvas.dataset.mode=lab?'turns':'show';composer.render();
 }
 raf=requestAnimationFrame(frame);canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(raf);$('error').textContent='Graphics context lost. Reload to restart the preview.';});
}catch(error){$('error').textContent='The preview could not start. A WebGL 2 browser is required.';console.error(error);}
reduced.addEventListener('change',()=>{if(reduced.matches)pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.stop();});
window.addEventListener('pagehide',()=>{disposed=true;audio.dispose();cancelAnimationFrame(raf);resizeObserver?.disconnect();controls?.dispose();actors?.dispose();if(scene)release(scene);composer?.passes.forEach(p=>p.dispose?.());composer?.dispose();renderer?.dispose();});
