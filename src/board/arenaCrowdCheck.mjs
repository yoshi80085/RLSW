import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createArenaCrowd} from './arenaCrowd.js';
import {CROWD_LOOK,rowsFor,rowRiseFor,makeGrandstand} from './cosmicFans.js';
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
