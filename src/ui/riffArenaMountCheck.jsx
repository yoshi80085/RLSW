import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {RiffArenaBattle} from './RiffArenaBattle.jsx';
import {makeRng} from '../engine/rng.js';
import {applyRiffOffStarted,applyRiffResultsSubmitted,applyRiffResolved,applyRiffRound2Started} from '../engine/systems/riffOff.js';

const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
for(const k of ['window','document','HTMLElement','Node','KeyboardEvent'])Object.defineProperty(globalThis,k,{configurable:true,value:dom.window[k]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let clock=0,serial=0,frames=new Map();
const dateNow=Date.now;Date.now=()=>100000+clock;
globalThis.requestAnimationFrame=cb=>{frames.set(++serial,cb);return serial;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
const root=createRoot(document.getElementById('root')),rng=makeRng(8),spirits=[{id:'a',name:'Caller',color:'#33ccff'},{id:'b',name:'Rival',color:'#ff9955'}];
const initial=()=>applyRiffOffStarted({spirits,noteStates:{a:{lastCommittedMelody:['A','C','E']},b:{lastCommittedMelody:['D','F','A','C']}}},{attackerId:'a',defenderId:'b',arenaVersion:1},rng);
let state=initial(),net=null,submitted=[],notes=[],progress=null,cueHandler=null,sent=[];
const projectionRef={current:[{x:220,y:300,footY:480,width:1000,height:600},{x:780,y:300,footY:480,width:1000,height:600}]};
function render(){root.render(<RiffArenaBattle battle={state.battle} spirits={spirits} net={net} projectionRef={projectionRef}
 onStart={()=>{state=applyRiffRound2Started(state,{round:state.battle.round,clockOnly:true,at:Date.now()},rng);render();}}
 onSubmit={(side,results)=>{submitted.push([state.battle.round,side,results]);state=applyRiffResultsSubmitted(state,{round:state.battle.round,clock:state.battle.arenaClock,role:side===0?'attacker':'defender',results});render();}}
 onNote={(side,note,result)=>notes.push({side,note,result})} onProgress={p=>{progress=p;}}/>);}
async function frame(time){clock=time;await act(async()=>{const batch=[...frames.values()];frames.clear();batch.forEach(cb=>cb(clock));});}
async function key(string){await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:`Digit${string}`,key:String(string),bubbles:true})));}
async function click(label){const b=[...document.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(b,label);await act(async()=>b.click());}
let checks=0;
await act(async()=>render());await frame(0);
assert.equal(document.querySelectorAll('section[aria-label$="guitar track"]').length,2);
assert.ok(document.querySelector('button'));checks++;
await click('Start Riff Off');
for(let round=1;round<=4;round++){
 const ex=state.battle.arenaExchange,epoch=state.battle.arenaStartedAt-100000;
 assert.equal(ex.caller,(round-1)%2);
 for(const side of [ex.caller,1-ex.caller]){
  for(const n of ex.runs[side].notes){await frame(epoch+n.hitAt);if(round<4||side===0)await key(n.pos[0]+1);}
  await frame(epoch+ex.runs[side].end+1);
 }
 assert.equal(submitted.filter(s=>s[0]===round).length,2,'exactly one submission per performer');
 state=applyRiffResolved(state);
 assert.equal(state.battle.verdict.close,round<4);
 if(round<4)state=applyRiffRound2Started(state,{round,at:Date.now()},rng);
 await act(async()=>render());
 checks++;
}
assert.ok(notes.some(n=>n.result.grade==='perfect'));assert.ok(progress.energy.every(n=>n>0));
assert.match(document.body.textContent,/Caller breaks through/);checks++;
await act(async()=>root.render(null));

// A late spectator must watch immediately; a returning performer must ask to
// resume, and only the initiating seat can restart the shared clock.
state=initial();state=applyRiffRound2Started(state,{round:1,clockOnly:true,at:100000},rng);clock=12000;
net={spectator:true,seats:[],client:{on:(_kind,fn)=>{cueHandler=fn;return()=>{};},sendCue:(...args)=>sent.push(args)}};
await act(async()=>render());await frame(clock+50);
assert.ok(!document.querySelector('.riff-arena-start'));const before=submitted.length;await key(1);assert.equal(submitted.length,before);checks++;
await act(async()=>root.render(null));
net={...net,spectator:false,mySpiritId:'b',seats:[{seatId:'a-seat',spiritId:'a'},{seatId:'b-seat',spiritId:'b'}]};
await act(async()=>render());await click('Resume my performance');assert.deepEqual(sent.at(-1),['riff-resume','1,1']);checks++;
state=applyRiffRound2Started(state,{round:1,clockOnly:true,at:Date.now()},rng);await act(async()=>render());
assert.ok(!document.querySelector('.riff-arena-start'));checks++;
const count=notes.length;await act(async()=>cueHandler({kind:'riff-note',seatId:'b-seat',id:'1,2,0,0,perfect,0'}));assert.equal(notes.length,count,'other seat cannot impersonate caller');checks++;
await act(async()=>root.unmount());Date.now=dateNow;dom.window.close();
console.log(`${checks} mounted Riff arena checks passed: two highways, real keyboard input, four exchanges, winner, spectator, reconnect and cue ownership.`);
