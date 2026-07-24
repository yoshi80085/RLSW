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
const CELL_W    = 42;   // fret column width
const CELL_H    = 28;   // string row height
const NUT_W     = 8;    // nut (fret 0) visual width
const SIDE_PAD  = 32;   // left padding for string labels
const TOP_PAD   = 8;
const INLAY_FRETS = [3, 5, 7, 9, 12];
const DOUBLE_DOT  = new Set([12]);

const NECK_W = SIDE_PAD + NUT_W + MAX_FRET * CELL_W + 12;
const NECK_H = TOP_PAD + STRING_NAMES.length * CELL_H + 12;

// String gauge widths (visual only)
const GAUGE = [2.8, 2.2, 1.8, 1.4, 1.0, 0.7];

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
  // Strings render FLIPPED: string 0 (low E) at the BOTTOM, string 5 (high e)
  // at the TOP — standard fretboard diagram orientation for a right-handed player.
  function cellX(fret) {
    if (fret === 0) return SIDE_PAD + NUT_W / 2;
    return SIDE_PAD + NUT_W + (fret - 0.5) * CELL_W;
  }
  function cellY(string) {
    // Flip: string 5 (high e) at top, string 0 (low E) at bottom
    const flipped = 5 - string;
    return TOP_PAD + flipped * CELL_H + CELL_H / 2;
  }

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
    <div style={{ width: '100%', maxWidth: 620, margin: '0 auto', touchAction: 'none' }}>
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

        {/* ── Background ── */}
        <rect x="0" y="0" width={NECK_W} height={NECK_H} fill="#050a14" rx="6" />

        {/* ── Nut ── */}
        <rect x={SIDE_PAD} y={TOP_PAD - 2} width={NUT_W} height={NECK_H - TOP_PAD - 8}
          fill="#1a2a40" rx="2" filter="url(#neonFbBloom)" opacity="0.7" />

        {/* ── Fret wires ── */}
        {Array.from({ length: MAX_FRET }, (_, i) => {
          const x = SIDE_PAD + NUT_W + (i + 1) * CELL_W;
          return <line key={`fw${i}`} x1={x} y1={TOP_PAD}
            x2={x} y2={NECK_H - 10} stroke="#1a2a40" strokeWidth="1.5" />;
        })}

        {/* ── Inlay dots (3/5/7/9/12) ── */}
        {INLAY_FRETS.map(f => {
          const x = SIDE_PAD + NUT_W + (f - 0.5) * CELL_W;
          const midY = TOP_PAD + (STRING_NAMES.length * CELL_H) / 2;
          if (DOUBLE_DOT.has(f)) {
            return <g key={`inlay${f}`}>
              <circle cx={x} cy={midY - CELL_H * 1.1} r={4} fill={NEON_VIOLET} opacity="0.45" />
              <circle cx={x} cy={midY + CELL_H * 1.1} r={4} fill={NEON_VIOLET} opacity="0.45" />
            </g>;
          }
          return <circle key={`inlay${f}`} cx={x} cy={midY} r={4}
            fill={NEON_VIOLET} opacity="0.4" />;
        })}

        {/* ── Strings (horizontal lines) ── */}
        {STRING_NAMES.map((nm, i) => {
          const y = cellY(i);
          const isHL = highlightString === i;
          return <g key={`str${i}`}>
            <line x1={SIDE_PAD} y1={y} x2={NECK_W - 10} y2={y}
              stroke={NEON_STRING_COLORS[i]} strokeWidth={GAUGE[i]}
              opacity={isHL ? 1 : 0.5}
              filter={isHL ? 'url(#neonFbBloomStrong)' : undefined} />
            {/* String label */}
            <text x={SIDE_PAD - 8} y={y + 1} textAnchor="end" fontSize="10"
              fontFamily="'Saira Stencil One', monospace" fontWeight="bold"
              fill={NEON_STRING_COLORS[i]} opacity={isHL ? 1 : 0.6}>
              {nm}
            </text>
          </g>;
        })}

        {/* ── Layer highlights + tap targets + labels ── */}
        {STRING_NAMES.map((_, s) =>
          Array.from({ length: MAX_FRET + 1 }, (_, f) => {
            const cx = cellX(f);
            const cy = cellY(s);
            const id = `${s},${f}`;
            const key = cellKey(s, f);
            const ls = layerStyle(id);
            const cellW = f === 0 ? NUT_W : CELL_W;
            const cellLeft = f === 0 ? SIDE_PAD : SIDE_PAD + NUT_W + (f - 1) * CELL_W;

            return <g key={id} className="fb-cell" style={{ cursor: 'pointer' }}
              onClick={() => handleTap(s, f)}
              onTouchStart={(e) => { e.preventDefault(); handleTap(s, f); }}>
              {/* Tap target (invisible rect) */}
              <rect x={cellLeft} y={cy - CELL_H / 2} width={cellW} height={CELL_H}
                fill="transparent" />
              {/* Layer highlight */}
              {ls && <circle cx={cx} cy={cy} r={f === 0 ? 8 : 10}
                fill={ls.fill} opacity={ls.opacity}
                className={ls.className || undefined} />}
              {/* Note label */}
              {showLabels && (
                <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="8"
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
          <text key={`fn${f}`} x={SIDE_PAD + NUT_W + (f - 0.5) * CELL_W} y={NECK_H - 2}
            textAnchor="middle" fontSize="8" fontFamily="'Saira Stencil One', monospace"
            fill={NEON_VIOLET} opacity="0.55">
            {f}
          </text>
        ))}

        {/* ── Judgment burst ── */}
        {burst && (() => {
          const b = GRADE_BURST[burst.grade] || GRADE_BURST.ok;
          return <circle cx={burst.x} cy={burst.y} r={b.r} fill={b.color}
            opacity="0.8" filter="url(#neonFbBloomStrong)"
            style={{ animation: `fb-burst ${b.dur}ms ease-out forwards` }} />;
        })()}
      </svg>
    </div>
  );
}
