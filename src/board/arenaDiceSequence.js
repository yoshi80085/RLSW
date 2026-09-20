import * as THREE from 'three';
import {createCombatDie} from './combatDice.js';

export const ARENA_DICE_TIMING=Object.freeze({roll:3.2,landedHold:.65,gather:2.4,read:2});
export const ARENA_DICE_GATHER_AT=ARENA_DICE_TIMING.roll+ARENA_DICE_TIMING.landedHold;
export const ARENA_DICE_READ_AT=ARENA_DICE_GATHER_AT+ARENA_DICE_TIMING.gather;
const clamp=THREE.MathUtils.clamp,ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const Y=new THREE.Vector3(0,1,0);
const noise=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export function arenaDieTiming(value,index,pool){
 const seed=index+pool*23+value*.07;
 return {seed,delay:index*.075+pool*.11,flight:.72+noise(seed+7)*.16,dockedAt:ARENA_DICE_GATHER_AT+index*.12+pool*.05+.85};
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
export function createArenaDiceSequence({drive=[],sustain=[],driveSides=6,sustainSides=6,defenderTitle='SUSTAIN'}={}){
 const group=new THREE.Group();group.name='Arena floor dice';const entries=[],labels=[],totals=[];
 const shadowGeometry=new THREE.CircleGeometry(.6,24),shadowMaterial=new THREE.MeshBasicMaterial({color:'#000209',transparent:true,opacity:.48,depthWrite:false});
 for(const [pool,values,sides,color,title] of [[0,drive,driveSides,'#ff6644','DRIVE'],[1,sustain,sustainSides,'#44aaff',defenderTitle]]){
  const header=floorLabel(color,6.6,.5),sum=floorLabel(color,6.6,.5);
  header.set(`${title} · ${values.length}d${sides}`);header.mesh.position.set(1,.022,pool?6.95:3);sum.mesh.position.set(1,.022,pool?10.4:6.4);group.add(header.mesh,sum.mesh);labels.push(header,sum);totals.push(sum);
  values.forEach((value,index)=>{
   const seed=index+pool*23+value*.07,die=createCombatDie({sides,value,color,seed,presentation:'floor'});die.group.scale.setScalar(.85);group.add(die.group);
   const shadow=new THREE.Mesh(shadowGeometry,shadowMaterial);shadow.rotation.x=-Math.PI/2;group.add(shadow);
   const col=index%3,row=Math.floor(index/3);
   const landed=new THREE.Vector3((pool?1.7:-4.2)+col*1.55+(noise(seed)-.5)*.3,0,3.4+row*1.65+(noise(seed+3)-.5)*.35);
   const origin=new THREE.Vector3(pool?7.2:-6.4,0,2.1+row*1.1);
   const count=Math.min(6,values.length-Math.floor(index/6)*6);
   const dock=new THREE.Vector3(1+(index%6-(count-1)/2)*1.2,0,(pool?8.25:4.5)+Math.floor(index/6)*1.22);
   const rest=die.group.quaternion.clone(),yaw=new THREE.Quaternion().setFromAxisAngle(Y,(noise(seed+5)-.5)*1.9),landing=rest.clone().premultiply(yaw);
   entries.push({die,shadow,pool,index,value,origin,landed,dock,rest,landing,...arenaDieTiming(value,index,pool)});
  });
 }
 let disposed=false;
 function update(time,{reduced=false,visible=true}={}){
  if(disposed)return;group.visible=visible;const counts=[0,0],sums=[0,0],terms=[[],[]];
  for(const e of entries){
   const {die,origin,landed,dock}=e,local=time-e.delay,flight=e.flight;
   const gatherLocal=time-ARENA_DICE_GATHER_AT-e.index*.12-e.pool*.05,gatherP=clamp(gatherLocal/.85,0,1);
   const rollingEnd=flight+.36+.2+.46;
   let lift=0;die.group.visible=local>=0;e.shadow.visible=die.group.visible;
   if(time<ARENA_DICE_GATHER_AT){
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
    if(gatherP>=1){counts[e.pool]++;sums[e.pool]+=e.value;terms[e.pool].push(e.value);}
   }
   die.group.position.y=die.supportHeight()+.014+lift;
   e.shadow.position.set(die.group.position.x,.012,die.group.position.z);e.shadow.scale.setScalar(1+lift*.25);
   e.shadow.visible=die.group.visible&&lift<1.6;
  }
  for(let i=0;i<2;i++){
   const size=i?sustain.length:drive.length,header=labels[i*2];
   header.mesh.visible=time>=ARENA_DICE_GATHER_AT;
   totals[i].mesh.visible=time>=ARENA_DICE_GATHER_AT;
   totals[i].set(counts[i]===size?`${sums[i]} ${i&&defenderTitle==='SUSTAIN'?'SHIELD HP':'TOTAL STRENGTH'}`:terms[i].length?`${terms[i].join(' + ')} = ${sums[i]}`:'ADDING…');
  }
  return {counts,sums,phase:time<ARENA_DICE_TIMING.roll?'rolling':time<ARENA_DICE_GATHER_AT?'landed':time<ARENA_DICE_READ_AT?'gathering':'reading'};
 }
 function dispose(){if(disposed)return;disposed=true;group.removeFromParent();entries.forEach(e=>e.die.dispose());labels.forEach(l=>l.dispose());shadowGeometry.dispose();shadowMaterial.dispose();group.clear();}
 return {group,update,dispose,entries};
}
