import assert from 'node:assert/strict';
import { STANDEE_MOVE, planStep } from '../../src/board/standeeMotion.js';
import { shovePlan, shoveAt, reactionAt, laserPush, xyz } from './motion.js';
import { armTurn, pushRival, fireRemaining } from '../stage-pyro/sandbox.js';
import { patterns, PAWNS } from '../stage-lasers/lifecycle.js';
import { soundCues } from '../stage-pyro/audio.js';

const original=armTurn(),pushed=pushRival(original,3),seq=pushed.push;
assert.deepEqual(seq.plan,planStep(seq.step,STANDEE_MOVE));
assert.equal(seq.path.length,2,'three-space push intercepts at step two');
const contact=shoveAt(seq,seq.arrival),target=xyz(pushed.hit);
assert(Math.abs(contact.x-target.x)<1e-9&&Math.abs(contact.z-target.z)<1e-9);
assert.equal(pushed.fireAt[0],seq.arrival,'blast shares the visible contact timestamp');
assert.equal(soundCues({mortars:true},pushed).find(c=>c.type==='launch').at,seq.arrival,'sound shares contact');
assert.equal(fireRemaining(pushed,8,.18).fireAt[0],seq.arrival,'battle cannot refire the impact charge');
assert.equal(reactionAt('pyro',-.001).flash,0);
assert(reactionAt('pyro',.28).y>1);
for(const kind of ['pyro','laser']){
 const recovered=reactionAt(kind,3);assert.equal(recovered.y,0);assert.equal(recovered.ko,0);
 assert.equal(reactionAt(kind,3,{knockdown:true}).ko,1);
 const reduced=reactionAt(kind,.1,{reduced:true});assert.equal(reduced.y,0);assert.equal(reduced.roll,0);assert.equal(reduced.recoil,0);
 for(const strength of [.5,1,1.6])for(const knockdown of [false,true])for(let t=-1;t<4;t+=.01)
  assert(Object.values(reactionAt(kind,t,{strength,knockdown})).filter(v=>typeof v==='number').every(Number.isFinite));
}
const snapshot=shoveAt(seq,3.3);shoveAt(seq,10);assert.deepEqual(shoveAt(seq,3.3),snapshot,'rewind has no accumulated pose');
for(let seed=1;seed<=100;seed++){
 const beams=patterns(seed)[0],hot=new Set(beams.flatMap(b=>b.hexes)),s=laserPush(beams,PAWNS.slice(1));
 assert(s);assert(!hot.has(s.from));assert(!hot.has(s.path[0]));assert(hot.has(s.hit));
 assert(![s.from,...s.path].some(n=>PAWNS.slice(1).includes(n)),'no occupied approach');
 const next=armTurn({seed,positions:pushed.positions,previous:original.hexes});
 assert(next.hexes.every(n=>!pushed.positions.includes(n)&&!original.hexes.includes(n)));
}
console.log('PASS: shared shove timing; contact/blast/audio sync; first-hazard interception; 100 clean laser approaches; no double fire; finite/reduced/KO poses; rewind; occupied-space exclusion.');
