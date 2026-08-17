import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { legalActions } from '../src/engine/policies/legalActions.js';
const DUEL = [
  { id:'cosmic_ronin', name:'R', corner:'blue', num:12, vibe:5, maxVibe:5, speed:5, facing:0 },
  { id:'intergalactic_0', name:'Z', corner:'purple', num:44, vibe:4, maxVibe:4, speed:4, facing:0 },
];
const ATT = new Set(['swing','sonic','riffOff','tentacle']);
function go(label, over, n=12){
  let turns=0, dec=0, fame=0; const by={};
  const perSeat={};
  for(let i=0;i<n;i++){
    const policies=Object.fromEntries(DUEL.map(s=>[s.id,(st,sid,v,ctx)=>{
      const p=POLICIES.searcher({})(st,sid,v,ctx);
      for(const a of (Array.isArray(p)?p:[p])) if(ATT.has(a?.kind)){by[a.kind]=(by[a.kind]??0)+1; perSeat[sid]=(perSeat[sid]??0)+1;}
      return p;}]));
    const r=runMatch({seed:((i)*2654435761+12345)>>>0, spirits:DUEL, policies, view: over?{weightOverrides:over}:{}});
    turns+=r.turns; if(r.winner) dec++; fame+=Object.values(r.fame??{}).reduce((a,b)=>a+b,0);
  }
  console.log(label.padEnd(24),'turns',String(Math.round(turns/n)).padStart(4),'decided',`${dec}/${n}`,
    'FP/turn',(fame/turns).toFixed(3),'atk',JSON.stringify(by),'byseat',JSON.stringify(perSeat));
}
go('shipped', null);
go('Z pressure 2.5', { intergalactic_0: { pressure: 2.5 } });
go('Z pressure 2.5 drive .5', { intergalactic_0: { pressure: 2.5, drive: 0.5, sustain: 0.5 } });
go('all pressure 3', { pressure: 3.0 });
