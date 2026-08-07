// =============================================================================
// ui/CallAnswer.jsx — 🗣️ CALL & ANSWER — the derivation view
// -----------------------------------------------------------------------------
// The fourth riff-off view, alongside 🎹 piano, 🎸 falling-gem guitar and 🎯 neon
// neck. Those three all ask the same question — "can you find this note and hit
// it in time?" — which on a keyboard is a lookup table with a timer on it. This
// one asks the question a riff-off actually asks: THE RIVAL THREW A LICK, WHAT'S
// YOUR ANSWER?
//
// The call sits on screen as a contour. A rule card states what the answer does
// to it (mirror it / shift it / it comes back bent). Then the answer runs — and
// at every tier above ROOKIE the note letters are withheld, so the incoming card
// shows the CALL note it derives from and you apply the rule yourself.
//
// ⚠️ NOTHING NEW IS JUDGED HERE. `run` is the ordinary answer run and presses go
// out through the same `onPressKey` the keyboard, the neck taps and the mic all
// use. Derive wrong → you press the wrong letter → the existing judge grades it
// `wrong`. That is the entire integration: no engine action, no verdict math, no
// new results shape. What the occlusion policy decides lives in the pure module
// `riff/callAnswer.js`; what it LOOKS like lives here.
//
// ⚠️ Card motion is driven by ONE requestAnimationFrame loop writing transforms
// straight from the engine clock (run.startedAt), NOT by CSS animations — for
// the reason RiffHighway.jsx documents at length: React re-renders on every
// judgment and rewriting a running animation's delay does not restart it, so
// every card would lurch forward on each re-render.
// =============================================================================
import React, { useEffect, useRef } from "react";
import {
  answerSlots, revealForTier, ghostTrack, answerRule, ruleText, slotRevealed,
} from "../riff/callAnswer.js";

// ── Geometry (px) ────────────────────────────────────────────────────────────
const W          = 660;
const CALL_H     = 104;  // the contour strip
const TRACK_H    = 108;  // the conveyor the answer rides in on
const CARD_W     = 46;
const CARD_H     = 60;
const STRIKE_X   = 128;  // where a card is DUE — cards travel right → left
const SPAWN_X    = W + CARD_W;
const TAIL_X     = 46;   // how far past the line a card drifts before fading

// ── Neon palette (matches ui/RiffHighway.jsx and ui/NeonNeck.jsx) ───────────
const NEON_CYAN    = '#19e6ff';
const NEON_MAGENTA = '#ff2d95';
const NEON_VIOLET  = '#8a5cff';
const NEON_ORANGE  = '#ff8a2a';
const NEON_WHITE   = '#ffffee';
const DIM          = '#3a5a7a';

const GRADE_COLORS = { perfect: NEON_WHITE, good: NEON_CYAN, ok: NEON_VIOLET, miss: '#555566', wrong: '#555566' };

const NATURALS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
const SHARPS   = ['A', 'C', 'D', 'F', 'G'];
const isSharp  = k => !!k && k === k.toUpperCase() && k !== k.toLowerCase();
const glyph    = k => (isSharp(k) ? `${k}♯` : (k ?? '').toUpperCase());

// Card x-centre at run-time `now`. Enters at SPAWN_X a full leadTime before its
// hit-time, sits on STRIKE_X exactly AT its hit-time, drifts TAIL_X further.
function cardX(now, hitAt, leadTime) {
  const p = (now - (hitAt - leadTime)) / leadTime;
  return SPAWN_X + (STRIKE_X - SPAWN_X) * p;
}

// ── The call contour ─────────────────────────────────────────────────────────
// The material you derive FROM, drawn as a line so the SHAPE is legible at a
// glance — a riff-off answer is a reply to a gesture, not to a list of letters.
// When the tier allows it, the derived line (ghostTrack) is drawn over the top:
// seeing the mirror sit on the original is how the rule teaches itself.
function CallStrip({ call, ans, kind, reveal, showGhost }) {
  const deg = call?.degrees ?? [];
  if (!deg.length) return null;
  const keys  = answerSlots(call, ans, kind, reveal).map(s => s.callKey);
  const ghost = showGhost ? ghostTrack(call, kind, ans) : null;
  const all   = ghost ? deg.concat(ghost) : deg;
  const lo    = Math.min(...all), hi = Math.max(...all);
  const span  = Math.max(1, hi - lo);
  const pad   = 22;
  const X = i => 34 + (i * (W - 78)) / Math.max(1, deg.length - 1);
  const Y = d => CALL_H - pad - ((d - lo) / span) * (CALL_H - pad * 2);
  const root = deg[0];

  return (
    <svg width={W} height={CALL_H} style={{ display: 'block' }}>
      {/* the root line — what an inversion mirrors around */}
      <line x1={12} y1={Y(root)} x2={W - 12} y2={Y(root)}
        stroke={`${NEON_ORANGE}44`} strokeWidth={1} strokeDasharray="6 5" />
      <text x={12} y={Y(root) - 5} fontSize={8} fill={`${NEON_ORANGE}99`}
        fontFamily="monospace" letterSpacing={1}>ROOT</text>

      {ghost && (
        <>
          <polyline fill="none" stroke={NEON_MAGENTA} strokeWidth={1.6} strokeDasharray="4 4"
            opacity={0.7} points={ghost.map((d, i) => `${X(i)},${Y(d)}`).join(' ')} />
          {ghost.map((d, i) => (
            <circle key={`gh${i}`} cx={X(i)} cy={Y(d)} r={4}
              fill={`${NEON_MAGENTA}33`} stroke={NEON_MAGENTA} strokeWidth={1} />
          ))}
        </>
      )}

      <polyline fill="none" stroke={NEON_CYAN} strokeWidth={2}
        points={deg.map((d, i) => `${X(i)},${Y(d)}`).join(' ')} />
      {deg.map((d, i) => (
        <g key={`c${i}`}>
          <circle cx={X(i)} cy={Y(d)} r={9} fill="#06111f" stroke={NEON_CYAN} strokeWidth={1.5} />
          {reveal.callKey && (
            <text x={X(i)} y={Y(d) + 3.5} textAnchor="middle" fontSize={9} fill={NEON_WHITE}
              fontFamily="'Saira Stencil One',sans-serif">{glyph(keys[i])}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ── The view ─────────────────────────────────────────────────────────────────
// run:     battleState.riffRun for the ANSWER (same shape every other view gets)
// call/ans: the two riffs — {degrees, sharps}; ans is defRiff and carries `kind`
// tier:    difficulty id ('rookie' | 'gigging' | 'shredder' | 'virtuoso')
export function CallAnswer({ run, results, call, ans, kind, tier, accent, onPressKey }) {
  const runRef    = useRef(run);
  const judgedRef = useRef({});
  const cardsRef  = useRef(new Map());
  const slotsRef  = useRef([]);

  const judged = {};
  (results ?? []).forEach(r => { if (r.noteIdx != null) judged[r.noteIdx] = r; });
  runRef.current    = run;
  judgedRef.current = judged;

  const reveal = revealForTier(tier);
  const rule   = answerRule(kind);
  const slots  = answerSlots(call, ans, kind, reveal);
  slotsRef.current = slots;

  // ── The motion loop — one rAF per run. ──
  // Also owns the letter REVEAL: a slot's letter appears at a fraction of its
  // own lead time, so the reveal point rides the same clock as the motion and
  // stays correct under the tempo dial and every difficulty preset.
  useEffect(() => {
    if (!run?.notes?.length) return;
    let raf;
    const tick = () => {
      const r = runRef.current;
      if (r) {
        const now = performance.now() - r.startedAt;
        cardsRef.current.forEach((el) => {
          if (!el || !el.isConnected) return;
          const idx   = Number(el.dataset.idx);
          const hitAt = Number(el.dataset.hitat);
          if (judgedRef.current[idx]) { el.style.opacity = '0'; return; }
          const p = (now - (hitAt - r.leadTime)) / r.leadTime;
          if (p < 0) { el.style.opacity = '0'; return; }
          const x = cardX(now, hitAt, r.leadTime);
          const past = Math.max(0, STRIKE_X - x);
          el.style.opacity = past > 0 ? String(Math.max(0, 1 - past / TAIL_X)) : '1';
          el.style.transform = `translateX(${Math.max(x, STRIKE_X - TAIL_X) - SPAWN_X}px)`;
          const lettersEl = el.querySelector('[data-role="ans"]');
          if (lettersEl) {
            const slot = slotsRef.current[idx];
            const on   = slot ? slotRevealed(slot, Math.min(1, p)) : true;
            lettersEl.style.opacity = on ? '1' : '0';
            const src = el.querySelector('[data-role="src"]');
            if (src) src.style.opacity = on ? '0.25' : '1';
          }
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run?.startedAt, run?.notes?.length]);

  if (!run?.notes?.length) return null;

  const cardRef = (k) => (el) => {
    if (el) cardsRef.current.set(k, el);
    else cardsRef.current.delete(k);
  };

  // ── One answer note. ──
  // The glyph rule is the whole mechanic: the ANSWER letter is what you must
  // press, the CALL letter underneath is what you derive it from. At ROOKIE the
  // answer is simply printed; climb the ladder and it withdraws until only the
  // source note is left and the rule is the only bridge across.
  const card = (n) => {
    const slot = slots[n.idx] ?? {};
    const r    = judged[n.idx];

    if (r) {
      const col    = GRADE_COLORS[r.grade] ?? accent;
      const isMiss = r.grade === 'miss' || r.grade === 'wrong';
      return (
        <div key={`b${n.idx}-${r.grade}`} style={{
          position: 'absolute', left: STRIKE_X - CARD_W / 2, top: (TRACK_H - CARD_H) / 2,
          width: CARD_W, height: CARD_H, borderRadius: 6,
          border: `2px solid ${col}`, background: isMiss ? '#1a1a22' : `${col}22`,
          boxShadow: isMiss ? 'none' : `0 0 16px ${col}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Saira Stencil One',sans-serif", fontSize: 15, color: col,
          pointerEvents: 'none',
          animation: `${isMiss ? 'ca-miss' : 'ca-land'} 0.45s ease-out forwards`,
        }}>{glyph(slot.ansKey)}</div>
      );
    }

    const col = slot.derivable === false ? NEON_ORANGE
      : slot.anchor ? NEON_ORANGE
      : n.glitched ? NEON_MAGENTA
      : NEON_CYAN;

    return (
      <div key={`c${n.idx}`} ref={cardRef(`c${n.idx}`)}
        data-idx={n.idx} data-hitat={n.hitAt}
        style={{
          position: 'absolute', left: SPAWN_X - CARD_W / 2, top: (TRACK_H - CARD_H) / 2,
          width: CARD_W, height: CARD_H, borderRadius: 6,
          border: `2px solid ${col}`, background: `${col}18`,
          boxShadow: `0 0 10px ${col}55`,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 1,
          opacity: 0, pointerEvents: 'none', willChange: 'transform, opacity',
        }}>
        {/* the source note — what the rule is applied TO */}
        {reveal.callKey && (
          <div data-role="src" style={{
            fontSize: 9, color: DIM, fontFamily: "'Saira Stencil One',sans-serif",
            letterSpacing: 0.5, lineHeight: 1,
          }}>{glyph(slot.callKey)}</div>
        )}
        {/* the answer note — withheld until this slot's reveal point */}
        <div data-role="ans" style={{
          fontSize: 17, color: NEON_WHITE, fontFamily: "'Saira Stencil One',sans-serif",
          lineHeight: 1.1, opacity: 0,
        }}>{glyph(slot.ansKey)}</div>
        {(slot.anchor || slot.derivable === false) && (
          <div style={{ fontSize: 7, color: NEON_ORANGE, letterSpacing: 1, lineHeight: 1 }}>
            {slot.anchor ? 'KEY' : 'BENT'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'inline-block', textAlign: 'center' }}>
      <style>{`
        @keyframes ca-land { 0% { transform: scale(0.9); opacity: 1; }
                           100% { transform: scale(1.6); opacity: 0; } }
        @keyframes ca-miss { 0% { transform: scale(1); opacity: 0.7; }
                           100% { transform: scale(0.5) translateY(20px); opacity: 0; } }
        @keyframes ca-strike { 0%,100% { box-shadow: 0 0 12px ${NEON_ORANGE}; }
                                50%    { box-shadow: 0 0 22px ${NEON_MAGENTA}; } }
      `}</style>

      {/* ── The rule card ── */}
      <div style={{
        width: W, margin: '0 auto 6px', padding: '7px 12px', borderRadius: 8,
        background: '#06111f', border: `1px solid ${NEON_MAGENTA}44`,
        display: 'flex', alignItems: 'baseline', gap: 10, textAlign: 'left',
      }}>
        <span style={{ fontSize: 13, color: NEON_MAGENTA, letterSpacing: 1,
                       fontFamily: "'Saira Stencil One',sans-serif" }}>{rule.name}</span>
        <span style={{ fontSize: 10, color: '#6a8aaa', letterSpacing: 0.5 }}>
          {ruleText(call, ans, kind)}
        </span>
      </div>

      {/* ── The call ── */}
      <div style={{
        width: W, margin: '0 auto', background: '#030810',
        border: `1px solid ${NEON_CYAN}22`, borderRadius: '8px 8px 0 0',
      }}>
        <CallStrip call={call} ans={ans} kind={kind} reveal={reveal} showGhost={reveal.ghostTrack} />
      </div>

      {/* ── The answer conveyor ── */}
      <div style={{
        position: 'relative', width: W, height: TRACK_H, margin: '0 auto', overflow: 'hidden',
        background: '#030810', borderLeft: `1px solid ${NEON_CYAN}22`,
        borderRight: `1px solid ${NEON_CYAN}22`, borderTop: `1px solid ${NEON_CYAN}18`,
      }}>
        {/* the strike marker — cards are due the instant they cross it */}
        <div style={{
          position: 'absolute', left: STRIKE_X, top: 0, bottom: 0, width: 3, marginLeft: -1.5,
          background: `linear-gradient(180deg, ${NEON_ORANGE}, ${NEON_MAGENTA})`,
          animation: 'ca-strike 1.1s ease-in-out infinite',
        }} />
        {run.notes.map(card)}
      </div>

      {/* ── The keyboard — the mouse path, and a reminder of the alphabet ── */}
      <div style={{
        width: W, margin: '0 auto', padding: '8px 0 4px', background: '#030810',
        borderLeft: `1px solid ${NEON_CYAN}22`, borderRight: `1px solid ${NEON_CYAN}22`,
        borderRadius: '0 0 8px 8px', display: 'flex', gap: 5,
        justifyContent: 'center', flexWrap: 'wrap',
      }}>
        {NATURALS.map(k => (
          <button key={k} onPointerDown={e => { e.preventDefault(); onPressKey?.(k); }}
            style={keyBtn(NEON_CYAN)}>{k.toUpperCase()}</button>
        ))}
        {SHARPS.map(k => (
          <button key={k} onPointerDown={e => { e.preventDefault(); onPressKey?.(k); }}
            style={keyBtn(NEON_MAGENTA)}>{k}♯</button>
        ))}
      </div>
    </div>
  );
}

function keyBtn(col) {
  return {
    fontFamily: "'Saira Stencil One',sans-serif", fontSize: 12, lineHeight: 1,
    cursor: 'pointer', padding: '7px 10px', minWidth: 34, borderRadius: 5,
    background: `${col}14`, border: `1px solid ${col}55`, color: col,
  };
}
