// ─── 🎛️ THE NOTE COMMIT OVERLAY — PANEL CHROME ──────────────────────────────
//
// The look Alex dialled in on `.scratch/note-commit-overlay.html`, ported to the
// client. This file holds the SHELL ONLY: where each panel sits on the board,
// what it is drawn on, and the amp knob that rides on the two chord stacks.
// Every number the panels display, and every click they answer to, stays in
// `rlsw-simulator-v3_8_1.jsx` and arrives here as `children`.
//
// ⚠️ WHY THE SPLIT IS SHELL-VS-CONTENT AND NOT "MOVE THE WHOLE PANEL OVER".
// The commit region is where the 2026-08-26 Shamisen rework cut across a
// function boundary and shipped a game that could not leave turn one — it took
// `setMovedThisTurn(false)` and `setAction('move')` with it, and all eighteen
// suites stayed green while it did (SEQUENCING.md §5). The safest possible
// restyle is therefore one that CANNOT reach the commit path: this component
// owns only the box the existing markup is drawn inside, so a mistake in here
// can misplace a panel but cannot lose a state setter.
//
// 📌 THE PERCENTAGES ARE THE PREVIEW'S, UNCHANGED. The preview's board div was
// authored at the client's own `maxWidth:1040` with a comment saying exactly
// that, so `left:3%` here means what it meant on the page Alex dialled.

import { StatKnob } from "./StatKnob.jsx";

const DRIVE_C   = "#ff6644";
const SUSTAIN_C = "#44aaff";

/** 🎛️ THE ONLY THINGS MEANT TO BE TUNED.
 *  ⚠️ ALEX HAS NOT DIALLED THESE. Every other number in this file was read off
 *  a control panel he set; these four are my guesses about where a 38px knob
 *  wants to sit on a 620px stage, carried over from the preview's defaults.
 *  They have sliders on `.scratch/note-commit-overlay.html` (the STACK DIAL
 *  row) — re-open it, land them, and change them here, rather than nudging
 *  numbers blind. */
export const COMMIT_OVERLAY = {
  knobScale: 1.90,   // magnifies StatKnob whole; see ⚠️ below
  knobX:     44,     // px in from the panel's INNER edge (the two dials face
                     // each other across the middle of the board)
  knobY:     22,     // px down from the panel top
  ghostBoost: true,  // hover preview rides StatKnob's own `boost` channel
  tilt:      -6,     // degrees of skew on every panel ("TILT")
  trackChip: 69,     // px box per commit-track seat  ("TRACK CHIP")
  stackChip: 72,     // px box per chord-stack seat   ("STACK CHIP")
  // 🔷 THE HONEYCOMB. A column steps 0.78× the chip box across and odd columns
  // drop 0.45× down, which is what makes the seats INTERLOCK instead of sitting
  // in a row. Straight from the preview's nest builder; do not round them.
  nestStepX: 0.78,
  nestDropY: 0.45,
  nestRowY:  0.90,   // vertical step between whole rows (only one row today)
};

/* 🐛 THE SUSTAIN DIAL WAS SITTING ON A COMMITTED NOTE, AND THE HONEYCOMB IS
   WHAT FIXES IT. `knobX` is measured from the panel's INNER edge — the two
   dials face each other across the middle of the board. For Drive (panel on the
   left, dial on its right) that is empty space. For Sustain the inner edge is
   its LEFT edge, exactly where the seats used to start.

   The preview answers this by MIRRORING the panel rather than padding it: the
   seat nest is anchored to each panel's OUTER edge and grows inward, away from
   the dial. Six 72px seats in the honeycomb are 5×0.78×72 + 72 = 353px wide, so
   on a 468px panel the last seat still stops ~105px short of the inner edge and
   the dial occupies 27–99px of it. They cannot meet.

   ⚠️ THE PREVIOUS PASS SHRANK THE CHIPS TO 58 TO SOLVE THIS AND SHOULD NOT
   HAVE. Six 72px chips in a ROW need 447px and genuinely do not fit — but the
   preview never laid them in a row. Interlocking them buys back 94px, which is
   the whole difference. The lesson is the general one: when a dialled number
   does not fit, check whether the LAYOUT was ported before deciding the number
   was wrong. */
/* ⚠️ WHY A TRANSFORM AND NOT A SIZE PROP. StatKnob has no size parameter —
   every number in it is absolute px (dots on a radius of 16 about (19,19), a
   30px cap inset 4px, a 13px readout). Drawing it larger would mean re-deriving
   all of that by eye, and the result would no longer BE the HUD's knob, which
   is the one thing Alex asked for. Scaling the finished object keeps the
   geometry bit-identical and keeps "is it the same dial?" a separate question
   from "does it read at stage size?". */
/* ⚠️ ONE UN-SKEW LAYER, NEVER TWO. The panel leans; its contents stand back up
   exactly once. Nest a second one — an unskewed row inside an unskewed
   wrapper — and the inner contents come out sheared the OTHER way, which looks
   like a rendering bug rather than a design. The preview page carries the same
   warning next to the same line. 📌 The dial is deliberately NOT inside this:
   at 6° a knob leaning with its panel reads as a physical dial mounted on a
   slanted faceplate, which is the point of the slant. */
function Unskew({ children }) {
  return <div style={{ transform:`skewX(${-COMMIT_OVERLAY.tilt}deg)` }}>{children}</div>;
}

function ScaledKnob({ side, label, value, boost, color }) {
  return (
    <div style={{ position:"absolute", top:COMMIT_OVERLAY.knobY,
      [side === "drive" ? "right" : "left"]: COMMIT_OVERLAY.knobX,
      width:38, height:38, zIndex:3, pointerEvents:"none",
      transform:`scale(${COMMIT_OVERLAY.knobScale})`, transformOrigin:"50% 50%" }}>
      <StatKnob label={label} value={value} boost={boost} color={color} />
    </div>
  );
}

/* 🎸 ONE CHORD STACK, as a panel flanking the bottom of the board.
   📌 `boost` HERE MEANS THE HOVER PREVIEW, NOT THE COMBAT MODIFIERS. The HUD's
   copy of this knob (rlsw-simulator §12568) already spends `boost` on live
   combat modifiers — tempDrive, moshDrive, the Dissonance Edge. Spending it on
   the same thing twice would say nothing new; spending it on "where would this
   note take me" is what the preview's phantom needle did, and it is the
   question you are actually asking while a note is under the cursor. A note
   that would make the stat WORSE gets StatKnob's red docked dots for free —
   something the phantom needle never expressed. */
export function ChordStackPanel({ side, value, boost = 0, panelRef, tipAnchor,
                                  className, glowColor, borderColor, children }) {
  const isDrive = side === "drive";
  const color   = isDrive ? DRIVE_C : SUSTAIN_C;
  return (
    <div ref={panelRef} data-tip-anchor={tipAnchor} className={className}
      style={{ "--step-glow-color": glowColor ?? color,
        position:"absolute", bottom:"3%", [isDrive ? "left" : "right"]:"3%",
        width:"45%", padding:"8px 11px", borderRadius:5, zIndex:5,
        transform:`skewX(${COMMIT_OVERLAY.tilt}deg)`,
        backdropFilter:"blur(5px)",
        // 🔴🔵 THE PANEL IS OUTLINED IN ITS OWN STAT'S COLOUR — Drive red, Sustain
        // blue — and that outline is the ONLY thing on the board that says which
        // stack you are looking at from across the screen. It used to be a flat
        // 40%-alpha hairline plus a black drop shadow, so both panels read as the
        // same dark box and you had to find the label to tell them apart.
        // ⚠️ THE OUTER SHADOWS DO NOT REPLACE THE BLACK ONE, THEY FOLLOW IT. The
        // panel sits on a bright board; without something dark underneath, a
        // coloured glow over neon hexes just reads as more neon.
        boxShadow:`0 3px 16px #000000aa, 0 0 12px ${color}66, 0 0 30px ${color}33, `
                + `inset 0 0 12px ${color}22`,
        background: isDrive ? "linear-gradient(120deg,#2a0f0add,#12060abb)"
                            : "linear-gradient(240deg,#08202edd,#06121ebb)",
        border:`1px solid ${borderColor ?? color}` }}>
      <ScaledKnob side={side} label={isDrive ? "DRIVE" : "SUSTAIN"}
                  value={value} boost={boost} color={color} />
      <Unskew>{children}</Unskew>
    </div>
  );
}

/* 🔷 ONE CHORD STACK'S SEATS, laid out as a honeycomb anchored to the panel's
   OUTER edge. ⚠️ THE SEATS ARE ABSOLUTELY POSITIONED AND THE NEST HAS NO
   INTRINSIC HEIGHT — it must be told one, or the panel collapses around zero
   and the chips hang out of the bottom of it. That is why `height` is computed
   here from the same three numbers the offsets use, rather than left to flow. */
export function StackNest({ rows = 1, children }) {
  const K = COMMIT_OVERLAY;
  return (
    <div style={{ position:"relative", width:"100%",
      height: (rows * K.nestRowY + K.nestDropY) * K.stackChip }}>
      {children}
    </div>
  );
}

/** Where seat `col` of the nest sits, as absolute-position styles.
 *  The anchored edge flips per side so both stacks grow AWAY from the dial. */
export function stackSeatPos(side, col, row = 0) {
  const K = COMMIT_OVERLAY;
  return {
    position: "absolute",
    [side === "drive" ? "left" : "right"]: col * K.stackChip * K.nestStepX,
    top: row * K.stackChip * K.nestRowY + (col % 2) * K.stackChip * K.nestDropY,
    width: K.stackChip, height: K.stackChip,
  };
}

/* 🎼 THE COMMIT TRACK, spanning the top of the board rather than floating
   centred. The preview widened it because eight seats plus the payout colours
   were being squeezed into "auto" width and wrapping on a narrow board. */
export function CommitTrackPanel({ panelRef, tipAnchor, className, active, children }) {
  return (
    <div ref={panelRef} data-tip-anchor={tipAnchor} className={className}
      style={{ "--step-glow-color":"#aa88ff",
        transform:`skewX(${COMMIT_OVERLAY.tilt}deg)`,
        position:"absolute", top:"2%", left:"3%", right:"3%",
        padding:"7px 12px 8px", borderRadius:5, zIndex:5,
        backdropFilter:"blur(5px)", boxShadow:"0 3px 16px #000000aa",
        background:"#060a10dd", display:"flex", alignItems:"center", gap:6,
        border:`1px solid ${active ? "#aa88ff55" : "#1a2a4044"}` }}>
      {/* ⚠️ The un-skew wrapper is a FLEX ROW here, because the track's children
          are flex items of the panel itself — wrapping them in a plain div would
          take them out of that row and stack the eight seats vertically. */}
      <div style={{ transform:`skewX(${-COMMIT_OVERLAY.tilt}deg)`, display:"flex",
        alignItems:"center", gap:6, width:"100%" }}>{children}</div>
    </div>
  );
}

/* ⚔️↔🛡️ THE PAYOUT ROUTER, sitting under the track at whatever height the
   track's readout leaves it. `top` is passed in because only the client knows
   how tall the track rendered this turn. */
export function PayoutRouterPanel({ top, children }) {
  return (
    <div style={{ position:"absolute", left:"6%", right:"6%", top,
      transform:`skewX(${COMMIT_OVERLAY.tilt}deg)`,
      background:"#060a10cc", border:"1px solid #7a5aa044", borderRadius:5,
      zIndex:5, backdropFilter:"blur(5px)", boxShadow:"0 3px 16px #000000aa",
      display:"flex", alignItems:"center", gap:7, flexWrap:"wrap",
      justifyContent:"center", padding:"4px 12px", minHeight:24 }}>
      {children}
    </div>
  );
}
