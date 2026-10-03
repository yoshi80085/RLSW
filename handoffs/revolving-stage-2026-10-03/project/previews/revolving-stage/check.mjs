// One-off evidence for this scratch study, not a production engine suite.
import assert from 'node:assert/strict';
import { ALL_HEXES } from '../../src/board/hexMap.js';
import { DEFAULTS,sector,destination,world,initialActors,settle,pose,duration } from './model.js';
let count=0;const ok=(c,m)=>{assert.ok(c,m);count++;};
for(let mask=0;mask<8;mask++)for(const direction of [-1,1])for(const steps of [1,2]){
 const rings=[1,2,3].filter(n=>mask&(1<<(n-1))),L={...DEFAULTS,rings,direction,steps},cells=sector(rings),targets=cells.map(h=>destination(h.num,L));
 ok(cells.length===rings.reduce((sum,n)=>sum+n*6,0),'exact selected-ring footprint');ok(new Set(targets).size===cells.length,'bijective rotation: no blocked or duplicated landing cells');
 ok(targets.every(n=>cells.some(h=>h.num===n)),'destinations remain within moving sector');
 for(const h of ALL_HEXES){const dest=destination(h.num,L),moving=cells.some(c=>c.num===h.num);if(!moving){ok(dest===h.num,'unselected rings, centre and outside stay fixed');continue;}
  const p=world(h.num),q=world(dest),angle=-direction*steps*Math.PI/3;
  ok(Math.hypot(p.x*Math.cos(angle)+p.z*Math.sin(angle)-q.x,p.z*Math.cos(angle)-p.x*Math.sin(angle)-q.z)<1e-8,'physical turn meets exact numbered destination');
  ok(destination(dest,{...L,direction:-direction})===h.num,'reverse is exact inverse');
 }
 let actors=initialActors();for(let i=0;i<6/steps;i++)actors=settle(actors,L);
 ok(actors.every((a,i)=>a.num===initialActors()[i].num),'full revolution restores actors');
 const end=pose(duration(L),L);ok(end.done&&end.phase==='locked'&&end.lift===0,'locks flat at end');
 for(const reduced of [false,true])for(let i=0;i<=100;i++){const p=pose(duration(L)*i/100,{...L,reduced});ok(Number.isFinite(p.displayAngle)&&Number.isFinite(p.displayLift),'finite scrub poses');if(reduced)ok(p.displayLift===0,'reduced motion never lifts');}
}
const frozen=initialActors();const before=JSON.stringify(frozen);settle(frozen,DEFAULTS);ok(JSON.stringify(frozen)===before,'settlement does not mutate prior timeline state');
const facing=settle(frozen,{...DEFAULTS,carryFacing:false});ok(facing.every((a,i)=>a.yaw===frozen[i].yaw),'optional facing preserved');
console.log(`Revolving-stage study: ${count} checks passed.`);
