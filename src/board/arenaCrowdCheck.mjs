import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createArenaCrowd} from './arenaCrowd.js';
import {CROWD_LOOK,rowsFor,rowRiseFor,makeGrandstand,disposeGrandstand} from './cosmicFans.js';
import {GLOW_LOOK,glowPose,glowMood,sticksForFan} from './glowSticks.js';
import {isSolidMesh} from './solidLayer.js';
import {CROWD_ROWS_MAX,CROWD_SEATS_PER_ROW,CROWD_DRAWN_MAX,FAN_TOTAL_CAP,FAN_DIEHARD_CAP,
        FAN_CASUAL_CAP,FAN_MULT_CAP,FAN_MULT_MAX,addCasuals,addDiehard} from '../data/gameConstants.js';
import {crowdMultiplier} from './boardHelpers.js';

// ── 🪑 THE SEATS ARE THE CAP (2026-09-22) ────────────────────────────────────
assert.equal(FAN_TOTAL_CAP, CROWD_DRAWN_MAX, 'the fan cap IS the seat count');
assert.equal(FAN_DIEHARD_CAP, FAN_TOTAL_CAP, 'Diehards can fill the whole house');
assert.equal(FAN_CASUAL_CAP, FAN_TOTAL_CAP, 'neither band has a ceiling of its own');
assert.equal(FAN_MULT_CAP, Infinity, 'no declared clamp on the multiplier');
// ⭐ The ceiling is DERIVED now — a full house of Diehards, and nothing else.
assert.equal(FAN_MULT_MAX, crowdMultiplier(FAN_TOTAL_CAP, 0), 'FAN_MULT_MAX is a full house of Diehards');
assert.ok(Math.abs(FAN_MULT_MAX - 13) < 1e-9, `a full house is x13.0, got ${FAN_MULT_MAX}`);
assert.ok(crowdMultiplier(6, 14) > 5.07, 'the old 5.0 clamp no longer bites');
// 🚨 THE ONE THAT MATTERS. `evaluate.js` normalises with (mult-1)/(X-1); against
// the Infinity clamp that is 0 and the bot silently stops valuing fans.
assert.ok(Number.isFinite(FAN_MULT_MAX) && FAN_MULT_MAX > 1,
  'FAN_MULT_MAX is finite and > 1 — anything normalising divides by this, never by the clamp');

// ── 🎟️ ONE HOUSE, TWO BANDS ─────────────────────────────────────────────────
assert.equal(addCasuals({diehards: 2, casuals: 0}, 5), 5, 'room to grow');
assert.equal(addCasuals({diehards: 2, casuals: 0}, 500), FAN_TOTAL_CAP - 2, 'bounded by the seats the Diehards left');
assert.equal(addCasuals({diehards: FAN_TOTAL_CAP, casuals: 0}, 5), 0, 'a full house of Diehards seats no Casuals');
assert.equal(addCasuals({diehards: 10, casuals: 20}, 5), 20, 'a full house takes on nobody');
assert.equal(addDiehard({diehards: 2, casuals: 0}, 1), 3);
assert.equal(addDiehard({diehards: 2, casuals: FAN_TOTAL_CAP - 2}, 1), 2, 'no Diehard without a seat');
// ⭐ Promotion is net-zero, which is HOW a Spirit reaches a full house of Diehards.
let d = 0, c = FAN_TOTAL_CAP;
while (c > 0) { c -= 1; d += 1; }
assert.equal(d, FAN_TOTAL_CAP, 'hardening every Casual fills the house with Diehards');
assert.equal(d + c, FAN_TOTAL_CAP, 'and the total never moves');

// ── 🪑 SEATS ARE NOT FANS ────────────────────────────────────────────────────
assert.equal(rowsFor(1),1);assert.equal(rowsFor(6),1);assert.equal(rowsFor(7),2);
assert.equal(rowsFor(CROWD_DRAWN_MAX),CROWD_ROWS_MAX,'a full house fills every row');
assert.equal(rowsFor(FAN_TOTAL_CAP),CROWD_ROWS_MAX,'a full house is exactly five full rows');
assert.equal(rowsFor(500),CROWD_ROWS_MAX,'and the renderer clamps even if the rules ever do not');
// ⚠️ The engine can no longer produce this, and the renderer must survive it
// anyway: a rules bug should draw a wrong crowd, not hang on an unbounded loop.
const huge=makeGrandstand({corner:'blue',diehards:400,casuals:9});
assert.equal(huge.fans.length,CROWD_DRAWN_MAX,'never draws more than it has seats for');
assert.ok(huge.fans.every(f=>f.name==='Diehard fan'),'a full house of Diehards fills every seat');
const full=makeGrandstand({corner:'red',diehards:FAN_TOTAL_CAP,casuals:0});
assert.equal(full.fans.length,FAN_TOTAL_CAP,'a legal full house is drawn in full');
assert.equal(full.rows,CROWD_ROWS_MAX);

// ── 🎢 THE RAKE CLEARS THE LIGHTING TRUSS ────────────────────────────────────
assert.equal(rowRiseFor(4),CROWD_LOOK.rowRise,'the dialled rake stands at four rows');
assert.ok(rowRiseFor(CROWD_ROWS_MAX)<CROWD_LOOK.rowRise,'five rows bend the rake down');
const topY=rows=>CROWD_LOOK.standLift+
  (0.08+(rows-1)*rowRiseFor(rows)+0.23+0.61*0.49*1.2*CROWD_LOOK.fanScale)*CROWD_LOOK.standScale;
for(let r=1;r<=CROWD_ROWS_MAX;r++)assert.ok(topY(r)<=3.20,`row ${r} clears the truss (${topY(r).toFixed(2)})`);

// ── 📏 THE MEASURED WALLS ────────────────────────────────────────────────────
const L=CROWD_LOOK,anchor=12.22-L.pushOut;
assert.ok(anchor-(L.deckDepth/2)*L.standScale>=11.56,'the front deck clears the board rim');
assert.ok(((CROWD_SEATS_PER_ROW*L.seatPitch+L.deckMargin)*L.standScale)/2<=2.07,'the deck clears the amp cabinets');
assert.ok(0.61*0.49*1.2*L.fanScale*L.standScale>0.9,'a fan is over 0.9m — a third of a standee');

// ── 🎤 THE CROWD IN THE SCENE ────────────────────────────────────────────────
const scene=new THREE.Scene(),crowd=createArenaCrowd(scene);
const roster=[['cosmic_ronin','blue'],['intergalactic_0','purple'],['Metalness_Monster','yellow']]
  .map(([id,corner])=>({id,corner,diehards:2,casuals:3}));
crowd.update(roster);assert.equal(crowd.count,15);
assert.equal(crowd.group.children.length,4,'empty corners retain seating');
assert.ok(crowd.group.getObjectByName('Ronin hachimaki'));
assert.ok(crowd.group.getObjectByName('Intergalactic gold chain'));
assert.ok(crowd.group.getObjectByName('Fan halo'),'every fan carries the owner-coloured halo');
const monsters=[];crowd.group.traverse(o=>{if(o.userData.fanStyle==='monster')monsters.push(o);});
assert.equal(monsters.length,2);
assert.ok(monsters[0].children.some(o=>o.children.some(m=>m.material?.color?.getHexString()==='63ff37')),'Monster green eyes');
const body=monsters[0].getObjectByName('Curled spirit body');
assert.ok(body.geometry.getAttribute('color').getW(500)<.3,'tail fades');
// 📌 Four corners must not be four copies of one crowd.
const seatZero=crowd.group.children.map(stand=>stand.children.find(o=>o.name?.endsWith('fan')));
assert.ok(new Set(seatZero.filter(Boolean).map(f=>f.scale.x.toFixed(4))).size>=1,'stands build independently');
const before=crowd.group.children[0];crowd.update(roster);
assert.equal(crowd.group.children[0],before,'stable crowds do not rebuild');
crowd.tick(1,{reduced:true});const speaker=crowd.speaker('cosmic_ronin');
crowd.tick(5,{reduced:true});
assert.deepEqual(crowd.speaker('cosmic_ronin'),speaker,'reduced motion stays still');
crowd.update([{...roster[0],diehards:1,casuals:0}]);
assert.equal(crowd.count,1);assert.equal(crowd.speaker('intergalactic_0'),null);
crowd.dispose();assert.equal(scene.children.length,0);assert.equal(crowd.count,0);
console.log('PASS: the seats are the cap, seats vs fans, rake under the truss, measured walls, spirit-specific diehards, halos, reduced motion and cleanup');

// ── 🪩 GLOW STICKS (Alex, 2026-09-25: visual only, everyone holds one) ────────
// ⚠️ THE DIAL-IN, VERBATIM. 15 of 23 levers moved on the preview; a port that
// cannot tell "he chose 77" from "he never touched it" enshrines accidents.
const ALEX_GLOW_DIAL_IN={length:.35,thickness:.02,grip:.25,brightness:4.6,haze:.36,hazeSize:3,trail:3,trailFade:.45,
  trailGap:.045,colorMode:'neon',hueJitter:.05,hands:'mix',bothShare:.3,style:'mix',bpm:77,amp:.38,raise:.58,sync:.35,
  idleShare:.46,pulse:.17,winSpeed:1.3,winAmp:1.2,lossDim:.35};
assert.deepEqual({...GLOW_LOOK},ALEX_GLOW_DIAL_IN,'GLOW_LOOK is Alex\'s dial-in');

const lit=makeGrandstand({corner:'blue',color:'#4488ff',diehards:10,casuals:14});
assert.ok(lit.sticks,'stands carry sticks by default');
const holders=new Set();for(let k=0;k<lit.fans.length;k++)holders.add(k);
assert.ok(lit.sticks.count>=lit.fans.length&&lit.sticks.count<=lit.fans.length*2,'every fan holds one or two');
assert.ok(lit.fans.every(f=>f.userData.hands?.length===2&&f.userData.hands.every(h=>h.name==='Fan hand')),'hands are named, not matched by radius');
// ⭐ The whole point of instancing: the draw cost of a stand does not grow with its crowd.
const one=makeGrandstand({corner:'purple',diehards:1,casuals:0}),house=makeGrandstand({corner:'red',diehards:30,casuals:0});
assert.equal(one.sticks.meshes.length,house.sticks.meshes.length,'one fan and a full house cost the same draws');
assert.equal(house.sticks.meshes.length,3+GLOW_LOOK.trail,'core + cap + haze + one per trail ghost');
assert.equal(makeGrandstand({corner:'yellow',glow:null}).sticks,null,'glow:null is the stick-less stand the preview compares against');
// 'mix' really mixes: some fans hold two.
const pairs=Array.from({length:120},(_,s)=>sticksForFan(GLOW_LOOK,s).length);
assert.ok(pairs.includes(1)&&pairs.includes(2),'mix hands: some one, some both');
assert.ok(new Set(Array.from({length:120},(_,s)=>sticksForFan(GLOW_LOOK,s)[0].style)).size===3,'mix style: sway, pump and circle all appear');

// ⭐ THE TRAIL IS THE POSE AT AN EARLIER TIME — not frame history (see glowSticks.js).
const [core,,,ghost0]=lit.sticks.meshes;
lit.tick(2.4);
const M0=glowMood(GLOW_LOOK),mat=new THREE.Matrix4(),want=new THREE.Matrix4();
let checked=0;
for(let k=0,i=0;k<lit.fans.length;k++)for(const st of sticksForFan(GLOW_LOOK,k)){
  const fan=lit.fans[k],rest=new THREE.Vector3(st.sign*CROWD_LOOK.handInset,.24,.035);
  const now=glowPose(GLOW_LOOK,st,rest,2.4,M0);
  if(now.waving){
    const then=glowPose(GLOW_LOOK,st,rest,2.4-GLOW_LOOK.trailGap,M0);
    want.multiplyMatrices(fan.matrix,new THREE.Matrix4().compose(new THREE.Vector3(then.x,then.y,then.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(then.rx,0,then.rz)),new THREE.Vector3(1,1,1)));
    ghost0.getMatrixAt(i,mat);assert.ok(mat.equals(want)||mat.elements.every((v,j)=>Math.abs(v-want.elements[j])<1e-5),'ghost = pose at t − trailGap (float32 buffer)');
    checked++;
  }
  i++;
}
assert.ok(checked>0,'some sticks are waving at idle');
// A win gets the whole stand waving; a loss dims every stick.
const waving=M=>{let w=0;for(let k=0;k<30;k++)for(const st of sticksForFan(GLOW_LOOK,k))w+=glowPose(GLOW_LOOK,st,new THREE.Vector3(),1,M).waving;return w;};
assert.ok(waving(glowMood(GLOW_LOOK,1,1))>waving(glowMood(GLOW_LOOK)),'a win raises more sticks than idle');
const lum=()=>{const c=new THREE.Color();let sum=0;for(let i=0;i<lit.sticks.count;i++){core.getColorAt(i,c);sum+=c.r+c.g+c.b;}return sum;};
lit.tick(3);const idleLum=lum();lit.react(3,-1,1);
assert.ok(lum()<idleLum*(GLOW_LOOK.lossDim+.25),'a loss dims the sticks');
// 🧱 What the solid layer re-draws: the stick, not its glow.
const byName=Object.fromEntries(lit.sticks.meshes.map(m=>[m.name,m]));
assert.ok(isSolidMesh(byName['Glow stick'])&&isSolidMesh(byName['Glow stick cap']),'core and cap are solid');
assert.ok(!isSolidMesh(byName['Glow stick haze'])&&!isSolidMesh(byName['Glow trail']),'haze and trail are glow, never solid');
// ♿ Reduced motion: no trail, and the sticks hold still.
lit.tick(1,{reduced:true});const still=new THREE.Matrix4(),later=new THREE.Matrix4();core.getMatrixAt(0,still);
ghost0.getMatrixAt(0,mat);assert.equal(mat.determinant(),0,'reduced motion hides the trail');
lit.tick(5,{reduced:true});core.getMatrixAt(0,later);assert.ok(still.equals(later),'reduced motion: sticks hold still');
disposeGrandstand(lit);assert.equal(lit.group.parent,null);
for(const s of [one,house,huge,full])disposeGrandstand(s);
console.log('PASS: glow sticks — Alex\'s dial-in, everyone holds one, draws flat in crowd size, trail = earlier pose, win/loss, solid layer, reduced motion');
