import { createIdleFlow } from './idleFlow.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { BATTLE_DIRECTOR } from './battleDirector.js';
import { createSpeedLines } from './speedLines.js';
import { createSolidLayer, markSolid, markOccluders } from './solidLayer.js';
import { TOP_OFFSET, onTopAxis } from './topDownView.js';
import { SCALE, SVG_W, SVG_H } from './constants.js';
import { preserveTacticalLayer, keepGameplayClicks } from './arenaDom.js';
import { createArenaEnvironment, polishArenaModel } from './arenaEnvironment.js';
import { arenaPoint, pointXY, createArenaVisuals, releaseArenaObject } from './arenaVisuals.js';
import { createSonicCamera } from './sonicCamera.js';
import { createArenaCrowd } from './arenaCrowd.js';
import { CAMERA_DIRECTOR, createCameraDirector, createCameraSubjects } from './cameraDirector.js';

// The SVG remains the only gameplay input surface. WebGL consumes a filtered,
// read-only presentation frame; neither camera nor effects can dispatch actions.
export function mountArena(host, tacticalElement, { onReady, onError, onQuality, onCamera, onTopView }) {
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
    // 🧱 Amps, fans and dice are RE-DRAWN on this canvas too, with their own
    // materials, ABOVE the board's SVG, so no hex tint can paint over them
    // (solidLayer.js). The foreground therefore clears once per frame and
    // draws the solids, then the standees, sharing one depth buffer.
    const solid=createSolidLayer({renderer,foreground});foreground.autoClear=false;
    cleanups.push(()=>solid.dispose());
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
    // 🔭 DEPTH OF FIELD, battles only (Alex, 2026-09-24: the amp and fans "out
    // of focus at first - then changing to become in focus as the Sonic charge
    // emits"). Off unless the battle director hands the camera a focus
    // distance, and never in Lite or reduced motion — it is a full extra pass.
    // 📌 Blurs the ARENA only: the standees are drawn by the foreground
    // renderer on top, so the Spirit in front stays sharp through the pull.
    const bokeh=new BokehPass(scene,camera,{focus:10,aperture:BATTLE_DIRECTOR.aperture/1000,maxblur:BATTLE_DIRECTOR.maxBlur/1000});
    bokeh.enabled=false;composer.addPass(bokeh);
    const output=new OutputPass();composer.addPass(bloom);composer.addPass(output);
    cleanups.push(()=>{bloom.dispose();bokeh.dispose();output.dispose();composer.dispose();});
    const environment=createArenaEnvironment(scene,{overlay:foregroundScene});cleanups.push(()=>environment.dispose());
    const visuals=createArenaVisuals(scene,{foregroundScene});cleanups.push(()=>visuals.dispose());
    const crowd=createArenaCrowd(scene);crowd.group.visible=false;cleanups.push(()=>crowd.dispose());
    const crowdSpeaker=document.createElement('div');
    Object.assign(crowdSpeaker.style,{position:'fixed',width:'2px',height:'2px',pointerEvents:'none',opacity:'0'});
    crowdSpeaker.setAttribute('aria-hidden','true');document.body.appendChild(crowdSpeaker);
    cleanups.push(()=>crowdSpeaker.remove());
    // 💨 The speed lines that rush in from the border on the battle director's
    // two-shot (speedLines.js). A screen overlay, so it never blooms or blurs.
    const speedLines=createSpeedLines(host);cleanups.push(()=>speedLines.dispose());
    const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let reduced=!!media?.matches,quality='auto',qualityLabel='',lite=false,autoLite=false,dirty=true,inView=true;
    let elapsed=0,last=performance.now(),lastDraw=0,sampleStart=last,samples=0,fps=0;
    const sonicCamera=createSonicCamera({camera,controls,pointFor:arenaPoint});
    cleanups.push(()=>sonicCamera.dispose());
    // 🎥 THE AUTO CAMERA (cameraDirector.js). Plain {x,y,z} in and out, so it
    // never holds a live Vector3 the renderer might mutate under it.
    const plain=v=>v&&{x:v.x,y:v.y,z:v.z};
    const subjects=createCameraSubjects({pointFor:num=>plain(arenaPoint(num,.34)),pointXY:(x,y)=>plain(pointXY(x,y))});
    const idleFlow=createIdleFlow();
    let director=createCameraDirector(),autoCamera=true,cameraShot=null,cameraReport='';
    // ⌗ THE TOP-DOWN VIEW HOLDS ITS AXIS (Alex, 2026-09-24: "If the camera is
    // set to top-down view, don't let the camera wander … keep it as is
    // permanently. So — same goes for the battle sequence"). While it is on,
    // the auto camera and the idle flow are never asked and the battle
    // director's shots are held off as if the player had grabbed the lens.
    // ⚠️ BUT TOP-DOWN IS NOT "STATIONARY" (his follow-up, same day): the player
    // may zoom and pan and it is still top-down; the moment the axis tilts or
    // turns it is NOT top-down any more, and the auto camera gets its usual
    // resume timer back (`leaveTopIfTilted`). "Keep the camera still anywhere"
    // is the Auto camera switch turned off — a separate choice (📌 Hold).
    let topView=false;
    const syncBattleCamera=()=>sonicCamera.autoCamera(autoCamera&&!topView);
    // 🎥 ANY INPUT IS "ACTIVITY", AND 10 s OF NONE HANDS THE LENS BACK (Alex,
    // 2026-09-25: *"stationary for 10 seconds triggers auto camera. Any keystroke,
    // mouse click, mouse wheel roll, mouse movement counts as an 'action'"*). So
    // the auto camera is an idle mode now: it takes over when the player has put
    // the mouse down, and the first twitch gives the camera back where it is.
    // Listened for on the whole document (the HUD counts, not just the canvas), in
    // the capture phase and passively — observed, never prevented.
    // ⚠️ Battle shots are NOT nudged by this: sonicCamera only yields to a real
    // drag (OrbitControls start), so moving the mouse never cancels a battle angle.
    // 🎯 A BREAK REFOCUSES ON THE SPIRIT (Alex, 2026-09-25: *"make it so that a
    // break in the auto camera brings the focus back to the Spirit"*). When the
    // input lands while the director or the idle flow is FLYING the lens, the
    // camera eases (REFOCUS_MS) onto the acting Spirit instead of freezing
    // wherever the wander had reached. It keeps its current viewing angle — only
    // the aim and the distance change — so the break reads as "back to you", not
    // as a cut. ⚠️ Only on the break itself: the director is manual from then on,
    // so later mouse movement cannot re-trigger it until the auto camera has
    // come back. A real drag (OrbitControls start), ☰ view or zoom cancels it.
    let refocus=null;
    const REFOCUS_MS=700;
    function startRefocus(now){
      const num=frame.spirits?.find(s=>s.id===frame.actingId)?.num;if(num==null)return;
      const p=arenaPoint(num,.34);if(!p)return;
      const dir=camera.position.clone().sub(controls.target),r0=dir.length();if(!r0)return;
      controls._sphericalDelta?.set(0,0,0);controls._panOffset?.set(0,0,0);if('_scale' in controls)controls._scale=1;
      refocus={start:now,t0:controls.target.clone(),goal:new THREE.Vector3(p.x,p.y+CAMERA_DIRECTOR.lookHeight,p.z),
        dir:dir.divideScalar(r0),r0,r1:CAMERA_DIRECTOR.idleDistance*fit(Math.max(camera.aspect,.25))};
      dirty=true;
    }
    const noteActivity=()=>{const now=performance.now();
      const broke=autoCamera&&!topView&&!sonicCamera.active&&!!cameraShot?.driving&&!refocus;
      director.userNudge(now);idleFlow.activity(now);
      if(broke)startRefocus(now);};
    for(const type of ['pointerdown','pointerup','click','auxclick','keydown','wheel','pointermove']) {
      document.addEventListener(type,noteActivity,{capture:true,passive:true});
      cleanups.push(()=>document.removeEventListener(type,noteActivity,{capture:true}));
    }
    // OrbitControls still owns drag start/end, so held gestures cannot time out.
    const takeOver=()=>{refocus=null;sonicCamera.userStart();director.userStart(performance.now());},letGo=()=>director.userEnd(performance.now());
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
    // Every orbit, pan, dolly and damping step comes through here — including
    // the damping tail after the player lets go, so a flick that tilts on the
    // way out still counts.
    function leaveTopIfTilted(){
      if(!topView||onTopAxis(camera.position,controls.target))return;
      topView=false;syncBattleCamera();onTopView?.(false);
    }
    const change=()=>{dirty=true;leaveTopIfTilted();};controls.addEventListener('change',change);
    const observer=new ResizeObserver(resize);observer.observe(host);cleanups.push(()=>observer.disconnect());
    if(typeof IntersectionObserver!=='undefined') {
      const visibility=new IntersectionObserver(entries=>{inView=entries[0]?.isIntersecting??true;dirty=true;});
      visibility.observe(host);cleanups.push(()=>visibility.disconnect());
    }
    function frameView(name) {
      // ⚠️ OrbitControls keeps the tail of a flick (damping) in private deltas,
      // and the next update() would spin a fresh preset by it — which for ⌗ Top
      // is a TILT, and would drop the top-down view the frame it was chosen.
      controls._sphericalDelta?.set(0,0,0);controls._panOffset?.set(0,0,0);if('_scale' in controls)controls._scale=1;
      const point=name==='focus'?arenaPoint(frame.spirits?.find(s=>s.id===frame.actingId)?.num):null;
      controls.target.copy(point??new THREE.Vector3(name==='arena'?1:0,name==='arena'?-2.8:0,0));
      const distance=(point?18:35)*fit(Math.max(camera.aspect,.25));
      if(name==='arena')camera.position.set(27,20.8,37).multiplyScalar(fit(Math.max(camera.aspect,.25))).add(controls.target);
      else camera.position.set(...TOP_OFFSET).multiplyScalar(distance).add(controls.target);
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
      if(sonicCamera.active)idleFlow.activity(now);
      if(!sonicCamera.update(frame,model,dt,reduced,visuals.battleShot())) {
        // wallDt, not the 50 ms-capped dt: the director caps at 100 ms itself, and a
        // slow machine must not also get a camera that crawls at a fraction of speed.
        cameraShot=autoCamera&&!topView?director.update({dtMs:wallDt*1000,now,subjects:cameraSubjects,camera:{position:camera.position,target:controls.target},reduced}):null;
        cameraShot=idleFlow.update({shot:cameraShot,camera:{position:camera.position,target:controls.target},now,dtMs:wallDt*1000,center:cameraSubjects.center,scale:fit(Math.max(camera.aspect,.25)),reduced});
        if(cameraShot?.driving) {
          // ⚠️ NO controls.update() on a frame the director drives: with damping
          // on, OrbitControls would ease the camera back toward its own last pose.
          controls.target.set(cameraShot.target.x,cameraShot.target.y,cameraShot.target.z);
          camera.position.set(cameraShot.position.x,cameraShot.position.y,cameraShot.position.z);
          camera.lookAt(controls.target);dirty=true;
        } else if(refocus) {
          // 🎯 the break's ease back onto the Spirit (startRefocus). No
          // controls.update() here either: damping would pull against the ease.
          const k=reduced?1:Math.min(1,(now-refocus.start)/REFOCUS_MS),e=k*k*(3-2*k);
          controls.target.lerpVectors(refocus.t0,refocus.goal,e);
          camera.position.copy(refocus.dir).multiplyScalar(refocus.r0+(refocus.r1-refocus.r0)*e).add(controls.target);
          camera.lookAt(controls.target);dirty=true;
          if(k>=1)refocus=null;
        } else controls.update();
      }
      // 💨 Only while the director is flying the lens — a player who grabbed the
      // camera has taken the drama back, lines and all.
      {const directedShot=visuals.battleShot();
       speedLines.update(sonicCamera.active&&!sonicCamera.manual?(directedShot?.lines??0):0,wallDt,reduced);
       if(speedLines.level>0)dirty=true;}
      reportCamera(topView?'top':sonicCamera.manual?'battle-manual':sonicCamera.active?'sonic':!autoCamera||!cameraShot||cameraShot.mode==='off'?'off':cameraShot.mode,cameraShot?.resumeInMs);
      // A head dial mid-change is motion too: under reduced motion the loop only
      // draws when something moves, and a dial that appears must also DISAPPEAR.
      const stats=visuals.diagnostics(),moving=stats.effects>0||stats.headDials>0||stats.moveTiles>0||sonicCamera.active||!!cameraShot?.driving||!!refocus;
      if(reduced&&!dirty&&!moving)return;
      if(now-lastDraw<(lite?1000/30:1000/60)-1)return;
      lastDraw=now;
      try {
        environment.update(elapsed,{lite,reduced,spotlights:frame.spotlights});
        crowd.tick(elapsed,{reduced});
        // 👏 The bout's crowd reaction rides on top of the idle tick.
        crowd.react(elapsed,visuals.crowdReaction()??{amount:0},{reduced});
        const focus=sonicCamera.focusDistance;
        bokeh.enabled=focus!=null&&!lite&&!reduced;
        if(bokeh.enabled)bokeh.uniforms.focus.value=focus;
        const speaker=crowd.speaker(frame.actingId);
        if(speaker){
          camera.updateMatrixWorld();const p=speaker.project(camera),rect=host.getBoundingClientRect();
          crowdSpeaker.dataset.arenaCrowdSpeaker='';
          crowdSpeaker.style.left=`${THREE.MathUtils.clamp(rect.left+(p.x+1)*rect.width/2,rect.left+24,rect.right-24)}px`;
          crowdSpeaker.style.top=`${THREE.MathUtils.clamp(rect.top+(1-p.y)*rect.height/2,rect.top+100,rect.bottom-24)}px`;
        }else delete crowdSpeaker.dataset.arenaCrowdSpeaker;
        for(const e of emissives)if(e.crack)e.material.emissiveIntensity=e.base*(reduced?1:1+.08*Math.sin(elapsed*.75));
        renderer.info.reset();composer.render();overlay.render(overlayScene,camera);
        foreground.clear();markSolid([crowd.group,...visuals.solidRoots()]);solid.render(scene,camera);foreground.render(foregroundScene,camera);dirty=false;
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
        // 🪨 The ground hides the amps' buried bases in the solid re-draw too (solidLayer.js).
        markOccluders([model.getObjectByName('Stage'),model.getObjectByName('Island')]);
        scene.add(model);visuals.attachModel(model);visuals.update(frame);crowd.group.visible=true;dirty=true;onReady();
      }catch(error){console.error('Arena model setup failed',error);onError();}
    },undefined,()=>{if(!disposed)onError();});
    return {
      // The toolbar's camera buttons are the player choosing a shot: they count
      // as taking over (the preview's "Count as taking over", left as default).
      followBattle(){if(topView)return;sonicCamera.autoCamera(true);dirty=true;},
      // ⌗ Top locks the lens; ◈ Arena / ◎ Spirit unlock it and start a fresh
      // director, which waits out the usual resume before it drives again.
      view(name){const top=name==='tactical';
        if(top!==topView){topView=top;syncBattleCamera();if(!top){director=createCameraDirector();tuneDirector();idleFlow.activity(performance.now());}}
        refocus=null;sonicCamera.userNudge();frameView(name);director.userNudge(performance.now());},
      dispose,
      update(next){if(disposed||failed)return;frame=next??{};applyQuality();visuals.update(frame);crowd.update(frame.crowds);dirty=true;},
      quality(value){if(value===quality)return;quality=value;autoLite=false;applyQuality();dirty=true;},
      zoom(factor){refocus=null;sonicCamera.userNudge();camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();director.userNudge(performance.now());dirty=true;},
      // ☰ Auto camera switch. Turning it back ON starts a fresh director so it
      // picks up from wherever the camera is now, not from a pose it held before.
      autoCamera(on){on=!!on;if(on===autoCamera)return;autoCamera=on;syncBattleCamera();if(on){director=createCameraDirector();tuneDirector();}dirty=true;},
    };
  } catch(error) {dispose();throw error;}
}
