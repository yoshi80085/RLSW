// ─── 🐙 TENTACLE FX ──────────────────────────────────────────────────────────
// The Metalness Monster's reach, drawn. `METALNESS_REWORK_DESIGN.md` §4a — a
// Swing launched from a hex on his slime trail rather than from where he stands.
//
// The animation is not decoration here, it is the RULE made visible. §4a asks
// for three things the player has to be able to see:
//
//   · the reach is PRICED — it travels the trail hex by hex, so a long strike
//     visibly costs a long road;
//   · rivals can COUNT it — the arm follows the actual slime on the board, not
//     a straight line to the victim, so the threat range is public;
//   · he does not move and does not turn — the BASE stays pinned to his own hex
//     the whole time, which is the picture of "the tentacle attacks, he doesn't".
//
// ── THE SHAPE ───────────────────────────────────────────────────────────────
// A tapered ribbon swept along the trail polyline with a travelling sine wave
// laid across it. The wave's amplitude is enveloped so it is ~0 at the base and
// widest near the tip: a tentacle is anchored at the shoulder and loose at the
// end, and an un-enveloped sine reads as a wobbling rope instead.
//
// Four beats, and the timing is doing the storytelling:
//   EMERGE  it grows out of the slime, feeling its way along the road
//   COIL    full length, waving — this is the "wave around like one" beat
//   STRIKE  the wave collapses, the arm snaps straight and lunges at the rival
//   RETRACT it whips back
//
// ⚠️ PURE PRESENTATION. Nothing here decides anything. The hexes were already
// spent and the blow was already rolled by the time this mounts; if this file
// were deleted the game would play identically and only look worse.

import { useEffect, useRef, useState } from "react";

const EMERGE  = 0.30;   // grow out along the trail
const COIL    = 0.60;   // …and wave there
const STRIKE  = 0.76;   // snap straight, lunge
const DURATION = 1500;  // ms, whole gesture

const SAMPLES = 44;     // centreline resolution — enough that the taper reads smooth
const WAVES   = 2.1;    // sine periods along the arm
const WAVE_SPEED = 6.4; // radians/sec the wave travels tip-ward

const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn  = t => t * t * t;

/** Point + unit tangent at arc-length fraction `s` along a polyline. */
function alongPath(pts, s) {
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y, tx: 1, ty: 0 };
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segs.push(d); total += d;
  }
  if (total === 0) return { x: pts[0].x, y: pts[0].y, tx: 1, ty: 0 };
  let want = Math.max(0, Math.min(1, s)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (want <= segs[i] || i === segs.length - 1) {
      const f = segs[i] === 0 ? 0 : Math.max(0, Math.min(1, want / segs[i]));
      const a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), tx: dx / len, ty: dy / len };
    }
    want -= segs[i];
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, tx: 1, ty: 0 };
}

/**
 * @param {object} fx
 *   · `pts`    [{x,y}] — his own hex centre first, then each trail hex the arm
 *              travels through, ending at the ORIGIN hex it strikes from.
 *   · `target` {x,y}   — the rival's hex centre.
 *   · `color`  ribbon colour (defaults to slime green).
 *   · `key`    remount token; a new key restarts the gesture.
 * @param {number} [scale] hex size, so the arm's thickness matches the board.
 */
export function TentacleFX({ fx, scale = 26 }) {
  const [t, setT] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!fx) return undefined;
    setT(0);
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / DURATION);
      setT(p);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [fx?.key]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!fx || !fx.pts || fx.pts.length === 0 || t >= 1) return null;

  const color = fx.color ?? "#5cff6a";
  const base  = fx.pts[0];

  // ── PHASE ──────────────────────────────────────────────────────────────────
  // `grown`  how much of the arm exists (0→1)
  // `lunge`  how far the tip has committed to the target (0→1)
  // `waving` how much sine is left in it — it dies as the strike winds up
  let grown, lunge, waving, retract = 0;
  if (t < EMERGE) {
    grown  = easeOut(t / EMERGE);
    lunge  = 0;
    waving = grown;
  } else if (t < COIL) {
    grown  = 1;
    lunge  = 0;
    waving = 1;
  } else if (t < STRIKE) {
    const k = (t - COIL) / (STRIKE - COIL);
    grown  = 1;
    lunge  = easeIn(k);          // slow coil, then a snap
    waving = 1 - k;              // the wave straightens out of it as it commits
  } else {
    const k = (t - STRIKE) / (1 - STRIKE);
    grown   = 1 - easeIn(k) * 0.92;
    lunge   = 1 - k * 0.35;
    waving  = 0.25 * k;          // a little recoil shiver on the way home
    retract = k;
  }

  // The path the arm follows. During the lunge the tip reaches PAST the origin
  // into the rival's hex — the strike is the arm extending, not the arm moving.
  const spine = [...fx.pts];
  if (fx.target && lunge > 0) {
    const tipFrom = fx.pts[fx.pts.length - 1];
    spine.push({
      x: lerp(tipFrom.x, fx.target.x, lunge),
      y: lerp(tipFrom.y, fx.target.y, lunge),
    });
  }

  const phase = (t * DURATION / 1000) * WAVE_SPEED;
  const amp   = scale * 0.42 * waving;
  const rBase = scale * 0.30;

  // ── CENTRELINE ─────────────────────────────────────────────────────────────
  // Sample the polyline, push each sample sideways by an enveloped travelling
  // sine. The envelope is `s` (zero at the shoulder, full at the tip) times a
  // fade at the very end so the tip itself tracks the road rather than flapping
  // off it — otherwise a strike can visibly miss the hex it is aimed at.
  const mid = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const s = (i / SAMPLES) * grown;
    const p = alongPath(spine, s);
    const env = Math.sin(Math.min(1, s / Math.max(grown, 0.001)) * Math.PI) ** 0.7;
    const off = Math.sin(s * WAVES * Math.PI * 2 - phase) * amp * env;
    mid.push({
      x: p.x - p.ty * off,
      y: p.y + p.tx * off,
      s: grown > 0 ? s / grown : 0,
    });
  }

  // ── OUTLINE ────────────────────────────────────────────────────────────────
  // Offset the centreline both ways by a tapering radius and close the loop, so
  // the arm is a solid tapered body rather than a stroked line of constant width.
  // A stroke would read as a cable; the taper is what reads as flesh.
  const radiusAt = s => rBase * (1 - 0.86 * s) * (1 - retract * 0.5) + 0.6;
  const left = [], right = [];
  for (let i = 0; i < mid.length; i++) {
    const a = mid[Math.max(0, i - 1)], b = mid[Math.min(mid.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const r = radiusAt(mid[i].s);
    left.push(`${(mid[i].x + nx * r).toFixed(1)},${(mid[i].y + ny * r).toFixed(1)}`);
    right.push(`${(mid[i].x - nx * r).toFixed(1)},${(mid[i].y - ny * r).toFixed(1)}`);
  }
  const body = `M${left.join(" L")} L${right.reverse().join(" L")} Z`;
  const spineD = `M${mid.map(m => `${m.x.toFixed(1)},${m.y.toFixed(1)}`).join(" L")}`;

  // Suckers ride the underside, thinning toward the tip.
  const suckers = [];
  for (let i = 3; i < mid.length - 2; i += 3) {
    const m = mid[i];
    const a = mid[i - 1], b = mid[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const r = radiusAt(m.s);
    suckers.push(
      <circle key={i}
        cx={m.x - (-dy / len) * r * 0.42} cy={m.y - (dx / len) * r * 0.42}
        r={Math.max(0.6, r * 0.30)} fill="#0b2a10" opacity={0.55 * (1 - m.s * 0.6)} />
    );
  }

  const tip = mid[mid.length - 1];
  const impact = t >= COIL && t < STRIKE + 0.06 ? (1 - Math.abs(t - STRIKE) / 0.09) : 0;

  return (
    <g style={{ pointerEvents: "none" }}>
      <defs>
        <linearGradient id="tent-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#1c6b2a" />
          <stop offset="55%"  stopColor={color} />
          <stop offset="100%" stopColor="#c9ffd2" />
        </linearGradient>
        <filter id="tent-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={scale * 0.10} result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* the arm */}
      <path d={body} fill="url(#tent-grad)" opacity={0.95} filter="url(#tent-glow)" />
      {/* a wet highlight down the spine sells the slime */}
      <path d={spineD} fill="none" stroke="#dcffe3" strokeWidth={rBase * 0.22}
            strokeLinecap="round" opacity={0.35 * (1 - retract)} />
      {suckers}

      {/* 💥 the strike — a flash at the tip on contact */}
      {impact > 0 && tip && (
        <g opacity={Math.max(0, impact)}>
          <circle cx={tip.x} cy={tip.y} r={scale * (0.30 + 0.55 * (1 - impact))}
                  fill="none" stroke="#eaffef" strokeWidth={2.2} />
          <circle cx={tip.x} cy={tip.y} r={scale * 0.16} fill="#ffffff" opacity={0.8} />
        </g>
      )}

      {/* the shoulder — pinned to HIS hex for the whole gesture, because he
          never moves and never turns. This blob is the rule, drawn. */}
      <circle cx={base.x} cy={base.y} r={rBase * 1.25 * (1 - retract * 0.6)}
              fill="#1c6b2a" opacity={0.9} />
    </g>
  );
}

export default TentacleFX;
