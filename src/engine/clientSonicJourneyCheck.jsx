import { BARRAGE_LAUNCH, barrageLanded } from '../board/sonicBarrageTiming.js';
import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import assert from 'node:assert/strict';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import { HEX_BY_NUM } from '../board/hexMap.js';
import { angleTo, neighborInDirection } from '../board/hexGeometry.js';
import { sonicChordVoices } from '../audio/sonicBeamAudio.js';

// Observe actual audio calls through the mounted game's shared context.
const audioSources=[];
for(const method of ['createGain','createBiquadFilter','createOscillator','createDynamicsCompressor','createBufferSource']){
  const original=AudioContext.prototype[method];
  AudioContext.prototype[method]=function(){
    const n=original.call(this);n.disconnect=()=>{};
    for(const p of [n.gain,n.frequency].filter(Boolean)){
      p.events=[];
      for(const name of ['setValueAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime'])p[name]=(v,t)=>p.events.push([v,t]);
      p.cancelScheduledValues=()=>{};
    }
    if(method==='createOscillator'){n.start=t=>{n.startTime=t;audioSources.push(n);};n.stop=t=>{if(Number.isFinite(t))n.stopTime=t;};}
    return n;
  };
}

const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
dom.window.Element.prototype.animate=()=>({cancel(){},finished:Promise.resolve()});
for(const name of ['document','HTMLElement','Element','Node','MutationObserver'])Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const config=buildTestingGroundsConfig({beginnerMode:false});config.seed=44;
config.spirits=config.spirits.map(s=>({...s,cpu:false}));
const a=HEX_BY_NUM[config.spirits[0].num],b=neighborInDirection(a,0);
assert.ok(b);config.spirits[0]={...config.spirits[0],facing:angleTo(a,b)};
config.spirits[1]={...config.spirits[1],num:b.num,facing:angleTo(a,b)};
let state,rollAt=null;const moves=[];const root=createRoot(document.getElementById('root'));
const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes(text));
const click=async el=>{assert.ok(el,'click target exists');assert.ok(!el.disabled,'click target enabled');await act(async()=>el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
const wait=async ms=>act(async()=>new Promise(resolve=>setTimeout(resolve,ms)));
const until=async(read,message)=>{for(let i=0;i<6000;i++){const found=read();if(found)return found;await wait(10);}assert.fail(message);};
await act(async()=>root.render(<Game gameState={config} onReturnToLobby={()=>{}} onEngineState={(s,action)=>{
  if(rollAt!=null&&action.type==='SPIRITS_SYNCED'){
    const before=state.spirits.find(sp=>sp.id===config.spirits[1].id),after=s.spirits.find(sp=>sp.id===config.spirits[1].id);
    if(before.num!==after.num)moves.push({num:after.num,at:performance.now()-rollAt,phase:document.querySelector('[data-sonic-phase]')?.dataset.sonicPhase});
  }
  state=s;
}}/>));
await click(button('Continue to Melody'));
for(let i=0;i<3;i++){
  const note=[...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')].map(svg=>svg.parentElement).find(el=>el.style.cursor==='pointer');
  await click(note);
}
await click(button('Commit (3 notes'));
assert.ok(!button('🔊 Sonic')?.disabled,JSON.stringify({title:button('🔊 Sonic')?.title,notes:state.noteStates?.[config.spirits[0].id],a:a.num,b:b.num}));
await click(button('🔊 Sonic'));await click(document.querySelector(`[data-hex-num="${b.num}"]`));
const roll=await until(()=>document.querySelector('.sonic-roll-prompt button'),'local attack reaches the ROLL gate');
assert.ok(state.battle?.diceHits,'engine verdict exists before ROLL');
const verdict=JSON.stringify({dice:state.battle.diceVals,hits:state.battle.diceHits});
const frozen=state.battle;
assert.ok(frozen.hitCount>0,JSON.stringify(frozen));
await wait(850);assert.ok(document.querySelector('.sonic-roll-prompt'),'local gate does not auto-roll');
assert.equal(JSON.stringify({dice:state.battle.diceVals,hits:state.battle.diceHits}),verdict,'gate does not reroll');
const sourceOffset=audioSources.length;rollAt=performance.now();
await click(roll);assert.ok(!document.querySelector('.sonic-roll-prompt'),'ROLL is consumed once');
await click(roll); // stale DOM reference cannot schedule a second presentation
await until(()=>!document.querySelector('[data-sonic-phase]'),'volley and consequences complete');
assert.ok(!document.querySelector('.sonic-roll-prompt'),'prompt stays cleared');
assert.equal(button('🔊 Sonic')?.disabled,true,'action stays spent after presentation');
assert.ok(moves.length>0,'live game applies knockback');
const launch=BARRAGE_LAUNCH;
assert.ok(moves[0].at>=(launch+barrageLanded(frozen))*1000-60,'the Rival cannot move before contact');
assert.ok(moves.every(m=>m.phase==='sonic_volley'),'shoves occur during flight, before the result phase');
assert.ok(moves.at(-1).at-moves[0].at<2500,'the shove is one combined movement after the barrage');
const voices=audioSources.slice(sourceOffset).filter(n=>n.type==='sawtooth'&&n.stopTime-n.startTime>2);
assert.deepEqual(voices.map(n=>n.frequency.events[0][0]),sonicChordVoices(frozen.sonicChordNotes,frozen.diceVals.length).map(v=>v.frequency),'mounted game plays the spent Drive chord');
assert.ok(audioSources.slice(sourceOffset).some(n=>n.type==='square'),'dice landing clacks are scheduled');
assert.ok(audioSources.slice(sourceOffset).some(n=>n.type==='triangle'),'the defending Sustain chord is scheduled');
await act(async()=>root.unmount());
console.log('PASS: live Sonic target, frozen chord/verdict, manual ROLL, combined post-barrage shove, full Drive audio, completion and spent action');
process.exit(0);
