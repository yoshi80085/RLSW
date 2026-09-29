// =============================================================================
// ui/MarqueeCardPick.jsx — 🃏 PLAY A CARD AT THE ROLL (MARQUEE_QUIZ_DESIGN §10.6)
//
// Alex, 2026-09-29: "use the logo inside the RL_Card for the backside of the
// card … Have the cards spin around a few times before presenting themselves in
// front of the player on the screen — players can pick 1 card to use."
//
// The held cards come out face-down (the RL winged-horns logo), orbit and spin
// a few times, then settle in a row in front of the player and flip face-up.
// Click one to play it; "Keep my cards" backs out. A card that would change
// nothing on THIS throw is shown dimmed and cannot be picked.
//
// Presentational: card defs and handlers via props. The motion is driven by
// requestAnimationFrame (not CSS keyframes) so one clock owns the orbit, the
// spin and the settle, and reduced motion can jump straight to the row.
// =============================================================================
import { useEffect, useRef, useState } from "react";
import logo from "../assets/marquee_card_logo.png";

const CARD_W = 150, CARD_H = 222;
const SPIN_MS = 1500, SETTLE_MS = 800, TOTAL_MS = SPIN_MS + SETTLE_MS;
const GAP = 26;

// One look per kind of card: the ribbon, and the neon it glows in.
const CARD_KIND_LOOK = {
  loaded: { ribbon: "GUARANTEED ROLL", neon: "#35e3ff" },
  bump:   { ribbon: "BIGGER DIE",      neon: "#ff4fd8" },
  d10:    { ribbon: "BIGGER DIE",      neon: "#ff4fd8" },
  keep:   { ribbon: "EXTRA DIE",       neon: "#ffcc44" },
};

const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = t => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;

// ── Dice glyphs for the card faces ──────────────────────────────────────────
const PIPS = {
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
function D6({ x, y, s = 38, face = null, color, label = null }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={s * .18} fill="#0a1236" stroke={color} strokeWidth="2.2" />
      {face && PIPS[face].map(([px, py], i) => (
        <circle key={i} cx={px * s * .27} cy={py * s * .27} r={s * .075} fill={color} />
      ))}
      {label && <text y={s * .14} textAnchor="middle" fontSize={s * .36} fill={color} fontFamily="'Saira Stencil One',sans-serif">{label}</text>}
    </g>
  );
}
function Kite({ x, y, s = 44, color, label, sides = 10 }) {
  const pts = sides === 8
    ? `0,${-s / 2} ${s / 2.3},0 0,${s / 2} ${-s / 2.3},0`
    : `0,${-s / 2} ${s / 2.4},${-s * .06} 0,${s / 2} ${-s / 2.4},${-s * .06}`;
  return (
    <g transform={`translate(${x} ${y})`}>
      <polygon points={pts} fill="#0a1236" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
      <text y={s * .1} textAnchor="middle" fontSize={s * .26} fill={color} fontFamily="'Saira Stencil One',sans-serif">{label}</text>
    </g>
  );
}
function Arrow({ x, y, color }) {
  return <path d={`M ${x - 9} ${y} h 14 m -6 -6 l 6 6 l -6 6`} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />;
}
function CardArt({ card, color }) {
  const glow = { filter: `drop-shadow(0 0 5px ${color})` };
  if (card.kind === "loaded") return <svg viewBox="-60 -40 120 80" width="120" height="80" style={glow}><D6 x={0} y={0} s={52} face={card.face} color={color} /></svg>;
  if (card.kind === "bump") return (
    <svg viewBox="-60 -40 120 80" width="120" height="80" style={glow}>
      <D6 x={-30} y={0} s={34} color={color} label="d6" /><Arrow x={0} y={0} color={color} /><Kite x={32} y={0} s={46} sides={8} color={color} label="d8" />
    </svg>);
  if (card.kind === "d10") return (
    <svg viewBox="-60 -40 120 80" width="120" height="80" style={glow}>
      <D6 x={-30} y={0} s={34} color={color} label="d6" /><Arrow x={0} y={0} color={color} /><Kite x={32} y={0} s={52} color={color} label="d10" />
    </svg>);
  return (
    <svg viewBox="-60 -40 120 80" width="120" height="80" style={glow}>
      <D6 x={-34} y={2} s={28} face={4} color="#5c6f96" /><D6 x={-4} y={2} s={28} face={5} color="#5c6f96" />
      <D6 x={30} y={2} s={34} face={6} color={color} />
      <text x={30} y={-24} textAnchor="middle" fontSize="15" fill={color} fontFamily="'Saira Stencil One',sans-serif">+1</text>
    </svg>);
}

const frame = (neon) => ({
  position: "absolute", inset: 0, borderRadius: 12, overflow: "hidden",
  backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
  background: "radial-gradient(120% 90% at 50% 20%, #0d1c52 0%, #06103a 45%, #020822 100%)",
  border: "2px solid #1b1454",
  boxShadow: `0 10px 30px #000c, 0 0 18px ${neon}33`,
});
const neonRim = {
  position: "absolute", inset: 8, borderRadius: 9, pointerEvents: "none",
  border: "2px solid transparent",
  background: "linear-gradient(170deg,#29d3ff,#6a5cff 55%,#e24dff) border-box",
  WebkitMask: "linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0)",
  WebkitMaskComposite: "xor", maskComposite: "exclude",
  filter: "drop-shadow(0 0 4px #29d3ff) drop-shadow(0 0 6px #e24dff88)",
};

/** 🂠 The back — the RL logo from `RL_Card.png`, in its own neon frame. */
export function CardBack() {
  return (
    <div style={frame("#29d3ff")}>
      <div style={neonRim} />
      <div style={{ position: "absolute", inset: 0, opacity: .5,
        background: "radial-gradient(1px 1px at 22% 30%,#fff8,transparent),radial-gradient(1px 1px at 70% 18%,#fff6,transparent),radial-gradient(1px 1px at 80% 72%,#fff7,transparent),radial-gradient(1px 1px at 30% 82%,#fff5,transparent)" }} />
      <img src={logo} alt="" draggable={false} style={{
        position: "absolute", left: "50%", top: "50%", width: "84%",
        transform: "translate(-50%,-50%)", filter: "drop-shadow(0 0 6px #29d3ffaa)",
      }} />
    </div>
  );
}

/** 🂡 The face — built for the game: ribbon, art, name, what it does. */
export function CardFront({ card, dim = false }) {
  const look = CARD_KIND_LOOK[card.kind] ?? CARD_KIND_LOOK.loaded;
  return (
    <div style={{ ...frame(look.neon), transform: "rotateY(180deg)" }}>
      <div style={neonRim} />
      <div style={{ position: "absolute", inset: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{
          marginTop: 6, padding: "2px 8px", borderRadius: 4, fontSize: 8.5, letterSpacing: 1.6,
          color: "#050a1c", background: look.neon, fontWeight: 700, boxShadow: `0 0 10px ${look.neon}`,
          fontFamily: "'Share Tech Mono','Courier New',monospace",
        }}>{look.ribbon}</div>
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}><CardArt card={card} color={look.neon} /></div>
        <div style={{
          fontFamily: "'Saira Stencil One',sans-serif", fontSize: 17, letterSpacing: 1.2, color: "#f4f8ff",
          textShadow: `0 0 10px ${look.neon}`, textAlign: "center", lineHeight: 1.05,
        }}>{card.name.toUpperCase()}</div>
        <div style={{ margin: "6px 2px 10px", fontSize: 9.5, lineHeight: 1.35, color: "#b9c9e6", textAlign: "center",
          fontFamily: "'Share Tech Mono','Courier New',monospace" }}>{card.text}</div>
      </div>
      {dim && (
        <div style={{ position: "absolute", inset: 0, background: "#020822b8", display: "flex",
          alignItems: "center", justifyContent: "center", textAlign: "center", padding: 16,
          fontFamily: "'Share Tech Mono','Courier New',monospace", fontSize: 10, letterSpacing: 1.2, color: "#c9d6ee" }}>
          <span style={{ padding: "5px 8px", borderRadius: 5, background: "#0a1236", border: "1px solid #8fa3c455" }}>
            NO EFFECT ON THIS THROW
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * @param {{card:object, usable:boolean}[]} cards   the hand, in hand order
 * @param {(idx:number)=>void} onPick
 * @param {()=>void} onCancel
 * @param {string} [sub]   one line under the title (e.g. "4 Drive dice · keep 3")
 * @param {number} [nowMs] test hook — freeze the clock at this many ms in
 */
export function MarqueeCardPick({ cards = [], onPick, onCancel, sub = "", nowMs = null }) {
  const reduced = typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  const [t, setT] = useState(reduced ? TOTAL_MS : (nowMs ?? 0));
  const [chosen, setChosen] = useState(null);
  const [hover, setHover] = useState(null);
  const start = useRef(null);
  useEffect(() => {
    if (reduced || nowMs != null) return;
    let raf;
    const step = now => {
      if (start.current == null) start.current = now;
      const el = now - start.current;
      setT(Math.min(TOTAL_MS, el));
      if (el < TOTAL_MS) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduced, nowMs]);
  const settled = t >= TOTAL_MS;
  const n = cards.length;

  const pose = i => {
    const slotX = (i - (n - 1) / 2) * (CARD_W + GAP);
    const a0 = (i / Math.max(1, n)) * Math.PI * 2;
    const sp = ease(clamp01(t / SPIN_MS));
    // 🌀 THE ORBIT: 2.5 turns around the centre, flung out and pulled back in,
    // each card spinning three times on its own axis as it goes.
    const theta = a0 + sp * Math.PI * 5;
    const rad = 170 * Math.sin(Math.PI * Math.min(1, sp * 1.1)) + 30 * (1 - sp);
    const ox = Math.cos(theta) * rad, oy = Math.sin(theta) * rad * .45;
    // Each card spins out of step with the others (the offset fades to 0 so
    // every card lands back-up in the deck before the deal).
    const oScale = .45 + .4 * sp, oRy = sp * 1080 + (i * 70 + 25) * Math.sin(Math.PI * sp), oTilt = Math.sin(theta) * 14 * (1 - sp);
    const st = ease(clamp01((t - SPIN_MS) / SETTLE_MS));
    // 🂡 THE SETTLE: slide into the row and flip face-up (one more half turn).
    let x = lerp(ox, slotX, st), y = lerp(oy, 0, st), s = lerp(oScale, 1, st);
    const ry = lerp(oRy, 1080 + 180, st), tilt = lerp(oTilt, 0, st);
    if (settled && hover === i && chosen == null && cards[i].usable) { y -= 14; s *= 1.04; }
    if (chosen != null) {
      if (chosen === i) { y -= 30; s *= 1.12; } else { y += 40; s *= .9; }
    }
    return { x, y, s, ry, tilt };
  };

  const pick = i => {
    if (!settled || chosen != null || !cards[i]?.usable) return;
    setChosen(i);
    setTimeout(() => onPick?.(i), 520);
  };

  return (
    <div className="marquee-card-pick" role="dialog" aria-label="Play a card" style={{
      position: "fixed", inset: 0, zIndex: 9985, background: "radial-gradient(ellipse at 50% 55%, #1a0b3acc, #000000e0)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: "'Share Tech Mono','Courier New',monospace", perspective: 1100,
    }}>
      <div style={{ position: "absolute", top: "14%", textAlign: "center", opacity: settled ? 1 : .35, transition: "opacity .3s" }}>
        <div style={{ fontFamily: "'Saira Stencil One',sans-serif", fontSize: 22, letterSpacing: 4, color: "#ffcc44",
          textShadow: "0 0 16px #ffcc44aa" }}>PLAY A CARD</div>
        <div style={{ fontSize: 10.5, letterSpacing: 1.4, color: "#9fb4d6", marginTop: 4 }}>
          {settled ? "Pick one for this throw" : "Shuffling…"}{sub ? ` · ${sub}` : ""}
        </div>
      </div>
      <div style={{ position: "relative", width: 1, height: CARD_H }}>
        {cards.map(({ card, usable }, i) => {
          const p = pose(i);
          return (
            <div key={`${card.id}-${i}`} data-pick-card={card.id}
              onClick={() => pick(i)}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(h => (h === i ? null : h))}
              style={{
                position: "absolute", left: -CARD_W / 2, top: 0, width: CARD_W, height: CARD_H,
                transform: `translate(${p.x}px, ${p.y}px) rotate(${p.tilt}deg) scale(${p.s})`,
                transition: settled ? "transform .22s ease-out, opacity .3s" : "none",
                opacity: chosen != null && chosen !== i ? .25 : 1,
                cursor: settled && usable && chosen == null ? "pointer" : "default",
                zIndex: chosen === i ? 3 : 1, perspective: 900,
              }}>
              <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `rotateY(${p.ry}deg)` }}>
                <CardBack />
                <CardFront card={card} dim={settled && !usable} />
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => chosen == null && onCancel?.()} style={{
        position: "absolute", bottom: "13%", cursor: "pointer", fontFamily: "inherit",
        fontSize: 11, letterSpacing: 2, textTransform: "uppercase", padding: "9px 20px", borderRadius: 7,
        color: "#9fb4d6", background: "transparent", border: "1px solid #9fb4d655",
        opacity: settled && chosen == null ? 1 : 0, pointerEvents: settled && chosen == null ? "auto" : "none",
        transition: "opacity .3s",
      }}>Keep my cards</button>
    </div>
  );
}
