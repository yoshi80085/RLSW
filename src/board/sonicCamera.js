import * as THREE from 'three';
import { RING_CAMERA_ZOOM } from './sonicZigzagVisuals.js';
import { SONIC_PRESENTATION } from './sonicPresentation.js';

// Own only the scripted shot. Restore the exact orbit and control preferences
// after the aftermath, or immediately when reduced motion is requested.
export function createSonicCamera({ camera, controls, pointFor }) {
  let shot=null,automatic=true;
  const manual=()=>{if(shot){shot.manual=true;shot.returnFrom=null;controls.enableDamping=shot.damping;}};
  const fitPoints=(points,offset,pad=1.4)=>{
    const target=new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
    const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),offset).normalize();
    const up=new THREE.Vector3().crossVectors(offset,right).normalize();
    const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*Math.max(.25,camera.aspect);
    let reach=7;
    for(const p of points){const d=p.clone().sub(target),depth=d.dot(offset);
      reach=Math.max(reach,depth+(Math.abs(d.dot(right))+pad)/tanH,depth+(Math.abs(d.dot(up))+pad)/tanV);}
    return {target,reach};
  };
  const restore=()=>{
    if(!shot.manual){camera.position.copy(shot.savedPosition);controls.target.copy(shot.savedTarget);}
    controls.enabled=shot.enabled;controls.enableDamping=shot.damping;
    shot=null;camera.lookAt(controls.target);
  };
  function update(frame,model,dt,reduced=false) {
    const battle=frame.battle;
    if(!battle?.volley&&!battle?.swingClash){
      if(!shot)return false;
      if(reduced||shot.manual||!automatic){restore();return false;}
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
      shot={savedPosition:camera.position.clone(),savedTarget:controls.target.clone(),enabled:controls.enabled,damping,manual:!automatic};
    }
    if(shot.key!==battle.key){shot.key=battle.key;shot.returnFrom=null;shot.contact=null;}
    controls.enabled=shot.enabled;
    if(shot.manual||!automatic||reduced){controls.enableDamping=reduced?false:shot.damping;controls.update();return true;}
    controls.enableDamping=false;
    const a=frame.spirits?.find(s=>s.id===battle.attackerId),b=frame.spirits?.find(s=>s.id===battle.defenderId);
    const from=pointFor(a?.num,1),to=pointFor(b?.num,1);
    if(!from||!to)return true;
    if(battle.swingClash){
      const focus=battle.swingFocus;
      const points=focus?.points??[from,to,from.clone().setY(3.7),to.clone().setY(3.7)];
      const offset=focus?.kind==='face'?focus.direction.clone().add(new THREE.Vector3(.15,.2,.1)).normalize():new THREE.Vector3(.12,1,.7).normalize();
      const fit=focus?.kind==='face'?{target:focus.point,reach:Math.max(2.3,1.8/Math.max(.4,camera.aspect))}:fitPoints(points,offset,focus?.kind==='result'?.55:1);
      if(focus?.kind==='result')fit.reach=Math.max(4,fit.reach*.88);
      const blend=1-Math.exp(-dt*5);
      controls.target.lerp(fit.target,blend);camera.position.lerp(fit.target.clone().addScaledVector(offset,fit.reach),blend);
      camera.lookAt(controls.target);return true;
    }
    // The result beat holds the actual final framing, never a new static box.
    if(battle.phase==='result'&&shot.contact){
      camera.position.copy(shot.contact.position);controls.target.copy(shot.contact.target);camera.lookAt(controls.target);return true;
    }
    const diceBeat=!['sonic_volley','result','sonic_aftermath'].includes(battle.phase);
    const back=from.clone().sub(to).setY(0).normalize();
    const across=new THREE.Vector3(-back.z,0,back.x);
    let target,reach,offset,composition=null;
    if(diceBeat){
      // Include the true row width; a distant defender must not shrink the dice.
      target=battle.sonicVersion===2 ? (battle.diceFocus?.clone()??from.clone()) : from.clone().add(new THREE.Vector3(0,3.5,0));
      const width=Math.min(6,battle.dicePool.length)*1.5+1.7;
      reach=Math.max(9,width/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(.4,camera.aspect)));
      offset=back.clone().addScaledVector(across,.16).add(new THREE.Vector3(0,.3,0)).normalize();
      if(battle.sonicVersion===2){
        offset=new THREE.Vector3(0,1,.65).normalize();
        const actors=[from,to,from.clone().add(new THREE.Vector3(0,2,0)),to.clone().add(new THREE.Vector3(0,2,0))];
        const dicePoints=battle.diceBounds??[target];
        composition=fitPoints([...actors,...dicePoints],offset,1);
      }
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
      if(focus?.barrage){
        const actors=[from,to,from.clone().add(new THREE.Vector3(0,2,0)),to.clone().add(new THREE.Vector3(0,2,0))];
        if(focus.time<.45){
          composition=fitPoints([...(focus.ampOrigins??[]),from,focus.point],offset,1.8);
        }else if(focus.time<2.05){
          // Track every airborne ring's real position, rather than cutting ahead to the Rival.
          composition=fitPoints([...(focus.projectiles??[focus.point]),focus.point.clone().lerp(focus.target,.2)],offset,2);
        }else{
          composition=fitPoints([to,to.clone().add(new THREE.Vector3(0,2,0)),focus.target,...(focus.projectiles??[])],offset,1.8);
        }
        if(focus.aftermath)composition=fitPoints(actors,offset,2);
      }
      if(battle.phase==='sonic_aftermath'){target.copy(to);reach=5;}
      // Same viewing clearance as the scratch bench: stay outside the flash.
      reach=5+reach;
    }
    reach*=Math.max(1,1/Math.max(.4,camera.aspect));
    if(composition){target=composition.target;reach=composition.reach;}
    const position=target.clone().addScaledVector(offset,reach);
    const blend=1-Math.exp(-Math.max(0,dt)*8);
    camera.position.lerp(position,blend);controls.target.lerp(target,blend);
    camera.lookAt(controls.target);camera.updateMatrixWorld();
    if(battle.phase==='sonic_volley')shot.contact={position:camera.position.clone(),target:controls.target.clone()};
    return true;
  }
  return {update,userStart:manual,userNudge:manual,
    autoCamera(on){automatic=!!on;if(shot){shot.manual=!automatic;shot.contact=null;}},
    dispose(){if(shot)restore();},get active(){return !!shot;},get manual(){return !!shot&&(shot.manual||!automatic);}};
}
