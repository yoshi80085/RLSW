import {getLevel,onMixChange} from './mixer.js';
import {sonicChordVoices} from './sonicBeamAudio.js';
import {BARRAGE_LAUNCH as launchAt, BARRAGE_CARRY} from '../board/sonicBarrageTiming.js';
const BARRAGE={carry:BARRAGE_CARRY};
import {barrageTime} from '../board/sonicBarrageTiming.js';
const presentationTime=(plan,t,reduced)=>launchAt+barrageTime(plan,t-launchAt,reduced);
import {arenaDieTiming} from '../board/arenaDiceSequence.js';

export function playBarrageChord(ctx,plan,notes,time,rate=1,{reduced=false,destination=ctx.destination,onset=launchAt,wave='sawtooth',volume=.15}={}){
 const voices=sonicChordVoices(notes,plan.shots.length),nodes=[],sources=[];
 const now=ctx.currentTime,at=t=>now+Math.max(0,(presentationTime(plan,t,reduced)-presentationTime(plan,time,reduced))/rate);
 const connect=(node,to)=>{nodes.push(node);node.connect(to);return node;};
 const master=connect(ctx.createDynamicsCompressor(),destination);
 master.threshold.value=-16;master.ratio.value=5;
 const bus=connect(ctx.createGain(),master);bus.gain.value=.8;
 let stopped=false;
 const stop=()=>{if(stopped)return;stopped=true;bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setValueAtTime(0,ctx.currentTime);for(const s of sources){try{s.stop();}catch{/* already stopped */}}for(const n of nodes)n.disconnect();};
 try{
  for(const v of voices){
   const shot=plan.shots[v.shotIndex],contact=shot.at+(shot.before>0&&shot.through>0?BARRAGE.carry:0),tail=shot.through>0?.45:.24,end=contact+tail;
   if(time>=end)continue;
   const start=at(onset),hit=at(contact),finish=at(end),level=volume/Math.sqrt(voices.length);
   const gain=connect(ctx.createGain(),bus),filter=connect(ctx.createBiquadFilter(),gain),osc=connect(ctx.createOscillator(),filter);sources.push(osc);
   filter.type='lowpass';filter.frequency.setValueAtTime(2300,start);filter.frequency.setValueAtTime(2300,hit);filter.frequency.exponentialRampToValueAtTime(shot.through>0?6000:220,Math.min(finish,hit+.1/rate));
   gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,level*Math.exp(-9*Math.max(0,time-contact)/tail)),Math.min(finish,start+.025));
   if(time<contact)gain.gain.setValueAtTime(level,hit);
   gain.gain.exponentialRampToValueAtTime(.0001,finish);
   osc.type=wave;osc.frequency.setValueAtTime(v.frequency,start);osc.start(start);osc.stop(finish+.03);
  }
 }catch(error){stop();throw error;}
 return stop;
}

export function barrageSoundEvents(plan,{reduced=false,diceOnly=false}={}){
 const events=[];
 for(const [pool,values] of [[0,plan.shots.map(s=>s.strength)],[1,plan.sustainRolls??[]]])values.forEach((value,index)=>{
  const t=arenaDieTiming(value,index,pool);
  if(!reduced)for(const [bounce,offset] of [0,.36,.56].entries())events.push({kind:'clack',at:t.delay+t.flight+offset,frequency:650+pool*180+value*24,level:.09/(bounce+1),duration:.045});
  events.push({kind:'count',at:t.dockedAt,frequency:261.63*2**((([0,2,4,7,9,12,14,16,19,21,24][index%11]+24*Math.floor(index/11))+pool*7)/12),level:.035,duration:.16});
 });
 if(!diceOnly&&plan.breakIndex>=0)events.push({kind:'crack',at:plan.shots[plan.breakIndex].at,frequency:1500,level:.12,duration:.19});
 return events.sort((a,b)=>a.at-b.at);
}

export function playBarrageFoley(ctx,plan,time,rate=1,options={}){
 const nodes=[],sources=[],bus=ctx.createGain();bus.gain.value=getLevel('sfx');bus.connect(options.destination??ctx.destination);nodes.push(bus);let stopped=false;
 const unsubscribe=onMixChange(mix=>{bus.gain.value=mix.sfx;});
 const stop=()=>{if(stopped)return;stopped=true;unsubscribe();bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setValueAtTime(0,ctx.currentTime);for(const s of sources){try{s.stop();}catch{/* already stopped */}}for(const n of nodes)n.disconnect();};
 try{for(const e of barrageSoundEvents(plan,options)){
  if(e.at<time)continue;
  const start=ctx.currentTime+(presentationTime(plan,e.at,options.reduced)-presentationTime(plan,time,options.reduced))/rate,end=start+e.duration;
  const gain=ctx.createGain(),filter=ctx.createBiquadFilter();nodes.push(gain,filter);filter.connect(gain);gain.connect(bus);
  filter.type=e.kind==='count'?'lowpass':'highpass';filter.frequency.setValueAtTime(e.kind==='count'?3200:850,start);
  gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(e.level,start+.003);gain.gain.exponentialRampToValueAtTime(.0001,end);
  let source;
  if(e.kind==='crack'){
   source=ctx.createBufferSource();const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*e.duration),ctx.sampleRate),data=buffer.getChannelData(0);let seed=713;
   for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}source.buffer=buffer;
  }else{source=ctx.createOscillator();source.type=e.kind==='count'?'sine':'square';source.frequency.setValueAtTime(e.frequency,start);if(e.kind==='clack')source.frequency.exponentialRampToValueAtTime(180,end);}
  nodes.push(source);sources.push(source);source.connect(filter);source.start(start);source.stop(end+.02);
 }}catch(error){stop();throw error;}
 return stop;
}

// The defending chord charges from its own Sustain stack and ends at shield break.
export function playSustainChord(ctx,plan,notes,time=0,rate=1,options={}) {
 if(!plan.shieldValue||!notes?.length)return ()=>{};
 const end=plan.shots[plan.breakIndex]?.at??plan.shots.at(-1)?.at??launchAt;
 const shieldPlan={...plan,shots:notes.map((_,index)=>({index,at:end,before:0,through:0}))};
 return playBarrageChord(ctx,shieldPlan,notes,time,rate,{...options,onset:launchAt-2,wave:'triangle',volume:.07});
}
