// ─── battleDirectorCheck — Alex's battle camera, wired into the live arena ───
// 2026-09-24. Pure shots (battleDirector.js), the dice on the board, the Swing
// standees in the real arena, the aftermath after the overlay closes, the
// crowd reaction, and sonicCamera flying a directed shot and handing back.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readFileSync} from 'node:fs';
import {directorShot,placeBattleDice,frontSide,seatDirection,BATTLE_DIRECTOR} from './battleDirector.js';
import {swingTimingFor,SWING_TIMING} from './swingTiming.js';
import {SONIC_GATE,SONIC_DICE,BARRAGE_LAUNCH} from './sonicBarrageTiming.js';
import {SONIC_SHIELD_HOLD} from './battleRollGate.js';
import {createArenaVisuals} from './arenaVisuals.js';
import {arenaFrame} from './arenaFrame.js';
import {createSonicCamera} from './sonicCamera.js';
import {createArenaDiceSequence} from './arenaDiceSequence.js';
import {speedLineWedges,SPEED_LINES} from './speedLines.js';
let passed=0;const ok=(name,cond)=>{assert.ok(cond,name);passed++;};

console.log('§1 the shot list');
{
  const lane=new THREE.Vector3(1,0,0),mid=new THREE.Vector3(0,.2,0);
  const amps=[new THREE.Vector3(-8,1,-7),new THREE.Vector3(8,1,-7)],stands=[new THREE.Vector3(-11,.3,-7),new THREE.Vector3(11,.3,-7)];
  const spirits=[new THREE.Vector3(-.975,.2,0),new THREE.Vector3(.975,.2,0)];
  const T=SWING_TIMING,ctx=t=>({t,kind:'swing',you:'attacker',lane,mid,spirits,amps,stands,dice:mid,beats:{T},winner:0});
  const kinds=[.5,T.attackerRaise+.1,T.rival+.1,T.rivalRaise+.1,T.read+.1,T.clash+.1].map(t=>directorShot(ctx(t)).kind);
  ok('swing: chair → charge → chair → charge → TWO-SHOT → clash',JSON.stringify(kinds)===JSON.stringify(['seat','charge','seat','charge','two','side']));
  // 🎯 Alex 2026-09-24: the opening pushes in on the PAIR, with speed lines —
  // and no chair shot may crop a Spirit out (the "zooms way in to nothing" bug).
  const intro0=directorShot({...ctx(0),intro:0}),intro1=directorShot({...ctx(0),intro:BATTLE_DIRECTOR.pushTime+.2});
  ok('the bout opens on a two-shot that PUSHES IN',intro0.kind==='two'&&intro0.pos.distanceTo(intro0.target)>intro1.pos.distanceTo(intro1.target)*1.4);
  ok('…with the speed lines up',intro1.lines>.5&&intro0.lines===0);
  const inFrame=(shot,points)=>{const cam=new THREE.PerspectiveCamera(shot.fov,BATTLE_DIRECTOR.aspect,.1,200);cam.position.copy(shot.pos);cam.lookAt(shot.target);cam.updateMatrixWorld();
    return points.every(p=>{const v=p.clone().project(cam);return Math.abs(v.x)<=1&&Math.abs(v.y)<=1&&v.z<1;});};
  const bodies=spirits.flatMap(s=>[s.clone(),s.clone().setY(s.y+BATTLE_DIRECTOR.standeeHeight)]);
  ok('the two-shot keeps both Spirits head to toe in frame',inFrame(intro1,bodies));
  const farDice=new THREE.Vector3(0,.2,4);
  const chair=directorShot({...ctx(.5),dice:farDice});
  ok('every chair shot keeps both Spirits AND the dice in frame',chair.kind==='seat'&&inFrame(chair,[...bodies,farDice]));
  const front=frontSide(lane,mid,amps);
  ok('the front side is away from the amps',front.z>0);
  ok('the attacker\'s chair is on their own end, the Rival\'s on theirs',seatDirection(lane,'attacker',55,front).x<0&&seatDirection(lane,'rival',55,front).x>0);
  const before=directorShot(ctx(T.attackerAmp-.01)),after=directorShot(ctx(T.attackerAmp+BATTLE_DIRECTOR.pullTime+.05));
  ok('the focus PULLS from the standee back to the amp as it fires',before.focus<after.focus-2&&before.key===after.key);
  const S={gate:SONIC_GATE,dice:SONIC_DICE,launch:BARRAGE_LAUNCH};
  const sonic=t=>directorShot({t,kind:'sonic',you:'attacker',lane,mid,spirits,amps,stands,dice:mid,beats:{S},winner:0});
  const shieldFrom=SONIC_DICE.landedAt[1]+.2;
  ok('Alex: the Rival\'s shield shot holds at least two seconds',sonic(shieldFrom+.05).key==='charge-1'&&sonic(SONIC_GATE-.05).key==='charge-1'&&SONIC_GATE-shieldFrom>=2);
  ok('…and the hold is the derived gate, not a copy of it',Math.abs(SONIC_GATE-(SONIC_DICE.landedAt[1]+SONIC_SHIELD_HOLD))<1e-9);
  ok('sonic: the attacker\'s chord gets its charge shot as the amps fire',sonic(BARRAGE_LAUNCH+.2).key==='charge-0');
  const after0=t=>directorShot({t,kind:'aftermath',you:'attacker',lane,mid,spirits,amps,stands,beats:{},winner:1});
  ok('aftermath: the shove from the chair, then the WINNER\'s fans',after0(.2).kind==='seat'&&after0(2).key==='final-1');
  ok('a tie shows both crowds',directorShot({t:3,kind:'aftermath',you:'attacker',lane,mid,spirits,amps,stands,beats:{},winner:null}).kind==='crowds');
  const fans=after0(BATTLE_DIRECTOR.shoveTime+BATTLE_DIRECTOR.fanDelay+BATTLE_DIRECTOR.pullDelay+BATTLE_DIRECTOR.pullTime+.1);
  ok('the last shot ends focused on the fans',Math.abs(fans.focus-fans.pos.distanceTo(stands[1].clone().add(new THREE.Vector3(0,1,0))))<1e-6);
}

console.log('§1c no lens on the edge of a sheet, none down on the floor (Alex: "pointing at nothing, zoomed in extra far")');
{
  // ⚠️ ADJACENT — the common Sonic, and the case that failed: two standees
  // facing each other one hex apart, filmed square to the lane from 4.8 units.
  const lane=new THREE.Vector3(1,0,0),mid=new THREE.Vector3(0,.2,0);
  const spirits=[new THREE.Vector3(-.93,.2,0),new THREE.Vector3(.93,.2,0)];
  const facings=[new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0)];
  const amps=[new THREE.Vector3(-8,1,-7),new THREE.Vector3(8,1,-7)],stands=[new THREE.Vector3(-11,.3,-7),new THREE.Vector3(11,.3,-7)];
  const S={gate:SONIC_GATE,dice:SONIC_DICE,launch:BARRAGE_LAUNCH};
  const shot=(t,extra={})=>directorShot({t,kind:'sonic',you:'attacker',lane,mid,spirits,facings,amps,stands,dice:mid,beats:{S},winner:0,...extra});
  const squareness=(s,i)=>Math.abs(s.pos.clone().sub(spirits[i]).setY(0).normalize().dot(facings[i]));
  const intro=shot(0,{intro:BATTLE_DIRECTOR.pushTime+.3});
  ok('the settled two-shot is never closer than twoMin',intro.pos.distanceTo(intro.target)>=BATTLE_DIRECTOR.twoMin-1e-6);
  ok('…and sees BOTH prints, not two slivers of acrylic',squareness(intro,0)>=BATTLE_DIRECTOR.twoGood-1e-6&&squareness(intro,1)>=BATTLE_DIRECTOR.twoGood-1e-6);
  const tight=directorShot({t:0,intro:BATTLE_DIRECTOR.pushTime+.3,kind:'sonic',you:'attacker',lane,mid,facings,amps,stands,dice:mid,beats:{S},winner:0,
    spirits:[new THREE.Vector3(-.3,.2,0),new THREE.Vector3(.3,.2,0)]});
  ok('…and the floor is what binds when the pair are close',Math.abs(tight.pos.distanceTo(tight.target)-BATTLE_DIRECTOR.twoMin)<1e-6);
  const focus=shot(S.dice.readAt+.5);
  ok('the pre-blast push-in the same',focus.kind==='two'&&squareness(focus,0)>=BATTLE_DIRECTOR.twoGood-1e-6&&squareness(focus,1)>=BATTLE_DIRECTOR.twoGood-1e-6);
  // An amp square to the way the Spirit faces: the old lens stood edge-on to it.
  const side=directorShot({t:S.launch,kind:'sonic',you:'attacker',lane,mid,spirits,facings,
    amps:[new THREE.Vector3(-.93,1,-9),amps[1]],stands,dice:mid,beats:{S},winner:0});
  ok('a charge shot keeps its standee\'s print at most 60° off square',side.kind==='charge'&&squareness(side,0)>=BATTLE_DIRECTOR.printMin-1e-6);
}

console.log('§1b the speed lines rush in from the border');
{
  const W=1280,H=720,R=Math.hypot(W/2,H/2);
  ok('none at all when the effect is off',speedLineWedges(W,H,0).length===0);
  const full=speedLineWedges(W,H,1,0),low=speedLineWedges(W,H,.25,0);
  const outside=([x,y])=>x<=0||x>=W||y<=0||y>=H;
  ok('every line is fat at the border (its base is off-screen)',full.length>SPEED_LINES.count*.8&&full.every(w=>outside(w.left)&&outside(w.right)));
  const reach=ws=>Math.min(...ws.map(w=>Math.hypot(w.inner[0]-W/2,w.inner[1]-H/2)));
  ok('…and points in at the middle, reaching further as the effect rises',reach(full)<reach(low)&&reach(full)>R*.2);
  ok('the middle stays clear — the Spirits are there',full.every(w=>Math.hypot(w.inner[0]-W/2,w.inner[1]-H/2)>R*(SPEED_LINES.reach-SPEED_LINES.jitter)-1));
  ok('the ragged ends re-deal (flicker) but deterministically',JSON.stringify(speedLineWedges(W,H,1,3))===JSON.stringify(speedLineWedges(W,H,1,3))&&JSON.stringify(speedLineWedges(W,H,1,3))!==JSON.stringify(full));
}

console.log('§2 the dice land by the fight, thrown from each chair');
{
  const dice=createArenaDiceSequence({drive:[4,5,3],sustain:[3,4,2],poolStart:[0,5.9]});
  const lane=new THREE.Vector3(1,0,0),mid=new THREE.Vector3(0,.2,0);
  const at=placeBattleDice(dice,{lane,mid,you:'attacker'});
  ok('they settle within a couple of hexes of the fight',at.distanceTo(mid)<3);
  const mine=dice.entries.filter(e=>e.pool===0),theirs=dice.entries.filter(e=>e.pool===1);
  ok('your pool leaves your side, the other player\'s leaves across the table',mine.every(e=>e.origin.z>10)&&theirs.every(e=>e.origin.z<0));
  dice.dispose();
}

console.log('§3 the live arena');
const bytes=readFileSync(new URL('../../public/cosmic-arena/cosmic-arena.glb',import.meta.url));
const model=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
model.scale.z=-1;const scene=new THREE.Scene();scene.add(model);
const visuals=createArenaVisuals(scene);visuals.attachModel(model);
{
  const now=performance.now();
  const battle={attackerId:'a',defenderId:'b',phase:'swing_attacker',swingClash:true,swingKey:'k1',swingStartedAt:now-2000,
    swingRollAt:now-2000,swingRivalRollAt:null,viewer:'attacker',diceVals:[4,5,3],defenderDiceVals:[3,4,2],
    dicePool:[6,6,6],defenderDicePool:[6,6,6],atkTotal:12,defTotal:9,damage:3,tied:false,attackerWon:true};
  const spirits=[{id:'a',num:7,corner:'blue',color:'#62dbff'},{id:'b',num:8,corner:'red',color:'#b0a0ff'}];
  const f=arenaFrame({spirits,noteStates:{},battle});
  ok('the frame carries whose chair to film from',f.battle.viewer==='attacker'&&f.battle.swingRollAt===battle.swingRollAt);
  visuals.update(f);visuals.tick(1);
  const shot=visuals.battleShot();
  ok('a live Swing hands the camera a director shot',shot&&['seat','charge'].includes(shot.kind)&&Number.isFinite(shot.focus));
  let sheets=0;scene.traverse(o=>{if(o.name==='Stick standee sheet')sheets++;});
  ok('the stick figures stand in acrylic',sheets>=2);
  ok('no crowd reacts while the bout is live',visuals.crowdReaction()===null);
  visuals.update(arenaFrame({spirits,noteStates:{},battle:null}));visuals.tick(1.2);
  ok('the aftermath outlives the overlay: shove first',visuals.battleShot()?.kind==='seat');
  visuals.tick(1.2+BATTLE_DIRECTOR.shoveTime+BATTLE_DIRECTOR.fanDelay+.5);
  ok('…then the winner\'s fans',visuals.battleShot()?.key==='final-0');
  const r=visuals.crowdReaction();
  ok('the winner\'s crowd cheers and the loser\'s sags',r?.winnerId==='a'&&r.loserId==='b'&&r.amount>0);
  visuals.tick(1.2+BATTLE_DIRECTOR.shoveTime+BATTLE_DIRECTOR.fanDelay+BATTLE_DIRECTOR.finalHold+2);
  ok('…and it all lets go',visuals.battleShot()===null&&visuals.crowdReaction()===null);
}

console.log('§4 sonicCamera flies it and hands the camera back');
{
  const camera=new THREE.PerspectiveCamera(42,1.5,.1,200);camera.position.set(20,20,20);
  const controls={target:new THREE.Vector3(),enabled:true,enableDamping:true,update(){}};
  const cam=createSonicCamera({camera,controls,pointFor:()=>new THREE.Vector3()});
  const directed={key:'x',pos:new THREE.Vector3(1,2,3),target:new THREE.Vector3(0,1,0),focus:4.2,fov:38};
  ok('a directed shot takes the camera with no battle on the frame',cam.update({},null,.016,false,directed)===true);
  ok('…cutting straight to it',camera.position.distanceTo(directed.pos)<1e-9&&Math.abs(camera.fov-38)<1e-9);
  ok('…and exposing the focus distance for the depth of field',cam.focusDistance===4.2);
  for(let i=0;i<200&&cam.update({},null,.05,false,null);i++);
  ok('when the director lets go the camera returns, lens included',camera.position.distanceTo(new THREE.Vector3(20,20,20))<1e-6&&camera.fov===42&&cam.focusDistance===null);
}
visuals.dispose();
console.log(`PASS: battle director — ${passed} checks: shot list, shield hold, focus pulls, dice from the chairs, live-arena standees, aftermath, crowd reaction, camera hand-back`);
