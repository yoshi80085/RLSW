// ─── STANCES v2 — ability kits (STANCE_V2_HANDOFF.md) ─────────────────────────
// v1 passive modifiers (fray math, Fame multipliers, Groove counter) are CUT.
// v2 stances grant named special attacks + passive + commit Db generator.
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
    // ── Kit: abilities granted by this stance ──
    physical: {
      id: 'hammer_on', label: 'Hammer-On', icon: '🔨',
      apCost: 1, dbCost: 1,
      desc: 'Instrument swings down like a hammer. Drive −1, but on hit: 2× damage.',
      // Drive delta applied before the roll
      driveMod: -1,
      // On-hit: double the computed melee damage (capped at 2×THRASH_DAMAGE_CAP)
      doubleDamage: true,
    },
    sonic: {
      id: 'pinch_harmonic', label: 'Pinch Harmonic', icon: '🔔',
      apCost: 2, dbCost: 1,
      desc: '+2 Drive if the chord stack contains a repeat of the root note (root ≥ 2×).',
      // Conditional +2 Drive — caller checks rootRepeated
      conditionalDrive: 2,
      condition: 'rootRepeated',  // chord stack has root note ≥ 2 times
    },
    finisher: {
      id: 'bend', label: 'Bend', icon: '🎵',
      apCost: 2, dbCost: 0,
      desc: 'Auto-hit, range 2, target loses 1 Vibe. Wrecks both stacks. Full Smash DNA.',
      range: 2,
      damage: 1,
      stackWipe: 'scatter',  // Smash-style scatter on target
    },
    passive: {
      id: 'pull_off', label: 'Pull-Off', icon: '↗️',
      desc: 'When a rival loses a battle against you, they are pushed +1 hex further.',
      extraKnockback: 1,
    },
    commitGen: {
      id: 'trill', label: 'Trill', icon: '🎼',
      desc: '3+ consecutive notes alternating between two pitches ≤ a whole step (2 semitones) apart.',
      detector: 'detectTrill',
    },
  },

  low_slung: {
    id: 'low_slung', label: 'Low Slung', pose: 'Cool', icon: '🕶️', color: '#44aaff',
    tagline: 'Less notes. More attitude.',
    blurb: 'Cool efficiency — Rake, Power Chord, Slide. Icons: Slash, Johnny Ramone, Billie Joe.',
    physical: {
      id: 'rake', label: 'Rake', icon: '🪒',
      apCost: 1, dbCost: 1,
      desc: 'Spends 3 chord-stack notes instead of 2, gains +2 Drive. Requires ≥ 3 notes.',
      noteCost: 3,      // spends 3 chord-stack notes instead of the normal 2
      driveMod: 2,
    },
    sonic: {
      id: 'power_chord', label: 'Power Chord', icon: '⚡',
      apCost: 2, dbCost: 1,
      desc: '+2 Drive if the chord stack contains the 5th of the root.',
      conditionalDrive: 2,
      condition: 'hasFifth',  // chord stack contains the perfect 5th
    },
    finisher: {
      id: 'slide', label: 'Slide', icon: '🎸',
      apCost: 2, dbCost: 0,
      desc: 'Auto-hit from up to 3 hexes away: slide in, target loses 1 Vibe. Full Smash DNA.',
      range: 3,
      damage: 1,
      stackWipe: 'scatter',
      slideIn: true,     // attacker slides adjacent to target as part of the attack
    },
    passive: {
      id: 'feedback', label: 'Feedback', icon: '📢',
      desc: 'Any rival whose attack on you deals 0 damage takes 1 extra Vibe damage.',
      zeroDamageRetaliation: 1,
    },
    commitGen: {
      id: 'chug', label: 'Chug', icon: '🔁',
      desc: '3+ identical notes in a row.',
      detector: 'detectChug',
    },
  },

  wide_leg: {
    id: 'wide_leg', label: 'Wide Leg', pose: 'Power', icon: '🤘', color: '#ff4444',
    tagline: 'Every chord hits like a freight train.',
    blurb: 'Raw power — Axe Swing, Gallop, Thrash. Icons: Hetfield, Zakk Wylde, Dimebag.',
    physical: {
      id: 'axe_swing', label: 'Axe Swing', icon: '🪓',
      apCost: 2, dbCost: 1,    // costs 1 extra AP over Swing
      desc: '+2 Drive. On a whiff, next turn stock recovery is halved.',
      driveMod: 2,
      whiffPenalty: 'halfRefill',  // STOCK_REFILL_RATE 4 → 2 for one refill
    },
    sonic: {
      id: 'gallop', label: 'Gallop', icon: '🐎',
      apCost: 2, dbCost: 1,
      desc: '+2 Drive if the chord stack is full.',
      conditionalDrive: 2,
      condition: 'stackFull',  // chord stack is at max capacity
    },
    finisher: {
      id: 'thrash_finisher', label: 'Thrash', icon: '💥',
      apCost: 2, dbCost: 0,
      desc: 'Adjacent, auto-hit, 2 Vibe damage. Rival chord stack totally obliterated. Full Smash DNA.',
      range: 1,        // melee only
      damage: 2,
      stackWipe: 'obliterate',  // clears entire chord stack (stronger than scatter)
    },
    passive: {
      id: 'headbang', label: 'Headbang', icon: '🤘',
      desc: 'Fans dig the tune: Casual → Diehard conversion improved (promote every 2, 16 loyalty).',
      promoteEvery: 2,         // base FAN_PROMOTE_EVERY is 3
      loyaltyPerDiehard: 16,   // base LOYALTY_PER_DIEHARD is 24
    },
    commitGen: {
      id: 'dive_bomb', label: 'Dive Bomb', icon: '💣',
      desc: 'A committed run that starts and ends on the same note letter, descends overall, and ends an octave below the start.',
      detector: 'detectDiveBomb',
    },
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

/** Look up the full kit for a spirit's stance. */
export function stanceKit(spiritId) {
  return STANCE_DEFS[stanceOf(null, spiritId)] ?? STANCE_DEFS.low_slung;
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
