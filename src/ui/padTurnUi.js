// ─── 🎮 THE PAD-TURN PORT — the data half of its three components ───────────
// `PoolWheel.jsx`, `PadButtonBar.jsx` and `PadCross.jsx` export components only (the
// house rule `scaleWheelModel.js` set: fast refresh needs it); their CSS, geometry, the
// key names and the pad/mouse hook live here. Pure, apart from the DOM reads named.
import { useSyncExternalStore } from 'react';
import { PAD_TURN, CROSS_MAPS, stickClock } from '../input/padTurn.js';
import { PAD_RING, INPUT_MODE_EVENT, INPUT_MODE_ATTR } from '../input/padFocus.js';

const RING = PAD_RING.color;
/** Wheel units (`ScaleWheel.jsx`): centre 180, note slots on radius 118. */
export const POOL_C = 180, POOL_R = 118;
const C = POOL_C, R = POOL_R;

// ── 🎡 the pool wheel (`PoolWheel.jsx`) ──
/** The pool's CSS — the game injects it from `GameStyles`, the preview from its page. */
export const POOL_WHEEL_CSS = `
  .pw-box { position:relative; box-sizing:border-box; }
  /* ⚠️ THE WHEEL SHRINKS WITH ITS BOX (a short or narrow screen caps it), and every
     layer must shrink WITH it: the ScaleWheel's svg already does ('.sw' max-width), so
     the pad layer and the curse's overlay follow the box rather than their px size. */
  .pw-pad { position:absolute; left:0; top:0; width:100%; height:auto; pointer-events:none; overflow:visible; z-index:2; }
  .pw-box .cw-over { width:100% !important; height:auto !important; }
  /* 🪟 the disc: centred on the wheel (the box is the wheel's square plus the readout line
     under it), its size, colour, glass and glow from \`poolDiscStyle\` (the levers). */
  .pw-disc { position:absolute; aspect-ratio:1; border-radius:50%; pointer-events:none; z-index:0; }
  .pw-box > .sw-wrap, .pw-box > .cw-wrap { position:relative; z-index:1; }
  .pw-box .sw-readout { position:relative; z-index:1; padding:2px 10px; border-radius:9px; background:rgba(6,10,24,.82); }
  .pw-pick { animation:pw-breathe 1.4s ease-in-out infinite; filter:drop-shadow(0 0 6px ${RING}); }
  .pw-hammer { animation:pw-breathe 1s ease-in-out infinite; }
  @keyframes pw-breathe { 0%,100% { opacity:1; } 50% { opacity:.6; } }
  @media (prefers-reduced-motion: reduce) { .pw-pick, .pw-hammer { animation:none; } }
`;

const TINT = { navy: [6, 10, 24], black: [0, 0, 0] };
const hexRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h ?? ''); const n = m ? parseInt(m[1], 16) : 0x80e8ff; return [n >> 16, (n >> 8) & 255, n & 255]; };
/**
 * 🪟 The pool's window — the disc behind the wheel — as an inline style, from the levers
 * (`PAD_TURN.poolDisc*`, Alex: *"dark but not totally opaque … control the level of
 * transparency"*). ONE function, so `.scratch/pool-window-preview.html` and the match draw
 * the same glass. ⚠️ At the defaults it is byte-for-byte the shipped first pass.
 * @param look `{ disc, edge, blur, tint, size, rim, soft }` — any missing → PAD_TURN
 */
export function poolDiscStyle(look = {}, accent = '#80e8ff') {
  const a = look.disc ?? PAD_TURN.poolDisc, edge = look.edge ?? PAD_TURN.poolDiscEdge, blur = look.blur ?? PAD_TURN.poolBlur;
  const size = look.size ?? PAD_TURN.poolDiscSize, rim = look.rim ?? PAD_TURN.poolDiscRim, soft = look.soft ?? PAD_TURN.poolDiscSoft;
  const tint = look.tint ?? PAD_TURN.poolDiscTint;
  // 'spirit': a dark wash of the accent (a fifth of it over the navy), so the glass carries the Spirit's colour
  const rgb = tint === 'spirit' ? hexRgb(accent).map((c, i) => Math.round(TINT.navy[i] * .8 + c * .2)) : (TINT[tint] ?? TINT.navy);
  const c = `${rgb[0]},${rgb[1]},${rgb[2]}`, r = n => +n.toFixed(4);
  const off = `${r((100 - size) / 2)}%`;   // ⚠️ a % margin is of the WIDTH, so top and left move together and the disc stays round on the wheel
  const glow = (p) => `color-mix(in srgb, ${accent} ${r(Math.min(100, p * rim))}%, transparent)`;
  const style = { left: off, top: 0, marginTop: off, width: `${r(size)}%`,
    background: `radial-gradient(circle, rgba(${c},${r(a)}) 0 62%, rgba(${c},${r(a * edge)}) 100%)`,
    WebkitBackdropFilter: `blur(${blur}px)`, backdropFilter: `blur(${blur}px)`,
    boxShadow: [rim > 0 && `0 0 0 1px ${glow(38)}`, rim > 0 && `0 0 46px -6px ${glow(45)}`, `inset 0 0 40px rgba(0,0,0,${r(Math.min(.55, a * .625))})`].filter(Boolean).join(', ') };
  // a soft edge fades the glass out over the last `soft`% of the radius (the mask also takes the glow ring, which is outside it)
  if (soft > 0) style.WebkitMaskImage = style.maskImage = `radial-gradient(closest-side, #000 ${r(100 - soft)}%, transparent 100%)`;
  return style;
}
/**
 * 🪟 The arena's dim round the pool — the gradient, in CSS custom properties so the
 * match's media query and the preview set the numbers: `--pool-dim` (PAD_TURN.poolDim),
 * `--pool-hole` (poolDimHole), `--pool-reach` (poolDimReach, px). `at` = the wheel's centre.
 */
export const poolScrimGradient = at => `radial-gradient(circle at ${at}, rgba(3,6,16,calc(var(--pool-dim) * var(--pool-hole, .55))) 0, rgba(3,6,16,var(--pool-dim)) var(--pool-reach, 340px))`;

/**
 * The pointer's eased angle and fade, one step: `{ a, o }` → the next `{ a, o }`.
 * ⚠️ It EASES toward the stick and fades in and out, so a thumb's jitter reads as
 * a glide rather than a twitching line (Alex, 14 Oct, on the first-pass needle:
 * *"looks a little 'crude'"*). Exported so the preview and the check share it.
 */
export function easePointer(prev, stick, dead = PAD_TURN.wheelDead) {
  let { a = null, o = 0 } = prev ?? {};
  const m = stick?.m ?? 0, out = m > .12;
  if (out) {
    const want = stickClock(stick.x, stick.y);
    a = a == null ? want : a + ((((want - a) % 360) + 540) % 360 - 180) * .45;
  }
  o += ((out ? (m >= dead ? 1 : .38) : 0) - o) * .3;
  return { a, o: o < .005 ? 0 : o };
}

/** The pointer's SVG, in wheel units, for an eased angle (`deg` clockwise from up). */
export function pointerShapes(deg, chip = PAD_TURN.wheelChip, stickM = 1) {
  const th = deg * Math.PI / 180, ux = Math.sin(th), uy = -Math.cos(th), px = Math.cos(th), py = Math.sin(th);
  const P = (r, w = 0) => [C + ux * r + px * w, C + uy * r + py * w];
  const r0 = 37, r1 = R - chip / 2 - 7, rb = r0 + (r1 - r0) * .3;
  const pts = a => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [bx, by] = P(r0), [tx, ty] = P(r1), [cx0, cy0] = P(r0 + 8), [lx, ly] = P(34 + 54 * Math.min(1, stickM || 1));
  const arcD = (r, half) => {
    const [x0, y0] = [C + r * Math.sin(th - half), C - r * Math.cos(th - half)], [x1, y1] = [C + r * Math.sin(th + half), C - r * Math.cos(th + half)];
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  return {
    bx, by, tx, ty, cx0, cy0, lx, ly,
    blade: pts([P(r0, -4.2), P(rb, -6), P(r1 - 3, -1.2), P(r1), P(r1 - 3, 1.2), P(rb, 6), P(r0, 4.2)]),
    jewel: pts(Array.from({ length: 6 }, (_, i) => { const a = th + i * Math.PI / 3; return [tx + 5.2 * Math.cos(a), ty + 5.2 * Math.sin(a)]; })),
    bezel: arcD(36.5, .34), rimWide: arcD(140, .3), rimCore: arcD(140, .15),
  };
}

// ── 🧭 the button bar (`PadButtonBar.jsx`) ──
/** 'pad' | 'mouse' — the last device used (`input/padFocus.js`), live.
 *  ⚠️ guarded twice over: SSR has no `document`, and the render suite's stub has one
 *  with no attributes. A store subscription, not an effect, so a flip never cascades. */
const readMode = () => (typeof document !== 'undefined' && typeof document.documentElement?.getAttribute === 'function'
  && document.documentElement.getAttribute(INPUT_MODE_ATTR) === 'pad' ? 'pad' : 'mouse');
const subscribeMode = cb => {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return () => {};
  document.addEventListener(INPUT_MODE_EVENT, cb);
  return () => document.removeEventListener(INPUT_MODE_EVENT, cb);
};
export function usePadMode() {
  return useSyncExternalStore(subscribeMode, readMode, () => 'mouse');
}

/** The key a mouse-and-keyboard player presses for the same verb (`hint` names it). */
export const MOUSE_KEY = Object.freeze({ A: 'Click', B: 'Esc', X: '⌫', Y: '⏎', RB: 'Tab', LB: 'W', View: '—', RT: 'H', RS: 'H',
  LS: 'a–g', Dpad: 'Click', LSwalk: 'Numpad', LSaim: 'Click' });

export const PAD_BAR_CSS = `
  .pb-bar { position:absolute; z-index:44; display:flex; gap:14px; align-items:center; padding:7px 14px; border-radius:6px;
    background:linear-gradient(180deg, #0a1224ee, #060b18f2); border:1px solid #23314f; box-shadow:0 6px 24px #0008;
    white-space:nowrap; pointer-events:none; color:#dfe8ff; }
  .pb-bottom { left:50%; bottom:12px; transform-origin:50% 100%; }
  .pb-top { left:50%; top:52px; transform-origin:50% 0; }
  .pb-left { left:12px; bottom:12px; transform-origin:0 100%; }
  .pb-verb { display:inline-flex; align-items:center; gap:6px; }
  .pb-verb em { font-style:normal; font-size:12px; color:#dfe8ff; }
  .pb-face { display:inline-grid; place-items:center; width:20px; height:20px; border-radius:50%; border:1.5px solid; font:700 11px Saira, sans-serif; }
  .pb-stick { display:inline-grid; place-items:center; width:20px; height:20px; border-radius:50%; border:1.5px dashed; font:700 10px Saira, sans-serif; color:#cde; }
  .pb-bump { display:inline-grid; place-items:center; min-width:26px; height:17px; padding:0 4px; border-radius:7px 7px 4px 4px; border:1.5px solid; font:700 9px Saira, sans-serif; color:#cde; }
  .pb-dpad { display:inline-grid; place-items:center; width:20px; height:20px; font-size:13px; color:#cde; }
  .pb-key { display:inline-grid; place-items:center; min-width:22px; height:19px; padding:0 5px; border-radius:3px; border:1px solid #5a6a8a;
    border-bottom-width:2px; font:11px 'Share Tech Mono', monospace; color:#dfe8ff; background:#121b33; }
`;

// ── ✚ the cross (`PadCross.jsx`) ──
/** The rail button a cross direction stands for, or null. `sig1` / `sig2` are the
 *  first and second SIGNATURE buttons on the rail, in its order. */
export function crossButton(doc, dir, map = CROSS_MAPS[PAD_TURN.crossMap]) {
  const want = map?.[dir];
  if (!want || !doc) return null;
  if (want === 'sig1' || want === 'sig2') return [...doc.querySelectorAll('[data-pad-ability^="sig:"]')][want === 'sig1' ? 0 : 1] ?? null;
  return doc.querySelector(`[data-pad-ability="${want}"]`);
}

export const PAD_CROSS_CSS = `
  .pc-cross { position:fixed; inset:0; pointer-events:none; z-index:43; }
  .pc-chip { position:fixed; display:flex; align-items:center; gap:5px; padding:4px 8px 4px 6px; border-radius:5px;
    background:#0b1226e6; border:1.4px solid var(--acc); color:#dfe8ff; font:600 11px Saira, sans-serif; white-space:nowrap;
    box-shadow:0 4px 14px #0009; }
  .pc-chip i { font-style:normal; font-size:9px; color:#9ab; }
  .pc-chip.on { border-color:var(--ring); box-shadow:0 0 12px -2px var(--ring); }
  .pc-chip.off { opacity:.42; border-color:#556; }
`;
