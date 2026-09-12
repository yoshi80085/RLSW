import { useEffect, useRef, useState } from 'react';

// ── 🖱️ THE POINTER ────────────────────────────────────────────────────────────
// A real arrowhead, not a chevron: black glass inside, a hot white rim, and a
// cyan bloom. The four points and the rim thickness were fitted numerically to
// Alex's reference screenshot (2026-09-11) — the black core of this path,
// rendered and blurred to that screenshot's scale, overlaps the reference's own
// black core at 94%. ⚠️ **Do not "tidy" the decimals.** They are measurements,
// not taste: TIP → WING → NOTCH → TAIL, with the notch the one concave corner.
//
// 📌 Kept as DOM/SVG rather than a CSS `cursor:url()` so it animates identically
// over the title screen, the lobby, the WebGL arena, the HUD and every overlay,
// and so the press can move it — a CSS cursor image cannot bob.
const TIP = [4, 3];            // the hotspot, in SVG units == CSS px
const PATH = 'M4 3 L26.9 13.4 L16.8 17.8 L10.5 27.2 Z';
const RIM = 2.95;              // rim thickness, same ratio as the reference
// The tail sits 25 units from the tip along (0.259, 0.966) — the arrow's own
// axis. The press bob travels down THAT line, so the mark dips the way it
// points instead of sliding sideways.
const BOB = { x: 0.259, y: 0.966 };
// ⚠️ TEXT ENTRY KEEPS THE NATIVE I-BEAM. `GameStyles.jsx` has always said so —
// room codes and set lists have to be legible to type into — but the rule lived
// in the CSS cursor this component replaced, and went out with it. The arrow
// hides over a text field so the two are never drawn at once.
const TEXT_FIELD = 'input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=range]),textarea,[contenteditable="true"]';
const dip = d => `translate(${(BOB.x * d).toFixed(2)}px, ${(BOB.y * d).toFixed(2)}px)`;

export default function GlobalCursor() {
  const [point, setPoint] = useState({ x: -80, y: -80, pressed: false, click: 0, onText: false });
  const frame = useRef(null);
  const latest = useRef(point);

  useEffect(() => {
    const overText = event => !!(event.target?.closest?.(TEXT_FIELD));
    const update = event => {
      latest.current = { ...latest.current, x: event.clientX, y: event.clientY, onText: overText(event) };
      if (frame.current == null) frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setPoint(p => ({ ...p, x: latest.current.x, y: latest.current.y, onText: latest.current.onText }));
      });
    };
    const press = event => {
      latest.current = { ...latest.current, x: event.clientX, y: event.clientY, pressed: true, click: latest.current.click + 1, onText: overText(event) };
      setPoint(latest.current);
    };
    const release = () => {
      latest.current = { ...latest.current, pressed: false };
      setPoint(latest.current);
    };
    const leave = () => setPoint(p => ({ ...p, x: -80, y: -80 }));
    window.addEventListener('pointermove', update, { passive: true });
    window.addEventListener('pointerdown', press, { passive: true });
    window.addEventListener('pointerup', release, { passive: true });
    window.addEventListener('pointercancel', release, { passive: true });
    window.addEventListener('blur', release);
    document.documentElement.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('pointermove', update);
      window.removeEventListener('pointerdown', press);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
      document.documentElement.removeEventListener('mouseleave', leave);
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const origin = `${TIP[0]}px ${TIP[1]}px`;

  return <>
    <style>{`
      html, body, #root, #root * { cursor:none !important; }
      /* The ONE exception — see TEXT_FIELD above. */
      input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=range]),
      textarea, [contenteditable="true"] { cursor:text !important; }
      /* One dip down the arrow's own axis, one small rebound, then still.
         ⚠️ Scale pivots on the TIP, so the hotspot never leaves the pixel the
         browser thinks it is on — only the body of the mark moves. */
      @keyframes rlsw-cursor-bob {
        0%   { transform:${dip(0)} scale(1); }
        16%  { transform:${dip(2.8)} scale(.905); }
        42%  { transform:${dip(-1)} scale(1.035); }
        68%  { transform:${dip(.45)} scale(.995); }
        100% { transform:${dip(0)} scale(1); }
      }
      @media (prefers-reduced-motion: reduce) {
        [data-rlsw-cursor-bob] { animation:none !important; }
      }
    `}</style>
    <div aria-hidden="true" data-rlsw-cursor style={{
      position:'fixed', left:point.x, top:point.y, width:30, height:30,
      zIndex:2147483647, pointerEvents:'none',
      opacity:point.onText ? 0 : 1,
      transform:`translate(${-TIP[0]}px, ${-TIP[1]}px)`,
      filter:point.pressed
        ? 'drop-shadow(0 0 1.3px #ffffff) drop-shadow(0 0 6px #9df0ff) drop-shadow(0 0 15px rgba(60,170,255,.78))'
        : 'drop-shadow(0 0 1.1px #ffffff) drop-shadow(0 0 4px #8ceaff) drop-shadow(0 0 10px rgba(46,150,255,.62))',
      transition:'filter .12s ease-out',
    }}>
      {/* Held-down settle. Separate element from the bob so a long press keeps
          its dent while the bob plays out and finishes. */}
      <div style={{
        transform:`scale(${point.pressed ? .965 : 1})`, transformOrigin:origin,
        transition:'transform .09s cubic-bezier(.2,.8,.2,1)',
      }}>
        <div key={point.click} data-rlsw-cursor-bob style={{
          transformOrigin:origin, willChange:'transform',
          animation:point.click > 0 ? 'rlsw-cursor-bob .34s cubic-bezier(.22,.9,.3,1)' : undefined,
        }}>
          <svg width="30" height="30" viewBox="0 0 30 30" overflow="visible" display="block">
            {/* Rim first as one stroked-and-filled path: a centred stroke with a
                round join gives the reference's soft corners for free, and keeps
                the black core exactly the shape that was measured. */}
            {/* ⚠️ ONE stroke, not two. An inner cyan line was tried and cut: at
                the size this actually renders it reads as a seam down the middle
                of the rim, and the reference's rim is unbroken. The blue lives in
                the bloom and in the rim's tint, never as a second edge. */}
            <path d={PATH} fill="#000" stroke="#eefcff" strokeWidth={RIM} strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  </>;
}
