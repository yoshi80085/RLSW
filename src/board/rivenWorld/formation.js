import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyRockLook } from './rockLook.js';

export function rng(seed) { return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296); }
const outline = [[-7.3,-9.12],[7.3,-9.12],[11.36,-2.03],[11.36,2.03],[7.3,9.12],[-7.3,9.12],[-11.36,2.03],[-11.36,-2.03]];

// A sealed core carries the deck; overlapping tapered fracture plates break its
// silhouette. Every vertex stays below the existing slab, including at max depth.
export function createFormation({ depth = 13, fracture = 1 } = {}) {
  const random = rng(95831), parts = [], palette = [.30,.42,.55,.68,.36,.9].map(shade => new THREE.Color().setScalar(shade));
  function poly(rings, tip) {
    const positions = [], colors = [], n = rings[0].length;
    const face = (a,b,c) => { const color = palette[Math.floor(random()*palette.length)]; for(const p of [a,c,b]) { positions.push(...p); colors.push(color.r,color.g,color.b); } };
    for(let j=0;j<rings.length-1;j++) for(let i=0;i<n;i++) {
      const k=(i+1)%n;face(rings[j][i],rings[j+1][i],rings[j][k]);face(rings[j][k],rings[j+1][i],rings[j+1][k]);
    }
    const center = rings[0].reduce((s,p)=>s.map((v,i)=>v+p[i]/n),[0,0,0]);
    for(let i=0;i<n;i++){face(center,rings[0][i],rings[0][(i+1)%n]);face(rings.at(-1)[i],tip,rings.at(-1)[(i+1)%n]);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();parts.push(g);
  }
  const rim=Array.from({length:96},(_,i)=>{const a=outline[Math.floor(i/12)],b=outline[(Math.floor(i/12)+1)%8],t=(i%12)/12;return [THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t)];});
  const rings=[[1.045,.0],[.98,.10],[.72,.35],[.40,.66],[.10,.98]].map(([scale,f],layer)=>rim.map(([x,z])=>{
    const r=scale*(1+(layer?random()-.5:0)*.28*fracture);
    return [x*r+f*.25,-.45-depth*f-(layer?random()*.04*depth:0),z*r-f*.18];
  }));
  poly(rings,[.2,-depth*1.15-.45,-.15]);
  function shard(x,y,z,rx,rz,length,angle,inward=.3){
    const n=5+Math.floor(random()*3),leanX=-x*inward+(random()-.5)*rx*.55,leanZ=-z*inward+(random()-.5)*rz*.55;
    const radial=Array.from({length:n},()=>.7+random()*.55);
    const rr=[[1,0],[.95,.19],[.58,.43],[.43,.70]].map(([scale,f])=>Array.from({length:n},(_,i)=>{
      const a=i/n*Math.PI*2,px=Math.cos(a)*rx*radial[i]*scale,pz=Math.sin(a)*rz*radial[i]*scale;
      return [x+px*Math.cos(angle)-pz*Math.sin(angle)+leanX*f,y-length*f-(f?random()*.12*length:random()*.12),z+px*Math.sin(angle)+pz*Math.cos(angle)+leanZ*f];
    }));poly(rr,[x+leanX,y-length,z+leanZ]);
  }
  // Shallow shoulders under the amps sweep inward. Deep perimeter stalactites
  // hide the keel from the hero camera and make the island read as a flat skirt.
  for(let i=0;i<64;i++){
    const p=rim[Math.floor(i*96/64)],a=Math.atan2(p[1],p[0]),r=.98+random()*.09;
    shard(p[0]*r,-.51-random()*.3,p[1]*r,.65+random()*.7*fracture,.75+random()*.7,depth*(.14+random()*.13),a,.24+random()*.12);
  }
  // Seat the fracture roots on the sloping skin instead of burying them inside
  // the core. Their broken ledges and offset tips must break the silhouette.
  const profile=[[0,1.045],[.10,.98],[.35,.72],[.66,.40],[.98,.10]];
  for(let i=0;i<55;i++){
    const f=.16+random()*.74,band=profile.findIndex(([height])=>height>f);
    const [f0,r0]=profile[band-1],[f1,r1]=profile[band];
    const r=THREE.MathUtils.lerp(r0,r1,(f-f0)/(f1-f0));
    const p=rim[Math.floor((i*.61803398875%1)*rim.length)],a=Math.atan2(p[1],p[0]);
    const width=(.45+r*.65)*(.7+random()*.75)*fracture;
    const length=depth*Math.min(1.07-f,.13+random()*.19);
    shard(p[0]*r,-.45-depth*f,p[1]*r,width,.5+r*(.35+random()*.55),length,a,.12+random()*.12);
  }
  const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:.13,flatShading:true});
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 rockPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nrockPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 rockPosition;
      float grain(vec3 p){return fract(sin(dot(floor(p),vec3(12.9898,78.233,37.719)))*43758.5453);}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
        float strata=sin(rockPosition.y*18.+sin(rockPosition.x*4.+rockPosition.z*3.)*2.);
        diffuseColor.rgb *= .84 + .16*grain(rockPosition*35.) + .04*strata;`);
  };
  applyRockLook(material);
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Riven basalt cliffs';return mesh;
}

export function disposeObject(root){const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])materials.add(m);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}
