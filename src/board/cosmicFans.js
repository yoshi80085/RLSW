import * as THREE from 'three';

// Rounded shoulder and belly flow into one curled, tapered wisp.
function spiritBody(seed){
  const curl=seed%2?-1:1;
  // Five silhouettes, mirrored independently: short hooks, long wisps and curls.
  const [reach,lift,dip]=[[.15,.19,.055],[.21,.11,.035],[.17,.22,.07],[.225,.075,.025],[.185,.155,.045]][seed%5];
  const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,.345,0),new THREE.Vector3(0,.26,0),
    new THREE.Vector3(-.018*curl,.16,0),new THREE.Vector3(.025*curl,.07,0),
    new THREE.Vector3(reach*.65*curl,dip,0),new THREE.Vector3(reach*curl,(dip+lift)*.5,0),
    new THREE.Vector3(reach*(lift>.16?.82:1.08)*curl,lift,0),
  ]);
  const radii=[.012,.135,.105,.062,.032,.014,0],vertices=[],indices=[],colors=[];
  const rows=36,sides=14;
  const deep=new THREE.Color(['#25215b','#382063','#123e58'][seed%3]);
  const nebula=new THREE.Color(['#4d9de0','#aa5edd','#36bebc'][seed%3]);
  for(let i=0;i<=rows;i++){
    const t=i/rows,p=curve.getPoint(t),tangent=curve.getTangent(t);
    const normal=new THREE.Vector3(-tangent.y,tangent.x,0).normalize();
    const u=t*(radii.length-1),j=Math.min(radii.length-2,Math.floor(u));
    const f=(1-Math.cos((u-j)*Math.PI))/2,r=THREE.MathUtils.lerp(radii[j],radii[j+1],f);
    for(let k=0;k<=sides;k++){
      const angle=k/sides*Math.PI*2;
      vertices.push(p.x+normal.x*r*Math.cos(angle),p.y+normal.y*r*Math.cos(angle),Math.sin(angle)*r*.72);
      const shade=deep.clone().lerp(nebula,Math.min(1,.18+.3*Math.sin(t*9+angle*2+seed)**2+.6*THREE.MathUtils.smoothstep(t,.5,1)));
      colors.push(shade.r,shade.g,shade.b,1-.95*THREE.MathUtils.smoothstep(t,.65,1));
      if(i<rows&&k<sides){const a=i*(sides+1)+k,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
  geometry.userData.tip=curve.getPoint(1);geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

let mistTexture;
function cosmicMist(){
  if(mistTexture)return mistTexture;
  const size=32,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const offset=(y*size+x)*4,r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5);
    data.set([255,255,255,Math.round(255*Math.max(0,1-r)**2)],offset);
  }
  mistTexture=new THREE.DataTexture(data,size,size);mistTexture.needsUpdate=true;return mistTexture;
}

export function fanPawn3D({color='#aa88ff',filled=true,seed=0,style=null}={}){
  const root=new THREE.Group();root.name=filled?'Diehard fan':'Casual fan';
  const monster=filled&&style==='monster';
  root.userData.fanStyle=filled?style:'casual';
  const tint=monster?new THREE.Color('#080b10'):new THREE.Color(['#9eaaf0','#c49ce5','#8bd6d7'][seed%3]).lerp(new THREE.Color(color),filled?.22:.06);
  const material=new THREE.MeshStandardMaterial({color:tint,emissive:tint,emissiveIntensity:.2,roughness:.45});
  const ink=new THREE.MeshBasicMaterial({color:monster?'#63ff37':'#101827',toneMapped:!monster});
  const bodyMaterial=material.clone();bodyMaterial.color.set('#ffffff');bodyMaterial.emissive.set('#19274c');bodyMaterial.emissiveIntensity=.4;bodyMaterial.roughness=.65;bodyMaterial.vertexColors=true;bodyMaterial.transparent=true;bodyMaterial.depthWrite=false;
  if(monster){bodyMaterial.color.set('#080b10');bodyMaterial.emissive.set('#010503');}
  const body=new THREE.Mesh(spiritBody(seed),bodyMaterial);body.name='Curled spirit body';root.add(body);
  const stars=[[-.047,.26,.088],[.045,.225,.078],[-.013,.16,.073]].map(([x,y,z],i)=>{
    const star=new THREE.Mesh(new THREE.OctahedronGeometry(i===0?.013:.008),new THREE.MeshBasicMaterial({color:i===1?'#ffdcff':'#ceffff',transparent:true}));
    star.position.set(x,y,z);star.scale.set(1,1.5,.4);body.add(star);return star;
  });
  const tip=body.geometry.userData.tip;
  const mist=new THREE.Sprite(new THREE.SpriteMaterial({map:cosmicMist(),color:['#66aaff','#b778ff','#54e1d4'][seed%3],transparent:true,opacity:.3,depthWrite:false,blending:THREE.AdditiveBlending}));
  mist.position.copy(tip);mist.scale.setScalar(.13);body.add(mist);
  const mote=new THREE.Sprite(mist.material.clone());mote.scale.setScalar(.025);body.add(mote);
  const head=new THREE.Group();head.position.y=.49;root.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(.12,16,10),material));
  if(filled&&style==='ronin'){
    const cloth=new THREE.MeshStandardMaterial({color:'#fff5e9',roughness:.9});
    const band=new THREE.Mesh(new THREE.CylinderGeometry(.103,.12,.046,24,1,true),cloth);
    band.name='Ronin hachimaki';band.position.y=.052;head.add(band);
    const emblem=new THREE.Mesh(new THREE.CircleGeometry(.019,12),new THREE.MeshBasicMaterial({color:'#d83a4c'}));
    emblem.position.set(0,.052,.114);head.add(emblem);
    for(const sign of [-1,1]){
      const tail=new THREE.Mesh(new THREE.BoxGeometry(.035,.135,.012),cloth);
      tail.position.set(sign*.078,-.017,-.109);tail.rotation.z=sign*-.6;head.add(tail);
    }
  }
  if(filled&&style==='intergalactic'){
    const gold=new THREE.MeshStandardMaterial({color:'#ffc52e',emissive:'#9b6008',emissiveIntensity:.35,metalness:.72,roughness:.25});
    const path=new THREE.CatmullRomCurve3([new THREE.Vector3(-.10,.34,.06),new THREE.Vector3(-.07,.28,.10),new THREE.Vector3(0,.25,.112),new THREE.Vector3(.07,.28,.10),new THREE.Vector3(.10,.34,.06)]);
    const chain=new THREE.Mesh(new THREE.TubeGeometry(path,16,.013,5,false),gold);chain.name='Intergalactic gold chain';root.add(chain);
    const pendant=new THREE.Mesh(new THREE.TorusGeometry(.023,.008,5,12),gold);pendant.position.set(0,.22,.116);root.add(pendant);
  }
  for(const x of [-.042,.042]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.019,7,5),ink);eye.position.set(x,.006,.113);head.add(eye);}
  const hands=[-1,1].map(sign=>{const h=new THREE.Mesh(new THREE.SphereGeometry(.047,10,7),material);h.position.set(sign*.205,.24,.035);root.add(h);return h;});
  root.scale.setScalar(.49*1.2);
  root.userData.tick=(time,quiet=false)=>{const t=time+seed*.71;
    root.userData.restY??=root.position.y;
    root.position.y=root.userData.restY+.025+(quiet?0:Math.sin(t*1.5)*.014);
    body.rotation.z=quiet?0:Math.sin(t*1.1)*.085;
    stars.forEach((s,i)=>{s.material.opacity=quiet?.85:.65+.35*Math.sin(t*1.3+i*2)**2;});
    const drift=quiet?.35:(t*.18)%1;
    mote.position.copy(tip).add(new THREE.Vector3((seed%2?-1:1)*drift*.045,drift*.075,.015));
    mote.material.opacity=quiet?.25:Math.sin(drift*Math.PI)*.5;
    head.position.y=.49+(quiet?0:Math.sin(t*2)*.012);
    head.rotation.z=quiet?0:Math.sin(t*.8)*.06;
    hands.forEach((h,i)=>{const wave=!quiet&&Math.sin(t*.37+i)> .8;h.position.y=wave?.52+Math.sin(t*5)*.025:.24;});};
  return root;
}

export function makeGrandstand({corner='blue',color='#8a91ff',size=1.3,diehards=6,casuals=12,style=null}={}){
  const signs={blue:[-1,-1],purple:[-1,1],yellow:[1,-1],red:[1,1]}[corner];
  const group=new THREE.Group(),origin=new THREE.Vector3(signs[0]*10.5,0,signs[1]*6.25);
  const direction=origin.clone().normalize().negate();group.position.copy(origin);group.rotation.y=Math.atan2(direction.x,direction.z);group.scale.setScalar(size);
  group.position.addScaledVector(direction,.22);
  const deck=new THREE.MeshStandardMaterial({color:'#162439',metalness:.35,roughness:.45}),seatMat=new THREE.MeshStandardMaterial({color:'#354767',roughness:.5});
  const railMat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.3});
  const box=(w,h,d,x,y,z,mat)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
  const fans=[];let index=0;
  for(let row=0;row<4;row++){
    const y=.08+row*.27,z=-row*.46;
    box(2.55-row*.18,.19,.48,0,y,z,deck);box(2.55-row*.18,.025,.025,0,y+.11,z+.235,railMat);
    for(let i=0;i<7-row;i++){
      const x=(i-(6-row)/2)*.30;
      const seatZ=z+.045;
      box(.22,.12,.25,x,y+.17,seatZ,seatMat);
      box(.22,.18,.025,x,y+.29,seatZ-.12,seatMat);
      if(index<diehards+casuals){const fan=fanPawn3D({color,filled:index<diehards,seed:index,style});fan.position.set(x,y+.23,seatZ);group.add(fan);fans.push(fan);}
      index++;
    }
  }
  return {group,fans,tick:(t,{reduced=false}={})=>fans.forEach(f=>f.userData.tick(t,reduced)),speaker:()=>fans[0]?.localToWorld(new THREE.Vector3(0,.65,0))};
}

export function disposeGrandstand(stand){
  stand.group.removeFromParent();const resources=new Set();
  stand.group.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?[o.material].flat():[])resources.add(m);});
  resources.forEach(r=>r.dispose());
}
