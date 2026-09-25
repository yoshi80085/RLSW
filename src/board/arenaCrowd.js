import { characterId } from "../data/spiritIdentity.js";
import * as THREE from 'three';
import {makeGrandstand,disposeGrandstand} from './cosmicFans.js';

export const FAN_STYLES={cosmic_ronin:'ronin',intergalactic_0:'intergalactic',Metalness_Monster:'monster'};
const CORNERS=['blue','purple','yellow','red'];

export function createArenaCrowd(scene){
  const group=new THREE.Group();group.name='Seated cosmic fans';scene.add(group);
  const stands=new Map();
  function update(crowds=[]){
    for(const corner of CORNERS){
      const crowd=crowds.find(c=>c.corner===corner);
      // 📌 `seedOffset` per corner (2026-09-22): the fan seed used to be the seat
      // index alone, so every stand was the same crowd fan-for-fan.
      const options={corner,color:crowd?.color??'#8a91ff',seedOffset:CORNERS.indexOf(corner)*37,
        diehards:Math.max(0,Math.floor(crowd?.diehards??0)),casuals:Math.max(0,Math.floor(crowd?.casuals??0)),style:FAN_STYLES[characterId(crowd?.id)]??null};
      // ⚠️ THE KEY HOLDS THE FAN COUNTS, SO EVERY FAN GAIN REBUILDS THE STAND —
      // ~20 fresh 555-vertex bodies at the exact moment the game wants a crowd
      // reaction, and the fans pop rather than arrive. Known and NOT fixed here;
      // it wants a build-to-capacity-and-toggle pass with an arrival animation.
      // 🔎 It matters more now that Diehards are uncapped: the counts move more.
      const key=JSON.stringify(options),previous=stands.get(corner);
      if(previous?.key===key){previous.owner=crowd?.id;continue;}
      if(previous)disposeGrandstand(previous);
      const stand=makeGrandstand(options);stand.key=key;stand.owner=crowd?.id;group.add(stand.group);stands.set(corner,stand);
    }
  }
  update();
  return {group,update,
    tick(time,options){for(const stand of stands.values())stand.tick(time,options);},
    /** A bout's reaction: `winnerId`'s stand jumps, `loserId`'s sags, or both bounce on a tie. */
    react(time,{winnerId=null,loserId=null,tie=false,amount=1}={},options={}){
      for(const stand of stands.values()){
        const mood=tie?.35:stand.owner&&stand.owner===winnerId?1:stand.owner&&stand.owner===loserId?-1:0;
        stand.react(time,mood,amount,options);
      }
    },
    speaker(id){if(!group.visible)return null;const stand=[...stands.values()].find(s=>s.owner===id);if(!stand)return null;group.updateWorldMatrix(true,true);return stand.speaker()??stand.group.localToWorld(new THREE.Vector3(0,.5,0));},
    get count(){return [...stands.values()].reduce((sum,s)=>sum+s.fans.length,0);},
    dispose(){for(const stand of stands.values())disposeGrandstand(stand);stands.clear();group.removeFromParent();},
  };
}
