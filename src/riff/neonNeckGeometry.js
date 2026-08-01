// =============================================================================
// riff/neonNeckGeometry.js — 🎸 GENERATED — do not edit by hand.
// -----------------------------------------------------------------------------
// String/fret pixel geometry for neon_guitar_neck.png, measured off the artwork
// by riff/calibrateNeonNeck.mjs. Re-run that script if the art changes:
//     node src/riff/calibrateNeonNeck.mjs
//
// Coordinates are in the ASSET's own pixel space (2425×598),
// which is what NeonNeck.jsx uses as its SVG viewBox.
//
// Detection quality — string fits, max residual (px):
//   0.36, 0.35, 0.35, 0.34, 0.34, 1.76
// Fret wires found: 21. Nut extrapolated at source-x 2224.6
// (scale length 5646.8px, temperament exponent k=9.961).
// =============================================================================

/** Natural size of the neck artwork, in its own pixel space. */
export const NECK_IMG = {"w":2425,"h":598,"src":"neon_guitar_neck.png"};

/** Highest fret the riff engine may voice (mirrors guitarMap.MAX_FRET). */
export const NECK_MAX_FRET = 12;

/** x of each fret WIRE, index = fret number. wireX[0] is the nut. */
export const WIRE_X = [224.76,456,658.2,858.6,1041,1213.2,1379.4,1537.8,1683.6,1818,1951.2,2076.6,2149.2];

/**
 * x where a note marker for a given fret sits: the middle of the fret cell.
 * Index 0 is the open string — placed BEHIND the nut, over the headstock,
 * the way a real player reads an open note.
 */
export const FRET_X = [127.64,340.38,557.1,758.4,949.8,1127.1,1296.3,1458.6,1610.7,1750.8,1884.6,2013.9,2112.9];

/**
 * Each string as a line y = m·x + b in asset space. Index 0 = low E, 5 = high e
 * — the same order as guitarMap.STRING_NAMES, so a voiced position
 * [string, fret] indexes straight in.
 *
 * On this artwork the low E is the BOTTOM line and the high e is the TOP one,
 * so these are stored bottom-up relative to the image. Do not "fix" that by
 * sorting on y: see STRING_GAUGE_PX for the evidence.
 */
export const STRING_LINES = [{"m":0.0342663,"b":378.356},{"m":0.0281012,"b":332.391},{"m":0.0214316,"b":286.448},{"m":0.0099918,"b":244.336},{"m":0.0020145,"b":200.114},{"m":-0.0054525,"b":150.041}];

/**
 * Measured drawn thickness (px, half-max) of each string in the artwork, same
 * index order. A guitar's low E is its fattest string, so this MUST descend
 * from index 0 to index 5 — that is what pins the index order to the art
 * rather than to an assumption about which way up the neck was drawn.
 * Asserted in riff/neonNeck.test.mjs.
 */
export const STRING_GAUGE_PX = [11.98,11.86,11.02,9.62,8.29,6.02];

/** y of string `s` at horizontal position `x`. */
export function stringY(s, x) {
  const l = STRING_LINES[s] ?? STRING_LINES[0];
  return l.m * x + l.b;
}

/** Centre of the cell for a voiced [string, fret] position. */
export function cellXY(string, fret) {
  const x = FRET_X[Math.max(0, Math.min(NECK_MAX_FRET, fret))] ?? FRET_X[0];
  return { x, y: stringY(string, x) };
}

/**
 * Perpendicular string spacing at `x` — the natural unit for ring sizing, so
 * markers stay proportional as the neck fans out toward the body.
 *
 * ALWAYS POSITIVE. Index 0 (low E) is the BOTTOM string, so string 5 sits at a
 * SMALLER y and the raw difference is negative; taking it unsigned here is what
 * keeps callers from silently computing negative radii and zoom factors.
 */
export function stringPitch(x) {
  return Math.abs(stringY(5, x) - stringY(0, x)) / 5;
}

/** Full distance from the low E to the high e at `x`. Always positive. */
export function stringSpan(x) {
  return stringPitch(x) * 5;
}
