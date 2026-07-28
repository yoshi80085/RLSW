// ─── STYLE SYSTEM (STYLE_SYSTEM_HANDOFF.md) ─────────────────────────────────
// Supersedes stances.js. Style is fixed per Spirit — read straight off the
// spirit sheet (SPIRIT_DEFS[id].style) — and dictates how a Spirit most
// effectively earns Db. Styles grant no abilities, no passives, no specials,
// and no stat modifiers; combat identity lives entirely in per-Spirit innates
// and Signature arsenals.
import { SPIRIT_DEFS } from "./spirits.js";

export const STYLE_DEFS = {
  Shred: { id:'Shred', label:'Shred', icon:'⚡', color:'#4488ff',
           tagline:'Fast, far, and never twice.',
           earnDesc:'Long directional runs — steps, 3rds or 4ths, up or down.',
           bonusDesc:'Contour turn: a run up AND a run back down.' },
  Groove:{ id:'Groove', label:'Groove', icon:'🔁', color:'#aa55ff',
           tagline:'Say it again. Mean it more.',
           earnDesc:'Repeated notes, alternating pairs, repeated cells.',
           bonusDesc:'Resolution: land the last note on the root.' },
  Flair: { id:'Flair', label:'Flair', icon:'✨', color:'#ff6600',
           tagline:'The wrong note, on purpose.',
           earnDesc:'Out-of-scale notes that resolve back into the scale.',
           bonusDesc:'Chromatic approach: resolve by a half step.' },
};

/** A spirit's style — read straight off the spirit sheet. Falls back to 'Groove'. */
export function styleOf(spiritId) {
  return SPIRIT_DEFS[spiritId]?.style ?? 'Groove';
}

/** Full style definition for a spirit. */
export function styleDef(spiritId) {
  return STYLE_DEFS[styleOf(spiritId)];
}
