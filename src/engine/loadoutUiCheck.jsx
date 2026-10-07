import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Lobby } from '../ui/Lobby.jsx';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { noteSheetPatched } from './actions.js';
import assert from 'node:assert/strict';
import process from 'node:process';
const dom = new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
dom.window.Element.prototype.animate=()=>({cancel(){},finished:Promise.resolve()});
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
for(const name of ['document','HTMLElement','Element','Node','MutationObserver'])Object.defineProperty(globalThis,name,{configurable:true,value:dom.window[name]});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const root=createRoot(document.getElementById('root'));
const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes(text));
// ⚠️ `!== true`, not `=== false`: the hand's note chips are <div>s, which have no
// `disabled` at all — a strict false failed every note click, not just greyed buttons.
const click=async el=>{assert.ok(el,'button exists');assert.notEqual(el.disabled,true,'button enabled');await act(async()=>el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
let config, observed;
try {
 await act(async()=>root.render(<Lobby onStart={c=>{config=c;}}/>));
 assert.equal(button('ENTER ARENA').disabled,true);
 await click(button('3P'));
 for(let i=1;i<=3;i++){
  await click(document.querySelector('.draft-portrait'));
  const picks=[...document.querySelectorAll('.draft-skill-pick')];
  await click(picks[0]);await click(picks[2]);
  assert.equal(picks[1].disabled,true,'a third ability cannot be selected');
  if(i===1){await click(document.querySelector('.draft-info-button'));assert.ok(document.querySelector('dialog[open]'));await click(button('GOT IT'));}
  await click(button(`LOCK IN PLAYER ${i}`));
 }
 assert.ok(document.body.textContent.includes('Your lineup is ready'));
 await click(button('ENTER ARENA'));
 assert.equal(config.spirits.length,3);
 assert.equal(new Set(config.spirits.map(s=>s.id)).size,3);
 assert.ok(config.spirits.every(s=>s.characterId==='cosmic_ronin'));
 assert.ok(config.spirits.every(s=>s.abilities.join(',')==='shukuchi,shadow_illusion'));
 config.beginnerMode=false;config.seed=4242;config.spirits=config.spirits.map(s=>({...s,cpu:false}));
 const [a,b]=config.spirits.map(s=>s.id);
 config.catchUp={log:[{action:noteSheetPatched(a,{tempSustain:1})},{action:noteSheetPatched(b,{shadowIllusion:{hex:45,facing:0,stepsLeft:5,stepsMax:5,turnsLeft:2}})}]};
 await act(async()=>root.render(<Game gameState={config} onReturnToLobby={()=>{}} onEngineState={s=>{observed=s;}}/>));
 assert.equal(document.querySelector('[aria-label="Skill upgrades, coming soon"]'),null,'🪦 no upgrade shop button (Db cut 2026-10-02)');
 assert.equal(document.querySelectorAll('[data-tip-anchor="ability-wallet"] .draft-info-button').length,2);
 await click(button('Continue to Melody'));
 const notes=[...document.querySelectorAll('[data-tip-anchor="note-stock"] svg')].map(svg=>svg.parentElement).filter(el=>el.style.cursor==='pointer');
 for(const el of notes.slice(0,3))await click(el);
 await click(button('Commit (3 notes'));
 const otherBefore=structuredClone(observed.noteStates[b]);
 await click(button('👤 Shadow'));
 assert.equal(observed.noteStates[a].dbPoints,undefined,'firing costs no currency — the cooldown is the gate');
 assert.equal(observed.noteStates[a].abilityCd.shadow_illusion,2);
 assert.ok(observed.noteStates[a].shadowIllusion);
 assert.deepEqual(observed.noteStates[b],otherBefore,'creating your shadow leaves the other Ronin’s shadow and wallet intact');
 assert.equal(observed.noteStates[b].shadowIllusion.hex,45);
 // 🪪 The Spirit window (2026-10-07) reads a cooldown as pips + "2 RND" at Alex's
 // dial-in (cdStyle 'pips'); the old wallet said "2 rounds". Read it off the window.
 assert.ok(document.querySelector('[data-tip-anchor="ability-wallet"]').textContent.includes('2 RND'),'the Spirit window shows the 2-round cooldown');
 assert.deepEqual(observed.noteStates[a].unlockedSkills,['shukuchi','shadow_illusion']);
 console.log('✅ Loadout UI: three duplicate Ronins, two-choice limit, info dialog, match launch, cooldown-only activation, independent shadows, no shop');
}finally{await act(async()=>root.unmount());dom.window.close();}
process.exit(0);
