import assert from 'node:assert/strict';
import { makeInitialState } from './state.js';
import { applyAction } from './reduce.js';
import { stageFxActivated, stageFxRoundTicked, turnStarted, spiritsSynced, spiritWarped, moveStep, damageApplied } from './actions.js';
import { abyssFpLoss } from './systems/crumbling.js';
import { knockback, runBattleFlow } from './systems/battleFlow.js';
import { snapshot, restore, replay } from './serialize.js';
import { HEX_BY_NUM } from '../board/hexMap.js';
import { straightNeighborInDirection } from '../board/hexGeometry.js';
import { STAGE_FX_IDS } from '../data/stageEffects.js';

let n = 0;
const eq = (a,b,msg) => { assert.deepEqual(a,b,msg); n++; };
const ok = (a,msg) => { assert.ok(a,msg); n++; };
const base = (seed=31) => makeInitialState({ spirits:[
  { id:'wildaxe', num:7, corner:'blue', facing:0, vibe:10, maxVibe:10 },
  { id:'vera', num:105, corner:'red', facing:3, vibe:8, maxVibe:10 },
], mode:'ffa', startingLives:3 }, seed);
const activate = st => applyAction(st, stageFxActivated('crumbling_stage', [], 3));
const vera = st => st.spirits.find(s => s.id==='vera');
eq([0,1,9,10,11,23,100].map(abyssFpLoss), [0,1,1,1,2,3,10], '10% whole FP rounds up and cannot go negative');
ok(!STAGE_FX_IDS.includes('crumbling_stage'), 'no invisible pits in the live deck before visual approval');

for (let seed=1; seed<=40; seed++) {
  let st = activate(base(seed));
  eq(st.stageFx.crumbling.hexes.length, 4, `${seed}: first round opens four holes`);
  ok(!st.stageFx.crumbling.hexes.some(h => [7,12,100,105,56].includes(h)), `${seed}: homes and Limelight remain intact`);
  const first = [...st.stageFx.crumbling.hexes];
  // A body and a rig must also stay safe on LATER rounds.
  st = { ...st, spirits:st.spirits.map(s => s.id==='vera' ? {...s,num:40} : s), amps:[{hexNum:41}] };
  st = applyAction(st, stageFxRoundTicked());
  eq(st.stageFx.crumbling.hexes.length, 8, `${seed}: round two has eight holes`);
  ok(first.every(h => st.stageFx.crumbling.hexes.includes(h)), `${seed}: old holes persist`);
  ok(!st.stageFx.crumbling.added.some(h => [40,41].includes(h)), `${seed}: collapse avoids current bodies and rigs`);
  st = applyAction(st, stageFxRoundTicked());
  eq(st.stageFx.crumbling.hexes.length, 12, `${seed}: third round has twelve holes`);
  eq(new Set(st.stageFx.crumbling.hexes).size, 12, `${seed}: no duplicate holes`);
  st = applyAction(st, stageFxRoundTicked());
  eq(st.stageFx.crumbling, null, `${seed}: stage repairs at show expiry`);
}

const lane = [HEX_BY_NUM[56]];
for(let i=0;i<5;i++) lane.push(straightNeighborInDirection(lane.at(-1),0));
ok(lane.every(Boolean), 'shove fixture lane exists');
function trap() {
  let st = activate(base());
  st = { ...st, stageFx:{...st.stageFx,crumbling:{...st.stageFx.crumbling,hexes:[lane[3].num]}},
    spirits:st.spirits.map(s => ({...s,num:s.id==='vera'?lane[1].num:lane[0].num})),
    noteStates:{...st.noteStates,vera:{...st.noteStates.vera,fame:23}} };
  return st;
}
{
  const initial=trap(), original=JSON.stringify(initial);
  const out=runBattleFlow(knockback({state:initial,fromId:'wildaxe',targetId:'vera',spaces:4,direction:0}),initial,{applyAction});
  let st=out.state;
  eq(out.result.path, [lane[2].num,lane[3].num], 'long shove stops at first hole, never crosses it');
  eq(out.result.fellIntoAbyss,true,'shove reports abyss interruption');
  eq(vera(st).num,null,'fallen Spirit is off the board');
  eq(vera(st).lives,3,'temporary abyss KO spends no life');
  eq(st.noteStates.vera.fame,20,'fall charges 3 of 23 FP');
  eq(st.turnQueue,initial.turnQueue,'fallen Spirit keeps its next turn');
  eq(JSON.stringify(initial),original,'input state is immutable');
  const twice=applyAction(st,spiritsSynced(st.spirits));
  eq(twice.noteStates.vera.fame,20,'duplicate entry does not charge twice');
  eq(vera(applyAction(st,spiritWarped('vera',lane[4].num))).num,null,'stale warp cannot bring the victim back early');
  eq(vera(applyAction(st,moveStep('vera',lane[4].num))).num,null,'stale walk cannot bring the victim back early');
  st=applyAction(st,turnStarted('wildaxe'));
  eq(vera(st).num,null,'another player starting a turn does not respawn the victim');
  // Expiring the effect must not erase a pending respawn.
  for(let i=0;i<3;i++) st=applyAction(st,stageFxRoundTicked());
  st=restore(snapshot(st));
  st=applyAction(st,turnStarted('vera'));
  eq(vera(st).num,105,'own next turn returns to starting hex even after show expiry');
  eq(vera(st).vibe,10,'respawn restores full Vibe');
  eq(vera(st).abyssPending,null,'pending fall clears');
  eq(st.noteStates.vera.fame,20,'respawn never charges again');
}
{
  let st=trap();
  const actions=[spiritWarped('vera',lane[3].num),turnStarted('wildaxe'),turnStarted('vera')];
  const live=actions.reduce((s,a)=>applyAction(s,a),st);
  eq(replay(st,actions),live,'action replay is identical, including FP and respawn');
  eq(live.noteStates.vera.fame,20,'landing by a warp also falls');
  st=applyAction(st,spiritsSynced(st.spirits.map(s=>s.id==='vera'?{...s,num:lane[2].num}:s)));
  st={...st,acting:'vera',turn:{...st.turn,moveStepsLeft:3}};
  st=applyAction(st,moveStep('vera',lane[3].num,false));
  eq(vera(st).num,null,'walking into a hole also falls');
  eq(st.turn.moveStepsLeft,0,'fall exhausts the active Spirit’s movement');
  eq(st.turn.actionTokenUsed,true,'fall exhausts the active Spirit’s action');
  const hit=applyAction(st,damageApplied('vera',3));
  eq(vera(hit).vibe,vera(st).vibe,'follow-up damage cannot hit a Spirit in the abyss');
}
console.log(`✅ crumblingCheck: ${n} assertions passed`);
