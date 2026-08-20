// 🧭 WHY IS SPINNING BETTER THAN STOPPING? Print every priced option on the
// first step of a long spin, not just the top three.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
const sp = (ids,h,c)=>ids.map((id,i)=>({...SPIRIT_DEFS[id],id,corner:c[i],num:h[i],
  vibe:SPIRIT_DEFS[id].maxVibe,maxVibe:SPIRIT_DEFS[id].maxVibe,speed:SPIRIT_DEFS[id].speed,facing:0,cpu:true}));
const S = sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']);
const journal=[];
const policies=Object.fromEntries(S.map(x=>[x.id,POLICIES.searcher({trace:e=>journal.push(e),audit:true})]));
runMatch({seed:12345,spirits:S,policies,lives:3});
const turns=[];let cur=null;
for(const e of journal){ if(e.t!=='action')continue;
  if(!cur||cur.turn!==e.turn||cur.spiritId!==e.spiritId){cur={turn:e.turn,spiritId:e.spiritId,es:[]};turns.push(cur);}
  cur.es.push(e);}
let shown=0;
for(const t of turns){
  for(let i=0;i<t.es.length;){
    if(t.es[i].chosen?.kind!=='face'){i++;continue;}
    let j=i;while(j<t.es.length&&t.es[j].chosen?.kind==='face')j++;
    if(j-i>=4&&shown<2){
      shown++;
      console.log(`\n=== ${t.spiritId}, turn ${t.turn} — a ${j-i}-step spin. Full menu on step 1: ===`);
      for(const c of (t.es[i].considered??[]).sort((a,b)=>b.score-a.score))
        console.log(`   ${String(c.kind).padEnd(14)} ${String(c.key??'').padEnd(8)} ${c.score.toFixed(4)}`);
      console.log(`   legal kinds this step: ${(t.es[i].legalKinds??[]).join(', ')}`);
      console.log(`   best option the BEAM THREW AWAY: ${t.es[i].bestPruned ? `${t.es[i].bestPruned.kind} ${t.es[i].bestPruned.score.toFixed(4)}` : 'none'}`);
      console.log(`   --- and the LAST step of the same spin, then what it did next: ---`);
      for(const c of (t.es[j-1].considered??[]).sort((a,b)=>b.score-a.score))
        console.log(`   ${String(c.kind).padEnd(14)} ${String(c.key??'').padEnd(8)} ${c.score.toFixed(4)}`);
      console.log(`   → then chose: ${t.es[j]?.chosen?.kind ?? '(turn ended)'}`);
    }
    i=j;
  }
}
