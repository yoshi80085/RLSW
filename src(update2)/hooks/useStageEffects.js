import { useState, useRef } from "react";
import { shuffledStageFxDeck } from "../data/stageEffects.js";

// ─── 🎇 STAGE EFFECTS STATE ──────────────────────────────────────────────────
// Board-level show hazards fired at Fame thresholds (see data/stageEffects.js).
// Pure state slice — activation / ticking / damage live in Game. The deck is
// shuffled once per game; firedRef guarantees each threshold fires exactly once
// even inside async grantFame chains.
export function useStageEffects() {
  const [stageFxDeck] = useState(() => shuffledStageFxDeck());
  const firedRef = useRef(new Set());          // thresholds already fired (sync guard)

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
    stageFxDeck, stageFxFiredRef: firedRef,
    smokeFx, setSmokeFx,
    laserFx, setLaserFx,
    pyroFx, setPyroFx,
    animatronics, setAnimatronics,
    stageFxBanner, setStageFxBanner,
  };
}
