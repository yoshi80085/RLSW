// =============================================================================
// engine/policies/playFinder.worker.js  —  🧵 the finder, off the main thread
// -----------------------------------------------------------------------------
// A full hand costs 0.2–1.3 s to prove (measured 2026-09-16), which is far too
// slow for a render path: the crowd would freeze the arena every time a note is
// placed. `ui/CrowdBubble.jsx` → `useCrowdCoach` posts the note sheet here and
// ignores any answer whose `id` is not the latest it asked for.
//
// ⚠️ NO LOGIC OF ITS OWN. It calls `findBestPlays` and posts the result, so the
// worker and the headless suites can never disagree about a hand.
// =============================================================================
import { findBestPlays } from "./playFinder.js";

self.onmessage = (event) => {
  const { id, spiritId, ns, goals } = event.data ?? {};
  try {
    self.postMessage({ id, plays: findBestPlays(spiritId, ns, { goals }) });
  } catch (error) {
    // A throw here must not silence the crowd forever: answer, and say why.
    self.postMessage({ id, plays: null, error: String(error?.message ?? error) });
  }
};
