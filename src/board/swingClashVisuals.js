import * as THREE from 'three';
import { createArenaDiceSequence } from './arenaDiceSequence.js';
import { sonicSceneLabel } from './sonicDiceVisuals.js';
import { SWING_TIMING, SWING_DICE } from './swingTiming.js';

export const knockbackWobble = (vibe,maxVibe) => .035+.3*(1-THREE.MathUtils.clamp((vibe??1)/Math.max(1,maxVibe??1),0,1));

// ⭐ THE BEAM CARRIES THE ROLL. A cabinet fuelling a 6 and a cabinet fuelling a
// 30 used to draw the same hairline; the only thing a total changed was how
// fast the carrier shook, which nobody can read. Calibre, brightness and the
// glow on the instrument now all ride the roll.
//
// ⚠️ NORMALISED AGAINST THE SIDE'S OWN MAXIMUM POSSIBLE TOTAL, never against
// the opponent's roll. Against the opponent, two weak rolls would draw one
// huge beam and one thin one and the clash would read as lopsided when it was
// close; against its own ceiling, a big beam always means a big roll, and the
// two beams side by side ARE the comparison.
export const SWING_BEAM = Object.freeze({
  radius:.075, minScale:.55, maxScale:2.15,
  minOpacity:.34, maxOpacity:.92, glow:2.6, flicker:.22,
  raiseSwap:.35, raiseTime:.45, raiseLift:.13, hold:.7,
});

export const swingBeamPower = (total,pool=[]) => {
  const ceiling=pool.reduce((sum,sides)=>sum+(Number(sides)||0),0);
  return ceiling>0?THREE.MathUtils.clamp((Number(total)||0)/ceiling,0,1):0;
};

// ⚠️ THREE FIXED POSES, NO TWEENING — the module's own standing rule. The raise
// is a SWAP plus a carrier bob, not an animated arm: an instrument that
// interpolates into position reads as floaty, and the poses are what Alex
// approved as Figure 1 (raised) and Figure 2 (striking).
const POSES = {
  idle:   { elbow:[0,1.5,.12],  hand:[0,1.15,.34], tip:[0,.82,.8] },
  ready:  { elbow:[0,1.9,-.2],  hand:[0,2.4,-.12], tip:[0,2.85,-.12] },
  strike: { elbow:[0,1.9,.25],  hand:[0,1.62,.65], tip:[0,1.65,1.12] },
};
const poseName = pose => pose===true?'strike':pose===false||pose==null?'ready':pose;

// Two cheap, fixed silhouettes. Only the carrier shakes; limbs never tween.
export function createClashFigure(color, pose=false) {
  const shape=POSES[poseName(pose)]??POSES.ready;
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
  const hand=shape.hand;
  for(const x of [-.35,.35]){rod([0,1.6,0],[x,shape.elbow[1],shape.elbow[2]]);rod([x,shape.elbow[1],shape.elbow[2]],hand);}
  rod(hand,shape.tip,.1);
  const body=new THREE.Mesh(new THREE.BoxGeometry(.38,.42,.16),material);
  body.position.set(...shape.tip);group.add(body);
  group.userData.material=material;group.userData.pose=poseName(pose);
  return group;
}

// 📌 `timing` and `tuning` are injected by the dial-in preview so it drives
// this exact function at Alex's numbers. Porting a dial-in is then an edit to
// the defaults in `swingTiming.js` and `SWING_BEAM`, nothing here.
export function createSwingClashVisuals({battle,attacker,defender,pointFor,ampOrigins=[],
  timing={TIMING:SWING_TIMING,DICE:SWING_DICE},tuning}={}) {
  const T=timing.TIMING??SWING_TIMING,D=timing.DICE??SWING_DICE,B={...SWING_BEAM,...tuning};
  const group=new THREE.Group();group.name='Swing clash';
  const a=pointFor(attacker.num,.2),b=pointFor(defender.num,.2),mid=a.clone().lerp(b,.5);
  const lane=b.clone().sub(a).setY(0).normalize();
  // ⭐ The attacker throws at 0, the Rival at the gate. `poolStart` is what
  // makes the two throws separate events instead of one shared tumble.
  const dice=createArenaDiceSequence({drive:battle.diceVals,sustain:battle.defenderDiceVals,
    driveSides:battle.dicePool[0]??6,sustainSides:battle.defenderDicePool[0]??6,
    defenderTitle:'RIVAL DRIVE',poolStart:D.poolStart,timing:D.timing,
    driveColor:attacker.color,sustainColor:defender.color}); // 🎨 each player's own colour
  dice.group.scale.setScalar(.65);dice.group.position.copy(mid).add(new THREE.Vector3(-lane.z,0,lane.x).multiplyScalar(3.4));
  dice.group.position.z-=4;group.add(dice.group);
  const power=[swingBeamPower(battle.atkTotal,battle.dicePool),swingBeamPower(battle.defTotal,battle.defenderDicePool)];
  const figures=[attacker,defender].map((s,i)=>{
    const carrier=new THREE.Group();
    const idle=createClashFigure(s.color,'idle'),ready=createClashFigure(s.color,'ready'),strike=createClashFigure(s.color,'strike');
    carrier.add(idle,ready,strike);carrier.position.copy(i?b:a);carrier.rotation.y=Math.atan2(lane.x,lane.z)+(i?Math.PI:0);
    group.add(carrier);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(SWING_BEAM.radius,SWING_BEAM.radius,1,8),
      new THREE.MeshBasicMaterial({color:s.color,transparent:true,opacity:.7,toneMapped:false}));
    group.add(beam);
    return {carrier,idle,ready,strike,beam,power:power[i],
      total:i?battle.defTotal:battle.atkTotal,
      raiseAt:D.raiseAt[i],ampAt:D.ampAt[i],
      start:(i?b:a).clone(),end:mid.clone().addScaledVector(lane,i?1.12:-1.12),origin:ampOrigins[i]};
  });
  const caption=sonicSceneLabel('', '#ffe7ad',5,.65);caption.sprite.position.copy(mid).add(new THREE.Vector3(0,3.4,0));group.add(caption.sprite);
  let lastLabel;
  function update(t,{reduced=false}={}) {
    dice.update(t,{reduced,visible:t>=0&&t<T.clash});
    const clash=t>=T.clash,strikePower=THREE.MathUtils.clamp((t-T.clash)/2.75,0,1);
    // Both raise in place, both totals are read, and only THEN do they close.
    const approach=THREE.MathUtils.clamp((t-T.read)/Math.max(.001,T.clash-T.read),0,1);
    const label=t<T.attackerRead?'SWING · YOUR DRIVE'
      :t<T.attackerAmp?`YOUR DRIVE · ${battle.atkTotal}`
      :t<T.rivalRead?'SWING · RIVAL DRIVE'
      :t<T.rivalAmp?`RIVAL DRIVE · ${battle.defTotal}`
      :t<T.clash?`${battle.atkTotal}  ⚔  ${battle.defTotal}`
      :t<T.result?'CLASH'
      :battle.tied?'EVEN CLASH':`−${battle.damage} VIBE`;
    if(label!==lastLabel){caption.write(label);lastLabel=label;}
    for(const [i,f] of figures.entries()){
      const raise=THREE.MathUtils.clamp((t-f.raiseAt)/B.raiseTime,0,1);
      const up=raise>=B.raiseSwap;
      f.idle.visible=!clash&&!up;f.ready.visible=!clash&&up;f.strike.visible=clash;
      f.carrier.position.copy(f.start).lerp(f.end,approach);
      if(!reduced&&raise>0&&raise<1)f.carrier.position.y+=Math.sin(raise*Math.PI)*B.raiseLift;
      // ⚠️ The shake is the ROLL's, but it only starts once that Spirit has
      // something to shake with — a cabinet shaking before its own dice have
      // landed is the tell that the beats are wired to the wrong clock.
      const shaking=clash?strikePower:t>=f.ampAt?1:0;
      f.carrier.rotation.z=reduced?0:Math.sin(t*(20+f.total*.5))*(.012+f.power*.028)*shaking;
      const fuelled=THREE.MathUtils.clamp((t-f.ampAt)/1.2,0,1);
      f.idle.userData.material.emissiveIntensity=.3;
      f.ready.userData.material.emissiveIntensity=.3+fuelled*(1.1+f.power*B.glow);
      f.strike.userData.material.emissiveIntensity=2.1+strikePower*(1+f.power*2);
      f.beam.visible=!!f.origin&&t>=f.ampAt&&t<T.result;
      if(f.origin&&f.beam.visible){
        const calibre=B.minScale+(B.maxScale-B.minScale)*f.power;
        const target=f.carrier.position.clone().add(new THREE.Vector3(0,clash?1.65:2.65,0));
        target.addScaledVector(lane,clash?(i?-.9:.9):0);
        const direction=target.clone().sub(f.origin);
        f.beam.position.copy(f.origin).add(target).multiplyScalar(.5);
        f.beam.scale.set(calibre,direction.length(),calibre);
        f.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
        const lit=B.minOpacity+(B.maxOpacity-B.minOpacity)*f.power;
        f.beam.material.opacity=reduced?lit:lit+B.flicker*(1-f.power)*Math.sin(t*18);
      }
    }
    group.updateWorldMatrix(true,true);
    // ── Where the camera looks. ⭐ It follows WHOSE TURN IT IS TO ACT, which
    // is the whole reason the throws were separated: dice in flight, then the
    // Spirit who threw them raising and taking their amp's charge, then the
    // other Spirit doing the same, then the pair.
    const facing=i=>{const f=figures[i];return {kind:'face',
      point:f.carrier.position.clone().add(new THREE.Vector3(0,1.95,0)),
      direction:lane.clone().multiplyScalar(i?-1:1)};};
    const onDice=(pool,kind='dice')=>{
      const entries=dice.entries.filter(e=>e.die.group.visible&&(pool==null||e.pool===pool));
      const points=entries.map(e=>e.die.group.getWorldPosition(new THREE.Vector3()));
      if(kind==='result')points.push(dice.group.localToWorld(new THREE.Vector3(1,.03,pool?10.4:6.4)));
      return {kind,points:points.length?points:diceBounds};
    };
    if(t<T.attackerRaise)return onDice(0);
    if(t<T.attackerAmp+B.hold)return facing(0);
    if(t<T.rival)return facing(1);                  // the Rival steps up to throw
    if(t<T.rivalRaise)return onDice(1);
    if(t<T.rivalAmp+B.hold)return facing(1);
    if(t<T.read)return onDice(null);
    if(t<T.clash)return onDice(t<T.read+1?0:1,'result');
    return {kind:'clash',points:[a,b,a.clone().setY(3.5),b.clone().setY(3.5)]};
  }
  const diceBounds=[[-6,0,2],[8,4,11]].map(v=>new THREE.Vector3(...v).multiplyScalar(.65).add(dice.group.position));
  return {group,diceBounds,dice,figures,timing:{TIMING:T,DICE:D},tuning:B,update,dispose(){dice.dispose();caption.texture?.dispose();group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});group.clear();}};
}
