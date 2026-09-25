// The gated clock is four lines and it is the load-bearing four lines of the
// whole staged sequence: if it runs while nobody has pressed, the second half
// of a battle plays to an empty gate; if it jumps, the first Spirit's dice
// visibly snap. Both failures look like rendering bugs, so they get assertions.
import assert from 'node:assert/strict';
import {gatedSequenceTime,waitingAtGate,ROLL_GATE} from './battleRollGate.js';

const gate=5;
const at=(now,firstAt,secondAt)=>gatedSequenceTime({now,firstAt,secondAt,gate});

// Nothing has been thrown yet.
assert.equal(at(1000,null,null),0,'the clock is zero until the first Spirit throws');
assert.equal(at(9e9,null,4000),0,'a second press without a first is still zero');
assert.equal(waitingAtGate({now:1000,firstAt:null,secondAt:null,gate}),false,'nothing waits before the first throw');

// Running up to the gate.
assert.equal(at(1000,1000,null),0);
assert.equal(at(3500,1000,null),2.5,'before the gate it is ordinary wall time');
assert.equal(at(6000,1000,null),gate,'it reaches the gate exactly');

// ⚠️ THE HOLD. This is the assertion the design exists for.
for(const now of [6000,6001,8000,20000,600000])
  assert.equal(at(now,1000,null),gate,`the clock HOLDS at the gate — ${now}ms`);
assert.equal(waitingAtGate({now:20000,firstAt:1000,secondAt:null,gate}),true,'and reports that it is waiting');
assert.equal(waitingAtGate({now:3000,firstAt:1000,secondAt:null,gate}),false,'but not before it gets there');
assert.equal(waitingAtGate({now:20000,firstAt:1000,secondAt:19000,gate}),false,'nor once the second Spirit has thrown');

// Resuming. A press after a long wait costs the sequence nothing.
assert.equal(at(20000,1000,20000),gate,'the resumed clock starts from the gate, not from wall time');
assert.equal(at(22500,1000,20000),gate+2.5,'and then advances at wall rate');
assert.equal(at(20000,1000,20000),at(6000,1000,6000),'a 14-second wait and no wait reach the same beat');

// ⚠️ NEVER BACKWARDS, AND NEVER A JUMP. An early press — a bot, a replay, a
// click that beat its own prompt — must not skip the rest of the hold.
assert.equal(at(3000,1000,3000),gate,'an early press resumes AT the gate rather than jumping the clock to it');
assert.equal(at(4000,1000,3000),gate,'…and stays there until the gate would have been reached anyway');
assert.equal(at(6000,1000,3000),gate,'…arriving exactly on time');
assert.equal(at(7000,1000,3000),gate+1,'…then running on');
let previous=-1;
for(const secondAt of [null,2000,3000,6000,9000,15000])
  for(let now=1000;now<=25000;now+=37){
    const t=at(now,1000,secondAt);
    assert.ok(t>=0,'the clock is never negative');
  }
for(let now=1000;now<=25000;now+=37){
  const t=at(now,1000,9000);
  assert.ok(t>=previous-1e-9,'the clock never runs backwards across the press');previous=t;
}

// Both battle types have a gate, and it is after their first pool has landed.
assert.ok(ROLL_GATE.sonic>3.85,'the Sonic gate is after the Sustain pool has landed');
// ⭐ Alex 2026-09-24: the shield's charge shot holds "at least a second or 2".
// The gate is when the attacker may throw, so it is what ends that shot.
assert.ok(ROLL_GATE.sonic-3.85>=2,'the Rival\'s shield shot holds at least two seconds before the attacker may throw');
console.log('Battle roll gate: hold, resume, early press, monotonicity and both gates passed.');
