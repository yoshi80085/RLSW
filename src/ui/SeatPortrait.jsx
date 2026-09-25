import { useId } from 'react';
import { SEAT_PORTRAIT, artAspect, focusFor, portraitViewBox, cutPaths, duotoneTable } from './seatPortrait.js';

/**
 * 🎭 The chosen Spirit's head in its player's seat banner (Alex, 2026-09-25).
 * Pure presentation: the maths is `seatPortrait.js`, the look is
 * `SeatPortrait.css`, and every taste call is a field of `P` (`SEAT_PORTRAIT`).
 *
 * `spirit` is a `SPIRIT_DEFS` entry or null (nobody chosen yet). `color` is the
 * SEAT's colour — the only colour a Spirit has. `index` is the seat's 0-based
 * number, for the big numeral. `active` is the seat currently choosing.
 *
 * ⚠️ `key={spirit.id}` on the figure is load-bearing: a new pick REMOUNTS it, so
 * the entrance plays again for the new Spirit instead of the old head morphing.
 * 📌 aria-hidden: the banner's own text already names the Spirit.
 */
export function SeatPortrait({ spirit, color, index = 0, active = false, P = SEAT_PORTRAIT, focus }) {
  const uid = useId().replace(/:/g, '');
  const id = spirit?.id;
  const aspect = artAspect(id);
  const f = focusFor(id, focus);
  const vb = portraitViewBox(f, aspect, P);
  const cut = id ? cutPaths(id, P) : null;
  const tables = P.look === 'duotone' ? duotoneTable(color) : null;
  const slantX = Math.tan(P.slant * Math.PI / 180) * P.height;
  const cls = ['seat-portrait', `panel-${P.panel}`, `enter-${P.enter}`, `idle-${P.idle}`,
    `inactive-${P.inactive}`, `look-${P.look}`, active ? 'is-active' : 'is-idle', id ? 'has-spirit' : 'is-empty'].join(' ');
  return <span className={cls} aria-hidden="true" style={{
    '--seat-color':color, '--sp-w':`${P.width * 100}%`, '--sp-h':`${P.height}px`, '--sp-break':`${P.breakout}px`,
    '--sp-slant':`${slantX.toFixed(1)}px`, '--sp-alpha':P.panelAlpha, '--sp-enter':`${P.enterMs}ms`,
    '--sp-glow':`${P.edgeGlow}px`, '--sp-ax':`${P.anchorX * 100}%` }}>
    <span className="seat-portrait-panel"/>
    {P.numeral === 'on' && <span className="seat-portrait-numeral">{index + 1}</span>}
    {id ? <span key={id} className="seat-portrait-fig">
      <svg className="seat-portrait-svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          {cut && <clipPath id={`sp-clip-${uid}`}><path d={cut.clip}/></clipPath>}
          {tables && <filter id={`sp-duo-${uid}`} colorInterpolationFilters="sRGB">
            <feColorMatrix type="saturate" values="0"/>
            <feComponentTransfer>
              <feFuncR type="table" tableValues={tables[0]}/>
              <feFuncG type="table" tableValues={tables[1]}/>
              <feFuncB type="table" tableValues={tables[2]}/>
            </feComponentTransfer>
          </filter>}
        </defs>
        <g className={P.rim === 'on' ? 'seat-portrait-rim' : undefined}>
          <g filter={tables ? `url(#sp-duo-${uid})` : undefined}>
            <image href={spirit.imageSrc} x="0" y="0" width={aspect} height="1" preserveAspectRatio="none"
              clipPath={cut ? `url(#sp-clip-${uid})` : undefined}/>
          </g>
        </g>
        {cut && P.edge === 'on' && <path className="seat-portrait-edge" d={cut.edge} fill="none" stroke={color}
          strokeWidth={P.edgeWidth} strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>}
      </svg>
      {P.enter !== 'none' && <span className="seat-portrait-flash"/>}
    </span> : P.empty === 'ghost' && <span className="seat-portrait-ghost">?</span>}
  </span>;
}
