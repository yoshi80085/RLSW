import {getLevel,onMixChange} from './mixer.js';
import {sonicChordVoices} from './sonicBeamAudio.js';
import {BARRAGE_LAUNCH as launchAt, BARRAGE_CARRY} from '../board/sonicBarrageTiming.js';
const BARRAGE={carry:BARRAGE_CARRY};
import {barrageTime} from '../board/sonicBarrageTiming.js';
const presentationTime=(plan,t,reduced)=>launchAt+barrageTime(plan,t-launchAt,reduced);
/** Wall seconds from sequence second `from` to `t`, slow-motion included. */
export const barrageDelay=(plan,t,from,reduced=false)=>Math.max(0,presentationTime(plan,t,reduced)-presentationTime(plan,from,reduced));
import {arenaDieTiming} from '../board/arenaDiceSequence.js';

export function playBarrageChord(ctx,plan,notes,time,rate=1,{reduced=false,destination=ctx.destination,onset=launchAt,wave='sawtooth',volume=.15}={}){
 const voices=sonicChordVoices(notes,plan.shots.length),nodes=[],sources=[];
 const now=ctx.currentTime,at=t=>now+Math.max(0,(presentationTime(plan,t,reduced)-presentationTime(plan,time,reduced))/rate);
 const connect=(node,to)=>{nodes.push(node);node.connect(to);return node;};
 const master=connect(ctx.createDynamicsCompressor(),destination);
 master.threshold.value=-16;master.ratio.value=5;
 const bus=connect(ctx.createGain(),master);bus.gain.value=.8;
 let stopped=false;
 const stop=()=>{if(stopped)return;stopped=true;bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setValueAtTime(0,ctx.currentTime);for(const s of sources){try{s.stop();}catch{/* already stopped */}}for(const n of nodes)n.disconnect?.();};
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

// 📌 `pools` lets the two staged throws be voiced SEPARATELY (2026-09-24):
// the Rival's Sustain clacks start at the Rival's press, the attacker's Drive
// at theirs, and a hold between the presses can no longer drift one against
// the other. `[0, 1]` (both) is the old single-press behaviour, unchanged.
export function barrageSoundEvents(plan,{reduced=false,diceOnly=false,pools=[0,1]}={}){
 const events=[];
 // ⚠️ THE CLACKS FOLLOW THE SCHEDULE, NOT THE POOL INDEX. With the two pools
 // staged, a die's sound and a die's landing are only together if the audio is
 // told when its pool was thrown — otherwise the Rival's dice are heard four
 // seconds before they are seen, which reads as a broken mix, not a timing bug.
 for(const [pool,values] of [[0,plan.shots.map(s=>s.strength)],[1,plan.sustainRolls??[]]])if(pools.includes(pool))values.forEach((value,index)=>{
  const t=arenaDieTiming(value,index,pool,plan.poolStart);
  if(!reduced)for(const [bounce,offset] of [0,.36,.56].entries())events.push({kind:'clack',at:t.delay+t.flight+offset,frequency:650+pool*180+value*24,level:.09/(bounce+1),duration:.045});
  events.push({kind:'count',at:t.dockedAt,frequency:261.63*2**((([0,2,4,7,9,12,14,16,19,21,24][index%11]+24*Math.floor(index/11))+pool*7)/12),level:.035,duration:.16});
 });
 if(!diceOnly&&pools.includes(0)&&plan.breakIndex>=0)events.push({kind:'crack',at:plan.shots[plan.breakIndex].at,frequency:1500,level:.12,duration:.19});
 return events.sort((a,b)=>a.at-b.at);
}

export function playBarrageFoley(ctx,plan,time,rate=1,options={}){
 const nodes=[],sources=[],bus=ctx.createGain();bus.gain.value=getLevel('sfx');bus.connect(options.destination??ctx.destination);nodes.push(bus);let stopped=false;
 const unsubscribe=onMixChange(mix=>{bus.gain.value=mix.sfx;});
 const stop=()=>{if(stopped)return;stopped=true;unsubscribe();bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setValueAtTime(0,ctx.currentTime);for(const s of sources){try{s.stop();}catch{/* already stopped */}}for(const n of nodes)n.disconnect?.();};
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

// ─── 🛡️ THE SHIELD'S OWN CHORD, AND THE CLASH (Alex, 2026-09-24) ────────────
// "Make sure the sounds are actual game chords the players have built out …
//  the shield as well as the Drive firing off. They should *clash* when hit."
//
// ⭐ THE SHIELD CHORD IS THE RIVAL'S SUSTAIN STACK, and it rises WITH the
// shield — at the Rival's press, not two seconds before the launch as
// `playSustainChord` does. It is open-ended because the attacker's press, which
// decides when it breaks, has not happened yet: `release()` is called then.
export function playShieldChord(ctx,notes,{destination=ctx.destination,delay=0,volume=.075,rise=1.2}={}){
 const pitches=sonicChordVoices(notes,notes?.length??0);
 if(!pitches.length)return {release(){},stop(){}};
 const nodes=[],sources=[],now=ctx.currentTime+Math.max(0,delay);
 const bus=ctx.createGain();bus.gain.value=1;bus.connect(destination);nodes.push(bus);
 const voices=pitches.map(v=>{
  const gain=ctx.createGain(),osc=ctx.createOscillator(),lfo=ctx.createOscillator(),depth=ctx.createGain();
  osc.type='triangle';osc.frequency.value=v.frequency;
  lfo.frequency.value=4.6+Math.random()*.8;depth.gain.value=v.frequency*.004;lfo.connect(depth);depth.connect(osc.frequency);
  gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume/Math.sqrt(pitches.length),now+rise);
  osc.connect(gain);gain.connect(bus);osc.start(now);lfo.start(now);
  nodes.push(gain,osc,lfo,depth);sources.push(osc,lfo);return gain;
 });
 let stopped=false;
 const stop=()=>{if(stopped)return;stopped=true;for(const s of sources){try{s.stop();}catch{/* done */}}for(const n of nodes)n.disconnect?.();};
 return {
  /** @param at seconds from NOW · @param broken a shattered shield cuts, a held one fades */
  release(at=0,broken=false){
   const t=ctx.currentTime+Math.max(0,at),fade=broken?.12:.9;
   for(const g of voices){g.gain.cancelScheduledValues(t);g.gain.setTargetAtTime(.0001,t,fade/4);}
   for(const s of sources){try{s.stop(t+fade+.1);}catch{/* done */}}
  },stop};
}

const clashCurve=(()=>{let curve=null;return ()=>{if(curve)return curve;curve=new Float32Array(1024);
 for(let i=0;i<curve.length;i++){const x=i/512-1;curve[i]=Math.tanh(x*6);}return curve;};})();

/**
 * ⚔️ Every shot that lands ON the shield is a stab of BOTH chords at once —
 * the attacker's Drive and the Rival's Sustain, detuned against each other and
 * driven hard — with a metallic burst on top. The shot that breaks it is the
 * big one. Shots that fly through an already-broken shield do not clash.
 * `time` is the sequence second this is called at (the attacker's press),
 * exactly as `playBarrageChord` takes it.
 */
export function playChordClash(ctx,plan,driveNotes,shieldNotes,time,{reduced=false,destination=ctx.destination,volume=.16}={}){
 const pitches=[...sonicChordVoices(driveNotes,driveNotes?.length??0),...sonicChordVoices(shieldNotes,shieldNotes?.length??0)].map(v=>v.frequency);
 const nodes=[],sources=[],now=ctx.currentTime;
 const at=t=>now+Math.max(0,presentationTime(plan,t,reduced)-presentationTime(plan,time,reduced));
 const bus=ctx.createGain();bus.gain.value=1;bus.connect(destination);nodes.push(bus);
 let stopped=false;
 const stop=()=>{if(stopped)return;stopped=true;for(const s of sources){try{s.stop();}catch{/* done */}}for(const n of nodes)n.disconnect?.();};
 try{
  for(const shot of plan.shots??[]){
   if(!(shot.before>0))continue;
   const big=shot.index===plan.breakIndex,start=at(shot.at),len=big?.7:.26;
   if(shot.at+len<time)continue;
   const shaper=ctx.createWaveShaper();shaper.curve=clashCurve();shaper.oversample='2x';
   const out=ctx.createGain();out.gain.setValueAtTime(.0001,start);
   out.gain.exponentialRampToValueAtTime(volume*(big?1.6:1),start+.006);out.gain.exponentialRampToValueAtTime(.0001,start+len);
   shaper.connect(out);out.connect(bus);nodes.push(shaper,out);
   for(const f of pitches.length?pitches:[196,293.7])for(const cents of [-22,19]){
    const o=ctx.createOscillator();o.type='square';o.frequency.value=f*2**(cents/1200);
    const g=ctx.createGain();g.gain.value=.5/Math.sqrt(Math.max(1,pitches.length));
    o.connect(g);g.connect(shaper);o.start(start);o.stop(start+len+.05);nodes.push(o,g);sources.push(o);
   }
   const n=ctx.createBufferSource(),b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*(big?.5:.14)),ctx.sampleRate),d=b.getChannelData(0);
   let seed=97+shot.index;for(let i=0;i<d.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;d[i]=(seed/2147483648-1)*(1-i/d.length);}
   n.buffer=b;const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=big?1800:3200;bp.Q.value=.9;
   const ng=ctx.createGain();ng.gain.value=volume*(big?2.2:1.3);n.connect(bp);bp.connect(ng);ng.connect(bus);
   n.start(start);nodes.push(n,bp,ng);sources.push(n);
  }
 }catch(error){stop();throw error;}
 return stop;
}
