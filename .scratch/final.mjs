import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
const ATT=new Set(['swing','sonic','riffOff','tentacle']);
function seats(ids,hexes,corners){return ids.map((id,i)=>({...SPIRIT_DEFS[id],id,corner:corners[i],num:hexes[i],
  vibe:SPIRIT_DEFS[id].maxVibe,maxVibe:SPIRIT_DEFS[id].maxVibe,speed:SPIRIT_DEFS[id].speed,facing:0,cpu:true}));}
function go(label,sp,n){
  let turns=0,dec=0,fame=0,fameWins=0; const by={};
  for(let i=0;i<n;i++){
    const policies=Object.fromEntries(sp.map(s=>[s.id,(st,sid,v,ctx)=>{
      const p=POLICIES.searcher({})(st,sid,v,ctx);
      for(const a of (Array.isArray(p)?p:[p])) if(ATT.has(a?.kind)) by[a.kind]=(by[a.kind]??0)+1;
      return p;}]));
    const r=runMatch({seed:(i*2654435761+12345)>>>0, spirits:sp, policies});
    turns+=r.turns; if(r.winner)dec++;
    const f=Object.values(r.fame??{}); fame+=f.reduce((a,b)=>a+b,0);
    if(r.winner && (r.fame?.[r.winner]??0)>=16) fameWins++;
  }
  console.log(label.padEnd(26),'turns',String(Math.round(turns/n)).padStart(4),
    'decided',`${dec}/${n}`.padStart(6),'byFame',String(fameWins).padStart(2),
    'FP/turn',(fame/turns).toFixed(3),'atk',JSON.stringify(by));
}
go('duel R-vs-Z (bench pair)', seats(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple']), 20);
go('duel R-vs-M', seats(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']), 20);
