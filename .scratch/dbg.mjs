import { runMatch, POLICIES } from '/sessions/rcw-011ukay4gclsrpbv9ruq7ygy/mnt/rlsw-sim/src/engine/policies/play.js';
const spirits=[
 {id:'cosmic_ronin',name:'R',corner:'blue',num:12,vibe:5,maxVibe:5,speed:5,facing:0},
 {id:'intergalactic_0',name:'Z',corner:'purple',num:44,vibe:4,maxVibe:4,speed:4,facing:0},
 {id:'Metalness_Monster',name:'M',corner:'yellow',num:28,vibe:5,maxVibe:5,speed:4,facing:0}];
const r=runMatch({seed:4242,spirits,policies:Object.fromEntries(spirits.map(s=>[s.id,POLICIES.searcher({})]))});
console.log(JSON.stringify({winner:r.winner,turns:r.turns,reason:r.reason,fame:r.fame}));
