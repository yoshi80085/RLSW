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
import { arenaPoint, pointXY, createArenaVisuals, releaseArenaObject } from './arenaVisuals.js';
import { createSonicCamera } from './sonicCamera.js';
import { createArenaCrowd } from './arenaCrowd.js';
import { CAMERA_DIRECTOR, createCameraDirector, createCameraSubjects } from './cameraDirector.js';

// The SVG remains the only gameplay input surface. WebGL consumes a filtered,
// read-only presentation frame; neither camera nor effects can dispatch actions.
export function mountArena(host, tacticalElement, { onReady, onError, onQuality, onCamera }) {
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
    const foregroundScene=new THREE.Scene();
    foregroundScene.add(new THREE.HemisphereLight(0xddeaff,0x34314f,2.5));
    const actorLight=new THREE.DirectionalLight(0xffffff,2);actorLight.position.set(5,12,7);foregroundScene.add(actorLight);
    const camera=new THREE.PerspectiveCamera(43,1,.1,500);
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    cleanups.push(()=>{releaseArenaObject(scene);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.info.autoReset=false;
    host.appendChild(renderer.domElement);
    const overlay=new CSS3DRenderer();
    Object.assign(overlay.domElement.style,{position:'absolute',inset:'0',zIndex:'1'});host.appendChild(overlay.domElement);
    // CSS3D is a DOM layer: WebGL renderOrder cannot draw across it. A tiny
    // transparent actor pass above it keeps standees solid without blocking taps.
    const foreground=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
    foreground.setClearColor(0x000000,0);foreground.toneMapping=renderer.toneMapping;
    foreground.outputColorSpace=THREE.SRGBColorSpace;
    foreground.domElement.dataset.arenaForeground='spirits';
    Object.assign(foreground.domElement.style,{position:'absolute',inset:'0',zIndex:'2',pointerEvents:'none'});
    host.appendChild(foreground.domElement);
    cleanups.push(()=>{releaseArenaObject(foregroundScene);foreground.dispose();foreground.forceContextLoss();foreground.domElement.remove();});
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
    const visuals=createArenaVisuals(scene,{foregroundScene});cleanups.push(()=>visuals.dispose());
    const crowd=createArenaCrowd(scene);crowd.group.visible=false;cleanups.push(()=>crowd.dispose());
    const crowdSpeaker=document.createElement('div');
    Object.assign(crowdSpeaker.style,{position:'fixed',width:'2px',height:'2px',pointerEvents:'none',opacity:'0'});
    crowdSpeaker.setAttribute('aria-hidden','true');document.body.appendChild(crowdSpeaker);
    cleanups.push(()=>crowdSpeaker.remove());
    const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reduced=!!media?.matches,quality='auto',qualityLabel='',lite=false,autoLite=false,dirty=true,inView=true;
    let elapsed=0,last=performance.now(),lastDraw=0,sampleStart=last,samples=0,fps=0;
    const sonicCamera=createSonicCamera({camera,controls,pointFor:arenaPoint});
    cleanups.push(()=>sonicCamera.dispose());
    // 🎥 THE AUTO CAMERA (cameraDirector.js). Plain {x,y,z} in and out, so it
    // never holds a live Vector3 the renderer might mutate under it.
    const plain=v=>v&&{x:v.x,y:v.y,z:v.z};
    const subjects=createCameraSubjects({pointFor:num=>plain(arenaPoint(num,.34)),pointXY:(x,y)=>plain(pointXY(x,y))});
    let director=createCameraDirector(),autoCamera=true,cameraShot=null,cameraReport='';
    // Every click counts as activity, including HUD clicks outside the canvas.
    // Capture observes events without preventing gameplay or changing battle shots.
    const noteActivity=()=>director.userNudge(performance.now());
    for(const type of ['pointerdown','pointerup','click','auxclick']) {
      document.addEventListener(type,noteActivity,true);
      cleanups.push(()=>document.removeEventListener(type,noteActivity,true));
    }
    // OrbitControls still owns drag start/end, so held gestures cannot time out.
    const takeOver=()=>{sonicCamera.userStart();director.userStart(performance.now());},letGo=()=>director.userEnd(performance.now());
    controls.addEventListener('start',takeOver);controls.addEventListener('end',letGo);
    cleanups.push(()=>{controls.removeEventListener('start',takeOver);controls.removeEventListener('end',letGo);});
    const motion=()=>{reduced=!!media?.matches;controls.enableDamping=!reduced;dirty=true;};motion();
    media?.addEventListener?.('change',motion);cleanups.push(()=>media?.removeEventListener?.('change',motion));
    const fit=aspect=>Math.max(1,(SVG_W/SVG_H)/aspect);
    // A narrow screen already pulls view()'s cameras back by fit(); the director's
    // distances get the same stretch or a portrait phone would crop the battle.
    const DIRECTOR_DISTANCES=['idleDistance','wideDistance','heroDistance','moveDistance','battlePad','eventDistance'];
    const tuneDirector=()=>{const k=fit(Math.max(camera.aspect,.25));director.retune(Object.fromEntries(DIRECTOR_DISTANCES.map(key=>[key,CAMERA_DIRECTOR[key]*k])));};
    function resize() {
      const {width,height}=host.getBoundingClientRect();if(!width||!height)return;
      const aspect=width/height;
      camera.position.sub(controls.target).multiplyScalar(fit(aspect)/fit(camera.aspect)).add(controls.target);
      camera.aspect=aspect;camera.updateProjectionMatrix();
      renderer.setSize(width,height);foreground.setPixelRatio(renderer.getPixelRatio());foreground.setSize(width,height);composer.setSize(width,height);overlay.setSize(width,height);tuneDirector();dirty=true;
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
    function frameView(name) {
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
      const wallDt=Math.max(0,(now-last)/1000),dt=Math.min(wallDt,.05);last=now;
      if(document.hidden||!inView)return;
      elapsed+=wallDt;
      // Focus is refreshed every frame from the same clock as the projectiles.
      visuals.tick(elapsed,reduced,camera);
      // Subjects are read EVERY frame, even under a Sonic shot, or a move made
      // during the volley would be missed and the hex bookkeeping go stale.
      const cameraSubjects=subjects.read(frame,now);
      cameraShot=null;
      if(!sonicCamera.update(frame,model,dt,reduced)) {
        // wallDt, not the 50 ms-capped dt: the director caps at 100 ms itself, and a
        // slow machine must not also get a camera that crawls at a fraction of speed.
        cameraShot=autoCamera?director.update({dtMs:wallDt*1000,now,subjects:cameraSubjects,camera:{position:camera.position,target:controls.target},reduced}):null;
        if(cameraShot?.driving) {
          // ⚠️ NO controls.update() on a frame the director drives: with damping
          // on, OrbitControls would ease the camera back toward its own last pose.
          controls.target.set(cameraShot.target.x,cameraShot.target.y,cameraShot.target.z);
          camera.position.set(cameraShot.position.x,cameraShot.position.y,cameraShot.position.z);
          camera.lookAt(controls.target);dirty=true;
        } else controls.update();
      }
      reportCamera(sonicCamera.manual?'battle-manual':sonicCamera.active?'sonic':!autoCamera||!cameraShot||cameraShot.mode==='off'?'off':cameraShot.mode,cameraShot?.resumeInMs);
      // A head dial mid-change is motion too: under reduced motion the loop only
      // draws when something moves, and a dial that appears must also DISAPPEAR.
      const stats=visuals.diagnostics(),moving=stats.effects>0||stats.headDials>0||stats.moveTiles>0||sonicCamera.active||!!cameraShot?.driving;
      if(reduced&&!dirty&&!moving)return;
      if(now-lastDraw<(lite?1000/30:1000/60)-1)return;
      lastDraw=now;
      try {
        environment.update(elapsed,{lite,reduced});
        crowd.tick(elapsed,{reduced});
        const speaker=crowd.speaker(frame.actingId);
        if(speaker){
          camera.updateMatrixWorld();const p=speaker.project(camera),rect=host.getBoundingClientRect();
          crowdSpeaker.dataset.arenaCrowdSpeaker='';
          crowdSpeaker.style.left=`${THREE.MathUtils.clamp(rect.left+(p.x+1)*rect.width/2,rect.left+24,rect.right-24)}px`;
          crowdSpeaker.style.top=`${THREE.MathUtils.clamp(rect.top+(1-p.y)*rect.height/2,rect.top+100,rect.bottom-24)}px`;
        }else delete crowdSpeaker.dataset.arenaCrowdSpeaker;
        for(const e of emissives)if(e.crack)e.material.emissiveIntensity=e.base*(reduced?1:1+.08*Math.sin(elapsed*.75));
        renderer.info.reset();composer.render();overlay.render(overlayScene,camera);foreground.render(foregroundScene,camera);dirty=false;
        samples++;
        if(now-sampleStart>2500) {
          fps=Math.round(samples*1000/(now-sampleStart));samples=0;sampleStart=now;
          // Downgrade once, never oscillate or auto-upgrade during a match.
          if(quality==='auto'&&!lite&&!reduced&&fps<35&&elapsed>5){autoLite=true;applyQuality();}
          host.dataset.arenaFps=String(fps);host.dataset.arenaQuality=lite?'standard':'high';
          const stats=visuals.diagnostics();host.dataset.arenaCabinets=String(stats.liveCabinets);
          host.dataset.arenaEffects=String(stats.effects);host.dataset.arenaHazards=String(stats.hazards);
          host.dataset.arenaFans=String(crowd.count);
          host.dataset.arenaDrawCalls=String(renderer.info.render.calls);
        }
      } catch(error) {failed=true;cancelAnimationFrame(raf);console.error('Arena rendering stopped',error);onError();}
    }
    // The badge in BoardViewport's toolbar. Reported only when what it SAYS
    // changes (a tenth of a second on the countdown), never sixty times a second.
    function reportCamera(mode,resumeInMs) {
      const tenths=mode==='manual'?Math.max(0,Math.ceil((resumeInMs??0)/100)):0,key=`${mode}:${tenths}`;
      if(key===cameraReport)return;cameraReport=key;
      host.dataset.arenaCamera=mode;
      onCamera?.({mode,resumeInS:tenths/10});
    }
    const visible=()=>{last=performance.now();sampleStart=last;samples=0;dirty=true;};
    document.addEventListener('visibilitychange',visible);cleanups.push(()=>document.removeEventListener('visibilitychange',visible));
    const lost=event=>{event.preventDefault();failed=true;cancelAnimationFrame(raf);onError();};
    renderer.domElement.addEventListener('webglcontextlost',lost);cleanups.push(()=>renderer.domElement.removeEventListener('webglcontextlost',lost));
    resize();frameView('arena');raf=requestAnimationFrame(render);
    new GLTFLoader().load(`${import.meta.env.BASE_URL}cosmic-arena/cosmic-arena.glb`,gltf=>{
      if(disposed){releaseArenaObject(gltf.scene);return;}
      try {
        model=gltf.scene;model.scale.z=-1;emissives=polishArenaModel(model);
        // The crowd owns the larger seats; hide the original modeled copy.
        const oldStands=model.getObjectByName('Stands');if(oldStands)oldStands.visible=false;
        scene.add(model);visuals.attachModel(model);visuals.update(frame);crowd.group.visible=true;dirty=true;onReady();
      }catch(error){console.error('Arena model setup failed',error);onError();}
    },undefined,()=>{if(!disposed)onError();});
    return {
      // The toolbar's camera buttons are the player choosing a shot: they count
      // as taking over (the preview's "Count as taking over", left as default).
      followBattle(){sonicCamera.autoCamera(true);dirty=true;},
      view(name){sonicCamera.userNudge();frameView(name);director.userNudge(performance.now());},
      dispose,
      update(next){if(disposed||failed)return;frame=next??{};applyQuality();visuals.update(frame);crowd.update(frame.crowds);dirty=true;},
      quality(value){if(value===quality)return;quality=value;autoLite=false;applyQuality();dirty=true;},
      zoom(factor){sonicCamera.userNudge();camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();director.userNudge(performance.now());dirty=true;},
      // ☰ Auto camera switch. Turning it back ON starts a fresh director so it
      // picks up from wherever the camera is now, not from a pose it held before.
      autoCamera(on){on=!!on;if(on===autoCamera)return;autoCamera=on;sonicCamera.autoCamera(on);if(on){director=createCameraDirector();tuneDirector();}dirty=true;},
    };
  } catch(error) {dispose();throw error;}
}
