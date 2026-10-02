// Cue times match the mortar mesh deployment and retraction, including slow playback.
export function mechanismCues(deploy,end,pan=0){return [
 {at:deploy+.02,type:'unlock',pan},{at:deploy+.38,type:'lift',pan},{at:deploy+1.86,type:'lock',pan},
 {at:end+.02,type:'release',pan},{at:end+.08,type:'retract',pan},{at:end+1.3,type:'seal',pan},
].filter(c=>Number.isFinite(c.at));}
export function soundCues(settings,lab=null){
 const cues=[];
 if(lab){
  if(settings.mortars)cues.push(...mechanismCues(lab.deployedAt,lab.endAt));
  lab.fireAt.forEach((at,i)=>{const pan=Math.sin(i*2.4)*.7;if(settings.mortars)cues.push({at,type:'launch',pan});if(settings.fireworks)cues.push({at:at+1.5,type:'burst',pan});});
  if(settings.cannons)cues.push({at:lab.showAt,type:'flame',pan:0});
  if(settings.curtain)cues.push({at:lab.showAt+.9,type:'curtain',pan:0});
 }else{
  if(settings.mortars)cues.push(...mechanismCues(1,10,-.25),...mechanismCues(11,22,.25));
  for(let i=0;i<13;i++){const at=(i<5?5:14.5)+(i<5?i:i-5)*settings.stagger,pan=Math.sin(i*2.4)*.7;if(settings.mortars)cues.push({at,type:'launch',pan});if(settings.fireworks)cues.push({at:at+1.5,type:'burst',pan});}
  if(settings.cannons)for(const at of [3.7,5,7.3,9.4,12.1,14.5,16.3])cues.push({at,type:'flame',pan:0});
  if(settings.curtain)cues.push({at:15.4,type:'curtain',pan:0});
 }
 return cues.filter(c=>Number.isFinite(c.at)).sort((a,b)=>a.at-b.at);
}
export function crossedCues(from,to,settings,lab=null){return to<from||to-from>.5?[]:soundCues(settings,lab).filter(c=>c.at>from&&c.at<=to);}
export function createPyroAudio(){
 let ctx,bus,bassBus,white,brown,enabled=false,level=.55,bass=1.35;
 const voices=new Set(),outputs=new Set();
 async function enable(){
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)throw Error('Audio is unavailable in this browser.');
  if(!ctx){
   ctx=new AC();bus=ctx.createGain();bus.gain.value=level;bassBus=ctx.createGain();bassBus.gain.value=bass;
   // Mild saturation carries the bass body onto smaller speakers, too.
   const saturate=ctx.createWaveShaper(),curve=new Float32Array(2048);
   for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=Math.tanh(x*1.6)/1.6;}
   saturate.curve=curve;saturate.oversample='2x';bassBus.connect(saturate);saturate.connect(bus);
   const highpass=ctx.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=25;highpass.Q.value=.5;
   const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-14;compressor.knee.value=12;compressor.ratio.value=4;compressor.attack.value=.012;compressor.release.value=.32;
   const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-3;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.001;limiter.release.value=.12;
   bus.connect(highpass);highpass.connect(compressor);compressor.connect(limiter);limiter.connect(ctx.destination);
   white=ctx.createBuffer(1,ctx.sampleRate*5,ctx.sampleRate);brown=ctx.createBuffer(1,ctx.sampleRate*5,ctx.sampleRate);
   const w=white.getChannelData(0),b=brown.getChannelData(0);let last=0;
   for(let i=0;i<w.length;i++){w[i]=Math.random()*2-1;last=(last+w[i]*.035)/1.006;b[i]=last;}
   const rms=Math.sqrt(b.reduce((sum,v)=>sum+v*v,0)/b.length);for(let i=0;i<b.length;i++)b[i]=Math.max(-1,Math.min(1,b[i]*.3/rms));
  }
  await ctx.resume();enabled=ctx.state==='running';return enabled;
 }
 function output(pan){const air=ctx.createStereoPanner(),low=ctx.createStereoPanner();air.pan.value=pan;low.pan.value=pan*.3;air.connect(bus);low.connect(bassBus);const out={air,low,count:0};outputs.add(out);return out;}
 function envelope(node,out,target,t,duration,amplitude,{attack=.006,hold=0}={}){
  const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,amplitude),t+attack);
  if(hold)gain.gain.setValueAtTime(Math.max(.0001,amplitude*.85),t+attack+hold);
  gain.gain.exponentialRampToValueAtTime(.0001,t+duration);node.connect(gain);gain.connect(target);voices.add(node);out.count++;
  node.onended=()=>{voices.delete(node);node.disconnect();gain.disconnect();if(--out.count===0){out.air.disconnect();out.low.disconnect();outputs.delete(out);}};
  node.start(t);node.stop(t+duration+.03);
 }
 function noise(out,t,duration,amplitude,freq=800,{low=false,type='lowpass',q=.6,attack=.008,hold=0}={}){
  const source=ctx.createBufferSource();source.buffer=low?brown:white;source.loop=true;
  const filter=ctx.createBiquadFilter();filter.type=type;filter.frequency.value=freq;filter.Q.value=q;filter.connect(low?out.low:out.air);
  envelope(source,out,filter,t,duration,amplitude,{attack,hold});const done=source.onended;source.onended=()=>{done();filter.disconnect();};
 }
 function tone(out,t,duration,amplitude,from,to=from,{low=true,type='sine',attack=.008,hold=0}={}){
  const osc=ctx.createOscillator();osc.type=type;osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+duration);
  envelope(osc,out,low?out.low:out.air,t,duration,amplitude,{attack,hold});
 }
 function steel(out,t,weight=1){
  // Damped steel resonances replace the old high electronic chirps.
  tone(out,t,.46,.2*weight,76,69);tone(out,t,.3,.105*weight,123,120);
  tone(out,t,.19,.05*weight,193,191,{low:false});tone(out,t,.12,.019*weight,337,334,{low:false});
  noise(out,t,.08,.16*weight,1050);noise(out,t,.38,.32*weight,240,{low:true});
 }
 function motor(out,t,duration,descending=false){
  noise(out,t,duration,.28,280,{low:true,attack:.1,hold:duration*.65});
  noise(out,t,duration,.085,640,{type:'bandpass',q:.65,attack:.12,hold:duration*.63});
  tone(out,t,duration,.065,descending?79:54,descending?48:74,{attack:.1,hold:duration*.66});
  tone(out,t,duration,.024,descending?158:108,descending?96:148,{low:false,attack:.12,hold:duration*.62});
 }
 function play(type,pan=0,rate=1){if(!enabled||ctx?.state!=='running'||level===0)return;
  const t=ctx.currentTime+.008,out=output(pan),speed=Math.max(.25,Math.min(1,rate));
  if(type==='unlock'){steel(out,t,.7);noise(out,t+.045,.35,.06,780,{type:'bandpass'});}
  if(type==='lift')motor(out,t,1.4/speed);
  if(type==='lock'){steel(out,t,1);steel(out,t+.045,.38);}
  if(type==='release'){steel(out,t,.65);noise(out,t+.04,.4,.075,620,{type:'bandpass'});}
  if(type==='retract')motor(out,t,1.1/speed,true);
  if(type==='seal'){steel(out,t,1.25);noise(out,t+.03,.7,.2,150,{low:true});}
  if(type==='zap'){tone(out,t,.2,.15,105,72);noise(out,t,.12,.17,1900,{type:'bandpass',q:1.2});for(let i=0;i<4;i++)noise(out,t+i*.035,.035,.065,3200,{type:'bandpass'});}
  if(type==='step')steel(out,t,.3);
  if(type==='launch'){
   tone(out,t,1.35,.44,59,43);tone(out,t,.65,.17,108,91);
   noise(out,t,1.8,.48,190,{low:true});noise(out,t,.42,.22,730);noise(out,t,.07,.17,1900);steel(out,t+.04,.22);
  }
  if(type==='flame'){
   noise(out,t,1.5,.4,260,{low:true,attack:.045,hold:.3});noise(out,t,1.2,.19,920,{attack:.025,hold:.22});tone(out,t,.65,.09,52,43);noise(out,t,.15,.065,1800);
  }
  if(type==='burst'){
   tone(out,t,1.1,.26,49,36);tone(out,t,.65,.105,101,86);noise(out,t,2.1,.38,180,{low:true});noise(out,t,.25,.18,1300);noise(out,t+.08,1.6,.08,650);
   for(let i=0;i<8;i++)noise(out,t+.2+i*.1,.045,.022,2300,{type:'bandpass'});
  }
  if(type==='curtain'){
   noise(out,t,3.5,.07,2400,{type:'highpass',attack:.08,hold:.6});noise(out,t,3.5,.08,480,{low:true,attack:.1,hold:.6});
   for(let i=0;i<12;i++)noise(out,t+i*.21,.055,.014,2000,{type:'bandpass'});
  }
  if(!out.count){out.air.disconnect();out.low.disconnect();outputs.delete(out);}
 }
 function stop(){for(const v of voices){try{v.stop();}catch{/* Already ended. */}}voices.clear();for(const o of outputs){o.air.disconnect();o.low.disconnect();}outputs.clear();}
 return {enable,play,stop,setVolume(v){level=Math.max(0,Math.min(1,v));if(bus)bus.gain.setTargetAtTime(level,ctx.currentTime,.02);},setBass(v){bass=Math.max(.5,Math.min(2,v));if(bassBus)bassBus.gain.setTargetAtTime(bass,ctx.currentTime,.03);},disable(){enabled=false;stop();},get status(){return !ctx?'off':enabled?ctx.state:'off';},dispose(){stop();ctx?.close();}};
}
