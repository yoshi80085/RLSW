// =============================================================================
// ui/EventModal.jsx  —  the MARQUEE TICKET (MARQUEE_QUIZ_DESIGN.md §10).
// Presentational: all values/handlers via props, zero app imports.
//
// Since 2026-09-29 every marquee is the same (Alex): no lane, no difficulty to
// pick. One question; a correct answer wins ONE random prize card for battle.
//
// Phases, in order:
//   'question' — the drawn question, four options
//   'swap'     — correct, but the hand is full: swap a card out or let it go
//   'result'   — the sauce, and the card (or nothing)
//
// activeEvent: { spiritId, hexNum, q, phase, chosen, correct, prize, kept }
//   q     = { id, era, difficulty, topic, question, options[4], answer, sauce }
//   prize = the card id drawn for a correct answer (drawn up front, shown only
//           when won)
// prizeCard / hand: card defs from `engine/systems/marqueeCards.js`, passed in.
// =============================================================================
import React from "react";

const OPT_LETTER = ["A", "B", "C", "D"];
const ACCENT = "#ff44dd";            // the marquee's own neon (the board's star)
const CARD_GOLD = "#ffcc44";

/** One prize card — also used by the hand in the action rail. */
export function MarqueeCardFace({ card, small = false, armed = false, dim = false }) {
  if (!card) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: small ? 6 : 10,
      padding: small ? "5px 8px" : "10px 14px", borderRadius: 8,
      background: armed ? "#2a1c06" : "linear-gradient(160deg,#1a1030,#0c0818)",
      border: `1.5px solid ${armed ? CARD_GOLD : CARD_GOLD + "88"}`,
      boxShadow: armed ? `0 0 14px ${CARD_GOLD}88` : "none",
      opacity: dim ? 0.45 : 1, textAlign: "left",
    }}>
      <span style={{ fontSize: small ? 14 : 24, filter: `drop-shadow(0 0 6px ${CARD_GOLD})` }}>{card.icon}</span>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.35 }}>
        <span style={{ fontFamily: "'Saira Stencil One',sans-serif", letterSpacing: 1,
          fontSize: small ? 9.5 : 13, color: CARD_GOLD }}>{card.name.toUpperCase()}</span>
        {!small && <span style={{ fontSize: 9.5, color: "#c8d6e6" }}>{card.text}</span>}
      </span>
    </div>
  );
}

export function EventModal({ activeEvent, answerTrivia, keepPrize, setActiveEvent, spirits,
                             prizeCard, hand = [] }) {
  if (!activeEvent?.q) return null;
  const { q, phase, chosen, correct, kept } = activeEvent;
  const spirit = spirits.find(s => s.id === activeEvent.spiritId);
  const isQuestion = phase === "question";
  const isSwap = phase === "swap";
  const isResult = phase === "result";
  const revealed = !isQuestion;

  const btn = (color) => ({
    fontFamily: "'Saira Stencil One',sans-serif", fontSize: 11, letterSpacing: 2, cursor: "pointer",
    padding: "8px 22px", borderRadius: 6, color, fontWeight: 700,
    background: "transparent", border: `1.5px solid ${color}`,
  });

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000000d8", zIndex: 9990,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "linear-gradient(165deg, #0c0818 0%, #080f1e 55%, #050810 100%)",
        border: `2px solid ${ACCENT}`, borderRadius: 12, padding: 0,
        maxWidth: 420, width: "94%", overflow: "hidden",
        boxShadow: `0 0 40px ${ACCENT}55, inset 0 0 60px ${ACCENT}0c`,
        animation: "eventTicketIn .35s cubic-bezier(.2,1.4,.4,1)",
      }}>
        {/* Marquee strip */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "6px 0", borderBottom: `1px solid ${ACCENT}55`,
          background: `linear-gradient(90deg, transparent, ${ACCENT}1e, transparent)`,
        }}>
          {[...Array(9)].map((_, i) => (
            <span key={i} style={{
              width: 5, height: 5, borderRadius: "50%", background: ACCENT,
              opacity: .85, animation: `marqueeBlink 1.1s ${i * 0.12}s ease-in-out infinite`,
            }} />
          ))}
        </div>

        <div style={{ padding: "16px 22px 20px" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 26, marginBottom: 4, filter: `drop-shadow(0 0 12px ${ACCENT})` }}>🃏</div>
            <div style={{
              fontFamily: "'Saira Stencil One',sans-serif", fontSize: 14, color: ACCENT,
              letterSpacing: 3, textShadow: `0 0 14px ${ACCENT}aa`,
            }}>MARQUEE — ANSWER FOR A CARD</div>
            <div style={{ fontSize: 8, color: "#7da0bf", letterSpacing: 1, marginTop: 6 }}>{q.era}</div>
            <div style={{ fontSize: 8, color: "#3a5a7a", letterSpacing: 1, marginTop: 4 }}>
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
              if (revealed) {
                if (isAnswer) { border = "#44cc88"; bg = "#0c2417"; color = "#9affc4"; }
                else if (isChosen) { border = "#ff5555"; bg = "#220c0c"; color = "#ff9c9c"; }
                else { color = "#5a7088"; }
              }
              return (
                <button key={i}
                  onClick={() => { if (isQuestion) answerTrivia(i); }}
                  disabled={!isQuestion}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    textAlign: "left", cursor: isQuestion ? "pointer" : "default",
                    fontFamily: "inherit", fontSize: 10.5, color, lineHeight: 1.4,
                    background: bg, border: `1.5px solid ${border}`, borderRadius: 7,
                    padding: "9px 12px", transition: "all .12s",
                  }}
                  onMouseEnter={e => { if (isQuestion) { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = "#101c30"; } }}
                  onMouseLeave={e => { if (isQuestion) { e.currentTarget.style.borderColor = "#22344e"; e.currentTarget.style.background = "#0a1322"; } }}
                >
                  <span style={{
                    flexShrink: 0, width: 18, height: 18, borderRadius: 4, fontSize: 9, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: `1px solid ${revealed && isAnswer ? "#44cc88" : revealed && isChosen ? "#ff5555" : "#3a5a7a"}`,
                    color: revealed && isAnswer ? "#44cc88" : revealed && isChosen ? "#ff5555" : "#7da0bf",
                  }}>{revealed && isAnswer ? "✓" : revealed && isChosen ? "✕" : OPT_LETTER[i]}</span>
                  <span style={{ flex: 1 }}>{opt}</span>
                </button>
              );
            })}
          </div>

          {isQuestion && (
            <div style={{ fontSize: 8.5, color: "#5a7088", textAlign: "center", lineHeight: 1.5 }}>
              Get it right to win a random battle card. A wrong answer costs nothing.
            </div>
          )}

          {/* ── 🃏 The prize — and, with a full hand, the swap ── */}
          {(isSwap || (isResult && correct)) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                textAlign: "center", fontFamily: "'Saira Stencil One',sans-serif", fontSize: 12,
                letterSpacing: 1, color: "#44cc88", marginBottom: 8, textShadow: "0 0 12px #44cc8877",
              }}>✓ CORRECT — YOU WIN A CARD</div>
              <MarqueeCardFace card={prizeCard} dim={isResult && !kept} />
              {isSwap && (
                <>
                  <div style={{ fontSize: 9, color: "#8aa4bf", textAlign: "center", margin: "10px 0 6px" }}>
                    Your hand is full ({hand.length}). Swap one out for it, or let it go.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {hand.map((c, i) => (
                      <button key={i} onClick={() => keepPrize(i)} title={`Throw away ${c?.name} for ${prizeCard?.name}`}
                        style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                        <MarqueeCardFace card={c} small />
                      </button>
                    ))}
                  </div>
                  <div style={{ textAlign: "center", marginTop: 10 }}>
                    <button onClick={() => keepPrize(null)} style={btn("#7da0bf")}>LET IT GO</button>
                  </div>
                </>
              )}
              {isResult && (
                <div style={{ fontSize: 8.5, color: "#5a7088", textAlign: "center", marginTop: 6 }}>
                  {kept ? "In your hand — arm it before a Swing or a Sonic." : "Let go — your hand stays as it was."}
                </div>
              )}
            </div>
          )}

          {/* Result: sauce + close */}
          {isResult && (
            <>
              {!correct && (
                <div style={{
                  textAlign: "center", fontFamily: "'Saira Stencil One',sans-serif", fontSize: 12, letterSpacing: 1,
                  color: "#ff7766", marginBottom: 10, textShadow: "0 0 12px #ff776677",
                }}>✕ NO CARD — the crowd forgives you</div>
              )}
              <div style={{
                fontSize: 9.5, color: "#bcd0e4", lineHeight: 1.55, textAlign: "left",
                background: "#0a1020", border: `1px solid ${ACCENT}44`, borderRadius: 6,
                padding: "9px 12px", marginBottom: 16,
              }}>
                <span style={{ color: ACCENT, fontWeight: 700 }}>💡 </span>{q.sauce}
              </div>
              <div style={{ textAlign: "center" }}>
                <button onClick={() => setActiveEvent(null)} style={btn(ACCENT)}>🤘 ROCK ON</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
