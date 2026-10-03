# Revolving Stage — editable source bundle

Read CLAUDE_REVOLVING_STAGE_HANDOFF.md first. Paths below are original repository paths;
packaged preview sources live in project/previews/revolving-stage/. Character PNGs are
in the ZIP. START_HERE.html is a prebuilt snapshot, not the editable source.

## .scratch/revolving-stage/audio.js

Packaged at: project/previews/revolving-stage/audio.js

````````text
// A gesture-enabled, quiet mechanical bed. All voices stop on pause/seek/change.
export function createAudio(){let ctx=null,master=null,enabled=false,voices=[];
 function stop(){for(const {osc,gain} of voices){try{osc.stop();}catch{/* already ended */}osc.disconnect();gain.disconnect();}voices=[];}
 function tone(frequency,duration,volume,type='sine',end=frequency){if(!enabled||!ctx||ctx.state!=='running')return;const osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;osc.type=type;osc.frequency.setValueAtTime(frequency,now);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),now+duration);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.02);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain);gain.connect(master);const voice={osc,gain};voices.push(voice);osc.onended=()=>{osc.disconnect();gain.disconnect();voices=voices.filter(v=>v!==voice);};osc.start();osc.stop(now+duration+.02);}
 return {async toggle(){if(enabled){enabled=false;stop();return false;}ctx??=new AudioContext();master??=ctx.createGain();master.gain.value=.3;master.disconnect();master.connect(ctx.destination);await ctx.resume();enabled=true;return true;},cue(phase,length=3){if(phase==='warning')tone(440,.12,.06,'sine',330);if(phase==='lift'){tone(75,.28,.12,'triangle',35);tone(110,.7,.045,'sawtooth',65);}if(phase==='turn'){tone(62,length,.045,'triangle',80);tone(125,length,.013,'sawtooth',110);}if(phase==='seat'){tone(82,.5,.1,'triangle',32);tone(620,.15,.025,'sine',170);}if(phase==='locked'){tone(330,.24,.03);tone(660,.4,.012);}},stop,dispose(){enabled=false;stop();ctx?.close();}};
}

````````

## .scratch/revolving-stage/check.mjs

Packaged at: project/previews/revolving-stage/check.mjs

````````text
// One-off evidence for this scratch study, not a production engine suite.
import assert from 'node:assert/strict';
import { ALL_HEXES } from '../../src/board/hexMap.js';
import { DEFAULTS,sector,destination,world,initialActors,settle,pose,duration } from './model.js';
let count=0;const ok=(c,m)=>{assert.ok(c,m);count++;};
for(let mask=0;mask<8;mask++)for(const direction of [-1,1])for(const steps of [1,2]){
 const rings=[1,2,3].filter(n=>mask&(1<<(n-1))),L={...DEFAULTS,rings,direction,steps},cells=sector(rings),targets=cells.map(h=>destination(h.num,L));
 ok(cells.length===rings.reduce((sum,n)=>sum+n*6,0),'exact selected-ring footprint');ok(new Set(targets).size===cells.length,'bijective rotation: no blocked or duplicated landing cells');
 ok(targets.every(n=>cells.some(h=>h.num===n)),'destinations remain within moving sector');
 for(const h of ALL_HEXES){const dest=destination(h.num,L),moving=cells.some(c=>c.num===h.num);if(!moving){ok(dest===h.num,'unselected rings, centre and outside stay fixed');continue;}
  const p=world(h.num),q=world(dest),angle=-direction*steps*Math.PI/3;
  ok(Math.hypot(p.x*Math.cos(angle)+p.z*Math.sin(angle)-q.x,p.z*Math.cos(angle)-p.x*Math.sin(angle)-q.z)<1e-8,'physical turn meets exact numbered destination');
  ok(destination(dest,{...L,direction:-direction})===h.num,'reverse is exact inverse');
 }
 let actors=initialActors();for(let i=0;i<6/steps;i++)actors=settle(actors,L);
 ok(actors.every((a,i)=>a.num===initialActors()[i].num),'full revolution restores actors');
 const end=pose(duration(L),L);ok(end.done&&end.phase==='locked'&&end.lift===0,'locks flat at end');
 for(const reduced of [false,true])for(let i=0;i<=100;i++){const p=pose(duration(L)*i/100,{...L,reduced});ok(Number.isFinite(p.displayAngle)&&Number.isFinite(p.displayLift),'finite scrub poses');if(reduced)ok(p.displayLift===0,'reduced motion never lifts');}
}
const frozen=initialActors();const before=JSON.stringify(frozen);settle(frozen,DEFAULTS);ok(JSON.stringify(frozen)===before,'settlement does not mutate prior timeline state');
const facing=settle(frozen,{...DEFAULTS,carryFacing:false});ok(facing.every((a,i)=>a.yaw===frozen[i].yaw),'optional facing preserved');
console.log(`Revolving-stage study: ${count} checks passed.`);

````````

## .scratch/revolving-stage/index.html

Packaged at: project/previews/revolving-stage/index.html

````````text
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revolving Stage · Spirit Wars</title><link rel="stylesheet" href="./style.css"></head><body>
<header><a class="brand" href="../../"><b>SW</b><span>SPIRIT WARS<small>STAGE EFFECT WORKSHOP</small></span></a><span class="edition">06 / MECHANICAL MISCHIEF</span></header>
<section class="intro"><div><span class="eyebrow">THE FLOOR HAS A MOVE OF ITS OWN</span><h1>Revolving <em>stage.</em></h1><p>Read the arrows. Ride the deck. Reconsider your next move.</p></div><div class="preview">PLAYABLE CONCEPT<span>Rules proposal · not in the live game</span></div></section>
<main><section class="show">
 <div id="stage"><div class="stage-top"><span><i></i><b id="phase">READY TO REVOLVE</b></span><small>Drag to orbit · scroll to zoom</small></div><div id="load">Assembling the turntable…</div><div id="countdown" hidden>3</div><div class="stage-bottom"><span id="cue">The gold hexes move. The centre holds.</span><div class="views"><button data-camera="hero" class="active">Arena</button><button data-camera="mechanism">Mechanism</button><button data-camera="top">Top-down</button></div></div></div>
 <div class="transport"><button class="primary" id="run">Run rotation</button><button id="pause" disabled>Pause</button><button id="reset">Reset positions</button><span id="cycle">CYCLE 01</span></div>
 <div class="timeline"><span id="elapsed">0.0s</span><input id="timeline" aria-label="Sequence timeline" type="range" min="0" max="8.6" step=".01" value="0"><span id="length">8.6s</span></div>
 <div class="beats"><button data-beat="warning">01 · Warn</button><button data-beat="lift">02 · Unlock & lift</button><button data-beat="turn">03 · Revolve</button><button data-beat="seat">04 · Seat & lock</button></div>
 <section class="manifest"><div class="manifest-title"><div><span class="eyebrow">YOUR DESTINATION, BEFORE THE TURN</span><h2>See who rides.</h2></div><button id="stepOff">Step Ronin off</button></div><div id="riders"></div><p id="planNote">An occupied destination is safe: its rider leaves at the same moment.</p></section>
 <div class="principles"><div><b>THE CENTRE HOLDS</b><p>Limelight stays put. A Spirit holding centre watches the fight rearrange around them.</p></div><div><b>POSITION IS THE PAYOFF</b><p>No damage in this proposal. The opportunity is a new angle, a getaway or a rival delivered to your doorstep.</p></div><div><b>NO SURPRISE DESTINATIONS</b><p>Ghost markers show the landing hexes. The warning gives everyone time to plan before the machinery moves.</p></div></div>
</section><aside><section class="card"><span class="eyebrow">THE MECHANISM</span><h2>Choose your turn.</h2>
 <fieldset class="ring-select"><legend>Which rings move?</legend>
 <label><input type="checkbox" id="ring1" checked><span>01 · Inner ring<small>6 hexes · Ronin & Monster start here</small></span></label>
 <label><input type="checkbox" id="ring2" checked><span>02 · Middle ring<small>12 hexes · Drive amp starts here</small></span></label>
 <label><input type="checkbox" id="ring3"><span>03 · Outer ring<small>18 hexes · Intergalactic 0 starts here</small></span></label>
 </fieldset><div class="ring-presets"><button data-rings="3">Outer only</button><button data-rings="1,3">Alternate rings</button><button data-rings="1,2,3">All three</button></div><p id="ringSummary" class="small">18 moving hexes · centre fixed</p>
 <label class="select">Direction<select id="direction"><option value="1">Clockwise ↻</option><option value="-1">Counterclockwise ↺</option></select></label>
 <label class="select">Rotation<select id="steps"><option value="1">60° · one sector</option><option value="2">120° · two sectors</option></select></label>
 <div class="mini-note">Selected rings lift and turn together. Unselected rings stay locked. Every 60° step lands exactly on the hex grid.</div>
 <label class="select">Mechanism design<select id="mechanism"><option value="fitted">Fitted to hex openings</option><option value="previous">Previous circular carrier</option></select></label>
 <div id="sliders"></div>
 <div class="toggles"><label>Destination ghosts<input id="ghosts" type="checkbox" checked></label><label>Hex numbers<input id="numbers" type="checkbox"></label><label>Facing turns with deck<input id="carryFacing" type="checkbox" checked></label><label>Reduced motion<input id="reduced" type="checkbox"></label></div>
 <label class="select">Playback<select id="speed"><option value="1">Normal speed</option><option value="0.5">Half speed</option></select></label>
 <button id="sound" class="full">Enable mechanical sound</button><p id="audioNote" class="small">Sound starts only when enabled.</p>
 </section><section class="card handoff"><span class="eyebrow">MAKE IT YOURS</span><p>Changing a control restarts this cycle. Completed rotations become the starting point for the next one.</p><div><button id="copy" class="primary">Copy dial-in</button><button id="lookReset">Reset look</button></div><textarea id="dial" readonly hidden aria-label="Copyable revolving stage settings"></textarea><p id="saved" class="small">Saved in this browser. Copy before moving the page or switching browsers.</p></section></aside></main>
<footer><span>SPIRIT WARS / REVOLVING STAGE</span><span>PROTOTYPE · ACTUAL HEX MAP & SPIRIT ART · PROPOSED MOVEMENT RULES</span></footer>
<script type="module" src="./preview.js"></script></body></html>

````````

## .scratch/revolving-stage/model.js

Packaged at: project/previews/revolving-stage/model.js

````````text
import { ALL_HEXES, HEX_BY_NUM, HEX_BY_QR } from '../../src/board/hexMap.js';

export const DEFAULTS = Object.freeze({rings:Object.freeze([1,2]),direction:1,steps:1,warning:3,turnTime:3,lift:.85,glow:1,bloom:.38,speed:1,ghosts:true,numbers:false,carryFacing:true,reduced:false,camera:'hero',mechanism:'fitted'});
// .70 leaves the cassette's lowest edge (-.435) above the fixed tile top (.20)
// throughout the turn, even at the slider minimum.
export const SLIDERS=[['warning','Warning time',1,6,.5,'s'],['turnTime','Rotation time',1.5,6,.25,'s'],['lift','Deck lift',.7,1.5,.05,'m'],['glow','Signal glow',.2,2,.1,'×'],['bloom','Bloom',0,.8,.01,'']];
const hub=HEX_BY_NUM[56];
export const clamp=n=>Math.max(0,Math.min(1,n));
export const ease=n=>{const u=clamp(n);return u*u*u*(u*(u*6-15)+10);};
export const local=h=>({q:h.q-hub.q,r:h.r-hub.r});
export const distance=num=>{const {q,r}=local(HEX_BY_NUM[num]);return Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r));};
export const ringNumbers=selection=>Array.isArray(selection)?selection:Array.from({length:selection},(_,i)=>i+1);
export const affected=(num,selection)=>ringNumbers(selection).includes(distance(num));
// The game's numbered axial map on a regular lattice. This removes the source
// board image's slight horizontal stretch, so each physical 60° turn seats exactly.
export function world(num,y=.2){const {q,r}=local(HEX_BY_NUM[num]);return {x:q*1.95*Math.sqrt(3)/2,y,z:(r+q/2)*1.95};}
export function at(q,r){return HEX_BY_QR[`${hub.q+q},${hub.r+r}`]?.num;}
export function destination(num,L){
 if(!affected(num,L.rings))return num;
 let {q,r}=local(HEX_BY_NUM[num]);
 const turns=((L.direction*L.steps)%6+6)%6;
 for(let i=0;i<turns;i++)[q,r]=[-r,q+r];
 const result=at(q,r);
 if(result==null)throw Error(`Rotation leaves board: ${num}`);
 return result;
}
export const sector=selection=>ALL_HEXES.filter(h=>affected(h.num,selection));
export const duration=L=>L.warning+.8+L.turnTime+.8+1;
export function pose(t,L){
 const liftStart=L.warning,turnStart=liftStart+.8,seatStart=turnStart+L.turnTime,locked=seatStart+.8;
 const progress=ease((t-turnStart)/L.turnTime);
 const rise=ease((t-liftStart)/.8)*(1-ease((t-seatStart)/.8));
 const phase=t<liftStart?'warning':t<turnStart?'lift':t<seatStart?'turn':t<locked?'seat':'locked';
 return {phase,angle:-L.direction*L.steps*Math.PI/3*progress,lift:L.lift*rise,progress,
  countdown:Math.max(0,Math.ceil(liftStart-t)),done:t>=duration(L),
  // Reduced motion is a dissolve-free, single relocation at the lock beat.
  displayAngle:L.reduced?(t>=locked?-L.direction*L.steps*Math.PI/3:0):-L.direction*L.steps*Math.PI/3*progress,
  displayLift:L.reduced?0:L.lift*rise};
}
export function initialActors(){return [
 {id:'ronin',name:'Ronin',art:'cosmic_ronin',color:'#72d6ff',num:at(-1,1),yaw:.3},
 {id:'monster',name:'Monster',art:'Metalness_Monster',color:'#ff977e',num:at(0,1),yaw:-.3},
 {id:'glam',name:'Glamarchy',art:'Glamarchy',color:'#ffe28d',num:56,yaw:0},
 {id:'zero',name:'Intergalactic 0',art:'intergalactic_0',color:'#c3a3ff',num:at(3,-1),yaw:0},
 {id:'amp',name:'Drive amp',color:'#72d6ff',num:at(1,1),yaw:0,amp:true},
 ];}
export function plan(actors,L){return actors.map(a=>({...a,to:destination(a.num,L),riding:affected(a.num,L.rings)}));}
export function settle(actors,L){return plan(actors,L).map(({to,riding,...a})=>({...a,num:to,yaw:a.yaw+(riding&&L.carryFacing?-L.direction*L.steps*Math.PI/3:0)}));}

````````

## .scratch/revolving-stage/preview.js

Packaged at: project/previews/revolving-stage/preview.js

````````text
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

````````

## .scratch/revolving-stage/README.md

Packaged at: project/previews/revolving-stage/README.md

````````text
# Revolving Stage — interactive graphics and movement proposal

Created 2026-10-03 for Alex: “I like the Revolving Stage idea — can you show in
a preview how you might build that out?”

Open http://127.0.0.1:5175/RLSW/.scratch/revolving-stage/ with the existing local
Vite server. To start another server from the repository root:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175
```

The files remain in `.scratch/`, following CLAUDE.md's visual-preview-first rule.
Nothing is wired into the live stage-effect deck, engine, or renderer. The bat
models, crumbling build, and their earlier handoff remain untouched.

## Proposed behavior

A central annular turntable carries the selected hex rings together. Alex's
follow-up requested specific rings turning while others stay put. Independent
checkboxes select inner (6), middle (12), and outer (18) rings; any combination
is supported, including inner + outer with a stationary middle. Quick presets
offer Outer only, Alternate rings, and All three. The raised carrier now follows
the actual hex openings, including the inner boundary of isolated rings.
Closed steel housings and inset brass ribs remain attached to the moving cells.
The circular drive gears rotate below the deck without rising through the fixed
floor. No visibility toggle or fade hides the moving machinery during descent.
“Mechanism design” compares this with the previous circular carrier at the same
timeline position; it persists and is included in the version-3 dial-in.
Latches retract smoothly before lift and close after seating. The lift slider
minimum is now 0.70, enough to clear the fitted housings above the fixed tiles;
the default 0.85 lift and the original lift/turn/seat timing and easing remain.
The Limelight centre, unselected rings and outside cells stay fixed. Direction can be clockwise or counterclockwise;
each cycle turns by 60° or 120°. This is a simultaneous permutation: even when a
destination was occupied, its occupant is leaving in the same rotation.

Warning arrows and per-rider coloured paths/ghost landing markers → latches
retract → deck rises clear of surrounding tiles → gears rotate it → it seats
and locks. Spirits and the sample Drive amp ride with the deck. Facing can turn
with it or remain unchanged. There is no damage in this proposal.

Ronin and Monster begin on the inner ring; the amp is on ring two; Glamarchy
holds Limelight; Intergalactic 0 starts on ring three (fixed under the default
inner+middle selection, rides when the outer ring is selected). “Step
Ronin off” is a fixture-editing control, not a simulated legal movement action.
Returning him restores a clear fixture, moving Monster aside if needed.

“Next rotation” starts from the previous cycle's completed destinations.
Scrubbing the timeline never mutates the starting positions. Changing look or
movement controls restarts the current cycle; a completed cycle is retained.
Reset positions restores the fixture without losing the dial-in.

## What is shown

The actual 111-cell hex topology and Spirit acrylic artwork, on a procedural
mechanical board. It does not load the live arena GLB: the deck must split into
movable cells. Coordinates use a regular axial lattice, removing the source
board image's slight horizontal stretch so 60° rotation endpoints fit exactly.

Steel slabs, fitted steel housings and brass ribs, recessed circular drive gears,
fixed bearings and locking blocks, illuminated borders, a lower chassis, star field,
and the shipped standee renderer. Hex numbers mark fixed board addresses; they
hide while the deck lifts and return when it locks.

Three cameras: Arena, Mechanism, Top-down; drag to orbit and scroll to zoom.
Timeline and individual phase buttons; optional half-speed; five numeric visual
controls; movement selectors; destination, labels, facing and reduced-motion
toggles. Reduced motion uses a single relocation at the locking beat with no
lift or spin. It still communicates phases in text.

Optional gesture-enabled mechanical audio: warning ticks, lifting motor, rotation
hum and lock clunk. Pause, seek, settings changes and hidden tabs stop active
voices. No sound starts automatically and no recordings are downloaded.

## Dial-in and remaining decisions

Preferences persist under `rlsw.revolving-stage.v1:<pathname>`; old footprint-size
settings migrate to the matching ring selection. They restore into
both the renderer and the controls. Copy dial-in shows selectable JSON before
attempting clipboard access and separates changed/default settings. Sound stays
off after reload; the scenario resets but preferences persist.

Alex requested independently selectable rings. These remain proposals, not Alex's rulings: fixed centre, carrying
amps and facing, no damage, default 18-cell/60° turn, and one shared movement
beat and one shared direction for the selected rings. Live cadence is not decided; the seconds in the preview only demonstrate
the choreography. No interactions with crumbling holes, smoke, lasers, bats,
ability movement, or other board objects are implemented. Decide those before
production integration. Do not treat QA settings or exported test values as
Alex's chosen dial-in.

## Files and verification

- `model.js`: pure footprint, axial destination, immutable settlement and timeline.
- `stage.js`: Three.js machinery, board, standees, camera and destination markers.
- `preview.js`: controls, fixture, persistence, timeline and phase/audio dispatch.
- `audio.js`: opt-in local synthesis and teardown.
- `index.html`, `style.css`: desktop preview and narrow-pane layout.
- `check.mjs`: one-off scratch evidence. Run `node .scratch/revolving-stage/check.mjs`.

Verification: **13,986 checks passed** across all eight ring selections (including
none), both directions and both angles,
unique valid destinations, physical endpoint agreement, inverse turns, full
revolution, immutable settlement, facing retention, finite scrub poses and
reduced-motion lift suppression. Unselected ring destinations stay fixed.
Syntax and preview bundle pass; **zero bundle
warnings** with media stubbed.

Browser: full normal cycle reached Locked, reverse cycle planned return to each
original hex, smaller footprint leaves the amp stationary, stepping Ronin off
removes him from the riders, reduced-motion sequence and export worked, restored
controls survived reload. Mechanical audio was successfully enabled; its sound
quality has not been auditioned on speakers. No browser errors/warnings observed.

The repository-wide suite was already run in this conversation before this
isolated preview: it stops at the existing selftest.mjs:457 combat expectation
(actual 4 vs expected 11). No production source was changed for this study.

Clearance revision browser check: adjacent rings at full lift, early/half/late
descent and final seating; separated rings at the 0.70 minimum lift; switching
the fitted/previous comparison without moving the timeline. 13,986 existing
movement checks still pass; preview bundle has zero warnings; browser console
has no warnings/errors. `preview-clearance.png` shows the fitted casing early
in descent. This is visual clearance work, not an engineered drivetrain or a
new gameplay implementation.

In plain terms: see where the floor will take everyone, then ride it or step off.
The whole point is a new position and a new angle on the fight.

````````

## .scratch/revolving-stage/stage.js

Packaged at: project/previews/revolving-stage/stage.js

````````text
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

````````

## .scratch/revolving-stage/style.css

Packaged at: project/previews/revolving-stage/style.css

````````text
:root{color-scheme:dark;font-family:'Segoe UI',Arial,sans-serif;color:#e4e8e9;background:#0a1015;--gold:#e6b976;--line:#2a353b;--muted:#8c9ca4}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 30% 0,#1e2b304d,transparent 50%),#0a1015}header,.intro,main,footer{max-width:1600px;margin:auto}header{height:86px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 32px}.brand{display:flex;gap:14px;align-items:center;text-decoration:none;color:inherit}.brand b{font:italic 800 28px Georgia,serif;color:var(--gold);border:1px solid #806b4b;padding:5px}.brand span{font-size:12px;font-weight:600;letter-spacing:2px}.brand small{display:block;font-size:8px;color:var(--muted);letter-spacing:1.5px;margin-top:5px}.edition,.eyebrow,.preview,footer,.stage-top,#cycle{font-family:Consolas,monospace;font-size:9px;letter-spacing:1.7px}.edition{color:#829399}.intro{display:flex;align-items:center;justify-content:space-between;padding:29px 32px 25px}.eyebrow{color:#b29b77;font-size:9px}h1{font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:clamp(40px,4.2vw,62px);letter-spacing:-2px;line-height:1.1;margin:10px 0 12px}h1 em{color:var(--gold);font-weight:400}.intro p{color:#8e9ea6;font-size:13px;margin:0}.preview{text-align:right;color:#d1baa0;line-height:2}.preview span{display:block;font-size:9px;color:#71848e;letter-spacing:.2px}main{padding:0 32px;display:grid;grid-template-columns:minmax(0,1fr) 294px;gap:22px;align-items:start}.show{min-width:0}#stage{height:clamp(430px,48vw,670px);background:#080f16;border:1px solid #3a403d;position:relative;border-radius:5px;overflow:hidden}#stage canvas{display:block;width:100%;height:100%;touch-action:none}.stage-top{position:absolute;top:19px;left:20px;right:20px;display:flex;justify-content:space-between;z-index:1;pointer-events:none;color:#d3c0a2}.stage-top i{display:inline-block;width:6px;height:6px;background:var(--gold);border-radius:50%;margin-right:9px;box-shadow:0 0 12px #e6b976}.stage-top b{font-weight:400}.stage-top small{color:#758c97;letter-spacing:.2px;font:10px 'Segoe UI',sans-serif}.stage-bottom{position:absolute;bottom:0;left:0;right:0;padding:35px 18px 17px;display:flex;justify-content:space-between;align-items:end;gap:12px;background:linear-gradient(transparent,#080e16e8);pointer-events:none}.stage-bottom>span{font-size:12px;color:#c3c7c6;max-width:50%;line-height:1.6}.views{display:flex;gap:4px;pointer-events:auto}.views button{font-size:10px;padding:7px 9px;background:#0c151cdd}button,select{font:11px 'Segoe UI',sans-serif;color:#c6d0d4;border:1px solid #35454c;background:#152129;border-radius:3px;padding:10px 12px;cursor:pointer}button:hover:not(:disabled){background:#24343b;border-color:#9c8667}button:disabled{opacity:.3;cursor:not-allowed}button.active{border-color:var(--gold);color:var(--gold);background:#352d2399}button:focus-visible,select:focus-visible,input:focus-visible,textarea:focus-visible,a:focus-visible{outline:2px solid var(--gold);outline-offset:3px}.primary{background:var(--gold);border-color:var(--gold);color:#251b0f;font-weight:700}.primary:hover:not(:disabled){background:#f4d19f;color:#251b0f}.transport{display:flex;gap:8px;align-items:center;padding:16px 0 9px}#cycle{margin-left:auto;color:#788d95}.timeline{display:flex;align-items:center;gap:12px;padding:7px 0 15px;color:#79909b;font:10px Consolas,monospace}.timeline input{flex:1}input[type=range]{accent-color:var(--gold);height:4px;cursor:pointer}.beats{display:flex;gap:6px}.beats button{flex:1;font-size:10px;background:#101b23;padding:10px 4px}.beats button.active{color:var(--gold)}.manifest{border:1px solid var(--line);padding:20px;margin-top:22px;border-radius:4px;background:#0f1920}.manifest-title{display:flex;align-items:center;justify-content:space-between;gap:12px}h2{font-size:17px;font-weight:500;margin:10px 0 16px;letter-spacing:-.2px}.manifest-title h2{margin-bottom:18px}.manifest-title button{white-space:nowrap;font-size:10px}.rider{display:grid;grid-template-columns:1.6fr .8fr .35fr .8fr 1fr;align-items:center;border-top:1px solid #233139;padding:11px 0;font:11px Consolas,monospace;color:#8da2ac;gap:8px}.rider .name{font:12px 'Segoe UI',sans-serif;color:var(--color)}.rider .name:before{content:'';display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--color);margin-right:9px}.rider .destination{color:#e2c598}.rider .status{text-align:right;font-size:9px;color:#a49b84}.rider.fixed{opacity:.58}#planNote{margin:12px 0 0;font-size:10px;color:#78909d;line-height:1.6}.principles{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:22px 0}.principles b{font:9px Consolas,monospace;color:#aa967a;letter-spacing:1px}.principles p{font-size:11px;color:#7f949f;line-height:1.7;margin:9px 0}.card{background:#111c23;border:1px solid var(--line);padding:21px;margin-bottom:16px;border-radius:4px}.select{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#a2b4bd;margin:15px 0;gap:8px}.select select{max-width:160px;font-size:10px;padding:8px;background:#0e171e}.mini-note{padding:10px 12px;background:#20271f;color:#a1ad94;line-height:1.6;font-size:10px;border-left:2px solid #717c50;margin:18px 0}.slider{display:block;margin:19px 0}.slider>span{display:flex;justify-content:space-between;font-size:11px;color:#a8bac2}.slider input{width:100%;margin:12px 0 2px}.slider output{font:10px Consolas,monospace;color:#c6b18f}.slider.changed>span{color:#f2cf98}.toggles{border-top:1px solid var(--line);margin-top:21px;padding-top:8px}.toggles label{display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#a5b6bf;margin:13px 0}input[type=checkbox]{accent-color:var(--gold);margin:0}.full{width:100%}.small{font-size:9px;line-height:1.6;color:#6d8794;margin:10px 0 0}.handoff>p{font-size:11px;line-height:1.7;color:#8299a5}.handoff>div{display:flex;gap:6px;margin-top:17px}.handoff button{font-size:10px}.handoff textarea{width:100%;height:120px;background:#09131b;border:1px solid #3e4c50;color:#d4c4a9;font:10px monospace;padding:10px;margin-top:15px}footer{display:flex;justify-content:space-between;gap:18px;color:#566f7d;font-size:8px;padding:24px 32px 30px;border-top:1px solid #223039}#countdown{position:absolute;top:16%;left:50%;transform:translateX(-50%);font:54px Georgia,serif;color:#f5d09a;text-shadow:0 0 30px #ffb34766;pointer-events:none}#load{position:absolute;inset:0;display:grid;place-items:center;color:#d9c29e;z-index:2;background:#081018}#load[hidden]{display:none}@media(max-width:1050px){main{grid-template-columns:minmax(0,1fr) 260px;padding:0 20px;gap:16px}.card{padding:16px}.stage-top small{display:none}.stage-bottom{align-items:start;flex-direction:column}.stage-bottom>span{max-width:100%}.intro,header{padding-left:20px;padding-right:20px}}@media(max-width:820px){main{grid-template-columns:1fr}.preview{display:none}#stage{height:490px}.stage-bottom{flex-direction:row;align-items:end}.stage-bottom>span{max-width:45%}aside{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}.edition{font-size:8px}.card{margin:0}.principles{gap:12px}}@media(max-width:560px){aside{grid-template-columns:1fr}.brand small{font-size:6px}.brand span{font-size:10px}.brand b{font-size:23px}.edition{display:none}h1{font-size:43px}.intro p{line-height:1.6}.transport{flex-wrap:wrap}#cycle{font-size:8px}.beats{flex-wrap:wrap}.beats button{flex-basis:40%}.principles{grid-template-columns:1fr;gap:8px}.manifest{padding:14px}.rider{grid-template-columns:1.5fr .7fr .2fr .7fr .8fr;font-size:10px;gap:4px}.rider .name{font-size:10px}.stage-bottom{flex-direction:column;align-items:start}.stage-bottom>span{max-width:100%}footer{font-size:7px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}

.ring-select{border:0;padding:0;margin:16px 0 12px}.ring-select legend{font-size:11px;color:#b6c5cb;margin-bottom:12px}.ring-select label{display:flex;align-items:center;gap:10px;margin:7px 0;padding:10px 9px;background:#0c171f;border:1px solid #2b3b43;border-radius:3px;cursor:pointer}.ring-select label:has(input:checked){border-color:#a28b60;background:#2b2921}.ring-select span{font-size:11px;color:#d0c4aa}.ring-select small{display:block;font-size:8px;color:#7f949e;margin-top:4px}.ring-presets{display:flex;gap:4px}.ring-presets button{flex:1;font-size:9px;padding:8px 3px}.ring-presets button.active{color:var(--gold);border-color:#a28b60;background:#2b2921}

````````

## src/board/constants.js

Packaged at: project/src/board/constants.js

````````text
// ─── BOARD CONSTANTS ─────────────────────────────────────────────────────────
export const IMG_W = 6522;
export const IMG_H = 4839;
export const HEX_SIZE = 195;
export const SCALE = 0.12;
export const SVG_W = Math.round(IMG_W * SCALE);
export const SVG_H = Math.round(IMG_H * SCALE);
export const COL_SPACING = 330;
export const ROW_SPACING = 390;

````````

## src/board/hexMap.js

Packaged at: project/src/board/hexMap.js

````````text
// ─── 111-HEX MAP ──────────────────────────────────────────────────────────────
import { HEX_SIZE, COL_SPACING, ROW_SPACING } from "./constants.js";

export const COLUMNS = [
  [1,2,3,4,5],
  [6,7,8,9,10,11,12,13],
  [14,15,16,17,18,19,20,21,22],
  [23,24,25,26,27,28,29,30,31,32],
  [33,34,35,36,37,38,39,40,41],
  [42,43,44,45,46,47,48,49,50,51],
  [52,53,54,55,56,57,58,59,60],
  [61,62,63,64,65,66,67,68,69,70],
  [71,72,73,74,75,76,77,78,79],
  [80,81,82,83,84,85,86,87,88,89],
  [90,91,92,93,94,95,96,97,98],
  [99,100,101,102,103,104,105,106],
  [107,108,109,110,111],
];
export const COL_TOP_OFFSETS = [4,2,2,1,2,1,2,1,2,1,2,2,4];
export const COL0_X = 1275;
export const ROW0_Y = 75;

export const EDGE_HEX_NUMS = new Set([
  1,2,3,4,5,
  6,13,
  14,22,
  23,32,
  33,41,
  42,51,
  52,60,
  61,70,
  71,79,
  80,89,
  90,98,
  99,100,105,106,
  107,108,109,110,111,
]);

export function buildHexMap() {
  const map = {};
  const byQR = {};
  COLUMNS.forEach((col, colIdx) => {
    const offset = COL_TOP_OFFSETS[colIdx];
    const cxImg = COL0_X + colIdx * COL_SPACING;
    const colYOffset = (colIdx % 2 === 1) ? HEX_SIZE : 0;
    col.forEach((num, rowInCol) => {
      const rowAbs = offset + rowInCol;
      const cyImg = ROW0_Y + rowAbs * ROW_SPACING + colYOffset;
      const q = colIdx - 6;
      const r = rowAbs - (colIdx - (colIdx & 1)) / 2;
      const hex = {
        num, q, r: Math.round(r),
        col: colIdx, row: rowAbs,
        px: Math.round(cxImg),
        py: Math.round(cyImg),
        edge: EDGE_HEX_NUMS.has(num),
        stage: num === 56,
      };
      map[num] = hex;
      byQR[`${hex.q},${hex.r}`] = hex;
    });
  });
  return { map, byQR };
}

export const { map: HEX_BY_NUM, byQR: HEX_BY_QR } = buildHexMap();
export const ALL_HEXES = Object.values(HEX_BY_NUM);

````````

## src/data/spiritIdentity.js

Packaged at: project/src/data/spiritIdentity.js

````````text
// Match IDs identify seats; character IDs identify an arsenal and innate rules.
// Legacy saves with unsuffixed IDs remain readable.
export function characterId(spiritOrId) {
  const id = typeof spiritOrId === 'object' && spiritOrId !== null
    ? spiritOrId.characterId ?? spiritOrId.id : spiritOrId;
  return typeof id === 'string' ? id.split('::')[0] : id;
}
export function seatId(character, corner) { return `${characterId(character)}::${corner}`; }

````````

## src/board/standeeOutlines.js

Packaged at: project/src/board/standeeOutlines.js

````````text
// 🎭 STANDEE OUTLINES — the silhouettes the acrylic is cut from.
//
// ⭐ TRACED FROM THE REAL ART, not authored. `.scratch/trace-standees.py` reads
// each `src/standees/*.png` and follows its alpha; the numbers are 0…1 of the
// image, x from the left, y from the TOP (image order — `standee.js` flips it).
//
// ⚠️ THE TRACE THRESHOLD IS ALPHA 115/255, WHICH IS `standee.js`'s `alphaTest`
// OF .45 — the same number twice on purpose. The first pass traced at ~25 and
// cut acrylic around a halo of pixels the print never draws, which is why the
// Metalness Monster stood on a grey card two hexes wide. If one moves, both move.
//
// 📌 TWO CUTS PER SPIRIT. `tight` follows every drawn thing — the Ronin's
// lightning becomes spurs of acrylic. `body` is the PHYSICAL FIGURE alone: glow
// off, strokes thinner than 0.8% of the height off (the bolts), loose crumbs off
// (the Monster's slime drips). Each is
// `{ panel, art }`, and each of those is an ARRAY OF RINGS, because a cut can be
// more than one piece. `panel` is `art` grown by 2% of the art's height — the
// clear margin a laser-cut figure has, which is what the neon edge rides on.
//
// ⭐ `body` SHIPS (Alex, 2026-09-25: "Only the immediate physical part of the
// standee should be covered in the acrylic layer, other 'effect' areas should be
// cut off") — reversing 2026-09-18's "cut everything in the art". The print is
// clipped to the same ring, so a cut-off bolt is gone from the print too.
// `body` was re-traced that day (the old one was a 3.5% opening that ate the
// shamisen's headstock); `tight` is byte-for-byte the 2026-09-18 trace.
//
// ⭐ This file is DATA LIFTED VERBATIM from `.scratch/standee-preview.html`, and
// `standeeCheck.mjs` §0 fails if the two ever disagree.

export const STANDEE_OUTLINES = {
  "cosmic_ronin": { w:3184, h:2891, foot:1.0,
    tight:{ panel:[[[0.0505,0.1312],[0.0724,0.1284],[0.1032,0.1442],[0.1406,0.1817],[0.1729,0.2076],[0.1857,0.212],[0.2053,0.2112],[0.2192,0.2183],[0.227,0.2311],[0.2267,0.2437],[0.2235,0.2499],[0.2252,0.2624],[0.2377,0.2753],[0.2506,0.2928],[0.2606,0.3165],[0.2693,0.3337],[0.2734,0.3383],[0.281,0.3407],[0.2876,0.3374],[0.291,0.3264],[0.2847,0.3017],[0.2778,0.2843],[0.2729,0.2578],[0.2798,0.2426],[0.2908,0.2391],[0.3036,0.2474],[0.3133,0.2616],[0.3164,0.27],[0.3231,0.2894],[0.3411,0.3109],[0.3658,0.331],[0.3843,0.3394],[0.3911,0.3391],[0.4072,0.3214],[0.4264,0.2809],[0.4488,0.2448],[0.4744,0.222],[0.487,0.1983],[0.4865,0.1841],[0.4791,0.1521],[0.4832,0.1165],[0.4921,0.0812],[0.4862,0.0571],[0.4777,0.0493],[0.467,0.0358],[0.4648,0.0249],[0.4689,0.0153],[0.4783,0.0065],[0.5024,0.0011],[0.5211,0.0],[0.5607,0.0028],[0.5729,0.0169],[0.5671,0.037],[0.5713,0.0468],[0.5771,0.0478],[0.5912,0.0569],[0.6085,0.075],[0.6233,0.0985],[0.6337,0.1259],[0.6368,0.139],[0.6384,0.1614],[0.6397,0.1812],[0.6578,0.2051],[0.6867,0.2353],[0.708,0.279],[0.7158,0.3059],[0.7413,0.3317],[0.78,0.32],[0.8087,0.2926],[0.8195,0.2566],[0.8207,0.2406],[0.8173,0.2179],[0.8099,0.2052],[0.8104,0.1954],[0.8176,0.189],[0.8282,0.1872],[0.8348,0.188],[0.8466,0.1931],[0.8563,0.2027],[0.861,0.2255],[0.8596,0.2645],[0.8613,0.2805],[0.8743,0.296],[0.8958,0.2922],[0.9133,0.2777],[0.9282,0.2579],[0.9437,0.2495],[0.9518,0.2495],[0.963,0.2543],[0.9675,0.2656],[0.96,0.2847],[0.9386,0.3122],[0.9238,0.3238],[0.8873,0.3372],[0.8466,0.3426],[0.8165,0.3544],[0.7931,0.3701],[0.7638,0.3817],[0.7469,0.386],[0.7257,0.3976],[0.7211,0.4133],[0.7561,0.4177],[0.8385,0.4056],[0.8774,0.4012],[0.9304,0.4032],[0.9543,0.4162],[0.9603,0.4294],[0.9469,0.4412],[0.9091,0.4462],[0.881,0.4462],[0.8387,0.4509],[0.8151,0.4617],[0.792,0.4706],[0.7635,0.475],[0.7582,0.4827],[0.7764,0.5161],[0.8206,0.5626],[0.8544,0.5887],[0.8763,0.5997],[0.8815,0.6056],[0.88,0.6183],[0.8666,0.6265],[0.8424,0.6286],[0.8185,0.6193],[0.7985,0.5968],[0.7905,0.5874],[0.7791,0.5794],[0.7744,0.5855],[0.7782,0.605],[0.7916,0.6376],[0.8029,0.6586],[0.835,0.7098],[0.8588,0.772],[0.8674,0.8446],[0.8811,0.8999],[0.9065,0.9286],[0.9166,0.9397],[0.9248,0.9621],[0.902,0.9824],[0.8035,0.9935],[0.6618,0.9964],[0.6114,0.9956],[0.5514,0.9895],[0.5019,0.9876],[0.4482,0.9933],[0.406,0.9948],[0.3804,0.9882],[0.3702,0.986],[0.3518,0.9882],[0.3321,0.9954],[0.2999,0.9969],[0.2634,0.9911],[0.2525,0.9834],[0.2456,0.9586],[0.2512,0.9351],[0.2667,0.9175],[0.2786,0.8776],[0.2821,0.8059],[0.285,0.7704],[0.2971,0.7124],[0.3099,0.6714],[0.2998,0.647],[0.2729,0.6307],[0.2601,0.6158],[0.2357,0.5724],[0.2076,0.5532],[0.1738,0.5722],[0.1508,0.5972],[0.1438,0.6177],[0.141,0.6261],[0.1313,0.6387],[0.118,0.6491],[0.1062,0.6664],[0.0952,0.6852],[0.0894,0.689],[0.0769,0.6852],[0.0714,0.6688],[0.0753,0.6406],[0.0839,0.6185],[0.0892,0.612],[0.0986,0.6041],[0.0964,0.5927],[0.0839,0.5833],[0.064,0.5922],[0.0397,0.6113],[0.0294,0.6156],[0.0121,0.6137],[0.0026,0.6047],[0.0018,0.5909],[0.0167,0.5712],[0.0308,0.559],[0.066,0.5372],[0.094,0.5376],[0.1169,0.5502],[0.1418,0.5442],[0.162,0.5222],[0.1627,0.5079],[0.1455,0.473],[0.1241,0.455],[0.1053,0.4626],[0.0862,0.4663],[0.076,0.463],[0.0551,0.4509],[0.0344,0.4442],[0.016,0.4404],[0.0059,0.432],[0.0032,0.4206],[0.0037,0.4157],[0.0083,0.4071],[0.0264,0.4059],[0.0609,0.4138],[0.0929,0.4158],[0.1056,0.4126],[0.1287,0.4041],[0.16,0.4087],[0.1884,0.4175],[0.1799,0.4035],[0.1484,0.3735],[0.1395,0.3603],[0.1354,0.3376],[0.1269,0.3185],[0.1064,0.3027],[0.0819,0.2957],[0.0691,0.2962],[0.0444,0.3005],[0.0262,0.2958],[0.0147,0.2847],[0.0098,0.2745],[0.0114,0.2652],[0.0145,0.2612],[0.0256,0.2543],[0.0294,0.2362],[0.0211,0.2024],[0.0178,0.1761],[0.02,0.1685],[0.0298,0.1625],[0.0396,0.1624],[0.0474,0.1637],[0.0474,0.1532],[0.0444,0.1435]]],
            art:[[[0.0644,0.1447],[0.0764,0.1448],[0.0855,0.1494],[0.0846,0.1538],[0.0861,0.1617],[0.0942,0.1745],[0.0985,0.1798],[0.1052,0.1858],[0.1097,0.1858],[0.1128,0.1819],[0.1145,0.1769],[0.1152,0.1804],[0.1152,0.1852],[0.1213,0.1953],[0.1354,0.2059],[0.1473,0.2169],[0.1536,0.2281],[0.165,0.2329],[0.1741,0.2321],[0.1945,0.2279],[0.2065,0.2304],[0.2087,0.2376],[0.1959,0.2438],[0.1748,0.2491],[0.1685,0.2515],[0.1642,0.2559],[0.1713,0.261],[0.1899,0.2672],[0.2081,0.2751],[0.2219,0.2848],[0.2299,0.2978],[0.2314,0.3058],[0.2346,0.3236],[0.2501,0.3417],[0.2727,0.3576],[0.286,0.3641],[0.2926,0.3623],[0.2963,0.3595],[0.3043,0.35],[0.3139,0.3469],[0.3252,0.354],[0.336,0.3591],[0.3456,0.3579],[0.3475,0.3548],[0.343,0.343],[0.3306,0.3274],[0.3191,0.3183],[0.3085,0.3108],[0.2987,0.2903],[0.2941,0.2753],[0.2916,0.2661],[0.2981,0.2849],[0.3087,0.3039],[0.3218,0.3137],[0.3364,0.3257],[0.3522,0.3435],[0.361,0.3508],[0.3807,0.3581],[0.403,0.3517],[0.4265,0.3198],[0.4517,0.2726],[0.4797,0.241],[0.4949,0.231],[0.5089,0.2061],[0.5011,0.1745],[0.4934,0.1472],[0.493,0.128],[0.5,0.1077],[0.5062,0.0961],[0.5175,0.0716],[0.5092,0.0504],[0.4919,0.0323],[0.4973,0.0168],[0.5192,0.005],[0.5294,0.0017],[0.548,0.0],[0.5562,0.0071],[0.5511,0.0235],[0.5461,0.0393],[0.5455,0.0511],[0.5515,0.059],[0.5573,0.0616],[0.5724,0.0665],[0.5875,0.0785],[0.6018,0.0968],[0.6127,0.1194],[0.6193,0.1445],[0.62,0.156],[0.6163,0.1772],[0.6258,0.2004],[0.655,0.2274],[0.6823,0.2669],[0.7002,0.3216],[0.7097,0.343],[0.7339,0.362],[0.7631,0.3551],[0.7921,0.3402],[0.8182,0.316],[0.8336,0.2789],[0.8373,0.2555],[0.8384,0.2233],[0.8312,0.2103],[0.8289,0.2067],[0.8358,0.209],[0.8425,0.2142],[0.8458,0.2212],[0.8459,0.2273],[0.8425,0.2462],[0.8366,0.2713],[0.8344,0.2934],[0.8394,0.3106],[0.8628,0.3167],[0.8813,0.3156],[0.9084,0.3112],[0.922,0.3039],[0.9282,0.2958],[0.9291,0.2878],[0.9312,0.2797],[0.9335,0.2757],[0.9398,0.2686],[0.9462,0.2656],[0.9489,0.269],[0.9369,0.2858],[0.9119,0.3093],[0.8962,0.3162],[0.8588,0.32],[0.8254,0.3272],[0.8004,0.3433],[0.7727,0.3571],[0.7386,0.3651],[0.7149,0.3719],[0.709,0.3755],[0.7057,0.3862],[0.7052,0.4091],[0.7115,0.4374],[0.7374,0.4499],[0.7741,0.449],[0.7867,0.4464],[0.8003,0.4371],[0.8223,0.4302],[0.8607,0.4284],[0.8904,0.4252],[0.903,0.4185],[0.9086,0.4166],[0.9242,0.4181],[0.9395,0.4236],[0.9357,0.4228],[0.9187,0.4194],[0.9061,0.4234],[0.9015,0.4282],[0.8853,0.4325],[0.8597,0.4294],[0.8363,0.428],[0.8187,0.4312],[0.8065,0.4373],[0.7993,0.4458],[0.7912,0.4497],[0.7594,0.4551],[0.7205,0.4606],[0.7152,0.4753],[0.7336,0.4978],[0.7457,0.5243],[0.7494,0.5391],[0.7582,0.5534],[0.7689,0.5472],[0.7847,0.5524],[0.8066,0.5797],[0.825,0.599],[0.8315,0.6019],[0.8417,0.5998],[0.8536,0.6023],[0.8635,0.6069],[0.8599,0.6065],[0.8466,0.6032],[0.8406,0.6032],[0.83,0.6065],[0.8197,0.6015],[0.8094,0.5841],[0.7985,0.5685],[0.7865,0.5594],[0.7743,0.5583],[0.7682,0.561],[0.7576,0.5718],[0.7537,0.5868],[0.7601,0.6121],[0.7886,0.6653],[0.8286,0.7337],[0.8411,0.7591],[0.8514,0.7923],[0.8542,0.8284],[0.8536,0.8761],[0.8591,0.9103],[0.8739,0.9227],[0.8819,0.927],[0.8962,0.938],[0.9069,0.9514],[0.9092,0.9645],[0.8952,0.9769],[0.8409,0.9875],[0.7987,0.9921],[0.708,0.9913],[0.609,0.9774],[0.5233,0.9697],[0.4581,0.9746],[0.4107,0.9758],[0.3801,0.9679],[0.3691,0.965],[0.3538,0.9659],[0.343,0.9733],[0.3245,0.9801],[0.3008,0.9851],[0.2804,0.9841],[0.2714,0.9815],[0.261,0.9712],[0.2609,0.9546],[0.2697,0.9387],[0.2871,0.9261],[0.2977,0.8959],[0.2985,0.8716],[0.2953,0.8149],[0.297,0.7743],[0.3042,0.7434],[0.3187,0.7028],[0.3327,0.6601],[0.3306,0.6464],[0.3083,0.6343],[0.2824,0.6122],[0.2596,0.5699],[0.2333,0.5333],[0.201,0.5109],[0.1747,0.4872],[0.1652,0.473],[0.1512,0.4447],[0.1379,0.4301],[0.1249,0.4282],[0.1107,0.4356],[0.0954,0.4468],[0.0875,0.4473],[0.071,0.4383],[0.0532,0.4298],[0.0336,0.4263],[0.0227,0.4232],[0.024,0.4187],[0.0278,0.4175],[0.0402,0.4187],[0.0568,0.4243],[0.0718,0.4328],[0.0864,0.4404],[0.105,0.4353],[0.1157,0.4281],[0.1385,0.4214],[0.163,0.4253],[0.1835,0.4356],[0.1981,0.4509],[0.2113,0.4585],[0.2245,0.454],[0.2274,0.4472],[0.2223,0.4246],[0.2061,0.3963],[0.1897,0.3817],[0.174,0.3766],[0.162,0.3683],[0.1573,0.3629],[0.1525,0.3491],[0.1534,0.3313],[0.1509,0.3143],[0.1418,0.2997],[0.1298,0.2898],[0.1232,0.2868],[0.1107,0.283],[0.1051,0.2767],[0.101,0.2709],[0.0825,0.2739],[0.0556,0.2815],[0.0457,0.2822],[0.0331,0.2773],[0.0369,0.2699],[0.0596,0.262],[0.0695,0.2523],[0.0563,0.2405],[0.0425,0.2228],[0.0383,0.2114],[0.036,0.1919],[0.0439,0.1995],[0.0614,0.2231],[0.0862,0.2292],[0.1131,0.2246],[0.1215,0.2259],[0.1283,0.2359],[0.1341,0.2424],[0.1431,0.2411],[0.1494,0.2363],[0.151,0.2293],[0.1497,0.225],[0.1426,0.2148],[0.1303,0.2048],[0.1158,0.202],[0.0992,0.2002],[0.0807,0.1804],[0.0707,0.1637]]] },
    body: { panel:[[[0.0223,0.2574],[0.0284,0.2536],[0.0363,0.2507],[0.0474,0.2423],[0.0508,0.2368],[0.0526,0.2305],[0.0559,0.2246],[0.0674,0.2142],[0.0755,0.2096],[0.0844,0.2061],[0.0943,0.2037],[0.1165,0.2023],[0.1261,0.2033],[0.1338,0.2054],[0.1396,0.2088],[0.1497,0.2157],[0.1585,0.2161],[0.1698,0.2145],[0.1835,0.2109],[0.2048,0.2098],[0.2124,0.2123],[0.2179,0.2169],[0.2222,0.2216],[0.2275,0.2312],[0.2285,0.2361],[0.2284,0.2408],[0.2274,0.2453],[0.2222,0.2537],[0.218,0.2572],[0.2127,0.2601],[0.2062,0.2625],[0.1927,0.2664],[0.1885,0.2689],[0.186,0.2716],[0.1852,0.2746],[0.1957,0.2899],[0.2069,0.3022],[0.2221,0.3176],[0.2433,0.329],[0.3037,0.3398],[0.3429,0.3392],[0.3732,0.3354],[0.3947,0.3283],[0.4109,0.3043],[0.4154,0.2916],[0.4205,0.2798],[0.4265,0.2688],[0.4413,0.2489],[0.451,0.2393],[0.4621,0.23],[0.4748,0.221],[0.4867,0.1989],[0.4861,0.1857],[0.481,0.1712],[0.4774,0.1577],[0.475,0.1335],[0.4761,0.1228],[0.4782,0.1125],[0.4854,0.0927],[0.4905,0.0833],[0.4923,0.0745],[0.491,0.0662],[0.4785,0.0512],[0.4726,0.0443],[0.4687,0.0377],[0.4667,0.0314],[0.4678,0.0198],[0.4701,0.0147],[0.4735,0.0102],[0.4781,0.0061],[0.5015,0.001],[0.5203,0.0],[0.5438,0.0],[0.5605,0.0028],[0.5734,0.0169],[0.5695,0.0281],[0.5682,0.0368],[0.5693,0.0431],[0.5789,0.048],[0.5855,0.0513],[0.5926,0.0566],[0.6003,0.0639],[0.616,0.0842],[0.6227,0.0964],[0.6286,0.1101],[0.6337,0.1251],[0.6391,0.151],[0.6394,0.1618],[0.6382,0.1713],[0.6408,0.1813],[0.6574,0.2032],[0.6714,0.215],[0.6842,0.2303],[0.6957,0.2491],[0.7149,0.297],[0.7211,0.3239],[0.7247,0.3521],[0.7255,0.3816],[0.7244,0.4374],[0.7279,0.4569],[0.734,0.4708],[0.7428,0.4791],[0.7565,0.4958],[0.7614,0.5042],[0.765,0.5127],[0.7679,0.5239],[0.7714,0.5545],[0.772,0.5738],[0.776,0.595],[0.7834,0.618],[0.8085,0.6693],[0.8211,0.6918],[0.8323,0.7104],[0.85,0.7357],[0.8568,0.7475],[0.8624,0.7604],[0.8667,0.7745],[0.8719,0.8066],[0.8731,0.8253],[0.8734,0.8457],[0.8728,0.8679],[0.8771,0.8977],[0.882,0.9055],[0.8887,0.9084],[0.8957,0.9127],[0.9099,0.9252],[0.9173,0.9334],[0.9231,0.9409],[0.9274,0.9479],[0.9311,0.9597],[0.9307,0.9659],[0.9287,0.9727],[0.9251,0.98],[0.8969,0.9938],[0.8558,0.9977],[0.7967,0.9997],[0.7196,0.9997],[0.608,0.9969],[0.5735,0.9941],[0.5531,0.9904],[0.5341,0.9885],[0.4999,0.9901],[0.4847,0.9936],[0.4699,0.9963],[0.4555,0.9982],[0.4276,0.9994],[0.4147,0.9985],[0.4025,0.9966],[0.391,0.9936],[0.3704,0.9875],[0.3611,0.9875],[0.3525,0.9895],[0.3447,0.9936],[0.3187,0.9975],[0.3006,0.9974],[0.2791,0.996],[0.2624,0.9939],[0.2434,0.9877],[0.2412,0.9836],[0.2399,0.978],[0.2396,0.9708],[0.2421,0.9518],[0.2456,0.9422],[0.2508,0.9332],[0.2579,0.9249],[0.2729,0.9046],[0.2768,0.8867],[0.2781,0.8636],[0.2765,0.8113],[0.277,0.7911],[0.2783,0.775],[0.2804,0.7629],[0.2943,0.7199],[0.3061,0.6889],[0.3211,0.6518],[0.3284,0.6241],[0.32,0.5975],[0.3043,0.5986],[0.2907,0.5978],[0.2792,0.5953],[0.2623,0.5848],[0.255,0.5776],[0.2477,0.5693],[0.2405,0.56],[0.2269,0.5387],[0.221,0.5272],[0.2158,0.5151],[0.2113,0.5025],[0.2065,0.4828],[0.2062,0.4757],[0.2074,0.4704],[0.2096,0.4657],[0.2173,0.4583],[0.2227,0.4556],[0.2245,0.4504],[0.2225,0.4429],[0.2077,0.4207],[0.1987,0.411],[0.1899,0.4039],[0.1814,0.3994],[0.1655,0.3945],[0.1585,0.3905],[0.1521,0.3853],[0.1463,0.3791],[0.1387,0.3624],[0.1369,0.352],[0.1364,0.3402],[0.1333,0.3294],[0.1195,0.311],[0.1088,0.3034],[0.0971,0.2984],[0.0845,0.2962],[0.0565,0.2999],[0.0443,0.301],[0.0344,0.2998],[0.0266,0.2964],[0.0172,0.2852],[0.015,0.2794],[0.0143,0.2734],[0.0152,0.2673]]],
            art:[[[0.0413,0.2696],[0.05,0.2663],[0.0628,0.2633],[0.0791,0.2579],[0.0826,0.2555],[0.083,0.2533],[0.0801,0.2484],[0.0769,0.2457],[0.0726,0.2427],[0.0727,0.2358],[0.0773,0.2318],[0.0848,0.2275],[0.1004,0.2222],[0.1085,0.2212],[0.1167,0.2212],[0.127,0.225],[0.1291,0.2286],[0.1291,0.2335],[0.1301,0.2404],[0.1312,0.2426],[0.1326,0.2438],[0.147,0.2415],[0.1601,0.2381],[0.1769,0.2331],[0.1997,0.2296],[0.2056,0.2312],[0.2078,0.235],[0.2018,0.2419],[0.1937,0.2449],[0.1822,0.2477],[0.1685,0.2541],[0.1663,0.2578],[0.1672,0.2618],[0.1675,0.2657],[0.1662,0.2734],[0.1645,0.2772],[0.1679,0.2848],[0.1897,0.3114],[0.2082,0.3303],[0.2256,0.3449],[0.2575,0.361],[0.272,0.3626],[0.2901,0.3633],[0.3374,0.3622],[0.3665,0.3604],[0.3891,0.3579],[0.4148,0.3508],[0.4178,0.3462],[0.4209,0.3397],[0.4268,0.3209],[0.4297,0.3086],[0.4333,0.2973],[0.4428,0.2775],[0.4486,0.269],[0.4567,0.2601],[0.4798,0.2409],[0.4948,0.2306],[0.5049,0.2209],[0.5108,0.2035],[0.5065,0.1957],[0.5027,0.1878],[0.4968,0.172],[0.4947,0.1639],[0.4934,0.1575],[0.4931,0.1526],[0.4949,0.1477],[0.4957,0.1446],[0.4961,0.1399],[0.4955,0.126],[0.4971,0.1173],[0.5008,0.1074],[0.5147,0.0844],[0.5179,0.073],[0.5163,0.0621],[0.4988,0.042],[0.4931,0.0329],[0.4929,0.0246],[0.5088,0.0102],[0.519,0.0051],[0.5287,0.0017],[0.5468,0.0],[0.5525,0.003],[0.555,0.009],[0.5508,0.0298],[0.5471,0.0394],[0.5434,0.0467],[0.536,0.0542],[0.5336,0.0566],[0.5326,0.0586],[0.5344,0.062],[0.536,0.0629],[0.5376,0.0631],[0.5411,0.0615],[0.5444,0.0611],[0.5494,0.0612],[0.5643,0.0635],[0.5722,0.0666],[0.5798,0.0713],[0.5871,0.0775],[0.6005,0.0947],[0.6064,0.1055],[0.6117,0.1178],[0.6193,0.1445],[0.6205,0.1565],[0.62,0.1678],[0.6202,0.1895],[0.6276,0.2018],[0.6396,0.2151],[0.671,0.2455],[0.6829,0.2636],[0.6924,0.2835],[0.7042,0.3294],[0.7066,0.3559],[0.7066,0.3848],[0.7049,0.4418],[0.7087,0.4623],[0.7155,0.4775],[0.7336,0.4963],[0.7401,0.5047],[0.7449,0.5124],[0.7505,0.5298],[0.7525,0.5435],[0.7539,0.5605],[0.7592,0.603],[0.7669,0.6267],[0.778,0.652],[0.8052,0.7017],[0.8163,0.7202],[0.8257,0.7344],[0.8335,0.7443],[0.8453,0.7672],[0.8493,0.7801],[0.852,0.7941],[0.8548,0.8301],[0.8549,0.8522],[0.854,0.877],[0.8593,0.9106],[0.8654,0.9194],[0.8739,0.9229],[0.889,0.9319],[0.8957,0.9375],[0.9017,0.9438],[0.9101,0.9537],[0.9123,0.9572],[0.9134,0.9598],[0.9127,0.9663],[0.911,0.9703],[0.9084,0.9747],[0.9027,0.9815],[0.8996,0.9839],[0.8963,0.9856],[0.8748,0.9881],[0.8566,0.9889],[0.8334,0.9893],[0.8024,0.9917],[0.7944,0.9936],[0.7916,0.996],[0.7783,0.999],[0.7678,0.9997],[0.7548,0.9997],[0.737,0.9984],[0.7322,0.9971],[0.7301,0.9953],[0.7254,0.9939],[0.7081,0.9921],[0.6955,0.9917],[0.6768,0.9897],[0.6212,0.9811],[0.5842,0.9746],[0.5523,0.9705],[0.5035,0.97],[0.4865,0.9736],[0.4709,0.9764],[0.4435,0.9797],[0.4318,0.9802],[0.4197,0.9794],[0.3941,0.9736],[0.3807,0.9687],[0.3696,0.9658],[0.3544,0.9666],[0.3503,0.9701],[0.3442,0.9736],[0.3258,0.9802],[0.3136,0.9834],[0.302,0.9851],[0.281,0.9841],[0.2715,0.9813],[0.2648,0.9768],[0.2602,0.9625],[0.2621,0.9527],[0.2659,0.9441],[0.279,0.93],[0.2882,0.9247],[0.2946,0.9186],[0.2982,0.9119],[0.2966,0.8963],[0.295,0.8847],[0.2939,0.8696],[0.2933,0.8288],[0.294,0.8087],[0.2953,0.7905],[0.3,0.7603],[0.3053,0.7417],[0.3133,0.7184],[0.3372,0.6581],[0.3489,0.632],[0.3589,0.6121],[0.3742,0.5911],[0.3789,0.5853],[0.3817,0.581],[0.3809,0.577],[0.3784,0.5765],[0.3749,0.5766],[0.3646,0.5789],[0.3596,0.5793],[0.3552,0.5785],[0.3483,0.5735],[0.3422,0.5719],[0.3331,0.5718],[0.3059,0.5757],[0.2918,0.5742],[0.2786,0.5686],[0.2552,0.5447],[0.2458,0.5314],[0.2382,0.5188],[0.2284,0.4958],[0.2274,0.4865],[0.2295,0.4789],[0.2346,0.4732],[0.249,0.4659],[0.2533,0.4628],[0.2557,0.4601],[0.2531,0.4517],[0.2465,0.4415],[0.2363,0.4273],[0.2103,0.3952],[0.1994,0.3856],[0.1901,0.3802],[0.175,0.3769],[0.1687,0.3738],[0.1633,0.3697],[0.1554,0.3584],[0.1536,0.351],[0.1532,0.3426],[0.1538,0.3241],[0.1518,0.3159],[0.1484,0.3083],[0.138,0.2959],[0.1322,0.2915],[0.126,0.2883],[0.1141,0.2838],[0.1105,0.2809],[0.1084,0.2775],[0.1034,0.2718],[0.0953,0.2723],[0.0836,0.2749],[0.0556,0.2822],[0.0461,0.2826],[0.0396,0.2808],[0.0361,0.2768]]] } },
  "intergalactic_0": { w:938, h:1157, foot:1.0,
    tight:{ panel:[[[0.0523,0.0319],[0.0675,0.0271],[0.0867,0.0217],[0.1066,0.0181],[0.1269,0.0163],[0.1691,0.0179],[0.1873,0.018],[0.2022,0.0164],[0.2139,0.0132],[0.2223,0.0083],[0.255,0.006],[0.2792,0.0087],[0.3087,0.0138],[0.3322,0.0187],[0.3495,0.0233],[0.3607,0.0277],[0.3742,0.0361],[0.386,0.0403],[0.4011,0.0447],[0.4194,0.0491],[0.4346,0.0537],[0.4556,0.0637],[0.4613,0.0691],[0.4675,0.077],[0.4743,0.0873],[0.4816,0.1002],[0.4895,0.1156],[0.516,0.1341],[0.5346,0.1372],[0.5569,0.1362],[0.5761,0.1362],[0.5922,0.1372],[0.6152,0.1421],[0.6259,0.1473],[0.6373,0.1547],[0.6495,0.1644],[0.6625,0.1764],[0.6744,0.189],[0.695,0.2159],[0.7038,0.2303],[0.7129,0.2408],[0.7224,0.2473],[0.7322,0.2498],[0.7505,0.246],[0.7562,0.2428],[0.7596,0.2388],[0.7608,0.2339],[0.7636,0.2294],[0.768,0.2254],[0.7815,0.2186],[0.7884,0.2164],[0.7947,0.2152],[0.8005,0.215],[0.8056,0.2157],[0.8185,0.2216],[0.8264,0.2267],[0.8351,0.2333],[0.8427,0.241],[0.8492,0.2499],[0.8545,0.26],[0.8615,0.2812],[0.8629,0.2899],[0.8628,0.2972],[0.8613,0.3033],[0.8616,0.3137],[0.8676,0.3473],[0.8733,0.3705],[0.877,0.3891],[0.8787,0.4031],[0.8783,0.4126],[0.8724,0.4223],[0.8679,0.4271],[0.8623,0.4318],[0.8557,0.4364],[0.8511,0.4422],[0.8486,0.4492],[0.8495,0.4666],[0.846,0.4754],[0.8374,0.4838],[0.8238,0.4918],[0.8051,0.4994],[0.7872,0.5184],[0.788,0.5298],[0.7952,0.5425],[0.803,0.5589],[0.8114,0.579],[0.8205,0.6029],[0.8386,0.6597],[0.846,0.6906],[0.8523,0.7231],[0.8574,0.7573],[0.8627,0.7845],[0.8741,0.8177],[0.8801,0.8239],[0.8851,0.8299],[0.889,0.8359],[0.8919,0.8418],[0.8937,0.8477],[0.9036,0.861],[0.9117,0.8685],[0.922,0.8766],[0.9325,0.8863],[0.9431,0.8976],[0.9652,0.9253],[0.9724,0.9385],[0.9755,0.9502],[0.9747,0.9604],[0.9699,0.9692],[0.9594,0.9766],[0.9215,0.9872],[0.8941,0.9904],[0.8691,0.9921],[0.8465,0.9923],[0.8264,0.9911],[0.7911,0.9866],[0.7739,0.9858],[0.7571,0.9858],[0.7405,0.9868],[0.7254,0.9865],[0.7117,0.9849],[0.6886,0.9779],[0.6788,0.9694],[0.6703,0.9566],[0.6628,0.9395],[0.6565,0.918],[0.6431,0.8812],[0.6361,0.866],[0.6289,0.8528],[0.6233,0.8381],[0.6194,0.822],[0.6166,0.7854],[0.6173,0.7697],[0.6194,0.7574],[0.6229,0.7484],[0.6277,0.7428],[0.6303,0.7371],[0.6286,0.7256],[0.6244,0.7197],[0.6218,0.713],[0.6209,0.7054],[0.6217,0.697],[0.6249,0.6804],[0.6242,0.675],[0.6218,0.6716],[0.6179,0.6702],[0.6093,0.6693],[0.5959,0.6689],[0.5548,0.6698],[0.537,0.6744],[0.5242,0.6828],[0.5164,0.6951],[0.5137,0.7112],[0.5148,0.7333],[0.5187,0.7394],[0.5247,0.7421],[0.5303,0.7458],[0.5354,0.7505],[0.5401,0.7563],[0.5468,0.778],[0.5477,0.8007],[0.547,0.8313],[0.5446,0.8699],[0.5416,0.9017],[0.5342,0.9453],[0.5297,0.957],[0.5143,0.9673],[0.4881,0.9763],[0.4511,0.9838],[0.4032,0.9899],[0.3309,0.9971],[0.3065,0.9983],[0.2899,0.9978],[0.2748,0.9963],[0.2613,0.9939],[0.2387,0.9861],[0.2309,0.9788],[0.2258,0.9685],[0.2233,0.9553],[0.2236,0.9392],[0.2281,0.9242],[0.2494,0.8975],[0.2663,0.8857],[0.28,0.874],[0.2907,0.8623],[0.2983,0.8506],[0.3056,0.824],[0.3067,0.8059],[0.306,0.7847],[0.3036,0.7603],[0.3041,0.7368],[0.314,0.6929],[0.3233,0.6724],[0.331,0.6518],[0.337,0.6312],[0.3414,0.6105],[0.3441,0.5897],[0.3543,0.5458],[0.3617,0.5227],[0.3708,0.4988],[0.3767,0.4793],[0.3796,0.4643],[0.3761,0.4476],[0.3709,0.444],[0.364,0.4429],[0.3553,0.4443],[0.3447,0.4482],[0.3345,0.4506],[0.3149,0.4508],[0.3056,0.4486],[0.2956,0.4448],[0.2849,0.4395],[0.2735,0.4325],[0.2513,0.4158],[0.243,0.408],[0.2366,0.4005],[0.2321,0.3934],[0.2261,0.3872],[0.2185,0.3818],[0.1989,0.3737],[0.1904,0.3696],[0.1837,0.3652],[0.1791,0.3605],[0.1764,0.3553],[0.1768,0.3416],[0.18,0.333],[0.1851,0.3232],[0.1828,0.3162],[0.173,0.3118],[0.1557,0.3101],[0.1088,0.3094],[0.0891,0.3051],[0.0718,0.2982],[0.0571,0.2887],[0.0456,0.2674],[0.0322,0.1895],[0.0304,0.1328],[0.0297,0.0895],[0.0302,0.0596],[0.0318,0.0431],[0.0345,0.0399]]],
            art:[[[0.064,0.0615],[0.0758,0.0448],[0.0917,0.0402],[0.11,0.0372],[0.1306,0.0358],[0.1789,0.0381],[0.199,0.0383],[0.2139,0.0367],[0.2236,0.0333],[0.2282,0.0282],[0.2546,0.0255],[0.2765,0.0278],[0.3042,0.0327],[0.3256,0.0374],[0.3407,0.0417],[0.3518,0.0498],[0.3569,0.0531],[0.3645,0.0558],[0.3748,0.0579],[0.3878,0.0593],[0.4101,0.0641],[0.4194,0.0674],[0.4276,0.0713],[0.4367,0.0795],[0.4468,0.0919],[0.4699,0.1296],[0.4853,0.145],[0.5041,0.1546],[0.5264,0.1586],[0.552,0.1569],[0.5889,0.1564],[0.6003,0.1576],[0.6069,0.1598],[0.6147,0.1641],[0.6236,0.1704],[0.6447,0.1893],[0.6534,0.1982],[0.6596,0.2054],[0.6633,0.2109],[0.6645,0.2148],[0.6705,0.2241],[0.6753,0.2295],[0.6813,0.2354],[0.6863,0.2413],[0.6902,0.2474],[0.6949,0.26],[0.6981,0.265],[0.7028,0.2685],[0.7089,0.2706],[0.7164,0.2714],[0.736,0.2701],[0.748,0.2681],[0.7616,0.2651],[0.7718,0.2615],[0.7788,0.2571],[0.7827,0.2461],[0.7835,0.2415],[0.7849,0.238],[0.7867,0.2358],[0.7892,0.2349],[0.794,0.234],[0.7964,0.2341],[0.7988,0.2346],[0.8014,0.236],[0.8041,0.2383],[0.8099,0.2457],[0.813,0.249],[0.8162,0.2513],[0.8194,0.2527],[0.8227,0.2532],[0.8294,0.2609],[0.8327,0.2682],[0.836,0.2777],[0.8379,0.2857],[0.8383,0.2922],[0.8349,0.3005],[0.834,0.3065],[0.8346,0.3151],[0.8367,0.3262],[0.8404,0.3398],[0.8469,0.3599],[0.8498,0.3662],[0.8526,0.3701],[0.8546,0.3749],[0.8559,0.3805],[0.8566,0.3943],[0.8557,0.4008],[0.8539,0.4066],[0.8512,0.4115],[0.8476,0.4156],[0.8388,0.4229],[0.8336,0.4259],[0.8279,0.4286],[0.8243,0.4329],[0.823,0.4389],[0.8268,0.4558],[0.8242,0.4645],[0.8159,0.4725],[0.802,0.48],[0.7824,0.4868],[0.7568,0.4972],[0.7508,0.5007],[0.7492,0.5032],[0.7504,0.5089],[0.7541,0.5178],[0.7696,0.5453],[0.7787,0.5635],[0.7879,0.5847],[0.7971,0.6086],[0.8065,0.6355],[0.82,0.6775],[0.8241,0.6926],[0.8265,0.7039],[0.8283,0.7155],[0.8295,0.7276],[0.8301,0.7531],[0.8309,0.7654],[0.8324,0.7773],[0.8346,0.7886],[0.8377,0.7993],[0.8471,0.8193],[0.8535,0.8286],[0.861,0.8374],[0.8663,0.8455],[0.8693,0.8528],[0.8685,0.8652],[0.8679,0.8699],[0.8682,0.8735],[0.8694,0.8759],[0.8715,0.8771],[0.8773,0.8781],[0.881,0.8778],[0.8852,0.8771],[0.89,0.878],[0.8953,0.8806],[0.9074,0.8906],[0.9147,0.8983],[0.923,0.9077],[0.9322,0.9188],[0.9425,0.9318],[0.9537,0.9507],[0.9547,0.9567],[0.9526,0.9603],[0.945,0.9637],[0.9319,0.9667],[0.8892,0.9719],[0.8645,0.973],[0.8392,0.9726],[0.8133,0.9708],[0.7867,0.9677],[0.7477,0.9648],[0.7352,0.9651],[0.7274,0.9666],[0.7201,0.9672],[0.7133,0.9669],[0.7014,0.9639],[0.6957,0.9588],[0.6901,0.9506],[0.6846,0.9393],[0.6792,0.9249],[0.6724,0.9027],[0.6711,0.8949],[0.6711,0.8893],[0.6693,0.8818],[0.6657,0.8726],[0.653,0.8485],[0.6475,0.8342],[0.6438,0.8186],[0.6417,0.8016],[0.6414,0.7833],[0.6449,0.759],[0.6486,0.7529],[0.6538,0.751],[0.6579,0.7488],[0.6611,0.7465],[0.6645,0.7413],[0.664,0.7378],[0.6619,0.7334],[0.6581,0.7281],[0.6527,0.722],[0.6455,0.7104],[0.6437,0.7048],[0.6431,0.6995],[0.6434,0.6948],[0.6448,0.6909],[0.6505,0.6853],[0.6538,0.6835],[0.6573,0.6823],[0.6608,0.6816],[0.6645,0.6816],[0.6699,0.6802],[0.6717,0.6787],[0.6729,0.6768],[0.6716,0.6741],[0.6678,0.6708],[0.6529,0.6622],[0.6444,0.6583],[0.6361,0.6552],[0.628,0.6527],[0.6202,0.651],[0.5912,0.6494],[0.57,0.6495],[0.5444,0.6503],[0.5242,0.6528],[0.5093,0.6572],[0.4955,0.6715],[0.4921,0.6818],[0.4895,0.6942],[0.4878,0.7089],[0.4869,0.7257],[0.491,0.7479],[0.4959,0.7532],[0.5029,0.7546],[0.5089,0.757],[0.514,0.7603],[0.5215,0.7697],[0.523,0.7847],[0.5227,0.8098],[0.5206,0.8447],[0.5167,0.8896],[0.4768,0.9502],[0.4408,0.9658],[0.3941,0.9717],[0.3559,0.976],[0.3261,0.9786],[0.2917,0.9792],[0.2802,0.9783],[0.2701,0.9768],[0.2614,0.9749],[0.2542,0.9724],[0.2459,0.9606],[0.2447,0.9512],[0.2456,0.9395],[0.2508,0.9281],[0.2601,0.9171],[0.2914,0.8962],[0.3047,0.8871],[0.3134,0.8792],[0.3176,0.8724],[0.3173,0.8668],[0.3206,0.8512],[0.3241,0.8412],[0.3289,0.8297],[0.3318,0.8158],[0.3327,0.7994],[0.3286,0.7594],[0.3287,0.7383],[0.3319,0.7175],[0.3381,0.6968],[0.3474,0.6763],[0.3611,0.6351],[0.3655,0.6144],[0.3682,0.5936],[0.3725,0.573],[0.3784,0.5525],[0.3949,0.5118],[0.4017,0.4952],[0.4062,0.4823],[0.4084,0.473],[0.4084,0.4674],[0.4028,0.4514],[0.3971,0.441],[0.3896,0.4291],[0.3816,0.4214],[0.373,0.4182],[0.3542,0.4246],[0.3454,0.4286],[0.3374,0.4313],[0.3303,0.4326],[0.3239,0.4326],[0.3066,0.4266],[0.2955,0.4205],[0.2828,0.4125],[0.2721,0.4044],[0.2634,0.3964],[0.2518,0.3802],[0.2452,0.3732],[0.2367,0.3671],[0.2265,0.3619],[0.2145,0.3578],[0.2055,0.3414],[0.2086,0.3292],[0.2167,0.3143],[0.2225,0.3027],[0.226,0.2943],[0.2259,0.2871],[0.2181,0.2864],[0.2038,0.2869],[0.183,0.2886],[0.1556,0.2915],[0.1184,0.2946],[0.1086,0.2948],[0.1047,0.2941],[0.099,0.2917],[0.0916,0.2877],[0.0717,0.2747],[0.0633,0.2559],[0.0575,0.2258],[0.0541,0.1842],[0.0532,0.1312]]] },
    body: { panel:[[[0.046,0.0493],[0.0577,0.0309],[0.0734,0.0261],[0.0917,0.0232],[0.1358,0.0226],[0.1616,0.025],[0.1816,0.0256],[0.1956,0.0244],[0.2058,0.0166],[0.2092,0.0125],[0.2138,0.0089],[0.2197,0.0059],[0.2395,0.0031],[0.2573,0.0045],[0.2805,0.0078],[0.309,0.013],[0.3489,0.0245],[0.3602,0.0308],[0.3658,0.0375],[0.3745,0.0433],[0.3862,0.0481],[0.4188,0.0551],[0.4341,0.0628],[0.4468,0.0751],[0.4568,0.092],[0.4766,0.1293],[0.4938,0.1389],[0.5159,0.1425],[0.5428,0.1401],[0.5858,0.1401],[0.6019,0.1424],[0.6145,0.1463],[0.6268,0.1518],[0.6509,0.1677],[0.6626,0.178],[0.6737,0.1896],[0.6842,0.2024],[0.6942,0.2163],[0.7129,0.2423],[0.7223,0.249],[0.7319,0.2515],[0.7415,0.2498],[0.7553,0.2431],[0.7595,0.2381],[0.7619,0.2321],[0.7655,0.2269],[0.7763,0.2194],[0.7834,0.217],[0.792,0.2169],[0.802,0.2191],[0.8262,0.2302],[0.8371,0.2383],[0.846,0.2477],[0.853,0.2584],[0.8581,0.2705],[0.863,0.2894],[0.8629,0.2961],[0.861,0.3011],[0.8607,0.3115],[0.865,0.3487],[0.8695,0.3755],[0.8709,0.397],[0.8692,0.4131],[0.8563,0.4292],[0.851,0.4348],[0.8483,0.4405],[0.8483,0.4464],[0.8525,0.4584],[0.8529,0.4642],[0.8522,0.47],[0.8503,0.4756],[0.835,0.4876],[0.8216,0.4941],[0.8042,0.5008],[0.7954,0.5158],[0.795,0.5391],[0.8196,0.6107],[0.8333,0.6493],[0.8442,0.6865],[0.8523,0.7222],[0.8636,0.7854],[0.8701,0.8086],[0.8773,0.8263],[0.885,0.8384],[0.9015,0.8585],[0.9102,0.8666],[0.9192,0.8733],[0.929,0.8821],[0.9508,0.9063],[0.9628,0.9217],[0.9711,0.9353],[0.9758,0.9472],[0.9768,0.9573],[0.9649,0.9732],[0.949,0.9795],[0.9266,0.9849],[0.8975,0.9892],[0.8468,0.9925],[0.8252,0.9915],[0.806,0.9887],[0.7873,0.9868],[0.7516,0.9857],[0.7345,0.9866],[0.7196,0.9864],[0.7068,0.9853],[0.6876,0.9798],[0.6777,0.9685],[0.6664,0.9492],[0.6537,0.9218],[0.6395,0.8863],[0.6213,0.8278],[0.6171,0.8047],[0.6163,0.7857],[0.6169,0.7699],[0.6219,0.7484],[0.6265,0.7425],[0.6289,0.7367],[0.6291,0.7307],[0.6233,0.7187],[0.6212,0.7116],[0.6211,0.7035],[0.6229,0.6944],[0.6284,0.6762],[0.6283,0.6704],[0.6262,0.6667],[0.6222,0.6652],[0.5998,0.6638],[0.5814,0.6639],[0.5582,0.6645],[0.5401,0.6669],[0.5271,0.6709],[0.5161,0.6839],[0.5138,0.6919],[0.5121,0.7007],[0.5109,0.7101],[0.5115,0.7286],[0.5143,0.7349],[0.5188,0.7394],[0.5249,0.742],[0.5358,0.7506],[0.5405,0.7566],[0.5448,0.7637],[0.5475,0.7774],[0.5484,0.8247],[0.5465,0.8581],[0.5442,0.8872],[0.5414,0.9118],[0.5381,0.932],[0.5195,0.9614],[0.4933,0.9727],[0.456,0.9818],[0.4075,0.9888],[0.3335,0.9971],[0.308,0.9985],[0.2901,0.9981],[0.2745,0.9969],[0.2497,0.9922],[0.2407,0.9888],[0.2337,0.982],[0.2287,0.9718],[0.2251,0.9414],[0.2287,0.9258],[0.2369,0.9113],[0.2495,0.898],[0.2665,0.8859],[0.291,0.862],[0.2985,0.8503],[0.3028,0.8386],[0.3054,0.8236],[0.306,0.7835],[0.3038,0.7584],[0.3045,0.7347],[0.308,0.7123],[0.3233,0.6717],[0.3309,0.6514],[0.337,0.6304],[0.3417,0.6088],[0.3487,0.5668],[0.3533,0.5495],[0.3585,0.5347],[0.3643,0.5224],[0.3759,0.5045],[0.3815,0.499],[0.3871,0.4958],[0.3917,0.4917],[0.3951,0.4867],[0.3989,0.4742],[0.3986,0.4667],[0.3967,0.4584],[0.3933,0.4492],[0.3822,0.4334],[0.3753,0.4316],[0.3674,0.4338],[0.3586,0.44],[0.3422,0.4484],[0.3346,0.4504],[0.3274,0.4511],[0.3164,0.4472],[0.2826,0.4261],[0.26,0.4088],[0.2402,0.3948],[0.2233,0.3841],[0.2092,0.3767],[0.1892,0.3682],[0.1826,0.3636],[0.1784,0.3587],[0.1766,0.3535],[0.1792,0.3371],[0.1838,0.326],[0.1904,0.3128],[0.1892,0.3041],[0.1632,0.3005],[0.1385,0.3054],[0.1157,0.3068],[0.0951,0.3045],[0.06,0.2891],[0.0475,0.2672],[0.0391,0.2328],[0.0348,0.186],[0.0345,0.1268]]],
            art:[[[0.0609,0.0627],[0.069,0.047],[0.096,0.042],[0.1164,0.0418],[0.1414,0.0431],[0.1938,0.0475],[0.21,0.0478],[0.2193,0.0469],[0.2241,0.042],[0.2255,0.0386],[0.2264,0.0347],[0.2275,0.0265],[0.229,0.0238],[0.2311,0.022],[0.2424,0.0218],[0.2571,0.0238],[0.2777,0.0273],[0.325,0.0376],[0.3395,0.0432],[0.3479,0.0492],[0.3567,0.0607],[0.3671,0.0649],[0.3815,0.0681],[0.4147,0.074],[0.4259,0.0794],[0.4335,0.0864],[0.4404,0.1041],[0.4421,0.1135],[0.4427,0.1233],[0.4425,0.1414],[0.4437,0.1473],[0.4458,0.1509],[0.4514,0.1548],[0.454,0.1581],[0.4563,0.1622],[0.4631,0.1698],[0.4703,0.1703],[0.48,0.1684],[0.506,0.1611],[0.5212,0.1589],[0.5378,0.1575],[0.5716,0.1574],[0.5846,0.1583],[0.5951,0.16],[0.6113,0.1659],[0.6197,0.1707],[0.6283,0.1766],[0.6461,0.1921],[0.6553,0.2018],[0.6647,0.2126],[0.6819,0.2358],[0.6875,0.2458],[0.6911,0.2549],[0.6956,0.2689],[0.6999,0.273],[0.7055,0.2752],[0.7214,0.2746],[0.7325,0.2729],[0.7456,0.2702],[0.7721,0.2624],[0.7796,0.2577],[0.7832,0.2526],[0.7834,0.2424],[0.7848,0.239],[0.7869,0.2366],[0.7932,0.2355],[0.7971,0.2371],[0.8062,0.2447],[0.8107,0.2483],[0.8148,0.2509],[0.8221,0.2531],[0.8256,0.256],[0.829,0.2611],[0.836,0.2779],[0.838,0.2859],[0.8385,0.2924],[0.8352,0.3008],[0.8346,0.31],[0.836,0.325],[0.8442,0.3724],[0.8458,0.3932],[0.8439,0.4082],[0.8298,0.4209],[0.824,0.4263],[0.8212,0.4335],[0.8246,0.4537],[0.8222,0.4636],[0.814,0.4726],[0.7808,0.4875],[0.7659,0.4932],[0.7555,0.4979],[0.7483,0.5038],[0.7496,0.5095],[0.7536,0.5184],[0.7696,0.5462],[0.7789,0.5644],[0.788,0.5853],[0.8062,0.6349],[0.8137,0.6609],[0.8196,0.6866],[0.8265,0.7374],[0.8292,0.7589],[0.832,0.7766],[0.8378,0.8007],[0.8419,0.8104],[0.8471,0.8198],[0.8609,0.8375],[0.8661,0.8455],[0.8692,0.8527],[0.8687,0.8651],[0.8694,0.8697],[0.8721,0.873],[0.8834,0.876],[0.8924,0.8813],[0.9037,0.891],[0.9334,0.9237],[0.945,0.9385],[0.9524,0.9494],[0.954,0.9597],[0.9469,0.9628],[0.934,0.9659],[0.8907,0.9716],[0.8656,0.9729],[0.8399,0.9727],[0.7866,0.9677],[0.7646,0.9656],[0.7474,0.9648],[0.7276,0.9666],[0.7205,0.9673],[0.7139,0.967],[0.7018,0.964],[0.696,0.9575],[0.6846,0.9306],[0.679,0.9103],[0.673,0.8915],[0.6598,0.8581],[0.6526,0.8437],[0.6471,0.8287],[0.6414,0.7973],[0.6411,0.7809],[0.6422,0.7681],[0.6483,0.7533],[0.6534,0.7514],[0.6575,0.7492],[0.663,0.7443],[0.6643,0.7415],[0.6638,0.7376],[0.6575,0.7269],[0.6517,0.72],[0.6472,0.7138],[0.6425,0.7034],[0.6422,0.6993],[0.6429,0.6955],[0.647,0.689],[0.6505,0.6861],[0.654,0.684],[0.6612,0.6819],[0.665,0.6819],[0.668,0.6813],[0.6722,0.6784],[0.6732,0.676],[0.6708,0.6723],[0.6553,0.6611],[0.6422,0.6535],[0.6294,0.6483],[0.6046,0.6448],[0.5926,0.6465],[0.5794,0.6476],[0.5494,0.6478],[0.5326,0.6469],[0.5189,0.6487],[0.5007,0.6599],[0.4961,0.6694],[0.4925,0.6807],[0.4881,0.7089],[0.4873,0.7258],[0.4883,0.7388],[0.4957,0.753],[0.5021,0.7543],[0.5079,0.7566],[0.5173,0.7644],[0.5211,0.7698],[0.5229,0.7851],[0.5207,0.8453],[0.5167,0.8902],[0.5016,0.9254],[0.4383,0.9664],[0.3901,0.9722],[0.3509,0.9764],[0.3001,0.98],[0.2884,0.9794],[0.278,0.9783],[0.2612,0.9752],[0.2548,0.973],[0.2502,0.9683],[0.2464,0.9516],[0.2472,0.9395],[0.2614,0.9164],[0.2748,0.9055],[0.2924,0.8949],[0.3142,0.8774],[0.3184,0.8706],[0.3181,0.865],[0.3212,0.8498],[0.3245,0.8403],[0.329,0.8295],[0.3327,0.7993],[0.3318,0.7799],[0.3292,0.7577],[0.3326,0.7151],[0.3388,0.6948],[0.3478,0.6751],[0.3613,0.6345],[0.3658,0.6135],[0.3687,0.5922],[0.3764,0.5568],[0.3811,0.5429],[0.3865,0.5314],[0.3957,0.5168],[0.3997,0.5136],[0.4031,0.5132],[0.4094,0.5099],[0.4123,0.507],[0.415,0.5033],[0.4195,0.4918],[0.4214,0.4839],[0.423,0.4746],[0.4186,0.4512],[0.4126,0.437],[0.4041,0.4212],[0.39,0.4015],[0.3845,0.3976],[0.3799,0.3976],[0.3657,0.4044],[0.3559,0.4112],[0.3445,0.4203],[0.317,0.4227],[0.3009,0.4161],[0.2833,0.4042],[0.2587,0.3857],[0.2517,0.3792],[0.2483,0.3745],[0.2357,0.3658],[0.2267,0.3618],[0.2158,0.3581],[0.2097,0.339],[0.2146,0.3235],[0.2247,0.304],[0.2365,0.2781],[0.2383,0.2716],[0.2372,0.2694],[0.2107,0.2718],[0.1852,0.2763],[0.1517,0.283],[0.1013,0.286],[0.0845,0.2823],[0.0733,0.2752],[0.0585,0.2264],[0.0549,0.1847],[0.0538,0.1316]]] } },
  "Metalness_Monster": { w:3480, h:3563, foot:1.0,
    tight:{ panel:[[[0.0904,0.0016],[0.1062,0.0006],[0.1202,0.0044],[0.1302,0.0126],[0.1364,0.0231],[0.1389,0.0354],[0.1432,0.045],[0.1468,0.0482],[0.1559,0.0502],[0.1659,0.0424],[0.1769,0.0291],[0.1902,0.0234],[0.2044,0.0249],[0.2154,0.0322],[0.2196,0.0381],[0.2259,0.0604],[0.2291,0.0969],[0.2346,0.1223],[0.2441,0.1282],[0.2541,0.1337],[0.2632,0.1454],[0.2704,0.1445],[0.273,0.137],[0.2779,0.1143],[0.2866,0.0984],[0.2989,0.0884],[0.3141,0.0817],[0.3312,0.078],[0.3465,0.0773],[0.3535,0.078],[0.3699,0.084],[0.3896,0.0962],[0.4069,0.1025],[0.42,0.0991],[0.4466,0.0973],[0.4928,0.1008],[0.5329,0.0995],[0.5475,0.0957],[0.5694,0.0856],[0.5911,0.0822],[0.6129,0.0872],[0.6356,0.1067],[0.6601,0.1313],[0.6882,0.1335],[0.7038,0.1262],[0.7364,0.1152],[0.7714,0.1091],[0.8099,0.1136],[0.8524,0.1305],[0.8801,0.1492],[0.8869,0.1663],[0.8799,0.1796],[0.8722,0.1846],[0.8543,0.1931],[0.8486,0.2042],[0.853,0.216],[0.8609,0.2222],[0.8706,0.2252],[0.8774,0.2323],[0.8796,0.2374],[0.8749,0.2523],[0.858,0.2732],[0.8526,0.2896],[0.8668,0.298],[0.8822,0.3093],[0.8929,0.3271],[0.9118,0.3383],[0.9259,0.3396],[0.9571,0.3395],[0.975,0.3506],[0.9814,0.3699],[0.9816,0.3885],[0.9719,0.4097],[0.9415,0.4434],[0.9185,0.4648],[0.8734,0.497],[0.8296,0.5148],[0.7994,0.5331],[0.787,0.5571],[0.7721,0.573],[0.7479,0.5762],[0.7287,0.5835],[0.7228,0.5908],[0.7146,0.6073],[0.702,0.6116],[0.6879,0.6057],[0.6812,0.5959],[0.6815,0.5836],[0.6868,0.5728],[0.6912,0.5679],[0.6961,0.5594],[0.6955,0.5526],[0.689,0.5474],[0.6765,0.5436],[0.6683,0.548],[0.6679,0.563],[0.6656,0.5795],[0.6626,0.5872],[0.6621,0.6056],[0.6932,0.6392],[0.743,0.6775],[0.7718,0.6895],[0.7842,0.6832],[0.7948,0.683],[0.7992,0.6852],[0.8021,0.7115],[0.7966,0.7672],[0.7932,0.8117],[0.7954,0.8315],[0.8054,0.8432],[0.8242,0.8522],[0.843,0.8645],[0.8512,0.8727],[0.8646,0.8912],[0.8715,0.9075],[0.8719,0.9224],[0.8658,0.9382],[0.8529,0.9539],[0.8325,0.9656],[0.8195,0.97],[0.7442,0.9749],[0.6031,0.9747],[0.5028,0.9691],[0.4788,0.9578],[0.4779,0.9465],[0.4825,0.9373],[0.5033,0.9274],[0.5211,0.9219],[0.5626,0.9094],[0.5878,0.8937],[0.5989,0.8754],[0.6029,0.8561],[0.5998,0.8353],[0.5905,0.8113],[0.5835,0.7981],[0.5695,0.7789],[0.5555,0.7692],[0.5415,0.7673],[0.5275,0.7728],[0.515,0.7736],[0.5045,0.7655],[0.4938,0.7765],[0.488,0.7926],[0.4759,0.8332],[0.4636,0.8506],[0.4509,0.8483],[0.4371,0.837],[0.4226,0.8218],[0.4078,0.8177],[0.4002,0.8199],[0.3884,0.8154],[0.3809,0.7988],[0.3701,0.798],[0.3535,0.822],[0.3447,0.8499],[0.3481,0.8746],[0.3601,0.8894],[0.3688,0.8922],[0.3895,0.8932],[0.4092,0.9004],[0.4263,0.9122],[0.4356,0.9246],[0.4376,0.9369],[0.4336,0.9478],[0.4294,0.9526],[0.4168,0.9587],[0.3986,0.96],[0.3812,0.9631],[0.3665,0.9703],[0.3165,0.9777],[0.2185,0.9839],[0.1389,0.9821],[0.1142,0.9773],[0.0881,0.9625],[0.0735,0.9473],[0.0688,0.9307],[0.069,0.9105],[0.0762,0.8863],[0.0961,0.8569],[0.1109,0.8403],[0.1295,0.8143],[0.1336,0.7977],[0.1377,0.7867],[0.1465,0.7798],[0.1528,0.7677],[0.154,0.7473],[0.1578,0.7272],[0.1615,0.7184],[0.1699,0.7031],[0.1718,0.6913],[0.1708,0.6815],[0.1781,0.6698],[0.19,0.6551],[0.1954,0.6343],[0.1956,0.6216],[0.2014,0.6035],[0.2141,0.5952],[0.2192,0.5831],[0.2119,0.5627],[0.2042,0.5551],[0.2002,0.5673],[0.1928,0.5796],[0.1868,0.5834],[0.1724,0.5864],[0.1605,0.5837],[0.1517,0.5756],[0.1476,0.562],[0.1444,0.5461],[0.1305,0.5367],[0.1195,0.5345],[0.1044,0.5223],[0.0986,0.4995],[0.1021,0.4743],[0.1148,0.4493],[0.1187,0.4382],[0.1079,0.4453],[0.0951,0.4525],[0.0895,0.4537],[0.0802,0.4525],[0.0736,0.4484],[0.0702,0.4404],[0.071,0.4261],[0.0731,0.4084],[0.0678,0.3958],[0.0622,0.3914],[0.0531,0.3683],[0.0465,0.3262],[0.0458,0.2841],[0.052,0.2483],[0.0529,0.2213],[0.0442,0.2037],[0.0368,0.1868],[0.0349,0.1774],[0.0358,0.156],[0.0465,0.1293],[0.0622,0.0981],[0.069,0.0656],[0.07,0.0346],[0.075,0.0146],[0.079,0.0088]]],
            art:[[[0.1003,0.0191],[0.1101,0.0223],[0.1171,0.0321],[0.1192,0.0477],[0.121,0.0544],[0.1282,0.0624],[0.1387,0.0653],[0.1469,0.0702],[0.1501,0.0734],[0.1596,0.0762],[0.1731,0.0745],[0.1833,0.0666],[0.1862,0.0602],[0.1898,0.0465],[0.1956,0.0426],[0.2028,0.0527],[0.2058,0.0679],[0.2106,0.1183],[0.2153,0.1547],[0.2202,0.1636],[0.2232,0.1631],[0.2304,0.1577],[0.2397,0.1518],[0.2522,0.1613],[0.2598,0.1718],[0.2738,0.1827],[0.2866,0.1802],[0.2942,0.1655],[0.2954,0.1392],[0.2962,0.1272],[0.3014,0.1113],[0.3115,0.1042],[0.3281,0.0997],[0.3389,0.0985],[0.3619,0.1034],[0.3869,0.118],[0.4071,0.1256],[0.4146,0.1246],[0.4296,0.1174],[0.4582,0.1143],[0.4939,0.115],[0.5066,0.1165],[0.522,0.1216],[0.5389,0.1203],[0.5622,0.1095],[0.5736,0.1047],[0.5926,0.1007],[0.609,0.1063],[0.6289,0.1282],[0.6401,0.1453],[0.6643,0.1611],[0.6908,0.1526],[0.7191,0.1403],[0.7491,0.1312],[0.7638,0.1285],[0.7911,0.1272],[0.8162,0.1313],[0.8399,0.1404],[0.8511,0.1467],[0.8658,0.1569],[0.8699,0.1636],[0.8658,0.1672],[0.8609,0.168],[0.8478,0.1695],[0.8361,0.1771],[0.8274,0.1899],[0.8256,0.1973],[0.8274,0.2137],[0.8324,0.227],[0.8394,0.2351],[0.8433,0.2377],[0.8518,0.2406],[0.8556,0.2449],[0.839,0.2646],[0.823,0.2803],[0.8158,0.3024],[0.8415,0.3123],[0.8678,0.3248],[0.8839,0.3448],[0.8929,0.3525],[0.918,0.358],[0.9464,0.3559],[0.9606,0.3628],[0.9624,0.3696],[0.9631,0.3828],[0.96,0.3951],[0.9504,0.4106],[0.9428,0.42],[0.9232,0.4406],[0.9018,0.4591],[0.8762,0.4758],[0.8598,0.4835],[0.8192,0.4976],[0.7881,0.511],[0.7726,0.5243],[0.7687,0.5308],[0.7662,0.5437],[0.768,0.5546],[0.7648,0.5581],[0.7612,0.5571],[0.7563,0.5524],[0.7541,0.5441],[0.7492,0.5385],[0.7399,0.5377],[0.7358,0.5389],[0.7309,0.5439],[0.7289,0.551],[0.7252,0.5552],[0.7228,0.5562],[0.7189,0.5524],[0.7165,0.5411],[0.6993,0.5292],[0.6831,0.5239],[0.6456,0.5161],[0.6281,0.5161],[0.6271,0.5223],[0.6289,0.5258],[0.6369,0.5338],[0.6438,0.545],[0.6471,0.5602],[0.6463,0.5683],[0.6385,0.5847],[0.6306,0.6024],[0.6469,0.6245],[0.6641,0.6372],[0.6906,0.6599],[0.7062,0.6788],[0.7221,0.6951],[0.7416,0.7089],[0.7513,0.7126],[0.769,0.7114],[0.7829,0.7043],[0.7886,0.7076],[0.7884,0.7133],[0.7849,0.7249],[0.7774,0.7369],[0.7722,0.759],[0.7714,0.775],[0.7728,0.811],[0.778,0.8368],[0.7874,0.8535],[0.7941,0.8597],[0.8118,0.8679],[0.8274,0.876],[0.8385,0.8859],[0.8428,0.8915],[0.849,0.9042],[0.8517,0.9178],[0.8491,0.9296],[0.8459,0.9347],[0.8341,0.9438],[0.8154,0.9515],[0.7456,0.9561],[0.61,0.957],[0.5537,0.9561],[0.5001,0.9515],[0.5102,0.944],[0.5389,0.9358],[0.5601,0.9314],[0.5931,0.9173],[0.6132,0.8961],[0.6229,0.8721],[0.6241,0.8595],[0.6199,0.833],[0.609,0.8041],[0.5921,0.7752],[0.5824,0.7636],[0.5602,0.7461],[0.5421,0.7411],[0.5305,0.7502],[0.5254,0.753],[0.5148,0.7477],[0.5031,0.7361],[0.4886,0.7426],[0.4804,0.7526],[0.4689,0.7775],[0.4642,0.8091],[0.4547,0.8201],[0.4364,0.8016],[0.4274,0.7935],[0.4131,0.7914],[0.4038,0.7989],[0.3989,0.7876],[0.3981,0.7749],[0.3955,0.7574],[0.3914,0.7504],[0.3824,0.7533],[0.3756,0.7584],[0.3591,0.7755],[0.3422,0.8],[0.3282,0.8312],[0.3258,0.848],[0.3298,0.8843],[0.3356,0.9086],[0.34,0.9158],[0.3433,0.9163],[0.3539,0.9143],[0.368,0.9103],[0.3806,0.9097],[0.3864,0.9106],[0.3943,0.9139],[0.3975,0.9188],[0.4023,0.9233],[0.4109,0.9265],[0.4142,0.9285],[0.4165,0.9338],[0.4125,0.9396],[0.4005,0.9413],[0.3915,0.9406],[0.3761,0.9429],[0.3642,0.9504],[0.3283,0.9567],[0.2979,0.9585],[0.2276,0.9607],[0.1864,0.9639],[0.1671,0.9672],[0.1577,0.9679],[0.1395,0.9675],[0.1224,0.9634],[0.1066,0.9552],[0.1003,0.95],[0.0916,0.9376],[0.0882,0.923],[0.0894,0.9064],[0.0916,0.8973],[0.0974,0.8818],[0.105,0.8698],[0.1164,0.8598],[0.1322,0.8516],[0.1384,0.8479],[0.1435,0.8413],[0.1429,0.8359],[0.1478,0.8325],[0.1522,0.8315],[0.1562,0.8246],[0.1534,0.8112],[0.1551,0.7982],[0.159,0.7928],[0.1695,0.7818],[0.174,0.7637],[0.1758,0.7407],[0.1792,0.7298],[0.1915,0.7094],[0.1976,0.6948],[0.1932,0.6876],[0.1926,0.6838],[0.1996,0.673],[0.2126,0.6595],[0.2152,0.649],[0.2128,0.6449],[0.2108,0.6342],[0.2128,0.6204],[0.2159,0.6143],[0.2194,0.6198],[0.2214,0.6231],[0.2261,0.6274],[0.2317,0.6273],[0.2375,0.6185],[0.2405,0.611],[0.2433,0.5938],[0.2419,0.574],[0.2351,0.5553],[0.2295,0.5469],[0.2158,0.5327],[0.203,0.5244],[0.1882,0.5211],[0.1768,0.5202],[0.1455,0.5201],[0.1237,0.5129],[0.1181,0.4955],[0.1198,0.4844],[0.1305,0.4589],[0.1442,0.4326],[0.141,0.4166],[0.133,0.4125],[0.1168,0.413],[0.1004,0.4252],[0.0929,0.4222],[0.0974,0.395],[0.0994,0.382],[0.0985,0.3668],[0.0922,0.3642],[0.0846,0.3687],[0.0804,0.3735],[0.0728,0.3635],[0.0665,0.3271],[0.0659,0.286],[0.0684,0.2664],[0.0743,0.231],[0.07,0.2063],[0.0594,0.1899],[0.0561,0.1821],[0.0538,0.1672],[0.0599,0.1471],[0.0755,0.1196],[0.0821,0.105],[0.0882,0.0757],[0.088,0.0486],[0.0908,0.0303],[0.0932,0.0244]]] },
    body: { panel:[[[0.0893,0.0034],[0.1061,0.0011],[0.1206,0.0044],[0.1305,0.012],[0.1367,0.0225],[0.1396,0.0354],[0.1442,0.0453],[0.1479,0.0485],[0.1572,0.0502],[0.1674,0.0423],[0.1788,0.0293],[0.1925,0.0242],[0.2067,0.0262],[0.217,0.0326],[0.2237,0.0465],[0.2263,0.0595],[0.2296,0.0975],[0.2357,0.1246],[0.2463,0.1316],[0.2566,0.1369],[0.2647,0.1467],[0.2711,0.1442],[0.276,0.1237],[0.2793,0.1129],[0.2893,0.0965],[0.3031,0.0863],[0.3188,0.0799],[0.3377,0.0787],[0.3647,0.0871],[0.3952,0.0998],[0.4155,0.1017],[0.4218,0.0987],[0.4484,0.0967],[0.4936,0.1003],[0.5333,0.0991],[0.5594,0.0894],[0.5812,0.0826],[0.6018,0.0825],[0.6236,0.0956],[0.6354,0.1079],[0.6605,0.1344],[0.6879,0.1372],[0.72,0.124],[0.7647,0.1179],[0.8145,0.1188],[0.8477,0.126],[0.8661,0.1381],[0.8718,0.1443],[0.8763,0.1572],[0.8718,0.169],[0.8585,0.1791],[0.8468,0.1911],[0.8402,0.2064],[0.8425,0.2179],[0.8475,0.2214],[0.8612,0.2266],[0.8694,0.2365],[0.8692,0.2511],[0.8521,0.2705],[0.8298,0.2908],[0.8375,0.2996],[0.8653,0.303],[0.8759,0.3097],[0.8906,0.3331],[0.9064,0.3467],[0.9264,0.3431],[0.9445,0.3388],[0.9584,0.3394],[0.9682,0.3461],[0.9739,0.3593],[0.975,0.3675],[0.9739,0.3862],[0.9642,0.4095],[0.9342,0.4427],[0.8901,0.4798],[0.8508,0.5029],[0.8175,0.5159],[0.7944,0.5306],[0.7866,0.5385],[0.7694,0.5498],[0.7499,0.5551],[0.7245,0.5544],[0.692,0.5478],[0.6714,0.5489],[0.6687,0.5624],[0.6666,0.5785],[0.6636,0.5864],[0.6626,0.6057],[0.6918,0.6407],[0.7388,0.6806],[0.7663,0.693],[0.7792,0.6866],[0.7918,0.6872],[0.8029,0.6941],[0.8063,0.6993],[0.8087,0.7131],[0.8051,0.7296],[0.7953,0.7479],[0.7889,0.7763],[0.7891,0.8176],[0.7999,0.8482],[0.8225,0.8604],[0.8341,0.8664],[0.854,0.8846],[0.8674,0.9081],[0.8694,0.9267],[0.8602,0.9412],[0.8414,0.9545],[0.7985,0.9657],[0.7518,0.9694],[0.6076,0.9733],[0.5047,0.9717],[0.4794,0.9644],[0.4777,0.9541],[0.4815,0.9418],[0.504,0.9289],[0.5496,0.9159],[0.57,0.9091],[0.5945,0.894],[0.6015,0.8771],[0.6032,0.8574],[0.5994,0.8351],[0.5896,0.8105],[0.5754,0.7867],[0.5615,0.7725],[0.5546,0.7689],[0.5409,0.7664],[0.5272,0.7698],[0.515,0.7703],[0.5047,0.7647],[0.4939,0.7763],[0.4818,0.8128],[0.4692,0.8395],[0.4629,0.8448],[0.45,0.8428],[0.4361,0.8329],[0.4216,0.8191],[0.4075,0.8136],[0.3946,0.8123],[0.3853,0.8031],[0.3766,0.7936],[0.3691,0.7972],[0.3477,0.8214],[0.3356,0.8431],[0.3386,0.8542],[0.3425,0.8662],[0.3426,0.883],[0.3501,0.8928],[0.3687,0.8917],[0.3797,0.8918],[0.4024,0.8979],[0.4236,0.9101],[0.4353,0.923],[0.4382,0.936],[0.4339,0.9478],[0.4159,0.9586],[0.3643,0.9696],[0.3259,0.9751],[0.2672,0.9797],[0.2323,0.9755],[0.1986,0.9737],[0.1585,0.9777],[0.1229,0.9758],[0.0953,0.9642],[0.0857,0.956],[0.0758,0.9361],[0.0765,0.9126],[0.0819,0.8887],[0.0914,0.8665],[0.1042,0.8517],[0.118,0.8408],[0.1262,0.8227],[0.1281,0.811],[0.1347,0.793],[0.1449,0.7824],[0.1527,0.769],[0.1564,0.7496],[0.1624,0.7294],[0.1729,0.7103],[0.1798,0.6941],[0.1809,0.6875],[0.1835,0.6727],[0.2006,0.644],[0.2247,0.6077],[0.2332,0.5817],[0.2281,0.564],[0.2159,0.548],[0.1962,0.5357],[0.1832,0.5331],[0.1507,0.5352],[0.1254,0.5363],[0.1127,0.533],[0.1069,0.5181],[0.1064,0.4894],[0.1132,0.4625],[0.1283,0.4424],[0.1311,0.4364],[0.1194,0.4345],[0.0934,0.4404],[0.079,0.4384],[0.0743,0.4299],[0.0735,0.4189],[0.0739,0.4064],[0.0677,0.3956],[0.0621,0.3908],[0.0528,0.3684],[0.046,0.3289],[0.0468,0.2873],[0.0568,0.2484],[0.0603,0.2215],[0.0521,0.2096],[0.0443,0.197],[0.0421,0.1885],[0.042,0.1665],[0.0505,0.1363],[0.0633,0.101],[0.0682,0.0706],[0.0684,0.0449],[0.0732,0.0236],[0.0774,0.0146]]],
            art:[[[0.0998,0.0202],[0.1099,0.0226],[0.1175,0.0325],[0.1208,0.0494],[0.1259,0.0615],[0.1348,0.0648],[0.143,0.0679],[0.1491,0.0736],[0.1579,0.0769],[0.1713,0.0762],[0.1773,0.0734],[0.1855,0.0622],[0.1903,0.0478],[0.1966,0.0436],[0.2031,0.0556],[0.2065,0.1015],[0.2065,0.165],[0.2023,0.1975],[0.1971,0.2086],[0.2005,0.2272],[0.2104,0.247],[0.2152,0.2505],[0.2248,0.2444],[0.2308,0.2225],[0.2321,0.1854],[0.2341,0.1587],[0.2386,0.151],[0.2478,0.1574],[0.2621,0.1765],[0.2762,0.1891],[0.2882,0.1889],[0.295,0.174],[0.2961,0.1608],[0.2963,0.1299],[0.3015,0.1119],[0.311,0.1043],[0.3229,0.0993],[0.339,0.0988],[0.3648,0.1085],[0.3954,0.1227],[0.4157,0.1241],[0.4313,0.117],[0.4592,0.1139],[0.4778,0.1139],[0.5058,0.1162],[0.5214,0.1213],[0.5387,0.1202],[0.5624,0.1096],[0.5839,0.1021],[0.6005,0.1018],[0.6137,0.1072],[0.6239,0.1176],[0.6302,0.1296],[0.6321,0.1423],[0.6333,0.1473],[0.6379,0.1531],[0.645,0.1564],[0.6525,0.1659],[0.6612,0.1767],[0.6729,0.1734],[0.6877,0.1601],[0.7055,0.1491],[0.7274,0.1407],[0.7572,0.1357],[0.775,0.1345],[0.8077,0.1369],[0.8366,0.1456],[0.8489,0.1558],[0.8404,0.1659],[0.8278,0.1808],[0.8167,0.2022],[0.811,0.2193],[0.8122,0.2286],[0.8216,0.2356],[0.8397,0.2421],[0.8408,0.2489],[0.8159,0.2731],[0.771,0.3042],[0.7545,0.3206],[0.7652,0.3246],[0.7993,0.3233],[0.8448,0.3206],[0.8662,0.3286],[0.8702,0.3443],[0.8778,0.3589],[0.8908,0.3697],[0.9014,0.3707],[0.9311,0.3638],[0.9495,0.3681],[0.9492,0.3912],[0.9309,0.4209],[0.8951,0.4531],[0.8568,0.4777],[0.8211,0.4915],[0.7926,0.505],[0.7727,0.5216],[0.7567,0.5331],[0.7495,0.5358],[0.7314,0.5356],[0.6944,0.5281],[0.6493,0.5174],[0.6285,0.5158],[0.6275,0.5215],[0.6325,0.5292],[0.6413,0.539],[0.6466,0.5519],[0.6472,0.5674],[0.6393,0.5843],[0.6322,0.5933],[0.6365,0.6141],[0.6656,0.6387],[0.692,0.6617],[0.7069,0.6814],[0.721,0.6982],[0.7383,0.7123],[0.7565,0.7173],[0.7753,0.7108],[0.787,0.7082],[0.7892,0.7143],[0.7876,0.7197],[0.7801,0.7345],[0.77,0.7527],[0.767,0.7695],[0.7683,0.7843],[0.7657,0.7959],[0.7616,0.8076],[0.7628,0.8289],[0.7707,0.8546],[0.7893,0.8686],[0.8027,0.8712],[0.8252,0.8826],[0.8423,0.9023],[0.851,0.9179],[0.8504,0.9254],[0.8413,0.9327],[0.8237,0.9424],[0.7795,0.9481],[0.7026,0.9478],[0.6458,0.9485],[0.6266,0.9527],[0.6153,0.9547],[0.5733,0.957],[0.5206,0.9566],[0.5015,0.9519],[0.5128,0.9438],[0.5444,0.9355],[0.587,0.9251],[0.6119,0.9075],[0.6217,0.8841],[0.6242,0.8589],[0.6195,0.8317],[0.6145,0.8173],[0.5996,0.7866],[0.5809,0.7618],[0.5596,0.7456],[0.5419,0.7404],[0.5298,0.747],[0.5194,0.7481],[0.5093,0.738],[0.4969,0.7372],[0.4814,0.7525],[0.47,0.7759],[0.4667,0.7897],[0.4611,0.8133],[0.4469,0.8108],[0.4276,0.7922],[0.4132,0.7881],[0.4031,0.7909],[0.3958,0.7782],[0.3876,0.7604],[0.3673,0.7692],[0.3397,0.7971],[0.3198,0.8225],[0.3127,0.8342],[0.3078,0.8511],[0.3153,0.8592],[0.3216,0.8695],[0.322,0.8857],[0.3238,0.9021],[0.3292,0.9169],[0.342,0.9222],[0.3635,0.9157],[0.3846,0.9126],[0.4022,0.9182],[0.4084,0.9222],[0.4149,0.9308],[0.4128,0.9387],[0.4014,0.9416],[0.3842,0.9418],[0.3714,0.9466],[0.3573,0.9541],[0.324,0.9593],[0.2789,0.9615],[0.2442,0.9588],[0.2308,0.9556],[0.1984,0.9537],[0.1585,0.9577],[0.1259,0.9573],[0.1054,0.949],[0.0982,0.9283],[0.1048,0.8936],[0.1173,0.8681],[0.133,0.8594],[0.1432,0.8529],[0.1449,0.8437],[0.1459,0.8398],[0.1515,0.8348],[0.1589,0.8309],[0.1585,0.82],[0.1541,0.8054],[0.1574,0.7978],[0.1659,0.7923],[0.1721,0.7743],[0.1779,0.7475],[0.1884,0.723],[0.2003,0.7021],[0.2029,0.6947],[0.2014,0.6859],[0.2024,0.6797],[0.2097,0.6742],[0.2227,0.6573],[0.2412,0.6248],[0.2527,0.5947],[0.2533,0.573],[0.2478,0.5547],[0.2377,0.5382],[0.2246,0.5251],[0.217,0.52],[0.198,0.5132],[0.1682,0.5122],[0.1355,0.5123],[0.123,0.4996],[0.1286,0.4762],[0.1457,0.4491],[0.1648,0.4225],[0.1573,0.4092],[0.1315,0.4077],[0.1123,0.4134],[0.1052,0.419],[0.0983,0.4127],[0.101,0.3829],[0.0984,0.365],[0.0855,0.3709],[0.0735,0.363],[0.0663,0.3289],[0.0657,0.2918],[0.0722,0.2596],[0.0798,0.2376],[0.0864,0.2277],[0.0869,0.2235],[0.0804,0.2126],[0.0681,0.1972],[0.0635,0.1735],[0.066,0.1448],[0.0741,0.1209],[0.0846,0.0997],[0.0885,0.0755],[0.0881,0.0507],[0.0905,0.0328],[0.0928,0.0264]]] } },
  "Glamarchy": { w:437, h:656, foot:1.0,
    tight:{ panel:[[[0.2978,0.0139],[0.3152,0.0086],[0.3347,0.0051],[0.416,0.0017],[0.478,0.0017],[0.5541,0.0029],[0.6539,0.0063],[0.6776,0.0086],[0.6839,0.0112],[0.6961,0.0203],[0.7019,0.0267],[0.7077,0.0343],[0.7208,0.0455],[0.7283,0.0492],[0.7363,0.0514],[0.7553,0.0597],[0.7663,0.0657],[0.7783,0.073],[0.7938,0.0895],[0.7972,0.0987],[0.7978,0.1086],[0.7995,0.1169],[0.8064,0.1286],[0.8115,0.1321],[0.8156,0.136],[0.8209,0.1452],[0.8221,0.1505],[0.8215,0.1559],[0.8152,0.1665],[0.8095,0.1719],[0.8049,0.1773],[0.7992,0.1885],[0.7981,0.1942],[0.7949,0.2002],[0.7826,0.213],[0.7735,0.2199],[0.7662,0.2286],[0.7572,0.2513],[0.7554,0.2654],[0.7572,0.2781],[0.7623,0.2893],[0.7829,0.3075],[0.7922,0.3155],[0.7988,0.3232],[0.8038,0.3373],[0.8091,0.345],[0.8185,0.3536],[0.8498,0.3733],[0.8636,0.3824],[0.8733,0.3904],[0.8807,0.403],[0.8811,0.4082],[0.8803,0.4127],[0.8747,0.4202],[0.8766,0.4244],[0.8837,0.4296],[0.9139,0.4425],[0.9282,0.4492],[0.9391,0.4559],[0.9465,0.4625],[0.9524,0.4747],[0.9521,0.4796],[0.9497,0.4838],[0.9405,0.4932],[0.9359,0.5018],[0.9314,0.513],[0.9206,0.538],[0.9129,0.547],[0.9036,0.5535],[0.8873,0.5628],[0.8873,0.5687],[0.8927,0.5755],[0.9116,0.5897],[0.9168,0.5955],[0.9191,0.6002],[0.916,0.6077],[0.9118,0.6111],[0.9056,0.6143],[0.8916,0.6207],[0.8876,0.6243],[0.8856,0.6282],[0.8856,0.6324],[0.883,0.6394],[0.8804,0.6421],[0.877,0.6444],[0.877,0.6539],[0.8804,0.661],[0.8862,0.6698],[0.8929,0.6859],[0.8939,0.6932],[0.8933,0.7001],[0.8874,0.7107],[0.8822,0.7144],[0.8753,0.717],[0.8611,0.7187],[0.8538,0.7176],[0.8464,0.7153],[0.832,0.7139],[0.8249,0.7147],[0.8181,0.7167],[0.8106,0.7169],[0.7941,0.7127],[0.7849,0.7081],[0.7805,0.7103],[0.7858,0.7349],[0.7955,0.7574],[0.8055,0.7755],[0.8264,0.7986],[0.8372,0.8035],[0.8463,0.8084],[0.8587,0.8178],[0.8621,0.8224],[0.8658,0.832],[0.8741,0.8664],[0.8787,0.8912],[0.882,0.9121],[0.8847,0.9421],[0.8842,0.9512],[0.8781,0.9602],[0.8667,0.9689],[0.8275,0.9859],[0.7725,0.9922],[0.6846,0.9964],[0.4108,0.9985],[0.2929,0.9978],[0.2105,0.9965],[0.1522,0.9918],[0.1424,0.9887],[0.1344,0.985],[0.1236,0.9764],[0.1226,0.9625],[0.1251,0.9392],[0.141,0.8647],[0.1473,0.8316],[0.1502,0.8072],[0.1456,0.7847],[0.145,0.7773],[0.1479,0.7695],[0.1639,0.7525],[0.1705,0.7447],[0.1739,0.7378],[0.1742,0.7319],[0.1672,0.7227],[0.1618,0.719],[0.155,0.7161],[0.1402,0.7102],[0.1344,0.7052],[0.1299,0.6989],[0.1247,0.684],[0.1247,0.6769],[0.1264,0.6702],[0.132,0.6566],[0.1329,0.649],[0.1324,0.6408],[0.1319,0.6234],[0.1359,0.6148],[0.1427,0.6063],[0.1596,0.5909],[0.1642,0.5852],[0.1662,0.5808],[0.1656,0.5777],[0.1675,0.5716],[0.1699,0.5686],[0.1733,0.5655],[0.1738,0.5552],[0.1708,0.5478],[0.1656,0.5391],[0.16,0.5224],[0.1596,0.5145],[0.1608,0.5069],[0.1575,0.493],[0.153,0.4869],[0.1467,0.4811],[0.1384,0.4711],[0.1364,0.4668],[0.1359,0.463],[0.1399,0.4508],[0.1445,0.4425],[0.1507,0.4325],[0.1583,0.4246],[0.1773,0.4148],[0.1888,0.4129],[0.1961,0.4104],[0.1982,0.4038],[0.1931,0.3996],[0.1891,0.3955],[0.1845,0.3876],[0.1839,0.3838],[0.1856,0.3787],[0.1959,0.3649],[0.2045,0.3561],[0.2094,0.3492],[0.208,0.3407],[0.2017,0.3392],[0.1947,0.3385],[0.1785,0.3397],[0.1693,0.3417],[0.1536,0.3388],[0.1024,0.3188],[0.0669,0.3016],[0.0403,0.2876],[0.0226,0.2768],[0.0137,0.2645],[0.0146,0.2605],[0.0163,0.2571],[0.0223,0.2519],[0.0285,0.25],[0.0373,0.2485],[0.0632,0.2466],[0.0711,0.2443],[0.0725,0.2405],[0.0561,0.2283],[0.0466,0.2206],[0.0392,0.212],[0.0303,0.1923],[0.0328,0.1819],[0.041,0.1714],[0.0752,0.1502],[0.0944,0.1438],[0.1127,0.1417],[0.1301,0.1439],[0.1599,0.1542],[0.1696,0.1556],[0.1759,0.1543],[0.1801,0.1462],[0.1798,0.1415],[0.1779,0.1362],[0.1733,0.125],[0.1745,0.1197],[0.1779,0.1145],[0.1878,0.1046],[0.1904,0.0997],[0.1914,0.0947],[0.1935,0.0845],[0.1995,0.079],[0.2088,0.0732],[0.2337,0.0597],[0.2457,0.0512],[0.2574,0.0413],[0.2689,0.0303]]],
            art:[[[0.4379,0.0034],[0.4565,0.0069],[0.478,0.0034],[0.488,0.002],[0.4989,0.0062],[0.5117,0.0076],[0.5349,0.0102],[0.5461,0.0162],[0.5572,0.0191],[0.5757,0.0161],[0.5875,0.0194],[0.6025,0.0257],[0.609,0.0213],[0.6279,0.0259],[0.6456,0.0362],[0.6593,0.0373],[0.6616,0.0332],[0.6593,0.0274],[0.6602,0.0234],[0.6648,0.0257],[0.6716,0.0406],[0.6796,0.051],[0.6977,0.061],[0.7042,0.0671],[0.7078,0.0722],[0.7228,0.0728],[0.7316,0.0738],[0.7378,0.0807],[0.748,0.0846],[0.7609,0.0883],[0.7537,0.0894],[0.7443,0.0928],[0.7437,0.0968],[0.75,0.1016],[0.7629,0.1116],[0.7643,0.1216],[0.7755,0.1387],[0.7868,0.1493],[0.7769,0.153],[0.7687,0.1603],[0.7673,0.1862],[0.762,0.1953],[0.7537,0.1982],[0.7477,0.2067],[0.7416,0.213],[0.7261,0.2214],[0.7243,0.2277],[0.7277,0.2451],[0.7243,0.2687],[0.7265,0.2909],[0.745,0.3151],[0.7594,0.3258],[0.7715,0.3338],[0.7623,0.3335],[0.752,0.3363],[0.7574,0.3448],[0.8149,0.3811],[0.8407,0.399],[0.8321,0.4002],[0.8192,0.4116],[0.8209,0.4279],[0.8364,0.4373],[0.86,0.4453],[0.9106,0.4679],[0.9199,0.4764],[0.9066,0.4907],[0.8985,0.5164],[0.8917,0.5336],[0.885,0.5328],[0.8833,0.5238],[0.879,0.5095],[0.869,0.5086],[0.8544,0.532],[0.8471,0.5556],[0.8427,0.5518],[0.8311,0.5258],[0.8098,0.5261],[0.7969,0.5347],[0.8021,0.5415],[0.7969,0.5461],[0.7926,0.5496],[0.7938,0.5596],[0.8038,0.5684],[0.8198,0.5771],[0.8438,0.5808],[0.8603,0.5842],[0.8814,0.5948],[0.8764,0.5939],[0.8511,0.5882],[0.8378,0.592],[0.8395,0.608],[0.851,0.622],[0.8487,0.6275],[0.8337,0.6286],[0.8301,0.6332],[0.8395,0.6498],[0.853,0.6663],[0.8624,0.6898],[0.8616,0.695],[0.855,0.6869],[0.8412,0.6755],[0.8314,0.6726],[0.8198,0.6755],[0.8142,0.6819],[0.8089,0.6928],[0.8069,0.6825],[0.8035,0.6557],[0.7983,0.6502],[0.7926,0.6494],[0.7848,0.6545],[0.7826,0.6643],[0.7796,0.6771],[0.7726,0.6728],[0.7589,0.6683],[0.7491,0.6696],[0.7388,0.6759],[0.737,0.6869],[0.7403,0.7056],[0.7574,0.7445],[0.773,0.773],[0.776,0.795],[0.7829,0.8035],[0.8136,0.8155],[0.8284,0.8251],[0.8374,0.8417],[0.8498,0.9118],[0.8471,0.9496],[0.8222,0.9614],[0.8138,0.9659],[0.8082,0.9719],[0.7981,0.9726],[0.7852,0.976],[0.7737,0.9806],[0.7394,0.9851],[0.6793,0.9917],[0.6679,0.9956],[0.5392,0.9985],[0.3899,0.9974],[0.2903,0.988],[0.2567,0.9828],[0.2065,0.9807],[0.1779,0.9754],[0.158,0.9599],[0.1679,0.883],[0.1778,0.8389],[0.1779,0.8194],[0.1814,0.8119],[0.1874,0.8002],[0.1842,0.79],[0.1792,0.7828],[0.1736,0.7778],[0.1822,0.7687],[0.208,0.7432],[0.2251,0.7182],[0.2363,0.6953],[0.2331,0.692],[0.222,0.6905],[0.2132,0.6963],[0.2051,0.7096],[0.1974,0.7119],[0.1934,0.7015],[0.1745,0.6995],[0.1645,0.6972],[0.1618,0.6846],[0.1582,0.6785],[0.1573,0.6697],[0.1696,0.6585],[0.1755,0.6498],[0.1685,0.6431],[0.1779,0.6353],[0.2015,0.621],[0.2051,0.6143],[0.1982,0.608],[0.1876,0.6075],[0.1759,0.6138],[0.1613,0.6258],[0.1588,0.6252],[0.1665,0.616],[0.1786,0.6066],[0.2022,0.596],[0.213,0.5897],[0.2138,0.5803],[0.2074,0.5777],[0.2011,0.5769],[0.2217,0.5692],[0.2404,0.5603],[0.2592,0.5436],[0.2586,0.5362],[0.2453,0.5336],[0.2371,0.5391],[0.2285,0.5431],[0.2271,0.5402],[0.2337,0.532],[0.2431,0.5171],[0.2337,0.513],[0.2191,0.5181],[0.2137,0.5274],[0.2162,0.5372],[0.2165,0.5428],[0.2111,0.5488],[0.2077,0.5391],[0.2081,0.522],[0.1948,0.5114],[0.1929,0.5072],[0.2117,0.4987],[0.2191,0.4935],[0.2178,0.4849],[0.2091,0.4764],[0.1992,0.4729],[0.1865,0.4784],[0.1831,0.4754],[0.1796,0.4654],[0.1716,0.463],[0.1759,0.4567],[0.1878,0.4499],[0.1831,0.4396],[0.1825,0.4359],[0.1934,0.4364],[0.2165,0.4295],[0.2314,0.4193],[0.2366,0.4076],[0.2397,0.3987],[0.2497,0.3829],[0.24,0.3798],[0.2228,0.3809],[0.2314,0.374],[0.2411,0.3666],[0.2459,0.3545],[0.2534,0.3476],[0.2521,0.3356],[0.2205,0.3228],[0.1854,0.3136],[0.1769,0.3156],[0.1713,0.3196],[0.1439,0.3144],[0.0884,0.2891],[0.0695,0.2673],[0.104,0.2672],[0.131,0.2607],[0.1364,0.2534],[0.1281,0.2394],[0.1064,0.2269],[0.0789,0.2136],[0.0721,0.2022],[0.0711,0.1957],[0.0611,0.1846],[0.0686,0.182],[0.0905,0.1808],[0.0958,0.1763],[0.0963,0.1718],[0.092,0.1665],[0.0953,0.1616],[0.1055,0.1576],[0.1096,0.1635],[0.1413,0.1749],[0.1751,0.1821],[0.1871,0.1892],[0.1891,0.1945],[0.1968,0.2016],[0.2191,0.2073],[0.2374,0.2067],[0.2477,0.2016],[0.2466,0.1959],[0.2376,0.1858],[0.2314,0.1829],[0.2245,0.1798],[0.2228,0.1724],[0.2187,0.1669],[0.208,0.164],[0.2088,0.1589],[0.2157,0.1481],[0.2145,0.1418],[0.224,0.1338],[0.2361,0.1292],[0.2374,0.1246],[0.2241,0.1212],[0.2102,0.1246],[0.212,0.1206],[0.226,0.1109],[0.2234,0.0978],[0.2244,0.0931],[0.243,0.0929],[0.2469,0.0882],[0.2457,0.0809],[0.2612,0.0777],[0.2717,0.0723],[0.2789,0.0544],[0.2852,0.0499],[0.2968,0.0502],[0.3038,0.0471],[0.3064,0.0391],[0.3045,0.0333],[0.3089,0.0316],[0.3209,0.0316],[0.3261,0.0278],[0.3364,0.0267],[0.3484,0.0282],[0.3879,0.0191],[0.41,0.0111],[0.4191,0.0046]]] },
    body: { panel:[[[0.4173,0.001],[0.46,0.0],[0.5572,0.0008],[0.587,0.0023],[0.6087,0.0076],[0.614,0.0098],[0.6267,0.0116],[0.6342,0.0112],[0.6516,0.0136],[0.6616,0.0164],[0.6725,0.0202],[0.6908,0.0295],[0.6982,0.0351],[0.713,0.0473],[0.7235,0.0534],[0.7511,0.0655],[0.7636,0.0719],[0.7812,0.0856],[0.7863,0.0928],[0.7923,0.1047],[0.7932,0.1094],[0.7926,0.1132],[0.7971,0.1214],[0.8021,0.1258],[0.8142,0.1348],[0.8179,0.1392],[0.8207,0.1477],[0.8197,0.1518],[0.8129,0.1597],[0.8072,0.1635],[0.7996,0.1745],[0.7978,0.1818],[0.7972,0.1902],[0.7888,0.2061],[0.7809,0.2136],[0.7626,0.2294],[0.7569,0.2393],[0.7523,0.2631],[0.7526,0.2739],[0.7574,0.29],[0.762,0.2954],[0.7673,0.3054],[0.768,0.3102],[0.7674,0.3148],[0.7839,0.3311],[0.8009,0.3428],[0.8401,0.3701],[0.8498,0.3825],[0.8495,0.4047],[0.8521,0.4143],[0.8753,0.4304],[0.8959,0.4369],[0.9268,0.4485],[0.9371,0.4535],[0.9439,0.4581],[0.9461,0.4784],[0.9414,0.4941],[0.9226,0.5299],[0.9109,0.5433],[0.8827,0.5608],[0.8726,0.5687],[0.8664,0.5865],[0.8704,0.5964],[0.8729,0.6137],[0.8713,0.621],[0.8678,0.6275],[0.8678,0.6404],[0.8713,0.6469],[0.8813,0.6599],[0.8842,0.6663],[0.8856,0.6793],[0.8836,0.6849],[0.8736,0.6936],[0.8656,0.6966],[0.844,0.699],[0.8304,0.6984],[0.8149,0.6965],[0.7926,0.6906],[0.7858,0.6867],[0.778,0.6789],[0.7746,0.677],[0.7686,0.6772],[0.7693,0.6848],[0.7815,0.7207],[0.7929,0.7489],[0.8154,0.7878],[0.8264,0.7986],[0.8372,0.8035],[0.8538,0.814],[0.8596,0.8196],[0.8676,0.8375],[0.8716,0.8561],[0.8796,0.9129],[0.8806,0.9378],[0.8736,0.9672],[0.8656,0.9718],[0.8508,0.9775],[0.8441,0.9787],[0.8378,0.9787],[0.8175,0.9824],[0.8035,0.9861],[0.7383,0.9948],[0.6576,0.9972],[0.4002,0.9985],[0.2885,0.9977],[0.1642,0.9939],[0.1516,0.9909],[0.1333,0.9848],[0.1276,0.9817],[0.1241,0.9787],[0.1267,0.9425],[0.1327,0.9095],[0.1483,0.8321],[0.152,0.8066],[0.1513,0.7818],[0.1537,0.7711],[0.1711,0.7412],[0.1859,0.7222],[0.1989,0.7012],[0.1971,0.6993],[0.1896,0.7031],[0.1743,0.7073],[0.1665,0.7077],[0.1516,0.7056],[0.1459,0.7037],[0.1379,0.6982],[0.1353,0.6938],[0.1327,0.681],[0.1327,0.6726],[0.1362,0.659],[0.1396,0.6538],[0.1442,0.6496],[0.1499,0.6409],[0.151,0.6364],[0.1545,0.6268],[0.1613,0.6213],[0.1854,0.6088],[0.1961,0.6034],[0.2085,0.5957],[0.2102,0.5934],[0.2094,0.5854],[0.2068,0.5796],[0.2028,0.5728],[0.2038,0.5599],[0.2088,0.5539],[0.2224,0.5417],[0.2255,0.5345],[0.2245,0.5177],[0.2221,0.5102],[0.2151,0.4989],[0.2105,0.495],[0.2005,0.4903],[0.1951,0.4893],[0.1894,0.4893],[0.1783,0.4873],[0.1731,0.4853],[0.1635,0.4788],[0.1598,0.4739],[0.1545,0.4606],[0.1562,0.4526],[0.1716,0.4348],[0.1854,0.4249],[0.2025,0.4045],[0.2059,0.3941],[0.2059,0.3834],[0.2094,0.3658],[0.2128,0.3588],[0.2187,0.3481],[0.2167,0.3439],[0.2028,0.3378],[0.1938,0.3362],[0.1745,0.3361],[0.1642,0.3377],[0.1277,0.3281],[0.1015,0.3171],[0.0701,0.3018],[0.0303,0.2796],[0.022,0.2727],[0.0219,0.2646],[0.0233,0.261],[0.0292,0.2546],[0.035,0.252],[0.0541,0.2483],[0.0672,0.2471],[0.0764,0.2409],[0.0724,0.2357],[0.0626,0.2292],[0.0466,0.2131],[0.0403,0.2035],[0.0335,0.1838],[0.0352,0.1764],[0.0489,0.1663],[0.0618,0.1632],[0.1004,0.1601],[0.1261,0.1601],[0.1635,0.1615],[0.1751,0.1629],[0.1819,0.1648],[0.1922,0.1652],[0.1957,0.1637],[0.1991,0.1576],[0.1991,0.1534],[0.1957,0.1427],[0.1948,0.1377],[0.1974,0.1296],[0.2008,0.1265],[0.2038,0.1173],[0.2034,0.1111],[0.2017,0.1038],[0.2034,0.0908],[0.2068,0.085],[0.2217,0.0721],[0.236,0.0624],[0.2783,0.0364],[0.2985,0.0258],[0.3289,0.0152],[0.3392,0.0152],[0.3564,0.0124],[0.3633,0.0095],[0.369,0.0057]]],
            art:[[[0.4874,0.0029],[0.4974,0.0062],[0.5109,0.0076],[0.5263,0.0085],[0.5452,0.0162],[0.5562,0.0191],[0.5666,0.0166],[0.5817,0.0182],[0.6124,0.0307],[0.6253,0.0328],[0.6322,0.031],[0.639,0.0341],[0.6515,0.0418],[0.6633,0.0427],[0.6772,0.049],[0.6928,0.0636],[0.7203,0.0791],[0.738,0.0834],[0.7443,0.0896],[0.7437,0.0968],[0.7557,0.1048],[0.7612,0.1099],[0.7586,0.1159],[0.7626,0.1251],[0.7836,0.144],[0.784,0.1494],[0.7743,0.1501],[0.7669,0.1534],[0.7622,0.1657],[0.7654,0.181],[0.7644,0.1921],[0.756,0.1955],[0.7474,0.2024],[0.7433,0.2095],[0.7271,0.2147],[0.7044,0.2189],[0.6885,0.2281],[0.6871,0.2335],[0.6914,0.237],[0.7005,0.2384],[0.7195,0.2401],[0.7237,0.2557],[0.7228,0.2796],[0.7277,0.2955],[0.7376,0.3107],[0.7377,0.3213],[0.7507,0.3377],[0.7826,0.3617],[0.8178,0.3834],[0.8258,0.3867],[0.8247,0.3912],[0.8179,0.3966],[0.8175,0.4055],[0.8142,0.4093],[0.8035,0.4101],[0.7943,0.4126],[0.7971,0.4241],[0.8387,0.4409],[0.8977,0.4616],[0.9185,0.4735],[0.9065,0.4895],[0.8985,0.5135],[0.8917,0.5302],[0.8867,0.5335],[0.8839,0.5275],[0.882,0.5075],[0.8756,0.5015],[0.866,0.5047],[0.8593,0.5204],[0.852,0.5487],[0.8464,0.5518],[0.842,0.5458],[0.8392,0.5318],[0.8289,0.5215],[0.8178,0.5232],[0.8078,0.5221],[0.7991,0.5198],[0.7892,0.5221],[0.789,0.5269],[0.7963,0.5339],[0.7995,0.5407],[0.7922,0.549],[0.7903,0.5543],[0.7942,0.5604],[0.8089,0.5696],[0.833,0.5858],[0.8318,0.5953],[0.8324,0.6044],[0.8398,0.6136],[0.839,0.6256],[0.832,0.6344],[0.8381,0.6513],[0.8503,0.6707],[0.8395,0.6742],[0.8264,0.6724],[0.8155,0.6745],[0.8082,0.6713],[0.8031,0.6541],[0.7972,0.6465],[0.7889,0.6435],[0.7795,0.6435],[0.7674,0.6481],[0.7652,0.653],[0.758,0.6578],[0.7428,0.6618],[0.7351,0.6869],[0.7434,0.7167],[0.7574,0.7464],[0.773,0.7735],[0.776,0.795],[0.7833,0.8038],[0.8049,0.8123],[0.8237,0.8213],[0.8378,0.842],[0.8458,0.8824],[0.8507,0.934],[0.843,0.9569],[0.8104,0.9627],[0.7772,0.9722],[0.7344,0.9817],[0.6819,0.9897],[0.6356,0.9937],[0.6289,0.9922],[0.6227,0.9937],[0.6041,0.997],[0.4797,0.9985],[0.4096,0.997],[0.391,0.9937],[0.3849,0.9922],[0.3781,0.9937],[0.3361,0.9897],[0.2896,0.9833],[0.254,0.9819],[0.2277,0.983],[0.1968,0.9762],[0.1789,0.9716],[0.1616,0.9701],[0.1573,0.9436],[0.1762,0.8559],[0.1805,0.8256],[0.1783,0.8188],[0.1814,0.8119],[0.1869,0.7988],[0.1828,0.7853],[0.1839,0.7719],[0.1942,0.7601],[0.22,0.7264],[0.2386,0.6964],[0.2446,0.6804],[0.2394,0.6755],[0.2188,0.6709],[0.2008,0.6735],[0.1816,0.6825],[0.1686,0.6844],[0.1656,0.6683],[0.1762,0.6578],[0.1909,0.649],[0.1914,0.6418],[0.1901,0.63],[0.2128,0.6179],[0.2326,0.6056],[0.242,0.5939],[0.2394,0.5785],[0.2331,0.5684],[0.2428,0.5545],[0.2616,0.5393],[0.2672,0.5288],[0.2627,0.5261],[0.2554,0.525],[0.2521,0.5211],[0.2553,0.5082],[0.2491,0.4981],[0.239,0.4873],[0.2386,0.4762],[0.239,0.4627],[0.2228,0.46],[0.2077,0.4613],[0.1982,0.4665],[0.1879,0.4647],[0.1865,0.455],[0.2022,0.44],[0.2271,0.4224],[0.2366,0.4076],[0.2406,0.3993],[0.2514,0.3891],[0.2546,0.3807],[0.2413,0.3726],[0.2408,0.3657],[0.2484,0.3582],[0.2589,0.3546],[0.2735,0.352],[0.276,0.3479],[0.2604,0.3388],[0.2225,0.3236],[0.1898,0.3151],[0.1589,0.3164],[0.119,0.3022],[0.0715,0.2792],[0.0538,0.2681],[0.0632,0.2667],[0.0738,0.2691],[0.0844,0.2695],[0.0938,0.2666],[0.1127,0.2654],[0.1276,0.2667],[0.1379,0.2637],[0.1429,0.2572],[0.1364,0.2447],[0.1211,0.2338],[0.0961,0.2207],[0.0764,0.2064],[0.0699,0.186],[0.0953,0.1822],[0.1352,0.1845],[0.1562,0.1837],[0.1712,0.1854],[0.1891,0.197],[0.2077,0.2065],[0.2251,0.2102],[0.238,0.2216],[0.2397,0.2333],[0.2483,0.2401],[0.2606,0.2409],[0.2683,0.2248],[0.2659,0.2136],[0.2572,0.2077],[0.2481,0.1994],[0.2376,0.1805],[0.2314,0.1742],[0.2271,0.1718],[0.2285,0.166],[0.2324,0.1534],[0.2271,0.145],[0.2267,0.1378],[0.2348,0.1321],[0.24,0.1235],[0.2374,0.1177],[0.2383,0.113],[0.2404,0.109],[0.234,0.1016],[0.2331,0.0979],[0.2403,0.0966],[0.246,0.0933],[0.2484,0.0837],[0.2549,0.0808],[0.2642,0.0796],[0.2695,0.0739],[0.2789,0.0611],[0.2952,0.0539],[0.3105,0.0465],[0.3218,0.0383],[0.339,0.0349],[0.3515,0.0376],[0.3641,0.0362],[0.3757,0.0314],[0.3856,0.0229],[0.4026,0.0176],[0.4362,0.0135],[0.4628,0.0091],[0.4745,0.004]]] } },
};

````````

## src/board/standee.js

Packaged at: project/src/board/standee.js

````````text
import { characterId } from "../data/spiritIdentity.js";
// 🎭 STANDEES — the Spirits' own art, cut out of acrylic and stood on the board.
//
// Alex, 2026-09-18: "Would you be able to take my 2D characters and make them
// like a standee in the 3D game - give them some 'depth' and stand them up?"
// This replaces `spiritMiniature`'s block pawns in `arenaVisuals.js`.
//
// ⭐ EVERY NUMBER HERE IS ALEX'S DIAL-IN off `.scratch/standee-preview.html`
// (2026-09-18): 1 of 26 levers moved — `height` 2.6 → 2.8 — plus `cut`, ruled
// in words on 2026-09-25 (ruling 3 below). Move a number here →
// move it on the page too, or the next dial-in is measured against the wrong
// defaults. `standeeCheck.mjs` §0 fails if they drift apart.
//
// 🎯 HIS THREE RULINGS, and they are why this file looks the way it does:
//
//  1. FACING — "the facing is the way the spirit is facing - so the only true
//     'direct' facing is the angle at which the Spirit is actually facing on the
//     board", and "lets do away with 'mirror'". So the sheet turns with the
//     Spirit and NOTHING turns it toward the camera, there is one print (not a
//     mirrored pair), and it is `DoubleSide` — the back is the front seen from
//     behind, through the sheet, which is what a real printed standee does.
//     ⚠️ `facing:'soft'`/`'camera'` exist as the settings he rejected; the only
//     thing the camera may ever change is PITCH (`steepLean`), never yaw.
//  2. LOOK — "make it look acrylic with neon edges - but behind that, a
//     transparent gloss look". An extruded sheet, a neon ribbon on the cut edge
//     in the Spirit's colour, and real transmission behind the print.
//  3. CUT — ⚠️ REVERSED 2026-09-25. It was "cut everything in the art" (`tight`:
//     the Ronin's lightning as spurs of acrylic). Now: "Only the immediate
//     physical part of the standee should be covered in the acrylic layer, other
//     'effect' areas should be cut off." So the default is `body` — the figure
//     with its glow, its bolts and its loose drips cut away, from the print as
//     well as the sheet (both are built from the same ring). `tight` stays in
//     `standeeOutlines.js` as the record and as a lever on the preview page.
//
// 📌 TWO HALVES, like `moveTiles.js`. The top is pure — no three, no DOM, no
// clock: where the geometry's points go, what the yaw is, how far a high camera
// may tip a sheet. The bottom is the three.js half. A Spirit with no traced
// outline gets a plain rectangular cut of its art rather than nothing.
import * as THREE from 'three';
import { STANDEE_OUTLINES } from './standeeOutlines.js';

export const STANDEE = Object.freeze({
  cut:'body', panelLook:'glass',
  height:2.8, thickness:0.1, lip:'lip', lipScale:1.03,
  panelTint:'#9fd8ff', panelOpacity:0.16, gloss:0.92, artLift:0.85,
  edgeColor:'spirit', edgeFixed:'#4fe8ff', edgeGlow:2, edgeSpread:0.35,
  base:'disc', baseGlow:0.9, lean:4, bob:0.025, sink:0.06, shadow:0.35, koTilt:78,
  facing:'board', softDeg:25, steepLean:35, actingRing:'on', nameTag:'off',
});

/** The board height a standee stands at — its stand's underside, on the deck. */
export const STANDEE_Y = 0.2;
/** ⚠️ The trace threshold in `standeeOutlines.js` is this × 255 (= 115). */
const ALPHA_TEST = 0.45;
/** A Spirit with no traced outline: the whole image, cut square. */
const PLAIN_CUT = Object.freeze({ panel:[[[0, 0], [1, 0], [1, 1], [0, 1]]], art:[[[0, 0], [1, 0], [1, 1], [0, 1]]] });

// ── pure ─────────────────────────────────────────────────────────────────────

/** The outline record for a Spirit, and the cut `T.cut` asks for. */
export function cutFor(id, T = STANDEE) {
  const o = STANDEE_OUTLINES[characterId(id)];
  if (!o) return { w:1, h:1, foot:1, ...PLAIN_CUT };
  // ⚠️ An unknown cut falls back to the SHIPPED cut, not to `tight` — a typo
  // must not quietly put the lightning back on.
  return { w:o.w, h:o.h, foot:o.foot, ...(o[T.cut] ?? o[STANDEE.cut] ?? o.tight) };
}

/**
 * One outline point in world units. The outline is 0…1 of the image with y from
 * the TOP, so this flips y and puts the feet on 0; x is centred on the Spirit.
 */
export const outlinePoint = ([x, y], w, h, height, scale = 1) =>
  [(x - 0.5) * height * (w / h) * scale, (1 - y) * height * scale];

/** Half the cut's width in world units — what the stand has to be wide enough for. */
export function halfWidth(rings, w, h, height, scale = 1) {
  let m = 0;
  for (const r of rings) for (const p of r) m = Math.max(m, Math.abs(outlinePoint(p, w, h, height, scale)[0]));
  return m;
}

/**
 * Which way the sheet turns. ⭐ `board` is Alex's ruling and the only setting
 * shipped: the Spirit's own facing, with no cheat toward the camera.
 *
 * ⭐ THE FLAT ART IS THE DIRECTION (Alex, 2026-09-18: *"I'd like the base art
 * part to be the 'direction'"*). The sheet's FACE points where the Spirit is
 * facing, so a Spirit walking toward you is a Spirit you are looking at. The
 * cut edge is what you see from the side, which is what a standee on a table
 * does. Three facts pin the one line below, and all three are load-bearing:
 *
 *  1. `hexGeometry.facingAngle` is `atan2(dy, dx)` in SVG PIXELS, and
 *     `arenaPoint` maps px → +x and py → +z. So facing `f` is the world
 *     direction `(cos f, 0, sin f)`.
 *  2. A three.js Y rotation of `yaw` points local +z at `(sin yaw, 0, cos yaw)`
 *     — an angle of `π/2 − yaw` in the same convention as (1).
 *  3. The art plane is a `ShapeGeometry` in XY, so its normal IS local +z.
 *
 * Put together: `yaw = π/2 − f`.
 *
 * ⚠️ IT IS A MINUS, NOT A PLUS, AND THAT IS THE WHOLE BUG THIS REPLACED.
 * `spiritMiniature` used `facing + π/2`, which is this MIRRORED about the x
 * axis: right at facing 0° and 180°, a full 180° wrong at 90° and 270°, and
 * exactly 90° wrong on the diagonals — which on a hex board is most of the
 * time, and is why the standees read edge-on. The block pawn had the same bug
 * for as long as it existed; nobody could see it because a chunky block has no
 * readable front. ⭐ The blocks now share this function, so there is one
 * convention on the board instead of two.
 *
 * `toCamera` is a YAW (what you would set `rotation.y` to), not a world angle —
 * do not pass an `atan2` straight in.
 */
export function standeeYaw(facing, { toCamera = 0, T = STANDEE } = {}) {
  const base = Math.PI / 2 - (facing ?? 0);
  if (T.facing === 'camera') return toCamera;
  if (T.facing !== 'soft') return base;
  const d = ((toCamera - base + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return base + Math.max(-1, Math.min(1, d / (Math.PI / 2))) * THREE.MathUtils.degToRad(T.softDeg);
}

/**
 * How far to tip the sheet BACK under a high camera, in radians.
 *
 * 📌 PITCH ONLY, and that is the whole point. The tactical view looks almost
 * straight down and a standee is a sheet — from up there it is a line. Tipping
 * it back keeps it readable without touching WHICH WAY the Spirit faces, which
 * is the thing Alex ruled on. `steepLean:0` leaves them honest and thin.
 */
export function steepPitch(elevation, T = STANDEE) {
  const t = Math.max(0, Math.min(1, (elevation - Math.PI / 5) / (Math.PI * 0.38)));
  return THREE.MathUtils.degToRad(T.steepLean) * (t * t * (3 - 2 * t));
}

// ── three.js ─────────────────────────────────────────────────────────────────

const shapeFrom = (points, w, h, height, scale = 1) =>
  new THREE.Shape(points.map(p => new THREE.Vector2(...outlinePoint(p, w, h, height, scale))));
const shapesFrom = (rings, w, h, height, scale = 1) => rings.map(r => shapeFrom(r, w, h, height, scale));

function ribbon(points, w, h, height, depth, scale = 1) {
  const v = [], n = [], P = points.map(p => outlinePoint(p, w, h, height, scale));
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = dy / len, ny = -dx / len;
    v.push(a[0], a[1], depth / 2, b[0], b[1], depth / 2, a[0], a[1], -depth / 2,
      b[0], b[1], depth / 2, b[0], b[1], -depth / 2, a[0], a[1], -depth / 2);
    for (let q = 0; q < 6; q++) n.push(nx, ny, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  return g;
}

/** One ribbon per ring, merged by hand — BufferGeometryUtils is a whole extra import. */
export function ribbons(rings, w, h, height, depth, scale = 1) {
  const gs = rings.map(r => ribbon(r, w, h, height, depth, scale));
  if (gs.length === 1) return gs[0];
  const pos = [], nor = [];
  for (const g of gs) { pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); g.dispose(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

/** UVs straight off the geometry's own x/y, so the print lands where it was cut. */
export function planarUV(geo, w, h, height, scale = 1) {
  const uv = [], pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (height * (w / h) * scale) + 0.5, y = 1 - pos.getY(i) / (height * scale);
    uv.push(x, 1 - y);
  }
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return geo;
}

/**
 * One standee. `spirit` is an `arenaFrame` spirit — `{ id, color, imageSrc }`.
 *
 * The returned Group is a drop-in for `spiritMiniature`'s: the caller still owns
 * where it stands and which way it turns. Everything the SHEET does — lean, the
 * knocked-out fall, the idle sway, the acting ring, the tip under a high camera
 * — is this object's `frame()`, so the caller must not also rotate or scale it.
 * ⚠️ ONE EXCEPTION, 2026-09-30: while a STEP runs (`standeeSteps.js`, Alex's
 * dial-in of the hop) the carrier also tilts and squashes the whole group, and
 * passes `lift` here so the shadow and the acting ring stay on the deck.
 */
export function createStandee(spirit, { T = STANDEE, loader = defaultLoader } = {}) {
  const group = new THREE.Group();
  group.name = `Spirit standee: ${spirit.id}`;
  const color = new THREE.Color(spirit.color ?? '#88ccff');
  const o = cutFor(spirit.id, T);
  const lip = T.lip === 'lip';
  const rings = lip ? o.panel : o.art, scale = lip ? T.lipScale : 1;
  const parts = [];
  const keep = m => { parts.push(m); group.add(m); return m; };

  const shadow = keep(new THREE.Mesh(new THREE.CircleGeometry(0.75, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:T.shadow, depthWrite:false })));
  shadow.position.y = -0.01;

  // ── the clear sheet ────────────────────────────────────────────────────────
  // ⚠️ `tint` is a see-through colour, NOT acrylic: over a dark board a 16%
  // white sheet reads as a grey CARD behind the character. `glass` is real
  // transmission — the board bends through it — which is what Alex's
  // "transparent gloss look" actually looks like. It costs one extra pass.
  const glass = T.panelLook === 'glass';
  const edgeColor = (T.edgeColor === 'spirit' ? color.clone() : new THREE.Color(T.edgeFixed)).multiplyScalar(T.edgeGlow);
  const panelGeo = new THREE.ExtrudeGeometry(shapesFrom(rings, o.w, o.h, T.height, scale), { depth:T.thickness, bevelEnabled:false });
  panelGeo.translate(0, 0, -T.thickness / 2);
  const panel = keep(new THREE.Mesh(panelGeo, new THREE.MeshPhysicalMaterial({
    // ⚠️ In glass, `color` MULTIPLIES what you see through the sheet — a tint
    // there paints the print, not the acrylic. The tint belongs in the
    // attenuation (the colour light picks up crossing the material), scaled by
    // how solid the sheet is meant to look.
    color:glass ? 0xffffff : new THREE.Color(T.panelTint),
    transmission:glass ? 1 : 0, ior:1.49, thickness:glass ? T.thickness * 4 : 0,
    transparent:!glass, opacity:glass ? 1 : T.panelOpacity,
    attenuationColor:new THREE.Color(T.panelTint),
    attenuationDistance:glass ? Math.max(0.4, T.thickness * 2 / Math.max(0.02, T.panelOpacity)) : Infinity,
    roughness:Math.max(0.02, (1 - T.gloss) * 0.6), metalness:0,
    clearcoat:T.gloss, clearcoatRoughness:(1 - T.gloss) * 0.4,
    // ⚠️ NEVER depthWrite. The sheet's front face is nearer than the print
    // inside it, so a sheet that writes depth makes the print fail the depth
    // test and the standee comes out an empty pane of glass.
    side:THREE.DoubleSide, depthWrite:false, emissive:edgeColor, emissiveIntensity:T.edgeSpread * 0.25,
  })));
  panel.renderOrder = 8; panel.visible = T.panelLook !== 'off';

  // ── the cut edge, lit like piped neon ──────────────────────────────────────
  const edge = keep(new THREE.Mesh(ribbons(rings, o.w, o.h, T.height, T.thickness, scale),
    new THREE.MeshStandardMaterial({ color:0x0b1020, emissive:edgeColor, emissiveIntensity:1,
      roughness:0.35, metalness:0.2, side:THREE.DoubleSide })));
  edge.renderOrder = 9;

  // ── the print itself ───────────────────────────────────────────────────────
  // ⚠️ TRANSPARENT, and drawn AFTER the sheet (renderOrder 10 > 8). three draws
  // the whole transparent queue after the opaque one, so an "opaque" print is
  // drawn BEFORE the sheet and the sheet then washes over it — which is how a
  // 16% tint turned every character into a grey ghost during the preview. The
  // print is in the SAME queue as the sheet and simply sorted after it.
  // 📌 One texture, DoubleSide: the back is the front seen from behind, through
  // the sheet. Alex, 2026-09-18: "lets do away with 'mirror'".
  const texture = spirit.imageSrc ? loader(spirit.imageSrc) : null;
  const artGeo = planarUV(new THREE.ShapeGeometry(shapesFrom(o.art, o.w, o.h, T.height, 1)), o.w, o.h, T.height, 1);
  const art = keep(new THREE.Mesh(artGeo, new THREE.MeshStandardMaterial({
    map:texture, emissiveMap:texture, emissive:0xffffff, emissiveIntensity:T.artLift,
    transparent:true, alphaTest:ALPHA_TEST, roughness:0.85, metalness:0.02,
    side:THREE.DoubleSide, depthWrite:true,
  })));
  art.renderOrder = 10;

  // ── what it stands in ──────────────────────────────────────────────────────
  // 📌 The stand follows the CUT, not a fixed radius: the Ronin is 1.1 art
  // widths wide and the Monster nearly square, and a disc sized for one looks
  // like a coaster under the other. Capped at .8 — a hex is .8 to its flat.
  const r = Math.min(0.8, Math.max(0.46, halfWidth(rings, o.w, o.h, T.height, scale) * 0.62));
  let baseMesh = null, halo = null;
  if (T.base === 'disc') {
    baseMesh = keep(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, 0.1, 6).rotateY(Math.PI / 6),
      new THREE.MeshStandardMaterial({ color:0x111a2d, metalness:0.65, roughness:0.4,
        emissive:color, emissiveIntensity:0.25 * T.baseGlow })));
    halo = keep(new THREE.Mesh(new THREE.TorusGeometry(r * 1.08, 0.05, 8, 36).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color:color.clone().multiplyScalar(1.6 * T.baseGlow), toneMapped:false })));
  } else if (T.base === 'clip') {
    const w = Math.min(1.5, halfWidth(rings, o.w, o.h, T.height, scale) * 1.15);
    baseMesh = keep(new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.42),
      new THREE.MeshPhysicalMaterial({ color:new THREE.Color(T.panelTint), transparent:true,
        opacity:Math.min(0.5, T.panelOpacity * 2), roughness:0.05, clearcoat:1,
        side:THREE.DoubleSide, emissive:edgeColor, emissiveIntensity:0.3 * T.baseGlow })));
    halo = keep(new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.02, 0.46),
      new THREE.MeshBasicMaterial({ color:edgeColor, toneMapped:false })));
  }
  if (baseMesh) baseMesh.position.y = 0.05;
  if (halo) halo.position.y = 0.1;
  const ring = keep(new THREE.Mesh(new THREE.RingGeometry(r * 1.2, r * 1.5, 6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color:color.clone().multiplyScalar(2), transparent:true,
      opacity:0.8, toneMapped:false, depthWrite:false })));
  ring.position.y = 0.01;
  shadow.scale.setScalar(Math.max(0.6, r / 0.75));
  const shadowBase = shadow.scale.x;

  const api = {
    group, radius:r, height:T.height, parts,
    /**
     * @param time seconds · `knockedOut` / `acting` from the frame · `cameraPos`
     * a THREE.Vector3 (omit it and the sheet simply never tips back).
     */
    frame(time, { knockedOut = false, acting = false, reduced = false, cameraPos = null, lift = 0 } = {}) {
      const sway = reduced || !T.bob ? 0 : Math.sin(time * 1.6 + group.position.x) * T.bob;
      let steep = 0;
      if (cameraPos) {
        const elev = Math.atan2(cameraPos.y - group.position.y,
          Math.hypot(cameraPos.x - group.position.x, cameraPos.z - group.position.z));
        steep = steepPitch(elev, T);
      }
      const lean = THREE.MathUtils.degToRad(T.lean) + steep + sway * 0.4;
      const ko = knockedOut ? THREE.MathUtils.degToRad(T.koTilt) : 0;
      for (const m of [panel, edge, art]) {
        m.rotation.x = -lean - ko;
        m.position.y = 0.02 - T.sink + (knockedOut ? 0.05 + T.sink : 0);
      }
      shadow.material.opacity = T.shadow * (knockedOut ? 0.6 : 1);
      // 📌 IN THE AIR (a hop, a lift): the shadow and the acting ring stay on the
      // deck and the shadow shrinks — without this they rise with the piece and
      // nothing reads as height. `lift` is in the group's own (squashed) units.
      shadow.position.y = -0.01 - lift;
      shadow.scale.setScalar(shadowBase / (1 + lift * 0.6));
      ring.position.y = 0.01 - lift;
      ring.visible = T.actingRing === 'on' && acting && !knockedOut;
      ring.material.opacity = reduced ? 0.7 : 0.55 + 0.25 * Math.sin(time * 2.2);
      if (baseMesh) baseMesh.visible = !knockedOut;
      if (halo) halo.visible = !knockedOut;
    },
    dispose() {
      for (const m of parts) { m.geometry.dispose(); m.material.dispose(); }
      texture?.dispose();
      group.clear();
    },
  };
  group.userData.standee = api;
  return api;
}

// ⚠️ ONE TEXTURE PER STANDEE, NOT A SHARED CACHE. `releaseArenaObject` disposes
// every texture it finds on a released subtree, so a cache would let one Spirit
// leaving the board blank the other three. The browser still fetches the image
// once; only the GPU upload is per standee, and there are at most four.
const textureLoader = new THREE.TextureLoader();
function defaultLoader(url) {
  const t = textureLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

````````

## src/data/spirits.js

Packaged at: project/src/data/spirits.js

````````text
// ─── SPIRIT DEFINITIONS ───────────────────────────────────────────────────────
// STAT TRIO (locked): Drive = attack · Sustain = defense · Vibe = health.
// vibe / maxVibe = current / max health (damage capacity before Knocked Down).
// Style: Shred = high Drive | Flair = high Sustain | Groove = balanced lean-Sustain.
// Speed: 4–6 — max hexes of movement per turn.
import glamarchy from "../standees/Glamarchy.png";
import cosmic_ronin from "../standees/cosmic_ronin.png";
import intergalactic_0 from "../standees/Intergalactic_0.png";
import metalness_monster from "../standees/Metalness_monster.png";

// 🎨 NO SPIRIT HAS A COLOUR OF ITS OWN (Alex, 2026-09-25): "There should be no
// default colors, the only colors that should be associated with any spirits is
// the color of what player is choosing." A Spirit wears its PLAYER'S colour —
// `CORNER_LABELS[corner].color` (P1 blue, P2 orange, then purple, yellow) —
// stamped on by `seatSpirit` / the lobby at match start, and read by the select
// screen from the seat that is choosing. ⚠️ Do not add `color` back here: the
// four defaults happened to equal the four corner colours, so a P2 Ronin still
// wore P1's blue on the picker and every effect named after him.
export const SPIRIT_DEFS = {
  "cosmic_ronin":      { id:"cosmic_ronin",      name:"Shredding Ronin",      imageSrc:cosmic_ronin,      vibe:15, maxVibe:15, knockedOut:false, style:"Shred",  drive:8, sustain:5, speed:5 },
  "intergalactic_0":   { id:"intergalactic_0",   name:"Intergalactic 0",   imageSrc:intergalactic_0,   vibe:12, maxVibe:12, knockedOut:false, style:"Groove", drive:6, sustain:7, speed:4 },
  "Metalness_Monster": { id:"Metalness_Monster", name:"Metalness Monster", imageSrc:metalness_monster, vibe:15, maxVibe:15, knockedOut:false, style:"Shred",  drive:7, sustain:6, speed:4 },
  "Glamarchy":         { id:"Glamarchy",         name:"Glamarchy",         imageSrc:glamarchy,         vibe:12, maxVibe:12, knockedOut:false, style:"Flair",  drive:5, sustain:8, speed:5 },
};

export const SPIRIT_OPTIONS = Object.values(SPIRIT_DEFS);

// Roster order + lock state for the select screen. Spirits not in
// UNLOCKED_DEFAULT render as "?" tiles until unlocked at runtime.
export const ROSTER_ORDER = Object.keys(SPIRIT_DEFS);
export const UNLOCKED_DEFAULT = [...ROSTER_ORDER]; // all 4 launch spirits

// ─── IN DEVELOPMENT ──────────────────────────────────────────────────────────
// Spirits whose kits aren't built out yet. They stay in SPIRIT_DEFS (art,
// stats and the tutorial's roster page all still reference them) but they are
// NOT playable: grayed out in the select screen, never handed to a bot, and
// excluded from Testing Grounds. This is a HARD lock, not the soft "?" that
// UNLOCKED_DEFAULT drives — that one is for unlockables, this one is for
// "we haven't finished writing this character".
// Delete an id from this set the moment its kit lands.
// intergalactic_0 was released 2026-08-08: innates (Rolls Hard,
// +1 Sustain) plus a full four-skill arsenal — Blaster of Ra, Space is
// Displaced, Gravity Control, Sunbeam. Glamarchy is still a stat block with
// no kit at all, so she stays locked.
export const IN_DEVELOPMENT = new Set(["Glamarchy"]);

/** Ids that can actually be taken into a match, in roster order. */
export const PLAYABLE_ORDER = ROSTER_ORDER.filter(id => !IN_DEVELOPMENT.has(id));

/** True when this Spirit is finished enough to play. */
export function isPlayable(id) { return !IN_DEVELOPMENT.has(id); }

// How many corners a match can actually fill — every Spirit is unique per
// match, so the playable roster is a hard ceiling on player count.
export const MAX_PLAYERS = 4;

````````
