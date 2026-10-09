// ─── ENGINE SYSTEM: 🎪 WHERE THE MARQUEES STAND ──────────────────────────────
// `MARQUEE_QUIZ_DESIGN.md` §11 — Alex, 2026-09-29:
//
//   "Marquee spaces — make 1 per player — always present on the Spirit's
//    starting corner quadrant of the board. If 3 players, 3 marquee spaces; if
//    player 1 lands on a marquee space on turn 1, make another in that same
//    quadrant *or* the 'empty' quadrant. If 4 players — make it persistent on
//    one of the spaces of that player's quadrant (never more than 1 per
//    quadrant)."
//
// One rule covers every table size:
//
//   · The board holds ONE marquee per seat (`board.marqueeSeats`, the corners
//     seated at setup), each starting in its seat's own quadrant.
//   · Never more than one marquee in a quadrant.
//   · Taking one relights one AT ONCE, in a quadrant that has none — which is
//     the quadrant just emptied, or an unseated ("empty") quadrant. At four
//     players there is only ever the one just emptied, so it is persistent in
//     that player's quadrant; at three it is that quadrant or the empty one; at
//     two, that quadrant or either empty one.
//   · 📌 The new one lands at least `MARQUEE_RELIGHT_MIN_DIST` hexes from where
//     the old one was taken (Claude's call, flagged) — otherwise a Spirit could
//     step off and straight back on for a card every turn.
//
// Pure. Randomness only through the `rng` the reducer hands in.
import { ALL_HEXES, HEX_BY_NUM } from "../../board/hexMap.js";
import { axialDist } from "../../board/hexGeometry.js";
import { CORNERS } from "../../data/corners.js";
import { LIMELIGHT_HEX, MARQUEE_RELIGHT_MIN_DIST, MARQUEE_COMMUNITY_SHARE } from "../../data/gameConstants.js";

export const MARQUEE_CORNERS = ["blue", "purple", "yellow", "red"];
// Same quarters as the spotlights (`systems/spotlights.js`): blue 7 and purple
// 12 on the left, yellow 100 and red 105 on the right.
const QUARTER = { blue: [-1, -1], purple: [-1, 1], yellow: [1, -1], red: [1, 1] };
const CENTER = HEX_BY_NUM[LIMELIGHT_HEX];
const HOMES = new Set(Object.values(CORNERS).map(c => c.homeNum));

/** Which quadrant a hex sits in, or null on the centre lines. */
export function quadrantOf(num) {
  const h = HEX_BY_NUM[num];
  if (!h || !CENTER) return null;
  const dx = h.px - CENTER.px, dy = h.py - CENTER.py;
  if (Math.abs(dx) < 1 || Math.abs(dy) < 1) return null;
  const sx = Math.sign(dx), sz = Math.sign(dy);
  return MARQUEE_CORNERS.find(c => QUARTER[c][0] === sx && QUARTER[c][1] === sz) ?? null;
}

/** Every hex a marquee may stand on, per quadrant: not the rim, not the
 *  Limelight, not a home hex. */
export const MARQUEE_QUADRANT_POOLS = Object.fromEntries(MARQUEE_CORNERS.map(c => [c,
  ALL_HEXES.filter(h => !h.edge && h.num !== LIMELIGHT_HEX && !HOMES.has(h.num) && quadrantOf(h.num) === c)
    .map(h => h.num)]));

const dist = (a, b) => {
  const ha = HEX_BY_NUM[a], hb = HEX_BY_NUM[b];
  return ha && hb ? axialDist(ha.q, ha.r, hb.q, hb.r) : Infinity;
};

/** A Spirit's corner — its own field, else the corner whose home it starts on. */
function cornerOf(spirit) {
  if (spirit?.corner && QUARTER[spirit.corner]) return spirit.corner;
  const home = MARQUEE_CORNERS.find(c => CORNERS[c]?.homeNum === spirit?.num);
  return home ?? quadrantOf(spirit?.num);
}

/** The corners seated at setup, in board order — one marquee each. */
export function seatedCorners(spirits = []) {
  const seated = new Set(spirits.map(cornerOf).filter(Boolean));
  const out = MARQUEE_CORNERS.filter(c => seated.has(c));
  return out.length ? out : MARQUEE_CORNERS.slice(0, Math.max(1, Math.min(4, spirits.length)));
}

/** How many marquees the board keeps lit: one per seat seated at setup. A
 *  state without `board.marqueeSeats` (an older save) reads its Spirits. */
export const marqueeCount = state =>
  (state?.board?.marqueeSeats ?? []).length || seatedCorners(state?.spirits ?? []).length;

/** Quadrants that hold no marquee right now. */
export function openQuadrants(eventHexes = []) {
  const lit = new Set(eventHexes.map(quadrantOf));
  return MARQUEE_CORNERS.filter(c => !lit.has(c));
}

/** Hexes a marquee could light on in one quadrant. */
export function quadrantCandidates(corner, { occupied = [], awayFrom = null } = {}) {
  const taken = new Set(occupied);
  return (MARQUEE_QUADRANT_POOLS[corner] ?? []).filter(n => !taken.has(n)
    && (awayFrom == null || dist(n, awayFrom) >= MARQUEE_RELIGHT_MIN_DIST));
}

/** What a marquee must not land on: standing Spirits and Lost Chords. */
export function occupiedHexes(state) {
  return [
    ...(state.spirits ?? []).filter(s => !s.knockedOut).map(s => s.num),
    ...(state.board?.boardTokens ?? []).map(t => t.num),
  ];
}

/**
 * Pick where the next marquee lights: a quadrant with none (uniform), then a
 * hex in it (uniform). Two draws when it succeeds. Quadrants with no free hex
 * are skipped. Returns the hex number, or null if nowhere is free.
 */
export function pickMarquee(rng, eventHexes = [], { occupied = [], awayFrom = null, quadrants = null } = {}) {
  const open = (quadrants ?? openQuadrants(eventHexes))
    .map(c => ({ c, cand: quadrantCandidates(c, { occupied: [...occupied, ...eventHexes], awayFrom }) }))
    .filter(q => q.cand.length);
  if (!open.length) return null;
  const q = open[Math.min(open.length - 1, Math.floor(rng() * open.length))];
  return q.cand[Math.min(q.cand.length - 1, Math.floor(rng() * q.cand.length))];
}

// ── 🎤 THE TWO KINDS (§13) ──────────────────────────────────────────────────

/** Roll a lit marquee's kind: 'community' 1 time in 3, else 'solo'. One draw. */
export const rollMarqueeKind = rng => (rng() < MARQUEE_COMMUNITY_SHARE ? 'community' : 'solo');

/** A lit marquee's kind; anything unrolled (an older save) is solo. */
export const marqueeKindOf = (board, hex) => (board?.marqueeKinds?.[hex] === 'community' ? 'community' : 'solo');

/** Setup: one marquee in each seated corner's own quadrant. */
export function openingMarquees(rng, seats = [], occupied = []) {
  const out = [];
  for (const c of seats) {
    const hex = pickMarquee(rng, out, { occupied, quadrants: [c] });
    if (hex != null) out.push(hex);
  }
  return out;
}

// ── ⏳ THE RELIGHT WAITS FOR THE TURN TO END (Alex, 2026-10-09) ──────────────
// *"New marquee spaces shouldn't appear again on the same turn if one was
// taken."* Before this the replacement lit THE MOMENT one was taken, so a
// Spirit with steps left could see it appear and sometimes walk straight to it.
//
// ⭐ THE PICK IS STILL MADE AT THE TAKE — only the LIGHTING waits. The hex and
// its kind are drawn exactly where they always were (`applyEventHexTriggered`,
// three draws), so the seeded stream, every replay and the netcode's rng cursor
// are untouched; the board just holds the pick in `board.marqueePending`
// ([{ hexNum, kind, from }]) until `TURN_ENDED` lights it. (Not `TURN_SKIPPED`:
// a skip runs no end-of-turn ticks, and nothing can be pending at one — the
// take happened in a turn that ended properly.)
// ⚠️ A pending marquee is NOT on the board: bots cannot route to it, the 3D
// markers do not draw it and nothing can land on it — but it DOES count toward
// "one per seat" and "one per quadrant", or the round-end top-up would light a
// second marquee beside it and a second take the same turn could pick its quadrant.

/** The marquees waiting for the turn to end. */
export const pendingMarquees = board => (Array.isArray(board?.marqueePending) ? board.marqueePending : []);
/** Their hexes — for anything that must not place something on them. */
export const pendingMarqueeHexes = board => pendingMarquees(board).map(p => p.hexNum);
/** Lit + waiting: what "one per seat" and "one per quadrant" count. */
export const plannedMarqueeHexes = board => [...(board?.eventHexes ?? []), ...pendingMarqueeHexes(board)];

/**
 * Light every pending marquee whose hex is clear. Pure, NO rng — it runs inside
 * the turn reducers, which take none. One whose hex is now stood on (a Spirit
 * walked there before the turn ended) or holds a Lost Chord stays pending and is
 * tried again at the next turn end, rather than lighting under someone's feet.
 * Reports what lit in `board.lastEventRespawn` ({ hexNum, from, deferred: true }).
 */
export function lightPendingMarquees(state) {
  const pending = pendingMarquees(state?.board);
  if (!pending.length) return state;
  const blocked = new Set(occupiedHexes(state));
  const lit = pending.filter(p => !blocked.has(p.hexNum) && !(state.board.eventHexes ?? []).includes(p.hexNum));
  const wait = pending.filter(p => !lit.includes(p));
  if (!lit.length) return state;
  const kinds = { ...(state.board.marqueeKinds ?? {}) };
  for (const p of lit) kinds[p.hexNum] = p.kind === 'community' ? 'community' : 'solo';
  const last = lit[lit.length - 1];
  return { ...state, board: { ...state.board,
    eventHexes: [...(state.board.eventHexes ?? []), ...lit.map(p => p.hexNum)],
    marqueeKinds: kinds,
    marqueePending: wait,
    lastEventRespawn: { hexNum: last.hexNum, from: last.from ?? null, deferred: true, lit: lit.map(p => p.hexNum) },
  } };
}

