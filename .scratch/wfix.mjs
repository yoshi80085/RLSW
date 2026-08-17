import { weightsFor } from '../src/engine/policies/evaluate.js';
const per = { intergalactic_0: { pressure: 2.5 } };
console.log('ronin pressure under per-Spirit override:', weightsFor('cosmic_ronin', per).pressure);
console.log('zero  pressure under per-Spirit override:', weightsFor('intergalactic_0', per).pressure);
console.log('ronin has junk key?', 'intergalactic_0' in weightsFor('cosmic_ronin', per));
console.log('flat still works:', weightsFor('cosmic_ronin', { pressure: 9 }).pressure);
