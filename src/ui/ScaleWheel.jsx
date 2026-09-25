// ─── 🎡 THE SCALE WHEEL ──────────────────────────────────────────────────────
// Alex, 2026-09-25: *"an interactive scale wheel or scale visualizer - to be
// collapsible and viewable when deciding to build out what melody - Each
// character should get their own scale visualizer."* Ported from
// `.scratch/scale-wheel-preview.jsx` at the dial Alex read off that page.
//
// 🎯 A CHROMATIC WHEEL WITH THE ROOT AT TWELVE O'CLOCK. A Spirit plays ONE mode
// all match and the root follows the melody's last note (melodyCommit:
// `rootNote = lastNote`). So a Spirit's palette polygon is a fixed glyph — the
// Ronin's is always the same lopsided shape — and only the letters turn.
//
// ⭐ NO RULE IS RESTATED HERE. Mode, spelling, palette, 4th/5th, the payout line
// and the fan-phrase pulse all come from the same modules the engine scores with.
//
// 🪦 CUT AT THE DIAL (Alex, 2026-09-25): the red/blue "your stack makes this
// off-key note legal" colouring and the ▲ stack-root carets. *"These can still
// live on the notes themselves instead of in the interactive scale wheel."* —
// the hand's NoteHex chevrons already say both. The next-key ghost was dialled
// OFF but kept as an option.
//
// The rules-as-data half (dial, looks, `wheelModel`, `describeSlot`) lives in
// `scaleWheelModel.js` so this file exports components only.
//
// Pure presentation: props in, `onPick(pc)` / `onHoverNote(slot)` out. It never
// commits a note itself — the caller routes a pick through `clickNoteStock`.
import { useMemo, useState } from 'react';
import NoteHex from './NoteHex.jsx';
import Bracket from './Bracket.jsx';
import { playableScale, pitchIndex, ENHARMONIC_RESPELL } from '../music/notes.js';
import { melodyModeFor } from '../music/melodyIdentity.js';
import { characterId } from '../data/spiritIdentity.js';
import { ENDING_DB } from '../music/melodyPayout.js';
import { WHEEL_DEFAULTS, MODE_NAME, lookFor, pretty, wheelModel, describeSlot } from './scaleWheelModel.js';

const MELODY_C = '#aa88ff', GOLD = '#ffd24a';

// ── geometry (viewBox units) ─────────────────────────────────────────────────
const VB = 360, C = VB / 2, R = 118, R_IN = R - 46, CHIP = 38;
const slotAngle = k => (-90 + k * 30) * Math.PI / 180;
const at = (k, r) => [C + r * Math.cos(slotAngle(k)), C + r * Math.sin(slotAngle(k))];

function Motif({ kind, accent }) {
  if (kind === 'brush') {
    return <g opacity=".55">
      <circle cx={C} cy={C} r={R + 44} fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round"
        strokeDasharray="38 9 22 14 51 7 17 12" transform={`rotate(-8 ${C} ${C})`} />
      <circle cx={C} cy={C} r={R + 49} fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round"
        strokeDasharray="12 20 60 16" opacity=".6" />
    </g>;
  }
  if (kind === 'spikes') {
    const pts = Array.from({ length: 48 }, (_, i) => {
      const a = (i * 7.5 - 90) * Math.PI / 180, r = i % 2 ? R + 38 : R + 52;
      return `${(C + r * Math.cos(a)).toFixed(1)},${(C + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    return <polygon points={pts} fill="none" stroke={accent} strokeWidth="1.6" opacity=".5" />;
  }
  if (kind === 'orbit') {
    return <g opacity=".55">
      <g className="sw-spin"><circle cx={C} cy={C} r={R + 42} fill="none" stroke={accent} strokeWidth="1.2" strokeDasharray="2 7" />
        <circle cx={C} cy={C - R - 42} r="3.5" fill={accent} /></g>
      <g className="sw-spin-rev"><ellipse cx={C} cy={C} rx={R + 52} ry={R + 30} fill="none" stroke={accent} strokeWidth=".9" strokeDasharray="1 5" />
        <circle cx={C + R + 52} cy={C} r="2.2" fill="#fff" /></g>
    </g>;
  }
  const pts = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 15 - 90) * Math.PI / 180, r = i % 2 ? R + 38 : R + 50;
    return `${(C + r * Math.cos(a)).toFixed(1)},${(C + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return <g opacity=".55">
    <polygon points={pts} fill="none" stroke={accent} strokeWidth="1.2" />
    {[0, 3, 6, 9].map(k => { const [x, y] = at(k + 0.5, R + 50); return <path key={k} className="sw-twinkle"
      style={{ animationDelay: `${k * 0.35}s`, transformOrigin: `${x}px ${y}px` }}
      d={`M${x} ${y - 6} L${x + 1.4} ${y - 1.4} L${x + 6} ${y} L${x + 1.4} ${y + 1.4} L${x} ${y + 6} L${x - 1.4} ${y + 1.4} L${x - 6} ${y} L${x - 1.4} ${y - 1.4}Z`} fill="#fff" />; })}
  </g>;
}

export function ScaleWheel({ spiritId, root, hand = [], available, line = [], opts = WHEEL_DEFAULTS, onPick, onHoverNote, next = false }) {
  // 🔠 Small wheels keep readable labels: below 300px the label type grows so a
  // 214px pocket wheel still prints ~8px degrees instead of ~6px.
  const ts = Math.min(1.5, Math.max(1, 300 / (opts.size || 300)));
  const [hover, setHover] = useState(null);
  const m = useMemo(() => wheelModel({ spiritId, root, hand, available, line, opts }),
    [spiritId, root, hand, available, line, opts]);
  const { look, mode, kOf } = m;
  const accent = look.accent;
  const shapePts = pcs => [...pcs].map(kOf).sort((a, b) => a - b)
    .map(k => at(k, R_IN).map(v => v.toFixed(1)).join(',')).join(' ');

  const focusNote = hover != null ? m.pool[hover] : line.at(-1);
  const focusPc = focusNote != null ? pitchIndex(focusNote) : null;
  let ghost = null;
  if (opts.ghostNextKey && focusPc != null && focusPc !== m.rootPc) {
    const nextRoot = ENHARMONIC_RESPELL[focusNote] ?? focusNote;
    ghost = { nextRoot, pts: shapePts(new Set(playableScale(nextRoot, mode).map(pitchIndex))) };
  }

  const pathD = line.map((n, i) => {
    const [x, y] = at(kOf(pitchIndex(n)), R_IN);
    if (i === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
    if (opts.path === 'straight') return `L${x.toFixed(1)} ${y.toFixed(1)}`;
    const [px, py] = at(kOf(pitchIndex(line[i - 1])), R_IN);
    const cx = (px + x) / 2 * 0.6 + C * 0.4, cy = (py + y) / 2 * 0.6 + C * 0.4;
    return `Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const fans = m.payout ? m.payout.style.score + m.payout.craftFans : 0;
  const enter = s => { setHover(s.pc); onHoverNote?.(s); };
  const leave = () => { setHover(null); onHoverNote?.(null); };

  return (
    <div className="sw-wrap" data-scale-wheel={characterId(spiritId)}>
      <svg className="sw" viewBox={`0 0 ${VB} ${VB}`} width={opts.size} height={opts.size} role="img"
        aria-label={`${pretty(root)} ${MODE_NAME[mode] ?? mode} scale wheel`}>
        {opts.motif && <Motif kind={look.motif} accent={accent} />}
        <circle cx={C} cy={C} r={R + 22} fill="none" stroke="#ffffff10" />
        <circle cx={C} cy={C} r={R_IN - 18} fill="#ffffff05" stroke="#ffffff0d" />
        {ghost && <polygon points={ghost.pts} fill="none" stroke="#ffffff" strokeOpacity=".35" strokeDasharray="4 5" strokeWidth="1.3" />}
        <polygon points={shapePts(m.palPcs)} fill={accent} fillOpacity=".13" stroke={accent} strokeWidth="1.6"
          strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 6px ${accent}88)` }} />
        {/* the hub — UNDER the melody path, so a line through the middle stays readable */}
        <circle cx={C} cy={C} r="33" fill="#070c18" fillOpacity=".88" stroke={accent} strokeOpacity=".35" />
        <text x={C} y={C + 5} textAnchor="middle" fontSize="30" fontWeight="700" fill="#fff" fontFamily="Saira, sans-serif"
          style={{ filter: `drop-shadow(0 0 8px ${accent})` }}>{pretty(root)}</text>
        <text x={C} y={C + 20} textAnchor="middle" fontSize="7.5" letterSpacing="2" fill={accent} fontFamily="Share Tech Mono, monospace">
          {(MODE_NAME[mode] ?? mode).toUpperCase()}</text>
        {/* 🩷 NEXT — the retired pocket RootBadge's rule: melodyCommit writes the
            track's last note into rootNote, so after a commit this is next round's key. */}
        {next ? <text x={C} y={C - 19} textAnchor="middle" fontSize={8 * ts} letterSpacing="1.5" fill="#ff99dd"
            fontFamily="Share Tech Mono, monospace">NEXT</text>
          : look.glyph && opts.motif && <text x={C} y={C - 20} textAnchor="middle" fontSize="8" fill="#ffffff55">{look.glyph}</text>}
        {line.length > 0 && <>
          <path d={pathD} fill="none" stroke={MELODY_C} strokeWidth="6" strokeOpacity=".18" strokeLinecap="round" strokeLinejoin="round" />
          <path d={pathD} fill="none" stroke={MELODY_C} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 4px ${MELODY_C})` }} />
          {line.map((n, i) => {
            const [x, y] = at(kOf(pitchIndex(n)), R_IN);
            const dup = line.slice(0, i).filter(p => pitchIndex(p) === pitchIndex(n)).length;
            const ox = x + (C - x) * 0.12 * dup, oy = y + (C - y) * 0.12 * dup;
            const last = i === line.length - 1;
            return <g key={i}>
              <circle cx={ox} cy={oy} r={last ? 8.5 : 7} fill="#0b0f1c" stroke={MELODY_C} strokeWidth={last ? 2.2 : 1.4}
                className={last ? 'sw-last' : undefined} />
              <text x={ox} y={oy + 3.2} textAnchor="middle" fontSize={9 * ts} fill="#e8dcff" fontFamily="Share Tech Mono, monospace">{i + 1}</text>
            </g>;
          })}
        </>}
        {m.slots.map(s => {
          const [x, y] = at(s.k, R);
          const hue = s.inPal ? accent : '#4a4a5c';
          const dull = !s.inPal || (opts.fadeUnheld && !s.held.length);
          const [lx, ly] = at(s.k, R + 29);
          const hot = hover === s.pc;
          return (
            <g key={s.pc} className={`sw-slot${s.held.length ? ' is-held' : ''}`} data-wheel-pc={s.pc}
              onMouseEnter={() => enter(s)} onMouseLeave={leave}
              onClick={() => s.held.length && onPick?.(s.pc)} style={{ cursor: s.held.length && onPick ? 'pointer' : 'default' }}>
              {opts.titles && <title>{describeSlot(s)}</title>}
              <circle cx={x} cy={y} r={CHIP * 0.62} fill="transparent" />
              {s.phrase > 0 && <circle cx={x} cy={y} r={CHIP * 0.66} fill="none" stroke={accent}
                strokeWidth={s.phrase === 2 ? 2.4 : 1.4} className="sw-phrase" />}
              {hot && <circle cx={x} cy={y} r={CHIP * 0.7} fill={`${hue}22`} stroke="#fff" strokeOpacity=".5" />}
              <g transform={`translate(${x - CHIP / 2} ${y - CHIP / 2})`} style={{ opacity: s.inPal ? 1 : 0.55 }}>
                <NoteHex size={CHIP} hue={hue} letter={s.name} dull={dull} gold={s.ending === 'fifth' && hot} />
              </g>
              {s.held.length > 0 && <g>
                <circle cx={x + 14} cy={y - 14} r={7 * Math.min(ts, 1.3)} fill={s.inPal ? accent : '#8a8aa0'} stroke="#0b0f1c" strokeWidth="1.5" />
                <text x={x + 14} y={y - 14 + 3.2 * Math.min(ts, 1.3)} textAnchor="middle" fontSize={9 * Math.min(ts, 1.3)} fontWeight="700" fill="#0b0f1c"
                  fontFamily="Share Tech Mono, monospace">{s.held.length}</text></g>}
              {opts.degrees && <text x={lx} y={ly + 3.5 * ts} textAnchor="middle" fontSize={10.5 * ts}
                fill={s.inPal ? accent : '#5c5c70'} fontFamily="Share Tech Mono, monospace" fontWeight={s.inPal ? 700 : 400}>
                {s.sig ? '★' : ''}{s.degree}
                {opts.dbBadges && s.ending && <tspan fill={GOLD} dx="3">+{ENDING_DB[s.ending]}</tspan>}</text>}
            </g>
          );
        })}
      </svg>
      <div className="sw-readout">
        {m.payout
          ? <span className="sw-pay">this line: +{m.payout.db} Db{fans ? ` · +${fans} fan${fans > 1 ? 's' : ''}` : ''}{m.payout.ending !== 'normal' ? ` · ${m.payout.ending} ending` : ''}</span>
          : <span className="sw-dim">click a note you hold — or type it</span>}
        {ghost && <span className="sw-ghost">end on {pretty(focusNote)} → next turn in {pretty(ghost.nextRoot)} {MODE_NAME[mode] ?? mode}</span>}
      </div>
    </div>
  );
}

/** The card the Scale nav chip drops under the Turn · Scale · Rivals row
 *  (MatchSurface `scale`). The chip is the toggle, so the card has no header of
 *  its own — just a frame whose plate names the key.
 *  🪦 `ScaleWheelPanel` (a collapsible bar + the `float` flyout beside the hand
 *  column) went 2026-09-25 when the wheel moved under the nav chips. */
export function ScaleWheelCard({ spiritId, root, next = false, children }) {
  const look = lookFor(spiritId);
  const mode = melodyModeFor(spiritId);
  return (
    <Bracket corner="sm" color={look.accent} className="sw-card"
      plate={`${next ? 'NEXT ' : ''}${pretty(root)} · ${(MODE_NAME[mode] ?? mode).toUpperCase()}`}
      style={{ '--acc': look.accent }} data-scale-wheel-panel="open">
      <div className="sw-body">{children}</div>
    </Bracket>
  );
}

