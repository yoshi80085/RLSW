import { legalActions } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/policies/legalActions.js';
import { applyBotAction } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/policies/transition.js';
import { evaluate } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/policies/evaluate.js';
import { makeInitialState } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/state.js';
import { makeRng } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/rng.js';
import { moveBudgetSet } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/actions.js';
import { applyAction } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/reduce.js';
import { HEX_BY_NUM, HEX_BY_QR } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/board/hexMap.js';
import { axialNeighbors, angleTo } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/board/hexGeometry.js';
const A='cosmic_ronin', B='intergalactic_0';
let st=makeInitialState({mode:'ffa',startingLives:2,spirits:[
 {id:A,name:'R',corner:'blue',num:45,vibe:5,maxVibe:5,speed:5,facing:0},
 {id:B,name:'Z',corner:'purple',num:44,vibe:4,maxVibe:4,speed:4,facing:0}]},9);
const here=HEX_BY_NUM[45];
const nb=axialNeighbors(here.q,here.r).map(({q,r})=>HEX_BY_QR[`${q},${r}`]).filter(Boolean)[0];
st={...st,acting:A,spirits:st.spirits.map(s=>s.id===B?{...s,num:nb.num}:(s.id===A?{...s,facing:angleTo(here,nb)}:s))};
st=applyAction(st,moveBudgetSet(5,false));
st={...st,noteStates:{...st.noteStates,[A]:{...st.noteStates[A],hasConfirmed:true}}};
const v={posing:{},amps:[],shadowHex:null,rockGodActive:false};
const acts=legalActions(st,A,v);
console.log('kinds available:', [...new Set(acts.map(a=>a.kind))].join(', '));
const rng=makeRng(1);
const base=evaluate(st,A,v).score;
console.log('base score', base.toFixed(4));
for(const a of acts){
  if(!['swing','sonic','move','endTurn','face'].includes(a.kind)) continue;
  const r=applyBotAction(st,a,{rng:rng.fork('p'),view:v,hooks:{}});
  if(!r.ok) continue;
  const sc=evaluate(r.state,A,v).score;
  const tgt=r.state.spirits.find(s=>s.id===B);
  if(a.kind!=='move'||acts.filter(x=>x.kind==='move').indexOf(a)<1)
    console.log(' ',a.kind.padEnd(8), sc.toFixed(4), (sc-base>=0?'+':'')+(sc-base).toFixed(4), a.kind==='swing'?('rivalVibe '+tgt.vibe):'');
}
const t=evaluate(st,A,v).terms;
console.log('terms touching the RIVAL:', JSON.stringify({adjWounded:t.adjWounded,targetUpside:t.targetUpside,refillDenied:t.refillDenied,rivalPose:t.rivalPose}));
