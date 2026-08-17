import { useState } from "react";

// ─── FAN ECONOMY ─────────────────────────────────────────────────────────────
// Owns the crowd / spotlight state slice: the "Unsure" floating crowd + its
// won-over burst, transient fan reactions, and the roaming spotlight hex.
//
// 🪦 `limelightScores` and `posing` LEFT ON 2026-08-17 (§6.6.8). They are engine
// state now — `engine/systems/limelight.js` — because a pose that lives in React
// is a pose no engine rule can read, which is exactly why a headless match could
// strike one and never be paid for it.
// `spotlightPool` is passed in (it derives from the board hex map) so this hook
// stays decoupled from module-level board data.
// Pure state slice — values + setters only; the driving logic stays in Game.
export function useFanEconomy(spotlightPool) {
  // 🎤 Unsure crowd — fans that fled a demolition, pooled on the centre, up for grabs.
  const [unsurePool, setUnsurePool] = useState(0);
  // ❓ Transient "won over!" burst — the Unsure crowd cheering and streaming to a Spirit's home.
  const [unsureFx, setUnsureFx] = useState(null); // { key, spiritId, n, color }
  // 🎤 Transient fan reaction at a Spirit's home corner — a gain burst or a scatter.
  const [fanFx, setFanFx] = useState({});
  // Spotlight: roaming searchlight hex that heals +1 Vibe on landing
  const [spotlightHex, setSpotlightHex] = useState(
    () => spotlightPool[Math.floor(Math.random() * spotlightPool.length)]
  );

  return {
    unsurePool, setUnsurePool,
    unsureFx, setUnsureFx,
    fanFx, setFanFx,
    spotlightHex, setSpotlightHex,
  };
}
