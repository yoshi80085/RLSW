import { useState } from "react";

// ─── FAN ECONOMY ─────────────────────────────────────────────────────────────
// Owns the crowd / limelight / spotlight state slice: accumulated pose turns,
// the per-turn posing flags, the "Unsure" floating crowd + its won-over burst,
// transient fan reactions, and the roaming spotlight hex.
// `spotlightPool` is passed in (it derives from the board hex map) so this hook
// stays decoupled from module-level board data.
// Pure state slice — values + setters only; the driving logic stays in Game.
export function useFanEconomy(spotlightPool) {
  // limelightScores: { [spiritId]: number } — accumulated pose turns (never resets)
  const [limelightScores, setLimelightScores] = useState({});
  // posing: { [spiritId]: boolean } — currently posing this turn end
  const [posing, setPosing] = useState({});
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
    limelightScores, setLimelightScores,
    posing, setPosing,
    unsurePool, setUnsurePool,
    unsureFx, setUnsureFx,
    fanFx, setFanFx,
    spotlightHex, setSpotlightHex,
  };
}
