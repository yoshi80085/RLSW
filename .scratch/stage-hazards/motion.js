import { STANDEE_MOVE, planStep, stepPose, reducedPose } from '../../src/board/standeeMotion.js';
import { HEX_BY_NUM, HEX_BY_QR } from '../../src/board/hexMap.js';
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
export const xyz=num=>{const h=HEX_BY_NUM[num];return {x:(h.px-3255)/200,z:(h.py-2415)/200};};
export function shovePlan(from,path,start=0){
 const a=xyz(from),b=xyz(path[0]),yaw=Math.atan2(a.x-b.x,a.z-b.z);
 const step={style:STANDEE_MOVE.shoveStyle,kind:'shove',yaw0:yaw,yaw1:yaw,speed:1};
 const plan=planStep(step),arrival=start+((path.length-1)*plan.total+plan.land)/1000;
 return {from,path:[...path],start,arrival,step,plan};
}
export function shoveAt(seq,time,reduced=false){
 const ms=Math.max(0,(time-seq.start)*1000),i=Math.min(seq.path.length-1,Math.floor(ms/seq.plan.total));
 const pose=reduced?reducedPose(seq.step):stepPose(seq.step,seq.plan,ms-i*seq.plan.total,STANDEE_MOVE,{fwd:-1,side:0});
 // Reduced motion keeps the contact beat; it does not land before the blast.
 if(reduced)pose.p=time>=seq.start+(i*seq.plan.total+seq.plan.land)/1000?1:0;
 const a=xyz(i===0?seq.from:seq.path[i-1]),b=xyz(seq.path[i]);
 return {...pose,x:a.x+(b.x-a.x)*pose.p,z:a.z+(b.z-a.z)*pose.p};
}
export function reactionAt(kind,age,{strength=1,knockdown=false,reduced=false}={}){
 const out={y:0,pitch:0,roll:0,sy:1,sxz:1,recoil:0,flash:0,ring:0,ko:0,land:kind==='pyro'?.56:.2,done:false};
 if(age<0)return out;
 out.flash=Math.exp(-age*(kind==='pyro'?8:13));out.ring=clamp(age/.65);out.done=age>=1.8;
 if(out.done){out.ko=knockdown?1:0;out.flash=0;return out;}
 if(reduced){out.ko=knockdown&&age>=out.land?1:0;return out;}
 if(kind==='pyro'){
  const u=clamp(age/out.land);out.y=1.45*strength*4*u*(1-u);out.pitch=-.62*strength*Math.sin(Math.PI*u);out.roll=.2*strength*Math.sin(Math.PI*u);
  if(age>=out.land){const a=age-out.land,settle=Math.exp(-a*6);out.sy=1-.19*strength*settle*Math.cos(a*17);out.sxz=1+(1-out.sy)*.5;out.roll=.19*strength*settle*Math.sin(a*22);out.pitch=.12*strength*settle*Math.sin(a*18);}
 }else{
  const kick=smooth(age/.065)*Math.exp(-age*6);out.recoil=-.32*strength*kick;out.pitch=.5*strength*kick;out.roll=.11*strength*Math.sin(age*65)*Math.exp(-age*6);out.y=.07*strength*Math.sin(Math.PI*clamp(age/.2));
 }
 if(knockdown){out.ko=smooth((age-out.land)/.65);out.pitch*=1-out.ko;out.roll*=1-out.ko;out.sy=1;out.sxz=1;}
 return out;
}
export function laserPush(beams,occupied,start=.45){
 const hot=new Set(beams.flatMap(b=>b.hexes)),blocked=new Set(occupied);
 const candidates=[...hot].sort((a,b)=>Math.hypot(xyz(a).x,xyz(a).z)-Math.hypot(xyz(b).x,xyz(b).z));
 for(const hit of candidates)for(const [q,r] of [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]]){
  const h=HEX_BY_NUM[hit],mid=HEX_BY_QR[`${h.q-q},${h.r-r}`]?.num,from=HEX_BY_QR[`${h.q-2*q},${h.r-2*r}`]?.num;
  if(from==null||mid==null||[from,mid,hit].some(n=>blocked.has(n))||hot.has(from)||hot.has(mid))continue;
  return {...shovePlan(from,[mid,hit],start),hit};
 }return null;
}
