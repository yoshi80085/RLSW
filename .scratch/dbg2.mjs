import { startSpiritTurn, playTurn, harnessHooks, POLICIES, matchConfig } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/policies/play.js';
import { makeInitialState } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/state.js';
import { makeRng } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/rng.js';
import { evaluate } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/policies/evaluate.js';
import { SKILL_BY_ID } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/data/skillTree.js';
import { legalActions } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/policies/legalActions.js';
import { applyBotAction } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/policies/transition.js';
const spirits=[{id:'cosmic_ronin',name:'R',corner:'blue',num:12,vibe:5,maxVibe:5,speed:5,facing:0},
 {id:'Metalness_Monster',name:'M',corner:'yellow',num:28,vibe:5,maxVibe:5,speed:4,facing:0}];
const rng=makeRng(4242); let st=makeInitialState(matchConfig(spirits),4242);
const ctx={rng,hooks:harnessHooks({rng})}; const pol=POLICIES.searcher({});
let v={posing:{},amps:[],shadowHex:null,rockGodActive:false,skillById:SKILL_BY_ID};
for(let i=0;i<40;i++){
  st=startSpiritTurn(st,rng); const seat=st.acting;
  const opts=legalActions(st,seat,v).filter(a=>a.kind==='skillUnlock');
  if(opts.length){
    const base=evaluate(st,seat,v).score;
    const a=opts[0];
    const r=applyBotAction(st,a,{rng:rng.fork('x'),view:v,hooks:ctx.hooks});
    console.log('turn',i,seat,'db='+(st.noteStates[seat].dbPoints??0),'target='+(st.noteStates[seat].targetSkillId??'-'),'| can buy',opts.length,'| e.g.',a.skillId,'cost',a.dbCost,'| base',base.toFixed(3),'after',evaluate(r.state,seat,v).score.toFixed(3));
    break;
  }
  const t=playTurn(st,v,pol,ctx); st=t.state; v=t.view;
}
