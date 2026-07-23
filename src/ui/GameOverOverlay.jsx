// =============================================================================
// ui/GameOverOverlay.jsx  —  cinematic VICTORY SCREEN
// Recreates the final frame of the opening movie: the floating island, the
// ROCK LEGENDS title blast — with the Victor standing on the board, wrapped
// in looping thunder strikes. Loops until the player clicks FINISH, which
// reveals the final scoreboard. Pure presentational: all data via props.
// ⚡ PERF: every looping animation is opacity/transform only (GPU-composited);
// drop-shadows are static. Bolts flicker via opacity, matching OpeningMovie.
// =============================================================================
import React, { useEffect, useRef, useState } from "react";
import openingIsland from "../assets/opening_island.png";
import thunderSfx from "../thunder.mp3";

// ── bolt generator (same math as OpeningMovie) ──────────────────────────────
function seededRand(seed) {
  let s = Math.abs(seed) || 1;
  return () => { s = (s * 16807 + 11) % 2147483647; return s / 2147483647; };
}
function generateBoltPoints(x1, y1, x2, y2, segments, jitter, seed) {
  const rng = seededRand(seed);
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const jx = i > 0 && i < segments ? (rng() - 0.5) * jitter * 2 : 0;
    const jy = i > 0 && i < segments ? (rng() - 0.5) * jitter * 2 : 0;
    pts.push(`${(x1 + (x2 - x1) * t + jx).toFixed(1)},${(y1 + (y2 - y1) * t + jy).toFixed(1)}`);
  }
  return pts.join(' ');
}

const VS_STYLES = `
  @keyframes vs-bolt-flicker { 0%{opacity:1}20%{opacity:0}40%{opacity:1}60%{opacity:0}100%{opacity:0} }
  @keyframes vs-cloud-pulse  { 0%,100%{opacity:0}50%{opacity:0.4} }
  @keyframes vs-title-slam   { 0%{opacity:0;transform:scale(1.8) translateY(-20px)}15%{opacity:1;transform:scale(1.05) translateY(2px)}30%{transform:scale(.98) translateY(-1px)}50%,100%{transform:scale(1)} }
  @keyframes vs-subtitle-in  { from{opacity:0;letter-spacing:14px}to{opacity:1;letter-spacing:6px} }
  @keyframes vs-victor-rise  { 0%{opacity:0;transform:translate(-50%,6%) scale(0.9)}100%{opacity:1;transform:translate(-50%,0) scale(1)} }
  @keyframes vs-victor-bob   { 0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,-1.2%)} }
  @keyframes vs-aura-pulse   { 0%,100%{opacity:0.35;transform:translate(-50%,-50%) scale(1)}50%{opacity:0.7;transform:translate(-50%,-50%) scale(1.12)} }
  @keyframes vs-name-glow    { 0%,100%{opacity:0.85}50%{opacity:1} }
  @keyframes vs-finish-pulse { 0%,100%{opacity:0.75;transform:scale(1)}50%{opacity:1;transform:scale(1.05)} }
  @keyframes vs-board-in     { 0%{opacity:0;transform:translateY(24px) scale(0.96)}100%{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes vs-row-in       { 0%{opacity:0;transform:translateX(-14px)}100%{opacity:1;transform:translateX(0)} }
`;

export function GameOverOverlay({
  winner,
  spirits,
  noteStates,
  limelightScores,
  headliner,
  matchStats,
  onReturnToLobby,
  fameToWin,
  LIMELIGHT_TO_WIN,
}) {
  const [phase, setPhase] = useState('cinematic'); // 'cinematic' | 'score'
  const [strike, setStrike] = useState(null);      // { key, x, main, b1, b2 }
  const flashRef = useRef(null);
  const timerRef = useRef(null);
  const firstStrikeRef = useRef(true);

  // ── ⚡ THUNDER LOOP — random strikes forever, until Return to Lobby ──
  useEffect(() => {
    if (!winner) return;
    let disposed = false;
    const rng = seededRand(Date.now());
    const fire = () => {
      if (disposed) return;
      const seed = Math.floor(rng() * 100000) + 7;
      const x = 36 + rng() * 28;                     // strike lands around the stage
      setStrike({
        key: seed, x,
        main: generateBoltPoints(x, 0, 50, 33, 10, 12, seed),
        b1:   generateBoltPoints(x, 10, x - 13, 41, 7, 8, seed + 1),
        b2:   generateBoltPoints(x, 16, x + 12, 45, 7, 9, seed + 2),
      });
      // Double flash: hard hit, quick dip, echo (same choreography as the movie)
      const fl = (o) => { if (flashRef.current) flashRef.current.style.opacity = o; };
      fl(firstStrikeRef.current ? '0.5' : '0.28');
      setTimeout(() => fl('0'), 140);
      setTimeout(() => fl('0.18'), 240);
      setTimeout(() => fl('0'), 380);
      try {
        const a = new Audio(thunderSfx);
        a.volume = firstStrikeRef.current ? 0.85 : 0.35;
        a.play().catch(() => {});
      } catch { /* autoplay blocked — silent lightning is still lightning */ }
      firstStrikeRef.current = false;
      timerRef.current = setTimeout(fire, 2400 + rng() * 2800);
    };
    timerRef.current = setTimeout(fire, 700);
    return () => { disposed = true; clearTimeout(timerRef.current); };
  }, [winner]);

  if (!winner) return null;
  const w = spirits.find(s => s.id === winner);
  const isFameWin   = (noteStates[winner]?.fame ?? 0) >= fameToWin;
  const isLimelight = !isFameWin && (limelightScores?.[winner] ?? 0) >= LIMELIGHT_TO_WIN;
  const winColor    = w?.color ?? '#ffd700';
  const winLine = isFameWin
    ? `reached ${fameToWin} Fame Points — their name is written in lights forever!`
    : isLimelight
      ? `held the Limelight for ${LIMELIGHT_TO_WIN} turns and DOMINATED the stage!`
      : 'is the last Spirit standing!';

  // ── FINAL STANDINGS — sorted by Fame, winner always on top ──
  const board = spirits
    .map(s => {
      const st = matchStats?.[s.id];
      return {
        id: s.id, name: s.name, color: s.color, img: s.imageSrc,
        fame: noteStates[s.id]?.fame ?? 0,
        casuals: noteStates[s.id]?.casuals ?? 0,
        diehards: noteStates[s.id]?.diehards ?? 0,
        lives: s.lives ?? 0,
        limelight: limelightScores?.[s.id] ?? 0,
        isHeadliner: headliner === s.id,
        isWinner: s.id === winner,
        riff: st?.riff ?? null,           // { perfect, good, ok, miss, wrong }
        battleFor: st?.battleFor ?? 0,    // Σ own battle totals
        battleAgainst: st?.battleAgainst ?? 0, // Σ rivals' battle totals
        battleW: st?.battleW ?? 0, battleL: st?.battleL ?? 0,
      };
    })
    .sort((a, b) => (b.isWinner - a.isWinner) || (b.fame - a.fame));
  const medals = ['🥇', '🥈', '🥉', '🎸'];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#131612', zIndex: 9999,
      overflow: 'hidden', fontFamily: "'Saira Stencil One',sans-serif",
    }}>
      <style>{VS_STYLES}</style>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="vs-glow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="bl"/>
            <feMerge><feMergeNode in="bl"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="vs-glow-lg">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="bl"/>
            <feMerge><feMergeNode in="bl"/><feMergeNode in="bl"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
      </svg>

      {/* ── THE ISLAND — final movie framing (camera locked at the title shot) ── */}
      <div style={{ position: 'absolute', inset: '-25%', transform: 'scale(1.2) translateY(1%)' }}>
        <img src={openingIsland} alt="" draggable={false} style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
        }}/>

        {/* Cloud pulses — the storm never sleeps */}
        {[
          { x: 22, y: 14, c: '#c084fc', d: 2.0, dl: 0 },
          { x: 81, y: 16, c: '#818cf8', d: 3.0, dl: 0.7 },
          { x: 14, y: 45, c: '#a78bfa', d: 2.5, dl: 1.4 },
          { x: 76, y: 87, c: '#818cf8', d: 3.5, dl: 2.1 },
        ].map((cl, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${cl.x - 8}%`, top: `${cl.y - 8}%`,
            width: '16%', height: '16%', borderRadius: '50%',
            background: `radial-gradient(circle, ${cl.c}88 0%, transparent 70%)`,
            mixBlendMode: 'screen', pointerEvents: 'none',
            animation: `vs-cloud-pulse ${cl.d}s ease-in-out ${cl.dl}s infinite`,
          }}/>
        ))}

        {/* ── THE VICTOR — standing on the board, aura blazing ── */}
        {w?.imageSrc && (
          <>
            <div style={{
              position: 'absolute', left: '50%', top: '43%',
              width: '26%', height: '30%', pointerEvents: 'none',
              background: `radial-gradient(ellipse 50% 50% at center, ${winColor}66 0%, ${winColor}22 45%, transparent 72%)`,
              mixBlendMode: 'screen',
              animation: 'vs-aura-pulse 2.2s ease-in-out infinite',
            }}/>
            <div style={{
              position: 'absolute', left: '50%', top: '25%', height: '37%',
              animation: 'vs-victor-rise 1.4s cubic-bezier(.16,1,.3,1) both, vs-victor-bob 3.4s ease-in-out 1.4s infinite',
              pointerEvents: 'none',
            }}>
              <img src={w.imageSrc} alt={w.name} draggable={false} style={{
                height: '100%', width: 'auto', objectFit: 'contain', objectPosition: 'bottom center',
                filter: `drop-shadow(0 0 18px ${winColor}) drop-shadow(0 0 44px ${winColor}88)`,
              }}/>
            </div>
            {/* stage-glow at their feet */}
            <div style={{
              position: 'absolute', left: '50%', top: '60.5%', width: '18%', height: '3.5%',
              transform: 'translateX(-50%)', borderRadius: '50%', pointerEvents: 'none',
              background: `radial-gradient(ellipse, ${winColor}55 0%, transparent 70%)`,
              mixBlendMode: 'screen',
              animation: 'vs-name-glow 2.2s ease-in-out infinite',
            }}/>
          </>
        )}

        {/* ── ⚡ THUNDER STRIKES — regenerated every few seconds, forever ── */}
        {strike && (
          <svg key={strike.key} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none',
          }}>
            <polyline points={strike.main} fill="none" stroke="white" strokeWidth="1.1"
              filter="url(#vs-glow-lg)"
              style={{ animation: 'vs-bolt-flicker 420ms linear forwards' }}/>
            <polyline points={strike.b1} fill="none" stroke="#e8e0ff" strokeWidth="0.55"
              filter="url(#vs-glow-lg)"
              style={{ animation: 'vs-bolt-flicker 380ms linear 50ms forwards' }}/>
            <polyline points={strike.b2} fill="none" stroke={winColor} strokeWidth="0.5"
              filter="url(#vs-glow)"
              style={{ animation: 'vs-bolt-flicker 380ms linear 110ms forwards' }}/>
          </svg>
        )}
      </div>

      {/* Edge vignette + scanlines (movie look) */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 48%, #131612 96%)',
      }}/>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 3px)',
      }}/>

      {/* White flash (thunder) */}
      <div ref={flashRef} style={{
        position: 'absolute', inset: 0, background: 'white',
        opacity: 0, transition: 'opacity 90ms ease-out', pointerEvents: 'none',
      }}/>

      {/* ── ROCK LEGENDS TAG — the movie's title blast, now crowning the Victor ── */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: phase === 'cinematic' ? '5%' : '2.5%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        pointerEvents: 'none', transition: 'top 0.5s ease',
      }}>
        <svg viewBox="0 0 900 100" style={{
          width: phase === 'cinematic' ? 'min(72vw, 720px)' : 'min(46vw, 460px)',
          height: 'auto', overflow: 'visible', transition: 'width 0.5s ease',
          animation: 'vs-title-slam 800ms cubic-bezier(.16,1,.3,1) forwards',
          filter: 'drop-shadow(0 0 20px #ff2fd6) drop-shadow(0 0 40px #ff2fd688) drop-shadow(0 0 80px #66e0ff44)',
        }}>
          <text x="450" y="70" textAnchor="middle"
            fontFamily="'Saira Stencil One', sans-serif" fontWeight="700"
            fontSize="72" letterSpacing="10"
            fill="#0a0a14" stroke="#ff2fd6" strokeWidth="2.5"
            style={{ paintOrder: 'stroke fill' }}>
            ROCK LEGENDS
          </text>
        </svg>
        <div style={{
          fontSize: 'clamp(10px, 1.6vw, 16px)', color: '#66e0ff',
          textShadow: '0 0 12px #66e0ff88', marginTop: 8, opacity: 0,
          animation: 'vs-subtitle-in 1s ease-out 600ms forwards', letterSpacing: 6,
        }}>SPIRIT WARS</div>
      </div>

      {/* ═══ PHASE: CINEMATIC — victor announced, FINISH waits ═══ */}
      {phase === 'cinematic' && (
        <>
          <div style={{
            position: 'absolute', left: 0, right: 0, top: '66%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            pointerEvents: 'none',
          }}>
            <div style={{
              fontSize: 'clamp(13px, 2.2vw, 22px)', letterSpacing: 4, textTransform: 'uppercase',
              color: isFameWin ? '#ffd700' : isLimelight ? '#ff88ff' : '#ffcc00',
              textShadow: isFameWin ? '0 0 24px #ffd700, 0 0 48px #ffd70088'
                        : isLimelight ? '0 0 20px #ff44ff, 0 0 40px #ff44ff88'
                        : '0 0 20px #ffcc0088',
              animation: 'vs-name-glow 2.2s ease-in-out infinite',
            }}>
              {isFameWin ? '⭐ A LEGEND IS BORN ⭐' : isLimelight ? '✨ LIMELIGHT VICTORY ✨' : '🏆 LAST SPIRIT STANDING 🏆'}
            </div>
            <div style={{
              fontSize: 'clamp(16px, 3vw, 30px)', letterSpacing: 3, color: winColor,
              textShadow: `0 0 20px ${winColor}, 0 0 44px ${winColor}88`,
            }}>
              {w?.name?.toUpperCase()}
            </div>
            <div style={{ fontSize: 'clamp(9px, 1.2vw, 12px)', color: '#8aa0c0', letterSpacing: 1,
              fontFamily: "'Share Tech Mono', monospace" }}>
              {winLine}
            </div>
          </div>
          <button onClick={() => setPhase('score')} style={{
            position: 'absolute', left: '50%', bottom: '6%', transform: 'translateX(-50%)',
            fontFamily: "'Saira Stencil One', sans-serif", fontSize: 13, letterSpacing: 4,
            padding: '10px 34px', cursor: 'pointer', borderRadius: 8,
            background: '#0a1020cc', color: '#ffd700', border: '2px solid #ffd700',
            boxShadow: '0 0 18px #ffd70055',
            animation: 'vs-finish-pulse 2s ease-in-out infinite',
          }}>
            🎬 FINISH
          </button>
        </>
      )}

      {/* ═══ PHASE: SCORE — final standings over the still-raging storm ═══ */}
      {phase === 'score' && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14, paddingTop: '6%',
        }}>
          <div style={{
            background: '#050810ee', border: `2px solid ${winColor}88`, borderRadius: 12,
            padding: '18px 26px', minWidth: 'min(92vw, 560px)', maxWidth: '92vw',
            boxShadow: `0 0 40px ${winColor}33`,
            animation: 'vs-board-in 0.5s cubic-bezier(.16,1,.3,1) both',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 4,
              fontSize: 15, letterSpacing: 3, color: winColor,
              textShadow: `0 0 16px ${winColor}88` }}>
              {isFameWin ? '⭐' : isLimelight ? '✨' : '🏆'} {w?.name?.toUpperCase()} TAKES THE CROWN
            </div>
            <div style={{ textAlign: 'center', marginBottom: 14, fontSize: 9,
              color: '#8aa0c0', letterSpacing: 1, fontFamily: "'Share Tech Mono', monospace" }}>
              {winLine}
            </div>

            {/* header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '30px 1fr 64px 92px 52px 52px',
              gap: 6, padding: '0 8px 6px', fontSize: 8, letterSpacing: 1, color: '#4a5f80',
              fontFamily: "'Share Tech Mono', monospace", textTransform: 'uppercase',
            }}>
              <span/><span>Spirit</span>
              <span style={{ textAlign: 'right' }}>⭐ Fame</span>
              <span style={{ textAlign: 'right' }}>🎤 Fans</span>
              <span style={{ textAlign: 'right' }}>❤️ Lives</span>
              <span style={{ textAlign: 'right' }}>✨ Lime</span>
            </div>

            {board.map((s, i) => {
              const r = s.riff;
              const riffTotal = r ? r.perfect + r.good + r.ok + r.miss + r.wrong : 0;
              const battles = s.battleW + s.battleL;
              return (
                <div key={s.id} style={{
                  padding: '7px 8px 6px', borderRadius: 8, marginBottom: 4,
                  background: s.isWinner ? '#14100a' : '#0a101f',
                  border: `1px solid ${s.isWinner ? '#ffd700aa' : '#1e3a5f'}`,
                  boxShadow: s.isWinner ? '0 0 14px #ffd70044' : 'none',
                  animation: `vs-row-in 0.4s ease-out ${0.15 + i * 0.12}s both`,
                }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '30px 1fr 64px 92px 52px 52px',
                    gap: 6, alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 14 }}>{medals[i] ?? '🎸'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {s.img && <img src={s.img} alt="" style={{
                        height: 26, width: 26, objectFit: 'contain', objectPosition: 'bottom center',
                        filter: `drop-shadow(0 0 4px ${s.color})` }}/>}
                      <span style={{ fontSize: 11, letterSpacing: 1, color: s.color,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}{s.isHeadliner ? ' 👑' : ''}
                      </span>
                    </span>
                    <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700,
                      color: s.isWinner ? '#ffd700' : '#e2e8f0' }}>{s.fame}</span>
                    <span style={{ textAlign: 'right', fontSize: 9, color: '#8aa0c0',
                      fontFamily: "'Share Tech Mono', monospace" }}>👥{s.casuals} ♥{s.diehards}</span>
                    <span style={{ textAlign: 'right', fontSize: 10, color: s.lives > 0 ? '#e2e8f0' : '#5a3a3a' }}>
                      {s.lives > 0 ? '❤️'.repeat(Math.min(s.lives, 3)) : '💀'}
                    </span>
                    <span style={{ textAlign: 'right', fontSize: 10, color: '#c9a0ff' }}>{s.limelight}</span>
                  </div>
                  {/* 📊 match stats — riff-off note grades + cumulative battle totals */}
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: '2px 14px',
                    marginTop: 5, paddingLeft: 36, fontSize: 8, letterSpacing: 0.5,
                    color: '#5a7a9a', fontFamily: "'Share Tech Mono', monospace",
                  }}>
                    <span>
                      🎸 {riffTotal > 0
                        ? <>
                            <b style={{ color: '#44ff99' }}>✦{r.perfect}</b>{' '}
                            <b style={{ color: '#aaff44' }}>G{r.good}</b>{' '}
                            <b style={{ color: '#ffcc44' }}>OK{r.ok}</b>{' '}
                            <b style={{ color: '#ff4455' }}>✗{r.miss + r.wrong}</b>
                            <span style={{ color: '#3a5a7a' }}> /{riffTotal} notes</span>
                          </>
                        : <span style={{ color: '#3a5a7a' }}>no riff-offs</span>}
                    </span>
                    <span>
                      ⚔️ {battles > 0
                        ? <>
                            <b style={{ color: '#e2e8f0' }}>{s.battleW}W-{s.battleL}L</b>
                            <span style={{ color: '#3a5a7a' }}> · totals </span>
                            <b style={{ color: s.color }}>{s.battleFor}</b>
                            <span style={{ color: '#3a5a7a' }}> vs </span>
                            <b style={{ color: '#8aa0c0' }}>{s.battleAgainst}</b>
                          </>
                        : <span style={{ color: '#3a5a7a' }}>no battles</span>}
                    </span>
                  </div>
                </div>
              );
            })}

            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 8, color: '#4a5f80',
              letterSpacing: 1, fontFamily: "'Share Tech Mono', monospace" }}>
              👑 = ended the set holding the Headliner title
            </div>
          </div>

          <button onClick={onReturnToLobby} style={{
            fontFamily: "'Saira Stencil One', sans-serif", fontSize: 11, letterSpacing: 3,
            padding: '9px 26px', cursor: 'pointer', borderRadius: 8,
            background: '#0a1020cc', color: '#66e0ff', border: '2px solid #66e0ff',
            boxShadow: '0 0 14px #66e0ff44',
          }}>
            🚪 RETURN TO LOBBY
          </button>
        </div>
      )}
    </div>
  );
}
