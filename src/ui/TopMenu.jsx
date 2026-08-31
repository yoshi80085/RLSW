// ─── ☰ THE TOP MENU — every control that used to be a chip in the header ─────
//
// 🪦 WHAT THIS REPLACES, Alex 2026-08-31. The header was a single flex row
// carrying EIGHT controls — Cadences, the acting Spirit's Abilities, game speed,
// fast battles, lite FX, stage skin, tips, Lobby — plus a "first to ⭐N FP wins"
// chip and a "▶ <name>" badge. Nine or ten pill-shaped things in one strip, all
// drawn at the same weight, so the two you press every turn looked exactly like
// the six you press once a session.
//
// ⚠️ THE POINT IS NOT TIDINESS, IT IS THE RACE. Folding the controls away is what
// frees the middle of the strip for `FameRace` — the scoreboard is now the widest
// thing in the header, which is the correct ranking: a menu is where you go when
// you have decided to do something, a scoreboard is something you must be able to
// read without deciding anything at all.
//
// 🎛️ IT IS DATA-DRIVEN ON PURPOSE, same doctrine as ChannelStrip.jsx: this file
// owns the shell — the button, the panel, the outside-click, the row chrome — and
// knows nothing about what any item DOES. Every label, colour and handler arrives
// in `items`. A mistake in here can misdraw a row; it cannot reach game state.
//
// 📌 ROW KINDS
//   'action'  — { label, icon, onClick, color? }         fires and closes
//   'toggle'  — { label, icon, on, onClick, color? }     fires, stays open
//   'cycle'   — { label, icon, value, onClick, color? }  fires, stays open
//   'submenu' — { label, icon, value?, color?, options:[{ id, label, icon,
//                 accent, blurb, on }], onPick }         expands in place
//   'sep'     — a rule
// ⚠️ 'action' CLOSES AND THE OTHERS DO NOT, and that is a rule about intent, not
// a style. An action takes you somewhere else (a book, a modal, the lobby) so the
// menu has served its purpose; a toggle is something you flip and then LOOK at
// the board to judge, and closing the menu under the cursor turns "try lite FX"
// into "reopen the menu" every single time.

import { useEffect, useRef, useState } from "react";

const PANEL_W = 208;

/** Shared chrome for one row — the hover wash is the only thing that moves. */
function Row({ children, onClick, title, accent = "#7a97b5", on = false, tall = false }) {
  const [hot, setHot] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHot(true)} onMouseLeave={() => setHot(false)}
      style={{
        fontFamily: "inherit", fontSize: 9.5, letterSpacing: 0.5, cursor: "pointer",
        textAlign: "left", width: "100%", padding: tall ? "6px 8px" : "5px 8px",
        borderRadius: 4, display: "flex", alignItems: "center", gap: 7,
        background: on ? `${accent}16` : hot ? "#111b2c" : "transparent",
        border: `1px solid ${on ? `${accent}88` : "transparent"}`,
        color: on ? accent : hot ? "#c8d8ea" : "#7a97b5",
        transition: "background .12s, color .12s",
      }}>
      {children}
    </button>
  );
}

/** The ON/OFF lozenge on the right of a toggle row. Reads as a switch, not as text. */
function Pip({ on, accent }) {
  return (
    <span style={{ marginLeft: "auto", fontSize: 7, fontWeight: 800, letterSpacing: 0.8,
      padding: "1px 5px", borderRadius: 8, flexShrink: 0,
      background: on ? `${accent}22` : "#0a1020",
      border: `1px solid ${on ? accent : "#1e3a5f"}`,
      color: on ? accent : "#3a5a7a" }}>
      {on ? "ON" : "OFF"}
    </span>
  );
}

export function TopMenu({ items, tipAnchor }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub]   = useState(null);   // id of the expanded submenu, if any
  const wrap = useRef(null);

  /* ⚠️ POINTERDOWN, NOT CLICK. A `click` listener fires after the button's own
     handler on the same gesture, so the toggle that opened the panel would be
     read as an outside click and shut it again in the same tick — the panel
     would never appear. `pointerdown` also closes on a drag that starts
     outside, which is what a user who has moved on actually did. */
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!wrap.current?.contains(e.target)) { setOpen(false); setSub(null); } };
    const esc  = (e) => { if (e.key === "Escape") { setOpen(false); setSub(null); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const rows = (items ?? []).filter(Boolean);

  return (
    <div ref={wrap} style={{ position: "relative", display: "inline-block" }}>
      <button onClick={() => { setOpen(o => !o); setSub(null); }}
        data-tip-anchor={tipAnchor}
        title="Menu — Cadences, abilities, speed, visuals and Lobby"
        aria-label="Menu" aria-expanded={open}
        style={{
          fontFamily: "inherit", cursor: "pointer", padding: "4px 7px", borderRadius: 4,
          display: "flex", flexDirection: "column", gap: 3, alignItems: "stretch",
          background: open ? "#121a2e" : "#0a1020",
          border: `1px solid ${open ? "#f6ad55" : "#1e3a5f"}`,
          boxShadow: open ? "0 0 10px #f6ad5544" : "none",
        }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ display: "block", width: 13, height: 1.5, borderRadius: 1,
            background: open ? "#f6ad55" : "#6a8aaa",
            boxShadow: open ? "0 0 5px #f6ad55aa" : "none" }}/>
        ))}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 70,
          width: PANEL_W, background: "#060b16", border: "1px solid #1e3a5f",
          borderRadius: 6, padding: 5, boxShadow: "0 10px 28px #000c, 0 0 14px #0a1a3040" }}>
          {rows.map((it, i) => {
            if (it.kind === "sep") {
              return <div key={`sep${i}`} style={{ height: 1, margin: "4px 6px",
                background: "linear-gradient(90deg,#1e3a5f,transparent)" }}/>;
            }
            const accent = it.color ?? "#7a97b5";
            if (it.kind === "submenu") {
              const openSub = sub === it.label;
              return (
                <div key={it.label}>
                  <Row onClick={() => setSub(openSub ? null : it.label)} title={it.title} accent={accent} on={openSub}>
                    <span style={{ fontSize: 11, flexShrink: 0 }}>{it.icon}</span>
                    <span style={{ whiteSpace: "nowrap" }}>{it.label}</span>
                    <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                      {it.value && <span style={{ fontSize: 7.5, color: accent }}>{it.value}</span>}
                      <span style={{ fontSize: 8, color: "#3a5a7a" }}>{openSub ? "▾" : "▸"}</span>
                    </span>
                  </Row>
                  {openSub && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 1,
                      margin: "2px 0 4px 10px", paddingLeft: 6, borderLeft: "1px solid #16283f" }}>
                      {it.options.map(o => (
                        <Row key={o.id} onClick={() => it.onPick(o.id)} title={o.blurb}
                          accent={o.accent} on={o.on}>
                          <span style={{ width: 9, height: 9, borderRadius: 2, flexShrink: 0,
                            background: o.accent, boxShadow: `0 0 6px ${o.accent}aa` }}/>
                          <span style={{ fontSize: 11, flexShrink: 0 }}>{o.icon}</span>
                          <span style={{ whiteSpace: "nowrap" }}>{o.label}</span>
                        </Row>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            /* action | toggle | cycle */
            return (
              <Row key={it.label} title={it.title} accent={accent}
                on={it.kind === "toggle" ? !!it.on : false}
                onClick={() => { it.onClick(); if (it.kind === "action") { setOpen(false); setSub(null); } }}>
                <span style={{ fontSize: 11, flexShrink: 0 }}>{it.icon}</span>
                <span style={{ whiteSpace: "nowrap" }}>{it.label}</span>
                {it.kind === "toggle" && <Pip on={!!it.on} accent={accent}/>}
                {it.kind === "cycle" && (
                  <span style={{ marginLeft: "auto", fontSize: 8, fontWeight: 800, letterSpacing: 0.6,
                    padding: "1px 6px", borderRadius: 8, flexShrink: 0,
                    background: it.hot ? `${accent}22` : "#0a1020",
                    border: `1px solid ${it.hot ? accent : "#1e3a5f"}`,
                    color: it.hot ? accent : "#3a5a7a" }}>
                    {it.value}
                  </span>
                )}
                {it.kind === "action" && (
                  <span style={{ marginLeft: "auto", fontSize: 8, color: "#2a3a50", flexShrink: 0 }}>›</span>
                )}
              </Row>
            );
          })}
        </div>
      )}
    </div>
  );
}
