import { shovePlan } from '../stage-hazards/motion.js';
import { ALL_HEXES, HEX_BY_NUM, HEX_BY_QR } from '../../src/board/hexMap.js';
import { hash, PAWNS } from './choreography.js';
const dirs=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
// Preview rule model. No wall-clock timers, engine changes, or hidden collisions.
export function pushRoute(from,occupied=[],avoid=[]){
 const h=HEX_BY_NUM[from],blocked=new Set(occupied),old=new Set(avoid);
 for(const [q,r] of dirs){const path=[1,2,3].map(i=>HEX_BY_QR[`${h.q+q*i},${h.r+r*i}`]?.num);
  if(path.every(n=>n!=null&&!blocked.has(n))&&!old.has(path[1]))return path;
 }return [];
}
export function armTurn({turn=1,positions=[...PAWNS],seed=17,previous=[],now=0}={}){
 const blocked=new Set([...positions,...previous]),path=pushRoute(positions[0],positions.slice(1),previous);
 const trap=path[1];
 const pool=ALL_HEXES.filter(h=>!blocked.has(h.num)&&h.num!==path[0]&&h.num!==path[2]&&h.num!==trap).sort((a,b)=>hash(a.num+seed*113+turn*31)-hash(b.num+seed*113+turn*31));
 const hexes=[...(trap!=null&&!blocked.has(trap)?[trap]:[]),...pool.map(h=>h.num)].slice(0,5);
 return {turn,positions:[...positions],hexes,fireAt:hexes.map(()=>Infinity),deployedAt:now,endAt:Infinity,showAt:Infinity,path,advanceAt:Infinity,hit:null};
}
export function fireRemaining(state,now,spacing){let i=0;return {...state,fireAt:state.fireAt.map(t=>Number.isFinite(t)?t:now+i++*spacing),showAt:Number.isFinite(state.showAt)?state.showAt:now};}
export function tracePush(path,armed,occupied=[]){
 const seen=[],block=new Set(occupied),hot=new Set(armed);
 for(const hex of path){if(!HEX_BY_NUM[hex]||block.has(hex))break;seen.push(hex);if(hot.has(hex))return {path:seen,hit:hex};}
 return {path:seen,hit:null};
}
export function pushRival(state,now){
 const route=tracePush(state.path,state.hexes.filter((_,i)=>!Number.isFinite(state.fireAt[i])),state.positions.slice(1));
 if(!route.path.length)return {...state,hit:null};
 const push=shovePlan(state.positions[0],route.path,now),arrival=push.arrival,fireAt=[...state.fireAt],positions=[...state.positions];positions[0]=route.path.at(-1);
 if(route.hit!=null)fireAt[state.hexes.indexOf(route.hit)]=arrival;
 return {...state,positions,fireAt,hit:route.hit,push:{...push,hit:route.hit},path:[]};
}
