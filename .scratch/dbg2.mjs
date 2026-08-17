import { styleGain, styleProgress } from '../src/music/spiritStyle.js';
const R='cosmic_ronin';
console.log('prog CDE 5 ->', styleProgress(R,['C','D','E'],5));
console.log('gain +F  ->', styleGain(R,['C','D','E'],'F',4));
console.log('gain +A# ->', styleGain(R,['C','D','E'],'A#',4));
console.log('gain +F slots0 ->', styleGain(R,['C','D','E'],'F',0));
console.log('prog CDE 1 ->', styleProgress(R,['C','D','E'],1));
console.log('prog CDE 0 ->', styleProgress(R,['C','D','E'],0));
