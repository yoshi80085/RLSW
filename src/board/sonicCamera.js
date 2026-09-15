import * as THREE from 'three';
import { RING_CAMERA_ZOOM } from './sonicZigzagVisuals.js';
import { SONIC_PRESENTATION } from './sonicPresentation.js';

// Own only the scripted shot. Restore the exact orbit and control preferences
// after the aftermath, or immediately when reduced motion is requested.
export function createSonicCamera({ camera, controls, pointFor }) {
  let shot=null;
  const restore=()=>{
    camera.position.copy(shot.savedPosition);controls.target.copy(shot.savedTarget);
    controls.enabled=shot.enabled;controls.enableDamping=shot.damping;
    shot=null;camera.lookAt(controls.target);
  };
  function update(frame,model,dt,reduced=false) {
    const battle=frame.battle;
    if(!battle?.volley){
      if(!shot)return false;
      if(reduced){restore();return false;}
      if(!shot.returnFrom){shot.returnFrom=camera.position.clone();shot.returnTarget=controls.target.clone();shot.returnTime=0;}
      shot.returnTime+=dt;
      const p=Math.min(1,shot.returnTime/SONIC_PRESENTATION.return),ease=p*p*(3-2*p);
      camera.position.lerpVectors(shot.returnFrom,shot.savedPosition,ease);
      controls.target.lerpVectors(shot.returnTarget,shot.savedTarget,ease);
      camera.lookAt(controls.target);
      if(p===1){restore();return false;}
      return true;
    }
    if(!shot){
      const damping=controls.enableDamping;
      controls.enableDamping=false;controls.update(); // consume residual orbit motion once
      shot={savedPosition:camera.position.clone(),savedTarget:controls.target.clone(),enabled:controls.enabled,damping};
    }
    if(shot.key!==battle.key){shot.key=battle.key;shot.returnFrom=null;shot.contact=null;}
    controls.enabled=false;controls.enableDamping=false;
    if(reduced){camera.position.copy(shot.savedPosition);controls.target.copy(shot.savedTarget);camera.lookAt(controls.target);return true;}
    const a=frame.spirits?.find(s=>s.id===battle.attackerId),b=frame.spirits?.find(s=>s.id===battle.defenderId);
    const from=pointFor(a?.num,1),to=pointFor(b?.num,1);
    if(!from||!to)return true;
    // The result beat holds the actual final framing, never a new static box.
    if(battle.phase==='result'&&shot.contact){
      camera.position.copy(shot.contact.position);controls.target.copy(shot.contact.target);camera.lookAt(controls.target);return true;
    }
    const diceBeat=!['sonic_volley','result','sonic_aftermath'].includes(battle.phase);
    const back=from.clone().sub(to).setY(0).normalize();
    const across=new THREE.Vector3(-back.z,0,back.x);
    let target,reach,offset;
    if(diceBeat){
      // Include the true row width; a distant defender must not shrink the dice.
      target=from.clone().add(new THREE.Vector3(0,3.5,0));
      const width=Math.min(6,battle.dicePool.length)*1.5+1.7;
      reach=Math.max(9,width/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(.4,camera.aspect)));
      offset=back.clone().addScaledVector(across,.16).add(new THREE.Vector3(0,.3,0)).normalize();
    }else{
      const points=[from,to];
      for(const id of ({blue:['NW','W-N'],purple:['SW','W-S'],yellow:['NE','E-N'],red:['SE','E-S']}[a.corner]??[])){
        const amp=model?.getObjectByName(`Amp_${id}`);if(amp)points.push(amp.getWorldPosition(new THREE.Vector3()));
      }
      const box=new THREE.Box3().setFromPoints(points);target=box.getCenter(new THREE.Vector3());
      reach=Math.max(9,box.getSize(new THREE.Vector3()).length()*1.55);
      // A lane-side view shows rings and the barrier as separate surfaces.
      offset=across.clone().addScaledVector(back,.18).add(new THREE.Vector3(0,.52,0)).normalize();
      const focus=battle.focus;
      if(focus){
        const bite=focus.point.clone().lerp(focus.target,.45);
        target.lerp(bite,.4+focus.closeness*.58);
        reach=reach*(1-focus.closeness*RING_CAMERA_ZOOM);
      }
      if(battle.phase==='sonic_aftermath'){target.copy(to);reach=5;}
      // Same viewing clearance as the scratch bench: stay outside the flash.
      reach=5+reach;
    }
    reach*=Math.max(1,1/Math.max(.4,camera.aspect));
    const position=target.clone().addScaledVector(offset,reach);
    const blend=1-Math.exp(-Math.max(0,dt)*8);
    camera.position.lerp(position,blend);controls.target.lerp(target,blend);
    camera.lookAt(controls.target);camera.updateMatrixWorld();
    if(battle.phase==='sonic_volley')shot.contact={position:camera.position.clone(),target:controls.target.clone()};
    return true;
  }
  return {update,dispose(){if(shot)restore();},get active(){return !!shot;}};
}
