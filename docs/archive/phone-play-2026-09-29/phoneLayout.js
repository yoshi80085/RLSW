import { useEffect, useState } from 'react';

// ─── 📱 THE PHONE LAYOUT — a match held sideways, one player per phone ────────
// Alex, 2026-09-29: *"any way you can make the game playable on a mobile
// device?"* → phone held SIDEWAYS, ONLINE (each player on their own phone), a
// preview first (`.scratch/mobile-hud-preview.html`, the "Phone Match Dial-in"
// artifact), then *"everything seems fine to me, lets plug these in"* — so every
// number below is that page's default, and none of them was moved.
//
// 🎯 THE RULE THE PREVIEW SETTLED: the arena gets the whole screen; who you are
// (Spirit card, Drive/Sustain dials) sits in a slim rail on the OFF-hand side,
// and everything you TAP sits in a column under the MAIN thumb.
//
// ⚠️ IT RE-DOCKS THE PANELS THE GAME ALREADY HAS; IT DOES NOT REDRAW THEM. The
// chord drawer, the melody stock, the action rail and the roll prompt are the
// same components with the same handlers — only where they sit and how big a
// tap target is changes. A second, phone-only copy of any of them would be the
// exact drift SEQUENCING §B1/§B9 keeps paying for.
// 📌 What the preview drew that this does NOT yet do, on purpose (it needs the
// components to change shape, not just move): the melody hand split into two
// thumb fans, the round action cluster, and the wheel's held-notes-only buttons.
// The step-1 wheel in the preview was the stock grid's job in the real game.
//
// 📌 WHEN IT APPLIES: a touch screen with no hover (a phone or tablet finger,
// not a laptop trackpad) whose SHORT side is ≤ 540 px — i.e. a phone. Held
// upright during a match it asks to be turned (`rlsw-phone-portrait`).
// `?phone` in the URL forces it on a desktop browser for testing.

export const PHONE_HUD = Object.freeze({
  hand: 'right',  // the main thumb: taps live on this side, the info rail on the other
  tap: 44,        // smallest tap target, px — Apple's floor
  rail: 150,      // the info rail's width (Spirit card + Sound)
  col: 230,       // the tap column's width — the preview's scale wheel (230), which
                  //   is also what fits the step-1 drawer built for a 238 px column
  topBar: 34,     // the top bar's height
  dial: 44,       // Drive / Sustain dial size in the rail
  alpha: 0.78,    // panel opacity over the arena
});

const PHONE_QUERY = '(hover: none) and (pointer: coarse)';
const SHORT_SIDE = 540;

function readPhone() {
  if (typeof window === 'undefined') return null;
  const forced = /[?&]phone(=1|&|$)/.test(window.location?.search ?? '');
  const touch = forced || !!window.matchMedia?.(PHONE_QUERY)?.matches;
  const w = window.innerWidth, h = window.innerHeight;
  if (!touch || Math.min(w, h) > SHORT_SIDE) return null;
  return w >= h ? 'landscape' : 'portrait';
}

/** Tags <html> with `rlsw-phone` (landscape) or `rlsw-phone-portrait` while mounted. */
export function usePhoneLayout() {
  const [mode, setMode] = useState(readPhone);
  useEffect(() => {
    const update = () => setMode(readPhone());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    const mq = window.matchMedia?.(PHONE_QUERY);
    mq?.addEventListener?.('change', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      mq?.removeEventListener?.('change', update);
    };
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('rlsw-phone', mode === 'landscape');
    root.classList.toggle('rlsw-phone-portrait', mode === 'portrait');
    root.dataset.phoneHand = PHONE_HUD.hand;
    return () => { root.classList.remove('rlsw-phone', 'rlsw-phone-portrait'); delete root.dataset.phoneHand; };
  }, [mode]);
  return mode;
}

const P = PHONE_HUD;
const SAFE_L = 'env(safe-area-inset-left, 0px)', SAFE_R = 'env(safe-area-inset-right, 0px)', SAFE_B = 'env(safe-area-inset-bottom, 0px)';
// ⚠️ EVERY SELECTOR STARTS AT `html.rlsw-phone`, which is what lets it outrank the
// (max-width:1000px) / (max-width:600px) rules in SURFACE_CSS without !important:
// those were written for a narrow DESKTOP window and stack the board above the
// HUD as a long scrolling page — at 844 × 390 that page was 1,009 px tall with
// the arena a strip behind the panels (the 2026-09-29 phone screenshots).
export const PHONE_CSS = `
  html.rlsw-phone { --ph-tap:${P.tap}px; --ph-rail:${P.rail}px; --ph-col:${P.col}px; --ph-top:${P.topBar}px;
    --ph-l:calc(${SAFE_L} + 6px); --ph-r:calc(${SAFE_R} + 6px); --ph-b:calc(${SAFE_B} + 6px); }
  html.rlsw-phone, html.rlsw-phone body { height:100%; overflow:hidden; overscroll-behavior:none; }
  html.rlsw-phone .immersive-match { padding:0 !important; height:100dvh; min-height:0 !important; overflow:hidden; }
  /* ── the top bar: ☰, the race, the crowd — slim, over the arena ── */
  html.rlsw-phone .immersive-match .match-header { position:fixed; z-index:60; top:0; left:0; right:0; height:var(--ph-top);
    margin:0 !important; padding:0 var(--ph-r) 0 var(--ph-l) !important; border-bottom:0 !important; gap:6px !important;
    flex-wrap:nowrap; background:linear-gradient(#030611f0,#030611b0 70%,#03061100); }
  html.rlsw-phone .immersive-match .match-header > span:nth-child(-n+2) { display:none; }  /* ⚡ RLSW · v3.6 */
  html.rlsw-phone .immersive-match .match-header-status { flex-wrap:nowrap; min-width:0; }
  html.rlsw-phone .immersive-match .match-header button { min-height:30px; min-width:var(--ph-tap); }
  /* ── the arena: the whole screen ── */
  html.rlsw-phone [data-match-layout="immersive"] { position:fixed; inset:0; height:auto; min-height:0; padding:0; display:block;
    --hud-pocket:var(--ph-rail); --root-hex:30px; --hud-edge:6px; }
  html.rlsw-phone [data-match-layout="immersive"] .match-board-column { position:absolute; inset:0; height:auto; order:0; }
  html.rlsw-phone [data-match-layout="immersive"] .match-hud-column,
  html.rlsw-phone [data-match-layout="immersive"][data-hud-tutorial] .match-hud-column { display:contents; padding:0; }
  /* ── the step pills, just under the bar ── */
  html.rlsw-phone .match-phase-rail { position:absolute; top:calc(var(--ph-top) + 2px); left:50%; width:auto; gap:4px; }
  html.rlsw-phone .match-phase-step { padding:3px 7px 4px; }
  html.rlsw-phone .match-phase-step > .rlsw-brk-body > span { font-size:0; gap:3px; }
  html.rlsw-phone .match-phase-step i { font-size:8px; }
  html.rlsw-phone .match-phase-live { max-width:150px; font-size:7.5px; }
  /* ── the info rail, off-hand side ── */
  html.rlsw-phone .match-player-pocket { position:absolute; top:calc(var(--ph-top) + 4px); left:var(--ph-l); right:auto; width:var(--ph-rail); gap:5px; }
  html[data-phone-hand="left"].rlsw-phone .match-player-pocket { left:auto; right:var(--ph-r); }
  html.rlsw-phone .match-player-art, html.rlsw-phone .match-player-more { display:none; }
  html.rlsw-phone .match-player-card { min-height:48px; padding:5px 6px; gap:6px; }
  html.rlsw-phone .match-player-copy strong { font-size:10px; margin:2px 0 4px; }
  html.rlsw-phone .match-sound-readout { padding:5px; grid-template-columns:1fr 1fr 30px; min-height:0; gap:4px; }
  html.rlsw-phone .match-sound-readout .rlsw-dial { max-width:${P.dial}px; }
  html.rlsw-phone .match-sound-readout b { font-size:10px; }
  html.rlsw-phone .match-player-frame { --brk-scrim:rgba(6,12,26,${P.alpha}); }
  html.rlsw-phone .match-sound-frame { --brk-scrim:rgba(6,12,26,${P.alpha}); }
  /* ── the tap column, main-thumb side: panel chips on top, the step's controls below ── */
  html.rlsw-phone .match-panel-dock { top:calc(var(--ph-top) + 4px); right:var(--ph-r); left:auto; width:var(--ph-col); z-index:46; }
  html[data-phone-hand="left"].rlsw-phone .match-panel-dock { right:auto; left:var(--ph-l); }
  html.rlsw-phone .match-panel-nav { gap:4px; }
  html.rlsw-phone .match-nav-chip { flex:1; min-height:36px; padding:8px 6px; font-size:8.5px; }
  /* 🎡 THE WHEEL GOES UNDER THE INFO RAIL, NOT OVER THE COLUMN. Its chip stays in
     the column's row, but opened it would cover the very controls it is read
     beside — the melody honeycomb and ✓ Commit (first phone render, 2026-09-29).
     Under SPIRIT and SOUND it is reference you glance at while the thumb works the
     column. \`--hud-pocket-floor\` is the pocket's measured bottom (usePocketFloor).
     ⚠️ \`fixed\`, because its parent dock sits in the column on the other side. */
  html.rlsw-phone .match-scale-pop { position:fixed; left:var(--ph-l); right:auto; top:var(--hud-pocket-floor, 236px);
    width:var(--ph-rail); min-width:0; max-height:calc(100dvh - var(--hud-pocket-floor, 236px) - var(--ph-b)); overflow:hidden; }
  html[data-phone-hand="left"].rlsw-phone .match-scale-pop { left:auto; right:var(--ph-r); }
  html.rlsw-phone [data-match-layout="immersive"] [data-hud-region="turn"] { position:absolute; left:auto; right:var(--ph-r);
    top:calc(var(--ph-top) + 48px); bottom:var(--ph-b); width:var(--ph-col); max-width:none; max-height:none; margin:0;
    padding:7px 0 2px; overflow-y:auto; overflow-x:hidden; background:none; box-shadow:none; clip-path:none; }
  html[data-phone-hand="left"].rlsw-phone [data-match-layout="immersive"] [data-hud-region="turn"] { right:auto; left:var(--ph-l); }
  html.rlsw-phone [data-match-layout="immersive"] [data-hud-region="spirit"] { position:absolute; top:calc(var(--ph-top) + 4px); bottom:var(--ph-b);
    left:calc(var(--ph-l) + var(--ph-rail) + 10px); right:calc(var(--ph-r) + var(--ph-col) + 10px); width:auto; max-width:none; max-height:none; margin:0; z-index:47; }
  /* Rivals and Turn are never open together (one region at a time), so Rivals
     takes the same column rather than competing with the wheel under the rail. */
  html.rlsw-phone [data-match-layout="immersive"] [data-hud-region="rivals"] { position:absolute; left:auto; right:var(--ph-r);
    top:calc(var(--ph-top) + 48px); bottom:var(--ph-b); width:var(--ph-col); max-width:none; max-height:none; margin:0; padding:8px; }
  html[data-phone-hand="left"].rlsw-phone [data-match-layout="immersive"] [data-hud-region="rivals"] { right:auto; left:var(--ph-l); }
  /* 👆 thumbs, not cursors: nothing you tap in the column is under 44 px */
  html.rlsw-phone .stack-chip { min-height:var(--ph-tap); font-size:9.5px; }
  html.rlsw-phone [data-match-layout="immersive"] .immersive-arail .btn { min-height:var(--ph-tap); font-size:10px; }
  html.rlsw-phone [data-hud-region="turn"] button { min-height:36px; }
  html.rlsw-phone [data-hud-region="turn"] .stack-chip.is-go { min-height:var(--ph-tap); font-size:11px; }
  /* ✓ Commit pinned to the column's floor — the one control step 2 exists to reach */
  html.rlsw-phone .match-commit-row { position:sticky; bottom:0; z-index:3; padding-top:6px; background:linear-gradient(#060c1a00,#060c1af0 30%); }
  html.rlsw-phone .match-commit-row .btn { min-height:var(--ph-tap); font-size:10px !important; }
  /* ── the board's own panels: the middle, between rail and column ── */
  html.rlsw-phone [data-match-layout="immersive"] .match-board-preparation { inset:calc(var(--ph-top) + 44px) calc(var(--ph-r) + var(--ph-col) + 10px)
    var(--ph-b) calc(var(--ph-l) + var(--ph-rail) + 10px); }
  html[data-phone-hand="left"].rlsw-phone [data-match-layout="immersive"] .match-board-preparation { inset:calc(var(--ph-top) + 44px) calc(var(--ph-r) + var(--ph-rail) + 10px)
    var(--ph-b) calc(var(--ph-l) + var(--ph-col) + 10px); }
  html.rlsw-phone .arena-board-status { right:calc(var(--ph-r) + var(--ph-col) + 10px); bottom:var(--ph-b); }
  /* ── the battle roll: one big button under the main thumb ── */
  html.rlsw-phone .sonic-roll-prompt { left:auto; right:var(--ph-r); bottom:var(--ph-b); transform:none; width:var(--ph-col); max-width:none;
    flex-direction:column; align-items:stretch; gap:8px; padding:10px; }
  html[data-phone-hand="left"].rlsw-phone .sonic-roll-prompt { right:auto; left:var(--ph-l); }
  html.rlsw-phone .sonic-roll-prompt > button:not(.srp-card) { min-height:64px; font-size:18px; }
  html.rlsw-phone .sonic-roll-prompt .srp-card { position:static; transform:none; min-height:var(--ph-tap); }
  /* ── held upright: ask to be turned, rather than squeeze the arena into 390 px ── */
  .match-rotate { display:none; }
  html.rlsw-phone-portrait .match-rotate { display:grid; position:fixed; inset:0; z-index:200; place-items:center; align-content:center; gap:14px;
    background:#030611f2; color:#dceaff; font:600 15px 'Saira',sans-serif; letter-spacing:1px; text-align:center; padding:24px; }
  html.rlsw-phone-portrait .match-rotate b { font-size:44px; display:block; animation:match-rotate-turn 2.4s ease-in-out infinite; }
  html.rlsw-phone-portrait .match-rotate small { font:400 11px 'Share Tech Mono',monospace; color:#7f98b6; }
  @keyframes match-rotate-turn { 0%,30% { transform:rotate(0) } 60%,100% { transform:rotate(-90deg) } }
  @media (prefers-reduced-motion: reduce) { html.rlsw-phone-portrait .match-rotate b { animation:none; transform:rotate(-90deg); } }
`;
