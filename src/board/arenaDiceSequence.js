import * as THREE from 'three';
import {createCombatDie} from './combatDice.js';

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

function floorLabel(color,width,height){
 const canvas=globalThis.document?.createElement?.('canvas');let ctx;
 try{if(canvas){canvas.width=Math.round(width*160);canvas.height=Math.round(height*160);ctx=canvas.getContext('2d');}}catch{/* headless geometry checks */}
 const texture=ctx?new THREE.CanvasTexture(canvas):null;if(texture)texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,color:texture?'#ffffff':color,transparent:true,depthWrite:false,toneMapped:false}));
 mesh.rotation.x=-Math.PI/2;let previous;
 function set(text){if(text===previous)return;previous=text;mesh.userData.text=text;if(!ctx)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.font=`bold ${Math.round(canvas.height*.63)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=5;ctx.fillText(text,canvas.width/2,canvas.height/2,canvas.width-12);texture.needsUpdate=true;}
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
/** "5d6+2d8", "d6+the Eleven die" — the header's pool text. */
function dicePoolText(sizes=[]){
 const counts=new Map();for(const s of sizes)counts.set(s,(counts.get(s)??0)+1);
 return [...counts].sort((a,b)=>a[0]-b[0]).map(([s,n])=>s===11?'the Eleven die':`${n}d${s}`).join('+')||'0 dice';
}
export function createArenaDiceSequence({drive=[],sustain=[],driveSides=6,sustainSides=6,defenderTitle='SUSTAIN',poolStart=[0,0],timing=ARENA_DICE_TIMING,
  driveColor='#ff6644',sustainColor='#44aaff',drivePool=null,sustainPool=null,
  droppedDrive=[],droppedDrivePool=[],droppedSustain=[],droppedSustainPool=[]}={}){
 const schedule=arenaDiceSchedule(poolStart,timing);
 const group=new THREE.Group();group.name='Arena floor dice';const entries=[],labels=[],totals=[];
 const shadowGeometry=new THREE.CircleGeometry(.6,24),shadowMaterial=new THREE.MeshBasicMaterial({color:'#000209',transparent:true,opacity:.48,depthWrite:false});
 for(const [pool,values,sides,color,title,sizes,droppedVals,droppedSizes] of [[0,drive,driveSides,driveColor,'DRIVE',drivePool,droppedDrive,droppedDrivePool],[1,sustain,sustainSides,sustainColor,defenderTitle,sustainPool,droppedSustain,droppedSustainPool]]){
  const header=floorLabel(color,6.6,.5),sum=floorLabel(color,6.6,.5);
  const thrown=[...values.map((value,i)=>({value,sides:sizes?.[i]??sides,dropped:false})),
    ...(droppedVals??[]).map((value,i)=>({value,sides:droppedSizes?.[i]??sides,dropped:true}))];
  header.set(`${title} · ${dicePoolText(thrown.filter(d=>!d.dropped).map(d=>d.sides))}${thrown.length>values.length?` · best ${values.length} of ${thrown.length}`:''}`);
  header.mesh.position.set(1,.022,pool?6.95:3);sum.mesh.position.set(1,.022,pool?10.4:6.4);group.add(header.mesh,sum.mesh);labels.push(header,sum);totals.push(sum);
  thrown.forEach(({value,sides:dieSides,dropped},index)=>{
   const keptIndex=dropped?-1:index;
   const seed=index+pool*23+value*.07,die=createCombatDie({sides:dieSides,value,color,seed,presentation:'floor'});die.group.scale.setScalar(.85);group.add(die.group);
   const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);shadow.rotation.x=-Math.PI/2;group.add(shadow);
   const col=index%3,row=Math.floor(index/3);
   const landed=new THREE.Vector3((pool?1.7:-4.2)+col*1.55+(noise(seed)-.5)*.3,0,3.4+row*1.65+(noise(seed+3)-.5)*.35);
   const origin=new THREE.Vector3(pool?7.2:-6.4,0,2.1+row*1.1);
   const dockAt=Math.max(0,keptIndex),count=Math.min(6,values.length-Math.floor(dockAt/6)*6);
   // A dropped die slides OFF to its own side of the row (Drive left, the Rival right) and dims there.
   const dropAt=index-values.length;
   const dock=dropped?new THREE.Vector3(pool?5.9+(dropAt%2)*1.1:-3.9-(dropAt%2)*1.1,0,(pool?8.25:4.5)+Math.floor(dropAt/2)*1.1)
     :new THREE.Vector3(1+(dockAt%6-(count-1)/2)*1.2,0,(pool?8.25:4.5)+Math.floor(dockAt/6)*1.22);
   const rest=die.group.quaternion.clone(),yaw=new THREE.Quaternion().setFromAxisAngle(Y,(noise(seed+5)-.5)*1.9),landing=rest.clone().premultiply(yaw);
   const fade=[];if(dropped)die.group.traverse(o=>{for(const m of [o.material].flat())if(m&&!fade.some(f=>f.m===m))fade.push({m,opacity:m.opacity??1,transparent:!!m.transparent});});
   entries.push({die,shadow,pool,index,value,dropped,fade,origin,landed,dock,rest,landing,...arenaDieTiming(value,index,pool,schedule.poolStart,schedule.timing)});
  });
 }
 let disposed=false;
 function update(time,{reduced=false,visible=true}={}){
  if(disposed)return;group.visible=visible;const counts=[0,0],sums=[0,0],terms=[[],[]];
  for(const e of entries){
   const {die,origin,landed,dock}=e,local=time-e.delay,flight=e.flight;
   const gatherLocal=time-schedule.gatherAt-e.index*.12-e.pool*.05,gatherP=clamp(gatherLocal/.85,0,1);
   const rollingEnd=flight+.36+.2+.46;
   let lift=0;die.group.visible=local>=0;e.shadow.visible=die.group.visible;
   if(time<schedule.gatherAt){
    const travel=clamp(local/(flight+.56),0,1),move=1-(1-travel)**2;
    die.group.position.lerpVectors(origin,landed,move);
    if(local<flight){const p=clamp(local/flight,0,1);lift=2.2*(1-p)+4.2*p*(1-p);}
    else if(local<flight+.36){const p=(local-flight)/.36;lift=.5*4*p*(1-p);}
    else if(local<flight+.56){const p=(local-flight-.36)/.2;lift=.13*4*p*(1-p);}
    const progress=clamp(local/rollingEnd,0,1);die.update(progress,{reduced});
    die.group.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(Y,(noise(e.seed+5)-.5)*1.9));
    if(reduced){die.group.position.copy(landed);lift=0;die.update(1,{reduced:true});die.group.quaternion.copy(e.landing);}
   }else{
    die.update(1,{reduced:true});die.group.position.lerpVectors(landed,dock,ease(gatherP));
    die.group.quaternion.copy(e.landing).slerp(e.rest,ease(gatherP));
    lift=reduced?0:Math.sin(gatherP*Math.PI)*.38;
    if(gatherP>=1&&!e.dropped){counts[e.pool]++;sums[e.pool]+=e.value;terms[e.pool].push(e.value);}
   }
   // 🌫️ A dropped die dims as the kept ones gather (and un-dims if scrubbed back).
   if(e.dropped){const dim=time<schedule.gatherAt?0:ease(gatherP);
    for(const f of e.fade){f.m.transparent=f.transparent||dim>0;f.m.opacity=f.opacity*(1-.72*dim);}}
   die.group.position.y=die.supportHeight()+.014+lift;
   e.shadow.position.set(die.group.position.x,.012,die.group.position.z);e.shadow.scale.setScalar(1+lift*.25);
   e.shadow.visible=die.group.visible&&lift<1.6;
  }
  for(let i=0;i<2;i++){
   const size=i?sustain.length:drive.length,header=labels[i*2];
   // ⭐ The HEADER arrives when THIS pool lands; the TOTAL waits for the pair.
   // That is the staged read: you can see whose dice are down and how many,
   // while the arithmetic still happens once, to both sides, at the gather.
   header.mesh.visible=time>=schedule.landedAt[i];
   totals[i].mesh.visible=time>=schedule.gatherAt;
   totals[i].set(counts[i]===size?`${sums[i]} ${i&&defenderTitle==='SUSTAIN'?'SHIELD HP':'TOTAL STRENGTH'}`:terms[i].length?`${terms[i].join(' + ')} = ${sums[i]}`:'ADDING…');
  }
  return {counts,sums,schedule,
   phase:time<schedule.rollingUntil?'rolling':time<schedule.gatherAt?'landed':time<schedule.readAt?'gathering':'reading'};
 }
 function dispose(){if(disposed)return;disposed=true;group.removeFromParent();entries.forEach(e=>e.die.dispose());labels.forEach(l=>l.dispose());shadowGeometry.dispose();shadowMaterial.dispose();group.clear();}
 // `headers` / `totals` are exposed so a check (and the dial-in preview) can
 // assert WHEN each caption appears — the staged read is half the change.
 return {group,update,dispose,entries,schedule,headers:[labels[0],labels[2]],totals};
}
