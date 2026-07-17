// =============================================================================
// ui/GameStyles.jsx  —  static global <style> block (CSS keyframes + classes)
// Zero props, no app references. Extracted verbatim from the Game render.
// =============================================================================
import React from "react";

export function GameStyles() {
  return (
      <style>{`
        * { box-sizing:border-box }
        /* ── FULL-BLEED LAYOUT ──────────────────────────────────────────────
           Vite's starter index.css centers #root with max-width:1280px and
           padding, which squeezes the whole game into a centered strip and
           starves the HUD columns (the loadout column then wraps on top of
           the spirit portrait). Override it so the game spans the viewport. */
        #root, #app, body, html {
          max-width: none !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          text-align: initial !important;
        }
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#2d3748;border-radius:2px}
        .btn{background:#0a1020;border:1px solid #1e3a5f;color:#c0d0e0;padding:4px 8px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:10px;transition:all .15s;white-space:nowrap}
        .btn{transition:all .12s}
        .btn:hover{background:#152030;transform:translateY(-1px);box-shadow:0 2px 8px #00000066}.btn.on{background:#1a3560;border-color:#4488ff;color:#88bbff}
        .btn:disabled{opacity:.3;cursor:not-allowed}
        .btn.end{border-color:#cc8800;color:#ffaa22}
        .bar{background:#0d1a2a;border-radius:2px;height:5px}
        .bar-f{height:5px;border-radius:2px;transition:width .3s}
        .pip{display:inline-block;width:9px;height:9px;border-radius:50%;margin:1px;border:1px solid #1e3a5f}
        .card{position:relative;background:linear-gradient(180deg,#091020 0%,#070d1a 100%);border-radius:8px;padding:7px 9px;border:1px solid #1a2a40;margin-bottom:6px;box-shadow:inset 0 1px 0 #ffffff08}
        /* 🎓 BEGINNER-MODE STEP SPOTLIGHT — lights up whichever HUD panel the player
           needs to engage with next. Panels opt in by setting className="step-active"
           plus a --step-glow-color custom property; this only renders while the game
           root carries .beginner-glow (i.e. beginner mode is on), so experienced
           players get a quiet HUD. */
        .beginner-glow .step-active {
          border-radius: 8px;
          animation: step-glow-pulse 3.2s ease-in-out infinite;
        }
        /* Same box-shadow layer count at every stop (browsers can't tween a
           shadow list smoothly across a differing number of layers — that's
           what made this read as an on/off snap instead of a breathe). Only
           the blur/spread numbers move. */
        @keyframes step-glow-pulse {
          0%, 100% { box-shadow: 0 0 5px var(--step-glow-color, #4488ff), 0 0 9px var(--step-glow-color, #4488ff), inset 0 0 4px var(--step-glow-color, #4488ff); }
          50%      { box-shadow: 0 0 9px var(--step-glow-color, #4488ff), 0 0 18px var(--step-glow-color, #4488ff), inset 0 0 7px var(--step-glow-color, #4488ff); }
        }
        /* ── HUD NEON GLOW ── (see NeonStrikeFX) — gentle fade in, hold, fade out */
        @keyframes hud-neon-pulse {
          0%   { opacity: 0; }
          35%  { opacity: 1; }
          60%  { opacity: 0.8; }
          100% { opacity: 0; }
        }
        .stitle{font-family:'Saira Stencil One',sans-serif;font-size:8px;color:#5a7a9a;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:6}
        .stitle::before{content:'';width:3px;height:9px;border-radius:2px;background:linear-gradient(180deg,#f6ad55,#ff6644);box-shadow:0 0 6px #f6ad5566}
        /* Hexagonal note chips — pointy-top, matching the board.
           .hexw = outer shell (background acts as the border), .hexi = inner fill */
        .hexw{clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);display:flex;align-items:center;justify-content:center;padding:1.5px;flex-shrink:0;box-sizing:border-box}
        .hexi{clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);width:100%;height:100%;display:flex;align-items:center;justify-content:center}
        /* 🎵 Note fly chip — animates from source (Note Stock) to target (commit track / chord stack) */
        .note-fly-chip{position:fixed;z-index:999;pointer-events:none;animation:note-fly .4s cubic-bezier(.22,1,.36,1) forwards}
        @keyframes note-fly {
          0%   { transform: translate(var(--fly-dx), var(--fly-dy)) scale(1.2); opacity: 1; }
          80%  { transform: translate(0, 0) scale(1.05); opacity: 1; }
          100% { transform: translate(0, 0) scale(1); opacity: 0; }
        }
        *::-webkit-scrollbar{width:7px;height:7px}
        *::-webkit-scrollbar-track{background:#070d18}
        *::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:4px}
        *::-webkit-scrollbar-thumb:hover{background:#2a5080}
        .hex-g{cursor:pointer}
        .hex-g:hover polygon{filter:brightness(1.4)}
        @keyframes outline-pulse {
          0%,100% { opacity: 0.80; filter: brightness(1.0) drop-shadow(0 0 3px #ff00ee) drop-shadow(0 0 8px #cc00cc); }
          50%     { opacity: 1.00; filter: brightness(1.55) drop-shadow(0 0 10px #ff44ff) drop-shadow(0 0 22px #ff00ff) drop-shadow(0 0 40px #aa00aa); }
        }
        @keyframes outline-pulse-soft {
          0%,100% { opacity: 0.30; }
          50%     { opacity: 0.65; }
        }
        @keyframes hex-turn-pulse {
          0%   { opacity: 0; }
          15%  { opacity: 0.9; }
          70%  { opacity: 0.7; }
          100% { opacity: 0; }
        }
        @keyframes roadie-run {
          0%   { opacity: 0; transform: scale(0.5); }
          12%  { opacity: 1; transform: scale(1.1); }
          85%  { opacity: 1; transform: scale(1.0); }
          100% { opacity: 0; transform: scale(0.6); }
        }
        @keyframes roadie-label-fade {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          75%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes card-float {
          0%,100% { transform: translateY(0px);   }
          50%     { transform: translateY(-5px);  }
        }
        @keyframes eventTicketIn {
          0%   { opacity: 0; transform: scale(0.7) rotate(-3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes marqueeBlink {
          0%,100% { opacity: 0.25; }
          50%     { opacity: 1; }
        }
        @keyframes eventDiePop {
          0%   { transform: scale(0.3) rotate(-20deg); opacity: 0; }
          70%  { transform: scale(1.15) rotate(4deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes event-hex-pulse {
          0%,100% { opacity: 0.55; filter: drop-shadow(0 0 3px currentColor); }
          50%     { opacity: 1;    filter: drop-shadow(0 0 9px currentColor); }
        }
        @keyframes flame-flicker {
          0%,100% { transform: scale(1)    rotate(-2deg); opacity: 0.9; }
          30%     { transform: scale(1.12) rotate(2deg);  opacity: 1;   }
          60%     { transform: scale(0.94) rotate(-1deg); opacity: 0.85;}
          80%     { transform: scale(1.07) rotate(1deg);  opacity: 1;   }
        }
        @keyframes crew-ready-glow {
          0%,100% { box-shadow: 0 0 3px currentColor; }
          50%     { box-shadow: 0 0 9px currentColor; }
        }
        @keyframes voice-die-spin {
          0%   { transform: rotate(0deg)   scale(1);    }
          50%  { transform: rotate(180deg) scale(1.08); }
          100% { transform: rotate(360deg) scale(1);    }
        }
        @keyframes voice-die-settle {
          0%   { transform: scale(1.35); }
          60%  { transform: scale(0.92); }
          100% { transform: scale(1);    }
        }
        @keyframes cadence-gold-pulse {
          0%,100% { filter: drop-shadow(0 0 3px #ffd70088); }
          50%     { filter: drop-shadow(0 0 9px #ffd700) drop-shadow(0 0 16px #ffd70055); }
        }
        @keyframes fx-ring {
          0%   { transform: scale(0.55); opacity: 0.95; }
          100% { transform: scale(2.6);  opacity: 0; }
        }
        @keyframes fx-label {
          0%   { opacity: 0; transform: translateY(10px) scale(0.7); }
          12%  { opacity: 1; transform: translateY(0) scale(1.15); }
          22%  { opacity: 1; transform: translateY(0) scale(1); }
          78%  { opacity: 1; transform: translateY(-7px) scale(1); }
          100% { opacity: 0; transform: translateY(-16px) scale(0.95); }
        }
        @keyframes affliction-pulse {
          0%,100% { opacity: 0.30; }
          50%     { opacity: 0.85; }
        }
        /* ⚡ Charge Zone aura — a charged Spirit crackles until it's spent */
        @keyframes charge-aura-pulse {
          0%,100% { opacity: 0.45; }
          50%     { opacity: 1; }
        }
        /* 🎤 Fans bobbing at a Spirit's home turf — holds still, then a gentle sway */
        @keyframes fan-bob {
          0%, 55%, 100% { transform: translateY(0px); }
          72%           { transform: translateY(-2.6px); }
          86%           { transform: translateY(-0.9px); }
        }
        /* 🤘 Headbanging — a hard nod about the hips, for the committed 20% */
        @keyframes fan-headbang {
          0%, 100% { transform: rotate(0deg); }
          30%      { transform: rotate(-9deg); }
          45%      { transform: rotate(2deg); }
          70%      { transform: rotate(8deg); }
        }
        /* 🎤 A fan's mouth opening and closing — singing / cheering along */
        @keyframes fan-sing {
          0%, 100% { transform: scaleY(0.32); }
          50%      { transform: scaleY(1); }
        }
        /* 🎤 An occasional blink so the faces feel alive */
        @keyframes fan-blink {
          0%, 90%, 100% { transform: scaleY(1); }
          95%           { transform: scaleY(0.12); }
        }
        /* 🙌 A raised hand swaying side to side — waving in the air */
        @keyframes fan-wave {
          0%, 100% { transform: translateX(var(--swA, -2px)); }
          50%      { transform: translateX(var(--swB, 2px)); }
        }
        /* ✊ A fist pumping the air */
        @keyframes fan-fist {
          0%, 55%, 100% { transform: translateY(0); }
          30%           { transform: translateY(var(--pump, -4px)); }
        }
        /* 🔥 A lighter flame flickering */
        @keyframes fan-flame {
          0%, 100% { transform: scale(0.9) skewX(-4deg);  opacity: 0.85; }
          35%      { transform: scale(1.2) skewX(3deg);   opacity: 1; }
          70%      { transform: scale(0.82) skewX(-2deg); opacity: 0.7; }
        }
        /* 🎆 Fireworks when new fans arrive — a bright flash that blooms and fades */
        @keyframes fw-flash {
          0%   { opacity: 0;   transform: scale(0.2); }
          18%  { opacity: 0.9; transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.7); }
        }
        /* 🎆 Each firework spark shooting outward, then winking out */
        @keyframes fw-spark {
          0%   { opacity: 0;    transform: translate(0,0) scale(0.5); }
          14%  { opacity: 1; }
          100% { opacity: 0;    transform: translate(var(--fx,0px), var(--fy,0px)) scale(0.4); }
        }
        /* 🎆 The expanding shock-ring of a firework burst */
        @keyframes fw-ring {
          0%   { opacity: 0;    transform: scale(0.1); }
          25%  { opacity: 0.85; }
          100% { opacity: 0;    transform: scale(1.6); }
        }
        /* 🎤 A new fan POPS into the crowd */
        @keyframes fan-pop-in {
          0%   { opacity: 0; transform: translateY(-7px) scale(0.1); }
          55%  { opacity: 1; transform: translateY(0)    scale(1.3); }
          75%  { transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1); }
        }
        /* 🎵 A freshly-refilled Note Stock slot POPS in at the start of your turn —
           same grammar as fan-pop-in, applied to the note economy instead of the crowd. */
        @keyframes note-pop-in {
          0%   { opacity: 0; transform: scale(0.2); filter: drop-shadow(0 0 0px #7fe0ff); }
          55%  { opacity: 1; transform: scale(1.35); filter: drop-shadow(0 0 6px #7fe0ffcc); }
          75%  { transform: scale(0.92); }
          100% { opacity: 1; transform: scale(1); filter: drop-shadow(0 0 0px #7fe0ff00); }
        }
        /* 🎤 A departing fan WALKS off the board, then fades */
        @keyframes fan-walk-off {
          0%   { opacity: 1; transform: translate(0,0) scale(1); }
          65%  { opacity: 0.85; }
          100% { opacity: 0; transform: translate(var(--wx,0px), var(--wy,0px)) scale(0.85); }
        }
        /* 🔌 Energy pulsing along a live amp cable */
        @keyframes cable-flow { to { stroke-dashoffset: -24; } }
        /* 🔌 A fraying / sputtering cable on the verge of dropping */
        @keyframes cable-fray { 0%,100% { opacity: 0.9; } 50% { opacity: 0.35; } }
        /* ❓ The Unsure crowd cheering when won over — an excited little jig */
        @keyframes unsure-excited {
          0%,100% { transform: translateY(0) rotate(0deg); }
          25%     { transform: translateY(-3px) rotate(-9deg); }
          75%     { transform: translateY(-1px) rotate(9deg); }
        }
        /* ❓ A won-over fan streaming home to their new favourite */
        @keyframes unsure-fly {
          0%   { opacity: 1; transform: translate(0px,0px); }
          82%  { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--tx,0px), var(--ty,0px)); }
        }
        /* 🎤 Centre stage energy — throb the glow without overriding opacity */
        @keyframes stage-throb {
          0%,100% { filter: drop-shadow(0 0 2px #ff3399); }
          50%     { filter: drop-shadow(0 0 8px #ff3399); }
        }
        .board-outline-img  { animation: outline-pulse      5s ease-in-out infinite; }
        .board-outline-glow { animation: outline-pulse-soft  5s ease-in-out infinite; }
        /* 🤘 Master of Moshpits — fans flooding the board bob & jostle the rival */
        @keyframes moshpit-bob {
          0%,100% { transform: translateY(0) rotate(var(--mosh-tilt, 0deg)); }
          50%     { transform: translateY(-7px) rotate(calc(var(--mosh-tilt, 0deg) * -1)); }
        }
        @keyframes moshpit-pop {
          0%   { opacity: 0; transform: scale(0.3); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes moshpit-shudder {
          0%,100% { transform: translate(0,0); }
          25%     { transform: translate(-2px,1px); }
          50%     { transform: translate(2px,-1px); }
          75%     { transform: translate(-1px,2px); }
        }
        /* ── 🎬 Board dive-bomb: camera spirals into the battle ── */
        @keyframes board-divebomb {
          0%   { transform: scale(1) rotate(0deg); filter: blur(0); }
          20%  { transform: scale(1.8) rotate(-90deg); filter: blur(2px); }
          50%  { transform: scale(3.2) rotate(-270deg); filter: blur(5px); }
          75%  { transform: scale(5.0) rotate(-450deg); filter: blur(8px); opacity: 0.4; }
          100% { transform: scale(7.0) rotate(-540deg); filter: blur(12px); opacity: 0; }
        }
      `}</style>
  );
}
