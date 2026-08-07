// =============================================================================
// ui/FretboardFull.jsx — 🗺️ INTERACTIVE FULL NECK — tappable 6×13 fretboard
// -----------------------------------------------------------------------------
// The shared foundation for Fretboard Recon and Discord Coach. Renders the full
// guitar neck (6 strings × frets 0–12) as an SVG with neon-pass visual language:
// near-black void, glowing string lines (cyan→magenta gradient), violet inlay
// dots (3/5/7/9/12), bloom-filtered nut.
//
// Presentational only — no game logic inside. The parent decides what taps mean.
//
// Props:
//   onTapCell(string, fret)  — every tap reports; parent decides meaning
//   layers                   — Map/object of cellId → { color, style }
//                              style: 'solid' | 'dim' | 'pulse' | 'hot'
//   showLabels               — per-cell note letters on/off
//   flash                    — { cellId, grade } — judgment burst on a cell
//   highlightString          — string index to glow (Recon target string hint)
//   accent                   — accent color override (default cyan)
//
// Free audition: every tap ALWAYS sounds its cell through the rig (the neck is
// an instrument first, a quiz second). Parent passes playNote for this.
// =============================================================================
import React, { useRef, useCallback, useEffect, useState } from "react";
import { STRING_NAMES, STRING_OPENS, MAX_FRET, cellKey } from "../riff/guitarMap.js";
import neckArt from "../neon_guitar_neck.png";
import { NECK_IMG, FRET_X, WIRE_X, stringY, STRING_GAUGE_PX } from "../riff/neonNeckGeometry.js";

// ── Neon palette ────────────────────────────────────────────────────────────
const NEON_CYAN    = '#19e6ff';
const NEON_MAGENTA = '#ff2d95';
const NEON_VIOLET  = '#8a5cff';
const NEON_WHITE   = '#ffffee';

const NEON_STRING_COLORS = [NEON_CYAN, '#33ccff', '#6699ff', NEON_VIOLET, '#cc44dd', NEON_MAGENTA];

const GRADE_BURST = {
  perfect: { color: NEON_WHITE,   r: 28, dur: 400 },
  good:    { color: NEON_CYAN,    r: 22, dur: 350 },
  ok:      { color: NEON_VIOLET,  r: 18, dur: 300 },
  wrong:   { color: '#555566',    r: 16, dur: 250 },
  fumbled: { color: '#555566',    r: 16, dur: 250 },
};

// Note display — riff key convention to display name
const PC_KEYS = ['a', 'A', 'b', 'c', 'C', 'd', 'D', 'e', 'f', 'F', 'g', 'G'];
const DISPLAY  = {
  a: 'A', A: 'A♯', b: 'B', c: 'C', C: 'C♯',
  d: 'D', D: 'D♯', e: 'E', f: 'F', F: 'F♯', g: 'G', G: 'G♯',
};
function noteName(key) { return DISPLAY[key] ?? key; }

// ── Geometry ────────────────────────────────────────────────────────────────
// Everything below is in the ARTWORK's own pixel space (2425×598), which is the
// SVG viewBox. That way FRET_X / stringY / WIRE_X drop straight in with no
// rescaling, and the calibration script stays the single source of truth.
const NECK_W = NECK_IMG.w;
const NECK_H = NECK_IMG.h;
const INLAY_FRETS = [3, 5, 7, 9, 12];

// Cell hit-box size, in asset pixels. Frets crowd toward the bridge, so the
// width is derived per-fret from the wire spacing rather than being constant.
const ROW_H = 84;
function fretCellW(f) {
  if (f === 0) return WIRE_X[0] * 0.9;                       // open string, behind the nut
  const left  = WIRE_X[f - 1] ?? 0;
  const right = WIRE_X[f] ?? (left + 90);
  return Math.max(40, right - left);
}
function fretCellLeft(f) {
  if (f === 0) return 4;
  return WIRE_X[f - 1] ?? 0;
}

export function FretboardFull({
  onTapCell, layers = {}, showLabels = true, flash = null,
  highlightString = -1, accent = NEON_CYAN, playNote,
}) {
  const svgRef = useRef(null);
  const [burst, setBurst] = useState(null); // { x, y, grade, t }

  // ── Flash burst effect ──────────────────────────────────────────────────
  useEffect(() => {
    if (!flash) return;
    const { cellId, grade } = flash;
    // Parse cellId "s,f"
    const [s, f] = cellId.split(',').map(Number);
    if (isNaN(s) || isNaN(f)) return;
    const x = cellX(f);
    const y = cellY(s);
    setBurst({ x, y, grade, t: Date.now() });
    const id = setTimeout(() => setBurst(null), (GRADE_BURST[grade]?.dur ?? 300));
    return () => clearTimeout(id);
  }, [flash]);

  // ── Cell center coords ────────────────────────────────────────────────────
  // Straight off the calibrated artwork. The strings are not horizontal on this
  // neck — they fan slightly — so a cell's y depends on its x.
  function cellX(fret) { return FRET_X[fret] ?? FRET_X[FRET_X.length - 1]; }
  function cellY(string, fret = 6) { return stringY(string, cellX(fret)); }

  // ── Tap handler ─────────────────────────────────────────────────────────
  const handleTap = useCallback((s, f) => {
    // Free audition — always sound
    if (playNote) {
      const freq = 110 * Math.pow(2, (STRING_OPENS[s] + f - 5) / 12);
      playNote(freq, s, f);
    }
    if (onTapCell) onTapCell(s, f);
  }, [onTapCell, playNote]);

  // ── Layer style → SVG fill/opacity/animation ────────────────────────────
  function layerStyle(cellId) {
    const l = layers[cellId];
    if (!l) return null;
    const base = { fill: l.color || NEON_CYAN, opacity: 1 };
    switch (l.style) {
      case 'dim':   return { ...base, opacity: 0.3 };
      case 'pulse': return { ...base, opacity: 0.6, className: 'fb-pulse' };
      case 'hot':   return { ...base, opacity: 0.9, className: 'fb-hot' };
      case 'solid': default: return { ...base, opacity: 0.55 };
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 980, margin: '0 auto', touchAction: 'none' }}>
      <style>{`
        @keyframes fb-pulse { 0%,100%{opacity:.35} 50%{opacity:.75} }
        @keyframes fb-hot   { 0%,100%{opacity:.7} 50%{opacity:1} }
        @keyframes fb-burst { 0%{r:6;opacity:1} 100%{r:30;opacity:0} }
        .fb-pulse { animation: fb-pulse 1.2s ease-in-out infinite; }
        .fb-hot   { animation: fb-hot 0.6s ease-in-out infinite; }
        .fb-cell:hover { filter: brightness(1.3); }
      `}</style>
      <svg ref={svgRef} viewBox={`0 0 ${NECK_W} ${NECK_H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* SVG filter for bloom glow */}
        <defs>
          <filter id="neonFbBloom" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="neonFbBloomStrong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* ── The guitar ──
             The artwork IS the neck: nut, fret wires, inlays and strings are
             all painted. Everything this component draws from here on is an
             OVERLAY registered to it by the calibrated geometry. */}
        <image href={neckArt} x="0" y="0" width={NECK_W} height={NECK_H}
               preserveAspectRatio="none" />

        {/* ── String highlight — glows the target string over the art ── */}
        {STRING_NAMES.map((nm, i) => {
          if (highlightString !== i) return null;
          return (
            <line key={`hl${i}`}
              x1={0} y1={stringY(i, 0)} x2={NECK_W} y2={stringY(i, NECK_W)}
              stroke={NEON_STRING_COLORS[i]} strokeWidth={STRING_GAUGE_PX[i] * 1.15}
              opacity={0.85} filter="url(#neonFbBloomStrong)"
              style={{ pointerEvents: 'none' }} />
          );
        })}

        {/* ── String names, off the nut end ── */}
        {STRING_NAMES.map((nm, i) => (
          <text key={`sn${i}`} x={22} y={stringY(i, 22) + 8} textAnchor="middle"
            fontSize="34" fontFamily="'Saira Stencil One', monospace" fontWeight="bold"
            fill={NEON_STRING_COLORS[i]} opacity={highlightString === i ? 1 : 0.55}
            style={{ pointerEvents: 'none' }}>
            {nm}
          </text>
        ))}

        {/* ── Layer highlights + tap targets + labels ── */}
        {STRING_NAMES.map((_, s) =>
          Array.from({ length: MAX_FRET + 1 }, (_, f) => {
            const cx = cellX(f);
            const cy = cellY(s);
            const id = `${s},${f}`;
            const key = cellKey(s, f);
            const ls = layerStyle(id);
            const cellW = fretCellW(f);
            const cellLeft = fretCellLeft(f);

            return <g key={id} className="fb-cell" style={{ cursor: 'pointer' }}
              onClick={() => handleTap(s, f)}
              onTouchStart={(e) => { e.preventDefault(); handleTap(s, f); }}>
              {/* Tap target (invisible rect) */}
              <rect x={cellLeft} y={cy - ROW_H / 2} width={cellW} height={ROW_H}
                fill="transparent" />
              {/* Layer highlight */}
              {ls && <circle cx={cx} cy={cy} r={30}
                fill={ls.fill} opacity={ls.opacity}
                filter="url(#neonFbBloom)"
                className={ls.className || undefined} />}
              {/* Note label */}
              {showLabels && (
                <text x={cx} y={cy + 10} textAnchor="middle" fontSize="26"
                  fontFamily="'Saira Stencil One', monospace" fontWeight="bold"
                  fill={ls ? '#fff' : NEON_STRING_COLORS[s]}
                  opacity={ls ? 0.95 : 0.35} style={{ pointerEvents: 'none' }}>
                  {noteName(key)}
                </text>
              )}
            </g>;
          })
        )}

        {/* ── Fret numbers on marked frets only (3/5/7/9/12) ── */}
        {INLAY_FRETS.map(f => (
          <text key={`fn${f}`} x={FRET_X[f]} y={NECK_H - 10}
            textAnchor="middle" fontSize="26" fontFamily="'Saira Stencil One', monospace"
            fill={NEON_VIOLET} opacity="0.7" style={{ pointerEvents: 'none' }}>
            {f}
          </text>
        ))}

        {/* ── Judgment burst ── */}
        {burst && (() => {
          const b = GRADE_BURST[burst.grade] || GRADE_BURST.ok;
          return <circle cx={burst.x} cy={burst.y} r={b.r * 2.6} fill={b.color}
            opacity="0.8" filter="url(#neonFbBloomStrong)"
            style={{ animation: `fb-burst ${b.dur}ms ease-out forwards` }} />;
        })()}
      </svg>
    </div>
  );
}
