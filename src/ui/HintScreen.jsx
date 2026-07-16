import React, { useEffect, useRef, useState } from "react";

// ─── 💡 HINT SCREEN ──────────────────────────────────────────────────────────
// Intentional ~5s "loading" beat between the Lobby and the Game so a gameplay
// hint can be read. Pure presentation: no engine imports, no game state.
// The owner edits ONLY the HINTS array — one string per hint, shown at random.

const HINT_MS = 5000;   // how long the screen holds before the game mounts

// ── 💡 HINTS — keep each one readable in ~5 seconds. Written against CURRENT
// rules (see BEGINNER_TIPS in the simulator) — if a system changes, update
// the hint too. Don't let a hint lie.
export const HINTS = [
  "Notes IN your scale are clean — they earn HC and keep the crowd happy. Off-scale notes are DISCORD.",
  "Every melody note you commit = 1 hex of movement. Long tracks travel far, but risk discords.",
  "Your LAST committed note becomes next turn's Root Note. Plan the ending, not just the riff.",
  "Fill your HC bar to open the Theory Tree and pick new skills — in-scale notes are the fuel.",
  "Every Swing burns the first 2 notes off your Chord Stack. Keep the stack fed.",
  "A 5-note chord walking into a fight is a very different conversation than a 1-note one.",
  "SMASH ignores Sustain but leaves you Exposed. Commit issues, in weapon form.",
  "Sonic Attacks need an amp in range — and more amps in range roll meaner dice.",
  "Fans never pay FP directly — they MULTIPLY everything you earn, up to ×2 with a full house.",
  "Commit clean tracks near the centre rings to draw a crowd. The back row pays zero.",
  "Ending a track on a MAJOR 3rd cleanses status effects. Free medicine for good taste.",
  "The TRITONE doubles your damage and can set rivals on fire. The devil's interval knows what it is.",
  "Cadence hints in your Note Stock show exactly which final note pays bonus FP. Take the hint.",
  "Your 🔄 Transpose card swaps a bad Root Note — one use per game. Save it. Or don't. Your funeral.",
  "Rivals can walk up and UNPLUG your amps. A Roadie replugs them — guard the rig.",
  "End on your Root, 3rd, or 5th to resolve the Dissonance Edge before it collapses on you.",
  "Retreating to heal isn't cowardice — it's set management.",
  "Attacks fire into the cone or beam you're FACING. Sneaking behind someone is rude. And tactics.",
  "Some note patterns are legendary RIFFS — first discovery writes them into the Riffbook and pays FP.",
  "Get knocked down and 7–10 casual fans flee on the spot — a couple straight to whoever flattened you.",
];

export default function HintScreen({ onDone }) {
  // Pick one hint per mount — stable across re-renders.
  const [hint] = useState(() => HINTS[Math.floor(Math.random() * HINTS.length)]);
  const doneRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!doneRef.current) { doneRef.current = true; onDone(); }
    }, HINT_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#050810', zIndex: 60,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Share Tech Mono', monospace",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700&display=swap" rel="stylesheet"/>
      <style>{`
        @keyframes hint-card-in { from { opacity: 0; transform: translateY(10px); }
                                  to   { opacity: 1; transform: none; } }
        @keyframes hint-bar-fill { from { width: 0%; } to { width: 100%; } }
        @keyframes hint-amp-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
      `}</style>

      {/* header */}
      <div style={{
        fontFamily: "'Orbitron', sans-serif", fontWeight: 700,
        fontSize: 'clamp(20px, 3.4vw, 34px)', letterSpacing: 8, color: '#f6ad55',
        textShadow: '0 0 24px #f6ad5566', marginBottom: 8,
        animation: 'hint-card-in 500ms ease-out',
      }}>⚡ RLSW</div>
      <div style={{
        fontSize: 11, letterSpacing: 4, color: '#5a7a9a', marginBottom: '7vh',
        animation: 'hint-amp-pulse 1.6s ease-in-out infinite',
      }}>WARMING UP THE AMPS…</div>

      {/* hint card */}
      <div style={{
        width: 'min(560px, 88vw)',
        background: 'linear-gradient(180deg,#0e1828,#080f1e)',
        border: '1.5px solid #f6ad55', borderRadius: 12,
        padding: '20px 24px 18px',
        boxShadow: '0 0 40px #f6ad5522, 0 8px 32px #000000cc',
        animation: 'hint-card-in 500ms ease-out 200ms both',
      }}>
        <div style={{
          fontFamily: "'Orbitron', sans-serif", fontSize: 11, color: '#ff66cc',
          letterSpacing: 3, marginBottom: 12, textShadow: '0 0 10px #ff66cc55',
        }}>💡 ROADIE'S HINT</div>
        <div style={{ fontSize: 13, color: '#c0d0e0', lineHeight: 1.75 }}>{hint}</div>
      </div>

      {/* loading bar — fills over the full hold */}
      <div style={{
        width: 'min(560px, 88vw)', height: 4, marginTop: 26,
        background: '#101a30', borderRadius: 2, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', background: 'linear-gradient(90deg,#f6ad55,#ff66cc)',
          boxShadow: '0 0 8px #f6ad55aa',
          animation: `hint-bar-fill ${HINT_MS}ms linear forwards`,
        }}/>
      </div>
      <div style={{ fontSize: 9, letterSpacing: 2, color: '#3a5a7a', marginTop: 10 }}>
        TAKING THE STAGE…
      </div>
    </div>
  );
}
