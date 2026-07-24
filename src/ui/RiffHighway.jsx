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
// GUITAR VIEW (N2 — Rocksmith pass): gems fall in 6 fixed string lanes; the
// strike-zone neck renders all 13 frets (0–12) with a scrolling ~7-fret
// viewport anchored to the active phrase window. Taps target individual fret
// CELLS (string × fret), closing the Earned gap with piano. Camera slides
// only at phrase boundaries (CSS transition on the neck <g>, not rAF).
//
// Presentational: run data + results arrive via props; presses route back
// through onPressKey (same judge as the physical keyboard — taps on the
// strike-zone instrument make riff-offs playable on touch screens).
// Timing/difficulty numbers live in riff/fallingNotes.js.
// =============================================================================
import React, { useEffect, useRef } from "react";
import { cellKey, nearestPositionForKey, MAX_FRET, WINDOW } from "../riff/guitarMap.js";

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

// Guitar: 6 strings (lanes), frets 0–12, scrolling ~7-fret viewport.
// Voiced positions from guitarMap.js replace the old GPOS lookup.
const GTR_COL  = 42;   // string spacing
const GTR_SIDE = 25;   // side padding
const GTR_FH   = 20;   // fret height in the strike zone
const GTR_LABEL_H = 16;                       // fixed string-name row above the neck
const GTR_OPEN_H  = 16;                       // space above nut for open-string markers
const GTR_VIEWPORT_FRETS = 7;                 // how many fret spaces visible at once
const GTR_STRINGS = ['E', 'A', 'D', 'G', 'B', 'e'];
const GTR_GAUGE   = [3.2, 2.6, 2.0, 1.6, 1.2, 0.8];
const GTR_W = (GTR_STRINGS.length - 1) * GTR_COL + GTR_SIDE * 2;
const GTR_VIEWPORT_H = GTR_OPEN_H + GTR_VIEWPORT_FRETS * GTR_FH + 12;
const GTR_FULL_H     = GTR_OPEN_H + MAX_FRET * GTR_FH + 12;

// ── Neon palette (outrun / synthwave) ────────────────────────────────────────
const NEON_CYAN    = '#19e6ff';
const NEON_MAGENTA = '#ff2d95';
const NEON_VIOLET  = '#8a5cff';
const NEON_ORANGE  = '#ff8a2a';
const NEON_WHITE   = '#ffffee';

const GRADE_COLORS = { perfect: NEON_WHITE, good: NEON_CYAN, ok: NEON_VIOLET, miss: '#555566', wrong: '#555566' };

const isSharp = k => !!k && k === k.toUpperCase() && k !== k.toLowerCase();
const noteGlyph = k => (isSharp(k) ? `${k}♯` : (k ?? '').toUpperCase());

// Neon string colors — cyan at the low E, blending through to magenta at the high e.
const NEON_STRING_COLORS = [NEON_CYAN, '#33ccff', '#6699ff', NEON_VIOLET, '#cc44dd', NEON_MAGENTA];

// Lane x-center for a falling gem, per instrument view.
// Guitar: pos-based (string index from voicing); Piano: key-based.
function laneX(view, key, pos) {
  if (view === 'guitar') {
    return GTR_SIDE + (pos ? pos[0] : 0) * GTR_COL;
  }
  if (isSharp(key)) {
    const wi = BLACK_FOR_SHARP[key.toUpperCase()] ?? 0;
    return (wi + 1) * WKEY_W;                    // black key center
  }
  const wi = WHITES.indexOf(key.toLowerCase());
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

// ── Guitar strike zone — full-neck Rocksmith-style scrolling view ───────────
// litNotes: [{pos, key}] — note positions that should light up (from judged hits)
// activeAnchor: {start, end, fret} — the current phrase's hand-position window
// onPress: fires cellKey(string, fret) — same judge contract as keyboard
function GuitarStrike({ litNotes, activeAnchor, accent, onPress }) {
  const sx = i => GTR_SIDE + i * GTR_COL;
  const fy = f => GTR_OPEN_H + f * GTR_FH;    // fret wire f's y position

  // Camera: scroll to show the active anchor window in the viewport.
  // The viewport shows GTR_VIEWPORT_FRETS fret spaces; slide the inner SVG
  // via CSS transition (≤300ms) so the camera never jumps mid-phrase.
  const anchorFret = activeAnchor?.fret ?? 0;
  const maxScroll  = MAX_FRET - GTR_VIEWPORT_FRETS;
  const scrollFret = Math.max(0, Math.min(maxScroll, anchorFret - 1));
  const cameraY    = -scrollFret * GTR_FH;

  // Anchor window highlight: frets A through A+WINDOW
  const winTop = activeAnchor
    ? Math.max(0, fy(activeAnchor.fret) - GTR_FH) : 0;
  const winBot = activeAnchor
    ? fy(activeAnchor.fret + WINDOW) : 0;

  // Fret inlay positions
  const singleInlays = [3, 5, 7, 9].filter(f => f <= MAX_FRET);
  const doubleInlays = [12].filter(f => f <= MAX_FRET);

  return (
    <div style={{ display: 'block' }}>
      {/* Fixed string-name labels — never scroll */}
      <svg width={GTR_W} height={GTR_LABEL_H} style={{ display: 'block' }}>
        {GTR_STRINGS.map((nm, i) => (
          <text key={`n${i}`} x={sx(i)} y={GTR_LABEL_H - 2} textAnchor="middle" fontSize={9}
            fontWeight="bold" fill={NEON_STRING_COLORS[i]} fontFamily="monospace">{nm}</text>
        ))}
      </svg>
      {/* Scrolling neck viewport — clips to ~7 visible frets */}
      <div style={{ width: GTR_W, height: GTR_VIEWPORT_H, overflow: 'hidden' }}>
        <svg width={GTR_W} height={GTR_FULL_H} style={{
          display: 'block',
          transform: `translateY(${cameraY}px)`,
          transition: 'transform 300ms ease-out',
        }}>
          <defs>
            <filter id="neonGtrBloom" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur1"/>
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur2"/>
              <feMerge><feMergeNode in="blur2"/><feMergeNode in="blur1"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          {/* Anchor window highlight — dim cyan band */}
          {activeAnchor && (
            <rect x={sx(0) - GTR_SIDE * 0.6} y={winTop}
              width={GTR_W - GTR_SIDE * 0.8} height={winBot - winTop}
              fill={`${NEON_CYAN}08`} stroke={`${NEON_CYAN}15`} strokeWidth={0.5} rx={3} />
          )}
          {/* Fret inlay dots — glowing violet */}
          {singleInlays.map(f => (
            <circle key={`in${f}`} cx={(sx(2) + sx(3)) / 2} cy={fy(f) - GTR_FH * 0.5}
              r={3.5} fill={`${NEON_VIOLET}55`} stroke={`${NEON_VIOLET}44`} strokeWidth={1}
              filter="url(#neonGtrBloom)" />
          ))}
          {/* Double dots at fret 12 */}
          {doubleInlays.map(f => (
            <React.Fragment key={`din${f}`}>
              <circle cx={(sx(1) + sx(2)) / 2} cy={fy(f) - GTR_FH * 0.5}
                r={3} fill={`${NEON_VIOLET}55`} stroke={`${NEON_VIOLET}44`} strokeWidth={1}
                filter="url(#neonGtrBloom)" />
              <circle cx={(sx(3) + sx(4)) / 2} cy={fy(f) - GTR_FH * 0.5}
                r={3} fill={`${NEON_VIOLET}55`} stroke={`${NEON_VIOLET}44`} strokeWidth={1}
                filter="url(#neonGtrBloom)" />
            </React.Fragment>
          ))}
          {/* Fret wires — nut = thick cyan, others dim */}
          {Array.from({ length: MAX_FRET + 1 }).map((_, f) => (
            <line key={`f${f}`} x1={sx(0)} y1={fy(f)} x2={sx(GTR_STRINGS.length - 1)} y2={fy(f)}
              stroke={f === 0 ? NEON_CYAN : `${NEON_CYAN}22`}
              strokeWidth={f === 0 ? 2.5 : 0.8}
              filter={f === 0 ? 'url(#neonGtrBloom)' : undefined} />
          ))}
          {/* Fret numbers — right margin, dim */}
          {Array.from({ length: MAX_FRET }).map((_, i) => (
            <text key={`fn${i + 1}`} x={sx(5) + GTR_SIDE - 4} y={fy(i + 1) - GTR_FH * 0.5 + 3.5}
              textAnchor="end" fontSize={8} fill={`${NEON_CYAN}44`} fontFamily="monospace"
              style={{ pointerEvents: 'none' }}>{i + 1}</text>
          ))}
          {/* Strings — glowing neon lines, cyan → magenta */}
          {GTR_STRINGS.map((_, i) => (
            <line key={`s${i}`} x1={sx(i)} y1={fy(0)} x2={sx(i)} y2={fy(MAX_FRET)}
              stroke={NEON_STRING_COLORS[i]} strokeWidth={GTR_GAUGE[i] * 0.8}
              strokeLinecap="round" filter="url(#neonGtrBloom)" />
          ))}
          {/* Lit note blips — white-hot glow from judged hits (pos-keyed) */}
          {(litNotes ?? []).map(({ pos, key }, li) => {
            if (!pos) return null;
            const [s, f] = pos, cx = sx(s);
            return f === 0
              ? <circle key={`lit${li}`} cx={cx} cy={GTR_OPEN_H / 2} r={5}
                  fill={NEON_WHITE} stroke={NEON_CYAN} strokeWidth={1.5}
                  filter="url(#neonGtrBloom)" />
              : <circle key={`lit${li}`} cx={cx} cy={fy(f) - GTR_FH * 0.5} r={7.5}
                  fill={NEON_WHITE} stroke={NEON_STRING_COLORS[s]} strokeWidth={1.5}
                  filter="url(#neonGtrBloom)" />;
          })}
          {/* Fret cell tap targets — individual cells for pitch-accurate input */}
          {GTR_STRINGS.map((_, si) => (
            <React.Fragment key={`taps${si}`}>
              {/* Open string tap (above nut) */}
              <rect x={sx(si) - GTR_COL / 2} y={0} width={GTR_COL} height={GTR_OPEN_H}
                fill="transparent" style={{ cursor: 'pointer' }}
                onPointerDown={e => { e.preventDefault(); onPress?.(cellKey(si, 0)); }} />
              {/* Fretted cells 1–MAX_FRET */}
              {Array.from({ length: MAX_FRET }).map((_, fi) => (
                <rect key={fi + 1} x={sx(si) - GTR_COL / 2} y={fy(fi)} width={GTR_COL} height={GTR_FH}
                  fill="transparent" style={{ cursor: 'pointer' }}
                  onPointerDown={e => { e.preventDefault(); onPress?.(cellKey(si, fi + 1)); }} />
              ))}
            </React.Fragment>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── The highway ──────────────────────────────────────────────────────────────
// run:      battleState.riffRun ({ startedAt, leadTime, anchors,
//            notes:[{idx,key,hitAt,feel,ghostKey,okWin,glitched,pos}] })
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

  const isGuitar = view === 'guitar';

  // ── The motion loop — one rAF per run, transforms written directly. ──
  // ⚠️ rAF composes with data-rot for diamond gem rotation (see gem()).
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
            el.style.transform = `translateY(0)${el.dataset.rot || ''}`;
            return;
          }
          const past = Math.max(0, y - HWY_H); // px beyond the strike line
          el.style.opacity = past > 0 ? String(Math.max(0, 1 - past / TAIL)) : '1';
          // untransformed gem center sits at y = -SPAWN_PAD → shift down to `y`
          el.style.transform = `translateY(${Math.min(y, HWY_H + TAIL) + SPAWN_PAD}px)${el.dataset.rot || ''}`;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run?.startedAt, run?.notes?.length]); // new run (new turn / round) → fresh loop

  if (!run?.notes?.length) return null;
  const W = isGuitar ? GTR_W : PIANO_W;

  // ── Lit indicators ──
  // Guitar: pos-keyed (each cell is unique) — avoids the bug where two
  //   same-letter gems on different cells would light the wrong one.
  // Piano: letter-keyed (unchanged).
  const litKeys  = {};   // piano
  const litNotes = [];   // guitar: [{pos, key}]
  (results ?? []).forEach(r => { if (r.hit && r.noteIdx != null) {
    const n = run.notes.find(x => x.idx === r.noteIdx);
    if (!n) return;
    if (isGuitar) {
      if (n.pos) litNotes.push({ pos: n.pos, key: n.key });
      if (n.ghostKey) {
        const gp = nearestPositionForKey(n.ghostKey, n.pos ?? [2, 2]);
        if (gp) litNotes.push({ pos: gp, key: n.ghostKey });
      }
    } else {
      litKeys[n.key] = true;
      if (n.ghostKey) litKeys[n.ghostKey] = true;
    }
  } });

  // ── Active anchor for guitar camera ──
  // Advances when all notes in the current phrase are judged (the camera-
  // invariant: slides only at phrase boundaries, never mid-phrase).
  let activeAnchor = null;
  if (isGuitar && run.anchors?.length) {
    const firstUnjudged = run.notes.find(n => !judged[n.idx]);
    activeAnchor = firstUnjudged
      ? (run.anchors.find(a => firstUnjudged.idx >= a.start && firstUnjudged.idx <= a.end) ?? run.anchors[0])
      : run.anchors[run.anchors.length - 1];
  }

  // Register a gem's DOM node with the motion loop (classic callback ref —
  // React calls with null on unmount, which drops the entry).
  const gemRef = (elKey) => (el) => {
    if (el) gemElsRef.current.set(elKey, el);
    else gemElsRef.current.delete(elKey);
  };

  // ── A single falling gem (or its post-judgment burst). ──
  const gem = (n, key, isGhost) => {
    // Guitar: resolve position for this gem (ghost gems use nearestPositionForKey)
    const gemPos = isGuitar
      ? (isGhost ? (nearestPositionForKey(key, n.pos ?? [2, 2]) ?? [0, 0]) : (n.pos ?? [0, 0]))
      : null;
    const x   = laneX(view, key, gemPos);
    const r   = judged[n.idx];
    const gh  = ghostHit && ghostHit.idx === n.idx ? ghostHit : null;
    const half = isGhost ? gh?.ghost : gh?.main;
    const id  = `${n.idx}${isGhost ? 'g' : ''}`;

    // Guitar-specific shape state
    const stringIdx = gemPos?.[0] ?? 0;
    const fret      = gemPos?.[1] ?? 0;
    const isOpen    = isGuitar && fret === 0;
    const sharp     = isSharp(key);

    // Judged → burst at the strike line.
    if (r) {
      const col = GRADE_COLORS[r.grade] ?? accent;
      const burstDiamond = !isOpen && sharp && !showLabels;
      const isMiss = r.grade === 'miss' || r.grade === 'wrong';
      return (
        <div key={`b${id}-${r.grade}`} style={{
          position: 'absolute', left: x, top: HWY_H,
          width: isOpen ? GEM_R * 2.4 : GEM_R * 2,
          height: isOpen ? GEM_R * 1.2 : GEM_R * 2,
          marginLeft: isOpen ? -GEM_R * 1.2 : -GEM_R,
          marginTop: isOpen ? -GEM_R * 0.6 : -GEM_R,
          borderRadius: isOpen ? '3px' : burstDiamond ? '3px' : '50%',
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

    // ── Gem color ──
    // Guitar: STRING-COLORED (Rocksmith convention), with ghost/glitch overrides.
    // Piano:  feel-based (unchanged).
    let baseCol;
    if (isGuitar) {
      baseCol = isGhost ? NEON_VIOLET : n.glitched ? NEON_MAGENTA : NEON_STRING_COLORS[stringIdx];
    } else {
      baseCol = isGhost ? NEON_VIOLET : n.glitched ? NEON_MAGENTA : n.feel === 'rushed' ? NEON_ORANGE : NEON_CYAN;
    }

    // Diamond shape for sharps (non-open) when labels are off (Shredder+).
    const diamond = !isOpen && sharp && !showLabels;

    // ── Gem glyph ──
    // Guitar: labels-on = letter + fret (e.g. "A♯4"); labels-off = fret only.
    // Piano:  labels-on = note letter; labels-off = nothing.
    let glyph = null;
    if (isGuitar) {
      glyph = showLabels ? `${noteGlyph(key)}${fret}` : String(fret);
    } else {
      glyph = showLabels ? noteGlyph(key) : null;
    }

    return (
      <div key={`g${id}-${key}`} ref={gemRef(`g${id}-${key}`)}
        className="riff-gem-tail"
        data-idx={n.idx} data-hitat={n.hitAt}
        data-rot={diamond ? ' rotate(45deg)' : ''}
        style={{
          '--gem-color': half ? NEON_WHITE : baseCol,
          position: 'absolute', left: x, top: -SPAWN_PAD,
          width: isOpen ? GEM_R * 2.4 : GEM_R * 2,
          height: isOpen ? GEM_R * 1.2 : GEM_R * 2,
          marginLeft: isOpen ? -GEM_R * 1.2 : -GEM_R,
          marginTop: isOpen ? -GEM_R * 0.6 : -GEM_R,
          borderRadius: isOpen ? '3px' : diamond ? '3px' : '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Saira Stencil One',sans-serif",
          fontSize: isGuitar ? (showLabels ? 9 : 11) : (sharp ? 11 : 13),
          fontWeight: 900,
          color: half ? '#06111f' : NEON_WHITE,
          background: half ? NEON_WHITE : `${baseCol}22`,
          border: `2px solid ${half ? NEON_WHITE : baseCol}`,
          boxShadow: `0 0 10px ${half ? NEON_WHITE : baseCol}, 0 0 4px ${half ? NEON_WHITE : baseCol}88`,
          opacity: 0,
          pointerEvents: 'none', willChange: 'transform, opacity',
        }}>
        {diamond && glyph
          ? <span style={{ display: 'inline-block', transform: 'rotate(-45deg)' }}>{glyph}</span>
          : glyph}
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
        {/* lane guides — guitar: all 6 strings always, string-colored;
                          piano: only lanes with active notes */}
        {isGuitar
          ? GTR_STRINGS.map((_, i) => (
              <div key={`lane${i}`} style={{
                position: 'absolute', left: GTR_SIDE + i * GTR_COL, top: 0, bottom: 0, width: 1,
                background: `linear-gradient(180deg, transparent, ${NEON_STRING_COLORS[i]}18 40%, ${NEON_STRING_COLORS[i]}33)`,
              }} />
            ))
          : [...new Set(run.notes.flatMap(n => [n.key, n.ghostKey].filter(Boolean)).map(k => laneX(view, k)))].map(x => (
              <div key={`lane${x}`} style={{
                position: 'absolute', left: x, top: 0, bottom: 0, width: 1,
                background: `linear-gradient(180deg, transparent, ${NEON_CYAN}18 40%, ${NEON_MAGENTA}33)`,
              }} />
            ))
        }
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
        {isGuitar
          ? <GuitarStrike litNotes={litNotes} activeAnchor={activeAnchor} accent={accent} onPress={onPressKey} />
          : <PianoStrike litKeys={litKeys} accent={accent} onPress={onPressKey} />}
      </div>
    </div>
  );
}
