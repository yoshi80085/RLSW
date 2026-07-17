// =============================================================================
// ui/RockGodLayer.jsx — 🤘 ROCK GOD boss visuals (presentational, props only)
// -----------------------------------------------------------------------------
// Three exports:
//   • RockGodBoardLayer — SVG <g> in the board svg: telegraph hexes, the god's
//     oversized standee (aura + HP bar + winded marker). Emoji/SVG placeholder
//     until real standee art lands.
//   • RockGodHUD — HTML: descent marquee, persistent HP bar, the turn clock,
//     and the telegraph warning pill.
//   • GodVictoryOverlay — full-screen game over when the God wipes the stage.
// All game logic lives in the main file's ROCK GOD SYSTEM.
// =============================================================================
import React from "react";
import { HEX_BY_NUM } from "../board/hexMap.js";
import { pointyCorners } from "../board/hexGeometry.js";
import { ROCK_GODS } from "../data/rockGods.js";
import bardbarianImg from "../Bardbarian.png";

// God artwork — gods without art fall back to the emoji colossus placeholder.
// (Bardbarian.png is 3:2 with a baked-in background, so it renders as a
// circular medallion inside the aura ring.)
const GOD_ART = { bardbarian: bardbarianImg };

export function RockGodBoardLayer({ god, HS, SCALE }) {
  if (!god) return null;
  const def = ROCK_GODS[god.id];
  const hex = HEX_BY_NUM[god.num];
  if (!def || !hex) return null;
  const cx = Math.round(hex.px * SCALE);
  const cy = Math.round(hex.py * SCALE);
  const dead = god.hp <= 0;
  const hpFrac = Math.max(0, god.hp / god.maxHp);
  const barW = HS * 3.2;

  return (
    <g style={{ pointerEvents: 'none' }}>
      <style>{`
        @keyframes rockgod-aura { 0%,100%{opacity:.5; transform:scale(1)} 50%{opacity:.9; transform:scale(1.06)} }
        @keyframes rockgod-stomp { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes rockgod-telegraph { 0%,100%{opacity:.3} 50%{opacity:.95} }
      `}</style>

      {/* ── Telegraph hexes — get OUT of the glow ── */}
      {god.telegraph?.hexes?.map((n, i) => {
        const h = HEX_BY_NUM[n];
        if (!h) return null;
        const px = Math.round(h.px * SCALE), py = Math.round(h.py * SCALE);
        const isSlide = god.telegraph.attackId === 'power_slide';
        const col = isSlide ? '#ff4422' : def.color;
        return (
          <g key={`tg-${n}`} style={{ animation: 'rockgod-telegraph 0.8s ease-in-out infinite',
            animationDelay: `${(i % 6) * 0.09}s` }}>
            <polygon points={pointyCorners(px, py, HS * 0.96)}
              fill={col + '2a'} stroke={col} strokeWidth={2}
              style={{ filter: `drop-shadow(0 0 8px ${col})` }} />
            <text x={px} y={py + HS * 0.22} textAnchor="middle" fontSize={HS * 0.55} opacity={0.95}>
              {isSlide ? '🛝' : '⚡'}
            </text>
          </g>
        );
      })}

      {/* ── The God himself ── */}
      <g transform={`translate(${cx},${cy})`} style={{ transition: 'transform 0.9s ease' }}
        opacity={dead ? 0.25 : 1}>
        {/* Divine aura */}
        <circle cx={0} cy={0} r={HS * 1.5} fill={def.aura + '33'} stroke={def.aura}
          strokeWidth={2} strokeDasharray="8 6"
          style={{ animation: 'rockgod-aura 1.6s ease-in-out infinite',
            transformBox: 'fill-box', transformOrigin: 'center',
            filter: `drop-shadow(0 0 14px ${def.aura})` }} />
        <g style={{ animation: dead ? undefined : 'rockgod-stomp 1.1s ease-in-out infinite' }}>
          <ellipse cx={3} cy={HS * 0.4} rx={HS * 0.95} ry={HS * 0.3} fill="#000" opacity={0.45} />
          {GOD_ART[god.id] ? (() => {
            // Divine medallion — the art fills a circle inside the aura ring.
            const R = HS * 1.05;                    // medallion radius
            const imgH = R * 2.15;                  // cover the circle with margin
            const imgW = imgH * 1.5;                // Bardbarian.png is 3:2
            const clipId = `rockgod-clip-${god.id}`;
            return (
              <g>
                <defs>
                  <clipPath id={clipId}>
                    <circle cx={0} cy={-HS * 0.15} r={R} />
                  </clipPath>
                </defs>
                <circle cx={0} cy={-HS * 0.15} r={R + 2} fill="#160e02" />
                <image href={GOD_ART[god.id]}
                  x={-imgW / 2} y={-HS * 0.15 - imgH / 2}
                  width={imgW} height={imgH}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#${clipId})`} />
                <circle cx={0} cy={-HS * 0.15} r={R} fill="none"
                  stroke={def.color} strokeWidth={2.6}
                  style={{ filter: `drop-shadow(0 0 10px ${def.color})` }} />
                <text x={R * 0.62} y={-HS * 0.15 - R * 0.72} textAnchor="middle"
                  fontSize={HS * 0.55}
                  style={{ filter: `drop-shadow(0 0 5px ${def.color})` }}>⚡</text>
              </g>
            );
          })() : (
            <g>
              {/* Placeholder colossus — gods without art yet */}
              <circle cx={0} cy={-HS * 0.15} r={HS * 0.92} fill="#160e02"
                stroke={def.color} strokeWidth={2.4}
                style={{ filter: `drop-shadow(0 0 10px ${def.color})` }} />
              <text x={0} y={HS * 0.22} textAnchor="middle" fontSize={HS * 1.35}>{def.icon}</text>
              <text x={0} y={-HS * 0.72} textAnchor="middle" fontSize={HS * 0.55}>⚡</text>
            </g>
          )}
        </g>
        {/* Winded — the punish window is OPEN */}
        {god.winded && !dead && (
          <text x={0} y={-HS * 1.75} textAnchor="middle" fontSize={HS * 0.42} fontWeight={800}
            fill="#ffee44" fontFamily="'Saira Stencil One',sans-serif"
            style={{ filter: 'drop-shadow(0 0 6px #ffaa00)' }}>
            😵 WINDED — ×2 DMG!
          </text>
        )}
        {/* Name plate + HP bar */}
        <text x={0} y={HS * 1.55} textAnchor="middle" fontSize={HS * 0.4} fontWeight={800}
          fill={def.color} fontFamily="'Saira Stencil One',sans-serif" letterSpacing={1.5}
          style={{ filter: `drop-shadow(0 0 4px #000) drop-shadow(0 0 6px ${def.color}66)` }}>
          {def.name.toUpperCase()}
        </text>
        <rect x={-barW / 2} y={HS * 1.72} width={barW} height={HS * 0.24} rx={3}
          fill="#0a0f1a" stroke={def.color + '88'} strokeWidth={1} />
        <rect x={-barW / 2 + 1.5} y={HS * 1.72 + 1.5} width={Math.max(0, (barW - 3) * hpFrac)}
          height={HS * 0.24 - 3} rx={2}
          fill={hpFrac > 0.5 ? def.color : hpFrac > 0.2 ? '#ff8822' : '#ff3322'}
          style={{ transition: 'width 0.5s ease' }} />
        <text x={0} y={HS * 1.72 + HS * 0.19} textAnchor="middle" fontSize={HS * 0.2}
          fill="#fff" fontFamily="'Share Tech Mono',monospace" fontWeight={700}>
          {Math.max(0, god.hp)} / {god.maxHp}
        </text>
      </g>
    </g>
  );
}

export function RockGodHUD({ god, banner, timer, bossOutcome }) {
  if (!god) return null;
  const def = ROCK_GODS[god.id];
  if (!def) return null;
  const live = god.hp > 0 && !bossOutcome;
  const timerHot = timer != null && timer <= 10;

  return (
    <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
      zIndex: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      pointerEvents: 'none', width: 'max-content', maxWidth: '94%' }}>
      <style>{`
        @keyframes rockgod-descend {
          0% { opacity:0; transform:translateY(-30px) scale(1.15); }
          14% { opacity:1; transform:translateY(0) scale(1); }
          86% { opacity:1; }
          100% { opacity:0; transform:translateY(-10px) scale(0.97); }
        }
        @keyframes rockgod-clock-hot { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
      `}</style>

      {/* Descent marquee */}
      {banner && (
        <div key={banner.key} style={{
          animation: 'rockgod-descend 6.4s ease forwards',
          background: 'linear-gradient(180deg,#1a1002f2,#0a0801f2)',
          border: `2px solid ${def.color}`, borderRadius: 12, padding: '12px 26px',
          textAlign: 'center', boxShadow: `0 0 34px ${def.color}88, 0 8px 30px #000d`,
        }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: def.color,
            fontFamily: "'Saira Stencil One',sans-serif" }}>
            🌩️ THE RACE IS TOO CLOSE — A ROCK GOD DESCENDS 🌩️
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', margin: '5px 0 2px',
            fontFamily: "'Saira Stencil One',sans-serif", textShadow: `0 0 18px ${def.color}` }}>
            {def.icon} {def.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 11, color: def.color, letterSpacing: 2,
            fontFamily: "'Saira Stencil One',sans-serif" }}>{def.title}</div>
          <div style={{ fontSize: 10.5, color: '#c8bfa8', maxWidth: 430, marginTop: 5 }}>
            {def.blurb} Stand together: Drive = damage = Fame. Beat the clock or taste his Vengeance.
          </div>
        </div>
      )}

      {/* Persistent fight status: HP + clock + telegraph warning */}
      {live && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
          justifyContent: 'center' }}>
          <div style={{ background: '#0a0f1adf', border: `1px solid ${def.color}`,
            borderRadius: 20, padding: '3px 12px', fontSize: 10, color: def.color,
            fontFamily: "'Share Tech Mono',monospace", boxShadow: `0 0 10px ${def.color}44` }}>
            {def.icon} {god.hp}/{god.maxHp} HP{god.winded ? ' · 😵 WINDED ×2' : ''}
          </div>
          {timer != null && (
            <div style={{ background: timerHot ? '#2a0400df' : '#0a0f1adf',
              border: `1.5px solid ${timerHot ? '#ff3322' : '#88ccff'}`,
              borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 800,
              color: timerHot ? '#ff5544' : '#aaddff',
              fontFamily: "'Saira Stencil One',sans-serif",
              animation: timerHot ? 'rockgod-clock-hot 0.6s ease-in-out infinite' : undefined,
              boxShadow: timerHot ? '0 0 12px #ff332288' : undefined }}>
              ⏰ {timer}s
            </div>
          )}
          {god.telegraph && (
            <div style={{ background: '#1a0800df', border: '1px solid #ff6622',
              borderRadius: 20, padding: '3px 12px', fontSize: 9.5, color: '#ffaa66',
              fontFamily: "'Share Tech Mono',monospace",
              animation: 'rockgod-clock-hot 0.9s ease-in-out infinite' }}>
              ⚠️ {god.telegraph.label} INCOMING — clear the glowing hexes!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function GodVictoryOverlay({ god, bossOutcome, spirits, noteStates, onReturnToLobby }) {
  if (bossOutcome !== 'god' || !god) return null;
  const def = ROCK_GODS[god.id];
  const board = [...spirits]
    .map(sp => ({ sp, fame: noteStates[sp.id]?.fame ?? 0 }))
    .sort((a, b) => b.fame - a.fame);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#050200ee', zIndex: 9999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <div style={{ fontSize: 64, filter: `drop-shadow(0 0 30px ${def.color})` }}>{def.icon}</div>
      <div style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 22, color: def.color,
        letterSpacing: 5, textTransform: 'uppercase',
        textShadow: `0 0 24px ${def.color}, 0 0 48px ${def.color}66` }}>
        THE GODS KEEP THE CROWN
      </div>
      <div style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 13, color: '#c8bfa8' }}>
        {def.name} silences every Spirit on the stage. The Legend remains a myth.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
        {board.map(({ sp, fame }, i) => (
          <div key={sp.id} style={{ fontSize: 11, color: i === 0 ? '#ffd700' : '#8a94a8',
            fontFamily: "'Share Tech Mono',monospace" }}>
            {i + 1}. {sp.name} — ⭐{fame}{i === 0 ? '  (closest to glory)' : ''}
          </div>
        ))}
      </div>
      <button className="btn" style={{ marginTop: 14, fontSize: 12, padding: '8px 22px',
        borderColor: def.color, color: def.color }} onClick={onReturnToLobby}>
        ⟵ BACK TO THE LOBBY
      </button>
    </div>
  );
}
