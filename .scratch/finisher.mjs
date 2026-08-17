// Does the bot now FINISH a rival it has on the ropes? Rival on 1/4 Vibe,
// adjacent, attacker with a loaded stack.
import { legalActions } from '../src/engine/policies/legalActions.js';
import { applyBotAction } from '../src/engine/policies/transition.js';
import { evaluate } from '../src/engine/policies/evaluate.js';
import { makeInitialState } from '../src/engine/state.js';
import { makeRng } from '../src/engine/rng.js';
import { moveBudgetSet } from '../src/engine/actions.js';
import { applyAction } from '../src/engine/reduce.js';
import { HEX_BY_NUM, HEX_BY_QR } from '../src/board/hexMap.js';
import { axialNeighbors, angleTo } from '../src/board/hexGeometry.js';
const A='cosmic_ronin', B='intergalactic_0';
const NOTES=['Eb','Bb','G','D','Ab','C','F','Bb'];
let st=makeInitialState({mode:'ffa',startingLives:2,spirits:[
 {id:A,name:'R',corner:'blue',num:45,vibe:5,maxVibe:5,speed:5,facing:0},
 {id:B,name:'Z',corner:'purple',num:44,vibe:1,maxVibe:4,speed:4,facing:0}]},9);
const here=HEX_BY_NUM[45];
const nb=axialNeighbors(here.q,here.r).map(({q,r})=>HEX_BY_QR[`${q},${r}`]).filter(Boolean)[0];
st={...st,acting:A,spirits:st.spirits.map(s=>s.id===B?{...s,num:nb.num,vibe:1}:(s.id===A?{...s,facing:angleTo(here,nb)}:s))};
st=applyAction(st,moveBudgetSet(5,false));
st={...st,noteStates:{...st.noteStates,[A]:{...st.noteStates[A],hasConfirmed:true,driveStack:NOTES.slice(0,8)}}};
const v={posing:{},amps:[],shadowHex:null,rockGodActive:false};
const base=evaluate(st,A,v);
console.log('base', base.score.toFixed(4));
console.log('  adjWounded', base.terms.adjWounded.toFixed(3), 'x', base.weights.adjWounded, '=', (base.terms.adjWounded*base.weights.adjWounded).toFixed(3));
console.log('  pressure  ', base.terms.pressure.toFixed(3), 'x', base.weights.pressure, '=', (base.terms.pressure*base.weights.pressure).toFixed(3));
console.log('');
const swing=legalActions(st,A,v).find(a=>a.kind==='swing');
// find a seed where the blow actually takes the life
for(let s=1;s<=200;s++){
  const r=applyBotAction(st,swing,{rng:makeRng(s).fork('search'),view:v,hooks:{}});
  if(!r.ok) continue;
  const t=r.state.spirits.find(x=>x.id===B);
  if((t.lives??2)>=2 && !t.knockedOut) continue;
  const after=evaluate(r.state,A,v);
  console.log(`seed ${s}: TOOK A LIFE — rival lives ${t.lives}, vibe ${t.vibe}, knockedOut ${!!t.knockedOut}`);
  console.log(`  score ${base.score.toFixed(4)} -> ${after.score.toFixed(4)}  (${(after.score-base.score>=0?'+':'')}${(after.score-base.score).toFixed(4)})`);
  for(const k of Object.keys(after.terms)){
    const dt=(after.terms[k]??0)-(base.terms[k]??0);
    if(Math.abs(dt)>1e-9) console.log(`     ${k.padEnd(13)} ${dt>=0?'+':''}${dt.toFixed(3)} x ${after.weights[k]} = ${(dt*after.weights[k]>=0?'+':'')}${(dt*after.weights[k]).toFixed(3)}`);
  }
  break;
}
