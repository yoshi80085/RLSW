import * as THREE from 'three';
import { createSonicFluid } from './sonicFluid.js';

const TAU=Math.PI*2;
const clamp=THREE.MathUtils.clamp;
const point=p=>new THREE.Vector3(p.x,p.y,p.z);
const horizontalDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const FLIGHT_SECONDS=1.75,STAGGER_SECONDS=.13,IMPACT_SECONDS=.52;
export const sonicVolleyDuration=(diceCount,launchDelay=0)=>Math.max(0,launchDelay)+FLIGHT_SECONDS+Math.max(0,diceCount-1)*STAGGER_SECONDS+IMPACT_SECONDS;

// Tangents and an exact circular arc keep the whole centreline outside the
// attacking miniature. A spline through waypoints can silently cut its body.
// Positions are world-space centres at projectile height, not ground hexes.
export function buildSonicPath({origin,attackerPosition,defenderPosition,side=1,passed=false,clearance=1.05,shieldRadius=.78}) {
  const a=point(attackerPosition),b=point(defenderPosition),start=point(origin);
  side=side<0?-1:1;
  const forward=b.clone().sub(a);forward.y=0;
  if(forward.lengthSq()<1e-8)forward.set(1,0,0);else forward.normalize();
  const shieldPoint=b.clone().addScaledVector(forward,-shieldRadius);
  // Very close/overlapping miniatures cannot have the normal clearance. The
  // returned radius records the available space instead of inventing a hit.
  const radius=Math.max(.01,Math.min(clearance,horizontalDistance(start,a)*.98,horizontalDistance(shieldPoint,a)*.98));
  const originAngle=Math.atan2(start.z-a.z,start.x-a.x);
  const endAngle=Math.atan2(shieldPoint.z-a.z,shieldPoint.x-a.x);
  let entry=originAngle-side*Math.acos(clamp(radius/horizontalDistance(start,a),-1,1));
  const leave=endAngle+side*Math.acos(clamp(radius/horizontalDistance(shieldPoint,a),-1,1));
  if(side>0)while(entry<leave)entry+=TAU;
  else while(entry>leave)entry-=TAU;
  const circleAt=theta=>new THREE.Vector3(a.x+Math.cos(theta)*radius,a.y,a.z+Math.sin(theta)*radius);
  const entryPoint=circleAt(entry),exitPoint=circleAt(leave);
  const segments=[];
  const line=(from,to)=>segments.push({length:from.distanceTo(to),at:t=>from.clone().lerp(to,t)});
  line(start,entryPoint);
  segments.push({length:Math.abs(leave-entry)*radius,at:t=>circleAt(entry+(leave-entry)*t)});
  line(exitPoint,shieldPoint);
  const shieldDistance=segments.reduce((sum,s)=>sum+s.length,0);
  if(passed)line(shieldPoint,b);
  const length=segments.reduce((sum,s)=>sum+s.length,0);
  const curve=new THREE.Curve();
  curve.getPoint=(t,target=new THREE.Vector3())=>{
    let remaining=clamp(t,0,1)*length;
    for(let i=0;i<segments.length;i++) {
      const s=segments[i];
      if(remaining<=s.length||i===segments.length-1)return target.copy(s.at(s.length?clamp(remaining/s.length,0,1):1));
      remaining-=s.length;
    }
    return target.copy(start);
  };
  Object.assign(curve,{shieldPoint,shieldT:length?shieldDistance/length:1,clearance:radius,side,length});
  return curve;
}

const luminous=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});

// §12.1a: "The waveform IS the missile." No note glyph flies in front of the
// shot. The projectile is a compressed pressure core travelling inside its own
// stack of expanding wavefronts — a sonic blast seen edge-on, not a symbol.
// The group's local +Z is the direction of travel, so every ring lies in the
// plane perpendicular to it and reads as a shock front rather than a tail.
const WAVEFRONTS=4;
function waveformGlyph(color,interval) {
  const group=new THREE.Group(),material=luminous(color);
  // The core: a thin luminous streak of compressed air, not a rounded head.
  const core=new THREE.Mesh(new THREE.SphereGeometry(.085,12,8),material);
  core.scale.set(.62,.62,3.1);group.add(core);
  // A thin, dim sheath only softens the core's edge. Anything fatter turns the
  // shot into a solid body and the wavefronts stop reading.
  const sheath=new THREE.Mesh(new THREE.SphereGeometry(.085,10,7),luminous(color,.1));
  sheath.scale.set(1.25,1.25,2.9);group.add(sheath);
  // A tight leading ring just ahead of the core: the compression front.
  const lens=new THREE.Mesh(new THREE.TorusGeometry(.062,.016,4,20),luminous(color,.8));
  lens.position.z=.19;group.add(lens);
  // Trailing wavefronts, widening as they fall behind — the shockwave stack a
  // sonic blast is actually made of. The chord interval sets how tightly they
  // are spaced, so a tritone shot still reads differently from a root: musical
  // texture taken from the chord, never from rules or RNG.
  const fronts=[];
  const pitch=.17+((interval%12)/12)*.11;
  for(let i=0;i<WAVEFRONTS;i++) {
    const radius=.1+i*.105,tube=.021-i*.0032;
    const front=new THREE.Mesh(new THREE.TorusGeometry(radius,Math.max(.006,tube),4,28),luminous(color,.66-i*.13));
    front.position.z=-.07-i*pitch;group.add(front);fronts.push({mesh:front,radius,base:.66-i*.13,z:front.position.z});
  }
  return {group,material,fronts,core,sheath,lens};
}

/** Presentation only. The caller supplies resolved dice and starts this clock
 * after showing the roll (or sets launchDelay). No randomness, rules or audio.
 * dice: [{value:number, passed:boolean}]; chordPitches: MIDI/pitch-class numbers.
 * update accepts absolute elapsed seconds, so replay/seeking is deterministic.
 * A negative elapsed time shows only the held shield during ready/roll/reveal.
 */
export function createSonicVolleyVisuals({ampOrigins,attackerPosition,defenderPosition,dice=[],chordPitches=[0,4,7],color='#62dbff',shieldColor='#b0a0ff',launchDelay=0,clearance=1.05,shieldRadius=.78}) {
  const group=new THREE.Group();group.name='Sonic note volley';
  const origins=(ampOrigins??[]).map(point),attacker=point(attackerPosition),defender=point(defenderPosition);
  const flightSeconds=FLIGHT_SECONDS,stagger=STAGGER_SECONDS,impactSeconds=IMPACT_SECONDS;
  const delay=Math.max(0,launchDelay),duration=sonicVolleyDuration(dice.length,delay);
  const records=[];
  const fluid=createSonicFluid();
  let disposed=false;
  const shield=new THREE.Group();shield.name='Sustain holds';shield.position.copy(defender);group.add(shield);
  const shell=new THREE.Mesh(new THREE.IcosahedronGeometry(shieldRadius,1),luminous(shieldColor,.055));shield.add(shell);
  const facets=new THREE.Mesh(new THREE.IcosahedronGeometry(shieldRadius*1.006,1),luminous(shieldColor,.16));facets.material.wireframe=true;shield.add(facets);
  const chordRing=new THREE.Mesh(new THREE.TorusGeometry(shieldRadius*.97,.014,4,48),luminous(shieldColor,.3));chordRing.rotation.x=Math.PI/2;shield.add(chordRing);
  const pitches=chordPitches.length?chordPitches:[0],rootPitch=Number(pitches[0])||0;
  if(origins.length)for(let i=0;i<dice.length;i++) {
    const die=dice[i],pitch=((Number(pitches[i%pitches.length])||0)%12+12)%12;
    const interval=((pitch-rootPitch)%12+12)%12;
    const tint=new THREE.Color(color).lerp(new THREE.Color().setHSL(pitch/12,.8,.67),.23);
    const path=buildSonicPath({origin:origins[i%origins.length],attackerPosition:attacker,defenderPosition:defender,side:i%2?-1:1,passed:!!die.passed,clearance,shieldRadius});
    const note=waveformGlyph(tint,interval);note.group.name=`Sonic die ${i+1}: ${die.value} ${die.passed?'through':'absorbed'}`;
    note.group.userData={value:die.value,passed:!!die.passed,ampOrigin:origins[i%origins.length].clone(),wrapSide:path.side,pitch,interval};group.add(note.group);
    // Two counter-phase ribbons: the sidewinding wake reads as an oscillation
    // rather than a single whipping tail. Both are driven by the same fluid.
    const samples=28,ribbons=[];
    for(let edgeIndex=0;edgeIndex<2;edgeIndex++) {
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(samples*2*3),3));
      const indices=[];for(let j=0;j<samples-1;j++){const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}geometry.setIndex(indices);
      const strand=new THREE.Mesh(geometry,luminous(tint,edgeIndex?.24:.55));
      strand.name='Harmonic wave ribbon';strand.frustumCulled=false;group.add(strand);ribbons.push(strand);
    }
    const ribbon=ribbons[0];
    const impact=new THREE.Mesh(new THREE.TorusGeometry(.18,.025,5,32),luminous(die.passed?tint:shieldColor));
    impact.name=die.passed?'Spirit note arrival':'Absorbed shield resonance';impact.position.copy(path.getPoint(1));group.add(impact);
    const normal=path.getTangent(1).normalize();impact.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    const contact=new THREE.Mesh(new THREE.TorusGeometry(.14,.016,4,28),luminous(shieldColor));contact.position.copy(path.shieldPoint);contact.quaternion.copy(impact.quaternion);group.add(contact);
    const muzzle=new THREE.Mesh(new THREE.TorusGeometry(.18,.023,5,24),luminous(tint));muzzle.position.copy(origins[i%origins.length]);
    muzzle.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),path.getTangent(0).normalize());group.add(muzzle);
    records.push({path,note,ribbon,ribbons,impact,contact,muzzle,interval,passed:!!die.passed,start:delay+i*stagger});
  }
  const up=new THREE.Vector3(0,1,0),tangent=new THREE.Vector3(),across=new THREE.Vector3();
  function update(elapsedSeconds,{reduced=false}={}) {
    if(disposed)return;
    const time=Number.isFinite(elapsedSeconds)?elapsedSeconds:0;
    if(!reduced)fluid.update(Math.max(0,time)+.4);
    group.visible=time<duration&&records.length>0;
    let resonance=0;
    for(const r of records) {
      const age=time-r.start,progress=clamp(age/flightSeconds,0,1);
      const flying=age>=0&&age<flightSeconds;
      r.note.group.visible=flying&&!reduced;
      for(const strand of r.ribbons)strand.visible=flying&&!reduced;
      r.note.group.position.copy(r.path.getPoint(progress));
      tangent.copy(r.path.getTangent(progress));r.note.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),tangent);
      r.note.group.scale.setScalar(1+.06*Math.sin(progress*Math.PI));
      // The wavefronts breathe outward and slide back along the shot, so the
      // missile reads as a travelling waveform instead of a rigid dart.
      if(flying&&!reduced)for(let f=0;f<r.note.fronts.length;f++) {
        const front=r.note.fronts[f],beat=time*9+f*1.1+r.interval*.4;
        const swell=1+.28*Math.sin(beat)+.1*Math.sin(beat*.37);
        front.mesh.scale.setScalar(swell);
        front.mesh.position.z=front.z-.05*Math.sin(beat*.5);
        front.mesh.material.opacity=front.base*(.72+.28*Math.sin(beat+1.2));
      }
      if(flying)r.note.lens.material.opacity=reduced?.55:.4+.25*Math.sin(time*13+r.interval);
      for(let strandIndex=0;strandIndex<r.ribbons.length;strandIndex++) {
        const positions=r.ribbons[strandIndex].geometry.attributes.position;
        // The second strand trails a little further back and mirrors the swing,
        // which is what turns a single wake into a sidewinding pair.
        const lag=.12+strandIndex*.05,sign=strandIndex?-1:1;
        if(flying&&!reduced)for(let j=0;j<positions.count/2;j++) {
          const tail=j/(positions.count/2-1),t=clamp(progress-(1-tail)*lag,0,1),p=r.path.getPoint(t);
          tangent.copy(r.path.getTangent(t));across.crossVectors(up,tangent).normalize();
          const phase=t*TAU*(4+r.interval/4)+strandIndex*Math.PI;
          const flow=fluid.sample(tail*.65+time*.08,r.interval/12+tail*.3+strandIndex*.21);
          const swing=Math.sin(phase)*.11*sign;
          p.y+=(swing+flow.y*3)*(1-tail);
          p.addScaledVector(across,(Math.cos(phase)*.09*sign+flow.x*3)*(1-tail));
          const width=(.085+Math.abs(flow.y)*.9)*Math.sin(tail*Math.PI)*(strandIndex?.7:1);
          for(let edge=0;edge<2;edge++)positions.setXYZ(j*2+edge,p.x+across.x*width*(edge?1:-1),p.y,p.z+across.z*width*(edge?1:-1));
        }
        positions.needsUpdate=flying&&!reduced;
      }
      const impactAge=age-flightSeconds,impactFade=clamp(1-impactAge/impactSeconds,0,1);
      r.impact.visible=impactAge>=0&&impactAge<impactSeconds;r.impact.material.opacity=impactFade*(reduced?.6:1);
      r.impact.scale.setScalar(reduced?1.3:1+(1-impactFade)*(r.passed?1.7:3.4));
      const shieldAge=age-flightSeconds*r.path.shieldT,contactFade=clamp(1-shieldAge/.42,0,1);
      r.contact.visible=shieldAge>=0&&shieldAge<.42;r.contact.material.opacity=contactFade*(r.passed?.45:.95);
      r.contact.scale.setScalar(reduced?1.4:1+(1-contactFade)*3);
      if(shieldAge>=0&&shieldAge<.42)resonance=Math.max(resonance,contactFade*(r.passed?.4:1));
      r.muzzle.visible=age>=0&&age<.28;r.muzzle.material.opacity=(1-clamp(age/.28,0,1))*.7;
      r.muzzle.scale.setScalar(reduced?1:1+clamp(age/.28,0,1)*1.8);
    }
    // Every facet remains in place. Only light rings through the held chord.
    const fade=clamp((duration-time)*4,0,1);
    shell.material.opacity=(.055+resonance*.09)*fade;
    facets.material.opacity=(.16+resonance*.32)*fade;
    chordRing.material.opacity=(.3+resonance*.25)*fade;
  }
  function dispose() {
    if(disposed)return;disposed=true;group.removeFromParent();
    const resources=new Set();
    group.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const material of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])resources.add(material);});
    for(const resource of resources)resource.dispose();
    group.clear();records.length=0;
  }
  update(0);
  return {group,object:group,duration,update,dispose};
}
