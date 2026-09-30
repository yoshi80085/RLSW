import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { arenaFrame } from './arenaFrame.js';
import { arenaPoint, createArenaVisuals, releaseArenaObject } from './arenaVisuals.js';
import { createArenaEnvironment, polishArenaModel } from './arenaEnvironment.js';
import { rigTiers, rigRadius } from '../engine/systems/sonicRig.js';
import { HEX_BY_NUM } from './hexMap.js';

const spirit={id:'ronin',num:7,corner:'blue',color:'#4488ff'};
const sheet={rigPool:3,rigPower:2,driveSlots:2,sustainSlots:2,driveStack:['A','B'],sustainStack:['C'],noteStock:['SECRET']};
const input={spirits:[spirit],noteStates:{ronin:sheet,hidden:{noteStock:['PRIVATE']}},actingId:'ronin',turn:1,
  battle:{attackerId:'ronin',defenderId:'hidden',phase:'result'},
  flashes:[{key:1,spiritId:'hidden',color:'#ff0000'}],
  slides:{hidden:{id:'hidden',cx:1,cy:2}}, thump:{id:'hidden',key:1},bots:null};
const before=JSON.stringify(input);
const frame=arenaFrame(input);
assert.equal(frame.battle,null);assert.deepEqual(frame.slides,[]);assert.deepEqual(frame.flashes,[]);assert.equal(frame.thump,null);
assert.ok(!JSON.stringify(frame).includes('SECRET'));assert.ok(!JSON.stringify(frame).includes('PRIVATE'));
assert.deepEqual({pool:frame.rigs[0].pool,power:frame.rigs[0].power},rigTiers(sheet));
assert.equal(frame.rigs[0].radius,rigRadius(sheet,true));
assert.equal(arenaFrame({...input,actingId:'other'}).rigs[0].radius,rigRadius(sheet,false));
assert.equal(JSON.stringify(input),before,'presentation projection is read-only');
const p=arenaPoint(7);assert.equal(p.x,(HEX_BY_NUM[7].px-3255)/200);assert.equal(p.z,(HEX_BY_NUM[7].py-2415)/200);
assert.equal(arenaPoint(-999),null);

// Load the actual shipped asset, so station names/material contracts cannot
// silently pass against a hand-made fixture that the real model doesn't match.
const bytes=readFileSync(new URL('../../public/cosmic-arena/cosmic-arena.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scene=new THREE.Scene();scene.add(gltf.scene);gltf.scene.scale.z=-1;
const authored=new Map();gltf.scene.traverse(o=>{if(o.material&&/Hex ceramic|Obsidian stage/.test(o.material.name))authored.set(o.material.name,{color:o.material.color.clone(),roughness:o.material.roughness,metalness:o.material.metalness});});
const emissives=polishArenaModel(gltf.scene);
gltf.scene.traverse(o=>{const source=authored.get(o.material?.name);if(source){assert.ok(o.material.color.equals(source.color));assert.equal(o.material.roughness,source.roughness);assert.equal(o.material.metalness,source.metalness);}});
const environment=createArenaEnvironment(scene);environment.update(1,{lite:true});
const wreckage=scene.getObjectByName('Floating wreckage');assert.ok(wreckage.visible,'Standard keeps floating scenery');
assert.equal(wreckage.children[0].count,48,'all preview rocks share one instanced draw');assert.equal(wreckage.children.length,8,'seven metal shards accompany the rocks');
assert.equal(scene.environment,null,'no bright room reflection washes out authored palette');
// 🔦 Spotlights: aimed at the engine's hexes, seat colour, empty seat dim, halos only for visible posers.
assert.equal(arenaFrame({spirits:[]}).spotlights,null,'no lights in state → the old decorative sweep');
const spotSeats=[{id:'b',num:26,corner:'blue'},{id:'h',num:29,corner:'purple'}];
const spotFrame=arenaFrame({spirits:spotSeats.slice(0,1),crowdSpirits:spotSeats,
  spotlights:{hexes:{blue:26,purple:29,yellow:65,red:67},poses:{b:{hex:26},h:{hex:29}}}}).spotlights;
assert.deepEqual(spotFrame.lights.map(l=>[l.corner,l.hex,l.seated]),[['blue',26,true],['purple',29,true],['yellow',65,false],['red',67,false]]);
assert.equal(spotFrame.lights[0].color,'#4488ff','player colour');
assert.deepEqual(spotFrame.posers,[{id:'b',hex:26}],'a smoke-hidden poser gets no halo');
environment.update(2,{spotlights:spotFrame});
assert.deepEqual(environment.diagnostics(),{spotHexes:{blue:26,purple:29,yellow:65,red:67},halos:1});
const rings=[];scene.traverse(o=>{if(o.name==='Spotlight hex'&&o.visible)rings.push(o);});assert.equal(rings.length,4,'every parked light marks its hex');
const h26=HEX_BY_NUM[26];assert.ok(Math.hypot(rings[0].position.x-(h26.px-3255)/200,rings[0].position.z-(h26.py-2415)/200)<1e-6,'blue ring sits on hex 26');
environment.update(2.1,{spotlights:{...spotFrame,lights:spotFrame.lights.map(l=>l.corner==='blue'?{...l,hex:27}:l)}});
assert.equal(environment.diagnostics().spotHexes.blue,27,'a round step re-aims the light');
environment.update(3,{lite:true});assert.equal(environment.diagnostics().halos,0,'no frame lights → no halos');
assert.ok(emissives.some(e=>e.crack),'shipped fissure material exists');
let reflective=0;gltf.scene.traverse(o=>{if(o.material?.isMeshPhysicalMaterial)reflective++;});assert.ok(reflective>=2);
const visuals=createArenaVisuals(scene);visuals.attachModel(gltf.scene);visuals.update(frame);
assert.equal(visuals.diagnostics().rigStations,8,'all eight preview cabinets bind');
assert.equal(visuals.diagnostics().liveCabinets,6,'two stations × 3 cabinets (5 seats each — amps show the SEATS, 2026-09-27)');
assert.equal(visuals.diagnostics().effects,0,'first frame does not invent a move');
visuals.tick(1);
const moved=arenaFrame({...input,spirits:[{...spirit,num:16}],battle:null});visuals.update(moved);
assert.equal(visuals.diagnostics().effects,2,'one live move emits trail plus arrival ring');
visuals.update(moved);assert.equal(visuals.diagnostics().effects,2,'rerenders do not repeat a move');
visuals.update(arenaFrame({spirits:[]}));assert.equal(visuals.diagnostics().effects,0,'smoke filtering removes existing trails');
assert.equal(visuals.diagnostics().liveCabinets,0,'removed owners do not leave phantom rigs');
const hazards=arenaFrame({...input,laser:{beams:[{hexes:[7,16]}]},pyro:{hexes:[17],phase:'firing'},
  slime:[{num:18}],vortex:{hex:56},bots:[{num:19}],smoke:{radius:2}});
visuals.update(hazards);const count=visuals.diagnostics().hazards;assert.ok(count>=5,'non-smoke hazards create geometry; smoke uses its own volume compositor');
visuals.update(hazards);assert.equal(visuals.diagnostics().hazards,count,'same hazards do not accumulate meshes');
visuals.tick(3,true);visuals.update(frame);assert.equal(visuals.diagnostics().hazards,0,'expired hazards are removed');
visuals.update(arenaFrame({...input,noteStates:{ronin:{rigPool:3,rigPower:2}}}));
assert.equal(visuals.diagnostics().liveCabinets,2,'the marquee rig tiers no longer grow the amps — 3 seats is one cabinet each');
visuals.update(arenaFrame({...input,noteStates:{ronin:{driveSlots:1,sustainSlots:0}}}));
assert.equal(visuals.diagnostics().liveCabinets,3,'Drive and Sustain stand at their own heights (4 seats → 2, 3 seats → 1)');
const duel=arenaFrame({...input,spirits:[spirit,{id:'other',num:16,color:'#cc44ff'}],battle:{attackerId:'ronin',defenderId:'other',phase:'result'}});
visuals.update(duel);visuals.update({...duel,battle:null});assert.equal(visuals.diagnostics().effects,2,'resolved battle emits an attack and impact');
visuals.tick(5);assert.equal(visuals.diagnostics().effects,0,'transient effects expire');
// 🔓 THE SEAT UNLOCK (2026-09-28): the cabinet drops and lands, the rig flares,
// the lens cuts to the amp and pushes in, the Spirit's stand jumps — and it all ends at rest.
{
  const seats={ronin:{driveSlots:1,sustainSlots:0}};
  const u={key:'u1',spiritId:'ronin',which:'drive',slot:4,short:false};
  const uf=arenaFrame({...input,battle:null,noteStates:seats,unlock:u});
  assert.deepEqual(uf.unlock,u,'the unlock crosses into the frame');
  assert.equal(arenaFrame({...input,battle:null,unlock:{...u,spiritId:'hidden'}}).unlock,null,'smoke hides an unlock too');
  visuals.update(uf);visuals.tick(10);
  assert.deepEqual(visuals.diagnostics().unlock,{id:'ronin',role:'drive',slot:4,short:false,hasRig:true},'the moment binds to the Drive rig');
  const s0=visuals.battleShot();
  assert.ok(s0?.key==='unlock:u1'&&s0.pos&&s0.target,'the lens is handed a shot on the amp');
  visuals.tick(10.1);
  assert.equal(visuals.diagnostics().liveCabinets,2,'the new cabinet waits above, unseen, before it drops');
  const rigCabinets=()=>{const out=[];gltf.scene.traverse(o=>{if(/^Amp_NW(_tier_\d)?$/.test(o.name))out.push(o);});return out.sort((a,b)=>a.name.localeCompare(b.name));};
  const fresh=rigCabinets()[1];
  visuals.tick(10.45);
  assert.ok(fresh.visible&&fresh.position.y>fresh.userData.baseY+.5,'…then falls onto the stack');
  const midDist=visuals.battleShot().pos.distanceTo(visuals.battleShot().target);
  assert.ok(visuals.crowdReaction()?.winnerId==='ronin'&&visuals.crowdReaction().amount>0,'the Ronin’s stand is on its feet');
  visuals.tick(11.4);
  assert.ok(Math.abs(fresh.position.y-fresh.userData.baseY)<1e-6,'…and lands at rest on its seat');
  const lateDist=visuals.battleShot().pos.distanceTo(visuals.battleShot().target);
  assert.ok(lateDist<midDist,'the lens pushes in');
  visuals.update({...uf,unlock:null});visuals.tick(13.2);
  assert.equal(visuals.battleShot(),null,'when it is over the camera is handed back');
  assert.equal(visuals.diagnostics().unlock,null,'…and the moment is cleared');
  assert.equal(visuals.diagnostics().liveCabinets,3,'two Drive cabinets and one Sustain stand at rest');
  const bot=arenaFrame({...input,battle:null,noteStates:seats,unlock:{...u,key:'u2',short:true}});
  visuals.update(bot);visuals.tick(14);
  assert.equal(visuals.battleShot(),null,'a bot’s unlock never takes the camera');
  assert.equal(visuals.crowdReaction(),null,'…nor the crowd');
  visuals.update({...bot,unlock:null});visuals.tick(16);
  visuals.update(frame);visuals.tick(20);
}
environment.dispose();visuals.dispose();releaseArenaObject(scene);
console.log('PASS: public frame/privacy, canonical rig values, real GLB stations/materials, movement deduplication, hidden trails, live hazards, amps = seats per stack, the seat-unlock moment and cleanup');
