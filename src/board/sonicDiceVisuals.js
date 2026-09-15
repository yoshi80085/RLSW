import * as THREE from 'three';
import { SONIC_PRESENTATION } from './sonicPresentation.js';

// All text is a world-space billboard attached to a miniature/die. Nothing
// opens a DOM battle overlay or advances the match's seeded random stream.
//
// Every plate is drawn at a fixed canvas resolution and scaled in world units,
// so a die face keeps the same pixel budget however far the arena camera sits.
// §12.1b requires the face, the threshold AND a worded verdict: colour alone is
// not allowed to carry the read.
const PLATE_W=512,PLATE_H=192;
const roundedPlate=(ctx,w,h,radius,fill,stroke)=>{
  ctx.beginPath();
  if(ctx.roundRect)ctx.roundRect(4,4,w-8,h-8,radius);
  else ctx.rect(4,4,w-8,h-8);
  ctx.fillStyle=fill;ctx.fill();
  if(stroke){ctx.lineWidth=6;ctx.strokeStyle=stroke;ctx.stroke();}
};

export function sonicSceneLabel(text,color,width=2.7,height=.55,{fill='#050d18e8',border=null,font=96,weight='bold'}={}) {
  const canvas=globalThis.document?.createElement?.('canvas');
  let ctx=null;
  try { if(canvas){canvas.width=PLATE_W;canvas.height=PLATE_H;ctx=canvas.getContext('2d');} } catch { /* headless */ }
  const texture=ctx?new THREE.CanvasTexture(canvas):null;
  if(texture)texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:texture?0xffffff:color,
    transparent:true,depthTest:false,depthWrite:false}));
  sprite.scale.set(width,height,1);sprite.renderOrder=160;
  const write=(value,tint=color)=>{
    sprite.userData.text=String(value);
    if(!ctx)return;
    ctx.clearRect(0,0,PLATE_W,PLATE_H);
    roundedPlate(ctx,PLATE_W,PLATE_H,34,fill,border);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${weight} ${font}px sans-serif`;
    // A dark rim under the glyph keeps it legible over a blown-out bloom pass.
    ctx.lineWidth=10;ctx.strokeStyle='#020913cc';ctx.strokeText(String(value),PLATE_W/2,PLATE_H/2,PLATE_W-40);
    ctx.fillStyle=tint;ctx.fillText(String(value),PLATE_W/2,PLATE_H/2,PLATE_W-40);
    texture.needsUpdate=true;
  };
  write(text);return {sprite,write,texture};
}

// One die face: a large numeral over its own plate, with the verdict spelled out
// underneath once the roll has settled. Kept as two canvases so the numeral can
// use the entire plate height while the verdict stays a readable strip.
function sonicDieFace(color) {
  const canvas=globalThis.document?.createElement?.('canvas');
  let ctx=null;
  try { if(canvas){canvas.width=320;canvas.height=320;ctx=canvas.getContext('2d');} } catch { /* headless */ }
  const texture=ctx?new THREE.CanvasTexture(canvas):null;
  if(texture)texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:texture?0xffffff:color,
    transparent:true,depthTest:false,depthWrite:false}));
  sprite.renderOrder=162;
  const write=(value,tint=color)=>{
    sprite.userData.text=String(value);
    if(!ctx)return;
    ctx.clearRect(0,0,320,320);
    ctx.beginPath();
    if(ctx.roundRect)ctx.roundRect(18,18,284,284,44);else ctx.rect(18,18,284,284);
    ctx.fillStyle='#030a14f2';ctx.fill();
    ctx.lineWidth=11;ctx.strokeStyle=tint;ctx.stroke();
    ctx.textAlign='center';ctx.textBaseline='middle';
    const text=String(value);
    ctx.font=`bold ${text.length>1?150:186}px sans-serif`;
    ctx.lineWidth=16;ctx.strokeStyle='#01070ee6';ctx.strokeText(text,160,172,250);
    ctx.fillStyle=tint;ctx.fillText(text,160,172,250);
    texture.needsUpdate=true;
  };
  write('?');return {sprite,write,texture};
}

const THROUGH='#7dffb4';
const DIE_SPACING=1.5,DIE_ROW=6,DIE_HEIGHT=2.9,ROW_DROP=1.35;
export const sonicDiceHeight=(count=1)=>DIE_HEIGHT+.9-Math.max(0,Math.ceil(count/DIE_ROW)-1)*ROW_DROP;

export function createSonicDiceVisuals({attackerPosition,defenderPosition,dicePool=[],diceVals=[],diceHits=[],color='#66dcff',shieldColor='#b0a0ff',shieldValue=0,hitCount=0,damage=0}) {
  const group=new THREE.Group();group.name='Sonic dice in the arena';
  const dice=[],labels=[];let disposed=false;
  const label=(...args)=>{const made=sonicSceneLabel(...args);labels.push(made);return made;};
  const target=label(`SUSTAIN ${shieldValue}`,shieldColor,3.1,.62,{border:shieldColor,font:88});
  target.sprite.position.copy(defenderPosition).add(new THREE.Vector3(0,2,0));group.add(target.sprite);
  // Clear of the tallest die plus its index chip, so a low camera angle cannot
  // foreshorten the headline into the top row of dice.
  const title=label('',color,5.4,.78,{border:color,font:78});
  title.sprite.position.copy(attackerPosition).add(new THREE.Vector3(0,DIE_HEIGHT+1.85,0));group.add(title.sprite);
  const direction=new THREE.Vector3().subVectors(defenderPosition,attackerPosition);direction.y=0;direction.normalize();
  const across=new THREE.Vector3(-direction.z,0,direction.x);
  if(!across.lengthSq())across.set(1,0,0);
  dicePool.forEach((sides,i)=>{
    const g=new THREE.Group();g.name=`Sonic die ${i+1}`;
    const geometry=sides<=6?new THREE.BoxGeometry(.7,.7,.7):sides<=8?new THREE.OctahedronGeometry(.52):new THREE.DodecahedronGeometry(.5);
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.3,depthTest:false}));
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color,transparent:true,opacity:.95,depthTest:false}));
    mesh.add(edges);mesh.renderOrder=150;edges.renderOrder=151;g.add(mesh);
    // A flat verdict ring under the die: a second, non-colour channel that still
    // reads at a glance when several dice overlap at a shallow camera angle.
    const ring=new THREE.Mesh(new THREE.RingGeometry(.62,.78,28),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.4,depthTest:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
    ring.rotation.x=-Math.PI/2;ring.position.y=-.62;ring.renderOrder=149;g.add(ring);
    const face=sonicDieFace(color);labels.push(face);
    face.sprite.scale.set(1.16,1.16,1);face.sprite.position.y=.04;g.add(face.sprite);
    const verdict=label('',color,1.72,.38,{fill:'#03090fe0',font:96});
    verdict.sprite.position.y=-1.02;verdict.sprite.visible=false;g.add(verdict.sprite);
    const index=label(`#${i+1}`,color,.62,.26,{fill:'#03090fcc',font:96});
    index.sprite.position.set(0,.86,0);g.add(index.sprite);
    const row=Math.floor(i/DIE_ROW),count=Math.min(DIE_ROW,dicePool.length-row*DIE_ROW);
    const home=new THREE.Vector3().copy(attackerPosition).addScaledVector(across,(i%DIE_ROW-(count-1)/2)*DIE_SPACING);
    home.y+=DIE_HEIGHT-row*ROW_DROP;g.position.copy(home);group.add(g);
    dice.push({g,mesh,edges,ring,face,verdict,index,home,sides,value:diceVals[i],hit:diceHits[i],i,shown:null,tagged:null});
  });
  function update(elapsed,{phase='sonic_ready',reduced=false}={}) {
    if(disposed)return;
    const armed=phase==='sonic_armed';
    const rolling=phase==='sonic_roll',settled=['sonic_reveal','sonic_charge','sonic_volley','result','sonic_aftermath'].includes(phase);
    const fading=phase==='sonic_charge';
    const opacity=fading?Math.max(0,1-elapsed/SONIC_PRESENTATION.charge):['sonic_volley','result','sonic_aftermath'].includes(phase)?0:1;
    const result=['result','sonic_aftermath'].includes(phase);
    target.sprite.visible=true;title.sprite.visible=opacity>0||result;
    const headline=result?`${hitCount} THROUGH · ${damage} VIBE`
      :armed?`PRESS ROLL · ${dicePool.length} DICE vs SUSTAIN ${shieldValue}`
      :settled?`${dice.filter(d=>d.hit).length} BEAT SUSTAIN ${shieldValue}`
      :`${dicePool.length} DICE · BEAT ${shieldValue}`;
    if(title.sprite.userData.text!==headline)title.write(headline);
    for(const die of dice) {
      const through=!!die.hit;
      const tint=settled?(through?THROUGH:shieldColor):color;
      // Reduced motion gets a steady '?' rather than a face flickering at 14Hz.
      const display=settled?die.value:rolling&&!reduced?1+(Math.floor(elapsed*14)+die.i*3)%die.sides:'?';
      if(display!==die.shown){die.face.write(display,tint);die.shown=display;}
      // The comparison is spelled out so a tie never has to be inferred from hue.
      const tag=settled?`${die.value} ${die.value>shieldValue?'>':die.value===shieldValue?'=':'<'} ${shieldValue} · ${through?'HIT':'HELD'}`:null;
      if(tag!==die.tagged){die.tagged=tag;if(tag)die.verdict.write(tag,tint);}
      die.verdict.sprite.visible=!!tag&&opacity>0;
      die.g.userData={sides:die.sides,value:settled?die.value:null,hit:settled?through:null,settled};
      die.g.visible=opacity>0;die.g.position.copy(die.home);
      die.mesh.material.color.set(tint);die.edges.material.color.set(tint);die.ring.material.color.set(tint);
      if(rolling&&!reduced){die.mesh.rotation.set(elapsed*8+die.i,elapsed*5+die.i,elapsed*3);die.g.position.y+=Math.sin(elapsed*16+die.i)*.1;}
      else {die.mesh.rotation.set(.2,.3,0);if(armed&&!reduced)die.g.position.y+=Math.sin(elapsed*2.2+die.i*.7)*.06;}
      if(['sonic_ready','sonic_armed'].includes(phase)&&!reduced)die.g.scale.setScalar(Math.min(1,.25+elapsed*2));else die.g.scale.setScalar(1);
      const settle=settled?Math.min(1,elapsed*3.5):0;
      die.mesh.material.opacity=(.3+settle*.12)*opacity;
      die.edges.material.opacity=.95*opacity;
      die.ring.material.opacity=(settled?(through?.85:.5)+ (reduced?0:Math.sin(elapsed*5+die.i)*.08):armed&&!reduced?.3+Math.sin(elapsed*3+die.i*.6)*.16:.4)*opacity;
      die.ring.scale.setScalar(settled?1+settle*(through?.22:.06):1);
      die.face.sprite.material.opacity=opacity;die.verdict.sprite.material.opacity=opacity;
      die.index.sprite.material.opacity=opacity*.75;die.index.sprite.visible=opacity>0;
    }
  }
  function dispose(){
    if(disposed)return;disposed=true;group.removeFromParent();
    const resources=new Set(labels.map(l=>l.texture).filter(Boolean));
    group.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});
    for(const r of resources)r.dispose();group.clear();
  }
  update(0);return {group,update,dispose};
}
