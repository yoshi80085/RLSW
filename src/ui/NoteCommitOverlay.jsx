// ─── 🎛️ THE NOTE COMMIT OVERLAY — PANEL CHROME ──────────────────────────────
//
// Where each board panel sits, and what it is drawn on. This file holds the
// SHELL ONLY: every number the panels display, and every click they answer to,
// stays in `rlsw-simulator-v3_8_1.jsx` and arrives here as `children`.
//
// ⚠️ WHY THE SPLIT IS SHELL-VS-CONTENT AND NOT "MOVE THE WHOLE PANEL OVER".
// The commit region is where the 2026-08-26 Shamisen rework cut across a
// function boundary and shipped a game that could not leave turn one — it took
// `setMovedThisTurn(false)` and `setAction('move')` with it, and all eighteen
// suites stayed green while it did (SEQUENCING.md §5). The safest possible
// restyle is therefore one that CANNOT reach the commit path: this component
// owns only the box the existing markup is drawn inside, so a mistake in here
// can misplace a panel but cannot lose a state setter. 📌 **The 2026-09-12
// bracket pass held that line** — every change below is frame, and not one of
// them reaches a child.
//
// ── 🪦 WHAT THE BRACKET PASS RETIRED, 2026-09-12 ─────────────────────────────
//
// 🪦 **`StatKnob`, and the 1.9× magnifier that drew it.** Both chord stacks
// mounted the amp knob at `knobScale: 1.90`. When `ui/ArenaDial.jsx` replaced
// that knob in the player pocket on 2026-09-11, the board was left behind — so
// the game briefly showed the new gauge at 74px and the knob it replaced at
// ~72px **in the same scene**. One component now, in both places.
//
// 🪦 **The −6° lean, and the `Unskew` dance under it.** `tilt` skewed both
// stacks and the track while their contents stood back up exactly once. Retired
// at Alex's call, 2026-09-12 — *"let's do away with the 6 degree lean for now."*
// ⚠️ **TO BRING IT BACK you need three things, not one:** the `skewX(tilt)` on
// each panel root, a single counter-skew wrapper around each panel's children
// (never two — a nested un-skew shears the inner content the other way), and
// the dial left OUTSIDE that wrapper so it stays upright on a leaning faceplate.
//
// 🪦 **Every frosted slab.** `backdrop-filter: blur(5px)`, the gradient fills
// and the coloured box glows are gone. A blurred panel destroys the detail
// behind it even at low alpha, and these three panels sit directly on the
// Cosmic Arena. See `ui/Bracket.jsx`.
//
// 📌 THE PERCENTAGES ARE STILL THE PREVIEW'S. The preview's board div was
// authored at the client's own `maxWidth:1040`, so `left:3%` means what it
// meant on the page Alex dialled.

import { useEffect, useRef, useState } from "react";
import ArenaDial from "./ArenaDial.jsx";
import Bracket from "./Bracket.jsx";

const DRIVE_C   = "#ff6644";
const SUSTAIN_C = "#44aaff";
const MELODY_C  = "#aa88ff";

/** 🎛️ THE ONLY THINGS MEANT TO BE TUNED. */
export const COMMIT_OVERLAY = {
  // ⚠️ ALEX HAS NOT DIALLED THE THREE DIAL NUMBERS. They are where a 72px gauge
  // wants to sit on a 468px panel so it clears the last seat of the honeycomb;
  // the old knob's `knobX/knobY` carried the same caveat.
  dialSize:  72,     // px. Matches the 1.9×-magnified knob it replaced.
  dialX:     16,     // px in from the panel's INNER edge — the two dials face
                     // each other across the middle of the board
  dialY:     9,      // px down from the panel's top edge
  ghostBoost: true,  // hover preview rides ArenaDial's `boost` channel
  trackChip: 69,     // px box per commit-track seat  ("TRACK CHIP")
  stackChip: 72,     // px box per chord-stack seat   ("STACK CHIP")
  // 🔷 THE HONEYCOMB. A column steps 0.78× the chip box across and odd columns
  // drop 0.45× down, which is what makes the seats INTERLOCK instead of sitting
  // in a row. Straight from the preview's nest builder; do not round them.
  nestStepX: 0.78,
  nestDropY: 0.45,
  nestRowY:  0.90,   // vertical step between whole rows (only one row today)
  // 🌊 THE MELODY LINE'S WAVE. Alex, 2026-09-12: *"the whole game is very
  // straight and mathematically symmetrical and sound. The 'sound' part should
  // kind of break that."* So the committed run of the melody is the one thing
  // in the arena that is not on the grid.
  waveAmp:    9,     // px of swing above and below the seat line
  waveTravel: 5.2,   // seconds for the wave to move one whole wavelength
  wavePulse:  1.9,   // seconds for one PULSE to run a wavelength down the line
  // 🎼 THE OVERTONES. Thin, dim lines riding the same run at wavelengths that
  // are DELIBERATELY NOT MULTIPLES of the main one. Nothing here is a round
  // ratio: 1.5 would re-sync every other crest, 2 every crest, and the pair
  // would read as one thick line breathing rather than as several strings. At
  // 1.47 / 0.79 / 2.31 they never come back into phase inside the track's
  // width, so the interference keeps moving and never repeats — which is the
  // whole difference between "shimmer" and "a pattern".
  // ⚠️ These do NOT thread the seats and are not meant to. Only the main line
  // crosses at a seat centre; the overtones are the air around it.
  waveOvertones: [
    { k: 1.47, amp: 6.0, width: 1.1,  opacity: .26, travel:  8.3, dir: -1 },
    { k: 0.79, amp: 4.2, width: 0.9,  opacity: .20, travel: 11.7, dir:  1 },
    { k: 2.31, amp: 7.5, width: 0.85, opacity: .14, travel:  6.4, dir: -1 },
  ],
};

/* 🌊 THE MELODY WAVE — why it is built the way it is.
 *
 * ⚠️ THE WAVELENGTH IS LOCKED TO THE SEATS, NOT CHOSEN. It is exactly TWO seat
 * pitches, phased so a zero crossing lands dead centre of every seat. That is
 * what makes the chips read as threaded ON the line rather than floating near
 * it: the wave passes through each note and crests in the gaps between them.
 * Change the wavelength and the notes start sitting off their own string.
 *
 * ⚠️ `preserveAspectRatio="none"` + `vector-effect="non-scaling-stroke"`, AND
 * BOTH ARE LOAD-BEARING. The panel is a fluid percentage width, so the wave has
 * to stretch with it — a stretched sine is still a sine, which is why the
 * distortion is fine here and would not be on a 45° chamfer. But a non-uniform
 * scale also stretches the STROKE, which would leave the line fat on its
 * verticals and thin on its crests; `non-scaling-stroke` is what stops that.
 *
 * 📌 THE TRAVEL IS A `transform`, NOT A REDRAWN PATH. The path is built two
 * wavelengths wider than the row and slid by exactly one, so the motion is
 * compositor-only. Morphing `d` every frame would repaint a filter-sized region
 * over the live WebGL arena, which is the same reason `ArenaDial` has no SVG
 * filters in it.
 *
 * 🎯 AHEAD OF THE HEAD, THE LINE IS DEAD STRAIGHT. Unplayed seats get a taut,
 * dim, ruler-straight string; the committed run is the part that moves. The
 * melody is what puts the wave in it.
 */
const WAVE_VB = 1000, WAVE_H = 44;

/** One sine across the track, sampled. `k` multiplies the base wavelength, so
 *  k=1 is the line that threads the seats and everything else is an overtone.
 *  ⚠️ The path is built ONE OF ITS OWN WAVELENGTHS proud at each end and slid by
 *  exactly that, which is what makes each line loop seamlessly at its own speed. */
function wavePath(total, { k = 1, amp = COMMIT_OVERLAY.waveAmp } = {}) {
  const pitch = WAVE_VB / total;          // one seat, in viewBox units
  const lambda = pitch * 2 * k;
  const x0 = pitch / 2;                   // the first seat's centre
  const from = -lambda, to = WAVE_VB + lambda;
  const step = lambda / 24;
  let d = '';
  for (let x = from; x <= to + 0.001; x += step) {
    const y = WAVE_H / 2 + amp * Math.sin((2 * Math.PI * (x - x0)) / lambda);
    d += `${d ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return { d: d.trim(), lambda };
}

/** A line that slides one of its own wavelengths, forever. The transform is the
 *  ONLY thing that animates — see the travel note above. */
const travelStyle = (lambda, seconds, dir = -1) => ({
  '--rlsw-wave-shift': `${(lambda * dir).toFixed(2)}px`,
  animationDuration: `${seconds}s`,
});

/* ⚠️ THE WAVE MEASURES THE SEATS; IT DOES NOT ASSUME THEM. The track's children
   are a caption followed by eight seats, all flex items of one row — so the
   seats do NOT start at the row's left edge, and how far in they start depends
   on how wide that caption renders this turn. A wave phased to the ROW instead
   of to the SEATS drifts by whatever the caption measures, which at this
   wavelength is enough to park every note on a crest instead of on a crossing:
   the notes come off their own string, which is the one thing the wave exists
   to avoid. So it measures.
   📌 Seats are told apart by width — they are exactly `trackChip` wide and the
   caption is not. 📌 `ResizeObserver` is GUARDED: the DOM journey suites run
   this component under jsdom, where it does not exist. Until the measurement
   lands (and in SSR, where the effect never runs) only the dead straight string
   draws, which is a correct picture of an empty melody rather than a broken one. */
function useSeatSpan(total) {
  const rowRef = useRef(null);
  const [span, setSpan] = useState(null);
  useEffect(() => {
    const row = rowRef.current;
    if (!row || !total) return undefined;
    const measure = () => {
      const seats = Array.from(row.children)
        .filter(el => Math.abs(el.offsetWidth - COMMIT_OVERLAY.trackChip) <= 2);
      if (seats.length < 2) return;
      const first = seats[0], last = seats[seats.length - 1];
      setSpan({ left: first.offsetLeft,
                width: last.offsetLeft + last.offsetWidth - first.offsetLeft });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [total]);
  return [rowRef, span];
}

function MelodyWave({ filled, total, span }) {
  if (!total) return null;
  const { d, lambda } = wavePath(total);
  const pitch = WAVE_VB / total;
  const litTo = filled > 0 ? Math.min(filled, total) * pitch : 0;
  const headX = filled > 0 ? (Math.min(filled, total) - 0.5) * pitch : 0;
  const clipId = `rlsw-wave-lit-${total}`;
  return (
    <svg className="rlsw-wave" viewBox={`0 0 ${WAVE_VB} ${WAVE_H}`} preserveAspectRatio="none"
      aria-hidden="true" style={{ height: WAVE_H, left: span ? span.left : 0,
        width: span ? span.width : "100%" }}>
      <defs>
        <clipPath id={clipId}><rect x="0" y="0" width={litTo} height={WAVE_H} /></clipPath>
      </defs>
      {/* the taut, unplayed string. ⭐ It runs the WHOLE panel, not just the
          seats — the melody has somewhere left to go, and the string says so. */}
      <line x1={-WAVE_VB} y1={WAVE_H / 2} x2={WAVE_VB * 2} y2={WAVE_H / 2}
        className="rlsw-wave-dead" vectorEffect="non-scaling-stroke" />
      {/* The played run. Everything in here is clipped to the committed length,
          overtones included — the shimmer is what PLAYING puts in the string,
          so an empty track has to stay a single dead wire. */}
      {span && <g clipPath={`url(#${clipId})`}>
        {/* the overtones sit UNDER the main line, so it always reads as the one
            you are meant to follow */}
        {COMMIT_OVERLAY.waveOvertones.map((o, i) => {
          const h = wavePath(total, { k: o.k, amp: o.amp });
          return (
            <g key={i} className="rlsw-wave-travel" style={travelStyle(h.lambda, o.travel, o.dir)}>
              <path d={h.d} className="rlsw-wave-overtone" vectorEffect="non-scaling-stroke"
                style={{ strokeWidth: o.width, opacity: o.opacity }} />
            </g>
          );
        })}
        <g className="rlsw-wave-travel" style={travelStyle(lambda, COMMIT_OVERLAY.waveTravel)}>
          <path d={d} className="rlsw-wave-bloom" vectorEffect="non-scaling-stroke" />
          <path d={d} className="rlsw-wave-core" vectorEffect="non-scaling-stroke" />
        </g>
        {/* 🫀 THE PULSE. A short bright dash repeating every wavelength, on its
            own copy of the main line, sliding faster than the swell underneath
            it — so what you see is a glint running down the track rather than
            the whole line moving. 📌 It is a DASH ON A TRANSLATED PATH, never an
            animated `stroke-dashoffset`: offsets repaint the region every frame,
            a transform does not, and this is sitting on the live WebGL arena. */}
        <g className="rlsw-wave-travel" style={travelStyle(lambda, COMMIT_OVERLAY.wavePulse)}>
          <path d={d} className="rlsw-wave-pulse" vectorEffect="non-scaling-stroke"
            style={{ strokeDasharray: `${(lambda * 0.13).toFixed(2)} ${(lambda * 0.87).toFixed(2)}` }} />
          <path d={d} className="rlsw-wave-pulse-core" vectorEffect="non-scaling-stroke"
            style={{ strokeDasharray: `${(lambda * 0.07).toFixed(2)} ${(lambda * 0.93).toFixed(2)}` }} />
        </g>
      </g>}
      {span && filled > 0 && (
        <circle cx={headX} cy={WAVE_H / 2} r="2.6" className="rlsw-wave-head"
          vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

/* 🎸 ONE CHORD STACK, as a panel flanking the bottom of the board.
   📌 `boost` HERE MEANS THE HOVER PREVIEW, NOT THE COMBAT MODIFIERS. The HUD's
   copy of this gauge already spends `boost` on live combat modifiers; spending
   it on the same thing twice would say nothing new. Spending it on "where would
   this note take me" is the question you are actually asking with a note under
   the cursor — and a note that makes the stat WORSE gets the dial's red docked
   blocks for free. */
export function ChordStackPanel({ side, value, boost = 0, panelRef, tipAnchor,
                                  className, glowColor, borderColor, immersive = false, children }) {
  const isDrive = side === "drive";
  const color   = isDrive ? DRIVE_C : SUSTAIN_C;
  return (
    <Bracket innerRef={panelRef} data-tip-anchor={tipAnchor}
      data-immersive-hidden={immersive || undefined} className={className}
      color={borderColor ?? color}
      style={{ "--step-glow-color": glowColor ?? color,
        position:"absolute", bottom:"3%", [isDrive ? "left" : "right"]:"3%",
        width:"45%", zIndex:5,
        ...(immersive ? { visibility:'hidden', pointerEvents:'none' } : {}) }}>
      {/* 🔴🔵 THE FRAME WEARS ITS OWN STAT'S COLOUR — Drive red, Sustain blue —
          and it is still the ONLY thing that says which stack you are looking at
          from across the board. The bracket keeps that job and spends far less
          ink on it than the filled, glowing box it replaces. */}
      <div style={{ position:"relative", padding:"11px 12px 8px" }}>
        {/* ⚠️ THE DIAL DROPS ITS OWN CAP HERE, ON PURPOSE. The frame's nameplate
            already says DRIVE, and the old panel's inline title was deleted in
            2026-08 for exactly this reason — the row ran out of room because the
            same word was being said twice. */}
        <div style={{ position:"absolute", top:COMMIT_OVERLAY.dialY,
          [isDrive ? "right" : "left"]:COMMIT_OVERLAY.dialX,
          width:COMMIT_OVERLAY.dialSize, zIndex:3, pointerEvents:"none", color }}>
          <ArenaDial stat={`board-${side}`} value={value} boost={boost}
            size={COMMIT_OVERLAY.dialSize} />
        </div>
        {children}
      </div>
    </Bracket>
  );
}

/* 🔷 ONE CHORD STACK'S SEATS, laid out as a honeycomb anchored to the panel's
   OUTER edge. ⚠️ THE SEATS ARE ABSOLUTELY POSITIONED AND THE NEST HAS NO
   INTRINSIC HEIGHT — it is reserved here, or the panel collapses behind them. */
export function StackNest({ rows = 1, children }) {
  const K = COMMIT_OVERLAY;
  return (
    <div style={{ position:"relative", width:"100%",
      height: (rows * K.nestRowY + K.nestDropY) * K.stackChip }}>
      {children}
    </div>
  );
}

/** Where seat `col` of the nest sits, as absolute-position styles.
 *  The anchored edge flips per side so both stacks grow AWAY from the dial. */
export function stackSeatPos(side, col, row = 0) {
  const K = COMMIT_OVERLAY;
  return {
    position: "absolute",
    [side === "drive" ? "left" : "right"]: col * K.stackChip * K.nestStepX,
    top: row * K.stackChip * K.nestRowY + (col % 2) * K.stackChip * K.nestDropY,
    width: K.stackChip, height: K.stackChip,
  };
}

/* 🎼 THE COMMIT TRACK, spanning the top of the board in 2D and floating at the
   bottom centre in the arena.
   ⭐ `filled` / `total` ARE OPTIONAL AND THE WAVE IS OFF WITHOUT THEM. A caller
   that does not pass them gets the panel and no line, so no existing call site
   can break on this. */
export function CommitTrackPanel({ panelRef, tipAnchor, className, active,
                                   immersive = false, filled = 0, total = 0, children }) {
  return (
    <Bracket innerRef={panelRef} data-tip-anchor={tipAnchor}
      data-immersive-track={immersive || undefined} className={className}
      color={MELODY_C} plate="MELODY"
      plateRight={total ? `${Math.min(filled, total)} / ${total}` : undefined}
      style={{ "--step-glow-color":MELODY_C, position:"absolute", zIndex:5,
        ...(immersive
          ? { bottom:16, left:'50%', transform:'translateX(-50%)',
              width:'min(760px,calc(100% - 32px))', boxSizing:'border-box' }
          : { top:'2%', left:'3%', right:'3%' }) }}>
      <TrackRow filled={filled} total={total}>{children}</TrackRow>
    </Bracket>
  );
}

function TrackRow({ filled, total, children }) {
  const [rowRef, span] = useSeatSpan(total);
  return (
    <div style={{ position:"relative", padding:"10px 12px 9px" }}>
      <MelodyWave filled={filled} total={total} span={span} />
      {/* ⚠️ The children are flex items of THIS row. Wrapping them in a plain
          block would take them out of it and stack the eight seats vertically. */}
      <div ref={rowRef} style={{ position:"relative", zIndex:1, display:"flex",
        alignItems:"center", gap:6, width:"100%" }}>{children}</div>
    </div>
  );
}

/* ⚔️↔🛡️ THE PAYOUT ROUTER, sitting under the track at whatever height the
   track's readout leaves it. `top` is passed in because only the client knows
   how tall the track rendered this turn. */
export function PayoutRouterPanel({ top, children }) {
  return (
    <Bracket color="#9d7ad6" corner="sm" open
      style={{ position:"absolute", left:"6%", right:"6%", top, zIndex:5 }}>
      <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap",
        justifyContent:"center", padding:"5px 12px", minHeight:24 }}>
        {children}
      </div>
    </Bracket>
  );
}

// Rides in `MatchSurface.jsx`'s SURFACE_CSS with the bracket's own rules.
export const COMMIT_CSS = `
  .rlsw-wave { position:absolute; top:50%; margin-top:-${WAVE_H / 2}px;
    overflow:visible; pointer-events:none; z-index:0; }
  .rlsw-wave-dead { stroke:color-mix(in srgb,${MELODY_C} 26%,#16253f); stroke-width:2; }
  .rlsw-wave-bloom { fill:none; stroke:${MELODY_C}; stroke-width:9; opacity:.17; stroke-linecap:round; }
  .rlsw-wave-core { fill:none; stroke:${MELODY_C}; stroke-width:2.4; stroke-linecap:round; }
  .rlsw-wave-head { fill:#fff; stroke:${MELODY_C}; stroke-width:2; }
  .rlsw-wave-overtone { fill:none; stroke:${MELODY_C}; stroke-linecap:round; }
  .rlsw-wave-pulse { fill:none; stroke:${MELODY_C}; stroke-width:7; opacity:.5; stroke-linecap:round; }
  .rlsw-wave-pulse-core { fill:none; stroke:#fff; stroke-width:2.6; opacity:.95; stroke-linecap:round; }
  .rlsw-wave-travel { animation-name:rlsw-wave-travel; animation-timing-function:linear;
    animation-iteration-count:infinite; animation-duration:${COMMIT_OVERLAY.waveTravel}s; }
  @keyframes rlsw-wave-travel {
    from { transform:translateX(0) }
    to   { transform:translateX(var(--rlsw-wave-shift)) }
  }
  @media (prefers-reduced-motion: reduce) { .rlsw-wave-travel { animation:none } }
`;
