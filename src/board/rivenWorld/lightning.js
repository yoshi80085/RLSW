import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Octree } from 'three/addons/math/Octree.js';
import { rng,disposeObject } from './formation.js';

export function createLightning(scene,getRock,getSettings,camera){
  const random=rng(27181),ray=new THREE.Raycaster();let group=null,start=-100,next=2,held=false;
  let softness=0,crevices=0;
  let surfaceRock=getRock(),surfaceTree=new Octree().fromGraphNode(surfaceRock);
  function surface(angle,y){
    const radial=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));ray.set(radial.clone().multiplyScalar(32).setY(y),radial.clone().negate());
    const hit=surfaceTree.rayIntersect(ray.ray);
    return hit?hit.position.clone().addScaledVector(radial,THREE.MathUtils.lerp(.13,.055,crevices)):null;
  }
  function strike(time){
    if(group)disposeObject(group);group=new THREE.Group();group.name='Transient branching lightning';scene.add(group);
    const rock=getRock();
    if(rock!==surfaceRock){surfaceTree.clear();surfaceRock=rock;surfaceTree=new Octree().fromGraphNode(rock);}
    const settings=getSettings(),facing=Math.atan2(camera.position.z,camera.position.x);
    softness=THREE.MathUtils.clamp(settings.lightningSoftness??0,0,1);
    crevices=THREE.MathUtils.clamp(settings.creviceFollow??0,0,1);
    const palette=[0x279dff,0x39ff99,0xa66aff],lanes=[0,1,2];
    for(let i=lanes.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[lanes[i],lanes[j]]=[lanes[j],lanes[i]];}
    const choice=random(),boltCount=choice<.4?1:choice<.85?2:3;
    let delay=0;
    for(let order=0;order<boltCount;order++){
      const bolt=lanes[order];
      const angle=facing+(bolt-1)*.64+(random()-.5)*.16,paths=[],count=27,main=[];
      let drift=0;
      for(let i=0;i<count;i++){
        // Keep each rising trunk in a narrow lane. Mean reversion prevents
        // cumulative sideways wander; small local kinks keep it electrical.
        drift=drift*.55+(random()-.5)*.009;const lane=angle+drift+(random()-.5)*.024;
        const y=-.85-(1-i/(count-1))*settings.depth*(.95+bolt*.045);
        // Prefer recessed seams within a narrow lane, with continuity up the rock.
        let best=null,bestScore=Infinity;
        for(const offset of crevices?[-.045,-.0225,0,.0225,.045].map(v=>v*crevices):[0]){
          const a=lane+offset,p=surface(a,y);if(!p)continue;
          const score=Math.hypot(p.x,p.z)+Math.abs(a-(main.at(-1)?.a??lane))*12;
          if(score<bestScore){bestScore=score;best={p,a,y};}
        }
        if(best)main.push(best);
      }
      // Sample each jagged leg onto the surface again; a straight chord between
      // exposed corners would run through the cliff and disappear behind it.
      function contour(nodes){const points=[];for(let j=1;j<nodes.length;j++){const a=nodes[j-1],b=nodes[j];for(let k=0;k<7;k++){const f=k/7,p=surface(THREE.MathUtils.lerp(a.a,b.a,f),THREE.MathUtils.lerp(a.y,b.y,f));if(p)points.push(p);}}points.push(nodes.at(-1).p);return points;}
      if(main.length<3)continue;paths.push(contour(main));
      for(let b=0;b<settings.branches;b++){
        const at=main[Math.min(main.length-2,4+Math.floor(random()*(main.length-7)))],branch=[at];const side=b%2?1:-1;
        for(let i=1;i<6;i++){const a=at.a+side*i*.009+(random()-.5)*.012,y=Math.min(-.72,at.y+i*.22+(random()-.5)*.07),p=surface(a,y);if(p)branch.push({p,a,y});}
        if(branch.length>2)paths.push(contour(branch));
      }
      const boltGroup=new THREE.Group();boltGroup.name=`Rising lightning ${bolt+1}`;
      const low=Math.min(...paths.flat().map(p=>p.y))-.15,high=Math.max(...paths.flat().map(p=>p.y))+.15;
      const front={value:low};
      // Each lane has its own onset, climb speed, flicker and decay within a burst.
      const life=Math.min(1-delay,.65+random()*.25),rise=.4+random()*.2;
      boltGroup.userData={delay,life,rise,low,high,front,flicker:24+random()*18,phase:random()*Math.PI*2};
      group.add(boltGroup);delay+=.13+random()*.13;
      // Core and glow share one centerline mesh; the vertex shader supplies radius.
      const parts=paths.map((pts,index)=>{
        const curve=new THREE.CurvePath();for(let i=1;i<pts.length;i++)curve.add(new THREE.LineCurve3(pts[i-1],pts[i]));
        const part=new THREE.TubeGeometry(curve,pts.length*3,0,5,false);
        part.setAttribute('radiusScale',new THREE.BufferAttribute(new Float32Array(part.attributes.position.count).fill(index?.57:1),1));
        return part;
      });
      const geo=mergeGeometries(parts);parts.forEach(p=>p.dispose());geo.computeBoundingSphere();geo.boundingSphere.radius+=.24;
      // Broad, faint shells taper toward a colored core instead of a white wire.
      const shells=[[.105,.24,0,.025],[.105,.15,0,.065],[.105,.085,.13,.16],[.042,.035,.8,.48],[.014,.009,1,.3]];
      for(const [index,[hardRadius,softRadius,hardOpacity,softOpacity]] of shells.entries()){
        const radius=THREE.MathUtils.lerp(hardRadius,softRadius,softness),opacity=THREE.MathUtils.lerp(hardOpacity,softOpacity,softness);
        if(opacity===0)continue;
        const color=index===4?new THREE.Color(0xeaffff).lerp(new THREE.Color(0xd8e8ff),softness):palette[bolt];
        const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
        // Clip by height so forks cannot light up before the rising trunk arrives.
        mat.onBeforeCompile=shader=>{
          shader.uniforms.lightningFront=front;
          shader.uniforms.lightningRadius={value:radius};
          shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float lightningHeight;\nuniform float lightningRadius;\nattribute float radiusScale;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=normal*lightningRadius*radiusScale;\nlightningHeight=transformed.y;');
          shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float lightningHeight;\nuniform float lightningFront;').replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(lightningHeight>lightningFront)discard;');
        };
        mat.customProgramCacheKey=()=> 'rising-lightning-v2';
        const mesh=new THREE.Mesh(geo,mat);mesh.userData.base=opacity;boltGroup.add(mesh);
      }
    }
    start=time;next=time+settings.interval*(.8+random()*.4)+settings.duration;
  }
  return {strike,hold(value,time){held=value;if(value)strike(time);},update(time,reduced){
    const s=getSettings();if(time>=next&&!reduced&&!held)strike(time);
    const age=(time-start)/s.duration;
    if(group){
      group.visible=false;
      for(const bolt of group.children){
        const t=bolt.userData,local=(age-t.delay)/t.life;
        const climbing=local<t.rise,after=(local-t.rise)/(1-t.rise);
        const flicker=Math.sin(local*t.flicker+t.phase);
        const pulse=local<0||local>=1?0:climbing?.72+.28*Math.max(0,flicker):flicker<-.25?0:Math.exp(-after*3.5);
        t.front.value=held?t.high:THREE.MathUtils.lerp(t.low,t.high,THREE.MathUtils.clamp(local/t.rise,0,1));
        bolt.visible=held||(!reduced&&pulse>0);
        if(bolt.visible)group.visible=true;
        for(const mesh of bolt.children)mesh.material.opacity=mesh.userData.base*s.brightness*(held?1:pulse);
      }
    }
    return !!group?.visible;
  },dispose(){if(group)disposeObject(group);group=null;surfaceTree.clear();surfaceRock=null;}};
}
