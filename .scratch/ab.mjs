// A/B: the new terms + retune, against the pre-session weight regime.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
const ATT=new Set(['swing','sonic','riffOff','tentacle']);
const sp=(ids,hexes,corners)=>ids.map((id,i)=>({...SPIRIT_DEFS[id],id,corner:corners[i],num:hexes[i],
  vibe:SPIRIT_DEFS[id].maxVibe,maxVibe:SPIRIT_DEFS[id].maxVibe,speed:SPIRIT_DEFS[id].speed,facing:0,cpu:true}));
const PAIRS=[['R-vs-Z',sp(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple'])],
             ['R-vs-M',sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow'])]];
// The pre-session evaluator: the four board terms did not exist, and the four
// retuned rows sat at their §5-transcribed values.
const OLD={centreStage:0,chargeSeek:0,stock:0,beamSetup:0,drive:1.1,sustain:0.7,pressure:1.2,fame:1.1};
function go(label,list,over,n=9){
  let turns=0,dec=0,fame=0; const by={};
  for(const [,s] of list) for(let i=0;i<n;i++){
    const policies=Object.fromEntries(s.map(x=>[x.id,(st,sid,v,ctx)=>{
      const p=POLICIES.searcher({})(st,sid,v,ctx);
      for(const a of (Array.isArray(p)?p:[p])) if(ATT.has(a?.kind)) by[a.kind]=(by[a.kind]??0)+1;
      return p;}]));
    const r=runMatch({seed:(i*2654435761+12345)>>>0, spirits:s, policies, view: over?{weightOverrides:over}:{}});
    turns+=r.turns; if(r.winner)dec++; fame+=Object.values(r.fame??{}).reduce((a,b)=>a+b,0);
  }
  const N=n*list.length;
  console.log(label.padEnd(30),'turns',String(Math.round(turns/N)).padStart(4),
    'decided',`${dec}/${N}`.padStart(6),'FP/turn',(fame/turns).toFixed(3),'atk',JSON.stringify(by));
}
go('pre-session weights', PAIRS, OLD);
go('shipped (this session)', PAIRS, null);
