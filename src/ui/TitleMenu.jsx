import { useEffect, useRef, useState } from "react";
import openingIsland from "../assets/opening_island.png";
import menuSong3 from "../Menu_song_3.mp3";

// ─── 🏝️ TITLE MENU ───────────────────────────────────────────────────────────
// The Zelda-style front door: the floating island holds the whole frame while a
// short column of options sits down one side. Everything the game can do is
// reachable from here — Normal Mode drops into the existing lobby, Riff Mode
// opens the trainer menu, and so on.
//
// The layout follows the old Zelda file-select convention deliberately: one
// enormous piece of art doing the emotional work, a small stack of plain text
// options doing the navigation, and no chrome competing with either. Keyboard
// (↑/↓/Enter) works alongside the mouse because a menu that's only clickable
// feels like a web page, not a game.
//
// Pure presentation: it takes callbacks and renders. No engine imports.

const ISLAND_FALLBACK_TIP = "Pick a mode to get started.";

export default function TitleMenu({
  onNormal, onRiff, onRockGod, onTestingGrounds, onHowToPlay,
}) {
  const ITEMS = [
    {
      id: 'normal', label: 'NORMAL MODE', icon: '⚡', color: '#f6ad55',
      blurb: 'The full board game. Build melodies, work the crowd, take the stage.',
      onSelect: onNormal,
    },
    {
      id: 'riff', label: 'RIFF MODE', icon: '🎸', color: '#19e6ff',
      blurb: 'Practice grounds — riffs, the fretboard, discord, and the legends.',
      onSelect: onRiff,
    },
    {
      // Locked until the mode exists. Passing an `onRockGod` handler is all it
      // takes to light it up — no other change needed here.
      id: 'rockgod', label: 'ROCK GOD CHALLENGE', icon: '👁️', color: '#ff44dd',
      blurb: onRockGod
        ? 'Face the Rock God. One boss, no allies, nowhere to hide.'
        : 'Still being built. The God is not ready to receive you.',
      locked: !onRockGod,
      onSelect: onRockGod,
    },
    {
      id: 'testing', label: 'TESTING GROUNDS', icon: '🧪', color: '#cc66ff',
      blurb: 'Sandbox. Skip setup, drop straight onto the board with dev tools on.',
      onSelect: onTestingGrounds,
    },
    {
      id: 'howto', label: 'HOW TO PLAY', icon: '📖', color: '#44cc88',
      blurb: 'The illustrated rulebook, front to back.',
      onSelect: onHowToPlay,
    },
  ];

  const [cursor, setCursor] = useState(0);
  const [leaving, setLeaving] = useState(null);
  const audioRef = useRef(null);
  const rootRef = useRef(null);

  // ── Menu music ──
  useEffect(() => {
    const a = new Audio(menuSong3);
    a.loop = true; a.volume = 0.4;
    a.play().catch(() => {});   // blocked until first gesture on some browsers; harmless
    audioRef.current = a;
    return () => { a.pause(); audioRef.current = null; };
  }, []);

  function choose(i) {
    const item = ITEMS[i];
    if (!item || item.locked || !item.onSelect) return;
    setLeaving(item.id);
    // Let the flash land before the screen swaps — a menu that vanishes the
    // instant you click feels unresponsive, oddly enough.
    setTimeout(() => item.onSelect(), 190);
  }

  // ── Keyboard: ↑/↓ to move, Enter/Space to pick ──
  useEffect(() => {
    const onKey = (e) => {
      if (leaving) return;
      if (e.key === 'ArrowDown' || e.key === 's') {
        e.preventDefault(); setCursor(c => (c + 1) % ITEMS.length);
      } else if (e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault(); setCursor(c => (c - 1 + ITEMS.length) % ITEMS.length);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); choose(cursor);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cursor, leaving]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = ITEMS[cursor];

  return (
    <div ref={rootRef} style={{
      position: 'fixed', inset: 0, background: '#03060e', overflow: 'hidden',
      fontFamily: "'Share Tech Mono', monospace",
      display: 'flex', alignItems: 'stretch',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Saira+Stencil+One&family=Saira:wght@400;600;700&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes tm-island-float { 0%,100% { transform: translateY(0) scale(1); }
                                     50%     { transform: translateY(-18px) scale(1.012); } }
        @keyframes tm-in          { from { opacity: 0; transform: translateX(-18px); }
                                    to   { opacity: 1; transform: none; } }
        @keyframes tm-title-in    { from { opacity: 0; letter-spacing: 22px; filter: blur(6px); }
                                    to   { opacity: 1; letter-spacing: 9px;  filter: none; } }
        @keyframes tm-cursor      { 0%,100% { opacity: 1; transform: translateX(0); }
                                    50%     { opacity: .55; transform: translateX(-4px); } }
        @keyframes tm-glow        { 0%,100% { opacity: .35; } 50% { opacity: .75; } }
        @keyframes tm-flash       { 0% { background: transparent; } 22% { background: #ffffffcc; }
                                    100% { background: transparent; } }
        .tm-item:hover .tm-label { color: #ffffff !important; }
      `}</style>

      {/* ══ THE ISLAND — the whole point of the screen ══ */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', inset: 0,
          animation: 'tm-island-float 11s ease-in-out infinite', willChange: 'transform',
        }}>
          <img src={openingIsland} alt="" draggable={false} style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: '62% 42%',
          }}/>
          {/* chromatic fringe — the same trick the opening movie uses, gentler */}
          <img src={openingIsland} alt="" draggable={false} style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: '62% 42%',
            transform: 'translateX(2px)', filter: 'hue-rotate(-60deg) saturate(3)',
            mixBlendMode: 'screen', opacity: 0.10,
          }}/>
        </div>
        {/* Left-hand scrim so the option text always has something to sit on,
            whatever the art is doing underneath it. */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, #03060ef2 0%, #03060ee0 26%, #03060e77 46%, #03060e00 66%)',
        }}/>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, #03060ecc 0%, transparent 26%, transparent 70%, #03060edd 100%)',
        }}/>
      </div>

      {/* ══ OPTIONS COLUMN ══ */}
      <div style={{
        position: 'relative', zIndex: 2,
        width: 'min(560px, 58vw)', minWidth: 320,
        padding: 'clamp(28px, 5vh, 64px) clamp(24px, 4vw, 62px)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0,
      }}>
        {/* Wordmark */}
        <div style={{ marginBottom: 'clamp(20px, 4vh, 44px)' }}>
          <div style={{
            fontFamily: "'Saira Stencil One', sans-serif",
            fontSize: 'clamp(38px, 6.2vw, 78px)', lineHeight: 1,
            color: '#f6ad55', letterSpacing: 9,
            textShadow: '0 0 30px #f6ad5566, 0 0 70px #ff44dd33, 0 4px 0 #00000088',
            animation: 'tm-title-in 900ms cubic-bezier(.16,1,.3,1) both',
          }}>RLSW</div>
          <div style={{
            fontSize: 'clamp(9px, 1.1vw, 12px)', letterSpacing: 'clamp(4px, 0.9vw, 11px)',
            color: '#7a9ec0', marginTop: 8,
            animation: 'tm-in 700ms ease-out 260ms both',
          }}>ROCK  LEGENDS  ·  SPIRIT  WARS</div>
        </div>

        {/* Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ITEMS.map((it, i) => {
            const on = i === cursor;
            const dim = it.locked;
            return (
              <div key={it.id} className="tm-item"
                onMouseEnter={() => !leaving && setCursor(i)}
                onClick={() => choose(i)}
                title={it.locked ? `${it.label} — not built out yet.` : it.blurb}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 12px 9px 6px', borderRadius: 6,
                  cursor: dim ? 'not-allowed' : 'pointer',
                  background: on && !dim ? `${it.color}0e` : 'transparent',
                  borderLeft: `3px solid ${on && !dim ? it.color : 'transparent'}`,
                  transition: 'background .16s, border-color .16s',
                  animation: `tm-in 520ms ease-out ${340 + i * 85}ms both`,
                  opacity: dim ? 0.42 : 1,
                }}>
                {/* cursor caret */}
                <span style={{
                  width: 16, textAlign: 'center', flexShrink: 0,
                  color: it.color, fontSize: 15,
                  opacity: on ? 1 : 0,
                  animation: on ? 'tm-cursor 1s ease-in-out infinite' : 'none',
                  filter: `drop-shadow(0 0 6px ${it.color})`,
                }}>▶</span>
                <span style={{ fontSize: 17, flexShrink: 0, filter: dim ? 'grayscale(1)' : 'none' }}>{it.icon}</span>
                <span className="tm-label" style={{
                  fontFamily: "'Saira Stencil One', sans-serif",
                  fontSize: 'clamp(14px, 1.7vw, 21px)',
                  letterSpacing: 2.5,
                  color: dim ? '#4a6a86' : on ? it.color : '#a8c2da',
                  textShadow: on && !dim ? `0 0 16px ${it.color}88` : 'none',
                  transition: 'color .16s, text-shadow .16s',
                  whiteSpace: 'nowrap',
                }}>{it.label}</span>
                {it.locked && (
                  <span style={{
                    fontSize: 8, letterSpacing: 1.5, color: '#5a7a9a',
                    border: '1px solid #2a4a6a', borderRadius: 3,
                    padding: '2px 6px', marginLeft: 2, whiteSpace: 'nowrap',
                  }}>🔒 IN DEVELOPMENT</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Blurb for whatever the cursor is on — one line, no layout jump */}
        <div style={{
          marginTop: 'clamp(16px, 3vh, 30px)', minHeight: 34,
          paddingLeft: 21, borderLeft: '1px solid #1a2a40',
          fontSize: 'clamp(9px, 1vw, 11.5px)', lineHeight: 1.7,
          color: active?.locked ? '#5a7a9a' : '#93b2cd',
          animation: 'tm-in 600ms ease-out 700ms both',
        }}>{active?.blurb ?? ISLAND_FALLBACK_TIP}</div>

        <div style={{
          marginTop: 'clamp(12px, 2.4vh, 26px)', fontSize: 8.5, letterSpacing: 2,
          color: '#3a5a7a', animation: 'tm-in 600ms ease-out 900ms both',
        }}>↑ ↓ SELECT · ENTER CONFIRM</div>
      </div>

      {/* White flash on confirm */}
      {leaving && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 30, pointerEvents: 'none',
          animation: 'tm-flash 260ms ease-out forwards',
        }}/>
      )}
    </div>
  );
}
