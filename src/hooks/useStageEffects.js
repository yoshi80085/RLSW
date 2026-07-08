import { useState } from "react";

// ─── 🎇 STAGE EFFECTS STATE ──────────────────────────────────────────────────
// Board-level show hazards fired at Fame thresholds (see data/stageEffects.js).
// Phase 6b FULL FLIP: the deck, fired thresholds, AND the active effects
// (smoke/laser/pyro/animatronics) all live in the ENGINE now
// (engineState.stageFx — see engine/systems/stageFx.js). The only client state
// left is the activation marquee, which is pure presentation.
export function useStageEffects() {
  // Activation marquee — { id, threshold, key }, auto-cleared after a few seconds
  const [stageFxBanner, setStageFxBanner] = useState(null);

  return { stageFxBanner, setStageFxBanner };
}
