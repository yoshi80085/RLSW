#!/usr/bin/env node
// =============================================================================
// riff/calibrateNeonNeck.mjs — 🎸 NECK CALIBRATION (build-time, run by hand)
// -----------------------------------------------------------------------------
// Derives the string/fret pixel geometry of src/neon_guitar.png and emits
// src/riff/neonNeckGeometry.js + src/neon_guitar_neck.png (the cropped,
// downscaled asset the game actually ships).
//
// WHY A SCRIPT AND NOT HAND-TUNED CONSTANTS: the artwork is the source of
// truth. If neon_guitar.png is ever redrawn, re-run this and every ring in
// NeonNeck.jsx moves with it — no hand-fitting, no drift.
//
//   node src/riff/calibrateNeonNeck.mjs
//
// Requires Python 3 + Pillow + numpy + scipy (detection is a raster job).
// This is a DEV script — it is never imported by the app and never bundled.
// =============================================================================
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src  = path.resolve(here, '..');

const PY = String.raw`
import json, sys
import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

SRC   = sys.argv[1]
OUTPNG= sys.argv[2]
im  = Image.open(SRC).convert('RGBA')
a   = np.asarray(im).astype(np.float32)
lum = a[..., :3].mean(axis=2) * (a[..., 3] / 255.0)
del a
H, W = lum.shape

# ── 1. STRINGS ────────────────────────────────────────────────────────────────
# Six bright lines fanning across the neck. Scan columns, take the intensity
# centroid of each bright run, keep columns where exactly 6 were found.
BAND = (int(H * 0.44), int(H * 0.59))
THRESH = 70.0

def strings_at(x):
    col = lum[BAND[0]:BAND[1], x]
    out, i = [], 0
    while i < len(col):
        if col[i] > THRESH:
            j = i
            while j < len(col) and col[j] > THRESH: j += 1
            seg = col[i:j]
            out.append(BAND[0] + i + float((seg * np.arange(len(seg))).sum() / seg.sum()))
            i = j
        else:
            i += 1
    return out

# Everything in THIS FILE works in image order (index 0 = topmost line): the
# fret-wire sampler, the nut fit and the crop bounds all assume it, and an
# inverted band silently produces an empty slice rather than an error. The
# flip to guitar order happens once, at emit time — see EMIT ORDER below.
tracks = [[] for _ in range(6)]
for x in range(int(W * 0.20), int(W * 0.70), 10):
    s = strings_at(x)
    if len(s) == 6:
        for k in range(6): tracks[k].append((x, s[k]))

# Robust linear fit per string (3 rounds of outlier rejection — the body and
# headstock glows cross the outer strings and would otherwise drag the fit).
STR = []
for k in range(6):
    X = np.array([t[0] for t in tracks[k]]); Y = np.array([t[1] for t in tracks[k]])
    for _ in range(3):
        m, b = np.polyfit(X, Y, 1)
        r = np.abs(np.polyval([m, b], X) - Y)
        keep = r < max(3.0, 3 * r.std())
        X, Y = X[keep], Y[keep]
    m, b = np.polyfit(X, Y, 1)
    STR.append({'m': float(m), 'b': float(b),
                'res': float(np.abs(np.polyval([m, b], X) - Y).max()), 'n': int(len(X))})

def strY(s, x): return STR[s]['m'] * x + STR[s]['b']

# (String gauge is measured further down, on the finished asset — see GAUGE.)

# ── 2. FRET WIRES ─────────────────────────────────────────────────────────────
# Vertical lines crossing the board. Sample a thin band BETWEEN string 1 and 2
# (following the fan) so the string lines themselves never register as peaks.
xs = np.arange(int(W * 0.18), int(W * 0.75))
prof = np.empty(len(xs))
for i, x in enumerate(xs):
    y1, y2 = strY(1, x), strY(2, x)
    prof[i] = lum[int(y1 + 0.30 * (y2 - y1)):int(y1 + 0.70 * (y2 - y1)), x].mean()
sm = np.convolve(prof, np.ones(5) / 5, 'same')

peaks = [int(xs[i]) for i in range(6, len(sm) - 6)
         if sm[i] >= sm[i-1] and sm[i] > sm[i+1] and sm[i] > sm[i-6] + 1.0 and sm[i] > sm[i+6] + 1.0]
groups = []
for p in peaks:
    if groups and p - groups[-1][-1] < 25: groups[-1].append(p)
    else: groups.append([p])
cand = [int(sum(g) / len(g)) for g in groups]

# Spurious peaks: the body glow crosses the board near the upper frets. A real
# fret wire sits on a monotonically shrinking spacing curve — drop anything
# that would make the local gap collapse.
wires = [cand[0]]
for c in cand[1:]:
    gap = c - wires[-1]
    if len(wires) >= 2:
        prev = wires[-1] - wires[-2]
        if gap < prev * 0.55: continue      # too close — glow artefact
    wires.append(c)

# ── 3. THE NUT ────────────────────────────────────────────────────────────────
# Extrapolated by fitting the scale-length law x(f) = nut + S*(1 - 2**(-f/k)).
# k floats free: the art is a stylised neck, not a true equal-tempered one.
from scipy.optimize import curve_fit
fn = np.arange(1, len(wires) + 1, dtype=float)
fx = np.array(wires, dtype=float)
model = lambda f, nut, S, k: nut + S * (1 - 2.0 ** (-f / k))
(nut, S, k), _ = curve_fit(model, fn, fx, p0=[fx[0] - 400, 6000., 12.])

# ── 4. GAME RANGE + CROP ──────────────────────────────────────────────────────
MAX_FRET = 12
wire = {0: float(nut)}
for i, x in enumerate(wires): wire[i + 1] = float(x)

OPEN_BACK = (wire[1] - wire[0]) * 0.42            # open marker sits behind the nut
def fretX(f): return wire[0] - OPEN_BACK if f == 0 else (wire[f - 1] + wire[f]) / 2

x0, x1 = fretX(0), wire[min(MAX_FRET + 2, len(wires))]
padx = (wire[1] - wire[0]) * 0.55
cx0, cx1 = int(x0 - padx), int(x1 + padx)
ytop = min(strY(0, cx0), strY(0, cx1)); ybot = max(strY(5, cx0), strY(5, cx1))
pady = (ybot - ytop) * 0.42
cy0, cy1 = int(ytop - pady), int(ybot + pady)
cx0, cy0 = max(0, cx0), max(0, cy0); cx1, cy1 = min(W, cx1), min(H, cy1)

SCALE = 0.60
crop = im.crop((cx0, cy0, cx1, cy1))
out  = crop.resize((round(crop.width * SCALE), round(crop.height * SCALE)), Image.LANCZOS)
out.save(OUTPNG, optimize=True)

# Geometry re-expressed in the CROPPED, SCALED asset's own pixel space.
conv_x = lambda x: (x - cx0) * SCALE
geom = {
  'image':   {'w': out.width, 'h': out.height, 'src': OUTPNG.split('/')[-1]},
  'maxFret': MAX_FRET,
  'fretX':   [round(conv_x(fretX(f)), 2) for f in range(MAX_FRET + 1)],
  'wireX':   [round(conv_x(wire[f]), 2) for f in range(MAX_FRET + 1)],
  'strings': [{'m': round(s['m'], 7), 'b': round((s['b'] - cy0) * SCALE - s['m'] * cx0 * SCALE, 3)}
              for s in STR],
  'diag': {'nut': round(float(nut), 1), 'scaleLen': round(float(S), 1), 'k': round(float(k), 3),
           'wiresFound': len(wires), 'stringRes': [round(s['res'], 2) for s in STR],
           'crop': [cx0, cy0, cx1, cy1], 'imgScale': SCALE},
}
# strings in asset space: y' = (m*x + b - cy0)*SCALE where x = cx0 + x'/SCALE
#   => y' = m*x' + (m*cx0 + b - cy0)*SCALE
#
# ── EMIT ORDER ───────────────────────────────────────────────────────────────
# The one and only place image order becomes GUITAR order. Consumers index by
# guitarMap.STRING_NAMES = ['E','A','D','G','B','e'], so index 0 must be the low
# E. On this artwork the low E is the BOTTOM line, which is LAST in image order
# — hence the reverse. This is not an assumption about how the neck was drawn:
# GAUGE is reversed alongside it, and neonNeck.test.mjs re-derives the answer by
# asserting the emitted gauge descends (low E is the fattest string). Redraw the
# art the other way up and that test fails, which is the intended alarm.
geom['strings'] = [{'m': round(s['m'], 7),
                    'b': round((s['m'] * cx0 + s['b'] - cy0) * SCALE, 3)} for s in STR][::-1]

# ── STRING GAUGE ─────────────────────────────────────────────────────────────
# Drawn thickness of each string, at half-max, averaged along the neck —
# measured on the FINISHED asset using the emitted lines, so it describes the
# art that actually ships. (Measuring on the full-res source instead reads ~20px
# lines with a ±22px window, and the neighbouring string's glow leaks in and
# corrupts the half-max threshold; on the downscaled asset the strings are
# 5–12px apart from ~50px neighbours and separate cleanly.)
#
# This is the evidence for the index order: a guitar's low E is its FATTEST
# string, so this must DESCEND from index 0 to index 5.
oa   = np.asarray(out.convert('RGBA')).astype(np.float32)
olum = oa[..., :3].mean(axis=2) * (oa[..., 3] / 255.0)
OH, OW = olum.shape
GAUGE = []
for s in geom['strings']:
    widths = []
    for x in range(int(OW * 0.28), int(OW * 0.62), 20):
        y = int(round(s['m'] * x + s['b']))
        lo, hi = max(0, y - 14), min(OH, y + 15)
        col = olum[lo:hi, x]
        if col.size == 0 or col.max() < 40: continue
        widths.append(int((col > col.max() * 0.5).sum()))
    GAUGE.append(round(float(np.mean(widths)), 2) if widths else 0.0)
geom['gauge'] = GAUGE
print(json.dumps(geom))
`;

const assetPath = path.join(src, 'neon_guitar_neck.png');
const raw = execFileSync('python3', ['-c', PY, path.join(src, 'neon_guitar.png'), assetPath],
  { encoding: 'utf8', maxBuffer: 1 << 26 });
const g = JSON.parse(raw.trim().split('\n').pop());

const js = `// =============================================================================
// riff/neonNeckGeometry.js — 🎸 GENERATED — do not edit by hand.
// -----------------------------------------------------------------------------
// String/fret pixel geometry for neon_guitar_neck.png, measured off the artwork
// by riff/calibrateNeonNeck.mjs. Re-run that script if the art changes:
//     node src/riff/calibrateNeonNeck.mjs
//
// Coordinates are in the ASSET's own pixel space (${g.image.w}×${g.image.h}),
// which is what NeonNeck.jsx uses as its SVG viewBox.
//
// Detection quality — string fits, max residual (px):
//   ${g.diag.stringRes.join(', ')}
// Fret wires found: ${g.diag.wiresFound}. Nut extrapolated at source-x ${g.diag.nut}
// (scale length ${g.diag.scaleLen}px, temperament exponent k=${g.diag.k}).
// =============================================================================

/** Natural size of the neck artwork, in its own pixel space. */
export const NECK_IMG = ${JSON.stringify(g.image)};

/** Highest fret the riff engine may voice (mirrors guitarMap.MAX_FRET). */
export const NECK_MAX_FRET = ${g.maxFret};

/** x of each fret WIRE, index = fret number. wireX[0] is the nut. */
export const WIRE_X = ${JSON.stringify(g.wireX)};

/**
 * x where a note marker for a given fret sits: the middle of the fret cell.
 * Index 0 is the open string — placed BEHIND the nut, over the headstock,
 * the way a real player reads an open note.
 */
export const FRET_X = ${JSON.stringify(g.fretX)};

/**
 * Each string as a line y = m·x + b in asset space. Index 0 = low E, 5 = high e
 * — the same order as guitarMap.STRING_NAMES, so a voiced position
 * [string, fret] indexes straight in.
 *
 * On this artwork the low E is the BOTTOM line and the high e is the TOP one,
 * so these are stored bottom-up relative to the image. Do not "fix" that by
 * sorting on y: see STRING_GAUGE_PX for the evidence.
 */
export const STRING_LINES = ${JSON.stringify(g.strings)};

/**
 * Measured drawn thickness (px, half-max) of each string in the artwork, same
 * index order. A guitar's low E is its fattest string, so this MUST descend
 * from index 0 to index 5 — that is what pins the index order to the art
 * rather than to an assumption about which way up the neck was drawn.
 * Asserted in riff/neonNeck.test.mjs.
 */
export const STRING_GAUGE_PX = ${JSON.stringify(g.gauge)};

/** y of string \`s\` at horizontal position \`x\`. */
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
 * Perpendicular string spacing at \`x\` — the natural unit for ring sizing, so
 * markers stay proportional as the neck fans out toward the body.
 *
 * ALWAYS POSITIVE. Index 0 (low E) is the BOTTOM string, so string 5 sits at a
 * SMALLER y and the raw difference is negative; taking it unsigned here is what
 * keeps callers from silently computing negative radii and zoom factors.
 */
export function stringPitch(x) {
  return Math.abs(stringY(5, x) - stringY(0, x)) / 5;
}

/** Full distance from the low E to the high e at \`x\`. Always positive. */
export function stringSpan(x) {
  return stringPitch(x) * 5;
}
`;

const fs = await import('node:fs');
fs.writeFileSync(path.join(here, 'neonNeckGeometry.js'), js);
const kb = (fs.statSync(assetPath).size / 1024).toFixed(0);
console.log(`✅ neon_guitar_neck.png  ${g.image.w}×${g.image.h}  (${kb} KB)`);
console.log(`✅ neonNeckGeometry.js   ${g.diag.wiresFound} fret wires, string residuals ${g.diag.stringRes.join('/')} px`);
console.log(`   fret centres: ${g.fretX.slice(0, 5).join(', ')} …`);
