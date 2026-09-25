// Headless geometry check for the STAGED Swing clash: attacker rolls, raises
// (Figure 1), own amp fires; then the Rival; then both strike (Figure 2).
//
// ⚠️ EVERY ASSERTION BELOW IS ABOUT ORDER, because order is the entire change.
// The totals, the damage and the poses were all correct before it too — what
// was wrong was that both cabinets lit at once off dice that had been thrown
// together, and nothing in the suite could tell.
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createSwingClashVisuals,createClashFigure,swingBeamPower,SWING_BEAM} from './swingClashVisuals.js';
import {SWING_TIMING as T,SWING_DICE,SWING_BEATS,SWING_CHARGED} from './swingTiming.js';

const points=[new Vector3(-2,.2,0),new Vector3(2,.2,0)];
const origins=[new Vector3(-8,1,-4),new Vector3(8,1,-4)];
const build=battle=>createSwingClashVisuals({battle,attacker:{num:0,color:'#ff6644'},
  defender:{num:1,color:'#44aaff'},pointFor:n=>points[n].clone(),ampOrigins:origins});
const make=(atk,def,sides=6)=>({diceVals:atk,defenderDiceVals:def,
  dicePool:atk.map(()=>sides),defenderDicePool:def.map(()=>sides),
  atkTotal:atk.reduce((a,b)=>a+b,0),defTotal:def.reduce((a,b)=>a+b,0),
  damage:Math.abs(atk.reduce((a,b)=>a+b,0)-def.reduce((a,b)=>a+b,0)),
  tied:atk.reduce((a,b)=>a+b,0)===def.reduce((a,b)=>a+b,0),attackerWon:true});

// ── The beats are ordered, and the Rival's never precede the attacker's ─────
assert.ok(T.roll<T.attackerRead,'the attacker reads after they throw');
assert.ok(T.attackerRead<T.attackerRaise,'the raise follows the landing');
assert.ok(T.attackerRaise<T.attackerAmp,'the amp fuels an instrument that is already up');
assert.ok(T.attackerAmp<T.rival,"the attacker is fuelled before the Rival is asked to throw");
assert.ok(T.rival<T.rivalRead&&T.rivalRead<T.rivalRaise&&T.rivalRaise<T.rivalAmp,'the Rival runs the same three beats');
assert.ok(T.rivalAmp<T.read,'both sides are fuelled before the totals are read');
assert.ok(T.read<T.clash&&T.clash<T.result&&T.result<T.close,'read, clash, resolve, close');
assert.equal(T.rival,SWING_DICE.gate,'the Rival throws at the gate');
assert.deepEqual(SWING_DICE.poolStart,[0,T.rival],'the dice are built with the attacker first');
const beats=SWING_BEATS.map(([at])=>at);
assert.deepEqual(beats,[...beats].sort((x,y)=>x-y),'the beat table is in time order');
assert.ok(SWING_BEATS.some(([,name])=>name==='swing_rival'),'the gate has a phase of its own');
// ⚠️ A cabinet is only charged AFTER its own Spirit has thrown.
for(const phase of SWING_CHARGED.rival)assert.ok(SWING_CHARGED.attacker.includes(phase),
  'anything that charges the Rival charges the attacker too — they threw first');
assert.ok(!SWING_CHARGED.rival.includes('swing_attacker_charge'),
  "the Rival's cabinet is dark while the attacker is the only one who has rolled");

// ── The beam carries the roll, against its own ceiling ──────────────────────
assert.equal(swingBeamPower(18,[6,6,6]),1,'a maximum roll is full power');
assert.equal(swingBeamPower(3,[6,6,6]),1/6,'a minimum roll is not zero power');
assert.equal(swingBeamPower(0,[]),0,'an empty pool has no ceiling and no beam');
assert.equal(swingBeamPower(12,[6,6]),1,'12 on two d6 is as strong as 18 on three');
assert.ok(swingBeamPower(12,[6,6])>swingBeamPower(12,[6,6,6]),
  'the SAME total is a bigger beam from a smaller pool — the ceiling is the side\'s own');
let previous=-1;
for(const total of [3,6,9,12,15,18]){
  const p=swingBeamPower(total,[6,6,6]);assert.ok(p>previous,'power rises with the roll');previous=p;
}

// ── One clash, frame by frame ──────────────────────────────────────────────
{
  const battle=make([6,5,6],[2,3]);          // 17 of 18 vs 5 of 12
  const v=build(battle);
  const pose=i=>[v.figures[i].idle,v.figures[i].ready,v.figures[i].strike].findIndex(f=>f.visible);
  const IDLE=0,READY=1,STRIKE=2;

  v.update(0);
  assert.deepEqual([pose(0),pose(1)],[IDLE,IDLE],'both start with the instrument down');
  assert.ok(v.figures.every(f=>!f.beam.visible),'no cabinet fires before a die has landed');

  v.update(T.attackerRaise+SWING_BEAM.raiseTime);
  assert.equal(pose(0),READY,'the attacker raises once their dice are down (Figure 1)');
  assert.equal(pose(1),IDLE,"the Rival has not raised — they have not thrown");

  v.update(T.attackerAmp-1e-3);
  assert.equal(v.figures[0].beam.visible,false,'the amp waits for the raise to finish');
  v.update(T.attackerAmp);
  assert.equal(v.figures[0].beam.visible,true,"the attacker's amp fires into the raised instrument");
  assert.equal(v.figures[1].beam.visible,false,"⚠️ THE RIVAL'S CABINET IS STILL DARK — it has nothing to fuel yet");

  // The Rival's dice do not exist on the floor until the Rival throws.
  v.update(T.rival-1e-3);
  assert.ok(v.dice.entries.filter(e=>e.pool===1).every(e=>!e.die.group.visible),"the Rival's dice wait for the gate");
  assert.ok(v.dice.entries.filter(e=>e.pool===0).every(e=>e.die.group.visible),"the attacker's are already down");

  v.update(T.rivalRaise+SWING_BEAM.raiseTime);
  assert.equal(pose(1),READY,'the Rival raises the same way');
  v.update(T.rivalAmp);
  assert.ok(v.figures.every(f=>f.beam.visible),'both cabinets are lit once both have rolled');

  // The stronger roll draws the bigger beam, and both are within the tuning.
  const [atkBeam,defBeam]=v.figures.map(f=>f.beam.scale.x);
  assert.ok(atkBeam>defBeam,'17 of 18 out-draws 5 of 12');
  for(const s of [atkBeam,defBeam]){
    assert.ok(s>=SWING_BEAM.minScale-1e-9&&s<=SWING_BEAM.maxScale+1e-9,'every beam is inside the tuning');
  }
  // ⚠️ READ AT `T.read`, WHERE BOTH ARE FULLY FUELLED. Compared at the Rival's
  // amp beat the attacker is brighter anyway — they have been charging for six
  // seconds — so the assertion would pass with the roll term deleted entirely.
  v.update(T.read);
  const glow=v.figures.map(f=>f.ready.userData.material.emissiveIntensity);
  assert.ok(glow[0]>glow[1]+.5,'at equal charge, the bigger roll glows brighter');
  assert.ok(glow[0]-glow[1]>(v.figures[0].power-v.figures[1].power)*SWING_BEAM.glow*.9,
    'the whole gap between the two glows comes from the rolls');

  v.update(T.clash);
  assert.deepEqual([pose(0),pose(1)],[STRIKE,STRIKE],'both strike together (Figure 2)');
  v.update(T.result);
  assert.ok(v.figures.every(f=>!f.beam.visible),'the beams are spent once the clash resolves');

  // Nothing shakes before it has been fuelled — the tell for a mis-wired beat.
  // (`===` not `assert.equal`: an un-shaken carrier reads -0, which Object.is
  // — and therefore strict assert — calls a different number from 0.)
  for(let t=0;t<T.attackerAmp;t+=.05){v.update(t);
    assert.ok(v.figures[1].carrier.rotation.z===0,'the Rival is still before they have rolled');}
  v.dispose();v.dispose();
}

// ── The camera follows whoever is acting ───────────────────────────────────
{
  const v=build(make([4,4],[4,4]));
  const at=t=>{const f=v.update(t);return f.kind;};
  assert.equal(at(1),'dice',"it watches the attacker's dice in the air");
  assert.equal(at(T.attackerRaise+.1),'face','then the attacker raising');
  assert.equal(at(T.rival-.05),'face','then across to the Rival, who is about to throw');
  assert.equal(at(T.rival+1),'dice',"then the Rival's dice");
  assert.equal(at(T.rivalRaise+.1),'face','then the Rival raising');
  assert.equal(at(T.read),'result','then the totals');
  assert.equal(at(T.clash),'clash','then the strike');
  for(const t of [0,T.attackerAmp,T.rival,T.read,T.clash,T.result]){
    const f=v.update(t);
    assert.ok(f.points?.length||f.point,`the camera always has something to frame at ${t}`);
  }
  v.dispose();
}

// ── A tie, a one-die pool and reduced motion all survive ───────────────────
{
  const tie=build(make([3,3],[3,3]));
  tie.update(T.read);
  assert.equal(tie.figures[0].beam.scale.x,tie.figures[1].beam.scale.x,'an even clash draws even beams');
  tie.update(T.clash,{reduced:true});
  assert.ok(tie.figures.every(f=>f.carrier.rotation.z===0),'reduced motion holds both Spirits still');
  tie.dispose();
  const single=build(make([6],[1]));
  single.update(T.rivalAmp);
  assert.ok(single.figures[0].beam.scale.x>single.figures[1].beam.scale.x,'a single die still scales its beam');
  single.dispose();
}

// ── The three poses are three different figures ────────────────────────────
{
  const [idle,ready,strike]=['idle','ready','strike'].map(p=>createClashFigure('#ffffff',p));
  assert.equal(createClashFigure('#fff').userData.pose,'ready','the default pose is Figure 1');
  assert.equal(createClashFigure('#fff',true).userData.pose,'strike','`true` is still Figure 2');
  assert.equal(createClashFigure('#fff',false).userData.pose,'ready','`false` is still Figure 1');
  const tip=f=>f.children.find(c=>c.geometry?.type==='BoxGeometry')?.position.clone();
  assert.ok(tip(ready).y>tip(idle).y+.8,'Figure 1 holds the instrument well above the idle pose');
  assert.ok(tip(strike).z>tip(ready).z+.9,'Figure 2 drives it forward instead of up');
  assert.ok(tip(idle).y<1.2,'the idle pose holds it low, so the raise is worth watching');
}
console.log('Swing clash: staged beats, per-side raise and amp, roll-scaled beams, camera order and three poses passed.');
