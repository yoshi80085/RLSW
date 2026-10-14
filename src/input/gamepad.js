// ─── 🎮 THE CONTROLLER — polls the pad and plays `padMap.js` ────────────────
// Two layers, because the same buttons mean different things:
//   · 🎲 'turn' (the default): D-pad + A drive the highlight (`padFocus.js`),
//     Y/X/LB/RB/B/R3 are the turn's keys, the left stick walks, the right stick
//     and the triggers move the lens.
//   · 🎸 'riff': while a Riff-Off highway is live, the six fingers are the six
//     strings and the sticks bend. Whoever binds the riff's key listeners ALSO
//     claims this layer for exactly as long (`claimPadLayer('riff')` → release),
//     so the pad can never be playing strings on a turn screen or walking the
//     board mid-duel.
//
// ⭐ OUTPUT IS KEYBOARD EVENTS AND CLICKS (see `padMap.js`): the game cannot tell
// a pad from a keyboard, so every gate the keyboard passes, the pad passes too.
// The two things a keyboard can't do — turn the lens smoothly, and say "the
// player is here" to the idle auto camera — go through the arena camera handle
// (`providePadCamera`) and `PAD_ACTIVITY_EVENT`.
//
// 📌 EVERY CONNECTED PAD DRIVES THE SAME SEAT. Hot-seat with a pad per seat
// needs pads assigned to seats — not built (2026-10-14 foundation).
import { PAD_TUNING, RIFF_LAYOUT, TURN_LAYOUT, PAD_BUTTON_NAMES, PAD_ACTIVITY_EVENT, readPad, padEdges, heldStrings,
  stickFlick, stickBoardAngle, walkCodeFor } from './padMap.js';
import { createPadFocus } from './padFocus.js';

export { PAD_ACTIVITY_EVENT };

// ── layers ──
const layers = [];
/** Claim a layer ('riff') until the returned release is called. Last claim wins. */
export function claimPadLayer(name) {
  const token = { name };
  layers.push(token);
  return () => { const i = layers.indexOf(token); if (i >= 0) layers.splice(i, 1); };
}
export const padLayer = () => (layers.length ? layers[layers.length - 1].name : 'turn');

// ── the arena lens ──
let cameraGetter = () => null;
/** The monolith hands over its arena camera handle (`{ heading, grab, orbit, zoom }`). */
export function providePadCamera(get) {
  cameraGetter = get;
  return () => { if (cameraGetter === get) cameraGetter = () => null; };
}

/**
 * The pad's brain, with every outside thing injected so a test can drive it:
 * `getPads()` → Gamepad-like objects · `sendKey(type, { key, code })` ·
 * `focus` (padFocus or a stub) · `camera()` · `activity()` · `layer()`.
 * Call `tick(nowMs)` every poll.
 */
export function createPadRuntime({ getPads, sendKey, focus = null, camera = () => cameraGetter(),
  activity = () => {}, layer = padLayer, tune = PAD_TUNING, riff = RIFF_LAYOUT, turn = TURN_LAYOUT } = {}) {
  const perPad = new Map();          // pad index → last snapshot (trigger hysteresis)
  let prev = null, lastT = null, lastActivity = -Infinity, lastLayer = 'turn';
  const sentStrings = new Set();     // riff strings we have sent a keydown for
  const bendArmed = { ls: false, rs: false };
  const keysDown = new Map();        // turn-layer button → the key we sent down
  let nav = null;                    // { dir, since, last } while a D-pad direction is held
  let walk = { armed: false, last: -Infinity, code: null };
  let grabbed = false;

  const tap = k => { sendKey('keydown', k); sendKey('keyup', k); };
  const digit = s => ({ key: String(s), code: `Digit${s}` });

  function merge(pads) {
    const down = Object.fromEntries(PAD_BUTTON_NAMES.map(n => [n, false]));
    let lt = 0, rt = 0, ls = { x: 0, y: 0, m: 0 }, rs = { x: 0, y: 0, m: 0 };
    const seen = new Set();
    for (const gp of pads) {
      if (!gp || gp.connected === false) continue;
      const i = gp.index ?? 0; seen.add(i);
      const snap = readPad(gp, perPad.get(i), tune);
      perPad.set(i, snap);
      for (const n of PAD_BUTTON_NAMES) down[n] ||= snap.down[n];
      lt = Math.max(lt, snap.lt); rt = Math.max(rt, snap.rt);
      if (snap.ls.m > ls.m) ls = snap.ls;
      if (snap.rs.m > rs.m) rs = snap.rs;
    }
    for (const i of [...perPad.keys()]) if (!seen.has(i)) perPad.delete(i);
    return { down, lt, rt, ls, rs, any: seen.size > 0 };
  }

  /** Let go of everything we are holding down (a layer change, a lost pad, a blurred window). */
  function releaseAll() {
    for (const s of sentStrings) sendKey('keyup', digit(s));
    sentStrings.clear();
    for (const k of keysDown.values()) sendKey('keyup', k);
    keysDown.clear();
    nav = null; walk = { armed: false, last: -Infinity, code: null };
    bendArmed.ls = bendArmed.rs = false;
    if (grabbed) { grabbed = false; camera()?.grab?.(false); }
  }

  function riffTick(snap, edges) {
    const held = heldStrings(snap, riff);
    for (const s of [...sentStrings]) if (!held.has(s)) { sendKey('keyup', digit(s)); sentStrings.delete(s); }
    for (const s of [...held].sort()) if (!sentStrings.has(s)) { sendKey('keydown', digit(s)); sentStrings.add(s); }
    for (const st of riff.bendSticks) {
      const f = stickFlick(snap[st], bendArmed[st], tune);
      bendArmed[st] = f.armed;
      if (f.fire === 'up') tap({ key: 'ArrowUp', code: 'ArrowUp' });
      if (f.fire === 'down') tap({ key: 'ArrowDown', code: 'ArrowDown' });
    }
    for (const n of edges.pressed) {
      if (riff.start.includes(n)) tap({ key: 'Enter', code: 'Enter' });
      if (riff.back.includes(n)) tap({ key: 'Escape', code: 'Escape' });
    }
  }

  const navGo = dir => { if (!focus) return; if (!focus.adjust?.(dir)) focus.move(dir); };

  function turnTick(snap, edges, t, dt) {
    for (const n of edges.released) {
      if (keysDown.has(n)) { sendKey('keyup', keysDown.get(n)); keysDown.delete(n); }
      if (nav && turn.nav[n] === nav.dir) nav = null;
    }
    for (const n of edges.pressed) {
      const k = turn.keys[n];
      if (k) { sendKey('keydown', k); keysDown.set(n, k); }
      if (turn.press.includes(n) && focus) { if (focus.visible()) focus.press(); else focus.show(); }
      if (turn.menu.includes(n)) focus?.pressSelector?.('button[aria-label="Menu"]');
      if (turn.nav[n]) { navGo(turn.nav[n]); nav = { dir: turn.nav[n], since: t, last: t }; }
    }
    if (nav && t - nav.since >= tune.navDelayMs && t - nav.last >= tune.navRepeatMs) { nav.last = t; navGo(nav.dir); }

    // 🚶 left stick → a numpad step toward where it points ON SCREEN
    const ls = snap.ls;
    if (ls.m >= tune.flickOn) {
      const code = walkCodeFor(stickBoardAngle(ls.x, ls.y, camera()?.heading?.() ?? 0));
      const turned = walk.armed && code !== walk.code && t - walk.last >= 150;
      if (!walk.armed || turned || t - walk.last >= tune.walkRepeatMs) {
        tap({ key: code.slice(6), code });
        walk = { armed: true, last: t, code };
      }
    } else if (ls.m < tune.flickOff) walk.armed = false;

    // 🎥 right stick turns the lens, the triggers zoom it
    const cam = camera();
    const rs = snap.rs;
    if (rs.m > 0 && cam) {
      if (!grabbed) { grabbed = true; cam.grab?.(true); }
      // Stick right = a mouse dragged right (OrbitControls: theta falls); stick up = toward top-down.
      cam.orbit?.(-rs.x * tune.orbitRadPerSec * dt, rs.y * tune.tiltRadPerSec * dt);
    } else if (grabbed) { grabbed = false; cam?.grab?.(false); }
    const zoomIn = snap.rt > .08 ? snap.rt : 0, zoomOut = snap.lt > .08 ? snap.lt : 0;
    if (cam && (zoomIn || zoomOut)) cam.zoom?.(Math.pow(tune.zoomPerSec, (zoomOut - zoomIn) * dt));
  }

  function tick(t) {
    const dt = lastT == null ? 0 : Math.min(.05, Math.max(0, (t - lastT) / 1000));
    lastT = t;
    const snap = merge(getPads?.() ?? []);
    if (!snap.any) { if (prev?.any) releaseAll(); prev = snap; return; }
    const edges = padEdges(prev, snap);
    const busy = edges.pressed.length || edges.released.length || snap.ls.m || snap.rs.m || snap.lt > .08 || snap.rt > .08;
    if (busy && t - lastActivity >= 100) { lastActivity = t; activity(); }
    const now = layer();
    if (now !== lastLayer) {
      releaseAll();
      if (now === 'riff') focus?.hide?.();
      lastLayer = now;
      // ⚠️ A press landing on the very poll the layer flips belongs to NEITHER
      // layer — the last strum of a duel must not click whatever the turn screen
      // highlights. (A button merely still HELD is already old news: its edge was
      // in the old layer.)
      prev = snap; return;
    }
    if (now === 'riff') riffTick(snap, edges); else turnTick(snap, edges, t, dt);
    prev = snap;
  }

  return { tick, releaseAll, snapshot: () => prev };
}

// ── the browser wiring ──
/**
 * Start the pad in a real page. Returns a dispose function. Mounted once, by `App.jsx`.
 * ⚠️ BROWSERS HIDE A PAD UNTIL ONE OF ITS BUTTONS IS PRESSED on the page (a
 * fingerprinting guard) — so "plug in, nothing happens" is normal; any press wakes it.
 */
export function mountGamepad({ win = globalThis.window, doc = globalThis.document, tune = PAD_TUNING } = {}) {
  if (!win?.navigator?.getGamepads || !doc?.body) return () => {};
  const focus = createPadFocus({ doc, win });
  // A key goes where a real one would: the focused element (so Enter in a text
  // field is that field's), else the page.
  const sendKey = (type, { key, code }) => {
    const ev = new win.KeyboardEvent(type, { key, code, bubbles: true, cancelable: true, composed: true });
    try { Object.defineProperty(ev, 'rlswPad', { value: true }); } catch { /* frozen */ }
    const at = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : doc.body;
    (at.isConnected ? at : doc.body).dispatchEvent(ev);
  };
  // ⚠️ getGamepads THROWS where a permissions policy blocks it (a page inside an
  // iframe without allow="gamepad"), so every read goes through this.
  const pads = () => { try { return [...(win.navigator.getGamepads() ?? [])]; } catch { return []; } };
  const runtime = createPadRuntime({
    getPads: pads,
    sendKey, focus,
    activity: () => doc.dispatchEvent(new win.Event(PAD_ACTIVITY_EVENT)),
    tune,
  });
  let timer = null;
  const now = () => win.performance?.now?.() ?? Date.now();
  const anyPad = () => pads().some(p => p && p.connected !== false);
  const start = () => { if (timer == null) timer = win.setInterval(() => {
    runtime.tick(now());
    if (!anyPad()) { win.clearInterval(timer); timer = null; }
  }, tune.pollMs); };
  const blur = () => runtime.releaseAll();
  win.addEventListener('gamepadconnected', start);
  win.addEventListener('blur', blur);
  // 📌 A slow look as well as the event: a pad the browser revealed before this
  // mounted fires no second `gamepadconnected`, and the poll would never start.
  const probe = win.setInterval(() => { if (timer == null && anyPad()) start(); }, 1000);
  if (anyPad()) start();
  return () => {
    win.clearInterval(probe);
    if (timer != null) win.clearInterval(timer);
    win.removeEventListener('gamepadconnected', start);
    win.removeEventListener('blur', blur);
    runtime.releaseAll();
    focus?.dispose();
  };
}
