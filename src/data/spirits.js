// ─── SPIRIT DEFINITIONS ───────────────────────────────────────────────────────
// STAT TRIO (locked): Drive = attack · Sustain = defense · Vibe = health.
// vibe / maxVibe = current / max health (damage capacity before Knocked Down).
// Style: Shred = high Drive | Flair = high Sustain | Groove = balanced lean-Sustain.
// Speed: 4–6 — max hexes of movement per turn.
import glamarchy from "../standees/Glamarchy.png";
import cosmic_ronin from "../standees/cosmic_ronin.png";
import intergalactic_0 from "../standees/Intergalactic_0.png";
import metalness_monster from "../standees/Metalness_monster.png";

export const SPIRIT_DEFS = {
  "cosmic_ronin":      { id:"cosmic_ronin",      name:"Shredding Ronin",      imageSrc:cosmic_ronin,      color:"#4488ff", vibe:5, maxVibe:5, knockedOut:false, style:"Shred",  drive:8, sustain:5, speed:5 },
  "intergalactic_0":   { id:"intergalactic_0",   name:"Intergalactic 0",   imageSrc:intergalactic_0,   color:"#aa55ff", vibe:4, maxVibe:4, knockedOut:false, style:"Groove", drive:6, sustain:7, speed:4 },
  "Metalness_Monster": { id:"Metalness_Monster", name:"Metalness Monster", imageSrc:metalness_monster, color:"#ffcc00", vibe:5, maxVibe:5, knockedOut:false, style:"Shred",  drive:7, sustain:6, speed:4 },
  "Glamarchy":         { id:"Glamarchy",         name:"Glamarchy",         imageSrc:glamarchy,         color:"#ff6600", vibe:4, maxVibe:4, knockedOut:false, style:"Flair",  drive:5, sustain:8, speed:5 },
};

export const SPIRIT_OPTIONS = Object.values(SPIRIT_DEFS);

// Roster order + lock state for the select screen. Spirits not in
// UNLOCKED_DEFAULT render as "?" tiles until unlocked at runtime.
export const ROSTER_ORDER = Object.keys(SPIRIT_DEFS);
export const UNLOCKED_DEFAULT = [...ROSTER_ORDER]; // all 4 launch spirits

// ─── IN DEVELOPMENT ──────────────────────────────────────────────────────────
// Spirits whose kits aren't built out yet. They stay in SPIRIT_DEFS (art,
// stats and the tutorial's roster page all still reference them) but they are
// NOT playable: grayed out in the select screen, never handed to a bot, and
// excluded from Testing Grounds. This is a HARD lock, not the soft "?" that
// UNLOCKED_DEFAULT drives — that one is for unlockables, this one is for
// "we haven't finished writing this character".
// Delete an id from this set the moment its kit lands.
// intergalactic_0 was released 2026-08-08: innates (Rolls Hard, Freestyle,
// +1 Sustain) plus a full four-skill arsenal — Blaster of Ra, Space is
// Displaced, Gravity Control, Sunbeam. Glamarchy is still a stat block with
// no kit at all, so she stays locked.
export const IN_DEVELOPMENT = new Set(["Glamarchy"]);

/** Ids that can actually be taken into a match, in roster order. */
export const PLAYABLE_ORDER = ROSTER_ORDER.filter(id => !IN_DEVELOPMENT.has(id));

/** True when this Spirit is finished enough to play. */
export function isPlayable(id) { return !IN_DEVELOPMENT.has(id); }

// How many corners a match can actually fill — every Spirit is unique per
// match, so the playable roster is a hard ceiling on player count.
export const MAX_PLAYERS = Math.min(4, PLAYABLE_ORDER.length);
