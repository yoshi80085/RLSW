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
        /* ── 🎛️ THE STEP-3 ACTION RAIL ─────────────────────────────────────
           Geometry comes from 'RAIL_VARS' in ui/ActionRail.jsx, set inline on
           the '.arail' wrapper, so the dial-in stays in ONE object and this
           stylesheet keeps its "zero props, no app references" promise.
           ⚠️ EVERY RULE HERE IS SCOPED UNDER '.arail'. The '.btn' class is worn
           by dozens of buttons across the HUD, the modals and the lobby; a bare
           '.btn{height:33px}' would rake the Continue-to-Melody button and the
           upgrade tree along with the rail. */
        .arail .arail-row{display:flex;flex-wrap:wrap;gap:var(--rb-gap);align-content:flex-start}
        .arail .btn{
          height:var(--rb-h);padding:0 var(--rb-px);font-size:var(--rb-fs);
          min-width:var(--rb-minw);border-radius:3px;overflow:hidden;
          display:inline-flex;align-items:center;justify-content:center;
          transform:skewX(var(--rb-shear));clip-path:var(--rb-clip);
          background:linear-gradient(100deg,
            color-mix(in srgb,currentColor var(--rb-wash),transparent),transparent);
          box-shadow:0 0 calc(9px * var(--rb-bloom))
            color-mix(in srgb,currentColor 33%,transparent),inset 2px 0 0 currentColor;
        }
        /* ⚠️ THE HOVER RULE MUST RESTATE THE SKEW. The base '.btn:hover' sets
           'transform:translateY(-1px)', and a transform does not merge — without
           this the button SNAPS UPRIGHT under the cursor, which reads as the
           panel glitching rather than as a lift. */
        .arail .btn:hover{transform:skewX(var(--rb-shear)) translateY(-1px)}
        .arail .btn > .rb-in{
          display:flex;align-items:center;gap:5px;white-space:nowrap;line-height:1.05;
          transform:skewX(var(--rb-unshear));
        }
        /* A refused button is a dark recess, not the lit one turned down — the
           same rule the turn rail's unlit lamp obeys. See TurnRail's ⚠️. */
        .arail .btn:disabled{background:#0a1020;box-shadow:none}
        .arail .btn.end{box-shadow:0 0 calc(9px * var(--rb-bloom))
          color-mix(in srgb,#ffaa22 40%,transparent),inset 2px 0 0 #ffaa22}
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
        /* 🪦 THE CLIP-PATH CHIPS ARE GONE (2026-08-28). .hexw / .hexi drew every
           note in the game as a SOLID hexagon — an outer div whose background acted as
           the border, an inner div as the fill. Nothing uses them now: the note stock,
           the step-1 commit grid, the eight track seats and the twelve chord-stack
           seats are all NoteHex inline SVG. ⚠️ DO NOT BRING THEM BACK FOR "just one
           small chip". The reason they died is in NoteHex.jsx's header and it is not a
           style preference: a filled hexagon's drop-shadow hides behind the hexagon, so
           a clip-path chip fundamentally CANNOT glow, and every one of these that
           survived read as a dead tile sitting next to live ones. */
        /* 🎵 Note fly chip — animates from source (Note Stock) to target (commit track / chord stack) */
        /* 🎵 THE NOTE IN FLIGHT. The path, the size morph and the bracket spin are
           driven from NoteFlyChip.jsx through the Web Animations API — a bowed
           arc is not expressible in keyframes without hardcoding the endpoints,
           and the endpoints are wherever the seat happens to be. Only the shed
           trail rings are CSS, because they are identical apart from a delay. */
        .note-fly-layer{position:fixed;inset:0;z-index:999;pointer-events:none;overflow:visible}
        .note-fly-chip-v2{position:absolute;left:0;top:0;will-change:transform}
        .note-fly-wave{position:absolute;pointer-events:none;overflow:visible;display:block}
        .note-fly-wave polygon{transform-box:view-box;transform-origin:60px 60px;
          animation:note-fly-wave var(--wave-ms) cubic-bezier(.16,.84,.36,1) var(--wave-delay) both}
        @keyframes note-fly-wave{
          0%   { opacity:.95; stroke-width:3.6; transform:scale(1); }
          100% { opacity:0;   stroke-width:.6;  transform:scale(var(--reach)); }
        }

        /* 🎆 THE COMMIT BURST — the flare a note throws as it leaves your hand,
           and the one it throws again as it seats. Ported wholesale from
           .scratch/note-commit-overlay.html at the "overdrive" variant Alex
           selected, which is flash + core + lifted letter + the detent spin (no
           shockwave ring, no starburst spokes — those are the other three
           presets and they are deliberately not here).
           ⚠️ EVERY LAYER LIVES IN THE CHIP'S OWN 120×120 viewBox, inside
           NoteHex's <svg>. That is what keeps the burst the right size on a 67px
           hand chip AND on a 72px stack seat without a scale factor anywhere,
           and what lets the core sit BEHIND the chip's rings while the flash
           sits in front. A burst drawn in a separate overlay cannot do either. */
        .notehex-burst *{transform-box:view-box;transform-origin:60px 60px}
        @keyframes b-core{
          0%   { opacity:0;   transform:scale(.2); }
          16%  { opacity:.85; transform:scale(1); }
          100% { opacity:0;   transform:scale(1.5); }
        }
        /* the arrival's answer to b-core: it falls INTO the seat instead of out of it */
        @keyframes b-seat{
          0%   { opacity:0;  transform:scale(1.55); }
          38%  { opacity:.9; transform:scale(.93); }
          100% { opacity:0;  transform:scale(1); }
        }
        @keyframes b-flash{
          0%   { opacity:0; stroke-width:3.4; transform:scale(1); }
          12%  { opacity:1; stroke-width:7;   transform:scale(1.04); }
          100% { opacity:0; stroke-width:2;   transform:scale(1.18); }
        }
        @keyframes b-lift{
          0%   { opacity:1; transform:scale(1); }
          100% { opacity:0; transform:scale(2.1); }
        }
        /* ⚠️ 120° MAPS THE THREE BRACKETS ONTO THEMSELVES — upper-left lands on
           middle-right, middle-right on lower-left — so the ring at rest is
           identical to where it started and only the MOTION reads. 60° lands on
           the other three corners and mirrors the pinwheel, which the chip then
           keeps for the rest of the game. That is why the detent is 120 and not
           a number that "looks like more spin". */
        @keyframes b-detent{
          0%   { opacity:1; transform:rotate(0deg); }
          74%  { opacity:1; transform:rotate(var(--det-over)); }
          88%  { opacity:1; transform:rotate(var(--det)); }
          100% { opacity:0; transform:rotate(var(--det)); }
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
        /* 🔓 THE HUNT MARKER — the hex holding the Lost Chord that opens your next
           stack seat. Dialled by Alex on the scratch unlock-glow preview page,
           2026-09-02, against the real board art at the real scale.
           ⚠️ NOT event-hex-pulse. It dips further (0.45 vs 0.55) and blooms
           harder (10px vs 9px) on purpose: the marker has to win against a board
           that is already full of pulsing cyan, and it is drawn at hex size
           rather than chip size, so the same numbers do not read the same. */
        @keyframes unlock-hex-pulse {
          0%,100% { opacity: 0.45; filter: drop-shadow(0 0 3px currentColor); }
          50%     { opacity: 1;    filter: drop-shadow(0 0 10px currentColor); }
        }
        @keyframes slimePulse {
          0%,100% { opacity: 0.5; }
          50%     { opacity: 0.85; }
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
        /* ⚔️↔🛡️ DUAL-LEGAL NOTE — both stacks legalize this pitch, so the chip says
           both. The dwell at each end is intentional: a straight crossfade reads as
           one muddy purple at speed, and a third colour would imply a third
           category. The cycle returns to red at 100% so the loop seam is invisible.
           ⚠️ #ff6644 / #44aaff are DRIVE_C / SUSTAIN_C in rlsw-simulator-v3_8_1.jsx.
           They're literals here only because this is a CSS string; change one, change
           both, or the chip will disagree with the stat readouts it points at.

           🪦 stack-dual-hex / stack-dual-ink LIVED HERE AND ARE GONE (2026-08-26).
           They animated 'background' on the two nested clip-path divs, which the Note
           Stock no longer uses — it renders ui/NoteHex.jsx, an SVG, where the colour
           lives on 'stroke'. Nothing else ever referenced them: the Commit Track and
           both Chord Stacks have no dual state. The three below replace them. */
        @keyframes note-dual-stroke {
          0%, 25%   { stroke: #ff6644; }
          42%, 58%  { stroke: #44aaff; }
          75%, 100% { stroke: #ff6644; }
        }
        @keyframes note-dual-bloom {
          0%, 25%   { filter: drop-shadow(0 0 2px #ffffffcc) drop-shadow(0 0 4px #ff6644) drop-shadow(0 0 11px #ff664499); }
          42%, 58%  { filter: drop-shadow(0 0 2px #ffffffcc) drop-shadow(0 0 4px #44aaff) drop-shadow(0 0 11px #44aaff99); }
          75%, 100% { filter: drop-shadow(0 0 2px #ffffffcc) drop-shadow(0 0 4px #ff6644) drop-shadow(0 0 11px #ff664499); }
        }
        /* ⚠️ Phase-locked with the two above — identical duration and easing at every
           call site, or the ring and the brackets drift apart mid-cycle. */
        .notehex-dual .notehex-ring { animation: note-dual-stroke 2.2s ease-in-out infinite; }
        .notehex-dual .notehex-brk  { animation: note-dual-stroke 2.2s ease-in-out infinite; }
        .notehex-dual .notehex-glow { animation: note-dual-bloom  2.2s ease-in-out infinite; }
        /* 🔤 The chip's letter follows the HUD's mono, not the SVG default serif. */
        .notehex text { font-family: 'Share Tech Mono', ui-monospace, monospace; font-weight: 700; }

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
        /* ❤️ life-pulse — the breathing used by the last-life pips in the HUD,
           the respawn ring on a standee, the Master of Moshpits fan ellipse and
           the fan-gain ring.
           ⚠️ IT LIVED IN ScoreTrackOverlay.jsx UNTIL 2026-08-31, inside a
           <style> tag nested in that overlay's <g>. Three of its four callers
           are on the board and have nothing to do with lives, so all three were
           silently depending on a corner blip being rendered: the overlay bails
           early for a knocked-out or zero-life spirit, and if every spirit had
           bailed the <style> went with them and four animations across the app
           quietly froze mid-cycle. Nothing here is new behaviour — this is the
           rule finally living somewhere that is always mounted. */
        @keyframes life-pulse {
          from { opacity: 0.25; }
          to   { opacity: 0.7; }
        }
        /* 6️⃣ BERSERK — the Beast is loose and the standee burns for it.
           berserk-glow pulses the aura and the tag; berserk-standee pushes the
           art hot and red; berserk-wash rides a red screen layer over the top;
           berserk-spin turns the dashed rage ring. */
        @keyframes berserk-glow {
          0%,100% { opacity: 0.55; }
          50%     { opacity: 1; }
        }
        @keyframes berserk-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes berserk-standee {
          0%,100% { filter: drop-shadow(0 0 6px #ff0000) saturate(1.5) brightness(1.05)
                            hue-rotate(-12deg); }
          50%     { filter: drop-shadow(0 0 18px #ff2200) drop-shadow(0 0 30px #cc0000)
                            saturate(2.6) brightness(1.3) hue-rotate(-22deg); }
        }
        @keyframes berserk-wash {
          0%,100% { opacity: 0.16; }
          50%     { opacity: 0.42; }
        }
        /* 🎵 SPENT NOTE — a note leaving the Spirit for good. It pops off the
           standee, tumbles away along --spent-dx/--spent-dy, and evaporates.
           Used for Drive notes burned on an attack and Sustain notes frayed
           off a Spirit that just took a hit. */
        @keyframes spent-note-fly {
          0%   { opacity: 0; transform: translate(0,0) scale(0.55) rotate(0deg); }
          14%  { opacity: 1; transform: translate(0, -2px) scale(1.35) rotate(0deg); }
          28%  { opacity: 1;
                 transform: translate(calc(var(--spent-dx) * 0.22), calc(var(--spent-dy) * 0.22))
                            scale(1.05) rotate(calc(var(--spent-rot) * 0.25)); }
          70%  { opacity: 0.72;
                 transform: translate(calc(var(--spent-dx) * 0.72), calc(var(--spent-dy) * 0.72))
                            scale(0.8) rotate(calc(var(--spent-rot) * 0.75)); }
          100% { opacity: 0;
                 transform: translate(var(--spent-dx), var(--spent-dy))
                            scale(0.42) rotate(var(--spent-rot)); }
        }
        /* ⚡ Charge Zone aura — a charged Spirit crackles until it's spent */
        @keyframes charge-aura-pulse {
          0%,100% { opacity: 0.45; }
          50%     { opacity: 1; }
        }
        /* 🪦 SHAMISEN ANIMATIONS — removed 2026-08-26 with the board token.
           shamisen-sway, shamisen-stalk and cursed-by-melody all drove the
           standee that no longer exists. The curse's only animation now is
           shamisen-glow, injected next to the ability bar it belongs to. */
        /* 🔊 AMP DECKS (AMP_DECK_DESIGN.md §3) — the rig at your corner */
        /* A fresh cabinet drops onto the stack with a bounce */
        @keyframes amp-drop-in {
          0%   { opacity: 0; transform: translateY(-14px) scaleY(1.05); }
          60%  { opacity: 1; transform: translateY(2px) scaleY(0.96); }
          100% { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        /* Speaker thump synced with the Sonic beam firing */
        @keyframes amp-thump {
          0%   { transform: scale(1, 1); }
          35%  { transform: scale(1.07, 0.93); }
          70%  { transform: scale(0.98, 1.03); }
          100% { transform: scale(1, 1); }
        }
        /* Power dials / range horn tips smoulder */
        @keyframes amp-led-pulse {
          0%,100% { opacity: 0.45; }
          50%     { opacity: 1; }
        }
        /* Lightning arcs crawling over a high-Range rig — mostly off, sharp flashes */
        @keyframes amp-arc-flicker {
          0%, 78%, 100% { opacity: 0; }
          80%           { opacity: 0.95; }
          84%           { opacity: 0.15; }
          88%           { opacity: 0.8; }
          92%           { opacity: 0; }
        }
        /* Powered knob rings — vibrant pink breathing glow (Power tiers) */
        @keyframes amp-knob-pulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        /* Amp inner glow — screen-blended overlay pulses on the dark speaker face */
        @keyframes amp-inner-glow {
          0%, 100% { opacity: 0.06; }
          50%      { opacity: 0.22; }
        }
        /* Amps hover gently — floating island stage in space */
        @keyframes amp-hover-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2.5px); }
        }
        /* The Range radius ring breathing out from the home corner */
        @keyframes amp-ring-pulse {
          0%,100% { opacity: 0.55; transform: scale(0.985); }
          50%     { opacity: 1;    transform: scale(1.015); }
        }
        /* 🎤 Fans bobbing — whole-body sway applied by the parent wrapper */
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
        /* 🎤 Head-only bob — extra internal head bounce (stacked with parent bob) */
        @keyframes fan-head-bob {
          0%, 50%, 100% { transform: translateY(0); }
          25%           { transform: translateY(var(--hbob, -1.8px)); }
          75%           { transform: translateY(var(--hbob2, -0.6px)); }
        }
        /* 😊 Head tilt — an occasional sideways lean */
        @keyframes fan-tilt {
          0%, 78%, 100% { transform: rotate(0deg); }
          82%, 93%      { transform: rotate(var(--tilt, 10deg)); }
        }
        /* 👀 Pupils looking around — translateX shifts the pupil group */
        @keyframes fan-look {
          0%, 25%  { transform: translateX(0); }
          30%, 42% { transform: translateX(var(--look, 1px)); }
          47%, 60% { transform: translateX(0); }
          65%, 78% { transform: translateX(calc(-1 * var(--look, 1px))); }
          83%, 100% { transform: translateX(0); }
        }
        /* 👁️ Blink — periodic quick close/open of the eyes */
        @keyframes fan-blink {
          0%, 88%, 100% { transform: scaleY(1); }
          92%, 96%      { transform: scaleY(0.08); }
        }
        /* 😄 Happy eyes fade in/out — arcs visible during the wave behaviour slice */
        @keyframes fan-eyes-happy {
          0%, 74%  { opacity: 0; }
          75%, 80% { opacity: 1; }
          81%, 100% { opacity: 0; }
        }
        @keyframes fan-eyes-normal {
          0%, 74%  { opacity: 1; }
          75%, 80% { opacity: 0; }
          81%, 100% { opacity: 1; }
        }

        /* ── BEHAVIOUR CYCLE — rest-heavy, mostly settled ────────────────────
           Rest dominates (~74%). Actions appear briefly (~5-6% each).
           Per-fan cycle DURATIONS vary (38–60 s) so they drift out of sync —
           even though the keyframe percentages are fixed, the actual wall-clock
           timing differs per fan, making the crowd appear random.
           Acts: 0 rest → 1 wave → 2 fist → 3 lighter → 4 phone/camera */
        @keyframes fan-act-0 {
          0%     { opacity: 1; }
          73%    { opacity: 1; }
          74%    { opacity: 0; }
          98.5%  { opacity: 0; }
          100%   { opacity: 1; }
        }
        @keyframes fan-act-1 {
          0%     { opacity: 0; }
          74%    { opacity: 0; }
          75%    { opacity: 1; }
          80%    { opacity: 1; }
          81%    { opacity: 0; }
          100%   { opacity: 0; }
        }
        @keyframes fan-act-2 {
          0%     { opacity: 0; }
          81%    { opacity: 0; }
          82%    { opacity: 1; }
          87%    { opacity: 1; }
          88%    { opacity: 0; }
          100%   { opacity: 0; }
        }
        @keyframes fan-act-3 {
          0%     { opacity: 0; }
          88%    { opacity: 0; }
          89%    { opacity: 1; }
          93%    { opacity: 1; }
          94%    { opacity: 0; }
          100%   { opacity: 0; }
        }
        @keyframes fan-act-4 {
          0%     { opacity: 0; }
          94%    { opacity: 0; }
          95%    { opacity: 1; }
          98.5%  { opacity: 1; }
          99.5%  { opacity: 0; }
          100%   { opacity: 0; }
        }
        /* 🙌 Wave — raised hands sway side to side */
        @keyframes fan-wave {
          0%, 100% { transform: translateX(var(--swA, -2px)); }
          50%      { transform: translateX(var(--swB, 2px)); }
        }
        /* ✊ Fist pumping the air */
        @keyframes fan-fist {
          0%, 55%, 100% { transform: translateY(0); }
          30%           { transform: translateY(var(--pump, -4px)); }
        }
        /* 🔥 Lighter flame flickering */
        @keyframes fan-flame {
          0%, 100% { transform: scale(0.9) skewX(-4deg);  opacity: 0.85; }
          35%      { transform: scale(1.2) skewX(3deg);   opacity: 1; }
          70%      { transform: scale(0.82) skewX(-2deg); opacity: 0.7; }
        }
        /* 📱 Phone swaying slowly */
        @keyframes fan-phone-sway {
          0%, 100% { transform: translateX(-1px); }
          50%      { transform: translateX(1px); }
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
        /* 🤘 Master of Moshpits cinematic — fans climb out of the stands and
           WALK to the Monster's hex. --mosh-dx/--mosh-dy carry the seat→pit
           offset (each fan gets its own), so one keyframe serves every mover. */
        @keyframes mosh-walk-in {
          0%   { transform: translate(var(--mosh-dx,0px), var(--mosh-dy,0px)) scale(0.82); opacity: 0.35; }
          12%  { opacity: 1; }
          100% { transform: translate(0,0) scale(1); opacity: 1; }
        }
        /* the pit itself — stomping in place, harder than the idle crowd bob */
        @keyframes mosh-stomp {
          0%,100% { transform: translateY(0)    rotate(var(--mosh-tilt, 0deg)); }
          50%     { transform: translateY(-9px) rotate(calc(var(--mosh-tilt, 0deg) * -1.4)); }
        }
        /* spent — the fans give everything and evaporate */
        @keyframes mosh-spend {
          0%   { opacity: 1; transform: scale(1)   translateY(0); }
          100% { opacity: 0; transform: scale(1.5) translateY(-16px); }
        }
        /* the pit floor glow, breathing under the whole thing */
        @keyframes mosh-pit-glow {
          0%,100% { opacity: 0.30; transform: scale(1); }
          50%     { opacity: 0.70; transform: scale(1.12); }
        }
        /* ── 🎬 Board dive-bomb: camera spirals into the battle ── */
        @keyframes board-divebomb {
          0%   { transform: scale(1) rotate(0deg); filter: blur(0); }
          20%  { transform: scale(1.8) rotate(-90deg); filter: blur(2px); }
          50%  { transform: scale(3.2) rotate(-270deg); filter: blur(5px); }
          75%  { transform: scale(5.0) rotate(-450deg); filter: blur(8px); opacity: 0.4; }
          100% { transform: scale(7.0) rotate(-540deg); filter: blur(12px); opacity: 0; }
        }

        /* 🎤 Riff-off taunt slam — full-screen text overlay */
        @keyframes taunt-slam {
          0%   { opacity: 0; }
          8%   { opacity: 1; }
          75%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes taunt-text-pop {
          0%   { opacity: 0; transform: scale(0.5) rotate(-2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        /* ☀️ Sunbeam whiteout — the star opening on the blinded player's screen.
           Runs ONCE on mount and holds at full white (the caller passes the
           "both" fill mode); it must never fade back out, because the overlay's
           whole job is to stay opaque for the rest of the blind. Fast and
           front-loaded so it reads as an impact, not a slow transition.
           NB: this whole stylesheet is a JS template literal — no backticks. */
        /* 🕳️ Black Hole Vortex — accretion rings turn against each other and the
           singularity breathes. Two directions on purpose: a single spin reads
           as a loading spinner, counter-rotation reads as something being pulled
           apart. */
        @keyframes gravity-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes gravity-spin-rev {
          from { transform: rotate(360deg); }
          to   { transform: rotate(0deg); }
        }
        @keyframes gravity-pulse {
          0%, 100% { transform: scale(1);    opacity: 1; }
          50%      { transform: scale(0.86); opacity: 0.92; }
        }

        @keyframes sunbeam-flash {
          0%   { opacity: 0; filter: brightness(3); }
          35%  { opacity: 1; filter: brightness(1.8); }
          100% { opacity: 1; filter: brightness(1); }
        }

        /* 🔆 Drive/Sustain button glow for early rounds */
        @keyframes stack-btn-glow {
          0%, 100% { box-shadow: 0 0 6px var(--glow-color, #ff6644), 0 0 14px var(--glow-color, #ff6644)44; }
          50%      { box-shadow: 0 0 12px var(--glow-color, #ff6644), 0 0 28px var(--glow-color, #ff6644)66; }
        }
      `}</style>
  );
}
