// ─── STANCES v2 — ability kits (STANCE_V2_HANDOFF.md) ─────────────────────────
// v1 passive modifiers (fray math, Fame multipliers, Groove counter) are CUT.
// v2 stances grant named special attacks + passive + commit Db generator.
// This file currently holds only identity data (pose, icon, color, tagline).
// Kit metadata (button labels, costs, tooltips) will be added in the next phase.
//
// Three stances (Groove is cut):
//   Solo      — Emotional / Shredding
//   Low Slung — Cool
//   Wide Leg  — Power

export const STANCE_DEFS = {
  solo: {
    id: 'solo', label: 'Solo', pose: 'Emotional / Shredding', icon: '🎸', color: '#ffd700',
    tagline: 'Every note tells a story.',
    blurb: 'Emotional shredding — Hammer-On, Pinch Harmonic, Bend. Icons: Vai, Satriani, Petrucci.',
  },
  low_slung: {
    id: 'low_slung', label: 'Low Slung', pose: 'Cool', icon: '🕶️', color: '#44aaff',
    tagline: 'Less notes. More attitude.',
    blurb: 'Cool efficiency — Rake, Power Chord, Slide. Icons: Slash, Johnny Ramone, Billie Joe.',
  },
  wide_leg: {
    id: 'wide_leg', label: 'Wide Leg', pose: 'Power', icon: '🤘', color: '#ff4444',
    tagline: 'Every chord hits like a freight train.',
    blurb: 'Raw power — Axe Swing, Gallop, Thrash. Icons: Hetfield, Zakk Wylde, Dimebag.',
  },
};

// Starting stance per spirit (fixed for the whole match — no switching, no learning).
export const STARTING_STANCE = {
  cosmic_ronin:      'solo',      // Shredding Ronin → Solo
  Glamarchy:         'low_slung', // Glamarchy → Low Slung
  intergalactic_0:   'low_slung', // Intergalactic 0 → Low Slung
  Metalness_Monster: 'wide_leg',  // Metalness Monster → Wide Leg
};

/** The spirit's stance — fixed per spirit, derived from STARTING_STANCE. */
export function stanceOf(ns, spiritId) {
  return STARTING_STANCE[spiritId] ?? 'low_slung';
}

/**
 * Chord-fray arithmetic (pure). Stance-NEUTRAL base fray from the hit margin.
 * Returns the note count to strip (before the "1 note always survives" floor,
 * which the caller owns).
 *   margin ≤ 2 → 1 note
 *   margin ≥ 3 → 2 notes
 */
export function stanceFrayAmount(margin) {
  return margin >= 3 ? 2 : 1;
}
