// =============================================================================
// ui/RiffHighway.jsx — 🎸 THE ARROW HIGHWAY — the one riff-off view
// -----------------------------------------------------------------------------
// The neck IS the highway. Six strings converge toward the nut at the top and
// widen to the bridge at the bottom; every note of the riff falls down its own
// string onto the strike line.
//
// INPUT: ONE HAND. The player presses the string number (1–6) as the gem
// crosses the bridge. Holding it through a tail sustains; ↑/↓ bends a ringing
// note. That is the whole control surface.
//
// The arrows on the gems are NOTATION, not input — they show whether the melody
// rises, falls or repeats, so the contour stays readable without costing a
// second keypress. This is the point of the design: the melody is visible, the
// ergonomics are one hand on the number row.
//
// ⚠️ Gem motion is driven by a requestAnimationFrame loop that writes transforms
// straight from the engine clock (run.startedAt) every frame — NOT by CSS
// animations. CSS animations break here: React re-renders on every judgment, and
// rewriting a running animation's delay does not restart it — the browser keeps
// the original start time, so every gem lurches forward by the elapsed time on
// each re-render. The rAF loop reads the clock fresh each frame, so gem
// positions are exact no matter how often React re-renders.
//
// HISTORY: this file used to host four views — a piano strike zone, a
// Rocksmith-style fret-cell neck, a neon reticle mode and a call-and-answer
// derivation puzzle — each with its own input path (note letters, fret taps,
// mic pitch). All of them are gone. Judging is by STRING NUMBER now; the note
// letters still exist in the engine and still sound, they are simply not what
// the hands are responsible for.
//
// Presentational: run data + results arrive via props; presses route back
// through onPressKey (same judge as the physical keyboard — taps on the string
// buttons make riff-offs playable on touch screens).
// Timing/difficulty numbers live in riff/fallingNotes.js.
// =============================================================================
import React, { useEffect, useRef } from "react";

// ── Geometry (px) ────────────────────────────────────────────────────────────
const HWY_H     = 260;  // highway height — strike line sits at its bottom edge
const GEM_R     = 17;   // gem radius at the bridge
const SPAWN_PAD = 34;   // gems spawn this far above the highway top (off-screen)
const TAIL      = 54;   // how far past the line a missed gem tumbles before fading
const TRAVEL    = HWY_H + SPAWN_PAD;

const LANES     = 6;
const LANE_W    = 46;                      // string spacing at the bridge
const SIDE      = 30;
const HWY_W     = (LANES - 1) * LANE_W + SIDE * 2;
const NUT_SQUEEZE = 0.34;                  // how far the strings converge at the nut
const BTN_H     = 52;                      // string-button row below the bridge

// ── Neon palette (outrun / synthwave) ────────────────────────────────────────
const NEON_CYAN    = '#19e6ff';
const NEON_MAGENTA = '#ff2d95';
const NEON_VIOLET  = '#8a5cff';
const NEON_ORANGE  = '#ff8a2a';
const NEON_WHITE   = '#ffffee';

const GRADE_COLORS = { perfect: NEON_WHITE, good: NEON_CYAN, ok: NEON_VIOLET, miss: '#555566', wrong: '#555566' };

// Cyan at the low E, blending through to magenta at the high e (Rocksmith
// convention — string identity is readable without labels).
const STRING_COLORS = [NEON_CYAN, '#33ccff', '#6699ff', NEON_VIOLET, '#cc44dd', NEON_MAGENTA];
const STRING_NAMES  = ['E', 'A', 'D', 'G', 'B', 'e'];
const GAUGE         = [3.2, 2.9, 2.4, 1.9, 1.5, 1.1];

const DIR_GLYPH = { up: '↑', down: '↓', same: '→' };

// ── Lane geometry ────────────────────────────────────────────────────────────
// t = 0 at the bridge (bottom, wide), t = 1 at the nut (top, narrow).
function laneX(stringIdx, t = 0) {
  const spread = 1 - NUT_SQUEEZE * t;
  return HWY_W / 2 + (stringIdx - (LANES - 1) / 2) * LANE_W * spread;
}

// Gem center Y (px from highway top) at run-time `now` (ms since run start).
// Spawns at -SPAWN_PAD a full leadTime before its hit-time; crosses the strike
// line (y = HWY_H) exactly AT its hit-time; tumbles TAIL px further, fading.
function gemY(now, hitAt, leadTime) {
  return -SPAWN_PAD + ((now - (hitAt - leadTime)) / leadTime) * TRAVEL;
}

/** Fraction of the way from bridge to nut for a given y — for lane convergence. */
const tAt = (y) => Math.max(0, Math.min(1, 1 - y / HWY_H));

/** The string a note is voiced on. voiceRiff put it in pos = [string, fret]. */
const stringOf = (n) => (Array.isArray(n?.pos) ? n.pos[0] : 0);

// ── Arrow silhouettes ────────────────────────────────────────────────────────
// Direction lives in the SHAPE, not in colour. As text glyphs ↑ and ↓ differ
// only in which end the head sits on — a few pixels at speed. As shapes they
// differ in outline and mass, which reads peripherally, survives at nut-size,
// and works for colourblind players. Colour stays on the strings, where it is
// already doing a job.
function arrowPath(dir, r) {
  if (dir === 'up') {
    return `M0,${-r * 1.1} L${r * 1.05},${r * 0.25} L${r * 0.42},${r * 0.25} ` +
           `L${r * 0.42},${r * 0.95} L${-r * 0.42},${r * 0.95} ` +
           `L${-r * 0.42},${r * 0.25} L${-r * 1.05},${r * 0.25} Z`;
  }
  if (dir === 'down') {
    return `M0,${r * 1.1} L${r * 1.05},${-r * 0.25} L${r * 0.42},${-r * 0.25} ` +
           `L${r * 0.42},${-r * 0.95} L${-r * 0.42},${-r * 0.95} ` +
           `L${-r * 0.42},${-r * 0.25} L${-r * 1.05},${-r * 0.25} Z`;
  }
  // "same" — a wide flat bar with no vertical intent, which is exactly what it
  // means. A chug run of them draws one continuous ladder down the string.
  return `M${-r * 1.05},${-r * 0.38} L${r * 1.05},${-r * 0.38} ` +
         `L${r * 1.05},${r * 0.38} L${-r * 1.05},${r * 0.38} Z`;
}

// ── The highway ──────────────────────────────────────────────────────────────
// run:      battleState.riffRun ({ startedAt, leadTime, notes:[{ idx, key,
//            hitAt, feel, okWin, glitched, pos, dir, sustain, bend, bendDir,
//            bendAmt, bendAt, bendWeight, partnerOf, hasPartner }] })
// results:  the performer's results array (entries carry noteIdx)
// accent:   the performing spirit's color
// onPressKey: the engine's judge — now takes a STRING NUMBER (1–6)
// showNums: print the number to press on the gem (teaching tiers only)
export function RiffHighway({ run, results, accent, onPressKey, showNums = true }) {
  // Latest run + judged set live on refs so the rAF loop (bound once per run)
  // always reads fresh data without re-subscribing on every judgment.
  const runRef    = useRef(run);
  const judgedRef = useRef({});
  const gemElsRef = useRef(new Map()); // element key → DOM node

  const judged = {};
  (results ?? []).forEach(r => { if (r.noteIdx != null) judged[r.noteIdx] = r; });
  runRef.current    = run;
  judgedRef.current = judged;

  // ── The motion loop — one rAF per run, transforms written directly. ──
  useEffect(() => {
    if (!run?.notes?.length) return;
    let raf;
    const tick = () => {
      const r = runRef.current;
      if (r) {
        const now = performance.now() - r.startedAt;
        gemElsRef.current.forEach((el) => {
          if (!el || !el.isConnected) return;
          const idx   = Number(el.dataset.idx);
          const hitAt = Number(el.dataset.hitat);
          const sIdx  = Number(el.dataset.str);
          if (judgedRef.current[idx]) { el.style.opacity = '0'; return; }
          const y = gemY(now, hitAt, r.leadTime);
          if (y < -GEM_R) {           // not spawned yet — park above, hidden
            el.style.opacity = '0';
            el.style.transform = 'translate(0,0)';
            return;
          }
          const past = Math.max(0, y - HWY_H);
          el.style.opacity = past > 0 ? String(Math.max(0, 1 - past / TAIL)) : '1';
          // Strings converge toward the nut, so a gem's x drifts as it falls.
          const yy = Math.min(y, HWY_H + TAIL);
          const dx = laneX(sIdx, tAt(yy)) - laneX(sIdx, 0);
          const scale = 0.62 + 0.38 * (1 - tAt(yy));   // smaller far away
          el.style.transform =
            `translate(${dx}px, ${yy + SPAWN_PAD}px) scale(${scale.toFixed(3)})`;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run?.startedAt, run?.notes?.length]);

  if (!run?.notes?.length) return null;

  // Which strings are lit right now (fresh hits), keyed by string index so two
  // notes on different strings can never light the wrong one.
  const litStrings = {};
  (results ?? []).forEach(r => {
    if (!r.hit || r.noteIdx == null) return;
    const n = run.notes.find(x => x.idx === r.noteIdx);
    if (n) litStrings[stringOf(n)] = true;
  });

  const gemRef = (elKey) => (el) => {
    if (el) gemElsRef.current.set(elKey, el);
    else gemElsRef.current.delete(elKey);
  };

  const acc = accent || NEON_CYAN;

  // ── A single falling gem (or its post-judgment burst). ──
  const gem = (n) => {
    const s   = stringOf(n);
    const res = judged[n.idx];
    const col = res ? (GRADE_COLORS[res.grade] ?? STRING_COLORS[s]) : STRING_COLORS[s];
    const dead = res && (res.grade === 'miss' || res.grade === 'wrong');
    const x0 = laneX(s, 0);
    const dir = n.dir ?? 'same';

    // sustain tail length in px — the tail is a duration, so it scales with
    // the same travel rate the gems fall at
    const tailPx = n.sustain ? (n.sustain / run.leadTime) * TRAVEL : 0;

    return (
      <g key={`gem-${n.idx}`}
         ref={gemRef(`gem-${n.idx}`)}
         data-idx={n.idx} data-hitat={n.hitAt} data-str={s}
         transform={`translate(${x0} ${-SPAWN_PAD})`}
         style={{ opacity: 0, willChange: 'transform, opacity' }}>

        {/* sustain tail, receding up the string */}
        {n.sustain > 0 && (
          <line x1={0} y1={0} x2={0} y2={-tailPx}
                stroke={dead ? '#555566' : col} strokeWidth={GEM_R * 0.8}
                strokeLinecap="round" opacity={dead ? 0.18 : 0.5}
                filter="url(#riffGlow)" />
        )}

        {/* bend marker — the moment to push, and which way */}
        {n.bend && !dead && (
          <g transform={`translate(0 ${-(n.bendAt / run.leadTime) * TRAVEL})`}>
            <circle r={GEM_R * (n.bendWeight === 'showpiece' ? 0.46 : 0.36)}
                    fill={n.bendWeight === 'showpiece' ? NEON_MAGENTA : NEON_ORANGE}
                    filter="url(#riffGlow)" />
            <text textAnchor="middle" dominantBaseline="central" y={1}
                  fontSize={GEM_R * 0.56} fontWeight="bold" fill="#06111f"
                  fontFamily="monospace">{n.bendDir === 'down' ? '↓' : '↑'}</text>
          </g>
        )}

        {/* chord link — these two are one press */}
        {n.hasPartner && (
          <line x1={0} y1={0} x2={laneX(s + 1, 0) - x0} y2={0}
                stroke={NEON_WHITE} strokeWidth={2.5} strokeDasharray="4 4"
                opacity={dead ? 0.2 : 0.75} filter="url(#riffGlow)" />
        )}

        {/* bendable halo — early warning that a gesture is coming */}
        {n.bend && !dead && (
          <circle r={GEM_R * 1.34} fill="none" stroke={NEON_ORANGE}
                  strokeWidth={1.6} strokeDasharray="3 3" opacity={0.9} />
        )}

        {/* the gem — silhouette carries the direction */}
        <path d={arrowPath(dir, GEM_R)}
              fill={dead ? 'rgba(40,44,56,0.6)' : `${col}44`}
              stroke={dead ? '#555566' : col} strokeWidth={2.4}
              filter={dead ? undefined : 'url(#riffGlow)'} />

        {/* what you press */}
        {showNums && !dead && (
          <text textAnchor="middle" dominantBaseline="central"
                y={dir === 'up' ? GEM_R * 0.2 : dir === 'down' ? -GEM_R * 0.2 : 0}
                fontSize={GEM_R * 0.62} fontWeight="bold" fill={NEON_WHITE}
                fontFamily="monospace">{s + 1}</text>
        )}
        {!showNums && !dead && (
          <text textAnchor="middle" dominantBaseline="central" y={0}
                fontSize={GEM_R * 0.5} fontWeight="bold" fill={`${NEON_WHITE}aa`}
                fontFamily="monospace">{DIR_GLYPH[dir]}</text>
        )}
      </g>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={HWY_W} height={HWY_H + BTN_H + 8}
           viewBox={`0 0 ${HWY_W} ${HWY_H + BTN_H + 8}`}
           style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <filter id="riffGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="riffSlab" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="rgba(10,23,42,0.10)" />
            <stop offset="70%" stopColor="rgba(6,17,31,0.55)" />
            <stop offset="100%" stopColor="rgba(3,8,16,0.92)" />
          </linearGradient>
        </defs>

        {/* the fretboard slab, narrow at the nut */}
        <polygon
          points={`${laneX(0, 1) - 8},0 ${laneX(5, 1) + 8},0 ` +
                  `${laneX(5, 0) + 18},${HWY_H} ${laneX(0, 0) - 18},${HWY_H}`}
          fill="url(#riffSlab)" stroke="rgba(25,230,255,0.22)" strokeWidth={1.5} />

        {/* the six strings, converging toward the nut */}
        {STRING_NAMES.map((nm, i) => (
          <line key={`str-${i}`}
                x1={laneX(i, 1)} y1={0} x2={laneX(i, 0)} y2={HWY_H}
                stroke={litStrings[i] ? NEON_WHITE : STRING_COLORS[i]}
                strokeWidth={GAUGE[i]}
                opacity={litStrings[i] ? 1 : 0.55}
                filter="url(#riffGlow)" />
        ))}

        {/* the bridge / strike line */}
        <line x1={laneX(0, 0) - 26} y1={HWY_H} x2={laneX(5, 0) + 26} y2={HWY_H}
              stroke={NEON_MAGENTA} strokeWidth={3} filter="url(#riffGlow)" />

        {/* gems */}
        {run.notes.map(n => gem(n))}

        {/* string buttons — tappable, so riff-offs work on touch screens */}
        {STRING_NAMES.map((nm, i) => (
          <g key={`btn-${i}`}
             onPointerDown={(e) => { e.preventDefault(); onPressKey?.(i + 1); }}
             style={{ cursor: 'pointer', touchAction: 'none' }}>
            <circle cx={laneX(i, 0)} cy={HWY_H + 26} r={16}
                    fill={litStrings[i] ? STRING_COLORS[i] : 'rgba(6,17,31,0.85)'}
                    stroke={litStrings[i] ? NEON_WHITE : STRING_COLORS[i]}
                    strokeWidth={2} filter="url(#riffGlow)" />
            <text x={laneX(i, 0)} y={HWY_H + 26} textAnchor="middle"
                  dominantBaseline="central" fontSize={13} fontWeight="bold"
                  fill={litStrings[i] ? '#06111f' : STRING_COLORS[i]}
                  fontFamily="monospace" style={{ pointerEvents: 'none' }}>
              {i + 1}
            </text>
            <text x={laneX(i, 0)} y={HWY_H + 47} textAnchor="middle"
                  fontSize={9} fill="rgba(160,180,205,0.6)" fontFamily="monospace"
                  style={{ pointerEvents: 'none' }}>{nm}</text>
          </g>
        ))}

        {/* accent underline — the performing spirit's colour */}
        <line x1={0} y1={HWY_H + BTN_H + 6} x2={HWY_W} y2={HWY_H + BTN_H + 6}
              stroke={acc} strokeWidth={2} opacity={0.5} />
      </svg>
    </div>
  );
}
