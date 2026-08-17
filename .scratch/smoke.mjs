import { runMatch, POLICIES } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/policies/play.js';
const spirits = [
  { id:'cosmic_ronin', name:'Shredding Ronin', corner:'blue', num:12, vibe:5, maxVibe:5, speed:5, facing:0 },
  { id:'intergalactic_0', name:'Intergalactic 0', corner:'purple', num:44, vibe:4, maxVibe:4, speed:4, facing:0 },
];
for (const seed of [1,2,3]) {
  const policies = { cosmic_ronin: POLICIES.searcher({}), intergalactic_0: POLICIES.unranked({}) };
  const t0 = Date.now();
  const r = runMatch({ seed, spirits, policies });
  console.log(seed, JSON.stringify({winner:r.winner, turns:r.turns, reason:r.reason, fame:r.fame, anomaly:r.anomaly}), (Date.now()-t0)+'ms');
}
