// ─── 💨 SPEED LINES — the lines that rush in from the edge of the screen ──────
// Alex, 2026-09-24: "The beginning *should* zoom in - but it should zoom into
// the 2 Spirits - make lines come in from the outside - the border of the
// screen to create extra drama."
//
// The manga focus-line effect (集中線): thin white wedges, fat at the border
// and tapering to a point, all aimed at the middle of the screen. They RUSH IN
// from the border as the effect rises and flicker while it holds, so the eye is
// dragged to what sits in the middle — which, under the battle director's
// two-shot, is the pair of Spirits.
//
// 📌 A DOM CANVAS OVER THE ARENA, NOT GEOMETRY IN THE SCENE. The lines belong
// to the SCREEN, not the world: they must hug the border whatever the lens is
// doing, and they must not bloom, blur (the director's depth of field) or be
// hidden by a standee. A 2D canvas is also the cheapest thing that can draw
// 120 wedges a frame.
//
// ⭐ The geometry is a PURE FUNCTION (`speedLineWedges`) so a headless check can
// ask "do the lines start at the border and point at the middle?" without a
// browser. The canvas is only the painter.

export const SPEED_LINES = Object.freeze({
  count: 120,        // how many wedges round the frame
  reach: .5,         // how far in the lines get at full strength, as a share of the half-diagonal (0 = centre)
  jitter: .16,       // how ragged the inner ends are — the hand-drawn look
  width: 9,          // a wedge's width at the border, in CSS px
  alpha: .5,         // opacity at full strength
  color: '#ffffff',
  flicker: 14,       // how many times a second the lines re-deal
  rise: 7,           // how fast the effect comes up (per second, exponential)
  fall: 3.5,         // …and how fast it goes
});

// Deterministic hash → [0,1). A cosmetic effect never touches the seeded game
// stream, and must not need Math.random either (a headless check asserts it).
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/**
 * The wedges for one frame.
 * @param width,height  the screen, CSS px
 * @param level         0 (off) … 1 (full) — the rush: at a low level the lines
 *                      are short slivers still at the border; at 1 they reach
 * @param deal          which shuffle of the ragged ends (changes `flicker`× a second)
 * @returns [{ outer:[x,y], left:[x,y], right:[x,y], inner:[x,y] }] — `outer` is
 *          past the border, `inner` is the point
 */
export function speedLineWedges(width, height, level, deal = 0, L = SPEED_LINES) {
  const cx = width / 2, cy = height / 2, R = Math.hypot(cx, cy);
  const out = [];
  if (!(level > 0)) return out;
  const eased = level * level * (3 - 2 * level);
  for (let i = 0; i < L.count; i++) {
    const a = (i + (hash(i + deal * 97) - .5) * .8) / L.count * Math.PI * 2;
    const dx = Math.cos(a), dy = Math.sin(a);
    // Where this ray leaves the screen — the wedge is fat right at the border.
    const edge = Math.min(Math.abs(dx) > 1e-6 ? cx / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? cy / Math.abs(dy) : Infinity);
    const stop = R * (L.reach + (hash(i * 3.7 + deal * 13.1) - .5) * 2 * L.jitter);
    const tip = edge - (edge - Math.min(edge * .97, stop)) * eased;
    if (tip >= edge - 1) continue;
    // The base sits a little PAST the border — far enough that a slanted wedge's
    // corners are off-screen too, so no line ever shows a flat end.
    const w = L.width * (.45 + hash(i * 9.1 + deal) * .9) / 2, px = -dy * w, py = dx * w, far = edge + 4 + w * 3;
    out.push({
      outer: [cx + dx * far, cy + dy * far],
      left: [cx + dx * far + px, cy + dy * far + py],
      right: [cx + dx * far - px, cy + dy * far - py],
      inner: [cx + dx * tip, cy + dy * tip],
    });
  }
  return out;
}

/** The painter. `update(target, dt, reduced)` every frame; `dispose()` on unmount. */
export function createSpeedLines(host, L = SPEED_LINES) {
  const canvas = document.createElement('canvas');
  canvas.dataset.arenaSpeedLines = '';
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '3', pointerEvents: 'none', display: 'none' });
  host.appendChild(canvas);
  const ctx = canvas.getContext?.('2d') ?? null;
  let level = 0, clock = 0, drawn = false;
  function update(target, dt, reduced = false) {
    // ⚠️ Reduced motion gets NO lines: flickering streaks are exactly the kind
    // of motion that setting exists to take away.
    const goal = reduced ? 0 : Math.max(0, Math.min(1, target || 0));
    const rate = goal > level ? L.rise : L.fall;
    level += (goal - level) * (1 - Math.exp(-rate * Math.max(0, dt)));
    if (goal === 0 && level < .02) level = 0;
    clock += dt;
    if (!ctx) return level;
    if (level === 0) {
      if (drawn) { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; drawn = false; }
      return level;
    }
    const w = host.clientWidth || 1, h = host.clientHeight || 1, dpr = Math.min(1.5, globalThis.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    canvas.style.display = 'block'; drawn = true;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = L.alpha * Math.min(1, level * 1.4);
    ctx.fillStyle = L.color;
    ctx.beginPath();
    for (const wedge of speedLineWedges(w, h, level, Math.floor(clock * L.flicker), L)) {
      ctx.moveTo(...wedge.left); ctx.lineTo(...wedge.inner); ctx.lineTo(...wedge.right); ctx.closePath();
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    return level;
  }
  return { update, get level() { return level; }, dispose() { canvas.remove(); } };
}
