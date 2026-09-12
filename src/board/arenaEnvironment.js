import * as THREE from 'three';
import { ALL_HEXES } from './hexMap.js';

// Preview palette and geometry, mirrored into the live board's +Z orientation.
// Randomness is local and seeded: scenery never consumes the match RNG.
export function createArenaEnvironment(scene) {
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
  const lights=[];
  const coneGeo=new THREE.ConeGeometry(1,1,24,1,true); coneGeo.translate(0,-.5,0);
  for(const sx of [-1,1]) for(const sz of [-1,1]) {
    const color=sx===sz?0x54caff:0xb854ff;
    const source=new THREE.Vector3(sx*9.5,3.48,sz*7.5);
    const target=new THREE.Object3D();root.add(target);
    const light=new THREE.SpotLight(color,60,27,.23,.75,1.7);light.position.copy(source);light.target=target;root.add(light);
    const cone=new THREE.Mesh(coneGeo,new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,
      uniforms:{color:{value:new THREE.Color(color)}},
      vertexShader:'varying vec2 v; void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 v;uniform vec3 color;void main(){float a=sin(v.x*3.14159)*pow(v.y,0.4)*0.11;gl_FragColor=vec4(color,a);}'
    }));cone.position.copy(source);root.add(cone);
    const pool=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.12,depthWrite:false,blending:THREE.AdditiveBlending}));pool.rotation.x=-Math.PI/2;root.add(pool);
    lights.push({source,target,light,cone,pool,sx,sz});
  }
  const scratch=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0);
  return {
    update(time,{lite=false,reduced=false}={}) {
      glints.visible=!lite&&!reduced;glintMat.uniforms.time.value=time;
      starsGeo.setDrawRange(0,lite?900:2200);
      // Keep the complete silhouette in Standard too; 48 rocks cost one draw.
      for(const o of [...transforms,...debris.children.slice(1)]) {
        o.rotation.y=o.userData.baseRotation+(reduced?0:time*.025);
        o.position.y=o.userData.baseY+(reduced?0:Math.sin(time*.3+o.userData.phase)*.15);
      }
      transforms.forEach((o,i)=>{o.updateMatrix();chunks.setMatrixAt(i,o.matrix);});chunks.instanceMatrix.needsUpdate=true;
      const t=reduced?0:time;
      for(const l of lights) {
        l.target.position.set(l.sx*(3.6+Math.sin(t*.22+l.sz)*1.8),.14,l.sz*(2.2+Math.cos(t*.18+l.sx)*1.3));
        scratch.copy(l.target.position).sub(l.source);const length=scratch.length();
        l.cone.quaternion.setFromUnitVectors(down,scratch.normalize());l.cone.scale.set(1.05,length,1.05);
        l.pool.position.copy(l.target.position);l.pool.scale.setScalar(1.05);
        l.cone.visible=true;l.light.intensity=12;
      }
    },
    dispose(){},
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
