// 🎤 test:marqueejourney — the two marquee rounds in the mounted game
// (MARQUEE_QUIZ_DESIGN.md §13). Mount 1: a SOLO marquee, nobody clicks, and the
// 10 s clock turns it into a wrong answer. Mount 2: a COMMUNITY marquee — two
// humans and a bot each get a row; one human answers wrong and is locked out,
// the other answers right first and wins the card.
import './clientRenderShim.mjs';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import assert from 'node:assert/strict';
import {Game} from '../rlsw-simulator-v3_8_1.jsx';
import {buildTestingGroundsConfig} from '../data/matchSetup.js';
import {makeInitialState} from './state.js';
import {HEX_BY_NUM} from '../board/hexMap.js';
import {neighborInDirection, angleTo} from '../board/hexGeometry.js';
import {quadrantOf} from './systems/marqueeSpaces.js';
import {handOf} from './systems/marqueeCards.js';
import {MARQUEE_SOLO_SECONDS} from '../data/gameConstants.js';

const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
dom.window.Element.prototype.animate=()=>({cancel(){},finished:Promise.resolve()});
for(const name of ['document','HTMLElement','Element','Node','MutationObserver'])Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes(text));
const click=async el=>{assert.ok(el,'click target');assert.ok(!el.disabled,'enabled');await act(async()=>el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
const wait=async ms=>act(async()=>new Promise(r=>setTimeout(r,ms)));
const until=async(read,message,ms=12000)=>{for(let i=0;i<ms/20;i++){const found=read();if(found)return found;await wait(20);}assert.fail(message);};
let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;};

/** A Testing Grounds table whose first Spirit starts one step from its own quadrant's marquee. */
function tableNextToMarquee(seed){
  const config=buildTestingGroundsConfig({beginnerMode:false});config.seed=seed;
  config.spirits=config.spirits.map((s,i)=>({...s,cpu:i===2,vibe:100,maxVibe:100}));
  const first=makeInitialState(config,seed);
  const mine=first.board.eventHexes.find(h=>quadrantOf(h)===config.spirits[0].corner);
  const taken=new Set(config.spirits.map(s=>s.num));
  for(let d=0;d<6;d++){
    const nb=neighborInDirection(HEX_BY_NUM[mine],d);
    if(!nb||taken.has(nb.num)||first.board.eventHexes.includes(nb.num))continue;
    const trial={...config,spirits:config.spirits.map((s,i)=>i===0?{...s,num:nb.num,facing:angleTo(nb,HEX_BY_NUM[mine])}:s)};
    const st=makeInitialState(trial,seed);
    if(st.board.eventHexes.includes(mine))return {config:trial,marquee:mine};
  }
  throw new Error('no free hex beside the marquee');
}

async function mount(config){
  let state;
  const root=createRoot(document.getElementById('root'));
  await act(async()=>root.render(<Game gameState={config} onReturnToLobby={()=>{}} onEngineState={s=>{state=s;}}/>));
  const get=()=>state;
  await click(button('Continue to Melody'));
  for(let i=0;i<3;i++)await click([...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')].map(e=>e.parentElement).find(e=>e.style.cursor==='pointer'));
  await click(button('Commit (3 notes'));
  return {root,get};
}
async function flipKinds(get,want){
  await click(document.querySelector('button[title="Testing Grounds"]'));
  const is=()=>get().board.eventHexes.every(h=>(get().board.marqueeKinds?.[h]??'solo')===want);
  if(!is())await click(button('🎤 Flip marquees'));
  if(!is())await click(button('🎤 Flip marquees'));
  ok(is(),`the Testing Grounds turns every marquee ${want}`);
  await click(document.querySelector('button[title="Testing Grounds"]'));
}

// ── Mount 1: SOLO — the clock runs out ───────────────────────────────────────
{
  const {config,marquee}=tableNextToMarquee(44);
  const {root,get}=await mount(config);
  ok(get().board.eventHexes.includes(marquee),'the mounted table has the marquee beside the first Spirit');
  await flipKinds(get,'solo');
  await click(document.querySelector(`[data-hex-num="${marquee}"]`));
  const card=await until(()=>document.querySelector('[data-marquee-kind="solo"]'),'a solo marquee opens the ticket');
  ok(card,'the solo ticket is up');
  ok(document.querySelector('[data-marquee-clock]'),'…with a clock');
  ok(!get().board.eventHexes.includes(marquee),'the marquee burned out as the question was drawn');
  await wait(MARQUEE_SOLO_SECONDS*1000+400);
  ok(/TIME'S UP/.test(document.body.textContent),'after 10 s with no click: time is up — a wrong answer');
  ok(handOf(get().noteStates[get().spirits[0].id]).length===0,'…and no card');
  await act(async()=>root.unmount());
}

// ── Mount 2: COMMUNITY — rows, a lock-out, the first right answer ───────────
{
  const {config,marquee}=tableNextToMarquee(45);
  const {root,get}=await mount(config);
  await flipKinds(get,'community');
  const ids=get().spirits.filter(s=>!s.knockedOut).map(s=>s.id);
  await click(document.querySelector(`[data-hex-num="${marquee}"]`));
  await until(()=>document.querySelector('[data-marquee-kind="community"]'),'a community marquee opens the ticket');
  const rows=[...document.querySelectorAll('[data-community-row]')].map(r=>r.dataset.communityRow);
  assert.deepEqual(rows,ids,'every Spirit at the table has a row, the lander first');n++;
  // Find the question by its text on the ticket, to know the right letter.
  const {TRIVIA_QUESTIONS}=await import('../data/trivia.js');
  const qText=[...document.querySelectorAll('[data-marquee-kind="community"] div')].map(d=>d.textContent).find(t=>TRIVIA_QUESTIONS.some(x=>x.question===t));
  const question=TRIVIA_QUESTIONS.find(x=>x.question===qText);
  ok(!!question,'the ticket shows a real question');
  const L=['A','B','C','D'],right=L[question.answer],wrong=L[(question.answer+1)%4];
  // The second human answers WRONG first…
  await click(document.querySelector(`[data-answer="${ids[1]}:${wrong}"]`));
  await until(()=>/✕ out/.test(document.querySelector(`[data-community-row="${ids[1]}"]`).textContent),'a wrong answer locks that seat out');
  ok(document.querySelector(`[data-answer="${ids[1]}:${right}"]`).disabled,'…one try each');
  ok(document.querySelector('[data-marquee-kind="community"]') && !/ANSWERS FIRST/.test(document.body.textContent),'…and the round is still open');
  // …then the lander answers RIGHT, before the bot's earliest possible click (3 s).
  await click(document.querySelector(`[data-answer="${ids[0]}:${right}"]`));
  await until(()=>/ANSWERS FIRST/.test(document.body.textContent),'the first right answer wins');
  ok(handOf(get().noteStates[ids[0]]).length===1,'the winner gets the card');
  ok(handOf(get().noteStates[ids[1]]).length===0,'the locked-out seat gets nothing');
  await act(async()=>root.unmount());
}
console.log(`🎤 Mounted marquee journey: ${n} checks — the solo clock runs out, community rows, a lock-out, the first right answer wins.`);
process.exit(0);
