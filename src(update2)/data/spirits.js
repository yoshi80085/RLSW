// ─── SPIRIT DEFINITIONS ───────────────────────────────────────────────────────
// STAT TRIO (locked): Drive = attack · Sustain = defense · Vibe = health.
// vibe / maxVibe = current / max health (damage capacity before Knocked Down).
// Style: Shred = high Drive | Flair = high Sustain | Groove = balanced lean-Sustain.
// Speed: 4–6 — max hexes of movement per turn.
import glamarchy from "../standees/Glamarchy.png";
import cosmic_ronin from "../standees/Cosmic_Ronin.png";
import intergalactic_0 from "../standees/Intergalactic_0.png";
import metalness_monster from "../standees/Metalness_Monster.png";

export const SPIRIT_DEFS = {
  "cosmic_ronin":      { id:"cosmic_ronin",      name:"Shredding Ronin",      imageSrc:cosmic_ronin,      color:"#4488ff", vibe:5, maxVibe:5, knockedOut:false, style:"Shred",  drive:8, sustain:5, speed:5 },
  "intergalactic_0":   { id:"intergalactic_0",   name:"Intergalactic 0",   imageSrc:intergalactic_0,   color:"#aa55ff", vibe:4, maxVibe:4, knockedOut:false, style:"Groove", drive:6, sustain:7, speed:4 },
  "Metalness_Monster": { id:"Metalness_Monster", name:"Metalness Monster", imageSrc:metalness_monster, color:"#ffcc00", vibe:5, maxVibe:5, knockedOut:false, style:"Shred",  drive:7, sustain:6, speed:4 },
  "Glamarchy":         { id:"Glamarchy",         name:"Glamarchy",         imageSrc:glamarchy,         color:"#ff6600", vibe:4, maxVibe:4, knockedOut:false, style:"Flair",  drive:5, sustain:8, speed:5 },
};

export const SPIRIT_OPTIONS = Object.values(SPIRIT_DEFS);
