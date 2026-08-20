// 🧭 THE FACE GUARD, BEFORE AND AFTER — same seeds, same script both arms, which
// is the only honest shape for a change that cannot ride `weightOverrides`.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
const sp=(ids,h,c)=>ids.map((id,i)=>({...SPIRIT_DEFS[id],id,corner:c[i],num:h[i],
  vibe:SPIRIT_DEFS[id].maxVibe,maxVibe:SPIRIT_DEFS[id].maxVibe,speed:SPIRIT_DEFS[id].speed,facing:0,cpu:true}));
const PAIRS=[
  sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']),
  sp(['Metalness_Monster','intergalactic_0'],[12,44],['yellow','purple']),
  sp(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple']),
];
const n=Number(process.argv[2]??45);
const A=new Set(['swing','sonic','tentacle','riffOff']);
function run(faceGuard,label,view){
  const journal=[]; let decided=0,turns=0,m=0;
  for(const S of PAIRS)for(let i=0;i<n;i++){
    const policies=Object.fromEntries(S.map(x=>[x.id,POLICIES.searcher({trace:e=>journal.push(e),faceGuard})]));
    const r=runMatch({seed:(i*2654435761+12345)>>>0,spirits:S,policies,lives:3,view});
    m++; if(r.winner)decided++; turns+=r.turns;
  }
  let acts=0,face=0,move=0,atk=0,pose=0,commit=0,dom=0;
  const byTurn=[]; let cur=null;
  for(const e of journal){ if(e.t!=='action')continue;
    if(!cur||cur.turn!==e.turn||cur.spiritId!==e.spiritId){cur={turn:e.turn,spiritId:e.spiritId,k:[]};byTurn.push(cur);}
    cur.k.push(e.chosen?.kind??'?'); }
  for(const t of byTurn){acts+=t.k.length;
    for(const k of t.k){if(k==='face')face++;if(k==='move')move++;if(A.has(k))atk++;if(k==='pose')pose++;}
    for(let i=0;i<t.k.length;){ if(t.k[i]!=='face'){i++;continue;}
      let j=i; while(j<t.k.length&&t.k[j]==='face')j++; dom+=j-i-1; i=j; }}
  const p=x=>`${(100*x/acts).toFixed(1)}%`;
  console.log(`${label.padEnd(16)} decided ${decided}/${m}  meanTurns ${(turns/m).toFixed(1)}  actions ${acts}`);
  console.log(`${''.padEnd(16)} face ${String(face).padStart(5)} ${p(face).padStart(6)}   dominated ${String(dom).padStart(5)}   move ${String(move).padStart(5)} ${p(move).padStart(6)}   attacks ${String(atk).padStart(4)}   poses ${pose}`);
}
// ⚠️ ARMS RUN SEPARATELY — the whole A/B in one process exceeds the 45s tool cap
// on this machine, and a truncated run reports nothing at all. Same seeds either
// way, so the two invocations are still the same comparison.
const arm = process.argv[3] ?? 'both';
if (arm === 'both' || arm === 'noguard') run(false, '[no guard]');
if (arm === 'both' || arm === 'guard') run(true, '[guard ON]');
// ⚠️ THE TERM'S OWN A/B, with the guard held constant. `facing: 0` neutralises the
// row without removing it, which is the only way to ask "was the TERM worth it"
// separately from "was the GUARD worth it" — they landed in the same session and
// would otherwise be one confounded reading.
if (arm === 'both' || arm === 'noterm') run(true, '[guard, facing:0]', { weightOverrides: { facing: 0 } });
