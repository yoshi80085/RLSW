# 🎭 STANDEE ART — turn a white-background drawing into a game standee.
#
# Alex, 2026-10-06: a new Shredding Ronin, plus his two Thrash phases (Thrash1 =
# the shamisen over his head, Thrash2 = the clash) and a 'hit' picture for
# when he is thrown back. They came in as flat RGB on white; the board's
# standee needs real transparency (`standee.js` draws the print with alphaTest
# .45) and an outline traced off that transparency (`standeeOutlines.js`).
#
# This script does both, for every drawing registered in ART below:
#
#   1. KEY — the masters live in `src/standees/source/` (exactly as drawn, white
#      background, never edited). The white that touches the frame — plus any
#      white pocket bigger than POCKET, like the gap between his raised arms —
#      becomes transparent, and the anti-aliased rim against it is un-mixed from
#      the white, so the ink keeps a clean dark edge. Written to
#      `src/standees/<name>.png` (RGBA), which is what the game imports.
#   2. CROP — to the figure (the `body` cut below), with the clear margin
#      round it and NOTHING under the feet: `standee.js` stands the bottom edge
#      of the image on the deck, so white space under a drawing is a Spirit
#      floating over its hex. Every drawing is cropped the same way at its own
#      pixel scale, and a pose's record keeps its own `h`, so the game can draw
#      each pose at the size it was drawn (`standee.js` `poseHeight`).
#   3. TRACE — the same `tight` / `body` cuts as `.scratch/trace-standees.py`
#      (same thresholds, same steps: glow off, thin strokes off, loose crumbs
#      off), so a new drawing is cut exactly like the old ones were.
#   4. SPLICE (--splice) — writes the records into `src/board/standeeOutlines.js`
#      and the same text into `.scratch/standee-preview.html`'s OUTLINES block
#      (`test:standee` §0 needs the two identical), and puts the base drawing
#      into that page's baked-in ART so the page shows the new art too.
#
# A pose (`cosmic_ronin:thrash1`) is stored INSIDE its Spirit's record, under
# `poses`, so the preview page and anything else that walks the roster never
# mistakes it for a fifth Spirit.
#
# Run from the repo root:   python scripts/standee-art.py [--splice]
# New drawing for him?      drop it in src/standees/source/ under the same name
#                           and run this again with --splice.
import base64, io, json, os, re, sys
import cv2
import numpy as np

# id (or id:pose) → file name, without .png, in src/standees/source/
ART = {
    'cosmic_ronin':         'Cosmic_Ronin',
    'cosmic_ronin:thrash1': 'Cosmic_Ronin_Thrash1',
    'cosmic_ronin:thrash2': 'Cosmic_Ronin_Thrash2',
    'cosmic_ronin:hit':     'Cosmic_Ronin_hit',
}

# ✂️ EFFECTS PAINTED SOLID. The old art's glows were soft alpha, so the tracer's
# "glow off" step found them; on a white-background drawing an effect is solid
# paint and nothing tells it from the figure. Where one TOUCHES the figure (the
# Thrash2 swoosh and burst run into the shamisen's drum), it is erased here by
# hand — a polygon in 0…1 of the image, y from the top — before the trace, from
# the print as well as the cut (Alex, 2026-09-25: "other 'effect' areas should
# be cut off"). Loose shards and speed lines need nothing: the trace drops them.
ERASE = {
    'cosmic_ronin:thrash2': [[  # the swoosh over his hat and the burst past the drum
        (0.20, 0.00), (1.00, 0.00), (1.00, 0.85), (0.955, 0.85), (0.86, 0.775),
        (0.76, 0.685), (0.70, 0.635), (0.88, 0.53), (0.875, 0.385), (0.74, 0.35),
        (0.63, 0.285), (0.60, 0.20), (0.52, 0.125), (0.40, 0.125), (0.20, 0.11)]],
}

# ── keying ───────────────────────────────────────────────────────────────────
PAPER  = 236     # a pixel this light on every channel …
CHROMA = 14      # … and this grey (max − min) is paper, not paint
POCKET = 0.0001  # an enclosed paper pocket this big (× the image area) is background too
RIM    = 3       # px: the anti-aliased band un-mixed from the white

# ── tracing — ⚠️ the same numbers as .scratch/trace-standees.py ─────────────
ALPHA = 115      # == the art plane's alphaTest .45
SOLID = 230
GLOW  = 0.004
THIN  = 0.008
LIP   = 0.020
MINP  = 0.012
ell = lambda n: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (max(3, n | 1),) * 2)


def key(rgb):
    """White paper → transparent. Returns RGBA uint8."""
    a = rgb.astype(np.float32)
    mn, mx = a.min(2), a.max(2)
    paper = ((mn >= PAPER) & (mx - mn <= CHROMA)).astype(np.uint8)
    n, lab, st, _ = cv2.connectedComponentsWithStats(paper, connectivity=8)
    h, w = paper.shape
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    big = {i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= POCKET * h * w}
    bg = np.isin(lab, list(edge | big))
    white = float(np.median(a[bg])) if bg.any() else 255.0
    # The rim: pixels next to the paper are a mix of ink and white. Un-mix them.
    rim = cv2.dilate(bg.astype(np.uint8), ell(RIM * 2 + 1)).astype(bool) & ~bg
    lum = a.mean(2)
    alpha = np.ones((h, w), np.float32)
    alpha[bg] = 0
    alpha[rim] = np.clip(1 - lum[rim] / white, 0, 1)
    out = a.copy()
    k = rim & (alpha > 0.02)
    out[k] = np.clip((a[k] - (1 - alpha[k, None]) * white) / alpha[k, None], 0, 255)
    # ⚠️ Transparent pixels carry INK colour, not white: a texture sample at the
    # cut blends its neighbours, and white there is a pale halo round the figure.
    out[alpha <= 0.02] = 0
    return np.dstack([out, alpha * 255]).round().astype(np.uint8)


def chaikin(pts, it=2):
    for _ in range(it):
        out, n = [], len(pts)
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]
            out.append((0.75*a[0] + 0.25*b[0], 0.75*a[1] + 0.25*b[1]))
            out.append((0.25*a[0] + 0.75*b[0], 0.25*a[1] + 0.75*b[1]))
        pts = out
    return pts

def decimate(pts, keep):
    if len(pts) <= keep: return pts
    step = len(pts) / keep
    return [pts[int(i * step)] for i in range(keep)]

def area(pts):
    return 0.5 * sum(pts[i][0]*pts[(i+1) % len(pts)][1] - pts[(i+1) % len(pts)][0]*pts[i][1] for i in range(len(pts)))

def contours(mask, keep, eps_frac):
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cs = sorted(cs, key=cv2.contourArea, reverse=True)
    if not cs: return []
    big, out = cv2.contourArea(cs[0]), []
    for c in cs:
        if cv2.contourArea(c) < big * MINP or len(c) < 4: continue
        p = cv2.approxPolyDP(c, eps_frac * cv2.arcLength(c, True), True).reshape(-1, 2).astype(float)
        if len(p) >= 3: out.append(decimate(chaikin([tuple(q) for q in p], 2), keep))
    return out

def figure(alpha, h):
    """The physical standee: glow off, thin strokes off, loose crumbs off."""
    drawn = (alpha >= ALPHA).astype(np.uint8) * 255
    ink = cv2.dilate((alpha >= SOLID).astype(np.uint8) * 255, ell(int(round(h * GLOW))))
    m = cv2.morphologyEx(cv2.bitwise_and(drawn, ink), cv2.MORPH_OPEN, ell(int(round(h * THIN))))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if n > 2:
        big = st[1:, cv2.CC_STAT_AREA].max()
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] < big * MINP: m[lab == i] = 0
    return cv2.morphologyEx(m, cv2.MORPH_CLOSE, ell(int(round(h * 0.012))))

def crop(rgba):
    """To the figure, plus the lip all round — except under the feet."""
    H, W = rgba.shape[:2]
    ys, xs = np.nonzero(figure(rgba[:, :, 3], H))
    m = int(np.ceil(LIP * H)) + 4
    x0, x1, y0, y1 = xs.min() - m, xs.max() + 1 + m, ys.min() - m, ys.max() + 1
    out = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
    sx0, sy0 = max(0, x0), max(0, y0)
    out[sy0 - y0:min(H, y1) - y0, sx0 - x0:min(W, x1) - x0] = rgba[sy0:min(H, y1), sx0:min(W, x1)]
    return out


def trace(rgba):
    h, w = rgba.shape[:2]
    norm = lambda pts: (lambda p: [list(q) for q in (p if area(p) > 0 else p[::-1])])(
        [(round(x / w, 4), round(y / h, 4)) for x, y in pts])
    m0 = (rgba[:, :, 3] >= ALPHA).astype(np.uint8) * 255
    tight = cv2.morphologyEx(m0, cv2.MORPH_CLOSE, ell(int(round(h * 0.012))))
    body = figure(rgba[:, :, 3], h)
    d = ell(int(round(h * LIP * 2)))
    rec = {'w': w, 'h': h, 'foot': 1.0}
    for name, (m, ka, ea, kp, ep) in {'tight': (tight, 300, 0.0009, 240, 0.0013),
                                       'body': (body, 260, 0.0010, 220, 0.0014)}.items():
        art, panel = contours(m, ka, ea), contours(cv2.dilate(m, d), kp, ep)
        rec[name] = {'art': [norm(c) for c in art], 'panel': [norm(c) for c in panel]}
    return rec, body


# ── the record, in standeeOutlines.js's own layout ───────────────────────────
j = lambda v: json.dumps(v, separators=(',', ':'))

def record_text(sid, rec, poses):
    L = [f'  "{sid}": {{ w:{rec["w"]}, h:{rec["h"]}, foot:{rec["foot"]},',
         f'    tight:{{ panel:{j(rec["tight"]["panel"])},',
         f'            art:{j(rec["tight"]["art"])} }},',
         f'    body: {{ panel:{j(rec["body"]["panel"])},',
         f'            art:{j(rec["body"]["art"])} }}' + (',' if poses else ' },')]
    if poses:
        L.append('    poses:{')
        for i, (name, p) in enumerate(poses.items()):
            L += [f'      "{name}": {{ w:{p["w"]}, h:{p["h"]}, foot:{p["foot"]},',
                  f'        tight:{{ panel:{j(p["tight"]["panel"])},',
                  f'                art:{j(p["tight"]["art"])} }},',
                  f'        body: {{ panel:{j(p["body"]["panel"])},',
                  f'                art:{j(p["body"]["art"])} }} }}' + (',' if i < len(poses) - 1 else '')]
        L.append('    } },')
    return L

def splice_outlines(text, sid, lines):
    """Replace the whole `"sid": { … },` record (it ends at the next top-level key or `};`)."""
    rows = text.split('\n')
    start = next(i for i, r in enumerate(rows) if r.startswith(f'  "{sid}": {{ w:'))
    end = next(i for i in range(start + 1, len(rows)) if re.match(r'  "\w+": \{ w:', rows[i]) or rows[i].startswith('};'))
    return '\n'.join(rows[:start] + lines + rows[end:])

def rw(path, fn):
    raw = open(path, encoding='utf-8', newline='').read()
    crlf = '\r\n' in raw
    new = fn(raw.replace('\r\n', '\n'))
    open(path, 'w', encoding='utf-8', newline='').write(new.replace('\n', '\r\n') if crlf else new)


def main():
    src, dst = os.path.join('src', 'standees', 'source'), os.path.join('src', 'standees')
    recs, keyed = {}, {}
    for sid, name in ART.items():
        rgb = cv2.cvtColor(cv2.imread(os.path.join(src, name + '.png'), cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB)
        rgba = key(rgb)
        h, w = rgba.shape[:2]
        for poly in ERASE.get(sid, []):
            cut = np.zeros((h, w), np.uint8)
            cv2.fillPoly(cut, [np.array([[x * w, y * h] for x, y in poly], np.int32)], 1)
            rgba[cut.astype(bool)] = 0
        rgba = crop(rgba)
        keyed[sid] = rgba
        cv2.imwrite(os.path.join(dst, name + '.png'), cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
        rec, _ = trace(rgba)
        recs[sid] = rec
        print(f"{sid:22} {rgba.shape[1]}×{rgba.shape[0]}  transparent {100 * (rgba[:, :, 3] == 0).mean():4.1f}%  "
              f"body {len(rec['body']['art'])} piece(s) {sum(map(len, rec['body']['art']))} pts · "
              f"tight {sum(map(len, rec['tight']['art']))} pts")

    if '--splice' not in sys.argv: return
    spirits = sorted({k.split(':')[0] for k in ART})
    def outlines(text):
        for sid in spirits:
            poses = {k.split(':')[1]: recs[k] for k in ART if k.startswith(sid + ':')}
            text = splice_outlines(text, sid, record_text(sid, recs[sid], poses))
        return text
    rw(os.path.join('src', 'board', 'standeeOutlines.js'), outlines)
    print('spliced into src/board/standeeOutlines.js')

    page = os.path.join('.scratch', 'standee-preview.html')
    if os.path.exists(page):
        shipped = open(os.path.join('src', 'board', 'standeeOutlines.js'), encoding='utf-8').read().replace('\r\n', '\n')
        obj = shipped[shipped.index('export const STANDEE_OUTLINES = ') + len('export const STANDEE_OUTLINES = '):].rstrip('\n')
        def preview(text):
            a, b = text.index('const OUTLINES = '), text.index('\nconst ART = ')
            text = text[:a] + 'const OUTLINES = ' + obj + '\n' + text[b:]
            for sid in spirits:   # the page's baked-in print, as a small webp like the others
                rgba = keyed[sid]
                s = 900 / rgba.shape[0]
                small = cv2.resize(rgba, (round(rgba.shape[1] * s), 900), interpolation=cv2.INTER_AREA)
                ok, buf = cv2.imencode('.webp', cv2.cvtColor(small, cv2.COLOR_RGBA2BGRA), [cv2.IMWRITE_WEBP_QUALITY, 90])
                uri = 'data:image/webp;base64,' + base64.b64encode(buf.tobytes()).decode()
                text = re.sub(rf'"{sid}":"data:image/[a-z]+;base64,[A-Za-z0-9+/=]+"', lambda m: f'"{sid}":"{uri}"', text, count=1)
            return text
        rw(page, preview)
        print('spliced into', page)


if __name__ == '__main__':
    main()
