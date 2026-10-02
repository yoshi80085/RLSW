// Shared, serializable arena score. No browser clocks or unseeded randomness.
import {melodyToRiff} from './melodyRiff.js';
import {generateAttackerRiff,generateDefenderRiff,riffDegreesToNotes} from './riffGeneration.js';
import {voiceRiff,degreePitch} from './guitarMap.js';
import {gradeRiffOffset} from './fallingNotes.js';

export const RIFF_ARENA=Object.freeze({bpm:138,length:4,lead:1600,handoff:100,acceleration:8,
  gapDecay:2.5,gapFloor:4,orb:1,spin:1,growth:.17,flow:6,glitter:.5});
export const arenaGap=round=>Math.max(RIFF_ARENA.gapFloor,20-(round-1)*RIFF_ARENA.gapDecay);
export const arenaHandoff=round=>RIFF_ARENA.handoff*.88**(round-1);

export function arenaSeatControl(battle,spirits,net){
  const ids=[battle.attackerId,battle.defenderId];
  const bot=id=>!!(spirits.find(s=>s.id===id)?.cpu||net?.seats?.some(s=>s.spiritId===id&&s.isBot));
  return {bots:ids.map(bot),own:ids.map(id=>!net||(!net.spectator&&(bot(id)?!!net.isHost:net.mySpiritId===id))),
    conductor:!net||(!net.spectator&&(bot(ids[0])?!!net.isHost:net.mySpiritId===ids[0]))};
}

export function makeArenaExchange({round=1,firstHit=1900,melodies=[[],[]],rng,decorate=r=>r}){
  const caller=(round-1)%2,bpm=Math.min(240,RIFF_ARENA.bpm+(round-1)*RIFF_ARENA.acceleration),beat=60000/bpm;
  const melody=melodies[caller]??[];
  const source=melody.length===3?[...melody,melody[2]]:melody;
  const committed=melody.length>=3?melodyToRiff(source,{rand:rng,targetLen:Math.min(4,melody.length)}):null;
  const call=committed??generateAttackerRiff(rng,4);
  const answer=generateDefenderRiff(call,rng);
  const charts=[];charts[caller]={...call,...decorate(call,rng),fromMelody:!!committed};
  charts[1-caller]={...answer,...decorate(answer,rng)};
  const preset={perfect:beat*.18,good:beat*.30,ok:beat*.43,leadTime:RIFF_ARENA.lead};
  function run(side,start){
    const chart=charts[side],positions=voiceRiff(chart.degrees,chart.sharps,chart.rhythm).positions,keys=riffDegreesToNotes(chart.degrees,chart.sharps);
    let root=-1;
    const notes=chart.degrees.map((degree,i)=>{
      const perf=chart.perf?.[i]??{},partner=chart.chordOf?.[i];if(partner==null)root++;
      return {...perf,idx:i,key:keys[i],pitch:degreePitch(degree,chart.sharps[i]),
        pos:perf.string!=null?[perf.string,perf.fret]:positions[i],
        hitAt:start+root*beat,feel:'steady',okWin:preset.ok,
        sustain:Math.min(perf.sustain??0,beat*.7),bendAt:Math.min(perf.bendAt??0,beat*.4),
        partnerOf:partner??null};
    });
    return {side,round,kind:side===caller?'call':answer.kind,leadTime:RIFF_ARENA.lead,preset,notes,
      firstHit:start,lastHit:notes.at(-1).hitAt,end:Math.max(...notes.map(n=>n.hitAt+Math.max(n.okWin,n.sustain)))};
  }
  const runs=[];runs[caller]=run(caller,firstHit);
  runs[1-caller]=run(1-caller,runs[caller].end+preset.ok+arenaHandoff(round));
  return {round,caller,bpm,beat,gapLimit:arenaGap(round),charts,runs,end:runs[1-caller].end};
}

export function prepareArenaExchange(previous,options){
  const round=previous.round+1,beat=60000/Math.min(240,RIFF_ARENA.bpm+(round-1)*RIFF_ARENA.acceleration);
  return makeArenaExchange({...options,round,firstHit:previous.end+beat*.43+arenaHandoff(round)});
}

export function shiftArenaExchange(exchange,delta){
  return {...exchange,end:exchange.end+delta,runs:exchange.runs.map(r=>({...r,firstHit:r.firstHit+delta,lastHit:r.lastHit+delta,end:r.end+delta,notes:r.notes.map(n=>({...n,hitAt:n.hitAt+delta}))}))};
}

export function arenaInputRole(exchange,time){return exchange.runs.findIndex(r=>time>=r.firstHit-r.preset.ok&&time<=r.end);}

export function judgeArenaNote(run,results,string,time){
  const live=run.notes.filter(n=>!results.some(r=>r.noteIdx===n.idx)&&Math.abs(time-n.hitAt)<=n.okWin);
  const matches=live.filter(n=>n.pos[0]+1===string);
  const n=matches.sort((a,b)=>a.hitAt-b.hitAt)[0]??live.sort((a,b)=>Math.abs(time-a.hitAt)-Math.abs(time-b.hitAt))[0];
  if(!n)return null;
  const hit=n.pos[0]+1===string,offset=time-n.hitAt;
  return {noteIdx:n.idx,hit,grade:hit?gradeRiffOffset(offset,run.preset,n.feel):'wrong',rt:hit?Math.abs(Math.round(offset)):null};
}

// Declared tempo-aware bot model: seeded physical timing error, graded by the
// same windows as human inputs. Unlike the old count-only model, speed matters.
export function arenaBotOffsets(run,perfScore,rng){
  const skill=Math.max(0,Math.min(1,(perfScore??0)/10));
  return run.notes.map(()=>rng()<.05?null:Math.round((rng()-.5)*(310-170*skill)));
}
export function arenaBotResults(run,offsets){
  return run.notes.map((n,i)=>{const offset=offsets[i],hit=Number.isFinite(offset)&&Math.abs(offset)<=n.okWin;
    return {noteIdx:n.idx,hit,grade:hit?gradeRiffOffset(offset,run.preset,n.feel):'miss',rt:hit?Math.abs(offset):null};});
}
