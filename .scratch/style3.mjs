import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { detectSpiritStyle } from '../src/music/spiritStyle.js';
const ids = ['cosmic_ronin','Metalness_Monster','intergalactic_0'];
const spirits = ids.map((id,i)=>({...SPIRIT_DEFS[id], id, corner:i, num:[1,91,10][i], facing:0,
  vibe:SPIRIT_DEFS[id].maxVibe, maxVibe:SPIRIT_DEFS[id].maxVibe, cpu:true}));
const hits={}, commits={};
for (let i=0;i<8;i++){
  const policies=Object.fromEntries(ids.map(id=>[id,(st,sid,v,ctx)=>{
    const p=POLICIES.searcher({})(st,sid,v,ctx); const arr=Array.isArray(p)?p:[p];
    if(arr.some(x=>x?.kind==='confirmMelody')){
      const full=[...(st.noteStates[sid]?.melodyLine??[]), ...arr.filter(x=>x.kind==='melodyNote').map(x=>x.note)];
      commits[sid]=(commits[sid]??0)+1;
      for(const h of detectSpiritStyle(sid,full).hits) hits[`${sid}:${h}`]=(hits[`${sid}:${h}`]??0)+1;
    } return p;}]));
  runMatch({seed:7700+i, spirits, policies, maxTurns:150});
}
console.log('commits', JSON.stringify(commits));
console.log('hits   ', JSON.stringify(hits));
