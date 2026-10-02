import assert from 'node:assert/strict';
import {makeRng} from '../engine/rng.js';
import {applyRiffOffStarted,applyRiffResultsSubmitted,applyRiffResolved,applyRiffRound2Started} from '../engine/systems/riffOff.js';
import {arenaSeatControl,arenaInputRole,judgeArenaNote,arenaBotResults,makeArenaExchange} from './arenaDuel.js';
import {createRiffArenaVisuals} from '../board/riffArenaVisuals.js';
import * as THREE from 'three';
import {makeInitialState} from '../engine/state.js';
import {buildTestingGroundsConfig} from '../data/matchSetup.js';
import {applyBotAction} from '../engine/policies/transition.js';
import {HEX_BY_NUM} from '../board/hexMap.js';
import {neighborInDirection,angleTo} from '../board/hexGeometry.js';
let checks=0;
const check=(label,fn)=>{fn();checks++;console.log(`✓ ${label}`);};
const base={spirits:[{id:'a'},{id:'b'}],noteStates:{a:{lastCommittedMelody:['A','C','E','G'],perfScore:6},b:{lastCommittedMelody:['D','F','A','C'],perfScore:6}}};
const start=seed=>applyRiffOffStarted(base,{attackerId:'a',defenderId:'b',arenaVersion:1},makeRng(seed));
const submit=(s,side,grade='perfect')=>applyRiffResultsSubmitted(s,{role:side===0?'attacker':'defender',round:s.battle.round,clock:s.battle.arenaClock,
  results:s.battle.arenaExchange.runs[side].notes.map(n=>({noteIdx:n.idx,grade,hit:grade!=='miss',rt:grade==='miss'?null:30}))});
check('seeded current + preloaded charts replay identically',()=>assert.deepEqual(start(46),start(46)));
check('three-note melodies stay short and unusable saved material falls back safely',()=>{
  const short=makeArenaExchange({melodies:[['C','E','G'],[]],rng:makeRng(1)});
  assert.equal(short.runs[0].notes.length,3);assert.ok(short.charts[0].fromMelody);
  const bad=makeArenaExchange({melodies:[['?','?','?'],[]],rng:makeRng(1)});
  assert.equal(bad.runs[0].notes.length,4);assert.equal(bad.charts[0].fromMelody,false);
});
check('both committed melodies survive into alternating calls',()=>{
  const b=start(46).battle;
  assert.deepEqual(b.arenaExchange.charts[0].degrees.slice(0,4),b.atkRiff.degrees.slice(0,4));
  assert.equal(b.arenaNext.caller,1);assert.ok(b.arenaNext.charts[1].fromMelody);
  assert.deepEqual(b.melodies[1],['D','F','A','C']);
});
check('chart gestures fit inside exclusive handoffs across 100 seeds',()=>{
  for(let seed=1;seed<=100;seed++){const b=start(seed).battle;
    for(const ex of [b.arenaExchange,b.arenaNext]){const a=ex.runs[ex.caller],d=ex.runs[1-ex.caller];assert.ok(d.firstHit-d.preset.ok>=a.end);
      for(const r of ex.runs)for(const n of r.notes)if(n.partnerOf!=null){assert.equal(n.hitAt,r.notes[n.partnerOf].hitAt);assert.notEqual(n.pos[0],r.notes[n.partnerOf].pos[0]);}
    }
  }
});
check('late and duplicate result submissions cannot overwrite a performance',()=>{
  let s=start(3),run=s.battle.arenaExchange.runs[0];const results=run.notes.map(n=>({noteIdx:n.idx,hit:true,grade:'perfect',rt:30}));
  assert.equal(applyRiffResultsSubmitted(s,{role:'attacker',results,round:2,clock:0}),s);
  assert.equal(applyRiffResultsSubmitted(s,{role:'attacker',results:results.slice(1),round:1,clock:0}),s);
  s=submit(s,0);assert.equal(submit(s,0,'miss'),s);
});
check('exact ties continue beyond round two and retain cumulative Soundform energy',()=>{
  let s=start(9);const rng=makeRng(11);
  for(let i=1;i<=8;i++){s=applyRiffResolved(submit(submit(s,0),1));
    // Both charts can have a different number of chord partners; normalized
    // perfect performances still must stay locked.
    assert.equal(s.battle.verdict.close,true);s=applyRiffRound2Started(s,{round:i},rng);assert.equal(s.battle.round,i+1);
  }
  assert.ok(s.battle.arenaEnergy.every(n=>n>20));assert.equal(s.battle.arenaExchange.gapLimit,4);
});
check('decisive result cannot advance, and resolution is idempotent',()=>{
  const s=applyRiffResolved(submit(submit(start(8),0),1,'miss'));
  assert.equal(s.battle.verdict.close,false);assert.equal(s.battle.verdict.attackerWon,true);
  assert.equal(applyRiffResolved(s),s);assert.equal(applyRiffRound2Started(s,{round:1},makeRng(2)),s);
});
check('clock restart preserves completed sides and rejects pre-resume packets',()=>{
  let s=submit(start(17),0);s=applyRiffRound2Started(s,{round:1,clockOnly:true,at:100000},makeRng(1));
  assert.ok(s.battle.atkResults);assert.equal(s.battle.arenaClock,1);
  const results=s.battle.arenaExchange.runs[1].notes.map(n=>({noteIdx:n.idx,hit:true,grade:'perfect',rt:30}));
  assert.equal(applyRiffResultsSubmitted(s,{role:'defender',round:1,clock:0,results}),s);
});
check('late network decisions give the next player a fresh lead-in',()=>{
  let s=applyRiffRound2Started(start(3),{round:1,clockOnly:true,at:10000},makeRng(1));
  s=applyRiffResolved(submit(submit(s,0),1));s=applyRiffRound2Started(s,{round:1,at:50000},makeRng(3));
  const r=s.battle.arenaExchange.runs[1];assert.equal(r.firstHit,41600);
});
check('keyboard judge consumes one matching string, duplicate press cannot score it twice',()=>{
  const ex=start(2).battle.arenaExchange,r=ex.runs[0],n=r.notes[0],res=judgeArenaNote(r,[],n.pos[0]+1,n.hitAt);
  assert.equal(res.grade,'perfect');assert.equal(arenaInputRole(ex,n.hitAt),0);
  const again=judgeArenaNote(r,[res],n.pos[0]+1,n.hitAt);assert.notEqual(again?.noteIdx,n.idx);
});
check('spectators cannot perform or conduct; host owns bots only',()=>{
  const b=start(8).battle,spirits=[{id:'a',cpu:true},{id:'b',cpu:false}];
  assert.deepEqual(arenaSeatControl(b,spirits,{spectator:true,isHost:true}).own,[false,false]);
  assert.deepEqual(arenaSeatControl(b,spirits,{isHost:true,mySpiritId:'other'}).own,[true,false]);
  assert.deepEqual(arenaSeatControl(b,spirits,{mySpiritId:'b'}).own,[false,true]);
});
check('tempo-aware bots use the same judge and miss out-of-window inputs',()=>{
  const run=start(9).battle.arenaExchange.runs[0];
  const r=arenaBotResults(run,run.notes.map((_,i)=>i===0?0:999));assert.equal(r[0].grade,'perfect');assert.ok(r.slice(1).every(n=>n.grade==='miss'));
});
check('arena staging does not mutate logical positions and releases its effects',()=>{
  const parent=new THREE.Group(),positions=[new THREE.Vector3(1,.2,2),new THREE.Vector3(3,.2,2)],before=positions.map(p=>p.toArray());
  const fx=createRiffArenaVisuals(parent,{key:'test',spirits:[{id:'a',color:'#43dfff'},{id:'b',color:'#ff9955'}],positions,origins:[new THREE.Vector3(-10,1,0),new THREE.Vector3(10,1,0)]});
  fx.update({time:1000,energy:[4,4]},new THREE.PerspectiveCamera(44,1.6),false);
  assert.ok(fx.poses[0].distanceTo(fx.poses[1])>=8);assert.deepEqual(positions.map(p=>p.toArray()),before);fx.dispose();assert.equal(parent.children.length,0);
});
check('score changes move and grow the ball smoothly at render-frame cadence',()=>{
  const parent=new THREE.Group(),positions=[new THREE.Vector3(-4,.2,0),new THREE.Vector3(4,.2,0)];
  const fx=createRiffArenaVisuals(parent,{key:'smooth',spirits:[{id:'a',color:'#43dfff'},{id:'b',color:'#ff9955'}],positions,origins:positions});
  const camera=new THREE.PerspectiveCamera(44,1.6);
  fx.update({time:0,energy:[0,0]},camera,false,1/60);const before=fx.ball.position.x,size=fx.ball.scale.x;
  fx.update({time:2000,energy:[20,0]},camera,false,1/60);const step=fx.ball.position.x;
  assert.ok(step>before&&step<.2,'a note changes pressure without teleporting to its target');
  assert.ok(fx.ball.scale.x>size&&fx.ball.scale.x-size<.15,'growth is eased too');
  for(let i=0;i<120;i++)fx.update({time:2000,energy:[20,0]},camera,false,1/60);
  assert.ok(fx.ball.position.x>1.29&&fx.ball.position.x<=1.3,'motion converges without overshooting');fx.dispose();
});
check('standee shake grows with energy, stays anchored, and respects reduced motion',()=>{
  const positions=[new THREE.Vector3(-4,.2,0),new THREE.Vector3(4,.2,0)],pawn=new THREE.Group();
  const measure=(energy,reduced)=>{
    const fx=createRiffArenaVisuals(new THREE.Group(),{key:'shake',spirits:[{id:'a',color:'#43dfff'},{id:'b',color:'#ff9955'}],positions,origins:positions});
    let max=0;for(let i=0;i<180;i++){fx.update({time:i*1000/60,energy},new THREE.PerspectiveCamera(44,1.6),reduced,1/60);pawn.rotation.z=0;fx.pose(pawn,'a');max=Math.max(max,pawn.position.distanceTo(positions[0]));}
    fx.dispose();return max;
  };
  const early=measure([1,1],false),late=measure([100,100],false);
  assert.ok(late>early*3&&late<.15);assert.equal(measure([100,100],true),0);
});
check('headless duels share continuous escalation, spend their action and apply aftermath',()=>{
  const config=buildTestingGroundsConfig({beginnerMode:false}),here=HEX_BY_NUM[55],there=neighborInDirection(here,0);
  config.spirits=config.spirits.map((s,i)=>({...s,...(i===0?{num:here.num,facing:angleTo(here,there)}:i===1?{num:there.num,facing:angleTo(there,here)}:{})}));
  const state=makeInitialState(config,99),[a,d]=state.spirits.map(s=>s.id);
  state.turn.moveStepsLeft=5;state.turn.actionTokenUsed=false;
  for(const id of [a,d])Object.assign(state.noteStates[id],{hasConfirmed:true,driveStack:['C','E','G','B'],sustainStack:['C','E','G','B'],perfScore:5,lastCommittedMelody:['C','E','G']});
  let long=0,short=0;
  for(let seed=1;seed<=60;seed++){
    const result=applyBotAction(state,{kind:'riffOff',targetId:d},{rng:makeRng(seed),view:{fameThisTurn:{}}});
    assert.ok(result.ok,result.detail);assert.equal(result.state.battle,null);assert.equal(result.state.turn.moveStepsLeft,3);
    assert.equal(result.state.turn.actionTokenUsed,true);assert.ok([a,d].includes(result.state.headliner));
    assert.equal(result.battle.verdict.close,false);
    if(result.battle.verdict.round>2)long++;if(result.battle.verdict.round===1)short++;
  }
  assert.ok(long>0&&short>0,'short breakthroughs and extended duels both occur');
});
console.log(`${checks} live arena duel checks passed.`);
