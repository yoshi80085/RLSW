import assert from 'node:assert/strict';
import {createIdleFlow,IDLE_FLOW} from './idleFlow.js';
const flow=createIdleFlow(),cam={position:{x:28,y:18,z:37},target:{x:1,y:-2.8,z:0}},shot={driving:true,mode:'auto',shot:'mid'};
const tick=(now,override={})=>flow.update({shot,camera:cam,now,dtMs:16,...override});
flow.activity(0);
assert.equal(tick(9999),shot,'no wandering before the full idle delay');
let p=tick(10000);assert.equal(p.shot,'idle-flow');assert.ok(Math.hypot(p.position.x-cam.position.x,p.position.y-cam.position.y,p.position.z-cam.position.z)<.01,'first frame blends without a jump');
const first={...cam.position};
for(let t=10016;t<34000;t+=16){p=tick(t);cam.position=p.position;cam.target=p.target;assert.ok(Object.values(p.position).every(Number.isFinite));}
assert.ok(Math.hypot(cam.position.x-first.x,cam.position.y-first.y,cam.position.z-first.z)>1,'idle camera continues travelling');
flow.activity(34000);assert.equal(tick(43999),shot,'a click restarts the entire delay');
assert.equal(tick(44000,{reduced:true}),shot,'reduced motion suppresses flow');
for(const kind of ['battle','move','event']){const action={...shot,shot:kind};assert.equal(tick(45000,{shot:action}),action,'action shots keep priority');}
assert.equal(tick(54999),shot,'activity delays idle travel');
const manual={driving:false,mode:'manual'};assert.equal(tick(56000,{shot:manual}),manual,'manual control keeps priority');
assert.equal(tick(57000,{shot:null}),null,'disabled auto camera stays disabled');
assert.deepEqual(IDLE_FLOW,{speed:1.2,sway:1.3,idleMs:10000});
console.log('PASS: idle delay, continuous flow, gentle entry, click reset, reduced motion, action/manual priority, approved settings');
