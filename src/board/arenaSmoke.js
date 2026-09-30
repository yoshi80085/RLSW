import * as THREE from 'three';
import { createSmokePass } from './smokeVolume.js';
import { createSmokeTimeline, SMOKE_LOOK } from './smokePresentation.js';
import { sonicSceneLabel } from './sonicDiceVisuals.js';

const SELF_LAYER=6;

// The game has CSS3D between its two WebGL canvases. Smoke must composite on
// the foreground canvas, above that click surface, using THAT context's depth.
// No cross-context canvas copy and no extra full-world render are required.
export function createArenaSmoke({foreground,scene,center}){
  const timeline=createSmokeTimeline(),size=new THREE.Vector2();
  let target=null,volume=null,envelope={busy:false},flow=0,last=null,selfId=null;
  const vent=new THREE.Group();vent.name='Smoke floor vent';vent.position.copy(center);scene.add(vent);
  const metal=new THREE.MeshStandardMaterial({color:'#566575',roughness:.8,metalness:.3});
  const dark=new THREE.MeshStandardMaterial({color:'#101922',roughness:.9});
  const plate=new THREE.Mesh(new THREE.CylinderGeometry(.65,.65,.02,24),metal);plate.position.y=.015;vent.add(plate);
  for(let i=-3;i<=3;i++){const bar=new THREE.Mesh(new THREE.BoxGeometry(1,.004,.06),dark);bar.position.set(0,.028,i*.14);vent.add(bar);}
  const cueScene=new THREE.Scene(),ring=new THREE.Mesh(new THREE.RingGeometry(.8,1,6),new THREE.MeshBasicMaterial({color:'#a9ffe4',side:THREE.DoubleSide,depthTest:false,depthWrite:false,transparent:true,opacity:.75}));
  ring.rotation.x=-Math.PI/2;cueScene.add(ring);
  const label=sonicSceneLabel('YOU · HIDDEN TO RIVALS','#d6fff3',4.5,.65,{border:'#92ebcb',font:42});cueScene.add(label.sprite);
  const copies=new WeakMap(),materials=[];
  function silhouetteMaterial(original){
    let material=copies.get(original);
    if(!material){material=new THREE.MeshBasicMaterial({color:'#a9ffe4',map:original.map??null,
      alphaTest:original.alphaTest??0,side:original.side,transparent:true,opacity:.62,depthTest:false,depthWrite:false});
      copies.set(original,material);materials.push(material);}
    return material;
  }
  return {
    vent,
    update(smoke,time,camera,{reduced=false}={}){
      const wasActive=envelope.active;
      if(last!=null&&!reduced)flow+=Math.max(0,time-last)*SMOKE_LOOK.speed;last=time;
      envelope=timeline.update(smoke,time,{reduced});selfId=smoke?.selfId??null;
      if(!wasActive&&envelope.active)flow=0;
      if(envelope.busy&&!volume){
        target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
        target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
        volume=createSmokePass(target.depthTexture,camera);volume.pass.renderToScreen=true;
      }
      volume?.update(SMOKE_LOOK,flow,envelope);
      return envelope;
    },
    begin(){
      if(!envelope.busy)return false;
      foreground.getDrawingBufferSize(size);
      if(target.width!==size.x||target.height!==size.y)target.setSize(size.x,size.y);
      foreground.setRenderTarget(target);return true;
    },
    composite(){
      if(!envelope.busy)return;
      foreground.setRenderTarget(null);foreground.clear();
      volume.pass.render(foreground,null,target);
    },
    drawSelf(camera,foregroundScene,pawn){
      if(!selfId||!envelope.active||!pawn?.visible)return false;
      const mask=camera.layers.mask,swapped=[];
      // Draw only this local pawn's solid geometry, retaining the art's alpha cut.
      // Never add the clear acrylic sheet, shadows, badges or rival objects.
      pawn.traverseVisible(o=>{
        const m=o.material;
        if(!o.isMesh||Array.isArray(m)||!m||m.transmission>0||m.opacity<.5||m.blending===THREE.AdditiveBlending)return;
        swapped.push([o,m,o.layers.mask]);o.material=silhouetteMaterial(m);o.layers.enable(SELF_LAYER);
      });
      try{camera.layers.set(SELF_LAYER);foreground.render(foregroundScene,camera);}
      finally{for(const [o,m,layers] of swapped){o.material=m;o.layers.mask=layers;}camera.layers.mask=mask;}
      pawn.getWorldPosition(ring.position);ring.position.y=.22;
      label.sprite.position.copy(ring.position);label.sprite.position.y+=3.4;
      foreground.render(cueScene,camera);return true;
    },
    diagnostics:()=>({...envelope,selfId,allocated:!!volume}),
    dispose(){volume?.dispose();target?.dispose();for(const m of materials)m.dispose();
      vent.removeFromParent();const geometry=new Set();vent.traverse(o=>{if(o.geometry)geometry.add(o.geometry);});geometry.forEach(g=>g.dispose());metal.dispose();dark.dispose();
      ring.geometry.dispose();ring.material.dispose();label.texture?.dispose();label.sprite.material.dispose();cueScene.clear();},
  };
}
