import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import * as THREE from 'three';
import {createDuelWaveforms,arenaAmpOrigins} from './waveforms.js';
import {DEFAULTS,seeded,parseMelody,makeExchange,nextExchange,continuationGap,exchangeHandoff,activeRun,judge,expire,resolveExchange,demoOffset} from './duel.js';

let count=0;
const check=(name,fn)=>{fn();count++;console.log(`✓ ${name}`);};
const melodies=[['A','C','E','G','A'],['D','F','A','C','D']];
const make=(round=1,config=DEFAULTS)=>makeExchange({round,config,melodies,rand:seeded()});
function perform(e,scenario){for(const r of e.runs){
  const events=r.notes.map((n,i)=>({n,time:n.hitAt+demoOffset(r,i,scenario)})).sort((a,b)=>a.time-b.time);
  for(const {n,time} of events){expire(r,time);judge(r,n.pos[0]+1,time);}expire(r,Infinity);
}return e;}

check('same seed, same call and answer',()=>assert.deepEqual(make(),make()));
check('attacker calls first; Rival leads exchange two; roles keep alternating',()=>{
  for(let i=1;i<=8;i++)assert.equal(make(i).caller,(i-1)%2);
});
check('Rival calls its OWN melody in round two',()=>assert.deepEqual(make(2).runs[1].notes.map(n=>n.key),['d','f','a','c']));
check('3–5 note limit, including real three-note melodies',()=>{
  for(const length of [3,4,5])assert.equal(make(1,{...DEFAULTS,length}).runs[0].notes.length,length);
  const e=makeExchange({config:DEFAULTS,melodies:[['C','E','G'],['D','F','A']]});
  assert.deepEqual(e.runs[0].notes.map(n=>n.key),['c','e','g']);
});
check('empty melody falls back to a short playable call',()=>{
  const e=makeExchange({config:DEFAULTS,melodies:[[],[]]});assert.equal(e.runs[0].fromMelody,false);assert.equal(e.runs[0].notes.length,4);
});
check('next lane is falling before the current lane finishes',()=>{
  const e=make(),a=e.runs[0],b=e.runs[1];assert.ok(b.firstHit-b.leadTime<a.lastHit);
});
check('handoff windows never overlap, even at maximum tempo',()=>{
  for(const bpm of [90,138,200,240]){const e=make(1,{...DEFAULTS,bpm,handoff:0}),[a,b]=e.runs;
    assert.ok(b.firstHit-b.preset.ok>=a.lastHit+a.preset.ok-1e-8);
    assert.equal(activeRun(e,b.firstHit).side,1);
  }
});
check('a press consumes only one note; wrong strings cannot score',()=>{
  const e=make(),r=e.runs[0],n=r.notes[0];
  const wrong=(n.pos[0]+1)%6+1;
  assert.equal(judge(r,wrong,n.hitAt).result.grade,'wrong');
  assert.equal(judge(r,n.pos[0]+1,n.hitAt),null);assert.equal(r.results.length,1);
});
check('held/repeated inputs outside windows cannot score future notes',()=>{
  const r=make().runs[0];assert.equal(judge(r,1,0),null);assert.equal(r.results.length,0);
});
check('unplayed notes expire exactly once',()=>{
  const r=make().runs[0];assert.equal(expire(r,Infinity).length,4);assert.equal(expire(r,Infinity).length,0);
});
check('a phrase cannot resolve before both performers finish',()=>assert.equal(resolveExchange(make(),DEFAULTS),null));
check('clear opening gap resolves using the real engine verdict',()=>{
  const r=resolveExchange(perform(make(),'break'),DEFAULTS);assert.ok(r.stopped);assert.ok(r.verdict.attackerWon);assert.ok(r.verdict.damage>0);
});
check('close opening stays locked; Rival gets its call',()=>assert.equal(resolveExchange(perform(make(),'close'),DEFAULTS).stopped,false));
check('second exchange can break the lock',()=>assert.ok(resolveExchange(perform(make(2),'close'),DEFAULTS).stopped));
check('continuous mode does not manufacture a winner from equal play',()=>{
  for(const round of [1,2,3,10,50])assert.equal(resolveExchange(perform(make(round),'locked'),DEFAULTS).stopped,false);
});
check('two-round mode preserves the existing sudden-death/tie endpoint',()=>{
  const c={...DEFAULTS,rounds:'two'},r=resolveExchange(perform(make(2,c),'locked'),c,{tie:true});
  assert.ok(r.stopped);assert.ok(r.verdict.tie);assert.equal(r.verdict.damage,0);
});
check('tempo rises within a ceiling; identical jitter is harder for bots too',()=>{
  const a=make(),b=make(20);assert.ok(b.bpm>a.bpm);assert.ok(b.bpm<=240);
  const ra=judge(a.runs[0],a.runs[0].notes[0].pos[0]+1,a.runs[0].firstHit+100);
  const rb=judge(b.runs[0],b.runs[0].notes[0].pos[0]+1,b.runs[0].firstHit+100);
  assert.equal(ra.result.grade,'good');assert.equal(rb.result.grade,'ok');
});
check('melody entry validates input',()=>{assert.deepEqual(parseMelody('D F# A, C'),['D','F#','A','C']);assert.throws(()=>parseMelody('hello'));assert.deepEqual(parseMelody(''),[]);});
check('a small performance gap survives early but ends a later duel',()=>{
  function smallGap(round){const ex=make(round);ex.runs.forEach((r,side)=>r.notes.forEach((n,i)=>r.results.push({noteIdx:n.idx,hit:true,rt:40,grade:side===1&&i===0?'good':'perfect'})));return resolveExchange(ex,DEFAULTS);}
  assert.equal(smallGap(1).stopped,false);assert.equal(smallGap(8).stopped,true);assert.equal(smallGap(8).verdict.attackerWon,true);
  assert.equal(continuationGap(100),DEFAULTS.gapFloor);
  assert.equal(continuationGap(100,{...DEFAULTS,rounds:'two'}),20);
});
check('faster exchanges narrow handoffs without overlapping either input owner',()=>{
  let ex=make();for(let i=0;i<20;i++){
    const next=nextExchange(ex,{config:DEFAULTS,melodies,rand:seeded()});
    const early=next.runs[next.caller].firstHit-next.runs[next.caller].preset.ok;
    assert.ok(early>=ex.end);assert.ok(Math.abs(early-ex.end-exchangeHandoff(next.round))<1e-7);
    ex=next;
  }
  assert.ok(exchangeHandoff(8)<exchangeHandoff(2));
});
check('long-demo timing naturally survives several bouts before breakthrough',()=>{
  let end=0;for(let round=1;round<=20;round++){if(resolveExchange(perform(make(round),'escalate'),DEFAULTS).stopped){end=round;break;}}
  assert.ok(end>3&&end<20,`ended at ${end}`);
});

// Render the actual imported neck twice. SVG ids must be unique and every
// paint-server reference must resolve within its own SVG, not its neighbour.
const out=resolve('node_modules/.cache/rlsw/riffArenaSSR.mjs');mkdirSync(resolve('node_modules/.cache/rlsw'),{recursive:true});
await build({stdin:{contents:`import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {RiffHighway} from './src/ui/RiffHighway.jsx'; export function render(runs){return renderToStaticMarkup(<div>{runs.map((run,i)=><RiffHighway key={i} run={run} results={[]} />)}</div>)}`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,platform:'node',packages:'external',format:'esm',outfile:out,logLevel:'warning'});
const {render}=await import(pathToFileURL(out).href),html=render(make().runs);
check('two real guitar necks have unique SVG ids',()=>{const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,4);assert.equal(new Set(ids).size,4);});
check('each neck resolves its own glow and fill',()=>{for(const svg of html.match(/<svg[\s\S]*?<\/svg>/g)){const ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);for(const [,ref] of svg.matchAll(/url\(#([^\)]+)\)/g))assert.ok(ids.includes(ref));}});
const parent=new THREE.Group(),waves=createDuelWaveforms(parent,['#43dfff','#ff9955']);
check('emission origins follow real speaker surfaces and the model Z flip',()=>{
  const model=new THREE.Group();model.scale.z=-1;
  ['W-S','E-S'].forEach((id,i)=>{const amp=new THREE.Group();amp.name=`Amp_${id}`;amp.position.set(i?12:-12,1,2);
    const material=new THREE.MeshBasicMaterial();material.name='Speaker cone';amp.add(new THREE.Mesh(new THREE.BoxGeometry(.2,.4,.1),material));model.add(amp);});
  const origins=arenaAmpOrigins(model);assert.deepEqual(origins.map(v=>v.toArray()),[[-12,1,-2],[12,1,-2]]);
  waves.setOrigins(origins);model.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});
const frame={time:0,energy:[0,0],glitter:.3};waves.update(frame);
check('unplayed Spirits emit no ring beams',()=>assert.ok(waves.waves.every(w=>!w.visual.group.visible)));
waves.update({...frame,time:100,energy:[4,4]});waves.update({...frame,time:900,energy:[4,4]});
check('both sides use the real Sonic ring geometry',()=>{
  for(const w of waves.waves){assert.equal(w.field.name,'Harmonic wave rings');assert.ok(w.field.visible);assert.ok(w.field.geometry.attributes.position.array.some(n=>Math.abs(n)>.1));}
});
check('approved helix glitter stays finite and respects the intensity control',()=>{
  for(const w of waves.waves){assert.equal(w.glitter.geometry.drawRange.count,2000);assert.ok(w.glitter.geometry.attributes.position.array.every(Number.isFinite));assert.equal(w.glitter.material.uniforms.amount.value,.3);}
});
check('rings advance toward the ball at fixed spacing, never stretching a group',()=>{
  const before=waves.waves[0].stations.map(s=>({...s}));
  waves.update({...frame,time:920,energy:[4,4]});
  const after=waves.waves[0].stations;
  for(const a of before){const b=after.find(s=>s.slot===a.slot);if(b)assert.ok(Math.abs(b.distance-a.distance-.12)<1e-7);}
  const sorted=after.map(s=>s.distance).sort((a,b)=>a-b);
  for(let i=1;i<sorted.length;i++)assert.ok(Math.abs(sorted[i]-sorted[i-1]-.59)<1e-7);
  assert.deepEqual(waves.waves[0].visual.group.scale.toArray(),[1,1,1]);
});
check('central ball grows with the duel and rotates its rings independently',()=>{
  const radius=waves.ball.userData.radius,a=waves.hoops.map(p=>p.rotation.x);
  waves.update({...frame,time:1500,energy:[20,20]});
  assert.ok(waves.ball.userData.radius>radius);assert.ok(waves.ball.visible);
  const movement=waves.hoops.map((p,i)=>p.rotation.x-a[i]);
  assert.ok(movement.some(n=>n>0)&&movement.some(n=>n<0));assert.ok(new Set(movement).size>4);
});
waves.update({...frame,time:2000,energy:[4,4],reduced:true});
const still=Array.from(waves.waves[0].glitter.geometry.attributes.position.array);
waves.update({...frame,time:3000,energy:[4,4],reduced:true});
check('reduced motion holds the glitter weave still',()=>assert.deepEqual(Array.from(waves.waves[0].glitter.geometry.attributes.position.array),still));
check('reduced motion holds the spinning core still',()=>{
  const angles=waves.hoops.map(p=>p.rotation.toArray());
  waves.update({...frame,time:3050,energy:[4,4],reduced:true});assert.deepEqual(waves.hoops.map(p=>p.rotation.toArray()),angles);
});
waves.update({...frame,time:3100,energy:[4,4],glitter:0});
check('glitter can be turned off without hiding the Sonic rings',()=>assert.ok(waves.waves.every(w=>!w.glitter.visible&&w.visual.group.visible)));
waves.reset();check('reset clears both waveforms',()=>assert.ok(waves.waves.every(w=>!w.visual.group.visible&&w.first===null)));
waves.dispose();check('waveform disposal releases both scene roots',()=>assert.equal(parent.children.length,0));
console.log(`\n${count} Riff arena checks passed.`);
