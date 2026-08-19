// ─── 🧠 BOT REVIEW ───────────────────────────────────────────────────────────
// What the computer players decided, and what they decided AGAINST.
//
// The searcher prices every action that survives the beam and then throws all of
// them away but the winner. `searcherPolicy`'s `trace` sink keeps them; this
// renders them. Three questions it exists to answer, in the order they matter:
//
//   1. ⚠️ WHAT WAS LEGAL AND NEVER PLAYED? `SEQUENCING.md` §5.A names the most
//      reliable bug in this repo — the game rewards something, the evaluator has
//      no term for it, so the bot never does it and every suite stays green. It
//      has been found by hand eight times. This is that sweep, every match.
//   2. 🎯 DID THE RANKING COST ANYTHING? With the audit on, the options the beam
//      threw away are priced too. A row where the best pruned option beats the
//      chosen one is the beam losing the position — §5.E⁗ item 1 with an
//      instrument on it.
//   3. HOW CLOSE WAS IT? A decision whose top two options are worth the same is
//      not really a decision, and a bot whose every turn is a coin flip is not
//      being steered by its weights.
//
// 📌 The summary itself is `engine/policies/botJournal.js` — pure, and covered by
// `npm run test:trace` — so the same numbers come out of a headless bench run.
// This file only draws.
import React, { useMemo, useState } from "react";
import { journalSummary } from "../engine/policies/botJournal.js";

const C = {
  bg: "#080f1e", panel: "#0a1020", line: "#1e3a5f", text: "#c0d0e0",
  dim: "#5a7a9a", warn: "#ffcc44", bad: "#ff6b6b", good: "#44ff88",
};
const mono = "'Share Tech Mono','Courier New',monospace";
const ROWS_SHOWN = 300;   // the download carries everything; the DOM does not

const num = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "—");
const label = (c) => `${c.kind}${c.key != null && c.key !== "" ? `·${c.key}` : ""}`;

export default function BotReview({ journal = [], spirits = [], onClose }) {
  const [seat, setSeat] = useState(null);
  const summary = useMemo(() => journalSummary(journal), [journal]);
  const seats = Object.keys(summary);
  const active = seat && summary[seat] ? seat : seats[0];
  const nameOf = (id) => spirits.find((s) => s.id === id)?.name ?? id;

  const rows = useMemo(
    () => journal.filter((e) => e.spiritId === active).slice(-ROWS_SHOWN).reverse(),
    [journal, active]
  );

  function download() {
    const blob = new Blob([JSON.stringify({ journal, summary }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bot-journal-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const s = summary[active];
  if (!s) return null;

  const btn = (on) => ({
    fontFamily: mono, cursor: "pointer", borderRadius: 4, padding: "6px 12px", fontSize: 11,
    border: "1px solid " + (on ? C.warn : C.line), background: on ? C.warn + "22" : C.panel,
    color: on ? C.warn : C.dim,
  });
  const cell = { padding: "4px 8px", borderBottom: "1px solid " + C.line + "55", verticalAlign: "top" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 9000, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20, fontFamily: mono }}>
      <div style={{ background: C.bg, border: "2px solid " + C.line, borderRadius: 8, width: "min(1100px,96vw)",
        maxHeight: "92vh", display: "flex", flexDirection: "column", color: C.text }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          borderBottom: "1px solid " + C.line }}>
          <span style={{ fontFamily: "'Saira Stencil One',sans-serif", color: C.warn, letterSpacing: 1 }}>
            🧠 BOT REVIEW
          </span>
          <span style={{ fontSize: 10, color: C.dim }}>
            {journal.length} decisions recorded · what they chose, and what they chose against
          </span>
          <div style={{ flex: 1 }} />
          <button style={btn(false)} onClick={download}>⬇ JSON</button>
          <button style={btn(false)} onClick={onClose}>✕ CLOSE</button>
        </div>

        <div style={{ display: "flex", gap: 6, padding: "10px 16px 0" }}>
          {seats.map((id) => (
            <button key={id} style={btn(id === active)} onClick={() => setSeat(id)}>{nameOf(id)}</button>
          ))}
        </div>

        {/* ── THE SUMMARY ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8,
          padding: 16 }}>
          {[
            ["decisions", s.decisions],
            ["mean pruned by the beam", num(s.meanPruned, 1) + `  (worst ${s.prunedMax})`],
            ["mean options priced", num(s.meanConsidered, 1)],
            ["close calls", `${s.closeCalls} / ${s.actionDecisions}`],
            ["search time", `${num(s.meanMs, 0)}ms mean · ${num(s.worstMs, 0)}ms worst`],
            ["🎯 beam cost the position", `${s.rankingCost}× (${num(s.rankingCostTotal, 1)} pts)`],
          ].map(([k, v]) => (
            <div key={k} style={{ background: C.panel, border: "1px solid " + C.line, borderRadius: 6, padding: 10 }}>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: 1 }}>{String(k).toUpperCase()}</div>
              <div style={{ fontSize: 15, marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* ── ⚠️ THE §5.A DETECTOR ── */}
        <div style={{ margin: "0 16px 12px", padding: 10, borderRadius: 6,
          background: s.neverChosen.length ? C.bad + "18" : C.panel,
          border: "1px solid " + (s.neverChosen.length ? C.bad : C.line) }}>
          <div style={{ fontSize: 9, color: s.neverChosen.length ? C.bad : C.dim, letterSpacing: 1 }}>
            ⚠️ LEGAL, AND NEVER ONCE PLAYED
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {s.neverChosen.length
              ? s.neverChosen.map((k) => `${k} (legal ${s.legalSeen[k]}×)`).join("   ·   ")
              : "nothing — every action the rules offered was played at least once"}
          </div>
          {!!s.neverChosen.length && (
            <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
              An action the rules kept offering and the bot never took is the shape of a missing
              evaluator term. It is not proof of one — but it is where the last eight turned out to be.
            </div>
          )}
        </div>

        {/* ── THE DECISIONS ── */}
        <div style={{ overflow: "auto", margin: "0 16px 16px", border: "1px solid " + C.line, borderRadius: 6 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ color: C.dim, textAlign: "left", position: "sticky", top: 0, background: C.panel }}>
                <th style={cell}>turn</th><th style={cell}>chose</th><th style={cell}>score</th>
                <th style={cell}>over</th><th style={cell}>pruned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => {
                const beat = e.bestPruned && e.bestPruned.score > e.score;
                return (
                  <tr key={i} style={{ background: beat ? C.bad + "14" : "transparent" }}>
                    <td style={cell}>{e.turn}</td>
                    <td style={{ ...cell, color: C.good }}>
                      {e.t === "compose"
                        ? `🎼 a ${e.chosen?.len ?? "?"}-step track`
                        : label(e.chosen ?? {})}
                    </td>
                    <td style={cell}>{num(e.score)}</td>
                    <td style={{ ...cell, color: C.dim }}>
                      {e.t === "compose"
                        ? (e.curve ?? []).map((p) => `${p.len}:${num(p.score, 1)}`).join("  ")
                        : (e.considered ?? []).slice(1, 5).map((c) => `${label(c)} ${num(c.score, 1)}`).join("   ")}
                    </td>
                    <td style={{ ...cell, color: beat ? C.bad : C.dim }}>
                      {e.t === "compose" ? "" : (
                        beat
                          ? `🎯 threw away ${label(e.bestPruned)} @ ${num(e.bestPruned.score)}`
                          : `${e.pruned ?? 0}`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {journal.filter((e) => e.spiritId === active).length > ROWS_SHOWN && (
          <div style={{ fontSize: 10, color: C.dim, padding: "0 16px 12px" }}>
            Showing the last {ROWS_SHOWN} decisions. The JSON download carries all of them.
          </div>
        )}
      </div>
    </div>
  );
}
