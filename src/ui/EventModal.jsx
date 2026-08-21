// =============================================================================
// ui/EventModal.jsx  —  the MARQUEE CARD (MARQUEE_QUIZ_DESIGN.md §2).
// Presentational: all values/handlers via props, zero app imports.
//
// Four phases, in order:
//   'choice'   — pick a LANE (crowd/rig) and a DIFFICULTY, face-down
//   'question' — the drawn card, four options
//   'spend'    — 🎛️ RIG lane only: put each won tier on pool or power
//   'result'   — the sauce, and what it paid
//
// activeEvent: { spiritId, hexNum, q, lane, difficulty, phase, chosen, correct,
//                reward, tiersLeft }
//   q = { id, era, difficulty, topic, question, options[4], answer, sauce }
//
// ⚠️ THE CHOICE COMES BEFORE THE CARD IS DRAWN, and that ordering is the entire
// skill component: betting on yourself at `hard` has to be a bet, which means it
// cannot be made with the question already on the table.
// =============================================================================
import React from "react";

const DIFF_COLOR = { easy: "#44cc88", medium: "#ffcc44", hard: "#ff6644" };
const OPT_LETTER = ["A", "B", "C", "D"];

const LANES = [
  { id: "crowd", icon: "🎤", label: "CROWD", blurb: "Lore, scandal, legend, live moments", pays: "pays FANS" },
  { id: "rig",   icon: "🎛️", label: "RIG",   blurb: "Theory, gear, guitars, amps, studio", pays: "pays RIG TIERS" },
];
const DIFFS = [
  { id: "easy",   label: "EASY",   crowd: "+2 fans", rig: "1 tier"  },
  { id: "medium", label: "MEDIUM", crowd: "+3 fans", rig: "2 tiers" },
  { id: "hard",   label: "HARD",   crowd: "+4 fans", rig: "3 tiers" },
];

export function EventModal({ activeEvent, answerTrivia, setActiveEvent, spirits,
                             chooseTriviaCard, spendRigTier, rigSpendable, rigTiers }) {
  if (!activeEvent) return null;
  const { q, phase, chosen, correct, reward, lane } = activeEvent;
  const isChoice = phase === "choice";
  if (!q && !isChoice) return null;
  const accent = isChoice ? "#ffcc44" : (DIFF_COLOR[q.difficulty] || "#ffcc44");
  const spirit = spirits.find(s => s.id === activeEvent.spiritId);
  const isResult = phase === "result";
  const isSpend  = phase === "spend";

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
              fontFamily: "'Saira Stencil One',sans-serif", fontSize: 14, color: accent,
              letterSpacing: 3, textShadow: `0 0 14px ${accent}aa`,
            }}>{isChoice ? "PICK YOUR LANE" : "ROCK TRIVIA"}</div>
            {!isChoice && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 8, color: "#7da0bf", letterSpacing: 1 }}>{q.era}</span>
                <span style={{
                  fontSize: 7, letterSpacing: 1, color: accent, fontWeight: 700,
                  border: `1px solid ${accent}66`, borderRadius: 3, padding: "1px 6px",
                  textTransform: "uppercase",
                }}>{lane === "rig" ? "🎛️ RIG" : "🎤 CROWD"} · {q.difficulty}</span>
              </div>
            )}
            <div style={{ fontSize: 8, color: "#3a5a7a", letterSpacing: 1, marginTop: 6 }}>
              for <span style={{ color: spirit?.color }}>{spirit?.name?.toUpperCase()}</span>
            </div>
          </div>

          {/* ── 🎪 THE CHOICE CARD — lane × difficulty, before anything is drawn ── */}
          {isChoice && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 4 }}>
              {LANES.map(L => {
                const can = L.id === "rig" ? (rigSpendable?.pool || rigSpendable?.power) : true;
                return (
                  <div key={L.id} style={{
                    border: `1.5px solid ${L.id === "rig" ? "#44aaff55" : "#ffcc4455"}`, borderRadius: 8,
                    padding: "10px 12px", background: "#0a1322", opacity: can ? 1 : 0.5,
                  }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 14 }}>{L.icon}</span>
                      <span style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 12,
                        letterSpacing: 2, color: L.id === "rig" ? "#66ccff" : "#ffcc44" }}>{L.label}</span>
                      <span style={{ fontSize: 8, color: "#7da0bf", letterSpacing: 1 }}>{L.pays}</span>
                    </div>
                    <div style={{ fontSize: 9, color: "#8aa4bf", marginBottom: 8 }}>
                      {L.blurb}
                      {/* 🏋️ A maxed rig has nothing left to train, and the card says so
                          rather than paying out a tier that silently evaporates. */}
                      {L.id === "rig" && !can && " — your rig is maxed; nothing left to train."}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {DIFFS.map(D => (
                        <button key={D.id}
                          disabled={!can}
                          onClick={() => can && chooseTriviaCard?.(L.id, D.id)}
                          style={{
                            flex: 1, cursor: can ? "pointer" : "not-allowed", fontFamily: "inherit",
                            fontSize: 9, fontWeight: 700, letterSpacing: 1, lineHeight: 1.5,
                            color: DIFF_COLOR[D.id], background: "#0c1626",
                            border: `1.5px solid ${DIFF_COLOR[D.id]}66`, borderRadius: 6, padding: "7px 4px",
                          }}
                          onMouseEnter={e => { if (can) e.currentTarget.style.borderColor = DIFF_COLOR[D.id]; }}
                          onMouseLeave={e => { if (can) e.currentTarget.style.borderColor = `${DIFF_COLOR[D.id]}66`; }}
                        >
                          {D.label}
                          <div style={{ fontSize: 8, color: "#8aa4bf", fontWeight: 400 }}>
                            {L.id === "rig" ? D.rig : D.crowd}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: 8.5, color: "#5a7088", textAlign: "center", lineHeight: 1.5 }}>
                A wrong answer costs nothing — the bet is what you gave up by playing safe.
              </div>
            </div>
          )}

          {/* Question */}
          {!isChoice && (<>
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
              const revealed = isResult || isSpend;   // 🏋️ the spend step already knows the answer
              if (revealed) {
                if (isAnswer) { border = "#44cc88"; bg = "#0c2417"; color = "#9affc4"; }
                else if (isChosen) { border = "#ff5555"; bg = "#220c0c"; color = "#ff9c9c"; }
                else { color = "#5a7088"; }
              }
              return (
                <button key={i}
                  onClick={() => { if (phase === "question") answerTrivia(i); }}
                  disabled={phase !== "question"}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%",
                    textAlign: "left", cursor: isResult ? "default" : "pointer",
                    fontFamily: "inherit", fontSize: 10.5, color, lineHeight: 1.4,
                    background: bg, border: `1.5px solid ${border}`, borderRadius: 7,
                    padding: "9px 12px", transition: "all .12s",
                  }}
                  onMouseEnter={e => { if (phase === "question") { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = "#101c30"; } }}
                  onMouseLeave={e => { if (phase === "question") { e.currentTarget.style.borderColor = "#22344e"; e.currentTarget.style.background = "#0a1322"; } }}
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

          {/* ── 🏋️ THE SPEND STEP — RIG lane only, one tier at a time ── */}
          {isSpend && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                textAlign: "center", fontFamily: "'Saira Stencil One',sans-serif", fontSize: 12,
                letterSpacing: 1, color: "#66ccff", marginBottom: 4,
                textShadow: "0 0 12px #66ccff77",
              }}>✓ CORRECT — {activeEvent.tiersLeft} TIER{activeEvent.tiersLeft === 1 ? "" : "S"} TO SPEND</div>
              <div style={{ fontSize: 8.5, color: "#5a7088", textAlign: "center", marginBottom: 10 }}>
                pool {rigTiers?.pool ?? 1} · power {rigTiers?.power ?? 0} — you keep this until you stop training
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  disabled={!rigSpendable?.pool}
                  onClick={() => spendRigTier?.("pool")}
                  style={{
                    flex: 1, cursor: rigSpendable?.pool ? "pointer" : "not-allowed", fontFamily: "inherit",
                    fontSize: 10, fontWeight: 700, letterSpacing: 1, lineHeight: 1.6,
                    color: "#9affc4", background: "#0c2417", opacity: rigSpendable?.pool ? 1 : 0.4,
                    border: "1.5px solid #44cc8866", borderRadius: 7, padding: "10px 6px",
                  }}>🔊 POOL
                  <div style={{ fontSize: 8.5, color: "#8aa4bf", fontWeight: 400 }}>one more d6 in the pool</div>
                </button>
                <button
                  disabled={!rigSpendable?.power}
                  onClick={() => spendRigTier?.("power")}
                  style={{
                    flex: 1, cursor: rigSpendable?.power ? "pointer" : "not-allowed", fontFamily: "inherit",
                    fontSize: 10, fontWeight: 700, letterSpacing: 1, lineHeight: 1.6,
                    color: "#ffd88a", background: "#241a0c", opacity: rigSpendable?.power ? 1 : 0.4,
                    border: "1.5px solid #ffcc4466", borderRadius: 7, padding: "10px 6px",
                  }}>🎛️ POWER
                  <div style={{ fontSize: 8.5, color: "#8aa4bf", fontWeight: 400 }}>upgrade one die d6 → d8</div>
                </button>
              </div>
              {/* ⚠️ POWER CANNOT EXCEED POOL — the old tree gated this with a
                  prereq; with no tree left it is arithmetic, and the card simply
                  does not offer the button rather than explaining a refusal. */}
              {!rigSpendable?.power && (
                <div style={{ fontSize: 8, color: "#5a7088", textAlign: "center", marginTop: 8 }}>
                  no spare die to upgrade — add to the pool first
                </div>
              )}
            </div>
          )}

          {/* Result: reward banner + sauce + close */}
          {isResult && (
            <>
              <div style={{
                textAlign: "center", fontFamily: "'Saira Stencil One',sans-serif", fontSize: 12, letterSpacing: 1,
                color: correct ? "#44cc88" : "#ff7766", marginBottom: 10,
                textShadow: `0 0 12px ${correct ? "#44cc88" : "#ff7766"}77`,
              }}>
                {!correct
                  ? "✕ NO BONUS — the crowd forgives you"
                  : lane === "rig"
                  ? `✓ CORRECT — rig trained: pool ${rigTiers?.pool ?? 1}, power ${rigTiers?.power ?? 0}`
                  : `✓ CORRECT — +${reward} Fans`}
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
                    fontFamily: "'Saira Stencil One',sans-serif", fontSize: 11, letterSpacing: 2, cursor: "pointer",
                    padding: "8px 28px", borderRadius: 6, color: accent, fontWeight: 700,
                    background: "transparent", border: `1.5px solid ${accent}`,
                  }}>🤘 ROCK ON</button>
              </div>
            </>
          )}
          </>)}
        </div>
      </div>
    </div>
  );
}
