import { makeInitialState } from '../src/engine/state.js';
import { legalActions, sonicBeam } from '../src/engine/policies/legalActions.js';
import { rigFor } from '../src/engine/systems/attackParams.js';
import { HEX_BY_NUM, HEX_BY_QR } from '../src/board/hexMap.js';
import { axialNeighbors, angleTo } from '../src/board/hexGeometry.js';
import { CORNERS } from '../src/data/corners.js';
const RONIN='cosmic_ronin', ZERO='intergalactic_0', METAL='Metalness_Monster';
const CONFIG = { mode:'ffa', startingLives:3, spirits:[
  { id:RONIN, name:'R', corner:'blue', num:CORNERS.blue.homeNum, vibe:5, maxVibe:5, knockedOut:false, facing:0, speed:5 },
  { id:ZERO,  name:'Z', corner:'purple', num:CORNERS.purple.homeNum, vibe:4, maxVibe:4, knockedOut:false, facing:0, speed:4 },
  { id:METAL, name:'M', corner:'yellow', num:CORNERS.yellow.homeNum, vibe:5, maxVibe:5, knockedOut:false, facing:0, speed:4 },
]};
let st = makeInitialState(structuredClone(CONFIG), 77);
st = { ...st, noteStates: { ...st.noteStates, [RONIN]: { ...st.noteStates[RONIN], hasConfirmed:true } },
       turn: { ...st.turn, moveStepsLeft:4, actionTokenUsed:false } };
const r0 = st.spirits.find(x=>x.id===RONIN);
const here = HEX_BY_NUM[r0.num];
const nb = axialNeighbors(here.q,here.r).map(({q,r})=>HEX_BY_QR[`${q},${r}`]).find(Boolean);
console.log('ronin hex', r0.num, 'nb', nb?.num);
st = { ...st, spirits: st.spirits.map(s => s.id===METAL ? {...s, num:nb.num, facing:angleTo(nb,here)} : s.id===RONIN ? {...s, facing:angleTo(here,nb)} : s) };
const self = st.spirits.find(x=>x.id===RONIN), foe = st.spirits.find(x=>x.id===METAL);
console.log('ronin beam', [...sonicBeam(self)], 'has foe?', sonicBeam(self).has(foe.num));
console.log('foe beam', [...sonicBeam(foe)], 'has ronin?', sonicBeam(foe).has(self.num));
console.log('ronin rig', rigFor(self, st.noteStates[RONIN]));
console.log('foe rig', rigFor(foe, st.noteStates[METAL]));
console.log('kinds', [...new Set(legalActions(st, RONIN, {posing:{}}).map(a=>a.kind))]);
