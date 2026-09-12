// ── ⌐ THE BRACKET ────────────────────────────────────────────────────────────
//
// The one frame primitive the arena's chrome is built from. Corners BRIGHT,
// edges NEARLY DARK, corners chamfered at 45°, and an optional low-alpha scrim
// instead of frosted glass.
//
// 🎯 IT IS NOT A NEW IDEA — IT IS `NoteHex`'S OWN RING, SQUARED OFF. Every note
// chip in the game already wears a corner-bracket ring (`NOTE_HEX.brackets`,
// `bracketR: 0.82`, `bracketEvery: 2`, Alex's dial-in 2026-08-26) and
// `ui/ArenaDial.jsx` wears the same thing around the Drive/Sustain gauge. This
// file is that shape at panel size, so a container finally says what the chips
// inside it have been saying since August.
//
// ⚠️ WHY FOUR FIXED-SIZE CORNERS AND FOUR HAIRLINE EDGES, NOT ONE STRETCHED SVG.
// A single `<svg preserveAspectRatio="none">` sized to the panel distorts the
// 45° cut into whatever the panel's aspect ratio happens to be — a wide panel
// gets shallow corners and a tall one gets steep ones, and the system stops
// reading as one system. Fixed-px corners keep every chamfer identical at any
// panel size, which is the whole point.
//
// ⚠️ `--brk-c` MUST SHRINK ON SMALL CONTROLS. A 17px corner on an 80px button
// consumes the entire perimeter, the faint edges vanish, and the bracket
// silently becomes a plain box — the exact thing this replaces. Pass
// `corner="sm"` for anything button-sized. Found in the preview, not in review.
//
// 📌 NO `backdrop-filter` ANYWHERE. A blurred panel destroys the detail behind
// it even at low alpha, which is what was closing the Cosmic Arena off behind
// its own HUD. The scrim is a flat wash and the arena reads straight through.

/**
 * @param {string}  [plate]       stencil cap that straddles the frame's top edge
 * @param {string}  [plateRight]  a second cap on the same edge, right-aligned
 * @param {string}  [color]       CSS colour for the whole frame; defaults to currentColor
 * @param {boolean} [open]        true = no scrim at all, just the frame
 * @param {'md'|'sm'} [corner]    corner scale. 'sm' for button-sized things.
 * @param {object}  [innerRef]    forwarded to the root, for callers that measure it
 */
export default function Bracket({
  plate, plateRight, color, open = false, corner = 'md',
  innerRef, className = '', style, children, ...rest
}) {
  return (
    <div ref={innerRef} className={`rlsw-brk${open ? ' is-open' : ''}${corner === 'sm' ? ' is-sm' : ''} ${className}`}
      style={{ ...(color ? { color } : null), ...style }} {...rest}>
      <span className="rlsw-brk-scrim" />
      {['tl', 'tr', 'bl', 'br'].map(p => (
        <svg key={p} className={`rlsw-brk-c ${p}`} viewBox="0 0 17 17" aria-hidden="true">
          <path d="M0 17 L0 6.5 L6.5 0 L17 0" />
        </svg>
      ))}
      <i className="rlsw-brk-e t" /><i className="rlsw-brk-e r" />
      <i className="rlsw-brk-e b" /><i className="rlsw-brk-e l" />
      {plate && <span className="rlsw-brk-plate">{plate}</span>}
      {plateRight && <span className="rlsw-brk-plate on-right">{plateRight}</span>}
      <div className="rlsw-brk-body">{children}</div>
    </div>
  );
}

// Concatenated into `MatchSurface.jsx`'s SURFACE_CSS — one stylesheet for the
// arena, the same arrangement `ActionRail.jsx` has with `GameStyles.jsx`.
// ⚠️ `.match-surface` renders in BOTH layouts, so these rules are live on the
// 2D board too; the board panels that use them are inside it either way.
export const BRACKET_CSS = `
  .rlsw-brk { position:relative; --brk-c:17px; --brk-cut:7px; --brk-scrim:rgba(6,12,26,.42); }
  .rlsw-brk.is-sm { --brk-c:10px; --brk-cut:5px; }
  .rlsw-brk-scrim { position:absolute; inset:0; background:var(--brk-scrim); pointer-events:none;
    clip-path:polygon(var(--brk-cut) 0,calc(100% - var(--brk-cut)) 0,100% var(--brk-cut),
      100% calc(100% - var(--brk-cut)),calc(100% - var(--brk-cut)) 100%,var(--brk-cut) 100%,
      0 calc(100% - var(--brk-cut)),0 var(--brk-cut)); }
  .rlsw-brk.is-open > .rlsw-brk-scrim { display:none; }
  .rlsw-brk-c { position:absolute; width:var(--brk-c); height:var(--brk-c); overflow:visible;
    stroke:currentColor; stroke-width:1.1; fill:none; opacity:.72;
    stroke-linecap:round; stroke-linejoin:round; pointer-events:none; transition:opacity .18s; }
  .rlsw-brk-c.tl { left:0; top:0 }
  .rlsw-brk-c.tr { right:0; top:0; transform:scaleX(-1) }
  .rlsw-brk-c.bl { left:0; bottom:0; transform:scaleY(-1) }
  .rlsw-brk-c.br { right:0; bottom:0; transform:scale(-1) }
  .rlsw-brk-e { position:absolute; background:currentColor; opacity:.17; pointer-events:none; }
  .rlsw-brk-e.t { left:var(--brk-c); right:var(--brk-c); top:0; height:1px }
  .rlsw-brk-e.b { left:var(--brk-c); right:var(--brk-c); bottom:0; height:1px }
  .rlsw-brk-e.l { top:var(--brk-c); bottom:var(--brk-c); left:0; width:1px }
  .rlsw-brk-e.r { top:var(--brk-c); bottom:var(--brk-c); right:0; width:1px }
  .rlsw-brk-body { position:relative; z-index:1 }
  /* the nameplate — a stencil cap ON the line, exactly like the dial's DRIVE */
  .rlsw-brk-plate { position:absolute; top:-1px; left:calc(var(--brk-c) - 3px); z-index:2;
    transform:translateY(-50%); padding:0 5px; background:#06101f;
    font:400 6.4px 'Saira Stencil One',sans-serif; letter-spacing:1.9px;
    color:currentColor; opacity:.95; white-space:nowrap; pointer-events:none; }
  .rlsw-brk-plate.on-right { left:auto; right:calc(var(--brk-c) - 3px) }
  /* ⭐ THE ACTIVE STEP, WITHOUT A NEW PROP. The client already hangs
     '.step-active' on the panel for the phase it belongs to, so the bracket
     reads that instead of asking for another flag — brighter corners and a
     breath of glow, where a filled panel used to change its whole background. */
  .rlsw-brk.step-active > .rlsw-brk-c { opacity:1 }
  .rlsw-brk.step-active > .rlsw-brk-e { opacity:.3 }
  .rlsw-brk.step-active > .rlsw-brk-scrim { box-shadow:0 0 22px -6px currentColor }
`;
