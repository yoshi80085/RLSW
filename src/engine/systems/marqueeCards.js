// ─── ENGINE SYSTEM: 🃏 MARQUEE PRIZE CARDS ──────────────────────────────────
// `MARQUEE_QUIZ_DESIGN.md` §10 — Alex's rulings, 2026-09-29:
//
//   · Every marquee is the same. No lane, no difficulty: one question, and a
//     correct answer wins ONE random card.
//   · Cards are battle bonuses with random effects — a guaranteed face, a
//     bigger die (d6 → d8 or d10), or one more die that counts.
//   · You HOLD them (at most `MARQUEE_HAND_MAX`, 3) and ARM one before you
//     throw a Swing or a Sonic. It is spent on that throw.
//
// Pure. The hand lives on the note sheet: `marqueeCards` (card ids, in the
// order won) and `marqueeArmed` (an index into it, or null).
//
// ⚠️ A CARD IS SPENT ONLY WHEN IT CHANGES THE THROW. Encore on a stack that
// already keeps every die, or a card armed with an empty Drive stack, does
// nothing — `applyCard` reports `card: null` and the card stays in the hand.
// Burning a prize for no effect would read as a bug, and it would be one.
//
// ⭐ THE CARD'S DIE IS A BONUS DIE (Alex, 2026-10-09 — `.scratch/special-dice/`,
// his dial-in: rule "bonus"). Until then a die card BENT YOUR WEAKEST DIE, and
// keep-the-best usually dropped exactly that die: measured over 20k throws a
// die card did nothing 13–40% of the time, and Loaded 4 made the throw WORSE
// about 1 in 3 (a 4 forced where a 5 or 6 would have landed). *"I find
// sometimes that the dice card doesn't make any effect."* Now Loaded / Bigger
// Cab / Full Stack ADD a die to the end of the pool with one more seat, and the
// die is PINNED (`throwPool` keeps it whatever it shows). So it never does
// nothing and never makes a throw worse. Loaded's face is SET, not thrown —
// the arena puts it down face up before the throw (`arenaDiceSequence.js`).
// 📌 Stronger than before (+4 to +6 a card, was +0 to +2.5). Balance is frozen;
// this was a rule choice, flagged in MARQUEE_QUIZ_DESIGN §10.5.
//
// ⚠️ THE SET DIE STILL SPENDS ITS `rng.int`. `dicePool.js`'s determinism
// contract is one draw per die in pool order; `throwPool` rolls the set die
// like any other and then overwrites the face. The bonus die is LAST in the
// pool, so every die of your own draws exactly what it drew without a card.
import { MARQUEE_HAND_MAX, ELEVEN_DIE } from '../../data/gameConstants.js';

/** The deck. `weight` is the draw weight (out of their sum, 12). Placeholders — balance is frozen. */
export const MARQUEE_CARDS = Object.freeze({
  loaded4:   { id: 'loaded4',   kind: 'loaded', face: 4, icon: '🎲', name: 'Loaded 4',   text: 'Adds a die set on 4. It always counts.', weight: 3 },
  loaded5:   { id: 'loaded5',   kind: 'loaded', face: 5, icon: '🎲', name: 'Loaded 5',   text: 'Adds a die set on 5. It always counts.', weight: 2 },
  loaded6:   { id: 'loaded6',   kind: 'loaded', face: 6, icon: '🎲', name: 'Loaded 6',   text: 'Adds a die set on 6. It always counts.', weight: 1 },
  biggerCab: { id: 'biggerCab', kind: 'bump',             icon: '🔼', name: 'Bigger Cab', text: 'Adds a bonus die a size bigger than your smallest (a d8 on d6s). It always counts.', weight: 3 },
  fullStack: { id: 'fullStack', kind: 'd10',              icon: '⏫', name: 'Full Stack', text: 'Adds a bonus d10. It always counts.', weight: 1 },
  encore:    { id: 'encore',    kind: 'keep',             icon: '➕', name: 'Encore',     text: 'One more of your dice counts.', weight: 2 },
});
export const MARQUEE_CARD_IDS = Object.freeze(Object.keys(MARQUEE_CARDS));

/**
 * 🤖 A rough worth per card, for bots choosing what to arm and what to throw
 * away. Order only — nothing adds these up. The d10 and the Loaded 6 lead;
 * Encore is worth a whole extra kept die (~3–4 pips) when it applies.
 */
export const MARQUEE_CARD_VALUE = Object.freeze({
  fullStack: 6, loaded6: 5, encore: 4, biggerCab: 3, loaded5: 3, loaded4: 2,
});

/** Draw one card off a pre-drawn [0,1) engine float. Weighted, pure. */
export function drawMarqueeCard(rngVal = 0) {
  const total = MARQUEE_CARD_IDS.reduce((s, id) => s + MARQUEE_CARDS[id].weight, 0);
  let t = Math.min(0.999999, Math.max(0, Number(rngVal) || 0)) * total;
  for (const id of MARQUEE_CARD_IDS) {
    t -= MARQUEE_CARDS[id].weight;
    if (t < 0) return id;
  }
  return MARQUEE_CARD_IDS[MARQUEE_CARD_IDS.length - 1];
}

export const cardDef = id => MARQUEE_CARDS[id] ?? null;
export const handOf = (ns = {}) => (Array.isArray(ns.marqueeCards) ? ns.marqueeCards : []);

/** The armed card's id, or null. An index that has fallen off the hand reads as nothing. */
export function armedCardId(ns = {}) {
  const i = ns.marqueeArmed;
  const hand = handOf(ns);
  return Number.isInteger(i) && i >= 0 && i < hand.length ? hand[i] : null;
}

/**
 * The weakest die a card may touch: the LAST die of the smallest size. Pools
 * are laid out d8s first, then d6s, so this is the tail d6 — the die most
 * likely to be dropped anyway. ⚠️ Never the Eleven die: its faces are its rule.
 */
export function weakestDieIdx(pool = []) {
  let idx = -1;
  pool.forEach((s, i) => {
    if (s === ELEVEN_DIE) return;
    if (idx < 0 || s <= pool[idx]) idx = i;
  });
  return idx;
}

/**
 * Apply ONE card to a throw. Returns the pool and keep to throw, the card's
 * dice for `throwPool` (`fixed`: [{ idx, face?, pin?, bonus? }]) and the card
 * id — or `card: null` when the card would change nothing (see the header), in
 * which case it is not spent.
 *
 * 🎲 Loaded / Bigger Cab / Full Stack append ONE bonus die and ONE seat; the
 * entry is `{ idx: <its index>, pin: true, bonus: true }`, plus `face` for a
 * Loaded die (set, not thrown). ➕ Encore keeps one more of your own dice.
 */
export function applyCard(pool = [], keep = pool.length, cardId = null) {
  const base = { pool: [...pool], keep: keep ?? pool.length, fixed: [], card: null };
  const def = cardDef(cardId);
  if (!def || !pool.length) return base;
  const k = keep ?? pool.length, lo = weakestDieIdx(pool);
  const bonus = (sides, face) => ({ pool: [...pool, sides], keep: k + 1,
    fixed: [{ idx: pool.length, pin: true, bonus: true, ...(face != null ? { face } : {}) }], card: def.id });
  switch (def.kind) {
    case 'loaded': return bonus(6, def.face);
    // A size up from your smallest die (never the Eleven die, `weakestDieIdx`), capped at d12.
    case 'bump':   return bonus(Math.min(12, (lo >= 0 ? pool[lo] : 6) + 2));
    case 'd10':    return bonus(10);
    case 'keep':
      if (k >= pool.length) return base;
      return { ...base, keep: k + 1, card: def.id };
    default:
      return base;
  }
}

/** The bonus die in a throw's `fixed` list ({ idx, face?, pin, bonus }), or null. */
export const bonusDieOf = (fixed = []) => (fixed ?? []).find(f => f?.bonus && f.pin) ?? null;

/**
 * The attacker's rig with their ARMED card applied — what a Swing or a Sonic
 * actually throws. `rig` is a `sonicRig` / `rigFor` result ({ pool, keep }).
 * Returns the rig plus `atkFixed` (the card's dice for `throwPool`) and
 * `cardId` (null when nothing is played).
 */
export function cardedRig(rig = {}, ns = {}) {
  const pool = rig.pool ?? [];
  const r = applyCard(pool, rig.keep ?? pool.length, armedCardId(ns));
  return { ...rig, pool: r.pool, keep: r.keep, atkFixed: r.fixed, cardId: r.card };
}

// ── The hand, as note-sheet patches ─────────────────────────────────────────

/** Take a new card. Full hand: `replaceIdx` swaps one out; null lets the new card go. */
export function wonCardPatch(ns = {}, cardId, replaceIdx = null) {
  if (!cardDef(cardId)) return null;
  const hand = handOf(ns);
  if (hand.length < MARQUEE_HAND_MAX) return { marqueeCards: [...hand, cardId] };
  if (!Number.isInteger(replaceIdx) || replaceIdx < 0 || replaceIdx >= hand.length) return null;
  const next = hand.map((c, i) => (i === replaceIdx ? cardId : c));
  // Replacing the armed card disarms it — you threw that one away.
  return { marqueeCards: next, ...(ns.marqueeArmed === replaceIdx ? { marqueeArmed: null } : {}) };
}

/** Arm a card (an index into the hand), or disarm with null. */
export function armPatch(ns = {}, idx = null) {
  if (idx == null) return { marqueeArmed: null };
  const hand = handOf(ns);
  return Number.isInteger(idx) && idx >= 0 && idx < hand.length ? { marqueeArmed: idx } : null;
}

/** Spend the armed card. */
export function spendArmedPatch(ns = {}) {
  const i = ns.marqueeArmed;
  const hand = handOf(ns);
  if (!Number.isInteger(i) || i < 0 || i >= hand.length) return { marqueeArmed: null };
  return { marqueeCards: hand.filter((_, j) => j !== i), marqueeArmed: null };
}

// ── 🤖 Bots ─────────────────────────────────────────────────────────────────

/** The hand index a bot arms for an attack: its best card that does something. */
export function botArmIdx(ns = {}, rig = {}) {
  const pool = rig.pool ?? [];
  let best = null, bestV = -Infinity;
  handOf(ns).forEach((id, i) => {
    if (!applyCard(pool, rig.keep ?? pool.length, id).card) return;
    const v = MARQUEE_CARD_VALUE[id] ?? 0;
    if (v > bestV) { bestV = v; best = i; }
  });
  return best;
}

/** Full hand: which card a bot throws away for `newId` (its worst, if worse), else null. */
export function botReplaceIdx(ns = {}, newId) {
  const hand = handOf(ns);
  if (hand.length < MARQUEE_HAND_MAX) return null;
  let worst = 0;
  hand.forEach((id, i) => { if ((MARQUEE_CARD_VALUE[id] ?? 0) < (MARQUEE_CARD_VALUE[hand[worst]] ?? 0)) worst = i; });
  return (MARQUEE_CARD_VALUE[newId] ?? 0) > (MARQUEE_CARD_VALUE[hand[worst]] ?? 0) ? worst : null;
}

// ── Reducers ────────────────────────────────────────────────────────────────

function patchSheet(state, spiritId, patch) {
  const ns = state.noteStates?.[spiritId];
  if (!ns || !patch) return state;
  return { ...state, noteStates: { ...state.noteStates, [spiritId]: { ...ns, ...patch } } };
}

/** MARQUEE_CARD_WON — a correct answer's prize goes into the hand. */
export function applyMarqueeCardWon(state, { spiritId, cardId, replaceIdx = null }) {
  return patchSheet(state, spiritId, wonCardPatch(state.noteStates?.[spiritId] ?? {}, cardId, replaceIdx));
}

/** MARQUEE_CARD_ARMED — arm (or, with null, disarm) a card for the next throw. */
export function applyMarqueeCardArmed(state, { spiritId, idx = null }) {
  return patchSheet(state, spiritId, armPatch(state.noteStates?.[spiritId] ?? {}, idx));
}
