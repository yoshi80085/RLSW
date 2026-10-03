import { ALL_HEXES, HEX_BY_NUM, HEX_BY_QR } from '../../src/board/hexMap.js';

export const DEFAULTS = Object.freeze({rings:Object.freeze([1,2]),direction:1,steps:1,warning:3,turnTime:3,lift:.85,glow:1,bloom:.38,speed:1,ghosts:true,numbers:false,carryFacing:true,reduced:false,camera:'hero',mechanism:'fitted'});
// .70 leaves the cassette's lowest edge (-.435) above the fixed tile top (.20)
// throughout the turn, even at the slider minimum.
export const SLIDERS=[['warning','Warning time',1,6,.5,'s'],['turnTime','Rotation time',1.5,6,.25,'s'],['lift','Deck lift',.7,1.5,.05,'m'],['glow','Signal glow',.2,2,.1,'×'],['bloom','Bloom',0,.8,.01,'']];
const hub=HEX_BY_NUM[56];
export const clamp=n=>Math.max(0,Math.min(1,n));
export const ease=n=>{const u=clamp(n);return u*u*u*(u*(u*6-15)+10);};
export const local=h=>({q:h.q-hub.q,r:h.r-hub.r});
export const distance=num=>{const {q,r}=local(HEX_BY_NUM[num]);return Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r));};
export const ringNumbers=selection=>Array.isArray(selection)?selection:Array.from({length:selection},(_,i)=>i+1);
export const affected=(num,selection)=>ringNumbers(selection).includes(distance(num));
// The game's numbered axial map on a regular lattice. This removes the source
// board image's slight horizontal stretch, so each physical 60° turn seats exactly.
export function world(num,y=.2){const {q,r}=local(HEX_BY_NUM[num]);return {x:q*1.95*Math.sqrt(3)/2,y,z:(r+q/2)*1.95};}
export function at(q,r){return HEX_BY_QR[`${hub.q+q},${hub.r+r}`]?.num;}
export function destination(num,L){
 if(!affected(num,L.rings))return num;
 let {q,r}=local(HEX_BY_NUM[num]);
 const turns=((L.direction*L.steps)%6+6)%6;
 for(let i=0;i<turns;i++)[q,r]=[-r,q+r];
 const result=at(q,r);
 if(result==null)throw Error(`Rotation leaves board: ${num}`);
 return result;
}
export const sector=selection=>ALL_HEXES.filter(h=>affected(h.num,selection));
export const duration=L=>L.warning+.8+L.turnTime+.8+1;
export function pose(t,L){
 const liftStart=L.warning,turnStart=liftStart+.8,seatStart=turnStart+L.turnTime,locked=seatStart+.8;
 const progress=ease((t-turnStart)/L.turnTime);
 const rise=ease((t-liftStart)/.8)*(1-ease((t-seatStart)/.8));
 const phase=t<liftStart?'warning':t<turnStart?'lift':t<seatStart?'turn':t<locked?'seat':'locked';
 return {phase,angle:-L.direction*L.steps*Math.PI/3*progress,lift:L.lift*rise,progress,
  countdown:Math.max(0,Math.ceil(liftStart-t)),done:t>=duration(L),
  // Reduced motion is a dissolve-free, single relocation at the lock beat.
  displayAngle:L.reduced?(t>=locked?-L.direction*L.steps*Math.PI/3:0):-L.direction*L.steps*Math.PI/3*progress,
  displayLift:L.reduced?0:L.lift*rise};
}
export function initialActors(){return [
 {id:'ronin',name:'Ronin',art:'cosmic_ronin',color:'#72d6ff',num:at(-1,1),yaw:.3},
 {id:'monster',name:'Monster',art:'Metalness_Monster',color:'#ff977e',num:at(0,1),yaw:-.3},
 {id:'glam',name:'Glamarchy',art:'Glamarchy',color:'#ffe28d',num:56,yaw:0},
 {id:'zero',name:'Intergalactic 0',art:'intergalactic_0',color:'#c3a3ff',num:at(3,-1),yaw:0},
 {id:'amp',name:'Drive amp',color:'#72d6ff',num:at(1,1),yaw:0,amp:true},
 ];}
export function plan(actors,L){return actors.map(a=>({...a,to:destination(a.num,L),riding:affected(a.num,L.rings)}));}
export function settle(actors,L){return plan(actors,L).map(({to,riding,...a})=>({...a,num:to,yaw:a.yaw+(riding&&L.carryFacing?-L.direction*L.steps*Math.PI/3:0)}));}
