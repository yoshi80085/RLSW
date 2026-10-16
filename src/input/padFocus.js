// ─── 🎮 THE HIGHLIGHT — what the D-pad moves and A presses ──────────────────
// Most of the game is still clicked (2026-10-14: ~230 click targets, 3 that knew
// about keyboard focus). Rather than teach every screen about a controller, the
// highlight finds what a MOUSE could click right now and lets the D-pad walk it:
//
//   · WHAT COUNTS: real buttons, links, inputs, ARIA roles, `[tabindex]`, the
//     hand's note chips (`[data-stock-idx]`), board hexes the monolith opens to
//     the pad (`[data-pad-hex]`), anything marked `[data-pad]`, and — the catch-
//     all — anything styled `cursor: pointer` inline, which is how this codebase
//     marks a clickable <div>. `[data-pad="skip"]` opts out.
//   · ⭐ WHAT IS ON TOP: a target only counts if `elementFromPoint` at its centre
//     lands on it. That one test scopes the highlight to the top-most modal,
//     skips anything behind a scrim, and skips `pointer-events:none` decoration —
//     the same things a mouse can't click. No screen has to register itself.
//   · A PRESS IS A CLICK: pointerdown → mousedown → pointerup → mouseup → click at
//     the target's centre, so `onClick`, `onPointerDown` and the arena's own
//     drag-vs-tap filter (`board/arenaDom.js`) all see what a mouse would send.
//   · ⭐ HOVER COMES FREE: landing on a target sends it mouseover/pointerover (and
//     the old one mouseout/pointerout), which is what React's onMouseEnter is built
//     from — so the note tips, the hex preview and the battle-mode previews that
//     used to need a mouse show up under the highlight.
//
// ⚠️ EVERY EVENT WE SEND CARRIES `rlswPad: true`, so `GlobalCursor` can ignore
// it (otherwise the mouse arrow would jump to every button the pad presses), and
// the ring knows a real mouse move from ours.
//
// 🎮 PAD MODE vs MOUSE MODE (Alex, 2026-10-14: *"The game should differentiate
// between controller use vs not using a controller. So when the controller is in
// use, the mouse pointer should go away - and the box that is selected should be
// 'lit up'"*). THE LAST DEVICE USED WINS:
//   · any pad input → `enterPad()`: `<html data-rlsw-input="pad">` (GlobalCursor
//     hides its arrow on that), and a transparent SHIELD goes over the page.
//   · real mouse travel (≥ `hideOnMouse` px), a real press or a wheel → `leavePad()`.
// ⭐ WHY A SHIELD: the arrow can be hidden with CSS, but the mouse is still
// RESTING on something, and that thing keeps its `:hover` look and its
// onMouseEnter tip — so on a pad, one stray box would stay lit beside the ring.
// The shield is what the resting mouse is over instead; the pad's own hover and
// clicks are dispatched straight to their targets, so it never gets in their way.
// ⚠️ It would also blind `onTop` (every point would hit the shield), so the
// hit-test reads `elementsFromPoint` and looks THROUGH the shield and the ring.
//
// 🎯 EACH SCREEN NAMES WHERE THE RING STARTS: `[data-pad-default="<key>"]`. When
// a default with a NEW key appears (the turn moves Chord → Melody, a stack is
// picked, a new human turn begins), the ring jumps to it. ⚠️ KEYED ON THE VALUE,
// NOT THE ELEMENT: the chord step's default is "the first unused chip", which is a
// different chip after every commit — keyed on the element, the ring would be
// yanked back to the start of the hand after every note. Same key = leave the
// player where they are.
import { pickNeighbor, nearestTo } from './padNav.js';

/** Fired on `document` (detail `{ mode }`) when the pad / mouse mode flips. */
export const INPUT_MODE_EVENT = 'rlsw:input-mode';
/** Fired on `document` once, when the pad is found also driving the mouse / keyboard (PAD_GUARD). */
export const PAD_ECHO_EVENT = 'rlsw:pad-echo';
/** The attribute on <html>: "pad" or "mouse". CSS keys off it. */
export const INPUT_MODE_ATTR = 'data-rlsw-input';

/**
 * 🛡️ THE EMULATION GUARD (Alex, 2026-10-14, his first match on the pad: *"the mouse never
 * really goes away, even in controller mode - so if I try and use the joystick to try and
 * reach for a note from the wheel - the mouse gets reactivated and starts going off in
 * whichever direction on the screen - any push from the buttons would have other unintended
 * effects - like closing the window or anything the cursor is over"*).
 * ⚠️ CAUSE: something on the PC (Steam Input's Desktop Layout, DS4Windows, a mapper) turns
 * the pad into a mouse and keyboard AS WELL — a stick push is also a real mouse move, a button
 * is also a real click or key. The page cannot switch that off, but it can tell: those
 * events arrive WHILE THE PAD IS IN USE. So for `ms` after any pad input (and while anything
 * is held) a real mouse move does not hand control back, and a real click, wheel or key is
 * swallowed before the game hears it. The pad's own events carry `rlswPad` and pass.
 */
export const PAD_GUARD = Object.freeze({
  ms: 300,             // after the last pad input, how long real mouse / key events are treated as the pad's echo
  noticeAfter: 3,      // swallowed echoes before the one-time "your pad is also a mouse" notice
});

/** The ring's look. ✅ Alex's dial-in, 2026-10-14 (Controller Lab): 0 of 7 moved — kept as is. */
export const PAD_RING = Object.freeze({
  color: '#5ef0ff',      // the cursor's own cyan bloom (GlobalCursor)
  width: 2,              // px
  glow: 14,              // px of bloom
  pad: 4,                // px the ring stands off its target
  radius: 8,             // px corner
  pulse: 1.4,            // s per breath; 0 = still
  glide: 90,             // ms to slide between targets; 0 = jump
  hideOnMouse: 6,        // px of real mouse travel that hands control back to the mouse
});

export const PAD_TARGETS = [
  'button', 'a[href]', 'input:not([type=hidden])', 'select', 'textarea', 'summary',
  '[role=button]', '[role=menuitem]', '[role=option]', '[role=tab]', '[role=checkbox]', '[role=switch]', '[role=radio]',
  '[tabindex]:not([tabindex="-1"])', '[data-stock-idx]', '[data-pad-hex]', '[data-pad]',
  '[style*="cursor: pointer"]', '[style*="cursor:pointer"]',
].join(',');
const OFF = '[data-pad="skip"],[inert],[aria-hidden="true"]';
const TEXT_ENTRY = 'input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select,[contenteditable="true"]';

const tag = ev => { try { Object.defineProperty(ev, 'rlswPad', { value: true }); } catch { /* frozen */ } return ev; };

// ⚠️ `fromOs`: only an event the BROWSER delivered (`isTrusted`) can be a mapper's echo. The
// game's own code clicking a button — the D-pad cross's `button.click()` — is untrusted and
// must never be swallowed. Alex, 14 Oct 22:32: *"the dpad for example - I'm not able to use any
// of the abilities"* — the first guard swallowed exactly that click, because the D-pad press
// that made it also held the guard up. A test passes its own predicate (jsdom's are all untrusted).
export function createPadFocus({ doc = globalThis.document, win = globalThis.window, look = PAD_RING, fromOs = e => e.isTrusted === true } = {}) {
  if (!doc?.body || !win) return null;
  let target = null, shown = false, raf = 0, lastPoint = null, lastCheck = 0, disposed = false;

  // ── the ring ──
  const ring = doc.createElement('div');
  ring.setAttribute('data-pad-ring', '');
  ring.setAttribute('aria-hidden', 'true');
  const reduced = () => !!win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const styleRing = () => {
    Object.assign(ring.style, {
      position: 'fixed', left: '0px', top: '0px', width: '0px', height: '0px', zIndex: '2147483000',
      pointerEvents: 'none', boxSizing: 'border-box', display: 'none',
      border: `${look.width}px solid ${look.color}`, borderRadius: `${look.radius}px`,
      boxShadow: `0 0 ${look.glow}px ${look.color}, inset 0 0 ${Math.round(look.glow / 2)}px ${look.color}55`,
      transition: reduced() || !look.glide ? 'none'
        : `transform ${look.glide}ms ease-out, width ${look.glide}ms ease-out, height ${look.glide}ms ease-out`,
      animation: reduced() || !look.pulse ? 'none' : `rlsw-pad-breathe ${look.pulse}s ease-in-out infinite`,
    });
  };
  const sheet = doc.createElement('style');
  sheet.textContent = '@keyframes rlsw-pad-breathe{0%,100%{opacity:1}50%{opacity:.62}}';
  doc.head?.appendChild(sheet);
  styleRing();
  doc.body.appendChild(ring);

  // ── the shield (pad mode only) ──
  let mode = 'mouse';
  const shield = doc.createElement('div');
  shield.setAttribute('data-pad-shield', '');
  shield.setAttribute('aria-hidden', 'true');
  Object.assign(shield.style, { position: 'fixed', inset: '0px', left: '0px', top: '0px', right: '0px', bottom: '0px',
    zIndex: '2147482990', background: 'transparent', cursor: 'none', display: 'none' });
  doc.body.appendChild(shield);
  const setMode = m => {
    if (m === mode || disposed) return;
    mode = m;
    doc.documentElement?.setAttribute(INPUT_MODE_ATTR, m);
    shield.style.display = m === 'pad' ? 'block' : 'none';
    try { doc.dispatchEvent(new win.CustomEvent(INPUT_MODE_EVENT, { detail: { mode: m } })); } catch { /* old jsdom */ }
  };
  doc.documentElement?.setAttribute(INPUT_MODE_ATTR, mode);

  // ── finding targets ──
  const vw = () => win.innerWidth || doc.documentElement?.clientWidth || 0;
  const vh = () => win.innerHeight || doc.documentElement?.clientHeight || 0;
  // ⚠️ `elementsFromPoint` (plural) so the shield and the ring are looked THROUGH;
  // the singular form is the fallback for a DOM that lacks it (jsdom).
  const hitAt = (x, y) => {
    if (typeof doc.elementsFromPoint === 'function') {
      return doc.elementsFromPoint(x, y).find(h => h !== shield && h !== ring) ?? null;
    }
    const h = doc.elementFromPoint(x, y);
    return h === shield || h === ring ? null : h;
  };
  function onTop(el, r) {
    if (typeof doc.elementFromPoint !== 'function' && typeof doc.elementsFromPoint !== 'function') return true;
    for (const [fx, fy] of [[.5, .5], [.25, .3], [.75, .7], [.3, .75], [.7, .25]]) {
      const x = Math.min(vw() - 1, Math.max(0, r.left + r.width * fx));
      const y = Math.min(vh() - 1, Math.max(0, r.top + r.height * fy));
      const hit = hitAt(x, y);
      if (hit && (hit === el || el.contains(hit))) return true;
    }
    return false;
  }
  function usable(el) {
    if (!el?.isConnected || el === ring || el === shield) return false;
    if (el.disabled || el.getAttribute?.('aria-disabled') === 'true' || el.closest?.(OFF)) return false;
    const r = el.getBoundingClientRect?.();
    if (!r || r.width < 6 || r.height < 6) return false;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= vw() || r.top >= vh()) return false;
    const cs = win.getComputedStyle?.(el);
    if (cs && (cs.visibility === 'hidden' || cs.display === 'none')) return false;
    return onTop(el, r);
  }
  /** Every target the pad can reach right now, outermost of any nested pair. */
  function candidates() {
    const all = [...doc.querySelectorAll(PAD_TARGETS)];
    const set = new Set(all);
    const outer = all.filter(el => { for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false; return true; });
    return outer.filter(usable);
  }
  const rectOf = el => el.getBoundingClientRect();
  const centreOf = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  // ── hover in and out ──
  function send(el, type, init = {}, Ctor = null) {
    const r = rectOf(el), c = centreOf(r);
    const C = Ctor ?? (type.startsWith('pointer') ? (win.PointerEvent ?? win.MouseEvent) : win.MouseEvent);
    const bubbles = !/enter|leave/.test(type);
    const ev = new C(type, { bubbles, cancelable: true, composed: true, clientX: c.x, clientY: c.y, view: win,
      pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 0, ...init });
    el.dispatchEvent(tag(ev));
  }
  function hoverTo(next) {
    const prev = target;
    if (prev === next) return;
    if (prev?.isConnected) {
      for (const t of ['pointerout', 'pointerleave', 'mouseout', 'mouseleave']) send(prev, t, { relatedTarget: next ?? null });
    }
    target = next;
    if (next) for (const t of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']) send(next, t, { relatedTarget: prev ?? null });
  }

  // ── the ring follows its target (a hex moves when the lens turns) ──
  function paint() {
    raf = 0;
    if (!shown || disposed) return;
    const now = win.performance?.now?.() ?? Date.now();
    if (defaultDirty || now - lastCheck > 250) { defaultDirty = false; checkDefault(); }
    if (now - lastCheck > 250) {   // ⚠️ throttled: `usable` hit-tests, and a target can vanish mid-turn
      lastCheck = now;
      if (!usable(target)) { const list = candidates(); hoverTo(list.length ? list[nearestTo(lastPoint ?? defaultPoint(), list.map(rectOf))] : null); }   // ⚠️ hoverTo, not land: land() would kick a second rAF loop from inside this one
    }
    if (target) {
      const r = rectOf(target), p = look.pad;
      ring.style.display = 'block';
      ring.style.transform = `translate(${Math.round(r.left - p)}px, ${Math.round(r.top - p)}px)`;
      ring.style.width = `${Math.round(r.width + 2 * p)}px`;
      ring.style.height = `${Math.round(r.height + 2 * p)}px`;
      lastPoint = centreOf(r);
    } else ring.style.display = 'none';
    raf = win.requestAnimationFrame?.(paint) ?? 0;
  }
  const kick = () => { if (!raf && shown) raf = win.requestAnimationFrame?.(paint) ?? 0; if (!win.requestAnimationFrame) paint(); };
  const defaultPoint = () => ({ x: vw() / 2, y: vh() * .62 });
  function land(el) { hoverTo(el ?? null); kick(); }

  // ── where each screen wants the ring to start ──
  let lastDefaultKey = null, defaultDirty = true;
  /** The first usable `[data-pad-default]` and its key, or null. */
  function currentDefault() {
    for (const el of doc.querySelectorAll('[data-pad-default]')) {
      if (usable(el)) return { el, key: el.getAttribute('data-pad-default') || '' };
    }
    return null;
  }
  /** A default with a NEW key takes the ring; the same key leaves the player where they are. */
  function checkDefault() {
    const d = currentDefault();
    if (!d) { lastDefaultKey = null; return false; }
    if (d.key === lastDefaultKey) return false;
    lastDefaultKey = d.key;
    if (d.el !== target) { hoverTo(d.el); kick(); }
    return true;
  }
  // 📌 A step change re-renders the HUD; this only marks the check due, so the
  // ring follows on the next frame instead of up to 250 ms later.
  const observer = typeof win.MutationObserver === 'function'
    ? new win.MutationObserver(() => { defaultDirty = true; }) : null;
  observer?.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-pad-default', 'disabled'] });

  /** Show the ring: on a new `[data-pad-default]`, else back where it was, else nearest the middle. */
  function show() {
    if (disposed) return false;
    const was = shown; shown = true;
    setMode('pad');
    if (checkDefault()) { /* landed on the screen's default */ }
    else if (!usable(target)) {
      const list = candidates();
      const preferred = list.find(el => el.matches?.('[data-pad-default]'));
      land(preferred ?? (list.length ? list[nearestTo(lastPoint ?? defaultPoint(), list.map(rectOf))] : null));
    } else if (!was) { const t = target; target = null; land(t); }
    kick();
    return !was;
  }
  /** Hide the ring only (a Riff-Off takes the pad): the mouse stays hidden — the pad is still in use. */
  function hide() {
    if (!shown) return;
    shown = false; hoverTo(null); ring.style.display = 'none';
    if (raf) { win.cancelAnimationFrame?.(raf); raf = 0; }
  }
  /** The pad is in use: hide the mouse (the ring is `show()`'s job — not in a duel). */
  const enterPad = () => setMode('pad');
  /** The mouse is back: ring off, shield off, arrow back. */
  function leavePad() { hide(); setMode('mouse'); }

  /** Move the highlight. Nothing that way → scroll the list it sits in, once, and look again. */
  function move(dir, retried = false) {
    if (!shown) return show();
    const list = candidates();
    if (!target || !list.includes(target)) { land(list.length ? list[nearestTo(lastPoint ?? defaultPoint(), list.map(rectOf))] : null); return true; }
    const rects = list.map(rectOf), from = rects[list.indexOf(target)];
    const i = pickNeighbor(from, rects, dir);
    if (i >= 0) { land(list[i]); return true; }
    if (!retried && scrollToward(target, dir)) { win.setTimeout(() => move(dir, true), 60); return true; }
    return false;
  }
  function scrollToward(el, dir) {
    const vert = dir === 'up' || dir === 'down', sign = dir === 'down' || dir === 'right' ? 1 : -1;
    for (let p = el?.parentElement; p && p !== doc.body; p = p.parentElement) {
      const cs = win.getComputedStyle?.(p);
      const over = vert ? cs?.overflowY : cs?.overflowX;
      if (!/(auto|scroll)/.test(over ?? '')) continue;
      const room = vert ? p.scrollHeight - p.clientHeight : p.scrollWidth - p.clientWidth;
      const at = vert ? p.scrollTop : p.scrollLeft;
      if (room <= 1 || (sign > 0 ? at >= room - 1 : at <= 0)) continue;
      const by = sign * Math.round((vert ? p.clientHeight : p.clientWidth) * .6);
      p.scrollBy?.(vert ? { top: by } : { left: by });
      return true;
    }
    return false;
  }

  /** ←/→ on a slider nudges it (the ☰ volume faders) instead of leaving it. */
  function adjust(dir) {
    const el = target;
    if (!shown || !el || el.tagName !== 'INPUT' || el.type !== 'range' || (dir !== 'left' && dir !== 'right')) return false;
    const min = Number(el.min || 0), max = Number(el.max || 100), step = Number(el.step) || 1;
    const by = Math.max(step, (max - min) / 20) * (dir === 'right' ? 1 : -1);
    const v = Math.min(max, Math.max(min, Number(el.value) + by));
    // ⚠️ React's onChange only hears a value set through the NATIVE setter.
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set?.call(el, String(v));
    el.dispatchEvent(tag(new win.Event('input', { bubbles: true })));
    el.dispatchEvent(tag(new win.Event('change', { bubbles: true })));
    return true;
  }

  /** A on the highlight = a mouse click there. A text field takes focus instead (a pad has no keys). */
  function press(el = target) {
    if (!el?.isConnected) return false;
    if (el.matches?.(TEXT_ENTRY)) { el.focus?.(); return true; }
    send(el, 'pointerdown', { buttons: 1 });
    send(el, 'mousedown', { buttons: 1 }, win.MouseEvent);
    send(el, 'pointerup');
    send(el, 'mouseup', {}, win.MouseEvent);
    send(el, 'click', { detail: 1 }, win.MouseEvent);
    return true;
  }
  /** Put the ring on this element (an aim hop: `gamepad.js` picked a LEGAL target). */
  function focusOn(el) {
    if (!el?.isConnected || disposed) return false;
    shown = true; setMode('pad'); land(el); return true;
  }
  /** Press the first usable element matching a selector (☰ from the Menu button), and highlight it. */
  function pressSelector(selector) {
    const el = [...doc.querySelectorAll(selector)].find(usable);
    if (!el) return false;
    shown = true; land(el); press(el); return true;
  }

  // ── 🛡️ the emulation guard (PAD_GUARD) ──
  const clock = () => win.performance?.now?.() ?? Date.now();
  let padHeld = false, lastPadAt = -Infinity, echoes = 0, noticed = false;
  /** The pad runtime reports every poll: `held` = a button, a stick or a trigger is in use. */
  function padPulse(held) {
    padHeld = !!held;
    if (held) lastPadAt = clock();
  }
  const guarding = () => padHeld || clock() - lastPadAt < PAD_GUARD.ms;
  function echo() {
    echoes++;
    if (noticed || echoes < PAD_GUARD.noticeAfter) return;
    noticed = true;
    try { doc.dispatchEvent(new win.CustomEvent(PAD_ECHO_EVENT, { detail: { echoes } })); } catch { /* old jsdom */ }
    const n = doc.createElement('div');
    n.setAttribute('data-pad-echo-notice', '');
    n.setAttribute('role', 'status');
    n.textContent = '🎮 Your controller is also moving the mouse and pressing keys (usually Steam Input\'s Desktop Layout, or a mapper like DS4Windows). The game ignores that while you play on the pad — turning it off for your browser will feel cleaner.';
    Object.assign(n.style, { position: 'fixed', left: '50%', top: '64px', transform: 'translateX(-50%)', zIndex: '2147483001',
      maxWidth: '560px', padding: '9px 14px', borderRadius: '6px', background: '#0a1224f2', border: `1px solid ${look.color}`,
      color: '#dfe8ff', font: '12px/1.45 Saira, sans-serif', boxShadow: `0 0 18px -6px ${look.color}`, pointerEvents: 'none' });
    doc.body.appendChild(n);
    win.setTimeout(() => n.remove(), 9000);
  }
  // A real click / wheel / key arriving while the pad is in use is the pad's own echo: swallow it.
  // Only a REAL one (`fromOs`): a click the game's code makes is never an echo.
  const swallow = e => {
    if (e.rlswPad || !guarding() || !fromOs(e)) return;
    e.preventDefault?.(); e.stopImmediatePropagation?.();
    echo();
  };
  const ECHO_MOUSE = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'auxclick', 'dblclick', 'contextmenu', 'wheel'];
  for (const t of ECHO_MOUSE) win.addEventListener(t, swallow, { capture: true, passive: false });
  for (const t of ['keydown', 'keyup', 'keypress']) win.addEventListener(t, swallow, { capture: true });

  // A real mouse takes over again — ⚠️ but not a mouse the pad is moving (PAD_GUARD).
  const onMouse = e => {
    if ((!shown && mode !== 'pad') || e.rlswPad) return;
    const travel = Math.abs(e.movementX ?? 0) + Math.abs(e.movementY ?? 0);
    if (guarding()) { if (travel > 0) echoMoves++; if (echoMoves === 20) echo(); return; }
    if (travel >= look.hideOnMouse) leavePad();
  };
  let echoMoves = 0;
  doc.addEventListener('pointermove', onMouse, { capture: true, passive: true });
  // ⚠️ A real press or wheel on the shield is the mouse coming back. That first
  // press is spent waking the mouse (it landed on the shield, not the button) —
  // in practice the hand moves the mouse further than `hideOnMouse` first.
  const onShield = e => { if (!e.rlswPad) leavePad(); };
  for (const t of ['pointerdown', 'wheel', 'touchstart']) shield.addEventListener(t, onShield, { passive: true });

  return {
    show, hide, move, press, adjust, pressSelector, focusOn, candidates, enterPad, leavePad, padPulse, guarding,
    visible: () => shown, target: () => target, mode: () => mode,
    dispose() {
      hide(); setMode('mouse'); disposed = true;
      observer?.disconnect();
      doc.removeEventListener('pointermove', onMouse, { capture: true });
      for (const t of ECHO_MOUSE) win.removeEventListener(t, swallow, { capture: true });
      for (const t of ['keydown', 'keyup', 'keypress']) win.removeEventListener(t, swallow, { capture: true });
      ring.remove(); sheet.remove(); shield.remove();
    },
  };
}
