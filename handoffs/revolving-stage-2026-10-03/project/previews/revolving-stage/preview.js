import { DEFAULTS,SLIDERS,duration,pose,plan,settle,initialActors,at } from './model.js';
import { createStage } from './stage.js';
import { createAudio } from './audio.js';

const $=id=>document.getElementById(id),media=matchMedia('(prefers-reduced-motion: reduce)'),storage=`rlsw.revolving-stage.v1:${location.pathname}`;
let L={...DEFAULTS,reduced:media.matches};
try{const saved=JSON.parse(localStorage.getItem(storage)||'{}');for(const [k,,min,max]of SLIDERS)if(Number.isFinite(saved[k]))L[k]=Math.max(min,Math.min(max,saved[k]));for(const [k,values]of Object.entries({direction:[-1,1],steps:[1,2],speed:[.5,1],camera:['hero','mechanism','top'],mechanism:['fitted','previous']}))if(values.includes(saved[k]))L[k]=saved[k];for(const k of ['ghosts','numbers','carryFacing','reduced'])if(typeof saved[k]==='boolean')L[k]=saved[k];if(Array.isArray(saved.rings))L.rings=[...new Set(saved.rings.filter(n=>[1,2,3].includes(n)))].sort();else if([1,2,3].includes(saved.radius))L.rings=Array.from({length:saved.radius},(_,i)=>i+1);}catch{/* Optional browser persistence. */}
if(media.matches)L.reduced=true;
let actors=initialActors(),age=0,playing=false,cycle=1,off=false,stage=null,soundOn=false,lastCue='',lastCount=-1,raf,disposed=false;
const audio=createAudio();
const phaseText={warning:'WARNING / DESTINATIONS MARKED',lift:'LATCHES OPEN / DECK RISING',turn:'REVOLVING / HOLD YOUR POSITION',seat:'DECK DESCENDING / ALIGNING',locked:'LOCKED / NEW POSITIONS'};
const cueText={warning:'Gold rings turn. Blue rings stay. Ghosts mark your destination.',lift:'Selected rings lift clear. Unselected rings stay locked.',turn:'Selected rings carry their riders. Everything else holds.',seat:'The teeth align. Every hex returns to the grid.',locked:'New angles. Same stage. Run another rotation to keep going.'};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function persist(){try{localStorage.setItem(storage,JSON.stringify(L));}catch{$('saved').textContent='Storage unavailable. Copy your dial-in to keep these settings.';}}
function sync(){
 for(const [k,,, , ,unit]of SLIDERS){$(k).value=L[k];$(`${k}Value`).textContent=`${Number(L[k]).toFixed(k==='warning'?1:2)}${unit}${L[k]!==DEFAULTS[k]?' *':''}`;$(k).closest('label').classList.toggle('changed',L[k]!==DEFAULTS[k]);}
 for(const k of ['direction','steps','speed','mechanism'])$(k).value=L[k];for(const k of ['ghosts','numbers','carryFacing','reduced'])$(k).checked=L[k];
 for(const n of [1,2,3])$(`ring${n}`).checked=L.rings.includes(n);
 for(const b of document.querySelectorAll('[data-rings]'))b.classList.toggle('active',b.dataset.rings===L.rings.join(','));
 $('ringSummary').textContent=`${L.rings.reduce((sum,n)=>sum+n*6,0)} moving hexes · centre always fixed`;
 for(const b of document.querySelectorAll('[data-camera]'))b.classList.toggle('active',b.dataset.camera===L.camera);
 $('timeline').max=duration(L);$('length').textContent=`${duration(L).toFixed(1)}s`;
 $('dial').value=JSON.stringify({study:'Revolving Stage',version:3,settings:L,changed:Object.fromEntries(Object.entries(L).filter(([k,v])=>!same(v,DEFAULTS[k]))),untouched:Object.keys(L).filter(k=>same(L[k],DEFAULTS[k])),rules:'Preview proposal: rotate only the selected rings together; unselected rings, centre and outside fixed; carry amps; no damage.'},null,2);
 const moves=plan(actors,L);
 $('riders').innerHTML=moves.map(a=>`<div class="rider ${a.riding?'':'fixed'}" style="--color:${a.color}"><span class="name">${a.name}</span><span>#${a.num}</span><span>${a.riding?'→':'·'}</span><span class="destination">#${a.to}</span><span class="status">${a.riding?'RIDES':a.num===56?'CENTRE HOLDS':'STAYS PUT'}</span></div>`).join('');
 $('stepOff').textContent=off?'Return Ronin to deck':'Step Ronin off';$('cycle').textContent=`CYCLE ${String(cycle).padStart(2,'0')}`;
 persist();
}
function stop(){playing=false;audio.stop();lastCue='';lastCount=-1;}
function beginPlan(){stop();age=0;sync();stage?.configure(L,actors);}
function retainCompleted(){if(age>=duration(L)){actors=settle(actors,L);cycle++;}}
function change(key,value){retainCompleted();L[key]=value;beginPlan();}
for(const [k,label,min,max,step]of SLIDERS){const row=document.createElement('label');row.className='slider';row.innerHTML=`<span>${label}<output id="${k}Value"></output></span><input type="range" id="${k}" aria-label="${label}" min="${min}" max="${max}" step="${step}">`;$('sliders').append(row);$(k).oninput=()=>change(k,Number($(k).value));}
// Compare the casing at the same instant, without restarting the motion.
$('mechanism').onchange=()=>{L.mechanism=$('mechanism').value;sync();stage?.configure(L,actors);};
for(const k of ['direction','steps'])$(k).onchange=()=>change(k,Number($(k).value));
for(const n of [1,2,3])$(`ring${n}`).onchange=()=>change('rings',[1,2,3].filter(i=>$(`ring${i}`).checked));
for(const b of document.querySelectorAll('[data-rings]'))b.onclick=()=>change('rings',b.dataset.rings.split(',').map(Number));
for(const k of ['ghosts','numbers','carryFacing','reduced'])$(k).onchange=()=>change(k,$(k).checked);
$('speed').onchange=()=>{L.speed=Number($('speed').value);audio.stop();lastCue='';sync();};
for(const b of document.querySelectorAll('[data-camera]'))b.onclick=()=>{L.camera=b.dataset.camera;sync();stage?.view(L.camera);};
$('run').onclick=()=>{if(age>=duration(L)){actors=settle(actors,L);cycle++;age=0;sync();stage?.configure(L,actors);}playing=true;lastCue='';lastCount=-1;};
$('pause').onclick=()=>{if(playing)stop();else{playing=true;lastCue='';}};
$('timeline').oninput=()=>{stop();age=Number($('timeline').value);};
for(const b of document.querySelectorAll('[data-beat]'))b.onclick=()=>{stop();age={warning:.5,lift:L.warning+.4,turn:L.warning+.8+L.turnTime*.5,seat:L.warning+.8+L.turnTime+.4}[b.dataset.beat];};
$('reset').onclick=()=>{actors=initialActors();cycle=1;off=false;beginPlan();};
$('stepOff').onclick=()=>{retainCompleted();off=!off;actors=actors.map(a=>a.id==='ronin'?{...a,num:off?at(-4,2):at(-1,1)}:a);if(!off){const ronin=actors.find(a=>a.id==='ronin');const other=actors.find(a=>a.id!=='ronin'&&a.num===ronin.num);if(other)other.num=at(-1,0);}beginPlan();};
$('lookReset').onclick=()=>{retainCompleted();L={...DEFAULTS,reduced:media.matches};beginPlan();stage?.view(L.camera);};
$('copy').onclick=async()=>{$('dial').hidden=false;$('dial').select();try{await navigator.clipboard.writeText($('dial').value);$('saved').textContent='Copied. Paste this into our chat; * marks settings changed from the defaults.';}catch{$('saved').textContent='Settings selected. Press Ctrl+C to copy.';}};
$('sound').onclick=async()=>{try{soundOn=await audio.toggle();$('sound').textContent=soundOn?'Mechanical sound on · mute':'Enable mechanical sound';$('audioNote').textContent=soundOn?'Warning ticks, lifting motors and a locking clunk.':'Sound is off.';lastCue='';lastCount=-1;}catch{$('audioNote').textContent='Audio could not start. The visual preview is still available.';}};
sync();
try{stage=createStage($('stage'),actors,L);$('load').hidden=true;}catch(e){console.error(e);$('load').textContent='The turntable needs WebGL. Reload this preview in a browser with 3D support.';$('run').disabled=true;}
let previous=performance.now();
function render(now){if(disposed)return;const dt=Math.min(.06,(now-previous)/1000);previous=now;
 if(playing&&!document.hidden){age=Math.min(duration(L),age+dt*L.speed);if(age>=duration(L))stop();}
 const p=pose(age,L);$('phase').textContent=L.rings.length?phaseText[p.phase]:'ALL RINGS LOCKED';$('cue').textContent=L.rings.length?cueText[p.phase]:'Choose a ring to see who will ride it.';$('countdown').hidden=!(playing&&p.phase==='warning'&&L.rings.length);$('countdown').textContent=p.countdown;
 $('timeline').value=age;$('elapsed').textContent=`${age.toFixed(1)}s`;$('run').disabled=playing||!stage||!L.rings.length;$('run').textContent=p.done?'Next rotation':age>0?'Resume rotation':'Run rotation';$('pause').disabled=age===0||p.done||!stage||!L.rings.length;$('pause').textContent=playing?'Pause':'Resume';
 for(const b of document.querySelectorAll('[data-beat]'))b.classList.toggle('active',b.dataset.beat===p.phase||(b.dataset.beat==='seat'&&p.phase==='locked'));
 if(playing&&soundOn){if(p.phase!==lastCue){audio.cue(p.phase,L.turnTime/L.speed);lastCue=p.phase;lastCount=p.countdown;}else if(p.phase==='warning'&&lastCount!==p.countdown){audio.cue('warning');lastCount=p.countdown;}}
 stage?.render(age,p,actors);raf=requestAnimationFrame(render);
}
raf=requestAnimationFrame(render);
function visibility(){if(document.hidden)stop();}document.addEventListener('visibilitychange',visibility);
function reduced(){if(media.matches)change('reduced',true);}media.addEventListener('change',reduced);
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',reduced);audio.dispose();stage?.dispose();},{once:true});
