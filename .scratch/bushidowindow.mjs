// 🌀 HOW OFTEN IS THE CHARGE LANE OPEN? A minimum-range gate on Psycho Bushido
// only works if a rival is ACTUALLY 3+ hexes down one of the Ronin's six axes
// often enough for the ability to exist. `eleven` (legal 760×, chosen 0×) and
// `tentacle` (legal 9×) are what a too-narrow window looks like after it ships.
//
// Walks each axis outward, STOPPING AT THE FIRST OCCUPIED HEX — the charge is a
// straight line and a body blocks it, same as `getPsychoBushidoTargets`.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { HEX_BY_NUM, HEX_BY_QR } from '../src/board/hexMap.js';
import { getFlatTopNeighborSlots } from '../src/board/hexGeometry.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';

const sp=(ids,h,c)=>ids.map((id,i)=>({...SPIRIT_DEFS[id],id,corner:c[i],num:h[i],
  vibe:SPIRIT_DEFS[id].maxVibe,maxVibe:SPIRIT_DEFS[id].maxVibe,speed:SPIRIT_DEFS[id].speed,facing:0,cpu:true}));
const PAIRS=[
  sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']),
  sp(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple']),
];
const n=Number(process.argv[2]??10);

// Sample the live board at the top of every Ronin action decision.
const samples=[];
const probe = (state) => {
  const self=(state.spirits??[]).find(s=>s.id==='cosmic_ronin');
  if(!self||self.knockedOut) return;
  const here=HEX_BY_NUM[self.num]; if(!here) return;
  const ap=state.turn?.moveStepsLeft??0;
  const occupied=new Map((state.spirits??[]).filter(s=>!s.knockedOut).map(s=>[s.num,s.id]));
  const hits=[];
  for(const nb of getFlatTopNeighborSlots(here)){
    const dq=nb.q-here.q, dr=nb.r-here.r;
    let q=here.q,r=here.r;
    for(let d=1;d<=6;d++){
      q+=dq; r+=dr;
      const h=HEX_BY_QR[`${q},${r}`]; if(!h) break;
      const who=occupied.get(h.num);
      if(who){ if(who!=='cosmic_ronin') hits.push(d); break; }   // body blocks the lane
    }
  }
  samples.push({ ap, hits });
};

for(const S of PAIRS)for(let i=0;i<n;i++){
  const policies=Object.fromEntries(S.map(x=>[x.id,(state,id,view,ctx)=>{
    if(id==='cosmic_ronin') probe(state);
    return POLICIES.searcher({})(state,id,view,ctx);
  }]));
  runMatch({seed:(i*2654435761+12345)>>>0,spirits:S,policies,lives:3});
}

const N=samples.length;
const atLeast=d=>samples.filter(s=>s.hits.some(x=>x>=d)).length;
const exactly=d=>samples.filter(s=>s.hits.includes(d)).length;
const pc=x=>`${(100*x/N).toFixed(1)}%`.padStart(6);
console.log(`${PAIRS.length*n} matches — ${N} Ronin decision points sampled (Ronin speed ${SPIRIT_DEFS.cosmic_ronin.speed})\n`);
console.log('a rival sits on an unblocked axis at...');
for(let d=1;d<=6;d++) console.log(`   exactly ${d} hex${d>1?'es':' '}   ${pc(exactly(d))}   ${String(exactly(d)).padStart(5)} of ${N}`);
console.log('\nwhat a MINIMUM-RANGE gate would leave:');
for(const d of [1,2,3,4]){
  const open=samples.filter(s=>s.hits.some(x=>x>=d));
  const alsoAp=open.filter(s=>s.ap>=d);        // needs the AP to cover the run-up + blow
  console.log(`   range ≥${d}  lane open ${pc(open.length)}   …and AP ≥${d} too: ${pc(alsoAp.length)}`);
}
const anyLane=samples.filter(s=>s.hits.length).length;
console.log(`\nany lane at all (today's rule, any distance): ${pc(anyLane)}`);
console.log(`⚠️ These are DECISION POINTS, not turns — a turn contains several, and the`);
console.log(`   Ronin can spend AP to open a lane. Read it as the passive rate, a FLOOR.`);
