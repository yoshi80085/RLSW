// =============================================================================
// ui/EventModal.jsx  —  the MARQUEE TICKET (MARQUEE_QUIZ_DESIGN.md §10, §13).
// Presentational: all values/handlers via props, zero app imports.
//
// Two kinds of round (Alex, 2026-09-29):
//   · SOLO (2 in 3) — the lander answers alone on a 10 s clock; running out of
//     time is a wrong answer.
//   · COMMUNITY (1 in 3) — every seat at this table answers on its OWN row of
//     A–D buttons in its colour; the first RIGHT answer wins the card; a wrong
//     answer locks that seat out; open 15 s. Bots click on their own schedule.
//
// Phases: 'question' → ('swap' when the winner's hand is full) → 'result'.
//
// activeEvent: { kind, spiritId, q, phase, prize, startedAt, limitMs,
//   solo:      chosen, correct, timedOut, kept
//   community: participants[{id,bot}], answers[{id,choice,correct,atMs}],
//              lockedOut[], winnerId, swapFor, timedOut, kept }
// =============================================================================
import React, { useEffect, useState } from "react";

const OPT_LETTER = ["A", "B", "C", "D"];
const PINK = "#ff44dd";              // a solo marquee's neon (the board's)
const GOLD = "#ffcc44";              // a community marquee's
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

/** ⏱️ The round's clock: a draining bar and the seconds left. */
function Countdown({ startedAt, limitMs, running, accent }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick(n => n + 1), 100);
    return () => clearInterval(t);
  }, [running]);
  if (startedAt == null || !limitMs) return null;
  const left = Math.max(0, limitMs - (performance.now() - startedAt));
  const k = running ? left / limitMs : 0;
  const hot = running && left < 3000;
  return (
    <div data-marquee-clock={Math.ceil(left / 1000)} style={{ margin: "0 0 12px" }}>
      <div style={{ height: 6, borderRadius: 3, background: "#101a30", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${k * 100}%`, background: hot ? "#ff5a5a" : accent,
          boxShadow: `0 0 10px ${hot ? "#ff5a5a" : accent}`, transition: "width .1s linear" }} />
      </div>
      <div style={{ textAlign: "right", fontSize: 9, letterSpacing: 1, marginTop: 3, color: hot ? "#ff8a8a" : "#7da0bf" }}>
        {running ? `${Math.ceil(left / 1000)}s` : ""}
      </div>
    </div>
  );
}

export function EventModal({ activeEvent, answerTrivia, answerCommunity, keepPrize, setActiveEvent, spirits,
                             prizeCard, hand = [] }) {
  if (!activeEvent?.q) return null;
  const { q, phase, chosen, correct, kept, kind } = activeEvent;
  const community = kind === "community";
  const accent = community ? GOLD : PINK;
  const byId = id => spirits.find(s => s.id === id);
  const spirit = byId(activeEvent.spiritId);
  const isQuestion = phase === "question";
  const isSwap = phase === "swap";
  const isResult = phase === "result";
  const revealed = !isQuestion;
  const winner = community ? byId(activeEvent.winnerId) : (correct ? spirit : null);
  const swapper = byId(activeEvent.swapFor ?? activeEvent.spiritId);
  const won = community ? !!activeEvent.winnerId : !!correct;

  const btn = (color) => ({
    fontFamily: "'Saira Stencil One',sans-serif", fontSize: 11, letterSpacing: 2, cursor: "pointer",
    padding: "8px 22px", borderRadius: 6, color, fontWeight: 700,
    background: "transparent", border: `1.5px solid ${color}`,
  });

  // The options: clickable for a SOLO lander; a read-only list in community
  // (each seat clicks its own row below).
  const options = (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
      {q.options.map((opt, i) => {
        const isAnswer = i === q.answer;
        const isChosen = !community && i === chosen;
        let border = "#22344e", bg = "#0a1322", color = "#c0d0e0";
        if (revealed) {
          if (isAnswer) { border = "#44cc88"; bg = "#0c2417"; color = "#9affc4"; }
          else if (isChosen) { border = "#ff5555"; bg = "#220c0c"; color = "#ff9c9c"; }
          else { color = "#5a7088"; }
        }
        const clickable = !community && isQuestion;
        return (
          <button key={i}
            onClick={() => { if (clickable) answerTrivia(i); }}
            disabled={!clickable}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              textAlign: "left", cursor: clickable ? "pointer" : "default",
              fontFamily: "inherit", fontSize: 10.5, color, lineHeight: 1.4,
              background: bg, border: `1.5px solid ${border}`, borderRadius: 7,
              padding: community ? "6px 12px" : "9px 12px", transition: "all .12s",
            }}
            onMouseEnter={e => { if (clickable) { e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = "#101c30"; } }}
            onMouseLeave={e => { if (clickable) { e.currentTarget.style.borderColor = "#22344e"; e.currentTarget.style.background = "#0a1322"; } }}
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
  );

  // 🎤 One row per seat: its colour, its name, A–D. A bot's row fills in when it clicks.
  const rows = community && (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }} data-community-rows="">
      {(activeEvent.participants ?? []).map(p => {
        const sp = byId(p.id), col = sp?.color ?? "#9fb4d6";
        const a = (activeEvent.answers ?? []).find(x => x.id === p.id);
        const isWinner = activeEvent.winnerId === p.id;
        const out = a && !a.correct;
        const canClick = isQuestion && !p.bot && !a;
        return (
          <div key={p.id} data-community-row={p.id} style={{
            display: "grid", gridTemplateColumns: "92px 1fr", gap: 8, alignItems: "center",
            padding: "5px 8px", borderRadius: 7, border: `1px solid ${isWinner ? "#44cc88" : col + "55"}`,
            background: isWinner ? "#0c2417" : out ? "#1a0a0e" : "#0a1020", opacity: out && !revealed ? 0.8 : 1,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: col, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.bot ? "🤖 " : ""}{sp?.name ?? p.id}
            </span>
            <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {OPT_LETTER.map((L, i) => {
                const picked = a?.choice === i;
                const bg = picked ? (a.correct ? "#44cc88" : "#ff5555") : canClick ? col + "22" : "#0d1528";
                return (
                  <button key={L} data-answer={`${p.id}:${L}`} disabled={!canClick}
                    onClick={() => canClick && answerCommunity?.(p.id, i)}
                    style={{ width: 34, height: 26, borderRadius: 5, cursor: canClick ? "pointer" : "default",
                      fontFamily: "inherit", fontSize: 11, fontWeight: 700,
                      color: picked ? "#050a16" : canClick ? col : "#4a5a78",
                      background: bg, border: `1.5px solid ${picked ? bg : canClick ? col : "#22304f"}` }}>{L}</button>
                );
              })}
              <span style={{ fontSize: 9, color: isWinner ? "#9affc4" : out ? "#ff9c9c" : "#6a7c98", marginLeft: 4 }}>
                {isWinner ? "🏆 first!" : out ? "✕ out" : p.bot && isQuestion ? "thinking…" : ""}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000000d8", zIndex: 9990,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div data-marquee-kind={kind ?? "solo"} style={{
        background: "linear-gradient(165deg, #0c0818 0%, #080f1e 55%, #050810 100%)",
        border: `2px solid ${accent}`, borderRadius: 12, padding: 0,
        maxWidth: community ? 460 : 420, width: "94%", maxHeight: "94vh", overflowY: "auto",
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
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 26, marginBottom: 4, filter: `drop-shadow(0 0 12px ${accent})` }}>{community ? "🎤" : "🃏"}</div>
            <div style={{
              fontFamily: "'Saira Stencil One',sans-serif", fontSize: 14, color: accent,
              letterSpacing: 3, textShadow: `0 0 14px ${accent}aa`,
            }}>{community ? "COMMUNITY MARQUEE" : "MARQUEE — ANSWER FOR A CARD"}</div>
            <div style={{ fontSize: 8.5, color: community ? "#ffe08a" : "#7da0bf", letterSpacing: 1, marginTop: 5 }}>
              {community ? "Everyone answers · first right answer wins the card · wrong = out" : q.era}
            </div>
            {!community && (
              <div style={{ fontSize: 8, color: "#3a5a7a", letterSpacing: 1, marginTop: 4 }}>
                for <span style={{ color: spirit?.color }}>{spirit?.name?.toUpperCase()}</span>
              </div>
            )}
          </div>

          <Countdown startedAt={activeEvent.startedAt} limitMs={activeEvent.limitMs} running={isQuestion} accent={accent} />

          {/* Question */}
          <div style={{
            fontSize: 11.5, color: "#e8eef8", lineHeight: 1.5, textAlign: "center",
            marginBottom: 12, padding: "0 4px", fontWeight: 600,
          }}>{q.question}</div>

          {options}
          {rows}

          {isQuestion && (
            <div style={{ fontSize: 8.5, color: "#5a7088", textAlign: "center", lineHeight: 1.5 }}>
              {community
                ? "Click a letter on your own row. One try each — a wrong answer takes you out of this one."
                : "Get it right before the clock runs out to win a random battle card. A wrong answer costs nothing."}
            </div>
          )}

          {/* ── 🃏 The prize — and, with a full hand, the swap ── */}
          {(isSwap || (isResult && won)) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                textAlign: "center", fontFamily: "'Saira Stencil One',sans-serif", fontSize: 12,
                letterSpacing: 1, color: "#44cc88", marginBottom: 8, textShadow: "0 0 12px #44cc8877",
              }}>{community
                ? <>🏆 <span style={{ color: winner?.color }}>{winner?.name?.toUpperCase()}</span> ANSWERS FIRST — WINS THE CARD</>
                : "✓ CORRECT — YOU WIN A CARD"}</div>
              <MarqueeCardFace card={prizeCard} dim={isResult && !kept} />
              {isSwap && (
                <>
                  <div style={{ fontSize: 9, color: "#8aa4bf", textAlign: "center", margin: "10px 0 6px" }}>
                    {community ? <><span style={{ color: swapper?.color }}>{swapper?.name}</span>, your</> : "Your"} hand is full ({hand.length}). Swap one out for it, or let it go.
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
                  {kept ? "In the hand — play it with “Use a card” above Roll in a Swing or a Sonic." : "Let go — the hand stays as it was."}
                </div>
              )}
            </div>
          )}

          {/* Result: sauce + close */}
          {isResult && (
            <>
              {!won && (
                <div style={{
                  textAlign: "center", fontFamily: "'Saira Stencil One',sans-serif", fontSize: 12, letterSpacing: 1,
                  color: "#ff7766", marginBottom: 10, textShadow: "0 0 12px #ff776677",
                }}>{activeEvent.timedOut
                  ? (community ? "⏱️ TIME'S UP — NOBODY GETS THE CARD" : "⏱️ TIME'S UP — NO CARD")
                  : (community ? "✕ NOBODY GOT IT — NO CARD" : "✕ NO CARD — the crowd forgives you")}</div>
              )}
              <div style={{
                fontSize: 9.5, color: "#bcd0e4", lineHeight: 1.55, textAlign: "left",
                background: "#0a1020", border: `1px solid ${accent}44`, borderRadius: 6,
                padding: "9px 12px", marginBottom: 16,
              }}>
                <span style={{ color: accent, fontWeight: 700 }}>💡 </span>{q.sauce}
              </div>
              <div style={{ textAlign: "center" }}>
                <button onClick={() => setActiveEvent(null)} style={btn(accent)}>🤘 ROCK ON</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
