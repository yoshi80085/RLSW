import { startSpiritTurn, playTurn, harnessHooks, POLICIES, matchConfig } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/policies/play.js';
import { makeInitialState } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/state.js';
import { makeRng } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/rng.js';
import { SKILL_BY_ID } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/data/skillTree.js';
const spirits=[{id:'cosmic_ronin',name:'R',corner:'blue',num:12,vibe:5,maxVibe:5,speed:5,facing:0},
 {id:'Metalness_Monster',name:'M',corner:'yellow',num:28,vibe:5,maxVibe:5,speed:4,facing:0}];
const rng=makeRng(4242); let st=makeInitialState(matchConfig(spirits),4242);
const ctx={rng,hooks:harnessHooks({rng})}; const pol=POLICIES.searcher({});
let v={posing:{},amps:[],shadowHex:null,rockGodActive:false,skillById:SKILL_BY_ID};
for(let i=0;i<24;i++){
  st=startSpiritTurn(st,rng); const seat=st.acting;
  const t=playTurn(st,v,pol,ctx); st=t.state; v=t.view;
  const ns=st.noteStates[seat];
  if(i%2===0) console.log('t'+i, seat.slice(0,6), 'db='+(ns.dbPoints??0), 'target='+(ns.targetSkillId??'-'), 'unlocked='+(ns.unlockedSkills??[]).join('/'), 'fame='+(ns.fame??0));
}
