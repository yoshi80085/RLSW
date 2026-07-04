import { useState, useRef, useEffect } from "react";

export const NEON_STRIKE_PALETTE = ["#00eaff", "#4488ff", "#aa55ff", "#ff44dd", "#44ffaa", "#ffd700", "#ff6622"];

// ─── HUD NEON GLOW BORDERS ────────────────────────────────────────────────────
// Drop <NeonStrikeFX/> inside any position:relative HUD panel. At rare,
// random intervals the panel's border very faintly breathes with a soft
// neon glow, then fades back out. Each glow randomizes its color, subtle
// intensity, and duration, so windows never sync up. `color` biases the
// palette toward the panel owner's hue. `calm` panels glow even more
// rarely and more softly.
export function NeonStrikeFX({ color, calm = false, radius = 8 }) {
  const hostRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [strike, setStrike] = useState(null);

  // Measure the parent panel so the SVG perimeter hugs it exactly,
  // even when the panel resizes (collapsing cards, log growth, etc.)
  useEffect(() => {
    const el = hostRef.current?.parentElement;
    if (!el) return;
    const measure = () => setDims({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Rare random glow scheduler — each panel runs its own clock
  useEffect(() => {
    let alive = true;
    let timer;
    const schedule = (first) => {
      const base = calm ? 24000 : 16000;
      const spread = calm ? 36000 : 28000;
      const wait = first ? Math.random() * (base + spread) : base + Math.random() * spread;
      timer = setTimeout(() => {
        if (!alive) return;
        const c = color && Math.random() < 0.6
          ? color
          : NEON_STRIKE_PALETTE[Math.floor(Math.random() * NEON_STRIKE_PALETTE.length)];
        const intensity = (calm ? 0.22 : 0.3) + Math.random() * 0.28; // subtle but noticeable
        const dur = 2200 + Math.random() * 2000; // slow, gentle breath
        setStrike({ key: Math.random(), color: c, dur, intensity });
        timer = setTimeout(() => {
          if (!alive) return;
          setStrike(null);
          schedule(false);
        }, dur + 60);
      }, wait);
    };
    schedule(true);
    return () => { alive = false; clearTimeout(timer); };
  }, [color, calm]);

  const { w, h } = dims;
  const inset = 1;
  const ready = strike && w > 20 && h > 20;
  const k = strike?.intensity ?? 0;
  const glow = 3 + 8 * k;            // soft drop-shadow blur radius
  const peak = 0.26 + 0.5 * k;       // max opacity of the breath — visible, still gentle

  return (
    <div ref={hostRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30 }}>
      {ready && (
        <svg key={strike.key} width={w} height={h} viewBox={`0 0 ${w} ${h}`}
          style={{ position: "absolute", inset: 0, overflow: "visible", display: "block", opacity: peak }}>
          <rect
            x={inset} y={inset}
            width={Math.max(0, w - inset * 2)}
            height={Math.max(0, h - inset * 2)}
            rx={radius} ry={radius}
            fill="none"
            stroke={strike.color}
            strokeWidth={1.3}
            style={{
              filter: `drop-shadow(0 0 ${glow}px ${strike.color}) drop-shadow(0 0 ${glow * 2}px ${strike.color}44)`,
              animation: `hud-neon-pulse ${strike.dur}ms ease-in-out forwards`,
            }} />
        </svg>
      )}
    </div>
  );
}
