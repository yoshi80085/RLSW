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
// ⚠️ THE LOADED DIE STILL SPENDS ITS `rng.int`. `dicePool.js`'s determinism
// contract is one draw per die in pool order; `throwPool` rolls the loaded die
// like any other and then overwrites the face, so arming a card never shifts
// the stream for anything thrown after it.
import { MARQUEE_HAND_MAX, ELEVEN_DIE } from '../../data/gameConstants.js';

/** The deck. `weight` is the draw weight (out of their sum, 12). Placeholders — balance is frozen. */
export const MARQUEE_CARDS = Object.freeze({
  loaded4:   { id: 'loaded4',   kind: 'loaded', face: 4, icon: '🎲', name: 'Loaded 4',   text: 'One of your dice lands on a 4.', weight: 3 },
  loaded5:   { id: 'loaded5',   kind: 'loaded', face: 5, icon: '🎲', name: 'Loaded 5',   text: 'One of your dice lands on a 5.', weight: 2 },
  loaded6:   { id: 'loaded6',   kind: 'loaded', face: 6, icon: '🎲', name: 'Loaded 6',   text: 'One of your dice lands on a 6.', weight: 1 },
  biggerCab: { id: 'biggerCab', kind: 'bump',             icon: '🔼', name: 'Bigger Cab', text: 'Your weakest die grows a size: d6 → d8, d8 → d10.', weight: 3 },
  fullStack: { id: 'fullStack', kind: 'd10',              icon: '⏫', name: 'Full Stack', text: 'Your weakest die becomes a d10.', weight: 1 },
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
 * Apply ONE card to a throw. Returns the pool and keep to throw, the loaded
 * faces (`fixed`: [{ idx, face }]) and the card id — or `card: null` when the
 * card would change nothing (see the header), in which case it is not spent.
 */
export function applyCard(pool = [], keep = pool.length, cardId = null) {
  const base = { pool: [...pool], keep: keep ?? pool.length, fixed: [], card: null };
  const def = cardDef(cardId);
  if (!def || !pool.length) return base;
  const out = { ...base, card: def.id };
  const lo = weakestDieIdx(out.pool);
  switch (def.kind) {
    case 'loaded':
      if (lo < 0) return base;
      out.fixed = [{ idx: lo, face: Math.min(def.face, out.pool[lo]) }];
      return out;
    case 'bump':
      if (lo < 0 || out.pool[lo] >= 12) return base;
      out.pool[lo] = Math.min(12, out.pool[lo] + 2);
      return out;
    case 'd10':
      if (lo < 0 || out.pool[lo] >= 10) return base;
      out.pool[lo] = 10;
      return out;
    case 'keep':
      if (out.keep >= out.pool.length) return base;
      out.keep = out.keep + 1;
      return out;
    default:
      return base;
  }
}

/**
 * The attacker's rig with their ARMED card applied — what a Swing or a Sonic
 * actually throws. `rig` is a `sonicRig` / `rigFor` result ({ pool, keep }).
 * Returns the rig plus `atkFixed` and `cardId` (null when nothing is played).
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
