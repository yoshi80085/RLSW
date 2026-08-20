// 🌀 DOES HE ACTUALLY DRAW IT? Legal-vs-chosen for the dash, once it is a real
// action kind. ⚠️ Needs the skill UNLOCKED, so the seats are seeded with it —
// the tree awards it through Db over a long match and a bench that waits for
// that measures the economy, not the ability.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { noteSheetPatched } from '../src/engine/actions.js';
import { journalSummary } from '../src/engine/policies/botJournal.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
const sp=(ids,h,c,skills)=>ids.map((id,i)=>({...SPIRIT_DEFS[id],id,corner:c[i],num:h[i],
  vibe:SPIRIT_DEFS[id].maxVibe,maxVibe:SPIRIT_DEFS[id].maxVibe,speed:SPIRIT_DEFS[id].speed,facing:0,cpu:true}));
const PAIRS=[
  sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']),
  sp(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple']),
];
const n=Number(process.argv[2]??10);
const journal=[]; const wins={},seats={};
for(const S of PAIRS)for(let i=0;i<n;i++){
  const base=Object.fromEntries(S.map(x=>[x.id,POLICIES.searcher({trace:e=>journal.push(e)})]));
  const policies=Object.fromEntries(S.map(x=>[x.id,(state,id,view,ctx)=>{
    const ns=state.noteStates?.[id]??{};
    if(id==='cosmic_ronin' && !(ns.unlockedSkills??[]).includes('psycho_bushido')){
      (ns.unlockedSkills??(ns.unlockedSkills=[])).push('psycho_bushido');
    }
    return base[id](state,id,view,ctx);
  }]));
  // ⚠️ SEEDED THROUGH THE POLICY'S FIRST CALL, because `runMatch` has no skill
  // seed and the tree awards this over a long match — a bench that waits for the
  // Db bar measures the ECONOMY, not the ability.
  const r=runMatch({seed:(i*2654435761+12345)>>>0,spirits:S,policies,lives:3});
  for(const x of S) seats[x.id]=(seats[x.id]??0)+1;
  if(r.winner) wins[r.winner]=(wins[r.winner]??0)+1;
}
const sum=journalSummary(journal);
const s=sum['cosmic_ronin']??{};
console.log(`${PAIRS.length*n} matches — Ronin won ${wins.cosmic_ronin??0}/${seats.cosmic_ronin??0}, ${s.actionDecisions} action decisions\n`);
for(const k of ['psychoBushido','swing','sonic','riffOff','move','face','pose','endTurn']){
  const legal=s.legalSeen?.[k]??0, took=s.chosen?.[k]??0;
  const pct=legal?(100*took/legal).toFixed(1):'—';
  console.log(`   ${took===0&&legal>0?'⚠️ ':'   '}${k.padEnd(15)} legal ${String(legal).padStart(5)}×  chosen ${String(took).padStart(4)}×  (${pct}%)`);
}
