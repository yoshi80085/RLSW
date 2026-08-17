import { startSpiritTurn, playTurn, harnessHooks, POLICIES, matchConfig } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/policies/play.js';
import { makeInitialState } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/state.js';
import { makeRng } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/rng.js';
const spirits = [
  { id:'cosmic_ronin', name:'Shredding Ronin', corner:'blue', num:12, vibe:5, maxVibe:5, speed:5, facing:0 },
  { id:'intergalactic_0', name:'Intergalactic 0', corner:'purple', num:44, vibe:4, maxVibe:4, speed:4, facing:0 },
];
const rng = makeRng(3);
let st = makeInitialState(matchConfig(spirits), 3);
const ctx = { rng, hooks: harnessHooks({ rng }) };
const pol = POLICIES.searcher({});
let v = { posing:{}, amps:[], shadowHex:null, rockGodActive:false };
for (let i=0;i<6;i++){
  st = startSpiritTurn(st, rng);
  const seat = st.acting;
  const t = playTurn(st, v, pol, ctx);
  st = t.state; v = t.view;
  const counts = {};
  for (const a of t.actions) counts[a.kind] = (counts[a.kind]??0)+1;
  console.log(seat, 'n='+t.actions.length, JSON.stringify(counts), 'stalled='+!!t.stalled, 'fame='+(st.noteStates[seat].fame??0), 'db='+(st.noteStates[seat].dbPoints??0), 'ap='+st.turn.moveStepsLeft);
  if (t.refused) console.log('  REFUSED', JSON.stringify(t.refused));
}
