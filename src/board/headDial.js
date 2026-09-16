// ── 🎛️ THE HEAD DIAL — Drive/Sustain over the Spirit whose number moved ─────
//
// Alex, 2026-09-16, on the ticking pocket dial: *"It is easy to miss... the dial
// appearing on the 3D environment over the heads of the Spirit affected?"* So a
// change to any Spirit's Drive or Sustain pops a dial over THAT pawn, ticks it to
// the new value, lingers, and fades.
//
// ⭐ THE NUMBERS ARE ALEX'S DIAL-IN off `.scratch/head-dial-preview.html`, and ⚠️
// **HE RETURNED IT WITH ALL 23 LEVERS UNTOUCHED** — the page's defaults approved
// as they stood, not values he moved to. Re-open the page before treating any one
// of them as load-bearing. The levers that were choices, not numbers, landed as
// behaviour: ANY Spirit's change shows · ONLY the stat that changed · HIDDEN
// between changes · SAME SIZE ON SCREEN · dark backing · nameplate on · ±N tag on
// · no tether · the pocket keeps ticking too.
//
// ⭐ **EVERYTHING IS PUBLIC (Alex, 2026-09-16).** Before this, a rival's DRIVE was
// shown nowhere — the rival rows carry Sustain only. He was asked and chose to
// reveal both. ⚠️ If that is ever walked back, the gate belongs in `arenaFrame`
// (what the scene is allowed to know), not here.
//
// 📌 PURE AND TIME-DRIVEN: no three, no timers, no React. Every question is
// "what does the dial look like at time `now`", so the render loop can ask it
// every frame, a paused tab resumes where it stopped, and `headDialCheck.mjs`
// can walk a whole change without sleeping. The three.js layer is
// `headDialVisuals.js`, and it only draws what `sample()` returns.
import { DIAL_TICK, dialTickInterval } from '../ui/dialTick.js';

export const HEAD_DIAL = Object.freeze({
  height: 2.75,       // world units above the pawn's feet — its head tops out near 2.0
  lift: 0.45,         // × dial size, along the CAMERA's up: from overhead a world height lands on the pawn
  screenSize: 0.06,   // × camera distance — same size on screen from every camera
  spacing: 1.04,      // × size between the two dials of a pair
  leadMs: 220,        // added to DIAL_TICK.delayMs when the dial first appears: it is up before it moves
  fadeInMs: 180,
  popFrom: 0.62,      // scale the pop-in starts from
  lingerMs: 900,      // stays up after the last tick
  fadeOutMs: 420,
  rise: 0.3,          // world units it drifts up while fading
  bob: 0.04,
  glow: 1.5,          // sprite colour multiplier — above ~1.1 the lit blocks catch the bloom pass
});

const STATS = ['drive', 'sustain'];
const easeOut = p => 1 - (1 - p) * (1 - p);
const easeOutBack = p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2; };
const clamp01 = p => Math.max(0, Math.min(1, p));
const clampStat = v => Math.max(0, Math.min(10, Number(v)));

/**
 * One stat's run toward a value, as a closed-form timeline: where it stands at any
 * `now`, when it lands, and the step that produced the current block.
 * ⚠️ The last step lands EXACTLY on `to`, so a fractional value is reached, not
 * overshot — the same rule as `dialTickStep`.
 */
function runAt(run, now) {
  const n = Math.ceil(Math.abs(run.to - run.from));
  if (n === 0 || now < run.t0) return { value: run.from, step: 0, stepAt: -Infinity };
  const step = Math.min(n, Math.floor((now - run.t0) / run.every) + 1);
  const value = step >= n ? run.to : run.from + Math.sign(run.to - run.from) * step;
  return { value, step, stepAt: run.t0 + (step - 1) * run.every };
}
const runEnd = run => run.t0 + Math.max(0, Math.ceil(Math.abs(run.to - run.from)) - 1) * run.every;

/**
 * @param {{drive:number, sustain:number}} initial  the values already true — the
 *        dial is NOT shown for them. A Spirit entering the scene mid-match, or
 *        coming back out of the smoke, must not announce numbers nobody changed.
 */
export function createHeadDialState(initial = {}) {
  const stat = Object.fromEntries(STATS.map(s => {
    const v = initial[s] == null ? null : clampStat(initial[s]);
    return [s, { run: { from: v, to: v, t0: 0, every: DIAL_TICK.stepMs }, runFrom: v, shown: false }];
  }));
  let shownAt = -Infinity;     // when the rig last popped in
  let up = false;              // a change is in progress or lingering

  const holdUntil = () => Math.max(...STATS.filter(s => stat[s].shown).map(s => runEnd(stat[s].run))) + HEAD_DIAL.lingerMs;

  return {
    /**
     * A new authoritative value. `snap` moves it silently (no dial): pass it when
     * the change is not an event — first sight, a value that was unknown.
     * `reduced` (prefers-reduced-motion) still SHOWS the dial, but it lands at once.
     */
    set(which, value, now, { snap = false, reduced = false } = {}) {
      const st = stat[which];
      if (!st || value == null || !Number.isFinite(Number(value))) return;
      const v = clampStat(value);
      const cur = st.run.from == null ? null : runAt(st.run, now).value;
      if (cur == null || snap) { st.run = { from: v, to: v, t0: now, every: DIAL_TICK.stepMs }; if (!up) st.runFrom = v; return; }
      if (v === st.run.to) return;
      this.expire(now);
      const rigWasUp = up;
      if (!rigWasUp) { up = true; shownAt = now; for (const s of STATS) { stat[s].shown = false; stat[s].runFrom = runAt(stat[s].run, now).value; } }
      const moving = cur !== st.run.to;
      if (!st.shown) st.runFrom = cur;
      st.shown = true;
      // ⚠️ A RETARGET MID-RUN CARRIES ON FROM WHERE THE DIAL STANDS, one step
      // later, with no second wait — a change of mind turns round. A dial that is
      // already up but idle waits the ordinary beat; only a dial that is POPPING
      // IN adds the lead, because only then does the eye have to find it first.
      const every = dialTickInterval(v - cur);
      const t0 = reduced ? now : moving ? now + every : now + DIAL_TICK.delayMs + (rigWasUp ? 0 : HEAD_DIAL.leadMs);
      st.run = reduced ? { from: v, to: v, t0: now, every } : { from: cur, to: v, t0, every };
    },

    /** Drop a finished change so the next one starts from a clean rig. */
    expire(now) {
      if (up && now >= holdUntil() + HEAD_DIAL.fadeOutMs) {
        up = false;
        for (const s of STATS) { stat[s].shown = false; stat[s].runFrom = runAt(stat[s].run, now).value; }
      }
    },

    /** True while anything about the dial is still changing on screen. */
    active(now) { this.expire(now); return up; },

    /**
     * Everything the renderer needs at `now`. `visible:false` means draw nothing.
     * `pop` is a scale multiplier, `rise` a 0..1 fade-out drift, `opacity` 0..1.
     */
    sample(now, { reduced = false } = {}) {
      this.expire(now);
      if (!up) return { visible: false, opacity: 0, pop: 1, rise: 0, dials: [], tag: [] };
      const hold = holdUntil();
      const fadeIn = reduced || !HEAD_DIAL.fadeInMs ? 1 : clamp01((now - shownAt) / HEAD_DIAL.fadeInMs);
      const fadeOut = now <= hold ? 0 : reduced ? 1 : clamp01((now - hold) / HEAD_DIAL.fadeOutMs);
      const opacity = Math.min(fadeIn, 1 - easeOut(fadeOut));
      const pop = reduced || fadeIn >= 1 ? 1 : HEAD_DIAL.popFrom + (1 - HEAD_DIAL.popFrom) * easeOutBack(fadeIn);
      const dials = STATS.filter(s => stat[s].shown).map(s => {
        const st = stat[s], at = runAt(st.run, now);
        const prev = at.step <= 1 ? st.run.from : st.run.from + Math.sign(st.run.to - st.run.from) * (at.step - 1);
        const age = now - at.stepAt;
        const dir = Math.sign(at.value - prev);
        const flashMs = dir > 0 ? DIAL_TICK.gainFlashMs : DIAL_TICK.lossFlashMs;
        const lit = Math.ceil(at.value), prevLit = Math.ceil(prev);
        return {
          stat: s, value: at.value, lit,
          flash: at.step > 0 && dir && lit !== prevLit && age < flashMs
            ? { index: dir > 0 ? lit - 1 : lit, dir, fade: 1 - easeOut(clamp01(age / flashMs)) } : null,
          flare: at.step > 0 && !reduced ? 1 - easeOut(clamp01(age / DIAL_TICK.flareMs)) : 0,
        };
      });
      const tag = STATS.filter(s => stat[s].shown && stat[s].run.to !== stat[s].runFrom)
        .map(s => ({ stat: s, net: stat[s].run.to - stat[s].runFrom }));
      return { visible: opacity > 0.001, opacity, pop, rise: reduced ? 0 : easeOut(fadeOut), dials, tag };
    },
  };
}
