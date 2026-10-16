// ─── 🎡 THE NOTE POOL IS THE WHEEL ──────────────────────────────────────────
// Alex, 2026-10-14, on the pad-turn preview: *"I think this can totally replace
// the current 'note pool' that I have in the game … This totally brings sense and
// order to the note pool."* → ruled: EVERYONE (mouse clicks a slot, a–g still
// types, the pad points the stick), CENTRE OF THE ARENA, BIG, in Chord and Melody.
//
// ⭐ ONE COPY. This component is what `.scratch/pad-turn-preview.jsx` draws AND
// what the game draws (the preview imports it), so the dialled page and the match
// cannot drift (CLAUDE.md "verify the port"). Underneath it is the real
// `ScaleWheel` (or `CursedWheel` with `pool` while the Iwato curse holds); on top
// sits the PAD LAYER — the lit arc where the stick points, the ring on the picked
// note and the hammer-on's gold slur — in the wheel's own 360 viewBox.
//
// Pure presentation: props in, `onPick(pc)` / `onHub()` out. Nothing here commits
// a note; the caller routes a pick through the same `clickNoteStock` a chip used.
import { useEffect, useRef, useState } from 'react';
import { ScaleWheel } from './ScaleWheel.jsx';
import { CursedWheel } from './CursedWheel.jsx';
import { WHEEL_DEFAULTS, lookFor, pretty } from './scaleWheelModel.js';
import { pitchIndex } from '../music/notes.js';
import { PAD_TURN } from '../input/padTurn.js';
import { PAD_RING } from '../input/padFocus.js';
import { easePointer, pointerShapes, poolDiscStyle, POOL_C, POOL_R } from './padTurnUi.js';

const RING = PAD_RING.color, GOLD = '#ffd24a';
const C = POOL_C, R = POOL_R;
const at = (k, r) => [C + r * Math.cos((-90 + k * 30) * Math.PI / 180), C + r * Math.sin((-90 + k * 30) * Math.PI / 180)];
const kFrom = (note, root) => (pitchIndex(note) - pitchIndex(root) + 12) % 12;




/**
 * @param wheel    everything `ScaleWheel` takes (spiritId, root, hand, available, line, marks, hub, onPick, onHub, onHoverNote)
 * @param size     px (PAD_TURN.wheelSize) · @param chip  the note hexes in wheel units (PAD_TURN.wheelChip)
 * @param curse    null, or CursedWheel's props (roninRoot, haunted, phase, turnsLeft, since, roninColor) → the cursed pool
 * @param pick     the pad's picked pitch class (null = nothing lit)
 * @param readStick  () → the left stick `{x,y,m}` or null. Read every frame while the pool is up in pad mode.
 * @param hammer   `{ ok, dir, note }` (`hammerCandidate`) — the slur hint, Melody only
 * @param look     `{ pointer, mark, hint }` — PAD_TURN.wheelPointer / wheelMark / hammerHint;
 *                 and the window: `{ disc, blur, edge, tint, size, rim, soft }` (PAD_TURN.poolDisc… — see `poolDiscStyle`)
 */
export function PoolWheel({ size = PAD_TURN.wheelSize, chip = PAD_TURN.wheelChip, curse = null, pick = null, readStick = null,
  padOn = true, hammer = null, look = null, anchor, ...wheel }) {
  const pointer = look?.pointer ?? PAD_TURN.wheelPointer, mark = look?.mark ?? PAD_TURN.wheelMark, hint = look?.hint ?? PAD_TURN.hammerHint;
  const accent = lookFor(wheel.spiritId).accent;
  // 🧭 the stick, read per frame — but only while the pad is in use, so a mouse player's
  // wheel runs no loop at all.
  const [ptr, setPtr] = useState({ a: null, o: 0, m: 0 });
  const ptrRef = useRef(ptr);
  useEffect(() => {
    if (!readStick || !padOn || typeof requestAnimationFrame !== 'function') return undefined;
    let raf = 0;
    const step = () => {
      raf = requestAnimationFrame(step);
      const s = readStick();
      const next = { ...easePointer(ptrRef.current, s), m: s?.m ?? 0 };
      const cur = ptrRef.current;
      if (next.o === 0 && cur.o === 0) return;   // at rest: nothing to redraw
      if (Math.abs(next.o - cur.o) < .004 && Math.abs((next.a ?? 0) - (cur.a ?? 0)) < .05) return;
      ptrRef.current = next; setPtr(next);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [readStick, padOn]);

  const opts = { ...WHEEL_DEFAULTS, size, chip };
  const props = { ...wheel, opts };
  const picked = pick == null ? null : (pick - pitchIndex(wheel.root) + 12) % 12;   // the slot's k (semitones above the root)
  const pickHeld = pick != null && (wheel.hand ?? []).some((n, i) => (wheel.available ? wheel.available(i) : true) && pitchIndex(n) === pick);
  const shapes = padOn && ptr.a != null && ptr.o > .02 ? pointerShapes(ptr.a, chip, ptr.m) : null;
  const lastK = hammer?.ok && wheel.line?.length ? kFrom(wheel.line.at(-1), wheel.root) : null;
  const candK = hammer?.ok ? kFrom(hammer.note, wheel.root) : null;
  return (
    <div className="pw-box" style={{ width: size, '--acc': accent }} data-pool-wheel={curse ? 'cursed' : 'plain'} data-tip-anchor={anchor}>
      {/* 🪟 the wheel's own window: a frosted disc under it (PAD_TURN.poolDisc* / poolBlur → poolDiscStyle).
          Drawn whenever it shows anything — glass at 0 darkness still blurs. */}
      {((look?.disc ?? PAD_TURN.poolDisc) > 0 || (look?.blur ?? PAD_TURN.poolBlur) > 0) &&
        <div className="pw-disc" aria-hidden="true" data-pw-disc={look?.disc ?? PAD_TURN.poolDisc} style={poolDiscStyle(look ?? {}, accent)} />}
      {curse ? <CursedWheel {...props} {...curse} pool /> : <ScaleWheel {...props} />}
      {padOn && <svg className="pw-pad" viewBox="0 0 360 360" width={size} height={size} aria-hidden="true">
        <defs>
          <filter id="pw-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" /></filter>
          <filter id="pw-blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2" /></filter>
          {shapes && <linearGradient id="pw-beam" gradientUnits="userSpaceOnUse" x1={shapes.bx} y1={shapes.by} x2={shapes.tx} y2={shapes.ty}>
            <stop offset="0" stopColor={accent} stopOpacity=".1" /><stop offset=".55" stopColor={RING} stopOpacity=".75" /><stop offset="1" stopColor="#ffffff" stopOpacity="1" /></linearGradient>}
        </defs>
        {shapes && <g opacity={ptr.o} data-pw-pointer={pointer}>
          {(pointer === 'arc' || pointer === 'both') && <g>
            <path d={shapes.rimWide} fill="none" stroke={RING} strokeWidth="7" strokeLinecap="round" opacity=".35" filter="url(#pw-blur)" />
            <path d={shapes.rimWide} fill="none" stroke={RING} strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
            <path d={shapes.rimCore} fill="none" stroke="#e8fdff" strokeWidth="2.6" strokeLinecap="round" />
          </g>}
          {(pointer === 'beam' || pointer === 'both') && <g>
            <path d={shapes.bezel} fill="none" stroke={RING} strokeWidth="2.4" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${RING})` }} />
            <polygon points={shapes.blade} fill={RING} opacity=".55" filter="url(#pw-blur)" />
            <polygon points={shapes.blade} fill="url(#pw-beam)" />
            <line x1={shapes.cx0} y1={shapes.cy0} x2={shapes.tx} y2={shapes.ty} stroke="#ffffff" strokeWidth=".9" opacity=".75" strokeLinecap="round" />
            <polygon points={shapes.jewel} fill="#0b0f1c" stroke={RING} strokeWidth="1.6" style={{ filter: `drop-shadow(0 0 5px ${RING})` }} />
            <circle cx={shapes.tx} cy={shapes.ty} r="1.7" fill="#ffffff" />
          </g>}
          {pointer === 'line' && <line x1={C} y1={C} x2={shapes.lx} y2={shapes.ly} stroke={RING} strokeWidth="3" strokeLinecap="round" />}
        </g>}
        {picked != null && (() => { const [x, y] = at(picked, R);
          return <g data-pw-pick={pick}>
            {(mark === 'glow' || mark === 'both') && <circle cx={x} cy={y} r={chip * .71} fill={RING} opacity=".38" filter="url(#pw-glow)" />}
            {(mark === 'ring' || mark === 'both') && <circle cx={x} cy={y} r={chip * .66} fill="none" stroke={RING} strokeWidth="2.5" className="pw-pick" />}
            {!pickHeld && <text x={x} y={y + chip / 2 + 18} textAnchor="middle" fontSize="10" fill="#8aa">not held</text>}
          </g>; })()}
        {hammer?.ok && hint === 'arc' && lastK != null && (() => { const [x1, y1] = at(lastK, 72), [x2, y2] = at(candK, R);
          return <g className="pw-hammer" data-pw-hammer={hammer.dir}>
            <path d={`M${x1} ${y1} Q${(x1 + x2) / 2} ${(y1 + y2) / 2 - 26} ${x2} ${y2}`} fill="none" stroke={GOLD} strokeWidth="2.4" strokeDasharray="5 4" />
            <circle cx={x2} cy={y2} r="22" fill="none" stroke={GOLD} strokeWidth="2" />
            <text x={x2} y={y2 - 28} textAnchor="middle" fontSize="13" fontWeight="700" fill={GOLD}>{hammer.dir === 'up' ? 'h ↑' : 'p ↓'}</text></g>; })()}
        {hammer?.ok && hint === 'arrow' && <text x={C} y="236" textAnchor="middle" fontSize="15" fontWeight="700" fill={GOLD}>{hammer.dir === 'up' ? '↑ hammer' : '↓ pull'} {pretty(hammer.note)}</text>}
      </svg>}
    </div>
  );
}
