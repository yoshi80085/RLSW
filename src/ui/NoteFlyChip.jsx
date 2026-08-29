// ─── 🎵 THE NOTE IN FLIGHT ───────────────────────────────────────────────────
//
// A committed note flying from the note stock to the seat it lands in — the
// commit track, the Drive stack or the Sustain stack. Ported from the flight
// section of `.scratch/note-commit-overlay.html` (Alex's dial-in, 2026-08-27),
// which is where every number in `NOTE_FLIGHT` came from.
//
// ⚠️ WHY THIS REPLACED A CSS CLASS. The old chip was `.note-fly-chip` — a solid
// clip-path hexagon translated in a straight line by a two-keyframe animation
// and faded out on arrival. It fired correctly; it just did not read as flight.
// The preview's version is a BALLISTIC path (a bowed arc), it MORPHS from the
// hand chip's size to the seat's, its bracket ring SPINS on the way over, and
// it sheds rings behind it so the path is legible after the chip has passed.
// None of that expresses in two keyframes on a straight line, which is why it
// is a component driving the Web Animations API and not more CSS.
//
// 📌 THE CHIP IS A REAL `NoteHex`. That is the point of the exercise — the
// thing that lands is the thing that flew, and both are the thing sitting in
// the hand. It used to be three different hexagons.

import { useEffect, useLayoutEffect, useRef } from "react";
import NoteHex, { hexPoints } from "./NoteHex.jsx";

/** 🎛️ THE ONLY THINGS MEANT TO BE TUNED.
 *  Read off the preview's control panel: SPEED/ARC/SPIN IN FLIGHT/TRAIL rows.
 *  📌 `launchDelay` IS 34% OF A BURST, AND IT IS NOT DEAD AIR. The chip holds
 *  while the DEPARTURE BURST flares around it, then leaves as the flare peaks —
 *  the note looks like it is thrown by the burst rather than merely after it.
 *  ⚠️ It was 0 for exactly one session, while the burst was unported, because
 *  the same delay with nothing on screen reads as a dropped click. If the burst
 *  is ever taken out again, this goes back to 0 with it. */
export const NOTE_FLIGHT = {
  duration:    751,   // ms — preview "IDLE STEP / fly" slider
  arc:          95,   // px the path bows UPWARD at its midpoint
  spinTurns:     2,   // bracket-ring turns during the flight ("SPIN IN FLIGHT")
  detent:      120,   // degrees in one turn. The bracket ring is 3-fold
                      // symmetric (bracketEvery: 2), so 120° is one full
                      // apparent rotation — not 360°.
  trail:         3,   // rings shed along the path ("TRAIL")
  waveReach:  1.91,   // how far a shed ring expands ("REACH")
  waveInt:     1.5,   // glow multiplier on a shed ring ("INTENSITY")
  launchDelay: 289,   // = round(849 × 0.34), the preview's LAUNCH DELAY
  frames:       24,   // path samples. 24 is the preview's; it is smooth because
                      // the browser interpolates BETWEEN them, so more costs
                      // memory and buys nothing.
};

/**
 * @param flight  null, or { key, letter, hue, x0, y0, x1, y1, size0, size1 }
 *                — viewport coordinates, because the layer is position:fixed.
 * @param onDone  called once the chip has landed, so the caller can clear state.
 */
export function NoteFlyChip({ flight, onDone }) {
  const chipRef = useRef(null);
  // 📌 `onDone` IS HELD IN A REF, NOT CLOSED OVER. The flight effect must run
  // once per launch and only when the launch changes, so it cannot list
  // `onDone` as a dependency — a caller passing an inline arrow (every caller
  // does) would restart the animation on every parent render and the chip would
  // stutter back to the hand. The ref keeps the latest callback reachable
  // without making it a trigger. ⚠️ Written in an effect, not during render.
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; });

  // ⚠️ KEYED ON `flight.key`, NOT ON THE OBJECT. Two commits of the same note
  // to the same seat produce equal-looking payloads; without a fresh key the
  // second one would not re-run the effect and the chip would not fly — the
  // same class of bug as re-adding a CSS class to restart an animation.
  const key = flight?.key ?? null;

  useLayoutEffect(() => {
    const el = chipRef.current;
    if (!flight || !el) return;
    const F = NOTE_FLIGHT;
    const { x0, y0, x1, y1, size0, size1 } = flight;

    const N = F.frames, frames = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t - F.arc * Math.sin(Math.PI * t);
      const s = 1 + (size1 / size0 - 1) * t;
      frames.push({
        transform: `translate(${(x - size0 / 2).toFixed(1)}px,${(y - size0 / 2).toFixed(1)}px) `
                 + `scale(${s.toFixed(3)})`,
        offset: t,
      });
    }
    const opts = { duration: F.duration, delay: F.launchDelay,
                   easing: "cubic-bezier(.35,.02,.25,1)", fill: "both" };
    const runs = [el.animate(frames, opts)];

    const brk = el.querySelector(".notehex-brk-g");
    if (brk && F.spinTurns) {
      runs.push(brk.animate(
        [{ transform: "rotate(0deg)" }, { transform: `rotate(${F.detent * F.spinTurns}deg)` }],
        { ...opts, easing: "linear" }));
    }
    runs[0].onfinish = () => doneRef.current?.();
    // 🛟 A tab backgrounded mid-flight suspends the animation and `onfinish`
    // may never arrive, which would strand the chip on screen forever.
    const bail = setTimeout(() => doneRef.current?.(), F.launchDelay + F.duration + 400);
    return () => { clearTimeout(bail); runs.forEach(r => { try { r.cancel(); } catch { /* gone */ } }); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!flight) return null;
  const F = NOTE_FLIGHT;
  const { x0, y0, x1, y1, size0, hue, letter } = flight;

  return (
    <div className="note-fly-layer">
      {/* 💨 THE TRAIL — the ring the chip leaves behind at points along its own
          path, so the gap between launch and landing is not dead air. Each one
          is declared UP FRONT with a staggered animation-delay rather than
          spawned on a timer: a timer that fires after the state clears leaves an
          orphan node in the DOM, and there is nothing left to remove it. */}
      {Array.from({ length: F.trail }).map((_, k) => {
        const t = (k + 1) / (F.trail + 1);
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t - F.arc * Math.sin(Math.PI * t);
        return (
          <svg key={k} className="note-fly-wave" width={size0} height={size0}
            viewBox="0 0 120 120" aria-hidden="true"
            style={{ left: x - size0 / 2, top: y - size0 / 2,
              "--reach": (1 + F.waveReach) / 2,
              "--wave-ms": `${Math.round(F.duration * 0.55)}ms`,
              // ⚠️ THE DELAY RIDES A CSS VARIABLE, NOT `animationDelay` HERE.
              // The animation is declared on the POLYGON (it needs the SVG
              // transform-origin); an animation-delay set on the <svg> wrapper
              // would style an element that is not animating and every ring
              // would fire at once.
              "--wave-delay": `${F.launchDelay + Math.round(F.duration * t * 0.9)}ms`,
              filter: `drop-shadow(0 0 ${(5 * F.waveInt).toFixed(1)}px ${hue})` }}>
            <polygon points={hexPoints()} fill="none" stroke={hue} strokeLinejoin="round" />
          </svg>
        );
      })}
      <div ref={chipRef} className="note-fly-chip-v2" style={{ width: size0, height: size0 }}>
        <NoteHex hue={hue} letter={letter} size={size0} />
      </div>
    </div>
  );
}
