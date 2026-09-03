// ─── ⭐ THE FAME COLOUR SYSTEM — gold means Fame, in one place ───────────────
//
// 🪦 WHAT THIS REPLACES, Alex 2026-09-03. Nothing. It is an extraction: the
// same fourteen golds were written out as hex literals in five files — the
// header race track, the HUD Fame bar, the rival rows, the Game Over card and
// the Riffbook's cadence chips — roughly sixty literals describing ONE idea.
//
// 📌 WHY GOLD AT ALL. It was never chosen as decoration. Fame is the score, the
// score is a crown, and a crown is gold; the palette experiment on 2026-09-03
// put board violet, board magenta and stage cyan beside it and gold won on that
// reading alone — you do not have to be told what the gold thing is.
//
// ⚠️ THE ONE COLLISION, KNOWN AND ACCEPTED. `#ffd700` sits one step from
// Metalness Monster's `#ffcc00` (data/spirits.js), so the furniture and a player
// are nearly the same hue. Every alternative traded that for a collision with
// Intergalactic 0's `#aa55ff` or Shredding Ronin's `#4488ff` instead — there is
// no free hue with four Spirits on the board. ⚠️ If a fifth Spirit is ever added
// in gold, this is the file that has to move, and the whole Fame readout moves
// with it. That is the point of it being a file.
//
// ⚠️ THESE ARE ROLES, NOT SWATCHES. A consumer asks for `edge` or `mark` or
// `label`, never for "the dark gold". `FAME_CONTESTED` carries THE SAME KEYS —
// it is the same system under threat, not a second palette — so a component
// switches the whole readout to the danger reading with one ternary at the top
// and never branches on `contested` again further down. That is what stops the
// two Fame readouts (the header track and the HUD bar) from drifting apart,
// which is the same failure the threshold notches exist to prevent.
//
// 📌 ALPHA IS THE CALLER'S. Suffix at the use site — `${FAME.glow}aa` — because
// the same token is drawn at six different strengths and a token per strength
// would be a swatch list again.

/** Gold — the Fame readout at rest. */
export const FAME = {
  ground:  '#0a0f1c',  // the unfilled track: the night BEHIND the gold, not gold
  edge:    '#5a4410',  // the track's border — gold at ground weight
  label:   '#7d6a3a',  // "⭐ RACE", the "/24" denominator — gold at label weight
  mark:    '#ffd700',  // the finish line, the crown's glow, a banked ★ pip
  value:   '#ffd700',  // a Fame NUMBER — the thing a player reads off
  glow:    '#ffd700',  // whatever the mark and the value cast
  numGlow: '#ffd700',  // the big number's own halo (parts company under threat)
  lit:     '#fff6d0',  // a Stage-FX threshold the leader has already passed
  deep:    '#aa7700',  // dark end of the bar ramp
  deepHot: '#cc9900',  // …and the dark end once the bar is ≥75%
  flare:   '#fff3c4',  // the bright end of a pulse
  text:    '#ffe9a0',  // gold-adjacent body text (the +N beside the 👑)
  /* ⚠️ AN ALPHA SUFFIX, NOT A COLOUR — the one exception to "alpha is the
     caller's". The target label's halo is deliberately LOUDER under threat, and
     if that strength lived as a ternary at the use site the component would be
     branching on `contested` below the top again, which is the thing the shared
     keys exist to stop. Strength is part of the state, so it lives here. */
  haloA:   '66',
};

/** 🔥 The same system with a rival inside striking distance. Same keys, red.
 *  ⚠️ Spreads `FAME` on purpose: anything NOT overridden here is deliberately
 *  unchanged under threat. `lit` is the clearest case — a threshold you have
 *  passed is still passed, and recolouring it would say something false. */
export const FAME_CONTESTED = {
  ...FAME,
  edge:    '#ff4422',
  label:   '#ff8855',
  mark:    '#ff6644',
  value:   '#ff8855',
  glow:    '#ff4422',
  numGlow: '#ff4400',
  deep:    '#7a1500',
  deepHot: '#ff4400',
  flare:   '#ff9955',
  haloA:   '88',
};

/** Pick the family. Every Fame surface starts with this one line. */
export const fameSet = (contested) => (contested ? FAME_CONTESTED : FAME);

/** Neutrals the Fame readouts share — not gold, and not per-state. */
export const FAME_NEUTRAL = {
  notchUnlit: '#ffffff26',  // a threshold nobody has reached
  pipUnlit:   '#2b3444',    // an unbanked per-turn ★
  sheen:      '#ffffff66',  // the stage light sweeping the bar
  capped:     '#ff7755',    // ⛔ CAPPED — a rule, not a temperature
};

/** The Fame bar's fill ramp, dark → core → bright.
 *  📌 A function rather than three constants because the THREE-stop hot variant
 *  and the two-stop rest variant are the same ramp at different brightness, and
 *  writing them as separate strings is how they drifted in the first place. */
export function fameFill({ hot = false, contested = false } = {}) {
  const P = fameSet(contested);
  if (contested) return `linear-gradient(90deg,${P.deep},${P.deepHot},${P.flare})`;
  return hot
    ? `linear-gradient(90deg,${P.deepHot},${P.mark} 55%,${P.lit})`
    : `linear-gradient(90deg,${P.deep},${P.mark})`;
}
