// §7 says the Swing spends 2 Drive notes ON HIT ONLY. Does the transition do it?
import { legalActions } from '../src/engine/policies/legalActions.js';
import { applyBotAction } from '../src/engine/policies/transition.js';
import { makeInitialState } from '../src/engine/state.js';
import { makeRng } from '../src/engine/rng.js';
import { moveBudgetSet } from '../src/engine/actions.js';
import { applyAction } from '../src/engine/reduce.js';
import { HEX_BY_NUM, HEX_BY_QR } from '../src/board/hexMap.js';
import { axialNeighbors, angleTo } from '../src/board/hexGeometry.js';
const A='cosmic_ronin', B='intergalactic_0';
const NOTES=['Eb','Bb','G','D','Ab','C','F','Bb'];
let st = makeInitialState({mode:'ffa',startingLives:2,spirits:[
  {id:A,name:'R',corner:'blue',num:45,vibe:5,maxVibe:5,speed:5,facing:0},
  {id:B,name:'Z',corner:'purple',num:44,vibe:4,maxVibe:4,speed:4,facing:0}]},9);
const here=HEX_BY_NUM[45];
const nb=axialNeighbors(here.q,here.r).map(({q,r})=>HEX_BY_QR[`${q},${r}`]).filter(Boolean)[0];
st={...st,acting:A,spirits:st.spirits.map(s=>s.id===B?{...s,num:nb.num}:(s.id===A?{...s,facing:angleTo(here,nb)}:s))};
st=applyAction(st,moveBudgetSet(5,false));
st={...st,noteStates:{...st.noteStates,[A]:{...st.noteStates[A],hasConfirmed:true,driveStack:NOTES.slice(0,6)}}};
const v={posing:{},amps:[],shadowHex:null,rockGodActive:false};
const swing=legalActions(st,A,v).find(a=>a.kind==='swing');
const sonic=legalActions(st,A,v).find(a=>a.kind==='sonic');
console.log('before: driveStack len', st.noteStates[A].driveStack.length, ' sustainStack len', st.noteStates[A].sustainStack.length, ' swingExposed', st.noteStates[A].swingExposed);
for (const [label, act] of [['swing', swing], ['sonic', sonic]]) {
  if (!act) { console.log(label, 'none'); continue; }
  let hitSeen=false, missSeen=false;
  for (let s=1;s<=60 && !(hitSeen&&missSeen);s++){
    const r=applyBotAction(st,act,{rng:makeRng(s).fork('search'),view:v,hooks:{}});
    if(!r.ok) continue;
    const t=r.state.spirits.find(x=>x.id===B);
    const hit = t.vibe < 4;
    if (hit && hitSeen) continue; if (!hit && missSeen) continue;
    hit ? hitSeen=true : missSeen=true;
    const nsA=r.state.noteStates[A];
    console.log(`${label} ${hit?'HIT ':'MISS'} seed ${s}: drive ${nsA.driveStack.length} sustain ${nsA.sustainStack.length} swingExposed ${nsA.swingExposed} | rival vibe ${t.vibe}`);
  }
}
