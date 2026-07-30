// ─── STYLE — CHARACTER FLAVOUR ONLY ─────────────────────────────────────────
// ⚠️ STYLE NO LONGER AFFECTS SCORING. It used to pay Db per commit for matching
// the spirit's fixed pattern (`styleCommitDb`, deleted). That system was cut for
// two reasons: its detectors re-scored gestures the Drive and Sustain boosts
// already pay for, and it was an aesthetic judge in a currency that now pays only
// for facts a player can aim at — how much you played, where you came to rest,
// whether that landing was in your chord, how many notes fought the key.
//
// What survives is identity: an icon, a colour and a tagline on the character
// sheet. `earnDesc` and `bonusDesc` are KEPT as a record of what each style used
// to reward, but ⚠️ THEY MUST NOT BE RENDERED AS RULES — they describe mechanics
// that no longer exist, and the two places that showed them ("earns Db: …") now
// show the tagline instead. Delete them the moment nothing needs the history.
//
// Style is still fixed per Spirit and read off SPIRIT_DEFS[id].style. Combat
// identity lives entirely in per-Spirit innates and Signature arsenals.
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
