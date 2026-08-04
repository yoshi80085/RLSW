import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { Pickles } from "./Pickles.jsx";
import { placeTipCard, CARD_PAD } from "./tipLayout.js";

// ─── 🎓 BEGINNER TIP OVERLAY ─────────────────────────────────────────────────
// Multi-page walkthroughs delivered by PICKLES — a guitar pick with eyes who
// flies around the HUD, points a neon-pink arrow at the thing he's talking
// about, and types his advice out at roughly the speed a person reads.
//
// Contract:
//   <BeginnerTipOverlay tip={activeTip} onClose={fn} onDisable={fn}/>
//   tip = { id, title, pages: [{ body, anchor? }, ...] }
//     body   — string, or array of strings (rendered as paragraphs)
//     anchor — optional name matching a data-tip-anchor="<name>" attribute on
//              a HUD element. When found on screen, the page spotlights it
//              (dim-cutout ring), Pickles flies to it and points.
//              Missing/off-screen anchors degrade gracefully to a centered card.
//     foe    — true puts a GRAY PICK on screen for Pickles to hit (act:'lunge')
//              or be hit by (act:'recoil'). "Hitting" and "getting hit" are the
//              only two ideas here that need a second body to be readable.
//     crowd  — true and a crowd of fans runs in and gathers around him.
//
// Pure presentation. No engine imports, no game state — it reads the DOM for
// anchor rects and nothing else.

const CARD_W = 400;

// ⌨️ TYPING SPEED — tuned to READING speed, not to drama.
// Adult prose reading runs ~230–250 wpm. Punctuation buys a small breath the
// way a reader's eye actually pauses, which drags the effective rate down, so
// the raw character rate is set ABOVE the target to compensate: these numbers
// measure out at ~225–265 wpm across the real tip pages. Slower feels like
// being read to by a tired robot; faster and the typing is pure decoration.
// If you retune, measure the effective wpm of a LONG page, not a short one.
const READ_CPS = 26;
const MS_PER_CHAR = 1000 / READ_CPS;
const PAUSE_COMMA = 90;    // , ; : —
const PAUSE_STOP  = 170;   // . ! ? …
const PAUSE_PARA  = 300;   // paragraph break

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

// Precompute the moment (ms from start) each character appears, so punctuation
// pauses are baked in and one rAF loop can drive the whole page.
function buildSchedule(text) {
  const times = new Array(text.length);
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    t += MS_PER_CHAR;
    times[i] = t;
    const c = text[i];
    if (c === '\n') t += PAUSE_PARA;
    else if (c === '.' || c === '!' || c === '?' || c === '…') t += PAUSE_STOP;
    else if (c === ',' || c === ';' || c === ':' || c === '—') t += PAUSE_COMMA;
  }
  return times;
}

// First VISIBLE element wearing the anchor tag (some anchors exist twice —
// e.g. End Turn renders in two layouts; only one has real size at a time).
// `rootEl` = this overlay's own root, `cardEl` = the tip card. BOTH are made
// hit-transparent for the probe — see the bug note below.
function findAnchorRect(name, rootEl, cardEl) {
  if (!name || typeof document === 'undefined') return null;
  const els = document.querySelectorAll(`[data-tip-anchor="${name}"]`);
  // 🫣 OCCLUSION PROBE — is the element actually on top at its centre, or is
  // a modal (Theory Tree, battle overlay…) sitting over it? Pointing an
  // arrow at something the player can't see reads as a bug, so covered
  // anchors degrade to the centered card.
  //
  // 🐛 THE BLURRED-OUT-DRIVE-STACK BUG: the probe used to pop only the overlay
  // ROOT out of hit-testing. But the card re-declares `pointerEvents:'auto'` on
  // ITSELF, so it stayed hittable — and the card is exactly the thing sitting
  // over the anchor, because it was centred while we had no target yet. So
  // `elementFromPoint` returned the card, the probe failed, the anchor was
  // declared "covered", and the whole stage stayed dimmed + blurred behind a
  // centred card — which then kept covering the anchor. A self-sustaining loop.
  // The overlay is never a legitimate occluder of its own anchor, so it comes
  // out of hit-testing wholesale. (Synchronous — no visible flicker.)
  const prevRootPE = rootEl ? rootEl.style.pointerEvents : null;
  const prevCardPE = cardEl ? cardEl.style.pointerEvents : null;
  if (rootEl) rootEl.style.pointerEvents = 'none';
  if (cardEl) cardEl.style.pointerEvents = 'none';
  let found = null;
  try {
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (!(r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 &&
          r.top < window.innerHeight && r.left < window.innerWidth)) continue;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      // Belt and braces: if anything of ours still answers the probe, ignore it
      // rather than reading it as an occluder.
      if (hit && rootEl && rootEl.contains(hit)) { found = r; break; }
      if (hit && (el.contains(hit) || hit.contains(el))) { found = r; break; }
    }
  } finally {
    if (rootEl) rootEl.style.pointerEvents = prevRootPE;
    if (cardEl) cardEl.style.pointerEvents = prevCardPE;
  }
  return found;
}

export function BeginnerTipOverlay({ tip, onClose, onDisable, gates = {} }) {
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState(null);   // DOMRect of the spotlit element
  const [cardH, setCardH] = useState(0);        // measured card height, for clamping
  const [nudgeKey, setNudgeKey] = useState(''); // gated page that's earned an escape hatch
  // One measured bundle: the arrow curve, and where Pickles hovers / looks.
  // Kept together so the layout pass writes state exactly once.
  const [geom, setGeom] = useState({ arrow: null, pick: null });
  const { arrow, pick } = geom;
  // Typewriter progress, stamped with the page it belongs to. Keying it this
  // way means a page change resets the reveal DURING render — no effect has to
  // zero it, so there's never a frame showing the old page's finished text.
  const [reveal, setReveal] = useState({ key: '', n: 0 });
  const cardRef = useRef(null);
  const rootRef = useRef(null);

  const pages = tip.pages;
  const cur = pages[Math.min(page, pages.length - 1)];
  const lastPage = page >= pages.length - 1;

  const bodyParas = useMemo(
    () => (Array.isArray(cur.body) ? cur.body : [cur.body]),
    [cur.body],
  );
  // One flat string drives the typewriter; paragraphs are sliced back out of it
  // at render time so the layout never reflows mid-type.
  const fullText = useMemo(() => bodyParas.join('\n'), [bodyParas]);
  const schedule = useMemo(() => buildSchedule(fullText), [fullText]);
  const pageKey = `${tip.id}:${page}`;
  const revealed = reveal.key === pageKey ? reveal.n : 0;
  const typing = revealed < fullText.length;

  // 🚧 GATED PAGE — this page asks the player to actually DO something ("hit
  // ⚔️ DRIVE"). While the gate is shut the overlay stops swallowing clicks so
  // they can reach the real button, and NEXT is replaced by a waiting prompt.
  // Nobody gets stranded: an escape hatch fades in a few seconds later.
  const gated = !!cur.gate && !gates[cur.gate];
  const nudge = nudgeKey === `${tip.id}:${page}`;
  // Character index each paragraph starts at inside `fullText`, so the render
  // can slice the revealed portion without mutating a counter mid-map.
  const paraStarts = useMemo(() => {
    const out = []; let at = 0;
    for (const p of bodyParas) { out.push(at); at += p.length + 1; }  // +1 = joining '\n'
    return out;
  }, [bodyParas]);

  // New tip → back to page 1.
  useEffect(() => { setPage(0); }, [tip.id]);

  // `skipRef` stops the rAF loop from overwriting a page the player chose to
  // reveal in full.
  const skipRef = useRef(false);

  // ⌨️ THE TYPEWRITER — one rAF loop per page, walking the precomputed
  // schedule. Reduced-motion users get the whole page on the first frame.
  useEffect(() => {
    skipRef.current = false;
    const instant = prefersReducedMotion();
    let raf = 0, start = 0, n = 0;
    const step = (ts) => {
      if (skipRef.current) return;
      if (!start) start = ts;
      if (instant) { setReveal({ key: pageKey, n: schedule.length }); return; }
      const elapsed = ts - start;
      // schedule is monotonic, so resuming the scan from the last count is cheap
      while (n < schedule.length && schedule[n] <= elapsed) n++;
      setReveal({ key: pageKey, n });
      if (n < schedule.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [schedule, pageKey]);

  const finishTyping = useCallback(() => {
    skipRef.current = true;
    setReveal({ key: pageKey, n: fullText.length });
  }, [pageKey, fullText.length]);

  // Click / Next: first press finishes the line, second press turns the page.
  // (`typing` is a boolean, so this identity only churns when it flips — not
  // once per revealed character.)
  const advance = useCallback(() => {
    if (typing) { finishTyping(); return; }
    if (gated) return;              // the page is waiting on the player
    if (lastPage) onClose();
    else setPage(p => p + 1);
  }, [typing, gated, finishTyping, lastPage, onClose]);

  // Turn the page the moment the gate opens — the reward for doing the thing is
  // that Pickles immediately carries on, not that you have to click again.
  const gateKey = cur.gate ? `${pageKey}:${gates[cur.gate] ? 1 : 0}` : null;
  useEffect(() => {
    if (!cur.gate || gated) return;
    const t = setTimeout(() => setPage(p => (p < pages.length - 1 ? p + 1 : p)), 260);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateKey]);

  // Escape hatch, on a delay so it doesn't undercut the instruction instantly.
  // Stamped with the page it belongs to, so moving on resets it during render
  // rather than needing an effect to clear it.
  useEffect(() => {
    if (!gated) return;
    const t = setTimeout(() => setNudgeKey(pageKey), 6000);
    return () => clearTimeout(t);
  }, [gated, pageKey]);

  // ⌨️ Esc bails, →/space advances, ← backs up.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); advance(); }
      else if (e.key === 'ArrowLeft') setPage(p => Math.max(0, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, onClose]);

  // 📐 Measure the anchor now, again after HUD panels finish animating, and on
  // resize. Panels slide/collapse (.step-active etc.), so one measure lies.
  useLayoutEffect(() => {
    const measure = () => setTarget(findAnchorRect(cur.anchor, rootRef.current, cardRef.current));
    measure();
    const t1 = setTimeout(measure, 350);
    const t2 = setTimeout(measure, 800);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', measure); };
  }, [tip.id, page, cur.anchor]);

  // Card placement: opposite half of the screen from the target, vertically
  // near it, clamped on-screen. No target → centered via flex.
  //
  // 🐛 THE OFFSCREEN-BUTTON BUG: this used to clamp against a hardcoded 280px
  // card height. Long pages are much taller than that, so the bottom of the
  // card — the row with NEXT on it — slid under the fold and the tip became
  // unclickable. It now clamps against the MEASURED height (`cardH`), and the
  // card itself is a flex column with a scrollable body and a pinned footer, so
  // the buttons survive even a page taller than the whole viewport.
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const maxCardH = vh - CARD_PAD * 2;
  const placed = placeTipCard({
    target, cardW: CARD_W, cardH: cardH || 280, vw, vh,
  });
  const cardStyle = placed.centered
    ? { position: 'relative' }
    : { position: 'fixed', left: placed.left, top: placed.top, margin: 0 };

  // 🏹 Arrow + 🎸 Pickles geometry — the arrow leaves from Pickles (so he reads
  // as the one pointing) and bows into the target's nearest edge. Measured
  // post-render, because the card's height depends on the copy.
  useLayoutEffect(() => {
    if (!cardRef.current) { setGeom({ arrow: null, pick: null }); return; }
    const c = cardRef.current.getBoundingClientRect();

    if (!target) {
      // No anchor on screen: he perches on the card's top-left corner and
      // looks down at his own text.
      setGeom({ arrow: null, pick: {
        x: c.left - 6, y: c.top - 10, flip: false,
        lookX: c.left + c.width / 2, lookY: c.top + 60,
      } });
      return;
    }

    const tx = target.left + target.width / 2;
    const ty = target.top + target.height / 2;
    // start on the card edge facing the target
    const x1 = tx < c.left ? c.left - 6 : tx > c.right ? c.right + 6 : (c.left + c.right) / 2;
    const y1 = x1 === c.left - 6 || x1 === c.right + 6
      ? Math.max(c.top + 20, Math.min(c.bottom - 20, ty))
      : (ty < c.top ? c.top - 6 : c.bottom + 6);
    const dx = tx - x1, dy = ty - y1;
    const len0 = Math.hypot(dx, dy) || 1;
    const ux = dx / len0, uy = dy / len0;

    // 🎸 Pickles hovers on that same edge, a little out along the line of fire,
    // and the arrow starts just past him.
    const pxp = x1 + ux * 34;
    const pyp = y1 + uy * 34 - 26;          // ride slightly above the line
    const nextPick = { x: pxp, y: pyp, flip: ux < 0, lookX: tx, lookY: ty };

    const ax1 = x1 + ux * 62;
    const ay1 = y1 + uy * 62;
    // end just outside the target ring
    const rdx = tx - ax1, rdy = ty - ay1;
    const len = Math.hypot(rdx, rdy) || 1;
    const pad = Math.min(len * 0.25, Math.max(target.width, target.height) / 2 + 14);
    const x2 = tx - (rdx / len) * pad;
    const y2 = ty - (rdy / len) * pad;
    // control point: midpoint pushed perpendicular for the bow
    const bow = Math.min(70, len * 0.25);
    const cx = (ax1 + x2) / 2 - (rdy / len) * bow;
    const cy = (ay1 + y2) / 2 + (rdx / len) * bow;
    // Curve length (numeric — 20 segments is plenty for a draw animation)
    // + the tangent angle at the tip so the arrowhead sits flush on the curve.
    let curveLen = 0, ppx = ax1, ppy = ay1;
    for (let t = 1; t <= 20; t++) {
      const u = t / 20;
      const qx = (1 - u) * (1 - u) * ax1 + 2 * (1 - u) * u * cx + u * u * x2;
      const qy = (1 - u) * (1 - u) * ay1 + 2 * (1 - u) * u * cy + u * u * y2;
      curveLen += Math.hypot(qx - ppx, qy - ppy); ppx = qx; ppy = qy;
    }
    const tipAngle = Math.atan2(y2 - cy, x2 - cx) * 180 / Math.PI;
    setGeom({
      arrow: { x1: ax1, y1: ay1, x2, y2, cx, cy, len: curveLen, tipAngle },
      pick: nextPick,
    });
  }, [target, page, tip.id, fullText, cardH]);

  // Measure the card so placement can clamp against its real height. Runs after
  // the copy is in the DOM; `fullText` in the deps catches page changes.
  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const measure = () => {
      const hgt = cardRef.current?.getBoundingClientRect().height ?? 0;
      setCardH(prev => (Math.abs(prev - hgt) > 1 ? hgt : prev));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [fullText, tip.id, page]);

  return (
    <div ref={rootRef} style={{ position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      // With a spotlight target the ring's giant box-shadow does the dimming;
      // otherwise dim the whole stage here.
      background: target ? 'transparent' : '#000000aa',
      backdropFilter: target ? 'none' : 'blur(3px)',
      // 🚧 While a gate is open the overlay must NOT eat clicks — the player is
      // being asked to press a real HUD button underneath us. The card re-enables
      // pointer events on itself so its own controls still work.
      pointerEvents: gated ? 'none' : 'auto' }}
      onClick={gated ? undefined : advance}>
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
        @keyframes tip-caret { 0%, 45% { opacity: 1; } 55%, 100% { opacity: 0; } }
        @keyframes tip-wait-pulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
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

      {/* 🎸 PICKLES — flies to each new anchor, aims his point at it, and acts
          out whatever the page is describing */}
      {pick && (
        <Pickles x={pick.x} y={pick.y} talking={typing} size={76}
          lookAt={{ x: pick.lookX, y: pick.lookY }}
          // He physically aims at the spotlit element. No target on screen →
          // no pointing, or he'd be jabbing at nothing.
          point={target ? { x: pick.lookX, y: pick.lookY } : null}
          emote={cur.emote ?? null} act={cur.act ?? null} tag={cur.tag ?? null}
          mood={cur.mood ?? 'happy'} foe={!!cur.foe} crowd={!!cur.crowd}/>
      )}

      {/* 🗂️ the card — flex column so the footer can never be pushed off the
          bottom: the copy scrolls, the buttons stay put. */}
      <div ref={cardRef} onClick={e => { e.stopPropagation(); advance(); }}
        style={{ ...cardStyle, width: CARD_W, maxWidth: '90vw',
          maxHeight: maxCardH, display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(180deg,#0e1828,#080f1e)',
          border: '1.5px solid #f6ad55', borderRadius: 12, padding: '22px 22px 16px',
          boxShadow: '0 0 40px #f6ad5533, 0 8px 32px #000000cc',
          fontFamily: "'Share Tech Mono',monospace", cursor: gated ? 'default' : 'pointer',
          pointerEvents: 'auto',
          animation: 'tip-card-in 300ms ease-out' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 4, flexShrink: 0 }}>
          <div style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 13, color: '#f6ad55',
            letterSpacing: 1, textShadow: '0 0 10px #f6ad5555' }}>{tip.title}</div>
          {pages.length > 1 && (
            <div style={{ fontSize: 8, color: '#5a7a9a', letterSpacing: 1, flexShrink: 0, marginLeft: 10 }}>
              {page + 1}/{pages.length}
            </div>
          )}
        </div>
        <div style={{ fontSize: 8, color: '#ff88cc', letterSpacing: 2, marginBottom: 12,
          opacity: 0.85, flexShrink: 0 }}>
          PICKLES SEZ ▸
        </div>
        {/* Unrevealed text is rendered at zero opacity rather than omitted, so
            the card never resizes mid-type (Pickles and the arrow are pinned to
            its edges — a growing card would drag them around). */}
        <div style={{ overflowY: 'auto', minHeight: 0, flexShrink: 1 }}>
          {bodyParas.map((p, i) => {
            const start = paraStarts[i];
            const shown = Math.max(0, Math.min(p.length, revealed - start));
            const isCaretPara = revealed > start && revealed <= start + p.length;
            return (
              <div key={i} style={{ fontSize: 11, color: '#c0d0e0', lineHeight: 1.7,
                marginBottom: i === bodyParas.length - 1 ? 16 : 10 }}>
                <span>{p.slice(0, shown)}</span>
                {isCaretPara && typing && (
                  <span style={{ color: '#ff88cc', animation: 'tip-caret 900ms steps(1) infinite' }}>▍</span>
                )}
                <span aria-hidden style={{ opacity: 0 }}>{p.slice(shown)}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onDisable(); }}
            style={{ fontFamily: 'inherit', fontSize: 8, color: '#5a7a9a', background: 'none',
              border: 'none', cursor: 'pointer', letterSpacing: 1, padding: '4px 0' }}>
            Turn off tips
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* page dots */}
            {pages.length > 1 && (
              <div style={{ display: 'flex', gap: 4 }}>
                {pages.map((_, i) => (
                  <div key={i} onClick={e => { e.stopPropagation(); setPage(i); }}
                    style={{ width: 5, height: 5, borderRadius: '50%', cursor: 'pointer',
                    background: i === page ? '#f6ad55' : '#1e3a5f',
                    boxShadow: i === page ? '0 0 5px #f6ad55' : 'none' }}/>
                ))}
              </div>
            )}
            {page > 0 && (
              <button onClick={e => { e.stopPropagation(); setPage(p => p - 1); }}
                style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 10, cursor: 'pointer',
                  background: 'none', border: '1px solid #1e3a5f', borderRadius: 5,
                  color: '#5a7a9a', padding: '7px 12px', letterSpacing: 1 }}>
                ◂
              </button>
            )}
            {/* 🚧 Gated: no NEXT to press — the button they want is out there on
                the HUD. Show what we're waiting for, and after a few seconds
                offer a way past so a stuck player is never trapped. */}
            {gated && !typing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {nudge && (
                  <button onClick={e => { e.stopPropagation(); setPage(p => p + 1); }}
                    style={{ fontFamily: 'inherit', fontSize: 8, color: '#5a7a9a', background: 'none',
                      border: 'none', cursor: 'pointer', letterSpacing: 1,
                      animation: 'tip-card-in 400ms ease-out' }}>
                    skip this bit
                  </button>
                )}
                <div style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 10,
                  color: '#ffcc66', letterSpacing: 1, padding: '8px 14px',
                  border: '1.5px dashed #ffcc6688', borderRadius: 5,
                  animation: 'tip-wait-pulse 1.5s ease-in-out infinite' }}>
                  {cur.gateHint ?? 'YOUR MOVE ▸'}
                </div>
              </div>
            ) : (
              <button onClick={e => { e.stopPropagation(); advance(); }}
                style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 11, cursor: 'pointer',
                  background: typing ? '#101c2c' : '#1a3020',
                  border: `1.5px solid ${typing ? '#3a5a7a' : '#44cc66'}`, borderRadius: 5,
                  color: typing ? '#7a9aba' : '#44ff88', padding: '8px 20px', letterSpacing: 2,
                  boxShadow: typing ? 'none' : '0 0 12px #44cc6644', transition: 'all 160ms' }}>
                {typing ? '▸▸ SKIP' : lastPage ? 'GOT IT' : 'NEXT ▸'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
