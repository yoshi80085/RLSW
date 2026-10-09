import * as THREE from 'three';
import {createCombatDie,CARD_DIE_GOLD} from './combatDice.js';
import {cardDef,bonusDieOf} from '../engine/systems/marqueeCards.js';

// 🃏 THE CARD DIE — Alex's dial-in on the Special Dice Bench, 2026-10-09
// (`.scratch/special-dice/`; 5 of 13 levers moved: finish rim, size 1.15, no
// card above the die, ring .31, dealt from the card). A marquee card's bonus
// die (marqueeCards.js applyCard) is drawn as ITSELF, never as one more die:
//   · a SET die (Loaded 4/5/6) is never thrown — the card is dealt onto the
//     table, flips, and the die rises out of it already showing its number;
//   · a THROWN bonus die (Bigger Cab, Full Stack) flies first, with a trail;
//   · both take the first seat of the row, `gap` apart from your own dice, and
//     the sum names what the card gave: "21 TOTAL STRENGTH (card +6)".
// ➕ Encore has no die of its own; the die it saved wears the gold rim + ring.
export const CARD_DIE_LOOK=Object.freeze({size:1.15,ring:.31,label:true,entrance:'deal',lead:1.2,trail:true,gap:.5,highlight:true,encore:true});
export const CARD_DIE_COLORS=Object.freeze({loaded:'#ffc23d',bump:'#4ff0c0',d10:'#ff5fd2',keep:CARD_DIE_GOLD});

/**
 * What the floor needs to know about the card played on this throw, from the
 * battle (`cardPlayed` + `atkFixed`): null when there is none. A die card with
 * no bonus entry (a replay recorded before the bonus die) is null too, so an
 * old battle draws exactly as it did.
 */
export function cardDieOf(battle){
 const def=cardDef(battle?.cardPlayed);if(!def)return null;
 const color=CARD_DIE_COLORS[def.kind]??CARD_DIE_GOLD;
 if(def.kind==='keep')return {card:def.id,kind:'keep',color,name:def.name,icon:def.icon};
 const bonus=bonusDieOf(battle?.atkFixed);if(!bonus)return null;
 return {card:def.id,kind:def.kind,color,name:def.name,icon:def.icon,placed:Number.isFinite(bonus.face),face:bonus.face??null};
}
const cardLabel=c=>c.kind==='loaded'?`LOADED ${c.face}`:c.kind==='bump'?'BIGGER CAB':c.kind==='d10'?'FULL STACK':c.name.toUpperCase();

export const ARENA_DICE_TIMING=Object.freeze({roll:3.2,landedHold:.65,gather:2.4,read:2});
// ⚠️ THESE TWO ARE THE SIMULTANEOUS CASE ONLY — the schedule for `poolStart`
// [0,0], kept because the legacy single-throw call sites read them directly.
// They are NOT the gather and read of a staged sequence: a pair whose second
// pool starts at t=4 gathers at 7.85, not 3.85. Ask `arenaDiceSchedule`.
export const ARENA_DICE_GATHER_AT=ARENA_DICE_TIMING.roll+ARENA_DICE_TIMING.landedHold;
export const ARENA_DICE_READ_AT=ARENA_DICE_GATHER_AT+ARENA_DICE_TIMING.gather;

// ⭐ THE TWO POOLS NO LONGER SHARE ONE CLOCK. Each throws when its own Spirit
// throws (`poolStart`, in this sequence's seconds, `[drive, sustain]`), because
// the table now watches one side's dice land before the other picks theirs up.
// 🎯 The gather therefore CANNOT be a module constant: it has to wait for the
// LAST pool to land, or a Spirit who threw second would watch their dice swept
// into the total while they were still in the air.
// 📌 Rounded to the millisecond. Without it the derived beats accumulate binary
// noise (9.750000000000002), and every downstream `t < beat` comparison at a
// beat's exact value then answers the opposite of what the table sees.
export const diceBeat=t=>Math.round(t*1000)/1000;
// 📌 `timing` is injectable so the dial-in preview can drive THIS function with
// Alex's numbers rather than a copy of it — the 14-accidentals lesson, where
// half a reported problem turned out to be in the preview's own re-draw.
export function arenaDiceSchedule(poolStart=[0,0],timing=ARENA_DICE_TIMING){
 const t={...ARENA_DICE_TIMING,...timing};
 const starts=[diceBeat(Number(poolStart?.[0])||0),diceBeat(Number(poolStart?.[1])||0)];
 const landedAt=starts.map(s=>diceBeat(s+t.roll+t.landedHold));
 const gatherAt=Math.max(...landedAt);
 return {poolStart:starts,landedAt,gatherAt,readAt:diceBeat(gatherAt+t.gather),
  rollingUntil:diceBeat(Math.max(...starts)+t.roll),timing:t};
}
const clamp=THREE.MathUtils.clamp,ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const Y=new THREE.Vector3(0,1,0);
const noise=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
// 📌 `pool*.11` survives the staging deliberately: with `poolStart` [0,0] every
// number below is byte-identical to the simultaneous throw this replaced, so a
// staged schedule is the only thing that can have changed the look.
export function arenaDieTiming(value,index,pool,poolStart=[0,0],timing=ARENA_DICE_TIMING){
 const schedule=arenaDiceSchedule(poolStart,timing),seed=index+pool*23+value*.07;
 return {seed,delay:schedule.poolStart[pool]+index*.075+pool*.11,flight:.72+noise(seed+7)*.16,
  dockedAt:schedule.gatherAt+index*.12+pool*.05+.85};
}

// `set` takes a string (one colour) or coloured runs [{ text, color, glow }].
function floorLabel(color,width,height){
 const canvas=globalThis.document?.createElement?.('canvas');let ctx;
 try{if(canvas){canvas.width=Math.round(width*160);canvas.height=Math.round(height*160);ctx=canvas.getContext('2d');}}catch{/* headless geometry checks */}
 const texture=ctx?new THREE.CanvasTexture(canvas):null;if(texture)texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,color:texture?'#ffffff':color,transparent:true,depthWrite:false,toneMapped:false}));
 mesh.rotation.x=-Math.PI/2;let previous;
 function set(content){
  const runs=typeof content==='string'?null:content,text=runs?runs.map(r=>r.text).join(''):content,key=runs?JSON.stringify(runs):text;
  if(key===previous)return;previous=key;mesh.userData.text=text;if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.font=`bold ${Math.round(canvas.height*.63)}px Arial`;ctx.textBaseline='middle';
  if(!runs){ctx.textAlign='center';ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=5;ctx.fillText(text,canvas.width/2,canvas.height/2,canvas.width-12);texture.needsUpdate=true;return;}
  const widths=runs.map(r=>ctx.measureText(r.text).width),total=widths.reduce((a,b)=>a+b,0)||1,squeeze=Math.min(1,(canvas.width-12)/total);
  ctx.save();ctx.textAlign='left';ctx.translate(canvas.width/2-total*squeeze/2,canvas.height/2);ctx.scale(squeeze,1);let x=0;
  runs.forEach((r,i)=>{const c=r.color??color;ctx.fillStyle=c;ctx.shadowColor=c;ctx.shadowBlur=r.glow?14:5;ctx.fillText(r.text,x,0);x+=widths[i];});
  ctx.restore();texture.needsUpdate=true;}
 return {mesh,set,dispose(){texture?.dispose();mesh.geometry.dispose();mesh.material.dispose();}};
}

// Authored gravity arcs and damped bounces preserve the already-resolved roll.
// One scene group: these dice use the arena camera, floor and depth buffer.
// 🎨 EACH PLAYER THROWS DICE IN THEIR OWN COLOUR (Alex, 2026-09-24: "Rival -
// rolls dice (that player's color of dice)"). The Drive-red / Sustain-blue pair
// is only the fallback now, for a caller that does not say whose dice these are.
// 🎲 KEEP-THE-BEST (dicePool.js, Alex 2026-09-27: "Dice dimming — go with the
// recommended approach"). `drive`/`sustain` are the KEPT faces; `dropped*` are the
// dice that were thrown and did not count. Every die flies and lands; at the
// gather the kept dice dock and are added up, the dropped ones stay where they
// fell and DIM — you see exactly how many dice your spelling bought you.
// `drivePool`/`sustainPool` give each die its own size (d8s, the Eleven die).
/** The prize card, drawn for the deal (the same card picked at the roll). */
function cardTexture(card){
 const canvas=globalThis.document?.createElement?.('canvas');let ctx;
 try{if(canvas){canvas.width=256;canvas.height=340;ctx=canvas.getContext('2d');}}catch{/* headless geometry checks */}
 if(!ctx)return null;
 const r=26,w=240,h=324;ctx.beginPath();ctx.moveTo(8+r,8);ctx.arcTo(8+w,8,8+w,8+h,r);ctx.arcTo(8+w,8+h,8,8+h,r);ctx.arcTo(8,8+h,8,8,r);ctx.arcTo(8,8,8+w,8,r);ctx.closePath();
 ctx.fillStyle='#0d1022';ctx.fill();ctx.lineWidth=9;ctx.strokeStyle=card.color;ctx.shadowColor=card.color;ctx.shadowBlur=18;ctx.stroke();ctx.shadowBlur=0;
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='120px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';ctx.fillText(card.icon??'🃏',128,135);
 ctx.fillStyle=card.color;ctx.font='bold 38px Arial';ctx.fillText(cardLabel(card),128,250,216);
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}

/** "5d6+2d8", "d6+the Eleven die" — the header's pool text. */
function dicePoolText(sizes=[]){
 const counts=new Map();for(const s of sizes)counts.set(s,(counts.get(s)??0)+1);
 return [...counts].sort((a,b)=>a[0]-b[0]).map(([s,n])=>s===11?'the Eleven die':`${n}d${s}`).join('+')||'0 dice';
}
// 🃏 `driveCard` is `cardDieOf(battle)`: the attacker's card. With a bonus die it
// is the LAST kept Drive value (`throwPool` keeps throw order and the bonus die
// is appended), drawn as the card die; `look` is CARD_DIE_LOOK, injectable for
// the bench. `now` (ms) is the wall clock the deal runs on — see `update`.
// `radii` (the bench's d8/d12 levers) overrides `COMBAT_DIE_RADIUS`; the game passes none.
export function createArenaDiceSequence({drive=[],sustain=[],driveSides=6,sustainSides=6,defenderTitle='SUSTAIN',poolStart=[0,0],timing=ARENA_DICE_TIMING,
  driveColor='#ff6644',sustainColor='#44aaff',drivePool=null,sustainPool=null,
  droppedDrive=[],droppedDrivePool=[],droppedSustain=[],droppedSustainPool=[],driveCard=null,look=CARD_DIE_LOOK,now=null,radii=undefined}={}){
 const schedule=arenaDiceSchedule(poolStart,timing);
 const group=new THREE.Group();group.name='Arena floor dice';const entries=[],labels=[],totals=[],extras=[];
 const bonusCard=driveCard&&driveCard.kind!=='keep'&&drive.length?driveCard:null;
 // ⭐ THE DEAL RUNS ON THE WALL CLOCK, not the sequence's. A card is played at
 // the roll, while the throw is HELD at its gate, so sequence time is not
 // moving; counting from the moment these dice were built lets the card land
 // and the die rise BEFORE the player's own dice leave the hand.
 const bornAt=now??globalThis.performance?.now?.()??0;
 let cardEntry=null;
 function cardFx(card,isDie,sides){
  const fx={color:card.color};
  if(look.ring>0){const ring=new THREE.Mesh(new THREE.RingGeometry(.62,.92,48),new THREE.MeshBasicMaterial({color:card.color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
   ring.rotation.x=-Math.PI/2;ring.name='Card die ring';group.add(ring);fx.ring=ring;extras.push(()=>{ring.geometry.dispose();ring.material.dispose();});}
  if(isDie&&look.label){const label=floorLabel(card.color,1.9,.34);label.set([{text:card.kind==='loaded'?`LOADED ${card.face}`:`+d${sides}`,color:card.color,glow:true}]);
   group.add(label.mesh);fx.label=label;extras.push(()=>label.dispose());}
  if(isDie&&card.placed&&look.entrance==='deal'){const tex=cardTexture(card);
   const deal=new THREE.Mesh(new THREE.PlaneGeometry(.95,1.26),new THREE.MeshBasicMaterial({map:tex,color:tex?'#ffffff':card.color,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
   deal.name='Dealt card';deal.visible=false;group.add(deal);fx.deal=deal;extras.push(()=>{tex?.dispose();deal.geometry.dispose();deal.material.dispose();});}
  if(isDie&&!card.placed&&look.trail){const N=18,geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(N*3),3));geo.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(N*3),3));
   const pts=new THREE.Points(geo,new THREE.PointsMaterial({size:.34,vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
   pts.name='Card die trail';pts.frustumCulled=false;group.add(pts);fx.trail={pts,N};extras.push(()=>{geo.dispose();pts.material.dispose();});}
  return fx;
 }
 const shadowGeometry=new THREE.CircleGeometry(.6,24),shadowMaterial=new THREE.MeshBasicMaterial({color:'#000209',transparent:true,opacity:.48,depthWrite:false});
 for(const [pool,values,sides,color,title,sizes,droppedVals,droppedSizes] of [[0,drive,driveSides,driveColor,'DRIVE',drivePool,droppedDrive,droppedDrivePool],[1,sustain,sustainSides,sustainColor,defenderTitle,sustainPool,droppedSustain,droppedSustainPool]]){
  const header=floorLabel(color,6.6,.5),sum=floorLabel(color,6.6,.5);
  const withCard=pool===0&&!!bonusCard;
  const thrown=[...values.map((value,i)=>({value,sides:sizes?.[i]??sides,dropped:false,card:withCard&&i===values.length-1})),
    ...(droppedVals??[]).map((value,i)=>({value,sides:droppedSizes?.[i]??sides,dropped:true,card:false}))];
  // The header names YOUR dice; the card's die is named after them, in its colour.
  const own=thrown.filter(d=>!d.card),ownKept=own.filter(d=>!d.dropped).length;
  const headText=`${title} · ${dicePoolText(own.filter(d=>!d.dropped).map(d=>d.sides))}${own.length>ownKept?` · best ${ownKept} of ${own.length}`:''}`;
  header.set(withCard?[{text:headText},{text:`  + ${cardLabel(bonusCard)}`,color:bonusCard.color,glow:true}]:headText);
  // ➕ Encore: the die it saved is the lowest of the kept (the latest on a tie).
  let encoreAt=-1;
  if(pool===0&&driveCard?.kind==='keep'&&look.encore)values.forEach((v,i)=>{if(encoreAt<0||v<=values[encoreAt])encoreAt=i;});
  const shift=withCard?(1.2+look.gap)/2:0;
  header.mesh.position.set(1,.022,pool?6.95:3);sum.mesh.position.set(1,.022,pool?10.4:6.4);group.add(header.mesh,sum.mesh);labels.push(header,sum);totals.push(sum);
  thrown.forEach(({value,sides:dieSides,dropped,card},index)=>{
   const keptIndex=dropped?-1:index,marked=card||index===encoreAt;
   const seed=index+pool*23+value*.07,die=createCombatDie({sides:dieSides,value,color,seed,presentation:'floor',finish:marked?'card':null,radii});
   die.group.scale.setScalar(.85*(card?look.size:1));group.add(die.group);
   const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);shadow.rotation.x=-Math.PI/2;group.add(shadow);
   const col=index%3,row=Math.floor(index/3);
   const landed=new THREE.Vector3((pool?1.7:-4.2)+col*1.55+(noise(seed)-.5)*.3,0,3.4+row*1.65+(noise(seed+3)-.5)*.35);
   const origin=new THREE.Vector3(pool?7.2:-6.4,0,2.1+row*1.1);
   const ownCount=withCard?values.length-1:values.length;
   const dockAt=Math.max(0,keptIndex),count=Math.min(6,ownCount-Math.floor(dockAt/6)*6);
   // A dropped die slides OFF to its own side of the row (Drive left, the Rival right) and dims there.
   const dropAt=index-values.length;
   const dock=dropped?new THREE.Vector3(pool?5.9+(dropAt%2)*1.1:-3.9-(dropAt%2)*1.1,0,(pool?8.25:4.5)+Math.floor(dropAt/2)*1.1)
     :card?new THREE.Vector3(1+(0-(Math.min(6,ownCount)-1)/2)*1.2+shift-1.2-look.gap,0,4.5)
     :new THREE.Vector3(1+(dockAt%6-(count-1)/2)*1.2+shift,0,(pool?8.25:4.5)+Math.floor(dockAt/6)*1.22);
   const rest=die.group.quaternion.clone(),yaw=new THREE.Quaternion().setFromAxisAngle(Y,(noise(seed+5)-.5)*1.9),landing=rest.clone().premultiply(yaw);
   const fade=[];if(dropped)die.group.traverse(o=>{for(const m of [o.material].flat())if(m&&!fade.some(f=>f.m===m))fade.push({m,opacity:m.opacity??1,transparent:!!m.transparent});});
   const entry={die,shadow,pool,index,value,dropped,fade,origin,landed,dock,rest,landing,...arenaDieTiming(value,index,pool,schedule.poolStart,schedule.timing)};
   if(marked)entry.fx=cardFx(card?bonusCard:{...driveCard,color:CARD_DIE_GOLD},card,dieSides);
   if(card){
    // A set die sits where the card is dealt; a thrown one flies its own, higher arc, first.
    // 📌 The spot is the open floor BETWEEN the two landing areas (yours lands at
    // x −4.2…−1.1, the Rival's from 1.7), so the battle lens, which frames the
    // landed dice, frames it too. The bench's first spot (x −6.1) was off-frame.
    const slot=new THREE.Vector3(.25,0,4.35);   // clear of the DRIVE caption (z 3)
    entry.card=bonusCard;entry.placed=!!bonusCard.placed;
    if(entry.placed){entry.origin=slot;entry.landed=slot;}
    else{entry.origin=new THREE.Vector3(-6.4,0,1.4);entry.landed=new THREE.Vector3(.2,0,5.3);entry.delay=schedule.poolStart[0]-.05;entry.flight=.8;}
    cardEntry=entry;
   }
   if(index===encoreAt)entry.encore=true;
   entries.push(entry);
  });
 }
 let disposed=false;
 function update(time,{reduced=false,visible=true,now:wall=null}={}){
  if(disposed)return;group.visible=visible;const counts=[0,0],sums=[0,0],terms=[[],[]];
  const clock=(wall??globalThis.performance?.now?.()??bornAt)/1000;
  let cardTerm=null;
  for(const e of entries){
   const {die,origin,landed,dock}=e,local=time-e.delay,flight=e.flight;
   // 🃏 The card die docks FIRST (it takes the first seat of the row).
   const gatherLocal=e.card?time-schedule.gatherAt+.12:time-schedule.gatherAt-e.index*.12-e.pool*.05,gatherP=clamp(gatherLocal/.85,0,1);
   const rollingEnd=flight+.36+.2+.46;
   let lift=0,scale=1;die.group.visible=e.placed||local>=0;e.shadow.visible=die.group.visible;
   if(e.placed&&time<schedule.gatherAt){
    // ⭐ A SET DIE IS NEVER THROWN. The card is dealt onto its spot, turns, and
    // the die rises out of it face up — on the wall clock (see `bornAt`).
    const dur=Math.max(.2,look.lead*.75),p=reduced||look.entrance!=='deal'?1:clamp((clock*1000-bornAt)/1000/dur,0,1);
    const cp=clamp(p/.6,0,1),dp=clamp((p-.5)/.5,0,1);
    die.update(1,{reduced:true});die.group.quaternion.copy(e.rest);die.group.position.copy(landed);scale=reduced?1:ease(dp);
    die.group.visible=scale>.001;
    if(e.fx?.deal){const d=e.fx.deal;d.visible=visible&&dp<1&&!reduced;
     d.position.lerpVectors(new THREE.Vector3(-6.4,.03,1.4),landed,ease(cp));   // dealt from the thrower's sided.position.y=.03+Math.sin(cp*Math.PI)*.6;
     d.rotation.set(-Math.PI/2,0,(1-ease(cp))*1.4);d.material.opacity=1-dp;}
   }else if(time<schedule.gatherAt){
    const travel=clamp(local/(flight+.56),0,1),move=1-(1-travel)**2;
    die.group.position.lerpVectors(origin,landed,move);
    const hi=e.card?[2.6,5,.55]:[2.2,4.2,.5];   // the card die's own, higher arc
    if(local<flight){const p=clamp(local/flight,0,1);lift=hi[0]*(1-p)+hi[1]*p*(1-p);}
    else if(local<flight+.36){const p=(local-flight)/.36;lift=hi[2]*4*p*(1-p);}
    else if(local<flight+.56){const p=(local-flight-.36)/.2;lift=.13*4*p*(1-p);}
    const progress=clamp(local/rollingEnd,0,1);die.update(progress,{reduced});
    die.group.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(Y,(noise(e.seed+5)-.5)*1.9));
    if(reduced){die.group.position.copy(landed);lift=0;die.update(1,{reduced:true});die.group.quaternion.copy(e.landing);}
   }else{
    if(e.fx?.deal)e.fx.deal.visible=false;
    die.update(1,{reduced:true});die.group.position.lerpVectors(landed,dock,ease(gatherP));
    die.group.quaternion.copy(e.placed?e.rest:e.landing).slerp(e.rest,ease(gatherP));
    lift=reduced?0:Math.sin(gatherP*Math.PI)*(e.card?.45:.38);
    if(gatherP>=1&&!e.dropped){counts[e.pool]++;if(e.card)cardTerm=e.value;else{sums[e.pool]+=e.value;terms[e.pool].push(e.value);}}
   }
   if(e.card)die.group.scale.setScalar(.85*look.size*Math.max(.001,scale));
   // 🌫️ A dropped die dims as the kept ones gather (and un-dims if scrubbed back).
   const dim=e.dropped&&time>=schedule.gatherAt?ease(gatherP):0;
   if(e.dropped)for(const f of e.fade){f.m.transparent=f.transparent||dim>0;f.m.opacity=f.opacity*(1-.72*dim);}
   die.group.position.y=die.supportHeight()+.014+lift;
   e.shadow.position.set(die.group.position.x,.012,die.group.position.z);e.shadow.scale.setScalar((1+lift*.25)*Math.max(.01,scale));
   e.shadow.visible=die.group.visible&&lift<(e.card?2:1.6);
   if(e.fx){
    // The ring under the card die pulses; Encore's ring arrives as its die docks.
    const show=e.encore?(time>=schedule.gatherAt?ease(gatherP):0):(die.group.visible?scale:0),p=die.group.position;
    if(e.fx.ring){e.fx.ring.visible=show>.01;e.fx.ring.position.set(p.x,.02,p.z);e.fx.ring.material.opacity=show*look.ring*(.75+.25*Math.sin(clock*3.2));}
    if(e.fx.label){e.fx.label.mesh.visible=show>.01;e.fx.label.mesh.material.opacity=show;e.fx.label.mesh.position.set(p.x,.024,p.z+.82);}
    if(e.fx.trail){const {pts,N}=e.fx.trail,P=pts.geometry.attributes.position,C=pts.geometry.attributes.color,c=new THREE.Color(e.fx.color);
     const on=!reduced&&time<schedule.gatherAt&&local>0&&local<flight+.4;
     for(let i=N-1;i>0;i--)P.setXYZ(i,P.getX(i-1),P.getY(i-1),P.getZ(i-1));P.setXYZ(0,p.x,lift+.4,p.z);
     for(let i=0;i<N;i++){const k=on?(1-i/N)**1.6:0;C.setXYZ(i,c.r*k,c.g*k,c.b*k);}P.needsUpdate=true;C.needsUpdate=true;}
   }
  }
  const card=cardEntry?.card;
  for(let i=0;i<2;i++){
   const size=i?sustain.length:drive.length,header=labels[i*2];
   // ⭐ The HEADER arrives when THIS pool lands; the TOTAL waits for the pair.
   // That is the staged read: you can see whose dice are down and how many,
   // while the arithmetic still happens once, to both sides, at the gather.
   // 🃏 A set card die is on the table before the throw, so its pool's header is too.
   header.mesh.visible=time>=schedule.landedAt[i]||(i===0&&!!cardEntry?.placed);
   totals[i].mesh.visible=time>=schedule.gatherAt;
   const word=i&&defenderTitle==='SUSTAIN'?'SHIELD HP':'TOTAL STRENGTH';
   if(i===0&&card){
    const extra=cardTerm!=null,sum=sums[0]+(extra?cardTerm:0),hl=look.highlight;
    if(counts[0]===size)totals[0].set(hl?[{text:`${sum} ${word}`},{text:`  (card +${cardTerm})`,color:card.color,glow:true}]:`${sum} ${word}`);
    else if(extra||terms[0].length)totals[0].set([...(extra?[{text:`${cardTerm}`,color:hl?card.color:undefined,glow:hl},{text:terms[0].length?' + ':''}]:[]),
      ...terms[0].flatMap((v,k)=>[{text:`${v}`},{text:k<terms[0].length-1?' + ':''}]),{text:` = ${sum}`}]);
    else totals[0].set('ADDING…');
    continue;
   }
   totals[i].set(counts[i]===size?`${sums[i]} ${word}`:terms[i].length?`${terms[i].join(' + ')} = ${sums[i]}`:'ADDING…');
  }
  return {counts,sums:card&&cardTerm!=null?[sums[0]+cardTerm,sums[1]]:sums,schedule,
   phase:time<schedule.rollingUntil?'rolling':time<schedule.gatherAt?'landed':time<schedule.readAt?'gathering':'reading'};
 }
 function dispose(){if(disposed)return;disposed=true;group.removeFromParent();entries.forEach(e=>e.die.dispose());labels.forEach(l=>l.dispose());extras.forEach(f=>f());shadowGeometry.dispose();shadowMaterial.dispose();group.clear();}
 // `headers` / `totals` are exposed so a check (and the dial-in preview) can
 // assert WHEN each caption appears — the staged read is half the change.
 return {group,update,dispose,entries,schedule,headers:[labels[0],labels[2]],totals,cardEntry};
}
