// ── 🎛️ THE ARENA DIAL — Drive and Sustain in the 3D HUD ─────────────────────
//
// A Tron gauge, not an amp knob. Ten hard-edged light blocks for ten units, a
// white-hot block at the head, a chamfered containment frame that is BRIGHT AT
// THE CORNERS AND NEARLY DARK ALONG THE EDGES, and a break in the frame's
// bottom edge where the label sits like a nameplate.
//
// 🪦 Replaced a skeuomorphic knob 2026-09-11 — gloss highlight, inset bevel and
// a needle, plus a `repeating-conic-gradient` that sprayed spokes through all
// 360° including the 90° the scale does not use. Alex: *"looks a little funny."*
// Chosen from a four-way preview (`.scratch/drive-sustain-dials.html`) and then
// detailed in a second (`.scratch/drive-sustain-dials-c.html`).
//
// ⚠️ **NO SVG FILTERS, DELIBERATELY.** The bloom is a wide faint stroke sitting
// under the hot core stroke — the same path drawn twice. A `feGaussianBlur` or a
// `drop-shadow` here re-rasterises a filter region over the LIVE WebGL arena
// every time Drive or Sustain changes; stacked strokes cost nothing and look the
// same at this size.
//
// ⚠️ **THE LABEL'S <text> MUST STAY BEFORE THE VALUE'S.** `test:arena`'s
// `arenaFallbackCheck` reads `.match-player-pocket`'s textContent and expects
// `DRIVE6` / `SUSTAIN3` — SVG text counts toward textContent, so swapping these
// two nodes reads as `6DRIVE` and fails the suite. They do not overlap on
// screen, so source order is free to serve the contract.
//
// ⏱️ **IT TICKS, 2026-09-16.** A change no longer jumps: the dial waits a beat
// and steps one block at a time, each block flashing white as it is gained or
// red as it is lost, and the number counts along. Timing is `dialTick.js` —
// Alex's dial-in off `.scratch/drive-sustain-dial-tick.html`. `useDialTick`
// below is only the timer glue. ⚠️ **THE FIRST RENDER IS ALWAYS THE REAL
// VALUE** — the tick starts from a value already on screen, never from zero —
// so SSR and `arenaFallbackCheck`'s `DRIVE6` read the authoritative number, and
// a dial that mounts mid-match does not count up from nothing.
// ⚠️ **A NEW `snapKey` SNAPS.** The pocket shows whoever is acting, so a turn
// handoff changes both dials at once to someone else's numbers; ticking there
// would animate a change that nobody's action caused (Alex: snap).
// 📌 Under prefers-reduced-motion every change snaps, as before.
//
// 📌 Sizing is CSS, not props: the svg is `width:100%; max-width:74px`, so the
// dial follows the pocket down through both narrow breakpoints instead of
// needing a hand-written size at each one, which is what the old knob did.

import { useEffect, useRef, useState } from 'react';
import { DIAL_TICK, dialTickInterval, dialTickStep, dialTickFlash } from './dialTick.js';

const SIZE = 74;                  // the viewBox, and the dial's max CSS width
const MAX = 10;                   // the stat scale — 0..10, same as the old knob
const START = -135, SWEEP = 270;  // a gauge, so the bottom 90° stays empty
const R = SIZE * 0.352;           // ring radius
const SEG = SWEEP / MAX, GAP = 3.8, WIDTH = 5.4;
const CUT = 10;                   // chamfer depth
const INSET = 1.2;                // frame inset from the viewBox edge
const RUN = CUT + 6;              // how far a corner bracket runs along each edge
// ⚠️ THE BOTTOM EDGE IS NOT DRAWN AT ALL, and that is a fix rather than a
// shortcut: with a stub either side of the nameplate, the seven-letter SUSTAIN
// ran straight through them while the five-letter DRIVE cleared — a bug only
// one of the two dials could ever show. The corner brackets already frame the
// label, so the stubs were costing a collision and buying nothing.

const pol = (r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [SIZE / 2 + r * Math.cos(a), SIZE / 2 + r * Math.sin(a)];
};
const arc = (r, a0, a1) => {
  const [x0, y0] = pol(r, a0), [x1, y1] = pol(r, a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r.toFixed(2)} ${r.toFixed(2)} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

// The ten blocks, built once. Nothing here depends on the value.
const BLOCKS = Array.from({ length: MAX }, (_, i) =>
  arc(R, START + i * SEG + GAP / 2, START + (i + 1) * SEG - GAP / 2));

// The frame is SEVEN pieces rather than one octagon, and that is the whole
// trick: hot corners + dark edges read as a bracket, and a bracket sits behind
// the ring instead of competing with it. The bottom edge is missing its middle.
const A = INSET, B = SIZE - INSET, MID = SIZE / 2;
const FRAME_CORNERS = [
  `M${A} ${A + RUN} L${A} ${A + CUT} L${A + CUT} ${A} L${A + RUN} ${A}`,
  `M${B - RUN} ${A} L${B - CUT} ${A} L${B} ${A + CUT} L${B} ${A + RUN}`,
  `M${B} ${B - RUN} L${B} ${B - CUT} L${B - CUT} ${B} L${B - RUN} ${B}`,
  `M${A + RUN} ${B} L${A + CUT} ${B} L${A} ${B - CUT} L${A} ${B - RUN}`,
].join(' ');
const FRAME_EDGES = [
  `M${A + RUN} ${A} L${B - RUN} ${A}`,
  `M${A} ${A + RUN} L${A} ${B - RUN}`,
  `M${B} ${A + RUN} L${B} ${B - RUN}`,
].join(' ');

const clampValue = (value) => (value != null && Number.isFinite(Number(value))
  ? Math.max(0, Math.min(MAX, Number(value))) : null);
const prefersReducedMotion = () => typeof window !== 'undefined'
  && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/**
 * The value the dial DRAWS, travelling toward the value it was given.
 * Returns `{ shown, flash }` — `flash` is `{ index, dir, n }` for the block that
 * just changed, `n` a counter used as a React key so the flash replays.
 *
 * ⚠️ A RETARGET MID-RUN CARRIES ON FROM WHERE THE DIAL STANDS, with no second
 * wait — "+1 three times, 150 ms apart" reads as one run of three, and a change
 * of mind turns round instead of finishing the old trip first.
 */
function useDialTick(value, snapKey) {
  const target = clampValue(value);
  const [shown, setShown] = useState(target);
  const [flash, setFlash] = useState(null);
  const shownRef = useRef(target);
  const timer = useRef(null);
  const running = useRef(false);
  const keyRef = useRef(snapKey);
  const seq = useRef(0);

  useEffect(() => {
    const clear = () => { if (timer.current != null) { clearTimeout(timer.current); timer.current = null; } };
    const keyChanged = keyRef.current !== snapKey;
    keyRef.current = snapKey;
    // Snap: no value to travel from or to, a different player's numbers, or
    // an OS request for less motion.
    if (target == null || shownRef.current == null || keyChanged || prefersReducedMotion()) {
      clear(); running.current = false;
      shownRef.current = target; setShown(target); setFlash(null);
      return undefined;
    }
    if (shownRef.current === target) { clear(); running.current = false; return undefined; }
    const every = dialTickInterval(target - shownRef.current);
    const tick = () => {
      const prev = shownRef.current, next = dialTickStep(prev, target);
      shownRef.current = next;
      setShown(next);
      const f = dialTickFlash(prev, next);
      if (f) setFlash({ ...f, n: ++seq.current });
      if (next === target) { timer.current = null; running.current = false; }
      else timer.current = setTimeout(tick, every);
    };
    timer.current = setTimeout(tick, running.current ? every : DIAL_TICK.delayMs);
    running.current = true;
    return clear;   // a retarget or an unmount cancels the pending step, never the position
  }, [target, snapKey]);

  return { shown, flash };
}

/**
 * @param {string} stat    unique key for this instance — it keys the gradient id,
 *                         so the pocket and the board must not share one
 * @param {string} [label] the nameplate text, e.g. 'DRIVE'. Omit where the frame
 *                         around the dial already names it.
 * @param {number} value   0..10, or null/undefined for the em-dash rest state
 * @param {number} [boost] a LIVE-BUT-NOT-YET-REAL delta, summed by the caller.
 *                         Positive lights the blocks it would add in white;
 *                         negative turns the blocks it would cost red.
 * @param {number} [size]  px. Omit to let CSS size it (the pocket does).
 * @param {*}      [snapKey] whose numbers these are. When it changes the dial
 *                         SNAPS instead of ticking — pass the acting player.
 */
export default function ArenaDial({ stat, label, value, boost = 0, size, snapKey }) {
  // ⏱️ `v` is the DRAWN value — it trails `value` by up to ~1.2 s while ticking.
  // Anything that must read the authoritative number reads the prop, not this
  // (MatchSurface's `data-dial-value` and aria-label both do).
  const { shown, flash } = useDialTick(value, snapKey);
  const live = shown != null;
  const v = shown;
  const lit = live ? Math.ceil(v) : 0;
  const head = lit - 1;
  const coreId = `rlsw-dial-core-${stat}`;
  // 🎯 THE BOOST CHANNEL, CARRIED OVER FROM THE KNOB THIS REPLACED, because the
  // board's chord stacks answer "where would this note take me" with it and the
  // feature would have died silently in the port. Same grammar as `StatKnob`
  // had: gained blocks read WHITE, lost blocks read RED.
  const ghost = live && boost ? Math.max(0, Math.min(MAX, v + boost)) : null;
  const ghostLit = ghost == null ? 0 : Math.ceil(ghost);
  const gain = ghost != null && boost > 0, drop = ghost != null && boost < 0;

  return (
    <svg className="rlsw-dial" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true"
      style={size ? { width: size, height: size, maxWidth: size } : undefined}>
      <defs>
        <radialGradient id={coreId}>
          <stop offset="0" stopColor="currentColor" stopOpacity=".24" />
          <stop offset="70%" stopColor="currentColor" stopOpacity=".06" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={MID} cy={MID} r={(R - 3).toFixed(2)} fill={`url(#${coreId})`} />
      <path d={FRAME_EDGES} fill="none" stroke="currentColor" strokeWidth=".8" opacity=".17" />
      <path d={FRAME_CORNERS} fill="none" stroke="currentColor" strokeWidth="1.1" opacity=".72"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* the unlit scale — navy, but tinted toward the stat so a cold dial and a
          hot dial still read as different instruments when both sit at zero */}
      <g fill="none" strokeWidth={WIDTH} strokeLinecap="butt">
        {BLOCKS.map((d, i) => <path key={i} className="rlsw-dial-off" d={d} opacity={i < lit ? 0.18 : 1} />)}
      </g>
      {/* the bloom. `key` is the VALUE, so React remounts this group on every
          change and the charge flare replays — no timers, no refs. */}
      <g key={`bloom-${lit}`} className="rlsw-dial-bloom" fill="none" strokeWidth={WIDTH + 3.4} strokeLinecap="butt">
        {BLOCKS.map((d, i) => <path key={i} className="rlsw-dial-on" d={d}
          opacity={i < lit ? 1 : 0} />)}
      </g>
      {/* 🪦 The 22 ms-per-block `transitionDelay` ripple is gone: it was a jump's
          stand-in for travel, and under a real tick it delayed block 9 by 198 ms —
          longer than a whole step, so the high blocks lagged behind their own tick. */}
      <g fill="none" strokeWidth={WIDTH} strokeLinecap="butt">
        {BLOCKS.map((d, i) => <path key={i} className="rlsw-dial-on" d={d}
          opacity={i < lit ? 1 : 0} />)}
      </g>
      {/* the boost preview: what this note WOULD add, or WOULD cost */}
      {gain && <g fill="none" stroke="#ffffff" strokeWidth={WIDTH} strokeLinecap="butt" opacity=".55">
        {BLOCKS.map((d, i) => <path key={i} d={d} opacity={i >= lit && i < ghostLit ? 1 : 0} />)}
      </g>}
      {drop && <g fill="none" stroke="#ff3344" strokeWidth={WIDTH} strokeLinecap="butt" opacity=".9">
        {BLOCKS.map((d, i) => <path key={i} d={d} opacity={i >= ghostLit && i < lit ? 1 : 0} />)}
      </g>}
      {/* ⏱️ the tick flash: the block that just lit (white) or went dark (red).
          `key` is the step counter, so every tick remounts it and replays.
          ⚠️ BOTH REPLAY KEYS ARE PREFIXED (`bloom-` / `flash-`): they are siblings
          under one <svg>, and as bare numbers the bloom's `lit` and this counter
          collided the first time they were equal — React warned "two children
          with the same key" on a change of mind. Found by mounting it, not by eye. */}
      {flash && <path key={`flash-${flash.n}`} className={`rlsw-dial-flash ${flash.dir > 0 ? 'gain' : 'loss'}`}
        d={BLOCKS[flash.index]} fill="none" strokeWidth={WIDTH + 1.2} strokeLinecap="butt" />}
      {/* the head block's white line — where you just got to */}
      <g fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="butt">
        {BLOCKS.map((d, i) => <path key={i} className="rlsw-dial-head" d={d} opacity={i === head ? 0.95 : 0} />)}
      </g>
      <circle cx={MID} cy={MID} r={(R - 6.2).toFixed(2)} fill="none" stroke="currentColor"
        strokeWidth=".5" opacity=".3" />

      {/* ⚠️ LABEL FIRST — see the header note. This order is a test contract.
          ⚠️ AND IT MUST STAY RENDERED WHENEVER A LABEL IS GIVEN: the pocket's
          `DRIVE6` depends on this node preceding the value's. The board omits
          the label because its own frame carries the nameplate. */}
      {label && <text className="rlsw-dial-cap" x={MID} y={SIZE - INSET} textAnchor="middle"
        dominantBaseline="middle">{label}</text>}
      <text className="rlsw-dial-num" x={MID} y={MID + 0.5} textAnchor="middle"
        dominantBaseline="middle">{live ? v : '—'}</text>
    </svg>
  );
}

// Shipped inside MatchSurface's own <style> so the arena keeps ONE stylesheet,
// the same arrangement `ActionRail.jsx` has with `GameStyles.jsx`.
export const DIAL_CSS = `
  .rlsw-dial { display:block; width:100%; height:auto; max-width:${SIZE}px; overflow:visible; }
  .rlsw-dial .rlsw-dial-num { font:400 17px 'Saira Stencil One',sans-serif; fill:#fff; letter-spacing:.4px;
    paint-order:stroke; stroke:#03060e; stroke-width:2.8px; stroke-linejoin:round; }
  .rlsw-dial .rlsw-dial-cap { font:400 5.8px 'Saira Stencil One',sans-serif; fill:currentColor;
    letter-spacing:1.8px; opacity:.95; }
  .rlsw-dial .rlsw-dial-off { stroke:color-mix(in srgb,currentColor 26%,#16253f); transition:opacity ${DIAL_TICK.fadeMs}ms linear; }
  .rlsw-dial .rlsw-dial-on { stroke:currentColor; transition:opacity ${DIAL_TICK.fadeMs}ms linear; }
  .rlsw-dial .rlsw-dial-head { transition:opacity .18s linear; }
  .rlsw-dial .rlsw-dial-bloom { opacity:.17; animation:rlsw-dial-charge ${DIAL_TICK.flareMs}ms ease-out; }
  @keyframes rlsw-dial-charge { 0% { opacity:${DIAL_TICK.flarePeak} } 100% { opacity:.17 } }
  .rlsw-dial .rlsw-dial-flash { opacity:0; }
  .rlsw-dial .rlsw-dial-flash.gain { stroke:#ffffff; animation:rlsw-dial-flash ${DIAL_TICK.gainFlashMs}ms ease-out forwards; }
  .rlsw-dial .rlsw-dial-flash.loss { stroke:#ff3344; animation:rlsw-dial-flash ${DIAL_TICK.lossFlashMs}ms ease-out forwards; }
  @keyframes rlsw-dial-flash { 0% { opacity:1 } 100% { opacity:0 } }
  @media (prefers-reduced-motion: reduce) {
    .rlsw-dial .rlsw-dial-bloom, .rlsw-dial .rlsw-dial-flash { animation:none; }
    .rlsw-dial .rlsw-dial-off, .rlsw-dial .rlsw-dial-on, .rlsw-dial .rlsw-dial-head { transition:none; }
  }
`;
