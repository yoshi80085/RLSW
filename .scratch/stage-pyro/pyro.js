import * as THREE from 'three';
import { HEX_BY_NUM } from '../../src/board/hexMap.js';
import { hash, smooth } from './choreography.js';
export const point=(num,y=0)=>{const h=HEX_BY_NUM[num];return new THREE.Vector3((h.px-3255)/200,y,(h.py-2415)/200);};
const metal=color=>new THREE.MeshStandardMaterial({color,metalness:.8,roughness:.32});
const glow=(color,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
function mesh(root,g,m,x=0,y=0,z=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);root.add(o);return o;}
function ring(root,r,t,mat,y){const o=mesh(root,new THREE.TorusGeometry(r,t,8,32),mat,0,y);o.rotation.x=Math.PI/2;return o;}
function flame(root){
 const uniforms={time:{value:0},power:{value:0}};
 const mat=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
 vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec2 v;uniform float time;uniform float power;
 float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
 void main(){float y=v.y;float n=noise(vec2(v.x*6.,y*8.-time*6.));float n2=noise(vec2(v.x*13.+time,y*17.-time*10.));float sway=sin(y*9.-time*5.)*.1*y;
 float shape=1.-abs(v.x-.5+sway)*2./max(.04,(1.-y)*.85+.07);float f=shape+(n-.5)*.9+(n2-.5)*.35-y*.3;
 float a=smoothstep(.02,.4,f)*smoothstep(1.,.65,y)*smoothstep(0.,.06,y)*power;
 vec3 col=mix(vec3(1.,.055,.002),vec3(1.,.48,.025),smoothstep(.1,.5,f));col=mix(col,vec3(1.,.94,.58),smoothstep(.5,.95,f)*(1.-y));gl_FragColor=vec4(col*2.1,a);}`});
 const group=new THREE.Group();root.add(group);
 for(let i=0;i<2;i++){const p=mesh(group,new THREE.PlaneGeometry(1,1),mat,0,.5);p.rotation.y=i*Math.PI/2;}
 return {group,uniforms};
}
function mortar(root,num,index){
 const g=new THREE.Group();g.position.copy(point(num,.09));root.add(g);
 const dark=metal('#171b21'),edge=metal('#8190a0');
 mesh(g,new THREE.CylinderGeometry(.72,.78,.14,6),dark);
 const warning=mesh(g,new THREE.RingGeometry(.83,.88,6),glow('#ff6a16'),0,.05);warning.rotation.x=-Math.PI/2;
 const barrel=new THREE.Group();g.add(barrel);
 mesh(barrel,new THREE.CylinderGeometry(.32,.43,.88,16,1,true),dark,0,.58);
 for(const y of [.24,.5,.92])ring(barrel,.35,.055,edge,y);
 mesh(barrel,new THREE.CylinderGeometry(.29,.29,.04,20),glow('#ff6719'),0,.89);
 const bore=mesh(barrel,new THREE.CylinderGeometry(.25,.25,.02,20),glow('#ffd474'),0,.925);
 for(let j=0;j<4;j++){const a=j*Math.PI/2;mesh(barrel,new THREE.BoxGeometry(.06,.6,.06),edge,Math.cos(a)*.41,.5,Math.sin(a)*.41);}
 const petals=[];
 for(let j=0;j<6;j++){
  const pivot=new THREE.Group();pivot.rotation.y=j*Math.PI/3;g.add(pivot);
  const hinge=new THREE.Group();hinge.position.z=.53;pivot.add(hinge);
  mesh(hinge,new THREE.BoxGeometry(.47,.07,.44),metal('#3f4955'),0,.11,-.21);
  mesh(hinge,new THREE.BoxGeometry(.27,.012,.05),glow('#e69232',.65),0,.153,-.17);petals.push(hinge);
 }
 const exhaust=flame(g);exhaust.group.position.y=.6;
 return {g,barrel,petals,warning,bore,exhaust,index,num};
}
export function createPyro(scene,nums){
 const root=new THREE.Group();scene.add(root);
 const mortars=nums.map((n,i)=>mortar(root,n,i));
 const cannons=[];
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,g=new THREE.Group();g.position.set(Math.cos(a)*13.6,.2,Math.sin(a)*13.6);g.rotation.y=-a;root.add(g);
  mesh(g,new THREE.BoxGeometry(.85,.25,.85),metal('#36424f'));
  const nozzle=new THREE.Group();nozzle.rotation.z=-.22;g.add(nozzle);
  mesh(nozzle,new THREE.CylinderGeometry(.2,.31,.8,12),metal('#29303a'),0,.47);ring(nozzle,.23,.055,metal('#acb5bd'),.83);
  const f=flame(nozzle);f.group.position.y=.8;cannons.push({g,f});
 }
 // A physical truss is the source of the finale's falling sparks.
 const truss=new THREE.Group();root.add(truss);truss.position.set(0,11,-10.8);
 for(const y of [-.2,.2])mesh(truss,new THREE.BoxGeometry(22,.065,.065),metal('#566471'),0,y);
 for(let i=-11;i<=11;i++){const bar=mesh(truss,new THREE.BoxGeometry(.045,.55,.045),metal('#566471'),i,0);bar.rotation.z=i%2?.75:-.75;}
 const count=22000,positions=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('size',new THREE.BufferAttribute(sizes,1).setUsage(THREE.DynamicDrawUsage));
 const particleMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,uniforms:{pixelScale:{value:800}},
 vertexShader:`attribute float size;varying vec3 c;uniform float pixelScale;void main(){c=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*pixelScale/-p.z,1.,38.);}`,
 fragmentShader:`varying vec3 c;void main(){float d=length(gl_PointCoord-.5)*2.;float a=exp(-d*d*5.)*smoothstep(1.,.5,d);gl_FragColor=vec4(c,a);}`});
 const particles=new THREE.Points(geo,particleMat);particles.frustumCulled=false;root.add(particles);
 const light=new THREE.PointLight('#ff862b',0,38,1.2);light.position.set(0,6,0);root.add(light);
 let used=0;
 function dot(x,y,z,size,r,g,b){if(used>=count)return;let k=used*3;positions[k]=x;positions[k+1]=y;positions[k+2]=z;colors[k]=r;colors[k+1]=g;colors[k+2]=b;sizes[used++]=size;}
 function spark(x,y,z,age,life,seed,power=1){if(age<0||age>life)return;const f=1-age/life;dot(x,y,z,.065*power,2.5*f,(.45+hash(seed)*1.2)*f,.08*f);}
 function burst(p,age,seed,s){
  if(age<0||age>4.6)return;
  const amount=Math.floor(150*s.density),fade=Math.pow(1-age/4.6,1.3);
  for(let j=0;j<amount;j++){
   const a=hash(seed+j*7)*Math.PI*2,yy=hash(seed+j*11+7)*2-1,rr=Math.sqrt(1-yy*yy),speed=s.burst*(.65+hash(j+seed)*.5);
   const dx=Math.cos(a)*rr*speed,dy=yy*speed,dz=Math.sin(a)*rr*speed;
   const special=j%4===0,red=s.palette==='red'&&special,violet=s.palette==='electric'&&special;
   for(let tail=0;tail<3;tail++){
    const tt=Math.max(0,age-tail*.045),sp=(1-Math.exp(-tt*.72))*1.45,decay=fade*(1-tail*.24)*(hash(j*13+Math.floor(age*15))>.1?1:.4);
    dot(p.x+dx*sp,p.y+dy*sp-.48*tt*tt,p.z+dz*sp,.22-tail*.04,(violet?2.6:6)*decay,(red?.18:violet?.6:2.9)*decay,(violet?6:.32)*decay);
   }
  }
 }
 function update(t,s,cue=null){
  used=0;let impact=0;truss.visible=s.curtain;
  for(const m of mortars){
   const wave=m.index<5?0:1,idx=wave?m.index-5:m.index,deploy=cue?cue.deployedAt:(wave?11:1),fire=cue?cue.fireAt[m.index]:(wave?14.5:5)+idx*s.stagger,end=cue?cue.endAt:(wave?22:10);
   const open=smooth((t-deploy)/1.3)*(1-smooth((t-end)/1.4));
   m.g.visible=s.mortars&&t>=deploy&&t<end+1.4;
   const a=t-fire,recoil=a>=0&&a<.45?Math.sin(a/.45*Math.PI)*.24:0;
   m.barrel.position.y=-.9+(smooth((t-deploy-.4)/1.5)*(1-smooth((t-end)/1.1)))*.98-recoil;
   const struck=cue?.hit===m.num&&a>=0?smooth((a-.08)/.38):0;
   m.barrel.position.y-=.95*struck;
   for(const p of m.petals)p.rotation.x=open*1.65*(1-struck);
   m.exhaust.group.position.y=.6-.4*struck;
   m.warning.visible=s.guides;m.warning.material.opacity=open*(a<0?.45+.3*Math.sin(t*8):.8);
   m.bore.material.opacity=open*(.45+.3*Math.sin(t*9));
   const firing=a>=0?Math.exp(-a*4):0,burn=a>=0?smooth(a*4)*(1-smooth((t-end+1)/1.5))*.42:0;
   m.exhaust.uniforms.time.value=t+m.index;m.exhaust.uniforms.power.value=Math.min(1,firing+burn);m.exhaust.group.scale.set(s.width*(.9+firing*.5),.9+firing*5, s.width*(.9+firing*.5));
   if(s.mortars)impact+=firing;
   const origin=point(m.num,1.15),flight=1.5,drift=new THREE.Vector3((hash(m.index+23)-.5)*2,0,(hash(m.index+34)-.5)*2),height=8+hash(m.index+17)*3;
   if(s.fireworks&&a>=0&&a<flight+.55){
    for(let j=0;j<Math.floor(65*s.density);j++){
     const tail=j*.009,tt=a-tail;if(tt<0||tt>flight)continue;
     const u=tt/flight;dot(origin.x+drift.x*u+(hash(j)-.5)*.08,origin.y+height*u,origin.z+drift.z*u,.15*(1-j/90),3,1.5,.3);
    }
   }
   if(s.fireworks)burst(origin.clone().add(drift).setY(origin.y+height),a-flight,m.index*331,s);
   if(s.mortars&&a>=0&&t<end){
    for(let j=0;j<Math.floor(30*s.density);j++){
     const age=(a+hash(j+17)*2)%1.7,angle=hash(j*7+m.index)*Math.PI*2,speed=.2+hash(j+4)*1.4;
     spark(origin.x+Math.cos(angle)*age*speed,origin.y+age*3-age*age*2,origin.z+Math.sin(angle)*age*speed,age,1.7,j,.9);
    }
   }
  }
  cannons.forEach(({g,f},i)=>{
   g.visible=s.cannons;const first=(cue?cue.showAt:5)+i*.105,final=(cue?Infinity:14.5)+i*.06;
   const pulse=start=>t<start?0:Math.max(0,1-(t-start)/1.15);
   const chase=!cue&&t>3.5&&t<14.5?Math.pow(Math.max(0,Math.sin(t*3-i*.8)),14)*.42:0;
   const strength=Math.max(chase,pulse(first),pulse(final),pulse(final+1.8));
   f.uniforms.time.value=t+i*.47;f.uniforms.power.value=strength;
   f.group.scale.set(1.4*s.width,s.height*(.25+.75*strength),1.4*s.width);
   if(s.cannons)impact+=strength*.25;
  });
  const curtainAt=cue?cue.showAt+.9:15.4;
  if(s.curtain&&t>=curtainAt&&t<curtainAt+6.6){
   for(let j=0;j<Math.floor(1100*s.density);j++){
    const start=curtainAt+hash(j+128)*3.2,age=t-start;if(age<0||age>3.1)continue;
    const x=(hash(j*7+3)-.5)*22,y=10.9-.7*age-1.45*age*age,z=-10.8+Math.sin(j)*age*.2;
    if(y>.2)spark(x,y,z,age,3.1,j,.8);
   }
  }
  light.intensity=impact*9;geo.setDrawRange(0,used);for(const attr of Object.values(geo.attributes))attr.needsUpdate=true;
  return used;
 }
 return {root,update,resize:h=>particleMat.uniforms.pixelScale.value=h,focus:()=>point(nums[0],.5)};
}
