import { sonicRig } from './sonicRig.js';
import { HEX_BY_NUM } from '../../board/hexMap.js';
import { angleTo } from '../../board/hexGeometry.js';
import { CHARGE_FLOOR_BONUS } from '../../data/gameConstants.js';
import { homeSpotlightDrive } from './spotlights.js';
import { throwPool } from './dicePool.js';

export function clashVerdict(diceVals, defenderDiceVals) {
  const atkTotal=diceVals.reduce((a,b)=>a+b,0),defTotal=defenderDiceVals.reduce((a,b)=>a+b,0);
  return {diceVals,defenderDiceVals,atkRoll:atkTotal,defRoll:defTotal,rawDefRoll:defTotal,
    atkTotal,defTotal,attackerWon:atkTotal>defTotal,tied:atkTotal===defTotal,
    margin:Math.abs(atkTotal-defTotal),damage:Math.abs(atkTotal-defTotal)};
}

/** The battle fields a Swing throw writes — shared by the roll and the reroll. */
export function swingThrowFields(atk, def, rigA = {}, rigD = {}) {
  const zeroIfFizzled=t=>t.fizzled?t.vals.map(()=>0):t.vals;
  return {
    dicePool:atk.pool,defenderDicePool:def.pool,atkStat:atk.pool.length,defStat:def.pool.length,
    ...clashVerdict(zeroIfFizzled(atk),zeroIfFizzled(def)),
    // The faces as thrown (a fizzled Eleven still SHOWS its dice; it scores 0).
    diceVals:atk.vals,defenderDiceVals:def.vals,
    rolledPool:rigA.pool??[...atk.pool,...atk.droppedPool],atkKeep:rigA.keep??atk.pool.length,
    defenderRolledPool:rigD.pool??[...def.pool,...def.droppedPool],defKeep:rigD.keep??def.pool.length,
    droppedDiceVals:atk.droppedVals,droppedDicePool:atk.droppedPool,
    defenderDroppedVals:def.droppedVals,defenderDroppedPool:def.droppedPool,
    elevenFizzled:atk.fizzled,
  };
}

export function rollSwingClash(state, action, rng) {
  const {attackerId,defenderId}=action;
  const a=state.spirits.find(s=>s.id===attackerId),d=state.spirits.find(s=>s.id===defenderId);
  const nsA=state.noteStates?.[attackerId]??{},nsD=state.noteStates?.[defenderId]??{};
  // 🔦 The ATTACKER's home light adds a die; the defender's does not — the
  // bonus is for attacking from there (Alex, 2026-09-25).
  const rigA=sonicRig(nsA,0,0,true,attackerId,homeSpotlightDrive(state,attackerId));
  const rigD=sonicRig(nsD,0,0,true,defenderId);
  const floor=ns=>Math.max((ns.chargeFloorTurns??0)>0?CHARGE_FLOOR_BONUS:0,ns.dieFloorBoost??0);
  // 🎲 Every die is thrown; each side keeps its seats' worth (dicePool.js). The
  // dropped dice ride along so the table can show them, dimmed.
  const atk=throwPool(rigA.pool,rigA.keep,rng,floor(nsA));
  const def=throwPool(rigD.pool,rigD.keep,rng,floor(nsD));
  return {...state,spirits:state.spirits.map(s=>{
    const other=s.id===attackerId?d:s.id===defenderId?a:null;
    return other&&HEX_BY_NUM[s.num]&&HEX_BY_NUM[other.num]
      ? {...s,facing:angleTo(HEX_BY_NUM[s.num],HEX_BY_NUM[other.num])}:s;
  }),battle:{kind:'attack',attackKind:'swing',swingClash:true,attackerId,defenderId,
    ...swingThrowFields(atk,def,rigA,rigD),
    atkFloor:floor(nsA),
    // 🔝 Spent from the TOP (Alex, 2026-09-27) — the chord steps down two rungs.
    swingChordLeft:(nsA.driveStack??[]).slice(0,-2),swingChordSpent:(nsA.driveStack??[]).slice(-2),rerolled:false}};
}
