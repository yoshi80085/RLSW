import './clientRenderShim.mjs';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import assert from 'node:assert/strict';
import {Game} from '../rlsw-simulator-v3_8_1.jsx';
import {buildTestingGroundsConfig} from '../data/matchSetup.js';
import {HEX_BY_NUM} from '../board/hexMap.js';
import {angleTo,neighborInDirection} from '../board/hexGeometry.js';
import {SWING_GATE,SWING_TIMING} from '../board/swingTiming.js';
// ⭐ 2026-09-24: the Swing is TWO presses — the attacker's, then the Rival's at
// the gate — each a local human's ROLL button that fires itself after 5 s.
// Both Spirits here are human (cpu:false), so both prompts must appear.
// Observe the battle's real audio through the mounted game's shared context.
const started=[];
for(const method of ['createGain','createBiquadFilter','createOscillator','createDynamicsCompressor','createBufferSource','createWaveShaper']){
  const original=AudioContext.prototype[method];if(!original)continue;
  AudioContext.prototype[method]=function(){
    const n=original.call(this);n.disconnect=()=>{};n.kind=method;
    for(const p of [n.gain,n.frequency].filter(Boolean)){for(const name of ['setValueAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime','setTargetAtTime'])p[name]=()=>{};p.cancelScheduledValues=()=>{};}
    if(n.start){n.start=()=>started.push(n);n.stop=()=>{};}
    if(method==='createWaveShaper')started.push(n);
    return n;
  };
}
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
dom.window.Element.prototype.animate=()=>({cancel(){},finished:Promise.resolve()});
for(const name of ['document','HTMLElement','Element','Node','MutationObserver'])Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const config=buildTestingGroundsConfig({beginnerMode:false});config.seed=44;
config.spirits=config.spirits.map(s=>({...s,cpu:false,vibe:100,maxVibe:100}));
const a=HEX_BY_NUM[config.spirits[0].num],b=neighborInDirection(a,0);
config.spirits[0].facing=angleTo(a,b);config.spirits[1].num=b.num;
let state,rivalAt=null,damageAt=null;
const root=createRoot(document.getElementById('root'));
const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes(text));
const click=async el=>{assert.ok(el,'click target');assert.ok(!el.disabled,'enabled');await act(async()=>el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
const wait=async ms=>act(async()=>new Promise(r=>setTimeout(r,ms)));
const until=async(read,message,ms=12000)=>{for(let i=0;i<ms/10;i++){const found=read();if(found)return found;await wait(10);}assert.fail(message);};
const phase=()=>document.querySelector('[data-swing-phase]')?.dataset.swingPhase;
await act(async()=>root.render(<Game gameState={config} onReturnToLobby={()=>{}} onEngineState={(s,action)=>{
  // Damage is read off the Vibe itself — whichever action carries it.
  if(rivalAt&&damageAt==null&&state&&s.spirits.some((sp,i)=>sp.vibe<(state.spirits[i]?.vibe??sp.vibe)))damageAt=performance.now()-rivalAt;
  state=s;
}}/>));
await click(button('Continue to Melody'));
for(let i=0;i<3;i++)await click([...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')].map(e=>e.parentElement).find(e=>e.style.cursor==='pointer'));
await click(button('Commit (3 notes'));
await click(button('Swing'));await click(document.querySelector(`[data-hex-num="${b.num}"]`));
assert.ok(state.battle?.swingClash,'live client uses engine clash verdict');
assert.equal(phase(),'swing_attacker','the Swing opens waiting on the attacker');
assert.equal(document.querySelector('[data-board-view]')?.dataset.boardView,'3d');
const before=state.spirits.map(s=>s.vibe),verdict=state.battle;
// 1 · the attacker's ROLL — a human's button, and it does NOT fire early.
const first=await until(()=>document.querySelector('.sonic-roll-prompt button'),'the attacker is asked to roll');
assert.match(document.querySelector('.sonic-roll-prompt').textContent,/auto-roll in [1-5]s/,'the countdown is shown');
await wait(850);assert.ok(document.querySelector('.sonic-roll-prompt button'),'a human is given time before the auto-roll');
await click(first);assert.ok(!document.querySelector('.sonic-roll-prompt'),'ROLL is consumed once');
// 2 · the clock HOLDS at the gate for the Rival's own ROLL.
await wait(SWING_GATE*1000+300);
assert.equal(phase(),'swing_rival','the table waits on the Rival at the gate');
assert.deepEqual(state.spirits.map(s=>s.vibe),before,'no early damage');
const second=await until(()=>document.querySelector('.sonic-roll-prompt button'),'the Rival is asked to roll');
const heardBefore=started.length;
await click(second);rivalAt=performance.now();
await until(()=>!document.querySelector('[data-swing-phase]'),'the clash closes',(SWING_TIMING.close-SWING_GATE)*1000+4000);
// ⭐ Alex: "a Swing attack should sound more like a *strike* than a chord" —
// the clash is driven power chords (sawtooth through a waveshaper), not a chord.
const struck=started.slice(heardBefore);
assert.ok(struck.some(n=>n.kind==='createWaveShaper'),'the strike is driven hard (waveshaper distortion)');
assert.ok(struck.filter(n=>n.type==='sawtooth').length>=12,'both Spirits\' power chords sound on the clash');
if(verdict.margin){
  await until(()=>damageAt!=null,'the loser takes the damage after the overlay closes',6000);
  assert.ok(damageAt>=(SWING_TIMING.result-SWING_GATE)*1000-60,'damage follows the climax, timed from the Rival\'s throw: '+damageAt);
  const loser=verdict.attackerWon?verdict.defenderId:verdict.attackerId;
  assert.equal(state.spirits.find(s=>s.id===loser).vibe,100-verdict.margin);
}
await act(async()=>root.unmount());
console.log('Mounted Swing journey: two human presses with a held gate, countdown, frozen verdict, climax timing, exact damage and cleanup passed.');
process.exit(0);
