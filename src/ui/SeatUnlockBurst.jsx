// =============================================================================
// ui/SeatUnlockBurst.jsx — 🔓 THE SEAT-UNLOCK MOMENT, on screen (2026-09-28)
// -----------------------------------------------------------------------------
// Alex: *"there should be a good dopamine 'hit' when the player unlocks the slot
// — thus also unlocking the amp stack build out. This moment is important."* He
// chose the full cinematic (~3 s). This is its 2D half — the flash, the slam-in
// title, the chord with its new note popping, the shockwave rings and a spray of
// notes. The 3D half (the cabinet drop, the push-in, the crowd jumping) is
// `board/arenaVisuals.js` SEAT_UNLOCK; the sound is `audio/unlockSfx.js`.
//
// `fx.short` (a bot's unlock) is a small banner at the top, no flash, and never
// blocks input. The full version holds the board for its length — a CLICK
// CATCHER, so a stray click mid-celebration cannot fire a move the player never
// saw; the keyboard handler stands down for the same window.
// Under prefers-reduced-motion nothing moves: the card simply appears.
// =============================================================================

const TEXT = {
  drive: { stack: 'DRIVE STACK', color: '#ff6644' },
  sustain: { stack: 'SUSTAIN STACK', color: '#44aaff' },
};

function seatUnlockReward(slot) {
  return slot >= 6 ? '🔥 THE WHOLE STACK LIGHTS UP' : `🔊 AMP CABINET ${slot - 2} JOINS THE STACK`;
}

export function SeatUnlockBurst({ fx }) {
  if (!fx) return null;
  const t = TEXT[fx.which] ?? TEXT.drive;
  const color = t.color;
  const dur = fx.short ? 1.3 : 2.9;
  const notes = fx.notes ?? [];
  const sparks = fx.short ? [] : Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
    const r = 34 + (i % 3) * 9;
    return { dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.7, glyph: i % 3 === 0 ? '♪' : i % 3 === 1 ? '♫' : '✦', delay: (i % 4) * 0.04 };
  });
  return (
    <div key={fx.key} data-seat-unlock={fx.slot} data-seat-unlock-short={fx.short ? 'true' : undefined}
      aria-live="polite" role="status"
      onClickCapture={fx.short ? undefined : e => { e.stopPropagation(); e.preventDefault(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 950, pointerEvents: fx.short ? 'none' : 'auto',
        display: 'flex', alignItems: fx.short ? 'flex-start' : 'center', justifyContent: 'center',
        overflow: 'hidden', animation: `su-out ${dur}s linear forwards` }}>
      <style>{`
        @keyframes su-out { 0%,86% { opacity:1 } 100% { opacity:0 } }
        @keyframes su-flash { 0% { opacity:0 } 8% { opacity:.62 } 100% { opacity:0 } }
        @keyframes su-slam { 0% { transform:scale(2.4); opacity:0; filter:blur(6px) } 14% { transform:scale(.94); opacity:1; filter:blur(0) }
                             20% { transform:scale(1.04) } 26%,100% { transform:scale(1) } }
        @keyframes su-shake { 0%,12% { transform:translate(0,0) } 14% { transform:translate(-7px,4px) } 17% { transform:translate(6px,-5px) }
                              20% { transform:translate(-4px,2px) } 24%,100% { transform:translate(0,0) } }
        @keyframes su-ring { 0% { transform:scale(.2); opacity:.9 } 100% { transform:scale(3.2); opacity:0 } }
        @keyframes su-pop { 0%,30% { transform:scale(0) rotate(-30deg); opacity:0 } 42% { transform:scale(1.55) rotate(8deg); opacity:1 }
                            52%,100% { transform:scale(1) rotate(0) } }
        @keyframes su-chip { 0% { transform:translateY(10px); opacity:0 } 100% { transform:translateY(0); opacity:1 } }
        @keyframes su-spark { 0% { transform:translate(0,0) scale(.4); opacity:0 } 12% { opacity:1 }
                              100% { transform:translate(var(--dx),var(--dy)) scale(1.1); opacity:0 } }
        @keyframes su-glow { 0%,100% { text-shadow:0 0 18px ${color}, 0 0 44px ${color}88 } 50% { text-shadow:0 0 28px ${color}, 0 0 80px ${color} } }
        @keyframes su-drop { 0% { transform:translateY(-120%); opacity:0 } 30% { transform:translateY(0); opacity:1 } 100% { transform:translateY(0) } }
        @media (prefers-reduced-motion: reduce) {
          [data-seat-unlock] *, [data-seat-unlock] { animation-duration:0s !important; animation-delay:0s !important }
        }
      `}</style>
      {!fx.short && <>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(circle at 50% 48%, ${color}cc 0%, ${color}44 28%, transparent 62%)`,
          animation: 'su-flash .9s ease-out forwards' }} />
        {[0, 0.18].map(d => (
          <div key={d} style={{ position: 'absolute', left: '50%', top: '48%', width: 220, height: 220, marginLeft: -110, marginTop: -110,
            borderRadius: '50%', border: `3px solid ${color}`, boxShadow: `0 0 24px ${color}`, pointerEvents: 'none',
            animation: `su-ring .95s ${d}s ease-out forwards`, opacity: 0 }} />
        ))}
        {sparks.map((s, i) => (
          <span key={i} style={{ position: 'absolute', left: '50%', top: '48%', fontSize: 26, color, pointerEvents: 'none',
            textShadow: `0 0 10px ${color}`, '--dx': `${s.dx}vw`, '--dy': `${s.dy}vh`, opacity: 0,
            animation: `su-spark 1.5s ${0.12 + s.delay}s cubic-bezier(.2,.8,.3,1) forwards` }}>{s.glyph}</span>
        ))}
      </>}
      <div style={{ animation: fx.short ? 'su-drop .5s ease-out forwards' : 'su-shake .9s linear', marginTop: fx.short ? 14 : 0 }}>
        <div style={{ textAlign: 'center', padding: fx.short ? '8px 18px' : '18px 34px 16px',
          background: 'linear-gradient(180deg,#0b1224f2,#060a16f2)', border: `2px solid ${color}`, borderRadius: 10,
          boxShadow: `0 0 0 1px #ffffff14 inset, 0 0 40px ${color}88, 0 18px 60px #000c`,
          animation: fx.short ? undefined : 'su-slam .9s cubic-bezier(.2,.9,.25,1.2) forwards',
          fontFamily: "'Share Tech Mono', monospace" }}>
          <div style={{ fontSize: fx.short ? 9 : 12, letterSpacing: 3, color: '#b8c8e0', fontWeight: 700 }}>
            {fx.name ? `${fx.name.toUpperCase()} · ` : ''}{t.stack}
          </div>
          <div style={{ fontSize: fx.short ? 20 : 46, fontWeight: 900, letterSpacing: fx.short ? 2 : 5, color: '#fff', lineHeight: 1.05,
            margin: fx.short ? '2px 0' : '6px 0 10px', animation: fx.short ? undefined : 'su-glow 1.2s ease-in-out infinite',
            textShadow: `0 0 18px ${color}` }}>
            🔓 SEAT {fx.slot} UNLOCKED
          </div>
          {!fx.short && notes.length > 0 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', margin: '4px 0 8px' }}>
              {notes.map((n, i) => {
                const isNew = i === notes.length - 1;
                return (
                  <span key={i} style={{ minWidth: 42, padding: '6px 8px', borderRadius: 7, fontSize: 20, fontWeight: 800,
                    color: isNew ? '#0b1224' : '#fff', background: isNew ? color : `${color}33`, border: `2px solid ${color}`,
                    boxShadow: isNew ? `0 0 22px ${color}, 0 0 44px ${color}88` : 'none', opacity: 0,
                    animation: isNew ? 'su-pop 1.1s ease-out forwards' : `su-chip .3s ${0.12 + i * 0.06}s ease-out forwards` }}>{n}</span>
                );
              })}
            </div>
          )}
          {!fx.short && fx.chord && (
            <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: 1, textShadow: `0 0 12px ${color}88` }}>{fx.chord}</div>
          )}
          <div style={{ fontSize: fx.short ? 9 : 13, marginTop: fx.short ? 0 : 8, color: '#ffe9a8', letterSpacing: 1.5, fontWeight: 700 }}>
            {seatUnlockReward(fx.slot)}
          </div>
        </div>
      </div>
    </div>
  );
}
