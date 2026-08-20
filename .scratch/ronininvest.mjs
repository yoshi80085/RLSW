// 🗡️ WHAT DOES THE RONIN SAVE UP FOR? `skillTarget` is the ONLY decision the bot
// makes about its own kit — it aims the Db bar, and the award is automatic.
// ⚠️ So this is "what it thinks its abilities are worth", in the only currency
// the searcher has for that question. An ability it aims at but can never USE is
// a straight loss: the Db bar is a shared, finite resource (§3.2's unlock-vs-fuel).
import { runMatch, POLICIES } from '../src/engine/policies/play.js';
import { MODELLED_KINDS } from '../src/engine/policies/transition.js';
import { SPIRIT_DEFS } from '../src/data/spirits.js';
import { SKILL_BY_ID } from '../src/data/skillTree.js';
const sp=(ids,h,c)=>ids.map((id,i)=>({...SPIRIT_DEFS[id],id,corner:c[i],num:h[i],
  vibe:SPIRIT_DEFS[id].maxVibe,maxVibe:SPIRIT_DEFS[id].maxVibe,speed:SPIRIT_DEFS[id].speed,facing:0,cpu:true}));
const PAIRS=[
  sp(['cosmic_ronin','Metalness_Monster'],[12,44],['blue','yellow']),
  sp(['cosmic_ronin','intergalactic_0'],[12,44],['blue','purple']),
];
const n=Number(process.argv[2]??12);
const journal=[];
for(const S of PAIRS)for(let i=0;i<n;i++){
  const policies=Object.fromEntries(S.map(x=>[x.id,POLICIES.searcher({trace:e=>journal.push(e),audit:false})]));
  runMatch({seed:(i*2654435761+12345)>>>0,spirits:S,policies,lives:3});
}
const aimed={}, offered={};
for(const e of journal){
  if(e.t!=='action'||e.spiritId!=='cosmic_ronin') continue;
  if(e.chosen?.kind==='skillTarget'){ const k=e.chosen.key; aimed[k]=(aimed[k]??0)+1; }
  for(const c of (e.considered??[])) if(c.kind==='skillTarget') offered[c.key]=(offered[c.key]??0)+1;
}
const RONIN_ONLY=new Set(['psycho_bushido','shadow_illusion','cursed_shamisen','wa_no_koe']);
const rows=Object.entries(aimed).sort((a,b)=>b[1]-a[1]);
console.log(`Ronin — ${Object.values(aimed).reduce((a,b)=>a+b,0)} skill-target decisions over ${PAIRS.length*n} matches\n`);
console.log('skill                aimed at   Db cost   usable by the bot?');
for(const [k,v] of rows){
  const sk=SKILL_BY_ID[k];
  const own=RONIN_ONLY.has(k);
  const usable = own ? (MODELLED_KINDS.has(k) ? 'yes' : '❌ NO — not an action kind') : (sk? 'passive/stat — read off the sheet':'—');
  console.log(`   ${k.padEnd(18)} ${String(v).padStart(5)}   ${String(sk?.dbCost??'?').padStart(5)}     ${usable}`);
}
const wasted=rows.filter(([k])=>RONIN_ONLY.has(k)&&!MODELLED_KINDS.has(k));
const wastedDb=wasted.reduce((a,[k,v])=>a+v*(SKILL_BY_ID[k]?.dbCost??0),0);
console.log(`\n⚠️ ${wasted.reduce((a,[,v])=>a+v,0)} of those aims were at an ability the bot has no action for.`);
console.log(`   Nominal Db aimed into abilities it can never fire: ${wastedDb}.`);
console.log(`   (Aim count × cost is an UPPER BOUND — a re-aim before the bar fills spends nothing.)`);
