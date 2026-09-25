import * as THREE from 'three';
import { ALL_HEXES, HEX_BY_NUM } from './hexMap.js';

// 🔦 Alex's spotlight dial-in (2026-09-25 13:14, `.scratch/spotlight-preview.html`).
// Changed from the preview's defaults: roam .45→.65, power 12→19, haze .11→.13,
// poolGlow .12→.18, ringA .55→.2, ringPulse .35→1, range outline .14→0 (so no
// range outline is built at all), halo .6→.2. Colour = player colour.
export const SPOTLIGHT_LOOK = Object.freeze({
  emptyDim:.35, roam:.65, speed:1, stepSecs:1.4,
  power:19, haze:.13, coneW:1.05, poolR:1.05, poolGlow:.18,
  ringA:.2, ringPulse:1, halo:.2, haloColor:0xff88ff,
  hexR:1.08*.93, ringY:.21, haloY:.3,
});
const SPOT = SPOTLIGHT_LOOK;

// Preview palette and geometry, mirrored into the live board's +Z orientation.
// Randomness is local and seeded: scenery never consumes the match RNG.
// 🔦 `overlay` — the foreground scene (`arenaRenderer.js`), drawn on the canvas
// ABOVE the board's SVG and above the solid layer's re-drawn amps. The spotlight
// BEAMS go there so they shine over everything (Alex, 2026-09-25: *"put the
// light's beam over top anything else — including the amps — right now they
// 'block' part of the glow"*). ⚠️ In the arena pass the amps are re-drawn on the
// foreground AFTER the arena, so a beam drawn in the arena could never win,
// whatever its depth settings. Omit `overlay` and the beams stay in `scene`.
export function createArenaEnvironment(scene, { overlay = null } = {}) {
  const root = new THREE.Group(); root.name = 'Cosmic environment'; scene.add(root);
  root.add(new THREE.HemisphereLight(0x9fc4ff,0x363852,2));
  for (const [color,power,pos] of [[0xaad8ff,2.2,[7,20,16]],[0xae72ff,1.6,[-15,9,-12]],[0x72aaff,3.24,[4,-3,18]]]) {
    const light = new THREE.DirectionalLight(color,power); light.position.set(...pos); root.add(light);
  }
  const under = new THREE.PointLight(0xb050ff,97.5,30,2); under.position.set(0,-7,5); root.add(under);
  let seed=7721;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const positions=[],colors=[];
  for(let i=0;i<2200;i++) {
    const theta=rand()*Math.PI*2,u=rand()*2-1,r=110+rand()*60,s=Math.sqrt(1-u*u);
    positions.push(r*s*Math.cos(theta),r*u,r*s*Math.sin(theta));
    const c=new THREE.Color().setHSL(.55+rand()*.16,.12+rand()*.4,.25+rand()*.5); colors.push(c.r,c.g,c.b);
  }
  const starsGeo=new THREE.BufferGeometry();
  starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  starsGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const stars=new THREE.Points(starsGeo,new THREE.PointsMaterial({size:.16,vertexColors:true,transparent:true,opacity:.85})); root.add(stars);
  const scenerySeed=seed;
  const glintPositions=[];
  for(let i=0;i<220;i++) {
    const h=ALL_HEXES[i%ALL_HEXES.length];
    glintPositions.push((h.px-3255)/200+(rand()-.5)*.85,.19,(h.py-2415)/200+(rand()-.5)*.85);
  }
  const glintGeo=new THREE.BufferGeometry();glintGeo.setAttribute('position',new THREE.Float32BufferAttribute(glintPositions,3));
  const glintMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{time:{value:0}},
    vertexShader:`uniform float time;varying float shine;void main(){vec4 p=modelViewMatrix*vec4(position,1.);shine=pow(max(0.,sin(time*.65+position.x*7.+position.z*13.)),24.);gl_PointSize=min(7.,90./max(1.,-p.z))*(.5+shine);gl_Position=projectionMatrix*p;}`,
    fragmentShader:'varying float shine;void main(){vec2 p=abs(gl_PointCoord-.5);float a=max(0.,1.-length(p)*2.);float cross=pow(max(0.,1.-min(p.x,p.y)*9.),8.);gl_FragColor=vec4(.55,.8,1.,shine*a*cross*.8);}'
  });
  const glints=new THREE.Points(glintGeo,glintMat);root.add(glints);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(190,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 v; void main(){v=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 v;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 p=normalize(v);float n=noise(p*5.)*.6+noise(p*13.)*.25+noise(p*31.)*.15;float band=exp(-pow((p.y+.12+p.x*.2)*5.,2.));gl_FragColor=vec4(vec3(.002,.004,.011)+vec3(.034,.009,.058)*pow(n,3.)*band,1.);}`
  })); root.add(sky);
  const planet=new THREE.Mesh(new THREE.SphereGeometry(6.05,40,24),new THREE.MeshStandardMaterial({color:0x182940,roughness:1,metalness:.05}));
  planet.position.set(-65,0,-25); root.add(planet);
  const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(6.182,40,24),new THREE.ShaderMaterial({transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,
    vertexShader:'varying vec3 n; varying vec3 p;void main(){n=normalize(normalMatrix*normal);vec4 q=modelViewMatrix*vec4(position,1.);p=q.xyz;gl_Position=projectionMatrix*q;}',
    fragmentShader:'varying vec3 n;varying vec3 p;void main(){float f=pow(1.-max(0.,dot(normalize(n),normalize(-p))),3.);gl_FragColor=vec4(.14,.35,.65,f*.45);}'
  }));atmosphere.position.copy(planet.position);root.add(atmosphere);
  const moon=new THREE.Mesh(new THREE.SphereGeometry(3.1,24,16),new THREE.MeshStandardMaterial({color:0x40354a,roughness:1}));
  moon.position.set(1,-10,-65);root.add(moon);
  const ring=new THREE.Mesh(new THREE.RingGeometry(4.5,7.2,64),new THREE.MeshBasicMaterial({color:0x686578,side:THREE.DoubleSide,transparent:true,opacity:.16}));
  ring.position.copy(moon.position);ring.rotation.set(-1.2,.25,.3);root.add(ring);
  const debris=new THREE.Group();debris.name='Floating wreckage';root.add(debris);seed=scenerySeed;
  const rock=new THREE.MeshStandardMaterial({color:0x303846,metalness:.35,roughness:.83,flatShading:true});
  const geo=new THREE.IcosahedronGeometry(1,0);
  const chunks=new THREE.InstancedMesh(geo,rock,48);debris.add(chunks);
  const transforms=[];
  for(let i=0;i<48;i++) {
    const a=rand()*Math.PI*2,r=16+rand()*12,k=.22+rand()*.8;
    const chunk=new THREE.Object3D(); chunk.position.set(Math.cos(a)*r,-4-rand()*11,Math.sin(a)*r);
    chunk.scale.set(k*(.5+rand()),k*(.7+rand()*1.8),k*(.5+rand())); chunk.rotation.set(rand()*6,rand()*6,rand()*6);
    chunk.userData={baseY:chunk.position.y,baseRotation:chunk.rotation.y,phase:rand()*6};transforms.push(chunk);
  }
  for(let i=0;i<7;i++) {
    const a=rand()*6.28,r=17+rand()*6;
    const shard=new THREE.Mesh(new THREE.BoxGeometry(1.3,.12,.7),new THREE.MeshStandardMaterial({color:0x283652,metalness:.85,roughness:.4}));
    shard.position.set(Math.cos(a)*r,-2-rand()*6,Math.sin(a)*r);shard.rotation.set(rand()*3,rand()*3,rand()*3);
    shard.userData={baseY:shard.position.y,baseRotation:shard.rotation.y,phase:rand()*6};debris.add(shard);
  }
  // 🔦 THE FOUR CORNER SPOTLIGHTS — look dialled in by Alex on
  // `.scratch/spotlight-preview.html` (2026-09-25 13:14). The RULES live in
  // `engine/systems/spotlights.js`; this only draws them. Each light is aimed at
  // its corner's hex (`frame.spotlights`, via arenaFrame), wanders gently round
  // it, and eases to the next hex when the engine steps it at round end.
  // Without `spotlights` (a pre-lights state, the presentation check) the old
  // decorative roaming look is kept.
  const lights=[];
  const coneGeo=new THREE.ConeGeometry(1,1,24,1,true); coneGeo.translate(0,-.5,0);
  const hexRing=new THREE.BufferGeometry().setFromPoints(Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return new THREE.Vector3(Math.cos(a)*SPOT.hexR,0,Math.sin(a)*SPOT.hexR);}));
  const quarters={blue:[-1,-1],purple:[-1,1],yellow:[1,-1],red:[1,1]};
  for(const [corner,[sx,sz]] of Object.entries(quarters)) {
    const color=sx===sz?0x54caff:0xb854ff; // the old palette, until a frame names the seat
    const source=new THREE.Vector3(sx*9.5,3.48,sz*7.5);
    const target=new THREE.Object3D();root.add(target);
    const light=new THREE.SpotLight(color,60,27,.23,.75,1.7);light.position.copy(source);light.target=target;root.add(light);
    const cone=new THREE.Mesh(coneGeo,new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,
      uniforms:{color:{value:new THREE.Color(color)},haze:{value:.11}},
      vertexShader:'varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 v;uniform vec3 color;uniform float haze;void main(){float a=sin(v.x*3.14159)*pow(v.y,0.4)*haze;gl_FragColor=vec4(color,a);}'
    }));cone.position.copy(source);
    // ⭐ Over the top: no depth test, drawn last. Additive, so it lights what is
    // under it rather than covering it.
    if(overlay){cone.material.depthTest=false;cone.renderOrder=900;cone.name='Spotlight beam';overlay.add(cone);} else root.add(cone);
    const pool=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.12,depthWrite:false,blending:THREE.AdditiveBlending}));pool.rotation.x=-Math.PI/2;root.add(pool);
    // The lit hex's outline — which hex the light is PARKED on, as opposed to
    // where the wandering pool happens to be this second.
    const ring=new THREE.LineLoop(hexRing,new THREE.LineBasicMaterial({color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    ring.name='Spotlight hex';ring.renderOrder=56;ring.visible=false;root.add(ring);
    lights.push({corner,source,target,light,cone,pool,ring,sx,sz,phase:lights.length*1.7,hex:null,from:null,t0:0,color:new THREE.Color(color)});
  }
  // 💃 A halo round every Spirit holding a spotlight pose (Limelight poses have
  // their own dressing). Pooled: at most four Spirits can pose at once.
  const haloGeo=new THREE.TorusGeometry(.62,.06,10,48);haloGeo.rotateX(Math.PI/2);
  const halos=Array.from({length:4},()=>{const m=new THREE.Mesh(haloGeo,new THREE.MeshBasicMaterial({color:SPOT.haloColor,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));m.name='Spotlight pose halo';m.visible=false;root.add(m);return m;});
  const hexPoint=num=>{const h=HEX_BY_NUM[num];return h?{x:(h.px-3255)/200,z:(h.py-2415)/200}:null;};
  const ease=k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2;
  const scratch=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0);
  return {
    update(time,{lite=false,reduced=false,spotlights=null}={}) {
      glints.visible=!lite&&!reduced;glintMat.uniforms.time.value=time;
      starsGeo.setDrawRange(0,lite?900:2200);
      // Keep the complete silhouette in Standard too; 48 rocks cost one draw.
      for(const o of [...transforms,...debris.children.slice(1)]) {
        o.rotation.y=o.userData.baseRotation+(reduced?0:time*.025);
        o.position.y=o.userData.baseY+(reduced?0:Math.sin(time*.3+o.userData.phase)*.15);
      }
      transforms.forEach((o,i)=>{o.updateMatrix();chunks.setMatrixAt(i,o.matrix);});chunks.instanceMatrix.needsUpdate=true;
      const t=reduced?0:time;
      const seats=new Map((spotlights?.lights??[]).map(s=>[s.corner,s]));
      for(const l of lights) {
        const seat=seats.get(l.corner),at=seat&&hexPoint(seat.hex);
        if(!at) { // the old decorative sweep
          l.target.position.set(l.sx*(3.6+Math.sin(t*.22+l.sz)*1.8),.14,l.sz*(2.2+Math.cos(t*.18+l.sx)*1.3));
          l.cone.material.uniforms.haze.value=.11;l.light.intensity=12;l.pool.material.opacity=.12;l.ring.visible=false;l.hex=null;
        } else {
          if(l.hex==null){l.hex=l.from=seat.hex;l.t0=-1e9;}
          else if(seat.hex!==l.hex){l.from=l.hex;l.hex=seat.hex;l.t0=time;}
          const a=hexPoint(l.from)??at,k=reduced?1:ease(Math.min(1,(time-l.t0)/SPOT.stepSecs));
          const w=SPOT.speed*3;
          l.target.position.set(a.x+(at.x-a.x)*k+Math.sin(t*.22*w+l.phase)*SPOT.roam*.6,.14,
            a.z+(at.z-a.z)*k+Math.cos(t*.18*w+l.phase*1.3)*SPOT.roam*.5);
          l.color.set(seat.color);
          const dim=seat.seated?1:SPOT.emptyDim;
          l.cone.material.uniforms.color.value.copy(l.color);l.cone.material.uniforms.haze.value=SPOT.haze*dim;
          l.light.color.copy(l.color);l.light.intensity=SPOT.power*dim;
          l.pool.material.color.copy(l.color);l.pool.material.opacity=SPOT.poolGlow*dim;
          l.ring.visible=SPOT.ringA>0;l.ring.position.set(at.x,SPOT.ringY,at.z);l.ring.material.color.copy(l.color);
          l.ring.material.opacity=SPOT.ringA*dim*(1-SPOT.ringPulse*.5+SPOT.ringPulse*.5*Math.sin(t*3));
        }
        scratch.copy(l.target.position).sub(l.source);const length=scratch.length();
        l.cone.quaternion.setFromUnitVectors(down,scratch.normalize());l.cone.scale.set(SPOT.coneW,length,SPOT.coneW);
        l.pool.position.copy(l.target.position);l.pool.scale.setScalar(SPOT.poolR);
        l.cone.visible=true;
      }
      const posers=spotlights?.posers??[];
      halos.forEach((h,i)=>{const p=posers[i]&&hexPoint(posers[i].hex);h.visible=!!p&&SPOT.halo>0;
        if(p){h.position.set(p.x,SPOT.haloY,p.z);h.material.opacity=SPOT.halo*(reduced?1:.6+.4*Math.sin(t*4));}});
    },
    diagnostics(){return{spotHexes:Object.fromEntries(lights.map(l=>[l.corner,l.hex])),halos:halos.filter(h=>h.visible).length};},
    dispose(){if(overlay)for(const l of lights)overlay.remove(l.cone);},
  };
}

// Materials remain shared for the static island; rigs get per-cabinet copies
// in arenaVisuals, so one player's training never changes another player's LEDs.
export function polishArenaModel(model) {
  const replacements=new Map(),emissives=[];
  model.traverse(o=>{
    if(!o.isMesh)return;
    const original=Array.isArray(o.material)?o.material:[o.material];
    const materials=original.map(m=>{
      if(replacements.has(m))return replacements.get(m);
      let next=m;
      if(/Hex ceramic|Obsidian stage/.test(m.name)) {
        // Preserve the preview's dark indigo base and authored surface response.
        // A bright RoomEnvironment had washed every material into pale silver.
        next=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(next,m);
        next.clearcoat=.2;next.clearcoatRoughness=.4;
      }
      replacements.set(m,next);
      if(next.emissiveIntensity>0) {
        const crack=/Crack/.test(next.name);next.emissiveIntensity*=crack?1.3:.9;
        emissives.push({material:next,base:next.emissiveIntensity,crack});
      }
      return next;
    });o.material=Array.isArray(o.material)?materials:materials[0];
  });
  for(const [old,next] of replacements)if(old!==next)old.dispose();
  return emissives;
}
