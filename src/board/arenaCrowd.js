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
      const options={corner,color:crowd?.color??'#8a91ff',size:1.3,
        diehards:Math.max(0,Math.floor(crowd?.diehards??0)),casuals:Math.max(0,Math.floor(crowd?.casuals??0)),style:FAN_STYLES[characterId(crowd?.id)]??null};
      const key=JSON.stringify(options),previous=stands.get(corner);
      if(previous?.key===key){previous.owner=crowd?.id;continue;}
      if(previous)disposeGrandstand(previous);
      const stand=makeGrandstand(options);stand.key=key;stand.owner=crowd?.id;group.add(stand.group);stands.set(corner,stand);
    }
  }
  update();
  return {group,update,
    tick(time,options){for(const stand of stands.values())stand.tick(time,options);},
    speaker(id){if(!group.visible)return null;const stand=[...stands.values()].find(s=>s.owner===id);if(!stand)return null;group.updateWorldMatrix(true,true);return stand.speaker()??stand.group.localToWorld(new THREE.Vector3(0,.5,0));},
    get count(){return [...stands.values()].reduce((sum,s)=>sum+s.fans.length,0);},
    dispose(){for(const stand of stands.values())disposeGrandstand(stand);stands.clear();group.removeFromParent();},
  };
}
