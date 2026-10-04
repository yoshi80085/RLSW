// Preview scheduler: one shared clock, two visible charts, one input owner.
// Match payouts remain in the existing engine; this study never mutates a save.
import { melodyToRiff } from '../../src/riff/melodyRiff.js';
import { generateAttackerRiff, generateDefenderRiff, riffDegreesToNotes } from '../../src/riff/riffGeneration.js';
import { voiceRiff, degreePitch } from '../../src/riff/guitarMap.js';
import { gradeRiffOffset, RIFF_FALL_DIFFICULTY } from '../../src/riff/fallingNotes.js';
import { riffStats, applyRiffResolved, RIFF_CLOSE_QUALITY_GAP } from '../../src/engine/systems/riffOff.js';

export const DEFAULTS = Object.freeze({ bpm:138, length:4, lead:1600, handoff:100,
  acceleration:8, gapDecay:2.5, gapFloor:4, rounds:'continuous', orb:1, spin:1, growth:.17, flow:6,
  glitter:.8, laneWidth:270, boardGlow:0.18, volume:0.3,
  mode:'demo', scenario:'escalate', attacker:'cosmic_ronin', defender:'Metalness_Monster',
  melodyA:'A C E G', melodyB:'D F A C' });

export function seeded(seed=9437) {
  return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
}

// The allowable performance difference narrows independently of the note
// judge. Equal performances still continue; a time limit never invents a loser.
export function continuationGap(round,config=DEFAULTS) {
  if(config.rounds==='two')return RIFF_CLOSE_QUALITY_GAP;
  return Math.max(config.gapFloor??DEFAULTS.gapFloor,
    RIFF_CLOSE_QUALITY_GAP-(round-1)*(config.gapDecay??DEFAULTS.gapDecay));
}
export function exchangeHandoff(round,config=DEFAULTS) {
  return Math.max(0,config.handoff)*Math.pow(.88,round-1);
}

export function parseMelody(text) {
  const notes=text.trim().split(/[\s,]+/).filter(Boolean);
  const pitches=new Set(['A','A#','Bb','B','C','C#','Db','D','D#','Eb','E','F','F#','Gb','G','G#','Ab']);
  if (notes.some(n=>!pitches.has(n))) throw new Error('Use notes such as A C E G or D F# A, separated by spaces.');
  return notes;
}

function callFrom(melody,length,rand) {
  if (!melody || melody.length<3) return {...generateAttackerRiff(rand,length),fromMelody:false};
  // The live helper requires four source notes. A three-note preview phrase is
  // adapted with a repeated tail, then trimmed back to three: no added played note.
  const source=melody.length===3 ? [...melody,melody[2]] : melody;
  return melodyToRiff(source,{rand,targetLen:Math.min(length,melody.length)});
}

export function makeExchange({round=1, firstHit=1600, config=DEFAULTS, melodies,
  rand=seeded(), startedAt=0}) {
  const caller=(round-1)%2, responder=1-caller;
  const bpm=Math.min(240,config.bpm+(round-1)*config.acceleration);
  const beat=60000/bpm;
  const length=Math.max(3,Math.min(5,Math.round(config.length)));
  const call=callFrom(melodies[caller],length,rand);
  const answer=generateDefenderRiff(call,rand);
  // Uniform eighth/quarter-length gestures make a short call legible; answers
  // keep that rhythm. Grade windows shrink with tempo for humans AND demo bots.
  const preset={...RIFF_FALL_DIFFICULTY.gigging,
    perfect:Math.min(120,beat*.18),good:Math.min(250,beat*.30),ok:Math.min(420,beat*.43)};
  const build=(riff,side,first,kind)=>{
    const rhythm=riff.degrees.map(()=>({feel:'steady',gapBefore:beat}));
    const pos=voiceRiff(riff.degrees,riff.sharps,rhythm).positions;
    const keys=riffDegreesToNotes(riff.degrees,riff.sharps);
    const notes=riff.degrees.map((d,i)=>({idx:i,key:keys[i],pos:pos[i],
      pitch:degreePitch(d,riff.sharps[i]),hitAt:first+i*beat,feel:'steady',okWin:preset.ok,
      dir:i===0?'same':d>riff.degrees[i-1]?'up':d<riff.degrees[i-1]?'down':'same'}));
    return {round,side,kind,fromMelody:!!riff.fromMelody,startedAt,leadTime:config.lead,
      notes,results:[],firstHit:first,lastHit:notes.at(-1).hitAt,preset};
  };
  const a=build(call,caller,firstHit,'call');
  // First answer window starts after the caller's final late window. Its gems
  // are already falling during the call; no second countdown or ready card.
  const b=build(answer,responder,a.lastHit+2*preset.ok+exchangeHandoff(round,config),answer.kind);
  const runs=[]; runs[caller]=a; runs[responder]=b;
  return {round,caller,responder,bpm,beat,runs,gapLimit:continuationGap(round,config),end:b.lastHit+preset.ok};
}

export function nextExchange(previous,options) {
  const next=makeExchange({...options,round:previous.round+1,firstHit:0});
  // Use the NEXT judge's early window, so accelerating into the new call
  // neither overlaps ownership nor adds an accidental old-window pause.
  const offset=previous.end+next.runs[next.caller].preset.ok+exchangeHandoff(next.round,options.config);
  for(const run of next.runs){run.firstHit+=offset;run.lastHit+=offset;run.notes.forEach(n=>{n.hitAt+=offset;});}
  next.end+=offset;return next;
}

export function activeRun(exchange,time) {
  return exchange.runs.find(r=>time>=r.firstHit-r.preset.ok && time<=r.lastHit+r.preset.ok) ?? null;
}

export function judge(run,string,time) {
  const pending=run.notes.filter(n=>!run.results.some(r=>r.noteIdx===n.idx)
    && Math.abs(time-n.hitAt)<=run.preset.ok);
  const n=pending.sort((a,b)=>Math.abs(time-a.hitAt)-Math.abs(time-b.hitAt))[0];
  if (!n) return null;
  const offset=time-n.hitAt,correct=n.pos[0]+1===string;
  const grade=correct?gradeRiffOffset(offset,run.preset,n.feel):'wrong';
  const result={noteIdx:n.idx,hit:correct,grade,rt:Math.abs(offset)};
  run.results.push(result);
  return {run,note:n,result,time};
}

export function expire(run,time) {
  const events=[];
  for(const n of run.notes) if(time>n.hitAt+run.preset.ok && !run.results.some(r=>r.noteIdx===n.idx)) {
    const result={noteIdx:n.idx,hit:false,grade:'miss',rt:0};
    run.results.push(result); events.push({run,note:n,result,time});
  }
  return events;
}

export function resolveExchange(exchange,config,r1=null) {
  const results=exchange.runs.map(r=>r.results);
  if(results.some((r,i)=>r.length!==exchange.runs[i].notes.length)) return null;
  const scores=results.map(riffStats);
  const gapLimit=continuationGap(exchange.round,config);
  const clear=Math.abs(scores[0].quality-scores[1].quality)>=gapLimit;
  const stopped=config.rounds==='two' ? (clear || exchange.round>=2) : clear;
  // Existing verdict owns damage, ties, and reaction-time tie breaks. Later
  // exchanges use its round-two band, not ever-growing damage multipliers.
  const b=applyRiffResolved({battle:{kind:'riffOff',round:Math.min(2,exchange.round),
    atkResults:results[0],defResults:results[1],r1}}).battle;
  return {stopped,scores,gapLimit,verdict:b.verdict,r1:b.r1};
}

// A declared demonstration model, not a change to the game's bot balance.
// Bots submit timed presses to the same judge as the human. Fixed ms jitter
// becomes harder as the tempo rises, unlike the live count-only riffSkill model.
export function demoOffset(run,index,scenario) {
  if(scenario==='locked') return 35;
  // Same physical jitter at every tempo: the narrowing windows eventually
  // expose a small difference after several exchanges, not a scripted winner.
  if(scenario==='escalate')return run.side===0?34+index*3:48+index*6;
  if(scenario==='break') return run.side===0 ? 24 : (index%2 ? 520 : 90);
  if(run.round===1) return 34+(index%2)*8;
  return run.side===0 ? 45+(index%2)*12 : 110+(index%3)*90;
}
