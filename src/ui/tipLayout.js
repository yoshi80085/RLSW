// ─── 🎓 TIP CARD PLACEMENT ───────────────────────────────────────────────────
// Pure geometry for the beginner-tip card, pulled out of BeginnerTipOverlay so
// it can be regression-tested without a DOM.
//
// 🐛 THE BUG THIS EXISTS TO PREVENT: placement used to clamp against a
// hardcoded 280px card height. Long tip pages are much taller, so the bottom of
// the card — the row with NEXT on it — slid below the fold and the tip became
// impossible to dismiss. Anything that positions this card must clamp against
// the card's MEASURED height, and must guarantee the bottom edge stays on
// screen. `fitsOnScreen` below is the invariant; the selftest asserts it across
// a sweep of viewports and card sizes.

export const CARD_PAD = 16;   // minimum gap to any screen edge
export const CARD_GAP = 80;   // gap between the card and the spotlit element

/**
 * Where should the card sit?
 *   target — { left, top, width, height } of the spotlit element, or null
 *   cardW/cardH — the card's measured size
 *   vw/vh — viewport
 * Returns { left, top, centered }. `centered: true` means "let flexbox do it"
 * (no target on screen), in which case left/top are advisory only.
 */
export function placeTipCard({ target, cardW, cardH, vw, vh, pad = CARD_PAD, gap = CARD_GAP }) {
  // A card taller than the viewport can't be fully placed; the caller caps its
  // height (maxHeight + scrolling body) so this stays true in practice.
  const h = Math.min(cardH, Math.max(0, vh - pad * 2));
  if (!target) {
    return { centered: true, left: Math.max(pad, (vw - cardW) / 2), top: Math.max(pad, (vh - h) / 2) };
  }
  const tcx = target.left + target.width / 2;
  // Sit on the opposite side of the screen from the target so the arrow has
  // room to travel, then clamp hard to the viewport.
  const wantLeft = tcx < vw / 2
    ? tcx + target.width / 2 + gap
    : tcx - target.width / 2 - gap - cardW;
  const left = Math.max(pad, Math.min(vw - cardW - pad, wantLeft));
  // Prefer vertically centred on the target…
  const wantTop = target.top + target.height / 2 - h / 2;
  // …but never past either edge. Math.max LAST so that when the viewport is
  // shorter than the card, the top edge wins and the header stays reachable.
  const top = Math.max(pad, Math.min(vh - h - pad, wantTop));
  return { centered: false, left, top };
}

/** The invariant: the whole card, footer included, is inside the viewport. */
export function fitsOnScreen({ left, top }, cardW, cardH, vw, vh, pad = CARD_PAD) {
  const h = Math.min(cardH, Math.max(0, vh - pad * 2));
  return left >= 0 && top >= 0 && left + cardW <= vw + 0.01 && top + h <= vh + 0.01;
}
