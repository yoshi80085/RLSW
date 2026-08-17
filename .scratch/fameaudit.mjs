import { startSpiritTurn, playTurn, harnessHooks, POLICIES, matchConfig } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/policies/play.js';
import { makeInitialState } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/state.js';
import { makeRng } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/rng.js';
import { SKILL_BY_ID } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/data/skillTree.js';
import { crowdMultiplier } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/board/boardHelpers.js';
const spirits=[{id:'cosmic_ronin',name:'R',corner:'blue',num:12,vibe:5,maxVibe:5,speed:5,facing:0},
 {id:'intergalactic_0',name:'Z',corner:'purple',num:44,vibe:4,maxVibe:4,speed:4,facing:0}];
const rng=makeRng(7); let st=makeInitialState(matchConfig(spirits),7);
const ctx={rng,hooks:harnessHooks({rng})}; const pol=POLICIES.searcher({});
let v={posing:{},amps:[],shadowHex:null,rockGodActive:false,skillById:SKILL_BY_ID};
const kinds={}; let turns=0;
while(!st.winner && turns<120 && st.acting){
  st=startSpiritTurn(st,rng); const t=playTurn(st,v,pol,ctx); st=t.state; v=t.view; turns++;
  for(const a of t.actions) kinds[a.kind]=(kinds[a.kind]??0)+1;
}
console.log('turns',turns,'winner',st.winner);
console.log('action mix:', JSON.stringify(kinds));
for(const s of spirits){ const ns=st.noteStates[s.id];
  console.log(s.id,'fame='+(ns.fame??0),'casuals='+(ns.casuals??0),'diehards='+(ns.diehards??0),
   'crowdMult='+crowdMultiplier(ns.diehards??0,ns.casuals??0,ns.assignedDiehards??0).toFixed(2),
   'perf='+(ns.perfScore??0),'skills='+(ns.unlockedSkills??[]).length); }
console.log('posing view:', JSON.stringify(v.posing));
