import { useState } from "react";

// ─── 🤘 ROCK GOD STATE ───────────────────────────────────────────────────────
// Endgame boss slice (see data/rockGods.js for the rules; the reducers live in
// engine/systems/rockGod.js). Phase 6c FLIP: the god object, the one-per-game
// flag, and the fight outcome are ENGINE state now (engineState.rockGod) — the
// rockGodRef/godSummonedRef mirrors dissolved with them. What remains here is
// pure presentation: the boss clock (the timer is CLIENT; expiry dispatches
// GOD_TIMER_EXPIRED) and the descent marquee.
export function useRockGod() {
  // seconds left on the acting human's boss clock (null = no clock running)
  const [bossTimer, setBossTimer] = useState(null);
  // set when the clock hits 0 — a fresh-closure effect fires Vengeance + endTurn
  const [bossTimerExpired, setBossTimerExpired] = useState(false);
  // descent marquee — { key } (god identity comes from the engine slice)
  const [godBanner, setGodBanner] = useState(null);

  return {
    bossTimer, setBossTimer,
    bossTimerExpired, setBossTimerExpired,
    godBanner, setGodBanner,
  };
}
