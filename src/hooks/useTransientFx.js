import { useState } from "react";

// ─── TRANSIENT BOARD FX ──────────────────────────────────────────────────────
// Short-lived visual effects layered over the board: knockback slide-off
// animations, respawn flashes, the rumble set, floating damage numbers, and
// status-effect VFX. The code that spawns/clears these lives in Game. Pure slice.
export function useTransientFx() {
  const [slideOffAnimations, setSlideOffAnimations] = useState({});
  const [respawnFlashes, setRespawnFlashes]         = useState({});
  const [rumblingIds, setRumblingIds] = useState(new Set());
  const [floatingDmg, setFloatingDmg] = useState([]);
  // 💥 Status-effect board VFX — { key, spiritId, icon, label, color }
  const [effectFlashes, setEffectFlashes] = useState([]);
  // 🎵 SPENT NOTES — every note that leaves a stack gets a glyph that flies off
  // the standee and fades: Drive notes burned on an attack, Sustain notes
  // frayed off a Spirit that just got hit. Entries are
  // { key, spiritId, note, kind: 'drive'|'sustain', i, n }
  // where i/n index the note within its burst so the fan-out can be staggered.
  const [spentNotes, setSpentNotes] = useState([]);

  return {
    slideOffAnimations, setSlideOffAnimations,
    respawnFlashes, setRespawnFlashes,
    rumblingIds, setRumblingIds,
    floatingDmg, setFloatingDmg,
    effectFlashes, setEffectFlashes,
    spentNotes, setSpentNotes,
  };
}
