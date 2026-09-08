import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SCALE, SVG_W, SVG_H } from './constants.js';
import { preserveTacticalLayer, keepGameplayClicks } from './arenaDom.js';
import { createArenaEnvironment, polishArenaModel } from './arenaEnvironment.js';
import { arenaPoint, createArenaVisuals, releaseArenaObject } from './arenaVisuals.js';

// The SVG remains the only gameplay input surface. WebGL consumes a filtered,
// read-only presentation frame; neither camera nor effects can dispatch actions.
export function mountArena(host, tacticalElement, { onReady, onError, onQuality }) {
  const cleanups=[];
  let disposed=false,failed=false,raf=0,model=null,frame={},emissives=[];
  const dispose=()=>{
    if(disposed)return;disposed=true;globalThis.cancelAnimationFrame?.(raf);
    for(const cleanup of cleanups.reverse())cleanup();
  };
  try {
    const restoreLayer=preserveTacticalLayer(tacticalElement);
    cleanups.push(restoreLayer);
    const scene=new THREE.Scene();scene.background=new THREE.Color('#030611');
    const overlayScene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(43,1,.1,500);
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    cleanups.push(()=>{releaseArenaObject(scene);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.info.autoReset=false;
    host.appendChild(renderer.domElement);
    const overlay=new CSS3DRenderer();
    Object.assign(overlay.domElement.style,{position:'absolute',inset:'0'});host.appendChild(overlay.domElement);
    cleanups.push(()=>{restoreLayer();overlay.domElement.remove();});
    const plane=new CSS3DObject(tacticalElement);
    plane.scale.setScalar(1/(200*SCALE));plane.rotation.x=-Math.PI/2;
    plane.position.set((SVG_W/(2*SCALE)-3255)/200,.10,(SVG_H/(2*SCALE)-2415)/200);overlayScene.add(plane);
    const controls=new OrbitControls(camera,overlay.domElement);
    cleanups.push(()=>controls.dispose());cleanups.push(keepGameplayClicks(overlay.domElement));
    controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
    controls.touches={ONE:null,TWO:THREE.TOUCH.DOLLY_PAN};
    controls.minDistance=12;controls.maxDistance=110;controls.minPolarAngle=.08;controls.maxPolarAngle=Math.PI*.43;
    controls.enableDamping=true;controls.dampingFactor=.09;
    const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
    const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.396,.55,1.05);
    const output=new OutputPass();composer.addPass(bloom);composer.addPass(output);
    cleanups.push(()=>{bloom.dispose();output.dispose();composer.dispose();});
    const environment=createArenaEnvironment(scene);cleanups.push(()=>environment.dispose());
    const visuals=createArenaVisuals(scene);cleanups.push(()=>visuals.dispose());
    const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reduced=!!media?.matches,quality='auto',qualityLabel='',lite=false,autoLite=false,dirty=true,inView=true;
    let elapsed=0,last=performance.now(),lastDraw=0,sampleStart=last,samples=0,fps=0;
    const motion=()=>{reduced=!!media?.matches;controls.enableDamping=!reduced;dirty=true;};motion();
    media?.addEventListener?.('change',motion);cleanups.push(()=>media?.removeEventListener?.('change',motion));
    const fit=aspect=>Math.max(1,(SVG_W/SVG_H)/aspect);
    function resize() {
      const {width,height}=host.getBoundingClientRect();if(!width||!height)return;
      const aspect=width/height;
      camera.position.sub(controls.target).multiplyScalar(fit(aspect)/fit(camera.aspect)).add(controls.target);
      camera.aspect=aspect;camera.updateProjectionMatrix();
      renderer.setSize(width,height);composer.setSize(width,height);overlay.setSize(width,height);dirty=true;
    }
    function applyQuality() {
      const next=quality==='standard'||(quality==='auto'&&(autoLite||!!frame.lite));
      const label=quality==='auto'?`Auto: ${next?'Standard':'High'}${frame.lite?' · Lite FX':autoLite?' · performance':''}`:next?'Standard · all scenery':'High · full effects';
      if(label!==qualityLabel){qualityLabel=label;onQuality?.(label);}
      if(next===lite)return;lite=next;bloom.enabled=!lite;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,lite?1:1.5));
      composer.setPixelRatio(renderer.getPixelRatio());resize();
    }
    const change=()=>{dirty=true;};controls.addEventListener('change',change);
    const observer=new ResizeObserver(resize);observer.observe(host);cleanups.push(()=>observer.disconnect());
    if(typeof IntersectionObserver!=='undefined') {
      const visibility=new IntersectionObserver(entries=>{inView=entries[0]?.isIntersecting??true;dirty=true;});
      visibility.observe(host);cleanups.push(()=>visibility.disconnect());
    }
    function view(name) {
      const point=name==='focus'?arenaPoint(frame.spirits?.find(s=>s.id===frame.actingId)?.num):null;
      controls.target.copy(point??new THREE.Vector3(name==='arena'?1:0,name==='arena'?-2.8:0,0));
      const distance=(point?18:35)*fit(Math.max(camera.aspect,.25));
      if(name==='arena')camera.position.set(27,20.8,37).multiplyScalar(fit(Math.max(camera.aspect,.25))).add(controls.target);
      else camera.position.set(0,distance*.94,distance*.34).add(controls.target);
      controls.update();dirty=true;
    }
    function render(now) {
      if(disposed||failed)return;
      raf=requestAnimationFrame(render);
      const dt=Math.min((now-last)/1000,.05);last=now;
      if(document.hidden||!inView)return;
      elapsed+=dt;controls.update();
      const moving=visuals.diagnostics().effects>0;
      if(reduced&&!dirty&&!moving)return;
      if(now-lastDraw<(lite?1000/30:1000/60)-1)return;
      lastDraw=now;
      try {
        environment.update(elapsed,{lite,reduced,spotlight:arenaPoint(frame.spotlight)});
        visuals.tick(elapsed,reduced);
        for(const e of emissives)if(e.crack)e.material.emissiveIntensity=e.base*(reduced?1:1+.08*Math.sin(elapsed*.75));
        renderer.info.reset();composer.render();overlay.render(overlayScene,camera);dirty=false;
        samples++;
        if(now-sampleStart>2500) {
          fps=Math.round(samples*1000/(now-sampleStart));samples=0;sampleStart=now;
          // Downgrade once, never oscillate or auto-upgrade during a match.
          if(quality==='auto'&&!lite&&!reduced&&fps<35&&elapsed>5){autoLite=true;applyQuality();}
          host.dataset.arenaFps=String(fps);host.dataset.arenaQuality=lite?'standard':'high';
          const stats=visuals.diagnostics();host.dataset.arenaCabinets=String(stats.liveCabinets);
          host.dataset.arenaEffects=String(stats.effects);host.dataset.arenaHazards=String(stats.hazards);
          host.dataset.arenaDrawCalls=String(renderer.info.render.calls);
        }
      } catch(error) {failed=true;cancelAnimationFrame(raf);console.error('Arena rendering stopped',error);onError();}
    }
    const visible=()=>{last=performance.now();sampleStart=last;samples=0;dirty=true;};
    document.addEventListener('visibilitychange',visible);cleanups.push(()=>document.removeEventListener('visibilitychange',visible));
    const lost=event=>{event.preventDefault();failed=true;cancelAnimationFrame(raf);onError();};
    renderer.domElement.addEventListener('webglcontextlost',lost);cleanups.push(()=>renderer.domElement.removeEventListener('webglcontextlost',lost));
    resize();view('arena');raf=requestAnimationFrame(render);
    new GLTFLoader().load(`${import.meta.env.BASE_URL}cosmic-arena/cosmic-arena.glb`,gltf=>{
      if(disposed){releaseArenaObject(gltf.scene);return;}
      try {
        model=gltf.scene;model.scale.z=-1;emissives=polishArenaModel(model);
        scene.add(model);visuals.attachModel(model);visuals.update(frame);dirty=true;onReady();
      }catch(error){console.error('Arena model setup failed',error);onError();}
    },undefined,()=>{if(!disposed)onError();});
    return {
      view,dispose,
      update(next){if(disposed||failed)return;frame=next??{};applyQuality();visuals.update(frame);dirty=true;},
      quality(value){if(value===quality)return;quality=value;autoLite=false;applyQuality();dirty=true;},
      zoom(factor){camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();dirty=true;},
    };
  } catch(error) {dispose();throw error;}
}
