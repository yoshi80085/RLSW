import { useMemo } from 'react';
import { ScaleWheel } from './ScaleWheel.jsx';
import { POCKET_WHEEL } from './scaleWheelModel.js';
import { WHEEL_GEO, cursedWheelModel, cracksFor } from './cursedWheelModel.js';
import { CURSED_SHAMISEN, EXORCISE_NOTES } from '../board/cursedShamisen.js';

/**
 * 🎡🌑 THE INFECTION ON THE RIVAL'S SCALE WHEEL — moment ③ of the Iwato curse,
 * and the one Alex's rival sees (`RONIN_ABILITY_DESIGN.md` §2.3.00): *"the
 * Rival's note wheel becomes 'infected'"*. It TEACHES the rule without a word:
 * ink bleeds in from the rim, their own scale cracks and greys, and the five
 * Iwato notes (on the RONIN'S root) light ghost-violet. The hub shows 呪 and the
 * countdown wisps sit at twelve o'clock.
 *
 * ⭐ IT IS THE REAL WHEEL UNDERNEATH (`ScaleWheel`), with an SVG laid exactly on
 * top in the wheel's own geometry (`WHEEL_GEO`, guarded by the suite). Every
 * motion is CSS, keyed on `phase`, so nothing here runs a frame loop.
 *
 * @param phase  'none' | 'cursed' | 'exorcised' | 'expired'
 * @param since  a key that changes when the phase starts (restarts the CSS)
 * @param canExorcise  false on their SECOND cursed turn — the readout then says
 *   so instead of offering a cure the rules will refuse (`iwatoCurse.js`)
 * @param wheel  everything else the plain wheel takes in the match (`available`,
 *   `line`, `onPick`, `next`, `onHoverNote`) — passed straight through, so a
 *   cursed hand still composes from the wheel exactly as an uncursed one does
 */
export function CursedWheel({ spiritId, root, roninRoot, hand = [], phase = 'none', turnsLeft = 2, since = 0,
  look = CURSED_SHAMISEN, opts = POCKET_WHEEL, roninColor = '#4488ff', canExorcise = true, ...wheel }) {
  const m = useMemo(() => cursedWheelModel({ spiritId, root, roninRoot, hand }), [spiritId, root, roninRoot, hand]);
  const cracks = useMemo(() => cracksFor(m.ownPoly), [m]);
  const { VB, C, R, CHIP } = WHEEL_GEO;
  const on = phase !== 'none';
  const style = { '--ink-ms':`${look.wheelInkMs}ms`, '--end-ms':`${phase === 'exorcised' ? look.ofudaBurnMs : look.expireMs}ms`,
    '--curse':look.edgeColor, '--glow':look.wheelIwatoGlow, '--ronin':roninColor, width:opts.size, height:opts.size };
  return <div className={`cw-wrap cw-${phase}`} data-cursed-wheel={phase}>
    <ScaleWheel spiritId={spiritId} root={root} hand={hand} opts={opts} {...wheel}/>
    {on && <svg key={`${phase}-${since}`} className="cw-over" viewBox={`0 0 ${VB} ${VB}`} style={style} aria-hidden="true">
      <defs>
        <filter id="cw-ink-edge" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="4" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="18"/>
        </filter>
        <radialGradient id="cw-ink" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#07020f" stopOpacity="0"/><stop offset="80%" stopColor="#12051f" stopOpacity=".8"/><stop offset="100%" stopColor="#04010a" stopOpacity=".95"/>
        </radialGradient>
      </defs>
      <g className="cw-body">
        {/* the ink, bleeding in from the rim */}
        <circle className="cw-ink" cx={C} cy={C} r={R + 40} fill="url(#cw-ink)" filter="url(#cw-ink-edge)"/>
        <circle className="cw-inkring" cx={C} cy={C} r={R + 30} fill="none" stroke="#0a0314" filter="url(#cw-ink-edge)"/>
        {/* their own scale: shrouded, then cracked */}
        <circle className="cw-dead" cx={C} cy={C} r={WHEEL_GEO.R_IN + 8} fill="#06030d" style={{ animationDelay:'150ms' }}/>
        {look.wheelCracks === 'on' && cracks.map((pts, i) => <polyline key={i} className="cw-crack" points={pts} fill="none"
          stroke={look.edgeColor} strokeWidth="1.4" style={{ animationDelay:`${300 + i * 90}ms` }}/>)}
        {/* every slot that is not Iwato goes dead */}
        {m.slots.filter(s => !s.iwato).map(s => <circle key={s.pc} className="cw-dead" cx={s.xy[0]} cy={s.xy[1]} r={CHIP * 0.56}
          fill="#06030d" style={{ animationDelay:`${200 + s.k * 40}ms` }}/>)}
        {/* the five Iwato notes, ghost-violet */}
        <polygon className="cw-poly" points={m.iwatoPoly} fill={look.edgeColor} fillOpacity=".14" stroke={look.edgeColor} strokeWidth="1.8"/>
        {m.slots.filter(s => s.iwato).map(s => <g key={s.pc} className="cw-iwato" style={{ animationDelay:`${500 + s.k * 60}ms` }}>
          <circle cx={s.xy[0]} cy={s.xy[1]} r={CHIP * 0.5} fill="#170a30"/>
          <text x={s.xy[0]} y={s.xy[1] + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#efe4ff" fontFamily="Saira, sans-serif">{s.name}</text>
          <circle cx={s.xy[0]} cy={s.xy[1]} r={CHIP * 0.68} fill="none" stroke={look.edgeColor} strokeWidth="2.4"/>
          <text x={s.xy[0]} y={s.xy[1] - CHIP * 0.78} textAnchor="middle" fontSize="11" fill="#e6d4ff" fontFamily="Share Tech Mono, monospace">{s.degree}</text>
        </g>)}
        {/* the hub: the curse's mark */}
        {look.wheelGlyph === 'on' && <g className="cw-hub">
          <circle cx={C} cy={C} r="34" fill="#0a0414" stroke={look.edgeColor} strokeWidth="1.5"/>
          <text x={C} y={C + 10} textAnchor="middle" fontSize="30" fill={look.edgeColor} fontFamily="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif">{look.ofudaGlyph}</text>
          <text x={C} y={C + 24} textAnchor="middle" fontSize="7.5" letterSpacing="2" fill="#cdb6ff" fontFamily="Share Tech Mono, monospace">IWATO</text>
        </g>}
        {/* the countdown: one wisp per cursed turn left */}
        {[0, 1].map(i => <g key={i} className={`cw-wisp${i < turnsLeft ? '' : ' is-out'}`} transform={`translate(${C - 12 + i * 24} ${C - R - 44})`}>
          <path d="M0 -10 C4 -4 7 1 6 5 A6 6 0 1 1 -6 5 C-7 1 -4 -4 0 -10Z" fill="#dcd2ff" stroke={look.edgeColor} strokeWidth="1.2"/>
        </g>)}
        {phase === 'exorcised' && <circle className="cw-burst" cx={C} cy={C} r={R} fill="none" stroke="#fff" strokeWidth="6"/>}
      </g>
    </svg>}
    {on && <div className="cw-readout">
      {phase === 'cursed' && !canExorcise
        ? <>CURSED · your scale is <b>IWATO</b> ({m.names.join(' ')}) · {turnsLeft} turn{turnsLeft !== 1 ? 's' : ''} left · too late to exorcise</>
        : phase === 'cursed'
        ? <>CURSED · your scale is <b>IWATO</b> · exorcise with {EXORCISE_NOTES} of <b>{m.names.join(' ')}</b>
            <span className={m.heldIwato >= EXORCISE_NOTES ? 'cw-ok' : 'cw-no'}> · you hold {m.heldIwato}</span></>
        : phase === 'exorcised' ? <span className="cw-ok">EXORCISED — your scale is yours again</span>
        : <span>the curse fades…</span>}
    </div>}
  </div>;
}
