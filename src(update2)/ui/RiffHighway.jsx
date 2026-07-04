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

const GRADE_COLORS = { perfect: '#44ff99', good: '#aaff44', ok: '#ffcc44', miss: '#ff4455', wrong: '#ff4455' };

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
  return (
    <svg width={PIANO_W} height={WKEY_H} style={{ display: 'block' }}>
      {WHITES.map((l, i) => (
        <rect key={l} x={i * WKEY_W} y={0} width={WKEY_W - 1} height={WKEY_H} rx={3}
          fill={lit[l] ? '#2bd66b' : '#e6ecf6'} stroke="#0a0e16" strokeWidth={1}
          style={{ cursor: 'pointer', transition: 'fill 0.12s' }}
          onPointerDown={e => { e.preventDefault(); onPress?.(l); }} />
      ))}
      {WHITES.map((l, i) => (
        <text key={`t${l}`} x={i * WKEY_W + WKEY_W / 2} y={WKEY_H - 8} textAnchor="middle"
          fontSize={10} fontWeight="bold" fill="#5a6a85" fontFamily="monospace"
          style={{ pointerEvents: 'none' }}>{l.toUpperCase()}</text>
      ))}
      {Object.entries(BLACK_FOR_SHARP).map(([sharp, wi]) => (
        <rect key={sharp} x={(wi + 1) * WKEY_W - BKEY_W / 2} y={0} width={BKEY_W} height={BKEY_H} rx={2}
          fill={lit[sharp] ? '#2bd66b' : '#0c1018'} stroke="#000" strokeWidth={1}
          style={{ cursor: 'pointer', transition: 'fill 0.12s' }}
          onPointerDown={e => { e.preventDefault(); onPress?.(sharp); }} />
      ))}
    </svg>
  );
}

function GuitarStrike({ litKeys, accent, onPress, resolveStringKey }) {
  const lit = litKeys ?? {};
  const sx = i => GTR_SIDE + i * GTR_COL;
  const fy = f => GTR_TOP + f * GTR_FH;
  // fret-dot markers for lit notes (mirror of renderInstrument's blips)
  const litDots = Object.keys(lit).map(k => ({ k, pos: guitarPos(k) })).filter(d => d.pos);
  return (
    <svg width={GTR_W} height={GTR_H} style={{ display: 'block' }}>
      {GTR_STRINGS.map((nm, i) => (
        <text key={`n${i}`} x={sx(i)} y={GTR_TOP - 6} textAnchor="middle" fontSize={9}
          fontWeight="bold" fill={`${accent}cc`} fontFamily="monospace">{nm}</text>
      ))}
      {[3, 5, 7].filter(f => f <= GTR_FRETS).map(f => (
        <circle key={`in${f}`} cx={(sx(2) + sx(3)) / 2} cy={GTR_TOP + (f - 0.5) * GTR_FH} r={3.5} fill={`${accent}33`} />
      ))}
      {Array.from({ length: GTR_FRETS + 1 }).map((_, f) => (
        <line key={`f${f}`} x1={sx(0)} y1={fy(f)} x2={sx(GTR_STRINGS.length - 1)} y2={fy(f)}
          stroke={f === 0 ? '#dbe4f0' : `${accent}44`} strokeWidth={f === 0 ? 3.5 : 1} />
      ))}
      {GTR_STRINGS.map((_, i) => (
        <line key={`s${i}`} x1={sx(i)} y1={fy(0)} x2={sx(i)} y2={fy(GTR_FRETS)}
          stroke="#aab8cc" strokeWidth={GTR_GAUGE[i]} strokeLinecap="round" />
      ))}
      {litDots.map(({ k, pos }) => {
        const [s, f] = pos, cx = sx(s);
        return f === 0
          ? <circle key={k} cx={cx} cy={GTR_TOP - 9} r={5} fill="#2bd66b" stroke="#06111f" strokeWidth={1} />
          : <circle key={k} cx={cx} cy={GTR_TOP + (f - 0.5) * GTR_FH} r={7.5} fill="#2bd66b" stroke="#06111f" strokeWidth={1}
              style={{ filter: 'drop-shadow(0 0 5px #2bd66b)' }} />;
      })}
      {/* invisible tap strips — plucking a string presses the key of its nearest live gem */}
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
export function RiffHighway({ run, results, ghostHit, view, accent, onPressKey }) {
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
    const half = isGhost ? gh?.ghost : gh?.main;   // this half of an E-Rush pair already landed
    const id  = `${n.idx}${isGhost ? 'g' : ''}`;

    // Judged → burst at the strike line (grade-colored), then gone.
    if (r) {
      const col = GRADE_COLORS[r.grade] ?? accent;
      return (
        <div key={`b${id}-${r.grade}`} style={{
          position: 'absolute', left: x, top: HWY_H, width: GEM_R * 2, height: GEM_R * 2,
          marginLeft: -GEM_R, marginTop: -GEM_R, borderRadius: '50%',
          border: `3px solid ${col}`, background: r.hit ? `${col}44` : 'transparent',
          boxShadow: `0 0 18px ${col}`, pointerEvents: 'none',
          animation: 'riffgem-burst 0.45s ease-out forwards',
        }} />
      );
    }

    const ghost   = isGhost || !!n.ghostKey;
    const baseCol = isGhost ? '#b899ff' : n.glitched ? '#ff3355' : n.feel === 'rushed' ? '#ff9944' : accent;
    const sharp   = isSharp(key);
    return (
      <div key={`g${id}-${key}`} ref={gemRef(`g${id}-${key}`)}
        data-idx={n.idx} data-hitat={n.hitAt}
        style={{
          position: 'absolute', left: x, top: -SPAWN_PAD, width: GEM_R * 2, height: GEM_R * 2,
          marginLeft: -GEM_R, marginTop: -GEM_R, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Orbitron',sans-serif", fontSize: sharp ? 11 : 13, fontWeight: 900,
          color: '#06111f', background: half ? '#2bd66b' : baseCol,
          border: `2px solid ${sharp ? '#ffd700' : '#06111f'}`,
          boxShadow: `0 0 12px ${half ? '#2bd66b' : baseCol}`,
          opacity: 0,                      // hidden until the rAF loop places it
          pointerEvents: 'none', willChange: 'transform, opacity',
        }}>
        {noteGlyph(key)}
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
        @keyframes riffline-pulse {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 1; }
        }
      `}</style>

      {/* ── The highway — gems fall through here onto the strike line ── */}
      <div style={{
        position: 'relative', width: W, height: HWY_H, margin: '0 auto', overflow: 'hidden',
        background: 'linear-gradient(180deg, #050a14 0%, #0a1224 70%, #101c33 100%)',
        borderLeft: '1px solid #1a2a45', borderRight: '1px solid #1a2a45',
        borderRadius: '8px 8px 0 0',
      }}>
        {/* lane guides — one faint rail per distinct lane in this riff */}
        {[...new Set(run.notes.flatMap(n => [n.key, n.ghostKey].filter(Boolean)).map(k => laneX(view, k)))].map(x => (
          <div key={`lane${x}`} style={{
            position: 'absolute', left: x, top: 0, bottom: 0, width: 1,
            background: `linear-gradient(180deg, transparent, ${accent}33 60%, ${accent}66)`,
          }} />
        ))}
        {/* gems (real + E-Rush ghosts) */}
        {run.notes.map(n => gem(n, n.key, false))}
        {run.notes.map(n => (n.ghostKey ? gem(n, n.ghostKey, true) : null))}
        {/* the strike line */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 3,
          background: accent, boxShadow: `0 0 14px ${accent}, 0 0 30px ${accent}88`,
          animation: 'riffline-pulse 1.1s ease-in-out infinite',
        }} />
      </div>

      {/* ── The strike zone — hit the key as the gem lands on it ── */}
      <div style={{ width: W, margin: '0 auto', filter: `drop-shadow(0 0 10px ${accent}44)` }}>
        {view === 'guitar'
          ? <GuitarStrike litKeys={litKeys} accent={accent} onPress={onPressKey} resolveStringKey={resolveStringKey} />
          : <PianoStrike litKeys={litKeys} accent={accent} onPress={onPressKey} />}
      </div>
    </div>
  );
}
