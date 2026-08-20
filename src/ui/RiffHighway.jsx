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
// ⚠️ AND THE LOOP WRITES AN ABSOLUTE POSITION, NEVER A DELTA (fixed 2026-08-19).
// A CSS transform on an SVG node REPLACES the `transform` attribute rather than
// composing with it. Writing "just the drift" and leaving the lane's base x on
// the attribute dropped the base x entirely and every gem fell down the left
// edge of the neck. If you touch this loop, write the whole transform.
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
import React, { useEffect, useRef, useState } from "react";

// ── Geometry (px) ────────────────────────────────────────────────────────────
// 🎸 THE NECK IS TALL AND NARROW, because a fretboard is. The width is fixed by
// the six strings; only the LENGTH flexes, and it takes whatever vertical room
// the overlay can spare (see `neckHeight`). A longer neck is not decoration: the
// gem spends the same lead time crossing MORE pixels, so it separates from its
// neighbours and the shape you have to read arrives sooner and clearer.
const GEM_R     = 17;   // gem radius at the bridge
const SPAWN_PAD = 34;   // gems spawn this far above the highway top (off-screen)
const TAIL      = 54;   // how far past the line a missed gem tumbles before fading

const LANES     = 6;
const LANE_W    = 56;                      // string spacing at the bridge
const SIDE      = 30;
const HWY_W     = (LANES - 1) * LANE_W + SIDE * 2;
const BTN_H     = 52;                      // string-button row below the bridge

// ── 🎸 THE TILT ──────────────────────────────────────────────────────────────
// How far the strings converge at the nut: the neck is `1 - NUT_SQUEEZE` as wide
// up there as it is at the bridge. This is the single number that decides
// whether the highway reads as a NECK RECEDING AWAY FROM YOU or as a slightly
// wonky ladder, and it was set too timid — at 0.34 the taper was barely past a
// rounding error, so the eye read six parallel lanes.
//
// 📌 The practice trainer states the same idea as `K.far` (nut half-width as a
// FRACTION of the bridge, so `far = 1 - NUT_SQUEEZE`) and ships 0.20 — a far
// harder tilt than this. It can afford one: its bridge is up to 860px wide, so
// even a fifth of that leaves the nut lanes readable. This neck is 280px at the
// bridge, and 0.20 would squeeze the six strings into 56px of nut — gems on top
// of each other. 0.50 is the strongest tilt this width carries: 28px between
// strings at the nut, against a gem that has shrunk to ~15px up there.
//
// ⚠️ Raising it further means widening LANE_W with it, or the top of the neck
// stops being playable to read.
const NUT_SQUEEZE = 0.50;

// How long the neck may get, and the vertical room the rest of the play card
// needs around it (title line, timing feedback, the progress row, card padding).
// ⚠️ CHROME IS MEASURED, NOT GUESSED — undercount it and the neck grows past the
// bottom of the window, which is precisely the failure this was written to end:
// the tallest thing on screen pushed the controls below the fold.
const NECK_MIN   = 300;
const NECK_MAX   = 620;
const CARD_CHROME = 250;

/** The neck length that fits the window right now. */
function neckHeight(viewportH) {
  return Math.round(Math.max(NECK_MIN, Math.min(NECK_MAX, viewportH - CARD_CHROME)));
}

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

// ── Perspective ──────────────────────────────────────────────────────────────
// The neck recedes: notes at the nut are small, slow and crowded; they open out
// and accelerate as they come at you. This is what makes the highway feel like
// a neck rather than a chart.
//
// ⚠️ ONLY THE PIXELS ARE CURVED. Judging stays linear in time — a note's grade
// window is untouched by where perspective puts it on screen. Bending the clock
// as well as the geometry would make the same timing error score differently
// depending on tempo.
// 📌 2.6 is the practice trainer's own `K.persp` default — same curve, so a gem
// accelerates toward you at the same rate in both places.
const PERSP = 2.6;
function persp(z) {                        // z: 0 at the bridge → 1 at the nut
  const k = PERSP;
  if (k <= 0.001) return z;
  return (z / (1 + k * z)) * (1 + k);
}

// t = 0 at the bridge (bottom, wide), t = 1 at the nut (top, narrow).
function laneX(stringIdx, t = 0) {
  const spread = 1 - NUT_SQUEEZE * t;
  return HWY_W / 2 + (stringIdx - (LANES - 1) / 2) * LANE_W * spread;
}

// Gem center Y (px from highway top) at run-time `now` (ms since run start).
// Spawns above the highway a full leadTime before its hit-time and crosses the
// strike line (y = H) exactly AT its hit-time — perspective changes how it
// travels between those two points, never when it arrives.
//
// ⚠️ `H` IS A PARAMETER NOW, not a module constant: the neck's length depends on
// the window. Everything below takes it explicitly rather than closing over it,
// so there is no second, stale copy of the neck length anywhere.
function gemY(now, hitAt, leadTime, H) {
  const travel = H + SPAWN_PAD;
  const z = Math.max(0, Math.min(1, (hitAt - now) / leadTime));
  const y = H - persp(z) * travel;
  // past the line the gem tumbles on linearly — the curve is for approach only
  return now > hitAt ? H + ((now - hitAt) / leadTime) * travel : y;
}

/** Fraction of the way from bridge to nut for a given y — for lane convergence. */
const tAt = (y, H) => Math.max(0, Math.min(1, 1 - y / H));

// Fret wires, spaced by real temperament so they bunch toward the nut. Purely
// scenery, but it's the cue that reads as "guitar neck" rather than "lanes".
const FRET_ZS = Array.from({ length: 13 }, (_, f) => {
  const along = 1 - Math.pow(2, -f / 12);
  return 1 - along / (1 - Math.pow(2, -12 / 12));
});

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
export function RiffHighway({ run, results, accent, onPressKey, showNums = true, height }) {
  // Latest run + judged set live on refs so the rAF loop (bound once per run)
  // always reads fresh data without re-subscribing on every judgment.
  const runRef    = useRef(run);
  const judgedRef = useRef({});
  const gemElsRef = useRef(new Map()); // element key → DOM node

  // 🎸 HOW LONG THE NECK IS. A caller may pin it; otherwise it takes the window.
  // Re-measured on resize so the neck grows when the browser does — a duel is
  // often the moment somebody maximises the window.
  const [viewportH, setViewportH] = useState(
    () => (typeof window === 'undefined' ? 900 : window.innerHeight));
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const HWY_H  = height ?? neckHeight(viewportH);
  const TRAVEL = HWY_H + SPAWN_PAD;   // nut → strike line, the whole fall

  const judged = {};
  (results ?? []).forEach(r => { if (r.noteIdx != null) judged[r.noteIdx] = r; });
  runRef.current    = run;
  judgedRef.current = judged;

  // ── The motion loop — one rAF per run, transforms written directly. ──
  // ⚠️ `HWY_H` IS IN THE DEPS. The loop closes over the neck length, so a resize
  // mid-riff would otherwise keep flying gems at the old length while the drawn
  // neck used the new one — the gems would cross a strike line that isn't there.
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
          if (hitAt - now > r.leadTime) {   // not spawned yet — park above, hidden
            el.style.opacity = '0';
            el.style.transform = `translate(${laneX(sIdx, 1)}px, ${-SPAWN_PAD}px)`;
            return;
          }
          const y = gemY(now, hitAt, r.leadTime, HWY_H);
          const past = Math.max(0, y - HWY_H);
          el.style.opacity = past > 0 ? String(Math.max(0, 1 - past / TAIL)) : '1';
          // Strings converge toward the nut, so a gem's x drifts as it falls.
          const yy = Math.min(y, HWY_H + TAIL);
          const t = tAt(yy, HWY_H);
          const scale = 0.42 + 0.58 * (1 - t);        // small and far, big and near
          // ⚠️ ABSOLUTE, NOT RELATIVE — AND THIS IS THE WHOLE BUG THAT KILLED THE
          // IN-GAME HIGHWAY. A CSS `transform` on an SVG node does NOT compose
          // with the element's `transform` ATTRIBUTE: the attribute is a
          // presentation attribute, so any inline style REPLACES it outright.
          // This loop used to write only the lane DRIFT (`dx`) plus a `+SPAWN_PAD`
          // fudge, both of which only make sense if the attribute's
          // `translate(x0, -SPAWN_PAD)` were still underneath — it never was. Every
          // gem therefore fell down x ≈ 0, i.e. off the left edge of the neck in
          // one overlapping column, 34px below where it was judged. The riff-off
          // looked broken while Riff Practice (canvas, one absolute transform per
          // gem) looked right. Write the FULL position every frame.
          el.style.transform =
            `translate(${laneX(sIdx, t)}px, ${yy}px) scale(${scale.toFixed(3)})`;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run?.startedAt, run?.notes?.length, HWY_H]);

  if (!run?.notes?.length) return null;

  // Which string is lit right now — the one the LAST landed gem was on.
  //
  // ⚠️ THIS USED TO ACCUMULATE OVER THE WHOLE RUN, and it quietly wrecked the
  // thing the colours are for. Every hit permanently switched its string to
  // white, so four notes in, most of the neck was white and the cyan→magenta
  // ramp that tells you WHICH STRING YOU ARE LOOKING AT was gone — exactly when
  // the chart gets busy enough to need it. A hit is a flash, not a state: only
  // the most recent one is lit, so the highlight travels with the riff.
  const litStrings = {};
  {
    const last = (results ?? [])[(results ?? []).length - 1];
    if (last?.hit && last.noteIdx != null) {
      const n = run.notes.find(x => x.idx === last.noteIdx);
      if (n) litStrings[stringOf(n)] = true;
    }
  }

  // ⚠️ THE BRACES ARE LOAD-BEARING ON REACT 19. A callback ref that RETURNS a
  // value is now read as returning a cleanup function; `Map.set` returns the Map
  // and `Map.delete` returns a boolean, so an expression body would hand React a
  // non-function "cleanup" every time a gem mounts. Keep the statement body.
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
         style={{
           opacity: 0, willChange: 'transform, opacity',
           // ⚠️ ONE TRANSFORM SOURCE, AND IT IS THE STYLE. The `transform`
           // ATTRIBUTE cannot live alongside this — an inline style overrides a
           // presentation attribute completely, so having both means the rAF loop
           // silently throws the attribute away (see the loop above).
           //
           // ⚠️ `view-box` + `0 0` is what makes a CSS transform on an SVG node
           // behave like the attribute did. The CSS defaults (`view-box` with
           // `transform-origin: 50% 50%`) scale about the CENTRE OF THE WHOLE SVG,
           // which sprays gems across the neck as they grow. Origin at the user
           // -space origin means translate-then-scale grows the gem about its own
           // position, exactly like `transform="translate(…) scale(…)"`.
           transformBox: 'view-box', transformOrigin: '0 0',
           transform: `translate(${x0}px, ${-SPAWN_PAD}px)`,
         }}>

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

        {/* fret wires — real temperament, bunching toward the nut */}
        {FRET_ZS.map((z, f) => {
          const y = HWY_H - persp(z) * HWY_H;
          const t = tAt(y, HWY_H);
          const isNut = f === 0;
          return (
            <line key={`fw${f}`} x1={laneX(0, t) - 6} y1={y}
                  x2={laneX(5, t) + 6} y2={y}
                  stroke={NEON_CYAN}
                  strokeWidth={isNut ? 2 : 1}
                  opacity={isNut ? 0.8 : 0.06 + 0.10 * (1 - t)}
                  filter={isNut ? 'url(#riffGlow)' : undefined} />
          );
        })}

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
