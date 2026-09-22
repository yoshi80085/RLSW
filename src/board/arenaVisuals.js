import { characterId } from "../data/spiritIdentity.js";
import { BARRAGE_LAUNCH } from './sonicBarrageTiming.js';
import { createSwingClashVisuals, knockbackWobble } from './swingClashVisuals.js';
import { createSonicBarrageVisuals } from './sonicBarrageVisuals.js';
import { createArenaDiceSequence } from './arenaDiceSequence.js';
import * as THREE from 'three';
import { HEX_BY_NUM } from './hexMap.js';
import { SCALE } from './constants.js';
import { LIMELIGHT_HEX } from '../data/gameConstants.js';
import { pitchIndex } from '../music/notes.js';
import { createSonicSequenceVisuals } from './sonicSequenceVisuals.js';
import { createSonicDiceVisuals, sonicSceneLabel } from './sonicDiceVisuals.js';
import { createHeadDials } from './headDialVisuals.js';
import { createMoveTiles } from './moveTiles.js';
import { createStandee, STANDEE, STANDEE_Y, standeeYaw } from './standee.js';

export function arenaPoint(num, height=.18) {
  const h=HEX_BY_NUM[num];return h?new THREE.Vector3((h.px-3255)/200,height,(h.py-2415)/200):null;
}
export const pointXY=(x,y,height=.2)=>new THREE.Vector3((x/SCALE-3255)/200,height,(y/SCALE-2415)/200);
export const AMP_ROLES={blue:{drive:'NW',sustain:'W-N'},purple:{drive:'SW',sustain:'W-S'},yellow:{drive:'NE',sustain:'E-N'},red:{drive:'SE',sustain:'E-S'}};
const STATIONS=Object.fromEntries(Object.entries(AMP_ROLES).map(([corner,roles])=>[corner,Object.values(roles)]));
const glow=(color,opacity=.8)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});

// 🎭 PAWNS ARE STANDEES NOW (Alex, 2026-09-18) — `standee.js`: each Spirit's own
// art, cut out of acrylic and stood on the board. `spiritMiniature` below is the
// FALLBACK, kept on purpose and still the thing a Spirit with no art gets.
//
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
  if(characterId(spirit.id)==='cosmic_ronin') {const hat=solid(new THREE.ConeGeometry(.36,.12,6),0x172339);hat.position.y=1.31;g.add(hat);}
  if(characterId(spirit.id)==='Metalness_Monster') {
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

export function createArenaVisuals(scene, {foregroundScene=scene}={}) {
  const root=new THREE.Group();root.name='Live match effects';scene.add(root);
  const actors=new THREE.Group();actors.name='Foreground spirits';foregroundScene.add(actors);
  const hazards=new THREE.Group();root.add(hazards);
  const effects=[],rigs=new Map(),pawns=new Map(),seen=new Set();
  let previous=null,hazardKey='',frame={},clock=0,lastTick=0,disposed=false,sonic=null,reducedMotion=false;
  let swing=null;
  const clearSwing=()=>{if(swing){actors.remove(swing.group);swing.dispose();swing=null;}for(const pawn of pawns.values())pawn.visible=true;};
  function updateSwing(battle) {
    if(!battle?.swingClash){clearSwing();return;}
    if(swing?.key!==battle.key){
      clearSwing();
      const attacker=frame.spirits.find(s=>s.id===battle.attackerId),defender=frame.spirits.find(s=>s.id===battle.defenderId);
      if(!attacker||!defender)return;
      const ampOrigins=[attacker,defender].map(s=>{
        const cabinet=rigs.get(AMP_ROLES[s.corner]?.drive)?.levels[0];
        if(!cabinet)return null;
        cabinet.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(cabinet).getCenter(new THREE.Vector3());
      });
      swing=createSwingClashVisuals({battle,attacker,defender,ampOrigins,pointFor:arenaPoint});
      swing.key=battle.key;swing.start=clock;actors.add(swing.group);
    }
    for(const id of [battle.attackerId,battle.defenderId]){const pawn=pawns.get(id);if(pawn)pawn.visible=false;}
    battle.swingBounds=battle.phase==='swing_roll'?swing.diceBounds:[];
  }
  // 🎛️ Drive/Sustain over the head of whichever Spirit's number moved — see
  // headDial.js. Fed from the same public frame as the pawns, on the same clock.
  const headDials=createHeadDials(root);
  // 🟪 The hexes you can step to, as magenta tiles in the scene (moveTiles.js).
  const moveTiles=createMoveTiles(root,{pointFor:arenaPoint});
  const clearSonic=()=>{
    if(!sonic)return;
    root.remove(sonic.dice.group,sonic.volley.group);
    sonic.dice.dispose();sonic.volley.dispose();sonic=null;
  };
  function updateSonic(battle) {
    if(!battle?.volley){clearSonic();return;}
    if(sonic?.key!==battle.key) {
      clearSonic();
      const a=frame.spirits?.find(s=>s.id===battle.attackerId),b=frame.spirits?.find(s=>s.id===battle.defenderId);
      const attackerPosition=arenaPoint(a?.num,1),defenderPosition=arenaPoint(b?.num,1);
      if(!attackerPosition||!defenderPosition)return;
      // Fire from the real cabinets after their authored world transform,
      // including the model's Z flip. A corner approximation visibly misses.
      const ampOrigins=[];
      for(const station of (battle.sonicVersion===2?[AMP_ROLES[a.corner]?.drive]:STATIONS[a.corner])??[]) {
        const cabinet=rigs.get(station)?.levels[0];if(!cabinet)continue;
        cabinet.updateWorldMatrix(true,true);
        const bounds=new THREE.Box3().setFromObject(cabinet);
        const origin=bounds.getCenter(new THREE.Vector3());
        origin.y=bounds.min.y+(bounds.max.y-bounds.min.y)*.62;
        ampOrigins.push(origin);
      }
      if(!ampOrigins.length)return; // model is still loading; retry on attach
      const sustainCabinet=rigs.get(AMP_ROLES[b.corner]?.sustain)?.levels[0];
      let sustainOrigin=null;
      if(sustainCabinet){sustainCabinet.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(sustainCabinet);
        sustainOrigin=bounds.getCenter(new THREE.Vector3());sustainOrigin.y=bounds.min.y+(bounds.max.y-bounds.min.y)*.62;}
      const common={attackerPosition,defenderPosition,color:a.color,shieldColor:b.color,hitCount:battle.hitCount,damage:battle.damage,
        chordPitches:(battle.sonicChordNotes??[]).map(pitchIndex),shieldValue:battle.shieldValue};
      const modern=battle.sonicVersion===2;
      const dice=modern?createArenaDiceSequence({drive:battle.diceVals,sustain:battle.sustainRolls,
        driveSides:battle.dicePool[0]??6,sustainSides:battle.sustainPool[0]??6})
        :createSonicDiceVisuals({...common,dicePool:battle.dicePool,diceVals:battle.diceVals,diceHits:battle.diceHits});
      if(modern){
        dice.group.scale.setScalar(.8);
        dice.group.position.copy(attackerPosition).lerp(defenderPosition,.5).setY(.22);
        const lane=defenderPosition.clone().sub(attackerPosition).setY(0).normalize();
        dice.group.position.add(new THREE.Vector3(-lane.z,0,lane.x).multiplyScalar(3.5));
        dice.group.position.x=THREE.MathUtils.clamp(dice.group.position.x,-9,9)-.8;
        dice.group.position.z=THREE.MathUtils.clamp(dice.group.position.z,-9,9)-5.05;
      }
      const volley=(modern?createSonicBarrageVisuals:createSonicSequenceVisuals)({...common,battle,ampOrigins,sustainOrigin,clearance:1.15,shieldRadius:2.4,shieldSize:2.1,strokeStyle:'rings',intensityMode:'margin',
        dice:battle.diceVals.map((value,i)=>({value,passed:battle.diceHits[i],sides:battle.dicePool[i]}))});
      root.add(dice.group,volley.group);
      sonic={key:battle.key,dice,volley,modern,phase:battle.phase,phaseStart:clock,launch:null};
    }
    if(sonic.phase!==battle.phase){sonic.phase=battle.phase;sonic.phaseStart=clock;}
    if(battle.phase==='sonic_volley'&&sonic.launch==null) {
      sonic.launch=clock;
      for(const rig of rigs.values())if(rig.owner?.id===battle.attackerId&&(!sonic.modern||rig.role==='drive'))rig.thumpUntil=clock+.6;
    }
  }
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
    const key=JSON.stringify([next.laser,next.pyro,next.smoke,next.slime,next.fire,next.vortices ?? next.vortex,next.bots]);
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
    for(const vortex of next.vortices ?? (next.vortex ? [next.vortex] : [])) {
      const p=arenaPoint(vortex.hex,.3);
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
        // ⚠️ A standee STANDS ON the deck; the block pawn floated at .34 because
        // it had no stand of its own. Mixing the two heights buries a standee's
        // base in the board, so the height comes from whichever pawn this is.
        const standee=spirit.imageSrc ? createStandee(spirit) : null;
        pawn=standee?standee.group:spiritMiniature(spirit);
        const start=arenaPoint(spirit.num,standee?STANDEE_Y:.34);
        pawn.position.copy(start ?? new THREE.Vector3());
        pawn.userData.target=start?.clone() ?? new THREE.Vector3();
        pawn.userData.targetFacing=standeeYaw(spirit.facing);
        pawn.rotation.y=pawn.userData.targetFacing;   // no spin-up from 0 on the first frame
        actors.add(pawn);pawns.set(spirit.id,pawn);
      }
      const standee=pawn.userData.standee;
      const target=arenaPoint(spirit.num,standee?STANDEE_Y:.34);if(target)pawn.userData.target.copy(target);
      // ⭐ ONE CONVENTION FOR BOTH PAWNS, and it lives in `standeeYaw`. The
      // block used `facing + π/2`, which is the correct mapping MIRRORED about
      // the x axis — 90° out on every diagonal, 180° out north/south. It never
      // showed on a block (no readable front); on a standee it is the difference
      // between looking at a Spirit and looking at its edge.
      pawn.userData.targetFacing=standeeYaw(spirit.facing);
      if(pawn.userData.hitBackCount!=null&&pawn.userData.hitBackCount!==spirit.hitBackCount) pawn.userData.wobbleUntil=clock+1.7;
      pawn.userData.hitBackCount=spirit.hitBackCount;
      pawn.userData.num=spirit.num;pawn.userData.vibe=spirit.vibe;pawn.userData.maxVibe=spirit.maxVibe;
      pawn.userData.knockedOut=!!spirit.knockedOut||!!spirit.fallen;
      pawn.userData.active=spirit.id===next.actingId;
      if(spirit.pendingSustainFray>0&&!pawn.userData.wearLabel) {
        const badge=sonicSceneLabel('',spirit.color??'#aaddff',3.2,.4);
        badge.sprite.position.y=pawn.userData.standee?STANDEE.height+.4:1.85;pawn.add(badge.sprite);pawn.userData.wearLabel=badge;
      }
      const badge=pawn.userData.wearLabel;
      if(badge) {
        badge.sprite.visible=spirit.pendingSustainFray>0;
        const text=`SUSTAIN −${spirit.pendingSustainFray} NEXT TURN`;
        if(badge.sprite.userData.text!==text)badge.write(text);
      }
      pawn.visible=true;
    }
    for(const [id,pawn] of pawns)if(!live.has(id)) {actors.remove(pawn);releaseArenaObject(pawn);pawns.delete(id);}
  }
  function attachModel(model) {
    model.updateWorldMatrix(true,true); // include the arena Z flip in stack labels and origins
    for(const ids of Object.values(STATIONS))for(const id of ids) {
      const original=model.getObjectByName(`Amp_${id}`);if(!original)continue;
      const levels=[original];
      for(let i=1;i<3;i++) {const copy=original.clone(true);copy.name=`Amp_${id}_tier_${i+1}`;copy.position.y+=i*1.35;copy.visible=false;model.add(copy);levels.push(copy);}
      const materials=[];
      for(const level of levels) {
        const own=[];
        level.traverse(o=>{if(!o.material)return;const clone=m=>{const c=m.clone();c.userData.baseEmission=c.emissiveIntensity;own.push(c);return c;};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);});materials.push(own);
      }
      const role=Object.values(AMP_ROLES).some(r=>r.drive===id)?'drive':'sustain';
      const badge=sonicSceneLabel(role.toUpperCase(),role==='drive'?'#ff6644':'#44aaff',2.1,.4);
      const bounds=new THREE.Box3().setFromObject(original);
      badge.sprite.position.copy(bounds.getCenter(new THREE.Vector3())).setY(bounds.max.y+.35);root.add(badge.sprite);
      rigs.set(id,{levels,materials,role,badge});
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
    headDials.update(frame.spirits,clock*1000,{reduced:reducedMotion});
    moveTiles.update(frame.reach,frame.spirits);
    for(const [station,rig] of rigs) {
      const owner=frame.rigs?.find(r=>STATIONS[r.corner]?.includes(station));
      rig.owner=owner;rig.badge.sprite.visible=!!owner;
      rig.levels.forEach((level,i)=>{
        level.visible=!!owner&&i<owner.pool;
        for(const m of rig.materials[i]) {
          if(/Rim|Status|Hex cyan/.test(m.name)) {
            m.emissive.set(owner?(rig.role==='drive'?0xff6644:0x44aaff):0x445577);m.emissiveIntensity=owner?(i<owner.power?2.8:.7):.15;
          }
        }
      });
    }
    if(previous) {
      for(const s of frame.spirits??[]) {
        const old=previous.spirits?.find(p=>p.id===s.id);
        if(old&&!s.knockedOut&&!old.knockedOut&&s.num!==old.num&&!frame.slides?.some(a=>a.id===s.id))trail(arenaPoint(old.num),arenaPoint(s.num),s.color,s.id);
      }
      if(!frame.battle&&previous.battle&&!previous.battle.volley&&!previous.battle.swingClash)attack(previous.battle);
    }
    updateSonic(frame.battle);
    updateSwing(frame.battle);
    if(frame.thump)once(`thump:${frame.thump.id}:${frame.thump.key}`,()=>{
      for(const rig of rigs.values())if(rig.owner?.id===frame.thump.id&&rig.role==='drive')rig.thumpUntil=clock+.45;
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
    tick(time,reduced=false,camera=null) {
      const dt=Math.min(.05,Math.max(0,time-lastTick));lastTick=time;clock=time;reducedMotion=reduced;
      if(sonic) {
        if(sonic.modern){
          const started=frame.battle?.sonicRollStartedAt;
          const t=started==null?0:(performance.now()-started)/1000;
          const visible=['sonic_roll','sonic_reveal'].includes(sonic.phase);
          sonic.dice.update(t,{visible,reduced});
          frame.battle.diceFocus=sonic.dice.group.position.clone().add(new THREE.Vector3(.8,0,5.3));
          frame.battle.diceBounds=(t<3.85?[[-6.5,0,2],[8,4,11]]:[[-3,0,3],[5,1,10.8]])
            .map(v=>new THREE.Vector3(...v).multiplyScalar(.8).add(sonic.dice.group.position));
        }else sonic.dice.update(time-sonic.phaseStart,{phase:sonic.phase,reduced});
        const flightTime=sonic.launch==null?(sonic.modern&&frame.battle?.sonicRollStartedAt!=null
          ?(performance.now()-frame.battle.sonicRollStartedAt)/1000-BARRAGE_LAUNCH:-BARRAGE_LAUNCH):frame.battle?.sonicStartedAt!=null
          ? (performance.now()-frame.battle.sonicStartedAt)/1000 : time-sonic.launch;
        const defender=frame.spirits?.find(s=>s.id===frame.battle?.defenderId);
        sonic.volley.update(flightTime,{reduced,camera,defenderPosition:arenaPoint(defender?.num,1)??undefined,
          interrupted:frame.battle?.sonicInterrupted});
        if(frame.battle?.key===sonic.key)frame.battle.focus=sonic.volley.getFocus(flightTime,{reduced});
      }
      for(const pawn of pawns.values()) {
        const target=pawn.userData.target;
        pawn.position.lerp(target,reduced?1:1-Math.exp(-dt*14));
        const turn=pawn.userData.targetFacing;
        pawn.rotation.y=THREE.MathUtils.damp(pawn.rotation.y,turn,14,dt);
        const knocked=pawn.userData.knockedOut;
        const wobble=reduced?0:Math.max(0,(pawn.userData.wobbleUntil??0)-time)/1.7
          *knockbackWobble(pawn.userData.vibe,pawn.userData.maxVibe)*Math.sin(time*23);
        const standee=pawn.userData.standee;
        if(standee) {
          // ⚠️ THE CARRIER OWNS WHERE IT STANDS AND WHICH WAY IT TURNS; THE
          // STANDEE OWNS EVERYTHING ELSE. Leaving the block's rotation.z, scale
          // pulse and bob on here would fight its own lean, fall and sway — and
          // the tip-back under a high camera needs the camera, which only
          // `frame` is given. Nothing below this line may touch the group.
          standee.frame(time,{knockedOut:knocked,active:pawn.userData.active,
            acting:pawn.userData.active,reduced,cameraPos:camera?.position ?? null});
          pawn.position.y=target?.y ?? STANDEE_Y;
          pawn.rotation.z=wobble;
          continue;
        }
        pawn.rotation.z=THREE.MathUtils.damp(pawn.rotation.z,knocked?Math.PI*.48:wobble,10,dt);
        const scale=knocked ? .72 : 1+(pawn.userData.active&&!reduced?Math.sin(time*4)*.025:0);
        pawn.scale.setScalar(scale);
        pawn.position.y=(target?.y ?? .2)+(knocked ? .02 : !reduced?Math.sin(time*2.4+pawn.position.x)*.025:0);
      }
      if(swing)frame.battle.swingFocus=swing.update(frame.battle?.swingStartedAt!=null?(performance.now()-frame.battle.swingStartedAt)/1000:time-swing.start,{reduced});
      for(const rig of rigs.values())rig.levels.forEach((level,i)=>{
        const b=frame.battle;
        const energized=(b?.swingClash&&rig.role==='drive'&&[b.attackerId,b.defenderId].includes(rig.owner?.id)&&['swing_charge','swing_clash'].includes(b.phase))||b?.sonicVersion===2&&(rig.role==='drive'
          ?rig.owner?.id===b.attackerId&&b.phase==='sonic_volley'&&(b.focus?.time??0)<b.diceVals.length*.22
          :rig.owner?.id===b.defenderId&&['sonic_reveal','sonic_volley'].includes(b.phase)&&(b.focus?.shieldHp??b.shieldValue)>0);
        const thump=energized&&!reduced?1+.025*Math.sin(time*28):!reduced&&clock<(rig.thumpUntil??0)?1+Math.sin((rig.thumpUntil-clock)*30)*.025:1;
        level.scale.setScalar(thump);
        for(const m of rig.materials[i])if(/Status/.test(m.name)&&rig.owner)m.emissiveIntensity=(energized?3.2:i<rig.owner.power?2.8:.7)*(1+(reduced?0:.1*Math.sin(time*2+rig.owner.radius)));
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
      headDials.tick(time*1000,camera,pawns,{reduced});
      moveTiles.tick(time*1000,camera,pawns,{reduced});
    },
    diagnostics:()=>({rigStations:rigs.size,liveCabinets:[...rigs.values()].reduce((n,r)=>n+r.levels.filter(o=>o.visible).length,0),effects:effects.length+(sonic?1:0)+(swing?1:0),sonicPhase:sonic?.phase??null,hazards:hazards.children.length,headDials:headDials.active(clock*1000),moveTiles:moveTiles.active(),moveTileDetail:moveTiles.diagnostics()}),
    dispose(){disposed=true;clearSwing();clearSonic();clearEffects();for(const rig of rigs.values()){rig.badge.texture?.dispose();releaseArenaObject(rig.badge.sprite);}headDials.dispose();moveTiles.dispose();for(const pawn of pawns.values())releaseArenaObject(pawn);pawns.clear();},
    get disposed(){return disposed;},
  };
}
