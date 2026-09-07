import { HEX_BY_NUM } from '../board/hexMap.js';
import { HEX_SIZE, SCALE } from '../board/constants.js';
import { angleTo, pointyCorners } from '../board/hexGeometry.js';
import { bushidoLane } from '../engine/systems/bushido.js';
import { psychoBushidoBonus, PSYCHO_BUSHIDO_MIN_RANGE, PSYCHO_BUSHIDO_MAX_RANGE } from '../data/gameConstants.js';

// Alex's three control-panel screenshots, 2026-09-05 22:18–22:19.
// Values are in the preview's original board units; scale the group once.
// Shared with the preview-parity suite; immutable configuration, not UI state.
// eslint-disable-next-line react-refresh/only-export-components
export const BUSHIDO_LOOK = Object.freeze({
  a3: 0.10, a5: 0.60, gamma: 1.25, s3: 0.36, s5: 0.76, sw: 3.1,
  swramp: true, bloom: 26, bstr: 0.72, runupMode: 'dim', ra: 0.03,
  blockMode: 'wall', ghost: false, spine: true, spw: 9, spa: 0.5,
  spineTaper: true, arrow: true, rungs: true, lab: 110, ring: true,
  pulse: true, hue: '#4488ff', hotFar: true,
});

const rung = d => Math.max(0, Math.min(1, (d - PSYCHO_BUSHIDO_MIN_RANGE) /
  (PSYCHO_BUSHIDO_MAX_RANGE - PSYCHO_BUSHIDO_MIN_RANGE)));
const power = d => Math.pow(rung(d), BUSHIDO_LOOK.gamma);
const ramp = (d, lo, hi) => lo + (hi - lo) * power(d);
const laneColor = d => '#' + BUSHIDO_LOOK.hue.slice(1).match(/../g)
  .map(c => { const x = parseInt(c, 16); return Math.round(x + (255 - x) * 0.42 * power(d)).toString(16).padStart(2, '0'); }).join('');

// Rules and target eligibility are supplied by the client. This component only
// paints them. Separate layers keep glow beneath pieces and labels above them.
export function BushidoOverlay({ spirit, blockers, targets, layer = 'lane', scale = SCALE }) {
  const L = BUSHIDO_LOOK;
  const lane = bushidoLane(spirit, blockers);
  if (!lane.length) return null;
  const last = lane[lane.length - 1];
  const stopped = blockers.has(last.num) && !targets.has(last.num);
  const filterId = `bushido-glow-${spirit.id}`;
  const labels = layer === 'labels';
  const segs = stopped ? lane.slice(0, -1) : lane;
  return <g data-bushido-layer={layer} transform={`scale(${scale})`} style={{ pointerEvents: 'none' }}>
    {!labels && <>
      <defs>
        <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={L.bloom} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <style>{'@keyframes lane-pulse{0%,100%{opacity:.72}50%{opacity:1}}'}</style>
      <g filter={`url(#${filterId})`}>
        {segs.map((s, index) => {
          const prev = HEX_BY_NUM[index ? segs[index - 1].num : spirit.num], h = HEX_BY_NUM[s.num];
          const wNear = L.spw * (0.45 + 0.55 * power(s.dist - 1));
          const wFar = L.spw * (0.45 + 0.55 * power(s.dist));
          const ang = angleTo(prev, h), nx = -Math.sin(ang), ny = Math.cos(ang);
          const a = s.dist >= PSYCHO_BUSHIDO_MIN_RANGE ? L.spa * ramp(s.dist, 0.55, 1) : L.spa * 0.28;
          return <polygon key={`spine-${s.num}`} points={`${prev.px + nx * wNear},${prev.py + ny * wNear} ${h.px + nx * wFar},${h.py + ny * wFar} ${h.px - nx * wFar},${h.py - ny * wFar} ${prev.px - nx * wNear},${prev.py - ny * wNear}`} fill={laneColor(s.dist)} opacity={a.toFixed(3)} />;
        })}
        {(() => {
          const h = HEX_BY_NUM[last.num], ang = angleTo(HEX_BY_NUM[last.to], h), sz = L.spw * 3.4;
          const x = h.px + Math.cos(ang) * HEX_SIZE * 0.55, y = h.py + Math.sin(ang) * HEX_SIZE * 0.55;
          return <polygon points={`${x},${y} ${x - Math.cos(ang - 0.5) * sz},${y - Math.sin(ang - 0.5) * sz} ${x - Math.cos(ang + 0.5) * sz},${y - Math.sin(ang + 0.5) * sz}`} fill={laneColor(last.dist)} opacity={L.spa.toFixed(3)} />;
        })()}
        {lane.map(s => {
          const h = HEX_BY_NUM[s.num], pts = pointyCorners(h.px, h.py, HEX_SIZE * 0.93);
          if (stopped && s.num === last.num) {
            const ang = angleTo(HEX_BY_NUM[s.to], h), nx = -Math.sin(ang), ny = Math.cos(ang);
            const x = h.px - Math.cos(ang) * HEX_SIZE * 0.72, y = h.py - Math.sin(ang) * HEX_SIZE * 0.72;
            return <line key={s.num} x1={x + nx * HEX_SIZE * 0.8} y1={y + ny * HEX_SIZE * 0.8} x2={x - nx * HEX_SIZE * 0.8} y2={y - ny * HEX_SIZE * 0.8} stroke="#ff5533" strokeWidth={26} strokeLinecap="round" opacity="0.9" />;
          }
          if (s.dist < PSYCHO_BUSHIDO_MIN_RANGE) return <g key={s.num}>
            <polygon points={pts} fill={L.hue} opacity={L.ra.toFixed(3)} />
            <polygon points={pts} fill="none" stroke={L.hue} strokeWidth={1.6 * HEX_SIZE * 0.02 * 30 / 2} opacity={(L.ra * 1.6).toFixed(3)} />
          </g>;
          return <g key={s.num} style={s.dist === PSYCHO_BUSHIDO_MAX_RANGE ? { animation: 'lane-pulse 1.9s ease-in-out infinite' } : undefined}>
            <polygon points={pts} fill={laneColor(s.dist)} opacity={(ramp(s.dist, L.a3, L.a5) * (1 + L.bstr * 0.3)).toFixed(3)} />
            <polygon points={pts} fill="none" stroke={laneColor(s.dist)} strokeWidth={L.sw * (0.42 + 0.58 * power(s.dist)) * 8} opacity={ramp(s.dist, L.s3, L.s5).toFixed(3)} />
          </g>;
        })}
      </g>
    </>}
    {labels && <>
      {lane.filter(s => targets.has(s.num)).map(s => {
        const h = HEX_BY_NUM[s.num];
        return <circle key={`ring-${s.num}`} cx={h.px} cy={h.py} r={HEX_SIZE * 0.72} fill="none" stroke={laneColor(s.dist)} strokeWidth={14} opacity="0.95" style={{ animation: 'lane-pulse 1.2s ease-in-out infinite' }} />;
      })}
      {lane.filter(s => s.dist >= PSYCHO_BUSHIDO_MIN_RANGE && !(stopped && s.num === last.num)).map(s => {
        const h = HEX_BY_NUM[s.num], dy = blockers.has(s.num) ? -HEX_SIZE * 0.62 : L.lab * 0.36;
        return <text key={s.num} x={h.px} y={h.py + dy} textAnchor="middle" fontSize={L.lab} fontWeight="800" fill="#ffffff" stroke="#02040a" strokeWidth={L.lab * 0.11} paintOrder="stroke" opacity={(0.35 + 0.65 * power(s.dist)).toFixed(2)} fontFamily="ui-sans-serif,system-ui,sans-serif">+{psychoBushidoBonus(s.dist)}</text>;
      })}
    </>}
  </g>;
}
