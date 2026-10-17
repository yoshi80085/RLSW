// ═══ THE GATE — the fake "502" front door, in the browser ═════════════════
// `main.jsx` hands `runGate` the real boot (a dynamic import of `boot.jsx`).
// While the gate is up, the page is the 502 that `gateDisguise.js` baked into
// index.html, and this listens for the code (`gateCode.js`) on the keyboard and
// on any pad. The right code → the fake page goes, the tab gets its real name
// and icon back, and only THEN is the game downloaded.
//
// 🎯 THE GAME IS NOT LOADED UNTIL THE CODE IS IN. `boot.jsx` (React, the
//    monolith, the art) is a separate chunk that nothing fetches before
//    `boot()`. A "broken" page that quietly pulled megabytes of JavaScript and
//    3D models would give itself away in the Network tab.
// ⚠️ Read `gateCode.js`'s header: a curtain for passers-by, not a lock.
// 🎮 Pad-ready rule (CLAUDE.md): this screen has nothing clickable ON PURPOSE —
//    it is pretending to be a dead server. The D-pad and left stick type the code.

import { GATE } from './gateConfig.js';
import { createCodeListener } from './gateCode.js';

// Bland on purpose: anyone reading sessionStorage should not see "unlocked".
const REMEMBER_KEY = 'gw';

/** Keyboard → code word. `code` (not `key`) so WASD is the same keys on any layout. */
export const KEY_TOKENS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
};

// Standard-mapping D-pad buttons, and the left stick's thresholds.
const DPAD = { up: 12, down: 13, left: 14, right: 15 };
const STICK_ON = 0.6;   // a flick past this counts …
const STICK_OFF = 0.3;  // … and must come back inside this before it can count again
// 📌 The gap between the two is the hysteresis: without it a stick resting near
//    0.6 chatters, and one push types the same direction three times.

/**
 * Which directions this pad is holding, given which it held last frame.
 * Pure — `gateCheck.mjs` drives it with fake pads.
 * The stick counts on its DOMINANT axis only, so a slightly diagonal flick is
 * one direction, not two.
 */
export function padDirections(pad, wasHeld = new Set()) {
  const held = new Set();
  const [sx = 0, sy = 0] = pad.axes || [];
  const vertical = Math.abs(sy) >= Math.abs(sx);
  const stick = {
    up: vertical ? -sy : 0, down: vertical ? sy : 0,
    left: vertical ? 0 : -sx, right: vertical ? 0 : sx,
  };
  for (const dir of ['up', 'down', 'left', 'right']) {
    const button = !!pad.buttons?.[DPAD[dir]]?.pressed;
    const threshold = wasHeld.has(dir) ? STICK_OFF : STICK_ON;
    if (button || stick[dir] > threshold) held.add(dir);
  }
  return held;
}

/** Is the gate up for this page load? Never in dev; never once opened in this tab. */
export function gateActive({ dev = !!import.meta.env?.DEV, config = GATE, storage } = {}) {
  if (dev || !config.on) return false;
  if (config.rememberInTab) {
    try {
      const s = storage ?? globalThis.sessionStorage;
      if (s?.getItem(REMEMBER_KEY) === '1') return false;
    } catch { /* private mode / blocked storage: just ask for the code */ }
  }
  return true;
}

/** Give the tab back its real name, icon and fonts (a build stripped them). */
function revealHead() {
  document.getElementById('gw')?.remove();
  document.title = GATE.realTitle;
  const head = document.head;
  if (!head.querySelector('link[rel="icon"]')) {
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/svg+xml';
    icon.href = `${import.meta.env?.BASE_URL ?? '/'}favicon.svg`;
    head.appendChild(icon);
  }
  if (!head.querySelector(`link[href="${GATE.fontsHref}"]`)) {
    const fonts = document.createElement('link');
    fonts.rel = 'stylesheet';
    fonts.href = GATE.fontsHref;
    head.appendChild(fonts);
  }
}

/**
 * The front door. `boot` loads and mounts the real game.
 * Gate down → reveal and boot at once. Gate up → wait for the code.
 */
export function runGate(boot) {
  if (!gateActive()) {
    if (GATE.on) revealHead();   // a remembered tab still has the disguised HTML
    return boot();
  }

  const code = createCodeListener({ hash: GATE.codeHash, length: GATE.codeLength, gapMs: GATE.gapMs });
  let raf = 0;
  let open = false;
  const padHeld = new Map();   // pad index → Set of directions held last frame

  const unlock = () => {
    if (open) return;
    open = true;
    window.removeEventListener('keydown', onKey, true);
    cancelAnimationFrame(raf);
    if (GATE.rememberInTab) { try { sessionStorage.setItem(REMEMBER_KEY, '1'); } catch { /* fine */ } }
    revealHead();
    boot();
  };
  const press = (token) => { if (code.push(token)) unlock(); };

  function onKey(e) {
    if (e.repeat) return;   // a held arrow is one press, not a burst of them
    const token = KEY_TOKENS[e.code];
    if (token) press(token);
  }
  window.addEventListener('keydown', onKey, true);

  // 🎮 Polled, because the Gamepad API has no button events. Cheap: four
  //    buttons and two axes per frame, and it stops the moment the gate opens.
  const poll = () => {
    const pads = navigator.getGamepads?.() ?? [];
    for (const pad of pads) {
      if (!pad) continue;
      const was = padHeld.get(pad.index) ?? new Set();
      const now = padDirections(pad, was);
      padHeld.set(pad.index, now);
      for (const dir of now) if (!was.has(dir)) press(dir);
      if (open) return;
    }
    raf = requestAnimationFrame(poll);
  };
  raf = requestAnimationFrame(poll);
}
