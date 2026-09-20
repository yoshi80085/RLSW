export function SonicBarrageRecord({battle}) {
  if(battle?.sonicVersion!==2||!['sonic_reveal','sonic_volley','result'].includes(battle.phase))return null;
  const done=battle.phase==='result'&&(battle.sonicResolved||battle.remoteView);
  const shield=battle.shieldValue===0?'No shield':battle.shieldRemaining===0?'Shield broken':`Shield holds · ${battle.shieldRemaining} HP left`;
  return <div role="status" style={{position:'absolute',bottom:20,left:'50%',transform:'translateX(-50%)',zIndex:45,
    maxWidth:'90%',padding:'10px 18px',border:'1px solid #6688aa',borderRadius:10,background:'#07111eee',color:'#e8f6ff',textAlign:'center',pointerEvents:'none',fontSize:13}}>
    <div><span style={{color:'#ff8866'}}>Drive {battle.diceVals.join(' + ')} = {battle.atkTotal}</span>
      {' · '}<span style={{color:'#66bbff'}}>Sustain {battle.sustainRolls.join(' + ')||'0'} = {battle.shieldValue} HP</span></div>
    {done&&<strong>{shield} · {battle.strengthThrough} through · {battle.remoteView?`${battle.hitCount} penetrating rings`:`pushed ${battle.sonicPushed??0} hexes`}</strong>}
  </div>;
}
