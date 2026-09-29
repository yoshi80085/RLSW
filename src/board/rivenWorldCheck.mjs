import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { createArenaEnvironment, polishArenaModel } from './arenaEnvironment.js';
import { createRivenWorld, RIVEN_WORLD } from './rivenWorld/index.js';
import { createLightning } from './rivenWorld/lightning.js';
import { updateNebulaFlashes, triggerNebulaFlash } from './rivenWorld/nebula.js';
import { disposeObject } from './rivenWorld/formation.js';
import { markOccluders, OCCLUDER_LAYER } from './solidLayer.js';

assert.deepEqual(RIVEN_WORLD,{
 depth:13.5,fracture:1.5,brightness:2.1,branches:9,interval:6.5,duration:1.6,
 nebula:.8,debris:1.5,bloom:.54,breath:.13,breathPeriod:12,cloudMotion:1.25,
 debrisDrift:1.05,rockBrightness:.85,rockColor:'#263a60',puffiness:1,
 lightningSoftness:1,creviceFollow:1,planetDistance:2.3,ampBrightness:.55,
 nebulaFlashStrength:1,nebulaFlashInterval:42,
},'game uses the complete approved preview dial-in');

const bytes=readFileSync(new URL('../../public/cosmic-arena/cosmic-arena.glb',import.meta.url));
const {scene:model}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(27,20,40);
scene.add(model);model.scale.z=-1;
const ampBody=model.getObjectByName('Amp_NW');let originalAmp;
ampBody.traverse(o=>{if(o.material?.name==='Amp midnight indigo')originalAmp=o.material.color.clone();});
polishArenaModel(model,{ampBrightness:RIVEN_WORLD.ampBrightness});
ampBody.traverse(o=>{if(o.material?.name==='Amp midnight indigo')assert(o.material.color.equals(originalAmp.clone().multiplyScalar(.55)),'approved amp brightness');});
const stage=model.getObjectByName('Stage'),island=model.getObjectByName('Island');
const stageState=stage.toJSON();
const environment=createArenaEnvironment(scene,{classicScenery:false});
const planet=scene.getObjectByName('Distant blue planet'),planetHome=planet.position.clone();
environment.setPlanetDistance(1.9);assert(planet.position.distanceTo(planetHome.clone().multiplyScalar(1.9))<1e-8);
environment.setPlanetDistance(RIVEN_WORLD.planetDistance);assert(planet.position.equals(planetHome.clone().multiplyScalar(2.3)),'approved planet distance');
assert.equal(scene.getObjectByName('Floating wreckage'),undefined,'old debris is not allocated for Riven World');
const world=createRivenWorld(scene,camera),root=scene.getObjectByName('Riven World');
world.update(10);assert.equal(root.visible,false,'wait for the model');
world.attachModel(model);world.attachModel(model);
assert.equal(island.visible,false);assert.equal(root.visible,true);
assert.deepEqual(stage.toJSON(),stageState,'stage geometry and materials are untouched');
markOccluders([stage,world.formation]);assert(world.formation.layers.isEnabled(OCCLUDER_LAYER));
const positions=world.formation.geometry.attributes.position;
for(let i=0;i<positions.count;i++)assert(positions.getY(i)<=-.44,'new rocks remain below the stage');
assert(world.formation.material.color.equals(new THREE.Color('#263a60').multiplyScalar(.85)));
const nebula=root.getObjectByName('Storm nebula'),debris=root.getObjectByName('Drifting rocks').children[0];
for(let i=1;i<10;i++)world.update(10+i/30);
assert.equal(debris.count,64,'approved debris density');
assert.equal(nebula.material.uniforms.intensity.value,.8);assert.equal(nebula.material.uniforms.puffiness.value,1);
assert.equal(nebula.material.uniforms.flash.value,0,'cloud flashes start with a quiet interval');
const frozen=Array.from(debris.instanceMatrix.array),cloud=nebula.material.uniforms.cloudTime.value;
world.update(12,{reduced:true});world.update(20,{reduced:true});
assert.deepEqual(Array.from(debris.instanceMatrix.array),frozen,'reduced motion freezes drift in place');
assert.equal(nebula.material.uniforms.cloudTime.value,cloud);assert.equal(nebula.material.uniforms.breath.value,0);
world.update(100);
assert(Math.abs(nebula.material.uniforms.cloudTime.value-cloud-.125)<1e-8,'resume caps hidden-frame time');
assert.equal(nebula.material.uniforms.breath.value,.13);
let gameFlashFrames=0;
for(let i=1;i<=1600;i++){
 world.update(100+i*.05);
 if(nebula.material.uniforms.flash.value>0)gameFlashFrames++;
}
assert(gameFlashFrames>0&&gameFlashFrames<70,'game clock drives sparse cloud flashes');
world.update(181,{reduced:true});assert.equal(nebula.material.uniforms.flash.value,0,'reduced motion suppresses game cloud flashes');
environment.update(100,{lite:true});assert(root.visible&&debris.visible,'Standard retains scenery');

// Acceleration must hit the same visible surface, including the fractured ledges.
const tree=new Octree().fromGraphNode(world.formation),ray=new THREE.Raycaster();
for(let i=0;i<32;i++){
 const a=i*.71,y=-.85-(i%13);ray.set(new THREE.Vector3(Math.cos(a)*32,y,Math.sin(a)*32),new THREE.Vector3(-Math.cos(a),0,-Math.sin(a)));
 const expected=ray.intersectObject(world.formation,false)[0],actual=tree.rayIntersect(ray.ray);
 assert.equal(!!actual,!!expected);if(actual)assert(actual.position.distanceTo(expected.point)<1e-6);
}
tree.clear();
const stormScene=new THREE.Scene();
const storm=createLightning(stormScene,()=>world.formation,()=>RIVEN_WORLD,camera),counts=new Set();
let overlap=0;
for(let n=0;n<16;n++){
 const start=n*20;storm.strike(start);const burst=stormScene.getObjectByName('Transient branching lightning');counts.add(burst.children.length);
 storm.update(start+.001,false);assert.equal(burst.children.filter(b=>b.visible).length,1);
 const previous=new Map();
 for(let step=1;step<50;step++){
  storm.update(start+RIVEN_WORLD.duration*step/50,false);
  if(burst.children.filter(b=>b.visible).length>1)overlap++;
  for(const bolt of burst.children){const t=bolt.userData;assert(t.front.value>=(previous.get(bolt)??t.low));assert(t.front.value<=t.high);previous.set(bolt,t.front.value);}
 }
 for(const bolt of burst.children)assert(bolt.children.every(m=>m.geometry===bolt.children[0].geometry),'core and glow share geometry');
 assert.equal(storm.update(start+RIVEN_WORLD.duration+.001,false),false);
 assert.equal(storm.update(start+.1,true),false);
}
assert.deepEqual([...counts].sort(),[1,2,3]);assert(overlap>0);
storm.hold(true,400);assert(storm.update(401,true));
storm.dispose();
const softStorm=createLightning(stormScene,()=>world.formation,()=>RIVEN_WORLD,camera);
softStorm.strike(0);softStorm.update(.4,false);
for(const bolt of stormScene.getObjectByName('Transient branching lightning').children){
 assert.equal(bolt.children.length,5,'soft neon has feathered glow shells');
 assert(bolt.children.at(-1).userData.base<.5,'soft core is not a hard white line');
}
softStorm.dispose();
let flashFrames=0,events=0,wasLit=false;
for(let t=0;t<300;t+=.05){
 updateNebulaFlashes(nebula,t,{strength:RIVEN_WORLD.nebulaFlashStrength,interval:RIVEN_WORLD.nebulaFlashInterval});
 const lit=nebula.material.uniforms.flash.value>0;if(lit)flashFrames++;if(lit&&!wasLit)events++;wasLit=lit;
 assert(nebula.material.uniforms.flash.value<.7,'cloud flashes remain bounded at the approved strength');
}
assert(events>=4&&events<=10,'cloud flashes are sparse');assert(flashFrames<220,'clouds are quiet for most of five minutes');
triggerNebulaFlash(nebula,310,42,new THREE.Vector3(0,0,-1));
updateNebulaFlashes(nebula,310.3,{strength:.35});assert(nebula.material.uniforms.flash.value>0);
updateNebulaFlashes(nebula,310.4,{strength:.35,reduced:true});assert.equal(nebula.material.uniforms.flash.value,0);
updateNebulaFlashes(nebula,400);assert.equal(nebula.material.uniforms.flash.value,0);
const resources=new Set();root.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});
const released=new Set();for(const resource of resources)resource.addEventListener('dispose',()=>released.add(resource));
world.dispose();world.dispose();
assert.equal(released.size,resources.size,'all owned GPU resources are released');
assert.equal(scene.getObjectByName('Riven World'),undefined);assert.equal(island.visible,true);
environment.dispose();disposeObject(scene);
console.log('Riven World: real model replacement, occlusion, motion, surface queries, staggered lightning and cleanup passed.');
