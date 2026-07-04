import { useState, useRef, useEffect } from "react";

// ─── 🤘 ROCK GOD STATE ───────────────────────────────────────────────────────
// Endgame boss slice (see data/rockGods.js for the rules; the engine lives in
// the main file's ROCK GOD SYSTEM). Pure state container.
export function useRockGod() {
  // { id, num, hp, maxHp, winded, telegraph:{ attackId,label,warn,hexes,dmg,end? }|null, lastAttack }
  const [rockGod, setRockGod] = useState(null);
  // null | 'spirits' (god fell — Legend crowned) | 'god' (all Spirits KO'd)
  const [bossOutcome, setBossOutcome] = useState(null);
  // seconds left on the acting human's boss clock (null = no clock running)
  const [bossTimer, setBossTimer] = useState(null);
  // set when the clock hits 0 — a fresh-closure effect fires Vengeance + endTurn
  const [bossTimerExpired, setBossTimerExpired] = useState(false);
  // descent marquee — { key } (god identity comes from rockGod)
  const [godBanner, setGodBanner] = useState(null);

  const godSummonedRef = useRef(false);      // one god per game, ever
  const rockGodRef = useRef(null);           // mirror for async/timeout chains
  useEffect(() => { rockGodRef.current = rockGod; }, [rockGod]);

  return {
    rockGod, setRockGod, rockGodRef, godSummonedRef,
    bossOutcome, setBossOutcome,
    bossTimer, setBossTimer,
    bossTimerExpired, setBossTimerExpired,
    godBanner, setGodBanner,
  };
}
