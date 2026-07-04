// =============================================================================
// ui/EventModal.jsx  —  ROCK TRIVIA card (replaces the old dice-roll events).
// Presentational: all values/handlers via props, zero app imports.
// activeEvent shape: { spiritId, q, phase:'question'|'result', chosen, correct, reward }
//   q = { id, era, difficulty, topic, question, options[4], answer, sauce }
// =============================================================================
import React from "react";

const DIFF_COLOR = { easy: "#44cc88", medium: "#ffcc44", hard: "#ff6644" };
const OPT_LETTER = ["A", "B", "C", "D"];

export function EventModal({ activeEvent, answerTrivia, setActiveEvent, spirits }) {
  if (!activeEvent || !activeEvent.q) return null;
  const { q, phase, chosen, correct, reward } = activeEvent;
  const accent = DIFF_COLOR[q.difficulty] || "#ffcc44";
  const spirit = spirits.find(s => s.id === activeEvent.spiritId);
  const isResult = phase === "result";

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000000d8", zIndex: 9990,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "linear-gradient(165deg, #0c0818 0%, #080f1e 55%, #050810 100%)",
        border: `2px solid ${accent}`, borderRadius: 12, padding: 0,
        maxWidth: 420, width: "94%", overflow: "hidden",
        boxShadow: `0 0 40px ${accent}55, inset 0 0 60px ${accent}0c`,
        animation: "eventTicketIn .35s cubic-bezier(.2,1.4,.4,1)",
      }}>
        {/* Marquee strip */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "6px 0", borderBottom: `1px solid ${accent}55`,
          background: `linear-gradient(90deg, transparent, ${accent}1e, transparent)`,
        }}>
          {[...Array(9)].map((_, i) => (
            <span key={i} style={{
              width: 5, height: 5, borderRadius: "50%", background: accent,
              opacity: .85, animation: `marqueeBlink 1.1s ${i * 0.12}s ease-in-out infinite`,
            }} />
          ))}
        </div>

        <div style={{ padding: "16px 22px 20px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 26, marginBottom: 4, filter: `drop-shadow(0 0 12px ${accent})` }}>🎤</div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 14, color: accent,
              letterSpacing: 3, textShadow: `0 0 14px ${accent}aa`,
            }}>ROCK TRIVIA</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 8, color: "#7da0bf", letterSpacing: 1 }}>{q.era}</span>
              <span style={{
                fontSize: 7, letterSpacing: 1, color: accent, fontWeight: 700,
                border: `1px solid ${accent}66`, borderRadius: 3, padding: "1px 6px",
                textTransform: "uppercase",
              }}>{q.difficulty}</span>
            </div>
            <div style={{ fontSize: 8, color: "#3a5a7a", letterSpacing: 1, marginTop: 6 }}>
              for <span style={{ color: spirit?.color }}>{spirit?.name?.toUpperCase()}</span>
            </div>
          </div>

          {/* Question */}
          <div style={{
            fontSize: 11.5, color: "#e8eef8", lineHeight: 1.5, textAlign: "center",
            marginBottom: 14, padding: "0 4px", fontWeight: 600,
          }}>{q.question}</div>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
            {q.options.map((opt, i) => {
              const isAnswer = i === q.answer;
              const isChosen = i === chosen;
              let border = "#22344e", bg = "#0a1322", color = "#c0d0e0";
              if (isResult) {
                if (isAnswer) { border = "#44cc88"; bg = "#0c2417"; color = "#9affc4"; }
                else if (isChosen) { border = "#ff5555"; bg = "#220c0c"; color = "#ff9c9c"; }
                else { color = "#5a7088"; }
              }
              return (
                <button key={i}
                  onClick={() => { if (!isResult) answerTrivia(i); }}
                  disabled={isResult}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    textAlign: "left", cursor: isResult ? "default" : "pointer",
                    fontFamily: "inherit", fontSize: 10.5, color, lineHeight: 1.4,
                    background: bg, border: `1.5px solid ${border}`, borderRadius: 7,
                    padding: "9px 12px", transition: "all .12s",
                  }}
                  onMouseEnter={e => { if (!isResult) { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = "#101c30"; } }}
                  onMouseLeave={e => { if (!isResult) { e.currentTarget.style.borderColor = "#22344e"; e.currentTarget.style.background = "#0a1322"; } }}
                >
                  <span style={{
                    flexShrink: 0, width: 18, height: 18, borderRadius: 4, fontSize: 9, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `1px solid ${isResult && isAnswer ? "#44cc88" : isResult && isChosen ? "#ff5555" : "#3a5a7a"}`,
                    color: isResult && isAnswer ? "#44cc88" : isResult && isChosen ? "#ff5555" : "#7da0bf",
                  }}>{isResult && isAnswer ? "✓" : isResult && isChosen ? "✕" : OPT_LETTER[i]}</span>
                  <span style={{ flex: 1 }}>{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Result: reward banner + sauce + close */}
          {isResult && (
            <>
              <div style={{
                textAlign: "center", fontFamily: "'Orbitron',sans-serif", fontSize: 12, letterSpacing: 1,
                color: correct ? "#44cc88" : "#ff7766", marginBottom: 10,
                textShadow: `0 0 12px ${correct ? "#44cc88" : "#ff7766"}77`,
              }}>
                {correct ? `✓ CORRECT — +${reward} Fans` : "✕ NO BONUS — the crowd forgives you"}
              </div>
              <div style={{
                fontSize: 9.5, color: "#bcd0e4", lineHeight: 1.55, textAlign: "left",
                background: "#0a1020", border: `1px solid ${accent}44`, borderRadius: 6,
                padding: "9px 12px", marginBottom: 16,
              }}>
                <span style={{ color: accent, fontWeight: 700 }}>💡 </span>{q.sauce}
              </div>
              <div style={{ textAlign: "center" }}>
                <button onClick={() => setActiveEvent(null)}
                  style={{
                    fontFamily: "'Orbitron',sans-serif", fontSize: 11, letterSpacing: 2, cursor: "pointer",
                    padding: "8px 28px", borderRadius: 6, color: accent, fontWeight: 700,
                    background: "transparent", border: `1.5px solid ${accent}`,
                  }}>🤘 ROCK ON</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
