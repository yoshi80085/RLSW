import { useMemo } from 'react';
import { ScaleWheel } from './ScaleWheel.jsx';
import { POCKET_WHEEL } from './scaleWheelModel.js';
import { WHEEL_GEO, cursedWheelModel, cracksFor } from './cursedWheelModel.js';
import { CURSED_SHAMISEN, CURSE_TURNS, HAUNTED_NOTES } from '../board/cursedShamisen.js';

/**
 * 🎡🌑 THE INFECTION ON THE RIVAL'S SCALE WHEEL — what the cursed Rival sees.
 * It TEACHES the rule without a word: ink bleeds in from the rim, their own
 * scale cracks and greys, and the five Iwato notes (on the CURSE'S root — v3:
 * the trapped Lost Chord) light ghost-violet. ⭐ v3 (2026-10-09): the three
 * HAUNTED notes are black with a pulsing violet ring (colour plus motion, so it
 * reads on a dark arena); a lifted one goes back to violet with a ✓. The hub
 * shows 呪; the wisps at twelve o'clock count the cursed turns left.
 *
 * ⭐ IT IS THE REAL WHEEL UNDERNEATH (`ScaleWheel`), with an SVG laid exactly on
 * top in the wheel's own geometry (`WHEEL_GEO`, guarded by the suite). Every
 * motion is CSS, keyed on `phase`, so nothing here runs a frame loop.
 *
 * @param phase  'none' | 'cursed' | 'exorcised' | 'expired'
 * @param since  a key that changes when the phase starts (restarts the CSS)
 * @param roninRoot the curse's root (the name is v1's)
 * @param haunted [{ pc, lifted }] — the haunted notes (`iwatoCurse.js` hauntedNotes)
 * @param wheel  everything else the plain wheel takes in the match (`available`,
 *   `line`, `onPick`, `next`, `onHoverNote`) — passed straight through, so a
 *   cursed hand still composes from the wheel exactly as an uncursed one does
 */
export function CursedWheel({ spiritId, root, roninRoot, hand = [], haunted = [], phase = 'none', turnsLeft = CURSE_TURNS, since = 0,
  look = CURSED_SHAMISEN, opts = POCKET_WHEEL, roninColor = '#4488ff', ...wheel }) {
  const hauntKey = haunted.map(h => `${h.pc}${h.lifted ? 'x' : ''}`).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const m = useMemo(() => cursedWheelModel({ spiritId, root, roninRoot, hand, haunted }), [spiritId, root, roninRoot, hand, hauntKey]);
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
        {m.slots.filter(s => s.iwato).map(s => <g key={s.pc} className={`cw-iwato${s.haunted ? ' cw-haunted' : ''}${s.lifted ? ' cw-lifted' : ''}`}
          data-haunted={s.haunted ? 'on' : s.lifted ? 'lifted' : undefined} style={{ animationDelay:`${500 + s.k * 60}ms` }}>
          <circle cx={s.xy[0]} cy={s.xy[1]} r={CHIP * 0.5} fill={s.haunted ? '#000' : '#170a30'}/>
          <text x={s.xy[0]} y={s.xy[1] + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill={s.haunted ? '#c9a6ff' : '#efe4ff'} fontFamily="Saira, sans-serif">{s.name}</text>
          <circle cx={s.xy[0]} cy={s.xy[1]} r={CHIP * 0.68} fill="none" stroke={look.edgeColor} strokeWidth={s.haunted ? 3.4 : 2.4}/>
          {/* 👻 a haunted note: a second ring breathes outward (motion, not only colour) */}
          {s.haunted && <circle className="cw-haunt-ring" cx={s.xy[0]} cy={s.xy[1]} r={CHIP * 0.68} fill="none" stroke={look.edgeColor} strokeWidth="2"/>}
          {s.lifted && <text x={s.xy[0] + CHIP * 0.5} y={s.xy[1] + CHIP * 0.62} textAnchor="middle" fontSize="13" fill="#9dffcf" fontFamily="Saira, sans-serif">✓</text>}
          <text x={s.xy[0]} y={s.xy[1] - CHIP * 0.78} textAnchor="middle" fontSize="11" fill="#e6d4ff" fontFamily="Share Tech Mono, monospace">{s.degree}</text>
        </g>)}
        {/* the hub: the curse's mark */}
        {look.wheelGlyph === 'on' && <g className="cw-hub">
          <circle cx={C} cy={C} r="34" fill="#0a0414" stroke={look.edgeColor} strokeWidth="1.5"/>
          <text x={C} y={C + 10} textAnchor="middle" fontSize="30" fill={look.edgeColor} fontFamily="'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP',serif">{look.ofudaGlyph}</text>
          <text x={C} y={C + 24} textAnchor="middle" fontSize="7.5" letterSpacing="2" fill="#cdb6ff" fontFamily="Share Tech Mono, monospace">IWATO</text>
        </g>}
        {/* the countdown: one wisp per cursed turn left */}
        {Array.from({ length:CURSE_TURNS }, (_, i) => <g key={i} className={`cw-wisp${i < turnsLeft ? '' : ' is-out'}`} transform={`translate(${C - (CURSE_TURNS - 1) * 12 + i * 24} ${C - R - 44})`}>
          <path d="M0 -10 C4 -4 7 1 6 5 A6 6 0 1 1 -6 5 C-7 1 -4 -4 0 -10Z" fill="#dcd2ff" stroke={look.edgeColor} strokeWidth="1.2"/>
        </g>)}
        {phase === 'exorcised' && <circle className="cw-burst" cx={C} cy={C} r={R} fill="none" stroke="#fff" strokeWidth="6"/>}
      </g>
    </svg>}
    {on && <div className="cw-readout">
      {phase === 'cursed'
        ? <>CURSED · your scale is <b>IWATO</b> ({m.names.join(' ')}) · play the <b>haunted</b> notes ◉ to lift it
            <span className={m.liftedCount ? 'cw-ok' : ''}> · lifted {m.liftedCount}/{HAUNTED_NOTES}</span>
            <span className={m.heldHaunted ? 'cw-ok' : 'cw-no'}> · you hold {m.heldHaunted}</span>
            {' '}· {turnsLeft} turn{turnsLeft !== 1 ? 's' : ''} left</>
        : phase === 'exorcised' ? <span className="cw-ok">CURSE LIFTED — your scale is yours again</span>
        : <span>the curse fades…</span>}
    </div>}
  </div>;
}
