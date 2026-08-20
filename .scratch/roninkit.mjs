// 🗡️ WHAT DOES THE RONIN ACTUALLY DO? Legal-vs-chosen per kind for the
// cosmic_ronin seat, the `slimeuse.mjs` treatment applied to the other kit.
//
// ⚠️ READ THE SECOND TABLE FIRST. The kit's four skills are not action KINDS —
// `MODELLED_KINDS` has no entry for any of them — so "chosen 0×" for an ability
// here does not mean the bot declined it. It means the bot was never offered it.
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { journalSummary } from '../src/engine/policies/botJournal.js';
import { MODELLED_KINDS, UNMODELLED_KINDS } from '../src/engine/policies/transition.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { SKILL_BY_ID } from '../src/data/skillTree.js';
import { BOT_SPIRIT_SKILLS } from '../src/engine/policies/bot.js';
const RONIN_SKILLS = BOT_SPIRIT_SKILLS.cosmic_ronin;

const sp=(ids,h,c)=>ids.map((id,i)=>({...SPIRIT_DEFS[id],id,corner:c[i],num:h[i],
  vibe:SPIRIT_DEFS[id].maxVibe,maxVibe:SPIRIT_DEFS[id].maxVibe,speed:SPIRIT_DEFS[id].speed,facing:0,cpu:true}));
const PAIRS=[
  sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']),
  sp(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple']),
];
const n=Number(process.argv[2]??12);
const journal=[]; const wins={},seats={};
for(const S of PAIRS)for(let i=0;i<n;i++){
  const policies=Object.fromEntries(S.map(x=>[x.id,POLICIES.searcher({trace:e=>journal.push(e),audit:false})]));
  const r=runMatch({seed:(i*2654435761+12345)>>>0,spirits:S,policies,lives:3});
  for(const x of S) seats[x.id]=(seats[x.id]??0)+1;
  if(r.winner) wins[r.winner]=(wins[r.winner]??0)+1;
}
const sum=journalSummary(journal);
const KIT=['melodyNote','stackCommit','confirmMelody','move','face','swing','sonic','pose','riffOff','eleven','skillTarget','endTurn'];
console.log(`${PAIRS.length*n} matches, searcher every seat, 3 lives\n`);
for(const [id,s] of Object.entries(sum)){
  if(id!=='cosmic_ronin') continue;
  console.log(`${id} — won ${wins[id]??0}/${seats[id]??0}, ${s.actionDecisions} action decisions`);
  for(const k of KIT){
    const legal=s.legalSeen?.[k]??0, took=s.chosen?.[k]??0;
    if(!legal&&!took) continue;
    const pct=legal?(100*took/legal).toFixed(1):'—';
    console.log(`   ${took===0&&legal>0?'⚠️ ':'   '}${k.padEnd(14)} legal ${String(legal).padStart(5)}×  chosen ${String(took).padStart(5)}×  (${pct}%)`);
  }
}
console.log(`\n🗡️ THE SHREDDING RONIN ARSENAL vs the engine's action vocabulary:`);
for(const id of RONIN_SKILLS){
  const sk=SKILL_BY_ID[id];
  const modelled = MODELLED_KINDS.has(id) || UNMODELLED_KINDS.has(id);
  console.log(`   ${modelled?'✅':'❌'} ${id.padEnd(18)} ${modelled?'is an action kind':'NOT an action kind — unreachable by any policy'}   ${sk?`(${sk.dbCost} Db)`:''}`);
}
console.log(`\n🧪 the Monster's kit, for contrast:`);
for(const id of ['slime','slide','tentacle','eleven'])
  console.log(`   ${MODELLED_KINDS.has(id)?'✅':'❌'} ${id.padEnd(18)} ${MODELLED_KINDS.has(id)?'is an action kind':'NOT an action kind'}`);
console.log(`\nMODELLED_KINDS = ${[...MODELLED_KINDS].join(', ')}`);
console.log(`UNMODELLED_KINDS = ${[...UNMODELLED_KINDS].join(', ')}`);
