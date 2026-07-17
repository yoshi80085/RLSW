// =============================================================================
// ui/StageFXLayer.jsx — 🎇 STAGE EFFECTS visuals (presentational, props only)
// -----------------------------------------------------------------------------
// Two exports:
//   • StageFXBoardLayer — SVG <g> mounted inside the board svg, ABOVE the
//     standees (smoke must cover Spirits). Renders smoke cloud, laser beams,
//     pyro arming/eruptions, and animatronic tokens.
//   • StageFXBanner — HTML marquee + persistent status pills, mounted next to
//     the Disco Inferno banner in the board container.
// All game logic (damage, ticking, thresholds) lives in Game.
// =============================================================================
import React from "react";
import { HEX_BY_NUM } from "../board/hexMap.js";
import { pointyCorners } from "../board/hexGeometry.js";
import { LIMELIGHT_HEX } from "../data/gameConstants.js";
import { STAGE_FX_META } from "../data/stageEffects.js";
import { smokeHexNums } from "../board/stageFx.js";

const LASER_PALETTE = ['#ff2266', '#22ff88', '#22aaff', '#ffee22', '#cc44ff'];

// Teardrop flame outline — base centred at (0,0), tip pointing up.
// w = half-width at the base, h = height of the tongue.
const flamePath = (w, h) =>
  `M ${-w} 0 C ${-w} ${-h * 0.35}, ${-w * 0.3} ${-h * 0.55}, 0 ${-h}` +
  ` C ${w * 0.3} ${-h * 0.55}, ${w} ${-h * 0.35}, ${w} 0` +
  ` C ${w * 0.55} ${h * 0.16}, ${-w * 0.55} ${h * 0.16}, ${-w} 0 Z`;

export function StageFXBoardLayer({ smokeFx, laserFx, pyroFx, animatronics, HS, SCALE }) {
  if (!smokeFx && !laserFx && !pyroFx && !animatronics?.length) return null;
  const P = n => {
    const h = HEX_BY_NUM[n];
    return h ? { x: Math.round(h.px * SCALE), y: Math.round(h.py * SCALE) } : null;
  };

  return (
    <g style={{ pointerEvents: 'none' }}>
      <defs>
        <filter id="stagefx-smoke-blur" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={HS * 0.55} />
        </filter>
        <radialGradient id="stagefx-smoke-grad">
          <stop offset="0%" stopColor="#dfe8ee" stopOpacity="0.92" />
          <stop offset="70%" stopColor="#b8c6d2" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#98a8b6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <style>{`
        @keyframes stagefx-laser-flicker { 0%,100%{opacity:.9} 42%{opacity:.55} 58%{opacity:1} 71%{opacity:.7} }
        @keyframes stagefx-smoke-swirl { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes stagefx-smoke-breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }
        @keyframes stagefx-arm-pulse { 0%,100%{opacity:.35} 50%{opacity:1} }
        @keyframes stagefx-bot-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2.5px)} }
        @keyframes stagefx-warn-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes stagefx-flame { 0%,100%{transform:scaleY(1) scaleX(1)} 30%{transform:scaleY(1.14) scaleX(.94)}
          60%{transform:scaleY(.88) scaleX(1.07)} 80%{transform:scaleY(1.08) scaleX(.97)} }
        @keyframes stagefx-flash { 0%{transform:scale(.5); opacity:.5} 100%{transform:scale(1.7); opacity:0} }
        @keyframes stagefx-ember { 0%{transform:translateY(0); opacity:0} 15%{opacity:.95}
          100%{transform:translateY(${-HS * 1.15}px); opacity:0} }
        @keyframes stagefx-bot-scan { 0%,100%{transform:translateX(${-HS * 0.09}px)} 50%{transform:translateX(${HS * 0.09}px)} }
      `}</style>

      {/* ── 🔺 LASER SHOW — diagonal beams from off-stage ── */}
      {laserFx && laserFx.beams.map((beam, bi) => {
        const pts = beam.hexes.map(P).filter(Boolean);
        if (pts.length < 2) return null;
        const a = pts[0], b = pts[pts.length - 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
        const EXT = HS * 8; // start/end well off the stage
        const x1 = a.x - ux * EXT, y1 = a.y - uy * EXT;
        const x2 = b.x + ux * EXT, y2 = b.y + uy * EXT;
        const col = LASER_PALETTE[(bi + (laserFx.roundsLeft ?? 0)) % LASER_PALETTE.length];
        return (
          <g key={`beam-${laserFx.key}-${bi}`}
            style={{ animation: `stagefx-laser-flicker ${0.65 + bi * 0.17}s linear infinite` }}>
            {/* hazard tint on every hex the beam crosses */}
            {beam.hexes.map(n => {
              const p = P(n);
              return p && (
                <polygon key={`bh-${n}`} points={pointyCorners(p.x, p.y, HS * 0.96)}
                  fill={col + '14'} stroke={col + '55'} strokeWidth={0.8} />
              );
            })}
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={HS * 0.42}
              opacity={0.13} strokeLinecap="round" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={HS * 0.15}
              opacity={0.5} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${col})` }} />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeWidth={2}
              opacity={0.95} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 4px ${col})` }} />
          </g>
        );
      })}

      {/* ── 🎆 PYROTECHNICS — armed charge / drawn eruption ── */}
      {pyroFx && pyroFx.hexes.map((n, i) => {
        const p = P(n);
        if (!p) return null;
        if (pyroFx.phase === 'arming') {
          return (
            <g key={`pyro-${n}`}>
              {/* pulsing hazard hex */}
              <g style={{ animation: 'stagefx-arm-pulse 0.9s ease-in-out infinite',
                animationDelay: `${(i % 5) * 0.12}s` }}>
                <polygon points={pointyCorners(p.x, p.y, HS * 0.96)}
                  fill="#ff220026" stroke="#ff3322" strokeWidth={2}
                  style={{ filter: 'drop-shadow(0 0 7px #ff3322aa)' }} />
              </g>
              {/* rotating warning ring */}
              <g style={{ animation: 'stagefx-warn-spin 4s linear infinite',
                transformOrigin: `${p.x}px ${p.y}px` }}>
                <circle cx={p.x} cy={p.y} r={HS * 0.62} fill="none" stroke="#ff5533"
                  strokeWidth={1.4} strokeDasharray="7 5" opacity={0.85} />
              </g>
              {/* the primed charge — canister, hot core, lit fuse */}
              <rect x={p.x - HS * 0.16} y={p.y - HS * 0.18} width={HS * 0.32} height={HS * 0.4}
                rx={2} fill="#2a0e08" stroke="#ff6644" strokeWidth={1.2} />
              <circle cx={p.x} cy={p.y + HS * 0.02} r={HS * 0.1} fill="#ffcc44"
                style={{ animation: 'stagefx-arm-pulse 0.45s ease-in-out infinite',
                  filter: 'drop-shadow(0 0 5px #ffaa33)' }} />
              <line x1={p.x} y1={p.y - HS * 0.18} x2={p.x + HS * 0.12} y2={p.y - HS * 0.38}
                stroke="#ffaa55" strokeWidth={1.2} />
              <circle cx={p.x + HS * 0.12} cy={p.y - HS * 0.38} r={2} fill="#ffee99"
                style={{ animation: 'stagefx-arm-pulse 0.3s linear infinite',
                  filter: 'drop-shadow(0 0 4px #ffee66)' }} />
              {/* stray embers rising off the fuse */}
              {[0, 1].map(k => (
                <circle key={k} cx={p.x + (k ? HS * 0.22 : -HS * 0.2)} cy={p.y - HS * 0.1}
                  r={1.4} fill="#ff8844"
                  style={{ animation: `stagefx-ember ${1.1 + k * 0.3}s linear ${k * 0.35 + (i % 3) * 0.2}s infinite` }} />
              ))}
            </g>
          );
        }
        return (
          <g key={`pyro-${n}`}>
            <polygon points={pointyCorners(p.x, p.y, HS * 0.96)}
              fill="#ff660030" stroke="#ffaa44" strokeWidth={1.5}
              style={{ filter: 'drop-shadow(0 0 8px #ff8833)' }} />
            {/* expanding ground flash */}
            <ellipse cx={p.x} cy={p.y + HS * 0.3} rx={HS * 0.7} ry={HS * 0.22}
              fill="#ffdd88" opacity={0.5}
              style={{ animation: 'stagefx-flash 0.9s ease-out infinite',
                transformOrigin: `${p.x}px ${p.y + HS * 0.3}px` }} />
            {/* layered flame tongues — flicker from the base */}
            <g transform={`translate(${p.x},${p.y + HS * 0.34})`}>
              <g style={{ animation: 'stagefx-flame 0.42s ease-in-out infinite',
                animationDelay: `${(n % 4) * 0.09}s`, transformOrigin: '0px 0px' }}>
                <path d={flamePath(HS * 0.52, HS * 1.35)} fill="#ff5a1a" opacity={0.92}
                  style={{ filter: 'drop-shadow(0 0 7px #ff6622)' }} />
                <path d={flamePath(HS * 0.34, HS * 0.95)} fill="#ffaa33" />
                <path d={flamePath(HS * 0.18, HS * 0.55)} fill="#ffee99" />
              </g>
              {/* sparks thrown upward */}
              {[0, 1, 2].map(k => (
                <circle key={k} cx={(k - 1) * HS * 0.3} cy={-HS * 0.2} r={1.6} fill="#ffdd66"
                  style={{ animation: `stagefx-ember ${0.7 + k * 0.25}s linear ${k * 0.2}s infinite`,
                    filter: 'drop-shadow(0 0 3px #ffcc44)' }} />
              ))}
            </g>
          </g>
        );
      })}

      {/* ── 🤖 ANIMATRONICS — drawn stage mechs: scanning visor, blinking beacon,
          treads, target-lock ring, countdown badge ── */}
      {animatronics?.map(bot => {
        const p = P(bot.num);
        if (!p) return null;
        return (
          <g key={bot.key} transform={`translate(${p.x},${p.y})`}
            style={{ transition: 'transform 0.8s ease' }}>
            {/* slow target-lock ring */}
            <g style={{ animation: 'stagefx-warn-spin 6s linear infinite', transformOrigin: '0px 0px' }}>
              <circle r={HS * 0.78} fill="none" stroke="#88ffcc" strokeWidth={1}
                strokeDasharray="4 9" opacity={0.5} />
            </g>
            <ellipse cx={1} cy={HS * 0.5} rx={HS * 0.52} ry={HS * 0.17} fill="#000" opacity={0.4} />
            <g style={{ animation: 'stagefx-bot-bob 1.4s ease-in-out infinite' }}>
              {/* treads */}
              <rect x={-HS * 0.42} y={HS * 0.22} width={HS * 0.84} height={HS * 0.2} rx={HS * 0.1}
                fill="#0c241c" stroke="#3f8a6d" strokeWidth={1} />
              {/* torso */}
              <rect x={-HS * 0.34} y={-HS * 0.18} width={HS * 0.68} height={HS * 0.44} rx={3}
                fill="#0a1a14" stroke="#88ffcc" strokeWidth={1.5}
                style={{ filter: 'drop-shadow(0 0 6px #88ffcc66)' }} />
              {/* chest core */}
              <circle cy={HS * 0.05} r={HS * 0.09} fill="#134232" stroke="#88ffcc" strokeWidth={0.8}
                style={{ animation: 'stagefx-arm-pulse 1.6s ease-in-out infinite' }} />
              {/* arms */}
              <line x1={-HS * 0.34} y1={0} x2={-HS * 0.52} y2={HS * 0.14}
                stroke="#88ffcc" strokeWidth={1.4} strokeLinecap="round" opacity={0.8} />
              <line x1={HS * 0.34} y1={0} x2={HS * 0.52} y2={HS * 0.14}
                stroke="#88ffcc" strokeWidth={1.4} strokeLinecap="round" opacity={0.8} />
              {/* head + visor with scanning eye */}
              <rect x={-HS * 0.22} y={-HS * 0.5} width={HS * 0.44} height={HS * 0.3} rx={3}
                fill="#0d221a" stroke="#88ffcc" strokeWidth={1.3} />
              <rect x={-HS * 0.16} y={-HS * 0.44} width={HS * 0.32} height={HS * 0.14} rx={2}
                fill="#04110c" />
              <circle cy={-HS * 0.37} r={HS * 0.055} fill="#aaffdd"
                style={{ animation: 'stagefx-bot-scan 1.8s ease-in-out infinite',
                  filter: 'drop-shadow(0 0 3px #88ffcc)' }} />
              {/* antenna + blinking beacon */}
              <line x1={0} y1={-HS * 0.5} x2={0} y2={-HS * 0.68} stroke="#88ffcc" strokeWidth={1} />
              <circle cy={-HS * 0.72} r={1.8} fill="#ff5566"
                style={{ animation: 'stagefx-arm-pulse 0.8s ease-in-out infinite',
                  filter: 'drop-shadow(0 0 3px #ff5566)' }} />
              {/* turns-left badge */}
              <circle cx={HS * 0.52} cy={-HS * 0.48} r={HS * 0.17} fill="#04110c"
                stroke="#88ffcc" strokeWidth={1} />
              <text x={HS * 0.52} y={-HS * 0.41} textAnchor="middle" fontSize={HS * 0.28}
                fill="#aaffdd" fontFamily="'Share Tech Mono',monospace" fontWeight={700}>
                {bot.turnsLeft}
              </text>
            </g>
          </g>
        );
      })}

      {/* ── 💨 SMOKE MACHINE — drawn LAST so it covers standees ── */}
      {smokeFx && (() => {
        const hub = P(LIMELIGHT_HEX);
        if (!hub) return null;
        const nums = smokeHexNums(smokeFx.radius);
        let maxD = 0;
        nums.forEach(n => {
          const p = P(n);
          if (p) maxD = Math.max(maxD, Math.hypot(p.x - hub.x, p.y - hub.y));
        });
        const R = maxD + HS * 1.15;
        const puffs = [0, 1, 2, 3, 4, 5, 6];
        return (
          <g filter="url(#stagefx-smoke-blur)" opacity={0.9}>
            <g style={{ animation: 'stagefx-smoke-swirl 46s linear infinite',
              transformOrigin: `${hub.x}px ${hub.y}px` }}>
              <circle cx={hub.x} cy={hub.y} r={R * 0.82} fill="url(#stagefx-smoke-grad)" />
              {puffs.map(i => {
                const ang = (Math.PI * 2 * i) / puffs.length + i * 0.7;
                const d = R * (0.42 + (i % 3) * 0.11);
                return (
                  <circle key={i}
                    cx={hub.x + Math.cos(ang) * d}
                    cy={hub.y + Math.sin(ang) * d * 0.85}
                    r={R * (0.4 + (i % 2) * 0.12)}
                    fill="url(#stagefx-smoke-grad)"
                    style={{ animation: `stagefx-smoke-breathe ${5 + i * 0.9}s ease-in-out infinite`,
                      transformOrigin: `${hub.x}px ${hub.y}px` }} />
                );
              })}
            </g>
          </g>
        );
      })()}
    </g>
  );
}

// ── HTML marquee + status pills ──────────────────────────────────────────────
export function StageFXBanner({ banner, smokeFx, laserFx, pyroFx, animatronics }) {
  const pills = [
    smokeFx && { icon: '💨', color: '#9fb8cc',
      text: `SMOKE — spreads, ${smokeFx.roundsLeft} round${smokeFx.roundsLeft !== 1 ? 's' : ''} left` },
    laserFx && { icon: '🔺', color: '#ff2266',
      text: `LASERS — cross = −1 Vibe, ${laserFx.roundsLeft} round${laserFx.roundsLeft !== 1 ? 's' : ''} left` },
    pyroFx && { icon: '🎆', color: '#ff7722',
      text: pyroFx.phase === 'arming'
        ? `PYRO wave ${pyroFx.wave} — hexes PRIMED, they blow next turn!`
        : `PYRO wave ${pyroFx.wave} — burning! Stay clear` },
    animatronics?.length > 0 && { icon: '🤖', color: '#88ffcc',
      text: `ANIMATRONICS ×${animatronics.length} — hunting the nearest Spirit` },
  ].filter(Boolean);

  const meta = banner ? STAGE_FX_META[banner.id] : null;
  if (!meta && !pills.length) return null;

  return (
    <div style={{ position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
      zIndex: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      pointerEvents: 'none', width: 'max-content', maxWidth: '92%' }}>
      <style>{`
        @keyframes stagefx-banner-in {
          0% { opacity:0; transform:translateY(-14px) scale(0.94); }
          12% { opacity:1; transform:translateY(0) scale(1.02); }
          16% { transform:translateY(0) scale(1); }
          88% { opacity:1; }
          100% { opacity:0; transform:translateY(-8px); }
        }
      `}</style>
      {meta && (
        <div key={banner.key} style={{
          animation: 'stagefx-banner-in 5s ease forwards',
          background: 'linear-gradient(180deg,#131022ee,#0a0816ee)',
          border: `1.5px solid ${meta.color}`, borderRadius: 10, padding: '9px 18px',
          textAlign: 'center', boxShadow: `0 0 22px ${meta.color}66, 0 6px 24px #000c`,
        }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: meta.color,
            fontFamily: "'Saira Stencil One',sans-serif" }}>
            🎇 STAGE EFFECT — THE SHOW HITS ⭐{banner.threshold}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', margin: '3px 0 2px',
            fontFamily: "'Saira Stencil One',sans-serif", textShadow: `0 0 12px ${meta.color}` }}>
            {meta.icon} {meta.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 10.5, color: '#b8c4d6', maxWidth: 380 }}>{meta.blurb}</div>
        </div>
      )}
      {pills.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
          {pills.map((p, i) => (
            <div key={i} style={{ background: '#0a0f1adf', border: `1px solid ${p.color}88`,
              borderRadius: 20, padding: '2px 10px', fontSize: 9.5, color: p.color,
              fontFamily: "'Share Tech Mono',monospace",
              boxShadow: `0 0 8px ${p.color}33` }}>
              {p.icon} {p.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
