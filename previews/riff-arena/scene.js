import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createStandee } from '../../src/board/standee.js';
import { createArenaEnvironment, polishArenaModel } from '../../src/board/arenaEnvironment.js';
import { createRivenWorld } from '../../src/board/rivenWorld/index.js';
import { releaseArenaObject } from '../../src/board/arenaVisuals.js';
import { createDuelWaveforms, arenaAmpOrigins } from './waveforms.js';

export const COLORS=['#43dfff','#ff9955'];
export const SPIRITS={cosmic_ronin:['Shredding Ronin','cosmic_ronin.png'],
  Metalness_Monster:['Metalness Monster','Metalness_monster.png'],
  intergalactic_0:['Intergalactic 0','Intergalactic_0.png'],Glamarchy:['Glamarchy','Glamarchy.png']};
const v=(x,y,z)=>new THREE.Vector3(x,y,z);

export function createDuelScene(host,{onReady,onError}) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#030611');
  const camera=new THREE.PerspectiveCamera(44,1,.1,250);
  camera.position.set(0,7,20);camera.lookAt(0,2.4,0);
  const renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  host.appendChild(renderer.domElement);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.62,.5,.85);
  composer.addPass(bloom);composer.addPass(new OutputPass());
  const environment=createArenaEnvironment(scene,{classicScenery:false});
  const world=createRivenWorld(scene,camera);
  const effects=new THREE.Group();scene.add(effects);
  const actors=[];
  const centers=[v(-5,.2,0),v(5,.2,0)];
  let disposed=false,model=null,impact=null,energy=[0,0],ids='',emissives=[],lastFrame=0;
  const mat=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,
    depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const waveforms=createDuelWaveforms(effects,COLORS);
  const contactLight=new THREE.PointLight('#b7eaff',0,7);effects.add(contactLight);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.035,8,80),mat('#d5f9ff',0));effects.add(ring);
  const flash=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),mat('#ffffff',0));effects.add(flash);
  const size=()=>{const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);composer.setSize(w,h);};
  const observer=new ResizeObserver(size);observer.observe(host);size();
  new GLTFLoader().load(`${import.meta.env.BASE_URL}cosmic-arena/cosmic-arena.glb`,gltf=>{
    if(disposed){releaseArenaObject(gltf.scene);return;}
    try {model=gltf.scene;model.scale.z=-1;emissives=polishArenaModel(model);world.attachModel(model);scene.add(model);
      waveforms.setOrigins(arenaAmpOrigins(model));onReady?.();}
    catch(e){onError?.(e.message);}
  },undefined,e=>onError?.(`Arena could not load: ${e.message || 'reload to retry'}`));

  function setSpirits(config) {
    const key=`${config.attacker}/${config.defender}`;if(key===ids)return;ids=key;
    for(const a of actors){scene.remove(a.group);a.dispose();}actors.length=0;
    [config.attacker,config.defender].forEach((id,i)=>{
      const a=createStandee({id,color:COLORS[i],imageSrc:new URL(`../../src/standees/${SPIRITS[id][1]}`,import.meta.url).href});
      a.group.position.copy(centers[i]);a.group.scale.setScalar(1.18);
      // Staged three-quarter turn keeps both printed sheets readable in this study.
      a.group.rotation.y=i===0?Math.PI/3:-Math.PI/3;scene.add(a.group);actors.push(a);
    });
  }
  function project(p){const q=p.clone().project(camera);return {x:(q.x+1)*host.clientWidth/2,y:(1-q.y)*host.clientHeight/2};}
  return {
    setSpirits,
    reset(){energy=[0,0];impact=null;waveforms.reset();},
    hit(event){
      if(!event.result.hit)return;
      const side=event.run.side,weight={perfect:1,good:.7,ok:.45}[event.result.grade]??0;
      energy[side]+=weight;
    },
    finish(verdict,time){impact={side:verdict.attackerWon?0:1,tie:verdict.tie,born:time/1000};},
    frame(time,config,reduced=false){
      const t=time/1000,dt=Math.max(0,Math.min(.05,t-lastFrame));lastFrame=t;
      emissives.forEach(e=>{e.material.emissiveIntensity=e.base*config.boardGlow;});
      environment.update(t,{lite:true,reduced});world.update(t,{reduced});
      const total=energy[0]+energy[1],pressure=(energy[0]-energy[1])/Math.max(4,total);
      const shift=THREE.MathUtils.clamp(pressure*2.4,-2.1,2.1);
      const impactAge=impact?Math.max(0,t-impact.born):0;
      const travel=impact&&!impact.tie ? Math.min(1,impactAge/.8) : 0;
      const impactX=impact ? (impact.side===0?5:-5)*travel : 0;
      waveforms.update({time,energy,shift,scale:config.orb,spin:config.spin,growth:config.growth,flow:config.flow,glitter:config.glitter,impact,reduced,dt});
      contactLight.position.set(impact?impactX:shift,1.85,0);
      contactLight.intensity=energy.every(n=>n>0)&&(!impact||impactAge<1)?Math.min(9,total*.3):0;
      ring.position.set(impactX,1.85,0);flash.position.copy(ring.position);
      const burst=impact&&!impact.tie?Math.max(0,1-Math.abs(impactAge-.85)/.55):0;
      ring.material.opacity=burst*.8;ring.scale.setScalar(1+Math.max(0,impactAge-.6)*5);
      flash.material.opacity=reduced?0:burst*.3;flash.scale.setScalar(.4+burst*1.8);
      actors.forEach((a,i)=>{
        a.group.position.copy(centers[i]);
        const loses=impact&&!impact.tie&&i!==impact.side;
        if(loses){a.group.position.x+=(i===0?-1:1)*Math.min(1.1,Math.max(0,impactAge-.7)*2);a.group.rotation.z=(i===0?1:-1)*Math.sin(Math.min(1,Math.max(0,impactAge-.7))*Math.PI)*.22;}
        else a.group.rotation.z=0;
        a.frame(t,{reduced,cameraPos:camera.position});
      });
      composer.render();
      return centers.map(p=>({bridge:project(p.clone().add(v(0,3.05,0))),foot:project(p)}));
    },
    dispose(){disposed=true;observer.disconnect();waveforms.dispose();for(const a of actors){scene.remove(a.group);a.dispose();}
      environment.dispose();world.dispose();releaseArenaObject(scene);composer.passes.forEach(p=>p.dispose?.());composer.dispose();renderer.dispose();renderer.domElement.remove();},
  };
}
