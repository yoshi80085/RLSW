import * as THREE from 'three';
import { HEX_BY_NUM } from './hexMap.js';
import { SCALE } from './constants.js';
import { LIMELIGHT_HEX } from '../data/gameConstants.js';

export function arenaPoint(num, height=.18) {
  const h=HEX_BY_NUM[num];return h?new THREE.Vector3((h.px-3255)/200,height,(h.py-2415)/200):null;
}
const pointXY=(x,y,height=.2)=>new THREE.Vector3((x/SCALE-3255)/200,height,(y/SCALE-2415)/200);
const STATIONS={blue:['NW','W-N'],purple:['SW','W-S'],yellow:['NE','E-N'],red:['SE','E-S']};
const glow=(color,opacity=.8)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});

// These are the authored preview miniatures, moved into the match renderer.
// They deliberately remain presentation-only: React's projected SVG continues
// to own hit targets, rules, labels, and ability overlays.
//
// The pawns are intentionally in the final transparent pass at full opacity.
// Board VFX are translucent meshes, so ordinary opaque depth rendering lets a
// long laser or smoke plane visually slice through a Spirit. Rendering this
// solid miniature after those VFX gives the player an unambiguous foreground
// actor without making the board's hazards disappear elsewhere.
function solid(geometry,color,metalness=.5,emission=0) {
  const material=new THREE.MeshStandardMaterial({
    color,metalness,roughness:.38,emissive:color,emissiveIntensity:emission,
    transparent:true,opacity:1,depthTest:false,depthWrite:false,
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=100;return mesh;
}
function spiritMiniature(spirit) {
  const g=new THREE.Group();g.name=`Spirit miniature: ${spirit.id}`;
  // Pawns are the foreground read in the 3D board. A deliberately chunky scale
  // makes them legible against the island and from the default arena camera.
  g.renderOrder=100;g.scale.setScalar(1.28);
  const color=new THREE.Color(spirit.color ?? '#88ccff');
  const base=solid(new THREE.CylinderGeometry(.46,.52,.16,6),0x111a2d,.65,.08);base.position.y=.03;g.add(base);
  const halo=solid(new THREE.TorusGeometry(.57,.055,6,36),color,.2,3.4);halo.rotation.x=Math.PI/2;halo.position.y=.16;g.add(halo);
  const torso=solid(new THREE.BoxGeometry(.53,.58,.32),color.clone().multiplyScalar(.42),.55,.18);torso.position.y=.82;g.add(torso);
  const chest=solid(new THREE.BoxGeometry(.12,.42,.34),color,.3,1.2);chest.position.y=.84;g.add(chest);
  for(const x of [-.17,.17]) {const leg=solid(new THREE.BoxGeometry(.17,.42,.18),0x151b2d,.6,.06);leg.position.set(x,.34,0);g.add(leg);}
  const head=solid(new THREE.IcosahedronGeometry(.235,1),0xb8c4d8,.8,.12);head.position.y=1.31;g.add(head);
  const visor=solid(new THREE.BoxGeometry(.37,.06,.08),color,.2,3.2);visor.position.set(0,1.32,.19);g.add(visor);
  if(spirit.id==='cosmic_ronin') {const hat=solid(new THREE.ConeGeometry(.36,.12,6),0x172339);hat.position.y=1.31;g.add(hat);}
  if(spirit.id==='Metalness_Monster') {
    for(const x of [-.2,.2]) {const horn=solid(new THREE.ConeGeometry(.085,.28,5),0xc3ac8c);horn.position.set(x,1.3,0);horn.rotation.z=-Math.sign(x)*.5;g.add(horn);}
    torso.scale.x=1.3;
  }
  const instrument=new THREE.Group();
  instrument.add(solid(new THREE.BoxGeometry(.32,.39,.11),color,.7,.4));
  const neck=solid(new THREE.BoxGeometry(.065,.72,.08),0xe5e9f4,.7,.08);neck.position.y=.48;instrument.add(neck);
  instrument.position.set(.21,.72,.34);instrument.rotation.z=-.65;g.add(instrument);
  return g;
}

export function releaseArenaObject(object) {
  // Cloned cabinets share geometry; dispose each resource once per subtree.
  const resources=new Set();
  object.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]) {
    resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);
  }});
  for(const r of resources)r.dispose();
}

export function createArenaVisuals(scene) {
  const root=new THREE.Group();root.name='Live match effects';scene.add(root);
  const hazards=new THREE.Group();root.add(hazards);
  const effects=[],rigs=new Map(),pawns=new Map(),seen=new Set();
  let previous=null,hazardKey='',frame={},clock=0,lastTick=0,disposed=false;
  const pulse=(point,color,owners=[],kind='pulse')=>{
    if(!point)return;
    const mesh=new THREE.Mesh(new THREE.TorusGeometry(.45,.035,6,40),glow(color));
    mesh.rotation.x=Math.PI/2;mesh.position.copy(point);root.add(mesh);
    effects.push({mesh,start:clock,duration:.8,kind,owners});
  };
  const tube=(points,color,radius=.035)=>{
    const curve=new THREE.CatmullRomCurve3(points);
    return new THREE.Mesh(new THREE.TubeGeometry(curve,32,radius,5,false),glow(color));
  };
  const once=(key,fn)=>{if(seen.has(key))return;seen.add(key);if(seen.size>128)seen.delete(seen.values().next().value);fn();};
  const trail=(from,to,color,id)=>{
    if(!from||!to)return;
    const mid=from.clone().lerp(to,.5);mid.y+=Math.min(2,from.distanceTo(to)*.2);
    const mesh=tube([from,mid,to],color);root.add(mesh);
    effects.push({mesh,start:clock,duration:.7,kind:'trail',owners:[id]});pulse(to,color,[id]);
  };
  const attack=battle=>{
    const a=previous.spirits?.find(s=>s.id===battle.attackerId),b=previous.spirits?.find(s=>s.id===battle.defenderId);
    if(!frame.spirits?.some(s=>s.id===a?.id)||!frame.spirits?.some(s=>s.id===b?.id))return;
    const from=arenaPoint(a?.num,.7),to=arenaPoint(b?.num,.7);if(!from||!to)return;
    const owners=[a.id,b.id];
    const mesh=tube([from,from.clone().lerp(to,.5).add(new THREE.Vector3(0,battle.sonic ? .15 : 1.1,0)),to],battle.sonic?0x55cfff:0xffba66,battle.sonic ? .12 : .07);
    root.add(mesh);effects.push({mesh,start:clock,duration:.9,kind:'trail',owners});
    pulse(to,battle.sonic?0x55cfff:0xffaa44,owners);
  };
  function clearEffects() {for(const fx of effects){root.remove(fx.mesh);releaseArenaObject(fx.mesh);}effects.length=0;}
  function updateHazards(next) {
    const key=JSON.stringify([next.laser,next.pyro,next.smoke,next.slime,next.fire,next.vortex,next.bots]);
    if(key===hazardKey)return;hazardKey=key;
    for(const o of [...hazards.children]){hazards.remove(o);releaseArenaObject(o);}
    const disc=(num,color,radius=.75,height=.2)=>{
      const p=arenaPoint(num,height);if(!p)return null;
      const m=new THREE.Mesh(new THREE.CircleGeometry(radius,24),glow(color,.3));m.rotation.x=-Math.PI/2;m.position.copy(p);hazards.add(m);return m;
    };
    for(const n of next.slime??[]) {
      const m=disc(n,0x64ff72);if(m)m.userData.kind='slime';
    }
    for(const line of next.laser??[]) {
      const pts=line.map(n=>arenaPoint(n,.7)).filter(Boolean);
      if(pts.length>1){const m=tube([pts[0],pts.at(-1)],0xff3388,.065);m.userData.kind='laser';hazards.add(m);}
    }
    const burning=new Set([...(next.fire??[]),...(next.pyro?.phase!=='arming'?next.pyro?.hexes??[]:[])]);
    for(const n of next.pyro?.phase==='arming'?next.pyro.hexes:[])disc(n,0xff5522,.7);
    for(const n of burning) {
      const p=arenaPoint(n,.75);if(!p)continue;
      const flame=new THREE.Mesh(new THREE.ConeGeometry(.35,1.4,7),glow(0xff7922,.65));flame.position.copy(p);flame.userData.kind='fire';hazards.add(flame);
      disc(n,0xff6622,.7);
    }
    if(next.vortex) {
      const p=arenaPoint(next.vortex.hex,.3);
      if(p) {const m=new THREE.Mesh(new THREE.TorusGeometry(.6,.12,8,40),glow(0x9544ff));m.rotation.x=Math.PI/2;m.position.copy(p);m.userData.kind='vortex';hazards.add(m);}
    }
    for(const bot of next.bots??[]) {
      const p=arenaPoint(bot.hex,.55);if(!p)continue;
      const m=new THREE.Mesh(new THREE.OctahedronGeometry(.48),new THREE.MeshStandardMaterial({color:0x526a7b,metalness:.8,roughness:.28,emissive:bot.color??0x22ccbb,emissiveIntensity:.5}));
      m.position.copy(p);m.userData.kind='bot';hazards.add(m);
    }
    if(next.smoke) {
      // The original SVG smoke remains the visibility mask. These puffs add
      // volume only; they never decide whether a spirit is visible.
      const center=arenaPoint(LIMELIGHT_HEX,.7);
      if(center)for(let i=0;i<10;i++) {
        const m=new THREE.Mesh(new THREE.SphereGeometry(.8,10,8),new THREE.MeshBasicMaterial({color:0x91a1b6,transparent:true,opacity:.13,depthWrite:false}));
        const r=Math.max(1,next.smoke.radius)*.7;const a=i*2.4;
        m.position.copy(center).add(new THREE.Vector3(Math.cos(a)*r,.2+(i%3)*.35,Math.sin(a)*r));m.userData.kind='smoke';hazards.add(m);
      }
    }
  }
  function updatePawns(next) {
    const live=new Set();
    for(const spirit of next.spirits??[]) {
      live.add(spirit.id);
      let pawn=pawns.get(spirit.id);
      if(!pawn) {
        pawn=spiritMiniature(spirit);
        const start=arenaPoint(spirit.num,.34);
        pawn.position.copy(start ?? new THREE.Vector3());
        pawn.userData.target=start?.clone() ?? new THREE.Vector3();
        pawn.userData.targetFacing=(spirit.facing ?? 0)+Math.PI/2;
        root.add(pawn);pawns.set(spirit.id,pawn);
      }
      const target=arenaPoint(spirit.num,.34);if(target)pawn.userData.target.copy(target);
      pawn.userData.targetFacing=(spirit.facing ?? 0)+Math.PI/2;
      pawn.userData.knockedOut=!!spirit.knockedOut;
      pawn.userData.active=spirit.id===next.actingId;
      pawn.visible=true;
    }
    for(const [id,pawn] of pawns)if(!live.has(id)) {root.remove(pawn);releaseArenaObject(pawn);pawns.delete(id);}
  }
  function attachModel(model) {
    for(const ids of Object.values(STATIONS))for(const id of ids) {
      const original=model.getObjectByName(`Amp_${id}`);if(!original)continue;
      const levels=[original];
      for(let i=1;i<3;i++) {const copy=original.clone(true);copy.name=`Amp_${id}_tier_${i+1}`;copy.position.y+=i*1.35;copy.visible=false;model.add(copy);levels.push(copy);}
      const materials=[];
      for(const level of levels) {
        const own=[];
        level.traverse(o=>{if(!o.material)return;const clone=m=>{const c=m.clone();c.userData.baseEmission=c.emissiveIntensity;own.push(c);return c;};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});materials.push(own);
      }
      rigs.set(id,{levels,materials});
    }
  }
  function update(next) {
    frame=next??{};
    const visible=new Set((frame.spirits??[]).map(s=>s.id));
    // A smoke transition must also erase trails already in flight.
    for(let i=effects.length-1;i>=0;i--)if(effects[i].owners.some(id=>!visible.has(id))) {
      const [fx]=effects.splice(i,1);root.remove(fx.mesh);releaseArenaObject(fx.mesh);
    }
    updateHazards(frame);
    updatePawns(frame);
    for(const [station,rig] of rigs) {
      const owner=frame.rigs?.find(r=>STATIONS[r.corner]?.includes(station));
      rig.owner=owner;
      rig.levels.forEach((level,i)=>{
        level.visible=!!owner&&i<owner.pool;
        for(const m of rig.materials[i]) {
          if(/Rim|Status|Hex cyan/.test(m.name)) {
            m.emissive.set(owner?.color??0x445577);m.emissiveIntensity=owner?(i<owner.power?2.8:.7):.15;
          }
        }
      });
    }
    if(previous) {
      for(const s of frame.spirits??[]) {
        const old=previous.spirits?.find(p=>p.id===s.id);
        if(old&&!s.knockedOut&&!old.knockedOut&&s.num!==old.num&&!frame.slides?.some(a=>a.id===s.id))trail(arenaPoint(old.num),arenaPoint(s.num),s.color,s.id);
      }
      if(!frame.battle&&previous.battle)attack(previous.battle);
    }
    if(frame.thump)once(`thump:${frame.thump.id}:${frame.thump.key}`,()=>{
      for(const rig of rigs.values())if(rig.owner?.id===frame.thump.id)rig.thumpUntil=clock+.45;
    });
    for(const f of frame.flashes??[])once(`flash:${f.key}`,()=>pulse(arenaPoint(frame.spirits.find(s=>s.id===f.spiritId)?.num),f.color,[f.spiritId]));
    if(frame.tentacle)once(`arm:${frame.tentacle.key}`,()=>{
      const pts=frame.tentacle.pts.map(p=>pointXY(p.x,p.y,.6));
      if(pts.length>1){const mesh=tube(pts,0x72ff99,.18);root.add(mesh);effects.push({mesh,start:clock,duration:1.1,kind:'trail',owners:[]});}
    });
    for(const slide of frame.slides??[]) {
      // Object is held by the client for four seconds; presence edge, not a
      // timer guessed from the engine, starts this local visual once.
      if(previous?.slides?.some(s=>s.id===slide.id))continue;
      const mat=new THREE.SpriteMaterial({color:0xffffff,transparent:true,depthTest:true});
      const mesh=new THREE.Sprite(mat);mesh.position.copy(pointXY(slide.cx,slide.cy,1));mesh.scale.set(2.8,2.8,1);root.add(mesh);
      if(slide.imageSrc) {
        // Own the texture directly: cloning before its image loads can leave
        // the falling standee blank. Late loads cannot resurrect expired FX.
        mat.map=new THREE.TextureLoader().load(slide.imageSrc,texture=>{
          if(disposed||!mesh.parent)texture.dispose();
        });
        mat.map.colorSpace=THREE.SRGBColorSpace;
      } else mat.color.set(slide.color??0xffffff);
      effects.push({mesh,start:clock,duration:4,kind:'fall',owners:[slide.id],from:mesh.position.clone(),dir:new THREE.Vector3(slide.dx,0,slide.dy).normalize()});
    }
    previous=frame;
  }
  return {
    attachModel,update,
    tick(time,reduced=false) {
      const dt=Math.min(.05,Math.max(0,time-lastTick));lastTick=time;clock=time;
      for(const pawn of pawns.values()) {
        const target=pawn.userData.target;
        pawn.position.lerp(target,reduced?1:1-Math.exp(-dt*14));
        const turn=pawn.userData.targetFacing;
        pawn.rotation.y=THREE.MathUtils.damp(pawn.rotation.y,turn,14,dt);
        const knocked=pawn.userData.knockedOut;
        pawn.rotation.z=THREE.MathUtils.damp(pawn.rotation.z,knocked?Math.PI*.48:0,10,dt);
        const scale=knocked ? .72 : 1+(pawn.userData.active&&!reduced?Math.sin(time*4)*.025:0);
        pawn.scale.setScalar(scale);
        pawn.position.y=(target?.y ?? .2)+(knocked ? .02 : !reduced?Math.sin(time*2.4+pawn.position.x)*.025:0);
      }
      for(const rig of rigs.values())rig.levels.forEach((level,i)=>{
        const thump=!reduced&&clock<(rig.thumpUntil??0)?1+Math.sin((rig.thumpUntil-clock)*30)*.025:1;
        level.scale.setScalar(thump);
        for(const m of rig.materials[i])if(/Status/.test(m.name)&&rig.owner)m.emissiveIntensity=(i<rig.owner.power?2.8:.7)*(1+(reduced?0:.1*Math.sin(time*2+rig.owner.radius)));
      });
      for(const o of hazards.children) {
        const kind=o.userData.kind,t=reduced?0:time;
        if(kind==='fire')o.scale.y=1+Math.sin(t*8+o.position.x)*.2;
        if(kind==='bot')o.rotation.y=t*.5;
        if(kind==='vortex')o.rotation.z=t;
        if(kind==='smoke')o.scale.setScalar(1+Math.sin(t*.5+o.position.x)*.08);
        if(kind==='laser')o.material.opacity=.65+(reduced?0:Math.sin(t*9)*.12);
      }
      for(let i=effects.length-1;i>=0;i--) {
        const fx=effects[i],t=Math.min(1,(time-fx.start)/fx.duration);
        if(t>=1){root.remove(fx.mesh);releaseArenaObject(fx.mesh);effects.splice(i,1);continue;}
        if(fx.kind==='fall') {
          fx.mesh.position.copy(fx.from).addScaledVector(fx.dir,reduced?0:t*8);
          fx.mesh.position.y-=reduced?0:t*t*22;fx.mesh.material.rotation=reduced?0:t*3;fx.mesh.material.opacity=1-t;
        } else {fx.mesh.material.opacity=(1-t)*.8;if(fx.kind==='pulse')fx.mesh.scale.setScalar(reduced?1:1+t*4);}
      }
    },
    diagnostics:()=>({rigStations:rigs.size,liveCabinets:[...rigs.values()].reduce((n,r)=>n+r.levels.filter(o=>o.visible).length,0),effects:effects.length,hazards:hazards.children.length}),
    dispose(){disposed=true;clearEffects();for(const pawn of pawns.values())releaseArenaObject(pawn);pawns.clear();},
    get disposed(){return disposed;},
  };
}
