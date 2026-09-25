import { sonicRig } from './sonicRig.js';
import { HEX_BY_NUM } from '../../board/hexMap.js';
import { angleTo } from '../../board/hexGeometry.js';
import { CHARGE_FLOOR_BONUS } from '../../data/gameConstants.js';
import { homeSpotlightDrive } from './spotlights.js';

export function clashVerdict(diceVals, defenderDiceVals) {
  const atkTotal=diceVals.reduce((a,b)=>a+b,0),defTotal=defenderDiceVals.reduce((a,b)=>a+b,0);
  return {diceVals,defenderDiceVals,atkRoll:atkTotal,defRoll:defTotal,rawDefRoll:defTotal,
    atkTotal,defTotal,attackerWon:atkTotal>defTotal,tied:atkTotal===defTotal,
    margin:Math.abs(atkTotal-defTotal),damage:Math.abs(atkTotal-defTotal)};
}

export function rollSwingClash(state, action, rng) {
  const {attackerId,defenderId}=action;
  const a=state.spirits.find(s=>s.id===attackerId),d=state.spirits.find(s=>s.id===defenderId);
  const nsA=state.noteStates?.[attackerId]??{},nsD=state.noteStates?.[defenderId]??{};
  // 🔦 The ATTACKER's home light adds a die; the defender's does not — the
  // bonus is for attacking from there (Alex, 2026-09-25).
  const dicePool=sonicRig(nsA,0,0,true,attackerId,homeSpotlightDrive(state,attackerId)).pool;
  const defenderDicePool=sonicRig(nsD,0,0,true,defenderId).pool;
  const floor=ns=>Math.max((ns.chargeFloorTurns??0)>0?CHARGE_FLOOR_BONUS:0,ns.dieFloorBoost??0);
  const roll=(pool,ns)=>pool.map(s=>Math.min(s,Math.max(1+floor(ns),rng.int(s)+1)));
  return {...state,spirits:state.spirits.map(s=>{
    const other=s.id===attackerId?d:s.id===defenderId?a:null;
    return other&&HEX_BY_NUM[s.num]&&HEX_BY_NUM[other.num]
      ? {...s,facing:angleTo(HEX_BY_NUM[s.num],HEX_BY_NUM[other.num])}:s;
  }),battle:{kind:'attack',attackKind:'swing',swingClash:true,attackerId,defenderId,
    dicePool,defenderDicePool,atkStat:dicePool.length,defStat:defenderDicePool.length,
    atkFloor:floor(nsA),...clashVerdict(roll(dicePool,nsA),roll(defenderDicePool,nsD)),
    swingChordLeft:(nsA.driveStack??[]).slice(2),swingChordSpent:(nsA.driveStack??[]).slice(0,2),rerolled:false}};
}
