// node .scratch/pyro-shove/check.mjs — 📌 2026-10-02: the pure module was ported,
// and so were its assertions. ONE copy: this runs the tracked suite
// (`npm run test:pyroshove`, src/board/pyroShoveCheck.mjs), which keeps every
// assertion that lived here (§1) and adds the dial-in, the show clock, the show
// timeline, Astra's mortars and the sound.
await import('../../src/board/pyroShoveCheck.mjs');
