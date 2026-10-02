// ─── Pyrotechnics — stage study 03 (Astra) ──────────────────────────────────
// 📌 2026-10-02: the mortars, blasters and spark curtain moved into the ONE
// tracked copy, `src/board/pyroMortars.js` (the game imports it too). This file
// keeps the study's old entry point so preview.js / sandbox.js and the
// pyro-shove preview run unchanged: the whole show, blasters and curtain ON,
// with a particle pool big enough for the Spark density slider's top (1.8).
// The look is unchanged — `.scratch/stage-pyro/parity` in the port's report
// compared the two copies frame by frame.
import { createPyroMortars, point } from '../../src/board/pyroMortars.js';
export { point };
export function createPyro(scene, nums) {
  return createPyroMortars(scene, nums, { cannons: true, curtain: true, maxDensity: 1.8 });
}
