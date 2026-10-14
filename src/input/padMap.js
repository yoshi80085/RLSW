// ─── 🎮 THE CONTROLLER MAP — pure: which button means what ──────────────────
// Alex, 2026-10-14: *"when I think of games I want to play, the first thing I
// usually do is search for a way to play it with my controller"* → *"Lets build
// the foundation now"*. This file is the whole map; `gamepad.js` runs it.
//
// ⭐ THE ONE RULE: A PAD PRESS IS A KEY PRESS (or a click). Every button below
// becomes the keyboard event, or the click, that already does that job, so it
// goes through the SAME handler and the SAME gates — `keyboardNoteCommit`,
// `numpadMove`, `enterEndTurn`, the three Riff-Off listeners. There is no second
// code path for a controller to drift out of step with (the `continueToMelody`
// rule, applied to a whole device).
//
// 📌 Standard mapping only (`Gamepad.mapping === 'standard'`) — every Xbox pad,
// a DualShock/DualSense in Chrome, a Switch Pro, a Steam Deck. Names are the
// Xbox labels because that is the pad Alex named.

/** Fired on `document` while the pad is in use. `board/arenaRenderer.js` counts it
 *  as activity, so the 10 s idle auto camera never takes the lens from a player
 *  who is only using the sticks (no DOM key or mouse event says they are there). */
export const PAD_ACTIVITY_EVENT = 'rlsw:pad-activity';

/** W3C "standard" gamepad button indices, by Xbox label. */
export const PAD_BUTTONS = Object.freeze({
  A:0, B:1, X:2, Y:3, LB:4, RB:5, LT:6, RT:7, View:8, Menu:9, LS:10, RS:11,
  Up:12, Down:13, Left:14, Right:15,
});
export const PAD_BUTTON_NAMES = Object.freeze(Object.keys(PAD_BUTTONS));

/** Feel. ✅ Alex's dial-in, 2026-10-14 (Controller Lab, his own pad): 0 of 11 moved —
 *  these first-pass numbers are now his call. Re-dial on `.scratch/pad-lab.html`. */
export const PAD_TUNING = Object.freeze({
  stickDead: .25,        // radial deadzone: a resting stick reads up to ~.15 on worn pads
  // ⚠️ TRIGGERS ARE ANALOG, AND A RHYTHM GAME FEELS THEIR TRAVEL. Pressing at
  // .30 (not the halfway .5) cuts the throw before the note lands; releasing
  // only under .18 stops a trigger hovering at the threshold from chattering
  // a sustain on and off.
  triggerOn: .30, triggerOff: .18,
  flickOn: .62, flickOff: .35,   // a stick "flick" (walk step, bend): out past On, back under Off
  walkRepeatMs: 300,     // a stick HELD over keeps walking, one hex per this
  navDelayMs: 380,       // a D-pad held over: first repeat after this…
  navRepeatMs: 115,      // …then one more every this
  orbitRadPerSec: 2.4,   // right stick full over: turns the lens this fast
  tiltRadPerSec: 1.3,    // right stick full up/down: tilts it this fast
  zoomPerSec: 2.2,       // a trigger held fully: camera distance ×/÷ this per second
  // 📌 4 ms, not once a frame: the riff judges read the clock when the key event
  // arrives, so a once-a-frame poll would add up to 16 ms of jitter to every
  // strike. Polling a pad is a few array reads; it is not the cost.
  pollMs: 4,
});

// ─── 🎸 THE RIFF-OFF ─────────────────────────────────────────────────────────
// ⭐ SIX STRINGS, SIX FINGERS. A pad has exactly six digits that can each hold a
// button on their own: both index fingers (bumpers), both middle fingers
// (triggers) and both thumbs. Give every string its own finger and ANY chord
// shape is playable, and a sustain can ring under any other strike — which a
// layout that puts two strings under one thumb can never do.
// Ordered as the hands sit, outside → in → out, so the lanes read left to right
// as the fingers do: 1 left trigger · 2 left bumper · 3 left thumb ‖ 4 right
// thumb · 5 right bumper · 6 right trigger. (Alex's own sketch, 2026-10-14, had
// exactly this shape; the change is the thumbs.)
// ⭐ A THUMB'S STRING IS ITS WHOLE CLUSTER — any D-pad direction is string 3,
// any face button is string 4 — so a thumb never has to AIM in the middle of a
// run. That frees the sticks for the bends.
// ⭐ BENDS ARE A STICK FLICK, either stick: up bends up, down bends down. A bend
// happens on a note already HELD, so at least one thumb is always free.
export const RIFF_LAYOUT = Object.freeze({
  strings: Object.freeze({
    1: ['LT'], 2: ['LB'], 3: ['Up', 'Down', 'Left', 'Right'],
    4: ['A', 'B', 'X', 'Y'], 5: ['RB'], 6: ['RT'],
  }),
  bendSticks: ['ls', 'rs'],
  start: ['Menu'],   // → Enter (the practice highway's start)
  back: ['View'],    // → Escape (leave practice) — B is a string here, not "back"
});

// ─── 🎲 A TURN ───────────────────────────────────────────────────────────────
// Keys are the keyboard's own: `key` + `code`, exactly as a real press sends them.
const key = (k, code) => Object.freeze({ key: k, code });
export const TURN_LAYOUT = Object.freeze({
  keys: Object.freeze({
    Y: key('Enter', 'Enter'),          // the turn's next step: Continue → ✓ Commit → End ⏭
    X: key('Backspace', 'Backspace'),  // take the last Melody note back
    LB: key('w', 'KeyW'),              // 🎡 the Scale Wheel
    RB: key('Tab', 'Tab'),             // Drive ⇄ Sustain in the Chord Stack step
    B: key('Escape', 'Escape'),        // back / close
    RS: key('5', 'Numpad5'),           // 🧭 face north (click the right stick)
  }),
  // D-pad = move the highlight · A = press it · Menu = ☰ · left stick = walk ·
  // right stick = camera · LT / RT = zoom out / in. View is left free on purpose.
  press: ['A'], menu: ['Menu'],
  nav: Object.freeze({ Up: 'up', Down: 'down', Left: 'left', Right: 'right' }),
});

// ─── reading a pad ───────────────────────────────────────────────────────────

/** Apply a radial deadzone, rescaled so the edge of the dead ring reads 0. */
export function deadzone(x, y, dead = PAD_TUNING.stickDead) {
  const m = Math.hypot(x, y);
  if (m <= dead || !Number.isFinite(m)) return { x: 0, y: 0, m: 0 };
  const k = Math.min(1, (m - dead) / (1 - dead)) / m;
  return { x: x * k, y: y * k, m: Math.min(1, (m - dead) / (1 - dead)) };
}

/**
 * One pad → a plain snapshot: `{ down: {A:true,…}, lt, rt, ls:{x,y,m}, rs }`.
 * `prev` (the last snapshot) gives the triggers their hysteresis.
 * ⚠️ A TRIGGER'S "DOWN" IS ITS VALUE, NOT `.pressed`: browsers set `.pressed`
 * at their own threshold (Chrome ~.12, Firefox .5), so two machines would
 * strike a string at different depths.
 */
export function readPad(gp, prev = null, tune = PAD_TUNING) {
  const btn = i => gp?.buttons?.[i];
  const down = {};
  for (const name of PAD_BUTTON_NAMES) {
    const b = btn(PAD_BUTTONS[name]);
    if (name === 'LT' || name === 'RT') {
      const v = typeof b === 'object' ? (b?.value ?? (b?.pressed ? 1 : 0)) : Number(b) || 0;
      down[name] = prev?.down?.[name] ? v > tune.triggerOff : v >= tune.triggerOn;
    } else {
      down[name] = typeof b === 'object' ? !!b?.pressed : !!b;
    }
  }
  const val = i => { const b = btn(i); return typeof b === 'object' ? (b?.value ?? 0) : Number(b) || 0; };
  const ax = i => Number(gp?.axes?.[i]) || 0;
  return {
    down, lt: val(PAD_BUTTONS.LT), rt: val(PAD_BUTTONS.RT),
    ls: deadzone(ax(0), ax(1), tune.stickDead), rs: deadzone(ax(2), ax(3), tune.stickDead),
  };
}

/** Which buttons went down / came up between two snapshots. */
export function padEdges(prev, next) {
  const pressed = [], released = [];
  for (const name of PAD_BUTTON_NAMES) {
    const a = !!prev?.down?.[name], b = !!next?.down?.[name];
    if (b && !a) pressed.push(name);
    if (a && !b) released.push(name);
  }
  return { pressed, released };
}

/** The riff strings (1–6) a snapshot holds down. */
export function heldStrings(snap, layout = RIFF_LAYOUT) {
  const held = new Set();
  for (const [s, names] of Object.entries(layout.strings)) {
    if (names.some(n => snap?.down?.[n])) held.add(Number(s));
  }
  return held;
}

/**
 * A stick flick, with hysteresis: returns `{ armed, fire }` — `fire` is 'up' /
 * 'down' / 'left' / 'right' on the poll the stick crosses `flickOn`, else null;
 * `armed` must be fed back next poll (true while the stick is still out).
 */
export function stickFlick(stick, armed, tune = PAD_TUNING) {
  const m = stick?.m ?? 0;
  if (armed) return { armed: m > tune.flickOff, fire: null };
  if (m < tune.flickOn) return { armed: false, fire: null };
  const { x, y } = stick;
  const fire = Math.abs(y) >= Math.abs(x) ? (y < 0 ? 'up' : 'down') : (x < 0 ? 'left' : 'right');
  return { armed: true, fire };
}

// ─── 🚶 WALKING WITH THE STICK ───────────────────────────────────────────────
// The numpad walks by BOARD north (Alex's ruling 2, `ui/numpadMove.js`). A stick
// cannot: a player pushes it toward where they want to go ON SCREEN. So the
// stick is turned by the lens heading into a board direction, and that direction
// becomes the numpad key for it — the walk itself is still `numpadMove`, every
// rule intact.
// The six numpad keys' board angles (SVG, y down — `NUMPAD_DIRS`), copied so this
// module stays dependency-free; `gamepadCheck` asserts the two agree.
export const WALK_CODES = Object.freeze({
  Numpad8: -90, Numpad2: 90, Numpad9: -30, Numpad3: 30, Numpad7: -150, Numpad1: 150,
});

/**
 * Stick (x right, y DOWN, as the Gamepad API reports) + lens heading
 * (`topDownView.lensHeading`: 0 = looking north) → the board angle it points at,
 * in radians, SVG convention (y down, north = −π/2).
 * 📌 Derivation: the lens's screen-up is world (−sin h, −cos h) and screen-right
 * (cos h, −sin h) in (x, z), and the board's SVG y IS world z (`arenaPoint`).
 */
export function stickBoardAngle(x, y, heading = 0) {
  const c = Math.cos(heading), s = Math.sin(heading);
  return Math.atan2(-x * s + y * c, x * c + y * s);
}

/** The numpad code whose direction is nearest a board angle (every angle has one). */
export function walkCodeFor(angle) {
  let best = null, bestD = Infinity;
  for (const [code, deg] of Object.entries(WALK_CODES)) {
    let d = Math.abs(angle - deg * Math.PI / 180) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d < bestD) { bestD = d; best = code; }
  }
  return best;
}
