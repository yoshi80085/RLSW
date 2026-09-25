// 🎭 SEAT PORTRAIT — the chosen Spirit's head, close up, in its player's banner.
//
// Alex, 2026-09-25: "after choosing a Spirit - That Spirit should appear in the
// Player window. Right now, after a Spirit is selected, it is nowhere to be
// found, only words reading Player 1 and the chosen Spirit below. Can you put a
// close up of their heads maybe in that banner area, and make it look cool?"
//
// ⭐ IT IS THE STANDEE'S PRINT, CUT THE STANDEE'S WAY. The head is the Spirit's
// own art (`sp.imageSrc`), clipped to the SAME `body` ring the acrylic is cut
// from (`STANDEE_OUTLINES[id].body.art`), and edged along the SAME `panel` ring in
// the player's colour — so the banner reads as a close-up of the piece that
// stands on the board, not as a second drawing of it. The Ronin's lightning is
// gone here for the reason it is gone there.
//
// 🎨 THE ONLY COLOUR IS THE PLAYER'S (Alex, 2026-09-25). The edge, the panel,
// the numeral and the duotone all take `color` — the seat's corner colour.
//
// 📌 NO MEASURING. The figure is an SVG whose viewBox is a very wide window onto
// the art with `slice`, so the browser fits it to the banner's HEIGHT and centres
// the head on `anchorX` by CSS alone. The head's size is therefore a function of
// the banner height (a lever, in px), never of the seat's width — a 4-player
// seat shows the same head as a 2-player one, just with less shoulder.
//
// ⭐ ALEX'S DIAL-IN, 2026-09-25, off `.scratch/seat-portrait-preview.html`: 5 of
// 33 levers moved — height 118 → 141, width .58 → .73, panelAlpha .5 → .6,
// slant 16 → 18, enterMs 520 → 760. Every head focus was left where it was.
// ("Looks rad. Lets wire it in!") The page reads its defaults FROM this file, so
// the two cannot drift; `seatPortraitCheck` §0 pins the numbers.
// 📌 The page stores his settings per browser; this file is the only copy the game has.
import { STANDEE_OUTLINES } from '../board/standeeOutlines.js';

export const SEAT_PORTRAIT = Object.freeze({
  height:141, width:0.73, headFill:0.9, anchorX:0.6, anchorY:0.38, breakout:28,
  cut:'body', edge:'on', edgeWidth:2, edgeGlow:9,
  look:'full', rim:'on', panel:'stripes', panelAlpha:0.6, slant:18,
  numeral:'on', enter:'slide', enterMs:760, idle:'drift',
  inactive:'dim', empty:'ghost',
});

/**
 * 🎯 Where each Spirit's HEAD is in its art: centre `x`, `y` and the head's
 * height `h`, all as fractions of the image (x of its width, y and h of its
 * height, y from the TOP — the outlines' own convention). Read off the art and
 * kept unchanged in the 2026-09-25 dial-in; the preview has a slider for each.
 */
export const HEAD_FOCUS = Object.freeze({
  cosmic_ronin:      Object.freeze({ x:0.555, y:0.14, h:0.27 }),
  intergalactic_0:   Object.freeze({ x:0.56,  y:0.25, h:0.24 }),
  Metalness_Monster: Object.freeze({ x:0.465, y:0.18, h:0.22 }),
  Glamarchy:         Object.freeze({ x:0.47,  y:0.13, h:0.25 }),
});
const FALLBACK_FOCUS = Object.freeze({ x:0.5, y:0.16, h:0.3 });

// ── pure ─────────────────────────────────────────────────────────────────────

/** The art's width over its height, from the traced outline's own pixel size. */
export function artAspect(id) {
  const o = STANDEE_OUTLINES[id];
  return o ? o.w / o.h : 1;
}

export const focusFor = (id, overrides) => overrides?.[id] ?? HEAD_FOCUS[id] ?? FALLBACK_FOCUS;

/**
 * 📐 The SVG viewBox, in ART units (the image is `aspect` wide and 1 tall).
 *
 * The figure layer is `height + breakout` px tall. The head (`focus.h` of the
 * art) must fill `headFill × height` px of it, and its centre must sit
 * `breakout + anchorY × height` px from the layer's top. ⚠️ The width is
 * deliberately enormous (`WIDE` × the height): with `preserveAspectRatio slice`
 * the browser scales by whichever axis needs MORE, so a window wider than any
 * banner makes that axis the height, every time, at every seat count.
 */
export const WIDE = 40;
export function portraitViewBox(focus, aspect, P = SEAT_PORTRAIT) {
  const layer = P.height + P.breakout;
  const vh = (focus.h / P.headFill) * (layer / P.height);
  const top = focus.y - ((P.breakout + P.anchorY * P.height) / layer) * vh;
  const vw = vh * WIDE;
  return { x:focus.x * aspect - vw / 2, y:top, w:vw, h:vh };
}

/** A ring set (0…1 of the image) as one SVG path in art units. Several rings = several pieces. */
export function ringsPath(rings, aspect) {
  return (rings ?? []).map(r => r.length
    ? 'M' + r.map(([x, y]) => `${+(x * aspect).toFixed(4)},${+y.toFixed(4)}`).join('L') + 'Z'
    : '').join('');
}

/** The print's clip (the figure) and the neon edge (the panel ring round it), or null for `cut:'full'`. */
export function cutPaths(id, P = SEAT_PORTRAIT) {
  const o = STANDEE_OUTLINES[id];
  if (!o || P.cut === 'full') return null;
  const aspect = o.w / o.h, c = o[P.cut] ?? o.body;
  return { clip:ringsPath(c.art, aspect), edge:ringsPath(c.panel, aspect) };
}

/** `#rrggbb` → [r, g, b] in 0…1, for the duotone's transfer tables. */
export function rgb01(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return [0.62, 0.7, 0.8];
  const n = parseInt(m[1], 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

/**
 * The duotone ramp for one channel: near-black navy → the player's colour →
 * white. As `feFuncX tableValues`, so the shadows stay dark, the mid-tones ARE
 * the player, and the highlights still read.
 */
export function duotoneTable(hex) {
  const shadow = [0.02, 0.03, 0.07], c = rgb01(hex);
  return c.map((v, i) => `${shadow[i]} ${v.toFixed(3)} 1`);
}
