// =============================================================================
// ui/CrowdBubble.jsx  —  🎤 THE FANS' SPEECH BUBBLE, AND THE STOCK'S COACH MARKS
// -----------------------------------------------------------------------------
// IDEAS_INBOX [P1] "Beginner chord finder", step 3: the port of
// `.scratch/fan-bubble-preview.html` at Alex's dial-in (`CROWD_BUBBLE` in
// `ui/crowdCoach.js`, 2026-09-16). Beginner mode only — the client gates it.
//
//   · `useCrowdCoach`   — asks the finder (in a Worker) for the acting Spirit's
//                         best plays whenever their hand changes.
//   · `CrowdBubbleCard` — the bubble itself, pure markup. SSR-renderable, and the
//                         thing `crowdBubbleCheck` compares with the preview.
//   · `CrowdBubble`     — timer + positioning glue: anchors the card to a fan in
//                         the acting Spirit's grandstand and runs the sequence.
//   · `crowdCss`        — the stock highlight (melody) and chord glow keyframes.
//
// ⚠️ SHELL ONLY. Nothing here decides a note: `crowdAsks` / `chordGlow` choose
// words and colours off the finder, and the finder scores with the game's own
// readers. A mistake in this file can misplace a bubble; it cannot change a play.
//
// ⚠️ THE ANCHOR IS A DOM ELEMENT, NOT A COORDINATE. The grandstand is SVG inside
// the board layer, and in the 3D arena that layer is CSS-3D-transformed — so the
// only honest "where is that fan on screen" is `getBoundingClientRect()` on the
// fan itself, read every frame the bubble is up (the camera orbits). Arithmetic
// on seat positions would be right in 2D and wrong the moment the camera moves.
// =============================================================================
// ⚠️ Hook, card, style helpers and stylesheet ship together on purpose — the
// parity check and the client read them from one module. Fast refresh only.
/* eslint-disable react-refresh/only-export-components */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import NoteHex from './NoteHex.jsx';
import { CROWD_BUBBLE, crowdBubbleFrame, prettyNote } from './crowdCoach.js';
import { askFinder } from './crowdFinderClient.js';

/** The element a bubble points at: the acting Spirit's front-row fan, else the
 *  whole stand (a stand with no fans still has its rail). */
export const CROWD_SPEAKER_SELECTOR = '[data-crowd-speaker]';
export const CROWD_STAND_SELECTOR = '[data-tip-anchor="fan-crowd"]';

const CLEAN_HUE = '#a58bff';     // the preview's chip hues, dialled with it
const DISCORD_HUE = '#5b6680';
const FIRST_HUE = '#ffffff';
const DB_HUE = '#ffd166';

/**
 * Best plays for the acting Spirit's hand, recomputed only when the hand does.
 * @param {null | { spiritId:string, ns:object, goals:string[], unavailable?:number[] }} request
 *   `null` switches the coach off (not beginner, a bot's turn, not a build step).
 * @returns {{ plays: object|null, thinking: boolean }}
 */
export function useCrowdCoach(request) {
  const [state, setState] = useState({ key: null, plays: null });
  // ⚠️ THE KEY IS THE HAND, NOT THE OBJECT. The client rebuilds the note sheet on
  // every render; keying on identity would re-run a one-second search per frame.
  const key = request ? JSON.stringify([
    request.spiritId, request.goals, request.unavailable ?? [],
    request.ns?.rootNote, request.ns?.paletteMode, request.ns?.noteStock, request.ns?.usedStockIdx,
    request.ns?.melodyLine, request.ns?.driveStack, request.ns?.sustainStack,
    request.ns?.stackCommitsThisTurn, request.ns?.hasConfirmed, request.ns?.tempDrive,
    request.ns?.tempSustain, request.ns?.mojoDrain, request.ns?.driveSlots, request.ns?.sustainSlots,
  ]) : null;
  const latest = useRef(null);
  useEffect(() => {
    latest.current = key;
    if (!key) return undefined;
    let cancelled = false;
    const deliver = (plays) => { if (!cancelled && latest.current === key) setState({ key, plays }); };
    const { spiritId, ns, goals, unavailable } = request;
    const ask = askFinder(spiritId, ns, goals, unavailable);
    ask.promise.then(deliver);
    return () => { cancelled = true; ask.cancel(); };
    // `request` is read through `key` on purpose (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!key) return { plays: null, thinking: false };
  return { plays: state.key === key ? state.plays : null, thinking: state.key !== key };
}

// ── 💬 THE CARD ───────────────────────────────────────────────────────────────
/** Inline style of the bubble box — one function so the card and the parity
 *  check read the same numbers. Mirrors the preview's `placeBubble`. */
export function crowdBubbleBoxStyle(color, B = CROWD_BUBBLE) {
  const glow = B.glow;
  return {
    position: 'fixed', zIndex: 900, pointerEvents: 'none',
    boxSizing: 'border-box',
    maxWidth: B.maxw, fontSize: B.font, fontWeight: 700, lineHeight: 1.45, letterSpacing: '.02em',
    padding: `${Math.round(B.font * 0.6)}px ${Math.round(B.font * 0.8)}px`,
    borderRadius: B.rad,
    background: 'rgba(7,11,24,.92)', color: '#eef4ff',
    border: `1.5px solid ${color}`,
    boxShadow: `0 0 ${18 * glow}px ${color}8c, inset 0 0 ${14 * glow}px ${color}38`,
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    transformOrigin: '50% 100%',
  };
}

/** The NoteHex size whose hexagon spans 94% of the dialled chip box (see the card). */
export const chipDrawSize = (B = CROWD_BUBBLE) => Math.round(B.chipSize * 0.94 * 120 / 68);

export function CrowdBubbleCard({ ask, color, inScale = () => true, B = CROWD_BUBBLE, style = null, tailX = null }) {
  if (!ask) return null;
  let pay = '';
  if (B.payoff === 'fans' && ask.payoff.fans) pay = `+${ask.payoff.fans} fan${ask.payoff.fans === 1 ? '' : 's'}`;
  if (B.payoff === 'both') pay = [ask.payoff.fans ? `+${ask.payoff.fans} fans` : '', ask.payoff.db ? `+${ask.payoff.db} Db` : ''].filter(Boolean).join(' · ');
  return (
    <div className="crowd-bubble" data-crowd-bubble={ask.key} role="status" aria-live="polite"
      style={{ ...crowdBubbleBoxStyle(color, B), ...(style ?? {}) }}>
      <div className="crowd-bubble-txt">{ask.text}</div>
      <div className="crowd-bubble-chips" style={{ display: 'flex', gap: 5, marginTop: 6, alignItems: 'center' }}
        aria-label={ask.notes.map(prettyNote).join(' ')}>
        {ask.notes.map((n, k) => (
          // 📏 `chipSize` is the LAYOUT box Alex dialled (22 px), and the preview's
          // hexagon filled 94% of it. A NoteHex's hexagon is only 68/120 of its own
          // box (the rest is room for the glow), so a NoteHex AT 22 px drew a 12 px
          // chip with an unreadable letter — found by rendering the port beside the
          // preview. The chip is drawn at the size whose HEXAGON matches, centred in
          // the dialled box, so the row's spacing and the chip's size both match.
          <span key={`${k}-${n}`} style={{ width: B.chipSize, height: B.chipSize, display: 'grid', placeItems: 'center', overflow: 'visible' }}>
            <span style={{ margin: -(chipDrawSize(B) - B.chipSize) / 2 }}>
              <NoteHex size={chipDrawSize(B)} letter={n}
                hue={k === 0 ? FIRST_HUE : inScale(n) ? CLEAN_HUE : DISCORD_HUE} />
            </span>
          </span>
        ))}
      </div>
      {pay && (
        <div className="crowd-bubble-pay" style={{
          display: 'inline-block', marginTop: 6, font: "600 10px/1 'IBM Plex Mono', monospace", letterSpacing: '.06em',
          padding: '3px 6px', borderRadius: 3, background: `${color}33`, color, border: `1px solid ${color}99`,
        }}>{pay}</div>
      )}
      {B.tail === 'point' && (
        <div className="crowd-bubble-tail" style={{
          position: 'absolute', width: 0, height: 0, bottom: -13, left: (tailX ?? 20) - 9,
          borderLeft: '9px solid transparent', borderRight: '9px solid transparent', borderTop: `13px solid ${color}`,
        }} />
      )}
    </div>
  );
}

// ── ⏱️📍 THE SEQUENCE AND THE ANCHOR ─────────────────────────────────────────
const reducedMotion = () => typeof window !== 'undefined'
  && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

function anchorRect() {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(CROWD_SPEAKER_SELECTOR) ?? document.querySelector(CROWD_STAND_SELECTOR);
  const r = el?.getBoundingClientRect?.();
  return r && (r.width || r.height) ? { el, x: r.left + r.width / 2, y: r.top } : null;
}

/**
 * @param {object[]} asks      `crowdAsks(...)` for the acting Spirit, or []
 * @param {string}   color     the acting Spirit's colour (Alex: border = Spirit)
 * @param {boolean}  thinking  the finder is still working on this hand
 * @param {Function} inScale   note → in the Spirit's palette?
 * @param {Function} onShow    (ask|null) → the bubble on screen, for the stock mark
 */
export function CrowdBubble({ asks = [], color = '#8fd8ff', thinking = false, inScale, onShow, B = CROWD_BUBBLE }) {
  const [frame, setFrame] = useState({ phase: 'done', index: -1 });
  const [pos, setPos] = useState(null);
  const boxRef = useRef(null);
  const shownRef = useRef({ index: -2, phase: null });
  const asksKey = JSON.stringify(asks.map(a => [a.key, a.idx]));

  useEffect(() => {
    // A new, empty ask list resets the clock at once; waiting a frame would flash
    // the previous hand's bubble over the new one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!asks.length) { setFrame({ phase: 'done', index: -1 }); onShow?.(null); return undefined; }
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const f = crowdBubbleFrame(performance.now() - start, asks.length, B);
      setFrame(prev => (prev.phase === f.phase && prev.index === f.index ? prev : f));
      const a = anchorRect();
      setPos(prev => (a && (!prev || Math.abs(prev.x - a.x) > 0.5 || Math.abs(prev.y - a.y) > 0.5) ? { x: a.x, y: a.y, el: a.el } : prev));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asksKey]);

  const visible = frame.phase === 'pop' || frame.phase === 'hold' || frame.phase === 'fade';
  const ask = visible ? asks[frame.index] : null;

  // Report the bubble on screen (drives the stock's "next note" pulse).
  // ⚠️ Keyed on WHICH ask is up, not the object — `asks` is rebuilt every render.
  const shownKey = `${ask?.key ?? ''}|${ask?.idx?.[0] ?? ''}|${frame.index}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onShow?.(ask ?? null); }, [shownKey]);

  // Pop, fade and the fan's hop — WAAPI with the preview's own keyframes, so the
  // motion Alex dialled is the motion that ships.
  useLayoutEffect(() => {
    const el = boxRef.current;
    const last = shownRef.current;
    if (!el || !visible) { shownRef.current = { index: frame.index, phase: frame.phase }; return; }
    const reduced = reducedMotion();
    // ⚠️ `fill: 'forwards'` animations outlive their duration — cancel the old one
    // before starting the next, or every bubble stacks another held animation.
    const restart = () => el.getAnimations?.().forEach(a => a.cancel());
    if (frame.phase === 'pop' && (last.index !== frame.index || last.phase !== 'pop')) {
      restart();
      if (!reduced && B.popMs > 0) {
        el.animate?.([{ transform: `scale(${B.popFrom})`, opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }],
          { duration: B.popMs, easing: 'cubic-bezier(.2,.8,.3,1.2)', fill: 'forwards' });
      } else el.style.opacity = '1';
      const speaker = pos?.el;
      if (B.fanHop && !reduced && speaker?.setAttribute) {
        speaker.removeAttribute('data-crowd-hop');
        void speaker.getBoundingClientRect();
        speaker.setAttribute('data-crowd-hop', '1');
        setTimeout(() => speaker.removeAttribute?.('data-crowd-hop'), 520);
      }
    }
    if (frame.phase === 'hold') el.style.opacity = '1';
    if (frame.phase === 'fade' && last.phase !== 'fade') {
      restart();
      if (!reduced && B.fade > 0) el.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: B.fade, fill: 'forwards' });
      else el.style.opacity = '0';
    }
    shownRef.current = { index: frame.index, phase: frame.phase };
  });

  // Place above the speaker, clamped to the viewport (the stand can sit near an edge).
  const [box, setBox] = useState({ w: 0, h: 0 });
  // Measures every render by design (the card's text changes size); the equality
  // guard below is what stops it looping.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    if (w !== box.w || h !== box.h) setBox({ w, h });
  });

  if (typeof window === 'undefined') return null;
  const vw = window.innerWidth || 1280, vh = window.innerHeight || 720;
  const showDots = B.thinking && thinking && !asks.length && pos;
  let placed = null;
  if (ask && pos) {
    let x = pos.x - box.w / 2 + B.offX, y = pos.y - box.h - 18 + B.offY;
    x = Math.max(8, Math.min(vw - 8 - box.w, x));
    y = Math.max(8, Math.min(vh - 8 - box.h, y));
    placed = { left: x, top: y, opacity: 0, tailX: Math.max(12, Math.min(box.w - 12, pos.x - x)) };
  }
  return (
    <>
      {ask && pos && (
        <div ref={boxRef} style={{ position: 'fixed', left: placed.left, top: placed.top, zIndex: 900, pointerEvents: 'none', opacity: placed.opacity, transformOrigin: `${placed.tailX}px 100%` }}>
          <CrowdBubbleCard ask={ask} color={color} inScale={inScale} B={B} tailX={placed.tailX}
            style={{ position: 'relative', left: 0, top: 0 }} />
        </div>
      )}
      {showDots && (
        <div className="crowd-dots" aria-hidden="true" style={{ position: 'fixed', left: pos.x - 14, top: pos.y - 22, zIndex: 899 }}>
          <i /><i /><i />
        </div>
      )}
    </>
  );
}

// ── 🎨 THE STYLESHEET ────────────────────────────────────────────────────────
// `data-coach` on a stock chip's wrapper: `fans` / `db` (melody step, the note the
// bubble names next) or `drive` / `sustain` (chord step glow). ⚠️ The ring is a
// ::before on the wrapper and the halo a drop-shadow on the chip's own SVG — never
// a filter on the wrapper, which would blur the chip's whole silhouette (the
// NoteHex header explains why that froze the glow once already).
export function crowdCss(color, B = CROWD_BUBBLE) {
  return `
  :root{--crowd-spirit:${color}}
  [data-coach]{position:relative}
  [data-coach]::before{content:"";position:absolute;inset:-6px;border-radius:50%;pointer-events:none;
    animation:crowd-coach-pulse var(--coach-ms) ease-in-out infinite}
  [data-coach] svg{filter:drop-shadow(0 0 calc(6px*var(--coach-k)) var(--coach-hue))}
  [data-coach="fans"]{--coach-hue:var(--crowd-spirit);--coach-ms:${B.hlPulseMs}ms;--coach-k:1}
  [data-coach="db"]{--coach-hue:${DB_HUE};--coach-ms:${B.hlPulseMs}ms;--coach-k:1}
  [data-coach="drive"]{--coach-hue:#ff6644;--coach-ms:${B.glowMs}ms;--coach-k:${B.glowInt}}
  [data-coach="sustain"]{--coach-hue:#44aaff;--coach-ms:${B.glowMs}ms;--coach-k:${B.glowInt}}
  @keyframes crowd-coach-pulse{
    0%,100%{box-shadow:0 0 calc(8px*var(--coach-k)) calc(1px*var(--coach-k)) color-mix(in srgb,var(--coach-hue) 35%,transparent)}
    50%{box-shadow:0 0 calc(26px*var(--coach-k)) calc(6px*var(--coach-k)) color-mix(in srgb,var(--coach-hue) 85%,transparent)}}
  /* ⚠️ !important because every fan already carries an INLINE bob/headbang
     animation, and inline beats a stylesheet. The component removes the attribute
     after the hop, so the fan goes back to bobbing. */
  [data-crowd-hop="1"]{animation:crowd-fan-hop .5s ease-out !important}
  @keyframes crowd-fan-hop{0%{transform:translateY(0)}35%{transform:translateY(-7px)}100%{transform:translateY(0)}}
  .crowd-dots{display:flex;gap:4px;pointer-events:none}
  .crowd-dots i{width:6px;height:6px;border-radius:50%;background:#cfe0ff;opacity:.2;animation:crowd-dot 1s infinite}
  .crowd-dots i:nth-child(2){animation-delay:.2s}.crowd-dots i:nth-child(3){animation-delay:.4s}
  @keyframes crowd-dot{50%{opacity:.95}}
  @media (prefers-reduced-motion: reduce){
    [data-coach]::before,[data-crowd-hop="1"],.crowd-dots i{animation:none}
    [data-coach]::before{box-shadow:0 0 calc(14px*var(--coach-k)) calc(3px*var(--coach-k)) color-mix(in srgb,var(--coach-hue) 60%,transparent)}
  }`;
}
