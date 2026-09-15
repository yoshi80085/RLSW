import * as THREE from 'three';
import { createSonicZigzagVisuals, FLIGHT_SECONDS, IMPACT_SECONDS } from './sonicZigzagVisuals.js';
import { SONIC_SEQUENCE, sonicShotStart, sonicSequenceDuration } from './sonicSequence.js';

// Freeze a packet's aim at launch; aim the next at the Rival's settled position.
export function createSonicSequenceVisuals(options) {
  const group=new THREE.Group();group.name='Sonic sequential volley';
  const records=new Map(),count=options.dice.length,duration=sonicSequenceDuration(count);
  let target=options.defenderPosition.clone(),cutoff=count,lastTime=-1;
  function localTime(age){
    return age<=SONIC_SEQUENCE.flight ? age*FLIGHT_SECONDS/SONIC_SEQUENCE.flight
      : FLIGHT_SECONDS+(age-SONIC_SEQUENCE.flight)*IMPACT_SECONDS/SONIC_SEQUENCE.settle;
  }
  function update(time,{defenderPosition=target,launchPosition=defenderPosition,interrupted=false,...view}={}) {
    // A knockout/relocation ends this volley; do not chase the fresh respawn.
    if(!interrupted)target=defenderPosition.clone();
    if(time<lastTime){for(const r of records.values())r.dispose();records.clear();group.clear();cutoff=count;}
    lastTime=time;
    const index=Math.max(0,Math.min(count-1,Math.floor(time/(SONIC_SEQUENCE.flight+SONIC_SEQUENCE.settle))));
    if(interrupted)cutoff=Math.min(cutoff,index+1);
    if(time>=0&&time<duration&&index<cutoff&&!records.has(index)){
      const r=createSonicZigzagVisuals({...options,defenderPosition:launchPosition,dice:[options.dice[index]],
        ampOrigins:options.ampOrigins?.length?[options.ampOrigins[index%options.ampOrigins.length]]:undefined});
      records.set(index,r);group.add(r.group);
    }
    for(const [i,r] of records){
      r.update(localTime(time-sonicShotStart(i)),view);
      const shield=r.group.getObjectByName('Sustain holds');
      if(shield)shield.position.copy(target).setY(target.y+.1);
      if(i<index){r.dispose();records.delete(i);}
    }
    group.visible=time>=0&&time<duration;
  }
  function getFocus(time,view){
    const index=Math.max(0,Math.min(count-1,Math.floor(time/(SONIC_SEQUENCE.flight+SONIC_SEQUENCE.settle))));
    const r=records.get(index)??[...records.values()].at(-1);
    const focus=r?.getFocus(localTime(time-sonicShotStart(index)),view);
    if(!focus)return null;
    const contactTarget=options.dice[index]?.passed?target:focus.target;
    // Hold beside the Rival between hits; no repeated zoom out to the amps.
    if(index>0)return {...focus,point:contactTarget.clone(),target:contactTarget.clone(),closeness:1};
    if(time>=SONIC_SEQUENCE.flight)return {...focus,point:contactTarget.clone(),target:contactTarget.clone()};
    return focus;
  }
  return {group,duration,update,getFocus,dispose(){for(const r of records.values())r.dispose();records.clear();group.removeFromParent();}};
}
