import * as THREE from 'three';
import {createSonicZigzagVisuals,FLIGHT_SECONDS} from './sonicZigzagVisuals.js';
import {SONIC_GLITTER,SONIC_WAVE,createSpiralGlitter,createHelixStations} from './sonicGlitter.js';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const TAU=Math.PI*2,SPACING=SONIC_WAVE.ringGap;

// Read authored speaker surfaces AFTER arena transforms, including its Z flip.
export function arenaAmpOrigins(model){
  model.updateWorldMatrix(true,true);
  return ['W-S','E-S'].map(id=>{
    const amp=model.getObjectByName(`Amp_${id}`);
    if(!amp)throw new Error(`Arena speaker stack ${id} is missing.`);
    const cones=new THREE.Box3();
    amp.traverse(o=>{if(o.isMesh&&/Speaker cone/.test(o.material?.name))cones.union(new THREE.Box3().setFromObject(o));});
    if(cones.isEmpty())cones.setFromObject(amp);
    return cones.getCenter(V());
  });
}

export function createDuelWaveforms(parent,colors){
  let origins=null,first=null,placed=false;
  const waves=colors.map((color,side)=>{
    const visual=createSonicZigzagVisuals({ampOrigins:[V(side?10:-10,1,0)],
      attackerPosition:V(side?5:-5,1.85,0),defenderPosition:V(0,1.85,0),
      color,shieldColor:color,shieldValue:0,shieldRadius:.035,
      dice:[{value:5,sides:6,passed:false}],chordPitches:[6],intensityMode:'face',strokeStyle:'rings',glitter:false});
    visual.update(FLIGHT_SECONDS-.08,{reduced:true});
    const fields=[];visual.group.traverse(o=>{if(o.name==='Harmonic wave rings')fields.push(o);});
    // Reuse Sonic's two-band meshes/materials, but not its finite shot's
    // compression clock. Independent rings advance with fixed spacing.
    visual.group.children.forEach(o=>{o.visible=false;});
    fields.forEach(f=>{visual.group.add(f);f.visible=true;});
    visual.group.name=`Riff ${side===0?'attacker':'Rival'} · amp ring stream`;parent.add(visual.group);
    const field=fields[0],index=field.geometry.index.array;
    let segments=1;while(segments*6<index.length&&index[segments*6]===segments*2)segments++;
    const stride=(segments+1)*2,capacity=field.geometry.attributes.position.count/stride;
    const spiral=createSpiralGlitter(null,{tint:new THREE.Color(color).lerp(new THREE.Color('white'),.5)});
    spiral.group.name='Riff inner spiral glitter';visual.group.add(spiral.group);
    const glitter=spiral.points;
    return {visual,field,fields,segments,stride,capacity,glitter,spiral,first:null,stations:[]};
  });

  const ball=new THREE.Group();ball.name='Converging Soundform ball';parent.add(ball);
  const hoops=[];
  for(let i=0;i<14;i++){
    const pivot=new THREE.Group();ball.add(pivot);
    const material=waves[i%2].fields[0].material.clone();material.opacity=.52;
    const hoop=new THREE.Mesh(new THREE.TorusGeometry(1,.017,6,96),material);
    const hot=new THREE.Mesh(new THREE.TorusGeometry(1,.005,4,96),waves[i%2].fields[1].material.clone());
    hot.material.color.lerp(new THREE.Color('white'),.15);hot.material.opacity=.32;
    hoop.renderOrder=143;hot.renderOrder=144;pivot.add(hoop,hot);
    hoops.push(pivot);
  }
  const haze=new THREE.Mesh(new THREE.SphereGeometry(.94,32,24),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{cyan:{value:new THREE.Color(colors[0])},amber:{value:new THREE.Color(colors[1])}},
    vertexShader:`varying vec3 n;varying vec3 eye;varying float side;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=normalize(-p.xyz);side=position.x;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`varying vec3 n;varying vec3 eye;varying float side;uniform vec3 cyan;uniform vec3 amber;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),2.);gl_FragColor=vec4(mix(cyan,amber,smoothstep(-.6,.6,side)),.012+.08*rim);}`,
  }));ball.add(haze);
  const coreSpiral=createSpiralGlitter();ball.add(coreSpiral.group);
  coreSpiral.group.name='Riff core spiral glitter';
  const coreStations=createHelixStations(48);
  coreStations.forEach((s,i)=>{
    const y=-.95+1.9*i/(coreStations.length-1);
    s.center.set(0,y,0);s.across.set(1,0,0);s.up.set(0,0,1);
    s.radius=Math.sqrt(Math.max(0,.96*.96-y*y));
  });
  const direction=V(),up=V(),across=V(),point=V(),destination=V(0,1.85,0),worldUp=V(0,1,0);

  return {
    waves,ball,hoops,
    setOrigins(points){origins=points.map(p=>p.clone());},
    reset(){first=null;placed=false;ball.visible=false;coreSpiral.update(0,SONIC_GLITTER,{enabled:false});for(const w of waves){w.first=null;w.stations=[];w.visual.group.visible=false;w.spiral.update(0,SONIC_GLITTER,{enabled:false});}},
    update({time,energy,shift=0,scale=1,spin=1,growth=.17,flow=6,glitter=SONIC_GLITTER.brightness,impact=null,reduced=false,center=null,targets=null,maximumRadius=3,dt=null}){
      const t=time/1000,total=energy[0]+energy[1];
      if(total>0&&first===null)first=t;
      const age=first===null?0:Math.max(0,t-first),motion=reduced?0:t;
      const impactAge=impact?Math.max(0,t-impact.born):0;
      const targetRadius=scale*Math.min(maximumRadius,.35+growth*Math.sqrt(total)+(reduced?0:age*.009));
      destination.copy(center??V(0,1.85,0));
      const axis=targets?targets[1].clone().sub(targets[0]).setY(0).normalize():V(1,0,0);
      destination.addScaledVector(axis,shift);
      if(impact&&!impact.tie)destination.lerp(targets?targets[1-impact.side].clone().setY(destination.y):V(impact.side===0?5:-5,1.85,0),Math.min(1,impactAge/.8));
      // Engine scores arrive on note hits. Ease presentation every render frame
      // so those discrete events never teleport or resize the clash in a step.
      const smooth=dt!=null&&!reduced&&placed;
      ball.position.lerp(destination,smooth?1-Math.exp(-Math.max(0,dt)*7):1);
      const radius=smooth?THREE.MathUtils.damp(ball.scale.x,targetRadius,8,Math.max(0,dt)):targetRadius;
      ball.scale.setScalar(radius);destination.copy(ball.position);placed=true;
      ball.visible=total>0&&!!origins&&(!impact||impactAge<1.05);
      ball.userData.radius=radius;
      hoops.forEach((p,i)=>{
        const sign=i%2?1:-1,rate=(.16+(i%5)*.087)*spin;
        // Independent tilted axes, directions and angular velocities.
        // Uneven spin belongs to the ball, never to the stream spacing.
        p.rotation.set(i*.71+motion*rate*sign,i*1.17+motion*rate*.63,i*.43+motion*rate*.37*sign);
        p.scale.setScalar(.77+(i%4)*.075);
      });
      coreSpiral.update(motion,{...SONIC_GLITTER,brightness:glitter},
        {stations:coreStations,reduced,enabled:ball.visible&&glitter>0});

      waves.forEach((w,side)=>{
        w.visual.group.visible=!!origins&&energy[side]>0&&(!impact||impactAge<.82);
        if(!w.visual.group.visible){w.spiral.update(t,SONIC_GLITTER,{enabled:false});return;}
        if(w.first===null)w.first=t;
        const origin=origins[side];direction.copy(destination).sub(origin);
        const distance=direction.length();direction.normalize();
        across.crossVectors(direction,worldUp).normalize();up.crossVectors(across,direction).normalize();
        const end=Math.max(.1,distance-radius*.54);
        const travel=(reduced?2:Math.max(0,t-w.first))*flow;
        w.stations=[];
        for(const f of w.fields)f.geometry.attributes.position.array.fill(0);
        for(let k=0;k<w.capacity;k++){
          const raw=travel-k*SPACING;
          if(raw<0)continue;
          const d=raw%(w.capacity*SPACING);if(d>end)continue;
          const u=d/end,r=SONIC_WAVE.beamRadius*(.72+.17*u)*(1-.6*Math.max(0,(u-.83)/.17));
          point.copy(origin).addScaledVector(direction,d);
          w.stations.push({slot:k,distance:d,radius:r-.035,center:point.clone(),across,up});
          w.fields.forEach((f,band)=>{
            const positions=f.geometry.attributes.position,thickness=band?.010:.035;
            for(let s=0;s<=w.segments;s++){
              const angle=s/w.segments*TAU;
              for(let edge=0;edge<2;edge++){
                const radial=r+(edge?1:-1)*thickness;
                positions.setXYZ(k*w.stride+s*2+edge,
                  point.x+radial*(across.x*Math.cos(angle)+up.x*Math.sin(angle)),
                  point.y+radial*(across.y*Math.cos(angle)+up.y*Math.sin(angle)),
                  point.z+radial*(across.z*Math.cos(angle)+up.z*Math.sin(angle)));
              }
            }
          });
        }
        for(const f of w.fields)f.geometry.attributes.position.needsUpdate=true;
        // Pool slots wrap as rings advance. Sort by physical distance so the
        // helix always runs amp → core rather than doubling back at a wrap.
        const stations=w.stations.slice().sort((a,b)=>a.distance-b.distance);
        w.spiral.update(motion,{...SONIC_GLITTER,brightness:glitter},
          {stations,reduced,enabled:glitter>0,opacity:1});
      });
    },
    dispose(){coreSpiral.dispose();waves.forEach(w=>{w.spiral.dispose();w.visual.dispose();w.visual.group.removeFromParent();});
      ball.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});ball.removeFromParent();},
  };
}

