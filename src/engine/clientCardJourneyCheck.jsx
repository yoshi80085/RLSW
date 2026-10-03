// 🃏 test:cardjourney — the marquee card AT THE ROLL, in the mounted game
// (MARQUEE_QUIZ_DESIGN.md §10.6). Deal cards from the Testing Grounds, open a
// Swing, press "Use a card" above Roll, let the hand spin out, pick one, and
// check the engine re-threw the attacker's dice with it — and that the
// auto-roll held while the picker was open.
import './clientRenderShim.mjs';
import {JSDOM} from 'jsdom';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import assert from 'node:assert/strict';
import {Game} from '../rlsw-simulator-v3_8_1.jsx';
import {buildTestingGroundsConfig} from '../data/matchSetup.js';
import {HEX_BY_NUM} from '../board/hexMap.js';
import {angleTo,neighborInDirection} from '../board/hexGeometry.js';
import {handOf} from './systems/marqueeCards.js';

const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
dom.window.Element.prototype.animate=()=>({cancel(){},finished:Promise.resolve()});
for(const name of ['document','HTMLElement','Element','Node','MutationObserver'])Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const config=buildTestingGroundsConfig({beginnerMode:false});config.seed=44;
config.spirits=config.spirits.map(s=>({...s,cpu:false,vibe:100,maxVibe:100}));
const a=HEX_BY_NUM[config.spirits[0].num],b=neighborInDirection(a,0);
config.spirits[0].facing=angleTo(a,b);config.spirits[1].num=b.num;
let state;
const root=createRoot(document.getElementById('root'));
const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes(text));
const click=async el=>{assert.ok(el,'click target');assert.ok(!el.disabled,'enabled');await act(async()=>el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
const wait=async ms=>act(async()=>new Promise(r=>setTimeout(r,ms)));
const until=async(read,message,ms=12000)=>{for(let i=0;i<ms/10;i++){const found=read();if(found)return found;await wait(10);}assert.fail(message);};
let n=0;const ok=(c,m)=>{assert.ok(c,m);n++;};

await act(async()=>root.render(<Game gameState={config} onReturnToLobby={()=>{}} onEngineState={s=>{state=s;}}/>));
await click(button('Continue to Melody'));
const me=state.acting;

// 1 · Deal from the Testing Grounds (deck order; a full hand swaps its first card):
//     loaded4, loaded5, loaded6; then biggerCab and fullStack each take slot 0.
await click(document.querySelector('button[title="Testing Grounds"]'));
for(let i=0;i<5;i++)await click(button('+1 🃏 Card'));
assert.deepEqual(handOf(state.noteStates[me]),['fullStack','loaded5','loaded6'],'the Testing Grounds deals cards');n++;
await click(document.querySelector('button[title="Testing Grounds"]'));

// 2 · A Swing. The attacker's ROLL carries "Use a card" above it.
for(let i=0;i<3;i++)await click([...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')].map(e=>e.parentElement).find(e=>e.style.cursor==='pointer'));
await click(button('Commit (3 notes'));
ok(document.querySelector('[data-marquee-hand]')?.dataset.marqueeHand==='3','the rail shows the hand');
await click(button('Thrash'));await click(document.querySelector(`[data-hex-num="${b.num}"]`));
ok(state.battle?.swingClash,'the Swing is rolled');
const before=state.battle;
const use=await until(()=>document.querySelector('[data-use-card]'),'the attacker is offered the cards');
ok(/×3/.test(use.textContent),'the button counts the hand');

// 3 · Open the picker. The auto-roll must HOLD past its 5 s while it is open.
await click(use);
ok(document.querySelector('[role="dialog"][aria-label="Play a card"]'),'the cards come out');
await wait(6000);
ok(document.querySelector('.sonic-roll-prompt button:not([data-use-card])'),'the auto-roll held while the picker was open');
ok(!state.battle.cardPlayed,'nothing is played by waiting');

// 4 · Pick Full Stack — it always changes a d6 pool.
const card=await until(()=>document.querySelector('[data-pick-card="fullStack"]'),'the hand is dealt');
await click(card);
await until(()=>state.battle?.cardPlayed,'the card is played',3000);
ok(state.battle.cardPlayed==='fullStack','the engine records the card');
ok(state.battle.rolledPool.includes(10),'the attacker\'s dice were re-thrown with a d10');
assert.deepEqual(state.battle.defenderDiceVals,before.defenderDiceVals,'the Rival\'s throw stands');n++;
assert.deepEqual(handOf(state.noteStates[me]),['loaded5','loaded6'],'the card leaves the hand');n++;
await until(()=>!document.querySelector('[role="dialog"][aria-label="Play a card"]'),'the picker closes');
ok(!document.querySelector('[data-use-card]'),'one card per battle — the button is gone');
ok(/Roll \d+/.test(document.querySelector('.sonic-roll-prompt button')?.textContent??''),'the ROLL is back');
ok(document.querySelector('[data-swing-phase]')?.dataset.swingPhase==='swing_attacker','still waiting on the attacker — nothing was revealed');

// 5 · Roll and let the clash play out on the new dice.
await click(document.querySelector('.sonic-roll-prompt button'));
const second=await until(()=>document.querySelector('.sonic-roll-prompt button'),'the Rival is asked to roll',9000);
await click(second);
await until(()=>!document.querySelector('[data-swing-phase]'),'the clash closes',15000);
await act(async()=>root.unmount());
console.log(`🃏 Mounted card journey: ${n} checks — deal, Use a card above ROLL, the held auto-roll, the spin and pick, the re-throw, one card per battle, the clash on the new dice.`);
process.exit(0);
