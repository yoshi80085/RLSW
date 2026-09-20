import * as THREE from 'three';
import { createArenaDiceSequence } from './arenaDiceSequence.js';
import { sonicSceneLabel } from './sonicDiceVisuals.js';
import { SWING_TIMING as T } from './swingTiming.js';

export const knockbackWobble = (vibe,maxVibe) => .035+.3*(1-THREE.MathUtils.clamp((vibe??1)/Math.max(1,maxVibe??1),0,1));

// Two cheap, fixed silhouettes. Only the carrier shakes; limbs never tween.
export function createClashFigure(color, strike=false) {
  const group=new THREE.Group(),material=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.3,roughness:.5});
  const rod=(a,b,r=.055)=>{
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),material);
    mesh.position.copy(from).add(to).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());group.add(mesh);
  };
  const head=new THREE.Mesh(new THREE.SphereGeometry(.2,8,6),material);head.position.y=1.95;group.add(head);
  const faceMaterial=new THREE.MeshBasicMaterial({color:'#171927'}),face=new THREE.Group();face.name='Furrowed brow';
  for(const sign of [-1,1]){
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.022,5,4),faceMaterial);eye.position.set(sign*.067,1.96,.186);face.add(eye);
    const brow=new THREE.Mesh(new THREE.BoxGeometry(.115,.027,.026),faceMaterial);
    brow.position.set(sign*.068,2.015,.188);brow.rotation.z=sign*.36;face.add(brow);
  }
  group.add(face);
  rod([0,.9,0],[0,1.7,0]);
  for(const x of [-.38,.38])rod([x,.08,0],[0,.9,0]);
  const hand=strike?[0,1.62,.65]:[0,2.4,-.12];
  for(const x of [-.35,.35]){rod([0,1.6,0],[x,1.9,strike?.25:-.2]);rod([x,1.9,strike?.25:-.2],hand);}
  const tip=strike?[0,1.65,1.12]:[0,2.85,-.12];
  rod(hand,tip,.1);
  const body=new THREE.Mesh(new THREE.BoxGeometry(.38,.42,.16),material);
  body.position.set(...tip);group.add(body);
  group.userData.material=material;
  return group;
}

export function createSwingClashVisuals({battle,attacker,defender,pointFor,ampOrigins=[]}) {
  const group=new THREE.Group();group.name='Swing clash';
  const a=pointFor(attacker.num,.2),b=pointFor(defender.num,.2),mid=a.clone().lerp(b,.5);
  const lane=b.clone().sub(a).setY(0).normalize();
  const dice=createArenaDiceSequence({drive:battle.diceVals,sustain:battle.defenderDiceVals,
    driveSides:battle.dicePool[0]??6,sustainSides:battle.defenderDicePool[0]??6,defenderTitle:'RIVAL DRIVE'});
  dice.group.scale.setScalar(.65);dice.group.position.copy(mid).add(new THREE.Vector3(-lane.z,0,lane.x).multiplyScalar(3.4));
  dice.group.position.z-=4;group.add(dice.group);
  const figures=[attacker,defender].map((s,i)=>{
    const carrier=new THREE.Group(),ready=createClashFigure(s.color),strike=createClashFigure(s.color,true);
    carrier.add(ready,strike);carrier.position.copy(i?b:a);carrier.rotation.y=Math.atan2(lane.x,lane.z)+(i?Math.PI:0);
    group.add(carrier);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,1,8),new THREE.MeshBasicMaterial({color:s.color,transparent:true,opacity:.7,toneMapped:false}));
    group.add(beam);
    return {carrier,ready,strike,beam,start:(i?b:a).clone(),end:mid.clone().addScaledVector(lane,i?1.12:-1.12),origin:ampOrigins[i]};
  });
  const caption=sonicSceneLabel('', '#ffe7ad',5,.65);caption.sprite.position.copy(mid).add(new THREE.Vector3(0,3.4,0));group.add(caption.sprite);
  let lastLabel;
  function update(t,{reduced=false}={}) {
    dice.update(t-T.dice,{reduced,visible:t>=T.dice&&t<T.clash});
    const charge=THREE.MathUtils.clamp((t-T.charge)/2,0,1),clash=t>=T.clash,power=THREE.MathUtils.clamp((t-T.clash)/2.75,0,1);
    const label=t<T.dice?'READY TO CLASH':t<T.charge?'SWING · DRIVE vs DRIVE':t<T.clash?'DRIVE AMPS · CHARGING':t<T.result
      ?`${battle.atkTotal}  ⚔  ${battle.defTotal}`:battle.tied?'EVEN CLASH':`−${battle.damage} VIBE`;
    if(label!==lastLabel){caption.write(label);lastLabel=label;}
    for(const [i,f] of figures.entries()){
      f.ready.visible=!clash;f.strike.visible=clash;
      f.carrier.position.copy(f.start).lerp(f.end,charge);
      const strength=(i?battle.defTotal:battle.atkTotal);
      f.carrier.rotation.z=reduced?0:Math.sin(t*(20+strength*.5))*(clash?.012+Math.min(strength,60)*.0018*power:0);
      f.ready.userData.material.emissiveIntensity=.3+charge*1.8;
      f.strike.userData.material.emissiveIntensity=2.1+power*2;
      f.beam.visible=!!f.origin&&t>=T.charge&&t<T.result;
      if(f.origin){
        const target=f.carrier.position.clone().add(new THREE.Vector3(0,clash?1.65:2.65,0));
        target.addScaledVector(lane,clash?(i?-.9:.9):0);
        const direction=target.clone().sub(f.origin);
        f.beam.position.copy(f.origin).add(target).multiplyScalar(.5);
        f.beam.scale.y=direction.length();
        f.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
        f.beam.material.opacity=reduced?.7:.55+.25*Math.sin(t*18);
      }
    }
    group.updateWorldMatrix(true,true);
    if(t<T.dice){
      const i=t<T.attacker?0:1,f=figures[i];
      return {kind:'face',point:f.carrier.position.clone().add(new THREE.Vector3(0,1.95,0)),
        direction:lane.clone().multiplyScalar(i?-1:1)};
    }
    if(t<T.charge){
      const reading=t>=T.read,pool=t<T.read+1?0:1;
      const entries=dice.entries.filter(e=>e.die.group.visible&&(!reading||e.pool===pool));
      const points=entries.map(e=>e.die.group.getWorldPosition(new THREE.Vector3()));
      if(reading)points.push(dice.group.localToWorld(new THREE.Vector3(1,.03,pool?10.4:6.4)));
      return {kind:reading?'result':'dice',points:points.length?points:diceBounds};
    }
    return {kind:'clash',points:[a,b,a.clone().setY(3.5),b.clone().setY(3.5)]};
  }
  const diceBounds=[[-6,0,2],[8,4,11]].map(v=>new THREE.Vector3(...v).multiplyScalar(.65).add(dice.group.position));
  return {group,diceBounds,update,dispose(){dice.dispose();caption.texture?.dispose();group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});group.clear();}};
}
