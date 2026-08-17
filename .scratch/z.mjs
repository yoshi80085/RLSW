import { runMatch, POLICIES } from '../src/engine/policies/play.js';
const DUEL=[{id:'cosmic_ronin',name:'R',corner:'blue',num:12,vibe:5,maxVibe:5,speed:5,facing:0},
            {id:'intergalactic_0',name:'Z',corner:'purple',num:44,vibe:4,maxVibe:4,speed:4,facing:0}];
for (const pv of [1.3, 1.7, 2.0, 2.5]) {
  let turns=0,dec=0,fame=0;
  for(let i=0;i<12;i++){
    const policies=Object.fromEntries(DUEL.map(s=>[s.id,POLICIES.searcher({})]));
    const r=runMatch({seed:((i)*2654435761+12345)>>>0, spirits:DUEL, policies,
                      view:{weightOverrides:{intergalactic_0:{pressure:pv}}}});
    turns+=r.turns; if(r.winner)dec++; fame+=Object.values(r.fame??{}).reduce((a,b)=>a+b,0);
  }
  console.log('Z pressure', pv, 'turns', Math.round(turns/12), 'decided', dec+'/12', 'FP/turn', (fame/turns).toFixed(3));
}
