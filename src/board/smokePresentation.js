import { SMOKE_START_RADIUS, SMOKE_MAX_RADIUS } from '../data/stageEffects.js';
import { hexInSmoke, smokeHexNums } from './stageFx.js';
import { HEX_BY_NUM } from './hexMap.js';
import { HEX_SIZE } from './constants.js';
import { LIMELIGHT_HEX } from '../data/gameConstants.js';

// User-approved Heavy billows dial-in (2026-09-30). Seconds describe transitions,
// never gameplay duration: the engine alone advances radius and ends the show.
export const SMOKE_LOOK=Object.freeze({density:1.7,height:3.3,spread:9.262141693474572,
  billow:.75,turbulence:.8,speed:.6,softness:.95,lighting:1.05,color:'#bacbd3',duration:8,fade:6});
export const SMOKE_TIMING=Object.freeze({lead:1.2,entry:3,growthSeconds:3,fade:6});
export function smokeViewerId(net,actingId){return net ? (net.spectator?null:net.mySpiritId??null) : actingId??null;}
export function isSmokeHidden(spirit,smoke,actingId,viewerId){
  return !!(spirit&&smoke&&hexInSmoke(spirit.num,smoke.radius)&&!(spirit.id===actingId&&spirit.id===viewerId));
}
export function smokeSelfId(spirits,smoke,actingId,viewerId){
  const own=spirits.find(s=>s.id===viewerId&&s.id===actingId&&!s.knockedOut&&!s.fallen);
  return own&&smoke&&hexInSmoke(own.num,smoke.radius)?own.id:null;
}

const hub=HEX_BY_NUM[LIMELIGHT_HEX];
const extents=Array.from({length:SMOKE_MAX_RADIUS+1},(_,radius)=>Math.max(0,...smokeHexNums(radius).map(n=>{
  const h=HEX_BY_NUM[n];return Math.hypot(h.px-hub.px,h.py-hub.py)/200;
}))+HEX_SIZE/200);
export const smokeExtent=radius=>extents[Math.max(0,Math.min(SMOKE_MAX_RADIUS,Math.floor(radius)))];
const smooth=t=>{const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);};

// Holds an outgoing volume after the rules clear it. No React timers or per-turn
// resets: changing viewer/acting Spirit leaves the cloud's clock untouched.
export function createSmokeTimeline(){
  let active=false,radius=0,start=0,change=0,from=0,to=0,expiry=null,atExpiry=null;
  function read(now,reduced=false){
    const enter=reduced?1:smooth((now-start-SMOKE_TIMING.lead)/SMOKE_TIMING.entry);
    const extent=from+(to-from)*(reduced?1:smooth((now-change)/(from===0?SMOKE_TIMING.lead+SMOKE_TIMING.entry:SMOKE_TIMING.growthSeconds)));
    const erosion=expiry==null?0:smooth((now-expiry)/SMOKE_TIMING.fade);
    const opacity=(expiry==null?enter:atExpiry.opacity)*(1-erosion);
    return {opacity,spread:(expiry==null?extent:atExpiry.extent)/SMOKE_LOOK.spread,
      extent:expiry==null?extent:atExpiry.extent,erosion,lift:erosion*.85,
      emission:active?enter:0,active,radius:active?radius:0,busy:active||opacity>0};
  }
  return {update(smoke,now,{reduced=false}={}){
    const next=smoke?Math.min(SMOKE_MAX_RADIUS,Math.max(SMOKE_START_RADIUS,smoke.radius)):0;
    if(next&&(!active||next<radius)){
      active=true;radius=next;start=change=now;from=0;to=smokeExtent(next);expiry=atExpiry=null;
    }else if(next&&next!==radius){
      from=read(now,reduced).extent;to=smokeExtent(next);change=now;radius=next;
    }else if(!next&&active){
      atExpiry=read(now,reduced);expiry=now;active=false;
    }
    if(!active&&expiry==null)return {opacity:0,spread:0,extent:0,erosion:0,lift:0,emission:0,active:false,radius:0,busy:false};
    return read(now,reduced);
  }};
}
