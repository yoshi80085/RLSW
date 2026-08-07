import { useEffect, useState } from "react";
import openingIsland from "../assets/opening_island.png";
import { RIFF_FALL_DIFFICULTY, RIFF_FALL_DEFAULT } from "../riff/fallingNotes.js";

// ─── 🎸 RIFF MODE ────────────────────────────────────────────────────────────
// Everything that trains your hands, gathered in one place off the title menu.
// Four rooms, all of them solo:
//   Riff Practice   — the falling-note stream from a real riff-off, endless
//   Fretboard Recon — find the note on the neck
//   Discord Coach   — tension and resolution
//   Legend Lessons  — play like the greats
//
// The difficulty picker lives here too, because it's the one setting all of
// these share, and it's the same persisted key the live riff-off reads.
//
// Same visual language as TitleMenu (island behind, options on the left) so
// stepping in doesn't feel like landing in a different game.

const RIFF_DIFF_SHORT = {
  rookie: 'INFLUENCER', gigging: 'GIGGING', shredder: 'SHREDDER', virtuoso: 'VIRTUOSO',
};

// ─── 🔒 PLAYTEST GATE ────────────────────────────────────────────────────────
// Which rooms are actually ready to be sat in front of a tester. Anything not
// listed here still EXISTS and still works — it's just hidden behind a lock so
// a playtest session can't wander into a half-finished mode and spend its
// feedback on bugs we already know about.
//
// This is a testing gate, NOT a design decision. To reopen a room, add its id
// back to the set — that's the whole change, nothing else is conditional on it.
// To close the gate entirely once everything is ready, set it to `null`.
// 🗣️ 'riff' reopened 2026-08-06: Riff Practice is the only place Call & Answer
// can be practised, and derivation is a LEARNED skill — unlike sight-reading you
// cannot brute-force "mirror it around the root" on your first attempt. Leaving
// the room locked would ship the mechanic with no on-ramp.
const RIFF_MODES_UNLOCKED = new Set(['fretboard', 'riff']);
const RIFF_LOCK_NOTE = 'IN THE WORKSHOP';

function isLocked(id) {
  return RIFF_MODES_UNLOCKED != null && !RIFF_MODES_UNLOCKED.has(id);
}

export default function RiffMenu({ onPractice, onBack }) {
  const [riffDiff, setRiffDiff] = useState(() => {
    try {
      const v = localStorage.getItem('rlsw.riffDifficulty');
      if (v && RIFF_FALL_DIFFICULTY[v]) return v;
    } catch { /* storage disabled — fall through to the default */ }
    return RIFF_FALL_DEFAULT;
  });
  function pickRiffDiff(k) {
    setRiffDiff(k);
    try { localStorage.setItem('rlsw.riffDifficulty', k); } catch { /* storage disabled — the choice just won't persist */ }
  }

  // Fretboard Recon leads now — it's the one room that's open, and a locked
  // item sitting above the only playable one reads as a broken menu.
  const ITEMS = [
    {
      id: 'fretboard', label: 'FRETBOARD RECON', icon: '🗺️', color: '#19e6ff',
      blurb: 'Find any note anywhere on the neck. The groundwork everything else sits on.',
      go: () => onPractice({ mode: 'fretboard' }),
    },
    {
      id: 'riff', label: 'RIFF PRACTICE', icon: '🎸', color: '#f6ad55',
      blurb: 'The riff-off, endless. Read the notes off the neck — or switch to 🗣️ Call & Answer and work out the reply instead.',
      go: () => onPractice({ mode: 'riff', diff: riffDiff }),
    },
    {
      id: 'discord', label: 'DISCORD COACH', icon: '🎩', color: '#ff2d95',
      blurb: 'Tension and resolution — learn which wrong notes are actually right.',
      go: () => onPractice({ mode: 'discord' }),
    },
    {
      id: 'legend', label: 'LEGEND LESSONS', icon: '⭐', color: '#ffd700',
      blurb: 'Sound like the greats. Their moves, broken down and put in your hands.',
      go: () => onPractice({ mode: 'legend' }),
    },
  ].map(it => isLocked(it.id)
    ? { ...it, locked: true, go: () => {}, blurb: `${it.blurb}  —  🔒 ${RIFF_LOCK_NOTE}: not ready for testing yet.` }
    : it);

  const [cursor, setCursor] = useState(0);

  // 🔒 Keyboard nav STEPS OVER locked rooms rather than stopping on them. A
  // cursor that parks on a dead entry and eats the Enter key feels like the menu
  // is broken; skipping means the arrows only ever land somewhere that works.
  // (Mouse hover can still rest on a locked row so its blurb explains the lock.)
  const step = (from, dir) => {
    for (let i = 1; i <= ITEMS.length; i++) {
      const idx = (from + dir * i + ITEMS.length * i) % ITEMS.length;
      if (!ITEMS[idx]?.locked) return idx;
    }
    return from; // everything locked — don't trap the cursor in an infinite hop
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onBack(); }
      else if (e.key === 'ArrowDown' || e.key === 's') { e.preventDefault(); setCursor(c => step(c, 1)); }
      else if (e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); setCursor(c => step(c, -1)); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!ITEMS[cursor]?.locked) ITEMS[cursor]?.go(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cursor, onBack]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = ITEMS[cursor];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#03060e', overflow: 'hidden',
      fontFamily: "'Share Tech Mono', monospace", display: 'flex',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Saira+Stencil+One&family=Saira:wght@400;600;700&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes rm-float { 0%,100% { transform: translateY(0) scale(1.02); }
                              50%     { transform: translateY(-14px) scale(1.03); } }
        @keyframes rm-in    { from { opacity: 0; transform: translateX(-16px); }
                              to   { opacity: 1; transform: none; } }
        @keyframes rm-cursor{ 0%,100% { opacity: 1; transform: translateX(0); }
                              50%     { opacity: .55; transform: translateX(-4px); } }
      `}</style>

      {/* Island, pushed cooler and further back than the title screen so the
          two menus read as different rooms in the same building. */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, animation: 'rm-float 13s ease-in-out infinite' }}>
          <img src={openingIsland} alt="" draggable={false} style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: '58% 46%',
            filter: 'hue-rotate(-18deg) saturate(0.85) brightness(0.8)',
          }}/>
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, #03060ef5 0%, #03060ee6 28%, #03060e88 48%, #03060e11 70%)',
        }}/>
      </div>

      <div style={{
        position: 'relative', zIndex: 2,
        width: 'min(600px, 62vw)', minWidth: 320,
        padding: 'clamp(28px, 5vh, 64px) clamp(24px, 4vw, 62px)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <button onClick={onBack} style={{
          alignSelf: 'flex-start', marginBottom: 18, fontFamily: 'inherit', cursor: 'pointer',
          background: '#0a1020', border: '1px solid #2a4a6a', borderRadius: 4,
          color: '#5a8aaa', fontSize: 9, padding: '6px 14px', letterSpacing: 1,
          animation: 'rm-in 500ms ease-out both',
        }}>← MAIN MENU</button>

        <div style={{
          fontFamily: "'Saira Stencil One', sans-serif",
          fontSize: 'clamp(28px, 4.4vw, 54px)', lineHeight: 1,
          color: '#19e6ff', letterSpacing: 7,
          textShadow: '0 0 30px #19e6ff55, 0 4px 0 #00000088',
          animation: 'rm-in 620ms ease-out 80ms both',
        }}>RIFF MODE</div>
        <div style={{
          fontSize: 'clamp(8.5px, 1vw, 11px)', letterSpacing: 5, color: '#7a9ec0',
          marginTop: 7, marginBottom: 'clamp(18px, 3.4vh, 38px)',
          animation: 'rm-in 620ms ease-out 180ms both',
        }}>TRAIN YOUR HANDS</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ITEMS.map((it, i) => {
            const on   = i === cursor;
            const lock = !!it.locked;
            return (
              <div key={it.id}
                onMouseEnter={() => setCursor(i)}
                onClick={() => { if (!lock) it.go(); }}
                title={it.blurb}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '9px 12px 9px 6px', borderRadius: 6,
                  cursor: lock ? 'not-allowed' : 'pointer',
                  // A locked room still lights up faintly on hover — it has to
                  // acknowledge the pointer or it reads as an unresponsive UI
                  // rather than a closed door.
                  background: on ? (lock ? '#ffffff08' : `${it.color}0e`) : 'transparent',
                  borderLeft: `3px solid ${on ? (lock ? '#3a4a5a' : it.color) : 'transparent'}`,
                  transition: 'background .16s, border-color .16s',
                  animation: `rm-in 500ms ease-out ${260 + i * 80}ms both`,
                }}>
                <span style={{
                  width: 16, textAlign: 'center', flexShrink: 0,
                  color: lock ? '#4a5a6a' : it.color, fontSize: lock ? 12 : 15,
                  opacity: lock ? (on ? 0.9 : 0.5) : (on ? 1 : 0),
                  animation: (on && !lock) ? 'rm-cursor 1s ease-in-out infinite' : 'none',
                  filter: lock ? 'none' : `drop-shadow(0 0 6px ${it.color})`,
                }}>{lock ? '🔒' : '▶'}</span>
                <span style={{ fontSize: 17, flexShrink: 0, filter: lock ? 'grayscale(1)' : 'none', opacity: lock ? 0.45 : 1 }}>{it.icon}</span>
                <span style={{
                  fontFamily: "'Saira Stencil One', sans-serif",
                  fontSize: 'clamp(13px, 1.55vw, 19px)', letterSpacing: 2.5,
                  color: lock ? '#5a6a7a' : (on ? it.color : '#a8c2da'),
                  textShadow: (on && !lock) ? `0 0 16px ${it.color}88` : 'none',
                  transition: 'color .16s, text-shadow .16s', whiteSpace: 'nowrap',
                }}>{it.label}</span>
                {lock && (
                  <span style={{
                    fontSize: 7.5, letterSpacing: 1.6, color: '#4a6a8a',
                    border: '1px solid #24384e', borderRadius: 3, padding: '2px 6px',
                    flexShrink: 0, whiteSpace: 'nowrap',
                  }}>{RIFF_LOCK_NOTE}</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{
          marginTop: 'clamp(14px, 2.6vh, 26px)', minHeight: 32,
          paddingLeft: 21, borderLeft: '1px solid #1a2a40',
          fontSize: 'clamp(9px, 1vw, 11.5px)', lineHeight: 1.7, color: '#93b2cd',
          animation: 'rm-in 600ms ease-out 620ms both',
        }}>{active?.blurb}</div>

        {/* Shared difficulty — the same persisted key the live riff-off reads,
            so tuning it here also tunes duels in a real match. */}
        <div style={{
          marginTop: 'clamp(16px, 3vh, 30px)', paddingTop: 16, borderTop: '1px solid #1a2a40',
          animation: 'rm-in 600ms ease-out 720ms both',
        }}>
          {/* Kept live even while Riff Practice is locked: this is the same
              persisted key the IN-MATCH riff-off reads, so it's still the only
              place to tune duel difficulty for a playtest. The label changes to
              say so — otherwise it looks like a setting for a room you can't
              get into. */}
          <div style={{ fontSize: 8, color: '#3a5a7a', letterSpacing: 2, marginBottom: 8 }}>
            🎸 DIFFICULTY — {isLocked('riff')
              ? 'applies to riff-offs in a real match'
              : 'also applies to riff-offs in a real match'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(RIFF_FALL_DIFFICULTY).map(([k, p]) => {
              const on = riffDiff === k;
              return (
                <button key={k} onClick={() => pickRiffDiff(k)} title={`${p.label} — ${p.blurb}`}
                  style={{
                    fontFamily: "'Saira Stencil One', sans-serif", cursor: 'pointer',
                    borderRadius: 4, padding: '6px 11px', fontSize: 9, letterSpacing: 1,
                    border: '1px solid', transition: 'all .15s',
                    background: on ? '#f6ad5522' : '#0a1020',
                    borderColor: on ? '#f6ad55' : '#1e3a5f',
                    color: on ? '#f6ad55' : '#5a7a9a',
                  }}>{p.icon} {RIFF_DIFF_SHORT[k] ?? k.toUpperCase()}</button>
              );
            })}
          </div>
        </div>

        <div style={{
          marginTop: 'clamp(12px, 2.2vh, 22px)', fontSize: 8.5, letterSpacing: 2, color: '#3a5a7a',
          animation: 'rm-in 600ms ease-out 840ms both',
        }}>↑ ↓ SELECT · ENTER CONFIRM · ESC BACK</div>
      </div>
    </div>
  );
}
