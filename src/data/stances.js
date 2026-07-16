// ─── STANCES — combat/performance identity ───────────────────────────────────
// The Stance system (STANCE_SYSTEM_DESIGN.md) replaces the CQC branch. A stance
// is how you physically deliver the music you built: it modifies how your chord
// translates to combat (Drive bonus, fray), Fame, and crowd response. It is NOT
// a second stat layer — every stance number traces back to the chord/track the
// player actually built.
//
// Decisions locked 2026-07-15 (design session):
//   • Switching stances costs your ACTION (you can still move, can't attack).
//   • The Groove counter resets ONLY on chord fray (not on any hit) — prevents
//     the 4-player dogpile shutdown (§10.5).
//   • Soloist adds ⌈P/2⌉ (not full P) to Drive — comparable to Edge/Groove
//     bonuses, tunable (§4.1 amended).
//   • Chord fray is margin-scaled, post-roll, hits only: 1 note on margin ≤ 2,
//     2 notes on margin ≥ 3 (floored at 1 note remaining). Stances modify it:
//     attacker Power +1 · defender Soloist ×2 · defender Power +1 · defender
//     Cool ½ (floor — a graze doesn't fray a Cool chord at all).

export const STANCE_DEFS = {
  soloist: {
    id: 'soloist', label: 'Soloist', pose: 'Foot on Monitor', icon: '🌟', color: '#ffd700',
    blurb: 'Playing for the crowd, not the brawl. Your performance score powers your attack (+⌈P/2⌉ Drive) and every crowd-winning play draws +1 extra casual fan — but your chord frays DOUBLE when you\'re hit.',
  },
  power: {
    id: 'power', label: 'Power', pose: 'Wide Leg', icon: '🤘', color: '#ff4444',
    blurb: 'Mutual destruction. Your Thrash strips +1 extra note; your Sonic hits +1 Vibe harder — but your own chord also frays +1 when hit. No crowd bonus. You both lose; they lose more.',
  },
  cool: {
    id: 'cool', label: 'Cool', pose: 'Low Slung', icon: '🕶️', color: '#44aaff',
    blurb: 'Take the hit. Keep playing. Fray against you is HALVED (a graze doesn\'t fray you at all) and Casuals harden into Diehards faster — but you get no attack bonus.',
  },
  groove: {
    id: 'groove', label: 'Groove', pose: 'Behind the Back', icon: '🌀', color: '#aa55ff',
    blurb: 'Build the wave, then ride it. Hold your chord (no revoice, no attack, no fray) to bank +1 Groove per turn (max 3). Your next attack spends it: +Drive AND +Fame.',
  },
};
export const STANCE_ORDER = ['soloist', 'power', 'cool', 'groove'];

// Starting stance per spirit (§5). Each spirit can learn the rest via the
// Stance skill route.
export const STARTING_STANCE = {
  cosmic_ronin:      'soloist', // technical brilliance weaponized; exposed to brawlers
  Metalness_Monster: 'power',   // wrecks your chord, doesn't care about his own
  Glamarchy:         'cool',    // untouchable; chord holds under pressure
  intergalactic_0:   'groove',  // patient zoner; devastating when the wave lands
};

// ── Tuning ──────────────────────────────────────────────────────────────────
export const GROOVE_CAP_BASE       = 3;   // Groove counter cap
export const GROOVE_CAP_RESONANCE  = 5;   // …with the Resonance upgrade
// SOLOIST_FAME_MULT (×1.5, all FP sources) RETIRED in the 2026-07-16 balance
// pass — it compounded with the underdog (×2.5) and crowd (×2) multipliers
// into runaway Fame. The Soloist plays for the CROWD now: every fan-winning
// play (clean centre commits, cadences, trivia, riffs) draws extra casuals,
// which pays into the crowd multiplier instead of raw FP.
export const SOLOIST_FAN_BONUS     = 1;   // extra casuals on every fan gain (§4.1 amended)
export const POWER_SONIC_DMG_CAP   = 3;   // SONIC_VIBE_CAP + 1 — Power's Sonic ceiling
export const COOL_PROMOTE_EVERY    = 2;   // centre-streak turns per Diehard (base 3)
export const COOL_LOYALTY_PER_DIEHARD = 16; // perf loyalty per Diehard (base 24)

/** The spirit's stance, falling back to its starting stance. */
export function stanceOf(ns, spiritId) {
  return ns?.stance ?? STARTING_STANCE[spiritId] ?? 'cool';
}

/** Groove counter cap for this sheet (Resonance upgrade raises it). */
export function grooveCap(ns) {
  return (ns?.unlockedSkills ?? []).includes('stance_resonance')
    ? GROOVE_CAP_RESONANCE : GROOVE_CAP_BASE;
}

/**
 * Chord-fray arithmetic (pure). Base fray from the hit margin, then stance
 * modifiers on both sides. Returns the note count to strip (before the
 * "1 note always survives" floor, which the caller owns).
 */
export function stanceFrayAmount(margin, attackerStance, defenderStance) {
  let fray = margin >= 3 ? 2 : 1;                    // margin-scaled base
  if (attackerStance === 'power') fray += 1;          // Power strips harder
  if (defenderStance === 'soloist') fray *= 2;        // foot on the monitor — exposed
  else if (defenderStance === 'power') fray += 1;     // absorbs hard too
  else if (defenderStance === 'cool') fray = Math.floor(fray / 2); // holds together
  return fray;
}
