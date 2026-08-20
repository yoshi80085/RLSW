// 🧭 A/B: is `apBanked` what makes it spin? Same seeds, same script both arms.
// ⚠️ apBanked:0 is a DIAGNOSTIC, not the proposed fix — AP inside a turn really
// is worth something. It isolates whether the spin is driven by the AP term.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
const sp=(ids,h,c)=>ids.map((id,i)=>({...SPIRIT_DEFS[id],id,corner:c[i],num:h[i],
  vibe:SPIRIT_DEFS[id].maxVibe,maxVibe:SPIRIT_DEFS[id].maxVibe,speed:SPIRIT_DEFS[id].speed,facing:0,cpu:true}));
const PAIRS=[
  sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']),
  sp(['Metalness_Monster','intergalactic_0'],[12,44],['yellow','purple']),
  sp(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple']),
];
const n=Number(process.argv[2]??8);
function run(view,label){
  const journal=[];
  let decided=0,turnsTot=0,matches=0;
  for(const S of PAIRS)for(let i=0;i<n;i++){
    const policies=Object.fromEntries(S.map(x=>[x.id,POLICIES.searcher({trace:e=>journal.push(e),audit:false})]));
    const r=runMatch({seed:(i*2654435761+12345)>>>0,spirits:S,policies,lives:3,view});
    matches++; if(r.winner)decided++; turnsTot+=r.turns;
  }
  const turns=[];let cur=null;
  for(const e of journal){if(e.t!=='action')continue;
    if(!cur||cur.turn!==e.turn||cur.spiritId!==e.spiritId){cur={turn:e.turn,spiritId:e.spiritId,kinds:[]};turns.push(cur);}
    cur.kinds.push(e.chosen?.kind??'?');}
  let acts=0,faces=0,wasted=0,moves=0,atk=0;
  const A=new Set(['swing','sonic','tentacle','riffOff']);
  for(const t of turns){acts+=t.kinds.length;
    for(const k of t.kinds){if(k==='move')moves++;if(A.has(k))atk++;}
    for(let i=0;i<t.kinds.length;){
      if(t.kinds[i]!=='face'){i++;continue;}
      let j=i;while(j<t.kinds.length&&t.kinds[j]==='face')j++;
      faces+=j-i; wasted+=j-i-1; i=j;}}
  console.log(`${label.padEnd(22)} decided ${decided}/${matches}  meanTurns ${(turnsTot/matches).toFixed(1)}  actions ${acts}`);
  console.log(`${''.padEnd(22)} face ${String(faces).padStart(5)} (${(100*faces/acts).toFixed(1)}%)   dominated ${String(wasted).padStart(5)}   move ${String(moves).padStart(5)} (${(100*moves/acts).toFixed(1)}%)   attacks ${atk}`);
}
run({}, '[shipped]');
run({ weightOverrides: { apBanked: 0 } }, '[apBanked:0]');
