import './clientRenderShim.mjs';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import assert from 'node:assert/strict';
import {Game} from '../rlsw-simulator-v3_8_1.jsx';
import {buildTestingGroundsConfig} from '../data/matchSetup.js';
import {HEX_BY_NUM} from '../board/hexMap.js';
import {angleTo,neighborInDirection} from '../board/hexGeometry.js';
import {SONIC_AP_COST} from './policies/legalActions.js';
import {makeInitialState} from './state.js';
import {applyAction} from './reduce.js';
import {noteSheetPatched,riffOffStarted,riffResultsSubmitted,riffResolved,beatsSpent} from './actions.js';

const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
dom.window.Element.prototype.animate=()=>({cancel(){},finished:Promise.resolve()});
for(const k of ['document','HTMLElement','Element','Node','MutationObserver'])Object.defineProperty(globalThis,k,{configurable:true,value:dom.window[k]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
for(const method of ['createOscillator','createGain','createBiquadFilter']){
 const original=AudioContext.prototype[method];AudioContext.prototype[method]=function(){const n=original.call(this);
  n.disconnect=()=>{};for(const p of [n.frequency,n.gain,n.Q].filter(Boolean))for(const f of ['exponentialRampToValueAtTime','linearRampToValueAtTime','cancelScheduledValues'])p[f]??=()=>{};
  return n;};
}
const config=buildTestingGroundsConfig({beginnerMode:false});config.seed=4242;
// 🔊 Two hexes apart, beams crossed — the Sonic reaches 2–3 since 2026-10-03.
const here=HEX_BY_NUM[55],step=neighborInDirection(here,0),there=neighborInDirection(step,angleTo(here,step)),[a,d]=config.spirits.map(s=>s.id);
config.spirits=config.spirits.map((s,i)=>({...s,cpu:false,...(i===0?{num:here.num,facing:angleTo(here,step)}:i===1?{num:there.num,facing:angleTo(step,here)}:{})}));
const log=[noteSheetPatched(a,{driveStack:['C','E','G','B'],sustainStack:['C','E','G','B']}),noteSheetPatched(d,{driveStack:['C','E','G','B'],sustainStack:['C','E','G','B'],lastCommittedMelody:['D','F','A']})];
config.catchUp={log:log.map((action,seq)=>({action,seq}))};
const root=createRoot(document.getElementById('root'));let state;const actions=[];
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text));
async function click(el){assert.ok(el,'click target exists');assert.ok(!el.disabled,el.title);await act(async()=>el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));}
const mount=async c=>act(async()=>root.render(<Game gameState={c} onReturnToLobby={()=>{}} onEngineState={(s,action)=>{state=s;actions.push(action);}}/>));
await mount(config);await click(button('Continue to Melody'));
for(let i=0;i<3;i++)await click([...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')].map(s=>s.parentElement).find(e=>e.style.cursor==='pointer'));
await click(button('Commit (3 notes'));
const budget=state.turn.moveStepsLeft;
await click(button('🔊 Sonic'));await click(document.querySelector(`[data-hex-num="${there.num}"]`));
assert.equal(state.battle.kind,'riffOff');assert.equal(state.battle.arenaVersion,1,'normal Sonic targeting launches the arena duel');
assert.equal(state.turn.moveStepsLeft,budget-SONIC_AP_COST);assert.equal(state.turn.actionTokenUsed,true);
assert.ok(state.noteStates[a].lastCommittedMelody.length===3);assert.deepEqual(state.battle.melodies[1],['D','F','A']);
assert.ok(!document.querySelector('[data-battle-phase="riff_intro"]'),'old overlay is bypassed');
console.log('PASS: real Game commit → crossed Sonic beams → arena duel, both melodies, the Sonic AP cost and Action Token.');
await act(async()=>root.render(null));

// Load a recorded decisive performance through the real catch-up path, then
// let Game's completion timer run the normal aftermath exactly once.
const finalLog=[...log,beatsSpent(2,true),riffOffStarted(a,d,{arenaVersion:1})];
let replay=makeInitialState(config,config.seed);for(const action of finalLog)replay=applyAction(replay,action);
for(const side of [0,1]){
 const results=replay.battle.arenaExchange.runs[side].notes.map(n=>({noteIdx:n.idx,hit:side===0,grade:side===0?'perfect':'miss',rt:side===0?0:null}));
 const action=riffResultsSubmitted(side===0?'attacker':'defender',results,{round:1,clock:0});finalLog.push(action);replay=applyAction(replay,action);
}
finalLog.push(riffResolved());replay=applyAction(replay,riffResolved());const damage=replay.battle.verdict.damage;
actions.length=0;await mount({...config,catchUp:{log:finalLog.map((action,seq)=>({action,seq}))}});
for(let i=0;i<500&&!state.headliner;i++)await act(async()=>new Promise(r=>setTimeout(r,10)));
assert.equal(state.headliner,a);assert.equal(state.battle,null);assert.equal(actions.filter(a=>a.type==='RIFF_CLOSED').length,1);
assert.equal(state.spirits.find(s=>s.id===d).vibe,config.spirits.find(s=>s.id===d).vibe-damage);
for(let i=0;i<300&&state.spirits.find(s=>s.id===d).num===there.num;i++)await act(async()=>new Promise(r=>setTimeout(r,10)));
assert.notEqual(state.spirits.find(s=>s.id===d).num,there.num);assert.ok(state.noteStates[a].fame>0);
assert.equal(state.turn.actionTokenUsed,true,'finishing does not refund the action');
console.log('PASS: recorded verdict → one close → Vibe damage, knockback, Fame, Headliner and spent action.');
await act(async()=>root.unmount());process.exit(0);
