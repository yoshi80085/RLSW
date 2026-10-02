// ─── 🔊 PYRO SHOVE — the sound (preview entry point) ────────────────────────
// 📌 2026-10-02: the voices moved into the ONE tracked copy,
// `src/audio/pyroSfx.js`, which the game plays through the SFX fader. The
// preview keeps its own AudioContext straight to the speakers (no game mixer on
// this page), created on the first click like before.
import { createPyroSfx } from '../../src/audio/pyroSfx.js';
export function createBlastSfx() {
  let own = null;
  const make = () => { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; return AC ? new AC() : null; };
  return createPyroSfx({ context: () => (own ??= make()), output: c => c.destination });
}
