import * as THREE from 'three';
import { CROWD_ROWS_MAX, CROWD_SEATS_PER_ROW } from '../data/gameConstants.js';

// ═══ 🎤 THE SEATED COSMIC CROWD ══════════════════════════════════════════════
// Sized from Alex's dial-in on `.scratch/crowd-size-preview.html`, 2026-09-22,
// 16 of 19 levers moved. The preview is the source of these numbers and
// `.scratch/crowdSizeGeometryCheck.mjs` carries the same set as `ALEX_DIAL_IN`.
//
// ⭐ THE FAN'S SIZE IS NOT IN THE STAND'S FOOTPRINT, and that is the whole
// finding. A stand is `seats × pitch × standScale` and it is boxed in on every
// side — 2.41 m of radial corridor between the board rim and the island edge,
// ±2.07 m sideways before the amp cabinets. `fanScale` appears nowhere in that
// product, so the fans doubled while `standScale` barely moved (1.30 → 1.33).
// Three of Alex's levers were walked back to clear a measured wall and NOT ONE
// of them was a size lever.
//
// 📏 The walls, measured off the arena mesh by `.scratch/arenaClearance.mjs`:
//      board rim   11.56    the front deck may not cross it (hex 6/13/99/106)
//      island edge 13.96    past it the deck is over the void
//      amps        ±2.07    sideways, from the stand's own axis
//      truss        3.35    overhead, and it is what caps the rake at 5 rows
// ⚠️ RE-RUN THAT SCRIPT IF THE ARENA IS RE-EXPORTED. These are a copy of its
// output and nothing tells them when the mesh moves.
// =============================================================================
export const CROWD_LOOK = Object.freeze({
  standScale:   1.33,
  pushOut:      0.33,   // ⚠️ 0.34 is the maximum. Alex dialled 0.48, which put
                        // the front rail over four playable hexes.
  standLift:    0.28,   // the deck floats; they are cosmic beings, not patrons
  seatPitch:    0.50,
  rowGap:       0.53,
  rowRise:      0.37,   // the rake, bent only at 5 rows — see `rowRiseFor`
  deckDepth:    0.48,
  deckMargin:   0.10,   // ⚠️ 0.11 is the maximum. Alex dialled 0.37; his END
                        // SEATS already cleared the amps at ±1.66, and it was the
                        // deck's own lip hitting them, so this costs no fan.
  fanScale:     2.02,   // ⭐ where the size actually came from
  diehardScale: 1.17,   // a diehard is worth 3.3 casuals; now it looks like it
  handInset:    0.12,   // hands set a fan's footprint; pulling them in buys pitch
  halo:         0.32,   // additive owner-coloured halo — the 2D crowd's "sea of
  haloSize:     0.66,   // lights", which the 3D crowd had dropped entirely
  ownerBlend:   0.64,   // nebula palette pulled toward the Spirit's colour
  casualBlend:  0.06,
});

const TRUSS_Y     = 3.35;   // lighting rig, measured
const TRUSS_CLEAR = 0.15;   // how far under it the top row must stay
const BASE_ROOT   = 0.49 * 1.2;
const FAN_TOP     = 0.61;   // head centre .49 + head radius .12, in fan-model units

/** 🪑 How many rows this crowd has earned. Grows a row at a time and stops at
 *  `CROWD_ROWS_MAX`.
 *  ⭐ EVERY FAN HAS A CHAIR, BECAUSE THE SEATS ARE THE CAP (Alex, 2026-09-22:
 *  *"the number of fans allowed is the number of seats allowed"*). `FAN_TOTAL_CAP`
 *  IS `CROWD_DRAWN_MAX`, so a full house is exactly five full rows and the
 *  grandstand is a readout of the crowd rather than a sample of it.
 *  ⚠️ THE CLAMP BELOW STAYS ANYWAY. It is the difference between a rules bug
 *  drawing a wrong number of fans and a rules bug hanging the renderer. */
export function rowsFor(total) {
  return Math.max(1, Math.min(CROWD_ROWS_MAX, Math.ceil(total / CROWD_SEATS_PER_ROW)));
}

/** 🎢 The rake, bent only as far as the lighting truss demands.
 *  ⚠️ AT FIVE ROWS ALEX'S 0.37 PUTS THE TOP ROW AT y 3.62 — THROUGH THE TRUSS.
 *  Rather than flatten every stand to suit the tallest one, the dialled rake
 *  stands at one to four rows (where it already clears) and only the five-row
 *  case is solved down, to about 0.29. The crowd on screen most of the time is
 *  the crowd Alex dialled. */
export function rowRiseFor(rows, look = CROWD_LOOK) {
  if (rows < 2) return look.rowRise;
  const fanTop = FAN_TOP * BASE_ROOT * look.fanScale;
  const budget = (TRUSS_Y - TRUSS_CLEAR - look.standLift) / look.standScale - 0.08 - 0.23 - fanTop;
  return Math.min(look.rowRise, Math.max(0.12, budget / (rows - 1)));
}

// Rounded shoulder and belly flow into one curled, tapered wisp.
function spiritBody(seed, ownerColor, blend){
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
  // 🎨 The nebula palette is pulled toward the owner's colour. It used to be
  // independent of it, so at arena distance every stand was the same blue-violet
  // and only the rail said whose crowd it was.
  const nebula=new THREE.Color(['#4d9de0','#aa5edd','#36bebc'][seed%3]).lerp(new THREE.Color(ownerColor),blend);
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

export function fanPawn3D({color='#aa88ff',filled=true,seed=0,style=null,look=CROWD_LOOK}={}){
  const root=new THREE.Group();root.name=filled?'Diehard fan':'Casual fan';
  const monster=filled&&style==='monster';
  root.userData.fanStyle=filled?style:'casual';
  const blend=filled?look.ownerBlend:look.casualBlend;
  const tint=monster?new THREE.Color('#080b10'):new THREE.Color(['#9eaaf0','#c49ce5','#8bd6d7'][seed%3]).lerp(new THREE.Color(color),blend);
  const material=new THREE.MeshStandardMaterial({color:tint,emissive:tint,emissiveIntensity:.2,roughness:.45});
  const ink=new THREE.MeshBasicMaterial({color:monster?'#63ff37':'#101827',toneMapped:!monster});
  const bodyMaterial=material.clone();bodyMaterial.color.set('#ffffff');bodyMaterial.emissive.set('#19274c');bodyMaterial.emissiveIntensity=.4;bodyMaterial.roughness=.65;bodyMaterial.vertexColors=true;bodyMaterial.transparent=true;bodyMaterial.depthWrite=false;
  if(monster){bodyMaterial.color.set('#080b10');bodyMaterial.emissive.set('#010503');}
  const body=new THREE.Mesh(spiritBody(seed,color,blend),bodyMaterial);body.name='Curled spirit body';root.add(body);
  const stars=[[-.047,.26,.088],[.045,.225,.078],[-.013,.16,.073]].map(([x,y,z],i)=>{
    const star=new THREE.Mesh(new THREE.OctahedronGeometry(i===0?.013:.008),new THREE.MeshBasicMaterial({color:i===1?'#ffdcff':'#ceffff',transparent:true}));
    star.position.set(x,y,z);star.scale.set(1,1.5,.4);body.add(star);return star;
  });
  const tip=body.geometry.userData.tip;
  const mist=new THREE.Sprite(new THREE.SpriteMaterial({map:cosmicMist(),color:['#66aaff','#b778ff','#54e1d4'][seed%3],transparent:true,opacity:.3,depthWrite:false,blending:THREE.AdditiveBlending}));
  mist.position.copy(tip);mist.scale.setScalar(.13);body.add(mist);
  const mote=new THREE.Sprite(mist.material.clone());mote.scale.setScalar(.025);body.add(mote);
  // ⭐ THE HALO. A fan's emissive is 0.2 and the bloom threshold is 1.05, so
  // nothing about a fan ever glowed — the rail at 1.3 did, which is exactly why
  // the furniture read from the arena camera and the crowd did not. One additive
  // sprite, owner-coloured, legible at nine pixels.
  if(look.halo>0){
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:cosmicMist(),color,transparent:true,
      opacity:look.halo,depthWrite:false,blending:THREE.AdditiveBlending}));
    halo.position.set(0,.3,-.02);halo.scale.setScalar(look.haloSize);halo.name='Fan halo';root.add(halo);
  }
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
  // 📌 HAND INSET IS A SIZE LEVER IN DISGUISE — a fan's footprint is set by its
  // hands, not its body, so pulling them in is what paid for the bigger fan.
  const hands=[-1,1].map(sign=>{const h=new THREE.Mesh(new THREE.SphereGeometry(.047,10,7),material);h.position.set(sign*look.handInset,.24,.035);root.add(h);return h;});
  root.scale.setScalar(BASE_ROOT*look.fanScale*(filled?look.diehardScale:1));
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

/**
 * Where a corner's stand stands, and which way it faces the board. Exported
 * so the battle director can frame a crowd without the crowd being built
 * (`battleDirector.js` — a charge shot has the Spirit's own fans behind it).
 */
export function grandstandPlacement(corner='blue',look=CROWD_LOOK){
  const signs={blue:[-1,-1],purple:[-1,1],yellow:[1,-1],red:[1,1]}[corner]??[-1,-1];
  const origin=new THREE.Vector3(signs[0]*10.5,look.standLift,signs[1]*6.25);
  const direction=origin.clone().setY(0).normalize().negate();
  return {position:origin.addScaledVector(direction,look.pushOut),yaw:Math.atan2(direction.x,direction.z)};
}

export function makeGrandstand({corner='blue',color='#8a91ff',diehards=6,casuals=12,style=null,seedOffset=0,look=CROWD_LOOK}={}){
  const group=new THREE.Group(),placed=grandstandPlacement(corner,look);
  group.position.copy(placed.position);group.rotation.y=placed.yaw;group.scale.setScalar(look.standScale);
  const deckMat=new THREE.MeshStandardMaterial({color:'#162439',metalness:.35,roughness:.45});
  const seatMat=new THREE.MeshStandardMaterial({color:'#354767',roughness:.5});
  const railMat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.3});
  const box=(w,h,d,x,y,z,mat)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
  const fans=[];let index=0;
  // 🪑 The stand is exactly as big as the crowd it holds, and a full house fills
  // it exactly. STRAIGHT SIDES, not the old taper: a tapering stand wastes its
  // back rows, and at this seat pitch that was 18 seats against 24.
  const drawnDiehards=Math.max(0,Math.floor(diehards)),drawnCasuals=Math.max(0,Math.floor(casuals));
  const total=drawnDiehards+drawnCasuals;
  const rows=rowsFor(total),rowRise=rowRiseFor(rows,look);
  const deckW=CROWD_SEATS_PER_ROW*look.seatPitch+look.deckMargin;
  for(let row=0;row<rows;row++){
    const y=.08+row*rowRise,z=-row*look.rowGap;
    box(deckW,.19,look.deckDepth,0,y,z,deckMat);
    box(deckW,.025,.025,0,y+.11,z+look.deckDepth/2-.005,railMat);
    for(let i=0;i<CROWD_SEATS_PER_ROW;i++){
      const x=(i-(CROWD_SEATS_PER_ROW-1)/2)*look.seatPitch;
      const seatZ=z+.045;
      box(look.seatPitch*.73,.12,.25,x,y+.17,seatZ,seatMat);
      box(look.seatPitch*.73,.18,.025,x,y+.29,seatZ-.12,seatMat);
      if(index<total){
        // 📌 SEED CARRIES THE CORNER. It used to be the seat index alone, so seat
        // 3 was the same silhouette and the same palette in all four stands —
        // four copies of one crowd, and very visible with all four on screen.
        const fan=fanPawn3D({color,filled:index<drawnDiehards,seed:index+seedOffset,style,look});
        fan.position.set(x,y+.23,seatZ);group.add(fan);fans.push(fan);
      }
      index++;
    }
  }
  return {group,fans,rows,
    tick:(t,{reduced=false}={})=>fans.forEach(f=>f.userData.tick(t,reduced)),
    // ⭐ THE CROWD REACTS TO A BOUT (Alex, 2026-09-24: "the winner of the bout
    // sees their fan's reactions"). `mood` +1 jumps, −1 sags, a tie a polite
    // bounce; `amount` 0–1 eases it in. Applied ON TOP of `tick`, so it must be
    // called after it every frame and simply not called once the bout is over.
    react:(t,mood,amount,{reduced=false}={})=>fans.forEach((f,k)=>{
      if(reduced||!amount||!mood){f.rotation.x=0;f.rotation.z=0;return;}   // settles back
      const beat=Math.abs(Math.sin(t*7+k*1.3));
      f.position.y+=mood>0?amount*mood*beat*.22:amount*mood*.06;
      f.rotation.x=mood<0?-mood*amount*.35:0;
      f.rotation.z=mood>0?amount*Math.sin(t*5+k)*.12:0;
    }),
    speaker:()=>fans[0]?.localToWorld(new THREE.Vector3(0,.65,0))};
}

export function disposeGrandstand(stand){
  stand.group.removeFromParent();const resources=new Set();
  stand.group.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?[o.material].flat():[])resources.add(m);});
  resources.forEach(r=>r.dispose());
}
