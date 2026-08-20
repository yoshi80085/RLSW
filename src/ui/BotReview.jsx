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

  const payload = () => JSON.stringify({ journal, summary }, null, 2);
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

  // ⬇ Save. Where a browser offers a real save dialog (Chromium's File System
  // Access API) it is used, so the journal can be dropped straight into the
  // repo's `.scratch/journals/` instead of landing in Downloads and needing to be
  // moved. Everywhere else this falls back to an ordinary download.
  //
  // ⚠️ THIS USED TO FAIL SILENTLY AND LEAVE A 0-BYTE FILE BEHIND, and both halves
  // of that were the same bare `catch {}`. A save dialog CREATES the file the
  // moment it is confirmed; the bytes only arrive at `close()`. So anything that
  // threw in between — building the JSON, `createWritable`, the write itself —
  // left the file the user had just named sitting on disk at zero length, and
  // the swallow meant there was nothing in the console to say why either. Two of
  // those turned up in `.scratch/journals/` on 2026-08-19 with the panel showing
  // 80 decisions, and nothing on disk could tell them apart from an empty run.
  // A download that can fail must say so.
  const [saveErr, setSaveErr] = useState(null);
  function reportSaveFailure(what, err) {
    console.error(`[BotReview] ⬇ JSON — ${what}`, err);
    setSaveErr(what);
    setTimeout(() => setSaveErr(null), 6000);
  }

  async function download() {
    const name = `bot-journal-${stamp()}.json`;
    setSaveErr(null);
    // 📌 BUILT BEFORE THE PICKER OPENS, on purpose. If the journal cannot be
    // serialised at all, the person should find that out BEFORE they have named
    // a file — not as an empty one on their disk afterwards.
    let text;
    try {
      text = payload();
    } catch (err) {
      reportSaveFailure(`could not build the JSON (${journal.length} decisions)`, err);
      return;
    }
    try {
      if (window.showSaveFilePicker) {
        const h = await window.showSaveFilePicker({ suggestedName: name,
          types: [{ description: "Bot journal", accept: { "application/json": [".json"] } }] });
        const w = await h.createWritable();
        await w.write(text);
        await w.close();
        return;
      }
    } catch (err) {
      // Cancelling the dialog is not a failure and must not be reported as one —
      // but it is the ONLY thing in here that isn't.
      if (err?.name === "AbortError") return;
      reportSaveFailure("the save dialog failed — falling back to a download", err);
      // …and fall through, because a file in Downloads still beats no file.
    }
    try {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      reportSaveFailure("the download failed — try 📋 COPY SUMMARY instead", err);
    }
  }

  // 📋 The summary as plain text — small enough to paste into a message, which is
  // the other way this gets read.
  const [copied, setCopied] = useState(false);
  function copySummary() {
    const lines = Object.entries(summary).map(([id, x]) =>
      [`${nameOf(id)} — ${x.decisions} decisions (${x.actionDecisions} action / ${x.composeDecisions} compose)`,
       `  beam: mean pruned ${num(x.meanPruned, 1)}, worst ${x.prunedMax}; mean priced ${num(x.meanConsidered, 1)}`,
       `  close calls: ${x.closeCalls}/${x.actionDecisions}`,
       `  beam cost the position: ${x.rankingCost}x (${num(x.rankingCostTotal, 1)} pts)`,
       `  search: ${num(x.meanMs, 0)}ms mean, ${num(x.worstMs, 0)}ms worst`,
       `  chose: ${Object.entries(x.chosen).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`,
       `  NEVER PLAYED: ${x.neverChosen.length ? x.neverChosen.map(k => `${k} (legal ${x.legalSeen[k]}x)`).join(", ") : "-"}`,
       `  composition: ${num(x.meanNotes, 2)} notes + ${num(x.meanCommits, 2)} commits per turn`
         + `; ${x.composeTurnsWith?.stackCommit ?? 0}/${x.composeDecisions} turns loaded a stack`,
       `  close calls turn on: ${(x.termSwing ?? []).slice(0, 5).map(([k, v]) => `${k} ${num(v, 3)}`).join(", ") || "-"}`,
      ].join("\n"));
    navigator.clipboard?.writeText(`bot journal — ${journal.length} decisions\n\n${lines.join("\n\n")}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
          {/* ⚠️ The save failure is shown HERE, beside the button that caused it.
              A console line is not enough: the person who clicked ⬇ JSON is
              looking at this bar, not at devtools. */}
          {saveErr && (
            <span style={{ fontSize: 10, color: C.bad, maxWidth: 320 }}>⚠️ {saveErr}</span>
          )}
          <button style={btn(copied)} onClick={copySummary}>{copied ? "✓ COPIED" : "📋 COPY SUMMARY"}</button>
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
            // 🥁 THE COMPOSITION HALF OF THE TURN, which this panel reported
            // nothing about until 2026-08-19 — the entries did not carry it.
            // "Turns that loaded a stack" is the number the stack bug hid in: it
            // read 12–15% while the bots were writing five-note tracks and
            // walking into fights with nothing voiced.
            ["✍️ per composition turn", `${num(s.meanNotes, 2)} notes · ${num(s.meanCommits, 2)} commits`],
            ["🥁 turns that loaded a stack", `${s.composeTurnsWith?.stackCommit ?? 0} / ${s.composeDecisions}`],
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
          <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
            🥁 Since 2026-08-19 this sweep covers the composition phase too. It used to see only the
            action half of a turn, which is how a stack commit went 455 offers without being taken
            and appeared in no column of this panel.
          </div>
        </div>

        {/* ── 🎯 WHAT THE CLOSE CALLS TURN ON ──
            The panel's other half-answer. `close calls` above says how many turns
            were near coin flips; this says which terms were doing the flipping.
            ⚠️ RAW TERMS, NOT WEIGHTED — a term that MOVES a lot on a small weight
            DECIDES little. Read beside `EVAL_WEIGHTS`, never instead of it. */}
        {!!s.termSwing?.length && (
          <div style={{ margin: "0 16px 12px", padding: 10, borderRadius: 6,
            background: C.panel, border: "1px solid " + C.line }}>
            <div style={{ fontSize: 9, color: C.dim, letterSpacing: 1 }}>
              🎯 WHAT THE CLOSE CALLS TURN ON — mean term swing, winner vs runner-up, over {s.termSwingN} of them
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {s.termSwing.slice(0, 6).map(([k, v]) => `${k} ${num(v, 3)}`).join("   ·   ")}
            </div>
            <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
              Raw term values, before their weights. A term high here and low in the weight table
              moves a lot and decides little — and a turn decided by a term that scores GETTING
              READY rather than DOING is the shape §5.A has now found ten times.
            </div>
          </div>
        )}

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
                        // 🥁 A "5-step track" was five notes or two notes and
                        // three chord commits, and the panel could not tell you
                        // which. Now it says.
                        ? `🎼 ${e.chosenKinds?.melodyNote ?? e.chosen?.len ?? "?"} notes`
                          + `${e.chosenKinds?.stackCommit ? ` + ${e.chosenKinds.stackCommit} 🥁` : ""}`
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
