import { pitchIndex } from '../music/notes.js';
import { sonicContactTime } from '../board/sonicSequence.js';
import { SONIC_PRESENTATION } from '../board/sonicPresentation.js';

// All Drive tones sound; extra projectiles repeat tones, extra notes share a release.
export function sonicChordVoices(notes=[],count=0) {
  const pitches=notes.map(pitchIndex).filter(p=>p>=0);
  if(!pitches.length||count<1)return [];
  return Array.from({length:Math.max(count,pitches.length)},(_,i)=>({
    pitch:pitches[i%pitches.length],shotIndex:i%count,
    frequency:130.8128*2**(pitches[i%pitches.length]/12),
  }));
}

// Stable Drive pitches from launch; each voice releases at its own contact.
// elapsed/rate support workshop pause/seek without changing chord pitch.
export function playSonicBeamAudio(ctx,destination,{notes=[],dice=[],elapsed=-SONIC_PRESENTATION.charge,rate=1}={}) {
  const voices=sonicChordVoices(notes,dice.length),nodes=new Set(),sources=new Set();
  if(!voices.length)return ()=>{};
  rate=Number.isFinite(rate)&&rate>0?rate:1;
  const now=ctx.currentTime,at=t=>now+Math.max(0,(t-elapsed)/rate);
  const connect=(node,to)=>{nodes.add(node);node.connect(to);return node;};
  const bus=connect(ctx.createGain(),destination);bus.gain.value=1;
  let stopped=false;
  const stop=()=>{
    if(stopped)return;stopped=true;
    bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setValueAtTime(0,ctx.currentTime);
    for(const source of sources){try{source.stop();}catch{/* already ended */}}
    for(const node of nodes)node.disconnect();nodes.clear();sources.clear();
  };
  try {
    for(const voice of voices){
      const contact=sonicContactTime(voice.shotIndex),passed=!!dice[voice.shotIndex].passed;
      const tail=passed?.5:.32,end=contact+tail;
      if(elapsed>=end)continue;
      const start=at(0),hit=at(contact),finish=at(end);
      const gain=connect(ctx.createGain(),bus),filter=connect(ctx.createBiquadFilter(),gain);
      const osc=connect(ctx.createOscillator(),filter);sources.add(osc);
      const level=.13/Math.sqrt(voices.length);
      filter.type='lowpass';filter.frequency.setValueAtTime(2200,start);
      // Incoming timbre is identical; outcomes become audible only at contact.
      filter.frequency.setValueAtTime(2200,hit);
      filter.frequency.exponentialRampToValueAtTime(passed?6200:180,Math.min(finish,hit+.12/rate));
      gain.gain.setValueAtTime(.0001,start);
      const attackEnd=Math.min(finish,start+.035);
      const releaseLevel=level*Math.exp(-9*Math.max(0,elapsed-contact)/tail);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001,releaseLevel),attackEnd);
      if(elapsed<contact)gain.gain.setValueAtTime(level,Math.max(attackEnd,hit));
      gain.gain.exponentialRampToValueAtTime(.0001,Math.max(attackEnd,finish));
      osc.type='triangle';osc.frequency.setValueAtTime(voice.frequency,start);
      osc.onended=()=>{
        sources.delete(osc);
        for(const n of [osc,filter,gain]){n.disconnect();nodes.delete(n);}
        if(!sources.size){bus.disconnect();nodes.delete(bus);}
      };
      osc.start(start);osc.stop(finish+.04);
    }
    if(!sources.size){bus.disconnect();nodes.delete(bus);}
  } catch(error){stop();throw error;}
  return stop;
}
