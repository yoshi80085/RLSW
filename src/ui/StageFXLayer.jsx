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

      {/* ── 🎆 PYROTECHNICS — arming glow / eruption ── */}
      {pyroFx && pyroFx.hexes.map((n, i) => {
        const p = P(n);
        if (!p) return null;
        if (pyroFx.phase === 'arming') {
          return (
            <g key={`pyro-${n}`}
              style={{ animation: 'stagefx-arm-pulse 0.9s ease-in-out infinite', animationDelay: `${(i % 5) * 0.12}s` }}>
              <polygon points={pointyCorners(p.x, p.y, HS * 0.96)}
                fill="#ff220026" stroke="#ff3322" strokeWidth={2}
                style={{ filter: 'drop-shadow(0 0 7px #ff3322aa)' }} />
              <text x={p.x} y={p.y + HS * 0.22} textAnchor="middle" fontSize={HS * 0.55}
                opacity={0.9}>🎇</text>
            </g>
          );
        }
        return (
          <g key={`pyro-${n}`}>
            <polygon points={pointyCorners(p.x, p.y, HS * 0.96)}
              fill="#ff660030" stroke="#ffaa44" strokeWidth={1.5}
              style={{ filter: 'drop-shadow(0 0 8px #ff8833)' }} />
            <g style={{ animation: 'flame-flicker 0.5s ease-in-out infinite',
              animationDelay: `${(n % 4) * 0.11}s`, transformOrigin: `${p.x}px ${p.y}px` }}>
              <text x={p.x} y={p.y + HS * 0.18} textAnchor="middle" fontSize={HS * 1.15}
                style={{ filter: 'drop-shadow(0 0 5px #ff6622)' }}>🔥</text>
              <text x={p.x} y={p.y - HS * 0.42} textAnchor="middle" fontSize={HS * 0.6}
                opacity={0.9}
                style={{ filter: 'drop-shadow(0 0 4px #ffcc44)' }}>🔥</text>
            </g>
          </g>
        );
      })}

      {/* ── 🤖 ANIMATRONICS — stage robots on the hunt ── */}
      {animatronics?.map(bot => {
        const p = P(bot.num);
        if (!p) return null;
        return (
          <g key={bot.key} transform={`translate(${p.x},${p.y})`}
            style={{ transition: 'transform 0.8s ease' }}>
            <g style={{ animation: 'stagefx-bot-bob 1.4s ease-in-out infinite' }}>
              <ellipse cx={2} cy={4} rx={HS * 0.55} ry={HS * 0.2} fill="#000" opacity={0.35} />
              <circle cx={0} cy={0} r={HS * 0.55} fill="#0a1a14" stroke="#88ffcc" strokeWidth={1.6}
                style={{ filter: 'drop-shadow(0 0 6px #88ffcc88)' }} />
              <text x={0} y={HS * 0.05} textAnchor="middle" fontSize={HS * 1.05}>🤖</text>
              <text x={HS * 0.52} y={-HS * 0.42} textAnchor="middle" fontSize={HS * 0.38}
                fill="#88ffcc" fontFamily="'Share Tech Mono',monospace" fontWeight={700}
                style={{ filter: 'drop-shadow(0 0 3px #000)' }}>{bot.turnsLeft}</text>
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
            fontFamily: "'Orbitron',sans-serif" }}>
            🎇 STAGE EFFECT — THE SHOW HITS ⭐{banner.threshold}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', margin: '3px 0 2px',
            fontFamily: "'Orbitron',sans-serif", textShadow: `0 0 12px ${meta.color}` }}>
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
