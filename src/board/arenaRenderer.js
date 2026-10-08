import { createIdleFlow } from './idleFlow.js';
import { createArenaSmoke } from './arenaSmoke.js';
import { LIMELIGHT_HEX } from '../data/gameConstants.js';
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
import { createBeamLayer } from './beamLayer.js';
import { TOP_OFFSET, onTopAxis } from './topDownView.js';
import { SCALE, SVG_W, SVG_H } from './constants.js';
import { preserveTacticalLayer, keepGameplayClicks } from './arenaDom.js';
import { createArenaEnvironment, polishArenaModel } from './arenaEnvironment.js';
import { createRivenWorld, RIVEN_WORLD } from './rivenWorld/index.js';
import { arenaPoint, pointXY, createArenaVisuals, releaseArenaObject } from './arenaVisuals.js';
import { createSonicCamera } from './sonicCamera.js';
import { createArenaCrowd } from './arenaCrowd.js';
import { CAMERA_DIRECTOR, createCameraDirector, createCameraSubjects } from './cameraDirector.js';
import { OPENING_ACT } from './openingAct.js';

// The SVG remains the only gameplay input surface. WebGL consumes a filtered,
// read-only presentation frame; neither camera nor effects can dispatch actions.
export function mountArena(host, tacticalElement, { onReady, onError, onQuality, onCamera, onTopView, onRiffProjection }) {
  const cleanups=[];
  let disposed=false,failed=false,raf=0,model=null,frame={},emissives=[];
  const dispose=()=>{
    if(disposed)return;disposed=true;globalThis.cancelAnimationFrame?.(raf);
    for(const cleanup of cleanups.reverse())cleanup();
  };
  try {
    const restoreLayer=preserveTacticalLayer(tacticalElement);
    cleanups.push(restoreLayer);
    // 🎬 Watched from the very first line, so no texture can start unseen (see settle()).
    const SETTLE_CAP_MS=2500,assets=THREE.DefaultLoadingManager;
    let assetsBusy=false;
    const prevStart=assets.onStart,prevLoad=assets.onLoad,prevProgress=assets.onProgress;
    assets.onStart=(...a)=>{assetsBusy=true;prevStart?.(...a);};
    assets.onProgress=(url,done,total)=>{assetsBusy=done<total;prevProgress?.(url,done,total);};
    assets.onLoad=(...a)=>{assetsBusy=false;prevLoad?.(...a);};
    cleanups.push(()=>{assets.onStart=prevStart;assets.onProgress=prevProgress;assets.onLoad=prevLoad;});
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
    const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),RIVEN_WORLD.bloom,.65,1.05);
    // 🔭 DEPTH OF FIELD, battles only (Alex, 2026-09-24: the amp and fans "out
    // of focus at first - then changing to become in focus as the Sonic charge
    // emits"). Off unless the battle director hands the camera a focus
    // distance, and never in Lite or reduced motion — it is a full extra pass.
    // 📌 Blurs the ARENA only: the standees are drawn by the foreground
    // renderer on top, so the Spirit in front stays sharp through the pull.
    const bokeh=new BokehPass(scene,camera,{focus:10,aperture:BATTLE_DIRECTOR.aperture/1000,maxblur:BATTLE_DIRECTOR.maxBlur/1000});
    bokeh.enabled=false;composer.addPass(bokeh);
    const output=new OutputPass();composer.addPass(bloom);composer.addPass(output);
    // 🔊 The Sonic's rings are drawn LAST, over the solids and the standees, and
    // pass behind nothing but the Spirit they loop round (beamLayer.js). It
    // carries its own copy of this bloom, because it is no longer under it.
    const beams=createBeamLayer({foreground,bloom:{strength:bloom.strength,radius:bloom.radius,threshold:bloom.threshold}});cleanups.push(()=>beams.dispose());
    cleanups.push(()=>{bloom.dispose();bokeh.dispose();output.dispose();composer.dispose();});
    const environment=createArenaEnvironment(scene,{overlay:foregroundScene,classicScenery:false});cleanups.push(()=>environment.dispose());
    environment.setPlanetDistance(RIVEN_WORLD.planetDistance);
    const rivenWorld=createRivenWorld(scene,camera);cleanups.push(()=>rivenWorld.dispose());
    const visuals=createArenaVisuals(scene,{foregroundScene,beamScene:beams.scene});cleanups.push(()=>visuals.dispose());
    const smoke=createArenaSmoke({foreground,scene,center:arenaPoint(LIMELIGHT_HEX,.1)});cleanups.push(()=>smoke.dispose());
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
    let refocus=null,introBlend=null;
    const REFOCUS_MS=700;
    // 🎯 A NEW TURN BRINGS THE LENS TO ITS SPIRIT (Alex, 2026-10-08: *"When it
    // becomes a new players turn, the camera should come to that Spirit"*). Before
    // this only the auto camera did, and only once the player had been idle 10 s;
    // a player moving the mouse kept looking wherever they were while a rival's
    // whole turn played out somewhere else. Now the turn changing eases the lens
    // onto the new Spirit (the refocus below, TURN_FOCUS_MS) whoever is holding it.
    // ⚠️ Waits out a battle shot (the Sonic camera outranks it) and is left to the
    // director when the director is already flying (it re-aims on a new turn by
    // itself). Not under ⌗ top-down or with ☰ Auto camera off — both are the
    // player asking for a still lens — and never mid-drag. A first turn with an
    // entrance is the entrance close-up's (openingActStage.camera), not this.
    // 📌 The refocus keeps the current viewing angle, so a new turn reads as the
    // camera turning its head, not as a cut to a fresh shot.
    const TURN_FOCUS_MS=1100;
    let seenActing,turnFocus=false,dragging=false,lensDropped=null,lastIntro=null;
    function startRefocus(now,ms=REFOCUS_MS){
      const num=frame.spirits?.find(s=>s.id===frame.actingId)?.num;if(num==null)return;
      const p=arenaPoint(num,.34);if(!p)return;
      const dir=camera.position.clone().sub(controls.target),r0=dir.length();if(!r0)return;
      controls._sphericalDelta?.set(0,0,0);controls._panOffset?.set(0,0,0);if('_scale' in controls)controls._scale=1;
      refocus={start:now,ms,t0:controls.target.clone(),goal:new THREE.Vector3(p.x,p.y+CAMERA_DIRECTOR.lookHeight,p.z),
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
    // A drag also drops the entrance close-up it lands on (lensDropped): the riff
    // plays on, but the lens is the player's from that moment.
    const takeOver=()=>{refocus=null;dragging=true;if(lastIntro?.key)lensDropped=lastIntro.key;sonicCamera.userStart();director.userStart(performance.now());},letGo=()=>{dragging=false;director.userEnd(performance.now());};
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
      // 🎆 Astra's mortar sparks are sized in screen pixels (pyroMortars `resize`).
      visuals.resize?.(height*renderer.getPixelRatio());
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
      // 🎸 THE OPENING ACT HOLDS THE LENS while the Bardbarian introduces the
      // Spirits (openingActStage.camera) — except under ⌗ top-down, which is a
      // lock the player chose. The intro counts as activity, so the auto camera
      // waits its usual resume time after it rather than snapping somewhere.
      // 🎯 Each Spirit's entrance close-up rides the same path (openingActStage.camera);
      // `follow` is the ☰ Auto camera switch, and `from` the lens it eases in from.
      let introShot=topView?null:visuals.openingCamera(performance.now(),camera.aspect,{reduced,follow:autoCamera,from:{position:camera.position,target:controls.target}});   // the opening's clock is performance.now(), like its stage
      if(introShot?.key&&introShot.key===lensDropped)introShot=null;
      // ⏭ A skipped intro hands back a WIDE lens; frame the arena then, rather
      // than leaving the board a speck until the auto camera's resume runs out.
      // A close-up cut short (⏭ mid-riff) hands back a lens closer than the
      // player's own floor; ease out onto the Spirit instead.
      if(!introShot&&introBlend!=null){
        if(lastIntro?.key&&!lastIntro.settled&&lastIntro.key!==lensDropped)startRefocus(now);
        else if(introBlend<.9)frameView('arena');
        introBlend=null;}
      lastIntro=introShot;
      if(introShot){
        introBlend=introShot.blend;turnFocus=false;
        refocus=null;director.userNudge(now);idleFlow.activity(now);
        controls.target.copy(introShot.target);camera.position.copy(introShot.position);
        camera.lookAt(controls.target);dirty=true;
      } else if(!sonicCamera.update(frame,model,dt,reduced,visuals.battleShot())) {
        // wallDt, not the 50 ms-capped dt: the director caps at 100 ms itself, and a
        // slow machine must not also get a camera that crawls at a fraction of speed.
        cameraShot=autoCamera&&!topView?director.update({dtMs:wallDt*1000,now,subjects:cameraSubjects,camera:{position:camera.position,target:controls.target},reduced}):null;
        cameraShot=idleFlow.update({shot:cameraShot,camera:{position:camera.position,target:controls.target},now,dtMs:wallDt*1000,center:cameraSubjects.center,scale:fit(Math.max(camera.aspect,.25)),reduced});
        // 🎯 the new turn's ease onto its Spirit (TURN_FOCUS_MS) — once the battle shot has let go.
        if(turnFocus){turnFocus=false;if(autoCamera&&!topView&&!dragging&&!cameraShot?.driving)startRefocus(now,TURN_FOCUS_MS);}
        if(cameraShot?.driving) {
          // ⚠️ NO controls.update() on a frame the director drives: with damping
          // on, OrbitControls would ease the camera back toward its own last pose.
          controls.target.set(cameraShot.target.x,cameraShot.target.y,cameraShot.target.z);
          camera.position.set(cameraShot.position.x,cameraShot.position.y,cameraShot.position.z);
          camera.lookAt(controls.target);dirty=true;
        } else if(refocus) {
          // 🎯 the break's ease back onto the Spirit (startRefocus). No
          // controls.update() here either: damping would pull against the ease.
          const k=reduced?1:Math.min(1,(now-refocus.start)/refocus.ms),e=k*k*(3-2*k);
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
      const anchors=visuals.riffAnchors();
      if(anchors){camera.updateMatrixWorld();onRiffProjection?.(anchors.map(p=>{
        const bridge=p.clone().add(new THREE.Vector3(0,3.05,0)).project(camera),foot=p.clone().project(camera);
        return {x:(bridge.x+1)*host.clientWidth/2,y:(1-bridge.y)*host.clientHeight/2,
          footY:(1-foot.y)*host.clientHeight/2,width:host.clientWidth,height:host.clientHeight};
      }));}else onRiffProjection?.(null);
      // 🎭 So is a standee's landing light (standeeSteps.js) — the hex's fade must finish.
      // A head dial mid-change is motion too: under reduced motion the loop only
      // draws when something moves, and a dial that appears must also DISAPPEAR.
      const smokeState=smoke.update(frame.smoke,elapsed,camera,{reduced});
      const stats=visuals.diagnostics(),moving=smokeState.busy||stats.laserBusy||stats.effects>0||stats.headDials>0||stats.moveTiles>0||stats.attackTiles>0||stats.marquees>0||stats.lostChords>0||stats.standeeSteps>0||stats.pyroBusy||stats.openingBusy||sonicCamera.active||!!cameraShot?.driving||!!refocus;
      if(reduced&&!dirty&&!moving)return;
      if(now-lastDraw<(lite?1000/30:1000/60)-1)return;
      lastDraw=now;
      try {
        environment.update(elapsed,{lite,reduced,spotlights:frame.spotlights});
        rivenWorld.update(elapsed,{reduced});
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
        // 🌑 THE SHAMISEN'S HUSH (cursedShamisenArena.js): the arena darkens while
        // the Ronin casts — exposure, not the lights, so every material dims
        // together and nothing in the rig has to be found and put back.
        // 🎸 …and the opening act's own look (Alex's dial-in: bloom, exposure) rides
        // the Bardbarian's envelope, so it eases back to the arena's as he fades.
        {const cl=visuals.curseLight(),open=visuals.openingEnvelope();
         renderer.toneMappingExposure=(1+(OPENING_ACT.exposure-1)*open)*(1-.6*Math.min(1,cl.dim));
         bloom.strength=RIVEN_WORLD.bloom+(OPENING_ACT.bloom-RIVEN_WORLD.bloom)*open;
         // The preview hid the arena's own transient bolts under the storm (it has its own).
         const bolts=scene.getObjectByName('Transient branching lightning');if(bolts)bolts.visible=open<.01;}
        // 🎆 A mortar hit shakes the lens and punches the zoom (pyroStage.camera,
        // Alex's dial-in: shake .3, punch .2). Applied around THIS draw and put
        // back after it, so the camera director and OrbitControls never see it.
        const pyroLens=visuals.pyroCamera?.(reduced),fov0=camera.fov;
        if(pyroLens){camera.position.x+=pyroLens.x;camera.position.y+=pyroLens.y;camera.fov=fov0*pyroLens.fov;camera.updateProjectionMatrix();}
        renderer.info.reset();composer.render();overlay.render(overlayScene,camera);
        smoke.begin();foreground.clear();markSolid([smoke.vent,crowd.group,...visuals.solidRoots()]);solid.render(scene,camera);foreground.render(foregroundScene,camera);
        smoke.composite();
        beams.render(camera,{occluderScene:foregroundScene,occluders:visuals.beamOccluders(),bloom:bloom.enabled});
        smoke.drawSelf(camera,foregroundScene,visuals.pawnFor(frame.smoke?.selfId));dirty=false;
        if(pyroLens){camera.position.x-=pyroLens.x;camera.position.y-=pyroLens.y;camera.fov=fov0;camera.updateProjectionMatrix();}
        host.dataset.arenaSmokeAmount=smokeState.opacity.toFixed(3);host.dataset.arenaSmokeExtent=smokeState.extent.toFixed(3);
        host.dataset.arenaSmokeSelf=frame.smoke?.selfId??'';
        host.dataset.arenaLaserPhase=stats.laserDetail.phase;host.dataset.arenaLaserPods=String(stats.laserDetail.pods);host.dataset.arenaLaserLanes=String(stats.laserDetail.lanes);
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
    // 🎬 "READY" MEANS "LOOKS FINISHED", NOT "THE GLB ARRIVED" (Alex, 2026-09-30:
    // *"I spend a good 5 seconds … looking at all the assets trying to load"*).
    // BoardViewport keeps a dark veil over the board until onReady, so this waits
    // for the textures the model's arrival sets off (standees, fans — all on
    // three's DefaultLoadingManager), compiles the shaders, and lets two frames
    // land before the veil lifts. Nothing pops in on screen that way.
    // ⚠️ Capped at SETTLE_CAP_MS: a texture that never answers must cost a
    // moment, never a board stuck behind the veil.
    function settle(){
      const t0=performance.now();
      const reveal=()=>{if(disposed||failed)return;dirty=true;
        requestAnimationFrame(()=>requestAnimationFrame(()=>{if(disposed||failed)return;
          // The loading frames were slow on purpose; judge Auto detail from here.
          sampleStart=performance.now();samples=0;onReady();}));};
      const wait=()=>{if(disposed||failed)return;
        if(assetsBusy&&performance.now()-t0<SETTLE_CAP_MS){setTimeout(wait,50);return;}
        // Shaders compile here, behind the veil, instead of as a hitch on the first visible frame.
        let compiled;try{compiled=Promise.all([renderer.compileAsync?.(scene,camera),foreground.compileAsync?.(foregroundScene,camera)]);}catch{compiled=null;}
        Promise.race([Promise.resolve(compiled).catch(()=>{}),new Promise(done=>setTimeout(done,1500))]).then(reveal);};
      wait();
    }
    resize();frameView('arena');raf=requestAnimationFrame(render);
    new GLTFLoader().load(`${import.meta.env.BASE_URL}cosmic-arena/cosmic-arena.glb`,gltf=>{
      if(disposed){releaseArenaObject(gltf.scene);return;}
      try {
        model=gltf.scene;model.scale.z=-1;emissives=polishArenaModel(model,{ampBrightness:RIVEN_WORLD.ampBrightness});
        rivenWorld.attachModel(model);
        // The crowd owns the larger seats; hide the original modeled copy.
        const oldStands=model.getObjectByName('Stands');if(oldStands)oldStands.visible=false;
        // 🪨 The ground hides the amps' buried bases in the solid re-draw too (solidLayer.js).
        markOccluders([model.getObjectByName('Stage'),rivenWorld.formation]);
        scene.add(model);visuals.attachModel(model);visuals.setOccluders([crowd.group,model.getObjectByName('Lighting')]);visuals.update(frame);crowd.group.visible=true;dirty=true;settle();
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
      update(next){if(disposed||failed)return;frame=next??{};
        // 🎯 A turn changing hands (TURN_FOCUS_MS above). The first acting Spirit the
        // arena ever sees is not a change: mounting frames the arena, the intro its own.
        if(frame.actingId!==seenActing){if(seenActing!==undefined&&frame.actingId!=null)turnFocus=true;seenActing=frame.actingId;}
applyQuality();visuals.update(frame);crowd.update(frame.crowds);dirty=true;},
      quality(value){if(value===quality)return;quality=value;autoLite=false;applyQuality();dirty=true;},
      zoom(factor){refocus=null;sonicCamera.userNudge();camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();director.userNudge(performance.now());dirty=true;},
      // ☰ Auto camera switch. Turning it back ON starts a fresh director so it
      // picks up from wherever the camera is now, not from a pose it held before.
      autoCamera(on){on=!!on;if(on===autoCamera)return;autoCamera=on;syncBattleCamera();if(on){director=createCameraDirector();tuneDirector();}dirty=true;},
    };
  } catch(error) {dispose();throw error;}
}

