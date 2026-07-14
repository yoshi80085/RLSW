// =============================================================================
// ui/RiffHighway.jsx — 🎸 FALLING-NOTES HIGHWAY — the Guitar Hero riff-off view
// -----------------------------------------------------------------------------
// Renders battleState.riffRun: every note of the riff falls as a glowing GEM
// down a neon highway onto the strike line at the instrument (piano keys /
// guitar strings).
//
// ⚠️ Gem motion is driven by a requestAnimationFrame loop that writes
// transforms straight from the engine clock (run.startedAt) every frame —
// NOT by CSS animations. CSS animations break here: React re-renders on every
// judgment, and rewriting a running animation's delay does not restart it —
// the browser keeps the original start time, so every gem lurches forward by
// the elapsed time on each re-render. The rAF loop reads the clock fresh each
// frame, so gem positions are exact no matter how often React re-renders.
//
// Presentational: run data + results arrive via props; presses route back
// through onPressKey (same judge as the physical keyboard — taps on the
// strike-zone instrument make riff-offs playable on touch screens).
// Timing/difficulty numbers live in riff/fallingNotes.js.
// =============================================================================
import React, { useEffect, useRef } from "react";

// ── Geometry (px) ────────────────────────────────────────────────────────────
const HWY_H     = 230;  // highway height — strike line sits at its bottom edge
const GEM_R     = 16;   // gem radius
const SPAWN_PAD = 34;   // gems spawn this far above the highway top (off-screen)
const TAIL      = 54;   // how far past the line a missed gem tumbles before fading
const TRAVEL    = HWY_H + SPAWN_PAD;          // spawn → strike line distance

// Piano: one octave C–B. White key width / black key size scale the whole rig.
const WKEY_W = 42, WKEY_H = 88, BKEY_W = 24, BKEY_H = 54;
const WHITES = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
const BLACK_FOR_SHARP = { C: 0, D: 1, F: 3, G: 4, A: 5 }; // sharp → white idx it sits right of
const PIANO_W = WHITES.length * WKEY_W;

// Guitar: 6 strings (lanes), 7 frets below the nut. Same note→position map as
// renderInstrument in the main file: natural = base fret, sharp = +1 fret.
const GTR_COL = 42, GTR_SIDE = 25, GTR_FRETS = 7, GTR_FH = 18, GTR_TOP = 18;
const GTR_STRINGS = ['E', 'A', 'D', 'G', 'B', 'e'];
const GTR_GAUGE   = [3.2, 2.6, 2.0, 1.6, 1.2, 0.8];
const GPOS = { e: [0, 0], f: [0, 1], a: [1, 0], b: [1, 2], c: [1, 3], d: [2, 0], g: [3, 0] };
const GTR_W = (GTR_STRINGS.length - 1) * GTR_COL + GTR_SIDE * 2;
const GTR_H = GTR_TOP + GTR_FRETS * GTR_FH + 12;

// ── Neon palette (outrun / synthwave) ────────────────────────────────────────
const NEON_CYAN    = '#19e6ff';
const NEON_MAGENTA = '#ff2d95';
const NEON_VIOLET  = '#8a5cff';
const NEON_ORANGE  = '#ff8a2a';
const NEON_WHITE   = '#ffffee';

const GRADE_COLORS = { perfect: NEON_WHITE, good: NEON_CYAN, ok: NEON_VIOLET, miss: '#555566', wrong: '#555566' };

const isSharp = k => !!k && k === k.toUpperCase() && k !== k.toLowerCase();
const noteGlyph = k => (isSharp(k) ? `${k}♯` : (k ?? '').toUpperCase());

// Guitar fingering for a note key: [stringIdx, fret] (sharp = +1 fret).
function guitarPos(k) {
  if (!k) return null;
  const base = GPOS[k.toLowerCase()];
  if (!base) return null;
  return isSharp(k) ? [base[0], base[1] + 1] : base;
}

// Lane x-center for a falling gem, per instrument view.
function laneX(view, k) {
  if (!k) return 0;
  if (view === 'guitar') {
    const pos = guitarPos(k);
    return GTR_SIDE + (pos ? pos[0] : 0) * GTR_COL;
  }
  if (isSharp(k)) {
    const wi = BLACK_FOR_SHARP[k.toUpperCase()] ?? 0;
    return (wi + 1) * WKEY_W;                    // black key center
  }
  const wi = WHITES.indexOf(k.toLowerCase());
  return (wi < 0 ? 0 : wi) * WKEY_W + WKEY_W / 2; // white key center
}

// Gem center Y (px from highway top) at run-time `now` (ms since run start).
// Spawns at -SPAWN_PAD a full leadTime before its hit-time; crosses the strike
// line (y = HWY_H) exactly AT its hit-time; tumbles TAIL px further, fading.
function gemY(now, hitAt, leadTime) {
  return -SPAWN_PAD + ((now - (hitAt - leadTime)) / leadTime) * TRAVEL;
}

// ── Strike-zone instruments (scaled, tappable) ──────────────────────────────
// litKeys: note keys flashing green right now (fresh hits). Taps fire onPress
// with the note letter — same contract as the physical keyboard.
function PianoStrike({ litKeys, accent, onPress }) {
  const lit = litKeys ?? {};
  // Neon piano: transparent keys with cyan outlines; blacks filled magenta;
  // pressed keys flood-fill with their glow color.
  return (
    <svg width={PIANO_W} height={WKEY_H} style={{ display: 'block' }}>
      <defs>
        <filter id="neonBloom" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur1"/>
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur2"/>
          <feMerge><feMergeNode in="blur2"/><feMergeNode in="blur1"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* white keys — transparent fill, glowing cyan outline */}
      {WHITES.map((l, i) => (
        <rect key={l} x={i * WKEY_W + 1} y={1} width={WKEY_W - 3} height={WKEY_H - 2} rx={3}
          fill={lit[l] ? `${NEON_CYAN}33` : 'transparent'}
          stroke={lit[l] ? NEON_WHITE : NEON_CYAN} strokeWidth={2}
          filter={lit[l] ? 'url(#neonBloom)' : undefined}
          style={{ cursor: 'pointer', transition: 'fill 0.12s, stroke 0.12s' }}
          onPointerDown={e => { e.preventDefault(); onPress?.(l); }} />
      ))}
      {/* white key labels — cyan glow */}
      {WHITES.map((l, i) => (
        <text key={`t${l}`} x={i * WKEY_W + WKEY_W / 2} y={WKEY_H - 8} textAnchor="middle"
          fontSize={10} fontWeight="bold" fill={lit[l] ? NEON_WHITE : `${NEON_CYAN}99`} fontFamily="monospace"
          style={{ pointerEvents: 'none' }}>{l.toUpperCase()}</text>
      ))}
      {/* black keys — filled magenta glow */}
      {Object.entries(BLACK_FOR_SHARP).map(([sharp, wi]) => (
        <rect key={sharp} x={(wi + 1) * WKEY_W - BKEY_W / 2} y={0} width={BKEY_W} height={BKEY_H} rx={2}
          fill={lit[sharp] ? NEON_WHITE : NEON_MAGENTA}
          stroke={lit[sharp] ? NEON_WHITE : `${NEON_MAGENTA}cc`} strokeWidth={1.5}
          filter="url(#neonBloom)"
          style={{ cursor: 'pointer', transition: 'fill 0.12s' }}
          onPointerDown={e => { e.preventDefault(); onPress?.(sharp); }} />
      ))}
    </svg>
  );
}

// Neon string colors — cyan at the low E, blending through to magenta at the high e.
const NEON_STRING_COLORS = [NEON_CYAN, '#33ccff', '#6699ff', NEON_VIOLET, '#cc44dd', NEON_MAGENTA];

function GuitarStrike({ litKeys, accent, onPress, resolveStringKey }) {
  const lit = litKeys ?? {};
  const sx = i => GTR_SIDE + i * GTR_COL;
  const fy = f => GTR_TOP + f * GTR_FH;
  const litDots = Object.keys(lit).map(k => ({ k, pos: guitarPos(k) })).filter(d => d.pos);
  return (
    <svg width={GTR_W} height={GTR_H} style={{ display: 'block' }}>
      <defs>
        <filter id="neonGtrBloom" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1"/>
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2"/>
          <feMerge><feMergeNode in="blur2"/><feMergeNode in="blur1"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* string names — neon gradient per string */}
      {GTR_STRINGS.map((nm, i) => (
        <text key={`n${i}`} x={sx(i)} y={GTR_TOP - 6} textAnchor="middle" fontSize={9}
          fontWeight="bold" fill={NEON_STRING_COLORS[i]} fontFamily="monospace">{nm}</text>
      ))}
      {/* fret inlay dots — glowing violet */}
      {[3, 5, 7].filter(f => f <= GTR_FRETS).map(f => (
        <circle key={`in${f}`} cx={(sx(2) + sx(3)) / 2} cy={GTR_TOP + (f - 0.5) * GTR_FH}
          r={3.5} fill={`${NEON_VIOLET}55`} stroke={`${NEON_VIOLET}44`} strokeWidth={1}
          filter="url(#neonGtrBloom)" />
      ))}
      {/* frets — dim neon lines; nut = outline only (no fill) */}
      {Array.from({ length: GTR_FRETS + 1 }).map((_, f) => (
        <line key={`f${f}`} x1={sx(0)} y1={fy(f)} x2={sx(GTR_STRINGS.length - 1)} y2={fy(f)}
          stroke={f === 0 ? NEON_CYAN : `${NEON_CYAN}22`}
          strokeWidth={f === 0 ? 2.5 : 0.8}
          filter={f === 0 ? 'url(#neonGtrBloom)' : undefined} />
      ))}
      {/* strings — glowing neon lines, cyan→magenta */}
      {GTR_STRINGS.map((_, i) => (
        <line key={`s${i}`} x1={sx(i)} y1={fy(0)} x2={sx(i)} y2={fy(GTR_FRETS)}
          stroke={NEON_STRING_COLORS[i]} strokeWidth={GTR_GAUGE[i] * 0.8}
          strokeLinecap="round" filter="url(#neonGtrBloom)" />
      ))}
      {/* lit note blips — white-hot glow on press */}
      {litDots.map(({ k, pos }) => {
        const [s, f] = pos, cx = sx(s);
        return f === 0
          ? <circle key={k} cx={cx} cy={GTR_TOP - 9} r={5}
              fill={NEON_WHITE} stroke={NEON_CYAN} strokeWidth={1.5}
              filter="url(#neonGtrBloom)" />
          : <circle key={k} cx={cx} cy={GTR_TOP + (f - 0.5) * GTR_FH} r={7.5}
              fill={NEON_WHITE} stroke={NEON_STRING_COLORS[s]} strokeWidth={1.5}
              filter="url(#neonGtrBloom)" />;
      })}
      {/* invisible tap strips */}
      {GTR_STRINGS.map((_, i) => (
        <rect key={`tap${i}`} x={sx(i) - GTR_COL / 2} y={0} width={GTR_COL} height={GTR_H} fill="transparent"
          style={{ cursor: 'pointer' }}
          onPointerDown={e => { e.preventDefault(); const k = resolveStringKey?.(i); if (k) onPress?.(k); }} />
      ))}
    </svg>
  );
}

// ── The highway ──────────────────────────────────────────────────────────────
// run:      battleState.riffRun ({ startedAt, leadTime, notes:[{idx,key,hitAt,feel,ghostKey,okWin,glitched}] })
// results:  the performer's results array (entries carry noteIdx)
// ghostHit: battleState.ghostHit ({ idx, main, ghost }) — half-landed E-Rush pair
// accent:   the performing spirit's color; onPressKey: the engine's judge fn
export function RiffHighway({ run, results, ghostHit, view, accent, onPressKey, showLabels = true }) {
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
        gemElsRef.current.forEach((el, elKey) => {
          if (!el || !el.isConnected) return;
          const idx   = Number(el.dataset.idx);
          const hitAt = Number(el.dataset.hitat);
          if (judgedRef.current[idx]) { el.style.opacity = '0'; return; } // burst took over
          const y = gemY(now, hitAt, r.leadTime);
          if (y < -GEM_R) {           // not spawned yet — park above, hidden
            el.style.opacity = '0';
            el.style.transform = 'translateY(0)';
            return;
          }
          const past = Math.max(0, y - HWY_H); // px beyond the strike line
          el.style.opacity = past > 0 ? String(Math.max(0, 1 - past / TAIL)) : '1';
          // untransformed gem center sits at y = -SPAWN_PAD → shift down to `y`
          el.style.transform = `translateY(${Math.min(y, HWY_H + TAIL) + SPAWN_PAD}px)`;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run?.startedAt, run?.notes?.length]); // new run (new turn / round) → fresh loop

  if (!run?.notes?.length) return null;
  const W = view === 'guitar' ? GTR_W : PIANO_W;

  // Keys flashing green on the instrument: hits already judged this run.
  const litKeys = {};
  (results ?? []).forEach(r => { if (r.hit && r.noteIdx != null) {
    const n = run.notes.find(x => x.idx === r.noteIdx);
    if (n) { litKeys[n.key] = true; if (n.ghostKey) litKeys[n.ghostKey] = true; }
  } });

  // For guitar taps: the key of the nearest unjudged gem on that string.
  const resolveStringKey = (stringIdx) => {
    const now = performance.now() - run.startedAt;
    let best = null, bestD = Infinity;
    run.notes.forEach(n => {
      if (judged[n.idx]) return;
      [n.key, n.ghostKey].filter(Boolean).forEach(k => {
        if ((guitarPos(k) ?? [-1])[0] !== stringIdx) return;
        const d = Math.abs(now - n.hitAt);
        if (d < bestD) { bestD = d; best = k; }
      });
    });
    return best;
  };

  // Register a gem's DOM node with the motion loop (classic callback ref —
  // React calls with null on unmount, which drops the entry).
  const gemRef = (elKey) => (el) => {
    if (el) gemElsRef.current.set(elKey, el);
    else gemElsRef.current.delete(elKey);
  };

  // A single falling gem (or its post-judgment burst).
  const gem = (n, key, isGhost) => {
    const x   = laneX(view, key);
    const r   = judged[n.idx];
    const gh  = ghostHit && ghostHit.idx === n.idx ? ghostHit : null;
    const half = isGhost ? gh?.ghost : gh?.main;
    const id  = `${n.idx}${isGhost ? 'g' : ''}`;

    // Judged → burst at the strike line.
    if (r) {
      const col = GRADE_COLORS[r.grade] ?? accent;
      const sharp = isSharp(key);
      const burstDiamond = !showLabels && sharp;
      const isMiss = r.grade === 'miss' || r.grade === 'wrong';
      return (
        <div key={`b${id}-${r.grade}`} style={{
          position: 'absolute', left: x, top: HWY_H, width: GEM_R * 2, height: GEM_R * 2,
          marginLeft: -GEM_R, marginTop: -GEM_R,
          borderRadius: burstDiamond ? '3px' : '50%',
          border: `2px solid ${col}`,
          background: isMiss ? '#333' : `${col}33`,
          boxShadow: isMiss ? 'none' : `0 0 18px ${col}, 0 0 6px ${col}`,
          pointerEvents: 'none',
          animation: isMiss
            ? 'riffgem-miss-tumble 0.5s ease-in forwards'
            : (burstDiamond ? 'riffgem-burst-diamond' : 'riffgem-burst') + ' 0.45s ease-out forwards',
        }} />
      );
    }

    const ghost   = isGhost || !!n.ghostKey;
    // Neon gem colors: ghost=violet, glitched=magenta, rushed=orange, default=cyan
    const baseCol = isGhost ? NEON_VIOLET : n.glitched ? NEON_MAGENTA : n.feel === 'rushed' ? NEON_ORANGE : NEON_CYAN;
    const sharp   = isSharp(key);
    const diamond = !showLabels && sharp;
    return (
      <div key={`g${id}-${key}`} ref={gemRef(`g${id}-${key}`)}
        className="riff-gem-tail"
        data-idx={n.idx} data-hitat={n.hitAt}
        style={{
          '--gem-color': half ? NEON_WHITE : baseCol,
          position: 'absolute', left: x, top: -SPAWN_PAD, width: GEM_R * 2, height: GEM_R * 2,
          marginLeft: -GEM_R, marginTop: -GEM_R,
          borderRadius: diamond ? '3px' : '50%',
          transform: diamond ? 'rotate(45deg)' : undefined,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Orbitron',sans-serif", fontSize: sharp ? 11 : 13, fontWeight: 900,
          color: half ? '#06111f' : NEON_WHITE,
          background: half ? NEON_WHITE : `${baseCol}22`,
          border: `2px solid ${half ? NEON_WHITE : baseCol}`,
          boxShadow: `0 0 10px ${half ? NEON_WHITE : baseCol}, 0 0 4px ${half ? NEON_WHITE : baseCol}88`,
          opacity: 0,
          pointerEvents: 'none', willChange: 'transform, opacity',
        }}>
        {showLabels ? noteGlyph(key) : null}
      </div>
    );
  };

  return (
    <div style={{ display: 'inline-block', textAlign: 'center' }}>
      <style>{`
        @keyframes riffgem-burst {
          0%   { transform: scale(0.7); opacity: 1; }
          100% { transform: scale(2.1); opacity: 0; }
        }
        @keyframes riffgem-burst-diamond {
          0%   { transform: rotate(45deg) scale(0.7); opacity: 1; }
          100% { transform: rotate(45deg) scale(2.1); opacity: 0; }
        }
        @keyframes riffgem-miss-tumble {
          0%   { transform: scale(1); opacity: 0.7; filter: grayscale(1); }
          100% { transform: scale(0.4) rotate(90deg) translateY(30px); opacity: 0; filter: grayscale(1); }
        }
        @keyframes riffline-pulse {
          0%, 100% { box-shadow: 0 0 12px ${NEON_ORANGE}, 0 0 28px ${NEON_MAGENTA}88; }
          50%      { box-shadow: 0 0 20px ${NEON_ORANGE}, 0 0 40px ${NEON_MAGENTA}cc; }
        }
        @keyframes riff-grid-scroll {
          0%   { background-position-y: 0; }
          100% { background-position-y: 40px; }
        }
        .riff-gem-tail::before {
          content: '';
          position: absolute;
          left: 50%; top: -18px;
          width: 3px; height: 18px;
          margin-left: -1.5px;
          background: linear-gradient(180deg, transparent, var(--gem-color));
          border-radius: 2px;
          pointer-events: none;
          opacity: 0.7;
        }
      `}</style>

      {/* ── The highway — neon grid, gems fall onto the sunset strike line ── */}
      <div style={{
        position: 'relative', width: W, height: HWY_H, margin: '0 auto', overflow: 'hidden',
        background: '#030810',
        borderLeft: `1px solid ${NEON_CYAN}22`, borderRight: `1px solid ${NEON_CYAN}22`,
        borderRadius: '8px 8px 0 0',
      }}>
        {/* perspective grid — horizontal lines scrolling toward the strike line */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `repeating-linear-gradient(180deg, ${NEON_CYAN}0a 0px, transparent 1px, transparent 39px, ${NEON_CYAN}0a 40px)`,
          animation: 'riff-grid-scroll 1.2s linear infinite',
        }} />
        {/* lane guides — neon-tinted rails */}
        {[...new Set(run.notes.flatMap(n => [n.key, n.ghostKey].filter(Boolean)).map(k => laneX(view, k)))].map(x => (
          <div key={`lane${x}`} style={{
            position: 'absolute', left: x, top: 0, bottom: 0, width: 1,
            background: `linear-gradient(180deg, transparent, ${NEON_CYAN}18 40%, ${NEON_MAGENTA}33)`,
          }} />
        ))}
        {/* gems (real + E-Rush ghosts) */}
        {run.notes.map(n => gem(n, n.key, false))}
        {run.notes.map(n => (n.ghostKey ? gem(n, n.ghostKey, true) : null))}
        {/* the strike line — sunset gradient (orange → magenta) */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 3,
          background: `linear-gradient(90deg, ${NEON_ORANGE}, ${NEON_MAGENTA})`,
          animation: 'riffline-pulse 1.1s ease-in-out infinite',
        }} />
      </div>

      {/* ── The strike zone — hit the key as the gem lands on it ── */}
      <div style={{ width: W, margin: '0 auto', filter: `drop-shadow(0 0 8px ${NEON_CYAN}33)` }}>
        {view === 'guitar'
          ? <GuitarStrike litKeys={litKeys} accent={accent} onPress={onPressKey} resolveStringKey={resolveStringKey} />
          : <PianoStrike litKeys={litKeys} accent={accent} onPress={onPressKey} />}
      </div>
    </div>
  );
}
