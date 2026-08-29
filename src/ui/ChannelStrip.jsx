// ─── 🎛️ THE CHANNEL STRIP — the column beside the character card ────────────
//
// The card is the player's amp head: the portrait, the Fame meter and the two
// stat dials are its front panel. This is the strip of switches and the engraved
// plate beside them. Ported from `.scratch/hud-channel-strip.html` at the values
// Alex landed on 2026-08-29.
//
// It holds two things and a meter:
//   ① the TURN RAIL — three lamps, one lit, each carrying its own one-line state
//   ② the KEY PLATE — the root, the mode and the interval map
//   ③ DB Progress, at the foot, where a level meter belongs
//
// ⚠️ WHY THIS IS A COMPONENT AND NOT MARKUP IN THE CLIENT. Everything here is
// SHELL — geometry, lighting, chrome. Every number it displays and every rule
// about which step is live arrives as props from `rlsw-simulator-v3_8_1.jsx`,
// for the same reason `NoteCommitOverlay.jsx` is split that way: a mistake in
// this file can misdraw a lamp but cannot reach the turn state.

import { COMMIT_OVERLAY } from "./NoteCommitOverlay.jsx";

/** 🎛️ ALEX'S DIAL-IN, 2026-08-29. Read off his screenshot of the preview's
 *  control panel; do not nudge these by eye — re-open the page and re-land them.
 *
 *  ⚠️ ONE VALUE OF HIS IS NOT HERE, AND IT IS THE MOST IMPORTANT NOTE IN THIS
 *  FILE. He dialled STRIP WIDTH to 286px. The strip cannot BE 286px. MEASURED,
 *  not reasoned: the shipped client was rendered at viewport widths 720, 980,
 *  1440, 1600 and 1920, and at every one of them the card is 480px, the portrait
 *  column is 238 and **this column is 238**. (The HUD grid is
 *  `minmax(430px, 480px)`; it took its 480 max at every width tested, the board
 *  column absorbing the difference, so the 430 floor never actually occurred.)
 *  My preview page mocked the card wider than the card is — the exact failure
 *  CLAUDE.md's "show it in the real container" rule exists to prevent, and I
 *  walked into it. The strip therefore FLEXES to fill the column, `minWidth`
 *  is insurance against the 430 floor if it is ever reached, and `designWidth`
 *  records what he was looking at when he set everything else. 🎯 To actually
 *  get 286, the HUD column's max has to go 480 → 528 and the board gives up
 *  48px — his call, not mine.
 *
 *  📌 TILT: he dialled -4°. I argued for 0 (the board panels lean because they
 *  float over the board; the HUD is a column of square cards). He looked at both
 *  and chose -4, so -4 ships. Recorded because a future reader will otherwise
 *  find a lean here that contradicts the comment in NoteCommitOverlay.jsx.
 *
 *  📌 `plateTilt` (2026-08-29, second pass): the KEY plate now rakes too, so the
 *  root note reads as leaning against the portrait beside it rather than sitting
 *  square inside a leaning strip. ⚠️ IT IS ITS OWN VALUE, not a re-use of `tilt`.
 *  The strip's `tilt` shears the faceplate the outer paints; `plateTilt` shears
 *  one box that sits INSIDE the already-un-skewed inner. Setting `tilt` and
 *  expecting the plate to follow is the mistake this note exists to prevent —
 *  and 0 here is a legitimate choice that leaves the plate square. */
export const CHANNEL_STRIP = {
  designWidth: 286,   // ⚠️ what he dialled against; NOT what the column gives us
  minWidth:    182,   // below this the lamp names would clip rather than wrap
  tilt:         -4,   // degrees. See 📌 above.
  faceplate:  0.75,   // how dark the strip's own ground is over the card
  sectionGap:   12,   // px between the rail, the plate and the meter
  rivets:     true,

  lampHeight:   34,
  lampGap:       4,
  glow:       0.50,   // multiplier on the lit lamp's outer bloom
  offDepth:   0.56,   // how deep an UNLIT lamp's recess reads
  shape:  'chamfer',  // 'chamfer' | 'bar' | 'notch'
  lit:       'both',  // 'fill' | 'edge' | 'both'
  substate:   true,   // the one-line state under each lamp name
  numerals: 'plain',  // 'plain' | 'circle' | 'none'

  plate:  'engraved', // 'engraved' | 'etched' | 'backlit'
  rootSize:     30,
  bevel:      0.55,
  intervalCols:  2,   // 2 = two columns, 1 = one, 0 = inline
  modeLine:   true,
  plateTilt:    -4,   // degrees. See 📌 below.

  /* 🎵 THE NOTE-STOCK DRAWER, Alex 2026-08-29. The stock stopped being its own
     panel in the column and became a fold inside this plate. ⚠️ ONLY DURING
     STEP 3 — steps 1 and 2 keep the full panel, because there the grid is the
     surface you CLICK to build the melody and a 240px plate is not somewhere to
     do that. By step 3 the same grid is reference, not workspace: "what is left
     for next turn", which is exactly the question the rest of this plate answers.
     📌 `drawerOpen` is only the STARTING state; the player's toggle wins after
     that and the client owns it, so the fold survives a re-render. */
  drawer:      true,
  drawerOpen: false,  // he landed it closed — the plate reads as a key plate first
};

/** 🃏 THE SPIRIT CARD'S GEOMETRY, landed by Alex on the dial-in console
 *  2026-08-29 12:59. It lives HERE, beside the strip's, because the two have to
 *  lean by the same amount or the seam between them opens into a wedge — keeping
 *  them in one object is what makes that impossible to get wrong by half.
 *
 *  📌 THE CARD'S OWN FRAME DOES NOT LEAN, and this is the point of the whole
 *  arrangement, not an oversight. Alex looked at a version where the `.card`
 *  itself was skewed and rejected it: "the blue edge stands straight, all the
 *  tilt takes place within the card." So the frame is a rectangle and the two
 *  SLABS inside it — the strip's faceplate and the portrait column — are what
 *  rake. ⚠️ Do not "simplify" this by moving the skew up onto the card. That
 *  shears the frame, and it also needs ~12px of slack on BOTH columns to stop
 *  clipping "Shredding Ronin", which is a lot of scaffolding for a look he
 *  turned down.
 *
 *  ⚠️ `slack` IS LORE-BEARING. A skew rotates the box but lays the content out
 *  in the pre-skew rectangle, so text near the top-left and bottom-right corners
 *  walks out past the sheared edge and the column's `overflow:hidden` eats it.
 *  Take slack to 0 and the spirit's name loses its first letter. It is padding
 *  with a reason, not a magic number. */
export const SPIRIT_CARD = {
  tilt:          -4,  // MUST track CHANNEL_STRIP.tilt — see 📌 above
  inset:          4,  // px the portrait slab is pulled off the card's right edge
  slack:         11,  // px of horizontal room the shear needs. See ⚠️ above.
  portraitMinH: 182,
  clearWindow:   44,  // the band where the Spirit shows through, unobstructed
  padY:           6,
  gap:            2,  // px under the card, and under the note-stock panel
  artWidth:     134,  // % — un-skewing the art walks its edges in; this covers it
};

const CS = CHANNEL_STRIP;

/* ⚠️ ONE UN-SKEW LAYER, NEVER TWO — the same rule as the board panels, and the
   same failure if it is broken: contents sheared the other way, which reads as a
   rendering bug rather than as a design. */
export function ChannelStrip({ foot, children }) {
  return (
    <div style={{ flex: `1 1 ${CS.designWidth}px`, minWidth: CS.minWidth, order: 1,
      position: "relative", padding: "9px 9px 8px",
      transform: CS.tilt ? `skewX(${CS.tilt}deg)` : undefined,
      background: `linear-gradient(170deg,rgba(6,9,16,${CS.faceplate}),`
                + `rgba(4,6,12,${Math.min(1, CS.faceplate * 1.3).toFixed(2)}))` }}>
      <div style={{ transform: CS.tilt ? `skewX(${-CS.tilt}deg)` : undefined,
        display: "flex", flexDirection: "column", gap: CS.sectionGap, height: "100%" }}>
        {children}
        {/* 📌 `marginTop:auto` is what puts the meter AT THE FOOT — it is not
            decoration, it is the whole of "DB METER: at the foot". */}
        {foot && <div style={{ marginTop: "auto", paddingTop: CS.sectionGap }}>{foot}</div>}
      </div>
      {CS.rivets && [["5px", "auto"], ["auto", "5px"]].map(([top, bottom], i) => (
        <div key={i} style={{ position: "absolute", left: 5, top, bottom, width: 4, height: 4,
          borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(circle at 34% 30%,#5d6a80,#171f2e 70%)",
          boxShadow: "0 0 3px #000a" }} />
      ))}
    </div>
  );
}

/** A titled rule, matching the ones the HUD already uses. */
export function StripSection({ title, accent = "#4488ff", right, children }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
        <span style={{ fontSize: 7, color: "#3a5a7a", letterSpacing: 2 }}>{title}</span>
        <span style={{ flex: 1, height: 1,
          background: `linear-gradient(90deg, ${accent}33, transparent)` }} />
        {right}
      </div>
      {children}
    </div>
  );
}

const NUMERALS = { plain: ["1", "2", "3"], circle: ["①", "②", "③"], none: ["", "", ""] };
const CLIP = {
  chamfer: "polygon(0 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%)",
  notch:   "polygon(7px 0,100% 0,100% 100%,7px 100%,0 50%)",
  bar:     undefined,
};

/**
 * 🎚️ THE TURN RAIL.
 * @param steps  [{ name, color, state }] — three of them, in order.
 * @param current 1 | 2 | 3 — which one is live.
 *
 * ⚠️ AN UNLIT LAMP IS NOT THE LIT ONE FADED. An amp's unselected channel is a
 * dark recess with a dead LED in it. Fading the lit treatment instead gives you
 * three lit lamps of differing brightness, which reads as a PROGRESS BAR and
 * invites "how do I light the other two" — a question the turn order does not
 * want asked. Off gets its own treatment: an inset shadow and a dead LED.
 */
export function TurnRail({ steps, current }) {
  const numerals = NUMERALS[CS.numerals] ?? NUMERALS.plain;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: CS.lampGap }}>
      {steps.map((st, i) => {
        const on = i + 1 === current, done = i + 1 < current;
        const c = st.color;
        const filled = CS.lit === "fill" || CS.lit === "both";
        const edge   = CS.lit === "edge" || CS.lit === "both";
        return (
          <div key={st.name} style={{
            position: "relative", display: "flex", alignItems: "center", gap: 8,
            padding: "0 9px", height: CS.lampHeight, overflow: "hidden", borderRadius: 3,
            clipPath: CLIP[CS.shape],
            border: on ? `1px solid ${c}` : "1px solid #16202f",
            background: on
              ? (filled ? `linear-gradient(100deg,${c}2e,${c}0d)` : "#080d18")
              : "linear-gradient(180deg,#070b13,#0a101c)",
            boxShadow: on
              ? (edge ? `inset 3px 0 0 ${c}, 0 0 ${Math.round(10 * CS.glow)}px ${c}55, `
                      + `inset 0 0 ${Math.round(14 * CS.glow)}px ${c}1f`
                      : `0 0 ${Math.round(10 * CS.glow)}px ${c}55`)
              : `inset 0 2px ${Math.round(5 * CS.offDepth)}px #000c, inset 0 -1px 0 #1a2434`,
          }}>
            {numerals[i] && (
              <div style={{ flexShrink: 0, textAlign: "center",
                fontFamily: "'Saira Stencil One',sans-serif",
                fontSize: Math.round(CS.lampHeight * 0.42), width: Math.round(CS.lampHeight * 0.5),
                color: on ? c : done ? "#2f3f56" : "#232f42",
                textShadow: on ? `0 0 8px ${c}aa` : "none" }}>{numerals[i]}</div>
            )}
            <div style={{ minWidth: 0, lineHeight: 1.15 }}>
              <div style={{ fontFamily: "'Saira Stencil One',sans-serif", letterSpacing: 1.3,
                whiteSpace: "nowrap",
                fontSize: CS.substate ? Math.min(10, CS.lampHeight * 0.26)
                                      : Math.min(11, CS.lampHeight * 0.32),
                color: on ? c : done ? "#3d4d64" : "#2c3a4e",
                textShadow: on ? `0 0 9px ${c}77` : "none" }}>{st.name}</div>
              {CS.substate && (
                <div style={{ fontSize: 7, letterSpacing: .4, marginTop: 2, whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis",
                  color: on ? "#8fa3bd" : done ? "#334357" : "#28344a" }}>
                  {done ? "✓ done" : st.state}
                </div>
              )}
            </div>
            {/* the LED. Lit is the only one that glows; done is dull metal; ahead is dead. */}
            <div style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              width: 5, height: 5, borderRadius: "50%",
              background: on ? c : done ? "#243247" : "#141c2a",
              boxShadow: on ? `0 0 7px ${c}, 0 0 14px ${c}88` : "inset 0 1px 2px #000" }} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * 🔑 THE KEY PLATE.
 * @param intervals [[label, note, colour]] — the colours are passed IN because
 *        they must be the note chips' own colours. A legend drawn in different
 *        colours from the thing it explains is worse than no legend.
 *
 * 🎓 ⚠️ THE THREE `data-tip-anchor` NAMES IN HERE ARE NOT DECORATION AND THEY ARE
 * NOT NEW. `root-note`, `interval-legend` and `derived-mode` used to hang off three
 * blocks under the portrait that said the same things this plate says; those blocks
 * were retired on 2026-08-29 and FOUR tutorial pages point at these names
 * (`rlsw-simulator-v3_8_1.jsx` ~2134, ~2201, ~2231, ~2370). A missing anchor does not
 * throw — `BeginnerTipOverlay` degrades it to a centred card — so deleting one of
 * these breaks Pickles silently, which is the only reason this note is this loud.
 * If the plate is ever restructured, the names move with the meaning, not the div.
 */
export function KeyPlate({ root, mode, intervals, note, locked = false,
  next = false, stock = null, stockOpen = false, stockLeft = 0, onStock }) {
  const bv = CS.bevel;
  const style = CS.plate === "etched"
    ? { background: "#080d17", border: "1px dashed #253449" }
    : CS.plate === "backlit"
      ? { background: "linear-gradient(168deg,#0e1a2c,#080f1c 70%)", border: "1px solid #2a4160",
          boxShadow: `inset 0 0 ${Math.round(22 * bv)}px #4488ff22, 0 0 ${Math.round(10 * bv)}px #4488ff18` }
      : { background: "linear-gradient(168deg,#111827,#0a0f1b 65%)", border: "1px solid #1e2b3f",
          boxShadow: `inset 0 1px 0 rgba(255,255,255,${(0.07 * bv).toFixed(3)}),`
                   + `inset 0 -1px 0 rgba(0,0,0,${(0.8 * bv).toFixed(2)}),0 1px 0 rgba(255,255,255,.03)` };
  const isMajor = String(mode).toLowerCase() === "major";
  /* 🔒 B8 'locked' — the Drive Stack spells a minor chord but Minor Tonality is not
     unlocked, so the mode holds major. ⚠️ THIS AMBER IS NOT A NEW FLOURISH: it is the
     treatment the retired ROOT badge wore, inherited in turn from the old "PICK MODE"
     badge, and it is the HUD advertising the skill at the one moment the player
     actively wants it. The plate is the last readout of the mode, so if it prints a
     placid blue MAJOR here that thread of the design ends. */
  const modeColor = locked ? "#ffcc44" : isMajor ? "#ffd06a" : "#8fa8d8";
  const pt = CS.plateTilt;
  /* ⚠️ ONE UN-SKEW LAYER, NEVER TWO — the same rule as the strip and the board
     panels. The plate's BOX rakes; everything printed on it stays upright, because
     a leaning root letter is a rendering fault and a raked plate is a design.
     📌 The extra horizontal padding is the shear's slack: skew lays the content
     out in the pre-skew rectangle, so without it "m7" walks out past the bottom
     edge and `overflow:hidden` eats it. It scales with the angle for a reason —
     set plateTilt to 0 and it correctly disappears. */
  const plateSlack = Math.round(Math.abs(Math.tan(pt * Math.PI / 180)) * 46);
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 4,
      padding: `9px ${10 + plateSlack}px 10px`,
      transform: pt ? `skewX(${pt}deg)` : undefined, ...style }}>
      <div style={{ transform: pt ? `skewX(${-pt}deg)` : undefined }}>
      <div data-tip-anchor="root-note"
        style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "'Saira Stencil One',sans-serif", lineHeight: 1,
          fontSize: CS.rootSize, color: "#dce8ff",
          textShadow: CS.plate === "backlit" ? "0 0 14px #7fb0ffaa"
                                             : "0 1px 0 #000, 0 0 10px #4488ff33" }}>{root}</span>
        <span style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 8, letterSpacing: 2.4,
          color: modeColor, textShadow: locked ? "0 0 8px #ffcc4466" : undefined }}>
          {locked ? "🔒 " : ""}{isMajor ? "MAJOR" : "MINOR"}</span>
        {/* ↻ ⚠️ THIS BADGE IS THE FIX FOR A SILENT SWITCH, not a decoration.
            Committing the melody REWRITES `rootNote` on the spot — the track's
            last note becomes the next round's root (melodyCommit.js) — so from
            step 3 onward this plate has always been printing a key the player
            has not played in yet, with nothing to say so. The letter changed
            under them at commit and the HUD stayed silent about it. */}
        {next && (
          <span style={{ marginLeft: "auto", fontFamily: "'Saira Stencil One',sans-serif",
            fontSize: 6.5, letterSpacing: 1.6, padding: "1px 5px", borderRadius: 2,
            color: "#ff99dd", background: "#2a0f22", border: "1px solid #ff99dd55" }}>
            ↻ NEXT ROUND</span>
        )}
      </div>
      {CS.intervalCols === 0 ? (
        <div data-tip-anchor="interval-legend"
          style={{ display: "flex", flexWrap: "wrap", gap: "4px 9px", marginTop: 8, fontSize: 8 }}>
          {intervals.map(([k, v, c]) => (
            <span key={k} style={{ color: c }}>{k}=<b style={{ fontWeight: 400, color: "#cfe0f6" }}>{v}</b></span>
          ))}
        </div>
      ) : (
        <div data-tip-anchor="interval-legend"
          style={{ display: "grid", gap: "3px 8px", marginTop: 7,
          gridTemplateColumns: CS.intervalCols === 2 ? "1fr 1fr" : "1fr" }}>
          {intervals.map(([k, v, c]) => (
            <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 5,
              fontSize: 8, letterSpacing: .4 }}>
              <span style={{ color: c }}>{k}</span>
              {/* ⚠️ THE DOTTED LEADER IS NOT DECORATION. Two columns of key/value
                  leave ~80px of nothing between "4th" and "G", and the eye loses
                  the pairing — you read a column of labels and a column of
                  letters. A leader is what an engraved plate does about exactly
                  this, and it is the difference between a table you read at a
                  glance and one you have to parse. */}
              <i style={{ flex: 1, borderBottom: "1px dotted #22314a", transform: "translateY(-2px)" }} />
              <b style={{ fontWeight: 400, color: "#cfe0f6" }}>{v}</b>
            </div>
          ))}
        </div>
      )}
      {CS.modeLine && note && (
        <div data-tip-anchor="derived-mode"
          style={{ fontSize: 7, color: "#55637a", marginTop: 7, lineHeight: 1.4 }}>{note}</div>
      )}
      {/* 🎵 THE DRAWER. It carries `note-stock` while it is up, and the panel in
          the column drops the anchor for exactly as long — one anchor in the DOM
          at all times. ⚠️ TWO ELEMENTS WITH THE SAME `data-tip-anchor` IS A REAL
          BUG, not a tidiness point: BeginnerTipOverlay takes the FIRST match, so
          a duplicate makes Pickles point at whichever happens to be earlier in
          the tree, and it fails silently (a missing anchor just re-centres). */}
      {CS.drawer && stock && (
        <div data-tip-anchor="note-stock"
          style={{ borderTop: "1px solid #1b2740", marginTop: 8, paddingTop: 6 }}>
          <div onClick={onStock} role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStock?.(); } }}
            title={stockOpen ? "Fold the stock away" : "What is left in your hand for next turn"}
            style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
              userSelect: "none" }}>
            <span style={{ fontSize: 8, color: "#3a5a7a",
              display: "inline-block", transition: "transform .2s",
              transform: stockOpen ? "rotate(90deg)" : "none" }}>▶</span>
            <span style={{ fontSize: 7, letterSpacing: 1.8, color: "#3a5a7a" }}>NOTE STOCK</span>
            <span style={{ fontSize: 7, color: "#7fb0ff", marginLeft: "auto" }}>
              {stockLeft} left</span>
          </div>
          {stockOpen && <div style={{ marginTop: 5 }}>{stock}</div>}
        </div>
      )}
      </div>
    </div>
  );
}

// 📌 imported only so the strip and the board panels stay in one conversation:
// if the overlay's tilt ever changes, this file is where you check whether the
// HUD should follow. Referencing it keeps that link greppable.
export const BOARD_TILT = COMMIT_OVERLAY.tilt;
