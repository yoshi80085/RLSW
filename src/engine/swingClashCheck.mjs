import assert from 'node:assert/strict';
import { makeInitialState } from './state.js';
import { makeRng } from './rng.js';
import { applyAction } from './reduce.js';
import { attackRolled, attackRerolled } from './actions.js';
import { clashVerdict } from './systems/swingClash.js';
import { battleConsequences, runBattleFlow, vibeDamage } from './systems/battleFlow.js';
import { startTurnNotes } from './systems/turnFlow.js';
import { spiritChord } from './systems/attackParams.js';
import { HEX_BY_NUM } from '../board/hexMap.js';
import { neighborInDirection, angleTo } from '../board/hexGeometry.js';
import { knockbackWobble, createClashFigure } from '../board/swingClashVisuals.js';

const ids=['cosmic_ronin','intergalactic_0'];
const a=HEX_BY_NUM[40],b=neighborInDirection(a,0);
const config={mode:'ffa',startingLives:3,elimination:'off',spirits:ids.map((id,i)=>({id,name:id,num:i?b.num:a.num,facing:0,vibe:30,maxVibe:30,cpu:false}))};
const fresh=()=>makeInitialState(config,44);
const run=(state,battle)=>runBattleFlow(battleConsequences({state,battle,chordOf:spiritChord}),state,{applyAction:(s,a)=>applyAction(s,a,makeRng(42))});
const frozen=(av,dv)=>({kind:'attack',attackKind:'swing',swingClash:true,attackerId:ids[0],defenderId:ids[1],...clashVerdict(av,dv)});
for(const [av,dv,loser,damage] of [[[6,6],[4,4],1,4],[[4,4],[6,6],0,4],[[4],[4],null,0]]){
  const state=fresh(),out=run(state,frozen(av,dv));
  for(let i=0;i<2;i++)assert.equal(out.state.spirits[i].vibe,30-(i===loser?damage:0));
  if(loser!==null){assert.equal(out.state.spirits[loser].hitBackCount,1);assert.notEqual(out.state.spirits[loser].num,state.spirits[loser].num);}
  else assert.deepEqual(out.state.spirits,state.spirits);
  assert.deepEqual(out.state.noteStates[ids[1]].sustainStack,state.noteStates[ids[1]].sustainStack);
}
let state=fresh();
const action=attackRolled('swing',...ids,{atkStat:999,defStat:999,posing:true});
const rolled=applyAction(state,action,makeRng(10));
assert.equal(rolled.battle.atkTotal,rolled.battle.diceVals.reduce((a,b)=>a+b,0));
assert.equal(rolled.battle.defTotal,rolled.battle.defenderDiceVals.reduce((a,b)=>a+b,0));
assert.ok(rolled.battle.defenderDiceVals.length>0,'posing still clashes');
assert.equal(rolled.spirits[1].facing,angleTo(b,a));
const rerolled=applyAction(rolled,attackRerolled(),makeRng(90));
assert.deepEqual(rerolled.battle.defenderDiceVals,rolled.battle.defenderDiceVals);
assert.equal(rerolled.battle.damage,Math.abs(rerolled.battle.atkTotal-rerolled.battle.defTotal));
assert.deepEqual(applyAction(state,action,makeRng(10)),rolled,'seeded repeatability');
state={...state,noteStates:{...state.noteStates,[ids[1]]:{...state.noteStates[ids[1]],driveStack:[],sustainStack:['C','E','G']}}};
assert.equal(applyAction(state,action,makeRng(10)).battle.defTotal,0,'Sustain contributes nothing');
const down=runBattleFlow(vibeDamage({state,targetId:ids[0],dmg:30}),state,{applyAction:(s,a)=>applyAction(s,a,makeRng(1))}).state;
assert.equal(down.noteStates[ids[0]].fallen,true);
const recovered=startTurnNotes(down.noteStates[ids[0]],{spiritId:ids[0]});
assert.equal(recovered.patch.fallen,false);assert.equal(recovered.report.recoveryPaid,2);
assert.equal(recovered.patch.usedStockIdx.length,2);
assert.ok(knockbackWobble(1,10)>knockbackWobble(9,10));
for(const pose of [false,true]){const figure=createClashFigure('#ff7755',pose);assert.ok(figure.children.length<15);figure.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
console.log('Swing clash: symmetric damage, ties, single-hex push, Drive-only defence, facing, rerolls, determinism, falling, recovery and wobble passed.');
