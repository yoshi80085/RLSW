import { useState } from "react";

// ─── 🎇 STAGE EFFECTS STATE ──────────────────────────────────────────────────
// Board-level show hazards fired at Fame thresholds (see data/stageEffects.js).
// Pure state slice — activation / ticking / damage live in Game. Phase 6b: the
// deck (seeded shuffle) and the fired-thresholds guard moved into the ENGINE
// (state.stageFx + STAGE_FX_DRAWN); only the live-effect visuals remain here.
export function useStageEffects() {
  // 💨 { radius, roundsLeft } — cloud around the Limelight, +1 ring per round
  const [smokeFx, setSmokeFx] = useState(null);
  // 🔺 { beams:[{axis,val,hexes}], roundsLeft, key } — re-patterns every round
  const [laserFx, setLaserFx] = useState(null);
  // 🎆 { phase:'arming'|'erupting', hexes:[nums], wave } — per-turn cadence
  const [pyroFx, setPyroFx] = useState(null);
  // 🤖 [{ key, num, turnsLeft }] — step toward the nearest Spirit each turn
  const [animatronics, setAnimatronics] = useState([]);
  // Activation marquee — { id, threshold, key }, auto-cleared after a few seconds
  const [stageFxBanner, setStageFxBanner] = useState(null);

  return {
    smokeFx, setSmokeFx,
    laserFx, setLaserFx,
    pyroFx, setPyroFx,
    animatronics, setAnimatronics,
    stageFxBanner, setStageFxBanner,
  };
}
