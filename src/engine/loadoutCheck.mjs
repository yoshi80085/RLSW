import assert from 'node:assert/strict';
import { makeInitialState } from './state.js';
import { SPIRIT_DEFS } from '../data/spirits.js';
import { seatSpirit } from '../data/matchSetup.js';
import { seatId, characterId } from '../data/spiritIdentity.js';
import { validLoadout } from '../data/loadouts.js';
import { SKILL_BY_ID } from '../data/skillTree.js';
import { canFire, firePatch, cooldownLeft, ABILITY_CD } from './systems/cooldowns.js';
import { startTurnNotes } from './systems/turnFlow.js';
import { legalActions } from './policies/legalActions.js';
import { applyBotAction } from './policies/transition.js';
import { commitMelodyEconomy } from './systems/melodyCommit.js';
import { canCallEleven, applyElevenCalled } from './systems/eleven.js';
import { canCallSlime } from './systems/slime.js';
import { arenaFrame } from '../board/arenaFrame.js';

const roster = ['blue','purple','red'].map((corner,i)=>({
  ...seatSpirit(SPIRIT_DEFS.cosmic_ronin,corner),id:seatId('cosmic_ronin',corner),
  abilities:i===1?['shadow_illusion','cursed_shamisen']:['shukuchi','psycho_bushido'],
}));
let state=makeInitialState({spirits:roster,mode:'ffa'},42);
const [a,b,c]=roster.map(s=>s.id);
assert.equal(Object.keys(state.noteStates).length,3);
assert.equal(new Set(state.turnQueue).size,3);
for(const id of [a,b,c]) {
  assert.equal(characterId(id),'cosmic_ronin');
  assert.equal(state.noteStates[id].noteStock.length,11,'every Ronin keeps the innate stock size');
  assert.equal(state.noteStates[id].scaleMode,'hirajoshi');
  assert.equal(state.noteStates[id].unlockedSkills.length,2);
  assert.equal(state.noteStates[id].dbPoints,undefined,'🪦 there is no Db on the sheet (cut 2026-10-02)');
  assert.equal(cooldownLeft(state.noteStates[id],'shukuchi'),0,'ready at match start');
}
assert.deepEqual(state.noteStates[b].unlockedSkills,['shadow_illusion','cursed_shamisen']);
assert.equal(validLoadout('cosmic_ronin',['shukuchi','shukuchi']),false);
assert.equal(validLoadout('cosmic_ronin',['shukuchi','displace']),false);
assert.throws(()=>makeInitialState({spirits:[roster[0],roster[0]]},42),/unique/);
assert.throws(()=>makeInitialState({spirits:[{...roster[0],abilities:['shukuchi']}]},42),/Invalid/);
assert.equal(SKILL_BY_ID.sunbeam,undefined);assert.equal(SKILL_BY_ID.azrael,undefined);
for(const id of Object.keys(SKILL_BY_ID)) {
  assert.equal(ABILITY_CD[id],2);
  const ns={unlockedSkills:[id]};
  assert.equal(canFire(ns,id),true,`${id} fires with nothing in hand — the cooldown is the gate, not a currency`);
  const fired={...ns,...firePatch(ns,id)};
  assert.equal(fired.dbPoints,undefined,'firing charges no currency');assert.equal(canFire(fired,id),false);
  const first={...startTurnNotes(fired).patch};
  assert.equal(first.abilityCd[id],1);
  const second=startTurnNotes({...fired,...first}).patch;
  assert.equal(second.abilityCd[id],0);
}
assert.equal(canFire({unlockedSkills:[]},'shukuchi'),false,'an ability outside the kit never fires');
state.acting=a;state.turn.moveStepsLeft=5;
state.noteStates[a]={...state.noteStates[a],hasConfirmed:true};
const before=structuredClone(state.noteStates[b]);
const hop=legalActions(state,a).find(x=>x.kind==='shukuchi');assert.ok(hop);
state=applyBotAction(state,hop).state;
assert.equal(state.noteStates[a].abilityCd.shukuchi,2);
assert.deepEqual(state.noteStates[b],before,'one Ronin cannot start another Ronin’s cooldown');
const again=legalActions(state,a).find(x=>x.kind==='shukuchi');assert.ok(again);
state=applyBotAction(state,again).state;assert.equal(state.noteStates[a].abilityCd.shukuchi,2,'continuation hops do not restart the clock');
assert.equal(legalActions(state,a,{skillById:SKILL_BY_ID}).some(x=>x.kind==='skillTarget'),false);
assert.equal(applyBotAction(state,{kind:'skillTarget',skillId:'shadow_illusion'}).ok,false);
state.noteStates[a]={...state.noteStates[a],melodyLine:['C','D','E'],rootNote:'C'};
const result=commitMelodyEconomy(state,a,{view:{}});
assert.equal(result.patch.dbPoints,undefined,'🪦 a melody commit pays no Db — there is none');
assert.equal(result.report.awardedSkillId,undefined,'…and awards nothing');
assert.equal(result.patch.unlockedSkills,undefined,'a commit cannot change the selected loadout');
const monster=seatId('Metalness_Monster','blue');
assert.ok(canCallSlime(monster));
let ms={noteStates:{[monster]:{unlockedSkills:['goes_to_11'],sustainStack:['C','E']}}};
assert.ok(canCallEleven(ms,monster));ms=applyElevenCalled(ms,{spiritId:monster});
assert.equal(ms.noteStates[monster].dbPoints,undefined);assert.equal(ms.noteStates[monster].abilityCd.goes_to_11,2);
assert.equal(canCallEleven(ms,monster),false);
const frame=arenaFrame({spirits:roster,shadowDecoys:[{...roster[0],num:33},{...roster[1],num:34}],vortices:[{hex:1},{hex:2}]});
assert.equal(frame.decoys.length,2);assert.notEqual(frame.decoys[0].id,frame.decoys[1].id);assert.equal(frame.vortices.length,2);
console.log('✅ Loadouts: duplicate seats, all ability cooldowns, no Db, retired skills, fixed kits, and independent effects');
