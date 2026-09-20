import * as THREE from 'three';
import {createSonicZigzagVisuals,FLIGHT_SECONDS} from './sonicZigzagVisuals.js';
import {sonicSceneLabel} from './sonicDiceVisuals.js';
import {BARRAGE_FLIGHT,BARRAGE_SPACING,BARRAGE_CARRY,barrageContact,barrageSimulationTime} from './sonicBarrageTiming.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),clamp=THREE.MathUtils.clamp;

// The preview's rings, degrading panels, cracks and spillover, on the real board.
export function createSonicBarrageVisuals(options) {
 const {battle,defenderPosition:defender,attackerPosition:attacker}=options;
 const scene=new THREE.Group();scene.name='Sonic shieldbreaker barrage';
 const back=attacker.clone().sub(defender).setY(0).normalize();
 const radius=Math.min(2.2,attacker.distanceTo(defender)*.42);
 const glow=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});
 const mesh=(geometry,material,parent=scene)=>{const m=new THREE.Mesh(geometry,material);parent.add(m);return m;};
 const shield=new THREE.Group();shield.position.copy(defender);shield.rotation.y=Math.atan2(back.x,back.z);scene.add(shield);
 const panels=[],cracks=[],shards=[];const arc=Math.PI*.72;
 for(let i=0;i<18;i++){
  const angle=-arc/2+i*arc/18;
  const panel=mesh(new THREE.CylinderGeometry(radius,radius,2.5,3,1,true,angle,arc/18-.014),glow('#44aaff',.32),shield);panels.push(panel);
  for(const y of [-1.25,1.25]){const rim=mesh(new THREE.CylinderGeometry(radius,radius,.07,3,1,true,angle,arc/18-.014),glow('#a8deff',.95),panel);rim.position.y=y;}
  const pts=[];for(let j=0;j<7;j++){const a=angle+arc/36+Math.sin(j*4+i)*.035;pts.push(Math.sin(a)*(radius+.02),-1.15+j*.37,Math.cos(a)*(radius+.02));}
  const line=new THREE.Line(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(pts,3)),new THREE.LineBasicMaterial({color:'#ffb596',transparent:true,opacity:0}));shield.add(line);cracks.push(line);
  const shard=mesh(new THREE.TetrahedronGeometry(.17+(i%3)*.045,0),glow('#bfa0ff',0));shard.visible=false;shards.push(shard);
 }

 // The smaller defending stack visibly feeds the shield, separate from Drive.
 const feed=new THREE.Group();feed.name='Sustain amp feed';scene.add(feed);
 let feedCurve=null;const motes=[];
 if(options.sustainOrigin&&battle.shieldValue>0){
  const origin=options.sustainOrigin,contact=defender.clone().addScaledVector(back,radius);
  feedCurve=new THREE.CatmullRomCurve3([origin,origin.clone().lerp(contact,.5).add(V(0,1.6,0)),contact]);
  mesh(new THREE.TubeGeometry(feedCurve,40,.035,6,false),glow('#44aaff',.3),feed);
  for(let i=0;i<7;i++)motes.push(mesh(new THREE.SphereGeometry(.1,8,6),glow('#88d7ff',.9),feed));
 }
 const launchHalos=(options.ampOrigins??[]).map(origin=>{
  const halo=mesh(new THREE.TorusGeometry(.65,.055,6,32),glow('#ff6644',.8));
  halo.position.copy(origin);halo.quaternion.setFromUnitVectors(V(0,0,1),attacker.clone().sub(origin).normalize());return halo;
 });
 const plan={...battle,maxHp:battle.shieldValue,shots:battle.shots};
 const hpLabel=sonicSceneLabel('', '#b9dcff',2.8,.42);scene.add(hpLabel.sprite);
 const packets=plan.shots.map(shot=>{
  const visual=createSonicZigzagVisuals({...options,shieldValue:0,shieldRadius:radius,
   dice:[{value:shot.strength,sides:battle.dicePool[shot.index],passed:shot.before===0}],
   ampOrigins:options.ampOrigins?.length?[options.ampOrigins[shot.index%options.ampOrigins.length]]:undefined,
   intensityMode:'face',tuning:{slowmo:18,burst:2.1,ringTail:16}});
  scene.add(visual.group);
  const carry=new THREE.Group();scene.add(carry);
  for(let j=0;j<4;j++){
   const ring=mesh(new THREE.TorusGeometry(.19+.032*shot.through,.03,5,24),glow('#c0f3ff',.8),carry);
   ring.quaternion.setFromUnitVectors(V(0,0,1),back);ring.position.copy(back).multiplyScalar(j*.22);
  }
  return {visual,carry,shot};
 });
 let focus=null,lastHp=null;
 function update(elapsed,{camera,reduced=false,interrupted=false}={}) {
  const time=barrageSimulationTime(battle,elapsed,reduced);
  const landed=plan.shots.filter(s=>time>=barrageContact(s.index));
  const hp=landed.at(-1)?.after??plan.maxHp,state={hp},ratio=plan.maxHp?hp/plan.maxHp:0;
  const breakTime=plan.breakIndex>=0?barrageContact(plan.breakIndex):Infinity,breakAge=time-breakTime;
  const latest=landed.at(-1),hitAge=latest?time-barrageContact(latest.index):Infinity;
  for(const {visual,carry,shot} of packets){
   const age=time-shot.index*BARRAGE_SPACING;
   visual.update(age*FLIGHT_SECONDS/BARRAGE_FLIGHT,{camera,reduced});
   for(const name of ['Sustain holds','Sustain compression','Sustain surface ripple']){
    const node=visual.group.getObjectByName(name);if(node)node.visible=false;
   }
   if(shot.before===0){const splash=visual.group.getObjectByName('Sustain splash');if(splash)splash.visible=false;}
   const passAge=time-barrageContact(shot.index);
   carry.visible=shot.before>0&&shot.through>0&&passAge>=0&&passAge<BARRAGE_CARRY;
   carry.position.copy(defender).addScaledVector(back,radius*(1-clamp(passAge/BARRAGE_CARRY,0,1)));
  }
  feed.visible=!!feedCurve&&time>=-2&&hp>0;
  motes.forEach((m,i)=>{m.position.copy(feedCurve.getPoint(((Math.max(0,time+2)*.8+i/7)%1)));});
  launchHalos.forEach(halo=>{
    const age=time<0?Infinity:time-Math.floor(time/BARRAGE_SPACING)*BARRAGE_SPACING;
    halo.visible=time>=0&&time<plan.shots.length*BARRAGE_SPACING;
    halo.scale.setScalar(reduced?1:1+age*2);halo.material.opacity=.9*(1-age/BARRAGE_SPACING);
  });
  shield.visible=plan.maxHp>0&&(state.hp>0||breakAge<.17);
  shield.scale.setScalar(1+(reduced?0:Math.max(0,1-hitAge/.18)*.035));
  panels.forEach((p,i)=>{
   const wear=1-ratio,rank=((i*7)%18)/18;
   const charge=time<0?.35:1;
   p.material.color.set(state.hp>0&&ratio<.3?'#de7a99':'#44aaff');
   p.material.opacity=(.1+ratio*.22)*(rank<wear*.6?.28:1)*charge;
   for(const rim of p.children)rim.material.opacity=.95*charge;
   p.visible=breakAge<0||Math.abs((i+.5)/18-.5)>breakAge/.17*.5;
   cracks[i].material.opacity=state.hp>0&&rank<wear?.35+wear*.6:0;
  });
  shards.forEach((s,i)=>{
   s.visible=!reduced&&breakAge>=0&&breakAge<.7;
   if(!s.visible)return;
   const angle=i*2.399;s.position.copy(defender).add(back.clone().multiplyScalar(radius).add(V(Math.cos(angle)*breakAge*4,.2+Math.sin(angle)*breakAge*4,Math.cos(i)*breakAge*4)));
   s.rotation.set(breakAge*(i%3+2),breakAge*5,i);s.material.opacity=1-clamp(breakAge/.7,0,1);
  });

  if(hp!==lastHp){hpLabel.write(`SHIELD ${hp} / ${plan.maxHp} HP`);lastHp=hp;}
  hpLabel.sprite.position.copy(defender).add(V(0,1.8,0));
  hpLabel.sprite.visible=elapsed>=0&&!interrupted;
  scene.visible=!interrupted;
  const index=Math.max(0,Math.min(packets.length-1,Math.floor(Math.max(0,time-BARRAGE_FLIGHT)/BARRAGE_SPACING)));
  focus=packets[index]?.visual.getFocus((time-index*BARRAGE_SPACING)*FLIGHT_SECONDS/BARRAGE_FLIGHT,{reduced});
  const projectiles=packets.flatMap(({visual,shot})=>{
    const age=time-shot.index*BARRAGE_SPACING;
    const f=age>=0&&age<=BARRAGE_FLIGHT?visual.getFocus(age*FLIGHT_SECONDS/BARRAGE_FLIGHT,{reduced}):null;
    return f?[f.point]:[];
  });
  if(focus)focus={...focus,barrage:true,time,breakAge,shieldHp:hp,projectiles,ampOrigins:options.ampOrigins,aftermath:time>barrageContact(plan.shots.length-1)+BARRAGE_CARRY};
 }
 return {group:scene,update,getFocus:()=>focus,dispose(){
  packets.forEach(p=>p.visual.dispose());hpLabel.texture?.dispose();
  scene.traverse(n=>{n.geometry?.dispose();for(const m of (Array.isArray(n.material)?n.material:[n.material]).filter(Boolean))m.dispose();});
  scene.clear();scene.removeFromParent();
 }};
}
