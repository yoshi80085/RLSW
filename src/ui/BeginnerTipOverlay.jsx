import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";

// ─── 🎓 BEGINNER TIP OVERLAY ─────────────────────────────────────────────────
// The upgraded tips popup: multi-page walkthroughs that can point a neon-pink
// arrow (drawn out tip-first, then left pulsing) at the actual HUD element
// they're talking about.
//
// Contract:
//   <BeginnerTipOverlay tip={activeTip} onClose={fn} onDisable={fn}/>
//   tip = { id, title, pages: [{ body, anchor? }, ...] }
//     body   — string, or array of strings (rendered as paragraphs)
//     anchor — optional name matching a data-tip-anchor="<name>" attribute on
//              a HUD element. When found on screen, the page spotlights it
//              (dim-cutout ring) and draws an arrow from the card to it.
//              Missing/off-screen anchors degrade gracefully to a centered card.
//
// Pure presentation. No engine imports, no game state — it reads the DOM for
// anchor rects and nothing else.

const CARD_W = 400;

// First VISIBLE element wearing the anchor tag (some anchors exist twice —
// e.g. End Turn renders in two layouts; only one has real size at a time).
// `rootEl` = this overlay's own root, made hit-transparent for the probe.
function findAnchorRect(name, rootEl) {
  if (!name || typeof document === 'undefined') return null;
  const els = document.querySelectorAll(`[data-tip-anchor="${name}"]`);
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (!(r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 &&
        r.top < window.innerHeight && r.left < window.innerWidth)) continue;
    // 🫣 OCCLUSION PROBE — is the element actually on top at its centre, or is
    // a modal (Theory Tree, battle overlay…) sitting over it? Pointing an
    // arrow at something the player can't see reads as a bug, so covered
    // anchors degrade to the centered card. Our own overlay is popped out of
    // hit-testing for the probe (it's synchronous — no visible flicker).
    const prevPE = rootEl ? rootEl.style.pointerEvents : null;
    if (rootEl) rootEl.style.pointerEvents = 'none';
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (rootEl) rootEl.style.pointerEvents = prevPE;
    if (hit && (el.contains(hit) || hit.contains(el))) return r;
  }
  return null;
}

export function BeginnerTipOverlay({ tip, onClose, onDisable }) {
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState(null);   // DOMRect of the spotlit element
  const [arrow, setArrow] = useState(null);     // { x1,y1,x2,y2,cx,cy,len,tipAngle }
  const cardRef = useRef(null);
  const rootRef = useRef(null);

  const pages = tip.pages;
  const cur = pages[Math.min(page, pages.length - 1)];
  const lastPage = page >= pages.length - 1;

  // New tip → back to page 1.
  useEffect(() => { setPage(0); }, [tip.id]);

  const next = useCallback(() => {
    if (lastPage) onClose();
    else setPage(p => p + 1);
  }, [lastPage, onClose]);

  // ⌨️ Esc bails, →/space advances, ← backs up.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') setPage(p => Math.max(0, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, onClose]);

  // 📐 Measure the anchor now, again after HUD panels finish animating, and on
  // resize. Panels slide/collapse (.step-active etc.), so one measure lies.
  useLayoutEffect(() => {
    const measure = () => setTarget(findAnchorRect(cur.anchor, rootRef.current));
    measure();
    const t1 = setTimeout(measure, 350);
    const t2 = setTimeout(measure, 800);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', measure); };
  }, [tip.id, page, cur.anchor]);

  // Card placement: opposite half of the screen from the target, vertically
  // near it, clamped on-screen. No target → centered via flex.
  let cardStyle;
  if (target) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const tcx = target.left + target.width / 2;
    const left = tcx < vw / 2
      ? Math.min(vw - CARD_W - 16, Math.max(16, tcx + target.width / 2 + 80))
      : Math.max(16, Math.min(vw - CARD_W - 16, tcx - target.width / 2 - 80 - CARD_W));
    const top = Math.max(16, Math.min(vh - 280, target.top + target.height / 2 - 130));
    cardStyle = { position: 'fixed', left, top, margin: 0 };
  } else {
    cardStyle = { position: 'relative' };
  }

  // 🏹 Arrow geometry — from the card's nearest edge to the target's nearest
  // edge, bowed perpendicular for a hand-drawn arc. Measured post-render.
  useLayoutEffect(() => {
    if (!target || !cardRef.current) { setArrow(null); return; }
    const c = cardRef.current.getBoundingClientRect();
    const tx = target.left + target.width / 2;
    const ty = target.top + target.height / 2;
    // start on the card edge facing the target
    const x1 = tx < c.left ? c.left - 6 : tx > c.right ? c.right + 6 : (c.left + c.right) / 2;
    const y1 = x1 === c.left - 6 || x1 === c.right + 6
      ? Math.max(c.top + 20, Math.min(c.bottom - 20, ty))
      : (ty < c.top ? c.top - 6 : c.bottom + 6);
    // end just outside the target ring
    const dx = tx - x1, dy = ty - y1;
    const len = Math.hypot(dx, dy) || 1;
    const pad = Math.min(len * 0.25, Math.max(target.width, target.height) / 2 + 14);
    const x2 = tx - (dx / len) * pad;
    const y2 = ty - (dy / len) * pad;
    // control point: midpoint pushed perpendicular for the bow
    const bow = Math.min(70, len * 0.25);
    const cx = (x1 + x2) / 2 - (dy / len) * bow;
    const cy = (y1 + y2) / 2 + (dx / len) * bow;
    // Curve length (numeric — 20 segments is plenty for a draw animation)
    // + the tangent angle at the tip so the arrowhead sits flush on the curve.
    let curveLen = 0, px = x1, py = y1;
    for (let t = 1; t <= 20; t++) {
      const u = t / 20;
      const qx = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * cx + u * u * x2;
      const qy = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * cy + u * u * y2;
      curveLen += Math.hypot(qx - px, qy - py); px = qx; py = qy;
    }
    const tipAngle = Math.atan2(y2 - cy, x2 - cx) * 180 / Math.PI;
    setArrow({ x1, y1, x2, y2, cx, cy, len: curveLen, tipAngle });
  }, [target, page, tip.id]);

  const bodyParas = Array.isArray(cur.body) ? cur.body : [cur.body];

  return (
    <div ref={rootRef} style={{ position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      // With a spotlight target the ring's giant box-shadow does the dimming;
      // otherwise dim the whole stage here.
      background: target ? 'transparent' : '#000000aa',
      backdropFilter: target ? 'none' : 'blur(3px)' }}
      onClick={next}>
      <style>{`
        @keyframes tip-ring-pulse {
          0%, 100% { box-shadow: 0 0 0 9999px #030509b8, 0 0 14px #ff66cc88, inset 0 0 10px #ff66cc22; }
          50%      { box-shadow: 0 0 0 9999px #030509b8, 0 0 28px #ff66ccdd, inset 0 0 16px #ff66cc44; }
        }
        /* draw the curve tip-first — dashoffset counts down from the REAL
           measured curve length (--len), so the line extends as it's drawn */
        @keyframes tip-arrow-draw  { from { stroke-dashoffset: var(--len); } to { stroke-dashoffset: 0; } }
        @keyframes tip-arrow-pulse { 0%, 100% { filter: drop-shadow(0 0 3px #ff66cc88); }
                                     50%      { filter: drop-shadow(0 0 11px #ff66cc); } }
        @keyframes tip-head-in     { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tip-card-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>

      {/* 🔦 Spotlight ring — the huge box-shadow IS the dimmer, so the target
          shows through undarkened */}
      {target && (
        <div style={{ position: 'fixed',
          left: target.left - 6, top: target.top - 6,
          width: target.width + 12, height: target.height + 12,
          border: '2px solid #ff66cc', borderRadius: 10,
          animation: 'tip-ring-pulse 1.6s ease-in-out infinite',
          pointerEvents: 'none' }}/>
      )}

      {/* 🏹 the arrow — neon pink, drawn out tip-first, then left pulsing */}
      {target && arrow && (
        <svg key={`${tip.id}-${page}`}
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none' }}>
          <path d={`M ${arrow.x1} ${arrow.y1} Q ${arrow.cx} ${arrow.cy} ${arrow.x2} ${arrow.y2}`}
            fill="none" stroke="#ff66cc" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={arrow.len} strokeDashoffset={arrow.len}
            style={{ ['--len']: arrow.len,
              animation: 'tip-arrow-draw 550ms ease-out forwards, tip-arrow-pulse 1.4s ease-in-out 550ms infinite' }}/>
          {/* arrowhead pops as the line arrives, aligned to the curve's tangent
              (attribute transform positions it; the CSS animation only fades,
              so the two never fight over `transform`) */}
          <g transform={`translate(${arrow.x2} ${arrow.y2}) rotate(${arrow.tipAngle})`}>
            <path d="M -2 -7 L 12 0 L -2 7 Z" fill="#ff66cc"
              style={{ animation: 'tip-head-in 200ms ease-out 480ms both, tip-arrow-pulse 1.4s ease-in-out 550ms infinite' }}/>
          </g>
        </svg>
      )}

      {/* 🗂️ the card */}
      <div ref={cardRef} onClick={e => e.stopPropagation()}
        style={{ ...cardStyle, width: CARD_W, maxWidth: '90vw',
          background: 'linear-gradient(180deg,#0e1828,#080f1e)',
          border: '1.5px solid #f6ad55', borderRadius: 12, padding: '22px 22px 16px',
          boxShadow: '0 0 40px #f6ad5533, 0 8px 32px #000000cc',
          fontFamily: "'Share Tech Mono',monospace",
          animation: 'tip-card-in 300ms ease-out' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 13, color: '#f6ad55',
            letterSpacing: 1, textShadow: '0 0 10px #f6ad5555' }}>{tip.title}</div>
          {pages.length > 1 && (
            <div style={{ fontSize: 8, color: '#5a7a9a', letterSpacing: 1, flexShrink: 0, marginLeft: 10 }}>
              {page + 1}/{pages.length}
            </div>
          )}
        </div>
        {bodyParas.map((p, i) => (
          <div key={i} style={{ fontSize: 11, color: '#c0d0e0', lineHeight: 1.7,
            marginBottom: i === bodyParas.length - 1 ? 16 : 10 }}>{p}</div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onDisable}
            style={{ fontFamily: 'inherit', fontSize: 8, color: '#5a7a9a', background: 'none',
              border: 'none', cursor: 'pointer', letterSpacing: 1, padding: '4px 0' }}>
            Turn off tips
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* page dots */}
            {pages.length > 1 && (
              <div style={{ display: 'flex', gap: 4 }}>
                {pages.map((_, i) => (
                  <div key={i} onClick={() => setPage(i)} style={{ width: 5, height: 5, borderRadius: '50%',
                    cursor: 'pointer',
                    background: i === page ? '#f6ad55' : '#1e3a5f',
                    boxShadow: i === page ? '0 0 5px #f6ad55' : 'none' }}/>
                ))}
              </div>
            )}
            {page > 0 && (
              <button onClick={() => setPage(p => p - 1)}
                style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 10, cursor: 'pointer',
                  background: 'none', border: '1px solid #1e3a5f', borderRadius: 5,
                  color: '#5a7a9a', padding: '7px 12px', letterSpacing: 1 }}>
                ◂
              </button>
            )}
            <button onClick={next}
              style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 11, cursor: 'pointer',
                background: '#1a3020', border: '1.5px solid #44cc66', borderRadius: 5,
                color: '#44ff88', padding: '8px 20px', letterSpacing: 2,
                boxShadow: '0 0 12px #44cc6644' }}>
              {lastPage ? 'GOT IT' : 'NEXT ▸'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
