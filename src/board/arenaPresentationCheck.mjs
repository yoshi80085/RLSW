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
const sheet={rigPool:3,rigPower:2,driveStack:['A','B'],sustainStack:['C'],noteStock:['SECRET']};
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
assert.ok(emissives.some(e=>e.crack),'shipped fissure material exists');
let reflective=0;gltf.scene.traverse(o=>{if(o.material?.isMeshPhysicalMaterial)reflective++;});assert.ok(reflective>=2);
const visuals=createArenaVisuals(scene);visuals.attachModel(gltf.scene);visuals.update(frame);
assert.equal(visuals.diagnostics().rigStations,8,'all eight preview cabinets bind');
assert.equal(visuals.diagnostics().liveCabinets,6,'two stations × actual pool 3');
assert.equal(visuals.diagnostics().effects,0,'first frame does not invent a move');
visuals.tick(1);
const moved=arenaFrame({...input,spirits:[{...spirit,num:16}],battle:null});visuals.update(moved);
assert.equal(visuals.diagnostics().effects,2,'one live move emits trail plus arrival ring');
visuals.update(moved);assert.equal(visuals.diagnostics().effects,2,'rerenders do not repeat a move');
visuals.update(arenaFrame({spirits:[]}));assert.equal(visuals.diagnostics().effects,0,'smoke filtering removes existing trails');
assert.equal(visuals.diagnostics().liveCabinets,0,'removed owners do not leave phantom rigs');
const hazards=arenaFrame({...input,laser:{beams:[{hexes:[7,16]}]},pyro:{hexes:[17],phase:'firing'},
  slime:[{num:18}],vortex:{hex:56},bots:[{num:19}],smoke:{radius:2}});
visuals.update(hazards);const count=visuals.diagnostics().hazards;assert.ok(count>=15,'live hazards create geometry');
visuals.update(hazards);assert.equal(visuals.diagnostics().hazards,count,'same hazards do not accumulate meshes');
visuals.tick(3,true);visuals.update(frame);assert.equal(visuals.diagnostics().hazards,0,'expired hazards are removed');
visuals.update(arenaFrame({...input,noteStates:{ronin:{rigPool:1,rigPower:0}}}));
assert.equal(visuals.diagnostics().liveCabinets,2,'atrophy removes upper cabinets');
const duel=arenaFrame({...input,spirits:[spirit,{id:'other',num:16,color:'#cc44ff'}],battle:{attackerId:'ronin',defenderId:'other',phase:'result'}});
visuals.update(duel);visuals.update({...duel,battle:null});assert.equal(visuals.diagnostics().effects,2,'resolved battle emits an attack and impact');
visuals.tick(5);assert.equal(visuals.diagnostics().effects,0,'transient effects expire');
environment.dispose();visuals.dispose();releaseArenaObject(scene);
console.log('PASS: public frame/privacy, canonical rig values, real GLB stations/materials, movement deduplication, hidden trails, live hazards, atrophy and cleanup');
