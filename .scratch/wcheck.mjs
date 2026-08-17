// Guard: does --weights actually reach `evaluate` inside a real match?
// An override that silently does nothing would make the A/B a null result that
// LOOKS like evidence — the worst possible outcome for this experiment.
import { evaluate, weightsFor } from '../src/engine/policies/evaluate.js';
import { makeInitialState } from '../src/engine/state.js';
const cfg={mode:'ffa',startingLives:2,spirits:[
 {id:'cosmic_ronin',name:'R',corner:'blue',num:12,vibe:5,maxVibe:5,speed:5,facing:0},
 {id:'intergalactic_0',name:'Z',corner:'purple',num:44,vibe:4,maxVibe:4,speed:4,facing:0}]};
const st=makeInitialState(cfg,7);
const base=evaluate(st,'cosmic_ronin',{});
const over=evaluate(st,'cosmic_ronin',{weightOverrides:{pressure:0}});
console.log('default pressure weight :', base.weights.pressure);
console.log('overridden              :', over.weights.pressure);
console.log('other rows untouched?   :', base.weights.survival===over.weights.survival && base.weights.kit===over.weights.kit ? 'YES (merge, not replace)' : 'NO — REPLACED, the A/B would be invalid');
console.log('term count preserved?   :', Object.keys(base.weights).length===Object.keys(over.weights).length ? 'YES' : 'NO');
// per-Spirit form
const perSpirit=evaluate(st,'cosmic_ronin',{weightOverrides:{cosmic_ronin:{pressure:9}}});
console.log('per-Spirit form         :', perSpirit.weights.pressure===9 ? 'works' : 'BROKEN');
