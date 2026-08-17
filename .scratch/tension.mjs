import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { RIG_RADIUS_BY_TIER } from '../src/data/gameConstants.js';
import { hexRingFromCenter } from '../src/board/boardHelpers.js';
import { distFromHome } from '../src/engine/policies/evaluate.js';
console.log('RIG_RADIUS_BY_TIER', JSON.stringify(RIG_RADIUS_BY_TIER));
const ATT=new Set(['swing','sonic','riffOff','tentacle']);
const sp=(ids,hexes,corners)=>ids.map((id,i)=>({...SPIRIT_DEFS[id],id,corner:corners[i],num:hexes[i],
  vibe:SPIRIT_DEFS[id].maxVibe,maxVibe:SPIRIT_DEFS[id].maxVibe,speed:SPIRIT_DEFS[id].speed,facing:0,cpu:true}));
const RM = sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']);
function go(label,over,n=14){
  let turns=0,dec=0,fame=0,inRig=0,dp=0; const by={};
  for(let i=0;i<n;i++){
    const policies=Object.fromEntries(RM.map(s=>[s.id,(st,sid,v,ctx)=>{
      dp++; if(distFromHome(st.spirits.find(x=>x.id===sid), st.noteStates[sid])<=RIG_RADIUS_BY_TIER[0]) inRig++;
      const p=POLICIES.searcher({})(st,sid,v,ctx);
      for(const a of (Array.isArray(p)?p:[p])) if(ATT.has(a?.kind)) by[a.kind]=(by[a.kind]??0)+1;
      return p;}]));
    const r=runMatch({seed:(i*2654435761+12345)>>>0, spirits:RM, policies, view: over?{weightOverrides:over}:{}});
    turns+=r.turns; if(r.winner)dec++; fame+=Object.values(r.fame??{}).reduce((a,b)=>a+b,0);
  }
  console.log(label.padEnd(24),'turns',String(Math.round(turns/n)).padStart(4),'dec',`${dec}/${n}`.padStart(5),
    'FP/t',(fame/turns).toFixed(3),'inRig%',(100*inRig/dp).toFixed(0),'atk',JSON.stringify(by));
}
for (const c of [0.5, 0.7, 0.9, 1.1]) go('centre '+c, { centreStage: c });
