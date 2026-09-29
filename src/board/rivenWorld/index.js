import * as THREE from 'three';
import { createFormation, disposeObject } from './formation.js';
import { createDriftingDebris } from './debris.js';
import { createNebula, updateNebulaFlashes } from './nebula.js';
import { createLightning } from './lightning.js';

// Approved Riven World dial-in, 2026-09-29. Game settings never read preview storage.
export const RIVEN_WORLD = Object.freeze({
  depth:13.5, fracture:1.5, brightness:2.1, branches:9, interval:6.5,
  duration:1.6, nebula:.8, debris:1.5, bloom:.54, breath:.13,
  breathPeriod:12, cloudMotion:1.25, debrisDrift:1.05,
  rockBrightness:.85, rockColor:'#263a60', puffiness:1,
  lightningSoftness:1, creviceFollow:1, planetDistance:2.3, ampBrightness:.55,
  nebulaFlashStrength:1, nebulaFlashInterval:42,
});

export function createRivenWorld(scene, camera) {
  const root=new THREE.Group();root.name='Riven World';root.visible=false;scene.add(root);
  const formation=createFormation(RIVEN_WORLD),nebula=createNebula(),debris=createDriftingDebris();
  formation.material.color.set(RIVEN_WORLD.rockColor).multiplyScalar(RIVEN_WORLD.rockBrightness);
  root.add(formation,nebula,debris.group);
  const storm=createLightning(root,()=>formation,()=>RIVEN_WORLD,camera);
  let island=null,islandVisible=true,lastTime=null,time=0,cloudTime=0,disposed=false;
  const uniforms=nebula.material.uniforms;
  uniforms.intensity.value=RIVEN_WORLD.nebula;
  uniforms.breath.value=RIVEN_WORLD.breath;
  uniforms.breathPeriod.value=RIVEN_WORLD.breathPeriod;
  uniforms.puffiness.value=RIVEN_WORLD.puffiness;
  return {
    formation,
    attachModel(model) {
      if(disposed||island)return;
      island=model.getObjectByName('Island');
      if(!island)throw new Error('Riven World requires the arena Island group');
      islandVisible=island.visible;island.visible=false;root.visible=true;
    },
    update(elapsed,{reduced=false}={}) {
      if(disposed)return;
      // The renderer can skip hidden/offscreen frames; resume without a scenery jump.
      const dt=lastTime===null?0:Math.min(.1,Math.max(0,elapsed-lastTime));lastTime=elapsed;
      if(!island)return;
      if(!reduced){time+=dt;cloudTime+=dt*RIVEN_WORLD.cloudMotion;}
      uniforms.time.value=time;uniforms.cloudTime.value=cloudTime;
      uniforms.breath.value=reduced?0:RIVEN_WORLD.breath;
      updateNebulaFlashes(nebula,time,{reduced,strength:RIVEN_WORLD.nebulaFlashStrength,interval:RIVEN_WORLD.nebulaFlashInterval});
      debris.update(dt,{amount:RIVEN_WORLD.debris,speed:RIVEN_WORLD.debrisDrift,
        reduced,brightness:RIVEN_WORLD.rockBrightness,color:RIVEN_WORLD.rockColor});
      storm.update(time,reduced);
    },
    dispose() {
      if(disposed)return;disposed=true;
      storm.dispose();disposeObject(root);
      if(island)island.visible=islandVisible;
    },
  };
}
