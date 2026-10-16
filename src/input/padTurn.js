// ─── 🎮 A TURN ON A PAD — the verbs for each step, and the rules they pick by ─
// Alex, 2026-10-14: *"The start of any turn is the chord selection … so should the
// button configuration deal with these steps without needing a mouse and keyboard.
// Note committing - control with note is selected with the left joystick. Hammer
// on/pull offs? … the option for abilities should be able to be accessed easily
// without mouse/keyboard"* → he took my four ideas: the Scale Wheel as a stick
// picker, the hammer-on as a right-stick flick, the D-pad as the ability cross with
// targeting that only lands on legal hexes, and a button bar saying what each
// button does now.
//
// ✅ STATUS: IN THE GAME (2026-10-14, the port). `PAD_TURN` is Alex's dial-in and is
// ALSO the preview's defaults (`.scratch/pad-turn-preview.jsx`, `npm run build:padturn`)
// — one copy, so the page and the game can't drift. Read by `input/gamepad.js` (the
// pad's turn verbs), `ui/PoolWheel.jsx`, `ui/PadButtonBar.jsx` and `ui/PadCross.jsx`.
//
// This file is pure: numbers, and the geometry that turns a stick into a note or
// a target. No DOM, no React.

/** Every taste call on the preview page. ✅ Alex's dial-in, 2026-10-14 20:19: **0 of 30 moved** —
 *  after `wheelSize` 370 and `wheelPointer` 'arc' — so every number here is now his call. */
export const PAD_TURN = Object.freeze({
  // 🧭 the button bar: what each button does RIGHT NOW
  barPlace: 'bottom',      // 'bottom' (centred under the arena) · 'left' (bottom-left) · 'top'
  barScale: 1,             // × size
  barGlyphs: 'xbox',       // 'xbox' (A green · B red · X blue · Y yellow) · 'mono' (one colour, outlined)
  barLabels: true,         // the words beside each glyph
  barOpacity: .92,
  barMouseKeys: true,      // in mouse mode the bar shows the KEYS instead of hiding

  // 🎡 the Scale Wheel as the note picker (Chord Stack + Melody)
  wheelPlace: 'centre',    // 'centre' (over the arena, big) · 'dock' (under Turn · Scale · Rivals) · 'hud' (in the column)
  wheelSize: 370,          // px — ✅ Alex's dial-in, 2026-10-14 (was 300)
  wheelChip: 44,           // the note hexes, in wheel units (the nav wheel's are 38) — Alex: "a bit bigger"
  wheelSnap: 'held',       // 'held' (only notes in your hand) · 'palette' (any scale note) · 'all'
  wheelDead: .45,          // how far the stick must lean before it picks (0–1)
  wheelPointer: 'arc',     // ✅ Alex's dial-in 2026-10-14 (was 'both'). Where the stick points: 'beam' (a tapered neon blade from the hub, a hex jewel at its tip) · 'arc' (a lit sweep on the rim) · 'both' · 'line' (the first pass) · 'off'
  wheelMark: 'both',       // the picked note: 'ring' · 'glow' · 'both'
  wheelAudition: 'held',   // play each note as the stick sweeps onto it: 'off' · 'held' · 'all'
  wheelVolume: .45,
  wheelRumble: .25,        // a tick in the pad as each note is crossed (0 = off)
  wheelRelease: 'keep',    // stick back to centre: 'keep' the pick (A still plays it) · 'clear' it
  // 🎯 THE LET-GO FIX (Alex, 2026-10-14: *"its hard to get it to 'stick' to one of the
  // diagonal directions - it usually feels like it 'wants' to snap to the nearest 4
  // directions"*). A stick let go from a diagonal does not come home in a straight
  // line: one axis springs back a frame or two before the other, so its last readings
  // point straight up/down/left/right. Three guards, one lever each:
  wheelSteady: .8,         // the pick only moves while the stick is pushed ≥ this share of its recent peak (a stick on its way home is ignored)
  wheelSettleMs: 90,       // on letting go, the pick goes back to where it pointed this long before the stick came home
  wheelStickDeg: 8,        // the picked note is sticky: another must be this many degrees nearer to take over

  // 🎡 the wheel AS the note pool (Alex, 14 Oct: it replaces the honeycomb, for everyone)
  poolHub: true,           // Chord Stack: the hub wears the destination's colour (Drive red / Sustain blue) with the budget pips under it
  poolStrip: 'off',        // the old hand as a small strip in the HUD column as well: 'off' · 'chips'
  // 🪟 THE POOL'S OWN WINDOW (Alex, 2026-10-14, his first match: *"the wheel is very obscured by
  // everything else on the board. Perhaps it needs is own window that perhaps blurs its
  // surroundings?"*). A glass disc behind the wheel, and the rest of the arena dimmed while you
  // compose. Then (22:12) *"dark but not totally opaque … I'd like to control the level of
  // transparency"* → `.scratch/pool-window-preview.html`. ✅ HIS DIAL-IN, 22:32: 5 of 10 moved —
  // darkness .42 (58 % see-through), blur 3, edge .97, glow 1.25, soft edge 31. The rest untouched.
  // (First pass, for the record: disc .88, blur 10, edge .82, glow 1, soft 0.)
  poolDim: .5,             // how dark the arena around the wheel goes (0 = untouched, 1 = black) — untouched
  poolDisc: .42,           // ✅ dialled (.88): the disc behind the wheel, how solid (0 = clear glass, 1 = opaque)
  poolBlur: 3,             // ✅ dialled (10): px of blur through the disc (the arena behind it softens)
  poolDiscEdge: .97,       // ✅ dialled (.82): the rim's darkness as a share of the centre's (1 = even, lower = the edge thins out)
  poolDiscTint: 'navy',    // the glass's colour: 'navy' (the HUD's panels) · 'black' · 'spirit' (a dark wash of the Spirit's accent) — untouched
  poolDiscSize: 96,        // the disc's width, % of the wheel's square (96 = just past the ornament ring) — untouched
  poolDiscRim: 1.25,       // ✅ dialled (1): the accent glow round the disc. ⚠️ With poolDiscSoft > 0 the soft edge's mask hides it (it sits outside the disc) — so at his dial it draws nothing; kept as he set it
  poolDiscSoft: 31,        // ✅ dialled (0): % of the radius the glass fades out over (0 = a hard rim; >0 drops the glow ring too)
  poolDimHole: .55,        // the dim AT the wheel, as a share of the dim far away (1 = flat, lower = a clearer pool of light) — untouched
  poolDimReach: 340,       // px from the wheel's centre to where the dim is full — untouched

  // 🎸 the hammer-on / pull-off (the Ronin, Melody step)
  hammerInput: 'flick',    // 'flick' (right stick ↑ hammer, ↓ pull) · 'rt' (a tap of RT) · 'both'
  hammerFlick: .62,        // how far the flick must go
  hammerHint: 'arc',       // the hint on the wheel: 'arc' (gold slur to the note) · 'arrow' (↑/↓ on the hub) · 'off'

  // ✚ the ability cross (Move & Act)
  crossPlace: 'standee',   // 'standee' (four chips around your Spirit) · 'corner' (bottom-left of the arena) · 'bar' (in the bar only)
  crossSize: 1,
  crossMap: 'sides',       // 'sides' (← → your two signatures, ↑ Sonic, ↓ Swing) · 'top' (↑ ↓ signatures, ← Swing, → Sonic)
  targetHop: 'both',       // aim with: 'stick' · 'dpad' · 'both'
  targetCycle: true,       // LB / RB step through the legal targets in a circle
});

/** The levers' choices, for the preview's button rows. */
/** How long the aim remembers (ms) — the release rewind and the recent peak read from it. */
const AIM_MEMORY_MS = 400, PEAK_WINDOW_MS = 110;

/**
 * 🎯 A stick aimed at the wheel, over time — the let-go fix (see `wheelSettleMs`).
 * `feed(stick, slots, tMs)` every poll → `{ pc, steady, released }`:
 *   · `pc` — the picked slot (null until something is picked).
 *   · `steady` — the stick is held out, not springing home; only then may the pick move
 *     (and only then should the caller audition a note or tick the rumble).
 *   · `released` — this poll the stick came home; `pc` is the rewound pick.
 * `set(pc)` lets the D-pad (or a commit) move the pick without the stick.
 */
export function createWheelAim({ snap = PAD_TURN.wheelSnap, dead = PAD_TURN.wheelDead, steady = PAD_TURN.wheelSteady,
  settleMs = PAD_TURN.wheelSettleMs, stickDeg = PAD_TURN.wheelStickDeg } = {}) {
  let pc = null, out = false;
  let hist = [];   // { t, m, pc } — every poll the stick was out
  const tune = { snap, dead, steady, settleMs, stickDeg };
  function aimAt(stick, slots) {
    const at = stickClock(stick.x, stick.y);
    const best = pickWheelSlot(stick, slots, { snap: tune.snap, dead: 0 });
    if (best == null || pc == null || best === pc) return best;
    const cur = (slots ?? []).find(s => s.pc === pc);
    if (!cur || !pickable(cur, tune.snap)) return best;
    const nb = slots.find(s => s.pc === best);
    // ⭐ STICKY: the new note must be `stickDeg` nearer than the one already picked
    return arc(at, nb.k * 30) + tune.stickDeg < arc(at, cur.k * 30) ? best : pc;
  }
  return {
    tune,
    get: () => pc,
    set(v) { pc = v; },
    feed(stick, slots, t) {
      const m = stick?.m ?? Math.hypot(stick?.x ?? 0, stick?.y ?? 0);
      hist = hist.filter(h => t - h.t <= AIM_MEMORY_MS);
      if (m >= tune.dead) {
        const peak = Math.max(m, ...hist.filter(h => t - h.t <= PEAK_WINDOW_MS).map(h => h.m));
        const isSteady = m >= peak * tune.steady;
        if (isSteady) pc = aimAt(stick, slots) ?? pc;
        hist.push({ t, m, pc });
        out = true;
        return { pc, steady: isSteady, released: false };
      }
      if (out) {
        // ⭐ THE REWIND: the stick just came home. Its last few readings are the spring,
        // not the player — go back to what it pointed at `settleMs` before now.
        out = false;
        const before = hist.filter(h => h.t <= t - tune.settleMs);
        const back = before.length ? before.at(-1) : hist[0];
        if (back && back.pc != null) pc = back.pc;
        hist = [];
        return { pc, steady: false, released: true };
      }
      return { pc, steady: false, released: false };
    },
  };
}

export const PAD_TURN_CHOICES = Object.freeze({
  barPlace: ['bottom', 'left', 'top'], barGlyphs: ['xbox', 'mono'],
  poolStrip: ['off', 'chips'], wheelPlace: ['centre', 'dock', 'hud'], wheelPointer: ['beam', 'arc', 'both', 'line', 'off'], wheelSnap: ['held', 'palette', 'all'], wheelMark: ['ring', 'glow', 'both'], poolDiscTint: ['navy', 'black', 'spirit'],
  wheelAudition: ['off', 'held', 'all'], wheelRelease: ['keep', 'clear'],
  hammerInput: ['flick', 'rt', 'both'], hammerHint: ['arc', 'arrow', 'off'],
  crossPlace: ['standee', 'corner', 'bar'], crossMap: ['sides', 'top'], targetHop: ['stick', 'dpad', 'both'],
});

/** The cross: which D-pad direction holds which ability, by `crossMap`.
 *  `sig1` / `sig2` = the Spirit's two drafted abilities, in draft order. */
export const CROSS_MAPS = Object.freeze({
  sides: Object.freeze({ Left: 'sig1', Right: 'sig2', Up: 'sonic', Down: 'swing' }),
  top: Object.freeze({ Up: 'sig1', Down: 'sig2', Left: 'swing', Right: 'sonic' }),
});

// ─── 🎡 a stick → a note on the wheel ───────────────────────────────────────
// The wheel's twelve slots sit at k × 30° clockwise from twelve o'clock
// (`ScaleWheel.jsx` `slotAngle`), k = semitones above the root.

/** Stick (x right, y DOWN, as the Gamepad API reports) → degrees clockwise from up, 0–360. */
export const stickClock = (x, y) => ((Math.atan2(x, -y) * 180 / Math.PI) + 360) % 360;
const arc = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** Can this slot be picked under `snap`? (`held` = hand notes you still have.) */
export const pickable = (slot, snap = PAD_TURN.wheelSnap) =>
  snap === 'all' ? true : snap === 'palette' ? !!slot.inPal : (slot.held?.length ?? 0) > 0;

/**
 * The slot a stick points at, or null under the dead zone.
 * ⭐ MAGNETIC: under `held` the stick snaps to the nearest note you HOLD, so a
 * thumb can't land on a dead slot — on a five-note hand every held note owns a
 * wide wedge, not a 30° sliver.
 * `slots` are `wheelModel(...).slots` (`{ pc, k, held, inPal }`).
 */
export function pickWheelSlot(stick, slots, { snap = PAD_TURN.wheelSnap, dead = PAD_TURN.wheelDead } = {}) {
  if (!stick || (stick.m ?? Math.hypot(stick.x, stick.y)) < dead) return null;
  const at = stickClock(stick.x, stick.y);
  let best = null, bestD = Infinity;
  for (const s of slots ?? []) {
    if (!pickable(s, snap)) continue;
    const d = arc(at, s.k * 30);
    if (d < bestD || (d === bestD && s.k < best.k)) { best = s; bestD = d; }
  }
  return best ? best.pc : null;
}

/** D-pad ← / → (or LB-style stepping) around the wheel: the next pickable slot clockwise (+1) or back (−1). */
export function stepWheelSlot(currentPc, slots, dir, { snap = PAD_TURN.wheelSnap } = {}) {
  const ring = [...(slots ?? [])].filter(s => pickable(s, snap)).sort((a, b) => a.k - b.k);
  if (!ring.length) return null;
  const i = ring.findIndex(s => s.pc === currentPc);
  if (i < 0) return (dir > 0 ? ring[0] : ring.at(-1)).pc;
  return ring[(i + (dir > 0 ? 1 : -1) + ring.length) % ring.length].pc;
}

/** After the lit note is spent (its last copy played): the next pickable slot CLOCKWISE
 *  from where it sat — so a run up the wheel keeps going up, rather than jumping back to
 *  the root the way `stepWheelSlot` restarts. Nothing picked → the first from the root. */
export function nextHeldSlot(currentPc, slots, { snap = PAD_TURN.wheelSnap } = {}) {
  const ring = [...(slots ?? [])].filter(s => pickable(s, snap)).sort((a, b) => a.k - b.k);
  if (!ring.length) return null;
  const cur = (slots ?? []).find(s => s.pc === currentPc);
  if (!cur) return ring[0].pc;
  return (ring.find(s => s.k > cur.k) ?? ring[0]).pc;
}

// ─── 🎯 aiming at a target ──────────────────────────────────────────────────

/**
 * From the current target, the next legal target that lies `angleDeg` away
 * (screen degrees clockwise from up), within a ±60° cone; null if none.
 * Points are SCREEN positions `{ id, x, y }` (y down), so "up" is what the player sees.
 * ⭐ Only legal targets are ever offered, so an armed ability can't be aimed at
 * a hex it could not reach — the cursor simply has nowhere else to go.
 */
export function hopTarget(from, targets, angleDeg, { cone = 60 } = {}) {
  let best = null, bestS = Infinity;
  for (const t of targets ?? []) {
    if (t.id === from?.id) continue;
    const dx = t.x - from.x, dy = t.y - from.y, dist = Math.hypot(dx, dy);
    if (dist < 1) continue;
    const off = arc(stickClock(dx, dy), angleDeg);
    if (off > cone) continue;
    const s = dist * (1 + off / 30);   // nearer and straighter wins
    if (s < bestS) { bestS = s; best = t; }
  }
  return best;
}

/** LB / RB: the targets in a circle round the Spirit, and the one after (+1) or before (−1) `currentId`. */
export function cycleTarget(centre, targets, currentId, dir) {
  const ring = [...(targets ?? [])].sort((a, b) => stickClock(a.x - centre.x, a.y - centre.y) - stickClock(b.x - centre.x, b.y - centre.y));
  if (!ring.length) return null;
  const i = ring.findIndex(t => t.id === currentId);
  return ring[i < 0 ? 0 : (i + (dir > 0 ? 1 : -1) + ring.length) % ring.length];
}
