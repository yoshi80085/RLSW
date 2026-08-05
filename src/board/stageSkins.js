// =============================================================================
// board/stageSkins.js — 🎨 STAGE SKINS — recolour the whole board, no new art
// -----------------------------------------------------------------------------
// The board renders as two stacked SVG <image>s: the painted plate (board.png)
// and a near-white line drawing (board_outline.png) composited with
// mixBlendMode:"screen" to glow. Those two layers want DIFFERENT recolouring
// techniques, which is the whole reason this file exists:
//
//   PLATE   — a full-colour painting. It has to KEEP its own light, shadow and
//             material detail, so it gets a relative CSS `hue-rotate`. Rotating
//             a hue preserves every luminance relationship in the art; flooding
//             it with a colour would flatten the stage into a silhouette.
//
//   OUTLINE — near-white line work carrying no colour information of its own.
//             It gets an SVG feColorMatrix that maps LUMINANCE onto an EXACT
//             target colour. This is the layer the eye actually reads as "the
//             board is blue now", so it must be an absolute colour, not a
//             rotation — a hue-rotate here would drift off-target on every
//             preset and the neon would never be the neon you asked for.
//
// The split is what makes the presets land: exact, chosen neon on the lines,
// tastefully shifted paint behind them.
//
// ⚠️ THE ANGLES BELOW ARE MEASURED, NOT GUESSED. Do not "tidy" them to round
// numbers — they will stop landing on their target colours.
//
// The plate's neon sits at a circular-mean hue of ~222° (blue-violet) at ~0.83
// saturation. CSS `hue-rotate` is a LINEAR MATRIX APPROXIMATION, not a true HSL
// rotation, so the output hue does NOT advance 1:1 with the angle you ask for —
// e.g. +255° of rotation lands the neon on 121° (green), not on 117°. Every
// angle here came from sweeping the real board.png through the spec matrix in
// 15° steps and reading back the resulting hue:
//
//     angle    0 →  222°   |   angle  185 →   46°  (amber)
//     angle  150 →   18°   |   angle  255 →  121°  (green)
//     angle  325 →  190°   |   angle  345 →  210°
//
// If you add a preset, re-run that sweep rather than interpolating by eye. And
// if one looks dirty, the fix is a different ANGLE plus a saturation nudge —
// never a bigger brightness value, which only fogs the plate.
//
// ⚠️ ALSO: `board_outline.png` is NOT white line art. It is a faint MAGENTA
// glow overlay — max alpha 0.45, covering ~1.4% of the frame. It still tints
// correctly (the matrix below discards the source hue entirely by collapsing to
// luminance first), but understand what you're steering: this layer sets the
// RIM GLOW, while the plate sets the body of the colour. Don't expect it to
// carry a preset on its own.
//
// The clean escape hatch, if this ever stops being enough: export a desaturated
// board.png and swap the plate's hue-rotate for the same luminance→colour
// matrix the outline already uses. Every preset would then be exact. That's a
// one-file change here plus one art export — see ARCHITECTURE.md.
// =============================================================================

// Each skin:
//   plate   — { hue: deg, sat: multiplier, bright: multiplier } for board.png
//   line    — '#rrggbb' EXACT colour the outline/glow is tinted to
//   accent  — UI colour for this preset's own button, so the picker is legible
//             at a glance without a swatch component
export const STAGE_SKINS = [
  {
    id: 'stock', label: 'HOUSE LIGHTS', icon: '🎪',
    blurb: 'The board as painted. Magenta and cyan, factory settings.',
    // Identity transform — `hue: 0, sat: 1, bright: 1` short-circuits to no
    // filter at all in stageSkinPlateFilter(), so the default costs nothing.
    plate: { hue: 0, sat: 1, bright: 1 },
    line: '#ff5ce1', accent: '#ff5ce1',
  },
  {
    id: 'ice', label: 'COLD OPEN', icon: '🧊',
    blurb: 'Arctic cyan. Reads cleanest — the standees pop hardest against it.',
    plate: { hue: 325, sat: 0.95, bright: 1.04 },   // → neon lands ~190° cyan
    line: '#19e6ff', accent: '#19e6ff',
  },
  {
    id: 'toxic', label: 'TOXIC', icon: '☢️',
    blurb: 'Radioactive green. Sickly on purpose.',
    plate: { hue: 255, sat: 0.86, bright: 1.0 },    // → ~121° green (sat pulled
    line: '#5cff6a', accent: '#5cff6a',             //   back from a lurid 0.93)
  },
  {
    id: 'inferno', label: 'PYRO', icon: '🔥',
    blurb: 'Blood-red rim over a violet floor. The stage is already on fire.',
    // ⚠️ 83°, NOT the ~150° you'd reach for if you wanted "make the grid red".
    // 150 does turn the grid red — and throws the RIM to green, because the two
    // are ~105° apart at source and the rotation carries that gap along. 83°
    // instead swings the MAGENTA rim to red and lets the grid fall to violet:
    // both land warm, so the pair reads as one deliberate scheme. When you want
    // a warm skin, steer the rim and let the grid follow.
    plate: { hue: 83, sat: 0.95, bright: 1.0 },
    line: '#ff4a1a', accent: '#ff5a2a',
  },
  // ⚠️ A 'SOLD OUT' amber preset was cut here. Every angle that puts the grid on
  // gold throws the rim into green and the whole board goes olive — the 105°
  // source gap has no warm-warm solution on that side of the wheel. If you want
  // gold, it needs the mono/luminance plate (see the header), not a rotation.
  {
    id: 'void', label: 'BLACKOUT', icon: '🌑',
    blurb: 'Desaturated to near-mono, lit in bone white. Everything else on the board screams louder.',
    plate: { hue: 0, sat: 0.18, bright: 0.92 },
    line: '#dbe7f5', accent: '#dbe7f5',
  },
];

export const STAGE_SKIN_BY_ID = Object.fromEntries(STAGE_SKINS.map(s => [s.id, s]));
export const DEFAULT_SKIN_ID = 'stock';

const LS_KEY = 'rlsw.stageSkin';

export function loadStageSkin() {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v && STAGE_SKIN_BY_ID[v]) return v;
  } catch { /* storage disabled — fall through to the default */ }
  return DEFAULT_SKIN_ID;
}

export function saveStageSkin(id) {
  try { localStorage.setItem(LS_KEY, id); } catch { /* the choice just won't persist */ }
}

/**
 * CSS filter string for the painted plate, or `undefined` for the stock skin.
 *
 * Returning undefined rather than a no-op filter chain MATTERS: any `filter` on
 * an SVG <image> forces the element onto its own composited layer, which on a
 * board this size (6522×4839 source) is a measurable cost every frame the
 * searchlight or the FX layer animates over it. The default skin must not pay
 * for a feature it isn't using.
 */
export function stageSkinPlateFilter(skinId) {
  const skin = STAGE_SKIN_BY_ID[skinId] ?? STAGE_SKIN_BY_ID[DEFAULT_SKIN_ID];
  const { hue, sat, bright } = skin.plate;
  if (hue === 0 && sat === 1 && bright === 1) return undefined;
  const parts = [];
  if (hue !== 0)   parts.push(`hue-rotate(${hue}deg)`);
  if (sat !== 1)   parts.push(`saturate(${sat})`);
  if (bright !== 1) parts.push(`brightness(${bright})`);
  return parts.join(' ');
}

/** Parse '#rrggbb' → [r, g, b] in 0–1. */
function hexToUnit(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/**
 * feColorMatrix values that collapse the outline to LUMINANCE and multiply it
 * by the skin's exact line colour.
 *
 * Row c = [Lr·Cc, Lg·Cc, Lb·Cc, 0, 0], with Rec.709 luma coefficients. A bright
 * line stays bright and lands exactly on the target colour; a dim one dims
 * toward black, which is what keeps the glow layer reading as a glow instead of
 * a flat colour wash. Alpha passes through untouched so the PNG's own
 * transparency still decides what's drawn at all.
 */
export function stageSkinLineMatrix(skinId) {
  const skin = STAGE_SKIN_BY_ID[skinId] ?? STAGE_SKIN_BY_ID[DEFAULT_SKIN_ID];
  const [cr, cg, cb] = hexToUnit(skin.line);
  const [lr, lg, lb] = [0.2126, 0.7152, 0.0722];
  const row = c => `${(lr * c).toFixed(4)} ${(lg * c).toFixed(4)} ${(lb * c).toFixed(4)} 0 0`;
  return `${row(cr)} ${row(cg)} ${row(cb)} 0 0 0 1 0`;
}
